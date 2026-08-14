#!/usr/bin/env python3
from __future__ import annotations

import base64
import gzip
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BRANCH = "beta-settings-tabs-20260814"
MODULE_SET_OLD = "20260814.01"
MODULE_SET_NEW = "20260814.02"
SETTINGS_VERSION_OLD = 28
SETTINGS_VERSION_NEW = 29


def fail(message: str) -> None:
    raise RuntimeError(message)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        fail(f"{label}: expected exactly one anchor, got {count}")
    return text.replace(old, new, 1)


def git_blob_sha_text(text: str) -> str:
    raw = text.encode("utf-8")
    return hashlib.sha1(f"blob {len(raw)}\0".encode("utf-8") + raw).hexdigest()


def unpack_loader(path: Path) -> tuple[str, str, str]:
    loader = path.read_text(encoding="utf-8")
    match = re.search(r"\bvar\s+(PACKED_B64|encoded)\s*=\s*(.*?);", loader, re.S)
    if match is None:
        fail(f"packed assignment missing: {path}")
    pieces = re.findall(r'"(?:\\.|[^"\\])*"', match.group(2))
    if not pieces:
        fail(f"packed chunks missing: {path}")
    encoded = "".join(json.loads(piece) for piece in pieces)
    canonical = gzip.decompress(base64.b64decode(encoded)).decode("utf-8")
    expected = re.search(
        r"\bvar\s+SOURCE_SHA256\s*=\s*[\"']([0-9a-fA-F]{64})[\"']", loader
    )
    if expected is None:
        fail("settings SOURCE_SHA256 missing")
    actual = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    if actual != expected.group(1).lower():
        fail(f"settings SOURCE_SHA256 mismatch: {actual}")
    return loader, match.group(1), canonical


def repack_loader(path: Path, loader: str, variable: str, canonical: str) -> None:
    raw = gzip.compress(canonical.encode("utf-8"), compresslevel=9, mtime=0)
    encoded = base64.b64encode(raw).decode("ascii")
    chunks = [encoded[i:i + 120] for i in range(0, len(encoded), 120)]
    expression = "\n        " + " +\n        ".join(json.dumps(chunk) for chunk in chunks) + "\n    "
    pattern = re.compile(
        r"(\bvar\s+" + re.escape(variable) + r"\s*=\s*)(.*?)(;)", re.S
    )
    match = pattern.search(loader)
    if match is None:
        fail("settings packed assignment missing during repack")
    loader = loader[:match.start(2)] + expression + loader[match.end(2):]
    source_sha = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    loader, count = re.subn(
        r"(\bvar\s+SOURCE_SHA256\s*=\s*[\"'])[0-9a-fA-F]{64}([\"'])",
        lambda m: m.group(1) + source_sha + m.group(2), loader, count=1
    )
    if count != 1:
        fail("settings SOURCE_SHA256 update failed")
    loader = replace_once(
        loader,
        "/* ClipHub offline self-contained packed full Settings24 ES5 loader. */",
        "/* ClipHub offline self-contained packed Settings ES5 loader. */",
        "settings loader stable comment",
    )
    loader = "\n".join(line.rstrip() for line in loader.splitlines()) + "\n"
    path.write_text(loader, encoding="utf-8")


def patch_settings() -> None:
    path = ROOT / "src" / "ch_13_settings.js"
    loader, variable, canonical = unpack_loader(path)

    required_baseline = (
        f"MODULE_VERSION: {SETTINGS_VERSION_OLD}",
        'var settingsTab = "general";',
        'function setSettingsTab(tab, origin)',
        'function isSettingsTabViewVisible(view)',
        'function getState()',
        'performSetSettingsTab: function (tab)',
        'performOpenRegexRules: function ()',
        'function handleSettingsBack()',
    )
    for token in required_baseline:
        if token not in canonical:
            fail("settings review baseline token missing: " + token)
    for forbidden in (
        'function settingsRootTabsActive()',
        'performSettingsBack: function ()',
        f'MODULE_VERSION: {SETTINGS_VERSION_NEW}',
    ):
        if forbidden in canonical:
            fail("settings review fix already applied: " + forbidden)

    root_helper = '''    function settingsRootTabsActive() {\n        return settingsPage === "root" &&\n            uiState.attached === true &&\n            uiState.settingsTabBarPresent === true;\n    }\n\n'''
    canonical = replace_once(
        canonical,
        '    function isSettingsTabViewVisible(view) {\n',
        root_helper + '    function isSettingsTabViewVisible(view) {\n',
        "settings root tabs active helper",
    )

    canonical = replace_once(
        canonical,
        '    function getState() {\n',
        '    function getState() {\n'
        '        var rootTabsActive = settingsRootTabsActive();\n',
        "settings getState root activity snapshot",
    )

    old_state = (
        '            settingsTabBarPresent: uiState.settingsTabBarPresent === true,\n'
        '            settingsGeneralTabVisible: isSettingsTabViewVisible(\n'
        '                settingsGeneralTabView),\n'
        '            settingsHomeTabVisible: isSettingsTabViewVisible(\n'
        '                settingsHomeTabView),\n'
        '            settingsTranslationTabVisible: isSettingsTabViewVisible(\n'
        '                settingsTranslationTabView),\n'
        '            settingsFilterTabVisible: isSettingsTabViewVisible(\n'
        '                settingsFilterTabView),\n'
    )
    new_state = (
        '            settingsTabBarPresent: rootTabsActive,\n'
        '            settingsGeneralTabVisible: rootTabsActive &&\n'
        '                isSettingsTabViewVisible(settingsGeneralTabView),\n'
        '            settingsHomeTabVisible: rootTabsActive &&\n'
        '                isSettingsTabViewVisible(settingsHomeTabView),\n'
        '            settingsTranslationTabVisible: rootTabsActive &&\n'
        '                isSettingsTabViewVisible(settingsTranslationTabView),\n'
        '            settingsFilterTabVisible: rootTabsActive &&\n'
        '                isSettingsTabViewVisible(settingsFilterTabView),\n'
    )
    canonical = replace_once(
        canonical, old_state, new_state, "settings root tab diagnostic semantics"
    )

    back_api = (
        '        performSettingsBack: function () {\n'
        '            return runOnMainSync(function () {\n'
        '                handleSettingsBack();\n'
        '                return getState();\n'
        '            }, 3000);\n'
        '        },\n'
    )
    canonical = replace_once(
        canonical,
        '        performOpenRegexRules: function () {\n',
        back_api + '        performOpenRegexRules: function () {\n',
        "settings minimal probe back api",
    )

    canonical = replace_once(
        canonical,
        f'MODULE_VERSION: {SETTINGS_VERSION_OLD}',
        f'MODULE_VERSION: {SETTINGS_VERSION_NEW}',
        "settings module version",
    )

    for token in (
        'function settingsRootTabsActive()',
        'var rootTabsActive = settingsRootTabsActive();',
        'settingsTabBarPresent: rootTabsActive',
        'settingsGeneralTabVisible: rootTabsActive &&',
        'settingsHomeTabVisible: rootTabsActive &&',
        'settingsTranslationTabVisible: rootTabsActive &&',
        'settingsFilterTabVisible: rootTabsActive &&',
        'performSettingsBack: function ()',
        f'MODULE_VERSION: {SETTINGS_VERSION_NEW}',
    ):
        if token not in canonical:
            fail("settings review contract missing: " + token)

    repack_loader(path, loader, variable, canonical)


def probe_source() -> str:
    return r'''/* ClipHub settings tabs probe 071. Rhino ES5 only. */
var ClipHubSettingsTabsProbe071Result = (function (global) {
    var ClipHub = global.ClipHub;
    var settings = null;
    var openedByProbe = false;
    var initialState = null;
    var initialTab = "general";
    var renderCount = 0;
    var tabs = ["general", "home", "translation", "filter"];
    var index;
    var round;
    var state = null;
    var visibleCount;
    var defaultTabStable = true;
    var switchStable = true;
    var renderStable = true;
    var sectionRouting = true;
    var subpageDiagnosticsStable = true;
    var restoreStable = true;
    var errorText = null;

    function countVisible(input) {
        var count = 0;
        if (!input) { return 0; }
        if (input.settingsGeneralTabVisible === true) { count += 1; }
        if (input.settingsHomeTabVisible === true) { count += 1; }
        if (input.settingsTranslationTabVisible === true) { count += 1; }
        if (input.settingsFilterTabVisible === true) { count += 1; }
        return count;
    }

    function tabVisible(input, tab) {
        if (!input) { return false; }
        if (tab === "general") { return input.settingsGeneralTabVisible === true; }
        if (tab === "home") { return input.settingsHomeTabVisible === true; }
        if (tab === "translation") {
            return input.settingsTranslationTabVisible === true;
        }
        if (tab === "filter") { return input.settingsFilterTabVisible === true; }
        return false;
    }

    function rootStateStable(input, expectedTab) {
        return input &&
            String(input.settingsPage || "") === "root" &&
            input.settingsTabBarPresent === true &&
            String(input.settingsTab || "") === expectedTab &&
            countVisible(input) === 1 &&
            tabVisible(input, expectedTab);
    }

    function checkSection(name, expectedTab) {
        settings.scrollToSection(name);
        state = settings.getState();
        if (!rootStateStable(state, expectedTab)) {
            sectionRouting = false;
        }
    }

    try {
        if (!ClipHub || !ClipHub.Settings) {
            throw new Error("ClipHub.Settings unavailable");
        }
        settings = ClipHub.Settings;
        if (typeof settings.performSetSettingsTab !== "function") {
            throw new Error("performSetSettingsTab unavailable");
        }
        if (typeof settings.performOpenRegexRules !== "function") {
            throw new Error("performOpenRegexRules unavailable");
        }
        if (typeof settings.performSettingsBack !== "function") {
            throw new Error("performSettingsBack unavailable");
        }
        if (typeof settings.getState !== "function") {
            throw new Error("Settings.getState unavailable");
        }
        if (typeof settings.scrollToSection !== "function") {
            throw new Error("Settings.scrollToSection unavailable");
        }

        initialState = settings.getState();
        initialTab = String(initialState.settingsTab || "general");
        if (initialState.attached !== true) {
            settings.open();
            openedByProbe = true;
            state = settings.getState();
            if (!rootStateStable(state, "general")) {
                defaultTabStable = false;
            }
        } else {
            state = initialState;
            if (String(state.settingsPage || "") !== "root") {
                throw new Error("Settings probe requires root when already attached");
            }
            if (!rootStateStable(state, initialTab)) {
                switchStable = false;
            }
        }

        renderCount = Number(state.renderCount || 0);
        for (round = 0; round < 25; round += 1) {
            for (index = 0; index < tabs.length; index += 1) {
                state = settings.performSetSettingsTab(tabs[index]);
                visibleCount = countVisible(state);
                if (String(state.settingsTab || "") !== tabs[index] ||
                        visibleCount !== 1 ||
                        !tabVisible(state, tabs[index]) ||
                        state.settingsTabBarPresent !== true ||
                        String(state.settingsPage || "") !== "root") {
                    switchStable = false;
                }
                if (Number(state.renderCount || 0) !== renderCount) {
                    renderStable = false;
                }
            }
        }

        checkSection("tags", "filter");
        checkSection("regex", "filter");
        checkSection("translation", "translation");
        checkSection("pagination", "home");
        checkSection("data", "general");

        state = settings.performSetSettingsTab("filter");
        if (!rootStateStable(state, "filter")) {
            switchStable = false;
        }
        state = settings.performOpenRegexRules();
        if (String(state.settingsPage || "") !== "regex_rules" ||
                state.settingsTabBarPresent !== false ||
                countVisible(state) !== 0) {
            subpageDiagnosticsStable = false;
        }
        state = settings.performSettingsBack();
        if (!rootStateStable(state, "filter")) {
            subpageDiagnosticsStable = false;
        }
    } catch (error) {
        errorText = String(error);
    }

    try {
        if (settings !== null) {
            if (openedByProbe) {
                if (typeof settings.close !== "function") {
                    restoreStable = false;
                } else {
                    settings.close("settings_tabs_probe_071");
                }
            } else if (initialState !== null && initialState.attached === true &&
                    String(initialState.settingsPage || "") === "root") {
                state = settings.performSetSettingsTab(initialTab);
                if (!rootStateStable(state, initialTab)) {
                    restoreStable = false;
                }
            }
        }
    } catch (restoreError) {
        restoreStable = false;
        if (errorText === null) {
            errorText = "restore: " + String(restoreError);
        }
    }

    return {
        probe: 71,
        ok: errorText === null && defaultTabStable && switchStable &&
            renderStable && sectionRouting && subpageDiagnosticsStable &&
            restoreStable,
        initialTab: initialTab,
        openedByProbe: openedByProbe,
        defaultTabStable: defaultTabStable,
        switchStable: switchStable,
        renderStable: renderStable,
        sectionRouting: sectionRouting,
        subpageDiagnosticsStable: subpageDiagnosticsStable,
        restoreStable: restoreStable,
        renderCountBefore: renderCount,
        renderCountAfter: state === null ? null : Number(state.renderCount || 0),
        error: errorText
    };
}((function () { return this; }())));

JSON.stringify(ClipHubSettingsTabsProbe071Result, null, 2);
'''


def patch_probe() -> None:
    path = ROOT / "probes" / "cliphub_settings_tabs_probe_071.js"
    current = path.read_text(encoding="utf-8")
    for token in (
        "ClipHub settings tabs probe 071",
        'settings.performSetSettingsTab("general")',
        "sectionRouting",
    ):
        if token not in current:
            fail("probe 071 baseline token missing: " + token)
    path.write_text(probe_source(), encoding="utf-8")


def patch_preflight() -> None:
    path = ROOT / "scripts" / "release_preflight.sh"
    text = path.read_text(encoding="utf-8")
    text = replace_once(
        text,
        "  --settings-tabs-beta)\n"
        "    EXPECTED_REF='beta-settings-tabs-20260814'\n"
        "    EXPECTED_MODULE_SET='20260814.01'\n",
        "  --settings-tabs-beta)\n"
        "    EXPECTED_REF='beta-settings-tabs-20260814'\n"
        "    EXPECTED_MODULE_SET='20260814.02'\n",
        "preflight settings module set",
    )
    text = replace_once(
        text,
        '            28 if mode == "--settings-tabs-beta" else 27),\n',
        '            29 if mode == "--settings-tabs-beta" else 27),\n',
        "preflight settings module version",
    )
    old_contract = (
        '        assert \'var settingsTab = "general";\' in settings_source\n'
        '        assert "function setSettingsTab(tab, origin)" in settings_source\n'
        '        assert "function makeSettingsTabBar(parent, colors)" in settings_source\n'
        '        assert "performSetSettingsTab: function (tab)" in settings_source\n'
        '        assert "settingsTabBarPresent" in settings_source\n'
        '        print("Settings tabs safety contracts: passed")\n'
    )
    new_contract = (
        '        assert \'var settingsTab = "general";\' in settings_source\n'
        '        assert "function setSettingsTab(tab, origin)" in settings_source\n'
        '        assert "function makeSettingsTabBar(parent, colors)" in settings_source\n'
        '        assert "function settingsRootTabsActive()" in settings_source\n'
        '        assert "settingsTabBarPresent: rootTabsActive" in settings_source\n'
        '        assert "settingsGeneralTabVisible: rootTabsActive &&" in settings_source\n'
        '        assert "settingsHomeTabVisible: rootTabsActive &&" in settings_source\n'
        '        assert "settingsTranslationTabVisible: rootTabsActive &&" in settings_source\n'
        '        assert "settingsFilterTabVisible: rootTabsActive &&" in settings_source\n'
        '        assert "performSetSettingsTab: function (tab)" in settings_source\n'
        '        assert "performSettingsBack: function ()" in settings_source\n'
        '        assert "Settings24 ES5 loader" not in settings_loader\n'
        '        print("Settings tabs safety contracts: passed")\n'
    )
    text = replace_once(
        text, old_contract, new_contract, "preflight settings diagnostics contracts"
    )
    path.write_text(text, encoding="utf-8")


def validate_workflow_source() -> str:
    return '''name: Settings Tabs Validate

on:
  push:
    branches: [beta-settings-tabs-20260814]
    paths:
      - .github/workflows/settings_tabs_validate.yml
      - src/ch_13_settings.js
      - probes/cliphub_settings_tabs_probe_071.js
      - tools/apply_settings_tabs_review_fix.py
      - ClipHub.js
      - module-manifest.json
      - scripts/release_preflight.sh
      - ClipHub_Beta浮窗开关.txt
      - ClipHub_Beta状态查询.txt

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Validate ES5 color and release boundaries
        shell: bash
        run: |
          set -euo pipefail
          python3 scripts/validate_es5.py .
          python3 scripts/audit_color_api.py --release-strict | tee /tmp/settings-tabs-color.txt
          grep '^HIGH=0 WARN=0 ' /tmp/settings-tabs-color.txt
          bash scripts/release_preflight.sh --settings-tabs-beta
          git diff --check
'''


def patch_validate_workflow() -> None:
    path = ROOT / ".github" / "workflows" / "settings_tabs_validate.yml"
    current = path.read_text(encoding="utf-8")
    if "name: Settings Tabs Validate" not in current:
        fail("unexpected settings tabs validate workflow")
    path.write_text(validate_workflow_source(), encoding="utf-8")


def patch_manifest() -> None:
    path = ROOT / "module-manifest.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    if manifest.get("moduleSetVersion") != MODULE_SET_OLD:
        fail("unexpected baseline moduleSetVersion: " + str(manifest.get("moduleSetVersion")))
    if manifest.get("sourceRef") != BRANCH:
        fail("unexpected baseline sourceRef: " + str(manifest.get("sourceRef")))
    if manifest.get("entryMinVersion") != 6:
        fail("unexpected entryMinVersion")
    modules = manifest.get("modules", [])
    if len(modules) != 15:
        fail("formal module count changed")
    manifest["moduleSetVersion"] = MODULE_SET_NEW
    for item in modules:
        module_path = ROOT / str(item["path"])
        if not module_path.is_file():
            fail("manifest module missing: " + str(module_path))
        item["sha"] = git_blob_sha_text(module_path.read_text(encoding="utf-8"))
    path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def cleanup_one_shot_generator() -> None:
    for relative in (
        ".github/settings-tabs-beta-trigger.txt",
        ".github/workflows/settings_tabs_beta.yml",
    ):
        path = ROOT / relative
        if not path.exists():
            fail("one-shot generator cleanup target missing: " + relative)
        path.unlink()


def main() -> int:
    patch_settings()
    patch_probe()
    patch_preflight()
    patch_validate_workflow()
    patch_manifest()
    cleanup_one_shot_generator()
    print("Settings Tabs review fix generated")
    print("branch:", BRANCH)
    print("moduleSetVersion:", MODULE_SET_NEW)
    print("settingsVersion:", SETTINGS_VERSION_NEW)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
