/* ClipHub compact secondary-window visual review probe 026. Rhino ES5 only. */
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

    var REQUIRED_SET = "20260722.20";
    var RUNTIME_NAME = "ClipHubProbe026";
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
            return { ok: false, error: "Formal ClipHub was not running" };
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
        }, 3000);
        if (ackFile.isFile()) {
            try { ack = JSON.parse(read(ackFile)); }
            catch (ignoredAck) {}
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
    function showToast(text) {
        try {
            Toast.makeText(global.context, String(text), Toast.LENGTH_LONG).show();
        } catch (ignored) {}
    }
    function add(content, sourceLabel, createdAt) {
        return Number(global.ClipHub.Repository.insertItem({
            content: String(content),
            contentType: "text",
            sourcePackage: "com.visual.probe026",
            sourceLabel: String(sourceLabel),
            sourceUid: 10000,
            sourceConfidence: 100,
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
    function runScene(result, key, index, title, prepare, readyCheck, cleanup) {
        var scene = {
            index: index,
            title: title,
            startedAt: now(),
            ready: false,
            durationMs: SCENE_DURATION_MS,
            finishedAt: null
        };
        result.scenes[key] = scene;
        prepare();
        scene.ready = waitFor(readyCheck, 1500);
        showToast("026  " + index + "/3  " + title + "  ·  请截图");
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
            "cliphub_visual_review_probe_026_" + stamp(startedAt) + ".json");
        var local = localManifest(formal);
        var baseTime = startedAt - 10000;
        var taggedId;
        var tagOne;
        var tagTwo;
        var listIndex;
        var listState;
        var stop;
        var result = {
            ok: false,
            probe: "cliphub_visual_review_probe_026",
            probeVersion: 1,
            startedAt: startedAt,
            moduleSetVersion: local.moduleSetVersion || null,
            sourceRef: local.sourceRef || null,
            sceneDurationMs: SCENE_DURATION_MS,
            sceneCount: 3,
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
            if (!result.formalControl.ok ||
                    !result.formalControl.ackReceived ||
                    String(result.formalControl.ack.threadName || "") !== "main") {
                throw new Error(result.formalControl.error || "Formal stop failed");
            }
            removeTree(isolated);
            result.firstStart = start(root, modules, isolated);
            result.schemaVersion = global.ClipHub.Database.getVersion();
            result.clipboardListenerStopped =
                global.ClipHub.Clipboard.stop().running === false;
            global.ClipHub.Settings.set("themeMode", "dark", { cleanup: false });

            add("普通视觉样例", "Android 系统", baseTime + 1000);
            add("alpha search sample", "ASCII Source", baseTime + 2000);
            taggedId = add("标签窗口视觉样例", "Tagged Source", baseTime + 3000);
            tagOne = Number(global.ClipHub.Repository.ensureTag("工作事项"));
            tagTwo = Number(global.ClipHub.Repository.ensureTag(
                "较长的自定义标签名称"));
            global.ClipHub.Repository.attachTag(taggedId, tagOne);
            global.ClipHub.Repository.attachTag(taggedId, tagTwo);
            result.seededCount = global.ClipHub.Repository.countItems(false);
            result.tagCount = global.ClipHub.Repository.listTags().length;

            global.ClipHub.List.show({ limit: 20, widthDp: 340, heightDp: 470 });
            result.listAttached = waitFor(function () {
                return global.ClipHub.Window.getState().attachedToWindow === true;
            }, 1500);

            runScene(result, "filterPanel", 1, "搜索与筛选窗口",
                function () {
                    global.ClipHub.Filter.reset({ apply: true });
                    global.ClipHub.Filter.showPanel({ requestKeyboard: false });
                },
                function () {
                    var state = global.ClipHub.Filter.getPanelState();
                    return state.attachedToWindow === true &&
                        state.modalWindow === true &&
                        state.opaqueBackground === true;
                },
                function () { global.ClipHub.Filter.closePanel(); });

            runScene(result, "newEditor", 2, "新增编辑窗口",
                function () {
                    global.ClipHub.Editor.openNew();
                    global.ClipHub.Editor.setInputText(
                        "用于检查输入框高度、留白、关闭入口与保存按钮的视觉样例");
                },
                function () {
                    var state = global.ClipHub.Editor.getState();
                    return state.attachedToWindow === true &&
                        state.mode === "new" && state.modalWindow === true &&
                        state.opaqueBackground === true;
                },
                function () { global.ClipHub.Editor.performCancelClick(); });

            listState = global.ClipHub.List.getState();
            listIndex = indexOfId(listState.itemIds, taggedId);
            runScene(result, "tagEditor", 3, "标签管理窗口",
                function () {
                    global.ClipHub.List.performTagClick(listIndex);
                },
                function () {
                    var state = global.ClipHub.Editor.getState();
                    return state.attachedToWindow === true &&
                        state.mode === "tags" &&
                        Number(state.itemId) === Number(taggedId) &&
                        state.tagOptionCount === 2 &&
                        state.modalWindow === true &&
                        state.opaqueBackground === true;
                },
                function () { global.ClipHub.Editor.performCancelClick(); });

            result.allScenesReady =
                result.scenes.filterPanel.ready === true &&
                result.scenes.newEditor.ready === true &&
                result.scenes.tagEditor.ready === true;
            global.ClipHub.List.hide(true);
            stop = global.ClipHub.App.stop("probe026_visual_review");
            result.firstStopped = stop.stopped === true;
            result.firstDatabaseClosed = !global.ClipHub.Database.isOpen();
        } catch (error) {
            result.error = errorText(error);
            try { global.ClipHub.App.stop("probe026_error"); }
            catch (ignoredStop) {}
        } finally {
            try {
                result.formalRestart = lockFree(formal) ?
                    start(root, modules, formal) :
                    { ok: true, started: true, reused: true };
            } catch (restartError) {
                if (result.error === null) {
                    result.error = "Formal restart failed: " +
                        errorText(restartError);
                }
            }
            result.cleanup = removeTree(isolated);
            result.finishedAt = now();
            result.durationMs = result.finishedAt - result.startedAt;
            result.ok = result.error === null &&
                result.formalControl && result.formalControl.ok === true &&
                result.firstStart && result.firstStart.ok === true &&
                result.schemaVersion === 2 &&
                result.clipboardListenerStopped === true &&
                result.seededCount === 3 && result.tagCount === 2 &&
                result.listAttached === true &&
                result.allScenesReady === true &&
                result.firstStopped === true &&
                result.firstDatabaseClosed === true &&
                result.formalRestart && result.formalRestart.ok === true &&
                result.cleanup === true;
            write(outputFile, JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try {
        global.ClipHubVisualReviewProbe026Result = main();
    } catch (error) {
        global.ClipHubVisualReviewProbe026Result = {
            ok: false,
            probe: "cliphub_visual_review_probe_026",
            probeVersion: 1,
            fatal: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubVisualReviewProbe026Result);
