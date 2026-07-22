from pathlib import Path
import json
import subprocess

ROOT = Path('.')


def git_hash(path):
    return subprocess.check_output(['git', 'hash-object', path], text=True).strip()


def check_hash(path, expected):
    actual = git_hash(path)
    if actual != expected:
        raise SystemExit('Unexpected base for %s: %s != %s' % (path, actual, expected))


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit('%s expected one match, got %d' % (label, count))
    return text.replace(old, new, 1)


check_hash('src/ch_11_filter.js', '40e39a506d75f7cebdeb1541d26920f4a76383da')
check_hash('src/ch_12_translation.js', '99b90516d8785d84fbf881fe04d194fa72675d4c')
check_hash('probes/cliphub_content_tags_settings_probe_045_impl.js', '76a511e3d1d27e4eb368fc55b33671aaf8392305')
check_hash('probes/cliphub_content_tags_settings_probe_045.js', '43da2902e26704b399f8cc52911092ff844b3985')
check_hash('docs/内容标签翻译设置探测045说明.md', '125b3fd8c2d5844c06147ee025fbbb27b5d3d5b4')
check_hash('module-manifest.json', '50ea55ff5d7dd4b4563a301c879faa4c9cf0c966')

# Filter v13: remove the fixed eight-row preview and add incremental paging.
p = Path('src/ch_11_filter.js')
s = p.read_text(encoding='utf-8')
s = replace_once(s,
'''    var HISTORY_KEY = "filterSearchHistory";
    var HISTORY_LIMIT = 6;
    var RESULT_LIMIT = 40;
    var PREVIEW_LIMIT = 8;
''',
'''    var HISTORY_KEY = "filterSearchHistory";
    var HISTORY_LIMIT = 6;
    var RESULT_PAGE_SIZE = 20;
''', 'filter paging constants')
s = replace_once(s,
'''    var resultCardViews = [];
    var toolbarActionViews = {};
    var resultTagMap = {};
''',
'''    var resultCardViews = [];
    var toolbarActionViews = {};
    var resultTagMap = {};
    var resultPageLimit = RESULT_PAGE_SIZE;
    var resultHasMore = false;
    var resultScrollView = null;
    var loadMoreView = null;
''', 'filter paging vars')
s = replace_once(s,
'''        settingsButtonPresent: false,
        renderedTagLabelCount: 0,
        toolbarEnabledCount: 1,
''',
'''        settingsButtonPresent: false,
        renderedTagLabelCount: 0,
        loadedResultCount: 0,
        resultPageSize: RESULT_PAGE_SIZE,
        resultPageLimit: RESULT_PAGE_SIZE,
        resultHasMore: false,
        resultCanScroll: false,
        loadMoreCount: 0,
        toolbarEnabledCount: 1,
''', 'filter paging state')

old_apply = '''    function apply(options) {
        var rows;
        var thread;
        options = options || {};
        if (!ready || value === null) {
            throw new Error("ClipHub filter is not ready");
        }
        try {
            rows = ClipHub.Repository.listItems(toQueryOptions({
                limit: options.limit === undefined ? RESULT_LIMIT : options.limit,
                offset: options.offset === undefined ? 0 : options.offset
            }));
            rows = sortRows(rows);
            previewRows = rows.slice(0, PREVIEW_LIMIT);
            if (ClipHub.List &&
                    typeof ClipHub.List.setItems === "function") {
                ClipHub.List.setItems(rows);
            }
            state.applyCount += 1;
            if (options.fromEvent === true) {
                state.eventApplyCount += 1;
            }
            state.lastResultCount = rows.length;
            thread = Thread.currentThread();
            state.lastApplyThreadId = Number(thread.getId());
            state.lastApplyThreadName = String(thread.getName());
            state.lastError = null;
            emitChanged(rows,
                options.origin ||
                (options.fromEvent ? "event" : "manual"));
            return rows;
        } catch (error) {
            state.lastError = String(error);
            throw error;
        }
    }
'''
new_apply = '''    function resetResultPaging() {
        resultPageLimit = RESULT_PAGE_SIZE;
        resultHasMore = false;
        state.loadedResultCount = 0;
        state.resultPageLimit = resultPageLimit;
        state.resultHasMore = false;
        state.resultCanScroll = false;
        return resultPageLimit;
    }

    function apply(options) {
        var rows;
        var thread;
        var pagedRequest;
        var requestedLimit;
        options = options || {};
        if (!ready || value === null) {
            throw new Error("ClipHub filter is not ready");
        }
        pagedRequest = options.limit === undefined &&
            (options.offset === undefined || Number(options.offset) === 0);
        requestedLimit = pagedRequest ? resultPageLimit + 1 :
            Math.max(1, Math.floor(Number(options.limit || RESULT_PAGE_SIZE)));
        try {
            rows = ClipHub.Repository.listItems(toQueryOptions({
                limit: requestedLimit,
                offset: options.offset === undefined ? 0 : options.offset
            }));
            rows = sortRows(rows);
            if (pagedRequest) {
                resultHasMore = rows.length > resultPageLimit;
                previewRows = rows.slice(0, resultPageLimit);
            } else {
                resultHasMore = false;
                previewRows = rows;
            }
            if (ClipHub.List &&
                    typeof ClipHub.List.setItems === "function") {
                ClipHub.List.setItems(previewRows);
            }
            state.applyCount += 1;
            if (options.fromEvent === true) {
                state.eventApplyCount += 1;
            }
            state.lastResultCount = previewRows.length;
            state.loadedResultCount = previewRows.length;
            state.resultPageLimit = resultPageLimit;
            state.resultHasMore = resultHasMore;
            thread = Thread.currentThread();
            state.lastApplyThreadId = Number(thread.getId());
            state.lastApplyThreadName = String(thread.getName());
            state.lastError = null;
            emitChanged(previewRows,
                options.origin ||
                (options.fromEvent ? "event" : "manual"));
            return previewRows;
        } catch (error) {
            state.lastError = String(error);
            throw error;
        }
    }
'''
s = replace_once(s, old_apply, new_apply, 'filter apply paging')
s = replace_once(s,
'''    function setValue(patch, options) {
        patch = patch || {};
''',
'''    function setValue(patch, options) {
        patch = patch || {};
        resetResultPaging();
''', 'filter criteria paging reset')
s = replace_once(s,
'''    function reset(options) {
        value = emptyValue();
''',
'''    function reset(options) {
        resetResultPaging();
        value = emptyValue();
''', 'filter reset paging')

s = replace_once(s,
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
''',
'''    function openSelectedDetail() {
        var row = selectedResultRow();
        if (row === null || !ClipHub.Translation ||
                typeof ClipHub.Translation.openForItem !== "function") {
            return false;
        }
        try {
            ClipHub.Translation.openForItem(Number(row.id));
            state.detailActionCount += 1;
            state.lastError = null;
            return true;
        } catch (error) {
            state.lastError = "Translation open failed: " + String(error);
            return false;
        }
    }
''', 'filter translation guard')

insert_marker = '''    function refreshResultsOnMain() {
'''
insert_code = '''    function updateResultScrollState() {
        try {
            state.resultCanScroll = resultScrollView !== null &&
                resultScrollView.canScrollVertically(1);
        } catch (ignored) {
            state.resultCanScroll = false;
        }
        return state.resultCanScroll;
    }

    function loadMoreResults() {
        if (!state.panelAttached || !resultHasMore) { return false; }
        resultPageLimit += RESULT_PAGE_SIZE;
        state.loadMoreCount += 1;
        apply({ origin: "ui_load_more" });
        refreshResultsOnMain();
        updateResultCountOnMain();
        if (mainHandler !== null) {
            mainHandler.post(new Packages.java.lang.Runnable({
                run: function () { updateResultScrollState(); }
            }));
        }
        return true;
    }

'''
if s.count(insert_marker) != 1:
    raise SystemExit('filter refresh insert marker mismatch')
s = s.replace(insert_marker, insert_code + insert_marker, 1)

s = replace_once(s,
'''        for (index = 0; index < previewRows.length; index += 1) {
            params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
            params.bottomMargin = dp(6);
            resultContainer.addView(makeResultCard(
                previewRows[index], colors), params);
        }
        return true;
''',
'''        for (index = 0; index < previewRows.length; index += 1) {
            params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
            params.bottomMargin = dp(6);
            resultContainer.addView(makeResultCard(
                previewRows[index], colors), params);
        }
        loadMoreView = null;
        if (resultHasMore) {
            loadMoreView = makeText("加载更多", 11,
                colors.accentStrong, true);
            loadMoreView.setGravity(Gravity.CENTER);
            loadMoreView.setPadding(dp(10), dp(10), dp(10), dp(10));
            loadMoreView.setBackground(roundedBackground(
                colors.accentSoft, colors.accentBorder, 12));
            loadMoreView.setClickable(true);
            loadMoreView.setFocusable(true);
            loadMoreView.setContentDescription("加载更多剪贴板记录");
            loadMoreView.setOnClickListener(new JavaAdapter(
                View.OnClickListener, {
                    onClick: function () { loadMoreResults(); }
                }));
            params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(44));
            params.topMargin = dp(2);
            params.bottomMargin = dp(4);
            resultContainer.addView(loadMoreView, params);
        }
        state.loadedResultCount = previewRows.length;
        state.resultHasMore = resultHasMore;
        state.resultPageLimit = resultPageLimit;
        return true;
''', 'filter render load more')

s = replace_once(s,
'''    function updateResultCountOnMain() {
        if (resultCountView !== null) {
            resultCountView.setText("共 " +
                Number(state.lastResultCount) +
                " 条" + (isActive(value) ? "（已筛选）" : ""));
        }
    }
''',
'''    function updateResultCountOnMain() {
        if (resultCountView !== null) {
            resultCountView.setText((resultHasMore ? "已加载 " : "共 ") +
                Number(state.loadedResultCount) +
                (resultHasMore ? " 条（还有更多）" : " 条") +
                (isActive(value) ? "（已筛选）" : ""));
        }
    }
''', 'filter result count')

s = replace_once(s,
'''        if (enabled && typeof callback === "function") {
            item.setOnClickListener(new JavaAdapter(
                View.OnClickListener, {
                    onClick: function () { callback(); }
                }));
        }
''',
'''        if (enabled && typeof callback === "function") {
            item.setOnClickListener(new JavaAdapter(
                View.OnClickListener, {
                    onClick: function () {
                        try {
                            callback();
                        } catch (error) {
                            state.lastError = "Toolbar action " +
                                String(key) + " failed: " + String(error);
                        }
                    }
                }));
        }
''', 'filter toolbar exception guard')

s = replace_once(s,
'''        var scroll = new ScrollView(appContext);
        root.setOrientation(LinearLayout.VERTICAL);
''',
'''        var scroll = new ScrollView(appContext);
        resultScrollView = scroll;
        root.setOrientation(LinearLayout.VERTICAL);
''', 'filter result scroll reference')
s = replace_once(s,
'''        refreshResultsOnMain();
        return root;
    }
''',
'''        refreshResultsOnMain();
        if (mainHandler !== null) {
            mainHandler.post(new Packages.java.lang.Runnable({
                run: function () { updateResultScrollState(); }
            }));
        }
        return root;
    }
''', 'filter result scroll measurement')

s = replace_once(s,
'''                try {
                    previewRows = ClipHub.Repository.listItems(
                        toQueryOptions({ limit: RESULT_LIMIT, offset: 0 }));
                    previewRows = sortRows(previewRows);
                    state.lastResultCount = previewRows.length;
                    previewRows = previewRows.slice(0, PREVIEW_LIMIT);
                } catch (previewError) {
''',
'''                try {
                    resetResultPaging();
                    apply({ origin: "panel_open" });
                } catch (previewError) {
''', 'filter panel initial page')

s = replace_once(s,
'''                resultContainer = null;
                resultCountView = null;
                drawerContainer = null;
''',
'''                resultContainer = null;
                resultCountView = null;
                resultScrollView = null;
                loadMoreView = null;
                drawerContainer = null;
''', 'filter close paging views')

s = replace_once(s,
'''            renderedTagLabelCount: Number(state.renderedTagLabelCount),
            resultSourceIconCount:
''',
'''            renderedTagLabelCount: Number(state.renderedTagLabelCount),
            loadedResultCount: Number(state.loadedResultCount),
            resultPageSize: Number(state.resultPageSize),
            resultPageLimit: Number(state.resultPageLimit),
            resultHasMore: state.resultHasMore === true,
            resultCanScroll: state.resultCanScroll === true,
            loadMorePresent: loadMoreView !== null,
            loadMoreCount: Number(state.loadMoreCount),
            resultSourceIconCount:
''', 'filter panel paging state export')

s = replace_once(s,
'''        state.settingsButtonPresent = false;
        state.renderedTagLabelCount = 0;
        state.toolbarEnabledCount = 1;
''',
'''        state.settingsButtonPresent = false;
        state.renderedTagLabelCount = 0;
        state.loadedResultCount = 0;
        state.resultPageSize = RESULT_PAGE_SIZE;
        state.resultPageLimit = RESULT_PAGE_SIZE;
        state.resultHasMore = false;
        state.resultCanScroll = false;
        state.loadMoreCount = 0;
        state.toolbarEnabledCount = 1;
''', 'filter paging state reset')
s = replace_once(s,
'''        state.searchPageStyle = "reference_search_v5";
''',
'''        state.searchPageStyle = "reference_search_v6";
''', 'filter style version')
s = replace_once(s,
'''            resultCardViews = [];
            toolbarActionViews = {};
            resultTagMap = {};
            resetState();
''',
'''            resultCardViews = [];
            toolbarActionViews = {};
            resultTagMap = {};
            resultScrollView = null;
            loadMoreView = null;
            resetResultPaging();
            resetState();
''', 'filter init paging')
s = replace_once(s,
'''        performBottomActionClick: function (action) {
            action = String(action || "");
            return requireMain(runOnMainSync(function () {
                return toolbarActionViews[action] ?
                    toolbarActionViews[action].performClick() : false;
            }, 2500));
        },

        performSearch: function (text) {
''',
'''        performBottomActionClick: function (action) {
            action = String(action || "");
            return requireMain(runOnMainSync(function () {
                return toolbarActionViews[action] ?
                    toolbarActionViews[action].performClick() : false;
            }, 2500));
        },

        performLoadMoreClick: function () {
            return requireMain(runOnMainSync(function () {
                return loadMoreView !== null ?
                    loadMoreView.performClick() : false;
            }, 2500));
        },

        performSearch: function (text) {
''', 'filter load more export')
s = replace_once(s,
'''            resultCardViews = [];
            toolbarActionViews = {};
            resultTagMap = {};
            value = null;
''',
'''            resultCardViews = [];
            toolbarActionViews = {};
            resultTagMap = {};
            resultScrollView = null;
            loadMoreView = null;
            resetResultPaging();
            value = null;
''', 'filter shutdown paging')
s = replace_once(s, '        MODULE_VERSION: 12,', '        MODULE_VERSION: 13,',
                 'filter version')
p.write_text(s, encoding='utf-8')

# Translation v6: import Gravity, make detail back close the translation window.
p = Path('src/ch_12_translation.js')
s = p.read_text(encoding='utf-8')
s = replace_once(s,
'''    var View = Packages.android.view.View;
    var KeyEvent = Packages.android.view.KeyEvent;
''',
'''    var View = Packages.android.view.View;
    var Gravity = Packages.android.view.Gravity;
    var KeyEvent = Packages.android.view.KeyEvent;
''', 'translation Gravity import')
s = replace_once(s,
'''    function closeDetail() {
        try {
            if (ClipHub.List && ClipHub.List.closeDetail) {
                ClipHub.List.closeDetail();
                return true;
            }
        } catch (error) { navState.lastError = String(error); }
        return false;
    }
''',
'''    function closeDetail() {
        try {
            if (translationState.attached === true &&
                    ClipHub.Translation && ClipHub.Translation.close) {
                ClipHub.Translation.close("navigation_back");
                return true;
            }
            if (ClipHub.List && ClipHub.List.closeDetail) {
                ClipHub.List.closeDetail();
                return true;
            }
        } catch (error) { navState.lastError = String(error); }
        return false;
    }
''', 'translation navigation close')
s = replace_once(s, '        MODULE_VERSION: 5,', '        MODULE_VERSION: 6,',
                 'translation version')
p.write_text(s, encoding='utf-8')

# Probe 045 v2: verify the crash path and list paging before screenshots.
p = Path('probes/cliphub_content_tags_settings_probe_045_impl.js')
s = p.read_text(encoding='utf-8')
s = s.replace('var REQUIRED_SET = "20260723.01";',
              'var REQUIRED_SET = "20260723.02";', 1)
s = s.replace('probeVersion: 1,', 'probeVersion: 2,', 1)
s = replace_once(s,
'''        var result = {
''',
'''        var extraIndex;
        var result = {
''', 'probe extra index declaration')
s = replace_once(s,
'''            result.urlRow = global.ClipHub.Repository.getItem(result.urlId, false);
''',
'''            result.extraIds = [];
            for (extraIndex = 0; extraIndex < 25; extraIndex += 1) {
                result.extraIds.push(Number(global.ClipHub.Repository.insertItem({
                    content: "ClipHub 分页记录 " + String(extraIndex + 1),
                    contentType: "text", sourcePackage: "com.termux",
                    sourceLabel: "Termux", sourceUid: 10002,
                    sourceConfidence: 100, isPinned: false
                })));
            }
            result.urlRow = global.ClipHub.Repository.getItem(result.urlId, false);
''', 'probe paging fixtures')
s = replace_once(s,
'''                    panel.settingsButtonPresent === true &&
                    panel.renderedTagLabelCount >= 3;
''',
'''                    panel.settingsButtonPresent === true &&
                    panel.renderedTagLabelCount >= 3 &&
                    panel.resultCardCount === 20 &&
                    panel.loadedResultCount === 20 &&
                    panel.resultHasMore === true &&
                    panel.loadMorePresent === true;
''', 'probe root paging ready')
s = replace_once(s,
'''            result.rootScene = {
                app: global.ClipHub.App.getStatus(),
                filter: global.ClipHub.Filter.getState()
            };
            showToast("045  1/3  标签首页  ·  不得显示内容类型");
''',
'''            result.firstPageState = global.ClipHub.Filter.getPanelState();
            result.loadMoreClick = global.ClipHub.Filter.performLoadMoreClick();
            result.loadMoreReady = waitFor(function () {
                var panel = global.ClipHub.Filter.getPanelState();
                return panel.resultCardCount >= 28 &&
                    panel.loadedResultCount >= 28 &&
                    panel.resultHasMore === false;
            }, 1800);
            result.afterLoadMoreState = global.ClipHub.Filter.getPanelState();
            result.translationSelect = global.ClipHub.Filter
                .performResultLongClick(0);
            result.translationClick = global.ClipHub.Filter
                .performBottomActionClick("detail");
            result.translationPopupReady = waitFor(function () {
                return global.ClipHub.Translation.getState().attached === true;
            }, 1500);
            result.translationPopupState = global.ClipHub.Translation.getState();
            result.translationClose = global.ClipHub.Translation.close(
                "probe045_translation_guard");
            result.translationClosedReady = waitFor(function () {
                return global.ClipHub.Translation.getState().attached === false &&
                    global.ClipHub.Filter.getPanelState().attached === true;
            }, 1200);
            result.rootScene = {
                app: global.ClipHub.App.getStatus(),
                filter: global.ClipHub.Filter.getState()
            };
            showToast("045  1/3  标签首页  ·  已验证滚动分页与翻译入口");
''', 'probe paging translation actions')
s = s.replace('result.filterModuleVersion === 12 &&',
              'result.filterModuleVersion === 13 &&', 1)
s = s.replace('result.translationModuleVersion === 5 &&',
              'result.translationModuleVersion === 6 &&', 1)
s = replace_once(s,
'''                result.rootReady === true &&
                result.rootScene.app.legacyHomeAttached === false &&
''',
'''                result.rootReady === true &&
                result.firstPageState.resultCardCount === 20 &&
                result.firstPageState.resultHasMore === true &&
                result.loadMoreClick === true &&
                result.loadMoreReady === true &&
                result.afterLoadMoreState.resultCardCount >= 28 &&
                result.afterLoadMoreState.resultHasMore === false &&
                result.translationSelect === true &&
                result.translationClick === true &&
                result.translationPopupReady === true &&
                result.translationPopupState.attached === true &&
                result.translationClose === true &&
                result.translationClosedReady === true &&
                result.rootScene.app.legacyHomeAttached === false &&
''', 'probe ok paging translation')
s = s.replace('probeVersion: 1, fatal: true',
              'probeVersion: 2, fatal: true', 1)
p.write_text(s, encoding='utf-8')

# Loader v2 is patched with the implementation commit by the workflow.
p = Path('probes/cliphub_content_tags_settings_probe_045.js')
s = p.read_text(encoding='utf-8')
s = s.replace('User-Agent", "ClipHub-Probe/045-v1"',
              'User-Agent", "ClipHub-Probe/045-v2"', 1)
s = s.replace('source.indexOf("probeVersion: 1") < 0',
              'source.indexOf("probeVersion: 2") < 0', 1)
s = s.replace('source.indexOf("REQUIRED_SET = \\"20260723.01\\"") < 0',
              'source.indexOf("REQUIRED_SET = \\"20260723.02\\"") < 0', 1)
s = s.replace('source.indexOf("translationModuleVersion === 5") < 0',
              'source.indexOf("translationModuleVersion === 6") < 0', 1)
s = s.replace('source.indexOf("cliphub_content_tags_settings_probe_045") < 0)',
              'source.indexOf("performLoadMoreClick") < 0 ||\n                source.indexOf("translationPopupReady") < 0 ||\n                source.indexOf("cliphub_content_tags_settings_probe_045") < 0)', 1)
s = s.replace('//# sourceURL=ClipHub/probe_045_impl_v1.js',
              '//# sourceURL=ClipHub/probe_045_impl_v2.js', 1)
p.write_text(s, encoding='utf-8')

# Update manifest after module patches.
p = Path('module-manifest.json')
data = json.loads(p.read_text(encoding='utf-8'))
if data.get('schemaVersion') != 1 or data.get('entryMinVersion') != 4:
    raise SystemExit('Manifest compatibility changed')
if len(data.get('modules', [])) != 15:
    raise SystemExit('Manifest module count changed')
data['moduleSetVersion'] = '20260723.02'
for module in data['modules']:
    if module['name'] in ('ch_11_filter.js', 'ch_12_translation.js'):
        module['sha'] = git_hash(module['path'])
p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n',
             encoding='utf-8')

Path('docs/阶段3D2-4问题修复说明.md').write_text('''# 阶段 3D2-4 问题修复

模块集：`20260723.02`。

## 翻译入口崩溃

根因是 Translation v5 的翻译结果 WindowManager 构建代码使用了 `Gravity`，但模块未导入 `android.view.Gravity`。异常从 Filter Root 底栏点击回调直接冒泡到 `system_server` 主线程，造成进程崩溃重启。

修复：

- Translation v6 显式导入 `Gravity`；
- Filter v13 对底栏动作和翻译打开链增加异常边界；
- Navigation 的 detail 返回优先关闭翻译结果弹窗；
- 翻译失败只记录状态，不得再导致 `system_server` 重启。

## 首页列表仅八条

根因是 Filter v12 虽然使用了 `ScrollView`，但查询结果又被固定执行 `slice(0, 8)`，因此第九条之后从未进入 View 树，滚动容器也没有更多内容可滚动。

修复：

- 删除八条固定预览限制；
- 每页加载 20 条；
- 列表使用原有垂直 `ScrollView`；
- 底部出现“加载更多”，每次增加 20 条；
- 重新搜索、切换筛选或重置时恢复第一页；
- 置顶、删除和剪贴板事件刷新时保留当前已加载页数。

数据库 schema v2、Navigation v3、唯一 Filter Root、后台剪贴板监听和运行锁生命周期均保持不变。
''', encoding='utf-8')

Path('docs/内容标签翻译设置探测045说明.md').write_text('''# ClipHub 内容、标签、翻译设置探测 045

探测版本：`v2`。模块集：`20260723.02`。

在原有内容类型停用、标签结构化管理、百度/有道独立 SQLite 配置、设置页返回层级、schema v2 和 Navigation v3 边界之外，新增验证：

- 首页首批加载 20 条，超过首批的数据可滚动；
- “加载更多”后显示全部 28 条测试记录；
- 长按记录后点击“翻译”可打开独立结果弹窗；
- 翻译配置无效时只显示失败状态，不得导致 `system_server` 崩溃重启；
- 翻译弹窗关闭后仍返回唯一 Filter Root。

截图：

1. 无内容类型、显示标签且已完成分页验证的唯一首页；
2. 翻译设置；
3. 标签管理。

加载器固定读取实现提交：

```text
__IMPLEMENTATION_COMMIT__
```
''', encoding='utf-8')
