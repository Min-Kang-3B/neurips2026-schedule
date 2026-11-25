"""Structured summaries via codex exec (parallel, resume-safe).

Usage (from work/):  python3 ../scripts/summarize_codex.py <job> [limit]
  orsum   : tr_in_orsum.json (id -> condensed OpenReview reviews)  -> sum_orsum.json
  poster  : posters_webp/<id>.webp (attached as images)              -> sum_poster.json
Env: SUM_WORKERS (8), SUM_MODEL (gpt-6-luna), SUM_BATCH.
"""
import json
import os
import re
import subprocess
import sys
import tempfile
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

JOB = sys.argv[1]
LIMIT = int(sys.argv[2]) if len(sys.argv) > 2 else None
OUT = f'sum_{JOB}.json'
WORKERS = int(os.environ.get('SUM_WORKERS', '8'))
MODEL = os.environ.get('SUM_MODEL', 'gpt-6-luna')

PROMPTS = {
    'orsum': (
        'You summarize public NeurIPS 2026 peer reviews for Korean ML researchers browsing the conference. '
        'For each paper id below you get the meta-review and reviewer strengths/weaknesses. Return for each id an object:\n'
        '{"one": one-sentence Korean verdict of how reviewers saw the paper (<=90 chars), '
        '"pros": up to 3 short Korean strengths reviewers agreed on, '
        '"cons": up to 3 short Korean weaknesses/concerns, '
        '"debate": one short Korean sentence on the main point of disagreement or what the rebuttal resolved, or "" if none}.\n'
        'Be faithful to the reviews; do not invent results. Keep method/model/benchmark names and acronyms in English. '
        'Return ONLY a valid JSON object mapping each id to its object. No markdown fences, no commentary.'
    ),
    'poster': (
        'The attached images are NeurIPS 2026 conference posters, in the same order as the ids listed below. '
        'Read each poster and return for each id an object:\n'
        '{"tldr_ko": one-sentence Korean takeaway (<=100 chars), "tldr_en": the same in English, '
        '"problem": Korean, 1 sentence, "method": Korean, 1-2 sentences, '
        '"results": up to 4 short strings with the key quantitative results exactly as printed (numbers, benchmarks, baselines), '
        '"datasets": list of datasets/benchmarks named, "code": code/project URL printed on the poster or ""}.\n'
        'Only report what is visible on the poster; if text is unreadable leave the field empty rather than guessing. '
        'Keep method/model/benchmark names in English. '
        'Return ONLY a valid JSON object mapping each id to its object. No markdown fences, no commentary.'
    ),
}
BATCH = int(os.environ.get('SUM_BATCH', {'orsum': 6, 'poster': 4}[JOB]))

if JOB == 'orsum':
    src = json.load(open('tr_in_orsum.json'))
else:
    src = {f[:-5]: os.path.abspath(os.path.join('posters_webp', f))
           for f in os.listdir('posters_webp') if f.endswith('.webp')}
done = json.load(open(OUT)) if os.path.exists(OUT) else {}
todo = sorted(k for k in src if k not in done)
if LIMIT:
    todo = todo[:LIMIT]
batches = [todo[i:i + BATCH] for i in range(0, len(todo), BATCH)]
print(f'{JOB}: {len(src)} total, {len(done)} done, {len(todo)} todo in {len(batches)} batches', flush=True)
lock = threading.Lock()


def valid(o):
    if not isinstance(o, dict):
        return False
    if JOB == 'orsum':
        return isinstance(o.get('one'), str) and re.search(r'[가-힯]', o['one'])
    return isinstance(o.get('tldr_ko'), str) and o['tldr_ko'].strip()


def run(ids, tries=3):
    if JOB == 'orsum':
        prompt = PROMPTS[JOB] + '\n\n' + json.dumps({k: src[k] for k in ids}, ensure_ascii=False)
        imgs = []
    else:
        prompt = PROMPTS[JOB] + '\n\nids in image order: ' + json.dumps(ids)
        imgs = [src[k] for k in ids]
    for attempt in range(tries):
        fd, outpath = tempfile.mkstemp(suffix='.txt'); os.close(fd)
        try:
            cmd = ['codex', 'exec', '-m', MODEL, '-s', 'read-only', '--skip-git-repo-check',
                   '-c', 'model_reasoning_effort="low"', '-o', outpath]
            for im in imgs:
                cmd += ['-i', im]
            cmd += ['-']
            subprocess.run(cmd, input=prompt, capture_output=True, text=True, timeout=2400)
            raw = re.sub(r'^```(json)?|```$', '', open(outpath).read().strip(), flags=re.M).strip()
            m = re.search(r'\{.*\}', raw, re.S)
            res = json.loads(m.group(0)) if m else {}
            ok = {k: res[k] for k in ids if valid(res.get(k))}
            if len(ok) < len(ids) * 0.7 and attempt < tries - 1:
                raise ValueError(f'{len(ok)}/{len(ids)} valid')
            return ok
        except Exception as e:
            if attempt == tries - 1:
                print('BATCH FAIL', ids[:2], e, flush=True)
        finally:
            try: os.unlink(outpath)
            except OSError: pass
    return {}


n = 0
with ThreadPoolExecutor(WORKERS) as ex:
    for f in as_completed([ex.submit(run, b) for b in batches]):
        with lock:
            done.update(f.result()); n += 1
            json.dump(done, open(OUT, 'w'), ensure_ascii=False)
            print(f'batch {n}/{len(batches)} total {len(done)}/{len(src)}', flush=True)
print('FINISHED', JOB, len(done), '/', len(src), flush=True)
