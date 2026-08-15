import base64, gzip, hashlib, json, re
from pathlib import Path

ROOT = Path('.')

def unpack(path):
    text = path.read_text(encoding='utf-8')
    m = re.search(r'\bvar\s+(PACKED_B64|encoded)\s*=\s*(.*?);', text, re.S)
    if not m:
        return text
    pieces = re.findall(r'"(?:\\.|[^"\\])*"', m.group(2))
    packed = ''.join(json.loads(p) for p in pieces)
    src = gzip.decompress(base64.b64decode(packed)).decode('utf-8')
    sha = re.search(r'\bvar\s+SOURCE_SHA256\s*=\s*["\']([0-9a-fA-F]{64})["\']', text)
    if sha:
        actual = hashlib.sha256(src.encode('utf-8')).hexdigest()
        assert actual == sha.group(1).lower(), (path, actual, sha.group(1))
    return src

def extract_function(src, name):
    pat = re.compile(r'function\s+' + re.escape(name) + r'\s*\([^)]*\)\s*\{')
    m = pat.search(src)
    if not m:
        return None
    start = m.start()
    brace = src.find('{', m.start())
    depth = 0
    i = brace
    in_s = None
    esc = False
    while i < len(src):
        c = src[i]
        if in_s:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == in_s:
                in_s = None
        else:
            if c in ('"', "'"):
                in_s = c
            elif c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    return src[start:i+1]
        i += 1
    return src[start:start+5000]

def print_fn(label, src, names):
    print('\n===== ' + label + ' =====')
    for name in names:
        body = extract_function(src, name)
        print('\n--- ' + name + ' ---')
        if body:
            print(body[:14000])
        else:
            print('NOT FOUND')

files = {
    'HOME': unpack(ROOT/'src/ch_11_filter.js'),
    'EDITOR': unpack(ROOT/'src/ch_10_editor.js'),
    'DETAIL': unpack(ROOT/'src/ch_09_list.js'),
    'TRANSLATION': unpack(ROOT/'src/ch_12_translation.js'),
    'SETTINGS': unpack(ROOT/'src/ch_13_settings.js'),
    'TOKENIZER': unpack(ROOT/'src/ch_17_tokenizer_ui.js'),
}

print_fn('HOME', files['HOME'], [
    'headerMetrics','makeHeaderAction','buildHeader',
    'buildPrimaryChildHeader','mountPrimaryChildPage'
])
print_fn('EDITOR', files['EDITOR'], [
    'editorPalette','makeEditorPill','makeEditorAction',
    'buildTextContent','buildTagContent'
])
print_fn('DETAIL', files['DETAIL'], [
    'makePill','buildDetailView'
])
print_fn('TRANSLATION', files['TRANSLATION'], [
    'translationPalette','translationButton','translationOriginalViewportDp',
    'buildTranslationPanel'
])
print_fn('SETTINGS', files['SETTINGS'], [
    'settingsLayoutMetrics','buildRootPage','makeSettingsSubpageHeader',
    'buildRegexRulesPage','buildRegexEditorPage','buildRegexTestPage'
])
print_fn('TOKENIZER', files['TOKENIZER'], [
    'tokenizerPalette','tokenizerLayoutMetrics','buildTokenizerContent',
    'buildTokenizerPanel','bindEditorRoot','syncTokenizerShell'
])

print('\n===== TOKENIZER KEYWORD CONTEXT =====')
for pattern in ['setPadding(', 'dragHandle', 'actionSizeDp', 'headerTopOffsetDp', 'screenPaddingDp', 'embeddedInPrimary', 'bottom']:
    print('\n--', pattern, '--')
    for m in list(re.finditer(re.escape(pattern), files['TOKENIZER']))[:20]:
        a=max(0,m.start()-240); b=min(len(files['TOKENIZER']),m.start()+520)
        print(files['TOKENIZER'][a:b].replace('\n',' '))
        print()
