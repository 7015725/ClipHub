#!/usr/bin/env python3
from pathlib import Path
import json
import subprocess

EDITOR_PATH = Path("src/ch_10_editor.js")
MANIFEST_PATH = Path("module-manifest.json")
OLD_MODULE_SET = "20260724.27"
NEW_MODULE_SET = "20260724.28"
OLD_MODULE_VERSION = "        MODULE_VERSION: 15,"
NEW_MODULE_VERSION = "        MODULE_VERSION: 16,"

text = EDITOR_PATH.read_text(encoding="utf-8")

if "var imeRestoreGeometry = null;" in text:
    raise SystemExit("editor reversible IME fix already applied")

var_site = "    var imePollGeneration = 0;\n"
if text.count(var_site) != 1:
    raise SystemExit("IME restore variable insertion site mismatch")
text = text.replace(
    var_site,
    var_site + "    var imeRestoreGeometry = null;\n",
    1,
)

state_site = (
    "        keyboardAvoidanceApplyCount: 0,\n"
    "        keyboardAvoidanceRestoreCount: 0,\n"
    "        windowLayoutUpdateCount: 0,\n"
)
state_replacement = (
    "        keyboardAvoidanceApplyCount: 0,\n"
    "        keyboardAvoidanceRestoreCount: 0,\n"
    "        imeRestoreSnapshotPresent: false,\n"
    "        imeRestoreSnapshotCount: 0,\n"
    "        imeRestoreApplyCount: 0,\n"
    "        windowLayoutUpdateCount: 0,\n"
)
if text.count(state_site) != 1:
    raise SystemExit("IME diagnostic state insertion site mismatch")
text = text.replace(state_site, state_replacement, 1)

start_marker = "    function applyEditorImeLayout(ime) {\n"
end_marker = "    function handoffEditorFocusAfterImeHide() {\n"
start = text.find(start_marker)
end = text.find(end_marker, start)
if start < 0 or end < 0 or end <= start:
    raise SystemExit("IME layout function boundaries not found")
old_block = text[start:end]
if "ClipHub.Window.refreshWindow(panelWindowRoot" not in old_block:
    raise SystemExit("expected irreversible Window.refreshWindow path missing")

new_block = r'''    function clearEditorImeRestoreGeometry() {
        imeRestoreGeometry = null;
        state.imeRestoreSnapshotPresent = false;
        return true;
    }

    function captureEditorImeRestoreGeometry() {
        if (imeRestoreGeometry !== null || panelParams === null) {
            return false;
        }
        imeRestoreGeometry = {
            width: Number(panelParams.width),
            height: Number(panelParams.height),
            gravity: Number(panelParams.gravity),
            x: Number(panelParams.x || 0),
            y: Number(panelParams.y || 0)
        };
        state.imeRestoreSnapshotPresent = true;
        state.imeRestoreSnapshotCount += 1;
        state.normalPanelHeightDp = pxToDp(imeRestoreGeometry.height);
        return true;
    }

    function restoreEditorImeGeometry(reason) {
        var snapshot = imeRestoreGeometry;
        var targetRoot;
        var changed = false;
        var wasApplied = state.keyboardAvoidanceApplied === true;
        if (snapshot === null || panelParams === null) {
            state.keyboardAvoidanceApplied = false;
            state.imeRestoreSnapshotPresent = false;
            return false;
        }
        if (Number(panelParams.width) !== Number(snapshot.width)) {
            panelParams.width = Number(snapshot.width);
            changed = true;
        }
        if (Number(panelParams.height) !== Number(snapshot.height)) {
            panelParams.height = Number(snapshot.height);
            changed = true;
        }
        if (Number(panelParams.gravity) !== Number(snapshot.gravity)) {
            panelParams.gravity = Number(snapshot.gravity);
            changed = true;
        }
        if (Number(panelParams.x || 0) !== Number(snapshot.x)) {
            panelParams.x = Number(snapshot.x);
            changed = true;
        }
        if (Number(panelParams.y || 0) !== Number(snapshot.y)) {
            panelParams.y = Number(snapshot.y);
            changed = true;
        }
        targetRoot = panelWindowRoot !== null ? panelWindowRoot : panelRoot;
        if (changed && state.attached && targetRoot !== null &&
                targetRoot.isAttachedToWindow()) {
            windowManager.updateViewLayout(targetRoot, panelParams);
            state.windowLayoutUpdateCount += 1;
        }
        state.keyboardAvoidanceApplied = false;
        if (wasApplied) { state.keyboardAvoidanceRestoreCount += 1; }
        state.imeRestoreApplyCount += 1;
        state.panelGravity = "shared";
        state.panelBottomMarginDp = 0;
        state.currentPanelHeightDp = pxToDp(Number(snapshot.height));
        state.currentPanelTopDp = pxToDp(Number(snapshot.y));
        clearEditorImeRestoreGeometry();
        return changed || wasApplied || String(reason || "").length > 0;
    }

    function applyEditorImeLayout(ime) {
        var metrics;
        var normalHeightPx;
        var targetHeightPx;
        var targetTopPx;
        var targetGravity;
        var targetY;
        var keyboardTopPx;
        var topSafePx;
        var availablePx;
        var changed = false;
        var wasApplied;
        var targetRoot;
        if (panelRoot === null || panelParams === null) {
            return false;
        }
        if (state.mode === "tags") {
            return imeRestoreGeometry !== null ?
                restoreEditorImeGeometry("editor_tags_mode") : false;
        }
        if (!ime.visible || Number(ime.bottomPx) < dp(120)) {
            if (imeRestoreGeometry !== null ||
                    state.keyboardAvoidanceApplied === true) {
                return restoreEditorImeGeometry("editor_ime_hidden");
            }
            state.keyboardAvoidanceApplied = false;
            state.panelGravity = "shared";
            state.panelBottomMarginDp = 0;
            return false;
        }
        captureEditorImeRestoreGeometry();
        metrics = displayMetrics();
        normalHeightPx = imeRestoreGeometry !== null ?
            Number(imeRestoreGeometry.height) :
            dp(Math.max(300,
                Number(state.normalPanelHeightDp || state.panelHeightDp || 590)));
        wasApplied = state.keyboardAvoidanceApplied === true;
        keyboardTopPx = Math.max(0,
            Number(metrics.heightPixels) - Number(ime.bottomPx));
        topSafePx = Math.max(dp(6), Number(ime.topInsetPx));
        availablePx = Math.max(dp(280),
            keyboardTopPx - topSafePx - dp(6));
        targetHeightPx = Math.min(normalHeightPx, availablePx);
        targetTopPx = Math.max(topSafePx,
            keyboardTopPx - dp(6) - targetHeightPx);
        targetGravity = Gravity.TOP | Gravity.START;
        targetY = targetTopPx;
        state.availableAboveImeDp = pxToDp(availablePx);
        state.keyboardAvoidanceApplied = true;
        if (!wasApplied) { state.keyboardAvoidanceApplyCount += 1; }
        state.panelGravity = "ime_top";
        state.panelBottomMarginDp = 6;
        if (Number(panelParams.height) !== Number(targetHeightPx)) {
            panelParams.height = targetHeightPx;
            changed = true;
        }
        if (Number(panelParams.gravity) !== Number(targetGravity)) {
            panelParams.gravity = targetGravity;
            changed = true;
        }
        if (Number(panelParams.y) !== Number(targetY)) {
            panelParams.y = targetY;
            changed = true;
        }
        state.currentPanelHeightDp = pxToDp(targetHeightPx);
        state.currentPanelTopDp = pxToDp(targetTopPx);
        targetRoot = panelWindowRoot !== null ? panelWindowRoot : panelRoot;
        if (changed && state.attached && targetRoot !== null &&
                targetRoot.isAttachedToWindow()) {
            windowManager.updateViewLayout(targetRoot, panelParams);
            state.windowLayoutUpdateCount += 1;
        }
        return changed;
    }

'''
text = text[:start] + new_block + text[end:]

clear_views_site = "    function clearViews() {\n        stopEditorImePolling();\n"
clear_views_replacement = (
    "    function clearViews() {\n"
    "        stopEditorImePolling();\n"
    "        clearEditorImeRestoreGeometry();\n"
)
if text.count(clear_views_site) != 1:
    raise SystemExit("clearViews insertion site mismatch")
text = text.replace(clear_views_site, clear_views_replacement, 1)

open_site = (
    "        state.focusReleasedAfterImeHide = false;\n"
    "        state.rootFocusRequestedAfterImeHide = false;\n"
    "        state.rootFocusedAfterImeHide = false;\n"
    "        return requireMain(runOnMainSync(function () {\n"
)
open_replacement = (
    "        state.focusReleasedAfterImeHide = false;\n"
    "        state.rootFocusRequestedAfterImeHide = false;\n"
    "        state.rootFocusedAfterImeHide = false;\n"
    "        clearEditorImeRestoreGeometry();\n"
    "        return requireMain(runOnMainSync(function () {\n"
)
if text.count(open_site) != 1:
    raise SystemExit("openPanel restore reset insertion site mismatch")
text = text.replace(open_site, open_replacement, 1)

get_state_site = (
    "            keyboardAvoidanceRestoreCount:\n"
    "                Number(state.keyboardAvoidanceRestoreCount),\n"
    "            windowLayoutUpdateCount:\n"
)
get_state_replacement = (
    "            keyboardAvoidanceRestoreCount:\n"
    "                Number(state.keyboardAvoidanceRestoreCount),\n"
    "            imeRestoreSnapshotPresent:\n"
    "                state.imeRestoreSnapshotPresent === true,\n"
    "            imeRestoreSnapshotCount:\n"
    "                Number(state.imeRestoreSnapshotCount),\n"
    "            imeRestoreApplyCount:\n"
    "                Number(state.imeRestoreApplyCount),\n"
    "            windowLayoutUpdateCount:\n"
)
if text.count(get_state_site) != 1:
    raise SystemExit("getState IME diagnostics insertion site mismatch")
text = text.replace(get_state_site, get_state_replacement, 1)

reset_site = (
    "            keyboardAvoidanceApplyCount: 0,\n"
    "            keyboardAvoidanceRestoreCount: 0,\n"
    "            windowLayoutUpdateCount: 0, imePollCount: 0,\n"
)
reset_replacement = (
    "            keyboardAvoidanceApplyCount: 0,\n"
    "            keyboardAvoidanceRestoreCount: 0,\n"
    "            imeRestoreSnapshotPresent: false,\n"
    "            imeRestoreSnapshotCount: 0, imeRestoreApplyCount: 0,\n"
    "            windowLayoutUpdateCount: 0, imePollCount: 0,\n"
)
if text.count(reset_site) != 1:
    raise SystemExit("resetState IME diagnostics insertion site mismatch")
text = text.replace(reset_site, reset_replacement, 1)

if text.count(OLD_MODULE_VERSION) != 1:
    raise SystemExit("editor module version site mismatch")
text = text.replace(OLD_MODULE_VERSION, NEW_MODULE_VERSION, 1)

required = [
    "var imeRestoreGeometry = null;",
    "function captureEditorImeRestoreGeometry()",
    "function restoreEditorImeGeometry(reason)",
    "restoreEditorImeGeometry(\"editor_ime_hidden\")",
    "imeRestoreSnapshotPresent",
    "MODULE_VERSION: 16",
]
for token in required:
    if token not in text:
        raise SystemExit("missing patched contract: " + token)
if "ClipHub.Window.refreshWindow(panelWindowRoot,\n                \"editor_ime_restore\")" in text:
    raise SystemExit("irreversible editor restore path still present")

EDITOR_PATH.write_text(text, encoding="utf-8")

manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
if manifest.get("moduleSetVersion") != OLD_MODULE_SET:
    raise SystemExit("module set version mismatch")
manifest["moduleSetVersion"] = NEW_MODULE_SET
blob = subprocess.check_output(
    ["git", "hash-object", str(EDITOR_PATH)], text=True
).strip()
updated = False
for item in manifest.get("modules", []):
    if item.get("path") == str(EDITOR_PATH):
        item["sha"] = blob
        updated = True
        break
if not updated:
    raise SystemExit("editor manifest entry missing")
MANIFEST_PATH.write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8",
)
print(json.dumps({
    "ok": True,
    "moduleSetVersion": NEW_MODULE_SET,
    "editorBlob": blob,
}, ensure_ascii=False))
