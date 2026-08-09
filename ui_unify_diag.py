import base64,gzip,pathlib,re

loader=pathlib.Path('src/ch_11_filter.js').read_text(encoding='utf-8')
if 'PACKED_B64' not in loader:
    raise SystemExit('PACKED_B64 missing')
m=re.search(r'var PACKED_B64 =\n((?:\s*"[A-Za-z0-9+/=]+"\s*\+?\n?)+);',loader)
if not m:
    raise SystemExit('packed assignment missing')
packed=''.join(re.findall(r'"([A-Za-z0-9+/=]+)"',m.group(1)))
src=gzip.decompress(base64.b64decode(packed)).decode('utf-8')

def function_block(name):
    needle='    function '+name+'('
    p=src.find(needle)
    if p<0: return 'MISSING '+name
    e=src.find('\n    function ',p+len(needle))
    if e<0: e=min(len(src),p+30000)
    return src[p:e]

out=[]
out.append('FILTER_MODULE_LINE=' + next((x.strip() for x in src.splitlines() if 'MODULE_VERSION:' in x),'missing'))
for name in ['palette','headerMetrics','makeHeaderAction','createPanelCache','buildPanelContent','buildSearchHeader']:
    out.append('\n===== FUNCTION '+name+' =====\n'+function_block(name))
pathlib.Path('ui_unify_diag.txt').write_text('\n'.join(out),encoding='utf-8')
