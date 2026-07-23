/* ClipHub window position persistence and configuration probe 012. Rhino ES5 only. */
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
    var REQUIRED_SET = "20260721.11";
    var RUNTIME_NAME = "ClipHubProbe012";
    var ATTACH_TIMEOUT_MS = 1500;
    var ROTATION_TIMEOUT_MS = 20000;
    var TARGET_X_RATIO = 0.27;
    var TARGET_Y_RATIO = 0.62;
    var RATIO_TOLERANCE = 0.05;
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
        while (now() - started < timeoutMs) {
            if (callback()) {
                return { matched: true, waitedMs: now() - started };
            }
            Thread.sleep(25);
        }
        return {
            matched: callback(),
            waitedMs: now() - started
        };
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

    function localManifest(installedDir) {
        var file = new File(new File(installedDir, "cache"),
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
        var wait;
        if (lockFree(runtimeDir)) {
            return {
                ok: false,
                initiallyRunning: false,
                error: "Formal ClipHub was not running before probe 012"
            };
        }
        if (!endpointFile.isFile()) {
            return {
                ok: false,
                initiallyRunning: true,
                error: "Formal control endpoint is missing"
            };
        }
        endpoint = JSON.parse(read(endpointFile));
        if (String(endpoint.transport || "") !== "dynamic_broadcast_token" ||
                String(endpoint.runtimeDir || "") !==
                String(runtimeDir.getAbsolutePath())) {
            throw new Error("Invalid formal control endpoint");
        }
        requestId = stamp(now()) + "-" + Number(Thread.currentThread().getId());
        ackFile = new File(cacheDir, "control_ack_" + requestId + ".json");
        if (ackFile.exists()) { ackFile.delete(); }
        intent = new Intent(String(endpoint.action));
        intent.putExtra("runtimeDir", String(runtimeDir.getAbsolutePath()));
        intent.putExtra("command", "stop");
        intent.putExtra("requestId", requestId);
        intent.putExtra("controlToken", String(endpoint.token));
        context.sendBroadcast(intent);
        wait = waitFor(function () {
            return ackFile.isFile() && lockFree(runtimeDir);
        }, 3000);
        if (ackFile.isFile()) {
            try { ack = JSON.parse(read(ackFile)); } catch (ignoredAck) {}
            ackFile.delete();
        }
        return {
            ok: ack !== null && ack.ok === true && ack.stopped === true &&
                lockFree(runtimeDir) && !endpointFile.exists(),
            initiallyRunning: true,
            ackReceived: ack !== null,
            ack: ack,
            lockReleased: lockFree(runtimeDir),
            endpointRemoved: !endpointFile.exists(),
            waitedMs: wait.waitedMs,
            error: ack === null ? "Control acknowledgement not received" : null
        };
    }

    function loadAndStart(root, moduleDir, runtimeDir) {
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

    function insideBounds(windowState) {
        var bounds = windowState.safeBounds;
        return windowState.x >= bounds.left && windowState.y >= bounds.top &&
            windowState.x + windowState.width <= bounds.right &&
            windowState.y + windowState.height <= bounds.bottom;
    }

    function ratioClose(first, second) {
        return first !== null && second !== null &&
            Math.abs(Number(first.xRatio) - Number(second.xRatio)) <= RATIO_TOLERANCE &&
            Math.abs(Number(first.yRatio) - Number(second.yRatio)) <= RATIO_TOLERANCE;
    }

    function boundsSizeChanged(first, second) {
        if (!first || !second) { return false; }
        return Math.abs((second.right - second.left) -
                (first.right - first.left)) >= 20 ||
            Math.abs((second.bottom - second.top) -
                (first.bottom - first.top)) >= 20;
    }

    function positionForRatio(state, xRatio, yRatio) {
        var bounds = state.safeBounds;
        var travelX = Math.max(0, bounds.right - bounds.left - state.width);
        var travelY = Math.max(0, bounds.bottom - bounds.top - state.height);
        return {
            x: Math.floor(bounds.left + travelX * xRatio),
            y: Math.floor(bounds.top + travelY * yRatio)
        };
    }

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var installed = new File(root, "ClipHub");
        var moduleDir = new File(installed, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var output = new File(ensureDir(new File(installed, "probes")),
            "cliphub_window_persistence_probe_012_" + stamp(startedAt) + ".json");
        var local = localManifest(installed);
        var context = global.context;
        var control;
        var boot;
        var openResult;
        var attachWait;
        var firstState;
        var target;
        var movedState;
        var saved;
        var firstStop;
        var secondState;
        var initialConfigCount;
        var initialDisplayCount;
        var initialRefreshCount;
        var rotationWait;
        var rotatedState;
        var closeResult;
        var appStop;
        var result = {
            ok: false,
            probe: "cliphub_window_persistence_probe_012",
            probeVersion: 1,
            startedAt: startedAt,
            finishedAt: null,
            durationMs: null,
            pid: Number(Packages.android.os.Process.myPid()),
            uid: Number(Packages.android.os.Process.myUid()),
            threadId: Number(Thread.currentThread().getId()),
            threadName: String(Thread.currentThread().getName()),
            moduleSetVersion: local.moduleSetVersion || null,
            sourceRef: local.sourceRef || null,
            rotationTimeoutMs: ROTATION_TIMEOUT_MS,
            formalControl: null,
            firstStart: null,
            defaultPositionNull: false,
            observersRegistered: false,
            firstAttached: false,
            programmedPosition: null,
            positionPersisted: false,
            savedPosition: null,
            firstStopped: false,
            firstDatabaseClosed: false,
            secondStart: null,
            secondAttached: false,
            restoredPosition: null,
            restoredPixelMatch: false,
            restoredRatioMatch: false,
            initialBounds: null,
            initialRatios: null,
            rotationDetected: false,
            rotationWaitMs: null,
            callbackObserved: false,
            boundsRefreshObserved: false,
            rotatedBounds: null,
            rotatedRatios: null,
            rotatedInsideBounds: false,
            rotatedRatioPreserved: false,
            updateThreadName: null,
            closeResult: null,
            detachedAfterClose: false,
            appStopped: false,
            databaseClosed: false,
            formalRestart: null,
            cleanup: false,
            outputPath: String(output.getAbsolutePath()),
            error: null
        };

        if (!local.present || local.moduleSetVersion !== REQUIRED_SET) {
            throw new Error("Installed module set must be " + REQUIRED_SET);
        }
        if (context === null || context === undefined) {
            throw new Error("Global Android context unavailable");
        }

        try {
            control = stopFormal(context, installed);
            result.formalControl = control;
            if (!control.ok || !control.ackReceived ||
                    String(control.ack.threadName || "") !== "main") {
                throw new Error(control.error || "Formal stop failed");
            }

            removeTree(isolated);
            boot = loadAndStart(root, moduleDir, isolated);
            result.firstStart = boot;
            result.defaultPositionNull =
                global.ClipHub.Settings.get("windowPosition", null) === null;

            openResult = global.ClipHub.Window.open({
                widthDp: 300,
                heightDp: 160,
                statusText: "正在验证窗口位置持久化"
            });
            attachWait = waitFor(function () {
                return global.ClipHub.Window.getState().attachedToWindow === true;
            }, ATTACH_TIMEOUT_MS);
            result.firstAttached = attachWait.matched;
            if (!attachWait.matched) {
                throw new Error("First window did not attach");
            }
            firstState = global.ClipHub.Window.getState();
            result.observersRegistered =
                firstState.componentCallbacksRegistered === true &&
                firstState.displayListenerRegistered === true;
            target = positionForRatio(firstState, TARGET_X_RATIO, TARGET_Y_RATIO);
            global.ClipHub.Window.moveTo(
                target.x, target.y, { persist: true }
            );
            movedState = global.ClipHub.Window.getState();
            saved = global.ClipHub.Settings.get("windowPosition", null);
            result.programmedPosition = {
                x: movedState.x,
                y: movedState.y,
                xRatio: movedState.positionRatios.xRatio,
                yRatio: movedState.positionRatios.yRatio
            };
            result.savedPosition = saved;
            result.positionPersisted = saved !== null &&
                movedState.persistenceWriteCount === 1 &&
                ratioClose(saved, movedState.positionRatios);

            global.ClipHub.Window.close();
            firstStop = global.ClipHub.App.stop("probe012_first");
            result.firstStopped = firstStop.stopped === true;
            result.firstDatabaseClosed = !global.ClipHub.Database.isOpen();

            boot = loadAndStart(root, moduleDir, isolated);
            result.secondStart = boot;
            openResult = global.ClipHub.Window.open({
                widthDp: 300,
                heightDp: 160,
                statusText: "请将设备旋转到横屏\n检测完成后会自动关闭"
            });
            attachWait = waitFor(function () {
                return global.ClipHub.Window.getState().attachedToWindow === true;
            }, ATTACH_TIMEOUT_MS);
            result.secondAttached = attachWait.matched;
            if (!attachWait.matched) {
                throw new Error("Second window did not attach");
            }
            secondState = global.ClipHub.Window.getState();
            result.restoredPosition = {
                x: secondState.x,
                y: secondState.y,
                xRatio: secondState.positionRatios.xRatio,
                yRatio: secondState.positionRatios.yRatio
            };
            result.restoredPixelMatch =
                Math.abs(secondState.x - movedState.x) <= 2 &&
                Math.abs(secondState.y - movedState.y) <= 2;
            result.restoredRatioMatch = ratioClose(
                saved, secondState.positionRatios
            );
            result.initialBounds = secondState.safeBounds;
            result.initialRatios = secondState.positionRatios;
            initialConfigCount = secondState.configurationChangeCount;
            initialDisplayCount = secondState.displayChangeCount;
            initialRefreshCount = secondState.boundsRefreshCount;

            rotationWait = waitFor(function () {
                var current = global.ClipHub.Window.getState();
                return current.attachedToWindow === true &&
                    boundsSizeChanged(result.initialBounds, current.safeBounds) &&
                    current.boundsRefreshCount > initialRefreshCount;
            }, ROTATION_TIMEOUT_MS);
            result.rotationWaitMs = rotationWait.waitedMs;
            rotatedState = global.ClipHub.Window.getState();
            result.rotationDetected = rotationWait.matched;
            result.callbackObserved =
                rotatedState.configurationChangeCount > initialConfigCount ||
                rotatedState.displayChangeCount > initialDisplayCount;
            result.boundsRefreshObserved =
                rotatedState.boundsRefreshCount > initialRefreshCount;
            result.rotatedBounds = rotatedState.safeBounds;
            result.rotatedRatios = rotatedState.positionRatios;
            result.rotatedInsideBounds = insideBounds(rotatedState);
            result.rotatedRatioPreserved = ratioClose(
                result.initialRatios, rotatedState.positionRatios
            );
            result.updateThreadName = rotatedState.updateThreadName;
            if (!rotationWait.matched) {
                result.error = "Landscape rotation was not detected within timeout";
            } else {
                global.ClipHub.Window.setStatusText(
                    "已检测到方向变化\n正在完成资源清理"
                );
                Thread.sleep(500);
            }

            closeResult = global.ClipHub.Window.close();
            result.closeResult = closeResult;
            secondState = global.ClipHub.Window.getState();
            result.detachedAfterClose = secondState.attached === false &&
                secondState.attachedToWindow === false;
            appStop = global.ClipHub.App.stop("probe012_second");
            result.appStopped = appStop.stopped === true;
            result.databaseClosed = !global.ClipHub.Database.isOpen();
        } catch (error) {
            result.error = errorText(error);
            try {
                if (global.ClipHub && global.ClipHub.App) {
                    global.ClipHub.App.stop("probe012_error");
                }
            } catch (ignoredStop) {}
        } finally {
            try {
                if (lockFree(installed)) {
                    boot = loadAndStart(root, moduleDir, installed);
                    result.formalRestart = boot;
                } else {
                    result.formalRestart = {
                        ok: true,
                        started: true,
                        reused: true,
                        reason: "formal_lock_already_held"
                    };
                }
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
                result.defaultPositionNull && result.observersRegistered &&
                result.firstAttached && result.positionPersisted &&
                result.firstStopped && result.firstDatabaseClosed &&
                result.secondStart && result.secondStart.ok === true &&
                result.secondAttached && result.restoredPixelMatch &&
                result.restoredRatioMatch && result.rotationDetected &&
                result.callbackObserved && result.boundsRefreshObserved &&
                result.rotatedInsideBounds && result.rotatedRatioPreserved &&
                result.updateThreadName === "main" && result.closeResult &&
                result.closeResult.ok === true && result.detachedAfterClose &&
                result.appStopped && result.databaseClosed &&
                result.formalRestart && result.formalRestart.ok === true &&
                result.cleanup;
            write(output, JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try {
        global.ClipHubWindowPersistenceProbe012Result = main();
    } catch (error) {
        global.ClipHubWindowPersistenceProbe012Result = {
            ok: false,
            probe: "cliphub_window_persistence_probe_012",
            probeVersion: 1,
            fatal: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubWindowPersistenceProbe012Result);
