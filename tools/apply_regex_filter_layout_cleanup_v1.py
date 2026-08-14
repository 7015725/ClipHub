#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re

import apply_regex_inline_filter_layout as base

OLD_SET = "20260813.08"
NEW_SET = "20260813.09"
OLD_FILTER_VERSION = 79
NEW_FILTER_VERSION = 80
EXPECTED_FILTER_BLOB = "80f1761089a9728e8e3ccbae7246dc175ab9cd2e"
EXPECTED_CANONICAL_SHA256 = (
    "579887b6e073abc92c820f05eb665d4a24000db25910510567c371dcc17c986c"
)

TITLE_ONLY_LABEL = '''    function regexRulePickerLabel(rule) {
        return String(rule && rule.title || "");
    }'''

LATEST_ONLY_SORT = '''    function validateSortMode(mode) {
        return "latest";
    }'''


def replace_named_function(text: str, name: str, replacement: str,
                           label: str) -> str:
    marker = "    function " + name + "("
    start = text.find(marker)
    if start < 0:
        base.fail(label + ": function start missing")
    if text.find(marker, start + 1) >= 0:
        base.fail(label + ": duplicate function")
    end = text.find("\n    function ", start + len(marker))
    if end < 0:
        base.fail(label + ": next function boundary missing")
    return text[:start] + replacement.rstrip() + text[end:]


def remove_advanced_sort_section(text: str, label: str) -> str:
    marker = "        sortRow = makeChoiceChipRow(["
    start = text.find(marker)
    if start < 0:
        base.fail(label + ": sort row start missing")
    if text.find(marker, start + 1) >= 0:
        base.fail(label + ": duplicate sort row start")
    end_pattern = re.compile(
        r'\n\s*addChoiceSection\(\s*content\s*,\s*"排序方式"\s*,\s*'
        r'sortRow\s*,\s*\d+\s*,\s*colors\s*\)\s*;\s*\n',
        re.S,
    )
    match = end_pattern.search(text, start)
    if match is None:
        base.fail(label + ": sort section end missing")
    block = text[start:match.end()]
    for required in ("最新优先", "置顶优先", "来源应用"):
        if required not in block:
            base.fail(label + ": unexpected sort block, missing " + required)
    return text[:start] + text[match.end():]


def assert_title_only_label(text: str, label: str) -> None:
    if TITLE_ONLY_LABEL not in text:
        base.fail(label + ": title-only label contract missing")
    start = text.find("    function regexRulePickerLabel(rule) {")
    end = text.find("\n    function ", start + 1)
    block = text[start:end]
    if "rule.note" in block or " · " in block:
        base.fail(label + ": note/description still exposed in Regex label")


def patch_fragment() -> None:
    text = base.FRAGMENT.read_text(encoding="utf-8")
    text = replace_named_function(
        text,
        "regexRulePickerLabel",
        TITLE_ONLY_LABEL,
        "Regex feature fragment label",
    )
    assert_title_only_label(text, "Regex feature fragment")
    base.FRAGMENT.write_text(text, encoding="utf-8")


def patch_filter() -> str:
    loader, variable, canonical = base.unpack_loader(base.FILTER)
    baseline_blob = base.git_blob_sha(loader)
    if baseline_blob != EXPECTED_FILTER_BLOB:
        base.fail("unexpected Filter79 baseline blob: " + baseline_blob)
    baseline_sha = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    if baseline_sha != EXPECTED_CANONICAL_SHA256:
        base.fail("unexpected Filter79 canonical SHA256: " + baseline_sha)

    canonical = replace_named_function(
        canonical,
        "regexRulePickerLabel",
        TITLE_ONLY_LABEL,
        "Filter canonical Regex label",
    )
    canonical = replace_named_function(
        canonical,
        "validateSortMode",
        LATEST_ONLY_SORT,
        "Filter canonical sort normalization",
    )
    canonical = remove_advanced_sort_section(
        canonical,
        "Filter canonical advanced drawer",
    )
    canonical = base.replace_once(
        canonical,
        "MODULE_VERSION: " + str(OLD_FILTER_VERSION),
        "MODULE_VERSION: " + str(NEW_FILTER_VERSION),
        "Filter module version",
    )

    assert_title_only_label(canonical, "Filter canonical")
    if LATEST_ONLY_SORT not in canonical:
        base.fail("latest-only sort normalization missing")
    if 'addChoiceSection(content, "排序方式"' in canonical:
        base.fail("advanced sort section remains")
    if "        sortRow = makeChoiceChipRow([" in canonical:
        base.fail("advanced sort chip row remains")

    # Preserve all non-target advanced-filter behavior and the compatibility
    # sort field/API. The validator forces every caller to latest.
    required = [
        "sortMode: validateSortMode(input.sortMode)",
        "setSortMode: function (mode, options)",
        "addRegexInlineSection(content, colors, bundle);",
        "正则规则（多选）",
        "任意规则 OR",
        "全部规则 AND",
        "置顶状态",
        "敏感内容",
        "来源应用（多选）",
        "function startRegexScan(",
        "function regexResultPageResult(",
        "MAX_REGEX_CACHE_ENTRIES = 8",
        "MAX_REGEX_CACHE_IDS = 16000",
    ]
    for marker in required:
        if marker not in canonical:
            base.fail("non-target contract missing: " + marker)

    return base.repack_loader(base.FILTER, loader, variable, canonical)


def update_manifest(loader: str) -> None:
    manifest = json.loads(base.MANIFEST.read_text(encoding="utf-8"))
    if manifest.get("moduleSetVersion") != OLD_SET:
        base.fail(
            "unexpected moduleSetVersion: " +
            str(manifest.get("moduleSetVersion"))
        )
    if manifest.get("sourceRef") != "beta-regex-filter-20260813":
        base.fail("unexpected sourceRef")
    entries = [
        item for item in manifest.get("modules", [])
        if item.get("name") == "ch_11_filter.js"
    ]
    if len(entries) != 1:
        base.fail("manifest Filter entry mismatch")
    entries[0]["sha"] = base.git_blob_sha(loader)
    manifest["moduleSetVersion"] = NEW_SET
    base.MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def update_preflight() -> None:
    text = base.PREFLIGHT.read_text(encoding="utf-8")
    old_expected = "EXPECTED_MODULE_SET='" + OLD_SET + "'"
    if text.count(old_expected) != 2:
        base.fail("Regex preflight moduleSet anchors changed")
    text = text.replace(
        old_expected,
        "EXPECTED_MODULE_SET='" + NEW_SET + "'",
    )
    text = base.replace_once(
        text,
        '"ch_11_filter.js": ("ch_11_filter", 79),',
        '"ch_11_filter.js": ("ch_11_filter", 80),',
        "Regex preflight Filter version",
    )
    old_contract = '''    assert ".matcher(text).matches()" not in filter_source
    assert ".matcher(text).find()" in filter_source
    assert "filterRegexRuleIds" in settings_source'''
    new_contract = '''    assert ".matcher(text).matches()" not in filter_source
    assert ".matcher(text).find()" in filter_source
    assert 'addChoiceSection(content, "排序方式"' not in filter_source
    assert "        sortRow = makeChoiceChipRow([" not in filter_source
    assert ''' + repr(LATEST_ONLY_SORT) + ''' in filter_source
    assert ''' + repr(TITLE_ONLY_LABEL) + ''' in filter_source
    assert 'enabledOnly: true, titleKeyword: keyword || ""' in filter_source
    assert "filterRegexRuleIds" in settings_source'''
    text = base.replace_once(
        text,
        old_contract,
        new_contract,
        "Regex preflight advanced-filter cleanup contracts",
    )
    base.PREFLIGHT.write_text(text, encoding="utf-8")


def main() -> None:
    patch_fragment()
    loader = patch_filter()
    update_manifest(loader)
    update_preflight()
    canonical_sha = hashlib.sha256(
        base.unpack_loader(base.FILTER)[2].encode("utf-8")
    ).hexdigest()
    print("Regex advanced-filter cleanup generated")
    print("moduleSetVersion:", NEW_SET)
    print("Filter MODULE_VERSION:", NEW_FILTER_VERSION)
    print("Filter canonical SHA256:", canonical_sha)
    print("Filter blob SHA:", base.git_blob_sha(loader))


if __name__ == "__main__":
    main()
