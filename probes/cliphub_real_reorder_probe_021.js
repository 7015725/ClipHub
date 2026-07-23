/* ClipHub real-finger reorder probe 021. Rhino ES5 only. */
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
    var RUNTIME_NAME = "ClipHubProbe021";
    var ATTACH_TIMEOUT_MS = 1500;
    var INTERACTION_TIMEOUT_MS = 25000;
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
        return { matched: callback(), waitedMs: now() - started };
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
        var wait;
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
            ackReceived: ack !== null,
            ack: ack,
            lockReleased: lockFree(runtimeDir),
            endpointRemoved: !endpointFile.exists(),
            waitedMs: wait.waitedMs,
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

    function add(content, createdAt) {
        return Number(global.ClipHub.Repository.insertItem({
            content: String(content),
            contentType: "text",
            sourcePackage: "com.reorder.real",
            sourceLabel: "真实手指排序",
            sourceUid: 10000,
            sourceConfidence: 100,
            createdAt: Number(createdAt),
            lastCopiedAt: Number(createdAt),
            updatedAt: Number(createdAt)
        }));
    }

    function sameIds(actual, expected) {
        var index;
        if (!actual || actual.length !== expected.length) { return false; }
        for (index = 0; index < expected.length; index += 1) {
            if (Number(actual[index]) !== Number(expected[index])) { return false; }
        }
        return true;
    }

    function orderIds() {
        var rows = global.ClipHub.Repository.listOrderRows(false);
        var ids = [];
        var index;
        for (index = 0; index < rows.length; index += 1) {
            ids.push(Number(rows[index].id));
        }
        return ids;
    }

    function normalizedOrders(expectedCount) {
        var rows = global.ClipHub.Repository.getManualOrderState(false);
        var index;
        if (rows.length !== expectedCount) { return false; }
        for (index = 0; index < rows.length; index += 1) {
            if (Number(rows[index].manualOrder) !== (index + 1) * 1000) {
                return false;
            }
        }
        return true;
    }

    function eventsHaveContent(events) {
        var index;
        for (index = 0; index < events.length; index += 1) {
            if (JSON.stringify(events[index]).indexOf("content") >= 0) {
                return true;
            }
        }
        return false;
    }

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var formal = new File(root, "ClipHub");
        var modules = new File(formal, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var output = new File(ensureDir(new File(formal, "probes")),
            "cliphub_real_reorder_probe_021_" + stamp(startedAt) + ".json");
        var local = localManifest(formal);
        var boot;
        var stop;
        var attachWait;
        var interactionWait;
        var firstId;
        var secondId;
        var thirdId;
        var initialIds;
        var finalIds;
        var listState;
        var windowBefore;
        var windowAfter;
        var events = [];
        var baseTime = startedAt - 10000;
        var result = {
            ok: false,
            probe: "cliphub_real_reorder_probe_021",
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
            interactionTimeoutMs: INTERACTION_TIMEOUT_MS,
            outputPath: String(output.getAbsolutePath()),
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
            global.ClipHub.EventBus.on("clipboard_merged", function (payload) {
                if (payload && String(payload.mutation || "") ===
                        "manual_order_changed") {
                    events.push(payload);
                }
            });

            firstId = add("目标 A：保持在列表中，等待真实手指排序", baseTime + 1000);
            secondId = add("目标 B：拖动时经过本条记录", baseTime + 2000);
            thirdId = add("请按住本条左侧 ↕，拖到最下方后松手", baseTime + 3000);
            result.seededCount = global.ClipHub.Repository.countItems(false);

            global.ClipHub.List.show({
                limit: 20,
                widthDp: 360,
                heightDp: 520
            });
            attachWait = waitFor(function () {
                return global.ClipHub.Window.getState().attachedToWindow === true;
            }, ATTACH_TIMEOUT_MS);
            result.attachWaitMs = attachWait.waitedMs;
            result.listAttached = attachWait.matched;
            if (!attachWait.matched) {
                throw new Error("List window did not attach before interaction");
            }

            listState = global.ClipHub.List.getState();
            initialIds = [thirdId, secondId, firstId];
            result.initialOrder = listState.itemIds;
            result.initialOrderMatched = sameIds(listState.itemIds, initialIds);
            result.reorderEnabled = listState.reorderEnabled === true;
            result.reorderHandleCount = Number(listState.reorderHandleCount || 0);
            windowBefore = global.ClipHub.Window.getState();
            result.initialWindowPosition = {
                x: Number(windowBefore.x),
                y: Number(windowBefore.y)
            };
            result.initialWindowDragMoveCount =
                Number(windowBefore.dragMoveCount || 0);

            interactionWait = waitFor(function () {
                var current = global.ClipHub.List.getState();
                return Number(current.reorderDragCommitCount || 0) > 0 &&
                    Number(current.reorderSyntheticCount || 0) === 0 &&
                    !sameIds(current.itemIds, initialIds);
            }, INTERACTION_TIMEOUT_MS);
            result.interactionWaitMs = interactionWait.waitedMs;
            listState = global.ClipHub.List.getState();
            finalIds = listState.itemIds;
            windowAfter = global.ClipHub.Window.getState();

            result.userDragDetected = interactionWait.matched;
            result.finalOrder = finalIds;
            result.orderChanged = !sameIds(finalIds, initialIds);
            result.repositoryOrderMatched = sameIds(orderIds(), finalIds);
            result.manualOrderNormalized = normalizedOrders(3);
            result.dragStartObserved =
                Number(listState.reorderDragStartCount || 0) > 0;
            result.dragMoveObserved =
                Number(listState.reorderDragMoveCount || 0) > 0;
            result.dragCommitObserved =
                Number(listState.reorderDragCommitCount || 0) > 0;
            result.syntheticCountZero =
                Number(listState.reorderSyntheticCount || 0) === 0;
            result.reorderThreadName = listState.reorderThreadName;
            result.lastReorderReason = listState.lastReorderReason;
            result.reorderEventObserved = events.length > 0;
            result.reorderEventsNoContent = !eventsHaveContent(events);
            result.reorderEventThreadName = events.length > 0 ?
                String(events[events.length - 1].threadName || "") : null;
            result.windowDragUnchanged =
                Number(windowAfter.dragMoveCount || 0) ===
                    Number(windowBefore.dragMoveCount || 0);
            result.windowPositionUnchanged =
                Number(windowAfter.x) === Number(windowBefore.x) &&
                Number(windowAfter.y) === Number(windowBefore.y);
            result.windowStillAttached =
                windowAfter.attached === true &&
                windowAfter.attachedToWindow === true;
            result.listStillVisible = listState.visible === true &&
                listState.windowAttached === true;
            result.lastError = listState.lastError;

            if (result.userDragDetected) { Thread.sleep(500); }

            result.firstClose = global.ClipHub.Window.close();
            stop = global.ClipHub.App.stop("probe021_first");
            result.firstStopped = stop.stopped === true;
            result.firstDatabaseClosed = !global.ClipHub.Database.isOpen();

            boot = start(root, modules, isolated);
            result.secondStart = boot;
            result.orderPersistedAfterRestart =
                sameIds(orderIds(), finalIds);
            global.ClipHub.List.show({
                limit: 20,
                widthDp: 360,
                heightDp: 520
            });
            waitFor(function () {
                return global.ClipHub.Window.getState().attachedToWindow === true;
            }, ATTACH_TIMEOUT_MS);
            listState = global.ClipHub.List.getState();
            result.renderedOrderPersisted =
                sameIds(listState.itemIds, finalIds);
            result.handlesAfterRestart =
                Number(listState.reorderHandleCount || 0) === 3;
            result.mainWindowDragStillZero =
                Number(global.ClipHub.Window.getState().dragMoveCount || 0) === 0;
            result.finalClose = global.ClipHub.Window.close();
            stop = global.ClipHub.App.stop("probe021_second");
            result.secondStopped = stop.stopped === true;
            result.secondDatabaseClosed = !global.ClipHub.Database.isOpen();
        } catch (error) {
            result.error = errorText(error);
            try {
                if (global.ClipHub && global.ClipHub.App) {
                    global.ClipHub.App.stop("probe021_error");
                }
            } catch (ignoredStop) {}
        } finally {
            try {
                if (lockFree(formal)) {
                    result.formalRestart = start(root, modules, formal);
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
                result.schemaVersion === 2 &&
                result.seededCount === 3 &&
                result.listAttached &&
                result.initialOrderMatched &&
                result.reorderEnabled &&
                result.reorderHandleCount === 3 &&
                result.userDragDetected &&
                result.orderChanged &&
                result.repositoryOrderMatched &&
                result.manualOrderNormalized &&
                result.dragStartObserved &&
                result.dragMoveObserved &&
                result.dragCommitObserved &&
                result.syntheticCountZero &&
                result.reorderThreadName === "main" &&
                result.reorderEventObserved &&
                result.reorderEventsNoContent &&
                result.reorderEventThreadName === "main" &&
                result.windowDragUnchanged &&
                result.windowPositionUnchanged &&
                result.windowStillAttached &&
                result.listStillVisible &&
                result.lastError === null &&
                result.firstClose && result.firstClose.ok === true &&
                result.firstStopped &&
                result.firstDatabaseClosed &&
                result.secondStart && result.secondStart.ok === true &&
                result.orderPersistedAfterRestart &&
                result.renderedOrderPersisted &&
                result.handlesAfterRestart &&
                result.mainWindowDragStillZero &&
                result.finalClose && result.finalClose.ok === true &&
                result.secondStopped &&
                result.secondDatabaseClosed &&
                result.formalRestart && result.formalRestart.ok === true &&
                result.cleanup;
            write(output, JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try {
        global.ClipHubRealReorderProbe021Result = main();
    } catch (error) {
        global.ClipHubRealReorderProbe021Result = {
            ok: false,
            probe: "cliphub_real_reorder_probe_021",
            probeVersion: 1,
            fatal: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubRealReorderProbe021Result);
