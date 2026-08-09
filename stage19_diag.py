import base64,gzip,pathlib,re
loader=pathlib.Path('src/ch_11_filter.js').read_text(encoding='utf-8')
if 'Stage 18 hydration overlap staged fill packed full Filter68 ES5 loader' not in loader:
    raise SystemExit('expected Filter68 packed loader')
m=re.search(r'var PACKED_B64 =\n((?:\s*"[A-Za-z0-9+/=]+"\s*\+?\n?)+);',loader)
if not m: raise SystemExit('PACKED_B64 missing')
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
for name in [
    'keyedReconcileVirtualWindow',
    'startStagedAjaxAttach',
    'finishAjaxAppendRender',
    'rebuildVirtualWindow',
    'deferVirtualUpdateDuringOverlapStagedFill',
    'runOverlapStagedFillBatch',
    'finishOverlapStagedFill',
    'resetVirtualState',
    'closePanel'
]:
    out.append('\n===== '+name+' =====\n'+function_block(name))

for needle in ['startStagedAjaxAttach(', 'ajax_append', 'signatureRebuildCount += 1', 'keyedReconcileVirtualWindow(range, colors)']:
    out.append('\n===== OCCURRENCES '+needle+' =====')
    pos=0; n=0
    while True:
        p=src.find(needle,pos)
        if p<0: break
        n+=1
        out.append('\n--- %d ---\n%s' % (n,src[max(0,p-1800):min(len(src),p+4200)]))
        pos=p+len(needle)
    if n==0: out.append('MISSING')
pathlib.Path('stage19_diag.txt').write_text('\n'.join(out),encoding='utf-8')
