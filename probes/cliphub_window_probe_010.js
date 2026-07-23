/* ClipHub WindowManager lifecycle probe 010. Rhino ES5 only. */
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
    var REQUIRED_SET = "20260721.10";
    var RUNTIME_NAME = "ClipHubProbe010";
    var ATTACH_TIMEOUT_MS = 1500;
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
    function waitForAttached(timeoutMs) {
        var started = now();
        var attached = waitFor(function () {
            var state = global.ClipHub.Window.getState();
            return state.attached === true && state.attachedToWindow === true;
        }, timeoutMs);
        return {
            attached: attached,
            waitedMs: now() - started,
            state: global.ClipHub.Window.getState()
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
            if (lock !== null) { try { lock.release(); } catch (ignored) {} }
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
        if (lockFree(runtimeDir)) {
            return {
                ok: false,
                initiallyRunning: false,
                error: "Formal ClipHub was not running before probe 010"
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
        waitFor(function () {
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

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var installed = new File(root, "ClipHub");
        var moduleDir = new File(installed, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var output = new File(ensureDir(new File(installed, "probes")),
            "cliphub_window_probe_010_" + stamp(startedAt) + ".json");
        var local = localManifest(installed);
        var context = global.context;
        var control;
        var boot;
        var openResult;
        var firstAttach;
        var duplicateOpen;
        var topLeft;
        var bottomRight;
        var moved;
        var collapsed;
        var expanded;
        var pinned;
        var status;
        var firstClose;
        var afterClose;
        var secondClose;
        var reopen;
        var secondAttach;
        var reopenState;
        var finalClose;
        var appStop;
        var result = {
            ok: false,
            probe: "cliphub_window_probe_010",
            probeVersion: 2,
            startedAt: startedAt,
            finishedAt: null,
            durationMs: null,
            pid: Number(Packages.android.os.Process.myPid()),
            uid: Number(Packages.android.os.Process.myUid()),
            threadId: Number(Thread.currentThread().getId()),
            threadName: String(Thread.currentThread().getName()),
            moduleSetVersion: local.moduleSetVersion || null,
            sourceRef: local.sourceRef || null,
            formalControl: null,
            isolatedStart: null,
            windowOpen: null,
            firstAttachWaitMs: null,
            attachedToWindow: false,
            addThreadName: null,
            windowType: null,
            dragListenerInstalled: false,
            duplicateOpenReused: false,
            topLeftClamped: false,
            bottomRightClamped: false,
            moveByApplied: false,
            collapsedApplied: false,
            expandedApplied: false,
            pinApplied: false,
            statusUpdated: false,
            firstClose: null,
            detachedAfterClose: false,
            removeThreadName: null,
            secondCloseIdempotent: false,
            reopenSucceeded: false,
            reopenAttachWaitMs: null,
            reopenOpenCount: null,
            finalClose: null,
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
            result.isolatedStart = boot;

            openResult = global.ClipHub.Window.open({
                x: -999999,
                y: -999999,
                widthDp: 320,
                heightDp: 180,
                statusText: "ClipHub 探测 010\nWindowManager 生命周期验证"
            });
            result.windowOpen = openResult;
            firstAttach = waitForAttached(ATTACH_TIMEOUT_MS);
            result.firstAttachWaitMs = firstAttach.waitedMs;
            result.attachedToWindow = firstAttach.attached;
            result.addThreadName = firstAttach.state.addThreadName;
            result.windowType = firstAttach.state.windowType;
            result.dragListenerInstalled =
                firstAttach.state.dragListenerInstalled === true;

            duplicateOpen = global.ClipHub.Window.open();
            result.duplicateOpenReused = duplicateOpen.reused === true &&
                duplicateOpen.state.openCount === 1;

            topLeft = global.ClipHub.Window.moveTo(-999999, -999999);
            result.topLeftClamped = topLeft.x === topLeft.safeBounds.left &&
                topLeft.y === topLeft.safeBounds.top && insideBounds(topLeft);

            bottomRight = global.ClipHub.Window.moveTo(999999, 999999);
            result.bottomRightClamped = insideBounds(bottomRight) &&
                bottomRight.x === bottomRight.safeBounds.right - bottomRight.width &&
                bottomRight.y === bottomRight.safeBounds.bottom - bottomRight.height;

            moved = global.ClipHub.Window.moveBy(-30, -30);
            result.moveByApplied = insideBounds(moved) &&
                moved.x <= bottomRight.x && moved.y <= bottomRight.y &&
                moved.updateThreadName === "main";

            global.ClipHub.Window.setCollapsed(true);
            collapsed = global.ClipHub.Window.getState();
            result.collapsedApplied = collapsed.collapsed === true &&
                collapsed.height === collapsed.collapsedHeight && insideBounds(collapsed);

            global.ClipHub.Window.setCollapsed(false);
            expanded = global.ClipHub.Window.getState();
            result.expandedApplied = expanded.collapsed === false &&
                expanded.height === expanded.normalHeight && insideBounds(expanded);

            global.ClipHub.Window.setPinned(true);
            pinned = global.ClipHub.Window.getState();
            result.pinApplied = pinned.pinned === true;
            global.ClipHub.Window.setPinned(false);

            status = global.ClipHub.Window.setStatusText(
                "ClipHub 探测 010 已完成边界移动"
            );
            result.statusUpdated = status ===
                "ClipHub 探测 010 已完成边界移动" &&
                global.ClipHub.Window.getState().statusText === status;

            Thread.sleep(100);
            firstClose = global.ClipHub.Window.close();
            result.firstClose = firstClose;
            afterClose = global.ClipHub.Window.getState();
            result.detachedAfterClose = afterClose.attached === false &&
                afterClose.attachedToWindow === false;
            result.removeThreadName = afterClose.removeThreadName;

            secondClose = global.ClipHub.Window.close();
            result.secondCloseIdempotent = secondClose.alreadyClosed === true;

            reopen = global.ClipHub.Window.open({
                widthDp: 260,
                heightDp: 140,
                statusText: "ClipHub 探测 010 二次打开"
            });
            secondAttach = waitForAttached(ATTACH_TIMEOUT_MS);
            result.reopenAttachWaitMs = secondAttach.waitedMs;
            reopenState = secondAttach.state;
            result.reopenSucceeded = reopen.attached === true &&
                secondAttach.attached && insideBounds(reopenState);
            result.reopenOpenCount = reopenState.openCount;
            Thread.sleep(100);
            finalClose = global.ClipHub.Window.close();
            result.finalClose = finalClose;

            appStop = global.ClipHub.App.stop("probe010");
            result.appStopped = appStop.stopped === true;
            result.databaseClosed = !global.ClipHub.Database.isOpen();
        } catch (error) {
            result.error = errorText(error);
            try {
                if (global.ClipHub && global.ClipHub.App) {
                    global.ClipHub.App.stop("probe010_error");
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
                    result.error = "Formal restart failed: " + errorText(restartError);
                }
            }
            result.cleanup = removeTree(isolated);
            result.finishedAt = now();
            result.durationMs = result.finishedAt - result.startedAt;
            result.ok = result.error === null &&
                result.formalControl && result.formalControl.ok === true &&
                result.isolatedStart && result.isolatedStart.ok === true &&
                result.windowOpen && result.windowOpen.ok === true &&
                result.attachedToWindow && result.addThreadName === "main" &&
                result.windowType === 2038 && result.dragListenerInstalled &&
                result.duplicateOpenReused && result.topLeftClamped &&
                result.bottomRightClamped && result.moveByApplied &&
                result.collapsedApplied && result.expandedApplied &&
                result.pinApplied && result.statusUpdated &&
                result.detachedAfterClose && result.removeThreadName === "main" &&
                result.secondCloseIdempotent && result.reopenSucceeded &&
                result.reopenOpenCount === 2 && result.finalClose &&
                result.finalClose.ok === true && result.appStopped &&
                result.databaseClosed && result.formalRestart &&
                result.formalRestart.ok === true && result.cleanup;
            write(output, JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try {
        global.ClipHubWindowProbe010Result = main();
    } catch (error) {
        global.ClipHubWindowProbe010Result = {
            ok: false,
            probe: "cliphub_window_probe_010",
            probeVersion: 2,
            fatal: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubWindowProbe010Result);
