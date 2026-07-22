from pathlib import Path
import re


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit('%s expected one match, got %d' % (label, count))
    return text.replace(old, new, 1)

# Repository v8: compatibility-only content_type and tag ordering.
p = Path('src/ch_06_repository.js')
s = p.read_text(encoding='utf-8')
s = replace_once(s, '                item.contentType || "text",',
                 '                "text",', 'repository insert type')
s = replace_once(s,
'''        types = stringList(options.contentTypes);
        if (types.length < 1 && options.contentType) {
            types = [String(options.contentType)];
        }
        appendIn(where, args, "clipboard_items.content_type", types);
''', '', 'repository type query')
s = re.sub(r'''    function listContentTypeOptions\(\) \{.*?^    \}\n\n''',
'''    function listContentTypeOptions() {
        requireReady();
        return [];
    }

''', s, count=1, flags=re.S | re.M)
s = replace_once(s, '            content_type: true,\n', '',
                 'repository update type')
marker = '''    function setItemTags(itemId, tagIds) {
'''
idx = s.index(marker)
insert_at = s.index('\n    ClipHub.Repository = {', idx)
reorder = '''
    function reorderTags(tagIds) {
        var ids = intList(tagIds);
        var index;
        var changed = 0;
        requireReady();
        ClipHub.Database.transaction(function () {
            for (index = 0; index < ids.length; index += 1) {
                changed += updateTag(ids[index], {
                    manualOrder: (index + 1) * 1000
                });
            }
        });
        return {
            ok: true,
            updatedCount: changed,
            tagIds: ids
        };
    }
'''
s = s[:insert_at] + reorder + s[insert_at:]
s = replace_once(s, '        setItemTags: setItemTags,\n',
                 '        setItemTags: setItemTags,\n        reorderTags: reorderTags,\n',
                 'repository export reorder')
s = replace_once(s, '        MODULE_VERSION: 7,', '        MODULE_VERSION: 8,',
                 'repository version')
p.write_text(s, encoding='utf-8')

# Clipboard v3: always record text; no classifier-dependent content semantics.
p = Path('src/ch_04_clipboard.js')
s = p.read_text(encoding='utf-8')
s = replace_once(s,
'''            classified = ClipHub.Classifier &&
                typeof ClipHub.Classifier.classify === "function"
                ? ClipHub.Classifier.classify(read.text)
                : { type: "text" };
            result = recordText(
                read.text,
                hash,
                classified && classified.type
                    ? String(classified.type) : "text",
                eventAt, metadata);
''',
'''            classified = { type: "text", confidence: 100 };
            result = recordText(
                read.text,
                hash,
                "text",
                eventAt, metadata);
''', 'clipboard classify block')
s = replace_once(s, '        MODULE_VERSION: 2,', '        MODULE_VERSION: 3,',
                 'clipboard version')
p.write_text(s, encoding='utf-8')

# Editor v9: source and tags only, no type UI.
p = Path('src/ch_10_editor.js')
s = p.read_text(encoding='utf-8')
s = replace_once(s,
'''        var typeText = isNew ? "文本" :
            contentTypeLabel(row && row.content_type);
''', '', 'editor type variable')
s = replace_once(s, '        state.editorStyle = "reference_editor_v4";',
                 '        state.editorStyle = "reference_editor_v5";',
                 'editor style')
s = replace_once(s, '        state.typeMetaText = typeText;',
                 '        state.typeMetaText = "";', 'editor state type')
s = replace_once(s,
'''            "仅修改正文，来源和类型保持不变",
''',
'''            "修改正文并管理当前记录的自定义标签",
''', 'editor subtitle')
s = replace_once(s,
'''        metadataTypeView = makeEditorPill("类型  " + typeText,
            colors, true);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, dp(32));
        params.rightMargin = dp(7);
        metaRow.addView(metadataTypeView, params);
        metadataSourceView = makeEditorPill("来源  " + sourceText,
            colors, false);
        metaRow.addView(metadataSourceView,
            new LinearLayout.LayoutParams(0, dp(32), 1));
''',
'''        metadataSourceView = makeEditorPill("来源  " + sourceText,
            colors, false);
        params = new LinearLayout.LayoutParams(0, dp(32), 1);
        params.rightMargin = dp(7);
        metaRow.addView(metadataSourceView, params);
        metadataTypeView = makeEditorPill(isNew ?
            "标签  保存后设置" : "标签  管理", colors, !isNew);
        metadataTypeView.setEnabled(!isNew);
        metadataTypeView.setAlpha(isNew ? 0.55 : 1);
        if (!isNew) {
            metadataTypeView.setClickable(true);
            metadataTypeView.setFocusable(true);
            metadataTypeView.setContentDescription("管理当前记录标签");
            metadataTypeView.setOnClickListener(new JavaAdapter(
                View.OnClickListener, {
                    onClick: function () {
                        openPanel("tags", state.itemId, {
                            requestKeyboard: false
                        });
                    }
                }));
        }
        metaRow.addView(metadataTypeView,
            new LinearLayout.LayoutParams(dp(116), dp(32)));
''', 'editor metadata row')
s = replace_once(s, '        MODULE_VERSION: 8,', '        MODULE_VERSION: 9,',
                 'editor version')
p.write_text(s, encoding='utf-8')

# Filter v12: no types, card tags, settings and translation entry.
p = Path('src/ch_11_filter.js')
s = p.read_text(encoding='utf-8')
s = replace_once(s, '    var closeView = null;\n',
                 '    var closeView = null;\n    var settingsButton = null;\n',
                 'filter settings var')
s = replace_once(s, '    var toolbarActionViews = {};\n',
                 '    var toolbarActionViews = {};\n    var resultTagMap = {};\n',
                 'filter tag map var')
s = replace_once(s, '        detailActionCount: 0,\n',
                 '        detailActionCount: 0,\n        settingsOpenCount: 0,\n        settingsButtonPresent: false,\n        renderedTagLabelCount: 0,\n',
                 'filter state additions')
s = replace_once(s, '            contentTypes: copyList(input.contentTypes),',
                 '            contentTypes: [],', 'filter copy types')
s = replace_once(s, '            input.contentTypes.length > 0 ||\n', '',
                 'filter active types')
s = replace_once(s,
                 '        options.contentTypes = copyList(value.contentTypes);\n',
                 '', 'filter query types')
s = replace_once(s,
'''    function optionCounts() {
        var sources = ClipHub.Repository.listSourceOptions();
        var types = ClipHub.Repository.listContentTypeOptions();
        var tags = ClipHub.Repository.listTags();
        return { sources: sources, types: types, tags: tags };
    }
''',
'''    function optionCounts() {
        var sources = ClipHub.Repository.listSourceOptions();
        var tags = ClipHub.Repository.listTags();
        return { sources: sources, types: [], tags: tags };
    }
''', 'filter option counts')
s = replace_once(s,
'''        if (counts.types.length > 0) {
            addSection(content, "内容类型（多选）",
                counts.types, "type", colors);
        }
''', '', 'filter advanced type section')
s = replace_once(s,
'''            fallback = makeText(typeLabel(row.content_type).substring(0, 1),
                14, colors.accentStrong, true);
''',
'''            fallback = makeText("剪", 14, colors.accentStrong, true);
''', 'filter fallback icon')

helper_marker = '    function selectedResultRow() {\n'
helper = '''    function tagsForResult(row) {
        var key = row && row.id !== undefined ? String(row.id) : "";
        return resultTagMap[key] || [];
    }

    function tagSummary(tags) {
        var labels = [];
        var index;
        tags = tags || [];
        for (index = 0; index < tags.length && index < 2; index += 1) {
            labels.push(String(tags[index].name || ""));
        }
        if (tags.length > 2) { labels.push("+" + String(tags.length - 2)); }
        return labels.length > 0 ? labels.join("  ") : "无标签";
    }

'''
if s.count(helper_marker) != 1:
    raise SystemExit('filter helper marker mismatch')
s = s.replace(helper_marker, helper + helper_marker, 1)
s = replace_once(s,
'''        var metaRow = new LinearLayout(appContext);
        var type = makeText(typeLabel(row.content_type),
            8, colors.accentStrong, true);
        var source = makeText(sourceLabel(row),
''',
'''        var metaRow = new LinearLayout(appContext);
        var tags = tagsForResult(row);
        var tagBadge = makeText(tagSummary(tags),
            8, tags.length > 0 ? colors.accentStrong : colors.textTertiary,
            tags.length > 0);
        var source = makeText(sourceLabel(row),
''', 'filter card type declaration')
s = replace_once(s,
'''        type.setPadding(dp(6), dp(2), dp(6), dp(2));
        type.setBackground(roundedBackground(colors.accentSoft,
            null, 7));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.rightMargin = dp(6);
        metaRow.addView(type, params);
''',
'''        tagBadge.setPadding(dp(6), dp(2), dp(6), dp(2));
        tagBadge.setSingleLine(true);
        tagBadge.setMaxLines(1);
        tagBadge.setEllipsize(TextUtils.TruncateAt.END);
        tagBadge.setBackground(roundedBackground(
            tags.length > 0 ? colors.accentSoft : colors.surfaceMuted,
            null, 7));
        params = new LinearLayout.LayoutParams(dp(112),
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.rightMargin = dp(6);
        metaRow.addView(tagBadge, params);
        state.renderedTagLabelCount += Math.min(2, tags.length);
''', 'filter card tag badge')
s = replace_once(s,
'''        var colors = palette();
        var index;
        var empty;
        var params;
''',
'''        var colors = palette();
        var index;
        var empty;
        var params;
        var ids = [];
''', 'filter refresh declarations')
s = replace_once(s,
'''        resultContainer.removeAllViews();
        state.resultCardCount = 0;
        state.resultSourceIconCount = 0;
        resultCardViews = [];
''',
'''        resultContainer.removeAllViews();
        state.resultCardCount = 0;
        state.resultSourceIconCount = 0;
        state.renderedTagLabelCount = 0;
        resultCardViews = [];
        for (index = 0; index < previewRows.length; index += 1) {
            ids.push(Number(previewRows[index].id));
        }
        resultTagMap = ClipHub.Repository.listItemTagMap(ids);
''', 'filter refresh tag map')
s = replace_once(s,
'''    function openSelectedDetail() {
        var row = selectedResultRow();
        if (row === null || !ClipHub.List ||
                typeof ClipHub.List.openDetail !== "function") {
            return false;
        }
        state.detailActionCount += 1;
        return ClipHub.List.openDetail(Number(row.id)) === true;
    }
''',
'''    function openSelectedDetail() {
        var row = selectedResultRow();
        if (row === null || !ClipHub.Translation ||
                typeof ClipHub.Translation.openForItem !== "function") {
            return false;
        }
        state.detailActionCount += 1;
        ClipHub.Translation.openForItem(Number(row.id));
        return true;
    }
''', 'filter translation action')
settings_marker = '''        closeView = makeIcon("×", 22, colors.icon,
            "关闭搜索与筛选");
'''
settings_code = '''        settingsButton = makeIcon("⚙", 18, colors.icon,
            "打开 ClipHub 设置");
        settingsButton.setBackground(circleBackground(
            colors.surfaceMuted, null));
        settingsButton.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () {
                    try {
                        if (ClipHub.Settings && ClipHub.Settings.open) {
                            state.settingsOpenCount += 1;
                            ClipHub.Settings.open();
                        }
                    } catch (error) {
                        state.lastError = String(error);
                    }
                }
            }));
        titleRow.addView(settingsButton,
            new LinearLayout.LayoutParams(dp(36), dp(36)));
        state.settingsButtonPresent = true;

'''
if s.count(settings_marker) != 1:
    raise SystemExit('filter settings header marker mismatch')
s = s.replace(settings_marker, settings_code + settings_marker, 1)
s = replace_once(s, '                closeView = null;\n',
                 '                closeView = null;\n                settingsButton = null;\n',
                 'filter close settings clear')
s = replace_once(s, '            resultCardCount: Number(state.resultCardCount),\n',
                 '            resultCardCount: Number(state.resultCardCount),\n            settingsButtonPresent: settingsButton !== null,\n            settingsOpenCount: Number(state.settingsOpenCount),\n            renderedTagLabelCount: Number(state.renderedTagLabelCount),\n',
                 'filter panel state additions')
s = replace_once(s, '        state.detailActionCount = 0;\n',
                 '        state.detailActionCount = 0;\n        state.settingsOpenCount = 0;\n        state.settingsButtonPresent = false;\n        state.renderedTagLabelCount = 0;\n',
                 'filter reset additions')
s = replace_once(s, '        state.searchPageStyle = "reference_search_v4";',
                 '        state.searchPageStyle = "reference_search_v5";',
                 'filter reset style')
s = replace_once(s, '            resultCardViews = [];\n            toolbarActionViews = {};\n',
                 '            resultCardViews = [];\n            toolbarActionViews = {};\n            resultTagMap = {};\n',
                 'filter init tag map')
s = replace_once(s,
'''        performAdvancedClick: function () {
''',
'''        performSettingsClick: function () {
            return requireMain(runOnMainSync(function () {
                return settingsButton !== null ?
                    settingsButton.performClick() : false;
            }, 2500));
        },

        performAdvancedClick: function () {
''', 'filter export settings click')
s = replace_once(s, '        MODULE_VERSION: 11,', '        MODULE_VERSION: 12,',
                 'filter version')
p.write_text(s, encoding='utf-8')

# Translation v5: preserve Navigation v3 implementation and replace stub runtime.
p = Path('src/ch_12_translation.js')
s = p.read_text(encoding='utf-8')
imports_marker = '    var AtomicReference = Packages.java.util.concurrent.atomic.AtomicReference;\n'
imports = '''    var AtomicReference = Packages.java.util.concurrent.atomic.AtomicReference;
    var URL = Packages.java.net.URL;
    var URLEncoder = Packages.java.net.URLEncoder;
    var MessageDigest = Packages.java.security.MessageDigest;
    var JavaString = Packages.java.lang.String;
    var UUID = Packages.java.util.UUID;
    var JavaThread = Packages.java.lang.Thread;
    var OSW = Packages.java.io.OutputStreamWriter;
    var BR = Packages.java.io.BufferedReader;
    var ISR = Packages.java.io.InputStreamReader;
    var SB = Packages.java.lang.StringBuilder;
    var Color = Packages.android.graphics.Color;
    var GradientDrawable = Packages.android.graphics.drawable.GradientDrawable;
    var PixelFormat = Packages.android.graphics.PixelFormat;
    var LinearLayout = Packages.android.widget.LinearLayout;
    var FrameLayout = Packages.android.widget.FrameLayout;
    var ScrollView = Packages.android.widget.ScrollView;
    var TextView = Packages.android.widget.TextView;
    var TypedValue = Packages.android.util.TypedValue;
'''
if s.count(imports_marker) != 1:
    raise SystemExit('translation imports marker mismatch')
s = s.replace(imports_marker, imports, 1)
start = s.index('    ClipHub.Translation = {')
end = s.index('\n}((function () { return this; }())));', start)
runtime = Path('.github/cliphub-stage3d2-4/translation_runtime.jsfrag')\
    .read_text(encoding='utf-8').rstrip() + '\n'
obj = Path('.github/cliphub-stage3d2-4/translation_object.jsfrag')\
    .read_text(encoding='utf-8').rstrip() + '\n'
s = s[:start] + runtime + obj + s[end:]
p.write_text(s, encoding='utf-8')

# List v13: expose Settings and Translation as detail-layer surfaces.
p = Path('src/ch_09_list.js')
s = p.read_text(encoding='utf-8')
s = replace_once(s,
'''        hide: function (closeWindow) {
            visible = false;
''',
'''        hide: function (closeWindow) {
            try {
                if (ClipHub.Translation && ClipHub.Translation.isAttached &&
                        ClipHub.Translation.isAttached()) {
                    ClipHub.Translation.close("list_hide");
                }
            } catch (ignoredTranslation) {}
            try {
                if (ClipHub.Settings && ClipHub.Settings.isAttached &&
                        ClipHub.Settings.isAttached()) {
                    ClipHub.Settings.close("list_hide");
                }
            } catch (ignoredSettings) {}
            visible = false;
''', 'list hide external detail')
s = replace_once(s,
'''        closeDetail: function () {
            return closeDetail("api");
        },

        getDetailState: getDetailState,
''',
'''        closeDetail: function () {
            try {
                if (ClipHub.Translation && ClipHub.Translation.isAttached &&
                        ClipHub.Translation.isAttached()) {
                    return ClipHub.Translation.close("navigation");
                }
            } catch (ignoredTranslation) {}
            try {
                if (ClipHub.Settings && ClipHub.Settings.isAttached &&
                        ClipHub.Settings.isAttached()) {
                    return ClipHub.Settings.close("navigation");
                }
            } catch (ignoredSettings) {}
            return closeDetail("api");
        },

        getDetailState: function () {
            var external;
            try {
                external = ClipHub.Translation && ClipHub.Translation.getState ?
                    ClipHub.Translation.getState() : null;
                if (external && (external.attached === true ||
                        external.open === true)) { return external; }
            } catch (ignoredTranslation) {}
            try {
                external = ClipHub.Settings && ClipHub.Settings.getState ?
                    ClipHub.Settings.getState() : null;
                if (external && (external.attached === true ||
                        external.open === true)) { return external; }
            } catch (ignoredSettings) {}
            return getDetailState();
        },
''', 'list external detail bridge')
s = replace_once(s, '        MODULE_VERSION: 12,', '        MODULE_VERSION: 13,',
                 'list version')
p.write_text(s, encoding='utf-8')

# App v8: Settings before Translation; close all modal surfaces.
p = Path('src/ch_15_app.js')
s = p.read_text(encoding='utf-8')
s = replace_once(s,
'''        "Editor", "Filter", "Translation", "Settings"
''',
'''        "Editor", "Filter", "Settings", "Translation"
''', 'app init order')
s = replace_once(s,
'''        var filter = safeState(ClipHub.Filter, "getPanelState", {});
''',
'''        var filter = safeState(ClipHub.Filter, "getPanelState", {});
        var settings = safeState(ClipHub.Settings, "getState", {});
        var translation = safeState(ClipHub.Translation, "getState", {});
''', 'app ui state modules')
s = replace_once(s,
'''        var filterAttached = filter.attachedToWindow === true ||
            filter.attached === true;
''',
'''        var filterAttached = filter.attachedToWindow === true ||
            filter.attached === true;
        var settingsAttached = settings.attachedToWindow === true ||
            settings.attached === true;
        var translationAttached = translation.attachedToWindow === true ||
            translation.attached === true;
''', 'app attached flags')
s = replace_once(s,
'''            uiVisible: windowAttached || detailAttached || editorAttached ||
                filterAttached,
''',
'''            uiVisible: windowAttached || detailAttached || editorAttached ||
                filterAttached || settingsAttached || translationAttached,
''', 'app ui visible')
s = replace_once(s,
'''            filterAttached: filterAttached,
''',
'''            filterAttached: filterAttached,
            settingsAttached: settingsAttached,
            translationAttached: translationAttached,
''', 'app status fields')
close_marker = '''    function closeUi() {
        try {
            if (ClipHub.Filter && typeof ClipHub.Filter.closePanel === "function") {
'''
close_prefix = '''    function closeUi() {
        try {
            if (ClipHub.Translation && typeof ClipHub.Translation.close === "function") {
                ClipHub.Translation.close("app_hide");
            }
        } catch (ignoredTranslation) {}
        try {
            if (ClipHub.Settings && typeof ClipHub.Settings.close === "function") {
                ClipHub.Settings.close("app_hide");
            }
        } catch (ignoredSettings) {}
        try {
            if (ClipHub.Filter && typeof ClipHub.Filter.closePanel === "function") {
'''
if s.count(close_marker) != 1:
    raise SystemExit('app close marker mismatch')
s = s.replace(close_marker, close_prefix, 1)
s = replace_once(s, '        MODULE_VERSION: 7,', '        MODULE_VERSION: 8,',
                 'app version')
p.write_text(s, encoding='utf-8')
