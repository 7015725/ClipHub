#!/usr/bin/env python3
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILTER = ROOT / "src/ch_11_filter.js"
MANIFEST = ROOT / "module-manifest.json"


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError("{} expected once, found {}".format(label, count))
    return text.replace(old, new, 1)


text = FILTER.read_text(encoding="utf-8")

text = replace_once(text,
'''        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(64));
        params.topMargin = dp(4);
        params.rightMargin = rootMode ? dp(40) : 0;
        panelRoot.addView(buildBottomToolbar(colors), params);

        state.sourceChipCount = Object.keys(sourceViews).length;''',
'''        toolbarActionViews = {};
        state.toolbarEnabledCount = 0;

        state.sourceChipCount = Object.keys(sourceViews).length;''',
"remove home bottom toolbar")

text = replace_once(text,
'''        MODULE_NAME: "ch_11_filter",
        MODULE_VERSION: 21,''',
'''        MODULE_NAME: "ch_11_filter",
        MODULE_VERSION: 22,''',
"filter module version")

FILTER.write_text(text, encoding="utf-8")

manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
manifest["moduleSetVersion"] = "20260724.14"
for item in manifest["modules"]:
    path = ROOT / item["path"]
    data = path.read_bytes()
    item["sha"] = hashlib.sha1(
        b"blob " + str(len(data)).encode("ascii") + b"\0" + data
    ).hexdigest()
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8")
