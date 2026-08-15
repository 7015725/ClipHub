#!/usr/bin/env python3
from pathlib import Path
import re
import subprocess

BASE = "2719739e6ccc809b59ba7555dc01e7f73f610742"
LIST_PATH = Path("src/ch_09_list.js")
SHELL_PATH = Path("src/ch_16_ui_shell.js")
PREFLIGHT_PATH = Path("scripts/release_preflight.sh")
MANIFEST_PATH = Path("module-manifest.json")


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError("%s anchor count=%d" % (label, count))
    return text.replace(old, new, 1)


def regex_replace_once(text, pattern, replacement, label):
    result, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError("%s regex count=%d" % (label, count))
    return result


def git_blob(path):
    return subprocess.check_output(
        ["git", "hash-object", str(path)], text=True
    ).strip()


# ---------------------------------------------------------------------------
# List21 -> List22: Detail uses Primary Window first, standalone stays fallback.
# ---------------------------------------------------------------------------
list_text = LIST_PATH.read_text(encoding="utf-8")
if 'MODULE_NAME: "ch_09_list"' not in list_text or "MODULE_VERSION: 21" not in list_text:
    raise RuntimeError("unexpected List baseline")

list_text = replace_once(
    list_text,
    "var detailRemovalGeneration = 0;\nvar pendingDetailOpen = null;",
    "var detailRemovalGeneration = 0;\nvar pendingDetailOpen = null;\nvar detailEmbeddedInPrimary = false;",
    "list embedded state",
)

new_close = r'''function closeDetail(reason) {
var reasonText = String(reason || "close");
if (detailRemovalPending) {
return {
ok: true,
attached: false,
alreadyClosed: true,
removalPending: true,
state: getDetailState()
};
}
if (detailRoot === null && !detailRemovalPending) {
detailRow = null;
detailEmbeddedInPrimary = false;
return {
ok: true,
attached: false,
alreadyClosed: true,
state: getDetailState()
};
}
if (detailEmbeddedInPrimary) {
return ClipHub.Window.runOnMain(function () {
var thread = Thread.currentThread();
try {
if (ClipHub.UIShell &&
typeof ClipHub.UIShell.unmountPage === "function") {
ClipHub.UIShell.unmountPage("detail", reasonText);
}
} catch (errorUnmount) {
state.lastError = String(errorUnmount);
return { ok: false, attached: true, embedded: true,
state: getDetailState() };
}
state.detailCloseCount += 1;
state.detailRemoveThreadName = String(thread.getName());
state.lastDetailAction = reasonText;
detailEmbeddedInPrimary = false;
detailClosing = false;
detailRemovalPending = false;
detailRoot = null;
detailWindowRoot = null;
detailManagedFrame = null;
detailParams = null;
detailRow = null;
detailCopyView = null;
detailEditView = null;
detailCloseView = null;
detailWidthPx = 0;
detailHeightPx = 0;
state.lastError = null;
return { ok: true, attached: false, alreadyClosed: false,
embedded: true, state: getDetailState() };
}, 3000);
}
return ClipHub.Window.runOnMain(function () {
var thread = Thread.currentThread();
var capturedRoot = detailWindowRoot !== null ?
detailWindowRoot : detailRoot;
var capturedManager = detailWindowManager;
var generation;
var removal;
detailClosing = true;
detailRemovalPending = capturedRoot !== null;
detailRemovalGeneration += 1;
generation = detailRemovalGeneration;
try {
if (ClipHub.Window && capturedRoot !== null &&
typeof ClipHub.Window.detachWindow === "function") {
ClipHub.Window.detachWindow(capturedRoot);
}
} catch (ignoredDetach) {}
state.detailCloseCount += 1;
state.detailRemoveThreadName = String(thread.getName());
state.lastDetailAction = reasonText;
detailEmbeddedInPrimary = false;
detailRoot = null;
detailWindowRoot = null;
detailManagedFrame = null;
detailParams = null;
detailRow = null;
detailCopyView = null;
detailEditView = null;
detailCloseView = null;
detailWidthPx = 0;
detailHeightPx = 0;
if (capturedRoot === null) {
detailClosing = false;
detailRemovalPending = false;
return { ok: true, attached: false, alreadyClosed: false };
}
removal = ClipHub.Window.requestViewRemoval({
manager: capturedManager,
view: capturedRoot,
role: "detail",
reason: reasonText,
generation: generation,
onDetached: function (result) {
var request;
if (generation !== detailRemovalGeneration) { return; }
detailClosing = false;
detailRemovalPending = false;
if (!result || result.ok !== true) {
state.lastError = String(result && result.error ?
result.error : "Detail removal failed");
pendingDetailOpen = null;
return;
}
request = pendingDetailOpen;
pendingDetailOpen = null;
if (request !== null && ready) {
openDetail(request.row, request.force);
}
}
});
if (!removal || removal.ok !== true) {
detailClosing = false;
detailRemovalPending = false;
pendingDetailOpen = null;
state.lastError = String(removal && removal.error ?
removal.error : "Detail removal queue failed");
}
return { ok: removal && removal.ok === true, attached: false,
alreadyClosed: false, removalPending: detailRemovalPending };
}, 3000);
}
'''
list_text = regex_replace_once(
    list_text,
    r"function closeDetail\(reason\) \{.*?\n\}\nfunction copyDetail\(\) \{",
    new_close + "function copyDetail() {",
    "replace closeDetail",
)

list_text = replace_once(
    list_text,
    "function buildDetailView(row) {",
    "function buildDetailView(row, embedded) {",
    "detail builder signature",
)

list_text = replace_once(
    list_text,
    "var footer = new LinearLayout(androidContext);\nvar params;\nroot.setOrientation(LinearLayout.VERTICAL);\nroot.setPadding(dp(14), dp(8), dp(14), dp(12));\nroot.setBackground(roundedBackground(palette.surface,\npalette.stroke, 24));\nif (Build.VERSION.SDK_INT >= 21) {\nroot.setElevation(dp(18));\n}\nhandle.setBackground(roundedBackground(\npalette.strokeStrong, null, 3));\nparams = new LinearLayout.LayoutParams(dp(42), dp(4));\nparams.gravity = Gravity.CENTER_HORIZONTAL;\nparams.bottomMargin = dp(8);\nroot.addView(handle, params);",
    "var footer = new LinearLayout(androidContext);\nvar params;\nvar embeddedMode = embedded === true;\nroot.setOrientation(LinearLayout.VERTICAL);\nif (embeddedMode) {\nroot.setPadding(0, 0, 0, 0);\nroot.setBackground(null);\n} else {\nroot.setPadding(dp(14), dp(8), dp(14), dp(12));\nroot.setBackground(roundedBackground(palette.surface,\npalette.stroke, 24));\n}\nif (Build.VERSION.SDK_INT >= 21) {\nroot.setElevation(embeddedMode ? 0 : dp(18));\n}\nhandle.setBackground(roundedBackground(\npalette.strokeStrong, null, 3));\nparams = new LinearLayout.LayoutParams(dp(42), dp(4));\nparams.gravity = Gravity.CENTER_HORIZONTAL;\nparams.bottomMargin = dp(8);\nroot.addView(handle, params);\nif (embeddedMode) { handle.setVisibility(View.GONE); }",
    "detail embedded root chrome",
)

list_text = replace_once(
    list_text,
    "params.bottomMargin = dp(4);\nroot.addView(header, params);\nmeta.setSingleLine(true);",
    "params.bottomMargin = dp(4);\nroot.addView(header, params);\nif (embeddedMode) {\nheader.setVisibility(View.GONE);\ndetailCloseView = null;\n}\nmeta.setSingleLine(true);",
    "detail embedded header chrome",
)

new_open = r'''function openDetail(row, force) {
if (!force && !isLongText(row)) { return false; }
if (detailRemovalPending) {
pendingDetailOpen = { row: row, force: force };
return { ok: true, attached: false, pending: true };
}
if (detailRoot !== null) {
if (detailEmbeddedInPrimary) {
closeDetail("replace");
} else {
closeDetail("replace");
pendingDetailOpen = { row: row, force: force };
return { ok: true, attached: false, pending: true };
}
}
return ClipHub.Window.runOnMain(function () {
var size;
var type;
var flags;
var thread = Thread.currentThread();
var primaryAvailable = false;
var primaryMounted = false;
try {
primaryAvailable = ClipHub.UIShell &&
typeof ClipHub.UIShell.canEmbed === "function" &&
ClipHub.UIShell.canEmbed("detail") === true;
} catch (ignoredPrimaryAvailability) {
primaryAvailable = false;
}
if (primaryAvailable) {
detailRow = row;
detailRoot = buildDetailView(row, true);
try {
primaryMounted = ClipHub.UIShell.mountPage("detail", detailRoot, {
title: "内容详情",
showBack: true,
onBack: function () {
return closeDetail("shell_back").ok === true;
},
onClose: function () {
return closeDetail("shell_close").ok === true;
}
}) !== false;
} catch (primaryError) {
state.lastError = String(primaryError);
primaryMounted = false;
try {
if (ClipHub.UIShell &&
typeof ClipHub.UIShell.unmountPage === "function") {
ClipHub.UIShell.unmountPage("detail", "detail_mount_failed");
}
} catch (ignoredPrimaryCleanup) {}
}
if (primaryMounted) {
detailEmbeddedInPrimary = true;
detailWindowRoot = null;
detailManagedFrame = null;
detailParams = null;
detailWidthPx = 0;
detailHeightPx = 0;
state.detailOpenCount += 1;
state.lastDetailItemId = Number(row.id);
state.detailAddThreadName = String(thread.getName());
state.lastDetailAction = "open";
state.lastError = null;
return true;
}
detailRoot = null;
detailRow = null;
detailCopyView = null;
detailEditView = null;
detailCloseView = null;
}
size = detailDimensions();
type = Build.VERSION.SDK_INT >= 26 ?
WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY :
WindowManager.LayoutParams.TYPE_SYSTEM_ALERT;
flags =
WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED |
WindowManager.LayoutParams.FLAG_DIM_BEHIND;
detailEmbeddedInPrimary = false;
detailRow = row;
detailRoot = buildDetailView(row, false);
detailManagedFrame = ClipHub.Window.createManagedFrame(detailRoot, {
accentColor: colors().accentStrong
});
detailWindowRoot = detailManagedFrame.rootView;
detailWidthPx = Number(size.width);
detailHeightPx = Number(size.height);
detailParams = new WindowManager.LayoutParams(
size.width, size.height, type, flags,
PixelFormat.TRANSLUCENT);
detailParams.gravity = Gravity.TOP | Gravity.START;
detailParams.x = Number(size.x || 0);
detailParams.y = Number(size.y || 0);
detailParams.dimAmount = DETAIL_DIM_AMOUNT;
try {
detailParams.setTitle("ClipHub Content Detail");
} catch (ignoredTitle) {}
detailWindowManager.addView(detailWindowRoot, detailParams);
ClipHub.Window.attachWindow({
role: "detail",
rootView: detailWindowRoot,
contentView: detailRoot,
layoutParams: detailParams,
windowManager: detailWindowManager,
dragView: detailManagedFrame.dragView,
resizeView: detailManagedFrame.resizeView,
resizeVisual: detailManagedFrame.resizeVisual,
geometry: size,
onGeometryChanged: function (geometry) {
detailWidthPx = Number(geometry.width || 0);
detailHeightPx = Number(geometry.height || 0);
},
onRequestClose: function () {
return closeDetail("managed_close").ok === true;
}
});
state.detailOpenCount += 1;
state.lastDetailItemId = Number(row.id);
state.detailAddThreadName = String(thread.getName());
state.lastDetailAction = "open";
state.lastError = null;
return true;
}, 3000);
}
'''
list_text = regex_replace_once(
    list_text,
    r"function openDetail\(row, force\) \{.*?\n\}\nfunction getDetailState\(\) \{",
    new_open + "function getDetailState() {",
    "replace openDetail",
)

list_text = replace_once(
    list_text,
    "return {\nattached: detailRoot !== null,\nattachedToWindow: attached,",
    "return {\nattached: detailRoot !== null,\nattachedToWindow: attached,\nembeddedInPrimary: detailEmbeddedInPrimary === true,",
    "detail state embedded flag",
)
list_text = replace_once(
    list_text,
    "MODULE_NAME: \"ch_09_list\",\nMODULE_VERSION: 21,",
    "MODULE_NAME: \"ch_09_list\",\nMODULE_VERSION: 22,",
    "List version",
)
LIST_PATH.write_text(list_text, encoding="utf-8")

# ---------------------------------------------------------------------------
# UIShell3 -> UIShell4: activate the already-registered Detail route.
# ---------------------------------------------------------------------------
shell_text = SHELL_PATH.read_text(encoding="utf-8")
if 'MODULE_NAME: "ch_16_ui_shell"' not in shell_text or "MODULE_VERSION: 3" not in shell_text:
    raise RuntimeError("unexpected UIShell baseline")

shell_text = replace_once(
    shell_text,
    'legacySurface: "detail", shellReady: false });',
    'legacySurface: "detail", shellReady: true });',
    "detail shell readiness",
)
shell_text = replace_once(
    shell_text,
    'if (current === "home") { return true; }\n        if (pageId === "translation") { return current === "translation"; }',
    'if (current === "home") { return true; }\n        if (pageId === "detail") { return current === "detail"; }\n        if (pageId === "translation") { return current === "translation"; }',
    "detail shell family",
)
shell_text = replace_once(
    shell_text,
    'if (id !== "settings" && id !== "translation" &&\n                id !== "regex_rules" && id !== "regex_editor" &&',
    'if (id !== "settings" && id !== "translation" && id !== "detail" &&\n                id !== "regex_rules" && id !== "regex_editor" &&',
    "detail canEmbed whitelist",
)
shell_text = replace_once(
    shell_text,
    'if (id === "translation") { return isSameShellFamily("translation"); }',
    'if (id === "detail") { return isSameShellFamily("detail"); }\n        if (id === "translation") { return isSameShellFamily("translation"); }',
    "detail canEmbed routing",
)
shell_text = replace_once(
    shell_text,
    'migrationStage: "primary_overlay_settings_regex_translation_editor_tags_tokenizer",',
    'migrationStage: "primary_overlay_settings_regex_translation_editor_tags_tokenizer_detail",',
    "UIShell migration stage",
)
shell_text = replace_once(
    shell_text,
    'MODULE_NAME: "ch_16_ui_shell",\n        MODULE_VERSION: 3,',
    'MODULE_NAME: "ch_16_ui_shell",\n        MODULE_VERSION: 4,',
    "UIShell version",
)
SHELL_PATH.write_text(shell_text, encoding="utf-8")

# ---------------------------------------------------------------------------
# Release preflight: advance beta contract and lock Stage4 boundaries.
# ---------------------------------------------------------------------------
preflight = PREFLIGHT_PATH.read_text(encoding="utf-8")
preflight = replace_once(
    preflight,
    "EXPECTED_MODULE_SET='20260815.14'",
    "EXPECTED_MODULE_SET='20260815.15'",
    "preflight module set",
)
preflight = replace_once(
    preflight,
    '"ch_16_ui_shell.js": ("ch_16_ui_shell", 3),',
    '"ch_16_ui_shell.js": ("ch_16_ui_shell", 4),',
    "preflight UIShell required version",
)
preflight = replace_once(
    preflight,
    'assert "MODULE_VERSION: 3" in ui_shell_source',
    'assert "MODULE_VERSION: 4" in ui_shell_source',
    "preflight UIShell version assert",
)
preflight = replace_once(
    preflight,
    'assert \'migrationStage: "primary_overlay_settings_regex_translation_editor_tags_tokenizer"\' in ui_shell_source',
    'assert \'migrationStage: "primary_overlay_settings_regex_translation_editor_tags_tokenizer_detail"\' in ui_shell_source',
    "preflight migration stage assert",
)
preflight = replace_once(
    preflight,
    'tokenizer_source = actual_sources["ch_17_tokenizer_ui.js"]\n        assert \'MODULE_NAME: "ch_16_ui_shell"\' in ui_shell_source',
    'tokenizer_source = actual_sources["ch_17_tokenizer_ui.js"]\n        list_source = actual_sources["ch_09_list.js"]\n        assert \'MODULE_NAME: "ch_16_ui_shell"\' in ui_shell_source',
    "preflight list source",
)
preflight = replace_once(
    preflight,
    'assert \'registerPage({ id: "tokenizer", parentId: "editor"\' in ui_shell_source\n        assert "embeddedInPrimary" in editor_source',
    'assert \'registerPage({ id: "tokenizer", parentId: "editor"\' in ui_shell_source\n        assert \'registerPage({ id: "detail", parentId: "home"\' in ui_shell_source\n        assert \'legacySurface: "detail", shellReady: true\' in ui_shell_source\n        assert \'ClipHub.UIShell.canEmbed("detail")\' in list_source\n        assert \'ClipHub.UIShell.mountPage("detail"\' in list_source\n        assert "detailEmbeddedInPrimary" in list_source\n        assert "buildDetailView(row, true)" in list_source\n        assert "buildDetailView(row, false)" in list_source\n        assert "detailWindowManager.addView(detailWindowRoot, detailParams)" in list_source\n        assert "ClipHub.Clipboard.writeText(String(detailRow.content)" in list_source\n        assert "ClipHub.Editor.openItem(Number(row.id))" in list_source\n        assert "embeddedInPrimary" in editor_source',
    "preflight Stage4 detail contracts",
)
PREFLIGHT_PATH.write_text(preflight, encoding="utf-8")

# ---------------------------------------------------------------------------
# Manifest: only module set plus List/UIShell blob SHAs change.
# ---------------------------------------------------------------------------
manifest = MANIFEST_PATH.read_text(encoding="utf-8")
manifest = replace_once(
    manifest,
    '"moduleSetVersion": "20260815.14"',
    '"moduleSetVersion": "20260815.15"',
    "manifest module set",
)
list_blob = git_blob(LIST_PATH)
shell_blob = git_blob(SHELL_PATH)
manifest = regex_replace_once(
    manifest,
    r'("name": "ch_09_list\.js",\n\s+"path": "src/ch_09_list\.js",\n\s+"sha": ")[0-9a-f]+(")',
    r'\g<1>' + list_blob + r'\g<2>',
    "manifest List blob",
)
manifest = regex_replace_once(
    manifest,
    r'("name": "ch_16_ui_shell\.js",\n\s+"path": "src/ch_16_ui_shell\.js",\n\s+"sha": ")[0-9a-f]+(")',
    r'\g<1>' + shell_blob + r'\g<2>',
    "manifest UIShell blob",
)
MANIFEST_PATH.write_text(manifest, encoding="utf-8")

# Final static checks before removing all one-shot tooling.
final_list = LIST_PATH.read_text(encoding="utf-8")
final_shell = SHELL_PATH.read_text(encoding="utf-8")
assert "MODULE_VERSION: 22" in final_list
assert 'ClipHub.UIShell.canEmbed("detail")' in final_list
assert 'ClipHub.UIShell.mountPage("detail"' in final_list
assert "buildDetailView(row, true)" in final_list
assert "buildDetailView(row, false)" in final_list
assert "detailWindowManager.addView(detailWindowRoot, detailParams)" in final_list
assert "ClipHub.Clipboard.writeText(String(detailRow.content)" in final_list
assert "ClipHub.Editor.openItem(Number(row.id))" in final_list
assert "MODULE_VERSION: 4" in final_shell
assert 'legacySurface: "detail", shellReady: true' in final_shell
assert 'migrationStage: "primary_overlay_settings_regex_translation_editor_tags_tokenizer_detail"' in final_shell
assert '"moduleSetVersion": "20260815.15"' in MANIFEST_PATH.read_text(encoding="utf-8")

# Remove both the earlier read-only probe and this implementation harness.
for transient in (
    Path(".github/workflows/stage4_runtime_probe_once.yml"),
    Path("tools/stage4_runtime_probe_20260815.py"),
    Path(".github/workflows/stage4_detail_migration_once.yml"),
    Path("tools/stage4_detail_migration_20260815.py"),
):
    if transient.exists():
        transient.unlink()

print("Stage4 Detail migration patch applied")
print("List blob: " + list_blob)
print("UIShell blob: " + shell_blob)
