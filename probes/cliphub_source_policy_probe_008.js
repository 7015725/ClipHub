/* ClipHub source persistence and sensitive policy probe 008. Rhino ES5 only. */
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
    var Context = Packages.android.content.Context;
    var Intent = Packages.android.content.Intent;
    var ClipData = Packages.android.content.ClipData;
    var PersistableBundle = Packages.android.os.PersistableBundle;
    var SQLiteDatabase = Packages.android.database.sqlite.SQLiteDatabase;
    var REQUIRED_SET = "20260721.8";
    var SENSITIVE_KEY = "android.content.extra.IS_SENSITIVE";
    var RUNTIME_NAME = "ClipHubProbe008";
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
    function waitFor(predicate, timeoutMs) {
        var started = now();
        while (now() - started < timeoutMs) {
            if (predicate()) { return true; }
            Thread.sleep(25);
        }
        return predicate();
    }
    function lockFree(runtimeDir) {
        var data = ensureDir(new File(runtimeDir, "data"));
        var raf = null;
        var channel = null;
        var handle = null;
        try {
            raf = new RAF(new File(data, "cliphub.lock"), "rw");
            channel = raf.getChannel();
            handle = channel.tryLock();
            return handle !== null;
        } catch (error) {
            if (String(error).indexOf("OverlappingFileLockException") >= 0) {
                return false;
            }
            throw error;
        } finally {
            if (handle !== null) {
                try { handle.release(); } catch (ignoredRelease) {}
            }
            close(channel);
            close(raf);
        }
    }
    function localManifest(installed) {
        var file = new File(new File(installed, "cache"),
            "module-manifest.local.json");
        if (!file.isFile()) { return null; }
        return JSON.parse(read(file));
    }
    function stopFormal(androidContext, runtimeDir) {
        var cacheDir = ensureDir(new File(runtimeDir, "cache"));
        var endpointFile = new File(cacheDir, "control_endpoint.json");
        var endpoint;
        var requestId;
        var ackFile;
        var intent;
        var ack = null;
        if (lockFree(runtimeDir)) {
            return {ok: false, initiallyRunning: false,
                error: "Formal ClipHub was not running before probe 008"};
        }
        if (!endpointFile.isFile()) {
            return {ok: false, initiallyRunning: true,
                error: "Formal control endpoint is missing"};
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
        androidContext.sendBroadcast(intent);
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
    function loadAndStart(root, modules, runtime) {
        var index;
        var file;
        global.ClipHub = {};
        for (index = 0; index < MODULES.length; index += 1) {
            file = new File(modules, MODULES[index]);
            if (!file.isFile()) {
                throw new Error("Missing module: " + file.getAbsolutePath());
            }
            eval(read(file));
        }
        return global.ClipHub.App.start({
            shortxRoot: root,
            runtimeDir: String(runtime.getAbsolutePath()),
            moduleDir: String(modules.getAbsolutePath()),
            androidContext: global.context
        });
    }
    function createV1Database(runtimeDir) {
        var data = ensureDir(new File(runtimeDir, "data"));
        var file = new File(data, "cliphub.db");
        var db = SQLiteDatabase.openOrCreateDatabase(file, null);
        try {
            db.execSQL("CREATE TABLE schema_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT)");
            db.execSQL(
                "CREATE TABLE clipboard_items (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "content TEXT NOT NULL," +
                "normalized_hash TEXT NOT NULL," +
                "content_type TEXT NOT NULL DEFAULT 'text'," +
                "source_package TEXT, source_label TEXT, source_uid INTEGER," +
                "source_confidence INTEGER NOT NULL DEFAULT 0," +
                "is_pinned INTEGER NOT NULL DEFAULT 0," +
                "manual_order INTEGER NOT NULL DEFAULT 0," +
                "copy_count INTEGER NOT NULL DEFAULT 1," +
                "created_at INTEGER NOT NULL, last_copied_at INTEGER NOT NULL," +
                "updated_at INTEGER NOT NULL, deleted_at INTEGER)"
            );
            db.execSQL("INSERT INTO schema_meta(key, value) VALUES ('schema_version', '1')");
            db.setVersion(1);
        } finally { close(db); }
        return file;
    }
    function hasColumn(name) {
        var rows = global.ClipHub.Database.queryAll(
            "PRAGMA table_info(clipboard_items)", []
        );
        var index;
        for (index = 0; index < rows.length; index += 1) {
            if (String(rows[index].name) === String(name)) { return true; }
        }
        return false;
    }
    function sensitiveClip(label, text) {
        var clip = ClipData.newPlainText(label, text);
        var extras = new PersistableBundle();
        extras.putBoolean(SENSITIVE_KEY, true);
        clip.getDescription().setExtras(extras);
        return clip;
    }
    function setAs(manager, clip, packageName) {
        if (typeof manager.setPrimaryClipAsPackage === "function") {
            manager.setPrimaryClipAsPackage(clip, String(packageName));
        } else {
            manager.setPrimaryClip(clip);
        }
    }

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var installed = new File(root, "ClipHub");
        var modules = new File(installed, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var reports = ensureDir(new File(installed, "probes"));
        var output = new File(reports,
            "cliphub_source_policy_probe_008_" + stamp(startedAt) + ".json");
        var androidContext = global.context;
        var manager = androidContext.getSystemService(Context.CLIPBOARD_SERVICE);
        var manifest = localManifest(installed);
        var originalClip = null;
        var originalSource = null;
        var originalPresent = false;
        var control;
        var boot;
        var row;
        var state;
        var countBefore;
        var ignoredBefore;
        var result = {
            ok: false,
            probe: "cliphub_source_policy_probe_008",
            probeVersion: 1,
            startedAt: startedAt,
            finishedAt: null,
            durationMs: null,
            pid: Number(Packages.android.os.Process.myPid()),
            uid: Number(Packages.android.os.Process.myUid()),
            threadId: Number(Thread.currentThread().getId()),
            threadName: String(Thread.currentThread().getName()),
            moduleSetVersion: manifest === null ? null :
                String(manifest.moduleSetVersion || ""),
            formalControl: null,
            isolatedStart: null,
            schemaVersion: null,
            migratedFromV1: false,
            sensitiveColumnPresent: false,
            sourceInserted: false,
            sourcePackage: null,
            sourceLabel: null,
            sourceUid: null,
            sourceConfidence: null,
            normalSensitiveFlag: null,
            sensitiveDefaultSkipped: false,
            sensitiveSkipReason: null,
            sensitiveSavedWhenAllowed: false,
            savedSensitiveFlag: null,
            ignoredPackageSkipped: false,
            ignoredPackageReason: null,
            sourceReadCount: null,
            sourceErrorCount: null,
            sensitiveIgnoredCount: null,
            ignoredPackageCount: null,
            callbackThreadName: null,
            errorCount: null,
            isolatedStopped: false,
            databaseClosed: false,
            clipboardRestored: false,
            originalSourceRestoredExact: null,
            formalRestart: null,
            cleanup: false,
            outputPath: String(output.getAbsolutePath()),
            error: null
        };
        try {
            if (manifest === null || result.moduleSetVersion !== REQUIRED_SET) {
                throw new Error("Installed module set must be " + REQUIRED_SET);
            }
            originalClip = manager.getPrimaryClip();
            originalPresent = originalClip !== null;
            try { originalSource = manager.getPrimaryClipSource(); }
            catch (ignoredSource) { originalSource = null; }
            control = stopFormal(androidContext, installed);
            result.formalControl = control;
            if (!control.ok || !control.ackReceived ||
                    String(control.ack.threadName || "") !== "main") {
                throw new Error(control.error || "Formal stop failed");
            }
            removeTree(isolated);
            ensureDir(isolated);
            createV1Database(isolated);
            boot = loadAndStart(root, modules, isolated);
            result.isolatedStart = boot;
            if (!boot || !boot.ok || !boot.started) {
                throw new Error("Isolated start failed");
            }
            result.schemaVersion = Number(global.ClipHub.Database.getVersion());
            result.migratedFromV1 = result.schemaVersion === 2;
            result.sensitiveColumnPresent = hasColumn("is_sensitive");
            global.ClipHub.Clipboard.configure({
                callbackDedupMs: 100,
                mergeWindowMs: 1000,
                sensitivePolicy: "skip",
                ignorePackages: []
            });

            setAs(manager, ClipData.newPlainText(
                "ClipHub Probe 008 Source", "ClipHub probe008 normal " + startedAt
            ), "android");
            waitFor(function () {
                return Number(global.ClipHub.Repository.countItems(false)) >= 1;
            }, 1500);
            row = global.ClipHub.Repository.listItems({limit: 1})[0];
            result.sourceInserted = row !== null && row !== undefined;
            if (row) {
                result.sourcePackage = row.source_package;
                result.sourceLabel = row.source_label;
                result.sourceUid = Number(row.source_uid);
                result.sourceConfidence = Number(row.source_confidence);
                result.normalSensitiveFlag = Number(row.is_sensitive);
            }

            countBefore = Number(global.ClipHub.Repository.countItems(false));
            state = global.ClipHub.Clipboard.getState();
            ignoredBefore = Number(state.sensitiveIgnoredCount || 0);
            setAs(manager, sensitiveClip(
                "ClipHub Probe 008 Sensitive Skip",
                "ClipHub probe008 sensitive skip " + startedAt
            ), "android");
            waitFor(function () {
                return Number(global.ClipHub.Clipboard.getState()
                    .sensitiveIgnoredCount || 0) > ignoredBefore;
            }, 1200);
            state = global.ClipHub.Clipboard.getState();
            result.sensitiveDefaultSkipped =
                Number(global.ClipHub.Repository.countItems(false)) === countBefore;
            result.sensitiveSkipReason = state.lastEvent === null ? null :
                String(state.lastEvent.reason || "");

            global.ClipHub.Clipboard.configure({sensitivePolicy: "save"});
            setAs(manager, sensitiveClip(
                "ClipHub Probe 008 Sensitive Save",
                "ClipHub probe008 sensitive save " + startedAt
            ), "android");
            waitFor(function () {
                return Number(global.ClipHub.Repository.countItems(false)) >=
                    countBefore + 1;
            }, 1500);
            row = global.ClipHub.Repository.listItems({limit: 1})[0];
            result.sensitiveSavedWhenAllowed = row !== null && row !== undefined &&
                Number(row.is_sensitive) === 1;
            result.savedSensitiveFlag = row === null || row === undefined ? null :
                Number(row.is_sensitive);

            countBefore = Number(global.ClipHub.Repository.countItems(false));
            global.ClipHub.Clipboard.configure({
                sensitivePolicy: "skip",
                ignorePackages: ["android"]
            });
            state = global.ClipHub.Clipboard.getState();
            ignoredBefore = Number(state.ignoredPackageCount || 0);
            setAs(manager, ClipData.newPlainText(
                "ClipHub Probe 008 Ignore", "ClipHub probe008 ignored " + startedAt
            ), "android");
            waitFor(function () {
                return Number(global.ClipHub.Clipboard.getState()
                    .ignoredPackageCount || 0) > ignoredBefore;
            }, 1200);
            state = global.ClipHub.Clipboard.getState();
            result.ignoredPackageSkipped =
                Number(global.ClipHub.Repository.countItems(false)) === countBefore;
            result.ignoredPackageReason = state.lastEvent === null ? null :
                String(state.lastEvent.reason || "");
            result.sourceReadCount = Number(state.sourceReadCount || 0);
            result.sourceErrorCount = Number(state.sourceErrorCount || 0);
            result.sensitiveIgnoredCount = Number(state.sensitiveIgnoredCount || 0);
            result.ignoredPackageCount = Number(state.ignoredPackageCount || 0);
            result.callbackThreadName = state.callbackThreadName;
            result.errorCount = Number(state.errorCount || 0);
            result.isolatedStopped = global.ClipHub.App.stop("probe008").stopped === true;
            result.databaseClosed = !global.ClipHub.Database.isOpen();
        } catch (error) {
            result.error = errorText(error);
            try {
                if (global.ClipHub && global.ClipHub.App) {
                    global.ClipHub.App.stop("probe008_error");
                }
            } catch (ignoredStop) {}
        } finally {
            try {
                if (originalPresent) {
                    if (originalSource !== null &&
                            typeof manager.setPrimaryClipAsPackage === "function") {
                        manager.setPrimaryClipAsPackage(originalClip,
                            String(originalSource));
                    } else {
                        manager.setPrimaryClip(originalClip);
                    }
                } else if (Packages.android.os.Build.VERSION.SDK_INT >= 28) {
                    manager.clearPrimaryClip();
                }
                result.clipboardRestored = true;
                if (originalSource !== null &&
                        typeof manager.getPrimaryClipSource === "function") {
                    result.originalSourceRestoredExact =
                        String(manager.getPrimaryClipSource()) === String(originalSource);
                }
            } catch (restoreError) {
                if (result.error === null) {
                    result.error = "Restore clipboard failed: " +
                        errorText(restoreError);
                }
            }
            try {
                if (lockFree(installed)) {
                    boot = loadAndStart(root, modules, installed);
                    result.formalRestart = boot;
                } else {
                    result.formalRestart = {
                        ok: true, started: true, reused: true,
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
                result.migratedFromV1 && result.sensitiveColumnPresent &&
                result.sourceInserted && result.sourcePackage === "android" &&
                result.sourceLabel !== null && result.sourceUid === 1000 &&
                result.sourceConfidence === 100 &&
                result.normalSensitiveFlag === 0 &&
                result.sensitiveDefaultSkipped &&
                result.sensitiveSkipReason === "sensitive_clip" &&
                result.sensitiveSavedWhenAllowed &&
                result.savedSensitiveFlag === 1 &&
                result.ignoredPackageSkipped &&
                result.ignoredPackageReason === "ignored_source_package" &&
                result.sourceErrorCount === 0 &&
                result.callbackThreadName === "main" &&
                result.errorCount === 0 && result.isolatedStopped &&
                result.databaseClosed && result.clipboardRestored &&
                result.originalSourceRestoredExact !== false &&
                result.formalRestart && result.formalRestart.ok === true &&
                result.cleanup;
            write(output, JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try {
        global.ClipHubSourcePolicyProbe008Result = main();
    } catch (error) {
        global.ClipHubSourcePolicyProbe008Result = {
            ok: false,
            probe: "cliphub_source_policy_probe_008",
            probeVersion: 1,
            fatal: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubSourcePolicyProbe008Result);
