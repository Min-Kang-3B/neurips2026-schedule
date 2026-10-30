"""Convert the LaTeX that authors put in paper titles into plain Unicode text.

  'R$^2$E'                      -> 'R²E'
  '$\\epsilon$-Good'            -> 'ε-Good'
  '$\\tilde{O}(\\sqrt{dT})$'    -> 'Õ(√(dT))'
  'Schr\\"odinger'              -> 'Schrödinger'
  'Encoder\\\\for'              -> 'Encoder for'
"""
import re

GREEK = {
    'alpha': 'α', 'beta': 'β', 'gamma': 'γ', 'delta': 'δ', 'epsilon': 'ε', 'varepsilon': 'ε', 'zeta': 'ζ',
    'eta': 'η', 'theta': 'θ', 'vartheta': 'ϑ', 'iota': 'ι', 'kappa': 'κ', 'lambda': 'λ', 'mu': 'μ', 'nu': 'ν',
    'xi': 'ξ', 'pi': 'π', 'rho': 'ρ', 'sigma': 'σ', 'tau': 'τ', 'upsilon': 'υ', 'phi': 'ϕ', 'varphi': 'φ',
    'chi': 'χ', 'psi': 'ψ', 'omega': 'ω', 'Gamma': 'Γ', 'Delta': 'Δ', 'Theta': 'Θ', 'Lambda': 'Λ', 'Xi': 'Ξ',
    'Pi': 'Π', 'Sigma': 'Σ', 'Phi': 'Φ', 'Psi': 'Ψ', 'Omega': 'Ω',
}
SYMBOLS = {
    'ell': 'ℓ', 'infty': '∞', 'pm': '±', 'mp': '∓', 'times': '×', 'cdot': '·', 'circ': '°', 'star': '⋆',
    'leq': '≤', 'le': '≤', 'geq': '≥', 'ge': '≥', 'neq': '≠', 'approx': '≈', 'sim': '∼', 'to': '→',
    'rightarrow': '→', 'leftarrow': '←', 'in': '∈', 'partial': '∂', 'nabla': '∇', 'sum': '∑', 'prod': '∏',
    'log': 'log', 'min': 'min', 'max': 'max', 'exp': 'exp', 'sin': 'sin', 'cos': 'cos', 'ldots': '…',
    'dots': '…', 'cdots': '⋯', 'mid': '|', 'vert': '|', 'emptyset': '∅', 'forall': '∀', 'exists': '∃',
    '&': '&', '%': '%', '_': '_', '#': '#', '$': '$', '{': '{', '}': '}', ' ': ' ', ',': ' ', ';': ' ', '!': '',
}
SUP = dict(zip('0123456789+-=()nijkKTtpx*', '⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾ⁿⁱʲᵏᴷᵀᵗᵖˣ*'))
SUP.update({'⋆': '⋆', '°': '°', '∗': '*'})
SUB = dict(zip('0123456789+-=()aeijklmnoprstux', '₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎ₐₑᵢⱼₖₗₘₙₒₚᵣₛₜᵤₓ'))
CAL = dict(zip('ABCDEFGHIJKLMNOPQRSTUVWXYZ', '𝒜ℬ𝒞𝒟ℰℱ𝒢ℋℐ𝒥𝒦ℒℳ𝒩𝒪𝒫𝒬ℛ𝒮𝒯𝒰𝒱𝒲𝒳𝒴𝒵'))
BB = dict(zip('CNPQRZE', 'ℂℕℙℚℝℤ𝔼'))
ACCENT = {'"': '\u0308', "'": '\u0301', '`': '\u0300', '^': '\u0302', '~': '\u0303', '=': '\u0304', 'c': '\u0327', 'v': '\u030c'}
WRAPPERS = ('text', 'textbf', 'textit', 'texttt', 'textrm', 'textsf', 'emph', 'mathrm', 'mathbf', 'mathit',
            'mathtt', 'mathsf', 'boldsymbol', 'bm', 'mbox', 'operatorname', 'textsc', 'underline')


def _group(s, i):
    """Return (content, next_index) for a {...} group or single token starting at s[i]."""
    if i >= len(s):
        return '', i
    if s[i] == '{':
        depth, j = 0, i
        while j < len(s):
            if s[j] == '{':
                depth += 1
            elif s[j] == '}':
                depth -= 1
                if depth == 0:
                    return s[i + 1:j], j + 1
            j += 1
        return s[i + 1:], len(s)
    if s[i] == '\\':
        m = re.match(r'\\([A-Za-z]+|.)', s[i:])
        return m.group(0), i + len(m.group(0))
    return s[i], i + 1


def _script(content, table, mark):
    inner = _math(content)
    if inner and all(c in table for c in inner):
        return ''.join(table[c] for c in inner)
    if len(inner) == 1:
        return mark + inner
    return mark + '(' + inner + ')'


def _math(s):
    out, i = [], 0
    while i < len(s):
        c = s[i]
        if c == '\\':
            m = re.match(r'\\([A-Za-z]+|.)', s[i:])
            name = m.group(1)
            i += len(m.group(0))
            if name in GREEK:
                out.append(GREEK[name])
            elif name in WRAPPERS:
                g, i = _group(s, _skip_ws(s, i))
                text_mode = name.startswith('text') or name in ('mbox', 'emph', 'operatorname')
                out.append(_text(g) if text_mode else _math(g))
            elif name == 'mathcal' or name == 'mathscr':
                g, i = _group(s, _skip_ws(s, i))
                out.append(''.join(CAL.get(ch, ch) for ch in _math(g)))
            elif name == 'mathbb':
                g, i = _group(s, _skip_ws(s, i))
                out.append(''.join(BB.get(ch, ch) for ch in _math(g)))
            elif name == 'sqrt':
                g, i = _group(s, _skip_ws(s, i))
                inner = _math(g)
                out.append('√' + (inner if len(inner) == 1 else '(' + inner + ')'))
            elif name in ('tilde', 'widetilde'):
                g, i = _group(s, _skip_ws(s, i))
                out.append(_math(g) + '\u0303')
            elif name in ('hat', 'widehat'):
                g, i = _group(s, _skip_ws(s, i))
                out.append(_math(g) + '\u0302')
            elif name in ('bar', 'overline'):
                g, i = _group(s, _skip_ws(s, i))
                out.append(_math(g) + '\u0304')
            elif name == 'frac':
                a, i = _group(s, _skip_ws(s, i))
                b, i = _group(s, _skip_ws(s, i))
                out.append(_math(a) + '/' + _math(b))
            elif name in ('left', 'right', 'big', 'Big', 'displaystyle'):
                pass
            elif name in SYMBOLS:
                out.append(SYMBOLS[name])
            else:
                out.append(name)
        elif c == '^':
            g, i = _group(s, i + 1)
            out.append(_script(g, SUP, '^'))
        elif c == '_':
            g, i = _group(s, i + 1)
            out.append(_script(g, SUB, '_'))
        elif c in '{} ':   # braces vanish; spaces are insignificant in math mode
            i += 1
        else:
            out.append(c)
            i += 1
    return ''.join(out)


def _skip_ws(s, i):
    while i < len(s) and s[i] == ' ':
        i += 1
    return i


def _text(s):
    """Text-mode LaTeX: accents, wrappers, escapes."""
    out, i = [], 0
    while i < len(s):
        c = s[i]
        if c == '\\' and i + 1 < len(s):
            nxt = s[i + 1]
            if nxt == '\\':
                out.append(' ')
                i += 2
                continue
            if nxt in ACCENT and (i + 2 < len(s)) and not (nxt == '~' and s[i + 2] == ' '):
                g, j = _group(s, i + 2)
                if len(g) == 1:
                    import unicodedata
                    out.append(unicodedata.normalize('NFC', g + ACCENT[nxt]))
                    i = j
                    continue
            m = re.match(r'\\([A-Za-z]+|.)', s[i:])
            name = m.group(1)
            i += len(m.group(0))
            if name in WRAPPERS:
                g, i = _group(s, _skip_ws(s, i))
                out.append(_text(g))
            elif name == 'textsuperscript':
                g, i = _group(s, i)
                out.append(_script(g, SUP, '^'))
            elif name == 'textsubscript':
                g, i = _group(s, i)
                out.append(_script(g, SUB, '_'))
            elif name in SYMBOLS:
                out.append(SYMBOLS[name])
            elif name in GREEK:
                out.append(GREEK[name])
            else:
                out.append(name)
        elif c in '{}':
            i += 1
        else:
            out.append(c)
            i += 1
    return ''.join(out)


def latex_to_text(s):
    if not s or ('$' not in s and '\\' not in s and '--' not in s):
        return s
    t = s
    # \texorpdfstring{tex}{pdf} -> pdf ; stray \workshoptitle{...} template residue
    t = re.sub(r'\\texorpdfstring\{((?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*)\}\{[^{}]*\}', r'\1', t)
    t = re.sub(r'\}?\s*\\workshoptitle\{.*$', '', t)
    # math segments: $$..$$, $..$, \(..\)
    t = re.sub(r'\$\$(.+?)\$\$', lambda m: _math(m.group(1)), t)
    t = re.sub(r'(?<!\\)\$(.+?)(?<!\\)\$', lambda m: _math(m.group(1)), t)
    t = re.sub(r'\\\((.+?)\\\)', lambda m: _math(m.group(1)), t)
    t = _text(t)
    t = t.replace('---', '—').replace('--', '–')
    t = re.sub(r'\s+', ' ', t).strip()
    t = re.sub(r'\s+([,:;.?!])', r'\1', t)
    return t


if __name__ == '__main__':
    import json
    import sys
    for f in sys.argv[1:]:
        for k, v in json.load(open(f)).items():
            if '$' in v or '\\' in v:
                print(f'{v}\n   -> {latex_to_text(v)}')
