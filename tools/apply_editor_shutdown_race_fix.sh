#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

EXPECTED_BRANCH="agent/initialize-project-skeleton"
CURRENT_BRANCH="$(git branch --show-current)"

if [[ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]]; then
    echo "ERROR: expected branch $EXPECTED_BRANCH, current $CURRENT_BRANCH" >&2
    exit 1
fi

if ! git diff --quiet -- src/ch_10_editor.js module-manifest.json || \
   ! git diff --cached --quiet -- src/ch_10_editor.js module-manifest.json; then
    echo "ERROR: target files already contain local changes" >&2
    git status --short -- src/ch_10_editor.js module-manifest.json >&2
    exit 1
fi

python3 tools/apply_editor_shutdown_race_fix.py
python3 tools/apply_editor_shutdown_race_fix.py --check
git diff --check -- src/ch_10_editor.js module-manifest.json

echo
echo "===== Target diff summary ====="
git diff --stat -- src/ch_10_editor.js module-manifest.json

echo
echo "===== Required markers ====="
grep -n 'MODULE_VERSION: 11' src/ch_10_editor.js
grep -n 'function postEditorDelayed' src/ch_10_editor.js
grep -n 'delayedCallbackErrorCount' src/ch_10_editor.js | head
grep -n '20260723.05' module-manifest.json

if [[ "${1:-}" == "--commit" ]]; then
    git add src/ch_10_editor.js module-manifest.json
    git commit -m "fix: guard editor delayed callbacks during shutdown"
    git push origin "$EXPECTED_BRANCH"
    echo "Committed and pushed Editor v11 formal fix."
else
    echo
echo "Patch applied but not committed. Review with:"
    echo "  git diff -- src/ch_10_editor.js module-manifest.json"
    echo "Commit and push with:"
    echo "  tools/apply_editor_shutdown_race_fix.sh --commit"
fi
