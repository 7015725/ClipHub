/* ClipHub search and advanced filter visual probe 038. Rhino ES5 only. */
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

    var REQUIRED_SET = "20260722.31";
    var RUNTIME_NAME = "ClipHubProbe038";
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
            sourcePackage: String(sourcePackage || "com.cliphub.probe038"),
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

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var formal = new File(root, "ClipHub");
        var modules = new File(formal, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var outputFile = new File(ensureDir(new File(formal, "probes")),
            "cliphub_search_filter_ui_probe_038_" +
                stamp(startedAt) + ".json");
        var local = localManifest(formal);
        var formalWasRunning = !lockFree(formal);
        var baseTime = startedAt - 30000;
        var ids = [];
        var tagDev;
        var tagNews;
        var searchState;
        var advancedState;
        var advancedBackState;
        var appliedState;
        var searchBackState;
        var restartState;
        var result = {
            ok: false,
            probe: "cliphub_search_filter_ui_probe_038",
            probeVersion: 1,
            moduleSetVersion: local.moduleSetVersion || null,
            sourceRef: local.sourceRef || null,
            sceneDurationMs: SCENE_DURATION_MS,
            sceneCount: 2,
            visualScreenshotRequired: true,
            instruction: "场景1截完整搜索结果页；场景2截完整高级筛选抽屉。两张截图均不得裁剪。",
            outputPath: String(outputFile.getAbsolutePath()),
            formalWasRunning: formalWasRunning,
            startedAt: startedAt,
            repositoryKeywordSemanticsChanged: false,
            sortImplementation: "filter_result_window_only",
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
            result.filterModuleVersion = Number(global.ClipHub.Filter.MODULE_VERSION);
            result.translationModuleVersion =
                Number(global.ClipHub.Translation.MODULE_VERSION);
            result.navigationModuleVersion =
                Number(global.ClipHub.Navigation.MODULE_VERSION);
            result.schemaVersion = Number(global.ClipHub.Database.getVersion());
            result.clipboardListenerStopped =
                global.ClipHub.Clipboard.stop().running === false;
            global.ClipHub.Settings.set("themeMode", "light", { cleanup: false });
            global.ClipHub.Settings.set("filterSearchHistory",
                ["meeting"], { cleanup: false });

            ids.push(add("https://developer.android.com/ Android Developers",
                "url", "com.android.chrome", "Chrome 浏览器",
                false, true, baseTime + 1000));
            ids.push(add("@AndroidDev 频道分享了 Android 14 新特性",
                "text", "org.telegram.messenger", "Telegram",
                false, false, baseTime + 2000));
            ids.push(add("Android 14 兼容性测试报告.pdf",
                "email", "com.google.android.gm", "Gmail",
                false, false, baseTime + 3000));
            ids.push(add("var androidResult = function () { return 'Android'; };",
                "code", "com.termux", "Termux",
                false, false, baseTime + 4000));
            ids.push(add("会议提醒：请 Android 组明天下午三点参加评审",
                "text", "com.tencent.mm", "微信",
                false, false, baseTime + 5000));
            ids.push(add("普通无关剪贴板内容",
                "text", "com.google.docs.editor", "文档",
                true, false, baseTime + 6000));

            tagDev = Number(global.ClipHub.Repository.ensureTag("开发资源"));
            tagNews = Number(global.ClipHub.Repository.ensureTag("资讯"));
            global.ClipHub.Repository.attachTag(ids[0], tagDev);
            global.ClipHub.Repository.attachTag(ids[1], tagNews);
            global.ClipHub.Repository.attachTag(ids[3], tagDev);

            result.seededCount = Number(
                global.ClipHub.Repository.countItems(false));
            result.tagCount = Number(
                global.ClipHub.Repository.listTags().length);
            result.fixtureUnrelatedPackage = "com.google.docs.editor";
            result.fixturePackageContainsAndroid =
                result.fixtureUnrelatedPackage.toLowerCase()
                    .indexOf("android") >= 0;

            result.homeShow = global.ClipHub.List.show({
                limit: 20, widthDp: 340, heightDp: 560
            });
            result.panelShow = global.ClipHub.Filter.showPanel({
                requestKeyboard: false, showAdvanced: false
            });
            result.searchAction = global.ClipHub.Filter.performSearch("Android");
            result.searchReady = waitFor(function () {
                var current = global.ClipHub.Filter.getState();
                return current.active === true &&
                    current.criteria.keyword === "Android" &&
                    current.lastResultCount === 5 &&
                    current.panel.attachedToWindow === true &&
                    current.panel.resultCardCount === 5 &&
                    current.panel.searchPageStyle === "reference_search_v4" &&
                    current.panel.advancedButtonText.indexOf("筛选") >= 0 &&
                    current.panel.advancedButtonText.indexOf("收起") < 0;
            }, 1800);
            searchState = global.ClipHub.Filter.getState();
            result.searchScene = searchState;
            result.searchNavigation = global.ClipHub.Navigation.getState();
            showToast("038  1/2  搜索结果页  ·  请截完整页面");
            Thread.sleep(SCENE_DURATION_MS);

            result.advancedOpen = global.ClipHub.Filter.performAdvancedClick();
            result.advancedKeywordAction =
                global.ClipHub.Filter.performAdvancedKeywordSearch("Android");
            result.sortToggle = global.ClipHub.Filter.performSortClick("source");
            result.sourceToggle = global.ClipHub.Filter.performSourceClick(
                "com.android.chrome");
            result.typeToggle = global.ClipHub.Filter.performTypeClick("url");
            result.tagToggle = global.ClipHub.Filter.performTagClick(tagDev);
            result.sensitiveToggle =
                global.ClipHub.Filter.performSensitiveClick("exclude");
            result.advancedReady = waitFor(function () {
                var current = global.ClipHub.Filter.getState();
                return current.panel.advancedDrawerVisible === true &&
                    current.panel.advancedKeywordInputPresent === true &&
                    current.panel.advancedButtonText.indexOf("筛选") >= 0 &&
                    current.panel.advancedButtonText.indexOf("收起") < 0 &&
                    current.panel.sourceWrapRowCount >= 2 &&
                    current.panel.sortOptionCount === 3 &&
                    current.panel.drawerHeightDp >= 520 &&
                    current.panel.drawerHeightDp <= 560 &&
                    current.panel.chipSingleLineEnforced === true &&
                    current.panel.chipEllipsizeEndEnforced === true &&
                    current.panel.advancedChipVerticalPaddingDp === 4 &&
                    current.panel.drawerContentBottomPaddingDp >= 6 &&
                    current.panel.drawerContentBottomPaddingDp <= 8 &&
                    current.panel.drawerFooterTopGapDp === 0 &&
                    current.panel.drawerFooterHeightDp >= 47 &&
                    current.panel.drawerFooterHeightDp <= 49 &&
                    current.panel.drawerMeasured === true &&
                    current.panel.drawerContentHeightDp > 0 &&
                    current.panel.drawerViewportHeightDp > 0 &&
                    current.panel.drawerScrollYDp === 0 &&
                    current.panel.drawerCanScrollDownAtTop === false &&
                    current.panel.drawerContentFitsViewport === true &&
                    current.panel.repositorySortUnchanged === true &&
                    current.panel.sortScope === "result_window" &&
                    current.criteria.sortMode === "source" &&
                    current.criteria.sourcePackages.length === 1 &&
                    current.criteria.contentTypes.length === 1 &&
                    current.criteria.tagIds.length === 1 &&
                    current.criteria.sensitiveMode === "exclude" &&
                    current.lastResultCount === 1;
            }, 1800);
            advancedState = global.ClipHub.Filter.getState();
            result.advancedScene = advancedState;
            result.advancedNavigation = global.ClipHub.Navigation.getState();
            showToast("038  2/2  高级筛选抽屉  ·  请截完整页面");
            Thread.sleep(SCENE_DURATION_MS);

            result.advancedBack = global.ClipHub.Navigation
                .dispatchBackForOwner("filter", "probe_advanced_back_038");
            result.advancedBackReady = waitFor(function () {
                var current = global.ClipHub.Filter.getState();
                return current.panel.attachedToWindow === true &&
                    current.panel.advancedDrawerVisible === false &&
                    current.panel.lastBackLayer === "advanced_drawer";
            }, 1200);
            advancedBackState = global.ClipHub.Filter.getState();
            result.advancedBackState = advancedBackState;

            result.advancedReopen =
                global.ClipHub.Filter.performAdvancedClick();
            result.applyClick = global.ClipHub.Filter.performApplyClick();
            appliedState = global.ClipHub.Filter.getState();
            result.appliedState = appliedState;
            Thread.sleep(220);
            result.searchBack = global.ClipHub.Navigation
                .dispatchBackForOwner("filter", "probe_search_back_038");
            result.searchBackReady = waitFor(function () {
                return global.ClipHub.Filter.getPanelState().attached === false;
            }, 1200);
            searchBackState = {
                filter: global.ClipHub.Filter.getState(),
                list: global.ClipHub.List.getState(),
                navigation: global.ClipHub.Navigation.getState()
            };
            result.searchBackState = searchBackState;

            result.firstStop = global.ClipHub.App.stop(
                "probe038_history_restart_1");
            result.firstDatabaseClosed = !global.ClipHub.Database.isOpen();
            result.firstLockReleased = lockFree(isolated);

            result.restart = start(root, modules, isolated);
            result.restartClipboardListenerStopped =
                global.ClipHub.Clipboard.stop().running === false;
            result.restartHomeShow = global.ClipHub.List.show({
                limit: 20, widthDp: 340, heightDp: 560
            });
            result.restartPanelShow = global.ClipHub.Filter.showPanel({
                requestKeyboard: false, showAdvanced: false
            });
            restartState = global.ClipHub.Filter.getState();
            result.restartState = restartState;
            result.historyRestored = containsText(
                restartState.searchHistory, "Android");
            result.restartPanelClose = global.ClipHub.Filter.closePanel();
            result.restartListClose = global.ClipHub.List.hide(true);
            result.stop = global.ClipHub.App.stop(
                "probe038_search_filter_ui");
            result.databaseClosed = !global.ClipHub.Database.isOpen();
            result.lockReleased = lockFree(isolated);
        } catch (error) {
            result.error = errorText(error);
            try { global.ClipHub.App.stop("probe038_error"); }
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
                result.filterModuleVersion === 9 &&
                result.translationModuleVersion === 4 &&
                result.navigationModuleVersion === 3 &&
                result.clipboardListenerStopped === true &&
                result.seededCount === 6 && result.tagCount === 2 &&
                result.fixturePackageContainsAndroid === false &&
                result.searchReady === true &&
                result.searchScene &&
                result.searchScene.lastResultCount === 5 &&
                result.searchScene.panel.resultCardCount === 5 &&
                result.advancedReady === true &&
                result.advancedScene &&
                result.advancedScene.panel.sourceWrapRowCount >= 2 &&
                result.advancedScene.panel.sortOptionCount === 3 &&
                result.advancedScene.panel.drawerHeightDp >= 520 &&
                result.advancedScene.panel.drawerHeightDp <= 560 &&
                result.advancedScene.panel.chipSingleLineEnforced === true &&
                result.advancedScene.panel.chipEllipsizeEndEnforced === true &&
                result.advancedScene.panel.advancedChipVerticalPaddingDp === 4 &&
                result.advancedScene.panel.drawerContentBottomPaddingDp >= 6 &&
                result.advancedScene.panel.drawerContentBottomPaddingDp <= 8 &&
                result.advancedScene.panel.drawerFooterTopGapDp === 0 &&
                result.advancedScene.panel.drawerFooterHeightDp >= 47 &&
                result.advancedScene.panel.drawerFooterHeightDp <= 49 &&
                result.advancedScene.panel.drawerMeasured === true &&
                result.advancedScene.panel.drawerContentHeightDp > 0 &&
                result.advancedScene.panel.drawerViewportHeightDp > 0 &&
                result.advancedScene.panel.drawerScrollYDp === 0 &&
                result.advancedScene.panel.drawerCanScrollDownAtTop === false &&
                result.advancedScene.panel.drawerContentFitsViewport === true &&
                result.advancedScene.lastResultCount === 1 &&
                result.advancedBack === true &&
                result.advancedBackReady === true &&
                result.advancedBackState.panel.attached === true &&
                result.advancedBackState.panel.advancedDrawerVisible === false &&
                result.applyClick === true &&
                result.appliedState.lastResultCount === 1 &&
                result.appliedState.panel.advancedDrawerVisible === false &&
                result.searchBack === true &&
                result.searchBackReady === true &&
                result.searchBackState.filter.panel.attached === false &&
                result.searchBackState.list.visible === true &&
                result.firstStop && result.firstStop.stopped === true &&
                result.firstDatabaseClosed === true &&
                result.firstLockReleased === true &&
                result.restart && result.restart.ok === true &&
                result.restartClipboardListenerStopped === true &&
                result.historyRestored === true &&
                result.restartPanelClose &&
                result.restartPanelClose.ok === true &&
                result.restartListClose === true &&
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
        global.ClipHubSearchFilterUiProbe038Result = main();
    } catch (error) {
        global.ClipHubSearchFilterUiProbe038Result = {
            ok: false,
            probe: "cliphub_search_filter_ui_probe_038",
            probeVersion: 1,
            fatal: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubSearchFilterUiProbe038Result);
