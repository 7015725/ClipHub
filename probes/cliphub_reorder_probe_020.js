/* ClipHub reorder probe 020. Rhino ES5 only. */
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
    var RUNTIME_NAME = "ClipHubProbe020";
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
    function add(content, pinned, createdAt) {
        return Number(global.ClipHub.Repository.insertItem({
            content: String(content),
            contentType: "text",
            sourcePackage: pinned ? "com.reorder.pinned" : "com.reorder.normal",
            sourceLabel: pinned ? "Pinned" : "Normal",
            sourceUid: 10000,
            sourceConfidence: 100,
            isPinned: pinned === true,
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
    function orderIds(pinned) {
        var rows = global.ClipHub.Repository.listOrderRows(pinned === true);
        var ids = [];
        var index;
        for (index = 0; index < rows.length; index += 1) {
            ids.push(Number(rows[index].id));
        }
        return ids;
    }
    function normalizedOrders(pinned, expectedCount) {
        var rows = global.ClipHub.Repository.getManualOrderState(pinned === true);
        var index;
        if (rows.length !== expectedCount) { return false; }
        for (index = 0; index < rows.length; index += 1) {
            if (Number(rows[index].manualOrder) !== (index + 1) * 1000) {
                return false;
            }
        }
        return true;
    }
    function findMutation(events, id) {
        var index;
        var value;
        for (index = 0; index < events.length; index += 1) {
            value = events[index] || {};
            if (String(value.mutation || "") === "manual_order_changed" &&
                    Number(value.id) === Number(id)) {
                return value;
            }
        }
        return null;
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
            "cliphub_reorder_probe_020_" + stamp(startedAt) + ".json");
        var local = localManifest(formal);
        var boot;
        var stop;
        var listState;
        var windowBefore;
        var windowAfter;
        var pinnedOne;
        var pinnedTwo;
        var normalOne;
        var normalTwo;
        var normalThree;
        var normalFour;
        var normalFive;
        var normalBeforeCross;
        var pinnedBeforeCross;
        var events = [];
        var copyCalls = [];
        var originalWrite;
        var baseTime = startedAt - 20000;
        var result = {
            ok: false,
            probe: "cliphub_reorder_probe_020",
            probeVersion: 1,
            startedAt: startedAt,
            moduleSetVersion: local.moduleSetVersion || null,
            sourceRef: local.sourceRef || null,
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
            pinnedOne = add("pinned one", true, baseTime + 1000);
            pinnedTwo = add("pinned two", true, baseTime + 2000);
            normalOne = add("normal one", false, baseTime + 3000);
            normalTwo = add("normal two", false, baseTime + 4000);
            normalThree = add("normal three", false, baseTime + 5000);
            normalFour = add("normal four", false, baseTime + 6000);
            result.seededCount = global.ClipHub.Repository.countItems(false);
            global.ClipHub.List.show({ limit: 20, widthDp: 340, heightDp: 420 });
            result.listAttached = waitFor(function () {
                return global.ClipHub.Window.getState().attachedToWindow === true;
            }, 1500);
            listState = global.ClipHub.List.getState();
            result.initialOrderMatched = sameIds(listState.itemIds,
                [pinnedTwo, pinnedOne, normalFour, normalThree, normalTwo, normalOne]);
            result.reorderEnabled = listState.reorderEnabled === true;
            result.reorderHandleCount = listState.reorderHandleCount;
            windowBefore = global.ClipHub.Window.getState();

            result.syntheticDragPerformed =
                global.ClipHub.List.performReorderHandleDrag(2, 5) === true;
            waitFor(function () {
                return sameIds(global.ClipHub.List.getState().itemIds,
                    [pinnedTwo, pinnedOne, normalThree, normalTwo,
                        normalOne, normalFour]);
            }, 1500);
            listState = global.ClipHub.List.getState();
            result.normalOrderChanged = sameIds(orderIds(false),
                [normalThree, normalTwo, normalOne, normalFour]);
            result.normalManualOrderNormalized = normalizedOrders(false, 4);
            result.pinnedGroupUnchangedAfterNormalDrag = sameIds(orderIds(true),
                [pinnedTwo, pinnedOne]);
            result.dragStartObserved = listState.reorderDragStartCount > 0;
            result.dragMoveObserved = listState.reorderDragMoveCount > 0;
            result.dragCommitObserved = listState.reorderDragCommitCount === 1;
            result.reorderThreadName = listState.reorderThreadName;
            result.reorderEventMatched =
                findMutation(events, normalFour) !== null;
            result.reorderEventsNoContent = !eventsHaveContent(events);
            windowAfter = global.ClipHub.Window.getState();
            result.windowDragUnchanged =
                Number(windowAfter.dragMoveCount) === Number(windowBefore.dragMoveCount);

            originalWrite = global.ClipHub.Clipboard.writeText;
            global.ClipHub.Clipboard.writeText = function (text, options) {
                copyCalls.push({ length: String(text).length,
                    sensitive: options && options.sensitive === true,
                    threadName: String(Thread.currentThread().getName()) });
                return { ok: true, ownWrite: true };
            };
            result.cardClickPreserved = global.ClipHub.List.performItemClick(0) === true;
            global.ClipHub.Clipboard.writeText = originalWrite;
            result.cardCopyCaptured = copyCalls.length === 1;
            result.cardCopyThreadName = copyCalls.length > 0 ?
                copyCalls[0].threadName : null;

            result.pinnedApiReorderWorked =
                global.ClipHub.List.performReorder(1, 0) === true;
            waitFor(function () {
                return sameIds(orderIds(true), [pinnedOne, pinnedTwo]);
            }, 1200);
            result.pinnedOrderChanged = sameIds(orderIds(true),
                [pinnedOne, pinnedTwo]);
            result.pinnedManualOrderNormalized = normalizedOrders(true, 2);

            pinnedBeforeCross = orderIds(true);
            normalBeforeCross = orderIds(false);
            result.crossGroupRejected =
                global.ClipHub.List.performReorder(0, 2) === false;
            result.crossGroupOrderUnchanged =
                sameIds(orderIds(true), pinnedBeforeCross) &&
                sameIds(orderIds(false), normalBeforeCross);

            global.ClipHub.Filter.setKeyword("normal");
            listState = global.ClipHub.List.getState();
            result.filterApplied = listState.filterActive === true &&
                listState.renderedCount === 4;
            result.filteredHandlesHidden = listState.reorderHandleCount === 0 &&
                listState.reorderEnabled === false;
            normalBeforeCross = orderIds(false);
            result.filteredReorderRejected =
                global.ClipHub.List.performReorder(0, 1) === false;
            result.filteredOrderUnchanged = sameIds(orderIds(false), normalBeforeCross);
            global.ClipHub.Filter.reset();
            result.resetRestoredAll =
                global.ClipHub.List.getState().renderedCount === 6;

            normalFive = add("normal five", false, baseTime + 7000);
            global.ClipHub.EventBus.emit("clipboard_added", {
                id: normalFive, manual: false,
                threadId: Number(Thread.currentThread().getId()),
                threadName: String(Thread.currentThread().getName())
            });
            waitFor(function () {
                return global.ClipHub.List.getState().renderedCount === 7;
            }, 1200);
            result.newItemInserted = global.ClipHub.Repository.countItems(false) === 7;
            result.newItemAtGroupFront = sameIds(orderIds(false),
                [normalFive, normalThree, normalTwo, normalOne, normalFour]);

            stop = global.ClipHub.App.stop("probe020_first");
            result.firstStopped = stop.stopped === true;
            result.firstDatabaseClosed = !global.ClipHub.Database.isOpen();
            boot = start(root, modules, isolated);
            result.secondStart = boot;
            result.normalOrderPersistedAfterRestart = sameIds(orderIds(false),
                [normalFive, normalThree, normalTwo, normalOne, normalFour]);
            result.pinnedOrderPersistedAfterRestart = sameIds(orderIds(true),
                [pinnedOne, pinnedTwo]);
            result.filterResetAfterRestart =
                global.ClipHub.Filter.getState().active === false;
            global.ClipHub.List.show({ limit: 20, widthDp: 340, heightDp: 420 });
            waitFor(function () {
                return global.ClipHub.Window.getState().attachedToWindow === true;
            }, 1500);
            listState = global.ClipHub.List.getState();
            result.handlesAfterRestart = listState.reorderHandleCount === 7;
            result.mainWindowDragStillZero =
                Number(global.ClipHub.Window.getState().dragMoveCount) === 0;
            result.finalClose = global.ClipHub.Window.close();
            stop = global.ClipHub.App.stop("probe020_second");
            result.secondStopped = stop.stopped === true;
            result.secondDatabaseClosed = !global.ClipHub.Database.isOpen();
        } catch (error) {
            result.error = errorText(error);
            try { global.ClipHub.App.stop("probe020_error"); }
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
            result.ok = result.error === null && result.formalControl &&
                result.formalControl.ok === true && result.firstStart &&
                result.firstStart.ok === true && result.schemaVersion === 2 &&
                result.seededCount === 6 && result.listAttached &&
                result.initialOrderMatched && result.reorderEnabled &&
                result.reorderHandleCount === 6 && result.syntheticDragPerformed &&
                result.normalOrderChanged && result.normalManualOrderNormalized &&
                result.pinnedGroupUnchangedAfterNormalDrag &&
                result.dragStartObserved && result.dragMoveObserved &&
                result.dragCommitObserved && result.reorderThreadName === "main" &&
                result.reorderEventMatched && result.reorderEventsNoContent &&
                result.windowDragUnchanged && result.cardClickPreserved &&
                result.cardCopyCaptured && result.cardCopyThreadName === "main" &&
                result.pinnedApiReorderWorked && result.pinnedOrderChanged &&
                result.pinnedManualOrderNormalized && result.crossGroupRejected &&
                result.crossGroupOrderUnchanged && result.filterApplied &&
                result.filteredHandlesHidden && result.filteredReorderRejected &&
                result.filteredOrderUnchanged && result.resetRestoredAll &&
                result.newItemInserted && result.newItemAtGroupFront &&
                result.firstStopped && result.firstDatabaseClosed &&
                result.secondStart && result.secondStart.ok === true &&
                result.normalOrderPersistedAfterRestart &&
                result.pinnedOrderPersistedAfterRestart &&
                result.filterResetAfterRestart && result.handlesAfterRestart &&
                result.mainWindowDragStillZero && result.finalClose &&
                result.finalClose.ok === true && result.secondStopped &&
                result.secondDatabaseClosed && result.formalRestart &&
                result.formalRestart.ok === true && result.cleanup;
            write(output, JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try {
        global.ClipHubReorderProbe020Result = main();
    } catch (error) {
        global.ClipHubReorderProbe020Result = {
            ok: false,
            probe: "cliphub_reorder_probe_020",
            probeVersion: 1,
            fatal: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubReorderProbe020Result);
