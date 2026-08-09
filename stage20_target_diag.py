import base64,gzip,pathlib,re
loader=pathlib.Path('src/ch_11_filter.js').read_text(encoding='utf-8')
m=re.search(r'var PACKED_B64 =\n((?:\s*"[A-Za-z0-9+/=]+"\s*\+?\n?)+);',loader)
if not m: raise SystemExit('PACKED_B64 missing')
packed=''.join(re.findall(r'"([A-Za-z0-9+/=]+)"',m.group(1)))
src=gzip.decompress(base64.b64decode(packed)).decode('utf-8')

def function_block(name):
    needle='    function '+name+'('
    p=src.find(needle)
    if p<0: return 'MISSING '+name
    e=src.find('\n    function ',p+len(needle))
    if e<0: e=min(len(src),p+50000)
    return src[p:e]

def function_containing(needle):
    p=src.find(needle)
    if p<0: return 'MISSING containing '+needle
    s=src.rfind('\n    function ',0,p)
    if s<0: s=max(0,p-5000)
    else: s+=1
    e=src.find('\n    function ',p+len(needle))
    if e<0: e=min(len(src),p+50000)
    return src[s:e]

out=[]
for name in ['startKeyedStagedReconcile','runKeyedStagedReconcileBatch','finishKeyedStagedReconcile','cancelKeyedStagedReconcile','syncRenderedResultCounters','finishResultRender']:
    out.append('\n===== '+name+' =====\n'+function_block(name))
out.append('\n===== FULL_REFRESH_CALLER =====\n'+function_containing('rebuildVirtualWindow(\n            "full_refresh", true, preferredIndex);'))
out.append('\n===== FIRST_BATCH_CALLER =====\n'+function_containing('performance.firstBatchReadyAtNs = nowNanos();'))
pathlib.Path('stage20_target_diag.txt').write_text('\n'.join(out),encoding='utf-8')
