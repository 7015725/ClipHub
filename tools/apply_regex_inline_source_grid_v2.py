#!/usr/bin/env python3
from __future__ import annotations

import pathlib

import apply_regex_inline_filter_layout as base

UI_BLOCK = (
    base.ROOT / "tools" / "regex_beta_patches" /
    "filter_regex_inline_source_grid.jsfrag"
)


def fail(message: str) -> None:
    raise RuntimeError(message)


def patch_filter() -> str:
    loader, variable, canonical = base.unpack_loader(base.FILTER)
    if "MODULE_VERSION: 78" not in canonical:
        fail("unexpected Filter baseline version")

    canonical = base.replace_picker_ui_block(
        canonical, "filter canonical"
    )

    canonical = base.replace_once(
        canonical,
        '''    function createAdvancedDrawerBundle(colors, counts) {
        if (regexPickerVisible) {
            return makeRegexPickerDrawerBundle(colors);
        }
        var bundle = {''',
        '''    function createAdvancedDrawerBundle(colors, counts) {
        regexPickerVisible = false;
        var bundle = {''',
        "remove Regex picker subpage routing",
    )

    canonical = base.replace_once(
        canonical,
        '''        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(8);
        content.addView(makeRegexAdvancedEntry(colors), params);

        sortRow = makeChoiceChipRow([''',
        '''        addRegexInlineSection(content, colors, bundle);

        sortRow = makeChoiceChipRow([''',
        "embed Regex source-style grid",
    )

    canonical = base.replace_once(
        canonical,
        '''        if (advancedVisible && regexPickerVisible) {
            state.backLayerCloseCount += 1;
            state.lastBackLayer = "regex_picker";
            return closeRegexPicker();
        }
''',
        "",
        "remove Regex picker back layer",
    )

    canonical = base.replace_once(
        canonical,
        "MODULE_VERSION: 78",
        "MODULE_VERSION: 79",
        "Filter module version",
    )

    required = (
        "function makeRegexSourceStyleGrid(",
        "adaptiveSourceGridMetrics(items.length)",
        "addRegexInlineSection(content, colors, bundle);",
        "regexRulePickerLabel(rule)",
        "refreshRegexInlineSelection(bundle, colors)",
        "commitRegexDraft();",
        "function startRegexScan(",
        "function regexResultPageResult(",
        "MAX_REGEX_CACHE_ENTRIES = 8",
        "MAX_REGEX_CACHE_IDS = 16000",
        "regexScanGeneration",
    )
    for marker in required:
        if marker not in canonical:
            fail("required Filter contract missing: " + marker)

    forbidden = (
        "return makeRegexPickerDrawerBundle(colors);",
        "content.addView(makeRegexAdvancedEntry(colors), params);",
        'state.lastBackLayer = "regex_picker";',
    )
    for marker in forbidden:
        if marker in canonical:
            fail("legacy Regex child-page contract remains: " + marker)

    return base.repack_loader(
        base.FILTER, loader, variable, canonical
    )


def main() -> None:
    if not UI_BLOCK.is_file():
        fail("Regex source-grid UI fragment missing")
    ui = UI_BLOCK.read_text(encoding="utf-8")
    if "function makeRegexSourceStyleGrid(" not in ui:
        fail("Regex source-grid marker missing")
    if "adaptiveSourceGridMetrics(items.length)" not in ui:
        fail("source grid metrics reuse missing")

    base.INLINE_FUNCTION = ui.rstrip() + "\n"
    base.patch_fragment()
    loader = patch_filter()
    base.update_manifest(loader)
    base.update_preflight()

    print("Regex inline source-style grid generated")
    print("moduleSetVersion: 20260813.08")
    print("Filter MODULE_VERSION: 79")
    print("Filter blob SHA:", base.git_blob_sha(loader))


if __name__ == "__main__":
    main()
