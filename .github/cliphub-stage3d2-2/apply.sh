#!/usr/bin/env bash
set -euo pipefail

BRANCH="agent/initialize-project-skeleton"
WORKFLOW_PATH=".github/workflows/cliphub-stage3d2-2-apply.yml"
PAYLOAD_DIR=".github/cliphub-stage3d2-2"

if [ "$(git hash-object src/ch_11_filter.js)" != "9195cfceda280395940a1c6abb9046ad9386dc64" ]; then
  echo "Unexpected ch_11_filter.js base" >&2
  exit 1
fi
if [ "$(git hash-object src/ch_12_translation.js)" != "d521a3010371f77171bd6338a69197b5e8639d1c" ]; then
  echo "Unexpected ch_12_translation.js base" >&2
  exit 1
fi
if [ "$(git hash-object probes/cliphub_search_filter_ui_probe_035_impl.js)" != "5ab0906ab6584bf0089fbbe3f2301dce38b56e96" ]; then
  echo "Unexpected probe 035 implementation base" >&2
  exit 1
fi
if [ "$(git hash-object module-manifest.json)" != "0a83ddb2f4f6e0168c43bfa8a3b2042e6712aead" ]; then
  echo "Unexpected manifest base" >&2
  exit 1
fi
if [ "$(git hash-object docs/阶段3D2新UI全量复刻方案.md)" != "a805bb29b1ff9be4b3195af0b98d34950441b73e" ]; then
  echo "Unexpected stage plan base" >&2
  exit 1
fi
if [ "$(git hash-object docs/开发计划.md)" != "9560e66c65b666aafb6d0193408a044ff50bba82" ]; then
  echo "Unexpected development plan base" >&2
  exit 1
fi
if [ "$(git hash-object probes/cliphub_search_filter_ui_probe_035.js)" != "e1c27afbf678f451292147bfdbe321d692c656ad" ]; then
  echo "Unexpected probe 035 loader base" >&2
  exit 1
fi
if [ "$(git hash-object docs/搜索筛选新UI探测035说明.md)" != "2fadd90163b8baa2e178f8be8b48942acde71ad4" ]; then
  echo "Unexpected probe 035 doc base" >&2
  exit 1
fi

decode_file() {
  local source="$1"
  local target="$2"
  base64 -d "$source" | gzip -d > "$target"
}

decode_file "$PAYLOAD_DIR/filter.patch.gz.b64" /tmp/filter.patch
decode_file "$PAYLOAD_DIR/navigation.patch.gz.b64" /tmp/navigation.patch
decode_file "$PAYLOAD_DIR/probe035.fixed.js.gz.b64" probes/cliphub_search_filter_ui_probe_035_impl.js
decode_file "$PAYLOAD_DIR/probe036_impl.js.gz.b64" probes/cliphub_search_filter_ui_probe_036_impl.js

git apply --check /tmp/filter.patch
git apply /tmp/filter.patch
git apply --check /tmp/navigation.patch
git apply /tmp/navigation.patch

python3 - <<'PYDOCS'
from pathlib import Path

stage_path = Path('docs/阶段3D2新UI全量复刻方案.md')
stage = stage_path.read_text(encoding='utf-8')
start = '### 3D2-2：搜索 / 筛选页复刻\n'
end = '\n### 3D2-3：新增 / 编辑页复刻'
if start not in stage or end not in stage:
    raise SystemExit('stage 3D2-2 markers not found')
new_stage = '''### 3D2-2：搜索 / 筛选页复刻

- [x] 完成 Filter v6 第一轮搜索页与高级筛选抽屉；
- [x] 完成探测 035 真机截图和 JSON 分析；
- [x] 确认 035 的 6 条结果来自测试包名包含 `android`，Repository 查询语义正确；
- [x] 完成 Filter v7 第二轮校正：多行换行、抽屉关键词、排序方式、540dp 抽屉和固定底栏；
- [x] 排序限定在 Filter 当前结果窗口，不修改 Repository 查询语义；
- [x] 增加“高级抽屉 → 搜索页 → 首页”独立返回层，最近任务和全局隐藏仍走完整关闭链；
- [x] 修复搜索历史在模块初始化顺序下无法跨实例恢复的问题；
- [x] 发布模块集 `.29` 并新增探测 036；
- [ ] 运行探测 036，回传两张未裁剪截图和完整 JSON；
- [ ] 根据 036 真机结果确认搜索 / 筛选页第二轮视觉基线。'''
stage = stage[:stage.index(start)] + new_stage + stage[stage.index(end):]
stage_path.write_text(stage, encoding='utf-8')

plan_path = Path('docs/开发计划.md')
plan = plan_path.read_text(encoding='utf-8')
start = '#### 3D2-2：搜索 / 筛选页\n'
end = '\n#### 后续页面'
if start not in plan or end not in plan:
    raise SystemExit('development plan 3D2-2 markers not found')
new_plan = '''#### 3D2-2：搜索 / 筛选页

- [x] 完成 Filter v6 / `reference_search_v1` 第一轮实现
- [x] 完成探测 035 真机截图和 JSON 分析
- [x] 确认 035 误报来自无关记录包名包含 `android`
- [x] 保持 Repository 对 `content`、`source_label`、`source_package` 的既有关键词匹配语义
- [x] 完成 Filter v7 / `reference_search_v2` 第二轮校正
- [x] 来源应用、内容类型、标签改为多行自动换行
- [x] 高级抽屉增加关键词输入与三种排序方式
- [x] 排序只作用于 Filter 当前结果窗口
- [x] 抽屉高度收口到 540dp，固定重置 / 应用按钮
- [x] 筛选按钮展开后仍显示“筛选”
- [x] 增加“高级抽屉 → 搜索页 → 首页”返回层
- [x] 保持最近任务、后台隐藏和完整 UI 清理链不变
- [x] 修复搜索历史跨实例重启恢复
- [x] 发布模块集 `20260722.29`
- [x] 新增探测 036
- [ ] 运行探测 036 并回传两张未裁剪截图与完整 JSON
- [ ] 确认搜索 / 筛选页第二轮视觉基线

当前边界：排序模式不进入 Repository 查询选项，只对当前最多 40 条 Filter 结果窗口进行稳定排序。系统侧滑和三键返回继续由 Navigation 统一注册；Filter 只增加内部层级处理。最近任务和后台切换仍直接完整关闭搜索面板，不保留抽屉。'''
plan = plan[:plan.index(start)] + new_plan + plan[plan.index(end):]

mod_start = '## 当前模块集\n'
mod_end = '\n## 下一步'
if mod_start not in plan or mod_end not in plan:
    raise SystemExit('development plan module markers not found')
new_modules = '''## 当前模块集

```text
moduleSetVersion=20260722.29
entryVersion=4
databaseSchemaVersion=2
sourceRef=agent/initialize-project-skeleton
```

当前模块版本：

```text
Theme=2
Window=5
List=11
Filter=7
Settings=4
Translation=4
Navigation=3
EventBus=2
RecentsWatch=1
```'''
plan = plan[:plan.index(mod_start)] + new_modules + plan[plan.index(mod_end):]

next_start = '## 下一步\n'
next_end = '\n### 后续阶段 3E：入口版本 5'
if next_start not in plan or next_end not in plan:
    raise SystemExit('development plan next markers not found')
new_next = '''## 下一步

### 运行搜索 / 筛选第二轮探测 036

1. 运行 `ClipHub.js` 同步模块集 `.29`；
2. 运行 `ClipHub 搜索筛选UI探测036`；
3. 截取完整搜索结果页，不得裁剪；
4. 截取完整高级筛选抽屉，不得裁剪；
5. 回传完整 JSON；
6. 检查 Android 搜索结果为 5 条；
7. 检查来源胶囊自动换行、抽屉关键词和三种排序方式；
8. 检查抽屉返回搜索页、搜索页返回首页；
9. 检查搜索历史跨隔离实例重启恢复；
10. 检查正式实例恢复、数据库关闭、运行锁释放和隔离目录清理。'''
plan = plan[:plan.index(next_start)] + new_next + plan[plan.index(next_end):]
plan_path.write_text(plan, encoding='utf-8')
PYDOCS

filter_sha="$(git hash-object src/ch_11_filter.js)"
translation_sha="$(git hash-object src/ch_12_translation.js)"
python3 - "$filter_sha" "$translation_sha" <<'PYMANIFEST'
from pathlib import Path
import json
import sys
path = Path('module-manifest.json')
data = json.loads(path.read_text(encoding='utf-8'))
if data.get('schemaVersion') != 1 or data.get('entryMinVersion') != 4:
    raise SystemExit('manifest schema or entry version changed unexpectedly')
if len(data.get('modules', [])) != 15:
    raise SystemExit('manifest module count must remain 15')
data['moduleSetVersion'] = '20260722.29'
updates = {
    'ch_11_filter.js': sys.argv[1],
    'ch_12_translation.js': sys.argv[2]
}
for item in data['modules']:
    if item.get('name') in updates:
        item['sha'] = updates[item['name']]
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
PYMANIFEST

python3 - <<'PYCHECK'
from pathlib import Path
import json
import re
files = [
    'src/ch_11_filter.js',
    'src/ch_12_translation.js',
    'probes/cliphub_search_filter_ui_probe_035_impl.js',
    'probes/cliphub_search_filter_ui_probe_036_impl.js'
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
manifest = json.loads(Path('module-manifest.json').read_text(encoding='utf-8'))
assert manifest['moduleSetVersion'] == '20260722.29'
assert manifest['entryMinVersion'] == 4
assert len(manifest['modules']) == 15
filter_text = Path('src/ch_11_filter.js').read_text(encoding='utf-8')
translation_text = Path('src/ch_12_translation.js').read_text(encoding='utf-8')
assert 'MODULE_VERSION: 7' in filter_text
assert 'MODULE_VERSION: 3' in translation_text
assert 'MODULE_VERSION: 4' in translation_text
probe035 = Path('probes/cliphub_search_filter_ui_probe_035_impl.js').read_text(encoding='utf-8')
assert 'com.google.android.apps.docs' not in probe035
assert 'com.google.docs.editor' in probe035
PYCHECK

node --check src/ch_11_filter.js
node --check src/ch_12_translation.js
node --check probes/cliphub_search_filter_ui_probe_035_impl.js
node --check probes/cliphub_search_filter_ui_probe_036_impl.js
if [ -f scripts/check_es5.py ]; then python3 scripts/check_es5.py; fi
git diff --check

git config user.name "ClipHub Automation"
git config user.email "actions@github.com"
git add src/ch_11_filter.js src/ch_12_translation.js \
  probes/cliphub_search_filter_ui_probe_035_impl.js \
  probes/cliphub_search_filter_ui_probe_036_impl.js \
  module-manifest.json docs/阶段3D2新UI全量复刻方案.md docs/开发计划.md
git commit -m "feat: refine search and filter UI"
implementation_commit="$(git rev-parse HEAD)"

python3 - "$implementation_commit" <<'PYLOADERS'
from pathlib import Path
import sys
sha = sys.argv[1]
loader035 = Path('probes/cliphub_search_filter_ui_probe_035.js')
text = loader035.read_text(encoding='utf-8')
old = 'e36769fcb952c77b1b663c0c13b0aba9e0b77d65'
if old not in text:
    raise SystemExit('probe 035 loader pin not found')
loader035.write_text(text.replace(old, sha), encoding='utf-8')

doc035 = Path('docs/搜索筛选新UI探测035说明.md')
text = doc035.read_text(encoding='utf-8')
if old not in text:
    raise SystemExit('probe 035 doc pin not found')
text = text.replace(old, sha)
anchor = '本探测用于结构和真机截图校正，不代表第一轮代码已经达到最终像素一致。\n'
correction = '''本探测用于结构和真机截图校正，不代表第一轮代码已经达到最终像素一致。

### 1.1 探测结果更正

首次真机结果为 `ok=false`、`error=null`，根因不是 Filter v6，而是第 6 条“无关记录”的 `source_package=com.google.android.apps.docs` 包含 `android`。Repository 按既有语义同时匹配 `content`、`source_label` 和 `source_package`，因此返回 6 条是正确行为。

夹具已改为 `com.google.docs.editor`，继续保持预期 5 条；Repository 查询实现不作修改。历史探测 035 仍要求模块集 `.28`，当前模块集 `.29` 应运行探测 036。
'''
if '### 1.1 探测结果更正' not in text:
    if anchor not in text:
        raise SystemExit('probe 035 correction anchor not found')
    text = text.replace(anchor, correction)
doc035.write_text(text, encoding='utf-8')
PYLOADERS

decode_file "$PAYLOAD_DIR/probe036_loader.js.gz.b64" /tmp/probe036_loader.js
decode_file "$PAYLOAD_DIR/doc036.md.gz.b64" /tmp/doc036.md
sed "s/__IMPLEMENTATION_COMMIT__/$implementation_commit/g" \
  /tmp/probe036_loader.js > probes/cliphub_search_filter_ui_probe_036.js
sed "s/__IMPLEMENTATION_COMMIT__/$implementation_commit/g" \
  /tmp/doc036.md > docs/搜索筛选第二轮校正探测036说明.md

rm -rf "$PAYLOAD_DIR"
rm -f "$WORKFLOW_PATH"

node --check probes/cliphub_search_filter_ui_probe_035.js
node --check probes/cliphub_search_filter_ui_probe_036.js
python3 - <<'PYFINAL'
from pathlib import Path
import re
for name in [
    'probes/cliphub_search_filter_ui_probe_035.js',
    'probes/cliphub_search_filter_ui_probe_036.js'
]:
    text = Path(name).read_text(encoding='utf-8')
    if re.search(r'\b(?:let|const)\s+', text) or '=>' in text or '`' in text:
        raise SystemExit(name + ' is not Rhino ES5')
assert 'REQUIRED_SET = "20260722.29"' in Path('probes/cliphub_search_filter_ui_probe_036_impl.js').read_text(encoding='utf-8')
assert '两张截图均不得裁剪' in Path('probes/cliphub_search_filter_ui_probe_036_impl.js').read_text(encoding='utf-8')
PYFINAL

git add -A
git diff --cached --check
git commit -m "test: add search filter probe 036"
git push origin "HEAD:$BRANCH"

echo "implementation_commit=$implementation_commit"
echo "final_commit=$(git rev-parse HEAD)"
