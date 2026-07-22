#!/usr/bin/env bash
set -euo pipefail
python3 .github/cliphub-stage3d2-5-fix/apply.py
node --check src/ch_13_settings.js
python3 - <<'PY'
from pathlib import Path
import re
text = Path('src/ch_13_settings.js').read_text(encoding='utf-8')
if re.search(r'(?m)^\s*(?:let|const)\s+', text) or '=>' in text or '`' in text:
    raise SystemExit('Settings contains forbidden ES6 syntax')
for marker in [
    'MODULE_VERSION: 7',
    'rebuildTagPage();',
    'reference_settings_v2',
    'deleteRequiresConfirmation: true'
]:
    if marker not in text:
        raise SystemExit('missing marker: ' + marker)
PY
git diff --check
git config user.name "ClipHub Automation"
git config user.email "actions@github.com"
git add src/ch_13_settings.js module-manifest.json \
  docs/阶段3D2-5标签设置定位修复.md
git commit -m "fix: preserve tag settings section after mutations"
git push origin HEAD:agent/initialize-project-skeleton
