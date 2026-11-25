"""OpenReview dump -> per-paper review stats + codex summary input.

Input : work/openreview/raw_*.json (newest), collected in a logged-in browser from
        api2.openreview.net/notes?content.venueid=...&details=replies (public reviews).
Output: work/or_stats.json   {site_paper_id: {...scores, decision, area...}}
        work/tr_in_orsum.json {site_paper_id: condensed review text} for summarize_codex.py
"""
import glob
import json
import os
import re
import statistics as st

WORK = os.environ.get('WORK', os.path.join(os.path.dirname(__file__), '..', 'work'))
raw = json.load(open(sorted(glob.glob(os.path.join(WORK, 'openreview', 'raw_*.json')))[-1]))
papers = json.load(open(os.path.join(WORK, 'papers_main.json')))

fid = {}
for pid, p in papers.items():
    m = re.search(r'id=([\w-]+)', p.get('link') or '')
    if m:
        fid[m.group(1)] = pid


def num(v):
    if isinstance(v, (int, float)):
        return v
    m = re.match(r'\s*(\d+(\.\d+)?)', str(v or ''))
    return float(m.group(1)) if m else None


def clip(s, n):
    s = re.sub(r'\s+', ' ', str(s or '')).strip()
    return s if len(s) <= n else s[:n] + '…'


def rnd(x):
    return round(x, 2) if x is not None else None


stats, tr_in = {}, {}
for n in raw:
    pid = fid.get(n['id'])
    if not pid:
        continue
    reps = n['replies']
    revs = [r for r in reps if 'Official_Review' in r['inv']]
    dec = next((r['c'] for r in reps if 'Decision' in r['inv']), {})
    meta = next((r['c'] for r in reps if r['inv'].startswith('Meta_Review')), {})
    ratings = [num(r['c'].get('rating')) for r in revs]
    ratings = [x for x in ratings if x is not None]
    confs = [num(r['c'].get('confidence')) for r in revs]
    sub = {}
    for k in ('quality', 'clarity', 'significance', 'originality'):
        xs = [num(r['c'].get(k)) for r in revs]
        xs = [x for x in xs if x is not None]
        sub[k] = rnd(st.mean(xs)) if xs else None
    area = n['c'].get('primary_area')
    if isinstance(area, list):
        area = area[0] if area else None
    rec = {
        'or': n['id'], 'track': n['track'],
        'decision': dec.get('decision'),
        'area': area,
        'ratings': ratings,
        'avg': rnd(st.mean(ratings)) if ratings else None,
        'std': rnd(st.pstdev(ratings)) if len(ratings) > 1 else 0,
        'conf': rnd(st.mean([c for c in confs if c is not None])) if any(c is not None for c in confs) else None,
        'sub': sub,
        'n_rev': len(revs),
        'n_rebuttal': sum(1 for r in reps if 'Rebuttal' in r['inv']),
        'revised': sum(1 for r in revs if 'Review_Revision' in r['inv']),
    }
    stats[pid] = rec
    parts = []
    mr = meta.get('metareview') or dec.get('metareview') or dec.get('comment')
    if mr:
        parts.append('META-REVIEW: ' + clip(mr, 2200))
    for i, r in enumerate(revs, 1):
        c = r['c']
        sw = c.get('strengths_and_weaknesses') or ((c.get('strengths') or '') + ' ' + (c.get('weaknesses') or ''))
        fj = c.get('final_justification')
        parts.append(f'REVIEW {i} (rating {c.get("rating")}, confidence {c.get("confidence")}): ' + clip(sw, 1300)
                     + (' | FINAL: ' + clip(fj, 400) if fj else ''))
    if parts:
        tr_in[pid] = f'TITLE: {papers[pid]["title"]}\nDECISION: {rec["decision"]}\n' + '\n'.join(parts)

json.dump(stats, open(os.path.join(WORK, 'or_stats.json'), 'w'), ensure_ascii=False)
json.dump(tr_in, open(os.path.join(WORK, 'tr_in_orsum.json'), 'w'), ensure_ascii=False)
print('stats', len(stats), 'summary inputs', len(tr_in),
      'avg chars', int(sum(map(len, tr_in.values())) / max(1, len(tr_in))))
