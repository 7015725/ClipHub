#!/usr/bin/env bash
set -euo pipefail

BRANCH="agent/initialize-project-skeleton"
HELPER_DIR=".github/cliphub-probe044-v2"
WORKFLOW_PATH=".github/workflows/cliphub-probe044-v2.yml"

if [ "$(git hash-object probes/cliphub_filter_root_probe_044_impl.js)" != "4b5d97afdd2dcc0331655cfa54a9f641a13488c7" ]; then
  echo "Unexpected probe 044 implementation base" >&2
  exit 1
fi
if [ "$(git hash-object probes/cliphub_filter_root_probe_044.js)" != "b3c2f45a5b21f08ed773f9053350f7d0685828cc" ]; then
  echo "Unexpected probe 044 loader base" >&2
  exit 1
fi
if [ "$(git hash-object docs/唯一根页面探测044说明.md)" != "fd64e2b4a84b9009367ff03d38fb04db012e2df2" ]; then
  echo "Unexpected probe 044 documentation base" >&2
  exit 1
fi
if [ "$(git hash-object docs/开发计划.md)" != "3571c0a2059636524ce028c732a8f9802382e4d5" ]; then
  echo "Unexpected development plan base" >&2
  exit 1
fi

python3 - <<'PYIMPL'
from pathlib import Path

path = Path('probes/cliphub_filter_root_probe_044_impl.js')
text = path.read_text(encoding='utf-8')

replacements = [
    (
        '/* ClipHub sole filter-root probe 044. Rhino ES5 only. */',
        '/* ClipHub sole filter-root probe 044 v2. Rhino ES5 only. */'
    ),
    (
'''            probeVersion: 1,
            moduleSetVersion: local.moduleSetVersion || null,''',
'''            probeVersion: 2,
            startedAt: startedAt,
            moduleSetVersion: local.moduleSetVersion || null,'''
    ),
    (
'''            navigationImplementationChanged: false,
            error: null''',
'''            navigationImplementationChanged: false,
            navigationDebouncePreserved: true,
            error: null'''
    ),
    (
'''            result.drawerBackReady = waitFor(function () {
                return global.ClipHub.Filter.getPanelState()
                    .advancedDrawerVisible === false;
            }, 1000);
            result.rootBack = global.ClipHub.Navigation''',
'''            result.drawerBackReady = waitFor(function () {
                return global.ClipHub.Filter.getPanelState()
                    .advancedDrawerVisible === false;
            }, 1000);
            result.returnDebounceWaitMs = 260;
            Thread.sleep(result.returnDebounceWaitMs);
            result.rootBack = global.ClipHub.Navigation'''
    ),
    (
'''            probeVersion: 1,
            fatal: true,''',
'''            probeVersion: 2,
            fatal: true,'''
    )
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit('Probe implementation replacement expected one match, got %d:\n%s' %
                         (count, old))
    text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
PYIMPL

python3 - <<'PYCHECK1'
from pathlib import Path
import re

path = Path('probes/cliphub_filter_root_probe_044_impl.js')
text = path.read_text(encoding='utf-8')
assert text.count('probeVersion: 2') == 2
assert 'startedAt: startedAt' in text
assert 'returnDebounceWaitMs = 260' in text
assert 'navigationDebouncePreserved: true' in text
assert 'probeVersion: 1' not in text
if re.search(r'(?m)^\s*(?:let|const)\s+', text):
    raise SystemExit('Probe implementation contains let/const')
if '=>' in text or '`' in text:
    raise SystemExit('Probe implementation contains forbidden ES6 syntax')
PYCHECK1

node --check probes/cliphub_filter_root_probe_044_impl.js
git diff --check

git config user.name "ClipHub Automation"
git config user.email "actions@github.com"
git add probes/cliphub_filter_root_probe_044_impl.js
git commit -m "test: fix probe 044 return timing"
implementation_commit="$(git rev-parse HEAD)"

python3 - "$implementation_commit" <<'PYLOADER'
from pathlib import Path
import sys

commit = sys.argv[1]
path = Path('probes/cliphub_filter_root_probe_044.js')
text = path.read_text(encoding='utf-8')
replacements = [
    ('/* ClipHub sole filter-root probe 044 loader. Rhino ES5 only. */',
     '/* ClipHub sole filter-root probe 044 v2 loader. Rhino ES5 only. */'),
    ('"20bd4317fad31b185646fc3cd3c43ddd8f1680e0"', '"' + commit + '"'),
    ('"ClipHub-Probe/044-v1"', '"ClipHub-Probe/044-v2"'),
    ('source.indexOf("probeVersion: 1") < 0',
     'source.indexOf("probeVersion: 2") < 0'),
    ('source.indexOf("performBottomActionClick") < 0)',
     'source.indexOf("performBottomActionClick") < 0 ||\n                source.indexOf("returnDebounceWaitMs = 260") < 0 ||\n                source.indexOf("startedAt: startedAt") < 0)'),
    ('//# sourceURL=ClipHub/probe_044_impl_v1.js',
     '//# sourceURL=ClipHub/probe_044_impl_v2.js')
]
for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit('Loader replacement expected one match, got %d: %s' %
                         (count, old))
    text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
PYLOADER

cat > docs/唯一根页面探测044说明.md <<EOF
# ClipHub 唯一根页面探测 044 v2

## 目标

验证旧 \`reference_home_v2\` 首页不再由正式入口创建，\`reference_search_v4\` 搜索 / 筛选页成为唯一根页面。

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

本次仅升级探测脚本版本，不修改模块集、Manifest 或业务模块。

## v1 结果

三张未裁剪截图和主要运行态均已通过：

- \`primarySurface=filter_root\`；
- \`filterRootMode=true\`；
- \`legacyHomeAttached=false\`；
- \`windowAttached=false\`；
- 默认页、长按选择和高级筛选视觉正常。

v1 的 \`ok=false\` 来自探测时序：关闭高级筛选抽屉后立即再次派发根页面返回，两次事件均使用 \`owner:filter\` 签名，第二次被 Navigation v3 的 180ms 去重策略拦截。该结果不是业务回归失败。

## v2 修正

- \`probeVersion\` 升级为 2；
- 在抽屉返回完成后等待 260ms，再派发根页面返回；
- 保持 Navigation v3 的 180ms 去重实现不变；
- 将 \`startedAt\` 写入结果，修复 \`durationMs=null\`；
- 增加 \`returnDebounceWaitMs=260\` 与 \`navigationDebouncePreserved=true\` 状态。

## 生产入口行为

- \`show\` / \`toggle\` 直接打开 Filter Root；
- 不再调用 \`ClipHub.List.show()\`；
- \`legacyHomeAttached\` 必须始终为 \`false\`；
- 根页面系统返回直接关闭 ClipHub UI；
- 再次 \`show\` 仍直接打开 Filter Root。

## 已迁移交互

- 点击结果卡：复制；
- 长按结果卡：选择；
- 星标：直接切换置顶；
- 底栏：置顶、编辑、新增、删除、详情 / 翻译入口；
- Editor 和详情页关闭后返回 Filter Root。

## 三个截图场景

1. 默认唯一首页；
2. 长按选中记录，底部操作栏启用；
3. 高级筛选抽屉。

## 探测文件

\`\`\`text
probes/cliphub_filter_root_probe_044.js
probes/cliphub_filter_root_probe_044_impl.js
\`\`\`

加载器固定读取 v2 实现提交：

\`\`\`text
${implementation_commit}
\`\`\`

## v2 预期

\`\`\`text
ok=true
probeVersion=2
rootBackReady=true
duplicateBackCount=0
backInvokedCount=2
backHandledCount=2
durationMs>30000
\`\`\`

## 回传要求

- 三张完整未裁剪截图；
- 完整 JSON；
- 运行期间不要手动关闭、返回或切换页面。
EOF

python3 - <<'PYPLAN'
from pathlib import Path

path = Path('docs/开发计划.md')
text = path.read_text(encoding='utf-8')
old = '''- [x] 新增唯一根页面探测 044
- [ ] 运行探测 044 并回传三张未裁剪截图与完整 JSON

当前边界：本轮只取消旧首页的生产入口；`ch_09_list.js` 尚不物理删除，待五页面功能回归后再清理兼容 UI 代码。'''
new = '''- [x] 新增唯一根页面探测 044
- [x] 探测 044 v1：三张未裁剪截图与唯一根页面视觉通过
- [x] 定位 v1 误报：抽屉返回和根页面返回间隔不足 180ms，被 Navigation v3 去重
- [x] 发布探测 044 v2，仅修正探测返回时序与 `durationMs`，不修改业务模块
- [ ] 运行探测 044 v2 并回传完整 JSON

当前边界：本轮只取消旧首页的生产入口；`ch_09_list.js` 尚不物理删除，待五页面功能回归后再清理兼容 UI 代码。Navigation v3 的 180ms 去重策略保持不变。'''
if text.count(old) != 1:
    raise SystemExit('Development plan root section marker mismatch')
text = text.replace(old, new, 1)
old = '''### 运行唯一根页面探测 044

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
new = '''### 运行唯一根页面探测 044 v2

1. 在 Termux 同步 `agent/initialize-project-skeleton`；
2. 模块集继续保持 `.37`，不需要重新发布业务模块；
3. 重新导入或执行更新后的 `ClipHub 唯一根页面探测044`；
4. 回传三张未裁剪截图与完整 JSON；
5. 检查 `probeVersion=2`；
6. 检查所有场景 `legacyHomeAttached=false`；
7. 检查 `rootBackReady=true`；
8. 检查 `duplicateBackCount=0`；
9. 检查重新 show 后仍直接进入 Filter Root；
10. 检查 `durationMs` 为有效数值。'''
if text.count(old) != 1:
    raise SystemExit('Development plan next step marker mismatch')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
PYPLAN

python3 - <<'PYCHECK2'
from pathlib import Path
import re

for name in [
    'probes/cliphub_filter_root_probe_044.js',
    'probes/cliphub_filter_root_probe_044_impl.js'
]:
    text = Path(name).read_text(encoding='utf-8')
    if re.search(r'(?m)^\s*(?:let|const)\s+', text):
        raise SystemExit(name + ': contains let/const')
    if '=>' in text or '`' in text:
        raise SystemExit(name + ': contains forbidden ES6 syntax')

loader = Path('probes/cliphub_filter_root_probe_044.js').read_text(encoding='utf-8')
impl = Path('probes/cliphub_filter_root_probe_044_impl.js').read_text(encoding='utf-8')
assert 'probeVersion: 2' in loader
assert '044-v2' in loader
assert 'returnDebounceWaitMs = 260' in loader
assert 'probe_044_impl_v2.js' in loader
assert impl.count('probeVersion: 2') == 2
assert 'startedAt: startedAt' in impl
assert 'Thread.sleep(result.returnDebounceWaitMs)' in impl
assert 'navigationDebouncePreserved: true' in impl
assert 'probeVersion: 1' not in impl
PYCHECK2

node --check probes/cliphub_filter_root_probe_044.js
node --check probes/cliphub_filter_root_probe_044_impl.js
git diff --check

git add probes/cliphub_filter_root_probe_044.js \
  docs/唯一根页面探测044说明.md docs/开发计划.md
git rm -r "$HELPER_DIR" "$WORKFLOW_PATH"
git commit -m "docs: publish probe 044 v2 loader"
git push origin "HEAD:$BRANCH"
