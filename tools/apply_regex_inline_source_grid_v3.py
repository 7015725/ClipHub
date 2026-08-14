#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json

import apply_regex_inline_filter_layout as base
import apply_regex_inline_source_grid_v2 as v2

EXPECTED_CANONICAL_SHA256 = (
    "579887b6e073abc92c820f05eb665d4a24000db25910510567c371dcc17c986c"
)

BACK_LAYER_BLOCK = '''        if (advancedVisible && regexPickerVisible) {
            state.backLayerCloseCount += 1;
            state.lastBackLayer = "regex_picker";
            return closeRegexPicker();
        }
'''


def main() -> None:
    # First apply the already-reviewed Source-App-style inline grid conversion.
    v2.main()

    # v2 intentionally kept old public picker probe methods for compatibility,
    # but the old Back handler is a UI navigation layer and must be removed now
    # that the Regex picker is no longer a child page.
    loader, variable, canonical = base.unpack_loader(base.FILTER)
    canonical = base.replace_once(
        canonical,
        BACK_LAYER_BLOCK,
        "",
        "remove regex picker back-stack layer",
    )

    if 'state.lastBackLayer = "regex_picker";' in canonical:
        base.fail("regex picker back-stack marker still present")
    if "return makeRegexPickerDrawerBundle(colors);" in canonical:
        base.fail("regex picker child-page route still present")
    if "makeRegexAdvancedEntry(colors)" in canonical:
        base.fail("regex picker child-page entry still present")

    canonical_sha = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    if canonical_sha != EXPECTED_CANONICAL_SHA256:
        base.fail(
            "canonical source SHA mismatch after back-layer removal: "
            + canonical_sha
        )

    loader = base.repack_loader(
        base.FILTER, loader, variable, canonical
    )
    blob_sha = base.git_blob_sha(loader)

    # v2 already advanced the manifest to .08. Only replace the Filter blob
    # with the final v3 packed output; all other module entries stay untouched.
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

    print("Regex inline source-style grid v3 generated")
    print("moduleSetVersion:", base.NEW_SET)
    print("Filter MODULE_VERSION:", base.NEW_FILTER_VERSION)
    print("canonical SHA256:", canonical_sha)
    print("Filter blob SHA:", blob_sha)


if __name__ == "__main__":
    main()
