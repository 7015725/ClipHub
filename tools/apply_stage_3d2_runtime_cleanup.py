#!/usr/bin/env python3
"""Apply the bounded stage 3D2 runtime cleanup to Editor and Settings."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EDITOR = ROOT / "src/ch_10_editor.js"
SETTINGS = ROOT / "src/ch_13_settings.js"
MANIFEST = ROOT / "module-manifest.json"


def replace_once(source: str, old: str, new: str, label: str) -> str:
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one match, found {count}")
    return source.replace(old, new, 1)


def insert_before(source: str, marker: str, block: str, label: str) -> str:
    if block.strip() in source:
        return source
    count = source.count(marker)
    if count != 1:
        raise RuntimeError(f"{label}: expected one marker, found {count}")
    return source.replace(marker, block + marker, 1)


def git_blob_sha(text: str) -> str:
    data = text.encode("utf-8")
    header = f"blob {len(data)}\0".encode("ascii")
    return hashlib.sha1(header + data).hexdigest()


def patch_editor(source: str) -> str:
    if "MODULE_VERSION: 12" in source:
        return source
    if "MODULE_VERSION: 11" not in source:
        raise RuntimeError("Editor baseline is not v11")

    source = replace_once(
        source,
        "        imePollCount: 0,\n        normalPanelHeightDp: 0,",
        "        imePollCount: 0,\n"
        "        imePollFastCount: 0,\n"
        "        imePollIdleCount: 0,\n"
        "        imePollIntervalMs: 0,\n"
        "        normalPanelHeightDp: 0,",
        "Editor initial poll state",
    )

    helper = r'''    function postEditorViewCallback(expectedView, callback,
            requireAttached) {
        var generation = imePollGeneration;
        var runnable;
        var posted;
        if (expectedView === null || typeof callback !== "function") {
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
        try { posted = expectedView.post(runnable); }
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

'''
    source = insert_before(
        source,
        "    function isDarkMode() {",
        helper,
        "Editor view callback helper",
    )

    adaptive = r'''    function nextEditorImePollDelay() {
        var target = null;
        var active = state.keyboardVisible === true;
        try {
            target = activeInput();
            active = active || (target !== null && target.hasFocus());
        } catch (ignoredFocus) {}
        if (active) {
            state.imePollFastCount += 1;
            state.imePollIntervalMs = 90;
            return 90;
        }
        state.imePollIdleCount += 1;
        state.imePollIntervalMs = 420;
        return 420;
    }

'''
    source = insert_before(
        source,
        "    function pollEditorIme(generation) {",
        adaptive,
        "Editor adaptive poll helper",
    )

    source = replace_once(
        source,
        "                if (mainHandler !== null && imePollRunnable !== null) {\n"
        "                    mainHandler.postDelayed(imePollRunnable, 90);\n"
        "                }",
        "                var delayMs;\n"
        "                var posted = false;\n"
        "                if (mainHandler !== null && imePollRunnable !== null) {\n"
        "                    delayMs = nextEditorImePollDelay();\n"
        "                    try {\n"
        "                        posted = mainHandler.postDelayed(\n"
        "                            imePollRunnable, delayMs);\n"
        "                    } catch (error) {\n"
        "                        state.delayedCallbackErrorCount += 1;\n"
        "                        state.lastDelayedCallbackError = String(error);\n"
        "                        state.lastError = String(error);\n"
        "                    }\n"
        "                    if (!posted) { imePollRunnable = null; }\n"
        "                }",
        "Editor adaptive poll scheduling",
    )

    source = replace_once(
        source,
        "        if (contentScrollView !== null) {\n"
        "            contentScrollView.post(new Packages.java.lang.Runnable({\n"
        "                run: function () {\n"
        "                    try {\n"
        "                        contentScrollView.fullScroll(View.FOCUS_DOWN);\n"
        "                        contentInput.setSelection(contentInput.getText().length());\n"
        "                        measureEditorLayout();\n"
        "                    } catch (ignored) {}\n"
        "                }\n"
        "            }));\n"
        "        }",
        "        if (contentScrollView !== null) {\n"
        "            (function (expectedScroll, expectedInput) {\n"
        "                postEditorViewCallback(expectedScroll, function () {\n"
        "                    if (expectedScroll !== contentScrollView ||\n"
        "                            expectedInput !== contentInput) {\n"
        "                        return;\n"
        "                    }\n"
        "                    expectedScroll.fullScroll(View.FOCUS_DOWN);\n"
        "                    expectedInput.setSelection(\n"
        "                        expectedInput.getText().length());\n"
        "                    measureEditorLayout();\n"
        "                }, true);\n"
        "            }(contentScrollView, contentInput));\n"
        "        }",
        "Editor direct View.post cleanup",
    )

    source = replace_once(
        source,
        "            imePollCount: Number(state.imePollCount),\n"
        "            delayedCallbackPostCount:",
        "            imePollCount: Number(state.imePollCount),\n"
        "            imePollFastCount: Number(state.imePollFastCount),\n"
        "            imePollIdleCount: Number(state.imePollIdleCount),\n"
        "            imePollIntervalMs: Number(state.imePollIntervalMs),\n"
        "            delayedCallbackPostCount:",
        "Editor getState poll metrics",
    )

    source = replace_once(
        source,
        "            windowLayoutUpdateCount: 0, imePollCount: 0,\n"
        "            delayedCallbackPostCount: 0, delayedCallbackRunCount: 0,",
        "            windowLayoutUpdateCount: 0, imePollCount: 0,\n"
        "            imePollFastCount: 0, imePollIdleCount: 0,\n"
        "            imePollIntervalMs: 0, delayedCallbackPostCount: 0,\n"
        "            delayedCallbackRunCount: 0,",
        "Editor reset poll metrics",
    )

    source = replace_once(
        source,
        '        MODULE_VERSION: 11,',
        '        MODULE_VERSION: 12,',
        "Editor module version",
    )
    return source


def patch_settings(source: str) -> str:
    if "MODULE_VERSION: 11" in source:
        return source
    if "MODULE_VERSION: 10" not in source:
        raise RuntimeError("Settings baseline is not v10")

    source = replace_once(
        source,
        "        imePollCount: 0,\n        layoutMeasureCount: 0,",
        "        imePollCount: 0,\n"
        "        imePollFastCount: 0,\n"
        "        imePollIdleCount: 0,\n"
        "        imePollIntervalMs: 0,\n"
        "        layoutMeasureCount: 0,",
        "Settings initial poll state",
    )

    helper = r'''    function postSettingsViewCallback(expectedView, callback,
            requireAttached) {
        var generation = settingsLifecycleGeneration;
        var runnable;
        var posted;
        if (expectedView === null || typeof callback !== "function") {
            return false;
        }
        uiState.delayedCallbackPostCount += 1;
        uiState.pendingDelayedCallbackCount += 1;
        runnable = new Packages.java.lang.Runnable({
            run: function () {
                uiState.pendingDelayedCallbackCount = Math.max(0,
                    Number(uiState.pendingDelayedCallbackCount) - 1);
                if (generation !== settingsLifecycleGeneration || !ready ||
                        appContext === null || windowManager === null ||
                        (requireAttached && (!uiState.attached ||
                            panelRoot === null || scrollRoot === null))) {
                    uiState.delayedCallbackCancelCount += 1;
                    return;
                }
                try {
                    uiState.delayedCallbackRunCount += 1;
                    callback();
                } catch (error) {
                    uiState.delayedCallbackErrorCount += 1;
                    uiState.lastDelayedCallbackError = String(error);
                    uiState.lastError = String(error);
                }
            }
        });
        try { posted = expectedView.post(runnable); }
        catch (error) {
            posted = false;
            uiState.delayedCallbackErrorCount += 1;
            uiState.lastDelayedCallbackError = String(error);
            uiState.lastError = String(error);
        }
        if (!posted) {
            uiState.pendingDelayedCallbackCount = Math.max(0,
                Number(uiState.pendingDelayedCallbackCount) - 1);
            uiState.delayedCallbackCancelCount += 1;
        }
        return posted === true;
    }

'''
    source = insert_before(
        source,
        "    function readSettingsImeState() {",
        helper,
        "Settings view callback helper",
    )

    adaptive = r'''    function nextSettingsImePollDelay() {
        var active = uiState.keyboardVisible === true;
        try {
            active = active || (focusedInput !== null && focusedInput.hasFocus());
        } catch (ignoredFocus) {}
        if (active) {
            uiState.imePollFastCount += 1;
            uiState.imePollIntervalMs = 90;
            return 90;
        }
        uiState.imePollIdleCount += 1;
        uiState.imePollIntervalMs = 420;
        return 420;
    }

'''
    source = insert_before(
        source,
        "    function pollSettingsIme(generation) {",
        adaptive,
        "Settings adaptive poll helper",
    )

    source = replace_once(
        source,
        "                if (mainHandler !== null && imePollRunnable !== null) {\n"
        "                    mainHandler.postDelayed(imePollRunnable, 90);\n"
        "                }",
        "                var delayMs;\n"
        "                var posted = false;\n"
        "                if (mainHandler !== null && imePollRunnable !== null) {\n"
        "                    delayMs = nextSettingsImePollDelay();\n"
        "                    try {\n"
        "                        posted = mainHandler.postDelayed(\n"
        "                            imePollRunnable, delayMs);\n"
        "                    } catch (error) {\n"
        "                        uiState.delayedCallbackErrorCount += 1;\n"
        "                        uiState.lastDelayedCallbackError = String(error);\n"
        "                        uiState.lastError = String(error);\n"
        "                    }\n"
        "                    if (!posted) { imePollRunnable = null; }\n"
        "                }",
        "Settings adaptive poll scheduling",
    )

    source = replace_once(
        source,
        "            ensureImeAnchorSpace(expectedInput, expectedRoot);\n"
        "            expectedRoot.post(new Packages.java.lang.Runnable({\n"
        "                run: function () {\n"
        "                    try {\n"
        "                        applyFocusedInputScroll(expectedInput, expectedRoot);\n"
        "                    } catch (error) {\n"
        "                        uiState.delayedCallbackErrorCount += 1;\n"
        "                        uiState.lastDelayedCallbackError = String(error);\n"
        "                        uiState.lastError = String(error);\n"
        "                    } finally {\n"
        "                        focusedVisibilityScheduled = false;\n"
        "                    }\n"
        "                }\n"
        "            }));",
        "            ensureImeAnchorSpace(expectedInput, expectedRoot);\n"
        "            postSettingsViewCallback(expectedRoot, function () {\n"
        "                try {\n"
        "                    applyFocusedInputScroll(expectedInput, expectedRoot);\n"
        "                } finally {\n"
        "                    focusedVisibilityScheduled = false;\n"
        "                }\n"
        "            }, true);",
        "Settings focused input View.post cleanup",
    )

    old_section = r'''    function postScrollToSection(name) {
        var expectedRoot = scrollRoot;
        var first;
        if (expectedRoot === null || !uiState.attached) { return false; }
        uiState.sectionScrollRequestCount += 1;
        first = new Packages.java.lang.Runnable({
            run: function () {
                if (!ensureSectionAnchorSpace(name, expectedRoot)) { return; }
                expectedRoot.post(new Packages.java.lang.Runnable({
                    run: function () {
                        applySectionScroll(name, expectedRoot);
                    }
                }));
            }
        });
        return expectedRoot.post(first);
    }
'''
    new_section = r'''    function postScrollToSection(name) {
        var expectedRoot = scrollRoot;
        if (expectedRoot === null || !uiState.attached) { return false; }
        uiState.sectionScrollRequestCount += 1;
        return postSettingsViewCallback(expectedRoot, function () {
            if (!ensureSectionAnchorSpace(name, expectedRoot)) { return; }
            postSettingsViewCallback(expectedRoot, function () {
                applySectionScroll(name, expectedRoot);
            }, true);
        }, true);
    }
'''
    source = replace_once(
        source, old_section, new_section,
        "Settings section View.post cleanup",
    )

    source = replace_once(
        source,
        "            imePollCount: Number(uiState.imePollCount),\n"
        "            layoutMeasureCount: Number(uiState.layoutMeasureCount),",
        "            imePollCount: Number(uiState.imePollCount),\n"
        "            imePollFastCount: Number(uiState.imePollFastCount),\n"
        "            imePollIdleCount: Number(uiState.imePollIdleCount),\n"
        "            imePollIntervalMs: Number(uiState.imePollIntervalMs),\n"
        "            layoutMeasureCount: Number(uiState.layoutMeasureCount),",
        "Settings getState poll metrics",
    )

    source = replace_once(
        source,
        '        MODULE_VERSION: 10,',
        '        MODULE_VERSION: 11,',
        "Settings module version",
    )
    return source


def update_manifest(editor_text: str, settings_text: str) -> dict:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    version = str(manifest.get("moduleSetVersion", ""))
    if version not in ("20260723.08", "20260723.09"):
        raise RuntimeError(f"Unexpected moduleSetVersion: {version}")
    manifest["moduleSetVersion"] = "20260723.09"
    wanted = {
        "ch_10_editor.js": git_blob_sha(editor_text),
        "ch_13_settings.js": git_blob_sha(settings_text),
    }
    found = set()
    for module in manifest.get("modules", []):
        name = str(module.get("name", ""))
        if name in wanted:
            module["sha"] = wanted[name]
            found.add(name)
    if found != set(wanted):
        raise RuntimeError(f"Manifest modules missing: {sorted(set(wanted) - found)}")
    return manifest


def main() -> int:
    editor_before = EDITOR.read_text(encoding="utf-8")
    settings_before = SETTINGS.read_text(encoding="utf-8")
    editor_after = patch_editor(editor_before)
    settings_after = patch_settings(settings_before)
    manifest = update_manifest(editor_after, settings_after)

    EDITOR.write_text(editor_after, encoding="utf-8")
    SETTINGS.write_text(settings_after, encoding="utf-8")
    MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print("Editor module:", "changed" if editor_after != editor_before else "already v12")
    print("Settings module:", "changed" if settings_after != settings_before else "already v11")
    print("Editor blob SHA:", git_blob_sha(editor_after))
    print("Settings blob SHA:", git_blob_sha(settings_after))
    print("moduleSetVersion:", manifest["moduleSetVersion"])
    print("Editor adaptive poll marker:", editor_after.count("nextEditorImePollDelay"))
    print("Settings adaptive poll marker:", settings_after.count("nextSettingsImePollDelay"))
    print("Editor view callback marker:", editor_after.count("postEditorViewCallback"))
    print("Settings view callback marker:", settings_after.count("postSettingsViewCallback"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
