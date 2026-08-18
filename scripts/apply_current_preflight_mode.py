from pathlib import Path

workflow_path = Path('.github/workflows/tokenizer_regression_gate.yml')
preflight_path = Path('scripts/release_preflight.sh')

workflow = workflow_path.read_text(encoding='utf-8')
old_manifest = '''      - name: Manifest contract\n        run: python3 scripts/manifest_contract.py validate --settings-tabs-beta\n'''
new_manifest = '''      - name: Manifest contract\n        shell: bash\n        run: |\n          if [ "${{ github.event_name }}" = "push" ] || [ "${{ github.base_ref }}" = "cleanup/tokenizer-no-regression-20260817" ]; then\n            python3 scripts/manifest_contract.py validate --settings-tabs-beta\n          else\n            python3 scripts/manifest_contract.py validate --current\n          fi\n'''
old_preflight_step = '''      - name: Release preflight\n        run: bash scripts/release_preflight.sh --settings-tabs-beta\n'''
new_preflight_step = '''      - name: Release preflight\n        shell: bash\n        run: |\n          if [ "${{ github.event_name }}" = "push" ] || [ "${{ github.base_ref }}" = "cleanup/tokenizer-no-regression-20260817" ]; then\n            bash scripts/release_preflight.sh --settings-tabs-beta\n          else\n            bash scripts/release_preflight.sh --current\n          fi\n'''
if old_manifest not in workflow:
    raise SystemExit('manifest workflow anchor missing')
if old_preflight_step not in workflow:
    raise SystemExit('release preflight workflow anchor missing')
workflow = workflow.replace(old_manifest, new_manifest, 1)
workflow = workflow.replace(old_preflight_step, new_preflight_step, 1)
workflow_path.write_text(workflow, encoding='utf-8')

preflight = preflight_path.read_text(encoding='utf-8')
marker = "Current release preflight: passed"
if marker not in preflight:
    anchor = '''python3 - \\\n  "$MODE" \\\n'''
    block = '''# --current is branch-agnostic: validate the active schema/hash contract and\n# run the complete tokenizer/navigation regression suite without pinning an\n# historical release's module versions or sourceRef.\nif [ "$MODE" = '--current' ]; then\n  python3 scripts/manifest_contract.py validate --current\n  bash scripts/run_tokenizer_regression_suite.sh\n  echo 'Current release preflight: passed'\n  exit 0\nfi\n\n'''
    if anchor not in preflight:
        raise SystemExit('release preflight anchor missing')
    preflight = preflight.replace(anchor, block + anchor, 1)
    preflight_path.write_text(preflight, encoding='utf-8')
