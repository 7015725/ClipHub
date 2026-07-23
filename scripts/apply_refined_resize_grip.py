#!/usr/bin/env python3
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source_path = root / "src/ch_08_window.js"
text = source_path.read_text(encoding="utf-8")

old_block = """                var right = width - dp(9);\n                var bottom = height - dp(9);\n                var outerPath = new Path();\n                var innerPath = new Path();\n\n                paint.setStrokeWidth(dp(visual.active ? 1.65 : 1.05));\n                paint.setAlpha(Math.floor((visual.active ? 176 : 58) *\n                    Number(visual.alpha || 1)));\n\n                outerPath.moveTo(right - dp(15), bottom - dp(4));\n                outerPath.quadTo(right - dp(5.5), bottom - dp(4),\n                    right - dp(4), bottom - dp(15));\n                innerPath.moveTo(right - dp(10), bottom - dp(4));\n                innerPath.quadTo(right - dp(5), bottom - dp(4),\n                    right - dp(4), bottom - dp(10));\n"""

new_block = """                var right = width - dp(11);\n                var bottom = height - dp(11);\n                var outerPath = new Path();\n                var innerPath = new Path();\n\n                paint.setStrokeWidth(dp(visual.active ? 1.4 : 0.9));\n                paint.setAlpha(Math.floor((visual.active ? 158 : 48) *\n                    Number(visual.alpha || 1)));\n\n                outerPath.moveTo(right - dp(14), bottom - dp(3));\n                outerPath.cubicTo(right - dp(10.4), bottom - dp(4.2),\n                    right - dp(4.2), bottom - dp(10.4),\n                    right - dp(3), bottom - dp(14));\n                innerPath.moveTo(right - dp(9.5), bottom - dp(3));\n                innerPath.cubicTo(right - dp(7.1), bottom - dp(3.9),\n                    right - dp(3.9), bottom - dp(7.1),\n                    right - dp(3), bottom - dp(9.5));\n"""

if text.count(old_block) != 1:
    raise RuntimeError("Current rounded grip block was not found exactly once")
text = text.replace(old_block, new_block, 1)

if text.count("MODULE_VERSION: 10") != 1:
    raise RuntimeError("Expected ch_08_window module version 10 exactly once")
text = text.replace("MODULE_VERSION: 10", "MODULE_VERSION: 11", 1)
source_path.write_text(text, encoding="utf-8")

manifest_path = root / "module-manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
if manifest.get("moduleSetVersion") != "20260724.04":
    raise RuntimeError("Expected moduleSetVersion 20260724.04")
manifest["moduleSetVersion"] = "20260724.05"
for item in manifest["modules"]:
    if item["name"] == "ch_08_window.js":
        data = source_path.read_bytes()
        item["sha"] = hashlib.sha1(
            b"blob " + str(len(data)).encode("ascii") + b"\0" + data
        ).hexdigest()
        break
else:
    raise RuntimeError("ch_08_window.js missing from manifest")
manifest_path.write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8"
)
