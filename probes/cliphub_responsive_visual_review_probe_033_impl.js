/* ClipHub responsive visual review probe 033 implementation. Rhino ES5 only. */
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

    var REQUIRED_SET = "20260722.25";
    var RUNTIME_NAME = "ClipHubProbe033";
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
        requestId = stamp(now()) + "-" + Number(Thread.currentThread().getId());
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
        return {
            ok: ack !== null && ack.ok === true && ack.stopped === true &&
                lockFree(runtimeDir) && !endpointFile.exists(),
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

    function add(content, sensitive, pinned, sourceLabel, createdAt) {
        return Number(global.ClipHub.Repository.insertItem({
            content: String(content),
            contentType: "text",
            sourcePackage: "com.visual.probe033",
            sourceLabel: String(sourceLabel),
            sourceUid: 10000,
            sourceConfidence: 100,
            isSensitive: sensitive === true,
            isPinned: pinned === true,
            createdAt: Number(createdAt),
            lastCopiedAt: Number(createdAt),
            updatedAt: Number(createdAt)
        }));
    }

    function repeatText(prefix, count) {
        var output = [];
        var index;
        for (index = 0; index < count; index += 1) {
            output.push(String(prefix) + "-" + index);
        }
        return output.join(" ");
    }

    function indexOfId(ids, id) {
        var index;
        for (index = 0; index < ids.length; index += 1) {
            if (Number(ids[index]) === Number(id)) { return index; }
        }
        return -1;
    }

    function windowInsideSafeBounds(state) {
        var bounds;
        if (!state || state.attachedToWindow !== true) { return false; }
        bounds = state.safeBounds || {};
        return Number(state.x) >= Number(bounds.left || 0) &&
            Number(state.y) >= Number(bounds.top || 0) &&
            Number(state.x) + Number(state.width) <=
                Number(bounds.right || 0) &&
            Number(state.y) + Number(state.height) <=
                Number(bounds.bottom || 0);
    }

    function captureState() {
        var windowState = global.ClipHub.Window.getState();
        var listState = global.ClipHub.List.getState();
        var detailState = global.ClipHub.List.getDetailState();
        var watchState = global.ClipHub.RecentsWatch &&
            global.ClipHub.RecentsWatch.getState ?
            global.ClipHub.RecentsWatch.getState() : null;
        return {
            window: windowState,
            list: listState,
            detail: detailState,
            recentsWatch: watchState,
            insideSafeBounds: windowState.attachedToWindow === true ?
                windowInsideSafeBounds(windowState) :
                detailState.attachedToWindow === true,
            noWindowError: windowState.lastError === null,
            noListError: listState.lastError === null
        };
    }

    function runScene(result, key, index, title, prepare,
            readyCheck, cleanup) {
        var scene = {
            index: index,
            title: title,
            startedAt: now(),
            ready: false,
            durationMs: SCENE_DURATION_MS,
            capture: null,
            finishedAt: null
        };
        result.scenes[key] = scene;
        prepare();
        scene.ready = waitFor(readyCheck, 1800);
        scene.capture = captureState();
        showToast("033  " + index + "/5  " + title + "  ·  请截图");
        Thread.sleep(SCENE_DURATION_MS);
        if (cleanup) { cleanup(); }
        scene.finishedAt = now();
        return scene.ready;
    }

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var formal = new File(root, "ClipHub");
        var modules = new File(formal, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var outputFile = new File(ensureDir(new File(formal, "probes")),
            "cliphub_responsive_visual_review_probe_033_" +
                stamp(startedAt) + ".json");
        var local = localManifest(formal);
        var baseTime = startedAt - 10000;
        var formalWasRunning = !lockFree(formal);
        var longId;
        var taggedId;
        var tagOne;
        var tagTwo;
        var listState;
        var listIndex;
        var result = {
            ok: false,
            probe: "cliphub_responsive_visual_review_probe_033",
            probeVersion: 1,
            startedAt: startedAt,
            moduleSetVersion: local.moduleSetVersion || null,
            sourceRef: local.sourceRef || null,
            sceneDurationMs: SCENE_DURATION_MS,
            sceneCount: 5,
            visualScreenshotRequired: true,
            manualRotationAndMultiWindowRequired: true,
            formalWasRunning: formalWasRunning,
            visualReviewChecklist: [
                "标题区高度、关闭按钮尺寸和拖动热区",
                "卡片正文、元数据、标签和操作区间距",
                "窄宽度下按钮是否挤压、截断或换行异常",
                "长文本详情是否不透明、可滚动且底部按钮完整",
                "折叠窗口是否位于安全区内且不存在透明触摸层"
            ],
            scenes: {},
            outputPath: String(outputFile.getAbsolutePath()),
            error: null
        };
        var allBoundsSafe = true;
        var key;

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
            result.schemaVersion = global.ClipHub.Database.getVersion();
            result.clipboardListenerStopped =
                global.ClipHub.Clipboard.stop().running === false;

            add("短文本卡片，用于观察正文、元数据与操作区之间的间距。",
                false, false,
                "来源应用名称较长用于检查元数据独立一行是否可读",
                baseTime + 1000);
            longId = add(repeatText("长文本详情视觉", 70) +
                "\n第二段用于观察滚动、换行、底部留白和按钮区域。",
                false, false, "Long Detail Visual Source",
                baseTime + 2000);
            add(repeatText("敏感内容视觉", 35) +
                "\n第二行\n第三行\n第四行", true, false,
                "Sensitive Visual Source", baseTime + 3000);
            taggedId = add("标签、置顶和操作按钮密度视觉样例",
                false, true, "Tagged Pinned Visual Source",
                baseTime + 4000);
            tagOne = Number(global.ClipHub.Repository.ensureTag("工作事项"));
            tagTwo = Number(global.ClipHub.Repository.ensureTag(
                "较长的自定义标签名称"));
            global.ClipHub.Repository.attachTag(taggedId, tagOne);
            global.ClipHub.Repository.attachTag(taggedId, tagTwo);
            result.seededCount = global.ClipHub.Repository.countItems(false);
            result.tagCount = global.ClipHub.Repository.listTags().length;

            runScene(result, "darkUltraNarrowList", 1,
                "暗色超窄列表 250dp",
                function () {
                    try { global.ClipHub.List.hide(true); }
                    catch (ignoredHide) {}
                    global.ClipHub.Settings.set("themeMode", "dark",
                        { cleanup: false });
                    global.ClipHub.List.show({
                        limit: 20, widthDp: 250, heightDp: 500
                    });
                },
                function () {
                    var state = global.ClipHub.List.getState();
                    return global.ClipHub.Window.getState()
                        .attachedToWindow === true &&
                        state.renderedCount === 4 &&
                        state.metaRowCount === 4 &&
                        state.actionRowCount === 4 &&
                        state.reorderHandleCount === 4 &&
                        state.renderedSensitiveMaskCount === 1;
                }, null);

            runScene(result, "lightStandardList", 2,
                "亮色标准列表 340dp",
                function () {
                    global.ClipHub.List.hide(true);
                    global.ClipHub.Settings.set("themeMode", "light",
                        { cleanup: false });
                    global.ClipHub.List.show({
                        limit: 20, widthDp: 340, heightDp: 540
                    });
                },
                function () {
                    var state = global.ClipHub.List.getState();
                    return global.ClipHub.Window.getState()
                        .attachedToWindow === true &&
                        state.renderedCount === 4 &&
                        state.renderedTagLabelCount === 1 &&
                        state.detailButtonCount >= 2;
                }, null);

            runScene(result, "darkWideList", 3,
                "暗色宽列表 440dp",
                function () {
                    global.ClipHub.List.hide(true);
                    global.ClipHub.Settings.set("themeMode", "dark",
                        { cleanup: false });
                    global.ClipHub.List.show({
                        limit: 20, widthDp: 440, heightDp: 560
                    });
                },
                function () {
                    var state = global.ClipHub.List.getState();
                    return global.ClipHub.Window.getState()
                        .attachedToWindow === true &&
                        state.renderedCount === 4 &&
                        state.metaRowCount === 4 &&
                        state.actionRowCount === 4;
                }, null);

            runScene(result, "darkLongDetail", 4,
                "暗色长文本详情",
                function () {
                    global.ClipHub.List.hide(true);
                    global.ClipHub.Settings.set("themeMode", "dark",
                        { cleanup: false });
                    global.ClipHub.List.show({
                        limit: 20, widthDp: 340, heightDp: 560
                    });
                    waitFor(function () {
                        return global.ClipHub.List.getState()
                            .renderedCount === 4;
                    }, 1200);
                    global.ClipHub.List.refresh();
                    listState = global.ClipHub.List.getState();
                    listIndex = indexOfId(listState.itemIds, longId);
                    if (listIndex < 0) {
                        throw new Error("Long detail fixture not found");
                    }
                    global.ClipHub.List.performDetailClick(listIndex);
                },
                function () {
                    var state = global.ClipHub.List.getDetailState();
                    return state.attachedToWindow === true &&
                        Number(state.itemId) === Number(longId) &&
                        state.modal === true && state.opaque === true &&
                        state.dimFlagPresent === true &&
                        state.mainWindowHidden === true &&
                        state.scrollable === true &&
                        state.copyButtonPresent === true &&
                        state.editButtonPresent === true &&
                        state.closeButtonPresent === true;
                },
                function () {
                    global.ClipHub.List.performDetailCloseClick();
                });

            runScene(result, "lightCollapsedBottomRight", 5,
                "亮色折叠并夹紧右下角",
                function () {
                    try { global.ClipHub.List.hide(true); }
                    catch (ignoredHide2) {}
                    global.ClipHub.Settings.set("themeMode", "light",
                        { cleanup: false });
                    global.ClipHub.List.show({
                        limit: 20, widthDp: 340, heightDp: 540
                    });
                    waitFor(function () {
                        return global.ClipHub.Window.getState()
                            .attachedToWindow === true;
                    }, 1000);
                    global.ClipHub.Window.setCollapsed(true);
                    global.ClipHub.Window.moveTo(999999, 999999,
                        { persist: false });
                },
                function () {
                    var state = global.ClipHub.Window.getState();
                    return state.attachedToWindow === true &&
                        state.collapsed === true &&
                        windowInsideSafeBounds(state);
                },
                function () {
                    try { global.ClipHub.Window.setCollapsed(false); }
                    catch (ignoredExpand) {}
                });

            result.allScenesReady = true;
            for (key in result.scenes) {
                if (result.scenes.hasOwnProperty(key)) {
                    if (result.scenes[key].ready !== true) {
                        result.allScenesReady = false;
                    }
                    if (!result.scenes[key].capture ||
                            result.scenes[key].capture.insideSafeBounds !== true) {
                        allBoundsSafe = false;
                    }
                }
            }
            result.allSceneBoundsSafe = allBoundsSafe;
            result.finalListClose = global.ClipHub.List.hide(true);
            result.stop = global.ClipHub.App.stop("probe033_visual");
            result.databaseClosed = !global.ClipHub.Database.isOpen();
        } catch (error) {
            result.error = errorText(error);
            try { global.ClipHub.App.stop("probe033_error"); }
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
            result.ok = result.error === null && result.start &&
                result.start.ok === true && result.schemaVersion === 2 &&
                result.clipboardListenerStopped === true &&
                result.seededCount === 4 && result.tagCount === 2 &&
                result.allScenesReady === true &&
                result.allSceneBoundsSafe === true &&
                result.finalListClose === true && result.stop &&
                result.stop.stopped === true &&
                result.databaseClosed === true && result.formalRestart &&
                result.formalRestart.ok === true && result.cleanup === true;
            write(outputFile, JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try {
        global.ClipHubResponsiveVisualReviewProbe033Result = main();
    } catch (error) {
        global.ClipHubResponsiveVisualReviewProbe033Result = {
            ok: false,
            probe: "cliphub_responsive_visual_review_probe_033",
            probeVersion: 1,
            fatal: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubResponsiveVisualReviewProbe033Result);
