(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var Context = Packages.android.content.Context;
    var Intent = Packages.android.content.Intent;
    var Uri = Packages.android.net.Uri;
    var PackageManager = Packages.android.content.pm.PackageManager;
    var ActivityManager = Packages.android.app.ActivityManager;
    var UserHandle = Packages.android.os.UserHandle;
    var Build = Packages.android.os.Build;
    var Looper = Packages.android.os.Looper;
    var Handler = Packages.android.os.Handler;
    var View = Packages.android.view.View;
    var MotionEvent = Packages.android.view.MotionEvent;
    var Gravity = Packages.android.view.Gravity;
    var WindowManager = Packages.android.view.WindowManager;
    var PixelFormat = Packages.android.graphics.PixelFormat;
    var Color = Packages.android.graphics.Color;
    var Rect = Packages.android.graphics.Rect;
    var DisplayMetrics = Packages.android.util.DisplayMetrics;
    var WindowInsets = Packages.android.view.WindowInsets;
    var InputMethodManager = Packages.android.view.inputmethod.InputMethodManager;
    var GradientDrawable = Packages.android.graphics.drawable.GradientDrawable;
    var LinearLayout = Packages.android.widget.LinearLayout;
    var FrameLayout = Packages.android.widget.FrameLayout;
    var ScrollView = Packages.android.widget.ScrollView;
    var TextView = Packages.android.widget.TextView;
    var EditText = Packages.android.widget.EditText;
    var TypedValue = Packages.android.util.TypedValue;
    var InputType = Packages.android.text.InputType;
    var TextWatcher = Packages.android.text.TextWatcher;
    var TextUtils = Packages.android.text.TextUtils;
    var CountDownLatch = Packages.java.util.concurrent.CountDownLatch;
    var TimeUnit = Packages.java.util.concurrent.TimeUnit;
    var Thread = Packages.java.lang.Thread;
    var File = Packages.java.io.File;
    var FIS = Packages.java.io.FileInputStream;
    var ISR = Packages.java.io.InputStreamReader;
    var BR = Packages.java.io.BufferedReader;
    var SB = Packages.java.lang.StringBuilder;

    var values = {};
    var ready = false;
    var lastCleanup = null;
    var initContext = null;
    var appContext = null;
    var windowManager = null;
    var mainHandler = null;
    var inputMethodManager = null;
    var settingsLifecycleGeneration = 0;
    var imePollGeneration = 0;
    var imePollRunnable = null;
    var layoutObserver = null;
    var layoutListener = null;
    var focusedInput = null;
    var focusedInputName = null;
    var focusedVisibilityScheduled = false;
    var density = 1;
    var panelRoot = null;
    var panelWindowRoot = null;
    var panelManagedFrame = null;
    var panelParams = null;
    var scrollRoot = null;
    var contentRoot = null;
    var sectionAnchorSpacer = null;
    var imeAnchorSpacer = null;
    var translationStatusView = null;
    var engineBaiduView = null;
    var engineYoudaoView = null;
    var baiduGroup = null;
    var youdaoGroup = null;
    var baiduIdInput = null;
    var baiduSecretInput = null;
    var youdaoKeyInput = null;
    var youdaoSecretInput = null;
    var newTagNameInput = null;
    var newTagColorInput = null;
    var closeView = null;
    var sensitivePolicyView = null;
    var historyEnabledView = null;
    var draftEngine = "baidu";
    var tagRowViews = {};
    var translationSectionView = null;
    var tagsSectionView = null;
    var dataSectionView = null;
    var blogLinkView = null;
    var clearAllItemsView = null;
    var pendingDeleteTagId = null;
    var pendingClearTagId = null;
    var pendingClearAll = false;
    var uiState = {
        attached: false,
        openCount: 0,
        closeCount: 0,
        renderCount: 0,
        saveTranslationCount: 0,
        testTranslationCount: 0,
        testTranslationSuccessCount: 0,
        tagCreateCount: 0,
        tagUpdateCount: 0,
        tagDeleteCount: 0,
        tagReorderCount: 0,
        tagDragStartCount: 0,
        tagDragCommitCount: 0,
        tagColorPreviewCount: 0,
        tagDeleteConfirmCount: 0,
        tagItemsClearConfirmCount: 0,
        tagItemsClearCount: 0,
        clearAllConfirmCount: 0,
        clearAllCount: 0,
        lastDraggedTagId: null,
        lastClearedTagId: null,
        lastClearedItemCount: 0,
        lastClearAllCount: 0,
        pendingDeleteTagId: null,
        pendingClearTagId: null,
        pendingClearAll: false,
        clearHistoryCount: 0,
        settingsStyle: "reference_settings_v2",
        sectionCount: 4,
        translationFieldCount: 4,
        tagRowCount: 0,
        panelWidthDp: 0,
        panelHeightDp: 0,
        panelClipToOutline: false,
        scrollResetCount: 0,
        sectionScrollRequestCount: 0,
        sectionScrollAppliedCount: 0,
        sectionScrollCancelCount: 0,
        currentScrollYDp: 0,
        lastScrollSection: null,
        lastSectionViewportTopDp: null,
        sectionAnchorAdjustmentCount: 0,
        sectionAnchorSpacerHeightDp: 0,
        lastRequestedScrollYDp: 0,
        lastMaxScrollYDp: 0,
        softInputMode: 0,
        softInputAdjustResize: false,
        normalPanelHeightDp: 0,
        currentPanelHeightDp: 0,
        currentPanelTopDp: 0,
        panelGravity: "bottom",
        panelBottomMarginDp: 10,
        keyboardVisible: false,
        keyboardInsetDp: 0,
        keyboardShowCount: 0,
        keyboardHideCount: 0,
        keyboardRequestCount: 0,
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
        imePollFastCount: 0,
        imePollIdleCount: 0,
        imePollIntervalMs: 0,
        layoutMeasureCount: 0,
        rootMeasuredHeightDp: 0,
        scrollViewportHeightDp: 0,
        keyboardTopDp: 0,
        panelScreenBottomDp: 0,
        panelAboveKeyboard: false,
        focusedInputName: null,
        focusedInputVisible: false,
        focusedInputTopDp: 0,
        focusedInputBottomDp: 0,
        inputFocusCount: 0,
        inputAutoScrollCount: 0,
        imeAnchorAdjustmentCount: 0,
        imeAnchorSpacerHeightDp: 0,
        delayedCallbackPostCount: 0,
        delayedCallbackRunCount: 0,
        delayedCallbackCancelCount: 0,
        delayedCallbackErrorCount: 0,
        pendingDelayedCallbackCount: 0,
        lastDelayedCallbackError: null,
        blogOpenCount: 0,
        blogOpenSuccessCount: 0,
        blogOpenFailureCount: 0,
        lastOpenedUrl: null,
        lastBlogLaunchMethod: null,
        lastBlogLaunchUserId: -1,
        lastTestResult: "",
        lastError: null
    };

    var DEFAULTS = {
        historyLimit: 0,
        autoCleanupDays: 0,
        closeAfterCopy: false,
        themeMode: "system",
        sourceEnabled: true,
        sensitivePolicy: "skip",
        ignorePackages: [],
        windowPosition: null,
        windowGeometry: null,
        filterSearchHistory: [],
        searchHistoryEnabled: true,
        "translation.engine": "baidu",
        "translation.baidu.app_id": "",
        "translation.baidu.app_secret": "",
        "translation.youdao.app_key": "",
        "translation.youdao.app_secret": "",
        "translation.auto_direction": true,
        "translation.max_chars": 5000
    };

    function dp(value) {
        return Math.max(1, Math.floor(Number(value) * density + 0.5));
    }


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

    function postSettingsViewCallback(expectedView, callback,
            requireAttached) {
        var generation = settingsLifecycleGeneration;
        var runnable;
        var posted;
        if (expectedView === null || typeof callback !== "function") {
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
        try { posted = expectedView.post(runnable); }
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
        if ((!ime.visible || Number(ime.bottomPx) < dp(120)) &&
                panelWindowRoot !== null && ClipHub.Window &&
                typeof ClipHub.Window.refreshWindow === "function") {
            uiState.keyboardAvoidanceApplied = false;
            uiState.panelGravity = "shared";
            uiState.panelBottomMarginDp = 0;
            ClipHub.Window.refreshWindow(panelWindowRoot,
                "settings_ime_restore");
            uiState.currentPanelHeightDp = Number(
                uiState.normalPanelHeightDp || uiState.panelHeightDp || 0);
            return true;
        }
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
            targetGravity = Gravity.TOP | Gravity.START;
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
            windowManager.updateViewLayout(
                panelWindowRoot !== null ? panelWindowRoot : panelRoot,
                panelParams);
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
            postSettingsViewCallback(expectedRoot, function () {
                try {
                    applyFocusedInputScroll(expectedInput, expectedRoot);
                } finally {
                    focusedVisibilityScheduled = false;
                }
            }, true);
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

    function nextSettingsImePollDelay() {
        var active = uiState.keyboardVisible === true;
        try {
            active = active || (focusedInput !== null && focusedInput.hasFocus());
        } catch (ignoredFocus) {}
        if (active) {
            uiState.imePollFastCount += 1;
            uiState.imePollIntervalMs = 90;
            return 90;
        }
        uiState.imePollIdleCount += 1;
        uiState.imePollIntervalMs = 420;
        return 420;
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
                var delayMs;
                var posted = false;
                if (mainHandler !== null && imePollRunnable !== null) {
                    delayMs = nextSettingsImePollDelay();
                    try {
                        posted = mainHandler.postDelayed(
                            imePollRunnable, delayMs);
                    } catch (error) {
                        uiState.delayedCallbackErrorCount += 1;
                        uiState.lastDelayedCallbackError = String(error);
                        uiState.lastError = String(error);
                    }
                    if (!posted) { imePollRunnable = null; }
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

    function closeQuietly(value) {
        if (value !== null && value !== undefined) {
            try { value.close(); } catch (ignored) {}
        }
    }

    function runOnMainSync(callback, timeoutMs) {
        var mainLooper = Looper.getMainLooper();
        var box;
        var latch;
        var runnable;
        var posted;
        var completed;
        if (Looper.myLooper() === mainLooper) { return callback(); }
        box = { value: null, error: null };
        latch = new CountDownLatch(1);
        runnable = new Packages.java.lang.Runnable({
            run: function () {
                try { box.value = callback(); }
                catch (error) { box.error = error; }
                finally { latch.countDown(); }
            }
        });
        posted = mainHandler.post(runnable);
        if (!posted) { throw new Error("Settings main handler post failed"); }
        completed = latch.await(Number(timeoutMs || 3000), TimeUnit.MILLISECONDS);
        if (!completed) {
            try { mainHandler.removeCallbacks(runnable); } catch (ignored) {}
            throw new Error("Settings main handler timeout");
        }
        if (box.error !== null) { throw box.error; }
        return box.value;
    }

    function copyArray(input) {
        var output = [];
        var index;
        input = input || [];
        for (index = 0; index < input.length; index += 1) {
            output.push(String(input[index]));
        }
        return output;
    }

    function copyPosition(input) {
        if (!input || typeof input !== "object") { return null; }
        return { xRatio: Number(input.xRatio), yRatio: Number(input.yRatio) };
    }

    function copyWindowGeometry(input) {
        function copyBucket(bucket) {
            if (!bucket || typeof bucket !== "object") { return null; }
            return {
                xRatio: Number(bucket.xRatio),
                yRatio: Number(bucket.yRatio),
                widthRatio: Number(bucket.widthRatio),
                heightRatio: Number(bucket.heightRatio)
            };
        }
        if (!input || typeof input !== "object") { return null; }
        return {
            version: Number(input.version || 1),
            portrait: copyBucket(input.portrait),
            landscape: copyBucket(input.landscape)
        };
    }

    function copyValue(value) {
        if (value && typeof value === "object" &&
                Object.prototype.toString.call(value) === "[object Array]") {
            return copyArray(value);
        }
        if (value && typeof value === "object" &&
                (Object.prototype.hasOwnProperty.call(value, "portrait") ||
                    Object.prototype.hasOwnProperty.call(value, "landscape"))) {
            return copyWindowGeometry(value);
        }
        if (value && typeof value === "object" &&
                Object.prototype.hasOwnProperty.call(value, "xRatio") &&
                Object.prototype.hasOwnProperty.call(value, "yRatio")) {
            return copyPosition(value);
        }
        return value;
    }

    function defaultsCopy() {
        var output = {};
        var key;
        for (key in DEFAULTS) {
            if (DEFAULTS.hasOwnProperty(key)) {
                output[key] = copyValue(DEFAULTS[key]);
            }
        }
        return output;
    }

    function intRange(value, minimum, maximum, fallback) {
        var number = Number(value);
        if (!isFinite(number)) { return fallback; }
        number = Math.floor(number);
        if (number < minimum) { number = minimum; }
        if (number > maximum) { number = maximum; }
        return number;
    }

    function ratio(value, fallback) {
        var number = Number(value);
        if (!isFinite(number)) { return fallback; }
        if (number < 0) { number = 0; }
        if (number > 1) { number = 1; }
        return number;
    }

    function normalizePosition(input) {
        if (input === null || input === undefined) { return null; }
        if (typeof input !== "object") {
            throw new Error("windowPosition must be null or an object");
        }
        return { xRatio: ratio(input.xRatio, 1), yRatio: ratio(input.yRatio, 0) };
    }

    function normalizeWindowGeometry(input) {
        function bucket(value, fallbackWidth, fallbackHeight) {
            if (!value || typeof value !== "object") { return null; }
            return {
                xRatio: ratio(value.xRatio, 0.5),
                yRatio: ratio(value.yRatio, 1),
                widthRatio: ratio(value.widthRatio, fallbackWidth),
                heightRatio: ratio(value.heightRatio, fallbackHeight)
            };
        }
        if (input === null || input === undefined) { return null; }
        if (typeof input !== "object") {
            throw new Error("windowGeometry must be null or an object");
        }
        return {
            version: 1,
            portrait: bucket(input.portrait, 0.94, 0.82),
            landscape: bucket(input.landscape, 0.68, 0.90)
        };
    }

    function normalizePackages(input) {
        var output = [];
        var seen = {};
        var index;
        var value;
        input = input || [];
        if (Object.prototype.toString.call(input) !== "[object Array]") {
            throw new Error("ignorePackages must be an array");
        }
        for (index = 0; index < input.length; index += 1) {
            value = String(input[index] === null || input[index] === undefined
                ? "" : input[index]).replace(/^\s+|\s+$/g, "");
            if (value.length > 0 && !seen[value]) {
                seen[value] = true;
                output.push(value);
            }
        }
        return output;
    }

    function normalizeSearchHistory(input) {
        var output = [];
        var seen = {};
        var index;
        var item;
        input = input || [];
        if (Object.prototype.toString.call(input) !== "[object Array]") {
            throw new Error("filterSearchHistory must be an array");
        }
        for (index = 0; index < input.length && output.length < 10;
                index += 1) {
            item = String(input[index] === null || input[index] === undefined
                ? "" : input[index]).replace(/^\s+|\s+$/g, "");
            if (item.length > 0 && !seen[item.toLowerCase()]) {
                seen[item.toLowerCase()] = true;
                output.push(item.substring(0, 120));
            }
        }
        return output;
    }

    function normalizedSecret(value) {
        return String(value === null || value === undefined ? "" : value)
            .replace(/^\s+|\s+$/g, "").substring(0, 512);
    }

    function normalize(key, value) {
        if (key === "historyLimit") {
            return intRange(value, 0, 100000, DEFAULTS.historyLimit);
        }
        if (key === "autoCleanupDays") {
            return intRange(value, 0, 3650, DEFAULTS.autoCleanupDays);
        }
        if (key === "closeAfterCopy" || key === "sourceEnabled" ||
                key === "searchHistoryEnabled" ||
                key === "translation.auto_direction") {
            return value === true;
        }
        if (key === "translation.max_chars") {
            return intRange(value, 1, 10000, DEFAULTS["translation.max_chars"]);
        }
        if (key === "translation.engine") {
            value = String(value || "baidu");
            return value === "youdao" ? "youdao" : "baidu";
        }
        if (key === "translation.baidu.app_id" ||
                key === "translation.baidu.app_secret" ||
                key === "translation.youdao.app_key" ||
                key === "translation.youdao.app_secret") {
            return normalizedSecret(value);
        }
        if (key === "themeMode") {
            value = String(value);
            return value === "light" || value === "dark" || value === "system"
                ? value : DEFAULTS.themeMode;
        }
        if (key === "sensitivePolicy") {
            value = String(value);
            if (value !== "skip" && value !== "save") {
                throw new Error("Invalid sensitive policy");
            }
            return value;
        }
        if (key === "ignorePackages") { return normalizePackages(value); }
        if (key === "windowPosition") { return normalizePosition(value); }
        if (key === "windowGeometry") {
            return normalizeWindowGeometry(value);
        }
        if (key === "filterSearchHistory") {
            return normalizeSearchHistory(value);
        }
        throw new Error("Unknown setting: " + key);
    }

    function serialize(value) { return JSON.stringify(value); }

    function deserialize(key, text) {
        var parsed;
        try { parsed = JSON.parse(String(text)); }
        catch (ignored) { parsed = DEFAULTS[key]; }
        return normalize(key, parsed);
    }

    function requireReady() {
        if (!ready || !ClipHub.Database || !ClipHub.Database.isOpen()) {
            throw new Error("ClipHub settings are not ready");
        }
    }

    function persist(key, value) {
        return ClipHub.Database.executeInsert(
            "INSERT OR REPLACE INTO settings(key, value, updated_at) " +
            "VALUES (?, ?, ?)",
            [key, serialize(value), ClipHub.Base.now()]
        );
    }

    function load() {
        var rows = ClipHub.Database.queryAll("SELECT key, value FROM settings", []);
        var output = defaultsCopy();
        var index;
        var key;
        for (index = 0; index < rows.length; index += 1) {
            key = String(rows[index].key || "");
            if (DEFAULTS.hasOwnProperty(key)) {
                output[key] = deserialize(key, rows[index].value);
            }
        }
        values = output;
        return getAll();
    }

    function applyClipboard() {
        if (ClipHub.Clipboard &&
                typeof ClipHub.Clipboard.configure === "function") {
            ClipHub.Clipboard.configure({
                sourceEnabled: values.sourceEnabled,
                sensitivePolicy: values.sensitivePolicy,
                ignorePackages: copyArray(values.ignorePackages)
            });
            return true;
        }
        return false;
    }

    function cleanup(referenceAt) {
        requireReady();
        if (!ClipHub.Repository ||
                typeof ClipHub.Repository.cleanupHistory !== "function") {
            throw new Error("Repository cleanup is unavailable");
        }
        lastCleanup = ClipHub.Repository.cleanupHistory({
            historyLimit: values.historyLimit,
            autoCleanupDays: values.autoCleanupDays,
            referenceAt: referenceAt
        });
        lastCleanup.at = ClipHub.Base.now();
        return getLastCleanup();
    }

    function setValue(key, value, options) {
        var normalized;
        var shouldCleanup;
        options = options || {};
        requireReady();
        key = String(key);
        normalized = normalize(key, value);
        persist(key, normalized);
        values[key] = copyValue(normalized);
        if (key === "sourceEnabled" || key === "sensitivePolicy" ||
                key === "ignorePackages") {
            applyClipboard();
        }
        shouldCleanup = key === "historyLimit" ||
            key === "autoCleanupDays";
        if (shouldCleanup && options.cleanup !== false) { cleanup(); }
        return copyValue(values[key]);
    }

    function setMany(patch, options) {
        var normalized = {};
        var key;
        var needsClipboard = false;
        var needsCleanup = false;
        options = options || {};
        requireReady();
        patch = patch || {};
        for (key in patch) {
            if (patch.hasOwnProperty(key)) {
                normalized[key] = normalize(String(key), patch[key]);
            }
        }
        ClipHub.Database.transaction(function () {
            for (key in normalized) {
                if (normalized.hasOwnProperty(key)) {
                    persist(key, normalized[key]);
                }
            }
        });
        for (key in normalized) {
            if (normalized.hasOwnProperty(key)) {
                values[key] = copyValue(normalized[key]);
                if (key === "sourceEnabled" || key === "sensitivePolicy" ||
                        key === "ignorePackages") {
                    needsClipboard = true;
                }
                if (key === "historyLimit" || key === "autoCleanupDays") {
                    needsCleanup = true;
                }
            }
        }
        if (needsClipboard) { applyClipboard(); }
        if (needsCleanup && options.cleanup !== false) { cleanup(); }
        return getAll();
    }

    function getAll() {
        var output = {};
        var key;
        for (key in values) {
            if (values.hasOwnProperty(key)) {
                output[key] = copyValue(values[key]);
            }
        }
        return output;
    }

    function getLastCleanup() {
        var output = {};
        var key;
        if (lastCleanup === null) { return null; }
        for (key in lastCleanup) {
            if (lastCleanup.hasOwnProperty(key)) { output[key] = lastCleanup[key]; }
        }
        return output;
    }

    function isDark() {
        var mode = String(values.themeMode || "system");
        var config;
        if (mode === "dark") { return true; }
        if (mode === "light") { return false; }
        try {
            config = appContext.getResources().getConfiguration();
            return (Number(config.uiMode) &
                Number(Packages.android.content.res.Configuration.UI_MODE_NIGHT_MASK)) ===
                Number(Packages.android.content.res.Configuration.UI_MODE_NIGHT_YES);
        } catch (ignored) { return false; }
    }

    function palette() {
        try {
            if (ClipHub.Theme && typeof ClipHub.Theme.getPalette === "function") {
                return ClipHub.Theme.getPalette(appContext);
            }
        } catch (ignored) {}
        return isDark() ? {
            surface: "#FF211E2A", surfaceMuted: "#FF292532",
            stroke: "#FF3D3748", accentStrong: "#FF9476F8",
            accentSoft: "#FF302946", accentBorder: "#FF6F5A9D",
            textPrimary: "#FFF7F3FF", textSecondary: "#FFC8C0D1",
            textTertiary: "#FF968DA1", icon: "#FFE7DFF1"
        } : {
            surface: "#FFFFFFFF", surfaceMuted: "#FFF5F3FB",
            stroke: "#FFE5E0EF", accentStrong: "#FF5A37E6",
            accentSoft: "#FFF0ECFF", accentBorder: "#FFBBAAF8",
            textPrimary: "#FF1F1C28", textSecondary: "#FF6F697A",
            textTertiary: "#FF9992A3", icon: "#FF3D3748"
        };
    }

    function roundedBackground(fill, stroke, radiusDp) {
        var drawable = new GradientDrawable();
        drawable.setShape(GradientDrawable.RECTANGLE);
        ClipHub.Theme.applyGradientColor(drawable, fill);
        drawable.setCornerRadius(dp(radiusDp));
        if (stroke !== null && stroke !== undefined) {
            ClipHub.Theme.applyGradientStroke(drawable, dp(1), stroke);
        }
        return drawable;
    }

    function makeText(text, size, color, bold) {
        var view = new TextView(appContext);
        view.setText(String(text));
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, Number(size));
        ClipHub.Theme.applyTextColor(view, color);
        view.setIncludeFontPadding(false);
        if (bold) {
            view.setTypeface(Packages.android.graphics.Typeface.DEFAULT,
                Packages.android.graphics.Typeface.BOLD);
        }
        return view;
    }

    function makeButton(text, colors, primary, danger) {
        var view = makeText(text, 10,
            danger ? "#FFB42323" : (primary ? "#FFFFFFFF" : colors.accentStrong),
            primary || danger);
        view.setGravity(Gravity.CENTER);
        view.setSingleLine(true);
        view.setPadding(dp(8), dp(6), dp(8), dp(6));
        view.setBackground(roundedBackground(
            primary ? colors.accentStrong : colors.accentSoft,
            primary ? colors.accentStrong : colors.accentBorder, 11));
        view.setClickable(true);
        view.setFocusable(true);
        return view;
    }

    function makeInput(hint, value, colors, secret, inputName) {
        var input = new EditText(appContext);
        input.setSingleLine(true);
        input.setHint(String(hint));
        input.setText(String(value || ""));
        input.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        ClipHub.Theme.applyTextColor(input, colors.textPrimary);
        ClipHub.Theme.applyHintTextColor(input, colors.textTertiary);
        input.setPadding(dp(10), dp(5), dp(10), dp(5));
        input.setBackground(roundedBackground(colors.surfaceMuted,
            colors.stroke, 11));
        if (secret) {
            input.setInputType(InputType.TYPE_CLASS_TEXT |
                InputType.TYPE_TEXT_VARIATION_PASSWORD);
        } else {
            input.setInputType(InputType.TYPE_CLASS_TEXT);
        }
        bindSettingsInput(input, inputName || hint);
        return input;
    }

    function addField(parent, label, input, colors) {
        var labelView = makeText(label, 10, colors.textSecondary, true);
        var params;
        parent.addView(labelView, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(42));
        params.topMargin = dp(4);
        params.bottomMargin = dp(7);
        parent.addView(input, params);
    }

    function makeSection(colors) {
        var section = new LinearLayout(appContext);
        section.setOrientation(LinearLayout.VERTICAL);
        section.setPadding(dp(11), dp(10), dp(11), dp(10));
        section.setBackground(roundedBackground(colors.surface,
            colors.stroke, 15));
        return section;
    }

    function addSection(parent, section) {
        var params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(9);
        parent.addView(section, params);
    }

    function updateGeneralButtons(colors) {
        if (sensitivePolicyView !== null) {
            sensitivePolicyView.setText(values.sensitivePolicy === "save" ?
                "敏感内容：保存" : "敏感内容：跳过");
        }
        if (historyEnabledView !== null) {
            historyEnabledView.setText(values.searchHistoryEnabled ?
                "搜索历史：开启" : "搜索历史：关闭");
        }
    }

    function translationDraftFromInputs() {
        return {
            "translation.engine": draftEngine,
            "translation.baidu.app_id": baiduIdInput === null ? "" :
                String(baiduIdInput.getText()),
            "translation.baidu.app_secret": baiduSecretInput === null ? "" :
                String(baiduSecretInput.getText()),
            "translation.youdao.app_key": youdaoKeyInput === null ? "" :
                String(youdaoKeyInput.getText()),
            "translation.youdao.app_secret": youdaoSecretInput === null ? "" :
                String(youdaoSecretInput.getText()),
            "translation.auto_direction": true,
            "translation.max_chars": 5000
        };
    }

    function updateEngineViews(colors) {
        var baidu = draftEngine === "baidu";
        if (baiduGroup !== null) {
            baiduGroup.setVisibility(baidu ? View.VISIBLE : View.GONE);
        }
        if (youdaoGroup !== null) {
            youdaoGroup.setVisibility(baidu ? View.GONE : View.VISIBLE);
        }
        if (engineBaiduView !== null) {
            engineBaiduView.setBackground(roundedBackground(
                baidu ? colors.accentStrong : colors.accentSoft,
                colors.accentBorder, 11));
            ClipHub.Theme.applyTextColor(engineBaiduView, baidu ? "#FFFFFFFF" : colors.accentStrong);
        }
        if (engineYoudaoView !== null) {
            engineYoudaoView.setBackground(roundedBackground(
                baidu ? colors.accentSoft : colors.accentStrong,
                colors.accentBorder, 11));
            ClipHub.Theme.applyTextColor(engineYoudaoView, baidu ? colors.accentStrong : "#FFFFFFFF");
        }
    }

    function saveTranslationSettings() {
        try {
            setMany(translationDraftFromInputs(), { cleanup: false });
            uiState.saveTranslationCount += 1;
            if (translationStatusView !== null) {
                translationStatusView.setText("配置已保存到 SQLite");
            }
            return true;
        } catch (error) {
            uiState.lastError = String(error);
            if (translationStatusView !== null) {
                translationStatusView.setText("保存失败：" + String(error));
            }
            return false;
        }
    }

    function testTranslationSettings() {
        if (!saveTranslationSettings()) { return false; }
        uiState.testTranslationCount += 1;
        if (translationStatusView !== null) {
            translationStatusView.setText("正在测试翻译…");
        }
        try {
            if (!ClipHub.Translation ||
                    typeof ClipHub.Translation.testConfigured !== "function") {
                throw new Error("翻译模块尚未就绪");
            }
            ClipHub.Translation.testConfigured("ClipHub 翻译测试",
                function (result) {
                    runOnMainSync(function () {
                        if (result && result.ok === true) {
                            uiState.testTranslationSuccessCount += 1;
                            uiState.lastTestResult = String(result.translatedText || "");
                            if (translationStatusView !== null) {
                                translationStatusView.setText("测试成功：" +
                                    uiState.lastTestResult);
                            }
                        } else {
                            uiState.lastError = result ? String(result.error) :
                                "翻译测试失败";
                            if (translationStatusView !== null) {
                                translationStatusView.setText("测试失败：" +
                                    uiState.lastError);
                            }
                        }
                        return true;
                    }, 3000);
                });
            return true;
        } catch (error) {
            uiState.lastError = String(error);
            if (translationStatusView !== null) {
                translationStatusView.setText("测试失败：" + String(error));
            }
            return false;
        }
    }

    function parseColorValue(text, fallback) {
        try { return Number(Color.parseColor(String(text || ""))); }
        catch (ignored) { return fallback; }
    }

    function colorText(value) {
        var number;
        var hex;
        if (value === null || value === undefined) { return "#7C5CFC"; }
        number = Number(value) >>> 0;
        hex = number.toString(16).toUpperCase();
        while (hex.length < 8) { hex = "0" + hex; }
        return "#" + hex.substring(2);
    }

    function colorValueText(value, fallback) {
        var number;
        var hex;
        if (value === null || value === undefined) {
            return String(fallback || "#7C5CFC");
        }
        number = Number(value) >>> 0;
        hex = number.toString(16).toUpperCase();
        while (hex.length < 8) { hex = "0" + hex; }
        return "#" + hex;
    }

    function makeColorSwatch(value, colors) {
        var swatch = new View(appContext);
        swatch.setBackground(roundedBackground(
            colorValueText(value, colors.accentStrong), colors.stroke, 99));
        uiState.tagColorPreviewCount += 1;
        return swatch;
    }

    function bindColorPreview(input, swatch, fallback, colors) {
        input.addTextChangedListener(new JavaAdapter(TextWatcher, {
            beforeTextChanged: function () {},
            onTextChanged: function () {
                var value = parseColorValue(String(input.getText()), fallback);
                swatch.setBackground(roundedBackground(
                    colorValueText(value, colors.accentStrong),
                    colors.stroke, 99));
            },
            afterTextChanged: function () {}
        }));
    }

    function rebuildTagPage() {
        buildPage();
        postScrollToSection("tags");
        return true;
    }

    function requestDeleteTag(tagId, itemCount, deleteView) {
        tagId = Number(tagId);
        pendingClearTagId = null;
        uiState.pendingClearTagId = null;
        pendingClearAll = false;
        uiState.pendingClearAll = false;
        if (pendingDeleteTagId !== tagId) {
            pendingDeleteTagId = tagId;
            uiState.pendingDeleteTagId = tagId;
            uiState.tagDeleteConfirmCount += 1;
            deleteView.setText("确认删除");
            deleteView.setContentDescription("再次点击删除标签，当前关联 " +
                String(Number(itemCount || 0)) + " 条记录");
            return false;
        }
        pendingDeleteTagId = null;
        uiState.pendingDeleteTagId = null;
        return deleteTagRow(tagId);
    }

    function bindTagDrag(handle, rowRoot, tagId) {
        var startY = 0;
        var dragging = false;
        handle.setOnTouchListener(new JavaAdapter(View.OnTouchListener, {
            onTouch: function (view, event) {
                var action = Number(event.getActionMasked());
                var delta;
                if (action === MotionEvent.ACTION_DOWN) {
                    startY = Number(event.getRawY());
                    dragging = true;
                    uiState.tagDragStartCount += 1;
                    uiState.lastDraggedTagId = Number(tagId);
                    rowRoot.setAlpha(0.92);
                    return true;
                }
                if (action === MotionEvent.ACTION_MOVE && dragging) {
                    delta = Math.max(-dp(64), Math.min(dp(64),
                        Number(event.getRawY()) - startY));
                    rowRoot.setTranslationY(delta);
                    return true;
                }
                if ((action === MotionEvent.ACTION_UP ||
                        action === MotionEvent.ACTION_CANCEL) && dragging) {
                    delta = Number(event.getRawY()) - startY;
                    dragging = false;
                    rowRoot.setTranslationY(0);
                    rowRoot.setAlpha(1);
                    if (Math.abs(delta) >= dp(28)) {
                        if (moveTag(Number(tagId), delta > 0 ? 1 : -1)) {
                            uiState.tagDragCommitCount += 1;
                        }
                    }
                    return true;
                }
                return false;
            }
        }));
    }

    function emitTagsChanged(action, tagId) {
        try {
            if (ClipHub.EventBus && typeof ClipHub.EventBus.emit === "function") {
                ClipHub.EventBus.emit("tags_changed", {
                    action: String(action), tagId: Number(tagId || 0),
                    at: ClipHub.Base.now()
                });
            }
        } catch (ignored) {}
    }

    function emitClipboardBatchDeleted(scope, count, tagId, deletedAt) {
        try {
            if (ClipHub.EventBus && typeof ClipHub.EventBus.emit === "function") {
                ClipHub.EventBus.emit("clipboard_deleted", {
                    id: 0,
                    batch: true,
                    scope: String(scope || "all"),
                    count: Number(count || 0),
                    tagId: tagId === null || tagId === undefined ? null :
                        Number(tagId),
                    deletedAt: Number(deletedAt || ClipHub.Base.now()),
                    at: ClipHub.Base.now()
                });
            }
        } catch (ignored) {}
    }

    function clearTagItems(tagId) {
        var deletedAt = ClipHub.Base.now();
        var changed;
        try {
            changed = Number(ClipHub.Repository.softDeleteItemsByTag(
                Number(tagId), deletedAt));
            pendingClearTagId = null;
            uiState.pendingClearTagId = null;
            if (changed < 1) { return false; }
            uiState.tagItemsClearCount += 1;
            uiState.lastClearedTagId = Number(tagId);
            uiState.lastClearedItemCount = changed;
            emitClipboardBatchDeleted("tag", changed, tagId, deletedAt);
            emitTagsChanged("tag_items_cleared", tagId);
            rebuildTagPage();
            return true;
        } catch (error) {
            uiState.lastError = String(error);
            return false;
        }
    }

    function requestClearTagItems(tagId, itemCount, clearView) {
        tagId = Number(tagId);
        pendingDeleteTagId = null;
        uiState.pendingDeleteTagId = null;
        pendingClearAll = false;
        uiState.pendingClearAll = false;
        if (Number(itemCount || 0) < 1) { return false; }
        if (pendingClearTagId !== tagId) {
            pendingClearTagId = tagId;
            uiState.pendingClearTagId = tagId;
            uiState.tagItemsClearConfirmCount += 1;
            clearView.setText("确认清理");
            clearView.setContentDescription("再次点击，软删除该标签关联的 " +
                String(Number(itemCount || 0)) + " 条记录，标签会保留");
            return false;
        }
        return clearTagItems(tagId);
    }

    function rebuildDataPage() {
        buildPage();
        postScrollToSection("data");
        return true;
    }

    function clearAllItems() {
        var deletedAt = ClipHub.Base.now();
        var changed;
        try {
            changed = Number(ClipHub.Repository.softDeleteAllItems(deletedAt));
            pendingClearAll = false;
            uiState.pendingClearAll = false;
            if (changed < 1) { return false; }
            uiState.clearAllCount += 1;
            uiState.lastClearAllCount = changed;
            uiState.lastClearedItemCount = changed;
            emitClipboardBatchDeleted("all", changed, null, deletedAt);
            rebuildDataPage();
            return true;
        } catch (error) {
            uiState.lastError = String(error);
            return false;
        }
    }

    function requestClearAllItems(clearView, itemCount) {
        pendingDeleteTagId = null;
        uiState.pendingDeleteTagId = null;
        pendingClearTagId = null;
        uiState.pendingClearTagId = null;
        if (Number(itemCount || 0) < 1) { return false; }
        if (!pendingClearAll) {
            pendingClearAll = true;
            uiState.pendingClearAll = true;
            uiState.clearAllConfirmCount += 1;
            clearView.setText("再次点击确认清空");
            clearView.setContentDescription("再次点击，软删除全部 " +
                String(Number(itemCount || 0)) + " 条剪贴板记录");
            return false;
        }
        return clearAllItems();
    }

    function createTagFromSettings() {
        var name;
        var color;
        var id;
        try {
            name = newTagNameInput === null ? "" :
                String(newTagNameInput.getText());
            color = parseColorValue(newTagColorInput === null ? "" :
                String(newTagColorInput.getText()),
                Number(Color.parseColor("#7C5CFC")));
            id = Number(ClipHub.Repository.insertTag({
                name: name, colorValue: color,
                manualOrder: ClipHub.Repository.listTags().length * 1000
            }));
            uiState.tagCreateCount += 1;
            emitTagsChanged("tag_created", id);
            rebuildTagPage();
            return true;
        } catch (error) {
            uiState.lastError = String(error);
            return false;
        }
    }

    function saveTagRow(tagId, nameInput, colorInput) {
        var changed;
        try {
            changed = ClipHub.Repository.updateTag(Number(tagId), {
                name: String(nameInput.getText()),
                colorValue: parseColorValue(String(colorInput.getText()), null)
            });
            if (Number(changed) > 0) {
                uiState.tagUpdateCount += 1;
                emitTagsChanged("tag_updated", tagId);
                rebuildTagPage();
                return true;
            }
            return false;
        } catch (error) {
            uiState.lastError = String(error);
            return false;
        }
    }

    function deleteTagRow(tagId) {
        try {
            if (ClipHub.Repository.deleteTag(Number(tagId)) > 0) {
                uiState.tagDeleteCount += 1;
                emitTagsChanged("tag_deleted", tagId);
                rebuildTagPage();
                return true;
            }
            return false;
        } catch (error) {
            uiState.lastError = String(error);
            return false;
        }
    }

    function moveTag(tagId, delta) {
        var tags = ClipHub.Repository.listTags();
        var ids = [];
        var index;
        var current = -1;
        var target;
        for (index = 0; index < tags.length; index += 1) {
            ids.push(Number(tags[index].id));
            if (Number(tags[index].id) === Number(tagId)) { current = index; }
        }
        target = current + Number(delta);
        if (current < 0 || target < 0 || target >= ids.length) { return false; }
        ids.splice(current, 1);
        ids.splice(target, 0, Number(tagId));
        try {
            ClipHub.Repository.reorderTags(ids);
            uiState.tagReorderCount += 1;
            emitTagsChanged("tag_reordered", tagId);
            rebuildTagPage();
            return true;
        } catch (error) {
            uiState.lastError = String(error);
            return false;
        }
    }

    function clearSearchHistory() {
        try {
            setValue("filterSearchHistory", [], { cleanup: false });
            uiState.clearHistoryCount += 1;
            return true;
        } catch (error) {
            uiState.lastError = String(error);
            return false;
        }
    }

    function makeSectionTitle(section, title, subtitle, colors) {
        var titleView = makeText(title, 14, colors.textPrimary, true);
        var subtitleView = makeText(subtitle, 9, colors.textSecondary, false);
        var params;
        section.addView(titleView, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(2);
        params.bottomMargin = dp(8);
        section.addView(subtitleView, params);
    }

    function makeGeneralSection(colors) {
        var section = makeSection(colors);
        var row = new LinearLayout(appContext);
        var clearView;
        var params;
        makeSectionTitle(section, "常规",
            "敏感内容、搜索历史与复制行为", colors);
        row.setOrientation(LinearLayout.HORIZONTAL);
        sensitivePolicyView = makeButton("", colors, false, false);
        sensitivePolicyView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, { onClick: function () {
                setValue("sensitivePolicy",
                    values.sensitivePolicy === "save" ? "skip" : "save",
                    { cleanup: false });
                updateGeneralButtons(colors);
            }}));
        historyEnabledView = makeButton("", colors, false, false);
        historyEnabledView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, { onClick: function () {
                setValue("searchHistoryEnabled", !values.searchHistoryEnabled,
                    { cleanup: false });
                updateGeneralButtons(colors);
            }}));
        params = new LinearLayout.LayoutParams(0, dp(40), 1);
        params.rightMargin = dp(6);
        row.addView(sensitivePolicyView, params);
        row.addView(historyEnabledView,
            new LinearLayout.LayoutParams(0, dp(40), 1));
        section.addView(row, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(40)));
        clearView = makeButton("清空搜索历史", colors, false, false);
        clearView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, { onClick: clearSearchHistory }));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(40));
        params.topMargin = dp(7);
        section.addView(clearView, params);
        updateGeneralButtons(colors);
        return section;
    }

    function makeTranslationSection(colors) {
        var section = makeSection(colors);
        var engineRow = new LinearLayout(appContext);
        var actionRow = new LinearLayout(appContext);
        var saveButton;
        var testButton;
        var params;
        makeSectionTitle(section, "翻译",
            "中文自动译为英文，非中文自动译为中文", colors);
        draftEngine = String(values["translation.engine"] || "baidu");
        engineRow.setOrientation(LinearLayout.HORIZONTAL);
        engineBaiduView = makeButton("百度翻译", colors, false, false);
        engineYoudaoView = makeButton("有道翻译", colors, false, false);
        engineBaiduView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, { onClick: function () {
                draftEngine = "baidu";
                updateEngineViews(colors);
            }}));
        engineYoudaoView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, { onClick: function () {
                draftEngine = "youdao";
                updateEngineViews(colors);
            }}));
        params = new LinearLayout.LayoutParams(0, dp(40), 1);
        params.rightMargin = dp(6);
        engineRow.addView(engineBaiduView, params);
        engineRow.addView(engineYoudaoView,
            new LinearLayout.LayoutParams(0, dp(40), 1));
        section.addView(engineRow, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(40)));

        baiduGroup = new LinearLayout(appContext);
        baiduGroup.setOrientation(LinearLayout.VERTICAL);
        baiduIdInput = makeInput("百度 APP ID",
            values["translation.baidu.app_id"], colors, false,
            "translation.baidu.app_id");
        baiduSecretInput = makeInput("百度密钥",
            values["translation.baidu.app_secret"], colors, true,
            "translation.baidu.app_secret");
        addField(baiduGroup, "百度 APP ID", baiduIdInput, colors);
        addField(baiduGroup, "百度密钥", baiduSecretInput, colors);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(8);
        section.addView(baiduGroup, params);

        youdaoGroup = new LinearLayout(appContext);
        youdaoGroup.setOrientation(LinearLayout.VERTICAL);
        youdaoKeyInput = makeInput("有道 App Key",
            values["translation.youdao.app_key"], colors, false,
            "translation.youdao.app_key");
        youdaoSecretInput = makeInput("有道应用密钥",
            values["translation.youdao.app_secret"], colors, true,
            "translation.youdao.app_secret");
        addField(youdaoGroup, "有道 App Key", youdaoKeyInput, colors);
        addField(youdaoGroup, "有道应用密钥", youdaoSecretInput, colors);
        section.addView(youdaoGroup, params);

        translationStatusView = makeText("配置存储于 ClipHub SQLite",
            9, colors.textSecondary, false);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(6);
        section.addView(translationStatusView, params);
        actionRow.setOrientation(LinearLayout.HORIZONTAL);
        saveButton = makeButton("保存配置", colors, true, false);
        testButton = makeButton("测试翻译", colors, false, false);
        saveButton.setOnClickListener(new JavaAdapter(
            View.OnClickListener, { onClick: saveTranslationSettings }));
        testButton.setOnClickListener(new JavaAdapter(
            View.OnClickListener, { onClick: testTranslationSettings }));
        params = new LinearLayout.LayoutParams(0, dp(40), 1);
        params.rightMargin = dp(6);
        actionRow.addView(saveButton, params);
        actionRow.addView(testButton,
            new LinearLayout.LayoutParams(0, dp(40), 1));
        section.addView(actionRow, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(40)));
        updateEngineViews(colors);
        return section;
    }

    function makeTagRow(tag, index, total, colors) {
        var root = new LinearLayout(appContext);
        var first = new LinearLayout(appContext);
        var actions = new LinearLayout(appContext);
        var handle = makeText("≡", 18, colors.textTertiary, true);
        var swatch = makeColorSwatch(tag.color_value, colors);
        var nameInput = makeInput("标签名称", String(tag.name), colors, false);
        var colorInput = makeInput("#RRGGBB", colorText(tag.color_value),
            colors, false);
        var count = makeText(String(Number(tag.item_count || 0)) + " 条记录",
            9, colors.textSecondary, false);
        var save = makeButton("保存", colors, false, false);
        var clearItems = makeButton("清理记录", colors, false, true);
        var del = makeButton("删标签", colors, false, true);
        var params;
        if (Number(tag.item_count || 0) < 1) {
            clearItems.setEnabled(false);
            clearItems.setClickable(false);
            clearItems.setAlpha(0.42);
        }
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(8), dp(8), dp(8), dp(8));
        root.setBackground(roundedBackground(colors.surfaceMuted,
            colors.stroke, 12));
        first.setOrientation(LinearLayout.HORIZONTAL);
        first.setGravity(Gravity.CENTER_VERTICAL);
        handle.setGravity(Gravity.CENTER);
        handle.setContentDescription("拖动排序标签 " + String(tag.name));
        params = new LinearLayout.LayoutParams(dp(32), dp(40));
        params.rightMargin = dp(5);
        first.addView(handle, params);
        params = new LinearLayout.LayoutParams(dp(22), dp(22));
        params.rightMargin = dp(7);
        first.addView(swatch, params);
        params = new LinearLayout.LayoutParams(0, dp(40), 1);
        params.rightMargin = dp(5);
        first.addView(nameInput, params);
        first.addView(colorInput,
            new LinearLayout.LayoutParams(dp(88), dp(40)));
        root.addView(first, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(40)));
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setGravity(Gravity.CENTER_VERTICAL);
        actions.addView(count, new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        (function (tagId, itemCount) {
            save.setOnClickListener(new JavaAdapter(View.OnClickListener, {
                onClick: function () {
                    pendingDeleteTagId = null;
                    uiState.pendingDeleteTagId = null;
                    pendingClearTagId = null;
                    uiState.pendingClearTagId = null;
                    saveTagRow(tagId, nameInput, colorInput);
                }
            }));
            clearItems.setOnClickListener(new JavaAdapter(
                View.OnClickListener, { onClick: function () {
                    requestClearTagItems(tagId, itemCount, clearItems);
                }}));
            del.setOnClickListener(new JavaAdapter(View.OnClickListener, {
                onClick: function () {
                    pendingClearTagId = null;
                    uiState.pendingClearTagId = null;
                    requestDeleteTag(tagId, itemCount, del);
                }
            }));
            bindTagDrag(handle, root, tagId);
        }(Number(tag.id), Number(tag.item_count || 0)));
        actions.addView(save, new LinearLayout.LayoutParams(dp(52), dp(34)));
        params = new LinearLayout.LayoutParams(dp(72), dp(34));
        params.leftMargin = dp(5);
        actions.addView(clearItems, params);
        params = new LinearLayout.LayoutParams(dp(64), dp(34));
        params.leftMargin = dp(5);
        actions.addView(del, params);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(34));
        params.topMargin = dp(6);
        root.addView(actions, params);
        bindColorPreview(colorInput, swatch,
            Number(tag.color_value || Color.parseColor("#7C5CFC")), colors);
        tagRowViews[String(tag.id)] = {
            root: root, name: nameInput, color: colorInput,
            handle: handle, swatch: swatch, save: save,
            clearItemsView: clearItems, deleteView: del
        };
        return root;
    }

    function makeTagsSection(colors) {
        var section = makeSection(colors);
        var createRow = new LinearLayout(appContext);
        var createButton;
        var preview;
        var tags = ClipHub.Repository.listTags();
        var index;
        var params;
        var empty;
        makeSectionTitle(section, "标签管理",
            "清理记录会保留标签 · 删除标签只解除关联", colors);
        createRow.setOrientation(LinearLayout.HORIZONTAL);
        createRow.setGravity(Gravity.CENTER_VERTICAL);
        preview = makeColorSwatch(Number(Color.parseColor("#7C5CFC")), colors);
        params = new LinearLayout.LayoutParams(dp(24), dp(24));
        params.rightMargin = dp(6);
        createRow.addView(preview, params);
        newTagNameInput = makeInput("新标签名称", "", colors, false,
            "tag.new.name");
        newTagColorInput = makeInput("#7C5CFC", "#7C5CFC", colors, false,
            "tag.new.color");
        createButton = makeButton("新增", colors, true, false);
        createButton.setOnClickListener(new JavaAdapter(
            View.OnClickListener, { onClick: createTagFromSettings }));
        params = new LinearLayout.LayoutParams(0, dp(40), 1);
        params.rightMargin = dp(5);
        createRow.addView(newTagNameInput, params);
        params = new LinearLayout.LayoutParams(dp(88), dp(40));
        params.rightMargin = dp(5);
        createRow.addView(newTagColorInput, params);
        createRow.addView(createButton,
            new LinearLayout.LayoutParams(dp(54), dp(40)));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(40));
        params.bottomMargin = dp(8);
        section.addView(createRow, params);
        bindColorPreview(newTagColorInput, preview,
            Number(Color.parseColor("#7C5CFC")), colors);
        tagRowViews = {};
        for (index = 0; index < tags.length; index += 1) {
            params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
            params.bottomMargin = dp(6);
            section.addView(makeTagRow(tags[index], index, tags.length, colors),
                params);
        }
        uiState.tagRowCount = tags.length;
        if (tags.length === 0) {
            empty = makeText("暂无标签", 11, colors.textSecondary, false);
            empty.setGravity(Gravity.CENTER);
            empty.setPadding(dp(8), dp(18), dp(8), dp(18));
            section.addView(empty, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));
        }
        return section;
    }

    function currentForegroundUserId() {
        var userId = 0;
        try { userId = Number(ActivityManager.getCurrentUser()); }
        catch (ignoredCurrentUser) { userId = 0; }
        if (!isFinite(userId) || userId < 0) { userId = 0; }
        return Math.floor(userId);
    }

    function resolveBlogActivity(intent, userId) {
        var packageManager;
        var resolved = null;
        if (appContext === null) { return null; }
        try { packageManager = appContext.getPackageManager(); }
        catch (ignoredPackageManager) { packageManager = null; }
        if (packageManager === null) { return null; }
        try {
            resolved = packageManager.resolveActivityAsUser(intent,
                PackageManager.MATCH_DEFAULT_ONLY, Number(userId));
        } catch (ignoredAsUserResolve) {
            try {
                resolved = packageManager.resolveActivity(intent,
                    PackageManager.MATCH_DEFAULT_ONLY);
            } catch (ignoredResolve) { resolved = null; }
        }
        return resolved;
    }

    function openAuthorBlog() {
        var url = "https://xin-blog.com";
        var intent;
        var resolved;
        var activityInfo;
        var userId = currentForegroundUserId();
        var launchMethod = "none";
        var asUserError = null;
        uiState.blogOpenCount += 1;
        uiState.lastOpenedUrl = url;
        uiState.lastBlogLaunchUserId = userId;
        uiState.lastBlogLaunchMethod = launchMethod;
        try {
            if (appContext === null) {
                throw new Error("Android context unavailable");
            }
            intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK |
                Intent.FLAG_ACTIVITY_CLEAR_TOP);
            resolved = resolveBlogActivity(intent, userId);
            if (resolved === null || resolved.activityInfo === null) {
                throw new Error("No browser activity can handle the URL");
            }
            activityInfo = resolved.activityInfo;
            if (activityInfo.packageName !== null &&
                    activityInfo.name !== null) {
                intent.setClassName(String(activityInfo.packageName),
                    String(activityInfo.name));
            }
            try {
                appContext.startActivityAsUser(intent, UserHandle.of(userId));
                launchMethod = "startActivityAsUser";
            } catch (errorAsUser) {
                asUserError = errorAsUser;
                appContext.startActivity(intent);
                launchMethod = "startActivity";
            }
            uiState.lastBlogLaunchMethod = launchMethod;
            uiState.blogOpenSuccessCount += 1;
            uiState.lastError = null;
            try { closePage("author_blog"); }
            catch (ignoredCloseAfterLaunch) {}
            return true;
        } catch (error) {
            uiState.blogOpenFailureCount += 1;
            uiState.lastBlogLaunchMethod = launchMethod;
            uiState.lastError = "无法打开博客链接：" + String(error) +
                (asUserError === null ? "" :
                    "；startActivityAsUser=" + String(asUserError));
            return false;
        }
    }

    function makeDataSection(colors) {
        var section = makeSection(colors);
        var path = initContext && initContext.runtimeDir ?
            String(initContext.runtimeDir) + "/data/cliphub.db" : "";
        var activeCount = Number(ClipHub.Repository.countItems(false));
        var infoTitle;
        var infoText;
        var dangerTitle;
        var dangerText;
        var divider;
        var authorTitle;
        var authorName;
        var blogRow;
        var blogLabel;
        var blogValue;
        var params;
        makeSectionTitle(section, "数据与关于",
            "当前数据库、批量清理与项目相关信息", colors);

        infoTitle = makeText("运行信息", 10, colors.textPrimary, true);
        section.addView(infoTitle, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));

        infoText = makeText(
            "剪贴板记录：" + String(activeCount) +
            "\n标签数量：" + String(ClipHub.Repository.listTags().length) +
            "\n数据库：" + path +
            "\nSchema：v" + String(ClipHub.Database.getVersion()) +
            "\n模块集：" + String(initContext.moduleSetVersion || "运行中"),
            10, colors.textSecondary, false);
        infoText.setTextIsSelectable(true);
        infoText.setLineSpacing(0, 1.15);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(5);
        params.bottomMargin = dp(10);
        section.addView(infoText, params);

        dangerTitle = makeText("危险操作", 10, colors.textPrimary, true);
        section.addView(dangerTitle, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        dangerText = makeText(
            "软删除全部剪贴板记录；标签、设置与搜索历史会保留",
            9, colors.textSecondary, false);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(4);
        params.bottomMargin = dp(7);
        section.addView(dangerText, params);
        clearAllItemsView = makeButton(
            "清空全部记录（" + String(activeCount) + " 条）",
            colors, false, true);
        if (activeCount < 1) {
            clearAllItemsView.setEnabled(false);
            clearAllItemsView.setClickable(false);
            clearAllItemsView.setAlpha(0.42);
        } else {
            (function (count, view) {
                view.setOnClickListener(new JavaAdapter(
                    View.OnClickListener, { onClick: function () {
                        requestClearAllItems(view, count);
                    }}));
            }(activeCount, clearAllItemsView));
        }
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(42));
        params.bottomMargin = dp(10);
        section.addView(clearAllItemsView, params);

        divider = new View(appContext);
        ClipHub.Theme.applyBackgroundColor(divider, colors.stroke);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(1));
        params.topMargin = dp(2);
        params.bottomMargin = dp(10);
        section.addView(divider, params);

        authorTitle = makeText("关于作者", 10, colors.textPrimary, true);
        section.addView(authorTitle, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));

        authorName = makeText("林深见鹿", 12, colors.textPrimary, true);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(5);
        params.bottomMargin = dp(8);
        section.addView(authorName, params);

        blogRow = new LinearLayout(appContext);
        blogRow.setOrientation(LinearLayout.HORIZONTAL);
        blogRow.setGravity(Gravity.CENTER_VERTICAL);
        blogRow.setPadding(dp(11), dp(7), dp(11), dp(7));
        blogRow.setBackground(roundedBackground(colors.surfaceMuted,
            colors.stroke, 11));
        blogRow.setClickable(true);
        blogRow.setFocusable(true);
        blogRow.setContentDescription("打开个人博客 xin-blog.com");
        blogRow.setOnTouchListener(new JavaAdapter(View.OnTouchListener, {
            onTouch: function (view, event) {
                var action = Number(event.getActionMasked());
                if (action === MotionEvent.ACTION_DOWN) {
                    view.setAlpha(0.72);
                } else if (action === MotionEvent.ACTION_UP ||
                        action === MotionEvent.ACTION_CANCEL) {
                    view.setAlpha(1);
                }
                return false;
            }
        }));
        blogRow.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: openAuthorBlog
        }));

        blogLabel = makeText("个人博客", 10, colors.textSecondary, false);
        blogValue = makeText("xin-blog.com  ↗", 10,
            colors.accentStrong, true);
        blogValue.setSingleLine(true);
        blogValue.setGravity(Gravity.RIGHT | Gravity.CENTER_VERTICAL);
        blogRow.addView(blogLabel, new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        blogRow.addView(blogValue, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        section.addView(blogRow, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(44)));
        blogLinkView = blogRow;
        return section;
    }

    function buildPage() {
        var colors = palette();
        var content = new LinearLayout(appContext);
        var header = new LinearLayout(appContext);
        var title = makeText("ClipHub 设置", 18, colors.textPrimary, true);
        var params;
        if (scrollRoot === null) { return false; }
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(12), dp(9), dp(12), dp(28));
        (function () {
            var handleRow = new LinearLayout(appContext);
            var handle = new View(appContext);
            handleRow.setGravity(Gravity.CENTER);
            handle.setBackground(roundedBackground(colors.accentBorder,
                null, 3));
            handleRow.addView(handle,
                new LinearLayout.LayoutParams(dp(42), dp(4)));
            content.addView(handleRow, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(16)));
        }());
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.addView(title, new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        closeView = makeText("×", 22, colors.icon, true);
        closeView.setGravity(Gravity.CENTER);
        closeView.setBackground(roundedBackground(colors.surfaceMuted,
            null, 18));
        closeView.setClickable(true);
        closeView.setFocusable(true);
        closeView.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { closePage("button"); }
        }));
        header.addView(closeView, new LinearLayout.LayoutParams(dp(38), dp(38)));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(42));
        params.bottomMargin = dp(8);
        content.addView(header, params);

        addSection(content, makeGeneralSection(colors));
        translationSectionView = makeTranslationSection(colors);
        addSection(content, translationSectionView);
        tagsSectionView = makeTagsSection(colors);
        addSection(content, tagsSectionView);
        dataSectionView = makeDataSection(colors);
        addSection(content, dataSectionView);
        sectionAnchorSpacer = new View(appContext);
        content.addView(sectionAnchorSpacer, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0));
        imeAnchorSpacer = new View(appContext);
        content.addView(imeAnchorSpacer, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0));
        contentRoot = content;
        scrollRoot.removeAllViews();
        scrollRoot.addView(content, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT));
        scrollRoot.scrollTo(0, 0);
        uiState.scrollResetCount += 1;
        uiState.currentScrollYDp = 0;
        uiState.lastScrollSection = null;
        uiState.lastSectionViewportTopDp = null;
        uiState.sectionAnchorSpacerHeightDp = 0;
        uiState.lastRequestedScrollYDp = 0;
        uiState.lastMaxScrollYDp = 0;
        uiState.imeAnchorSpacerHeightDp = 0;
        focusedInput = null;
        focusedInputName = null;
        focusedVisibilityScheduled = false;
        uiState.focusedInputName = null;
        uiState.focusedInputVisible = false;
        uiState.renderCount += 1;
        return true;
    }

    function panelSize() {
        var geometry;
        if (ClipHub.Window &&
                typeof ClipHub.Window.computeGeometry === "function") {
            geometry = ClipHub.Window.computeGeometry("settings", {
                useSaved: true
            });
            return geometry;
        }
        return { width: dp(390), height: dp(720),
            widthDp: 390, heightDp: 720 };
    }

    function openPage() {
        var size;
        var type;
        requireReady();
        if (uiState.attached) { return getState(); }
        return runOnMainSync(function () {
            settingsLifecycleGeneration += 1;
            size = panelSize();
            type = Build.VERSION.SDK_INT >= 26 ?
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY :
                WindowManager.LayoutParams.TYPE_SYSTEM_ALERT;
            panelRoot = new FrameLayout(appContext);
            panelRoot.setBackground(roundedBackground(palette().surface,
                palette().stroke, 24));
            if (Build.VERSION.SDK_INT >= 21) {
                panelRoot.setElevation(0);
                panelRoot.setClipToOutline(true);
            }
            panelManagedFrame = ClipHub.Window.createManagedFrame(panelRoot, {
                accentColor: palette().accentStrong
            });
            panelWindowRoot = panelManagedFrame.rootView;
            uiState.panelClipToOutline = Build.VERSION.SDK_INT >= 21 &&
                panelRoot.getClipToOutline();
            scrollRoot = new ScrollView(appContext);
            scrollRoot.setVerticalScrollBarEnabled(false);
            panelRoot.addView(scrollRoot, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));
            panelParams = new WindowManager.LayoutParams(
                size.width, size.height, type,
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
                    WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED |
                    WindowManager.LayoutParams.FLAG_DIM_BEHIND,
                PixelFormat.TRANSLUCENT);
            panelParams.gravity = Gravity.TOP | Gravity.START;
            panelParams.x = Number(size.x || 0);
            panelParams.y = Number(size.y || 0);
            panelParams.dimAmount = 0.44;
            panelParams.softInputMode =
                WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE |
                WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN;
            uiState.softInputMode = Number(panelParams.softInputMode);
            uiState.softInputAdjustResize =
                (Number(panelParams.softInputMode) &
                    Number(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)) !== 0;
            try { panelParams.setTitle("ClipHub Detail Settings Panel"); }
            catch (ignoredTitle) {}
            windowManager.addView(panelWindowRoot, panelParams);
            ClipHub.Window.attachWindow({
                role: "settings",
                rootView: panelWindowRoot,
                contentView: panelRoot,
                layoutParams: panelParams,
                windowManager: windowManager,
                dragView: panelManagedFrame.dragView,
                resizeView: panelManagedFrame.resizeView,
                resizeVisual: panelManagedFrame.resizeVisual,
                geometry: size,
                onGeometryChanged: function (geometry) {
                    uiState.panelWidthDp = Number(geometry.widthDp || 0);
                    uiState.panelHeightDp = Number(geometry.heightDp || 0);
                    if (!uiState.keyboardVisible) {
                        uiState.normalPanelHeightDp = uiState.panelHeightDp;
                        uiState.currentPanelHeightDp = uiState.panelHeightDp;
                    }
                },
                onRequestClose: function () {
                    return closePage("managed_close");
                }
            });
            uiState.attached = true;
            uiState.openCount += 1;
            uiState.panelWidthDp = size.widthDp;
            uiState.panelHeightDp = size.heightDp;
            uiState.normalPanelHeightDp = size.heightDp;
            uiState.currentPanelHeightDp = size.heightDp;
            uiState.currentPanelTopDp = pxToDp(Number(size.y || 0));
            uiState.panelGravity = "shared";
            uiState.panelBottomMarginDp = 0;
            uiState.lastError = null;
            buildPage();
            startSettingsImeMonitoring();
            try {
                if (ClipHub.Navigation && ClipHub.Navigation.scanNow) {
                    ClipHub.Navigation.scanNow();
                }
            } catch (ignoredScan) {}
            return getState();
        }, 3000);
    }

    function closePage(reason) {
        if (!uiState.attached && panelRoot === null) { return true; }
        return runOnMainSync(function () {
            settingsLifecycleGeneration += 1;
            stopSettingsImeMonitoring();
            hideSettingsKeyboardOnMain();
            try {
                if (panelWindowRoot !== null && ClipHub.Window &&
                        typeof ClipHub.Window.detachWindow === "function") {
                    try { ClipHub.Window.detachWindow(panelWindowRoot); }
                    catch (ignoredDetach) {}
                }
                if (panelRoot !== null) {
                    try {
                        windowManager.removeViewImmediate(
                            panelWindowRoot !== null ? panelWindowRoot : panelRoot);
                    } catch (error) {
                        if (panelWindowRoot !== null ?
                                panelWindowRoot.isAttachedToWindow() :
                                panelRoot.isAttachedToWindow()) { throw error; }
                    }
                }
                uiState.closeCount += 1;
                uiState.lastError = null;
                return true;
            } finally {
                uiState.attached = false;
                panelRoot = null;
                panelWindowRoot = null;
                panelManagedFrame = null;
                panelParams = null;
                scrollRoot = null;
                contentRoot = null;
                sectionAnchorSpacer = null;
                imeAnchorSpacer = null;
                focusedInput = null;
                focusedInputName = null;
                focusedVisibilityScheduled = false;
                translationStatusView = null;
                engineBaiduView = null;
                engineYoudaoView = null;
                baiduGroup = null;
                youdaoGroup = null;
                baiduIdInput = null;
                baiduSecretInput = null;
                youdaoKeyInput = null;
                youdaoSecretInput = null;
                newTagNameInput = null;
                newTagColorInput = null;
                closeView = null;
                sensitivePolicyView = null;
                historyEnabledView = null;
                tagRowViews = {};
                translationSectionView = null;
                tagsSectionView = null;
                dataSectionView = null;
                blogLinkView = null;
                clearAllItemsView = null;
                pendingDeleteTagId = null;
                pendingClearTagId = null;
                pendingClearAll = false;
                uiState.pendingDeleteTagId = null;
                uiState.pendingClearTagId = null;
                uiState.pendingClearAll = false;
            }
        }, 3000);
    }

    function sectionView(name) {
        name = String(name || "");
        if (name === "translation") { return translationSectionView; }
        if (name === "tags") { return tagsSectionView; }
        if (name === "data") { return dataSectionView; }
        return null;
    }

    function ensureSectionAnchorSpace(name, expectedRoot) {
        var target = sectionView(name);
        var params;
        var currentSpacer;
        var baseContentHeight;
        var targetY;
        var viewportHeight;
        var requiredSpacer;
        if (!uiState.attached || expectedRoot === null ||
                expectedRoot !== scrollRoot || target === null ||
                contentRoot === null || sectionAnchorSpacer === null) {
            uiState.sectionScrollCancelCount += 1;
            return false;
        }
        params = sectionAnchorSpacer.getLayoutParams();
        currentSpacer = Math.max(0, Number(params.height || 0));
        baseContentHeight = Math.max(0,
            Number(contentRoot.getHeight()) - currentSpacer);
        targetY = Math.max(0, Number(target.getTop()) - dp(8));
        viewportHeight = Math.max(0, Number(expectedRoot.getHeight()));
        requiredSpacer = Math.max(0,
            Math.ceil(targetY + viewportHeight - baseContentHeight));
        uiState.lastRequestedScrollYDp = Math.round(targetY / density);
        if (Number(params.height) !== requiredSpacer) {
            params.height = requiredSpacer;
            sectionAnchorSpacer.setLayoutParams(params);
            sectionAnchorSpacer.requestLayout();
            contentRoot.requestLayout();
            uiState.sectionAnchorAdjustmentCount += 1;
        }
        uiState.sectionAnchorSpacerHeightDp = Math.round(
            requiredSpacer / density);
        return true;
    }

    function applySectionScroll(name, expectedRoot) {
        var target = sectionView(name);
        var y;
        var maxScroll;
        if (!uiState.attached || scrollRoot === null ||
                expectedRoot !== scrollRoot || target === null) {
            uiState.sectionScrollCancelCount += 1;
            return false;
        }
        y = Math.max(0, Number(target.getTop()) - dp(8));
        maxScroll = Math.max(0,
            Number(contentRoot === null ? 0 : contentRoot.getHeight()) -
                Number(expectedRoot.getHeight()));
        expectedRoot.scrollTo(0, y);
        uiState.sectionScrollAppliedCount += 1;
        uiState.currentScrollYDp = Math.round(
            Number(expectedRoot.getScrollY()) / density);
        uiState.lastMaxScrollYDp = Math.round(maxScroll / density);
        uiState.lastScrollSection = String(name);
        uiState.lastSectionViewportTopDp = Math.round(
            (Number(target.getTop()) - Number(expectedRoot.getScrollY())) /
                density);
        return true;
    }

    function postScrollToSection(name) {
        var expectedRoot = scrollRoot;
        if (expectedRoot === null || !uiState.attached) { return false; }
        uiState.sectionScrollRequestCount += 1;
        return postSettingsViewCallback(expectedRoot, function () {
            if (!ensureSectionAnchorSpace(name, expectedRoot)) { return; }
            postSettingsViewCallback(expectedRoot, function () {
                applySectionScroll(name, expectedRoot);
            }, true);
        }, true);
    }

    function scrollToSection(name) {
        name = String(name || "");
        return runOnMainSync(function () {
            return applySectionScroll(name, scrollRoot);
        }, 3000);
    }

    function getState() {
        var attachedToWindow = false;
        try {
            attachedToWindow = panelRoot !== null &&
                panelRoot.isAttachedToWindow();
        } catch (ignored) {}
        return {
            ready: ready,
            attached: uiState.attached,
            attachedToWindow: attachedToWindow,
            open: uiState.attached,
            openCount: Number(uiState.openCount),
            closeCount: Number(uiState.closeCount),
            renderCount: Number(uiState.renderCount),
            saveTranslationCount: Number(uiState.saveTranslationCount),
            testTranslationCount: Number(uiState.testTranslationCount),
            testTranslationSuccessCount:
                Number(uiState.testTranslationSuccessCount),
            tagCreateCount: Number(uiState.tagCreateCount),
            tagUpdateCount: Number(uiState.tagUpdateCount),
            tagDeleteCount: Number(uiState.tagDeleteCount),
            tagReorderCount: Number(uiState.tagReorderCount),
            tagDragStartCount: Number(uiState.tagDragStartCount),
            tagDragCommitCount: Number(uiState.tagDragCommitCount),
            tagColorPreviewCount: Number(uiState.tagColorPreviewCount),
            tagDeleteConfirmCount: Number(uiState.tagDeleteConfirmCount),
            tagItemsClearConfirmCount:
                Number(uiState.tagItemsClearConfirmCount),
            tagItemsClearCount: Number(uiState.tagItemsClearCount),
            clearAllConfirmCount: Number(uiState.clearAllConfirmCount),
            clearAllCount: Number(uiState.clearAllCount),
            lastDraggedTagId: uiState.lastDraggedTagId,
            lastClearedTagId: uiState.lastClearedTagId,
            lastClearedItemCount: Number(uiState.lastClearedItemCount),
            lastClearAllCount: Number(uiState.lastClearAllCount),
            pendingDeleteTagId: uiState.pendingDeleteTagId,
            pendingClearTagId: uiState.pendingClearTagId,
            pendingClearAll: uiState.pendingClearAll === true,
            dragReorderEnabled: true,
            deleteRequiresConfirmation: true,
            bulkClearRequiresConfirmation: true,
            clearHistoryCount: Number(uiState.clearHistoryCount),
            settingsStyle: uiState.settingsStyle,
            sectionCount: Number(uiState.sectionCount),
            translationFieldCount: Number(uiState.translationFieldCount),
            tagRowCount: Number(uiState.tagRowCount),
            selectedEngine: String(draftEngine),
            configuredEngine: String(values["translation.engine"] || "baidu"),
            baiduAppIdStored:
                String(values["translation.baidu.app_id"] || "").length > 0,
            baiduSecretStored:
                String(values["translation.baidu.app_secret"] || "").length > 0,
            youdaoAppKeyStored:
                String(values["translation.youdao.app_key"] || "").length > 0,
            youdaoSecretStored:
                String(values["translation.youdao.app_secret"] || "").length > 0,
            contentTypeSettingsPresent: false,
            panelWidthDp: Number(uiState.panelWidthDp),
            panelHeightDp: Number(uiState.panelHeightDp),
            panelClipToOutline: uiState.panelClipToOutline === true,
            scrollResetCount: Number(uiState.scrollResetCount),
            sectionScrollRequestCount:
                Number(uiState.sectionScrollRequestCount),
            sectionScrollAppliedCount:
                Number(uiState.sectionScrollAppliedCount),
            sectionScrollCancelCount:
                Number(uiState.sectionScrollCancelCount),
            currentScrollYDp: Number(uiState.currentScrollYDp),
            lastScrollSection: uiState.lastScrollSection,
            lastSectionViewportTopDp:
                uiState.lastSectionViewportTopDp === null ? null :
                    Number(uiState.lastSectionViewportTopDp),
            sectionAnchorAdjustmentCount:
                Number(uiState.sectionAnchorAdjustmentCount),
            sectionAnchorSpacerHeightDp:
                Number(uiState.sectionAnchorSpacerHeightDp),
            lastRequestedScrollYDp:
                Number(uiState.lastRequestedScrollYDp),
            lastMaxScrollYDp: Number(uiState.lastMaxScrollYDp),
            softInputMode: Number(uiState.softInputMode),
            softInputAdjustResize: uiState.softInputAdjustResize === true,
            normalPanelHeightDp: Number(uiState.normalPanelHeightDp),
            currentPanelHeightDp: Number(uiState.currentPanelHeightDp),
            currentPanelTopDp: Number(uiState.currentPanelTopDp),
            panelGravity: uiState.panelGravity,
            panelBottomMarginDp: Number(uiState.panelBottomMarginDp),
            keyboardVisible: uiState.keyboardVisible === true,
            keyboardInsetDp: Number(uiState.keyboardInsetDp),
            keyboardShowCount: Number(uiState.keyboardShowCount),
            keyboardHideCount: Number(uiState.keyboardHideCount),
            keyboardRequestCount: Number(uiState.keyboardRequestCount),
            imeInsetsSupported: uiState.imeInsetsSupported === true,
            imeInsetSource: uiState.imeInsetSource,
            imeInsetBottomDp: Number(uiState.imeInsetBottomDp),
            systemTopInsetDp: Number(uiState.systemTopInsetDp),
            availableAboveImeDp: Number(uiState.availableAboveImeDp),
            keyboardAvoidanceApplied:
                uiState.keyboardAvoidanceApplied === true,
            keyboardAvoidanceApplyCount:
                Number(uiState.keyboardAvoidanceApplyCount),
            keyboardAvoidanceRestoreCount:
                Number(uiState.keyboardAvoidanceRestoreCount),
            windowLayoutUpdateCount:
                Number(uiState.windowLayoutUpdateCount),
            imePollCount: Number(uiState.imePollCount),
            imePollFastCount: Number(uiState.imePollFastCount),
            imePollIdleCount: Number(uiState.imePollIdleCount),
            imePollIntervalMs: Number(uiState.imePollIntervalMs),
            layoutMeasureCount: Number(uiState.layoutMeasureCount),
            rootMeasuredHeightDp: Number(uiState.rootMeasuredHeightDp),
            scrollViewportHeightDp:
                Number(uiState.scrollViewportHeightDp),
            keyboardTopDp: Number(uiState.keyboardTopDp),
            panelScreenBottomDp: Number(uiState.panelScreenBottomDp),
            panelAboveKeyboard: uiState.panelAboveKeyboard === true,
            focusedInputName: uiState.focusedInputName,
            focusedInputVisible: uiState.focusedInputVisible === true,
            focusedInputTopDp: Number(uiState.focusedInputTopDp),
            focusedInputBottomDp: Number(uiState.focusedInputBottomDp),
            inputFocusCount: Number(uiState.inputFocusCount),
            inputAutoScrollCount: Number(uiState.inputAutoScrollCount),
            imeAnchorAdjustmentCount:
                Number(uiState.imeAnchorAdjustmentCount),
            imeAnchorSpacerHeightDp:
                Number(uiState.imeAnchorSpacerHeightDp),
            delayedCallbackPostCount:
                Number(uiState.delayedCallbackPostCount),
            delayedCallbackRunCount:
                Number(uiState.delayedCallbackRunCount),
            delayedCallbackCancelCount:
                Number(uiState.delayedCallbackCancelCount),
            delayedCallbackErrorCount:
                Number(uiState.delayedCallbackErrorCount),
            pendingDelayedCallbackCount:
                Number(uiState.pendingDelayedCallbackCount),
            lastDelayedCallbackError: uiState.lastDelayedCallbackError,
            blogLinkPresent: blogLinkView !== null,
            blogOpenCount: Number(uiState.blogOpenCount),
            blogOpenSuccessCount:
                Number(uiState.blogOpenSuccessCount),
            blogOpenFailureCount:
                Number(uiState.blogOpenFailureCount),
            lastOpenedUrl: uiState.lastOpenedUrl,
            lastBlogLaunchMethod: uiState.lastBlogLaunchMethod,
            lastBlogLaunchUserId:
                Number(uiState.lastBlogLaunchUserId),
            lastTestResult: uiState.lastTestResult,
            lastError: uiState.lastError
        };
    }

    ClipHub.Settings = {
        MODULE_NAME: "ch_13_settings",
        MODULE_VERSION: 17,
        DEFAULTS: defaultsCopy(),
        init: function (context) {
            if (!ClipHub.Database || !ClipHub.Database.isOpen()) {
                throw new Error("Database is unavailable for settings");
            }
            initContext = context || {};
            appContext = initContext.androidContext || global.context;
            if (!appContext) { throw new Error("Android context unavailable"); }
            appContext = appContext.getApplicationContext() || appContext;
            windowManager = appContext.getSystemService(Context.WINDOW_SERVICE);
            mainHandler = new Handler(Looper.getMainLooper());
            inputMethodManager = appContext.getSystemService(
                Context.INPUT_METHOD_SERVICE);
            density = Number(appContext.getResources()
                .getDisplayMetrics().density || 1);
            load();
            ready = true;
            applyClipboard();
            cleanup();
            return { ok: true, ready: true, values: getAll(),
                cleanup: getLastCleanup() };
        },
        isReady: function () { return ready; },
        get: function (key, fallback) {
            key = String(key);
            return Object.prototype.hasOwnProperty.call(values, key) ?
                copyValue(values[key]) : fallback;
        },
        getAll: getAll,
        getLastCleanup: getLastCleanup,
        set: setValue,
        setMany: setMany,
        reload: function () {
            requireReady();
            load();
            applyClipboard();
            return getAll();
        },
        applyClipboard: applyClipboard,
        cleanup: cleanup,
        open: openPage,
        close: closePage,
        getState: getState,
        isAttached: function () { return uiState.attached === true; },
        performSaveTranslationClick: saveTranslationSettings,
        performTestTranslationClick: testTranslationSettings,
        scrollToSection: scrollToSection,
        performOpenBlogClick: function () {
            return runOnMainSync(function () {
                return blogLinkView !== null &&
                    blogLinkView.performClick();
            }, 3000);
        },
        performFocusInput: function (name) {
            return runOnMainSync(function () {
                return focusSettingsInput(name);
            }, 3000);
        },
        hideKeyboard: function () {
            return runOnMainSync(hideSettingsKeyboardOnMain, 3000);
        },
        performCreateTag: function (name, colorTextValue) {
            return runOnMainSync(function () {
                if (newTagNameInput === null || newTagColorInput === null) {
                    return false;
                }
                newTagNameInput.setText(String(name || ""));
                newTagColorInput.setText(String(colorTextValue || "#7C5CFC"));
                return createTagFromSettings();
            }, 3000);
        },
        performUpdateTag: function (tagId, name, colorTextValue) {
            tagId = String(Number(tagId));
            return runOnMainSync(function () {
                var row = tagRowViews[tagId];
                if (!row) { return false; }
                row.name.setText(String(name || ""));
                row.color.setText(String(colorTextValue || "#7C5CFC"));
                return row.save.performClick();
            }, 3000);
        },
        performMoveTag: function (tagId, delta) {
            return runOnMainSync(function () {
                return moveTag(Number(tagId), Number(delta));
            }, 3000);
        },
        performDeleteTagConfirm: function (tagId) {
            tagId = String(Number(tagId));
            return runOnMainSync(function () {
                var row = tagRowViews[tagId];
                if (!row) { return false; }
                row.deleteView.performClick();
                return row.deleteView.performClick();
            }, 3000);
        },
        performClearTagItemsConfirm: function (tagId) {
            tagId = String(Number(tagId));
            return runOnMainSync(function () {
                var row = tagRowViews[tagId];
                if (!row || !row.clearItemsView ||
                        !row.clearItemsView.isEnabled()) { return false; }
                row.clearItemsView.performClick();
                return row.clearItemsView.performClick();
            }, 3000);
        },
        performClearAllItemsConfirm: function () {
            return runOnMainSync(function () {
                if (clearAllItemsView === null ||
                        !clearAllItemsView.isEnabled()) { return false; }
                clearAllItemsView.performClick();
                return clearAllItemsView.performClick();
            }, 3000);
        },
        getTagOrder: function () {
            var tags = ClipHub.Repository.listTags();
            var ids = [];
            var index;
            for (index = 0; index < tags.length; index += 1) {
                ids.push(Number(tags[index].id));
            }
            return ids;
        },
        reset: function (options) {
            var defaults = defaultsCopy();
            requireReady();
            ClipHub.Database.transaction(function () {
                var key;
                ClipHub.Database.executeUpdateDelete("DELETE FROM settings", []);
                for (key in defaults) {
                    if (defaults.hasOwnProperty(key)) {
                        persist(key, defaults[key]);
                    }
                }
            });
            values = defaults;
            applyClipboard();
            if (!options || options.cleanup !== false) { cleanup(); }
            return getAll();
        },
        shutdown: function () {
            settingsLifecycleGeneration += 1;
            stopSettingsImeMonitoring();
            try { closePage("shutdown"); } catch (ignoredClose) {}
            values = {};
            lastCleanup = null;
            ready = false;
            initContext = null;
            appContext = null;
            windowManager = null;
            inputMethodManager = null;
            mainHandler = null;
            return true;
        }
    };
}((function () { return this; }())));
