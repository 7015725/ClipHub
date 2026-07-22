#!/usr/bin/env bash
set -euo pipefail

BRANCH="agent/initialize-project-skeleton"
HELPER_DIR=".github/cliphub-home-filter-exclusive"
WORKFLOW_PATH=".github/workflows/cliphub-home-filter-exclusive.yml"

if [ "$(git hash-object src/ch_09_list.js)" != "08170700c935fc01242f3080e603290856b927e9" ]; then
  echo "Unexpected ch_09_list.js base" >&2
  exit 1
fi
if [ "$(git hash-object src/ch_11_filter.js)" != "d8c1cb0987f2ceef1d13f2d01bc056e5f9825b80" ]; then
  echo "Unexpected ch_11_filter.js base" >&2
  exit 1
fi
if [ "$(git hash-object src/ch_15_app.js)" != "470c3173ceeaed2ae293d640fd81d4be28ee5183" ]; then
  echo "Unexpected ch_15_app.js base" >&2
  exit 1
fi
if [ "$(git hash-object module-manifest.json)" != "86836e2feb3cb25007dbc9cf29f09212997bfa4a" ]; then
  echo "Unexpected module-manifest.json base" >&2
  exit 1
fi
if [ "$(git hash-object docs/开发计划.md)" != "2bd461da7e75813aa8dbeaf2a6056960b6876dd7" ]; then
  echo "Unexpected development plan base" >&2
  exit 1
fi

python3 - <<'PYLIST'
from pathlib import Path

path = Path('src/ch_09_list.js')
text = path.read_text(encoding='utf-8')

replacements = [
    (
'''    var selectionMode = false;
    var eventBindings = [];

    var detailWindowManager = null;''',
'''    var selectionMode = false;
    var eventBindings = [];
    var filterPanelSuspended = false;

    var detailWindowManager = null;'''
    ),
    (
'''        filterOpenCount: 0,
        detailOpenCount: 0,''',
'''        filterOpenCount: 0,
        filterPanelHideCount: 0,
        filterPanelRestoreCount: 0,
        filterPanelCancelCount: 0,
        detailOpenCount: 0,'''
    ),
    (
'''        lastDetailAction: null,
        homeStyle: "reference_home_v2",''',
'''        lastDetailAction: null,
        lastFilterPanelAction: null,
        homeStyle: "reference_home_v2",'''
    ),
    (
'''    function openFilterPanel() {
        var thread = Thread.currentThread();
        try {
            state.filterOpenCount += 1;
            state.filterThreadId = Number(thread.getId());
            state.filterThreadName = String(thread.getName());
            ClipHub.Filter.showPanel({ requestKeyboard: true });
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }
''',
'''    function suspendForFilterPanel() {
        var shouldSuspend;
        if (filterPanelSuspended) { return true; }
        shouldSuspend = visible && ClipHub.Window &&
            ClipHub.Window.isAttached();
        filterPanelSuspended = shouldSuspend;
        if (!shouldSuspend) {
            state.lastFilterPanelAction = "open_without_home";
            return false;
        }
        ClipHub.Window.close();
        state.filterPanelHideCount += 1;
        state.lastFilterPanelAction = "home_suspended";
        return true;
    }

    function finishFilterPanel(options) {
        var shouldRestore;
        options = options || {};
        shouldRestore = filterPanelSuspended &&
            options.restore !== false && visible;
        filterPanelSuspended = false;
        if (!shouldRestore) {
            if (options.restore === false) {
                state.filterPanelCancelCount += 1;
                state.lastFilterPanelAction = "restore_cancelled";
            } else {
                state.lastFilterPanelAction = "restore_not_required";
            }
            return false;
        }
        try {
            ClipHub.Window.open({
                widthDp: Number(lastShowOptions.widthDp || 390),
                heightDp: Number(lastShowOptions.heightDp || 720),
                statusText: "正在加载剪贴板历史",
                dimAmount: 0.44
            });
            refresh(false);
            state.filterPanelRestoreCount += 1;
            state.lastFilterPanelAction = String(
                options.reason || "filter_closed");
            return true;
        } catch (error) {
            state.lastError = String(error);
            state.lastFilterPanelAction = "restore_failed";
            return false;
        }
    }

    function openFilterPanel() {
        var thread = Thread.currentThread();
        try {
            state.filterOpenCount += 1;
            state.filterThreadId = Number(thread.getId());
            state.filterThreadName = String(thread.getName());
            ClipHub.Filter.showPanel({ requestKeyboard: true });
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }
'''
    ),
    (
'''            filterOpenCount: Number(state.filterOpenCount),
            detailOpenCount: Number(state.detailOpenCount),''',
'''            filterOpenCount: Number(state.filterOpenCount),
            filterPanelSuspended: filterPanelSuspended === true,
            filterPanelHideCount:
                Number(state.filterPanelHideCount),
            filterPanelRestoreCount:
                Number(state.filterPanelRestoreCount),
            filterPanelCancelCount:
                Number(state.filterPanelCancelCount),
            lastFilterPanelAction: state.lastFilterPanelAction,
            detailOpenCount: Number(state.detailOpenCount),'''
    ),
    (
'''        state.filterOpenCount = 0;
        state.detailOpenCount = 0;''',
'''        state.filterOpenCount = 0;
        state.filterPanelHideCount = 0;
        state.filterPanelRestoreCount = 0;
        state.filterPanelCancelCount = 0;
        state.lastFilterPanelAction = null;
        state.detailOpenCount = 0;'''
    ),
    (
'''            selectionMode = false;
            visible = false;
            eventBindings = [];''',
'''            selectionMode = false;
            visible = false;
            filterPanelSuspended = false;
            eventBindings = [];'''
    ),
    (
'''        hide: function (closeWindow) {
            visible = false;
            selectionMode = false;''',
'''        hide: function (closeWindow) {
            visible = false;
            filterPanelSuspended = false;
            selectionMode = false;'''
    ),
    (
'''        setItems: function (value) {''',
'''        suspendForFilterPanel: suspendForFilterPanel,

        finishFilterPanel: finishFilterPanel,

        setItems: function (value) {'''
    ),
    (
'''            selectionMode = false;
            visible = false;
            ready = false;''',
'''            selectionMode = false;
            visible = false;
            filterPanelSuspended = false;
            ready = false;'''
    ),
    (
'''        MODULE_VERSION: 11,''',
'''        MODULE_VERSION: 12,'''
    )
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit('List replacement expected one match, got %d:\n%s' %
                         (count, old))
    text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
PYLIST

python3 - <<'PYFILTER'
from pathlib import Path

path = Path('src/ch_11_filter.js')
text = path.read_text(encoding='utf-8')

replacements = [
    (
'''    var suppressTextWatcher = false;
    var searchGeneration = 0;

    var state = {''',
'''    var suppressTextWatcher = false;
    var searchGeneration = 0;
    var restoreListOnClose = false;

    var state = {'''
    ),
    (
'''        backLayerCloseCount: 0,
        lastBackLayer: "",
        repositorySortUnchanged: true,''',
'''        backLayerCloseCount: 0,
        lastBackLayer: "",
        homeWindowSuspended: false,
        homeSuspendCount: 0,
        homeRestoreCount: 0,
        homeRestoreCancelCount: 0,
        exclusiveHomeFilter: true,
        repositorySortUnchanged: true,'''
    ),
    (
'''                onClick: function () { closePanel(); }''',
'''                onClick: function () {
                    closePanel({ reason: "button" });
                }'''
    ),
    (
'''        state.lastBackLayer = "search_panel";
        closePanel();
        return true;''',
'''        state.lastBackLayer = "search_panel";
        closePanel({ reason: "back" });
        return true;'''
    ),
    (
'''            backLayerCloseCount: Number(state.backLayerCloseCount),
            lastBackLayer: state.lastBackLayer,
            panelWindowType: state.panelWindowType,''',
'''            backLayerCloseCount: Number(state.backLayerCloseCount),
            lastBackLayer: state.lastBackLayer,
            homeWindowSuspended: state.homeWindowSuspended === true,
            homeSuspendCount: Number(state.homeSuspendCount),
            homeRestoreCount: Number(state.homeRestoreCount),
            homeRestoreCancelCount:
                Number(state.homeRestoreCancelCount),
            exclusiveHomeFilter: state.exclusiveHomeFilter === true,
            panelWindowType: state.panelWindowType,'''
    ),
    (
'''        state.backLayerCloseCount = 0;
        state.lastBackLayer = "";
        state.repositorySortUnchanged = true;''',
'''        state.backLayerCloseCount = 0;
        state.lastBackLayer = "";
        state.homeWindowSuspended = false;
        state.homeSuspendCount = 0;
        state.homeRestoreCount = 0;
        state.homeRestoreCancelCount = 0;
        state.exclusiveHomeFilter = true;
        state.repositorySortUnchanged = true;'''
    ),
    (
'''            searchGeneration = 0;
            resetState();''',
'''            searchGeneration = 0;
            restoreListOnClose = false;
            resetState();'''
    ),
    (
'''                closePanel();
            } catch (ignoredClose) {}''',
'''                closePanel({
                    restoreList: false,
                    reason: "shutdown"
                });
            } catch (ignoredClose) {}'''
    ),
    (
'''        MODULE_VERSION: 9,''',
'''        MODULE_VERSION: 10,'''
    )
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit('Filter replacement expected one match, got %d:\n%s' %
                         (count, old))
    text = text.replace(old, new, 1)

show_start = text.index('    function showPanel(options) {')
close_start = text.index('    function closePanel()', show_start)
handle_start = text.index('    function handleBack()', close_start)

new_show = r'''    function suspendHomeWindow() {
        var suspended = false;
        if (ClipHub.List &&
                typeof ClipHub.List.suspendForFilterPanel === "function") {
            suspended = ClipHub.List.suspendForFilterPanel() === true;
        }
        restoreListOnClose = suspended;
        state.homeWindowSuspended = suspended;
        if (suspended) { state.homeSuspendCount += 1; }
        return suspended;
    }

    function finishHomeWindow(options) {
        var restored = false;
        var shouldRestore;
        options = options || {};
        shouldRestore = restoreListOnClose &&
            options.restoreList !== false;
        if (ClipHub.List &&
                typeof ClipHub.List.finishFilterPanel === "function") {
            restored = ClipHub.List.finishFilterPanel({
                restore: shouldRestore,
                reason: String(options.reason || "filter_closed")
            }) === true;
        }
        if (restored) {
            state.homeRestoreCount += 1;
        } else if (restoreListOnClose && !shouldRestore) {
            state.homeRestoreCancelCount += 1;
        }
        restoreListOnClose = false;
        state.homeWindowSuspended = false;
        return restored;
    }

    function showPanel(options) {
        var result;
        options = options || {};
        if (!ready) {
            throw new Error("ClipHub filter is not ready");
        }
        loadHistory();
        advancedVisible = options.showAdvanced === true;
        state.advancedDrawerVisible = advancedVisible;
        if (state.panelAttached) {
            requireMain(runOnMainSync(function () {
                buildPanelContent(options.requestKeyboard === true);
                return true;
            }, 2500));
            return {
                ok: true,
                attached: true,
                reused: true,
                state: getPanelState()
            };
        }
        suspendHomeWindow();
        try {
            result = requireMain(runOnMainSync(function () {
                var size = panelDimensions();
                var type = Build.VERSION.SDK_INT >= 26 ?
                    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY :
                    WindowManager.LayoutParams.TYPE_SYSTEM_ALERT;
                var thread = nowThread();
                var colors = palette();
                panelRoot = new LinearLayout(appContext);
                panelRoot.setOrientation(LinearLayout.VERTICAL);
                panelRoot.setPadding(dp(12), dp(8), dp(12), dp(10));
                panelRoot.setBackground(roundedBackground(colors.surface,
                    colors.stroke, 24));
                if (Build.VERSION.SDK_INT >= 21) {
                    panelRoot.setElevation(dp(20));
                }
                panelParams = new WindowManager.LayoutParams(
                    size.width, size.height, type,
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
                        WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED |
                        WindowManager.LayoutParams.FLAG_DIM_BEHIND,
                    PixelFormat.TRANSLUCENT);
                panelParams.gravity = Gravity.BOTTOM |
                    Gravity.CENTER_HORIZONTAL;
                panelParams.y = dp(10);
                panelParams.dimAmount = 0.44;
                panelParams.softInputMode =
                    WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE |
                    WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE;
                try {
                    panelParams.setTitle("ClipHub Filter Panel");
                } catch (ignoredTitle) {}
                windowManager.addView(panelRoot, panelParams);
                state.panelAttached = true;
                state.panelOpenCount += 1;
                state.panelWindowType = Number(type);
                state.panelFlags = Number(panelParams.flags);
                state.panelWidthPx = size.width;
                state.panelHeightPx = size.height;
                state.panelWidthDp = size.widthDp;
                state.panelHeightDp = size.heightDp;
                state.dimAmount = Number(panelParams.dimAmount);
                state.modalWindow = true;
                state.opaqueBackground = true;
                state.panelAddThreadId = thread.id;
                state.panelAddThreadName = thread.name;
                state.lastError = null;
                try {
                    previewRows = ClipHub.Repository.listItems(
                        toQueryOptions({ limit: RESULT_LIMIT, offset: 0 }));
                    previewRows = sortRows(previewRows);
                    state.lastResultCount = previewRows.length;
                    previewRows = previewRows.slice(0, PREVIEW_LIMIT);
                } catch (previewError) {
                    state.lastError = String(previewError);
                    previewRows = [];
                }
                buildPanelContent(options.requestKeyboard !== false);
                return {
                    ok: true,
                    attached: true,
                    reused: false,
                    state: getPanelState()
                };
            }, 3000));
            return result;
        } catch (error) {
            finishHomeWindow({
                restoreList: true,
                reason: "show_failed"
            });
            throw error;
        }
    }

'''

new_close = r'''    function closePanel(options) {
        var result;
        options = options || {};
        if (!state.panelAttached && panelRoot === null) {
            finishHomeWindow(options);
            return {
                ok: true,
                attached: false,
                alreadyClosed: true,
                state: getPanelState()
            };
        }
        result = requireMain(runOnMainSync(function () {
            var thread = nowThread();
            try {
                hideKeyboardOnMain();
                if (panelRoot !== null) {
                    try {
                        windowManager.removeViewImmediate(panelRoot);
                    } catch (error) {
                        if (panelRoot.isAttachedToWindow()) {
                            throw error;
                        }
                    }
                }
                state.panelCloseCount += 1;
                state.panelRemoveThreadId = thread.id;
                state.panelRemoveThreadName = thread.name;
                state.lastError = null;
                return true;
            } finally {
                searchGeneration += 1;
                state.panelAttached = false;
                state.inputFocused = false;
                advancedVisible = false;
                state.advancedDrawerVisible = false;
                panelRoot = null;
                panelParams = null;
                keywordInput = null;
                advancedKeywordInput = null;
                searchView = null;
                resetView = null;
                closeView = null;
                advancedView = null;
                applyView = null;
                clearHistoryView = null;
                resultContainer = null;
                resultCountView = null;
                drawerContainer = null;
                drawerScrollView = null;
                drawerContentView = null;
                drawerFooterView = null;
                sourceViews = {};
                typeViews = {};
                tagViews = {};
                pinnedViews = {};
                sensitiveViews = {};
                sortViews = {};
                historyViews = [];
            }
        }, 3000));
        finishHomeWindow(options);
        return {
            ok: result === true,
            attached: false,
            alreadyClosed: false,
            state: getPanelState()
        };
    }

'''

text = text[:show_start] + new_show + new_close + text[handle_start:]
path.write_text(text, encoding='utf-8')
PYFILTER

python3 - <<'PYAPP'
from pathlib import Path

path = Path('src/ch_15_app.js')
text = path.read_text(encoding='utf-8')

replacements = [
    (
'''        return {
            started: state.started === true,
            uiVisible: windowAttached || detailAttached || editorAttached ||
                filterAttached,
            listVisible: list.visible === true,
            windowAttached: windowAttached,
            detailAttached: detailAttached,
            editorAttached: editorAttached,
            filterAttached: filterAttached,
            itemCount: Number(list.itemCount || 0),''',
'''        return {
            started: state.started === true,
            uiVisible: windowAttached || detailAttached || editorAttached ||
                filterAttached,
            listVisible: list.visible === true,
            windowAttached: windowAttached,
            detailAttached: detailAttached,
            editorAttached: editorAttached,
            filterAttached: filterAttached,
            homeFilterAttachedCount:
                (windowAttached ? 1 : 0) + (filterAttached ? 1 : 0),
            homeFilterExclusive:
                ((windowAttached ? 1 : 0) +
                    (filterAttached ? 1 : 0)) <= 1,
            itemCount: Number(list.itemCount || 0),'''
    ),
    (
'''                ClipHub.Filter.closePanel();''',
'''                ClipHub.Filter.closePanel({
                    restoreList: false,
                    reason: "app_hide"
                });'''
    ),
    (
'''        MODULE_VERSION: 5,''',
'''        MODULE_VERSION: 6,'''
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

python3 - <<'PYDOC'
from pathlib import Path

path = Path('docs/开发计划.md')
text = path.read_text(encoding='utf-8')
text = text.replace(
'''- [x] 新增探测 042
- [ ] 运行探测 042 并回传三张未裁剪截图与完整 JSON
- [ ] 确认新增 / 编辑页输入法与两层返回最终基线

当前边界：本轮只处理输入法隐藏后的 Editor 焦点交接，不修改 Navigation v3，不新增自定义返回层，不改变 WindowManager 避让尺寸或 Repository 保存语义。''',
'''- [x] 新增探测 042
- [x] 探测 042：输入法避让、长文本、焦点交接和两层返回全部通过
- [x] 确认新增 / 编辑页输入法与两层返回最终基线

当前边界：Editor v8 已收口；Navigation v3、WindowManager 避让尺寸和 Repository 保存语义保持不变。''', 1)

marker = '''#### 后续页面
'''
insert = '''#### 3D2 页面栈热修：主页与搜索页重复窗口

- [x] 真机视频确认点击“筛选”后同时保留主页 Window 和 Filter Window
- [x] 根因：`List.openFilterPanel()` 直接新增 Filter Overlay，主页 `ClipHub.Window` 未关闭
- [x] 搜索页本身包含完整结果列表，形成两个“首页列表”窗口层
- [x] 完成 List v12：打开 Filter 前挂起主页窗口，关闭 Filter 后按原尺寸恢复主页
- [x] 完成 Filter v10：统一管理主页挂起 / 恢复，系统返回和关闭按钮均恢复主页
- [x] 完成 App v6：全局 hide / toggle 关闭 Filter 时禁止瞬时恢复主页
- [x] 增加 `homeFilterAttachedCount` 与 `homeFilterExclusive` 运行态状态
- [x] 保持 Filter 搜索语义、Repository、Navigation v3 和后台生命周期不变
- [x] 发布模块集 `20260722.36`
- [x] 新增主页 / 搜索页单窗口探测 043
- [ ] 运行探测 043 并回传三张未裁剪截图与完整 JSON

当前边界：主页与搜索页采用互斥 WindowManager Root；Editor 等模态子页的既有叠层关系不变。

'''
if marker not in text:
    raise SystemExit('Development plan marker missing')
text = text.replace(marker, insert + marker, 1)
text = text.replace('moduleSetVersion=20260722.35',
                    'moduleSetVersion=20260722.36', 1)
text = text.replace('List=11', 'List=12', 1)
text = text.replace('Filter=9', 'Filter=10', 1)
text = text.replace('RecentsWatch=1\n```',
                    'RecentsWatch=1\nApp=6\n```', 1)
start = text.index('## 下一步\n')
end = text.index('\n### 后续阶段 3E：入口版本 5', start)
next_text = '''## 下一步

### 运行主页 / 搜索页单窗口探测 043

1. 在 Termux 同步 `agent/initialize-project-skeleton`；
2. 运行 `ClipHub.js`，确认模块集为 `.36`；
3. 运行 `ClipHub 主页搜索单窗口探测043`；
4. 场景 1 截取普通主页；
5. 场景 2 截取搜索 / 筛选页，确认背后没有第二个主页窗口；
6. 场景 3 截取返回后的主页；
7. 回传三张未裁剪截图与完整 JSON；
8. 检查搜索页显示时 `windowAttached=false`、`filterAttached=true`；
9. 检查返回主页时 `windowAttached=true`、`filterAttached=false`；
10. 检查 hide / show 循环中 `homeFilterAttachedCount` 始终不超过 1。'''
text = text[:start] + next_text + text[end:]
path.write_text(text, encoding='utf-8')
PYDOC

list_sha="$(git hash-object src/ch_09_list.js)"
filter_sha="$(git hash-object src/ch_11_filter.js)"
app_sha="$(git hash-object src/ch_15_app.js)"
python3 - "$list_sha" "$filter_sha" "$app_sha" <<'PYMANIFEST'
from pathlib import Path
import json
import sys

path = Path('module-manifest.json')
data = json.loads(path.read_text(encoding='utf-8'))
if data.get('schemaVersion') != 1 or data.get('entryMinVersion') != 4:
    raise SystemExit('Manifest schema or entry version changed')
if len(data.get('modules', [])) != 15:
    raise SystemExit('Manifest module count changed')
data['moduleSetVersion'] = '20260722.36'
updates = {
    'ch_09_list.js': sys.argv[1],
    'ch_11_filter.js': sys.argv[2],
    'ch_15_app.js': sys.argv[3]
}
for item in data['modules']:
    if item.get('name') in updates:
        item['sha'] = updates[item['name']]
if set(updates) != set(item['name'] for item in data['modules']
                       if item['name'] in updates):
    raise SystemExit('One or more modules missing from manifest')
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n',
                encoding='utf-8')
PYMANIFEST

python3 - <<'PYPROBE'
from pathlib import Path

source_path = Path('probes/cliphub_search_filter_ui_probe_038_impl.js')
source = source_path.read_text(encoding='utf-8')
prefix = source[:source.index('    function main() {')]
suffix_start = source.index('    try {\n        global.ClipHubSearchFilterUiProbe038Result',
                            source.index('    function main() {'))
suffix = source[suffix_start:]
suffix = suffix.replace('ClipHubSearchFilterUiProbe038Result',
                        'ClipHubHomeFilterExclusiveProbe043Result')
suffix = suffix.replace('cliphub_search_filter_ui_probe_038',
                        'cliphub_home_filter_exclusive_probe_043')
suffix = suffix.replace('Probe038', 'Probe043')
suffix = suffix.replace('probe_038', 'probe_043')

prefix = prefix.replace('search and advanced filter visual probe 038',
                        'home and filter exclusive-window probe 043')
prefix = prefix.replace('20260722.31', '20260722.36')
prefix = prefix.replace('ClipHubProbe038', 'ClipHubProbe043')
prefix = prefix.replace('com.cliphub.probe038', 'com.cliphub.probe043')

main = r'''    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var formal = new File(root, "ClipHub");
        var modules = new File(formal, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var outputFile = new File(ensureDir(new File(formal, "probes")),
            "cliphub_home_filter_exclusive_probe_043_" +
                stamp(startedAt) + ".json");
        var local = localManifest(formal);
        var formalWasRunning = !lockFree(formal);
        var result = {
            ok: false,
            probe: "cliphub_home_filter_exclusive_probe_043",
            probeVersion: 1,
            moduleSetVersion: local.moduleSetVersion || null,
            sourceRef: local.sourceRef || null,
            sceneDurationMs: SCENE_DURATION_MS,
            sceneCount: 3,
            visualScreenshotRequired: true,
            instruction: "场景1截普通主页；场景2截搜索筛选页；场景3截返回后的主页。三张截图均不得裁剪。",
            outputPath: String(outputFile.getAbsolutePath()),
            formalWasRunning: formalWasRunning,
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
            add("ClipHub 主页单窗口测试 1", "text",
                "com.cliphub.probe043", "探测来源", false, false,
                startedAt - 3000);
            add("https://developer.android.com/ ClipHub 主页单窗口测试",
                "url", "com.android.chrome", "Chrome 浏览器",
                false, true, startedAt - 2000);
            add("ClipHub 主页单窗口测试 3", "text",
                "com.termux", "Termux", false, false,
                startedAt - 1000);

            result.homeShow = global.ClipHub.List.show({
                limit: 20, widthDp: 340, heightDp: 560
            });
            result.homeReady = waitFor(function () {
                var app = global.ClipHub.App.getStatus();
                var list = global.ClipHub.List.getState();
                return app.windowAttached === true &&
                    app.filterAttached === false &&
                    app.homeFilterAttachedCount === 1 &&
                    app.homeFilterExclusive === true &&
                    list.windowAttached === true;
            }, 1500);
            result.homeScene = {
                app: global.ClipHub.App.getStatus(),
                list: global.ClipHub.List.getState(),
                filter: global.ClipHub.Filter.getPanelState()
            };
            showToast("043  1/3  普通主页  ·  请截完整页面");
            Thread.sleep(SCENE_DURATION_MS);

            result.panelShow = global.ClipHub.Filter.showPanel({
                requestKeyboard: false,
                showAdvanced: false
            });
            result.filterReady = waitFor(function () {
                var app = global.ClipHub.App.getStatus();
                var list = global.ClipHub.List.getState();
                var panel = global.ClipHub.Filter.getPanelState();
                return app.windowAttached === false &&
                    app.filterAttached === true &&
                    app.homeFilterAttachedCount === 1 &&
                    app.homeFilterExclusive === true &&
                    list.filterPanelSuspended === true &&
                    list.filterPanelHideCount === 1 &&
                    panel.homeWindowSuspended === true &&
                    panel.exclusiveHomeFilter === true;
            }, 1800);
            result.filterScene = {
                app: global.ClipHub.App.getStatus(),
                list: global.ClipHub.List.getState(),
                filter: global.ClipHub.Filter.getState()
            };
            showToast("043  2/3  搜索筛选页  ·  背后不得存在第二主页");
            Thread.sleep(SCENE_DURATION_MS);

            result.filterBack = global.ClipHub.Navigation
                .dispatchBackForOwner("filter", "probe_home_filter_back_043");
            result.restoreReady = waitFor(function () {
                var app = global.ClipHub.App.getStatus();
                var list = global.ClipHub.List.getState();
                return app.windowAttached === true &&
                    app.filterAttached === false &&
                    app.homeFilterAttachedCount === 1 &&
                    app.homeFilterExclusive === true &&
                    list.filterPanelSuspended === false &&
                    list.filterPanelRestoreCount >= 1;
            }, 1800);
            result.restoreScene = {
                app: global.ClipHub.App.getStatus(),
                list: global.ClipHub.List.getState(),
                filter: global.ClipHub.Filter.getState(),
                navigation: global.ClipHub.Navigation.getState()
            };
            showToast("043  3/3  返回主页  ·  请截完整页面");
            Thread.sleep(SCENE_DURATION_MS);

            result.reopenFilter = global.ClipHub.Filter.showPanel({
                requestKeyboard: false,
                showAdvanced: false
            });
            result.hideCommand = global.ClipHub.App
                .executeControlCommand("hide");
            result.hideReady = waitFor(function () {
                var app = global.ClipHub.App.getStatus();
                return app.windowAttached === false &&
                    app.filterAttached === false &&
                    app.homeFilterAttachedCount === 0;
            }, 1500);
            result.showCommand = global.ClipHub.App
                .executeControlCommand("show");
            result.showReady = waitFor(function () {
                var app = global.ClipHub.App.getStatus();
                return app.windowAttached === true &&
                    app.filterAttached === false &&
                    app.homeFilterAttachedCount === 1 &&
                    app.homeFilterExclusive === true;
            }, 1500);
            result.finalUiState = {
                app: global.ClipHub.App.getStatus(),
                list: global.ClipHub.List.getState(),
                filter: global.ClipHub.Filter.getPanelState()
            };
            result.listClose = global.ClipHub.List.hide(true);
            result.stop = global.ClipHub.App.stop(
                "probe043_home_filter_exclusive");
            result.databaseClosed = !global.ClipHub.Database.isOpen();
            result.lockReleased = lockFree(isolated);
        } catch (error) {
            result.error = errorText(error);
            try { global.ClipHub.App.stop("probe043_error"); }
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
                result.filterModuleVersion === 10 &&
                result.appModuleVersion === 6 &&
                result.navigationModuleVersion === 3 &&
                result.clipboardListenerStopped === true &&
                result.homeReady === true &&
                result.homeScene.app.homeFilterAttachedCount === 1 &&
                result.filterReady === true &&
                result.filterScene.app.windowAttached === false &&
                result.filterScene.app.filterAttached === true &&
                result.filterScene.app.homeFilterAttachedCount === 1 &&
                result.filterScene.list.filterPanelSuspended === true &&
                result.filterBack === true &&
                result.restoreReady === true &&
                result.restoreScene.app.windowAttached === true &&
                result.restoreScene.app.filterAttached === false &&
                result.restoreScene.list.filterPanelRestoreCount >= 1 &&
                result.hideCommand && result.hideCommand.ok === true &&
                result.hideReady === true &&
                result.showCommand && result.showCommand.ok === true &&
                result.showReady === true &&
                result.finalUiState.app.homeFilterAttachedCount === 1 &&
                result.listClose === true &&
                result.stop && result.stop.stopped === true &&
                result.databaseClosed === true &&
                result.lockReleased === true &&
                result.formalRestart && result.formalRestart.ok === true &&
                result.cleanup === true;
            write(outputFile, JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

'''

out = prefix + main + suffix
out = out.replace('cliphub_search_filter_ui_probe_038',
                  'cliphub_home_filter_exclusive_probe_043')
out = out.replace('ClipHubSearchFilterUiProbe038Result',
                  'ClipHubHomeFilterExclusiveProbe043Result')
out = out.replace('038', '043')
Path('probes/cliphub_home_filter_exclusive_probe_043_impl.js')\
    .write_text(out, encoding='utf-8')
PYPROBE

python3 - <<'PYCHECK'
from pathlib import Path
import json
import re

files = [
    'src/ch_09_list.js',
    'src/ch_11_filter.js',
    'src/ch_15_app.js',
    'probes/cliphub_home_filter_exclusive_probe_043_impl.js'
]
for name in files:
    text = Path(name).read_text(encoding='utf-8')
    forbidden = []
    if re.search(r'\b(?:let|const)\s+', text): forbidden.append('let/const')
    if '=>' in text: forbidden.append('arrow')
    if '`' in text: forbidden.append('template literal')
    if re.search(r'\bclass\s+[A-Za-z_$]', text): forbidden.append('class')
    if forbidden:
        raise SystemExit(name + ': forbidden ES6: ' + ', '.join(forbidden))

list_text = Path('src/ch_09_list.js').read_text(encoding='utf-8')
filter_text = Path('src/ch_11_filter.js').read_text(encoding='utf-8')
app_text = Path('src/ch_15_app.js').read_text(encoding='utf-8')
assert 'MODULE_VERSION: 12' in list_text
assert 'suspendForFilterPanel' in list_text
assert 'finishFilterPanel' in list_text
assert 'filterPanelSuspended' in list_text
assert 'MODULE_VERSION: 10' in filter_text
assert 'suspendHomeWindow' in filter_text
assert 'finishHomeWindow' in filter_text
assert 'closePanel({ reason: "back" })' in filter_text
assert 'MODULE_VERSION: 6' in app_text
assert 'homeFilterAttachedCount' in app_text
assert 'restoreList: false' in app_text

manifest = json.loads(Path('module-manifest.json').read_text(encoding='utf-8'))
assert manifest['moduleSetVersion'] == '20260722.36'
assert manifest['entryMinVersion'] == 4
assert len(manifest['modules']) == 15

probe = Path('probes/cliphub_home_filter_exclusive_probe_043_impl.js')\
    .read_text(encoding='utf-8')
assert 'REQUIRED_SET = "20260722.36"' in probe
assert 'listModuleVersion === 12' in probe
assert 'filterModuleVersion === 10' in probe
assert 'appModuleVersion === 6' in probe
assert 'homeFilterAttachedCount' in probe
assert 'filterPanelSuspended' in probe
PYCHECK

node --check src/ch_09_list.js
node --check src/ch_11_filter.js
node --check src/ch_15_app.js
node --check probes/cliphub_home_filter_exclusive_probe_043_impl.js
if [ -f scripts/check_es5.py ]; then python3 scripts/check_es5.py; fi
git diff --check

git config user.name "ClipHub Automation"
git config user.email "actions@github.com"
git add src/ch_09_list.js src/ch_11_filter.js src/ch_15_app.js \
  module-manifest.json docs/开发计划.md \
  probes/cliphub_home_filter_exclusive_probe_043_impl.js
git commit -m "fix: keep home and filter windows exclusive"
implementation_commit="$(git rev-parse HEAD)"

cat > probes/cliphub_home_filter_exclusive_probe_043.js <<EOF
/* ClipHub home and filter exclusive-window probe 043 loader. Rhino ES5 only. */
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
        "cliphub_home_filter_exclusive_probe_043_impl.js" +
        "?_=" + Number(System.currentTimeMillis());

    try {
        connection = new URL(target).openConnection();
        connection.setUseCaches(false);
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(20000);
        connection.setRequestProperty("Cache-Control", "no-cache, no-store");
        connection.setRequestProperty("Pragma", "no-cache");
        connection.setRequestProperty("User-Agent", "ClipHub-Probe/043-v1");
        input = connection.getInputStream();
        reader = new BR(new ISR(input, "UTF-8"));
        while ((line = reader.readLine()) !== null) {
            builder.append(line).append("\n");
        }
        source = String(builder.toString());
        if (!source) {
            throw new Error("Probe 043 implementation is empty");
        }
        if (source.indexOf("probeVersion: 1") < 0 ||
                source.indexOf("REQUIRED_SET = \"20260722.36\"") < 0 ||
                source.indexOf("listModuleVersion === 12") < 0 ||
                source.indexOf("filterModuleVersion === 10") < 0 ||
                source.indexOf("appModuleVersion === 6") < 0 ||
                source.indexOf("cliphub_home_filter_exclusive_probe_043") < 0 ||
                source.indexOf("homeFilterAttachedCount") < 0 ||
                source.indexOf("filterPanelSuspended") < 0 ||
                source.indexOf("restoreReady") < 0) {
            throw new Error("Probe 043 implementation validation failed");
        }
        eval(source + "\n//# sourceURL=ClipHub/probe_043_impl_v1.js");
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

JSON.stringify(ClipHubHomeFilterExclusiveProbe043Result);
EOF

cat > docs/主页搜索单窗口探测043说明.md <<EOF
# ClipHub 主页 / 搜索页单窗口探测 043

## 目标

验证点击主页“筛选”时，主页 WindowManager Root 会先被挂起，只保留搜索 / 筛选页一个窗口；关闭搜索页后再恢复主页，避免出现两个首页列表。

## 模块集

\`\`\`text
moduleSetVersion=20260722.36
entryVersion=4
databaseSchemaVersion=2
List=12
Filter=10
App=6
Navigation=3
\`\`\`

## 根因

旧实现由 List 主页窗口和 Filter 搜索窗口同时附着。Filter 页面本身又包含完整结果列表，因此视觉上出现两个首页列表。

## 修复边界

- 主页和搜索页采用互斥 WindowManager Root；
- 打开搜索页前关闭主页 Window，但保留 List 数据状态；
- 关闭搜索页后按原尺寸恢复主页并刷新当前筛选结果；
- App 的 hide / toggle 关闭搜索页时禁止瞬时恢复主页；
- 不修改 Repository、Filter 查询语义、Navigation v3 或后台监听生命周期。

## 三个场景

1. 普通主页；
2. 搜索 / 筛选页，背后不得存在第二主页；
3. 系统返回后的主页。

## 探测文件

\`\`\`text
probes/cliphub_home_filter_exclusive_probe_043.js
probes/cliphub_home_filter_exclusive_probe_043_impl.js
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

node --check probes/cliphub_home_filter_exclusive_probe_043.js
node --check probes/cliphub_home_filter_exclusive_probe_043_impl.js
if [ -f scripts/check_es5.py ]; then python3 scripts/check_es5.py; fi
git diff --check

git add probes/cliphub_home_filter_exclusive_probe_043.js \
  docs/主页搜索单窗口探测043说明.md
git rm -r "$HELPER_DIR" "$WORKFLOW_PATH"
git commit -m "test: add home filter exclusive probe 043"
git push origin "HEAD:$BRANCH"
