#!/usr/bin/env bash
set -euo pipefail

python3 .github/cliphub-stage3d2-5/fix_apply.py
python3 .github/cliphub-stage3d2-5/apply.py

node --check src/ch_10_editor.js
node --check src/ch_11_filter.js
node --check src/ch_13_settings.js
python3 .github/cliphub-stage3d2-5/validate.py
git diff --check

git config user.name "ClipHub Automation"
git config user.email "actions@github.com"
git add \
  src/ch_10_editor.js \
  src/ch_11_filter.js \
  src/ch_13_settings.js \
  module-manifest.json \
  docs/阶段3D2-5标签管理与选择器实施说明.md
git commit -m "feat: add transactional tag selector and visual tag manager"
git push origin HEAD:agent/initialize-project-skeleton
