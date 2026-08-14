#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import re

import apply_regex_inline_filter_layout as base
import apply_regex_inline_source_grid_v2 as v2

EXPECTED_CANONICAL_SHA256 = (
    "579887b6e073abc92c820f05eb665d4a24000db25910510567c371dcc17c986c"
)

EXPECTED_FUNCTION_SHA256 = {
    "styleRegexInlineChip": "ca3932d265bfcb931d60f4efc3a2fa2dd9ccaefb6465faa3d55600d9291db679",
    "refreshRegexInlineSelection": "2ddee6624196b336a3682bf11537a354847b410b2bead5feeca0409b84c2cc06",
    "makeRegexSourceStyleGrid": "c1afe89075b88b54dfa25b133bd5cda021c4caf9ac4ddd2b293871bf88ace7f3",
    "addRegexInlineSection": "3e4054ac56179a6f5683b11eb9fe89aa7dd3d5bd5f20417612123c24a96cfa38",
    "createAdvancedDrawerBundle": "9402b7bb55d00bf9a61840530ce754e99bad25f266cf46ab624ce60f352d9056",
    "handleBack": "9b5ee705aa07a3aea9fae8735218acf0ecb7aca549aeb0a77645b09ed2f2c7ed",
    "openRegexPicker": "b44653932e6231c3314ea1696c5eb263e505beb0c751f5ad1f1802f66719b4d4",
    "closeRegexPicker": "8ad14ccb04bbf813ea00ed25d767a38cb2015c7641cb3311504530d6e32bfab0",
    "toggleRegexDraftRule": "0766cb8ec2229694ccae06e58895c06dc556edbbde32485618ec9c80dcdfb943",
    "setRegexDraftMode": "9730106716c9b87c8d1ccbca32df99b06296bf437e3eb59bc4e873a8b92dc0d2",
}


def function_spans(source: str) -> dict[str, str]:
    matches = list(re.finditer(
        r"^    function\s+([A-Za-z0-9_$]+)\s*\(", source, re.M
    ))
    result: dict[str, str] = {}
    for index, match in enumerate(matches):
        start = match.start()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(source)
        result[match.group(1)] = source[start:end]
    return result


def main() -> None:
    v2.main()
    loader, _variable, canonical = base.unpack_loader(base.FILTER)
    del loader

    canonical_sha = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    spans = function_spans(canonical)
    mismatches: list[str] = []

    print("DIAG canonical_sha256:", canonical_sha)
    print("DIAG expected_sha256 :", EXPECTED_CANONICAL_SHA256)
    print("DIAG regexPickerVisible count:", canonical.count("regexPickerVisible"))
    print("DIAG regex_picker back marker count:",
          canonical.count('state.lastBackLayer = "regex_picker";'))
    print("DIAG makeRegexAdvancedEntry count:",
          canonical.count("makeRegexAdvancedEntry"))
    print("DIAG makeRegexPickerDrawerBundle count:",
          canonical.count("makeRegexPickerDrawerBundle"))

    for name, expected in EXPECTED_FUNCTION_SHA256.items():
        span = spans.get(name)
        actual = "MISSING" if span is None else hashlib.sha256(
            span.encode("utf-8")
        ).hexdigest()
        status = "PASS" if actual == expected else "DIFF"
        print("DIAG function", name, status,
              "actual=" + actual, "expected=" + expected,
              "length=" + ("0" if span is None else str(len(span))))
        if actual != expected:
            mismatches.append(name)
            if span is not None:
                print("DIAG_BEGIN", name)
                print(span)
                print("DIAG_END", name)

    if canonical_sha == EXPECTED_CANONICAL_SHA256:
        print("DIAG all canonical source bytes match device Probe 073")
        return

    raise RuntimeError(
        "diagnostic canonical mismatch; functions=" + ",".join(mismatches)
    )


if __name__ == "__main__":
    main()
