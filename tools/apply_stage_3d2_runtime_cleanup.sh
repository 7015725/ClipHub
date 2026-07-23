#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

ROOT="${HOME}/ClipHub"
BRANCH="agent/initialize-project-skeleton"
COMMIT_MODE="${1:-}"

cd "$ROOT"

CURRENT_BRANCH="$(git branch --show-current)"
if [ "$CURRENT_BRANCH" != "$BRANCH" ]; then
    echo "Wrong branch: $CURRENT_BRANCH"
    echo "Expected: $BRANCH"
    exit 1
fi

if [ -n "$(git status --short -- src/ch_10_editor.js src/ch_13_settings.js module-manifest.json)" ]; then
    echo "Target files already have local changes:"
    git status --short -- src/ch_10_editor.js src/ch_13_settings.js module-manifest.json
    exit 1
fi

python3 tools/apply_stage_3d2_runtime_cleanup.py
python3 scripts/validate_es5.py src
git diff --check -- src/ch_10_editor.js src/ch_13_settings.js module-manifest.json

echo
echo "===== Target diff summary ====="
git diff --stat -- src/ch_10_editor.js src/ch_13_settings.js module-manifest.json

echo
echo "===== Required markers ====="
grep -nE 'MODULE_VERSION: 12|nextEditorImePollDelay|postEditorViewCallback|imePollIdleCount' src/ch_10_editor.js | head -n 12
grep -nE 'MODULE_VERSION: 11|nextSettingsImePollDelay|postSettingsViewCallback|imePollIdleCount' src/ch_13_settings.js | head -n 14
grep -n '20260723.09' module-manifest.json

if [ "$COMMIT_MODE" = "--commit" ]; then
    git add src/ch_10_editor.js src/ch_13_settings.js module-manifest.json
    git commit -m "refactor: close stage 3D2 runtime callback gaps"
    git push origin "$BRANCH"
    echo "Committed and pushed stage 3D2 runtime cleanup."
else
    echo "Dry run complete. Re-run with --commit to commit and push."
fi
