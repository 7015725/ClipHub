/* ClipHub hidden-dirty refresh and rapid show/hide probe 004. Rhino ES5 only. */
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
    var AndroidContext = Packages.android.content.Context;
    var Handler = Packages.android.os.Handler;
    var Looper = Packages.android.os.Looper;
    var Toast = Packages.android.widget.Toast;

    var PROBE = "cliphub_dirty_refresh_probe_004";
    var PROBE_VERSION = 4;
    var EXPECTED_SOURCE_REF =
        "agent/optimize-cliphub-window-startup-v1-20260805";
    var EXPECTED_MODULE_SET_VERSION = "20260805.03";
    var CLIPBOARD_WAIT_MS = 60000;
    var ACK_TIMEOUT_MS = 3500;
    var CONTENT_TIMEOUT_MS = 7000;
    var LISTENER_SETTLE_MS = 1200;
    var RAPID_PAIR_COUNT = 10;
    var CACHE_SETTLE_MS = 120;

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

    function toast(text) {
        try {
            new Handler(Looper.getMainLooper()).post(
                new Packages.java.lang.Runnable({
                    run: function () {
                        try {
                            Toast.makeText(global.context, String(text),
                                Toast.LENGTH_LONG).show();
                        } catch (ignoredToast) {}
                    }
                })
            );
        } catch (ignored) {}
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
            Thread.sleep(15);
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
                    numeric(performance.showToFirstDrawMs) !== null) {
                return {
                    status: status,
                    timedOut: false,
                    waitMs: now() - started
                };
            }
            Thread.sleep(35);
        } while (now() - started < CONTENT_TIMEOUT_MS);
        return {
            status: status || {},
            timedOut: true,
            waitMs: now() - started
        };
    }

    function readClipboardText(manager) {
        var clip;
        var count;
        var index;
        var item;
        var value;
        var parts = [];
        if (manager === null || manager === undefined) { return null; }
        try { clip = manager.getPrimaryClip(); }
        catch (ignoredRead) { return null; }
        if (clip === null) { return null; }
        try { count = Number(clip.getItemCount()); }
        catch (ignoredCount) { return null; }
        for (index = 0; index < count; index += 1) {
            try {
                item = clip.getItemAt(index);
                value = item === null ? null : item.getText();
                if (value === null && item !== null) {
                    value = item.coerceToText(global.context);
                }
                if (value !== null) { parts.push(String(value)); }
            } catch (ignoredItem) {}
        }
        if (parts.length === 0) { return null; }
        return parts.join("\n");
    }

    function waitClipboardChange(manager, initialText, timeoutMs) {
        var started = now();
        var current;
        while (now() - started < Number(timeoutMs)) {
            current = readClipboardText(manager);
            if (current !== null && current.length > 0 &&
                    current !== initialText) {
                return {
                    changed: true,
                    waitMs: now() - started,
                    length: current.length
                };
            }
            Thread.sleep(80);
        }
        current = readClipboardText(manager);
        return {
            changed: current !== null && current.length > 0 &&
                current !== initialText,
            waitMs: now() - started,
            length: current === null ? 0 : current.length
        };
    }

    function preflight(initialAck) {
        var status = statusOf(initialAck);
        var sourceRef = nullableString(initialAck.sourceRef);
        var moduleSetVersion = nullableString(initialAck.moduleSetVersion);
        var performance = performanceOf(status);
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
            moduleSetVersion: moduleSetVersion,
            startupPerformanceAvailable:
                typeof performance === "object"
        };
    }

    function readySnapshot(showAck, ready) {
        var status = ready && ready.status ? ready.status : {};
        var performance = performanceOf(status);
        return {
            showAction: showAck && showAck.action ? showAck.action : null,
            windowCacheBuilt: status.windowCacheBuilt === true,
            windowCacheReused: status.windowCacheReused === true,
            contentReady: status.contentReady === true,
            readyTimedOut: ready ? ready.timedOut === true : true,
            readyWaitMs: ready ? ready.waitMs : null,
            renderedCount: Number(status.renderedCount || 0),
            showToAttachMs: numeric(performance.showToAttachMs),
            showToFirstDrawMs: numeric(performance.showToFirstDrawMs),
            showToFirstBatchMs: numeric(performance.showToFirstBatchMs),
            showToFullRenderMs: numeric(performance.showToFullRenderMs),
            renderBatchCount: Number(performance.renderBatchCount || 0),
            performanceError: performance.lastError || null
        };
    }

    function runRapidPairs(runtimeDir, endpoint, count) {
        var pairs = [];
        var index;
        var showPrepared;
        var hidePrepared;
        var showAck;
        var hideAck;
        for (index = 0; index < count; index += 1) {
            showPrepared = prepareCommand(runtimeDir, endpoint, "show",
                "rapid-" + String(index) + "-show");
            hidePrepared = prepareCommand(runtimeDir, endpoint, "hide",
                "rapid-" + String(index) + "-hide");
            dispatchCommand(showPrepared);
            dispatchCommand(hidePrepared);
            showAck = waitAck(showPrepared, ACK_TIMEOUT_MS);
            hideAck = waitAck(hidePrepared, ACK_TIMEOUT_MS);
            pairs.push({
                index: index + 1,
                showAction: showAck.action || null,
                hideAction: hideAck.action || null,
                hiddenAfterPair:
                    statusOf(hideAck).uiVisible !== true
            });
        }
        return pairs;
    }

    function main() {
        var startedAt = now();
        var shortxRoot = String(shortx.getShortXDir());
        var runtimeDir = new File(shortxRoot, "ClipHub");
        var endpoint = readEndpoint(runtimeDir);
        var probeDir = ensureDir(new File(runtimeDir, "probes"));
        var outputFile = new File(probeDir,
            PROBE + "_" + String(startedAt) + ".json");
        var clipboardManager = global.context.getSystemService(
            AndroidContext.CLIPBOARD_SERVICE);
        var initialAck = sendCommand(runtimeDir, endpoint, "status", "initial");
        var initialStatus = statusOf(initialAck);
        var initialVisible = initialStatus.uiVisible === true;
        var initialClipboardText = null;
        var check = preflight(initialAck);
        var clipboardChange = null;
        var warmupFirstAck = null;
        var warmupFirstReady = null;
        var cacheConfirmAck = null;
        var cacheConfirmReady = null;
        var dirtyShowAck = null;
        var dirtyReady = null;
        var dirtyStatus = null;
        var dirtyPerformance = null;
        var rapidPairs = [];
        var afterRapidStatus = null;
        var finalReady = null;
        var stage = "preflight";
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
            requiresUserClipboardChange: true,
            databaseWriteExpected: true,
            destructiveOperations: false,
            clipboardWaitTimeoutMs: CLIPBOARD_WAIT_MS,
            initialUiVisible: initialVisible,
            cacheWarmup: null,
            cacheConfirmation: null,
            cachePrepared: false,
            clipboardChanged: false,
            clipboardChangeWaitMs: null,
            copiedTextLength: 0,
            dirtyRefresh: null,
            rapidPairsRequested: RAPID_PAIR_COUNT,
            rapidPairsCompleted: 0,
            rapidPairs: rapidPairs,
            rapidRacePassed: false,
            restoredInitialVisibility: false,
            outputPath: String(outputFile.getAbsolutePath()),
            failureStage: null,
            error: null
        };

        try {
            if (!check.ok) {
                throw new Error("Runtime preflight failed: " +
                    check.errors.join("; "));
            }

            stage = "cache_warmup";
            warmupFirstAck = sendCommand(runtimeDir, endpoint, "show",
                "warmup-first-show");
            warmupFirstReady = waitContentReady(runtimeDir, endpoint,
                "warmup-first-ready");
            result.cacheWarmup = readySnapshot(warmupFirstAck,
                warmupFirstReady);
            if (result.cacheWarmup.contentReady !== true ||
                    result.cacheWarmup.readyTimedOut === true ||
                    result.cacheWarmup.windowCacheBuilt !== true) {
                throw new Error("Window cache warmup failed");
            }
            sendCommand(runtimeDir, endpoint, "hide",
                "warmup-first-hide");
            Thread.sleep(CACHE_SETTLE_MS);

            stage = "cache_confirmation";
            cacheConfirmAck = sendCommand(runtimeDir, endpoint, "show",
                "cache-confirm-show");
            cacheConfirmReady = waitContentReady(runtimeDir, endpoint,
                "cache-confirm-ready");
            result.cacheConfirmation = readySnapshot(cacheConfirmAck,
                cacheConfirmReady);
            result.cachePrepared =
                result.cacheConfirmation.windowCacheReused === true &&
                result.cacheConfirmation.contentReady === true &&
                result.cacheConfirmation.readyTimedOut !== true;
            if (!result.cachePrepared) {
                throw new Error("Window cache confirmation failed");
            }
            sendCommand(runtimeDir, endpoint, "hide",
                "cache-confirm-hide");
            Thread.sleep(CACHE_SETTLE_MS);

            stage = "clipboard_wait";
            initialClipboardText = readClipboardText(clipboardManager);
            toast("ClipHub 阶段2 V2：请在60秒内复制一段新的文本");
            clipboardChange = waitClipboardChange(clipboardManager,
                initialClipboardText, CLIPBOARD_WAIT_MS);
            result.clipboardChanged = clipboardChange.changed === true;
            result.clipboardChangeWaitMs = clipboardChange.waitMs;
            result.copiedTextLength = clipboardChange.length;
            if (!clipboardChange.changed) {
                throw new Error("Clipboard did not change within 60 seconds");
            }

            stage = "dirty_refresh";
            Thread.sleep(LISTENER_SETTLE_MS);
            dirtyShowAck = sendCommand(runtimeDir, endpoint, "show",
                "dirty-show");
            dirtyReady = waitContentReady(runtimeDir, endpoint,
                "dirty-ready");
            dirtyStatus = dirtyReady.status;
            dirtyPerformance = performanceOf(dirtyStatus);
            result.dirtyRefresh = {
                showAction: dirtyShowAck.action || null,
                windowCacheReused:
                    dirtyStatus.windowCacheReused === true,
                contentReady: dirtyStatus.contentReady === true,
                readyTimedOut: dirtyReady.timedOut === true,
                readyWaitMs: dirtyReady.waitMs,
                renderedCount: Number(dirtyStatus.renderedCount || 0),
                showToAttachMs:
                    numeric(dirtyPerformance.showToAttachMs),
                showToFirstDrawMs:
                    numeric(dirtyPerformance.showToFirstDrawMs),
                showToFirstBatchMs:
                    numeric(dirtyPerformance.showToFirstBatchMs),
                showToFullRenderMs:
                    numeric(dirtyPerformance.showToFullRenderMs),
                renderBatchCount:
                    Number(dirtyPerformance.renderBatchCount || 0),
                performanceError:
                    dirtyPerformance.lastError || null
            };

            if (result.dirtyRefresh.windowCacheReused !== true ||
                    result.dirtyRefresh.contentReady !== true ||
                    result.dirtyRefresh.readyTimedOut === true ||
                    result.dirtyRefresh.showToFirstDrawMs === null ||
                    result.dirtyRefresh.renderBatchCount < 1) {
                throw new Error("Dirty refresh validation failed");
            }

            stage = "rapid_show_hide";
            sendCommand(runtimeDir, endpoint, "hide", "before-rapid");
            rapidPairs = runRapidPairs(runtimeDir, endpoint,
                RAPID_PAIR_COUNT);
            result.rapidPairs = rapidPairs;
            result.rapidPairsCompleted = rapidPairs.length;
            Thread.sleep(500);
            afterRapidStatus = statusOf(sendCommand(runtimeDir, endpoint,
                "status", "after-rapid"));
            result.rapidRacePassed =
                rapidPairs.length === RAPID_PAIR_COUNT &&
                afterRapidStatus.uiVisible !== true &&
                afterRapidStatus.filterAttached !== true;
            if (!result.rapidRacePassed) {
                throw new Error("Rapid show/hide race validation failed");
            }

            stage = "final_show";
            sendCommand(runtimeDir, endpoint, "show", "final-show");
            finalReady = waitContentReady(runtimeDir, endpoint,
                "final-ready");
            result.finalShow = {
                windowCacheReused:
                    finalReady.status.windowCacheReused === true,
                contentReady:
                    finalReady.status.contentReady === true,
                readyTimedOut: finalReady.timedOut === true,
                readyWaitMs: finalReady.waitMs,
                renderedCount:
                    Number(finalReady.status.renderedCount || 0),
                performance:
                    performanceOf(finalReady.status)
            };
            result.ok = result.cachePrepared === true &&
                result.rapidRacePassed === true &&
                result.finalShow.windowCacheReused === true &&
                result.finalShow.contentReady === true &&
                result.finalShow.readyTimedOut !== true;
        } catch (error) {
            result.failureStage = stage;
            result.error = errorText(error);
        } finally {
            try {
                if (initialVisible) {
                    sendCommand(runtimeDir, endpoint, "show",
                        "restore-show");
                    waitContentReady(runtimeDir, endpoint, "restore");
                } else {
                    sendCommand(runtimeDir, endpoint, "hide",
                        "restore-hide");
                }
                result.restoredInitialVisibility = true;
            } catch (restoreFailure) {
                result.restoredInitialVisibility = false;
                if (result.error === null) {
                    result.error = "Restore failed: " +
                        errorText(restoreFailure);
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
        global.ClipHubDirtyRefreshProbe004Result = main();
    } catch (error) {
        global.ClipHubDirtyRefreshProbe004Result = {
            ok: false,
            probe: PROBE,
            probeVersion: PROBE_VERSION,
            error: errorText(error),
            finishedAt: now()
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubDirtyRefreshProbe004Result);
