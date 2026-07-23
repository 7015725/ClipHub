/*
 * ShortX 任务名称：ClipHub 剪贴板开关
 * 作用：切换 ClipHub 剪贴板悬浮窗的显示与隐藏。
 * 本任务不会停止后台实例，也不会关闭数据库或剪贴板监听。
 * 运行前提：先启动“ClipHub 剪贴板后台”任务。
 * 运行环境：Rhino ES5。
 */
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
    var TASK_VERSION = 3;
    var REQUIRED_ENDPOINT_SCHEMA = 3;
    var MIN_ENTRY_VERSION = 5;

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
        if (!file.isDirectory()) {
            throw new Error("Not a directory: " + file.getAbsolutePath());
        }
        return file;
    }

    function validRuntimeName(value) {
        return /^[A-Za-z0-9._-]+$/.test(String(value)) &&
            String(value) !== "." && String(value) !== "..";
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

    function outdatedRuntime(endpoint) {
        return {
            ok: false,
            command: "toggle",
            taskVersion: TASK_VERSION,
            running: true,
            updateRequired: true,
            endpointSchemaVersion: Number(endpoint && endpoint.schemaVersion || 0),
            entryVersion: Number(endpoint && endpoint.entryVersion || 0),
            moduleSetVersion: String(endpoint && endpoint.moduleSetVersion || ""),
            sourceRef: String(endpoint && endpoint.sourceRef || ""),
            requiredEndpointSchemaVersion: REQUIRED_ENDPOINT_SCHEMA,
            minimumEntryVersion: MIN_ENTRY_VERSION,
            error: "ClipHub 后台入口或控制协议过旧，请停止实例后重新执行完整 ClipHub.js"
        };
    }

    function main() {
        var options = global.ClipHubControlOptions || {};
        var root = String(shortx.getShortXDir());
        var runtimeName = options.runtimeName === undefined ?
            "ClipHub" : String(options.runtimeName);
        var runtimeDir;
        var cacheDir;
        var endpointFile;
        var endpoint;
        var requestId;
        var ackFile;
        var intent;
        var ack = null;
        var timeoutMs = Number(options.timeoutMs || 3000);

        if (!validRuntimeName(runtimeName)) {
            throw new Error("Invalid ClipHub runtime name: " + runtimeName);
        }
        if (!isFinite(timeoutMs) || timeoutMs < 500 || timeoutMs > 10000) {
            timeoutMs = 3000;
        }
        runtimeDir = new File(root, runtimeName);
        cacheDir = ensureDir(new File(runtimeDir, "cache"));
        endpointFile = new File(cacheDir, "control_endpoint.json");

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
                Number(endpoint.entryVersion || 0) < MIN_ENTRY_VERSION ||
                String(endpoint.moduleSetVersion || "").length === 0 ||
                String(endpoint.sourceRef || "").length === 0 ||
                !containsCommand(endpoint.commands, "toggle")) {
            return outdatedRuntime(endpoint);
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
        waitFor(function () { return ackFile.isFile(); }, timeoutMs);
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
                entryVersion: Number(endpoint.entryVersion || 0),
                moduleSetVersion: String(endpoint.moduleSetVersion || ""),
                sourceRef: String(endpoint.sourceRef || ""),
                error: "ClipHub 控制回执超时，请重新执行完整 ClipHub.js 后重试"
            };
        }
        ack.taskVersion = TASK_VERSION;
        ack.endpointSchemaVersion = Number(endpoint.schemaVersion || 0);
        ack.entryVersion = Number(endpoint.entryVersion || 0);
        ack.moduleSetVersion = String(endpoint.moduleSetVersion || "");
        ack.sourceRef = String(endpoint.sourceRef || "");
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
