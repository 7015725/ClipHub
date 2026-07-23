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
'''    var RESULT_PAGE_SIZE = 20;
''',
'''    var RESULT_PAGE_SIZE = 20;
    var SELECTION_ENABLED = false;
''',
"selection feature flag")

text = replace_once(text,
'''    function setSelectedResult(row) {
        selectedItemId = row === null || row === undefined ?
            null : Number(row.id);
        state.selectedItemId = selectedItemId;
        state.selectionMode = selectedItemId !== null;
        return selectedItemId;
    }
''',
'''    function setSelectedResult(row) {
        selectedItemId = SELECTION_ENABLED && row !== null &&
            row !== undefined ? Number(row.id) : null;
        state.selectedItemId = selectedItemId;
        state.selectionMode = SELECTION_ENABLED && selectedItemId !== null;
        return selectedItemId;
    }
''',
"selection setter guard")

text = replace_once(text,
'''    function selectResultRow(row) {
        if (row === null || row === undefined) { return false; }
        state.resultCardLongPressCount += 1;
        setSelectedResult(row);
        if (state.panelAttached) {
            buildPanelContent(false);
        }
        return true;
    }
''',
'''    function selectResultRow(row) {
        clearSelectedResult();
        return false;
    }
''',
"disable selection action")

text = replace_once(text,
'''    function makeResultCard(row, colors) {
        var selected = selectedItemId !== null &&
            Number(selectedItemId) === Number(row.id);
''',
'''    function makeResultCard(row, colors) {
        var selected = SELECTION_ENABLED && selectedItemId !== null &&
            Number(selectedItemId) === Number(row.id);
''',
"disable selected card visual")

text = replace_once(text,
'''        card.setContentDescription(
            "剪贴板记录，点击复制，长按选择，左滑置顶，右滑删除");
        (function (target, view) {
            view.setOnClickListener(new JavaAdapter(
                View.OnClickListener, {
                    onClick: function () { copyResultRow(target); }
                }));
            view.setOnLongClickListener(new JavaAdapter(
                View.OnLongClickListener, {
                    onLongClick: function () {
                        return selectResultRow(target);
                    }
                }));
        }(row, card));
''',
'''        card.setContentDescription(
            "剪贴板记录，点击复制，左滑置顶，右滑删除");
        (function (target, view) {
            view.setOnClickListener(new JavaAdapter(
                View.OnClickListener, {
                    onClick: function () { copyResultRow(target); }
                }));
        }(row, card));
''',
"remove card long click listener")

text = replace_once(text,
'''            selectedItemId: selectedItemId,
            selectionMode: selectedItemId !== null,
''',
'''            selectedItemId: selectedItemId,
            selectionEnabled: SELECTION_ENABLED === true,
            selectionMode: SELECTION_ENABLED && selectedItemId !== null,
''',
"panel selection state")

text = replace_once(text,
'''        MODULE_NAME: "ch_11_filter",
        MODULE_VERSION: 20,
''',
'''        MODULE_NAME: "ch_11_filter",
        MODULE_VERSION: 21,
''',
"filter module version")

FILTER.write_text(text, encoding="utf-8")

manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
manifest["moduleSetVersion"] = "20260724.11"
for item in manifest["modules"]:
    path = ROOT / item["path"]
    data = path.read_bytes()
    item["sha"] = hashlib.sha1(
        b"blob " + str(len(data)).encode("ascii") + b"\0" + data
    ).hexdigest()
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8")
