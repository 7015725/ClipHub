#!/usr/bin/env python3
from pathlib import Path
from urllib.request import Request, urlopen
import hashlib
import json
import subprocess

REPOSITORY = '7015725/ClipHub'
SOURCE_COMMIT = '84a008ada8f681c16a7326fded0bd07d06fc8029'
SOURCE_BLOB = '06e62539e5f9a0af0067840d927a0cbec679eead'
SOURCE_URL = (
    'https://raw.githubusercontent.com/' + REPOSITORY + '/' +
    SOURCE_COMMIT + '/src/ch_11_filter.js'
)
source_path = Path('src/ch_11_filter.js')
manifest_path = Path('module-manifest.json')


def git_blob_sha(text):
    data = text.encode('utf-8')
    header = ('blob %d\0' % len(data)).encode('utf-8')
    return hashlib.sha1(header + data).hexdigest()


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit('%s count mismatch: %d' % (label, count))
    return text.replace(old, new, 1)


request = Request(SOURCE_URL, headers={
    'User-Agent': 'ClipHub-Filter-Formalizer/32',
    'Accept': 'text/plain, */*',
    'Cache-Control': 'no-cache'
})
with urlopen(request, timeout=30) as response:
    text = response.read().decode('utf-8')
if git_blob_sha(text) != SOURCE_BLOB:
    raise SystemExit('pinned compact source blob mismatch')

text = replace_once(
    text,
    '    var RectF = Packages.android.graphics.RectF;\n',
    '    var RectF = Packages.android.graphics.RectF;\n'
    '    var Rect = Packages.android.graphics.Rect;\n'
    '    var WindowInsets = Packages.android.view.WindowInsets;\n',
    'IME imports')
text = replace_once(
    text,
    '    var advancedKeywordInput = null;\n',
    '',
    'advanced keyword declaration')
text = replace_once(
    text,
    '''        try {\n            if (inputMethodManager !== null &&\n                    advancedKeywordInput !== null) {\n                inputMethodManager.hideSoftInputFromWindow(\n                    advancedKeywordInput.getWindowToken(), 0);\n            }\n        } catch (ignoredDrawer) {}\n''',
    '',
    'advanced keyboard hide')
text = replace_once(
    text,
    '''    function performAdvancedKeywordFromInput(origin) {\n        var text = advancedKeywordInput === null ? "" :\n            String(advancedKeywordInput.getText());\n        markUiThread();\n        state.searchActionCount += 1;\n        setValue({ keyword: text }, {\n            origin: origin || "ui_advanced_search"\n        });\n        rememberKeyword(text);\n        hideKeyboardOnMain();\n        buildPanelContent(false);\n        return true;\n    }\n\n''',
    '',
    'advanced keyword action')
text = replace_once(
    text,
    '''            if (advancedKeywordInput !== null) {\n                advancedKeywordInput.setText("");\n            }\n''',
    '',
    'advanced reset field')
text = replace_once(
    text,
    '''    function buildAdvancedKeywordInput(colors) {\n        var input = new EditText(appContext);\n        input.setSingleLine(true);\n        suppressTextWatcher = true;\n        input.setText(String(value.keyword || ""));\n        input.setSelection(input.getText().length());\n        suppressTextWatcher = false;\n        input.setHint("在筛选结果中搜索");\n        input.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);\n        ClipHub.Theme.applyTextColor(input, colors.textPrimary);\n        ClipHub.Theme.applyHintTextColor(input, colors.textSecondary);\n        input.setInputType(InputType.TYPE_CLASS_TEXT |\n            InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);\n        input.setImeOptions(EditorInfo.IME_ACTION_SEARCH);\n        input.setPadding(dp(10), dp(5), dp(8), dp(5));\n        input.setBackground(roundedBackground(colors.surfaceMuted,\n            colors.stroke, 13));\n        input.setOnEditorActionListener(new JavaAdapter(\n            TextView.OnEditorActionListener, {\n                onEditorAction: function (view, actionId) {\n                    if (Number(actionId) ===\n                            Number(EditorInfo.IME_ACTION_SEARCH)) {\n                        performAdvancedKeywordFromInput(\n                            "ui_advanced_search_ime");\n                        return true;\n                    }\n                    return false;\n                }\n            }));\n        input.addTextChangedListener(new JavaAdapter(TextWatcher, {\n            beforeTextChanged: function () {},\n            onTextChanged: function (text) {\n                if (!suppressTextWatcher) {\n                    scheduleRealtimeSearch(String(text));\n                }\n            },\n            afterTextChanged: function () {}\n        }));\n        advancedKeywordInput = input;\n        state.advancedKeywordInputPresent = true;\n        return input;\n    }\n\n''',
    '',
    'advanced input builder')
text = replace_once(
    text,
    '''        params = new LinearLayout.LayoutParams(\n            LinearLayout.LayoutParams.MATCH_PARENT, dp(40));\n        params.bottomMargin = dp(9);\n        drawer.addView(buildAdvancedKeywordInput(colors), params);\n\n''',
    '''        state.advancedKeywordInputPresent = false;\n\n''',
    'advanced drawer input row')
text = replace_once(
    text,
    '''            advancedKeywordInputPresent:\n                advancedKeywordInput !== null,\n''',
    '''            advancedKeywordInputPresent: false,\n''',
    'advanced input panel state')
text = replace_once(
    text,
    '''            advancedButtonText: advancedView !== null ?\n                String(advancedView.getText()) : "",\n''',
    '''            advancedButtonText: advancedView !== null ?\n                (activeAdvancedFilterCount() > 0 ?\n                    "筛选(" + String(activeAdvancedFilterCount()) + ")" :\n                    "筛选") : "",\n''',
    'advanced button semantic state')
text = replace_once(
    text,
    '                advancedKeywordInput = null;\n',
    '',
    'advanced input close cleanup')
text = replace_once(
    text,
    '''        performAdvancedKeywordSearch: function (text) {\n            return requireMain(runOnMainSync(function () {\n                if (!state.panelAttached ||\n                        advancedKeywordInput === null) {\n                    return false;\n                }\n                suppressTextWatcher = true;\n                try {\n                    advancedKeywordInput.setText(String(text === null ||\n                        text === undefined ? "" : text));\n                    advancedKeywordInput.setSelection(\n                        advancedKeywordInput.getText().length());\n                } finally {\n                    suppressTextWatcher = false;\n                }\n                return performAdvancedKeywordFromInput(\n                    "api_advanced_search");\n            }, 3000));\n        },\n\n''',
    '',
    'advanced search public API')
text = replace_once(
    text,
    '        MODULE_VERSION: 28,\n',
    '        MODULE_VERSION: 32,\n',
    'filter module version')
text = replace_once(
    text,
    '        state.searchPageStyle = "reference_search_v12_compact_header";\n',
    '        state.searchPageStyle = "reference_search_v13_formal_filter";\n',
    'formal search style')

controller = r'''    var filterImeController = null;

    function copyImeLayout(params) {
        return {
            width: Number(params.width),
            height: Number(params.height),
            gravity: Number(params.gravity),
            x: Number(params.x),
            y: Number(params.y)
        };
    }

    function sameImeLayout(params, target) {
        return Number(params.width) === Number(target.width) &&
            Number(params.height) === Number(target.height) &&
            Number(params.gravity) === Number(target.gravity) &&
            Number(params.x) === Number(target.x) &&
            Number(params.y) === Number(target.y);
    }

    function hasFocusedFilterInput(rootView) {
        var focused;
        var type;
        try {
            if (rootView === null || !rootView.hasWindowFocus()) {
                return false;
            }
            focused = rootView.findFocus();
            if (focused === null) { return false; }
            type = focused.getClass();
            while (type !== null) {
                if (String(type.getName()) === "android.widget.EditText") {
                    return true;
                }
                type = type.getSuperclass();
            }
        } catch (ignored) {}
        return false;
    }

    function createFilterImeController(rootView, params) {
        var handler = mainHandler || new Handler(Looper.getMainLooper());
        var stateValue = {
            started: false,
            stopped: false,
            generation: 0,
            runnable: null,
            observer: null,
            listener: null,
            restore: null,
            applied: false,
            applyCount: 0,
            restoreCount: 0,
            staleSignalIgnoredCount: 0,
            updateCount: 0,
            lastSource: "none",
            lastInsetPx: 0,
            lastError: null
        };

        function displayMetrics() {
            var metrics = new DisplayMetrics();
            try {
                windowManager.getDefaultDisplay().getRealMetrics(metrics);
            } catch (ignoredManager) {
                metrics = appContext.getResources().getDisplayMetrics();
            }
            return metrics;
        }

        function thresholdPx(metrics) {
            var screenHeight = Math.max(1, Number(metrics.heightPixels || 1));
            var lower = Math.max(touchSlop * 6,
                Math.round(screenHeight * 0.055));
            var upper = Math.max(lower,
                Math.round(screenHeight * 0.22));
            return Math.round(clampNumber(screenHeight * 0.12,
                lower, upper));
        }

        function inputMethodHeightPx() {
            var height = 0;
            if (inputMethodManager === null) { return 0; }
            try {
                height = Number(inputMethodManager
                    .getInputMethodWindowVisibleHeight());
            } catch (ignored) {
                height = 0;
            }
            return isFinite(height) && height > 0 ? height : 0;
        }

        function readImeState() {
            var metrics = displayMetrics();
            var threshold = thresholdPx(metrics);
            var output = {
                visible: false,
                bottomPx: 0,
                topInsetPx: 0,
                source: "none",
                screenWidthPx: Number(metrics.widthPixels),
                screenHeightPx: Number(metrics.heightPixels)
            };
            var insets;
            var imeMask;
            var systemMask;
            var imeInsets;
            var systemInsets;
            var rootAvailable = false;
            var rootVisible = false;
            var rootBottom = 0;
            var frame = new Rect();
            var frameAvailable = false;
            var frameGap = 0;
            var frameVisible = false;
            var immHeight = 0;

            if (Build.VERSION.SDK_INT >= 30) {
                try {
                    insets = rootView.getRootWindowInsets();
                    if (insets !== null) {
                        imeMask = WindowInsets.Type.ime();
                        systemMask = WindowInsets.Type.systemBars();
                        imeInsets = insets.getInsets(imeMask);
                        systemInsets = insets.getInsets(systemMask);
                        rootAvailable = true;
                        rootBottom = Math.max(0,
                            Number(imeInsets.bottom));
                        rootVisible = insets.isVisible(imeMask) === true ||
                            rootBottom >= threshold;
                        output.topInsetPx = Math.max(0,
                            Number(systemInsets.top));
                    }
                } catch (ignoredInsets) {}
            }

            try {
                rootView.getWindowVisibleDisplayFrame(frame);
                frameAvailable = true;
                frameGap = Math.max(0,
                    Number(metrics.heightPixels) - Number(frame.bottom));
                frameVisible = frameGap >= threshold;
                output.topInsetPx = Math.max(output.topInsetPx,
                    Number(frame.top));
            } catch (ignoredFrame) {}

            immHeight = inputMethodHeightPx();
            if (rootVisible) {
                output.visible = true;
                output.bottomPx = Math.max(rootBottom,
                    frameVisible ? frameGap : 0,
                    immHeight >= threshold ? immHeight : 0);
                output.source = "root_window_insets";
            } else if (frameVisible) {
                output.visible = true;
                output.bottomPx = Math.max(frameGap,
                    immHeight >= threshold ? immHeight : 0);
                output.source = "visible_display_frame";
            } else if (!rootAvailable && !frameAvailable &&
                    immHeight >= threshold) {
                output.visible = true;
                output.bottomPx = immHeight;
                output.source = "input_method_visible_height";
            } else {
                output.visible = false;
                output.bottomPx = 0;
                output.source = rootAvailable ?
                    "root_window_insets_hidden" :
                    (frameAvailable ?
                        "visible_display_frame_hidden" : "none");
                if (immHeight >= threshold) {
                    stateValue.staleSignalIgnoredCount += 1;
                }
            }
            return output;
        }

        function updateLayout(target) {
            if (sameImeLayout(params, target)) { return false; }
            params.width = Number(target.width);
            params.height = Number(target.height);
            params.gravity = Number(target.gravity);
            params.x = Number(target.x);
            params.y = Number(target.y);
            try {
                if (rootView.isAttachedToWindow()) {
                    windowManager.updateViewLayout(rootView, params);
                    stateValue.updateCount += 1;
                }
                return true;
            } catch (error) {
                stateValue.lastError = String(error);
                return false;
            }
        }

        function restoreLayout() {
            var target = stateValue.restore;
            if (target === null) {
                stateValue.applied = false;
                return false;
            }
            updateLayout(target);
            stateValue.restore = null;
            if (stateValue.applied) { stateValue.restoreCount += 1; }
            stateValue.applied = false;
            return true;
        }

        function applyImeLayout(ime) {
            var keyboardActive = ime.visible === true &&
                hasFocusedFilterInput(rootView);
            var screenHeight = Math.max(1, Number(ime.screenHeightPx));
            var screenWidth = Math.max(1, Number(ime.screenWidthPx));
            var adaptiveGap = Math.max(touchSlop,
                Math.round(Math.min(screenWidth, screenHeight) * 0.008));
            var keyboardTop;
            var topSafe;
            var available;
            var minimumHeight;
            var target;

            stateValue.lastSource = String(ime.source || "none");
            stateValue.lastInsetPx = Number(ime.bottomPx || 0);
            if (!keyboardActive) {
                if (stateValue.applied) { restoreLayout(); }
                return false;
            }
            if (!stateValue.applied || stateValue.restore === null) {
                stateValue.restore = copyImeLayout(params);
            }
            keyboardTop = Math.max(0,
                screenHeight - Number(ime.bottomPx));
            topSafe = Math.max(0, Number(ime.topInsetPx || 0));
            minimumHeight = Math.max(touchSlop * 18,
                Math.round(screenHeight * 0.22));
            available = Math.max(minimumHeight,
                keyboardTop - topSafe - adaptiveGap * 2);
            target = {
                width: Number(stateValue.restore.width),
                height: Math.min(Number(stateValue.restore.height), available),
                gravity: Number(Gravity.TOP | Gravity.START),
                x: Number(stateValue.restore.x),
                y: Math.max(topSafe + adaptiveGap,
                    keyboardTop - adaptiveGap -
                    Math.min(Number(stateValue.restore.height), available))
            };
            updateLayout(target);
            if (!stateValue.applied) { stateValue.applyCount += 1; }
            stateValue.applied = true;
            return true;
        }

        function poll(generation) {
            var ime;
            var active;
            if (stateValue.stopped || generation !== stateValue.generation) {
                return false;
            }
            try {
                if (rootView === null || !rootView.isAttachedToWindow()) {
                    stop(false);
                    return false;
                }
                ime = readImeState();
                applyImeLayout(ime);
                active = stateValue.applied ||
                    hasFocusedFilterInput(rootView) || ime.visible === true;
                handler.postDelayed(stateValue.runnable, active ? 90 : 420);
                return true;
            } catch (error) {
                stateValue.lastError = String(error);
                handler.postDelayed(stateValue.runnable, 420);
                return false;
            }
        }

        function start() {
            var generation;
            if (stateValue.started || stateValue.stopped) { return false; }
            stateValue.started = true;
            stateValue.generation += 1;
            generation = stateValue.generation;
            stateValue.runnable = new Packages.java.lang.Runnable({
                run: function () { poll(generation); }
            });
            try {
                stateValue.observer = rootView.getViewTreeObserver();
                stateValue.listener = new JavaAdapter(
                    Packages.android.view.ViewTreeObserver
                        .OnGlobalLayoutListener, {
                        onGlobalLayout: function () {
                            if (!stateValue.stopped) {
                                try {
                                    applyImeLayout(readImeState());
                                } catch (error) {
                                    stateValue.lastError = String(error);
                                }
                            }
                        }
                    });
                stateValue.observer.addOnGlobalLayoutListener(
                    stateValue.listener);
            } catch (error) {
                stateValue.lastError = String(error);
                stateValue.observer = null;
                stateValue.listener = null;
            }
            return handler.post(stateValue.runnable) === true;
        }

        function stop(restoreBeforeStop) {
            if (stateValue.stopped) { return true; }
            stateValue.stopped = true;
            stateValue.generation += 1;
            if (stateValue.runnable !== null) {
                try { handler.removeCallbacks(stateValue.runnable); }
                catch (ignoredRunnable) {}
            }
            if (stateValue.observer !== null &&
                    stateValue.listener !== null) {
                try {
                    if (Build.VERSION.SDK_INT >= 16) {
                        stateValue.observer.removeOnGlobalLayoutListener(
                            stateValue.listener);
                    } else {
                        stateValue.observer.removeGlobalOnLayoutListener(
                            stateValue.listener);
                    }
                } catch (ignoredObserver) {}
            }
            if (restoreBeforeStop === true && stateValue.applied) {
                restoreLayout();
            }
            stateValue.runnable = null;
            stateValue.observer = null;
            stateValue.listener = null;
            return true;
        }

        return {
            start: start,
            stop: stop,
            getState: function () {
                return {
                    started: stateValue.started === true,
                    stopped: stateValue.stopped === true,
                    applied: stateValue.applied === true,
                    applyCount: Number(stateValue.applyCount),
                    restoreCount: Number(stateValue.restoreCount),
                    staleSignalIgnoredCount:
                        Number(stateValue.staleSignalIgnoredCount),
                    updateCount: Number(stateValue.updateCount),
                    lastSource: stateValue.lastSource,
                    lastInsetPx: Number(stateValue.lastInsetPx),
                    lastError: stateValue.lastError
                };
            }
        };
    }

    function stopFilterImeAvoidance(restoreBeforeStop) {
        if (filterImeController !== null) {
            try {
                filterImeController.stop(restoreBeforeStop === true);
            } catch (ignored) {}
        }
        filterImeController = null;
        return true;
    }

    function startFilterImeAvoidance() {
        if (panelWindowRoot === null || panelParams === null ||
                windowManager === null) {
            return false;
        }
        stopFilterImeAvoidance(false);
        filterImeController = createFilterImeController(
            panelWindowRoot, panelParams);
        return filterImeController.start();
    }

    function getFilterImeAvoidanceState() {
        return filterImeController === null ? {
            started: false,
            stopped: true,
            applied: false,
            applyCount: 0,
            restoreCount: 0,
            staleSignalIgnoredCount: 0,
            updateCount: 0,
            lastSource: "none",
            lastInsetPx: 0,
            lastError: null
        } : filterImeController.getState();
    }

'''
text = replace_once(
    text,
    '    function showPanel(options) {\n',
    controller + '    function showPanel(options) {\n',
    'IME controller insertion')
text = replace_once(
    text,
    '''                });\n                state.primaryGeometryManaged = true;\n''',
    '''                });\n                startFilterImeAvoidance();\n                state.primaryGeometryManaged = true;\n''',
    'IME controller start')
text = replace_once(
    text,
    '''            return result;\n        } catch (error) {\n            try {\n''',
    '''            return result;\n        } catch (error) {\n            stopFilterImeAvoidance(false);\n            try {\n''',
    'IME show failure cleanup')
text = replace_once(
    text,
    '''        options = options || {};\n        if (!state.panelAttached && panelRoot === null &&\n''',
    '''        options = options || {};\n        stopFilterImeAvoidance(false);\n        if (!state.panelAttached && panelRoot === null &&\n''',
    'IME close cleanup')
text = replace_once(
    text,
    '''        init: function (context) {\n            androidContext = context && context.androidContext ?\n''',
    '''        init: function (context) {\n            stopFilterImeAvoidance(false);\n            androidContext = context && context.androidContext ?\n''',
    'IME init cleanup')
text = replace_once(
    text,
    '''        getPanelState: getPanelState,\n        getSelectedItemId: function () { return selectedItemId; },\n''',
    '''        getPanelState: getPanelState,\n        getImeAvoidanceState: getFilterImeAvoidanceState,\n        FILTER_IME_AVOIDANCE: "formal_v32",\n        getSelectedItemId: function () { return selectedItemId; },\n''',
    'IME public state API')

for forbidden in [
    'advancedKeywordInput',
    'buildAdvancedKeywordInput',
    'performAdvancedKeywordFromInput',
    'performAdvancedKeywordSearch',
    '在筛选结果中搜索',
    'COMPACT_COMMIT',
    'COMPACT_BLOB',
    'fetchSource(',
    'eval(String(source))',
    'compactCache',
    'stableCache',
    '.pending',
    '.disabled',
    '.failure.txt'
]:
    if forbidden in text:
        raise SystemExit('forbidden formal-source marker remains: ' + forbidden)
for required in [
    'MODULE_VERSION: 32',
    'reference_search_v13_formal_filter',
    'function createFilterImeController(rootView, params)',
    'startFilterImeAvoidance();',
    'getImeAvoidanceState: getFilterImeAvoidanceState',
    'FILTER_IME_AVOIDANCE: "formal_v32"',
    'advancedKeywordInputPresent: false',
    '"筛选(" + String(activeAdvancedFilterCount()) + ")"'
]:
    if required not in text:
        raise SystemExit('required formal-source marker missing: ' + required)

source_path.write_text(text, encoding='utf-8')
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
manifest['moduleSetVersion'] = '20260724.27'
blob = subprocess.check_output(
    ['git', 'hash-object', str(source_path)], text=True).strip()
for item in manifest.get('modules', []):
    if item.get('path') == 'src/ch_11_filter.js':
        item['sha'] = blob
        break
else:
    raise SystemExit('filter manifest entry missing')
manifest_path.write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + '\n',
    encoding='utf-8')
