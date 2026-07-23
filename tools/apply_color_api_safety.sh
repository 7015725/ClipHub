#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMMIT_MODE="${1:-}"
AUDIT_DIR="${TMPDIR:-$HOME/.tmp}/cliphub-color-audit"
AUDIT_JSON="$AUDIT_DIR/findings.json"
AUDIT_TEXT="$AUDIT_DIR/findings.txt"
TARGETS=(
  src/ch_07_theme.js
  src/ch_08_window.js
  src/ch_09_list.js
  src/ch_10_editor.js
  src/ch_11_filter.js
  src/ch_12_translation.js
  src/ch_13_settings.js
  module-manifest.json
)
PATCH_STARTED=0

rollback_on_error() {
  local status=$?
  if [ "$status" -ne 0 ] && [ "$PATCH_STARTED" -eq 1 ]; then
    echo 'Color safety validation failed; restoring target files.' >&2
    git restore -- "${TARGETS[@]}" || true
  fi
  exit "$status"
}
trap rollback_on_error EXIT

if [ -n "$(git status --short -- "${TARGETS[@]}")" ]; then
  echo 'ERROR: color safety target files have uncommitted changes:' >&2
  git status --short -- "${TARGETS[@]}" >&2
  exit 1
fi

mkdir -p "$AUDIT_DIR"
PATCH_STARTED=1
python tools/apply_color_api_safety.py
python scripts/validate_es5.py .
python scripts/audit_color_api.py \
  --strict \
  --show-safe \
  --json "$AUDIT_JSON" \
  | tee "$AUDIT_TEXT"
git diff --check

printf '\n===== Color bridge markers =====\n'
grep -n 'function safeColorStateList' src/ch_07_theme.js
grep -n 'setGradientStroke: safeSetGradientStroke' src/ch_07_theme.js
grep -n 'setPaintColor: safeSetPaintColor' src/ch_07_theme.js

printf '\n===== Unsafe direct-call check =====\n'
if grep '^\[HIGH\]' "$AUDIT_TEXT"; then
  echo 'ERROR: HIGH color findings remain.' >&2
  exit 1
fi
echo 'No HIGH color findings.'

printf '\n===== Version markers =====\n'
grep -n 'MODULE_VERSION' \
  src/ch_07_theme.js \
  src/ch_08_window.js \
  src/ch_09_list.js \
  src/ch_10_editor.js \
  src/ch_11_filter.js \
  src/ch_12_translation.js \
  src/ch_13_settings.js
grep -n '"moduleSetVersion": "20260723.13"' module-manifest.json

printf '\n===== Target diff summary =====\n'
git diff --stat -- "${TARGETS[@]}"

printf '\n===== Target diff =====\n'
git diff -- "${TARGETS[@]}"

printf '\nAudit text: %s\n' "$AUDIT_TEXT"
printf 'Audit JSON: %s\n' "$AUDIT_JSON"

if [ "$COMMIT_MODE" = "--commit" ]; then
  git add "${TARGETS[@]}"
  git commit -m 'fix: harden Rhino color API overloads'
  git push origin agent/initialize-project-skeleton
  echo 'Committed and pushed Rhino color API safety update.'
else
  echo 'Dry application complete. Re-run with --commit after reviewing the diff.'
fi

PATCH_STARTED=0
