#!/usr/bin/env python3
import re
from pathlib import Path

path = Path('.github/review_fix_v2.py')
text = path.read_text(encoding='utf-8')
start = text.index('def mark_icon_helper_calls(source):')
end = text.index('\n\nBRIDGE = re.compile(', start)
replacement = r'''ICON_LITERAL_TOKENS = {
    "+", "＋", "×", "✕", "✖", "‹", "←", "›", "→", "✓", "✔",
    "⚙", "🔍", "⌕", "☰", "⋮", "✎", "✏", "🗑", "📋", "⧉", "▣",
    "?", "↵", "⇩", "▲", "▼", "📌", "⚑", "⚐", "🌐", "◎", "⊙", "⌗",
}


def first_call_argument(source, open_paren, close_paren):
    depth = 0
    quote = None
    esc = False
    i = open_paren + 1
    start = i
    while i < close_paren:
        ch = source[i]
        if quote:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == quote:
                quote = None
        else:
            if ch in ('"', "'"):
                quote = ch
            elif ch in '([{':
                depth += 1
            elif ch in ')]}':
                depth -= 1
            elif ch == ',' and depth == 0:
                return source[start:i].strip()
        i += 1
    return source[start:close_paren].strip()


def literal_icon_token(expr):
    expr = expr.strip()
    wrapped = re.match(r'^String\(\s*(.+?)\s*\)$', expr, re.S)
    if wrapped:
        expr = wrapped.group(1).strip()
    m = re.match(r'''^(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)')$''', expr, re.S)
    if not m:
        return None
    raw = m.group(1) if m.group(1) is not None else m.group(2)
    try:
        token = bytes(raw, 'utf-8').decode('unicode_escape') if '\\' in raw else raw
    except Exception:
        token = raw
    return token if token in ICON_LITERAL_TOKENS else None


def mark_icon_helper_calls(source):
    edits = []
    reasons = []
    function_list = functions(source)
    for call in re.finditer(r'\bmakeText\s*\(', source):
        open_paren = source.find('(', call.start())
        close = call_end(source, open_paren)
        inside = source[open_paren + 1:close]
        if re.search(r',\s*true\s*$', inside):
            continue
        owner = None
        for item in function_list:
            if item[2] < call.start() < item[3]:
                owner = item
        first = first_call_argument(source, open_paren, close)
        token = literal_icon_token(first)
        helper = owner[0] if owner else ''
        if token is None and not is_icon_helper(helper):
            continue
        edits.append(close)
        reasons.append((helper, token if token is not None else 'helper'))
    for pos in sorted(set(edits), reverse=True):
        source = source[:pos] + ', true' + source[pos:]
    return source, len(set(edits)), reasons
'''
path.write_text(text[:start] + replacement + text[end:], encoding='utf-8')
exec(compile(path.read_text(encoding='utf-8'), str(path), 'exec'), {'__name__': '__main__'})
