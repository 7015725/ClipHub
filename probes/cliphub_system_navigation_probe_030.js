/* ClipHub system navigation and background-hide probe 030. Rhino ES5 only. */
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

    var REQUIRED_SET = "20260722.23";
    var RUNTIME_NAME = "ClipHubProbe030";
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
            if (String(error).indexOf(
                    "OverlappingFileLockException") >= 0) {
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

    function start(root, moduleDir, runtimeDir) {
        var index;
        var file;
        global.ClipHub = {};
        for (index = 0; index < MODULES.length; index += 1) {
            file = new File(moduleDir, MODULES[index]);
            if (!file.isFile()) {
                throw new Error("Missing module: " +
                    file.getAbsolutePath());
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

    function add(content, createdAt) {
        return Number(global.ClipHub.Repository.insertItem({
            content: String(content),
            contentType: "text",
            sourcePackage: "com.navigation.probe",
            sourceLabel: "Navigation Probe",
            sourceUid: 10000,
            sourceConfidence: 100,
            createdAt: Number(createdAt),
            lastCopiedAt: Number(createdAt),
            updatedAt: Number(createdAt)
        }));
    }

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var formal = new File(root, "ClipHub");
        var modules = new File(formal, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var outputFile = new File(ensureDir(new File(formal, "probes")),
            "cliphub_system_navigation_probe_030_" +
                stamp(startedAt) + ".json");
        var local = localManifest(formal);
        var itemId;
        var nav;
        var result = {
            ok: false,
            probe: "cliphub_system_navigation_probe_030",
            probeVersion: 1,
            startedAt: startedAt,
            moduleSetVersion: local.moduleSetVersion || null,
            sourceRef: local.sourceRef || null,
            outputPath: String(outputFile.getAbsolutePath()),
            manualSystemGestureRequired: true,
            manualChecks: [
                "首页侧滑返回后全部 ClipHub UI 消失",
                "详情、编辑、筛选页侧滑返回首页",
                "首页三键返回行为与侧滑返回一致",
                "底部上拉进入最近任务后全部 UI 消失",
                "再次打开时从首页开始",
                "UI 退出后复制新文本仍能写入历史",
                "关闭后不存在透明遮罩或不可触摸区域"
            ],
            error: null
        };

        try {
            if (!local.present ||
                    local.moduleSetVersion !== REQUIRED_SET) {
                throw new Error("Installed module set must be " +
                    REQUIRED_SET);
            }
            if (!lockFree(formal)) {
                throw new Error("正式 ClipHub 正在运行，请先执行 " +
                    "probes/cliphub_stop_formal.js");
            }
            removeTree(isolated);
            result.start = start(root, modules, isolated);
            result.clipboardListenerStopped =
                global.ClipHub.Clipboard.stop().running === false;
            result.navigationPresent =
                global.ClipHub.Navigation !== null &&
                global.ClipHub.Navigation !== undefined;
            result.translationModuleVersion =
                Number(global.ClipHub.Translation.MODULE_VERSION);
            result.navigationModuleVersion =
                Number(global.ClipHub.Navigation.MODULE_VERSION);

            itemId = add("系统手势返回与后台退出探测", startedAt);
            result.itemId = itemId;
            result.listShow = global.ClipHub.List.show({
                limit: 20,
                widthDp: 340,
                heightDp: 500
            });
            waitFor(function () {
                return global.ClipHub.Navigation.getState()
                    .registeredRootCount >= 1;
            }, 1200);
            nav = global.ClipHub.Navigation.getState();
            result.navigationAfterHome = nav;
            result.homeCallbackRegistered =
                nav.registeredRootCount >= 1 &&
                (nav.callbackMode === "OnBackAnimationCallback" ||
                    nav.callbackMode === "OnBackInvokedCallback" ||
                    nav.sdkInt < 33);
            result.mainWindowFocusableUpgraded =
                nav.mainFocusableUpgradeCount >= 1 ||
                nav.sdkInt < 33;

            result.detailOpen =
                global.ClipHub.List.openDetail(itemId) !== false;
            waitFor(function () {
                return global.ClipHub.List.getDetailState()
                    .attachedToWindow === true;
            }, 800);
            waitFor(function () {
                return global.ClipHub.Navigation.getState()
                    .registeredOwners.indexOf("detail") >= 0;
            }, 1200);
            result.detailBackHandled =
                global.ClipHub.Navigation.dispatchBackForOwner(
                    "detail", "probe_detail_back") === true;
            waitFor(function () {
                return global.ClipHub.List.getDetailState()
                    .attachedToWindow !== true;
            }, 800);
            result.detailClosedAfterBack =
                global.ClipHub.List.getDetailState()
                    .attachedToWindow !== true;
            result.homeRemainedAfterDetailBack =
                global.ClipHub.Window.getState()
                    .attachedToWindow === true;

            result.editorOpen =
                global.ClipHub.Editor.openItem(itemId).ok === true;
            waitFor(function () {
                return global.ClipHub.Editor.getState()
                    .attachedToWindow === true;
            }, 800);
            result.editorBackHandled =
                global.ClipHub.Navigation.dispatchBackForOwner(
                    "editor", "probe_editor_back") === true;
            waitFor(function () {
                return global.ClipHub.Editor.getState()
                    .attachedToWindow !== true;
            }, 800);
            result.editorClosedAfterBack =
                global.ClipHub.Editor.getState()
                    .attachedToWindow !== true;

            result.filterOpen =
                global.ClipHub.Filter.showPanel().ok === true;
            waitFor(function () {
                return global.ClipHub.Filter.getPanelState()
                    .attachedToWindow === true;
            }, 800);
            result.filterBackHandled =
                global.ClipHub.Navigation.dispatchBackForOwner(
                    "filter", "probe_filter_back") === true;
            waitFor(function () {
                return global.ClipHub.Filter.getPanelState()
                    .attachedToWindow !== true;
            }, 800);
            result.filterClosedAfterBack =
                global.ClipHub.Filter.getPanelState()
                    .attachedToWindow !== true;

            result.homeBackHandled =
                global.ClipHub.Navigation.dispatchBackForOwner(
                    "home", "probe_home_back") === true;
            waitFor(function () {
                return global.ClipHub.Window.getState()
                    .attachedToWindow !== true;
            }, 800);
            result.homeClosedAfterBack =
                global.ClipHub.Window.getState()
                    .attachedToWindow !== true;
            result.appStillRunningAfterBack =
                global.ClipHub.App.isStarted() === true;

            global.ClipHub.List.show({
                limit: 20,
                widthDp: 340,
                heightDp: 500
            });
            waitFor(function () {
                return global.ClipHub.Window.getState()
                    .attachedToWindow === true;
            }, 800);
            result.syntheticRecentsHide =
                global.ClipHub.Navigation.hideUi(
                    "probe_recent_tasks").hidden === true;
            waitFor(function () {
                return global.ClipHub.Window.getState()
                    .attachedToWindow !== true;
            }, 800);
            result.allUiClosedAfterSyntheticRecents =
                global.ClipHub.Window.getState()
                    .attachedToWindow !== true &&
                global.ClipHub.List.getDetailState()
                    .attachedToWindow !== true &&
                global.ClipHub.Editor.getState()
                    .attachedToWindow !== true &&
                global.ClipHub.Filter.getPanelState()
                    .attachedToWindow !== true;
            result.appStillRunningAfterSyntheticRecents =
                global.ClipHub.App.isStarted() === true;
            result.navigationFinal =
                global.ClipHub.Navigation.getState();

            result.ok = result.navigationPresent &&
                result.translationModuleVersion >= 2 &&
                result.navigationModuleVersion >= 1 &&
                result.homeCallbackRegistered &&
                result.mainWindowFocusableUpgraded &&
                result.detailBackHandled &&
                result.detailClosedAfterBack &&
                result.homeRemainedAfterDetailBack &&
                result.editorBackHandled &&
                result.editorClosedAfterBack &&
                result.filterBackHandled &&
                result.filterClosedAfterBack &&
                result.homeBackHandled &&
                result.homeClosedAfterBack &&
                result.appStillRunningAfterBack &&
                result.syntheticRecentsHide &&
                result.allUiClosedAfterSyntheticRecents &&
                result.appStillRunningAfterSyntheticRecents;
        } catch (error) {
            result.error = String(error);
        } finally {
            try { global.ClipHub.App.stop("probe_030"); }
            catch (ignoredStop) {}
            result.lockReleased = lockFree(isolated);
            removeTree(isolated);
            result.finishedAt = now();
            write(outputFile, JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    global.ClipHubSystemNavigationProbe030Result = main();
}((function () { return this; }())));

JSON.stringify(ClipHubSystemNavigationProbe030Result);
