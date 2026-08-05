/* ClipHub warm-window startup performance probe 001. Rhino ES5 only. */
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
    var Intent = Packages.android.content.Intent;

    var PROBE = "cliphub_startup_performance_probe_001";
    var PROBE_VERSION = 1;
    var CYCLES = 20;
    var ACK_TIMEOUT_MS = 3500;
    var CONTENT_TIMEOUT_MS = 6000;

    function now() { return Number(System.currentTimeMillis()); }

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
            throw new Error("Cannot create directory: " +
                dir.getAbsolutePath());
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

    function waitFor(callback, timeoutMs) {
        var started = now();
        while (now() - started < Number(timeoutMs)) {
            if (callback()) { return true; }
            Thread.sleep(20);
        }
        return callback();
    }

    function readEndpoint(runtimeDir) {
        var file = new File(new File(runtimeDir, "cache"),
            "control_endpoint.json");
        if (!file.isFile()) {
            throw new Error("ClipHub control endpoint is missing: " +
                file.getAbsolutePath());
        }
        return JSON.parse(readUtf8(file));
    }

    function sendCommand(runtimeDir, endpoint, command, sequence) {
        var cacheDir = ensureDir(new File(runtimeDir, "cache"));
        var requestId = String(now()) + "-" +
            String(Thread.currentThread().getId()) + "-" +
            String(sequence) + "-" + String(command);
        var ackFile = new File(cacheDir,
            "control_ack_" + requestId + ".json");
        var intent = new Intent(String(endpoint.action));
        var ack = null;
        if (ackFile.exists()) { ackFile.delete(); }
        intent.putExtra("runtimeDir", String(runtimeDir.getAbsolutePath()));
        intent.putExtra("command", String(command));
        intent.putExtra("requestId", requestId);
        intent.putExtra("controlToken", String(endpoint.token));
        global.context.sendBroadcast(intent);
        waitFor(function () { return ackFile.isFile(); }, ACK_TIMEOUT_MS);
        if (ackFile.isFile()) {
            try { ack = JSON.parse(readUtf8(ackFile)); }
            finally { ackFile.delete(); }
        }
        if (ack === null) {
            throw new Error("Control acknowledgement timeout: " + command);
        }
        if (ack.ok !== true) {
            throw new Error("Control command failed: " + command + ": " +
                String(ack.error || "unknown"));
        }
        return ack;
    }

    function statusOf(ack) {
        return ack && ack.status ? ack.status : {};
    }

    function performanceOf(status) {
        return status && status.startupPerformance ?
            status.startupPerformance : {};
    }

    function waitContentReady(runtimeDir, endpoint, sequence) {
        var started = now();
        var ack = null;
        var status = null;
        var performance = null;
        do {
            ack = sendCommand(runtimeDir, endpoint, "status",
                String(sequence) + "-status-" + String(now()));
            status = statusOf(ack);
            performance = performanceOf(status);
            if (status.contentReady === true &&
                    performance.showToFirstDrawMs !== null &&
                    performance.showToFirstDrawMs !== undefined) {
                return status;
            }
            Thread.sleep(35);
        } while (now() - started < CONTENT_TIMEOUT_MS);
        return status || {};
    }

    function numeric(value) {
        value = Number(value);
        return isFinite(value) ? value : null;
    }

    function collectMetric(samples, key) {
        var values = [];
        var index;
        var value;
        for (index = 0; index < samples.length; index += 1) {
            value = numeric(samples[index][key]);
            if (value !== null) { values.push(value); }
        }
        values.sort(function (left, right) { return left - right; });
        return values;
    }

    function percentile(values, ratio) {
        var index;
        if (!values || values.length === 0) { return null; }
        index = Math.ceil(values.length * Number(ratio)) - 1;
        index = Math.max(0, Math.min(values.length - 1, index));
        return values[index];
    }

    function summarize(samples, key) {
        var values = collectMetric(samples, key);
        var sum = 0;
        var index;
        for (index = 0; index < values.length; index += 1) {
            sum += values[index];
        }
        return {
            count: values.length,
            minimumMs: values.length > 0 ? values[0] : null,
            medianMs: percentile(values, 0.5),
            p95Ms: percentile(values, 0.95),
            maximumMs: values.length > 0 ?
                values[values.length - 1] : null,
            averageMs: values.length > 0 ?
                Math.round((sum / values.length) * 1000) / 1000 : null
        };
    }

    function main() {
        var startedAt = now();
        var shortxRoot = String(shortx.getShortXDir());
        var runtimeDir = new File(shortxRoot, "ClipHub");
        var endpoint = readEndpoint(runtimeDir);
        var probeDir = ensureDir(new File(runtimeDir, "probes"));
        var outputFile = new File(probeDir,
            PROBE + "_" + String(startedAt) + ".json");
        var initialAck = sendCommand(runtimeDir, endpoint, "status", "initial");
        var initialVisible = statusOf(initialAck).uiVisible === true;
        var samples = [];
        var index;
        var showAck;
        var readyStatus;
        var perf;
        var restoreError = null;
        var result = {
            ok: false,
            probe: PROBE,
            probeVersion: PROBE_VERSION,
            readOnlyData: true,
            destructiveOperations: false,
            cyclesRequested: CYCLES,
            cyclesCompleted: 0,
            startedAt: startedAt,
            runtimeDir: String(runtimeDir.getAbsolutePath()),
            outputPath: String(outputFile.getAbsolutePath()),
            initialUiVisible: initialVisible,
            moduleSetVersion: initialAck.moduleSetVersion || null,
            sourceRef: initialAck.sourceRef || null,
            samples: samples,
            summary: null,
            cacheReuseCount: 0,
            contentReadyCount: 0,
            firstDrawReadyCount: 0,
            restoredInitialVisibility: false,
            error: null
        };

        try {
            sendCommand(runtimeDir, endpoint, "hide", "warmup-hide");
            Thread.sleep(100);
            sendCommand(runtimeDir, endpoint, "show", "warmup-show");
            waitContentReady(runtimeDir, endpoint, "warmup");
            sendCommand(runtimeDir, endpoint, "hide", "warmup-end");
            Thread.sleep(100);

            for (index = 0; index < CYCLES; index += 1) {
                showAck = sendCommand(runtimeDir, endpoint, "show",
                    "cycle-" + String(index) + "-show");
                readyStatus = waitContentReady(runtimeDir, endpoint,
                    "cycle-" + String(index));
                perf = performanceOf(readyStatus);
                samples.push({
                    cycle: index + 1,
                    showAction: showAck.action || null,
                    windowCacheReused:
                        readyStatus.windowCacheReused === true,
                    contentReady: readyStatus.contentReady === true,
                    renderedCount: Number(readyStatus.renderedCount || 0),
                    showToAttachMs: numeric(perf.showToAttachMs),
                    showToFirstDrawMs: numeric(perf.showToFirstDrawMs),
                    showToFirstBatchMs: numeric(perf.showToFirstBatchMs),
                    showToFullRenderMs: numeric(perf.showToFullRenderMs),
                    renderBatchCount: Number(perf.renderBatchCount || 0),
                    performanceError: perf.lastError || null
                });
                if (readyStatus.windowCacheReused === true) {
                    result.cacheReuseCount += 1;
                }
                if (readyStatus.contentReady === true) {
                    result.contentReadyCount += 1;
                }
                if (numeric(perf.showToFirstDrawMs) !== null) {
                    result.firstDrawReadyCount += 1;
                }
                result.cyclesCompleted = samples.length;
                sendCommand(runtimeDir, endpoint, "hide",
                    "cycle-" + String(index) + "-hide");
                Thread.sleep(80);
            }

            result.summary = {
                showToAttach: summarize(samples, "showToAttachMs"),
                showToFirstDraw: summarize(samples, "showToFirstDrawMs"),
                showToFirstBatch: summarize(samples, "showToFirstBatchMs"),
                showToFullRender: summarize(samples, "showToFullRenderMs")
            };
            result.ok = result.cyclesCompleted === CYCLES &&
                result.cacheReuseCount === CYCLES &&
                result.contentReadyCount === CYCLES &&
                result.firstDrawReadyCount === CYCLES;
        } catch (error) {
            result.error = errorText(error);
        } finally {
            try {
                if (initialVisible) {
                    sendCommand(runtimeDir, endpoint, "show", "restore-show");
                    waitContentReady(runtimeDir, endpoint, "restore");
                } else {
                    sendCommand(runtimeDir, endpoint, "hide", "restore-hide");
                }
                result.restoredInitialVisibility = true;
            } catch (restoreFailure) {
                restoreError = errorText(restoreFailure);
                result.restoredInitialVisibility = false;
                if (result.error === null) {
                    result.error = "Restore failed: " + restoreError;
                }
                result.ok = false;
            }
            result.finishedAt = now();
            result.durationMs = result.finishedAt - startedAt;
            writeUtf8(outputFile, JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try {
        global.ClipHubStartupPerformanceProbe001Result = main();
    } catch (error) {
        global.ClipHubStartupPerformanceProbe001Result = {
            ok: false,
            probe: PROBE,
            probeVersion: PROBE_VERSION,
            error: errorText(error),
            finishedAt: now()
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubStartupPerformanceProbe001Result);
