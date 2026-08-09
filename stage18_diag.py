import base64,gzip,pathlib,re
loader=pathlib.Path('src/ch_11_filter.js').read_text(encoding='utf-8')
if 'Stage 17.2 staged retarget packed full Filter67 ES5 loader' not in loader:
    raise SystemExit('expected Filter67 packed loader')
m=re.search(r'var PACKED_B64 =\n((?:\s*"[A-Za-z0-9+/=]+"\s*\+?\n?)+);',loader)
if not m: raise SystemExit('PACKED_B64 missing')
packed=''.join(re.findall(r'"([A-Za-z0-9+/=]+)"',m.group(1)))
src=gzip.decompress(base64.b64decode(packed)).decode('utf-8')
needles=[
 'var scrollPerformanceState = {',
 'stagedAttachSyncCatchupAvoidedCount: 0,',
 'scrollPerformanceState.stagedAttachSyncCatchupAvoidedCount = 0;',
 'stagedAttachSyncCatchupAvoidedCount:',
 'function resetVirtualState',
 'function closePanel',
 'function rebuildVirtualWindow(origin, force, preferredIndex)',
 'if (range.end > oldEnd) {'
]
out=[]
for needle in needles:
    p=src.find(needle)
    out.append('\n===== '+needle+' =====')
    if p<0:
        out.append('MISSING'); continue
    a=max(0,p-1800); b=min(len(src),p+7000)
    out.append(src[a:b])
pathlib.Path('stage18_diag.txt').write_text('\n'.join(out),encoding='utf-8')
