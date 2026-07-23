/* ClipHub token control and clipboard pressure probe 006. Rhino ES5 only. */
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
    var AndroidContext = Packages.android.content.Context;
    var Intent = Packages.android.content.Intent;
    var ClipData = Packages.android.content.ClipData;
    var Uri = Packages.android.net.Uri;
    var NAMES = [
        "ch_01_base.js", "ch_02_log.js", "ch_03_database.js",
        "ch_04_clipboard.js", "ch_05_classifier.js",
        "ch_06_repository.js", "ch_07_theme.js", "ch_08_window.js",
        "ch_09_list.js", "ch_10_editor.js", "ch_11_filter.js",
        "ch_12_translation.js", "ch_13_settings.js",
        "ch_14_event_bus.js", "ch_15_app.js"
    ];
    var RUNTIME_NAME = "ClipHubProbe006";
    var UNIQUE_COUNT = 100;

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
        } finally {
            closeQuietly(reader);
        }
    }

    function writeUtf8(file, text) {
        var writer = null;
        try {
            writer = new BW(new OSW(new FOS(file, false), "UTF-8"));
            writer.write(String(text));
            writer.flush();
        } finally {
            closeQuietly(writer);
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

    function waitFor(predicate, timeoutMs, intervalMs) {
        var started = now();
        var delay = Number(intervalMs || 25);
        while (now() - started < timeoutMs) {
            if (predicate()) { return true; }
            Thread.sleep(delay);
        }
        return predicate();
    }

    function lockAvailable(runtimeDir) {
        var dataDir = ensureDir(new File(runtimeDir, "data"));
        var raf = null;
        var channel = null;
        var handle = null;
        var name;
        try {
            raf = new RAF(new File(dataDir, "cliphub.lock"), "rw");
            channel = raf.getChannel();
            handle = channel.tryLock();
            return handle !== null;
        } catch (error) {
            name = error && error.getClass
                ? String(error.getClass().getName()) : String(error);
            if (name.indexOf("OverlappingFileLockException") >= 0 ||
                    String(error).indexOf("OverlappingFileLockException") >= 0) {
                return false;
            }
            throw error;
        } finally {
            if (handle !== null) {
                try { handle.release(); } catch (ignoredRelease) {}
            }
            closeQuietly(channel);
            closeQuietly(raf);
        }
    }

    function readControlEndpoint(runtimeDir) {
        var endpointFile = new File(
            new File(runtimeDir, "cache"), "control_endpoint.json"
        );
        var endpoint;
        if (!endpointFile.isFile()) { return null; }
        endpoint = JSON.parse(readUtf8(endpointFile));
        if (!endpoint || Number(endpoint.schemaVersion) !== 1 ||
                String(endpoint.transport || "") !== "dynamic_broadcast_token" ||
                String(endpoint.action || "").length < 32 ||
                String(endpoint.token || "").length < 32 ||
                String(endpoint.runtimeDir || "") !==
                    String(runtimeDir.getAbsolutePath())) {
            throw new Error("Invalid formal control endpoint");
        }
        return { file: endpointFile, data: endpoint };
    }

    function stopRuntimeAcrossTasks(androidContext, runtimeDir) {
        var cacheDir = ensureDir(new File(runtimeDir, "cache"));
        var requestId = stamp(now()) + "-" +
            Number(Thread.currentThread().getId());
        var ackFile = new File(cacheDir, "control_ack_" + requestId + ".json");
        var endpointInfo;
        var endpoint;
        var intent;
        var ack = null;
        var initiallyAvailable = lockAvailable(runtimeDir);
        if (ackFile.exists()) { ackFile.delete(); }
        if (initiallyAvailable) {
            return {
                ok: false,
                stopped: true,
                alreadyStopped: true,
                initiallyRunning: false,
                lockReleased: true,
                ackReceived: false,
                endpointPresent: false,
                endpointRemoved: false,
                transport: null,
                ack: null,
                error: "Formal ClipHub was not running before probe 006"
            };
        }
        endpointInfo = readControlEndpoint(runtimeDir);
        if (endpointInfo === null) {
            return {
                ok: false,
                stopped: false,
                alreadyStopped: false,
                initiallyRunning: true,
                lockReleased: false,
                ackReceived: false,
                endpointPresent: false,
                endpointRemoved: false,
                transport: null,
                ack: null,
                error: "Formal control endpoint is missing"
            };
        }
        endpoint = endpointInfo.data;
        intent = new Intent(String(endpoint.action));
        intent.putExtra("runtimeDir", String(runtimeDir.getAbsolutePath()));
        intent.putExtra("command", "stop");
        intent.putExtra("requestId", requestId);
        intent.putExtra("controlToken", String(endpoint.token));
        androidContext.sendBroadcast(intent);
        waitFor(function () {
            return ackFile.isFile() && lockAvailable(runtimeDir);
        }, 3000, 25);
        if (ackFile.isFile()) {
            try { ack = JSON.parse(readUtf8(ackFile)); }
            catch (ignoredParse) { ack = null; }
            ackFile.delete();
        }
        return {
            ok: lockAvailable(runtimeDir) && ack !== null &&
                ack.ok === true && ack.stopped === true &&
                String(ack.transport || "") === "dynamic_broadcast_token",
            stopped: lockAvailable(runtimeDir),
            alreadyStopped: false,
            initiallyRunning: true,
            lockReleased: lockAvailable(runtimeDir),
            ackReceived: ack !== null,
            endpointPresent: true,
            endpointRemoved: !endpointInfo.file.exists(),
            transport: "dynamic_broadcast_token",
            ack: ack,
            error: ack === null ? "Control acknowledgement not received" : null
        };
    }

    function repeatedText(character, count) {
        var parts = [];
        var index;
        for (index = 0; index < count; index += 1) {
            parts.push(character);
        }
        return parts.join("");
    }

    function safeCount() {
        return Number(global.ClipHub.Repository.countItems(true));
    }

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var installed = new File(root, "ClipHub");
        var modules = new File(installed, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var reports = ensureDir(new File(installed, "probes"));
        var output = new File(reports,
            "cliphub_pressure_probe_006_" + stamp(startedAt) + ".json");
        var androidContext = global.context;
        var clipboardManager;
        var originalClip = null;
        var originalPresent = false;
        var result = {
            ok: false,
            probe: "cliphub_pressure_probe_006",
            probeVersion: 2,
            startedAt: startedAt,
            finishedAt: null,
            durationMs: null,
            pid: Number(Packages.android.os.Process.myPid()),
            uid: Number(Packages.android.os.Process.myUid()),
            threadId: Number(Thread.currentThread().getId()),
            threadName: String(Thread.currentThread().getName()),
            formalControl: null,
            formalInitiallyRunning: false,
            formalEndpointPresent: false,
            formalEndpointRemoved: false,
            formalControlTransport: null,
            formalAckReceived: false,
            formalAckThreadId: null,
            formalAckThreadName: null,
            formalStopped: false,
            formalLockReleased: false,
            isolatedStart: null,
            listenerRunning: false,
            uniqueRequested: UNIQUE_COUNT,
            uniqueCount: null,
            uniqueInserted: false,
            stressDurationMs: null,
            multiItemInserted: false,
            multiItemHashMatched: false,
            blankIgnored: false,
            nonTextIgnored: false,
            oversizedIgnored: false,
            invalidCountStable: false,
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
        var boot;
        var control;
        var state;
        var row;
        var beforeInvalid;
        var ignoredBefore;
        var stressStarted;
        var sessionText = String(startedAt).replace(/(\d)/g, "x$1");
        var index;
        var content;
        var multi;
        var multiExpected = "ClipHub alpha " + sessionText +
            "\nClipHub beta " + sessionText;
        var oversize = repeatedText("Z", 5000);

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
            control = stopRuntimeAcrossTasks(androidContext, installed);
            result.formalControl = control;
            result.formalInitiallyRunning = control.initiallyRunning === true;
            result.formalEndpointPresent = control.endpointPresent === true;
            result.formalEndpointRemoved = control.endpointRemoved === true;
            result.formalControlTransport = control.transport;
            result.formalAckReceived = control.ackReceived === true;
            result.formalAckThreadId = control.ack === null ? null :
                Number(control.ack.threadId);
            result.formalAckThreadName = control.ack === null ? null :
                String(control.ack.threadName || "");
            result.formalStopped = control.stopped === true;
            result.formalLockReleased = control.lockReleased === true;
            if (!control.ok || !result.formalInitiallyRunning ||
                    !result.formalEndpointPresent ||
                    !result.formalEndpointRemoved ||
                    result.formalControlTransport !==
                        "dynamic_broadcast_token" ||
                    !result.formalAckReceived ||
                    result.formalAckThreadName !== "main") {
                throw new Error(control.error ||
                    "Formal token control stop path was not fully exercised");
            }

            removeTree(isolated);
            boot = startRuntime(root, modules, isolated);
            result.isolatedStart = boot;
            if (!boot || !boot.ok || !boot.started) {
                throw new Error("Isolated start failed: " + JSON.stringify(boot));
            }
            global.ClipHub.Clipboard.configure({
                callbackDedupMs: 100,
                mergeWindowMs: 1500,
                ownWriteWindowMs: 3000,
                maxChars: 4096,
                maxItems: 10
            });
            result.listenerRunning = global.ClipHub.Clipboard.getState().running;

            stressStarted = now();
            for (index = 0; index < UNIQUE_COUNT; index += 1) {
                content = "ClipHub pressure item " + sessionText + " i" + index;
                clipboardManager.setPrimaryClip(ClipData.newPlainText(
                    "ClipHub Probe 006 Unique", content
                ));
                Thread.sleep(25);
            }
            waitFor(function () {
                return safeCount() >= UNIQUE_COUNT;
            }, 5000, 25);
            result.stressDurationMs = now() - stressStarted;
            result.uniqueCount = safeCount();
            result.uniqueInserted = result.uniqueCount === UNIQUE_COUNT;

            multi = ClipData.newPlainText(
                "ClipHub Probe 006 Multi", "ClipHub alpha " + sessionText
            );
            multi.addItem(new ClipData.Item("ClipHub beta " + sessionText));
            clipboardManager.setPrimaryClip(multi);
            waitFor(function () {
                return safeCount() >= UNIQUE_COUNT + 1;
            }, 1500, 25);
            row = global.ClipHub.Repository.listItems({limit: 1})[0];
            result.multiItemInserted = safeCount() === UNIQUE_COUNT + 1;
            result.multiItemHashMatched = row !== null && row !== undefined &&
                String(row.normalized_hash) ===
                global.ClipHub.Repository.hashContent(multiExpected);

            beforeInvalid = safeCount();
            state = global.ClipHub.Clipboard.getState();
            ignoredBefore = Number(state.ignoredCount || 0);
            clipboardManager.setPrimaryClip(ClipData.newPlainText(
                "ClipHub Probe 006 Blank", "   \n\t  "
            ));
            waitFor(function () {
                return Number(global.ClipHub.Clipboard.getState().ignoredCount || 0) >
                    ignoredBefore;
            }, 1000, 25);
            result.blankIgnored = safeCount() === beforeInvalid;

            state = global.ClipHub.Clipboard.getState();
            ignoredBefore = Number(state.ignoredCount || 0);
            clipboardManager.setPrimaryClip(ClipData.newRawUri(
                "ClipHub Probe 006 URI",
                Uri.parse("content://cliphub.probe006/item")
            ));
            waitFor(function () {
                return Number(global.ClipHub.Clipboard.getState().ignoredCount || 0) >
                    ignoredBefore;
            }, 1000, 25);
            result.nonTextIgnored = safeCount() === beforeInvalid;

            state = global.ClipHub.Clipboard.getState();
            ignoredBefore = Number(state.ignoredCount || 0);
            clipboardManager.setPrimaryClip(ClipData.newPlainText(
                "ClipHub Probe 006 Oversized", oversize
            ));
            waitFor(function () {
                return Number(global.ClipHub.Clipboard.getState().ignoredCount || 0) >
                    ignoredBefore;
            }, 1000, 25);
            result.oversizedIgnored = safeCount() === beforeInvalid;
            result.invalidCountStable = safeCount() === beforeInvalid;

            state = global.ClipHub.Clipboard.getState();
            result.callbackThreadId = state.callbackThreadId;
            result.callbackThreadName = state.callbackThreadName;
            result.eventSeq = state.eventSeq;
            result.handledCount = state.handledCount;
            result.ignoredCount = state.ignoredCount;
            result.errorCount = state.errorCount;

            result.isolatedStopped = global.ClipHub.App.stop("probe006").stopped === true;
            result.databaseClosed = !global.ClipHub.Database.isOpen();
        } catch (error) {
            result.error = errorText(error);
            try {
                if (global.ClipHub && global.ClipHub.App) {
                    global.ClipHub.App.stop("probe006_error");
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
                if (lockAvailable(installed)) {
                    boot = startRuntime(root, modules, installed);
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
                    result.error = "Formal restart failed: " +
                        errorText(restartError);
                }
            }
            result.cleanup = removeTree(isolated);
            result.finishedAt = now();
            result.durationMs = result.finishedAt - result.startedAt;
            result.ok = result.error === null &&
                result.formalInitiallyRunning &&
                result.formalEndpointPresent &&
                result.formalEndpointRemoved &&
                result.formalControlTransport === "dynamic_broadcast_token" &&
                result.formalAckReceived &&
                result.formalAckThreadName === "main" &&
                result.formalStopped && result.formalLockReleased &&
                result.listenerRunning && result.uniqueInserted &&
                result.uniqueCount === UNIQUE_COUNT &&
                result.multiItemInserted && result.multiItemHashMatched &&
                result.blankIgnored && result.nonTextIgnored &&
                result.oversizedIgnored && result.invalidCountStable &&
                result.callbackThreadName === "main" &&
                Number(result.handledCount || 0) >= UNIQUE_COUNT + 1 &&
                Number(result.errorCount || 0) === 0 &&
                result.isolatedStopped && result.databaseClosed &&
                result.clipboardRestored && result.formalRestart &&
                result.formalRestart.ok === true &&
                result.formalRestart.started === true && result.cleanup;
            writeUtf8(output, JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try {
        global.ClipHubPressureProbe006Result = main();
    } catch (error) {
        global.ClipHubPressureProbe006Result = {
            ok: false,
            probe: "cliphub_pressure_probe_006",
            probeVersion: 2,
            fatal: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubPressureProbe006Result);
