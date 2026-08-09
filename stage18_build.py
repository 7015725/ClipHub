import base64,gzip,hashlib,json,pathlib,re,subprocess,sys

LOADER=pathlib.Path('src/ch_11_filter.js')
MANIFEST=pathlib.Path('module-manifest.json')
BRANCH='beta-pagination-stage10-20260808'


def run(args, **kwargs):
    return subprocess.run(args,text=True,**kwargs)

def replace_once(text,old,new,label):
    c=text.count(old)
    if c!=1: raise RuntimeError('%s count=%d' % (label,c))
    return text.replace(old,new,1)

def decode_filter67(loader):
    if 'Stage 17.2 staged retarget packed full Filter67 ES5 loader' not in loader:
        raise RuntimeError('expected Filter67 packed loader')
    m=re.search(r'var PACKED_B64 =\n((?:\s*"[A-Za-z0-9+/=]+"\s*\+?\n?)+);',loader)
    if not m: raise RuntimeError('PACKED_B64 missing')
    packed=''.join(re.findall(r'"([A-Za-z0-9+/=]+)"',m.group(1)))
    return gzip.decompress(base64.b64decode(packed)).decode('utf-8')

def insert_status_metrics(src):
    metrics='''\n            overlapStagedStartCount:\n                Number(scrollPerformanceState.overlapStagedStartCount),\n            overlapStagedBatchCount:\n                Number(scrollPerformanceState.overlapStagedBatchCount),\n            overlapStagedCardCount:\n                Number(scrollPerformanceState.overlapStagedCardCount),\n            overlapStagedNewBuildCount:\n                Number(scrollPerformanceState.overlapStagedNewBuildCount),\n            overlapStagedRecycleAttachCount:\n                Number(scrollPerformanceState.overlapStagedRecycleAttachCount),\n            overlapStagedCompletedCount:\n                Number(scrollPerformanceState.overlapStagedCompletedCount),\n            overlapStagedCancelCount:\n                Number(scrollPerformanceState.overlapStagedCancelCount),\n            overlapStagedDeferredUpdateCount:\n                Number(scrollPerformanceState.overlapStagedDeferredUpdateCount),\n            overlapStagedPendingCount:\n                Number(scrollPerformanceState.overlapStagedPendingCount),\n            overlapStagedLastBatchMs:\n                Number(scrollPerformanceState.overlapStagedLastBatchMs),\n            overlapStagedMaxBatchMs:\n                Number(scrollPerformanceState.overlapStagedMaxBatchMs),\n            overlapStagedLastBatchCards:\n                Number(scrollPerformanceState.overlapStagedLastBatchCards),\n            overlapStagedMaxCardsPerBatch:\n                Number(scrollPerformanceState.overlapStagedMaxCardsPerBatch),\n            overlapStagedLastTotalCards:\n                Number(scrollPerformanceState.overlapStagedLastTotalCards),\n            overlapStagedLastNewBuildTotal:\n                Number(scrollPerformanceState.overlapStagedLastNewBuildTotal),\n            overlapStagedLastTotalMs:\n                Number(scrollPerformanceState.overlapStagedLastTotalMs),\n            overlapStagedMaxTotalMs:\n                Number(scrollPerformanceState.overlapStagedMaxTotalMs),\n            overlapStagedSyncBuildAvoidedCount:\n                Number(scrollPerformanceState.overlapStagedSyncBuildAvoidedCount),\n            overlapStagedLastCancelReason:\n                String(scrollPerformanceState.overlapStagedLastCancelReason || ""),'''
    pat=re.compile(r'(\n\s*stagedAttachLastCancelReason\s*:\s*(?:\n\s*)?String\(\s*scrollPerformanceState\.stagedAttachLastCancelReason\s*\|\|\s*""\s*\),)')
    ms=list(pat.finditer(src))
    if len(ms)!=1:
        raise RuntimeError('status anchor count=%d' % len(ms))
    m=ms[0]
    return src[:m.end()]+metrics+src[m.end():]

def transform(src):
    src=replace_once(src,'MODULE_VERSION: 67','MODULE_VERSION: 68','module version')
    state_block='''    var OVERLAP_STAGED_FILL_BUDGET_MS = 14;\n    var OVERLAP_STAGED_FILL_MAX_CARDS_PER_BATCH = 3;\n    var OVERLAP_STAGED_FILL_MIN_NEW_BUILDS = 8;\n    var overlapStagedFillGeneration = 0;\n    var overlapStagedFillState = {\n        active: false,\n        generation: 0,\n        origin: "",\n        rangeStart: 0,\n        rangeEnd: -1,\n        nextPlanIndex: 0,\n        currentEnd: -1,\n        plan: [],\n        colors: null,\n        deferredOrigin: "",\n        deferredForce: false,\n        startedAtMs: 0,\n        removedCount: 0,\n        oldCount: 0,\n        newBuildTotal: 0,\n        recycleTotal: 0\n    };\n'''
    src=replace_once(src,'    var LAZY_TRIGGER_MIN_DP = 120;\n',state_block+'    var LAZY_TRIGGER_MIN_DP = 120;\n','stage state')

    init_metrics='''        overlapStagedStartCount: 0,\n        overlapStagedBatchCount: 0,\n        overlapStagedCardCount: 0,\n        overlapStagedNewBuildCount: 0,\n        overlapStagedRecycleAttachCount: 0,\n        overlapStagedCompletedCount: 0,\n        overlapStagedCancelCount: 0,\n        overlapStagedDeferredUpdateCount: 0,\n        overlapStagedPendingCount: 0,\n        overlapStagedLastBatchMs: 0,\n        overlapStagedMaxBatchMs: 0,\n        overlapStagedLastBatchCards: 0,\n        overlapStagedMaxCardsPerBatch: 0,\n        overlapStagedLastTotalCards: 0,\n        overlapStagedLastNewBuildTotal: 0,\n        overlapStagedLastTotalMs: 0,\n        overlapStagedMaxTotalMs: 0,\n        overlapStagedSyncBuildAvoidedCount: 0,\n        overlapStagedLastCancelReason: "",\n'''
    src=replace_once(src,'        stagedAttachLastCancelReason: "",\n        holderRecycleReleaseCount: 0,\n','        stagedAttachLastCancelReason: "",\n'+init_metrics+'        holderRecycleReleaseCount: 0,\n','metrics init')

    reset_metrics='''        scrollPerformanceState.overlapStagedStartCount = 0;\n        scrollPerformanceState.overlapStagedBatchCount = 0;\n        scrollPerformanceState.overlapStagedCardCount = 0;\n        scrollPerformanceState.overlapStagedNewBuildCount = 0;\n        scrollPerformanceState.overlapStagedRecycleAttachCount = 0;\n        scrollPerformanceState.overlapStagedCompletedCount = 0;\n        scrollPerformanceState.overlapStagedCancelCount = 0;\n        scrollPerformanceState.overlapStagedDeferredUpdateCount = 0;\n        scrollPerformanceState.overlapStagedPendingCount = 0;\n        scrollPerformanceState.overlapStagedLastBatchMs = 0;\n        scrollPerformanceState.overlapStagedMaxBatchMs = 0;\n        scrollPerformanceState.overlapStagedLastBatchCards = 0;\n        scrollPerformanceState.overlapStagedMaxCardsPerBatch = 0;\n        scrollPerformanceState.overlapStagedLastTotalCards = 0;\n        scrollPerformanceState.overlapStagedLastNewBuildTotal = 0;\n        scrollPerformanceState.overlapStagedLastTotalMs = 0;\n        scrollPerformanceState.overlapStagedMaxTotalMs = 0;\n        scrollPerformanceState.overlapStagedSyncBuildAvoidedCount = 0;\n        scrollPerformanceState.overlapStagedLastCancelReason = "";\n'''
    src=replace_once(src,'        scrollPerformanceState.stagedAttachLastCancelReason = "";\n        scrollPerformanceState.holderRecycleReleaseCount = 0;\n','        scrollPerformanceState.stagedAttachLastCancelReason = "";\n'+reset_metrics+'        scrollPerformanceState.holderRecycleReleaseCount = 0;\n','metrics reset')
    src=insert_status_metrics(src)

    helpers=r'''    function estimateOverlapStagedNewBuildCount(startIndex, endIndex, recyclePool) {
        var poolCopy = recyclePool === null || recyclePool === undefined ? [] :
            recyclePool.slice(0);
        var index;
        var holderRef;
        var misses = 0;
        var scanBefore = Number(scrollPerformanceState.holderRecyclePoolScanCount);
        for (index = Number(startIndex); index <= Number(endIndex); index += 1) {
            holderRef = null;
            if (poolCopy.length > 0 && previewRows[index] !== null &&
                    previewRows[index] !== undefined) {
                holderRef = takeCompatibleRecycleHolder(poolCopy, previewRows[index]);
            }
            if (holderRef === null || holderRef === undefined) {
                misses += 1;
            }
        }
        scrollPerformanceState.holderRecyclePoolScanCount = scanBefore;
        return misses;
    }

    function clearOverlapStagedFillState() {
        overlapStagedFillState.active = false;
        overlapStagedFillState.generation = 0;
        overlapStagedFillState.origin = "";
        overlapStagedFillState.rangeStart = 0;
        overlapStagedFillState.rangeEnd = -1;
        overlapStagedFillState.nextPlanIndex = 0;
        overlapStagedFillState.currentEnd = -1;
        overlapStagedFillState.plan = [];
        overlapStagedFillState.colors = null;
        overlapStagedFillState.deferredOrigin = "";
        overlapStagedFillState.deferredForce = false;
        overlapStagedFillState.startedAtMs = 0;
        overlapStagedFillState.removedCount = 0;
        overlapStagedFillState.oldCount = 0;
        overlapStagedFillState.newBuildTotal = 0;
        overlapStagedFillState.recycleTotal = 0;
        scrollPerformanceState.overlapStagedPendingCount = 0;
    }

    function cancelOverlapStagedFill(reason) {
        var i;
        var pendingHolderCount = 0;
        if (overlapStagedFillState.active !== true) {
            return false;
        }
        for (i = Number(overlapStagedFillState.nextPlanIndex);
                i < overlapStagedFillState.plan.length; i += 1) {
            if (overlapStagedFillState.plan[i] !== null &&
                    overlapStagedFillState.plan[i] !== undefined &&
                    overlapStagedFillState.plan[i].holder !== null &&
                    overlapStagedFillState.plan[i].holder !== undefined) {
                pendingHolderCount += 1;
            }
        }
        if (pendingHolderCount > 0) {
            scrollPerformanceState.holderRecycleDiscardCount += pendingHolderCount;
        }
        scrollPerformanceState.overlapStagedCancelCount += 1;
        scrollPerformanceState.overlapStagedLastCancelReason =
            String(reason || "cancelled");
        clearOverlapStagedFillState();
        return true;
    }

    function deferVirtualUpdateDuringOverlapStagedFill(origin, force) {
        overlapStagedFillState.deferredOrigin = String(origin || "virtual_rebuild");
        overlapStagedFillState.deferredForce =
            overlapStagedFillState.deferredForce === true || force === true;
        scrollPerformanceState.overlapStagedDeferredUpdateCount += 1;
        virtualState.updateDeferred = true;
        return true;
    }

    function postOverlapStagedFillBatch(generation) {
        if (mainHandler === null) { return false; }
        mainHandler.post(new Packages.java.lang.Runnable({
            run: function () {
                runOverlapStagedFillBatch(generation);
            }
        }));
        return true;
    }

    function finishOverlapStagedFill(generation) {
        var deferredOrigin;
        var deferredForce;
        var totalElapsed;
        var range;
        var removedCount;
        if (overlapStagedFillState.active !== true ||
                Number(overlapStagedFillState.generation) !== Number(generation) ||
                !state.panelAttached || virtualCardHost === null) {
            return false;
        }
        deferredOrigin = String(overlapStagedFillState.deferredOrigin || "");
        deferredForce = overlapStagedFillState.deferredForce === true;
        totalElapsed = Math.max(0, Number(System.currentTimeMillis()) -
            Number(overlapStagedFillState.startedAtMs));
        removedCount = Number(overlapStagedFillState.removedCount);
        range = {
            start: Number(overlapStagedFillState.rangeStart),
            end: Number(overlapStagedFillState.rangeEnd),
            first: Number(virtualState.firstVisibleIndex),
            last: Number(virtualState.lastVisibleIndex)
        };
        scrollPerformanceState.overlapStagedCompletedCount += 1;
        scrollPerformanceState.overlapStagedLastTotalMs = totalElapsed;
        scrollPerformanceState.overlapStagedMaxTotalMs = Math.max(
            Number(scrollPerformanceState.overlapStagedMaxTotalMs), totalElapsed);
        clearOverlapStagedFillState();
        syncRenderedResultCounters(range);
        virtualState.firstRenderedIndex = range.start;
        virtualState.lastRenderedIndex = range.end;
        virtualState.topSpacerPx = setVirtualSpacerHeight(
            virtualTopSpacer, virtualHeightRange(0, range.start));
        virtualState.bottomSpacerPx = setVirtualSpacerHeight(
            virtualBottomSpacer, virtualHeightRange(range.end + 1, previewRows.length));
        virtualState.updateCount += 1;
        virtualState.rebuildCount += 1;
        virtualState.recycleCount += removedCount;
        virtualState.updateDeferred = false;
        virtualState.lastOrigin = "hydration_apply_overlap_staged";
        virtualState.lastError = null;
        virtualGeneration += 1;
        if (mainHandler !== null) {
            mainHandler.post(new Packages.java.lang.Runnable({
                run: function () {
                    if (!state.panelAttached || virtualCardHost === null) { return; }
                    measureVirtualCards();
                    restoreScrollAnchor();
                    captureScrollAnchor();
                    updateQuickResetView();
                }
            }));
        }
        if (deferredOrigin.length > 0 && state.panelAttached && mainHandler !== null) {
            scheduleVirtualUpdate(deferredOrigin, deferredForce);
        }
        return true;
    }

    function runOverlapStagedFillBatch(generation) {
        var startedAt;
        var elapsed = 0;
        var batchCards = 0;
        var entry;
        var row;
        var params;
        var wrapper;
        var cardRef;
        var holderRef;
        var actionRef;
        if (overlapStagedFillState.active !== true ||
                Number(overlapStagedFillState.generation) !== Number(generation)) {
            return false;
        }
        if (!state.panelAttached || virtualCardHost === null) {
            cancelOverlapStagedFill("panel_detached");
            return false;
        }
        startedAt = Number(System.currentTimeMillis());
        while (Number(overlapStagedFillState.nextPlanIndex) <
                overlapStagedFillState.plan.length) {
            entry = overlapStagedFillState.plan[
                Number(overlapStagedFillState.nextPlanIndex)];
            row = previewRows[Number(entry.index)];
            if (row === null || row === undefined) {
                cancelOverlapStagedFill("row_missing");
                scheduleVirtualUpdate("hydration_apply", true);
                return false;
            }
            params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
            params.bottomMargin = dp(6);
            holderRef = entry.holder;
            if (holderRef !== null && holderRef !== undefined) {
                wrapper = holderRef.wrapper;
                cardRef = holderRef.card;
                actionRef = cardHolderActionRefs(holderRef);
                scrollPerformanceState.overlapStagedRecycleAttachCount += 1;
            } else {
                wrapper = makeResultCard(row, overlapStagedFillState.colors);
                cardRef = resultCardViews.pop();
                holderRef = resultCardHolders.pop();
                actionRef = resultActionViews.pop();
                scrollPerformanceState.holderRecycleMissCount += 1;
                scrollPerformanceState.overlapStagedNewBuildCount += 1;
            }
            virtualCardHost.addView(wrapper, params);
            resultCardViews.push(cardRef);
            resultCardHolders.push(holderRef);
            resultActionViews.push(actionRef);
            virtualRenderedItemIds.push(Number(row.id));
            virtualRenderedSignatures.push(
                virtualRenderSignature(row, overlapStagedFillState.colors));
            scrollPerformanceState.createdViewCount += 1;
            scrollPerformanceState.structuralInsertCount += 1;
            scrollPerformanceState.overlapStagedCardCount += 1;
            overlapStagedFillState.currentEnd = Number(entry.index);
            overlapStagedFillState.nextPlanIndex += 1;
            batchCards += 1;
            elapsed = Math.max(0, Number(System.currentTimeMillis()) - startedAt);
            if (batchCards >= OVERLAP_STAGED_FILL_MAX_CARDS_PER_BATCH ||
                    elapsed >= OVERLAP_STAGED_FILL_BUDGET_MS) {
                break;
            }
        }
        elapsed = Math.max(0, Number(System.currentTimeMillis()) - startedAt);
        scrollPerformanceState.overlapStagedBatchCount += 1;
        scrollPerformanceState.overlapStagedLastBatchMs = elapsed;
        scrollPerformanceState.overlapStagedMaxBatchMs = Math.max(
            Number(scrollPerformanceState.overlapStagedMaxBatchMs), elapsed);
        scrollPerformanceState.overlapStagedLastBatchCards = batchCards;
        scrollPerformanceState.overlapStagedMaxCardsPerBatch = Math.max(
            Number(scrollPerformanceState.overlapStagedMaxCardsPerBatch), batchCards);
        scrollPerformanceState.overlapStagedPendingCount = Math.max(0,
            overlapStagedFillState.plan.length -
            Number(overlapStagedFillState.nextPlanIndex));
        scrollPerformanceState.viewRebuildLastMs = elapsed;
        scrollPerformanceState.viewRebuildMaxMs = Math.max(
            Number(scrollPerformanceState.viewRebuildMaxMs), elapsed);
        scrollPerformanceState.overlapUpdateLastMs = elapsed;
        scrollPerformanceState.overlapUpdateMaxMs = Math.max(
            Number(scrollPerformanceState.overlapUpdateMaxMs), elapsed);
        virtualState.firstRenderedIndex = Number(overlapStagedFillState.rangeStart);
        virtualState.lastRenderedIndex = Number(overlapStagedFillState.currentEnd);
        virtualState.topSpacerPx = setVirtualSpacerHeight(
            virtualTopSpacer, virtualHeightRange(0, virtualState.firstRenderedIndex));
        virtualState.bottomSpacerPx = setVirtualSpacerHeight(
            virtualBottomSpacer,
            virtualHeightRange(virtualState.lastRenderedIndex + 1, previewRows.length));
        state.resultCardCount = Number(virtualCardHost.getChildCount());
        if (Number(overlapStagedFillState.nextPlanIndex) <
                overlapStagedFillState.plan.length) {
            if (!postOverlapStagedFillBatch(generation)) {
                cancelOverlapStagedFill("post_failed");
                scheduleVirtualUpdate("hydration_apply", true);
                return false;
            }
            return true;
        }
        return finishOverlapStagedFill(generation);
    }

    function startOverlapStagedFill(range, colors, oldEnd, oldCount,
            removedCount, recyclePool, origin) {
        var plan = [];
        var index;
        var holderRef;
        var buildCount = 0;
        var recycleCount = 0;
        var generation;
        if (mainHandler === null || virtualCardHost === null ||
                !state.panelAttached || activeSwipeCard !== null ||
                overlapStagedFillState.active === true) {
            return false;
        }
        for (index = Number(oldEnd) + 1; index <= Number(range.end); index += 1) {
            holderRef = null;
            if (recyclePool.length > 0) {
                scrollPerformanceState.holderRecyclePoolPeakCount = Math.max(
                    Number(scrollPerformanceState.holderRecyclePoolPeakCount),
                    Number(recyclePool.length));
                holderRef = takeCompatibleRecycleHolder(recyclePool, previewRows[index]);
                if (holderRef !== null && holderRef !== undefined) {
                    scrollPerformanceState.holderRecycleKeyHitCount += 1;
                    if (rebindResultCardHolder(holderRef, previewRows[index], colors)) {
                        scrollPerformanceState.holderRecycleReuseCount += 1;
                        recycleCount += 1;
                    } else {
                        scrollPerformanceState.holderRecycleDiscardCount += 1;
                        holderRef = null;
                    }
                } else {
                    scrollPerformanceState.holderRecycleKeyMissCount += 1;
                }
            }
            if (holderRef === null || holderRef === undefined) {
                buildCount += 1;
            }
            plan.push({ index: index, holder: holderRef });
        }
        if (recyclePool.length > 0) {
            scrollPerformanceState.holderRecycleDiscardCount += recyclePool.length;
            recyclePool.length = 0;
        }
        generation = ++overlapStagedFillGeneration;
        overlapStagedFillState.active = true;
        overlapStagedFillState.generation = generation;
        overlapStagedFillState.origin = String(origin || "hydration_apply");
        overlapStagedFillState.rangeStart = Number(range.start);
        overlapStagedFillState.rangeEnd = Number(range.end);
        overlapStagedFillState.nextPlanIndex = 0;
        overlapStagedFillState.currentEnd = Number(oldEnd);
        overlapStagedFillState.plan = plan;
        overlapStagedFillState.colors = colors;
        overlapStagedFillState.deferredOrigin = "";
        overlapStagedFillState.deferredForce = false;
        overlapStagedFillState.startedAtMs = Number(System.currentTimeMillis());
        overlapStagedFillState.removedCount = Number(removedCount);
        overlapStagedFillState.oldCount = Number(oldCount);
        overlapStagedFillState.newBuildTotal = buildCount;
        overlapStagedFillState.recycleTotal = recycleCount;
        scrollPerformanceState.overlapStagedStartCount += 1;
        scrollPerformanceState.overlapStagedLastTotalCards = plan.length;
        scrollPerformanceState.overlapStagedLastNewBuildTotal = buildCount;
        scrollPerformanceState.overlapStagedPendingCount = plan.length;
        scrollPerformanceState.overlapStagedSyncBuildAvoidedCount += buildCount;
        virtualState.firstRenderedIndex = Number(range.start);
        virtualState.lastRenderedIndex = Number(oldEnd);
        virtualState.topSpacerPx = setVirtualSpacerHeight(
            virtualTopSpacer, virtualHeightRange(0, range.start));
        virtualState.bottomSpacerPx = setVirtualSpacerHeight(
            virtualBottomSpacer, virtualHeightRange(oldEnd + 1, previewRows.length));
        state.resultCardCount = Number(virtualCardHost.getChildCount());
        if (!postOverlapStagedFillBatch(generation)) {
            cancelOverlapStagedFill("initial_post_failed");
            return false;
        }
        return true;
    }

'''
    anchor='    function rebuildVirtualWindow(origin, force, preferredIndex) {'
    src=replace_once(src,anchor,helpers+anchor,'helper insertion')

    guard='''        if (overlapStagedFillState.active === true) {\n            deferVirtualUpdateDuringOverlapStagedFill(origin, force);\n            return false;\n        }\n'''
    src=replace_once(src,'        if (activeSwipeCard !== null) {\n',guard+'        if (activeSwipeCard !== null) {\n','rebuild staged guard')

    fn_start=src.index('    function rebuildVirtualWindow(origin, force, preferredIndex) {')
    fn_end=src.index('\n    function ',fn_start+20)
    fn=src[fn_start:fn_end]
    append_anchor='            if (range.end > oldEnd) {\n'
    ap=fn.find(append_anchor)
    if ap<0: raise RuntimeError('forward append anchor missing')
    stage_gate='''            if (range.end > oldEnd &&\n                    String(origin || "") === "hydration_apply" &&\n                    range.start >= oldStart &&\n                    (range.end - oldEnd) >= OVERLAP_STAGED_FILL_MIN_NEW_BUILDS &&\n                    estimateOverlapStagedNewBuildCount(\n                        oldEnd + 1, range.end, recyclePool) >=\n                        OVERLAP_STAGED_FILL_MIN_NEW_BUILDS) {\n                if (startOverlapStagedFill(range, colors, oldEnd, oldCount,\n                        recycledCount, recyclePool,\n                        String(origin || "hydration_apply"))) {\n                    return true;\n                }\n            }\n'''
    fn=fn[:ap]+stage_gate+fn[ap:]
    src=src[:fn_start]+fn+src[fn_end:]

    src=replace_once(src,'    function resetVirtualState() {\n','    function resetVirtualState() {\n        cancelOverlapStagedFill("reset_virtual_state");\n','reset cancel')
    src=replace_once(src,'    function closePanel() {\n','    function closePanel() {\n        cancelOverlapStagedFill("close_panel");\n','close cancel')
    return src

def pack_loader(template,src):
    packed=base64.b64encode(gzip.compress(src.encode('utf-8'),compresslevel=9,mtime=0)).decode('ascii')
    pieces=[packed[i:i+120] for i in range(0,len(packed),120)]
    assignment='var PACKED_B64 =\n'+''.join('        '+json.dumps(p)+(' +\n' if i<len(pieces)-1 else ';') for i,p in enumerate(pieces))
    m=re.search(r'var PACKED_B64 =\n((?:\s*"[A-Za-z0-9+/=]+"\s*\+?\n?)+);',template)
    if not m: raise RuntimeError('loader PACKED_B64 anchor missing')
    out=template[:m.start()]+assignment+template[m.end():]
    out=replace_once(out,'/* ClipHub Stage 17.2 staged retarget packed full Filter67 ES5 loader. */','/* ClipHub Stage 18 hydration overlap staged fill packed full Filter68 ES5 loader. */','loader header')
    sha=hashlib.sha256(src.encode('utf-8')).hexdigest()
    out,n=re.subn(r'var SOURCE_SHA256 = "[0-9a-f]+";','var SOURCE_SHA256 = '+json.dumps(sha)+';',out,count=1)
    if n!=1: raise RuntimeError('loader source sha anchor')
    out=out.replace('Stage 17.2','Stage 18').replace('Filter67','Filter68')
    return out,sha

def validate(src,loader):
    pathlib.Path('/tmp/filter68.js').write_text(src,encoding='utf-8')
    pathlib.Path('/tmp/filter68_loader.js').write_text(loader,encoding='utf-8')
    subprocess.check_call(['node','--check','/tmp/filter68.js'])
    subprocess.check_call(['node','--check','/tmp/filter68_loader.js'])
    required=[
      'MODULE_VERSION: 68','OVERLAP_STAGED_FILL_BUDGET_MS = 14',
      'OVERLAP_STAGED_FILL_MAX_CARDS_PER_BATCH = 3',
      'OVERLAP_STAGED_FILL_MIN_NEW_BUILDS = 8',
      'function estimateOverlapStagedNewBuildCount',
      'function startOverlapStagedFill','function runOverlapStagedFillBatch',
      'function finishOverlapStagedFill','function cancelOverlapStagedFill',
      'String(origin || "") === "hydration_apply"',
      'overlapStagedSyncBuildAvoidedCount',
      'stagedAttachRetargetCount','stagedAttachSyncCatchupAvoidedCount',
      'VIRTUAL_BEFORE_SCREENS = 3','VIRTUAL_AFTER_SCREENS = 5',
      'VIRTUAL_UPDATE_DELAY_MS = 24','AJAX_STAGED_ATTACH_BUDGET_MS = 14',
      'AJAX_STAGED_ATTACH_DELAY_MS = 0','AJAX_STAGED_ATTACH_MAX_CARDS_PER_BATCH = 3'
    ]
    for token in required:
        if token not in src: raise RuntimeError('missing token '+token)
    if src.count('.newSingleThreadExecutor();')!=1:
        raise RuntimeError('worker invariant changed')
    if re.search(r'(^|[^A-Za-z0-9_])(let|const|class)\s+|=>',src):
        raise RuntimeError('non-ES5 syntax')
    if src.count('cancelOverlapStagedFill("close_panel")')!=1 or src.count('cancelOverlapStagedFill("reset_virtual_state")')!=1:
        raise RuntimeError('lifecycle cancel hooks invalid')
    if src.count('overlapStagedStartCount:')<2:
        raise RuntimeError('status metrics not exported')

def git_config():
    subprocess.check_call(['git','config','user.name','github-actions[bot]'])
    subprocess.check_call(['git','config','user.email','41898282+github-actions[bot]@users.noreply.github.com'])

def cleanup_files():
    names=[
      'stage18_build.py','stage18_diag.py','stage18_diag.txt','stage18_build_error.txt',
      '.github/stage18_diag_trigger.txt','.github/stage18_build_trigger.txt',
      '.github/workflows/beta_stage18_diag.yml','.github/workflows/beta_stage18_build.yml'
    ]
    names += [str(p) for p in pathlib.Path('.').glob('stage18_function_*.txt')]
    for name in names:
        p=pathlib.Path(name)
        if p.exists(): p.unlink()

def main():
    original_loader=LOADER.read_text(encoding='utf-8')
    manifest=json.loads(MANIFEST.read_text(encoding='utf-8'))
    if manifest.get('moduleSetVersion')!='20260808.21':
        raise RuntimeError('expected .21 manifest')
    src=decode_filter67(original_loader)
    src=transform(src)
    loader,source_sha=pack_loader(original_loader,src)
    validate(src,loader)
    LOADER.write_text(loader,encoding='utf-8')
    data=loader.encode('utf-8')
    blob_sha=hashlib.sha1(('blob %d\0'%len(data)).encode('ascii')+data).hexdigest()
    manifest['moduleSetVersion']='20260808.22'
    found=False
    for mod in manifest.get('modules',[]):
        if mod.get('name')=='ch_11_filter.js':
            mod['sha']=blob_sha; found=True
    if not found: raise RuntimeError('manifest filter missing')
    MANIFEST.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    cleanup_files()
    git_config()
    subprocess.check_call(['git','add','-A'])
    subprocess.check_call(['git','diff','--cached','--check'])
    subprocess.check_call(['git','commit','-m','优化 Beta hydration overlap Card 分帧构建'])
    subprocess.check_call(['git','push'])
    print('FILTER68_BLOB='+blob_sha)
    print('SOURCE_SHA256='+source_sha)
    return 0

if __name__=='__main__':
    try:
        sys.exit(main())
    except Exception as exc:
        run(['git','restore','src/ch_11_filter.js','module-manifest.json'])
        pathlib.Path('stage18_build_error.txt').write_text(repr(exc)+'\n',encoding='utf-8')
        git_config()
        subprocess.check_call(['git','add','stage18_build_error.txt'])
        if run(['git','diff','--cached','--quiet']).returncode!=0:
            subprocess.check_call(['git','commit','-m','记录 Stage18 构建失败诊断'])
            subprocess.check_call(['git','push'])
        sys.exit(0)
