import base64,gzip,glob,hashlib,json,pathlib,re,subprocess,sys
L=pathlib.Path('src/ch_11_filter.js'); M=pathlib.Path('module-manifest.json')

def cmd(a): return subprocess.run(a,text=True,capture_output=True)
def one(s,a,b,label):
    n=s.count(a)
    if n!=1: raise RuntimeError('%s count=%d'%(label,n))
    return s.replace(a,b,1)
def fnreplace(s,name,new):
    a='    function '+name+'('; i=s.find(a)
    if i<0: raise RuntimeError('missing '+name)
    j=s.find('\n    function ',i+len(a))
    if j<0: raise RuntimeError('end missing '+name)
    return s[:i]+new.rstrip()+'\n'+s[j+1:]

def make65():
    loader=L.read_text(encoding='utf-8')
    if 'Stage 17 AJAX staged attach ES5 loader' not in loader: raise RuntimeError('expected .19 loader')
    m=re.search(r'var PATCH_B64 =\n((?:\s*"[A-Za-z0-9+/=]+"\s*\+?\n?)+);',loader)
    if not m: raise RuntimeError('PATCH_B64 missing')
    patch=base64.b64decode(''.join(re.findall(r'"([A-Za-z0-9+/=]+)"',m.group(1)))).decode('utf-8')
    base=subprocess.check_output(['git','show','338a811e538ab526b59eed05102d4f4b66f19953:src/ch_11_filter.js'],text=True)
    a=base.index('    function replaceOnceStrict('); b=base.index('\n    try {',a); pure=base[a:b]
    packed=''.join(pathlib.Path(p).read_text(encoding='utf-8').strip() for p in sorted(glob.glob('stage-assets/pagination-stage9/ch11_full_v8s_*.b64')))
    stable=gzip.decompress(base64.b64decode(packed)).decode('utf-8')
    expr=('transformStage17Source(transformStage16CSource(transformStage16B4Source('
          'transformStage16B3Source(transformStage16B2Source(transformRecycleFixSource('
          'transformRecycleSource(transformCardHolderSource(transformSource(__source)))))))))')
    h='var Buffer=require("buffer").Buffer;\nvar __source='+json.dumps(stable)+';\n'+pure+'\n'+patch+'\nvar __out='+expr+';\nrequire("fs").writeFileSync("/tmp/filter65.js",__out);\n'
    pathlib.Path('/tmp/make65.js').write_text(h,encoding='utf-8')
    p=cmd(['node','/tmp/make65.js'])
    if p.returncode: raise RuntimeError('make65 failed\n'+p.stderr)
    p=cmd(['node','--check','/tmp/filter65.js'])
    if p.returncode: raise RuntimeError('filter65 syntax\n'+p.stderr)
    return pathlib.Path('/tmp/filter65.js').read_text(encoding='utf-8')

def make66(s):
    s=one(s,'MODULE_VERSION: 65','MODULE_VERSION: 66','version')
    s=one(s,'    var AJAX_STAGED_ATTACH_BUDGET_MS = 8;\n','    var AJAX_STAGED_ATTACH_BUDGET_MS = 14;\n','budget')
    s=one(s,'    var AJAX_STAGED_ATTACH_DELAY_MS = 8;\n','    var AJAX_STAGED_ATTACH_DELAY_MS = 0;\n','delay')
    s=one(s,'        targetEnd: -1,\n        nextIndex: 0,\n','        targetEnd: -1,\n        nextIndex: 0,\n        startVisibleIndex: 0,\n','anchor field')
    s=one(s,'        stagedAttachDeferredUpdateCount: 0,\n','        stagedAttachDeferredUpdateCount: 0,\n        stagedAttachScrollPreemptCount: 0,\n        stagedAttachObsoleteCardAvoidedCount: 0,\n','metric init')
    s=one(s,'        scrollPerformanceState.stagedAttachDeferredUpdateCount = 0;\n','        scrollPerformanceState.stagedAttachDeferredUpdateCount = 0;\n        scrollPerformanceState.stagedAttachScrollPreemptCount = 0;\n        scrollPerformanceState.stagedAttachObsoleteCardAvoidedCount = 0;\n','metric reset')
    s=one(s,'            stagedAttachDeferredUpdateCount:\n                Number(scrollPerformanceState.stagedAttachDeferredUpdateCount),\n','            stagedAttachDeferredUpdateCount:\n                Number(scrollPerformanceState.stagedAttachDeferredUpdateCount),\n            stagedAttachScrollPreemptCount:\n                Number(scrollPerformanceState.stagedAttachScrollPreemptCount),\n            stagedAttachObsoleteCardAvoidedCount:\n                Number(scrollPerformanceState.stagedAttachObsoleteCardAvoidedCount),\n','metric copy')
    post='''    function postStagedAjaxAttachBatch(generation, delayMs) {\n        var runnable;\n        if (mainHandler === null) { return false; }\n        runnable = new Packages.java.lang.Runnable({\n            run: function () {\n                runStagedAjaxAttachBatch(generation);\n            }\n        });\n        if (Number(delayMs || 0) <= 0) {\n            mainHandler.post(runnable);\n        } else {\n            mainHandler.postDelayed(runnable,\n                Math.max(0, Number(delayMs || 0)));\n        }\n        return true;\n    }'''
    s=fnreplace(s,'postStagedAjaxAttachBatch',post)
    pre='''    function preemptStagedAjaxAttachForScroll(origin, force, preferredIndex) {\n        var requestedOrigin = String(origin || "virtual_rebuild");\n        var range;\n        var threshold;\n        var pendingStart;\n        var pendingEnd;\n        var overlapStart;\n        var overlapEnd;\n        var overlapPending;\n        var avoided;\n        var generation;\n        var rows;\n        var colors;\n        var deferredOrigin;\n        var deferredForce;\n        if (ajaxStagedAttachState.active !== true ||\n                requestedOrigin !== "result_scroll") {\n            return false;\n        }\n        range = virtualTargetRange(preferredIndex);\n        threshold = Math.max(1, Number(virtualState.visibleCount || 1));\n        if (Math.abs(Number(range.first) -\n                Number(ajaxStagedAttachState.startVisibleIndex)) < threshold) {\n            return false;\n        }\n        generation = Number(ajaxStagedAttachState.generation);\n        rows = ajaxStagedAttachState.appendedRows;\n        colors = ajaxStagedAttachState.colors;\n        deferredOrigin = String(ajaxStagedAttachState.deferredOrigin || "");\n        deferredForce = ajaxStagedAttachState.deferredForce === true;\n        pendingStart = Number(ajaxStagedAttachState.nextIndex);\n        pendingEnd = Number(ajaxStagedAttachState.targetEnd);\n        overlapStart = Math.max(pendingStart, Number(range.start));\n        overlapEnd = Math.min(pendingEnd, Number(range.end));\n        overlapPending = overlapEnd >= overlapStart ?\n            overlapEnd - overlapStart + 1 : 0;\n        avoided = Math.max(0, pendingEnd - pendingStart + 1 - overlapPending);\n        scrollPerformanceState.stagedAttachScrollPreemptCount += 1;\n        scrollPerformanceState.stagedAttachObsoleteCardAvoidedCount += avoided;\n        cancelStagedAjaxAttach("scroll_preempt");\n        if (!state.panelAttached) { return true; }\n        rebuildVirtualWindow(requestedOrigin, force === true, preferredIndex);\n        if (Number(generation) === Number(ajaxAppendGeneration) &&\n                state.panelAttached && rows !== null && rows !== undefined) {\n            finishAjaxAppendRender(generation, rows, colors);\n        }\n        if (deferredOrigin.length > 0 && state.panelAttached &&\n                (deferredForce || deferredOrigin !== requestedOrigin)) {\n            scheduleVirtualUpdate(deferredOrigin, deferredForce);\n        }\n        return true;\n    }\n\n'''
    anchor='    function startStagedAjaxAttach(generation, appendedRows, colors) {\n'
    s=one(s,anchor,pre+anchor,'preempt insert')
    s=one(s,'        ajaxStagedAttachState.nextIndex = oldEnd + 1;\n        ajaxStagedAttachState.colors = colors;\n','        ajaxStagedAttachState.nextIndex = oldEnd + 1;\n        ajaxStagedAttachState.startVisibleIndex = Number(range.first);\n        ajaxStagedAttachState.colors = colors;\n','capture anchor')
    a=s.find('    function rebuildVirtualWindow(origin, force, preferredIndex) {'); b=s.find('\n    function ',a+10)
    if a<0 or b<0: raise RuntimeError('rebuild section missing')
    f=s[a:b]
    old='        if (ajaxStagedAttachState.active === true) {\n            deferVirtualUpdateDuringStagedAttach(origin, force);\n            return false;\n        }\n'
    new='        if (ajaxStagedAttachState.active === true) {\n            if (preemptStagedAjaxAttachForScroll(\n                    origin, force, preferredIndex)) {\n                return false;\n            }\n            deferVirtualUpdateDuringStagedAttach(origin, force);\n            return false;\n        }\n'
    f=one(f,old,new,'rebuild guard'); s=s[:a]+f+s[b:]
    req=['MODULE_VERSION: 66','AJAX_STAGED_ATTACH_BUDGET_MS = 14','AJAX_STAGED_ATTACH_DELAY_MS = 0','AJAX_STAGED_ATTACH_MAX_CARDS_PER_BATCH = 3','AJAX_STAGED_ATTACH_MIN_CARDS = 8','function preemptStagedAjaxAttachForScroll','stagedAttachScrollPreemptCount','stagedAttachObsoleteCardAvoidedCount','startVisibleIndex: 0','mainHandler.post(runnable)','cancelStagedAjaxAttach("scroll_preempt")','VIRTUAL_BEFORE_SCREENS = 3','VIRTUAL_AFTER_SCREENS = 5','VIRTUAL_UPDATE_DELAY_MS = 24']
    for x in req:
        if x not in s: raise RuntimeError('missing '+x)
    if s.count('.newSingleThreadExecutor();')!=1: raise RuntimeError('worker invariant')
    if re.search(r'(^|[^A-Za-z0-9_])(let|const|class)\s+|=>',s): raise RuntimeError('non ES5')
    pathlib.Path('/tmp/filter66.js').write_text(s,encoding='utf-8')
    p=cmd(['node','--check','/tmp/filter66.js'])
    if p.returncode: raise RuntimeError('filter66 syntax\n'+p.stderr)
    return s

def pack(s):
    raw=s.encode('utf-8'); gz=gzip.compress(raw,9,mtime=0); enc=base64.b64encode(gz).decode('ascii'); sha=hashlib.sha256(raw).hexdigest()
    pieces=[enc[i:i+120] for i in range(0,len(enc),120)]
    b64=' +\n'.join('        '+json.dumps(x) for x in pieces)
    loader='''/* ClipHub Stage 17.1 packed full Filter66 ES5 loader. */\n(function (global) {\n    var Base64 = Packages.android.util.Base64;\n    var ByteArrayInputStream = Packages.java.io.ByteArrayInputStream;\n    var GZIPInputStream = Packages.java.util.zip.GZIPInputStream;\n    var BAOS = Packages.java.io.ByteArrayOutputStream;\n    var ReflectArray = Packages.java.lang.reflect.Array;\n    var JavaByte = Packages.java.lang.Byte;\n    var JavaString = Packages.java.lang.String;\n    var MessageDigest = Packages.java.security.MessageDigest;\n    var SOURCE_SHA256 = "__SHA__";\n    var PACKED_B64 =\n__B64__;\n\n    function closeQuietly(value) {\n        if (value !== null && value !== undefined) {\n            try { value.close(); } catch (ignored) {}\n        }\n    }\n\n    function unpackSource() {\n        var input = null;\n        var gzip = null;\n        var output = null;\n        var buffer = ReflectArray.newInstance(JavaByte.TYPE, 8192);\n        var count;\n        var bytes;\n        var digest;\n        var hash;\n        var parts = [];\n        var index;\n        var value;\n        try {\n            bytes = Base64.decode(String(PACKED_B64), Base64.DEFAULT);\n            input = new ByteArrayInputStream(bytes);\n            gzip = new GZIPInputStream(input);\n            output = new BAOS();\n            while ((count = gzip.read(buffer)) >= 0) {\n                if (count > 0) { output.write(buffer, 0, count); }\n            }\n            bytes = output.toByteArray();\n            digest = MessageDigest.getInstance("SHA-256");\n            hash = digest.digest(bytes);\n            for (index = 0; index < hash.length; index += 1) {\n                value = Number(hash[index]);\n                if (value < 0) { value += 256; }\n                parts.push((value < 16 ? "0" : "") + value.toString(16));\n            }\n            if (parts.join("") !== SOURCE_SHA256) {\n                throw new Error("Filter66 source SHA-256 mismatch");\n            }\n            return String(new JavaString(bytes, "UTF-8"));\n        } finally {\n            closeQuietly(gzip); closeQuietly(input); closeQuietly(output);\n        }\n    }\n\n    try {\n        eval(unpackSource());\n    } catch (error) {\n        throw new Error("ch_11_filter.js Stage 17.1 packed loader failed: " + String(error));\n    }\n}((function () { return this; }())));\n'''.replace('__SHA__',sha).replace('__B64__',b64)
    pathlib.Path('/tmp/filter66_loader.js').write_text(loader,encoding='utf-8')
    p=cmd(['node','--check','/tmp/filter66_loader.js'])
    if p.returncode: raise RuntimeError('loader syntax\n'+p.stderr)
    return loader

def blob(text):
    d=text.encode('utf-8'); return hashlib.sha1(('blob %d\0'%len(d)).encode('ascii')+d).hexdigest()
def publish(loader):
    m=json.loads(M.read_text(encoding='utf-8'))
    if m.get('moduleSetVersion')!='20260808.19': raise RuntimeError('expected .19 manifest')
    sh=blob(loader); L.write_text(loader,encoding='utf-8'); m['moduleSetVersion']='20260808.20'
    found=False
    for x in m.get('modules',[]):
        if x.get('name')=='ch_11_filter.js': x['sha']=sh; found=True
    if not found: raise RuntimeError('manifest missing filter')
    M.write_text(json.dumps(m,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    subprocess.check_call(['git','config','user.name','github-actions[bot]']); subprocess.check_call(['git','config','user.email','41898282+github-actions[bot]@users.noreply.github.com'])
    for n in ['.github/stage17_1_pack_trigger.txt','.github/workflows/beta_stage17_1_pack.yml','stage17_1_pack_runner.py','stage17_1_pack_debug.txt']:
        try: pathlib.Path(n).unlink()
        except FileNotFoundError: pass
    subprocess.check_call(['git','add','-A']); subprocess.check_call(['git','diff','--cached','--check']); subprocess.check_call(['git','commit','-m','优化 Beta AJAX 分帧调度并改用完整 Filter 打包']); subprocess.check_call(['git','push'])
    print(sh)
def fail(e):
    subprocess.run(['git','restore','src/ch_11_filter.js','module-manifest.json'])
    pathlib.Path('stage17_1_pack_debug.txt').write_text(repr(e)+'\n',encoding='utf-8')
    subprocess.check_call(['git','config','user.name','github-actions[bot]']); subprocess.check_call(['git','config','user.email','41898282+github-actions[bot]@users.noreply.github.com']); subprocess.check_call(['git','add','stage17_1_pack_debug.txt'])
    if subprocess.run(['git','diff','--cached','--quiet']).returncode!=0:
        subprocess.check_call(['git','commit','-m','记录 Stage17.1 打包构建失败']); subprocess.check_call(['git','push'])
def main():
    try: publish(pack(make66(make65())))
    except Exception as e: fail(e)
    return 0
if __name__=='__main__': sys.exit(main())
