/* ClipHub long text detail probe 019. Rhino ES5 only. */
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
    var REQUIRED_SET = "20260722.18";
    var RUNTIME_NAME = "ClipHubProbe019";
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
    function add(content, sensitive, createdAt) {
        return Number(global.ClipHub.Repository.insertItem({
            content: String(content),
            contentType: "text",
            sourcePackage: "com.detail.probe",
            sourceLabel: "Detail Probe",
            sourceUid: 10000,
            sourceConfidence: 100,
            isSensitive: sensitive === true,
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

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var formal = new File(root, "ClipHub");
        var modules = new File(formal, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var output = new File(ensureDir(new File(formal, "probes")),
            "cliphub_long_detail_probe_019_" + stamp(startedAt) + ".json");
        var local = localManifest(formal);
        var shortText = "short detail probe";
        var longText = repeatText("regular", 70);
        var sensitiveText = repeatText("sensitive", 65) +
            "\nline-two\nline-three\nline-four";
        var shortId;
        var longId;
        var sensitiveId;
        var shortIndex;
        var longIndex;
        var sensitiveIndex;
        var boot;
        var listState;
        var detailState;
        var editorState;
        var originalWrite;
        var capturedLength = 0;
        var capturedSensitive = null;
        var stop;
        var result = {
            ok: false,
            probe: "cliphub_long_detail_probe_019",
            probeVersion: 1,
            startedAt: startedAt,
            moduleSetVersion: local.moduleSetVersion || null,
            sourceRef: local.sourceRef || null,
            formalControl: null,
            firstStart: null,
            seededCount: 0,
            listAttached: false,
            initialRenderedCount: 0,
            longItemCount: 0,
            detailButtonCount: 0,
            sensitiveMaskCount: 0,
            shortDetailRejected: false,
            regularDetailClicked: false,
            regularDetailAttached: false,
            regularDetailTargetMatched: false,
            regularDetailSensitiveFalse: false,
            regularContentLengthMatched: false,
            detailTextVisible: false,
            detailTextSelectable: false,
            detailScrollable: false,
            detailButtonsPresent: false,
            detailWindowType: null,
            detailAddThreadName: null,
            copyClicked: false,
            copyCaptured: false,
            copySensitiveFlagFalse: false,
            detailStayedOpenAfterCopy: false,
            copyThreadName: null,
            databaseCountStableAfterCopy: false,
            detailEditClicked: false,
            detailClosedForEdit: false,
            editorOpenedFromDetail: false,
            editorTargetMatched: false,
            detailRemoveThreadName: null,
            sensitiveDetailClicked: false,
            sensitiveDetailAttached: false,
            sensitiveDetailTargetMatched: false,
            sensitiveFlagTrue: false,
            sensitiveContentLengthMatched: false,
            sensitiveTextVisibleAfterExplicitOpen: false,
            sensitiveCopyClicked: false,
            sensitiveCopyCaptured: false,
            copySensitiveFlagTrue: false,
            closeButtonWorked: false,
            detailDetachedAfterClose: false,
            detailReopenedBeforeStop: false,
            firstStopped: false,
            detailCleanupOnStop: false,
            firstDatabaseClosed: false,
            secondStart: null,
            recordsPersistedAfterRestart: false,
            detailClosedAfterRestart: false,
            editorClosedAfterRestart: false,
            detailButtonsAfterRestart: false,
            sensitiveMaskAfterRestart: false,
            finalClose: null,
            secondStopped: false,
            secondDatabaseClosed: false,
            formalRestart: null,
            cleanup: false,
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
            shortId = add(shortText, false, startedAt - 3000);
            longId = add(longText, false, startedAt - 2000);
            sensitiveId = add(sensitiveText, true, startedAt - 1000);
            result.seededCount = global.ClipHub.Repository.countItems(false);
            global.ClipHub.List.show({ limit: 20, widthDp: 340, heightDp: 420 });
            result.listAttached = waitFor(function () {
                return global.ClipHub.Window.getState().attachedToWindow === true;
            }, 1500);
            listState = global.ClipHub.List.getState();
            result.initialRenderedCount = listState.renderedCount;
            result.longItemCount = listState.longItemCount;
            result.detailButtonCount = listState.detailButtonCount;
            result.sensitiveMaskCount = listState.renderedSensitiveMaskCount;
            shortIndex = indexOfId(listState.itemIds, shortId);
            longIndex = indexOfId(listState.itemIds, longId);
            sensitiveIndex = indexOfId(listState.itemIds, sensitiveId);
            result.shortDetailRejected =
                global.ClipHub.List.performDetailClick(shortIndex) === false;

            result.regularDetailClicked =
                global.ClipHub.List.performDetailClick(longIndex) === true;
            result.regularDetailAttached = waitFor(function () {
                return global.ClipHub.List.getDetailState().attachedToWindow === true;
            }, 1500);
            detailState = global.ClipHub.List.getDetailState();
            result.regularDetailTargetMatched = Number(detailState.itemId) === longId;
            result.regularDetailSensitiveFalse = detailState.sensitive === false;
            result.regularContentLengthMatched =
                Number(detailState.contentLength) === longText.length;
            result.detailTextVisible = detailState.textVisible === true;
            result.detailTextSelectable = detailState.textSelectable === true;
            result.detailScrollable = detailState.scrollable === true;
            result.detailButtonsPresent = detailState.copyButtonPresent === true &&
                detailState.editButtonPresent === true &&
                detailState.closeButtonPresent === true;
            result.detailWindowType = detailState.windowType;
            result.detailAddThreadName = detailState.addThreadName;

            originalWrite = global.ClipHub.Clipboard.writeText;
            try {
                global.ClipHub.Clipboard.writeText = function (text, options) {
                    capturedLength = String(text).length;
                    capturedSensitive = options && options.sensitive === true;
                    return { ok: true, written: true, contentLength: capturedLength };
                };
                result.copyClicked =
                    global.ClipHub.List.performDetailCopyClick() === true;
            } finally {
                global.ClipHub.Clipboard.writeText = originalWrite;
            }
            detailState = global.ClipHub.List.getDetailState();
            result.copyCaptured = capturedLength === longText.length;
            result.copySensitiveFlagFalse = capturedSensitive === false;
            result.detailStayedOpenAfterCopy = detailState.attachedToWindow === true;
            result.copyThreadName = detailState.actionThreadName;
            result.databaseCountStableAfterCopy =
                global.ClipHub.Repository.countItems(false) === 3;

            result.detailEditClicked =
                global.ClipHub.List.performDetailEditClick() === true;
            result.editorOpenedFromDetail = waitFor(function () {
                return global.ClipHub.Editor.getState().attachedToWindow === true;
            }, 1500);
            detailState = global.ClipHub.List.getDetailState();
            editorState = global.ClipHub.Editor.getState();
            result.detailClosedForEdit = detailState.attached === false &&
                detailState.attachedToWindow === false;
            result.editorOpenedFromDetail = result.editorOpenedFromDetail &&
                editorState.mode === "edit";
            result.editorTargetMatched = Number(editorState.itemId) === longId;
            result.detailRemoveThreadName = detailState.removeThreadName;
            global.ClipHub.Editor.performCancelClick();

            listState = global.ClipHub.List.getState();
            sensitiveIndex = indexOfId(listState.itemIds, sensitiveId);
            result.sensitiveDetailClicked =
                global.ClipHub.List.performDetailClick(sensitiveIndex) === true;
            result.sensitiveDetailAttached = waitFor(function () {
                return global.ClipHub.List.getDetailState().attachedToWindow === true;
            }, 1500);
            detailState = global.ClipHub.List.getDetailState();
            result.sensitiveDetailTargetMatched =
                Number(detailState.itemId) === sensitiveId;
            result.sensitiveFlagTrue = detailState.sensitive === true;
            result.sensitiveContentLengthMatched =
                Number(detailState.contentLength) === sensitiveText.length;
            result.sensitiveTextVisibleAfterExplicitOpen =
                detailState.textVisible === true;
            capturedLength = 0;
            capturedSensitive = null;
            originalWrite = global.ClipHub.Clipboard.writeText;
            try {
                global.ClipHub.Clipboard.writeText = function (text, options) {
                    capturedLength = String(text).length;
                    capturedSensitive = options && options.sensitive === true;
                    return { ok: true, written: true, contentLength: capturedLength };
                };
                result.sensitiveCopyClicked =
                    global.ClipHub.List.performDetailCopyClick() === true;
            } finally {
                global.ClipHub.Clipboard.writeText = originalWrite;
            }
            result.sensitiveCopyCaptured = capturedLength === sensitiveText.length;
            result.copySensitiveFlagTrue = capturedSensitive === true;
            result.closeButtonWorked =
                global.ClipHub.List.performDetailCloseClick() === true;
            detailState = global.ClipHub.List.getDetailState();
            result.detailDetachedAfterClose = detailState.attached === false &&
                detailState.attachedToWindow === false;

            global.ClipHub.List.performDetailClick(sensitiveIndex);
            result.detailReopenedBeforeStop = waitFor(function () {
                return global.ClipHub.List.getDetailState().attachedToWindow === true;
            }, 1500);
            stop = global.ClipHub.App.stop("probe019_first");
            result.firstStopped = stop.stopped === true;
            detailState = global.ClipHub.List.getDetailState();
            result.detailCleanupOnStop = detailState.attached === false &&
                detailState.attachedToWindow === false &&
                detailState.removeThreadName === "main";
            result.firstDatabaseClosed = !global.ClipHub.Database.isOpen();

            boot = start(root, modules, isolated);
            result.secondStart = boot;
            result.recordsPersistedAfterRestart =
                global.ClipHub.Repository.countItems(false) === 3;
            result.detailClosedAfterRestart =
                global.ClipHub.List.getDetailState().attached === false;
            result.editorClosedAfterRestart =
                global.ClipHub.Editor.getState().attached === false;
            global.ClipHub.List.show({ limit: 20, widthDp: 340, heightDp: 420 });
            waitFor(function () {
                return global.ClipHub.Window.getState().attachedToWindow === true;
            }, 1500);
            listState = global.ClipHub.List.getState();
            result.detailButtonsAfterRestart = listState.detailButtonCount === 2 &&
                listState.longItemCount === 2;
            result.sensitiveMaskAfterRestart =
                listState.renderedSensitiveMaskCount === 1;
            result.finalClose = global.ClipHub.Window.close();
            stop = global.ClipHub.App.stop("probe019_second");
            result.secondStopped = stop.stopped === true;
            result.secondDatabaseClosed = !global.ClipHub.Database.isOpen();
        } catch (error) {
            result.error = errorText(error);
            try { global.ClipHub.App.stop("probe019_error"); }
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
                result.firstStart.ok === true && result.seededCount === 3 &&
                result.listAttached && result.initialRenderedCount === 3 &&
                result.longItemCount === 2 && result.detailButtonCount === 2 &&
                result.sensitiveMaskCount === 1 && result.shortDetailRejected &&
                result.regularDetailClicked && result.regularDetailAttached &&
                result.regularDetailTargetMatched &&
                result.regularDetailSensitiveFalse &&
                result.regularContentLengthMatched && result.detailTextVisible &&
                result.detailTextSelectable && result.detailScrollable &&
                result.detailButtonsPresent && result.detailWindowType === 2038 &&
                result.detailAddThreadName === "main" && result.copyClicked &&
                result.copyCaptured && result.copySensitiveFlagFalse &&
                result.detailStayedOpenAfterCopy && result.copyThreadName === "main" &&
                result.databaseCountStableAfterCopy && result.detailEditClicked &&
                result.detailClosedForEdit && result.editorOpenedFromDetail &&
                result.editorTargetMatched && result.detailRemoveThreadName === "main" &&
                result.sensitiveDetailClicked && result.sensitiveDetailAttached &&
                result.sensitiveDetailTargetMatched && result.sensitiveFlagTrue &&
                result.sensitiveContentLengthMatched &&
                result.sensitiveTextVisibleAfterExplicitOpen &&
                result.sensitiveCopyClicked && result.sensitiveCopyCaptured &&
                result.copySensitiveFlagTrue && result.closeButtonWorked &&
                result.detailDetachedAfterClose && result.detailReopenedBeforeStop &&
                result.firstStopped && result.detailCleanupOnStop &&
                result.firstDatabaseClosed && result.secondStart &&
                result.secondStart.ok === true && result.recordsPersistedAfterRestart &&
                result.detailClosedAfterRestart && result.editorClosedAfterRestart &&
                result.detailButtonsAfterRestart && result.sensitiveMaskAfterRestart &&
                result.finalClose && result.finalClose.ok === true &&
                result.secondStopped && result.secondDatabaseClosed &&
                result.formalRestart && result.formalRestart.ok === true &&
                result.cleanup;
            write(output, JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try {
        global.ClipHubLongDetailProbe019Result = main();
    } catch (error) {
        global.ClipHubLongDetailProbe019Result = {
            ok: false,
            probe: "cliphub_long_detail_probe_019",
            probeVersion: 1,
            fatal: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubLongDetailProbe019Result);
