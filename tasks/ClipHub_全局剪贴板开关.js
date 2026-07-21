/* ClipHub global clipboard toggle task. Rhino ES5 only. */
(function (global) {
    var File = Packages.java.io.File;
    var FIS = Packages.java.io.FileInputStream;
    var ISR = Packages.java.io.InputStreamReader;
    var BR = Packages.java.io.BufferedReader;
    var SB = Packages.java.lang.StringBuilder;
    var Thread = Packages.java.lang.Thread;
    var System = Packages.java.lang.System;
    var RAF = Packages.java.io.RandomAccessFile;
    var Intent = Packages.android.content.Intent;
    var TASK_VERSION = 2;
    var REQUIRED_ENDPOINT_SCHEMA = 2;
    var REQUIRED_MODULE_SET = "20260722.22";

    function now() { return Number(System.currentTimeMillis()); }
    function close(value) {
        if (value !== null && value !== undefined) {
            try { value.close(); } catch (ignored) {}
        }
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
    function ensureDir(file) {
        if (!file.exists() && !file.mkdirs() && !file.isDirectory()) {
            throw new Error("Cannot create directory: " + file.getAbsolutePath());
        }
        return file;
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
            if (handle !== null) {
                try { handle.release(); } catch (ignoredRelease) {}
            }
            close(channel);
            close(raf);
        }
    }
    function waitFor(predicate, timeoutMs) {
        var started = now();
        while (now() - started < timeoutMs) {
            if (predicate()) { return true; }
            Thread.sleep(25);
        }
        return predicate();
    }
    function containsCommand(commands, command) {
        var index;
        if (!commands || typeof commands.length !== "number") { return false; }
        for (index = 0; index < commands.length; index += 1) {
            if (String(commands[index]) === String(command)) { return true; }
        }
        return false;
    }
    function oldRuntimeResult(endpoint) {
        return {
            ok: false,
            command: "toggle",
            taskVersion: TASK_VERSION,
            running: true,
            updateRequired: true,
            endpointSchemaVersion: Number(endpoint && endpoint.schemaVersion || 0),
            requiredEndpointSchemaVersion: REQUIRED_ENDPOINT_SCHEMA,
            requiredModuleSetVersion: REQUIRED_MODULE_SET,
            error: "ClipHub 后台版本过旧，请先停止正式实例，再运行完整 ClipHub.js 更新到 " + REQUIRED_MODULE_SET
        };
    }
    function main() {
        var root = String(shortx.getShortXDir());
        var runtimeDir = new File(root, "ClipHub");
        var cacheDir = ensureDir(new File(runtimeDir, "cache"));
        var endpointFile = new File(cacheDir, "control_endpoint.json");
        var endpoint;
        var requestId;
        var ackFile;
        var intent;
        var ack = null;
        if (lockFree(runtimeDir)) {
            return {
                ok: false,
                command: "toggle",
                taskVersion: TASK_VERSION,
                running: false,
                error: "ClipHub 后台未运行，请先执行完整 ClipHub.js"
            };
        }
        if (!endpointFile.isFile()) {
            throw new Error("ClipHub control endpoint is missing");
        }
        endpoint = JSON.parse(read(endpointFile));
        if (!endpoint || String(endpoint.transport || "") !==
                "dynamic_broadcast_token" ||
                String(endpoint.runtimeDir || "") !==
                    String(runtimeDir.getAbsolutePath())) {
            throw new Error("Invalid ClipHub control endpoint");
        }
        if (Number(endpoint.schemaVersion || 0) < REQUIRED_ENDPOINT_SCHEMA ||
                !containsCommand(endpoint.commands, "toggle")) {
            return oldRuntimeResult(endpoint);
        }
        requestId = String(now()) + "-" + Number(Thread.currentThread().getId());
        ackFile = new File(cacheDir, "control_ack_" + requestId + ".json");
        if (ackFile.exists()) { ackFile.delete(); }
        intent = new Intent(String(endpoint.action));
        intent.putExtra("runtimeDir", String(runtimeDir.getAbsolutePath()));
        intent.putExtra("command", "toggle");
        intent.putExtra("requestId", requestId);
        intent.putExtra("controlToken", String(endpoint.token));
        global.context.sendBroadcast(intent);
        waitFor(function () { return ackFile.isFile(); }, 3000);
        if (ackFile.isFile()) {
            try { ack = JSON.parse(read(ackFile)); }
            finally { ackFile.delete(); }
        }
        if (ack === null) {
            return {
                ok: false,
                command: "toggle",
                taskVersion: TASK_VERSION,
                running: true,
                endpointSchemaVersion: Number(endpoint.schemaVersion || 0),
                error: "ClipHub 控制回执超时；请确认正式实例已更新到 " + REQUIRED_MODULE_SET
            };
        }
        ack.taskVersion = TASK_VERSION;
        return ack;
    }

    try {
        global.ClipHubToggleResult = main();
    } catch (error) {
        global.ClipHubToggleResult = {
            ok: false,
            command: "toggle",
            taskVersion: TASK_VERSION,
            error: String(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubToggleResult);
