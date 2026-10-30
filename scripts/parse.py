"""Turn raw neurips.cc pages into a normalized event list + translation inputs.

Run from the work dir after fetch.py:
  python scripts/parse.py
Writes:
  events.json        {loc: [event, ...]}  (absolute ISO times, venue-local)
  papers_main.json   {paper_id: {...}}    posters/orals/creative-AI pieces with abstracts
  ws_papers.json     {event_id: [paper, ...]}  workshop/competition accepted papers
  tr_in_*.json       translation inputs (only strings not yet in ko_*.json)

Time-zone note: neurips.cc renders EVERY location's calendar/listing/detail time in
Sydney time (AEDT, UTC+11). We parse those as Australia/Sydney and convert to the
venue's own zone (Atlanta = America/New_York, Paris = Europe/Paris).
"""
import json
import os
import re
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from bs4 import BeautifulSoup

YEAR = 2026
SRC_TZ = ZoneInfo('Australia/Sydney')
LOCS = {
    'sydney': ZoneInfo('Australia/Sydney'),
    'atlanta': ZoneInfo('America/New_York'),
    'paris': ZoneInfo('Europe/Paris'),
}
MON = {m: i + 1 for i, m in enumerate(
    ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'])}


def clean(s):
    return re.sub(r'\s+', ' ', s or '').strip()


# ---------------- time parsing ----------------
TIME_RE = r'(noon|midnight|\d{1,2}(?::\d{2})?\s*(?:[ap]\.?m\.?))'


def hm(s):
    s = s.lower().replace('.', '').replace(' ', '')
    if s == 'noon':
        return 12, 0
    if s == 'midnight':
        return 0, 0
    m = re.match(r'(\d{1,2})(?::(\d{2}))?(am|pm)', s)
    h, mi, ap = int(m.group(1)), int(m.group(2) or 0), m.group(3)
    if ap == 'pm' and h != 12:
        h += 12
    if ap == 'am' and h == 12:
        h = 0
    return h, mi


def find_date(s):
    """'Tue, Dec 8, 2026' / 'Tue 8 Dec' / 'Dec 11' -> (month, day)"""
    m = re.search(r'\b([A-Z][a-z]{2})\w*\.?\s+(\d{1,2})\b', s)        # Dec 8
    if m and m.group(1).lower() in MON:
        return MON[m.group(1).lower()], int(m.group(2)), m.end()
    m = re.search(r'\b(\d{1,2})\s+([A-Z][a-z]{2})\w*\b', s)           # 8 Dec
    if m and m.group(2).lower() in MON:
        return MON[m.group(2).lower()], int(m.group(1)), m.end()
    return None


def parse_when(s):
    """Any neurips.cc time line (in Sydney time) -> (start_dt, end_dt) aware datetimes."""
    if not s:
        return None, None
    d1 = find_date(s)
    if not d1:
        return None, None
    times = list(re.finditer(TIME_RE, s, re.I))
    if not times:
        return None, None
    mo, dy, _ = d1
    h, mi = hm(times[0].group(1))
    start = datetime(YEAR, mo, dy, h, mi, tzinfo=SRC_TZ)
    end = None
    if len(times) > 1:
        # explicit second date between the two times?
        between = s[times[0].end():times[1].start()]
        d2 = find_date(between)
        h2, m2 = hm(times[1].group(1))
        if d2:
            end = datetime(YEAR, d2[0], d2[1], h2, m2, tzinfo=SRC_TZ)
        else:
            end = datetime(YEAR, mo, dy, h2, m2, tzinfo=SRC_TZ)
            if end <= start:
                end += timedelta(days=1)
    return start, end


def day_header_date(hdr):
    """'TUE 8 DEC' -> (12, 8)"""
    m = re.search(r'(\d{1,2})\s+([A-Z]{3})', hdr.upper())
    return MON[m.group(2).lower()], int(m.group(1))


# ---------------- load ----------------
details = {}
for line in open('details.jsonl'):
    try:
        r = json.loads(line)
        details[r['url']] = r
    except Exception:
        pass
det_by_id = {r['id']: r for r in details.values()}
papers = json.load(open('raw/papers.json'))['results']

TYPE_FROM_CLASS = ['expo-talk-panel', 'expo-demonstration', 'expo-workshop', 'break', 'social',
                   'invited-talk', 'talk', 'reception', 'affinity-event', 'tutorial', 'town-hall',
                   'test-of-time', 'remarks', 'award', 'creative-ai', 'reproducibility-track',
                   'workshop', 'competition', 'registration-desk']


def ev_type(classes, title):
    for c in TYPE_FROM_CLASS:
        if c in classes:
            return c
    if 'Poster Session' in title:
        return 'poster-session'
    if 'Oral Session' in title:
        return 'oral-session'
    return 'session'


def slug_room(classes):
    for c in classes:
        if c.startswith('room-') and len(c) > 5:
            return c[5:].replace('-', ' ').title()
    return None


def to_local(dt, tz):
    return dt.astimezone(tz) if dt else None


events = defaultdict(dict)   # loc -> id -> event
cal_titles = {}              # child paper id -> title as shown in the calendar
for loc, tz in LOCS.items():
    soup = BeautifulSoup(open(f'raw/cal_{loc}.html').read(), 'lxml')
    for cont in soup.select('.container2'):
        mo, dy = day_header_date(clean(cont.select_one('.hdrbox').get_text()))
        for tb in cont.select('.timebox'):
            label = clean(tb.select_one('.time').get_text()) if tb.select_one('.time') else ''
            for div in tb.select('.pad'):
                classes = div.get('class', [])
                st = div.select_one('.sessiontitle a')
                a = st or div.select_one('.title-style a') or div.select_one('a[href]')
                if not a or not a.get('href'):
                    continue
                href = a['href'].split('?')[0]
                eid = href.rstrip('/').split('/')[-1]
                if st:
                    span = st.select_one('.sessiontime')
                    title = clean(st.get_text().replace(span.get_text(), '') if span else st.get_text())
                else:
                    title = clean(a.get_text())
                det = details.get(href, {})
                start, end = parse_when(det.get('when'))
                if not start:   # fallback: calendar timebox label (Sydney time)
                    try:
                        h, mi = hm(label)
                        start = datetime(YEAR, mo, dy, h, mi, tzinfo=SRC_TZ)
                    except Exception:
                        start = None
                    endtxt = clean(div.select_one('.end-time').get_text()) if div.select_one('.end-time') else ''
                    m = re.search(r'ends\s+' + TIME_RE, endtxt, re.I)
                    if start and m:
                        h2, m2 = hm(m.group(1))
                        end = start.replace(hour=h2, minute=m2)
                        if end <= start:
                            end += timedelta(days=1)
                sp = div.select_one('.speaker-style')
                ev = {
                    'id': eid, 'url': href, 'type': ev_type(classes, title), 'title': det.get('title') or title,
                    'start': to_local(start, tz), 'end': to_local(end, tz),
                    'room': det.get('room') or slug_room(classes),
                    'speaker': clean(sp.get_text()) if sp else None,
                    'organizers': det.get('organizers'),
                }
                kids = []
                for c in div.select('.content'):
                    ca = c.find('a', href=True)
                    if ca:
                        cid = ca['href'].split('?')[0].rstrip('/').split('/')[-1]
                        kids.append(cid)
                        cal_titles.setdefault(cid, clean(ca.get_text()) or clean(c.get_text()))
                if kids:
                    ev['children'] = kids
                events[loc][eid] = ev
    # listings: workshops, tutorials, competitions
    for kind in ['workshop', 'tutorial', 'competition']:
        f = f'raw/ev_{loc}_{kind}.html'
        if not os.path.exists(f):
            continue
        s2 = BeautifulSoup(open(f).read(), 'lxml')
        for card in s2.select('.event-card'):
            a = card.select_one('.event-title a')
            if not a:
                continue
            href = a['href']
            eid = card.get('data-event-id') or href.rstrip('/').split('/')[-1]
            det = details.get(href, {})
            pills = [clean(p.get_text()) for p in card.select('.meta-pill')]
            start, end = parse_when(det.get('when') or (pills[0] if pills else ''))
            ev = events[loc].get(eid, {})
            ev.update({
                'id': eid, 'url': href, 'type': kind,
                'title': det.get('title') or clean(a.get_text()),
                'start': ev.get('start') or to_local(start, tz), 'end': ev.get('end') or to_local(end, tz),
                'room': det.get('room') or (pills[1] if len(pills) > 1 else None) or ev.get('room'),
                'organizers': det.get('organizers') or clean(card.select_one('.event-speakers').get_text()) if card.select_one('.event-speakers') else det.get('organizers'),
            })
            events[loc][eid] = ev

# ---------------- papers ----------------
# main-track papers: posters (+ oral/spotlight tag), orals, creative-AI pieces
TAG = {'accept (oral)': 'Oral', 'accept (spotlight)': 'Spotlight'}
paper_by_id = {str(p['id']): p for p in papers}
oral_of_poster = {}
for p in papers:
    if p['eventtype'] == 'Oral':
        for rid in p.get('related_events_ids') or []:
            oral_of_poster[str(rid)] = str(p['id'])
# related-event links on detail pages: oral -> its poster (+ poster session), poster -> oral (+ oral session)
poster_sess_of_oral = {}
oral_session_members = defaultdict(list)   # oral session title -> oral paper ids
for d in details.values():
    for r in d.get('related') or []:
        if '/oral/' in d['url'] and r.get('kind') == 'Poster':
            oral_of_poster[r['id']] = d['id']
            if r.get('session'):
                poster_sess_of_oral[d['id']] = r['session']
        if '/poster/' in d['url'] and r.get('kind') == 'Oral':
            oral_of_poster[d['id']] = r['id']
            if r.get('session') and 'Oral' in r['session']:
                oral_session_members[r['session'].strip()].append(r['id'])

papers_main = {}


def paper_rec(pid, title=None):
    p = paper_by_id.get(pid)
    d = det_by_id.get(pid, {})
    rec = {'id': pid, 'title': (p or {}).get('name') or d.get('title') or title}
    if p:
        rec['authors'] = ', '.join(a['fullname'] for a in p.get('authors', []))
        if p.get('paper_url'):
            rec['link'] = p['paper_url']
        tag = TAG.get((p.get('decision') or '').lower())
        if pid in oral_of_poster:
            tag = 'Oral'
        if tag:
            rec['tag'] = tag
        if p.get('poster_position'):
            rec['pos'] = p['poster_position']
        rec['session'] = p.get('session') or ''
    else:
        if d.get('organizers'):
            rec['authors'] = d['organizers'].replace(' ⋅ ', ', ')
        for l in d.get('links') or []:
            if 'openreview' in l['url']:
                rec['link'] = l['url']
    if d.get('abstract_html'):
        rec['abs'] = d['abstract_html']
    if pid in poster_sess_of_oral:
        rec['psess'] = poster_sess_of_oral[pid]
    return rec


for p in papers:
    pid = str(p['id'])
    papers_main[pid] = paper_rec(pid)

# session title -> paper ids (posters, and orals once neurips.cc assigns them)
by_session = defaultdict(list)
for p in papers:
    if p.get('session'):
        by_session[p['session'].strip()].append(str(p['id']))

# orals listed per location (no session assignment published yet)
orals_by_loc = {}
for loc in LOCS:
    f = f'raw/ev_{loc}_oral.html'
    ids = []
    if os.path.exists(f):
        s2 = BeautifulSoup(open(f).read(), 'lxml')
        for card in s2.select('.event-card'):
            a = card.select_one('.event-title a')
            pid = card.get('data-event-id')
            if not pid or not a:
                continue
            if pid not in papers_main:
                papers_main[pid] = paper_rec(pid, clean(a.get_text()))
                papers_main[pid]['tag'] = 'Oral'
                if not papers_main[pid].get('authors') and card.select_one('.event-speakers'):
                    papers_main[pid]['authors'] = clean(card.select_one('.event-speakers').get_text()).replace(' ⋅ ', ', ')
            ids.append(pid)
    orals_by_loc[loc] = ids

for loc in LOCS:
    for ev in events[loc].values():
        if ev['type'] in ('poster-session', 'oral-session'):
            ids = []
            for cid in ev.pop('children', []) + by_session.get(ev['title'].strip(), []) \
                    + oral_session_members.get(ev['title'].strip(), []):
                if cid not in ids:
                    ids.append(cid)
                if cid not in papers_main:
                    papers_main[cid] = paper_rec(cid, cal_titles.get(cid))
            ids = [i for i in ids if papers_main[i].get('title')]
            rooms = Counter(paper_by_id[i]['room_name'] for i in ids if i in paper_by_id and paper_by_id[i].get('room_name'))
            if rooms:
                ev['room'] = rooms.most_common(1)[0][0]
            if ids:
                ev['paperIds'] = ids
            elif ev['type'] == 'oral-session':
                ev['oralPool'] = loc
        elif ev.get('children'):
            ids = []
            for cid in ev.pop('children'):
                if cid not in papers_main:
                    papers_main[cid] = paper_rec(cid, cal_titles.get(cid))
                if papers_main[cid].get('title'):
                    ids.append(cid)
            if ids:
                ev['paperIds'] = ids

# workshop / competition / tutorial inline schedules -> accepted papers + timed program
ws_papers = {}
ws_program = {}
for loc in LOCS:
    for ev in events[loc].values():
        d = details.get(ev['url'], {})
        rows = d.get('schedule') or []
        if not rows:
            continue
        plist, prog, seen = [], [], set()
        for r in rows:
            if r.get('time'):
                prog.append(r)
                continue
            key = (r.get('link') or r['title']).lower()
            if key in seen:
                continue
            seen.add(key)
            plist.append({k: v for k, v in {
                'id': r.get('id'), 'title': r['title'], 'authors': (r.get('authors') or '').replace(' ⋅ ', ', '),
                'link': r.get('link'), 'type': r.get('type'), 'abstract': r.get('abstract')}.items() if v})
        if plist:
            ws_papers[ev['id']] = plist
        if prog and ev.get('start'):
            # row times are Sydney clock times; anchor on the event's Sydney start, convert to venue time
            st_syd = ev['start'].astimezone(SRC_TZ)
            for r in prog:
                try:
                    h, mi = hm(r['time'])
                except Exception:
                    continue
                dt = st_syd.replace(hour=h, minute=mi)
                if dt < st_syd - timedelta(hours=2):
                    dt += timedelta(days=1)
                r['time'] = dt.astimezone(LOCS[loc]).strftime('%H:%M')
            ws_program[ev['id']] = prog


# ---------------- write ----------------
def ser(o):
    if isinstance(o, datetime):
        return o.isoformat()
    raise TypeError


out = {loc: sorted(evs.values(), key=lambda e: (e['start'] or datetime(YEAR, 1, 1, tzinfo=SRC_TZ)))
       for loc, evs in events.items()}
json.dump(out, open('events.json', 'w'), default=ser, ensure_ascii=False, indent=1)
json.dump(papers_main, open('papers_main.json', 'w'), ensure_ascii=False)
json.dump(ws_papers, open('ws_papers.json', 'w'), ensure_ascii=False)
json.dump(ws_program, open('ws_program.json', 'w'), ensure_ascii=False)
json.dump(orals_by_loc, open('orals_by_loc.json', 'w'), ensure_ascii=False)

# ---------------- translation inputs ----------------
def ko(name):
    return json.load(open(name)) if os.path.exists(name) else {}


def emit(job, src):
    done = ko(f'ko_{job}.json')
    todo = {k: v for k, v in src.items() if v and not done.get(k)}
    json.dump(src, open(f'tr_in_{job}.json', 'w'), ensure_ascii=False, indent=0)
    print(f'  tr {job}: {len(src)} strings, {len(todo)} untranslated')


used_papers = set()
for loc in LOCS:
    for ev in out[loc]:
        used_papers.update(ev.get('paperIds', []))
    used_papers.update(orals_by_loc[loc])
emit('titles', {pid: papers_main[pid]['title'] for pid in used_papers if papers_main.get(pid, {}).get('title')})
emit('pabs', {pid: papers_main[pid]['abs'] for pid in used_papers if papers_main.get(pid, {}).get('abs')})
misc = {}
for loc in LOCS:
    for ev in out[loc]:
        misc[f't:{ev["id"]}'] = ev['title']
for eid, rows in ws_program.items():
    for i, r in enumerate(rows):
        misc[f'p:{eid}:{i}'] = r['title']
emit('misc', misc)
emit('abstracts', {ev['id']: details[ev['url']]['abstract_html'] for loc in LOCS for ev in out[loc]
                   if details.get(ev['url'], {}).get('abstract_html')})
emit('wtitles', {(p.get('id') or f'{eid}:{i}'): p['title'] for eid, pl in ws_papers.items() for i, p in enumerate(pl)})

# ---------------- summary ----------------
for loc in LOCS:
    evs = out[loc]
    days = Counter(e['start'].strftime('%a %m-%d') for e in evs if e['start'])
    print(loc, len(evs), 'events', dict(sorted(days.items(), key=lambda x: x[0][4:])),
          '| no time:', sum(1 for e in evs if not e['start']))
    print('   types', dict(Counter(e['type'] for e in evs)))
print('papers_main', len(papers_main), '| with abstract', sum(1 for p in papers_main.values() if p.get('abs')))
print('workshop paper lists', len(ws_papers), sum(len(v) for v in ws_papers.values()), '| timed programs', len(ws_program))
print('orals by loc', {k: len(v) for k, v in orals_by_loc.items()})
