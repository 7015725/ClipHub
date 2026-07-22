/* ClipHub Editor shutdown race regression probe 048. Rhino ES5 only. */
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

    var REQUIRED_SET = "20260723.05";
    var RUNTIME_NAME = "ClipHubProbe048";
    var MODULES = [
        "ch_01_base.js", "ch_02_log.js", "ch_03_database.js",
        "ch_04_clipboard.js", "ch_05_classifier.js",
        "ch_06_repository.js", "ch_07_theme.js", "ch_08_window.js",
        "ch_09_list.js", "ch_10_editor.js", "ch_11_filter.js",
        "ch_12_translation.js", "ch_13_settings.js",
        "ch_14_event_bus.js", "ch_15_app.js"
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
            throw new Error("Cannot create directory: " +
                file.getAbsolutePath());
        }
        if (!file.isDirectory()) {
            throw new Error("Not a directory: " + file.getAbsolutePath());
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
        while (now() - started < Number(timeoutMs || 0)) {
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

    function controlFormal(context, runtimeDir, command) {
        var cacheDir = ensureDir(new File(runtimeDir, "cache"));
        var endpointFile = new File(cacheDir, "control_endpoint.json");
        var endpoint;
        var requestId;
        var ackFile;
        var intent;
        var ack = null;
        command = String(command);
        if (lockFree(runtimeDir)) {
            return { ok: false, command: command,
                error: "Formal instance is not running" };
        }
        if (!endpointFile.isFile()) {
            return { ok: false, command: command,
                error: "Formal control endpoint is missing" };
        }
        endpoint = JSON.parse(read(endpointFile));
        requestId = stamp(now()) + "-" +
            Number(Thread.currentThread().getId());
        ackFile = new File(cacheDir,
            "control_ack_" + requestId + ".json");
        if (ackFile.exists()) { ackFile.delete(); }
        intent = new Intent(String(endpoint.action));
        intent.putExtra("runtimeDir", String(runtimeDir.getAbsolutePath()));
        intent.putExtra("command", command);
        intent.putExtra("requestId", requestId);
        intent.putExtra("controlToken", String(endpoint.token));
        context.sendBroadcast(intent);
        waitFor(function () { return ackFile.isFile(); }, 3500);
        if (ackFile.isFile()) {
            try { ack = JSON.parse(read(ackFile)); }
            catch (ignoredAck) {}
            ackFile.delete();
        }
        return {
            ok: ack !== null && ack.ok === true &&
                String(ack.command || "") === command,
            command: command,
            ack: ack,
            error: ack === null ?
                "Control acknowledgement not received" : null
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

    function checkpoint(result, outputFile, name) {
        result.lastCheckpoint = String(name);
        write(outputFile, JSON.stringify(result, null, 2) + "\n");
    }

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var formal = new File(root, "ClipHub");
        var isolated = new File(root, RUNTIME_NAME);
        var moduleDir = new File(formal, "modules");
        var manifestFile = new File(new File(formal, "cache"),
            "module-manifest.local.json");
        var outputDir = ensureDir(new File(formal, "probes"));
        var outputFile = new File(outputDir,
            "cliphub_editor_shutdown_race_probe_048_" +
                stamp(startedAt) + ".json");
        var manifest;
        var result = {
            ok: false,
            probe: "cliphub_editor_shutdown_race_probe_048",
            probeVersion: 1,
            startedAt: startedAt,
            moduleSetVersion: REQUIRED_SET,
            sourceRef: "agent/initialize-project-skeleton",
            runtimeName: RUNTIME_NAME,
            formalWasRunning: !lockFree(formal),
            formalRunningRequired: true,
            error: null,
            lastCheckpoint: "created",
            outputPath: String(outputFile.getAbsolutePath())
        };
        var quickCloseState;
        var saveHideState;
        var shutdownState;
        var itemId;

        write(outputFile, JSON.stringify(result, null, 2) + "\n");
        try {
            if (!result.formalWasRunning) {
                throw new Error(
                    "Probe 048 requires the formal ClipHub instance to be running");
            }
            if (!manifestFile.isFile()) {
                throw new Error("Formal local manifest is missing");
            }
            manifest = JSON.parse(read(manifestFile));
            if (String(manifest.moduleSetVersion || "") !== REQUIRED_SET) {
                throw new Error("Required moduleSetVersion " + REQUIRED_SET +
                    ", actual " + String(manifest.moduleSetVersion || ""));
            }

            checkpoint(result, outputFile, "before_formal_hide");
            result.formalHide = controlFormal(global.context, formal, "hide");
            if (!result.formalHide.ok || !result.formalHide.ack ||
                    !result.formalHide.ack.status ||
                    result.formalHide.ack.status.uiVisible !== false) {
                throw new Error(result.formalHide.error ||
                    "Formal UI hide failed");
            }
            checkpoint(result, outputFile, "after_formal_hide");

            removeTree(isolated);
            result.start = start(root, moduleDir, isolated);
            if (!result.start || result.start.ok !== true) {
                throw new Error("Isolated App.start failed");
            }
            result.editorModuleVersion = Number(global.ClipHub.Editor.MODULE_VERSION);
            if (result.editorModuleVersion !== 11) {
                throw new Error("Editor v11 is required");
            }
            try { global.ClipHub.Clipboard.stop(); } catch (ignoredClipboard) {}
            checkpoint(result, outputFile, "after_isolated_start");

            result.quickCloseOpen = global.ClipHub.Editor.openNew({
                requestKeyboard: false
            });
            result.quickCloseText = global.ClipHub.Editor.setInputText(
                "ClipHub 048 快速关闭");
            result.quickClose = global.ClipHub.Editor.close();
            Thread.sleep(550);
            quickCloseState = global.ClipHub.Editor.getState();
            result.quickCloseState = quickCloseState;
            result.quickClosePassed = quickCloseState.attached === false &&
                quickCloseState.pendingDelayedCallbackCount === 0 &&
                quickCloseState.delayedCallbackErrorCount === 0 &&
                quickCloseState.lastDelayedCallbackError === null;
            checkpoint(result, outputFile, "after_quick_close");

            result.saveHideOpen = global.ClipHub.Editor.openNew({
                requestKeyboard: false
            });
            global.ClipHub.Editor.setInputText("ClipHub 048 保存后隐藏");
            result.saveHideSave = global.ClipHub.Editor.performSaveClick();
            itemId = Number(global.ClipHub.Editor.getState().lastSavedId || 0);
            result.saveHideItemId = itemId;
            result.saveHide = global.ClipHub.App.executeControlCommand("hide");
            Thread.sleep(550);
            saveHideState = global.ClipHub.Editor.getState();
            result.saveHideState = saveHideState;
            result.saveHidePassed = result.saveHideSave === true &&
                itemId > 0 && saveHideState.attached === false &&
                saveHideState.pendingDelayedCallbackCount === 0 &&
                saveHideState.delayedCallbackErrorCount === 0;
            checkpoint(result, outputFile, "after_save_hide");

            result.shutdownOpen = global.ClipHub.Editor.openNew({
                requestKeyboard: false
            });
            global.ClipHub.Editor.setInputText("ClipHub 048 直接停止");
            checkpoint(result, outputFile, "before_isolated_stop");
            result.stop = global.ClipHub.App.stop("probe048_shutdown_race");
            Thread.sleep(650);
            shutdownState = global.ClipHub.Editor.getState();
            result.shutdownState = shutdownState;
            result.databaseClosed = !global.ClipHub.Database.isOpen();
            result.lockReleased = lockFree(isolated);
            result.shutdownPassed = result.stop &&
                result.stop.stopped === true &&
                shutdownState.ready === false &&
                shutdownState.attached === false &&
                shutdownState.pendingDelayedCallbackCount === 0 &&
                shutdownState.delayedCallbackErrorCount === 0 &&
                shutdownState.lastDelayedCallbackError === null &&
                result.databaseClosed === true &&
                result.lockReleased === true;
            checkpoint(result, outputFile, "after_isolated_stop");
        } catch (error) {
            result.error = errorText(error);
            try { global.ClipHub.App.stop("probe048_error"); }
            catch (ignoredStop) {}
        } finally {
            try {
                checkpoint(result, outputFile, "before_formal_restore");
                result.formalShow = controlFormal(global.context, formal, "show");
                if (result.formalShow.ok && result.formalShow.ack &&
                        result.formalShow.ack.status) {
                    result.formalRestored =
                        result.formalShow.ack.status.uiVisible === true;
                } else {
                    result.formalRestored = false;
                }
            } catch (restoreError) {
                result.formalShow = {
                    ok: false, error: errorText(restoreError)
                };
                result.formalRestored = false;
                if (result.error === null) {
                    result.error = "Formal restore failed: " +
                        errorText(restoreError);
                }
            }
            result.cleanup = removeTree(isolated);
            result.finishedAt = now();
            result.durationMs = result.finishedAt - result.startedAt;
            result.lastCheckpoint = "finished";
            result.ok = result.error === null &&
                result.formalWasRunning === true &&
                result.editorModuleVersion === 11 &&
                result.quickClosePassed === true &&
                result.saveHidePassed === true &&
                result.shutdownPassed === true &&
                result.formalRestored === true &&
                result.cleanup === true;
            write(outputFile, JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try {
        global.ClipHubEditorShutdownRaceProbe048Result = main();
    } catch (error) {
        global.ClipHubEditorShutdownRaceProbe048Result = {
            ok: false,
            probe: "cliphub_editor_shutdown_race_probe_048",
            probeVersion: 1,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubEditorShutdownRaceProbe048Result);
