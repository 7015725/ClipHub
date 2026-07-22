#!/usr/bin/env bash
set -euo pipefail

BRANCH="agent/initialize-project-skeleton"
HELPER_DIR=".github/cliphub-stage3d2-4"
WORKFLOW_PATH=".github/workflows/cliphub-stage3d2-4.yml"

check_hash() {
  local path="$1" expected="$2" actual
  actual="$(git hash-object "$path")"
  if [ "$actual" != "$expected" ]; then
    echo "Unexpected base for $path: $actual != $expected" >&2
    exit 1
  fi
}

check_hash src/ch_04_clipboard.js 70a1a10215c75012b47bd06eda9a2b271e63f248
check_hash src/ch_05_classifier.js c78f3d652ecdf75a5c454312aa03e15ab55ab38f
check_hash src/ch_06_repository.js d9050715d061f3058de983104330283080ec55f2
check_hash src/ch_09_list.js 30e7b1b76aca447ab26b0de695aae3ab0b51b59e
check_hash src/ch_10_editor.js 8de662133eee7c5dcb3ce8ffafb496f02632d5a2
check_hash src/ch_11_filter.js b24a88aaac0bb2d3dc9251135845b2b2010914ce
check_hash src/ch_12_translation.js 8cae18cda1737b63c93d09409e24903cac3bc2a6
check_hash src/ch_13_settings.js fe5b06b405ed5e9a5f26f2ddefc8dab9337fdc8e
check_hash src/ch_15_app.js 1c68820940b6cd1f74213a03476bd681f22e0031
check_hash module-manifest.json f28d69bc067dc71ef0a82647883d55a7a1cb6934

cat > src/ch_05_classifier.js <<'EOF'
(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    ClipHub.Classifier = {
        MODULE_NAME: "ch_05_classifier",
        MODULE_VERSION: 2,
        init: function () { return true; },
        classify: function (value) {
            var text = String(value === null || value === undefined ? "" : value);
            return { type: "text", confidence: 100,
                normalizedContent: text };
        },
        shutdown: function () { return true; }
    };
}((function () { return this; }())));
EOF

cp "$HELPER_DIR/settings_v5.js" src/ch_13_settings.js
python3 "$HELPER_DIR/patch.py"

python3 - <<'PY'
from pathlib import Path
import json
import subprocess
path = Path('module-manifest.json')
data = json.loads(path.read_text(encoding='utf-8'))
if data.get('schemaVersion') != 1 or data.get('entryMinVersion') != 4:
    raise SystemExit('Manifest compatibility changed')
if len(data.get('modules', [])) != 15:
    raise SystemExit('Manifest module count changed')
data['moduleSetVersion'] = '20260723.01'
changed = {
    'ch_04_clipboard.js', 'ch_05_classifier.js', 'ch_06_repository.js',
    'ch_09_list.js', 'ch_10_editor.js', 'ch_11_filter.js',
    'ch_12_translation.js', 'ch_13_settings.js', 'ch_15_app.js'
}
for module in data['modules']:
    if module['name'] in changed:
        module['sha'] = subprocess.check_output(
            ['git', 'hash-object', module['path']], text=True).strip()
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n',
                encoding='utf-8')
PY

cp "$HELPER_DIR/probe045_impl.js" \
  probes/cliphub_content_tags_settings_probe_045_impl.js

cat > docs/阶段3D2-4内容标签翻译设置实施说明.md <<'EOF'
# 阶段 3D2-4：内容类型收口、标签、翻译弹窗与设置页

```text
moduleSetVersion=20260723.01
entryVersion=4
databaseSchemaVersion=2
Clipboard=3
Classifier=2
Repository=8
List=13
Editor=9
Filter=12
Translation=5
Settings=5
Navigation=3
App=8
```

## 内容类型

- URL、电话、邮箱、代码等识别停止；
- 新记录统一写兼容值 `text`；
- `content_type` 仅作为 schema v2 历史兼容列；
- Repository 不再应用内容类型查询；
- 卡片、编辑页和高级筛选不显示内容类型。

## 标签

- 使用 `tags` 与 `clipboard_item_tags` 结构化存储；
- 支持新建、重命名、颜色、排序、删除和多标签关联；
- 删除标签不删除剪贴板记录；
- 卡片最多显示两个标签，更多显示 `+N`；
- 编辑页与设置页均可管理标签。

## 翻译

- 百度：MD5 `appid + q + salt + secret`；
- 有道：SHA-256 v3 与长文本 input 截断；
- 中文自动译英文，非中文自动译中文；
- 两个引擎使用独立 SQLite 凭据；
- 结果使用独立弹窗；
- 默认不复制、不覆盖、不新增；
- 用户明确选择复制、替换、另存或重试。

## 设置页

包含常规、翻译、标签管理、数据与关于四个分组。翻译配置使用既有 `settings` 表持久化，数据库仍为 v2。

## 返回层级

```text
翻译结果 / 设置 / 标签 / 编辑
→ Filter Root
→ 关闭 ClipHub UI
```

Navigation v3 实现未修改。
EOF

for file in \
  src/ch_04_clipboard.js src/ch_05_classifier.js src/ch_06_repository.js \
  src/ch_09_list.js src/ch_10_editor.js src/ch_11_filter.js \
  src/ch_12_translation.js src/ch_13_settings.js src/ch_15_app.js \
  probes/cliphub_content_tags_settings_probe_045_impl.js; do
  node --check "$file"
done

python3 - <<'PY'
from pathlib import Path
import json
import re
files = [
 'src/ch_04_clipboard.js','src/ch_05_classifier.js','src/ch_06_repository.js',
 'src/ch_09_list.js','src/ch_10_editor.js','src/ch_11_filter.js',
 'src/ch_12_translation.js','src/ch_13_settings.js','src/ch_15_app.js',
 'probes/cliphub_content_tags_settings_probe_045_impl.js'
]
for name in files:
    text = Path(name).read_text(encoding='utf-8')
    bad = []
    if re.search(r'(?m)^\s*(?:let|const)\s+', text): bad.append('let/const')
    if '=>' in text: bad.append('arrow')
    if '`' in text: bad.append('template literal')
    if re.search(r'\bclass\s+[A-Za-z_$]', text): bad.append('class')
    if bad: raise SystemExit(name + ': forbidden ES6 ' + ','.join(bad))
manifest = json.loads(Path('module-manifest.json').read_text())
assert manifest['moduleSetVersion'] == '20260723.01'
assert manifest['entryMinVersion'] == 4
assert len(manifest['modules']) == 15
assert 'SCHEMA_VERSION = 2' in Path('src/ch_03_database.js').read_text()
assert 'MODULE_VERSION: 5' in Path('src/ch_12_translation.js').read_text()
assert 'MODULE_VERSION: 5' in Path('src/ch_13_settings.js').read_text()
assert '内容类型（多选）' not in Path('src/ch_11_filter.js').read_text()
assert 'ClipHub.Filter.showRoot' in Path('src/ch_15_app.js').read_text()
PY

git diff --check

git config user.name "ClipHub Automation"
git config user.email "actions@github.com"
git add src/ch_04_clipboard.js src/ch_05_classifier.js src/ch_06_repository.js \
  src/ch_09_list.js src/ch_10_editor.js src/ch_11_filter.js \
  src/ch_12_translation.js src/ch_13_settings.js src/ch_15_app.js \
  module-manifest.json docs/阶段3D2-4内容标签翻译设置实施说明.md \
  probes/cliphub_content_tags_settings_probe_045_impl.js
git commit -m "feat: add tags translation popup and settings surface"
implementation_commit="$(git rev-parse HEAD)"

cat > probes/cliphub_content_tags_settings_probe_045.js <<EOF
/* ClipHub content/tag/settings probe 045 loader. Rhino ES5 only. */
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
    var implementationCommit = "${implementation_commit}";
    var target = "https://raw.githubusercontent.com/7015725/ClipHub/" +
        implementationCommit + "/probes/" +
        "cliphub_content_tags_settings_probe_045_impl.js" +
        "?_=" + Number(System.currentTimeMillis());
    try {
        connection = new URL(target).openConnection();
        connection.setUseCaches(false);
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(20000);
        connection.setRequestProperty("Cache-Control", "no-cache, no-store");
        connection.setRequestProperty("Pragma", "no-cache");
        connection.setRequestProperty("User-Agent", "ClipHub-Probe/045-v1");
        input = connection.getInputStream();
        reader = new BR(new ISR(input, "UTF-8"));
        while ((line = reader.readLine()) !== null) {
            builder.append(line).append("\n");
        }
        source = String(builder.toString());
        if (!source || source.indexOf("probeVersion: 1") < 0 ||
                source.indexOf("REQUIRED_SET = \"20260723.01\"") < 0 ||
                source.indexOf("contentTypeSettingsPresent") < 0 ||
                source.indexOf("translationModuleVersion === 5") < 0 ||
                source.indexOf("cliphub_content_tags_settings_probe_045") < 0) {
            throw new Error("Probe 045 implementation validation failed");
        }
        eval(source + "\n//# sourceURL=ClipHub/probe_045_impl_v1.js");
    } finally {
        try { if (reader !== null) { reader.close(); } } catch (ignored) {}
        try { if (input !== null) { input.close(); } } catch (ignoredInput) {}
        try { if (connection !== null && connection.disconnect) {
            connection.disconnect();
        }} catch (ignoredConnection) {}
    }
}((function () { return this; }())));

JSON.stringify(ClipHubContentTagsSettingsProbe045Result);
EOF

cat > docs/内容标签翻译设置探测045说明.md <<EOF
# ClipHub 内容、标签、翻译设置探测 045

模块集：\`20260723.01\`。

验证内容类型停用、标签结构化管理、百度/有道独立 SQLite 配置、设置页返回层级以及 schema v2 和 Navigation v3 边界。

截图：

1. 无内容类型、显示标签的唯一首页；
2. 翻译设置；
3. 标签管理。

加载器固定读取实现提交：

\`\`\`text
${implementation_commit}
\`\`\`
EOF

node --check probes/cliphub_content_tags_settings_probe_045.js
git diff --check
git add probes/cliphub_content_tags_settings_probe_045.js \
  docs/内容标签翻译设置探测045说明.md
git rm -r "$HELPER_DIR" "$WORKFLOW_PATH"
git commit -m "test: add content tags settings probe 045"
git push origin "HEAD:$BRANCH"
