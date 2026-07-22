/* ClipHub corrected home UI probe 034 implementation. Rhino ES5 only. */
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

    var REQUIRED_SET = "20260722.27";
    var RUNTIME_NAME = "ClipHubProbe034";
    var SCREENSHOT_DURATION_MS = 18000;
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
            try {
                value.close();
            } catch (ignored) {}
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
        if (!file.exists()) {
            return true;
        }
        if (file.isDirectory()) {
            children = file.listFiles();
            if (children !== null) {
                for (index = 0; index < children.length; index += 1) {
                    if (!removeTree(children[index])) {
                        ok = false;
                    }
                }
            }
        }
        if (file.exists() && !file.delete()) {
            ok = false;
        }
        return ok;
    }

    function waitFor(callback, timeoutMs) {
        var started = now();
        while (now() - started < Number(timeoutMs || 0)) {
            if (callback()) {
                return true;
            }
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
                try {
                    lock.release();
                } catch (ignored) {}
            }
            close(channel);
            close(raf);
        }
    }

    function localManifest(runtimeDir) {
        var file = new File(new File(runtimeDir, "cache"),
            "module-manifest.local.json");
        var data;
        if (!file.isFile()) {
            return { present: false };
        }
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
            return {
                ok: false,
                error: "Formal control endpoint is missing"
            };
        }

        endpoint = JSON.parse(read(endpointFile));
        requestId = stamp(now()) + "-" +
            Number(Thread.currentThread().getId());
        ackFile = new File(cacheDir,
            "control_ack_" + requestId + ".json");
        if (ackFile.exists()) {
            ackFile.delete();
        }

        intent = new Intent(String(endpoint.action));
        intent.putExtra("runtimeDir",
            String(runtimeDir.getAbsolutePath()));
        intent.putExtra("command", "stop");
        intent.putExtra("requestId", requestId);
        intent.putExtra("controlToken", String(endpoint.token));
        context.sendBroadcast(intent);

        waitFor(function () {
            return ackFile.isFile() && lockFree(runtimeDir);
        }, 3500);

        if (ackFile.isFile()) {
            try {
                ack = JSON.parse(read(ackFile));
            } catch (ignoredAck) {}
            ackFile.delete();
        }

        return {
            ok: ack !== null &&
                ack.ok === true &&
                ack.stopped === true &&
                lockFree(runtimeDir) &&
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
            sourcePackage: String(sourcePackage ||
                "com.cliphub.probe034"),
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

    function insideSafeBounds(state) {
        var bounds = state.safeBounds || {};
        return state.attachedToWindow === true &&
            Number(state.x) >= Number(bounds.left || 0) &&
            Number(state.y) >= Number(bounds.top || 0) &&
            Number(state.x) + Number(state.width) <=
                Number(bounds.right || 0) &&
            Number(state.y) + Number(state.height) <=
                Number(bounds.bottom || 0);
    }

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var formal = new File(root, "ClipHub");
        var modules = new File(formal, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var outputFile = new File(
            ensureDir(new File(formal, "probes")),
            "cliphub_new_home_ui_probe_034_" +
                stamp(startedAt) + ".json");
        var local = localManifest(formal);
        var formalWasRunning = !lockFree(formal);
        var baseTime = startedAt - 20000;
        var ids = [];
        var pinnedId;
        var tagWork;
        var tagDev;
        var windowState;
        var listState;
        var navigationState;
        var density = Number(global.context.getResources()
            .getDisplayMetrics().density || 1);
        var result = {
            ok: false,
            probe: "cliphub_new_home_ui_probe_034",
            probeVersion: 1,
            moduleSetVersion: local.moduleSetVersion || null,
            sourceRef: local.sourceRef || null,
            screenshotDurationMs: SCREENSHOT_DURATION_MS,
            visualScreenshotRequired: true,
            instruction: "显示首页第二轮校正版后，请截取一张未裁剪原始截图。",
            outputPath: String(outputFile.getAbsolutePath()),
            formalWasRunning: formalWasRunning,
            startedAt: startedAt,
            error: null
        };

        try {
            if (!local.present ||
                    local.moduleSetVersion !== REQUIRED_SET) {
                throw new Error(
                    "Installed module set must be " + REQUIRED_SET);
            }

            result.formalControl =
                stopFormal(global.context, formal);
            if (!result.formalControl.ok) {
                throw new Error(
                    result.formalControl.error ||
                    "Formal stop failed");
            }

            removeTree(isolated);
            result.start = start(root, modules, isolated);
            result.themeModuleVersion =
                Number(global.ClipHub.Theme.MODULE_VERSION);
            result.windowModuleVersion =
                Number(global.ClipHub.Window.MODULE_VERSION);
            result.listModuleVersion =
                Number(global.ClipHub.List.MODULE_VERSION);
            result.schemaVersion =
                Number(global.ClipHub.Database.getVersion());
            result.clipboardListenerStopped =
                global.ClipHub.Clipboard.stop().running === false;

            global.ClipHub.Settings.set(
                "themeMode", "light", { cleanup: false });

            ids.push(add("https://developer.android.com/",
                "url", "com.android.chrome", "Chrome 浏览器",
                false, false, baseTime + 1000));
            ids.push(add(
                "会议在明天下午三点，地点是B栋会议室，请准时参加。",
                "text", "com.tencent.mm", "微信",
                false, false, baseTime + 2000));
            pinnedId = add("+86 138 0013 8000",
                "phone", "com.android.contacts", "联系人",
                false, true, baseTime + 3000);
            ids.push(pinnedId);
            ids.push(add("design.team@example.com",
                "email", "com.google.android.gm", "Gmail",
                false, false, baseTime + 4000));
            ids.push(add(
                "var greet = function (name) { return 'Hello, ' + name; };",
                "text", "com.termux", "Termux",
                false, false, baseTime + 5000));
            ids.push(add(
                "Android 14 引入了对预测性返回动画的支持，提升了用户体验和应用流畅度。",
                "text", "com.google.android.apps.docs", "文档",
                false, false, baseTime + 6000));

            tagWork = Number(
                global.ClipHub.Repository.ensureTag("工作"));
            tagDev = Number(
                global.ClipHub.Repository.ensureTag("开发资源"));
            global.ClipHub.Repository.attachTag(ids[0], tagDev);
            global.ClipHub.Repository.attachTag(ids[1], tagWork);
            global.ClipHub.Repository.attachTag(pinnedId, tagWork);

            result.seededCount = Number(
                global.ClipHub.Repository.countItems(false));
            result.tagCount = Number(
                global.ClipHub.Repository.listTags().length);

            result.show = global.ClipHub.List.show({
                limit: 20,
                widthDp: 340,
                heightDp: 560
            });

            result.homeReady = waitFor(function () {
                var state = global.ClipHub.List.getState();
                return global.ClipHub.Window.getState()
                    .attachedToWindow === true &&
                    state.renderedCount === 6 &&
                    state.homeStyle === "reference_home_v2" &&
                    state.toolbarActionCount === 5;
            }, 1800);

            result.selectionClick =
                global.ClipHub.List.performSelectClick(2);
            waitFor(function () {
                var state = global.ClipHub.List.getState();
                return state.selectedCount === 1 &&
                    state.selectionMode === true;
            }, 1000);

            windowState = global.ClipHub.Window.getState();
            listState = global.ClipHub.List.getState();
            navigationState =
                global.ClipHub.Navigation.getState();

            result.windowState = windowState;
            result.listState = listState;
            result.navigationState = navigationState;
            result.windowWidthDp =
                Math.round(Number(windowState.width) / density);
            result.windowHeightDp =
                Math.round(Number(windowState.height) / density);
            result.windowInsideSafeBounds =
                insideSafeBounds(windowState);
            result.selectionDidNotCopy =
                Number(listState.copyCount) === 0 &&
                listState.lastCopiedId === null;

            result.requiredUiPresent =
                listState.searchButtonPresent === true &&
                listState.filterButtonPresent === true &&
                listState.addButtonPresent === true &&
                listState.manageButtonPresent === true &&
                listState.headerPinButtonPresent === true &&
                listState.headerSettingsButtonPresent === true &&
                listState.sourceIconCount === 6 &&
                listState.toolbarActionCount === 5 &&
                listState.cardMoreButtonCount === 6 &&
                listState.selectedCount === 1 &&
                listState.selectionMode === true;

            showToast("034  首页第二轮校正版  ·  请截图");
            Thread.sleep(SCREENSHOT_DURATION_MS);

            result.finalListClose =
                global.ClipHub.List.hide(true);
            result.stop =
                global.ClipHub.App.stop("probe034_home_ui");
            result.databaseClosed =
                !global.ClipHub.Database.isOpen();
        } catch (error) {
            result.error = errorText(error);
            try {
                global.ClipHub.App.stop("probe034_error");
            } catch (ignoredStop) {}
        } finally {
            try {
                if (formalWasRunning) {
                    result.formalRestart =
                        lockFree(formal) ?
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
                    result.error =
                        "Formal restart failed: " +
                        errorText(restartError);
                }
            }

            result.cleanup = removeTree(isolated);
            result.finishedAt = now();
            result.durationMs =
                result.finishedAt - result.startedAt;
            result.ok =
                result.error === null &&
                result.start &&
                result.start.ok === true &&
                result.schemaVersion === 2 &&
                result.themeModuleVersion === 2 &&
                result.windowModuleVersion === 5 &&
                result.listModuleVersion === 11 &&
                result.clipboardListenerStopped === true &&
                result.seededCount === 6 &&
                result.tagCount === 2 &&
                result.homeReady === true &&
                result.windowInsideSafeBounds === true &&
                result.requiredUiPresent === true &&
                result.selectionDidNotCopy === true &&
                result.windowWidthDp >= 380 &&
                result.windowHeightDp >= 680 &&
                result.windowState &&
                result.windowState.dragHandlePresent === true &&
                result.windowState.sheetStyle === "bottom_sheet" &&
                Number(result.windowState.dimAmount) >= 0.43 &&
                result.listState &&
                result.listState.homeStyle === "reference_home_v2" &&
                Number(result.listState.preferredWidthDp) >= 380 &&
                Number(result.listState.preferredHeightDp) >= 680 &&
                result.navigationState &&
                Number(result.navigationState.registeredRootCount) >= 1 &&
                result.finalListClose === true &&
                result.stop &&
                result.stop.stopped === true &&
                result.databaseClosed === true &&
                result.formalRestart &&
                result.formalRestart.ok === true &&
                result.cleanup === true;

            write(outputFile,
                JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try {
        global.ClipHubNewHomeUiProbe034Result = main();
    } catch (error) {
        global.ClipHubNewHomeUiProbe034Result = {
            ok: false,
            probe: "cliphub_new_home_ui_probe_034",
            probeVersion: 1,
            fatal: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubNewHomeUiProbe034Result);
