#!/usr/bin/env bash
set -euo pipefail

BRANCH="agent/initialize-project-skeleton"
HELPER_DIR=".github/cliphub-filter-root"
WORKFLOW_PATH=".github/workflows/cliphub-filter-root.yml"

if [ "$(git hash-object src/ch_11_filter.js)" != "82593e8c8cd106d1c86f1e656d156a7240c4c715" ]; then
  echo "Unexpected ch_11_filter.js base" >&2
  exit 1
fi
if [ "$(git hash-object src/ch_15_app.js)" != "04b4f8c3aacbfb0423c6f25b9e74f1a7802bc384" ]; then
  echo "Unexpected ch_15_app.js base" >&2
  exit 1
fi
if [ "$(git hash-object module-manifest.json)" != "c4b545f856fb024ef2d0f9caeb7127d9b9eb0077" ]; then
  echo "Unexpected module-manifest.json base" >&2
  exit 1
fi
if [ "$(git hash-object docs/开发计划.md)" != "a8ab99ee2a9bfcc7eb6a63e3a675fab2e3faeec9" ]; then
  echo "Unexpected development plan base" >&2
  exit 1
fi

python3 - <<'PYFILTER'
from pathlib import Path

path = Path('src/ch_11_filter.js')
text = path.read_text(encoding='utf-8')

replacements = [
    (
'''    var searchGeneration = 0;
    var restoreListOnClose = false;

    var state = {''',
'''    var searchGeneration = 0;
    var restoreListOnClose = false;
    var rootMode = false;
    var selectedItemId = null;
    var resultCardViews = [];
    var toolbarActionViews = {};

    var state = {'''
    ),
    (
'''        exclusiveHomeFilter: true,
        repositorySortUnchanged: true,''',
'''        exclusiveHomeFilter: true,
        rootMode: false,
        primarySurface: "filter_overlay",
        selectedItemId: null,
        selectionMode: false,
        resultCardClickCount: 0,
        resultCardLongPressCount: 0,
        copyActionCount: 0,
        pinActionCount: 0,
        editActionCount: 0,
        addActionCount: 0,
        deleteActionCount: 0,
        detailActionCount: 0,
        toolbarEnabledCount: 1,
        repositorySortUnchanged: true,'''
    ),
    (
'''                onClick: function () {
                    closePanel({ reason: "button" });
                }''',
'''                onClick: function () {
                    closePanel({
                        reason: "button",
                        restoreList: rootMode ? false : true
                    });
                }'''
    ),
    (
'''        state.lastBackLayer = "search_panel";
        closePanel({ reason: "back" });
        return true;''',
'''        state.lastBackLayer = "search_panel";
        closePanel({
            reason: "back",
            restoreList: rootMode ? false : true
        });
        return true;'''
    ),
    (
'''            exclusiveHomeFilter: state.exclusiveHomeFilter === true,
            panelWindowType: state.panelWindowType,''',
'''            exclusiveHomeFilter: state.exclusiveHomeFilter === true,
            rootMode: rootMode === true,
            primarySurface: state.primarySurface,
            selectedItemId: selectedItemId,
            selectionMode: selectedItemId !== null,
            resultCardClickCount:
                Number(state.resultCardClickCount),
            resultCardLongPressCount:
                Number(state.resultCardLongPressCount),
            copyActionCount: Number(state.copyActionCount),
            pinActionCount: Number(state.pinActionCount),
            editActionCount: Number(state.editActionCount),
            addActionCount: Number(state.addActionCount),
            deleteActionCount: Number(state.deleteActionCount),
            detailActionCount: Number(state.detailActionCount),
            toolbarEnabledCount:
                Number(state.toolbarEnabledCount),
            panelWindowType: state.panelWindowType,'''
    ),
    (
'''        state.exclusiveHomeFilter = true;
        state.repositorySortUnchanged = true;''',
'''        state.exclusiveHomeFilter = true;
        state.rootMode = false;
        state.primarySurface = "filter_overlay";
        state.selectedItemId = null;
        state.selectionMode = false;
        state.resultCardClickCount = 0;
        state.resultCardLongPressCount = 0;
        state.copyActionCount = 0;
        state.pinActionCount = 0;
        state.editActionCount = 0;
        state.addActionCount = 0;
        state.deleteActionCount = 0;
        state.detailActionCount = 0;
        state.toolbarEnabledCount = 1;
        state.repositorySortUnchanged = true;'''
    ),
    (
'''            searchGeneration = 0;
            restoreListOnClose = false;
            resetState();''',
'''            searchGeneration = 0;
            restoreListOnClose = false;
            rootMode = false;
            selectedItemId = null;
            resultCardViews = [];
            toolbarActionViews = {};
            resetState();'''
    ),
    (
'''        MODULE_VERSION: 10,''',
'''        MODULE_VERSION: 11,'''
    )
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit('Filter replacement expected one match, got %d:\n%s' %
                         (count, old))
    text = text.replace(old, new, 1)

start = text.index('    function makeResultCard(row, colors) {')
end = text.index('    function refreshResultsOnMain()', start)
new_cards = r'''    function selectedResultRow() {
        var index;
        if (selectedItemId === null) { return null; }
        for (index = 0; index < previewRows.length; index += 1) {
            if (Number(previewRows[index].id) === Number(selectedItemId)) {
                return previewRows[index];
            }
        }
        return null;
    }

    function setSelectedResult(row) {
        selectedItemId = row === null || row === undefined ?
            null : Number(row.id);
        state.selectedItemId = selectedItemId;
        state.selectionMode = selectedItemId !== null;
        return selectedItemId;
    }

    function clearSelectedResult() {
        setSelectedResult(null);
        return true;
    }

    function refreshPrimaryResults(origin) {
        apply({ origin: String(origin || "primary_action") });
        if (state.panelAttached) {
            buildPanelContent(false);
        }
        return true;
    }

    function copyResultRow(row) {
        var result;
        var closeAfter = false;
        if (row === null || row === undefined) { return false; }
        try {
            result = ClipHub.Clipboard.writeText(String(row.content || ""), {
                label: "ClipHub",
                sensitive: Number(row.is_sensitive || 0) === 1
            });
            state.resultCardClickCount += 1;
            state.copyActionCount += 1;
            try {
                closeAfter = ClipHub.Settings &&
                    ClipHub.Settings.get("closeAfterCopy", false) === true;
            } catch (ignoredSetting) {}
            if (closeAfter) {
                closePanel({
                    restoreList: false,
                    reason: "copy_close"
                });
            }
            return result && result.ok === true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function selectResultRow(row) {
        if (row === null || row === undefined) { return false; }
        state.resultCardLongPressCount += 1;
        setSelectedResult(row);
        if (state.panelAttached) {
            buildPanelContent(false);
        }
        return true;
    }

    function toggleResultPinned(row) {
        var changed;
        if (row === null || row === undefined || !ClipHub.List ||
                typeof ClipHub.List.togglePinned !== "function") {
            return false;
        }
        changed = ClipHub.List.togglePinned(Number(row.id));
        if (changed) {
            state.pinActionCount += 1;
            refreshPrimaryResults("primary_pin");
        }
        return changed === true;
    }

    function editSelectedResult() {
        var row = selectedResultRow();
        if (row === null || !ClipHub.Editor ||
                typeof ClipHub.Editor.openItem !== "function") {
            return false;
        }
        state.editActionCount += 1;
        ClipHub.Editor.openItem(Number(row.id));
        return true;
    }

    function addNewResult() {
        if (!ClipHub.Editor ||
                typeof ClipHub.Editor.openNew !== "function") {
            return false;
        }
        state.addActionCount += 1;
        ClipHub.Editor.openNew();
        return true;
    }

    function deleteSelectedResult() {
        var row = selectedResultRow();
        var changed;
        if (row === null || !ClipHub.List ||
                typeof ClipHub.List.deleteItem !== "function") {
            return false;
        }
        changed = ClipHub.List.deleteItem(Number(row.id));
        if (changed) {
            state.deleteActionCount += 1;
            clearSelectedResult();
            refreshPrimaryResults("primary_delete");
        }
        return changed === true;
    }

    function openSelectedDetail() {
        var row = selectedResultRow();
        if (row === null || !ClipHub.List ||
                typeof ClipHub.List.openDetail !== "function") {
            return false;
        }
        state.detailActionCount += 1;
        return ClipHub.List.openDetail(Number(row.id)) === true;
    }

    function makeResultCard(row, colors) {
        var selected = selectedItemId !== null &&
            Number(selectedItemId) === Number(row.id);
        var card = new LinearLayout(appContext);
        var icon = makeSourceIcon(row, colors);
        var center = new LinearLayout(appContext);
        var content = makeText(String(row.content || ""),
            11, colors.textPrimary, selected);
        var metaRow = new LinearLayout(appContext);
        var type = makeText(typeLabel(row.content_type),
            8, colors.accentStrong, true);
        var source = makeText(sourceLabel(row),
            8, colors.textSecondary, false);
        var right = new LinearLayout(appContext);
        var time = makeText(formatTime(row.last_copied_at),
            8, colors.textTertiary, false);
        var star = makeText(Number(row.is_pinned || 0) === 1 ?
            "★" : "☆", 17,
            Number(row.is_pinned || 0) === 1 ?
                colors.accentStrong : colors.textTertiary, false);
        var params;

        card.setOrientation(LinearLayout.HORIZONTAL);
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setPadding(dp(8), dp(7), dp(7), dp(7));
        card.setBackground(roundedBackground(
            selected ? colors.accentSoft : colors.card,
            selected ? colors.accentBorder : colors.stroke, 12));
        card.setClickable(true);
        card.setFocusable(true);
        card.setContentDescription("剪贴板记录，点击复制，长按选择");
        (function (target, view) {
            view.setOnClickListener(new JavaAdapter(
                View.OnClickListener, {
                    onClick: function () { copyResultRow(target); }
                }));
            view.setOnLongClickListener(new JavaAdapter(
                View.OnLongClickListener, {
                    onLongClick: function () {
                        return selectResultRow(target);
                    }
                }));
        }(row, card));

        params = new LinearLayout.LayoutParams(dp(34), dp(34));
        params.rightMargin = dp(8);
        card.addView(icon, params);

        center.setOrientation(LinearLayout.VERTICAL);
        content.setMaxLines(2);
        content.setEllipsize(TextUtils.TruncateAt.END);
        center.addView(content, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        metaRow.setOrientation(LinearLayout.HORIZONTAL);
        metaRow.setGravity(Gravity.CENTER_VERTICAL);
        type.setPadding(dp(6), dp(2), dp(6), dp(2));
        type.setBackground(roundedBackground(colors.accentSoft,
            null, 7));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.rightMargin = dp(6);
        metaRow.addView(type, params);
        source.setSingleLine(true);
        source.setEllipsize(TextUtils.TruncateAt.END);
        metaRow.addView(source, new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        center.addView(metaRow, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        card.addView(center, new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        right.setOrientation(LinearLayout.VERTICAL);
        right.setGravity(Gravity.END | Gravity.CENTER_VERTICAL);
        time.setGravity(Gravity.END);
        right.addView(time, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(16)));
        star.setGravity(Gravity.END | Gravity.CENTER_VERTICAL);
        star.setClickable(true);
        star.setFocusable(true);
        star.setContentDescription("切换置顶");
        (function (target, view) {
            view.setOnClickListener(new JavaAdapter(
                View.OnClickListener, {
                    onClick: function () { toggleResultPinned(target); }
                }));
        }(row, star));
        right.addView(star, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(28)));
        card.addView(right, new LinearLayout.LayoutParams(dp(48),
            LinearLayout.LayoutParams.WRAP_CONTENT));
        resultCardViews.push(card);
        state.resultCardCount += 1;
        return card;
    }

'''
text = text[:start] + new_cards + text[end:]

old = '''        state.resultCardCount = 0;
        state.resultSourceIconCount = 0;
        if (previewRows.length === 0) {'''
new = '''        state.resultCardCount = 0;
        state.resultSourceIconCount = 0;
        resultCardViews = [];
        if (selectedItemId !== null && selectedResultRow() === null) {
            clearSelectedResult();
        }
        if (previewRows.length === 0) {'''
if text.count(old) != 1:
    raise SystemExit('refresh result marker mismatch')
text = text.replace(old, new, 1)

start = text.index('    function buildBottomToolbar(colors) {')
end = text.index('    function buildPanelContent(requestFocus)', start)
new_toolbar = r'''    function makeToolbarAction(key, iconText, labelText, colors,
            enabled, primary, callback) {
        var item = new LinearLayout(appContext);
        var icon = makeText(iconText, primary ? 22 : 16,
            enabled ? (primary ? colors.accentStrong : colors.icon) :
                colors.textTertiary,
            primary === true);
        var label = makeText(labelText, 9,
            enabled ? colors.textSecondary : colors.textTertiary,
            primary === true);
        item.setOrientation(LinearLayout.VERTICAL);
        item.setGravity(Gravity.CENTER);
        item.setAlpha(enabled ? 1 : 0.48);
        item.setEnabled(enabled);
        item.setClickable(enabled);
        item.setFocusable(enabled);
        item.setContentDescription(String(labelText));
        icon.setGravity(Gravity.CENTER);
        label.setGravity(Gravity.CENTER);
        item.addView(icon, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(26)));
        item.addView(label, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        if (enabled && typeof callback === "function") {
            item.setOnClickListener(new JavaAdapter(
                View.OnClickListener, {
                    onClick: function () { callback(); }
                }));
        }
        toolbarActionViews[String(key)] = item;
        return item;
    }

    function buildBottomToolbar(colors) {
        var toolbar = new LinearLayout(appContext);
        var hasSelection = selectedResultRow() !== null;
        var params = new LinearLayout.LayoutParams(0, dp(56), 1);
        toolbarActionViews = {};
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setGravity(Gravity.CENTER);
        toolbar.setPadding(dp(4), dp(3), dp(4), dp(3));
        toolbar.setBackground(roundedBackground(colors.toolbar,
            null, 17));
        toolbar.addView(makeToolbarAction("pin", "⌖", "置顶", colors,
            hasSelection, false, function () {
                toggleResultPinned(selectedResultRow());
            }), params);
        toolbar.addView(makeToolbarAction("edit", "✎", "编辑", colors,
            hasSelection, false, editSelectedResult),
            new LinearLayout.LayoutParams(0, dp(56), 1));
        toolbar.addView(makeToolbarAction("add", "+", "新增", colors,
            true, true, addNewResult),
            new LinearLayout.LayoutParams(0, dp(56), 1));
        toolbar.addView(makeToolbarAction("delete", "⌫", "删除", colors,
            hasSelection, false, deleteSelectedResult),
            new LinearLayout.LayoutParams(0, dp(56), 1));
        toolbar.addView(makeToolbarAction("detail", "文", "翻译", colors,
            hasSelection, false, openSelectedDetail),
            new LinearLayout.LayoutParams(0, dp(56), 1));
        state.toolbarEnabledCount = hasSelection ? 5 : 1;
        return toolbar;
    }

'''
text = text[:start] + new_toolbar + text[end:]

old = '''    function showPanel(options) {
        var result;
        options = options || {};
        if (!ready) {'''
new = '''    function showPanel(options) {
        var result;
        options = options || {};
        rootMode = options.rootMode === true;
        state.rootMode = rootMode;
        state.primarySurface = rootMode ?
            "filter_root" : "filter_overlay";
        if (!ready) {'''
if text.count(old) != 1:
    raise SystemExit('showPanel start marker mismatch')
text = text.replace(old, new, 1)

old = '''        suspendHomeWindow();
        try {'''
new = '''        if (rootMode) {
            restoreListOnClose = false;
            state.homeWindowSuspended = false;
        } else {
            suspendHomeWindow();
        }
        try {'''
if text.count(old) != 1:
    raise SystemExit('suspend marker mismatch')
text = text.replace(old, new, 1)

old = '''        } catch (error) {
            finishHomeWindow({
                restoreList: true,
                reason: "show_failed"
            });
            throw error;
        }
    }

    function closePanel(options) {
        var result;
        options = options || {};'''
new = '''        } catch (error) {
            if (!rootMode) {
                finishHomeWindow({
                    restoreList: true,
                    reason: "show_failed"
                });
            }
            rootMode = false;
            state.rootMode = false;
            state.primarySurface = "filter_overlay";
            throw error;
        }
    }

    function closePanel(options) {
        var result;
        var wasRootMode = rootMode;
        options = options || {};'''
if text.count(old) != 1:
    raise SystemExit('show catch / close start marker mismatch')
text = text.replace(old, new, 1)

old = '''        if (!state.panelAttached && panelRoot === null) {
            finishHomeWindow(options);
            return {
                ok: true,
                attached: false,
                alreadyClosed: true,
                state: getPanelState()
            };
        }'''
new = '''        if (!state.panelAttached && panelRoot === null) {
            if (!wasRootMode) { finishHomeWindow(options); }
            rootMode = false;
            state.rootMode = false;
            state.primarySurface = "filter_overlay";
            clearSelectedResult();
            return {
                ok: true,
                attached: false,
                alreadyClosed: true,
                state: getPanelState()
            };
        }'''
if text.count(old) != 1:
    raise SystemExit('already closed marker mismatch')
text = text.replace(old, new, 1)

old = '''        finishHomeWindow(options);
        return {
            ok: result === true,
            attached: false,
            alreadyClosed: false,
            state: getPanelState()
        };'''
new = '''        if (!wasRootMode) { finishHomeWindow(options); }
        rootMode = false;
        state.rootMode = false;
        state.primarySurface = "filter_overlay";
        clearSelectedResult();
        resultCardViews = [];
        toolbarActionViews = {};
        return {
            ok: result === true,
            attached: false,
            alreadyClosed: false,
            state: getPanelState()
        };'''
if text.count(old) != 1:
    raise SystemExit('close finish marker mismatch')
text = text.replace(old, new, 1)

old = '''        showPanel: showPanel,
        closePanel: closePanel,
        handleBack: handleBack,
        getPanelState: getPanelState,

        performSearch: function (text) {'''
new = '''        showPanel: showPanel,
        showRoot: function (options) {
            options = options || {};
            options.rootMode = true;
            if (options.requestKeyboard === undefined) {
                options.requestKeyboard = false;
            }
            return showPanel(options);
        },
        closePanel: closePanel,
        handleBack: handleBack,
        getPanelState: getPanelState,
        getSelectedItemId: function () { return selectedItemId; },

        performResultClick: function (index) {
            index = Math.floor(Number(index));
            return requireMain(runOnMainSync(function () {
                return index >= 0 && index < resultCardViews.length ?
                    resultCardViews[index].performClick() : false;
            }, 2500));
        },

        performResultLongClick: function (index) {
            index = Math.floor(Number(index));
            return requireMain(runOnMainSync(function () {
                return index >= 0 && index < resultCardViews.length ?
                    resultCardViews[index].performLongClick() : false;
            }, 2500));
        },

        performBottomActionClick: function (action) {
            action = String(action || "");
            return requireMain(runOnMainSync(function () {
                return toolbarActionViews[action] ?
                    toolbarActionViews[action].performClick() : false;
            }, 2500));
        },

        performSearch: function (text) {'''
if text.count(old) != 1:
    raise SystemExit('filter export marker mismatch')
text = text.replace(old, new, 1)

old = '''            searchGeneration += 1;
            value = null;
            ready = false;'''
new = '''            searchGeneration += 1;
            rootMode = false;
            selectedItemId = null;
            resultCardViews = [];
            toolbarActionViews = {};
            value = null;
            ready = false;'''
if text.count(old) != 1:
    raise SystemExit('shutdown reset marker mismatch')
text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
PYFILTER

python3 - <<'PYAPP'
from pathlib import Path

path = Path('src/ch_15_app.js')
text = path.read_text(encoding='utf-8')

replacements = [
    (
'''            homeFilterExclusive:
                ((windowAttached ? 1 : 0) +
                    (filterAttached ? 1 : 0)) <= 1,
            itemCount: Number(list.itemCount || 0),''',
'''            homeFilterExclusive:
                ((windowAttached ? 1 : 0) +
                    (filterAttached ? 1 : 0)) <= 1,
            primarySurface: filterAttached && filter.rootMode === true ?
                "filter_root" : (windowAttached ? "legacy_list" : "none"),
            filterRootMode: filter.rootMode === true,
            legacyHomeAttached: windowAttached,
            itemCount: Number(list.itemCount || 0),'''
    ),
    (
'''    function showUi() {
        var result;
        closeUi();
        if (!ClipHub.List || typeof ClipHub.List.show !== "function") {
            throw new Error("ClipHub list is unavailable");
        }
        result = ClipHub.List.show({ limit: 100, widthDp: 340, heightDp: 500 });
        return { result: result, status: uiStatus() };
    }''',
'''    function showUi() {
        var result;
        closeUi();
        if (ClipHub.List && typeof ClipHub.List.hide === "function") {
            ClipHub.List.hide(true);
        }
        if (!ClipHub.Filter) {
            throw new Error("ClipHub filter root is unavailable");
        }
        if (typeof ClipHub.Filter.showRoot === "function") {
            result = ClipHub.Filter.showRoot({
                requestKeyboard: false,
                showAdvanced: false
            });
        } else if (typeof ClipHub.Filter.showPanel === "function") {
            result = ClipHub.Filter.showPanel({
                requestKeyboard: false,
                showAdvanced: false,
                rootMode: true
            });
        } else {
            throw new Error("ClipHub filter root cannot be shown");
        }
        return { result: result, status: uiStatus() };
    }'''
    ),
    (
'''        MODULE_VERSION: 6,''',
'''        MODULE_VERSION: 7,'''
    )
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit('App replacement expected one match, got %d:\n%s' %
                         (count, old))
    text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
PYAPP

filter_sha="$(git hash-object src/ch_11_filter.js)"
app_sha="$(git hash-object src/ch_15_app.js)"
python3 - "$filter_sha" "$app_sha" <<'PYMANIFEST'
from pathlib import Path
import json
import sys

path = Path('module-manifest.json')
data = json.loads(path.read_text(encoding='utf-8'))
if data.get('schemaVersion') != 1 or data.get('entryMinVersion') != 4:
    raise SystemExit('Manifest schema or entry version changed')
if len(data.get('modules', [])) != 15:
    raise SystemExit('Manifest module count changed')
data['moduleSetVersion'] = '20260722.37'
updates = {
    'ch_11_filter.js': sys.argv[1],
    'ch_15_app.js': sys.argv[2]
}
for item in data['modules']:
    if item.get('name') in updates:
        item['sha'] = updates[item['name']]
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n',
                encoding='utf-8')
PYMANIFEST

python3 - <<'PYDOC'
from pathlib import Path

path = Path('docs/开发计划.md')
text = path.read_text(encoding='utf-8')
text = text.replace(
'''- [x] 新增主页 / 搜索页单窗口探测 043
- [ ] 运行探测 043 并回传三张未裁剪截图与完整 JSON

当前边界：主页与搜索页采用互斥 WindowManager Root；Editor 等模态子页的既有叠层关系不变。''',
'''- [x] 新增主页 / 搜索页单窗口探测 043
- [x] 探测 043：主页 / 搜索页互斥、返回恢复和 hide / show 循环全部通过

当前边界：模块集 `.36` 已证明两个 WindowManager Root 不会同时附着。''', 1)

marker = '''#### 后续页面
'''
insert = '''#### 3D2 根页面收口：取消旧首页列表

- [x] 用户确认取消旧 `reference_home_v2` 首页，不再作为正式入口
- [x] 搜索 / 筛选页 `reference_search_v4` 升级为唯一根页面
- [x] 完成 Filter v11：根模式、结果卡点击复制、长按选择、星标置顶和底部操作栏
- [x] 完成 App v7：`show` / `toggle` 直接打开 Filter Root，不再调用 `List.show()`
- [x] 旧 List Window 保留为兼容代码，但正式入口不可达
- [x] List v12 继续承担详情页、置顶、删除和兼容数据动作
- [x] Editor 从 Filter Root 打开，关闭后返回 Filter Root
- [x] 详情页从 Filter Root 打开，关闭后不恢复旧首页
- [x] 根页面系统返回直接关闭 ClipHub UI，不再恢复旧首页
- [x] Repository、数据库 schema、Navigation v3 和后台剪贴板生命周期保持不变
- [x] 发布模块集 `20260722.37`
- [x] 新增唯一根页面探测 044
- [ ] 运行探测 044 并回传三张未裁剪截图与完整 JSON

当前边界：本轮只取消旧首页的生产入口；`ch_09_list.js` 尚不物理删除，待五页面功能回归后再清理兼容 UI 代码。

'''
if marker not in text:
    raise SystemExit('Development plan marker missing')
text = text.replace(marker, insert + marker, 1)
text = text.replace('moduleSetVersion=20260722.36',
                    'moduleSetVersion=20260722.37', 1)
text = text.replace('Filter=10', 'Filter=11', 1)
text = text.replace('App=6', 'App=7', 1)
start = text.index('## 下一步\n')
end = text.index('\n### 后续阶段 3E：入口版本 5', start)
next_text = '''## 下一步

### 运行唯一根页面探测 044

1. 在 Termux 同步 `agent/initialize-project-skeleton`；
2. 运行 `ClipHub.js`，确认模块集为 `.37`；
3. 运行 `ClipHub 唯一根页面探测044`；
4. 场景 1 截取默认 Filter Root 首页；
5. 场景 2 截取长按选中记录后的底部操作栏；
6. 场景 3 截取高级筛选抽屉；
7. 回传三张未裁剪截图与完整 JSON；
8. 检查所有场景 `legacyHomeAttached=false`；
9. 检查根页面返回后 `uiVisible=false`；
10. 检查重新 show 后仍直接进入 Filter Root。'''
text = text[:start] + next_text + text[end:]
path.write_text(text, encoding='utf-8')
PYDOC

cat > probes/cliphub_filter_root_probe_044_impl.js <<'EOF'
/* ClipHub sole filter-root probe 044. Rhino ES5 only. */
(function (global) {
    var File = Packages.java.io.File;
    var FIS = Packages.java.io.FileInputStream;
    var FOS = Packages.java.io.FileOutputStream;
    var ISR = Packages.java.io.InputStreamReader;
    var OSW = Packages.java.io.OutputStreamWriter;
    var BR = Packages.java.io.BufferedReader;
    var BW = Packages.java.io.BufferedWriter;
    var SB = Packages.java.lang.StringBuilder;
    var Thread = Packages.java.lang.Thread;
    var System = Packages.java.lang.System;
    var RAF = Packages.java.io.RandomAccessFile;
    var SDF = Packages.java.text.SimpleDateFormat;
    var Locale = Packages.java.util.Locale;
    var Intent = Packages.android.content.Intent;
    var Toast = Packages.android.widget.Toast;

    var REQUIRED_SET = "20260722.37";
    var RUNTIME_NAME = "ClipHubProbe044";
    var SCENE_DURATION_MS = 10000;
    var MODULES = [
        "ch_01_base.js", "ch_02_log.js", "ch_03_database.js",
        "ch_04_clipboard.js", "ch_05_classifier.js", "ch_06_repository.js",
        "ch_07_theme.js", "ch_08_window.js", "ch_09_list.js",
        "ch_10_editor.js", "ch_11_filter.js", "ch_12_translation.js",
        "ch_13_settings.js", "ch_14_event_bus.js", "ch_15_app.js"
    ];

    function now() { return Number(System.currentTimeMillis()); }

    function stamp(value) {
        return String(new SDF("yyyyMMdd-HHmmss-SSS", Locale.US)
            .format(new Packages.java.util.Date(value)));
    }

    function close(value) {
        if (value !== null && value !== undefined) {
            try { value.close(); } catch (ignored) {}
        }
    }

    function errorText(error) {
        try {
            if (error && error.javaException) {
                return String(error.javaException.getClass().getName()) +
                    ": " + String(error);
            }
        } catch (ignored) {}
        return String(error);
    }

    function ensureDir(file) {
        if (!file.exists() && !file.mkdirs() && !file.isDirectory()) {
            throw new Error("Cannot create directory: " +
                file.getAbsolutePath());
        }
        return file;
    }

    function read(file) {
        var reader = null;
        var builder = new SB();
        var line;
        try {
            reader = new BR(new ISR(new FIS(file), "UTF-8"));
            while ((line = reader.readLine()) !== null) {
                builder.append(line).append("\n");
            }
            return String(builder.toString());
        } finally {
            close(reader);
        }
    }

    function write(file, text) {
        var writer = null;
        try {
            writer = new BW(new OSW(new FOS(file, false), "UTF-8"));
            writer.write(String(text));
            writer.flush();
        } finally {
            close(writer);
        }
    }

    function removeTree(file) {
        var children;
        var index;
        var ok = true;
        if (!file.exists()) { return true; }
        if (file.isDirectory()) {
            children = file.listFiles();
            if (children !== null) {
                for (index = 0; index < children.length; index += 1) {
                    if (!removeTree(children[index])) { ok = false; }
                }
            }
        }
        if (file.exists() && !file.delete()) { ok = false; }
        return ok;
    }

    function waitFor(callback, timeoutMs) {
        var started = now();
        while (now() - started < Number(timeoutMs || 0)) {
            if (callback()) { return true; }
            Thread.sleep(25);
        }
        return callback();
    }

    function lockFree(runtimeDir) {
        var dataDir = ensureDir(new File(runtimeDir, "data"));
        var raf = null;
        var channel = null;
        var lock = null;
        try {
            raf = new RAF(new File(dataDir, "cliphub.lock"), "rw");
            channel = raf.getChannel();
            lock = channel.tryLock();
            return lock !== null;
        } catch (error) {
            if (String(error).indexOf("OverlappingFileLockException") >= 0) {
                return false;
            }
            throw error;
        } finally {
            if (lock !== null) {
                try { lock.release(); } catch (ignored) {}
            }
            close(channel);
            close(raf);
        }
    }

    function localManifest(runtimeDir) {
        var file = new File(new File(runtimeDir, "cache"),
            "module-manifest.local.json");
        var data;
        if (!file.isFile()) { return { present: false }; }
        data = JSON.parse(read(file));
        return {
            present: true,
            moduleSetVersion: String(data.moduleSetVersion || ""),
            sourceRef: String(data.sourceRef || "")
        };
    }

    function stopFormal(context, runtimeDir) {
        var cacheDir = ensureDir(new File(runtimeDir, "cache"));
        var endpointFile = new File(cacheDir, "control_endpoint.json");
        var endpoint;
        var requestId;
        var ackFile;
        var intent;
        var ack = null;
        if (lockFree(runtimeDir)) {
            return { ok: true, skipped: true, reason: "not_running" };
        }
        if (!endpointFile.isFile()) {
            return { ok: false, error: "Formal control endpoint is missing" };
        }
        endpoint = JSON.parse(read(endpointFile));
        requestId = stamp(now()) + "-" +
            Number(Thread.currentThread().getId());
        ackFile = new File(cacheDir,
            "control_ack_" + requestId + ".json");
        if (ackFile.exists()) { ackFile.delete(); }
        intent = new Intent(String(endpoint.action));
        intent.putExtra("runtimeDir", String(runtimeDir.getAbsolutePath()));
        intent.putExtra("command", "stop");
        intent.putExtra("requestId", requestId);
        intent.putExtra("controlToken", String(endpoint.token));
        context.sendBroadcast(intent);
        waitFor(function () {
            return ackFile.isFile() && lockFree(runtimeDir);
        }, 3500);
        if (ackFile.isFile()) {
            try { ack = JSON.parse(read(ackFile)); } catch (ignoredAck) {}
            ackFile.delete();
        }
        return {
            ok: ack !== null && ack.ok === true &&
                ack.stopped === true && lockFree(runtimeDir) &&
                !endpointFile.exists(),
            skipped: false,
            ackReceived: ack !== null,
            ack: ack,
            lockReleased: lockFree(runtimeDir),
            endpointRemoved: !endpointFile.exists(),
            error: ack === null ?
                "Control acknowledgement not received" : null
        };
    }

    function start(root, moduleDir, runtimeDir) {
        var index;
        var file;
        global.ClipHub = {};
        for (index = 0; index < MODULES.length; index += 1) {
            file = new File(moduleDir, MODULES[index]);
            if (!file.isFile()) {
                throw new Error("Missing module: " + file.getAbsolutePath());
            }
            eval(read(file));
        }
        return global.ClipHub.App.start({
            shortxRoot: root,
            runtimeDir: String(runtimeDir.getAbsolutePath()),
            moduleDir: String(moduleDir.getAbsolutePath()),
            androidContext: global.context
        });
    }

    function showToast(text) {
        try {
            Toast.makeText(global.context, String(text),
                Toast.LENGTH_LONG).show();
        } catch (ignored) {}
    }

    function add(content, contentType, sourcePackage, sourceLabel,
            pinned, createdAt) {
        return Number(global.ClipHub.Repository.insertItem({
            content: String(content),
            contentType: String(contentType || "text"),
            sourcePackage: String(sourcePackage || "com.cliphub.probe044"),
            sourceLabel: String(sourceLabel || "探测来源"),
            sourceUid: 10000,
            sourceConfidence: 100,
            isSensitive: false,
            isPinned: pinned === true,
            createdAt: Number(createdAt),
            lastCopiedAt: Number(createdAt),
            updatedAt: Number(createdAt)
        }));
    }

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var formal = new File(root, "ClipHub");
        var modules = new File(formal, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var outputFile = new File(ensureDir(new File(formal, "probes")),
            "cliphub_filter_root_probe_044_" + stamp(startedAt) + ".json");
        var local = localManifest(formal);
        var formalWasRunning = !lockFree(formal);
        var result = {
            ok: false,
            probe: "cliphub_filter_root_probe_044",
            probeVersion: 1,
            moduleSetVersion: local.moduleSetVersion || null,
            sourceRef: local.sourceRef || null,
            sceneDurationMs: SCENE_DURATION_MS,
            sceneCount: 3,
            visualScreenshotRequired: true,
            instruction: "场景1截默认唯一首页；场景2截长按选中状态；场景3截高级筛选抽屉。三张截图均不得裁剪。",
            outputPath: String(outputFile.getAbsolutePath()),
            formalWasRunning: formalWasRunning,
            legacyHomeRemovedFromProductionEntry: true,
            repositorySemanticsChanged: false,
            navigationImplementationChanged: false,
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
            result.listModuleVersion = Number(global.ClipHub.List.MODULE_VERSION);
            result.filterModuleVersion = Number(global.ClipHub.Filter.MODULE_VERSION);
            result.appModuleVersion = Number(global.ClipHub.App.MODULE_VERSION);
            result.navigationModuleVersion =
                Number(global.ClipHub.Navigation.MODULE_VERSION);
            result.schemaVersion = Number(global.ClipHub.Database.getVersion());
            result.clipboardListenerStopped =
                global.ClipHub.Clipboard.stop().running === false;
            global.ClipHub.Settings.set("themeMode", "light", {
                cleanup: false
            });
            global.ClipHub.Settings.set("closeAfterCopy", false, {
                cleanup: false
            });
            add("https://developer.android.com/ ClipHub 唯一首页测试",
                "url", "com.android.chrome", "Chrome 浏览器", true,
                startedAt - 3000);
            add("ClipHub 唯一首页测试 2", "text", "com.termux",
                "Termux", false, startedAt - 2000);
            add("ClipHub 唯一首页测试 3", "text",
                "com.cliphub.probe044", "探测来源", false,
                startedAt - 1000);

            result.showCommand = global.ClipHub.App
                .executeControlCommand("show");
            result.rootReady = waitFor(function () {
                var app = global.ClipHub.App.getStatus();
                var list = global.ClipHub.List.getState();
                var panel = global.ClipHub.Filter.getPanelState();
                return app.filterAttached === true &&
                    app.filterRootMode === true &&
                    app.primarySurface === "filter_root" &&
                    app.legacyHomeAttached === false &&
                    app.windowAttached === false &&
                    list.visible === false &&
                    panel.rootMode === true &&
                    panel.resultCardCount === 3 &&
                    panel.toolbarEnabledCount === 1;
            }, 1800);
            result.rootScene = {
                app: global.ClipHub.App.getStatus(),
                list: global.ClipHub.List.getState(),
                filter: global.ClipHub.Filter.getState()
            };
            showToast("044  1/3  唯一根页面  ·  不得出现旧首页");
            Thread.sleep(SCENE_DURATION_MS);

            result.selectAction = global.ClipHub.Filter
                .performResultLongClick(1);
            result.selectionReady = waitFor(function () {
                var app = global.ClipHub.App.getStatus();
                var panel = global.ClipHub.Filter.getPanelState();
                return app.legacyHomeAttached === false &&
                    panel.rootMode === true &&
                    panel.selectionMode === true &&
                    panel.selectedItemId !== null &&
                    panel.toolbarEnabledCount === 5;
            }, 1200);
            result.pinAction = global.ClipHub.Filter
                .performBottomActionClick("pin");
            result.selectionScene = {
                app: global.ClipHub.App.getStatus(),
                list: global.ClipHub.List.getState(),
                filter: global.ClipHub.Filter.getState()
            };
            showToast("044  2/3  长按选中  ·  底部操作栏已启用");
            Thread.sleep(SCENE_DURATION_MS);

            result.advancedAction = global.ClipHub.Filter
                .performAdvancedClick();
            result.advancedReady = waitFor(function () {
                var app = global.ClipHub.App.getStatus();
                var panel = global.ClipHub.Filter.getPanelState();
                return app.legacyHomeAttached === false &&
                    panel.rootMode === true &&
                    panel.advancedDrawerVisible === true;
            }, 1200);
            result.advancedScene = {
                app: global.ClipHub.App.getStatus(),
                list: global.ClipHub.List.getState(),
                filter: global.ClipHub.Filter.getState()
            };
            showToast("044  3/3  高级筛选抽屉  ·  仍为唯一根页面");
            Thread.sleep(SCENE_DURATION_MS);

            result.drawerBack = global.ClipHub.Navigation
                .dispatchBackForOwner("filter", "probe044_drawer_back");
            result.drawerBackReady = waitFor(function () {
                return global.ClipHub.Filter.getPanelState()
                    .advancedDrawerVisible === false;
            }, 1000);
            result.rootBack = global.ClipHub.Navigation
                .dispatchBackForOwner("filter", "probe044_root_back");
            result.rootBackReady = waitFor(function () {
                var app = global.ClipHub.App.getStatus();
                return app.uiVisible === false &&
                    app.windowAttached === false &&
                    app.filterAttached === false;
            }, 1200);
            result.reopen = global.ClipHub.App
                .executeControlCommand("show");
            result.reopenReady = waitFor(function () {
                var app = global.ClipHub.App.getStatus();
                return app.filterAttached === true &&
                    app.filterRootMode === true &&
                    app.legacyHomeAttached === false &&
                    app.primarySurface === "filter_root";
            }, 1200);
            result.finalState = {
                app: global.ClipHub.App.getStatus(),
                list: global.ClipHub.List.getState(),
                filter: global.ClipHub.Filter.getState(),
                navigation: global.ClipHub.Navigation.getState()
            };
            result.hideCommand = global.ClipHub.App
                .executeControlCommand("hide");
            result.stop = global.ClipHub.App.stop(
                "probe044_filter_root");
            result.databaseClosed = !global.ClipHub.Database.isOpen();
            result.lockReleased = lockFree(isolated);
        } catch (error) {
            result.error = errorText(error);
            try { global.ClipHub.App.stop("probe044_error"); }
            catch (ignoredStop) {}
        } finally {
            try {
                if (formalWasRunning) {
                    result.formalRestart = lockFree(formal) ?
                        start(root, modules, formal) :
                        { ok: true, started: true, reused: true };
                } else {
                    result.formalRestart = {
                        ok: true,
                        skipped: true,
                        reason: "formal_was_not_running"
                    };
                }
            } catch (restartError) {
                result.formalRestart = {
                    ok: false,
                    error: errorText(restartError)
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
                result.listModuleVersion === 12 &&
                result.filterModuleVersion === 11 &&
                result.appModuleVersion === 7 &&
                result.navigationModuleVersion === 3 &&
                result.clipboardListenerStopped === true &&
                result.showCommand && result.showCommand.ok === true &&
                result.rootReady === true &&
                result.rootScene.app.legacyHomeAttached === false &&
                result.rootScene.list.visible === false &&
                result.rootScene.filter.panel.rootMode === true &&
                result.selectAction === true &&
                result.selectionReady === true &&
                result.pinAction === true &&
                result.selectionScene.app.legacyHomeAttached === false &&
                result.selectionScene.filter.panel.toolbarEnabledCount === 5 &&
                result.advancedAction === true &&
                result.advancedReady === true &&
                result.advancedScene.app.legacyHomeAttached === false &&
                result.drawerBack === true &&
                result.drawerBackReady === true &&
                result.rootBack === true &&
                result.rootBackReady === true &&
                result.reopen && result.reopen.ok === true &&
                result.reopenReady === true &&
                result.finalState.app.legacyHomeAttached === false &&
                result.hideCommand && result.hideCommand.ok === true &&
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
        global.ClipHubFilterRootProbe044Result = main();
    } catch (error) {
        global.ClipHubFilterRootProbe044Result = {
            ok: false,
            probe: "cliphub_filter_root_probe_044",
            probeVersion: 1,
            fatal: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubFilterRootProbe044Result);
EOF

python3 - <<'PYCHECK'
from pathlib import Path
import json
import re

for name in [
    'src/ch_11_filter.js',
    'src/ch_15_app.js',
    'probes/cliphub_filter_root_probe_044_impl.js'
]:
    text = Path(name).read_text(encoding='utf-8')
    forbidden = []
    if re.search(r'(?m)^\s*(?:let|const)\s+', text):
        forbidden.append('let/const')
    if '=>' in text:
        forbidden.append('arrow')
    if '`' in text:
        forbidden.append('template literal')
    if re.search(r'\bclass\s+[A-Za-z_$]', text):
        forbidden.append('class')
    if forbidden:
        raise SystemExit(name + ': forbidden ES6: ' + ', '.join(forbidden))

filter_text = Path('src/ch_11_filter.js').read_text(encoding='utf-8')
app_text = Path('src/ch_15_app.js').read_text(encoding='utf-8')
assert 'MODULE_VERSION: 11' in filter_text
assert 'showRoot: function' in filter_text
assert 'performResultLongClick' in filter_text
assert 'performBottomActionClick' in filter_text
assert 'rootMode === true' in filter_text
assert 'MODULE_VERSION: 7' in app_text
assert 'ClipHub.Filter.showRoot' in app_text
assert 'legacyHomeAttached' in app_text
assert 'ClipHub.List.show' not in app_text[app_text.index('function showUi()'):app_text.index('function executeControlCommand')]
manifest = json.loads(Path('module-manifest.json').read_text(encoding='utf-8'))
assert manifest['moduleSetVersion'] == '20260722.37'
assert manifest['entryMinVersion'] == 4
assert len(manifest['modules']) == 15
probe = Path('probes/cliphub_filter_root_probe_044_impl.js').read_text(encoding='utf-8')
assert 'REQUIRED_SET = "20260722.37"' in probe
assert 'filterModuleVersion === 11' in probe
assert 'appModuleVersion === 7' in probe
assert 'legacyHomeAttached === false' in probe
PYCHECK

node --check src/ch_11_filter.js
node --check src/ch_15_app.js
node --check probes/cliphub_filter_root_probe_044_impl.js
git diff --check

git config user.name "ClipHub Automation"
git config user.email "actions@github.com"
git add src/ch_11_filter.js src/ch_15_app.js module-manifest.json \
  docs/开发计划.md probes/cliphub_filter_root_probe_044_impl.js
git commit -m "refactor: make filter page the sole root surface"
implementation_commit="$(git rev-parse HEAD)"

cat > probes/cliphub_filter_root_probe_044.js <<EOF
/* ClipHub sole filter-root probe 044 loader. Rhino ES5 only. */
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
        "cliphub_filter_root_probe_044_impl.js" +
        "?_=" + Number(System.currentTimeMillis());

    try {
        connection = new URL(target).openConnection();
        connection.setUseCaches(false);
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(20000);
        connection.setRequestProperty("Cache-Control", "no-cache, no-store");
        connection.setRequestProperty("Pragma", "no-cache");
        connection.setRequestProperty("User-Agent", "ClipHub-Probe/044-v1");
        input = connection.getInputStream();
        reader = new BR(new ISR(input, "UTF-8"));
        while ((line = reader.readLine()) !== null) {
            builder.append(line).append("\n");
        }
        source = String(builder.toString());
        if (!source) {
            throw new Error("Probe 044 implementation is empty");
        }
        if (source.indexOf("probeVersion: 1") < 0 ||
                source.indexOf("REQUIRED_SET = \"20260722.37\"") < 0 ||
                source.indexOf("filterModuleVersion === 11") < 0 ||
                source.indexOf("appModuleVersion === 7") < 0 ||
                source.indexOf("cliphub_filter_root_probe_044") < 0 ||
                source.indexOf("legacyHomeAttached === false") < 0 ||
                source.indexOf("performResultLongClick") < 0 ||
                source.indexOf("performBottomActionClick") < 0) {
            throw new Error("Probe 044 implementation validation failed");
        }
        eval(source + "\n//# sourceURL=ClipHub/probe_044_impl_v1.js");
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

JSON.stringify(ClipHubFilterRootProbe044Result);
EOF

cat > docs/唯一根页面探测044说明.md <<EOF
# ClipHub 唯一根页面探测 044

## 目标

验证旧 `reference_home_v2` 首页不再由正式入口创建，`reference_search_v4` 搜索 / 筛选页成为唯一根页面。

## 模块集

\`\`\`text
moduleSetVersion=20260722.37
entryVersion=4
databaseSchemaVersion=2
List=12
Filter=11
App=7
Navigation=3
\`\`\`

## 生产入口行为

- `show` / `toggle` 直接打开 Filter Root；
- 不再调用 `ClipHub.List.show()`；
- `legacyHomeAttached` 必须始终为 `false`；
- 根页面系统返回直接关闭 ClipHub UI；
- 再次 `show` 仍直接打开 Filter Root。

## 已迁移交互

- 点击结果卡：复制；
- 长按结果卡：选择；
- 星标：直接切换置顶；
- 底栏：置顶、编辑、新增、删除、详情 / 翻译入口；
- Editor 和详情页关闭后返回 Filter Root。

## 三个场景

1. 默认唯一首页；
2. 长按选中记录，底部操作栏启用；
3. 高级筛选抽屉。

## 探测文件

\`\`\`text
probes/cliphub_filter_root_probe_044.js
probes/cliphub_filter_root_probe_044_impl.js
\`\`\`

加载器固定读取实现提交：

\`\`\`text
${implementation_commit}
\`\`\`

## 回传要求

- 三张完整未裁剪截图；
- 完整 JSON；
- 运行期间不要手动关闭、返回或切换页面。
EOF

node --check probes/cliphub_filter_root_probe_044.js
node --check probes/cliphub_filter_root_probe_044_impl.js
git diff --check

git add probes/cliphub_filter_root_probe_044.js \
  docs/唯一根页面探测044说明.md
git rm -r "$HELPER_DIR" "$WORKFLOW_PATH"
git commit -m "test: add sole filter-root probe 044"
git push origin "HEAD:$BRANCH"
