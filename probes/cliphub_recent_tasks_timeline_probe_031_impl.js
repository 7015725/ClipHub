/* ClipHub real Recents transition timeline probe 031 implementation. Rhino ES5 only. */
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
    var Context = Packages.android.content.Context;
    var ActivityTaskManager = Packages.android.app.ActivityTaskManager;
    var WindowManagerGlobal = Packages.android.view.WindowManagerGlobal;

    var REQUIRED_SET = "20260722.24";
    var RUNTIME_NAME = "ClipHubProbe031";
    var SAMPLE_INTERVAL_MS = 120;
    var SAMPLE_DURATION_MS = 15000;
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
            content: "探测 031：窗口出现后，请在 3 秒内从底部上拉进入最近任务，停留至少 3 秒，再返回原应用。探测总时长约 15 秒，期间不要主动关闭 ClipHub。",
            contentType: "text",
            sourcePackage: "com.navigation.probe031",
            sourceLabel: "Recents Timeline Probe",
            sourceUid: 10000,
            sourceConfidence: 100,
            createdAt: Number(createdAt),
            lastCopiedAt: Number(createdAt),
            updatedAt: Number(createdAt)
        }));
    }

    function safeBoolean(callback) {
        try { return callback() === true; }
        catch (ignored) { return false; }
    }

    function safeNumber(value, fallback) {
        var number = Number(value);
        return isFinite(number) ? number : Number(fallback || 0);
    }

    function componentData(component) {
        if (!component) {
            return { packageName: "", className: "", flattened: "" };
        }
        try {
            return {
                packageName: String(component.getPackageName() || ""),
                className: String(component.getClassName() || ""),
                flattened: String(component.flattenToShortString() || "")
            };
        } catch (error) {
            return { packageName: "", className: "",
                flattened: "", error: String(error) };
        }
    }

    function focusedTaskSnapshot() {
        var result = {
            available: false,
            source: "none",
            packageName: "",
            className: "",
            flattened: "",
            basePackageName: "",
            baseClassName: "",
            baseFlattened: "",
            activityType: 0,
            windowingMode: 0,
            taskId: -1,
            displayId: -1,
            visible: null,
            focused: null,
            running: null,
            error: null
        };
        var service;
        var info;
        var top;
        var base;
        try {
            service = ActivityTaskManager.getService();
            info = service.getFocusedRootTaskInfo();
            if (info) {
                top = componentData(info.topActivity || info.baseActivity);
                base = componentData(info.baseActivity);
                result.available = true;
                result.source = "focused_root_task";
                result.packageName = top.packageName;
                result.className = top.className;
                result.flattened = top.flattened;
                result.basePackageName = base.packageName;
                result.baseClassName = base.className;
                result.baseFlattened = base.flattened;
                try {
                    result.activityType = safeNumber(info.configuration
                        .windowConfiguration.getActivityType(), 0);
                } catch (ignoredType) {}
                try {
                    result.windowingMode = safeNumber(info.configuration
                        .windowConfiguration.getWindowingMode(), 0);
                } catch (ignoredMode) {}
                try { result.taskId = safeNumber(info.taskId, -1); }
                catch (ignoredTaskId) {}
                try { result.displayId = safeNumber(info.displayId, -1); }
                catch (ignoredDisplayId) {}
                try { result.visible = info.visible === true; }
                catch (ignoredVisible) {}
                try { result.focused = info.focused === true; }
                catch (ignoredFocused) {}
                try { result.running = info.running === true; }
                catch (ignoredRunning) {}
                return result;
            }
        } catch (errorAtm) {
            result.error = String(errorAtm);
        }
        return result;
    }

    function runningTaskSnapshot(activityManager) {
        var output = [];
        var tasks;
        var index;
        var task;
        var top;
        var base;
        try {
            tasks = activityManager.getRunningTasks(5);
            if (!tasks) { return output; }
            for (index = 0; index < Number(tasks.size()); index += 1) {
                task = tasks.get(index);
                top = componentData(task.topActivity);
                base = componentData(task.baseActivity);
                output.push({
                    index: index,
                    id: safeNumber(task.id, -1),
                    taskId: safeNumber(task.taskId, -1),
                    topPackageName: top.packageName,
                    topClassName: top.className,
                    topFlattened: top.flattened,
                    basePackageName: base.packageName,
                    baseClassName: base.className,
                    baseFlattened: base.flattened,
                    numActivities: safeNumber(task.numActivities, 0),
                    isRunning: task.isRunning === true
                });
            }
        } catch (error) {
            output.push({ error: String(error) });
        }
        return output;
    }

    function windowTitle(view) {
        var params;
        var title;
        try {
            params = view.getLayoutParams();
            if (params && typeof params.getTitle === "function") {
                title = params.getTitle();
                return title === null || title === undefined ? "" :
                    String(title);
            }
        } catch (ignored) {}
        return "";
    }

    function rootSnapshot() {
        var output = [];
        var source;
        var size;
        var index;
        var view;
        var title;
        var params;
        try {
            source = WindowManagerGlobal.getInstance().getWindowViews();
            size = source && source.size ? Number(source.size()) :
                (source && source.length !== undefined ?
                    Number(source.length) : 0);
            for (index = 0; index < size; index += 1) {
                view = source.get ? source.get(index) : source[index];
                title = windowTitle(view);
                if (String(title).toLowerCase().indexOf("cliphub") < 0) {
                    continue;
                }
                params = null;
                try { params = view.getLayoutParams(); }
                catch (ignoredParams) {}
                output.push({
                    title: title,
                    identity: safeNumber(System.identityHashCode(view), 0),
                    attached: safeBoolean(function () {
                        return view.isAttachedToWindow();
                    }),
                    hasWindowFocus: safeBoolean(function () {
                        return view.hasWindowFocus();
                    }),
                    shown: safeBoolean(function () { return view.isShown(); }),
                    visibility: safeNumber(view.getVisibility(), -1),
                    alpha: safeNumber(view.getAlpha(), -1),
                    windowType: params ? safeNumber(params.type, 0) : 0,
                    windowFlags: params ? safeNumber(params.flags, 0) : 0
                });
            }
        } catch (error) {
            output.push({ error: String(error) });
        }
        return output;
    }

    function uiState() {
        var windowState = null;
        var listState = null;
        var detailState = null;
        var editorState = null;
        var filterState = null;
        try { windowState = global.ClipHub.Window.getState(); }
        catch (ignoredWindow) {}
        try { listState = global.ClipHub.List.getState(); }
        catch (ignoredList) {}
        try { detailState = global.ClipHub.List.getDetailState(); }
        catch (ignoredDetail) {}
        try { editorState = global.ClipHub.Editor.getState(); }
        catch (ignoredEditor) {}
        try { filterState = global.ClipHub.Filter.getPanelState(); }
        catch (ignoredFilter) {}
        return {
            visible: !!((windowState && windowState.attachedToWindow === true) ||
                (listState && listState.visible === true) ||
                (detailState && detailState.attachedToWindow === true) ||
                (editorState && editorState.attachedToWindow === true) ||
                (filterState && filterState.attachedToWindow === true)),
            homeAttached: !!(windowState &&
                windowState.attachedToWindow === true),
            listVisible: !!(listState && listState.visible === true),
            detailAttached: !!(detailState &&
                detailState.attachedToWindow === true),
            editorAttached: !!(editorState &&
                editorState.attachedToWindow === true),
            filterAttached: !!(filterState &&
                filterState.attachedToWindow === true)
        };
    }

    function systemPackage(packageName) {
        packageName = String(packageName || "").toLowerCase();
        return packageName.indexOf("systemui") >= 0 ||
            packageName.indexOf("launcher") >= 0 ||
            packageName.indexOf("quickstep") >= 0 ||
            packageName.indexOf("recents") >= 0;
    }

    function compactSignature(sample) {
        var rootFocus = [];
        var index;
        for (index = 0; index < sample.roots.length; index += 1) {
            rootFocus.push(sample.roots[index].title + ":" +
                String(sample.roots[index].hasWindowFocus));
        }
        return [
            sample.task.packageName,
            sample.task.activityType,
            sample.task.windowingMode,
            sample.ui.visible,
            sample.anyFocused,
            sample.roots.length,
            rootFocus.join("|")
        ].join("#");
    }

    function buildSample(startedAt, activityManager) {
        var roots = rootSnapshot();
        var focusedCount = 0;
        var index;
        var nav;
        for (index = 0; index < roots.length; index += 1) {
            if (roots[index].hasWindowFocus === true) { focusedCount += 1; }
        }
        try { nav = global.ClipHub.Navigation.getState(); }
        catch (error) { nav = { lastError: String(error) }; }
        return {
            at: now(),
            elapsedMs: now() - startedAt,
            ui: uiState(),
            roots: roots,
            rootCount: roots.length,
            focusedRootCount: focusedCount,
            anyFocused: focusedCount > 0,
            task: focusedTaskSnapshot(),
            runningTasks: runningTaskSnapshot(activityManager),
            navigation: {
                registeredRootCount: safeNumber(nav.registeredRootCount, 0),
                focusGainCount: safeNumber(nav.focusGainCount, 0),
                focusLossCount: safeNumber(nav.focusLossCount, 0),
                backgroundCheckCount:
                    safeNumber(nav.backgroundCheckCount, 0),
                backgroundHideCount:
                    safeNumber(nav.backgroundHideCount, 0),
                uiHideCount: safeNumber(nav.uiHideCount, 0),
                baselinePackage: String(nav.baselinePackage || ""),
                lastTopPackage: String(nav.lastTopPackage || ""),
                lastActivityType: safeNumber(nav.lastActivityType, 0),
                lastBackgroundReason:
                    String(nav.lastBackgroundReason || ""),
                lastHideReason: String(nav.lastHideReason || ""),
                lastError: nav.lastError === null ||
                    nav.lastError === undefined ? null :
                    String(nav.lastError)
            }
        };
    }

    function summarize(samples, baselinePackage, initialNav, finalNav) {
        var summary = {
            sampleCount: samples.length,
            baselinePackage: String(baselinePackage || ""),
            focusLossObserved: false,
            focusRegainObserved: false,
            taskUnavailableCount: 0,
            topPackageChangedObserved: false,
            recentsActivityTypeObserved: false,
            systemPackageObserved: false,
            recentsSignalObserved: false,
            uiHiddenObserved: false,
            uiVisibleDuringRecentsSignal: false,
            clipHubFocusStuckDuringRecentsSignal: false,
            unfocusedUiVisibleObserved: false,
            focusLossSampleCount: 0,
            recentsSignalSampleCount: 0,
            stuckFocusSampleCount: 0,
            unfocusedUiVisibleSampleCount: 0,
            backgroundCheckDelta: safeNumber(
                finalNav.backgroundCheckCount, 0) - safeNumber(
                    initialNav.backgroundCheckCount, 0),
            backgroundHideDelta: safeNumber(
                finalNav.backgroundHideCount, 0) - safeNumber(
                    initialNav.backgroundHideCount, 0),
            uiHideDelta: safeNumber(finalNav.uiHideCount, 0) -
                safeNumber(initialNav.uiHideCount, 0),
            navigationFocusLossDelta: safeNumber(
                finalNav.focusLossCount, 0) - safeNumber(
                    initialNav.focusLossCount, 0),
            navigationFocusGainDelta: safeNumber(
                finalNav.focusGainCount, 0) - safeNumber(
                    initialNav.focusGainCount, 0),
            observedPackages: [],
            diagnosis: "undetermined"
        };
        var packageMap = {};
        var hadFocus = false;
        var lostFocus = false;
        var sample;
        var recentsSignal;
        var index;
        for (index = 0; index < samples.length; index += 1) {
            sample = samples[index];
            if (sample.anyFocused) {
                hadFocus = true;
                if (lostFocus) { summary.focusRegainObserved = true; }
            } else if (hadFocus) {
                lostFocus = true;
                summary.focusLossObserved = true;
                summary.focusLossSampleCount += 1;
            }
            if (!sample.task.available) {
                summary.taskUnavailableCount += 1;
            }
            if (sample.task.packageName &&
                    sample.task.packageName !== baselinePackage) {
                summary.topPackageChangedObserved = true;
            }
            if (sample.task.activityType === 2 ||
                    sample.task.activityType === 3) {
                summary.recentsActivityTypeObserved = true;
            }
            if (systemPackage(sample.task.packageName)) {
                summary.systemPackageObserved = true;
            }
            recentsSignal = sample.task.activityType === 2 ||
                sample.task.activityType === 3 ||
                systemPackage(sample.task.packageName) ||
                (!!sample.task.packageName && !!baselinePackage &&
                    sample.task.packageName !== baselinePackage);
            if (recentsSignal) {
                summary.recentsSignalObserved = true;
                summary.recentsSignalSampleCount += 1;
                if (sample.ui.visible) {
                    summary.uiVisibleDuringRecentsSignal = true;
                }
                if (sample.anyFocused) {
                    summary.clipHubFocusStuckDuringRecentsSignal = true;
                    summary.stuckFocusSampleCount += 1;
                }
            }
            if (!sample.anyFocused && sample.ui.visible) {
                summary.unfocusedUiVisibleObserved = true;
                summary.unfocusedUiVisibleSampleCount += 1;
            }
            if (!sample.ui.visible) { summary.uiHiddenObserved = true; }
            if (sample.task.packageName) {
                packageMap[sample.task.packageName] = true;
            }
        }
        for (index in packageMap) {
            if (packageMap.hasOwnProperty(index)) {
                summary.observedPackages.push(String(index));
            }
        }
        if (!summary.recentsSignalObserved && !summary.focusLossObserved) {
            summary.diagnosis =
                "recents_transition_not_visible_to_focus_or_task_signals";
        } else if (summary.recentsSignalObserved &&
                summary.clipHubFocusStuckDuringRecentsSignal) {
            summary.diagnosis = "cliphub_root_focus_stuck_during_recents";
        } else if (summary.recentsSignalObserved &&
                summary.unfocusedUiVisibleObserved &&
                summary.backgroundCheckDelta === 0) {
            summary.diagnosis =
                "focus_lost_but_background_check_not_started_or_cancelled";
        } else if (summary.recentsSignalObserved &&
                summary.unfocusedUiVisibleObserved &&
                summary.backgroundCheckDelta > 0 &&
                summary.backgroundHideDelta === 0) {
            summary.diagnosis =
                "background_check_ran_but_recents_condition_not_matched";
        } else if (!summary.recentsSignalObserved &&
                summary.focusLossObserved) {
            summary.diagnosis =
                "focus_lost_but_focused_task_snapshot_did_not_change";
        } else if (summary.uiHiddenObserved) {
            summary.diagnosis = "ui_hide_observed_during_real_transition";
        }
        return summary;
    }

    function main() {
        var probeStartedAt = now();
        var root = String(shortx.getShortXDir());
        var formal = new File(root, "ClipHub");
        var modules = new File(formal, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var outputFile = new File(ensureDir(new File(formal, "probes")),
            "cliphub_recent_tasks_timeline_probe_031_" +
                stamp(probeStartedAt) + ".json");
        var local = localManifest(formal);
        var activityManager = null;
        var initialNav = null;
        var finalNav = null;
        var samples = [];
        var changes = [];
        var sample;
        var signature = "";
        var previousSignature = "";
        var samplingStartedAt = 0;
        var baselinePackage = "";
        var result = {
            ok: false,
            probe: "cliphub_recent_tasks_timeline_probe_031",
            probeVersion: 1,
            moduleSetVersion: local.moduleSetVersion || null,
            sourceRef: local.sourceRef || null,
            sampleIntervalMs: SAMPLE_INTERVAL_MS,
            sampleDurationMs: SAMPLE_DURATION_MS,
            outputPath: String(outputFile.getAbsolutePath()),
            instruction: "窗口出现后 3 秒内上拉进入最近任务，停留至少 3 秒，再返回原应用；等待探测自动结束。",
            error: null
        };
        var fullOutput;

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
            result.itemId = addInstruction(probeStartedAt);
            result.listShow = global.ClipHub.List.show({
                limit: 20, widthDp: 340, heightDp: 500
            });
            waitFor(function () {
                return global.ClipHub.Window.getState().attachedToWindow === true &&
                    global.ClipHub.Navigation.getState().registeredRootCount >= 1;
            }, 1800);

            activityManager = global.context.getSystemService(
                Context.ACTIVITY_SERVICE);
            initialNav = global.ClipHub.Navigation.getState();
            baselinePackage = String(initialNav.baselinePackage ||
                initialNav.lastTopPackage || "");
            result.baselinePackage = baselinePackage;
            result.initialNavigation = initialNav;

            samplingStartedAt = now();
            while (now() - samplingStartedAt < SAMPLE_DURATION_MS) {
                sample = buildSample(samplingStartedAt, activityManager);
                samples.push(sample);
                signature = compactSignature(sample);
                if (signature !== previousSignature) {
                    changes.push(sample);
                    previousSignature = signature;
                }
                Thread.sleep(SAMPLE_INTERVAL_MS);
            }
            finalNav = global.ClipHub.Navigation.getState();
            result.finalNavigation = finalNav;
            result.summary = summarize(samples, baselinePackage,
                initialNav, finalNav);
            result.changeTimeline = changes;
            result.ok = samples.length >= 30 && result.error === null;
        } catch (error) {
            result.error = String(error);
        } finally {
            try { global.ClipHub.App.stop("probe_031_complete"); }
            catch (ignoredStop) {}
            result.lockReleased = lockFree(isolated);
            removeTree(isolated);
            result.finishedAt = now();
            fullOutput = {
                result: result,
                samples: samples
            };
            write(outputFile, JSON.stringify(fullOutput, null, 2) + "\n");
        }
        return result;
    }

    global.ClipHubRecentTasksTimelineProbe031Result = main();
}((function () { return this; }())));

JSON.stringify(ClipHubRecentTasksTimelineProbe031Result);
