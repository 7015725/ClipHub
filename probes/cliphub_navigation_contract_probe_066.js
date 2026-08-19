/* ClipHub Navigation Contract v2 device probe 066. Rhino ES5 only.
 * Fixes Probe065's control_ack empty-file race by waiting for non-empty,
 * parseable JSON before consuming control status acknowledgements.
 * Module set remains 20260818.12 because runtime modules are unchanged.
 */
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
    var Runnable = Packages.java.lang.Runnable;
    var System = Packages.java.lang.System;
    var Intent = Packages.android.content.Intent;
    var AndroidContext = Packages.android.content.Context;
    var ClipData = Packages.android.content.ClipData;
    var Handler = Packages.android.os.Handler;
    var Looper = Packages.android.os.Looper;
    var Toast = Packages.android.widget.Toast;
    var SimpleDateFormat = Packages.java.text.SimpleDateFormat;
    var Locale = Packages.java.util.Locale;
    var Date = Packages.java.util.Date;

    var REQUIRED_SET = "20260818.12";
    var REQUIRED_REF = "refactor/navigation-contract-v2-20260818";
    var PROBE_NAME = "cliphub_navigation_contract_probe_066";
    var WAIT_EDITOR_MS = 45000;
    var SWIPE_WINDOW_MS = 8000;
    var POLL_MS = 200;
    var JSON_RETRY_MS = 25;
    var mainHandler = new Handler(Looper.getMainLooper());

    function now() { return Number(System.currentTimeMillis()); }

    function stamp(value) {
        try {
            return String(new SimpleDateFormat("yyyyMMdd-HHmmss-SSS", Locale.US)
                .format(new Date(Number(value))));
        } catch (ignored) { return String(value); }
    }

    function close(value) {
        if (value !== null && value !== undefined) {
            try { value.close(); } catch (ignored) {}
        }
    }

    function ensureDir(file) {
        if (!file.exists() && !file.mkdirs() && !file.isDirectory()) {
            throw new Error("Cannot create directory: " +
                String(file.getAbsolutePath()));
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

    function write(file, value) {
        var writer = null;
        try {
            writer = new BW(new OSW(new FOS(file, false), "UTF-8"));
            writer.write(String(value));
            writer.flush();
        } finally { close(writer); }
    }

    function parseJsonFile(file, timeoutMs, label) {
        var deadline = now() + Math.max(0, Number(timeoutMs || 0));
        var text = "";
        var lastError = null;
        var length = 0;
        do {
            if (file.isFile()) {
                try { length = Number(file.length()); }
                catch (ignoredLength) { length = 0; }
                if (length > 0) {
                    try {
                        text = read(file).replace(/^\s+|\s+$/g, "");
                        if (text.length > 0) { return JSON.parse(text); }
                    } catch (parseError) {
                        lastError = parseError;
                    }
                }
            }
            if (now() >= deadline) { break; }
            Thread.sleep(JSON_RETRY_MS);
        } while (true);
        throw new Error(String(label || "JSON file") +
            " unavailable or incomplete: path=" +
            String(file.getAbsolutePath()) + ", length=" + String(length) +
            (lastError === null ? "" : ", lastError=" + String(lastError)));
    }

    function toast(message) {
        try {
            mainHandler.post(new JavaAdapter(Runnable, {
                run: function () {
                    try {
                        Toast.makeText(global.context,
                            String(message), Toast.LENGTH_LONG).show();
                    } catch (ignoredToast) {}
                }
            }));
        } catch (ignoredPost) {}
    }

    function copyText(text) {
        var manager;
        try {
            manager = global.context.getSystemService(
                AndroidContext.CLIPBOARD_SERVICE);
            if (manager === null) { return false; }
            manager.setPrimaryClip(ClipData.newPlainText(
                "ClipHub Probe 066", String(text)));
            return true;
        } catch (ignored) { return false; }
    }

    function localManifest(runtimeDir) {
        var file = new File(new File(runtimeDir, "cache"),
            "module-manifest.local.json");
        if (!file.isFile()) { return null; }
        return parseJsonFile(file, 1000, "local module manifest");
    }

    function endpoint(runtimeDir) {
        var file = new File(new File(runtimeDir, "cache"),
            "control_endpoint.json");
        if (!file.isFile()) { return null; }
        return parseJsonFile(file, 1000, "control endpoint");
    }

    function sendStatus(runtimeDir) {
        var cacheDir = ensureDir(new File(runtimeDir, "cache"));
        var current = endpoint(runtimeDir);
        var requestId;
        var ackFile;
        var intent;
        var ack = null;
        if (current === null) {
            return { ok: false, error: "ClipHub control endpoint missing" };
        }
        requestId = "probe066-" + String(now()) + "-" +
            String(Number(Thread.currentThread().getId()));
        ackFile = new File(cacheDir,
            "control_ack_" + requestId + ".json");
        if (ackFile.exists()) { ackFile.delete(); }
        intent = new Intent(String(current.action));
        intent.putExtra("runtimeDir", String(runtimeDir.getAbsolutePath()));
        intent.putExtra("command", "status");
        intent.putExtra("requestId", requestId);
        intent.putExtra("controlToken", String(current.token));
        global.context.sendBroadcast(intent);
        try {
            ack = parseJsonFile(ackFile, 2500, "control status ack");
        } finally {
            try { if (ackFile.exists()) { ackFile.delete(); } }
            catch (ignoredDelete) {}
        }
        return ack;
    }

    function number(value) {
        value = Number(value || 0);
        return isFinite(value) ? value : 0;
    }

    function editorPage(pageId) {
        pageId = String(pageId || "");
        return pageId === "editor" || pageId === "tags" ||
            pageId === "tokenizer" || pageId === "tokenizer_rules" ||
            pageId === "tokenizer_rule_editor";
    }

    function snapshot(statusAck) {
        var status = statusAck && statusAck.status ? statusAck.status : {};
        var editor = status.editorState || {};
        var nav = status.navigationState || {};
        var shell = status.uiShell || {};
        return {
            capturedAt: now(),
            editor: {
                attached: editor.attached === true ||
                    editor.attachedToWindow === true,
                embeddedInPrimary: editor.embeddedInPrimary === true,
                mode: String(editor.mode || ""),
                itemId: editor.itemId === undefined ? null : editor.itemId,
                inputFocused: editor.inputFocused === true,
                keyboardVisible: editor.keyboardVisible === true,
                focusReleasedAfterImeHide:
                    editor.focusReleasedAfterImeHide === true,
                rootFocusedAfterImeHide:
                    editor.rootFocusedAfterImeHide === true,
                focusReleaseCount: number(editor.focusReleaseCount),
                keyboardHideCount: number(editor.keyboardHideCount),
                lastError: editor.lastError === undefined ? null : editor.lastError
            },
            navigation: {
                backMode: String(nav.backMode || ""),
                callbackMode: String(nav.callbackMode || ""),
                predictiveBackEnabled: nav.predictiveBackEnabled === true,
                predictiveBackCapabilitySource:
                    String(nav.predictiveBackCapabilitySource || ""),
                predictiveBackContextPackage:
                    String(nav.predictiveBackContextPackage || ""),
                keyBackCount: number(nav.keyBackCount),
                backStartedCount: number(nav.backStartedCount),
                backProgressCount: number(nav.backProgressCount),
                backCancelledCount: number(nav.backCancelledCount),
                backInvokedCount: number(nav.backInvokedCount),
                backHandledCount: number(nav.backHandledCount),
                systemBackGestureCount: number(nav.systemBackGestureCount),
                systemBackCommitCount: number(nav.systemBackCommitCount),
                backRefreshCount: number(nav.backRefreshCount),
                legacyBackRefreshCount: number(nav.legacyBackRefreshCount),
                lastBackReason: String(nav.lastBackReason || ""),
                lastBackPageId: String(nav.lastBackPageId || ""),
                lastError: nav.lastError === undefined ? null : nav.lastError
            },
            shell: {
                childAttached: shell.childAttached === true,
                activePageId: shell.activePageId === undefined ? null :
                    shell.activePageId,
                currentPageId: shell.currentPageId === undefined ? null :
                    shell.currentPageId,
                pageStack: shell.pageStack || [],
                stackDepth: number(shell.stackDepth),
                canPop: shell.canPop === true,
                pageRegistryOwner: String(shell.pageRegistryOwner || ""),
                pageContractOwner: String(shell.pageContractOwner || ""),
                pageStackOwner: String(shell.pageStackOwner || ""),
                navigationManagerOwner:
                    String(shell.navigationManagerOwner || ""),
                navigationApiVersion: number(shell.navigationApiVersion),
                backDispatcherOwner: String(shell.backDispatcherOwner || ""),
                backDispatcherApiVersion:
                    number(shell.backDispatcherApiVersion),
                predictiveBackActive: shell.predictiveBackActive === true,
                predictiveBackStartCount:
                    number(shell.predictiveBackStartCount),
                predictiveBackCancelCount:
                    number(shell.predictiveBackCancelCount),
                predictiveBackCommitCount:
                    number(shell.predictiveBackCommitCount),
                predictiveBackSnapshotMismatchCount:
                    number(shell.predictiveBackSnapshotMismatchCount),
                backDispatchCount: number(shell.backDispatchCount),
                backDispatcherCount: number(shell.backDispatcherCount),
                imeBackConsumeCount: number(shell.imeBackConsumeCount),
                navigatorBackPopCount: number(shell.navigatorBackPopCount),
                duplicateBackRequestCount:
                    number(shell.duplicateBackRequestCount),
                lastBackSourceFamily:
                    String(shell.lastBackSourceFamily || ""),
                lastBackOutcome: String(shell.lastBackOutcome || ""),
                lastBackFromPageId:
                    String(shell.lastBackFromPageId || ""),
                lastBackToPageId:
                    String(shell.lastBackToPageId || "")
            }
        };
    }

    function statusSnapshot(runtimeDir) {
        var ack = sendStatus(runtimeDir);
        if (!ack || ack.ok !== true || !ack.status) { return null; }
        return snapshot(ack);
    }

    function architectureReady(current) {
        return current !== null &&
            current.shell.pageRegistryOwner === "ClipHub.PageRegistry" &&
            current.shell.pageContractOwner === "ClipHub.PageRegistry" &&
            current.shell.pageStackOwner === "ClipHub.PageStack" &&
            current.shell.navigationManagerOwner === "ClipHub.Navigator" &&
            current.shell.navigationApiVersion >= 2 &&
            current.shell.backDispatcherOwner === "ClipHub.BackDispatcher" &&
            current.shell.backDispatcherApiVersion >= 2;
    }

    function diff(after, before) {
        return {
            keyBackCount: after.navigation.keyBackCount -
                before.navigation.keyBackCount,
            backStartedCount: after.navigation.backStartedCount -
                before.navigation.backStartedCount,
            backInvokedCount: after.navigation.backInvokedCount -
                before.navigation.backInvokedCount,
            backHandledCount: after.navigation.backHandledCount -
                before.navigation.backHandledCount,
            shellBackDispatchCount: after.shell.backDispatchCount -
                before.shell.backDispatchCount,
            backDispatcherCount: after.shell.backDispatcherCount -
                before.shell.backDispatcherCount,
            predictiveBackStartCount: after.shell.predictiveBackStartCount -
                before.shell.predictiveBackStartCount,
            predictiveBackCancelCount: after.shell.predictiveBackCancelCount -
                before.shell.predictiveBackCancelCount,
            predictiveBackCommitCount: after.shell.predictiveBackCommitCount -
                before.shell.predictiveBackCommitCount,
            predictiveBackSnapshotMismatchCount:
                after.shell.predictiveBackSnapshotMismatchCount -
                before.shell.predictiveBackSnapshotMismatchCount,
            imeBackConsumeCount: after.shell.imeBackConsumeCount -
                before.shell.imeBackConsumeCount,
            navigatorBackPopCount: after.shell.navigatorBackPopCount -
                before.shell.navigatorBackPopCount,
            legacyBackRefreshCount:
                after.navigation.legacyBackRefreshCount -
                before.navigation.legacyBackRefreshCount,
            focusReleaseCount: after.editor.focusReleaseCount -
                before.editor.focusReleaseCount,
            keyboardHideCount: after.editor.keyboardHideCount -
                before.editor.keyboardHideCount
        };
    }

    function navigationActivity(change) {
        return change.keyBackCount > 0 || change.backStartedCount > 0 ||
            change.backInvokedCount > 0 ||
            change.shellBackDispatchCount > 0 ||
            change.backDispatcherCount > 0;
    }

    function imeConsumed(change, before, after) {
        if (!after.editor.attached) { return false; }
        if (change.imeBackConsumeCount > 0 && change.navigatorBackPopCount === 0) {
            return true;
        }
        if (navigationActivity(change)) { return false; }
        return change.focusReleaseCount > 0 ||
            change.keyboardHideCount > 0 ||
            (before.editor.inputFocused && !after.editor.inputFocused);
    }

    function returnedToHome(after) {
        return after.editor.attached !== true &&
            after.shell.currentPageId === "home" &&
            after.shell.stackDepth === 1 &&
            after.shell.pageStack && after.shell.pageStack.length === 1 &&
            String(after.shell.pageStack[0]) === "home";
    }

    function classify(before, after, change) {
        if (!architectureReady(after)) {
            return "NAVIGATION_CONTRACT_V2_OWNER_MISMATCH";
        }
        if (returnedToHome(after)) {
            if (change.keyBackCount > 0 && change.backDispatcherCount > 0 &&
                    change.shellBackDispatchCount > 0) {
                return "LEGACY_BACK_SUCCEEDED_V2";
            }
            if (change.backInvokedCount > 0 && change.backDispatcherCount > 0 &&
                    change.shellBackDispatchCount > 0) {
                return "NAVIGATION_CONTRACT_V2_BACK_SUCCEEDED";
            }
            return "EDITOR_CLOSED_WITHOUT_COMPLETE_NAVIGATION_CHAIN";
        }
        if (change.keyBackCount > 0 && change.backDispatcherCount === 0) {
            return "BACK_REACHED_NAVIGATION_NOT_BACKDISPATCHER";
        }
        if (change.backDispatcherCount > 0 && after.editor.attached) {
            return "BACKDISPATCHER_RECEIVED_EDITOR_REMAINED";
        }
        if (!navigationActivity(change)) {
            return "BACK_NOT_DELIVERED_EDITOR_STILL_OPEN";
        }
        return "BACK_PATH_CHANGED_REVIEW_SNAPSHOTS";
    }

    function finish(runtimeDir, probeDir, result) {
        var output = new File(probeDir,
            PROBE_NAME + "_" + stamp(now()) + ".json");
        var full;
        write(output, JSON.stringify(result, null, 2) + "\n");
        result.outputPath = String(output.getAbsolutePath());
        full = JSON.stringify(result);
        result.copiedToClipboard = copyText(full);
        toast(result.copiedToClipboard ?
            "Probe 066 完成，结果已复制到剪贴板" :
            "Probe 066 完成，请读取 probes 输出文件");
        return result;
    }

    function waitForEditor(runtimeDir) {
        var deadline = now() + WAIT_EDITOR_MS;
        var current = null;
        while (now() < deadline) {
            current = statusSnapshot(runtimeDir);
            if (current !== null && current.editor.attached === true &&
                    current.editor.embeddedInPrimary === true &&
                    editorPage(current.shell.activePageId)) {
                Thread.sleep(350);
                return statusSnapshot(runtimeDir) || current;
            }
            Thread.sleep(POLL_MS);
        }
        return null;
    }

    function waitSwipe(runtimeDir, baseline) {
        var deadline = now() + SWIPE_WINDOW_MS;
        var current = baseline;
        var change = diff(current, baseline);
        while (now() < deadline) {
            current = statusSnapshot(runtimeDir) || current;
            change = diff(current, baseline);
            if (!current.editor.attached || navigationActivity(change) ||
                    imeConsumed(change, baseline, current)) {
                break;
            }
            Thread.sleep(POLL_MS);
        }
        return { after: current, change: change };
    }

    function monitor() {
        var root = String(shortx.getShortXDir());
        var runtimeDir = new File(root, "ClipHub");
        var probeDir = ensureDir(new File(runtimeDir, "probes"));
        var manifest = localManifest(runtimeDir);
        var baseline;
        var first;
        var second;
        var result;

        if (manifest === null) {
            throw new Error("Installed local module manifest missing");
        }
        if (String(manifest.moduleSetVersion || "") !== REQUIRED_SET) {
            throw new Error("Probe 066 requires module set " + REQUIRED_SET +
                ", current=" + String(manifest.moduleSetVersion || ""));
        }
        if (String(manifest.sourceRef || "") !== REQUIRED_REF) {
            throw new Error("Probe 066 requires sourceRef " + REQUIRED_REF +
                ", current=" + String(manifest.sourceRef || ""));
        }

        toast("Probe 066 已启动，请在 45 秒内打开 ClipHub 编辑页");
        baseline = waitForEditor(runtimeDir);
        if (baseline === null) {
            result = {
                ok: false,
                probe: PROBE_NAME,
                probeVersion: 1,
                phase: "editor_open_timeout",
                classification: "EDITOR_NOT_OPENED_IN_TIME",
                moduleSetVersion: REQUIRED_SET,
                sourceRef: REQUIRED_REF,
                finishedAt: now()
            };
            finish(runtimeDir, probeDir, result);
            return;
        }

        if (!architectureReady(baseline)) {
            result = {
                ok: false,
                probe: PROBE_NAME,
                probeVersion: 1,
                phase: "architecture_owner_mismatch",
                classification: "NAVIGATION_CONTRACT_V2_OWNER_MISMATCH",
                moduleSetVersion: REQUIRED_SET,
                sourceRef: REQUIRED_REF,
                baseline: baseline,
                finishedAt: now()
            };
            finish(runtimeDir, probeDir, result);
            return;
        }

        toast("Navigation Contract v2 已捕获：现在侧滑返回一次");
        first = waitSwipe(runtimeDir, baseline);
        if (imeConsumed(first.change, baseline, first.after)) {
            toast("第一次 Back 已由 IME 层消费：请再侧滑一次返回页面");
            baseline = first.after;
            second = waitSwipe(runtimeDir, baseline);
            result = {
                ok: true,
                probe: PROBE_NAME,
                probeVersion: 1,
                phase: "comparison_complete_after_ime",
                classification: classify(baseline,
                    second.after, second.change),
                moduleSetVersion: REQUIRED_SET,
                sourceRef: REQUIRED_REF,
                firstSwipe: {
                    classification: "FIRST_BACK_CONSUMED_BY_IME",
                    delta: first.change,
                    after: first.after
                },
                delta: second.change,
                before: baseline,
                after: second.after,
                finishedAt: now()
            };
            finish(runtimeDir, probeDir, result);
            return;
        }

        result = {
            ok: true,
            probe: PROBE_NAME,
            probeVersion: 1,
            phase: "comparison_complete",
            classification: classify(baseline, first.after, first.change),
            moduleSetVersion: REQUIRED_SET,
            sourceRef: REQUIRED_REF,
            delta: first.change,
            before: baseline,
            after: first.after,
            finishedAt: now()
        };
        finish(runtimeDir, probeDir, result);
    }

    global.ClipHubNavigationContractProbe066Result = {
        ok: true,
        probe: PROBE_NAME,
        probeVersion: 1,
        phase: "monitor_started",
        instruction: "只运行一次：45 秒内进入编辑页，按 Toast 提示侧滑；结果自动复制到剪贴板。"
    };

    try {
        new Thread(new JavaAdapter(Runnable, {
            run: function () {
                try {
                    monitor();
                } catch (error) {
                    var root;
                    var runtimeDir;
                    var probeDir;
                    var result;
                    try {
                        root = String(shortx.getShortXDir());
                        runtimeDir = new File(root, "ClipHub");
                        probeDir = ensureDir(new File(runtimeDir, "probes"));
                        result = {
                            ok: false,
                            probe: PROBE_NAME,
                            probeVersion: 1,
                            phase: "fatal",
                            error: String(error),
                            finishedAt: now()
                        };
                        finish(runtimeDir, probeDir, result);
                    } catch (ignoredFatal) {}
                }
            }
        }), "ClipHub-Probe-066").start();
    } catch (startError) {
        global.ClipHubNavigationContractProbe066Result = {
            ok: false,
            probe: PROBE_NAME,
            probeVersion: 1,
            phase: "start_failed",
            error: String(startError)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubNavigationContractProbe066Result);
