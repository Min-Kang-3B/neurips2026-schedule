// NeurIPS 2026 schedule — remote MCP server (Cloudflare Worker, stateless Streamable HTTP).
//
//   POST /mcp/<syncCode>   MCP endpoint (paper search + wishlist tools for that sync code)
//   POST /mcp              MCP endpoint without wishlist tools
//   GET|PUT /api/wish/<syncCode>   wishlist sync for the schedule site
//
// Data: D1 (papers/events seeded by scripts/build_d1.py, wish table for synced wishlists),
// paper embeddings fetched from the site (data/search/emb.bin), query embeddings from Workers AI
// with the same model the site uses in the browser (bge-small-en-v1.5, CLS pooling).

const SERVER = { name: 'neurips2026-schedule', version: '1.0.0' };
const PROTOCOLS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];
const VENUES = ['sydney', 'atlanta', 'paris'];
const TZ = { sydney: 'AEDT (UTC+11)', atlanta: 'EST (UTC-5)', paris: 'CET (UTC+1)' };
const CODE_RE = /^[a-z0-9]{20,40}$/;
const QUERY_PREFIX = 'Represent this sentence for searching relevant passages: ';
const DIM = 384;

const INSTRUCTIONS = `Unofficial NeurIPS 2026 schedule (Sydney main venue Dec 6-12; satellite venues Atlanta and Paris Dec 9-13).
- Use search_papers to find papers (keyword or semantic), get_paper for the abstract, get_schedule / search_events for sessions, talks, workshops.
- Times are local to each venue; the user is usually in Korea (KST = UTC+9). Korean titles (title_ko) are machine translations.
- The default venue is Sydney; only include Atlanta/Paris when the user asks.
- Wishlist tools edit the user's personal wishlist, which syncs to their schedule site. Confirm before removing items.`;

// ---------------- helpers ----------------
function cors(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.SITE_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : (allowed[0] || '*'),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version, Authorization',
    'Access-Control-Expose-Headers': 'Mcp-Session-Id',
    'Vary': 'Origin'
  };
}
function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status: status || 200, headers: { 'Content-Type': 'application/json', ...(headers || {}) } });
}
function venueList(v) {
  if (!v || v === 'sydney') return ['sydney'];
  if (v === 'all') return VENUES;
  if (VENUES.includes(v)) return [v];
  throw new Error(`venue must be one of ${VENUES.join(', ')}, all`);
}
function clampInt(v, lo, hi, dflt) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : dflt;
}
function siteLink(env, venue, date, eventId) {
  return `${env.SITE_URL}/?loc=${venue}&day=${venue}-${date}&open=${eventId}`;
}
function sessionOf(e, env) {
  if (!e) return null;
  return {
    id: e.id, title: e.en, title_ko: e.ko, type: e.type_en, venue: e.venue, date: e.date,
    start: e.start, end: e.end_t, timezone: TZ[e.venue], room: e.room, url: siteLink(env, e.venue, e.date, e.id)
  };
}
function paperOut(p, ev, env, wish, withAbstract) {
  const o = {
    id: p.id, title: p.en, title_ko: p.ko, authors: (p.authors || '').slice(0, 400), institutions: p.inst || '',
    tag: p.tag || null, track: p.ws ? 'workshop' : 'main', venue: p.venue,
    session: sessionOf(ev, env), poster_session: p.psess || null, poster_board: p.pos || null,
    openreview: p.link || null
  };
  if (p.rv != null) o.review_avg = p.rv;
  if (p.score != null) o.match = Math.round(p.score * 100) / 100;
  if (wish) o.wishlisted = !!wish.papers[p.id];
  if (withAbstract) {
    o.abstract = p.abs || null; o.abstract_ko = p.abs_ko || null;
    if (p.ins) {
      try {
        const d = JSON.parse(p.ins);
        if (d.or) o.openreview_reviews = { decision: d.or.decision, area: d.or.area, ratings: d.or.ratings, avg: d.or.avg, std: d.or.std, confidence: d.or.conf, subscores: d.or.sub, rebuttals: d.or.n_rebuttal };
        if (d.rs) o.review_summary_ko = d.rs;
        if (d.ps) o.poster_summary = d.ps;
        if (d.img) o.poster_image = POSTER_BASE + p.id + '.webp';
        o.note = 'review_summary_ko and poster_summary are AI-generated from public OpenReview reviews and the poster image; verify numbers on the poster.';
      } catch (e) { /* ignore bad row */ }
    }
  }
  return o;
}
async function eventsById(env, ids) {
  const uniq = [...new Set(ids.filter(Boolean))];
  const map = {};
  for (let i = 0; i < uniq.length; i += 90) {
    const chunk = uniq.slice(i, i + 90);
    const r = await env.DB.prepare(`SELECT * FROM events WHERE id IN (${chunk.map(() => '?').join(',')})`).bind(...chunk).all();
    r.results.forEach(e => { map[e.id] = e; });
  }
  return map;
}
async function papersById(env, ids) {
  const uniq = [...new Set(ids.filter(Boolean))];
  const map = {};
  for (let i = 0; i < uniq.length; i += 90) {
    const chunk = uniq.slice(i, i + 90);
    const r = await env.DB.prepare(`SELECT id, sid, venue, en, ko, authors, inst, tag, ws, pos, psess, link FROM papers WHERE id IN (${chunk.map(() => '?').join(',')}) ORDER BY ws`).bind(...chunk).all();
    r.results.forEach(p => { if (!map[p.id]) map[p.id] = p; });
  }
  return map;
}

// ---------------- wishlist store ----------------
async function loadWish(env, code) {
  const r = await env.DB.prepare('SELECT doc, updated FROM wish WHERE code = ?').bind(code).first();
  const doc = r ? JSON.parse(r.doc) : {};
  return { events: doc.events || {}, papers: doc.papers || {}, updated: r ? r.updated : 0 };
}
async function saveWish(env, code, w) {
  const updated = Date.now();
  const doc = JSON.stringify({ events: w.events, papers: w.papers });
  if (doc.length > 400000) throw new Error('wishlist too large');
  await env.DB.prepare('INSERT INTO wish (code, doc, updated) VALUES (?, ?, ?) ON CONFLICT(code) DO UPDATE SET doc = excluded.doc, updated = excluded.updated')
    .bind(code, doc, updated).run();
  return updated;
}
function validWishDoc(d) {
  if (!d || typeof d !== 'object' || typeof d.events !== 'object' || typeof d.papers !== 'object') return false;
  if (Object.keys(d.events).length + Object.keys(d.papers).length > 3000) return false;
  return Object.values(d.papers).every(v => v && typeof v === 'object');
}

// ---------------- search ----------------
function likeEsc(s) { return s.replace(/[\\%_]/g, c => '\\' + c); }
function filters(args) {
  const where = [], bind = [];
  const venues = venueList(args.venue);
  where.push(`venue IN (${venues.map(() => '?').join(',')})`); bind.push(...venues);
  if (args.track === 'main') where.push('ws = 0');
  if (args.track === 'workshop') where.push('ws = 1');
  if (args.orals_spotlights_only) where.push("tag IN ('Oral', 'Spotlight')");
  if (args.institution) { where.push("lower(inst) LIKE ? ESCAPE '\\'"); bind.push('%' + likeEsc(String(args.institution).toLowerCase()) + '%'); }
  if (typeof args.min_review_avg === 'number') { where.push('rv >= ?'); bind.push(args.min_review_avg); }
  return { where, bind };
}
async function keywordSearch(env, args, limit) {
  const toks = String(args.query || '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
  if (!toks.length) throw new Error('query is required');
  const { where, bind } = filters(args);
  const score = [], sbind = [];
  toks.forEach(t => {
    where.push("hay LIKE ? ESCAPE '\\'"); bind.push('%' + likeEsc(t) + '%');
    score.push('(instr(lower(en), ?) > 0) * 3 + (instr(ko, ?) > 0) * 3 + (instr(lower(inst), ?) > 0) * 2 + (instr(lower(authors), ?) > 0)');
    sbind.push(t, t, t, t);
  });
  const sql = `SELECT id, sid, venue, en, ko, authors, inst, tag, ws, pos, psess, link, rv, (${score.join(' + ')}) AS kscore
    FROM papers WHERE ${where.join(' AND ')} ORDER BY ${args.sort === 'rating' ? 'coalesce(rv, 0) DESC, kscore DESC' : "kscore DESC, (tag != '') DESC, ws"} LIMIT ?`;
  const r = await env.DB.prepare(sql).bind(...sbind, ...bind, limit).all();
  return r.results;
}

let EMB = null, EMB_AT = 0;
async function embeddings(env) {
  if (EMB && Date.now() - EMB_AT < 3600e3) return EMB;
  const res = await fetch(`${env.SITE_URL}/data/search/emb.bin`, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!res.ok) throw new Error('embedding file unavailable');
  EMB = new Int8Array(await res.arrayBuffer());
  EMB_AT = Date.now();
  return EMB;
}
async function semanticSearch(env, args, limit) {
  const q = String(args.query || '').trim();
  if (!q) throw new Error('query is required');
  const [emb, ai] = await Promise.all([
    embeddings(env),
    env.AI.run('@cf/baai/bge-small-en-v1.5', { text: [QUERY_PREFIX + q.slice(0, 2000)], pooling: 'cls' })
  ]);
  const v = ai.data[0];
  let norm = 0;
  for (let k = 0; k < DIM; k++) norm += v[k] * v[k];
  norm = Math.sqrt(norm) || 1;
  const qv = new Float32Array(DIM);
  for (let k = 0; k < DIM; k++) qv[k] = v[k] / norm;
  const n = emb.length / DIM;
  // keep the best 300 rows, then let D1 apply the venue/track filters
  const scores = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    const off = i * DIM;
    for (let k = 0; k < DIM; k++) s += qv[k] * emb[off + k];
    scores[i] = s / 127;
  }
  const top = Array.from(scores.keys()).sort((a, b) => scores[b] - scores[a]).slice(0, 300).map(i => [scores[i], i]);
  const scoreOf = new Map(top.map(([s, i]) => [i, s]));
  const { where, bind } = filters(args);
  const rows = [];
  const ids = top.map(t => t[1]);
  for (let i = 0; i < ids.length; i += 90) {
    const chunk = ids.slice(i, i + 90);
    const r = await env.DB.prepare(`SELECT id, sid, venue, en, ko, authors, inst, tag, ws, pos, psess, link, rv, emb FROM papers
      WHERE emb IN (${chunk.map(() => '?').join(',')}) AND ${where.join(' AND ')}`).bind(...chunk, ...bind).all();
    rows.push(...r.results);
  }
  rows.forEach(p => { p.score = scoreOf.get(p.emb); });
  rows.sort((a, b) => b.score - a.score);
  return rows.slice(0, limit);
}

// ---------------- tools ----------------
const POSTER_BASE = 'https://min-kang-3b.github.io/neurips2026-posters/p/';
const VENUE_PROP = { type: 'string', enum: ['sydney', 'atlanta', 'paris', 'all'], description: 'Venue filter. Default: sydney.' };
const TOOLS = [
  {
    name: 'search_papers',
    title: 'Search NeurIPS 2026 papers',
    description: 'Find NeurIPS 2026 papers. mode "keyword" matches title (English or Korean), authors, institutions and poster board; every word must match. mode "semantic" ranks main-track papers by meaning of an English description or abstract (workshop papers are keyword-only). Returns session time/room, poster board, average OpenReview rating (review_avg) and wishlist state. Use get_paper for the AI summaries of the reviews and the poster.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keywords, or a natural-language description for semantic mode' },
        mode: { type: 'string', enum: ['keyword', 'semantic'], description: 'Default keyword' },
        venue: VENUE_PROP,
        track: { type: 'string', enum: ['all', 'main', 'workshop'], description: 'Default all' },
        orals_spotlights_only: { type: 'boolean' },
        institution: { type: 'string', description: 'Substring of an institution name, e.g. KAIST' },
        min_review_avg: { type: 'number', description: 'Only papers whose average OpenReview rating (1-6 scale) is at least this' },
        sort: { type: 'string', enum: ['relevance', 'rating'], description: 'keyword mode: sort by relevance (default) or by average review rating' },
        limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Default 15' }
      },
      required: ['query']
    },
    annotations: { readOnlyHint: true, openWorldHint: false }
  },
  {
    name: 'get_paper',
    title: 'Get paper details',
    description: 'Full details of one paper by id: English abstract + Korean translation, OpenReview ratings/decision, a Korean AI summary of the reviews (one-line verdict, strengths, weaknesses, debate) and, when the poster is published, an AI summary of the poster (takeaway, method, key numbers, datasets, code) plus the poster image URL.',
    inputSchema: { type: 'object', properties: { paper_id: { type: 'string' } }, required: ['paper_id'] },
    annotations: { readOnlyHint: true, openWorldHint: false }
  },
  {
    name: 'get_schedule',
    title: 'Get the schedule for a day',
    description: 'Events (oral/poster sessions, invited talks, tutorials, workshops, socials...) at a venue. Without date, lists the conference days with event counts.',
    inputSchema: {
      type: 'object',
      properties: {
        venue: { type: 'string', enum: VENUES, description: 'Default sydney' },
        date: { type: 'string', description: 'YYYY-MM-DD, e.g. 2026-12-08' },
        type: { type: 'string', description: 'Optional substring of the event type, e.g. "oral", "poster", "workshop", "tutorial", "invited"' }
      }
    },
    annotations: { readOnlyHint: true, openWorldHint: false }
  },
  {
    name: 'search_events',
    title: 'Search events',
    description: 'Find sessions, talks, workshops, tutorials or socials by words in the title, speaker, organizers or room.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string' }, venue: VENUE_PROP, limit: { type: 'integer', minimum: 1, maximum: 50 } },
      required: ['query']
    },
    annotations: { readOnlyHint: true, openWorldHint: false }
  },
  // OpenAI connector-compatible pair
  {
    name: 'search',
    title: 'Search',
    description: 'Search NeurIPS 2026 papers and events. Returns ids usable with fetch.',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    annotations: { readOnlyHint: true, openWorldHint: false }
  },
  {
    name: 'fetch',
    title: 'Fetch',
    description: 'Fetch a paper ("paper:<id>") or event ("event:<id>") returned by search.',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    annotations: { readOnlyHint: true, openWorldHint: false }
  }
];
const WISH_TOOLS = [
  {
    name: 'get_wishlist',
    title: 'Get my wishlist',
    description: 'The user\'s wishlist (pinned events and papers) in time order, with time conflicts between pinned events flagged.',
    inputSchema: { type: 'object', properties: { venue: VENUE_PROP } },
    annotations: { readOnlyHint: true, openWorldHint: false }
  },
  {
    name: 'add_to_wishlist',
    title: 'Add to wishlist',
    description: 'Pin papers and/or events to the user\'s wishlist. It syncs to their schedule site.',
    inputSchema: {
      type: 'object',
      properties: {
        paper_ids: { type: 'array', items: { type: 'string' } },
        event_ids: { type: 'array', items: { type: 'string' } }
      }
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: 'remove_from_wishlist',
    title: 'Remove from wishlist',
    description: 'Unpin papers and/or events from the user\'s wishlist.',
    inputSchema: {
      type: 'object',
      properties: {
        paper_ids: { type: 'array', items: { type: 'string' } },
        event_ids: { type: 'array', items: { type: 'string' } }
      }
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }
  }
];

async function callTool(name, args, ctx) {
  const { env, code } = ctx;
  const wish = code ? await loadWish(env, code) : null;
  switch (name) {
    case 'search_papers': {
      const limit = clampInt(args.limit, 1, 50, 15);
      const rows = args.mode === 'semantic' ? await semanticSearch(env, args, limit) : await keywordSearch(env, args, limit);
      const evs = await eventsById(env, rows.map(r => r.sid));
      return { mode: args.mode === 'semantic' ? 'semantic' : 'keyword', count: rows.length, papers: rows.map(p => paperOut(p, evs[p.sid], env, wish)) };
    }
    case 'get_paper': {
      const p = await env.DB.prepare('SELECT * FROM papers WHERE id = ? ORDER BY ws LIMIT 1').bind(String(args.paper_id || '')).first();
      if (!p) throw new Error('paper not found: ' + args.paper_id);
      const evs = await eventsById(env, [p.sid]);
      return paperOut(p, evs[p.sid], env, wish, true);
    }
    case 'get_schedule': {
      const venue = VENUES.includes(args.venue) ? args.venue : 'sydney';
      if (!args.date) {
        const r = await env.DB.prepare('SELECT date, count(*) AS events FROM events WHERE venue = ? GROUP BY date ORDER BY date').bind(venue).all();
        return { venue, timezone: TZ[venue], days: r.results };
      }
      const r = await env.DB.prepare('SELECT * FROM events WHERE venue = ? AND date = ? ORDER BY start, en').bind(venue, String(args.date)).all();
      let evs = r.results;
      if (args.type) { const t = String(args.type).toLowerCase(); evs = evs.filter(e => (e.type + ' ' + (e.type_en || '')).toLowerCase().includes(t)); }
      return {
        venue, date: args.date, timezone: TZ[venue],
        events: evs.map(e => ({ ...sessionOf(e, env), speaker: e.speaker || undefined, organizers: e.organizers || undefined,
          papers: e.n_papers || undefined, wishlisted: wish ? !!wish.events[e.id] : undefined }))
      };
    }
    case 'search_events': {
      const toks = String(args.query || '').toLowerCase().split(/\s+/).filter(Boolean).slice(0, 8);
      if (!toks.length) throw new Error('query is required');
      const venues = venueList(args.venue);
      const where = [`venue IN (${venues.map(() => '?').join(',')})`], bind = [...venues];
      toks.forEach(t => {
        where.push("lower(coalesce(en,'') || ' ' || coalesce(ko,'') || ' ' || coalesce(speaker,'') || ' ' || coalesce(organizers,'') || ' ' || coalesce(room,'') || ' ' || coalesce(type_en,'')) LIKE ? ESCAPE '\\'");
        bind.push('%' + likeEsc(t) + '%');
      });
      const r = await env.DB.prepare(`SELECT * FROM events WHERE ${where.join(' AND ')} ORDER BY date, start LIMIT ?`).bind(...bind, clampInt(args.limit, 1, 50, 20)).all();
      return { count: r.results.length, events: r.results.map(e => ({ ...sessionOf(e, env), speaker: e.speaker || undefined, organizers: e.organizers || undefined, wishlisted: wish ? !!wish.events[e.id] : undefined })) };
    }
    case 'search': {
      const q = String(args.query || '');
      let rows = await keywordSearch(env, { query: q, venue: 'all' }, 10).catch(() => []);
      if (rows.length < 5 && env.AI) rows = rows.concat((await semanticSearch(env, { query: q, venue: 'all' }, 10).catch(() => [])).filter(r => !rows.some(x => x.id === r.id)));
      return { results: rows.slice(0, 10).map(p => ({ id: 'paper:' + p.id, title: p.en, url: p.link || env.SITE_URL })) };
    }
    case 'fetch': {
      const [kind, id] = String(args.id || '').split(':');
      if (kind === 'paper') {
        const p = await callTool('get_paper', { paper_id: id }, ctx);
        return { id: args.id, title: p.title, url: p.openreview || p.session?.url || env.SITE_URL,
          text: [p.title, p.title_ko, p.authors, p.institutions, p.abstract, p.session ? `Session: ${p.session.title}, ${p.session.date} ${p.session.start}-${p.session.end} ${p.session.timezone}, ${p.session.room}` : '', p.poster_board ? 'Poster board ' + p.poster_board : ''].filter(Boolean).join('\n\n'),
          metadata: { venue: p.venue, tag: p.tag } };
      }
      if (kind === 'event') {
        const e = (await eventsById(env, [id]))[id];
        if (!e) throw new Error('event not found');
        const s = sessionOf(e, env);
        return { id: args.id, title: e.en, url: s.url, text: `${e.en}\n${e.ko || ''}\n${e.type_en}, ${e.date} ${e.start}-${e.end_t} ${s.timezone}, ${e.room || ''}\n${e.speaker || e.organizers || ''}`, metadata: { venue: e.venue } };
      }
      throw new Error('id must look like paper:<id> or event:<id>');
    }
    case 'get_wishlist': {
      if (!wish) throw new Error('no wishlist: connect with the URL that includes your sync code');
      const venues = args.venue ? venueList(args.venue) : VENUES;
      const papers = await papersById(env, Object.keys(wish.papers));
      const sids = Object.keys(wish.events).concat(Object.keys(wish.papers).map(pid => wish.papers[pid].s || (papers[pid] || {}).sid));
      const evs = await eventsById(env, sids);
      const items = {};
      Object.keys(wish.events).forEach(id => { if (evs[id]) items[id] = { event: evs[id], pinned: true, papers: [] }; });
      Object.keys(wish.papers).forEach(pid => {
        const sid = wish.papers[pid].s || (papers[pid] || {}).sid;
        if (!evs[sid]) return;
        items[sid] = items[sid] || { event: evs[sid], pinned: false, papers: [] };
        const p = papers[pid] || { id: pid, en: wish.papers[pid].en, ko: wish.papers[pid].ko, pos: wish.papers[pid].pos };
        items[sid].papers.push({ id: pid, title: p.en, title_ko: p.ko, tag: p.tag || null, poster_board: p.pos || null });
      });
      const list = Object.values(items).filter(it => venues.includes(it.event.venue))
        .sort((a, b) => (a.event.date + a.event.start).localeCompare(b.event.date + b.event.start));
      const conflicts = [];
      const pinned = list.filter(it => it.pinned || it.papers.length);
      for (let i = 0; i < pinned.length; i++) for (let j = i + 1; j < pinned.length; j++) {
        const a = pinned[i].event, b = pinned[j].event;
        if (a.venue === b.venue && a.date === b.date && a.start && b.start && a.start < (b.end_t || b.start) && b.start < (a.end_t || a.start)) conflicts.push([a.id, b.id]);
      }
      return {
        count: list.length, updated: wish.updated ? new Date(wish.updated).toISOString() : null,
        items: list.map(it => ({ ...sessionOf(it.event, env), pinned_event: it.pinned, papers: it.papers })),
        conflicts: conflicts.map(([a, b]) => ({ a, b }))
      };
    }
    case 'add_to_wishlist':
    case 'remove_from_wishlist': {
      if (!wish) throw new Error('no wishlist: connect with the URL that includes your sync code');
      const add = name === 'add_to_wishlist';
      const pids = (args.paper_ids || []).map(String).slice(0, 200), eids = (args.event_ids || []).map(String).slice(0, 200);
      if (!pids.length && !eids.length) throw new Error('give paper_ids and/or event_ids');
      const done = { papers: [], events: [], not_found: [] };
      if (add) {
        const [papers, evs] = await Promise.all([papersById(env, pids), eventsById(env, eids)]);
        pids.forEach(id => {
          const p = papers[id];
          if (!p) { done.not_found.push(id); return; }
          wish.papers[id] = { s: p.sid, en: p.en, ko: p.ko, pos: p.pos || undefined };
          done.papers.push({ id, title: p.en });
        });
        eids.forEach(id => {
          const e = evs[id];
          if (!e) { done.not_found.push(id); return; }
          wish.events[id] = 1;
          done.events.push({ id, title: e.en, date: e.date, start: e.start });
        });
      } else {
        pids.forEach(id => { if (wish.papers[id]) { delete wish.papers[id]; done.papers.push({ id }); } else done.not_found.push(id); });
        eids.forEach(id => { if (wish.events[id]) { delete wish.events[id]; done.events.push({ id }); } else done.not_found.push(id); });
      }
      await saveWish(env, code, wish);
      return { [add ? 'added' : 'removed']: { papers: done.papers, events: done.events }, not_found: done.not_found,
        total: Object.keys(wish.events).length + Object.keys(wish.papers).length };
    }
  }
  throw new Error('unknown tool: ' + name);
}

// ---------------- JSON-RPC ----------------
async function rpc(msg, ctx) {
  const isNote = msg.id === undefined || msg.id === null;
  const reply = result => ({ jsonrpc: '2.0', id: msg.id, result });
  const fail = (code, message) => ({ jsonrpc: '2.0', id: msg.id ?? null, error: { code, message } });
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return isNote ? null : fail(-32600, 'invalid request');
  if (isNote) return null;
  const p = msg.params || {};
  switch (msg.method) {
    case 'initialize':
      return reply({
        protocolVersion: PROTOCOLS.includes(p.protocolVersion) ? p.protocolVersion : PROTOCOLS[1],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER,
        instructions: INSTRUCTIONS + (ctx.code ? '' : '\nThis connection has no sync code, so wishlist tools are unavailable.')
      });
    case 'ping':
      return reply({});
    case 'tools/list':
      return reply({ tools: ctx.code ? TOOLS.concat(WISH_TOOLS) : TOOLS });
    case 'tools/call': {
      const known = (ctx.code ? TOOLS.concat(WISH_TOOLS) : TOOLS).some(t => t.name === p.name);
      if (!known) return fail(-32602, 'unknown tool: ' + p.name);
      try {
        const out = await callTool(p.name, p.arguments || {}, ctx);
        return reply({ content: [{ type: 'text', text: JSON.stringify(out) }], structuredContent: out });
      } catch (e) {
        return reply({ content: [{ type: 'text', text: 'Error: ' + e.message }], isError: true });
      }
    }
    case 'resources/list':
      return reply({ resources: [] });
    case 'prompts/list':
      return reply({ prompts: [] });
    default:
      return fail(-32601, 'method not found: ' + msg.method);
  }
}

async function handleMcp(req, env, code) {
  const h = cors(req, env);
  if (req.method === 'GET' || req.method === 'DELETE') return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST', ...h } });
  if (req.method !== 'POST') return new Response(null, { status: 405, headers: h });
  let body;
  try { body = await req.json(); } catch (e) { return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }, 400, h); }
  const ctx = { env, code };
  if (Array.isArray(body)) {
    const out = (await Promise.all(body.map(m => rpc(m, ctx)))).filter(Boolean);
    return out.length ? json(out, 200, h) : new Response(null, { status: 202, headers: h });
  }
  const out = await rpc(body, ctx);
  return out ? json(out, 200, h) : new Response(null, { status: 202, headers: h });
}

async function handleWishApi(req, env, code) {
  const h = cors(req, env);
  if (req.method === 'GET') {
    const w = await loadWish(env, code);
    return json(w, 200, { ...h, 'Cache-Control': 'no-store' });
  }
  if (req.method === 'PUT') {
    const text = await req.text();
    if (text.length > 400000) return json({ error: 'too large' }, 413, h);
    let d;
    try { d = JSON.parse(text); } catch (e) { return json({ error: 'bad json' }, 400, h); }
    if (!validWishDoc(d)) return json({ error: 'bad wishlist' }, 400, h);
    const updated = await saveWish(env, code, d);
    return json({ ok: true, updated }, 200, h);
  }
  return new Response(null, { status: 405, headers: h });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req, env) });
    const m = url.pathname.match(/^\/(mcp|api\/wish)(?:\/([^/]+))?\/?$/);
    if (m) {
      const code = m[2] ? m[2].toLowerCase() : null;
      if (code && !CODE_RE.test(code)) return json({ error: 'invalid sync code' }, 404, cors(req, env));
      if (m[1] === 'mcp') return handleMcp(req, env, code);
      if (!code) return json({ error: 'sync code required' }, 404, cors(req, env));
      return handleWishApi(req, env, code);
    }
    if (url.pathname === '/') {
      return new Response(`NeurIPS 2026 schedule MCP server.\nMCP endpoint: ${url.origin}/mcp/<sync code> (Streamable HTTP)\nSite: ${env.SITE_URL}\n`, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    return new Response('Not found', { status: 404 });
  }
};
