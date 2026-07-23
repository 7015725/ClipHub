/* ClipHub Unicode keyword search probe 024. Rhino ES5 only. */
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
    var RUNTIME_NAME = "ClipHubProbe024";
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
    function add(content, sourceLabel, createdAt) {
        return Number(global.ClipHub.Repository.insertItem({
            content: String(content),
            contentType: "text",
            sourcePackage: "com.search.probe",
            sourceLabel: String(sourceLabel),
            sourceUid: 10000,
            sourceConfidence: 100,
            createdAt: Number(createdAt),
            lastCopiedAt: Number(createdAt),
            updatedAt: Number(createdAt)
        }));
    }
    function countValue(row) {
        if (row === null || row === undefined) { return -1; }
        if (row.hasOwnProperty("item_count")) {
            return Number(row.item_count);
        }
        if (row.hasOwnProperty("count_value")) {
            return Number(row.count_value);
        }
        return -1;
    }

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var formal = new File(root, "ClipHub");
        var modules = new File(formal, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var outputFile = new File(ensureDir(new File(formal, "probes")),
            "cliphub_unicode_search_probe_024_" +
                stamp(startedAt) + ".json");
        var local = localManifest(formal);
        var baseTime = startedAt - 10000;
        var chineseId;
        var normalId;
        var asciiId;
        var stored;
        var row;
        var rows;
        var stop;
        var result = {
            ok: false,
            probe: "cliphub_unicode_search_probe_024",
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
            if (!result.formalControl.ok ||
                    !result.formalControl.ackReceived ||
                    String(result.formalControl.ack.threadName || "") !==
                        "main") {
                throw new Error(result.formalControl.error ||
                    "Formal stop failed");
            }
            removeTree(isolated);
            result.firstStart = start(root, modules, isolated);
            result.schemaVersion =
                global.ClipHub.Database.getVersion();
            result.clipboardListenerStopped =
                global.ClipHub.Clipboard.stop().running === false;

            chineseId = add(
                "长文本视觉-0 长文本视觉-1 长文本视觉-2",
                "Long Visual Source", baseTime + 1000);
            normalId = add(
                "普通中文内容",
                "中文来源", baseTime + 2000);
            asciiId = add(
                "alpha sample content",
                "ASCII Source", baseTime + 3000);
            result.seededCount =
                global.ClipHub.Repository.countItems(false);

            stored = global.ClipHub.Repository.getItem(chineseId, false);
            result.storedChineseVisible =
                stored !== null &&
                String(stored.content).indexOf("长文本视觉") >= 0;

            row = global.ClipHub.Database.queryOne(
                "SELECT COUNT(*) AS item_count FROM clipboard_items " +
                "WHERE deleted_at IS NULL AND content LIKE ?",
                ["%长文本视觉%"]);
            result.rawLikeNoEscapeCount = countValue(row);

            row = global.ClipHub.Database.queryOne(
                "SELECT COUNT(*) AS item_count FROM clipboard_items " +
                "WHERE deleted_at IS NULL AND content LIKE ? ESCAPE '\\'",
                ["%长文本视觉%"]);
            result.rawLikeEscapeCount = countValue(row);

            row = global.ClipHub.Database.queryOne(
                "SELECT COUNT(*) AS item_count FROM clipboard_items " +
                "WHERE deleted_at IS NULL AND instr(content, ?) > 0",
                ["长文本视觉"]);
            result.rawInstrCount = countValue(row);

            rows = global.ClipHub.Repository.listItems({
                keyword: "长文本视觉", limit: 20
            });
            result.repositoryChineseCount = rows.length;
            result.repositoryChineseIdMatched =
                rows.length === 1 &&
                Number(rows[0].id) === Number(chineseId);

            rows = global.ClipHub.Repository.listItems({
                keyword: "长文本视觉-0", limit: 20
            });
            result.repositoryChineseTokenCount = rows.length;

            rows = global.ClipHub.Repository.listItems({
                keyword: "alpha", limit: 20
            });
            result.repositoryAsciiContentCount = rows.length;

            rows = global.ClipHub.Repository.listItems({
                keyword: "Long Visual Source", limit: 20
            });
            result.repositoryAsciiSourceCount = rows.length;

            global.ClipHub.List.show({
                limit: 20, widthDp: 340, heightDp: 420
            });
            waitFor(function () {
                return global.ClipHub.Window.getState()
                    .attachedToWindow === true;
            }, 1500);

            global.ClipHub.Filter.setKeyword("长文本视觉");
            result.filterChineseCount =
                global.ClipHub.Filter.getState().lastResultCount;
            result.listChineseRenderedCount =
                global.ClipHub.List.getState().renderedCount;
            result.filterChineseCriteriaMatched =
                global.ClipHub.Filter.getState()
                    .criteria.keyword === "长文本视觉";

            global.ClipHub.Filter.setKeyword("alpha");
            result.filterAsciiCount =
                global.ClipHub.Filter.getState().lastResultCount;
            result.listAsciiRenderedCount =
                global.ClipHub.List.getState().renderedCount;

            global.ClipHub.Filter.reset();
            result.filterResetCount =
                global.ClipHub.Filter.getState().lastResultCount;
            result.listResetRenderedCount =
                global.ClipHub.List.getState().renderedCount;

            global.ClipHub.List.hide(true);
            stop = global.ClipHub.App.stop("probe024_search");
            result.firstStopped = stop.stopped === true;
            result.firstDatabaseClosed =
                !global.ClipHub.Database.isOpen();
        } catch (error) {
            result.error = errorText(error);
            try {
                global.ClipHub.App.stop("probe024_error");
            } catch (ignoredStop) {}
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
            result.durationMs =
                result.finishedAt - result.startedAt;
            result.ok = result.error === null &&
                result.formalControl &&
                result.formalControl.ok === true &&
                result.firstStart &&
                result.firstStart.ok === true &&
                result.schemaVersion === 2 &&
                result.clipboardListenerStopped === true &&
                result.seededCount === 3 &&
                result.storedChineseVisible === true &&
                result.repositoryAsciiContentCount === 1 &&
                result.repositoryAsciiSourceCount === 1 &&
                result.filterAsciiCount === 1 &&
                result.listAsciiRenderedCount === 1 &&
                result.filterResetCount === 3 &&
                result.listResetRenderedCount === 3 &&
                result.firstStopped === true &&
                result.firstDatabaseClosed === true &&
                result.formalRestart &&
                result.formalRestart.ok === true &&
                result.cleanup === true;
            write(outputFile,
                JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try {
        global.ClipHubUnicodeSearchProbe024Result = main();
    } catch (error) {
        global.ClipHubUnicodeSearchProbe024Result = {
            ok: false,
            probe: "cliphub_unicode_search_probe_024",
            probeVersion: 1,
            fatal: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubUnicodeSearchProbe024Result);
