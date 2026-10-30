/* NeurIPS 2026 bilingual schedule app (vanilla JS, works over file://) */
(function () {
  'use strict';

  var SCHED = window.NIPS_SCHEDULE;
  var DETAILS = window.NIPS_DETAILS || {};
  window.NIPS_PAPERS = window.NIPS_PAPERS || {};

  // ---------------- i18n ----------------
  var I18N = {
    ko: {
      search_ph: '일정·논문 검색 (제목, 저자, 세션…)',
      all: '전체', oral: '오럴', poster: '포스터', invited: '초청·특별', tutorial: '튜토리얼', workshop: '워크숍·대회',
      expo: '엑스포', social: '소셜·어피니티', ops: '운영·휴식',
      papers_n: '편의 발표', ends: '종료', room: '장소', time: '시간', speaker: '연사',
      organizers: '주최', abstract: '소개', speakers: '연사 소개', links: '링크',
      talks: '발표 목록', posters: '포스터 목록', accepted: '수록 논문', filter_papers: '이 세션에서 논문 검색…',
      shown: '표시', of: '/', results_events: '일정', results_papers: '논문',
      no_results: '검색 결과가 없습니다', no_events: '해당하는 일정이 없습니다',
      load_all: '전체 논문({n}편)에서도 검색하기 — 최초 1회 로딩',
      loading: '불러오는 중…', show_original: '영어 원문 보기', hide_original: '원문 닫기',
      orig_label: '원문(EN)', in_session: '세션', view_original_title: '원제',
      install_app: '앱 설치', offline_save: '⬇ 오프라인 저장 (전체 데이터)', offline_saving: '저장 중… ',
      offline_done: '오프라인 저장 완료 ✓', offline_desc: '설치 후 저장하면 인터넷 없이도 전체 일정·논문을 볼 수 있습니다.',
      wish: '위시', route: '동선', wish_empty: '카드나 논문을 길게 누르면 위시리스트에 추가됩니다',
      wish_hint: '길게 눌러 위시리스트에 추가/제거', pinned_papers: '핀한 논문', floor: '층',
      program: '프로그램', invited_speakers: '초청 연사', schedule_note: '워크숍 자체 사이트 기준 · 변경될 수 있음',
      program_time: '시간', program_session: '세션', program_speaker: '발표자',
      footer: '데이터 출처: neurips.cc (2026 가상 사이트) · 모든 시간은 각 개최지 현지 시각 기준 · 비공식 사이트입니다.',
      search_hint_papers: '논문 제목도 함께 검색됩니다',
      local_time: '현지 시각', oral_pending: 'NeurIPS가 아직 오럴 세션별 논문 배정을 공개하지 않았습니다. 이 개최지의 오럴 논문 전체를 표시합니다.',
      poster_at: '포스터', all_locs: '전체 개최지',
      view_schedule: '📅 일정', view_search: '🔍 논문 검색',
      s_title: '논문 검색', s_desc: '세 개최지의 본회의·워크숍 논문 {n}편을 제목·저자·기관으로, 또는 의미로 찾습니다.',
      s_ph: '주제, 제목, 저자, 기관을 입력하거나 초록을 붙여넣으세요', s_go: '검색',
      s_mode_kw: '키워드', s_mode_sem: '🧠 의미 검색',
      s_sem_note: '의미 검색은 영어 문장에서 가장 정확합니다. 모델(약 33MB)은 최초 1회만 내려받고, 입력한 내용은 어디에도 전송되지 않습니다.',
      s_ko_note: '한글 질의는 키워드 검색(번역 제목 포함)이 더 정확합니다.',
      s_loading_model: '검색 모델 불러오는 중…', s_loading_index: '검색 색인 불러오는 중…',
      s_all: '전체', s_main: '본회의', s_ws: '워크숍', s_tag_only: '🎓 오럴·스포트라이트만',
      s_results: '{n}건', s_top_inst: '이 결과에 가장 많은 기관', s_more: '더 보기', s_examples: '예시',
      s_match: '유사도', s_results_sem: '의미가 가장 가까운 {n}편', s_none: '결과가 없습니다', s_clear_inst: '기관 필터 해제', s_sem_fail: '의미 검색 모델을 불러오지 못해 키워드 검색으로 전환했습니다.',
      tz_local: '현지', now_btn: '⏱ 지금 시각으로', tag_all: '전체'
    },
    en: {
      search_ph: 'Search events & papers (title, author, session…)',
      all: 'All', oral: 'Orals', poster: 'Posters', invited: 'Invited', tutorial: 'Tutorials', workshop: 'Workshops · Comps',
      expo: 'Expo', social: 'Social · Affinity', ops: 'Logistics',
      papers_n: ' papers', ends: 'ends', room: 'Room', time: 'Time', speaker: 'Speaker',
      organizers: 'Organizers', abstract: 'Abstract', speakers: 'Speakers', links: 'Links',
      talks: 'Talks', posters: 'Posters', accepted: 'Accepted Papers', filter_papers: 'Filter papers in this session…',
      shown: 'shown', of: ' of ', results_events: 'Events', results_papers: 'Papers',
      no_results: 'No results found', no_events: 'No matching events',
      load_all: 'Also search all {n} papers — one-time load',
      loading: 'Loading…', show_original: 'Show English original', hide_original: 'Hide original',
      orig_label: 'Original (EN)', in_session: 'Session', view_original_title: 'Original title',
      install_app: 'Install app', offline_save: '⬇ Save for offline (all data)', offline_saving: 'Saving… ',
      offline_done: 'Saved for offline ✓', offline_desc: 'Install and save to browse the full schedule and papers without internet.',
      wish: 'Wishlist', route: 'Route', wish_empty: 'Long-press any card or paper to add it to your wishlist',
      wish_hint: 'Long-press to add/remove from wishlist', pinned_papers: 'Pinned papers', floor: 'floor',
      program: 'Program', invited_speakers: 'Invited Speakers', schedule_note: 'From the workshop’s own site · subject to change',
      program_time: 'Time', program_session: 'Session', program_speaker: 'Speaker',
      footer: 'Data source: neurips.cc (2026 virtual site) · All times are local to each venue · Unofficial site.',
      search_hint_papers: 'Paper titles are searched too',
      local_time: 'local time', oral_pending: 'NeurIPS has not yet published which orals go in which oral session. Showing every oral at this venue.',
      poster_at: 'Poster', all_locs: 'All venues',
      view_schedule: '📅 Schedule', view_search: '🔍 Paper search',
      s_title: 'Paper search', s_desc: 'Find any of the {n} main-track and workshop papers across all three venues by title, author, institution — or by meaning.',
      s_ph: 'Type a topic, title, author or institution — or paste an abstract', s_go: 'Search',
      s_mode_kw: 'Keyword', s_mode_sem: '🧠 Semantic',
      s_sem_note: 'Semantic search works best with English text. The model (~33 MB) downloads once; nothing you type leaves your browser.',
      s_ko_note: 'For Korean queries, keyword search (includes translated titles) is more accurate.',
      s_loading_model: 'Loading search model…', s_loading_index: 'Loading search index…',
      s_all: 'All', s_main: 'Main track', s_ws: 'Workshops', s_tag_only: '🎓 Orals & spotlights only',
      s_results: '{n} results', s_top_inst: 'Most frequent institutions in these results', s_more: 'Show more', s_examples: 'Try',
      s_match: 'match', s_results_sem: '{n} closest papers by meaning', s_none: 'No results', s_clear_inst: 'Clear institution filter', s_sem_fail: 'Could not load the semantic model — switched to keyword search.',
      tz_local: 'Local', now_btn: '⏱ Jump to now', tag_all: 'All'
    }
  };

  var TYPE_GROUP = {
    'oral-session': 'oral', 'poster-session': 'poster', 'creative-ai': 'poster',
    'invited-talk': 'invited', 'test-of-time': 'invited', 'town-hall': 'invited', 'remarks': 'invited', 'award': 'invited',
    'tutorial': 'tutorial',
    'workshop': 'workshop', 'competition': 'workshop', 'reproducibility-track': 'workshop',
    'expo-talk-panel': 'expo', 'expo-demonstration': 'expo', 'expo-workshop': 'expo',
    'social': 'social', 'reception': 'social', 'affinity-event': 'social', 'talk': 'social',
    'break': 'ops', 'registration-desk': 'ops'
  };
  var GROUP_COLOR = {
    oral: 'var(--c-oral)', poster: 'var(--c-poster)', invited: 'var(--c-invited)', tutorial: 'var(--c-tutorial)',
    workshop: 'var(--c-workshop)', expo: 'var(--c-expo)', social: 'var(--c-social)', ops: 'var(--c-ops)'
  };
  var CHIP_ORDER = ['all', 'wish', 'oral', 'poster', 'invited', 'tutorial', 'workshop', 'expo', 'social', 'ops'];
  var LOCS = {};
  (SCHED.locs || []).forEach(function (l) { LOCS[l.id] = l; });
  function locDays(locId) { return SCHED.days.filter(function (d) { return d.loc === locId; }); }
  function papersRef(e) { return e.papersRef || e.id; }

  // ---------------- wishlist store ----------------
  var wish = { events: {}, papers: {} };
  try { wish = JSON.parse(localStorage.getItem('nips_wish')) || wish; } catch (e) { /* fresh */ }
  wish.events = wish.events || {};
  wish.papers = wish.papers || {};
  function saveWish() { localStorage.setItem('nips_wish', JSON.stringify(wish)); }
  function wishCount() { return Object.keys(wish.events).length + Object.keys(wish.papers).length; }
  function toggleEventPin(e) {
    if (wish.events[e.id]) delete wish.events[e.id];
    else wish.events[e.id] = 1;
    saveWish();
  }
  function togglePaperPin(p, sid) {
    if (wish.papers[p.id]) delete wish.papers[p.id];
    else wish.papers[p.id] = { s: sid || null, en: p.en, ko: p.ko, pos: p.pos, time: p.time };
    saveWish();
  }

  // long-press to pin (mouse hold works too); suppresses the following click
  function longPress(el, fn) {
    var timer = null, fired = false;
    function start(ev) {
      if (ev.type === 'mousedown' && ev.button !== 0) return;
      fired = false;
      el.classList.add('pressing');
      timer = setTimeout(function () {
        fired = true;
        el._lpFired = true;
        el.classList.remove('pressing');
        fn();
      }, 480);
    }
    function cancel() { clearTimeout(timer); timer = null; el.classList.remove('pressing'); }
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('mousedown', start);
    ['touchend', 'touchmove', 'touchcancel', 'mouseup', 'mouseleave'].forEach(function (t) {
      el.addEventListener(t, cancel);
    });
    el.addEventListener('contextmenu', function (ev) { if (fired || timer) ev.preventDefault(); });
  }

  // room -> COEX floor (from media.icml.cc/Conferences/ICML2026/coex_map.svg)
  function floorOf(room) {
    return null;
    /* eslint-disable no-unreachable */
    var r = room.toLowerCase();
    if (r.indexOf('hall c') >= 0) return '4F';
    if (r.indexOf('hall d') >= 0 || r.indexOf('auditorium') >= 0 || r.indexOf('hall e') >= 0) return '3F';
    if (r.indexOf('asem') >= 0) return '2F';
    if (r.indexOf('hall a') >= 0 || r.indexOf('hall b') >= 0 || r.indexOf('grand ballroom') >= 0) return '1F';
    var m = r.match(/room\s*e\d/) || (r.indexOf('room e') >= 0 ? ['e'] : null);
    if (m) return '3F';
    var n = r.match(/room\s*(\d)\d{2}/);
    if (n) return n[1] + 'F';
    return null;
  }
  function roomWithFloor(room) {
    var f = floorOf(room);
    return room ? room + (f ? ' · ' + f : '') : '';
  }

  // event id -> {ev, day} index
  var EV_INDEX = {};
  SCHED.days.forEach(function (d) {
    d.events.forEach(function (e) { EV_INDEX[e.id] = { ev: e, day: d }; });
  });

  // ---------------- state ----------------
  var params = new URLSearchParams(location.search);
  var state = {
    lang: params.get('lang') || localStorage.getItem('nips_lang') || 'en',
    loc: params.get('loc') || localStorage.getItem('nips_loc') || 'sydney',
    day: null,
    view: params.get('view') === 'search' ? 'search' : (localStorage.getItem('nips_view') === 'search' && !params.get('day') && !params.get('open') ? 'search' : 'schedule'),
    tz: params.get('tz') || localStorage.getItem('nips_tz') || 'local',
    chip: 'all',
    q: '',
    allPapersLoaded: false
  };
  if (['ko', 'en'].indexOf(state.lang) < 0) state.lang = 'ko';
  if (!LOCS[state.loc]) state.loc = 'sydney';
  state.day = params.get('day') || localStorage.getItem('nips_day_' + state.loc) || '';
  if (!SCHED.days.some(function (d) { return d.day === state.day && d.loc === state.loc; })) state.day = defaultDay();
  if (params.get('q')) state.q = params.get('q');

  function defaultDay() {
    var days = locDays(state.loc);
    var iso = '';
    try {
      iso = new Intl.DateTimeFormat('en-CA', { timeZone: LOCS[state.loc].tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    } catch (e) { /* old browser */ }
    var hit = days.find(function (d) { return d.date === iso; });
    if (hit) return hit.day;
    // before the conference: first main-conference day; otherwise first day
    var main = days.find(function (d) { return d.note && /Main/.test(d.note.en); });
    return (main || days[0] || {}).day;
  }
  function tzAbbr(locId) { return state.tz === 'kst' ? 'KST' : ((LOCS[locId] || {}).abbr || ''); }
  // venue standard offsets during the conference (Dec 2026): AEDT +11, EST -5, CET +1; KST +9
  var UTC_OFF = { sydney: 11, atlanta: -5, paris: 1 };
  function fmtT(hhmm, locId) {
    if (!hhmm || state.tz !== 'kst') return hhmm || '';
    var p = hhmm.split(':'), mins = (+p[0]) * 60 + (+p[1]) + (9 - (UTC_OFF[locId] || 9)) * 60;
    var d = Math.floor(mins / 1440); mins = ((mins % 1440) + 1440) % 1440;
    var out = String(Math.floor(mins / 60)).padStart(2, '0') + ':' + String(mins % 60).padStart(2, '0');
    return out + (d > 0 ? ' (+' + d + ')' : d < 0 ? ' (' + d + ')' : '');
  }
  function fmtRange(e, locId, nextDayMark) {
    if (!e.start) return '';
    return fmtT(e.start, locId) + (e.end ? ' – ' + fmtT(e.end, locId) + (state.tz !== 'kst' && e.endNextDay ? nextDayMark : '') : '');
  }
  function nowInLoc(locId) {
    try {
      var parts = new Intl.DateTimeFormat('en-CA', { timeZone: LOCS[locId].tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
      var g = {}; parts.forEach(function (x) { g[x.type] = x.value; });
      return { date: g.year + '-' + g.month + '-' + g.day, hm: g.hour + ':' + g.minute };
    } catch (e) { return { date: '', hm: '' }; }
  }

  // KaTeX (vendored in assets/katex, loaded on first use)
  var katexReady = null;
  function ensureKatex() {
    if (katexReady) return katexReady;
    katexReady = new Promise(function (res) {
      var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'assets/katex/katex.min.css'; document.head.appendChild(l);
      var s1 = document.createElement('script'); s1.src = 'assets/katex/katex.min.js';
      s1.onload = function () {
        var s2 = document.createElement('script'); s2.src = 'assets/katex/auto-render.min.js';
        s2.onload = res; s2.onerror = res; document.head.appendChild(s2);
      };
      s1.onerror = res; document.head.appendChild(s1);
    });
    return katexReady;
  }
  function typeset(el) {
    if (!el || !/\$|\\\(|\\\[/.test(el.textContent)) return;
    ensureKatex().then(function () {
      if (!window.renderMathInElement) return;
      try {
        window.renderMathInElement(el, {
          delimiters: [
            { left: '$$', right: '$$', display: true }, { left: '\\[', right: '\\]', display: true },
            { left: '$', right: '$', display: false }, { left: '\\(', right: '\\)', display: false }
          ],
          throwOnError: false, strict: 'ignore'
        });
      } catch (e) { /* leave raw text */ }
    });
  }
  function setLoc(l) {
    state.loc = l; localStorage.setItem('nips_loc', l);
    state.day = localStorage.getItem('nips_day_' + l) || '';
    if (!locDays(l).some(function (d) { return d.day === state.day; })) state.day = defaultDay();
    state.q = ''; render(); window.scrollTo(0, 0);
  }
  function t(key) { return I18N[state.lang][key]; }
  function loc(obj) {
    if (!obj) return '';
    return (state.lang === 'ko' && obj.ko) ? obj.ko : (obj.en || obj.ko || '');
  }

  // ---------------- helpers ----------------
  function h(tag, attrs, children) {
    var el = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'class') el.className = attrs[k];
      else if (k === 'html') el.innerHTML = attrs[k];
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), attrs[k]);
      else if (k === 'style') el.style.cssText = attrs[k];
      else el.setAttribute(k, attrs[k]);
    }
    (children || []).forEach(function (c) {
      if (c == null) return;
      el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return el;
  }
  function fmtTime(s) { return s || ''; }
  function esc(s) { return (s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // dynamic paper file loader (script injection -> file:// safe)
  var loading = {};
  function loadPapers(sid) {
    return new Promise(function (resolve, reject) {
      if (window.NIPS_PAPERS[sid]) return resolve(window.NIPS_PAPERS[sid]);
      if (loading[sid]) { loading[sid].push(resolve); return; }
      loading[sid] = [resolve];
      var sc = document.createElement('script');
      sc.src = 'data/papers/s' + sid + '.js';
      sc.onload = function () {
        var cbs = loading[sid] || []; delete loading[sid];
        cbs.forEach(function (cb) { cb(window.NIPS_PAPERS[sid] || []); });
      };
      sc.onerror = function () { delete loading[sid]; resolve([]); };
      document.head.appendChild(sc);
    });
  }
  function sessionsWithPapers() {
    var out = [], seen = {};
    SCHED.days.forEach(function (d) {
      d.events.forEach(function (e) {
        var ref = papersRef(e);
        if (e.nPapers && !seen[ref]) { seen[ref] = 1; out.push({ day: d, ev: e }); }
      });
    });
    return out;
  }
  function totalPapers() {
    return sessionsWithPapers().reduce(function (a, it) { return a + (it.ev.nPapers || 0); }, 0).toLocaleString();
  }
  function loadAllPapers(progressCb) {
    var list = sessionsWithPapers();
    var done = 0;
    return Promise.all(list.map(function (it) {
      return loadPapers(papersRef(it.ev)).then(function () { done++; if (progressCb) progressCb(done, list.length); });
    })).then(function () { state.allPapersLoaded = true; });
  }

  // ---------------- root render ----------------
  var app = document.getElementById('app');

  function render() {
    document.documentElement.lang = state.lang;
    app.innerHTML = '';
    app.appendChild(renderTopbar());
    app.appendChild(renderViewNav());
    if (state.view === 'search') {
      var sm = h('main', { class: 'timeline search-view', id: 'timeline' });
      app.appendChild(sm);
      renderSearchView(sm);
      app.appendChild(renderFooter());
      return;
    }
    app.appendChild(renderLocTabs());
    app.appendChild(renderDayTabs());
    app.appendChild(renderToolbar());
    var main = h('main', { class: 'timeline', id: 'timeline' });
    app.appendChild(main);
    renderMain();
    app.appendChild(renderFooter());
  }

  function renderTopbar() {
    var themeBtn = h('button', {
      class: 'icon-btn', title: 'Theme',
      onclick: function () {
        var cur = document.documentElement.getAttribute('data-theme');
        var next = cur === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('nips_theme', next);
        themeBtn.textContent = next === 'dark' ? '☀' : '☾';
      }
    }, [document.documentElement.getAttribute('data-theme') === 'dark' ? '☀' : '☾']);

    return h('header', { class: 'topbar' }, [
      h('div', { class: 'topbar-inner' }, [
        h('div', { class: 'brand' }, [
          h('h1', null, ['NeurIPS 2026']),
          h('span', { class: 'venue' }, [loc(LOCS[state.loc].name) + ' · ' + loc(LOCS[state.loc].range) + ' · ' + tzAbbr(state.loc)])
        ]),
        h('div', { class: 'controls' }, [
          h('button', {
            id: 'btn-install', class: 'install-btn', title: t('install_app'),
            style: installEvt ? '' : 'display:none',
            onclick: function () {
              if (!installEvt) return;
              installEvt.prompt();
              installEvt.userChoice.then(function () { installEvt = null; render(); });
            }
          }, ['📲 ' + t('install_app')]),
          h('div', { class: 'seg seg-tz', title: 'Time zone' }, [
            h('button', { class: state.tz !== 'kst' ? 'on' : '', onclick: function () { setTz('local'); } }, [t('tz_local')]),
            h('button', { class: state.tz === 'kst' ? 'on' : '', onclick: function () { setTz('kst'); } }, ['KST'])
          ]),
          h('div', { class: 'seg' }, [
            h('button', { class: state.lang === 'ko' ? 'on' : '', onclick: function () { setLang('ko'); } }, ['한국어']),
            h('button', { class: state.lang === 'en' ? 'on' : '', onclick: function () { setLang('en'); } }, ['EN'])
          ]),
          themeBtn
        ])
      ])
    ]);
  }
  function setLang(l) { state.lang = l; localStorage.setItem('nips_lang', l); render(); }
  function setTz(z) { state.tz = z; localStorage.setItem('nips_tz', z); render(); }
  function setView(v) {
    state.view = v; localStorage.setItem('nips_view', v);
    render(); window.scrollTo(0, 0);
  }
  function renderViewNav() {
    return h('div', { class: 'viewnav-wrap' }, [h('nav', { class: 'viewnav' }, [
      h('button', { class: state.view === 'schedule' ? 'on' : '', onclick: function () { if (state.view !== 'schedule') setView('schedule'); } }, [t('view_schedule')]),
      h('button', { class: state.view === 'search' ? 'on' : '', onclick: function () { if (state.view !== 'search') setView('search'); } }, [t('view_search')])
    ])]);
  }

  function renderLocTabs() {
    return h('div', { class: 'loctabs-wrap' }, [
      h('nav', { class: 'loctabs' }, (SCHED.locs || []).map(function (l) {
        return h('button', {
          class: 'loctab' + (state.loc === l.id ? ' on' : ''),
          onclick: function () { if (state.loc !== l.id) setLoc(l.id); }
        }, [h('b', null, [loc(l.name)]), h('span', null, [loc(l.role) + ' · ' + loc(l.range)])]);
      }))
    ]);
  }

  function renderDayTabs() {
    return h('div', { class: 'daytabs-wrap' }, [
      h('nav', { class: 'daytabs' }, locDays(state.loc).map(function (d) {
        return h('button', {
          class: 'daytab' + (state.day === d.day ? ' on' : ''),
          onclick: function () {
            state.day = d.day; localStorage.setItem('nips_day_' + state.loc, String(d.day));
            state.q = ''; render(); window.scrollTo(0, 0);
          }
        }, [h('span', { class: 'dow' }, [loc(d.label)])]);
      }))
    ]);
  }

  function renderToolbar() {
    var input = h('input', {
      type: 'search', placeholder: t('search_ph'), value: state.q,
      oninput: debounce(function (ev) { state.q = ev.target.value.trim(); renderMain(); }, 220)
    });
    var chips = h('div', { class: 'chips' }, CHIP_ORDER.map(function (c) {
      if (c === 'wish') {
        var n = wishCount();
        return h('button', {
          class: 'chip chip-wish' + (state.chip === c ? ' on' : ''),
          onclick: function () { state.chip = c; render(); }
        }, ['⭐ ' + t('wish') + (n ? ' ' + n : '')]);
      }
      var dot = c === 'all' ? null : h('span', { class: 'dot', style: 'background:' + GROUP_COLOR[c] });
      return h('button', {
        class: 'chip' + (state.chip === c ? ' on' : ''),
        onclick: function () { state.chip = c; render(); }
      }, [dot, t(c)]);
    }));
    return h('div', { class: 'toolbar' }, [
      h('div', { class: 'searchbox' }, [h('span', { class: 'mag' }, ['⌕']), input]),
      chips
    ]);
  }

  function debounce(fn, ms) {
    var to; return function () { var a = arguments, self = this; clearTimeout(to); to = setTimeout(function () { fn.apply(self, a); }, ms); };
  }

  // ---------------- main (timeline or search) ----------------
  function renderMain() {
    var main = document.getElementById('timeline');
    main.innerHTML = '';
    if (state.q.length >= 2) renderSearch(main);
    else renderTimeline(main);
  }

  function eventMatchesChip(e) {
    if (state.chip === 'all') return true;
    if (state.chip === 'wish') return !!wish.events[e.id];
    return TYPE_GROUP[e.type] === state.chip;
  }

  function renderTimeline(main) {
    var day = SCHED.days.find(function (d) { return d.day === state.day; });
    if (!day) return;
    if (state.chip === 'wish') return renderWishDay(main, day);
    var note = loc(day.note);
    var now = nowInLoc(day.loc);
    var isToday = now.date === day.date;
    main.appendChild(h('div', { class: 'date-heading' }, [
      loc(day.dateFull) + (note ? ' — ' + note : '') + ' · ' + tzAbbr(day.loc),
      isToday ? h('button', { class: 'now-btn', onclick: function () {
        var target = null;
        main.querySelectorAll('.tgroup').forEach(function (g) { if (g.dataset.start <= now.hm) target = g; });
        (target || main.querySelector('.tgroup')).scrollIntoView({ behavior: 'smooth', block: 'start' });
      } }, [t('now_btn')]) : null
    ]));

    var evs = day.events.filter(eventMatchesChip);
    if (!evs.length) { main.appendChild(h('div', { class: 'empty' }, [t('no_events')])); return; }

    // group by start time
    var groups = {};
    evs.forEach(function (e) {
      var k = e.start || '——';
      (groups[k] = groups[k] || []).push(e);
    });
    Object.keys(groups).sort().forEach(function (k) {
      var lbl = h('div', { class: 'tlabel' }, [fmtT(k, day.loc)]);
      var cards = h('div', { class: 'tcards' }, groups[k].map(function (e) { return renderCard(e, day); }));
      var past = isToday && groups[k].every(function (e) { return e.end && !e.endNextDay && e.end < now.hm; });
      main.appendChild(h('section', { class: 'tgroup' + (past ? ' past' : ''), 'data-start': k }, [lbl, cards]));
    });
  }

  function renderCard(e, day, ctxLabel) {
    var g = TYPE_GROUP[e.type] || 'ops';
    var color = GROUP_COLOR[g];
    var compact = (g === 'ops');
    var times = fmtRange(e, day.loc, ' +1');
    var pinned = !!wish.events[e.id];
    var card;
    function onOpen() {
      if (card._lpFired) { card._lpFired = false; return; }
      openEvent(e, day);
    }
    if (compact) {
      card = h('button', {
        class: 'card compact' + (pinned ? ' pinned' : ''), style: '--tc:' + color,
        title: t('wish_hint'), onclick: onOpen
      }, [
        h('h3', null, [loc(e.title)]),
        h('span', { class: 'times' }, [times])
      ]);
    } else {
      var subs = [];
      if (e.speaker) subs.push(e.speaker);
      else if (e.organizers) subs.push(e.organizers);
      card = h('button', {
        class: 'card' + (pinned ? ' pinned' : ''), style: '--tc:' + color,
        title: t('wish_hint'), onclick: onOpen
      }, [
        h('div', { class: 'rowtop' }, [
          h('span', { class: 'badge' }, [loc(e.typeName)]),
          h('span', { class: 'times' }, [times]),
          e.room ? h('span', { class: 'room' }, ['· ' + roomWithFloor(e.room)]) : null
        ]),
        h('h3', null, [loc(e.title)]),
        subs.length ? h('div', { class: 'sub' }, [subs.join(' · ')]) : null,
        (e.posterLoc && e.posterLoc.length) ? h('div', { class: 'posterloc' }, [
          '📍 ' + (state.lang === 'ko' ? '포스터: ' : 'Posters: ') + e.posterLoc.join(' / ')
        ]) : null,
        e.nPapers ? h('div', { class: 'npapers' }, [
          state.lang === 'ko' ? '발표 ' + e.nPapers + '편' : e.nPapers + ' papers'
        ]) : null,
        ctxLabel ? h('div', { class: 'ctx' }, [ctxLabel]) : null
      ]);
    }
    longPress(card, function () {
      toggleEventPin(e);
      card.classList.toggle('pinned', !!wish.events[e.id]);
      var chip = document.querySelector('.chip-wish');
      if (chip) {
        var n = wishCount();
        chip.textContent = '⭐ ' + t('wish') + (n ? ' ' + n : '');
      }
      if (state.chip === 'wish') renderMain();
    });
    return card;
  }

  // ---------------- wishlist day view ----------------
  function renderWishDay(main, day) {
    main.appendChild(h('div', { class: 'date-heading' }, [loc(day.dateFull) + ' — ⭐ ' + t('wish')]));

    // pinned events on this day
    var items = [];   // {start, ev, papers:[...]}
    day.events.forEach(function (e) {
      if (wish.events[e.id]) items.push({ ev: e, papers: [] });
    });
    // pinned papers whose session is on this day
    Object.keys(wish.papers).forEach(function (pid) {
      var w = wish.papers[pid];
      var hit = w.s && EV_INDEX[w.s];
      if (!hit || hit.day.day !== day.day) return;
      var found = items.find(function (it) { return it.ev.id === hit.ev.id; });
      if (!found) { found = { ev: hit.ev, papers: [] }; items.push(found); }
      found.papers.push(Object.assign({ id: pid }, w));
    });
    if (!items.length) {
      main.appendChild(h('div', { class: 'empty' }, [t('wish_empty')]));
      return;
    }
    items.sort(function (a, b) { return (a.ev.start || '').localeCompare(b.ev.start || ''); });

    // route strip: time + room(floor) hops
    var hops = [];
    items.forEach(function (it) {
      if (!it.ev.start) return;
      var label = it.ev.start + ' ' + (it.ev.room ? roomWithFloor(it.ev.room) : loc(it.ev.title).slice(0, 14));
      if (!hops.length || hops[hops.length - 1] !== label) hops.push(label);
    });
    if (hops.length > 1 || (hops.length === 1 && items.length)) {
      main.appendChild(h('div', { class: 'route-strip' }, [
        h('span', { class: 'route-label' }, [t('route')]),
        h('span', { class: 'route-hops' }, [hops.join('  →  ')])
      ]));
    }

    // grouped timeline
    var groups = {};
    items.forEach(function (it) {
      var k = it.ev.start || '——';
      (groups[k] = groups[k] || []).push(it);
    });
    Object.keys(groups).sort().forEach(function (k) {
      var cards = h('div', { class: 'tcards' }, []);
      groups[k].forEach(function (it) {
        cards.appendChild(renderCard(it.ev, day));
        if (it.papers.length) {
          it.papers.sort(function (a, b) { return (a.time || a.pos || '').localeCompare(b.time || b.pos || ''); });
          var box = h('div', { class: 'wish-papers' }, [
            h('div', { class: 'pcount' }, [t('pinned_papers') + ' · ' + it.papers.length])
          ]);
          cards.appendChild(box);
          loadPapers(papersRef(it.ev)).then(function (full) {
            var map = {};
            (full || []).forEach(function (fp) { map[fp.id] = fp; });
            box.appendChild(h('div', null, it.papers.map(function (w) {
              return renderPaperItem(map[w.id] || w, { sid: it.ev.id });
            })));
          });
        }
      });
      main.appendChild(h('section', { class: 'tgroup' }, [
        h('div', { class: 'tlabel' }, [fmtT(k, day.loc)]), cards
      ]));
    });
  }

  // ---------------- search ----------------
  function renderSearch(main) {
    var q = state.q.toLowerCase();
    var evHits = [];
    SCHED.days.forEach(function (d) {
      d.events.forEach(function (e) {
        if (!eventMatchesChip(e)) return;
        var hay = [e.title.en, e.title.ko, e.speaker, e.organizers, e.room].join(' ').toLowerCase();
        if (hay.indexOf(q) >= 0) evHits.push({ d: d, e: e });
      });
    });

    main.appendChild(h('div', { class: 'results-note' }, [
      '“' + state.q + '” — ' + t('results_events') + ' ' + evHits.length
    ]));

    if (evHits.length) {
      main.appendChild(h('div', { class: 'rsection' }, [t('results_events')]));
      var wrap = h('div', { class: 'tcards' });
      evHits.slice(0, 50).forEach(function (hit) {
        wrap.appendChild(renderCard(hit.e, hit.d, loc(LOCS[hit.d.loc].name) + ' · ' + loc(hit.d.label)));
      });
      main.appendChild(wrap);
    }

    // paper search
    var psec = h('div');
    main.appendChild(psec);
    if (!state.allPapersLoaded) {
      var btn = h('button', {
        class: 'load-all',
        onclick: function () {
          btn.disabled = true;
          btn.textContent = t('loading');
          loadAllPapers(function (done, total) { btn.textContent = t('loading') + ' ' + done + '/' + total; })
            .then(function () { renderMain(); });
        }
      }, [t('load_all').replace('{n}', totalPapers())]);
      psec.appendChild(btn);
    } else {
      var hits = [];
      sessionsWithPapers().forEach(function (it) {
        (window.NIPS_PAPERS[papersRef(it.ev)] || []).forEach(function (p) {
          var hay = ((p.en || '') + ' ' + (p.ko || '') + ' ' + (p.authors || '')).toLowerCase();
          if (hay.indexOf(q) >= 0) hits.push({ d: it.day, e: it.ev, p: p });
        });
      });
      psec.appendChild(h('div', { class: 'rsection' }, [t('results_papers') + ' · ' + hits.length]));
      var pw = h('div');
      hits.slice(0, 100).forEach(function (hit) {
        pw.appendChild(renderPaperItem(hit.p, {
          sid: hit.e.id,
          ctx: loc(LOCS[hit.d.loc].name) + ' · ' + loc(hit.d.label) + ' · ' + loc(hit.e.title) + (hit.e.room ? ' · ' + roomWithFloor(hit.e.room) : '')
        }));
      });
      if (hits.length > 100) pw.appendChild(h('div', { class: 'results-note' }, ['+' + (hits.length - 100)]));
      psec.appendChild(pw);
    }

    if (!evHits.length && state.allPapersLoaded === false) { /* note already shown */ }
    if (!evHits.length && state.allPapersLoaded && !main.querySelector('.paper')) {
      main.appendChild(h('div', { class: 'empty' }, [t('no_results')]));
    }
  }

  // ---------------- event modal ----------------
  function openEvent(e, day) {
    var det = DETAILS[e.id] || {};
    var overlay = h('div', { class: 'overlay', onclick: function (ev) { if (ev.target === overlay) close(); } });
    function close() { overlay.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', onKey); }
    function onKey(ev) { if (ev.key === 'Escape') close(); }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';

    var g = TYPE_GROUP[e.type] || 'ops';
    var times = fmtRange(e, day.loc, ' (+1)');
    var head = h('div', { class: 'modal-head' }, [
      h('div', { class: 'heads' }, [
        h('span', { class: 'badge', style: '--tc:' + GROUP_COLOR[g] }, [loc(e.typeName)]),
        h('h2', null, [loc(e.title)]),
        (state.lang === 'ko' && e.title.ko && e.title.en !== e.title.ko)
          ? h('div', { class: 'sub' }, [e.title.en]) : null,
        h('div', { class: 'meta' }, [
          h('span', null, ['🗓 ' + loc(day.dateFull)]),
          times ? h('span', null, ['🕐 ' + times + ' ' + tzAbbr(day.loc)]) : null,
          h('span', null, ['🌏 ' + loc(LOCS[day.loc].name)]),
          e.room ? h('span', null, ['📍 ' + roomWithFloor(e.room)]) : null,
          e.speaker ? h('span', null, ['🎤 ' + e.speaker]) : null,
          e.organizers ? h('span', null, ['👥 ' + e.organizers]) : null
        ])
      ]),
      h('button', { class: 'modal-close', onclick: close }, ['✕'])
    ]);

    var body = h('div', { class: 'modal-body' });

    // abstract / description
    if (det.abs) {
      var absHtml = (state.lang === 'ko' && det.abs.ko) ? det.abs.ko : det.abs.en;
      var sec = h('div', { class: 'msec' }, [
        h('h4', null, [t('abstract')]),
        h('div', { class: 'abs', html: absHtml })
      ]);
      if (state.lang === 'ko' && det.abs.ko) {
        var shown = false;
        var origBox = null;
        sec.appendChild(h('button', {
          class: 'lang-orig',
          onclick: function (ev) {
            shown = !shown;
            ev.target.textContent = shown ? t('hide_original') : t('show_original');
            if (shown && !origBox) {
              origBox = h('div', { class: 'abs', style: 'margin-top:8px', html: det.abs.en });
              sec.appendChild(origBox);
              typeset(origBox);
            } else if (origBox) { origBox.style.display = shown ? '' : 'none'; }
          }
        }, [t('show_original')]));
      }
      body.appendChild(sec);
      typeset(sec);
    }

    // workshop program (schedule + invited speakers) from the workshop's own site
    if (det.program) {
      renderProgram(body, det.program);
    }

    // speakers
    if (det.speakers && det.speakers.length) {
      body.appendChild(h('div', { class: 'msec' }, [
        h('h4', null, [t('speakers')]),
        h('div', null, det.speakers.map(function (sp) {
          var bio = sp.bio ? ((state.lang === 'ko' && sp.bio.ko) ? sp.bio.ko : sp.bio.en) : null;
          return h('div', { class: 'speaker-row' }, [
            h('div', { class: 'nm' }, [sp.name || '']),
            bio ? h('div', { class: 'bio' }, [bio]) : null
          ]);
        }))
      ]));
    }

    // links
    if (det.links && det.links.length) {
      body.appendChild(h('div', { class: 'msec' }, [
        h('h4', null, [t('links')]),
        h('div', { class: 'linkrow' }, det.links.map(function (l) {
          return h('a', { href: l.url, target: '_blank', rel: 'noopener' }, [l.label + ' ↗']);
        }))
      ]));
    }

    // papers
    if (e.nPapers) {
      var plabel = e.type === 'oral-session' ? t('talks')
        : e.type === 'poster-session' ? t('posters') : t('accepted');
      var psec = h('div', { class: 'msec' }, [
        h('h4', null, [plabel + ' · ' + e.nPapers]),
        h('div', { class: 'spin' }, [t('loading')])
      ]);
      body.appendChild(psec);
      loadPapers(papersRef(e)).then(function (papers) {
        psec.innerHTML = '';
        psec.appendChild(h('h4', null, [plabel + ' · ' + papers.length]));
        if (e.oralPending) psec.appendChild(h('div', { class: 'prog-note' }, [t('oral_pending')]));
        psec.appendChild(renderPaperList(papers, e.id));
      });
    }

    var modal = h('div', { class: 'modal' }, [head, body]);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  // ---------------- workshop program (schedule + invited speakers) ----------------
  var KIND_ICON = {
    opening: '🎬', closing: '🏁', oral: '🎓', invited: '🎤', keynote: '⭐',
    poster: '📌', panel: '💬', break: '☕', lunch: '🍽', spotlight: '✨',
    contributed: '📄', award: '🏆', other: '•'
  };

  function renderProgram(body, prog) {
    var sec = h('div', { class: 'msec' }, [h('h4', null, [t('program')])]);

    // prominent poster-location banner (Hall / board numbers)
    if (prog.posterLoc && prog.posterLoc.length) {
      var note = prog.posterNote ? ((state.lang === 'ko' && prog.posterNote.ko) ? prog.posterNote.ko : prog.posterNote.en) : null;
      sec.appendChild(h('div', { class: 'poster-banner' }, [
        h('span', { class: 'pb-ico' }, ['📍']),
        h('span', null, [
          h('b', null, [state.lang === 'ko' ? '포스터 위치 ' : 'Poster location ']),
          prog.posterLoc.join('  ·  '),
          note ? h('div', { class: 'pb-note' }, [note]) : null
        ])
      ]));
    }

    // invited speakers
    if (prog.speakers && prog.speakers.length) {
      sec.appendChild(h('div', { class: 'prog-sub' }, [t('invited_speakers')]));
      sec.appendChild(h('div', { class: 'spk-chips' }, prog.speakers.map(function (sp) {
        return h('div', { class: 'spk-chip' }, [
          h('span', { class: 'spk-nm' }, [sp.name]),
          sp.affil ? h('span', { class: 'spk-af' }, [sp.affil]) : null
        ]);
      })));
    }

    // schedule table
    if (prog.schedule && prog.schedule.length) {
      var useKo = state.lang === 'ko';
      var rows = prog.schedule.map(function (it) {
        var label = (useKo && it.ko) ? it.ko : (it.en || '');
        var icon = KIND_ICON[it.kind] || KIND_ICON.other;
        var kindCls = ['break', 'lunch'].indexOf(it.kind) >= 0 ? ' prow-muted' : '';
        var sublist = null;
        if (it.items && it.items.length) {
          sublist = h('ol', { class: 'psub' }, it.items.map(function (s) {
            var sl = (useKo && s.ko) ? s.ko : (s.en || '');
            return h('li', null, [
              sl,
              s.speaker ? h('span', { class: 'psub-spk' }, [' — ' + s.speaker]) : null
            ]);
          }));
        }
        return h('div', { class: 'prow' + kindCls }, [
          h('div', { class: 'ptime' }, [it.time || '']),
          h('div', { class: 'pbody' }, [
            h('div', { class: 'psession' }, [
              h('span', { class: 'pkind' }, [icon + ' ']),
              label
            ]),
            it.speaker ? h('div', { class: 'pspk' }, ['🎤 ' + it.speaker]) : null,
            sublist
          ])
        ]);
      });
      var note = prog.tz ? (prog.tz + ' · ' + t('schedule_note')) : t('schedule_note');
      sec.appendChild(h('div', { class: 'prog-note' }, [note]));
      sec.appendChild(h('div', { class: 'ptable' }, rows));
    }

    body.appendChild(sec);
  }

  // ---------------- paper list w/ filter + incremental render ----------------
  function renderPaperList(papers, sid) {
    var wrap = h('div');
    var listEl = h('div');
    var count = h('div', { class: 'pcount' });
    var filtered = papers;
    var shown = 0;
    var CHUNK = 60;

    var curQ = '', curTag = '';
    function applyFilter() {
      filtered = papers.filter(function (p) {
        if (curTag && p.tag !== curTag) return false;
        if (!curQ) return true;
        var tagx = p.tag ? (p.tag + (p.tag === 'Oral' ? ' 구두' : ' 스포트라이트')) : '';
        return ((p.en || '') + ' ' + (p.ko || '') + ' ' + (p.authors || '') + ' ' + (p.inst || '') + ' ' + (p.pos || '') + ' ' + tagx).toLowerCase().indexOf(curQ) >= 0;
      });
      reset();
    }
    var finput = h('input', {
      type: 'search', placeholder: t('filter_papers'),
      oninput: debounce(function (ev) { curQ = ev.target.value.trim().toLowerCase(); applyFilter(); }, 200)
    });
    var nOral = papers.filter(function (p) { return p.tag === 'Oral'; }).length;
    var nSpot = papers.filter(function (p) { return p.tag === 'Spotlight'; }).length;
    var tagChips = null;
    if (nOral || nSpot) {
      var defs = [['', t('tag_all') + ' ' + papers.length]];
      if (nOral) defs.push(['Oral', '🎓 ' + (state.lang === 'ko' ? '오럴' : 'Oral') + ' ' + nOral]);
      if (nSpot) defs.push(['Spotlight', '✨ ' + (state.lang === 'ko' ? '스포트라이트' : 'Spotlight') + ' ' + nSpot]);
      tagChips = h('div', { class: 'chips tagchips' }, defs.map(function (d) {
        var b = h('button', { class: 'chip' + (d[0] === curTag ? ' on' : ''), onclick: function () {
          curTag = d[0];
          tagChips.querySelectorAll('.chip').forEach(function (x) { x.classList.remove('on'); });
          b.classList.add('on'); applyFilter();
        } }, [d[1]]);
        return b;
      }));
    }

    function updateCount() {
      count.textContent = Math.min(shown, filtered.length) + ' ' + t('shown') + t('of') + filtered.length;
    }
    function renderChunk() {
      var frag = document.createDocumentFragment();
      var end = Math.min(shown + CHUNK, filtered.length);
      for (var i = shown; i < end; i++) frag.appendChild(renderPaperItem(filtered[i], { sid: sid }));
      shown = end;
      listEl.insertBefore(frag, sentinel);
      updateCount();
    }
    var sentinel = h('div', { class: 'loadmore-sentinel' });
    listEl.appendChild(sentinel);
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting && shown < filtered.length) renderChunk();
    }, { rootMargin: '600px' });
    io.observe(sentinel);

    function reset() {
      listEl.querySelectorAll('.paper').forEach(function (n) { n.remove(); });
      shown = 0;
      renderChunk();
    }

    wrap.appendChild(h('div', { class: 'paperfilter' }, [finput]));
    if (tagChips) wrap.appendChild(tagChips);
    wrap.appendChild(count);
    wrap.appendChild(listEl);
    renderChunk();
    return wrap;
  }

  function renderPaperItem(p, opts) {
    opts = opts || {};
    var title = (state.lang === 'ko' && p.ko) ? p.ko : (p.en || '');
    var expanded = false;
    var bodyEl = null;
    var pinned = !!wish.papers[p.id];
    var item = h('div', { class: 'paper' + (opts.ctx ? ' paper-hit' : '') + (pinned ? ' pinned' : '') });
    var tags = [];
    if (p.tag) {
      var tcls = p.tag === 'Oral' ? 'ptag-oral' : 'ptag-spot';
      var tlabel = p.tag === 'Oral'
        ? (state.lang === 'ko' ? '🎓 구두' : '🎓 Oral')
        : (state.lang === 'ko' ? '✨ 스포트라이트' : '✨ Spotlight');
      tags.push(h('span', { class: 'ptag ' + tcls }, [tlabel]));
    }
    if (p.time) tags.push(h('span', { class: 'ptag oraltime' }, [p.time]));
    if (p.psess) tags.push(h('span', { class: 'ptag' }, ['📌 ' + p.psess.replace(/^(Sydney|Atlanta|Paris) /, '')]));
    if (p.pos) tags.push(h('span', { class: 'ptag' }, [p.pos]));
    if (opts.score != null) tags.push(h('span', { class: 'ptag match' }, [t('s_match') + ' ' + opts.score]));
    var btn = h('button', {
      title: t('wish_hint'),
      onclick: function () {
        if (btn._lpFired) { btn._lpFired = false; return; }
        if (!bodyEl && !p.abs && opts.ref && !p._loaded) {
          p._loaded = true;
          loadPapers(opts.ref).then(function (list) {
            var f = (list || []).find(function (x) { return x.id === p.id; });
            if (f) ['abs', 'absKo', 'link', 'psess', 'pos'].forEach(function (k) { if (f[k] && !p[k]) p[k] = f[k]; });
            btn.click();
          });
          return;
        }
        expanded = !expanded;
        if (expanded && !bodyEl) {
          var useKoAbs = state.lang === 'ko' && p.absKo;
          var absHtml = useKoAbs ? p.absKo : p.abs;
          bodyEl = h('div', { class: 'pbody' }, [
            (state.lang === 'ko' && p.ko && p.en) ? h('div', { class: 'sub-en' }, [t('view_original_title') + ': ' + p.en]) : null,
            absHtml ? h('div', { class: 'abs', html: absHtml }) : null,
            p.link ? h('div', { class: 'plinks linkrow' }, [
              h('a', { href: p.link, target: '_blank', rel: 'noopener' }, [(/openreview/.test(p.link) ? 'OpenReview' : 'Link') + ' ↗'])
            ]) : null
          ]);
          if (useKoAbs && p.abs) {
            var shownOrig = false;
            var origEl = null;
            bodyEl.insertBefore(h('button', {
              class: 'lang-orig',
              onclick: function (ev2) {
                ev2.stopPropagation();
                shownOrig = !shownOrig;
                ev2.target.textContent = shownOrig ? t('hide_original') : t('show_original');
                if (shownOrig && !origEl) {
                  origEl = h('div', { class: 'abs', style: 'margin-top:8px', html: p.abs });
                  ev2.target.insertAdjacentElement('afterend', origEl);
                  typeset(origEl);
                } else if (origEl) origEl.style.display = shownOrig ? '' : 'none';
              }
            }, [t('show_original')]), bodyEl.querySelector('.plinks'));
          }
          item.appendChild(bodyEl);
          typeset(bodyEl);
        } else if (bodyEl) bodyEl.style.display = expanded ? '' : 'none';
      }
    }, [
      tags.length ? h('div', { class: 'ptags' }, tags) : null,
      h('div', { class: 'pt' }, [title]),
      p.authors ? h('div', { class: 'pa' }, [p.authors]) : null,
      p.inst ? h('div', { class: 'pi' }, ['🏛 ' + p.inst]) : null,
      opts.ctx ? h('div', { class: 'ctx' }, [opts.ctx]) : null
    ]);
    if (p.id) {
      longPress(btn, function () {
        togglePaperPin(p, opts.sid);
        item.classList.toggle('pinned', !!wish.papers[p.id]);
        var chip = document.querySelector('.chip-wish');
        if (chip) {
          var n = wishCount();
          chip.textContent = '⭐ ' + t('wish') + (n ? ' ' + n : '');
        }
      });
    }
    item.appendChild(btn);
    return item;
  }

  // ---------------- paper search tab ----------------
  var SX = { q: params.get('view') === 'search' ? (params.get('q') || '') : '', mode: localStorage.getItem('nips_smode') || 'kw',
             loc: 'all', kind: 'all', tagOnly: false, inst: '', limit: 50, results: null, msg: '' };
  if (params.get('mode') === 'sem') SX.mode = 'sem';
  var IDX = null, IDX_HAY = null, EMB = null, EXTRACTOR = null;
  function loadIndex() {
    if (IDX) return Promise.resolve(IDX);
    return new Promise(function (res) {
      var sc = document.createElement('script');
      sc.src = 'data/search/index.js';
      sc.onload = function () {
        IDX = window.NIPS_INDEX || { rows: [] };
        IDX_HAY = IDX.rows.map(function (r) {
          return { t: (r[2] + ' ' + r[3]).toLowerCase(), a: (r[4] || '').toLowerCase(), i: (r[5] || '').toLowerCase() };
        });
        res(IDX);
      };
      sc.onerror = function () { IDX = { rows: [] }; IDX_HAY = []; res(IDX); };
      document.head.appendChild(sc);
    });
  }
  function ensureSemantic(onProgress) {
    var tasks = [];
    if (!EMB) tasks.push(fetch(IDX.emb.file).then(function (r) { return r.arrayBuffer(); }).then(function (b) { EMB = new Int8Array(b); }));
    if (!EXTRACTOR) {
      tasks.push(import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2').then(function (m) {
        return m.pipeline('feature-extraction', IDX.emb.model, { dtype: 'q8', progress_callback: onProgress });
      }).then(function (ex) { EXTRACTOR = ex; }));
    }
    return Promise.all(tasks);
  }
  function rowLoc(r) { var hit = EV_INDEX[r[1]]; return hit ? hit.day.loc : ''; }
  function passFilters(r) {
    if (SX.loc !== 'all' && rowLoc(r) !== SX.loc) return false;
    if (SX.kind === 'main' && r[7]) return false;
    if (SX.kind === 'ws' && !r[7]) return false;
    if (SX.tagOnly && !r[6]) return false;
    if (SX.inst && (r[5] || '').split('; ').indexOf(SX.inst) < 0) return false;
    return true;
  }
  function keywordSearch(q) {
    var toks = q.toLowerCase().split(/\s+/).filter(Boolean);
    var out = [];
    IDX.rows.forEach(function (r, i) {
      var hy = IDX_HAY[i], score = 0;
      for (var k = 0; k < toks.length; k++) {
        var tk = toks[k];
        if (hy.t.indexOf(tk) >= 0) score += 3;
        else if (hy.i.indexOf(tk) >= 0) score += 2;
        else if (hy.a.indexOf(tk) >= 0) score += 1;
        else return;
      }
      out.push({ r: r, s: score + (r[6] ? 0.3 : 0) });
    });
    out.sort(function (a, b) { return b.s - a.s; });
    return out;
  }
  function semanticSearch(q) {
    return EXTRACTOR('Represent this sentence for searching relevant passages: ' + q, { pooling: 'cls', normalize: true }).then(function (o) {
      var qv = o.data, dim = IDX.emb.dim, out = [];
      IDX.rows.forEach(function (r) {
        var row = r[8];
        if (row < 0) return;
        var base = row * dim, dot = 0;
        for (var k = 0; k < dim; k++) dot += EMB[base + k] * qv[k];
        out.push({ r: r, s: dot / 127 });
      });
      out.sort(function (a, b) { return b.s - a.s; });
      return out.slice(0, 400);
    });
  }
  function runSearch(view) {
    var q = SX.q.trim();
    try { history.replaceState(null, '', '?view=search' + (q ? '&q=' + encodeURIComponent(q) : '') + (SX.mode === 'sem' ? '&mode=sem' : '')); } catch (e) { /* file:// */ }
    if (!q) { SX.results = null; drawResults(view); return; }
    SX.limit = 50; SX.inst = '';
    var status = view.querySelector('.s-status');
    status.textContent = t('s_loading_index');
    loadIndex().then(function () {
      if (SX.mode === 'sem' && IDX.emb) {
        status.textContent = t('s_loading_model');
        return ensureSemantic(function (pr) {
          if (pr && pr.status === 'progress' && pr.total) status.textContent = t('s_loading_model') + ' ' + Math.round(pr.loaded / pr.total * 100) + '%';
        }).then(function () { return semanticSearch(q); }).catch(function () {
          SX.mode = 'kw'; SX.msg = t('s_sem_fail'); return keywordSearch(q);
        });
      }
      return keywordSearch(q);
    }).then(function (res) {
      status.textContent = '';
      SX.results = res;
      drawResults(view);
    });
  }
  function hitCtx(r) {
    var hit = EV_INDEX[r[1]];
    if (!hit) return '';
    var e = hit.ev, d = hit.day;
    return loc(LOCS[d.loc].name) + ' · ' + loc(d.label) + ' · ' + loc(e.title) +
      (e.start ? ' · ' + fmtRange(e, d.loc, ' +1') + ' ' + tzAbbr(d.loc) : '') + (e.room ? ' · ' + e.room : '');
  }
  function drawResults(view) {
    var box = view.querySelector('.s-results');
    box.innerHTML = '';
    if (SX.msg) { box.appendChild(h('div', { class: 'prog-note' }, [SX.msg])); SX.msg = ''; }
    if (!SX.results) return;
    var list = SX.results.filter(function (x) { return passFilters(x.r); });
    // institution facet over the top results (borrowed idea: who publishes on this topic)
    var top = list.slice(0, 200), cnt = {};
    top.forEach(function (x) { (x.r[5] ? x.r[5].split('; ') : []).forEach(function (n) { cnt[n] = (cnt[n] || 0) + 1; }); });
    var insts = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; }).slice(0, 10);
    box.appendChild(h('div', { class: 'results-note' }, ['“' + SX.q.slice(0, 80) + '” — ' + t(SX.mode === 'sem' ? 's_results_sem' : 's_results').replace('{n}', list.length.toLocaleString())]));
    if (SX.inst) {
      box.appendChild(h('button', { class: 'chip on', onclick: function () { SX.inst = ''; drawResults(view); } }, ['🏛 ' + SX.inst + ' ✕']));
    } else if (insts.length >= 3) {
      var maxc = cnt[insts[0]];
      box.appendChild(h('div', { class: 'instbox' }, [
        h('div', { class: 'prog-sub' }, [t('s_top_inst') + (SX.mode === 'sem' ? ' (top ' + top.length + ')' : '')]),
        h('div', { class: 'instbars' }, insts.map(function (n) {
          return h('button', { class: 'instbar', onclick: function () { SX.inst = n; drawResults(view); } }, [
            h('span', { class: 'ib-name' }, [n]),
            h('span', { class: 'ib-bar' }, [h('i', { style: 'width:' + Math.max(6, Math.round(cnt[n] / maxc * 100)) + '%' })]),
            h('span', { class: 'ib-n' }, [String(cnt[n])])
          ]);
        }))
      ]));
    }
    if (!list.length) { box.appendChild(h('div', { class: 'empty' }, [t('s_none')])); return; }
    var wrap = h('div');
    list.slice(0, SX.limit).forEach(function (x) {
      var r = x.r, hit = EV_INDEX[r[1]];
      var p = { id: r[0], en: r[2], ko: r[3], authors: r[4], inst: r[5], tag: r[6] };
      wrap.appendChild(renderPaperItem(p, {
        sid: r[1], ref: hit ? papersRef(hit.ev) : null, ctx: hitCtx(r),
        score: SX.mode === 'sem' ? Math.round(x.s * 100) : null
      }));
    });
    box.appendChild(wrap);
    if (list.length > SX.limit) {
      box.appendChild(h('button', { class: 'load-all', onclick: function () { SX.limit += 50; drawResults(view); } },
        [t('s_more') + ' (' + Math.min(SX.limit, list.length) + ' / ' + list.length + ')']));
    }
  }
  function renderSearchView(main) {
    var nAll = SCHED.days.reduce(function (a, d) { return a; }, 0);
    var view = h('div', { class: 'sv' });
    var ta = h('textarea', { class: 's-input', rows: '2', placeholder: t('s_ph') });
    ta.value = SX.q;
    function go() { SX.q = ta.value; runSearch(view); }
    ta.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); go(); } });
    function segBtn(cur, val, label, set) {
      return h('button', { class: cur === val ? 'on' : '', onclick: function () { set(val); } }, [label]);
    }
    var modeSeg = h('div', { class: 'seg' }, [
      segBtn(SX.mode, 'kw', t('s_mode_kw'), function (v) { SX.mode = v; localStorage.setItem('nips_smode', v); rerender(); }),
      segBtn(SX.mode, 'sem', t('s_mode_sem'), function (v) { SX.mode = v; localStorage.setItem('nips_smode', v); rerender(); })
    ]);
    function rerender() { main.innerHTML = ''; renderSearchView(main); }
    function filterChip(label, on, fn) { return h('button', { class: 'chip' + (on ? ' on' : ''), onclick: function () { fn(); rerenderKeep(); } }, [label]); }
    function rerenderKeep() { SX.q = ta.value; var r = SX.results; main.innerHTML = ''; renderSearchView(main); SX.results = r; drawResults(main.querySelector('.sv')); }
    var locChips = [filterChip(t('s_all'), SX.loc === 'all', function () { SX.loc = 'all'; })].concat((SCHED.locs || []).map(function (l) {
      return filterChip(loc(l.name), SX.loc === l.id, function () { SX.loc = l.id; });
    }));
    var kindChips = [
      filterChip(t('s_main'), SX.kind === 'main', function () { SX.kind = SX.kind === 'main' ? 'all' : 'main'; }),
      filterChip(t('s_ws'), SX.kind === 'ws', function () { SX.kind = SX.kind === 'ws' ? 'all' : 'ws'; }),
      filterChip(t('s_tag_only'), SX.tagOnly, function () { SX.tagOnly = !SX.tagOnly; })
    ];
    var examples = SX.mode === 'sem'
      ? ['RL for LLM reasoning', 'diffusion language models', 'protein design', 'LLM agent evaluation', 'mechanistic interpretability', 'genomics foundation models']
      : (state.lang === 'ko' ? ['강화학습', '확산 모델', '에이전트', 'KAIST', 'Seoul National University', '유전체'] : ['reinforcement learning', 'diffusion', 'agents', 'KAIST', 'Seoul National University', 'genomics']);
    var hasHangul = /[가-힣]/.test(SX.q);
    view.appendChild(h('div', { class: 's-head' }, [
      h('h2', null, [t('s_title')]),
      h('p', { class: 's-desc' }, [t('s_desc').replace('{n}', totalPapers())])
    ]));
    view.appendChild(h('div', { class: 's-box' }, [ta, h('button', { class: 's-go', onclick: go }, [t('s_go')])]));
    view.appendChild(h('div', { class: 's-row' }, [modeSeg,
      h('div', { class: 'chips' }, [h('span', { class: 's-lbl' }, [t('s_examples')])].concat(examples.map(function (x) {
        return h('button', { class: 'chip', onclick: function () { ta.value = x; go(); } }, [x]);
      })))
    ]));
    if (SX.mode === 'sem') view.appendChild(h('div', { class: 'prog-note' }, [t('s_sem_note') + (hasHangul ? ' ' + t('s_ko_note') : '')]));
    view.appendChild(h('div', { class: 'chips s-filters' }, locChips.concat([h('span', { class: 's-sep' })]).concat(kindChips)));
    view.appendChild(h('div', { class: 's-status' }));
    view.appendChild(h('div', { class: 's-results' }));
    main.appendChild(view);
    if (SX.q && !SX.results) runSearch(view);
    else if (SX.results) drawResults(view);
    setTimeout(function () { if (!SX.q) ta.focus(); }, 0);
  }

  function renderFooter() {
    var kids = [h('div', null, [t('footer')])];
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      var btn = h('button', {
        class: 'offline-btn',
        onclick: function () {
          btn.disabled = true;
          btn.textContent = t('offline_saving');
          loadAllPapers(function (done, total) {
            btn.textContent = t('offline_saving') + done + '/' + total;
          }).then(function () {
            btn.textContent = t('offline_done');
          });
        }
      }, [t('offline_save')]);
      kids.push(h('div', { class: 'offline-row' }, [btn, h('span', { class: 'offline-desc' }, [t('offline_desc')])]));
    }
    return h('footer', null, kids);
  }

  // ---------------- PWA ----------------
  var installEvt = null;
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(function () { /* non-fatal */ });
  }
  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    installEvt = e;
    var b = document.getElementById('btn-install');
    if (b) b.style.display = '';
  });
  window.addEventListener('appinstalled', function () {
    installEvt = null;
    var b = document.getElementById('btn-install');
    if (b) b.style.display = 'none';
  });

  // ---------------- boot ----------------
  // dev/test: seed pins from URL (in-memory only; persisted on next user toggle)
  if (params.get('pin')) {
    params.get('pin').split(',').forEach(function (id) {
      if (id.indexOf('@') > 0) {
        var pr = id.split('@');
        wish.papers[pr[0]] = { s: pr[1] };
      } else {
        wish.events[id] = 1;
      }
    });
  }
  if (params.get('chip')) state.chip = params.get('chip');

  var savedTheme = params.get('theme') || localStorage.getItem('nips_theme');
  if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
  else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
  render();

  // deep link: ?open=<eventId> opens that event's detail modal
  var openId = params.get('open');
  if (openId) {
    SCHED.days.forEach(function (d) {
      d.events.forEach(function (e) {
        if (e.id === openId) {
          if (state.day !== d.day) { state.loc = d.loc; state.day = d.day; render(); }
          openEvent(e, d);
        }
      });
    });
  }
})();
