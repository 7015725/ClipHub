/*
 * ClipHub 全窗口共享几何真机探测 051
 * 环境：Android 14 / ShortX / Rhino ES5
 */
(function (global) {
    var File = Packages.java.io.File;
    var FIS = Packages.java.io.FileInputStream;
    var FOS = Packages.java.io.FileOutputStream;
    var BAOS = Packages.java.io.ByteArrayOutputStream;
    var ReflectArray = Packages.java.lang.reflect.Array;
    var JavaByte = Packages.java.lang.Byte;
    var JavaString = Packages.java.lang.String;
    var Thread = Packages.java.lang.Thread;
    var System = Packages.java.lang.System;
    var Intent = Packages.android.content.Intent;
    var Toast = Packages.android.widget.Toast;

    var PROBE = "cliphub_shared_window_geometry_probe_051";
    var PROBE_VERSION = 3;
    var SCENE_DURATION_MS = 9000;
    var HOME_GESTURE_TIMEOUT_MS = 25000;
    var EXPECTED_MODULE_SET = "20260724.06";
    var EXPECTED_SOURCE_REF = "agent/unify-window-geometry";
    var NAMES = [
        "ch_01_base.js", "ch_02_log.js", "ch_03_database.js",
        "ch_04_clipboard.js", "ch_05_classifier.js",
        "ch_06_repository.js", "ch_07_theme.js", "ch_08_window.js",
        "ch_09_list.js", "ch_10_editor.js", "ch_11_filter.js",
        "ch_12_translation.js", "ch_13_settings.js",
        "ch_14_event_bus.js", "ch_15_app.js"
    ];

    var result = {
        ok: false,
        probe: PROBE,
        probeVersion: PROBE_VERSION,
        startedAt: Number(System.currentTimeMillis()),
        moduleSetVersion: "",
        sourceRef: "",
        sceneDurationMs: SCENE_DURATION_MS,
        sceneCount: 6,
        visualScreenshotRequired: true,
        instruction: "每个场景保留完整悬浮窗、状态栏与窗口四角；场景1必须实际长按拖动和右下角缩放。",
        formalWasRunning: false,
        formalWasVisible: false,
        formalHide: null,
        formalRestore: null,
        fixtureIds: [],
        scenes: {},
        checks: {},
        outputPath: "",
        error: null
    };

    var rootDir = null;
    var formalDir = null;
    var probeDir = null;
    var moduleDir = null;
    var outputFile = null;
    var probeStarted = false;
    var originalGeometry = null;

    function closeQuietly(value) {
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
        if (!file.isDirectory() && !file.mkdirs() && !file.isDirectory()) {
            throw new Error("Cannot create directory: " +
                file.getAbsolutePath());
        }
        return file;
    }

    function removeTree(file) {
        var children;
        var index;
        if (file === null || !file.exists()) { return true; }
        if (file.isDirectory()) {
            children = file.listFiles();
            if (children !== null) {
                for (index = 0; index < children.length; index += 1) {
                    removeTree(children[index]);
                }
            }
        }
        try { return !file.exists() || file.delete(); }
        catch (ignored) { return false; }
    }

    function readBytes(stream) {
        var output = new BAOS();
        var buffer = ReflectArray.newInstance(JavaByte.TYPE, 8192);
        var count;
        try {
            while ((count = stream.read(buffer)) >= 0) {
                if (count > 0) { output.write(buffer, 0, count); }
            }
            return output.toByteArray();
        } finally {
            closeQuietly(stream);
            closeQuietly(output);
        }
    }

    function readUtf8(file) {
        return String(new JavaString(readBytes(new FIS(file)), "UTF-8"));
    }

    function writeUtf8(file, text) {
        var stream = null;
        ensureDir(file.getParentFile());
        try {
            stream = new FOS(file, false);
            stream.write(new JavaString(String(text)).getBytes("UTF-8"));
            stream.flush();
            return true;
        } finally { closeQuietly(stream); }
    }

    function readJson(file, fallback) {
        try { return file.isFile() ? JSON.parse(readUtf8(file)) : fallback; }
        catch (ignored) { return fallback; }
    }

    function sleep(ms) { Thread.sleep(Number(ms)); }

    function stamp() {
        var format = new Packages.java.text.SimpleDateFormat(
            "yyyyMMdd-HHmmss-SSS");
        return String(format.format(new Packages.java.util.Date()));
    }

    function contains(values, expected) {
        var index;
        values = values || [];
        for (index = 0; index < values.length; index += 1) {
            if (String(values[index]) === String(expected)) { return true; }
        }
        return false;
    }

    function near(a, b, tolerance) {
        return Math.abs(Number(a || 0) - Number(b || 0)) <=
            Number(tolerance || 2);
    }

    function loadModules() {
        var index;
        var file;
        global.ClipHub = {};
        for (index = 0; index < NAMES.length; index += 1) {
            file = new File(moduleDir, NAMES[index]);
            if (!file.isFile()) {
                throw new Error("Missing module: " + file.getAbsolutePath());
            }
            eval(readUtf8(file));
        }
    }

    function controlFormal(command) {
        var endpoint = readJson(new File(formalDir,
            "cache/control_endpoint.json"), null);
        var requestId;
        var ackFile;
        var intent;
        var deadline;
        if (!endpoint || !endpoint.action || !endpoint.token) {
            return { ok: false, skipped: true,
                error: "formal_control_endpoint_unavailable" };
        }
        requestId = PROBE + "_" + String(command) + "_" +
            String(System.currentTimeMillis());
        ackFile = new File(formalDir, "cache/control_ack_" +
            requestId.replace(/[^A-Za-z0-9._-]/g, "_") + ".json");
        try { if (ackFile.exists()) { ackFile.delete(); } }
        catch (ignoredDelete) {}
        intent = new Intent(String(endpoint.action));
        intent.putExtra("runtimeDir", String(endpoint.runtimeDir ||
            formalDir.getAbsolutePath()));
        intent.putExtra("command", String(command));
        intent.putExtra("requestId", requestId);
        intent.putExtra("controlToken", String(endpoint.token));
        global.context.sendBroadcast(intent);
        deadline = Number(System.currentTimeMillis()) + 3500;
        while (Number(System.currentTimeMillis()) < deadline) {
            if (ackFile.isFile()) {
                return readJson(ackFile,
                    { ok: false, error: "formal_control_ack_invalid" });
            }
            sleep(60);
        }
        return { ok: false, error: "formal_control_ack_timeout" };
    }

    function toast(text) {
        try {
            ClipHub.Window.runOnMain(function () {
                Toast.makeText(global.context, String(text),
                    Toast.LENGTH_LONG).show();
                return true;
            }, 2500);
        } catch (ignored) {}
    }

    function scene(index, title, instruction) {
        toast("场景" + String(index) + "：" + String(title) +
            "\n" + String(instruction));
    }

    function waitForHomeGestures(baseline) {
        var deadline = Number(System.currentTimeMillis()) +
            HOME_GESTURE_TIMEOUT_MS;
        var current = ClipHub.Window.getState();
        var dragSeen = false;
        var resizeSeen = false;
        var persisted = false;
        while (Number(System.currentTimeMillis()) < deadline) {
            dragSeen = Number(current.dragActivateCount || 0) >
                Number(baseline.dragActivateCount || 0);
            resizeSeen = Number(current.resizeActivateCount || 0) >
                Number(baseline.resizeActivateCount || 0);
            persisted = Number(current.geometryPersistCount || 0) >
                Number(baseline.geometryPersistCount || 0);
            if (dragSeen && resizeSeen && persisted) { break; }
            sleep(250);
            current = ClipHub.Window.getState();
        }
        return {
            completed: dragSeen && resizeSeen && persisted,
            timedOut: !(dragSeen && resizeSeen && persisted),
            dragSeen: dragSeen,
            resizeSeen: resizeSeen,
            persisted: persisted,
            waitedMs: HOME_GESTURE_TIMEOUT_MS - Math.max(0,
                deadline - Number(System.currentTimeMillis()))
        };
    }

    function ensureAdvancedVisible() {
        var panel = ClipHub.Filter.getPanelState();
        if (!panel || panel.advancedDrawerVisible !== true) {
            ClipHub.Filter.performAdvancedClick();
            sleep(450);
            panel = ClipHub.Filter.getPanelState();
        }
        return panel && panel.advancedDrawerVisible === true;
    }

    function snapshot(name) {
        var value = {
            at: Number(System.currentTimeMillis()),
            window: ClipHub.Window.getState(),
            filter: ClipHub.Filter.getPanelState(),
            editor: ClipHub.Editor.getState(),
            settings: ClipHub.Settings.getState(),
            detail: ClipHub.List.getDetailState(),
            translation: ClipHub.Translation.getState()
        };
        result.scenes[name] = value;
        return value;
    }

    function seedFixtures() {
        var rows = ClipHub.Repository.listItems({ limit: 10, offset: 0 });
        var ids = [];
        var index;
        var values;
        if (rows && rows.length >= 3) {
            for (index = 0; index < 3; index += 1) {
                ids.push(Number(rows[index].id));
            }
            return ids;
        }
        values = [
            {
                content: "ClipHub 共享窗口几何探测：详情与编辑窗口应继承同一位置和尺寸。",
                sourcePackage: "com.android.chrome",
                sourceLabel: "Chrome",
                sourceConfidence: 100,
                isPinned: true
            },
            {
                content: "https://github.com/7015725/ClipHub",
                sourcePackage: "com.openai.chatgpt",
                sourceLabel: "ChatGPT",
                sourceConfidence: 100
            },
            {
                content: "窄窗口筛选按钮与底部操作按钮不应发生遮挡。",
                sourcePackage: "com.android.settings",
                sourceLabel: "Android 系统",
                sourceConfidence: 100
            }
        ];
        for (index = 0; index < values.length; index += 1) {
            ids.push(Number(ClipHub.Repository.insertItem(values[index])));
        }
        return ids;
    }

    function forceCompactGeometry() {
        var env = ClipHub.Window.getEnvironment();
        var current = ClipHub.Settings.get("windowGeometry", null);
        var bucket = {
            xRatio: 0.5,
            yRatio: 0.5,
            widthRatio: Math.max(0.1,
                Math.min(1, 320 / Math.max(1, Number(env.widthDp)))),
            heightRatio: Math.max(0.1,
                Math.min(1, 600 / Math.max(1, Number(env.heightDp))))
        };
        var next = {
            version: 1,
            portrait: current && current.portrait ? current.portrait : bucket,
            landscape: current && current.landscape ? current.landscape : bucket
        };
        if (String(env.orientation) === "landscape") {
            next.landscape = bucket;
        } else {
            next.portrait = bucket;
        }
        ClipHub.Settings.set("windowGeometry", next);
        ClipHub.Window.refreshBounds("probe_compact_320dp");
        sleep(700);
        return next;
    }

    function closeProbeUi() {
        try { ClipHub.Translation.close("probe_cleanup"); }
        catch (ignoredTranslation) {}
        try { ClipHub.Settings.close("probe_cleanup"); }
        catch (ignoredSettings) {}
        try { ClipHub.Editor.close(); }
        catch (ignoredEditor) {}
        try { ClipHub.List.closeDetail(); }
        catch (ignoredDetail) {}
        try {
            ClipHub.Filter.closePanel({
                restoreList: false,
                reason: "probe_cleanup"
            });
        } catch (ignoredFilter) {}
    }

    function buildChecks(baseline) {
        var s1 = result.scenes.homeGesture || {};
        var s2 = result.scenes.compactAdvanced || {};
        var s3 = result.scenes.editorShared || {};
        var s4 = result.scenes.settingsShared || {};
        var s5 = result.scenes.detailShared || {};
        var s6 = result.scenes.translationShared || {};
        var g3 = s3.window && s3.window.geometry ? s3.window.geometry : {};
        var g4 = s4.window && s4.window.geometry ? s4.window.geometry : {};
        var g5 = s5.window && s5.window.geometry ? s5.window.geometry : {};
        var g6 = s6.window && s6.window.geometry ? s6.window.geometry : {};
        result.checks = {
            moduleSetExpected:
                result.moduleSetVersion === EXPECTED_MODULE_SET,
            sourceRefExpected:
                result.sourceRef === EXPECTED_SOURCE_REF,
            manualDragObserved:
                Number(s1.window && s1.window.dragActivateCount || 0) >
                    Number(baseline.dragActivateCount || 0),
            manualResizeObserved:
                Number(s1.window && s1.window.resizeActivateCount || 0) >
                    Number(baseline.resizeActivateCount || 0),
            geometryPersisted:
                Number(s1.window && s1.window.geometryPersistCount || 0) >
                    Number(baseline.geometryPersistCount || 0),
            compactWidthApplied:
                Number(s2.filter && s2.filter.panelWidthDp || 0) <= 340,
            compactAdvancedVisible:
                s2.filter && s2.filter.advancedDrawerVisible === true,
            compactFooterVisible:
                Number(s2.filter && s2.filter.drawerFooterHeightDp || 0) > 0,
            compactDrawerWithinWindow:
                Number(s2.filter && s2.filter.drawerWidthDp || 0) <=
                    Number(s2.filter && s2.filter.panelWidthDp || 0),
            editorRoleRegistered:
                contains(s3.window && s3.window.managedWindowRoles, "editor"),
            editorSizeSynced:
                near(s3.editor && s3.editor.panelWidthDp, g3.widthDp, 2) &&
                near(s3.editor && s3.editor.panelHeightDp, g3.heightDp, 2),
            settingsRoleRegistered:
                contains(s4.window && s4.window.managedWindowRoles, "settings"),
            settingsSizeSynced:
                near(s4.settings && s4.settings.panelWidthDp, g4.widthDp, 2) &&
                near(s4.settings && s4.settings.panelHeightDp, g4.heightDp, 2),
            detailRoleRegistered:
                contains(s5.window && s5.window.managedWindowRoles, "detail"),
            detailSizeSynced:
                near(s5.detail && s5.detail.windowWidthDp, g5.widthDp, 2) &&
                near(s5.detail && s5.detail.windowHeightDp, g5.heightDp, 2),
            translationRoleRegistered:
                contains(s6.window && s6.window.managedWindowRoles,
                    "translation"),
            translationSizeSynced:
                near(s6.translation && s6.translation.panelWidthDp,
                    g6.widthDp, 2) &&
                near(s6.translation && s6.translation.panelHeightDp,
                    g6.heightDp, 2),
            translationPanelAttached:
                s6.translation && s6.translation.attached === true,
            translationBusinessError:
                s6.translation ? s6.translation.lastError : null,
            homeGestureTimedOut:
                result.homeGestureWait &&
                result.homeGestureWait.timedOut === true,
            allScenesErrorFree:
                !(s1.window && s1.window.lastError) &&
                !(s2.window && s2.window.lastError) &&
                !(s3.window && s3.window.lastError) &&
                !(s4.window && s4.window.lastError) &&
                !(s5.window && s5.window.lastError) &&
                !(s6.window && s6.window.lastError) &&
                !(s2.filter && s2.filter.lastError) &&
                !(s3.editor && s3.editor.lastError) &&
                !(s4.settings && s4.settings.lastError) &&
                !(s5.detail && s5.detail.lastError)
        };
    }

    try {
        var manifest;
        var formalStatus;
        var app;
        var baseline;

        if (typeof shortx === "undefined" ||
                typeof shortx.getShortXDir !== "function") {
            throw new Error("ShortX runtime unavailable");
        }

        rootDir = new File(String(shortx.getShortXDir()));
        formalDir = new File(rootDir, "ClipHub");
        moduleDir = new File(formalDir, "modules");
        probeDir = new File(rootDir, "ClipHubProbe051");
        outputFile = new File(ensureDir(new File(formalDir, "probes")),
            PROBE + "_" + stamp() + ".json");
        result.outputPath = String(outputFile.getAbsolutePath());

        manifest = readJson(new File(formalDir,
            "cache/module-manifest.local.json"), null);
        if (!manifest) {
            throw new Error("ClipHub local manifest unavailable");
        }
        result.moduleSetVersion = String(manifest.moduleSetVersion || "");
        result.sourceRef = String(manifest.sourceRef || "");

        formalStatus = controlFormal("status");
        result.formalWasRunning = formalStatus && formalStatus.ok === true;
        result.formalWasVisible = formalStatus && formalStatus.status &&
            formalStatus.status.uiVisible === true;
        if (result.formalWasRunning) {
            result.formalHide = controlFormal("hide");
        }

        removeTree(probeDir);
        ensureDir(probeDir);
        loadModules();
        app = ClipHub.App.start({
            shortxRoot: String(rootDir.getAbsolutePath()),
            runtimeDir: String(probeDir.getAbsolutePath()),
            moduleDir: String(moduleDir.getAbsolutePath()),
            androidContext: global.context,
            entryVersion: 5,
            moduleSetVersion: result.moduleSetVersion,
            sourceRef: result.sourceRef
        });
        probeStarted = app && app.started === true;
        if (!probeStarted) { throw new Error("Probe runtime failed to start"); }

        result.fixtureIds = seedFixtures();
        originalGeometry = ClipHub.Settings.get("windowGeometry", null);

        ClipHub.Filter.showRoot({
            requestKeyboard: false,
            showAdvanced: false
        });
        sleep(700);
        baseline = ClipHub.Window.getState();

        scene(1, "首页手势",
            "长按顶部手柄拖动，再长按右下角双弧线缩放；检测完成后自动进入下一场景。");
        result.homeGestureWait = waitForHomeGestures(baseline);
        scene(1, result.homeGestureWait.completed ?
            "手势已识别" : "手势检测超时",
            result.homeGestureWait.completed ?
                "保持当前窗口，3秒后记录场景1。" :
                "未检测到完整拖动和缩放，3秒后仍会继续探测。");
        sleep(3000);
        snapshot("homeGesture");

        result.compactGeometry = forceCompactGeometry();
        result.advancedOpenedInitially = ensureAdvancedVisible();
        scene(2, "窄窗口高级筛选",
            "窗口约320dp宽；确认筛选、重置和应用筛选均未遮挡并截图。");
        sleep(SCENE_DURATION_MS - 900);
        result.advancedVisibleBeforeSnapshot = ensureAdvancedVisible();
        sleep(450);
        snapshot("compactAdvanced");
        ClipHub.Filter.handleBack();
        sleep(300);

        ClipHub.Editor.openNew({ requestKeyboard: false });
        sleep(500);
        scene(3, "编辑窗口共享几何",
            "编辑窗应继承首页位置和尺寸；可拖动或缩放编辑窗观察后层同步。");
        sleep(SCENE_DURATION_MS);
        snapshot("editorShared");
        ClipHub.Editor.close();
        sleep(350);

        ClipHub.Filter.performSettingsClick();
        sleep(600);
        scene(4, "设置窗口共享几何",
            "设置窗应继承相同位置和尺寸，右下角缩放标识一致。");
        sleep(SCENE_DURATION_MS);
        snapshot("settingsShared");
        ClipHub.Settings.close("probe_scene_complete");
        sleep(350);

        ClipHub.List.openDetail(Number(result.fixtureIds[0]));
        sleep(500);
        scene(5, "详情窗口共享几何",
            "详情窗应继承相同位置和尺寸，顶部拖动与右下角缩放可用。");
        sleep(SCENE_DURATION_MS);
        snapshot("detailShared");
        ClipHub.List.closeDetail();
        sleep(350);

        ClipHub.Translation.openForItem(Number(result.fixtureIds[0]));
        sleep(500);
        scene(6, "翻译窗口共享几何",
            "翻译窗应继承相同位置和尺寸；翻译失败不影响几何检查。");
        sleep(SCENE_DURATION_MS);
        snapshot("translationShared");

        buildChecks(baseline);
        result.ok = result.checks.moduleSetExpected &&
            result.checks.sourceRefExpected &&
            result.checks.manualDragObserved &&
            result.checks.manualResizeObserved &&
            result.checks.geometryPersisted &&
            !result.checks.homeGestureTimedOut &&
            result.checks.compactWidthApplied &&
            result.checks.compactAdvancedVisible &&
            result.checks.compactFooterVisible &&
            result.checks.compactDrawerWithinWindow &&
            result.checks.editorRoleRegistered &&
            result.checks.editorSizeSynced &&
            result.checks.settingsRoleRegistered &&
            result.checks.settingsSizeSynced &&
            result.checks.detailRoleRegistered &&
            result.checks.detailSizeSynced &&
            result.checks.translationRoleRegistered &&
            result.checks.translationPanelAttached &&
            result.checks.translationSizeSynced &&
            result.checks.allScenesErrorFree;
    } catch (error) {
        result.ok = false;
        result.error = errorText(error);
    } finally {
        try { closeProbeUi(); } catch (ignoredClose) {}
        if (originalGeometry !== null && originalGeometry !== undefined) {
            try {
                ClipHub.Settings.set("windowGeometry", originalGeometry);
                ClipHub.Window.refreshBounds("probe_restore_geometry");
            } catch (ignoredGeometry) {}
        }
        if (probeStarted) {
            try { ClipHub.App.stop("probe_finished"); }
            catch (ignoredStop) {}
        }
        try { removeTree(probeDir); } catch (ignoredRemove) {}
        if (result.formalWasRunning && result.formalWasVisible) {
            try { result.formalRestore = controlFormal("show"); }
            catch (restoreError) {
                result.formalRestore = {
                    ok: false,
                    error: errorText(restoreError)
                };
            }
        }
        result.finishedAt = Number(System.currentTimeMillis());
        result.durationMs = result.finishedAt - result.startedAt;
        try {
            if (outputFile !== null) {
                writeUtf8(outputFile,
                    JSON.stringify(result, null, 2) + "\n");
            }
        } catch (writeError) {
            result.outputWriteError = errorText(writeError);
        }
    }

    global.ClipHubSharedWindowGeometryProbe051Result = result;
}((function () { return this; }())));

JSON.stringify(ClipHubSharedWindowGeometryProbe051Result);
