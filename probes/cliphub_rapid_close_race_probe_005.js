/* ClipHub rapid show/hide race regression probe 005. Rhino ES5 only. */
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

    var PROBE = "cliphub_rapid_close_race_probe_005";
    var PROBE_VERSION = 5;
    var EXPECTED_SOURCE_REF =
        "agent/optimize-cliphub-window-startup-v1-20260805";
    var EXPECTED_MODULE_SET_VERSION = "20260806.01";
    var RAPID_PAIR_COUNT = 20;
    var ACK_TIMEOUT_MS = 3500;
    var CONTENT_TIMEOUT_MS = 7000;
    var HIDDEN_TIMEOUT_MS = 1200;
    var PAIR_SETTLE_MS = 60;

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

    function readEndpoint(runtimeDir) {
        var file = new File(new File(runtimeDir, "cache"),
            "control_endpoint.json");
        if (!file.isFile()) {
            throw new Error("ClipHub control endpoint is missing: " +
                file.getAbsolutePath());
        }
        return JSON.parse(readUtf8(file));
    }

    function prepareCommand(runtimeDir, endpoint, command, sequence) {
        var cacheDir = ensureDir(new File(runtimeDir, "cache"));
        var requestId = String(now()) + "-" +
            String(Thread.currentThread().getId()) + "-" +
            String(sequence) + "-" + String(command);
        var ackFile = new File(cacheDir,
            "control_ack_" + requestId + ".json");
        var intent = new Intent(String(endpoint.action));
        if (ackFile.exists()) { ackFile.delete(); }
        intent.putExtra("runtimeDir", String(runtimeDir.getAbsolutePath()));
        intent.putExtra("command", String(command));
        intent.putExtra("requestId", requestId);
        intent.putExtra("controlToken", String(endpoint.token));
        return {
            command: String(command),
            requestId: requestId,
            ackFile: ackFile,
            intent: intent
        };
    }

    function dispatchCommand(prepared) {
        global.context.sendBroadcast(prepared.intent);
        return prepared;
    }

    function waitAck(prepared, timeoutMs) {
        var started = now();
        var ack = null;
        while (now() - started < Number(timeoutMs)) {
            if (prepared.ackFile.isFile()) { break; }
            Thread.sleep(12);
        }
        if (prepared.ackFile.isFile()) {
            try { ack = JSON.parse(readUtf8(prepared.ackFile)); }
            finally { prepared.ackFile.delete(); }
        }
        if (ack === null) {
            throw new Error("Control acknowledgement timeout: " +
                prepared.command);
        }
        if (ack.ok !== true) {
            throw new Error("Control command failed: " +
                prepared.command + ": " +
                String(ack.error || "unknown"));
        }
        return ack;
    }

    function sendCommand(runtimeDir, endpoint, command, sequence) {
        var prepared = prepareCommand(runtimeDir, endpoint,
            command, sequence);
        dispatchCommand(prepared);
        return waitAck(prepared, ACK_TIMEOUT_MS);
    }

    function statusOf(ack) {
        return ack && ack.status ? ack.status : {};
    }

    function performanceOf(status) {
        return status && status.startupPerformance ?
            status.startupPerformance : {};
    }

    function hiddenStatus(status) {
        return status &&
            status.uiVisible !== true &&
            status.filterAttached !== true &&
            status.detailAttached !== true &&
            status.editorAttached !== true &&
            status.settingsAttached !== true &&
            status.translationAttached !== true;
    }

    function waitHidden(runtimeDir, endpoint, sequence, timeoutMs) {
        var started = now();
        var status = {};
        do {
            status = statusOf(sendCommand(runtimeDir, endpoint, "status",
                String(sequence) + "-status-" + String(now())));
            if (hiddenStatus(status)) {
                return {
                    hidden: true,
                    timedOut: false,
                    waitMs: now() - started,
                    status: status
                };
            }
            Thread.sleep(20);
        } while (now() - started < Number(timeoutMs));
        return {
            hidden: hiddenStatus(status),
            timedOut: true,
            waitMs: now() - started,
            status: status
        };
    }

    function waitContentReady(runtimeDir, endpoint, sequence) {
        var started = now();
        var status = {};
        var performance = {};
        do {
            status = statusOf(sendCommand(runtimeDir, endpoint, "status",
                String(sequence) + "-status-" + String(now())));
            performance = performanceOf(status);
            if (status.contentReady === true &&
                    numeric(performance.showToFirstDrawMs) !== null) {
                return {
                    ready: true,
                    timedOut: false,
                    waitMs: now() - started,
                    status: status
                };
            }
            Thread.sleep(30);
        } while (now() - started < CONTENT_TIMEOUT_MS);
        return {
            ready: false,
            timedOut: true,
            waitMs: now() - started,
            status: status
        };
    }

    function preflight(initialAck) {
        var status = statusOf(initialAck);
        var sourceRef = nullableString(initialAck.sourceRef);
        var moduleSetVersion = nullableString(initialAck.moduleSetVersion);
        var errors = [];
        if (sourceRef !== EXPECTED_SOURCE_REF) {
            errors.push("sourceRef mismatch: " + String(sourceRef));
        }
        if (moduleSetVersion !== EXPECTED_MODULE_SET_VERSION) {
            errors.push("moduleSetVersion mismatch: " +
                String(moduleSetVersion));
        }
        if (status.startupPerformance === null ||
                status.startupPerformance === undefined ||
                typeof status.startupPerformance !== "object") {
            errors.push("startupPerformance status is unavailable");
        }
        return {
            ok: errors.length === 0,
            errors: errors,
            sourceRef: sourceRef,
            moduleSetVersion: moduleSetVersion
        };
    }

    function runRapidPair(runtimeDir, endpoint, index) {
        var showPrepared = prepareCommand(runtimeDir, endpoint, "show",
            "rapid-" + String(index) + "-show");
        var hidePrepared = prepareCommand(runtimeDir, endpoint, "hide",
            "rapid-" + String(index) + "-hide");
        var showAck;
        var hideAck;
        var hideStatus;
        var settled;
        dispatchCommand(showPrepared);
        dispatchCommand(hidePrepared);
        showAck = waitAck(showPrepared, ACK_TIMEOUT_MS);
        hideAck = waitAck(hidePrepared, ACK_TIMEOUT_MS);
        hideStatus = statusOf(hideAck);
        settled = waitHidden(runtimeDir, endpoint,
            "rapid-" + String(index) + "-settled", HIDDEN_TIMEOUT_MS);
        Thread.sleep(PAIR_SETTLE_MS);
        return {
            index: index,
            showAction: showAck.action || null,
            hideAction: hideAck.action || null,
            hideAckUiVisible: hideStatus.uiVisible === true,
            hideAckFilterAttached: hideStatus.filterAttached === true,
            hiddenImmediately: hiddenStatus(hideStatus),
            hiddenAfterSettle: settled.hidden === true,
            settleTimedOut: settled.timedOut === true,
            settleWaitMs: settled.waitMs,
            settledUiVisible: settled.status.uiVisible === true,
            settledFilterAttached:
                settled.status.filterAttached === true
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
        var initialAck = sendCommand(runtimeDir, endpoint, "status",
            "initial");
        var initialStatus = statusOf(initialAck);
        var initialVisible = initialStatus.uiVisible === true;
        var check = preflight(initialAck);
        var warmReady = null;
        var warmHidden = null;
        var pair;
        var pairs = [];
        var index;
        var finalHidden = null;
        var finalReady = null;
        var performance = null;
        var immediateHiddenCount = 0;
        var settledHiddenCount = 0;
        var maximumSettleMs = 0;
        var result = {
            ok: false,
            probe: PROBE,
            probeVersion: PROBE_VERSION,
            expectedSourceRef: EXPECTED_SOURCE_REF,
            expectedModuleSetVersion: EXPECTED_MODULE_SET_VERSION,
            sourceRef: check.sourceRef,
            moduleSetVersion: check.moduleSetVersion,
            preflightPassed: check.ok,
            preflightErrors: check.errors,
            destructiveOperations: false,
            databaseWriteExpected: false,
            initialUiVisible: initialVisible,
            warmup: null,
            rapidPairsRequested: RAPID_PAIR_COUNT,
            rapidPairsCompleted: 0,
            rapidPairs: pairs,
            immediateHiddenCount: 0,
            settledHiddenCount: 0,
            maximumSettleMs: 0,
            rapidRacePassed: false,
            finalHidden: null,
            finalShow: null,
            restoredInitialVisibility: false,
            failureStage: null,
            outputPath: String(outputFile.getAbsolutePath()),
            error: null
        };

        try {
            if (!check.ok) {
                result.failureStage = "runtime_preflight";
                throw new Error("Runtime preflight failed: " +
                    check.errors.join("; "));
            }

            sendCommand(runtimeDir, endpoint, "show", "warm-show");
            warmReady = waitContentReady(runtimeDir, endpoint, "warm-ready");
            if (!warmReady.ready) {
                result.failureStage = "warmup_show";
                throw new Error("Warmup content did not become ready");
            }
            sendCommand(runtimeDir, endpoint, "hide", "warm-hide");
            warmHidden = waitHidden(runtimeDir, endpoint,
                "warm-hidden", HIDDEN_TIMEOUT_MS);
            result.warmup = {
                contentReady: warmReady.status.contentReady === true,
                windowCacheBuilt:
                    warmReady.status.windowCacheBuilt === true,
                windowCacheReused:
                    warmReady.status.windowCacheReused === true,
                readyWaitMs: warmReady.waitMs,
                hiddenAfterWarmup: warmHidden.hidden === true,
                hiddenWaitMs: warmHidden.waitMs
            };
            if (!warmHidden.hidden) {
                result.failureStage = "warmup_hide";
                throw new Error("Warmup window did not hide");
            }

            for (index = 1; index <= RAPID_PAIR_COUNT; index += 1) {
                pair = runRapidPair(runtimeDir, endpoint, index);
                pairs.push(pair);
                result.rapidPairsCompleted = pairs.length;
                if (pair.hiddenImmediately) {
                    immediateHiddenCount += 1;
                }
                if (pair.hiddenAfterSettle) {
                    settledHiddenCount += 1;
                }
                maximumSettleMs = Math.max(maximumSettleMs,
                    Number(pair.settleWaitMs || 0));
            }

            result.immediateHiddenCount = immediateHiddenCount;
            result.settledHiddenCount = settledHiddenCount;
            result.maximumSettleMs = maximumSettleMs;
            finalHidden = waitHidden(runtimeDir, endpoint,
                "final-hidden", HIDDEN_TIMEOUT_MS);
            result.finalHidden = {
                hidden: finalHidden.hidden === true,
                timedOut: finalHidden.timedOut === true,
                waitMs: finalHidden.waitMs,
                uiVisible: finalHidden.status.uiVisible === true,
                filterAttached:
                    finalHidden.status.filterAttached === true
            };
            result.rapidRacePassed =
                pairs.length === RAPID_PAIR_COUNT &&
                settledHiddenCount === RAPID_PAIR_COUNT &&
                finalHidden.hidden === true;
            if (!result.rapidRacePassed) {
                result.failureStage = "rapid_show_hide";
                throw new Error("Rapid show/hide race validation failed");
            }

            sendCommand(runtimeDir, endpoint, "show", "final-show");
            finalReady = waitContentReady(runtimeDir, endpoint,
                "final-ready");
            performance = performanceOf(finalReady.status);
            result.finalShow = {
                contentReady:
                    finalReady.status.contentReady === true,
                windowCacheBuilt:
                    finalReady.status.windowCacheBuilt === true,
                windowCacheReused:
                    finalReady.status.windowCacheReused === true,
                readyTimedOut: finalReady.timedOut === true,
                readyWaitMs: finalReady.waitMs,
                showToAttachMs: numeric(performance.showToAttachMs),
                showToFirstDrawMs:
                    numeric(performance.showToFirstDrawMs),
                showToFirstBatchMs:
                    numeric(performance.showToFirstBatchMs),
                showToFullRenderMs:
                    numeric(performance.showToFullRenderMs)
            };
            if (!finalReady.ready ||
                    result.finalShow.windowCacheReused !== true) {
                result.failureStage = "final_show";
                throw new Error("Final cached show validation failed");
            }
            result.ok = true;
        } catch (error) {
            result.error = errorText(error);
        } finally {
            try {
                if (initialVisible) {
                    sendCommand(runtimeDir, endpoint, "show",
                        "restore-show");
                    waitContentReady(runtimeDir, endpoint,
                        "restore-ready");
                } else {
                    sendCommand(runtimeDir, endpoint, "hide",
                        "restore-hide");
                    waitHidden(runtimeDir, endpoint,
                        "restore-hidden", HIDDEN_TIMEOUT_MS);
                }
                result.restoredInitialVisibility = true;
            } catch (restoreError) {
                result.restoredInitialVisibility = false;
                result.ok = false;
                if (result.error === null) {
                    result.failureStage = "restore";
                    result.error = "Restore failed: " +
                        errorText(restoreError);
                }
            }
            result.finishedAt = now();
            result.durationMs = result.finishedAt - startedAt;
            writeUtf8(outputFile,
                JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try {
        global.ClipHubRapidCloseRaceProbe005Result = main();
    } catch (error) {
        global.ClipHubRapidCloseRaceProbe005Result = {
            ok: false,
            probe: PROBE,
            probeVersion: PROBE_VERSION,
            failureStage: "probe_bootstrap",
            error: errorText(error),
            finishedAt: now()
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubRapidCloseRaceProbe005Result);
