/* ClipHub visual and adaptive layout probe 022. Rhino ES5 only. */
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
    var Configuration = Packages.android.content.res.Configuration;

    var REQUIRED_SET = "20260722.19";
    var RUNTIME_NAME = "ClipHubProbe022";
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
            if (callback()) { return true; }
            Thread.sleep(25);
        }
        return callback();
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
    function localManifest(runtimeDir) {
        var file = new File(new File(runtimeDir, "cache"),
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
        if (lockFree(runtimeDir)) {
            return { ok: false, error: "Formal ClipHub was not running" };
        }
        if (!endpointFile.isFile()) {
            return { ok: false, error: "Formal control endpoint is missing" };
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
        waitFor(function () { return ackFile.isFile() && lockFree(runtimeDir); }, 3000);
        if (ackFile.isFile()) {
            try { ack = JSON.parse(read(ackFile)); } catch (ignoredAck) {}
            ackFile.delete();
        }
        return {
            ok: ack !== null && ack.ok === true && ack.stopped === true &&
                lockFree(runtimeDir) && !endpointFile.exists(),
            ackReceived: ack !== null,
            ack: ack,
            lockReleased: lockFree(runtimeDir),
            endpointRemoved: !endpointFile.exists(),
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
    function repeatText(prefix, count) {
        var parts = [];
        var index;
        for (index = 0; index < count; index += 1) {
            parts.push(String(prefix) + "-" + index);
        }
        return parts.join(" ");
    }
    function add(content, sensitive, pinned, sourceLabel, createdAt) {
        return Number(global.ClipHub.Repository.insertItem({
            content: String(content),
            contentType: "text",
            sourcePackage: "com.layout.probe",
            sourceLabel: String(sourceLabel),
            sourceUid: 10000,
            sourceConfidence: 100,
            isSensitive: sensitive === true,
            isPinned: pinned === true,
            createdAt: Number(createdAt),
            lastCopiedAt: Number(createdAt),
            updatedAt: Number(createdAt)
        }));
    }
    function indexOfId(ids, id) {
        var index;
        for (index = 0; index < ids.length; index += 1) {
            if (Number(ids[index]) === Number(id)) { return index; }
        }
        return -1;
    }
    function insideBounds(windowState) {
        var bounds = windowState.safeBounds;
        return windowState.x >= bounds.left && windowState.y >= bounds.top &&
            windowState.x + windowState.width <= bounds.right &&
            windowState.y + windowState.height <= bounds.bottom;
    }
    function displayState(context) {
        var metrics = context.getResources().getDisplayMetrics();
        var config = context.getResources().getConfiguration();
        return {
            widthPixels: Number(metrics.widthPixels),
            heightPixels: Number(metrics.heightPixels),
            density: Number(metrics.density),
            densityDpi: Number(metrics.densityDpi),
            orientation: Number(config.orientation),
            portrait: Number(config.orientation) === Number(Configuration.ORIENTATION_PORTRAIT),
            landscape: Number(config.orientation) === Number(Configuration.ORIENTATION_LANDSCAPE)
        };
    }
    function panelClosed() {
        return global.ClipHub.Filter.getPanelState().attached === false &&
            global.ClipHub.Editor.getState().attached === false &&
            global.ClipHub.List.getDetailState().attached === false;
    }
    function runTheme(mode, widthDp, heightDp, longId, taggedId) {
        var output = { mode: mode, requestedWidthDp: widthDp,
            requestedHeightDp: heightDp };
        var listState;
        var windowState;
        var index;
        global.ClipHub.Filter.reset({ apply: false });
        try { global.ClipHub.Filter.closePanel(); } catch (ignoredFilter) {}
        try { global.ClipHub.Editor.close(); } catch (ignoredEditor) {}
        try { global.ClipHub.List.closeDetail(); } catch (ignoredDetail) {}
        try { global.ClipHub.List.hide(true); } catch (ignoredList) {}
        global.ClipHub.Settings.set("themeMode", mode, { cleanup: false });
        output.themeStored = global.ClipHub.Settings.get("themeMode", "") === mode;
        global.ClipHub.List.show({ limit: 20, widthDp: widthDp, heightDp: heightDp });
        output.listAttached = waitFor(function () {
            return global.ClipHub.Window.getState().attachedToWindow === true;
        }, 1500);
        listState = global.ClipHub.List.getState();
        windowState = global.ClipHub.Window.getState();
        output.windowInsideBounds = insideBounds(windowState);
        output.windowWidthFits = Number(windowState.width) <=
            Number(windowState.safeBounds.right - windowState.safeBounds.left);
        output.windowHeightFits = Number(windowState.height) <=
            Number(windowState.safeBounds.bottom - windowState.safeBounds.top);
        output.renderedCount = Number(listState.renderedCount);
        output.buttonsPresent = listState.addButtonPresent === true &&
            listState.filterButtonPresent === true && listState.editButtonCount === 5 &&
            listState.pinButtonCount === 5 && listState.tagButtonCount === 5;
        output.detailButtonsPresent = Number(listState.detailButtonCount) >= 2;
        output.reorderHandlesPresent = Number(listState.reorderHandleCount) === 5;
        output.tagLabelsPresent = Number(listState.renderedTagLabelCount) >= 1;
        output.sensitiveMaskPresent = Number(listState.renderedSensitiveMaskCount) === 1;
        output.listRenderedOnMain = String(listState.renderThreadName || "") === "main";
        output.listError = listState.lastError;

        output.filterOpened = global.ClipHub.List.performFilterClick() === true &&
            waitFor(function () {
                return global.ClipHub.Filter.getPanelState().attachedToWindow === true;
            }, 1500);
        output.filterState = global.ClipHub.Filter.getPanelState();
        output.filterUsable = output.filterOpened &&
            output.filterState.focusableWindow === true &&
            output.filterState.inputPresent === true &&
            Number(output.filterState.sourceChipCount) >= 1 &&
            Number(output.filterState.typeChipCount) >= 1 &&
            Number(output.filterState.tagChipCount) >= 1 &&
            Number(output.filterState.panelWindowType) === 2038 &&
            String(output.filterState.panelAddThreadName || "") === "main" &&
            output.filterState.lastError === null;
        global.ClipHub.Filter.performCloseClick();
        output.filterClosed = global.ClipHub.Filter.getPanelState().attached === false;

        output.addEditorOpened = global.ClipHub.List.performAddClick() === true &&
            waitFor(function () {
                return global.ClipHub.Editor.getState().attachedToWindow === true;
            }, 1500);
        output.addEditorState = global.ClipHub.Editor.getState();
        output.addEditorUsable = output.addEditorOpened &&
            output.addEditorState.mode === "new" &&
            output.addEditorState.focusableWindow === true &&
            output.addEditorState.inputPresent === true &&
            Number(output.addEditorState.windowType) === 2038 &&
            String(output.addEditorState.addThreadName || "") === "main" &&
            output.addEditorState.lastError === null;
        global.ClipHub.Editor.performCancelClick();
        output.addEditorClosed = global.ClipHub.Editor.getState().attached === false;

        listState = global.ClipHub.List.getState();
        index = indexOfId(listState.itemIds, taggedId);
        output.tagEditorOpened = global.ClipHub.List.performTagClick(index) === true &&
            waitFor(function () {
                return global.ClipHub.Editor.getState().attachedToWindow === true;
            }, 1500);
        output.tagEditorState = global.ClipHub.Editor.getState();
        output.tagEditorUsable = output.tagEditorOpened &&
            output.tagEditorState.mode === "tags" &&
            Number(output.tagEditorState.itemId) === Number(taggedId) &&
            output.tagEditorState.focusableWindow === true &&
            output.tagEditorState.inputPresent === true &&
            Number(output.tagEditorState.tagOptionCount) >= 2 &&
            Number(output.tagEditorState.tagButtonCount) >= 2 &&
            output.tagEditorState.lastError === null;
        global.ClipHub.Editor.performCancelClick();
        output.tagEditorClosed = global.ClipHub.Editor.getState().attached === false;

        listState = global.ClipHub.List.getState();
        index = indexOfId(listState.itemIds, longId);
        output.detailOpened = global.ClipHub.List.performDetailClick(index) === true &&
            waitFor(function () {
                return global.ClipHub.List.getDetailState().attachedToWindow === true;
            }, 1500);
        output.detailState = global.ClipHub.List.getDetailState();
        output.detailUsable = output.detailOpened &&
            Number(output.detailState.itemId) === Number(longId) &&
            output.detailState.textVisible === true &&
            output.detailState.textSelectable === true &&
            output.detailState.scrollable === true &&
            output.detailState.copyButtonPresent === true &&
            output.detailState.editButtonPresent === true &&
            output.detailState.closeButtonPresent === true &&
            Number(output.detailState.windowType) === 2038 &&
            String(output.detailState.addThreadName || "") === "main";
        global.ClipHub.List.performDetailCloseClick();
        output.detailClosed = global.ClipHub.List.getDetailState().attached === false;
        output.allSecondaryWindowsClosed = panelClosed();
        output.ok = output.themeStored && output.listAttached &&
            output.windowInsideBounds && output.windowWidthFits &&
            output.windowHeightFits && output.renderedCount === 5 &&
            output.buttonsPresent && output.detailButtonsPresent &&
            output.reorderHandlesPresent && output.tagLabelsPresent &&
            output.sensitiveMaskPresent && output.listRenderedOnMain &&
            output.listError === null && output.filterUsable &&
            output.filterClosed && output.addEditorUsable &&
            output.addEditorClosed && output.tagEditorUsable &&
            output.tagEditorClosed && output.detailUsable &&
            output.detailClosed && output.allSecondaryWindowsClosed;
        return output;
    }

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var formal = new File(root, "ClipHub");
        var modules = new File(formal, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var outputFile = new File(ensureDir(new File(formal, "probes")),
            "cliphub_visual_layout_probe_022_" + stamp(startedAt) + ".json");
        var local = localManifest(formal);
        var boot;
        var stop;
        var tagOne;
        var tagTwo;
        var shortId;
        var longId;
        var sensitiveId;
        var taggedId;
        var pinnedId;
        var baseTime = startedAt - 20000;
        var result = {
            ok: false,
            probe: "cliphub_visual_layout_probe_022",
            probeVersion: 2,
            startedAt: startedAt,
            moduleSetVersion: local.moduleSetVersion || null,
            sourceRef: local.sourceRef || null,
            outputPath: String(outputFile.getAbsolutePath()),
            visualScreenshotRequired: true,
            error: null
        };
        if (!local.present || local.moduleSetVersion !== REQUIRED_SET) {
            throw new Error("Installed module set must be " + REQUIRED_SET);
        }
        try {
            result.formalControl = stopFormal(global.context, formal);
            if (!result.formalControl.ok || !result.formalControl.ackReceived ||
                    String(result.formalControl.ack.threadName || "") !== "main") {
                throw new Error(result.formalControl.error || "Formal stop failed");
            }
            removeTree(isolated);
            boot = start(root, modules, isolated);
            result.firstStart = boot;
            result.schemaVersion = global.ClipHub.Database.getVersion();
            result.display = displayState(global.context);
            shortId = add("短文本布局样例", false, false,
                "来源应用名称较长但仍需保持单行省略", baseTime + 1000);
            longId = add(repeatText("长文本布局", 60), false, false,
                "Long Layout Source", baseTime + 2000);
            sensitiveId = add(repeatText("敏感布局", 50) +
                "\n第二行\n第三行\n第四行", true, false,
                "Sensitive Layout", baseTime + 3000);
            taggedId = add("标签摘要与按钮密度布局样例", false, false,
                "Tagged Layout Source", baseTime + 4000);
            pinnedId = add("置顶记录布局样例", false, true,
                "Pinned Layout", baseTime + 5000);
            tagOne = Number(global.ClipHub.Repository.ensureTag("工作事项"));
            tagTwo = Number(global.ClipHub.Repository.ensureTag("较长的自定义标签名称"));
            global.ClipHub.Repository.attachTag(taggedId, tagOne);
            global.ClipHub.Repository.attachTag(taggedId, tagTwo);
            result.seededCount = global.ClipHub.Repository.countItems(false);
            result.tagCount = global.ClipHub.Repository.listTags().length;
            result.light = runTheme("light", 280, 360, longId, taggedId);
            result.dark = runTheme("dark", 420, 620, longId, taggedId);
            result.themeModesPassed = result.light.ok === true && result.dark.ok === true;
            result.recordIdsCreated = [shortId, longId, sensitiveId, taggedId, pinnedId].length;
            result.finalListClose = global.ClipHub.List.hide(true);
            stop = global.ClipHub.App.stop("probe022_first");
            result.firstStopped = stop.stopped === true;
            result.firstDatabaseClosed = !global.ClipHub.Database.isOpen();
            boot = start(root, modules, isolated);
            result.secondStart = boot;
            result.recordsPersistedAfterRestart =
                global.ClipHub.Repository.countItems(false) === 5;
            result.themePersistedAfterRestart =
                global.ClipHub.Settings.get("themeMode", "") === "dark";
            result.secondaryWindowsClosedAfterRestart = panelClosed();
            result.mainWindowClosedAfterRestart =
                global.ClipHub.Window.getState().attached === false;
            stop = global.ClipHub.App.stop("probe022_second");
            result.secondStopped = stop.stopped === true;
            result.secondDatabaseClosed = !global.ClipHub.Database.isOpen();
        } catch (error) {
            result.error = errorText(error);
            try { global.ClipHub.App.stop("probe022_error"); }
            catch (ignoredStop) {}
        } finally {
            try {
                result.formalRestart = lockFree(formal) ?
                    start(root, modules, formal) :
                    { ok: true, started: true, reused: true };
            } catch (restartError) {
                if (result.error === null) {
                    result.error = "Formal restart failed: " + errorText(restartError);
                }
            }
            result.cleanup = removeTree(isolated);
            result.finishedAt = now();
            result.durationMs = result.finishedAt - result.startedAt;
            result.ok = result.error === null && result.formalControl &&
                result.formalControl.ok === true && result.firstStart &&
                result.firstStart.ok === true && result.schemaVersion === 2 &&
                result.seededCount === 5 && result.tagCount === 2 &&
                result.themeModesPassed && result.recordIdsCreated === 5 &&
                result.firstStopped && result.firstDatabaseClosed &&
                result.secondStart && result.secondStart.ok === true &&
                result.recordsPersistedAfterRestart &&
                result.themePersistedAfterRestart &&
                result.secondaryWindowsClosedAfterRestart &&
                result.mainWindowClosedAfterRestart && result.secondStopped &&
                result.secondDatabaseClosed && result.formalRestart &&
                result.formalRestart.ok === true && result.cleanup;
            write(outputFile, JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try {
        global.ClipHubVisualLayoutProbe022Result = main();
    } catch (error) {
        global.ClipHubVisualLayoutProbe022Result = {
            ok: false,
            probe: "cliphub_visual_layout_probe_022",
            probeVersion: 2,
            fatal: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubVisualLayoutProbe022Result);
