/* ClipHub editor and pin probe 017. Rhino ES5 only. */
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
    var REQUIRED_SET = "20260721.16";
    var RUNTIME_NAME = "ClipHubProbe017";
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
                error: "Formal ClipHub was not running before probe 017" };
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
            contentType: "text",
            sourcePackage: String(item.sourcePackage),
            sourceLabel: String(item.sourceLabel),
            sourceUid: 10000,
            sourceConfidence: 100,
            isPinned: item.isPinned === true,
            createdAt: Number(item.createdAt),
            lastCopiedAt: Number(item.createdAt),
            updatedAt: Number(item.createdAt)
        }));
    }
    function indexOfId(ids, id) {
        var index;
        for (index = 0; index < ids.length; index += 1) {
            if (Number(ids[index]) === Number(id)) { return index; }
        }
        return -1;
    }
    function payloadsContainContent(values) {
        var index;
        for (index = 0; index < values.length; index += 1) {
            if (JSON.stringify(values[index]).indexOf("content") >= 0) {
                return true;
            }
        }
        return false;
    }
    function findMutation(values, mutation, id) {
        var index;
        var value;
        for (index = 0; index < values.length; index += 1) {
            value = values[index] || {};
            if (String(value.mutation || "") === String(mutation) &&
                    Number(value.id) === Number(id)) {
                return value;
            }
        }
        return null;
    }

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var formal = new File(root, "ClipHub");
        var modules = new File(formal, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var output = new File(ensureDir(new File(formal, "probes")),
            "cliphub_editor_pin_probe_017_" + stamp(startedAt) + ".json");
        var local = localManifest(formal);
        var control;
        var boot;
        var wait;
        var editor;
        var listState;
        var row;
        var createdId = null;
        var firstId;
        var secondId;
        var targetIndex;
        var stop;
        var events = [];
        var eventListener;
        var baseTime = startedAt - 10000;
        var result = {
            ok: false,
            probe: "cliphub_editor_pin_probe_017",
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
            addButtonPresent: false,
            editButtonsPresent: false,
            pinButtonsPresent: false,
            addClicked: false,
            editorNewAttached: false,
            editorFocusable: false,
            editorInputPresent: false,
            editorInputFocused: false,
            editorKeyboardRequested: false,
            editorWindowType: null,
            editorAddThreadName: null,
            createSaved: false,
            createThreadName: null,
            createdRowStored: false,
            manualSourceLabelMatched: false,
            createdVisible: false,
            createEventMatched: false,
            editClicked: false,
            editorEditAttached: false,
            editorTargetMatched: false,
            editSaved: false,
            editedRowStored: false,
            editEventMatched: false,
            pinClicked: false,
            pinStored: false,
            pinnedMovedFirst: false,
            pinThreadName: null,
            pinEventMatched: false,
            activeFilterApplied: false,
            filteredEditSaved: false,
            filteredEditRemoved: false,
            filterReappliedAfterEdit: false,
            resetRestoredAll: false,
            cancelClicked: false,
            cancelDidNotInsert: false,
            mutationEventsNoContent: false,
            editorReopenedBeforeStop: false,
            firstStopped: false,
            editorCleanupOnStop: false,
            firstDatabaseClosed: false,
            secondStart: null,
            recordsPersistedAfterRestart: false,
            editedContentPersisted: false,
            pinPersistedAfterRestart: false,
            pinnedFirstAfterRestart: false,
            editorClosedAfterRestart: false,
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

            eventListener = function (payload) { events.push(payload || {}); };
            global.ClipHub.EventBus.on("clipboard_added", eventListener);
            global.ClipHub.EventBus.on("clipboard_merged", eventListener);

            firstId = add({ content: "seed first", sourcePackage: "com.seed.one",
                sourceLabel: "Seed One", createdAt: baseTime + 1000 });
            secondId = add({ content: "seed second", sourcePackage: "com.seed.two",
                sourceLabel: "Seed Two", createdAt: baseTime + 2000 });
            result.seededCount = global.ClipHub.Repository.countItems(false);

            global.ClipHub.List.show({ limit: 20, widthDp: 340, heightDp: 420 });
            wait = waitFor(function () {
                return global.ClipHub.Window.getState().attachedToWindow === true;
            }, 1500);
            result.listAttached = wait.matched;
            listState = global.ClipHub.List.getState();
            result.initialRenderedCount = listState.renderedCount;
            result.addButtonPresent = listState.addButtonPresent === true;
            result.editButtonsPresent = listState.editButtonCount === 2;
            result.pinButtonsPresent = listState.pinButtonCount === 2;

            result.addClicked = global.ClipHub.List.performAddClick() === true;
            wait = waitFor(function () {
                return global.ClipHub.Editor.getState().attachedToWindow === true;
            }, 1500);
            editor = global.ClipHub.Editor.getState();
            result.editorNewAttached = wait.matched && editor.mode === "new";
            result.editorFocusable = editor.focusableWindow === true;
            result.editorInputPresent = editor.inputPresent === true;
            result.editorInputFocused = editor.inputFocused === true;
            result.editorKeyboardRequested = editor.keyboardRequestCount > 0;
            result.editorWindowType = editor.windowType;
            result.editorAddThreadName = editor.addThreadName;
            global.ClipHub.Editor.setInputText("manual created record");
            result.createSaved = global.ClipHub.Editor.performSaveClick() === true;
            waitFor(function () {
                return global.ClipHub.Editor.getState().attached === false &&
                    global.ClipHub.List.getState().renderedCount === 3;
            }, 1500);
            editor = global.ClipHub.Editor.getState();
            createdId = editor.lastSavedId;
            result.createThreadName = editor.saveThreadName;
            row = global.ClipHub.Repository.getItem(createdId, false);
            result.createdRowStored = row !== null && row !== undefined &&
                String(row.content) === "manual created record";
            result.manualSourceLabelMatched = row !== null && row !== undefined &&
                String(row.source_label || "") === "ClipHub 手动";
            result.createdVisible =
                indexOfId(global.ClipHub.List.getState().itemIds, createdId) >= 0;
            result.createEventMatched =
                findMutation(events, "created", createdId) !== null;

            targetIndex = indexOfId(global.ClipHub.List.getState().itemIds, createdId);
            result.editClicked = global.ClipHub.List.performEditClick(targetIndex) === true;
            wait = waitFor(function () {
                return global.ClipHub.Editor.getState().attachedToWindow === true;
            }, 1500);
            editor = global.ClipHub.Editor.getState();
            result.editorEditAttached = wait.matched && editor.mode === "edit";
            result.editorTargetMatched = Number(editor.itemId) === Number(createdId);
            global.ClipHub.Editor.setInputText("manual edited record");
            result.editSaved = global.ClipHub.Editor.performSaveClick() === true;
            waitFor(function () {
                row = global.ClipHub.Repository.getItem(createdId, false);
                return row !== null && String(row.content) === "manual edited record";
            }, 1200);
            row = global.ClipHub.Repository.getItem(createdId, false);
            result.editedRowStored = row !== null &&
                String(row.content) === "manual edited record";
            result.editEventMatched =
                findMutation(events, "updated", createdId) !== null;

            targetIndex = indexOfId(global.ClipHub.List.getState().itemIds, firstId);
            result.pinClicked = global.ClipHub.List.performPinClick(targetIndex) === true;
            waitFor(function () {
                row = global.ClipHub.Repository.getItem(firstId, false);
                return row !== null && Number(row.is_pinned) === 1 &&
                    Number(global.ClipHub.List.getState().itemIds[0]) ===
                    Number(firstId);
            }, 1200);
            row = global.ClipHub.Repository.getItem(firstId, false);
            listState = global.ClipHub.List.getState();
            result.pinStored = row !== null && Number(row.is_pinned) === 1;
            result.pinnedMovedFirst = Number(listState.itemIds[0]) === Number(firstId);
            result.pinThreadName = listState.pinThreadName;
            result.pinEventMatched =
                findMutation(events, "pin_changed", firstId) !== null;

            global.ClipHub.Filter.setKeyword("manual edited");
            result.activeFilterApplied =
                global.ClipHub.Filter.getState().lastResultCount === 1 &&
                global.ClipHub.List.getState().renderedCount === 1;
            result.editClicked = result.editClicked &&
                global.ClipHub.List.performEditClick(0) === true;
            waitFor(function () {
                return global.ClipHub.Editor.getState().attachedToWindow === true;
            }, 1500);
            global.ClipHub.Editor.setInputText("manual final record");
            result.filteredEditSaved =
                global.ClipHub.Editor.performSaveClick() === true;
            waitFor(function () {
                return global.ClipHub.Filter.getState().lastResultCount === 0 &&
                    global.ClipHub.List.getState().renderedCount === 0;
            }, 1500);
            result.filteredEditRemoved =
                global.ClipHub.List.getState().renderedCount === 0;
            result.filterReappliedAfterEdit =
                global.ClipHub.Filter.getState().eventApplyCount > 0;
            global.ClipHub.Filter.reset();
            result.resetRestoredAll =
                global.ClipHub.List.getState().renderedCount === 3;

            global.ClipHub.List.performAddClick();
            waitFor(function () {
                return global.ClipHub.Editor.getState().attachedToWindow === true;
            }, 1500);
            global.ClipHub.Editor.setInputText("cancelled record");
            result.cancelClicked =
                global.ClipHub.Editor.performCancelClick() === true;
            result.cancelDidNotInsert =
                global.ClipHub.Repository.countItems(false) === 3;
            result.mutationEventsNoContent = !payloadsContainContent(events);

            global.ClipHub.List.performAddClick();
            wait = waitFor(function () {
                return global.ClipHub.Editor.getState().attachedToWindow === true;
            }, 1500);
            result.editorReopenedBeforeStop = wait.matched;
            stop = global.ClipHub.App.stop("probe017_first");
            result.firstStopped = stop.stopped === true;
            editor = global.ClipHub.Editor.getState();
            result.editorCleanupOnStop = editor.attached === false &&
                editor.attachedToWindow === false &&
                editor.removeThreadName === "main";
            result.firstDatabaseClosed = !global.ClipHub.Database.isOpen();

            boot = start(root, modules, isolated);
            result.secondStart = boot;
            result.recordsPersistedAfterRestart =
                global.ClipHub.Repository.countItems(false) === 3;
            row = global.ClipHub.Repository.getItem(createdId, false);
            result.editedContentPersisted = row !== null &&
                String(row.content) === "manual final record";
            row = global.ClipHub.Repository.getItem(firstId, false);
            result.pinPersistedAfterRestart = row !== null &&
                Number(row.is_pinned) === 1;
            result.editorClosedAfterRestart =
                global.ClipHub.Editor.getState().attached === false;
            global.ClipHub.List.show({ limit: 20, widthDp: 340, heightDp: 420 });
            waitFor(function () {
                return global.ClipHub.Window.getState().attachedToWindow === true;
            }, 1500);
            listState = global.ClipHub.List.getState();
            result.pinnedFirstAfterRestart =
                Number(listState.itemIds[0]) === Number(firstId);
            result.renderedAllAfterRestart = listState.renderedCount === 3;
            result.finalClose = global.ClipHub.Window.close();
            stop = global.ClipHub.App.stop("probe017_second");
            result.secondStopped = stop.stopped === true;
            result.secondDatabaseClosed = !global.ClipHub.Database.isOpen();
        } catch (error) {
            result.error = errorText(error);
            try { global.ClipHub.App.stop("probe017_error"); }
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
                result.firstStart.ok === true && result.seededCount === 2 &&
                result.listAttached && result.initialRenderedCount === 2 &&
                result.addButtonPresent && result.editButtonsPresent &&
                result.pinButtonsPresent && result.addClicked &&
                result.editorNewAttached && result.editorFocusable &&
                result.editorInputPresent && result.editorInputFocused &&
                result.editorKeyboardRequested && result.editorWindowType === 2038 &&
                result.editorAddThreadName === "main" && result.createSaved &&
                result.createThreadName === "main" && result.createdRowStored &&
                result.manualSourceLabelMatched && result.createdVisible &&
                result.createEventMatched && result.editClicked &&
                result.editorEditAttached && result.editorTargetMatched &&
                result.editSaved && result.editedRowStored &&
                result.editEventMatched && result.pinClicked &&
                result.pinStored && result.pinnedMovedFirst &&
                result.pinThreadName === "main" && result.pinEventMatched &&
                result.activeFilterApplied && result.filteredEditSaved &&
                result.filteredEditRemoved && result.filterReappliedAfterEdit &&
                result.resetRestoredAll && result.cancelClicked &&
                result.cancelDidNotInsert && result.mutationEventsNoContent &&
                result.editorReopenedBeforeStop && result.firstStopped &&
                result.editorCleanupOnStop && result.firstDatabaseClosed &&
                result.secondStart && result.secondStart.ok === true &&
                result.recordsPersistedAfterRestart &&
                result.editedContentPersisted && result.pinPersistedAfterRestart &&
                result.pinnedFirstAfterRestart && result.editorClosedAfterRestart &&
                result.renderedAllAfterRestart && result.finalClose &&
                result.finalClose.ok === true && result.secondStopped &&
                result.secondDatabaseClosed && result.formalRestart &&
                result.formalRestart.ok === true && result.cleanup;
            write(output, JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try {
        global.ClipHubEditorPinProbe017Result = main();
    } catch (error) {
        global.ClipHubEditorPinProbe017Result = {
            ok: false,
            probe: "cliphub_editor_pin_probe_017",
            probeVersion: 1,
            fatal: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubEditorPinProbe017Result);
