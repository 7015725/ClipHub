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

node --check probes/navigation_architecture_test_page.js
node --check probes/cliphub_navigation_contract_probe_066.js

run_node scripts/test_navigation_contract_v1.js
run_node scripts/test_navigation_stage2_3_contract.js
run_node scripts/test_navigation_stage4_back_dispatcher.js
run_node scripts/test_navigation_stage5_ime_priority.js
run_node scripts/test_navigation_stage6_page_registry.js
run_node scripts/test_navigation_stage7_page_contract.js
run_node scripts/test_navigation_stage8_no_page_hardcoding.js
run_node scripts/test_navigation_stage9_factory_core.js
run_node scripts/test_navigation_stage9_zero_core_page.js
run_node scripts/test_navigation_stage9_runtime_simulation.js
run_node scripts/test_navigation_stage10_source_root.js
run_node scripts/test_navigation_stage10_legacy_hook_bridge.js
run_node scripts/test_navigation_predictive_snapshot_contract.js
run_node scripts/test_editor_transient_contract.js
run_node scripts/test_editor_ime_back_rearm.js
run_node scripts/test_system_back_gesture_contract.js
run_node scripts/test_child_back_route_contract.js
run_node scripts/test_ui_shell_navigation.js
run_node scripts/test_runtime_diagnostics.js
run_node scripts/test_visibility_intent_guard_contract.js
run_node scripts/audit_navigation_page_id_hardcoding.js
run_python scripts/test_primary_window_system_back.py
run_python scripts/test_primary_window_legacy_routes.py
run_python scripts/test_review_regressions.py

echo "Navigation regression suite: all 24 contract scripts passed"
