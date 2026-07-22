#!/usr/bin/env bash
set -euo pipefail

BRANCH="agent/initialize-project-skeleton"
HELPER_DIR=".github/cliphub-stage3d2-2-layout-fit"
WORKFLOW_PATH=".github/workflows/cliphub-stage3d2-2-layout-fit.yml"

if [ "$(git hash-object src/ch_11_filter.js)" != "a9ea00ad8094cf5eb7ddaee3961a89c522cd2d2c" ]; then
  echo "Unexpected ch_11_filter.js base" >&2
  exit 1
fi
if [ "$(git hash-object module-manifest.json)" != "4529bb1106e145cb4057c823684affa0a2cb98e5" ]; then
  echo "Unexpected module-manifest.json base" >&2
  exit 1
fi
if [ "$(git hash-object docs/阶段3D2新UI全量复刻方案.md)" != "1f69d0dd67cf46a9a86adde73fc9076bfd3a592c" ]; then
  echo "Unexpected stage plan base" >&2
  exit 1
fi
if [ "$(git hash-object docs/开发计划.md)" != "5f3a58a2772f7f2ec9a67c943d4871bb54d2b47f" ]; then
  echo "Unexpected development plan base" >&2
  exit 1
fi

python3 - <<'PYFILTER'
from pathlib import Path

path = Path('src/ch_11_filter.js')
text = path.read_text(encoding='utf-8')

replacements = [
    (
'''    var drawerContainer = null;
    var sourceViews = {};''',
'''    var drawerContainer = null;
    var drawerScrollView = null;
    var drawerContentView = null;
    var drawerFooterView = null;
    var sourceViews = {};'''
    ),
    (
'''        drawerContentBottomPaddingDp: 0,
        drawerFooterTopGapDp: 0,
        advancedKeywordInputPresent: false,''',
'''        drawerContentBottomPaddingDp: 0,
        drawerFooterTopGapDp: 0,
        drawerFooterHeightDp: 0,
        advancedChipVerticalPaddingDp: 0,
        drawerMeasured: false,
        drawerContentHeightDp: 0,
        drawerViewportHeightDp: 0,
        drawerScrollYDp: 0,
        drawerCanScrollDownAtTop: false,
        drawerContentFitsViewport: false,
        advancedKeywordInputPresent: false,'''
    ),
    (
'''        searchPageStyle: "reference_search_v2",''',
'''        searchPageStyle: "reference_search_v4",'''
    ),
    (
'''    function pxToDp(valuePx) {
        return Math.round(Number(valuePx) / density);
    }

    function normalizeText(input) {''',
'''    function pxToDp(valuePx) {
        return Math.round(Number(valuePx) / density);
    }

    function updateDrawerMeasurements() {
        var viewportPx = 0;
        var contentPx = 0;
        var footerPx = 0;
        var scrollYPx = 0;
        var measured = false;
        var canScrollDown = false;
        if (!advancedVisible || drawerScrollView === null ||
                drawerContentView === null || drawerFooterView === null) {
            state.drawerMeasured = false;
            state.drawerContentHeightDp = 0;
            state.drawerViewportHeightDp = 0;
            state.drawerScrollYDp = 0;
            state.drawerCanScrollDownAtTop = false;
            state.drawerContentFitsViewport = false;
            state.drawerFooterHeightDp = 0;
            return false;
        }
        try {
            viewportPx = Number(drawerScrollView.getHeight());
            contentPx = Number(drawerContentView.getHeight());
            footerPx = Number(drawerFooterView.getHeight());
            scrollYPx = Number(drawerScrollView.getScrollY());
            measured = viewportPx > 0 && contentPx > 0 && footerPx > 0;
            canScrollDown = measured && scrollYPx === 0 &&
                drawerScrollView.canScrollVertically(1);
        } catch (ignoredMeasure) {
            measured = false;
            canScrollDown = false;
        }
        state.drawerMeasured = measured;
        state.drawerContentHeightDp = measured ? pxToDp(contentPx) : 0;
        state.drawerViewportHeightDp = measured ? pxToDp(viewportPx) : 0;
        state.drawerScrollYDp = measured ? pxToDp(scrollYPx) : 0;
        state.drawerFooterHeightDp = measured ? pxToDp(footerPx) : 0;
        state.drawerCanScrollDownAtTop = canScrollDown;
        state.drawerContentFitsViewport = measured &&
            contentPx <= viewportPx + dp(1);
        return state.drawerContentFitsViewport;
    }

    function normalizeText(input) {'''
    ),
    (
'''    function makeChip(text, selected, colors) {
        var view = makeText(text, 10,
            selected ? colors.accentStrong : colors.textSecondary,
            selected);''',
'''    function makeChip(text, selected, colors, compact) {
        var verticalPaddingDp = compact === true ? 4 : 6;
        var view = makeText(text, 10,
            selected ? colors.accentStrong : colors.textSecondary,
            selected);'''
    ),
    (
'''        view.setPadding(dp(9), dp(6), dp(9), dp(6));
        view.setBackground(roundedBackground(''',
'''        view.setPadding(dp(9), dp(verticalPaddingDp),
            dp(9), dp(verticalPaddingDp));
        if (compact === true) {
            state.advancedChipVerticalPaddingDp = verticalPaddingDp;
        }
        view.setBackground(roundedBackground('''
    ),
    (
'''            chip = makeChip(label, selected, colors);''',
'''            chip = makeChip(label, selected, colors, true);'''
    ),
    (
'''            chip = makeChip(items[index].label,
                String(items[index].key) === String(selectedKey), colors);''',
'''            chip = makeChip(items[index].label,
                String(items[index].key) === String(selectedKey),
                colors, true);'''
    ),
    (
'''        var footer = new LinearLayout(appContext);
        var params;''',
'''        var footer = new LinearLayout(appContext);
        var params;
        drawerScrollView = scroll;
        drawerContentView = content;
        drawerFooterView = footer;'''
    ),
    (
'''        content.setPadding(0, 0, 0, dp(14));
        state.drawerContentBottomPaddingDp = 14;''',
'''        content.setPadding(0, 0, 0, dp(6));
        state.drawerContentBottomPaddingDp = 6;'''
    ),
    (
'''        addChoiceSection(content, "敏感内容", sensitiveRow, 8, colors);''',
'''        addChoiceSection(content, "敏感内容", sensitiveRow, 4, colors);'''
    ),
    (
'''        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(54));
        params.topMargin = dp(6);
        drawer.addView(footer, params);
        state.drawerFooterTopGapDp = 6;''',
'''        drawer.addView(footer, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(48)));
        state.drawerFooterTopGapDp = 0;
        state.drawerFooterHeightDp = 48;'''
    ),
    (
'''        state.drawerContentBottomPaddingDp = 0;
        state.drawerFooterTopGapDp = 0;
        drawerContainer = null;''',
'''        state.drawerContentBottomPaddingDp = 0;
        state.drawerFooterTopGapDp = 0;
        state.drawerFooterHeightDp = 0;
        state.advancedChipVerticalPaddingDp = 0;
        state.drawerMeasured = false;
        state.drawerContentHeightDp = 0;
        state.drawerViewportHeightDp = 0;
        state.drawerScrollYDp = 0;
        state.drawerCanScrollDownAtTop = false;
        state.drawerContentFitsViewport = false;
        drawerContainer = null;
        drawerScrollView = null;
        drawerContentView = null;
        drawerFooterView = null;'''
    ),
    (
'''                drawerContainer = null;
                sourceViews = {};''',
'''                drawerContainer = null;
                drawerScrollView = null;
                drawerContentView = null;
                drawerFooterView = null;
                sourceViews = {};'''
    ),
    (
'''        } catch (ignoredFocus) {}
        return {''',
'''        } catch (ignoredFocus) {}
        updateDrawerMeasurements();
        return {'''
    ),
    (
'''            drawerFooterTopGapDp:
                Number(state.drawerFooterTopGapDp),
            repositorySortUnchanged: true,''',
'''            drawerFooterTopGapDp:
                Number(state.drawerFooterTopGapDp),
            drawerFooterHeightDp:
                Number(state.drawerFooterHeightDp),
            advancedChipVerticalPaddingDp:
                Number(state.advancedChipVerticalPaddingDp),
            drawerMeasured: state.drawerMeasured === true,
            drawerContentHeightDp:
                Number(state.drawerContentHeightDp),
            drawerViewportHeightDp:
                Number(state.drawerViewportHeightDp),
            drawerScrollYDp: Number(state.drawerScrollYDp),
            drawerCanScrollDownAtTop:
                state.drawerCanScrollDownAtTop === true,
            drawerContentFitsViewport:
                state.drawerContentFitsViewport === true,
            repositorySortUnchanged: true,'''
    ),
    (
'''        state.drawerContentBottomPaddingDp = 0;
        state.drawerFooterTopGapDp = 0;
        state.advancedKeywordInputPresent = false;''',
'''        state.drawerContentBottomPaddingDp = 0;
        state.drawerFooterTopGapDp = 0;
        state.drawerFooterHeightDp = 0;
        state.advancedChipVerticalPaddingDp = 0;
        state.drawerMeasured = false;
        state.drawerContentHeightDp = 0;
        state.drawerViewportHeightDp = 0;
        state.drawerScrollYDp = 0;
        state.drawerCanScrollDownAtTop = false;
        state.drawerContentFitsViewport = false;
        state.advancedKeywordInputPresent = false;'''
    ),
    (
'''        state.searchPageStyle = "reference_search_v3";''',
'''        state.searchPageStyle = "reference_search_v4";'''
    ),
    (
'''        MODULE_VERSION: 8,''',
'''        MODULE_VERSION: 9,'''
    )
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit('Expected exactly one match, got %d for:\n%s' % (count, old))
    text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
PYFILTER

cp probes/cliphub_search_filter_ui_probe_037_impl.js \
  probes/cliphub_search_filter_ui_probe_038_impl.js

python3 - <<'PYPROBE'
from pathlib import Path

path = Path('probes/cliphub_search_filter_ui_probe_038_impl.js')
text = path.read_text(encoding='utf-8')
text = text.replace('037', '038')
text = text.replace('20260722.30', '20260722.31')
text = text.replace('filterModuleVersion === 8', 'filterModuleVersion === 9')
text = text.replace('reference_search_v3', 'reference_search_v4')

old = '''                    current.panel.chipSingleLineEnforced === true &&
                    current.panel.chipEllipsizeEndEnforced === true &&
                    current.panel.drawerContentBottomPaddingDp >= 12 &&
                    current.panel.drawerFooterTopGapDp >= 6 &&
                    current.panel.repositorySortUnchanged === true &&'''
new = '''                    current.panel.chipSingleLineEnforced === true &&
                    current.panel.chipEllipsizeEndEnforced === true &&
                    current.panel.advancedChipVerticalPaddingDp === 4 &&
                    current.panel.drawerContentBottomPaddingDp >= 6 &&
                    current.panel.drawerContentBottomPaddingDp <= 8 &&
                    current.panel.drawerFooterTopGapDp === 0 &&
                    current.panel.drawerFooterHeightDp >= 47 &&
                    current.panel.drawerFooterHeightDp <= 49 &&
                    current.panel.drawerMeasured === true &&
                    current.panel.drawerContentHeightDp > 0 &&
                    current.panel.drawerViewportHeightDp > 0 &&
                    current.panel.drawerScrollYDp === 0 &&
                    current.panel.drawerCanScrollDownAtTop === false &&
                    current.panel.drawerContentFitsViewport === true &&
                    current.panel.repositorySortUnchanged === true &&'''
if text.count(old) != 1:
    raise SystemExit('advancedReady replacement point not found')
text = text.replace(old, new, 1)

old = '''                result.advancedScene.panel.chipSingleLineEnforced === true &&
                result.advancedScene.panel.chipEllipsizeEndEnforced === true &&
                result.advancedScene.panel.drawerContentBottomPaddingDp >= 12 &&
                result.advancedScene.panel.drawerFooterTopGapDp >= 6 &&
                result.advancedScene.lastResultCount === 1 &&'''
new = '''                result.advancedScene.panel.chipSingleLineEnforced === true &&
                result.advancedScene.panel.chipEllipsizeEndEnforced === true &&
                result.advancedScene.panel.advancedChipVerticalPaddingDp === 4 &&
                result.advancedScene.panel.drawerContentBottomPaddingDp >= 6 &&
                result.advancedScene.panel.drawerContentBottomPaddingDp <= 8 &&
                result.advancedScene.panel.drawerFooterTopGapDp === 0 &&
                result.advancedScene.panel.drawerFooterHeightDp >= 47 &&
                result.advancedScene.panel.drawerFooterHeightDp <= 49 &&
                result.advancedScene.panel.drawerMeasured === true &&
                result.advancedScene.panel.drawerContentHeightDp > 0 &&
                result.advancedScene.panel.drawerViewportHeightDp > 0 &&
                result.advancedScene.panel.drawerScrollYDp === 0 &&
                result.advancedScene.panel.drawerCanScrollDownAtTop === false &&
                result.advancedScene.panel.drawerContentFitsViewport === true &&
                result.advancedScene.lastResultCount === 1 &&'''
if text.count(old) != 1:
    raise SystemExit('final result replacement point not found')
text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
PYPROBE

python3 - <<'PYDOCS'
from pathlib import Path

stage_path = Path('docs/阶段3D2新UI全量复刻方案.md')
stage = stage_path.read_text(encoding='utf-8')
start = '### 3D2-2：搜索 / 筛选页复刻\n'
end = '\n### 3D2-3：新增 / 编辑页复刻'
if start not in stage or end not in stage:
    raise SystemExit('stage markers not found')
new_stage = '''### 3D2-2：搜索 / 筛选页复刻

- [x] 完成 Filter v6 第一轮搜索页与高级筛选抽屉；
- [x] 完成探测 035 并确认测试夹具误报；
- [x] 完成 Filter v7 第二轮校正与探测 036，功能、返回和历史恢复通过；
- [x] 完成 Filter v8 第三轮单行胶囊和间距收口；
- [x] 探测 037：`ok=true`，但真机截图确认最后一组仍需要向下滚动，配置值检查存在盲区；
- [x] 保持 Repository 查询语义、排序窗口和 Navigation 全局关闭链不变；
- [x] 完成 Filter v9 / `reference_search_v4`：高级胶囊启用 4dp 紧凑垂直内边距；
- [x] 固定底栏恢复为 48dp，移除额外顶部占位；滚动内容底部间距收口为 6dp；
- [x] 增加 Android 实际布局测量：内容高度、视口高度、滚动能力和首屏完整容纳状态；
- [x] 保持抽屉高度 540dp，不改变搜索、排序、筛选和返回语义；
- [x] 发布模块集 `.31` 并新增布局适配探测 038；
- [ ] 运行探测 038，回传两张未裁剪截图与完整 JSON；
- [ ] 确认搜索 / 筛选页最终视觉基线。'''
stage = stage[:stage.index(start)] + new_stage + stage[stage.index(end):]
stage_path.write_text(stage, encoding='utf-8')

plan_path = Path('docs/开发计划.md')
plan = plan_path.read_text(encoding='utf-8')
start = '#### 3D2-2：搜索 / 筛选页\n'
end = '\n#### 后续页面'
if start not in plan or end not in plan:
    raise SystemExit('development section markers not found')
new_plan = '''#### 3D2-2：搜索 / 筛选页

- [x] 完成 Filter v6 / `reference_search_v1` 第一轮实现
- [x] 完成探测 035 并确认测试夹具误报
- [x] 保持 Repository 既有关键词匹配语义
- [x] 完成 Filter v7 / `reference_search_v2` 和探测 036
- [x] 搜索结果 5 条、组合筛选 1 条、返回层级和历史恢复正常
- [x] 完成 Filter v8 / `reference_search_v3`：单行胶囊、尾部省略和中文宽度修正
- [x] 探测 037 自动验证通过，但真机截图确认敏感内容末行仍超出默认视口
- [x] 定位原因：Footer 总占用增大且探测只检查配置值，没有测量实际内容与 ScrollView 视口
- [x] 完成 Filter v9 / `reference_search_v4` 实际布局适配
- [x] 仅高级筛选胶囊使用 4dp 紧凑垂直内边距，搜索历史胶囊保持原尺寸
- [x] Footer 恢复 48dp，移除额外 topMargin；内容底部 padding 调整为 6dp
- [x] 增加实际内容高度、视口高度、滚动状态和首屏完整容纳状态
- [x] 抽屉高度继续保持 540dp
- [x] Repository、排序窗口、搜索历史、组合筛选和 Navigation 语义保持不变
- [x] 发布模块集 `20260722.31`
- [x] 新增探测 038
- [ ] 运行探测 038 并回传两张未裁剪截图与完整 JSON
- [ ] 确认搜索 / 筛选页最终视觉基线

当前边界：第四轮只压缩高级筛选内部纵向占用并增加真实布局测量。搜索历史胶囊、Repository、系统侧滑、三键返回、最近任务和后台隐藏链均不改变。'''
plan = plan[:plan.index(start)] + new_plan + plan[plan.index(end):]
plan = plan.replace('moduleSetVersion=20260722.30', 'moduleSetVersion=20260722.31', 1)
plan = plan.replace('Filter=8', 'Filter=9', 1)
next_start = '## 下一步\n'
next_end = '\n### 后续阶段 3E：入口版本 5'
if next_start not in plan or next_end not in plan:
    raise SystemExit('next step markers not found')
new_next = '''## 下一步

### 运行搜索 / 筛选实际布局探测 038

1. 在 Termux 同步 `agent/initialize-project-skeleton`；
2. 运行 `ClipHub.js`，确认模块集为 `.31`；
3. 运行 `ClipHub 搜索筛选实际布局探测038`；
4. 截取完整搜索结果页和高级筛选抽屉，不得裁剪；
5. 回传完整 JSON；
6. 检查敏感内容三个选项和固定按钮在首屏同时完整显示；
7. 检查 `drawerContentFitsViewport=true`；
8. 检查 `drawerCanScrollDownAtTop=false`、`drawerScrollYDp=0`；
9. 检查高级组合结果仍为 1 条、抽屉高度仍为 540dp；
10. 检查正式实例恢复、数据库关闭、运行锁释放和隔离目录清理。'''
plan = plan[:plan.index(next_start)] + new_next + plan[plan.index(next_end):]
plan_path.write_text(plan, encoding='utf-8')
PYDOCS

filter_sha="$(git hash-object src/ch_11_filter.js)"
python3 - "$filter_sha" <<'PYMANIFEST'
from pathlib import Path
import json
import sys
path = Path('module-manifest.json')
data = json.loads(path.read_text(encoding='utf-8'))
if data.get('schemaVersion') != 1 or data.get('entryMinVersion') != 4:
    raise SystemExit('manifest schema or entry version changed')
if len(data.get('modules', [])) != 15:
    raise SystemExit('manifest module count must remain 15')
data['moduleSetVersion'] = '20260722.31'
found = False
for item in data['modules']:
    if item.get('name') == 'ch_11_filter.js':
        item['sha'] = sys.argv[1]
        found = True
if not found:
    raise SystemExit('filter module missing from manifest')
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
PYMANIFEST

python3 - <<'PYCHECK'
from pathlib import Path
import json
import re
files = ['src/ch_11_filter.js', 'probes/cliphub_search_filter_ui_probe_038_impl.js']
for name in files:
    text = Path(name).read_text(encoding='utf-8')
    forbidden = []
    if re.search(r'\b(?:let|const)\s+', text): forbidden.append('let/const')
    if '=>' in text: forbidden.append('arrow')
    if '`' in text: forbidden.append('template literal')
    if re.search(r'\bclass\s+[A-Za-z_$]', text): forbidden.append('class')
    if forbidden:
        raise SystemExit(name + ' forbidden ES6: ' + ', '.join(forbidden))
filter_text = Path('src/ch_11_filter.js').read_text(encoding='utf-8')
assert 'MODULE_VERSION: 9' in filter_text
assert 'reference_search_v4' in filter_text
assert 'function updateDrawerMeasurements()' in filter_text
assert 'advancedChipVerticalPaddingDp' in filter_text
assert 'drawerContentFitsViewport' in filter_text
assert 'drawerCanScrollDownAtTop' in filter_text
assert 'compact === true ? 4 : 6' in filter_text
assert 'state.drawerContentBottomPaddingDp = 6;' in filter_text
assert 'state.drawerFooterHeightDp = 48;' in filter_text
manifest = json.loads(Path('module-manifest.json').read_text(encoding='utf-8'))
assert manifest['moduleSetVersion'] == '20260722.31'
assert manifest['entryMinVersion'] == 4
assert len(manifest['modules']) == 15
probe = Path('probes/cliphub_search_filter_ui_probe_038_impl.js').read_text(encoding='utf-8')
assert 'REQUIRED_SET = "20260722.31"' in probe
assert 'filterModuleVersion === 9' in probe
assert 'reference_search_v4' in probe
assert 'drawerContentFitsViewport === true' in probe
assert 'drawerCanScrollDownAtTop === false' in probe
PYCHECK

node --check src/ch_11_filter.js
node --check probes/cliphub_search_filter_ui_probe_038_impl.js
if [ -f scripts/check_es5.py ]; then python3 scripts/check_es5.py; fi
git diff --check

git config user.name "ClipHub Automation"
git config user.email "actions@github.com"
git add src/ch_11_filter.js module-manifest.json \
  probes/cliphub_search_filter_ui_probe_038_impl.js \
  docs/阶段3D2新UI全量复刻方案.md docs/开发计划.md
git commit -m "fix: fit advanced filter content in viewport"
implementation_commit="$(git rev-parse HEAD)"

cp probes/cliphub_search_filter_ui_probe_037.js \
  probes/cliphub_search_filter_ui_probe_038.js
python3 - "$implementation_commit" <<'PYLOADER'
from pathlib import Path
import sys
sha = sys.argv[1]
path = Path('probes/cliphub_search_filter_ui_probe_038.js')
text = path.read_text(encoding='utf-8')
text = text.replace('037', '038')
text = text.replace('20260722.30', '20260722.31')
text = text.replace('filterModuleVersion === 8', 'filterModuleVersion === 9')
text = text.replace('0a6b4a45e53126234e92198b9e2fbf72278c0dec', sha)
old = '''                source.indexOf("drawerFooterTopGapDp") < 0) {'''
new = '''                source.indexOf("drawerFooterTopGapDp") < 0 ||
                source.indexOf("drawerContentFitsViewport") < 0 ||
                source.indexOf("drawerCanScrollDownAtTop") < 0 ||
                source.indexOf("advancedChipVerticalPaddingDp") < 0) {'''
if text.count(old) != 1:
    raise SystemExit('loader validation insertion point not found')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
PYLOADER

cat > docs/搜索筛选实际布局探测038说明.md <<EOF
# ClipHub 搜索 / 筛选实际布局探测 038

## 目标

验证阶段 3D2-2 第四轮实际布局适配，确保高级筛选全部内容无需向下滚动即可在默认首屏完整显示。

## 模块集

\`\`\`text
moduleSetVersion=20260722.31
entryVersion=4
databaseSchemaVersion=2
Filter=9
Translation=4
Navigation=3
\`\`\`

## 本轮修改

- 仅高级筛选胶囊使用 4dp 垂直内边距；
- 搜索历史胶囊继续使用原尺寸；
- 固定底栏恢复为 48dp；
- 移除额外 6dp Footer topMargin；
- 滚动内容底部 padding 收口为 6dp；
- 增加实际内容高度、视口高度、滚动位置和可滚动状态测量。

## 核心判定

\`\`\`text
drawerMeasured=true
drawerContentFitsViewport=true
drawerCanScrollDownAtTop=false
drawerScrollYDp=0
advancedChipVerticalPaddingDp=4
drawerFooterHeightDp≈48
\`\`\`

这些字段来自 Android 实际布局测量，不再仅检查配置值。

## 探测文件

\`\`\`text
probes/cliphub_search_filter_ui_probe_038.js
probes/cliphub_search_filter_ui_probe_038_impl.js
\`\`\`

加载器固定读取实现提交：

\`\`\`text
${implementation_commit}
\`\`\`

## 运行步骤

1. 在 Termux 同步 \`agent/initialize-project-skeleton\`；
2. 运行 \`ClipHub.js\`，确认模块集为 \`.31\`；
3. 将 \`probes/cliphub_search_filter_ui_probe_038.js\` 完整复制到新的 ShortX JavaScript 任务；
4. 建议任务名：\`ClipHub 搜索筛选实际布局探测038\`；
5. 运行后截取完整搜索结果页和高级筛选抽屉；
6. 回传两张未裁剪截图和完整 JSON。

## 严格边界

- Rhino ES5 only；
- Repository 关键词匹配语义不变；
- 排序仍只作用于 Filter 当前结果窗口；
- 抽屉高度保持 540dp；
- Navigation 返回层级、最近任务和后台隐藏链不变；
- 数据库 schema 保持 v2；
- PR #1 保持 Draft / Open / 未合并。
EOF

node --check probes/cliphub_search_filter_ui_probe_038.js
node --check probes/cliphub_search_filter_ui_probe_038_impl.js
if [ -f scripts/check_es5.py ]; then python3 scripts/check_es5.py; fi
git diff --check

git add probes/cliphub_search_filter_ui_probe_038.js \
  docs/搜索筛选实际布局探测038说明.md

git rm -r "$HELPER_DIR" "$WORKFLOW_PATH"
git commit -m "test: add advanced filter layout probe 038"
git push origin "HEAD:$BRANCH"
