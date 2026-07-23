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

python tools/apply_settings_author_blog.py
python scripts/validate_es5.py .
git diff --check

printf '\n===== Required markers =====\n'
grep -n 'var Intent = Packages.android.content.Intent' src/ch_13_settings.js
grep -n 'var Uri = Packages.android.net.Uri' src/ch_13_settings.js
grep -n 'function openAuthorBlog' src/ch_13_settings.js
grep -n '林深见鹿' src/ch_13_settings.js
grep -n 'xin-blog.com' src/ch_13_settings.js
grep -n 'MODULE_VERSION: 12' src/ch_13_settings.js
grep -n '"moduleSetVersion": "20260723.11"' module-manifest.json

printf '\n===== Target diff summary =====\n'
git diff --stat -- src/ch_13_settings.js module-manifest.json

printf '\n===== Target diff =====\n'
git diff -- src/ch_13_settings.js module-manifest.json

if [ "$COMMIT_MODE" = "--commit" ]; then
  git add src/ch_13_settings.js module-manifest.json
  git commit -m 'feat: add author blog entry to settings'
  git push origin agent/initialize-project-skeleton
  echo 'Committed and pushed settings author/blog update.'
else
  echo 'Dry application complete. Re-run with --commit after reviewing the diff.'
fi
