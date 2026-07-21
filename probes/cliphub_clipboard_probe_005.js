/* ClipHub ClipboardManager probe 005. Rhino ES5 only. */
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
    var SDF = Packages.java.text.SimpleDateFormat;
    var Locale = Packages.java.util.Locale;
    var AndroidContext = Packages.android.content.Context;
    var ClipData = Packages.android.content.ClipData;
    var NAMES = [
        "ch_01_base.js", "ch_02_log.js", "ch_03_database.js",
        "ch_04_clipboard.js", "ch_05_classifier.js",
        "ch_06_repository.js", "ch_07_theme.js", "ch_08_window.js",
        "ch_09_list.js", "ch_10_editor.js", "ch_11_filter.js",
        "ch_12_translation.js", "ch_13_settings.js",
        "ch_14_event_bus.js", "ch_15_app.js"
    ];
    var RUNTIME_NAME = "ClipHubProbe005";

    function now() { return Number(System.currentTimeMillis()); }
    function stamp(value) {
        return String(new SDF("yyyyMMdd-HHmmss-SSS", Locale.US)
            .format(new Packages.java.util.Date(value)));
    }
    function closeQuietly(value) {
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
    function ensureDir(dir) {
        if (!dir.exists() && !dir.mkdirs() && !dir.isDirectory()) {
            throw new Error("Cannot create directory: " + dir.getAbsolutePath());
        }
        return dir;
    }
    function readUtf8(file) {
        var reader = null;
        var builder = new SB();
        var line;
        try {
            reader = new BR(new ISR(new FIS(file), "UTF-8"));
            while ((line = reader.readLine()) !== null) {
                builder.append(line).append("\n");
            }
            return String(builder.toString());
        } finally { closeQuietly(reader); }
    }
    function writeUtf8(file, text) {
        var writer = null;
        try {
            writer = new BW(new OSW(new FOS(file, false), "UTF-8"));
            writer.write(String(text));
            writer.flush();
        } finally { closeQuietly(writer); }
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
    function loadModules(moduleDir) {
        var index;
        var file;
        global.ClipHub = {};
        for (index = 0; index < NAMES.length; index += 1) {
            file = new File(moduleDir, NAMES[index]);
            if (!file.isFile()) {
                throw new Error("Missing module: " + file.getAbsolutePath());
            }
            eval(readUtf8(file));
        }
    }
    function startRuntime(root, moduleDir, runtimeDir) {
        loadModules(moduleDir);
        return global.ClipHub.App.start({
            shortxRoot: root,
            runtimeDir: String(runtimeDir.getAbsolutePath()),
            moduleDir: String(moduleDir.getAbsolutePath()),
            androidContext: global.context
        });
    }
    function waitFor(predicate, timeoutMs) {
        var started = now();
        while (now() - started < timeoutMs) {
            if (predicate()) { return true; }
            Thread.sleep(50);
        }
        return predicate();
    }

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var installed = new File(root, "ClipHub");
        var modules = new File(installed, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var reports = ensureDir(new File(installed, "probes"));
        var output = new File(reports,
            "cliphub_clipboard_probe_005_" + stamp(startedAt) + ".json");
        var androidContext = global.context;
        var clipboardManager;
        var originalClip = null;
        var originalPresent = false;
        var result = {
            ok: false,
            probe: "cliphub_clipboard_probe_005",
            probeVersion: 1,
            startedAt: startedAt,
            finishedAt: null,
            durationMs: null,
            pid: Number(Packages.android.os.Process.myPid()),
            uid: Number(Packages.android.os.Process.myUid()),
            threadId: Number(Thread.currentThread().getId()),
            threadName: String(Thread.currentThread().getName()),
            formalStopped: false,
            isolatedStart: null,
            listenerRunning: false,
            ownWriteReturned: false,
            ownWriteSuppressed: false,
            countAfterOwnWrite: null,
            externalInserted: false,
            externalMerged: false,
            externalCount: null,
            externalCopyCount: null,
            callbackThreadId: null,
            callbackThreadName: null,
            eventSeq: null,
            handledCount: null,
            ignoredCount: null,
            errorCount: null,
            isolatedStopped: false,
            databaseClosed: false,
            clipboardRestored: false,
            formalRestart: null,
            cleanup: false,
            outputPath: String(output.getAbsolutePath()),
            error: null
        };
        var ownText = "ClipHub probe005 own " + startedAt;
        var externalText = "ClipHub probe005 external " + startedAt;
        var boot;
        var state;
        var row;
        var managerState;

        if (androidContext === null || androidContext === undefined) {
            throw new Error("Global Android context unavailable");
        }
        clipboardManager = androidContext.getSystemService(
            AndroidContext.CLIPBOARD_SERVICE
        );
        if (clipboardManager === null) {
            throw new Error("ClipboardManager unavailable");
        }
        try {
            originalClip = clipboardManager.getPrimaryClip();
            originalPresent = originalClip !== null;
        } catch (ignoredOriginal) {}

        try {
            if (global.ClipHub && global.ClipHub.App &&
                    typeof global.ClipHub.App.isStarted === "function" &&
                    global.ClipHub.App.isStarted()) {
                result.formalStopped = global.ClipHub.App.stop().stopped === true;
            } else {
                result.formalStopped = true;
            }
            removeTree(isolated);
            boot = startRuntime(root, modules, isolated);
            result.isolatedStart = boot;
            if (!boot || !boot.ok || !boot.started) {
                throw new Error("Isolated start failed: " + JSON.stringify(boot));
            }
            global.ClipHub.Clipboard.configure({
                callbackDedupMs: 200,
                mergeWindowMs: 2500,
                ownWriteWindowMs: 3000
            });
            result.listenerRunning = global.ClipHub.Clipboard.getState().running;

            result.ownWriteReturned = global.ClipHub.Clipboard.writeText(
                ownText, {label: "ClipHub Probe 005"}
            ).written === true;
            waitFor(function () {
                return global.ClipHub.Clipboard.getState().ownWrite.consumed;
            }, 800);
            if (!global.ClipHub.Clipboard.getState().ownWrite.consumed) {
                global.ClipHub.Clipboard.processCurrentClip();
            }
            state = global.ClipHub.Clipboard.getState();
            result.ownWriteSuppressed = state.ownWrite.consumed === true;
            result.countAfterOwnWrite = global.ClipHub.Repository.countItems(true);

            clipboardManager.setPrimaryClip(ClipData.newPlainText(
                "ClipHub Probe 005 External", externalText
            ));
            waitFor(function () {
                return global.ClipHub.Repository.countItems(true) >= 1;
            }, 1000);
            if (global.ClipHub.Repository.countItems(true) < 1) {
                global.ClipHub.Clipboard.processCurrentClip();
            }
            row = global.ClipHub.Repository.listItems({limit: 1})[0];
            result.externalInserted = row !== null && row !== undefined &&
                Number(row.copy_count) === 1;

            Thread.sleep(600);
            clipboardManager.setPrimaryClip(ClipData.newPlainText(
                "ClipHub Probe 005 External Repeat", externalText
            ));
            waitFor(function () {
                var rows = global.ClipHub.Repository.listItems({limit: 1});
                return rows.length > 0 && Number(rows[0].copy_count) >= 2;
            }, 1000);
            row = global.ClipHub.Repository.listItems({limit: 1})[0];
            if (row !== null && row !== undefined && Number(row.copy_count) < 2) {
                global.ClipHub.Clipboard.processCurrentClip();
                row = global.ClipHub.Repository.listItems({limit: 1})[0];
            }
            result.externalCount = global.ClipHub.Repository.countItems(true);
            result.externalCopyCount = row === null || row === undefined
                ? 0 : Number(row.copy_count);
            result.externalMerged = result.externalCount === 1 &&
                result.externalCopyCount === 2;

            managerState = global.ClipHub.Clipboard.getState();
            result.callbackThreadId = managerState.callbackThreadId;
            result.callbackThreadName = managerState.callbackThreadName;
            result.eventSeq = managerState.eventSeq;
            result.handledCount = managerState.handledCount;
            result.ignoredCount = managerState.ignoredCount;
            result.errorCount = managerState.errorCount;

            result.isolatedStopped = global.ClipHub.App.stop().stopped === true;
            result.databaseClosed = !global.ClipHub.Database.isOpen();
        } catch (error) {
            result.error = errorText(error);
            try {
                if (global.ClipHub && global.ClipHub.App) {
                    global.ClipHub.App.stop();
                }
            } catch (ignoredStop) {}
        } finally {
            try {
                if (originalPresent) {
                    clipboardManager.setPrimaryClip(originalClip);
                } else if (Packages.android.os.Build.VERSION.SDK_INT >= 28) {
                    clipboardManager.clearPrimaryClip();
                }
                result.clipboardRestored = true;
            } catch (restoreError) {
                if (result.error === null) {
                    result.error = "Restore clipboard failed: " +
                        errorText(restoreError);
                }
            }
            try {
                boot = startRuntime(root, modules, installed);
                result.formalRestart = boot;
            } catch (restartError) {
                if (result.error === null) {
                    result.error = "Formal restart failed: " +
                        errorText(restartError);
                }
            }
            result.cleanup = removeTree(isolated);
            result.finishedAt = now();
            result.durationMs = result.finishedAt - result.startedAt;
            result.ok = result.error === null && result.formalStopped &&
                result.listenerRunning && result.ownWriteReturned &&
                result.ownWriteSuppressed && result.countAfterOwnWrite === 0 &&
                result.externalInserted && result.externalMerged &&
                result.externalCount === 1 && result.externalCopyCount === 2 &&
                result.errorCount === 0 && result.isolatedStopped &&
                result.databaseClosed && result.clipboardRestored &&
                result.formalRestart && result.formalRestart.ok === true &&
                result.formalRestart.started === true && result.cleanup;
            writeUtf8(output, JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try {
        global.ClipHubClipboardProbe005Result = main();
    } catch (error) {
        global.ClipHubClipboardProbe005Result = {
            ok: false,
            probe: "cliphub_clipboard_probe_005",
            fatal: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubClipboardProbe005Result);
