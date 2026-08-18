from pathlib import Path

preflight_path = Path('scripts/release_preflight.sh')
preflight = preflight_path.read_text(encoding='utf-8')
marker = "Current release preflight: passed"
if marker not in preflight:
    anchor = '''python3 - \\\n  "$MODE" \\\n'''
    block = '''# --current is branch-agnostic: validate the active schema/hash contract and\n# run the complete tokenizer/navigation regression suite without pinning an\n# historical release's module versions or sourceRef.\nif [ "$MODE" = '--current' ]; then\n  python3 scripts/manifest_contract.py validate --current\n  bash scripts/run_tokenizer_regression_suite.sh\n  echo 'Current release preflight: passed'\n  exit 0\nfi\n\n'''
    if anchor not in preflight:
        raise SystemExit('release preflight anchor missing')
    preflight = preflight.replace(anchor, block + anchor, 1)
    preflight_path.write_text(preflight, encoding='utf-8')
