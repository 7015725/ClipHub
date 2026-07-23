/* ClipHub filter UI probe 016. Rhino ES5 only. */
(function (global) {
    var File = Packages.java.io.File;
    var FIS = Packages.java.io.FileInputStream;
    var FOS = Packages.java.io.FileOutputStream;
    var ISR = Packages.java.io.InputStreamReader;
    var OSW = Packages.java.io.OutputStreamWriter;
    var BR = Packages.java.io.BufferedReader;
    var BW = Packages.java.io.BufferedWriter;
    var SB = Packages.java.lang.StringBuilder;
    var Thread = Packages.java.lang.Thread;
    var System = Packages.java.lang.System;
    var RAF = Packages.java.io.RandomAccessFile;
    var SDF = Packages.java.text.SimpleDateFormat;
    var Locale = Packages.java.util.Locale;
    var Intent = Packages.android.content.Intent;
    var REQUIRED_SET = "20260721.15";
    var RUNTIME_NAME = "ClipHubProbe016";
    var MODULES = [
        "ch_01_base.js", "ch_02_log.js", "ch_03_database.js",
        "ch_04_clipboard.js", "ch_05_classifier.js", "ch_06_repository.js",
        "ch_07_theme.js", "ch_08_window.js", "ch_09_list.js",
        "ch_10_editor.js", "ch_11_filter.js", "ch_12_translation.js",
        "ch_13_settings.js", "ch_14_event_bus.js", "ch_15_app.js"
    ];

    function now() { return Number(System.currentTimeMillis()); }
    function stamp(value) {
        return String(new SDF("yyyyMMdd-HHmmss-SSS", Locale.US)
            .format(new Packages.java.util.Date(value)));
    }
    function close(value) {
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
    function ensureDir(file) {
        if (!file.exists() && !file.mkdirs() && !file.isDirectory()) {
            throw new Error("Cannot create directory: " + file.getAbsolutePath());
        }
        return file;
    }
    function read(file) {
        var reader = null;
        var builder = new SB();
        var line;
        try {
            reader = new BR(new ISR(new FIS(file), "UTF-8"));
            while ((line = reader.readLine()) !== null) {
                builder.append(line).append("\n");
            }
            return String(builder.toString());
        } finally { close(reader); }
    }
    function write(file, text) {
        var writer = null;
        try {
            writer = new BW(new OSW(new FOS(file, false), "UTF-8"));
            writer.write(String(text));
            writer.flush();
        } finally { close(writer); }
    }
    function removeTree(file) {
        var children;
        var index;
        var ok = true;
        if (!file.exists()) { return true; }
        if (file.isDirectory()) {
            children = file.listFiles();
            if (children !== null) {
                for (index = 0; index < children.length; index += 1) {
                    if (!removeTree(children[index])) { ok = false; }
                }
            }
        }
        if (file.exists() && !file.delete()) { ok = false; }
        return ok;
    }
    function waitFor(callback, timeoutMs) {
        var started = now();
        while (now() - started < timeoutMs) {
            if (callback()) {
                return { matched: true, waitedMs: now() - started };
            }
            Thread.sleep(25);
        }
        return { matched: callback(), waitedMs: now() - started };
    }
    function lockFree(runtimeDir) {
        var dataDir = ensureDir(new File(runtimeDir, "data"));
        var raf = null;
        var channel = null;
        var lock = null;
        try {
            raf = new RAF(new File(dataDir, "cliphub.lock"), "rw");
            channel = raf.getChannel();
            lock = channel.tryLock();
            return lock !== null;
        } catch (error) {
            if (String(error).indexOf("OverlappingFileLockException") >= 0) {
                return false;
            }
            throw error;
        } finally {
            if (lock !== null) { try { lock.release(); } catch (ignored) {} }
            close(channel);
            close(raf);
        }
    }
    function localManifest(installedDir) {
        var file = new File(new File(installedDir, "cache"),
            "module-manifest.local.json");
        var data;
        if (!file.isFile()) { return { present: false }; }
        data = JSON.parse(read(file));
        return {
            present: true,
            moduleSetVersion: String(data.moduleSetVersion || ""),
            sourceRef: String(data.sourceRef || "")
        };
    }
    function stopFormal(context, runtimeDir) {
        var cacheDir = ensureDir(new File(runtimeDir, "cache"));
        var endpointFile = new File(cacheDir, "control_endpoint.json");
        var endpoint;
        var requestId;
        var ackFile;
        var intent;
        var ack = null;
        var wait;
        if (lockFree(runtimeDir)) {
            return { ok: false, initiallyRunning: false,
                error: "Formal ClipHub was not running before probe 016" };
        }
        if (!endpointFile.isFile()) {
            return { ok: false, initiallyRunning: true,
                error: "Formal control endpoint is missing" };
        }
        endpoint = JSON.parse(read(endpointFile));
        requestId = stamp(now()) + "-" + Number(Thread.currentThread().getId());
        ackFile = new File(cacheDir, "control_ack_" + requestId + ".json");
        if (ackFile.exists()) { ackFile.delete(); }
        intent = new Intent(String(endpoint.action));
        intent.putExtra("runtimeDir", String(runtimeDir.getAbsolutePath()));
        intent.putExtra("command", "stop");
        intent.putExtra("requestId", requestId);
        intent.putExtra("controlToken", String(endpoint.token));
        context.sendBroadcast(intent);
        wait = waitFor(function () {
            return ackFile.isFile() && lockFree(runtimeDir);
        }, 3000);
        if (ackFile.isFile()) {
            try { ack = JSON.parse(read(ackFile)); } catch (ignoredAck) {}
            ackFile.delete();
        }
        return {
            ok: ack !== null && ack.ok === true && ack.stopped === true &&
                lockFree(runtimeDir) && !endpointFile.exists(),
            initiallyRunning: true,
            ackReceived: ack !== null,
            ack: ack,
            lockReleased: lockFree(runtimeDir),
            endpointRemoved: !endpointFile.exists(),
            waitedMs: wait.waitedMs,
            error: ack === null ? "Control acknowledgement not received" : null
        };
    }
    function start(root, moduleDir, runtimeDir) {
        var index;
        var file;
        global.ClipHub = {};
        for (index = 0; index < MODULES.length; index += 1) {
            file = new File(moduleDir, MODULES[index]);
            if (!file.isFile()) {
                throw new Error("Missing module: " + file.getAbsolutePath());
            }
            eval(read(file));
        }
        return global.ClipHub.App.start({
            shortxRoot: root,
            runtimeDir: String(runtimeDir.getAbsolutePath()),
            moduleDir: String(moduleDir.getAbsolutePath()),
            androidContext: global.context
        });
    }
    function add(item) {
        return Number(global.ClipHub.Repository.insertItem({
            content: String(item.content),
            contentType: String(item.contentType),
            sourcePackage: String(item.sourcePackage),
            sourceLabel: String(item.sourceLabel),
            sourceUid: Number(item.sourceUid || 10000),
            sourceConfidence: 100,
            isPinned: item.isPinned === true,
            createdAt: Number(item.createdAt),
            lastCopiedAt: Number(item.createdAt),
            updatedAt: Number(item.createdAt)
        }));
    }

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var formal = new File(root, "ClipHub");
        var modules = new File(formal, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var output = new File(ensureDir(new File(formal, "probes")),
            "cliphub_filter_ui_probe_016_" + stamp(startedAt) + ".json");
        var local = localManifest(formal);
        var control;
        var boot;
        var wait;
        var panel;
        var filterState;
        var listState;
        var stop;
        var baseTime = startedAt - 10000;
        var result = {
            ok: false,
            probe: "cliphub_filter_ui_probe_016",
            probeVersion: 1,
            startedAt: startedAt,
            finishedAt: null,
            durationMs: null,
            pid: Number(Packages.android.os.Process.myPid()),
            uid: Number(Packages.android.os.Process.myUid()),
            threadId: Number(Thread.currentThread().getId()),
            threadName: String(Thread.currentThread().getName()),
            moduleSetVersion: local.moduleSetVersion || null,
            sourceRef: local.sourceRef || null,
            formalControl: null,
            firstStart: null,
            seededCount: 0,
            listAttached: false,
            initialRenderedCount: 0,
            filterButtonPresent: false,
            filterButtonClicked: false,
            panelAttached: false,
            panelFocusable: false,
            inputPresent: false,
            inputFocused: false,
            keyboardRequested: false,
            panelWindowType: null,
            panelAddThreadName: null,
            sourceOptionsRendered: false,
            typeOptionsRendered: false,
            searchControlWorked: false,
            searchCount: 0,
            searchThreadName: null,
            sourceChipWorked: false,
            sourceFilteredCount: 0,
            typeChipWorked: false,
            combinedFilteredCount: 0,
            criteriaSynced: false,
            listFilterSummaryVisible: false,
            panelStayedOpen: false,
            resetControlWorked: false,
            resetRenderedAll: false,
            resetCriteriaCleared: false,
            panelCloseClicked: false,
            panelDetached: false,
            panelRemoveThreadName: null,
            panelReopened: false,
            panelCleanupOnStop: false,
            firstStopped: false,
            firstDatabaseClosed: false,
            secondStart: null,
            filterResetAfterRestart: false,
            panelClosedAfterRestart: false,
            renderedAllAfterRestart: false,
            finalClose: null,
            secondStopped: false,
            secondDatabaseClosed: false,
            formalRestart: null,
            cleanup: false,
            outputPath: String(output.getAbsolutePath()),
            error: null
        };

        if (!local.present || local.moduleSetVersion !== REQUIRED_SET) {
            throw new Error("Installed module set must be " + REQUIRED_SET);
        }
        try {
            control = stopFormal(global.context, formal);
            result.formalControl = control;
            if (!control.ok || !control.ackReceived ||
                    String(control.ack.threadName || "") !== "main") {
                throw new Error(control.error || "Formal stop failed");
            }
            removeTree(isolated);
            boot = start(root, modules, isolated);
            result.firstStart = boot;

            add({ content: "alpha plain record", contentType: "text",
                sourcePackage: "com.alpha", sourceLabel: "Alpha Source",
                createdAt: baseTime + 1000 });
            add({ content: "https://alpha.example/path", contentType: "url",
                sourcePackage: "com.alpha", sourceLabel: "Alpha Source",
                createdAt: baseTime + 2000 });
            add({ content: "beta alpha note", contentType: "text",
                sourcePackage: "com.beta", sourceLabel: "Beta Source",
                createdAt: baseTime + 3000 });
            add({ content: "%_literal alpha token", contentType: "url",
                sourcePackage: "com.beta", sourceLabel: "Beta Source",
                createdAt: baseTime + 4000 });
            add({ content: "gamma telephone", contentType: "phone",
                sourcePackage: "com.beta", sourceLabel: "Beta Source",
                createdAt: baseTime + 5000 });
            add({ content: "delta final", contentType: "text",
                sourcePackage: "com.gamma", sourceLabel: "Gamma Source",
                createdAt: baseTime + 6000 });
            result.seededCount = global.ClipHub.Repository.countItems(false);

            global.ClipHub.List.show({ limit: 20, widthDp: 340, heightDp: 420 });
            wait = waitFor(function () {
                return global.ClipHub.Window.getState().attachedToWindow === true;
            }, 1500);
            result.listAttached = wait.matched;
            listState = global.ClipHub.List.getState();
            result.initialRenderedCount = listState.renderedCount;
            result.filterButtonPresent = listState.filterButtonPresent === true;

            result.filterButtonClicked =
                global.ClipHub.List.performFilterClick() === true;
            wait = waitFor(function () {
                return global.ClipHub.Filter.getPanelState()
                    .attachedToWindow === true;
            }, 1500);
            panel = global.ClipHub.Filter.getPanelState();
            result.panelAttached = wait.matched && panel.attached === true;
            result.panelFocusable = panel.focusableWindow === true;
            result.inputPresent = panel.inputPresent === true;
            result.inputFocused = panel.inputFocused === true;
            result.keyboardRequested = panel.keyboardRequestCount > 0;
            result.panelWindowType = panel.panelWindowType;
            result.panelAddThreadName = panel.panelAddThreadName;
            result.sourceOptionsRendered = panel.sourceOptionCount === 3 &&
                panel.sourceChipCount === 3;
            result.typeOptionsRendered = panel.contentTypeOptionCount === 3 &&
                panel.typeChipCount === 3;

            result.searchControlWorked =
                global.ClipHub.Filter.performSearch("alpha") === true;
            waitFor(function () {
                return global.ClipHub.List.getState().renderedCount === 4;
            }, 1200);
            filterState = global.ClipHub.Filter.getState();
            result.searchCount = filterState.lastResultCount;
            result.searchThreadName = filterState.panel.lastUiThreadName;

            result.sourceChipWorked =
                global.ClipHub.Filter.performSourceClick("com.alpha") === true;
            waitFor(function () {
                return global.ClipHub.List.getState().renderedCount === 2;
            }, 1200);
            result.sourceFilteredCount =
                global.ClipHub.Filter.getState().lastResultCount;

            result.typeChipWorked =
                global.ClipHub.Filter.performTypeClick("url") === true;
            waitFor(function () {
                return global.ClipHub.List.getState().renderedCount === 1;
            }, 1200);
            filterState = global.ClipHub.Filter.getState();
            listState = global.ClipHub.List.getState();
            result.combinedFilteredCount = filterState.lastResultCount;
            result.criteriaSynced = filterState.criteria.keyword === "alpha" &&
                filterState.criteria.sourcePackages.length === 1 &&
                filterState.criteria.sourcePackages[0] === "com.alpha" &&
                filterState.criteria.contentTypes.length === 1 &&
                filterState.criteria.contentTypes[0] === "url";
            result.listFilterSummaryVisible = listState.filterActive === true &&
                String(listState.filterSummary).indexOf("关键词") >= 0 &&
                String(listState.filterSummary).indexOf("来源") >= 0 &&
                String(listState.filterSummary).indexOf("类型") >= 0;
            result.panelStayedOpen =
                global.ClipHub.Filter.getPanelState().attached === true;

            result.resetControlWorked =
                global.ClipHub.Filter.performResetClick() === true;
            waitFor(function () {
                return global.ClipHub.List.getState().renderedCount === 6;
            }, 1200);
            filterState = global.ClipHub.Filter.getState();
            result.resetRenderedAll = filterState.lastResultCount === 6 &&
                global.ClipHub.List.getState().renderedCount === 6;
            result.resetCriteriaCleared = filterState.active === false &&
                filterState.criteria.keyword === "" &&
                filterState.criteria.sourcePackages.length === 0 &&
                filterState.criteria.contentTypes.length === 0;

            result.panelCloseClicked =
                global.ClipHub.Filter.performCloseClick() === true;
            wait = waitFor(function () {
                return global.ClipHub.Filter.getPanelState().attached === false;
            }, 1200);
            panel = global.ClipHub.Filter.getPanelState();
            result.panelDetached = wait.matched &&
                panel.attachedToWindow === false;
            result.panelRemoveThreadName = panel.panelRemoveThreadName;

            global.ClipHub.List.performFilterClick();
            wait = waitFor(function () {
                return global.ClipHub.Filter.getPanelState()
                    .attachedToWindow === true;
            }, 1500);
            result.panelReopened = wait.matched &&
                global.ClipHub.Filter.getPanelState().panelOpenCount === 2;

            stop = global.ClipHub.App.stop("probe016_first");
            result.firstStopped = stop.stopped === true;
            panel = global.ClipHub.Filter.getPanelState();
            result.panelCleanupOnStop = panel.attached === false &&
                panel.attachedToWindow === false &&
                panel.panelRemoveThreadName === "main";
            result.firstDatabaseClosed = !global.ClipHub.Database.isOpen();

            boot = start(root, modules, isolated);
            result.secondStart = boot;
            filterState = global.ClipHub.Filter.getState();
            panel = global.ClipHub.Filter.getPanelState();
            result.filterResetAfterRestart = filterState.active === false &&
                filterState.criteria.keyword === "" &&
                filterState.criteria.sourcePackages.length === 0 &&
                filterState.criteria.contentTypes.length === 0;
            result.panelClosedAfterRestart = panel.attached === false;
            global.ClipHub.List.show({ limit: 20, widthDp: 340, heightDp: 420 });
            waitFor(function () {
                return global.ClipHub.Window.getState().attachedToWindow === true;
            }, 1500);
            result.renderedAllAfterRestart =
                global.ClipHub.List.getState().renderedCount === 6;
            result.finalClose = global.ClipHub.Window.close();
            stop = global.ClipHub.App.stop("probe016_second");
            result.secondStopped = stop.stopped === true;
            result.secondDatabaseClosed = !global.ClipHub.Database.isOpen();
        } catch (error) {
            result.error = errorText(error);
            try { global.ClipHub.App.stop("probe016_error"); }
            catch (ignoredStop) {}
        } finally {
            try {
                result.formalRestart = lockFree(formal) ?
                    start(root, modules, formal) :
                    { ok: true, started: true, reused: true };
            } catch (restartError) {
                if (result.error === null) {
                    result.error = "Formal restart failed: " +
                        errorText(restartError);
                }
            }
            result.cleanup = removeTree(isolated);
            result.finishedAt = now();
            result.durationMs = result.finishedAt - result.startedAt;
            result.ok = result.error === null && result.formalControl &&
                result.formalControl.ok === true && result.firstStart &&
                result.firstStart.ok === true && result.seededCount === 6 &&
                result.listAttached && result.initialRenderedCount === 6 &&
                result.filterButtonPresent && result.filterButtonClicked &&
                result.panelAttached && result.panelFocusable &&
                result.inputPresent && result.inputFocused &&
                result.keyboardRequested && result.panelWindowType === 2038 &&
                result.panelAddThreadName === "main" &&
                result.sourceOptionsRendered && result.typeOptionsRendered &&
                result.searchControlWorked && result.searchCount === 4 &&
                result.searchThreadName === "main" &&
                result.sourceChipWorked && result.sourceFilteredCount === 2 &&
                result.typeChipWorked && result.combinedFilteredCount === 1 &&
                result.criteriaSynced && result.listFilterSummaryVisible &&
                result.panelStayedOpen && result.resetControlWorked &&
                result.resetRenderedAll && result.resetCriteriaCleared &&
                result.panelCloseClicked && result.panelDetached &&
                result.panelRemoveThreadName === "main" &&
                result.panelReopened && result.firstStopped &&
                result.panelCleanupOnStop && result.firstDatabaseClosed &&
                result.secondStart && result.secondStart.ok === true &&
                result.filterResetAfterRestart &&
                result.panelClosedAfterRestart &&
                result.renderedAllAfterRestart && result.finalClose &&
                result.finalClose.ok === true && result.secondStopped &&
                result.secondDatabaseClosed && result.formalRestart &&
                result.formalRestart.ok === true && result.cleanup;
            write(output, JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try {
        global.ClipHubFilterUiProbe016Result = main();
    } catch (error) {
        global.ClipHubFilterUiProbe016Result = {
            ok: false,
            probe: "cliphub_filter_ui_probe_016",
            probeVersion: 1,
            fatal: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubFilterUiProbe016Result);
