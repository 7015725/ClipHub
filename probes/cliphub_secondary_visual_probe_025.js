/* ClipHub secondary-window visual structure probe 025. Rhino ES5 only. */
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
    var WindowManager = Packages.android.view.WindowManager;

    var REQUIRED_SET = "20260722.20";
    var RUNTIME_NAME = "ClipHubProbe025";
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
            if (lock !== null) {
                try { lock.release(); } catch (ignored) {}
            }
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
        requestId = stamp(now()) + "-" +
            Number(Thread.currentThread().getId());
        ackFile = new File(cacheDir,
            "control_ack_" + requestId + ".json");
        if (ackFile.exists()) { ackFile.delete(); }
        intent = new Intent(String(endpoint.action));
        intent.putExtra("runtimeDir", String(runtimeDir.getAbsolutePath()));
        intent.putExtra("command", "stop");
        intent.putExtra("requestId", requestId);
        intent.putExtra("controlToken", String(endpoint.token));
        context.sendBroadcast(intent);
        waitFor(function () {
            return ackFile.isFile() && lockFree(runtimeDir);
        }, 3000);
        if (ackFile.isFile()) {
            try { ack = JSON.parse(read(ackFile)); }
            catch (ignoredAck) {}
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
    function add(content, sourceLabel, createdAt) {
        return Number(global.ClipHub.Repository.insertItem({
            content: String(content),
            contentType: "text",
            sourcePackage: "com.secondary.visual.probe",
            sourceLabel: String(sourceLabel),
            sourceUid: 10000,
            sourceConfidence: 100,
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
    function flagPresent(flags, flag) {
        return (Number(flags) & Number(flag)) !== 0;
    }
    function payloadHasContent(events) {
        var index;
        for (index = 0; index < events.length; index += 1) {
            if (JSON.stringify(events[index]).indexOf("content") >= 0) {
                return true;
            }
        }
        return false;
    }

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var formal = new File(root, "ClipHub");
        var modules = new File(formal, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var outputFile = new File(ensureDir(new File(formal, "probes")),
            "cliphub_secondary_visual_probe_025_" +
                stamp(startedAt) + ".json");
        var local = localManifest(formal);
        var baseTime = startedAt - 10000;
        var normalId;
        var taggedId;
        var sourceId;
        var tagOne;
        var tagTwo;
        var tagThree;
        var listState;
        var filterState;
        var editorState;
        var index;
        var stop;
        var events = [];
        var result = {
            ok: false,
            probe: "cliphub_secondary_visual_probe_025",
            probeVersion: 1,
            startedAt: startedAt,
            moduleSetVersion: local.moduleSetVersion || null,
            sourceRef: local.sourceRef || null,
            outputPath: String(outputFile.getAbsolutePath()),
            error: null
        };

        if (!local.present || local.moduleSetVersion !== REQUIRED_SET) {
            throw new Error("Installed module set must be " + REQUIRED_SET);
        }

        try {
            result.formalControl = stopFormal(global.context, formal);
            if (!result.formalControl.ok ||
                    !result.formalControl.ackReceived ||
                    String(result.formalControl.ack.threadName || "") !==
                        "main") {
                throw new Error(result.formalControl.error ||
                    "Formal stop failed");
            }
            removeTree(isolated);
            result.firstStart = start(root, modules, isolated);
            result.schemaVersion = global.ClipHub.Database.getVersion();
            result.clipboardListenerStopped =
                global.ClipHub.Clipboard.stop().running === false;
            global.ClipHub.EventBus.on("clipboard_added", function (payload) {
                events.push(payload || {});
            });
            global.ClipHub.EventBus.on("tags_changed", function (payload) {
                events.push(payload || {});
            });

            normalId = add("alpha compact visual sample",
                "Normal Source", baseTime + 1000);
            taggedId = add("中文紧凑视觉样例",
                "Tagged Source", baseTime + 2000);
            sourceId = add("source width sample",
                "来源应用名称较长但仍需显示横向渐隐提示", baseTime + 3000);
            tagOne = Number(global.ClipHub.Repository.ensureTag("工作事项"));
            tagTwo = Number(global.ClipHub.Repository.ensureTag("参考资料"));
            global.ClipHub.Repository.attachTag(taggedId, tagOne);
            global.ClipHub.Repository.attachTag(taggedId, tagTwo);
            result.seededCount = global.ClipHub.Repository.countItems(false);
            result.initialTagCount = global.ClipHub.Repository.listTags().length;

            global.ClipHub.Settings.set("themeMode", "dark", { cleanup: false });
            global.ClipHub.List.show({ limit: 20, widthDp: 340, heightDp: 420 });
            result.listAttached = waitFor(function () {
                return global.ClipHub.Window.getState().attachedToWindow === true;
            }, 1500);
            result.initialRenderedCount = global.ClipHub.List.getState().renderedCount;

            result.filterOpened = global.ClipHub.List.performFilterClick() === true &&
                waitFor(function () {
                    return global.ClipHub.Filter.getPanelState().attachedToWindow === true;
                }, 1500);
            filterState = global.ClipHub.Filter.getPanelState();
            result.filterFocusable = filterState.focusableWindow === true;
            result.filterInputPresent = filterState.inputPresent === true;
            result.filterWindowType = filterState.panelWindowType;
            result.filterAddThreadName = filterState.panelAddThreadName;
            result.filterModal = filterState.modalWindow === true;
            result.filterOpaque = filterState.opaqueBackground === true;
            result.filterDimAmount = Number(filterState.dimAmount);
            result.filterHeightDp = Number(filterState.panelHeightDp);
            result.filterWidthDp = Number(filterState.panelWidthDp);
            result.filterDimFlagPresent = flagPresent(filterState.panelFlags,
                WindowManager.LayoutParams.FLAG_DIM_BEHIND);
            result.filterNotTouchModalAbsent = !flagPresent(filterState.panelFlags,
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL);
            result.filterSourceChipsPresent = filterState.sourceChipCount >= 1;
            result.filterTypeChipsPresent = filterState.typeChipCount >= 1;
            result.filterTagChipsPresent = filterState.tagChipCount === 2;
            result.filterHorizontalFadeEnabled =
                filterState.horizontalFadeEnabled === true;
            global.ClipHub.Filter.performSearch("alpha");
            result.filterAsciiCount = global.ClipHub.Filter.getState().lastResultCount;
            global.ClipHub.Filter.performSearch("中文");
            result.filterChineseCount = global.ClipHub.Filter.getState().lastResultCount;
            global.ClipHub.Filter.performResetClick();
            result.filterResetCount = global.ClipHub.Filter.getState().lastResultCount;
            result.filterCloseClicked = global.ClipHub.Filter.performCloseClick();
            result.filterClosed = waitFor(function () {
                return global.ClipHub.Filter.getPanelState().attached === false;
            }, 1000);
            result.filterRemoveThreadName =
                global.ClipHub.Filter.getPanelState().panelRemoveThreadName;

            result.newEditorOpened = global.ClipHub.List.performAddClick() === true &&
                waitFor(function () {
                    return global.ClipHub.Editor.getState().attachedToWindow === true;
                }, 1500);
            editorState = global.ClipHub.Editor.getState();
            result.newEditorMode = editorState.mode;
            result.newEditorFocusable = editorState.focusableWindow === true;
            result.newEditorInputPresent = editorState.inputPresent === true;
            result.newEditorWindowType = editorState.windowType;
            result.newEditorAddThreadName = editorState.addThreadName;
            result.newEditorModal = editorState.modalWindow === true;
            result.newEditorOpaque = editorState.opaqueBackground === true;
            result.newEditorDimAmount = Number(editorState.dimAmount);
            result.newEditorHeightDp = Number(editorState.panelHeightDp);
            result.newEditorWidthDp = Number(editorState.panelWidthDp);
            result.newEditorDimFlagPresent = flagPresent(editorState.windowFlags,
                WindowManager.LayoutParams.FLAG_DIM_BEHIND);
            result.newEditorNotTouchModalAbsent = !flagPresent(editorState.windowFlags,
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL);
            global.ClipHub.Editor.setInputText("created compact record");
            result.newEditorSaved = global.ClipHub.Editor.performSaveClick();
            editorState = global.ClipHub.Editor.getState();
            result.createdId = editorState.lastSavedId;
            result.createdStored = result.createdId !== null &&
                global.ClipHub.Repository.getItem(Number(result.createdId), false) !== null;
            result.newEditorClosedAfterSave = editorState.attached === false;

            listState = global.ClipHub.List.getState();
            index = indexOfId(listState.itemIds, taggedId);
            result.tagEditorOpened = global.ClipHub.List.performTagClick(index) === true &&
                waitFor(function () {
                    return global.ClipHub.Editor.getState().attachedToWindow === true;
                }, 1500);
            editorState = global.ClipHub.Editor.getState();
            result.tagEditorMode = editorState.mode;
            result.tagEditorTargetMatched = Number(editorState.itemId) === taggedId;
            result.tagEditorFocusable = editorState.focusableWindow === true;
            result.tagEditorModal = editorState.modalWindow === true;
            result.tagEditorOpaque = editorState.opaqueBackground === true;
            result.tagEditorDimAmount = Number(editorState.dimAmount);
            result.tagEditorInitialHeightDp = Number(editorState.panelHeightDp);
            result.tagEditorWidthDp = Number(editorState.panelWidthDp);
            result.tagEditorOptionsInitial = editorState.tagOptionCount;
            result.tagEditorAttachedInitial = editorState.attachedTagCount;
            result.tagEditorButtonsInitial = editorState.tagButtonCount;
            result.tagDeleteButtonsInitial = editorState.tagDeleteButtonCount;
            result.thirdTagCreated =
                global.ClipHub.Editor.performCreateTagClick("第三标签");
            editorState = global.ClipHub.Editor.getState();
            tagThree = Number(editorState.lastTagId);
            result.tagEditorOptionsAfterCreate = editorState.tagOptionCount;
            result.tagEditorAttachedAfterCreate = editorState.attachedTagCount;
            result.tagEditorHeightAfterCreateDp = Number(editorState.panelHeightDp);
            result.tagEditorHeightGrew =
                result.tagEditorHeightAfterCreateDp >= result.tagEditorInitialHeightDp;
            result.thirdTagDetached =
                global.ClipHub.Editor.performTagToggleClick(tagThree);
            result.thirdTagDeleted =
                global.ClipHub.Editor.performTagDeleteClick(tagThree);
            editorState = global.ClipHub.Editor.getState();
            result.tagEditorOptionsAfterDelete = editorState.tagOptionCount;
            result.tagEditorHeightAfterDeleteDp = Number(editorState.panelHeightDp);
            result.thirdTagAbsent =
                global.ClipHub.Repository.getTagByName("第三标签") === null;
            result.tagEditorCloseClicked =
                global.ClipHub.Editor.performCancelClick();
            result.tagEditorClosed = waitFor(function () {
                return global.ClipHub.Editor.getState().attached === false;
            }, 1000);

            result.editorReopenedBeforeStop =
                global.ClipHub.List.performAddClick() === true &&
                waitFor(function () {
                    return global.ClipHub.Editor.getState().attachedToWindow === true;
                }, 1500);
            stop = global.ClipHub.App.stop("probe025_first");
            result.firstStopped = stop.stopped === true;
            editorState = global.ClipHub.Editor.getState();
            result.editorCleanupOnStop = editorState.attached === false &&
                editorState.attachedToWindow === false &&
                editorState.removeThreadName === "main";
            result.firstDatabaseClosed = !global.ClipHub.Database.isOpen();
            result.eventsNoContent = !payloadHasContent(events);

            result.secondStart = start(root, modules, isolated);
            result.recordsPersistedAfterRestart =
                global.ClipHub.Repository.countItems(false) === 4;
            result.tagsPersistedAfterRestart =
                global.ClipHub.Repository.listTags().length === 2;
            result.editorClosedAfterRestart =
                global.ClipHub.Editor.getState().attached === false;
            result.filterClosedAfterRestart =
                global.ClipHub.Filter.getPanelState().attached === false;
            global.ClipHub.List.show({ limit: 20, widthDp: 340, heightDp: 420 });
            result.renderedAllAfterRestart = waitFor(function () {
                return global.ClipHub.List.getState().renderedCount === 4;
            }, 1200);
            result.finalClose = global.ClipHub.Window.close();
            stop = global.ClipHub.App.stop("probe025_second");
            result.secondStopped = stop.stopped === true;
            result.secondDatabaseClosed = !global.ClipHub.Database.isOpen();
        } catch (error) {
            result.error = errorText(error);
            try { global.ClipHub.App.stop("probe025_error"); }
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
            result.ok = result.error === null &&
                result.formalControl && result.formalControl.ok === true &&
                result.firstStart && result.firstStart.ok === true &&
                result.schemaVersion === 2 &&
                result.clipboardListenerStopped === true &&
                result.seededCount === 3 && result.initialTagCount === 2 &&
                result.listAttached && result.initialRenderedCount === 3 &&
                result.filterOpened && result.filterFocusable &&
                result.filterInputPresent && result.filterWindowType === 2038 &&
                result.filterAddThreadName === "main" && result.filterModal &&
                result.filterOpaque && result.filterDimAmount >= 0.7 &&
                result.filterHeightDp >= 300 && result.filterHeightDp <= 438 &&
                result.filterWidthDp <= 420 && result.filterDimFlagPresent &&
                result.filterNotTouchModalAbsent &&
                result.filterSourceChipsPresent && result.filterTypeChipsPresent &&
                result.filterTagChipsPresent && result.filterAsciiCount === 1 &&
                result.filterChineseCount === 1 && result.filterResetCount === 3 &&
                result.filterCloseClicked && result.filterClosed &&
                result.filterRemoveThreadName === "main" &&
                result.newEditorOpened && result.newEditorMode === "new" &&
                result.newEditorFocusable && result.newEditorInputPresent &&
                result.newEditorWindowType === 2038 &&
                result.newEditorAddThreadName === "main" &&
                result.newEditorModal && result.newEditorOpaque &&
                result.newEditorDimAmount >= 0.7 &&
                result.newEditorHeightDp <= 430 &&
                result.newEditorWidthDp <= 420 &&
                result.newEditorDimFlagPresent &&
                result.newEditorNotTouchModalAbsent && result.newEditorSaved &&
                result.createdStored && result.newEditorClosedAfterSave &&
                result.tagEditorOpened && result.tagEditorMode === "tags" &&
                result.tagEditorTargetMatched && result.tagEditorFocusable &&
                result.tagEditorModal && result.tagEditorOpaque &&
                result.tagEditorDimAmount >= 0.7 &&
                result.tagEditorInitialHeightDp >= 300 &&
                result.tagEditorInitialHeightDp < 430 &&
                result.tagEditorWidthDp <= 420 &&
                result.tagEditorOptionsInitial === 2 &&
                result.tagEditorAttachedInitial === 2 &&
                result.tagEditorButtonsInitial === 2 &&
                result.tagDeleteButtonsInitial === 2 &&
                result.thirdTagCreated &&
                result.tagEditorOptionsAfterCreate === 3 &&
                result.tagEditorAttachedAfterCreate === 3 &&
                result.tagEditorHeightAfterCreateDp <= 492 &&
                result.tagEditorHeightGrew && result.thirdTagDetached &&
                result.thirdTagDeleted &&
                result.tagEditorOptionsAfterDelete === 2 &&
                result.thirdTagAbsent && result.tagEditorCloseClicked &&
                result.tagEditorClosed && result.editorReopenedBeforeStop &&
                result.firstStopped && result.editorCleanupOnStop &&
                result.firstDatabaseClosed && result.eventsNoContent &&
                result.secondStart && result.secondStart.ok === true &&
                result.recordsPersistedAfterRestart &&
                result.tagsPersistedAfterRestart &&
                result.editorClosedAfterRestart &&
                result.filterClosedAfterRestart &&
                result.renderedAllAfterRestart && result.finalClose &&
                result.finalClose.ok === true && result.secondStopped &&
                result.secondDatabaseClosed && result.formalRestart &&
                result.formalRestart.ok === true && result.cleanup;
            write(outputFile, JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try {
        global.ClipHubSecondaryVisualProbe025Result = main();
    } catch (error) {
        global.ClipHubSecondaryVisualProbe025Result = {
            ok: false,
            probe: "cliphub_secondary_visual_probe_025",
            probeVersion: 1,
            fatal: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubSecondaryVisualProbe025Result);
