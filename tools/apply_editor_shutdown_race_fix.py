#!/usr/bin/env python3
"""Apply the ClipHub Editor v11 shutdown-race fix.

This tool intentionally patches only src/ch_10_editor.js and
module-manifest.json. It is idempotent and fails closed when any expected
v10 marker has changed.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
EDITOR_PATH = ROOT / "src" / "ch_10_editor.js"
MANIFEST_PATH = ROOT / "module-manifest.json"
OLD_EDITOR_SHA = "8d20f92286290bc10e773e1c9388ba943dd1c4cc"
OLD_MODULE_SET = "20260723.04"
NEW_MODULE_SET = "20260723.05"


def git_blob_sha(text: str) -> str:
    data = text.encode("utf-8")
    header = b"blob " + str(len(data)).encode("ascii") + b"\0"
    return hashlib.sha1(header + data).hexdigest()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one marker, found {count}")
    return text.replace(old, new, 1)


def patch_editor(text: str) -> str:
    if "MODULE_VERSION: 11" in text:
        required = [
            "function postEditorDelayed",
            "delayedCallbackErrorCount",
            "postShutdownCallbackAttemptCount",
            "ready = false;\n            stopEditorImePolling();",
        ]
        missing = [marker for marker in required if marker not in text]
        if missing:
            raise RuntimeError(
                "Editor claims v11 but lifecycle markers are missing: "
                + ", ".join(missing)
            )
        return text

    if "MODULE_VERSION: 10" not in text:
        raise RuntimeError("Expected Editor v10 baseline")

    text = replace_once(
        text,
        "        lastError: null\n    };",
        "        delayedCallbackPostCount: 0,\n"
        "        delayedCallbackRunCount: 0,\n"
        "        delayedCallbackCancelCount: 0,\n"
        "        delayedCallbackErrorCount: 0,\n"
        "        pendingDelayedCallbackCount: 0,\n"
        "        postShutdownCallbackAttemptCount: 0,\n"
        "        lastDelayedCallbackError: null,\n"
        "        lastError: null\n    };",
        "state delayed callback counters",
    )

    text = replace_once(
        text,
        """    function runOnMainSync(callback, timeoutMs) {
        var mainLooper = Looper.getMainLooper();""",
        """    function runOnMainSync(callback, timeoutMs) {
        var mainLooper = Looper.getMainLooper();
        if (mainHandler === null) {
            return { ok: false,
                error: new Error("Editor main handler unavailable") };
        }""",
        "runOnMainSync handler guard",
    )

    text = replace_once(
        text,
        """    function pxToDp(value) {
        return Math.round(Number(value) / density);
    }

    function isDarkMode() {""",
        """    function pxToDp(value) {
        return Math.round(Number(value) / density);
    }

    function postEditorDelayed(callback, delayMs, requireAttached) {
        var generation = imePollGeneration;
        var handler = mainHandler;
        var runnable;
        var posted;
        if (handler === null || !ready || typeof callback !== "function") {
            return false;
        }
        state.delayedCallbackPostCount += 1;
        state.pendingDelayedCallbackCount += 1;
        runnable = new Packages.java.lang.Runnable({
            run: function () {
                state.pendingDelayedCallbackCount = Math.max(0,
                    Number(state.pendingDelayedCallbackCount) - 1);
                if (generation !== imePollGeneration || !ready ||
                        appContext === null || windowManager === null ||
                        (requireAttached === true &&
                            (!state.attached || panelRoot === null))) {
                    state.delayedCallbackCancelCount += 1;
                    if (!ready) {
                        state.postShutdownCallbackAttemptCount += 1;
                    }
                    return;
                }
                try {
                    callback();
                    state.delayedCallbackRunCount += 1;
                } catch (error) {
                    state.delayedCallbackErrorCount += 1;
                    state.lastDelayedCallbackError = String(error);
                    state.lastError = String(error);
                }
            }
        });
        try { posted = handler.postDelayed(runnable, Number(delayMs || 0)); }
        catch (postError) {
            posted = false;
            state.lastDelayedCallbackError = String(postError);
        }
        if (!posted) {
            state.pendingDelayedCallbackCount = Math.max(0,
                Number(state.pendingDelayedCallbackCount) - 1);
            state.delayedCallbackErrorCount += 1;
            return false;
        }
        return true;
    }

    function isDarkMode() {""",
        "guarded delayed callback helper",
    )

    text = replace_once(
        text,
        """    function pollEditorIme(generation) {
        var ime;
        if (generation !== imePollGeneration || !state.attached ||
                panelRoot === null || state.mode === "tags") {""",
        """    function pollEditorIme(generation) {
        var ime;
        if (generation !== imePollGeneration || !ready ||
                appContext === null || windowManager === null ||
                !state.attached || panelRoot === null ||
                state.mode === "tags") {""",
        "IME polling lifecycle guard",
    )

    text = replace_once(
        text,
        """                    onGlobalLayout: function () {
                        var ime = readImeState();
                        applyEditorImeLayout(ime);
                        measureEditorLayout(ime);
                    }""",
        """                    onGlobalLayout: function () {
                        var ime;
                        if (!ready || !state.attached || panelRoot === null ||
                                appContext === null || windowManager === null) {
                            return;
                        }
                        try {
                            ime = readImeState();
                            applyEditorImeLayout(ime);
                            measureEditorLayout(ime);
                        } catch (error) {
                            state.delayedCallbackErrorCount += 1;
                            state.lastDelayedCallbackError = String(error);
                            state.lastError = String(error);
                        }
                    }""",
        "layout observer lifecycle guard",
    )

    text = replace_once(
        text,
        """            startEditorImePolling();
            mainHandler.postDelayed(new Packages.java.lang.Runnable({
                run: function () {
                    var ime = readImeState();
                    applyEditorImeLayout(ime);
                    measureEditorLayout(ime);
                }
            }), 180);""",
        """            startEditorImePolling();
            postEditorDelayed(function () {
                var ime = readImeState();
                applyEditorImeLayout(ime);
                measureEditorLayout(ime);
            }, 180, true);""",
        "initial IME delayed measurement",
    )

    text = replace_once(
        text,
        """        mainHandler.postDelayed(new Packages.java.lang.Runnable({
            run: function () { measureEditorLayout(); }
        }), 120);""",
        """        postEditorDelayed(function () {
            measureEditorLayout();
        }, 120, true);""",
        "scroll delayed measurement",
    )

    text = replace_once(
        text,
        """        mainHandler.postDelayed(new Packages.java.lang.Runnable({
            run: function () {
                try {
                    if (target !== null && inputMethodManager !== null) {
                        inputMethodManager.showSoftInput(
                            target, InputMethodManager.SHOW_IMPLICIT);
                        state.inputFocused = target.hasFocus();
                    }
                } catch (ignored) {}
            }
        }), 120);""",
        """        postEditorDelayed(function () {
            if (target !== null && inputMethodManager !== null) {
                inputMethodManager.showSoftInput(
                    target, InputMethodManager.SHOW_IMPLICIT);
                state.inputFocused = target.hasFocus();
            }
        }, 120, true);""",
        "keyboard request delayed callback",
    )

    text = replace_once(
        text,
        """            mainHandler.postDelayed(new Packages.java.lang.Runnable({
                run: function () {
                    var previous = -1;
                    var retried = false;
                    if (!state.attached || state.keyboardVisible ||
                            panelRoot === null || contentInput === null) {
                        return;
                    }
                    try {
                        previous = Number(
                            panelRoot.getDescendantFocusability());
                    } catch (ignoredPrevious) {}
                    try {
                        panelRoot.setFocusable(true);
                        panelRoot.setFocusableInTouchMode(true);
                        panelRoot.setDescendantFocusability(
                            ViewGroup.FOCUS_BLOCK_DESCENDANTS);
                        contentInput.clearFocus();
                        retried = panelRoot.requestFocus();
                        state.focusReleasedAfterImeHide =
                            !contentInput.hasFocus();
                        state.rootFocusRequestedAfterImeHide =
                            state.rootFocusRequestedAfterImeHide || retried;
                        state.rootFocusedAfterImeHide =
                            panelRoot.isFocused();
                    } catch (retryError) {
                        state.lastError = String(retryError);
                    } finally {
                        if (previous >= 0 && panelRoot !== null) {
                            try {
                                panelRoot.setDescendantFocusability(previous);
                            } catch (ignoredRestore) {}
                        }
                    }
                }
            }), 80);""",
        """            postEditorDelayed(function () {
                var previous = -1;
                var retried = false;
                if (!state.attached || state.keyboardVisible ||
                        panelRoot === null || contentInput === null) {
                    return;
                }
                try {
                    previous = Number(panelRoot.getDescendantFocusability());
                } catch (ignoredPrevious) {}
                try {
                    panelRoot.setFocusable(true);
                    panelRoot.setFocusableInTouchMode(true);
                    panelRoot.setDescendantFocusability(
                        ViewGroup.FOCUS_BLOCK_DESCENDANTS);
                    contentInput.clearFocus();
                    retried = panelRoot.requestFocus();
                    state.focusReleasedAfterImeHide = !contentInput.hasFocus();
                    state.rootFocusRequestedAfterImeHide =
                        state.rootFocusRequestedAfterImeHide || retried;
                    state.rootFocusedAfterImeHide = panelRoot.isFocused();
                } finally {
                    if (previous >= 0 && panelRoot !== null) {
                        try { panelRoot.setDescendantFocusability(previous); }
                        catch (ignoredRestore) {}
                    }
                }
            }, 80, true);""",
        "focus handoff retry",
    )

    text = replace_once(
        text,
        """    function displayMetrics() {
        var metrics = new DisplayMetrics();
        try {
            windowManager.getDefaultDisplay().getRealMetrics(metrics);
        } catch (ignored) {
            metrics = appContext.getResources().getDisplayMetrics();
        }
        return metrics;
    }""",
        """    function displayMetrics() {
        var metrics = new DisplayMetrics();
        if (windowManager !== null) {
            try {
                windowManager.getDefaultDisplay().getRealMetrics(metrics);
                if (Number(metrics.widthPixels) > 0 &&
                        Number(metrics.heightPixels) > 0) {
                    return metrics;
                }
            } catch (ignoredWindow) {}
        }
        if (appContext !== null) {
            try { return appContext.getResources().getDisplayMetrics(); }
            catch (ignoredContext) {}
        }
        return metrics;
    }""",
        "display metrics null guard",
    )

    text = replace_once(
        text,
        """                hideKeyboardOnMain();
                mainHandler.postDelayed(new Packages.java.lang.Runnable({
                    run: function () { measureEditorLayout(); }
                }), 160);""",
        """                hideKeyboardOnMain();
                postEditorDelayed(function () {
                    measureEditorLayout();
                }, 160, true);""",
        "hide keyboard delayed measurement",
    )

    text = replace_once(
        text,
        """            imePollCount: Number(state.imePollCount),
            normalPanelHeightDp: Number(state.normalPanelHeightDp),""",
        """            imePollCount: Number(state.imePollCount),
            delayedCallbackPostCount:
                Number(state.delayedCallbackPostCount),
            delayedCallbackRunCount:
                Number(state.delayedCallbackRunCount),
            delayedCallbackCancelCount:
                Number(state.delayedCallbackCancelCount),
            delayedCallbackErrorCount:
                Number(state.delayedCallbackErrorCount),
            pendingDelayedCallbackCount:
                Number(state.pendingDelayedCallbackCount),
            postShutdownCallbackAttemptCount:
                Number(state.postShutdownCallbackAttemptCount),
            lastDelayedCallbackError: state.lastDelayedCallbackError,
            normalPanelHeightDp: Number(state.normalPanelHeightDp),""",
        "getState delayed callback counters",
    )

    text = replace_once(
        text,
        """            windowLayoutUpdateCount: 0, imePollCount: 0,
            normalPanelHeightDp: 0, currentPanelHeightDp: 0,""",
        """            windowLayoutUpdateCount: 0, imePollCount: 0,
            delayedCallbackPostCount: 0, delayedCallbackRunCount: 0,
            delayedCallbackCancelCount: 0, delayedCallbackErrorCount: 0,
            pendingDelayedCallbackCount: 0,
            postShutdownCallbackAttemptCount: 0,
            lastDelayedCallbackError: null,
            normalPanelHeightDp: 0, currentPanelHeightDp: 0,""",
        "reset delayed callback counters",
    )

    text = replace_once(
        text,
        "        MODULE_VERSION: 10,",
        "        MODULE_VERSION: 11,",
        "Editor module version",
    )

    text = replace_once(
        text,
        """        shutdown: function () {
            try { closePanel("shutdown"); } catch (ignoredClose) {}
            clearViews();
            ready = false;""",
        """        shutdown: function () {
            ready = false;
            stopEditorImePolling();
            try { closePanel("shutdown"); } catch (ignoredClose) {}
            clearViews();""",
        "shutdown invalidation order",
    )

    remaining = text.count("mainHandler.postDelayed")
    if remaining != 1:
        raise RuntimeError(
            "Expected only the generation-bound IME polling postDelayed to "
            f"remain, found {remaining}"
        )

    return text


def update_manifest(manifest: dict, editor_text: str) -> dict:
    current_set = str(manifest.get("moduleSetVersion", ""))
    if current_set not in (OLD_MODULE_SET, NEW_MODULE_SET):
        raise RuntimeError(f"Unexpected moduleSetVersion: {current_set}")

    found = False
    new_sha = git_blob_sha(editor_text)
    for item in manifest.get("modules", []):
        if item.get("name") != "ch_10_editor.js":
            continue
        found = True
        current_sha = str(item.get("sha", ""))
        if current_set == OLD_MODULE_SET and current_sha != OLD_EDITOR_SHA:
            raise RuntimeError(f"Unexpected Editor v10 blob SHA: {current_sha}")
        item["sha"] = new_sha

    if not found:
        raise RuntimeError("Editor manifest entry missing")

    manifest["moduleSetVersion"] = NEW_MODULE_SET
    return manifest


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--check",
        action="store_true",
        help="validate markers and print the resulting diff status without writing",
    )
    args = parser.parse_args()

    original_editor = EDITOR_PATH.read_text(encoding="utf-8")
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    patched_editor = patch_editor(original_editor)
    patched_manifest = update_manifest(manifest, patched_editor)
    manifest_text = json.dumps(
        patched_manifest, ensure_ascii=False, indent=2
    ) + "\n"

    changed = (
        patched_editor != original_editor
        or manifest_text != MANIFEST_PATH.read_text(encoding="utf-8")
    )

    print(f"Editor module: {'changed' if patched_editor != original_editor else 'already v11'}")
    print(f"Editor blob SHA: {git_blob_sha(patched_editor)}")
    print(f"moduleSetVersion: {patched_manifest['moduleSetVersion']}")
    print(f"direct mainHandler.postDelayed count: {patched_editor.count('mainHandler.postDelayed')}")

    if args.check:
        return 0

    if changed:
        EDITOR_PATH.write_text(patched_editor, encoding="utf-8")
        MANIFEST_PATH.write_text(manifest_text, encoding="utf-8")
        print("Updated src/ch_10_editor.js and module-manifest.json")
    else:
        print("No changes required")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"ERROR: {error}", file=sys.stderr)
        raise SystemExit(1)
