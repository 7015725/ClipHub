import base64,gzip,pathlib,re

loader=pathlib.Path('src/ch_11_filter.js').read_text(encoding='utf-8')
if 'PACKED_B64' not in loader:
    raise SystemExit('PACKED_B64 missing')
m=re.search(r'var PACKED_B64 =\n((?:\s*"[A-Za-z0-9+/=]+"\s*\+?\n?)+);',loader)
if not m:
    raise SystemExit('packed assignment missing')
packed=''.join(re.findall(r'"([A-Za-z0-9+/=]+)"',m.group(1)))
src=gzip.decompress(base64.b64decode(packed)).decode('utf-8')

def function_block_at(pos):
    p=src.rfind('\n    function ',0,pos)
    if p<0: p=src.rfind('    function ',0,pos)
    if p<0: return src[max(0,pos-2500):min(len(src),pos+5000)]
    e=src.find('\n    function ',pos)
    if e<0: e=min(len(src),p+24000)
    return src[p:e]

out=[]
out.append('FILTER_MODULE_LINE=' + next((x.strip() for x in src.splitlines() if 'MODULE_VERSION:' in x),'missing'))
for needle in ['全局剪切板','dragHandle','handleRow','accentBorder','dp(42)','dp(4)','makeCloseButton','createPanelCache','buildPanel','header']:
    out.append('\n===== NEEDLE '+needle+' =====')
    pos=0; n=0; seen=set()
    while True:
        p=src.find(needle,pos)
        if p<0: break
        block=function_block_at(p)
        sig=block[:200]
        if sig not in seen:
            seen.add(sig); n+=1
            out.append('\n--- MATCH %d ---\n%s' % (n,block[:22000]))
        pos=p+len(needle)
        if n>=6: break
    if n==0: out.append('MISSING')
pathlib.Path('ui_unify_diag.txt').write_text('\n'.join(out),encoding='utf-8')
