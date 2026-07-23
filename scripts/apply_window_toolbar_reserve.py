#!/usr/bin/env python3
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source_path = root / "src/ch_11_filter.js"
text = source_path.read_text(encoding="utf-8")
old = """        params = new LinearLayout.LayoutParams(\n            LinearLayout.LayoutParams.MATCH_PARENT, dp(64));\n        params.topMargin = dp(4);\n        panelRoot.addView(buildBottomToolbar(colors), params);\n"""
new = """        params = new LinearLayout.LayoutParams(\n            LinearLayout.LayoutParams.MATCH_PARENT, dp(64));\n        params.topMargin = dp(4);\n        params.rightMargin = rootMode ? dp(40) : 0;\n        panelRoot.addView(buildBottomToolbar(colors), params);\n"""
if text.count(old) != 1:
    raise RuntimeError("Bottom toolbar insertion point was not found exactly once")
text = text.replace(old, new)
if text.count('MODULE_VERSION: 16') != 1:
    raise RuntimeError("Expected ch_11_filter module version 16 exactly once")
text = text.replace('MODULE_VERSION: 16', 'MODULE_VERSION: 17', 1)
source_path.write_text(text, encoding="utf-8")

manifest_path = root / "module-manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
for item in manifest["modules"]:
    if item["name"] == "ch_11_filter.js":
        data = source_path.read_bytes()
        item["sha"] = hashlib.sha1(
            b"blob " + str(len(data)).encode("ascii") + b"\0" + data
        ).hexdigest()
        break
else:
    raise RuntimeError("ch_11_filter.js missing from manifest")
manifest_path.write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8"
)
