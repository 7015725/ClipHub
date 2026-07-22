#!/usr/bin/env bash
set -euo pipefail

BRANCH="agent/initialize-project-skeleton"
HELPER_DIR=".github/cliphub-stage3d2-2-visual-close"
WORKFLOW_PATH=".github/workflows/cliphub-stage3d2-2-visual-close.yml"

if [ "$(git hash-object src/ch_11_filter.js)" != "732f9d658e5c7fe1da72d261426e34816644806e" ]; then
  echo "Unexpected ch_11_filter.js base" >&2
  exit 1
fi
if [ "$(git hash-object module-manifest.json)" != "8909b6d5f6dc004999668a5593dc68b1ac0afe1a" ]; then
  echo "Unexpected module-manifest.json base" >&2
  exit 1
fi
if [ "$(git hash-object docs/阶段3D2新UI全量复刻方案.md)" != "ff0201b9fa1d16686a79ae6a12a316a03bd3f3c1" ]; then
  echo "Unexpected stage plan base" >&2
  exit 1
fi
if [ "$(git hash-object docs/开发计划.md)" != "ccf54f3311d6ec1bd50b229173ce62cb151e4f3c" ]; then
  echo "Unexpected development plan base" >&2
  exit 1
fi

python3 - <<'PYFILTER'
from pathlib import Path

path = Path('src/ch_11_filter.js')
text = path.read_text(encoding='utf-8')

replacements = [
    (
'''        horizontalFadeEnabled: false,
        advancedKeywordInputPresent: false,''',
'''        horizontalFadeEnabled: false,
        chipSingleLineEnforced: true,
        chipEllipsizeEndEnforced: true,
        drawerContentBottomPaddingDp: 0,
        drawerFooterTopGapDp: 0,
        advancedKeywordInputPresent: false,'''
    ),
    (
'''        view.setGravity(Gravity.CENTER);
        view.setPadding(dp(9), dp(6), dp(9), dp(6));
        view.setBackground(roundedBackground(''',
'''        view.setGravity(Gravity.CENTER);
        view.setSingleLine(true);
        view.setMaxLines(1);
        view.setEllipsize(TextUtils.TruncateAt.END);
        view.setPadding(dp(9), dp(6), dp(9), dp(6));
        view.setBackground(roundedBackground('''
    ),
    (
'''        return Math.min(202, Math.max(42, 19 + units * 9));''',
'''        return Math.min(202, Math.max(44, 22 + units * 10));'''
    ),
    (
'''        content.setOrientation(LinearLayout.VERTICAL);
        if (counts.sources.length > 0) {''',
'''        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(0, 0, 0, dp(14));
        state.drawerContentBottomPaddingDp = 14;
        if (counts.sources.length > 0) {'''
    ),
    (
'''        addChoiceSection(content, "敏感内容", sensitiveRow, 3, colors);''',
'''        addChoiceSection(content, "敏感内容", sensitiveRow, 8, colors);'''
    ),
    (
'''        drawer.addView(footer, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(48)));
        return drawer;''',
'''        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(54));
        params.topMargin = dp(6);
        drawer.addView(footer, params);
        state.drawerFooterTopGapDp = 6;
        return drawer;'''
    ),
    (
'''        state.drawerWidthDp = 0;
        state.drawerHeightDp = 0;
        drawerContainer = null;''',
'''        state.drawerWidthDp = 0;
        state.drawerHeightDp = 0;
        state.drawerContentBottomPaddingDp = 0;
        state.drawerFooterTopGapDp = 0;
        drawerContainer = null;'''
    ),
    (
'''            drawerWidthDp: Number(state.drawerWidthDp),
            drawerHeightDp: Number(state.drawerHeightDp),
            repositorySortUnchanged: true,''',
'''            drawerWidthDp: Number(state.drawerWidthDp),
            drawerHeightDp: Number(state.drawerHeightDp),
            chipSingleLineEnforced:
                state.chipSingleLineEnforced === true,
            chipEllipsizeEndEnforced:
                state.chipEllipsizeEndEnforced === true,
            drawerContentBottomPaddingDp:
                Number(state.drawerContentBottomPaddingDp),
            drawerFooterTopGapDp:
                Number(state.drawerFooterTopGapDp),
            repositorySortUnchanged: true,'''
    ),
    (
'''        state.horizontalFadeEnabled = false;
        state.advancedKeywordInputPresent = false;''',
'''        state.horizontalFadeEnabled = false;
        state.chipSingleLineEnforced = true;
        state.chipEllipsizeEndEnforced = true;
        state.drawerContentBottomPaddingDp = 0;
        state.drawerFooterTopGapDp = 0;
        state.advancedKeywordInputPresent = false;'''
    ),
    (
'''        state.searchPageStyle = "reference_search_v2";''',
'''        state.searchPageStyle = "reference_search_v3";'''
    ),
    (
'''        MODULE_VERSION: 7,''',
'''        MODULE_VERSION: 8,'''
    )
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit('Expected exactly one match, got %d for:\n%s' % (count, old))
    text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
PYFILTER

cp probes/cliphub_search_filter_ui_probe_036_impl.js \
  probes/cliphub_search_filter_ui_probe_037_impl.js

python3 - <<'PYPROBE'
from pathlib import Path

path = Path('probes/cliphub_search_filter_ui_probe_037_impl.js')
text = path.read_text(encoding='utf-8')
text = text.replace('036', '037')
text = text.replace('20260722.29', '20260722.30')
text = text.replace('filterModuleVersion === 7', 'filterModuleVersion === 8')
text = text.replace('reference_search_v2', 'reference_search_v3')

old = '''                    current.panel.drawerHeightDp >= 520 &&
                    current.panel.drawerHeightDp <= 560 &&
                    current.panel.repositorySortUnchanged === true &&'''
new = '''                    current.panel.drawerHeightDp >= 520 &&
                    current.panel.drawerHeightDp <= 560 &&
                    current.panel.chipSingleLineEnforced === true &&
                    current.panel.chipEllipsizeEndEnforced === true &&
                    current.panel.drawerContentBottomPaddingDp >= 12 &&
                    current.panel.drawerFooterTopGapDp >= 6 &&
                    current.panel.repositorySortUnchanged === true &&'''
if text.count(old) != 1:
    raise SystemExit('advancedReady insertion point not found')
text = text.replace(old, new, 1)

old = '''                result.advancedScene.panel.drawerHeightDp >= 520 &&
                result.advancedScene.panel.drawerHeightDp <= 560 &&
                result.advancedScene.lastResultCount === 1 &&'''
new = '''                result.advancedScene.panel.drawerHeightDp >= 520 &&
                result.advancedScene.panel.drawerHeightDp <= 560 &&
                result.advancedScene.panel.chipSingleLineEnforced === true &&
                result.advancedScene.panel.chipEllipsizeEndEnforced === true &&
                result.advancedScene.panel.drawerContentBottomPaddingDp >= 12 &&
                result.advancedScene.panel.drawerFooterTopGapDp >= 6 &&
                result.advancedScene.lastResultCount === 1 &&'''
if text.count(old) != 1:
    raise SystemExit('final result insertion point not found')
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
- [x] 完成探测 035 真机截图和 JSON 分析，确认误报来自测试包名包含 `android`；
- [x] 完成 Filter v7 第二轮校正与探测 036；
- [x] 探测 036：`ok=true`、搜索结果 5 条、组合筛选 1 条、返回层级和历史恢复全部通过；
- [x] 保持 Repository 查询语义和 Navigation 全局关闭链不变；
- [x] 完成 Filter v8 第三轮视觉收口：胶囊强制单行、省略尾部、修正中文宽度估算；
- [x] 为抽屉滚动内容增加底部安全间距，并为固定操作栏增加顶部间距；
- [x] 保持抽屉高度 540dp，不改变排序、搜索历史和组合筛选语义；
- [x] 发布模块集 `.30` 并新增视觉收口探测 037；
- [ ] 运行探测 037，回传高级筛选抽屉未裁剪截图与完整 JSON；
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
- [x] 保持 Repository 对 `content`、`source_label`、`source_package` 的既有关键词匹配语义
- [x] 完成 Filter v7 / `reference_search_v2` 第二轮校正
- [x] 探测 036 自动验证与两张未裁剪截图通过功能审查
- [x] 搜索结果 5 条、组合筛选 1 条、返回层级和搜索历史恢复全部正常
- [x] 定位高级抽屉剩余视觉问题：末组选项贴近固定底栏、中文标签发生两行断字
- [x] 完成 Filter v8 / `reference_search_v3` 第三轮视觉收口
- [x] 胶囊强制单行并使用尾部省略，修正中文字符宽度估算
- [x] 抽屉滚动内容增加 14dp 底部安全间距，固定底栏增加 6dp 顶部间距
- [x] 抽屉高度继续保持 540dp
- [x] Repository、排序窗口、搜索历史、组合筛选和 Navigation 返回语义保持不变
- [x] 发布模块集 `20260722.30`
- [x] 新增探测 037
- [ ] 运行探测 037 并回传未裁剪截图与完整 JSON
- [ ] 确认搜索 / 筛选页最终视觉基线

当前边界：第三轮只处理胶囊文本布局和抽屉底部安全间距。排序仍只作用于当前最多 40 条 Filter 结果窗口；系统侧滑、三键返回、最近任务和后台隐藏链不变。'''
plan = plan[:plan.index(start)] + new_plan + plan[plan.index(end):]

plan = plan.replace('moduleSetVersion=20260722.29', 'moduleSetVersion=20260722.30', 1)
plan = plan.replace('Filter=7', 'Filter=8', 1)

next_start = '## 下一步\n'
next_end = '\n### 后续阶段 3E：入口版本 5'
if next_start not in plan or next_end not in plan:
    raise SystemExit('next step markers not found')
new_next = '''## 下一步

### 运行搜索 / 筛选视觉收口探测 037

1. 在 Termux 同步 `agent/initialize-project-skeleton`；
2. 运行 `ClipHub.js`，确认模块集为 `.30`；
3. 运行 `ClipHub 搜索筛选视觉收口探测037`；
4. 截取完整高级筛选抽屉，不得裁剪；
5. 回传完整 JSON；
6. 检查“开发资源”等标签保持单行；
7. 检查“敏感内容”最后一组选项完整位于固定按钮上方；
8. 检查抽屉高度仍为 540dp、组合筛选仍为 1 条；
9. 检查正式实例恢复、数据库关闭、运行锁释放和隔离目录清理。'''
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
data['moduleSetVersion'] = '20260722.30'
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

files = [
    'src/ch_11_filter.js',
    'probes/cliphub_search_filter_ui_probe_037_impl.js'
]
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
assert 'MODULE_VERSION: 8' in filter_text
assert 'reference_search_v3' in filter_text
assert 'view.setSingleLine(true);' in filter_text
assert 'view.setMaxLines(1);' in filter_text
assert 'TextUtils.TruncateAt.END' in filter_text
assert 'state.drawerContentBottomPaddingDp = 14;' in filter_text
assert 'state.drawerFooterTopGapDp = 6;' in filter_text
assert 'ClipHub.Repository.listItems(toQueryOptions({' in filter_text

manifest = json.loads(Path('module-manifest.json').read_text(encoding='utf-8'))
assert manifest['moduleSetVersion'] == '20260722.30'
assert manifest['entryMinVersion'] == 4
assert len(manifest['modules']) == 15

probe = Path('probes/cliphub_search_filter_ui_probe_037_impl.js').read_text(encoding='utf-8')
assert 'REQUIRED_SET = "20260722.30"' in probe
assert 'filterModuleVersion === 8' in probe
assert 'reference_search_v3' in probe
assert 'chipSingleLineEnforced' in probe
assert 'drawerContentBottomPaddingDp' in probe
assert 'drawerFooterTopGapDp' in probe
PYCHECK

node --check src/ch_11_filter.js
node --check probes/cliphub_search_filter_ui_probe_037_impl.js
if [ -f scripts/check_es5.py ]; then python3 scripts/check_es5.py; fi
git diff --check

git config user.name "ClipHub Automation"
git config user.email "actions@github.com"
git add src/ch_11_filter.js module-manifest.json \
  probes/cliphub_search_filter_ui_probe_037_impl.js \
  docs/阶段3D2新UI全量复刻方案.md docs/开发计划.md
git commit -m "fix: close search filter visual spacing"
implementation_commit="$(git rev-parse HEAD)"

cp probes/cliphub_search_filter_ui_probe_036.js \
  probes/cliphub_search_filter_ui_probe_037.js
python3 - "$implementation_commit" <<'PYLOADER'
from pathlib import Path
import sys

sha = sys.argv[1]
path = Path('probes/cliphub_search_filter_ui_probe_037.js')
text = path.read_text(encoding='utf-8')
text = text.replace('036', '037')
text = text.replace('20260722.29', '20260722.30')
text = text.replace('filterModuleVersion === 7', 'filterModuleVersion === 8')
text = text.replace('navigationModuleVersion === 3', 'navigationModuleVersion === 3')
text = text.replace('005712cf7929e98e385ec7275e7f3f0af11aaef6', sha)
old = '''                source.indexOf("historyRestored") < 0) {'''
new = '''                source.indexOf("historyRestored") < 0 ||
                source.indexOf("chipSingleLineEnforced") < 0 ||
                source.indexOf("drawerContentBottomPaddingDp") < 0 ||
                source.indexOf("drawerFooterTopGapDp") < 0) {'''
if text.count(old) != 1:
    raise SystemExit('loader validation insertion point not found')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
PYLOADER

cat > docs/搜索筛选视觉收口探测037说明.md <<EOF
# ClipHub 搜索 / 筛选视觉收口探测 037

## 目标

验证阶段 3D2-2 第三轮视觉收口，重点检查高级筛选胶囊单行显示和固定底部操作栏上方的安全间距。

## 模块集

\`\`\`text
moduleSetVersion=20260722.30
entryVersion=4
databaseSchemaVersion=2
Filter=8
Translation=4
Navigation=3
\`\`\`

## 本轮边界

- Repository 关键词查询语义不变；
- 排序仍只作用于 Filter 当前结果窗口；
- 抽屉高度继续保持 540dp；
- Navigation 返回层级、最近任务和后台隐藏链不变；
- 不增加透明触摸层、自定义底部手势或 WebView。

## 视觉修复

- 所有筛选胶囊强制单行；
- 超长内容使用尾部省略，不再拆成两行；
- 中文宽度估算增加，避免“开发资源”断字；
- 滚动内容底部增加 14dp 安全间距；
- 固定操作栏顶部增加 6dp 间距。

## 探测文件

\`\`\`text
probes/cliphub_search_filter_ui_probe_037.js
probes/cliphub_search_filter_ui_probe_037_impl.js
\`\`\`

加载器固定读取实现提交：

\`\`\`text
${implementation_commit}
\`\`\`

## 运行步骤

1. 在 Termux 同步 \`agent/initialize-project-skeleton\`；
2. 运行 \`ClipHub.js\`，确认模块集为 \`.30\`；
3. 将 \`probes/cliphub_search_filter_ui_probe_037.js\` 完整复制到新的 ShortX JavaScript 任务；
4. 建议任务名：\`ClipHub 搜索筛选视觉收口探测037\`；
5. 运行后截取完整高级筛选抽屉，不得裁剪；
6. 回传截图和完整 JSON。

## 自动检查

- Filter v8 / \`reference_search_v3\`；
- Android 搜索结果 5 条；
- 高级组合筛选结果 1 条；
- 胶囊单行和尾部省略标记为 true；
- 抽屉内容底部安全间距不少于 12dp；
- 固定底栏顶部间距不少于 6dp；
- 抽屉高度 520–560dp；
- 返回层级、历史恢复、数据库关闭、运行锁和正式实例恢复正常。
EOF

node --check probes/cliphub_search_filter_ui_probe_037.js
node --check probes/cliphub_search_filter_ui_probe_037_impl.js
if [ -f scripts/check_es5.py ]; then python3 scripts/check_es5.py; fi
git diff --check

git add probes/cliphub_search_filter_ui_probe_037.js \
  docs/搜索筛选视觉收口探测037说明.md

git rm -r "$HELPER_DIR" "$WORKFLOW_PATH"
git commit -m "test: add search filter visual probe 037"
git push origin "HEAD:$BRANCH"
