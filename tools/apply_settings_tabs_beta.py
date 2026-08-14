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
MODULE_SET = "20260814.01"
SETTINGS_VERSION_OLD = 27
SETTINGS_VERSION_NEW = 28


def fail(message: str) -> None:
    raise RuntimeError(message)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        fail(f"{label}: expected exactly one anchor, got {count}")
    return text.replace(old, new, 1)


def replace_region(text: str, start_marker: str, end_marker: str,
                   replacement: str, label: str) -> str:
    start = text.find(start_marker)
    if start < 0:
        fail(f"{label}: start marker missing")
    if text.find(start_marker, start + 1) >= 0:
        fail(f"{label}: duplicate start marker")
    end = text.find(end_marker, start)
    if end < 0:
        fail(f"{label}: end marker missing")
    return text[:start] + replacement.rstrip() + "\n\n" + text[end:]


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


def repack_loader(path: Path, loader: str, variable: str,
                  canonical: str) -> None:
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
    loader = "\n".join(line.rstrip() for line in loader.splitlines()) + "\n"
    path.write_text(loader, encoding="utf-8")


def patch_settings() -> None:
    path = ROOT / "src" / "ch_13_settings.js"
    loader, variable, canonical = unpack_loader(path)

    for token in (
        'MODULE_NAME: "ch_13_settings", MODULE_VERSION: 27',
        'function buildRootPage()',
        'var buildPage = function ()',
        'function handleSettingsBack()',
        'function focusSettingsInput(name)',
        'function postScrollToSection(name)',
        'function scrollToSection(name)',
        'function makePaginationSection(colors)',
        'function makeRegexRuleEntrySection(colors)',
    ):
        if token not in canonical:
            fail("settings baseline token missing: " + token)
    if 'var settingsTab = "general";' in canonical:
        fail("settings tabs already applied")

    canonical = replace_once(
        canonical,
        '    var settingsPage = "root";\n',
        '    var settingsPage = "root";\n'
        '    var settingsTab = "general";\n'
        '    var generalSectionView = null;\n'
        '    var settingsGeneralTabView = null;\n'
        '    var settingsHomeTabView = null;\n'
        '    var settingsTranslationTabView = null;\n'
        '    var settingsFilterTabView = null;\n'
        '    var settingsGeneralTabButton = null;\n'
        '    var settingsHomeTabButton = null;\n'
        '    var settingsTranslationTabButton = null;\n'
        '    var settingsFilterTabButton = null;\n',
        "settings tab runtime vars",
    )

    canonical = replace_once(
        canonical,
        '        settingsPage: "root",\n',
        '        settingsPage: "root",\n'
        '        settingsTab: "general",\n'
        '        lastSettingsTab: "general",\n'
        '        settingsTabSwitchCount: 0,\n'
        '        settingsTabBarPresent: false,\n',
        "settings tab diagnostics defaults",
    )

    helpers = r'''    function normalizeSettingsTab(tab) {
        tab = String(tab || "general");
        if (tab === "home" || tab === "translation" || tab === "filter") {
            return tab;
        }
        return "general";
    }

    function makeSettingsTabContainer() {
        var container = new LinearLayout(appContext);
        container.setOrientation(LinearLayout.VERTICAL);
        return container;
    }

    function styleSettingsTabButton(view, active, colors) {
        if (view === null) { return false; }
        view.setBackground(roundedBackground(
            active ? colors.accentStrong : colors.accentSoft,
            colors.accentBorder, 11));
        ClipHub.Theme.applyTextColor(view,
            active ? "#FFFFFFFF" : colors.accentStrong);
        return true;
    }

    function isSettingsTabViewVisible(view) {
        if (view === null) { return false; }
        try { return Number(view.getVisibility()) === Number(View.VISIBLE); }
        catch (ignored) { return false; }
    }

    function updateSettingsTabViews(colors) {
        var current = normalizeSettingsTab(settingsTab);
        settingsTab = current;
        if (settingsGeneralTabView !== null) {
            settingsGeneralTabView.setVisibility(
                current === "general" ? View.VISIBLE : View.GONE);
        }
        if (settingsHomeTabView !== null) {
            settingsHomeTabView.setVisibility(
                current === "home" ? View.VISIBLE : View.GONE);
        }
        if (settingsTranslationTabView !== null) {
            settingsTranslationTabView.setVisibility(
                current === "translation" ? View.VISIBLE : View.GONE);
        }
        if (settingsFilterTabView !== null) {
            settingsFilterTabView.setVisibility(
                current === "filter" ? View.VISIBLE : View.GONE);
        }
        styleSettingsTabButton(settingsGeneralTabButton,
            current === "general", colors);
        styleSettingsTabButton(settingsHomeTabButton,
            current === "home", colors);
        styleSettingsTabButton(settingsTranslationTabButton,
            current === "translation", colors);
        styleSettingsTabButton(settingsFilterTabButton,
            current === "filter", colors);
        uiState.settingsTab = current;
        uiState.lastSettingsTab = current;
        return true;
    }

    function setSettingsTab(tab, origin) {
        var next = normalizeSettingsTab(tab);
        if (settingsPage !== "root") { return false; }
        if (next === settingsTab) {
            updateSettingsTabViews(palette());
            return true;
        }
        hideSettingsKeyboardOnMain();
        releaseSettingsInputFocus("settings_tab_change");
        resetImeAnchorSpacer();
        settingsTab = next;
        uiState.settingsTab = next;
        uiState.lastSettingsTab = next;
        uiState.settingsTabSwitchCount += 1;
        updateSettingsTabViews(palette());
        if (scrollRoot !== null) {
            scrollRoot.scrollTo(0, 0);
            uiState.currentScrollYDp = 0;
            uiState.lastScrollSection = null;
            uiState.lastSectionViewportTopDp = null;
        }
        return true;
    }

    function makeSettingsTabBar(parent, colors) {
        var bar = new LinearLayout(appContext);
        var params;
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        settingsGeneralTabButton = makeButton("常规", colors, false, false);
        settingsHomeTabButton = makeButton("首页", colors, false, false);
        settingsTranslationTabButton = makeButton("翻译", colors, false, false);
        settingsFilterTabButton = makeButton("筛选", colors, false, false);
        settingsGeneralTabButton.setOnClickListener(new JavaAdapter(
            View.OnClickListener, { onClick: function () {
                setSettingsTab("general", "tab_click");
            }}));
        settingsHomeTabButton.setOnClickListener(new JavaAdapter(
            View.OnClickListener, { onClick: function () {
                setSettingsTab("home", "tab_click");
            }}));
        settingsTranslationTabButton.setOnClickListener(new JavaAdapter(
            View.OnClickListener, { onClick: function () {
                setSettingsTab("translation", "tab_click");
            }}));
        settingsFilterTabButton.setOnClickListener(new JavaAdapter(
            View.OnClickListener, { onClick: function () {
                setSettingsTab("filter", "tab_click");
            }}));
        bar.addView(settingsGeneralTabButton,
            new LinearLayout.LayoutParams(0, dp(38), 1));
        params = new LinearLayout.LayoutParams(0, dp(38), 1);
        params.leftMargin = dp(5);
        bar.addView(settingsHomeTabButton, params);
        params = new LinearLayout.LayoutParams(0, dp(38), 1);
        params.leftMargin = dp(5);
        bar.addView(settingsTranslationTabButton, params);
        params = new LinearLayout.LayoutParams(0, dp(38), 1);
        params.leftMargin = dp(5);
        bar.addView(settingsFilterTabButton, params);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(40));
        params.bottomMargin = dp(9);
        parent.addView(bar, params);
        uiState.settingsTabBarPresent = true;
        return bar;
    }

    function settingsTabForInput(name) {
        name = String(name || "");
        if (name.indexOf("translation.") === 0) { return "translation"; }
        if (name === "paginationPageSize") { return "home"; }
        if (name.indexOf("tag.") === 0) { return "filter"; }
        return settingsTab;
    }

    function settingsTabForSection(name) {
        name = String(name || "");
        if (name === "pagination") { return "home"; }
        if (name === "translation") { return "translation"; }
        if (name === "tags" || name === "regex") { return "filter"; }
        if (name === "data" || name === "general") { return "general"; }
        return settingsTab;
    }
'''
    canonical = replace_once(
        canonical,
        '    function buildRootPage() {\n',
        helpers + '\n    function buildRootPage() {\n',
        "settings tab helpers insertion",
    )

    canonical = replace_once(
        canonical,
        '        addSection(content, makeGeneralSection(colors));\n',
        '        makeSettingsTabBar(content, colors);\n'
        '        settingsGeneralTabView = makeSettingsTabContainer();\n'
        '        settingsHomeTabView = makeSettingsTabContainer();\n'
        '        settingsTranslationTabView = makeSettingsTabContainer();\n'
        '        settingsFilterTabView = makeSettingsTabContainer();\n'
        '        generalSectionView = makeGeneralSection(colors);\n'
        '        addSection(settingsGeneralTabView, generalSectionView);\n',
        "settings root general tab grouping",
    )

    canonical = replace_once(
        canonical, '        addSection(content, paginationSectionView);\n',
        '        addSection(settingsHomeTabView, paginationSectionView);\n',
        "settings pagination tab parent",
    )
    canonical = replace_once(
        canonical, '        addSection(content, translationSectionView);\n',
        '        addSection(settingsTranslationTabView, translationSectionView);\n',
        "settings translation tab parent",
    )
    canonical = replace_once(
        canonical, '        addSection(content, tagsSectionView);\n',
        '        addSection(settingsFilterTabView, tagsSectionView);\n',
        "settings tags tab parent",
    )
    canonical = replace_once(
        canonical, '        addSection(content, regexSectionView);\n',
        '        addSection(settingsFilterTabView, regexSectionView);\n',
        "settings regex tab parent",
    )
    canonical = replace_once(
        canonical, '        addSection(content, dataSectionView);\n',
        '        addSection(settingsGeneralTabView, dataSectionView);\n',
        "settings data tab parent",
    )
    canonical = replace_once(
        canonical,
        '        sectionAnchorSpacer = new View(appContext);\n',
        '        content.addView(settingsGeneralTabView, new LinearLayout.LayoutParams(\n'
        '            LinearLayout.LayoutParams.MATCH_PARENT,\n'
        '            LinearLayout.LayoutParams.WRAP_CONTENT));\n'
        '        content.addView(settingsHomeTabView, new LinearLayout.LayoutParams(\n'
        '            LinearLayout.LayoutParams.MATCH_PARENT,\n'
        '            LinearLayout.LayoutParams.WRAP_CONTENT));\n'
        '        content.addView(settingsTranslationTabView, new LinearLayout.LayoutParams(\n'
        '            LinearLayout.LayoutParams.MATCH_PARENT,\n'
        '            LinearLayout.LayoutParams.WRAP_CONTENT));\n'
        '        content.addView(settingsFilterTabView, new LinearLayout.LayoutParams(\n'
        '            LinearLayout.LayoutParams.MATCH_PARENT,\n'
        '            LinearLayout.LayoutParams.WRAP_CONTENT));\n'
        '        updateSettingsTabViews(colors);\n'
        '        sectionAnchorSpacer = new View(appContext);\n',
        "settings tab containers installation",
    )

    canonical = replace_once(
        canonical,
        '    function focusSettingsInput(name) {\n'
        '        var target = namedSettingsInput(name);\n',
        '    function focusSettingsInput(name) {\n'
        '        var inputTab = settingsTabForInput(name);\n'
        '        var target;\n'
        '        if (settingsPage === "root" && inputTab !== settingsTab) {\n'
        '            setSettingsTab(inputTab, "focus_input");\n'
        '        }\n'
        '        target = namedSettingsInput(name);\n',
        "settings focus input tab routing",
    )

    section_fn = r'''    function sectionView(name) {
        name = String(name || "");
        if (name === "general") { return generalSectionView; }
        if (name === "pagination") { return paginationSectionView; }
        if (name === "translation") { return translationSectionView; }
        if (name === "tags") { return tagsSectionView; }
        if (name === "regex") { return regexSectionView; }
        if (name === "data") { return dataSectionView; }
        return null;
    }
'''
    canonical = replace_region(
        canonical,
        '    function sectionView(name) {',
        '    function ensureSectionAnchorSpace(name, expectedRoot) {',
        section_fn,
        "settings sectionView replacement",
    )

    canonical = replace_once(
        canonical,
        '    function postScrollToSection(name) {\n'
        '        var expectedRoot = scrollRoot;\n',
        '    function postScrollToSection(name) {\n'
        '        var targetTab;\n'
        '        var expectedRoot;\n'
        '        name = String(name || "");\n'
        '        targetTab = settingsTabForSection(name);\n'
        '        if (settingsPage === "root" && targetTab !== settingsTab) {\n'
        '            setSettingsTab(targetTab, "post_scroll_section");\n'
        '        }\n'
        '        expectedRoot = scrollRoot;\n',
        "settings post scroll tab routing",
    )

    scroll_fn = r'''    function scrollToSection(name) {
        name = String(name || "");
        return runOnMainSync(function () {
            var targetTab = settingsTabForSection(name);
            if (settingsPage === "root" && targetTab !== settingsTab) {
                setSettingsTab(targetTab, "scroll_section");
            }
            return applySectionScroll(name, scrollRoot);
        }, 3000);
    }
'''
    canonical = replace_region(
        canonical,
        '    function scrollToSection(name) {',
        '    function getState() {',
        scroll_fn,
        "settings scrollToSection replacement",
    )

    canonical = replace_once(
        canonical,
        '        if (settingsPage === "regex_rules") {\n'
        '            clearPendingRegexDeleteConfirm();\n'
        '            settingsPage = "root";\n'
        '            buildPage();\n',
        '        if (settingsPage === "regex_rules") {\n'
        '            clearPendingRegexDeleteConfirm();\n'
        '            settingsPage = "root";\n'
        '            settingsTab = "filter";\n'
        '            uiState.settingsTab = settingsTab;\n'
        '            buildPage();\n',
        "settings regex return to filter tab",
    )

    canonical = replace_once(
        canonical,
        '            onClick: function () {\n'
        '                settingsPage = "regex_rules";\n'
        '                buildPage();\n'
        '            }\n',
        '            onClick: function () {\n'
        '                settingsTab = "filter";\n'
        '                uiState.settingsTab = settingsTab;\n'
        '                settingsPage = "regex_rules";\n'
        '                buildPage();\n'
        '            }\n',
        "settings regex root entry tab retention",
    )

    canonical = replace_once(
        canonical,
        '        performOpenRegexRules: function () {\n'
        '            return runOnMainSync(function () {\n'
        '                settingsPage = "regex_rules";\n',
        '        performOpenRegexRules: function () {\n'
        '            return runOnMainSync(function () {\n'
        '                settingsTab = "filter";\n'
        '                uiState.settingsTab = settingsTab;\n'
        '                settingsPage = "regex_rules";\n',
        "settings regex probe tab retention",
    )

    canonical = replace_once(
        canonical,
        '            uiState.lastError = null;\n'
        '            buildPage();\n'
        '            startSettingsImeMonitoring();\n',
        '            uiState.lastError = null;\n'
        '            settingsTab = "general";\n'
        '            uiState.settingsTab = settingsTab;\n'
        '            uiState.lastSettingsTab = settingsTab;\n'
        '            buildPage();\n'
        '            startSettingsImeMonitoring();\n',
        "settings open default tab",
    )

    canonical = replace_once(
        canonical,
        '                dataSectionView = null;\n',
        '                dataSectionView = null;\n'
        '                generalSectionView = null;\n'
        '                settingsGeneralTabView = null;\n'
        '                settingsHomeTabView = null;\n'
        '                settingsTranslationTabView = null;\n'
        '                settingsFilterTabView = null;\n'
        '                settingsGeneralTabButton = null;\n'
        '                settingsHomeTabButton = null;\n'
        '                settingsTranslationTabButton = null;\n'
        '                settingsFilterTabButton = null;\n'
        '                settingsTab = "general";\n'
        '                uiState.settingsTab = settingsTab;\n'
        '                uiState.lastSettingsTab = settingsTab;\n'
        '                uiState.settingsTabBarPresent = false;\n',
        "settings close tab cleanup",
    )

    canonical = replace_once(
        canonical,
        '            pendingSettingsOpen = false;\n'
        '            settingsPage = "root";\n',
        '            pendingSettingsOpen = false;\n'
        '            settingsPage = "root";\n'
        '            settingsTab = "general";\n'
        '            uiState.settingsTab = settingsTab;\n'
        '            uiState.lastSettingsTab = settingsTab;\n',
        "settings initialize default tab",
    )

    canonical = replace_once(
        canonical,
        '            settingsPage: String(settingsPage),\n',
        '            settingsPage: String(settingsPage),\n'
        '            settingsTab: String(settingsTab),\n'
        '            lastSettingsTab: String(uiState.lastSettingsTab),\n'
        '            settingsTabSwitchCount: Number(uiState.settingsTabSwitchCount),\n'
        '            settingsTabBarPresent: uiState.settingsTabBarPresent === true,\n'
        '            settingsGeneralTabVisible: isSettingsTabViewVisible(\n'
        '                settingsGeneralTabView),\n'
        '            settingsHomeTabVisible: isSettingsTabViewVisible(\n'
        '                settingsHomeTabView),\n'
        '            settingsTranslationTabVisible: isSettingsTabViewVisible(\n'
        '                settingsTranslationTabView),\n'
        '            settingsFilterTabVisible: isSettingsTabViewVisible(\n'
        '                settingsFilterTabView),\n',
        "settings tab state export",
    )

    canonical = replace_once(
        canonical,
        '        performOpenRegexRules: function () {\n',
        '        performSetSettingsTab: function (tab) {\n'
        '            return runOnMainSync(function () {\n'
        '                setSettingsTab(tab, "probe");\n'
        '                return getState();\n'
        '            }, 3000);\n'
        '        },\n'
        '        performOpenRegexRules: function () {\n',
        "settings tab probe action",
    )

    canonical = replace_once(
        canonical,
        f'MODULE_NAME: "ch_13_settings", MODULE_VERSION: {SETTINGS_VERSION_OLD}',
        f'MODULE_NAME: "ch_13_settings", MODULE_VERSION: {SETTINGS_VERSION_NEW}',
        "settings module version",
    )

    for required in (
        'var settingsTab = "general";',
        'function setSettingsTab(tab, origin)',
        'function makeSettingsTabBar(parent, colors)',
        'settingsGeneralTabView.setVisibility',
        'settingsHomeTabView.setVisibility',
        'settingsTranslationTabView.setVisibility',
        'settingsFilterTabView.setVisibility',
        'performSetSettingsTab: function (tab)',
        f'MODULE_NAME: "ch_13_settings", MODULE_VERSION: {SETTINGS_VERSION_NEW}',
    ):
        if required not in canonical:
            fail("patched settings contract missing: " + required)

    repack_loader(path, loader, variable, canonical)


def patch_entry() -> None:
    path = ROOT / "ClipHub.js"
    text = path.read_text(encoding="utf-8")
    text = replace_once(
        text,
        'var DEFAULT_REF = "beta-regex-filter-20260813";',
        f'var DEFAULT_REF = "{BRANCH}";',
        "entry default ref",
    )
    if 'var ENTRY_VERSION = 6;' not in text:
        fail("unexpected ClipHub entry version")
    path.write_text(text, encoding="utf-8")


def patch_beta_control_file(name: str) -> None:
    path = ROOT / name
    text = path.read_text(encoding="utf-8")
    old = "agent/cliphub-ui-drag-handle-unify-20260809"
    count = text.count(old)
    if count < 2:
        fail(f"{name}: expected old ref in comment and constant, got {count}")
    text = text.replace(old, BRANCH)
    path.write_text(text, encoding="utf-8")


def patch_preflight() -> None:
    path = ROOT / "scripts" / "release_preflight.sh"
    text = path.read_text(encoding="utf-8")
    text = replace_once(
        text,
        "  --current)\n",
        "  --settings-tabs-beta)\n"
        f"    EXPECTED_REF='{BRANCH}'\n"
        f"    EXPECTED_MODULE_SET='{MODULE_SET}'\n"
        "    EXPECTED_ENTRY_VERSION='6'\n"
        "    EXPECTED_APP_MODULE_VERSION='20'\n"
        "    REQUIRE_CLEAN='0'\n"
        "    ;;\n"
        "  --current)\n",
        "preflight settings tabs mode",
    )
    text = replace_once(
        text,
        "[--candidate|--main|--beta|--regex-beta|--regex-rc|--current]",
        "[--candidate|--main|--beta|--regex-beta|--regex-rc|--settings-tabs-beta|--current]",
        "preflight usage",
    )
    text = replace_once(
        text,
        'if mode in ("--regex-beta", "--regex-rc"):\n',
        'if mode in ("--regex-beta", "--regex-rc", "--settings-tabs-beta"):\n',
        "preflight regex family mode",
    )
    text = replace_once(
        text,
        '        "ch_13_settings.js": ("ch_13_settings", 27),\n',
        '        "ch_13_settings.js": ("ch_13_settings",\n'
        '            28 if mode == "--settings-tabs-beta" else 27),\n',
        "preflight settings version",
    )
    text = replace_once(
        text,
        '    assert manifest.get("sourceRef") == "beta-regex-filter-20260813"\n',
        '    assert manifest.get("sourceRef") == expected_ref\n',
        "preflight source ref boundary",
    )
    text = replace_once(
        text,
        '    print("Regex beta safety contracts: passed")\n',
        '    if mode == "--settings-tabs-beta":\n'
        '        assert \'var settingsTab = "general";\' in settings_source\n'
        '        assert "function setSettingsTab(tab, origin)" in settings_source\n'
        '        assert "function makeSettingsTabBar(parent, colors)" in settings_source\n'
        '        assert "performSetSettingsTab: function (tab)" in settings_source\n'
        '        assert "settingsTabBarPresent" in settings_source\n'
        '        print("Settings tabs safety contracts: passed")\n'
        '    print("Regex beta safety contracts: passed")\n',
        "preflight settings tabs safety contracts",
    )
    path.write_text(text, encoding="utf-8")


def patch_manifest() -> None:
    path = ROOT / "module-manifest.json"
    manifest = json.loads(path.read_text(encoding="utf-8"))
    if manifest.get("moduleSetVersion") != "20260813.07":
        fail("unexpected baseline moduleSetVersion: " + str(manifest.get("moduleSetVersion")))
    if manifest.get("sourceRef") != "beta-regex-filter-20260813":
        fail("unexpected baseline sourceRef: " + str(manifest.get("sourceRef")))
    if len(manifest.get("modules", [])) != 15:
        fail("formal module count changed")
    manifest["moduleSetVersion"] = MODULE_SET
    manifest["sourceRef"] = BRANCH
    manifest["entryMinVersion"] = 6
    for item in manifest["modules"]:
        module_path = ROOT / str(item["path"])
        item["sha"] = git_blob_sha_text(module_path.read_text(encoding="utf-8"))
    path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8")


def main() -> int:
    patch_settings()
    patch_entry()
    patch_beta_control_file("ClipHub_Beta浮窗开关.txt")
    patch_beta_control_file("ClipHub_Beta状态查询.txt")
    patch_preflight()
    patch_manifest()
    print("Settings Tabs beta patch generated")
    print("branch:", BRANCH)
    print("moduleSetVersion:", MODULE_SET)
    print("settingsVersion:", SETTINGS_VERSION_NEW)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
