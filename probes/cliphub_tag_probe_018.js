/* ClipHub tag management probe 018. Rhino ES5 only. */
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
    var REQUIRED_SET = "20260721.17";
    var RUNTIME_NAME = "ClipHubProbe018";
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
        return { present: true,
            moduleSetVersion: String(data.moduleSetVersion || ""),
            sourceRef: String(data.sourceRef || "") };
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
            return { ok: false, initiallyRunning: false,
                error: "Formal ClipHub was not running before probe 018" };
        }
        if (!endpointFile.isFile()) {
            return { ok: false, initiallyRunning: true,
                error: "Formal control endpoint is missing" };
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
            initiallyRunning: true,
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
    function add(content, createdAt) {
        return Number(global.ClipHub.Repository.insertItem({
            content: String(content), contentType: "text",
            sourcePackage: "com.tag.probe", sourceLabel: "Tag Probe",
            sourceUid: 10000, sourceConfidence: 100,
            createdAt: Number(createdAt), lastCopiedAt: Number(createdAt),
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
    function hasTag(tags, tagId) {
        var index;
        for (index = 0; index < tags.length; index += 1) {
            if (Number(tags[index].id) === Number(tagId)) { return true; }
        }
        return false;
    }
    function payloadHasContent(events) {
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
            "cliphub_tag_probe_018_" + stamp(startedAt) + ".json");
        var local = localManifest(formal);
        var boot;
        var listState;
        var editorState;
        var panelState;
        var filterState;
        var firstId;
        var secondId;
        var thirdId;
        var workId;
        var referenceId;
        var tempId;
        var targetIndex;
        var rows;
        var tags;
        var stop;
        var tagEvents = [];
        var baseTime = startedAt - 10000;
        var result = {
            ok: false, probe: "cliphub_tag_probe_018", probeVersion: 1,
            startedAt: startedAt, finishedAt: null, durationMs: null,
            pid: Number(Packages.android.os.Process.myPid()),
            uid: Number(Packages.android.os.Process.myUid()),
            threadId: Number(Thread.currentThread().getId()),
            threadName: String(Thread.currentThread().getName()),
            moduleSetVersion: local.moduleSetVersion || null,
            sourceRef: local.sourceRef || null,
            formalControl: null, firstStart: null, schemaVersion: null,
            seededCount: 0, listAttached: false, initialRenderedCount: 0,
            tagButtonsPresent: false, tagEditorClicked: false,
            tagEditorAttached: false, tagEditorFocusable: false,
            tagInputPresent: false, tagKeyboardRequested: false,
            tagWindowType: null, tagAddThreadName: null,
            workCreated: false, workAutoAttached: false,
            referenceCreated: false, referenceRenamed: false,
            duplicateNormalized: false, workAttachedSecond: false,
            tempCreated: false, tempDeleted: false,
            itemCountUnaffectedByTagDelete: false, tagLabelsRendered: false,
            tagEventsNoContent: false, tagEventThreadName: null,
            tagOrFilterCount: 0, filterPanelOpened: false,
            tagOptionsRendered: false, tagFilterWorked: false,
            tagFilterCount: 0, keywordAndTagWorked: false,
            keywordAndTagCount: 0, tagSummaryVisible: false,
            filterResetWorked: false, activeTagFilterBeforeDetach: false,
            detachClicked: false, detachStored: false,
            filterReappliedAfterDetach: false, filteredCountAfterDetach: 0,
            editorReopenedBeforeStop: false, firstStopped: false,
            editorCleanupOnStop: false, firstDatabaseClosed: false,
            secondStart: null, tagsPersistedAfterRestart: false,
            renamedTagPersisted: false, bindingsPersistedAfterRestart: false,
            deletedTagStayedDeleted: false, recordsUnaffectedAfterRestart: false,
            filterResetAfterRestart: false, editorClosedAfterRestart: false,
            renderedTagLabelsAfterRestart: false, finalClose: null,
            secondStopped: false, secondDatabaseClosed: false,
            formalRestart: null, cleanup: false,
            outputPath: String(output.getAbsolutePath()), error: null
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
            result.schemaVersion = global.ClipHub.Database.getSchemaVersion();
            global.ClipHub.EventBus.on("tags_changed", function (payload) {
                tagEvents.push(payload || {});
            });
            firstId = add("alpha first", baseTime + 1000);
            secondId = add("beta second", baseTime + 2000);
            thirdId = add("alpha third", baseTime + 3000);
            result.seededCount = global.ClipHub.Repository.countItems(false);
            global.ClipHub.List.show({ limit: 20, widthDp: 340, heightDp: 420 });
            result.listAttached = waitFor(function () {
                return global.ClipHub.Window.getState().attachedToWindow === true;
            }, 1500);
            listState = global.ClipHub.List.getState();
            result.initialRenderedCount = listState.renderedCount;
            result.tagButtonsPresent = listState.tagButtonCount === 3;

            targetIndex = indexOfId(listState.itemIds, firstId);
            result.tagEditorClicked = global.ClipHub.List.performTagClick(targetIndex);
            result.tagEditorAttached = waitFor(function () {
                return global.ClipHub.Editor.getState().attachedToWindow === true;
            }, 1500);
            editorState = global.ClipHub.Editor.getState();
            result.tagEditorAttached = result.tagEditorAttached &&
                editorState.mode === "tags" && Number(editorState.itemId) === firstId;
            result.tagEditorFocusable = editorState.focusableWindow === true;
            result.tagInputPresent = editorState.inputPresent === true;
            result.tagKeyboardRequested = editorState.keyboardRequestCount > 0;
            result.tagWindowType = editorState.windowType;
            result.tagAddThreadName = editorState.addThreadName;

            result.workCreated = global.ClipHub.Editor.performCreateTagClick("Work");
            workId = Number(global.ClipHub.Editor.getState().lastTagId);
            tags = global.ClipHub.Repository.listItemTags(firstId);
            result.workAutoAttached = hasTag(tags, workId);
            result.referenceCreated =
                global.ClipHub.Editor.performCreateTagClick("Link");
            referenceId = Number(global.ClipHub.Editor.getState().lastTagId);
            result.referenceRenamed =
                global.ClipHub.Editor.renameTag(referenceId, "Reference");
            global.ClipHub.Editor.performCancelClick();

            listState = global.ClipHub.List.getState();
            targetIndex = indexOfId(listState.itemIds, secondId);
            global.ClipHub.List.performTagClick(targetIndex);
            waitFor(function () {
                return global.ClipHub.Editor.getState().attachedToWindow === true;
            }, 1500);
            global.ClipHub.Editor.performCreateTagClick("  work  ");
            result.duplicateNormalized =
                global.ClipHub.Repository.listTags().length === 2;
            result.workAttachedSecond = hasTag(
                global.ClipHub.Repository.listItemTags(secondId), workId);
            result.tempCreated = global.ClipHub.Editor.performCreateTagClick("Temp");
            tempId = Number(global.ClipHub.Editor.getState().lastTagId);
            result.tempDeleted = global.ClipHub.Editor.performTagDeleteClick(tempId);
            result.tempDeleted = result.tempDeleted &&
                global.ClipHub.Repository.getTagByName("temp") === null;
            result.itemCountUnaffectedByTagDelete =
                global.ClipHub.Repository.countItems(false) === 3;
            global.ClipHub.Editor.performCancelClick();
            waitFor(function () {
                return global.ClipHub.List.getState().renderedTagLabelCount === 2;
            }, 1200);
            result.tagLabelsRendered =
                global.ClipHub.List.getState().renderedTagLabelCount === 2;
            result.tagEventsNoContent = !payloadHasContent(tagEvents);
            if (tagEvents.length > 0) {
                result.tagEventThreadName =
                    String(tagEvents[tagEvents.length - 1].threadName || "");
            }

            rows = global.ClipHub.Repository.listItems({
                tagIds: [workId, referenceId], limit: 20
            });
            result.tagOrFilterCount = rows.length;
            result.filterPanelOpened = global.ClipHub.List.performFilterClick();
            result.filterPanelOpened = result.filterPanelOpened && waitFor(function () {
                return global.ClipHub.Filter.getPanelState().attachedToWindow === true;
            }, 1500);
            panelState = global.ClipHub.Filter.getPanelState();
            result.tagOptionsRendered = panelState.tagOptionCount === 2 &&
                panelState.tagChipCount === 2;
            result.tagFilterWorked = global.ClipHub.Filter.performTagClick(workId);
            waitFor(function () {
                return global.ClipHub.List.getState().renderedCount === 2;
            }, 1200);
            result.tagFilterCount = global.ClipHub.Filter.getState().lastResultCount;
            global.ClipHub.Filter.performSearch("alpha");
            waitFor(function () {
                return global.ClipHub.List.getState().renderedCount === 1;
            }, 1200);
            filterState = global.ClipHub.Filter.getState();
            result.keywordAndTagWorked = filterState.criteria.keyword === "alpha" &&
                filterState.criteria.tagIds.length === 1;
            result.keywordAndTagCount = filterState.lastResultCount;
            result.tagSummaryVisible =
                String(global.ClipHub.List.getState().filterSummary)
                    .indexOf("标签") >= 0;
            result.filterResetWorked = global.ClipHub.Filter.performResetClick();
            waitFor(function () {
                return global.ClipHub.List.getState().renderedCount === 3;
            }, 1200);
            global.ClipHub.Filter.performCloseClick();

            global.ClipHub.Filter.setTagIds([workId]);
            result.activeTagFilterBeforeDetach =
                global.ClipHub.Filter.getState().lastResultCount === 2;
            listState = global.ClipHub.List.getState();
            targetIndex = indexOfId(listState.itemIds, secondId);
            global.ClipHub.List.performTagClick(targetIndex);
            waitFor(function () {
                return global.ClipHub.Editor.getState().attachedToWindow === true;
            }, 1500);
            result.detachClicked =
                global.ClipHub.Editor.performTagToggleClick(workId);
            waitFor(function () {
                return global.ClipHub.Filter.getState().lastResultCount === 1;
            }, 1500);
            result.detachStored = !hasTag(
                global.ClipHub.Repository.listItemTags(secondId), workId);
            result.filteredCountAfterDetach =
                global.ClipHub.Filter.getState().lastResultCount;
            result.filterReappliedAfterDetach =
                global.ClipHub.Filter.getState().eventApplyCount > 0;
            global.ClipHub.Editor.performCancelClick();
            global.ClipHub.Filter.reset();

            listState = global.ClipHub.List.getState();
            targetIndex = indexOfId(listState.itemIds, firstId);
            global.ClipHub.List.performTagClick(targetIndex);
            result.editorReopenedBeforeStop = waitFor(function () {
                return global.ClipHub.Editor.getState().attachedToWindow === true;
            }, 1500);
            stop = global.ClipHub.App.stop("probe018_first");
            result.firstStopped = stop.stopped === true;
            editorState = global.ClipHub.Editor.getState();
            result.editorCleanupOnStop = editorState.attached === false &&
                editorState.attachedToWindow === false &&
                editorState.removeThreadName === "main";
            result.firstDatabaseClosed = !global.ClipHub.Database.isOpen();

            boot = start(root, modules, isolated);
            result.secondStart = boot;
            result.tagsPersistedAfterRestart =
                global.ClipHub.Repository.listTags().length === 2;
            result.renamedTagPersisted =
                global.ClipHub.Repository.getTagByName("reference") !== null;
            tags = global.ClipHub.Repository.listItemTags(firstId);
            result.bindingsPersistedAfterRestart = hasTag(tags, workId) &&
                hasTag(tags, referenceId) &&
                global.ClipHub.Repository.listItemTags(secondId).length === 0;
            result.deletedTagStayedDeleted =
                global.ClipHub.Repository.getTagByName("temp") === null;
            result.recordsUnaffectedAfterRestart =
                global.ClipHub.Repository.countItems(false) === 3;
            filterState = global.ClipHub.Filter.getState();
            result.filterResetAfterRestart = filterState.active === false &&
                filterState.criteria.tagIds.length === 0;
            result.editorClosedAfterRestart =
                global.ClipHub.Editor.getState().attached === false;
            global.ClipHub.List.show({ limit: 20, widthDp: 340, heightDp: 420 });
            waitFor(function () {
                return global.ClipHub.Window.getState().attachedToWindow === true;
            }, 1500);
            result.renderedTagLabelsAfterRestart =
                global.ClipHub.List.getState().renderedTagLabelCount === 1;
            result.finalClose = global.ClipHub.Window.close();
            stop = global.ClipHub.App.stop("probe018_second");
            result.secondStopped = stop.stopped === true;
            result.secondDatabaseClosed = !global.ClipHub.Database.isOpen();
        } catch (error) {
            result.error = errorText(error);
            try { global.ClipHub.App.stop("probe018_error"); }
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
                result.seededCount === 3 && result.listAttached &&
                result.initialRenderedCount === 3 && result.tagButtonsPresent &&
                result.tagEditorClicked && result.tagEditorAttached &&
                result.tagEditorFocusable && result.tagInputPresent &&
                result.tagKeyboardRequested && result.tagWindowType === 2038 &&
                result.tagAddThreadName === "main" && result.workCreated &&
                result.workAutoAttached && result.referenceCreated &&
                result.referenceRenamed && result.duplicateNormalized &&
                result.workAttachedSecond && result.tempCreated &&
                result.tempDeleted && result.itemCountUnaffectedByTagDelete &&
                result.tagLabelsRendered && result.tagEventsNoContent &&
                result.tagEventThreadName === "main" &&
                result.tagOrFilterCount === 2 && result.filterPanelOpened &&
                result.tagOptionsRendered && result.tagFilterWorked &&
                result.tagFilterCount === 2 && result.keywordAndTagWorked &&
                result.keywordAndTagCount === 1 && result.tagSummaryVisible &&
                result.filterResetWorked && result.activeTagFilterBeforeDetach &&
                result.detachClicked && result.detachStored &&
                result.filterReappliedAfterDetach &&
                result.filteredCountAfterDetach === 1 &&
                result.editorReopenedBeforeStop && result.firstStopped &&
                result.editorCleanupOnStop && result.firstDatabaseClosed &&
                result.secondStart && result.secondStart.ok === true &&
                result.tagsPersistedAfterRestart && result.renamedTagPersisted &&
                result.bindingsPersistedAfterRestart &&
                result.deletedTagStayedDeleted &&
                result.recordsUnaffectedAfterRestart &&
                result.filterResetAfterRestart &&
                result.editorClosedAfterRestart &&
                result.renderedTagLabelsAfterRestart && result.finalClose &&
                result.finalClose.ok === true && result.secondStopped &&
                result.secondDatabaseClosed && result.formalRestart &&
                result.formalRestart.ok === true && result.cleanup;
            write(output, JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try {
        global.ClipHubTagProbe018Result = main();
    } catch (error) {
        global.ClipHubTagProbe018Result = {
            ok: false, probe: "cliphub_tag_probe_018", probeVersion: 1,
            fatal: true, error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubTagProbe018Result);
