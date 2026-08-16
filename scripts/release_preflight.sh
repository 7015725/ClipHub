#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="${1:---candidate}"
EXPECTED_MODULE_SET='20260723.14'
EXPECTED_ENTRY_VERSION='5'
EXPECTED_APP_MODULE_VERSION='9'
CHECK_FILTER_LOADER_REF='0'
REQUIRE_CLEAN='1'
case "$MODE" in
  --candidate) EXPECTED_REF='agent/initialize-project-skeleton' ;;
  --main)
    EXPECTED_REF='main'
    EXPECTED_MODULE_SET='20260809.05'
    EXPECTED_ENTRY_VERSION='6'
    EXPECTED_APP_MODULE_VERSION='20'
    ;;
  --beta)
    EXPECTED_REF='beta-pagination-stage10-20260808'
    EXPECTED_MODULE_SET='20260808.01'
    EXPECTED_ENTRY_VERSION='6'
    EXPECTED_APP_MODULE_VERSION='19'
    CHECK_FILTER_LOADER_REF='1'
    ;;
  --regex-beta)
    EXPECTED_REF='beta-regex-filter-20260813'
    EXPECTED_MODULE_SET='20260813.09'
    EXPECTED_ENTRY_VERSION='6'
    EXPECTED_APP_MODULE_VERSION='20'
    REQUIRE_CLEAN='0'
    ;;
  --regex-rc)
    EXPECTED_REF='beta-regex-filter-20260813'
    EXPECTED_MODULE_SET='20260813.09'
    EXPECTED_ENTRY_VERSION='6'
    EXPECTED_APP_MODULE_VERSION='20'
    REQUIRE_CLEAN='1'
    ;;
  --settings-tabs-beta)
    EXPECTED_REF='docs/tokenizer-softcode-hardening-20260815'
    EXPECTED_MODULE_SET='20260816.09'
    EXPECTED_ENTRY_VERSION='8'
    EXPECTED_APP_MODULE_VERSION='23'
    REQUIRE_CLEAN='0'
    ;;
  --current)
    EXPECTED_REF=''
    EXPECTED_MODULE_SET=''
    EXPECTED_ENTRY_VERSION=''
    EXPECTED_APP_MODULE_VERSION='20'
    REQUIRE_CLEAN='0'
    ;;
  *)
    echo 'Usage: bash scripts/release_preflight.sh [--candidate|--main|--beta|--regex-beta|--regex-rc|--settings-tabs-beta|--current]' >&2
    exit 2
    ;;
esac

AUDIT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/cliphub-release-preflight.XXXXXX")"
trap 'rm -rf "$AUDIT_DIR"' EXIT HUP INT TERM

if [ "$REQUIRE_CLEAN" = '1' ] && [ -n "$(git status --short)" ]; then
  echo 'ERROR: working tree is not clean.' >&2
  git status --short >&2
  exit 1
fi

python3 scripts/validate_es5.py .

# Packed modules must be syntax-checked after expansion; checking only the loader
# wrapper cannot detect syntax errors inside gzip/base64 payloads.
PACKED_SYNTAX_DIR="$AUDIT_DIR/expanded-js"
mkdir -p "$PACKED_SYNTAX_DIR"
python3 - "$PACKED_SYNTAX_DIR" <<'PYJS'
import base64
import gzip
import json
import re
import sys
from pathlib import Path

out = Path(sys.argv[1])
for path in sorted(Path('src').glob('*.js')):
    text = path.read_text(encoding='utf-8')
    match = re.search(r'\bvar\s+(?:PACKED_B64|encoded)\s*=\s*(.*?);', text, re.S)
    source = text
    if match is not None:
        pieces = re.findall(r'"(?:\\.|[^"\\])*"', match.group(1))
        source = gzip.decompress(base64.b64decode(
            ''.join(json.loads(piece) for piece in pieces))).decode('utf-8')
    (out / path.name).write_text(source, encoding='utf-8')
PYJS
for expanded_js in "$PACKED_SYNTAX_DIR"/*.js; do
  node --check "$expanded_js" >/dev/null
done
echo 'Expanded JS syntax verification: passed'
if [ "$MODE" = '--settings-tabs-beta' ]; then
  python3 scripts/manifest_contract.py validate --settings-tabs-beta
  node scripts/test_tokenizer_core.js
  node scripts/test_tokenizer_home_long_press.js
  node scripts/test_tokenizer_home_runtime_bridge.js
  node scripts/test_tokenizer_layout_contract.js
  node scripts/test_ui_shell_navigation.js
  node scripts/test_runtime_diagnostics.js
  python3 scripts/test_primary_window_legacy_routes.py
  python3 scripts/test_review_regressions.py
fi
if [ "$MODE" = '--beta' ]; then
  python3 scripts/audit_color_api.py \
    --json "$AUDIT_DIR/color-findings.json" \
    | tee "$AUDIT_DIR/color-findings.txt"
  python3 - "$AUDIT_DIR/color-findings.json" <<'PY'
import json
import sys

allowed = {
    ("HIGH", "src/ch_08_window.js", 500, "setColorFilter"),
    ("HIGH", "src/ch_08_window.js", 561, "setBackgroundColor"),
    ("HIGH", "src/ch_08_window.js", 1115, "setColorFilter"),
    ("HIGH", "src/ch_08_window.js", 1116, "setColorFilter"),
    ("HIGH", "src/ch_10_editor.js", 1383, "setBackgroundColor"),
}
findings = json.load(open(sys.argv[1], encoding="utf-8"))
risky = {
    (item["severity"], item["path"], item["line"], item["api"])
    for item in findings
    if item["severity"] in ("HIGH", "WARN")
}
assert risky == allowed, {
    "unexpected": sorted(risky - allowed),
    "missing": sorted(allowed - risky),
}
print("Beta color audit: no findings added relative to Stage 10 baseline")
PY
else
  python3 scripts/audit_color_api.py \
    --release-strict \
    --json "$AUDIT_DIR/color-findings.json" \
    | tee "$AUDIT_DIR/color-findings.txt"
  grep '^HIGH=0 WARN=0 ' "$AUDIT_DIR/color-findings.txt"
fi

python3 - \
  "$MODE" \
  "$EXPECTED_REF" \
  "$EXPECTED_MODULE_SET" \
  "$EXPECTED_ENTRY_VERSION" \
  "$EXPECTED_APP_MODULE_VERSION" \
  "$CHECK_FILTER_LOADER_REF" <<'PY'
from __future__ import annotations

import base64
import gzip
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

root = Path.cwd()
mode = sys.argv[1]
expected_ref = sys.argv[2]
expected_module_set = sys.argv[3]
expected_entry_text = sys.argv[4]
expected_app_module_version = int(sys.argv[5])
check_filter_loader_ref = sys.argv[6] == "1"
manifest = json.loads((root / "module-manifest.json").read_text(encoding="utf-8"))

if mode == "--current":
    expected_ref = str(manifest.get("sourceRef", ""))
    expected_module_set = str(manifest.get("moduleSetVersion", ""))
    expected_entry_version = int(manifest.get("entryMinVersion", -1))
    branch = subprocess.check_output(
        ["git", "branch", "--show-current"], text=True
    ).strip()
    assert branch == expected_ref, (branch, expected_ref)
else:
    expected_entry_version = int(expected_entry_text)

expected_schema_version = 2 if mode == "--settings-tabs-beta" else 1
assert manifest.get("schemaVersion") == expected_schema_version, manifest.get("schemaVersion")
assert manifest.get("moduleSetVersion") == expected_module_set, manifest.get("moduleSetVersion")
assert manifest.get("entryMinVersion") == expected_entry_version, manifest.get("entryMinVersion")
assert manifest.get("sourceRef") == expected_ref, manifest.get("sourceRef")
expected_module_count = 19 if mode == "--settings-tabs-beta" else 15
assert len(manifest.get("modules", [])) == expected_module_count, len(manifest.get("modules", []))
if mode == "--settings-tabs-beta":
    assert len(manifest.get("resources", [])) == 2, len(manifest.get("resources", []))
    resource_by_id = {str(item["id"]): item for item in manifest.get("resources", [])}
    assert resource_by_id["test.manifest.resource"]["path"] == "assets/test/manifest-resource.txt"
    assert resource_by_id["tokenizer.dictionary.default"]["path"] == "assets/tokenizer/jieba-small.gz.b64"



def blob_sha(text: str) -> str:
    data = text.encode("utf-8")
    return hashlib.sha1(f"blob {len(data)}\0".encode("utf-8") + data).hexdigest()


def expanded_source(source: str) -> str | None:
    assignment = re.search(
        r"\bvar\s+(?:PACKED_B64|encoded)\s*=\s*(.*?);", source, re.S
    )
    if assignment is None:
        return None
    pieces = re.findall(r'"(?:\\.|[^"\\])*"', assignment.group(1))
    encoded = "".join(json.loads(piece) for piece in pieces)
    expanded = gzip.decompress(base64.b64decode(encoded)).decode("utf-8")
    expected = re.search(
        r"\bvar\s+SOURCE_SHA256\s*=\s*['\"]([0-9a-fA-F]{64})['\"]",
        source,
    )
    if expected is not None:
        actual = hashlib.sha256(expanded.encode("utf-8")).hexdigest()
        assert actual == expected.group(1).lower(), (actual, expected.group(1))
    return expanded


seen = set()
actual_sources: dict[str, str] = {}
for item in manifest["modules"]:
    name = str(item["name"])
    path = root / str(item["path"])
    assert name not in seen, name
    assert path.is_file(), path
    assert path.name == name, (path, name)
    source = path.read_text(encoding="utf-8")
    actual = blob_sha(source)
    assert actual == str(item["sha"]), (name, actual, item["sha"])
    actual_sources[name] = expanded_source(source) or source
    seen.add(name)

entry = (root / "ClipHub.js").read_text(encoding="utf-8")
app = actual_sources["ch_15_app.js"]
filter_loader = (root / "src/ch_11_filter.js").read_text(encoding="utf-8")
settings_loader = (root / "src/ch_13_settings.js").read_text(encoding="utf-8")
toggle = (root / "tasks/ClipHub_全局剪贴板开关.js").read_text(encoding="utf-8")
theme = actual_sources["ch_07_theme.js"]

assert re.search(r"var ENTRY_VERSION = " + str(expected_entry_version) + r";", entry)
assert re.search(r'var DEFAULT_REF = "' + re.escape(expected_ref) + r'";', entry)
if check_filter_loader_ref:
    assert re.search(r'var REF = "' + re.escape(expected_ref) + r'";', filter_loader)
assert re.search(r"var CONTROL_ENDPOINT_SCHEMA = 3;", app)
assert re.search(
    r"MODULE_NAME:\s*\"ch_15_app\"\s*,\s*MODULE_VERSION:\s*" +
    str(expected_app_module_version), app, re.S,
)
assert re.search(r"var TASK_VERSION = 3;", toggle)
assert re.search(r"var REQUIRED_ENDPOINT_SCHEMA = 3;", toggle)
assert re.search(r"var MIN_ENTRY_VERSION = 5;", toggle)
expected_theme_version = 10 if mode == "--settings-tabs-beta" else 4
assert re.search(
    r"MODULE_NAME:\s*\"ch_07_theme\"\s*,\s*MODULE_VERSION:\s*" +
    str(expected_theme_version), theme, re.S)
assert "getColorSafetyState: getColorSafetyState" in theme
assert "getPanelChromeMetrics: getPanelChromeMetrics" in theme
assert "panel_chrome_home_baseline_v1" in theme
assert "panel_shortx_icon_system_v1" in theme
assert 'SHORTX_ICON_PACKAGE = "tornaco.apps.shortx"' in theme
assert 'settings: "ic_remix_settings_3_line"' in theme
assert 'list: "ic_remix_list_unordered"' in theme
assert 'globe: "ic_remix_global_line"' in theme
assert "getShortXPanelIconDrawable: makeShortXPanelIconDrawable" in theme
assert "decoratePanelIcon: decoratePanelIcon" in theme
assert not (root / "tasks/ClipHub_打开全局剪贴板.js").exists()

if mode in ("--current", "--main"):
    required_versions = {
        "ch_08_window.js": ("ch_08_window", 19),
        "ch_09_list.js": ("ch_09_list", 21),
        "ch_10_editor.js": ("ch_10_editor", 24),
        "ch_11_filter.js": ("ch_11_filter", 74),
        "ch_12_translation.js": ("ch_12_translation", 13),
        "ch_13_settings.js": ("ch_13_settings", 24),
        "ch_15_app.js": ("ch_15_app", 20),
    }
    for filename, (module_name, module_version) in required_versions.items():
        source = actual_sources[filename]
        pattern = (
            r"MODULE_NAME:\s*\"" + re.escape(module_name) +
            r"\"\s*,\s*MODULE_VERSION:\s*" + str(module_version)
        )
        assert re.search(pattern, source, re.S), (filename, module_version)
    navigation = actual_sources["ch_12_translation.js"]
    assert re.search(
        r'MODULE_NAME:\s*"ch_14_navigation_embedded"\s*,\s*MODULE_VERSION:\s*7',
        navigation,
        re.S,
    )
    assert expected_module_set == "20260809.05", expected_module_set
    combined = "\n".join(actual_sources.values())
    assert "removeViewImmediate(" not in combined
    assert not re.search(
        r"Looper\.getMainLooper\(\)\s*===|===\s*Looper\.getMainLooper\(\)",
        combined,
    )
    for forbidden in ("Packages.java.net.URL", "openConnection(",
                      "modules.backup", "stage2"):
        assert forbidden not in settings_loader, forbidden

print("Manifest SHA verification: passed")
print("Formal task structure: background + toggle")
print("entryVersion: " + str(expected_entry_version))
print("endpointSchemaVersion: 3")
print("moduleSetVersion: " + expected_module_set)
print("sourceRef: " + expected_ref)
print("Theme: " + str(expected_theme_version))
if mode in ("--regex-beta", "--regex-rc", "--settings-tabs-beta"):
    if mode == "--settings-tabs-beta":
        required_versions = {
            "ch_03_database.js": ("ch_03_database", 5),
            "ch_06_repository.js": ("ch_06_repository", 20),
            "ch_09_list.js": ("ch_09_list", 25),
            "ch_10_editor.js": ("ch_10_editor", 36),
            "ch_11_filter.js": ("ch_11_filter", 91),
            "ch_13_settings.js": ("ch_13_settings", 41),
            "ch_15_app.js": ("ch_15_app", 23),
            "ch_12_translation.js": ("ch_12_translation", 21),
            "ch_16_ui_shell.js": ("ch_16_ui_shell", 7),
            "ch_17_tokenizer_ui.js": ("ch_17_tokenizer_ui", 15),
            "ch_18_tokenizer_core.js": ("ch_18_tokenizer_core", 2),
            "ch_19_tokenizer_service.js": ("ch_19_tokenizer_service", 6),
        }
    else:
        required_versions = {
            "ch_03_database.js": ("ch_03_database", 4),
            "ch_06_repository.js": ("ch_06_repository", 18),
            "ch_11_filter.js": ("ch_11_filter", 80),
            "ch_13_settings.js": ("ch_13_settings", 27),
            "ch_15_app.js": ("ch_15_app", 20),
        }
    for filename, (module_name, module_version) in required_versions.items():
        source = actual_sources[filename]
        pattern = (
            r"MODULE_NAME:\s*\"" + re.escape(module_name) +
            r"\"\s*,\s*MODULE_VERSION:\s*" + str(module_version)
        )
        assert re.search(pattern, source, re.S), (filename, module_version)
    database_source = actual_sources["ch_03_database.js"]
    repository_source = actual_sources["ch_06_repository.js"]
    filter_source = actual_sources["ch_11_filter.js"]
    settings_source = actual_sources["ch_13_settings.js"]
    if mode == "--settings-tabs-beta":
        for icon_bridge_file in (
            "ch_09_list.js", "ch_10_editor.js", "ch_11_filter.js",
            "ch_12_translation.js", "ch_13_settings.js", "ch_17_tokenizer_ui.js",
        ):
            assert "panel_icon_explicit_v2" in actual_sources[icon_bridge_file], icon_bridge_file
            assert "panel_icon_text_bridge_v1" not in actual_sources[icon_bridge_file], icon_bridge_file
        assert "explicitIcon !== true" in theme
        assert "条超大内容未参与正则扫描" in filter_source
        repository_loader = (root / "src/ch_06_repository.js").read_text(encoding="utf-8")
        assert "var SOURCE_SHA256" in repository_loader

    assert "var SCHEMA_VERSION = 2;" in database_source
    assert "db.setVersion(3)" not in database_source
    assert "CREATE TABLE IF NOT EXISTS regex_rules" in database_source
    assert "feature.regex_rules.schema_version" in database_source
    if mode == "--settings-tabs-beta":
        assert "var REGEX_FEATURE_SCHEMA_VERSION = 1;" in database_source
        assert "REGEX_FEATURE_MIGRATIONS" in database_source
        assert "migrateRegexFeatureSchema" in database_source
        assert "validateRegexPolicy" in repository_source
        assert "REGEX_SCAN_ITEM_TEXT_CHAR_BUDGET = 786432" in repository_source
        assert "consumedCount" in repository_source
        assert "oversizeSkippedCount" in repository_source
        assert "REGEX_INLINE_PAGE_SIZE = 30" in filter_source
        assert "regexRuleTotalCount" in filter_source
        assert "regexInlineVisibleLimit" in filter_source
        assert "REGEX_TEST_TEXT_CHAR_BUDGET = 786432" in settings_source
        assert "var handleHit = new LinearLayout(appContext);" in settings_source
        assert "bindRegexRuleDrag(handleHit, root, rule.id);" in settings_source
        assert "colors.stroke, layout.cardRadiusDp" in settings_source
        assert "Math.abs(delta) >= dp(28)" in settings_source
        assert "standalone_subpage_home_drag_baseline" in settings_source
        assert "settings_root_home_header_baseline_v1" in settings_source
        assert "settings_chrome_unified_v1" in settings_source
        assert "settings_subpage_chrome_unified_v1" in settings_source
        assert "function makeRegexTouchWrapper(view, visualHeightDp)" in settings_source
        assert "regex_rule_card_home_density_v1" in settings_source
    assert "feature.regex_rules.defaults_initialized" in repository_source
    assert "listRegexCandidateChunk" in repository_source
    assert ".matcher(text).matches()" not in filter_source
    assert ".matcher(text).find()" in filter_source
    assert 'addChoiceSection(content, "排序方式"' not in filter_source
    assert "        sortRow = makeChoiceChipRow([" not in filter_source
    assert '    function validateSortMode(mode) {\n        return "latest";\n    }' in filter_source
    assert '    function regexRulePickerLabel(rule) {\n        return String(rule && rule.title || "");\n    }' in filter_source
    assert 'enabledOnly: true, titleKeyword: keyword || ""' in filter_source
    assert "filterRegexRuleIds" in settings_source
    assert "filterRegexMatchMode" in settings_source
    assert manifest.get("sourceRef") == expected_ref
    assert len(manifest.get("modules", [])) == (19 if mode == "--settings-tabs-beta" else 15)
    if mode == "--settings-tabs-beta":
        assert 'var settingsTab = "general";' in settings_source
        assert "function setSettingsTab(tab, origin)" in settings_source
        assert "function makeSettingsTabBar(parent, colors)" in settings_source
        assert "function settingsRootTabsActive()" in settings_source
        assert "settingsTabBarPresent: rootTabsActive" in settings_source
        assert "settingsGeneralTabVisible: rootTabsActive &&" in settings_source
        assert "settingsHomeTabVisible: rootTabsActive &&" in settings_source
        assert "settingsTranslationTabVisible: rootTabsActive &&" in settings_source
        assert "settingsFilterTabVisible: rootTabsActive &&" in settings_source
        assert "performSetSettingsTab: function (tab)" in settings_source
        assert "performSettingsBack: function ()" in settings_source
        assert "Settings24 ES5 loader" not in settings_loader
        ui_shell_source = actual_sources["ch_16_ui_shell.js"]
        translation_source = actual_sources["ch_12_translation.js"]
        assert "danger ? colors.danger" in translation_source
        assert "danger ? colors.dangerSoft" in translation_source
        assert "translation_chrome_unified_v1" in translation_source
        editor_source = actual_sources["ch_10_editor.js"]
        assert "function addEditorStandaloneDragSlot(parent, colors, chrome)" in editor_source
        assert "addEditorStandaloneDragSlot" in editor_source
        assert "editor_chrome_unified_v1" in editor_source
        tokenizer_source = actual_sources["ch_17_tokenizer_ui.js"]
        tokenizer_loader_source = (root / "src/ch_17_tokenizer_ui.js").read_text(encoding="utf-8")
        tokenizer_core_source = actual_sources["ch_18_tokenizer_core.js"]
        tokenizer_service_source = actual_sources["ch_19_tokenizer_service.js"]
        list_source = actual_sources["ch_09_list.js"]
        assert 'MODULE_NAME: "ch_16_ui_shell"' in ui_shell_source
        assert "MODULE_VERSION: 7" in ui_shell_source
        assert 'migrationStage: "primary_window_settings_regex_translation_editor_tags_tokenizer_detail_filter_overlay_closed_runtime_diagnostics"' in ui_shell_source
        assert 'registerPage({ id: "filter"' not in ui_shell_source
        assert 'MODULE_VERSION: 7' in ui_shell_source
        assert 'primaryWindowMode: true' in ui_shell_source
        assert 'legacyWindowBridge: true' in ui_shell_source
        assert "mountPrimaryChildPage" in filter_source
        assert "unmountPrimaryChildPage" in filter_source
        assert "getPrimaryHostState" in filter_source
        assert "        showPanel: showPanel," not in filter_source
        assert re.search(
            r"showPanel:\s*function\s*\(options\)\s*\{\s*"
            r"options\s*=\s*options\s*\|\|\s*\{\};\s*"
            r"options\.rootMode\s*=\s*true;\s*"
            r"return\s+showPanel\(options\);\s*\}",
            filter_source,
            re.S,
        )
        assert "function createAdvancedDrawerBundle(colors, counts)" in filter_source
        assert "resultBodyFrame.addView(nextBundle.container" in filter_source
        assert 'state.lastBackLayer = "advanced_drawer"' in filter_source
        assert 'registerPage({ id: "filter"' not in ui_shell_source
        assert "embeddedInPrimary" in settings_source
        assert "syncSettingsShellPage" in settings_source
        assert "openEmbeddedSettingsPage" in settings_source
        assert "translationEmbeddedInPrimary" in translation_source
        assert 'ClipHub.UIShell.mountPage("translation"' in translation_source
        assert 'registerPage({ id: "home"' in ui_shell_source
        assert 'registerPage({ id: "settings"' in ui_shell_source
        assert 'registerPage({ id: "regex_rules"' in ui_shell_source
        assert 'registerPage({ id: "editor"' in ui_shell_source
        assert 'registerPage({ id: "translation"' in ui_shell_source
        assert 'registerPage({ id: "tokenizer", parentId: "editor"' in ui_shell_source
        assert 'registerPage({ id: "tokenizer_rules", parentId: "tokenizer"' in ui_shell_source
        assert 'registerPage({ id: "tokenizer_rule_editor", parentId: "tokenizer_rules"' in ui_shell_source
        assert 'registerPage({ id: "detail", parentId: "home"' in ui_shell_source
        assert 'legacySurface: "detail", shellReady: true' in ui_shell_source
        assert 'ClipHub.UIShell.canEmbed("detail")' in list_source
        assert 'ClipHub.UIShell.mountPage("detail"' in list_source
        assert "detailEmbeddedInPrimary" in list_source
        assert "detail_chrome_unified_v1" in list_source
        assert "buildDetailView(row, true)" in list_source
        assert "buildDetailView(row, false)" in list_source
        assert "detailWindowManager.addView(detailWindowRoot, detailParams)" in list_source
        assert "ClipHub.Clipboard.writeText(String(detailRow.content)" in list_source
        assert "ClipHub.Editor.openItem(Number(row.id))" in list_source
        assert "embeddedInPrimary" in editor_source
        assert "mountPrimaryEditorPage" in editor_source
        assert "syncPrimaryEditorPage" in editor_source
        assert "panelOverlayHost" in editor_source
        assert "bindEditorRoot" in tokenizer_source
        assert "editorEmbeddedInPrimary" in tokenizer_source
        assert "tokenizer_chrome_unified_v1" in tokenizer_source
        assert "value = Number(digest[index]);" in tokenizer_loader_source
        assert "value = Number(bytes[index]);" not in tokenizer_loader_source
        assert "requestTokenizerRun" in tokenizer_source
        assert "TokenizerService.tokenizeAsync" in tokenizer_source
        assert "TokenizerService.cancel" in tokenizer_source
        assert "editorPanelRoot.setPadding(0, 0, 0, 0);" in tokenizer_source
        assert 'MODULE_NAME: "ch_18_tokenizer_core"' in tokenizer_core_source
        assert "function scanRegexRanges(text, rules, options)" in tokenizer_core_source
        assert 'MODULE_NAME: "ch_19_tokenizer_service"' in tokenizer_service_source
        assert "RhinoContext.enter" in tokenizer_service_source
        assert "lateCallbackCount" in tokenizer_service_source
        assert "getWorkerProbeSpec" in tokenizer_service_source
        assert "tokenizer_rule_config_isolated_v1" in tokenizer_source
        assert "tokenizer_rule_management_pages_v1" in tokenizer_source
        assert "tokenizer_rule_drawer_v1" in tokenizer_source
        assert "tokenizer_rule_preview_uses_runtime_v1" in tokenizer_source
        assert "tokenizer_toolbar_three_actions_v1" in tokenizer_source
        assert "function createTokenizerRulesDrawerBundle()" in tokenizer_source
        assert "function applyTokenizerRuleSelection()" in tokenizer_source
        assert "function openTokenizerRuleEditorDrawer(rule)" in tokenizer_source
        assert "function buildTokenizerRuleEditorPage(column)" in tokenizer_source
        assert "function showTokenizerMoreMenu()" in tokenizer_source
        assert "TokenizerService.setSelectedRuleIds" in tokenizer_source
        assert "TokenizerService.tokenizeWithRulesAsync" in tokenizer_source
        assert "保存并参与" not in tokenizer_source
        assert "创建规则副本" not in tokenizer_source
        assert "预制" not in tokenizer_source
        assert "自定义" not in tokenizer_source
        assert "已参与" in tokenizer_source
        regex_home = re.search(r"function buildRegexBody\(\).*?function applyModeStyles", tokenizer_source, re.S)
        assert regex_home is not None
        assert "regexTitleInput" not in regex_home.group(0)
        assert "输入分词正则表达式" not in regex_home.group(0)
        toolbar_block = re.search(r"function buildToolbar\(column\).*?function buildHint", tokenizer_source, re.S)
        assert toolbar_block is not None
        assert toolbar_block.group(0).count("makeToolbarCell(") == 3
        assert "清空" not in toolbar_block.group(0)
        assert "listRuleConfigs" in tokenizer_service_source
        assert "toggleRuleSelection" in tokenizer_service_source
        assert "setSelectedRuleIds" in tokenizer_service_source
        assert "getDefaultSelectedRuleIds" in tokenizer_service_source
        assert "upsertRuleConfig" in tokenizer_service_source
        assert "resetRuleOverride" in tokenizer_service_source
        assert "ruleOverrides" in tokenizer_service_source
        assert "RULE_SCHEMA_VERSION = 2" in tokenizer_service_source
        assert "预制分词规则不可覆盖" not in tokenizer_service_source
        assert "deleteRuleConfig" in tokenizer_service_source
        assert 'RULE_STORAGE_NAMESPACE = "cliphub_tokenizer_rules_v1"' in tokenizer_service_source
        assert 'RULE_FILE_NAME = "tokenizer_rules_v1.json"' in tokenizer_service_source
        assert "context.runtimeDir" in tokenizer_service_source
        assert "getSharedPreferences" not in tokenizer_service_source
        assert "Context.MODE_PRIVATE" not in tokenizer_service_source
        assert "tokenizerRulesIsolatedFromFilter: true" in tokenizer_service_source
        assert "selectedRuleIdsJson" in tokenizer_service_source
        assert "settings.regexMode" in tokenizer_service_source
        assert 'settings.gapMode = mode === "regex" ? "raw" : "fallback"' in tokenizer_service_source
        assert '"raw-gap"' in tokenizer_core_source
        assert "function emitGap(text, start, end, out, gapMode)" in tokenizer_core_source
        assert "regex_rules" not in tokenizer_service_source
        assert "ClipHub.Repository" not in tokenizer_service_source
        assert 'syncTokenizerShell("tokenizer"' in tokenizer_source
        assert '"ch_16_ui_shell.js"' in entry
        assert 'function buildLifecyclePlan(context)' in app
        assert 'uiShell: uiShell' in app
        assert 'runtimePlan = context && context.runtimePlan' in app
        assert 'runtimeDiagnostics: runtimeDiagnostics' in app
        assert 'RUNTIME_DIAGNOSTIC_SCHEMA_VERSION = 1' in ui_shell_source
        assert 'getRuntimeDiagnostics: getRuntimeDiagnostics' in ui_shell_source
        assert 'var ENTRY_VERSION = 8;' in entry
        assert 'https://api.github.com/repos/' in entry
        assert 'application/vnd.github.raw+json' in entry
        assert 'function fetchApiFile(path, ref)' in entry
        assert 'function fetchRemoteFile(path, ref)' in entry
        assert 'remoteTransportState.rawSuppressed = true;' in entry
        assert 'remote = fetchRemoteFile(String(item.path), ref);' in entry
        assert 'remoteFile = fetchRemoteFile(MANIFEST_PATH, ref);' in entry
        assert 'installed.transport = remoteTransportLabel();' in entry
        assert entry.count('fetchRawFile(') == 2
        assert entry.count('fetchRemoteFile(') >= 3
        print("Bootstrap dual transport contracts: passed")
        print("UI shell stage7 contracts: passed")
        print("Settings tabs safety contracts: passed")
    print("Regex beta safety contracts: passed")
if mode in ("--current", "--main"):
    print("Current safety contracts: passed")
PY

git diff --check

printf '\nFormal release preflight passed.\n'
printf 'Mode: %s\n' "$MODE"
