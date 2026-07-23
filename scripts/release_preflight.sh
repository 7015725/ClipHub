#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="${1:---candidate}"
case "$MODE" in
  --candidate) EXPECTED_REF='agent/initialize-project-skeleton' ;;
  --main) EXPECTED_REF='main' ;;
  *)
    echo 'Usage: bash scripts/release_preflight.sh [--candidate|--main]' >&2
    exit 2
    ;;
esac

AUDIT_DIR="${TMPDIR:-$HOME/.tmp}/cliphub-release-preflight"
mkdir -p "$AUDIT_DIR"

if [ -n "$(git status --short)" ]; then
  echo 'ERROR: working tree is not clean.' >&2
  git status --short >&2
  exit 1
fi

python scripts/validate_es5.py .
python scripts/audit_color_api.py \
  --release-strict \
  --json "$AUDIT_DIR/color-findings.json" \
  | tee "$AUDIT_DIR/color-findings.txt"
grep '^HIGH=0 WARN=0 ' "$AUDIT_DIR/color-findings.txt"

python - "$EXPECTED_REF" <<'PY'
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

root = Path.cwd()
expected_ref = sys.argv[1]
manifest = json.loads((root / "module-manifest.json").read_text(encoding="utf-8"))

assert manifest.get("schemaVersion") == 1, manifest.get("schemaVersion")
assert manifest.get("moduleSetVersion") == "20260723.14", manifest.get("moduleSetVersion")
assert manifest.get("entryMinVersion") == 5, manifest.get("entryMinVersion")
assert manifest.get("sourceRef") == expected_ref, manifest.get("sourceRef")
assert len(manifest.get("modules", [])) == 15, len(manifest.get("modules", []))


def blob_sha(text: str) -> str:
    data = text.encode("utf-8")
    return hashlib.sha1(f"blob {len(data)}\0".encode("utf-8") + data).hexdigest()

seen = set()
for item in manifest["modules"]:
    name = str(item["name"])
    path = root / str(item["path"])
    assert name not in seen, name
    assert path.is_file(), path
    assert path.name == name, (path, name)
    actual = blob_sha(path.read_text(encoding="utf-8"))
    assert actual == str(item["sha"]), (name, actual, item["sha"])
    seen.add(name)

entry = (root / "ClipHub.js").read_text(encoding="utf-8")
app = (root / "src/ch_15_app.js").read_text(encoding="utf-8")
toggle = (root / "tasks/ClipHub_全局剪贴板开关.js").read_text(encoding="utf-8")
theme = (root / "src/ch_07_theme.js").read_text(encoding="utf-8")

assert re.search(r"var ENTRY_VERSION = 5;", entry)
assert re.search(r'var DEFAULT_REF = "' + re.escape(expected_ref) + r'";', entry)
assert re.search(r"var CONTROL_ENDPOINT_SCHEMA = 3;", app)
assert re.search(r"MODULE_NAME:\s*\"ch_15_app\"\s*,\s*MODULE_VERSION:\s*9", app, re.S)
assert re.search(r"var TASK_VERSION = 3;", toggle)
assert re.search(r"var REQUIRED_ENDPOINT_SCHEMA = 3;", toggle)
assert re.search(r"var MIN_ENTRY_VERSION = 5;", toggle)
assert re.search(r"MODULE_NAME:\s*\"ch_07_theme\"\s*,\s*MODULE_VERSION:\s*4", theme, re.S)
assert "getColorSafetyState: getColorSafetyState" in theme
assert not (root / "tasks/ClipHub_打开全局剪贴板.js").exists()

print("Manifest SHA verification: passed")
print("Formal task structure: background + toggle")
print("entryVersion: 5")
print("endpointSchemaVersion: 3")
print("moduleSetVersion: 20260723.14")
print("sourceRef: " + expected_ref)
print("Theme: 4")
PY

git diff --check

printf '\nFormal release preflight passed.\n'
printf 'Mode: %s\n' "$MODE"
printf 'Color audit: %s\n' "$AUDIT_DIR/color-findings.txt"
