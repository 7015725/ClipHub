/* ClipHub formal control entry probe 029. Rhino ES5 only. */
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

    var REQUIRED_SET = "20260722.22";
    var RUNTIME_NAME = "ClipHubProbe029";
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
    function endpoint(runtimeDir) {
        var file = new File(new File(runtimeDir, "cache"),
            "control_endpoint.json");
        if (!file.isFile()) { return null; }
        return JSON.parse(read(file));
    }
    function sendCommand(runtimeDir, command) {
        var cacheDir = ensureDir(new File(runtimeDir, "cache"));
        var current = endpoint(runtimeDir);
        var requestId;
        var ackFile;
        var intent;
        var ack = null;
        if (current === null) {
            return { ok: false, command: command,
                error: "Control endpoint is missing" };
        }
        requestId = String(now()) + "-" +
            Number(Thread.currentThread().getId()) + "-" + String(command);
        ackFile = new File(cacheDir, "control_ack_" + requestId + ".json");
        if (ackFile.exists()) { ackFile.delete(); }
        intent = new Intent(String(current.action));
        intent.putExtra("runtimeDir", String(runtimeDir.getAbsolutePath()));
        intent.putExtra("command", String(command));
        intent.putExtra("requestId", requestId);
        intent.putExtra("controlToken", String(current.token));
        global.context.sendBroadcast(intent);
        waitFor(function () { return ackFile.isFile(); }, 3000);
        if (ackFile.isFile()) {
            try { ack = JSON.parse(read(ackFile)); }
            finally { ackFile.delete(); }
        }
        return ack === null ? { ok: false, command: command,
            error: "Control acknowledgement not received" } : ack;
    }
    function stopFormal(runtimeDir) {
        var wasRunning = !lockFree(runtimeDir);
        var ack;
        if (!wasRunning) {
            return { ok: true, initiallyRunning: false, stopped: true,
                lockReleased: true, endpointRemoved: endpoint(runtimeDir) === null };
        }
        ack = sendCommand(runtimeDir, "stop");
        waitFor(function () { return lockFree(runtimeDir); }, 3000);
        return {
            ok: ack.ok === true && ack.stopped === true && lockFree(runtimeDir) &&
                endpoint(runtimeDir) === null,
            initiallyRunning: true,
            stopped: lockFree(runtimeDir),
            ack: ack,
            lockReleased: lockFree(runtimeDir),
            endpointRemoved: endpoint(runtimeDir) === null,
            error: ack.error || null
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
            content: String(content),
            contentType: "text",
            sourcePackage: "com.control.probe",
            sourceLabel: "Control Probe",
            sourceUid: 10000,
            sourceConfidence: 100,
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
    function commandSetMatched(value) {
        var required = ["show", "hide", "toggle", "status", "stop"];
        var index;
        if (!value || value.length !== required.length) { return false; }
        for (index = 0; index < required.length; index += 1) {
            if (value.indexOf(required[index]) < 0) { return false; }
        }
        return true;
    }
    function noContent(value) {
        return JSON.stringify(value).indexOf("content") < 0;
    }

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var formal = new File(root, "ClipHub");
        var modules = new File(formal, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var outputFile = new File(ensureDir(new File(formal, "probes")),
            "cliphub_control_entry_probe_029_" + stamp(startedAt) + ".json");
        var local = localManifest(formal);
        var baseTime = startedAt - 10000;
        var longId;
        var currentEndpoint;
        var list;
        var index;
        var stop;
        var result = {
            ok: false,
            probe: "cliphub_control_entry_probe_029",
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
            result.formalControl = stopFormal(formal);
            if (!result.formalControl.ok) {
                throw new Error(result.formalControl.error || "Formal stop failed");
            }
            removeTree(isolated);
            result.firstStart = start(root, modules, isolated);
            result.schemaVersion = global.ClipHub.Database.getVersion();
            result.clipboardListenerStopped =
                global.ClipHub.Clipboard.stop().running === false;
            currentEndpoint = endpoint(isolated);
            result.endpointPresent = currentEndpoint !== null;
            result.endpointSchemaVersion = currentEndpoint === null ? null :
                Number(currentEndpoint.schemaVersion);
            result.endpointCommandsMatched = currentEndpoint !== null &&
                commandSetMatched(currentEndpoint.commands);
            result.appModuleVersion = Number(global.ClipHub.App.MODULE_VERSION);
            result.appCommandsMatched = commandSetMatched(
                global.ClipHub.App.getControlCommands());

            add("alpha control item", baseTime + 1000);
            longId = add("长文本控制入口测试 0 长文本控制入口测试 1 " +
                "长文本控制入口测试 2 长文本控制入口测试 3 " +
                "长文本控制入口测试 4 长文本控制入口测试 5 " +
                "长文本控制入口测试 6 长文本控制入口测试 7 " +
                "长文本控制入口测试 8 长文本控制入口测试 9", baseTime + 2000);
            add("third control item", baseTime + 3000);
            result.seededCount = global.ClipHub.Repository.countItems(false);

            result.initialStatus = sendCommand(isolated, "status");
            result.initialStatusHidden = result.initialStatus.ok === true &&
                result.initialStatus.action === "status" &&
                result.initialStatus.status.uiVisible === false;
            result.initialStatusThreadMain =
                result.initialStatus.threadName === "main";

            result.showAck = sendCommand(isolated, "show");
            result.showWorked = result.showAck.ok === true &&
                result.showAck.action === "shown" &&
                result.showAck.status.uiVisible === true &&
                result.showAck.status.windowAttached === true &&
                result.showAck.status.listVisible === true &&
                result.showAck.status.itemCount === 3 &&
                result.showAck.status.renderedCount === 3;
            result.showThreadMain = result.showAck.threadName === "main";
            result.windowAttachedAfterShow =
                global.ClipHub.Window.getState().attachedToWindow === true;
            result.listRenderedAfterShow =
                global.ClipHub.List.getState().renderedCount === 3;

            result.statusAfterShow = sendCommand(isolated, "status");
            result.statusAfterShowMatched = result.statusAfterShow.ok === true &&
                result.statusAfterShow.status.windowAttached === true &&
                result.statusAfterShow.status.renderedCount === 3;

            result.toggleHideAck = sendCommand(isolated, "toggle");
            result.toggleHideWorked = result.toggleHideAck.ok === true &&
                result.toggleHideAck.action === "hidden" &&
                result.toggleHideAck.status.uiVisible === false &&
                result.toggleHideAck.status.windowAttached === false;

            result.toggleShowAck = sendCommand(isolated, "toggle");
            result.toggleShowWorked = result.toggleShowAck.ok === true &&
                result.toggleShowAck.action === "shown" &&
                result.toggleShowAck.status.windowAttached === true &&
                result.toggleShowAck.status.renderedCount === 3;

            result.filterOpened = global.ClipHub.List.performFilterClick() &&
                waitFor(function () {
                    return global.ClipHub.Filter.getPanelState()
                        .attachedToWindow === true;
                }, 1200);
            result.hideWithFilterAck = sendCommand(isolated, "hide");
            result.hideClosedFilterAndList = result.hideWithFilterAck.ok === true &&
                result.hideWithFilterAck.status.uiVisible === false &&
                global.ClipHub.Filter.getPanelState().attached === false &&
                global.ClipHub.Window.getState().attached === false;

            sendCommand(isolated, "show");
            list = global.ClipHub.List.getState();
            index = indexOfId(list.itemIds, longId);
            result.detailOpened = global.ClipHub.List.performDetailClick(index) &&
                waitFor(function () {
                    return global.ClipHub.List.getDetailState()
                        .attachedToWindow === true;
                }, 1200);
            result.statusWithDetail = sendCommand(isolated, "status");
            result.statusDetectedDetail = result.statusWithDetail.ok === true &&
                result.statusWithDetail.status.detailAttached === true &&
                result.statusWithDetail.status.uiVisible === true;
            result.toggleClosedDetail = sendCommand(isolated, "toggle");
            result.toggleClosedAllUi = result.toggleClosedDetail.ok === true &&
                result.toggleClosedDetail.action === "hidden" &&
                result.toggleClosedDetail.status.uiVisible === false &&
                global.ClipHub.List.getDetailState().attached === false;

            result.showAgainAck = sendCommand(isolated, "show");
            result.showAgainWorked = result.showAgainAck.ok === true &&
                result.showAgainAck.status.renderedCount === 3;
            result.acksNoContent = noContent([
                result.initialStatus, result.showAck,
                result.statusAfterShow, result.toggleHideAck,
                result.toggleShowAck, result.hideWithFilterAck,
                result.statusWithDetail, result.toggleClosedDetail,
                result.showAgainAck
            ]);

            result.stopAck = sendCommand(isolated, "stop");
            waitFor(function () { return lockFree(isolated); }, 3000);
            result.stopBackwardCompatible = result.stopAck.ok === true &&
                result.stopAck.stopped === true &&
                result.stopAck.command === "stop" &&
                result.stopAck.threadName === "main" &&
                lockFree(isolated) && endpoint(isolated) === null;
            result.firstDatabaseClosed = !global.ClipHub.Database.isOpen();

            result.secondStart = start(root, modules, isolated);
            result.secondEndpointSchemaVersion = Number(endpoint(isolated).schemaVersion);
            result.secondShowAck = sendCommand(isolated, "show");
            result.controlPersistedAfterRestart =
                result.secondShowAck.ok === true &&
                result.secondShowAck.status.windowAttached === true &&
                result.secondShowAck.status.renderedCount === 3;
            result.secondHideAck = sendCommand(isolated, "hide");
            result.secondHideWorked = result.secondHideAck.ok === true &&
                result.secondHideAck.status.uiVisible === false;
            result.secondStopAck = sendCommand(isolated, "stop");
            waitFor(function () { return lockFree(isolated); }, 3000);
            result.secondStopped = result.secondStopAck.ok === true &&
                result.secondStopAck.stopped === true && lockFree(isolated);
            result.secondDatabaseClosed = !global.ClipHub.Database.isOpen();
        } catch (error) {
            result.error = errorText(error);
            try { global.ClipHub.App.stop("probe029_error"); }
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
                result.clipboardListenerStopped && result.endpointPresent &&
                result.endpointSchemaVersion === 2 &&
                result.endpointCommandsMatched && result.appModuleVersion === 5 &&
                result.appCommandsMatched && result.seededCount === 3 &&
                result.initialStatusHidden && result.initialStatusThreadMain &&
                result.showWorked && result.showThreadMain &&
                result.windowAttachedAfterShow && result.listRenderedAfterShow &&
                result.statusAfterShowMatched && result.toggleHideWorked &&
                result.toggleShowWorked && result.filterOpened &&
                result.hideClosedFilterAndList && result.detailOpened &&
                result.statusDetectedDetail && result.toggleClosedAllUi &&
                result.showAgainWorked && result.acksNoContent &&
                result.stopBackwardCompatible && result.firstDatabaseClosed &&
                result.secondStart && result.secondStart.ok === true &&
                result.secondEndpointSchemaVersion === 2 &&
                result.controlPersistedAfterRestart && result.secondHideWorked &&
                result.secondStopped && result.secondDatabaseClosed &&
                result.formalRestart && result.formalRestart.ok === true &&
                result.cleanup;
            write(outputFile, JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try {
        global.ClipHubControlEntryProbe029Result = main();
    } catch (error) {
        global.ClipHubControlEntryProbe029Result = {
            ok: false,
            probe: "cliphub_control_entry_probe_029",
            probeVersion: 1,
            fatal: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubControlEntryProbe029Result);
