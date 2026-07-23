/* ClipHub list and detail visual regression probe 027. Rhino ES5 only. */
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

    var REQUIRED_SET = "20260722.21";
    var RUNTIME_NAME = "ClipHubProbe027";
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
    function add(content, sensitive, pinned, source, createdAt) {
        return Number(global.ClipHub.Repository.insertItem({
            content: String(content),
            contentType: "text",
            sourcePackage: "com.visual.probe027",
            sourceLabel: String(source),
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
    function noContent(events) {
        var index;
        for (index = 0; index < events.length; index += 1) {
            if (JSON.stringify(events[index]).indexOf("content") >= 0) {
                return false;
            }
        }
        return true;
    }

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var formal = new File(root, "ClipHub");
        var modules = new File(formal, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var outputFile = new File(ensureDir(new File(formal, "probes")),
            "cliphub_list_detail_visual_probe_027_" + stamp(startedAt) + ".json");
        var local = localManifest(formal);
        var baseTime = startedAt - 20000;
        var normalId;
        var longId;
        var sensitiveId;
        var taggedId;
        var tagId;
        var list;
        var detail;
        var editor;
        var index;
        var otherIndex;
        var beforeWindow;
        var afterWindow;
        var copied = [];
        var events = [];
        var originalWriteText;
        var stop;
        var result = {
            ok: false,
            probe: "cliphub_list_detail_visual_probe_027",
            probeVersion: 1,
            startedAt: startedAt,
            moduleSetVersion: local.moduleSetVersion || null,
            sourceRef: local.sourceRef || null,
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
            result.firstStart = start(root, modules, isolated);
            result.schemaVersion = global.ClipHub.Database.getVersion();
            result.clipboardListenerStopped =
                global.ClipHub.Clipboard.stop().running === false;
            originalWriteText = global.ClipHub.Clipboard.writeText;
            global.ClipHub.Clipboard.writeText = function (text, options) {
                copied.push({ length: String(text).length,
                    sensitive: !!(options && options.sensitive) });
                return { ok: true, written: true };
            };
            global.ClipHub.EventBus.on("clipboard_merged", function (payload) {
                events.push(payload || {});
            });
            global.ClipHub.EventBus.on("clipboard_deleted", function (payload) {
                events.push(payload || {});
            });
            global.ClipHub.EventBus.on("clipboard_restored", function (payload) {
                events.push(payload || {});
            });

            normalId = add("普通卡片视觉回归", false, false,
                "来源应用名称较长用于验证元数据独立一行", baseTime + 1000);
            longId = add(repeatText("长文本详情视觉", 55), false, false,
                "Long Detail Source", baseTime + 2000);
            sensitiveId = add(repeatText("敏感详情视觉", 45) +
                "\n第二行\n第三行\n第四行", true, false,
                "Sensitive Detail Source", baseTime + 3000);
            taggedId = add("标签与置顶操作区视觉回归", false, true,
                "Tagged Pinned Source", baseTime + 4000);
            tagId = Number(global.ClipHub.Repository.ensureTag("视觉标签"));
            global.ClipHub.Repository.attachTag(taggedId, tagId);
            result.seededCount = global.ClipHub.Repository.countItems(false);

            global.ClipHub.List.show({ limit: 20, widthDp: 300, heightDp: 500 });
            result.listAttached = waitFor(function () {
                return global.ClipHub.Window.getState().attachedToWindow === true;
            }, 1500);
            list = global.ClipHub.List.getState();
            result.initialRenderedCount = list.renderedCount;
            result.metaRowsPresent = list.metaRowCount === 4;
            result.actionRowsPresent = list.actionRowCount === 4;
            result.allCardActionsPresent = list.tagButtonCount === 4 &&
                list.pinButtonCount === 4 && list.editButtonCount === 4 &&
                list.detailButtonCount === 2;
            result.reorderHandlesPresent = list.reorderHandleCount === 4;
            result.tagLabelPresent = list.renderedTagLabelCount === 1;
            result.sensitiveMaskPresent = list.renderedSensitiveMaskCount === 1;

            index = indexOfId(list.itemIds, normalId);
            result.cardClickWorked = global.ClipHub.List.performItemClick(index);
            result.cardCopyCaptured = copied.length === 1 &&
                copied[0].sensitive === false;
            result.databaseStableAfterCopy =
                global.ClipHub.Repository.countItems(false) === 4;

            list = global.ClipHub.List.getState();
            index = indexOfId(list.itemIds, taggedId);
            result.tagButtonWorked = global.ClipHub.List.performTagClick(index);
            result.tagEditorOpened = waitFor(function () {
                return global.ClipHub.Editor.getState().attachedToWindow === true;
            }, 1200);
            editor = global.ClipHub.Editor.getState();
            result.tagEditorTargetMatched = editor.mode === "tags" &&
                Number(editor.itemId) === Number(taggedId);
            global.ClipHub.Editor.performCancelClick();

            list = global.ClipHub.List.getState();
            index = indexOfId(list.itemIds, normalId);
            result.editButtonWorked = global.ClipHub.List.performEditClick(index);
            result.editEditorOpened = waitFor(function () {
                return global.ClipHub.Editor.getState().attachedToWindow === true;
            }, 1200);
            editor = global.ClipHub.Editor.getState();
            result.editEditorTargetMatched = editor.mode === "edit" &&
                Number(editor.itemId) === Number(normalId);
            global.ClipHub.Editor.performCancelClick();

            list = global.ClipHub.List.getState();
            index = indexOfId(list.itemIds, normalId);
            result.pinButtonWorked = global.ClipHub.List.performPinClick(index);
            result.pinStored = Number(global.ClipHub.Repository
                .getItem(normalId, false).is_pinned) === 1;

            list = global.ClipHub.List.getState();
            index = indexOfId(list.itemIds, taggedId);
            result.deleteButtonWorked = global.ClipHub.List.performDeleteClick(index);
            result.deleteStored = global.ClipHub.Repository.getItem(taggedId, false) === null;
            result.undoAvailable = global.ClipHub.List.getState().undoAvailable === true;
            result.undoWorked = global.ClipHub.List.performUndoClick();
            result.undoRestored = global.ClipHub.Repository.getItem(taggedId, false) !== null;

            list = global.ClipHub.List.getState();
            index = indexOfId(list.itemIds, normalId);
            otherIndex = indexOfId(list.itemIds, taggedId);
            beforeWindow = global.ClipHub.Window.getState();
            result.reorderTouchWorked =
                global.ClipHub.List.performReorderHandleDrag(index, otherIndex);
            afterWindow = global.ClipHub.Window.getState();
            result.reorderCommitted = global.ClipHub.List.getState().reorderCount > 0;
            result.reorderThreadMain =
                global.ClipHub.List.getState().reorderThreadName === "main";
            result.windowDragUnchanged = Number(beforeWindow.dragMoveCount) ===
                Number(afterWindow.dragMoveCount);

            list = global.ClipHub.List.getState();
            index = indexOfId(list.itemIds, longId);
            result.regularDetailOpened = global.ClipHub.List.performDetailClick(index);
            result.regularDetailAttached = waitFor(function () {
                return global.ClipHub.List.getDetailState().attachedToWindow === true;
            }, 1200);
            detail = global.ClipHub.List.getDetailState();
            result.detailModal = detail.modal === true;
            result.detailOpaque = detail.opaque === true;
            result.detailDimFlagPresent = detail.dimFlagPresent === true;
            result.detailDimAmount = detail.dimAmount;
            result.detailNotTouchModalAbsent = detail.notTouchModalAbsent === true;
            result.detailMainWindowHidden = detail.mainWindowHidden === true;
            result.mainWindowDetachedDuringDetail =
                global.ClipHub.Window.getState().attached === false;
            result.detailButtonsPresent = detail.copyButtonPresent === true &&
                detail.editButtonPresent === true && detail.closeButtonPresent === true;
            result.detailWindowType = detail.windowType;
            result.detailAddThreadMain = detail.addThreadName === "main";
            result.detailCopyWorked = global.ClipHub.List.performDetailCopyClick();
            result.regularDetailCopyCaptured = copied.length === 2 &&
                copied[1].sensitive === false;
            result.detailStayedOpenAfterCopy =
                global.ClipHub.List.getDetailState().attached === true;
            result.detailCloseWorked = global.ClipHub.List.performDetailCloseClick();
            result.detailClosed = global.ClipHub.List.getDetailState().attached === false;
            result.mainListRestoredAfterDetail = waitFor(function () {
                return global.ClipHub.Window.getState().attachedToWindow === true;
            }, 1200);
            result.listRenderedAfterDetailClose =
                global.ClipHub.List.getState().renderedCount === 4;
            result.detailRestoreCountPositive =
                global.ClipHub.List.getState().detailListRestoreCount > 0;

            list = global.ClipHub.List.getState();
            index = indexOfId(list.itemIds, sensitiveId);
            result.sensitiveDetailOpened = global.ClipHub.List.performDetailClick(index);
            waitFor(function () {
                return global.ClipHub.List.getDetailState().attachedToWindow === true;
            }, 1200);
            detail = global.ClipHub.List.getDetailState();
            result.sensitiveDetailFlag = detail.sensitive === true;
            result.sensitiveDetailCopyWorked =
                global.ClipHub.List.performDetailCopyClick();
            result.sensitiveCopyCaptured = copied.length === 3 &&
                copied[2].sensitive === true;
            global.ClipHub.List.performDetailCloseClick();
            waitFor(function () {
                return global.ClipHub.Window.getState().attachedToWindow === true;
            }, 1200);

            list = global.ClipHub.List.getState();
            index = indexOfId(list.itemIds, longId);
            global.ClipHub.List.performDetailClick(index);
            waitFor(function () {
                return global.ClipHub.List.getDetailState().attachedToWindow === true;
            }, 1200);
            result.detailEditWorked = global.ClipHub.List.performDetailEditClick();
            result.detailClosedForEdit =
                global.ClipHub.List.getDetailState().attached === false;
            result.editorOpenedFromDetail = waitFor(function () {
                return global.ClipHub.Editor.getState().attachedToWindow === true;
            }, 1200);
            editor = global.ClipHub.Editor.getState();
            result.editorTargetFromDetailMatched = editor.mode === "edit" &&
                Number(editor.itemId) === Number(longId);
            result.mainListRestoredBehindEditor =
                global.ClipHub.Window.getState().attached === true;
            global.ClipHub.Editor.performCancelClick();

            list = global.ClipHub.List.getState();
            index = indexOfId(list.itemIds, longId);
            global.ClipHub.List.performDetailClick(index);
            result.detailReopenedBeforeStop = waitFor(function () {
                return global.ClipHub.List.getDetailState().attachedToWindow === true;
            }, 1200);
            result.eventsNoContent = noContent(events);
            global.ClipHub.Clipboard.writeText = originalWriteText;
            stop = global.ClipHub.App.stop("probe027_first");
            result.firstStopped = stop.stopped === true;
            result.detailCleanupOnStop =
                global.ClipHub.List.getDetailState().attached === false;
            result.firstDatabaseClosed = !global.ClipHub.Database.isOpen();

            result.secondStart = start(root, modules, isolated);
            result.recordsPersistedAfterRestart =
                global.ClipHub.Repository.countItems(false) === 4;
            result.pinPersistedAfterRestart = Number(global.ClipHub.Repository
                .getItem(normalId, false).is_pinned) === 1;
            result.detailClosedAfterRestart =
                global.ClipHub.List.getDetailState().attached === false;
            result.editorClosedAfterRestart =
                global.ClipHub.Editor.getState().attached === false;
            global.ClipHub.List.show({ limit: 20, widthDp: 300, heightDp: 500 });
            waitFor(function () {
                return global.ClipHub.Window.getState().attachedToWindow === true;
            }, 1200);
            list = global.ClipHub.List.getState();
            result.metaRowsAfterRestart = list.metaRowCount === 4;
            result.actionRowsAfterRestart = list.actionRowCount === 4;
            result.buttonsAfterRestart = list.tagButtonCount === 4 &&
                list.pinButtonCount === 4 && list.editButtonCount === 4 &&
                list.detailButtonCount === 2;
            result.handlesAfterRestart = list.reorderHandleCount === 4;
            result.finalClose = global.ClipHub.Window.close();
            stop = global.ClipHub.App.stop("probe027_second");
            result.secondStopped = stop.stopped === true;
            result.secondDatabaseClosed = !global.ClipHub.Database.isOpen();
        } catch (error) {
            result.error = errorText(error);
            try { global.ClipHub.App.stop("probe027_error"); }
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
                result.clipboardListenerStopped && result.seededCount === 4 &&
                result.listAttached && result.initialRenderedCount === 4 &&
                result.metaRowsPresent && result.actionRowsPresent &&
                result.allCardActionsPresent && result.reorderHandlesPresent &&
                result.tagLabelPresent && result.sensitiveMaskPresent &&
                result.cardClickWorked && result.cardCopyCaptured &&
                result.databaseStableAfterCopy && result.tagButtonWorked &&
                result.tagEditorOpened && result.tagEditorTargetMatched &&
                result.editButtonWorked && result.editEditorOpened &&
                result.editEditorTargetMatched && result.pinButtonWorked &&
                result.pinStored && result.deleteButtonWorked &&
                result.deleteStored && result.undoAvailable && result.undoWorked &&
                result.undoRestored && result.reorderTouchWorked &&
                result.reorderCommitted && result.reorderThreadMain &&
                result.windowDragUnchanged && result.regularDetailOpened &&
                result.regularDetailAttached && result.detailModal &&
                result.detailOpaque && result.detailDimFlagPresent &&
                result.detailDimAmount >= 0.7 &&
                result.detailNotTouchModalAbsent && result.detailMainWindowHidden &&
                result.mainWindowDetachedDuringDetail &&
                result.detailButtonsPresent && result.detailWindowType === 2038 &&
                result.detailAddThreadMain && result.detailCopyWorked &&
                result.regularDetailCopyCaptured &&
                result.detailStayedOpenAfterCopy && result.detailCloseWorked &&
                result.detailClosed && result.mainListRestoredAfterDetail &&
                result.listRenderedAfterDetailClose &&
                result.detailRestoreCountPositive && result.sensitiveDetailOpened &&
                result.sensitiveDetailFlag && result.sensitiveDetailCopyWorked &&
                result.sensitiveCopyCaptured && result.detailEditWorked &&
                result.detailClosedForEdit && result.editorOpenedFromDetail &&
                result.editorTargetFromDetailMatched &&
                result.mainListRestoredBehindEditor &&
                result.detailReopenedBeforeStop && result.eventsNoContent &&
                result.firstStopped && result.detailCleanupOnStop &&
                result.firstDatabaseClosed && result.secondStart &&
                result.secondStart.ok === true &&
                result.recordsPersistedAfterRestart &&
                result.pinPersistedAfterRestart &&
                result.detailClosedAfterRestart &&
                result.editorClosedAfterRestart && result.metaRowsAfterRestart &&
                result.actionRowsAfterRestart && result.buttonsAfterRestart &&
                result.handlesAfterRestart && result.finalClose &&
                result.finalClose.ok === true && result.secondStopped &&
                result.secondDatabaseClosed && result.formalRestart &&
                result.formalRestart.ok === true && result.cleanup;
            write(outputFile, JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try {
        global.ClipHubListDetailVisualProbe027Result = main();
    } catch (error) {
        global.ClipHubListDetailVisualProbe027Result = {
            ok: false,
            probe: "cliphub_list_detail_visual_probe_027",
            probeVersion: 1,
            fatal: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubListDetailVisualProbe027Result);
