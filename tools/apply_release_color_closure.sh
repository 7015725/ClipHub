#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

COMMIT_MODE="${1:-}"
AUDIT_DIR="${TMPDIR:-$HOME/.tmp}/cliphub-release-color-audit"
AUDIT_TEXT="$AUDIT_DIR/findings.txt"
AUDIT_JSON="$AUDIT_DIR/findings.json"
TARGETS=(
  src/ch_07_theme.js
  scripts/audit_color_api.py
  module-manifest.json
)
PATCH_STARTED=0

rollback_on_error() {
  local status=$?
  if [ "$status" -ne 0 ] && [ "$PATCH_STARTED" -eq 1 ]; then
    echo 'Release color closure failed; restoring target files.' >&2
    git restore -- "${TARGETS[@]}" || true
  fi
  exit "$status"
}
trap rollback_on_error EXIT

if [ -n "$(git status --short -- "${TARGETS[@]}")" ]; then
  echo 'ERROR: release color target files have uncommitted changes:' >&2
  git status --short -- "${TARGETS[@]}" >&2
  exit 1
fi

mkdir -p "$AUDIT_DIR"
PATCH_STARTED=1
python tools/apply_release_color_closure.py
python scripts/validate_es5.py .
python scripts/audit_color_api.py \
  --release-strict \
  --show-safe \
  --json "$AUDIT_JSON" \
  | tee "$AUDIT_TEXT"
git diff --check

printf '\n===== Required release markers =====\n'
grep -n 'MODULE_VERSION: 4' src/ch_07_theme.js
grep -n 'Packages.android.R.attr.state_pressed' src/ch_07_theme.js
grep -n 'Packages.android.R.attr.state_focused' src/ch_07_theme.js
grep -n 'Packages.android.R.attr.state_selected' src/ch_07_theme.js
grep -n 'getColorSafetyState: getColorSafetyState' src/ch_07_theme.js
grep -n -- '--release-strict' scripts/audit_color_api.py
grep -n '"moduleSetVersion": "20260723.14"' module-manifest.json

printf '\n===== Release audit gate =====\n'
grep '^HIGH=0 WARN=0 ' "$AUDIT_TEXT"
if grep '^\[HIGH\]\|^\[WARN\]' "$AUDIT_TEXT"; then
  echo 'ERROR: release color findings remain.' >&2
  exit 1
fi
echo 'Release color audit passed: HIGH=0 WARN=0.'

printf '\n===== Forbidden numeric fallback check =====\n'
if grep -RInE \
  'setTextColor\([[:space:]]*(Color\.parseColor|0x|[0-9-])|setHintTextColor\([[:space:]]*(Color\.parseColor|0x|[0-9-])|setBackgroundColor\(|\.setTint\(|ColorStateList\.valueOf\(|new[[:space:]]+ColorDrawable\(|new[[:space:]]+PaintDrawable\(' \
  ClipHub.js src tasks; then
  echo 'ERROR: forbidden direct color path detected.' >&2
  exit 1
fi
echo 'No forbidden direct numeric color fallback.'

printf '\n===== Target diff summary =====\n'
git diff --stat -- "${TARGETS[@]}"

printf '\nAudit text: %s\n' "$AUDIT_TEXT"
printf 'Audit JSON: %s\n' "$AUDIT_JSON"

if [ "$COMMIT_MODE" = "--commit" ]; then
  git add "${TARGETS[@]}"
  git commit -m 'fix: finalize release color safety gate'
  git push origin agent/initialize-project-skeleton
  echo 'Committed and pushed final release color closure.'
else
  git diff -- "${TARGETS[@]}"
  git restore -- "${TARGETS[@]}"
  echo 'Dry preview complete; target files restored. Re-run with --commit to apply.'
fi

PATCH_STARTED=0
