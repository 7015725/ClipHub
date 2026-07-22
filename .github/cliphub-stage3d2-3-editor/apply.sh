#!/usr/bin/env bash
set -euo pipefail

BRANCH="agent/initialize-project-skeleton"
HELPER_DIR=".github/cliphub-stage3d2-3-editor"
WORKFLOW_PATH=".github/workflows/cliphub-stage3d2-3-editor.yml"

if [ "$(git hash-object src/ch_10_editor.js)" != "e2afe5ff6f8d8802d8aca7669b5f8b2033064895" ]; then
  echo "Unexpected ch_10_editor.js base" >&2
  exit 1
fi
if [ "$(git hash-object module-manifest.json)" != "adceebda1562584a3884dec8e14541bd4b09f715" ]; then
  echo "Unexpected module-manifest.json base" >&2
  exit 1
fi
if [ "$(git hash-object docs/阶段3D2新UI全量复刻方案.md)" != "49b85ad38acf76259551a7839e18b48d50ceb963" ]; then
  echo "Unexpected stage plan base" >&2
  exit 1
fi
if [ "$(git hash-object docs/开发计划.md)" != "5f3a58a2772f7f2ec9a67c943d4871bb54d2b47f" ]; then
  echo "Unexpected development plan base" >&2
  exit 1
fi

python3 - <<'PYEDITOR'
from pathlib import Path

path = Path('src/ch_10_editor.js')
text = path.read_text(encoding='utf-8')

text = text.replace(
'''    var LinearLayout = Packages.android.widget.LinearLayout;
    var ScrollView = Packages.android.widget.ScrollView;
    var TextView = Packages.android.widget.TextView;
    var EditText = Packages.android.widget.EditText;''',
'''    var LinearLayout = Packages.android.widget.LinearLayout;
    var FrameLayout = Packages.android.widget.FrameLayout;
    var ScrollView = Packages.android.widget.ScrollView;
    var TextView = Packages.android.widget.TextView;
    var EditText = Packages.android.widget.EditText;''', 1)
text = text.replace(
'''    var InputType = Packages.android.text.InputType;
    var InputMethodManager = Packages.android.view.inputmethod.InputMethodManager;''',
'''    var InputType = Packages.android.text.InputType;
    var TextWatcher = Packages.android.text.TextWatcher;
    var TextUtils = Packages.android.text.TextUtils;
    var InputMethodManager = Packages.android.view.inputmethod.InputMethodManager;''', 1)

text = text.replace(
'''    var panelParams = null;
    var contentInput = null;
    var tagNameInput = null;
    var saveView = null;
    var cancelView = null;''',
'''    var panelParams = null;
    var contentInput = null;
    var tagNameInput = null;
    var saveView = null;
    var cancelView = null;
    var headerCloseView = null;
    var titleIconView = null;
    var titleTextView = null;
    var subtitleTextView = null;
    var contentLabelView = null;
    var characterCountView = null;
    var metadataSourceView = null;
    var metadataTypeView = null;
    var editorFooterView = null;''', 1)

text = text.replace(
'''        modalWindow: false,
        opaqueBackground: false,
        addThreadId: null,''',
'''        modalWindow: false,
        opaqueBackground: false,
        editorStyle: "legacy_editor_v1",
        dragHandlePresent: false,
        headerIconPresent: false,
        headerCloseButtonPresent: false,
        contentLabelPresent: false,
        characterCountPresent: false,
        metadataRowPresent: false,
        sourceMetaText: "",
        typeMetaText: "",
        contentLength: 0,
        contentMinLines: 0,
        footerActionCount: 0,
        editorFooterHeightDp: 0,
        cancelButtonPresent: false,
        saveButtonPresent: false,
        requestKeyboardOnOpen: true,
        keyboardRequestedOnOpen: false,
        panelGravity: "center",
        panelBottomMarginDp: 0,
        addThreadId: null,''', 1)

start = text.index('    function panelDimensions(mode) {')
end = text.index('    function activeInput() {', start)
text = text[:start] + '''    function panelDimensions(mode) {
        var metrics = displayMetrics();
        var tagsMode = String(mode) === "tags";
        var maxWidthDp = tagsMode ? 420 : 390;
        var minWidthDp = tagsMode ? 270 : 300;
        var width = Math.min(dp(maxWidthDp), Math.max(dp(minWidthDp),
            Number(metrics.widthPixels) - dp(tagsMode ? 12 : 20)));
        var availableHeight = Math.max(dp(300),
            Number(metrics.heightPixels) - dp(tagsMode ? 72 : 86));
        var heightDp;
        var count;
        if (tagsMode) {
            count = 0;
            try { count = ClipHub.Repository.listTags().length; }
            catch (ignoredCount) {}
            heightDp = 222 + Math.min(5, Math.max(1, count)) * 54;
            heightDp = Math.max(310, Math.min(492, heightDp));
        } else {
            heightDp = 590;
        }
        return {
            width: width,
            height: Math.min(dp(heightDp), availableHeight),
            widthDp: pxToDp(width),
            heightDp: Math.min(heightDp, pxToDp(availableHeight))
        };
    }

''' + text[end:]

text = text.replace(
'''        state.inputFocused = target.hasFocus();
        state.keyboardRequestCount += 1;''',
'''        state.inputFocused = target.hasFocus();
        state.keyboardRequestCount += 1;
        state.keyboardRequestedOnOpen = true;''', 1)

start = text.index('    function clearViews() {')
end = text.index('    function closePanel(reason) {', start)
text = text[:start] + '''    function clearViews() {
        panelRoot = null;
        panelParams = null;
        contentInput = null;
        tagNameInput = null;
        saveView = null;
        cancelView = null;
        headerCloseView = null;
        titleIconView = null;
        titleTextView = null;
        subtitleTextView = null;
        contentLabelView = null;
        characterCountView = null;
        metadataSourceView = null;
        metadataTypeView = null;
        editorFooterView = null;
        createTagView = null;
        tagViews = {};
        tagDeleteViews = {};
        state.dragHandlePresent = false;
        state.headerIconPresent = false;
        state.headerCloseButtonPresent = false;
        state.contentLabelPresent = false;
        state.characterCountPresent = false;
        state.metadataRowPresent = false;
        state.cancelButtonPresent = false;
        state.saveButtonPresent = false;
        state.footerActionCount = 0;
        state.editorFooterHeightDp = 0;
    }

''' + text[end:]

insert_at = text.index('    function emitMutation(')
helpers = '''    function editorPalette() {
        var dark = isDarkMode();
        try {
            if (ClipHub.Theme &&
                    typeof ClipHub.Theme.getPalette === "function") {
                return ClipHub.Theme.getPalette(appContext);
            }
        } catch (ignored) {}
        return {
            dark: dark,
            accentStrong: dark ? "#FF9476F8" : "#FF5A37E6",
            accentSoft: dark ? "#FF302946" : "#FFF0ECFF",
            accentBorder: dark ? "#FF6F5A9D" : "#FFBBAAF8",
            surface: dark ? "#FF211E2A" : "#FFFFFFFF",
            surfaceMuted: dark ? "#FF292532" : "#FFF5F3FB",
            stroke: dark ? "#FF3D3748" : "#FFE5E0EF",
            textPrimary: dark ? "#FFF7F3FF" : "#FF1F1C28",
            textSecondary: dark ? "#FFC8C0D1" : "#FF6F697A",
            textTertiary: dark ? "#FF968DA1" : "#FF9992A3",
            icon: dark ? "#FFE7DFF1" : "#FF3D3748"
        };
    }

    function makeEditorPill(text, colors, accent) {
        var view = makeText(text, 10,
            accent ? colors.accentStrong : colors.textSecondary,
            accent === true);
        view.setGravity(Gravity.CENTER);
        view.setSingleLine(true);
        view.setMaxLines(1);
        view.setEllipsize(TextUtils.TruncateAt.END);
        view.setPadding(dp(9), dp(5), dp(9), dp(5));
        view.setBackground(roundedBackground(
            accent ? colors.accentSoft : colors.surfaceMuted,
            accent ? colors.accentBorder : colors.stroke, 9));
        return view;
    }

    function makeEditorAction(text, colors, primary) {
        var view = makeText(text, 12,
            primary ? "#FFFFFFFF" : colors.accentStrong, true);
        view.setGravity(Gravity.CENTER);
        view.setSingleLine(true);
        view.setBackground(roundedBackground(
            primary ? colors.accentStrong : colors.surface,
            primary ? colors.accentStrong : colors.accentBorder, 13));
        view.setClickable(true);
        view.setFocusable(true);
        return view;
    }

    function contentTypeLabel(value) {
        value = String(value || "text").toLowerCase();
        if (value === "url" || value === "link") { return "链接"; }
        if (value === "code") { return "代码"; }
        if (value === "email") { return "邮件"; }
        if (value === "phone") { return "电话"; }
        return "文本";
    }

    function updateCharacterCount() {
        var length = 0;
        try {
            length = contentInput === null ? 0 :
                String(contentInput.getText()).length;
        } catch (ignored) {}
        state.contentLength = length;
        if (characterCountView !== null) {
            characterCountView.setText(String(length) + " / 200000");
        }
        return length;
    }

'''
text = text[:insert_at] + helpers + text[insert_at:]

start = text.index('    function buildTextContent(initialText) {')
end = text.index('    function buildTagContent(requestFocus) {', start)
new_build = '''    function buildTextContent(initialText, row, options) {
        var colors = editorPalette();
        var isNew = state.mode === "new";
        var sourceText = isNew ? "ClipHub 手动" :
            String(row && row.source_label ? row.source_label : "未知来源");
        var typeText = isNew ? "文本" :
            contentTypeLabel(row && row.content_type);
        var dragRow = new LinearLayout(appContext);
        var dragHandle = new View(appContext);
        var header = new LinearLayout(appContext);
        var titleStack = new LinearLayout(appContext);
        var metaRow = new LinearLayout(appContext);
        var sectionRow = new LinearLayout(appContext);
        var scroll = new ScrollView(appContext);
        var footer = new LinearLayout(appContext);
        var params;
        options = options || {};

        panelRoot.removeAllViews();
        state.editorStyle = "reference_editor_v1";
        state.sourceMetaText = sourceText;
        state.typeMetaText = typeText;
        state.contentMinLines = 10;
        state.contentLength = String(initialText || "").length;

        dragRow.setGravity(Gravity.CENTER);
        dragHandle.setBackground(roundedBackground(
            colors.accentBorder, null, 3));
        dragRow.addView(dragHandle,
            new LinearLayout.LayoutParams(dp(42), dp(4)));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(16));
        params.bottomMargin = dp(4);
        panelRoot.addView(dragRow, params);
        state.dragHandlePresent = true;

        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        titleIconView = makeText(isNew ? "+" : "✎", 19,
            colors.accentStrong, true);
        titleIconView.setGravity(Gravity.CENTER);
        titleIconView.setBackground(roundedBackground(
            colors.accentSoft, colors.accentBorder, 10));
        params = new LinearLayout.LayoutParams(dp(38), dp(38));
        params.rightMargin = dp(9);
        header.addView(titleIconView, params);

        titleStack.setOrientation(LinearLayout.VERTICAL);
        titleTextView = makeText(isNew ? "新增剪贴板" : "编辑剪贴板",
            18, colors.textPrimary, true);
        subtitleTextView = makeText(isNew ?
            "手动添加一条本地剪贴板记录" :
            "仅修改正文，来源和类型保持不变",
            10, colors.textSecondary, false);
        titleStack.addView(titleTextView,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(2);
        titleStack.addView(subtitleTextView, params);
        header.addView(titleStack, new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        headerCloseView = makeText("×", 22, colors.icon, true);
        headerCloseView.setGravity(Gravity.CENTER);
        headerCloseView.setContentDescription("关闭编辑窗口");
        headerCloseView.setBackground(roundedBackground(
            colors.surfaceMuted, null, 18));
        headerCloseView.setClickable(true);
        headerCloseView.setFocusable(true);
        headerCloseView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () { closePanel("cancel"); }
            }));
        header.addView(headerCloseView,
            new LinearLayout.LayoutParams(dp(38), dp(38)));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(10);
        panelRoot.addView(header, params);
        state.headerIconPresent = true;
        state.headerCloseButtonPresent = true;

        metaRow.setOrientation(LinearLayout.HORIZONTAL);
        metaRow.setGravity(Gravity.CENTER_VERTICAL);
        metadataTypeView = makeEditorPill("类型  " + typeText,
            colors, true);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, dp(32));
        params.rightMargin = dp(7);
        metaRow.addView(metadataTypeView, params);
        metadataSourceView = makeEditorPill("来源  " + sourceText,
            colors, false);
        metaRow.addView(metadataSourceView,
            new LinearLayout.LayoutParams(0, dp(32), 1));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(32));
        params.bottomMargin = dp(10);
        panelRoot.addView(metaRow, params);
        state.metadataRowPresent = true;

        sectionRow.setOrientation(LinearLayout.HORIZONTAL);
        sectionRow.setGravity(Gravity.CENTER_VERTICAL);
        contentLabelView = makeText("内容", 12,
            colors.textPrimary, true);
        sectionRow.addView(contentLabelView,
            new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        characterCountView = makeText("0 / 200000", 9,
            colors.textTertiary, false);
        sectionRow.addView(characterCountView,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(6);
        panelRoot.addView(sectionRow, params);
        state.contentLabelPresent = true;
        state.characterCountPresent = true;

        scroll.setFillViewport(true);
        scroll.setVerticalScrollBarEnabled(false);
        contentInput = new EditText(appContext);
        contentInput.setText(String(initialText || ""));
        contentInput.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        contentInput.setTextColor(Color.parseColor(colors.textPrimary));
        contentInput.setHintTextColor(Color.parseColor(colors.textTertiary));
        contentInput.setHint("输入剪贴板内容");
        contentInput.setGravity(Gravity.TOP | Gravity.START);
        contentInput.setInputType(InputType.TYPE_CLASS_TEXT |
            InputType.TYPE_TEXT_FLAG_MULTI_LINE |
            InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        contentInput.setSingleLine(false);
        contentInput.setMinLines(10);
        contentInput.setHorizontallyScrolling(false);
        contentInput.setPadding(dp(12), dp(11), dp(12), dp(11));
        contentInput.setBackground(roundedBackground(
            colors.surface, colors.stroke, 15));
        contentInput.addTextChangedListener(new JavaAdapter(TextWatcher, {
            beforeTextChanged: function () {},
            onTextChanged: function () { updateCharacterCount(); },
            afterTextChanged: function () {}
        }));
        if (contentInput.getText().length() > 0) {
            contentInput.setSelection(contentInput.getText().length());
        }
        scroll.addView(contentInput,
            new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1);
        params.bottomMargin = dp(8);
        panelRoot.addView(scroll, params);
        updateCharacterCount();

        footer.setOrientation(LinearLayout.HORIZONTAL);
        footer.setGravity(Gravity.CENTER_VERTICAL);
        cancelView = makeEditorAction("取消", colors, false);
        cancelView.setContentDescription("取消编辑");
        cancelView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () { closePanel("cancel"); }
            }));
        saveView = makeEditorAction("保存", colors, true);
        saveView.setContentDescription("保存记录");
        saveView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () { saveFromInput(); }
            }));
        params = new LinearLayout.LayoutParams(0, dp(42), 1);
        params.rightMargin = dp(8);
        footer.addView(cancelView, params);
        footer.addView(saveView,
            new LinearLayout.LayoutParams(0, dp(42), 1));
        editorFooterView = footer;
        panelRoot.addView(footer,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(50)));
        state.footerActionCount = 2;
        state.editorFooterHeightDp = 50;
        state.cancelButtonPresent = true;
        state.saveButtonPresent = true;

        if (options.requestKeyboard !== false) {
            requestKeyboardOnMain();
        }
        return true;
    }

'''
text = text[:start] + new_build + text[end:]

start = text.index('    function openPanel(mode, itemId) {')
end = text.index('    function getState() {', start)
new_open = '''    function openPanel(mode, itemId, options) {
        var row = null;
        var initialText = "";
        var requestKeyboard;
        options = options || {};
        if (!ready) { throw new Error("ClipHub editor is not ready"); }
        mode = String(mode || "new");
        if (mode === "edit" || mode === "tags") {
            row = ClipHub.Repository.getItem(Number(itemId), false);
            if (row === null || row === undefined) {
                throw new Error("编辑目标不存在");
            }
            initialText = String(row.content);
        }
        if (state.attached) { closePanel("replace"); }
        state.mode = mode === "edit" ? "edit" :
            (mode === "tags" ? "tags" : "new");
        state.itemId = state.mode === "new" ? null : Number(itemId);
        requestKeyboard = options.requestKeyboard !== false;
        state.requestKeyboardOnOpen = requestKeyboard;
        state.keyboardRequestedOnOpen = false;
        return requireMain(runOnMainSync(function () {
            var size = panelDimensions(state.mode);
            var type = Build.VERSION.SDK_INT >= 26 ?
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY :
                WindowManager.LayoutParams.TYPE_SYSTEM_ALERT;
            var thread = nowThread();
            var dark = isDarkMode();
            var colors = editorPalette();
            panelRoot = new LinearLayout(appContext);
            panelRoot.setOrientation(LinearLayout.VERTICAL);
            if (state.mode === "tags") {
                panelRoot.setPadding(dp(14), dp(12), dp(14), dp(12));
                panelRoot.setBackground(roundedBackground(
                    dark ? "#FF181A1F" : "#FFFFFFFF",
                    dark ? "#30FFFFFF" : "#1A000000", 17));
            } else {
                panelRoot.setPadding(dp(12), dp(8), dp(12), dp(10));
                panelRoot.setBackground(roundedBackground(
                    colors.surface, colors.stroke, 24));
            }
            if (Build.VERSION.SDK_INT >= 21) {
                panelRoot.setElevation(dp(20));
            }
            panelParams = new WindowManager.LayoutParams(
                size.width, size.height, type,
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
                    WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED |
                    WindowManager.LayoutParams.FLAG_DIM_BEHIND,
                PixelFormat.TRANSLUCENT);
            if (state.mode === "tags") {
                panelParams.gravity = Gravity.CENTER;
                panelParams.y = 0;
                panelParams.dimAmount = 0.72;
                state.panelGravity = "center";
                state.panelBottomMarginDp = 0;
            } else {
                panelParams.gravity = Gravity.BOTTOM |
                    Gravity.CENTER_HORIZONTAL;
                panelParams.y = dp(10);
                panelParams.dimAmount = 0.44;
                state.panelGravity = "bottom";
                state.panelBottomMarginDp = 10;
            }
            panelParams.softInputMode =
                WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE |
                (requestKeyboard ?
                    WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE :
                    WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN);
            try { panelParams.setTitle("ClipHub Editor Panel"); }
            catch (ignoredTitle) {}
            windowManager.addView(panelRoot, panelParams);
            state.open = true;
            state.attached = true;
            state.openCount += 1;
            state.windowType = Number(type);
            state.windowFlags = Number(panelParams.flags);
            state.panelWidthPx = size.width;
            state.panelHeightPx = size.height;
            state.panelWidthDp = size.widthDp;
            state.panelHeightDp = size.heightDp;
            state.dimAmount = Number(panelParams.dimAmount);
            state.modalWindow = true;
            state.opaqueBackground = true;
            state.addThreadId = thread.id;
            state.addThreadName = thread.name;
            state.lastError = null;
            if (state.mode === "tags") {
                state.editorStyle = "legacy_tags_v1";
                buildTagContent(requestKeyboard);
            } else {
                buildTextContent(initialText, row, {
                    requestKeyboard: requestKeyboard
                });
            }
            return { ok: true, attached: true, mode: state.mode,
                itemId: state.itemId, state: getState() };
        }, 3000));
    }

'''
text = text[:start] + new_open + text[end:]

text = text.replace(
'''            opaqueBackground: state.opaqueBackground,
            addThreadId: state.addThreadId,''',
'''            opaqueBackground: state.opaqueBackground,
            editorStyle: state.editorStyle,
            dragHandlePresent: state.dragHandlePresent === true,
            headerIconPresent: state.headerIconPresent === true,
            headerCloseButtonPresent:
                state.headerCloseButtonPresent === true,
            contentLabelPresent: state.contentLabelPresent === true,
            characterCountPresent: state.characterCountPresent === true,
            metadataRowPresent: state.metadataRowPresent === true,
            sourceMetaText: state.sourceMetaText,
            typeMetaText: state.typeMetaText,
            contentLength: Number(state.contentLength),
            contentMinLines: Number(state.contentMinLines),
            footerActionCount: Number(state.footerActionCount),
            editorFooterHeightDp: Number(state.editorFooterHeightDp),
            cancelButtonPresent: cancelView !== null,
            saveButtonPresent: saveView !== null,
            headerCloseViewPresent: headerCloseView !== null,
            requestKeyboardOnOpen: state.requestKeyboardOnOpen === true,
            keyboardRequestedOnOpen:
                state.keyboardRequestedOnOpen === true,
            panelGravity: state.panelGravity,
            panelBottomMarginDp: Number(state.panelBottomMarginDp),
            addThreadId: state.addThreadId,''', 1)

text = text.replace(
'''            dimAmount: 0, modalWindow: false, opaqueBackground: false,
            addThreadId: null, addThreadName: null, removeThreadId: null,''',
'''            dimAmount: 0, modalWindow: false, opaqueBackground: false,
            editorStyle: "legacy_editor_v1", dragHandlePresent: false,
            headerIconPresent: false, headerCloseButtonPresent: false,
            contentLabelPresent: false, characterCountPresent: false,
            metadataRowPresent: false, sourceMetaText: "", typeMetaText: "",
            contentLength: 0, contentMinLines: 0, footerActionCount: 0,
            editorFooterHeightDp: 0, cancelButtonPresent: false,
            saveButtonPresent: false, requestKeyboardOnOpen: true,
            keyboardRequestedOnOpen: false, panelGravity: "center",
            panelBottomMarginDp: 0,
            addThreadId: null, addThreadName: null, removeThreadId: null,''', 1)

text = text.replace('        MODULE_VERSION: 4,', '        MODULE_VERSION: 5,', 1)
text = text.replace(
'''        openNew: function () { return openPanel("new", null); },
        openItem: function (id) { return openPanel("edit", Number(id)); },
        openTags: function (id) { return openPanel("tags", Number(id)); },''',
'''        openNew: function (options) {
            return openPanel("new", null, options || {});
        },
        openItem: function (id, options) {
            return openPanel("edit", Number(id), options || {});
        },
        openTags: function (id, options) {
            return openPanel("tags", Number(id), options || {});
        },''', 1)
text = text.replace(
'''        performCancelClick: function () {
            return requireMain(runOnMainSync(function () {
                return cancelView !== null ? cancelView.performClick() : false;
            }, 2500));
        },''',
'''        performCancelClick: function () {
            return requireMain(runOnMainSync(function () {
                return cancelView !== null ? cancelView.performClick() : false;
            }, 2500));
        },
        performHeaderCloseClick: function () {
            return requireMain(runOnMainSync(function () {
                return headerCloseView !== null ?
                    headerCloseView.performClick() : false;
            }, 2500));
        },''', 1)

path.write_text(text, encoding='utf-8')
PYEDITOR

cp probes/cliphub_search_filter_ui_probe_038_impl.js \
  probes/cliphub_editor_ui_probe_039_impl.js

python3 - <<'PYPROBE'
from pathlib import Path

path = Path('probes/cliphub_editor_ui_probe_039_impl.js')
text = path.read_text(encoding='utf-8')
marker = '    function main() {'
if marker not in text:
    raise SystemExit('probe main marker not found')
prefix = text[:text.index(marker)]
prefix = prefix.replace(
    '/* ClipHub search and advanced filter visual probe 038. Rhino ES5 only. */',
    '/* ClipHub new and edit visual probe 039. Rhino ES5 only. */')
prefix = prefix.replace('var REQUIRED_SET = "20260722.31";',
                        'var REQUIRED_SET = "20260722.32";')
prefix = prefix.replace('var RUNTIME_NAME = "ClipHubProbe038";',
                        'var RUNTIME_NAME = "ClipHubProbe039";')
prefix = prefix.replace('com.cliphub.probe038', 'com.cliphub.probe039')

suffix = r'''    function sameValue(left, right) {
        if (left === null || left === undefined) {
            return right === null || right === undefined;
        }
        return String(left) === String(right);
    }

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var formal = new File(root, "ClipHub");
        var modules = new File(formal, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var outputFile = new File(ensureDir(new File(formal, "probes")),
            "cliphub_editor_ui_probe_039_" + stamp(startedAt) + ".json");
        var local = localManifest(formal);
        var formalWasRunning = !lockFree(formal);
        var baseTime = startedAt - 20000;
        var existingId = null;
        var existingBefore = null;
        var existingAfter = null;
        var createdState = null;
        var createdRow = null;
        var cancelBefore = null;
        var cancelAfter = null;
        var newText = "ClipHub 手动新增测试内容\nRhino ES5 editor probe 039";
        var editText = "https://developer.android.com/updated Android Developers";
        var result = {
            ok: false,
            probe: "cliphub_editor_ui_probe_039",
            probeVersion: 1,
            moduleSetVersion: local.moduleSetVersion || null,
            sourceRef: local.sourceRef || null,
            sceneDurationMs: SCENE_DURATION_MS,
            sceneCount: 2,
            visualScreenshotRequired: true,
            instruction: "场景1截完整新增页；场景2截完整编辑页。两张截图均不得裁剪，键盘保持隐藏。",
            outputPath: String(outputFile.getAbsolutePath()),
            formalWasRunning: formalWasRunning,
            startedAt: startedAt,
            repositorySaveSemanticsChanged: false,
            tagManagerChanged: false,
            error: null
        };

        try {
            if (!local.present || local.moduleSetVersion !== REQUIRED_SET) {
                throw new Error("Installed module set must be " + REQUIRED_SET);
            }
            result.formalControl = stopFormal(global.context, formal);
            if (!result.formalControl.ok) {
                throw new Error(result.formalControl.error ||
                    "Formal stop failed");
            }
            removeTree(isolated);
            result.start = start(root, modules, isolated);
            result.themeModuleVersion = Number(global.ClipHub.Theme.MODULE_VERSION);
            result.windowModuleVersion = Number(global.ClipHub.Window.MODULE_VERSION);
            result.listModuleVersion = Number(global.ClipHub.List.MODULE_VERSION);
            result.editorModuleVersion = Number(global.ClipHub.Editor.MODULE_VERSION);
            result.filterModuleVersion = Number(global.ClipHub.Filter.MODULE_VERSION);
            result.translationModuleVersion =
                Number(global.ClipHub.Translation.MODULE_VERSION);
            result.navigationModuleVersion =
                Number(global.ClipHub.Navigation.MODULE_VERSION);
            result.schemaVersion = Number(global.ClipHub.Database.getVersion());
            result.clipboardListenerStopped =
                global.ClipHub.Clipboard.stop().running === false;
            global.ClipHub.Settings.set("themeMode", "light", { cleanup: false });

            existingId = add(
                "https://developer.android.com/ Android Developers",
                "url", "com.android.chrome", "Chrome 浏览器",
                false, true, baseTime + 1000);
            result.existingId = existingId;
            result.seededCount = Number(
                global.ClipHub.Repository.countItems(false));
            result.homeShow = global.ClipHub.List.show({
                limit: 20, widthDp: 340, heightDp: 560
            });

            result.newOpen = global.ClipHub.Editor.openNew({
                requestKeyboard: false
            });
            result.newSetText = global.ClipHub.Editor.setInputText(newText);
            result.newReady = waitFor(function () {
                var current = global.ClipHub.Editor.getState();
                return current.attachedToWindow === true &&
                    current.mode === "new" &&
                    current.editorStyle === "reference_editor_v1" &&
                    current.dragHandlePresent === true &&
                    current.headerIconPresent === true &&
                    current.headerCloseViewPresent === true &&
                    current.contentLabelPresent === true &&
                    current.characterCountPresent === true &&
                    current.metadataRowPresent === true &&
                    current.cancelButtonPresent === true &&
                    current.saveButtonPresent === true &&
                    current.footerActionCount === 2 &&
                    current.sourceMetaText === "ClipHub 手动" &&
                    current.typeMetaText === "文本" &&
                    current.contentLength === newText.length &&
                    current.requestKeyboardOnOpen === false &&
                    current.keyboardRequestedOnOpen === false &&
                    current.panelGravity === "bottom" &&
                    current.dimAmount > 0.43 && current.dimAmount < 0.45;
            }, 1800);
            result.newScene = global.ClipHub.Editor.getState();
            result.newNavigation = global.ClipHub.Navigation.getState();
            showToast("039  1/2  新增剪贴板  ·  请截完整页面");
            Thread.sleep(SCENE_DURATION_MS);

            result.newSaveClick = global.ClipHub.Editor.performSaveClick();
            createdState = global.ClipHub.Editor.getState();
            result.createdState = createdState;
            result.createdId = Number(createdState.lastSavedId || 0);
            createdRow = result.createdId > 0 ?
                global.ClipHub.Repository.getItem(result.createdId, false) : null;
            result.createdRow = createdRow;
            result.newSaveSemanticsPreserved = createdRow !== null &&
                String(createdRow.content) === newText &&
                String(createdRow.content_type) === "text" &&
                String(createdRow.source_label) === "ClipHub 手动" &&
                Number(createdRow.is_sensitive || 0) === 0 &&
                Number(createdRow.is_pinned || 0) === 0;

            existingBefore = global.ClipHub.Repository.getItem(existingId, false);
            result.existingBefore = existingBefore;
            result.editOpen = global.ClipHub.Editor.openItem(existingId, {
                requestKeyboard: false
            });
            result.editSetText = global.ClipHub.Editor.setInputText(editText);
            result.editReady = waitFor(function () {
                var current = global.ClipHub.Editor.getState();
                return current.attachedToWindow === true &&
                    current.mode === "edit" &&
                    current.editorStyle === "reference_editor_v1" &&
                    current.sourceMetaText === "Chrome 浏览器" &&
                    current.typeMetaText === "链接" &&
                    current.contentLength === editText.length &&
                    current.requestKeyboardOnOpen === false &&
                    current.keyboardRequestedOnOpen === false &&
                    current.panelGravity === "bottom" &&
                    current.footerActionCount === 2;
            }, 1800);
            result.editScene = global.ClipHub.Editor.getState();
            result.editNavigation = global.ClipHub.Navigation.getState();
            showToast("039  2/2  编辑剪贴板  ·  请截完整页面");
            Thread.sleep(SCENE_DURATION_MS);

            result.editSaveClick = global.ClipHub.Editor.performSaveClick();
            existingAfter = global.ClipHub.Repository.getItem(existingId, false);
            result.existingAfter = existingAfter;
            result.editSaveSemanticsPreserved = existingAfter !== null &&
                String(existingAfter.content) === editText &&
                sameValue(existingAfter.content_type, existingBefore.content_type) &&
                sameValue(existingAfter.source_package, existingBefore.source_package) &&
                sameValue(existingAfter.source_label, existingBefore.source_label) &&
                Number(existingAfter.is_sensitive || 0) ===
                    Number(existingBefore.is_sensitive || 0) &&
                Number(existingAfter.is_pinned || 0) ===
                    Number(existingBefore.is_pinned || 0);

            cancelBefore = String(existingAfter.content);
            result.cancelOpen = global.ClipHub.Editor.openItem(existingId, {
                requestKeyboard: false
            });
            result.cancelSetText = global.ClipHub.Editor.setInputText(
                "取消后不应保存的内容");
            result.cancelClick = global.ClipHub.Editor.performCancelClick();
            cancelAfter = String(global.ClipHub.Repository
                .getItem(existingId, false).content);
            result.cancelBefore = cancelBefore;
            result.cancelAfter = cancelAfter;
            result.cancelPreserved = cancelAfter === cancelBefore;

            result.backOpen = global.ClipHub.Editor.openNew({
                requestKeyboard: false
            });
            result.backRegistered = waitFor(function () {
                return containsText(global.ClipHub.Navigation.getState()
                    .registeredOwners, "editor");
            }, 1500);
            result.navigationBack = global.ClipHub.Navigation
                .dispatchBackForOwner("editor", "probe_editor_back_039");
            result.navigationBackReady = waitFor(function () {
                return global.ClipHub.Editor.getState().attached === false;
            }, 1200);
            result.navigationBackState = {
                editor: global.ClipHub.Editor.getState(),
                list: global.ClipHub.List.getState(),
                navigation: global.ClipHub.Navigation.getState()
            };

            result.stop = global.ClipHub.App.stop("probe039_editor_ui");
            result.databaseClosed = !global.ClipHub.Database.isOpen();
            result.lockReleased = lockFree(isolated);
        } catch (error) {
            result.error = errorText(error);
            try { global.ClipHub.App.stop("probe039_error"); }
            catch (ignoredStop) {}
        } finally {
            try {
                if (formalWasRunning) {
                    result.formalRestart = lockFree(formal) ?
                        start(root, modules, formal) :
                        { ok: true, started: true, reused: true };
                } else {
                    result.formalRestart = {
                        ok: true, skipped: true,
                        reason: "formal_was_not_running"
                    };
                }
            } catch (restartError) {
                result.formalRestart = {
                    ok: false, error: errorText(restartError)
                };
                if (result.error === null) {
                    result.error = "Formal restart failed: " +
                        errorText(restartError);
                }
            }
            result.cleanup = removeTree(isolated);
            result.finishedAt = now();
            result.durationMs = result.finishedAt - result.startedAt;
            result.ok = result.error === null &&
                result.start && result.start.ok === true &&
                result.schemaVersion === 2 &&
                result.themeModuleVersion === 2 &&
                result.windowModuleVersion === 5 &&
                result.listModuleVersion === 11 &&
                result.editorModuleVersion === 5 &&
                result.filterModuleVersion === 9 &&
                result.translationModuleVersion === 4 &&
                result.navigationModuleVersion === 3 &&
                result.clipboardListenerStopped === true &&
                result.seededCount === 1 &&
                result.newReady === true &&
                result.newScene &&
                result.newScene.panelWidthDp >= 370 &&
                result.newScene.panelWidthDp <= 400 &&
                result.newScene.panelHeightDp >= 560 &&
                result.newScene.panelHeightDp <= 610 &&
                result.newScene.editorFooterHeightDp === 50 &&
                result.newScene.contentMinLines === 10 &&
                result.newSaveClick === true &&
                result.newSaveSemanticsPreserved === true &&
                result.editReady === true &&
                result.editScene &&
                result.editScene.panelWidthDp >= 370 &&
                result.editScene.panelWidthDp <= 400 &&
                result.editScene.panelHeightDp >= 560 &&
                result.editScene.panelHeightDp <= 610 &&
                result.editSaveClick === true &&
                result.editSaveSemanticsPreserved === true &&
                result.cancelClick === true &&
                result.cancelPreserved === true &&
                result.backRegistered === true &&
                result.navigationBack === true &&
                result.navigationBackReady === true &&
                result.navigationBackState.editor.attached === false &&
                result.navigationBackState.list.visible === true &&
                result.stop && result.stop.stopped === true &&
                result.databaseClosed === true &&
                result.lockReleased === true &&
                result.formalRestart && result.formalRestart.ok === true &&
                result.cleanup === true;
            write(outputFile, JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try {
        global.ClipHubEditorUiProbe039Result = main();
    } catch (error) {
        global.ClipHubEditorUiProbe039Result = {
            ok: false,
            probe: "cliphub_editor_ui_probe_039",
            probeVersion: 1,
            fatal: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubEditorUiProbe039Result);
'''
path.write_text(prefix + suffix, encoding='utf-8')
PYPROBE

python3 - <<'PYDOCS'
from pathlib import Path

stage_path = Path('docs/阶段3D2新UI全量复刻方案.md')
stage = stage_path.read_text(encoding='utf-8')
stage = stage.replace(
'''- [x] 发布模块集 `.31` 并新增布局适配探测 038；
- [ ] 运行探测 038，回传两张未裁剪截图与完整 JSON；
- [ ] 确认搜索 / 筛选页最终视觉基线。
### 3D2-3：新增 / 编辑页复刻

重构现有 Editor 表单，但不改变 Repository 保存语义。''',
'''- [x] 发布模块集 `.31` 并新增布局适配探测 038；
- [x] 探测 038：`ok=true`，实际内容高度 360dp、视口 391dp，首屏完整容纳；
- [x] 确认搜索 / 筛选页最终视觉基线。
### 3D2-3：新增 / 编辑页复刻

- [x] 完成 Editor v5 / `reference_editor_v1` 第一轮视觉重构；
- [x] 新增和编辑模式改为共享紫色底部浮层，标签管理模式保持原实现；
- [x] 增加拖动手柄视觉、模式图标、标题说明、只读类型/来源信息和字符计数；
- [x] 内容编辑区改为圆角卡片，底部固定“取消 / 保存”双按钮；
- [x] 新增可选 `requestKeyboard`，原有调用默认仍自动唤起键盘；
- [x] 保持新增记录固定为 text / ClipHub 手动，编辑仅更新 content；
- [x] 保持系统返回、三键返回和最近任务关闭链不变；
- [x] 发布模块集 `.32` 并新增探测 039；
- [ ] 运行探测 039，回传新增页和编辑页两张未裁剪截图与完整 JSON；
- [ ] 根据真机结果进行第二轮视觉校正。''', 1)
stage_path.write_text(stage, encoding='utf-8')

plan_path = Path('docs/开发计划.md')
plan = plan_path.read_text(encoding='utf-8')
old = '''- [x] 发布模块集 `20260722.31`
- [x] 新增探测 038
- [ ] 运行探测 038 并回传两张未裁剪截图与完整 JSON
- [ ] 确认搜索 / 筛选页最终视觉基线

当前边界：第四轮使用 Android 实际 View 测量判定首屏是否完整容纳，不再只检查配置值。Repository、排序窗口和 Navigation 语义保持不变。
#### 后续页面

- [ ] 3D2-3 复刻新增 / 编辑页'''
new = '''- [x] 发布模块集 `20260722.31`
- [x] 新增探测 038
- [x] 探测 038 自动验证和两张未裁剪截图通过
- [x] 确认搜索 / 筛选页最终视觉基线

当前边界：第四轮使用 Android 实际 View 测量判定首屏完整容纳。Repository、排序窗口和 Navigation 语义保持不变。

#### 3D2-3：新增 / 编辑页

- [x] 完成 Editor v5 / `reference_editor_v1` 第一轮实现
- [x] 新增 / 编辑模式切换到共享紫色底部浮层
- [x] 增加标题图标、说明、只读类型 / 来源、字符计数和双按钮底栏
- [x] 标签管理模式保持原实现，留到 3D2-5 处理
- [x] 新增记录仍固定写入 text / ClipHub 手动
- [x] 编辑记录仍只更新 content，不改变来源、类型、敏感和置顶字段
- [x] `openNew` / `openItem` 增加兼容的可选 `requestKeyboard`
- [x] Navigation 继续通过 `ClipHub Editor Panel` 注册返回
- [x] 发布模块集 `20260722.32`
- [x] 新增探测 039
- [ ] 运行探测 039 并回传新增页、编辑页两张未裁剪截图与完整 JSON
- [ ] 根据真机结果完成第二轮视觉校正

当前边界：只重构新增和编辑正文页面，不修改 Repository 保存语义，不提前改造标签管理，不修改 Navigation v3。
#### 后续页面

- [x] 3D2-3 第一轮新增 / 编辑页'''
if old not in plan:
    raise SystemExit('development section marker not found')
plan = plan.replace(old, new, 1)
plan = plan.replace('moduleSetVersion=20260722.31',
                    'moduleSetVersion=20260722.32', 1)
plan = plan.replace('List=11\nFilter=9', 'List=11\nEditor=5\nFilter=9', 1)
next_start = '## 下一步\n'
next_end = '\n### 后续阶段 3E：入口版本 5'
if next_start not in plan or next_end not in plan:
    raise SystemExit('next section markers not found')
next_text = '''## 下一步

### 运行新增 / 编辑页探测 039

1. 在 Termux 同步 `agent/initialize-project-skeleton`；
2. 运行 `ClipHub.js`，确认模块集为 `.32`；
3. 运行 `ClipHub 新增编辑UI探测039`；
4. 截取完整新增页，不得裁剪且保持键盘隐藏；
5. 截取完整编辑页，不得裁剪且保持键盘隐藏；
6. 回传完整 JSON；
7. 检查面板尺寸、底部浮层位置、内容编辑区和固定双按钮；
8. 检查新增保存语义、编辑字段边界、取消不保存和返回层级；
9. 检查正式实例恢复、数据库关闭、运行锁释放和隔离目录清理。'''
plan = plan[:plan.index(next_start)] + next_text + plan[plan.index(next_end):]
plan_path.write_text(plan, encoding='utf-8')
PYDOCS

editor_sha="$(git hash-object src/ch_10_editor.js)"
python3 - "$editor_sha" <<'PYMANIFEST'
from pathlib import Path
import json
import sys

path = Path('module-manifest.json')
data = json.loads(path.read_text(encoding='utf-8'))
if data.get('schemaVersion') != 1 or data.get('entryMinVersion') != 4:
    raise SystemExit('manifest schema or entry version changed')
if len(data.get('modules', [])) != 15:
    raise SystemExit('manifest module count must remain 15')
data['moduleSetVersion'] = '20260722.32'
found = False
for item in data['modules']:
    if item.get('name') == 'ch_10_editor.js':
        item['sha'] = sys.argv[1]
        found = True
if not found:
    raise SystemExit('editor module missing from manifest')
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n',
                encoding='utf-8')
PYMANIFEST

python3 - <<'PYCHECK'
from pathlib import Path
import json
import re

files = [
    'src/ch_10_editor.js',
    'probes/cliphub_editor_ui_probe_039_impl.js'
]
for name in files:
    source = Path(name).read_text(encoding='utf-8')
    forbidden = []
    if re.search(r'\b(?:let|const)\s+', source): forbidden.append('let/const')
    if '=>' in source: forbidden.append('arrow')
    if '`' in source: forbidden.append('template literal')
    if re.search(r'\bclass\s+[A-Za-z_$]', source): forbidden.append('class')
    if forbidden:
        raise SystemExit(name + ' forbidden ES6: ' + ', '.join(forbidden))

editor = Path('src/ch_10_editor.js').read_text(encoding='utf-8')
assert 'MODULE_VERSION: 5' in editor
assert 'reference_editor_v1' in editor
assert 'function buildTextContent(initialText, row, options)' in editor
assert 'panelParams.dimAmount = 0.44;' in editor
assert 'panelParams.gravity = Gravity.BOTTOM |' in editor
assert 'sourceLabel: "ClipHub 手动"' in editor
assert 'ClipHub.Repository.updateItem(id, { content: content })' in editor
assert 'openNew: function (options)' in editor
assert 'performHeaderCloseClick' in editor

manifest = json.loads(Path('module-manifest.json').read_text(encoding='utf-8'))
assert manifest['moduleSetVersion'] == '20260722.32'
assert manifest['entryMinVersion'] == 4
assert len(manifest['modules']) == 15

probe = Path('probes/cliphub_editor_ui_probe_039_impl.js').read_text(encoding='utf-8')
assert 'REQUIRED_SET = "20260722.32"' in probe
assert 'editorModuleVersion === 5' in probe
assert 'reference_editor_v1' in probe
assert 'newSaveSemanticsPreserved' in probe
assert 'editSaveSemanticsPreserved' in probe
assert 'cancelPreserved' in probe
PYCHECK

node --check src/ch_10_editor.js
node --check probes/cliphub_editor_ui_probe_039_impl.js
if [ -f scripts/check_es5.py ]; then python3 scripts/check_es5.py; fi
git diff --check

git config user.name "ClipHub Automation"
git config user.email "actions@github.com"
git add src/ch_10_editor.js module-manifest.json \
  probes/cliphub_editor_ui_probe_039_impl.js \
  docs/阶段3D2新UI全量复刻方案.md docs/开发计划.md
git commit -m "feat: rebuild new and edit clipboard pages"
implementation_commit="$(git rev-parse HEAD)"

cat > probes/cliphub_editor_ui_probe_039.js <<EOF
/* ClipHub new and edit visual probe 039 loader. Rhino ES5 only. */
(function (global) {
    var URL = Packages.java.net.URL;
    var BR = Packages.java.io.BufferedReader;
    var ISR = Packages.java.io.InputStreamReader;
    var SB = Packages.java.lang.StringBuilder;
    var System = Packages.java.lang.System;
    var connection = null;
    var input = null;
    var reader = null;
    var builder = new SB();
    var line;
    var source;
    var implementationCommit =
        "${implementation_commit}";
    var target = "https://raw.githubusercontent.com/7015725/ClipHub/" +
        implementationCommit + "/probes/" +
        "cliphub_editor_ui_probe_039_impl.js" +
        "?_=" + Number(System.currentTimeMillis());

    try {
        connection = new URL(target).openConnection();
        connection.setUseCaches(false);
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(20000);
        connection.setRequestProperty("Cache-Control", "no-cache, no-store");
        connection.setRequestProperty("Pragma", "no-cache");
        connection.setRequestProperty("User-Agent", "ClipHub-Probe/039-v1");
        input = connection.getInputStream();
        reader = new BR(new ISR(input, "UTF-8"));
        while ((line = reader.readLine()) !== null) {
            builder.append(line).append("\n");
        }
        source = String(builder.toString());
        if (!source) {
            throw new Error("Probe 039 implementation is empty");
        }
        if (source.indexOf("probeVersion: 1") < 0 ||
                source.indexOf("REQUIRED_SET = \"20260722.32\"") < 0 ||
                source.indexOf("editorModuleVersion === 5") < 0 ||
                source.indexOf("navigationModuleVersion === 3") < 0 ||
                source.indexOf("cliphub_editor_ui_probe_039") < 0 ||
                source.indexOf("reference_editor_v1") < 0 ||
                source.indexOf("newSaveSemanticsPreserved") < 0 ||
                source.indexOf("editSaveSemanticsPreserved") < 0 ||
                source.indexOf("cancelPreserved") < 0) {
            throw new Error("Probe 039 implementation validation failed");
        }
        eval(source + "\n//# sourceURL=ClipHub/probe_039_impl_v1.js");
    } finally {
        try { if (reader !== null) { reader.close(); } }
        catch (ignoredReader) {}
        try { if (input !== null) { input.close(); } }
        catch (ignoredInput) {}
        try {
            if (connection !== null && connection.disconnect) {
                connection.disconnect();
            }
        } catch (ignoredConnection) {}
    }
}((function () { return this; }())));

JSON.stringify(ClipHubEditorUiProbe039Result);
EOF

cat > docs/新增编辑新UI探测039说明.md <<EOF
# ClipHub 新增 / 编辑新 UI 探测 039

## 目标

验证阶段 3D2-3 第一轮新增 / 编辑页视觉重构，同时确认 Repository 保存边界、取消语义和 Navigation 返回链没有变化。

## 模块集

\`\`\`text
moduleSetVersion=20260722.32
entryVersion=4
databaseSchemaVersion=2
Editor=5
Filter=9
Translation=4
Navigation=3
\`\`\`

## 本轮边界

- 只重构新增和编辑正文页面；
- 标签管理继续使用原实现，留到 3D2-5；
- 新增记录继续固定写入 \`content_type=text\`、\`source_label=ClipHub 手动\`；
- 编辑记录继续只更新 \`content\`；
- 不修改 Repository、数据库 schema、Navigation v3 和后台监听生命周期；
- 不增加透明触摸层、自定义底部手势或 WebView。

## 新 UI

- 共享紫色底部浮层；
- 顶部视觉拖动手柄；
- 新增 / 编辑模式图标和说明；
- 只读类型与来源信息；
- 内容字符计数；
- 固定“取消 / 保存”双按钮；
- 探测时通过可选 \`requestKeyboard=false\` 保持键盘隐藏，正式入口默认行为不变。

## 探测文件

\`\`\`text
probes/cliphub_editor_ui_probe_039.js
probes/cliphub_editor_ui_probe_039_impl.js
\`\`\`

加载器固定读取实现提交：

\`\`\`text
${implementation_commit}
\`\`\`

## 运行步骤

1. 在 Termux 同步 \`agent/initialize-project-skeleton\`；
2. 运行 \`ClipHub.js\`，确认模块集为 \`.32\`；
3. 将 \`probes/cliphub_editor_ui_probe_039.js\` 完整复制到新的 ShortX JavaScript 任务；
4. 建议任务名：\`ClipHub 新增编辑UI探测039\`；
5. 场景 1 截取完整新增页，键盘保持隐藏；
6. 场景 2 截取完整编辑页，键盘保持隐藏；
7. 回传两张未裁剪截图和完整 JSON。

## 自动检查

- Editor v5 / \`reference_editor_v1\`；
- 面板宽度约 390dp、高度约 590dp、底部浮层和 dim 约 0.44；
- 标题图标、来源 / 类型、字符计数、取消 / 保存按钮存在；
- 新增保存语义保持不变；
- 编辑仅修改正文，来源、类型、敏感和置顶字段不变；
- 取消不保存；
- Editor 返回后首页仍可见；
- 正式实例恢复、数据库关闭、运行锁释放和隔离目录清理正常。
EOF

node --check probes/cliphub_editor_ui_probe_039.js
node --check probes/cliphub_editor_ui_probe_039_impl.js
if [ -f scripts/check_es5.py ]; then python3 scripts/check_es5.py; fi
git diff --check

git add probes/cliphub_editor_ui_probe_039.js \
  docs/新增编辑新UI探测039说明.md

git rm -r "$HELPER_DIR" "$WORKFLOW_PATH"
git commit -m "test: add new and edit visual probe 039"
git push origin "HEAD:$BRANCH"
