#!/usr/bin/env bash
set -euo pipefail

BRANCH="agent/initialize-project-skeleton"
HELPER_DIR=".github/cliphub-editor-ime-avoidance"
WORKFLOW_PATH=".github/workflows/cliphub-editor-ime-avoidance.yml"

if [ "$(git hash-object src/ch_10_editor.js)" != "da71412fd26c506b64955830fed2844b432aca7c" ]; then
  echo "Unexpected ch_10_editor.js base" >&2
  exit 1
fi
if [ "$(git hash-object module-manifest.json)" != "6a527bc86fbfe582fa956f643522fefe66eb81d3" ]; then
  echo "Unexpected module-manifest.json base" >&2
  exit 1
fi
if [ "$(git hash-object docs/开发计划.md)" != "e110f55dbaabddb8fd4be09efbd3018361ee4c7c" ]; then
  echo "Unexpected development plan base" >&2
  exit 1
fi
if [ "$(git hash-object docs/阶段3D2新UI全量复刻方案.md)" != "15d1a8b238e9fa22ef52f8173db9e711abb15499" ]; then
  echo "Unexpected stage plan base" >&2
  exit 1
fi

python3 - <<'PYEDITOR'
from pathlib import Path

path = Path('src/ch_10_editor.js')
text = path.read_text(encoding='utf-8')

replacements = [
    (
'''    var WindowManager = Packages.android.view.WindowManager;
    var PixelFormat = Packages.android.graphics.PixelFormat;''',
'''    var WindowManager = Packages.android.view.WindowManager;
    var WindowInsets = Packages.android.view.WindowInsets;
    var PixelFormat = Packages.android.graphics.PixelFormat;'''
    ),
    (
'''    var layoutObserver = null;
    var layoutListener = null;
    var createTagView = null;''',
'''    var layoutObserver = null;
    var layoutListener = null;
    var imePollRunnable = null;
    var imePollGeneration = 0;
    var createTagView = null;'''
    ),
    (
'''        keyboardShowCount: 0,
        keyboardHideCount: 0,
        lastKeyboardVisible: false,
        panelGravity: "center",''',
'''        keyboardShowCount: 0,
        keyboardHideCount: 0,
        lastKeyboardVisible: false,
        imeInsetsSupported: false,
        imeInsetSource: "none",
        imeInsetBottomDp: 0,
        systemTopInsetDp: 0,
        availableAboveImeDp: 0,
        keyboardAvoidanceApplied: false,
        keyboardAvoidanceApplyCount: 0,
        keyboardAvoidanceRestoreCount: 0,
        windowLayoutUpdateCount: 0,
        imePollCount: 0,
        normalPanelHeightDp: 0,
        currentPanelHeightDp: 0,
        currentPanelTopDp: 0,
        panelGravity: "center",'''
    ),
    (
'''        state.editorStyle = "reference_editor_v2";''',
'''        state.editorStyle = "reference_editor_v3";'''
    ),
    (
'''            state.panelHeightDp = size.heightDp;
            state.dimAmount = Number(panelParams.dimAmount);''',
'''            state.panelHeightDp = size.heightDp;
            state.normalPanelHeightDp = size.heightDp;
            state.currentPanelHeightDp = size.heightDp;
            state.currentPanelTopDp = state.mode === "tags" ? 0 :
                Math.max(0, pxToDp(Number(displayMetrics().heightPixels) -
                    Number(size.height) - dp(10)));
            state.dimAmount = Number(panelParams.dimAmount);'''
    ),
    (
'''            keyboardShowCount: Number(state.keyboardShowCount),
            keyboardHideCount: Number(state.keyboardHideCount),
            panelGravity: state.panelGravity,''',
'''            keyboardShowCount: Number(state.keyboardShowCount),
            keyboardHideCount: Number(state.keyboardHideCount),
            imeInsetsSupported: state.imeInsetsSupported === true,
            imeInsetSource: state.imeInsetSource,
            imeInsetBottomDp: Number(state.imeInsetBottomDp),
            systemTopInsetDp: Number(state.systemTopInsetDp),
            availableAboveImeDp: Number(state.availableAboveImeDp),
            keyboardAvoidanceApplied:
                state.keyboardAvoidanceApplied === true,
            keyboardAvoidanceApplyCount:
                Number(state.keyboardAvoidanceApplyCount),
            keyboardAvoidanceRestoreCount:
                Number(state.keyboardAvoidanceRestoreCount),
            windowLayoutUpdateCount:
                Number(state.windowLayoutUpdateCount),
            imePollCount: Number(state.imePollCount),
            normalPanelHeightDp: Number(state.normalPanelHeightDp),
            currentPanelHeightDp: Number(state.currentPanelHeightDp),
            currentPanelTopDp: Number(state.currentPanelTopDp),
            panelGravity: state.panelGravity,'''
    ),
    (
'''            keyboardShowCount: 0, keyboardHideCount: 0,
            lastKeyboardVisible: false, panelGravity: "center",
            panelBottomMarginDp: 0,''',
'''            keyboardShowCount: 0, keyboardHideCount: 0,
            lastKeyboardVisible: false, imeInsetsSupported: false,
            imeInsetSource: "none", imeInsetBottomDp: 0,
            systemTopInsetDp: 0, availableAboveImeDp: 0,
            keyboardAvoidanceApplied: false,
            keyboardAvoidanceApplyCount: 0,
            keyboardAvoidanceRestoreCount: 0,
            windowLayoutUpdateCount: 0, imePollCount: 0,
            normalPanelHeightDp: 0, currentPanelHeightDp: 0,
            currentPanelTopDp: 0, panelGravity: "center",
            panelBottomMarginDp: 0,'''
    ),
    (
'''        MODULE_VERSION: 6,''',
'''        MODULE_VERSION: 7,'''
    )
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit('Expected one match, got %d for:\n%s' % (count, old))
    text = text.replace(old, new, 1)

start = text.index('    function measureEditorLayout() {')
end = text.index('    function scrollInputToEndOnMain() {', start)
new_block = r'''    function statusBarHeightPx() {
        var resources;
        var resourceId;
        try {
            resources = appContext.getResources();
            resourceId = Number(resources.getIdentifier(
                "status_bar_height", "dimen", "android"));
            if (resourceId > 0) {
                return Number(resources.getDimensionPixelSize(resourceId));
            }
        } catch (ignored) {}
        return dp(24);
    }

    function inputMethodVisibleHeightPx() {
        var height = 0;
        var method;
        var parameterTypes;
        var argumentsArray;
        if (inputMethodManager === null) { return 0; }
        try {
            height = Number(inputMethodManager
                .getInputMethodWindowVisibleHeight());
            if (isFinite(height) && height > 0) { return height; }
        } catch (ignoredDirect) {}
        try {
            parameterTypes = Packages.java.lang.reflect.Array.newInstance(
                Packages.java.lang.Class, 0);
            argumentsArray = Packages.java.lang.reflect.Array.newInstance(
                Packages.java.lang.Object, 0);
            method = inputMethodManager.getClass().getDeclaredMethod(
                "getInputMethodWindowVisibleHeight", parameterTypes);
            method.setAccessible(true);
            height = Number(method.invoke(inputMethodManager, argumentsArray));
            return isFinite(height) && height > 0 ? height : 0;
        } catch (ignoredReflection) { return 0; }
    }

    function readImeState() {
        var metrics = displayMetrics();
        var output = {
            visible: false,
            bottomPx: 0,
            topInsetPx: statusBarHeightPx(),
            source: "none",
            supported: false,
            screenHeightPx: Number(metrics.heightPixels),
            visibleBottomPx: Number(metrics.heightPixels)
        };
        var rootInsets;
        var imeMask;
        var systemMask;
        var imeInsets;
        var systemInsets;
        var immHeight;
        var frame;
        var frameGap;
        if (panelRoot === null) { return output; }
        if (Build.VERSION.SDK_INT >= 30) {
            try {
                rootInsets = panelRoot.getRootWindowInsets();
                if (rootInsets !== null) {
                    imeMask = WindowInsets.Type.ime();
                    systemMask = WindowInsets.Type.systemBars();
                    imeInsets = rootInsets.getInsets(imeMask);
                    systemInsets = rootInsets.getInsets(systemMask);
                    output.bottomPx = Math.max(0,
                        Number(imeInsets.bottom));
                    output.topInsetPx = Math.max(output.topInsetPx,
                        Number(systemInsets.top));
                    output.visible = rootInsets.isVisible(imeMask) ||
                        output.bottomPx >= dp(120);
                    output.source = "root_window_insets";
                    output.supported = true;
                }
            } catch (ignoredInsets) {}
        }
        immHeight = inputMethodVisibleHeightPx();
        if (immHeight > output.bottomPx) {
            output.bottomPx = immHeight;
            output.visible = immHeight >= dp(120);
            output.source = "input_method_visible_height";
            output.supported = true;
        }
        try {
            frame = new Rect();
            panelRoot.getWindowVisibleDisplayFrame(frame);
            output.topInsetPx = Math.max(output.topInsetPx,
                Number(frame.top));
            frameGap = Math.max(0,
                Number(metrics.heightPixels) - Number(frame.bottom));
            if (frameGap > output.bottomPx && frameGap >= dp(120)) {
                output.bottomPx = frameGap;
                output.visible = true;
                output.source = "visible_display_frame";
                output.supported = true;
            }
        } catch (ignoredFrame) {}
        if (!output.visible) { output.bottomPx = 0; }
        output.visibleBottomPx = Number(metrics.heightPixels) -
            Number(output.bottomPx);
        return output;
    }

    function applyEditorImeLayout(ime) {
        var metrics;
        var normalHeightPx;
        var targetHeightPx;
        var targetTopPx;
        var targetGravity;
        var targetY;
        var keyboardTopPx;
        var topSafePx;
        var availablePx;
        var changed = false;
        var wasApplied;
        if (panelRoot === null || panelParams === null ||
                state.mode === "tags") {
            return false;
        }
        metrics = displayMetrics();
        normalHeightPx = dp(Math.max(300,
            Number(state.normalPanelHeightDp || state.panelHeightDp || 590)));
        wasApplied = state.keyboardAvoidanceApplied === true;
        if (ime.visible && Number(ime.bottomPx) >= dp(120)) {
            keyboardTopPx = Math.max(0,
                Number(metrics.heightPixels) - Number(ime.bottomPx));
            topSafePx = Math.max(dp(6), Number(ime.topInsetPx));
            availablePx = Math.max(dp(280),
                keyboardTopPx - topSafePx - dp(6));
            targetHeightPx = Math.min(normalHeightPx, availablePx);
            targetTopPx = Math.max(topSafePx,
                keyboardTopPx - dp(6) - targetHeightPx);
            targetGravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
            targetY = targetTopPx;
            state.availableAboveImeDp = pxToDp(availablePx);
            state.keyboardAvoidanceApplied = true;
            if (!wasApplied) { state.keyboardAvoidanceApplyCount += 1; }
            state.panelGravity = "ime_top";
            state.panelBottomMarginDp = 6;
        } else {
            targetHeightPx = normalHeightPx;
            targetGravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
            targetY = dp(10);
            targetTopPx = Math.max(0,
                Number(metrics.heightPixels) - targetHeightPx - targetY);
            state.availableAboveImeDp = pxToDp(Number(metrics.heightPixels));
            state.keyboardAvoidanceApplied = false;
            if (wasApplied) { state.keyboardAvoidanceRestoreCount += 1; }
            state.panelGravity = "bottom";
            state.panelBottomMarginDp = 10;
        }
        if (Number(panelParams.height) !== Number(targetHeightPx)) {
            panelParams.height = targetHeightPx;
            changed = true;
        }
        if (Number(panelParams.gravity) !== Number(targetGravity)) {
            panelParams.gravity = targetGravity;
            changed = true;
        }
        if (Number(panelParams.y) !== Number(targetY)) {
            panelParams.y = targetY;
            changed = true;
        }
        state.currentPanelHeightDp = pxToDp(targetHeightPx);
        state.currentPanelTopDp = pxToDp(targetTopPx);
        if (changed && state.attached && panelRoot.isAttachedToWindow()) {
            windowManager.updateViewLayout(panelRoot, panelParams);
            state.windowLayoutUpdateCount += 1;
        }
        return changed;
    }

    function measureEditorLayout(imeSnapshot) {
        var ime = imeSnapshot || readImeState();
        var metrics;
        var visibleHeightPx = 0;
        var rootHeightPx = 0;
        var viewportHeightPx = 0;
        var inputHeightPx = 0;
        var footerTopPx = 0;
        var footerBottomPx = 0;
        var footerScreenBottomPx = 0;
        var keyboardTopPx = 0;
        var location;
        var length = 0;
        var selectionStart = 0;
        var selectionEnd = 0;
        if (panelRoot === null || state.mode === "tags") { return false; }
        try {
            metrics = displayMetrics();
            visibleHeightPx = Math.max(0,
                Number(metrics.heightPixels) - Number(ime.bottomPx) -
                    Number(ime.topInsetPx));
            keyboardTopPx = Number(metrics.heightPixels) -
                Number(ime.bottomPx);
            rootHeightPx = Number(panelRoot.getHeight());
            if (contentScrollView !== null) {
                viewportHeightPx = Number(contentScrollView.getHeight());
            }
            if (contentInput !== null) {
                inputHeightPx = Number(contentInput.getHeight());
                length = String(contentInput.getText()).length;
                selectionStart = Number(contentInput.getSelectionStart());
                selectionEnd = Number(contentInput.getSelectionEnd());
            }
            if (editorFooterView !== null) {
                footerTopPx = Number(editorFooterView.getTop());
                footerBottomPx = Number(editorFooterView.getBottom());
                location = Packages.java.lang.reflect.Array.newInstance(
                    Packages.java.lang.Integer.TYPE, 2);
                editorFooterView.getLocationOnScreen(location);
                footerScreenBottomPx = Number(location[1]) +
                    Number(editorFooterView.getHeight());
            }
            if (state.layoutMeasureCount > 0 &&
                    state.lastKeyboardVisible !== ime.visible) {
                if (ime.visible) { state.keyboardShowCount += 1; }
                else { state.keyboardHideCount += 1; }
            }
            state.lastKeyboardVisible = ime.visible;
            state.keyboardVisible = ime.visible;
            state.keyboardInsetDp = pxToDp(Number(ime.bottomPx));
            state.imeInsetBottomDp = pxToDp(Number(ime.bottomPx));
            state.imeInsetSource = String(ime.source || "none");
            state.imeInsetsSupported = ime.supported === true;
            state.systemTopInsetDp = pxToDp(Number(ime.topInsetPx));
            state.visibleFrameHeightDp = pxToDp(visibleHeightPx);
            state.visibleFrameBottomDp = pxToDp(keyboardTopPx);
            state.rootMeasuredHeightDp = pxToDp(rootHeightPx);
            state.inputViewportHeightDp = pxToDp(viewportHeightPx);
            state.inputMeasuredHeightDp = pxToDp(inputHeightPx);
            state.footerTopDp = pxToDp(footerTopPx);
            state.footerBottomDp = pxToDp(footerBottomPx);
            state.footerScreenBottomDp = pxToDp(footerScreenBottomPx);
            state.footerVisibleInRoot = editorFooterView !== null &&
                footerTopPx >= 0 && footerBottomPx <= rootHeightPx + dp(2);
            state.footerAboveKeyboard = editorFooterView !== null &&
                footerScreenBottomPx <= keyboardTopPx + dp(2);
            state.inputViewportAboveFooter =
                contentScrollView !== null && editorFooterView !== null &&
                Number(contentScrollView.getBottom()) <= footerTopPx + dp(1);
            state.inputCanScrollUp = contentInput !== null &&
                (contentInput.canScrollVertically(-1) ||
                    (contentScrollView !== null &&
                        contentScrollView.canScrollVertically(-1)));
            state.inputCanScrollDown = contentInput !== null &&
                (contentInput.canScrollVertically(1) ||
                    (contentScrollView !== null &&
                        contentScrollView.canScrollVertically(1)));
            state.selectionStart = selectionStart;
            state.selectionEnd = selectionEnd;
            state.cursorAtEnd = contentInput !== null &&
                selectionStart === length && selectionEnd === length;
            state.layoutMeasureCount += 1;
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function pollEditorIme(generation) {
        var ime;
        if (generation !== imePollGeneration || !state.attached ||
                panelRoot === null || state.mode === "tags") {
            return false;
        }
        state.imePollCount += 1;
        ime = readImeState();
        applyEditorImeLayout(ime);
        measureEditorLayout(ime);
        return true;
    }

    function stopEditorImePolling() {
        imePollGeneration += 1;
        if (mainHandler !== null && imePollRunnable !== null) {
            try { mainHandler.removeCallbacks(imePollRunnable); }
            catch (ignored) {}
        }
        imePollRunnable = null;
        return true;
    }

    function startEditorImePolling() {
        var generation;
        stopEditorImePolling();
        generation = imePollGeneration;
        imePollRunnable = new Packages.java.lang.Runnable({
            run: function () {
                if (!pollEditorIme(generation)) { return; }
                if (mainHandler !== null && imePollRunnable !== null) {
                    mainHandler.postDelayed(imePollRunnable, 90);
                }
            }
        });
        mainHandler.post(imePollRunnable);
        return true;
    }

    function installEditorLayoutObserver() {
        if (panelRoot === null || state.mode === "tags") { return false; }
        try {
            layoutObserver = panelRoot.getViewTreeObserver();
            layoutListener = new JavaAdapter(
                Packages.android.view.ViewTreeObserver.OnGlobalLayoutListener, {
                    onGlobalLayout: function () {
                        var ime = readImeState();
                        applyEditorImeLayout(ime);
                        measureEditorLayout(ime);
                    }
                });
            layoutObserver.addOnGlobalLayoutListener(layoutListener);
            startEditorImePolling();
            mainHandler.postDelayed(new Packages.java.lang.Runnable({
                run: function () {
                    var ime = readImeState();
                    applyEditorImeLayout(ime);
                    measureEditorLayout(ime);
                }
            }), 180);
            return true;
        } catch (error) {
            state.lastError = String(error);
            startEditorImePolling();
            return false;
        }
    }

'''
text = text[:start] + new_block + text[end:]

old = '''    function clearViews() {
        try {
            if (layoutObserver !== null && layoutListener !== null &&'''
new = '''    function clearViews() {
        stopEditorImePolling();
        try {
            if (layoutObserver !== null && layoutListener !== null &&'''
if text.count(old) != 1:
    raise SystemExit('clearViews marker not found')
text = text.replace(old, new, 1)

old = '''        state.cursorAtEnd = false;
    }

    function closePanel(reason) {'''
new = '''        state.cursorAtEnd = false;
        state.imeInsetsSupported = false;
        state.imeInsetSource = "none";
        state.imeInsetBottomDp = 0;
        state.systemTopInsetDp = 0;
        state.availableAboveImeDp = 0;
        state.keyboardAvoidanceApplied = false;
        state.currentPanelHeightDp = 0;
        state.currentPanelTopDp = 0;
    }

    function closePanel(reason) {'''
if text.count(old) != 1:
    raise SystemExit('clear state marker not found')
text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
PYEDITOR

cp probes/cliphub_editor_keyboard_probe_040_impl.js \
  probes/cliphub_editor_keyboard_probe_041_impl.js

python3 - <<'PYPROBE'
from pathlib import Path

path = Path('probes/cliphub_editor_keyboard_probe_041_impl.js')
text = path.read_text(encoding='utf-8')
text = text.replace('040', '041')
text = text.replace('20260722.33', '20260722.34')
text = text.replace('editorModuleVersion === 6', 'editorModuleVersion === 7')
text = text.replace('reference_editor_v2', 'reference_editor_v3')
text = text.replace(
'''                        current.footerVisibleInRoot === true &&
                        current.footerAboveKeyboard === true &&
                        current.inputViewportAboveFooter === true;''',
'''                        current.imeInsetsSupported === true &&
                        current.imeInsetSource !== "none" &&
                        current.keyboardAvoidanceApplied === true &&
                        current.keyboardAvoidanceApplyCount >= 1 &&
                        current.windowLayoutUpdateCount >= 1 &&
                        current.imePollCount >= 1 &&
                        current.currentPanelHeightDp > 0 &&
                        current.footerVisibleInRoot === true &&
                        current.footerAboveKeyboard === true &&
                        current.inputViewportAboveFooter === true;''', 1)
text = text.replace(
'''                result.keyboardScene.footerAboveKeyboard === true &&
                result.keyboardScene.inputViewportHeightDp >= 72;''',
'''                result.keyboardScene.imeInsetsSupported === true &&
                result.keyboardScene.keyboardAvoidanceApplied === true &&
                result.keyboardScene.keyboardAvoidanceApplyCount >= 1 &&
                result.keyboardScene.windowLayoutUpdateCount >= 1 &&
                result.keyboardScene.footerAboveKeyboard === true &&
                result.keyboardScene.inputViewportHeightDp >= 72;''', 1)
text = text.replace(
'''                    current.footerVisibleInRoot === true &&
                    current.footerAboveKeyboard === true &&
                    current.inputViewportAboveFooter === true;''',
'''                    current.keyboardAvoidanceApplied === true &&
                    current.footerVisibleInRoot === true &&
                    current.footerAboveKeyboard === true &&
                    current.inputViewportAboveFooter === true;''', 1)
text = text.replace(
'''                return current.attached === true &&
                    current.keyboardVisible === false;''',
'''                return current.attached === true &&
                    current.keyboardVisible === false &&
                    current.keyboardAvoidanceApplied === false &&
                    current.panelGravity === "bottom";''', 1)
text = text.replace(
'''                result.keyboardScene.softInputAdjustResize === true &&
                result.keyboardCompressionObserved === true &&''',
'''                result.keyboardScene.softInputAdjustResize === true &&
                result.keyboardScene.imeInsetsSupported === true &&
                result.keyboardScene.keyboardAvoidanceApplied === true &&
                result.keyboardScene.footerAboveKeyboard === true &&
                result.keyboardCompressionObserved === true &&''', 1)
path.write_text(text, encoding='utf-8')
PYPROBE

python3 - <<'PYDOCS'
from pathlib import Path

plan_path = Path('docs/开发计划.md')
plan = plan_path.read_text(encoding='utf-8')
plan = plan.replace(
'''- [x] 新增探测 040
- [ ] 运行探测 040 并回传三张未裁剪截图与完整 JSON
- [ ] 根据键盘与长文本真机结果完成第二轮尺寸校正

当前边界：本轮只增加 Editor 输入法和布局适配测量，不修改 Repository 保存语义、不提前改造标签管理、不修改 Navigation v3。''',
'''- [x] 新增探测 040
- [x] 探测 040：输入法实际显示，但 Overlay 未随 `ADJUST_RESIZE` 收缩，固定底栏被键盘覆盖
- [x] 确认 `OnGlobalLayoutListener` 和 `getWindowVisibleDisplayFrame()` 在该窗口上未产生有效测量
- [x] 完成 Editor v7 / `reference_editor_v3` 输入法主动避让
- [x] Android 11+ 优先读取 Root WindowInsets，并以 InputMethodManager 可见高度和可见 Frame 作为回退
- [x] 键盘显示时仅更新现有 Editor WindowManager 参数，将窗口贴合到输入法上方
- [x] 键盘隐藏后恢复原 590dp 底部浮层位置
- [x] 增加 90ms 生命周期内 IME 轮询、窗口更新计数和避让状态
- [x] 保持 Repository 保存语义、标签管理和 Navigation v3 不变
- [x] 发布模块集 `20260722.34`
- [x] 新增探测 041
- [ ] 运行探测 041 并回传三张未裁剪截图与完整 JSON
- [ ] 根据真机结果确认新增 / 编辑页输入法最终基线

当前边界：本轮只对现有 Editor WindowManager 窗口执行输入法避让，不创建第二窗口、不增加透明触摸层、不修改 Repository 或 Navigation v3。''', 1)
plan = plan.replace('moduleSetVersion=20260722.33', 'moduleSetVersion=20260722.34', 1)
plan = plan.replace('Editor=6', 'Editor=7', 1)
start = plan.index('## 下一步\n')
end = plan.index('\n### 后续阶段 3E：入口版本 5', start)
next_text = '''## 下一步

### 运行新增 / 编辑输入法主动避让探测 041

1. 在 Termux 同步 `agent/initialize-project-skeleton`；
2. 运行 `ClipHub.js`，确认模块集为 `.34`；
3. 运行 `ClipHub 新增编辑输入法避让探测041`；
4. 场景 1 截取输入法显示且固定底栏完整位于键盘上方的短文本页；
5. 场景 2 截取长文本光标位于末尾的编辑页；
6. 场景 3 截取首次返回收起键盘后恢复为底部浮层的页面；
7. 回传三张未裁剪截图和完整 JSON；
8. 检查 `keyboardAvoidanceApplied=true`、IME 来源有效、窗口布局至少更新一次；
9. 检查首次返回只隐藏键盘、第二次返回关闭 Editor；
10. 检查未保存内容不入库、正式实例恢复和清理链正常。'''
plan = plan[:start] + next_text + plan[end:]
plan_path.write_text(plan, encoding='utf-8')

stage_path = Path('docs/阶段3D2新UI全量复刻方案.md')
stage = stage_path.read_text(encoding='utf-8')
stage = stage.replace(
'''- [x] 发布模块集 `.33` 并新增输入法与长文本探测 040；
- [ ] 运行探测 040，验证首次返回仅隐藏键盘、第二次返回关闭 Editor；
- [ ] 根据键盘截图决定是否需要第二轮尺寸校正。''',
'''- [x] 发布模块集 `.33` 并新增输入法与长文本探测 040；
- [x] 探测 040 确认 ColorOS Overlay 不响应 `SOFT_INPUT_ADJUST_RESIZE`，固定底栏被键盘覆盖；
- [x] 完成 Editor v7 主动输入法避让：WindowInsets 主路径、InputMethodManager 高度和可见 Frame 回退；
- [x] 键盘显示时仅更新现有窗口高度、重力和 Y 坐标，隐藏后恢复原底部浮层；
- [x] 保持 Navigation v3、Repository 保存语义和标签管理不变；
- [x] 发布模块集 `.34` 并新增探测 041；
- [ ] 运行探测 041，验证底栏位于键盘上方及两层返回；
- [ ] 确认新增 / 编辑页输入法最终视觉基线。''', 1)
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
data['moduleSetVersion'] = '20260722.34'
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
             'probes/cliphub_editor_keyboard_probe_041_impl.js']:
    text = Path(name).read_text(encoding='utf-8')
    forbidden = []
    if re.search(r'\b(?:let|const)\s+', text): forbidden.append('let/const')
    if '=>' in text: forbidden.append('arrow')
    if '`' in text: forbidden.append('template literal')
    if re.search(r'\bclass\s+[A-Za-z_$]', text): forbidden.append('class')
    if forbidden:
        raise SystemExit(name + ': ' + ', '.join(forbidden))

editor = Path('src/ch_10_editor.js').read_text(encoding='utf-8')
assert 'MODULE_VERSION: 7' in editor
assert 'reference_editor_v3' in editor
assert 'WindowInsets.Type.ime()' in editor
assert 'getInputMethodWindowVisibleHeight' in editor
assert 'applyEditorImeLayout' in editor
assert 'keyboardAvoidanceApplied' in editor
assert 'windowManager.updateViewLayout(panelRoot, panelParams)' in editor
assert 'mainHandler.postDelayed(imePollRunnable, 90)' in editor
assert 'ClipHub.Repository.updateItem(id, { content: content })' in editor

manifest = json.loads(Path('module-manifest.json').read_text(encoding='utf-8'))
assert manifest['moduleSetVersion'] == '20260722.34'
assert manifest['entryMinVersion'] == 4
assert len(manifest['modules']) == 15

probe = Path('probes/cliphub_editor_keyboard_probe_041_impl.js').read_text(encoding='utf-8')
assert 'REQUIRED_SET = "20260722.34"' in probe
assert 'editorModuleVersion === 7' in probe
assert 'reference_editor_v3' in probe
assert 'keyboardAvoidanceApplied' in probe
assert 'imeInsetSource' in probe
assert 'firstBackHidKeyboard' in probe
assert 'secondBackClosedEditor' in probe
PYCHECK

node --check src/ch_10_editor.js
node --check probes/cliphub_editor_keyboard_probe_041_impl.js
if [ -f scripts/check_es5.py ]; then python3 scripts/check_es5.py; fi
git diff --check

git config user.name "ClipHub Automation"
git config user.email "actions@github.com"
git add src/ch_10_editor.js module-manifest.json \
  probes/cliphub_editor_keyboard_probe_041_impl.js \
  docs/开发计划.md docs/阶段3D2新UI全量复刻方案.md
git commit -m "fix: actively avoid ime in editor overlay"
implementation_commit="$(git rev-parse HEAD)"

cp probes/cliphub_editor_keyboard_probe_040.js \
  probes/cliphub_editor_keyboard_probe_041.js
python3 - "$implementation_commit" <<'PYLOADER'
from pathlib import Path
import sys

path = Path('probes/cliphub_editor_keyboard_probe_041.js')
text = path.read_text(encoding='utf-8')
text = text.replace('040', '041')
text = text.replace('20260722.33', '20260722.34')
text = text.replace('editorModuleVersion === 6', 'editorModuleVersion === 7')
text = text.replace('reference_editor_v2', 'reference_editor_v3')
text = text.replace('80c338e2bc45d4a74b86cca8fb4ad11260e6d0b3',
                    sys.argv[1], 1)
old = '''                source.indexOf("footerAboveKeyboard") < 0) {'''
new = '''                source.indexOf("footerAboveKeyboard") < 0 ||
                source.indexOf("keyboardAvoidanceApplied") < 0 ||
                source.indexOf("imeInsetSource") < 0) {'''
if text.count(old) != 1:
    raise SystemExit('loader validation marker not found')
text = text.replace(old, new, 1)
path.write_text(text, encoding='utf-8')
PYLOADER

cat > docs/新增编辑输入法主动避让探测041说明.md <<EOF
# ClipHub 新增 / 编辑输入法主动避让探测 041

## 目标

验证 Android 14 / ColorOS 的 \`TYPE_APPLICATION_OVERLAY\` 不响应自动 \`ADJUST_RESIZE\` 时，Editor v7 能否主动读取输入法高度并将现有窗口完整移动到键盘上方。

## 模块集

\`\`\`text
moduleSetVersion=20260722.34
entryVersion=4
databaseSchemaVersion=2
Editor=7
Filter=9
Navigation=3
editorStyle=reference_editor_v3
\`\`\`

## 实现边界

- Android 11+ 优先使用 Root \`WindowInsets.Type.ime()\`；
- InputMethodManager 可见高度与可见 Display Frame 仅作为回退；
- 只更新原 Editor WindowManager 的高度、重力和 Y 坐标；
- 不创建第二窗口；
- 不增加透明触摸层；
- 不修改 Navigation v3；
- 不修改 Repository 保存语义；
- 标签管理保持原实现。

## 探测文件

\`\`\`text
probes/cliphub_editor_keyboard_probe_041.js
probes/cliphub_editor_keyboard_probe_041_impl.js
\`\`\`

加载器固定读取实现提交：

\`\`\`text
${implementation_commit}
\`\`\`

## 三个场景

1. 输入法已显示的短文本新增页，固定底栏必须完整位于键盘上方；
2. 120 行长文本，光标位于末尾并可向上滚动；
3. 第一次返回收起键盘后，Editor 恢复原底部浮层且仍保持打开。

探测随后自动发送第二次返回，验证 Editor 关闭并回到首页。

## 回传要求

- 三张完整未裁剪截图；
- 完整 JSON；
- 运行期间不要手动点击返回、保存或关闭。
EOF

node --check probes/cliphub_editor_keyboard_probe_041.js
node --check probes/cliphub_editor_keyboard_probe_041_impl.js
if [ -f scripts/check_es5.py ]; then python3 scripts/check_es5.py; fi
git diff --check

git add probes/cliphub_editor_keyboard_probe_041.js \
  docs/新增编辑输入法主动避让探测041说明.md
git rm -r "$HELPER_DIR" "$WORKFLOW_PATH"
git commit -m "test: add editor ime avoidance probe 041"
git push origin "HEAD:$BRANCH"
