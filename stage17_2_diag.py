import base64,gzip,pathlib,re
loader=pathlib.Path('src/ch_11_filter.js').read_text(encoding='utf-8')
if 'Stage 17.1 packed full Filter66 ES5 loader' not in loader:
    raise SystemExit('expected packed Filter66 loader')
m=re.search(r'var PACKED_B64 =\n((?:\s*"[A-Za-z0-9+/=]+"\s*\+?\n?)+);',loader)
if not m: raise SystemExit('PACKED_B64 missing')
packed=''.join(re.findall(r'"([A-Za-z0-9+/=]+)"',m.group(1)))
src=gzip.decompress(base64.b64decode(packed)).decode('utf-8')
needles=['var ajaxStagedAttachState =','function cancelStagedAjaxAttach','function preemptStagedAjaxAttachForScroll','function startStagedAjaxAttach','function runStagedAjaxAttachBatch','function finishStagedAjaxAttach','function rebuildVirtualWindow','function virtualTargetRange']
out=[]
for needle in needles:
    p=src.find(needle)
    out.append('\n===== '+needle+' =====')
    if p<0:
        out.append('MISSING'); continue
    start=src.rfind('\n    function ',0,p)
    if needle.startswith('var '): start=max(0,p-900)
    elif start<0: start=max(0,p-500)
    else: start+=1
    end=src.find('\n    function ',p+len(needle))
    if end<0 or end-start>24000: end=min(len(src),p+18000)
    out.append(src[start:end])
pathlib.Path('stage17_2_diag.txt').write_text('\n'.join(out),encoding='utf-8')
