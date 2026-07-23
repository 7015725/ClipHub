#!/usr/bin/env python3
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
source_path = root / "src/ch_08_window.js"
text = source_path.read_text(encoding="utf-8")

old_import = """    var Paint = Packages.android.graphics.Paint;\n    var Color = Packages.android.graphics.Color;\n"""
new_import = """    var Paint = Packages.android.graphics.Paint;\n    var Path = Packages.android.graphics.Path;\n    var Color = Packages.android.graphics.Color;\n"""
if text.count(old_import) != 1:
    raise RuntimeError("Paint import anchor was not found exactly once")
text = text.replace(old_import, new_import, 1)

old_setup = """        paint.setStyle(Paint.Style.STROKE);\n        paint.setStrokeCap(Paint.Cap.ROUND);\n        paint[\"setColor(int)\"](parseColor(colorText, \"#7C5CFC\"));\n"""
new_setup = """        paint.setStyle(Paint.Style.STROKE);\n        paint.setStrokeCap(Paint.Cap.ROUND);\n        paint.setStrokeJoin(Paint.Join.ROUND);\n        paint[\"setColor(int)\"](parseColor(colorText, \"#7C5CFC\"));\n"""
if text.count(old_setup) != 1:
    raise RuntimeError("Resize paint setup anchor was not found exactly once")
text = text.replace(old_setup, new_setup, 1)

old_draw = """            draw: function (canvas) {\n                var width = Number(canvas.getWidth());\n                var height = Number(canvas.getHeight());\n                var right = width - dp(6);\n                var bottom = height - dp(6);\n                var index;\n                var length;\n                var offset;\n                paint.setStrokeWidth(dp(visual.active ? 2.2 : 1.5));\n                paint.setAlpha(Math.floor((visual.active ? 205 : 78) *\n                    Number(visual.alpha || 1)));\n                for (index = 0; index < 3; index += 1) {\n                    length = dp(7 + index * 5);\n                    offset = dp(index * 4);\n                    canvas.drawLine(right - length, bottom - offset,\n                        right - offset, bottom - length, paint);\n                }\n            },\n"""
new_draw = """            draw: function (canvas) {\n                var width = Number(canvas.getWidth());\n                var height = Number(canvas.getHeight());\n                var right = width - dp(9);\n                var bottom = height - dp(9);\n                var outerPath = new Path();\n                var innerPath = new Path();\n\n                paint.setStrokeWidth(dp(visual.active ? 1.65 : 1.05));\n                paint.setAlpha(Math.floor((visual.active ? 176 : 58) *\n                    Number(visual.alpha || 1)));\n\n                outerPath.moveTo(right - dp(15), bottom - dp(4));\n                outerPath.quadTo(right - dp(5.5), bottom - dp(4),\n                    right - dp(4), bottom - dp(15));\n                innerPath.moveTo(right - dp(10), bottom - dp(4));\n                innerPath.quadTo(right - dp(5), bottom - dp(4),\n                    right - dp(4), bottom - dp(10));\n\n                canvas.drawPath(outerPath, paint);\n                canvas.drawPath(innerPath, paint);\n            },\n"""
if text.count(old_draw) != 1:
    raise RuntimeError("Three-line resize grip draw block was not found exactly once")
text = text.replace(old_draw, new_draw, 1)

if text.count('MODULE_VERSION: 9') != 1:
    raise RuntimeError("Expected ch_08_window module version 9 exactly once")
text = text.replace('MODULE_VERSION: 9', 'MODULE_VERSION: 10', 1)
source_path.write_text(text, encoding="utf-8")

manifest_path = root / "module-manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
if manifest.get("moduleSetVersion") != "20260724.03":
    raise RuntimeError("Expected moduleSetVersion 20260724.03")
manifest["moduleSetVersion"] = "20260724.04"
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
