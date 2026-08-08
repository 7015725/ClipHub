#!/usr/bin/env python3
from __future__ import annotations

import base64
import gzip
import hashlib
import json
import math
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEV_REF = "agent/beta-list-preview-on-demand-20260808"
BETA_REF = "beta-pagination-stage10-20260808"
STAGE1_COMMIT = "f097cc117a41aed6299f03fa569a36032bcfaaab"
STAGE1_SOURCE_BLOB = "e16953d527ef30ca935141c0e2ae36ef644a8aaf"
PREVIEW_LIMIT = 200


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8", newline="\n")


def git_blob_sha(text: str) -> str:
    data = text.encode("utf-8")
    return hashlib.sha1(
        b"blob " + str(len(data)).encode("ascii") + b"\0" + data
    ).hexdigest()


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected 1 occurrence, found {count}")
    return text.replace(old, new, 1)


def function_span(source: str, name: str) -> tuple[int, int, str]:
    match = re.search(
        r"(?m)^(?P<indent>[ \t]*)function\s+" + re.escape(name) + r"\s*\(",
        source,
    )
    if not match:
        raise RuntimeError(f"function not found: {name}")
    indent = match.group("indent")
    start = match.start()
    next_match = re.search(
        r"(?m)^" + re.escape(indent) + r"function\s+[A-Za-z0-9_$]+\s*\(",
        source[match.end():],
    )
    end = len(source) if not next_match else match.end() + next_match.start()
    return start, end, source[start:end]


def replace_function(source: str, name: str, new_block: str) -> str:
    start, end, _ = function_span(source, name)
    suffix = source[end:]
    if new_block and not new_block.endswith("\n\n"):
        new_block = new_block.rstrip("\n") + "\n\n"
    return source[:start] + new_block + suffix.lstrip("\n")


def mutate_function(source: str, name: str, mutator) -> str:
    start, end, block = function_span(source, name)
    changed = mutator(block)
    if changed == block:
        raise RuntimeError(f"function unchanged unexpectedly: {name}\n{block[:2400]}")
    return source[:start] + changed + source[end:]


def extract_packed_wrapper(wrapper: str) -> tuple[re.Match[str], str]:
    match = re.search(r"(?s)(\bvar\s+encoded\s*=\s*)(.*?)(;\s*\n)", wrapper)
    if not match:
        raise RuntimeError("encoded payload not found in Stage 1 wrapper")
    chunks = re.findall(r'"([A-Za-z0-9+/=]+)"', match.group(2))
    if not chunks:
        raise RuntimeError("encoded payload chunks missing")
    return match, "".join(chunks)


def decode_stage1_source(wrapper: str) -> str:
    _, packed = extract_packed_wrapper(wrapper)
    return gzip.decompress(base64.b64decode(packed)).decode("utf-8")


def encode_wrapper(wrapper: str, source: str) -> str:
    match, _ = extract_packed_wrapper(wrapper)
    packed = base64.b64encode(
        gzip.compress(source.encode("utf-8"), compresslevel=9, mtime=0)
    ).decode("ascii")
    chunks = [packed[i:i + 112] for i in range(0, len(packed), 112)]
    expr_lines = []
    for index, chunk in enumerate(chunks):
        tail = " +" if index + 1 < len(chunks) else ""
        expr_lines.append('        "' + chunk + '"' + tail)
    replacement = match.group(1) + "\n" + "\n".join(expr_lines) + match.group(3)
    wrapper = wrapper[:match.start()] + replacement + wrapper[match.end():]
    canonical_blob = git_blob_sha(source)
    wrapper = wrapper.replace(STAGE1_SOURCE_BLOB, canonical_blob)
    return wrapper


def preview_select_helper() -> str:
    return '''    function itemSelectColumns(previewOnly) {
        if (previewOnly !== true) {
            return "clipboard_items.*";
        }
        return [
            "clipboard_items.id",
            "substr(COALESCE(clipboard_items.content, ''), 1, " +
                LIST_PREVIEW_CHAR_LIMIT + ") AS content",
            "length(COALESCE(clipboard_items.content, '')) AS content_length",
            "CASE WHEN length(COALESCE(clipboard_items.content, '')) > " +
                LIST_PREVIEW_CHAR_LIMIT + " THEN 1 ELSE 0 END AS content_truncated",
            "clipboard_items.normalized_hash",
            "clipboard_items.content_type",
            "clipboard_items.source_package",
            "clipboard_items.source_label",
            "clipboard_items.source_uid",
            "clipboard_items.source_confidence",
            "clipboard_items.is_sensitive",
            "clipboard_items.is_pinned",
            "clipboard_items.manual_order",
            "clipboard_items.copy_count",
            "clipboard_items.created_at",
            "clipboard_items.last_copied_at",
            "clipboard_items.updated_at",
            "clipboard_items.deleted_at"
        ].join(", ");
    }

'''


def replace_projection(block: str, selector_expr: str, label: str) -> str:
    pattern = re.compile(r'"SELECT\s+clipboard_items\.\*\s+FROM\s+clipboard_items')
    matches = list(pattern.finditer(block))
    if len(matches) != 1:
        raise RuntimeError(
            f"{label}: expected one clipboard_items.* projection, found {len(matches)}\n"
            + block[:3200]
        )
    return pattern.sub(
        '"SELECT " + itemSelectColumns(' + selector_expr + ') + " FROM clipboard_items',
        block,
        count=1,
    )


def build_repository() -> None:
    pinned = subprocess.check_output(
        ["git", "show", f"{STAGE1_COMMIT}:src/ch_06_repository.js"],
        cwd=ROOT,
        text=True,
    )
    source = decode_stage1_source(pinned)

    if "var LIST_PREVIEW_CHAR_LIMIT" not in source:
        source = replace_once(
            source,
            "    var ready = false;\n",
            "    var ready = false;\n    var LIST_PREVIEW_CHAR_LIMIT = 200;\n",
            "repository preview constant",
        )
    if "function itemSelectColumns(" not in source:
        source = replace_once(
            source,
            "    function listItems(options) {\n",
            preview_select_helper() + "    function listItems(options) {\n",
            "repository preview projection helper",
        )

    source = mutate_function(
        source,
        "listItems",
        lambda block: replace_projection(
            block, "options.previewOnly === true", "listItems"
        ),
    )
    source = mutate_function(
        source,
        "listItemPage",
        lambda block: replace_projection(
            block, "options.previewOnly === true", "listItemPage"
        ),
    )

    def patch_ids(block: str) -> str:
        block2 = re.sub(
            r"function\s+listItemsByIds\s*\(\s*itemIds\s*\)",
            "function listItemsByIds(itemIds, previewOnly)",
            block,
            count=1,
        )
        if block2 == block:
            raise RuntimeError("listItemsByIds signature did not match")
        return replace_projection(block2, "previewOnly === true", "listItemsByIds")

    source = mutate_function(source, "listItemsByIds", patch_ids)

    version_count = len(re.findall(r"MODULE_VERSION\s*:\s*14\b", source))
    if version_count != 1:
        raise RuntimeError(f"Repository MODULE_VERSION 14 count={version_count}")
    source = re.sub(r"MODULE_VERSION\s*:\s*14\b", "MODULE_VERSION: 16", source, count=1)
    source = replace_once(
        source,
        "        MODULE_VERSION: 16,\n",
        "        MODULE_VERSION: 16,\n"
        "        LIST_PREVIEW_CHAR_LIMIT: LIST_PREVIEW_CHAR_LIMIT,\n"
        "        PAGINATION_STAGE1_EXPORT_FIX: true,\n",
        "repository exports",
    )

    # Full-content search must remain against the original content column.
    if "clipboard_items.content LIKE ?" not in source:
        raise RuntimeError("repository full-content keyword search predicate missing")
    if "function getItem(id, includeDeleted)" not in source or "SELECT * FROM clipboard_items" not in source:
        raise RuntimeError("repository getItem full-row path changed unexpectedly")

    wrapper = encode_wrapper(pinned, source)
    decoded_check = decode_stage1_source(wrapper)
    if decoded_check != source:
        raise RuntimeError("repository self-contained wrapper round-trip mismatch")
    write("src/ch_06_repository.js", wrapper)


def load_filter_v3() -> tuple[str, str]:
    parts = []
    for index in range(8):
        parts.append(read(f"stage-assets/pagination-stage9/ch11_full_v3_{index:02d}.b64"))
    packed = re.sub(r"\s+", "", "".join(parts))
    if sha256_text(packed) != "07b0ae4b4a41700fe5abfb6338cf9d8ab825ecde05587a408667993179a59c6f":
        raise RuntimeError("Stage 9 v3 packed SHA mismatch before modification")
    source = gzip.decompress(base64.b64decode(packed)).decode("utf-8")
    if sha256_text(source) != "0205158c6c222383add5a9ad978883dba0d61145cd740fb1200d1c3011d38c01":
        raise RuntimeError("Stage 9 v3 source SHA mismatch before modification")
    return packed, source


def inject_after_open(block: str, lines: str) -> str:
    brace = block.find("{")
    if brace < 0:
        raise RuntimeError("function opening brace missing")
    return block[:brace + 1] + "\n" + lines.rstrip("\n") + "\n" + block[brace + 1:].lstrip("\n")


def build_filter() -> None:
    _, source = load_filter_v3()

    def patch_query_options(block: str) -> str:
        if "previewOnly" in block:
            return block
        match = re.search(r"(?m)^(\s*)return\s*\{", block)
        if not match:
            raise RuntimeError("paginationQueryOptions return object missing\n" + block[:2400])
        insert_at = match.end()
        indent = match.group(1) + "    "
        return block[:insert_at] + "\n" + indent + "previewOnly: true," + block[insert_at:]

    source = mutate_function(source, "paginationQueryOptions", patch_query_options)

    def patch_hydrate(block: str) -> str:
        old = "ClipHub.Repository.listItemsByIds(rowIds)"
        if block.count(old) != 1:
            raise RuntimeError("hydrateDataWindowRange listItemsByIds anchor mismatch\n" + block[:3200])
        return block.replace(old, "ClipHub.Repository.listItemsByIds(rowIds, true)", 1)

    source = mutate_function(source, "hydrateDataWindowRange", patch_hydrate)

    def patch_apply(block: str) -> str:
        if "previewOnly: true" in block:
            return block
        old = "ClipHub.Repository.listItems({"
        if block.count(old) != 1:
            raise RuntimeError("Filter.apply listItems object anchor mismatch\n" + block[:3600])
        return block.replace(old, old + "\n            previewOnly: true,", 1)

    source = mutate_function(source, "apply", patch_apply)

    helper = '''    function fullResultRowById(row, origin) {
        var itemId;
        var full;
        if (row === null || row === undefined) {
            return null;
        }
        itemId = Number(row.id);
        full = ClipHub.Repository.getItem(itemId, false);
        if (full === null || full === undefined) {
            state.lastError = "Result item missing: " + String(itemId) +
                " · " + String(origin || "full_row");
            return null;
        }
        return full;
    }

'''
    if "function fullResultRowById(" not in source:
        source = replace_once(
            source,
            "    function inputResultRow(",
            helper + "    function inputResultRow(",
            "Filter fullResultRowById insertion",
        )

    def patch_input(block: str) -> str:
        if "fullResultRowById(row" in block:
            return block
        injected = inject_after_open(
            block,
            '''        var full = fullResultRowById(row, "input");
        if (full === null) {
            showInputToast("记录已不存在");
            return false;
        }''',
        )
        if "row.content" not in injected:
            raise RuntimeError("inputResultRow row.content anchor missing\n" + block[:3200])
        return injected.replace("row.content", "full.content")

    source = mutate_function(source, "inputResultRow", patch_input)

    def patch_copy(block: str) -> str:
        if "fullResultRowById(row" in block:
            return block
        injected = inject_after_open(
            block,
            '''        var full = fullResultRowById(row, "copy");
        if (full === null) {
            return false;
        }''',
        )
        if "row.content" not in injected:
            raise RuntimeError("copyResultRow row.content anchor missing\n" + block[:3200])
        injected = injected.replace("row.content", "full.content")
        injected = injected.replace("row.is_sensitive", "full.is_sensitive")
        return injected

    source = mutate_function(source, "copyResultRow", patch_copy)

    preview_helper = '''    function resultPreviewText(row) {
        var text = String(row && row.content || "");
        return Number(row && row.content_truncated || 0) === 1 ?
            text + "…" : text;
    }

'''
    if "function resultPreviewText(" not in source:
        source = replace_once(
            source,
            "    function makeResultCard(",
            preview_helper + "    function makeResultCard(",
            "Filter resultPreviewText insertion",
        )

    def patch_card(block: str) -> str:
        candidates = [
            'String(row.content || "")',
            'String(row.content)',
        ]
        for old in candidates:
            if old in block:
                return block.replace(old, "resultPreviewText(row)", 1)
        raise RuntimeError("makeResultCard preview text anchor missing\n" + block[:4200])

    source = mutate_function(source, "makeResultCard", patch_card)

    def patch_snapshot(block: str) -> str:
        if "fullContentLoaded" in block:
            return block
        patterns = [
            r'(?m)^(\s*)content:\s*String\(row\.content\s*\|\|\s*""\)(\s*,?)$',
            r'(?m)^(\s*)content:\s*String\(row\.content\)(\s*,?)$',
            r'(?m)^(\s*)content:\s*row\.content(\s*,?)$',
        ]
        for pattern in patterns:
            match = re.search(pattern, block)
            if match:
                indent = match.group(1)
                replacement = (
                    indent + 'content: String(row.content || ""),\n' +
                    indent + 'previewLength: String(row.content || "").length,\n' +
                    indent + 'contentLength: Number(row.content_length || 0),\n' +
                    indent + 'contentTruncated: Number(row.content_truncated || 0),\n' +
                    indent + 'fullContentLoaded: false'
                )
                return block[:match.start()] + replacement + block[match.end():]
        raise RuntimeError("dataWindowRowSnapshot content field anchor missing\n" + block[:3600])

    source = mutate_function(source, "dataWindowRowSnapshot", patch_snapshot)

    if len(re.findall(r"MODULE_VERSION\s*:\s*48\b", source)) != 1:
        raise RuntimeError("Filter MODULE_VERSION 48 anchor mismatch")
    source = re.sub(r"MODULE_VERSION\s*:\s*48\b", "MODULE_VERSION: 49", source, count=1)

    for required in [
        "VIRTUAL_BEFORE_SCREENS = 3",
        "VIRTUAL_AFTER_SCREENS = 5",
        "VIRTUAL_UPDATE_DELAY_MS = 24",
        "PAGINATION_STAGE: 9",
    ]:
        if required not in source:
            raise RuntimeError("Filter frozen constant missing: " + required)

    packed = base64.b64encode(
        gzip.compress(source.encode("utf-8"), compresslevel=9, mtime=0)
    ).decode("ascii")
    packed_sha = sha256_text(packed)
    source_sha = sha256_text(source)
    part_size = int(math.ceil(len(packed) / 8.0))
    # Keep slices deterministic and easy to concatenate. Alignment is irrelevant
    # because the loader concatenates before decoding.
    for index in range(8):
        chunk = packed[index * part_size:(index + 1) * part_size]
        write(f"stage-assets/pagination-stage9/ch11_full_v4_{index:02d}.b64", chunk + "\n")

    loader = read("src/ch_11_filter.js")
    loader = replace_once(loader, f'var REF = "{BETA_REF}";', f'var REF = "{DEV_REF}";', "Filter loader ref")
    for index in range(8):
        loader = replace_once(
            loader,
            f"stage-assets/pagination-stage9/ch11_full_v3_{index:02d}.b64",
            f"stage-assets/pagination-stage9/ch11_full_v4_{index:02d}.b64",
            f"Filter part {index}",
        )
    loader = replace_once(
        loader,
        "07b0ae4b4a41700fe5abfb6338cf9d8ab825ecde05587a408667993179a59c6f",
        packed_sha,
        "Filter packed SHA",
    )
    loader = replace_once(
        loader,
        "0205158c6c222383add5a9ad978883dba0d61145cd740fb1200d1c3011d38c01",
        source_sha,
        "Filter source SHA",
    )
    loader = replace_once(
        loader,
        "ch_11_filter_stage9_v3_full.b64",
        "ch_11_filter_stage9_v4_full.b64",
        "Filter cache name",
    )
    loader = loader.replace("?stage9v3=", "?stage9v4=")
    write("src/ch_11_filter.js", loader)


def build_list() -> None:
    source = read("src/ch_09_list.js")

    source = replace_function(
        source,
        "isLongText",
        '''function isLongText(row) {
var contentLength = Number(row && row.content_length || 0);
var content = String(row && row.content !== undefined ?
row.content : "");
if (contentLength > LONG_TEXT_THRESHOLD) { return true; }
return content.length > LONG_TEXT_THRESHOLD ||
content.split("\\n").length >= LONG_TEXT_LINE_THRESHOLD;
}''',
    )

    def patch_copy(block: str) -> str:
        if "ClipHub.Repository.getItem" in block:
            return block
        block = block.replace("var result;\n", "var result;\nvar full;\n", 1)
        marker = "try {\n"
        if marker not in block:
            raise RuntimeError("List.copyRow try anchor missing\n" + block[:2600])
        block = block.replace(
            marker,
            marker +
            "full = ClipHub.Repository.getItem(Number(row.id), false);\n" +
            "if (full === null || full === undefined) { return false; }\n",
            1,
        )
        if "row.content" not in block:
            raise RuntimeError("List.copyRow content anchor missing")
        block = block.replace("row.content", "full.content")
        block = block.replace("row.is_sensitive", "full.is_sensitive")
        return block

    source = mutate_function(source, "copyRow", patch_copy)

    source = replace_once(
        source,
        "return openDetail(items[index], true);",
        "return ClipHub.List.openDetail(Number(items[index].id));",
        "List performCardOpenClick",
    )

    source = replace_once(
        source,
        "return ClipHub.Repository.listItems({ limit: limit, offset: 0 });",
        "return ClipHub.Repository.listItems({ previewOnly: true, limit: limit, offset: 0 });",
        "List fallback preview query",
    )

    if len(re.findall(r"MODULE_VERSION\s*:\s*19\b", source)) != 1:
        raise RuntimeError("List MODULE_VERSION 19 anchor mismatch")
    source = re.sub(r"MODULE_VERSION\s*:\s*19\b", "MODULE_VERSION: 20", source, count=1)
    write("src/ch_09_list.js", source)


def build_entry_and_manifest() -> None:
    entry = read("ClipHub.js")
    entry = replace_once(
        entry,
        f'var DEFAULT_REF = "{BETA_REF}";',
        f'var DEFAULT_REF = "{DEV_REF}";',
        "entry DEFAULT_REF",
    )
    write("ClipHub.js", entry)

    manifest_path = ROOT / "module-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["moduleSetVersion"] = "20260808.02"
    manifest["entryMinVersion"] = 6
    manifest["sourceRef"] = DEV_REF
    if len(manifest.get("modules", [])) != 15:
        raise RuntimeError("manifest module count changed")
    for item in manifest["modules"]:
        module_text = read(item["path"])
        item["sha"] = git_blob_sha(module_text)
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
        newline="\n",
    )


def write_docs() -> None:
    doc = f'''# ClipHub 首页 200 字符预览与完整正文按需读取 Stage 11

## 基线

- Beta 基线：`{BETA_REF}`
- 基线提交：`4eecd41e3abbc7b3293ab8bfca596322abfb05dc`
- 开发分支：`{DEV_REF}`
- 入口版本：`6`
- 模块集版本：`20260808.02`
- Repository：`16`
- List：`20`
- Filter：`49`
- `PAGINATION_STAGE`：`9`
- 模块数量：`15`

## 实现

- Repository 的 `listItems`、`listItemPage` 与 `listItemsByIds` 支持 `previewOnly`，预览查询在 SQLite 投影层执行 `substr(..., 1, 200)`，并返回 `content_length` 与 `content_truncated`。
- `getItem(id, false)` 保持完整记录读取；关键字 WHERE 仍匹配完整 `clipboard_items.content`。
- Filter 的初始分页、AJAX、数字分页、预加载、兼容查询和数据窗口水合统一启用预览模式。
- Filter 输入与复制先按 ID 读取最新完整记录，读取失败不回退预览正文；编辑、翻译继续保持原有按 ID 链路。
- 首页卡片只渲染预览正文；截断记录仅在显示层追加 `…`。
- List 复制和详情入口统一按 ID 重新读取完整记录；长文本判断优先使用 `content_length`。
- List 非 Filter 兼容查询也显式请求 `previewOnly: true`，避免首页回退路径重新拉取完整正文。

## 冻结边界

- `VIRTUAL_BEFORE_SCREENS = 3`
- `VIRTUAL_AFTER_SCREENS = 5`
- `VIRTUAL_UPDATE_DELAY_MS = 24`
- 不新增线程。
- 不修改数据库 schema。
- 不新增 `ch_16`。
- `ch_08`、`ch_10`、`ch_12`、`ch_13`、`ch_15` 保持 Beta blob 不变。

## Repository 包装说明

Beta 的 `ch_06_repository.js` 实际是 Stage 2 loader，而它固定的 Stage 1 文件又是自包含 GZIP 包装器。为保证 200 字符限制发生在 SQLite 查询层，本阶段构建器从固定 Stage 1 提交解出规范 Repository 源码，应用确定性修改后重新生成自包含模块；不会先读取完整正文再在 Rhino 中截断。

## 验证边界

GitHub 构建只完成静态/打包级校验。真机仍需验证长代码滑动、复制/输入/编辑/翻译/详情完整正文、正文第 201 字符后的搜索命中，以及 Stage 6–10 分页与位置保持回归。
'''
    write("docs/ClipHub首页200字符预览与完整正文按需读取Stage11.md", doc)


def validate() -> None:
    manifest = json.loads(read("module-manifest.json"))
    assert manifest["moduleSetVersion"] == "20260808.02"
    assert manifest["sourceRef"] == DEV_REF
    assert len(manifest["modules"]) == 15
    for item in manifest["modules"]:
        assert item["sha"] == git_blob_sha(read(item["path"])), item["name"]

    entry = read("ClipHub.js")
    assert 'var ENTRY_VERSION = 6;' in entry
    assert f'var DEFAULT_REF = "{DEV_REF}";' in entry

    repo_wrapper = read("src/ch_06_repository.js")
    repo_source = decode_stage1_source(repo_wrapper)
    assert "LIST_PREVIEW_CHAR_LIMIT = 200" in repo_source
    assert "itemSelectColumns(options.previewOnly === true)" in repo_source
    assert "function listItemsByIds(itemIds, previewOnly)" in repo_source
    assert "itemSelectColumns(previewOnly === true)" in repo_source
    assert "clipboard_items.content LIKE ?" in repo_source
    assert "MODULE_VERSION: 16" in repo_source
    assert "LIST_PREVIEW_CHAR_LIMIT: LIST_PREVIEW_CHAR_LIMIT" in repo_source

    filter_loader = read("src/ch_11_filter.js")
    assert f'var REF = "{DEV_REF}";' in filter_loader
    parts = [
        read(f"stage-assets/pagination-stage9/ch11_full_v4_{i:02d}.b64")
        for i in range(8)
    ]
    packed = re.sub(r"\s+", "", "".join(parts))
    filter_source = gzip.decompress(base64.b64decode(packed)).decode("utf-8")
    assert "MODULE_VERSION: 49" in filter_source
    assert "previewOnly: true" in filter_source
    assert "listItemsByIds(rowIds, true)" in filter_source
    assert "function fullResultRowById" in filter_source
    assert "function resultPreviewText" in filter_source
    assert "fullContentLoaded: false" in filter_source
    assert "VIRTUAL_BEFORE_SCREENS = 3" in filter_source
    assert "VIRTUAL_AFTER_SCREENS = 5" in filter_source
    assert "VIRTUAL_UPDATE_DELAY_MS = 24" in filter_source

    list_source = read("src/ch_09_list.js")
    assert "MODULE_VERSION: 20" in list_source
    assert "ClipHub.Repository.getItem(Number(row.id), false)" in list_source
    assert "ClipHub.List.openDetail(Number(items[index].id))" in list_source
    assert "previewOnly: true, limit: limit" in list_source
    assert "content_length" in list_source

    frozen = {
        "ch_08_window.js": "4ccff8067656ae51602290c884081795ec0f65ea",
        "ch_10_editor.js": "a6ef71e9f08302473a06eb1628cd471dd118d084",
        "ch_12_translation.js": "88d2bdc4658434ef9eb97fd25c3f3cab5ee14ec8",
        "ch_13_settings.js": "7826055348bfce1682e6191a29dd34cdc1bdf2f3",
        "ch_15_app.js": "ff60665e8ddd34bd96fa276cc7b632ca73a56845",
    }
    manifest_map = {item["name"]: item["sha"] for item in manifest["modules"]}
    for name, expected in frozen.items():
        assert manifest_map[name] == expected, (name, manifest_map[name], expected)

    print("Stage11 preview build validation: PASS")
    print("moduleSetVersion=20260808.02")
    print("Repository=16 List=20 Filter=49 PAGINATION_STAGE=9 modules=15")
    print("virtualBuffer=3/5 virtualUpdateDelayMs=24")


def main() -> None:
    build_repository()
    build_filter()
    build_list()
    build_entry_and_manifest()
    write_docs()
    validate()


if __name__ == "__main__":
    main()
