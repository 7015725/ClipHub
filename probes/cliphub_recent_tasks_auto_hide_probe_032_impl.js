/* ClipHub real Recents auto-hide probe 032 implementation. Rhino ES5 only. */
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

    var REQUIRED_SET = "20260722.25";
    var RUNTIME_NAME = "ClipHubProbe032";
    var SAMPLE_INTERVAL_MS = 120;
    var SAMPLE_DURATION_MS = 12000;
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

    function addInstruction(createdAt) {
        return Number(global.ClipHub.Repository.insertItem({
            content: "探测 032：窗口出现后请在 3 秒内从底部上拉进入最近任务，停留至少 3 秒。模块集 .25 应自动关闭全部 ClipHub UI。不要主动关闭窗口，等待约 12 秒自动返回结果。",
            contentType: "text",
            sourcePackage: "com.navigation.probe032",
            sourceLabel: "Recents Auto Hide Probe",
            sourceUid: 10000,
            sourceConfidence: 100,
            createdAt: Number(createdAt),
            lastCopiedAt: Number(createdAt),
            updatedAt: Number(createdAt)
        }));
    }

    function allUiClosed() {
        return global.ClipHub.Window.getState().attachedToWindow !== true &&
            global.ClipHub.List.getDetailState().attachedToWindow !== true &&
            global.ClipHub.Editor.getState().attachedToWindow !== true &&
            global.ClipHub.Filter.getPanelState().attachedToWindow !== true;
    }

    function snapshot(elapsedMs) {
        var watch = global.ClipHub.RecentsWatch.getState();
        var navigation = global.ClipHub.Navigation.getState();
        return {
            elapsedMs: Number(elapsedMs),
            uiClosed: allUiClosed(),
            watch: watch,
            navigation: {
                registeredRootCount:
                    Number(navigation.registeredRootCount || 0),
                uiHideCount: Number(navigation.uiHideCount || 0),
                backgroundHideCount:
                    Number(navigation.backgroundHideCount || 0),
                lastHideReason: String(navigation.lastHideReason || ""),
                lastError: navigation.lastError === null ||
                    navigation.lastError === undefined ? null :
                    String(navigation.lastError)
            }
        };
    }

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var formal = new File(root, "ClipHub");
        var modules = new File(formal, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var outputFile = new File(ensureDir(new File(formal, "probes")),
            "cliphub_recent_tasks_auto_hide_probe_032_" +
                stamp(startedAt) + ".json");
        var local = localManifest(formal);
        var samples = [];
        var changes = [];
        var current;
        var previousSignature = "";
        var signature;
        var samplingStartedAt;
        var finalWatch;
        var finalNavigation;
        var result = {
            ok: false,
            probe: "cliphub_recent_tasks_auto_hide_probe_032",
            probeVersion: 1,
            moduleSetVersion: local.moduleSetVersion || null,
            sourceRef: local.sourceRef || null,
            sampleIntervalMs: SAMPLE_INTERVAL_MS,
            sampleDurationMs: SAMPLE_DURATION_MS,
            outputPath: String(outputFile.getAbsolutePath()),
            instruction: "窗口出现后 3 秒内上拉进入最近任务并停留至少 3 秒；等待探测自动结束。",
            error: null
        };

        try {
            if (!local.present || local.moduleSetVersion !== REQUIRED_SET) {
                throw new Error("Installed module set must be " + REQUIRED_SET);
            }
            if (!lockFree(formal)) {
                throw new Error("正式 ClipHub 正在运行，请先执行 " +
                    "probes/cliphub_stop_formal.js");
            }
            removeTree(isolated);
            result.start = start(root, modules, isolated);
            result.clipboardListenerStopped =
                global.ClipHub.Clipboard.stop().running === false;
            result.recentsWatchPresent = !!global.ClipHub.RecentsWatch;
            result.recentsWatchVersion =
                Number(global.ClipHub.RecentsWatch.MODULE_VERSION);
            result.eventBusVersion =
                Number(global.ClipHub.EventBus.MODULE_VERSION);
            result.itemId = addInstruction(startedAt);
            result.listShow = global.ClipHub.List.show({
                limit: 20, widthDp: 340, heightDp: 500
            });
            result.uiInitiallyVisible = waitFor(function () {
                return global.ClipHub.Window.getState()
                    .attachedToWindow === true &&
                    global.ClipHub.RecentsWatch.getState()
                    .running === true;
            }, 1800);
            result.initialWatch = global.ClipHub.RecentsWatch.getState();
            result.initialNavigation =
                global.ClipHub.Navigation.getState();

            samplingStartedAt = now();
            while (now() - samplingStartedAt < SAMPLE_DURATION_MS) {
                current = snapshot(now() - samplingStartedAt);
                samples.push(current);
                signature = [
                    current.uiClosed,
                    current.watch.running,
                    current.watch.lastPackage,
                    current.watch.lastActivityType,
                    current.watch.lastTaskId,
                    current.watch.signalCount,
                    current.watch.hideCount,
                    current.navigation.registeredRootCount,
                    current.navigation.uiHideCount,
                    current.navigation.lastHideReason
                ].join("#");
                if (signature !== previousSignature) {
                    changes.push(current);
                    previousSignature = signature;
                }
                Thread.sleep(SAMPLE_INTERVAL_MS);
            }

            finalWatch = global.ClipHub.RecentsWatch.getState();
            finalNavigation = global.ClipHub.Navigation.getState();
            result.finalWatch = finalWatch;
            result.finalNavigation = finalNavigation;
            result.uiClosedAfterRealRecents = allUiClosed();
            result.callbacksCleared =
                Number(finalNavigation.registeredRootCount || 0) === 0;
            result.watchConfirmedSignal =
                Number(finalWatch.confirmedSignalCount || 0) >= 1;
            result.watchHideTriggered =
                Number(finalWatch.hideCount || 0) >= 1;
            result.navigationHideTriggered =
                Number(finalNavigation.uiHideCount || 0) >= 1;
            result.appStillRunning =
                global.ClipHub.App.isStarted() === true;
            result.changeTimeline = changes;
            result.ok = result.recentsWatchPresent &&
                result.recentsWatchVersion >= 1 &&
                result.eventBusVersion >= 2 &&
                result.uiInitiallyVisible &&
                result.watchConfirmedSignal &&
                result.watchHideTriggered &&
                result.navigationHideTriggered &&
                result.uiClosedAfterRealRecents &&
                result.callbacksCleared &&
                result.appStillRunning;
        } catch (error) {
            result.error = String(error);
        } finally {
            try { global.ClipHub.App.stop("probe_032_complete"); }
            catch (ignoredStop) {}
            result.lockReleased = lockFree(isolated);
            removeTree(isolated);
            result.finishedAt = now();
            write(outputFile, JSON.stringify({
                result: result,
                samples: samples
            }, null, 2) + "\n");
        }
        return result;
    }

    global.ClipHubRecentTasksAutoHideProbe032Result = main();
}((function () { return this; }())));

JSON.stringify(ClipHubRecentTasksAutoHideProbe032Result);
