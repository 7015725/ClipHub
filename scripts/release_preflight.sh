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
    EXPECTED_MODULE_SET='20260813.07'
    EXPECTED_ENTRY_VERSION='6'
    EXPECTED_APP_MODULE_VERSION='20'
    REQUIRE_CLEAN='0'
    ;;
  --regex-rc)
    EXPECTED_REF='beta-regex-filter-20260813'
    EXPECTED_MODULE_SET='20260813.07'
    EXPECTED_ENTRY_VERSION='6'
    EXPECTED_APP_MODULE_VERSION='20'
    REQUIRE_CLEAN='1'
    ;;
  --settings-tabs-beta)
    EXPECTED_REF='beta-settings-tabs-20260814'
    EXPECTED_MODULE_SET='20260814.02'
    EXPECTED_ENTRY_VERSION='6'
    EXPECTED_APP_MODULE_VERSION='20'
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

assert manifest.get("schemaVersion") == 1, manifest.get("schemaVersion")
assert manifest.get("moduleSetVersion") == expected_module_set, manifest.get("moduleSetVersion")
assert manifest.get("entryMinVersion") == expected_entry_version, manifest.get("entryMinVersion")
assert manifest.get("sourceRef") == expected_ref, manifest.get("sourceRef")
assert len(manifest.get("modules", [])) == 15, len(manifest.get("modules", []))


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
assert re.search(r"MODULE_NAME:\s*\"ch_07_theme\"\s*,\s*MODULE_VERSION:\s*4", theme, re.S)
assert "getColorSafetyState: getColorSafetyState" in theme
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
print("Theme: 4")
if mode in ("--regex-beta", "--regex-rc", "--settings-tabs-beta"):
    required_versions = {
        "ch_03_database.js": ("ch_03_database", 4),
        "ch_06_repository.js": ("ch_06_repository", 18),
        "ch_11_filter.js": ("ch_11_filter", 78),
        "ch_13_settings.js": ("ch_13_settings",
            29 if mode == "--settings-tabs-beta" else 27),
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
    assert "var SCHEMA_VERSION = 2;" in database_source
    assert "db.setVersion(3)" not in database_source
    assert "CREATE TABLE IF NOT EXISTS regex_rules" in database_source
    assert "feature.regex_rules.schema_version" in database_source
    assert "feature.regex_rules.defaults_initialized" in repository_source
    assert "listRegexCandidateChunk" in repository_source
    assert ".matcher(text).matches()" not in filter_source
    assert ".matcher(text).find()" in filter_source
    assert "filterRegexRuleIds" in settings_source
    assert "filterRegexMatchMode" in settings_source
    assert manifest.get("sourceRef") == expected_ref
    assert len(manifest.get("modules", [])) == 15
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
        print("Settings tabs safety contracts: passed")
    print("Regex beta safety contracts: passed")
if mode in ("--current", "--main"):
    print("Current safety contracts: passed")
PY

git diff --check

printf '\nFormal release preflight passed.\n'
printf 'Mode: %s\n' "$MODE"
