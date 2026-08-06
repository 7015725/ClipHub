#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path

BRANCH = "agent/add-pagination-lazy-prefetch-20260807"
MODULE_SET_VERSION = "20260807.01"
EXPECTED = {
    "src/ch_11_filter.js": "adb4f246bfb5fcafd14a36f2a5d8bd412d0a19fe",
    "src/ch_15_app.js": "653eb0905ccc7ba2a91981909d330b796918f4f9",
    "src/ch_08_window.js": "4ccff8067656ae51602290c884081795ec0f65ea",
}


def git_hash(path):
    return subprocess.check_output(["git", "hash-object", path], text=True).strip()


def require_hash(path, expected):
    actual = git_hash(path)
    if actual != expected:
        raise SystemExit("unexpected baseline hash for %s: %s" % (path, actual))


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit("%s marker count: %d" % (label, count))
    return text.replace(old, new, 1)


def patch_file(path, replacements):
    file_path = Path(path)
    text = file_path.read_text(encoding="utf-8")
    for old, new, label in replacements:
        text = replace_once(text, old, new, label)
    file_path.write_text(text, encoding="utf-8")


for path, expected in EXPECTED.items():
    require_hash(path, expected)

patch_file("src/ch_11_filter.js", [
    (
        '        MODULE_VERSION: 38,',
        '        MODULE_VERSION: 39,',
        'filter module version'
    ),
    (
'''    var lastShowReused = false;
    var timeFormatter = null;
    var performance = {''',
'''    var lastShowReused = false;
    var timeFormatter = null;
    var lifecycleGeneration = 0;
    var shuttingDown = false;
    var staleCallbackDropCount = 0;
    var lastLifecycleReason = "";
    var performance = {''',
        'filter lifecycle declarations'
    ),
    (
'''    function markPanelDataDirty(reason) {
        panelDataVersion += 1;''',
'''    function invalidateAsyncWork(reason, shutdown) {
        lifecycleGeneration += 1;
        renderGeneration += 1;
        refreshGeneration += 1;
        searchGeneration += 1;
        adaptiveRenderGeneration += 1;
        inputDispatchGeneration += 1;
        deleteUndoGeneration += 1;
        copyFeedbackGeneration += 1;
        refreshScheduled = false;
        inputDispatchPending = false;
        lastLifecycleReason = String(reason || "async_invalidated");
        if (shutdown === true) { shuttingDown = true; }
        return lifecycleGeneration;
    }

    function acceptLifecycle(generation) {
        if (Number(generation) === Number(lifecycleGeneration) &&
                shuttingDown !== true) {
            return true;
        }
        staleCallbackDropCount += 1;
        return false;
    }

    function prepareForAppShutdown(reason) {
        var generation;
        if (shuttingDown === true) {
            return {
                ok: true,
                reused: true,
                lifecycleGeneration: Number(lifecycleGeneration),
                reason: lastLifecycleReason
            };
        }
        generation = invalidateAsyncWork(
            reason || "app_shutdown", true);
        try {
            closePanel({
                restoreList: false,
                reason: reason || "app_shutdown",
                destroyCache: true,
                lifecycleInvalidated: true
            });
        } catch (ignoredClose) {}
        return {
            ok: true,
            reused: false,
            lifecycleGeneration: Number(generation),
            reason: lastLifecycleReason
        };
    }

    function markPanelDataDirty(reason) {
        panelDataVersion += 1;''',
        'filter lifecycle helpers'
    ),
    (
'''    function schedulePanelRefresh(origin, rebuildStructure, requestFocus) {
        var generation = refreshGeneration;
        refreshReason = String(origin || refreshReason || "refresh");''',
'''    function schedulePanelRefresh(origin, rebuildStructure, requestFocus) {
        var generation = refreshGeneration;
        var lifecycle = lifecycleGeneration;
        refreshReason = String(origin || refreshReason || "refresh");''',
        'panel refresh lifecycle capture'
    ),
    (
'''            run: function () {
                if (generation !== refreshGeneration) { return; }
                refreshScheduled = false;
                if (!state.panelAttached) { return; }''',
'''            run: function () {
                if (generation !== refreshGeneration ||
                        !acceptLifecycle(lifecycle)) {
                    refreshScheduled = false;
                    return;
                }
                refreshScheduled = false;
                if (!state.panelAttached) { return; }''',
        'panel refresh lifecycle guard'
    ),
    (
'''    function scheduleCoalescedRefresh(origin) {
        var generation = refreshGeneration;
        refreshReason = String(origin || "event");''',
'''    function scheduleCoalescedRefresh(origin) {
        var generation = refreshGeneration;
        var lifecycle = lifecycleGeneration;
        refreshReason = String(origin || "event");''',
        'coalesced refresh lifecycle capture'
    ),
    (
'''            run: function () {
                if (generation !== refreshGeneration) { return; }
                refreshScheduled = false;
                if (state.panelAttached && panelDataDirty) {''',
'''            run: function () {
                if (generation !== refreshGeneration ||
                        !acceptLifecycle(lifecycle)) {
                    refreshScheduled = false;
                    return;
                }
                refreshScheduled = false;
                if (state.panelAttached && panelDataDirty) {''',
        'coalesced refresh lifecycle guard'
    ),
    (
'''        options = options || {};
        rootMode = options.rootMode === true;
        state.rootMode = rootMode;''',
'''        options = options || {};
        if (shuttingDown === true) {
            throw new Error("ClipHub filter is shutting down");
        }
        rootMode = options.rootMode === true;
        state.rootMode = rootMode;''',
        'show panel shutdown gate'
    ),
    (
'''        options = options || {};
        stopFilterImeAvoidance(false);
        renderGeneration += 1;
        refreshGeneration += 1;
        refreshScheduled = false;''',
'''        options = options || {};
        stopFilterImeAvoidance(false);
        if (options.lifecycleInvalidated !== true) {
            invalidateAsyncWork(
                options.reason || "panel_close", false);
        } else {
            refreshScheduled = false;
            inputDispatchPending = false;
        }''',
        'close panel lifecycle invalidation'
    ),
    (
'''        return {
            attached: state.panelAttached,
            attachedToWindow: attachedToWindow,''',
'''        return {
            attached: state.panelAttached,
            attachedToWindow: attachedToWindow,
            lifecycleGeneration: Number(lifecycleGeneration),
            shuttingDown: shuttingDown === true,
            staleCallbackDropCount: Number(staleCallbackDropCount),
            lastLifecycleReason: String(lastLifecycleReason || ""),''',
        'panel lifecycle state fields'
    ),
    (
'''            lastShowReused = false;
            timeFormatter = null;
            advancedVisible = false;''',
'''            lastShowReused = false;
            timeFormatter = null;
            lifecycleGeneration = 1;
            shuttingDown = false;
            staleCallbackDropCount = 0;
            lastLifecycleReason = "init";
            advancedVisible = false;''',
        'filter lifecycle init'
    ),
    (
'''        closePanel: closePanel,
        handleBack: handleBack,
        getPanelState: getPanelState,''',
'''        closePanel: closePanel,
        handleBack: handleBack,
        getPanelState: getPanelState,
        prepareForAppShutdown: prepareForAppShutdown,
        invalidateAsyncWork: function (reason) {
            return invalidateAsyncWork(reason, false);
        },''',
        'filter lifecycle exports'
    ),
    (
'''        shutdown: function () {
            try {
                closePanel({
                    restoreList: false,
                    reason: "shutdown",
                    destroyCache: true
                });
            } catch (ignoredClose) {}''',
'''        shutdown: function () {
            prepareForAppShutdown("shutdown");''',
        'filter shutdown preparation'
    )
])

patch_file("src/ch_15_app.js", [
    (
        '        MODULE_VERSION: 18,',
        '        MODULE_VERSION: 19,',
        'app module version'
    ),
    (
'''        sourceRef: ""
    };''',
'''        sourceRef: "",
        stopping: false,
        lifecycleGeneration: 0,
        lastStopReason: "",
        filterPreparedForShutdown: false
    };''',
        'app lifecycle state'
    ),
    (
'''    function shutdownModules() {
        var index;
        var item;
        for (index = state.initialized.length - 1; index >= 0; index -= 1) {''',
'''    function prepareFilterForShutdown(reason) {
        if (state.filterPreparedForShutdown) { return true; }
        state.filterPreparedForShutdown = true;
        try {
            if (ClipHub.Filter &&
                    typeof ClipHub.Filter.prepareForAppShutdown ===
                        "function") {
                ClipHub.Filter.prepareForAppShutdown(
                    reason || "app_shutdown");
            }
            return true;
        } catch (ignored) {
            return false;
        }
    }

    function shutdownModules(reason) {
        var index;
        var item;
        prepareFilterForShutdown(reason || "app_shutdown");
        for (index = state.initialized.length - 1; index >= 0; index -= 1) {''',
        'app shutdown ordering'
    ),
    (
'''            started: state.started === true,
            uiVisible: detailAttached || editorAttached || filterAttached ||''',
'''            started: state.started === true,
            stopping: state.stopping === true,
            lifecycleGeneration: Number(state.lifecycleGeneration),
            lastStopReason: String(state.lastStopReason || ""),
            filterPreparedForShutdown:
                state.filterPreparedForShutdown === true,
            filterLifecycleGeneration:
                Number(filter.lifecycleGeneration || 0),
            filterShuttingDown: filter.shuttingDown === true,
            staleCallbackDropCount:
                Number(filter.staleCallbackDropCount || 0),
            uiVisible: detailAttached || editorAttached || filterAttached ||''',
        'app lifecycle status'
    ),
    (
'''    function showUi() {
        var result;
        var before = uiStatus();''',
'''    function showUi() {
        var result;
        var before;
        if (!state.started || state.stopping) {
            throw new Error("ClipHub is not available for show");
        }
        before = uiStatus();''',
        'app show lifecycle gate'
    ),
    (
'''            state.context = context;
            state.entryVersion = Number(context && context.entryVersion || 0);''',
'''            state.stopping = false;
            state.filterPreparedForShutdown = false;
            state.lastStopReason = "";
            state.lifecycleGeneration += 1;
            state.context = context;
            state.entryVersion = Number(context && context.entryVersion || 0);''',
        'app start lifecycle reset'
    ),
    (
'''                shutdownModules();
                releaseLock();
                state.context = null;''',
'''                shutdownModules("start_failed");
                releaseLock();
                state.context = null;''',
        'app failed start shutdown reason'
    ),
    (
'''                state.sourceRef = "";
                state.started = false;
                throw error;''',
'''                state.sourceRef = "";
                state.started = false;
                state.stopping = false;
                state.filterPreparedForShutdown = false;
                throw error;''',
        'app failed start lifecycle clear'
    ),
    (
'''        stop: function (reason) {
            var wasStarted = state.started;
            unregisterControlReceiver();
            shutdownModules();
            releaseLock();
            state.context = null;
            state.entryVersion = 0;
            state.moduleSetVersion = "";
            state.sourceRef = "";
            state.started = false;
            return {
                ok: true,
                stopped: true,
                wasStarted: wasStarted,
                reason: String(reason || "direct")
            };
        },''',
'''        stop: function (reason) {
            var wasStarted = state.started;
            var stopReason = String(reason || "direct");
            if (state.stopping) {
                return {
                    ok: true,
                    stopped: true,
                    reused: true,
                    wasStarted: wasStarted,
                    reason: stopReason,
                    lifecycleGeneration:
                        Number(state.lifecycleGeneration)
                };
            }
            state.stopping = true;
            state.started = false;
            state.lifecycleGeneration += 1;
            state.lastStopReason = stopReason;
            state.filterPreparedForShutdown = false;
            prepareFilterForShutdown(stopReason);
            unregisterControlReceiver();
            shutdownModules(stopReason);
            releaseLock();
            state.context = null;
            state.entryVersion = 0;
            state.moduleSetVersion = "";
            state.sourceRef = "";
            state.stopping = false;
            return {
                ok: true,
                stopped: true,
                reused: false,
                wasStarted: wasStarted,
                reason: stopReason,
                lifecycleGeneration: Number(state.lifecycleGeneration),
                filterPreparedForShutdown:
                    state.filterPreparedForShutdown === true
            };
        },''',
        'app stop lifecycle ordering'
    )
])

probe = r'''/* ClipHub 分页阶段 0：快速关闭与工作线程只读探针。ShortX / Rhino ES5。 */
(function (global) {
    var URL = Packages.java.net.URL;
    var URLEncoder = Packages.java.net.URLEncoder;
    var BAOS = Packages.java.io.ByteArrayOutputStream;
    var ReflectArray = Packages.java.lang.reflect.Array;
    var JavaByte = Packages.java.lang.Byte;
    var JavaString = Packages.java.lang.String;
    var System = Packages.java.lang.System;
    var Thread = Packages.java.lang.Thread;
    var Executors = Packages.java.util.concurrent.Executors;
    var TimeUnit = Packages.java.util.concurrent.TimeUnit;

    var OWNER = "7015725";
    var REPO = "ClipHub";
    var REF = "agent/add-pagination-lazy-prefetch-20260807";
    var ENTRY_PATH = "ClipHub.js";
    var TEST_ENTRY_VERSION = 1;
    var EXPECTED_MODULE_SET_VERSION = "20260807.01";
    var RUNTIME_NAME = "ClipHubPaginationStage0Probe";
    var QUERY_LOOPS = 50;
    var CLOSE_LOOPS = 20;

    function closeQuietly(value) {
        if (value !== null && value !== undefined) {
            try { value.close(); } catch (ignored) {}
        }
    }

    function errorText(error) {
        try {
            if (error && error.javaException) {
                return String(error.javaException.getClass().getName()) +
                    ": " + String(error);
            }
        } catch (ignored) {}
        return String(error);
    }

    function encodeSegment(value) {
        return String(URLEncoder.encode(String(value), "UTF-8"))
            .replace(/\+/g, "%20");
    }

    function readBytes(stream) {
        var output = new BAOS();
        var buffer = ReflectArray.newInstance(JavaByte.TYPE, 8192);
        var count;
        try {
            while ((count = stream.read(buffer)) >= 0) {
                if (count > 0) { output.write(buffer, 0, count); }
            }
            return output.toByteArray();
        } finally {
            closeQuietly(stream);
            closeQuietly(output);
        }
    }

    function fetchEntry() {
        var url = "https://raw.githubusercontent.com/" + OWNER + "/" +
            REPO + "/" + encodeSegment(REF) + "/" + ENTRY_PATH +
            "?cliphubPaginationStage0=" +
            Number(System.currentTimeMillis());
        var connection = null;
        var code;
        var bytes;
        var text;
        try {
            connection = new URL(url).openConnection();
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(20000);
            connection.setUseCaches(false);
            connection.setRequestProperty("Accept", "text/plain, */*");
            connection.setRequestProperty("Accept-Encoding", "identity");
            connection.setRequestProperty("Cache-Control", "no-cache");
            connection.setRequestProperty("Pragma", "no-cache");
            connection.setRequestProperty(
                "User-Agent", "ClipHub-Pagination-Stage0-Probe/1");
            code = Number(connection.getResponseCode());
            bytes = readBytes(code >= 200 && code < 300 ?
                connection.getInputStream() : connection.getErrorStream());
            text = String(new JavaString(bytes, "UTF-8"));
            if (code < 200 || code >= 300) {
                throw new Error("ClipHub entry HTTP " + code + ": " +
                    text.substring(0, 400));
            }
            return text;
        } finally {
            if (connection !== null) {
                try { connection.disconnect(); } catch (ignored) {}
            }
        }
    }

    function rowIds(rows) {
        var output = [];
        var index;
        rows = rows || [];
        for (index = 0; index < rows.length; index += 1) {
            output.push(Number(rows[index].id));
        }
        return output;
    }

    function sameIds(left, right) {
        var index;
        if (left.length !== right.length) { return false; }
        for (index = 0; index < left.length; index += 1) {
            if (Number(left[index]) !== Number(right[index])) {
                return false;
            }
        }
        return true;
    }

    function containsNoContext(errors) {
        var index;
        var text;
        for (index = 0; index < errors.length; index += 1) {
            text = String(errors[index]);
            if (text.indexOf("No Context associated with current Thread") >= 0 ||
                    text.indexOf("Context associated") >= 0) {
                return true;
            }
        }
        return false;
    }

    function runReadWorker(baselineIds) {
        var executor = Executors.newSingleThreadExecutor();
        var future;
        var box = {
            ok: true,
            completed: 0,
            orderMismatchCount: 0,
            countQueryCount: 0,
            tagQueryCount: 0,
            threadId: null,
            threadName: null,
            errors: []
        };
        try {
            future = executor.submit(new Packages.java.lang.Runnable({
                run: function () {
                    var index;
                    var rows;
                    var ids;
                    var tagIds;
                    var thread = Thread.currentThread();
                    box.threadId = Number(thread.getId());
                    box.threadName = String(thread.getName());
                    try {
                        for (index = 0; index < QUERY_LOOPS; index += 1) {
                            rows = global.ClipHub.Repository.listItems({
                                limit: 101,
                                offset: 0
                            });
                            ids = rowIds(rows);
                            if (!sameIds(baselineIds, ids)) {
                                box.orderMismatchCount += 1;
                            }
                            if (typeof global.ClipHub.Repository.countItems ===
                                    "function") {
                                global.ClipHub.Repository.countItems(false);
                                box.countQueryCount += 1;
                            }
                            if (typeof global.ClipHub.Repository.listItemTagMap ===
                                    "function") {
                                tagIds = ids.slice(0, 100);
                                global.ClipHub.Repository.listItemTagMap(tagIds);
                                box.tagQueryCount += 1;
                            }
                            box.completed += 1;
                            Thread.sleep(4);
                        }
                    } catch (error) {
                        box.ok = false;
                        box.errors.push(errorText(error));
                    }
                }
            }));
            future.get(30, TimeUnit.SECONDS);
        } catch (error) {
            box.ok = false;
            box.errors.push(errorText(error));
        } finally {
            try { executor.shutdownNow(); } catch (ignoredShutdown) {}
            try { executor.awaitTermination(3, TimeUnit.SECONDS); }
            catch (ignoredAwait) {}
        }
        box.ok = box.ok === true &&
            box.completed === QUERY_LOOPS &&
            box.orderMismatchCount === 0 &&
            !containsNoContext(box.errors);
        return box;
    }

    function runRapidClose(app) {
        var output = {
            ok: true,
            completed: 0,
            attachedAfterHideCount: 0,
            errors: []
        };
        var index;
        var shown;
        var hidden;
        for (index = 0; index < CLOSE_LOOPS; index += 1) {
            try {
                shown = app.executeControlCommand("show");
                hidden = app.executeControlCommand("hide");
                if (!shown || shown.ok !== true ||
                        !hidden || hidden.ok !== true) {
                    output.ok = false;
                    output.errors.push("show/hide failed at " + index);
                    break;
                }
                if (hidden.status && hidden.status.uiVisible === true) {
                    output.attachedAfterHideCount += 1;
                }
                output.completed += 1;
            } catch (error) {
                output.ok = false;
                output.errors.push(errorText(error));
                break;
            }
        }
        output.ok = output.ok === true &&
            output.completed === CLOSE_LOOPS &&
            output.attachedAfterHideCount === 0;
        return output;
    }

    function runStopRace(app) {
        var executor = Executors.newSingleThreadExecutor();
        var future;
        var box = {
            ok: true,
            completed: 0,
            observedStop: false,
            errors: [],
            stopResult: null,
            finalStatus: null
        };
        try {
            future = executor.submit(new Packages.java.lang.Runnable({
                run: function () {
                    var rows;
                    try {
                        while (box.completed < 200) {
                            if (!app.isStarted()) {
                                box.observedStop = true;
                                break;
                            }
                            rows = global.ClipHub.Repository.listItems({
                                limit: 20,
                                offset: 0
                            });
                            if (rows === null) {
                                throw new Error("Repository returned null");
                            }
                            box.completed += 1;
                            Thread.sleep(3);
                        }
                    } catch (error) {
                        box.ok = false;
                        box.errors.push(errorText(error));
                    }
                }
            }));
            Thread.sleep(18);
            box.stopResult = app.stop("pagination_stage0_probe_stop");
            future.get(15, TimeUnit.SECONDS);
        } catch (error) {
            box.ok = false;
            box.errors.push(errorText(error));
        } finally {
            try { executor.shutdownNow(); } catch (ignoredShutdown) {}
            try { executor.awaitTermination(3, TimeUnit.SECONDS); }
            catch (ignoredAwait) {}
        }
        try { box.finalStatus = app.getStatus(); }
        catch (ignoredStatus) { box.finalStatus = null; }
        box.ok = box.ok === true &&
            box.stopResult !== null &&
            box.stopResult.stopped === true &&
            box.observedStop === true &&
            !containsNoContext(box.errors) &&
            (!box.finalStatus || box.finalStatus.uiVisible !== true);
        return box;
    }

    function run() {
        var previousOptions = global.ClipHubBootstrapOptions;
        var bootstrap;
        var app;
        var baselineRows;
        var baselineIds;
        var identityOk;
        var worker;
        var rapidClose;
        var stopRace;
        var finalOk;
        if (global.ClipHub && global.ClipHub.App &&
                typeof global.ClipHub.App.isStarted === "function" &&
                global.ClipHub.App.isStarted()) {
            throw new Error("请先完全停止当前 ClipHub 后台，再运行分页阶段 0 探针");
        }
        try {
            global.ClipHubBootstrapOptions = {
                remoteRef: REF,
                runtimeName: RUNTIME_NAME
            };
            eval(fetchEntry());
            bootstrap = global.ClipHubBootstrapResult || {};
            app = global.ClipHub && global.ClipHub.App;
            identityOk = bootstrap.ok === true &&
                bootstrap.started === true && app &&
                bootstrap.sync &&
                String(bootstrap.sync.sourceRef || "") === REF &&
                String(bootstrap.sync.moduleSetVersion || "") ===
                    EXPECTED_MODULE_SET_VERSION &&
                Number((bootstrap.app || {}).moduleFileCount || 0) === 15;
            if (!identityOk) {
                return {
                    ok: false,
                    project: "ClipHub",
                    testEntry: "pagination_stage0_worker_and_rapid_close",
                    testEntryVersion: TEST_ENTRY_VERSION,
                    sourceRef: REF,
                    expectedModuleSetVersion:
                        EXPECTED_MODULE_SET_VERSION,
                    bootstrap: bootstrap,
                    error: "bootstrap identity mismatch"
                };
            }
            baselineRows = global.ClipHub.Repository.listItems({
                limit: 101,
                offset: 0
            });
            baselineIds = rowIds(baselineRows);
            worker = runReadWorker(baselineIds);
            rapidClose = runRapidClose(app);
            stopRace = runStopRace(app);
            finalOk = worker.ok === true &&
                rapidClose.ok === true && stopRace.ok === true;
            return {
                ok: finalOk,
                project: "ClipHub",
                testEntry: "pagination_stage0_worker_and_rapid_close",
                testEntryVersion: TEST_ENTRY_VERSION,
                sourceRef: REF,
                expectedModuleSetVersion: EXPECTED_MODULE_SET_VERSION,
                moduleFileCountExpected: 15,
                newModuleAdded: false,
                windowBlobExpected:
                    "4ccff8067656ae51602290c884081795ec0f65ea",
                filterModuleVersionExpected: 39,
                appModuleVersionExpected: 19,
                queryLoopsExpected: QUERY_LOOPS,
                rapidCloseLoopsExpected: CLOSE_LOOPS,
                baselineResultCount: baselineIds.length,
                worker: worker,
                rapidClose: rapidClose,
                stopRace: stopRace,
                executorSupported: worker.ok === true &&
                    stopRace.ok === true,
                fallbackRequired: !(worker.ok === true &&
                    stopRace.ok === true),
                nextStage: worker.ok === true && stopRace.ok === true ?
                    "repository_pagination_foundation" :
                    "handler_idle_scheduler_fallback",
                bootstrap: bootstrap
            };
        } finally {
            try {
                if (global.ClipHub && global.ClipHub.App &&
                        global.ClipHub.App.isStarted()) {
                    global.ClipHub.App.stop(
                        "pagination_stage0_probe_finally");
                }
            } catch (ignoredStop) {}
            if (previousOptions === undefined) {
                try { delete global.ClipHubBootstrapOptions; }
                catch (ignoredDelete) {
                    global.ClipHubBootstrapOptions = undefined;
                }
            } else {
                global.ClipHubBootstrapOptions = previousOptions;
            }
        }
    }

    try {
        global.ClipHubPaginationStage0ProbeResult = run();
    } catch (error) {
        global.ClipHubPaginationStage0ProbeResult = {
            ok: false,
            project: "ClipHub",
            testEntry: "pagination_stage0_worker_and_rapid_close",
            testEntryVersion: TEST_ENTRY_VERSION,
            sourceRef: REF,
            expectedModuleSetVersion: EXPECTED_MODULE_SET_VERSION,
            fallbackRequired: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubPaginationStage0ProbeResult);
'''

stage_doc = r'''# ClipHub 分页实施阶段 0：快速关闭防护与工作线程探针

## 分支与边界

- 开发分支：`agent/add-pagination-lazy-prefetch-20260807`
- 基线分支：`agent/rebuild-performance-from-main-20260806`
- 模块集：`20260807.01`
- 模块数量保持 `15`
- `src/ch_08_window.js` 保持 blob `4ccff8067656ae51602290c884081795ec0f65ea`
- 本阶段不加入分页 UI、设置项、Repository 分页接口或第 16 个模块。

## 已实施内容

### `src/ch_11_filter.js`

- 模块版本 `38 → 39`。
- 增加统一 `lifecycleGeneration`。
- `closePanel()` 统一失效渲染、刷新、搜索、输入、撤销、复制反馈等迟到任务。
- `schedulePanelRefresh()` 与 `scheduleCoalescedRefresh()` 同时校验局部 generation 和生命周期 generation。
- 增加 `prepareForAppShutdown(reason)`，关闭窗口并阻止停止期间重新显示。
- `getPanelState()` 增加生命周期、停止态和迟到回调丢弃计数。

### `src/ch_15_app.js`

- 模块版本 `18 → 19`。
- 增加应用停止闸门，停止开始时先将 `started=false`，阻止控制广播或其他入口重新显示 UI。
- 在模块逆序关闭前，显式调用 `Filter.prepareForAppShutdown()`。
- 保持 Filter 在 Database 之前关闭。
- `uiStatus()` 增加应用和 Filter 生命周期字段。

## 探针

运行根目录文件：

```text
ClipHub_分页工作线程探针.txt
```

探针执行：

1. 从本分支启动独立运行目录。
2. 主线程读取最多 101 条基线 ID。
3. 单线程 Executor 连续执行 50 次相同顺序查询。
4. 每轮同时调用条件总数和标签映射现有接口。
5. 连续执行 20 次显示后立即隐藏。
6. 工作线程查询期间完全停止 ClipHub。
7. 检查 Rhino Context、查询顺序、数据库关闭竞态、迟到窗口和残留 UI。

## 结果判定

通过时：

```json
{
  "ok": true,
  "executorSupported": true,
  "fallbackRequired": false,
  "nextStage": "repository_pagination_foundation"
}
```

失败或出现 `No Context associated with current Thread` 时：

```json
{
  "ok": false,
  "fallbackRequired": true,
  "nextStage": "handler_idle_scheduler_fallback"
}
```

探针失败不取消分页功能，只将阶段 1 后续异步方案切换为主线程 `Handler.post()` / `postDelayed()` 空闲分段。

## 阶段 0 验收门

只有设备实测同时满足以下条件，才进入阶段 1：

- `worker.completed = 50`
- `worker.orderMismatchCount = 0`
- `rapidClose.completed = 20`
- `rapidClose.attachedAfterHideCount = 0`
- `stopRace.ok = true`
- 无 Rhino Context 错误
- 无数据库关闭后访问
- 无 WindowManager 残留

本提交只提供可执行实现与探针，设备端结果必须以 ShortX 返回 JSON 为准。
'''

Path("ClipHub_分页工作线程探针.txt").write_text(probe, encoding="utf-8")
Path("docs").mkdir(parents=True, exist_ok=True)
Path("docs/ClipHub分页阶段0快速关闭与线程探针.md").write_text(
    stage_doc, encoding="utf-8")

manifest_path = Path("module-manifest.json")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
if manifest.get("moduleSetVersion") != "20260806.06":
    raise SystemExit("unexpected module set version")
if manifest.get("sourceRef") != "agent/rebuild-performance-from-main-20260806":
    raise SystemExit("unexpected manifest sourceRef")
if len(manifest.get("modules", [])) != 15:
    raise SystemExit("module count must remain 15")
manifest["moduleSetVersion"] = MODULE_SET_VERSION
manifest["sourceRef"] = BRANCH
for module in manifest["modules"]:
    module["sha"] = git_hash(module["path"])
manifest_path.write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8"
)

require_hash("src/ch_08_window.js", EXPECTED["src/ch_08_window.js"])
