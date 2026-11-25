"""Poster images from neurips.cc -> compact WebP.

Run from the work dir with the venv python (needs Pillow with WebP):
  python ../scripts/posters.py list            # re-read session pages -> posters_index.json {paper_id: stamp}
  python ../scripts/posters.py pages           # same from every paper's poster page (session pages are login-only now)
  python ../scripts/posters.py fetch [N]       # download new/changed PNGs, convert, drop the PNG (resume-safe)
  python ../scripts/posters.py site            # 1400px copies for the public posters repo (posters_site/)

neurips.cc serves posters as /media/PosterPDFs/NeurIPS 2026/<paper_id>.png?t=<stamp> (~5 MB each).
We keep only a WebP (long edge MAX_EDGE px) in posters_webp/, plus posters_done.json {id: stamp}
so a re-uploaded poster (new stamp) is fetched again.
"""
import concurrent.futures as cf
import io
import json
import os
import re
import sys
import threading
import time

import requests
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
WORK = os.environ.get('WORK', os.path.join(os.path.dirname(__file__), '..', 'work'))
PAGES = os.path.join(WORK, 'pages')
OUT = os.path.join(WORK, 'posters_webp')
INDEX = os.path.join(WORK, 'posters_index.json')
DONE = os.path.join(WORK, 'posters_done.json')
BASE = 'https://neurips.cc'
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/130 Safari/537.36')
MAX_EDGE = int(os.environ.get('MAX_EDGE', 2000))
QUALITY = int(os.environ.get('QUALITY', 70))
S = requests.Session()
S.headers['User-Agent'] = UA
PAT = re.compile(r'PosterPDFs/NeurIPS%202026/(\d+)\.png\?t=([\d.]+)')


def get(url, binary=False, tries=4):
    for i in range(tries):
        try:
            r = S.get(url, timeout=120)
            if r.status_code == 200:
                return r.content if binary else r.text
            if r.status_code == 404:
                return None
        except requests.RequestException:
            pass
        time.sleep(3 * (i + 1))
    return None


def list_posters():
    sids = sorted({m.group(2) for f in os.listdir(PAGES)
                   for m in [re.match(r'virtual_2026_(affinity_poster_)?session_(\d+)\.html$', f)] if m})
    idx = json.load(open(INDEX)) if os.path.exists(INDEX) else {}  # merge, never shrink
    for sid in sids:
        kind = 'session'
        html = get(f'{BASE}/virtual/2026/session/{sid}')
        if html is None:
            html = get(f'{BASE}/virtual/2026/affinity_poster_session/{sid}')
            kind = 'affinity'
        if not html:
            print('miss', sid); continue
        for pid, t in PAT.findall(html):
            idx[pid] = t
        print(kind, sid, len(idx), flush=True)
        time.sleep(0.5)
    json.dump(idx, open(INDEX, 'w'))
    print('posters', len(idx))


def list_from_pages(workers=6):
    """Session pages went login-only (2026-11-25); each paper's poster page still carries the image URL."""
    papers = json.load(open(os.path.join(WORK, 'papers_main.json')))
    idx = json.load(open(INDEX)) if os.path.exists(INDEX) else {}
    ids = sorted(papers)
    lock = threading.Lock()
    cnt = {'n': 0, 'new': 0}

    def work(pid):
        html = get(f'{BASE}/virtual/2026/poster/{pid}')
        m = PAT.search(html or '')
        with lock:
            cnt['n'] += 1
            if m and idx.get(m.group(1)) != m.group(2):
                idx[m.group(1)] = m.group(2); cnt['new'] += 1
            if cnt['n'] % 500 == 0:
                json.dump(idx, open(INDEX, 'w'))
                print(cnt['n'], 'checked | new/changed', cnt['new'], '| posters', len(idx), flush=True)

    with cf.ThreadPoolExecutor(workers) as ex:
        list(ex.map(work, ids))
    json.dump(idx, open(INDEX, 'w'))
    print('posters', len(idx), 'new/changed', cnt['new'], flush=True)


def fetch(limit=None, workers=4):
    os.makedirs(OUT, exist_ok=True)
    idx = json.load(open(INDEX))
    done = json.load(open(DONE)) if os.path.exists(DONE) else {}
    todo = [pid for pid, t in idx.items() if done.get(pid) != t]
    if limit:
        todo = todo[:limit]
    print('todo', len(todo), 'of', len(idx), flush=True)
    lock = threading.Lock()
    stats = {'n': 0, 'png': 0, 'webp': 0, 'fail': 0}

    def work(pid):
        data = get(f'{BASE}/media/PosterPDFs/NeurIPS%202026/{pid}.png?t={idx[pid]}', binary=True)
        if not data:
            with lock: stats['fail'] += 1
            return
        try:
            im = Image.open(io.BytesIO(data))
            im = im.convert('RGBA' if im.mode in ('RGBA', 'LA', 'P') else 'RGB')
            if im.mode == 'RGBA':
                bg = Image.new('RGB', im.size, 'white'); bg.paste(im, mask=im.split()[3]); im = bg
            im.thumbnail((MAX_EDGE, MAX_EDGE), Image.LANCZOS)
            buf = io.BytesIO()
            im.save(buf, 'WEBP', quality=QUALITY, method=5)
        except Exception as e:  # corrupt / odd file
            print('bad', pid, e, flush=True)
            with lock: stats['fail'] += 1
            return
        open(os.path.join(OUT, pid + '.webp'), 'wb').write(buf.getvalue())
        with lock:
            done[pid] = idx[pid]
            stats['n'] += 1; stats['png'] += len(data); stats['webp'] += buf.tell()
            if stats['n'] % 50 == 0:
                json.dump(done, open(DONE, 'w'))
                print(stats['n'], 'png %.0fMB webp %.0fMB fail %d' % (stats['png'] / 1e6, stats['webp'] / 1e6, stats['fail']), flush=True)

    with cf.ThreadPoolExecutor(workers) as ex:
        list(ex.map(work, todo))
    json.dump(done, open(DONE, 'w'))
    print('done', stats, flush=True)


def site(edge=1400, quality=68):
    """posters_webp/ (2000px) -> posters_site/ (smaller, for the public posters repo); only new/changed."""
    dst = os.path.join(WORK, 'posters_site')
    os.makedirs(dst, exist_ok=True)
    n = 0
    for f in sorted(os.listdir(OUT)):
        src, out = os.path.join(OUT, f), os.path.join(dst, f)
        if os.path.getsize(src) < 2000:  # empty placeholder uploads
            continue
        if os.path.exists(out) and os.path.getmtime(out) >= os.path.getmtime(src):
            continue
        im = Image.open(src)
        im.thumbnail((edge, edge), Image.LANCZOS)
        im.save(out, 'WEBP', quality=quality, method=4)
        n += 1
    print('site posters written', n, 'total', len(os.listdir(dst)))


if __name__ == '__main__':
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    if cmd == 'list':
        list_posters()
    elif cmd == 'pages':
        list_from_pages()
    elif cmd == 'site':
        site()
    elif cmd == 'fetch':
        fetch(int(sys.argv[2]) if len(sys.argv) > 2 else None)
    else:
        print(__doc__)
