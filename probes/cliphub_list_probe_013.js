/* ClipHub minimum history list probe 013. Rhino ES5 only. */
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
    var Context = Packages.android.content.Context;
    var ClipData = Packages.android.content.ClipData;
    var REQUIRED_SET = "20260721.12";
    var RUNTIME_NAME = "ClipHubProbe013";
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
                return String(error.javaException.getClass().getName()) + ": " + String(error);
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
            if (callback()) { return { matched: true, waitedMs: now() - started }; }
            Thread.sleep(25);
        }
        return { matched: callback(), waitedMs: now() - started };
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
    function localManifest(installedDir) {
        var file = new File(new File(installedDir, "cache"),
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
        var wait;
        if (lockFree(runtimeDir)) {
            return { ok: false, initiallyRunning: false,
                error: "Formal ClipHub was not running before probe 013" };
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
        wait = waitFor(function () {
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
            waitedMs: wait.waitedMs,
            error: ack === null ? "Control acknowledgement not received" : null
        };
    }
    function loadAndStart(root, moduleDir, runtimeDir) {
        var index;
        var file;
        global.ClipHub = {};
        for (index = 0; index < MODULES.length; index += 1) {
            file = new File(moduleDir, MODULES[index]);
            if (!file.isFile()) { throw new Error("Missing module: " + file.getAbsolutePath()); }
            eval(read(file));
        }
        return global.ClipHub.App.start({
            shortxRoot: root,
            runtimeDir: String(runtimeDir.getAbsolutePath()),
            moduleDir: String(moduleDir.getAbsolutePath()),
            androidContext: global.context
        });
    }
    function readSource(manager) {
        try { return String(manager.getPrimaryClipSource()); }
        catch (ignored) { return null; }
    }
    function setClip(manager, clip, sourcePackage) {
        try {
            manager.setPrimaryClipAsPackage(clip, String(sourcePackage));
            return true;
        } catch (ignored) {
            manager.setPrimaryClip(clip);
            return false;
        }
    }
    function currentText(manager, context) {
        var clip;
        var item;
        var value;
        try {
            if (!manager.hasPrimaryClip()) { return ""; }
            clip = manager.getPrimaryClip();
            if (clip === null || clip.getItemCount() < 1) { return ""; }
            item = clip.getItemAt(0);
            value = item.coerceToText(context);
            return value === null ? "" : String(value);
        } catch (ignored) { return ""; }
    }
    function restoreClipboard(manager, originalClip, originalSource) {
        if (originalClip === null) {
            try { manager.clearPrimaryClip(); return true; }
            catch (ignoredClear) { return false; }
        }
        try {
            if (originalSource !== null) {
                manager.setPrimaryClipAsPackage(originalClip, String(originalSource));
            } else {
                manager.setPrimaryClip(originalClip);
            }
            return true;
        } catch (error) {
            try { manager.setPrimaryClip(originalClip); return true; }
            catch (ignored) { return false; }
        }
    }

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var installed = new File(root, "ClipHub");
        var moduleDir = new File(installed, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var output = new File(ensureDir(new File(installed, "probes")),
            "cliphub_list_probe_013_" + stamp(startedAt) + ".json");
        var local = localManifest(installed);
        var context = global.context;
        var manager = context.getSystemService(Context.CLIPBOARD_SERVICE);
        var originalClip = null;
        var originalSource = null;
        var control;
        var boot;
        var show;
        var wait;
        var index;
        var text;
        var rows;
        var topRow;
        var beforeCount;
        var afterCount;
        var listState;
        var closeResult;
        var appStop;
        var result = {
            ok: false,
            probe: "cliphub_list_probe_013",
            probeVersion: 1,
            startedAt: startedAt,
            finishedAt: null,
            durationMs: null,
            pid: Number(Packages.android.os.Process.myPid()),
            uid: Number(Packages.android.os.Process.myUid()),
            threadId: Number(Thread.currentThread().getId()),
            threadName: String(Thread.currentThread().getName()),
            moduleSetVersion: local.moduleSetVersion || null,
            sourceRef: local.sourceRef || null,
            formalControl: null,
            isolatedStart: null,
            emptyInitial: false,
            windowAttached: false,
            eventInsertedCount: 0,
            eventRefreshObserved: false,
            renderedThree: false,
            renderThreadName: null,
            firstClickPerformed: false,
            firstCopyMatched: false,
            ownWriteCountStable: false,
            firstClickThreadName: null,
            windowStayedOpen: false,
            closeAfterCopyApplied: false,
            emptyAfterDelete: false,
            finalClose: null,
            appStopped: false,
            databaseClosed: false,
            clipboardRestored: false,
            originalSourceRestoredExact: false,
            formalRestart: null,
            cleanup: false,
            outputPath: String(output.getAbsolutePath()),
            error: null
        };

        if (!local.present || local.moduleSetVersion !== REQUIRED_SET) {
            throw new Error("Installed module set must be " + REQUIRED_SET);
        }
        if (manager === null) { throw new Error("ClipboardManager unavailable"); }
        try {
            originalClip = manager.hasPrimaryClip() ? manager.getPrimaryClip() : null;
            originalSource = readSource(manager);
        } catch (ignoredOriginal) {}

        try {
            control = stopFormal(context, installed);
            result.formalControl = control;
            if (!control.ok || !control.ackReceived ||
                    String(control.ack.threadName || "") !== "main") {
                throw new Error(control.error || "Formal stop failed");
            }
            removeTree(isolated);
            boot = loadAndStart(root, moduleDir, isolated);
            result.isolatedStart = boot;

            show = global.ClipHub.List.show({ limit: 10, widthDp: 340, heightDp: 420 });
            wait = waitFor(function () {
                return global.ClipHub.Window.getState().attachedToWindow === true;
            }, 1500);
            result.windowAttached = wait.matched;
            listState = global.ClipHub.List.getState();
            result.emptyInitial = listState.emptyVisible === true &&
                listState.renderedCount === 0;

            for (index = 1; index <= 3; index += 1) {
                text = "ClipHub probe 013 item " + index + " " + startedAt;
                setClip(manager, ClipData.newPlainText("ClipHub013", text), "android");
                waitFor(function () {
                    return global.ClipHub.Repository.countItems(false) >= index;
                }, 1800);
                Thread.sleep(120);
            }
            wait = waitFor(function () {
                listState = global.ClipHub.List.getState();
                return listState.renderedCount === 3 && listState.itemCount === 3;
            }, 2000);
            rows = global.ClipHub.Repository.listItems({ limit: 10, offset: 0 });
            result.eventInsertedCount = rows.length;
            listState = global.ClipHub.List.getState();
            result.eventRefreshObserved = listState.eventRefreshCount >= 3;
            result.renderedThree = wait.matched && rows.length === 3;
            result.renderThreadName = listState.renderThreadName;

            topRow = rows[0];
            beforeCount = global.ClipHub.Repository.countItems(false);
            result.firstClickPerformed = global.ClipHub.List.performItemClick(0) === true;
            wait = waitFor(function () {
                return currentText(manager, context) === String(topRow.content);
            }, 1200);
            result.firstCopyMatched = wait.matched;
            Thread.sleep(350);
            afterCount = global.ClipHub.Repository.countItems(false);
            result.ownWriteCountStable = beforeCount === afterCount;
            listState = global.ClipHub.List.getState();
            result.firstClickThreadName = listState.clickThreadName;
            result.windowStayedOpen = global.ClipHub.Window.isAttached();

            global.ClipHub.Settings.set("closeAfterCopy", true, { cleanup: false });
            global.ClipHub.List.performItemClick(1);
            wait = waitFor(function () {
                return !global.ClipHub.Window.isAttached();
            }, 1200);
            result.closeAfterCopyApplied = wait.matched;

            rows = global.ClipHub.Repository.listItems({ limit: 20, offset: 0 });
            for (index = 0; index < rows.length; index += 1) {
                global.ClipHub.Repository.softDeleteItem(Number(rows[index].id));
            }
            global.ClipHub.Settings.set("closeAfterCopy", false, { cleanup: false });
            global.ClipHub.List.show({ limit: 10, widthDp: 340, heightDp: 420 });
            waitFor(function () {
                return global.ClipHub.Window.getState().attachedToWindow === true;
            }, 1500);
            global.ClipHub.List.refresh();
            listState = global.ClipHub.List.getState();
            result.emptyAfterDelete = listState.emptyVisible === true &&
                listState.renderedCount === 0 && listState.itemCount === 0;

            closeResult = global.ClipHub.Window.close();
            result.finalClose = closeResult;
            appStop = global.ClipHub.App.stop("probe013");
            result.appStopped = appStop.stopped === true;
            result.databaseClosed = !global.ClipHub.Database.isOpen();
            result.clipboardRestored = restoreClipboard(manager, originalClip, originalSource);
            result.originalSourceRestoredExact = originalSource === null ||
                readSource(manager) === originalSource;
        } catch (error) {
            result.error = errorText(error);
            try {
                if (global.ClipHub && global.ClipHub.App) {
                    global.ClipHub.App.stop("probe013_error");
                }
            } catch (ignoredStop) {}
            if (!result.clipboardRestored) {
                result.clipboardRestored = restoreClipboard(manager, originalClip, originalSource);
                result.originalSourceRestoredExact = originalSource === null ||
                    readSource(manager) === originalSource;
            }
        } finally {
            try {
                if (lockFree(installed)) {
                    boot = loadAndStart(root, moduleDir, installed);
                    result.formalRestart = boot;
                } else {
                    result.formalRestart = {
                        ok: true, started: true, reused: true,
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
                result.isolatedStart && result.isolatedStart.ok === true &&
                result.emptyInitial && result.windowAttached &&
                result.eventInsertedCount === 3 && result.eventRefreshObserved &&
                result.renderedThree && result.renderThreadName === "main" &&
                result.firstClickPerformed && result.firstCopyMatched &&
                result.ownWriteCountStable && result.firstClickThreadName === "main" &&
                result.windowStayedOpen && result.closeAfterCopyApplied &&
                result.emptyAfterDelete && result.finalClose &&
                result.finalClose.ok === true && result.appStopped &&
                result.databaseClosed && result.clipboardRestored &&
                result.originalSourceRestoredExact && result.formalRestart &&
                result.formalRestart.ok === true && result.cleanup;
            write(output, JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try {
        global.ClipHubListProbe013Result = main();
    } catch (error) {
        global.ClipHubListProbe013Result = {
            ok: false,
            probe: "cliphub_list_probe_013",
            probeVersion: 1,
            fatal: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubListProbe013Result);
