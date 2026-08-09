import base64,gzip,pathlib,re
loader=pathlib.Path('src/ch_11_filter.js').read_text(encoding='utf-8')
if 'Stage 17.1 packed full Filter66 ES5 loader' not in loader:
    raise SystemExit('expected packed Filter66 loader')
m=re.search(r'var PACKED_B64 =\n((?:\s*"[A-Za-z0-9+/=]+"\s*\+?\n?)+);',loader)
if not m: raise SystemExit('PACKED_B64 missing')
packed=''.join(re.findall(r'"([A-Za-z0-9+/=]+)"',m.group(1)))
src=gzip.decompress(base64.b64decode(packed)).decode('utf-8')

def section(name):
    p=src.find('    function '+name+'(')
    if p<0: raise SystemExit('missing '+name)
    e=src.find('\n    function ',p+10)
    if e<0: e=len(src)
    return src[p:e]+'\n'
for name in ['runStagedAjaxAttachBatch','preemptStagedAjaxAttachForScroll','startStagedAjaxAttach','finishStagedAjaxAttach','rebuildVirtualWindow','virtualTargetRange']:
    pathlib.Path('stage17_2_'+name+'.txt').write_text(section(name),encoding='utf-8')
