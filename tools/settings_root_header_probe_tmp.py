import base64
import gzip
import json
import re
from pathlib import Path


def unpack(path):
    text = Path(path).read_text(encoding='utf-8')
    match = re.search(r'\bvar\s+(?:PACKED_B64|encoded)\s*=\s*(.*?);', text, re.S)
    pieces = re.findall(r'"(?:\\.|[^"\\])*"', match.group(1))
    return gzip.decompress(base64.b64decode(''.join(json.loads(p) for p in pieces))).decode('utf-8')


def function_span(source, name):
    match = re.search(r'(^|\n)([ \t]*)function\s+' + re.escape(name) + r'\s*\(', source, re.M)
    if match is None:
        raise RuntimeError(name)
    start = match.start(2)
    brace = source.find('{', match.end())
    depth = 0
    quote = None
    escaped = False
    line_comment = False
    block_comment = False
    index = brace
    while index < len(source):
        char = source[index]
        nxt = source[index + 1] if index + 1 < len(source) else ''
        if line_comment:
            if char == '\n': line_comment = False
        elif block_comment:
            if char == '*' and nxt == '/': block_comment = False; index += 1
        elif quote is not None:
            if escaped: escaped = False
            elif char == '\\': escaped = True
            elif char == quote: quote = None
        else:
            if char == '/' and nxt == '/': line_comment = True; index += 1
            elif char == '/' and nxt == '*': block_comment = True; index += 1
            elif char in ('"', "'"): quote = char
            elif char == '{': depth += 1
            elif char == '}':
                depth -= 1
                if depth == 0: return source[start:index + 1]
        index += 1
    raise RuntimeError('unterminated ' + name)

filter_source = unpack('src/ch_11_filter.js')
settings_source = unpack('src/ch_13_settings.js')
print('===== HOME makeIcon =====')
print(function_span(filter_source, 'makeIcon'))
print('\n===== HOME makeHeaderAction =====')
print(function_span(filter_source, 'makeHeaderAction'))
print('\n===== SETTINGS settingsLayoutMetrics =====')
print(function_span(settings_source, 'settingsLayoutMetrics'))
print('\n===== SETTINGS buildRootPage =====')
print(function_span(settings_source, 'buildRootPage'))
