/* ClipHub sole filter-root probe 044 v2. Rhino ES5 only. */
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

    var REQUIRED_SET = "20260722.37";
    var RUNTIME_NAME = "ClipHubProbe044";
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
            pinned, createdAt) {
        return Number(global.ClipHub.Repository.insertItem({
            content: String(content),
            contentType: String(contentType || "text"),
            sourcePackage: String(sourcePackage || "com.cliphub.probe044"),
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
        var modules = new File(formal, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var outputFile = new File(ensureDir(new File(formal, "probes")),
            "cliphub_filter_root_probe_044_" + stamp(startedAt) + ".json");
        var local = localManifest(formal);
        var formalWasRunning = !lockFree(formal);
        var result = {
            ok: false,
            probe: "cliphub_filter_root_probe_044",
            probeVersion: 2,
            startedAt: startedAt,
            moduleSetVersion: local.moduleSetVersion || null,
            sourceRef: local.sourceRef || null,
            sceneDurationMs: SCENE_DURATION_MS,
            sceneCount: 3,
            visualScreenshotRequired: true,
            instruction: "场景1截默认唯一首页；场景2截长按选中状态；场景3截高级筛选抽屉。三张截图均不得裁剪。",
            outputPath: String(outputFile.getAbsolutePath()),
            formalWasRunning: formalWasRunning,
            legacyHomeRemovedFromProductionEntry: true,
            repositorySemanticsChanged: false,
            navigationImplementationChanged: false,
            navigationDebouncePreserved: true,
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
            result.listModuleVersion = Number(global.ClipHub.List.MODULE_VERSION);
            result.filterModuleVersion = Number(global.ClipHub.Filter.MODULE_VERSION);
            result.appModuleVersion = Number(global.ClipHub.App.MODULE_VERSION);
            result.navigationModuleVersion =
                Number(global.ClipHub.Navigation.MODULE_VERSION);
            result.schemaVersion = Number(global.ClipHub.Database.getVersion());
            result.clipboardListenerStopped =
                global.ClipHub.Clipboard.stop().running === false;
            global.ClipHub.Settings.set("themeMode", "light", {
                cleanup: false
            });
            global.ClipHub.Settings.set("closeAfterCopy", false, {
                cleanup: false
            });
            add("https://developer.android.com/ ClipHub 唯一首页测试",
                "url", "com.android.chrome", "Chrome 浏览器", true,
                startedAt - 3000);
            add("ClipHub 唯一首页测试 2", "text", "com.termux",
                "Termux", false, startedAt - 2000);
            add("ClipHub 唯一首页测试 3", "text",
                "com.cliphub.probe044", "探测来源", false,
                startedAt - 1000);

            result.showCommand = global.ClipHub.App
                .executeControlCommand("show");
            result.rootReady = waitFor(function () {
                var app = global.ClipHub.App.getStatus();
                var list = global.ClipHub.List.getState();
                var panel = global.ClipHub.Filter.getPanelState();
                return app.filterAttached === true &&
                    app.filterRootMode === true &&
                    app.primarySurface === "filter_root" &&
                    app.legacyHomeAttached === false &&
                    app.windowAttached === false &&
                    list.visible === false &&
                    panel.rootMode === true &&
                    panel.resultCardCount === 3 &&
                    panel.toolbarEnabledCount === 1;
            }, 1800);
            result.rootScene = {
                app: global.ClipHub.App.getStatus(),
                list: global.ClipHub.List.getState(),
                filter: global.ClipHub.Filter.getState()
            };
            showToast("044  1/3  唯一根页面  ·  不得出现旧首页");
            Thread.sleep(SCENE_DURATION_MS);

            result.selectAction = global.ClipHub.Filter
                .performResultLongClick(1);
            result.selectionReady = waitFor(function () {
                var app = global.ClipHub.App.getStatus();
                var panel = global.ClipHub.Filter.getPanelState();
                return app.legacyHomeAttached === false &&
                    panel.rootMode === true &&
                    panel.selectionMode === true &&
                    panel.selectedItemId !== null &&
                    panel.toolbarEnabledCount === 5;
            }, 1200);
            result.pinAction = global.ClipHub.Filter
                .performBottomActionClick("pin");
            result.selectionScene = {
                app: global.ClipHub.App.getStatus(),
                list: global.ClipHub.List.getState(),
                filter: global.ClipHub.Filter.getState()
            };
            showToast("044  2/3  长按选中  ·  底部操作栏已启用");
            Thread.sleep(SCENE_DURATION_MS);

            result.advancedAction = global.ClipHub.Filter
                .performAdvancedClick();
            result.advancedReady = waitFor(function () {
                var app = global.ClipHub.App.getStatus();
                var panel = global.ClipHub.Filter.getPanelState();
                return app.legacyHomeAttached === false &&
                    panel.rootMode === true &&
                    panel.advancedDrawerVisible === true;
            }, 1200);
            result.advancedScene = {
                app: global.ClipHub.App.getStatus(),
                list: global.ClipHub.List.getState(),
                filter: global.ClipHub.Filter.getState()
            };
            showToast("044  3/3  高级筛选抽屉  ·  仍为唯一根页面");
            Thread.sleep(SCENE_DURATION_MS);

            result.drawerBack = global.ClipHub.Navigation
                .dispatchBackForOwner("filter", "probe044_drawer_back");
            result.drawerBackReady = waitFor(function () {
                return global.ClipHub.Filter.getPanelState()
                    .advancedDrawerVisible === false;
            }, 1000);
            result.returnDebounceWaitMs = 260;
            Thread.sleep(result.returnDebounceWaitMs);
            result.rootBack = global.ClipHub.Navigation
                .dispatchBackForOwner("filter", "probe044_root_back");
            result.rootBackReady = waitFor(function () {
                var app = global.ClipHub.App.getStatus();
                return app.uiVisible === false &&
                    app.windowAttached === false &&
                    app.filterAttached === false;
            }, 1200);
            result.reopen = global.ClipHub.App
                .executeControlCommand("show");
            result.reopenReady = waitFor(function () {
                var app = global.ClipHub.App.getStatus();
                return app.filterAttached === true &&
                    app.filterRootMode === true &&
                    app.legacyHomeAttached === false &&
                    app.primarySurface === "filter_root";
            }, 1200);
            result.finalState = {
                app: global.ClipHub.App.getStatus(),
                list: global.ClipHub.List.getState(),
                filter: global.ClipHub.Filter.getState(),
                navigation: global.ClipHub.Navigation.getState()
            };
            result.hideCommand = global.ClipHub.App
                .executeControlCommand("hide");
            result.stop = global.ClipHub.App.stop(
                "probe044_filter_root");
            result.databaseClosed = !global.ClipHub.Database.isOpen();
            result.lockReleased = lockFree(isolated);
        } catch (error) {
            result.error = errorText(error);
            try { global.ClipHub.App.stop("probe044_error"); }
            catch (ignoredStop) {}
        } finally {
            try {
                if (formalWasRunning) {
                    result.formalRestart = lockFree(formal) ?
                        start(root, modules, formal) :
                        { ok: true, started: true, reused: true };
                } else {
                    result.formalRestart = {
                        ok: true,
                        skipped: true,
                        reason: "formal_was_not_running"
                    };
                }
            } catch (restartError) {
                result.formalRestart = {
                    ok: false,
                    error: errorText(restartError)
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
                result.listModuleVersion === 12 &&
                result.filterModuleVersion === 11 &&
                result.appModuleVersion === 7 &&
                result.navigationModuleVersion === 3 &&
                result.clipboardListenerStopped === true &&
                result.showCommand && result.showCommand.ok === true &&
                result.rootReady === true &&
                result.rootScene.app.legacyHomeAttached === false &&
                result.rootScene.list.visible === false &&
                result.rootScene.filter.panel.rootMode === true &&
                result.selectAction === true &&
                result.selectionReady === true &&
                result.pinAction === true &&
                result.selectionScene.app.legacyHomeAttached === false &&
                result.selectionScene.filter.panel.toolbarEnabledCount === 5 &&
                result.advancedAction === true &&
                result.advancedReady === true &&
                result.advancedScene.app.legacyHomeAttached === false &&
                result.drawerBack === true &&
                result.drawerBackReady === true &&
                result.rootBack === true &&
                result.rootBackReady === true &&
                result.reopen && result.reopen.ok === true &&
                result.reopenReady === true &&
                result.finalState.app.legacyHomeAttached === false &&
                result.hideCommand && result.hideCommand.ok === true &&
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
        global.ClipHubFilterRootProbe044Result = main();
    } catch (error) {
        global.ClipHubFilterRootProbe044Result = {
            ok: false,
            probe: "cliphub_filter_root_probe_044",
            probeVersion: 2,
            fatal: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubFilterRootProbe044Result);
