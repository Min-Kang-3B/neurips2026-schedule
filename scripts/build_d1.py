"""Build the D1 seed for the MCP server from the built site data (run after build_site.py).

  python3 scripts/build_d1.py            # -> work/d1_seed.sql
  cd mcp && npx wrangler d1 execute neurips2026 --remote --file=../work/d1_seed.sql
"""
import glob
import json
import os
import re

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
DATA = os.path.join(ROOT, 'data')
OUT = os.path.join(ROOT, 'work', 'd1_seed.sql')


def load_js(path):
    s = open(path, encoding='utf-8').read()
    obj, _ = json.JSONDecoder().raw_decode(s[s.index('=') + 1:].lstrip())
    return obj


def q(v):
    if v is None:
        return 'NULL'
    if isinstance(v, (int, float)):
        return str(int(v))
    return "'" + str(v).replace("'", "''") + "'"


def text(html_s):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', html_s or '')).strip()


sched = load_js(os.path.join(DATA, 'schedule.js'))
events, ref_of = {}, {}
for d in sched['days']:
    for e in d['events']:
        events[e['id']] = (d, e)
        ref_of[e['id']] = e.get('papersRef') or e['id']

papers_by_ref = {}
for f in glob.glob(os.path.join(DATA, 'papers', 's*.js')):
    ref = os.path.basename(f)[1:-3]
    papers_by_ref[ref] = {p['id']: p for p in load_js(f)}

rows = load_js(os.path.join(DATA, 'search', 'index.js'))['rows']
out = ['DELETE FROM papers;', 'DELETE FROM events;']
for eid, (d, e) in events.items():
    out.append('INSERT INTO events VALUES (' + ','.join(q(v) for v in [
        eid, d['loc'], d['date'], e.get('start'), e.get('end'), 1 if e.get('endNextDay') else 0, e['type'],
        (e.get('typeName') or {}).get('en'), (e.get('typeName') or {}).get('ko'), e['title'].get('en'),
        e['title'].get('ko'), e.get('room'), e.get('speaker'), e.get('organizers'), e.get('nPapers') or 0]) + ');')
n = 0
for pid, sid, en, ko, authors, inst, tag, ws, emb in rows:
    if sid not in events:
        continue
    full = papers_by_ref.get(ref_of[sid], {}).get(pid, {})
    hay = ' '.join([en or '', ko or '', authors or '', inst or '', full.get('pos') or '']).lower()
    insf = os.path.join(DATA, 'ins', pid + '.json')
    ins = open(insf, encoding='utf-8').read() if (not ws and os.path.exists(insf)) else None
    out.append('INSERT INTO papers VALUES (' + ','.join(q(v) for v in [
        pid, sid, events[sid][0]['loc'], en, ko, authors, inst, tag, ws, emb, full.get('pos'), full.get('psess'),
        full.get('link'), text(full.get('abs')), text(full.get('absKo')), hay,
        full.get('rv') if not ws else None, ins]) + ');')
    n += 1
open(OUT, 'w', encoding='utf-8').write('\n'.join(out) + '\n')
print(f'events {len(events)} | papers {n} -> {OUT} ({os.path.getsize(OUT) / 1e6:.1f} MB)')
