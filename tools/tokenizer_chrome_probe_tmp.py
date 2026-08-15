import base64, gzip, json, re
from pathlib import Path
p=Path('src/ch_17_tokenizer_ui.js')
s=p.read_text(encoding='utf-8')
m=re.search(r'\bvar\s+(?:PACKED_B64|encoded)\s*=\s*(.*?);',s,re.S)
assert m
parts=re.findall(r'"(?:\\.|[^"\\])*"',m.group(1))
source=gzip.decompress(base64.b64decode(''.join(json.loads(x) for x in parts))).decode('utf-8')

def extract(name):
    key='function '+name+'('
    i=source.find(key)
    print('\n===== '+name+' =====')
    if i<0:
        print('NOT FOUND'); return
    b=source.find('{',i); depth=0; j=b
    quote=None; esc=False
    while j<len(source):
        c=source[j]
        if quote:
            if esc: esc=False
            elif c=='\\': esc=True
            elif c==quote: quote=None
        else:
            if c in ('"',"'"): quote=c
            elif c=='{': depth+=1
            elif c=='}':
                depth-=1
                if depth==0:
                    print(source[i:j+1]); return
        j+=1
for n in ['layoutMetrics','buildDragHandle','buildHeader','buildPage','mountFromEditor','buildToolbar','makeToolbarCell','buildSegment','restoreEditorChildren']:
    extract(n)
print('\n===== MODULE =====')
for pat in ['MODULE_NAME: "ch_17_tokenizer_ui"','MODULE_VERSION:']:
    idx=source.find(pat)
    print(source[idx:idx+100] if idx>=0 else 'NOT FOUND')
