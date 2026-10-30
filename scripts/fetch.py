"""Fetch everything public from neurips.cc/virtual/2026 for the schedule site.

Run from the work dir (default: <repo>/work):
  python scripts/fetch.py index     # calendars (3 locations), event listings, papers.json
  python scripts/fetch.py details   # every detail page -> details.jsonl (resume-safe)

Detail records are compact JSON (abstract html, time line, room, organizers, workshop
schedule rows) so the 9k+ poster pages are not kept as raw HTML.
"""
import concurrent.futures as cf
import json
import os
import re
import sys
import time

import requests
from bs4 import BeautifulSoup

BASE = 'https://neurips.cc'
YEAR = '2026'
LOCS = ['sydney', 'atlanta', 'paris']
KINDS = ['workshop', 'tutorial', 'competition', 'oral']
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/130 Safari/537.36')
WORK = os.environ.get('WORK', os.path.join(os.path.dirname(__file__), '..', 'work'))
RAW = os.path.join(WORK, 'raw')
PAGES = os.path.join(WORK, 'pages')   # raw html kept for non-paper events only
DETAILS = os.path.join(WORK, 'details.jsonl')

S = requests.Session()
S.headers['User-Agent'] = UA


def get(url, tries=4):
    for i in range(tries):
        try:
            r = S.get(url, timeout=60)
            if r.status_code == 200:
                return r.text
            if r.status_code == 404:
                return None
        except requests.RequestException:
            pass
        time.sleep(2 * (i + 1))
    return None


def clean(s):
    return re.sub(r'\s+', ' ', s or '').strip()


def index():
    os.makedirs(RAW, exist_ok=True)
    for loc in LOCS:
        html = get(f'{BASE}/virtual/{YEAR}/loc/{loc}/calendar')
        open(os.path.join(RAW, f'cal_{loc}.html'), 'w').write(html)
        for k in KINDS:
            html = get(f'{BASE}/virtual/{YEAR}/loc/{loc}/events/{k}')
            open(os.path.join(RAW, f'ev_{loc}_{k}.html'), 'w').write(html or '')
        print('index', loc, 'ok')
    js = get(f'{BASE}/static/virtual/data/neurips-{YEAR}-orals-posters.json')
    json.loads(js)  # validate
    open(os.path.join(RAW, 'papers.json'), 'w').write(js)
    print('papers.json', len(json.loads(js)['results']))
    export_posters()


def export_posters():
    """Downloads page export (JSON): every poster with 'Name (Affiliation)' author strings."""
    url = f'{BASE}/Downloads/{YEAR}'
    page = S.get(url, timeout=60).text
    tok = re.search(r'name="csrfmiddlewaretoken" value="([^"]+)"', page).group(1)
    r = S.post(url, data={'csrfmiddlewaretoken': tok, 'format': '5', 'posters': 'on',
                          'submitaction': 'Download Data'}, headers={'Referer': url}, timeout=600)
    data = r.json()
    json.dump(data, open(os.path.join(RAW, 'dl_posters.json'), 'w'), ensure_ascii=False)
    print('export posters', len(data))


# ---------------- detail URLs ----------------
def detail_urls():
    """(url, keep_html) for every event/paper the site shows."""
    urls = {}
    for loc in LOCS:
        soup = BeautifulSoup(open(os.path.join(RAW, f'cal_{loc}.html')).read(), 'lxml')
        for a in soup.select('.container2 a[href]'):
            href = a['href'].split('?')[0].split('#')[0]
            if not re.match(rf'^/virtual/{YEAR}/', href) or not re.search(r'/\d+$', href):
                continue
            is_paper = '/poster/' in href or '/oral/' in href
            urls.setdefault(href, not is_paper)
        for k in KINDS:
            f = os.path.join(RAW, f'ev_{loc}_{k}.html')
            if not os.path.exists(f):
                continue
            s2 = BeautifulSoup(open(f).read(), 'lxml')
            for a in s2.select('.event-card .event-title a[href]'):
                urls.setdefault(a['href'], k != 'oral')
    for r in json.load(open(os.path.join(RAW, 'papers.json')))['results']:
        if r.get('virtualsite_url'):
            urls.setdefault(r['virtualsite_url'], False)
    return urls


def parse_detail(url, html):
    soup = BeautifulSoup(html, 'lxml')
    rec = {'url': url, 'id': url.rstrip('/').split('/')[-1]}
    hero = soup.select_one('.hero-card')
    if hero:
        badge = hero.select_one('.event-type-badge')
        rec['badge'] = clean(badge.get_text()) if badge else None
        pills = [clean(p.get_text()) for p in hero.select('.meta-row .meta-pill')]
        rec['when'] = next((p for p in pills if '•' in p), None)
        rest = [p for p in pills if '•' not in p and p]
        rec['room'] = rest[0] if rest else None
        t = hero.select_one('.event-title')
        rec['title'] = clean(t.get_text()) if t else None
        org = hero.select_one('.event-organizers')
        rec['organizers'] = clean(org.get_text()) if org else None
        links = []
        for a in hero.select('.action-buttons a[href]'):
            lbl = clean(a.get_text())
            if a['href'].startswith('http') and lbl:
                links.append({'label': lbl, 'url': a['href']})
        rec['links'] = links
    else:  # old-style session page
        h2 = soup.select_one('.card-title')
        rec['title'] = clean(h2.get_text()) if h2 else None
        m = soup.find(string=re.compile(r'(a\.m\.|p\.m\.)\s*AEDT'))
        if m:
            rec['when'] = clean(m.parent.get_text())
    ab = soup.select_one('.abstract-text-inner')
    if ab:
        rec['abstract_html'] = ab.decode_contents().strip()
    # related events: "<a>Poster</a> presentation: <a>Sydney Poster Session 5</a>"
    rel = []
    for it in soup.select('.related-event-item'):
        links = it.select('a[href]')
        if not links:
            continue
        r = {'kind': clean(links[0].get_text()), 'id': links[0]['href'].rstrip('/').split('/')[-1]}
        if len(links) > 1:
            r['session'] = clean(links[1].get_text())
            r['session_id'] = links[1]['href'].rstrip('/').split('/')[-1]
        rel.append(r)
    if rel:
        rec['related'] = rel
    # inline schedule (workshops, tutorials, creative AI ...)
    rows = []
    for tr in soup.select('tr.schedule-row'):
        a = tr.select_one('.schedule-event-name a')
        typ = tr.select_one('.schedule-event-type')
        tm = tr.select_one('.schedule-time')
        au = tr.select_one('.schedule-authors')
        lk = tr.select_one('.schedule-abstract-link a[href]')
        abs_el = tr.select_one('.schedule-abstract')
        row = {
            'id': (a['href'].rstrip('/').split('/')[-1] if a and a.get('href') else None),
            'title': clean(a.get_text()) if a else clean(tr.get_text())[:300],
            'type': clean(typ.get_text()) if typ else '',
            'time': clean(tm.get_text()) if tm else '',
            'authors': re.sub(r'(\s*⋅\s*)+', ' ⋅ ', clean(au.get_text())).strip(' ⋅') if au else '',
            'link': lk['href'] if lk else None,
        }
        if abs_el:
            txt = abs_el.get_text(' ').replace('Link', '')
            if len(clean(txt)) > 40:
                row['abstract'] = clean(txt)
        rows.append(row)
    if rows:
        rec['schedule'] = rows
    return rec


def details(workers=8):
    os.makedirs(PAGES, exist_ok=True)
    done = set()
    if os.path.exists(DETAILS):
        for line in open(DETAILS):
            try:
                done.add(json.loads(line)['url'])
            except Exception:
                pass
    urls = detail_urls()
    todo = [(u, k) for u, k in urls.items() if u not in done]
    print(f'detail urls: {len(urls)}, done: {len(done)}, todo: {len(todo)}', flush=True)
    out = open(DETAILS, 'a')

    def work(item):
        u, keep = item
        html = get(BASE + u)
        if html is None:
            return None
        if keep:
            fn = re.sub(r'[^\w]+', '_', u.strip('/')) + '.html'
            open(os.path.join(PAGES, fn), 'w').write(html)
        return parse_detail(u, html)

    n = 0
    with cf.ThreadPoolExecutor(workers) as ex:
        for rec in ex.map(work, todo):
            n += 1
            if rec:
                out.write(json.dumps(rec, ensure_ascii=False) + '\n')
            if n % 250 == 0:
                out.flush()
                print(f'  {n}/{len(todo)}', flush=True)
    out.close()
    print('details done', n)


if __name__ == '__main__':
    step = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if step == 'export':
        export_posters()
    if step in ('index', 'all'):
        index()
    if step in ('details', 'all'):
        details()
