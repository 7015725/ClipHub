/* ClipHub new and edit visual probe 039. Rhino ES5 only. */
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

    var REQUIRED_SET = "20260722.32";
    var RUNTIME_NAME = "ClipHubProbe039";
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
            sourcePackage: String(sourcePackage || "com.cliphub.probe039"),
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

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var formal = new File(root, "ClipHub");
        var modules = new File(formal, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var outputFile = new File(ensureDir(new File(formal, "probes")),
            "cliphub_editor_ui_probe_039_" + stamp(startedAt) + ".json");
        var local = localManifest(formal);
        var formalWasRunning = !lockFree(formal);
        var baseTime = startedAt - 20000;
        var existingId = null;
        var existingBefore = null;
        var existingAfter = null;
        var createdState = null;
        var createdRow = null;
        var cancelBefore = null;
        var cancelAfter = null;
        var newText = "ClipHub 手动新增测试内容\nRhino ES5 editor probe 039";
        var editText = "https://developer.android.com/updated Android Developers";
        var result = {
            ok: false,
            probe: "cliphub_editor_ui_probe_039",
            probeVersion: 1,
            moduleSetVersion: local.moduleSetVersion || null,
            sourceRef: local.sourceRef || null,
            sceneDurationMs: SCENE_DURATION_MS,
            sceneCount: 2,
            visualScreenshotRequired: true,
            instruction: "场景1截完整新增页；场景2截完整编辑页。两张截图均不得裁剪，键盘保持隐藏。",
            outputPath: String(outputFile.getAbsolutePath()),
            formalWasRunning: formalWasRunning,
            startedAt: startedAt,
            repositorySaveSemanticsChanged: false,
            tagManagerChanged: false,
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
            result.seededCount = Number(
                global.ClipHub.Repository.countItems(false));
            result.homeShow = global.ClipHub.List.show({
                limit: 20, widthDp: 340, heightDp: 560
            });

            result.newOpen = global.ClipHub.Editor.openNew({
                requestKeyboard: false
            });
            result.newSetText = global.ClipHub.Editor.setInputText(newText);
            result.newReady = waitFor(function () {
                var current = global.ClipHub.Editor.getState();
                return current.attachedToWindow === true &&
                    current.mode === "new" &&
                    current.editorStyle === "reference_editor_v1" &&
                    current.dragHandlePresent === true &&
                    current.headerIconPresent === true &&
                    current.headerCloseViewPresent === true &&
                    current.contentLabelPresent === true &&
                    current.characterCountPresent === true &&
                    current.metadataRowPresent === true &&
                    current.cancelButtonPresent === true &&
                    current.saveButtonPresent === true &&
                    current.footerActionCount === 2 &&
                    current.sourceMetaText === "ClipHub 手动" &&
                    current.typeMetaText === "文本" &&
                    current.contentLength === newText.length &&
                    current.requestKeyboardOnOpen === false &&
                    current.keyboardRequestedOnOpen === false &&
                    current.panelGravity === "bottom" &&
                    current.dimAmount > 0.43 && current.dimAmount < 0.45;
            }, 1800);
            result.newScene = global.ClipHub.Editor.getState();
            result.newNavigation = global.ClipHub.Navigation.getState();
            showToast("039  1/2  新增剪贴板  ·  请截完整页面");
            Thread.sleep(SCENE_DURATION_MS);

            result.newSaveClick = global.ClipHub.Editor.performSaveClick();
            createdState = global.ClipHub.Editor.getState();
            result.createdState = createdState;
            result.createdId = Number(createdState.lastSavedId || 0);
            createdRow = result.createdId > 0 ?
                global.ClipHub.Repository.getItem(result.createdId, false) : null;
            result.createdRow = createdRow;
            result.newSaveSemanticsPreserved = createdRow !== null &&
                String(createdRow.content) === newText &&
                String(createdRow.content_type) === "text" &&
                String(createdRow.source_label) === "ClipHub 手动" &&
                Number(createdRow.is_sensitive || 0) === 0 &&
                Number(createdRow.is_pinned || 0) === 0;

            existingBefore = global.ClipHub.Repository.getItem(existingId, false);
            result.existingBefore = existingBefore;
            result.editOpen = global.ClipHub.Editor.openItem(existingId, {
                requestKeyboard: false
            });
            result.editSetText = global.ClipHub.Editor.setInputText(editText);
            result.editReady = waitFor(function () {
                var current = global.ClipHub.Editor.getState();
                return current.attachedToWindow === true &&
                    current.mode === "edit" &&
                    current.editorStyle === "reference_editor_v1" &&
                    current.sourceMetaText === "Chrome 浏览器" &&
                    current.typeMetaText === "链接" &&
                    current.contentLength === editText.length &&
                    current.requestKeyboardOnOpen === false &&
                    current.keyboardRequestedOnOpen === false &&
                    current.panelGravity === "bottom" &&
                    current.footerActionCount === 2;
            }, 1800);
            result.editScene = global.ClipHub.Editor.getState();
            result.editNavigation = global.ClipHub.Navigation.getState();
            showToast("039  2/2  编辑剪贴板  ·  请截完整页面");
            Thread.sleep(SCENE_DURATION_MS);

            result.editSaveClick = global.ClipHub.Editor.performSaveClick();
            existingAfter = global.ClipHub.Repository.getItem(existingId, false);
            result.existingAfter = existingAfter;
            result.editSaveSemanticsPreserved = existingAfter !== null &&
                String(existingAfter.content) === editText &&
                sameValue(existingAfter.content_type, existingBefore.content_type) &&
                sameValue(existingAfter.source_package, existingBefore.source_package) &&
                sameValue(existingAfter.source_label, existingBefore.source_label) &&
                Number(existingAfter.is_sensitive || 0) ===
                    Number(existingBefore.is_sensitive || 0) &&
                Number(existingAfter.is_pinned || 0) ===
                    Number(existingBefore.is_pinned || 0);

            cancelBefore = String(existingAfter.content);
            result.cancelOpen = global.ClipHub.Editor.openItem(existingId, {
                requestKeyboard: false
            });
            result.cancelSetText = global.ClipHub.Editor.setInputText(
                "取消后不应保存的内容");
            result.cancelClick = global.ClipHub.Editor.performCancelClick();
            cancelAfter = String(global.ClipHub.Repository
                .getItem(existingId, false).content);
            result.cancelBefore = cancelBefore;
            result.cancelAfter = cancelAfter;
            result.cancelPreserved = cancelAfter === cancelBefore;

            result.backOpen = global.ClipHub.Editor.openNew({
                requestKeyboard: false
            });
            result.backRegistered = waitFor(function () {
                return containsText(global.ClipHub.Navigation.getState()
                    .registeredOwners, "editor");
            }, 1500);
            result.navigationBack = global.ClipHub.Navigation
                .dispatchBackForOwner("editor", "probe_editor_back_039");
            result.navigationBackReady = waitFor(function () {
                return global.ClipHub.Editor.getState().attached === false;
            }, 1200);
            result.navigationBackState = {
                editor: global.ClipHub.Editor.getState(),
                list: global.ClipHub.List.getState(),
                navigation: global.ClipHub.Navigation.getState()
            };

            result.stop = global.ClipHub.App.stop("probe039_editor_ui");
            result.databaseClosed = !global.ClipHub.Database.isOpen();
            result.lockReleased = lockFree(isolated);
        } catch (error) {
            result.error = errorText(error);
            try { global.ClipHub.App.stop("probe039_error"); }
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
                result.editorModuleVersion === 5 &&
                result.filterModuleVersion === 9 &&
                result.translationModuleVersion === 4 &&
                result.navigationModuleVersion === 3 &&
                result.clipboardListenerStopped === true &&
                result.seededCount === 1 &&
                result.newReady === true &&
                result.newScene &&
                result.newScene.panelWidthDp >= 370 &&
                result.newScene.panelWidthDp <= 400 &&
                result.newScene.panelHeightDp >= 560 &&
                result.newScene.panelHeightDp <= 610 &&
                result.newScene.editorFooterHeightDp === 50 &&
                result.newScene.contentMinLines === 10 &&
                result.newSaveClick === true &&
                result.newSaveSemanticsPreserved === true &&
                result.editReady === true &&
                result.editScene &&
                result.editScene.panelWidthDp >= 370 &&
                result.editScene.panelWidthDp <= 400 &&
                result.editScene.panelHeightDp >= 560 &&
                result.editScene.panelHeightDp <= 610 &&
                result.editSaveClick === true &&
                result.editSaveSemanticsPreserved === true &&
                result.cancelClick === true &&
                result.cancelPreserved === true &&
                result.backRegistered === true &&
                result.navigationBack === true &&
                result.navigationBackReady === true &&
                result.navigationBackState.editor.attached === false &&
                result.navigationBackState.list.visible === true &&
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
        global.ClipHubEditorUiProbe039Result = main();
    } catch (error) {
        global.ClipHubEditorUiProbe039Result = {
            ok: false,
            probe: "cliphub_editor_ui_probe_039",
            probeVersion: 1,
            fatal: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubEditorUiProbe039Result);
