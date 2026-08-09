import base64,gzip,pathlib,re
loader=pathlib.Path('src/ch_11_filter.js').read_text(encoding='utf-8')
if 'Stage 17.2 staged retarget packed full Filter67 ES5 loader' not in loader:
    raise SystemExit('expected Filter67 packed loader')
m=re.search(r'var PACKED_B64 =\n((?:\s*"[A-Za-z0-9+/=]+"\s*\+?\n?)+);',loader)
if not m: raise SystemExit('PACKED_B64 missing')
packed=''.join(re.findall(r'"([A-Za-z0-9+/=]+)"',m.group(1)))
src=gzip.decompress(base64.b64decode(packed)).decode('utf-8')
needles=[
 'function cardHolderCompatibilityKeyForRow',
 'function cardHolderCompatibilityKeyForHolder',
 'function takeCompatibleRecycleHolder',
 'function resetVirtualState',
 'function closePanel'
]
for needle in needles:
 p=src.find(needle)
 name=re.sub(r'[^A-Za-z0-9_]+','_',needle).strip('_')
 if p<0:
  pathlib.Path('stage18_'+name+'.txt').write_text('MISSING\n',encoding='utf-8'); continue
 a=src.rfind('\n    function ',0,p)
 if a<0: a=max(0,p-1000)
 else: a+=1
 b=src.find('\n    function ',p+len(needle))
 if b<0 or b-a>18000: b=min(len(src),p+12000)
 pathlib.Path('stage18_'+name+'.txt').write_text(src[a:b],encoding='utf-8')
