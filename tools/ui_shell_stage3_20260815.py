#!/usr/bin/env python3
import base64
import gzip
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def write(path, text):
    (ROOT / path).write_text(text, encoding="utf-8")


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise AssertionError("%s anchor count=%d" % (label, count))
    return text.replace(old, new, 1)


def function_span(text, name):
    marker = "    function " + name + "("
    start = text.find(marker)
    if start < 0:
        raise AssertionError("function missing: " + name)
    brace = text.find("{", start)
    if brace < 0:
        raise AssertionError("function brace missing: " + name)
    depth = 0
    quote = None
    escape = False
    line_comment = False
    block_comment = False
    i = brace
    while i < len(text):
        ch = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""
        if line_comment:
            if ch == "\n":
                line_comment = False
            i += 1
            continue
        if block_comment:
            if ch == "*" and nxt == "/":
                block_comment = False
                i += 2
                continue
            i += 1
            continue
        if quote is not None:
            if escape:
                escape = False
            elif ch == "\\":
                escape = True
            elif ch == quote:
                quote = None
            i += 1
            continue
        if ch in ("'", '"'):
            quote = ch
            i += 1
            continue
        if ch == "/" and nxt == "/":
            line_comment = True
            i += 2
            continue
        if ch == "/" and nxt == "*":
            block_comment = True
            i += 2
            continue
        if ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return start, i + 1
        i += 1
    raise AssertionError("function end missing: " + name)


def patch_function(text, name, patcher):
    a, b = function_span(text, name)
    old = text[a:b]
    new = patcher(old)
    if new == old:
        raise AssertionError("function unchanged: " + name)
    return text[:a] + new + text[b:]


def unpack_loader(path):
    loader = read(path)
    match = re.search(r"\bvar\s+(PACKED_B64|encoded)\s*=\s*(.*?);", loader, re.S)
    if match is None:
        return loader, None, loader
    pieces = re.findall(r'"(?:\\.|[^"\\])*"', match.group(2))
    source = gzip.decompress(base64.b64decode(
        "".join(json.loads(piece) for piece in pieces))).decode("utf-8")
    return loader, match.group(1), source


def repack_loader(path, loader, var_name, source):
    digest = hashlib.sha256(source.encode("utf-8")).hexdigest()
    packed = base64.b64encode(gzip.compress(
        source.encode("utf-8"), compresslevel=9, mtime=0)).decode("ascii")
    chunks = [packed[i:i + 120] for i in range(0, len(packed), 120)]
    assignment = "var " + var_name + " =\n" + "\n".join(
        '        "' + chunk + '"' + (" +" if i < len(chunks) - 1 else "")
        for i, chunk in enumerate(chunks)) + ";"
    match = re.search(r"\bvar\s+(?:PACKED_B64|encoded)\s*=\s*(.*?);", loader, re.S)
    if match is None:
        raise AssertionError("packed assignment missing: " + path)
    loader = loader[:match.start()] + assignment + loader[match.end():]
    loader, count = re.subn(
        r"(\bvar\s+SOURCE_SHA256\s*=\s*['\"])[0-9a-fA-F]{64}(['\"])",
        r"\g<1>" + digest + r"\2", loader, count=1)
    if count != 1:
        raise AssertionError("SOURCE_SHA256 anchor missing: " + path)
    write(path, loader)
    return loader


def blob_sha(text):
    data = text.encode("utf-8")
    return hashlib.sha1(("blob %d\0" % len(data)).encode("utf-8") + data).hexdigest()


# ---------------- UIShell 2 -> 3 ----------------
ui = read("src/ch_16_ui_shell.js")
ui = replace_once(ui,
'''        registerPage({ id: "editor", parentId: "home", owner: "editor",
            moduleName: "Editor", cachePolicy: "rebind",
            legacySurface: "editor", shellReady: false });
        registerPage({ id: "tags", parentId: "editor", owner: "tags",
            moduleName: "Editor", cachePolicy: "lazy",
            legacySurface: "tags", shellReady: false });''',
'''        registerPage({ id: "editor", parentId: "home", owner: "editor",
            moduleName: "Editor", cachePolicy: "rebind",
            legacySurface: "editor", shellReady: true });
        registerPage({ id: "tags", parentId: "editor", owner: "tags",
            moduleName: "Editor", cachePolicy: "lazy",
            legacySurface: "tags", shellReady: true });''',
"ui editor/tags descriptors")
ui = replace_once(ui,
'''        registerPage({ id: "tokenizer", parentId: "home", owner: "tokenizer",
            moduleName: "TokenizerUI", cachePolicy: "rebind",
            legacySurface: "tokenizer", shellReady: false });''',
'''        registerPage({ id: "tokenizer", parentId: "editor", owner: "tokenizer",
            moduleName: "TokenizerUI", cachePolicy: "rebind",
            legacySurface: "tokenizer", shellReady: true });''',
"ui tokenizer descriptor")
ui = replace_once(ui,
'''        if (pageId === "settings") {
            return current === "settings" || current === "regex_rules" ||
                current === "regex_editor" || current === "regex_test";
        }
        return false;''',
'''        if (pageId === "settings") {
            return current === "settings" || current === "regex_rules" ||
                current === "regex_editor" || current === "regex_test";
        }
        if (pageId === "editor" || pageId === "tags" ||
                pageId === "tokenizer") {
            return current === "editor" || current === "tags" ||
                current === "tokenizer";
        }
        return false;''',
"ui shell family")
ui = replace_once(ui,
'''        if (id !== "settings" && id !== "translation" &&
                id !== "regex_rules" && id !== "regex_editor" &&
                id !== "regex_test") { return false; }
        return isSameShellFamily(id === "translation" ? "translation" : "settings");''',
'''        if (id !== "settings" && id !== "translation" &&
                id !== "regex_rules" && id !== "regex_editor" &&
                id !== "regex_test" && id !== "editor" &&
                id !== "tags" && id !== "tokenizer") { return false; }
        if (id === "translation") { return isSameShellFamily("translation"); }
        if (id === "editor" || id === "tags" || id === "tokenizer") {
            return isSameShellFamily(id);
        }
        return isSameShellFamily("settings");''',
"ui canEmbed")
ui = replace_once(ui,
'''        if (id && id !== activePageId &&
                !(id === "settings" && (activePageId === "regex_rules" ||
                    activePageId === "regex_editor" || activePageId === "regex_test"))) {
            return false;
        }''',
'''        if (id && id !== activePageId &&
                !(id === "settings" && (activePageId === "regex_rules" ||
                    activePageId === "regex_editor" || activePageId === "regex_test")) &&
                !(id === "editor" && (activePageId === "tags" ||
                    activePageId === "tokenizer"))) {
            return false;
        }''',
"ui unmount family")
ui = replace_once(ui,
'migrationStage: "primary_overlay_settings_regex_translation"',
'migrationStage: "primary_overlay_settings_regex_translation_editor_tags_tokenizer"',
"ui migration stage")
ui = replace_once(ui, 'MODULE_VERSION: 2,', 'MODULE_VERSION: 3,', "ui version")
write("src/ch_16_ui_shell.js", ui)

# ---------------- Editor 31 -> 32 ----------------
editor = read("src/ch_10_editor.js")
editor = replace_once(editor,
'''    var panelManagedFrame = null;
    var panelParams = null;''',
'''    var panelManagedFrame = null;
    var panelParams = null;
    var panelPageRoot = null;
    var panelOverlayHost = null;
    var embeddedInPrimary = false;''',
"editor embedded vars")

helpers = r'''
    function primaryShellAvailable() {
        try {
            return ClipHub.UIShell &&
                typeof ClipHub.UIShell.canEmbed === "function" &&
                ClipHub.UIShell.canEmbed("editor") === true;
        } catch (ignored) {}
        return false;
    }

    function primaryEditorTitle() {
        return state.mode === "new" ? "新增剪贴板" : "编辑剪贴板";
    }

    function mountPrimaryEditorPage() {
        if (!embeddedInPrimary || panelPageRoot === null ||
                !ClipHub.UIShell ||
                typeof ClipHub.UIShell.mountPage !== "function") {
            return false;
        }
        ClipHub.UIShell.mountPage("editor", panelPageRoot, {
            title: primaryEditorTitle(),
            showBack: true,
            onBack: function () { return requestExit("shell_back"); },
            onClose: function () { return requestExit("shell_close"); }
        });
        return true;
    }

    function syncPrimaryEditorPage(pageId, title, onBack) {
        var id = String(pageId || "editor");
        var path = id === "editor" ? ["editor"] : ["editor", id];
        if (!embeddedInPrimary || panelPageRoot === null ||
                !ClipHub.UIShell ||
                typeof ClipHub.UIShell.syncEmbeddedPage !== "function") {
            return false;
        }
        return ClipHub.UIShell.syncEmbeddedPage({
            pageId: id,
            path: path,
            title: String(title || primaryEditorTitle()),
            showBack: true,
            view: panelPageRoot,
            onBack: typeof onBack === "function" ? onBack : function () {
                return requestExit("shell_back");
            },
            onClose: function () { return requestExit("shell_close"); }
        }) === true;
    }

    function bindTokenizerToEditor() {
        if (!ClipHub.TokenizerUI ||
                typeof ClipHub.TokenizerUI.bindEditorRoot !== "function" ||
                panelRoot === null) {
            return false;
        }
        try {
            return ClipHub.TokenizerUI.bindEditorRoot(
                panelRoot,
                panelPageRoot !== null ? panelPageRoot : panelWindowRoot,
                embeddedInPrimary === true) === true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function unbindTokenizerFromEditor(discard) {
        if (!ClipHub.TokenizerUI ||
                typeof ClipHub.TokenizerUI.unbindEditorRoot !== "function") {
            return false;
        }
        try {
            return ClipHub.TokenizerUI.unbindEditorRoot(discard === true) === true;
        } catch (ignored) {}
        return false;
    }
'''
anchor = '    function showExitConfirmOnMain(reason) {'
if editor.count(anchor) != 1:
    raise AssertionError("editor showExit anchor")
editor = editor.replace(anchor, helpers + "\n" + anchor, 1)

# clearViews must clear embedded-only refs without touching legacy semantics.
def patch_clear(fn):
    return replace_once(fn,
'''        panelManagedFrame = null;
        panelParams = null;''',
'''        panelManagedFrame = null;
        panelParams = null;
        panelPageRoot = null;
        panelOverlayHost = null;
        embeddedInPrimary = false;''',
"editor clearViews refs")
editor = patch_function(editor, "clearViews", patch_clear)

# Exit confirmation uses a generic overlay host (managed frame for legacy, page root for embedded).
def patch_confirm(fn):
    fn = replace_once(fn,
'''        if (!panelManagedFrame || !panelManagedFrame.panelView) {
            return false;
        }''',
'''        if (panelOverlayHost === null) { return false; }''',
"editor confirm host guard")
    fn = replace_once(fn,
'''        panelManagedFrame.panelView.addView(overlay,
            new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));''',
'''        panelOverlayHost.addView(overlay,
            new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));''',
"editor confirm host add")
    return fn
editor = patch_function(editor, "showExitConfirmOnMain", patch_confirm)

# Embedded close: no WindowManager detach/removal; restore Home by unmounting the child page.
def patch_close(fn):
    marker = '''        if (!state.attached && panelRoot === null) {
            state.open = false;
            state.itemId = null;
            return { ok: true, attached: false, alreadyClosed: true,
                state: getState() };
        }
'''
    addition = marker + '''        if (embeddedInPrimary) {
            removalOk = requireMain(runOnMainSync(function () {
                var thread = nowThread();
                hideKeyboardOnMain();
                unbindTokenizerFromEditor(true);
                try {
                    if (ClipHub.UIShell &&
                            typeof ClipHub.UIShell.unmountPage === "function") {
                        ClipHub.UIShell.unmountPage("editor", reasonText);
                    }
                } catch (errorUnmount) {
                    state.lastError = String(errorUnmount);
                    return false;
                }
                state.closeCount += 1;
                if (reasonText === "cancel") { state.cancelCount += 1; }
                state.removeThreadId = thread.id;
                state.removeThreadName = thread.name;
                state.lastError = null;
                state.open = false;
                state.attached = false;
                state.inputFocused = false;
                state.itemId = null;
                editorClosing = false;
                editorRemovalPending = false;
                clearViews();
                return true;
            }, 3000));
            return { ok: removalOk === true, attached: false,
                alreadyClosed: false, embedded: true, state: getState() };
        }
'''
    return replace_once(fn, marker, addition, "editor embedded close")
editor = patch_function(editor, "closePanel", patch_close)

# Mode changes only resize a legacy editor Window. Embedded content already follows the primary host.
def patch_size(fn):
    return replace_once(fn,
'''        var size;
        if (panelRoot === null || panelParams === null) { return false; }''',
'''        var size;
        if (panelRoot === null) { return false; }
        if (embeddedInPrimary) { return true; }
        if (panelParams === null) { return false; }''',
"editor embedded size")
editor = patch_function(editor, "updatePanelSizeForMode", patch_size)

# Tags are a logical child page inside the same editor view.
def patch_open_tags(fn):
    fn = replace_once(fn,
'''        buildTagContent(false);
        updatePanelSizeForMode();
        return true;''',
'''        buildTagContent(false);
        updatePanelSizeForMode();
        if (embeddedInPrimary) {
            syncPrimaryEditorPage("tags", "选择标签", function () {
                return requestExit("shell_tag_back");
            });
        }
        return true;''',
"editor tags sync")
    return fn
editor = patch_function(editor, "openTagSelectorOnMain", patch_open_tags)


def patch_restore(fn):
    return replace_once(fn,
'''        updatePanelSizeForMode();
        tagReturnMode = null;
        return true;''',
'''        updatePanelSizeForMode();
        tagReturnMode = null;
        bindTokenizerToEditor();
        if (embeddedInPrimary) {
            syncPrimaryEditorPage("editor", primaryEditorTitle(), function () {
                return requestExit("shell_back");
            });
        }
        return true;''',
"editor restore shell")
editor = patch_function(editor, "restoreTextEditorOnMain", patch_restore)

# Hide legacy chrome when the editor content is inside the shared primary shell.
def patch_text(fn):
    fn = replace_once(fn,
'''        panelRoot.addView(dragHandle, params);
        state.dragHandlePresent = true;''',
'''        panelRoot.addView(dragHandle, params);
        if (embeddedInPrimary) { dragHandle.setVisibility(View.GONE); }
        state.dragHandlePresent = embeddedInPrimary !== true;''',
"editor text drag hide")
    fn = replace_once(fn,
'''        panelRoot.addView(header, params);
        state.headerIconPresent = false;
        state.headerCloseButtonPresent = true;''',
'''        panelRoot.addView(header, params);
        if (embeddedInPrimary) { header.setVisibility(View.GONE); }
        state.headerIconPresent = false;
        state.headerCloseButtonPresent = embeddedInPrimary !== true;''',
"editor text header hide")
    return fn
editor = patch_function(editor, "buildTextContent", patch_text)


def patch_tags(fn):
    fn = replace_once(fn,
'''        panelRoot.addView(dragRow, params);

        header.setOrientation''',
'''        panelRoot.addView(dragRow, params);
        if (embeddedInPrimary) { dragRow.setVisibility(View.GONE); }

        header.setOrientation''',
"editor tag drag hide")
    fn = replace_once(fn,
'''        panelRoot.addView(header, params);

        inputRow.setOrientation''',
'''        panelRoot.addView(header, params);
        if (embeddedInPrimary) { header.setVisibility(View.GONE); }

        inputRow.setOrientation''',
"editor tag header hide")
    return fn
editor = patch_function(editor, "buildTagContent", patch_tags)

# Opening chooses the primary shell when available and keeps the legacy Window path as fallback.
def patch_open(fn):
    fn = replace_once(fn,
'''        if (state.attached) {
            closePanel("replace");
            pendingOpenRequest = { mode: mode, itemId: itemId,
                options: options };
            return { ok: true, attached: false, pending: true,
                state: getState() };
        }''',
'''        if (state.attached) {
            if (embeddedInPrimary) {
                closePanel("replace");
            } else {
                closePanel("replace");
                pendingOpenRequest = { mode: mode, itemId: itemId,
                    options: options };
                return { ok: true, attached: false, pending: true,
                    state: getState() };
            }
        }''',
"editor replace behavior")
    fn = replace_once(fn,
'''            var dark = isDarkMode();
            var colors = editorPalette();
            panelRoot = new LinearLayout(appContext);''',
'''            var dark = isDarkMode();
            var colors = editorPalette();
            var usePrimary = primaryShellAvailable();
            var host = null;
            panelRoot = new LinearLayout(appContext);''',
"editor open primary vars")
    fn = replace_once(fn,
'''            panelRoot.setOrientation(LinearLayout.VERTICAL);
            if (state.mode === "tags") {
                panelRoot.setPadding(dp(14), dp(12), dp(14), dp(12));
                panelRoot.setBackground(roundedBackground(
                    dark ? "#FF181A1F" : "#FFFFFFFF",
                    dark ? "#30FFFFFF" : "#1A000000", 17));
            } else {
                panelRoot.setPadding(dp(12), dp(8), dp(12), dp(10));
                panelRoot.setBackground(roundedBackground(
                    colors.surface, colors.stroke, 24));
            }''',
'''            panelRoot.setOrientation(LinearLayout.VERTICAL);
            if (usePrimary) {
                panelRoot.setPadding(0, 0, 0, 0);
                panelRoot.setBackground(null);
            } else if (state.mode === "tags") {
                panelRoot.setPadding(dp(14), dp(12), dp(14), dp(12));
                panelRoot.setBackground(roundedBackground(
                    dark ? "#FF181A1F" : "#FFFFFFFF",
                    dark ? "#30FFFFFF" : "#1A000000", 17));
            } else {
                panelRoot.setPadding(dp(12), dp(8), dp(12), dp(10));
                panelRoot.setBackground(roundedBackground(
                    colors.surface, colors.stroke, 24));
            }''',
"editor primary root style")
    embedded_block = '''            if (usePrimary) {
                embeddedInPrimary = true;
                panelPageRoot = new FrameLayout(appContext);
                panelOverlayHost = panelPageRoot;
                panelPageRoot.addView(panelRoot,
                    new FrameLayout.LayoutParams(
                        FrameLayout.LayoutParams.MATCH_PARENT,
                        FrameLayout.LayoutParams.MATCH_PARENT));
                state.open = true;
                state.attached = true;
                state.openCount += 1;
                state.windowType = null;
                state.windowFlags = null;
                state.panelGravity = "shared";
                state.panelBottomMarginDp = 0;
                state.softInputMode = Number(
                    WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
                state.softInputAdjustResize = true;
                state.dimAmount = 0;
                state.modalWindow = false;
                state.opaqueBackground = false;
                state.addThreadId = thread.id;
                state.addThreadName = thread.name;
                state.lastError = null;
                try {
                    host = ClipHub.Filter &&
                        typeof ClipHub.Filter.getPrimaryHostState === "function" ?
                        ClipHub.Filter.getPrimaryHostState() : null;
                } catch (ignoredHost) { host = null; }
                state.panelWidthDp = Number(host && host.widthDp || 0);
                state.panelHeightDp = Number(host && host.heightDp || 0);
                state.panelWidthPx = state.panelWidthDp > 0 ?
                    dp(state.panelWidthDp) : null;
                state.panelHeightPx = state.panelHeightDp > 0 ?
                    dp(state.panelHeightDp) : null;
                state.normalPanelHeightDp = Number(state.panelHeightDp || 0);
                state.currentPanelHeightDp = Number(state.panelHeightDp || 0);
                state.currentPanelTopDp = 0;
                if (!mountPrimaryEditorPage()) {
                    state.open = false;
                    state.attached = false;
                    clearViews();
                    throw new Error("ClipHub primary editor mount failed");
                }
                if (state.mode === "tags") {
                    state.editorStyle = "legacy_tags_v1";
                    buildTagContent(requestKeyboard);
                    syncPrimaryEditorPage("tags", "选择标签", function () {
                        return requestExit("shell_tag_back");
                    });
                } else {
                    buildTextContent(initialText, row, {
                        requestKeyboard: requestKeyboard
                    });
                }
                bindTokenizerToEditor();
                return { ok: true, attached: true, embedded: true,
                    mode: state.mode, itemId: state.itemId, state: getState() };
            }
'''
    fn = replace_once(fn,
'''            panelManagedFrame = ClipHub.Window.createManagedFrame(panelRoot, {
                accentColor: colors.accentStrong
            });''',
embedded_block + '''            panelManagedFrame = ClipHub.Window.createManagedFrame(panelRoot, {
                accentColor: colors.accentStrong
            });''',
"editor embedded open branch")
    fn = replace_once(fn,
'''            panelWindowRoot = panelManagedFrame.rootView;
            panelParams = new WindowManager.LayoutParams(''',
'''            panelWindowRoot = panelManagedFrame.rootView;
            panelOverlayHost = panelManagedFrame.panelView;
            panelParams = new WindowManager.LayoutParams(''',
"editor legacy overlay host")
    return fn
editor = patch_function(editor, "openPanel", patch_open)

# Observable state and module version.
def patch_state(fn):
    return replace_once(fn,
'''            ready: ready,
            open: state.open,
            attached: state.attached,''',
'''            ready: ready,
            open: state.open,
            attached: state.attached,
            embeddedInPrimary: embeddedInPrimary === true,''',
"editor state embedded")
editor = patch_function(editor, "getState", patch_state)
editor = replace_once(editor, 'MODULE_VERSION: 31,', 'MODULE_VERSION: 32,', "editor version")
write("src/ch_10_editor.js", editor)

# ---------------- TokenizerUI 2 -> 3 ----------------
tok_loader, tok_var, tok = unpack_loader("src/ch_17_tokenizer_ui.js")
if tok_var is None:
    raise AssertionError("tokenizer is expected to be packed")
tok = replace_once(tok,
'''    var editorPanelRoot = null;
    var editorWindowRoot = null;''',
'''    var editorPanelRoot = null;
    var editorWindowRoot = null;
    var editorEmbeddedInPrimary = false;''',
"tokenizer embedded var")

# Direct binding is required because an embedded Editor no longer calls Window.attachWindow.
binding_helpers = r'''
    function bindEditorRoot(contentView, rootView, embedded) {
        if (!contentView) { return false; }
        if (editorPanelRoot !== null && editorPanelRoot !== contentView) {
            clearEditorBinding(true);
        }
        editorPanelRoot = contentView;
        editorWindowRoot = rootView || contentView;
        editorEmbeddedInPrimary = embedded === true;
        installEditorObserver();
        scheduleEnsureEditorEntry();
        return true;
    }

    function syncTokenizerShell(pageId, title, onBack) {
        var id = String(pageId || "editor");
        var path = id === "editor" ? ["editor"] : ["editor", id];
        if (!editorEmbeddedInPrimary || !ClipHub.UIShell ||
                typeof ClipHub.UIShell.syncEmbeddedPage !== "function" ||
                editorWindowRoot === null) {
            return false;
        }
        return ClipHub.UIShell.syncEmbeddedPage({
            pageId: id,
            path: path,
            title: String(title || (id === "tokenizer" ? "分词" : "编辑剪贴板")),
            showBack: true,
            view: editorWindowRoot,
            onBack: typeof onBack === "function" ? onBack : function () {
                return ClipHub.Editor &&
                    typeof ClipHub.Editor.requestExit === "function" ?
                    ClipHub.Editor.requestExit("shell_back") : false;
            },
            onClose: function () {
                return ClipHub.Editor &&
                    typeof ClipHub.Editor.requestExit === "function" ?
                    ClipHub.Editor.requestExit("shell_close") : false;
            }
        }) === true;
    }
'''
anchor = '    function installWindowHooks() {'
if tok.count(anchor) != 1:
    raise AssertionError("tokenizer installWindowHooks anchor")
tok = tok.replace(anchor, binding_helpers + "\n" + anchor, 1)

# Existing legacy binding must explicitly remain non-embedded.
# The attach hook has a unique assignment pair in this module.
tok = replace_once(tok,
'''                editorPanelRoot = options.contentView;
                editorWindowRoot = options.rootView;''',
'''                editorPanelRoot = options.contentView;
                editorWindowRoot = options.rootView;
                editorEmbeddedInPrimary = false;''',
"tokenizer legacy bind")

# Clearing a binding always drops the embedded marker.
def patch_clear_binding(fn):
    return replace_once(fn,
'''        editorPanelRoot = null;
        editorWindowRoot = null;''',
'''        editorPanelRoot = null;
        editorWindowRoot = null;
        editorEmbeddedInPrimary = false;''',
"tokenizer clear embedded")
tok = patch_function(tok, "clearEditorBinding", patch_clear_binding)

# Shared shell owns the drag handle. Tokenizer keeps only its rule/help toolbar.
def patch_tok_drag(fn):
    return replace_once(fn,
'    function buildDragHandle(column) {\n',
'    function buildDragHandle(column) {\n        if (editorEmbeddedInPrimary) { return; }\n',
"tokenizer drag guard")
tok = patch_function(tok, "buildDragHandle", patch_tok_drag)


def patch_tok_header(fn):
    return replace_once(fn,
'''        var params;
        header.setOrientation(LinearLayout.HORIZONTAL);''',
'''        var params;
        if (editorEmbeddedInPrimary) {
            back.setVisibility(View.GONE);
            title.setText("");
            title.setVisibility(View.INVISIBLE);
        }
        header.setOrientation(LinearLayout.HORIZONTAL);''',
"tokenizer compact header")
tok = patch_function(tok, "buildHeader", patch_tok_header)


def patch_mount_tokenizer(fn):
    return replace_once(fn,
'''        editorPanelRoot.addView(buildPage(),
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));
        emitAction("open", {});''',
'''        editorPanelRoot.addView(buildPage(),
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));
        if (editorEmbeddedInPrimary) {
            syncTokenizerShell("tokenizer", "分词", function () {
                return returnToEditor("shell_back");
            });
        }
        emitAction("open", {});''',
"tokenizer shell mount")
tok = patch_function(tok, "mountFromEditor", patch_mount_tokenizer)


def patch_return_tokenizer(fn):
    return replace_once(fn,
'''        state.mounted = false;
        restoreEditorChildren();
        clearPageReferences();
        emitAction("back", { reason: String(reason || "back") });''',
'''        state.mounted = false;
        restoreEditorChildren();
        clearPageReferences();
        if (editorEmbeddedInPrimary) {
            var editorState = ClipHub.Editor &&
                typeof ClipHub.Editor.getState === "function" ?
                ClipHub.Editor.getState() : {};
            syncTokenizerShell("editor",
                String(editorState.mode) === "new" ?
                    "新增剪贴板" : "编辑剪贴板",
                function () {
                    return ClipHub.Editor &&
                        typeof ClipHub.Editor.requestExit === "function" ?
                        ClipHub.Editor.requestExit("shell_back") : false;
                });
        }
        emitAction("back", { reason: String(reason || "back") });''',
"tokenizer shell return")
tok = patch_function(tok, "returnToEditor", patch_return_tokenizer)

# State + public direct-bind API.
def patch_tok_state(fn):
    return replace_once(fn,
'''            mounted: state.mounted === true,
            editorBound: editorPanelRoot !== null,''',
'''            mounted: state.mounted === true,
            editorBound: editorPanelRoot !== null,
            embeddedInPrimary: editorEmbeddedInPrimary === true,''',
"tokenizer state embedded")
tok = patch_function(tok, "getState", patch_tok_state)

api_anchor = '''        ensureEditorEntry: function () {
            return runOnMainSync(function () {
                return installEditorEntry();
            }, 2500);
        },'''
api_new = api_anchor + '''
        bindEditorRoot: function (contentView, rootView, embedded) {
            return runOnMainSync(function () {
                return bindEditorRoot(contentView, rootView, embedded === true);
            }, 2500);
        },
        unbindEditorRoot: function (discardMounted) {
            return runOnMainSync(function () {
                clearEditorBinding(discardMounted === true);
                return true;
            }, 2500);
        },'''
tok = replace_once(tok, api_anchor, api_new, "tokenizer public bind api")
tok = replace_once(tok, 'MODULE_VERSION: 2,', 'MODULE_VERSION: 3,', "tokenizer version")
new_tok_loader = repack_loader("src/ch_17_tokenizer_ui.js", tok_loader, tok_var, tok)

# ---------------- Manifest + preflight ----------------
manifest_path = ROOT / "module-manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
if manifest.get("moduleSetVersion") != "20260815.13":
    raise AssertionError("unexpected moduleSetVersion: %r" % manifest.get("moduleSetVersion"))
manifest["moduleSetVersion"] = "20260815.14"
changed = {
    "ch_10_editor.js": read("src/ch_10_editor.js"),
    "ch_16_ui_shell.js": read("src/ch_16_ui_shell.js"),
    "ch_17_tokenizer_ui.js": new_tok_loader,
}
for item in manifest["modules"]:
    if item["name"] in changed:
        item["sha"] = blob_sha(changed[item["name"]])
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                         encoding="utf-8")

pre = read("scripts/release_preflight.sh")
pre = replace_once(pre,
"EXPECTED_MODULE_SET='20260815.13'",
"EXPECTED_MODULE_SET='20260815.14'",
"preflight module set")
pre = replace_once(pre,
'''            "ch_11_filter.js": ("ch_11_filter", 84),
            "ch_13_settings.js": ("ch_13_settings", 34),
            "ch_15_app.js": ("ch_15_app", 21),
            "ch_12_translation.js": ("ch_12_translation", 17),
            "ch_16_ui_shell.js": ("ch_16_ui_shell", 2),''',
'''            "ch_10_editor.js": ("ch_10_editor", 32),
            "ch_11_filter.js": ("ch_11_filter", 84),
            "ch_13_settings.js": ("ch_13_settings", 34),
            "ch_15_app.js": ("ch_15_app", 21),
            "ch_12_translation.js": ("ch_12_translation", 17),
            "ch_16_ui_shell.js": ("ch_16_ui_shell", 3),
            "ch_17_tokenizer_ui.js": ("ch_17_tokenizer_ui", 3),''',
"preflight stage3 versions")
pre = replace_once(pre,
'''        ui_shell_source = actual_sources["ch_16_ui_shell.js"]
        translation_source = actual_sources["ch_12_translation.js"]
        assert 'MODULE_NAME: "ch_16_ui_shell"' in ui_shell_source
        assert "MODULE_VERSION: 2" in ui_shell_source
        assert 'migrationStage: "primary_overlay_settings_regex_translation"' in ui_shell_source''',
'''        ui_shell_source = actual_sources["ch_16_ui_shell.js"]
        translation_source = actual_sources["ch_12_translation.js"]
        editor_source = actual_sources["ch_10_editor.js"]
        tokenizer_source = actual_sources["ch_17_tokenizer_ui.js"]
        assert 'MODULE_NAME: "ch_16_ui_shell"' in ui_shell_source
        assert "MODULE_VERSION: 3" in ui_shell_source
        assert 'migrationStage: "primary_overlay_settings_regex_translation_editor_tags_tokenizer"' in ui_shell_source''',
"preflight shell version contract")
pre = replace_once(pre,
'''        assert 'registerPage({ id: "editor"' in ui_shell_source
        assert 'registerPage({ id: "translation"' in ui_shell_source
        assert '"ch_16_ui_shell.js"' in entry''',
'''        assert 'registerPage({ id: "editor"' in ui_shell_source
        assert 'registerPage({ id: "translation"' in ui_shell_source
        assert 'registerPage({ id: "tokenizer", parentId: "editor"' in ui_shell_source
        assert "embeddedInPrimary" in editor_source
        assert "mountPrimaryEditorPage" in editor_source
        assert "syncPrimaryEditorPage" in editor_source
        assert "panelOverlayHost" in editor_source
        assert "bindEditorRoot" in tokenizer_source
        assert "editorEmbeddedInPrimary" in tokenizer_source
        assert 'syncTokenizerShell("tokenizer"' in tokenizer_source
        assert '"ch_16_ui_shell.js"' in entry''',
"preflight stage3 contracts")
pre = replace_once(pre,
'        print("UI shell stage2 contracts: passed")',
'        print("UI shell stage3 contracts: passed")',
"preflight stage label")
write("scripts/release_preflight.sh", pre)

print("UIShell Stage3 patch prepared")
print("moduleSetVersion=20260815.14")
print("Editor=32 UIShell=3 TokenizerUI=3 Filter=84")
