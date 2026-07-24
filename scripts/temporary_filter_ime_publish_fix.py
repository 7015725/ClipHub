#!/usr/bin/env python3
from pathlib import Path
import json
import subprocess

source_path = Path('src/ch_11_filter.js')
manifest_path = Path('module-manifest.json')
text = source_path.read_text(encoding='utf-8')

bad = '            "                    \\"筛选(\\" + String(activeAdvancedFilterCount()) + \\"\\" :\\n" +\n'
good = '            "                    \\"筛选(\\" + String(activeAdvancedFilterCount()) + \\"){\\" :\\n" +\n'
good = good.replace('){\\"', ')\\"')
if bad not in text:
    raise SystemExit('malformed compact probe line not found exactly once')
if text.count(bad) != 1:
    raise SystemExit('malformed compact probe line count mismatch')
text = text.replace(bad, good, 1)
source_path.write_text(text, encoding='utf-8')

manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
manifest['moduleSetVersion'] = '20260724.25'
blob = subprocess.check_output(
    ['git', 'hash-object', str(source_path)], text=True).strip()
for item in manifest.get('modules', []):
    if item.get('path') == 'src/ch_11_filter.js':
        item['sha'] = blob
        break
else:
    raise SystemExit('filter manifest entry missing')
manifest_path.write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + '\n',
    encoding='utf-8')
