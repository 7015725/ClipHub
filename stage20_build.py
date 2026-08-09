import base64,gzip,hashlib,json,pathlib,re,subprocess,sys

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

def decode_source(loader):
    if 'Stage 19 keyed staged reconcile and AJAX fallback packed full Filter69 ES5 loader' not in loader:
        raise RuntimeError('expected Filter69 loader')
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
    old='''            keyedStagedLastCancelReason:\n                String(scrollPerformanceState.keyedStagedLastCancelReason || ""),'''
    new=old+'''\n            initialStagedStartCount:\n                Number(scrollPerformanceState.initialStagedStartCount),\n            initialStagedBatchCount:\n                Number(scrollPerformanceState.initialStagedBatchCount),\n            initialStagedCardCount:\n                Number(scrollPerformanceState.initialStagedCardCount),\n            initialStagedCompletedCount:\n                Number(scrollPerformanceState.initialStagedCompletedCount),\n            initialStagedCancelCount:\n                Number(scrollPerformanceState.initialStagedCancelCount),\n            initialStagedDeferredUpdateCount:\n                Number(scrollPerformanceState.initialStagedDeferredUpdateCount),\n            initialStagedPendingCount:\n                Number(scrollPerformanceState.initialStagedPendingCount),\n            initialStagedFirstBatchCards:\n                Number(scrollPerformanceState.initialStagedFirstBatchCards),\n            initialStagedFirstBatchMs:\n                Number(scrollPerformanceState.initialStagedFirstBatchMs),\n            initialStagedLastBatchMs:\n                Number(scrollPerformanceState.initialStagedLastBatchMs),\n            initialStagedMaxBatchMs:\n                Number(scrollPerformanceState.initialStagedMaxBatchMs),\n            initialStagedLastBatchCards:\n                Number(scrollPerformanceState.initialStagedLastBatchCards),\n            initialStagedMaxCardsPerBatch:\n                Number(scrollPerformanceState.initialStagedMaxCardsPerBatch),\n            initialStagedLastTotalCards:\n                Number(scrollPerformanceState.initialStagedLastTotalCards),\n            initialStagedLastTotalMs:\n                Number(scrollPerformanceState.initialStagedLastTotalMs),\n            initialStagedMaxTotalMs:\n                Number(scrollPerformanceState.initialStagedMaxTotalMs),\n            initialStagedSyncBuildAvoidedCount:\n                Number(scrollPerformanceState.initialStagedSyncBuildAvoidedCount),\n            initialStagedLastCancelReason:\n                String(scrollPerformanceState.initialStagedLastCancelReason || ""),'''
    return replace_once(src,old,new,'status metrics')

def transform(src):
    before={}
    keep=[
        'preemptStagedAjaxAttachForScroll','runStagedAjaxAttachBatch',
        'startOverlapStagedFill','runOverlapStagedFillBatch',
        'startKeyedStagedReconcile','runKeyedStagedBatch',
        'finishKeyedStagedReconcile','keyedReconcileVirtualWindow',
        'insertVirtualEntryAt','removeVirtualEntryAt','moveVirtualEntry'
    ]
    for name in keep:
        before[name]=function_block(src,name)
        if before[name] is None:
            raise RuntimeError('missing preserved function '+name)

    src=replace_once(src,'MODULE_VERSION: 69','MODULE_VERSION: 70','module version')

    state_block='''    var INITIAL_STAGED_SYNC_MIN_CARDS = 8;\n    var INITIAL_STAGED_SYNC_MAX_CARDS = 12;\n    var INITIAL_STAGED_MIN_REMAINING = 8;\n    var INITIAL_STAGED_BUDGET_MS = 14;\n    var INITIAL_STAGED_MAX_CARDS_PER_BATCH = 3;\n    var initialStagedGeneration = 0;\n    var initialStagedFillState = {\n        active: false,\n        generation: 0,\n        renderGeneration: 0,\n        rangeStart: 0,\n        rangeEnd: -1,\n        nextIndex: 0,\n        colors: null,\n        deferredOrigin: "",\n        deferredForce: false,\n        startedAtMs: 0,\n        firstBatchCards: 0,\n        maxBatchMs: 0\n    };\n'''
    src=replace_once(src,'    var LAZY_TRIGGER_MIN_DP = 120;\n',state_block+'    var LAZY_TRIGGER_MIN_DP = 120;\n','initial state')

    init_metrics='''        initialStagedStartCount: 0,\n        initialStagedBatchCount: 0,\n        initialStagedCardCount: 0,\n        initialStagedCompletedCount: 0,\n        initialStagedCancelCount: 0,\n        initialStagedDeferredUpdateCount: 0,\n        initialStagedPendingCount: 0,\n        initialStagedFirstBatchCards: 0,\n        initialStagedFirstBatchMs: 0,\n        initialStagedLastBatchMs: 0,\n        initialStagedMaxBatchMs: 0,\n        initialStagedLastBatchCards: 0,\n        initialStagedMaxCardsPerBatch: 0,\n        initialStagedLastTotalCards: 0,\n        initialStagedLastTotalMs: 0,\n        initialStagedMaxTotalMs: 0,\n        initialStagedSyncBuildAvoidedCount: 0,\n        initialStagedLastCancelReason: "",\n'''
    src=replace_once(src,
        '        keyedStagedLastCancelReason: "",\n        holderRecycleReleaseCount: 0,\n',
        '        keyedStagedLastCancelReason: "",\n'+init_metrics+'        holderRecycleReleaseCount: 0,\n',
        'metrics init')

    reset_metrics='''        scrollPerformanceState.initialStagedStartCount = 0;\n        scrollPerformanceState.initialStagedBatchCount = 0;\n        scrollPerformanceState.initialStagedCardCount = 0;\n        scrollPerformanceState.initialStagedCompletedCount = 0;\n        scrollPerformanceState.initialStagedCancelCount = 0;\n        scrollPerformanceState.initialStagedDeferredUpdateCount = 0;\n        scrollPerformanceState.initialStagedPendingCount = 0;\n        scrollPerformanceState.initialStagedFirstBatchCards = 0;\n        scrollPerformanceState.initialStagedFirstBatchMs = 0;\n        scrollPerformanceState.initialStagedLastBatchMs = 0;\n        scrollPerformanceState.initialStagedMaxBatchMs = 0;\n        scrollPerformanceState.initialStagedLastBatchCards = 0;\n        scrollPerformanceState.initialStagedMaxCardsPerBatch = 0;\n        scrollPerformanceState.initialStagedLastTotalCards = 0;\n        scrollPerformanceState.initialStagedLastTotalMs = 0;\n        scrollPerformanceState.initialStagedMaxTotalMs = 0;\n        scrollPerformanceState.initialStagedSyncBuildAvoidedCount = 0;\n        scrollPerformanceState.initialStagedLastCancelReason = "";\n'''
    src=replace_once(src,
        '        scrollPerformanceState.keyedStagedLastCancelReason = "";\n        scrollPerformanceState.holderRecycleReleaseCount = 0;\n',
        '        scrollPerformanceState.keyedStagedLastCancelReason = "";\n'+reset_metrics+'        scrollPerformanceState.holderRecycleReleaseCount = 0;\n',
        'metrics reset')
    src=insert_status_metrics(src)

    helpers=r'''    function clearInitialStagedFillState() {
        initialStagedFillState.active = false;
        initialStagedFillState.generation = 0;
        initialStagedFillState.renderGeneration = 0;
        initialStagedFillState.rangeStart = 0;
        initialStagedFillState.rangeEnd = -1;
        initialStagedFillState.nextIndex = 0;
        initialStagedFillState.colors = null;
        initialStagedFillState.deferredOrigin = "";
        initialStagedFillState.deferredForce = false;
        initialStagedFillState.startedAtMs = 0;
        initialStagedFillState.firstBatchCards = 0;
        initialStagedFillState.maxBatchMs = 0;
        scrollPerformanceState.initialStagedPendingCount = 0;
    }

    function cancelInitialStagedFill(reason) {
        if (initialStagedFillState.active !== true) { return false; }
        scrollPerformanceState.initialStagedCancelCount += 1;
        scrollPerformanceState.initialStagedLastCancelReason =
            String(reason || "cancelled");
        panelDataDirty = true;
        state.panelDataDirty = true;
        clearInitialStagedFillState();
        return true;
    }

    function deferVirtualUpdateDuringInitialStagedFill(origin, force) {
        initialStagedFillState.deferredOrigin =
            String(origin || "virtual_rebuild");
        initialStagedFillState.deferredForce =
            initialStagedFillState.deferredForce === true || force === true;
        scrollPerformanceState.initialStagedDeferredUpdateCount += 1;
        virtualState.updateDeferred = true;
        return true;
    }

    function postInitialStagedFillBatch(generation) {
        if (mainHandler === null) { return false; }
        mainHandler.post(new Packages.java.lang.Runnable({
            run: function () {
                runInitialStagedFillBatch(generation);
            }
        }));
        return true;
    }

    function recoverInitialStagedFill(reason) {
        cancelInitialStagedFill(reason);
        if (state.panelAttached && mainHandler !== null) {
            schedulePanelRefresh("panel_data_refresh", true, false);
        }
        return false;
    }

    function finishInitialStagedFill(generation) {
        var renderGen;
        var colors;
        var deferredOrigin;
        var deferredForce;
        var range;
        var totalElapsed;
        var result;
        if (initialStagedFillState.active !== true ||
                Number(initialStagedFillState.generation) !== Number(generation) ||
                !state.panelAttached || virtualCardHost === null) {
            return false;
        }
        renderGen = Number(initialStagedFillState.renderGeneration);
        colors = initialStagedFillState.colors;
        deferredOrigin = String(initialStagedFillState.deferredOrigin || "");
        deferredForce = initialStagedFillState.deferredForce === true;
        range = {
            start: Number(initialStagedFillState.rangeStart),
            end: Number(initialStagedFillState.rangeEnd),
            first: Number(virtualState.firstVisibleIndex),
            last: Number(virtualState.lastVisibleIndex)
        };
        totalElapsed = Math.max(0, Number(System.currentTimeMillis()) -
            Number(initialStagedFillState.startedAtMs));
        scrollPerformanceState.initialStagedCompletedCount += 1;
        scrollPerformanceState.initialStagedLastTotalMs = totalElapsed;
        scrollPerformanceState.initialStagedMaxTotalMs = Math.max(
            Number(scrollPerformanceState.initialStagedMaxTotalMs), totalElapsed);
        syncRenderedResultCounters(range);
        virtualState.firstRenderedIndex = range.start;
        virtualState.lastRenderedIndex = range.end;
        virtualState.topSpacerPx = setVirtualSpacerHeight(
            virtualTopSpacer, virtualHeightRange(0, range.start));
        virtualState.bottomSpacerPx = setVirtualSpacerHeight(
            virtualBottomSpacer, virtualHeightRange(range.end + 1, previewRows.length));
        virtualState.updateCount += 1;
        virtualState.rebuildCount += 1;
        virtualState.updateDeferred = false;
        virtualState.lastOrigin = "panel_first_content_initial_staged";
        virtualState.lastError = null;
        virtualGeneration += 1;
        renderCursor = Number(range.end) + 1;
        clearInitialStagedFillState();
        result = finishResultRender(renderGen, colors);
        if (deferredOrigin.length > 0 && state.panelAttached && mainHandler !== null) {
            scheduleVirtualUpdate(deferredOrigin, deferredForce);
        }
        return result;
    }

    function runInitialStagedFillBatch(generation) {
        var startedAt;
        var elapsed = 0;
        var batchCards = 0;
        var index;
        var signature;
        if (initialStagedFillState.active !== true ||
                Number(initialStagedFillState.generation) !== Number(generation)) {
            return false;
        }
        if (!state.panelAttached || virtualCardHost === null ||
                Number(initialStagedFillState.renderGeneration) !==
                    Number(renderGeneration)) {
            return recoverInitialStagedFill("stale_or_detached");
        }
        startedAt = Number(System.currentTimeMillis());
        while (Number(initialStagedFillState.nextIndex) <=
                Number(initialStagedFillState.rangeEnd)) {
            index = Number(initialStagedFillState.nextIndex);
            if (index < 0 || index >= previewRows.length ||
                    previewRows[index] === null || previewRows[index] === undefined) {
                return recoverInitialStagedFill("row_missing");
            }
            signature = virtualRenderSignature(
                previewRows[index], initialStagedFillState.colors);
            insertVirtualEntryAt(
                Number(virtualCardHost.getChildCount()),
                previewRows[index], initialStagedFillState.colors, signature);
            initialStagedFillState.nextIndex = index + 1;
            batchCards += 1;
            scrollPerformanceState.initialStagedCardCount += 1;
            elapsed = Math.max(0,
                Number(System.currentTimeMillis()) - startedAt);
            if (batchCards >= INITIAL_STAGED_MAX_CARDS_PER_BATCH ||
                    elapsed >= INITIAL_STAGED_BUDGET_MS) {
                break;
            }
        }
        elapsed = Math.max(0, Number(System.currentTimeMillis()) - startedAt);
        renderBatchCount += 1;
        state.renderBatchCount = renderBatchCount;
        scrollPerformanceState.initialStagedBatchCount += 1;
        scrollPerformanceState.initialStagedLastBatchMs = elapsed;
        scrollPerformanceState.initialStagedMaxBatchMs = Math.max(
            Number(scrollPerformanceState.initialStagedMaxBatchMs), elapsed);
        scrollPerformanceState.initialStagedLastBatchCards = batchCards;
        scrollPerformanceState.initialStagedMaxCardsPerBatch = Math.max(
            Number(scrollPerformanceState.initialStagedMaxCardsPerBatch), batchCards);
        initialStagedFillState.maxBatchMs = Math.max(
            Number(initialStagedFillState.maxBatchMs), elapsed);
        scrollPerformanceState.initialStagedPendingCount = Math.max(0,
            Number(initialStagedFillState.rangeEnd) -
            Number(initialStagedFillState.nextIndex) + 1);
        virtualState.lastRenderedIndex = Math.max(
            Number(initialStagedFillState.rangeStart) - 1,
            Number(initialStagedFillState.nextIndex) - 1);
        virtualState.bottomSpacerPx = setVirtualSpacerHeight(
            virtualBottomSpacer, virtualHeightRange(
                virtualState.lastRenderedIndex + 1, previewRows.length));
        syncRenderedResultCounters({
            start: Number(initialStagedFillState.rangeStart),
            end: Number(virtualState.lastRenderedIndex)
        });
        scrollPerformanceState.viewRebuildLastMs = elapsed;
        scrollPerformanceState.viewRebuildMaxMs = Math.max(
            Number(scrollPerformanceState.viewRebuildMaxMs), elapsed);
        if (Number(initialStagedFillState.nextIndex) <=
                Number(initialStagedFillState.rangeEnd)) {
            if (!postInitialStagedFillBatch(generation)) {
                return recoverInitialStagedFill("post_failed");
            }
            return true;
        }
        return finishInitialStagedFill(generation);
    }

    function startInitialStagedFill(range, colors, renderGen, rebuildStartedAt) {
        var totalCount;
        var visibleCount;
        var syncCount;
        var remainingCount;
        var index;
        var signature;
        var syncElapsed;
        var generation;
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
        syncCount = Math.max(INITIAL_STAGED_SYNC_MIN_CARDS,
            Math.min(INITIAL_STAGED_SYNC_MAX_CARDS, visibleCount + 3));
        syncCount = Math.min(totalCount, syncCount);
        remainingCount = Math.max(0, totalCount - syncCount);
        if (remainingCount < INITIAL_STAGED_MIN_REMAINING) {
            return false;
        }
        for (index = Number(range.start);
                index < Number(range.start) + syncCount; index += 1) {
            if (previewRows[index] === null || previewRows[index] === undefined) {
                return false;
            }
            signature = virtualRenderSignature(previewRows[index], colors);
            insertVirtualEntryAt(
                Number(virtualCardHost.getChildCount()),
                previewRows[index], colors, signature);
        }
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
        initialStagedFillState.startedAtMs = Number(System.currentTimeMillis());
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
    anchor='    function rebuildVirtualWindow(origin, force, preferredIndex) {\n'
    src=replace_once(src,anchor,helpers+anchor,'helpers')

    old_guard='''        if (keyedStagedState.active === true) {\n            deferVirtualUpdateDuringKeyedStaged(origin, force);\n            return false;\n        }\n        if (activeSwipeCard !== null) {'''
    new_guard='''        if (keyedStagedState.active === true) {\n            deferVirtualUpdateDuringKeyedStaged(origin, force);\n            return false;\n        }\n        if (initialStagedFillState.active === true) {\n            deferVirtualUpdateDuringInitialStagedFill(origin, force);\n            return false;\n        }\n        if (activeSwipeCard !== null) {'''
    src=replace_once(src,old_guard,new_guard,'rebuild guard')

    old_start='''        recycledCount = oldCount;\n        overlap = force !== true && oldCount > 0 &&'''
    new_start='''        recycledCount = oldCount;\n        if (String(origin || "") === "full_refresh" && force === true &&\n                oldCount === 0 && startInitialStagedFill(\n                    range, colors, renderGeneration, viewRebuildStartedAt)) {\n            return true;\n        }\n        overlap = force !== true && oldCount > 0 &&'''
    src=replace_once(src,old_start,new_start,'initial route')

    old_refresh_head='''        if (resultContainer === null) { return false; }\n        scrollPerformanceState.fullRefreshRequestCount += 1;'''
    new_refresh_head='''        if (resultContainer === null) { return false; }\n        if (initialStagedFillState.active === true) {\n            cancelInitialStagedFill("superseded_full_refresh");\n        }\n        scrollPerformanceState.fullRefreshRequestCount += 1;'''
    src=replace_once(src,old_refresh_head,new_refresh_head,'refresh cancel')

    old_finish='''        rebuildVirtualWindow(\n            "full_refresh", true, preferredIndex);\n        renderCursor = Math.max(0,\n            Number(virtualState.lastRenderedIndex) + 1);\n        renderBatchCount = 1;\n        performance.firstBatchReadyAtNs = nowNanos();\n        performance.showToFirstBatchMs = elapsedMs(\n            performance.showStartedAtNs,\n            performance.firstBatchReadyAtNs);\n        return finishResultRender(generation, colors);'''
    new_finish='''        rebuildVirtualWindow(\n            "full_refresh", true, preferredIndex);\n        if (initialStagedFillState.active === true) {\n            return true;\n        }\n        renderCursor = Math.max(0,\n            Number(virtualState.lastRenderedIndex) + 1);\n        renderBatchCount = 1;\n        performance.firstBatchReadyAtNs = nowNanos();\n        performance.showToFirstBatchMs = elapsedMs(\n            performance.showStartedAtNs,\n            performance.firstBatchReadyAtNs);\n        return finishResultRender(generation, colors);'''
    src=replace_once(src,old_finish,new_finish,'refresh staged return')

    src=replace_once(src,
        '    function resetVirtualState(clearHeights) {\n        cancelOverlapStagedFill("reset_virtual_state");\n',
        '    function resetVirtualState(clearHeights) {\n        cancelInitialStagedFill("reset_virtual_state");\n        cancelOverlapStagedFill("reset_virtual_state");\n',
        'reset cancel')
    src=replace_once(src,
        '    function closePanel(options) {\n        cancelOverlapStagedFill("close_panel");\n',
        '    function closePanel(options) {\n        cancelInitialStagedFill("close_panel");\n        cancelOverlapStagedFill("close_panel");\n',
        'close cancel')

    for name in keep:
        after=function_block(src,name)
        if after!=before[name]:
            raise RuntimeError('preserved function changed '+name)
    return src

def build():
    loader=LOADER.read_text(encoding='utf-8')
    manifest=json.loads(MANIFEST.read_text(encoding='utf-8'))
    if manifest.get('moduleSetVersion')!='20260808.23':
        raise RuntimeError('expected .23 manifest')
    src=decode_source(loader)
    out=transform(src)
    if 'MODULE_VERSION: 70' not in out:
        raise RuntimeError('Filter70 version missing')
    required=[
        'INITIAL_STAGED_SYNC_MIN_CARDS = 8',
        'INITIAL_STAGED_SYNC_MAX_CARDS = 12',
        'INITIAL_STAGED_MIN_REMAINING = 8',
        'INITIAL_STAGED_BUDGET_MS = 14',
        'INITIAL_STAGED_MAX_CARDS_PER_BATCH = 3',
        'function startInitialStagedFill',
        'function runInitialStagedFillBatch',
        'initialStagedSyncBuildAvoidedCount',
        'cancelInitialStagedFill("close_panel")',
        'cancelInitialStagedFill("reset_virtual_state")',
        'VIRTUAL_BEFORE_SCREENS = 3',
        'VIRTUAL_AFTER_SCREENS = 5',
        'VIRTUAL_UPDATE_DELAY_MS = 24',
        'AJAX_STAGED_ATTACH_BUDGET_MS = 14',
        'AJAX_STAGED_ATTACH_MAX_CARDS_PER_BATCH = 3',
        'OVERLAP_STAGED_FILL_BUDGET_MS = 14',
        'KEYED_STAGED_BUDGET_MS = 14'
    ]
    for token in required:
        if token not in out:
            raise RuntimeError('missing token '+token)
    if out.count('.newSingleThreadExecutor();')!=1:
        raise RuntimeError('hydration executor invariant')
    if re.search(r'(^|[^A-Za-z0-9_])(let|const|class)[\s]+|=>',out):
        raise RuntimeError('non ES5 syntax')
    pathlib.Path('/tmp/filter70.js').write_text(out,encoding='utf-8')
    subprocess.check_call(['node','--check','/tmp/filter70.js'])

    source_sha=hashlib.sha256(out.encode('utf-8')).hexdigest()
    old_source=re.search(r'var SOURCE_SHA256 = "[0-9a-f]+";',loader)
    if not old_source: raise RuntimeError('SOURCE_SHA256 anchor missing')
    loader=loader[:old_source.start()]+'var SOURCE_SHA256 = "'+source_sha+'";'+loader[old_source.end():]
    m=re.search(r'var PACKED_B64 =\n((?:\s*"[A-Za-z0-9+/=]+"\s*\+?\n?)+);',loader)
    if not m: raise RuntimeError('packed assignment missing')
    assignment=encode_assignment(out)
    loader=loader[:m.start()]+assignment+loader[m.end():]
    loader=replace_once(loader,
        '/* ClipHub Stage 19 keyed staged reconcile and AJAX fallback packed full Filter69 ES5 loader. */',
        '/* ClipHub Stage 20 initial virtual window staged fill packed full Filter70 ES5 loader. */',
        'loader header')
    pathlib.Path('/tmp/loader70.js').write_text(loader,encoding='utf-8')
    subprocess.check_call(['node','--check','/tmp/loader70.js'])
    LOADER.write_text(loader,encoding='utf-8')

    data=loader.encode('utf-8')
    blob_sha=hashlib.sha1(('blob %d\0'%len(data)).encode('ascii')+data).hexdigest()
    manifest['moduleSetVersion']='20260808.24'
    found=False
    for mod in manifest.get('modules',[]):
        if mod.get('name')=='ch_11_filter.js':
            mod['sha']=blob_sha
            found=True
    if not found: raise RuntimeError('manifest filter missing')
    MANIFEST.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return blob_sha,source_sha

def git_config():
    subprocess.check_call(['git','config','user.name','github-actions[bot]'])
    subprocess.check_call(['git','config','user.email','41898282+github-actions[bot]@users.noreply.github.com'])

def restore():
    run(['git','restore','src/ch_11_filter.js','module-manifest.json'])

def fail(exc):
    restore()
    pathlib.Path('stage20_build_error.txt').write_text(repr(exc)+'\n',encoding='utf-8')
    git_config()
    subprocess.check_call(['git','add','stage20_build_error.txt'])
    if run(['git','diff','--cached','--quiet']).returncode!=0:
        subprocess.check_call(['git','commit','-m','记录 Stage20 构建失败诊断'])
        subprocess.check_call(['git','push'])

def publish(blob_sha,source_sha):
    git_config()
    for name in [
        '.github/stage20_diag_trigger.txt',
        '.github/workflows/beta_stage20_diag.yml',
        '.github/stage20_build_trigger.txt',
        '.github/workflows/beta_stage20_build.yml',
        'stage20_diag.py','stage20_diag.txt',
        'stage20_target_diag.py','stage20_target_diag.txt',
        'stage20_build.py','stage20_build_error.txt'
    ]:
        try: pathlib.Path(name).unlink()
        except FileNotFoundError: pass
    subprocess.check_call(['git','add','-A'])
    subprocess.check_call(['git','diff','--cached','--check'])
    subprocess.check_call(['git','commit','-m','优化 Beta 首次 virtual window 分帧渲染'])
    subprocess.check_call(['git','push'])
    print('Filter70 blob',blob_sha)
    print('Filter70 source sha256',source_sha)

def main():
    try:
        b,s=build()
    except Exception as exc:
        fail(exc)
        return 0
    publish(b,s)
    return 0

if __name__=='__main__':
    sys.exit(main())
