import base64, gzip, hashlib, json, re
from pathlib import Path

ROOT = Path('.')
BRANCH = 'beta-regex-settings-tabs-20260814'
TARGET_SET = '20260815.23'


def blob_sha(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode('ascii') + b'\0' + data).hexdigest()


def replace_once(text, old, new, label):
    count = text.count(old)
    assert count == 1, (label, count)
    return text.replace(old, new, 1)


def extract_function(source, name):
    key = 'function ' + name + '('
    start = source.find(key)
    assert start >= 0, name
    brace = source.find('{', start)
    assert brace >= 0, name
    depth = 0
    quote = None
    esc = False
    i = brace
    while i < len(source):
        c = source[i]
        if quote is not None:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == quote:
                quote = None
        else:
            if c in ('"', "'"):
                quote = c
            elif c == '{':
                depth += 1
            elif c == '}':
                depth -= 1
                if depth == 0:
                    return start, i + 1, source[start:i + 1]
        i += 1
    raise AssertionError(name)


def replace_function(source, name, new_text):
    start, end, old = extract_function(source, name)
    return source[:start] + new_text + source[end:]


def insert_before_function(source, name, text):
    start, _, _ = extract_function(source, name)
    return source[:start] + text + '\n\n    ' + source[start:]


def unpack(path):
    loader = path.read_text(encoding='utf-8')
    match = re.search(r'\bvar\s+(PACKED_B64|encoded)\s*=\s*(.*?);', loader, re.S)
    assert match is not None, path
    pieces = re.findall(r'"(?:\\.|[^"\\])*"', match.group(2))
    encoded = ''.join(json.loads(piece) for piece in pieces)
    source = gzip.decompress(base64.b64decode(encoded)).decode('utf-8')
    expected = re.search(r'\bvar\s+SOURCE_SHA256\s*=\s*["\']([0-9a-fA-F]{64})["\']', loader)
    assert expected is not None, path
    actual = hashlib.sha256(source.encode('utf-8')).hexdigest()
    assert actual == expected.group(1).lower(), (path, actual, expected.group(1))
    return loader, match.group(1), source


def repack(path, loader, variable, source):
    raw = gzip.compress(source.encode('utf-8'), mtime=0)
    encoded = base64.b64encode(raw).decode('ascii')
    chunks = [encoded[i:i+120] for i in range(0, len(encoded), 120)]
    expression = '\n        + '.join(json.dumps(chunk) for chunk in chunks)
    loader = re.sub(r'\bvar\s+' + re.escape(variable) + r'\s*=\s*(.*?);',
                    'var ' + variable + ' = ' + expression + ';', loader, count=1, flags=re.S)
    digest = hashlib.sha256(source.encode('utf-8')).hexdigest()
    loader = re.sub(r'(\bvar\s+SOURCE_SHA256\s*=\s*["\'])[0-9a-fA-F]{64}(["\'])',
                    r'\g<1>' + digest + r'\2', loader, count=1)
    path.write_text(loader, encoding='utf-8')


def bump_module(source, name, old, new):
    pattern = r'(MODULE_NAME:\s*"' + re.escape(name) + r'"\s*,\s*MODULE_VERSION:\s*)' + str(old)
    source, count = re.subn(pattern, r'\g<1>' + str(new), source, count=1, flags=re.S)
    assert count == 1, (name, old, new)
    return source


# 1. Theme: one canonical Chrome metric source without changing legacy getMetrics semantics.
theme_path = ROOT / 'src/ch_07_theme.js'
theme = theme_path.read_text(encoding='utf-8')
assert 'MODULE_NAME: "ch_07_theme",\n        MODULE_VERSION: 5' in theme
chrome_helper = '''function getPanelChromeMetrics(widthDp, fontScale, touchSlopDp) {
        var adaptive = getLayoutMetrics(widthDp, fontScale, touchSlopDp);
        var metrics = copy(METRICS);
        var key;
        for (key in adaptive) {
            if (adaptive.hasOwnProperty(key)) { metrics[key] = adaptive[key]; }
        }
        /* panel_chrome_home_baseline_v1 */
        metrics.dragHandleSlotDp = 12;
        metrics.dragHandleTopDp = 6;
        metrics.dragHandleBottomDp = 2;
        metrics.headerHeightDp = adaptive.actionSizeDp;
        metrics.headerTopOffsetDp = 0;
        metrics.headerBottomGapDp = adaptive.gapDp;
        return metrics;
    }'''
theme = insert_before_function(theme, 'configuredMode', chrome_helper)
theme = replace_once(theme,
    '        getLayoutMetrics: getLayoutMetrics,\n',
    '        getLayoutMetrics: getLayoutMetrics,\n        getPanelChromeMetrics: getPanelChromeMetrics,\n',
    'theme export')
theme = bump_module(theme, 'ch_07_theme', 5, 6)
theme_path.write_text(theme, encoding='utf-8')

# 2. Settings root + all standalone subpages use the same Chrome metrics.
settings_path = ROOT / 'src/ch_13_settings.js'
settings_loader, settings_var, settings = unpack(settings_path)
settings = replace_once(settings,
    '        return ClipHub.Theme.getLayoutMetrics(widthDp, fontScale, 1);',
    '        return ClipHub.Theme.getPanelChromeMetrics(widthDp, fontScale, 1);',
    'settings chrome metrics')
settings = replace_once(settings,
    '        var layoutTokens = ClipHub.Theme.getMetrics();\n',
    '        /* settings_chrome_unified_v1 */\n',
    'settings root layout tokens')
for old, new, label in [
    ('dp(layoutTokens.dragHandleWidthDp || 42)', 'dp(layoutMetrics.dragHandleWidthDp)', 'settings root handle width'),
    ('dp(layoutTokens.dragHandleHeightDp || 4)', 'dp(layoutMetrics.dragHandleHeightDp)', 'settings root handle height'),
    ('handleParams.topMargin = dp(6);', 'handleParams.topMargin = dp(layoutMetrics.dragHandleTopDp);', 'settings root handle top'),
    ('LinearLayout.LayoutParams.MATCH_PARENT, dp(12)));', 'LinearLayout.LayoutParams.MATCH_PARENT, dp(layoutMetrics.dragHandleSlotDp)));', 'settings root slot'),
    ('params.bottomMargin = dp(layoutTokens.headerBottomGapDp);', 'params.bottomMargin = dp(layoutMetrics.headerBottomGapDp);', 'settings root gap'),
]:
    settings = replace_once(settings, old, new, label)

new_settings_subpage = '''function makeSettingsSubpageHeader(content, titleText, colors) {
        if (embeddedInPrimary) { return null; }
        var handleSlot = new FrameLayout(appContext);
        var dragHandle = new View(appContext);
        var header = new LinearLayout(appContext);
        var metrics = settingsLayoutMetrics();
        var back = makeText("‹", metrics.iconSp, colors.icon, false);
        var title = makeText(titleText, metrics.titleSp,
            colors.textPrimary, true);
        var close = makeText("×", metrics.iconSp, colors.icon, false);
        var handleParams;
        var params;
        /* settings_subpage_chrome_unified_v1 */
        dragHandle.setBackground(roundedBackground(
            colors.accentBorder, null, 3));
        handleParams = new FrameLayout.LayoutParams(
            dp(metrics.dragHandleWidthDp), dp(metrics.dragHandleHeightDp));
        handleParams.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        handleParams.topMargin = dp(metrics.dragHandleTopDp);
        handleSlot.addView(dragHandle, handleParams);
        content.addView(handleSlot, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(metrics.dragHandleSlotDp)));
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        back.setGravity(Gravity.CENTER);
        back.setClickable(true);
        back.setFocusable(true);
        back.setContentDescription("返回");
        back.setBackground(roundedBackground(colors.surfaceMuted, null,
            metrics.actionSizeDp / 2));
        back.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { handleSettingsBack(); }
        }));
        header.addView(back, new LinearLayout.LayoutParams(
            dp(metrics.actionSizeDp), dp(metrics.actionSizeDp)));
        params = new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1);
        params.leftMargin = dp(metrics.gapDp);
        header.addView(title, params);
        close.setGravity(Gravity.CENTER);
        close.setClickable(true);
        close.setFocusable(true);
        close.setContentDescription("关闭");
        close.setBackground(roundedBackground(colors.surfaceMuted, null,
            metrics.actionSizeDp / 2));
        close.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { closePage("button"); }
        }));
        header.addView(close, new LinearLayout.LayoutParams(
            dp(metrics.actionSizeDp), dp(metrics.actionSizeDp)));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(metrics.headerHeightDp));
        params.topMargin = 0;
        params.bottomMargin = dp(metrics.headerBottomGapDp);
        content.addView(header, params);
        return header;
    }'''
settings = replace_function(settings, 'makeSettingsSubpageHeader', new_settings_subpage)
settings = bump_module(settings, 'ch_13_settings', 38, 39)
repack(settings_path, settings_loader, settings_var, settings)

# 3. Editor + Tags share one local Chrome builder backed by Theme.
editor_path = ROOT / 'src/ch_10_editor.js'
editor = editor_path.read_text(encoding='utf-8')
editor_helpers = '''function editorChromeMetrics() {
        var widthDp = Number(state.panelWidthDp || 0);
        var fontScale = 1;
        var filterState = null;
        if (!isFinite(widthDp) || widthDp <= 0) {
            try {
                if (ClipHub.Filter && typeof ClipHub.Filter.getState === "function") {
                    filterState = ClipHub.Filter.getState();
                    widthDp = Number(filterState && filterState.panelWidthDp || 0);
                }
            } catch (ignoredEditorFilterMetrics) { widthDp = 0; }
        }
        if (!isFinite(widthDp) || widthDp <= 0) { widthDp = 390; }
        try {
            fontScale = Number(appContext.getResources()
                .getConfiguration().fontScale || 1);
        } catch (ignoredEditorFontScale) { fontScale = 1; }
        return ClipHub.Theme.getPanelChromeMetrics(widthDp, fontScale, 1);
    }

    function addEditorStandaloneDragSlot(parent, colors, chrome) {
        var slot;
        var handle;
        var params;
        if (embeddedInPrimary) { return null; }
        slot = new FrameLayout(appContext);
        handle = new View(appContext);
        handle.setBackground(roundedBackground(colors.accentBorder, null, 3));
        params = new FrameLayout.LayoutParams(
            dp(chrome.dragHandleWidthDp), dp(chrome.dragHandleHeightDp));
        params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        params.topMargin = dp(chrome.dragHandleTopDp);
        slot.addView(handle, params);
        parent.addView(slot, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(chrome.dragHandleSlotDp)));
        return slot;
    }

    function makeEditorHeaderAction(text, description, colors, chrome) {
        var view = makeText(text, chrome.iconSp, colors.icon, false);
        view.setGravity(Gravity.CENTER);
        view.setContentDescription(String(description || text));
        view.setBackground(roundedBackground(colors.surfaceMuted, null,
            chrome.actionSizeDp / 2));
        view.setClickable(true);
        view.setFocusable(true);
        return view;
    }'''
editor = insert_before_function(editor, 'makeEditorPill', editor_helpers)
editor = replace_once(editor,
    '        var dragSlot = new FrameLayout(appContext);\n        var dragHandle = new View(appContext);\n',
    '        var chrome = editorChromeMetrics();\n',
    'editor text declarations')
old_editor_drag = '''        dragHandle.setBackground(roundedBackground(
            colors.accentBorder, null, 3));
        params = new FrameLayout.LayoutParams(dp(42), dp(4));
        params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        params.topMargin = dp(6);
        dragSlot.addView(dragHandle, params);
        panelRoot.addView(dragSlot, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(12)));
        if (embeddedInPrimary) { dragSlot.setVisibility(View.GONE); }
        state.dragHandlePresent = embeddedInPrimary !== true;'''
new_editor_drag = '''        /* editor_chrome_unified_v1 */
        addEditorStandaloneDragSlot(panelRoot, colors, chrome);
        state.dragHandlePresent = embeddedInPrimary !== true;'''
editor = replace_once(editor, old_editor_drag, new_editor_drag, 'editor drag block')
editor = replace_once(editor,
    '        titleTextView = makeText(isNew ? "新增剪贴板" : "编辑剪贴板",\n            17, colors.textPrimary, true);',
    '        titleTextView = makeText(isNew ? "新增剪贴板" : "编辑剪贴板",\n            chrome.titleSp, colors.textPrimary, true);',
    'editor title size')
old_editor_close = '''        headerCloseView = makeText("×", 17, colors.icon, false);
        headerCloseView.setGravity(Gravity.CENTER);
        headerCloseView.setContentDescription("关闭编辑窗口");
        headerCloseView.setBackground(roundedBackground(
            colors.surfaceMuted, null, 18));
        headerCloseView.setClickable(true);
        headerCloseView.setFocusable(true);'''
editor = replace_once(editor, old_editor_close,
    '        headerCloseView = makeEditorHeaderAction("×",\n            "关闭编辑窗口", colors, chrome);', 'editor close builder')
editor = replace_once(editor,
    '        params = new LinearLayout.LayoutParams(dp(36), dp(36));',
    '        params = new LinearLayout.LayoutParams(\n            dp(chrome.actionSizeDp), dp(chrome.actionSizeDp));',
    'editor close size')
editor = replace_once(editor,
    '        params.bottomMargin = dp(6);\n        panelRoot.addView(header, params);',
    '        params.bottomMargin = dp(chrome.headerBottomGapDp);\n        panelRoot.addView(header, params);',
    'editor header gap')

editor = replace_once(editor,
    '        var dragRow = new LinearLayout(appContext);\n        var dragHandle = new View(appContext);\n',
    '        var chrome = editorChromeMetrics();\n',
    'tags declarations')
old_tags_drag = '''        dragRow.setGravity(Gravity.CENTER);
        dragHandle.setBackground(roundedBackground(
            colors.accentBorder, null, 3));
        dragRow.addView(dragHandle,
            new LinearLayout.LayoutParams(dp(42), dp(4)));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(16));
        params.bottomMargin = dp(4);
        panelRoot.addView(dragRow, params);
        if (embeddedInPrimary) { dragRow.setVisibility(View.GONE); }'''
editor = replace_once(editor, old_tags_drag,
    '        addEditorStandaloneDragSlot(panelRoot, colors, chrome);', 'tags drag block')
editor = replace_once(editor,
    '        title = makeText("选择标签", 18, colors.textPrimary, true);',
    '        title = makeText("选择标签", chrome.titleSp, colors.textPrimary, true);',
    'tags title')
old_tags_close = '''        headerCloseView = makeText("×", 22, colors.icon, true);
        headerCloseView.setGravity(Gravity.CENTER);
        headerCloseView.setBackground(roundedBackground(
            colors.surfaceMuted, null, 18));
        headerCloseView.setClickable(true);
        headerCloseView.setFocusable(true);
        headerCloseView.setContentDescription("取消标签选择");'''
editor = replace_once(editor, old_tags_close,
    '        headerCloseView = makeEditorHeaderAction("×",\n            "取消标签选择", colors, chrome);', 'tags close builder')
editor = replace_once(editor,
    '        header.addView(headerCloseView,\n            new LinearLayout.LayoutParams(dp(38), dp(38)));',
    '        header.addView(headerCloseView,\n            new LinearLayout.LayoutParams(dp(chrome.actionSizeDp),\n                dp(chrome.actionSizeDp)));',
    'tags close size')
editor = replace_once(editor,
    '        params.bottomMargin = dp(10);\n        panelRoot.addView(header, params);',
    '        params.bottomMargin = dp(chrome.headerBottomGapDp);\n        panelRoot.addView(header, params);',
    'tags header gap')
editor = bump_module(editor, 'ch_10_editor', 33, 34)
editor_path.write_text(editor, encoding='utf-8')

# 4. Translation: same standalone Chrome construction; embedded remains Host-owned.
translation_path = ROOT / 'src/ch_12_translation.js'
translation = translation_path.read_text(encoding='utf-8')
translation_helper = '''function translationChromeMetrics() {
        var widthDp = 390;
        var fontScale = 1;
        var filterState = null;
        try {
            if (ClipHub.Filter && typeof ClipHub.Filter.getState === "function") {
                filterState = ClipHub.Filter.getState();
                if (filterState && Number(filterState.panelWidthDp || 0) > 0) {
                    widthDp = Number(filterState.panelWidthDp);
                }
            }
        } catch (ignoredTranslationFilterMetrics) {}
        try {
            fontScale = Number(appContext.getResources()
                .getConfiguration().fontScale || 1);
        } catch (ignoredTranslationFontScale) { fontScale = 1; }
        return ClipHub.Theme.getPanelChromeMetrics(widthDp, fontScale, 1);
    }'''
translation = insert_before_function(translation, 'translationButton', translation_helper)
translation = replace_once(translation,
    '        var root = new LinearLayout(appContext);\n        var handleRow = new LinearLayout(appContext);\n        var handle = new View(appContext);\n        var header = new LinearLayout(appContext);\n        var title = translationText("翻译结果", 17, colors.textPrimary, true);',
    '        var chrome = translationChromeMetrics();\n        var root = new LinearLayout(appContext);\n        var handleSlot = new FrameLayout(appContext);\n        var handle = new View(appContext);\n        var header = new LinearLayout(appContext);\n        var title = translationText("翻译结果", chrome.titleSp, colors.textPrimary, true);',
    'translation declarations')
translation = replace_once(translation,
    '            root.setPadding(dp(12), dp(8), dp(12), dp(10));\n            root.setBackground(translationRounded(colors.surface,\n                colors.stroke, 24));\n            handleRow.setGravity(Gravity.CENTER);\n            handle.setBackground(translationRounded(colors.accentBorder, null, 3));\n            handleRow.addView(handle, new LinearLayout.LayoutParams(dp(42), dp(4)));\n            root.addView(handleRow, new LinearLayout.LayoutParams(\n                LinearLayout.LayoutParams.MATCH_PARENT, dp(16)));',
    '            /* translation_chrome_unified_v1 */\n            root.setPadding(dp(chrome.screenPaddingDp), dp(chrome.pagePaddingTopDp),\n                dp(chrome.screenPaddingDp), dp(chrome.pagePaddingBottomDp));\n            root.setBackground(translationRounded(colors.surface,\n                colors.stroke, chrome.pageRadiusDp));\n            var handleParams = new FrameLayout.LayoutParams(\n                dp(chrome.dragHandleWidthDp), dp(chrome.dragHandleHeightDp));\n            handleParams.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;\n            handleParams.topMargin = dp(chrome.dragHandleTopDp);\n            handle.setBackground(translationRounded(colors.accentBorder, null, 3));\n            handleSlot.addView(handle, handleParams);\n            root.addView(handleSlot, new LinearLayout.LayoutParams(\n                LinearLayout.LayoutParams.MATCH_PARENT, dp(chrome.dragHandleSlotDp)));',
    'translation standalone chrome')
translation = replace_once(translation,
    '                "×", 22, colors.icon, true);',
    '                "×", chrome.iconSp, colors.icon, false);',
    'translation close glyph')
translation = replace_once(translation,
    '                colors.surfaceMuted, null, 18));',
    '                colors.surfaceMuted, null, chrome.actionSizeDp / 2));',
    'translation close radius')
translation = replace_once(translation,
    '                new LinearLayout.LayoutParams(dp(36), dp(36)));',
    '                new LinearLayout.LayoutParams(dp(chrome.actionSizeDp),\n                    dp(chrome.actionSizeDp)));',
    'translation close size')
translation = replace_once(translation,
    '                LinearLayout.LayoutParams.MATCH_PARENT, dp(36));\n            params.topMargin = -dp(4);\n            params.bottomMargin = dp(6);',
    '                LinearLayout.LayoutParams.MATCH_PARENT, dp(chrome.headerHeightDp));\n            params.topMargin = 0;\n            params.bottomMargin = dp(chrome.headerBottomGapDp);',
    'translation header layout')
translation = bump_module(translation, 'ch_12_translation', 18, 19)
translation_path.write_text(translation, encoding='utf-8')

# 5. Detail standalone fallback consumes the same Chrome metrics. Embedded remains Host-owned.
list_path = ROOT / 'src/ch_09_list.js'
list_source = list_path.read_text(encoding='utf-8')
detail_helper = '''function detailChromeMetrics() {
var widthDp = Number(detailWidthPx || 0) > 0 ? Number(detailWidthPx) / density : 390;
var fontScale = 1;
try {
fontScale = Number(androidContext.getResources().getConfiguration().fontScale || 1);
} catch (ignoredDetailFontScale) { fontScale = 1; }
return ClipHub.Theme.getPanelChromeMetrics(widthDp, fontScale, 1);
}'''
list_source = insert_before_function(list_source, 'makePill', detail_helper)
list_source = replace_once(list_source,
    'var palette = colors();\nvar root = new LinearLayout(androidContext);\nvar handle = new View(androidContext);',
    'var palette = colors();\nvar chrome = detailChromeMetrics();\nvar root = new LinearLayout(androidContext);\nvar handleSlot = new FrameLayout(androidContext);\nvar handle = new View(androidContext);',
    'detail declarations')
list_source = replace_once(list_source,
    'var title = makeText("内容详情", 17,\npalette.textPrimary, true);',
    'var title = makeText("内容详情", chrome.titleSp,\npalette.textPrimary, true);',
    'detail title')
list_source = replace_once(list_source,
    'root.setPadding(dp(14), dp(8), dp(14), dp(12));\nroot.setBackground(roundedBackground(palette.surface,\npalette.stroke, 24));',
    'root.setPadding(dp(chrome.screenPaddingDp), dp(chrome.pagePaddingTopDp),\ndp(chrome.screenPaddingDp), dp(chrome.pagePaddingBottomDp));\nroot.setBackground(roundedBackground(palette.surface,\npalette.stroke, chrome.pageRadiusDp));',
    'detail root chrome')
old_detail_handle = '''handle.setBackground(roundedBackground(
palette.strokeStrong, null, 3));
params = new LinearLayout.LayoutParams(dp(42), dp(4));
params.gravity = Gravity.CENTER_HORIZONTAL;
params.bottomMargin = dp(8);
root.addView(handle, params);
if (embeddedMode) { handle.setVisibility(View.GONE); }'''
new_detail_handle = '''/* detail_chrome_unified_v1 */
handle.setBackground(roundedBackground(
palette.strokeStrong, null, 3));
params = new FrameLayout.LayoutParams(dp(chrome.dragHandleWidthDp),
dp(chrome.dragHandleHeightDp));
params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
params.topMargin = dp(chrome.dragHandleTopDp);
handleSlot.addView(handle, params);
root.addView(handleSlot, new LinearLayout.LayoutParams(
LinearLayout.LayoutParams.MATCH_PARENT, dp(chrome.dragHandleSlotDp)));
if (embeddedMode) { handleSlot.setVisibility(View.GONE); }'''
list_source = replace_once(list_source, old_detail_handle, new_detail_handle, 'detail handle')
list_source = replace_once(list_source,
    'detailCloseView = makeIcon("×", palette.icon, 23,',
    'detailCloseView = makeIcon("×", palette.icon, chrome.iconSp,',
    'detail icon')
list_source = replace_once(list_source,
    'new LinearLayout.LayoutParams(dp(38), dp(38)));',
    'new LinearLayout.LayoutParams(dp(chrome.actionSizeDp), dp(chrome.actionSizeDp)));',
    'detail close size')
list_source = replace_once(list_source,
    'LinearLayout.LayoutParams.MATCH_PARENT,\nLinearLayout.LayoutParams.WRAP_CONTENT);\nparams.bottomMargin = dp(4);\nroot.addView(header, params);',
    'LinearLayout.LayoutParams.MATCH_PARENT,\ndp(chrome.headerHeightDp));\nparams.bottomMargin = dp(chrome.headerBottomGapDp);\nroot.addView(header, params);',
    'detail header layout')
list_source = replace_once(list_source,
    'body.setBackground(roundedBackground(palette.surfaceMuted,\npalette.stroke, 14));',
    'body.setBackground(roundedBackground(palette.surfaceMuted,\npalette.stroke, chrome.cardRadiusDp));',
    'detail body radius')
list_source = bump_module(list_source, 'ch_09_list', 21, 22)
list_path.write_text(list_source, encoding='utf-8')

# 6. Tokenizer: Host owns outer padding when embedded; standalone uses the exact same Chrome.
tokenizer_path = ROOT / 'src/ch_17_tokenizer_ui.js'
token_loader, token_var, token = unpack(tokenizer_path)
token_helper = '''function tokenizerChromeMetrics() {
        var widthDp = 390;
        var fontScale = 1;
        var filterState = null;
        try {
            if (ClipHub.Filter && typeof ClipHub.Filter.getState === "function") {
                filterState = ClipHub.Filter.getState();
                if (filterState && Number(filterState.panelWidthDp || 0) > 0) {
                    widthDp = Number(filterState.panelWidthDp);
                }
            }
        } catch (ignoredTokenizerFilterMetrics) {}
        try {
            fontScale = Number(appContext.getResources()
                .getConfiguration().fontScale || 1);
        } catch (ignoredTokenizerFontScale) { fontScale = 1; }
        return ClipHub.Theme.getPanelChromeMetrics(widthDp, fontScale, 1);
    }'''
token = insert_before_function(token, 'buildDragHandle', token_helper)
new_token_drag = '''function buildDragHandle(column) {
        if (editorEmbeddedInPrimary) { return; }
        var colors = palette();
        var chrome = tokenizerChromeMetrics();
        var slot = new FrameLayout(appContext);
        var handle = new View(appContext);
        var params;
        applyBackground(handle, colors.accentBorder, null, 3);
        params = new FrameLayout.LayoutParams(
            dp(chrome.dragHandleWidthDp), dp(chrome.dragHandleHeightDp));
        params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        params.topMargin = dp(chrome.dragHandleTopDp);
        slot.addView(handle, params);
        column.addView(slot, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(chrome.dragHandleSlotDp)));
    }'''
token = replace_function(token, 'buildDragHandle', new_token_drag)
new_token_header = '''function buildHeader(column) {
        var colors = palette();
        var chrome = tokenizerChromeMetrics();
        var header = new LinearLayout(appContext);
        var back = makeClickText("‹", chrome.iconSp, colors, "返回编辑页");
        var title = makeText("分词", chrome.titleSp, colors.textPrimary, true);
        var right = new LinearLayout(appContext);
        var rule = makeClickText("▣", chrome.iconSp, colors, "规则");
        var help = makeClickText("?", chrome.iconSp, colors, "帮助");
        var params;
        if (editorEmbeddedInPrimary) {
            back.setVisibility(View.GONE);
            title.setText("");
            title.setVisibility(View.INVISIBLE);
        }
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        back.setGravity(Gravity.CENTER);
        applyBackground(back, colors.surfaceMuted, null, chrome.actionSizeDp / 2);
        title.setGravity(Gravity.CENTER_VERTICAL);
        rule.setGravity(Gravity.CENTER);
        safeTextColor(rule, colors.accentStrong);
        applyBackground(rule, colors.accentSoft, colors.accentBorder,
            chrome.actionSizeDp / 2);
        help.setGravity(Gravity.CENTER);
        applyBackground(help, colors.surfaceMuted, null, chrome.actionSizeDp / 2);
        back.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { returnToEditor("header_back"); }
        }));
        rule.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { emitAction("rule", {}); }
        }));
        help.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { emitAction("help", {}); }
        }));
        header.addView(back,
            new LinearLayout.LayoutParams(dp(chrome.actionSizeDp),
                dp(chrome.actionSizeDp)));
        params = new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1);
        params.leftMargin = dp(chrome.gapDp);
        params.rightMargin = dp(chrome.gapDp);
        header.addView(title, params);
        right.setOrientation(LinearLayout.HORIZONTAL);
        right.setGravity(Gravity.CENTER_VERTICAL);
        right.addView(rule,
            new LinearLayout.LayoutParams(dp(chrome.actionSizeDp),
                dp(chrome.actionSizeDp)));
        params = new LinearLayout.LayoutParams(dp(chrome.actionSizeDp),
            dp(chrome.actionSizeDp));
        params.leftMargin = dp(chrome.gapDp);
        right.addView(help, params);
        header.addView(right,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, dp(chrome.actionSizeDp)));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(chrome.headerHeightDp));
        params.bottomMargin = dp(chrome.headerBottomGapDp);
        column.addView(header, params);
    }'''
token = replace_function(token, 'buildHeader', new_token_header)
new_token_page = '''function buildPage() {
        var colors = palette();
        var chrome = tokenizerChromeMetrics();
        var bodyParams;
        var horizontalPadding = editorEmbeddedInPrimary ? 0 : chrome.screenPaddingDp;
        var topPadding = editorEmbeddedInPrimary ? 0 : chrome.pagePaddingTopDp;
        var bottomPadding = editorEmbeddedInPrimary ? 0 : chrome.pagePaddingBottomDp;
        pageRoot = new FrameLayout(appContext);
        pageColumn = new LinearLayout(appContext);
        pageColumn.setOrientation(LinearLayout.VERTICAL);
        /* tokenizer_chrome_unified_v1 */
        pageColumn.setPadding(dp(horizontalPadding), dp(topPadding),
            dp(horizontalPadding), dp(bottomPadding));
        ClipHub.Theme.applyBackgroundColor(pageRoot, colors.surface);
        buildDragHandle(pageColumn);
        buildHeader(pageColumn);
        buildSegment(pageColumn);
        buildDivider(pageColumn);
        bodyContainer = new LinearLayout(appContext);
        bodyContainer.setOrientation(LinearLayout.VERTICAL);
        bodyContainer.setPadding(0, dp(3), 0, 0);
        bodyParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1);
        pageColumn.addView(bodyContainer, bodyParams);
        buildIndicator(pageColumn);
        buildDivider(pageColumn);
        buildToolbar(pageColumn);
        buildHint(pageColumn);
        pageRoot.addView(pageColumn,
            new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));
        renderMode();
        return pageRoot;
    }'''
token = replace_function(token, 'buildPage', new_token_page)
token = replace_once(token,
    '        editorPanelRoot.setPadding(dp(6), dp(4), dp(6), dp(4));',
    '        editorPanelRoot.setPadding(0, 0, 0, 0);',
    'tokenizer mounted root padding')
token = bump_module(token, 'ch_17_tokenizer_ui', 3, 4)
repack(tokenizer_path, token_loader, token_var, token)

# 7. Manifest + preflight contract updates.
manifest_path = ROOT / 'module-manifest.json'
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
assert manifest['moduleSetVersion'] == '20260815.22'
manifest['moduleSetVersion'] = TARGET_SET
changed_paths = [
    'src/ch_07_theme.js',
    'src/ch_09_list.js',
    'src/ch_10_editor.js',
    'src/ch_12_translation.js',
    'src/ch_13_settings.js',
    'src/ch_17_tokenizer_ui.js',
]
for item in manifest['modules']:
    if item['path'] in changed_paths:
        data = (ROOT / item['path']).read_bytes()
        item['sha'] = blob_sha(data)
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

preflight_path = ROOT / 'scripts/release_preflight.sh'
preflight = preflight_path.read_text(encoding='utf-8')
preflight = replace_once(preflight, "EXPECTED_MODULE_SET='20260815.22'", "EXPECTED_MODULE_SET='20260815.23'", 'preflight module set')
preflight = replace_once(preflight, 'expected_theme_version = 5 if mode == "--settings-tabs-beta" else 4', 'expected_theme_version = 6 if mode == "--settings-tabs-beta" else 4', 'preflight theme')
preflight = replace_once(preflight, '            "ch_10_editor.js": ("ch_10_editor", 33),', '            "ch_09_list.js": ("ch_09_list", 22),\n            "ch_10_editor.js": ("ch_10_editor", 34),', 'preflight editor/list')
preflight = replace_once(preflight, '            "ch_13_settings.js": ("ch_13_settings", 38),', '            "ch_13_settings.js": ("ch_13_settings", 39),', 'preflight settings')
preflight = replace_once(preflight, '            "ch_12_translation.js": ("ch_12_translation", 18),', '            "ch_12_translation.js": ("ch_12_translation", 19),', 'preflight translation')
preflight = replace_once(preflight, '            "ch_17_tokenizer_ui.js": ("ch_17_tokenizer_ui", 3),', '            "ch_17_tokenizer_ui.js": ("ch_17_tokenizer_ui", 4),', 'preflight tokenizer')
preflight = replace_once(preflight,
    'assert "getColorSafetyState: getColorSafetyState" in theme',
    'assert "getColorSafetyState: getColorSafetyState" in theme\nassert "getPanelChromeMetrics: getPanelChromeMetrics" in theme\nassert "panel_chrome_home_baseline_v1" in theme',
    'preflight theme chrome')
preflight = replace_once(preflight,
    '        assert "settings_root_home_header_baseline_v1" in settings_source',
    '        assert "settings_root_home_header_baseline_v1" in settings_source\n        assert "settings_chrome_unified_v1" in settings_source\n        assert "settings_subpage_chrome_unified_v1" in settings_source',
    'preflight settings chrome')
preflight = replace_once(preflight,
    '        assert "dragSlot.addView(dragHandle, params);" in editor_source',
    '        assert "addEditorStandaloneDragSlot" in editor_source\n        assert "editor_chrome_unified_v1" in editor_source',
    'preflight editor chrome')
preflight = replace_once(preflight,
    '        assert "danger ? colors.dangerSoft" in translation_source',
    '        assert "danger ? colors.dangerSoft" in translation_source\n        assert "translation_chrome_unified_v1" in translation_source',
    'preflight translation chrome')
preflight = replace_once(preflight,
    '        assert "detailEmbeddedInPrimary" in list_source',
    '        assert "detailEmbeddedInPrimary" in list_source\n        assert "detail_chrome_unified_v1" in list_source',
    'preflight detail chrome')
preflight = replace_once(preflight,
    '        assert "editorEmbeddedInPrimary" in tokenizer_source',
    '        assert "editorEmbeddedInPrimary" in tokenizer_source\n        assert "tokenizer_chrome_unified_v1" in tokenizer_source\n        assert "editorPanelRoot.setPadding(0, 0, 0, 0);" in tokenizer_source',
    'preflight tokenizer chrome')
preflight_path.write_text(preflight, encoding='utf-8')

print('Unified panel chrome patch prepared')
print('moduleSetVersion:', TARGET_SET)
print('changed:', ', '.join(changed_paths))
