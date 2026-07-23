#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMMIT_MODE="${1:-}"

python tools/apply_release_entry_consolidation.py
python scripts/validate_es5.py .

printf '\n===== Target diff summary =====\n'
git diff --stat -- \
  ClipHub.js \
  src/ch_15_app.js \
  module-manifest.json \
  tasks/ClipHub_全局剪贴板开关.js \
  tasks/ClipHub_打开全局剪贴板.js

printf '\n===== Required markers =====\n'
grep -n 'var ENTRY_VERSION = 5' ClipHub.js
grep -n 'moduleSetVersion: String(sync.moduleSetVersion' ClipHub.js
grep -n 'var CONTROL_ENDPOINT_SCHEMA = 3' src/ch_15_app.js
grep -n 'MODULE_VERSION: 9' src/ch_15_app.js
grep -n 'var TASK_VERSION = 3' tasks/ClipHub_全局剪贴板开关.js
grep -n 'ClipHubControlOptions' tasks/ClipHub_全局剪贴板开关.js
grep -n '"moduleSetVersion": "20260723.10"' module-manifest.json
grep -n '"entryMinVersion": 5' module-manifest.json

if grep -q 'REQUIRED_MODULE_SET' tasks/ClipHub_全局剪贴板开关.js; then
  echo 'ERROR: toggle task still hardcodes REQUIRED_MODULE_SET' >&2
  exit 1
fi

if [ -e tasks/ClipHub_打开全局剪贴板.js ]; then
  echo 'ERROR: obsolete open-only task still exists' >&2
  exit 1
fi

if [ "$COMMIT_MODE" = "--commit" ]; then
  git add -- \
    ClipHub.js \
    src/ch_15_app.js \
    module-manifest.json \
    tasks/ClipHub_全局剪贴板开关.js \
    tasks/ClipHub_打开全局剪贴板.js
  git commit -m 'refactor: consolidate background entry and UI toggle'
  git push origin agent/initialize-project-skeleton
  echo 'Committed and pushed release entry consolidation.'
else
  echo 'Dry application complete. Re-run with --commit after reviewing the diff.'
fi
