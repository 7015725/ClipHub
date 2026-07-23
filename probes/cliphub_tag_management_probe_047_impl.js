/* ClipHub stage 3D2-5 tag management probe 047. Rhino ES5 only. */
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

    var REQUIRED_SET = "20260723.04";
    var RUNTIME_NAME = "ClipHubProbe047";
    var SCENE_DURATION_MS = 10000;
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
            try { ack = JSON.parse(read(ackFile)); }
            catch (ignoredAck) {}
            ackFile.delete();
        }
        return {
            ok: ack !== null && ack.ok === true &&
                ack.stopped === true && lockFree(runtimeDir) &&
                !endpointFile.exists(),
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

    function tagIds(tags) {
        var output = [];
        var index;
        tags = tags || [];
        for (index = 0; index < tags.length; index += 1) {
            output.push(Number(tags[index].id));
        }
        return output;
    }

    function sameIds(actual, expected) {
        var index;
        if (!actual || !expected || actual.length !== expected.length) {
            return false;
        }
        for (index = 0; index < actual.length; index += 1) {
            if (Number(actual[index]) !== Number(expected[index])) {
                return false;
            }
        }
        return true;
    }

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var formal = new File(root, "ClipHub");
        var modules = new File(formal, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var outputFile = new File(ensureDir(new File(formal, "probes")),
            "cliphub_tag_management_probe_047_" +
                stamp(startedAt) + ".json");
        var local = localManifest(formal);
        var formalWasRunning = !lockFree(formal);
        var result = {
            ok: false,
            probe: "cliphub_tag_management_probe_047",
            probeVersion: 1,
            startedAt: startedAt,
            moduleSetVersion: local.moduleSetVersion || null,
            sourceRef: local.sourceRef || null,
            sceneDurationMs: SCENE_DURATION_MS,
            sceneCount: 3,
            visualScreenshotRequired: true,
            instruction: "场景1截标签管理页；场景2截记录多标签选择器；场景3截保存标签后的唯一首页。三张截图均不得裁剪。",
            transactionalTagSelectionRequired: true,
            structuredTagStoragePreserved: true,
            schemaVersionPreserved: true,
            navigationImplementationChanged: false,
            outputPath: String(outputFile.getAbsolutePath()),
            formalWasRunning: formalWasRunning,
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
            result.schemaVersion = Number(global.ClipHub.Database.getVersion());
            result.repositoryModuleVersion =
                Number(global.ClipHub.Repository.MODULE_VERSION);
            result.editorModuleVersion =
                Number(global.ClipHub.Editor.MODULE_VERSION);
            result.filterModuleVersion =
                Number(global.ClipHub.Filter.MODULE_VERSION);
            result.settingsModuleVersion =
                Number(global.ClipHub.Settings.MODULE_VERSION);
            result.navigationModuleVersion =
                Number(global.ClipHub.Navigation.MODULE_VERSION);
            result.appModuleVersion =
                Number(global.ClipHub.App.MODULE_VERSION);
            result.clipboardListenerStopped =
                global.ClipHub.Clipboard.stop().running === false;

            result.tagA = Number(global.ClipHub.Repository.insertTag({
                name: "工作", colorValue: -8658177, manualOrder: 1000
            }));
            result.tagB = Number(global.ClipHub.Repository.insertTag({
                name: "重要", colorValue: -65536, manualOrder: 2000
            }));
            result.tagC = Number(global.ClipHub.Repository.insertTag({
                name: "待处理", colorValue: -14336, manualOrder: 3000
            }));
            result.tagD = Number(global.ClipHub.Repository.insertTag({
                name: "临时", colorValue: -16711936, manualOrder: 4000
            }));
            result.itemId = Number(global.ClipHub.Repository.insertItem({
                content: "ClipHub 阶段 3D2-5 多标签事务测试",
                contentType: "text", sourcePackage: "com.termux",
                sourceLabel: "Termux", sourceUid: 10002,
                sourceConfidence: 100, isPinned: true
            }));
            result.deleteGuardItemId = Number(
                global.ClipHub.Repository.insertItem({
                    content: "删除标签不得删除本记录",
                    contentType: "text", sourcePackage: "com.termux",
                    sourceLabel: "Termux", sourceUid: 10002,
                    sourceConfidence: 100, isPinned: false
                }));
            global.ClipHub.Repository.setItemTags(result.itemId,
                [result.tagA]);
            global.ClipHub.Repository.setItemTags(result.deleteGuardItemId,
                [result.tagD]);

            result.show = global.ClipHub.App.executeControlCommand("show");
            result.rootReady = waitFor(function () {
                var app = global.ClipHub.App.getStatus();
                return app.primarySurface === "filter_root" &&
                    app.legacyHomeAttached === false &&
                    global.ClipHub.Filter.getPanelState().attached === true;
            }, 1600);
            result.settingsOpen =
                global.ClipHub.Filter.performSettingsClick();
            result.settingsReady = waitFor(function () {
                var state = global.ClipHub.Settings.getState();
                return state.attached === true &&
                    state.settingsStyle === "reference_settings_v2" &&
                    state.dragReorderEnabled === true &&
                    state.deleteRequiresConfirmation === true &&
                    state.tagRowCount === 4;
            }, 1600);
            global.ClipHub.Settings.scrollToSection("tags");
            result.updateTag = global.ClipHub.Settings.performUpdateTag(
                result.tagA, "工作项目", "#3366FF");
            result.moveTagFirst = global.ClipHub.Settings.performMoveTag(
                result.tagC, -1);
            result.moveTagSecond = global.ClipHub.Settings.performMoveTag(
                result.tagC, -1);
            result.deleteTag = global.ClipHub.Settings
                .performDeleteTagConfirm(result.tagD);
            result.settingsMutationReady = waitFor(function () {
                var state = global.ClipHub.Settings.getState();
                var order = global.ClipHub.Settings.getTagOrder();
                return state.attached === true && state.tagRowCount === 3 &&
                    state.tagUpdateCount >= 1 &&
                    state.tagReorderCount >= 2 &&
                    state.tagDeleteCount >= 1 &&
                    state.tagDeleteConfirmCount >= 1 &&
                    sameIds(order, [result.tagC, result.tagA, result.tagB]);
            }, 1800);
            result.settingsScene = {
                state: global.ClipHub.Settings.getState(),
                tags: global.ClipHub.Repository.listTags(),
                order: global.ClipHub.Settings.getTagOrder(),
                itemStillPresent: global.ClipHub.Repository.getItem(
                    result.deleteGuardItemId, false) !== null,
                deletedTagAssociations: tagIds(
                    global.ClipHub.Repository.listItemTags(
                        result.deleteGuardItemId))
            };
            showToast("047  1/3  标签管理  ·  颜色、排序与删除确认");
            Thread.sleep(SCENE_DURATION_MS);

            result.settingsBack = global.ClipHub.Navigation
                .dispatchBackForOwner("detail", "probe047_settings_back");
            result.settingsBackReady = waitFor(function () {
                return global.ClipHub.Settings.getState().attached === false &&
                    global.ClipHub.Filter.getPanelState().attached === true;
            }, 1200);

            result.editorOpen = global.ClipHub.Editor.openItem(result.itemId, {
                requestKeyboard: false
            });
            result.editorReady = waitFor(function () {
                var state = global.ClipHub.Editor.getState();
                return state.attached === true && state.mode === "edit";
            }, 1400);
            result.selectorOpenForCancel =
                global.ClipHub.Editor.performOpenTagSelectorClick();
            result.selectorCancelReady = waitFor(function () {
                var state = global.ClipHub.Editor.getState();
                return state.attached === true && state.mode === "tags" &&
                    state.tagSelectorStyle === "reference_tag_selector_v1";
            }, 1200);
            global.ClipHub.Editor.performTagToggleClick(result.tagB);
            global.ClipHub.Editor.performTagToggleClick(result.tagC);
            result.cancelDraftIds = global.ClipHub.Editor.getDraftTagIds();
            result.dbBeforeCancel = tagIds(
                global.ClipHub.Repository.listItemTags(result.itemId));
            result.selectorBack = global.ClipHub.Navigation
                .dispatchBackForOwner("editor", "probe047_selector_back");
            result.selectorBackReady = waitFor(function () {
                var state = global.ClipHub.Editor.getState();
                return state.attached === true && state.mode === "edit";
            }, 1200);
            result.dbAfterCancel = tagIds(
                global.ClipHub.Repository.listItemTags(result.itemId));

            result.selectorOpenForSave =
                global.ClipHub.Editor.performOpenTagSelectorClick();
            waitFor(function () {
                return global.ClipHub.Editor.getState().mode === "tags";
            }, 1000);
            global.ClipHub.Editor.performTagToggleClick(result.tagB);
            global.ClipHub.Editor.performTagToggleClick(result.tagC);
            result.selectorReady = waitFor(function () {
                var state = global.ClipHub.Editor.getState();
                return state.mode === "tags" &&
                    state.tagDraftCount === 3 &&
                    state.tagColorPreviewCount >= 3 &&
                    state.tagFooterActionCount === 2;
            }, 1200);
            result.selectorScene = {
                editor: global.ClipHub.Editor.getState(),
                draftTagIds: global.ClipHub.Editor.getDraftTagIds(),
                persistedTagIds: tagIds(
                    global.ClipHub.Repository.listItemTags(result.itemId)),
                tags: global.ClipHub.Repository.listTags()
            };
            showToast("047  2/3  多标签选择  ·  当前选择尚未写入数据库");
            Thread.sleep(SCENE_DURATION_MS);

            result.selectorComplete = global.ClipHub.Editor
                .performTagSelectionSaveClick();
            result.selectorCompleteReady = waitFor(function () {
                var state = global.ClipHub.Editor.getState();
                return state.attached === true && state.mode === "edit" &&
                    state.tagDraftCount === 3;
            }, 1200);
            result.dbBeforeMainSave = tagIds(
                global.ClipHub.Repository.listItemTags(result.itemId));
            result.editorSave = global.ClipHub.Editor.performSaveClick();
            result.editorSaveReady = waitFor(function () {
                return global.ClipHub.Editor.getState().attached === false &&
                    global.ClipHub.Filter.getPanelState().attached === true;
            }, 1600);
            result.dbAfterMainSave = tagIds(
                global.ClipHub.Repository.listItemTags(result.itemId));
            result.filterTagReady = waitFor(function () {
                var panel = global.ClipHub.Filter.getPanelState();
                return panel.attached === true &&
                    panel.renderedTagLabelCount >= 2 &&
                    panel.tagColorPreviewCount >= 1 &&
                    panel.selectionMode === false;
            }, 1600);
            result.filterScene = {
                app: global.ClipHub.App.getStatus(),
                filter: global.ClipHub.Filter.getState(),
                itemTags: global.ClipHub.Repository.listItemTags(result.itemId)
            };
            showToast("047  3/3  标签首页  ·  两个标签与 +1 已保存");
            Thread.sleep(SCENE_DURATION_MS);

            result.newEditorOpen = global.ClipHub.Editor.openNew({
                text: "ClipHub 新记录标签保存测试",
                requestKeyboard: false
            });
            waitFor(function () {
                return global.ClipHub.Editor.getState().mode === "new";
            }, 1000);
            global.ClipHub.Editor.performOpenTagSelectorClick();
            waitFor(function () {
                return global.ClipHub.Editor.getState().mode === "tags";
            }, 1000);
            global.ClipHub.Editor.performTagToggleClick(result.tagC);
            global.ClipHub.Editor.performTagToggleClick(result.tagA);
            global.ClipHub.Editor.performTagSelectionSaveClick();
            result.newEditorSave = global.ClipHub.Editor.performSaveClick();
            result.newItemId = Number(
                global.ClipHub.Editor.getState().lastSavedId || 0);
            result.newItemTags = result.newItemId > 0 ? tagIds(
                global.ClipHub.Repository.listItemTags(result.newItemId)) : [];

            result.hide = global.ClipHub.App.executeControlCommand("hide");
            result.stop = global.ClipHub.App.stop(
                "probe047_tag_management");
            result.databaseClosed = !global.ClipHub.Database.isOpen();
            result.lockReleased = lockFree(isolated);
        } catch (error) {
            result.error = errorText(error);
            try { global.ClipHub.App.stop("probe047_error"); }
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
                result.repositoryModuleVersion === 8 &&
                result.editorModuleVersion === 10 &&
                result.filterModuleVersion === 14 &&
                result.settingsModuleVersion === 7 &&
                result.navigationModuleVersion === 3 &&
                result.appModuleVersion === 8 &&
                result.clipboardListenerStopped === true &&
                result.rootReady === true &&
                result.settingsOpen === true &&
                result.settingsReady === true &&
                result.updateTag === true &&
                result.moveTagFirst === true &&
                result.moveTagSecond === true &&
                result.deleteTag === true &&
                result.settingsMutationReady === true &&
                sameIds(result.settingsScene.order,
                    [result.tagC, result.tagA, result.tagB]) &&
                result.settingsScene.itemStillPresent === true &&
                result.settingsScene.deletedTagAssociations.length === 0 &&
                result.settingsBack === true &&
                result.settingsBackReady === true &&
                result.editorReady === true &&
                result.selectorOpenForCancel === true &&
                result.selectorCancelReady === true &&
                sameIds(result.cancelDraftIds,
                    [result.tagA, result.tagB, result.tagC]) &&
                sameIds(result.dbBeforeCancel, [result.tagA]) &&
                result.selectorBack === true &&
                result.selectorBackReady === true &&
                sameIds(result.dbAfterCancel, [result.tagA]) &&
                result.selectorOpenForSave === true &&
                result.selectorReady === true &&
                result.selectorScene.editor.tagSelectionDirty === true &&
                sameIds(result.selectorScene.persistedTagIds, [result.tagA]) &&
                result.selectorComplete === true &&
                result.selectorCompleteReady === true &&
                sameIds(result.dbBeforeMainSave, [result.tagA]) &&
                result.editorSave === true &&
                result.editorSaveReady === true &&
                sameIds(result.dbAfterMainSave,
                    [result.tagC, result.tagA, result.tagB]) &&
                result.filterTagReady === true &&
                result.filterScene.app.legacyHomeAttached === false &&
                result.filterScene.filter.panel.tagColorPreviewCount >= 1 &&
                result.newEditorSave === true &&
                result.newItemId > 0 &&
                sameIds(result.newItemTags, [result.tagC, result.tagA]) &&
                result.hide && result.hide.ok === true &&
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
        global.ClipHubTagManagementProbe047Result = main();
    } catch (error) {
        global.ClipHubTagManagementProbe047Result = {
            ok: false,
            probe: "cliphub_tag_management_probe_047",
            probeVersion: 1,
            fatal: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubTagManagementProbe047Result);
