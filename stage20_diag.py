import base64,gzip,pathlib,re
loader=pathlib.Path('src/ch_11_filter.js').read_text(encoding='utf-8')
if 'Stage 19 keyed staged reconcile and AJAX fallback packed full Filter69 ES5 loader' not in loader:
    raise SystemExit('expected Filter69 packed loader')
m=re.search(r'var PACKED_B64 =\n((?:\s*"[A-Za-z0-9+/=]+"\s*\+?\n?)+);',loader)
if not m: raise SystemExit('PACKED_B64 missing')
packed=''.join(re.findall(r'"([A-Za-z0-9+/=]+)"',m.group(1)))
src=gzip.decompress(base64.b64decode(packed)).decode('utf-8')

def function_block_at(p):
    if p < 0: return 'MISSING'
    s=src.rfind('\n    function ',0,p)
    if s < 0: s=max(0,p-4000)
    else: s+=1
    e=src.find('\n    function ',p+1)
    if e < 0: e=min(len(src),p+30000)
    return src[s:e]

def function_by_name(name):
    p=src.find('    function '+name+'(')
    return function_block_at(p)

out=[]
for name in [
    'rebuildVirtualWindow',
    'keyedReconcileVirtualWindow',
    'startKeyedStagedReconcile',
    'runKeyedStagedReconcileBatch',
    'finishKeyedStagedReconcile',
    'schedulePanelRefresh',
    'refreshPanelResults',
    'refreshResults',
    'buildPanelContent',
    'resetShowPerformance'
]:
    out.append('\n===== FUNCTION '+name+' =====\n'+function_by_name(name))

for needle in [
    'panel_first_content',
    'firstBatchReadyAtNs',
    'fullRenderReadyAtNs',
    'keyedReconcileVirtualWindow(range, colors)',
    'startKeyedStagedReconcile(',
    'syncRenderedResultCounters(range)',
    'renderedCount',
    'contentReady = true'
]:
    out.append('\n===== OCCURRENCES '+needle+' =====')
    pos=0; n=0
    while True:
        p=src.find(needle,pos)
        if p<0: break
        n+=1
        out.append('\n--- %d ---\n%s' % (n,src[max(0,p-2500):min(len(src),p+6500)]))
        pos=p+len(needle)
    if n==0: out.append('MISSING')

pathlib.Path('stage20_diag.txt').write_text('\n'.join(out),encoding='utf-8')
