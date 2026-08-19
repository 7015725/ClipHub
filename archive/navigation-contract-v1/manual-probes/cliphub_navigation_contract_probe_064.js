/* ClipHub Navigation Contract v1 device probe 064. Rhino ES5 only.
 * One-shot workflow for module set 20260818.02.
 * Run once, open ClipHub -> Editor, then follow Toast side-swipe prompts.
 * Result is written to ClipHub/probes and copied to clipboard.
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

    var REQUIRED_SET = "20260818.02";
    var PROBE_NAME = "cliphub_navigation_contract_probe_064";
    var WAIT_EDITOR_MS = 45000;
    var SWIPE_WINDOW_MS = 8000;
    var POLL_MS = 200;
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
                "ClipHub Probe 064", String(text)));
            return true;
        } catch (ignored) { return false; }
    }

    function localManifest(runtimeDir) {
        var file = new File(new File(runtimeDir, "cache"),
            "module-manifest.local.json");
        if (!file.isFile()) { return null; }
        return JSON.parse(read(file));
    }

    function endpoint(runtimeDir) {
        var file = new File(new File(runtimeDir, "cache"),
            "control_endpoint.json");
        if (!file.isFile()) { return null; }
        return JSON.parse(read(file));
    }

    function waitForFile(file, timeoutMs) {
        var started = now();
        while (now() - started < Number(timeoutMs || 0)) {
            if (file.isFile()) { return true; }
            Thread.sleep(25);
        }
        return file.isFile();
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
        requestId = "probe064-" + String(now()) + "-" +
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
        waitForFile(ackFile, 2500);
        if (ackFile.isFile()) {
            try { ack = JSON.parse(read(ackFile)); }
            finally {
                try { ackFile.delete(); } catch (ignoredDelete) {}
            }
        }
        return ack === null ?
            { ok: false, error: "Control status acknowledgement not received" } :
            ack;
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
                lastError: editor.lastError === undefined ?
                    null : editor.lastError
            },
            navigation: {
                backMode: String(nav.backMode || ""),
                callbackMode: String(nav.callbackMode || ""),
                predictiveBackEnabled:
                    nav.predictiveBackEnabled === true,
                predictiveBackCapabilitySource:
                    String(nav.predictiveBackCapabilitySource || ""),
                predictiveBackContextPackage:
                    String(nav.predictiveBackContextPackage || ""),
                keyBackCount: number(nav.keyBackCount),
                backStartedCount: number(nav.backStartedCount),
                backProgressCount: number(nav.backProgressCount),
                backInvokedCount: number(nav.backInvokedCount),
                backHandledCount: number(nav.backHandledCount),
                systemBackGestureCount:
                    number(nav.systemBackGestureCount),
                systemBackCommitCount:
                    number(nav.systemBackCommitCount),
                backRefreshCount: number(nav.backRefreshCount),
                legacyBackRefreshCount:
                    number(nav.legacyBackRefreshCount),
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
                backDispatchCount: number(shell.backDispatchCount),
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
            change.shellBackDispatchCount > 0;
    }

    function imeConsumed(change, before, after) {
        if (!after.editor.attached || navigationActivity(change)) {
            return false;
        }
        return change.focusReleaseCount > 0 ||
            change.keyboardHideCount > 0 ||
            (before.editor.inputFocused && !after.editor.inputFocused);
    }

    function classify(before, after, change) {
        if (change.backStartedCount > 0 &&
                before.navigation.predictiveBackEnabled !== true) {
            return "UNEXPECTED_PREDICTIVE_BACK_PATH";
        }
        if (!after.editor.attached) {
            if (change.keyBackCount > 0 &&
                    change.shellBackDispatchCount > 0) {
                return "LEGACY_BACK_SUCCEEDED";
            }
            if (change.backInvokedCount > 0 &&
                    change.shellBackDispatchCount > 0) {
                return "BACK_SUCCEEDED_VIA_NAVIGATION";
            }
            return "EDITOR_CLOSED_WITHOUT_NAVIGATION";
        }
        if (change.keyBackCount > 0 &&
                change.shellBackDispatchCount === 0) {
            return "LEGACY_KEY_REACHED_NAVIGATION_NOT_UISHELL";
        }
        if (change.shellBackDispatchCount > 0 && after.editor.attached) {
            return "UISHELL_DISPATCHED_EDITOR_REMAINED";
        }
        if (change.keyBackCount === 0 &&
                change.backInvokedCount === 0 &&
                change.shellBackDispatchCount === 0) {
            return "LEGACY_KEY_NOT_DELIVERED_EDITOR_STILL_OPEN";
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
            "Probe 064 完成，结果已复制到剪贴板" :
            "Probe 064 完成，请读取 probes 输出文件");
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
            throw new Error("Probe 064 requires module set " + REQUIRED_SET +
                ", current=" + String(manifest.moduleSetVersion || ""));
        }

        toast("Probe 064 已启动，请在 45 秒内打开 ClipHub 编辑页");
        baseline = waitForEditor(runtimeDir);
        if (baseline === null) {
            result = {
                ok: false,
                probe: PROBE_NAME,
                probeVersion: 1,
                phase: "editor_open_timeout",
                classification: "EDITOR_NOT_OPENED_IN_TIME",
                moduleSetVersion: REQUIRED_SET,
                finishedAt: now()
            };
            finish(runtimeDir, probeDir, result);
            return;
        }

        if (baseline.navigation.backMode !== "legacy_key" ||
                baseline.navigation.predictiveBackEnabled === true) {
            result = {
                ok: false,
                probe: PROBE_NAME,
                probeVersion: 1,
                phase: "unexpected_back_mode",
                classification: "EXPECTED_LEGACY_KEY_MODE",
                moduleSetVersion: REQUIRED_SET,
                baseline: baseline,
                finishedAt: now()
            };
            finish(runtimeDir, probeDir, result);
            return;
        }

        toast("编辑页已捕获：现在侧滑返回一次");
        first = waitSwipe(runtimeDir, baseline);
        if (imeConsumed(first.change, baseline, first.after)) {
            toast("第一次侧滑被输入法消费：请再侧滑一次返回页面");
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
                firstSwipe: {
                    classification: "FIRST_SWIPE_CONSUMED_BY_IME",
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
            delta: first.change,
            before: baseline,
            after: first.after,
            finishedAt: now()
        };
        finish(runtimeDir, probeDir, result);
    }

    global.ClipHubNavigationContractProbe064Result = {
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
        }), "ClipHub-Probe-064").start();
    } catch (startError) {
        global.ClipHubNavigationContractProbe064Result = {
            ok: false,
            probe: PROBE_NAME,
            probeVersion: 1,
            phase: "start_failed",
            error: String(startError)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubNavigationContractProbe064Result);
