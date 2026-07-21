/* ClipHub combined filter probe 015. Rhino ES5 only. */
(function (global) {
    var File = Packages.java.io.File;
    var FIS = Packages.java.io.FileInputStream;
    var FOS = Packages.java.io.FileOutputStream;
    var BAOS = Packages.java.io.ByteArrayOutputStream;
    var ArrayClass = Packages.java.lang.reflect.Array;
    var JavaByte = Packages.java.lang.Byte;
    var JavaString = Packages.java.lang.String;
    var Thread = Packages.java.lang.Thread;
    var System = Packages.java.lang.System;
    var RAF = Packages.java.io.RandomAccessFile;
    var SDF = Packages.java.text.SimpleDateFormat;
    var Locale = Packages.java.util.Locale;
    var Intent = Packages.android.content.Intent;
    var REQUIRED_SET = "20260721.14";
    var RUNTIME_NAME = "ClipHubProbe015";
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
    function read(file) {
        var input = null;
        var output = null;
        var buffer = ArrayClass.newInstance(JavaByte.TYPE, 8192);
        var count;
        try {
            input = new FIS(file);
            output = new BAOS();
            while ((count = input.read(buffer)) >= 0) {
                if (count > 0) { output.write(buffer, 0, count); }
            }
            return String(new JavaString(output.toByteArray(), "UTF-8"));
        } finally { close(input); close(output); }
    }
    function write(file, text) {
        var output = null;
        try {
            output = new FOS(file, false);
            output.write(new JavaString(String(text)).getBytes("UTF-8"));
            output.flush();
        } finally { close(output); }
    }
    function ensureDir(file) {
        if (!file.exists() && !file.mkdirs() && !file.isDirectory()) {
            throw new Error("Cannot create: " + file.getAbsolutePath());
        }
        return file;
    }
    function removeTree(file) {
        var children;
        var i;
        var ok = true;
        if (!file.exists()) { return true; }
        if (file.isDirectory()) {
            children = file.listFiles();
            if (children !== null) {
                for (i = 0; i < children.length; i += 1) {
                    if (!removeTree(children[i])) { ok = false; }
                }
            }
        }
        if (file.exists() && !file.delete()) { ok = false; }
        return ok;
    }
    function waitFor(test, timeoutMs) {
        var start = now();
        while (now() - start < timeoutMs) {
            if (test()) { return true; }
            Thread.sleep(25);
        }
        return test();
    }
    function lockFree(runtimeDir) {
        var raf = null;
        var channel = null;
        var lock = null;
        try {
            raf = new RAF(new File(ensureDir(new File(runtimeDir, "data")),
                "cliphub.lock"), "rw");
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
            close(channel); close(raf);
        }
    }
    function manifest(runtimeDir) {
        var file = new File(new File(runtimeDir, "cache"),
            "module-manifest.local.json");
        return file.isFile() ? JSON.parse(read(file)) : null;
    }
    function stopFormal(context, runtimeDir) {
        var cache = ensureDir(new File(runtimeDir, "cache"));
        var endpointFile = new File(cache, "control_endpoint.json");
        var endpoint;
        var requestId;
        var ackFile;
        var intent;
        var ack = null;
        if (lockFree(runtimeDir)) {
            return { ok: false, error: "Formal ClipHub was not running" };
        }
        if (!endpointFile.isFile()) {
            return { ok: false, error: "Formal control endpoint missing" };
        }
        endpoint = JSON.parse(read(endpointFile));
        requestId = stamp(now()) + "-" + Number(Thread.currentThread().getId());
        ackFile = new File(cache, "control_ack_" + requestId + ".json");
        intent = new Intent(String(endpoint.action));
        intent.putExtra("runtimeDir", String(runtimeDir.getAbsolutePath()));
        intent.putExtra("command", "stop");
        intent.putExtra("requestId", requestId);
        intent.putExtra("controlToken", String(endpoint.token));
        context.sendBroadcast(intent);
        waitFor(function () { return ackFile.isFile() && lockFree(runtimeDir); }, 3000);
        if (ackFile.isFile()) {
            ack = JSON.parse(read(ackFile));
            ackFile.delete();
        }
        return {
            ok: ack !== null && ack.ok === true && ack.stopped === true &&
                lockFree(runtimeDir) && !endpointFile.exists(),
            ack: ack,
            lockReleased: lockFree(runtimeDir),
            endpointRemoved: !endpointFile.exists(),
            error: ack === null ? "Control acknowledgement missing" : null
        };
    }
    function start(root, moduleDir, runtimeDir) {
        var i;
        var file;
        global.ClipHub = {};
        for (i = 0; i < MODULES.length; i += 1) {
            file = new File(moduleDir, MODULES[i]);
            if (!file.isFile()) { throw new Error("Missing module: " + MODULES[i]); }
            eval(read(file));
        }
        return global.ClipHub.App.start({
            shortxRoot: root,
            runtimeDir: String(runtimeDir.getAbsolutePath()),
            moduleDir: String(moduleDir.getAbsolutePath()),
            androidContext: global.context
        });
    }
    function counts(rows, key) {
        var result = {};
        var i;
        for (i = 0; i < rows.length; i += 1) {
            result[String(rows[i][key])] = Number(rows[i].item_count || 0);
        }
        return result;
    }
    function add(item) { return Number(global.ClipHub.Repository.insertItem(item)); }

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var formal = new File(root, "ClipHub");
        var modules = new File(formal, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var output = new File(ensureDir(new File(formal, "probes")),
            "cliphub_filter_probe_015_" + stamp(startedAt) + ".json");
        var local = manifest(formal);
        var boot;
        var stop;
        var rows;
        var sources;
        var types;
        var sourceCounts;
        var typeCounts;
        var filterEvents = [];
        var filterListener;
        var deletedId;
        var eventId;
        var state;
        var result = {
            ok: false,
            probe: "cliphub_filter_probe_015",
            probeVersion: 1,
            startedAt: startedAt,
            moduleSetVersion: local ? String(local.moduleSetVersion || "") : null,
            sourceRef: local ? String(local.sourceRef || "") : null,
            formalControl: null,
            firstStart: null,
            seededActiveCount: 0,
            seededDeletedCount: 0,
            windowAttached: false,
            initialRenderedCount: 0,
            sourceOptionsMatched: false,
            contentTypeOptionsMatched: false,
            keywordCount: 0,
            sourceCount: 0,
            contentTypeCount: 0,
            combinedCount: 0,
            multiCombinedCount: 0,
            sourceLabelSearchCount: 0,
            literalWildcardCount: 0,
            injectionSafe: false,
            deletedExcluded: false,
            pinnedOnlyCount: 0,
            normalizedCriteria: false,
            filteredEmptyState: false,
            filterEventNoContent: false,
            eventFilterReapplied: false,
            eventApplyCount: 0,
            renderThreadName: null,
            resetRestoredAll: false,
            firstStopped: false,
            firstDatabaseClosed: false,
            secondStart: null,
            filterResetAfterRestart: false,
            renderedAllAfterRestart: false,
            finalClose: null,
            secondStopped: false,
            secondDatabaseClosed: false,
            formalRestart: null,
            cleanup: false,
            outputPath: String(output.getAbsolutePath()),
            error: null
        };
        if (!local || String(local.moduleSetVersion) !== REQUIRED_SET) {
            throw new Error("Installed module set must be " + REQUIRED_SET);
        }
        try {
            result.formalControl = stopFormal(global.context, formal);
            if (!result.formalControl.ok || !result.formalControl.ack ||
                    String(result.formalControl.ack.threadName || "") !== "main") {
                throw new Error(result.formalControl.error || "Formal stop failed");
            }
            removeTree(isolated);
            boot = start(root, modules, isolated);
            result.firstStart = boot;
            add({ content: "alpha invoice 100%_literal", contentType: "text",
                sourcePackage: "com.alpha", sourceLabel: "Alpha Source" });
            add({ content: "beta project link", contentType: "url",
                sourcePackage: "com.beta", sourceLabel: "Beta Source" });
            add({ content: "alpha phone entry", contentType: "phone",
                sourcePackage: "com.alpha", sourceLabel: "Alpha Source" });
            add({ content: "gamma memo", contentType: "text", isPinned: true,
                sourcePackage: "com.gamma", sourceLabel: "Gamma Source" });
            add({ content: "alpha documentation link", contentType: "url",
                sourcePackage: "com.alpha", sourceLabel: "Alpha Source" });
            add({ content: "shared alpha note", contentType: "text",
                sourcePackage: "com.beta", sourceLabel: "Beta Source" });
            deletedId = add({ content: "deleted marker alpha", contentType: "text",
                sourcePackage: "com.alpha", sourceLabel: "Alpha Source" });
            global.ClipHub.Repository.softDeleteItem(deletedId);
            result.seededActiveCount = global.ClipHub.Repository.countItems(false);
            result.seededDeletedCount = global.ClipHub.Repository.countItems(true) -
                result.seededActiveCount;
            global.ClipHub.List.show({ limit: 20, widthDp: 340, heightDp: 420 });
            result.windowAttached = waitFor(function () {
                return global.ClipHub.Window.getState().attachedToWindow === true;
            }, 1500);
            result.initialRenderedCount = global.ClipHub.List.getState().renderedCount;

            filterListener = function (payload) { filterEvents.push(payload); };
            global.ClipHub.EventBus.on("filter_changed", filterListener);
            sources = global.ClipHub.Filter.getSourceOptions();
            types = global.ClipHub.Filter.getContentTypeOptions();
            sourceCounts = counts(sources, "source_package");
            typeCounts = counts(types, "content_type");
            result.sourceOptionsMatched = sources.length === 3 &&
                sourceCounts["com.alpha"] === 3 && sourceCounts["com.beta"] === 2 &&
                sourceCounts["com.gamma"] === 1;
            result.contentTypeOptionsMatched = types.length === 3 &&
                typeCounts.text === 3 && typeCounts.url === 2 && typeCounts.phone === 1;

            global.ClipHub.Filter.setKeyword("alpha");
            result.keywordCount = global.ClipHub.Filter.getState().lastResultCount;
            global.ClipHub.Filter.reset();
            global.ClipHub.Filter.setSourcePackages(["com.alpha"]);
            result.sourceCount = global.ClipHub.Filter.getState().lastResultCount;
            global.ClipHub.Filter.reset();
            global.ClipHub.Filter.setContentTypes(["url"]);
            result.contentTypeCount = global.ClipHub.Filter.getState().lastResultCount;
            global.ClipHub.Filter.set({ keyword: "alpha",
                sourcePackages: ["com.alpha"], contentTypes: ["url"] });
            result.combinedCount = global.ClipHub.Filter.getState().lastResultCount;
            global.ClipHub.Filter.set({ keyword: " alpha ",
                sourcePackages: ["", "com.alpha", "com.beta", "com.alpha"],
                contentTypes: ["text", "url", "text"] });
            state = global.ClipHub.Filter.getState();
            result.multiCombinedCount = state.lastResultCount;
            result.normalizedCriteria = state.criteria.keyword === "alpha" &&
                state.criteria.sourcePackages.length === 2 &&
                state.criteria.contentTypes.length === 2;
            global.ClipHub.Filter.reset();
            global.ClipHub.Filter.setKeyword("Beta Source");
            result.sourceLabelSearchCount = global.ClipHub.Filter.getState().lastResultCount;
            global.ClipHub.Filter.setKeyword("%_literal");
            result.literalWildcardCount = global.ClipHub.Filter.getState().lastResultCount;
            global.ClipHub.Filter.setKeyword("%' OR 1=1 --");
            result.injectionSafe = global.ClipHub.Filter.getState().lastResultCount === 0;
            state = global.ClipHub.List.getState();
            result.filteredEmptyState = state.emptyVisible === true &&
                state.renderedCount === 0;
            global.ClipHub.Filter.setKeyword("deleted marker");
            result.deletedExcluded = global.ClipHub.Filter.getState().lastResultCount === 0;
            global.ClipHub.Filter.reset();
            global.ClipHub.Filter.setPinnedOnly(true);
            result.pinnedOnlyCount = global.ClipHub.Filter.getState().lastResultCount;

            global.ClipHub.Filter.set({ keyword: "alpha", sourcePackages: [],
                contentTypes: [], pinnedOnly: false });
            eventId = add({ content: "alpha event record", contentType: "text",
                sourcePackage: "com.gamma", sourceLabel: "Gamma Source" });
            global.ClipHub.EventBus.emit("clipboard_added", { id: eventId });
            result.eventFilterReapplied = waitFor(function () {
                return global.ClipHub.Filter.getState().lastResultCount === 5 &&
                    global.ClipHub.List.getState().renderedCount === 5;
            }, 1200);
            state = global.ClipHub.Filter.getState();
            result.eventApplyCount = state.eventApplyCount;
            result.renderThreadName = global.ClipHub.List.getState().renderThreadName;
            result.filterEventNoContent = filterEvents.length > 0;
            for (rows = 0; rows < filterEvents.length; rows += 1) {
                if (JSON.stringify(filterEvents[rows]).indexOf("content") >= 0) {
                    result.filterEventNoContent = false;
                }
            }
            global.ClipHub.EventBus.off("filter_changed", filterListener);
            global.ClipHub.Filter.reset();
            result.resetRestoredAll = global.ClipHub.Filter.getState().lastResultCount === 7 &&
                global.ClipHub.List.getState().renderedCount === 7;

            stop = global.ClipHub.App.stop("probe015_first");
            result.firstStopped = stop.stopped === true;
            result.firstDatabaseClosed = !global.ClipHub.Database.isOpen();
            boot = start(root, modules, isolated);
            result.secondStart = boot;
            global.ClipHub.List.show({ limit: 20, widthDp: 340, heightDp: 420 });
            waitFor(function () {
                return global.ClipHub.Window.getState().attachedToWindow === true;
            }, 1500);
            state = global.ClipHub.Filter.getState();
            result.filterResetAfterRestart = state.active === false &&
                state.criteria.keyword === "" &&
                state.criteria.sourcePackages.length === 0 &&
                state.criteria.contentTypes.length === 0;
            result.renderedAllAfterRestart =
                global.ClipHub.List.getState().renderedCount === 7;
            result.finalClose = global.ClipHub.Window.close();
            stop = global.ClipHub.App.stop("probe015_second");
            result.secondStopped = stop.stopped === true;
            result.secondDatabaseClosed = !global.ClipHub.Database.isOpen();
        } catch (error) {
            result.error = String(error);
            try { global.ClipHub.App.stop("probe015_error"); } catch (ignored) {}
        } finally {
            try {
                result.formalRestart = lockFree(formal)
                    ? start(root, modules, formal)
                    : { ok: true, started: true, reused: true };
            } catch (restartError) {
                if (result.error === null) {
                    result.error = "Formal restart failed: " + String(restartError);
                }
            }
            result.cleanup = removeTree(isolated);
            result.finishedAt = now();
            result.durationMs = result.finishedAt - result.startedAt;
            result.ok = result.error === null && result.formalControl &&
                result.formalControl.ok === true && result.firstStart &&
                result.firstStart.ok === true && result.seededActiveCount === 6 &&
                result.seededDeletedCount === 1 && result.windowAttached &&
                result.initialRenderedCount === 6 && result.sourceOptionsMatched &&
                result.contentTypeOptionsMatched && result.keywordCount === 4 &&
                result.sourceCount === 3 && result.contentTypeCount === 2 &&
                result.combinedCount === 1 && result.multiCombinedCount === 3 &&
                result.sourceLabelSearchCount === 2 &&
                result.literalWildcardCount === 1 && result.injectionSafe &&
                result.deletedExcluded && result.pinnedOnlyCount === 1 &&
                result.normalizedCriteria && result.filteredEmptyState &&
                result.filterEventNoContent && result.eventFilterReapplied &&
                result.eventApplyCount > 0 && result.renderThreadName === "main" &&
                result.resetRestoredAll && result.firstStopped &&
                result.firstDatabaseClosed && result.secondStart &&
                result.secondStart.ok === true && result.filterResetAfterRestart &&
                result.renderedAllAfterRestart && result.finalClose &&
                result.finalClose.ok === true && result.secondStopped &&
                result.secondDatabaseClosed && result.formalRestart &&
                result.formalRestart.ok === true && result.cleanup;
            write(output, JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try { global.ClipHubFilterProbe015Result = main(); }
    catch (error) {
        global.ClipHubFilterProbe015Result = {
            ok: false, probe: "cliphub_filter_probe_015", probeVersion: 1,
            fatal: true, error: String(error)
        };
    }
}((function () { return this; }())));
JSON.stringify(ClipHubFilterProbe015Result);
