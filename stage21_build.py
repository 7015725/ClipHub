import base64,gzip,hashlib,json,pathlib,re,subprocess

LOADER=pathlib.Path('src/ch_11_filter.js')
MANIFEST=pathlib.Path('module-manifest.json')


def run(args, **kwargs):
    return subprocess.run(args,text=True,**kwargs)

def replace_once(text,old,new,label):
    c=text.count(old)
    if c!=1:
        raise RuntimeError('%s count=%d' % (label,c))
    return text.replace(old,new,1)

def function_block(src,name):
    needle='    function '+name+'('
    p=src.find(needle)
    if p<0: return None
    e=src.find('\n    function ',p+len(needle))
    if e<0: e=len(src)
    return src[p:e]

def replace_function(src,name,new_block):
    old=function_block(src,name)
    if old is None:
        raise RuntimeError('missing function '+name)
    return src.replace(old,new_block,1)

def decode_source(loader):
    if 'Stage 20 initial virtual window staged fill packed full Filter70 ES5 loader' not in loader:
        raise RuntimeError('expected Filter70 loader')
    m=re.search(r'var PACKED_B64 =\n((?:\s*"[A-Za-z0-9+/=]+"\s*\+?\n?)+);',loader)
    if not m: raise RuntimeError('PACKED_B64 missing')
    packed=''.join(re.findall(r'"([A-Za-z0-9+/=]+)"',m.group(1)))
    return gzip.decompress(base64.b64decode(packed)).decode('utf-8')

def encode_assignment(data):
    enc=base64.b64encode(gzip.compress(data.encode('utf-8'),9)).decode('ascii')
    pieces=[enc[i:i+120] for i in range(0,len(enc),120)]
    return 'var PACKED_B64 =\n'+''.join(
        '        '+json.dumps(p)+(' +\n' if i<len(pieces)-1 else ';')
        for i,p in enumerate(pieces))

def insert_status_metrics(src):
    old='''            initialStagedLastCancelReason:\n                String(scrollPerformanceState.initialStagedLastCancelReason || ""),'''
    new=old+'''\n            initialStagedFirstBatchBudgetHitCount:\n                Number(scrollPerformanceState.initialStagedFirstBatchBudgetHitCount),\n            initialStagedFirstBatchTargetCards:\n                Number(scrollPerformanceState.initialStagedFirstBatchTargetCards),\n            overlapStagedHydrationStartCount:\n                Number(scrollPerformanceState.overlapStagedHydrationStartCount),\n            overlapStagedHydrationCompletedCount:\n                Number(scrollPerformanceState.overlapStagedHydrationCompletedCount),\n            overlapStagedScrollStartCount:\n                Number(scrollPerformanceState.overlapStagedScrollStartCount),\n            overlapStagedScrollCompletedCount:\n                Number(scrollPerformanceState.overlapStagedScrollCompletedCount),\n            overlapStagedScrollSyncBuildAvoidedCount:\n                Number(scrollPerformanceState.overlapStagedScrollSyncBuildAvoidedCount),\n            overlapStagedLastOrigin:\n                String(scrollPerformanceState.overlapStagedLastOrigin || ""),'''
    return replace_once(src,old,new,'status metrics')


def transform(src):
    preserved={}
    keep=[
        'preemptStagedAjaxAttachForScroll','runStagedAjaxAttachBatch',
        'runOverlapStagedFillBatch',
        'startKeyedStagedReconcile','runKeyedStagedBatch',
        'finishKeyedStagedReconcile','keyedReconcileVirtualWindow',
        'insertVirtualEntryAt','removeVirtualEntryAt','moveVirtualEntry',
        'finishAjaxAppendRender'
    ]
    for name in keep:
        preserved[name]=function_block(src,name)
        if preserved[name] is None:
            raise RuntimeError('missing preserved function '+name)

    src=replace_once(src,'MODULE_VERSION: 70','MODULE_VERSION: 71','module version')
    src=replace_once(src,
        '    var INITIAL_STAGED_SYNC_MIN_CARDS = 8;\n'
        '    var INITIAL_STAGED_SYNC_MAX_CARDS = 12;\n'
        '    var INITIAL_STAGED_MIN_REMAINING = 8;\n'
        '    var INITIAL_STAGED_BUDGET_MS = 14;\n'
        '    var INITIAL_STAGED_MAX_CARDS_PER_BATCH = 3;\n',
        '    var INITIAL_STAGED_SYNC_MIN_CARDS = 4;\n'
        '    var INITIAL_STAGED_SYNC_MAX_CARDS = 8;\n'
        '    var INITIAL_STAGED_SYNC_BUDGET_MS = 40;\n'
        '    var INITIAL_STAGED_MIN_REMAINING = 8;\n'
        '    var INITIAL_STAGED_BUDGET_MS = 14;\n'
        '    var INITIAL_STAGED_MAX_CARDS_PER_BATCH = 2;\n',
        'initial constants')

    init_metrics='''        initialStagedFirstBatchBudgetHitCount: 0,\n        initialStagedFirstBatchTargetCards: 0,\n        overlapStagedHydrationStartCount: 0,\n        overlapStagedHydrationCompletedCount: 0,\n        overlapStagedScrollStartCount: 0,\n        overlapStagedScrollCompletedCount: 0,\n        overlapStagedScrollSyncBuildAvoidedCount: 0,\n        overlapStagedLastOrigin: "",\n'''
    src=replace_once(src,
        '        initialStagedLastCancelReason: "",\n        holderRecycleReleaseCount: 0,\n',
        '        initialStagedLastCancelReason: "",\n'+init_metrics+'        holderRecycleReleaseCount: 0,\n',
        'metrics init')

    reset_metrics='''        scrollPerformanceState.initialStagedFirstBatchBudgetHitCount = 0;\n        scrollPerformanceState.initialStagedFirstBatchTargetCards = 0;\n        scrollPerformanceState.overlapStagedHydrationStartCount = 0;\n        scrollPerformanceState.overlapStagedHydrationCompletedCount = 0;\n        scrollPerformanceState.overlapStagedScrollStartCount = 0;\n        scrollPerformanceState.overlapStagedScrollCompletedCount = 0;\n        scrollPerformanceState.overlapStagedScrollSyncBuildAvoidedCount = 0;\n        scrollPerformanceState.overlapStagedLastOrigin = "";\n'''
    src=replace_once(src,
        '        scrollPerformanceState.initialStagedLastCancelReason = "";\n        scrollPerformanceState.holderRecycleReleaseCount = 0;\n',
        '        scrollPerformanceState.initialStagedLastCancelReason = "";\n'+reset_metrics+'        scrollPerformanceState.holderRecycleReleaseCount = 0;\n',
        'metrics reset')
    src=insert_status_metrics(src)

    start_initial=r'''    function startInitialStagedFill(range, colors, renderGen, rebuildStartedAt) {
        var totalCount;
        var visibleCount;
        var targetSyncCount;
        var syncLimit;
        var syncCount = 0;
        var remainingCount;
        var index;
        var signature;
        var syncElapsed = 0;
        var generation;
        var budgetHit = false;
        if (mainHandler === null || virtualCardHost === null ||
                !state.panelAttached || activeSwipeCard !== null ||
                initialStagedFillState.active === true ||
                ajaxStagedAttachState.active === true ||
                overlapStagedFillState.active === true ||
                keyedStagedState.active === true) {
            return false;
        }
        if (String(performance.lastRefreshOrigin || "") !==
                "panel_first_content" || Number(range.start) !== 0 ||
                Number(range.first) > 2 ||
                Number(virtualCardHost.getChildCount()) !== 0) {
            return false;
        }
        totalCount = Math.max(0,
            Number(range.end) - Number(range.start) + 1);
        visibleCount = Math.max(1,
            Number(range.last) - Number(range.first) + 1);
        targetSyncCount = Math.max(INITIAL_STAGED_SYNC_MIN_CARDS,
            Math.min(INITIAL_STAGED_SYNC_MAX_CARDS, visibleCount + 3));
        targetSyncCount = Math.min(totalCount, targetSyncCount);
        if (totalCount - INITIAL_STAGED_SYNC_MIN_CARDS <
                INITIAL_STAGED_MIN_REMAINING) {
            return false;
        }
        syncLimit = Math.min(targetSyncCount,
            totalCount - INITIAL_STAGED_MIN_REMAINING);
        syncLimit = Math.max(INITIAL_STAGED_SYNC_MIN_CARDS, syncLimit);
        for (index = Number(range.start);
                index < Number(range.start) + syncLimit; index += 1) {
            if (previewRows[index] === null || previewRows[index] === undefined) {
                return false;
            }
            signature = virtualRenderSignature(previewRows[index], colors);
            insertVirtualEntryAt(
                Number(virtualCardHost.getChildCount()),
                previewRows[index], colors, signature);
            syncCount += 1;
            syncElapsed = Math.max(0, Number(System.currentTimeMillis()) -
                Number(rebuildStartedAt));
            if (syncCount >= INITIAL_STAGED_SYNC_MIN_CARDS &&
                    syncElapsed >= INITIAL_STAGED_SYNC_BUDGET_MS &&
                    syncCount < syncLimit) {
                budgetHit = true;
                break;
            }
        }
        remainingCount = Math.max(0, totalCount - syncCount);
        syncElapsed = Math.max(0, Number(System.currentTimeMillis()) -
            Number(rebuildStartedAt));
        generation = ++initialStagedGeneration;
        initialStagedFillState.active = true;
        initialStagedFillState.generation = generation;
        initialStagedFillState.renderGeneration = Number(renderGen);
        initialStagedFillState.rangeStart = Number(range.start);
        initialStagedFillState.rangeEnd = Number(range.end);
        initialStagedFillState.nextIndex = Number(range.start) + syncCount;
        initialStagedFillState.colors = colors;
        initialStagedFillState.deferredOrigin = "";
        initialStagedFillState.deferredForce = false;
        initialStagedFillState.startedAtMs = Number(rebuildStartedAt);
        initialStagedFillState.firstBatchCards = syncCount;
        initialStagedFillState.maxBatchMs = syncElapsed;
        virtualState.firstRenderedIndex = Number(range.start);
        virtualState.lastRenderedIndex = Number(range.start) + syncCount - 1;
        virtualState.topSpacerPx = setVirtualSpacerHeight(
            virtualTopSpacer, virtualHeightRange(0, range.start));
        virtualState.bottomSpacerPx = setVirtualSpacerHeight(
            virtualBottomSpacer, virtualHeightRange(
                virtualState.lastRenderedIndex + 1, previewRows.length));
        syncRenderedResultCounters({
            start: Number(range.start),
            end: Number(virtualState.lastRenderedIndex)
        });
        renderCursor = Number(virtualState.lastRenderedIndex) + 1;
        renderBatchCount = 1;
        state.renderBatchCount = renderBatchCount;
        performance.firstBatchReadyAtNs = nowNanos();
        performance.showToFirstBatchMs = elapsedMs(
            performance.showStartedAtNs, performance.firstBatchReadyAtNs);
        scrollPerformanceState.initialStagedStartCount += 1;
        scrollPerformanceState.initialStagedCardCount += syncCount;
        scrollPerformanceState.initialStagedFirstBatchCards = syncCount;
        scrollPerformanceState.initialStagedFirstBatchMs = syncElapsed;
        scrollPerformanceState.initialStagedFirstBatchTargetCards = targetSyncCount;
        if (budgetHit) {
            scrollPerformanceState.initialStagedFirstBatchBudgetHitCount += 1;
        }
        scrollPerformanceState.initialStagedLastTotalCards = totalCount;
        scrollPerformanceState.initialStagedPendingCount = remainingCount;
        scrollPerformanceState.initialStagedSyncBuildAvoidedCount += remainingCount;
        scrollPerformanceState.viewRebuildLastMs = syncElapsed;
        scrollPerformanceState.viewRebuildMaxMs = Math.max(
            Number(scrollPerformanceState.viewRebuildMaxMs), syncElapsed);
        if (!postInitialStagedFillBatch(generation)) {
            return recoverInitialStagedFill("initial_post_failed");
        }
        return true;
    }
'''
    src=replace_function(src,'startInitialStagedFill',start_initial.rstrip())

    # Make overlap staged origin-aware without changing its batch engine.
    src=replace_once(src,
        '        scrollPerformanceState.overlapStagedSyncBuildAvoidedCount += buildCount;\n'
        '        virtualState.firstRenderedIndex = Number(range.start);\n',
        '        scrollPerformanceState.overlapStagedSyncBuildAvoidedCount += buildCount;\n'
        '        scrollPerformanceState.overlapStagedLastOrigin =\n'
        '            String(origin || "hydration_apply");\n'
        '        if (String(origin || "hydration_apply") === "result_scroll") {\n'
        '            scrollPerformanceState.overlapStagedScrollStartCount += 1;\n'
        '            scrollPerformanceState.overlapStagedScrollSyncBuildAvoidedCount += buildCount;\n'
        '        } else {\n'
        '            scrollPerformanceState.overlapStagedHydrationStartCount += 1;\n'
        '        }\n'
        '        virtualState.firstRenderedIndex = Number(range.start);\n',
        'overlap start origin metrics')

    # Capture origin in finish and report correct path.
    finish_old=function_block(src,'finishOverlapStagedFill')
    if finish_old is None: raise RuntimeError('missing finishOverlapStagedFill')
    finish_new=finish_old
    finish_new=replace_once(finish_new,
        '        var range;\n        var removedCount;\n',
        '        var range;\n        var removedCount;\n        var origin;\n',
        'finish origin var')
    finish_new=replace_once(finish_new,
        '        removedCount = Number(overlapStagedFillState.removedCount);\n        range = {\n',
        '        removedCount = Number(overlapStagedFillState.removedCount);\n'
        '        origin = String(overlapStagedFillState.origin || "hydration_apply");\n'
        '        range = {\n',
        'finish origin capture')
    finish_new=replace_once(finish_new,
        '        scrollPerformanceState.overlapStagedCompletedCount += 1;\n',
        '        scrollPerformanceState.overlapStagedCompletedCount += 1;\n'
        '        if (origin === "result_scroll") {\n'
        '            scrollPerformanceState.overlapStagedScrollCompletedCount += 1;\n'
        '        } else {\n'
        '            scrollPerformanceState.overlapStagedHydrationCompletedCount += 1;\n'
        '        }\n',
        'finish origin completed')
    finish_new=replace_once(finish_new,
        '        virtualState.lastOrigin = "hydration_apply_overlap_staged";\n',
        '        virtualState.lastOrigin = origin + "_overlap_staged";\n',
        'finish origin last')
    src=src.replace(finish_old,finish_new,1)

    old_condition='''            if (range.end > oldEnd &&\n                    String(origin || "") === "hydration_apply" &&\n                    range.start >= oldStart &&\n                    (range.end - oldEnd) >= OVERLAP_STAGED_FILL_MIN_NEW_BUILDS &&\n                    estimateOverlapStagedNewBuildCount(\n                        oldEnd + 1, range.end, recyclePool) >=\n                        OVERLAP_STAGED_FILL_MIN_NEW_BUILDS) {'''
    new_condition='''            if (range.end > oldEnd &&\n                    (String(origin || "") === "hydration_apply" ||\n                        String(origin || "") === "result_scroll") &&\n                    range.start >= oldStart &&\n                    (range.end - oldEnd) >= OVERLAP_STAGED_FILL_MIN_NEW_BUILDS &&\n                    estimateOverlapStagedNewBuildCount(\n                        oldEnd + 1, range.end, recyclePool) >=\n                        OVERLAP_STAGED_FILL_MIN_NEW_BUILDS) {'''
    src=replace_once(src,old_condition,new_condition,'overlap origin condition')

    # Validate intentionally preserved functions stayed byte-for-byte identical.
    for name,old in preserved.items():
        now=function_block(src,name)
        if now!=old:
            raise RuntimeError('preserved function changed: '+name)

    return src


def main():
    loader=LOADER.read_text(encoding='utf-8')
    src=decode_source(loader)
    out=transform(src)
    pathlib.Path('/tmp/filter71.js').write_text(out,encoding='utf-8')
    cp=run(['node','--check','/tmp/filter71.js'],capture_output=True)
    if cp.returncode!=0:
        raise RuntimeError('Filter71 node check failed: '+cp.stderr)
    banned=[r'\blet\b',r'\bconst\b',r'=>',r'\bclass\s+[A-Za-z_$]']
    for pat in banned:
        if re.search(pat,out):
            raise RuntimeError('ES5 violation '+pat)
    if out.count('Executors.newSingleThreadExecutor')!=1:
        raise RuntimeError('hydration executor count='+str(out.count('Executors.newSingleThreadExecutor')))
    invariants=[
        'BUFFER_SCREENS_BEFORE = 3',
        'BUFFER_SCREENS_AFTER = 5',
        'VIRTUAL_UPDATE_DELAY_MS = 24',
        'AJAX_STAGED_ATTACH_BUDGET_MS = 14',
        'AJAX_STAGED_ATTACH_MAX_CARDS_PER_BATCH = 3',
        'OVERLAP_STAGED_FILL_BUDGET_MS = 14',
        'OVERLAP_STAGED_FILL_MAX_CARDS_PER_BATCH = 3',
        'KEYED_STAGED_BUDGET_MS = 14',
        'KEYED_STAGED_MAX_NEW_BUILDS_PER_BATCH = 3',
        'INITIAL_STAGED_SYNC_MIN_CARDS = 4',
        'INITIAL_STAGED_SYNC_MAX_CARDS = 8',
        'INITIAL_STAGED_SYNC_BUDGET_MS = 40',
        'INITIAL_STAGED_MAX_CARDS_PER_BATCH = 2'
    ]
    for needle in invariants:
        if needle not in out:
            raise RuntimeError('invariant missing '+needle)
    if 'String(origin || "") === "result_scroll") &&\n                    range.start >= oldStart' not in out:
        raise RuntimeError('result_scroll staged condition missing')
    if 'overlapStagedScrollSyncBuildAvoidedCount += buildCount' not in out:
        raise RuntimeError('scroll avoided metric missing')
    if 'syncCount >= INITIAL_STAGED_SYNC_MIN_CARDS &&\n                    syncElapsed >= INITIAL_STAGED_SYNC_BUDGET_MS' not in out:
        raise RuntimeError('initial time budget logic missing')

    source_sha=hashlib.sha256(out.encode('utf-8')).hexdigest()
    assignment=encode_assignment(out)
    loader71='''/* ClipHub Stage 21 initial time budget and result-scroll overlap staged packed full Filter71 ES5 loader. */\n(function (global) {\n    var Base64 = Packages.android.util.Base64;\n    var ByteArrayInputStream = Packages.java.io.ByteArrayInputStream;\n    var GZIPInputStream = Packages.java.util.zip.GZIPInputStream;\n    var BAOS = Packages.java.io.ByteArrayOutputStream;\n    var ReflectArray = Packages.java.lang.reflect.Array;\n    var JavaByte = Packages.java.lang.Byte;\n    var JavaString = Packages.java.lang.String;\n    var MessageDigest = Packages.java.security.MessageDigest;\n    var SOURCE_SHA256 = "'''+source_sha+'''";\n    '''+assignment+'''\n    function bytesToHex(bytes) {\n        var out = "";\n        var i;\n        var v;\n        for (i = 0; i < bytes.length; i += 1) {\n            v = Number(bytes[i]);\n            if (v < 0) { v += 256; }\n            out += (v < 16 ? "0" : "") + v.toString(16);\n        }\n        return out;\n    }\n    function inflatePacked(text) {\n        var packed = Base64.decode(text, Base64.DEFAULT);\n        var input = new ByteArrayInputStream(packed);\n        var gzip = new GZIPInputStream(input);\n        var output = new BAOS();\n        var buffer = ReflectArray.newInstance(JavaByte.TYPE, 8192);\n        var count;\n        while ((count = gzip.read(buffer)) > 0) { output.write(buffer, 0, count); }\n        gzip.close();\n        input.close();\n        var bytes = output.toByteArray();\n        output.close();\n        return { bytes: bytes, source: String(new JavaString(bytes, "UTF-8")) };\n    }\n    var expanded = inflatePacked(PACKED_B64);\n    var digest = MessageDigest.getInstance("SHA-256").digest(expanded.bytes);\n    var actualSha = bytesToHex(digest);\n    if (actualSha !== SOURCE_SHA256) {\n        throw new Error("ch_11_filter.js Stage 21 source SHA mismatch: " + actualSha);\n    }\n    (0, eval)(expanded.source);\n})(this);\n'''
    pathlib.Path('/tmp/loader71.js').write_text(loader71,encoding='utf-8')
    cp=run(['node','--check','/tmp/loader71.js'],capture_output=True)
    if cp.returncode!=0:
        raise RuntimeError('loader71 node check failed: '+cp.stderr)

    LOADER.write_text(loader71,encoding='utf-8')
    manifest=json.loads(MANIFEST.read_text(encoding='utf-8'))
    manifest['moduleSetVersion']='20260808.25'
    blob_sha=None
    # Git blob SHA is computed by git after add; manifest is updated in two commits below.
    MANIFEST.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

    run(['git','config','user.name','github-actions[bot]'],check=True)
    run(['git','config','user.email','41898282+github-actions[bot]@users.noreply.github.com'],check=True)
    run(['git','add','src/ch_11_filter.js'],check=True)
    run(['git','commit','-m','优化 Beta 首批预算与滚动大 overlap 分帧'],check=True)
    # Read actual blob SHA and put it into manifest.
    blob_sha=run(['git','rev-parse','HEAD:src/ch_11_filter.js'],capture_output=True,check=True).stdout.strip()
    manifest=json.loads(MANIFEST.read_text(encoding='utf-8'))
    found=False
    for module in manifest.get('modules',[]):
        if module.get('name')=='ch_11_filter.js':
            module['sha']=blob_sha
            found=True
            break
    if not found:
        raise RuntimeError('manifest filter entry missing')
    MANIFEST.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    run(['git','add','module-manifest.json'],check=True)
    run(['git','commit','-m','发布 Beta Stage21 Filter71'],check=True)
    # Cleanup all Stage21 temporary files and stale error file if present.
    cleanup=[
        'stage21_diag.py','stage21_diag.txt','stage21_build.py','stage21_build_error.txt',
        '.github/workflows/beta_stage21_diag.yml','.github/stage21_diag_trigger.txt',
        '.github/workflows/beta_stage21_build.yml','.github/stage21_build_trigger.txt'
    ]
    for p in cleanup:
        path=pathlib.Path(p)
        if path.exists(): path.unlink()
    run(['git','add','-A'],check=True)
    status=run(['git','status','--porcelain'],capture_output=True,check=True).stdout.strip()
    if status:
        run(['git','commit','-m','清理 Stage21 临时构建文件'],check=True)
    run(['git','push'],check=True)

if __name__=='__main__':
    try:
        main()
    except Exception as exc:
        pathlib.Path('stage21_build_error.txt').write_text(type(exc).__name__+'('+repr(str(exc))+')\n',encoding='utf-8')
        run(['git','config','user.name','github-actions[bot]'])
        run(['git','config','user.email','41898282+github-actions[bot]@users.noreply.github.com'])
        run(['git','add','stage21_build_error.txt'])
        run(['git','commit','-m','记录 Stage21 构建失败'])
        run(['git','push'])
        raise
