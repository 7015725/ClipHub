#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re

import apply_regex_inline_filter_layout as base
import apply_regex_inline_source_grid_v2 as v2

EXPECTED_CANONICAL_SHA256 = (
    "579887b6e073abc92c820f05eb665d4a24000db25910510567c371dcc17c986c"
)

BACK_LAYER_PATTERN = re.compile(
    r'''\n[ \t]*if\s*\(\s*advancedVisible\s*&&\s*regexPickerVisible\s*\)\s*\{\s*'''
    r'''state\.backLayerCloseCount\s*\+=\s*1\s*;\s*'''
    r'''state\.lastBackLayer\s*=\s*["']regex_picker["']\s*;\s*'''
    r'''return\s+closeRegexPicker\s*\(\s*\)\s*;\s*'''
    r'''\}\s*''',
    re.S,
)


def main() -> None:
    v2.main()

    loader, variable, canonical = base.unpack_loader(base.FILTER)
    marker = 'state.lastBackLayer = "regex_picker";'
    print("regex_picker_back_marker_count:", canonical.count(marker))

    canonical, count = BACK_LAYER_PATTERN.subn("\n", canonical, count=1)
    if count != 1:
        base.fail(
            "remove regex picker semantic back layer: expected 1 match, got "
            + str(count)
        )

    if "regex_picker" in canonical and marker in canonical:
        base.fail("regex picker back-stack marker still present")
    if "return makeRegexPickerDrawerBundle(colors);" in canonical:
        base.fail("regex picker child-page route still present")
    if "makeRegexAdvancedEntry(colors)" in canonical:
        base.fail("regex picker child-page entry still present")

    canonical_sha = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    print("canonical SHA256 after semantic back-layer removal:", canonical_sha)
    if canonical_sha != EXPECTED_CANONICAL_SHA256:
        base.fail(
            "canonical source SHA mismatch after semantic back-layer removal: "
            + canonical_sha
        )

    loader = base.repack_loader(base.FILTER, loader, variable, canonical)
    blob_sha = base.git_blob_sha(loader)

    manifest = json.loads(base.MANIFEST.read_text(encoding="utf-8"))
    if manifest.get("moduleSetVersion") != base.NEW_SET:
        base.fail(
            "unexpected moduleSetVersion after v2: "
            + str(manifest.get("moduleSetVersion"))
        )
    if manifest.get("sourceRef") != "beta-regex-filter-20260813":
        base.fail("sourceRef changed")
    entries = [
        item for item in manifest.get("modules", [])
        if item.get("name") == "ch_11_filter.js"
    ]
    if len(entries) != 1:
        base.fail("manifest filter entry mismatch")
    entries[0]["sha"] = blob_sha
    base.MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print("Regex inline source-style grid v4 generated")
    print("moduleSetVersion:", base.NEW_SET)
    print("Filter MODULE_VERSION:", base.NEW_FILTER_VERSION)
    print("canonical SHA256:", canonical_sha)
    print("Filter blob SHA:", blob_sha)


if __name__ == "__main__":
    main()
