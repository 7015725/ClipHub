#!/usr/bin/env python3
from __future__ import annotations

import base64
import gzip
import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
FILTER = ROOT / "src" / "ch_11_filter.js"
FRAGMENT = ROOT / "tools" / "regex_beta_patches" / "filter_regex_feature.jsfrag"
MANIFEST = ROOT / "module-manifest.json"
PREFLIGHT = ROOT / "scripts" / "release_preflight.sh"
OLD_SET = "20260813.07"
NEW_SET = "20260813.08"
OLD_FILTER_VERSION = 78
NEW_FILTER_VERSION = 79


def fail(message: str) -> None:
    raise RuntimeError(message)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        fail(f"{label}: expected exactly one anchor, got {count}")
    return text.replace(old, new, 1)


def git_blob_sha(text: str) -> str:
    raw = text.encode("utf-8")
    return hashlib.sha1(
        f"blob {len(raw)}\0".encode("utf-8") + raw
    ).hexdigest()


def unpack_loader(path: pathlib.Path):
    loader = path.read_text(encoding="utf-8")
    assignment = re.search(
        r"\bvar\s+(PACKED_B64|encoded)\s*=\s*(.*?);", loader, re.S
    )
    if assignment is None:
        fail("filter packed assignment missing")
    pieces = re.findall(r'"(?:\\.|[^"\\])*"', assignment.group(2))
    if not pieces:
        fail("filter packed chunks missing")
    encoded = "".join(json.loads(piece) for piece in pieces)
    canonical = gzip.decompress(base64.b64decode(encoded)).decode("utf-8")
    expected = re.search(
        r"\bvar\s+SOURCE_SHA256\s*=\s*[\"']([0-9a-fA-F]{64})[\"']",
        loader,
    )
    if expected is not None:
        actual = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        if actual != expected.group(1).lower():
            fail("filter SOURCE_SHA256 mismatch before patch")
    return loader, assignment.group(1), canonical


def repack_loader(path: pathlib.Path, loader: str, variable: str,
                  canonical: str) -> str:
    raw = gzip.compress(canonical.encode("utf-8"), compresslevel=9, mtime=0)
    encoded = base64.b64encode(raw).decode("ascii")
    chunks = [encoded[i:i + 120] for i in range(0, len(encoded), 120)]
    expression = "\n        " + " +\n        ".join(
        json.dumps(chunk) for chunk in chunks
    ) + "\n    "
    pattern = re.compile(
        r"(\bvar\s+" + re.escape(variable) + r"\s*=\s*)(.*?)(;)", re.S
    )
    match = pattern.search(loader)
    if match is None:
        fail("filter repack assignment missing")
    loader = loader[:match.start(2)] + expression + loader[match.end(2):]
    source_sha = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    loader, count = re.subn(
        r"(\bvar\s+SOURCE_SHA256\s*=\s*[\"'])[0-9a-fA-F]{64}([\"'])",
        lambda m: m.group(1) + source_sha + m.group(2),
        loader,
        count=1,
    )
    if count != 1:
        fail("filter SOURCE_SHA256 update failed")
    loader = "\n".join(line.rstrip() for line in loader.splitlines()) + "\n"
    path.write_text(loader, encoding="utf-8")
    return loader


INLINE_FUNCTION = r'''    function addRegexInlineSection(content, colors, bundle) {
        var rules = ClipHub.Repository.listRegexRules({ enabledOnly: true });
        var title = makeText("正则规则（多选）", 10,
            colors.textSecondary, true);
        var modeRow;
        var emptyText;
        var rule;
        var chip;
        var params;
        var index;
        if (!bundle.regexRuleViews) { bundle.regexRuleViews = {}; }
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(3);
        params.bottomMargin = dp(6);
        content.addView(title, params);

        modeRow = makeChoiceChipRow([
            { key: "any", label: "任意规则 OR" },
            { key: "all", label: "全部规则 AND" }
        ], advancedDraftRegexMatchMode, colors, function (mode) {
            setRegexDraftMode(mode);
        }, null);
        addChoiceSection(content, "匹配方式", modeRow, 6, colors);

        if (rules.length < 1) {
            emptyText = makeText("暂无已启用的正则规则", 9,
                colors.textSecondary, false);
            params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
            params.bottomMargin = dp(8);
            content.addView(emptyText, params);
            state.regexRuleOptionCount = 0;
            return true;
        }

        for (index = 0; index < rules.length; index += 1) {
            rule = rules[index];
            chip = makeChip((contains(advancedDraftRegexRuleIds,
                    Number(rule.id)) ? "☑ " : "☐ ") +
                regexRulePickerLabel(rule),
                contains(advancedDraftRegexRuleIds, Number(rule.id)),
                colors, true);
            (function (id, view) {
                view.setOnClickListener(new JavaAdapter(View.OnClickListener, {
                    onClick: function () { toggleRegexDraftRule(id); }
                }));
                bundle.regexRuleViews[String(id)] = view;
            }(Number(rule.id), chip));
            params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
            params.bottomMargin = dp(5);
            content.addView(chip, params);
        }
        state.regexRuleOptionCount = rules.length;
        return true;
    }
'''


def replace_picker_ui_block(text: str, label: str) -> str:
    start_marker = "    function makeRegexPickerDrawerBundle(colors) {"
    end_marker = "    /* REGEX_BETA_FILTER_END */"
    start = text.find(start_marker)
    end = text.find(end_marker, start)
    if start < 0 or end < 0:
        fail(label + ": regex picker UI block boundary missing")
    if text.find(start_marker, start + 1) >= 0:
        fail(label + ": duplicate regex picker bundle")
    return text[:start] + INLINE_FUNCTION.rstrip() + "\n" + text[end:]


def patch_fragment() -> None:
    text = FRAGMENT.read_text(encoding="utf-8")
    text = replace_picker_ui_block(text, "filter fragment")
    FRAGMENT.write_text(text, encoding="utf-8")


def patch_filter() -> str:
    loader, variable, canonical = unpack_loader(FILTER)
    canonical = replace_picker_ui_block(canonical, "filter canonical")

    canonical = replace_once(
        canonical,
        '''    function createAdvancedDrawerBundle(colors, counts) {
        if (regexPickerVisible) {
            return makeRegexPickerDrawerBundle(colors);
        }
        var bundle = {''',
        '''    function createAdvancedDrawerBundle(colors, counts) {
        regexPickerVisible = false;
        var bundle = {''',
        "remove regex picker subpage routing",
    )

    canonical = replace_once(
        canonical,
        '''        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(8);
        content.addView(makeRegexAdvancedEntry(colors), params);

        sortRow = makeChoiceChipRow([''',
        '''        addRegexInlineSection(content, colors, bundle);

        sortRow = makeChoiceChipRow([''',
        "embed regex rules into advanced drawer",
    )

    canonical = replace_once(
        canonical,
        f"MODULE_VERSION: {OLD_FILTER_VERSION}",
        f"MODULE_VERSION: {NEW_FILTER_VERSION}",
        "filter module version",
    )

    # Keep the old public probe methods for compatibility, but the picker is no
    # longer reachable from the UI and createAdvancedDrawerBundle forces it off.
    if "makeRegexPickerDrawerBundle(colors)" in canonical:
        fail("regex picker drawer call still reachable")
    if "makeRegexAdvancedEntry(colors)" in canonical:
        fail("regex advanced subpage entry still present")
    if "addRegexInlineSection(content, colors, bundle);" not in canonical:
        fail("regex inline section insertion missing")
    if "正则规则（多选）" not in canonical:
        fail("regex inline section title missing")
    if "regexRulePickerLabel(rule)" not in canonical:
        fail("regex title/note label support missing")
    if "toggleRegexDraftRule(id)" not in canonical:
        fail("regex draft toggle binding missing")
    if "commitRegexDraft();" not in canonical:
        fail("regex draft apply contract missing")
    if "startRegexScan" not in canonical or "regexResultPageResult" not in canonical:
        fail("regex runtime chain unexpectedly missing")

    return repack_loader(FILTER, loader, variable, canonical)


def update_manifest(loader: str) -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if manifest.get("moduleSetVersion") != OLD_SET:
        fail("unexpected moduleSetVersion: " + str(manifest.get("moduleSetVersion")))
    if manifest.get("sourceRef") != "beta-regex-filter-20260813":
        fail("unexpected sourceRef")
    entries = [item for item in manifest.get("modules", [])
               if item.get("name") == "ch_11_filter.js"]
    if len(entries) != 1:
        fail("manifest filter entry mismatch")
    entries[0]["sha"] = git_blob_sha(loader)
    manifest["moduleSetVersion"] = NEW_SET
    MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def update_preflight() -> None:
    text = PREFLIGHT.read_text(encoding="utf-8")
    count = text.count("EXPECTED_MODULE_SET='" + OLD_SET + "'")
    if count != 2:
        fail("regex preflight moduleSet anchors changed: " + str(count))
    text = text.replace(
        "EXPECTED_MODULE_SET='" + OLD_SET + "'",
        "EXPECTED_MODULE_SET='" + NEW_SET + "'",
    )
    text = replace_once(
        text,
        '"ch_11_filter.js": ("ch_11_filter", 78),',
        '"ch_11_filter.js": ("ch_11_filter", 79),',
        "regex preflight filter version",
    )
    PREFLIGHT.write_text(text, encoding="utf-8")


def main() -> None:
    patch_fragment()
    loader = patch_filter()
    update_manifest(loader)
    update_preflight()
    print("Regex inline advanced-filter layout generated")
    print("moduleSetVersion:", NEW_SET)
    print("Filter MODULE_VERSION:", NEW_FILTER_VERSION)
    print("Filter blob SHA:", git_blob_sha(loader))


if __name__ == "__main__":
    main()
