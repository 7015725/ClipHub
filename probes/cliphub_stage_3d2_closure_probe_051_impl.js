/* ClipHub stage 3D2 closure probe 051. Rhino ES5 only. */
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

    var REQUIRED_SET = "20260723.09";
    var RUNTIME_NAME = "ClipHubProbe051";
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
        requestId = stamp(now()) + "-" + Number(Thread.currentThread().getId());
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

    function numberList(rows) {
        var output = [];
        var index;
        rows = rows || [];
        for (index = 0; index < rows.length; index += 1) {
            output.push(Number(rows[index].id === undefined ?
                rows[index] : rows[index].id));
        }
        return output;
    }

    function sameNumbers(left, right) {
        var index;
        left = left || [];
        right = right || [];
        if (left.length !== right.length) { return false; }
        for (index = 0; index < left.length; index += 1) {
            if (Number(left[index]) !== Number(right[index])) { return false; }
        }
        return true;
    }

    function containsNumber(values, target) {
        var index;
        values = values || [];
        for (index = 0; index < values.length; index += 1) {
            if (Number(values[index]) === Number(target)) { return true; }
        }
        return false;
    }

    function containsText(values, target) {
        var index;
        values = values || [];
        target = String(target);
        for (index = 0; index < values.length; index += 1) {
            if (String(values[index]) === target) { return true; }
        }
        return false;
    }

    function addItem(content, contentType, sourcePackage, sourceLabel,
            pinned, createdAt) {
        return Number(global.ClipHub.Repository.insertItem({
            content: String(content),
            contentType: String(contentType || "text"),
            sourcePackage: String(sourcePackage || "com.cliphub.probe051"),
            sourceLabel: String(sourceLabel || "探测来源"),
            sourceUid: 10000,
            sourceConfidence: 100,
            isSensitive: false,
            isPinned: pinned === true,
            createdAt: Number(createdAt),
            lastCopiedAt: Number(createdAt),
            updatedAt: Number(createdAt)
        }));
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
            "cliphub_stage_3d2_closure_probe_051_" +
                stamp(startedAt) + ".json");
        var manifest;
        var state;
        var item;
        var result = {
            ok: false,
            probe: "cliphub_stage_3d2_closure_probe_051",
            probeVersion: 1,
            startedAt: startedAt,
            moduleSetVersion: REQUIRED_SET,
            sourceRef: "agent/initialize-project-skeleton",
            runtimeName: RUNTIME_NAME,
            formalWasRunning: !lockFree(formal),
            formalRunningRequired: true,
            visualScreenshotRequired: false,
            instruction: "综合功能与生命周期回归，无需截图。",
            error: null,
            lastCheckpoint: "created",
            outputPath: String(outputFile.getAbsolutePath())
        };

        write(outputFile, JSON.stringify(result, null, 2) + "\n");
        try {
            if (!result.formalWasRunning) {
                throw new Error(
                    "Probe 051 requires the formal ClipHub instance to be running");
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

            removeTree(isolated);
            result.start = start(root, moduleDir, isolated);
            if (!result.start || result.start.ok !== true) {
                throw new Error("Isolated App.start failed");
            }
            result.schemaVersion = Number(global.ClipHub.Database.getVersion());
            result.editorModuleVersion = Number(global.ClipHub.Editor.MODULE_VERSION);
            result.settingsModuleVersion = Number(global.ClipHub.Settings.MODULE_VERSION);
            result.filterModuleVersion = Number(global.ClipHub.Filter.MODULE_VERSION);
            result.navigationModuleVersion =
                Number(global.ClipHub.Navigation.MODULE_VERSION);
            result.appModuleVersion = Number(global.ClipHub.App.MODULE_VERSION);
            if (result.schemaVersion !== 2 || result.editorModuleVersion !== 12 ||
                    result.settingsModuleVersion !== 11 ||
                    result.filterModuleVersion !== 14 ||
                    result.navigationModuleVersion !== 3 ||
                    result.appModuleVersion !== 8) {
                throw new Error("Unexpected module or schema version");
            }
            result.clipboardListenerStopped =
                global.ClipHub.Clipboard.stop().running === false;

            result.tagA = Number(global.ClipHub.Repository.insertTag({
                name: "文本", colorValue: Number(Color.parseColor("#7C5CFC")),
                manualOrder: 1000
            }));
            result.tagB = Number(global.ClipHub.Repository.insertTag({
                name: "要点", colorValue: Number(Color.parseColor("#4ECDC4")),
                manualOrder: 2000
            }));
            result.tagC = Number(global.ClipHub.Repository.insertTag({
                name: "重点", colorValue: Number(Color.parseColor("#FF6B6B")),
                manualOrder: 3000
            }));
            result.itemA = addItem(
                "Android ClipHub 3D2 综合回归", "text", "com.termux",
                "Termux", true, startedAt - 3000);
            result.itemB = addItem(
                "https://developer.android.com/cliphub", "url",
                "com.android.chrome", "Chrome 浏览器", false,
                startedAt - 2000);
            result.itemC = addItem(
                "普通剪贴板记录", "text", "com.cliphub.probe051",
                "探测来源", false, startedAt - 1000);
            global.ClipHub.Repository.setItemTags(result.itemA, [result.tagA]);
            global.ClipHub.Repository.setItemTags(result.itemB, [result.tagB]);

            result.show = global.ClipHub.App.executeControlCommand("show");
            result.rootReady = waitFor(function () {
                var app = global.ClipHub.App.getStatus();
                var panel = global.ClipHub.Filter.getPanelState();
                return app.filterAttached === true &&
                    app.filterRootMode === true &&
                    app.primarySurface === "filter_root" &&
                    app.legacyHomeAttached === false &&
                    panel.rootMode === true && panel.resultCardCount === 3;
            }, 1800);
            result.rootState = {
                app: global.ClipHub.App.getStatus(),
                filter: global.ClipHub.Filter.getState()
            };
            result.rootPassed = result.rootReady === true &&
                result.rootState.app.homeFilterExclusive === true &&
                result.rootState.app.legacyHomeAttached === false;
            checkpoint(result, outputFile, "root_ready");

            result.searchAction = global.ClipHub.Filter.performSearch("Android");
            result.searchReady = waitFor(function () {
                state = global.ClipHub.Filter.getState();
                return String(state.criteria.keyword || "") === "Android" &&
                    Number(state.lastResultCount) === 2 &&
                    Number(state.panel.resultCardCount) === 2;
            }, 1800);
            result.searchState = global.ClipHub.Filter.getState();
            result.searchPassed = result.searchAction === true &&
                result.searchReady === true;

            result.drawerOpenForBack =
                global.ClipHub.Filter.performAdvancedClick();
            result.drawerReadyForBack = waitFor(function () {
                return global.ClipHub.Filter.getPanelState()
                    .advancedDrawerVisible === true;
            }, 1200);
            result.drawerBack = global.ClipHub.Navigation
                .dispatchBackForOwner("filter", "probe051_drawer_back");
            result.drawerBackReady = waitFor(function () {
                return global.ClipHub.Filter.getPanelState()
                    .advancedDrawerVisible === false;
            }, 1200);
            Thread.sleep(280);

            result.drawerOpenForApply =
                global.ClipHub.Filter.performAdvancedClick();
            waitFor(function () {
                return global.ClipHub.Filter.getPanelState()
                    .advancedDrawerVisible === true;
            }, 1200);
            result.typeFilter = global.ClipHub.Filter.performTypeClick("url");
            result.tagFilter = global.ClipHub.Filter.performTagClick(result.tagB);
            result.applyFilter = global.ClipHub.Filter.performApplyClick();
            result.advancedReady = waitFor(function () {
                state = global.ClipHub.Filter.getState();
                return Number(state.lastResultCount) === 1 &&
                    Number(state.panel.resultCardCount) === 1 &&
                    containsText(state.criteria.contentTypes, "url") &&
                    containsNumber(state.criteria.tagIds, result.tagB);
            }, 1800);
            result.advancedState = global.ClipHub.Filter.getState();
            result.advancedPassed = result.drawerReadyForBack === true &&
                result.drawerBackReady === true &&
                result.advancedReady === true;

            result.resetFilter = global.ClipHub.Filter.performResetClick();
            waitFor(function () {
                return Number(global.ClipHub.Filter.getState()
                    .lastResultCount) === 3;
            }, 1500);
            checkpoint(result, outputFile, "filter_regression_passed");

            result.editorOpen = global.ClipHub.Editor.openItem(result.itemA, {
                requestKeyboard: false
            });
            waitFor(function () {
                state = global.ClipHub.Editor.getState();
                return state.attached === true && state.mode === "edit";
            }, 1400);
            Thread.sleep(560);
            result.editorIdleState = global.ClipHub.Editor.getState();
            result.editorIdlePollPassed =
                Number(result.editorIdleState.imePollIdleCount) >= 1 &&
                Number(result.editorIdleState.imePollIntervalMs) === 420;

            result.editorKeyboardRequest = global.ClipHub.Editor.requestKeyboard();
            result.editorFastReady = waitFor(function () {
                state = global.ClipHub.Editor.getState();
                return state.keyboardVisible === true &&
                    state.keyboardAvoidanceApplied === true &&
                    Number(state.imePollFastCount) >= 1;
            }, 4000);
            result.editorFastState = global.ClipHub.Editor.getState();
            result.editorFastPollPassed = result.editorFastReady === true &&
                Number(result.editorFastState.imePollIntervalMs) === 90 &&
                Number(result.editorFastState.delayedCallbackErrorCount) === 0;

            result.editorHideKeyboard = global.ClipHub.Editor.hideKeyboard();
            result.editorRestoreReady = waitFor(function () {
                state = global.ClipHub.Editor.getState();
                return state.keyboardVisible === false &&
                    state.keyboardAvoidanceApplied === false &&
                    state.panelGravity === "bottom";
            }, 3500);
            result.editorRestoreState = global.ClipHub.Editor.getState();

            result.editorTextSet = global.ClipHub.Editor.setInputText(
                "Android ClipHub 3D2 综合回归 已编辑");
            result.selectorOpenCancel =
                global.ClipHub.Editor.performOpenTagSelectorClick();
            waitFor(function () {
                return global.ClipHub.Editor.getState().mode === "tags";
            }, 1200);
            result.selectorToggleCancel =
                global.ClipHub.Editor.performTagToggleClick(result.tagB);
            result.tagsBeforeBack = numberList(
                global.ClipHub.Repository.listItemTags(result.itemA));
            result.selectorBack = global.ClipHub.Navigation
                .dispatchBackForOwner("editor", "probe051_selector_back");
            result.selectorBackReady = waitFor(function () {
                return global.ClipHub.Editor.getState().mode === "edit";
            }, 1200);
            result.tagsAfterBack = numberList(
                global.ClipHub.Repository.listItemTags(result.itemA));

            result.selectorOpenSave =
                global.ClipHub.Editor.performOpenTagSelectorClick();
            waitFor(function () {
                return global.ClipHub.Editor.getState().mode === "tags";
            }, 1200);
            result.selectorToggleSave =
                global.ClipHub.Editor.performTagToggleClick(result.tagB);
            result.selectorSave =
                global.ClipHub.Editor.performTagSelectionSaveClick();
            waitFor(function () {
                return global.ClipHub.Editor.getState().mode === "edit";
            }, 1200);
            result.editorSave = global.ClipHub.Editor.performSaveClick();
            waitFor(function () {
                return global.ClipHub.Editor.getState().attached === false;
            }, 1500);
            Thread.sleep(560);
            result.editorClosedState = global.ClipHub.Editor.getState();
            item = global.ClipHub.Repository.getItem(result.itemA, false);
            result.savedContent = item === null ? null : String(item.content);
            result.savedTags = numberList(
                global.ClipHub.Repository.listItemTags(result.itemA));
            result.editorTransactionPassed =
                sameNumbers(result.tagsBeforeBack, [result.tagA]) &&
                sameNumbers(result.tagsAfterBack, [result.tagA]) &&
                sameNumbers(result.savedTags, [result.tagA, result.tagB]) &&
                result.savedContent ===
                    "Android ClipHub 3D2 综合回归 已编辑";
            result.editorClosePassed =
                result.editorRestoreReady === true &&
                Number(result.editorClosedState.pendingDelayedCallbackCount) === 0 &&
                Number(result.editorClosedState.delayedCallbackErrorCount) === 0 &&
                result.editorClosedState.lastDelayedCallbackError === null;
            checkpoint(result, outputFile, "editor_regression_passed");

            result.settingsOpen =
                global.ClipHub.Filter.performSettingsClick();
            waitFor(function () {
                return global.ClipHub.Settings.getState().attached === true;
            }, 1600);
            Thread.sleep(560);
            result.settingsIdleState = global.ClipHub.Settings.getState();
            result.settingsIdlePollPassed =
                Number(result.settingsIdleState.imePollIdleCount) >= 1 &&
                Number(result.settingsIdleState.imePollIntervalMs) === 420;

            result.settingsFocus = global.ClipHub.Settings.performFocusInput(
                "translation.baidu.app_id");
            result.settingsFastReady = waitFor(function () {
                state = global.ClipHub.Settings.getState();
                return state.keyboardVisible === true &&
                    state.keyboardAvoidanceApplied === true &&
                    state.panelAboveKeyboard === true &&
                    state.focusedInputVisible === true &&
                    Number(state.imePollFastCount) >= 1;
            }, 4000);
            result.settingsFastState = global.ClipHub.Settings.getState();
            result.settingsFastPollPassed = result.settingsFastReady === true &&
                Number(result.settingsFastState.imePollIntervalMs) === 90 &&
                Number(result.settingsFastState.delayedCallbackErrorCount) === 0;

            result.settingsHideKeyboard = global.ClipHub.Settings.hideKeyboard();
            result.settingsRestoreReady = waitFor(function () {
                state = global.ClipHub.Settings.getState();
                return state.keyboardVisible === false &&
                    state.keyboardAvoidanceApplied === false &&
                    state.panelGravity === "bottom" &&
                    Number(state.imeAnchorSpacerHeightDp) === 0;
            }, 3500);
            result.settingsRestoreState = global.ClipHub.Settings.getState();
            result.settingsBack = global.ClipHub.Navigation
                .dispatchBackForOwner("detail", "probe051_settings_back");
            result.settingsBackReady = waitFor(function () {
                return global.ClipHub.Settings.getState().attached === false &&
                    global.ClipHub.Filter.getPanelState().attached === true;
            }, 1400);
            Thread.sleep(560);
            result.settingsClosedState = global.ClipHub.Settings.getState();
            result.settingsClosePassed =
                result.settingsRestoreReady === true &&
                result.settingsBackReady === true &&
                Number(result.settingsClosedState.pendingDelayedCallbackCount) === 0 &&
                Number(result.settingsClosedState.delayedCallbackErrorCount) === 0 &&
                result.settingsClosedState.lastDelayedCallbackError === null;
            checkpoint(result, outputFile, "settings_regression_passed");

            Thread.sleep(280);
            result.rootBack = global.ClipHub.Navigation
                .dispatchBackForOwner("filter", "probe051_root_back");
            result.rootBackReady = waitFor(function () {
                return global.ClipHub.App.getStatus().uiVisible === false;
            }, 1400);
            result.reopen = global.ClipHub.App.executeControlCommand("show");
            result.reopenReady = waitFor(function () {
                var app = global.ClipHub.App.getStatus();
                return app.filterAttached === true &&
                    app.filterRootMode === true &&
                    app.primarySurface === "filter_root" &&
                    app.legacyHomeAttached === false;
            }, 1400);
            result.rootReturnPassed = result.rootBackReady === true &&
                result.reopenReady === true;

            result.hide = global.ClipHub.App.executeControlCommand("hide");
            result.stop = global.ClipHub.App.stop(
                "probe051_stage_3d2_closure");
            Thread.sleep(550);
            result.databaseClosed = !global.ClipHub.Database.isOpen();
            result.lockReleased = lockFree(isolated);
            checkpoint(result, outputFile, "after_isolated_stop");
        } catch (error) {
            result.error = errorText(error);
            try { global.ClipHub.App.stop("probe051_error"); }
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
                result.schemaVersion === 2 &&
                result.editorModuleVersion === 12 &&
                result.settingsModuleVersion === 11 &&
                result.filterModuleVersion === 14 &&
                result.navigationModuleVersion === 3 &&
                result.rootPassed === true &&
                result.searchPassed === true &&
                result.advancedPassed === true &&
                result.editorIdlePollPassed === true &&
                result.editorFastPollPassed === true &&
                result.editorTransactionPassed === true &&
                result.editorClosePassed === true &&
                result.settingsIdlePollPassed === true &&
                result.settingsFastPollPassed === true &&
                result.settingsClosePassed === true &&
                result.rootReturnPassed === true &&
                result.databaseClosed === true &&
                result.lockReleased === true &&
                result.formalRestored === true &&
                result.cleanup === true;
            write(outputFile, JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try {
        global.ClipHubStage3D2ClosureProbe051Result = main();
    } catch (error) {
        global.ClipHubStage3D2ClosureProbe051Result = {
            ok: false,
            probe: "cliphub_stage_3d2_closure_probe_051",
            probeVersion: 1,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubStage3D2ClosureProbe051Result);
