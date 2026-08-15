from __future__ import annotations

import base64
import gzip
import hashlib
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BRANCH = "beta-regex-settings-tabs-20260814"
OLD_SET = "20260815.11"
NEW_SET = "20260815.12"


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def write(path, text):
    (ROOT / path).write_text(text, encoding="utf-8")


def must_replace(text, old, new, count=1, label="replace"):
    actual = text.count(old)
    assert actual == count, (label, actual, count, old[:120])
    return text.replace(old, new, count)


def function_span(source, name):
    match = re.search(r"\bfunction\s+" + re.escape(name) + r"\s*\(", source)
    assert match is not None, ("missing function", name)
    brace = source.find("{", match.end())
    assert brace >= 0
    depth = 0
    quote = None
    escape = False
    index = brace
    while index < len(source):
        char = source[index]
        if quote is not None:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == quote:
                quote = None
        else:
            if char in ('"', "'"):
                quote = char
            elif char == "{":
                depth += 1
            elif char == "}":
                depth -= 1
                if depth == 0:
                    return match.start(), index + 1
        index += 1
    raise AssertionError(("unterminated function", name))


def transform_function(source, name, transform):
    start, end = function_span(source, name)
    old = source[start:end]
    new = transform(old)
    assert new != old, ("function unchanged", name)
    return source[:start] + new + source[end:]


def expand_loader(path):
    loader = read(path)
    match = re.search(r"\bvar\s+(PACKED_B64|encoded)\s*=\s*(.*?);", loader, re.S)
    if match is None:
        return loader, None
    pieces = re.findall(r'"(?:\\.|[^"\\])*"', match.group(2))
    encoded = "".join(json.loads(piece) for piece in pieces)
    source = gzip.decompress(base64.b64decode(encoded)).decode("utf-8")
    expected = re.search(
        r"\bvar\s+SOURCE_SHA256\s*=\s*['\"]([0-9a-fA-F]{64})['\"]", loader
    )
    if expected:
        actual = hashlib.sha256(source.encode("utf-8")).hexdigest()
        assert actual == expected.group(1).lower(), (path, actual, expected.group(1))
    return source, loader


def repack_loader(path, source, loader):
    if loader is None:
        write(path, source)
        return
    digest = hashlib.sha256(source.encode("utf-8")).hexdigest()
    packed = base64.b64encode(
        gzip.compress(source.encode("utf-8"), compresslevel=9, mtime=0)
    ).decode("ascii")
    chunks = [packed[i:i + 120] for i in range(0, len(packed), 120)]
    assignment = re.search(
        r"\bvar\s+(PACKED_B64|encoded)\s*=\s*(.*?);", loader, re.S
    )
    assert assignment is not None
    var_name = assignment.group(1)
    lines = []
    for index, chunk in enumerate(chunks):
        suffix = " +" if index < len(chunks) - 1 else ""
        lines.append('        "' + chunk + '"' + suffix)
    replacement = "var " + var_name + " =\n" + "\n".join(lines) + ";"
    loader = loader[:assignment.start()] + replacement + loader[assignment.end():]
    loader, replaced = re.subn(
        r"(\bvar\s+SOURCE_SHA256\s*=\s*['\"])[0-9a-fA-F]{64}(['\"])",
        r"\g<1>" + digest + r"\2", loader, count=1
    )
    assert replaced == 1, (path, "SOURCE_SHA256")
    write(path, loader)


def patch_filter():
    path = "src/ch_11_filter.js"
    source, loader = expand_loader(path)
    assert re.search(r'MODULE_NAME:\s*"ch_11_filter"\s*,\s*MODULE_VERSION:\s*83', source, re.S)

    source = must_replace(
        source,
        "    var panelRoot = null;\n",
        "    var panelRoot = null;\n"
        "    var primaryShellOverlay = null;\n"
        "    var primaryShellBodyHost = null;\n"
        "    var primaryShellPageView = null;\n"
        "    var primaryShellPageId = \"\";\n"
        "    var primaryShellTitle = \"\";\n",
        label="filter shell globals"
    )

    shell_functions = r'''
    function detachPrimaryShellPageView() {
        var parent;
        if (primaryShellPageView === null) { return true; }
        try {
            parent = primaryShellPageView.getParent();
            if (parent !== null && typeof parent.removeView === "function") {
                parent.removeView(primaryShellPageView);
            }
        } catch (ignored) {}
        return true;
    }

    function dropPrimaryChildOverlayForDestroy() {
        var parent;
        detachPrimaryShellPageView();
        if (primaryShellOverlay !== null) {
            try {
                parent = primaryShellOverlay.getParent();
                if (parent !== null && typeof parent.removeView === "function") {
                    parent.removeView(primaryShellOverlay);
                }
            } catch (ignoredOverlay) {}
        }
        primaryShellOverlay = null;
        primaryShellBodyHost = null;
        primaryShellPageView = null;
        primaryShellPageId = "";
        primaryShellTitle = "";
        state.homeWindowSuspended = false;
        return true;
    }

    function getPrimaryHostState() {
        var panelState = {};
        try { panelState = getPanelState() || {}; } catch (ignored) {}
        return {
            ready: state.attached === true && rootMode === true &&
                panelManagedFrame !== null && panelManagedFrame.panelView !== null,
            attached: state.attached === true,
            rootMode: rootMode === true,
            childAttached: primaryShellOverlay !== null,
            childPageId: String(primaryShellPageId || ""),
            childTitle: String(primaryShellTitle || ""),
            widthDp: Number(panelState.panelWidthDp || state.panelWidthDp || 0),
            heightDp: Number(panelState.panelHeightDp || state.panelHeightDp || 0),
            homeCachePreserved: panelRoot !== null,
            windowReuseOnly: true
        };
    }

    function buildPrimaryChildHeader(spec, colors) {
        var metrics = headerMetrics();
        var row = new LinearLayout(appContext);
        var title = makeText(String(spec.title || ""), metrics.titleSp,
            colors.textPrimary, true);
        var back = null;
        var close = makeHeaderAction("×", colors, metrics, false);
        var params;
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        if (spec.showBack === true) {
            back = makeHeaderAction("‹", colors, metrics, false);
            back.setOnClickListener(new JavaAdapter(View.OnClickListener, {
                onClick: function () {
                    if (ClipHub.UIShell &&
                            typeof ClipHub.UIShell.dispatchBack === "function") {
                        ClipHub.UIShell.dispatchBack("header_back");
                    }
                }
            }));
            row.addView(back, new LinearLayout.LayoutParams(
                dp(metrics.actionSizeDp), dp(metrics.actionSizeDp)));
            params = new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1);
            params.leftMargin = dp(metrics.gapDp);
        } else {
            params = new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1);
        }
        title.setSingleLine(true);
        title.setEllipsize(TextUtils.TruncateAt.END);
        row.addView(title, params);
        close.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () {
                if (ClipHub.UIShell &&
                        typeof ClipHub.UIShell.dispatchClose === "function") {
                    ClipHub.UIShell.dispatchClose("header_close");
                }
            }
        }));
        params = new LinearLayout.LayoutParams(
            dp(metrics.actionSizeDp), dp(metrics.actionSizeDp));
        if (spec.showBack === true) { params.leftMargin = dp(metrics.gapDp); }
        row.addView(close, params);
        return row;
    }

    function mountPrimaryChildPage(spec) {
        var host = getPrimaryHostState();
        var colors;
        var layout;
        var metrics;
        var overlay;
        var handleSlot;
        var handle;
        var handleParams;
        var header;
        var params;
        var parent;
        spec = spec || {};
        if (!host.ready || !spec.view) {
            throw new Error("ClipHub primary shell host is unavailable");
        }
        dropPrimaryChildOverlayForDestroy();
        colors = palette();
        layout = ClipHub.Theme.getMetrics();
        metrics = headerMetrics();
        overlay = new LinearLayout(appContext);
        overlay.setOrientation(LinearLayout.VERTICAL);
        overlay.setPadding(dp(layout.screenPaddingDp),
            dp(layout.pagePaddingTopDp), dp(layout.screenPaddingDp),
            dp(layout.pagePaddingBottomDp));
        overlay.setBackground(roundedBackground(colors.surface,
            colors.stroke, layout.pageRadiusDp));
        overlay.setClickable(true);
        overlay.setFocusable(true);

        handleSlot = new FrameLayout(appContext);
        handle = new View(appContext);
        handle.setBackground(roundedBackground(colors.accentBorder, null, 3));
        handleParams = new FrameLayout.LayoutParams(
            dp(layout.dragHandleWidthDp || 42),
            dp(layout.dragHandleHeightDp || 4));
        handleParams.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        handleParams.topMargin = dp(6);
        handleSlot.addView(handle, handleParams);
        overlay.addView(handleSlot, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(12)));

        header = buildPrimaryChildHeader(spec, colors);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(metrics.actionSizeDp));
        params.bottomMargin = dp(metrics.gapDp);
        overlay.addView(header, params);

        primaryShellBodyHost = new FrameLayout(appContext);
        parent = spec.view.getParent();
        if (parent !== null && typeof parent.removeView === "function") {
            parent.removeView(spec.view);
        }
        primaryShellBodyHost.addView(spec.view, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT));
        overlay.addView(primaryShellBodyHost, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));
        panelManagedFrame.panelView.addView(overlay,
            new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));
        if (panelRoot !== null) { panelRoot.setVisibility(View.INVISIBLE); }
        primaryShellOverlay = overlay;
        primaryShellPageView = spec.view;
        primaryShellPageId = String(spec.pageId || "");
        primaryShellTitle = String(spec.title || "");
        state.homeWindowSuspended = true;
        state.homeSuspendCount = Number(state.homeSuspendCount || 0) + 1;
        return getPrimaryHostState();
    }

    function unmountPrimaryChildPage(reason) {
        var hadChild = primaryShellOverlay !== null;
        dropPrimaryChildOverlayForDestroy();
        if (panelRoot !== null) { panelRoot.setVisibility(View.VISIBLE); }
        if (hadChild) {
            state.homeRestoreCount = Number(state.homeRestoreCount || 0) + 1;
        }
        return {
            ok: true,
            restoredHome: panelRoot !== null,
            reason: String(reason || "child_close"),
            host: getPrimaryHostState()
        };
    }

'''
    anchor = "    function createPanelCache(size, type, colors) {"
    assert source.count(anchor) == 1
    source = source.replace(anchor, shell_functions + anchor, 1)

    def patch_destroy(func):
        brace = func.find("{")
        return func[:brace + 1] + "\n        dropPrimaryChildOverlayForDestroy();" + func[brace + 1:]
    source = transform_function(source, "destroyPanelCache", patch_destroy)

    back_match = re.search(
        r'onRequestBack:\s*function\s*\(\)\s*\{\s*return\s+([A-Za-z0-9_$]+)\(',
        source
    )
    if back_match:
        back_name = back_match.group(1)
        def patch_back(func):
            brace = func.find("{")
            guard = (
                "\n        if (primaryShellOverlay !== null && ClipHub.UIShell &&\n"
                "                typeof ClipHub.UIShell.dispatchBack === \"function\") {\n"
                "            return ClipHub.UIShell.dispatchBack(\"system_back\");\n"
                "        }"
            )
            return func[:brace + 1] + guard + func[brace + 1:]
        source = transform_function(source, back_name, patch_back)
    else:
        raise AssertionError("Filter managed onRequestBack anchor missing")

    source, n = re.subn(
        r'(MODULE_NAME:\s*"ch_11_filter"\s*,\s*MODULE_VERSION:\s*)83',
        r'\g<1>84', source, count=1, flags=re.S
    )
    assert n == 1
    export_anchor = "        getPanelState: getPanelState,\n"
    assert source.count(export_anchor) == 1
    source = source.replace(
        export_anchor,
        export_anchor +
        "        getPrimaryHostState: getPrimaryHostState,\n"
        "        mountPrimaryChildPage: mountPrimaryChildPage,\n"
        "        unmountPrimaryChildPage: unmountPrimaryChildPage,\n",
        1
    )
    repack_loader(path, source, loader)


def patch_settings():
    path = "src/ch_13_settings.js"
    source, loader = expand_loader(path)
    assert re.search(r'MODULE_NAME:\s*"ch_13_settings"\s*,\s*MODULE_VERSION:\s*32', source, re.S)
    source = must_replace(
        source, "    var panelRoot = null;\n",
        "    var panelRoot = null;\n    var embeddedInPrimary = false;\n",
        label="settings embedded global"
    )

    helpers = r'''
    function canUsePrimarySettingsShell() {
        try {
            return ClipHub.UIShell &&
                typeof ClipHub.UIShell.canEmbed === "function" &&
                ClipHub.UIShell.canEmbed("settings") === true;
        } catch (ignored) { return false; }
    }

    function setSettingsContentPadding(content) {
        if (embeddedInPrimary) {
            content.setPadding(0, 0, 0, dp(28));
        } else {
            content.setPadding(dp(12), dp(8), dp(12), dp(28));
        }
        return content;
    }

    function settingsShellPageId() {
        if (settingsPage === "regex_rules") { return "regex_rules"; }
        if (settingsPage === "regex_editor") { return "regex_editor"; }
        if (settingsPage === "regex_test") { return "regex_test"; }
        return "settings";
    }

    function settingsShellTitle() {
        if (settingsPage === "regex_rules") { return "正则表达式规则"; }
        if (settingsPage === "regex_editor") {
            return regexEditorRuleId === null ? "新增正则规则" : "编辑正则规则";
        }
        if (settingsPage === "regex_test") { return "测试正则表达式"; }
        return "ClipHub 设置";
    }

    function settingsShellPath() {
        if (settingsPage === "regex_test") {
            return ["settings", "regex_rules", "regex_editor", "regex_test"];
        }
        if (settingsPage === "regex_editor") {
            return ["settings", "regex_rules", "regex_editor"];
        }
        if (settingsPage === "regex_rules") {
            return ["settings", "regex_rules"];
        }
        return ["settings"];
    }

    function syncSettingsShellPage() {
        if (!embeddedInPrimary || panelRoot === null || !ClipHub.UIShell ||
                typeof ClipHub.UIShell.syncEmbeddedPage !== "function") {
            return false;
        }
        ClipHub.UIShell.syncEmbeddedPage({
            path: settingsShellPath(),
            pageId: settingsShellPageId(),
            title: settingsShellTitle(),
            showBack: settingsPage !== "root",
            view: panelRoot,
            onBack: handleSettingsBack,
            onClose: function () { return closePage("button"); }
        });
        return true;
    }

    function openEmbeddedSettingsPage() {
        var host;
        try {
            host = ClipHub.Filter.getPrimaryHostState();
            if (!host || host.ready !== true) { return null; }
            settingsLifecycleGeneration += 1;
            panelRoot = new FrameLayout(appContext);
            scrollRoot = new ScrollView(appContext);
            scrollRoot.setVerticalScrollBarEnabled(false);
            panelRoot.addView(scrollRoot, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));
            panelWindowRoot = null;
            panelManagedFrame = null;
            panelParams = null;
            embeddedInPrimary = true;
            uiState.attached = true;
            uiState.openCount += 1;
            uiState.panelWidthDp = Number(host.widthDp || 0);
            uiState.panelHeightDp = Number(host.heightDp || 0);
            uiState.normalPanelHeightDp = uiState.panelHeightDp;
            uiState.currentPanelHeightDp = uiState.panelHeightDp;
            uiState.currentPanelTopDp = 0;
            uiState.panelGravity = "primary_child";
            uiState.panelBottomMarginDp = 0;
            uiState.panelClipToOutline = false;
            uiState.softInputMode = Number(
                WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE |
                WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN);
            uiState.softInputAdjustResize = true;
            imeRestoreLayout = null;
            uiState.lastError = null;
            settingsPage = "root";
            settingsTab = "general";
            uiState.settingsTab = settingsTab;
            uiState.lastSettingsTab = settingsTab;
            ClipHub.UIShell.mountPage("settings", panelRoot, {
                title: "ClipHub 设置",
                showBack: false,
                onBack: handleSettingsBack,
                onClose: function () { return closePage("button"); }
            });
            buildPage();
            return getState();
        } catch (error) {
            try {
                if (ClipHub.UIShell &&
                        typeof ClipHub.UIShell.unmountPage === "function") {
                    ClipHub.UIShell.unmountPage("settings", "embed_open_failed");
                }
            } catch (ignoredUnmount) {}
            embeddedInPrimary = false;
            uiState.attached = false;
            panelRoot = null;
            scrollRoot = null;
            contentRoot = null;
            uiState.lastError = String(error);
            return null;
        }
    }

'''
    anchor = "    function buildRootPage() {"
    assert source.count(anchor) == 1
    source = source.replace(anchor, helpers + anchor, 1)

    def patch_root(func):
        func = must_replace(
            func,
            "        content.setPadding(dp(12), dp(8), dp(12), dp(28));",
            "        setSettingsContentPadding(content);",
            label="settings root padding"
        )
        start_token = "        handleRow.setGravity(Gravity.CENTER);"
        end_token = "        content.addView(header, params);"
        start = func.find(start_token)
        end = func.find(end_token, start)
        assert start >= 0 and end >= 0, "settings root chrome anchors"
        end += len(end_token)
        segment = func[start:end]
        wrapped = "        if (!embeddedInPrimary) {\n" + segment + "\n        }"
        return func[:start] + wrapped + func[end:]
    source = transform_function(source, "buildRootPage", patch_root)

    for func_name in ("buildRegexRulesPage", "buildRegexEditorPage", "buildRegexTestPage"):
        def patch_regex_page(func, label=func_name):
            return must_replace(
                func,
                "        content.setPadding(dp(12), dp(8), dp(12), dp(28));",
                "        setSettingsContentPadding(content);",
                label=label + " padding"
            )
        source = transform_function(source, func_name, patch_regex_page)

    def patch_subheader(func):
        brace = func.find("{")
        guard = "\n        if (embeddedInPrimary) { return null; }"
        return func[:brace + 1] + guard + func[brace + 1:]
    source = transform_function(source, "makeSettingsSubpageHeader", patch_subheader)

    def patch_install(func):
        token = "        uiState.renderCount += 1;\n        return true;"
        return must_replace(
            func, token,
            "        uiState.renderCount += 1;\n"
            "        syncSettingsShellPage();\n"
            "        return true;",
            label="settings install sync"
        )
    source = transform_function(source, "installSettingsContent", patch_install)

    def patch_open(func):
        func = must_replace(
            func, "        var type;\n", "        var type;\n        var embeddedState;\n",
            label="settings open var"
        )
        token = (
            "        if (settingsRemovalPending || settingsClosing) {\n"
            "            pendingSettingsOpen = true;\n"
            "            return getState();\n"
            "        }\n"
        )
        addition = token + (
            "        if (canUsePrimarySettingsShell()) {\n"
            "            embeddedState = openEmbeddedSettingsPage();\n"
            "            if (embeddedState !== null) { return embeddedState; }\n"
            "        }\n"
        )
        return must_replace(func, token, addition, label="settings embedded open branch")
    source = transform_function(source, "openPage", patch_open)

    def patch_close(func):
        old = (
            "            var capturedRoot = panelWindowRoot !== null ?\n"
            "                panelWindowRoot : panelRoot;"
        )
        new = (
            "            var wasEmbedded = embeddedInPrimary === true;\n"
            "            var capturedRoot = wasEmbedded ? null :\n"
            "                (panelWindowRoot !== null ? panelWindowRoot : panelRoot);"
        )
        func = must_replace(func, old, new, label="settings captured root")
        token = "            hideSettingsKeyboardOnMain();\n"
        addition = token + (
            "            if (wasEmbedded && ClipHub.UIShell &&\n"
            "                    typeof ClipHub.UIShell.unmountPage === \"function\") {\n"
            "                ClipHub.UIShell.unmountPage(\"settings\", reasonText);\n"
            "            }\n"
            "            embeddedInPrimary = false;\n"
        )
        return must_replace(func, token, addition, label="settings embedded close")
    source = transform_function(source, "closePage", patch_close)

    def patch_state(func):
        token = "            attached: uiState.attached,\n"
        return must_replace(
            func, token,
            token + "            embeddedInPrimary: embeddedInPrimary === true,\n",
            label="settings state embedded"
        )
    source = transform_function(source, "getState", patch_state)

    source, n = re.subn(
        r'(MODULE_NAME:\s*"ch_13_settings"\s*,\s*MODULE_VERSION:\s*)32',
        r'\g<1>33', source, count=1, flags=re.S
    )
    assert n == 1
    repack_loader(path, source, loader)


def patch_translation():
    path = "src/ch_12_translation.js"
    source, loader = expand_loader(path)
    assert re.search(r'MODULE_NAME:\s*"ch_12_translation"\s*,\s*MODULE_VERSION:\s*16', source, re.S)
    source = must_replace(
        source, "    var translationRoot = null;\n",
        "    var translationRoot = null;\n    var translationEmbeddedInPrimary = false;\n",
        label="translation embedded global"
    )

    def patch_build(func):
        func = must_replace(func, "        var params;\n", "        var params;\n        var embedded = translationEmbeddedInPrimary === true;\n", label="translation embedded var")
        start_token = "        root.setOrientation(LinearLayout.VERTICAL);"
        end_token = "        root.addView(header, params);"
        start = func.find(start_token)
        end = func.find(end_token, start)
        assert start >= 0 and end >= 0, "translation chrome anchors"
        end += len(end_token)
        replacement = r'''        root.setOrientation(LinearLayout.VERTICAL);
        if (embedded) {
            root.setPadding(0, 0, 0, 0);
            translationHeaderCloseView = null;
        } else {
            root.setPadding(dp(12), dp(8), dp(12), dp(10));
            root.setBackground(translationRounded(colors.surface,
                colors.stroke, 24));
            handleRow.setGravity(Gravity.CENTER);
            handle.setBackground(translationRounded(colors.accentBorder, null, 3));
            handleRow.addView(handle, new LinearLayout.LayoutParams(dp(42), dp(4)));
            root.addView(handleRow, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(16)));

            header.setOrientation(LinearLayout.HORIZONTAL);
            header.setGravity(Gravity.CENTER_VERTICAL);
            header.addView(title, new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
            translationHeaderCloseView = translationText(
                "×", 22, colors.icon, true);
            translationHeaderCloseView.setGravity(Gravity.CENTER);
            translationHeaderCloseView.setBackground(translationRounded(
                colors.surfaceMuted, null, 18));
            translationHeaderCloseView.setClickable(true);
            translationHeaderCloseView.setFocusable(true);
            translationHeaderCloseView.setOnClickListener(new JavaAdapter(
                View.OnClickListener, { onClick: function () {
                    closeTranslationPanel("button");
                }}));
            header.addView(translationHeaderCloseView,
                new LinearLayout.LayoutParams(dp(36), dp(36)));
            params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(36));
            params.topMargin = -dp(4);
            params.bottomMargin = dp(6);
            root.addView(header, params);
        }'''
        return func[:start] + replacement + func[end:]
    source = transform_function(source, "buildTranslationPanel", patch_build)

    def patch_open(func):
        old = (
            "        if (translationState.attached || translationRoot !== null) {\n"
            "            pendingTranslationItemId = Number(itemId);\n"
            "            closeTranslationPanel(\"replace\");\n"
            "            return getTranslationState();\n"
            "        }"
        )
        new = (
            "        if (translationState.attached || translationRoot !== null) {\n"
            "            if (translationEmbeddedInPrimary) {\n"
            "                closeTranslationPanel(\"replace\");\n"
            "            } else {\n"
            "                pendingTranslationItemId = Number(itemId);\n"
            "                closeTranslationPanel(\"replace\");\n"
            "                return getTranslationState();\n"
            "            }\n"
            "        }"
        )
        func = must_replace(func, old, new, label="translation replace embedded")
        marker = "        translationState.lastError = null;\n"
        branch = marker + r'''        if (ClipHub.UIShell &&
                typeof ClipHub.UIShell.canEmbed === "function" &&
                ClipHub.UIShell.canEmbed("translation") === true) {
            runOnMainSync(function () {
                var host = ClipHub.Filter.getPrimaryHostState();
                translationEmbeddedInPrimary = true;
                translationRoot = buildTranslationPanel();
                translationWindowRoot = null;
                translationManagedFrame = null;
                translationParams = null;
                translationState.attached = true;
                translationState.panelWidthDp = Number(host.widthDp || 0);
                translationState.panelHeightDp = Number(host.heightDp || 0);
                ClipHub.UIShell.mountPage("translation", translationRoot, {
                    title: "翻译结果",
                    showBack: false,
                    onBack: function () {
                        return closeTranslationPanel("shell_back");
                    },
                    onClose: function () {
                        return closeTranslationPanel("button");
                    }
                });
                return true;
            }, 3000);
            beginTranslation();
            return getTranslationState();
        }
'''
        return must_replace(func, marker, branch, label="translation embedded open")
    source = transform_function(source, "openTranslationForItem", patch_open)

    def patch_close(func):
        old = (
            "            var capturedRoot = translationWindowRoot !== null ?\n"
            "                translationWindowRoot : translationRoot;"
        )
        new = (
            "            var wasEmbedded = translationEmbeddedInPrimary === true;\n"
            "            var capturedRoot = wasEmbedded ? null :\n"
            "                (translationWindowRoot !== null ?\n"
            "                    translationWindowRoot : translationRoot);"
        )
        func = must_replace(func, old, new, label="translation captured root")
        token = "            translationClosing = true;\n"
        addition = (
            "            if (wasEmbedded && ClipHub.UIShell &&\n"
            "                    typeof ClipHub.UIShell.unmountPage === \"function\") {\n"
            "                ClipHub.UIShell.unmountPage(\"translation\", reasonText);\n"
            "            }\n"
            "            translationEmbeddedInPrimary = false;\n" + token
        )
        return must_replace(func, token, addition, label="translation embedded close")
    source = transform_function(source, "closeTranslationPanel", patch_close)

    def patch_state(func):
        token = "            attached: translationState.attached,\n"
        return must_replace(
            func, token,
            token + "            embeddedInPrimary: translationEmbeddedInPrimary === true,\n",
            label="translation state embedded"
        )
    source = transform_function(source, "getTranslationState", patch_state)

    source, n = re.subn(
        r'(MODULE_NAME:\s*"ch_12_translation"\s*,\s*MODULE_VERSION:\s*)16',
        r'\g<1>17', source, count=1, flags=re.S
    )
    assert n == 1
    repack_loader(path, source, loader)


def patch_shell():
    path = "src/ch_16_ui_shell.js"
    old = read(path)
    assert 'MODULE_VERSION: 1' in old
    source = r'''(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var initialized = false;
    var runtimeContext = null;
    var pages = {};
    var pageOrder = [];
    var stack = [];
    var visible = false;
    var generation = 0;
    var mutationCount = 0;
    var lastAction = "none";
    var lastReason = "";
    var activePageId = null;
    var activeView = null;
    var activeBack = null;
    var activeClose = null;
    var mountCount = 0;
    var unmountCount = 0;
    var syncCount = 0;

    function normalizeId(value) {
        return String(value === null || value === undefined ? "" : value)
            .replace(/^\s+|\s+$/g, "");
    }

    function copyObject(source) {
        var output = {};
        var key;
        source = source || {};
        for (key in source) {
            if (source.hasOwnProperty(key)) { output[key] = source[key]; }
        }
        return output;
    }

    function copyDescriptor(source) {
        return {
            id: String(source.id),
            parentId: source.parentId === null ? null : String(source.parentId),
            owner: String(source.owner || source.id),
            moduleName: String(source.moduleName || ""),
            cachePolicy: String(source.cachePolicy || "lazy"),
            legacySurface: String(source.legacySurface || ""),
            shellReady: source.shellReady === true
        };
    }

    function requirePage(pageId) {
        var id = normalizeId(pageId);
        if (!id || !pages[id]) { throw new Error("Unknown UI page: " + id); }
        return pages[id];
    }

    function registerPage(descriptor) {
        var value = descriptor || {};
        var id = normalizeId(value.id);
        var parentId = value.parentId === null || value.parentId === undefined ?
            null : normalizeId(value.parentId);
        var page;
        if (!id) { throw new Error("UI page id is required"); }
        if (pages[id]) { throw new Error("Duplicate UI page: " + id); }
        if (parentId !== null && !pages[parentId]) {
            throw new Error("UI page parent is not registered: " + parentId);
        }
        page = {
            id: id,
            parentId: parentId,
            owner: normalizeId(value.owner || id),
            moduleName: normalizeId(value.moduleName || ""),
            cachePolicy: normalizeId(value.cachePolicy || "lazy"),
            legacySurface: normalizeId(value.legacySurface || ""),
            shellReady: value.shellReady === true
        };
        pages[id] = page;
        pageOrder.push(id);
        mutationCount += 1;
        return copyDescriptor(page);
    }

    function installDefaultPages() {
        registerPage({ id: "home", parentId: null, owner: "home",
            moduleName: "Filter", cachePolicy: "keep",
            legacySurface: "filter_root", shellReady: true });
        registerPage({ id: "detail", parentId: "home", owner: "detail",
            moduleName: "List", cachePolicy: "rebind",
            legacySurface: "detail", shellReady: false });
        registerPage({ id: "editor", parentId: "home", owner: "editor",
            moduleName: "Editor", cachePolicy: "rebind",
            legacySurface: "editor", shellReady: false });
        registerPage({ id: "tags", parentId: "editor", owner: "tags",
            moduleName: "Editor", cachePolicy: "lazy",
            legacySurface: "tags", shellReady: false });
        registerPage({ id: "filter", parentId: "home", owner: "filter",
            moduleName: "Filter", cachePolicy: "lazy",
            legacySurface: "filter", shellReady: false });
        registerPage({ id: "settings", parentId: "home", owner: "settings",
            moduleName: "Settings", cachePolicy: "lazy",
            legacySurface: "settings", shellReady: true });
        registerPage({ id: "regex_rules", parentId: "settings",
            owner: "settings", moduleName: "Settings", cachePolicy: "lazy",
            legacySurface: "settings", shellReady: true });
        registerPage({ id: "regex_editor", parentId: "regex_rules",
            owner: "settings", moduleName: "Settings", cachePolicy: "rebind",
            legacySurface: "settings", shellReady: true });
        registerPage({ id: "regex_test", parentId: "regex_editor",
            owner: "settings", moduleName: "Settings", cachePolicy: "transient",
            legacySurface: "settings", shellReady: true });
        registerPage({ id: "translation", parentId: "home",
            owner: "translation", moduleName: "Translation",
            cachePolicy: "rebind", legacySurface: "translation",
            shellReady: true });
        registerPage({ id: "tokenizer", parentId: "home", owner: "tokenizer",
            moduleName: "TokenizerUI", cachePolicy: "rebind",
            legacySurface: "tokenizer", shellReady: false });
    }

    function stackIds() {
        var output = [];
        var index;
        for (index = 0; index < stack.length; index += 1) {
            output.push(String(stack[index].id));
        }
        return output;
    }

    function pageIds() { return pageOrder.slice(0); }

    function primaryHostState() {
        try {
            if (ClipHub.Filter &&
                    typeof ClipHub.Filter.getPrimaryHostState === "function") {
                return ClipHub.Filter.getPrimaryHostState() || {};
            }
        } catch (ignored) {}
        return { ready: false, attached: false, rootMode: false };
    }

    function currentPageId() {
        return stack.length > 0 ? String(stack[stack.length - 1].id) : null;
    }

    function isSameShellFamily(pageId) {
        var current = currentPageId();
        if (current === "home") { return true; }
        if (pageId === "translation") { return current === "translation"; }
        if (pageId === "settings") {
            return current === "settings" || current === "regex_rules" ||
                current === "regex_editor" || current === "regex_test";
        }
        return false;
    }

    function canEmbed(pageId) {
        var id = normalizeId(pageId);
        var host = primaryHostState();
        if (!initialized || host.ready !== true) { return false; }
        if (id !== "settings" && id !== "translation" &&
                id !== "regex_rules" && id !== "regex_editor" &&
                id !== "regex_test") { return false; }
        return isSameShellFamily(id === "translation" ? "translation" : "settings");
    }

    function setStackPath(path, reason) {
        var ids = path || [];
        var next = [{ id: "home", params: {} }];
        var parent = "home";
        var index;
        var page;
        for (index = 0; index < ids.length; index += 1) {
            page = requirePage(ids[index]);
            if (page.parentId !== parent) {
                throw new Error("UI shell path parent mismatch: " + page.id);
            }
            next.push({ id: page.id, params: {} });
            parent = page.id;
        }
        stack = next;
        visible = true;
        generation += 1;
        mutationCount += 1;
        syncCount += 1;
        lastAction = "sync_path";
        lastReason = String(reason || "");
        return getState();
    }

    function applyActivePage(spec, reason) {
        activePageId = normalizeId(spec.pageId);
        activeView = spec.view || activeView;
        activeBack = typeof spec.onBack === "function" ? spec.onBack : null;
        activeClose = typeof spec.onClose === "function" ? spec.onClose : null;
        ClipHub.Filter.mountPrimaryChildPage({
            pageId: activePageId,
            title: String(spec.title || ""),
            showBack: spec.showBack === true,
            view: activeView
        });
        lastReason = String(reason || "");
        return getState();
    }

    function mountPage(pageId, view, options) {
        var id = normalizeId(pageId);
        var page = requirePage(id);
        var opts = options || {};
        if (!view) { throw new Error("UI shell page view is required: " + id); }
        if (!canEmbed(id)) { throw new Error("UI shell embed unavailable: " + id); }
        if (page.parentId !== "home") {
            throw new Error("mountPage only accepts direct home children: " + id);
        }
        setStackPath([id], "mount:" + id);
        activeView = view;
        mountCount += 1;
        return applyActivePage({
            pageId: id,
            title: opts.title || id,
            showBack: opts.showBack === true,
            view: view,
            onBack: opts.onBack,
            onClose: opts.onClose
        }, "mount:" + id);
    }

    function syncEmbeddedPage(spec) {
        var value = spec || {};
        var path = value.path || [];
        var id = normalizeId(value.pageId);
        if (!activeView || !canEmbed(id)) { return false; }
        setStackPath(path, "sync:" + id);
        applyActivePage({
            pageId: id,
            title: value.title || id,
            showBack: value.showBack === true,
            view: value.view || activeView,
            onBack: value.onBack,
            onClose: value.onClose
        }, "sync:" + id);
        return true;
    }

    function unmountPage(pageId, reason) {
        var id = normalizeId(pageId);
        if (activePageId === null) { return true; }
        if (id && id !== activePageId &&
                !(id === "settings" && (activePageId === "regex_rules" ||
                    activePageId === "regex_editor" || activePageId === "regex_test"))) {
            return false;
        }
        if (ClipHub.Filter &&
                typeof ClipHub.Filter.unmountPrimaryChildPage === "function") {
            ClipHub.Filter.unmountPrimaryChildPage(reason || "unmount");
        }
        activePageId = null;
        activeView = null;
        activeBack = null;
        activeClose = null;
        unmountCount += 1;
        stack = [{ id: "home", params: {} }];
        visible = true;
        generation += 1;
        mutationCount += 1;
        lastAction = "unmount";
        lastReason = String(reason || "");
        return true;
    }

    function dispatchBack(reason) {
        lastAction = "dispatch_back";
        lastReason = String(reason || "");
        if (typeof activeBack === "function") { return activeBack(); }
        if (activePageId !== null) { return unmountPage(activePageId, reason); }
        return false;
    }

    function dispatchClose(reason) {
        lastAction = "dispatch_close";
        lastReason = String(reason || "");
        if (typeof activeClose === "function") { return activeClose(); }
        if (activePageId !== null) { return unmountPage(activePageId, reason); }
        return false;
    }

    function enterRoot(pageId, params, reason) {
        var page = requirePage(pageId);
        if (page.parentId !== null) {
            throw new Error("UI root page must not have a parent: " + page.id);
        }
        stack = [{ id: page.id, params: copyObject(params) }];
        visible = true;
        generation += 1;
        mutationCount += 1;
        lastAction = "enter_root";
        lastReason = String(reason || "");
        return getState();
    }

    function pushPage(pageId, params, reason) {
        var page = requirePage(pageId);
        var currentId = currentPageId();
        if (page.parentId !== null && currentId !== page.parentId) {
            throw new Error("UI page parent mismatch: " + page.id +
                " requires " + page.parentId + ", current=" + currentId);
        }
        stack.push({ id: page.id, params: copyObject(params) });
        visible = true;
        generation += 1;
        mutationCount += 1;
        lastAction = "push";
        lastReason = String(reason || "");
        return getState();
    }

    function popPage(reason) {
        if (stack.length <= 1) { return false; }
        stack.pop();
        generation += 1;
        mutationCount += 1;
        lastAction = "pop";
        lastReason = String(reason || "");
        return true;
    }

    function clearToRoot(reason) {
        if (activePageId !== null) { unmountPage(activePageId, reason); }
        if (stack.length < 1) { stack = [{ id: "home", params: {} }]; }
        else if (stack.length > 1) { stack = [stack[0]]; }
        generation += 1;
        mutationCount += 1;
        lastAction = "clear_to_root";
        lastReason = String(reason || "");
        return getState();
    }

    function setVisible(value, reason) {
        visible = value === true;
        generation += 1;
        mutationCount += 1;
        lastAction = visible ? "visible" : "hidden";
        lastReason = String(reason || "");
        return visible;
    }

    function markShellReady(pageId, ready) {
        var page = requirePage(pageId);
        page.shellReady = ready === true;
        mutationCount += 1;
        return page.shellReady;
    }

    function getState() {
        var host = primaryHostState();
        return {
            initialized: initialized === true,
            migrationStage: "primary_overlay_settings_regex_translation",
            primaryWindowMode: true,
            legacyWindowBridge: true,
            hostAttached: host.ready === true,
            hostRootMode: host.rootMode === true,
            childAttached: host.childAttached === true,
            activePageId: activePageId,
            visible: visible === true,
            rootPageId: stack.length > 0 ? String(stack[0].id) : null,
            currentPageId: currentPageId(),
            stackDepth: Number(stack.length),
            pageStack: stackIds(),
            pageCount: Number(pageOrder.length),
            registeredPageIds: pageIds(),
            generation: Number(generation),
            mutationCount: Number(mutationCount),
            mountCount: Number(mountCount),
            unmountCount: Number(unmountCount),
            syncCount: Number(syncCount),
            lastAction: String(lastAction || ""),
            lastReason: String(lastReason || "")
        };
    }

    function init(context) {
        if (initialized) { return getState(); }
        runtimeContext = context || {};
        pages = {};
        pageOrder = [];
        stack = [];
        visible = false;
        activePageId = null;
        activeView = null;
        activeBack = null;
        activeClose = null;
        mountCount = 0;
        unmountCount = 0;
        syncCount = 0;
        generation += 1;
        mutationCount = 0;
        lastAction = "init";
        lastReason = "";
        initialized = true;
        installDefaultPages();
        stack = [{ id: "home", params: {} }];
        return getState();
    }

    function shutdown() {
        try {
            if (activePageId !== null) { unmountPage(activePageId, "shutdown"); }
        } catch (ignored) {}
        initialized = false;
        runtimeContext = null;
        pages = {};
        pageOrder = [];
        stack = [];
        visible = false;
        activePageId = null;
        activeView = null;
        activeBack = null;
        activeClose = null;
        generation += 1;
        lastAction = "shutdown";
        lastReason = "";
        return true;
    }

    ClipHub.UIShell = {
        MODULE_NAME: "ch_16_ui_shell",
        MODULE_VERSION: 2,
        init: init,
        registerPage: registerPage,
        getPage: function (pageId) { return copyDescriptor(requirePage(pageId)); },
        getRegisteredPageIds: pageIds,
        enterRoot: enterRoot,
        pushPage: pushPage,
        popPage: popPage,
        clearToRoot: clearToRoot,
        setVisible: setVisible,
        markShellReady: markShellReady,
        canEmbed: canEmbed,
        mountPage: mountPage,
        syncEmbeddedPage: syncEmbeddedPage,
        unmountPage: unmountPage,
        dispatchBack: dispatchBack,
        dispatchClose: dispatchClose,
        getState: getState,
        shutdown: shutdown
    };
}((function () { return this; }())));
'''
    write(path, source)


def patch_regex_fragment():
    path = "tools/regex_beta_patches/settings_regex_feature.jsfrag"
    source = read(path)
    header = "    function makeSettingsSubpageHeader(content, titleText, colors) {\n"
    if "typeof embeddedInPrimary" not in source:
        source = must_replace(
            source, header,
            header + "        if (typeof embeddedInPrimary !== \"undefined\" && embeddedInPrimary) { return null; }\n",
            label="fragment embedded subheader"
        )
    old_padding = "        content.setPadding(dp(12), dp(8), dp(12), dp(28));"
    count = source.count(old_padding)
    assert count >= 3, ("fragment padding count", count)
    new_padding = (
        "        if (typeof embeddedInPrimary !== \"undefined\" && embeddedInPrimary) {\n"
        "            content.setPadding(0, 0, 0, dp(28));\n"
        "        } else {\n"
        "            content.setPadding(dp(12), dp(8), dp(12), dp(28));\n"
        "        }"
    )
    source = source.replace(old_padding, new_padding)
    write(path, source)


def patch_preflight():
    path = "scripts/release_preflight.sh"
    source = read(path)
    source = must_replace(source, "    EXPECTED_MODULE_SET='20260815.11'", "    EXPECTED_MODULE_SET='20260815.12'", label="preflight module set")
    source = must_replace(source, '"ch_11_filter.js": ("ch_11_filter", 83),', '"ch_11_filter.js": ("ch_11_filter", 84),', label="preflight filter")
    source = must_replace(source, '"ch_13_settings.js": ("ch_13_settings", 32),', '"ch_13_settings.js": ("ch_13_settings", 33),', label="preflight settings")
    source = must_replace(source, '"ch_16_ui_shell.js": ("ch_16_ui_shell", 1),', '"ch_12_translation.js": ("ch_12_translation", 17),\n            "ch_16_ui_shell.js": ("ch_16_ui_shell", 2),', label="preflight shell/translation")
    old_contract = '''        assert 'MODULE_NAME: "ch_16_ui_shell"' in ui_shell_source
        assert "MODULE_VERSION: 1" in ui_shell_source
        assert 'migrationStage: "registry_only"' in ui_shell_source
        assert 'primaryWindowMode: false' in ui_shell_source
        assert 'legacyWindowBridge: true' in ui_shell_source
'''
    new_contract = '''        translation_source = actual_sources["ch_12_translation.js"]
        assert 'MODULE_NAME: "ch_16_ui_shell"' in ui_shell_source
        assert "MODULE_VERSION: 2" in ui_shell_source
        assert 'migrationStage: "primary_overlay_settings_regex_translation"' in ui_shell_source
        assert 'primaryWindowMode: true' in ui_shell_source
        assert 'legacyWindowBridge: true' in ui_shell_source
        assert "mountPrimaryChildPage" in filter_source
        assert "unmountPrimaryChildPage" in filter_source
        assert "getPrimaryHostState" in filter_source
        assert "embeddedInPrimary" in settings_source
        assert "syncSettingsShellPage" in settings_source
        assert "openEmbeddedSettingsPage" in settings_source
        assert "translationEmbeddedInPrimary" in translation_source
        assert 'ClipHub.UIShell.mountPage("translation"' in translation_source
'''
    source = must_replace(source, old_contract, new_contract, label="preflight shell contracts")
    source = source.replace('print("UI shell stage1 contracts: passed")', 'print("UI shell stage2 contracts: passed")', 1)
    write(path, source)


def git_blob_sha(text):
    data = text.encode("utf-8")
    return hashlib.sha1(b"blob " + str(len(data)).encode("ascii") + b"\0" + data).hexdigest()


def patch_manifest():
    path = "module-manifest.json"
    manifest = json.loads(read(path))
    assert manifest["moduleSetVersion"] == OLD_SET, manifest["moduleSetVersion"]
    assert manifest["sourceRef"] == BRANCH
    assert len(manifest["modules"]) == 17
    manifest["moduleSetVersion"] = NEW_SET
    changed = {
        "ch_11_filter.js", "ch_12_translation.js", "ch_13_settings.js", "ch_16_ui_shell.js"
    }
    for item in manifest["modules"]:
        if item["name"] in changed:
            item["sha"] = git_blob_sha(read(item["path"]))
    write(path, json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")


def validate_static():
    filter_source, _ = expand_loader("src/ch_11_filter.js")
    settings_source, _ = expand_loader("src/ch_13_settings.js")
    translation_source, _ = expand_loader("src/ch_12_translation.js")
    shell = read("src/ch_16_ui_shell.js")
    assert re.search(r'MODULE_NAME:\s*"ch_11_filter"\s*,\s*MODULE_VERSION:\s*84', filter_source, re.S)
    assert re.search(r'MODULE_NAME:\s*"ch_13_settings"\s*,\s*MODULE_VERSION:\s*33', settings_source, re.S)
    assert re.search(r'MODULE_NAME:\s*"ch_12_translation"\s*,\s*MODULE_VERSION:\s*17', translation_source, re.S)
    assert 'MODULE_VERSION: 2' in shell
    assert 'primaryWindowMode: true' in shell
    assert 'migrationStage: "primary_overlay_settings_regex_translation"' in shell
    assert "mountPrimaryChildPage" in filter_source
    assert "unmountPrimaryChildPage" in filter_source
    assert "dropPrimaryChildOverlayForDestroy();" in filter_source
    assert "openEmbeddedSettingsPage" in settings_source
    assert "syncSettingsShellPage" in settings_source
    assert "embeddedInPrimary: embeddedInPrimary === true" in settings_source
    assert "translationEmbeddedInPrimary" in translation_source
    assert "embeddedInPrimary: translationEmbeddedInPrimary === true" in translation_source
    assert settings_source.count("windowManager.addView(panelWindowRoot, panelParams);") == 1
    assert translation_source.count("windowManager.addView(translationWindowRoot, translationParams);") == 1
    assert filter_source.count("windowManager.addView(panelWindowRoot, panelParams);") == 1
    manifest = json.loads(read("module-manifest.json"))
    assert manifest["moduleSetVersion"] == NEW_SET
    print("Stage2 static contracts passed")
    print("Settings + Regex + Translation use primary Home overlay with legacy fallback")
    print("Editor/Window/List/Theme/DB/Repository/Tokenizer remain outside this migration")


def main():
    manifest = json.loads(read("module-manifest.json"))
    assert manifest["moduleSetVersion"] == OLD_SET
    patch_filter()
    patch_settings()
    patch_translation()
    patch_shell()
    patch_regex_fragment()
    patch_preflight()
    patch_manifest()
    validate_static()
    print("moduleSetVersion=" + NEW_SET)
    print("Filter=84 Settings=33 Translation=17 UIShell=2 App=21")


if __name__ == "__main__":
    main()
