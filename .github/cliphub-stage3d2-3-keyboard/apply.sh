#!/usr/bin/env bash
set -euo pipefail

BRANCH="agent/initialize-project-skeleton"
HELPER_DIR=".github/cliphub-stage3d2-3-keyboard"
WORKFLOW_PATH=".github/workflows/cliphub-stage3d2-3-keyboard.yml"

if [ "$(git hash-object src/ch_10_editor.js)" != "a9298ca3bb264aab925a6ad7dde014ba39cd0ab3" ]; then
  echo "Unexpected ch_10_editor.js base" >&2
  exit 1
fi
if [ "$(git hash-object module-manifest.json)" != "fbd1968ffebebcfd06b9ff412428c4c05ff0efe4" ]; then
  echo "Unexpected module-manifest.json base" >&2
  exit 1
fi
if [ "$(git hash-object docs/阶段3D2新UI全量复刻方案.md)" != "47bd1bc7a16f7ee1e5bf457be695b6b185079d8e" ]; then
  echo "Unexpected stage plan base" >&2
  exit 1
fi
if [ "$(git hash-object docs/开发计划.md)" != "3d626d2e6d39d77cd78f291e304f0d66b527333b" ]; then
  echo "Unexpected development plan base" >&2
  exit 1
fi

python3 - <<'PYEDITOR'
from pathlib import Path

path = Path('src/ch_10_editor.js')
text = path.read_text(encoding='utf-8')

replacements = [
    (
'''    var Color = Packages.android.graphics.Color;
    var GradientDrawable = Packages.android.graphics.drawable.GradientDrawable;''',
'''    var Color = Packages.android.graphics.Color;
    var Rect = Packages.android.graphics.Rect;
    var GradientDrawable = Packages.android.graphics.drawable.GradientDrawable;'''
    ),
    (
'''    var metadataTypeView = null;
    var editorFooterView = null;
    var createTagView = null;''',
'''    var metadataTypeView = null;
    var editorFooterView = null;
    var contentScrollView = null;
    var layoutObserver = null;
    var layoutListener = null;
    var createTagView = null;'''
    ),
    (
'''        requestKeyboardOnOpen: true,
        keyboardRequestedOnOpen: false,
        panelGravity: "center",''',
'''        requestKeyboardOnOpen: true,
        keyboardRequestedOnOpen: false,
        softInputMode: 0,
        softInputAdjustResize: false,
        keyboardVisible: false,
        keyboardInsetDp: 0,
        visibleFrameHeightDp: 0,
        visibleFrameBottomDp: 0,
        rootMeasuredHeightDp: 0,
        inputViewportHeightDp: 0,
        inputMeasuredHeightDp: 0,
        footerTopDp: 0,
        footerBottomDp: 0,
        footerScreenBottomDp: 0,
        footerVisibleInRoot: false,
        footerAboveKeyboard: false,
        inputViewportAboveFooter: false,
        inputCanScrollUp: false,
        inputCanScrollDown: false,
        selectionStart: 0,
        selectionEnd: 0,
        cursorAtEnd: false,
        layoutMeasureCount: 0,
        keyboardShowCount: 0,
        keyboardHideCount: 0,
        lastKeyboardVisible: false,
        panelGravity: "center",'''
    ),
    (
'''    function clearViews() {
        panelRoot = null;''',
'''    function clearViews() {
        try {
            if (layoutObserver !== null && layoutListener !== null &&
                    layoutObserver.isAlive()) {
                layoutObserver.removeOnGlobalLayoutListener(layoutListener);
            }
        } catch (ignoredLayoutObserver) {}
        layoutObserver = null;
        layoutListener = null;
        contentScrollView = null;
        panelRoot = null;'''
    ),
    (
'''        state.footerActionCount = 0;
        state.editorFooterHeightDp = 0;
    }

    function closePanel(reason) {''',
'''        state.footerActionCount = 0;
        state.editorFooterHeightDp = 0;
        state.keyboardVisible = false;
        state.keyboardInsetDp = 0;
        state.visibleFrameHeightDp = 0;
        state.visibleFrameBottomDp = 0;
        state.rootMeasuredHeightDp = 0;
        state.inputViewportHeightDp = 0;
        state.inputMeasuredHeightDp = 0;
        state.footerTopDp = 0;
        state.footerBottomDp = 0;
        state.footerScreenBottomDp = 0;
        state.footerVisibleInRoot = false;
        state.footerAboveKeyboard = false;
        state.inputViewportAboveFooter = false;
        state.inputCanScrollUp = false;
        state.inputCanScrollDown = false;
        state.selectionStart = 0;
        state.selectionEnd = 0;
        state.cursorAtEnd = false;
    }

    function closePanel(reason) {'''
    ),
    (
'''        return length;
    }

    function emitMutation(name, id, mutation, extra) {''',
'''        return length;
    }

    function measureEditorLayout() {
        var frame;
        var metrics;
        var visibleHeightPx = 0;
        var keyboardInsetDp = 0;
        var keyboardVisible = false;
        var rootHeightPx = 0;
        var viewportHeightPx = 0;
        var inputHeightPx = 0;
        var footerTopPx = 0;
        var footerBottomPx = 0;
        var footerScreenBottomPx = 0;
        var location;
        var length = 0;
        var selectionStart = 0;
        var selectionEnd = 0;
        if (panelRoot === null || state.mode === "tags") { return false; }
        try {
            frame = new Rect();
            panelRoot.getWindowVisibleDisplayFrame(frame);
            metrics = displayMetrics();
            visibleHeightPx = Math.max(0,
                Number(frame.bottom) - Number(frame.top));
            keyboardInsetDp = Math.max(0, pxToDp(
                Number(metrics.heightPixels) - visibleHeightPx));
            keyboardVisible = keyboardInsetDp >= 120;
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
                    state.lastKeyboardVisible !== keyboardVisible) {
                if (keyboardVisible) { state.keyboardShowCount += 1; }
                else { state.keyboardHideCount += 1; }
            }
            state.lastKeyboardVisible = keyboardVisible;
            state.keyboardVisible = keyboardVisible;
            state.keyboardInsetDp = keyboardInsetDp;
            state.visibleFrameHeightDp = pxToDp(visibleHeightPx);
            state.visibleFrameBottomDp = pxToDp(Number(frame.bottom));
            state.rootMeasuredHeightDp = pxToDp(rootHeightPx);
            state.inputViewportHeightDp = pxToDp(viewportHeightPx);
            state.inputMeasuredHeightDp = pxToDp(inputHeightPx);
            state.footerTopDp = pxToDp(footerTopPx);
            state.footerBottomDp = pxToDp(footerBottomPx);
            state.footerScreenBottomDp = pxToDp(footerScreenBottomPx);
            state.footerVisibleInRoot = editorFooterView !== null &&
                footerTopPx >= 0 && footerBottomPx <= rootHeightPx + dp(2);
            state.footerAboveKeyboard = editorFooterView !== null &&
                footerScreenBottomPx <= Number(frame.bottom) + dp(2);
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

    function installEditorLayoutObserver() {
        if (panelRoot === null || state.mode === "tags") { return false; }
        try {
            layoutObserver = panelRoot.getViewTreeObserver();
            layoutListener = new JavaAdapter(
                Packages.android.view.ViewTreeObserver.OnGlobalLayoutListener, {
                    onGlobalLayout: function () { measureEditorLayout(); }
                });
            layoutObserver.addOnGlobalLayoutListener(layoutListener);
            mainHandler.postDelayed(new Packages.java.lang.Runnable({
                run: function () { measureEditorLayout(); }
            }), 180);
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function scrollInputToEndOnMain() {
        var length;
        if (contentInput === null) { return false; }
        length = Number(contentInput.getText().length());
        contentInput.requestFocus();
        contentInput.setSelection(length);
        if (contentScrollView !== null) {
            contentScrollView.post(new Packages.java.lang.Runnable({
                run: function () {
                    try {
                        contentScrollView.fullScroll(View.FOCUS_DOWN);
                        contentInput.setSelection(contentInput.getText().length());
                        measureEditorLayout();
                    } catch (ignored) {}
                }
            }));
        }
        mainHandler.postDelayed(new Packages.java.lang.Runnable({
            run: function () { measureEditorLayout(); }
        }), 120);
        return true;
    }

    function emitMutation(name, id, mutation, extra) {'''
    ),
    (
'''        state.editorStyle = "reference_editor_v1";''',
'''        state.editorStyle = "reference_editor_v2";'''
    ),
    (
'''        scroll.setFillViewport(true);
        scroll.setVerticalScrollBarEnabled(false);
        contentInput = new EditText(appContext);''',
'''        scroll.setFillViewport(true);
        scroll.setVerticalScrollBarEnabled(false);
        contentScrollView = scroll;
        contentInput = new EditText(appContext);'''
    ),
    (
'''        state.cancelButtonPresent = true;
        state.saveButtonPresent = true;

        if (options.requestKeyboard !== false) {''',
'''        state.cancelButtonPresent = true;
        state.saveButtonPresent = true;
        installEditorLayoutObserver();

        if (options.requestKeyboard !== false) {'''
    ),
    (
'''            panelParams.softInputMode =
                WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE |
                (requestKeyboard ?
                    WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE :
                    WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN);
            try { panelParams.setTitle("ClipHub Editor Panel"); }''',
'''            panelParams.softInputMode =
                WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE |
                (requestKeyboard ?
                    WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE :
                    WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN);
            state.softInputMode = Number(panelParams.softInputMode);
            state.softInputAdjustResize =
                (Number(panelParams.softInputMode) &
                    Number(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)) !== 0;
            try { panelParams.setTitle("ClipHub Editor Panel"); }'''
    ),
    (
'''            keyboardRequestedOnOpen:
                state.keyboardRequestedOnOpen === true,
            panelGravity: state.panelGravity,''',
'''            keyboardRequestedOnOpen:
                state.keyboardRequestedOnOpen === true,
            softInputMode: Number(state.softInputMode),
            softInputAdjustResize: state.softInputAdjustResize === true,
            keyboardVisible: state.keyboardVisible === true,
            keyboardInsetDp: Number(state.keyboardInsetDp),
            visibleFrameHeightDp: Number(state.visibleFrameHeightDp),
            visibleFrameBottomDp: Number(state.visibleFrameBottomDp),
            rootMeasuredHeightDp: Number(state.rootMeasuredHeightDp),
            inputViewportHeightDp: Number(state.inputViewportHeightDp),
            inputMeasuredHeightDp: Number(state.inputMeasuredHeightDp),
            footerTopDp: Number(state.footerTopDp),
            footerBottomDp: Number(state.footerBottomDp),
            footerScreenBottomDp: Number(state.footerScreenBottomDp),
            footerVisibleInRoot: state.footerVisibleInRoot === true,
            footerAboveKeyboard: state.footerAboveKeyboard === true,
            inputViewportAboveFooter:
                state.inputViewportAboveFooter === true,
            inputCanScrollUp: state.inputCanScrollUp === true,
            inputCanScrollDown: state.inputCanScrollDown === true,
            selectionStart: Number(state.selectionStart),
            selectionEnd: Number(state.selectionEnd),
            cursorAtEnd: state.cursorAtEnd === true,
            layoutMeasureCount: Number(state.layoutMeasureCount),
            keyboardShowCount: Number(state.keyboardShowCount),
            keyboardHideCount: Number(state.keyboardHideCount),
            panelGravity: state.panelGravity,'''
    ),
    (
'''            saveButtonPresent: false, requestKeyboardOnOpen: true,
            keyboardRequestedOnOpen: false, panelGravity: "center",
            panelBottomMarginDp: 0,''',
'''            saveButtonPresent: false, requestKeyboardOnOpen: true,
            keyboardRequestedOnOpen: false, softInputMode: 0,
            softInputAdjustResize: false, keyboardVisible: false,
            keyboardInsetDp: 0, visibleFrameHeightDp: 0,
            visibleFrameBottomDp: 0, rootMeasuredHeightDp: 0,
            inputViewportHeightDp: 0, inputMeasuredHeightDp: 0,
            footerTopDp: 0, footerBottomDp: 0, footerScreenBottomDp: 0,
            footerVisibleInRoot: false, footerAboveKeyboard: false,
            inputViewportAboveFooter: false, inputCanScrollUp: false,
            inputCanScrollDown: false, selectionStart: 0, selectionEnd: 0,
            cursorAtEnd: false, layoutMeasureCount: 0,
            keyboardShowCount: 0, keyboardHideCount: 0,
            lastKeyboardVisible: false, panelGravity: "center",
            panelBottomMarginDp: 0,'''
    ),
    (
'''        MODULE_VERSION: 5,''',
'''        MODULE_VERSION: 6,'''
    ),
    (
'''        getState: getState,
        setInputText: function (text) {''',
'''        getState: getState,
        refreshLayoutMetrics: function () {
            return requireMain(runOnMainSync(function () {
                return measureEditorLayout();
            }, 2500));
        },
        requestKeyboard: function () {
            return requireMain(runOnMainSync(function () {
                return requestKeyboardOnMain();
            }, 2500));
        },
        hideKeyboard: function () {
            return requireMain(runOnMainSync(function () {
                hideKeyboardOnMain();
                mainHandler.postDelayed(new Packages.java.lang.Runnable({
                    run: function () { measureEditorLayout(); }
                }), 160);
                return true;
            }, 2500));
        },
        scrollInputToEnd: function () {
            return requireMain(runOnMainSync(function () {
                return scrollInputToEndOnMain();
            }, 2500));
        },
        setInputText: function (text) {'''
    )
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise SystemExit('Expected one editor match, got %d for:\n%s' % (count, old))
    text = text.replace(old, new, 1)

path.write_text(text, encoding='utf-8')
PYEDITOR

cp probes/cliphub_editor_ui_probe_039_impl.js \
  probes/cliphub_editor_keyboard_probe_040_impl.js

python3 - <<'PYPROBE'
from pathlib import Path

path = Path('probes/cliphub_editor_keyboard_probe_040_impl.js')
text = path.read_text(encoding='utf-8')
text = text.replace('039', '040')
text = text.replace('20260722.32', '20260722.33')
text = text.replace('ClipHubProbe039', 'ClipHubProbe040')

start = text.index('    function main() {')
end = text.index('    try {\n        global.ClipHubEditorUiProbe040Result = main();', start)
helpers_and_main = r'''    function runShell(command) {
        var ShellCommand =
            Packages.tornaco.apps.shortx.core.proto.action.ShellCommand;
        var action = ShellCommand.newBuilder()
            .setCommand(String(command))
            .setSingleShot(true)
            .setId("ClipHub#Probe040Shell")
            .build();
        var executed = shortx.executeAction(action);
        var data = executed.contextData;
        return {
            out: String(data.get("shellOut")),
            err: String(data.get("shellErr")),
            code: Number(data.get("shellCode"))
        };
    }

    function buildLongText() {
        var lines = [];
        var index;
        for (index = 1; index <= 120; index += 1) {
            lines.push("第 " + index + " 行：ClipHub Rhino ES5 长文本输入法适配测试");
        }
        return lines.join("\n");
    }

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var formal = new File(root, "ClipHub");
        var modules = new File(formal, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var outputFile = new File(ensureDir(new File(formal, "probes")),
            "cliphub_editor_keyboard_probe_040_" + stamp(startedAt) + ".json");
        var local = localManifest(formal);
        var formalWasRunning = !lockFree(formal);
        var baseTime = startedAt - 20000;
        var existingId = null;
        var shortText = "ClipHub 输入法适配测试\nAndroid 14 / Rhino ES5";
        var longText = buildLongText();
        var countBefore = 0;
        var countAfter = 0;
        var result = {
            ok: false,
            probe: "cliphub_editor_keyboard_probe_040",
            probeVersion: 1,
            moduleSetVersion: local.moduleSetVersion || null,
            sourceRef: local.sourceRef || null,
            sceneDurationMs: SCENE_DURATION_MS,
            sceneCount: 3,
            visualScreenshotRequired: true,
            instruction: "场景1截键盘已弹出的短文本编辑页；场景2截长文本光标位于末尾的编辑页；场景3截第一次返回隐藏键盘后仍保持打开的编辑页。三张截图均不得裁剪。",
            outputPath: String(outputFile.getAbsolutePath()),
            formalWasRunning: formalWasRunning,
            startedAt: startedAt,
            repositorySaveSemanticsChanged: false,
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
            result.themeModuleVersion = Number(global.ClipHub.Theme.MODULE_VERSION);
            result.windowModuleVersion = Number(global.ClipHub.Window.MODULE_VERSION);
            result.listModuleVersion = Number(global.ClipHub.List.MODULE_VERSION);
            result.editorModuleVersion = Number(global.ClipHub.Editor.MODULE_VERSION);
            result.filterModuleVersion = Number(global.ClipHub.Filter.MODULE_VERSION);
            result.translationModuleVersion =
                Number(global.ClipHub.Translation.MODULE_VERSION);
            result.navigationModuleVersion =
                Number(global.ClipHub.Navigation.MODULE_VERSION);
            result.schemaVersion = Number(global.ClipHub.Database.getVersion());
            result.clipboardListenerStopped =
                global.ClipHub.Clipboard.stop().running === false;
            global.ClipHub.Settings.set("themeMode", "light", { cleanup: false });

            existingId = add(
                "https://developer.android.com/ Android Developers",
                "url", "com.android.chrome", "Chrome 浏览器",
                false, true, baseTime + 1000);
            result.existingId = existingId;
            countBefore = Number(global.ClipHub.Repository.countItems(false));
            result.countBefore = countBefore;
            result.homeShow = global.ClipHub.List.show({
                limit: 20, widthDp: 340, heightDp: 560
            });

            result.open = global.ClipHub.Editor.openNew({
                requestKeyboard: true
            });
            result.setShortText = global.ClipHub.Editor.setInputText(shortText);
            if (!waitFor(function () {
                    var current = global.ClipHub.Editor.getState();
                    if (!current.keyboardVisible &&
                            current.keyboardRequestedOnOpen === true) {
                        global.ClipHub.Editor.requestKeyboard();
                    }
                    return current.attachedToWindow === true &&
                        current.editorStyle === "reference_editor_v2" &&
                        current.inputFocused === true &&
                        current.keyboardRequestedOnOpen === true &&
                        current.softInputAdjustResize === true &&
                        current.keyboardVisible === true &&
                        current.keyboardInsetDp >= 120 &&
                        current.layoutMeasureCount > 0 &&
                        current.footerVisibleInRoot === true &&
                        current.footerAboveKeyboard === true &&
                        current.inputViewportAboveFooter === true;
                }, 5000)) {
                throw new Error("Keyboard scene did not become ready");
            }
            global.ClipHub.Editor.refreshLayoutMetrics();
            result.keyboardScene = global.ClipHub.Editor.getState();
            result.keyboardCompressionObserved =
                result.keyboardScene.keyboardVisible === true &&
                result.keyboardScene.keyboardInsetDp >= 120 &&
                result.keyboardScene.visibleFrameHeightDp > 0 &&
                result.keyboardScene.footerAboveKeyboard === true &&
                result.keyboardScene.inputViewportHeightDp >= 72;
            showToast("040  1/3  输入法已弹出  ·  请截完整页面");
            Thread.sleep(SCENE_DURATION_MS);

            result.setLongText = global.ClipHub.Editor.setInputText(longText);
            result.scrollToEnd = global.ClipHub.Editor.scrollInputToEnd();
            result.longTextReady = waitFor(function () {
                global.ClipHub.Editor.refreshLayoutMetrics();
                var current = global.ClipHub.Editor.getState();
                return current.attached === true &&
                    current.keyboardVisible === true &&
                    current.contentLength === longText.length &&
                    current.cursorAtEnd === true &&
                    current.inputCanScrollUp === true &&
                    current.footerVisibleInRoot === true &&
                    current.footerAboveKeyboard === true &&
                    current.inputViewportAboveFooter === true;
            }, 3500);
            result.longTextScene = global.ClipHub.Editor.getState();
            showToast("040  2/3  长文本末尾  ·  请截完整页面");
            Thread.sleep(SCENE_DURATION_MS);

            result.firstBackBefore = global.ClipHub.Editor.getState();
            result.firstBackShell = runShell("input keyevent 4");
            result.firstBackHidKeyboard = waitFor(function () {
                global.ClipHub.Editor.refreshLayoutMetrics();
                var current = global.ClipHub.Editor.getState();
                return current.attached === true &&
                    current.keyboardVisible === false;
            }, 3000);
            result.firstBackAfter = global.ClipHub.Editor.getState();
            result.firstBackKeptEditor = result.firstBackHidKeyboard === true &&
                result.firstBackAfter.attached === true;
            showToast("040  3/3  首次返回仅收起键盘  ·  请截完整页面");
            Thread.sleep(SCENE_DURATION_MS);

            result.secondBackShell = runShell("input keyevent 4");
            result.secondBackClosedEditor = waitFor(function () {
                return global.ClipHub.Editor.getState().attached === false &&
                    global.ClipHub.List.getState().visible === true;
            }, 3000);
            result.secondBackState = {
                editor: global.ClipHub.Editor.getState(),
                list: global.ClipHub.List.getState(),
                navigation: global.ClipHub.Navigation.getState()
            };
            countAfter = Number(global.ClipHub.Repository.countItems(false));
            result.countAfter = countAfter;
            result.unsavedContentPreserved = countAfter === countBefore;

            result.stop = global.ClipHub.App.stop("probe040_editor_keyboard");
            result.databaseClosed = !global.ClipHub.Database.isOpen();
            result.lockReleased = lockFree(isolated);
        } catch (error) {
            result.error = errorText(error);
            try { global.ClipHub.App.stop("probe040_error"); }
            catch (ignoredStop) {}
        } finally {
            try {
                if (formalWasRunning) {
                    result.formalRestart = lockFree(formal) ?
                        start(root, modules, formal) :
                        { ok: true, started: true, reused: true };
                } else {
                    result.formalRestart = {
                        ok: true, skipped: true,
                        reason: "formal_was_not_running"
                    };
                }
            } catch (restartError) {
                result.formalRestart = {
                    ok: false, error: errorText(restartError)
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
                result.themeModuleVersion === 2 &&
                result.windowModuleVersion === 5 &&
                result.listModuleVersion === 11 &&
                result.editorModuleVersion === 6 &&
                result.filterModuleVersion === 9 &&
                result.translationModuleVersion === 4 &&
                result.navigationModuleVersion === 3 &&
                result.clipboardListenerStopped === true &&
                result.keyboardScene &&
                result.keyboardScene.editorStyle === "reference_editor_v2" &&
                result.keyboardScene.softInputAdjustResize === true &&
                result.keyboardCompressionObserved === true &&
                result.longTextReady === true &&
                result.longTextScene &&
                result.longTextScene.cursorAtEnd === true &&
                result.longTextScene.inputCanScrollUp === true &&
                result.firstBackShell && result.firstBackShell.code === 0 &&
                result.firstBackHidKeyboard === true &&
                result.firstBackKeptEditor === true &&
                result.secondBackShell && result.secondBackShell.code === 0 &&
                result.secondBackClosedEditor === true &&
                result.secondBackState.editor.attached === false &&
                result.secondBackState.list.visible === true &&
                result.unsavedContentPreserved === true &&
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
text = text[:start] + helpers_and_main + text[end:]
text = text.replace('ClipHubEditorUiProbe040Result',
                    'ClipHubEditorKeyboardProbe040Result')
text = text.replace('editorModuleVersion === 5', 'editorModuleVersion === 6')
text = text.replace('reference_editor_v1', 'reference_editor_v2')
path.write_text(text, encoding='utf-8')
PYPROBE

python3 - <<'PYDOCS'
from pathlib import Path

stage_path = Path('docs/阶段3D2新UI全量复刻方案.md')
stage = stage_path.read_text(encoding='utf-8')
old = '''- [x] 发布模块集 `.32` 并新增探测 039；
- [ ] 运行探测 039，回传新增页和编辑页两张未裁剪截图与完整 JSON；
- [ ] 根据真机结果进行第二轮视觉校正。'''
new = '''- [x] 发布模块集 `.32` 并新增探测 039；
- [x] 探测 039：新增、编辑、取消和返回功能全部通过，两张未裁剪截图完成第一轮视觉审查；
- [x] 确认隐藏键盘场景下的第一轮新增 / 编辑页视觉基线；
- [x] Editor v6 增加输入法、可见区域、正文视口、固定底栏和长文本滚动的实际布局测量；
- [x] 保持 `SOFT_INPUT_ADJUST_RESIZE`，不修改 Navigation v3 返回实现；
- [x] 发布模块集 `.33` 并新增输入法与长文本探测 040；
- [ ] 运行探测 040，验证首次返回仅隐藏键盘、第二次返回关闭 Editor；
- [ ] 根据键盘截图决定是否需要第二轮尺寸校正。'''
if stage.count(old) != 1:
    raise SystemExit('stage 3D2-3 marker not found')
stage = stage.replace(old, new, 1)
stage_path.write_text(stage, encoding='utf-8')

plan_path = Path('docs/开发计划.md')
plan = plan_path.read_text(encoding='utf-8')
old = '''- [x] 发布模块集 `20260722.32`
- [x] 新增探测 039
- [ ] 运行探测 039 并回传新增页、编辑页两张未裁剪截图与完整 JSON
- [ ] 根据真机结果完成第二轮视觉校正

当前边界：只重构新增和编辑正文页面，不修改 Repository 保存语义，不提前改造标签管理，不修改 Navigation v3。'''
new = '''- [x] 发布模块集 `20260722.32`
- [x] 新增探测 039
- [x] 探测 039 自动验证、保存边界、取消和返回层级全部通过
- [x] 新增页与编辑页两张未裁剪截图完成第一轮视觉审查
- [x] Editor v6 / `reference_editor_v2` 增加输入法和实际布局状态测量
- [x] 测量键盘可见、键盘占用、可见区域、正文视口和固定底栏屏幕位置
- [x] 增加长文本滚动方向、光标末尾和选择区状态
- [x] 保持 `SOFT_INPUT_ADJUST_RESIZE` 和 Navigation v3 实现不变
- [x] 发布模块集 `20260722.33`
- [x] 新增探测 040
- [ ] 运行探测 040 并回传三张未裁剪截图与完整 JSON
- [ ] 根据键盘与长文本真机结果完成第二轮尺寸校正

当前边界：本轮只增加 Editor 输入法和布局适配测量，不修改 Repository 保存语义、不提前改造标签管理、不修改 Navigation v3。'''
if plan.count(old) != 1:
    raise SystemExit('development 3D2-3 marker not found')
plan = plan.replace(old, new, 1)
plan = plan.replace('moduleSetVersion=20260722.32',
                    'moduleSetVersion=20260722.33', 1)
plan = plan.replace('Editor=5', 'Editor=6', 1)
start = plan.index('## 下一步\n')
end = plan.index('\n### 后续阶段 3E：入口版本 5', start)
next_text = '''## 下一步

### 运行新增 / 编辑输入法与长文本探测 040

1. 在 Termux 同步 `agent/initialize-project-skeleton`；
2. 运行 `ClipHub.js`，确认模块集为 `.33`；
3. 运行 `ClipHub 新增编辑输入法探测040`；
4. 场景 1 截取键盘已弹出的短文本编辑页；
5. 场景 2 截取长文本光标位于末尾的编辑页；
6. 场景 3 截取首次返回收起键盘后仍保持打开的编辑页；
7. 回传三张未裁剪截图和完整 JSON；
8. 检查固定底栏始终位于键盘上方，正文视口不覆盖底栏；
9. 检查首次返回只隐藏键盘、第二次返回关闭 Editor 并回到首页；
10. 检查未保存内容不入库、正式实例恢复和清理链正常。'''
plan = plan[:start] + next_text + plan[end:]
plan_path.write_text(plan, encoding='utf-8')
PYDOCS

editor_sha="$(git hash-object src/ch_10_editor.js)"
python3 - "$editor_sha" <<'PYMANIFEST'
from pathlib import Path
import json
import sys

path = Path('module-manifest.json')
data = json.loads(path.read_text(encoding='utf-8'))
if data.get('schemaVersion') != 1 or data.get('entryMinVersion') != 4:
    raise SystemExit('manifest boundary changed')
if len(data.get('modules', [])) != 15:
    raise SystemExit('manifest module count changed')
data['moduleSetVersion'] = '20260722.33'
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
             'probes/cliphub_editor_keyboard_probe_040_impl.js']:
    text = Path(name).read_text(encoding='utf-8')
    bad = []
    if re.search(r'\b(?:let|const)\s+', text): bad.append('let/const')
    if '=>' in text: bad.append('arrow')
    if '`' in text: bad.append('template literal')
    if re.search(r'\bclass\s+[A-Za-z_$]', text): bad.append('class')
    if bad:
        raise SystemExit(name + ': forbidden ES6 ' + ', '.join(bad))

editor = Path('src/ch_10_editor.js').read_text(encoding='utf-8')
assert 'MODULE_VERSION: 6' in editor
assert 'reference_editor_v2' in editor
assert 'softInputAdjustResize' in editor
assert 'footerAboveKeyboard' in editor
assert 'scrollInputToEnd' in editor
assert 'updateItem(id, { content: content })' in editor

manifest = json.loads(Path('module-manifest.json').read_text(encoding='utf-8'))
assert manifest['moduleSetVersion'] == '20260722.33'
assert manifest['entryMinVersion'] == 4
assert len(manifest['modules']) == 15

probe = Path('probes/cliphub_editor_keyboard_probe_040_impl.js').read_text(encoding='utf-8')
assert 'REQUIRED_SET = "20260722.33"' in probe
assert 'editorModuleVersion === 6' in probe
assert 'reference_editor_v2' in probe
assert 'firstBackHidKeyboard' in probe
assert 'secondBackClosedEditor' in probe
assert 'input keyevent 4' in probe
PYCHECK

node --check src/ch_10_editor.js
node --check probes/cliphub_editor_keyboard_probe_040_impl.js
if [ -f scripts/check_es5.py ]; then python3 scripts/check_es5.py; fi
git diff --check

git config user.name "ClipHub Automation"
git config user.email "actions@github.com"
git add src/ch_10_editor.js module-manifest.json \
  probes/cliphub_editor_keyboard_probe_040_impl.js \
  docs/阶段3D2新UI全量复刻方案.md docs/开发计划.md
git commit -m "test: add editor keyboard layout instrumentation"
implementation_commit="$(git rev-parse HEAD)"

cp probes/cliphub_editor_ui_probe_039.js \
  probes/cliphub_editor_keyboard_probe_040.js
python3 - "$implementation_commit" <<'PYLOADER'
from pathlib import Path
import sys

path = Path('probes/cliphub_editor_keyboard_probe_040.js')
text = path.read_text(encoding='utf-8')
text = text.replace('039', '040')
text = text.replace('20260722.32', '20260722.33')
text = text.replace('29f2e223f6d923332ae45b7c5bbe0b8d44e7aa2f',
                    sys.argv[1])
text = text.replace('cliphub_editor_ui_probe_040_impl.js',
                    'cliphub_editor_keyboard_probe_040_impl.js')
text = text.replace('editorModuleVersion === 5',
                    'editorModuleVersion === 6')
text = text.replace('reference_editor_v1', 'reference_editor_v2')
text = text.replace('newSaveSemanticsPreserved', 'firstBackHidKeyboard')
text = text.replace('editSaveSemanticsPreserved', 'secondBackClosedEditor')
text = text.replace('cancelPreserved', 'footerAboveKeyboard')
text = text.replace('ClipHubEditorUiProbe040Result',
                    'ClipHubEditorKeyboardProbe040Result')
path.write_text(text, encoding='utf-8')
PYLOADER

cat > docs/新增编辑输入法长文本探测040说明.md <<EOF
# ClipHub 新增 / 编辑输入法与长文本探测 040

## 目标

验证 Android 14 / ColorOS 上 Editor 正式输入法场景、长文本末尾滚动、固定底栏与系统返回层级。

## 模块集

\`\`\`text
moduleSetVersion=20260722.33
entryVersion=4
databaseSchemaVersion=2
Editor=6
Filter=9
Navigation=3
\`\`\`

## 严格边界

- Repository 新增和编辑保存语义不变；
- Navigation v3 实现不变；
- 标签管理页不修改；
- 保持 \`SOFT_INPUT_ADJUST_RESIZE\`；
- 不增加透明触摸层、自定义底部手势或 WebView。

## 三个场景

1. 键盘已弹出的短文本新增页；
2. 120 行长文本且光标位于末尾；
3. 第一次系统返回隐藏键盘后，Editor 仍保持打开。

探测随后自动发送第二次系统返回，验证 Editor 关闭并回到首页。

## 自动检查

- Editor v6 / \`reference_editor_v2\`；
- 键盘占用不少于 120dp；
- 固定底栏完整位于可见区域和键盘上方；
- 正文视口位于固定底栏上方；
- 长文本可以向上滚动且光标位于末尾；
- 第一次返回只隐藏键盘；
- 第二次返回关闭 Editor；
- 未保存内容不写入数据库；
- 数据库、运行锁、正式实例恢复和隔离目录清理正常。

## 运行

将以下完整文件复制到新的 ShortX JavaScript 任务：

\`\`\`text
probes/cliphub_editor_keyboard_probe_040.js
\`\`\`

建议任务名：\`ClipHub 新增编辑输入法探测040\`。

运行后回传三张未裁剪截图和完整 JSON。
EOF

node --check probes/cliphub_editor_keyboard_probe_040.js
node --check probes/cliphub_editor_keyboard_probe_040_impl.js
if [ -f scripts/check_es5.py ]; then python3 scripts/check_es5.py; fi
git diff --check

git add probes/cliphub_editor_keyboard_probe_040.js \
  docs/新增编辑输入法长文本探测040说明.md
git rm -rf "$HELPER_DIR" "$WORKFLOW_PATH"
git commit -m "test: add editor keyboard probe 040"
git push origin "HEAD:$BRANCH"
