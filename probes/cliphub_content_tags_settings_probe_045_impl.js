/* ClipHub content/tag/settings probe 045. Rhino ES5 only. */
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

    var REQUIRED_SET = "20260723.02";
    var RUNTIME_NAME = "ClipHubProbe045";
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
            if (lock !== null) { try { lock.release(); } catch (ignored) {} }
            close(channel); close(raf);
        }
    }
    function localManifest(runtimeDir) {
        var file = new File(new File(runtimeDir, "cache"),
            "module-manifest.local.json");
        var data;
        if (!file.isFile()) { return { present: false }; }
        data = JSON.parse(read(file));
        return { present: true,
            moduleSetVersion: String(data.moduleSetVersion || ""),
            sourceRef: String(data.sourceRef || "") };
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
        ackFile = new File(cacheDir, "control_ack_" + requestId + ".json");
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
        return { ok: ack !== null && ack.ok === true &&
                ack.stopped === true && lockFree(runtimeDir) &&
                !endpointFile.exists(), ack: ack,
            lockReleased: lockFree(runtimeDir),
            endpointRemoved: !endpointFile.exists(),
            error: ack === null ? "Control acknowledgement not received" : null };
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
        try { Toast.makeText(global.context, String(text),
            Toast.LENGTH_LONG).show(); } catch (ignored) {}
    }

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var formal = new File(root, "ClipHub");
        var modules = new File(formal, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var outputFile = new File(ensureDir(new File(formal, "probes")),
            "cliphub_content_tags_settings_probe_045_" +
                stamp(startedAt) + ".json");
        var local = localManifest(formal);
        var formalWasRunning = !lockFree(formal);
        var extraIndex;
        var result = {
            ok: false,
            probe: "cliphub_content_tags_settings_probe_045",
            probeVersion: 3,
            startedAt: startedAt,
            moduleSetVersion: local.moduleSetVersion || null,
            sourceRef: local.sourceRef || null,
            sceneDurationMs: SCENE_DURATION_MS,
            sceneCount: 3,
            visualScreenshotRequired: true,
            instruction: "场景1截默认唯一首页；场景2截已预选有道的翻译设置；场景3截标签管理。三张截图均不得裁剪。",
            scene1CapturedBeforePagingAndTranslation: true,
            translationTerminalStateRequired: true,
            settingsConfiguredBeforeOpen: true,
            outputPath: String(outputFile.getAbsolutePath()),
            formalWasRunning: formalWasRunning,
            schemaVersionPreserved: true,
            navigationImplementationChanged: false,
            error: null
        };
        try {
            if (!local.present || local.moduleSetVersion !== REQUIRED_SET) {
                throw new Error("Installed module set must be " + REQUIRED_SET);
            }
            result.formalControl = stopFormal(global.context, formal);
            if (!result.formalControl.ok) {
                throw new Error(result.formalControl.error || "Formal stop failed");
            }
            removeTree(isolated);
            result.start = start(root, modules, isolated);
            result.schemaVersion = Number(global.ClipHub.Database.getVersion());
            result.clipboardModuleVersion =
                Number(global.ClipHub.Clipboard.MODULE_VERSION);
            result.classifierModuleVersion =
                Number(global.ClipHub.Classifier.MODULE_VERSION);
            result.repositoryModuleVersion =
                Number(global.ClipHub.Repository.MODULE_VERSION);
            result.listModuleVersion = Number(global.ClipHub.List.MODULE_VERSION);
            result.editorModuleVersion = Number(global.ClipHub.Editor.MODULE_VERSION);
            result.filterModuleVersion = Number(global.ClipHub.Filter.MODULE_VERSION);
            result.translationModuleVersion =
                Number(global.ClipHub.Translation.MODULE_VERSION);
            result.settingsModuleVersion =
                Number(global.ClipHub.Settings.MODULE_VERSION);
            result.appModuleVersion = Number(global.ClipHub.App.MODULE_VERSION);
            result.navigationModuleVersion =
                Number(global.ClipHub.Navigation.MODULE_VERSION);
            result.clipboardListenerStopped =
                global.ClipHub.Clipboard.stop().running === false;

            result.classifiedUrl = global.ClipHub.Classifier.classify(
                "https://developer.android.com/");
            result.classifiedPhone = global.ClipHub.Classifier.classify(
                "+86 13800138000");
            result.urlId = Number(global.ClipHub.Repository.insertItem({
                content: "https://developer.android.com/",
                contentType: "url", sourcePackage: "com.android.chrome",
                sourceLabel: "Chrome 浏览器", sourceUid: 10000,
                sourceConfidence: 100, isPinned: true
            }));
            result.phoneId = Number(global.ClipHub.Repository.insertItem({
                content: "+86 13800138000", contentType: "phone",
                sourcePackage: "com.android.contacts",
                sourceLabel: "联系人", sourceUid: 10001,
                sourceConfidence: 100, isPinned: false
            }));
            result.textId = Number(global.ClipHub.Repository.insertItem({
                content: "ClipHub 自定义标签与翻译设置测试",
                contentType: "code", sourcePackage: "com.termux",
                sourceLabel: "Termux", sourceUid: 10002,
                sourceConfidence: 100, isPinned: false
            }));
            result.extraIds = [];
            for (extraIndex = 0; extraIndex < 25; extraIndex += 1) {
                result.extraIds.push(Number(global.ClipHub.Repository.insertItem({
                    content: "ClipHub 分页记录 " + String(extraIndex + 1),
                    contentType: "text", sourcePackage: "com.termux",
                    sourceLabel: "Termux", sourceUid: 10002,
                    sourceConfidence: 100, isPinned: false
                })));
            }
            result.urlRow = global.ClipHub.Repository.getItem(result.urlId, false);
            result.phoneRow = global.ClipHub.Repository.getItem(result.phoneId, false);
            result.typeOptions = global.ClipHub.Repository.listContentTypeOptions();
            result.typeFilterIgnoredCount = global.ClipHub.Repository.listItems({
                contentTypes: ["url"], limit: 100
            }).length;

            result.tagA = Number(global.ClipHub.Repository.insertTag({
                name: "开发资源", colorValue: -8658177, manualOrder: 1000
            }));
            result.tagB = Number(global.ClipHub.Repository.insertTag({
                name: "待处理", colorValue: -14336, manualOrder: 2000
            }));
            result.tagC = Number(global.ClipHub.Repository.insertTag({
                name: "重要", colorValue: -65536, manualOrder: 3000
            }));
            global.ClipHub.Repository.setItemTags(result.urlId,
                [result.tagA, result.tagB, result.tagC]);
            global.ClipHub.Repository.setItemTags(result.textId,
                [result.tagB]);
            result.reorderTags = global.ClipHub.Repository.reorderTags(
                [result.tagC, result.tagA, result.tagB]);
            result.urlTags = global.ClipHub.Repository.listItemTags(result.urlId);

            result.translationGuardValues = global.ClipHub.Settings.setMany({
                "translation.engine": "baidu",
                "translation.baidu.app_id": "",
                "translation.baidu.app_secret": "",
                "translation.youdao.app_key": "",
                "translation.youdao.app_secret": ""
            }, { cleanup: false });
            global.ClipHub.Settings.reload();

            result.show = global.ClipHub.App.executeControlCommand("show");
            result.rootReady = waitFor(function () {
                var app = global.ClipHub.App.getStatus();
                var panel = global.ClipHub.Filter.getPanelState();
                return app.primarySurface === "filter_root" &&
                    app.legacyHomeAttached === false &&
                    panel.contentTypeOptionCount === 0 &&
                    panel.typeChipCount === 0 &&
                    panel.settingsButtonPresent === true &&
                    panel.renderedTagLabelCount >= 2 &&
                    panel.resultCardCount === 20 &&
                    panel.loadedResultCount === 20 &&
                    panel.resultHasMore === true &&
                    panel.resultCanScroll === true &&
                    panel.loadMorePresent === true;
            }, 1800);
            result.firstPageState = global.ClipHub.Filter.getPanelState();
            result.rootScene = {
                app: global.ClipHub.App.getStatus(),
                filter: global.ClipHub.Filter.getState()
            };
            showToast("045  1/3  默认标签首页  ·  截图前未加载更多或长按");
            Thread.sleep(SCENE_DURATION_MS);

            result.loadMoreClick = global.ClipHub.Filter.performLoadMoreClick();
            result.loadMoreReady = waitFor(function () {
                var panel = global.ClipHub.Filter.getPanelState();
                return panel.resultCardCount >= 28 &&
                    panel.loadedResultCount >= 28 &&
                    panel.renderedTagLabelCount >= 3 &&
                    panel.resultHasMore === false;
            }, 1800);
            result.afterLoadMoreState = global.ClipHub.Filter.getPanelState();
            result.translationSelect = global.ClipHub.Filter
                .performResultLongClick(0);
            result.translationClick = global.ClipHub.Filter
                .performBottomActionClick("detail");
            result.translationPopupReady = waitFor(function () {
                return global.ClipHub.Translation.getState().attached === true;
            }, 1500);
            result.translationTerminalReady = waitFor(function () {
                var state = global.ClipHub.Translation.getState();
                return state.attached === true &&
                    state.running === false &&
                    state.errorCount >= 1 &&
                    state.lastError !== null;
            }, 2500);
            result.translationPopupState = global.ClipHub.Translation.getState();
            result.translationClose = global.ClipHub.Translation.close(
                "probe045_translation_guard");
            result.translationClosedReady = waitFor(function () {
                return global.ClipHub.Translation.getState().attached === false &&
                    global.ClipHub.Filter.getPanelState().attached === true;
            }, 1200);

            result.translationSettingsWrite = global.ClipHub.Settings.setMany({
                "translation.engine": "youdao",
                "translation.baidu.app_id": "probe-baidu-id",
                "translation.baidu.app_secret": "probe-baidu-secret",
                "translation.youdao.app_key": "probe-youdao-key",
                "translation.youdao.app_secret": "probe-youdao-secret"
            }, { cleanup: false });
            global.ClipHub.Settings.reload();
            result.settingsOpen = global.ClipHub.Filter.performSettingsClick();
            result.settingsReady = waitFor(function () {
                var state = global.ClipHub.Settings.getState();
                return state.attached === true && state.sectionCount === 4 &&
                    state.translationFieldCount === 4 &&
                    state.contentTypeSettingsPresent === false &&
                    state.selectedEngine === "youdao" &&
                    state.configuredEngine === "youdao";
            }, 1500);
            global.ClipHub.Settings.scrollToSection("translation");
            result.translationSettingsScene = {
                settings: global.ClipHub.Settings.getState(),
                values: global.ClipHub.Settings.getAll(),
                detail: global.ClipHub.List.getDetailState(),
                app: global.ClipHub.App.getStatus()
            };
            showToast("045  2/3  翻译设置  ·  百度与有道独立凭据");
            Thread.sleep(SCENE_DURATION_MS);

            global.ClipHub.Settings.scrollToSection("tags");
            result.tagSettingsScene = {
                settings: global.ClipHub.Settings.getState(),
                tags: global.ClipHub.Repository.listTags(),
                detail: global.ClipHub.List.getDetailState(),
                app: global.ClipHub.App.getStatus()
            };
            showToast("045  3/3  标签管理  ·  名称颜色排序删除");
            Thread.sleep(SCENE_DURATION_MS);

            result.settingsBack = global.ClipHub.Navigation
                .dispatchBackForOwner("detail", "probe045_settings_back");
            result.settingsBackReady = waitFor(function () {
                return global.ClipHub.Settings.getState().attached === false &&
                    global.ClipHub.Filter.getPanelState().attached === true;
            }, 1200);
            result.persistedValues = global.ClipHub.Settings.getAll();
            result.hide = global.ClipHub.App.executeControlCommand("hide");
            result.stop = global.ClipHub.App.stop("probe045_content_tags_settings");
            result.databaseClosed = !global.ClipHub.Database.isOpen();
            result.lockReleased = lockFree(isolated);
        } catch (error) {
            result.error = errorText(error);
            try { global.ClipHub.App.stop("probe045_error"); }
            catch (ignoredStop) {}
        } finally {
            try {
                if (formalWasRunning) {
                    result.formalRestart = lockFree(formal) ?
                        start(root, modules, formal) :
                        { ok: true, started: true, reused: true };
                } else {
                    result.formalRestart = { ok: true, skipped: true,
                        reason: "formal_was_not_running" };
                }
            } catch (restartError) {
                result.formalRestart = { ok: false,
                    error: errorText(restartError) };
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
                result.clipboardModuleVersion === 3 &&
                result.classifierModuleVersion === 2 &&
                result.repositoryModuleVersion === 8 &&
                result.listModuleVersion === 13 &&
                result.editorModuleVersion === 9 &&
                result.filterModuleVersion === 13 &&
                result.translationModuleVersion === 6 &&
                result.settingsModuleVersion === 5 &&
                result.appModuleVersion === 8 &&
                result.navigationModuleVersion === 3 &&
                result.clipboardListenerStopped === true &&
                result.classifiedUrl.type === "text" &&
                result.classifiedPhone.type === "text" &&
                String(result.urlRow.content_type) === "text" &&
                String(result.phoneRow.content_type) === "text" &&
                result.typeOptions.length === 0 &&
                result.typeFilterIgnoredCount === 28 &&
                result.urlTags.length === 3 &&
                result.reorderTags && result.reorderTags.ok === true &&
                result.rootReady === true &&
                result.firstPageState.resultCardCount === 20 &&
                result.firstPageState.renderedTagLabelCount >= 2 &&
                result.firstPageState.resultHasMore === true &&
                result.firstPageState.resultCanScroll === true &&
                result.rootScene.filter.panel.selectionMode === false &&
                result.rootScene.filter.panel.loadedResultCount === 20 &&
                result.loadMoreClick === true &&
                result.loadMoreReady === true &&
                result.afterLoadMoreState.resultCardCount >= 28 &&
                result.afterLoadMoreState.renderedTagLabelCount >= 3 &&
                result.afterLoadMoreState.resultHasMore === false &&
                result.translationSelect === true &&
                result.translationClick === true &&
                result.translationPopupReady === true &&
                result.translationTerminalReady === true &&
                result.translationPopupState.attached === true &&
                result.translationPopupState.running === false &&
                result.translationPopupState.errorCount >= 1 &&
                result.translationPopupState.lastError !== null &&
                result.translationClose === true &&
                result.translationClosedReady === true &&
                result.rootScene.app.legacyHomeAttached === false &&
                result.rootScene.filter.panel.contentTypeOptionCount === 0 &&
                result.settingsOpen === true &&
                result.settingsReady === true &&
                result.translationSettingsScene.settings
                    .contentTypeSettingsPresent === false &&
                result.translationSettingsScene.settings
                    .selectedEngine === "youdao" &&
                result.translationSettingsScene.settings
                    .configuredEngine === "youdao" &&
                result.translationSettingsScene.values
                    ["translation.engine"] === "youdao" &&
                result.tagSettingsScene.settings.tagRowCount === 3 &&
                result.settingsBack === true &&
                result.settingsBackReady === true &&
                result.persistedValues["translation.baidu.app_id"] ===
                    "probe-baidu-id" &&
                result.persistedValues["translation.youdao.app_key"] ===
                    "probe-youdao-key" &&
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
        global.ClipHubContentTagsSettingsProbe045Result = main();
    } catch (error) {
        global.ClipHubContentTagsSettingsProbe045Result = {
            ok: false, probe: "cliphub_content_tags_settings_probe_045",
            probeVersion: 3, fatal: true, error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubContentTagsSettingsProbe045Result);
