import base64
import gzip
import hashlib
import json
import pathlib
import re
import subprocess
import sys

LOADER = pathlib.Path('src/ch_11_filter.js')
MANIFEST = pathlib.Path('module-manifest.json')
BRANCH = 'beta-pagination-stage10-20260808'


def run(args, **kwargs):
    return subprocess.run(args, text=True, **kwargs)


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError('%s count=%d' % (label, count))
    return text.replace(old, new, 1)


def function_block(source, name):
    needle = '    function ' + name + '('
    start = source.find(needle)
    if start < 0:
        raise RuntimeError('function missing: ' + name)
    end = source.find('\n    function ', start + len(needle))
    if end < 0:
        end = len(source)
    return source[start:end]


def decode_filter68(loader):
    if 'Stage 18 hydration overlap staged fill packed full Filter68 ES5 loader' not in loader:
        raise RuntimeError('expected Filter68 packed loader')
    match = re.search(r'var PACKED_B64 =\n((?:\s*"[A-Za-z0-9+/=]+"\s*\+?\n?)+);', loader)
    if not match:
        raise RuntimeError('PACKED_B64 missing')
    packed = ''.join(re.findall(r'"([A-Za-z0-9+/=]+)"', match.group(1)))
    return gzip.decompress(base64.b64decode(packed)).decode('utf-8')


def insert_status_metrics(source):
    metrics = '''\n            keyedStagedStartCount:\n                Number(scrollPerformanceState.keyedStagedStartCount),\n            keyedStagedBatchCount:\n                Number(scrollPerformanceState.keyedStagedBatchCount),\n            keyedStagedProcessedCount:\n                Number(scrollPerformanceState.keyedStagedProcessedCount),\n            keyedStagedNewBuildCount:\n                Number(scrollPerformanceState.keyedStagedNewBuildCount),\n            keyedStagedReuseCount:\n                Number(scrollPerformanceState.keyedStagedReuseCount),\n            keyedStagedMoveCount:\n                Number(scrollPerformanceState.keyedStagedMoveCount),\n            keyedStagedCompletedCount:\n                Number(scrollPerformanceState.keyedStagedCompletedCount),\n            keyedStagedCancelCount:\n                Number(scrollPerformanceState.keyedStagedCancelCount),\n            keyedStagedDeferredUpdateCount:\n                Number(scrollPerformanceState.keyedStagedDeferredUpdateCount),\n            keyedStagedPendingCount:\n                Number(scrollPerformanceState.keyedStagedPendingCount),\n            keyedStagedLastBatchMs:\n                Number(scrollPerformanceState.keyedStagedLastBatchMs),\n            keyedStagedMaxBatchMs:\n                Number(scrollPerformanceState.keyedStagedMaxBatchMs),\n            keyedStagedLastBatchBuilds:\n                Number(scrollPerformanceState.keyedStagedLastBatchBuilds),\n            keyedStagedMaxBuildsPerBatch:\n                Number(scrollPerformanceState.keyedStagedMaxBuildsPerBatch),\n            keyedStagedLastExpectedNewBuildCount:\n                Number(scrollPerformanceState.keyedStagedLastExpectedNewBuildCount),\n            keyedStagedLastActualNewBuildCount:\n                Number(scrollPerformanceState.keyedStagedLastActualNewBuildCount),\n            keyedStagedLastInitialRemoveMs:\n                Number(scrollPerformanceState.keyedStagedLastInitialRemoveMs),\n            keyedStagedMaxInitialRemoveMs:\n                Number(scrollPerformanceState.keyedStagedMaxInitialRemoveMs),\n            keyedStagedLastTotalMs:\n                Number(scrollPerformanceState.keyedStagedLastTotalMs),\n            keyedStagedMaxTotalMs:\n                Number(scrollPerformanceState.keyedStagedMaxTotalMs),\n            keyedStagedSyncBuildAvoidedCount:\n                Number(scrollPerformanceState.keyedStagedSyncBuildAvoidedCount),\n            keyedStagedHydrationStartCount:\n                Number(scrollPerformanceState.keyedStagedHydrationStartCount),\n            keyedStagedHydrationCompletedCount:\n                Number(scrollPerformanceState.keyedStagedHydrationCompletedCount),\n            keyedStagedAjaxFallbackStartCount:\n                Number(scrollPerformanceState.keyedStagedAjaxFallbackStartCount),\n            keyedStagedAjaxFallbackCompletedCount:\n                Number(scrollPerformanceState.keyedStagedAjaxFallbackCompletedCount),\n            keyedStagedLastCancelReason:\n                String(scrollPerformanceState.keyedStagedLastCancelReason || ""),'''
    pattern = re.compile(
        r'(\n\s*overlapStagedLastCancelReason\s*:\s*(?:\n\s*)?String\(\s*scrollPerformanceState\.overlapStagedLastCancelReason\s*\|\|\s*""\s*\),)')
    matches = list(pattern.finditer(source))
    if len(matches) != 1:
        raise RuntimeError('status anchor count=%d' % len(matches))
    match = matches[0]
    return source[:match.end()] + metrics + source[match.end():]


def stage19_helpers():
    return r'''    function buildKeyedStagedPlan(range, colors) {
        var desiredCount = Math.max(0, Number(range.end) - Number(range.start) + 1);
        var desiredIds = [];
        var desiredSignatures = [];
        var desiredKeys = {};
        var availableKeys = {};
        var desiredKeyList = [];
        var index;
        var row;
        var key;
        var expectedNewBuilds = 0;
        var retainedExact = 0;
        var signatureStartedAt = Number(System.currentTimeMillis());
        for (index = Number(range.start); index <= Number(range.end); index += 1) {
            row = previewRows[index];
            if (row === null || row === undefined) { return null; }
            desiredIds.push(Number(row.id));
            desiredSignatures.push(virtualRenderSignature(row, colors));
            key = "k:" + String(Number(row.id)) + "\u001e" +
                String(desiredSignatures[desiredSignatures.length - 1]);
            desiredKeys[key] = true;
            desiredKeyList.push(key);
        }
        for (index = 0; index < virtualRenderedItemIds.length; index += 1) {
            key = "k:" + String(Number(virtualRenderedItemIds[index])) +
                "\u001e" + String(virtualRenderedSignatures[index]);
            if (availableKeys[key] === undefined) { availableKeys[key] = 0; }
            availableKeys[key] += 1;
        }
        for (index = 0; index < desiredKeyList.length; index += 1) {
            key = desiredKeyList[index];
            if (Number(availableKeys[key] || 0) > 0) {
                retainedExact += 1;
                availableKeys[key] -= 1;
            } else {
                expectedNewBuilds += 1;
            }
        }
        return {
            desiredCount: desiredCount,
            desiredIds: desiredIds,
            desiredSignatures: desiredSignatures,
            desiredKeys: desiredKeys,
            expectedNewBuilds: expectedNewBuilds,
            retainedExact: retainedExact,
            signatureMs: Math.max(0,
                Number(System.currentTimeMillis()) - signatureStartedAt)
        };
    }

    function clearKeyedStagedState() {
        keyedStagedState.active = false;
        keyedStagedState.generation = 0;
        keyedStagedState.origin = "";
        keyedStagedState.force = false;
        keyedStagedState.rangeStart = 0;
        keyedStagedState.rangeEnd = -1;
        keyedStagedState.desiredCount = 0;
        keyedStagedState.desiredIds = [];
        keyedStagedState.desiredSignatures = [];
        keyedStagedState.localIndex = 0;
        keyedStagedState.colors = null;
        keyedStagedState.expectedNewBuilds = 0;
        keyedStagedState.newBuildCount = 0;
        keyedStagedState.reusedCount = 0;
        keyedStagedState.movedCount = 0;
        keyedStagedState.oldCount = 0;
        keyedStagedState.initialRemoveMs = 0;
        keyedStagedState.maxBatchMs = 0;
        keyedStagedState.lastBatchMs = 0;
        keyedStagedState.deferredOrigin = "";
        keyedStagedState.deferredForce = false;
        keyedStagedState.startedAtMs = 0;
        keyedStagedState.ajaxGeneration = 0;
        keyedStagedState.ajaxRows = null;
        scrollPerformanceState.keyedStagedPendingCount = 0;
    }

    function cancelKeyedStagedReconcile(reason) {
        var wasAjax;
        if (keyedStagedState.active !== true) { return false; }
        wasAjax = String(keyedStagedState.origin || "") === "ajax_append";
        scrollPerformanceState.keyedStagedCancelCount += 1;
        scrollPerformanceState.keyedStagedLastCancelReason =
            String(reason || "cancelled");
        panelDataDirty = true;
        state.panelDataDirty = true;
        if (wasAjax) { ajaxFooterState.loading = false; }
        clearKeyedStagedState();
        return true;
    }

    function deferVirtualUpdateDuringKeyedStaged(origin, force) {
        keyedStagedState.deferredOrigin = String(origin || "virtual_rebuild");
        keyedStagedState.deferredForce =
            keyedStagedState.deferredForce === true || force === true;
        scrollPerformanceState.keyedStagedDeferredUpdateCount += 1;
        virtualState.updateDeferred = true;
        return true;
    }

    function postKeyedStagedBatch(generation) {
        if (mainHandler === null) { return false; }
        mainHandler.post(new Packages.java.lang.Runnable({
            run: function () {
                runKeyedStagedBatch(generation);
            }
        }));
        return true;
    }

    function recordKeyedStagedSlowBatch(origin, elapsed, builds, reused, oldCount) {
        if (elapsed <= 32) { return false; }
        scrollPerformanceState.slowRebuildCount += 1;
        scrollPerformanceState.slowRebuildSamples.push({
            origin: String(origin || "hydration_apply") + "_keyed_stage",
            force: true,
            mode: "keyed_staged",
            elapsedMs: elapsed,
            rangeStart: Number(keyedStagedState.rangeStart),
            rangeEnd: Number(keyedStagedState.rangeEnd),
            oldCount: oldCount,
            newCount: virtualCardHost === null ? 0 :
                Number(virtualCardHost.getChildCount()),
            created: builds,
            removed: 0,
            reused: reused,
            recycled: 0,
            newBuilt: builds,
            measureMs: Number(scrollPerformanceState.measureLastMs),
            keyedMs: elapsed,
            signatureMs: 0,
            structureMs: elapsed
        });
        while (scrollPerformanceState.slowRebuildSamples.length > 8) {
            scrollPerformanceState.slowRebuildSamples.shift();
        }
        return true;
    }

    function finishKeyedStagedReconcile(generation) {
        var range;
        var origin;
        var ajaxGeneration;
        var ajaxRows;
        var colors;
        var deferredOrigin;
        var deferredForce;
        var totalElapsed;
        var expected;
        var actual;
        var oldCount;
        var blockMs;
        var result = true;
        if (keyedStagedState.active !== true ||
                Number(keyedStagedState.generation) !== Number(generation) ||
                !state.panelAttached || virtualCardHost === null) {
            return false;
        }
        while (Number(virtualCardHost.getChildCount()) >
                Number(keyedStagedState.desiredCount)) {
            removeVirtualEntryAt(Number(virtualCardHost.getChildCount()) - 1);
        }
        range = {
            start: Number(keyedStagedState.rangeStart),
            end: Number(keyedStagedState.rangeEnd),
            first: Number(virtualState.firstVisibleIndex),
            last: Number(virtualState.lastVisibleIndex)
        };
        origin = String(keyedStagedState.origin || "hydration_apply");
        ajaxGeneration = Number(keyedStagedState.ajaxGeneration || 0);
        ajaxRows = keyedStagedState.ajaxRows;
        colors = keyedStagedState.colors;
        deferredOrigin = String(keyedStagedState.deferredOrigin || "");
        deferredForce = keyedStagedState.deferredForce === true;
        expected = Number(keyedStagedState.expectedNewBuilds);
        actual = Number(keyedStagedState.newBuildCount);
        oldCount = Number(keyedStagedState.oldCount);
        totalElapsed = Math.max(0, Number(System.currentTimeMillis()) -
            Number(keyedStagedState.startedAtMs));
        blockMs = Math.max(
            Number(keyedStagedState.initialRemoveMs),
            Number(keyedStagedState.maxBatchMs));
        syncRenderedResultCounters(range);
        scrollPerformanceState.keyedStagedCompletedCount += 1;
        scrollPerformanceState.keyedStagedLastExpectedNewBuildCount = expected;
        scrollPerformanceState.keyedStagedLastActualNewBuildCount = actual;
        scrollPerformanceState.keyedStagedLastTotalMs = totalElapsed;
        scrollPerformanceState.keyedStagedMaxTotalMs = Math.max(
            Number(scrollPerformanceState.keyedStagedMaxTotalMs), totalElapsed);
        if (origin === "ajax_append") {
            scrollPerformanceState.keyedStagedAjaxFallbackCompletedCount += 1;
        } else {
            scrollPerformanceState.keyedStagedHydrationCompletedCount += 1;
        }
        scrollPerformanceState.keyedReconcileLastMs = blockMs;
        scrollPerformanceState.keyedReconcileMaxMs = Math.max(
            Number(scrollPerformanceState.keyedReconcileMaxMs), blockMs);
        scrollPerformanceState.keyedStructureLastMs = blockMs;
        scrollPerformanceState.keyedStructureMaxMs = Math.max(
            Number(scrollPerformanceState.keyedStructureMaxMs), blockMs);
        scrollPerformanceState.viewRebuildLastMs = blockMs;
        scrollPerformanceState.viewRebuildMaxMs = Math.max(
            Number(scrollPerformanceState.viewRebuildMaxMs), blockMs);
        virtualState.firstRenderedIndex = range.start;
        virtualState.lastRenderedIndex = range.end;
        virtualState.topSpacerPx = setVirtualSpacerHeight(
            virtualTopSpacer, virtualHeightRange(0, range.start));
        virtualState.bottomSpacerPx = setVirtualSpacerHeight(
            virtualBottomSpacer, virtualHeightRange(range.end + 1, previewRows.length));
        virtualState.updateCount += 1;
        virtualState.rebuildCount += 1;
        virtualState.recycleCount += Math.max(0,
            oldCount - Number(keyedStagedState.desiredCount));
        virtualState.updateDeferred = false;
        virtualState.lastOrigin = origin + "_keyed_staged";
        virtualState.lastError = null;
        virtualGeneration += 1;
        clearKeyedStagedState();
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
        if (origin === "ajax_append") {
            result = finishAjaxAppendRender(ajaxGeneration, ajaxRows, colors);
        }
        if (deferredOrigin.length > 0 && state.panelAttached &&
                mainHandler !== null) {
            scheduleVirtualUpdate(deferredOrigin, deferredForce);
        }
        return result;
    }

    function runKeyedStagedBatch(generation) {
        var startedAt;
        var elapsed = 0;
        var processed = 0;
        var batchBuilds = 0;
        var batchReuse = 0;
        var batchMoves = 0;
        var localIndex;
        var scanIndex;
        var index;
        var desiredId;
        var desiredSignature;
        var oldCount;
        if (keyedStagedState.active !== true ||
                Number(keyedStagedState.generation) !== Number(generation)) {
            return false;
        }
        if (!state.panelAttached || virtualCardHost === null) {
            cancelKeyedStagedReconcile("panel_detached");
            return false;
        }
        startedAt = Number(System.currentTimeMillis());
        oldCount = Number(virtualCardHost.getChildCount());
        while (Number(keyedStagedState.localIndex) <
                Number(keyedStagedState.desiredCount)) {
            localIndex = Number(keyedStagedState.localIndex);
            desiredId = Number(keyedStagedState.desiredIds[localIndex]);
            desiredSignature = String(
                keyedStagedState.desiredSignatures[localIndex]);
            if (localIndex < virtualRenderedItemIds.length &&
                    Number(virtualRenderedItemIds[localIndex]) === desiredId &&
                    String(virtualRenderedSignatures[localIndex]) ===
                        desiredSignature) {
                scrollPerformanceState.sameIdReuseCount += 1;
                keyedStagedState.reusedCount += 1;
                batchReuse += 1;
            } else {
                scanIndex = -1;
                for (index = localIndex + 1;
                        index < virtualRenderedItemIds.length; index += 1) {
                    if (Number(virtualRenderedItemIds[index]) === desiredId &&
                            String(virtualRenderedSignatures[index]) ===
                                desiredSignature) {
                        scanIndex = index;
                        break;
                    }
                }
                if (scanIndex >= 0) {
                    moveVirtualEntry(scanIndex, localIndex);
                    scrollPerformanceState.sameIdReuseCount += 1;
                    keyedStagedState.reusedCount += 1;
                    keyedStagedState.movedCount += 1;
                    batchReuse += 1;
                    batchMoves += 1;
                } else {
                    insertVirtualEntryAt(localIndex,
                        previewRows[Number(keyedStagedState.rangeStart) + localIndex],
                        keyedStagedState.colors, desiredSignature);
                    keyedStagedState.newBuildCount += 1;
                    batchBuilds += 1;
                }
            }
            keyedStagedState.localIndex = localIndex + 1;
            processed += 1;
            elapsed = Math.max(0,
                Number(System.currentTimeMillis()) - startedAt);
            if (batchBuilds >= KEYED_STAGED_MAX_NEW_BUILDS_PER_BATCH ||
                    processed >= KEYED_STAGED_MAX_POSITIONS_PER_BATCH ||
                    elapsed >= KEYED_STAGED_BUDGET_MS) {
                break;
            }
        }
        elapsed = Math.max(0, Number(System.currentTimeMillis()) - startedAt);
        keyedStagedState.lastBatchMs = elapsed;
        keyedStagedState.maxBatchMs = Math.max(
            Number(keyedStagedState.maxBatchMs), elapsed);
        scrollPerformanceState.keyedStagedBatchCount += 1;
        scrollPerformanceState.keyedStagedProcessedCount += processed;
        scrollPerformanceState.keyedStagedNewBuildCount += batchBuilds;
        scrollPerformanceState.keyedStagedReuseCount += batchReuse;
        scrollPerformanceState.keyedStagedMoveCount += batchMoves;
        scrollPerformanceState.keyedStagedLastBatchMs = elapsed;
        scrollPerformanceState.keyedStagedMaxBatchMs = Math.max(
            Number(scrollPerformanceState.keyedStagedMaxBatchMs), elapsed);
        scrollPerformanceState.keyedStagedLastBatchBuilds = batchBuilds;
        scrollPerformanceState.keyedStagedMaxBuildsPerBatch = Math.max(
            Number(scrollPerformanceState.keyedStagedMaxBuildsPerBatch), batchBuilds);
        scrollPerformanceState.keyedStagedPendingCount = Math.max(0,
            Number(keyedStagedState.expectedNewBuilds) -
            Number(keyedStagedState.newBuildCount));
        scrollPerformanceState.viewRebuildLastMs = elapsed;
        scrollPerformanceState.viewRebuildMaxMs = Math.max(
            Number(scrollPerformanceState.viewRebuildMaxMs), elapsed);
        recordKeyedStagedSlowBatch(
            keyedStagedState.origin, elapsed, batchBuilds, batchReuse, oldCount);
        if (Number(keyedStagedState.localIndex) <
                Number(keyedStagedState.desiredCount)) {
            if (!postKeyedStagedBatch(generation)) {
                cancelKeyedStagedReconcile("post_failed");
                scheduleVirtualUpdate("keyed_stage_recover", true);
                return false;
            }
            return true;
        }
        return finishKeyedStagedReconcile(generation);
    }

    function startKeyedStagedReconcile(range, colors, origin, force,
            ajaxContext, viewCountAlreadyIncremented) {
        var requestedOrigin = String(origin || "virtual_rebuild");
        var childCount;
        var plan;
        var localIndex;
        var key;
        var removeStartedAt;
        var removeElapsed;
        var generation;
        var allowHydration = requestedOrigin === "hydration_apply" &&
            force === true;
        var allowAjax = requestedOrigin === "ajax_append";
        if (!allowHydration && !allowAjax) { return false; }
        if (mainHandler === null || virtualCardHost === null ||
                !state.panelAttached || activeSwipeCard !== null ||
                ajaxStagedAttachState.active === true ||
                overlapStagedFillState.active === true ||
                keyedStagedState.active === true) {
            return false;
        }
        childCount = Number(virtualCardHost.getChildCount());
        if (childCount <= 0 ||
                virtualRenderedItemIds.length !== childCount ||
                virtualRenderedSignatures.length !== childCount ||
                resultCardViews.length !== childCount ||
                resultCardHolders.length !== childCount ||
                resultActionViews.length !== childCount) {
            return false;
        }
        if (Number(range.start) < 0 || Number(range.end) < Number(range.start) ||
                Number(range.end) >= previewRows.length) {
            return false;
        }
        plan = buildKeyedStagedPlan(range, colors);
        if (plan === null ||
                Number(plan.expectedNewBuilds) < KEYED_STAGED_MIN_NEW_BUILDS) {
            return false;
        }
        if (allowAjax && Number(plan.retainedExact) <= 0) {
            return false;
        }
        if (viewCountAlreadyIncremented !== true) {
            scrollPerformanceState.viewRebuildCount += 1;
            measureVirtualCards();
        }
        scrollPerformanceState.keyedReconcileCount += 1;
        scrollPerformanceState.keyedSignatureLastMs = Number(plan.signatureMs);
        scrollPerformanceState.keyedSignatureMaxMs = Math.max(
            Number(scrollPerformanceState.keyedSignatureMaxMs),
            Number(plan.signatureMs));
        removeStartedAt = Number(System.currentTimeMillis());
        for (localIndex = Number(virtualCardHost.getChildCount()) - 1;
                localIndex >= 0; localIndex -= 1) {
            key = "k:" + String(Number(virtualRenderedItemIds[localIndex])) +
                "\u001e" + String(virtualRenderedSignatures[localIndex]);
            if (plan.desiredKeys[key] !== true) {
                removeVirtualEntryAt(localIndex);
            }
        }
        removeElapsed = Math.max(0,
            Number(System.currentTimeMillis()) - removeStartedAt);
        keyedStagedGeneration += 1;
        generation = keyedStagedGeneration;
        keyedStagedState.active = true;
        keyedStagedState.generation = generation;
        keyedStagedState.origin = requestedOrigin;
        keyedStagedState.force = force === true;
        keyedStagedState.rangeStart = Number(range.start);
        keyedStagedState.rangeEnd = Number(range.end);
        keyedStagedState.desiredCount = Number(plan.desiredCount);
        keyedStagedState.desiredIds = plan.desiredIds;
        keyedStagedState.desiredSignatures = plan.desiredSignatures;
        keyedStagedState.localIndex = 0;
        keyedStagedState.colors = colors;
        keyedStagedState.expectedNewBuilds = Number(plan.expectedNewBuilds);
        keyedStagedState.newBuildCount = 0;
        keyedStagedState.reusedCount = 0;
        keyedStagedState.movedCount = 0;
        keyedStagedState.oldCount = childCount;
        keyedStagedState.initialRemoveMs = removeElapsed;
        keyedStagedState.maxBatchMs = 0;
        keyedStagedState.lastBatchMs = 0;
        keyedStagedState.deferredOrigin = "";
        keyedStagedState.deferredForce = false;
        keyedStagedState.startedAtMs = Number(System.currentTimeMillis());
        keyedStagedState.ajaxGeneration = allowAjax && ajaxContext !== null &&
            ajaxContext !== undefined ? Number(ajaxContext.generation) : 0;
        keyedStagedState.ajaxRows = allowAjax && ajaxContext !== null &&
            ajaxContext !== undefined ? ajaxContext.rows : null;
        virtualState.firstVisibleIndex = Number(range.first);
        virtualState.lastVisibleIndex = Number(range.last);
        scrollPerformanceState.keyedStagedStartCount += 1;
        scrollPerformanceState.keyedStagedLastExpectedNewBuildCount =
            Number(plan.expectedNewBuilds);
        scrollPerformanceState.keyedStagedLastActualNewBuildCount = 0;
        scrollPerformanceState.keyedStagedLastInitialRemoveMs = removeElapsed;
        scrollPerformanceState.keyedStagedMaxInitialRemoveMs = Math.max(
            Number(scrollPerformanceState.keyedStagedMaxInitialRemoveMs),
            removeElapsed);
        scrollPerformanceState.keyedStagedPendingCount =
            Number(plan.expectedNewBuilds);
        scrollPerformanceState.keyedStagedSyncBuildAvoidedCount +=
            Number(plan.expectedNewBuilds);
        if (allowAjax) {
            scrollPerformanceState.keyedStagedAjaxFallbackStartCount += 1;
        } else {
            scrollPerformanceState.keyedStagedHydrationStartCount += 1;
        }
        scrollPerformanceState.viewRebuildLastMs = removeElapsed;
        scrollPerformanceState.viewRebuildMaxMs = Math.max(
            Number(scrollPerformanceState.viewRebuildMaxMs), removeElapsed);
        if (!postKeyedStagedBatch(generation)) {
            cancelKeyedStagedReconcile("initial_post_failed");
            return false;
        }
        return true;
    }

'''


def transform(source):
    original_keyed = function_block(source, 'keyedReconcileVirtualWindow')
    original_insert = function_block(source, 'insertVirtualEntryAt')
    original_overlap_run = function_block(source, 'runOverlapStagedFillBatch')
    original_retarget = function_block(source, 'preemptStagedAjaxAttachForScroll')

    source = replace_once(source,
        'MODULE_VERSION: 68', 'MODULE_VERSION: 69', 'module version')

    state_block = '''    var KEYED_STAGED_BUDGET_MS = 14;\n    var KEYED_STAGED_MAX_NEW_BUILDS_PER_BATCH = 3;\n    var KEYED_STAGED_MAX_POSITIONS_PER_BATCH = 16;\n    var KEYED_STAGED_MIN_NEW_BUILDS = 8;\n    var keyedStagedGeneration = 0;\n    var keyedStagedState = {\n        active: false,\n        generation: 0,\n        origin: "",\n        force: false,\n        rangeStart: 0,\n        rangeEnd: -1,\n        desiredCount: 0,\n        desiredIds: [],\n        desiredSignatures: [],\n        localIndex: 0,\n        colors: null,\n        expectedNewBuilds: 0,\n        newBuildCount: 0,\n        reusedCount: 0,\n        movedCount: 0,\n        oldCount: 0,\n        initialRemoveMs: 0,\n        maxBatchMs: 0,\n        lastBatchMs: 0,\n        deferredOrigin: "",\n        deferredForce: false,\n        startedAtMs: 0,\n        ajaxGeneration: 0,\n        ajaxRows: null\n    };\n'''
    source = replace_once(source,
        '    var LAZY_TRIGGER_MIN_DP = 120;\n',
        state_block + '    var LAZY_TRIGGER_MIN_DP = 120;\n',
        'keyed staged state')

    init_metrics = '''        keyedStagedStartCount: 0,\n        keyedStagedBatchCount: 0,\n        keyedStagedProcessedCount: 0,\n        keyedStagedNewBuildCount: 0,\n        keyedStagedReuseCount: 0,\n        keyedStagedMoveCount: 0,\n        keyedStagedCompletedCount: 0,\n        keyedStagedCancelCount: 0,\n        keyedStagedDeferredUpdateCount: 0,\n        keyedStagedPendingCount: 0,\n        keyedStagedLastBatchMs: 0,\n        keyedStagedMaxBatchMs: 0,\n        keyedStagedLastBatchBuilds: 0,\n        keyedStagedMaxBuildsPerBatch: 0,\n        keyedStagedLastExpectedNewBuildCount: 0,\n        keyedStagedLastActualNewBuildCount: 0,\n        keyedStagedLastInitialRemoveMs: 0,\n        keyedStagedMaxInitialRemoveMs: 0,\n        keyedStagedLastTotalMs: 0,\n        keyedStagedMaxTotalMs: 0,\n        keyedStagedSyncBuildAvoidedCount: 0,\n        keyedStagedHydrationStartCount: 0,\n        keyedStagedHydrationCompletedCount: 0,\n        keyedStagedAjaxFallbackStartCount: 0,\n        keyedStagedAjaxFallbackCompletedCount: 0,\n        keyedStagedLastCancelReason: "",\n'''
    source = replace_once(source,
        '        overlapStagedLastCancelReason: "",\n        holderRecycleReleaseCount: 0,\n',
        '        overlapStagedLastCancelReason: "",\n' + init_metrics +
        '        holderRecycleReleaseCount: 0,\n',
        'metrics init')

    reset_metrics = '''        scrollPerformanceState.keyedStagedStartCount = 0;\n        scrollPerformanceState.keyedStagedBatchCount = 0;\n        scrollPerformanceState.keyedStagedProcessedCount = 0;\n        scrollPerformanceState.keyedStagedNewBuildCount = 0;\n        scrollPerformanceState.keyedStagedReuseCount = 0;\n        scrollPerformanceState.keyedStagedMoveCount = 0;\n        scrollPerformanceState.keyedStagedCompletedCount = 0;\n        scrollPerformanceState.keyedStagedCancelCount = 0;\n        scrollPerformanceState.keyedStagedDeferredUpdateCount = 0;\n        scrollPerformanceState.keyedStagedPendingCount = 0;\n        scrollPerformanceState.keyedStagedLastBatchMs = 0;\n        scrollPerformanceState.keyedStagedMaxBatchMs = 0;\n        scrollPerformanceState.keyedStagedLastBatchBuilds = 0;\n        scrollPerformanceState.keyedStagedMaxBuildsPerBatch = 0;\n        scrollPerformanceState.keyedStagedLastExpectedNewBuildCount = 0;\n        scrollPerformanceState.keyedStagedLastActualNewBuildCount = 0;\n        scrollPerformanceState.keyedStagedLastInitialRemoveMs = 0;\n        scrollPerformanceState.keyedStagedMaxInitialRemoveMs = 0;\n        scrollPerformanceState.keyedStagedLastTotalMs = 0;\n        scrollPerformanceState.keyedStagedMaxTotalMs = 0;\n        scrollPerformanceState.keyedStagedSyncBuildAvoidedCount = 0;\n        scrollPerformanceState.keyedStagedHydrationStartCount = 0;\n        scrollPerformanceState.keyedStagedHydrationCompletedCount = 0;\n        scrollPerformanceState.keyedStagedAjaxFallbackStartCount = 0;\n        scrollPerformanceState.keyedStagedAjaxFallbackCompletedCount = 0;\n        scrollPerformanceState.keyedStagedLastCancelReason = "";\n'''
    source = replace_once(source,
        '        scrollPerformanceState.overlapStagedLastCancelReason = "";\n        scrollPerformanceState.holderRecycleReleaseCount = 0;\n',
        '        scrollPerformanceState.overlapStagedLastCancelReason = "";\n' +
        reset_metrics + '        scrollPerformanceState.holderRecycleReleaseCount = 0;\n',
        'metrics reset')
    source = insert_status_metrics(source)

    source = replace_once(source,
        '    function keyedReconcileVirtualWindow(range, colors) {\n',
        stage19_helpers() + '    function keyedReconcileVirtualWindow(range, colors) {\n',
        'helper insertion')

    source = replace_once(source,
        '    function resetVirtualState(clearHeights) {\n        cancelOverlapStagedFill("reset_virtual_state");\n',
        '    function resetVirtualState(clearHeights) {\n        cancelKeyedStagedReconcile("reset_virtual_state");\n        cancelOverlapStagedFill("reset_virtual_state");\n',
        'reset cancel')
    source = replace_once(source,
        '    function closePanel(options) {\n        cancelOverlapStagedFill("close_panel");\n',
        '    function closePanel(options) {\n        cancelKeyedStagedReconcile("close_panel");\n        cancelOverlapStagedFill("close_panel");\n',
        'close cancel')

    source = replace_once(source,
        '        if (overlapStagedFillState.active === true) {\n            deferVirtualUpdateDuringOverlapStagedFill(origin, force);\n            return false;\n        }\n        if (activeSwipeCard !== null) {\n',
        '        if (overlapStagedFillState.active === true) {\n            deferVirtualUpdateDuringOverlapStagedFill(origin, force);\n            return false;\n        }\n        if (keyedStagedState.active === true) {\n            deferVirtualUpdateDuringKeyedStaged(origin, force);\n            return false;\n        }\n        if (activeSwipeCard !== null) {\n',
        'rebuild staged guard')

    source = replace_once(source,
        '        } else {\n  keyedReconcileVirtualWindow(range, colors);\n  recycledCount = Math.max(0, oldCount -\n      Number(virtualCardHost.getChildCount()));\n        }\n',
        '        } else {\n  if (startKeyedStagedReconcile(\n          range, colors, origin, force, null, true)) {\n      return false;\n  }\n  keyedReconcileVirtualWindow(range, colors);\n  recycledCount = Math.max(0, oldCount -\n      Number(virtualCardHost.getChildCount()));\n        }\n',
        'hydration keyed staged hook')

    ajax_old = '''        if (startStagedAjaxAttach(\n                ajaxAppendGeneration, appendedRows, colors)) {\n            return true;\n        }\n        rebuildVirtualWindow(\n            "ajax_append", false,\n            virtualState.firstVisibleIndex);\n'''
    ajax_new = '''        if (startStagedAjaxAttach(\n                ajaxAppendGeneration, appendedRows, colors)) {\n            return true;\n        }\n        if (startKeyedStagedReconcile(\n                virtualTargetRange(virtualState.firstVisibleIndex),\n                colors, "ajax_append", false, {\n                    generation: ajaxAppendGeneration,\n                    rows: appendedRows\n                }, false)) {\n            return true;\n        }\n        rebuildVirtualWindow(\n            "ajax_append", false,\n            virtualState.firstVisibleIndex);\n'''
    source = replace_once(source, ajax_old, ajax_new, 'ajax keyed fallback hook')

    if function_block(source, 'keyedReconcileVirtualWindow') != original_keyed:
        raise RuntimeError('sync keyed function changed')
    if function_block(source, 'insertVirtualEntryAt') != original_insert:
        raise RuntimeError('insert helper changed')
    if function_block(source, 'runOverlapStagedFillBatch') != original_overlap_run:
        raise RuntimeError('Stage18 overlap function changed')
    if function_block(source, 'preemptStagedAjaxAttachForScroll') != original_retarget:
        raise RuntimeError('Stage17.2 retarget function changed')
    return source


def build_loader(source):
    raw = source.encode('utf-8')
    source_sha = hashlib.sha256(raw).hexdigest()
    packed = gzip.compress(raw, compresslevel=9, mtime=0)
    encoded = base64.b64encode(packed).decode('ascii')
    pieces = [encoded[i:i+120] for i in range(0, len(encoded), 120)]
    b64 = ''.join('        ' + json.dumps(piece) + (' +\n' if i < len(pieces)-1 else ';\n')
                  for i, piece in enumerate(pieces))
    loader = '''/* ClipHub Stage 19 keyed staged reconcile and AJAX fallback packed full Filter69 ES5 loader. */\n(function (global) {\n    var Base64 = Packages.android.util.Base64;\n    var ByteArrayInputStream = Packages.java.io.ByteArrayInputStream;\n    var GZIPInputStream = Packages.java.util.zip.GZIPInputStream;\n    var BAOS = Packages.java.io.ByteArrayOutputStream;\n    var ReflectArray = Packages.java.lang.reflect.Array;\n    var JavaByte = Packages.java.lang.Byte;\n    var JavaString = Packages.java.lang.String;\n    var MessageDigest = Packages.java.security.MessageDigest;\n    var SOURCE_SHA256 = %s;\n    var PACKED_B64 =\n%s\n    function bytesToHex(bytes) {\n        var out = "";\n        var i;\n        var value;\n        var hex;\n        for (i = 0; i < bytes.length; i += 1) {\n            value = Number(bytes[i]);\n            if (value < 0) { value += 256; }\n            hex = value.toString(16);\n            if (hex.length < 2) { hex = "0" + hex; }\n            out += hex;\n        }\n        return out;\n    }\n\n    function readAll(input) {\n        var output = new BAOS();\n        var buffer = ReflectArray.newInstance(JavaByte.TYPE, 8192);\n        var count;\n        while (true) {\n            count = input.read(buffer);\n            if (count < 0) { break; }\n            if (count > 0) { output.write(buffer, 0, count); }\n        }\n        return output.toByteArray();\n    }\n\n    function unpackSource() {\n        var packed = Base64.decode(PACKED_B64, Base64.DEFAULT);\n        var gzipInput = new GZIPInputStream(new ByteArrayInputStream(packed));\n        var raw = readAll(gzipInput);\n        var digest;\n        gzipInput.close();\n        digest = bytesToHex(MessageDigest.getInstance("SHA-256").digest(raw));\n        if (digest !== SOURCE_SHA256) {\n            throw new Error("Filter69 source SHA-256 mismatch: " + digest);\n        }\n        return String(new JavaString(raw, "UTF-8"));\n    }\n\n    try {\n        eval(unpackSource());\n    } catch (error) {\n        throw new Error("ch_11_filter.js Stage 19 loader failed: " + String(error));\n    }\n})(this);\n''' % (json.dumps(source_sha), b64)
    return loader, source_sha


def validate(source, loader):
    pathlib.Path('/tmp/filter69.js').write_text(source, encoding='utf-8')
    pathlib.Path('/tmp/filter69_loader.js').write_text(loader, encoding='utf-8')
    subprocess.check_call(['node', '--check', '/tmp/filter69.js'])
    subprocess.check_call(['node', '--check', '/tmp/filter69_loader.js'])
    required = [
        'MODULE_VERSION: 69',
        'KEYED_STAGED_BUDGET_MS = 14',
        'KEYED_STAGED_MAX_NEW_BUILDS_PER_BATCH = 3',
        'KEYED_STAGED_MIN_NEW_BUILDS = 8',
        'function startKeyedStagedReconcile',
        'function runKeyedStagedBatch',
        'function finishKeyedStagedReconcile',
        'keyedStagedAjaxFallbackStartCount',
        'keyedStagedHydrationStartCount',
        'startKeyedStagedReconcile(\n                virtualTargetRange(virtualState.firstVisibleIndex)',
        'VIRTUAL_BEFORE_SCREENS = 3',
        'VIRTUAL_AFTER_SCREENS = 5',
        'VIRTUAL_UPDATE_DELAY_MS = 24',
        'AJAX_STAGED_ATTACH_BUDGET_MS = 14',
        'AJAX_STAGED_ATTACH_DELAY_MS = 0',
        'AJAX_STAGED_ATTACH_MAX_CARDS_PER_BATCH = 3',
        'OVERLAP_STAGED_FILL_BUDGET_MS = 14',
        'OVERLAP_STAGED_FILL_MAX_CARDS_PER_BATCH = 3',
        'OVERLAP_STAGED_FILL_MIN_NEW_BUILDS = 8',
        'stagedAttachRetargetCount',
        'overlapStagedSyncBuildAvoidedCount'
    ]
    for token in required:
        if token not in source:
            raise RuntimeError('missing token: ' + token)
    if source.count('.newSingleThreadExecutor();') != 1:
        raise RuntimeError('worker invariant changed')
    if re.search(r'(^|[^A-Za-z0-9_])(let|const|class)[\s]+|=>', source):
        raise RuntimeError('non-ES5 syntax in Filter69')
    if 'resultTagBadgeViews' in source or 'refreshRenderedTagBadges' in source:
        raise RuntimeError('unsafe Filter53 patch detected')
    if source.count('startKeyedStagedReconcile(') < 3:
        raise RuntimeError('keyed staged hooks incomplete')


def publish():
    loader_text = LOADER.read_text(encoding='utf-8')
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    if manifest.get('moduleSetVersion') != '20260808.22':
        raise RuntimeError('expected .22 manifest')
    source = decode_filter68(loader_text)
    transformed = transform(source)
    loader, source_sha = build_loader(transformed)
    validate(transformed, loader)
    LOADER.write_text(loader, encoding='utf-8')
    data = LOADER.read_bytes()
    blob_sha = hashlib.sha1(('blob %d\0' % len(data)).encode('ascii') + data).hexdigest()
    manifest['moduleSetVersion'] = '20260808.23'
    found = False
    for module in manifest.get('modules', []):
        if module.get('name') == 'ch_11_filter.js':
            module['sha'] = blob_sha
            found = True
    if not found:
        raise RuntimeError('manifest filter entry missing')
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return blob_sha, source_sha


def git_config():
    subprocess.check_call(['git','config','user.name','github-actions[bot]'])
    subprocess.check_call(['git','config','user.email','41898282+github-actions[bot]@users.noreply.github.com'])


def fail(exc):
    run(['git','restore','src/ch_11_filter.js','module-manifest.json'])
    pathlib.Path('stage19_build_error.txt').write_text(repr(exc) + '\n', encoding='utf-8')
    git_config()
    subprocess.check_call(['git','add','stage19_build_error.txt'])
    if run(['git','diff','--cached','--quiet']).returncode != 0:
        subprocess.check_call(['git','commit','-m','记录 Stage19 构建失败诊断'])
        subprocess.check_call(['git','push'])


def success(blob_sha, source_sha):
    git_config()
    cleanup = []
    cleanup.extend(pathlib.Path('.').glob('stage19_*.txt'))
    cleanup.extend(pathlib.Path('.').glob('stage19_*.py'))
    cleanup.extend(pathlib.Path('.github').glob('stage19_*'))
    cleanup.extend(pathlib.Path('.github/workflows').glob('beta_stage19_*'))
    for path in cleanup:
        try:
            path.unlink()
        except FileNotFoundError:
            pass
    subprocess.check_call(['git','add','-A'])
    subprocess.check_call(['git','diff','--cached','--check'])
    subprocess.check_call(['git','commit','-m','分帧优化 Beta keyed 重建与 AJAX fallback'])
    subprocess.check_call(['git','push'])
    print('Filter69 blob', blob_sha)
    print('Filter69 source sha256', source_sha)


def main():
    try:
        blob_sha, source_sha = publish()
    except Exception as exc:
        fail(exc)
        return 0
    success(blob_sha, source_sha)
    return 0

if __name__ == '__main__':
    sys.exit(main())
