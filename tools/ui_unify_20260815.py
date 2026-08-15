#!/usr/bin/env python3
from __future__ import annotations

import base64
import gzip
import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "module-manifest.json"
EDITOR = ROOT / "src/ch_10_editor.js"
TRANSLATION = ROOT / "src/ch_12_translation.js"
TOKENIZER = ROOT / "src/ch_17_tokenizer_ui.js"

EXPECTED_BLOBS = {
    "src/ch_10_editor.js": "0929c76137b9b5a44a55062444393f9f06b364a8",
    "src/ch_12_translation.js": "4a5e6af14f94f90046f2652590e4a45a24803a17",
    "src/ch_17_tokenizer_ui.js": "9f8b5b9bb18b03dadeb2302dedbc5566d11cac07",
}
EXPECTED_TOKENIZER_SOURCE_SHA = (
    "3eb6f44f925e4c923a324f79225e419b7b0fea98280c768ee8820e5daa60b06e"
)


def git_blob_sha(data: bytes) -> str:
    return hashlib.sha1(
        b"blob " + str(len(data)).encode("ascii") + b"\0" + data
    ).hexdigest()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected one anchor, got {count}")
    return text.replace(old, new, 1)


def replace_function_block(
    text: str, start_name: str, next_name: str, replacement: str
) -> str:
    start_marker = "    function " + start_name + "("
    end_marker = "    function " + next_name + "("
    start = text.find(start_marker)
    if start < 0:
        raise SystemExit("missing function start: " + start_name)
    end = text.find(end_marker, start + len(start_marker))
    if end < 0:
        raise SystemExit("missing function boundary: " + next_name)
    return text[:start] + replacement.rstrip() + "\n\n" + text[end:]


def unpack_loader(loader: str) -> tuple[str, str]:
    sha_match = re.search(
        r'var\s+SOURCE_SHA256\s*=\s*"([0-9a-f]+)";', loader
    )
    assign = re.search(
        r"var\s+PACKED_B64\s*=\s*(.*?);\s*\n\s*function\s+hexSha256",
        loader,
        re.S,
    )
    if sha_match is None or assign is None:
        raise SystemExit("tokenizer packed loader contract missing")
    pieces = re.findall(r'"(?:\\.|[^"\\])*"', assign.group(1))
    encoded = "".join(json.loads(piece) for piece in pieces)
    source = gzip.decompress(base64.b64decode(encoded)).decode("utf-8")
    actual = hashlib.sha256(source.encode("utf-8")).hexdigest()
    if actual != sha_match.group(1):
        raise SystemExit("tokenizer packed integrity mismatch: " + actual)
    return source, actual


def repack_loader(loader: str, source: str) -> tuple[str, str]:
    source_sha = hashlib.sha256(source.encode("utf-8")).hexdigest()
    compressed = gzip.compress(source.encode("utf-8"), compresslevel=9, mtime=0)
    packed_b64 = base64.b64encode(compressed).decode("ascii")
    chunks = [packed_b64[i : i + 120] for i in range(0, len(packed_b64), 120)]
    lines = []
    for index, chunk in enumerate(chunks):
        suffix = " +" if index < len(chunks) - 1 else ""
        lines.append("        " + json.dumps(chunk) + suffix)
    assignment = "var PACKED_B64 =\n" + "\n".join(lines)
    loader = re.sub(
        r'var\s+SOURCE_SHA256\s*=\s*"[0-9a-f]+";',
        'var SOURCE_SHA256 = "' + source_sha + '";',
        loader,
        count=1,
    )
    loader = re.sub(
        r"var\s+PACKED_B64\s*=\s*.*?;(?=\s*\n\s*function\s+hexSha256)",
        assignment + ";",
        loader,
        count=1,
        flags=re.S,
    )
    return loader, source_sha


def verify_baseline() -> dict:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if manifest.get("moduleSetVersion") != "20260815.01":
        raise SystemExit(
            "unexpected moduleSetVersion: " + str(manifest.get("moduleSetVersion"))
        )
    if manifest.get("sourceRef") != "beta-regex-settings-tabs-20260814":
        raise SystemExit("unexpected sourceRef")
    for rel, expected in EXPECTED_BLOBS.items():
        got = git_blob_sha((ROOT / rel).read_bytes())
        if got != expected:
            raise SystemExit(f"{rel} baseline drift: {got}")
    return manifest


def patch_editor() -> None:
    text = EDITOR.read_text(encoding="utf-8")
    icon_start = '        titleIconView = makeText(isNew ? "+" : "✎", 19,'
    title_stack = "        titleStack.setOrientation(LinearLayout.VERTICAL);"
    start = text.find(icon_start)
    end = text.find(title_stack, start)
    if start < 0 or end < 0 or end <= start:
        raise SystemExit("editor title icon block boundary missing")
    icon_block = text[start:end]
    for marker in (
        "titleIconView.setGravity(Gravity.CENTER);",
        "titleIconView.setBackground(roundedBackground(",
        "header.addView(titleIconView, params);",
    ):
        if marker not in icon_block:
            raise SystemExit("editor title icon contract missing: " + marker)
    text = text[:start] + text[end:]
    text = replace_once(
        text,
        "        state.headerIconPresent = true;\n",
        "        state.headerIconPresent = false;\n",
        "editor header icon state",
    )
    text = replace_once(
        text,
        "        MODULE_VERSION: 24,\n",
        "        MODULE_VERSION: 25,\n",
        "editor module version",
    )
    EDITOR.write_text(text, encoding="utf-8")


def patch_translation() -> None:
    text = TRANSLATION.read_text(encoding="utf-8")
    helper = '''    function translationOriginalViewportDp(text) {
        var value = String(text || "");
        var lineCount = value.split("\\n").length;
        var length = value.length;
        if (lineCount <= 1 && length <= 60) { return 48; }
        if (lineCount <= 2 && length <= 140) { return 60; }
        return 76;
    }

'''
    text = replace_once(
        text,
        "    function buildTranslationPanel() {\n",
        helper + "    function buildTranslationPanel() {\n",
        "translation viewport helper",
    )
    text = replace_once(
        text,
        "        params = new LinearLayout.LayoutParams(\n"
        "            LinearLayout.LayoutParams.MATCH_PARENT, dp(96));\n"
        "        params.topMargin = dp(4);\n"
        "        params.bottomMargin = dp(7);\n"
        "        root.addView(originalScroll, params);\n",
        "        params = new LinearLayout.LayoutParams(\n"
        "            LinearLayout.LayoutParams.MATCH_PARENT,\n"
        "            dp(translationOriginalViewportDp(\n"
        "                translationState.sourceText)));\n"
        "        params.topMargin = dp(4);\n"
        "        params.bottomMargin = dp(7);\n"
        "        root.addView(originalScroll, params);\n",
        "translation original viewport",
    )
    text = replace_once(
        text,
        "        params = new LinearLayout.LayoutParams(0, dp(40), 1);\n"
        "        params.rightMargin = dp(6);\n"
        "        actionRow1.addView(translationCopyView, params);\n"
        "        actionRow1.addView(translationReplaceView, params);\n"
        "        actionRow1.addView(translationSaveView,\n"
        "            new LinearLayout.LayoutParams(0, dp(40), 1));\n"
        "        root.addView(actionRow1, new LinearLayout.LayoutParams(\n"
        "            LinearLayout.LayoutParams.MATCH_PARENT, dp(40)));\n",
        "        params = new LinearLayout.LayoutParams(0, dp(42), 1);\n"
        "        params.rightMargin = dp(6);\n"
        "        actionRow1.addView(translationCopyView, params);\n"
        "        actionRow1.addView(translationReplaceView, params);\n"
        "        actionRow1.addView(translationSaveView,\n"
        "            new LinearLayout.LayoutParams(0, dp(42), 1));\n"
        "        root.addView(actionRow1, new LinearLayout.LayoutParams(\n"
        "            LinearLayout.LayoutParams.MATCH_PARENT, dp(42)));\n",
        "translation primary action height",
    )
    text = replace_once(
        text,
        '        MODULE_NAME: "ch_12_translation",\n'
        "        MODULE_VERSION: 13,\n",
        '        MODULE_NAME: "ch_12_translation",\n'
        "        MODULE_VERSION: 14,\n",
        "translation module version",
    )
    TRANSLATION.write_text(text, encoding="utf-8")


def patch_tokenizer() -> str:
    loader = TOKENIZER.read_text(encoding="utf-8")
    source, source_sha = unpack_loader(loader)
    if source_sha != EXPECTED_TOKENIZER_SOURCE_SHA:
        raise SystemExit("unexpected tokenizer source baseline: " + source_sha)

    new_stats = '''    function buildStatsRow(parent) {
        var colors = palette();
        var row = new LinearLayout(appContext);
        var params;
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        statsLeftView = makeText("共 0 个词语", 10,
            colors.textSecondary, false);
        statsRightView = makeText("单词 0 / 符号 0", 10,
            colors.textTertiary, false);
        row.addView(statsLeftView,
            new LinearLayout.LayoutParams(0,
                LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        row.addView(statsRightView,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(30));
        parent.addView(row, params);
        updateStatsViews();
        return row;
    }'''
    source = replace_function_block(source, "buildStatsRow", "buildTokenScroll", new_stats)

    new_toolbar_cell = '''    function makeToolbarCell(icon, label, action, danger) {
        var colors = palette();
        var cell = new LinearLayout(appContext);
        var iconView = makeText(icon, 14.5,
            danger ? colors.danger : colors.icon, false);
        var labelView = makeText(label, 9.5,
            danger ? colors.danger : colors.textPrimary, false);
        cell.setOrientation(LinearLayout.VERTICAL);
        cell.setGravity(Gravity.CENTER);
        cell.setPadding(dp(2), dp(2), dp(2), dp(2));
        cell.setClickable(true);
        cell.setFocusable(true);
        cell.setContentDescription(String(label));
        applyBackground(cell,
            danger ? colors.dangerSoft : colors.surfaceMuted,
            danger ? colors.danger : colors.stroke, 10);
        iconView.setGravity(Gravity.CENTER);
        labelView.setGravity(Gravity.CENTER);
        cell.addView(iconView,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(20)));
        cell.addView(labelView,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(17)));
        cell.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { emitAction(action, {}); }
        }));
        return cell;
    }'''
    source = replace_function_block(
        source, "makeToolbarCell", "buildHeader", new_toolbar_cell
    )

    new_header = '''    function buildDragHandle(column) {
        var colors = palette();
        var row = new LinearLayout(appContext);
        var handle = new View(appContext);
        row.setGravity(Gravity.CENTER);
        applyBackground(handle, colors.accentBorder, null, 3);
        row.addView(handle,
            new LinearLayout.LayoutParams(dp(42), dp(4)));
        column.addView(row,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(16)));
    }

    function buildHeader(column) {
        var colors = palette();
        var header = new LinearLayout(appContext);
        var back = makeClickText("‹", 22, colors, "返回编辑页");
        var title = makeText("分词", 18, colors.textPrimary, true);
        var right = new LinearLayout(appContext);
        var rule = makeClickText("▣", 15, colors, "规则");
        var help = makeClickText("?", 15, colors, "帮助");
        var params;
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        back.setGravity(Gravity.CENTER);
        applyBackground(back, colors.surfaceMuted, null, 18);
        title.setGravity(Gravity.CENTER_VERTICAL);
        rule.setGravity(Gravity.CENTER);
        safeTextColor(rule, colors.accentStrong);
        applyBackground(rule, colors.accentSoft, colors.accentBorder, 18);
        help.setGravity(Gravity.CENTER);
        applyBackground(help, colors.surfaceMuted, null, 18);
        back.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { returnToEditor("header_back"); }
        }));
        rule.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { emitAction("rule", {}); }
        }));
        help.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { emitAction("help", {}); }
        }));
        header.addView(back,
            new LinearLayout.LayoutParams(dp(38), dp(38)));
        params = new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1);
        params.leftMargin = dp(8);
        params.rightMargin = dp(8);
        header.addView(title, params);
        right.setOrientation(LinearLayout.HORIZONTAL);
        right.setGravity(Gravity.CENTER_VERTICAL);
        right.addView(rule,
            new LinearLayout.LayoutParams(dp(38), dp(38)));
        params = new LinearLayout.LayoutParams(dp(38), dp(38));
        params.leftMargin = dp(4);
        right.addView(help, params);
        header.addView(right,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, dp(38)));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(42));
        params.bottomMargin = dp(5);
        column.addView(header, params);
    }'''
    source = replace_function_block(source, "buildHeader", "buildSegment", new_header)

    new_toolbar = '''    function buildToolbar(column) {
        var colors = palette();
        var toolbar = new LinearLayout(appContext);
        var params;
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(0, dp(3), 0, dp(3));
        ClipHub.Theme.applyBackgroundColor(toolbar, colors.surface);
        params = new LinearLayout.LayoutParams(0, dp(42), 1);
        params.rightMargin = dp(4);
        toolbar.addView(makeToolbarCell("▣", "复制", "copy", false), params);
        params = new LinearLayout.LayoutParams(0, dp(42), 1);
        params.rightMargin = dp(4);
        toolbar.addView(makeToolbarCell("↵", "输入", "input", false), params);
        params = new LinearLayout.LayoutParams(0, dp(42), 1);
        params.rightMargin = dp(4);
        toolbar.addView(makeToolbarCell("✎", "编辑", "edit", false), params);
        params = new LinearLayout.LayoutParams(0, dp(42), 1);
        params.rightMargin = dp(4);
        toolbar.addView(makeToolbarCell("⇩", "导出", "export", false), params);
        toolbar.addView(makeToolbarCell("⌫", "清空", "clear", true),
            new LinearLayout.LayoutParams(0, dp(42), 1));
        column.addView(toolbar,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(48)));
    }'''
    source = replace_function_block(source, "buildToolbar", "buildHint", new_toolbar)

    source = replace_once(
        source,
        "        pageColumn.setPadding(dp(8), dp(2), dp(8), dp(3));\n",
        "        pageColumn.setPadding(0, 0, 0, dp(3));\n",
        "tokenizer page padding",
    )
    source = replace_once(
        source,
        "        buildHeader(pageColumn);\n",
        "        buildDragHandle(pageColumn);\n        buildHeader(pageColumn);\n",
        "tokenizer visual drag handle",
    )
    source = replace_once(
        source,
        "        bodyContainer.setPadding(dp(4), dp(3), dp(4), 0);\n",
        "        bodyContainer.setPadding(0, dp(3), 0, 0);\n",
        "tokenizer body padding",
    )

    version_pattern = re.compile(
        r'(MODULE_NAME:\s*"ch_17_tokenizer_ui",\s*\n\s*MODULE_VERSION:\s*)(\d+)'
    )
    match = version_pattern.search(source)
    if match is None:
        raise SystemExit("tokenizer module version contract missing")
    source = source[: match.start(2)] + str(int(match.group(2)) + 1) + source[match.end(2) :]

    for marker in (
        'returnToEditor("header_back")',
        'emitAction("rule", {})',
        'emitAction("help", {})',
        "emitAction(action, {})",
        "switchMode(mode)",
        "makeTokenTouchListener(index)",
        "performToolbarClick(action)",
        "performPopupActionClick(action)",
        '"普通分词"',
        '"正则规则"',
    ):
        if marker not in source:
            raise SystemExit("tokenizer behavior contract missing: " + marker)
    if "new LinearLayout.LayoutParams(0, dp(52), 1)" in source:
        raise SystemExit("legacy tokenizer toolbar height remains")

    loader, new_source_sha = repack_loader(loader, source)
    TOKENIZER.write_text(loader, encoding="utf-8")
    pathlib.Path("/tmp/tokenizer_ui_source.js").write_text(source, encoding="utf-8")

    verify_source, verify_sha = unpack_loader(TOKENIZER.read_text(encoding="utf-8"))
    if verify_sha != new_source_sha or verify_source != source:
        raise SystemExit("repacked tokenizer verification failed")
    return new_source_sha


def update_manifest(manifest: dict) -> dict[str, str]:
    manifest["moduleSetVersion"] = "20260815.02"
    blobs = {}
    for path in (EDITOR, TRANSLATION, TOKENIZER):
        rel = path.relative_to(ROOT).as_posix()
        blobs[rel] = git_blob_sha(path.read_bytes())
    for entry in manifest.get("modules", []):
        rel = str(entry.get("path", ""))
        if rel in blobs:
            entry["sha"] = blobs[rel]
    for rel, sha in blobs.items():
        matches = [entry for entry in manifest.get("modules", []) if entry.get("path") == rel]
        if len(matches) != 1 or matches[0].get("sha") != sha:
            raise SystemExit("manifest update failed for " + rel)
    MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return blobs


def main() -> int:
    manifest = verify_baseline()
    patch_editor()
    patch_translation()
    tokenizer_source_sha = patch_tokenizer()
    blobs = update_manifest(manifest)
    print("editor_blob=" + blobs["src/ch_10_editor.js"])
    print("translation_blob=" + blobs["src/ch_12_translation.js"])
    print("tokenizer_blob=" + blobs["src/ch_17_tokenizer_ui.js"])
    print("tokenizer_source_sha256=" + tokenizer_source_sha)
    print("moduleSetVersion=20260815.02")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
