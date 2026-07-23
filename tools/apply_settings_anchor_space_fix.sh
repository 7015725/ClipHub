#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [ "$(git branch --show-current)" != "agent/initialize-project-skeleton" ]; then
  echo "Wrong branch: $(git branch --show-current)" >&2
  exit 1
fi

python3 tools/apply_settings_anchor_space_fix.py

echo
echo "===== Target diff summary ====="
git diff --stat -- src/ch_13_settings.js module-manifest.json

echo
echo "===== Required markers ====="
grep -nE 'MODULE_VERSION: 9|function ensureSectionAnchorSpace|sectionAnchorSpacer = new View|sectionAnchorSpacerHeightDp' src/ch_13_settings.js
grep -n '20260723.07' module-manifest.json

if [ "${1:-}" = "--commit" ]; then
  git add src/ch_13_settings.js module-manifest.json
  git commit -m "fix: provide settings section anchor scroll space"
  git push origin agent/initialize-project-skeleton
  echo "Committed and pushed Settings v9 anchor-space fix."
fi
