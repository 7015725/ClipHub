#!/usr/bin/env python3
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

EXPECTED_MODULE_SET = "20260815.02"
NEXT_MODULE_SET = "20260815.03"
EXPECTED_BLOBS = {
    "src/ch_10_editor.js": "1edaae4fbb3bca6440083286987e99d022b05d34",
    "src/ch_12_translation.js": "4e25e984f7ccd69b148727d278cf5170dee168b5",
    "src/ch_17_tokenizer_ui.js": "682e108c58997bcfb42a1edcd97feddce9aae11c",
}


def blob_sha(data):
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit("%s anchor count=%d" % (label, count))
    return text.replace(old, new, 1)


def verify_baseline():
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if manifest.get("moduleSetVersion") != EXPECTED_MODULE_SET:
        raise SystemExit("unexpected moduleSetVersion: " + str(manifest.get("moduleSetVersion")))
    if manifest.get("sourceRef") != "beta-regex-settings-tabs-20260814":
        raise SystemExit("unexpected sourceRef")
    by_path = {item["path"]: item for item in manifest["modules"]}
    for path, expected in EXPECTED_BLOBS.items():
        data = (ROOT / path).read_bytes()
        actual = blob_sha(data)
        if actual != expected or by_path[path]["sha"] != expected:
            raise SystemExit("baseline drift %s actual=%s manifest=%s" % (
                path, actual, by_path[path]["sha"]))
    return manifest


def patch_editor():
    text = EDITOR.read_text(encoding="utf-8")
    text = replace_once(text,
        '        titleTextView = makeText(isNew ? "新增剪贴板" : "编辑剪贴板",\n            18, colors.textPrimary, true);',
        '        titleTextView = makeText(isNew ? "新增剪贴板" : "编辑剪贴板",\n            17, colors.textPrimary, true);',
        "editor title size")
    text = replace_once(text,
        '        header.addView(headerCloseView,\n            new LinearLayout.LayoutParams(dp(38), dp(38)));\n        params = new LinearLayout.LayoutParams(\n            LinearLayout.LayoutParams.MATCH_PARENT,\n            LinearLayout.LayoutParams.WRAP_CONTENT);\n        params.bottomMargin = dp(10);',
        '        header.addView(headerCloseView,\n            new LinearLayout.LayoutParams(dp(36), dp(36)));\n        params = new LinearLayout.LayoutParams(\n            LinearLayout.LayoutParams.MATCH_PARENT, dp(36));\n        params.bottomMargin = dp(6);',
        "editor header geometry")
    text = replace_once(text,
        '        params = new LinearLayout.LayoutParams(0, dp(42), 1);\n        params.rightMargin = dp(8);\n        footer.addView(cancelView, params);',
        '        params = new LinearLayout.LayoutParams(0, dp(42), 1);\n        params.rightMargin = dp(6);\n        footer.addView(cancelView, params);',
        "editor footer gap")
    text = replace_once(text,
        '        MODULE_NAME: "ch_10_editor",\n        MODULE_VERSION: 25,',
        '        MODULE_NAME: "ch_10_editor",\n        MODULE_VERSION: 26,',
        "editor module version")
    EDITOR.write_text(text, encoding="utf-8")


def patch_translation():
    text = TRANSLATION.read_text(encoding="utf-8")
    text = replace_once(text,
        '    function translationButton(text, colors, primary, danger) {\n        var view = translationText(text, 10,\n            danger ? "#FFB42323" : (primary ? "#FFFFFFFF" : colors.accentStrong),\n            primary || danger);',
        '    function translationButton(text, colors, primary, danger) {\n        var view = translationText(text, 12,\n            danger ? "#FFB42323" : (primary ? "#FFFFFFFF" : colors.accentStrong),\n            true);',
        "translation action typography")
    text = replace_once(text,
        '            primary ? colors.accentStrong : colors.accentBorder, 11));',
        '            primary ? colors.accentStrong : colors.accentBorder, 13));',
        "translation action radius")
    text = replace_once(text,
        '        var title = translationText("翻译结果", 18, colors.textPrimary, true);\n        var originalLabel = translationText("原文", 11,\n            colors.textSecondary, true);\n        var resultLabel = translationText("译文", 11,',
        '        var title = translationText("翻译结果", 17, colors.textPrimary, true);\n        var originalLabel = translationText("原文", 12,\n            colors.textSecondary, true);\n        var resultLabel = translationText("译文", 12,',
        "translation header and section typography")
    text = replace_once(text,
        '        header.addView(translationHeaderCloseView,\n            new LinearLayout.LayoutParams(dp(38), dp(38)));\n        params = new LinearLayout.LayoutParams(\n            LinearLayout.LayoutParams.MATCH_PARENT, dp(42));\n        params.bottomMargin = dp(5);',
        '        header.addView(translationHeaderCloseView,\n            new LinearLayout.LayoutParams(dp(36), dp(36)));\n        params = new LinearLayout.LayoutParams(\n            LinearLayout.LayoutParams.MATCH_PARENT, dp(36));\n        params.bottomMargin = dp(6);',
        "translation header geometry")
    text = replace_once(text,
        '        params = new LinearLayout.LayoutParams(0, dp(38), 1);\n        params.rightMargin = dp(6);\n        actionRow2.addView(translationRetryView, params);\n        actionRow2.addView(translationFooterCloseView,\n            new LinearLayout.LayoutParams(0, dp(38), 1));\n        params = new LinearLayout.LayoutParams(\n            LinearLayout.LayoutParams.MATCH_PARENT, dp(38));',
        '        params = new LinearLayout.LayoutParams(0, dp(42), 1);\n        params.rightMargin = dp(6);\n        actionRow2.addView(translationRetryView, params);\n        actionRow2.addView(translationFooterCloseView,\n            new LinearLayout.LayoutParams(0, dp(42), 1));\n        params = new LinearLayout.LayoutParams(\n            LinearLayout.LayoutParams.MATCH_PARENT, dp(42));',
        "translation secondary row height")
    text = replace_once(text,
        '        MODULE_NAME: "ch_12_translation",\n        MODULE_VERSION: 14,',
        '        MODULE_NAME: "ch_12_translation",\n        MODULE_VERSION: 15,',
        "translation module version")
    TRANSLATION.write_text(text, encoding="utf-8")


def unpack_tokenizer(loader):
    sha_match = re.search(r'var\s+SOURCE_SHA256\s*=\s*"([0-9a-f]+)";', loader)
    assignment = re.search(r'var\s+PACKED_B64\s*=\s*(.*?);\s*\n\s*function\s+hexSha256', loader, re.S)
    if sha_match is None or assignment is None:
        raise SystemExit("tokenizer loader contract missing")
    pieces = re.findall(r'"(?:\\.|[^"\\])*"', assignment.group(1))
    encoded = ''.join(json.loads(piece) for piece in pieces)
    source = gzip.decompress(base64.b64decode(encoded)).decode("utf-8")
    actual = hashlib.sha256(source.encode("utf-8")).hexdigest()
    if actual != sha_match.group(1):
        raise SystemExit("tokenizer source integrity mismatch")
    return source


def repack_tokenizer(loader, source):
    source_sha = hashlib.sha256(source.encode("utf-8")).hexdigest()
    packed = gzip.compress(source.encode("utf-8"), compresslevel=9, mtime=0)
    encoded = base64.b64encode(packed).decode("ascii")
    chunks = [encoded[i:i + 100] for i in range(0, len(encoded), 100)]
    assignment = 'var PACKED_B64 =\n' + ' +\n'.join('    ' + json.dumps(chunk) for chunk in chunks) + ';'
    loader = re.sub(r'var\s+SOURCE_SHA256\s*=\s*"[0-9a-f]+";',
                    'var SOURCE_SHA256 = "%s";' % source_sha, loader, count=1)
    loader, count = re.subn(r'var\s+PACKED_B64\s*=\s*.*?;\s*\n(?=\s*function\s+hexSha256)',
                            assignment + '\n', loader, count=1, flags=re.S)
    if count != 1:
        raise SystemExit("tokenizer packed assignment replace failed")
    return loader, source_sha


def patch_tokenizer():
    loader = TOKENIZER.read_text(encoding="utf-8")
    source = unpack_tokenizer(loader)
    source = replace_once(source,
        '        var title = makeText("分词", 18, colors.textPrimary, true);',
        '        var title = makeText("分词", 17, colors.textPrimary, true);',
        "tokenizer title size")
    source = replace_once(source,
        '        header.addView(back,\n            new LinearLayout.LayoutParams(dp(38), dp(38)));',
        '        header.addView(back,\n            new LinearLayout.LayoutParams(dp(36), dp(36)));',
        "tokenizer back size")
    source = replace_once(source,
        '        right.addView(rule,\n            new LinearLayout.LayoutParams(dp(38), dp(38)));\n        params = new LinearLayout.LayoutParams(dp(38), dp(38));\n        params.leftMargin = dp(4);\n        right.addView(help, params);\n        header.addView(right,\n            new LinearLayout.LayoutParams(\n                LinearLayout.LayoutParams.WRAP_CONTENT, dp(38)));\n        params = new LinearLayout.LayoutParams(\n            LinearLayout.LayoutParams.MATCH_PARENT, dp(42));\n        params.bottomMargin = dp(5);',
        '        right.addView(rule,\n            new LinearLayout.LayoutParams(dp(36), dp(36)));\n        params = new LinearLayout.LayoutParams(dp(36), dp(36));\n        params.leftMargin = dp(6);\n        right.addView(help, params);\n        header.addView(right,\n            new LinearLayout.LayoutParams(\n                LinearLayout.LayoutParams.WRAP_CONTENT, dp(36)));\n        params = new LinearLayout.LayoutParams(\n            LinearLayout.LayoutParams.MATCH_PARENT, dp(36));\n        params.bottomMargin = dp(6);',
        "tokenizer header geometry")
    source = replace_once(source,
        '        var labelView = makeText(label, 9.5,\n            danger ? colors.danger : colors.textPrimary, false);',
        '        var labelView = makeText(label, 12,\n            danger ? colors.danger : colors.textPrimary, true);',
        "tokenizer toolbar typography")
    source = replace_once(source,
        '            danger ? colors.danger : colors.stroke, 10);',
        '            danger ? colors.danger : colors.stroke, 13);',
        "tokenizer toolbar radius")
    source = source.replace('        params.rightMargin = dp(4);\n        toolbar.addView(makeToolbarCell("▣", "复制", "copy", false), params);',
                            '        params.rightMargin = dp(6);\n        toolbar.addView(makeToolbarCell("▣", "复制", "copy", false), params);', 1)
    source = source.replace('        params.rightMargin = dp(4);\n        toolbar.addView(makeToolbarCell("↵", "输入", "input", false), params);',
                            '        params.rightMargin = dp(6);\n        toolbar.addView(makeToolbarCell("↵", "输入", "input", false), params);', 1)
    source = source.replace('        params.rightMargin = dp(4);\n        toolbar.addView(makeToolbarCell("✎", "编辑", "edit", false), params);',
                            '        params.rightMargin = dp(6);\n        toolbar.addView(makeToolbarCell("✎", "编辑", "edit", false), params);', 1)
    source = source.replace('        params.rightMargin = dp(4);\n        toolbar.addView(makeToolbarCell("⇩", "导出", "export", false), params);',
                            '        params.rightMargin = dp(6);\n        toolbar.addView(makeToolbarCell("⇩", "导出", "export", false), params);', 1)
    if 'pageColumn.setPadding(dp(8), dp(2), dp(8), dp(3));' in source:
        source = source.replace('pageColumn.setPadding(dp(8), dp(2), dp(8), dp(3));',
                                'pageColumn.setPadding(dp(12), dp(2), dp(12), dp(3));', 1)
    elif 'pageColumn.setPadding(dp(12), dp(2), dp(12), dp(3));' not in source:
        raise SystemExit("tokenizer page padding contract changed")
    loader, source_sha = repack_tokenizer(loader, source)
    TOKENIZER.write_text(loader, encoding="utf-8")
    pathlib.Path('/tmp/tokenizer_ui_round2_source.js').write_text(source, encoding='utf-8')
    return source_sha


def update_manifest(manifest):
    manifest["moduleSetVersion"] = NEXT_MODULE_SET
    paths = set(EXPECTED_BLOBS)
    blobs = {}
    for item in manifest["modules"]:
        if item["path"] in paths:
            data = (ROOT / item["path"]).read_bytes()
            item["sha"] = blob_sha(data)
            blobs[item["path"]] = item["sha"]
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return blobs


def main():
    manifest = verify_baseline()
    patch_editor()
    patch_translation()
    tokenizer_source_sha = patch_tokenizer()
    blobs = update_manifest(manifest)
    print("editor_blob=" + blobs["src/ch_10_editor.js"])
    print("translation_blob=" + blobs["src/ch_12_translation.js"])
    print("tokenizer_blob=" + blobs["src/ch_17_tokenizer_ui.js"])
    print("tokenizer_source_sha256=" + tokenizer_source_sha)
    print("moduleSetVersion=" + NEXT_MODULE_SET)


if __name__ == "__main__":
    main()
