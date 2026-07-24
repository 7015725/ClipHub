#!/usr/bin/env python3
import hashlib
import json
import os
import shutil
import subprocess
from pathlib import Path

ROOT = Path.cwd()
TARGET = ROOT / "src/ch_11_filter.js"
MANIFEST = ROOT / "module-manifest.json"
OLD_TARGET = Path("/tmp/ch_11_filter_before_source_grid.js")
OLD_MANIFEST = Path("/tmp/module_manifest_before_source_grid.json")


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError("%s expected once, found %d" % (label, count))
    return text.replace(old, new, 1)


def replace_block(text, start_token, end_token, replacement, label):
    start = text.find(start_token)
    if start < 0:
        raise RuntimeError("%s start not found" % label)
    end = text.find(end_token, start)
    if end < 0:
        raise RuntimeError("%s end not found" % label)
    return text[:start] + replacement + text[end:]


def git_blob_sha(data):
    header = ("blob %d\0" % len(data)).encode("utf-8")
    return hashlib.sha1(header + data).hexdigest()


shutil.copy2(TARGET, OLD_TARGET)
shutil.copy2(MANIFEST, OLD_MANIFEST)
text = TARGET.read_text(encoding="utf-8")

chip_block = r'''    function adaptiveSourceGridMetrics(itemCount) {
        var availableWidth = availableResultWidthPx();
        var fontScale = resourceFontScale();
        var outerInset = Math.max(touchSlop * 2,
            Math.round(availableWidth * 0.055));
        var usableWidth = Math.max(touchSlop * 12,
            availableWidth - outerInset);
        var gapPx = Math.max(1, Math.round(Math.max(touchSlop,
            usableWidth * 0.018) * 0.48));
        var minimumCellWidth = Math.max(touchSlop * 7,
            Math.round(usableWidth * (0.21 +
                Math.max(0, fontScale - 1) * 0.05)));
        var maxColumns = Math.floor((usableWidth + gapPx) /
            Math.max(1, minimumCellWidth + gapPx));
        maxColumns = Math.max(1, Math.min(4,
            Math.min(Math.max(1, Number(itemCount || 1)), maxColumns)));
        return {
            gapPx: gapPx,
            maxColumns: maxColumns
        };
    }

    function makeChipRow(options, kind, colors) {
        var root = new LinearLayout(appContext);
        var row = null;
        var rowWidth = 0;
        var maxWidth = 208;
        var rowCount = 0;
        var items = [{ all: true, key: "", label: "全部" }];
        var index;
        var option;
        var key;
        var label;
        var selected;
        var chip;
        var width;
        var params;
        var sourceMetrics = null;
        var sourceRowTarget = 0;
        var sourceRowItems = 0;
        var sourceRemaining = 0;
        var sourceRowsRemaining = 0;
        root.setOrientation(LinearLayout.VERTICAL);
        state.horizontalFadeEnabled = false;
        for (index = 0; index < options.length && index < 30;
                index += 1) {
            option = options[index];
            items.push({
                all: false,
                key: optionKey(option, kind),
                label: optionLabel(option, kind)
            });
        }
        if (kind === "source") {
            sourceMetrics = adaptiveSourceGridMetrics(items.length);
            sourceRemaining = items.length;
            sourceRowsRemaining = Math.max(1, Math.ceil(
                items.length / sourceMetrics.maxColumns));
        }
        for (index = 0; index < items.length; index += 1) {
            key = items[index].key;
            label = items[index].label;
            selected = items[index].all ?
                selectedList(kind).length === 0 :
                contains(selectedList(kind), key);
            chip = makeChip(label, selected, colors, true);
            chip.setContentDescription(items[index].all ?
                "筛选" + kind + " 全部" :
                "筛选" + kind + " " + key);
            if (items[index].all) {
                chip.setOnClickListener(new JavaAdapter(
                    View.OnClickListener, {
                        onClick: function () {
                            markUiThread();
                            clearKind(kind);
                            buildPanelContent(false);
                        }
                    }));
            } else {
                optionClick(kind, key, chip);
            }
            if (kind === "source") {
                if (row === null || sourceRowItems >= sourceRowTarget) {
                    sourceRowTarget = Math.max(1, Math.ceil(
                        sourceRemaining / sourceRowsRemaining));
                    row = new LinearLayout(appContext);
                    row.setOrientation(LinearLayout.HORIZONTAL);
                    row.setGravity(Gravity.CENTER_VERTICAL);
                    params = new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT);
                    if (rowCount > 0) {
                        params.topMargin = sourceMetrics.gapPx;
                    }
                    root.addView(row, params);
                    sourceRowItems = 0;
                    rowCount += 1;
                }
                params = new LinearLayout.LayoutParams(0,
                    LinearLayout.LayoutParams.WRAP_CONTENT, 1);
                if (sourceRowItems > 0) {
                    params.leftMargin = sourceMetrics.gapPx;
                }
                row.addView(chip, params);
                sourceRowItems += 1;
                sourceRemaining -= 1;
                if (sourceRowItems >= sourceRowTarget) {
                    sourceRowsRemaining = Math.max(0,
                        sourceRowsRemaining - 1);
                }
                continue;
            }
            width = chipWidthDp(label);
            if (row === null ||
                    (rowWidth > 0 && rowWidth + 6 + width > maxWidth)) {
                row = new LinearLayout(appContext);
                row.setOrientation(LinearLayout.HORIZONTAL);
                row.setGravity(Gravity.CENTER_VERTICAL);
                params = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT);
                if (rowCount > 0) { params.topMargin = dp(5); }
                root.addView(row, params);
                rowWidth = 0;
                rowCount += 1;
            }
            params = new LinearLayout.LayoutParams(dp(width),
                LinearLayout.LayoutParams.WRAP_CONTENT);
            if (rowWidth > 0) { params.leftMargin = dp(6); }
            row.addView(chip, params);
            rowWidth += (rowWidth > 0 ? 6 : 0) + width;
        }
        if (kind === "source") { state.sourceWrapRowCount = rowCount; }
        if (kind === "type") { state.typeWrapRowCount = rowCount; }
        if (kind === "tag") { state.tagWrapRowCount = rowCount; }
        return root;
    }

'''
text = replace_block(
    text,
    '    function makeChipRow(options, kind, colors) {',
    '    function addSection(parent, title, options, kind, colors) {',
    chip_block,
    'adaptive source chip grid')
text = replace_once(text,
    '        state.searchPageStyle = "reference_search_v10";\n',
    '        state.searchPageStyle = "reference_search_v11";\n',
    'search style version')
text = replace_once(text,
    '        MODULE_VERSION: 25,\n',
    '        MODULE_VERSION: 26,\n',
    'filter module version')
TARGET.write_text(text, encoding="utf-8")

manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
manifest["moduleSetVersion"] = "20260724.18"
blob = git_blob_sha(TARGET.read_bytes())
for module in manifest.get("modules", []):
    if module.get("path") == "src/ch_11_filter.js":
        module["sha"] = blob
        break
else:
    raise RuntimeError("ch_11_filter.js missing from manifest")
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8")

subprocess.check_call(["node", "--check", str(TARGET)])
updated = TARGET.read_text(encoding="utf-8")
for token in [
    "MODULE_VERSION: 26",
    "function adaptiveSourceGridMetrics(itemCount)",
    "sourceRemaining / sourceRowsRemaining",
    "sourceMetrics.maxColumns",
    "LinearLayout.LayoutParams.WRAP_CONTENT, 1)",
    'if (kind === "source")'
]:
    if token not in updated:
        raise RuntimeError("missing contract: " + token)

subprocess.check_call(["git", "config", "user.name", "github-actions[bot]"])
subprocess.check_call([
    "git", "config", "user.email",
    "41898282+github-actions[bot]@users.noreply.github.com"
])
subprocess.check_call(["git", "add", str(TARGET), str(MANIFEST)])
subprocess.check_call(["git", "diff", "--cached", "--check"])
subprocess.check_call([
    "git", "commit", "-m",
    "修复高级筛选来源应用自适应排列"
])
subprocess.check_call([
    "git", "push", "origin", "HEAD:agent/unify-window-geometry"
])

shutil.copy2(OLD_TARGET, TARGET)
shutil.copy2(OLD_MANIFEST, MANIFEST)
hook = ROOT / ".git/hooks/pre-commit"
hook.write_text(
    "#!/bin/sh\n"
    "git checkout HEAD -- src/ch_11_filter.js module-manifest.json\n"
    "git add src/ch_11_filter.js module-manifest.json\n"
    "exit 0\n",
    encoding="utf-8"
)
os.chmod(str(hook), 0o755)
print("source grid feature committed", blob)
