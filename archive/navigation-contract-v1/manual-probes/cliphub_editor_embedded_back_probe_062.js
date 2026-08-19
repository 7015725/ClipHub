/* ClipHub embedded Editor system Back auto probe 062. Rhino ES5 only.
 * One-shot workflow:
 * 1) Run this script once while ClipHub may be hidden.
 * 2) Within 45 seconds open ClipHub -> Editor.
 * 3) Follow Toast prompts and perform the requested side-swipe(s).
 * 4) Probe automatically writes the result and copies compact JSON to clipboard.
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

    var REQUIRED_SET = "20260818.01";
    var PROBE_NAME = "cliphub_editor_embedded_back_probe_062";
    var WAIT_EDITOR_MS = 45000;
    var WAIT_IME_HIDE_MS = 15000;
    var SWIPE_WINDOW_MS = 8000;
    var POLL_MS = 250;
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
                "ClipHub Probe 062", String(text)));
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
        requestId = "probe062-" + String(now()) + "-" +
            String(Number(Thread.currentThread().getId()));
        ackFile = new File(cacheDir, "control_ack_" + requestId + ".json");
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
            finally { try { ackFile.delete(); } catch (ignoredDelete) {} }
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
        var diagnostics = status.runtimeDiagnostics || {};
        var removal = diagnostics.removal || {};
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
                rootFocusRequestedAfterImeHide:
                    editor.rootFocusRequestedAfterImeHide === true,
                rootFocusedAfterImeHide:
                    editor.rootFocusedAfterImeHide === true,
                focusReleaseCount: number(editor.focusReleaseCount),
                keyboardHideCount: number(editor.keyboardHideCount),
                pendingDelayedCallbackCount:
                    number(editor.pendingDelayedCallbackCount),
                lastError: editor.lastError === undefined ? null : editor.lastError
            },
            navigation: {
                callbackMode: String(nav.callbackMode || "none"),
                registerCount: number(nav.registerCount),
                unregisterCount: number(nav.unregisterCount),
                scanCount: number(nav.scanCount),
                backRefreshCount: number(nav.backRefreshCount),
                backRefreshFailureCount: number(nav.backRefreshFailureCount),
                keyBackCount: number(nav.keyBackCount),
                backStartedCount: number(nav.backStartedCount),
                backProgressCount: number(nav.backProgressCount),
                backCancelledCount: number(nav.backCancelledCount),
                backInvokedCount: number(nav.backInvokedCount),
                backHandledCount: number(nav.backHandledCount),
                duplicateBackCount: number(nav.duplicateBackCount),
                systemBackGestureCount: number(nav.systemBackGestureCount),
                systemBackCommitCount: number(nav.systemBackCommitCount),
                lastBackOwner: String(nav.lastBackOwner || ""),
                lastBackReason: String(nav.lastBackReason || ""),
                lastBackPageId: String(nav.lastBackPageId || ""),
                lastBackRequestId: String(nav.lastBackRequestId || ""),
                lastError: nav.lastError === undefined ? null : nav.lastError
            },
            shell: {
                childAttached: shell.childAttached === true,
                activePageId: shell.activePageId === undefined ? null :
                    shell.activePageId,
                currentPageId: shell.currentPageId === undefined ? null :
                    shell.currentPageId,
                stackDepth: number(shell.stackDepth),
                pageStack: shell.pageStack || [],
                generation: number(shell.generation),
                backDispatchCount: number(shell.backDispatchCount),
                duplicateBackRequestCount:
                    number(shell.duplicateBackRequestCount),
                backCascadeGuardCount: number(shell.backCascadeGuardCount),
                lastBackRequestId: String(shell.lastBackRequestId || ""),
                lastBackFromPageId: String(shell.lastBackFromPageId || ""),
                lastBackToPageId: String(shell.lastBackToPageId || "")
            },
            removal: {
                lastRole: removal.lastRole || null,
                lastReason: removal.lastReason || null,
                lastError: removal.lastError || null
            }
        };
    }

    function statusSnapshot(runtimeDir) {
        var ack = sendStatus(runtimeDir);
        if (!ack || ack.ok !== true || !ack.status) { return null; }
        return snapshot(ack);
    }

    function diffNumber(after, before, key) {
        return number(after[key]) - number(before[key]);
    }

    function delta(after, before) {
        var keys = [
            "registerCount", "unregisterCount", "scanCount",
            "backRefreshCount", "backRefreshFailureCount", "keyBackCount",
            "backStartedCount", "backProgressCount", "backCancelledCount",
            "backInvokedCount", "backHandledCount", "duplicateBackCount",
            "systemBackGestureCount", "systemBackCommitCount"
        ];
        var nav = {};
        var index;
        for (index = 0; index < keys.length; index += 1) {
            nav[keys[index]] = diffNumber(after.navigation,
                before.navigation, keys[index]);
        }
        return {
            navigation: nav,
            shellBackDispatchCount: diffNumber(after.shell, before.shell,
                "backDispatchCount"),
            editorFocusReleaseCount: diffNumber(after.editor, before.editor,
                "focusReleaseCount"),
            editorKeyboardHideCount: diffNumber(after.editor, before.editor,
                "keyboardHideCount")
        };
    }

    function navActivity(change) {
        var nav = change.navigation;
        return nav.backStartedCount > 0 || nav.backInvokedCount > 0 ||
            nav.systemBackGestureCount > 0 || nav.systemBackCommitCount > 0 ||
            change.shellBackDispatchCount > 0;
    }

    function classify(before, after, change) {
        var nav = change.navigation;
        if (!after.editor.attached) {
            if (nav.backInvokedCount > 0 ||
                    change.shellBackDispatchCount > 0) {
                return "BACK_SUCCEEDED_VIA_NAVIGATION";
            }
            return "EDITOR_CLOSED_WITHOUT_NAVIGATION";
        }
        if (nav.backStartedCount === 0 && nav.backInvokedCount === 0 &&
                change.shellBackDispatchCount === 0) {
            return "SYSTEM_BACK_CALLBACK_NOT_ENTERED_EDITOR_STILL_OPEN";
        }
        if (nav.backStartedCount > 0 && nav.backInvokedCount === 0) {
            return "PREDICTIVE_BACK_STARTED_BUT_NOT_INVOKED";
        }
        if (nav.backInvokedCount > 0 && change.shellBackDispatchCount === 0) {
            return "NAVIGATION_RECEIVED_BUT_UISHELL_NOT_DISPATCHED";
        }
        if (change.shellBackDispatchCount > 0 && after.editor.attached) {
            return "UISHELL_DISPATCHED_BUT_EDITOR_REMAINED";
        }
        return "BACK_PATH_CHANGED_REVIEW_SNAPSHOTS";
    }

    function finish(runtimeDir, probeDir, result) {
        var output = new File(probeDir,
            PROBE_NAME + "_" + stamp(now()) + ".json");
        var full = JSON.stringify(result, null, 2) + "\n";
        var compact = JSON.stringify(result);
        write(output, full);
        result.outputPath = String(output.getAbsolutePath());
        compact = JSON.stringify(result);
        result.copiedToClipboard = copyText(compact);
        toast(result.copiedToClipboard ?
            "Probe 062 完成，结果已复制到剪贴板" :
            "Probe 062 完成，请读取 probes 输出文件");
        return result;
    }

    function monitor() {
        var root = String(shortx.getShortXDir());
        var runtimeDir = new File(root, "ClipHub");
        var probeDir = ensureDir(new File(runtimeDir, "probes"));
        var manifest = localManifest(runtimeDir);
        var startedAt = now();
        var current = null;
        var editorOpenAt = 0;
        var baseline = null;
        var afterIme = null;
        var after = null;
        var change = null;
        var result = null;
        var deadline;

        if (manifest === null) {
            throw new Error("Installed local module manifest missing");
        }
        if (String(manifest.moduleSetVersion || "") !== REQUIRED_SET) {
            throw new Error("Probe 062 requires module set " + REQUIRED_SET +
                ", current=" + String(manifest.moduleSetVersion || ""));
        }

        toast("Probe 062 已启动，请在 45 秒内打开 ClipHub 编辑页");
        deadline = now() + WAIT_EDITOR_MS;
        while (now() < deadline) {
            current = statusSnapshot(runtimeDir);
            if (current !== null && current.editor.attached === true &&
                    current.editor.embeddedInPrimary === true &&
                    editorPage(current.shell.activePageId)) {
                baseline = current;
                editorOpenAt = now();
                break;
            }
            Thread.sleep(POLL_MS);
        }

        if (baseline === null) {
            result = {
                ok: false,
                probe: PROBE_NAME,
                probeVersion: 1,
                phase: "editor_open_timeout",
                classification: "EDITOR_NOT_OPENED_IN_TIME",
                startedAt: startedAt,
                finishedAt: now(),
                moduleSetVersion: String(manifest.moduleSetVersion || ""),
                sourceRef: String(manifest.sourceRef || "")
            };
            finish(runtimeDir, probeDir, result);
            return;
        }

        if (baseline.editor.keyboardVisible === true) {
            toast("已检测到编辑页：先侧滑一次收起键盘");
            deadline = now() + WAIT_IME_HIDE_MS;
            while (now() < deadline) {
                current = statusSnapshot(runtimeDir);
                if (current === null) {
                    Thread.sleep(POLL_MS);
                    continue;
                }
                change = delta(current, baseline);
                if (!current.editor.attached || navActivity(change)) {
                    after = current;
                    break;
                }
                if (current.editor.keyboardVisible === false) {
                    afterIme = current;
                    break;
                }
                Thread.sleep(POLL_MS);
            }
            if (after !== null) {
                change = delta(after, baseline);
                result = {
                    ok: true,
                    probe: PROBE_NAME,
                    probeVersion: 1,
                    phase: "completed_on_first_swipe",
                    classification: classify(baseline, after, change),
                    moduleSetVersion: String(manifest.moduleSetVersion || ""),
                    sourceRef: String(manifest.sourceRef || ""),
                    editorOpenAt: editorOpenAt,
                    delta: change,
                    before: baseline,
                    after: after,
                    finishedAt: now()
                };
                finish(runtimeDir, probeDir, result);
                return;
            }
            if (afterIme === null) {
                afterIme = statusSnapshot(runtimeDir);
            }
            if (afterIme === null || !afterIme.editor.attached) {
                result = {
                    ok: false,
                    probe: PROBE_NAME,
                    probeVersion: 1,
                    phase: "ime_stage_timeout",
                    classification: "IME_STAGE_ENDED_WITHOUT_VALID_EDITOR_STATE",
                    moduleSetVersion: String(manifest.moduleSetVersion || ""),
                    sourceRef: String(manifest.sourceRef || ""),
                    before: baseline,
                    after: afterIme,
                    finishedAt: now()
                };
                finish(runtimeDir, probeDir, result);
                return;
            }
            baseline = afterIme;
            toast("键盘已收起：请在 8 秒内再次侧滑返回");
        } else {
            toast("编辑页已捕获：请在 8 秒内侧滑返回");
        }

        deadline = now() + SWIPE_WINDOW_MS;
        while (now() < deadline) {
            current = statusSnapshot(runtimeDir);
            if (current !== null) {
                change = delta(current, baseline);
                if (!current.editor.attached || navActivity(change)) {
                    after = current;
                    break;
                }
                after = current;
            }
            Thread.sleep(POLL_MS);
        }
        if (after === null) { after = statusSnapshot(runtimeDir); }
        if (after === null) {
            throw new Error("Unable to obtain final ClipHub status");
        }
        change = delta(after, baseline);
        result = {
            ok: true,
            probe: PROBE_NAME,
            probeVersion: 1,
            phase: "comparison_complete",
            classification: classify(baseline, after, change),
            moduleSetVersion: String(manifest.moduleSetVersion || ""),
            sourceRef: String(manifest.sourceRef || ""),
            editorOpenAt: editorOpenAt,
            swipeWindowMs: SWIPE_WINDOW_MS,
            delta: change,
            before: baseline,
            after: after,
            finishedAt: now()
        };
        finish(runtimeDir, probeDir, result);
    }

    global.ClipHubEditorEmbeddedBackProbe062Result = {
        ok: true,
        probe: PROBE_NAME,
        probeVersion: 1,
        phase: "monitor_started",
        instruction: "只需运行一次：45 秒内进入编辑页，并按 Toast 提示侧滑。结果会自动复制到剪贴板。"
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
        }), "ClipHub-Probe-062").start();
    } catch (startError) {
        global.ClipHubEditorEmbeddedBackProbe062Result = {
            ok: false,
            probe: PROBE_NAME,
            probeVersion: 1,
            phase: "start_failed",
            error: String(startError)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubEditorEmbeddedBackProbe062Result);
