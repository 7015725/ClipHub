/* ClipHub editor keyboard and long-text probe 042. Rhino ES5 only. */
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
    var Toast = Packages.android.widget.Toast;

    var REQUIRED_SET = "20260722.35";
    var RUNTIME_NAME = "ClipHubProbe042";
    var SCENE_DURATION_MS = 10000;
    var MODULES = [
        "ch_01_base.js", "ch_02_log.js", "ch_03_database.js",
        "ch_04_clipboard.js", "ch_05_classifier.js", "ch_06_repository.js",
        "ch_07_theme.js", "ch_08_window.js", "ch_09_list.js",
        "ch_10_editor.js", "ch_11_filter.js", "ch_12_translation.js",
        "ch_13_settings.js", "ch_14_event_bus.js", "ch_15_app.js"
    ];

    function now() {
        return Number(System.currentTimeMillis());
    }

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
        } finally {
            close(reader);
        }
    }

    function write(file, text) {
        var writer = null;
        try {
            writer = new BW(new OSW(new FOS(file, false), "UTF-8"));
            writer.write(String(text));
            writer.flush();
        } finally {
            close(writer);
        }
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
            return { ok: true, skipped: true, reason: "not_running" };
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
        }, 3500);
        if (ackFile.isFile()) {
            try { ack = JSON.parse(read(ackFile)); } catch (ignoredAck) {}
            ackFile.delete();
        }
        return {
            ok: ack !== null && ack.ok === true &&
                ack.stopped === true && lockFree(runtimeDir) &&
                !endpointFile.exists(),
            skipped: false,
            ackReceived: ack !== null,
            ack: ack,
            lockReleased: lockFree(runtimeDir),
            endpointRemoved: !endpointFile.exists(),
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

    function showToast(text) {
        try {
            Toast.makeText(global.context, String(text),
                Toast.LENGTH_LONG).show();
        } catch (ignored) {}
    }

    function add(content, contentType, sourcePackage, sourceLabel,
            sensitive, pinned, createdAt) {
        return Number(global.ClipHub.Repository.insertItem({
            content: String(content),
            contentType: String(contentType || "text"),
            sourcePackage: String(sourcePackage || "com.cliphub.probe042"),
            sourceLabel: String(sourceLabel || "探测来源"),
            sourceUid: 10000,
            sourceConfidence: 100,
            isSensitive: sensitive === true,
            isPinned: pinned === true,
            createdAt: Number(createdAt),
            lastCopiedAt: Number(createdAt),
            updatedAt: Number(createdAt)
        }));
    }

    function containsText(items, target) {
        var index;
        items = items || [];
        for (index = 0; index < items.length; index += 1) {
            if (String(items[index]) === String(target)) { return true; }
        }
        return false;
    }

    function sameValue(left, right) {
        if (left === null || left === undefined) {
            return right === null || right === undefined;
        }
        return String(left) === String(right);
    }

    function runShell(command) {
        var ShellCommand =
            Packages.tornaco.apps.shortx.core.proto.action.ShellCommand;
        var action = ShellCommand.newBuilder()
            .setCommand(String(command))
            .setSingleShot(true)
            .setId("ClipHub#Probe042Shell")
            .build();
        var executed = shortx.executeAction(action);
        var data = executed.contextData;
        return {
            out: String(data.get("shellOut")),
            err: String(data.get("shellErr")),
            code: Number(data.get("shellCode"))
        };
    }

    function buildLongText() {
        var lines = [];
        var index;
        for (index = 1; index <= 120; index += 1) {
            lines.push("第 " + index + " 行：ClipHub Rhino ES5 长文本输入法适配测试");
        }
        return lines.join("\n");
    }

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var formal = new File(root, "ClipHub");
        var modules = new File(formal, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var outputFile = new File(ensureDir(new File(formal, "probes")),
            "cliphub_editor_keyboard_probe_042_" + stamp(startedAt) + ".json");
        var local = localManifest(formal);
        var formalWasRunning = !lockFree(formal);
        var baseTime = startedAt - 20000;
        var existingId = null;
        var shortText = "ClipHub 输入法适配测试\nAndroid 14 / Rhino ES5";
        var longText = buildLongText();
        var countBefore = 0;
        var countAfter = 0;
        var result = {
            ok: false,
            probe: "cliphub_editor_keyboard_probe_042",
            probeVersion: 1,
            moduleSetVersion: local.moduleSetVersion || null,
            sourceRef: local.sourceRef || null,
            sceneDurationMs: SCENE_DURATION_MS,
            sceneCount: 3,
            visualScreenshotRequired: true,
            instruction: "场景1截键盘已弹出的短文本编辑页；场景2截长文本光标位于末尾的编辑页；场景3截第一次返回隐藏键盘后仍保持打开的编辑页。三张截图均不得裁剪。",
            outputPath: String(outputFile.getAbsolutePath()),
            formalWasRunning: formalWasRunning,
            startedAt: startedAt,
            repositorySaveSemanticsChanged: false,
            navigationImplementationChanged: false,
            error: null
        };

        try {
            if (!local.present || local.moduleSetVersion !== REQUIRED_SET) {
                throw new Error("Installed module set must be " + REQUIRED_SET);
            }
            result.formalControl = stopFormal(global.context, formal);
            if (!result.formalControl.ok) {
                throw new Error(result.formalControl.error ||
                    "Formal stop failed");
            }
            removeTree(isolated);
            result.start = start(root, modules, isolated);
            result.themeModuleVersion = Number(global.ClipHub.Theme.MODULE_VERSION);
            result.windowModuleVersion = Number(global.ClipHub.Window.MODULE_VERSION);
            result.listModuleVersion = Number(global.ClipHub.List.MODULE_VERSION);
            result.editorModuleVersion = Number(global.ClipHub.Editor.MODULE_VERSION);
            result.filterModuleVersion = Number(global.ClipHub.Filter.MODULE_VERSION);
            result.translationModuleVersion =
                Number(global.ClipHub.Translation.MODULE_VERSION);
            result.navigationModuleVersion =
                Number(global.ClipHub.Navigation.MODULE_VERSION);
            result.schemaVersion = Number(global.ClipHub.Database.getVersion());
            result.clipboardListenerStopped =
                global.ClipHub.Clipboard.stop().running === false;
            global.ClipHub.Settings.set("themeMode", "light", { cleanup: false });

            existingId = add(
                "https://developer.android.com/ Android Developers",
                "url", "com.android.chrome", "Chrome 浏览器",
                false, true, baseTime + 1000);
            result.existingId = existingId;
            countBefore = Number(global.ClipHub.Repository.countItems(false));
            result.countBefore = countBefore;
            result.homeShow = global.ClipHub.List.show({
                limit: 20, widthDp: 340, heightDp: 560
            });

            result.open = global.ClipHub.Editor.openNew({
                requestKeyboard: true
            });
            result.setShortText = global.ClipHub.Editor.setInputText(shortText);
            result.keyboardRetry = global.ClipHub.Editor.requestKeyboard();
            if (!waitFor(function () {
                    var current = global.ClipHub.Editor.getState();
                    return current.attachedToWindow === true &&
                        current.editorStyle === "reference_editor_v4" &&
                        current.inputFocused === true &&
                        current.keyboardRequestedOnOpen === true &&
                        current.softInputAdjustResize === true &&
                        current.keyboardVisible === true &&
                        current.keyboardInsetDp >= 120 &&
                        current.layoutMeasureCount > 0 &&
                        current.imeInsetsSupported === true &&
                        current.imeInsetSource !== "none" &&
                        current.keyboardAvoidanceApplied === true &&
                        current.keyboardAvoidanceApplyCount >= 1 &&
                        current.windowLayoutUpdateCount >= 1 &&
                        current.imePollCount >= 1 &&
                        current.currentPanelHeightDp > 0 &&
                        current.footerVisibleInRoot === true &&
                        current.footerAboveKeyboard === true &&
                        current.inputViewportAboveFooter === true;
                }, 5000)) {
                throw new Error("Keyboard scene did not become ready");
            }
            global.ClipHub.Editor.refreshLayoutMetrics();
            result.keyboardScene = global.ClipHub.Editor.getState();
            result.keyboardCompressionObserved =
                result.keyboardScene.keyboardVisible === true &&
                result.keyboardScene.keyboardInsetDp >= 120 &&
                result.keyboardScene.visibleFrameHeightDp > 0 &&
                result.keyboardScene.imeInsetsSupported === true &&
                result.keyboardScene.keyboardAvoidanceApplied === true &&
                result.keyboardScene.keyboardAvoidanceApplyCount >= 1 &&
                result.keyboardScene.windowLayoutUpdateCount >= 1 &&
                result.keyboardScene.footerAboveKeyboard === true &&
                result.keyboardScene.inputViewportHeightDp >= 72;
            showToast("042  1/3  输入法已弹出  ·  请截完整页面");
            Thread.sleep(SCENE_DURATION_MS);

            result.setLongText = global.ClipHub.Editor.setInputText(longText);
            result.scrollToEnd = global.ClipHub.Editor.scrollInputToEnd();
            result.longTextReady = waitFor(function () {
                global.ClipHub.Editor.refreshLayoutMetrics();
                var current = global.ClipHub.Editor.getState();
                return current.attached === true &&
                    current.keyboardVisible === true &&
                    current.contentLength === longText.length &&
                    current.cursorAtEnd === true &&
                    current.inputCanScrollUp === true &&
                    current.keyboardAvoidanceApplied === true &&
                    current.footerVisibleInRoot === true &&
                    current.footerAboveKeyboard === true &&
                    current.inputViewportAboveFooter === true;
            }, 3500);
            result.longTextScene = global.ClipHub.Editor.getState();
            showToast("042  2/3  长文本末尾  ·  请截完整页面");
            Thread.sleep(SCENE_DURATION_MS);

            result.firstBackBefore = global.ClipHub.Editor.getState();
            result.firstBackShell = runShell("input keyevent 4");
            result.firstBackHidKeyboard = waitFor(function () {
                global.ClipHub.Editor.refreshLayoutMetrics();
                var current = global.ClipHub.Editor.getState();
                return current.attached === true &&
                    current.keyboardVisible === false &&
                    current.keyboardAvoidanceApplied === false &&
                    current.panelGravity === "bottom" &&
                    current.inputFocused === false &&
                    current.focusReleasedAfterImeHide === true &&
                    current.focusReleaseCount >= 1 &&
                    current.rootFocusRequestedAfterImeHide === true &&
                    current.rootFocusedAfterImeHide === true &&
                    current.rootFocused === true;
            }, 4500);
            result.firstBackAfter = global.ClipHub.Editor.getState();
            result.firstBackKeptEditor = result.firstBackHidKeyboard === true &&
                result.firstBackAfter.attached === true;
            showToast("042  3/3  首次返回仅收起键盘  ·  请截完整页面");
            Thread.sleep(SCENE_DURATION_MS);

            result.secondBackShell = runShell("input keyevent 4");
            result.secondBackClosedEditor = waitFor(function () {
                return global.ClipHub.Editor.getState().attached === false &&
                    global.ClipHub.List.getState().visible === true;
            }, 4500);
            result.secondBackState = {
                editor: global.ClipHub.Editor.getState(),
                list: global.ClipHub.List.getState(),
                navigation: global.ClipHub.Navigation.getState()
            };
            result.secondBackNavigationHandled =
                result.secondBackState.navigation.backHandledCount >= 1 &&
                result.secondBackState.navigation.lastBackOwner === "editor" &&
                (result.secondBackState.navigation.lastBackReason === "back_key" ||
                    result.secondBackState.navigation.lastBackReason ===
                        "on_back_invoked" ||
                    result.secondBackState.navigation.lastBackReason ===
                        "predictive_back");
            countAfter = Number(global.ClipHub.Repository.countItems(false));
            result.countAfter = countAfter;
            result.unsavedContentPreserved = countAfter === countBefore;

            result.stop = global.ClipHub.App.stop("probe042_editor_keyboard");
            result.databaseClosed = !global.ClipHub.Database.isOpen();
            result.lockReleased = lockFree(isolated);
        } catch (error) {
            result.error = errorText(error);
            try { global.ClipHub.App.stop("probe042_error"); }
            catch (ignoredStop) {}
        } finally {
            try {
                if (formalWasRunning) {
                    result.formalRestart = lockFree(formal) ?
                        start(root, modules, formal) :
                        { ok: true, started: true, reused: true };
                } else {
                    result.formalRestart = {
                        ok: true, skipped: true,
                        reason: "formal_was_not_running"
                    };
                }
            } catch (restartError) {
                result.formalRestart = {
                    ok: false, error: errorText(restartError)
                };
                if (result.error === null) {
                    result.error = "Formal restart failed: " +
                        errorText(restartError);
                }
            }
            result.cleanup = removeTree(isolated);
            result.finishedAt = now();
            result.durationMs = result.finishedAt - result.startedAt;
            result.ok = result.error === null &&
                result.start && result.start.ok === true &&
                result.schemaVersion === 2 &&
                result.themeModuleVersion === 2 &&
                result.windowModuleVersion === 5 &&
                result.listModuleVersion === 11 &&
                result.editorModuleVersion === 8 &&
                result.filterModuleVersion === 9 &&
                result.translationModuleVersion === 4 &&
                result.navigationModuleVersion === 3 &&
                result.clipboardListenerStopped === true &&
                result.keyboardScene &&
                result.keyboardScene.editorStyle === "reference_editor_v4" &&
                result.keyboardScene.softInputAdjustResize === true &&
                result.keyboardScene.imeInsetsSupported === true &&
                result.keyboardScene.keyboardAvoidanceApplied === true &&
                result.keyboardScene.footerAboveKeyboard === true &&
                result.keyboardCompressionObserved === true &&
                result.longTextReady === true &&
                result.longTextScene &&
                result.longTextScene.cursorAtEnd === true &&
                result.longTextScene.inputCanScrollUp === true &&
                result.firstBackShell && result.firstBackShell.code === 0 &&
                result.firstBackHidKeyboard === true &&
                result.firstBackKeptEditor === true &&
                result.firstBackAfter.inputFocused === false &&
                result.firstBackAfter.focusReleasedAfterImeHide === true &&
                result.firstBackAfter.focusReleaseCount >= 1 &&
                result.firstBackAfter.rootFocusRequestedAfterImeHide === true &&
                result.firstBackAfter.rootFocusedAfterImeHide === true &&
                result.firstBackAfter.rootFocused === true &&
                result.secondBackShell && result.secondBackShell.code === 0 &&
                result.secondBackClosedEditor === true &&
                result.secondBackNavigationHandled === true &&
                result.secondBackState.editor.attached === false &&
                result.secondBackState.list.visible === true &&
                result.unsavedContentPreserved === true &&
                result.stop && result.stop.stopped === true &&
                result.databaseClosed === true &&
                result.lockReleased === true &&
                result.formalRestart && result.formalRestart.ok === true &&
                result.cleanup === true;
            write(outputFile, JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try {
        global.ClipHubEditorKeyboardProbe042Result = main();
    } catch (error) {
        global.ClipHubEditorKeyboardProbe042Result = {
            ok: false,
            probe: "cliphub_editor_keyboard_probe_042",
            probeVersion: 1,
            fatal: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubEditorKeyboardProbe042Result);
