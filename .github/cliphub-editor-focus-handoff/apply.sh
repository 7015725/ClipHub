#!/usr/bin/env bash
set -euo pipefail

BRANCH="agent/initialize-project-skeleton"
HELPER_DIR=".github/cliphub-editor-focus-handoff"
WORKFLOW_PATH=".github/workflows/cliphub-editor-focus-handoff.yml"

if [ "$(git hash-object src/ch_10_editor.js)" != "1bf0fe8bbfc5a18e5a6d26ea1a2760439665da6e" ]; then
  echo "Unexpected ch_10_editor.js base" >&2
  exit 1
fi
if [ "$(git hash-object module-manifest.json)" != "3234fe03300d16a862d19fa24d4022abc6f86bcd" ]; then
  echo "Unexpected module-manifest.json base" >&2
  exit 1
fi
if [ "$(git hash-object docs/开发计划.md)" != "76dc5790d6d47f1d626d695f1817ac6e5e0235c4" ]; then
  echo "Unexpected development plan base" >&2
  exit 1
fi
if [ "$(git hash-object docs/阶段3D2新UI全量复刻方案.md)" != "c3e590b6d3130215405d7ccae6248e922d1fc189" ]; then
  echo "Unexpected stage plan base" >&2
  exit 1
fi

python3 - <<'PYEDITOR'
from pathlib import Path

path = Path('src/ch_10_editor.js')
text = path.read_text(encoding='utf-8')

replacements = [
    (
'''    var View = Packages.android.view.View;
    var Gravity = Packages.android.view.Gravity;''',
'''    var View = Packages.android.view.View;
    var ViewGroup = Packages.android.view.ViewGroup;
    var Gravity = Packages.android.view.Gravity;'''
    ),
    (
'''        normalPanelHeightDp: 0,
        currentPanelHeightDp: 0,
        currentPanelTopDp: 0,
        panelGravity: "center",''',
'''        normalPanelHeightDp: 0,
        currentPanelHeightDp: 0,
        currentPanelTopDp: 0,
        focusReleasedAfterImeHide: false,
        focusReleaseCount: 0,
        rootFocusRequestedAfterImeHide: false,
        rootFocusedAfterImeHide: false,
        panelGravity: "center",'''
    ),
    (
'''        state.editorStyle = "reference_editor_v3";''',
'''        state.editorStyle = "reference_editor_v4";'''
    ),
    (
'''        state.requestKeyboardOnOpen = requestKeyboard;
        state.keyboardRequestedOnOpen = false;
        return requireMain(runOnMainSync(function () {''',
'''        state.requestKeyboardOnOpen = requestKeyboard;
        state.keyboardRequestedOnOpen = false;
        state.focusReleasedAfterImeHide = false;
        state.rootFocusRequestedAfterImeHide = false;
        state.rootFocusedAfterImeHide = false;
        return requireMain(runOnMainSync(function () {'''
    ),
    (
'''            currentPanelHeightDp: Number(state.currentPanelHeightDp),
            currentPanelTopDp: Number(state.currentPanelTopDp),
            panelGravity: state.panelGravity,''',
'''            currentPanelHeightDp: Number(state.currentPanelHeightDp),
            currentPanelTopDp: Number(state.currentPanelTopDp),
            focusReleasedAfterImeHide:
                state.focusReleasedAfterImeHide === true,
            focusReleaseCount: Number(state.focusReleaseCount),
            rootFocusRequestedAfterImeHide:
                state.rootFocusRequestedAfterImeHide === true,
            rootFocusedAfterImeHide:
                state.rootFocusedAfterImeHide === true,
            rootFocused: rootFocused,
            panelGravity: state.panelGravity,'''
    ),
    (
'''            normalPanelHeightDp: 0, currentPanelHeightDp: 0,
            currentPanelTopDp: 0, panelGravity: "center",
            panelBottomMarginDp: 0,''',
'''            normalPanelHeightDp: 0, currentPanelHeightDp: 0,
            currentPanelTopDp: 0, focusReleasedAfterImeHide: false,
            focusReleaseCount: 0,
            rootFocusRequestedAfterImeHide: false,
            rootFocusedAfterImeHide: false, panelGravity: "center",
            panelBottomMarginDp: 0,'''
    ),
    (
'''        MODULE_VERSION: 7,''',
'''        MODULE_VERSION: 8,'''
    )
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit('Expected one match, got %d for:\n%s' % (count, old))
    text = text.replace(old, new, 1)

marker = '''    function measureEditorLayout(imeSnapshot) {'''
if text.count(marker) != 1:
    raise SystemExit('measureEditorLayout marker not found')
focus_function = r'''    function handoffEditorFocusAfterImeHide() {
        var previousDescendantFocusability = -1;
        var released = false;
        var requested = false;
        var focused = false;
        if (panelRoot === null || contentInput === null ||
                state.mode === "tags") {
            return false;
        }
        state.focusReleaseCount += 1;
        try {
            previousDescendantFocusability =
                Number(panelRoot.getDescendantFocusability());
        } catch (ignoredDescendantRead) {}
        try {
            panelRoot.setFocusable(true);
            panelRoot.setFocusableInTouchMode(true);
            panelRoot.setDescendantFocusability(
                ViewGroup.FOCUS_BLOCK_DESCENDANTS);
            contentInput.clearFocus();
            released = !contentInput.hasFocus();
            requested = panelRoot.requestFocus();
            focused = panelRoot.isFocused();
        } catch (error) {
            state.lastError = String(error);
        } finally {
            if (previousDescendantFocusability >= 0) {
                try {
                    panelRoot.setDescendantFocusability(
                        previousDescendantFocusability);
                } catch (ignoredDescendantRestore) {}
            }
        }
        state.focusReleasedAfterImeHide = released;
        state.rootFocusRequestedAfterImeHide = requested || focused;
        state.rootFocusedAfterImeHide = focused;
        if (!focused && mainHandler !== null) {
            mainHandler.postDelayed(new Packages.java.lang.Runnable({
                run: function () {
                    var previous = -1;
                    var retried = false;
                    if (!state.attached || state.keyboardVisible ||
                            panelRoot === null || contentInput === null) {
                        return;
                    }
                    try {
                        previous = Number(
                            panelRoot.getDescendantFocusability());
                    } catch (ignoredPrevious) {}
                    try {
                        panelRoot.setFocusable(true);
                        panelRoot.setFocusableInTouchMode(true);
                        panelRoot.setDescendantFocusability(
                            ViewGroup.FOCUS_BLOCK_DESCENDANTS);
                        contentInput.clearFocus();
                        retried = panelRoot.requestFocus();
                        state.focusReleasedAfterImeHide =
                            !contentInput.hasFocus();
                        state.rootFocusRequestedAfterImeHide =
                            state.rootFocusRequestedAfterImeHide || retried;
                        state.rootFocusedAfterImeHide =
                            panelRoot.isFocused();
                    } catch (retryError) {
                        state.lastError = String(retryError);
                    } finally {
                        if (previous >= 0 && panelRoot !== null) {
                            try {
                                panelRoot.setDescendantFocusability(previous);
                            } catch (ignoredRestore) {}
                        }
                    }
                }
            }), 80);
        }
        return released && (requested || focused);
    }

'''
text = text.replace(marker, focus_function + marker, 1)

old = '''        var selectionStart = 0;
        var selectionEnd = 0;
        if (panelRoot === null || state.mode === "tags") { return false; }'''
new = '''        var selectionStart = 0;
        var selectionEnd = 0;
        var keyboardWasVisible = state.lastKeyboardVisible === true;
        if (panelRoot === null || state.mode === "tags") { return false; }'''
if text.count(old) != 1:
    raise SystemExit('measure local marker not found')
text = text.replace(old, new, 1)

old = '''            if (state.layoutMeasureCount > 0 &&
                    state.lastKeyboardVisible !== ime.visible) {
                if (ime.visible) { state.keyboardShowCount += 1; }
                else { state.keyboardHideCount += 1; }
            }
            state.lastKeyboardVisible = ime.visible;'''
new = '''            if (state.layoutMeasureCount > 0 &&
                    state.lastKeyboardVisible !== ime.visible) {
                if (ime.visible) {
                    state.keyboardShowCount += 1;
                } else {
                    state.keyboardHideCount += 1;
                    if (keyboardWasVisible) {
                        handoffEditorFocusAfterImeHide();
                    }
                }
            }
            state.lastKeyboardVisible = ime.visible;
            if (!ime.visible && state.focusReleasedAfterImeHide === true &&
                    panelRoot !== null) {
                try {
                    state.rootFocusedAfterImeHide = panelRoot.isFocused();
                } catch (ignoredRootFocus) {}
            }'''
if text.count(old) != 1:
    raise SystemExit('keyboard transition marker not found')
text = text.replace(old, new, 1)

old = '''        var inputLength = 0;
        var notFocusable = false;
        try {'''
new = '''        var inputLength = 0;
        var notFocusable = false;
        var rootFocused = false;
        try {
            rootFocused = panelRoot !== null && panelRoot.isFocused();
        } catch (ignoredRootFocus) {}
        try {'''
if text.count(old) != 1:
    raise SystemExit('getState local marker not found')
text = text.replace(old, new, 1)

old = '''        state.keyboardAvoidanceApplied = false;
        state.currentPanelHeightDp = 0;
        state.currentPanelTopDp = 0;
    }'''
new = '''        state.keyboardAvoidanceApplied = false;
        state.currentPanelHeightDp = 0;
        state.currentPanelTopDp = 0;
        state.focusReleasedAfterImeHide = false;
        state.rootFocusRequestedAfterImeHide = false;
        state.rootFocusedAfterImeHide = false;
    }'''
if text.count(old) != 1:
    raise SystemExit('clearViews focus reset marker not found')
text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
PYEDITOR

cp probes/cliphub_editor_keyboard_probe_041_impl.js \
  probes/cliphub_editor_keyboard_probe_042_impl.js

python3 - <<'PYPROBE'
from pathlib import Path

path = Path('probes/cliphub_editor_keyboard_probe_042_impl.js')
text = path.read_text(encoding='utf-8')
text = text.replace('041', '042')
text = text.replace('20260722.34', '20260722.35')
text = text.replace('editorModuleVersion === 7', 'editorModuleVersion === 8')
text = text.replace('reference_editor_v3', 'reference_editor_v4')

old = '''                return current.attached === true &&
                    current.keyboardVisible === false &&
                    current.keyboardAvoidanceApplied === false &&
                    current.panelGravity === "bottom";'''
new = '''                return current.attached === true &&
                    current.keyboardVisible === false &&
                    current.keyboardAvoidanceApplied === false &&
                    current.panelGravity === "bottom" &&
                    current.inputFocused === false &&
                    current.focusReleasedAfterImeHide === true &&
                    current.focusReleaseCount >= 1 &&
                    current.rootFocusRequestedAfterImeHide === true &&
                    current.rootFocusedAfterImeHide === true &&
                    current.rootFocused === true;'''
if text.count(old) != 1:
    raise SystemExit('first back readiness marker not found')
text = text.replace(old, new, 1)

text = text.replace('            }, 3000);\n            result.firstBackAfter',
                    '            }, 4500);\n            result.firstBackAfter', 1)
text = text.replace('            }, 3000);\n            result.secondBackState',
                    '            }, 4500);\n            result.secondBackState', 1)

old = '''            result.secondBackState = {
                editor: global.ClipHub.Editor.getState(),
                list: global.ClipHub.List.getState(),
                navigation: global.ClipHub.Navigation.getState()
            };'''
new = '''            result.secondBackState = {
                editor: global.ClipHub.Editor.getState(),
                list: global.ClipHub.List.getState(),
                navigation: global.ClipHub.Navigation.getState()
            };
            result.secondBackNavigationHandled =
                result.secondBackState.navigation.backHandledCount >= 1 &&
                result.secondBackState.navigation.lastBackOwner === "editor" &&
                (result.secondBackState.navigation.lastBackReason === "back_key" ||
                    result.secondBackState.navigation.lastBackReason ===
                        "on_back_invoked" ||
                    result.secondBackState.navigation.lastBackReason ===
                        "predictive_back");'''
if text.count(old) != 1:
    raise SystemExit('second back state marker not found')
text = text.replace(old, new, 1)

old = '''                result.firstBackHidKeyboard === true &&
                result.firstBackKeptEditor === true &&
                result.secondBackShell && result.secondBackShell.code === 0 &&'''
new = '''                result.firstBackHidKeyboard === true &&
                result.firstBackKeptEditor === true &&
                result.firstBackAfter.inputFocused === false &&
                result.firstBackAfter.focusReleasedAfterImeHide === true &&
                result.firstBackAfter.focusReleaseCount >= 1 &&
                result.firstBackAfter.rootFocusRequestedAfterImeHide === true &&
                result.firstBackAfter.rootFocusedAfterImeHide === true &&
                result.firstBackAfter.rootFocused === true &&
                result.secondBackShell && result.secondBackShell.code === 0 &&'''
if text.count(old) != 1:
    raise SystemExit('final first back marker not found')
text = text.replace(old, new, 1)

old = '''                result.secondBackClosedEditor === true &&
                result.secondBackState.editor.attached === false &&
                result.secondBackState.list.visible === true &&'''
new = '''                result.secondBackClosedEditor === true &&
                result.secondBackNavigationHandled === true &&
                result.secondBackState.editor.attached === false &&
                result.secondBackState.list.visible === true &&'''
if text.count(old) != 1:
    raise SystemExit('final second back marker not found')
text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
PYPROBE

python3 - <<'PYDOCS'
from pathlib import Path

plan_path = Path('docs/开发计划.md')
plan = plan_path.read_text(encoding='utf-8')
old = '''- [x] 发布模块集 `20260722.34`
- [x] 新增探测 041
- [ ] 运行探测 041 并回传三张未裁剪截图与完整 JSON
- [ ] 根据真机结果确认新增 / 编辑页输入法最终基线

当前边界：本轮只对现有 Editor WindowManager 窗口执行输入法避让，不创建第二窗口、不增加透明触摸层、不修改 Repository 或 Navigation v3。'''
new = '''- [x] 发布模块集 `20260722.34`
- [x] 新增探测 041
- [x] 探测 041：输入法避让、长文本和首次返回均通过，第二次返回因 EditText 继续持有焦点而未关闭 Editor
- [x] 定位传统 Back 键未到达根容器 `OnKeyListener`，Navigation v3 关闭逻辑本身未触发
- [x] 完成 Editor v8 / `reference_editor_v4` IME 隐藏后的焦点交接
- [x] 首次返回隐藏键盘后清除正文焦点，并将焦点恢复给已注册 Navigation 的 Editor Root
- [x] 增加焦点释放、根焦点请求和根焦点确认状态
- [x] 保持 Navigation v3、Repository 保存语义和输入法窗口尺寸逻辑不变
- [x] 发布模块集 `20260722.35`
- [x] 新增探测 042
- [ ] 运行探测 042 并回传三张未裁剪截图与完整 JSON
- [ ] 确认新增 / 编辑页输入法与两层返回最终基线

当前边界：本轮只处理输入法隐藏后的 Editor 焦点交接，不修改 Navigation v3，不新增自定义返回层，不改变 WindowManager 避让尺寸或 Repository 保存语义。'''
if plan.count(old) != 1:
    raise SystemExit('development plan stage marker not found')
plan = plan.replace(old, new, 1)
plan = plan.replace('moduleSetVersion=20260722.34',
                    'moduleSetVersion=20260722.35', 1)
plan = plan.replace('Editor=7', 'Editor=8', 1)
start = plan.index('## 下一步\n')
end = plan.index('\n### 后续阶段 3E：入口版本 5', start)
next_text = '''## 下一步

### 运行新增 / 编辑焦点交接与两层返回探测 042

1. 在 Termux 同步 `agent/initialize-project-skeleton`；
2. 运行 `ClipHub.js`，确认模块集为 `.35`；
3. 运行 `ClipHub 新增编辑焦点返回探测042`；
4. 场景 1 截取输入法显示且固定底栏位于键盘上方的短文本页；
5. 场景 2 截取长文本光标位于末尾的页面；
6. 场景 3 截取首次返回隐藏键盘后恢复底部浮层的页面；
7. 回传三张未裁剪截图和完整 JSON；
8. 检查首次返回后 `inputFocused=false`、Root 已取得焦点；
9. 检查第二次返回由 Navigation 处理并关闭 Editor；
10. 检查未保存内容不入库、正式实例恢复和清理链正常。'''
plan = plan[:start] + next_text + plan[end:]
plan_path.write_text(plan, encoding='utf-8')

stage_path = Path('docs/阶段3D2新UI全量复刻方案.md')
stage = stage_path.read_text(encoding='utf-8')
old = '''- [x] 发布模块集 `.34` 并新增探测 041；
- [ ] 运行探测 041，验证底栏位于键盘上方及两层返回；
- [ ] 确认新增 / 编辑页输入法最终视觉基线。'''
new = '''- [x] 发布模块集 `.34` 并新增探测 041；
- [x] 探测 041：输入法避让和首次返回通过，第二次返回因正文仍持有焦点而未到达 Navigation Root；
- [x] 完成 Editor v8 焦点交接：IME 隐藏后清除正文焦点并恢复 Editor Root 焦点；
- [x] 保持 Navigation v3、输入法窗口避让尺寸和 Repository 保存语义不变；
- [x] 发布模块集 `.35` 并新增探测 042；
- [ ] 运行探测 042，验证首次返回焦点交接和第二次返回关闭 Editor；
- [ ] 确认新增 / 编辑页输入法与返回最终视觉基线。'''
if stage.count(old) != 1:
    raise SystemExit('stage plan marker not found')
stage = stage.replace(old, new, 1)
stage_path.write_text(stage, encoding='utf-8')
PYDOCS

editor_sha="$(git hash-object src/ch_10_editor.js)"
python3 - "$editor_sha" <<'PYMANIFEST'
from pathlib import Path
import json
import sys

path = Path('module-manifest.json')
data = json.loads(path.read_text(encoding='utf-8'))
if data.get('schemaVersion') != 1 or data.get('entryMinVersion') != 4:
    raise SystemExit('manifest schema or entry version changed')
if len(data.get('modules', [])) != 15:
    raise SystemExit('manifest module count changed')
data['moduleSetVersion'] = '20260722.35'
found = False
for item in data['modules']:
    if item.get('name') == 'ch_10_editor.js':
        item['sha'] = sys.argv[1]
        found = True
if not found:
    raise SystemExit('editor module missing')
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n',
    encoding='utf-8')
PYMANIFEST

python3 - <<'PYCHECK'
from pathlib import Path
import json
import re

for name in ['src/ch_10_editor.js',
             'probes/cliphub_editor_keyboard_probe_042_impl.js']:
    text = Path(name).read_text(encoding='utf-8')
    forbidden = []
    if re.search(r'\b(?:let|const)\s+', text): forbidden.append('let/const')
    if '=>' in text: forbidden.append('arrow')
    if '`' in text: forbidden.append('template literal')
    if re.search(r'\bclass\s+[A-Za-z_$]', text): forbidden.append('class')
    if forbidden:
        raise SystemExit(name + ': ' + ', '.join(forbidden))

editor = Path('src/ch_10_editor.js').read_text(encoding='utf-8')
assert 'MODULE_VERSION: 8' in editor
assert 'reference_editor_v4' in editor
assert 'handoffEditorFocusAfterImeHide' in editor
assert 'contentInput.clearFocus();' in editor
assert 'panelRoot.requestFocus();' in editor
assert 'ViewGroup.FOCUS_BLOCK_DESCENDANTS' in editor
assert 'focusReleasedAfterImeHide' in editor
assert 'rootFocusedAfterImeHide' in editor
assert 'ClipHub.Repository.updateItem(id, { content: content })' in editor

manifest = json.loads(Path('module-manifest.json').read_text(encoding='utf-8'))
assert manifest['moduleSetVersion'] == '20260722.35'
assert manifest['entryMinVersion'] == 4
assert len(manifest['modules']) == 15

probe = Path('probes/cliphub_editor_keyboard_probe_042_impl.js').read_text(encoding='utf-8')
assert 'REQUIRED_SET = "20260722.35"' in probe
assert 'editorModuleVersion === 8' in probe
assert 'reference_editor_v4' in probe
assert 'focusReleasedAfterImeHide' in probe
assert 'rootFocusedAfterImeHide' in probe
assert 'secondBackNavigationHandled' in probe
PYCHECK

node --check src/ch_10_editor.js
node --check probes/cliphub_editor_keyboard_probe_042_impl.js
if [ -f scripts/check_es5.py ]; then python3 scripts/check_es5.py; fi
git diff --check

git config user.name "ClipHub Automation"
git config user.email "actions@github.com"
git add src/ch_10_editor.js module-manifest.json \
  probes/cliphub_editor_keyboard_probe_042_impl.js \
  docs/开发计划.md docs/阶段3D2新UI全量复刻方案.md
git commit -m "fix: hand editor focus back after ime hide"
implementation_commit="$(git rev-parse HEAD)"

cp probes/cliphub_editor_keyboard_probe_041.js \
  probes/cliphub_editor_keyboard_probe_042.js
python3 - "$implementation_commit" <<'PYLOADER'
from pathlib import Path
import sys

path = Path('probes/cliphub_editor_keyboard_probe_042.js')
text = path.read_text(encoding='utf-8')
text = text.replace('041', '042')
text = text.replace('20260722.34', '20260722.35')
text = text.replace('editorModuleVersion === 7', 'editorModuleVersion === 8')
text = text.replace('reference_editor_v3', 'reference_editor_v4')
text = text.replace('f639d4257aa79e0daa8a22252a85f7044894cfec',
                    sys.argv[1], 1)
old = '''                source.indexOf("imeInsetSource") < 0) {'''
new = '''                source.indexOf("imeInsetSource") < 0 ||
                source.indexOf("focusReleasedAfterImeHide") < 0 ||
                source.indexOf("rootFocusedAfterImeHide") < 0 ||
                source.indexOf("secondBackNavigationHandled") < 0) {'''
if text.count(old) != 1:
    raise SystemExit('loader validation marker not found')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
PYLOADER

cat > docs/新增编辑焦点交接探测042说明.md <<EOF
# ClipHub 新增 / 编辑焦点交接探测 042

## 目标

验证 Editor v8 在第一次返回隐藏输入法后，能否将焦点从正文 EditText 交还给已注册 Navigation 的 Editor Root，使第二次传统 Back 键正常关闭 Editor。

## 模块集

\`\`\`text
moduleSetVersion=20260722.35
entryVersion=4
databaseSchemaVersion=2
Editor=8
Filter=9
Navigation=3
editorStyle=reference_editor_v4
\`\`\`

## 本轮边界

- 输入法主动避让尺寸和位置算法保持 Editor v7 实现；
- Navigation v3 不修改；
- Repository 保存语义不修改；
- 不新增自定义返回层；
- 不创建第二窗口或透明触摸层；
- 标签管理保持原实现。

## 焦点交接

当检测到 IME 从显示切换为隐藏时：

1. 清除正文 EditText 焦点；
2. 临时阻止子 View 抢占焦点；
3. 请求 Editor Root 焦点；
4. 恢复原 descendantFocusability；
5. 必要时在 80ms 后重试一次根焦点请求。

## 探测文件

\`\`\`text
probes/cliphub_editor_keyboard_probe_042.js
probes/cliphub_editor_keyboard_probe_042_impl.js
\`\`\`

加载器固定读取实现提交：

\`\`\`text
${implementation_commit}
\`\`\`

## 三个截图场景

1. 输入法显示的短文本页面；
2. 120 行长文本末尾页面；
3. 第一次返回隐藏键盘、恢复底部浮层并完成根焦点交接的页面。

探测随后自动发送第二次返回，验证 Navigation 关闭 Editor。

## 关键通过条件

\`\`\`text
firstBackAfter.inputFocused=false
focusReleasedAfterImeHide=true
focusReleaseCount>=1
rootFocusRequestedAfterImeHide=true
rootFocusedAfterImeHide=true
rootFocused=true
secondBackClosedEditor=true
secondBackNavigationHandled=true
\`\`\`

## 回传要求

- 三张完整未裁剪截图；
- 完整 JSON；
- 运行期间不要手动点击返回、关闭或保存。
EOF

node --check probes/cliphub_editor_keyboard_probe_042.js
node --check probes/cliphub_editor_keyboard_probe_042_impl.js
if [ -f scripts/check_es5.py ]; then python3 scripts/check_es5.py; fi
git diff --check

git add probes/cliphub_editor_keyboard_probe_042.js \
  docs/新增编辑焦点交接探测042说明.md
git rm -r "$HELPER_DIR" "$WORKFLOW_PATH"
git commit -m "test: add editor focus handoff probe 042"
git push origin "HEAD:$BRANCH"
