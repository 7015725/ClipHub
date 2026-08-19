#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

run_node() {
  echo "[node] $1"
  node "$1"
}

run_python() {
  echo "[python] $1"
  python3 "$1"
}

run_node scripts/test_shared_input_action.js
run_node scripts/test_tokenizer_action_contract.js
run_node scripts/test_tokenizer_copy_ingest_contract.js
run_node scripts/test_tokenizer_core.js
run_node scripts/test_tokenizer_home_long_press.js
run_node scripts/test_tokenizer_home_runtime_bridge.js
run_node scripts/test_tokenizer_icon_contract.js
run_node scripts/test_tokenizer_layout_contract.js
run_node scripts/test_tokenizer_rule_drawer_contract.js
run_node scripts/test_tokenizer_rule_schema_v2.js
run_node scripts/test_tokenizer_runtime_mount_contract.js
run_node scripts/test_tokenizer_source_state_contract.js
run_node scripts/test_tokenizer_toggle_selection_contract.js
echo "Tokenizer regression suite: all 13 contract scripts passed"
