/* ClipHub formal runtime stop helper. Rhino ES5 only. */
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
    function waitFor(predicate, timeoutMs) {
        var started = now();
        while (now() - started < timeoutMs) {
            if (predicate()) { return true; }
            Thread.sleep(25);
        }
        return predicate();
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
        var initiallyRunning = !lockFree(runtimeDir);
        if (!initiallyRunning) {
            return {
                ok: true,
                stopped: true,
                alreadyStopped: true,
                initiallyRunning: false,
                lockReleased: true,
                endpointRemoved: !endpointFile.exists(),
                ackReceived: false,
                error: null
            };
        }
        if (!endpointFile.isFile()) {
            throw new Error("Formal control endpoint is missing");
        }
        endpoint = JSON.parse(read(endpointFile));
        if (!endpoint || String(endpoint.transport || "") !==
                "dynamic_broadcast_token" ||
                String(endpoint.runtimeDir || "") !==
                    String(runtimeDir.getAbsolutePath())) {
            throw new Error("Invalid formal control endpoint");
        }
        requestId = String(now()) + "-" + Number(Thread.currentThread().getId());
        ackFile = new File(cacheDir, "control_ack_" + requestId + ".json");
        if (ackFile.exists()) { ackFile.delete(); }
        intent = new Intent(String(endpoint.action));
        intent.putExtra("runtimeDir", String(runtimeDir.getAbsolutePath()));
        intent.putExtra("command", "stop");
        intent.putExtra("requestId", requestId);
        intent.putExtra("controlToken", String(endpoint.token));
        global.context.sendBroadcast(intent);
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
            stopped: lockFree(runtimeDir),
            alreadyStopped: false,
            initiallyRunning: true,
            lockReleased: lockFree(runtimeDir),
            endpointRemoved: !endpointFile.exists(),
            ackReceived: ack !== null,
            ackThreadId: ack === null ? null : Number(ack.threadId),
            ackThreadName: ack === null ? null : String(ack.threadName || ""),
            transport: "dynamic_broadcast_token",
            error: ack === null ? "Control acknowledgement not received" : null
        };
    }

    try {
        global.ClipHubStopFormalResult = main();
    } catch (error) {
        global.ClipHubStopFormalResult = {
            ok: false,
            stopped: false,
            error: String(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubStopFormalResult);
