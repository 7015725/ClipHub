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

names=['keyedReconcileVirtualWindow','insertVirtualEntryAt','removeVirtualEntryAt','moveVirtualEntry','startStagedAjaxAttach','finishAjaxAppendRender','rebuildVirtualWindow','resetVirtualState','closePanel']
out=[]
for name in names:
    block=function_block(name)
    out.append('\n===== '+name+' =====\n'+block)
    pathlib.Path('stage19_'+name+'.txt').write_text(block,encoding='utf-8')

needle='        if (startStagedAjaxAttach(\n'
p=src.find(needle)
if p<0: raise SystemExit('ajax staged call missing')
context=src[max(0,p-2400):min(len(src),p+4200)]
pathlib.Path('stage19_ajax_fallback_context.txt').write_text(context,encoding='utf-8')
out.append('\n===== ajax fallback context =====\n'+context)
pathlib.Path('stage19_diag.txt').write_text('\n'.join(out),encoding='utf-8')
