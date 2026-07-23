#!/usr/bin/env python3
"""Apply the ClipHub Settings top clipping fix. Fails closed on source drift."""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SETTINGS = ROOT / "src/ch_13_settings.js"
MANIFEST = ROOT / "module-manifest.json"
EXPECTED_BRANCH = "agent/initialize-project-skeleton"
OLD_SETTINGS_SHA = "5b0cf6a88f819b7defb3aa2ad7ff9e3fe86a4114"
OLD_SET = "20260723.05"
NEW_SET = "20260723.06"


def die(message: str) -> None:
    raise SystemExit(message)


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def blob_sha(text: str) -> str:
    data = text.encode("utf-8")
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        die(f"{label}: expected exactly one marker, found {count}")
    return text.replace(old, new, 1)


def assert_clean_targets() -> None:
    branch = git("branch", "--show-current")
    if branch != EXPECTED_BRANCH:
        die(f"Wrong branch: {branch}; expected {EXPECTED_BRANCH}")
    changed = git("status", "--porcelain", "--", str(SETTINGS.relative_to(ROOT)), str(MANIFEST.relative_to(ROOT)))
    if changed:
        die("Target files already have local changes:\n" + changed)


def patch_settings(text: str) -> tuple[str, bool]:
    if 'MODULE_VERSION: 8' in text and 'function postScrollToSection(name)' in text:
        return text, False
    if 'MODULE_VERSION: 7' not in text:
        die("Settings module version is neither v7 nor the expected v8")
    if blob_sha(text) != OLD_SETTINGS_SHA:
        die(f"Unexpected Settings v7 blob SHA: {blob_sha(text)}")

    text = replace_once(
        text,
        '        panelWidthDp: 0,\n        panelHeightDp: 0,\n        lastTestResult: "",',
        '        panelWidthDp: 0,\n        panelHeightDp: 0,\n'
        '        panelClipToOutline: false,\n'
        '        scrollResetCount: 0,\n'
        '        sectionScrollRequestCount: 0,\n'
        '        sectionScrollAppliedCount: 0,\n'
        '        sectionScrollCancelCount: 0,\n'
        '        currentScrollYDp: 0,\n'
        '        lastScrollSection: null,\n'
        '        lastSectionViewportTopDp: null,\n'
        '        lastTestResult: "",',
        "uiState scroll metrics",
    )

    old_rebuild = '''    function rebuildTagPage() {
        buildPage();
        if (mainHandler !== null) {
            mainHandler.post(new Packages.java.lang.Runnable({
                run: function () { scrollToSection("tags"); }
            }));
        }
        return true;
    }
'''
    new_rebuild = '''    function rebuildTagPage() {
        buildPage();
        postScrollToSection("tags");
        return true;
    }
'''
    text = replace_once(text, old_rebuild, new_rebuild, "rebuildTagPage")

    old_add = '''        scrollRoot.removeAllViews();
        scrollRoot.addView(content, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT));
        uiState.renderCount += 1;
'''
    new_add = '''        scrollRoot.removeAllViews();
        scrollRoot.addView(content, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT));
        scrollRoot.scrollTo(0, 0);
        uiState.scrollResetCount += 1;
        uiState.currentScrollYDp = 0;
        uiState.lastScrollSection = null;
        uiState.lastSectionViewportTopDp = null;
        uiState.renderCount += 1;
'''
    text = replace_once(text, old_add, new_add, "buildPage scroll reset")

    old_root = '''            panelRoot = new FrameLayout(appContext);
            panelRoot.setBackground(roundedBackground(palette().surface,
                palette().stroke, 24));
            if (Build.VERSION.SDK_INT >= 21) { panelRoot.setElevation(dp(20)); }
            scrollRoot = new ScrollView(appContext);
'''
    new_root = '''            panelRoot = new FrameLayout(appContext);
            panelRoot.setBackground(roundedBackground(palette().surface,
                palette().stroke, 24));
            if (Build.VERSION.SDK_INT >= 21) {
                panelRoot.setElevation(dp(20));
                panelRoot.setClipToOutline(true);
            }
            uiState.panelClipToOutline = Build.VERSION.SDK_INT >= 21 &&
                panelRoot.getClipToOutline();
            scrollRoot = new ScrollView(appContext);
'''
    text = replace_once(text, old_root, new_root, "panel clip outline")

    old_scroll = '''    function scrollToSection(name) {
        var target = null;
        name = String(name || "");
        if (name === "translation") { target = translationSectionView; }
        if (name === "tags") { target = tagsSectionView; }
        if (name === "data") { target = dataSectionView; }
        if (scrollRoot === null || target === null) { return false; }
        return runOnMainSync(function () {
            var y = Math.max(0, Number(target.getTop()) - dp(8));
            scrollRoot.scrollTo(0, y);
            return true;
        }, 3000);
    }
'''
    new_scroll = '''    function sectionView(name) {
        name = String(name || "");
        if (name === "translation") { return translationSectionView; }
        if (name === "tags") { return tagsSectionView; }
        if (name === "data") { return dataSectionView; }
        return null;
    }

    function applySectionScroll(name, expectedRoot) {
        var target = sectionView(name);
        var y;
        if (!uiState.attached || scrollRoot === null ||
                expectedRoot !== scrollRoot || target === null) {
            uiState.sectionScrollCancelCount += 1;
            return false;
        }
        y = Math.max(0, Number(target.getTop()) - dp(8));
        expectedRoot.scrollTo(0, y);
        uiState.sectionScrollAppliedCount += 1;
        uiState.currentScrollYDp = Math.round(
            Number(expectedRoot.getScrollY()) / density);
        uiState.lastScrollSection = String(name);
        uiState.lastSectionViewportTopDp = Math.round(
            (Number(target.getTop()) - Number(expectedRoot.getScrollY())) /
                density);
        return true;
    }

    function postScrollToSection(name) {
        var expectedRoot = scrollRoot;
        var first;
        if (expectedRoot === null || !uiState.attached) { return false; }
        uiState.sectionScrollRequestCount += 1;
        first = new Packages.java.lang.Runnable({
            run: function () {
                if (!uiState.attached || expectedRoot !== scrollRoot) {
                    uiState.sectionScrollCancelCount += 1;
                    return;
                }
                expectedRoot.post(new Packages.java.lang.Runnable({
                    run: function () {
                        applySectionScroll(name, expectedRoot);
                    }
                }));
            }
        });
        return expectedRoot.post(first);
    }

    function scrollToSection(name) {
        name = String(name || "");
        return runOnMainSync(function () {
            return applySectionScroll(name, scrollRoot);
        }, 3000);
    }
'''
    text = replace_once(text, old_scroll, new_scroll, "section scroll implementation")

    old_state = '''            panelWidthDp: Number(uiState.panelWidthDp),
            panelHeightDp: Number(uiState.panelHeightDp),
            lastTestResult: uiState.lastTestResult,
'''
    new_state = '''            panelWidthDp: Number(uiState.panelWidthDp),
            panelHeightDp: Number(uiState.panelHeightDp),
            panelClipToOutline: uiState.panelClipToOutline === true,
            scrollResetCount: Number(uiState.scrollResetCount),
            sectionScrollRequestCount:
                Number(uiState.sectionScrollRequestCount),
            sectionScrollAppliedCount:
                Number(uiState.sectionScrollAppliedCount),
            sectionScrollCancelCount:
                Number(uiState.sectionScrollCancelCount),
            currentScrollYDp: Number(uiState.currentScrollYDp),
            lastScrollSection: uiState.lastScrollSection,
            lastSectionViewportTopDp:
                uiState.lastSectionViewportTopDp === null ? null :
                    Number(uiState.lastSectionViewportTopDp),
            lastTestResult: uiState.lastTestResult,
'''
    text = replace_once(text, old_state, new_state, "getState scroll metrics")
    text = replace_once(text, '        MODULE_VERSION: 7,', '        MODULE_VERSION: 8,', "Settings module version")

    if text.count("mainHandler.post(new Packages.java.lang.Runnable") != 0:
        die("Unexpected direct mainHandler.post remains in Settings")
    return text, True


def patch_manifest(settings_text: str) -> tuple[str, bool]:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    current_set = str(manifest.get("moduleSetVersion", ""))
    if current_set not in {OLD_SET, NEW_SET}:
        die(f"Unexpected moduleSetVersion: {current_set}")
    found = False
    new_sha = blob_sha(settings_text)
    changed = current_set != NEW_SET
    manifest["moduleSetVersion"] = NEW_SET
    for module in manifest.get("modules", []):
        if module.get("name") == "ch_13_settings.js":
            found = True
            if module.get("sha") != new_sha:
                module["sha"] = new_sha
                changed = True
            break
    if not found:
        die("Settings module entry missing from manifest")
    return json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", changed


def main() -> None:
    assert_clean_targets()
    settings_text = SETTINGS.read_text(encoding="utf-8")
    settings_text, settings_changed = patch_settings(settings_text)
    manifest_text, manifest_changed = patch_manifest(settings_text)
    SETTINGS.write_text(settings_text, encoding="utf-8")
    MANIFEST.write_text(manifest_text, encoding="utf-8")

    print("Settings module:", "changed" if settings_changed else "already v8")
    print("Settings blob SHA:", blob_sha(settings_text))
    print("moduleSetVersion:", NEW_SET)
    print("panel clip marker:", settings_text.count("setClipToOutline(true)"))
    print("postScrollToSection marker:", settings_text.count("function postScrollToSection(name)"))
    print("Updated targets" if settings_changed or manifest_changed else "No target changes required")


if __name__ == "__main__":
    main()
