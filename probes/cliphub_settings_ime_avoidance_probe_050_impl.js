/* ClipHub Settings IME avoidance probe 050. Rhino ES5 only. */
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
    var Color = Packages.android.graphics.Color;

    var REQUIRED_SET = "20260723.08";
    var RUNTIME_NAME = "ClipHubProbe050";
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
            Thread.sleep(30);
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

    function imeScenePassed(state, expectedName) {
        return state !== null && state !== undefined &&
            state.softInputAdjustResize === true &&
            state.keyboardVisible === true &&
            state.keyboardAvoidanceApplied === true &&
            state.panelGravity === "ime_top" &&
            Number(state.currentPanelHeightDp) <
                Number(state.normalPanelHeightDp) - 20 &&
            Number(state.imeInsetBottomDp) >= 120 &&
            state.panelAboveKeyboard === true &&
            String(state.focusedInputName || "") === String(expectedName) &&
            state.focusedInputVisible === true &&
            Number(state.delayedCallbackErrorCount) === 0 &&
            state.lastDelayedCallbackError === null;
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
            "cliphub_settings_ime_avoidance_probe_050_" +
                stamp(startedAt) + ".json");
        var manifest;
        var state;
        var result = {
            ok: false,
            probe: "cliphub_settings_ime_avoidance_probe_050",
            probeVersion: 1,
            startedAt: startedAt,
            moduleSetVersion: REQUIRED_SET,
            sourceRef: "agent/initialize-project-skeleton",
            runtimeName: RUNTIME_NAME,
            formalWasRunning: !lockFree(formal),
            formalRunningRequired: true,
            sceneDurationMs: 8000,
            sceneCount: 2,
            visualScreenshotRequired: true,
            instruction: "场景1截百度 APP ID 输入框与键盘；场景2截新标签名称输入框与键盘。两张截图均需完整保留面板顶部和键盘上沿，不得裁剪。",
            error: null,
            lastCheckpoint: "created",
            outputPath: String(outputFile.getAbsolutePath())
        };

        write(outputFile, JSON.stringify(result, null, 2) + "\n");
        try {
            if (!result.formalWasRunning) {
                throw new Error(
                    "Probe 050 requires the formal ClipHub instance to be running");
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
            if (!result.formalHide.ok) {
                throw new Error(result.formalHide.error || "Formal hide failed");
            }
            checkpoint(result, outputFile, "after_formal_hide");

            removeTree(isolated);
            result.start = start(root, moduleDir, isolated);
            if (!result.start || result.start.ok !== true) {
                throw new Error("Isolated App.start failed");
            }
            result.settingsModuleVersion =
                Number(global.ClipHub.Settings.MODULE_VERSION);
            if (result.settingsModuleVersion !== 10) {
                throw new Error("Settings v10 is required");
            }
            try { global.ClipHub.Clipboard.stop(); } catch (ignoredClipboard) {}

            global.ClipHub.Repository.insertTag({
                name: "文本", colorValue: Number(Color.parseColor("#7C5CFC")),
                manualOrder: 1000
            });
            global.ClipHub.Repository.insertTag({
                name: "要点", colorValue: Number(Color.parseColor("#4ECDC4")),
                manualOrder: 2000
            });
            global.ClipHub.Repository.insertTag({
                name: "重点", colorValue: Number(Color.parseColor("#FF6B6B")),
                manualOrder: 3000
            });

            result.settingsOpen = global.ClipHub.Settings.open();
            waitFor(function () {
                return global.ClipHub.Settings.getState().attachedToWindow === true;
            }, 1200);

            result.translationFocus =
                global.ClipHub.Settings.performFocusInput(
                    "translation.baidu.app_id");
            waitFor(function () {
                state = global.ClipHub.Settings.getState();
                return imeScenePassed(state, "translation.baidu.app_id");
            }, 4000);
            result.translationScene = global.ClipHub.Settings.getState();
            result.translationImePassed = imeScenePassed(
                result.translationScene, "translation.baidu.app_id");
            checkpoint(result, outputFile, "translation_scene_ready");
            Thread.sleep(8000);

            result.tagFocus = global.ClipHub.Settings.performFocusInput(
                "tag.new.name");
            waitFor(function () {
                state = global.ClipHub.Settings.getState();
                return imeScenePassed(state, "tag.new.name") &&
                    Number(state.inputAutoScrollCount) >= 1;
            }, 4000);
            result.tagScene = global.ClipHub.Settings.getState();
            result.tagImePassed = imeScenePassed(
                result.tagScene, "tag.new.name") &&
                Number(result.tagScene.inputAutoScrollCount) >= 1;
            checkpoint(result, outputFile, "tag_scene_ready");
            Thread.sleep(8000);

            result.hideKeyboard = global.ClipHub.Settings.hideKeyboard();
            waitFor(function () {
                state = global.ClipHub.Settings.getState();
                return state.keyboardVisible === false &&
                    state.keyboardAvoidanceApplied === false &&
                    state.panelGravity === "bottom" &&
                    Math.abs(Number(state.currentPanelHeightDp) -
                        Number(state.normalPanelHeightDp)) <= 2 &&
                    Number(state.imeAnchorSpacerHeightDp) === 0;
            }, 3500);
            result.restoreState = global.ClipHub.Settings.getState();
            result.restorePassed =
                result.restoreState.keyboardVisible === false &&
                result.restoreState.keyboardAvoidanceApplied === false &&
                result.restoreState.panelGravity === "bottom" &&
                Math.abs(Number(result.restoreState.currentPanelHeightDp) -
                    Number(result.restoreState.normalPanelHeightDp)) <= 2 &&
                Number(result.restoreState.imeAnchorSpacerHeightDp) === 0 &&
                Number(result.restoreState.delayedCallbackErrorCount) === 0 &&
                result.restoreState.lastDelayedCallbackError === null;

            result.settingsClose = global.ClipHub.Settings.close("probe050");
            Thread.sleep(350);
            result.closedState = global.ClipHub.Settings.getState();
            result.stop = global.ClipHub.App.stop(
                "probe050_settings_ime_avoidance");
            Thread.sleep(450);
            result.databaseClosed = !global.ClipHub.Database.isOpen();
            result.lockReleased = lockFree(isolated);
            checkpoint(result, outputFile, "after_isolated_stop");
        } catch (error) {
            result.error = errorText(error);
            try { global.ClipHub.App.stop("probe050_error"); }
            catch (ignoredStop) {}
        } finally {
            try {
                result.formalShow = controlFormal(global.context, formal, "show");
                result.formalRestored = result.formalShow.ok === true &&
                    result.formalShow.ack && result.formalShow.ack.status &&
                    result.formalShow.ack.status.uiVisible === true;
            } catch (restoreError) {
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
                result.settingsModuleVersion === 10 &&
                result.translationImePassed === true &&
                result.tagImePassed === true &&
                result.restorePassed === true &&
                result.databaseClosed === true &&
                result.lockReleased === true &&
                result.formalRestored === true &&
                result.cleanup === true;
            write(outputFile, JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try {
        global.ClipHubSettingsImeAvoidanceProbe050Result = main();
    } catch (error) {
        global.ClipHubSettingsImeAvoidanceProbe050Result = {
            ok: false,
            probe: "cliphub_settings_ime_avoidance_probe_050",
            probeVersion: 1,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubSettingsImeAvoidanceProbe050Result);
