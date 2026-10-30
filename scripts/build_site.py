"""Build site data files from parse.py outputs + Korean translations.

Run from the work dir:  python scripts/build_site.py <site-dir>
Output:
  data/schedule.js        window.NIPS_SCHEDULE = {locs:[...], days:[...]}
  data/details.js         window.NIPS_DETAILS  = {eventId: {abs, links, program}}
  data/papers/s<id>.js    window.NIPS_PAPERS['<id>'] = [...]
"""
import json
import os
import re
import sys
from collections import Counter
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from latex2text import latex_to_text as L  # noqa: E402

SITE = sys.argv[1] if len(sys.argv) > 1 else '..'


def load(path, default=None):
    return json.load(open(path)) if os.path.exists(path) else (default if default is not None else {})


events = load('events.json')
papers_main = load('papers_main.json')
ws_papers = load('ws_papers.json')
ws_program = load('ws_program.json')
orals_by_loc = load('orals_by_loc.json')
details = {}
for line in open('details.jsonl'):
    try:
        r = json.loads(line)
        details[r['id']] = r
    except Exception:
        pass
ko_titles = load('ko_titles.json')
ko_pabs = load('ko_pabs.json')
ko_misc = load('ko_misc.json')
ko_abstracts = load('ko_abstracts.json')
ko_wtitles = load('ko_wtitles.json')

LOC_INFO = [
    {'id': 'sydney', 'name': {'en': 'Sydney', 'ko': '시드니'}, 'tz': 'Australia/Sydney', 'abbr': 'AEDT',
     'role': {'en': 'Main', 'ko': '메인'}, 'range': {'en': 'Dec 6 – 12', 'ko': '12.6 – 12.12'}},
    {'id': 'atlanta', 'name': {'en': 'Atlanta', 'ko': '애틀랜타'}, 'tz': 'America/New_York', 'abbr': 'EST',
     'role': {'en': 'Satellite', 'ko': '위성'}, 'range': {'en': 'Dec 9 – 13', 'ko': '12.9 – 12.13'}},
    {'id': 'paris', 'name': {'en': 'Paris', 'ko': '파리'}, 'tz': 'Europe/Paris', 'abbr': 'CET',
     'role': {'en': 'Satellite', 'ko': '위성'}, 'range': {'en': 'Dec 9 – 13', 'ko': '12.9 – 12.13'}},
]

TYPE_INFO = {
    'invited-talk': ('Invited Talk', '초청 강연'), 'oral-session': ('Oral Session', '오럴 세션'),
    'poster-session': ('Poster Session', '포스터 세션'), 'workshop': ('Workshop', '워크숍'),
    'competition': ('Competition', '컴피티션'), 'tutorial': ('Tutorial', '튜토리얼'),
    'social': ('Social', '소셜'), 'affinity-event': ('Affinity Event', '어피니티 이벤트'),
    'break': ('Break', '휴식'), 'registration-desk': ('Registration', '등록 데스크'),
    'town-hall': ('Town Hall', '타운홀'), 'test-of-time': ('Test of Time Award', 'Test of Time 어워드'),
    'award': ('Award', '시상'), 'remarks': ('Remarks', '개회사'), 'reception': ('Reception', '리셉션'),
    'talk': ('Talk', '세션'), 'creative-ai': ('Creative AI', '크리에이티브 AI'),
    'reproducibility-track': ('Reproducibility', '재현성 트랙'),
    'expo-talk-panel': ('Expo Talk', '엑스포 강연'), 'expo-demonstration': ('Expo Demo', '엑스포 데모'),
    'expo-workshop': ('Expo Workshop', '엑스포 워크숍'), 'session': ('Session', '세션'),
}
KO_LOC = {'Sydney': '시드니', 'Atlanta': '애틀랜타', 'Paris': '파리'}
KO_SESS = {'Oral': '오럴 세션', 'Poster': '포스터 세션', 'Creative AI': '크리에이티브 AI 세션'}
DOW_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
DOW_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
DOW_KO = ['월', '화', '수', '목', '금', '토', '일']


def ko_or_none(d, k):
    v = d.get(k)
    return v if v else None


MATH_SPLIT = re.compile(r'(\$\$.+?\$\$|(?<!\\)\$[^$]+?(?<!\\)\$|\\\(.+?\\\)|<[^>]+>)', re.S)


def md_inline(html_txt):
    """OpenReview abstracts often carry Markdown (**bold**, *italic*, `code`); render it outside math/tags."""
    if not html_txt or not re.search(r'[*`]', html_txt):
        return html_txt
    parts = MATH_SPLIT.split(html_txt)
    for i in range(0, len(parts), 2):
        t = parts[i]
        t = re.sub(r'\*\*(?=\S)([^*<>\n]{1,160}?)(?<=\S)\*\*', r'<strong>\1</strong>', t)
        t = re.sub(r'(?<![\w*])\*(?=\S)([^*<>\n]{1,160}?)(?<=\S)\*(?![\w*])', r'<em>\1</em>', t)
        t = re.sub(r'`([^`<>\n]{1,80})`', r'<code>\1</code>', t)
        parts[i] = t
    return ''.join(parts)


def paper_entry(pid):
    p = papers_main.get(pid) or {}
    ent = {'id': pid, 'en': L(p.get('title'))}
    if ko_titles.get(pid):
        ent['ko'] = L(ko_titles[pid])
    for k in ('authors', 'link', 'tag', 'pos', 'psess'):
        if p.get(k):
            ent[k] = p[k]
    if p.get('inst'):
        ent['inst'] = '; '.join(p['inst'])
    if p.get('abs'):
        ent['abs'] = md_inline(p['abs'])
    if ko_pabs.get(pid):
        ent['absKo'] = md_inline(ko_pabs[pid])
    return ent


def ws_paper_entry(eid, i, p):
    key = p.get('id') or f'{eid}:{i}'
    ent = {'id': key, 'en': L(p['title'])}
    if ko_wtitles.get(key):
        ent['ko'] = L(ko_wtitles[key])
    if p.get('authors'):
        ent['authors'] = p['authors']
    if p.get('link'):
        ent['link'] = p['link']
    if p.get('type') and p['type'].lower() in ('oral', 'spotlight'):
        ent['tag'] = p['type'].title()
    return ent


PROG_KIND = [('break', 'break'), ('lunch', 'lunch'), ('coffee', 'break'), ('opening', 'opening'),
             ('closing', 'closing'), ('invited', 'invited'), ('keynote', 'keynote'), ('panel', 'panel'),
             ('poster', 'poster'), ('oral', 'oral'), ('spotlight', 'spotlight'), ('award', 'award'),
             ('contributed', 'contributed'), ('talk', 'invited')]


def prog_kind(row):
    s = (row.get('type', '') + ' ' + row.get('title', '')).lower()
    for k, v in PROG_KIND:
        if k in s:
            return v
    return 'other'


def day_note(evs, idx):
    types = Counter(e['type'] for e in evs)
    if types['poster-session'] or types['oral-session']:
        return 'main'
    if types['workshop'] or types['competition']:
        return 'workshop'
    if types['tutorial']:
        return 'tutorial'
    if any(t.startswith('expo') for t in types):
        return 'expo'
    return 'other'


NOTE_TXT = {'main': ('Main Conference Day {n}', '본회의 {n}일차'), 'workshop': ('Workshops Day {n}', '워크숍 {n}일차'),
            'tutorial': ('Tutorials', '튜토리얼'), 'expo': ('Expo', '엑스포'), 'other': ('', '')}

os.makedirs(os.path.join(SITE, 'data', 'papers'), exist_ok=True)
for f in os.listdir(os.path.join(SITE, 'data', 'papers')):
    os.remove(os.path.join(SITE, 'data', 'papers', f))

out_days, det_out, paper_files = [], {}, {}
for li in LOC_INFO:
    loc = li['id']
    by_day = {}
    for e in events.get(loc, []):
        if not e.get('start'):
            continue
        st = datetime.fromisoformat(e['start'])
        en = datetime.fromisoformat(e['end']) if e.get('end') else None
        eid = e['id']
        ev = {
            'id': eid, 'type': e['type'], 'kind': 'session' if e.get('paperIds') else 'simple',
            'typeName': dict(zip(('en', 'ko'), TYPE_INFO.get(e['type'], (e['type'], e['type'])))),
            'title': {'en': L(e['title'])},
            'start': st.strftime('%H:%M'), 'end': en.strftime('%H:%M') if en else None,
            'room': e.get('room'),
        }
        if en and en.date() > st.date():
            ev['endNextDay'] = True
        if ko_misc.get(f't:{eid}'):
            ev['title']['ko'] = L(ko_misc[f't:{eid}'])
        m = re.match(r'^(Sydney|Atlanta|Paris) (Oral|Poster|Creative AI) Session (\w+)$', e['title'])
        if m:   # deterministic Korean for session names (keeps app terminology: 오럴/포스터)
            ev['title']['ko'] = f"{KO_LOC[m.group(1)]} {KO_SESS[m.group(2)]} {m.group(3)}"
        elif e['title'].startswith('Creative AI Session'):
            ev['title']['ko'] = '크리에이티브 AI 세션 ' + e['title'].split()[-1]
        if e.get('speaker'):
            ev['speaker'] = e['speaker']
        if e.get('organizers') and e.get('organizers') != e.get('speaker'):
            ev['organizers'] = e['organizers'].replace(' ⋅ ', ', ')
        # details
        d = details.get(eid, {})
        drec = {}
        if d.get('abstract_html'):
            drec['abs'] = {'en': d['abstract_html']}
            if ko_abstracts.get(eid):
                drec['abs']['ko'] = ko_abstracts[eid]
        links = [l for l in d.get('links') or [] if l.get('url')]
        links.append({'label': 'neurips.cc', 'url': 'https://neurips.cc' + e['url']})
        drec['links'] = links
        if ws_program.get(eid):
            drec['program'] = {'schedule': [
                {'time': r['time'], 'en': L(r['title']), 'ko': L(ko_misc.get(f'p:{eid}:{i}', '')),
                 'speaker': (r.get('authors') or '').replace(' ⋅ ', ', '),
                 'kind': prog_kind(r)} for i, r in enumerate(ws_program[eid])]}
        det_out[eid] = drec
        ev['hasDetail'] = True
        # papers
        if e.get('paperIds'):
            plist = [paper_entry(pid) for pid in e['paperIds']]
            rank = {'Oral': 0, 'Spotlight': 1}
            if e['type'] != 'poster-session':
                plist.sort(key=lambda x: rank.get(x.get('tag'), 2))
            paper_files[eid] = plist
            ev['nPapers'] = len(plist)
        elif e.get('oralPool'):
            ref = f'orals-{loc}'
            if ref not in paper_files:
                paper_files[ref] = [paper_entry(pid) for pid in orals_by_loc.get(loc, [])]
            ev['papersRef'] = ref
            ev['nPapers'] = len(paper_files[ref])
            ev['oralPending'] = True
        if ws_papers.get(eid):
            wp = [ws_paper_entry(eid, i, p) for i, p in enumerate(ws_papers[eid])]
            wp.sort(key=lambda x: {'Oral': 0, 'Spotlight': 1}.get(x.get('tag'), 2))
            paper_files[eid] = wp
            ev['nPapers'] = len(wp)
            ev['papersSource'] = 'workshop'
        by_day.setdefault(st.date().isoformat(), []).append(ev)

    counters = Counter()
    for date in sorted(by_day):
        evs = sorted(by_day[date], key=lambda x: (x['start'], x['title']['en']))
        dt = datetime.fromisoformat(date)
        w = dt.weekday()
        kind = day_note(evs, 0)
        counters[kind] += 1
        ne, nk = NOTE_TXT[kind]
        out_days.append({
            'day': f'{loc}-{date}', 'loc': loc, 'date': date,
            'label': {'en': f'{DOW_EN[w]} · Dec {dt.day}', 'ko': f'{DOW_KO[w]} · 12/{dt.day}'},
            'dateFull': {'en': f'{DOW_FULL[w]}, December {dt.day}, 2026', 'ko': f'2026년 12월 {dt.day}일 {DOW_KO[w]}요일'},
            'note': {'en': ne.format(n=counters[kind]), 'ko': nk.format(n=counters[kind])},
            'events': evs,
        })


def write_js(path, varname, obj):
    with open(path, 'w') as f:
        f.write(f'window.{varname} = ')
        json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))
        f.write(';')


write_js(os.path.join(SITE, 'data', 'schedule.js'), 'NIPS_SCHEDULE',
         {'locs': LOC_INFO, 'days': out_days, 'built': datetime.now().strftime('%Y-%m-%d')})
write_js(os.path.join(SITE, 'data', 'details.js'), 'NIPS_DETAILS', det_out)

# ---------- search index (titles/authors/institutions for every paper) + embeddings ----------
ev_of_ref = {}
for d in out_days:
    for ev in d['events']:
        ref = ev.get('papersRef') or ev['id']
        ev_of_ref.setdefault(ref, ev['id'])
emb_ids = load('emb_ids.json', [])
emb_row = {pid: i for i, pid in enumerate(emb_ids)}
rows, seen, emb_input = [], set(), []
order = sorted(paper_files.items(), key=lambda kv: kv[0].startswith('orals-'))  # sessions before oral pools
for ref, plist in order:
    sid = ev_of_ref.get(ref)
    if not sid:
        continue
    is_ws = not ref.startswith('orals-') and ref in ws_papers
    for p in plist:
        key = (p.get('en') or '').lower()
        if not key or (key, is_ws) in seen:
            continue
        seen.add((key, is_ws))
        rows.append([p['id'], sid, p.get('en', ''), p.get('ko', ''), p.get('authors', ''), p.get('inst', ''),
                     p.get('tag', ''), 1 if is_ws else 0, emb_row.get(p['id'], -1)])
        if not is_ws and p.get('abs'):
            txt = re.sub(r'<[^>]+>', ' ', p['abs'])
            emb_input.append([p['id'], L(p['en']) + '. ' + re.sub(r'\s+', ' ', txt).strip()])
os.makedirs(os.path.join(SITE, 'data', 'search'), exist_ok=True)
emb_meta = None
if emb_ids and os.path.exists('emb.bin'):
    import shutil
    shutil.copy('emb.bin', os.path.join(SITE, 'data', 'search', 'emb.bin'))
    emb_meta = {'file': 'data/search/emb.bin', 'dim': 384, 'n': len(emb_ids),
                'model': 'Xenova/bge-small-en-v1.5'}
write_js(os.path.join(SITE, 'data', 'search', 'index.js'), 'NIPS_INDEX', {'rows': rows, 'emb': emb_meta})
json.dump(emb_input, open('emb_input.json', 'w'), ensure_ascii=False)
print(f'search index rows {len(rows)} | embedding input {len(emb_input)} | embedded {len(emb_ids)}')
for sid, plist in paper_files.items():
    with open(os.path.join(SITE, 'data', 'papers', f's{sid}.js'), 'w') as f:
        f.write(f'window.NIPS_PAPERS["{sid}"] = ')
        json.dump(plist, f, ensure_ascii=False, separators=(',', ':'))
        f.write(f';window.dispatchEvent(new CustomEvent("papers-loaded",{{detail:"{sid}"}}));')

n_ev = sum(len(d['events']) for d in out_days)
allp = [p for v in paper_files.values() for p in v]
print(f'days {len(out_days)} | events {n_ev} | paper files {len(paper_files)} | paper rows {len(allp)}')
print(f'ko titles {sum(1 for p in allp if p.get("ko"))} | abstracts {sum(1 for p in allp if p.get("abs"))} '
      f'| ko abstracts {sum(1 for p in allp if p.get("absKo"))}')
print(f'event ko titles {sum(1 for d in out_days for e in d["events"] if e["title"].get("ko"))}/{n_ev}')
for d in out_days:
    print(' ', d['day'], d['note']['en'], len(d['events']))
