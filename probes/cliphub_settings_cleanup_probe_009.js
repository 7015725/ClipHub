/* ClipHub persistent settings and retention cleanup probe 009. Rhino ES5 only. */
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
    var REQUIRED_SET = "20260721.9";
    var RUNTIME_NAME = "ClipHubProbe009";
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
        var dataDir = ensureDir(new File(runtimeDir, "data"));
        var raf = null;
        var channel = null;
        var handle = null;
        try {
            raf = new RAF(new File(dataDir, "cliphub.lock"), "rw");
            channel = raf.getChannel();
            handle = channel.tryLock();
            return handle !== null;
        } catch (error) {
            if (String(error).indexOf("OverlappingFileLockException") >= 0) {
                return false;
            }
            throw error;
        } finally {
            if (handle !== null) { try { handle.release(); } catch (ignored) {} }
            close(channel);
            close(raf);
        }
    }
    function manifest(installed) {
        var file = new File(new File(installed, "cache"),
            "module-manifest.local.json");
        var data;
        if (!file.isFile()) { return {present: false}; }
        data = JSON.parse(read(file));
        return {
            present: true,
            moduleSetVersion: String(data.moduleSetVersion || ""),
            sourceRef: String(data.sourceRef || "")
        };
    }
    function stopFormal(ctx, runtimeDir) {
        var cacheDir = ensureDir(new File(runtimeDir, "cache"));
        var endpointFile = new File(cacheDir, "control_endpoint.json");
        var endpoint;
        var requestId;
        var ackFile;
        var intent;
        var ack = null;
        if (lockFree(runtimeDir)) {
            return {ok: false, initiallyRunning: false,
                error: "Formal ClipHub was not running before probe 009"};
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
        ctx.sendBroadcast(intent);
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
    function loadAndStart(root, modules, runtimeDir) {
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
            runtimeDir: String(runtimeDir.getAbsolutePath()),
            moduleDir: String(modules.getAbsolutePath()),
            androidContext: global.context
        });
    }
    function sameArray(left, right) {
        var index;
        if (!left || !right || left.length !== right.length) { return false; }
        for (index = 0; index < left.length; index += 1) {
            if (String(left[index]) !== String(right[index])) { return false; }
        }
        return true;
    }
    function countNonPinned() {
        return Number(global.ClipHub.Database.scalarLong(
            "SELECT COUNT(*) FROM clipboard_items WHERE is_pinned = 0",
            [], 0
        ));
    }
    function countPinned() {
        return Number(global.ClipHub.Database.scalarLong(
            "SELECT COUNT(*) FROM clipboard_items WHERE is_pinned = 1",
            [], 0
        ));
    }

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var installed = new File(root, "ClipHub");
        var modules = new File(installed, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var output = new File(ensureDir(new File(installed, "probes")),
            "cliphub_settings_cleanup_probe_009_" + stamp(startedAt) + ".json");
        var local = manifest(installed);
        var ctx = global.context;
        var result = {
            ok: false,
            probe: "cliphub_settings_cleanup_probe_009",
            probeVersion: 1,
            startedAt: startedAt,
            finishedAt: null,
            durationMs: null,
            pid: Number(Packages.android.os.Process.myPid()),
            uid: Number(Packages.android.os.Process.myUid()),
            threadId: Number(Thread.currentThread().getId()),
            threadName: String(Thread.currentThread().getName()),
            moduleSetVersion: local.moduleSetVersion || null,
            formalControl: null,
            firstStart: null,
            defaultsLoaded: false,
            normalizedSettings: null,
            runtimeConfigApplied: false,
            settingsRowCount: null,
            seededCount: null,
            cleanupResult: null,
            expiredRemoved: false,
            overflowRemoved: false,
            pinnedPreserved: false,
            nonPinnedRemaining: null,
            firstStopped: false,
            firstDatabaseClosed: false,
            secondStart: null,
            settingsReloaded: false,
            runtimeConfigReloaded: false,
            secondCleanupStable: false,
            secondStopped: false,
            secondDatabaseClosed: false,
            formalRestart: null,
            cleanup: false,
            outputPath: String(output.getAbsolutePath()),
            error: null
        };
        var control;
        var boot;
        var settings;
        var clipConfig;
        var expectedPackages = ["android", "com.example.test"];
        var referenceAt = startedAt;
        var oldAt = referenceAt - 40 * 86400000;
        var recentBase = referenceAt - 10000;
        var pinnedId;
        var expiredId;
        var index;
        var cleanupResult;
        var rows;
        var secondSettings;
        var secondConfig;

        if (!local.present || local.moduleSetVersion !== REQUIRED_SET) {
            throw new Error("Installed module set must be " + REQUIRED_SET);
        }
        if (ctx === null || ctx === undefined) {
            throw new Error("Global Android context unavailable");
        }

        try {
            control = stopFormal(ctx, installed);
            result.formalControl = control;
            if (!control.ok || !control.ackReceived ||
                    String(control.ack.threadName || "") !== "main") {
                throw new Error(control.error || "Formal stop failed");
            }

            removeTree(isolated);
            boot = loadAndStart(root, modules, isolated);
            result.firstStart = boot;
            settings = global.ClipHub.Settings.getAll();
            result.defaultsLoaded = settings.historyLimit === 0 &&
                settings.autoCleanupDays === 0 &&
                settings.sensitivePolicy === "skip" &&
                settings.sourceEnabled === true &&
                settings.ignorePackages.length === 0;

            settings = global.ClipHub.Settings.setMany({
                historyLimit: 3,
                autoCleanupDays: 30,
                closeAfterCopy: true,
                themeMode: "dark",
                sourceEnabled: false,
                sensitivePolicy: "save",
                ignorePackages: ["android", " android ", "com.example.test"]
            }, {cleanup: false});
            result.normalizedSettings = settings;
            clipConfig = global.ClipHub.Clipboard.getState().config;
            result.runtimeConfigApplied = clipConfig.sourceEnabled === false &&
                clipConfig.sensitivePolicy === "save" &&
                sameArray(clipConfig.ignorePackages, expectedPackages);
            result.settingsRowCount = Number(global.ClipHub.Database.scalarLong(
                "SELECT COUNT(*) FROM settings", [], 0
            ));

            pinnedId = global.ClipHub.Repository.insertItem({
                content: "ClipHub probe009 pinned old",
                isPinned: true,
                createdAt: oldAt,
                lastCopiedAt: oldAt,
                updatedAt: oldAt
            });
            expiredId = global.ClipHub.Repository.insertItem({
                content: "ClipHub probe009 expired",
                createdAt: oldAt,
                lastCopiedAt: oldAt,
                updatedAt: oldAt
            });
            for (index = 0; index < 5; index += 1) {
                global.ClipHub.Repository.insertItem({
                    content: "ClipHub probe009 recent " + index,
                    createdAt: recentBase + index,
                    lastCopiedAt: recentBase + index,
                    updatedAt: recentBase + index
                });
            }
            result.seededCount = global.ClipHub.Repository.countItems(true);
            cleanupResult = global.ClipHub.Settings.cleanup(referenceAt);
            result.cleanupResult = cleanupResult;
            result.expiredRemoved =
                global.ClipHub.Repository.getItem(expiredId, true) === null &&
                Number(cleanupResult.expiredDeleted) === 1;
            result.overflowRemoved =
                Number(cleanupResult.overflowDeleted) === 2;
            result.pinnedPreserved =
                global.ClipHub.Repository.getItem(pinnedId, true) !== null &&
                countPinned() === 1;
            result.nonPinnedRemaining = countNonPinned();

            result.firstStopped = global.ClipHub.App.stop("probe009_first").stopped === true;
            result.firstDatabaseClosed = !global.ClipHub.Database.isOpen();

            boot = loadAndStart(root, modules, isolated);
            result.secondStart = boot;
            secondSettings = global.ClipHub.Settings.getAll();
            secondConfig = global.ClipHub.Clipboard.getState().config;
            result.settingsReloaded = secondSettings.historyLimit === 3 &&
                secondSettings.autoCleanupDays === 30 &&
                secondSettings.closeAfterCopy === true &&
                secondSettings.themeMode === "dark" &&
                secondSettings.sourceEnabled === false &&
                secondSettings.sensitivePolicy === "save" &&
                sameArray(secondSettings.ignorePackages, expectedPackages);
            result.runtimeConfigReloaded = secondConfig.sourceEnabled === false &&
                secondConfig.sensitivePolicy === "save" &&
                sameArray(secondConfig.ignorePackages, expectedPackages);
            rows = global.ClipHub.Repository.listItems({
                includeDeleted: true,
                limit: 20
            });
            result.secondCleanupStable = rows.length === 4 &&
                countPinned() === 1 && countNonPinned() === 3 &&
                Number(global.ClipHub.Settings.getLastCleanup().totalDeleted) === 0;
            result.secondStopped = global.ClipHub.App.stop("probe009_second").stopped === true;
            result.secondDatabaseClosed = !global.ClipHub.Database.isOpen();
        } catch (error) {
            result.error = errorText(error);
            try {
                if (global.ClipHub && global.ClipHub.App) {
                    global.ClipHub.App.stop("probe009_error");
                }
            } catch (ignoredStop) {}
        } finally {
            try {
                if (lockFree(installed)) {
                    boot = loadAndStart(root, modules, installed);
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
                result.firstStart && result.firstStart.ok === true &&
                result.defaultsLoaded && result.runtimeConfigApplied &&
                result.settingsRowCount === 7 && result.seededCount === 7 &&
                result.expiredRemoved && result.overflowRemoved &&
                result.pinnedPreserved && result.nonPinnedRemaining === 3 &&
                result.firstStopped && result.firstDatabaseClosed &&
                result.secondStart && result.secondStart.ok === true &&
                result.settingsReloaded && result.runtimeConfigReloaded &&
                result.secondCleanupStable && result.secondStopped &&
                result.secondDatabaseClosed && result.formalRestart &&
                result.formalRestart.ok === true && result.cleanup;
            write(output, JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try {
        global.ClipHubSettingsCleanupProbe009Result = main();
    } catch (error) {
        global.ClipHubSettingsCleanupProbe009Result = {
            ok: false,
            probe: "cliphub_settings_cleanup_probe_009",
            probeVersion: 1,
            fatal: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubSettingsCleanupProbe009Result);
