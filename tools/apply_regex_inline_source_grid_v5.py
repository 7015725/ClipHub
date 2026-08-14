#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json

import apply_regex_inline_filter_layout as base
import apply_regex_inline_source_grid_v2 as v2

EXPECTED_CANONICAL_SHA256 = (
    "579887b6e073abc92c820f05eb665d4a24000db25910510567c371dcc17c986c"
)

COMPACT_BOUNDARY = '''    }
    /* REGEX_BETA_FILTER_END */'''
DEVICE_BOUNDARY = '''    }

    /* REGEX_BETA_FILTER_END */'''


def restore_device_boundary(text: str, label: str) -> str:
    return base.replace_once(
        text,
        COMPACT_BOUNDARY,
        DEVICE_BOUNDARY,
        label,
    )


def main() -> None:
    v2.main()

    loader, variable, canonical = base.unpack_loader(base.FILTER)
    canonical = restore_device_boundary(
        canonical,
        "restore verified Regex feature boundary blank line",
    )

    if 'state.lastBackLayer = "regex_picker";' in canonical:
        base.fail("regex picker back-stack marker remains")
    if "return makeRegexPickerDrawerBundle(colors);" in canonical:
        base.fail("regex picker child-page route remains")
    if "makeRegexAdvancedEntry(colors)" in canonical:
        base.fail("regex picker child-page entry remains")

    canonical_sha = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    if canonical_sha != EXPECTED_CANONICAL_SHA256:
        base.fail(
            "canonical source SHA mismatch after exact boundary restore: "
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

    # Keep the canonical Regex patch fragment byte-shape aligned with the
    # verified runtime source instead of leaving the generator-only compact
    # boundary behind.
    fragment = base.FRAGMENT.read_text(encoding="utf-8")
    fragment = restore_device_boundary(
        fragment,
        "restore Regex fragment boundary blank line",
    )
    base.FRAGMENT.write_text(fragment, encoding="utf-8")

    print("Regex inline source-style grid v5 generated")
    print("moduleSetVersion:", base.NEW_SET)
    print("Filter MODULE_VERSION:", base.NEW_FILTER_VERSION)
    print("canonical SHA256:", canonical_sha)
    print("Filter blob SHA:", blob_sha)


if __name__ == "__main__":
    main()
