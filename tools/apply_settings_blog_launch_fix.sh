#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMMIT_MODE="${1:-}"

if [ -n "$(git status --short -- src/ch_13_settings.js module-manifest.json)" ]; then
  echo 'ERROR: target files have uncommitted changes:' >&2
  git status --short -- src/ch_13_settings.js module-manifest.json >&2
  exit 1
fi

python tools/apply_settings_blog_launch_fix.py
python scripts/validate_es5.py .
git diff --check

printf '\n===== Required markers =====\n'
grep -n 'function currentForegroundUserId' src/ch_13_settings.js
grep -n 'resolveActivityAsUser' src/ch_13_settings.js
grep -n 'startActivityAsUser' src/ch_13_settings.js
grep -n 'closePage("author_blog")' src/ch_13_settings.js
grep -n 'MODULE_VERSION: 13' src/ch_13_settings.js
grep -n '"moduleSetVersion": "20260723.12"' module-manifest.json

printf '\n===== Target diff summary =====\n'
git diff --stat -- src/ch_13_settings.js module-manifest.json

printf '\n===== Target diff =====\n'
git diff -- src/ch_13_settings.js module-manifest.json

if [ "$COMMIT_MODE" = "--commit" ]; then
  git add src/ch_13_settings.js module-manifest.json
  git commit -m 'fix: launch settings blog for current user'
  git push origin agent/initialize-project-skeleton
  echo 'Committed and pushed settings blog launch fix.'
else
  echo 'Dry application complete. Re-run with --commit after reviewing the diff.'
fi
