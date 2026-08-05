/* ClipHub warm-window startup performance probe 002. Rhino ES5 only. */
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

    var PROBE = "cliphub_startup_performance_probe_002";
    var PROBE_VERSION = 2;
    var EXPECTED_SOURCE_REF =
        "agent/optimize-cliphub-window-startup-v1-20260805";
    var EXPECTED_MODULE_SET_VERSION = "20260805.03";
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

    function nullableString(value) {
        if (value === null || value === undefined || String(value) === "") {
            return null;
        }
        return String(value);
    }

    function numeric(value) {
        var number;
        if (value === null || value === undefined || value === "") {
            return null;
        }
        number = Number(value);
        return isFinite(number) ? number : null;
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
            status.startupPerformance : null;
    }

    function runtimeIdentity(ack) {
        var status = statusOf(ack);
        return {
            sourceRef: nullableString(ack.sourceRef || status.sourceRef),
            moduleSetVersion: nullableString(
                ack.moduleSetVersion || status.moduleSetVersion),
            entryVersion: numeric(ack.entryVersion || status.entryVersion),
            startupPerformanceAvailable:
                performanceOf(status) !== null
        };
    }

    function waitContentReady(runtimeDir, endpoint, sequence) {
        var started = now();
        var ack = null;
        var status = {};
        var performance = null;
        var firstDraw = null;
        do {
            ack = sendCommand(runtimeDir, endpoint, "status",
                String(sequence) + "-status-" + String(now()));
            status = statusOf(ack);
            performance = performanceOf(status);
            firstDraw = performance === null ? null :
                numeric(performance.showToFirstDrawMs);
            if (status.contentReady === true && firstDraw !== null) {
                return {
                    ready: true,
                    timedOut: false,
                    elapsedMs: now() - started,
                    status: status
                };
            }
            Thread.sleep(35);
        } while (now() - started < CONTENT_TIMEOUT_MS);
        return {
            ready: false,
            timedOut: true,
            elapsedMs: now() - started,
            status: status || {}
        };
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
            missingCount: samples.length - values.length,
            minimumMs: values.length > 0 ? values[0] : null,
            medianMs: percentile(values, 0.5),
            p95Ms: percentile(values, 0.95),
            maximumMs: values.length > 0 ?
                values[values.length - 1] : null,
            averageMs: values.length > 0 ?
                Math.round((sum / values.length) * 1000) / 1000 : null
        };
    }

    function createResult(startedAt, runtimeDir, outputFile) {
        return {
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
            expectedSourceRef: EXPECTED_SOURCE_REF,
            expectedModuleSetVersion: EXPECTED_MODULE_SET_VERSION,
            sourceRef: null,
            moduleSetVersion: null,
            entryVersion: null,
            initialUiVisible: false,
            preflightPassed: false,
            preflight: null,
            samples: [],
            summary: null,
            cacheReuseCount: 0,
            contentReadyCount: 0,
            firstDrawReadyCount: 0,
            timedOutCount: 0,
            restoredInitialVisibility: false,
            failureStage: null,
            error: null
        };
    }

    function main() {
        var startedAt = now();
        var shortxRoot = String(shortx.getShortXDir());
        var runtimeDir = new File(shortxRoot, "ClipHub");
        var probeDir = ensureDir(new File(runtimeDir, "probes"));
        var outputFile = new File(probeDir,
            PROBE + "_" + String(startedAt) + ".json");
        var result = createResult(startedAt, runtimeDir, outputFile);
        var endpoint = null;
        var initialAck = null;
        var identity = null;
        var initialVisible = false;
        var runtimeTouched = false;
        var index;
        var showAck;
        var readyResult;
        var readyStatus;
        var perf;

        try {
            endpoint = readEndpoint(runtimeDir);
            initialAck = sendCommand(runtimeDir, endpoint, "status", "initial");
            identity = runtimeIdentity(initialAck);
            initialVisible = statusOf(initialAck).uiVisible === true;
            result.initialUiVisible = initialVisible;
            result.sourceRef = identity.sourceRef;
            result.moduleSetVersion = identity.moduleSetVersion;
            result.entryVersion = identity.entryVersion;
            result.preflight = {
                sourceRefMatched:
                    identity.sourceRef === EXPECTED_SOURCE_REF,
                moduleSetVersionMatched:
                    identity.moduleSetVersion === EXPECTED_MODULE_SET_VERSION,
                startupPerformanceAvailable:
                    identity.startupPerformanceAvailable === true
            };
            result.preflightPassed =
                result.preflight.sourceRefMatched === true &&
                result.preflight.moduleSetVersionMatched === true &&
                result.preflight.startupPerformanceAvailable === true;

            if (!result.preflightPassed) {
                result.failureStage = "runtime_preflight";
                result.error = "Runtime mismatch. Stop the existing ClipHub " +
                    "runtime, replace and execute the test-branch ClipHub.js, " +
                    "then run probe 002 again.";
                result.restoredInitialVisibility = true;
                return result;
            }

            runtimeTouched = true;
            sendCommand(runtimeDir, endpoint, "hide", "warmup-hide");
            Thread.sleep(100);
            sendCommand(runtimeDir, endpoint, "show", "warmup-show");
            readyResult = waitContentReady(runtimeDir, endpoint, "warmup");
            if (!readyResult.ready) {
                throw new Error("Warm-up content readiness timeout");
            }
            sendCommand(runtimeDir, endpoint, "hide", "warmup-end");
            Thread.sleep(100);

            for (index = 0; index < CYCLES; index += 1) {
                showAck = sendCommand(runtimeDir, endpoint, "show",
                    "cycle-" + String(index) + "-show");
                readyResult = waitContentReady(runtimeDir, endpoint,
                    "cycle-" + String(index));
                readyStatus = readyResult.status || {};
                perf = performanceOf(readyStatus) || {};
                result.samples.push({
                    cycle: index + 1,
                    showAction: showAck.action || null,
                    windowCacheReused:
                        readyStatus.windowCacheReused === true,
                    contentReady: readyStatus.contentReady === true,
                    readyTimedOut: readyResult.timedOut === true,
                    readyWaitMs: Number(readyResult.elapsedMs || 0),
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
                if (readyResult.timedOut === true) {
                    result.timedOutCount += 1;
                }
                result.cyclesCompleted = result.samples.length;
                sendCommand(runtimeDir, endpoint, "hide",
                    "cycle-" + String(index) + "-hide");
                Thread.sleep(80);
            }

            result.summary = {
                showToAttach: summarize(result.samples, "showToAttachMs"),
                showToFirstDraw:
                    summarize(result.samples, "showToFirstDrawMs"),
                showToFirstBatch:
                    summarize(result.samples, "showToFirstBatchMs"),
                showToFullRender:
                    summarize(result.samples, "showToFullRenderMs"),
                readyWait: summarize(result.samples, "readyWaitMs")
            };
            result.ok = result.preflightPassed === true &&
                result.cyclesCompleted === CYCLES &&
                result.cacheReuseCount === CYCLES &&
                result.contentReadyCount === CYCLES &&
                result.firstDrawReadyCount === CYCLES &&
                result.timedOutCount === 0;
            if (!result.ok) {
                result.failureStage = "performance_validation";
            }
        } catch (error) {
            result.failureStage = result.failureStage || "probe_execution";
            result.error = errorText(error);
            result.ok = false;
        } finally {
            if (runtimeTouched && endpoint !== null) {
                try {
                    if (initialVisible) {
                        sendCommand(runtimeDir, endpoint, "show", "restore-show");
                        waitContentReady(runtimeDir, endpoint, "restore");
                    } else {
                        sendCommand(runtimeDir, endpoint, "hide", "restore-hide");
                    }
                    result.restoredInitialVisibility = true;
                } catch (restoreFailure) {
                    result.restoredInitialVisibility = false;
                    if (result.error === null) {
                        result.error = "Restore failed: " +
                            errorText(restoreFailure);
                    }
                    result.failureStage = "restore_visibility";
                    result.ok = false;
                }
            }
            result.finishedAt = now();
            result.durationMs = result.finishedAt - startedAt;
            writeUtf8(outputFile, JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try {
        global.ClipHubStartupPerformanceProbe002Result = main();
    } catch (error) {
        global.ClipHubStartupPerformanceProbe002Result = {
            ok: false,
            probe: PROBE,
            probeVersion: PROBE_VERSION,
            failureStage: "top_level",
            error: errorText(error),
            finishedAt: now()
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubStartupPerformanceProbe002Result);
