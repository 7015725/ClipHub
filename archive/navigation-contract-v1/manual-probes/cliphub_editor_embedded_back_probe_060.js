/* ClipHub embedded Editor system Back probe 060. Rhino ES5 only.
 * Run twice:
 * 1) Before reproducing the failed side-swipe: saves baseline.
 * 2) After reproducing once: computes Back/UIShell/Editor deltas.
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
    var System = Packages.java.lang.System;
    var Intent = Packages.android.content.Intent;
    var SimpleDateFormat = Packages.java.text.SimpleDateFormat;
    var Locale = Packages.java.util.Locale;
    var Date = Packages.java.util.Date;

    var REQUIRED_SET = "20260818.01";
    var PROBE_NAME = "cliphub_editor_embedded_back_probe_060";

    function now() { return Number(System.currentTimeMillis()); }

    function stamp(value) {
        try {
            return String(new SimpleDateFormat("yyyyMMdd-HHmmss-SSS", Locale.US)
                .format(new Date(Number(value))));
        } catch (ignored) {
            return String(value);
        }
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
        } finally {
            close(reader);
        }
    }

    function write(file, value) {
        var writer = null;
        try {
            writer = new BW(new OSW(new FOS(file, false), "UTF-8"));
            writer.write(String(value));
            writer.flush();
        } finally {
            close(writer);
        }
    }

    function waitFor(callback, timeoutMs) {
        var started = now();
        while (now() - started < Number(timeoutMs || 0)) {
            if (callback()) { return true; }
            Thread.sleep(25);
        }
        return callback();
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
        requestId = "probe060-" + String(now()) + "-" +
            String(Number(Thread.currentThread().getId()));
        ackFile = new File(cacheDir, "control_ack_" + requestId + ".json");
        if (ackFile.exists()) { ackFile.delete(); }
        intent = new Intent(String(current.action));
        intent.putExtra("runtimeDir", String(runtimeDir.getAbsolutePath()));
        intent.putExtra("command", "status");
        intent.putExtra("requestId", requestId);
        intent.putExtra("controlToken", String(current.token));
        global.context.sendBroadcast(intent);
        waitFor(function () { return ackFile.isFile(); }, 3000);
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

    function navSnapshot(nav) {
        nav = nav || {};
        return {
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
        };
    }

    function editorSnapshot(editor) {
        editor = editor || {};
        return {
            attached: editor.attached === true || editor.attachedToWindow === true,
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
        };
    }

    function shellSnapshot(shell) {
        shell = shell || {};
        return {
            childAttached: shell.childAttached === true,
            activePageId: shell.activePageId === undefined ? null :
                shell.activePageId,
            currentPageId: shell.currentPageId === undefined ? null :
                shell.currentPageId,
            stackDepth: number(shell.stackDepth),
            pageStack: shell.pageStack || [],
            generation: number(shell.generation),
            backDispatchCount: number(shell.backDispatchCount),
            duplicateBackRequestCount: number(shell.duplicateBackRequestCount),
            backCascadeGuardCount: number(shell.backCascadeGuardCount),
            lastBackRequestId: String(shell.lastBackRequestId || ""),
            lastBackFromPageId: String(shell.lastBackFromPageId || ""),
            lastBackToPageId: String(shell.lastBackToPageId || "")
        };
    }

    function snapshot(statusAck) {
        var status = statusAck && statusAck.status ? statusAck.status : {};
        return {
            capturedAt: now(),
            editor: editorSnapshot(status.editorState),
            navigation: navSnapshot(status.navigationState),
            shell: shellSnapshot(status.uiShell),
            runtimeDiagnostics: status.runtimeDiagnostics || null
        };
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

    function classify(before, after, change) {
        var nav = change.navigation;
        if (!after.editor.attached &&
                after.shell.activePageId !== "editor") {
            return "BACK_SUCCEEDED_EDITOR_CLOSED";
        }
        if (nav.backStartedCount === 0 && nav.backInvokedCount === 0 &&
                change.shellBackDispatchCount === 0) {
            return "SYSTEM_BACK_CALLBACK_NOT_ENTERED";
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

    function main() {
        var root = String(shortx.getShortXDir());
        var formal = new File(root, "ClipHub");
        var cacheDir = ensureDir(new File(formal, "cache"));
        var probeDir = ensureDir(new File(formal, "probes"));
        var baselineFile = new File(cacheDir,
            "cliphub_editor_embedded_back_probe_060_baseline.json");
        var manifest = localManifest(formal);
        var ack;
        var current;
        var baseline;
        var change;
        var result;
        var output;

        if (manifest === null) {
            throw new Error("Installed local module manifest missing");
        }
        if (String(manifest.moduleSetVersion || "") !== REQUIRED_SET) {
            throw new Error("Probe 060 requires module set " + REQUIRED_SET +
                ", current=" + String(manifest.moduleSetVersion || ""));
        }

        ack = sendStatus(formal);
        if (!ack || ack.ok !== true || !ack.status) {
            throw new Error(ack && ack.error ? String(ack.error) :
                "Unable to obtain ClipHub status");
        }
        current = snapshot(ack);

        if (!baselineFile.isFile()) {
            write(baselineFile, JSON.stringify(current, null, 2) + "\n");
            result = {
                ok: true,
                probe: PROBE_NAME,
                probeVersion: 1,
                phase: "baseline_saved",
                instruction: "现在进入首页编辑页，复现一次侧滑返回失败，然后再次运行 Probe 060",
                moduleSetVersion: String(manifest.moduleSetVersion || ""),
                sourceRef: String(manifest.sourceRef || ""),
                baselinePath: String(baselineFile.getAbsolutePath()),
                baseline: current
            };
            return result;
        }

        baseline = JSON.parse(read(baselineFile));
        change = delta(current, baseline);
        result = {
            ok: true,
            probe: PROBE_NAME,
            probeVersion: 1,
            phase: "comparison_complete",
            moduleSetVersion: String(manifest.moduleSetVersion || ""),
            sourceRef: String(manifest.sourceRef || ""),
            classification: classify(baseline, current, change),
            delta: change,
            before: baseline,
            after: current
        };
        try { baselineFile.delete(); } catch (ignoredBaselineDelete) {}
        output = new File(probeDir, PROBE_NAME + "_" + stamp(now()) + ".json");
        write(output, JSON.stringify(result, null, 2) + "\n");
        result.outputPath = String(output.getAbsolutePath());
        return result;
    }

    try {
        global.ClipHubEditorEmbeddedBackProbe060Result = main();
    } catch (error) {
        global.ClipHubEditorEmbeddedBackProbe060Result = {
            ok: false,
            probe: PROBE_NAME,
            probeVersion: 1,
            error: String(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubEditorEmbeddedBackProbe060Result);
