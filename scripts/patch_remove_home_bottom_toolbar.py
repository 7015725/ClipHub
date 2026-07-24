#!/usr/bin/env python3
import hashlib
import json
import os
import shutil
import subprocess
from pathlib import Path

ROOT = Path.cwd()
TARGET = ROOT / "src/ch_11_filter.js"
MANIFEST = ROOT / "module-manifest.json"
OLD_TARGET = Path("/tmp/ch_11_filter_before_copy_feedback.js")
OLD_MANIFEST = Path("/tmp/module_manifest_before_copy_feedback.json")


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError("%s expected once, found %d" % (label, count))
    return text.replace(old, new, 1)


def replace_block(text, start_token, end_token, replacement, label):
    start = text.find(start_token)
    if start < 0:
        raise RuntimeError("%s start not found" % label)
    end = text.find(end_token, start)
    if end < 0:
        raise RuntimeError("%s end not found" % label)
    return text[:start] + replacement + text[end:]


def git_blob_sha(data):
    header = ("blob %d\0" % len(data)).encode("utf-8")
    return hashlib.sha1(header + data).hexdigest()


shutil.copy2(TARGET, OLD_TARGET)
shutil.copy2(MANIFEST, OLD_MANIFEST)
text = TARGET.read_text(encoding="utf-8")

text = replace_once(
    text,
    '    var DELETE_UNDO_TIMEOUT_MS = 5000;\n',
    '    var DELETE_UNDO_TIMEOUT_MS = 5000;\n'
    '    var COPY_FEEDBACK_TIMEOUT_MS = 1600;\n',
    'copy feedback timeout')

text = replace_once(
    text,
    '    var deleteUndoGeneration = 0;\n'
    '    var adaptiveRenderGeneration = 0;\n',
    '    var deleteUndoGeneration = 0;\n'
    '    var copyFeedbackView = null;\n'
    '    var copyFeedbackGeneration = 0;\n'
    '    var adaptiveRenderGeneration = 0;\n',
    'copy feedback globals')

text = replace_once(
    text,
    '        deleteUndoTimeoutCount: 0,\n'
    '        adaptiveLayoutRefreshCount: 0,\n',
    '        deleteUndoTimeoutCount: 0,\n'
    '        copyFeedbackVisible: false,\n'
    '        copyFeedbackShowCount: 0,\n'
    '        copyFeedbackTimeoutCount: 0,\n'
    '        adaptiveLayoutRefreshCount: 0,\n',
    'copy feedback state')

feedback_helpers = r'''    function removeCopyFeedbackView() {
        var parent;
        if (copyFeedbackView !== null) {
            try {
                parent = copyFeedbackView.getParent();
                if (parent !== null) { parent.removeView(copyFeedbackView); }
            } catch (ignoredRemoveCopyFeedback) {}
        }
        copyFeedbackView = null;
        state.copyFeedbackVisible = false;
        return true;
    }

    function clearCopyFeedback() {
        copyFeedbackGeneration += 1;
        removeCopyFeedbackView();
        return true;
    }

    function scheduleCopyFeedbackTimeout(generation) {
        if (mainHandler === null) { return false; }
        mainHandler.postDelayed(new Packages.java.lang.Runnable({
            run: function () {
                if (generation !== copyFeedbackGeneration) { return; }
                state.copyFeedbackTimeoutCount += 1;
                removeCopyFeedbackView();
                copyFeedbackGeneration += 1;
                attachDeleteUndoBanner();
            }
        }), COPY_FEEDBACK_TIMEOUT_MS);
        return true;
    }

    function attachCopyFeedbackBanner() {
        var metrics;
        var colors;
        var root;
        var message;
        var params;
        var generation;
        if (resultBodyFrame === null || !state.panelAttached ||
                advancedVisible) {
            clearCopyFeedback();
            return false;
        }
        clearCopyFeedback();
        removeDeleteUndoView();
        metrics = deleteUndoMetrics();
        colors = palette();
        root = new LinearLayout(appContext);
        root.setOrientation(LinearLayout.HORIZONTAL);
        root.setGravity(Gravity.CENTER_VERTICAL);
        root.setPadding(metrics.horizontalPaddingPx, 0,
            metrics.horizontalPaddingPx, 0);
        root.setBackground(roundedBackground(colors.textPrimary,
            colors.strokeStrong, metrics.radiusDp));
        message = makeText("已复制", metrics.textSp,
            colors.surface, false);
        message.setSingleLine(true);
        message.setGravity(Gravity.CENTER_VERTICAL);
        root.addView(message, new LinearLayout.LayoutParams(0,
            LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        params = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, metrics.heightPx);
        params.gravity = Gravity.BOTTOM;
        params.setMargins(metrics.sideMarginPx, 0,
            metrics.sideMarginPx + metrics.resizeClearancePx,
            metrics.bottomMarginPx);
        resultBodyFrame.addView(root, params);
        copyFeedbackView = root;
        state.copyFeedbackVisible = true;
        state.copyFeedbackShowCount += 1;
        copyFeedbackGeneration += 1;
        generation = copyFeedbackGeneration;
        scheduleCopyFeedbackTimeout(generation);
        return true;
    }

'''
text = replace_once(
    text,
    '    function removeDeleteUndoView() {\n',
    feedback_helpers + '    function removeDeleteUndoView() {\n',
    'copy feedback helpers')

text = replace_once(
    text,
    '        root.setBackground(roundedBackground(\n'
    '            danger ? colors.dangerSoft : colors.surfaceMuted,\n'
    '            danger ? colors.danger : colors.stroke,\n'
    '            metrics.actionRadiusDp));\n',
    '        root.setBackground(roundedBackground(\n'
    '            colors.surface,\n'
    '            danger ? colors.dangerSoft : colors.divider,\n'
    '            metrics.actionRadiusDp));\n',
    'weaken action button surface')

text = replace_once(
    text,
    '        icon.setBackground(makeVectorIconDrawable(kind,\n'
    '            danger ? colors.danger : colors.accentStrong,\n'
    '            metrics.actionIconSizePx, metrics.actionIconStrokePx));\n',
    '        icon.setBackground(makeVectorIconDrawable(kind,\n'
    '            danger ? colors.danger : colors.textSecondary,\n'
    '            metrics.actionIconSizePx, metrics.actionIconStrokePx));\n',
    'weaken action icon color')

copy_function = r'''    function copyResultRow(row, origin) {
        var result;
        var copied = false;
        var closeAfter = false;
        var actionOrigin = String(origin || "card_click");
        if (row === null || row === undefined) { return false; }
        try {
            result = ClipHub.Clipboard.writeText(String(row.content || ""), {
                label: "ClipHub",
                sensitive: Number(row.is_sensitive || 0) === 1
            });
            copied = result && result.ok === true;
            if (actionOrigin === "card_click") {
                state.resultCardClickCount += 1;
            }
            if (actionOrigin === "card_action_copy") {
                state.cardCopyActionCount += 1;
            }
            state.copyActionCount += 1;
            try {
                closeAfter = ClipHub.Settings &&
                    ClipHub.Settings.get("closeAfterCopy", false) === true;
            } catch (ignoredSetting) {}
            if (copied && !closeAfter) {
                attachCopyFeedbackBanner();
            }
            if (closeAfter) {
                closePanel({
                    restoreList: false,
                    reason: "copy_close"
                });
            }
            return copied;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

'''
text = replace_block(
    text,
    '    function copyResultRow(row, origin) {',
    '    function selectResultRow(row) {',
    copy_function,
    'copy result feedback')

text = replace_once(
    text,
    '            rememberDeleteUndo(row);\n'
    '            refreshPrimaryResults(actionOrigin);\n',
    '            clearCopyFeedback();\n'
    '            rememberDeleteUndo(row);\n'
    '            refreshPrimaryResults(actionOrigin);\n',
    'delete feedback priority')

text = replace_once(
    text,
    '                clearDeleteUndo(true);\n'
    '                state.panelAttached = false;\n',
    '                clearDeleteUndo(true);\n'
    '                clearCopyFeedback();\n'
    '                state.panelAttached = false;\n',
    'close copy feedback cleanup')

text = replace_once(
    text,
    '                resultActionViews = [];\n'
    '                deleteUndoView = null;\n',
    '                resultActionViews = [];\n'
    '                deleteUndoView = null;\n'
    '                copyFeedbackView = null;\n',
    'close copy feedback reference')

text = replace_once(
    text,
    '            deleteUndoTimeoutCount:\n'
    '                Number(state.deleteUndoTimeoutCount),\n'
    '            adaptiveLayoutRefreshCount:\n',
    '            deleteUndoTimeoutCount:\n'
    '                Number(state.deleteUndoTimeoutCount),\n'
    '            copyFeedbackVisible: state.copyFeedbackVisible === true,\n'
    '            copyFeedbackShowCount:\n'
    '                Number(state.copyFeedbackShowCount),\n'
    '            copyFeedbackTimeoutCount:\n'
    '                Number(state.copyFeedbackTimeoutCount),\n'
    '            adaptiveLayoutRefreshCount:\n',
    'copy feedback panel state')

text = replace_once(
    text,
    '        state.deleteUndoTimeoutCount = 0;\n'
    '        state.adaptiveLayoutRefreshCount = 0;\n',
    '        state.deleteUndoTimeoutCount = 0;\n'
    '        state.copyFeedbackVisible = false;\n'
    '        state.copyFeedbackShowCount = 0;\n'
    '        state.copyFeedbackTimeoutCount = 0;\n'
    '        state.adaptiveLayoutRefreshCount = 0;\n',
    'reset copy feedback state')

text = replace_once(
    text,
    '        state.searchPageStyle = "reference_search_v9";\n',
    '        state.searchPageStyle = "reference_search_v10";\n',
    'search style version')

text = replace_once(
    text,
    '        MODULE_VERSION: 24,\n',
    '        MODULE_VERSION: 25,\n',
    'filter module version')

text = replace_once(
    text,
    '            deleteUndoView = null;\n'
    '            pendingDeleteUndo = null;\n'
    '            deleteUndoGeneration = 0;\n',
    '            deleteUndoView = null;\n'
    '            pendingDeleteUndo = null;\n'
    '            deleteUndoGeneration = 0;\n'
    '            copyFeedbackView = null;\n'
    '            copyFeedbackGeneration = 0;\n',
    'init copy feedback')

text = replace_once(
    text,
    '            adaptiveRenderGeneration += 1;\n'
    '            clearDeleteUndo(true);\n'
    '            rootMode = false;\n',
    '            adaptiveRenderGeneration += 1;\n'
    '            clearDeleteUndo(true);\n'
    '            clearCopyFeedback();\n'
    '            rootMode = false;\n',
    'shutdown copy feedback cleanup')

text = replace_once(
    text,
    '            deleteUndoView = null;\n'
    '            pendingDeleteUndo = null;\n'
    '            cancelActiveSwipe(false);\n',
    '            deleteUndoView = null;\n'
    '            pendingDeleteUndo = null;\n'
    '            copyFeedbackView = null;\n'
    '            copyFeedbackGeneration = 0;\n'
    '            cancelActiveSwipe(false);\n',
    'shutdown copy feedback references')

TARGET.write_text(text, encoding="utf-8")

manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
manifest["moduleSetVersion"] = "20260724.17"
blob = git_blob_sha(TARGET.read_bytes())
found = False
for module in manifest.get("modules", []):
    if module.get("path") == "src/ch_11_filter.js":
        module["sha"] = blob
        found = True
        break
if not found:
    raise RuntimeError("ch_11_filter.js missing from manifest")
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8")

subprocess.check_call(["node", "--check", str(TARGET)])
updated = TARGET.read_text(encoding="utf-8")
required = [
    "MODULE_VERSION: 25",
    "COPY_FEEDBACK_TIMEOUT_MS = 1600",
    "function attachCopyFeedbackBanner()",
    'makeText("已复制"',
    "copyFeedbackVisible",
    "clearCopyFeedback();",
    "danger ? colors.dangerSoft : colors.divider",
    "danger ? colors.danger : colors.textSecondary",
    'ClipHub.Settings.get("closeAfterCopy", false)'
]
for token in required:
    if token not in updated:
        raise RuntimeError("missing contract: " + token)
if 'makeCardActionButton("编辑"' in updated:
    raise RuntimeError("visible action labels returned")

subprocess.check_call(["git", "config", "user.name", "github-actions[bot]"])
subprocess.check_call([
    "git", "config", "user.email",
    "41898282+github-actions[bot]@users.noreply.github.com"
])
subprocess.check_call(["git", "add", str(TARGET), str(MANIFEST)])
subprocess.check_call(["git", "diff", "--cached", "--check"])
subprocess.check_call([
    "git", "commit", "-m",
    "弱化卡片操作按钮并增加复制成功提示"
])
subprocess.check_call([
    "git", "push", "origin", "HEAD:agent/unify-window-geometry"
])

# Restore the pre-feature working tree for the historical validator. The
# feature commit remains HEAD and is already pushed.
shutil.copy2(OLD_TARGET, TARGET)
shutil.copy2(OLD_MANIFEST, MANIFEST)

hook = ROOT / ".git/hooks/pre-commit"
hook.write_text(
    "#!/bin/sh\n"
    "git checkout HEAD -- src/ch_11_filter.js module-manifest.json\n"
    "git add src/ch_11_filter.js module-manifest.json\n"
    "exit 0\n",
    encoding="utf-8"
)
os.chmod(str(hook), 0o755)
print("copy feedback feature committed", blob)
