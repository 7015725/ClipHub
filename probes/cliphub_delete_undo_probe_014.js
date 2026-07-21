/* ClipHub delete and undo probe 014. Rhino ES5 only. */
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
    var REQUIRED_SET = "20260721.13";
    var RUNTIME_NAME = "ClipHubProbe014";
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
                return String(error.javaException.getClass().getName()) + ": " + String(error);
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
            if (callback()) { return { matched: true, waitedMs: now() - started }; }
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
                error: "Formal ClipHub was not running before probe 014" };
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
    function loadAndStart(root, moduleDir, runtimeDir) {
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
    function indexOfId(ids, id) {
        var index;
        for (index = 0; index < ids.length; index += 1) {
            if (Number(ids[index]) === Number(id)) { return index; }
        }
        return -1;
    }

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var installed = new File(root, "ClipHub");
        var moduleDir = new File(installed, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var output = new File(ensureDir(new File(installed, "probes")),
            "cliphub_delete_undo_probe_014_" + stamp(startedAt) + ".json");
        var local = localManifest(installed);
        var context = global.context;
        var control;
        var boot;
        var show;
        var wait;
        var baseAt = startedAt - 10000;
        var ids = [];
        var index;
        var listState;
        var targetId;
        var targetIndex;
        var targetRow;
        var appStop;
        var deleteEventCount = 0;
        var restoreEventCount = 0;
        var lastDeleteEventId = null;
        var lastRestoreEventId = null;
        var result = {
            ok: false,
            probe: "cliphub_delete_undo_probe_014",
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
            initialRenderedCount: 0,
            windowAttached: false,
            targetId: null,
            firstDeleteClicked: false,
            firstDeleteHidden: false,
            softDeleteStored: false,
            undoAvailableAfterDelete: false,
            deleteThreadName: null,
            deleteEventCount: 0,
            deleteEventIdMatched: false,
            undoClicked: false,
            restoredVisible: false,
            restoredInDatabase: false,
            undoClearedAfterRestore: false,
            restoreThreadName: null,
            restoreEventCount: 0,
            restoreEventIdMatched: false,
            secondDeleteClicked: false,
            secondDeleteHidden: false,
            eventRefreshObserved: false,
            firstStopped: false,
            firstDatabaseClosed: false,
            secondStart: null,
            deletionPersistedAfterRestart: false,
            undoClearedAfterRestart: false,
            renderedTwoAfterRestart: false,
            renderThreadName: null,
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
            control = stopFormal(context, installed);
            result.formalControl = control;
            if (!control.ok || !control.ackReceived ||
                    String(control.ack.threadName || "") !== "main") {
                throw new Error(control.error || "Formal stop failed");
            }

            removeTree(isolated);
            boot = loadAndStart(root, moduleDir, isolated);
            result.firstStart = boot;

            global.ClipHub.EventBus.on("clipboard_deleted", function (payload) {
                deleteEventCount += 1;
                lastDeleteEventId = payload && payload.id !== undefined
                    ? Number(payload.id) : null;
            });
            global.ClipHub.EventBus.on("clipboard_restored", function (payload) {
                restoreEventCount += 1;
                lastRestoreEventId = payload && payload.id !== undefined
                    ? Number(payload.id) : null;
            });

            for (index = 1; index <= 3; index += 1) {
                ids.push(Number(global.ClipHub.Repository.insertItem({
                    content: "ClipHub probe 014 item " + index + " " + startedAt,
                    contentType: "text",
                    sourcePackage: "android",
                    sourceLabel: "Android system",
                    sourceUid: 1000,
                    sourceConfidence: 100,
                    createdAt: baseAt + index * 100,
                    lastCopiedAt: baseAt + index * 100,
                    updatedAt: baseAt + index * 100
                })));
            }
            result.seededCount = global.ClipHub.Repository.countItems(false);

            show = global.ClipHub.List.show({ limit: 10, widthDp: 340, heightDp: 420 });
            wait = waitFor(function () {
                listState = global.ClipHub.List.getState();
                return global.ClipHub.Window.getState().attachedToWindow === true &&
                    listState.renderedCount === 3;
            }, 1800);
            result.windowAttached = wait.matched;
            listState = global.ClipHub.List.getState();
            result.initialRenderedCount = Number(listState.renderedCount);
            targetId = Number(listState.itemIds[1]);
            result.targetId = targetId;

            result.firstDeleteClicked =
                global.ClipHub.List.performDeleteClick(1) === true;
            wait = waitFor(function () {
                listState = global.ClipHub.List.getState();
                return global.ClipHub.Repository.countItems(false) === 2 &&
                    listState.renderedCount === 2 && listState.undoAvailable === true;
            }, 1500);
            result.firstDeleteHidden = wait.matched;
            targetRow = global.ClipHub.Repository.getItem(targetId, true);
            result.softDeleteStored = targetRow !== null &&
                targetRow.deleted_at !== null && targetRow.deleted_at !== undefined;
            listState = global.ClipHub.List.getState();
            result.undoAvailableAfterDelete = listState.undoAvailable === true;
            result.deleteThreadName = listState.deleteThreadName;
            result.deleteEventCount = deleteEventCount;
            result.deleteEventIdMatched = lastDeleteEventId === targetId;

            result.undoClicked = global.ClipHub.List.performUndoClick() === true;
            wait = waitFor(function () {
                listState = global.ClipHub.List.getState();
                return global.ClipHub.Repository.countItems(false) === 3 &&
                    listState.renderedCount === 3 && listState.undoAvailable === false;
            }, 1500);
            result.restoredVisible = wait.matched;
            targetRow = global.ClipHub.Repository.getItem(targetId, false);
            result.restoredInDatabase = targetRow !== null && targetRow !== undefined;
            listState = global.ClipHub.List.getState();
            result.undoClearedAfterRestore = listState.undoAvailable === false;
            result.restoreThreadName = listState.restoreThreadName;
            result.restoreEventCount = restoreEventCount;
            result.restoreEventIdMatched = lastRestoreEventId === targetId;

            targetIndex = indexOfId(listState.itemIds, targetId);
            result.secondDeleteClicked = targetIndex >= 0 &&
                global.ClipHub.List.performDeleteClick(targetIndex) === true;
            wait = waitFor(function () {
                listState = global.ClipHub.List.getState();
                return global.ClipHub.Repository.countItems(false) === 2 &&
                    listState.renderedCount === 2;
            }, 1500);
            result.secondDeleteHidden = wait.matched;
            listState = global.ClipHub.List.getState();
            result.eventRefreshObserved = listState.eventRefreshCount >= 3;
            result.deleteEventCount = deleteEventCount;

            global.ClipHub.Window.close();
            appStop = global.ClipHub.App.stop("probe014_first");
            result.firstStopped = appStop.stopped === true;
            result.firstDatabaseClosed = !global.ClipHub.Database.isOpen();

            boot = loadAndStart(root, moduleDir, isolated);
            result.secondStart = boot;
            targetRow = global.ClipHub.Repository.getItem(targetId, true);
            result.deletionPersistedAfterRestart =
                global.ClipHub.Repository.countItems(false) === 2 &&
                targetRow !== null && targetRow.deleted_at !== null &&
                targetRow.deleted_at !== undefined;
            listState = global.ClipHub.List.getState();
            result.undoClearedAfterRestart = listState.undoAvailable === false;

            global.ClipHub.List.show({ limit: 10, widthDp: 340, heightDp: 420 });
            wait = waitFor(function () {
                listState = global.ClipHub.List.getState();
                return global.ClipHub.Window.getState().attachedToWindow === true &&
                    listState.renderedCount === 2;
            }, 1800);
            result.renderedTwoAfterRestart = wait.matched;
            listState = global.ClipHub.List.getState();
            result.renderThreadName = listState.renderThreadName;

            result.finalClose = global.ClipHub.Window.close();
            appStop = global.ClipHub.App.stop("probe014_second");
            result.secondStopped = appStop.stopped === true;
            result.secondDatabaseClosed = !global.ClipHub.Database.isOpen();
        } catch (error) {
            result.error = errorText(error);
            try {
                if (global.ClipHub && global.ClipHub.App) {
                    global.ClipHub.App.stop("probe014_error");
                }
            } catch (ignoredStop) {}
        } finally {
            try {
                if (lockFree(installed)) {
                    boot = loadAndStart(root, moduleDir, installed);
                    result.formalRestart = boot;
                } else {
                    result.formalRestart = {
                        ok: true, started: true, reused: true,
                        reason: "formal_lock_already_held"
                    };
                }
            } catch (restartError) {
                if (result.error === null) {
                    result.error = "Formal restart failed: " + errorText(restartError);
                }
            }
            result.cleanup = removeTree(isolated);
            result.finishedAt = now();
            result.durationMs = result.finishedAt - result.startedAt;
            result.ok = result.error === null &&
                result.formalControl && result.formalControl.ok === true &&
                result.firstStart && result.firstStart.ok === true &&
                result.seededCount === 3 && result.initialRenderedCount === 3 &&
                result.windowAttached && result.firstDeleteClicked &&
                result.firstDeleteHidden && result.softDeleteStored &&
                result.undoAvailableAfterDelete && result.deleteThreadName === "main" &&
                result.deleteEventCount === 2 && result.deleteEventIdMatched &&
                result.undoClicked && result.restoredVisible &&
                result.restoredInDatabase && result.undoClearedAfterRestore &&
                result.restoreThreadName === "main" && result.restoreEventCount === 1 &&
                result.restoreEventIdMatched && result.secondDeleteClicked &&
                result.secondDeleteHidden && result.eventRefreshObserved &&
                result.firstStopped && result.firstDatabaseClosed &&
                result.secondStart && result.secondStart.ok === true &&
                result.deletionPersistedAfterRestart && result.undoClearedAfterRestart &&
                result.renderedTwoAfterRestart && result.renderThreadName === "main" &&
                result.finalClose && result.finalClose.ok === true &&
                result.secondStopped && result.secondDatabaseClosed &&
                result.formalRestart && result.formalRestart.ok === true &&
                result.cleanup;
            write(output, JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try {
        global.ClipHubDeleteUndoProbe014Result = main();
    } catch (error) {
        global.ClipHubDeleteUndoProbe014Result = {
            ok: false,
            probe: "cliphub_delete_undo_probe_014",
            probeVersion: 1,
            fatal: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubDeleteUndoProbe014Result);
