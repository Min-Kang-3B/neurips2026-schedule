"""Light normalization of author affiliations from the neurips.cc Downloads export.

The export lists authors as "Name (Affiliation), Name (Affiliation), ...". Affiliations are
free text from OpenReview profiles, so we strip department prefixes and merge common
spelling variants (with extra care for Korean institutions). Not exhaustive.
"""
import html
import re

DEPT = re.compile(r'^(the\s+)?(department|dept\.?|school|faculty|division|graduate school|college of|'
                  r'lab(oratory)? (of|for)|center (of|for)|centre (of|for)|institute for ai|ai center)\b', re.I)
GEO = {'korea', 'south korea', 'republic of korea', 'china', 'usa', 'us', 'united states', 'uk', 'japan',
       'beijing', 'shanghai', 'seoul', 'germany', 'france', 'canada', 'singapore', 'hong kong', 'india',
       'belgium', 'switzerland', 'australia', 'israel', 'taiwan', 'italy', 'spain', 'netherlands', 'hk'}

ALIASES = [
    (r'^(kaist( ai)?|korea advanced institute of science (and|&) technology)$', 'KAIST'),
    (r'^(postech|pohang university of science and technology)$', 'POSTECH'),
    (r'^seoul national univ(ersity|\.)?$', 'Seoul National University'),
    (r'^korea\.? univ(ersity|\.)?$', 'Korea University'),
    (r'^yonsei univ(ersity|\.)?$', 'Yonsei University'),
    (r'^hanyang univ(ersity|ersty|\.)?$', 'Hanyang University'),
    (r'^(skku|sungkyunkwan univ(ersity|\.)?)$', 'Sungkyunkwan University'),
    (r'^naver ai lab$', 'NAVER AI Lab'),
    (r'^naver$', 'NAVER'),
    (r'^samsung( electronics)?$', 'Samsung'),
    (r'^upstage( ai)?$', 'Upstage'),
    (r'^korea ai(si| safety institute)$', 'Korea AI Safety Institute'),
    (r'^shanghai jiao ?tong univ(ersity)?$', 'Shanghai Jiao Tong University'),
    (r'^(upenn|university of pennsylvania)$', 'University of Pennsylvania'),
    (r'^(mit|massachusetts institute of technology)$', 'MIT'),
    (r'^(cmu|carnegie mellon univ(ersity)?)$', 'Carnegie Mellon University'),
    (r'^(uc berkeley|berkeley|university of california,? berkeley)$', 'UC Berkeley'),
    (r'^(ucla|university of california,? los angeles)$', 'UCLA'),
    (r'^(ucsd|uc san diego|university of california,? san diego)$', 'UC San Diego'),
    (r'^(google )?deepmind$', 'Google DeepMind'),
    (r'^(google research|google inc\.?|google llc)$', 'Google'),
    (r'^(meta ai|meta platforms,? inc\.?|fair|meta fair|facebook( ai research)?)$', 'Meta'),
    (r'^(microsoft research( asia)?|microsoft corporation)$', 'Microsoft'),
    (r'^(nvidia corporation|nvidia research)$', 'NVIDIA'),
    (r'^(eth zurich|eth zürich|swiss federal institute of technology)$', 'ETH Zurich'),
    (r'^(epfl|epfl - epf lausanne|ecole polytechnique federale de lausanne)$', 'EPFL'),
    (r'^(nus|national university of singapore)$', 'National University of Singapore'),
    (r'^(ntu|nanyang technological univ(ersity)?)$', 'Nanyang Technological University'),
    (r'^(hkust|hong kong university of science and technology)$', 'HKUST'),
    (r'^(ustc|university of science and technology of china)$', 'USTC'),
    (r'^(cuhk|the chinese university of hong kong|chinese university of hong kong)$', 'CUHK'),
]
ALIASES = [(re.compile(p, re.I), v) for p, v in ALIASES]
CAMPUS = re.compile(r'University of California,\s*(Berkeley|Los Angeles|San Diego|Irvine|Davis|Santa Barbara|Santa Cruz|Riverside|Merced)', re.I)


def norm_one(aff):
    a = html.unescape(aff or '').strip()
    a = CAMPUS.sub(lambda m: 'University of California ' + m.group(1), a)
    if not a:
        return None
    segs = [s.strip() for s in a.split(',') if s.strip()]
    if len(segs) > 1:
        kept = [s for s in segs if not DEPT.match(s) and s.lower() not in GEO]
        segs = kept or segs
    name = re.sub(r'^the\s+', '', segs[0], flags=re.I).strip(' .')
    name = name.replace('University of California ', 'University of California, ')
    for rx, canon in ALIASES:
        if rx.match(name):
            return canon
    if name.islower():
        name = name.title()
    return name or None


def paper_institutions(authors_field, limit=8):
    """'A (X), B (Y / Z)' -> ['X', 'Y', 'Z'] (normalized, unique, in order)."""
    out = []
    for m in re.findall(r'\(([^()]*)\)', html.unescape(authors_field or '')):
        for part in re.split(r'\s*/\s*|;\s*', m):
            n = norm_one(part)
            if n and n not in out:
                out.append(n)
    return out[:limit]


def paper_authors(authors_field):
    s = re.sub(r'\s*\([^()]*\)', '', html.unescape(authors_field or ''))
    return ', '.join(a.strip() for a in s.split(',') if a.strip())
