#!/usr/bin/env python3
from pathlib import Path
import base64, gzip, hashlib, json, re

ROOT = Path(__file__).resolve().parents[1]
ASSET = ROOT / "stage-assets" / "pagination-stage9"
OLD_PARTS = [ASSET / ("ch11_full_v4_%02d.b64" % i) for i in range(8)]
NEW_PARTS = [ASSET / ("ch11_full_v5_%02d.b64" % i) for i in range(8)]
OLD_PACKED_SHA = "77deb0225545af17da7f9a0eac6f43ce4a623440d1e053e4276441deb18b01f4"
OLD_SOURCE_SHA = "6d85719de45449ac1d029081a50554b8592bf21e7717fa3ecbfce18c8aa913e7"
MODULE_SET_VERSION = "20260808.03"

def sha256_text(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()

def git_blob_sha(text):
    data = text.encode("utf-8")
    return hashlib.sha1(
        b"blob " + str(len(data)).encode("ascii") + b"\0" + data
    ).hexdigest()

def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError("%s expected once, found %d" % (label, count))
    return text.replace(old, new, 1)

def insert_head(text, signature, statement, label):
    return replace_once(
        text, signature + "\n",
        signature + "\n" + statement + "\n", label
    )

packed = "".join(
    "".join(path.read_text(encoding="utf-8").split())
    for path in OLD_PARTS
)
if sha256_text(packed) != OLD_PACKED_SHA:
    raise RuntimeError("v4 packed SHA mismatch")
source = gzip.decompress(base64.b64decode(packed)).decode("utf-8")
if sha256_text(source) != OLD_SOURCE_SHA:
    raise RuntimeError("v49 source SHA mismatch")

worker_block = r'''
    var hydrationLatestRequestRef =
        new Packages.java.util.concurrent.atomic.AtomicReference();
    var hydrationWorkerBusyFlag =
        new Packages.java.util.concurrent.atomic.AtomicBoolean(false);
    var hydrationWorkerStoppingFlag =
        new Packages.java.util.concurrent.atomic.AtomicBoolean(false);
    var hydrationRequestSequence =
        new Packages.java.util.concurrent.atomic.AtomicLong(0);
    var hydrationEpochSequence =
        new Packages.java.util.concurrent.atomic.AtomicLong(0);
    var hydrationResultQueue =
        new Packages.java.util.concurrent.ConcurrentLinkedQueue();
    var hydrationExecutor = null;
    var hydrationActiveFuture = null;
    var hydrationApplyRunnable = null;
    var hydrationWorkerState = {
        enabled: true,
        requestCount: 0,
        queryCount: 0,
        successCount: 0,
        failureCount: 0,
        latestRequestReplaceCount: 0,
        staleResultDropCount: 0,
        postCloseDropCount: 0,
        workerQueryLastMs: 0,
        workerQueryMaxMs: 0,
        mainApplyLastMs: 0,
        mainApplyMaxMs: 0,
        lastRequestId: 0,
        lastOrigin: "",
        lastError: null,
        lastInvalidateReason: "",
        pendingSignature: null
    };
    var scrollPerformanceState = {
        scrollEventCount: 0,
        virtualScheduleCount: 0,
        virtualUpdateCount: 0,
        virtualUpdateLastMs: 0,
        virtualUpdateMaxMs: 0,
        viewRebuildCount: 0,
        viewRebuildLastMs: 0,
        viewRebuildMaxMs: 0,
        createdViewCount: 0,
        removedViewCount: 0,
        hydrateRequestedCount: 0
    };

    function resetHydrationWorkerDiagnostics() {
        hydrationWorkerStoppingFlag.set(false);
        hydrationLatestRequestRef.set(null);
        hydrationResultQueue.clear();
        hydrationWorkerBusyFlag.set(false);
        hydrationWorkerState.enabled = true;
        hydrationWorkerState.requestCount = 0;
        hydrationWorkerState.queryCount = 0;
        hydrationWorkerState.successCount = 0;
        hydrationWorkerState.failureCount = 0;
        hydrationWorkerState.latestRequestReplaceCount = 0;
        hydrationWorkerState.staleResultDropCount = 0;
        hydrationWorkerState.postCloseDropCount = 0;
        hydrationWorkerState.workerQueryLastMs = 0;
        hydrationWorkerState.workerQueryMaxMs = 0;
        hydrationWorkerState.mainApplyLastMs = 0;
        hydrationWorkerState.mainApplyMaxMs = 0;
        hydrationWorkerState.lastRequestId = 0;
        hydrationWorkerState.lastOrigin = "";
        hydrationWorkerState.lastError = null;
        hydrationWorkerState.lastInvalidateReason = "";
        hydrationWorkerState.pendingSignature = null;
        scrollPerformanceState.scrollEventCount = 0;
        scrollPerformanceState.virtualScheduleCount = 0;
        scrollPerformanceState.virtualUpdateCount = 0;
        scrollPerformanceState.virtualUpdateLastMs = 0;
        scrollPerformanceState.virtualUpdateMaxMs = 0;
        scrollPerformanceState.viewRebuildCount = 0;
        scrollPerformanceState.viewRebuildLastMs = 0;
        scrollPerformanceState.viewRebuildMaxMs = 0;
        scrollPerformanceState.createdViewCount = 0;
        scrollPerformanceState.removedViewCount = 0;
        scrollPerformanceState.hydrateRequestedCount = 0;
    }

    function copyHydrationWorkerState() {
        return {
            enabled: hydrationWorkerState.enabled === true,
            executorCreated: hydrationExecutor !== null,
            workerBusy: hydrationWorkerBusyFlag.get() === true,
            requestCount: Number(hydrationWorkerState.requestCount),
            queryCount: Number(hydrationWorkerState.queryCount),
            successCount: Number(hydrationWorkerState.successCount),
            failureCount: Number(hydrationWorkerState.failureCount),
            latestRequestReplaceCount:
                Number(hydrationWorkerState.latestRequestReplaceCount),
            staleResultDropCount:
                Number(hydrationWorkerState.staleResultDropCount),
            postCloseDropCount:
                Number(hydrationWorkerState.postCloseDropCount),
            workerQueryLastMs:
                Number(hydrationWorkerState.workerQueryLastMs),
            workerQueryMaxMs:
                Number(hydrationWorkerState.workerQueryMaxMs),
            mainApplyLastMs:
                Number(hydrationWorkerState.mainApplyLastMs),
            mainApplyMaxMs:
                Number(hydrationWorkerState.mainApplyMaxMs),
            lastRequestId: Number(hydrationWorkerState.lastRequestId),
            lastOrigin: hydrationWorkerState.lastOrigin,
            lastError: hydrationWorkerState.lastError,
            hydrationEpoch: Number(hydrationEpochSequence.get()),
            lastInvalidateReason:
                hydrationWorkerState.lastInvalidateReason
        };
    }

    function copyScrollPerformanceState() {
        return {
            scrollEventCount:
                Number(scrollPerformanceState.scrollEventCount),
            virtualScheduleCount:
                Number(scrollPerformanceState.virtualScheduleCount),
            virtualUpdateCount:
                Number(scrollPerformanceState.virtualUpdateCount),
            virtualUpdateLastMs:
                Number(scrollPerformanceState.virtualUpdateLastMs),
            virtualUpdateMaxMs:
                Number(scrollPerformanceState.virtualUpdateMaxMs),
            viewRebuildCount:
                Number(scrollPerformanceState.viewRebuildCount),
            viewRebuildLastMs:
                Number(scrollPerformanceState.viewRebuildLastMs),
            viewRebuildMaxMs:
                Number(scrollPerformanceState.viewRebuildMaxMs),
            createdViewCount:
                Number(scrollPerformanceState.createdViewCount),
            removedViewCount:
                Number(scrollPerformanceState.removedViewCount),
            hydrateRequestedCount:
                Number(scrollPerformanceState.hydrateRequestedCount)
        };
    }

    function invalidateHydrationWorker(reason) {
        hydrationEpochSequence.incrementAndGet();
        hydrationLatestRequestRef.set(null);
        hydrationWorkerState.pendingSignature = null;
        hydrationWorkerState.lastInvalidateReason =
            String(reason || "invalidate");
        return Number(hydrationEpochSequence.get());
    }

    function ensureHydrationWorker() {
        if (hydrationWorkerStoppingFlag.get() === true ||
                !hydrationWorkerState.enabled) {
            return false;
        }
        if (hydrationExecutor === null ||
                hydrationExecutor.isShutdown() ||
                hydrationExecutor.isTerminated()) {
            hydrationExecutor =
                Packages.java.util.concurrent.Executors
                    .newSingleThreadExecutor();
        }
        if (hydrationApplyRunnable === null) {
            hydrationApplyRunnable = new Packages.java.lang.Runnable({
                run: function () {
                    drainHydrationResultsOnMain();
                }
            });
        }
        return true;
    }

    function findPreviewRowIndexByIdForHydration(itemId) {
        var index;
        for (index = 0; index < previewRows.length; index += 1) {
            if (Number(previewRows[index].id) === Number(itemId)) {
                return index;
            }
        }
        return -1;
    }

    function hydrationRequestSignature(request) {
        return [
            Number(request.hydrationEpoch),
            Number(request.queryGeneration),
            Number(request.renderGeneration),
            Number(request.startIndex),
            Number(request.endIndex),
            request.ids.join(","),
            request.tagIds.join(",")
        ].join("|");
    }

    function collectHydrationRequest(startIndex, endIndex, origin) {
        var start;
        var end;
        var ids = [];
        var tagIds = [];
        var seenIds = {};
        var seenTagIds = {};
        var index;
        var row;
        var key;
        var request;
        if (previewRows.length === 0) { return null; }
        start = Math.max(0, Math.min(
            previewRows.length - 1,
            Math.floor(Number(startIndex || 0))));
        end = Math.max(start, Math.min(
            previewRows.length - 1,
            Math.floor(Number(endIndex))));
        for (index = start; index <= end; index += 1) {
            row = previewRows[index];
            if (row === null || row === undefined) { continue; }
            key = String(Number(row.id));
            if (isDataWindowStub(row) && seenIds[key] !== true) {
                seenIds[key] = true;
                ids.push(Number(row.id));
            }
            if (dataTagLoadedById[key] !== true &&
                    seenTagIds[key] !== true) {
                seenTagIds[key] = true;
                tagIds.push(Number(row.id));
            }
        }
        if (ids.length === 0 && tagIds.length === 0) {
            return null;
        }
        request = {
            requestId: Number(hydrationRequestSequence.incrementAndGet()),
            hydrationEpoch: Number(hydrationEpochSequence.get()),
            queryGeneration: Number(paginationState.queryGeneration),
            renderGeneration: Number(renderGeneration),
            startIndex: start,
            endIndex: end,
            ids: ids,
            tagIds: tagIds,
            origin: String(origin || "virtual_scroll")
        };
        request.signature = hydrationRequestSignature(request);
        return request;
    }

    function postHydrationResult(resultJson) {
        hydrationResultQueue.offer(
            new Packages.java.lang.String(String(resultJson)));
        if (mainHandler !== null && hydrationApplyRunnable !== null) {
            mainHandler.post(hydrationApplyRunnable);
        }
    }

    function queryHydrationRequest(requestJson) {
        var request = JSON.parse(String(requestJson));
        var rows = [];
        var tags = {};
        var startedAt = Number(System.currentTimeMillis());
        var finishedAt;
        var error = null;
        try {
            if (request.ids.length > 0) {
                if (!ClipHub.Repository ||
                        typeof ClipHub.Repository.listItemsByIds !==
                            "function") {
                    throw new Error(
                        "Repository.listItemsByIds unavailable");
                }
                rows = ClipHub.Repository.listItemsByIds(
                    request.ids, true);
            }
            if (request.tagIds.length > 0) {
                if (!ClipHub.Repository ||
                        typeof ClipHub.Repository.listItemTagMap !==
                            "function") {
                    throw new Error(
                        "Repository.listItemTagMap unavailable");
                }
                tags = ClipHub.Repository.listItemTagMap(
                    request.tagIds);
            }
        } catch (queryError) {
            error = String(queryError);
        }
        finishedAt = Number(System.currentTimeMillis());
        return JSON.stringify({
            requestId: Number(request.requestId),
            hydrationEpoch: Number(request.hydrationEpoch),
            queryGeneration: Number(request.queryGeneration),
            renderGeneration: Number(request.renderGeneration),
            startIndex: Number(request.startIndex),
            endIndex: Number(request.endIndex),
            ids: request.ids,
            tagIds: request.tagIds,
            rows: rows,
            tags: tags,
            origin: request.origin,
            startedAt: startedAt,
            finishedAt: finishedAt,
            queryMs: Math.max(0, finishedAt - startedAt),
            error: error
        });
    }

    function runHydrationWorkerLoop() {
        var requestJson;
        var resultJson;
        while (hydrationWorkerStoppingFlag.get() !== true) {
            requestJson = hydrationLatestRequestRef.getAndSet(null);
            if (requestJson === null) {
                hydrationWorkerBusyFlag.set(false);
                if (hydrationLatestRequestRef.get() !== null &&
                        hydrationWorkerBusyFlag.compareAndSet(
                            false, true)) {
                    continue;
                }
                return;
            }
            resultJson = queryHydrationRequest(String(requestJson));
            postHydrationResult(resultJson);
        }
        hydrationWorkerBusyFlag.set(false);
    }

    function submitHydrationRequest(request) {
        var previous;
        var runnable;
        if (request === null || request === undefined) {
            return false;
        }
        if (!ensureHydrationWorker()) { return false; }
        if (hydrationWorkerState.pendingSignature ===
                request.signature) {
            return false;
        }
        previous = hydrationLatestRequestRef.getAndSet(
            new Packages.java.lang.String(JSON.stringify(request)));
        if (previous !== null) {
            hydrationWorkerState.latestRequestReplaceCount += 1;
        }
        hydrationWorkerState.pendingSignature = request.signature;
        hydrationWorkerState.requestCount += 1;
        hydrationWorkerState.queryCount += 1;
        hydrationWorkerState.lastRequestId =
            Number(request.requestId);
        hydrationWorkerState.lastOrigin = request.origin;
        hydrationWorkerState.lastError = null;
        scrollPerformanceState.hydrateRequestedCount +=
            request.ids.length;
        if (request.ids.length > 0) {
            dataWindowState.hydrateQueryCount += 1;
        }
        if (request.tagIds.length > 0) {
            dataWindowState.tagQueryCount += 1;
        }
        if (hydrationWorkerBusyFlag.compareAndSet(false, true)) {
            runnable = new Packages.java.lang.Runnable({
                run: function () {
                    runHydrationWorkerLoop();
                }
            });
            hydrationActiveFuture =
                hydrationExecutor.submit(runnable);
        }
        return true;
    }

    function clearPendingHydrationIfCurrent(result) {
        if (Number(result.requestId) ===
                Number(hydrationWorkerState.lastRequestId)) {
            hydrationWorkerState.pendingSignature = null;
        }
    }

    function dropHydrationResult(result, postClose) {
        clearPendingHydrationIfCurrent(result);
        hydrationWorkerState.staleResultDropCount += 1;
        if (postClose === true) {
            hydrationWorkerState.postCloseDropCount += 1;
        }
        return false;
    }

    function applyHydrationResult(resultJson) {
        var applyStartedAt = Number(System.currentTimeMillis());
        var result = JSON.parse(String(resultJson));
        var rows = result.rows || [];
        var byId = {};
        var missingById = {};
        var index;
        var currentIndex;
        var key;
        var hydrated = 0;
        var missing = 0;
        var elapsed;
        if (!hydrationWorkerState.enabled ||
                hydrationWorkerStoppingFlag.get() === true) {
            return dropHydrationResult(result, false);
        }
        if (Number(result.hydrationEpoch) !==
                Number(hydrationEpochSequence.get()) ||
                Number(result.queryGeneration) !==
                Number(paginationState.queryGeneration) ||
                Number(result.renderGeneration) !==
                Number(renderGeneration) ||
                Number(result.requestId) !==
                Number(hydrationWorkerState.lastRequestId)) {
            return dropHydrationResult(result, false);
        }
        if (!state.panelAttached) {
            return dropHydrationResult(result, true);
        }
        clearPendingHydrationIfCurrent(result);
        hydrationWorkerState.workerQueryLastMs =
            Number(result.queryMs || 0);
        hydrationWorkerState.workerQueryMaxMs = Math.max(
            Number(hydrationWorkerState.workerQueryMaxMs),
            Number(result.queryMs || 0));
        if (result.error !== null &&
                result.error !== undefined &&
                String(result.error).length > 0) {
            hydrationWorkerState.failureCount += 1;
            hydrationWorkerState.lastError = String(result.error);
            dataWindowState.lastError = String(result.error);
            return false;
        }
        for (index = 0; index < rows.length; index += 1) {
            byId[String(Number(rows[index].id))] = rows[index];
        }
        for (index = 0; index < result.ids.length; index += 1) {
            key = String(Number(result.ids[index]));
            currentIndex = findPreviewRowIndexByIdForHydration(
                Number(result.ids[index]));
            if (currentIndex < 0 ||
                    !isDataWindowStub(previewRows[currentIndex])) {
                continue;
            }
            if (byId[key]) {
                previewRows[currentIndex] = byId[key];
                hydrated += 1;
            } else {
                missingById[key] = true;
            }
        }
        for (key in missingById) {
            if (missingById.hasOwnProperty(key)) {
                missing += 1;
            }
        }
        if (missing > 0) {
            removeMissingDataWindowIds(missingById);
        }
        if (result.tags !== null && result.tags !== undefined) {
            resultTagMap = mergeItemTagMap(resultTagMap, result.tags);
        }
        for (index = 0; index < result.tagIds.length; index += 1) {
            currentIndex = findPreviewRowIndexByIdForHydration(
                Number(result.tagIds[index]));
            if (currentIndex < 0 ||
                    isDataWindowStub(previewRows[currentIndex])) {
                continue;
            }
            dataTagLoadedById[
                String(Number(result.tagIds[index]))] = true;
        }
        dataWindowState.hydratedRowTotal += hydrated;
        dataWindowState.missingIdCount += missing;
        dataWindowState.lastError = null;
        if ((hydrated > 0 || missing > 0) &&
                ClipHub.List &&
                typeof ClipHub.List.setItems === "function") {
            ClipHub.List.setItems(previewRows);
        }
        updateDataWindowCounts();
        hydrationWorkerState.successCount += 1;
        hydrationWorkerState.lastError = null;
        elapsed = Math.max(0,
            Number(System.currentTimeMillis()) - applyStartedAt);
        hydrationWorkerState.mainApplyLastMs = elapsed;
        hydrationWorkerState.mainApplyMaxMs = Math.max(
            Number(hydrationWorkerState.mainApplyMaxMs), elapsed);
        scheduleVirtualUpdate("hydration_apply", true);
        return true;
    }

    function drainHydrationResultsOnMain() {
        var resultJson;
        if (Looper.myLooper() !== Looper.getMainLooper()) {
            if (mainHandler !== null && hydrationApplyRunnable !== null) {
                mainHandler.post(hydrationApplyRunnable);
            }
            return false;
        }
        while ((resultJson = hydrationResultQueue.poll()) !== null) {
            applyHydrationResult(String(resultJson));
        }
        return true;
    }

    function shutdownHydrationWorker() {
        var executor = hydrationExecutor;
        var future = hydrationActiveFuture;
        invalidateHydrationWorker("shutdown");
        hydrationWorkerState.enabled = false;
        hydrationWorkerStoppingFlag.set(true);
        hydrationLatestRequestRef.set(null);
        if (future !== null) {
            try { future.cancel(true); }
            catch (ignoredFutureCancel) {}
        }
        if (executor !== null) {
            try { executor.shutdownNow(); }
            catch (ignoredExecutorShutdown) {}
            try {
                executor.awaitTermination(
                    5000,
                    Packages.java.util.concurrent.TimeUnit.MILLISECONDS);
            } catch (ignoredAwait) {}
        }
        hydrationResultQueue.clear();
        hydrationWorkerBusyFlag.set(false);
        hydrationActiveFuture = null;
        hydrationExecutor = null;
        hydrationApplyRunnable = null;
        hydrationWorkerState.pendingSignature = null;
        return true;
    }

'''

anchor = "    function hydrateDataWindowRange(startIndex, endIndex, origin) {\n"
source = replace_once(source, anchor, worker_block + anchor, "worker insertion")

start = source.index(anchor.rstrip("\n"))
end = source.index("\n    function dehydrateDataWindowOutside", start)
source = source[:start] + r'''    function hydrateDataWindowRange(startIndex, endIndex, origin) {
        var start;
        var end;
        var request;
        if (previewRows.length === 0) {
            return {
                hydratedCount: 0,
                missingCount: 0,
                tagCount: 0,
                pending: false,
                requiresRows: false
            };
        }
        start = Math.max(0, Math.min(
            previewRows.length - 1,
            Math.floor(Number(startIndex || 0))));
        end = Math.max(start, Math.min(
            previewRows.length - 1,
            Math.floor(Number(endIndex))));
        dataWindowState.lastHydrateStartIndex = start;
        dataWindowState.lastHydrateEndIndex = end;
        dataWindowState.lastOrigin = String(
            origin || "data_window_hydrate");
        dataWindowState.lastError = null;
        dataWindowState.hydrationPassCount += 1;
        request = collectHydrationRequest(
            start, end, origin || "data_window_hydrate");
        if (request === null) {
            updateDataWindowCounts();
            return {
                hydratedCount: 0,
                missingCount: 0,
                tagCount: 0,
                pending: false,
                requiresRows: false
            };
        }
        submitHydrationRequest(request);
        updateDataWindowCounts();
        return {
            hydratedCount: 0,
            missingCount: 0,
            tagCount: request.tagIds.length,
            pending: true,
            requiresRows: request.ids.length > 0,
            requestId: Number(request.requestId)
        };
    }
''' + source[end:]

source = replace_once(
    source,
    '''        hydration = hydrateDataWindowRange(
            range.start, range.end,
            String(origin || "virtual_rebuild") + "_hydrate");
        if (Number(hydration.missingCount) > 0) {
            range = virtualTargetRange(preferredIndex);
            hydrateDataWindowRange(
                range.start, range.end,
                String(origin || "virtual_rebuild") +
                    "_hydrate_after_missing");
        }
        dehydrateDataWindowOutside(
''',
    '''        hydration = hydrateDataWindowRange(
            range.start, range.end,
            String(origin || "virtual_rebuild") + "_hydrate");
        virtualState.firstVisibleIndex = range.first;
        virtualState.lastVisibleIndex = range.last;
        if (hydration.pending === true &&
                hydration.requiresRows === true) {
            virtualState.lastOrigin = String(
                origin || "virtual_rebuild") +
                "_hydrate_pending";
            return false;
        }
        dehydrateDataWindowOutside(
''',
    "virtual hydration async guard"
)
source = replace_once(
    source,
    '''        virtualState.firstVisibleIndex = range.first;
        virtualState.lastVisibleIndex = range.last;
        if (force !== true &&
''',
    '''        if (force !== true &&
''',
    "dedupe visible assignment"
)

source = replace_once(
    source,
    '''    function scheduleVirtualUpdate(origin) {
        var generation;
''',
    '''    function scheduleVirtualUpdate(origin, force) {
        var generation;
        if (String(origin || "").indexOf("scroll") >= 0) {
            scrollPerformanceState.scrollEventCount += 1;
        }
''',
    "schedule signature"
)
source = replace_once(
    source,
    '''        virtualState.updateScheduled = true;
        virtualGeneration += 1;
''',
    '''        virtualState.updateScheduled = true;
        scrollPerformanceState.virtualScheduleCount += 1;
        virtualGeneration += 1;
''',
    "schedule count"
)
source = replace_once(
    source,
    '''                virtualState.updateScheduled = false;
                captureScrollAnchor();
                rebuildVirtualWindow(
                    origin || "virtual_scroll", false,
                    virtualState.firstVisibleIndex);
                updateQuickResetView();
''',
    '''                virtualState.updateScheduled = false;
                var virtualUpdateStartedAt =
                    Number(System.currentTimeMillis());
                var virtualUpdateElapsed;
                scrollPerformanceState.virtualUpdateCount += 1;
                captureScrollAnchor();
                rebuildVirtualWindow(
                    origin || "virtual_scroll", force === true,
                    virtualState.firstVisibleIndex);
                updateQuickResetView();
                virtualUpdateElapsed = Math.max(0,
                    Number(System.currentTimeMillis()) -
                        virtualUpdateStartedAt);
                scrollPerformanceState.virtualUpdateLastMs =
                    virtualUpdateElapsed;
                scrollPerformanceState.virtualUpdateMaxMs = Math.max(
                    Number(scrollPerformanceState.virtualUpdateMaxMs),
                    virtualUpdateElapsed);
''',
    "virtual timing"
)

source = replace_once(
    source,
    '''        measureVirtualCards();
        oldCount = Number(virtualCardHost.getChildCount());
        virtualCardHost.removeAllViews();
''',
    '''        var viewRebuildStartedAt =
            Number(System.currentTimeMillis());
        var viewRebuildElapsed;
        scrollPerformanceState.viewRebuildCount += 1;
        measureVirtualCards();
        oldCount = Number(virtualCardHost.getChildCount());
        scrollPerformanceState.removedViewCount += oldCount;
        virtualCardHost.removeAllViews();
''',
    "rebuild timing start"
)
source = replace_once(
    source,
    '''            virtualCardHost.addView(makeResultCard(
                previewRows[index], colors), params);
''',
    '''            virtualCardHost.addView(makeResultCard(
                previewRows[index], colors), params);
            scrollPerformanceState.createdViewCount += 1;
''',
    "created count"
)
source = replace_once(
    source,
    '''        virtualState.firstRenderedIndex = range.start;
        virtualState.lastRenderedIndex = range.end;
''',
    '''        viewRebuildElapsed = Math.max(0,
            Number(System.currentTimeMillis()) -
                viewRebuildStartedAt);
        scrollPerformanceState.viewRebuildLastMs =
            viewRebuildElapsed;
        scrollPerformanceState.viewRebuildMaxMs = Math.max(
            Number(scrollPerformanceState.viewRebuildMaxMs),
            viewRebuildElapsed);
        virtualState.firstRenderedIndex = range.start;
        virtualState.lastRenderedIndex = range.end;
''',
    "rebuild timing finish"
)

source = insert_head(
    source, "    function resetResultPaging(origin) {",
    '        invalidateHydrationWorker(origin || "result_paging_reset");',
    "paging invalidation"
)
source = insert_head(
    source,
    "    function rememberMutationRefresh(eventName, action, reason, forceFull) {",
    '        invalidateHydrationWorker(reason || eventName || "mutation_refresh");',
    "mutation invalidation"
)
source = replace_once(
    source,
    '''        options = options || {};
        stopFilterImeAvoidance(false);
        renderGeneration += 1;
''',
    '''        options = options || {};
        stopFilterImeAvoidance(false);
        invalidateHydrationWorker("close_panel");
        renderGeneration += 1;
''',
    "close invalidation"
)
source = replace_once(
    source,
    '''            } catch (ignoredClose) {}
            unregisterEvents();
''',
    '''            } catch (ignoredClose) {}
            shutdownHydrationWorker();
            unregisterEvents();
''',
    "shutdown ordering"
)
source = replace_once(
    source,
    '''            mainHandler = new Handler(Looper.getMainLooper());
            density = Number(appContext.getResources()
''',
    '''            mainHandler = new Handler(Looper.getMainLooper());
            resetHydrationWorkerDiagnostics();
            density = Number(appContext.getResources()
''',
    "init diagnostics"
)
source = replace_once(
    source, "        MODULE_VERSION: 49,",
    "        MODULE_VERSION: 50,", "module version"
)
source = replace_once(
    source,
    '''                dataWindow:
                    copyDataWindowState(),
                mutation:
''',
    '''                dataWindow:
                    copyDataWindowState(),
                hydrationWorker:
                    copyHydrationWorkerState(),
                scrollPerformance:
                    copyScrollPerformanceState(),
                mutation:
''',
    "state diagnostics"
)
source = replace_once(
    source,
    "        getState: function () {\n",
    '''        getHydrationWorkerState: function () {
            return copyHydrationWorkerState();
        },

        getScrollPerformanceState: function () {
            return copyScrollPerformanceState();
        },

        getState: function () {
''',
    "diagnostic APIs"
)

if re.search(r"\blet\s+|\bconst\s+|=>|\bclass\s+[A-Za-z_$]", source):
    raise RuntimeError("ES6 syntax found")
for expected in (
    "VIRTUAL_UPDATE_DELAY_MS = 24",
    "VIRTUAL_BEFORE_SCREENS = 3",
    "VIRTUAL_AFTER_SCREENS = 5"
):
    if expected not in source:
        raise RuntimeError("frozen boundary missing: " + expected)
if source.count("newSingleThreadExecutor") != 1:
    raise RuntimeError("expected exactly one worker executor")
if source.count("MODULE_VERSION: 50") != 1:
    raise RuntimeError("Filter 50 identity missing")

source_sha = sha256_text(source)
compressed = gzip.compress(source.encode("utf-8"), compresslevel=9, mtime=0)
new_packed = base64.b64encode(compressed).decode("ascii")
packed_sha = sha256_text(new_packed)
chunk = (len(new_packed) + 7) // 8
for i, path in enumerate(NEW_PARTS):
    path.write_text(new_packed[i * chunk:(i + 1) * chunk] + "\n",
                    encoding="utf-8")
roundtrip = "".join(
    "".join(path.read_text(encoding="utf-8").split())
    for path in NEW_PARTS
)
if roundtrip != new_packed:
    raise RuntimeError("v5 part roundtrip mismatch")

loader_path = ROOT / "src" / "ch_11_filter.js"
loader = loader_path.read_text(encoding="utf-8")
loader = loader.replace(
    "/* ClipHub Stage 9 mutation coordination and anchor regression ES5 loader. */",
    "/* ClipHub Stage 11.1 async hydration worker ES5 loader. */")
loader = loader.replace("ch11_full_v4_", "ch11_full_v5_")
loader = loader.replace(OLD_PACKED_SHA, packed_sha)
loader = loader.replace(OLD_SOURCE_SHA, source_sha)
loader = loader.replace(
    'var CACHE_NAME = "ch_11_filter_stage9_v4_full.b64";',
    'var CACHE_NAME = "ch_11_filter_stage11_1_v5_full.b64";')
loader = loader.replace("?stage9v4=", "?stage11_1v5=")
loader = loader.replace("Stage 9 packed source SHA-256 mismatch",
                        "Stage 11.1 packed source SHA-256 mismatch")
loader = loader.replace("Stage 9 source SHA-256 mismatch",
                        "Stage 11.1 source SHA-256 mismatch")
loader = loader.replace("ch_11_filter.js Stage 9 loader failed:",
                        "ch_11_filter.js Stage 11.1 loader failed:")
if "ch11_full_v4_" in loader:
    raise RuntimeError("loader still references v4")
loader_path.write_text(loader, encoding="utf-8")

manifest_path = ROOT / "module-manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["moduleSetVersion"] = MODULE_SET_VERSION
matched = 0
for module in manifest["modules"]:
    if module["name"] == "ch_11_filter.js":
        module["sha"] = git_blob_sha(loader)
        matched += 1
if matched != 1 or len(manifest["modules"]) != 15:
    raise RuntimeError("manifest module boundary mismatch")
manifest_path.write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8")

test_path = ROOT / "ClipHub_分页阶段11首页预览按需正文测试入口.txt"
test = test_path.read_text(encoding="utf-8")
test = replace_once(
    test,
    'var EXPECTED_MODULE_SET_VERSION = "20260808.02";',
    'var EXPECTED_MODULE_SET_VERSION = "20260808.03";',
    "Stage11 test moduleSet identity"
)
test = replace_once(
    test,
    'Number(global.ClipHub.Filter.MODULE_VERSION) !== 49',
    'Number(global.ClipHub.Filter.MODULE_VERSION) !== 50',
    "Stage11 test Filter identity"
)
test_path.write_text(test, encoding="utf-8")

Path("/tmp/ch11_filter_v50_source.js").write_text(source, encoding="utf-8")
report = {
    "sourceLines": len(source.splitlines()),
    "sourceSha256": source_sha,
    "packedSha256": packed_sha,
    "loaderGitBlobSha": git_blob_sha(loader),
    "moduleSetVersion": MODULE_SET_VERSION,
    "filterModuleVersion": 50,
    "paginationStage": 9,
    "moduleCount": 15,
    "v5PartCount": 8
}
Path("/tmp/stage11_1_build_report.json").write_text(
    json.dumps(report, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8")
print(json.dumps(report, ensure_ascii=False))
