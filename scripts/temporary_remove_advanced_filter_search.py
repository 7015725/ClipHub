#!/usr/bin/env python3
from pathlib import Path
import json
import subprocess

source_path = Path('src/ch_11_filter.js')
manifest_path = Path('module-manifest.json')
text = source_path.read_text(encoding='utf-8')

replacements = [
    ('var CACHE_VERSION = "v30";', 'var CACHE_VERSION = "v31";'),
    ('var newVersion = "        MODULE_VERSION: 30,\\n";',
     'var newVersion = "        MODULE_VERSION: 31,\\n";'),
    ('source.indexOf("MODULE_VERSION: 30") < 0',
     'source.indexOf("MODULE_VERSION: 31") < 0')
]
for old, new in replacements:
    if old not in text:
        raise SystemExit('missing replacement site: ' + old)
    text = text.replace(old, new)

var_site = '''        var first;\n        var second;\n'''
var_replacement = '''        var oldAdvancedSearch =\n            "        params = new LinearLayout.LayoutParams(\\n" +\n            "            LinearLayout.LayoutParams.MATCH_PARENT, dp(40));\\n" +\n            "        params.bottomMargin = dp(9);\\n" +\n            "        drawer.addView(buildAdvancedKeywordInput(colors), params);\\n";\n        var newAdvancedSearch =\n            "        advancedKeywordInput = null;\\n" +\n            "        state.advancedKeywordInputPresent = false;\\n";\n        var first;\n        var second;\n        var third;\n'''
if text.count(var_site) != 1:
    raise SystemExit('compact variable insertion site mismatch')
text = text.replace(var_site, var_replacement, 1)

version_site = '''        source = source.substring(0, second) + newVersion +\n            source.substring(second + oldVersion.length);\n\n'''
version_replacement = '''        source = source.substring(0, second) + newVersion +\n            source.substring(second + oldVersion.length);\n\n        third = source.indexOf(oldAdvancedSearch);\n        if (third < 0 || source.indexOf(oldAdvancedSearch,\n                third + oldAdvancedSearch.length) >= 0) {\n            throw new Error("Advanced filter search contract site mismatch");\n        }\n        source = source.substring(0, third) + newAdvancedSearch +\n            source.substring(third + oldAdvancedSearch.length);\n\n'''
if text.count(version_site) != 1:
    raise SystemExit('compact patch insertion site mismatch')
text = text.replace(version_site, version_replacement, 1)

validation_old = '''                source.indexOf("advancedView = statusFilter;") < 0 ||\n                source.indexOf(\n                    "reference_search_v12_compact_header") < 0) {'''
validation_new = '''                source.indexOf("advancedView = statusFilter;") < 0 ||\n                source.indexOf(\n                    "drawer.addView(buildAdvancedKeywordInput(colors), params);") >= 0 ||\n                source.indexOf(\n                    "state.advancedKeywordInputPresent = false;") < 0 ||\n                source.indexOf(\n                    "reference_search_v12_compact_header") < 0) {'''
if text.count(validation_old) != 2:
    raise SystemExit('compact validation site count mismatch')
text = text.replace(validation_old, validation_new)

source_path.write_text(text, encoding='utf-8')
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
manifest['moduleSetVersion'] = '20260724.26'
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
