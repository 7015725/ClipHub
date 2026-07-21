/* ClipHub visual screenshot review probe 023. Rhino ES5 only. */
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

    var REQUIRED_SET = "20260722.19";
    var RUNTIME_NAME = "ClipHubProbe023";
    var SCENE_DURATION_MS = 9000;
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
        while (now() - started < timeoutMs) {
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
            return { ok: false, error: "Formal ClipHub was not running" };
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
        waitFor(function () { return ackFile.isFile() && lockFree(runtimeDir); }, 3000);
        if (ackFile.isFile()) {
            try { ack = JSON.parse(read(ackFile)); } catch (ignoredAck) {}
            ackFile.delete();
        }
        return {
            ok: ack !== null && ack.ok === true && ack.stopped === true &&
                lockFree(runtimeDir) && !endpointFile.exists(),
            ackReceived: ack !== null,
            ack: ack,
            lockReleased: lockFree(runtimeDir),
            endpointRemoved: !endpointFile.exists(),
            error: ack === null ? "Control acknowledgement not received" : null
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
    function repeatText(prefix, count) {
        var parts = [];
        var index;
        for (index = 0; index < count; index += 1) {
            parts.push(String(prefix) + "-" + index);
        }
        return parts.join(" ");
    }
    function add(content, sensitive, pinned, sourceLabel, createdAt) {
        return Number(global.ClipHub.Repository.insertItem({
            content: String(content),
            contentType: "text",
            sourcePackage: "com.visual.review",
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
    function indexOfId(ids, id) {
        var index;
        for (index = 0; index < ids.length; index += 1) {
            if (Number(ids[index]) === Number(id)) { return index; }
        }
        return -1;
    }
    function closeSecondary() {
        try { global.ClipHub.Filter.closePanel(); } catch (ignoredFilter) {}
        try { global.ClipHub.Editor.close(); } catch (ignoredEditor) {}
        try { global.ClipHub.List.closeDetail(); } catch (ignoredDetail) {}
    }
    function setSceneStatus(index, title) {
        global.ClipHub.Window.setStatusText(
            "023  " + index + "/9  " + String(title) + "  ·  请截图");
    }
    function holdScene(result, key, index, title, checker) {
        var started = now();
        setSceneStatus(index, title);
        result.scenes[key] = {
            index: index,
            title: title,
            startedAt: started,
            ready: checker(),
            durationMs: SCENE_DURATION_MS
        };
        Thread.sleep(SCENE_DURATION_MS);
        result.scenes[key].finishedAt = now();
        return result.scenes[key].ready;
    }

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var formal = new File(root, "ClipHub");
        var modules = new File(formal, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var outputFile = new File(ensureDir(new File(formal, "probes")),
            "cliphub_visual_review_probe_023_" + stamp(startedAt) + ".json");
        var local = localManifest(formal);
        var boot;
        var stop;
        var shortId;
        var longId;
        var sensitiveId;
        var taggedId;
        var pinnedId;
        var tagOne;
        var tagTwo;
        var listState;
        var index;
        var baseTime = startedAt - 20000;
        var result = {
            ok: false,
            probe: "cliphub_visual_review_probe_023",
            probeVersion: 1,
            startedAt: startedAt,
            moduleSetVersion: local.moduleSetVersion || null,
            sourceRef: local.sourceRef || null,
            sceneDurationMs: SCENE_DURATION_MS,
            sceneCount: 9,
            visualScreenshotRequired: true,
            scenes: {},
            outputPath: String(outputFile.getAbsolutePath()),
            error: null
        };
        if (!local.present || local.moduleSetVersion !== REQUIRED_SET) {
            throw new Error("Installed module set must be " + REQUIRED_SET);
        }
        try {
            result.formalControl = stopFormal(global.context, formal);
            if (!result.formalControl.ok || !result.formalControl.ackReceived ||
                    String(result.formalControl.ack.threadName || "") !== "main") {
                throw new Error(result.formalControl.error || "Formal stop failed");
            }
            removeTree(isolated);
            boot = start(root, modules, isolated);
            result.firstStart = boot;
            result.schemaVersion = global.ClipHub.Database.getVersion();

            shortId = add("短文本视觉样例", false, false,
                "来源应用名称较长但仍需保持单行省略", baseTime + 1000);
            longId = add(repeatText("长文本视觉", 60), false, false,
                "Long Visual Source", baseTime + 2000);
            sensitiveId = add(repeatText("敏感视觉", 45) +
                "\n第二行\n第三行\n第四行", true, false,
                "Sensitive Visual", baseTime + 3000);
            taggedId = add("标签摘要与按钮密度视觉样例", false, false,
                "Tagged Visual Source", baseTime + 4000);
            pinnedId = add("置顶记录视觉样例", false, true,
                "Pinned Visual", baseTime + 5000);
            tagOne = Number(global.ClipHub.Repository.ensureTag("工作事项"));
            tagTwo = Number(global.ClipHub.Repository.ensureTag("较长的自定义标签名称"));
            global.ClipHub.Repository.attachTag(taggedId, tagOne);
            global.ClipHub.Repository.attachTag(taggedId, tagTwo);
            result.seededCount = global.ClipHub.Repository.countItems(false);
            result.tagCount = global.ClipHub.Repository.listTags().length;
            result.recordIdsCreated = [shortId, longId, sensitiveId, taggedId, pinnedId].length;

            closeSecondary();
            global.ClipHub.Settings.set("themeMode", "light", { cleanup: false });
            global.ClipHub.List.show({ limit: 20, widthDp: 280, heightDp: 360 });
            waitFor(function () {
                return global.ClipHub.Window.getState().attachedToWindow === true;
            }, 1500);
            holdScene(result, "lightNarrowList", 1, "亮色窄列表", function () {
                listState = global.ClipHub.List.getState();
                return listState.renderedCount === 5 &&
                    listState.reorderHandleCount === 5 &&
                    listState.renderedSensitiveMaskCount === 1;
            });

            global.ClipHub.List.hide(true);
            global.ClipHub.Settings.set("themeMode", "dark", { cleanup: false });
            global.ClipHub.List.show({ limit: 20, widthDp: 420, heightDp: 620 });
            waitFor(function () {
                return global.ClipHub.Window.getState().attachedToWindow === true;
            }, 1500);
            holdScene(result, "darkWideList", 2, "暗色宽列表", function () {
                return global.ClipHub.List.getState().renderedCount === 5;
            });

            setSceneStatus(3, "搜索与筛选窗口");
            global.ClipHub.Filter.showPanel({ requestKeyboard: false });
            waitFor(function () {
                return global.ClipHub.Filter.getPanelState().attachedToWindow === true;
            }, 1500);
            holdScene(result, "filterPanel", 3, "搜索与筛选窗口", function () {
                var panel = global.ClipHub.Filter.getPanelState();
                return panel.attachedToWindow === true && panel.tagChipCount === 2;
            });
            global.ClipHub.Filter.closePanel();

            global.ClipHub.Filter.setKeyword("长文本视觉");
            holdScene(result, "filterSummary", 4, "筛选摘要与单条结果", function () {
                var state = global.ClipHub.List.getState();
                return state.filterActive === true && state.renderedCount === 1 &&
                    String(state.filterSummary || "").indexOf("关键词") >= 0;
            });

            global.ClipHub.Filter.setKeyword("不会存在的视觉关键词");
            holdScene(result, "filteredEmpty", 5, "筛选空状态", function () {
                var state = global.ClipHub.List.getState();
                return state.filterActive === true && state.renderedCount === 0 &&
                    state.emptyVisible === true;
            });
            global.ClipHub.Filter.reset();

            listState = global.ClipHub.List.getState();
            index = indexOfId(listState.itemIds, shortId);
            global.ClipHub.List.performDeleteClick(index);
            waitFor(function () {
                return global.ClipHub.List.getState().undoAvailable === true;
            }, 1000);
            holdScene(result, "undoBar", 6, "删除后的撤销条", function () {
                var state = global.ClipHub.List.getState();
                return state.undoAvailable === true && state.renderedCount === 4;
            });
            global.ClipHub.List.performUndoClick();

            setSceneStatus(7, "新增编辑窗口");
            global.ClipHub.List.performAddClick();
            waitFor(function () {
                return global.ClipHub.Editor.getState().attachedToWindow === true;
            }, 1500);
            holdScene(result, "newEditor", 7, "新增编辑窗口", function () {
                var state = global.ClipHub.Editor.getState();
                return state.mode === "new" && state.attachedToWindow === true &&
                    state.inputPresent === true;
            });
            global.ClipHub.Editor.performCancelClick();

            listState = global.ClipHub.List.getState();
            index = indexOfId(listState.itemIds, taggedId);
            setSceneStatus(8, "标签管理窗口");
            global.ClipHub.List.performTagClick(index);
            waitFor(function () {
                return global.ClipHub.Editor.getState().attachedToWindow === true;
            }, 1500);
            holdScene(result, "tagEditor", 8, "标签管理窗口", function () {
                var state = global.ClipHub.Editor.getState();
                return state.mode === "tags" && state.tagOptionCount === 2 &&
                    state.attachedTagCount === 2;
            });
            global.ClipHub.Editor.performCancelClick();

            listState = global.ClipHub.List.getState();
            index = indexOfId(listState.itemIds, longId);
            setSceneStatus(9, "长文本详情窗口");
            global.ClipHub.List.performDetailClick(index);
            waitFor(function () {
                return global.ClipHub.List.getDetailState().attachedToWindow === true;
            }, 1500);
            holdScene(result, "longDetail", 9, "长文本详情窗口", function () {
                var state = global.ClipHub.List.getDetailState();
                return state.attachedToWindow === true && state.scrollable === true &&
                    state.textSelectable === true;
            });
            global.ClipHub.List.performDetailCloseClick();

            result.allScenesReady = result.scenes.lightNarrowList.ready === true &&
                result.scenes.darkWideList.ready === true &&
                result.scenes.filterPanel.ready === true &&
                result.scenes.filterSummary.ready === true &&
                result.scenes.filteredEmpty.ready === true &&
                result.scenes.undoBar.ready === true &&
                result.scenes.newEditor.ready === true &&
                result.scenes.tagEditor.ready === true &&
                result.scenes.longDetail.ready === true;
            global.ClipHub.List.hide(true);
            stop = global.ClipHub.App.stop("probe023_done");
            result.firstStopped = stop.stopped === true;
            result.firstDatabaseClosed = !global.ClipHub.Database.isOpen();
        } catch (error) {
            result.error = errorText(error);
            try { global.ClipHub.App.stop("probe023_error"); }
            catch (ignoredStop) {}
        } finally {
            try {
                result.formalRestart = lockFree(formal) ?
                    start(root, modules, formal) :
                    { ok: true, started: true, reused: true };
            } catch (restartError) {
                if (result.error === null) {
                    result.error = "Formal restart failed: " + errorText(restartError);
                }
            }
            result.cleanup = removeTree(isolated);
            result.finishedAt = now();
            result.durationMs = result.finishedAt - result.startedAt;
            result.ok = result.error === null && result.formalControl &&
                result.formalControl.ok === true && result.firstStart &&
                result.firstStart.ok === true && result.schemaVersion === 2 &&
                result.seededCount === 5 && result.tagCount === 2 &&
                result.recordIdsCreated === 5 && result.allScenesReady === true &&
                result.firstStopped === true && result.firstDatabaseClosed === true &&
                result.formalRestart && result.formalRestart.ok === true &&
                result.cleanup === true;
            write(outputFile, JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try {
        global.ClipHubVisualReviewProbe023Result = main();
    } catch (error) {
        global.ClipHubVisualReviewProbe023Result = {
            ok: false,
            probe: "cliphub_visual_review_probe_023",
            probeVersion: 1,
            fatal: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubVisualReviewProbe023Result);
