#!/usr/bin/env python3
"""Apply the Settings section-anchor space fix after probe 049 v1."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SETTINGS = ROOT / "src/ch_13_settings.js"
MANIFEST = ROOT / "module-manifest.json"
EXPECTED_BRANCH = "agent/initialize-project-skeleton"
OLD_SETTINGS_SHA = "5c6d91dd32eb12c43161d61883674afae757d42a"
OLD_SET = "20260723.06"
NEW_SET = "20260723.07"


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
        die(f"{label}: expected one marker, found {count}")
    return text.replace(old, new, 1)


def assert_clean_targets() -> None:
    branch = git("branch", "--show-current")
    if branch != EXPECTED_BRANCH:
        die(f"Wrong branch: {branch}; expected {EXPECTED_BRANCH}")
    changed = git(
        "status", "--porcelain", "--",
        str(SETTINGS.relative_to(ROOT)), str(MANIFEST.relative_to(ROOT)),
    )
    if changed:
        die("Target files already have local changes:\n" + changed)


def patch_settings(text: str) -> tuple[str, bool]:
    if 'MODULE_VERSION: 9' in text and 'function ensureSectionAnchorSpace' in text:
        return text, False
    if 'MODULE_VERSION: 8' not in text:
        die("Settings module version is neither v8 nor expected v9")
    current_sha = blob_sha(text)
    if current_sha != OLD_SETTINGS_SHA:
        die(f"Unexpected Settings v8 blob SHA: {current_sha}")

    text = replace_once(
        text,
        '    var scrollRoot = null;\n    var translationStatusView = null;',
        '    var scrollRoot = null;\n'
        '    var contentRoot = null;\n'
        '    var sectionAnchorSpacer = null;\n'
        '    var translationStatusView = null;',
        "settings view globals",
    )

    text = replace_once(
        text,
        '        lastScrollSection: null,\n'
        '        lastSectionViewportTopDp: null,\n'
        '        lastTestResult: "",',
        '        lastScrollSection: null,\n'
        '        lastSectionViewportTopDp: null,\n'
        '        sectionAnchorAdjustmentCount: 0,\n'
        '        sectionAnchorSpacerHeightDp: 0,\n'
        '        lastRequestedScrollYDp: 0,\n'
        '        lastMaxScrollYDp: 0,\n'
        '        lastTestResult: "",',
        "anchor state metrics",
    )

    text = replace_once(
        text,
        '        dataSectionView = makeDataSection(colors);\n'
        '        addSection(content, dataSectionView);\n'
        '        scrollRoot.removeAllViews();',
        '        dataSectionView = makeDataSection(colors);\n'
        '        addSection(content, dataSectionView);\n'
        '        sectionAnchorSpacer = new View(appContext);\n'
        '        content.addView(sectionAnchorSpacer, new LinearLayout.LayoutParams(\n'
        '            LinearLayout.LayoutParams.MATCH_PARENT, 0));\n'
        '        contentRoot = content;\n'
        '        scrollRoot.removeAllViews();',
        "anchor spacer insertion",
    )

    text = replace_once(
        text,
        '        uiState.lastScrollSection = null;\n'
        '        uiState.lastSectionViewportTopDp = null;\n'
        '        uiState.renderCount += 1;',
        '        uiState.lastScrollSection = null;\n'
        '        uiState.lastSectionViewportTopDp = null;\n'
        '        uiState.sectionAnchorSpacerHeightDp = 0;\n'
        '        uiState.lastRequestedScrollYDp = 0;\n'
        '        uiState.lastMaxScrollYDp = 0;\n'
        '        uiState.renderCount += 1;',
        "anchor state reset",
    )

    text = replace_once(
        text,
        '                scrollRoot = null;\n'
        '                translationStatusView = null;',
        '                scrollRoot = null;\n'
        '                contentRoot = null;\n'
        '                sectionAnchorSpacer = null;\n'
        '                translationStatusView = null;',
        "close anchor cleanup",
    )

    old_scroll = '''    function applySectionScroll(name, expectedRoot) {
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
'''

    new_scroll = '''    function ensureSectionAnchorSpace(name, expectedRoot) {
        var target = sectionView(name);
        var params;
        var currentSpacer;
        var baseContentHeight;
        var targetY;
        var viewportHeight;
        var requiredSpacer;
        if (!uiState.attached || expectedRoot === null ||
                expectedRoot !== scrollRoot || target === null ||
                contentRoot === null || sectionAnchorSpacer === null) {
            uiState.sectionScrollCancelCount += 1;
            return false;
        }
        params = sectionAnchorSpacer.getLayoutParams();
        currentSpacer = Math.max(0, Number(params.height || 0));
        baseContentHeight = Math.max(0,
            Number(contentRoot.getHeight()) - currentSpacer);
        targetY = Math.max(0, Number(target.getTop()) - dp(8));
        viewportHeight = Math.max(0, Number(expectedRoot.getHeight()));
        requiredSpacer = Math.max(0,
            Math.ceil(targetY + viewportHeight - baseContentHeight));
        uiState.lastRequestedScrollYDp = Math.round(targetY / density);
        if (Number(params.height) !== requiredSpacer) {
            params.height = requiredSpacer;
            sectionAnchorSpacer.setLayoutParams(params);
            sectionAnchorSpacer.requestLayout();
            contentRoot.requestLayout();
            uiState.sectionAnchorAdjustmentCount += 1;
        }
        uiState.sectionAnchorSpacerHeightDp = Math.round(
            requiredSpacer / density);
        return true;
    }

    function applySectionScroll(name, expectedRoot) {
        var target = sectionView(name);
        var y;
        var maxScroll;
        if (!uiState.attached || scrollRoot === null ||
                expectedRoot !== scrollRoot || target === null) {
            uiState.sectionScrollCancelCount += 1;
            return false;
        }
        y = Math.max(0, Number(target.getTop()) - dp(8));
        maxScroll = Math.max(0,
            Number(contentRoot === null ? 0 : contentRoot.getHeight()) -
                Number(expectedRoot.getHeight()));
        expectedRoot.scrollTo(0, y);
        uiState.sectionScrollAppliedCount += 1;
        uiState.currentScrollYDp = Math.round(
            Number(expectedRoot.getScrollY()) / density);
        uiState.lastMaxScrollYDp = Math.round(maxScroll / density);
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
    text = replace_once(text, old_scroll, new_scroll, "section anchor scroll logic")

    text = replace_once(
        text,
        '            lastSectionViewportTopDp:\n'
        '                uiState.lastSectionViewportTopDp === null ? null :\n'
        '                    Number(uiState.lastSectionViewportTopDp),\n'
        '            lastTestResult: uiState.lastTestResult,',
        '            lastSectionViewportTopDp:\n'
        '                uiState.lastSectionViewportTopDp === null ? null :\n'
        '                    Number(uiState.lastSectionViewportTopDp),\n'
        '            sectionAnchorAdjustmentCount:\n'
        '                Number(uiState.sectionAnchorAdjustmentCount),\n'
        '            sectionAnchorSpacerHeightDp:\n'
        '                Number(uiState.sectionAnchorSpacerHeightDp),\n'
        '            lastRequestedScrollYDp:\n'
        '                Number(uiState.lastRequestedScrollYDp),\n'
        '            lastMaxScrollYDp: Number(uiState.lastMaxScrollYDp),\n'
        '            lastTestResult: uiState.lastTestResult,',
        "getState anchor metrics",
    )

    text = replace_once(
        text,
        '        MODULE_VERSION: 8,',
        '        MODULE_VERSION: 9,',
        "Settings module version",
    )
    return text, True


def patch_manifest(settings_text: str) -> tuple[str, bool]:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    current_set = str(manifest.get("moduleSetVersion", ""))
    if current_set not in {OLD_SET, NEW_SET}:
        die(f"Unexpected moduleSetVersion: {current_set}")
    new_sha = blob_sha(settings_text)
    changed = current_set != NEW_SET
    manifest["moduleSetVersion"] = NEW_SET
    found = False
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

    print("Settings module:", "changed" if settings_changed else "already v9")
    print("Settings blob SHA:", blob_sha(settings_text))
    print("moduleSetVersion:", NEW_SET)
    print("anchor function marker:", settings_text.count("function ensureSectionAnchorSpace"))
    print("anchor spacer marker:", settings_text.count("sectionAnchorSpacer = new View"))
    print("Updated targets" if settings_changed or manifest_changed else "No target changes required")


if __name__ == "__main__":
    main()
