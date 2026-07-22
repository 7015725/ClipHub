from pathlib import Path
import json
import subprocess


def git_hash(path):
    return subprocess.check_output(['git', 'hash-object', path], text=True).strip()


def check_hash(path, expected):
    actual = git_hash(path)
    if actual != expected:
        raise SystemExit('Unexpected base for %s: %s != %s' %
                         (path, actual, expected))


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit('%s expected one match, got %d' % (label, count))
    return text.replace(old, new, 1)


def replace_between(text, start, end, replacement, label):
    start_index = text.find(start)
    if start_index < 0:
        raise SystemExit(label + ' start marker missing')
    end_index = text.find(end, start_index + len(start))
    if end_index < 0:
        raise SystemExit(label + ' end marker missing')
    return text[:start_index] + replacement + text[end_index:]


check_hash('src/ch_10_editor.js', '40376488c13846095c86482ab135a446f956eafb')
check_hash('src/ch_11_filter.js', '99b52f09d19296f20d793058569b6b779e5c067c')
check_hash('src/ch_13_settings.js', 'ec16115e869a76b0d9714b0fc5fad174990bf244')
check_hash('module-manifest.json', 'e0ae205a9a7e745f465f79c6641499cd37cbb414')

# ---------------------------------------------------------------------------
# Editor v10: transactional tag selection for both new and existing records.
# ---------------------------------------------------------------------------
path = Path('src/ch_10_editor.js')
text = path.read_text(encoding='utf-8')

text = replace_once(text,
'''    var tagViews = {};
    var tagDeleteViews = {};
    var ready = false;
''',
'''    var tagViews = {};
    var tagDeleteViews = {};
    var tagSelectionSaveView = null;
    var tagSelectionCancelView = null;
    var editorDraftTagIds = [];
    var tagSelectorOriginalIds = [];
    var tagReturnMode = null;
    var tagReturnText = "";
    var tagReturnRow = null;
    var ready = false;
''', 'editor tag selector variables')

text = replace_once(text,
'''        tagDeleteCount: 0,
        tagRenameCount: 0,
        tagOptionCount: 0,
''',
'''        tagDeleteCount: 0,
        tagRenameCount: 0,
        tagSelectionOpenCount: 0,
        tagSelectionSaveCount: 0,
        tagSelectionCancelCount: 0,
        tagSelectionDirty: false,
        tagDraftCount: 0,
        tagOriginalCount: 0,
        tagColorPreviewCount: 0,
        tagFooterActionCount: 0,
        tagSelectorStyle: "reference_tag_selector_v1",
        tagOptionCount: 0,
''', 'editor tag state fields')

text = replace_once(text,
'''        var tagsMode = String(mode) === "tags";
        var maxWidthDp = tagsMode ? 420 : 390;
        var minWidthDp = tagsMode ? 270 : 300;
        var width = Math.min(dp(maxWidthDp), Math.max(dp(minWidthDp),
            Number(metrics.widthPixels) - dp(tagsMode ? 12 : 20)));
        var availableHeight = Math.max(dp(300),
            Number(metrics.heightPixels) - dp(tagsMode ? 72 : 86));
''',
'''        var tagsMode = String(mode) === "tags";
        var maxWidthDp = 390;
        var minWidthDp = 300;
        var width = Math.min(dp(maxWidthDp), Math.max(dp(minWidthDp),
            Number(metrics.widthPixels) - dp(20)));
        var availableHeight = Math.max(dp(300),
            Number(metrics.heightPixels) - dp(86));
''', 'editor tag panel width')
text = replace_once(text,
'''            heightDp = 222 + Math.min(5, Math.max(1, count)) * 54;
            heightDp = Math.max(310, Math.min(492, heightDp));
''',
'''            heightDp = 274 + Math.min(5, Math.max(1, count)) * 52;
            heightDp = Math.max(430, Math.min(590, heightDp));
''', 'editor tag panel height')

text = replace_once(text,
'''        tagViews = {};
        tagDeleteViews = {};
        state.dragHandlePresent = false;
''',
'''        tagViews = {};
        tagDeleteViews = {};
        tagSelectionSaveView = null;
        tagSelectionCancelView = null;
        editorDraftTagIds = [];
        tagSelectorOriginalIds = [];
        tagReturnMode = null;
        tagReturnText = "";
        tagReturnRow = null;
        state.dragHandlePresent = false;
''', 'editor clear tag selector')

text = replace_once(text,
'''    function closePanel(reason) {
        if (!state.attached && panelRoot === null) {
''',
'''    function closePanel(reason) {
        if (state.mode === "tags" && tagReturnMode !== null &&
                String(reason || "") !== "shutdown" &&
                String(reason || "") !== "replace" &&
                String(reason || "") !== "save") {
            requireMain(runOnMainSync(function () {
                return restoreTextEditorOnMain(false);
            }, 2500));
            return { ok: true, attached: true, returnedToEditor: true,
                state: getState() };
        }
        if (!state.attached && panelRoot === null) {
''', 'editor nested back guard')

text = replace_once(text,
'''            state.saveCount += 1;
            state.lastSavedId = id;
''',
'''            ClipHub.Repository.setItemTags(id, editorDraftTagIds);
            emitTagChanged("item_tags_saved", id, null);
            state.saveCount += 1;
            state.lastSavedId = id;
''', 'editor save tag associations')

text = replace_between(text,
'    function itemHasTag(tagId) {\n',
'    function recordTagAction(action, tagId) {\n',
'''    function copyTagIds(input) {
        var output = [];
        var seen = {};
        var index;
        var id;
        input = input || [];
        for (index = 0; index < input.length; index += 1) {
            id = Number(input[index]);
            if (id > 0 && !seen[String(id)]) {
                seen[String(id)] = true;
                output.push(id);
            }
        }
        return output;
    }

    function loadItemTagIds(itemId) {
        var tags;
        var output = [];
        var index;
        if (itemId === null || itemId === undefined) { return output; }
        tags = ClipHub.Repository.listItemTags(Number(itemId));
        for (index = 0; index < tags.length; index += 1) {
            output.push(Number(tags[index].id));
        }
        return output;
    }

    function tagIndex(tagId) {
        var index;
        for (index = 0; index < editorDraftTagIds.length; index += 1) {
            if (Number(editorDraftTagIds[index]) === Number(tagId)) {
                return index;
            }
        }
        return -1;
    }

    function itemHasTag(tagId) {
        return tagIndex(tagId) >= 0;
    }

''', 'editor draft tag helpers')

text = replace_between(text,
'    function createTagFromInput() {\n',
'    function toggleTag(tagId) {\n',
'''    function createTagFromInput() {
        var name;
        var tagId;
        if (tagNameInput === null || state.mode !== "tags") { return false; }
        try {
            name = ClipHub.Repository.normalizeTagName(
                String(tagNameInput.getText()));
            if (name.length === 0) {
                throw new Error("标签名称不能为空");
            }
            tagId = Number(ClipHub.Repository.ensureTag(name,
                Number(Color.parseColor("#7C5CFC"))));
            if (!itemHasTag(tagId)) {
                editorDraftTagIds.push(tagId);
            }
            state.tagCreateCount += 1;
            state.tagSelectionDirty = true;
            state.tagDraftCount = editorDraftTagIds.length;
            recordTagAction("tag_created_draft", tagId);
            tagNameInput.setText("");
            buildTagContent(false);
            updatePanelSizeForMode();
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

''', 'editor create draft tag')

text = replace_between(text,
'    function toggleTag(tagId) {\n',
'    function deleteTag(tagId) {\n',
'''    function toggleTag(tagId) {
        var index;
        if (state.mode !== "tags") { return false; }
        try {
            index = tagIndex(tagId);
            if (index >= 0) {
                editorDraftTagIds.splice(index, 1);
                recordTagAction("tag_draft_detached", tagId);
            } else {
                editorDraftTagIds.push(Number(tagId));
                recordTagAction("tag_draft_attached", tagId);
            }
            state.tagToggleCount += 1;
            state.tagSelectionDirty = true;
            state.tagDraftCount = editorDraftTagIds.length;
            buildTagContent(false);
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

''', 'editor toggle draft tag')

helpers = '''    function tagColorText(tag, fallback) {
        var value;
        var hex;
        if (!tag || tag.color_value === null || tag.color_value === undefined) {
            return String(fallback || "#7C5CFC");
        }
        value = Number(tag.color_value) >>> 0;
        hex = value.toString(16).toUpperCase();
        while (hex.length < 8) { hex = "0" + hex; }
        return "#" + hex;
    }

    function openTagSelectorOnMain() {
        if (state.mode !== "new" && state.mode !== "edit") { return false; }
        tagReturnMode = state.mode;
        tagReturnText = contentInput === null ? "" :
            String(contentInput.getText());
        tagReturnRow = state.itemId === null ? null :
            ClipHub.Repository.getItem(Number(state.itemId), false);
        tagSelectorOriginalIds = copyTagIds(editorDraftTagIds);
        state.tagOriginalCount = tagSelectorOriginalIds.length;
        state.tagDraftCount = editorDraftTagIds.length;
        state.tagSelectionDirty = false;
        state.tagSelectionOpenCount += 1;
        state.mode = "tags";
        hideKeyboardOnMain();
        buildTagContent(false);
        updatePanelSizeForMode();
        return true;
    }

    function restoreTextEditorOnMain(commit) {
        var parentMode = tagReturnMode ||
            (state.itemId === null ? "new" : "edit");
        if (commit === true) {
            tagSelectorOriginalIds = copyTagIds(editorDraftTagIds);
            state.tagSelectionSaveCount += 1;
        } else {
            editorDraftTagIds = copyTagIds(tagSelectorOriginalIds);
            state.tagSelectionCancelCount += 1;
        }
        state.tagSelectionDirty = false;
        state.tagDraftCount = editorDraftTagIds.length;
        state.mode = parentMode;
        buildTextContent(tagReturnText, tagReturnRow, {
            requestKeyboard: false
        });
        updatePanelSizeForMode();
        tagReturnMode = null;
        return true;
    }

    function saveTagSelectionDraft() {
        return requireMain(runOnMainSync(function () {
            return restoreTextEditorOnMain(true);
        }, 2500));
    }

    function cancelTagSelectionDraft() {
        return requireMain(runOnMainSync(function () {
            return restoreTextEditorOnMain(false);
        }, 2500));
    }

'''
text = replace_once(text,
'    function addTitle(titleText, subtitleText) {\n',
helpers + '    function addTitle(titleText, subtitleText) {\n',
'editor tag selector helpers')

old_meta_start = '''        metadataTypeView = makeEditorPill(isNew ?
            "标签  保存后设置" : "标签  管理", colors, !isNew);
'''
old_meta_end = '''        metaRow.addView(metadataTypeView,
            new LinearLayout.LayoutParams(dp(116), dp(32)));
'''
start_index = text.find(old_meta_start)
end_index = text.find(old_meta_end, start_index)
if start_index < 0 or end_index < 0:
    raise SystemExit('editor metadata tag block missing')
end_index += len(old_meta_end)
new_meta = '''        metadataTypeView = makeEditorPill(
            editorDraftTagIds.length > 0 ?
                "标签  " + String(editorDraftTagIds.length) + " 个" :
                "标签  未设置", colors, editorDraftTagIds.length > 0);
        metadataTypeView.setClickable(true);
        metadataTypeView.setFocusable(true);
        metadataTypeView.setContentDescription("选择当前记录标签");
        metadataTypeView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () { openTagSelectorOnMain(); }
            }));
        metaRow.addView(metadataTypeView,
            new LinearLayout.LayoutParams(dp(116), dp(32)));
'''
text = text[:start_index] + new_meta + text[end_index:]

new_tag_builder = '''    function buildTagContent(requestFocus) {
        var colors = editorPalette();
        var dragRow = new LinearLayout(appContext);
        var dragHandle = new View(appContext);
        var header = new LinearLayout(appContext);
        var titleStack = new LinearLayout(appContext);
        var title;
        var subtitle;
        var inputRow = new LinearLayout(appContext);
        var scroll = new ScrollView(appContext);
        var list = new LinearLayout(appContext);
        var footer = new LinearLayout(appContext);
        var allTags = ClipHub.Repository.listTags();
        var index;
        var tag;
        var row;
        var dot;
        var labels;
        var name;
        var count;
        var check;
        var params;
        var inputParams;

        panelRoot.removeAllViews();
        tagViews = {};
        tagDeleteViews = {};
        state.editorStyle = "reference_tag_selector_v1";
        state.tagSelectorStyle = "reference_tag_selector_v1";
        state.tagColorPreviewCount = 0;
        state.tagFooterActionCount = 2;

        dragRow.setGravity(Gravity.CENTER);
        dragHandle.setBackground(roundedBackground(
            colors.accentBorder, null, 3));
        dragRow.addView(dragHandle,
            new LinearLayout.LayoutParams(dp(42), dp(4)));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(16));
        params.bottomMargin = dp(4);
        panelRoot.addView(dragRow, params);

        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        titleStack.setOrientation(LinearLayout.VERTICAL);
        title = makeText("选择标签", 18, colors.textPrimary, true);
        subtitle = makeText("已选择 " + String(editorDraftTagIds.length) +
            " 个 · 取消不会保存更改", 10, colors.textSecondary, false);
        titleStack.addView(title, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(2);
        titleStack.addView(subtitle, params);
        header.addView(titleStack, new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        headerCloseView = makeText("×", 22, colors.icon, true);
        headerCloseView.setGravity(Gravity.CENTER);
        headerCloseView.setBackground(roundedBackground(
            colors.surfaceMuted, null, 18));
        headerCloseView.setClickable(true);
        headerCloseView.setFocusable(true);
        headerCloseView.setContentDescription("取消标签选择");
        headerCloseView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () { cancelTagSelectionDraft(); }
            }));
        header.addView(headerCloseView,
            new LinearLayout.LayoutParams(dp(38), dp(38)));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(10);
        panelRoot.addView(header, params);

        inputRow.setOrientation(LinearLayout.HORIZONTAL);
        inputRow.setGravity(Gravity.CENTER_VERTICAL);
        tagNameInput = new EditText(appContext);
        tagNameInput.setSingleLine(true);
        tagNameInput.setHint("新标签名称");
        tagNameInput.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        tagNameInput.setTextColor(Color.parseColor(colors.textPrimary));
        tagNameInput.setHintTextColor(Color.parseColor(colors.textTertiary));
        tagNameInput.setInputType(InputType.TYPE_CLASS_TEXT |
            InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        tagNameInput.setPadding(dp(10), dp(7), dp(10), dp(7));
        tagNameInput.setBackground(roundedBackground(
            colors.surfaceMuted, colors.stroke, 11));
        inputParams = new LinearLayout.LayoutParams(
            0, dp(42), 1);
        inputParams.rightMargin = dp(7);
        inputRow.addView(tagNameInput, inputParams);
        createTagView = makeEditorAction("新增", colors, true);
        createTagView.setContentDescription("创建并选择新标签");
        createTagView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () { createTagFromInput(); }
            }));
        inputRow.addView(createTagView,
            new LinearLayout.LayoutParams(dp(70), dp(42)));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(42));
        params.bottomMargin = dp(9);
        panelRoot.addView(inputRow, params);

        scroll.setFillViewport(false);
        scroll.setVerticalScrollBarEnabled(false);
        list.setOrientation(LinearLayout.VERTICAL);
        if (allTags.length === 0) {
            row = makeText("暂无标签\n可在上方创建第一个标签", 12,
                colors.textSecondary, false);
            row.setGravity(Gravity.CENTER);
            row.setPadding(dp(12), dp(28), dp(12), dp(28));
            list.addView(row, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));
        } else {
            for (index = 0; index < allTags.length; index += 1) {
                tag = allTags[index];
                row = new LinearLayout(appContext);
                row.setOrientation(LinearLayout.HORIZONTAL);
                row.setGravity(Gravity.CENTER_VERTICAL);
                row.setPadding(dp(10), dp(8), dp(9), dp(8));
                row.setBackground(roundedBackground(
                    itemHasTag(tag.id) ? colors.accentSoft : colors.surfaceMuted,
                    itemHasTag(tag.id) ? colors.accentBorder : colors.stroke, 12));
                row.setClickable(true);
                row.setFocusable(true);
                row.setContentDescription((itemHasTag(tag.id) ?
                    "取消选择标签 " : "选择标签 ") + String(tag.name));
                dot = new View(appContext);
                dot.setBackground(roundedBackground(
                    tagColorText(tag, colors.accentStrong), null, 99));
                params = new LinearLayout.LayoutParams(dp(14), dp(14));
                params.rightMargin = dp(9);
                row.addView(dot, params);
                state.tagColorPreviewCount += 1;
                labels = new LinearLayout(appContext);
                labels.setOrientation(LinearLayout.VERTICAL);
                name = makeText(String(tag.name), 12,
                    colors.textPrimary, itemHasTag(tag.id));
                name.setSingleLine(true);
                name.setMaxLines(1);
                name.setEllipsize(TextUtils.TruncateAt.END);
                count = makeText(String(Number(tag.item_count || 0)) +
                    " 条记录", 9, colors.textSecondary, false);
                labels.addView(name, new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT));
                labels.addView(count, new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT));
                row.addView(labels, new LinearLayout.LayoutParams(
                    0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
                check = makeText(itemHasTag(tag.id) ? "✓" : "+", 15,
                    itemHasTag(tag.id) ? colors.accentStrong :
                        colors.textTertiary, true);
                check.setGravity(Gravity.CENTER);
                row.addView(check,
                    new LinearLayout.LayoutParams(dp(34), dp(34)));
                (function (tagId, view) {
                    view.setOnClickListener(new JavaAdapter(
                        View.OnClickListener, {
                            onClick: function () { toggleTag(tagId); }
                        }));
                    tagViews[String(tagId)] = view;
                }(Number(tag.id), row));
                params = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, dp(54));
                params.bottomMargin = dp(6);
                list.addView(row, params);
            }
        }
        state.tagOptionCount = allTags.length;
        state.attachedTagCount = editorDraftTagIds.length;
        state.tagDraftCount = editorDraftTagIds.length;
        scroll.addView(list,
            new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1);
        params.bottomMargin = dp(8);
        panelRoot.addView(scroll, params);

        footer.setOrientation(LinearLayout.HORIZONTAL);
        footer.setGravity(Gravity.CENTER_VERTICAL);
        tagSelectionCancelView = makeEditorAction("取消", colors, false);
        tagSelectionCancelView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () { cancelTagSelectionDraft(); }
            }));
        tagSelectionSaveView = makeEditorAction(
            "完成（" + String(editorDraftTagIds.length) + "）", colors, true);
        tagSelectionSaveView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () { saveTagSelectionDraft(); }
            }));
        params = new LinearLayout.LayoutParams(0, dp(42), 1);
        params.rightMargin = dp(8);
        footer.addView(tagSelectionCancelView, params);
        footer.addView(tagSelectionSaveView,
            new LinearLayout.LayoutParams(0, dp(42), 1));
        panelRoot.addView(footer, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(50)));
        if (requestFocus) { requestKeyboardOnMain(); }
        return true;
    }

'''
text = replace_between(text,
'    function buildTagContent(requestFocus) {\n',
'    function openPanel(mode, itemId, options) {\n',
new_tag_builder, 'editor tag selector builder')

text = replace_once(text,
'''        state.itemId = state.mode === "new" ? null : Number(itemId);
        requestKeyboard = options.requestKeyboard !== false;
''',
'''        state.itemId = state.mode === "new" ? null : Number(itemId);
        if (state.mode === "new" || state.mode === "edit") {
            editorDraftTagIds = state.mode === "edit" ?
                loadItemTagIds(state.itemId) : [];
            tagSelectorOriginalIds = copyTagIds(editorDraftTagIds);
            state.tagDraftCount = editorDraftTagIds.length;
            state.tagOriginalCount = editorDraftTagIds.length;
            state.tagSelectionDirty = false;
            tagReturnMode = null;
            tagReturnText = initialText;
            tagReturnRow = row;
        }
        requestKeyboard = options.requestKeyboard !== false;
''', 'editor initialize tag draft')

text = replace_once(text,
'''            tagRenameCount: Number(state.tagRenameCount),
            tagOptionCount: Number(state.tagOptionCount),
''',
'''            tagRenameCount: Number(state.tagRenameCount),
            tagSelectionOpenCount: Number(state.tagSelectionOpenCount),
            tagSelectionSaveCount: Number(state.tagSelectionSaveCount),
            tagSelectionCancelCount: Number(state.tagSelectionCancelCount),
            tagSelectionDirty: state.tagSelectionDirty === true,
            tagDraftCount: Number(state.tagDraftCount),
            tagOriginalCount: Number(state.tagOriginalCount),
            tagColorPreviewCount: Number(state.tagColorPreviewCount),
            tagFooterActionCount: Number(state.tagFooterActionCount),
            tagSelectorStyle: state.tagSelectorStyle,
            tagOptionCount: Number(state.tagOptionCount),
''', 'editor export tag state')

text = replace_once(text,
'''            updateCount: 0, cancelCount: 0, tagCreateCount: 0,
            tagToggleCount: 0, tagDeleteCount: 0, tagRenameCount: 0,
            tagOptionCount: 0, attachedTagCount: 0, lastSavedId: null,
''',
'''            updateCount: 0, cancelCount: 0, tagCreateCount: 0,
            tagToggleCount: 0, tagDeleteCount: 0, tagRenameCount: 0,
            tagSelectionOpenCount: 0, tagSelectionSaveCount: 0,
            tagSelectionCancelCount: 0, tagSelectionDirty: false,
            tagDraftCount: 0, tagOriginalCount: 0,
            tagColorPreviewCount: 0, tagFooterActionCount: 0,
            tagSelectorStyle: "reference_tag_selector_v1",
            tagOptionCount: 0, attachedTagCount: 0, lastSavedId: null,
''', 'editor reset tag state')

text = replace_once(text,
'''        MODULE_VERSION: 9,
''',
'''        MODULE_VERSION: 10,
''', 'editor version')

text = replace_once(text,
'''        openTags: function (id, options) {
            return openPanel("tags", Number(id), options || {});
        },
        close: function () { return closePanel("close"); },
''',
'''        openTags: function (id, options) {
            var opened = openPanel("edit", Number(id), options || {
                requestKeyboard: false
            });
            requireMain(runOnMainSync(function () {
                return openTagSelectorOnMain();
            }, 2500));
            return opened;
        },
        close: function () { return closePanel("close"); },
''', 'editor openTags compatibility')

text = replace_once(text,
'''        performTagDeleteClick: function (tagId) {
            tagId = String(Number(tagId));
            return requireMain(runOnMainSync(function () {
                return tagDeleteViews[tagId] ?
                    tagDeleteViews[tagId].performClick() : false;
            }, 2500));
        },
        renameTag: function (tagId, name) {
''',
'''        performTagDeleteClick: function (tagId) {
            tagId = String(Number(tagId));
            return requireMain(runOnMainSync(function () {
                return tagDeleteViews[tagId] ?
                    tagDeleteViews[tagId].performClick() : false;
            }, 2500));
        },
        performOpenTagSelectorClick: function () {
            return requireMain(runOnMainSync(function () {
                return metadataTypeView !== null ?
                    metadataTypeView.performClick() : false;
            }, 2500));
        },
        performTagSelectionSaveClick: function () {
            return requireMain(runOnMainSync(function () {
                return tagSelectionSaveView !== null ?
                    tagSelectionSaveView.performClick() : false;
            }, 2500));
        },
        performTagSelectionCancelClick: function () {
            return requireMain(runOnMainSync(function () {
                return tagSelectionCancelView !== null ?
                    tagSelectionCancelView.performClick() : false;
            }, 2500));
        },
        getDraftTagIds: function () { return copyTagIds(editorDraftTagIds); },
        renameTag: function (tagId, name) {
''', 'editor probe tag methods')

path.write_text(text, encoding='utf-8')

# ---------------------------------------------------------------------------
# Settings v6: compact visual tag manager, color previews, drag reorder and
# two-step delete confirmation.
# ---------------------------------------------------------------------------
path = Path('src/ch_13_settings.js')
text = path.read_text(encoding='utf-8')
text = replace_once(text,
'''    var View = Packages.android.view.View;
    var Gravity = Packages.android.view.Gravity;
''',
'''    var View = Packages.android.view.View;
    var MotionEvent = Packages.android.view.MotionEvent;
    var Gravity = Packages.android.view.Gravity;
''', 'settings MotionEvent import')
text = replace_once(text,
'''    var InputType = Packages.android.text.InputType;
    var TextUtils = Packages.android.text.TextUtils;
''',
'''    var InputType = Packages.android.text.InputType;
    var TextWatcher = Packages.android.text.TextWatcher;
    var TextUtils = Packages.android.text.TextUtils;
''', 'settings TextWatcher import')
text = replace_once(text,
'''    var dataSectionView = null;
    var uiState = {
''',
'''    var dataSectionView = null;
    var pendingDeleteTagId = null;
    var uiState = {
''', 'settings pending delete')
text = replace_once(text,
'''        tagReorderCount: 0,
        clearHistoryCount: 0,
        settingsStyle: "reference_settings_v1",
''',
'''        tagReorderCount: 0,
        tagDragStartCount: 0,
        tagDragCommitCount: 0,
        tagColorPreviewCount: 0,
        tagDeleteConfirmCount: 0,
        lastDraggedTagId: null,
        pendingDeleteTagId: null,
        clearHistoryCount: 0,
        settingsStyle: "reference_settings_v2",
''', 'settings visual state')

settings_helpers = '''    function colorValueText(value, fallback) {
        var number;
        var hex;
        if (value === null || value === undefined) {
            return String(fallback || "#7C5CFC");
        }
        number = Number(value) >>> 0;
        hex = number.toString(16).toUpperCase();
        while (hex.length < 8) { hex = "0" + hex; }
        return "#" + hex;
    }

    function makeColorSwatch(value, colors) {
        var swatch = new View(appContext);
        swatch.setBackground(roundedBackground(
            colorValueText(value, colors.accentStrong), colors.stroke, 99));
        uiState.tagColorPreviewCount += 1;
        return swatch;
    }

    function bindColorPreview(input, swatch, fallback, colors) {
        input.addTextChangedListener(new JavaAdapter(TextWatcher, {
            beforeTextChanged: function () {},
            onTextChanged: function () {
                var value = parseColorValue(String(input.getText()), fallback);
                swatch.setBackground(roundedBackground(
                    colorValueText(value, colors.accentStrong),
                    colors.stroke, 99));
            },
            afterTextChanged: function () {}
        }));
    }

    function rebuildTagPage() {
        buildPage();
        if (mainHandler !== null) {
            mainHandler.post(new Packages.java.lang.Runnable({
                run: function () { scrollToSection("tags"); }
            }));
        }
        return true;
    }

    function requestDeleteTag(tagId, itemCount, deleteView) {
        tagId = Number(tagId);
        if (pendingDeleteTagId !== tagId) {
            pendingDeleteTagId = tagId;
            uiState.pendingDeleteTagId = tagId;
            uiState.tagDeleteConfirmCount += 1;
            deleteView.setText("确认删除");
            deleteView.setContentDescription("再次点击删除标签，当前关联 " +
                String(Number(itemCount || 0)) + " 条记录");
            return false;
        }
        pendingDeleteTagId = null;
        uiState.pendingDeleteTagId = null;
        return deleteTagRow(tagId);
    }

    function bindTagDrag(handle, rowRoot, tagId) {
        var startY = 0;
        var dragging = false;
        handle.setOnTouchListener(new JavaAdapter(View.OnTouchListener, {
            onTouch: function (view, event) {
                var action = Number(event.getActionMasked());
                var delta;
                if (action === MotionEvent.ACTION_DOWN) {
                    startY = Number(event.getRawY());
                    dragging = true;
                    uiState.tagDragStartCount += 1;
                    uiState.lastDraggedTagId = Number(tagId);
                    rowRoot.setAlpha(0.92);
                    return true;
                }
                if (action === MotionEvent.ACTION_MOVE && dragging) {
                    delta = Math.max(-dp(64), Math.min(dp(64),
                        Number(event.getRawY()) - startY));
                    rowRoot.setTranslationY(delta);
                    return true;
                }
                if ((action === MotionEvent.ACTION_UP ||
                        action === MotionEvent.ACTION_CANCEL) && dragging) {
                    delta = Number(event.getRawY()) - startY;
                    dragging = false;
                    rowRoot.setTranslationY(0);
                    rowRoot.setAlpha(1);
                    if (Math.abs(delta) >= dp(28)) {
                        if (moveTag(Number(tagId), delta > 0 ? 1 : -1)) {
                            uiState.tagDragCommitCount += 1;
                        }
                    }
                    return true;
                }
                return false;
            }
        }));
    }

'''
text = replace_once(text,
'    function emitTagsChanged(action, tagId) {\n',
settings_helpers + '    function emitTagsChanged(action, tagId) {\n',
'settings visual tag helpers')

text = text.replace('            buildPage();\n            return true;\n',
                    '            rebuildTagPage();\n            return true;\n', 3)
# The first three occurrences after helper insertion are create, save and delete.

text = replace_once(text,
'''            ClipHub.Repository.reorderTags(ids);
            uiState.tagReorderCount += 1;
            emitTagsChanged("tag_reordered", tagId);
            buildPage();
            return true;
''',
'''            ClipHub.Repository.reorderTags(ids);
            uiState.tagReorderCount += 1;
            emitTagsChanged("tag_reordered", tagId);
            rebuildTagPage();
            return true;
''', 'settings reorder rebuild')

new_tag_row = '''    function makeTagRow(tag, index, total, colors) {
        var root = new LinearLayout(appContext);
        var first = new LinearLayout(appContext);
        var actions = new LinearLayout(appContext);
        var handle = makeText("≡", 18, colors.textTertiary, true);
        var swatch = makeColorSwatch(tag.color_value, colors);
        var nameInput = makeInput("标签名称", String(tag.name), colors, false);
        var colorInput = makeInput("#RRGGBB", colorText(tag.color_value),
            colors, false);
        var count = makeText(String(Number(tag.item_count || 0)) + " 条记录",
            9, colors.textSecondary, false);
        var save = makeButton("保存", colors, false, false);
        var del = makeButton("删除", colors, false, true);
        var params;
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(8), dp(8), dp(8), dp(8));
        root.setBackground(roundedBackground(colors.surfaceMuted,
            colors.stroke, 12));
        first.setOrientation(LinearLayout.HORIZONTAL);
        first.setGravity(Gravity.CENTER_VERTICAL);
        handle.setGravity(Gravity.CENTER);
        handle.setContentDescription("拖动排序标签 " + String(tag.name));
        params = new LinearLayout.LayoutParams(dp(32), dp(40));
        params.rightMargin = dp(5);
        first.addView(handle, params);
        params = new LinearLayout.LayoutParams(dp(22), dp(22));
        params.rightMargin = dp(7);
        first.addView(swatch, params);
        params = new LinearLayout.LayoutParams(0, dp(40), 1);
        params.rightMargin = dp(5);
        first.addView(nameInput, params);
        first.addView(colorInput,
            new LinearLayout.LayoutParams(dp(88), dp(40)));
        root.addView(first, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(40)));
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setGravity(Gravity.CENTER_VERTICAL);
        actions.addView(count, new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        (function (tagId, itemCount) {
            save.setOnClickListener(new JavaAdapter(View.OnClickListener, {
                onClick: function () {
                    pendingDeleteTagId = null;
                    uiState.pendingDeleteTagId = null;
                    saveTagRow(tagId, nameInput, colorInput);
                }
            }));
            del.setOnClickListener(new JavaAdapter(View.OnClickListener, {
                onClick: function () {
                    requestDeleteTag(tagId, itemCount, del);
                }
            }));
            bindTagDrag(handle, root, tagId);
        }(Number(tag.id), Number(tag.item_count || 0)));
        actions.addView(save, new LinearLayout.LayoutParams(dp(58), dp(34)));
        params = new LinearLayout.LayoutParams(dp(68), dp(34));
        params.leftMargin = dp(5);
        actions.addView(del, params);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(34));
        params.topMargin = dp(6);
        root.addView(actions, params);
        bindColorPreview(colorInput, swatch,
            Number(tag.color_value || Color.parseColor("#7C5CFC")), colors);
        tagRowViews[String(tag.id)] = {
            root: root, name: nameInput, color: colorInput,
            handle: handle, swatch: swatch, save: save, deleteView: del
        };
        return root;
    }

'''
text = replace_between(text,
'    function makeTagRow(tag, index, total, colors) {\n',
'    function makeTagsSection(colors) {\n',
new_tag_row, 'settings tag row visual')

new_tags_section = '''    function makeTagsSection(colors) {
        var section = makeSection(colors);
        var createRow = new LinearLayout(appContext);
        var createButton;
        var preview;
        var tags = ClipHub.Repository.listTags();
        var index;
        var params;
        var empty;
        makeSectionTitle(section, "标签管理",
            "拖动排序 · 颜色预览 · 删除只解除关联", colors);
        createRow.setOrientation(LinearLayout.HORIZONTAL);
        createRow.setGravity(Gravity.CENTER_VERTICAL);
        preview = makeColorSwatch(Number(Color.parseColor("#7C5CFC")), colors);
        params = new LinearLayout.LayoutParams(dp(24), dp(24));
        params.rightMargin = dp(6);
        createRow.addView(preview, params);
        newTagNameInput = makeInput("新标签名称", "", colors, false);
        newTagColorInput = makeInput("#7C5CFC", "#7C5CFC", colors, false);
        createButton = makeButton("新增", colors, true, false);
        createButton.setOnClickListener(new JavaAdapter(
            View.OnClickListener, { onClick: createTagFromSettings }));
        params = new LinearLayout.LayoutParams(0, dp(40), 1);
        params.rightMargin = dp(5);
        createRow.addView(newTagNameInput, params);
        params = new LinearLayout.LayoutParams(dp(88), dp(40));
        params.rightMargin = dp(5);
        createRow.addView(newTagColorInput, params);
        createRow.addView(createButton,
            new LinearLayout.LayoutParams(dp(54), dp(40)));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(40));
        params.bottomMargin = dp(8);
        section.addView(createRow, params);
        bindColorPreview(newTagColorInput, preview,
            Number(Color.parseColor("#7C5CFC")), colors);
        tagRowViews = {};
        for (index = 0; index < tags.length; index += 1) {
            params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
            params.bottomMargin = dp(6);
            section.addView(makeTagRow(tags[index], index, tags.length, colors),
                params);
        }
        uiState.tagRowCount = tags.length;
        if (tags.length === 0) {
            empty = makeText("暂无标签", 11, colors.textSecondary, false);
            empty.setGravity(Gravity.CENTER);
            empty.setPadding(dp(8), dp(18), dp(8), dp(18));
            section.addView(empty, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));
        }
        return section;
    }

'''
text = replace_between(text,
'    function makeTagsSection(colors) {\n',
'    function makeDataSection(colors) {\n',
new_tags_section, 'settings tags section visual')

text = replace_once(text,
'''        content.setPadding(dp(12), dp(9), dp(12), dp(12));
''',
'''        content.setPadding(dp(12), dp(9), dp(12), dp(28));
''', 'settings bottom safe padding')

text = replace_once(text,
'''                dataSectionView = null;
            }
''',
'''                dataSectionView = null;
                pendingDeleteTagId = null;
                uiState.pendingDeleteTagId = null;
            }
''', 'settings close pending delete')

text = replace_once(text,
'''            tagReorderCount: Number(uiState.tagReorderCount),
            clearHistoryCount: Number(uiState.clearHistoryCount),
''',
'''            tagReorderCount: Number(uiState.tagReorderCount),
            tagDragStartCount: Number(uiState.tagDragStartCount),
            tagDragCommitCount: Number(uiState.tagDragCommitCount),
            tagColorPreviewCount: Number(uiState.tagColorPreviewCount),
            tagDeleteConfirmCount: Number(uiState.tagDeleteConfirmCount),
            lastDraggedTagId: uiState.lastDraggedTagId,
            pendingDeleteTagId: uiState.pendingDeleteTagId,
            dragReorderEnabled: true,
            deleteRequiresConfirmation: true,
            clearHistoryCount: Number(uiState.clearHistoryCount),
''', 'settings export visual state')

text = replace_once(text,
'''        MODULE_VERSION: 5,
''',
'''        MODULE_VERSION: 6,
''', 'settings version')

text = replace_once(text,
'''        performCreateTag: function (name, colorTextValue) {
            return runOnMainSync(function () {
                if (newTagNameInput === null || newTagColorInput === null) {
                    return false;
                }
                newTagNameInput.setText(String(name || ""));
                newTagColorInput.setText(String(colorTextValue || "#7C5CFC"));
                return createTagFromSettings();
            }, 3000);
        },
        reset: function (options) {
''',
'''        performCreateTag: function (name, colorTextValue) {
            return runOnMainSync(function () {
                if (newTagNameInput === null || newTagColorInput === null) {
                    return false;
                }
                newTagNameInput.setText(String(name || ""));
                newTagColorInput.setText(String(colorTextValue || "#7C5CFC"));
                return createTagFromSettings();
            }, 3000);
        },
        performUpdateTag: function (tagId, name, colorTextValue) {
            tagId = String(Number(tagId));
            return runOnMainSync(function () {
                var row = tagRowViews[tagId];
                if (!row) { return false; }
                row.name.setText(String(name || ""));
                row.color.setText(String(colorTextValue || "#7C5CFC"));
                return row.save.performClick();
            }, 3000);
        },
        performMoveTag: function (tagId, delta) {
            return runOnMainSync(function () {
                return moveTag(Number(tagId), Number(delta));
            }, 3000);
        },
        performDeleteTagConfirm: function (tagId) {
            tagId = String(Number(tagId));
            return runOnMainSync(function () {
                var row = tagRowViews[tagId];
                if (!row) { return false; }
                row.deleteView.performClick();
                return row.deleteView.performClick();
            }, 3000);
        },
        getTagOrder: function () {
            var tags = ClipHub.Repository.listTags();
            var ids = [];
            var index;
            for (index = 0; index < tags.length; index += 1) {
                ids.push(Number(tags[index].id));
            }
            return ids;
        },
        reset: function (options) {
''', 'settings probe tag methods')

path.write_text(text, encoding='utf-8')

# ---------------------------------------------------------------------------
# Filter v14: expose tag colors on cards and keep card/tag visual state.
# ---------------------------------------------------------------------------
path = Path('src/ch_11_filter.js')
text = path.read_text(encoding='utf-8')
text = replace_once(text,
'''        renderedTagLabelCount: 0,
        loadedResultCount: 0,
''',
'''        renderedTagLabelCount: 0,
        tagColorPreviewCount: 0,
        loadedResultCount: 0,
''', 'filter tag color state')

text = replace_once(text,
'''    function selectedResultRow() {
''',
'''    function tagColorText(tag, fallback) {
        var value;
        var hex;
        if (!tag || tag.color_value === null || tag.color_value === undefined) {
            return String(fallback || "#7C5CFC");
        }
        value = Number(tag.color_value) >>> 0;
        hex = value.toString(16).toUpperCase();
        while (hex.length < 8) { hex = "0" + hex; }
        return "#" + hex;
    }

    function selectedResultRow() {
''', 'filter tag color helper')

text = replace_once(text,
'''        var tagBadge = makeText(tagSummary(tags),
            8, tags.length > 0 ? colors.accentStrong : colors.textTertiary,
            tags.length > 0);
''',
'''        var tagBadge = makeText((tags.length > 0 ? "●  " : "") +
            tagSummary(tags), 8,
            tags.length > 0 ? tagColorText(tags[0], colors.accentStrong) :
                colors.textTertiary, tags.length > 0);
''', 'filter colored tag summary')

text = replace_once(text,
'''        state.renderedTagLabelCount += Math.min(2, tags.length);
''',
'''        state.renderedTagLabelCount += Math.min(2, tags.length);
        if (tags.length > 0) { state.tagColorPreviewCount += 1; }
''', 'filter tag color count')

text = replace_once(text,
'''            renderedTagLabelCount: Number(state.renderedTagLabelCount),
            loadedResultCount: Number(state.loadedResultCount),
''',
'''            renderedTagLabelCount: Number(state.renderedTagLabelCount),
            tagColorPreviewCount: Number(state.tagColorPreviewCount),
            loadedResultCount: Number(state.loadedResultCount),
''', 'filter export tag color state')

text = replace_once(text,
'''        state.renderedTagLabelCount = 0;
        state.loadedResultCount = 0;
''',
'''        state.renderedTagLabelCount = 0;
        state.tagColorPreviewCount = 0;
        state.loadedResultCount = 0;
''', 'filter reset tag color state')

text = replace_once(text,
'''        state.searchPageStyle = "reference_search_v6";
''',
'''        state.searchPageStyle = "reference_search_v7";
''', 'filter style version')
text = replace_once(text,
'''        MODULE_VERSION: 13,
''',
'''        MODULE_VERSION: 14,
''', 'filter version')
path.write_text(text, encoding='utf-8')

# Update manifest after module modifications.
manifest_path = Path('module-manifest.json')
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
if manifest.get('schemaVersion') != 1 or manifest.get('entryMinVersion') != 4:
    raise SystemExit('Manifest compatibility changed')
if len(manifest.get('modules', [])) != 15:
    raise SystemExit('Manifest module count changed')
manifest['moduleSetVersion'] = '20260723.03'
for module in manifest['modules']:
    if module['name'] in ('ch_10_editor.js', 'ch_11_filter.js',
                          'ch_13_settings.js'):
        module['sha'] = git_hash(module['path'])
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n',
                         encoding='utf-8')

Path('docs/阶段3D2-5标签管理与选择器实施说明.md').write_text('''# 阶段 3D2-5：标签管理、标签选择与设置页视觉收口

模块集：`20260723.03`。

## Editor v10

- 新增和编辑页面均可进入标签选择器；
- 进入选择器前保留尚未保存的正文；
- 标签勾选只修改内存草稿，不立即写入 `clipboard_item_tags`；
- 点击“取消”恢复进入前的标签草稿；
- 点击“完成”只确认编辑器草稿；
- 最终点击正文页面“保存”时，正文与标签关联一起提交；
- 新记录保存后立即写入选中的多标签关联；
- 系统返回在标签选择器层只返回正文编辑页，不关闭整个 Editor；
- 标签选择器不提供全局删除，删除统一由设置页处理。

## Settings v6

- 标签行增加实时颜色预览；
- 拖动手柄根据纵向手势提交上移或下移；
- 标签名称、颜色、关联数量、保存和删除采用紧凑卡片布局；
- 删除使用两次点击确认，并显示当前关联数量；
- 删除标签仍只删除标签与关联，不删除剪贴板记录；
- 新建标签颜色输入同样具有实时预览；
- 标签修改后保持滚动定位在“标签管理”分组。

## Filter v14

- 首页卡片标签摘要使用首个标签的自定义颜色；
- 继续最多显示两个标签，更多显示 `+N`；
- 标签排序仍由 `manual_order` 决定；
- `tags_changed` 事件继续刷新唯一 Filter Root。

## 保持不变

- 数据库 schema v2；
- `tags` 与 `clipboard_item_tags` 结构；
- Navigation v3；
- 唯一 Filter Root；
- ClipboardManager 后台监听、SQLite、运行锁和控制广播生命周期；
- `ClipHub.js` 唯一入口和 15 模块结构。
''', encoding='utf-8')
