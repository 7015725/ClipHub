#!/usr/bin/env python3
import base64
import gzip
import hashlib
import json
import re
from pathlib import Path

BASE = "cbc306ee5935e62ac01e80ee277e35ef80e31260"
OLD_SET = "20260815.15"
NEW_SET = "20260815.16"
OLD_FILTER_VERSION = 84
NEW_FILTER_VERSION = 85
OLD_UI_SHELL_VERSION = 4
NEW_UI_SHELL_VERSION = 5
EXPECTED_FILTER_CANONICAL_SHA256 = "3641a8a07a8cf07c0b8615c49b7085d1474326e4252cc092d3a5a79c44db5ff5"

FILTER = Path("src/ch_11_filter.js")
UI_SHELL = Path("src/ch_16_ui_shell.js")
MANIFEST = Path("module-manifest.json")
PREFLIGHT = Path("scripts/release_preflight.sh")
TEMP_FILES = [
    Path(".github/workflows/stage5_filter_surface_probe_once.yml"),
    Path("tools/stage5_filter_surface_probe_20260815.py"),
    Path(".github/workflows/stage5_filter_closure_once.yml"),
    Path("tools/stage5_filter_closure_20260815.py"),
]


def fail(message):
    raise RuntimeError(message)


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        fail("%s: expected exactly one anchor, got %d" % (label, count))
    return text.replace(old, new, 1)


def git_blob_sha(text):
    raw = text.encode("utf-8")
    header = ("blob %d\0" % len(raw)).encode("utf-8")
    return hashlib.sha1(header + raw).hexdigest()


def unpack_loader(path):
    loader = path.read_text(encoding="utf-8")
    assignment = re.search(
        r"\bvar\s+(PACKED_B64|encoded)\s*=\s*(.*?);", loader, re.S
    )
    if assignment is None:
        fail("Filter packed assignment missing")
    pieces = re.findall(r'"(?:\\.|[^"\\])*"', assignment.group(2))
    if not pieces:
        fail("Filter packed chunks missing")
    encoded = "".join(json.loads(piece) for piece in pieces)
    canonical = gzip.decompress(base64.b64decode(encoded)).decode("utf-8")
    expected = re.search(
        r"\bvar\s+SOURCE_SHA256\s*=\s*[\"']([0-9a-fA-F]{64})[\"']",
        loader,
    )
    actual = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    if expected is not None and actual != expected.group(1).lower():
        fail("Filter SOURCE_SHA256 mismatch before patch")
    return loader, assignment.group(1), canonical, actual


def repack_loader(path, loader, variable, canonical):
    raw = gzip.compress(canonical.encode("utf-8"), compresslevel=9, mtime=0)
    encoded = base64.b64encode(raw).decode("ascii")
    chunks = [encoded[index:index + 120] for index in range(0, len(encoded), 120)]
    expression = "\n        " + " +\n        ".join(
        json.dumps(chunk) for chunk in chunks
    ) + "\n    "
    pattern = re.compile(
        r"(\bvar\s+" + re.escape(variable) + r"\s*=\s*)(.*?)(;)", re.S
    )
    match = pattern.search(loader)
    if match is None:
        fail("Filter repack assignment missing")
    loader = loader[:match.start(2)] + expression + loader[match.end(2):]
    source_sha = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    loader, count = re.subn(
        r"(\bvar\s+SOURCE_SHA256\s*=\s*[\"'])[0-9a-fA-F]{64}([\"'])",
        lambda item: item.group(1) + source_sha + item.group(2),
        loader,
        count=1,
    )
    if count != 1:
        fail("Filter SOURCE_SHA256 update failed")
    loader = "\n".join(line.rstrip() for line in loader.splitlines()) + "\n"
    path.write_text(loader, encoding="utf-8")
    return loader, source_sha


def patch_filter():
    loader, variable, canonical, canonical_sha = unpack_loader(FILTER)
    if canonical_sha != EXPECTED_FILTER_CANONICAL_SHA256:
        fail("Unexpected Filter84 canonical SHA256: " + canonical_sha)
    if 'MODULE_NAME: "ch_11_filter"' not in canonical or \
            ("MODULE_VERSION: %d" % OLD_FILTER_VERSION) not in canonical:
        fail("Unexpected Filter84 baseline")

    canonical = replace_once(
        canonical,
        "        showPanel: showPanel,",
        """        showPanel: function (options) {
            options = options || {};
            options.rootMode = true;
            return showPanel(options);
        },""",
        "Filter public showPanel closure",
    )
    canonical = replace_once(
        canonical,
        "MODULE_VERSION: %d" % OLD_FILTER_VERSION,
        "MODULE_VERSION: %d" % NEW_FILTER_VERSION,
        "Filter module version",
    )

    # Stage5 only closes the public legacy entry. The internal implementation is
    # retained so cache/window code and fallback semantics are not refactored.
    required = [
        "function showPanel(options)",
        "showRoot: function (options)",
        "options.rootMode = true;",
        "state.primarySurface = rootMode ?",
        '"filter_root" : "filter_overlay"',
        "function createAdvancedDrawerBundle(colors, counts)",
        "resultBodyFrame.addView(nextBundle.container",
        "function setAdvancedDrawerVisibleOnMain(",
        "function handleBack()",
        'state.lastBackLayer = "advanced_drawer"',
        "function mountPrimaryChildPage(spec)",
        "function unmountPrimaryChildPage(reason)",
        "function getPrimaryHostState()",
        "REGEX_INLINE_PAGE_SIZE = 30",
        "regexRuleTotalCount",
        "regexInlineVisibleLimit",
        ".matcher(text).find()",
    ]
    for marker in required:
        if marker not in canonical:
            fail("Filter Stage5 preserved contract missing: " + marker)
    if "        showPanel: showPanel," in canonical:
        fail("Raw public showPanel export remains")
    if canonical.count("windowManager.addView(panelWindowRoot, panelParams)") != 1:
        fail("Filter window attach count changed")
    if canonical.count("new WindowManager.LayoutParams(") != 1:
        fail("Filter WindowManager LayoutParams count changed")

    return repack_loader(FILTER, loader, variable, canonical)


def patch_ui_shell():
    text = UI_SHELL.read_text(encoding="utf-8")
    if 'MODULE_NAME: "ch_16_ui_shell"' not in text or \
            ("MODULE_VERSION: %d" % OLD_UI_SHELL_VERSION) not in text:
        fail("Unexpected UIShell4 baseline")

    stale_filter_route = '''        registerPage({ id: "filter", parentId: "home", owner: "filter",
            moduleName: "Filter", cachePolicy: "lazy",
            legacySurface: "filter", shellReady: false });
'''
    text = replace_once(
        text,
        stale_filter_route,
        "",
        "UIShell stale filter route",
    )
    text = replace_once(
        text,
        'migrationStage: "primary_overlay_settings_regex_translation_editor_tags_tokenizer_detail",',
        'migrationStage: "primary_window_settings_regex_translation_editor_tags_tokenizer_detail_filter_overlay_closed",',
        "UIShell migration stage",
    )
    text = replace_once(
        text,
        'MODULE_NAME: "ch_16_ui_shell",\n        MODULE_VERSION: 4,',
        'MODULE_NAME: "ch_16_ui_shell",\n        MODULE_VERSION: 5,',
        "UIShell module version",
    )

    if 'registerPage({ id: "filter"' in text:
        fail("Stale UIShell filter route remains")
    for marker in [
        'registerPage({ id: "home"',
        'registerPage({ id: "detail", parentId: "home"',
        'registerPage({ id: "editor", parentId: "home"',
        'registerPage({ id: "settings", parentId: "home"',
        'registerPage({ id: "translation", parentId: "home"',
        'registerPage({ id: "tokenizer", parentId: "editor"',
        'if (id === "detail") { return isSameShellFamily("detail"); }',
        'primaryWindowMode: true',
        'legacyWindowBridge: true',
    ]:
        if marker not in text:
            fail("UIShell preserved contract missing: " + marker)

    UI_SHELL.write_text(text, encoding="utf-8")
    return text


def patch_preflight():
    text = PREFLIGHT.read_text(encoding="utf-8")
    text = replace_once(
        text,
        "    EXPECTED_MODULE_SET='20260815.15'",
        "    EXPECTED_MODULE_SET='20260815.16'",
        "settings-tabs-beta module set",
    )
    text = replace_once(
        text,
        '"ch_11_filter.js": ("ch_11_filter", 84),',
        '"ch_11_filter.js": ("ch_11_filter", 85),',
        "preflight Filter version",
    )
    text = replace_once(
        text,
        '"ch_16_ui_shell.js": ("ch_16_ui_shell", 4),',
        '"ch_16_ui_shell.js": ("ch_16_ui_shell", 5),',
        "preflight UIShell version",
    )
    text = replace_once(
        text,
        'assert "MODULE_VERSION: 4" in ui_shell_source',
        'assert "MODULE_VERSION: 5" in ui_shell_source',
        "preflight UIShell version assertion",
    )
    text = replace_once(
        text,
        'assert \'migrationStage: "primary_overlay_settings_regex_translation_editor_tags_tokenizer_detail"\' in ui_shell_source',
        'assert \'migrationStage: "primary_window_settings_regex_translation_editor_tags_tokenizer_detail_filter_overlay_closed"\' in ui_shell_source',
        "preflight migration stage assertion",
    )

    insertion_anchor = '''        assert "mountPrimaryChildPage" in filter_source
        assert "unmountPrimaryChildPage" in filter_source
        assert "getPrimaryHostState" in filter_source
'''
    insertion = '''        assert "mountPrimaryChildPage" in filter_source
        assert "unmountPrimaryChildPage" in filter_source
        assert "getPrimaryHostState" in filter_source
        assert "        showPanel: showPanel," not in filter_source
        assert re.search(
            r"showPanel:\\s*function\\s*\\(options\\)\\s*\\{\\s*"
            r"options\\s*=\\s*options\\s*\\|\\|\\s*\\{\\};\\s*"
            r"options\\.rootMode\\s*=\\s*true;\\s*"
            r"return\\s+showPanel\\(options\\);\\s*\\}",
            filter_source,
            re.S,
        )
        assert "function createAdvancedDrawerBundle(colors, counts)" in filter_source
        assert "resultBodyFrame.addView(nextBundle.container" in filter_source
        assert 'state.lastBackLayer = "advanced_drawer"' in filter_source
        assert 'registerPage({ id: "filter"' not in ui_shell_source
'''
    text = replace_once(
        text,
        insertion_anchor,
        insertion,
        "Stage5 Filter closure assertions",
    )
    text = replace_once(
        text,
        'print("UI shell stage3 contracts: passed")',
        'print("UI shell stage5 contracts: passed")',
        "preflight UIShell stage label",
    )
    PREFLIGHT.write_text(text, encoding="utf-8")
    return text


def update_manifest(filter_loader, ui_shell_text):
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if manifest.get("moduleSetVersion") != OLD_SET:
        fail("Unexpected moduleSetVersion: " + str(manifest.get("moduleSetVersion")))
    if manifest.get("sourceRef") != "beta-regex-settings-tabs-20260814":
        fail("Unexpected sourceRef")
    modules = manifest.get("modules", [])
    filter_entries = [item for item in modules if item.get("name") == "ch_11_filter.js"]
    shell_entries = [item for item in modules if item.get("name") == "ch_16_ui_shell.js"]
    if len(filter_entries) != 1 or len(shell_entries) != 1:
        fail("Manifest Filter/UIShell entry mismatch")
    filter_entries[0]["sha"] = git_blob_sha(filter_loader)
    shell_entries[0]["sha"] = git_blob_sha(ui_shell_text)
    manifest["moduleSetVersion"] = NEW_SET
    MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def cleanup_temp_files():
    for path in TEMP_FILES:
        try:
            if path.exists():
                path.unlink()
        except OSError as error:
            fail("Failed to remove temporary file %s: %s" % (path, error))


def main():
    filter_loader, canonical_sha = patch_filter()
    ui_shell_text = patch_ui_shell()
    patch_preflight()
    update_manifest(filter_loader, ui_shell_text)
    cleanup_temp_files()

    print("Stage5 Filter legacy closure applied")
    print("base=" + BASE)
    print("moduleSetVersion=" + NEW_SET)
    print("Filter MODULE_VERSION=%d" % NEW_FILTER_VERSION)
    print("Filter canonical SHA256=" + canonical_sha)
    print("Filter blob=" + git_blob_sha(filter_loader))
    print("UIShell MODULE_VERSION=%d" % NEW_UI_SHELL_VERSION)
    print("UIShell blob=" + git_blob_sha(ui_shell_text))


if __name__ == "__main__":
    main()
