#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="${1:---current}"
case "$MODE" in
  --current) ;;
  --main) ;;
  *)
    echo 'Usage: bash scripts/release_preflight.sh [--current|--main]' >&2
    exit 2
    ;;
esac

if [ "$MODE" = '--main' ] && [ -n "$(git status --short)" ]; then
  echo 'ERROR: --main requires a clean working tree.' >&2
  git status --short >&2
  exit 1
fi

AUDIT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/cliphub-release-preflight.XXXXXX")"
trap 'rm -rf "$AUDIT_DIR"' EXIT HUP INT TERM

python3 scripts/validate_es5.py .

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
for path in sorted(Path("src").glob("*.js")):
    text = path.read_text(encoding="utf-8")
    match = re.search(r"\bvar\s+(?:PACKED_B64|encoded)\s*=\s*(.*?);", text, re.S)
    source = text
    if match is not None:
        pieces = re.findall(r'"(?:\\.|[^"\\])*"', match.group(1))
        source = gzip.decompress(
            base64.b64decode("".join(json.loads(piece) for piece in pieces))
        ).decode("utf-8")
    (out / path.name).write_text(source, encoding="utf-8")
PYJS
for expanded_js in "$PACKED_SYNTAX_DIR"/*.js; do
  node --check "$expanded_js" >/dev/null
done
echo 'Expanded JS syntax verification: passed'

python3 scripts/audit_color_api.py \
  --release-strict \
  --json "$AUDIT_DIR/color-findings.json" \
  | tee "$AUDIT_DIR/color-findings.txt"
grep '^HIGH=0 WARN=0 ' "$AUDIT_DIR/color-findings.txt"

python3 scripts/manifest_contract.py validate "$MODE"
python3 scripts/test_manifest_contract.py

python3 - "$MODE" <<'PY'
import base64
import gzip
import json
import os
import re
import subprocess
import sys
from pathlib import Path

mode = sys.argv[1]
root = Path.cwd()
manifest = json.loads((root / "module-manifest.json").read_text(encoding="utf-8"))
entry = (root / "ClipHub.js").read_text(encoding="utf-8")


def expanded(path):
    source = path.read_text(encoding="utf-8")
    match = re.search(r"\bvar\s+(?:PACKED_B64|encoded)\s*=\s*(.*?);", source, re.S)
    if match is None:
        return source
    pieces = re.findall(r'"(?:\\.|[^"\\])*"', match.group(1))
    encoded = "".join(json.loads(piece) for piece in pieces)
    return gzip.decompress(base64.b64decode(encoded)).decode("utf-8")


source_ref = str(manifest["sourceRef"])
default_ref_match = re.search(r'\bvar DEFAULT_REF = "([^"]+)";', entry)
assert default_ref_match is not None, "ClipHub.js DEFAULT_REF missing"
assert default_ref_match.group(1) == source_ref, (
    default_ref_match.group(1), source_ref
)

checkout_ref = os.environ.get("GITHUB_HEAD_REF", "").strip()
if not checkout_ref and os.environ.get("GITHUB_EVENT_NAME") == "push":
    checkout_ref = os.environ.get("GITHUB_REF_NAME", "").strip()
if not checkout_ref:
    checkout_ref = subprocess.check_output(
        ["git", "branch", "--show-current"], text=True
    ).strip()
if mode == "--main":
    assert source_ref == "main", source_ref
    if os.environ.get("GITHUB_EVENT_NAME") == "push" and checkout_ref:
        assert checkout_ref == "main", checkout_ref
elif checkout_ref:
    assert source_ref == checkout_ref, (source_ref, checkout_ref)

manifest_names = [str(item["name"]) for item in manifest["modules"]]
source_names = sorted(path.name for path in (root / "src").glob("ch_*.js"))
assert sorted(manifest_names) == source_names, {
    "manifest_only": sorted(set(manifest_names) - set(source_names)),
    "source_only": sorted(set(source_names) - set(manifest_names)),
}
assert manifest.get("resources") == [], "unused production resources declared"

sources = {
    name: expanded(root / "src" / name)
    for name in manifest_names
}
combined = "\n".join(sources.values())
assert "function buildLifecyclePlan(context)" in sources["ch_15_app.js"]
assert "runtimePlan = context && context.runtimePlan" in sources["ch_15_app.js"]
assert "MODULE_VERSION: 4" in sources["ch_20_visibility_intent_guard.js"]
assert "function uninstallHooks()" in sources["ch_20_visibility_intent_guard.js"]
assert "function hideClipHubAfterGoogleLaunch()" in sources["ch_12_translation.js"]
assert 'hideUi("google_translation_launched")' in sources["ch_12_translation.js"]
assert "ClipHub.Translation" not in sources["ch_05_classifier.js"]
assert "removeViewImmediate(" not in combined
assert re.search(
    r"Looper\.getMainLooper\(\)\s*===|===\s*Looper\.getMainLooper\(\)",
    combined,
) is None

print("Runtime package/reference contracts: passed")
print("releaseMode: " + mode)
print("sourceRef: " + source_ref)
print("moduleSetVersion: " + str(manifest["moduleSetVersion"]))
print("moduleCount: " + str(len(manifest_names)))
PY

bash scripts/run_navigation_regression_suite.sh
bash scripts/run_tokenizer_regression_suite.sh
python3 scripts/test_translation_provider_contract.py

git diff --check

printf '\nFormal release preflight passed.\n'
printf 'Mode: %s\n' "$MODE"
