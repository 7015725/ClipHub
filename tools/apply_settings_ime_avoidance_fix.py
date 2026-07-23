#!/usr/bin/env python3
"""Apply Settings IME avoidance to ClipHub. Fails closed on source drift."""

from __future__ import annotations

import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SETTINGS = ROOT / "src/ch_13_settings.js"
MANIFEST = ROOT / "module-manifest.json"
EXPECTED_BRANCH = "agent/initialize-project-skeleton"
OLD_SETTINGS_SHA = "47a1b31a27fcff454cb9d3a243805c05f596dd00"
OLD_SET = "20260723.07"
NEW_SET = "20260723.08"


def die(message: str) -> None:
    raise SystemExit(message)


def git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def blob_sha(text: str) -> str:
    data = text.encode("utf-8")
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        die(f"{label}: expected exactly one marker, found {count}")
    return text.replace(old, new, 1)


def assert_clean_targets() -> None:
    branch = git("branch", "--show-current")
    if branch != EXPECTED_BRANCH:
        die(f"Wrong branch: {branch}; expected {EXPECTED_BRANCH}")
    changed = git(
        "status", "--porcelain", "--",
        str(SETTINGS.relative_to(ROOT)), str(MANIFEST.relative_to(ROOT)),
    )
    if changed:
        die("Target files already have local changes:\n" + changed)


IME_HELPERS = r'''
    function pxToDp(value) {
        return density > 0 ? Number(value) / density : Number(value);
    }

    function displayMetrics() {
        var metrics = new DisplayMetrics();
        if (windowManager !== null) {
            try {
                windowManager.getDefaultDisplay().getRealMetrics(metrics);
                if (Number(metrics.widthPixels) > 0 &&
                        Number(metrics.heightPixels) > 0) {
                    return metrics;
                }
            } catch (ignoredWindow) {}
        }
        if (appContext !== null) {
            try { return appContext.getResources().getDisplayMetrics(); }
            catch (ignoredContext) {}
        }
        return metrics;
    }

    function statusBarHeightPx() {
        var resources;
        var resourceId;
        if (appContext === null) { return dp(24); }
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

    function postSettingsDelayed(callback, delayMs, requireAttached) {
        var generation = settingsLifecycleGeneration;
        var runnable;
        var posted;
        if (mainHandler === null || typeof callback !== "function") {
            return false;
        }
        uiState.delayedCallbackPostCount += 1;
        uiState.pendingDelayedCallbackCount += 1;
        runnable = new Packages.java.lang.Runnable({
            run: function () {
                uiState.pendingDelayedCallbackCount = Math.max(0,
                    Number(uiState.pendingDelayedCallbackCount) - 1);
                if (generation !== settingsLifecycleGeneration || !ready ||
                        appContext === null || windowManager === null ||
                        (requireAttached && (!uiState.attached ||
                            panelRoot === null || scrollRoot === null))) {
                    uiState.delayedCallbackCancelCount += 1;
                    return;
                }
                try {
                    uiState.delayedCallbackRunCount += 1;
                    callback();
                } catch (error) {
                    uiState.delayedCallbackErrorCount += 1;
                    uiState.lastDelayedCallbackError = String(error);
                    uiState.lastError = String(error);
                }
            }
        });
        try { posted = mainHandler.postDelayed(runnable, Number(delayMs || 0)); }
        catch (error) {
            posted = false;
            uiState.delayedCallbackErrorCount += 1;
            uiState.lastDelayedCallbackError = String(error);
            uiState.lastError = String(error);
        }
        if (!posted) {
            uiState.pendingDelayedCallbackCount = Math.max(0,
                Number(uiState.pendingDelayedCallbackCount) - 1);
            uiState.delayedCallbackCancelCount += 1;
        }
        return posted === true;
    }

    function readSettingsImeState() {
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

    function applySettingsImeLayout(ime) {
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
        if (panelRoot === null || panelParams === null) { return false; }
        metrics = displayMetrics();
        normalHeightPx = dp(Math.max(300,
            Number(uiState.normalPanelHeightDp || uiState.panelHeightDp || 590)));
        wasApplied = uiState.keyboardAvoidanceApplied === true;
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
            uiState.availableAboveImeDp = pxToDp(availablePx);
            uiState.keyboardAvoidanceApplied = true;
            if (!wasApplied) { uiState.keyboardAvoidanceApplyCount += 1; }
            uiState.panelGravity = "ime_top";
            uiState.panelBottomMarginDp = 6;
        } else {
            targetHeightPx = normalHeightPx;
            targetGravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
            targetY = dp(10);
            targetTopPx = Math.max(0,
                Number(metrics.heightPixels) - targetHeightPx - targetY);
            uiState.availableAboveImeDp = pxToDp(Number(metrics.heightPixels));
            uiState.keyboardAvoidanceApplied = false;
            if (wasApplied) { uiState.keyboardAvoidanceRestoreCount += 1; }
            uiState.panelGravity = "bottom";
            uiState.panelBottomMarginDp = 10;
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
        uiState.currentPanelHeightDp = pxToDp(targetHeightPx);
        uiState.currentPanelTopDp = pxToDp(targetTopPx);
        if (changed && uiState.attached && panelRoot.isAttachedToWindow()) {
            windowManager.updateViewLayout(panelRoot, panelParams);
            uiState.windowLayoutUpdateCount += 1;
        }
        return changed;
    }

    function resetImeAnchorSpacer() {
        var params;
        if (imeAnchorSpacer === null) { return false; }
        params = imeAnchorSpacer.getLayoutParams();
        if (Number(params.height || 0) !== 0) {
            params.height = 0;
            imeAnchorSpacer.setLayoutParams(params);
            imeAnchorSpacer.requestLayout();
            if (contentRoot !== null) { contentRoot.requestLayout(); }
            uiState.imeAnchorAdjustmentCount += 1;
        }
        uiState.imeAnchorSpacerHeightDp = 0;
        return true;
    }

    function focusedInputRect(expectedInput, expectedRoot) {
        var rect;
        if (expectedInput === null || expectedRoot === null) { return null; }
        rect = new Rect();
        expectedInput.getDrawingRect(rect);
        expectedRoot.offsetDescendantRectToMyCoords(expectedInput, rect);
        return rect;
    }

    function ensureImeAnchorSpace(expectedInput, expectedRoot) {
        var rect;
        var params;
        var currentSpacer;
        var baseContentHeight;
        var viewportHeight;
        var currentScroll;
        var desiredScroll;
        var requiredSpacer;
        if (!uiState.attached || expectedRoot !== scrollRoot ||
                expectedInput !== focusedInput || contentRoot === null ||
                imeAnchorSpacer === null) {
            return false;
        }
        rect = focusedInputRect(expectedInput, expectedRoot);
        if (rect === null) { return false; }
        params = imeAnchorSpacer.getLayoutParams();
        currentSpacer = Math.max(0, Number(params.height || 0));
        baseContentHeight = Math.max(0,
            Number(contentRoot.getHeight()) - currentSpacer);
        viewportHeight = Math.max(dp(120), Number(expectedRoot.getHeight()));
        currentScroll = Math.max(0, Number(expectedRoot.getScrollY()));
        desiredScroll = Math.max(0,
            Number(rect.bottom) - viewportHeight + dp(16));
        if (Number(rect.top) < currentScroll + dp(12)) {
            desiredScroll = Math.max(0, Number(rect.top) - dp(12));
        }
        requiredSpacer = Math.max(0,
            Math.ceil(desiredScroll + viewportHeight - baseContentHeight));
        if (Number(params.height || 0) !== requiredSpacer) {
            params.height = requiredSpacer;
            imeAnchorSpacer.setLayoutParams(params);
            imeAnchorSpacer.requestLayout();
            contentRoot.requestLayout();
            uiState.imeAnchorAdjustmentCount += 1;
        }
        uiState.imeAnchorSpacerHeightDp = Math.round(requiredSpacer / density);
        return true;
    }

    function applyFocusedInputScroll(expectedInput, expectedRoot) {
        var rect;
        var viewportHeight;
        var currentScroll;
        var desiredScroll;
        var maxScroll;
        var visibleTop;
        var visibleBottom;
        if (!uiState.attached || expectedRoot !== scrollRoot ||
                expectedInput !== focusedInput || !expectedInput.hasFocus()) {
            return false;
        }
        rect = focusedInputRect(expectedInput, expectedRoot);
        if (rect === null) { return false; }
        viewportHeight = Math.max(dp(120), Number(expectedRoot.getHeight()));
        currentScroll = Math.max(0, Number(expectedRoot.getScrollY()));
        desiredScroll = currentScroll;
        visibleTop = currentScroll + dp(12);
        visibleBottom = currentScroll + viewportHeight - dp(16);
        if (Number(rect.bottom) > visibleBottom) {
            desiredScroll += Number(rect.bottom) - visibleBottom;
        }
        if (Number(rect.top) < visibleTop) {
            desiredScroll -= visibleTop - Number(rect.top);
        }
        maxScroll = Math.max(0,
            Number(contentRoot === null ? 0 : contentRoot.getHeight()) -
                viewportHeight);
        desiredScroll = Math.max(0, Math.min(maxScroll, desiredScroll));
        if (Math.abs(desiredScroll - currentScroll) >= 1) {
            expectedRoot.scrollTo(0, Math.round(desiredScroll));
            uiState.inputAutoScrollCount += 1;
        }
        currentScroll = Math.max(0, Number(expectedRoot.getScrollY()));
        uiState.currentScrollYDp = Math.round(currentScroll / density);
        uiState.focusedInputTopDp = pxToDp(Number(rect.top) - currentScroll);
        uiState.focusedInputBottomDp = pxToDp(Number(rect.bottom) - currentScroll);
        uiState.focusedInputVisible =
            Number(rect.top) >= currentScroll + dp(8) &&
            Number(rect.bottom) <= currentScroll + viewportHeight - dp(8);
        return uiState.focusedInputVisible;
    }

    function scheduleFocusedInputVisibility() {
        var expectedRoot = scrollRoot;
        var expectedInput = focusedInput;
        if (focusedVisibilityScheduled || expectedRoot === null ||
                expectedInput === null || !uiState.attached) {
            return false;
        }
        focusedVisibilityScheduled = true;
        return postSettingsDelayed(function () {
            if (expectedRoot !== scrollRoot || expectedInput !== focusedInput ||
                    !expectedInput.hasFocus()) {
                focusedVisibilityScheduled = false;
                return;
            }
            ensureImeAnchorSpace(expectedInput, expectedRoot);
            expectedRoot.post(new Packages.java.lang.Runnable({
                run: function () {
                    try {
                        applyFocusedInputScroll(expectedInput, expectedRoot);
                    } catch (error) {
                        uiState.delayedCallbackErrorCount += 1;
                        uiState.lastDelayedCallbackError = String(error);
                        uiState.lastError = String(error);
                    } finally {
                        focusedVisibilityScheduled = false;
                    }
                }
            }));
        }, 45, true);
    }

    function measureSettingsLayout(imeSnapshot) {
        var ime = imeSnapshot || readSettingsImeState();
        var metrics;
        var rootHeightPx = 0;
        var viewportHeightPx = 0;
        var panelLocation;
        var panelScreenBottomPx = 0;
        var keyboardTopPx = 0;
        var keyboardWasVisible = uiState.keyboardVisible === true;
        if (panelRoot === null) { return false; }
        try {
            metrics = displayMetrics();
            rootHeightPx = Number(panelRoot.getHeight());
            viewportHeightPx = scrollRoot === null ? 0 :
                Number(scrollRoot.getHeight());
            keyboardTopPx = Number(metrics.heightPixels) - Number(ime.bottomPx);
            panelLocation = Packages.java.lang.reflect.Array.newInstance(
                Packages.java.lang.Integer.TYPE, 2);
            panelRoot.getLocationOnScreen(panelLocation);
            panelScreenBottomPx = Number(panelLocation[1]) + rootHeightPx;
            if (uiState.layoutMeasureCount > 0 &&
                    keyboardWasVisible !== ime.visible) {
                if (ime.visible) { uiState.keyboardShowCount += 1; }
                else { uiState.keyboardHideCount += 1; }
            }
            uiState.keyboardVisible = ime.visible;
            uiState.keyboardInsetDp = pxToDp(Number(ime.bottomPx));
            uiState.imeInsetBottomDp = pxToDp(Number(ime.bottomPx));
            uiState.imeInsetSource = String(ime.source || "none");
            uiState.imeInsetsSupported = ime.supported === true;
            uiState.systemTopInsetDp = pxToDp(Number(ime.topInsetPx));
            uiState.rootMeasuredHeightDp = pxToDp(rootHeightPx);
            uiState.scrollViewportHeightDp = pxToDp(viewportHeightPx);
            uiState.keyboardTopDp = pxToDp(keyboardTopPx);
            uiState.panelScreenBottomDp = pxToDp(panelScreenBottomPx);
            uiState.panelAboveKeyboard = !ime.visible ||
                panelScreenBottomPx <= keyboardTopPx + dp(2);
            uiState.layoutMeasureCount += 1;
            return true;
        } catch (error) {
            uiState.lastError = String(error);
            return false;
        }
    }

    function pollSettingsIme(generation) {
        var ime;
        if (generation !== imePollGeneration || !ready ||
                appContext === null || windowManager === null ||
                !uiState.attached || panelRoot === null) {
            return false;
        }
        uiState.imePollCount += 1;
        ime = readSettingsImeState();
        applySettingsImeLayout(ime);
        if (ime.visible && focusedInput !== null && focusedInput.hasFocus()) {
            scheduleFocusedInputVisibility();
        } else if (!ime.visible) {
            resetImeAnchorSpacer();
        }
        measureSettingsLayout(ime);
        return true;
    }

    function stopSettingsImeMonitoring() {
        imePollGeneration += 1;
        if (mainHandler !== null && imePollRunnable !== null) {
            try { mainHandler.removeCallbacks(imePollRunnable); }
            catch (ignoredRunnable) {}
        }
        imePollRunnable = null;
        if (layoutObserver !== null && layoutListener !== null) {
            try {
                if (Build.VERSION.SDK_INT >= 16) {
                    layoutObserver.removeOnGlobalLayoutListener(layoutListener);
                } else {
                    layoutObserver.removeGlobalOnLayoutListener(layoutListener);
                }
            } catch (ignoredObserver) {}
        }
        layoutObserver = null;
        layoutListener = null;
        return true;
    }

    function startSettingsImeMonitoring() {
        var generation;
        stopSettingsImeMonitoring();
        generation = imePollGeneration;
        imePollRunnable = new Packages.java.lang.Runnable({
            run: function () {
                if (!pollSettingsIme(generation)) { return; }
                if (mainHandler !== null && imePollRunnable !== null) {
                    mainHandler.postDelayed(imePollRunnable, 90);
                }
            }
        });
        mainHandler.post(imePollRunnable);
        try {
            layoutObserver = panelRoot.getViewTreeObserver();
            layoutListener = new JavaAdapter(
                Packages.android.view.ViewTreeObserver.OnGlobalLayoutListener, {
                    onGlobalLayout: function () {
                        var ime;
                        if (!ready || !uiState.attached || panelRoot === null ||
                                appContext === null || windowManager === null) {
                            return;
                        }
                        try {
                            ime = readSettingsImeState();
                            applySettingsImeLayout(ime);
                            if (ime.visible && focusedInput !== null &&
                                    focusedInput.hasFocus()) {
                                scheduleFocusedInputVisibility();
                            } else if (!ime.visible) {
                                resetImeAnchorSpacer();
                            }
                            measureSettingsLayout(ime);
                        } catch (error) {
                            uiState.delayedCallbackErrorCount += 1;
                            uiState.lastDelayedCallbackError = String(error);
                            uiState.lastError = String(error);
                        }
                    }
                });
            layoutObserver.addOnGlobalLayoutListener(layoutListener);
        } catch (error) {
            uiState.lastError = String(error);
        }
        postSettingsDelayed(function () {
            var ime = readSettingsImeState();
            applySettingsImeLayout(ime);
            measureSettingsLayout(ime);
        }, 180, true);
        return true;
    }

    function bindSettingsInput(input, inputName) {
        if (input === null) { return input; }
        input.setOnFocusChangeListener(new JavaAdapter(
            View.OnFocusChangeListener, {
                onFocusChange: function (view, hasFocus) {
                    if (hasFocus) {
                        focusedInput = view;
                        focusedInputName = String(inputName || "input");
                        uiState.focusedInputName = focusedInputName;
                        uiState.inputFocusCount += 1;
                        scheduleFocusedInputVisibility();
                    } else if (focusedInput === view) {
                        focusedInput = null;
                        focusedInputName = null;
                        uiState.focusedInputName = null;
                        uiState.focusedInputVisible = false;
                    }
                }
            }));
        return input;
    }

    function namedSettingsInput(name) {
        name = String(name || "");
        if (name === "translation.baidu.app_id") { return baiduIdInput; }
        if (name === "translation.baidu.app_secret") { return baiduSecretInput; }
        if (name === "translation.youdao.app_key") { return youdaoKeyInput; }
        if (name === "translation.youdao.app_secret") { return youdaoSecretInput; }
        if (name === "tag.new.name") { return newTagNameInput; }
        if (name === "tag.new.color") { return newTagColorInput; }
        return null;
    }

    function focusSettingsInput(name) {
        var target = namedSettingsInput(name);
        if (target === null || inputMethodManager === null) { return false; }
        focusedInput = target;
        focusedInputName = String(name);
        uiState.focusedInputName = focusedInputName;
        target.requestFocus();
        uiState.keyboardRequestCount += 1;
        postSettingsDelayed(function () {
            if (target === focusedInput && target.hasFocus() &&
                    inputMethodManager !== null) {
                inputMethodManager.showSoftInput(
                    target, InputMethodManager.SHOW_IMPLICIT);
                scheduleFocusedInputVisibility();
            }
        }, 100, true);
        return target.hasFocus();
    }

    function hideSettingsKeyboardOnMain() {
        var token = panelRoot === null ? null : panelRoot.getWindowToken();
        try {
            if (focusedInput !== null) { token = focusedInput.getWindowToken(); }
            if (token !== null && inputMethodManager !== null) {
                inputMethodManager.hideSoftInputFromWindow(token, 0);
            }
            if (focusedInput !== null) { focusedInput.clearFocus(); }
            return true;
        } catch (error) {
            uiState.lastError = String(error);
            return false;
        }
    }
'''


def patch_settings(text: str) -> tuple[str, bool]:
    if 'MODULE_VERSION: 10' in text and 'function applySettingsImeLayout(ime)' in text:
        return text, False
    if 'MODULE_VERSION: 9' not in text:
        die("Settings module version is neither v9 nor expected v10")
    actual_sha = blob_sha(text)
    if actual_sha != OLD_SETTINGS_SHA:
        die(f"Unexpected Settings v9 blob SHA: {actual_sha}")

    text = replace_once(
        text,
        '    var Color = Packages.android.graphics.Color;\n',
        '    var Color = Packages.android.graphics.Color;\n'
        '    var Rect = Packages.android.graphics.Rect;\n'
        '    var DisplayMetrics = Packages.android.util.DisplayMetrics;\n'
        '    var WindowInsets = Packages.android.view.WindowInsets;\n'
        '    var InputMethodManager = Packages.android.view.inputmethod.InputMethodManager;\n',
        "IME imports",
    )
    text = replace_once(
        text,
        '    var mainHandler = null;\n    var density = 1;\n',
        '    var mainHandler = null;\n'
        '    var inputMethodManager = null;\n'
        '    var settingsLifecycleGeneration = 0;\n'
        '    var imePollGeneration = 0;\n'
        '    var imePollRunnable = null;\n'
        '    var layoutObserver = null;\n'
        '    var layoutListener = null;\n'
        '    var focusedInput = null;\n'
        '    var focusedInputName = null;\n'
        '    var focusedVisibilityScheduled = false;\n'
        '    var density = 1;\n',
        "IME globals",
    )
    text = replace_once(
        text,
        '    var sectionAnchorSpacer = null;\n',
        '    var sectionAnchorSpacer = null;\n    var imeAnchorSpacer = null;\n',
        "IME anchor global",
    )
    text = replace_once(
        text,
        '        lastMaxScrollYDp: 0,\n        lastTestResult: "",\n',
        '        lastMaxScrollYDp: 0,\n'
        '        softInputMode: 0,\n'
        '        softInputAdjustResize: false,\n'
        '        normalPanelHeightDp: 0,\n'
        '        currentPanelHeightDp: 0,\n'
        '        currentPanelTopDp: 0,\n'
        '        panelGravity: "bottom",\n'
        '        panelBottomMarginDp: 10,\n'
        '        keyboardVisible: false,\n'
        '        keyboardInsetDp: 0,\n'
        '        keyboardShowCount: 0,\n'
        '        keyboardHideCount: 0,\n'
        '        keyboardRequestCount: 0,\n'
        '        imeInsetsSupported: false,\n'
        '        imeInsetSource: "none",\n'
        '        imeInsetBottomDp: 0,\n'
        '        systemTopInsetDp: 0,\n'
        '        availableAboveImeDp: 0,\n'
        '        keyboardAvoidanceApplied: false,\n'
        '        keyboardAvoidanceApplyCount: 0,\n'
        '        keyboardAvoidanceRestoreCount: 0,\n'
        '        windowLayoutUpdateCount: 0,\n'
        '        imePollCount: 0,\n'
        '        layoutMeasureCount: 0,\n'
        '        rootMeasuredHeightDp: 0,\n'
        '        scrollViewportHeightDp: 0,\n'
        '        keyboardTopDp: 0,\n'
        '        panelScreenBottomDp: 0,\n'
        '        panelAboveKeyboard: false,\n'
        '        focusedInputName: null,\n'
        '        focusedInputVisible: false,\n'
        '        focusedInputTopDp: 0,\n'
        '        focusedInputBottomDp: 0,\n'
        '        inputFocusCount: 0,\n'
        '        inputAutoScrollCount: 0,\n'
        '        imeAnchorAdjustmentCount: 0,\n'
        '        imeAnchorSpacerHeightDp: 0,\n'
        '        delayedCallbackPostCount: 0,\n'
        '        delayedCallbackRunCount: 0,\n'
        '        delayedCallbackCancelCount: 0,\n'
        '        delayedCallbackErrorCount: 0,\n'
        '        pendingDelayedCallbackCount: 0,\n'
        '        lastDelayedCallbackError: null,\n'
        '        lastTestResult: "",\n',
        "IME uiState",
    )
    text = replace_once(
        text,
        '    function closeQuietly(value) {\n',
        IME_HELPERS + '\n    function closeQuietly(value) {\n',
        "IME helpers",
    )
    text = replace_once(
        text,
        '    function makeInput(hint, value, colors, secret) {\n',
        '    function makeInput(hint, value, colors, secret, inputName) {\n',
        "makeInput signature",
    )
    text = replace_once(
        text,
        '        return input;\n    }\n\n    function addField',
        '        bindSettingsInput(input, inputName || hint);\n'
        '        return input;\n    }\n\n    function addField',
        "makeInput binding",
    )
    text = replace_once(
        text,
        '        baiduIdInput = makeInput("百度 APP ID",\n'
        '            values["translation.baidu.app_id"], colors, false);\n'
        '        baiduSecretInput = makeInput("百度密钥",\n'
        '            values["translation.baidu.app_secret"], colors, true);\n',
        '        baiduIdInput = makeInput("百度 APP ID",\n'
        '            values["translation.baidu.app_id"], colors, false,\n'
        '            "translation.baidu.app_id");\n'
        '        baiduSecretInput = makeInput("百度密钥",\n'
        '            values["translation.baidu.app_secret"], colors, true,\n'
        '            "translation.baidu.app_secret");\n',
        "Baidu input names",
    )
    text = replace_once(
        text,
        '        youdaoKeyInput = makeInput("有道 App Key",\n'
        '            values["translation.youdao.app_key"], colors, false);\n'
        '        youdaoSecretInput = makeInput("有道应用密钥",\n'
        '            values["translation.youdao.app_secret"], colors, true);\n',
        '        youdaoKeyInput = makeInput("有道 App Key",\n'
        '            values["translation.youdao.app_key"], colors, false,\n'
        '            "translation.youdao.app_key");\n'
        '        youdaoSecretInput = makeInput("有道应用密钥",\n'
        '            values["translation.youdao.app_secret"], colors, true,\n'
        '            "translation.youdao.app_secret");\n',
        "Youdao input names",
    )
    text = replace_once(
        text,
        '        newTagNameInput = makeInput("新标签名称", "", colors, false);\n'
        '        newTagColorInput = makeInput("#7C5CFC", "#7C5CFC", colors, false);\n',
        '        newTagNameInput = makeInput("新标签名称", "", colors, false,\n'
        '            "tag.new.name");\n'
        '        newTagColorInput = makeInput("#7C5CFC", "#7C5CFC", colors, false,\n'
        '            "tag.new.color");\n',
        "new tag input names",
    )
    text = replace_once(
        text,
        '        sectionAnchorSpacer = new View(appContext);\n'
        '        content.addView(sectionAnchorSpacer, new LinearLayout.LayoutParams(\n'
        '            LinearLayout.LayoutParams.MATCH_PARENT, 0));\n',
        '        sectionAnchorSpacer = new View(appContext);\n'
        '        content.addView(sectionAnchorSpacer, new LinearLayout.LayoutParams(\n'
        '            LinearLayout.LayoutParams.MATCH_PARENT, 0));\n'
        '        imeAnchorSpacer = new View(appContext);\n'
        '        content.addView(imeAnchorSpacer, new LinearLayout.LayoutParams(\n'
        '            LinearLayout.LayoutParams.MATCH_PARENT, 0));\n',
        "IME anchor view",
    )
    text = replace_once(
        text,
        '        uiState.lastMaxScrollYDp = 0;\n        uiState.renderCount += 1;\n',
        '        uiState.lastMaxScrollYDp = 0;\n'
        '        uiState.imeAnchorSpacerHeightDp = 0;\n'
        '        focusedInput = null;\n'
        '        focusedInputName = null;\n'
        '        focusedVisibilityScheduled = false;\n'
        '        uiState.focusedInputName = null;\n'
        '        uiState.focusedInputVisible = false;\n'
        '        uiState.renderCount += 1;\n',
        "buildPage IME reset",
    )
    text = replace_once(
        text,
        '        return runOnMainSync(function () {\n            size = panelSize();\n',
        '        return runOnMainSync(function () {\n'
        '            settingsLifecycleGeneration += 1;\n'
        '            size = panelSize();\n',
        "open lifecycle generation",
    )
    text = replace_once(
        text,
        '            panelParams.dimAmount = 0.44;\n'
        '            try { panelParams.setTitle("ClipHub Detail Settings Panel"); }\n',
        '            panelParams.dimAmount = 0.44;\n'
        '            panelParams.softInputMode =\n'
        '                WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE |\n'
        '                WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN;\n'
        '            uiState.softInputMode = Number(panelParams.softInputMode);\n'
        '            uiState.softInputAdjustResize =\n'
        '                (Number(panelParams.softInputMode) &\n'
        '                    Number(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)) !== 0;\n'
        '            try { panelParams.setTitle("ClipHub Detail Settings Panel"); }\n',
        "soft input mode",
    )
    text = replace_once(
        text,
        '            uiState.panelWidthDp = size.widthDp;\n'
        '            uiState.panelHeightDp = size.heightDp;\n'
        '            uiState.lastError = null;\n'
        '            buildPage();\n',
        '            uiState.panelWidthDp = size.widthDp;\n'
        '            uiState.panelHeightDp = size.heightDp;\n'
        '            uiState.normalPanelHeightDp = size.heightDp;\n'
        '            uiState.currentPanelHeightDp = size.heightDp;\n'
        '            uiState.currentPanelTopDp = Math.max(0,\n'
        '                pxToDp(Number(displayMetrics().heightPixels) -\n'
        '                    Number(size.height) - dp(10)));\n'
        '            uiState.panelGravity = "bottom";\n'
        '            uiState.panelBottomMarginDp = 10;\n'
        '            uiState.lastError = null;\n'
        '            buildPage();\n'
        '            startSettingsImeMonitoring();\n',
        "open IME monitoring",
    )
    text = replace_once(
        text,
        '        return runOnMainSync(function () {\n            try {\n                if (panelRoot !== null) {\n',
        '        return runOnMainSync(function () {\n'
        '            settingsLifecycleGeneration += 1;\n'
        '            stopSettingsImeMonitoring();\n'
        '            hideSettingsKeyboardOnMain();\n'
        '            try {\n'
        '                if (panelRoot !== null) {\n',
        "close IME stop",
    )
    text = replace_once(
        text,
        '                sectionAnchorSpacer = null;\n'
        '                translationStatusView = null;\n',
        '                sectionAnchorSpacer = null;\n'
        '                imeAnchorSpacer = null;\n'
        '                focusedInput = null;\n'
        '                focusedInputName = null;\n'
        '                focusedVisibilityScheduled = false;\n'
        '                translationStatusView = null;\n',
        "close IME clear",
    )
    text = replace_once(
        text,
        '            lastMaxScrollYDp: Number(uiState.lastMaxScrollYDp),\n'
        '            lastTestResult: uiState.lastTestResult,\n',
        '            lastMaxScrollYDp: Number(uiState.lastMaxScrollYDp),\n'
        '            softInputMode: Number(uiState.softInputMode),\n'
        '            softInputAdjustResize: uiState.softInputAdjustResize === true,\n'
        '            normalPanelHeightDp: Number(uiState.normalPanelHeightDp),\n'
        '            currentPanelHeightDp: Number(uiState.currentPanelHeightDp),\n'
        '            currentPanelTopDp: Number(uiState.currentPanelTopDp),\n'
        '            panelGravity: uiState.panelGravity,\n'
        '            panelBottomMarginDp: Number(uiState.panelBottomMarginDp),\n'
        '            keyboardVisible: uiState.keyboardVisible === true,\n'
        '            keyboardInsetDp: Number(uiState.keyboardInsetDp),\n'
        '            keyboardShowCount: Number(uiState.keyboardShowCount),\n'
        '            keyboardHideCount: Number(uiState.keyboardHideCount),\n'
        '            keyboardRequestCount: Number(uiState.keyboardRequestCount),\n'
        '            imeInsetsSupported: uiState.imeInsetsSupported === true,\n'
        '            imeInsetSource: uiState.imeInsetSource,\n'
        '            imeInsetBottomDp: Number(uiState.imeInsetBottomDp),\n'
        '            systemTopInsetDp: Number(uiState.systemTopInsetDp),\n'
        '            availableAboveImeDp: Number(uiState.availableAboveImeDp),\n'
        '            keyboardAvoidanceApplied:\n'
        '                uiState.keyboardAvoidanceApplied === true,\n'
        '            keyboardAvoidanceApplyCount:\n'
        '                Number(uiState.keyboardAvoidanceApplyCount),\n'
        '            keyboardAvoidanceRestoreCount:\n'
        '                Number(uiState.keyboardAvoidanceRestoreCount),\n'
        '            windowLayoutUpdateCount:\n'
        '                Number(uiState.windowLayoutUpdateCount),\n'
        '            imePollCount: Number(uiState.imePollCount),\n'
        '            layoutMeasureCount: Number(uiState.layoutMeasureCount),\n'
        '            rootMeasuredHeightDp: Number(uiState.rootMeasuredHeightDp),\n'
        '            scrollViewportHeightDp:\n'
        '                Number(uiState.scrollViewportHeightDp),\n'
        '            keyboardTopDp: Number(uiState.keyboardTopDp),\n'
        '            panelScreenBottomDp: Number(uiState.panelScreenBottomDp),\n'
        '            panelAboveKeyboard: uiState.panelAboveKeyboard === true,\n'
        '            focusedInputName: uiState.focusedInputName,\n'
        '            focusedInputVisible: uiState.focusedInputVisible === true,\n'
        '            focusedInputTopDp: Number(uiState.focusedInputTopDp),\n'
        '            focusedInputBottomDp: Number(uiState.focusedInputBottomDp),\n'
        '            inputFocusCount: Number(uiState.inputFocusCount),\n'
        '            inputAutoScrollCount: Number(uiState.inputAutoScrollCount),\n'
        '            imeAnchorAdjustmentCount:\n'
        '                Number(uiState.imeAnchorAdjustmentCount),\n'
        '            imeAnchorSpacerHeightDp:\n'
        '                Number(uiState.imeAnchorSpacerHeightDp),\n'
        '            delayedCallbackPostCount:\n'
        '                Number(uiState.delayedCallbackPostCount),\n'
        '            delayedCallbackRunCount:\n'
        '                Number(uiState.delayedCallbackRunCount),\n'
        '            delayedCallbackCancelCount:\n'
        '                Number(uiState.delayedCallbackCancelCount),\n'
        '            delayedCallbackErrorCount:\n'
        '                Number(uiState.delayedCallbackErrorCount),\n'
        '            pendingDelayedCallbackCount:\n'
        '                Number(uiState.pendingDelayedCallbackCount),\n'
        '            lastDelayedCallbackError: uiState.lastDelayedCallbackError,\n'
        '            lastTestResult: uiState.lastTestResult,\n',
        "getState IME metrics",
    )
    text = replace_once(
        text,
        '        MODULE_VERSION: 9,\n',
        '        MODULE_VERSION: 10,\n',
        "Settings module version",
    )
    text = replace_once(
        text,
        '            mainHandler = new Handler(Looper.getMainLooper());\n'
        '            density = Number(appContext.getResources()\n',
        '            mainHandler = new Handler(Looper.getMainLooper());\n'
        '            inputMethodManager = appContext.getSystemService(\n'
        '                Context.INPUT_METHOD_SERVICE);\n'
        '            density = Number(appContext.getResources()\n',
        "init input method manager",
    )
    text = replace_once(
        text,
        '        scrollToSection: scrollToSection,\n'
        '        performCreateTag: function (name, colorTextValue) {\n',
        '        scrollToSection: scrollToSection,\n'
        '        performFocusInput: function (name) {\n'
        '            return runOnMainSync(function () {\n'
        '                return focusSettingsInput(name);\n'
        '            }, 3000);\n'
        '        },\n'
        '        hideKeyboard: function () {\n'
        '            return runOnMainSync(hideSettingsKeyboardOnMain, 3000);\n'
        '        },\n'
        '        performCreateTag: function (name, colorTextValue) {\n',
        "public IME methods",
    )
    text = replace_once(
        text,
        '        shutdown: function () {\n'
        '            try { closePage("shutdown"); } catch (ignoredClose) {}\n'
        '            values = {};\n',
        '        shutdown: function () {\n'
        '            settingsLifecycleGeneration += 1;\n'
        '            stopSettingsImeMonitoring();\n'
        '            try { closePage("shutdown"); } catch (ignoredClose) {}\n'
        '            values = {};\n',
        "shutdown monitoring stop",
    )
    text = replace_once(
        text,
        '            windowManager = null;\n'
        '            mainHandler = null;\n'
        '            return true;\n',
        '            windowManager = null;\n'
        '            inputMethodManager = null;\n'
        '            mainHandler = null;\n'
        '            return true;\n',
        "shutdown IME clear",
    )

    if text.count("mainHandler.postDelayed(imePollRunnable, 90)") != 1:
        die("Expected exactly one Settings IME poll postDelayed")
    return text, True


def patch_manifest(settings_text: str) -> tuple[str, bool]:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    current_set = str(manifest.get("moduleSetVersion", ""))
    if current_set not in {OLD_SET, NEW_SET}:
        die(f"Unexpected moduleSetVersion: {current_set}")
    found = False
    new_sha = blob_sha(settings_text)
    changed = current_set != NEW_SET
    manifest["moduleSetVersion"] = NEW_SET
    for module in manifest.get("modules", []):
        if module.get("name") == "ch_13_settings.js":
            found = True
            if module.get("sha") != new_sha:
                module["sha"] = new_sha
                changed = True
            break
    if not found:
        die("Settings module entry missing from manifest")
    return json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", changed


def main() -> None:
    assert_clean_targets()
    settings_text = SETTINGS.read_text(encoding="utf-8")
    settings_text, settings_changed = patch_settings(settings_text)
    manifest_text, manifest_changed = patch_manifest(settings_text)
    SETTINGS.write_text(settings_text, encoding="utf-8")
    MANIFEST.write_text(manifest_text, encoding="utf-8")

    print("Settings module:", "changed" if settings_changed else "already v10")
    print("Settings blob SHA:", blob_sha(settings_text))
    print("moduleSetVersion:", NEW_SET)
    print("IME layout marker:", settings_text.count("function applySettingsImeLayout(ime)"))
    print("focused input marker:", settings_text.count("function scheduleFocusedInputVisibility()"))
    print("direct IME poll postDelayed count:", settings_text.count("mainHandler.postDelayed(imePollRunnable, 90)"))
    print("Updated targets" if settings_changed or manifest_changed else "No target changes required")


if __name__ == "__main__":
    main()
