(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var Build = Packages.android.os.Build;
    var Looper = Packages.android.os.Looper;
    var Handler = Packages.android.os.Handler;
    var System = Packages.java.lang.System;
    var View = Packages.android.view.View;
    var Gravity = Packages.android.view.Gravity;
    var KeyEvent = Packages.android.view.KeyEvent;
    var WindowManager = Packages.android.view.WindowManager;
    var Context = Packages.android.content.Context;
    var CountDownLatch = Packages.java.util.concurrent.CountDownLatch;
    var TimeUnit = Packages.java.util.concurrent.TimeUnit;
    var AtomicReference = Packages.java.util.concurrent.atomic.AtomicReference;
    var URL = Packages.java.net.URL;
    var URLEncoder = Packages.java.net.URLEncoder;
    var MessageDigest = Packages.java.security.MessageDigest;
    var JavaString = Packages.java.lang.String;
    var UUID = Packages.java.util.UUID;
    var JavaThread = Packages.java.lang.Thread;
    var OSW = Packages.java.io.OutputStreamWriter;
    var BR = Packages.java.io.BufferedReader;
    var ISR = Packages.java.io.InputStreamReader;
    var SB = Packages.java.lang.StringBuilder;
    var Color = Packages.android.graphics.Color;
    var GradientDrawable = Packages.android.graphics.drawable.GradientDrawable;
    var PixelFormat = Packages.android.graphics.PixelFormat;
    var LinearLayout = Packages.android.widget.LinearLayout;
    var FrameLayout = Packages.android.widget.FrameLayout;
    var ScrollView = Packages.android.widget.ScrollView;
    var TextView = Packages.android.widget.TextView;
    var TypedValue = Packages.android.util.TypedValue;

    var translationConfig = { enabled: false, provider: "none" };
    var appContext = null;
    var windowManager = null;
    var activityManager = null;
    var mainHandler = null;
    var density = 1;
    var initialized = false;
    var entries = [];
    var wrappers = [];
    var scanGeneration = 0;
    var backgroundGeneration = 0;
    var hideInProgress = false;
    var originalAppHideUi = null;
    var lastBackAt = 0;
    var lastBackSignature = "";
    var navState = {
        initCount: 0,
        shutdownCount: 0,
        scanCount: 0,
        registerCount: 0,
        unregisterCount: 0,
        entryPurgeCount: 0,
        residualWindowRemoveCount: 0,
        mainFocusableUpgradeCount: 0,
        keyBackCount: 0,
        backStartedCount: 0,
        backProgressCount: 0,
        backCancelledCount: 0,
        backInvokedCount: 0,
        backHandledCount: 0,
        duplicateBackCount: 0,
        filterBackCount: 0,
        uiHideCount: 0,
        backgroundCheckCount: 0,
        backgroundHideCount: 0,
        focusGainCount: 0,
        focusLossCount: 0,
        callbackMode: "none",
        baselinePackage: "",
        lastTopPackage: "",
        lastActivityType: 0,
        lastBackOwner: "",
        lastBackReason: "",
        lastBackSignature: "",
        lastHideReason: "",
        lastBackgroundReason: "",
        lastError: null
    };

    function now() {
        return Number(System.currentTimeMillis());
    }

    function dp(value) {
        return Math.max(1, Math.floor(Number(value) * density + 0.5));
    }

    function log(level, message) {
        try {
            if (!ClipHub.Log) { return false; }
            if (level === "E" && ClipHub.Log.error) {
                return ClipHub.Log.error(message);
            }
            if (level === "W" && ClipHub.Log.warn) {
                return ClipHub.Log.warn(message);
            }
            if (level === "D" && ClipHub.Log.debug) {
                return ClipHub.Log.debug(message);
            }
            if (ClipHub.Log.info) { return ClipHub.Log.info(message); }
        } catch (ignored) {}
        return false;
    }

    function runOnMain(callback, delayMs) {
        var runnable;
        if (!mainHandler || typeof callback !== "function") { return false; }
        runnable = new Packages.java.lang.Runnable({
            run: function () {
                try { callback(); } catch (error) {
                    navState.lastError = String(error);
                    log("W", "navigation callback failed: " + String(error));
                }
            }
        });
        if (Looper.myLooper() === Looper.getMainLooper() &&
                Number(delayMs || 0) <= 0) {
            runnable.run();
            return true;
        }
        return Number(delayMs || 0) > 0 ?
            mainHandler.postDelayed(runnable, Number(delayMs)) :
            mainHandler.post(runnable);
    }

    function runOnMainSync(callback, timeoutMs) {
        var valueRef;
        var errorRef;
        var latch;
        var posted;
        var timeout = Math.max(500, Number(timeoutMs || 3000));
        if (typeof callback !== "function") {
            throw new Error("Navigation main callback must be a function");
        }
        if (Looper.myLooper() === Looper.getMainLooper()) {
            return callback();
        }
        try {
            if (ClipHub.Window &&
                    typeof ClipHub.Window.runOnMain === "function") {
                return ClipHub.Window.runOnMain(callback, timeout);
            }
        } catch (windowError) {
            navState.lastError = String(windowError);
        }
        if (!mainHandler) { return callback(); }
        valueRef = new AtomicReference();
        errorRef = new AtomicReference();
        latch = new CountDownLatch(1);
        posted = mainHandler.post(new Packages.java.lang.Runnable({
            run: function () {
                try { valueRef.set(callback()); }
                catch (error) { errorRef.set(error); }
                finally { latch.countDown(); }
            }
        }));
        if (!posted || !latch.await(timeout, TimeUnit.MILLISECONDS)) {
            throw new Error("Navigation main callback timed out");
        }
        if (errorRef.get() !== null) { throw errorRef.get(); }
        return valueRef.get();
    }

    function entryKey(view) {
        try { return String(System.identityHashCode(view)); }
        catch (ignored) { return String(view); }
    }

    function windowTitle(view) {
        var params;
        var title;
        try {
            params = view.getLayoutParams();
            if (params && typeof params.getTitle === "function") {
                title = params.getTitle();
                return title === null || title === undefined ? "" :
                    String(title);
            }
        } catch (ignored) {}
        return "";
    }

    function ownerFor(view, fallback) {
        var title = windowTitle(view).toLowerCase();
        if (title.indexOf("filter") >= 0) { return "filter"; }
        if (title.indexOf("editor") >= 0) {
            try {
                if (ClipHub.Editor && ClipHub.Editor.getState &&
                        String(ClipHub.Editor.getState().mode) === "tags") {
                    return "tags";
                }
            } catch (ignoredTags) {}
            return "editor";
        }
        if (title.indexOf("detail") >= 0) { return "detail"; }
        if (title.indexOf("cliphub") >= 0) { return "home"; }
        return String(fallback || "unknown");
    }

    function clipHubWindow(view) {
        return windowTitle(view).toLowerCase().indexOf("cliphub") >= 0;
    }

    function windowViews() {
        var output = [];
        var source;
        var index;
        try {
            source = Packages.android.view.WindowManagerGlobal
                .getInstance().getWindowViews();
            if (source && source.size && source.get) {
                for (index = 0; index < Number(source.size()); index += 1) {
                    output.push(source.get(index));
                }
            } else if (source && source.length !== undefined) {
                for (index = 0; index < Number(source.length); index += 1) {
                    output.push(source[index]);
                }
            }
        } catch (error) {
            navState.lastError = String(error);
            log("W", "ClipHub window scan failed: " + String(error));
        }
        return output;
    }

    function findEntry(view) {
        var key = entryKey(view);
        var index;
        for (index = 0; index < entries.length; index += 1) {
            if (entries[index] && entries[index].key === key) {
                return entries[index];
            }
        }
        return null;
    }

    function resetVisual(view) {
        if (!view) { return; }
        try { view.animate().cancel(); } catch (ignoredAnimation) {}
        try { view.setAlpha(1); } catch (ignoredAlpha) {}
        try { view.setTranslationX(0); } catch (ignoredTranslation) {}
        try { view.setScaleX(1); } catch (ignoredScaleX) {}
        try { view.setScaleY(1); } catch (ignoredScaleY) {}
    }

    function applyProgress(view, event) {
        var progress = 0;
        var edge = 0;
        var direction;
        var width;
        try {
            progress = Number(event.getProgress());
            try { edge = Number(event.getSwipeEdge()); }
            catch (ignoredEdge) { edge = 0; }
            if (!isFinite(progress)) { progress = 0; }
            progress = Math.max(0, Math.min(1, progress));
            direction = edge === 1 ? -1 : 1;
            width = Number(view.getWidth());
            if (!isFinite(width) || width < dp(120)) { width = dp(320); }
            view.setAlpha(1 - 0.16 * progress);
            view.setTranslationX(direction *
                Math.min(dp(72), Math.floor(width * 0.18)) * progress);
            view.setScaleX(1 - 0.025 * progress);
            view.setScaleY(1 - 0.025 * progress);
            navState.backProgressCount += 1;
        } catch (error) {
            navState.lastError = String(error);
        }
    }

    function moduleAttached(module, method) {
        var value;
        try {
            if (module && typeof module[method] === "function") {
                value = module[method]();
                return value && (value.attachedToWindow === true ||
                    value.attached === true || value.panelAttached === true ||
                    value.open === true);
            }
        } catch (ignored) {}
        return false;
    }

    function uiVisible() {
        var listState;
        if (moduleAttached(ClipHub.Filter, "getPanelState") ||
                moduleAttached(ClipHub.Editor, "getState") ||
                moduleAttached(ClipHub.List, "getDetailState") ||
                moduleAttached(ClipHub.Window, "getState")) {
            return true;
        }
        try {
            listState = ClipHub.List && ClipHub.List.getState ?
                ClipHub.List.getState() : null;
            return !!(listState && listState.visible === true);
        } catch (ignored) {}
        return false;
    }

    function closeFilter() {
        try {
            if (ClipHub.Filter && ClipHub.Filter.closePanel) {
                ClipHub.Filter.closePanel();
                return true;
            }
        } catch (error) { navState.lastError = String(error); }
        return false;
    }

    function backFilter() {
        try {
            if (ClipHub.Filter &&
                    typeof ClipHub.Filter.handleBack === "function") {
                navState.filterBackCount += 1;
                return ClipHub.Filter.handleBack() === true;
            }
        } catch (errorHandle) {
            navState.lastError = String(errorHandle);
            return closeFilter();
        }
        return closeFilter();
    }

    function closeEditor() {
        try {
            if (ClipHub.Editor && ClipHub.Editor.close) {
                ClipHub.Editor.close();
                return true;
            }
        } catch (error) { navState.lastError = String(error); }
        return false;
    }

    function closeDetail() {
        try {
            if (translationState.attached === true &&
                    ClipHub.Translation && ClipHub.Translation.close) {
                ClipHub.Translation.close("navigation_back");
                return true;
            }
            if (ClipHub.List && ClipHub.List.closeDetail) {
                ClipHub.List.closeDetail();
                return true;
            }
        } catch (error) { navState.lastError = String(error); }
        return false;
    }

    function removeEntry(view, restoreVisual) {
        var key = entryKey(view);
        var kept = [];
        var index;
        var item;
        var observer;
        for (index = 0; index < entries.length; index += 1) {
            item = entries[index];
            if (!item || item.key !== key) {
                if (item && !item.removed) { kept.push(item); }
                continue;
            }
            if (item.removed) { continue; }
            item.removed = true;
            try {
                if (item.dispatcher && item.callback) {
                    item.dispatcher.unregisterOnBackInvokedCallback(
                        item.callback);
                }
            } catch (ignoredDispatcher) {}
            try {
                observer = item.view.getViewTreeObserver();
                if (observer && observer.isAlive() && item.focusListener) {
                    observer.removeOnWindowFocusChangeListener(
                        item.focusListener);
                }
            } catch (ignoredFocus) {}
            try {
                if (item.attachListener) {
                    item.view.removeOnAttachStateChangeListener(
                        item.attachListener);
                }
            } catch (ignoredAttach) {}
            if (restoreVisual !== false) { resetVisual(item.view); }
            navState.unregisterCount += 1;
        }
        entries = kept;
    }

    function unregisterAllEntries(restoreVisual) {
        var views = [];
        var index;
        for (index = 0; index < entries.length; index += 1) {
            if (entries[index] && entries[index].view) {
                views.push(entries[index].view);
            }
        }
        for (index = 0; index < views.length; index += 1) {
            removeEntry(views[index], restoreVisual);
        }
        navState.entryPurgeCount += views.length;
        entries = [];
        navState.callbackMode = "none";
        return views.length;
    }

    function pruneEntries() {
        var stale = [];
        var index;
        var attached;
        for (index = 0; index < entries.length; index += 1) {
            attached = false;
            try {
                attached = entries[index] && entries[index].view &&
                    entries[index].view.isAttachedToWindow();
            } catch (ignored) {}
            if (!attached) { stale.push(entries[index].view); }
        }
        for (index = 0; index < stale.length; index += 1) {
            removeEntry(stale[index], false);
        }
        return stale.length;
    }

    function purgeResidualWindowsOnMain() {
        var views = windowViews();
        var index;
        var view;
        var attached;
        var removed = 0;
        for (index = 0; index < views.length; index += 1) {
            view = views[index];
            if (!view || !clipHubWindow(view)) { continue; }
            removeEntry(view, false);
            attached = false;
            try { attached = view.isAttachedToWindow(); }
            catch (ignoredAttached) {}
            if (!attached) { continue; }
            try {
                windowManager.removeViewImmediate(view);
                removed += 1;
            } catch (errorImmediate) {
                try {
                    windowManager.removeView(view);
                    removed += 1;
                } catch (errorRemove) {
                    navState.lastError = String(errorImmediate) +
                        "; fallback=" + String(errorRemove);
                }
            }
        }
        unregisterAllEntries(false);
        navState.residualWindowRemoveCount += removed;
        return removed;
    }

    function hideUi(reason) {
        var residualRemoved = 0;
        if (hideInProgress) {
            return { ok: true, hidden: true, reused: true,
                reason: String(reason || "duplicate"), residualRemoved: 0 };
        }
        hideInProgress = true;
        scanGeneration += 1;
        backgroundGeneration += 1;
        navState.lastHideReason = String(reason || "hide");
        try {
            closeFilter();
            closeEditor();
            try {
                if (ClipHub.List && ClipHub.List.hide) {
                    ClipHub.List.hide(true);
                } else {
                    closeDetail();
                    if (ClipHub.Window && ClipHub.Window.close) {
                        ClipHub.Window.close();
                    }
                }
            } catch (error) {
                navState.lastError = String(error);
                try { closeDetail(); } catch (ignoredDetail) {}
                try {
                    if (ClipHub.Window && ClipHub.Window.close) {
                        ClipHub.Window.close();
                    }
                } catch (ignoredWindow) {}
            }
            try {
                residualRemoved = Number(runOnMainSync(
                    purgeResidualWindowsOnMain, 3000) || 0);
            } catch (cleanupError) {
                navState.lastError = String(cleanupError);
                try { unregisterAllEntries(false); }
                catch (ignoredEntries) {}
            }
            navState.uiHideCount += 1;
            navState.baselinePackage = "";
            return { ok: true, hidden: true, reused: false,
                reason: navState.lastHideReason,
                residualRemoved: residualRemoved };
        } finally {
            hideInProgress = false;
        }
    }

    function closeTop(owner, reason) {
        owner = String(owner || "");
        if (owner === "filter" &&
                moduleAttached(ClipHub.Filter, "getPanelState")) {
            return backFilter();
        }
        if ((owner === "editor" || owner === "tags") &&
                moduleAttached(ClipHub.Editor, "getState")) {
            return closeEditor();
        }
        if (owner === "detail" &&
                moduleAttached(ClipHub.List, "getDetailState")) {
            return closeDetail();
        }
        if (moduleAttached(ClipHub.Filter, "getPanelState")) {
            return backFilter();
        }
        if (moduleAttached(ClipHub.Editor, "getState")) {
            return closeEditor();
        }
        if (moduleAttached(ClipHub.List, "getDetailState")) {
            return closeDetail();
        }
        if (moduleAttached(ClipHub.Window, "getState") || uiVisible()) {
            hideUi(reason || "back_home");
            return true;
        }
        return false;
    }

    function isSystemBackReason(reason) {
        reason = String(reason || "");
        return reason === "predictive_back" ||
            reason === "on_back_invoked" ||
            reason === "back_key" || reason === "escape_key";
    }

    function backSignature(owner, reason) {
        return isSystemBackReason(reason) ? "system" :
            "owner:" + String(owner || "auto");
    }

    function dispatchBack(owner, reason) {
        var timestamp = now();
        var signature = backSignature(owner, reason);
        var handled;
        if (timestamp - lastBackAt < 180 &&
                signature === lastBackSignature) {
            navState.duplicateBackCount += 1;
            return true;
        }
        lastBackAt = timestamp;
        lastBackSignature = signature;
        navState.backInvokedCount += 1;
        navState.lastBackOwner = String(owner || "");
        navState.lastBackReason = String(reason || "system_back");
        navState.lastBackSignature = signature;
        handled = closeTop(owner, navState.lastBackReason);
        if (handled) { navState.backHandledCount += 1; }
        log("I", "navigation back owner=" + navState.lastBackOwner +
            " reason=" + navState.lastBackReason +
            " signature=" + signature +
            " handled=" + String(handled));
        return handled;
    }

    function anyFocused() {
        var index;
        for (index = 0; index < entries.length; index += 1) {
            try {
                if (entries[index].view.isAttachedToWindow() &&
                        entries[index].view.hasWindowFocus()) {
                    return true;
                }
            } catch (ignored) {}
        }
        return false;
    }

    function taskSnapshot() {
        var result = { available: false, packageName: "", activityType: 0 };
        var service;
        var info;
        var component;
        var tasks;
        var task;
        try {
            service = Packages.android.app.ActivityTaskManager.getService();
            info = service.getFocusedRootTaskInfo();
            if (info) {
                component = info.topActivity || info.baseActivity;
                if (component) {
                    result.packageName = String(component.getPackageName());
                }
                try {
                    result.activityType = Number(info.configuration
                        .windowConfiguration.getActivityType());
                } catch (ignoredType) {}
                result.available = true;
                return result;
            }
        } catch (ignoredAtm) {}
        try {
            tasks = activityManager.getRunningTasks(1);
            if (tasks && Number(tasks.size()) > 0) {
                task = tasks.get(0);
                component = task.topActivity;
                if (component) {
                    result.packageName = String(component.getPackageName());
                }
                result.available = true;
            }
        } catch (ignoredTasks) {}
        return result;
    }

    function systemPackage(packageName) {
        packageName = String(packageName || "").toLowerCase();
        return packageName.indexOf("systemui") >= 0 ||
            packageName.indexOf("launcher") >= 0 ||
            packageName.indexOf("quickstep") >= 0 ||
            packageName.indexOf("recents") >= 0;
    }

    function captureTaskBaseline(force) {
        var snapshot = taskSnapshot();
        navState.lastTopPackage = snapshot.packageName;
        navState.lastActivityType = snapshot.activityType;
        if (snapshot.packageName &&
                (force === true || !navState.baselinePackage)) {
            navState.baselinePackage = snapshot.packageName;
        }
        return snapshot;
    }

    function checkBackground(reason, fallback) {
        var snapshot;
        var changed;
        pruneEntries();
        if (!initialized || hideInProgress || !uiVisible() || anyFocused()) {
            return false;
        }
        navState.backgroundCheckCount += 1;
        snapshot = taskSnapshot();
        navState.lastTopPackage = snapshot.packageName;
        navState.lastActivityType = snapshot.activityType;
        changed = snapshot.packageName && navState.baselinePackage &&
            snapshot.packageName !== navState.baselinePackage;
        if (snapshot.activityType === 2 || snapshot.activityType === 3 ||
                systemPackage(snapshot.packageName) || changed ||
                (fallback === true && !snapshot.available)) {
            navState.lastBackgroundReason = String(reason || "background");
            navState.backgroundHideCount += 1;
            hideUi("background_" + navState.lastBackgroundReason);
            log("I", "navigation background hide reason=" +
                navState.lastBackgroundReason + " package=" +
                snapshot.packageName + " activityType=" +
                String(snapshot.activityType));
            return true;
        }
        return false;
    }

    function scheduleBackground(reason) {
        var generation = backgroundGeneration + 1;
        backgroundGeneration = generation;
        runOnMain(function () {
            if (generation === backgroundGeneration) {
                checkBackground(reason, false);
            }
        }, 280);
        runOnMain(function () {
            if (generation === backgroundGeneration) {
                checkBackground(reason + "_fallback", true);
            }
        }, 900);
    }

    function onFocus(owner, hasFocus) {
        if (hasFocus) {
            backgroundGeneration += 1;
            navState.focusGainCount += 1;
            captureTaskBaseline(false);
            return;
        }
        navState.focusLossCount += 1;
        scheduleScan(null);
        scheduleBackground("focus_lost_" + String(owner || "unknown"));
    }

    function callbackFor(entry) {
        var callback = null;
        var animationClass;
        if (Build.VERSION.SDK_INT >= 34) {
            try {
                animationClass = Packages.java.lang.Class.forName(
                    "android.window.OnBackAnimationCallback");
                callback = new JavaAdapter(
                    Packages.android.window.OnBackAnimationCallback, {
                        onBackStarted: function (event) {
                            navState.backStartedCount += 1;
                            applyProgress(entry.view, event);
                        },
                        onBackProgressed: function (event) {
                            applyProgress(entry.view, event);
                        },
                        onBackCancelled: function () {
                            navState.backCancelledCount += 1;
                            resetVisual(entry.view);
                        },
                        onBackInvoked: function () {
                            resetVisual(entry.view);
                            dispatchBack(entry.owner, "predictive_back");
                        }
                    });
                if (!animationClass.isInstance(callback)) {
                    callback = null;
                } else {
                    entry.callbackMode = "OnBackAnimationCallback";
                }
            } catch (errorAnimation) {
                callback = null;
                navState.lastError = String(errorAnimation);
            }
        }
        if (!callback && Build.VERSION.SDK_INT >= 33) {
            try {
                callback = new JavaAdapter(
                    Packages.android.window.OnBackInvokedCallback, {
                        onBackInvoked: function () {
                            resetVisual(entry.view);
                            dispatchBack(entry.owner, "on_back_invoked");
                        }
                    });
                entry.callbackMode = "OnBackInvokedCallback";
            } catch (errorInvoked) {
                callback = null;
                navState.lastError = String(errorInvoked);
            }
        }
        return callback;
    }

    function makeFocusable(entry) {
        var params;
        var flags;
        try {
            entry.view.setFocusable(true);
            entry.view.setFocusableInTouchMode(true);
        } catch (ignoredFocus) {}
        if (entry.owner !== "home") { return true; }
        try {
            params = entry.view.getLayoutParams();
            flags = Number(params.flags);
            if ((flags & Number(
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE)) !== 0) {
                params.flags = (flags & ~Number(
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE)) |
                    Number(WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL);
                windowManager.updateViewLayout(entry.view, params);
                navState.mainFocusableUpgradeCount += 1;
            }
            return true;
        } catch (error) {
            navState.lastError = String(error);
            log("W", "main window focus upgrade failed: " + String(error));
            return false;
        }
    }

    function registerView(view, owner, retryCount) {
        var entry;
        var observer;
        var dispatcher;
        var priority = 0;
        if (!view || findEntry(view)) { return false; }
        entry = {
            key: entryKey(view),
            view: view,
            owner: String(owner || ownerFor(view, "unknown")),
            title: windowTitle(view),
            dispatcher: null,
            callback: null,
            callbackMode: "key",
            focusListener: null,
            attachListener: null,
            retryCount: Number(retryCount || 0),
            removed: false
        };
        makeFocusable(entry);
        entry.focusListener = new JavaAdapter(
            Packages.android.view.ViewTreeObserver.OnWindowFocusChangeListener, {
                onWindowFocusChanged: function (focused) {
                    onFocus(entry.owner, focused === true);
                }
            });
        try {
            observer = view.getViewTreeObserver();
            if (observer && observer.isAlive()) {
                observer.addOnWindowFocusChangeListener(entry.focusListener);
            }
        } catch (errorFocus) {
            navState.lastError = String(errorFocus);
        }
        entry.attachListener = new JavaAdapter(
            View.OnAttachStateChangeListener, {
                onViewAttachedToWindow: function () {},
                onViewDetachedFromWindow: function (detachedView) {
                    removeEntry(detachedView, false);
                    scheduleScan(null);
                }
            });
        try { view.addOnAttachStateChangeListener(entry.attachListener); }
        catch (ignoredAttach) {}
        try {
            view.setOnKeyListener(new JavaAdapter(View.OnKeyListener, {
                onKey: function (keyView, keyCode, event) {
                    if (!event || Number(event.getAction()) !==
                            Number(KeyEvent.ACTION_UP)) {
                        return false;
                    }
                    if (Number(keyCode) === Number(KeyEvent.KEYCODE_BACK) ||
                            Number(keyCode) ===
                            Number(KeyEvent.KEYCODE_ESCAPE)) {
                        navState.keyBackCount += 1;
                        return dispatchBack(entry.owner,
                            Number(keyCode) ===
                                Number(KeyEvent.KEYCODE_BACK) ?
                                "back_key" : "escape_key");
                    }
                    return false;
                }
            }));
        } catch (errorKey) { navState.lastError = String(errorKey); }
        if (Build.VERSION.SDK_INT >= 33) {
            try { dispatcher = view.findOnBackInvokedDispatcher(); }
            catch (ignoredDispatcher) { dispatcher = null; }
            if (dispatcher) {
                entry.callback = callbackFor(entry);
                if (entry.callback) {
                    try {
                        priority = Packages.android.window
                            .OnBackInvokedDispatcher.PRIORITY_DEFAULT;
                    } catch (ignoredPriority) { priority = 0; }
                    dispatcher.registerOnBackInvokedCallback(
                        Number(priority), entry.callback);
                    entry.dispatcher = dispatcher;
                    navState.callbackMode = entry.callbackMode;
                }
            }
        }
        entries.push(entry);
        navState.registerCount += 1;
        try { view.requestFocus(); } catch (ignoredRequestFocus) {}
        captureTaskBaseline(false);
        if (!entry.dispatcher && Build.VERSION.SDK_INT >= 33 &&
                entry.retryCount < 3) {
            runOnMain(function () {
                if (!entry.removed && entry.view &&
                        entry.view.isAttachedToWindow()) {
                    removeEntry(entry.view, true);
                    registerView(entry.view, entry.owner,
                        entry.retryCount + 1);
                }
            }, 160 + entry.retryCount * 140);
        }
        log("I", "navigation root registered owner=" + entry.owner +
            " title=" + entry.title + " callback=" +
            entry.callbackMode);
        return true;
    }

    function scan(owner) {
        var views;
        var index;
        var view;
        if (!initialized) { return 0; }
        navState.scanCount += 1;
        pruneEntries();
        views = windowViews();
        for (index = 0; index < views.length; index += 1) {
            view = views[index];
            if (!view || findEntry(view) || !clipHubWindow(view)) {
                continue;
            }
            try {
                if (!view.isAttachedToWindow()) { continue; }
            } catch (ignoredAttached) {}
            registerView(view, ownerFor(view, owner), 0);
        }
        return entries.length;
    }

    function scheduleScan(owner) {
        var generation = scanGeneration + 1;
        scanGeneration = generation;
        runOnMain(function () { scan(owner); }, 0);
        runOnMain(function () {
            if (generation === scanGeneration) { scan(owner); }
        }, 70);
        runOnMain(function () {
            if (generation === scanGeneration) { scan(owner); }
        }, 220);
        return true;
    }

    function wrap(module, name, owner) {
        var original;
        var wrapped;
        if (!module || typeof module[name] !== "function") { return false; }
        original = module[name];
        wrapped = function () {
            var result = original.apply(module, arguments);
            scheduleScan(owner);
            return result;
        };
        module[name] = wrapped;
        wrappers.push({
            module: module,
            name: name,
            original: original,
            wrapped: wrapped
        });
        return true;
    }

    function installWrappers() {
        wrap(ClipHub.Window, "open", "home");
        wrap(ClipHub.Window, "setContentView", "home");
        wrap(ClipHub.List, "show", "home");
        wrap(ClipHub.List, "openDetail", "detail");
        wrap(ClipHub.Editor, "openNew", "editor");
        wrap(ClipHub.Editor, "openItem", "editor");
        wrap(ClipHub.Editor, "openTags", "tags");
        wrap(ClipHub.Filter, "showPanel", "filter");
        if (ClipHub.App) {
            originalAppHideUi = ClipHub.App.hideUi;
            ClipHub.App.hideUi = hideUi;
        }
    }

    function restoreWrappers() {
        var index;
        var item;
        for (index = wrappers.length - 1; index >= 0; index -= 1) {
            item = wrappers[index];
            try {
                if (item.module[item.name] === item.wrapped) {
                    item.module[item.name] = item.original;
                }
            } catch (ignored) {}
        }
        wrappers = [];
        if (ClipHub.App && ClipHub.App.hideUi === hideUi) {
            if (typeof originalAppHideUi === "function") {
                ClipHub.App.hideUi = originalAppHideUi;
            } else {
                try { delete ClipHub.App.hideUi; }
                catch (ignoredDelete) { ClipHub.App.hideUi = undefined; }
            }
        }
        originalAppHideUi = null;
    }

    function navigationState() {
        var owners = [];
        var titles = [];
        var index;
        pruneEntries();
        for (index = 0; index < entries.length; index += 1) {
            owners.push(String(entries[index].owner || ""));
            titles.push(String(entries[index].title || ""));
        }
        return {
            initialized: initialized,
            sdkInt: Number(Build.VERSION.SDK_INT),
            initCount: Number(navState.initCount),
            shutdownCount: Number(navState.shutdownCount),
            scanCount: Number(navState.scanCount),
            registerCount: Number(navState.registerCount),
            unregisterCount: Number(navState.unregisterCount),
            entryPurgeCount: Number(navState.entryPurgeCount),
            residualWindowRemoveCount:
                Number(navState.residualWindowRemoveCount),
            registeredRootCount: Number(entries.length),
            registeredOwners: owners,
            registeredTitles: titles,
            callbackMode: navState.callbackMode,
            mainFocusableUpgradeCount:
                Number(navState.mainFocusableUpgradeCount),
            keyBackCount: Number(navState.keyBackCount),
            backStartedCount: Number(navState.backStartedCount),
            backProgressCount: Number(navState.backProgressCount),
            backCancelledCount: Number(navState.backCancelledCount),
            backInvokedCount: Number(navState.backInvokedCount),
            backHandledCount: Number(navState.backHandledCount),
            duplicateBackCount: Number(navState.duplicateBackCount),
            filterBackCount: Number(navState.filterBackCount),
            uiHideCount: Number(navState.uiHideCount),
            backgroundCheckCount:
                Number(navState.backgroundCheckCount),
            backgroundHideCount:
                Number(navState.backgroundHideCount),
            focusGainCount: Number(navState.focusGainCount),
            focusLossCount: Number(navState.focusLossCount),
            baselinePackage: navState.baselinePackage,
            lastTopPackage: navState.lastTopPackage,
            lastActivityType: Number(navState.lastActivityType),
            lastBackOwner: navState.lastBackOwner,
            lastBackReason: navState.lastBackReason,
            lastBackSignature: navState.lastBackSignature,
            lastHideReason: navState.lastHideReason,
            lastBackgroundReason: navState.lastBackgroundReason,
            lastError: navState.lastError
        };
    }

    function navigationInit(context) {
        if (initialized) { return navigationState(); }
        appContext = context && context.androidContext ?
            context.androidContext : global.context;
        if (!appContext) {
            throw new Error("Android context unavailable for navigation");
        }
        appContext = appContext.getApplicationContext() || appContext;
        windowManager = appContext.getSystemService(Context.WINDOW_SERVICE);
        activityManager = appContext.getSystemService(Context.ACTIVITY_SERVICE);
        mainHandler = new Handler(Looper.getMainLooper());
        density = Number(appContext.getResources()
            .getDisplayMetrics().density || 1);
        initialized = true;
        lastBackAt = 0;
        lastBackSignature = "";
        navState.lastBackSignature = "";
        navState.initCount += 1;
        installWrappers();
        captureTaskBaseline(true);
        scheduleScan(null);
        log("I", "navigation initialized sdk=" +
            String(Build.VERSION.SDK_INT));
        return navigationState();
    }

    function navigationShutdown() {
        if (!initialized) { return true; }
        initialized = false;
        scanGeneration += 1;
        backgroundGeneration += 1;
        restoreWrappers();
        try { runOnMainSync(function () {
            unregisterAllEntries(false);
            return true;
        }, 3000); } catch (ignoredEntries) {}
        navState.shutdownCount += 1;
        navState.baselinePackage = "";
        appContext = null;
        windowManager = null;
        activityManager = null;
        mainHandler = null;
        hideInProgress = false;
        lastBackAt = 0;
        lastBackSignature = "";
        return true;
    }

    ClipHub.Navigation = {
        MODULE_NAME: "ch_14_navigation_embedded",
        MODULE_VERSION: 3,
        init: navigationInit,
        dispatchBack: function (reason) {
            return dispatchBack("", reason || "api_back");
        },
        dispatchBackForOwner: function (owner, reason) {
            return dispatchBack(owner, reason || "api_back");
        },
        hideUi: hideUi,
        checkBackground: function (reason, fallback) {
            return checkBackground(reason || "api", fallback === true);
        },
        scanNow: function () { return scan(null); },
        getState: navigationState,
        shutdown: navigationShutdown
    };

    var translationRoot = null;
    var translationWindowRoot = null;
    var translationManagedFrame = null;
    var translationParams = null;
    var translationOriginalView = null;
    var translationResultView = null;
    var translationStatusView = null;
    var translationProviderView = null;
    var translationCopyView = null;
    var translationReplaceView = null;
    var translationSaveView = null;
    var translationRetryView = null;
    var translationCloseView = null;
    var translationGeneration = 0;
    var translationState = {
        attached: false,
        itemId: null,
        provider: "none",
        sourceText: "",
        translatedText: "",
        targetLanguage: "",
        running: false,
        requestCount: 0,
        successCount: 0,
        errorCount: 0,
        copyCount: 0,
        replaceCount: 0,
        saveNewCount: 0,
        retryCount: 0,
        closeCount: 0,
        panelWidthDp: 0,
        panelHeightDp: 0,
        resultStyle: "reference_translation_result_v1",
        lastError: null
    };

    function translationRounded(fill, stroke, radiusDp) {
        var drawable = new GradientDrawable();
        drawable.setShape(GradientDrawable.RECTANGLE);
        ClipHub.Theme.applyGradientColor(drawable, fill);
        drawable.setCornerRadius(dp(radiusDp));
        if (stroke) { ClipHub.Theme.applyGradientStroke(drawable, dp(1), stroke); }
        return drawable;
    }

    function translationPalette() {
        try {
            if (ClipHub.Theme && typeof ClipHub.Theme.getPalette === "function") {
                return ClipHub.Theme.getPalette(appContext);
            }
        } catch (ignored) {}
        return {
            surface: "#FFFFFFFF", surfaceMuted: "#FFF5F3FB",
            stroke: "#FFE5E0EF", accentStrong: "#FF5A37E6",
            accentSoft: "#FFF0ECFF", accentBorder: "#FFBBAAF8",
            textPrimary: "#FF1F1C28", textSecondary: "#FF6F697A",
            textTertiary: "#FF9992A3", icon: "#FF3D3748"
        };
    }

    function translationText(text, size, color, bold) {
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

    function translationButton(text, colors, primary, danger) {
        var view = translationText(text, 10,
            danger ? "#FFB42323" : (primary ? "#FFFFFFFF" : colors.accentStrong),
            primary || danger);
        view.setGravity(Gravity.CENTER);
        view.setSingleLine(true);
        view.setPadding(dp(8), dp(6), dp(8), dp(6));
        view.setBackground(translationRounded(
            primary ? colors.accentStrong :
                (danger ? "#FFFFEEEE" : colors.accentSoft),
            primary ? colors.accentStrong : colors.accentBorder, 11));
        view.setClickable(true);
        view.setFocusable(true);
        return view;
    }

    function translationHex(bytes) {
        var output = [];
        var index;
        var number;
        var text;
        for (index = 0; index < bytes.length; index += 1) {
            number = Number(bytes[index]);
            if (number < 0) { number += 256; }
            text = number.toString(16);
            output.push(text.length === 1 ? "0" + text : text);
        }
        return output.join("");
    }

    function translationDigest(algorithm, value) {
        var digest = MessageDigest.getInstance(String(algorithm));
        var bytes = new JavaString(String(value)).getBytes("UTF-8");
        return translationHex(digest.digest(bytes));
    }

    function translationEncode(value) {
        return String(URLEncoder.encode(String(value), "UTF-8"));
    }

    function translationForm(params) {
        var parts = [];
        var key;
        for (key in params) {
            if (params.hasOwnProperty(key)) {
                parts.push(translationEncode(key) + "=" +
                    translationEncode(params[key]));
            }
        }
        return parts.join("&");
    }

    function translationReadStream(stream) {
        var reader = null;
        var builder = new SB();
        var line;
        if (stream === null) { return ""; }
        try {
            reader = new BR(new ISR(stream, "UTF-8"));
            while ((line = reader.readLine()) !== null) {
                builder.append(line).append("\n");
            }
            return String(builder.toString());
        } finally {
            try { if (reader !== null) { reader.close(); } }
            catch (ignoredReader) {}
            try { stream.close(); } catch (ignoredStream) {}
        }
    }

    function translationPost(urlText, params) {
        var connection = null;
        var writer = null;
        var code;
        var body;
        var response;
        try {
            connection = new URL(String(urlText)).openConnection();
            connection.setConnectTimeout(12000);
            connection.setReadTimeout(20000);
            connection.setUseCaches(false);
            connection.setDoInput(true);
            connection.setDoOutput(true);
            connection.setRequestMethod("POST");
            connection.setRequestProperty("Content-Type",
                "application/x-www-form-urlencoded; charset=UTF-8");
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("User-Agent", "ClipHub/Translation-v1");
            body = translationForm(params);
            writer = new OSW(connection.getOutputStream(), "UTF-8");
            writer.write(body);
            writer.flush();
            writer.close();
            writer = null;
            code = Number(connection.getResponseCode());
            response = translationReadStream(code >= 200 && code < 400 ?
                connection.getInputStream() : connection.getErrorStream());
            if (code < 200 || code >= 400) {
                throw new Error("HTTP " + code + ": " + response);
            }
            return response;
        } finally {
            try { if (writer !== null) { writer.close(); } }
            catch (ignoredWriter) {}
            try {
                if (connection !== null && connection.disconnect) {
                    connection.disconnect();
                }
            } catch (ignoredConnection) {}
        }
    }

    function translationContainsChinese(text) {
        return /[\u3400-\u9fff]/.test(String(text || ""));
    }

    function translationDirection(text, provider) {
        var chinese = translationContainsChinese(text);
        return {
            from: "auto",
            to: chinese ? "en" : (provider === "youdao" ? "zh-CHS" : "zh"),
            targetLabel: chinese ? "英文" : "中文"
        };
    }

    function translationSettings() {
        var settings = ClipHub.Settings;
        var engine;
        if (!settings || typeof settings.get !== "function") {
            throw new Error("翻译设置尚未初始化");
        }
        engine = String(settings.get("translation.engine", "baidu"));
        return {
            engine: engine === "youdao" ? "youdao" : "baidu",
            baiduAppId: String(settings.get("translation.baidu.app_id", "")),
            baiduSecret: String(settings.get("translation.baidu.app_secret", "")),
            youdaoAppKey: String(settings.get("translation.youdao.app_key", "")),
            youdaoSecret: String(settings.get("translation.youdao.app_secret", "")),
            maxChars: Math.max(1, Math.min(10000,
                Number(settings.get("translation.max_chars", 5000))))
        };
    }

    function translateBaidu(text, config) {
        var direction = translationDirection(text, "baidu");
        var salt = String(System.currentTimeMillis());
        var sign;
        var data;
        var output = [];
        var index;
        if (!config.baiduAppId || !config.baiduSecret) {
            throw new Error("请先在设置页填写百度 APP ID 和密钥");
        }
        sign = translationDigest("MD5",
            config.baiduAppId + text + salt + config.baiduSecret);
        data = JSON.parse(translationPost(
            "https://fanyi-api.baidu.com/api/trans/vip/translate", {
                q: text,
                from: direction.from,
                to: direction.to,
                appid: config.baiduAppId,
                salt: salt,
                sign: sign
            }));
        if (data.error_code) {
            throw new Error("百度翻译错误 " + data.error_code +
                (data.error_msg ? "：" + data.error_msg : ""));
        }
        if (!data.trans_result || data.trans_result.length < 1) {
            throw new Error("百度翻译未返回结果");
        }
        for (index = 0; index < data.trans_result.length; index += 1) {
            output.push(String(data.trans_result[index].dst || ""));
        }
        return {
            ok: true,
            provider: "baidu",
            providerLabel: "百度翻译",
            sourceText: text,
            translatedText: output.join("\n"),
            targetLanguage: direction.targetLabel
        };
    }

    function youdaoInput(text) {
        text = String(text || "");
        if (text.length <= 20) { return text; }
        return text.substring(0, 10) + String(text.length) +
            text.substring(text.length - 10);
    }

    function translateYoudao(text, config) {
        var direction = translationDirection(text, "youdao");
        var salt = String(UUID.randomUUID().toString());
        var curtime = String(Math.floor(System.currentTimeMillis() / 1000));
        var sign;
        var data;
        if (!config.youdaoAppKey || !config.youdaoSecret) {
            throw new Error("请先在设置页填写有道 App Key 和应用密钥");
        }
        sign = translationDigest("SHA-256",
            config.youdaoAppKey + youdaoInput(text) + salt + curtime +
                config.youdaoSecret);
        data = JSON.parse(translationPost("https://openapi.youdao.com/api", {
            q: text,
            from: direction.from,
            to: direction.to,
            appKey: config.youdaoAppKey,
            salt: salt,
            sign: sign,
            signType: "v3",
            curtime: curtime
        }));
        if (String(data.errorCode || "") !== "0") {
            throw new Error("有道翻译错误 " + String(data.errorCode || "未知"));
        }
        if (!data.translation || data.translation.length < 1) {
            throw new Error("有道翻译未返回结果");
        }
        return {
            ok: true,
            provider: "youdao",
            providerLabel: "有道翻译",
            sourceText: text,
            translatedText: String(data.translation.join("\n")),
            targetLanguage: direction.targetLabel
        };
    }

    function translateConfiguredSync(text, providerOverride) {
        var config = translationSettings();
        var provider = providerOverride ? String(providerOverride) : config.engine;
        text = String(text === null || text === undefined ? "" : text);
        if (text.replace(/^\s+|\s+$/g, "").length === 0) {
            throw new Error("翻译内容不能为空");
        }
        if (text.length > config.maxChars) {
            throw new Error("翻译内容超过 " + config.maxChars + " 字符");
        }
        return provider === "youdao" ?
            translateYoudao(text, config) : translateBaidu(text, config);
    }

    function postTranslationCallback(callback, result) {
        if (typeof callback !== "function") { return; }
        runOnMain(function () { callback(result); }, 0);
    }

    function translateConfiguredAsync(text, callback, providerOverride) {
        var generation = translationGeneration + 1;
        var worker;
        translationGeneration = generation;
        translationState.requestCount += 1;
        worker = new JavaThread(new Packages.java.lang.Runnable({
            run: function () {
                var result;
                try {
                    result = translateConfiguredSync(text, providerOverride);
                    translationState.successCount += 1;
                } catch (error) {
                    translationState.errorCount += 1;
                    result = { ok: false, error: String(error),
                        sourceText: String(text || "") };
                }
                postTranslationCallback(callback, result);
            }
        }), "ClipHub-Translation-" + String(generation));
        worker.setDaemon(true);
        worker.start();
        return generation;
    }

    function translationSetRunning(running, message) {
        translationState.running = running === true;
        if (translationStatusView !== null) {
            translationStatusView.setText(String(message || ""));
        }
        return true;
    }

    function refreshTranslationButtons() {
        var enabled = !translationState.running &&
            String(translationState.translatedText || "").length > 0;
        var views = [translationCopyView, translationReplaceView,
            translationSaveView];
        var index;
        for (index = 0; index < views.length; index += 1) {
            if (views[index] !== null) {
                views[index].setEnabled(enabled);
                views[index].setAlpha(enabled ? 1 : 0.45);
            }
        }
        if (translationRetryView !== null) {
            translationRetryView.setEnabled(!translationState.running);
            translationRetryView.setAlpha(translationState.running ? 0.45 : 1);
        }
    }

    function applyTranslationResult(result) {
        if (!translationState.attached) { return false; }
        if (result && result.ok === true) {
            translationState.provider = String(result.provider || "none");
            translationState.translatedText = String(result.translatedText || "");
            translationState.targetLanguage = String(result.targetLanguage || "");
            translationState.lastError = null;
            if (translationProviderView !== null) {
                translationProviderView.setText(String(result.providerLabel || "翻译") +
                    " · 目标语言：" + translationState.targetLanguage);
            }
            if (translationResultView !== null) {
                translationResultView.setText(translationState.translatedText);
            }
            translationSetRunning(false, "翻译完成");
        } else {
            translationState.lastError = result ? String(result.error) :
                "翻译失败";
            translationState.translatedText = "";
            if (translationResultView !== null) {
                translationResultView.setText("翻译失败\n" + translationState.lastError);
            }
            translationSetRunning(false, "翻译失败");
        }
        refreshTranslationButtons();
        return true;
    }

    function beginTranslation() {
        if (!translationState.attached || translationState.running) {
            return false;
        }
        translationState.retryCount += translationState.requestCount > 0 ? 1 : 0;
        translationState.translatedText = "";
        translationState.lastError = null;
        if (translationResultView !== null) {
            translationResultView.setText("正在请求翻译…");
        }
        translationSetRunning(true, "正在翻译…");
        refreshTranslationButtons();
        translateConfiguredAsync(translationState.sourceText,
            function (result) { applyTranslationResult(result); });
        return true;
    }

    function emitTranslationMutation(name, itemId, action) {
        try {
            if (ClipHub.EventBus && typeof ClipHub.EventBus.emit === "function") {
                ClipHub.EventBus.emit(name, {
                    id: Number(itemId), action: String(action),
                    at: ClipHub.Base.now(), origin: "translation_result"
                });
            }
        } catch (ignored) {}
    }

    function copyTranslatedText() {
        var result;
        if (!translationState.translatedText) { return false; }
        result = ClipHub.Clipboard.writeText(translationState.translatedText, {
            label: "ClipHub 翻译", sensitive: false
        });
        if (result && result.ok === true) {
            if (ClipHub.Window && translationCopyView !== null &&
                    typeof ClipHub.Window.performHaptic === "function") {
                ClipHub.Window.performHaptic(translationCopyView, "confirm");
            }
            translationState.copyCount += 1;
            translationSetRunning(false, "译文已复制");
            return true;
        }
        return false;
    }

    function replaceOriginalText() {
        var changed;
        if (!translationState.translatedText || translationState.itemId === null) {
            return false;
        }
        changed = ClipHub.Repository.updateItem(Number(translationState.itemId), {
            content: translationState.translatedText
        });
        if (Number(changed) > 0) {
            translationState.replaceCount += 1;
            translationState.sourceText = translationState.translatedText;
            if (translationOriginalView !== null) {
                translationOriginalView.setText(translationState.sourceText);
            }
            emitTranslationMutation("clipboard_merged",
                translationState.itemId, "translation_replaced");
            translationSetRunning(false, "原文已替换");
            return true;
        }
        return false;
    }

    function saveTranslationAsNew() {
        var id;
        if (!translationState.translatedText) { return false; }
        id = Number(ClipHub.Repository.insertItem({
            content: translationState.translatedText,
            contentType: "text",
            sourcePackage: null,
            sourceLabel: "ClipHub 翻译",
            sourceUid: Number(Packages.android.os.Process.myUid()),
            sourceConfidence: 100,
            isSensitive: false,
            isPinned: false
        }));
        if (id > 0) {
            translationState.saveNewCount += 1;
            emitTranslationMutation("clipboard_added", id,
                "translation_saved_new");
            translationSetRunning(false, "译文已保存为新记录");
            return true;
        }
        return false;
    }

    function translationPanelSize() {
        var geometry;
        if (ClipHub.Window &&
                typeof ClipHub.Window.computeGeometry === "function") {
            geometry = ClipHub.Window.computeGeometry("translation", {
                useSaved: true
            });
            return geometry;
        }
        return { width: dp(390), height: dp(650),
            widthDp: 390, heightDp: 650 };
    }

    function buildTranslationPanel() {
        var colors = translationPalette();
        var root = new LinearLayout(appContext);
        var handleRow = new LinearLayout(appContext);
        var handle = new View(appContext);
        var header = new LinearLayout(appContext);
        var title = translationText("翻译结果", 18, colors.textPrimary, true);
        var originalLabel = translationText("原文", 11,
            colors.textSecondary, true);
        var resultLabel = translationText("译文", 11,
            colors.textSecondary, true);
        var originalScroll = new ScrollView(appContext);
        var resultScroll = new ScrollView(appContext);
        var actionRow1 = new LinearLayout(appContext);
        var actionRow2 = new LinearLayout(appContext);
        var params;

        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(12), dp(8), dp(12), dp(10));
        root.setBackground(translationRounded(colors.surface,
            colors.stroke, 24));
        handleRow.setGravity(Gravity.CENTER);
        handle.setBackground(translationRounded(colors.accentBorder, null, 3));
        handleRow.addView(handle, new LinearLayout.LayoutParams(dp(42), dp(4)));
        root.addView(handleRow, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(16)));

        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.addView(title, new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        translationCloseView = translationText("×", 22, colors.icon, true);
        translationCloseView.setGravity(Gravity.CENTER);
        translationCloseView.setBackground(translationRounded(
            colors.surfaceMuted, null, 18));
        translationCloseView.setClickable(true);
        translationCloseView.setFocusable(true);
        translationCloseView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, { onClick: function () {
                closeTranslationPanel("button");
            }}));
        header.addView(translationCloseView,
            new LinearLayout.LayoutParams(dp(38), dp(38)));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(42));
        params.bottomMargin = dp(5);
        root.addView(header, params);

        translationProviderView = translationText("准备翻译", 10,
            colors.accentStrong, true);
        root.addView(translationProviderView, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        translationStatusView = translationText("", 9,
            colors.textSecondary, false);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(2);
        params.bottomMargin = dp(6);
        root.addView(translationStatusView, params);

        root.addView(originalLabel, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        translationOriginalView = translationText(
            translationState.sourceText, 12, colors.textPrimary, false);
        translationOriginalView.setTextIsSelectable(true);
        translationOriginalView.setPadding(dp(10), dp(8), dp(10), dp(8));
        translationOriginalView.setBackground(translationRounded(
            colors.surfaceMuted, colors.stroke, 12));
        originalScroll.addView(translationOriginalView,
            new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(96));
        params.topMargin = dp(4);
        params.bottomMargin = dp(7);
        root.addView(originalScroll, params);

        root.addView(resultLabel, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        translationResultView = translationText("正在请求翻译…", 12,
            colors.textPrimary, false);
        translationResultView.setTextIsSelectable(true);
        translationResultView.setPadding(dp(10), dp(8), dp(10), dp(8));
        translationResultView.setBackground(translationRounded(
            colors.accentSoft, colors.accentBorder, 12));
        resultScroll.addView(translationResultView,
            new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1);
        params.topMargin = dp(4);
        params.bottomMargin = dp(8);
        root.addView(resultScroll, params);

        actionRow1.setOrientation(LinearLayout.HORIZONTAL);
        translationCopyView = translationButton("复制译文", colors, true, false);
        translationReplaceView = translationButton("替换原文", colors, false, false);
        translationSaveView = translationButton("保存为新记录", colors, false, false);
        params = new LinearLayout.LayoutParams(0, dp(40), 1);
        params.rightMargin = dp(6);
        actionRow1.addView(translationCopyView, params);
        actionRow1.addView(translationReplaceView, params);
        actionRow1.addView(translationSaveView,
            new LinearLayout.LayoutParams(0, dp(40), 1));
        root.addView(actionRow1, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(40)));

        actionRow2.setOrientation(LinearLayout.HORIZONTAL);
        translationRetryView = translationButton("重新翻译", colors, false, false);
        translationCloseView = translationButton("关闭", colors, false, false);
        params = new LinearLayout.LayoutParams(0, dp(38), 1);
        params.rightMargin = dp(6);
        actionRow2.addView(translationRetryView, params);
        actionRow2.addView(translationCloseView,
            new LinearLayout.LayoutParams(0, dp(38), 1));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(38));
        params.topMargin = dp(6);
        root.addView(actionRow2, params);

        translationCopyView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, { onClick: copyTranslatedText }));
        translationReplaceView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, { onClick: replaceOriginalText }));
        translationSaveView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, { onClick: saveTranslationAsNew }));
        translationRetryView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, { onClick: beginTranslation }));
        translationCloseView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, { onClick: function () {
                closeTranslationPanel("button");
            }}));
        refreshTranslationButtons();
        return root;
    }

    function openTranslationForItem(itemId) {
        var row;
        var size;
        var type;
        if (!initialized) { throw new Error("翻译模块尚未初始化"); }
        row = ClipHub.Repository.getItem(Number(itemId), false);
        if (row === null) { throw new Error("翻译目标不存在"); }
        closeTranslationPanel("replace");
        translationState.itemId = Number(row.id);
        translationState.sourceText = String(row.content || "");
        translationState.translatedText = "";
        translationState.provider = "none";
        translationState.targetLanguage = "";
        translationState.lastError = null;
        runOnMainSync(function () {
            size = translationPanelSize();
            type = Build.VERSION.SDK_INT >= 26 ?
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY :
                WindowManager.LayoutParams.TYPE_SYSTEM_ALERT;
            translationRoot = buildTranslationPanel();
            if (Build.VERSION.SDK_INT >= 21) {
                translationRoot.setElevation(0);
                translationRoot.setClipToOutline(true);
            }
            translationManagedFrame = ClipHub.Window.createManagedFrame(
                translationRoot, {
                    accentColor: translationPalette().accentStrong
                });
            translationWindowRoot = translationManagedFrame.rootView;
            translationParams = new WindowManager.LayoutParams(
                size.width, size.height, type,
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
                    WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED |
                    WindowManager.LayoutParams.FLAG_DIM_BEHIND,
                PixelFormat.TRANSLUCENT);
            translationParams.gravity = Gravity.TOP | Gravity.START;
            translationParams.x = Number(size.x || 0);
            translationParams.y = Number(size.y || 0);
            translationParams.dimAmount = 0.44;
            try {
                translationParams.setTitle(
                    "ClipHub Detail Translation Result Panel");
            } catch (ignoredTitle) {}
            windowManager.addView(translationWindowRoot, translationParams);
            ClipHub.Window.attachWindow({
                role: "translation",
                rootView: translationWindowRoot,
                contentView: translationRoot,
                layoutParams: translationParams,
                windowManager: windowManager,
                dragView: translationManagedFrame.dragView,
                resizeView: translationManagedFrame.resizeView,
                resizeVisual: translationManagedFrame.resizeVisual,
                geometry: size,
                onGeometryChanged: function (geometry) {
                    translationState.panelWidthDp = Number(
                        geometry.widthDp || 0);
                    translationState.panelHeightDp = Number(
                        geometry.heightDp || 0);
                },
                onRequestClose: function () {
                    return closeTranslationPanel("managed_close");
                }
            });
            translationState.attached = true;
            translationState.panelWidthDp = size.widthDp;
            translationState.panelHeightDp = size.heightDp;
            try {
                if (ClipHub.Navigation && ClipHub.Navigation.scanNow) {
                    ClipHub.Navigation.scanNow();
                }
            } catch (ignoredScan) {}
            return true;
        }, 3000);
        beginTranslation();
        return getTranslationState();
    }

    function closeTranslationPanel(reason) {
        translationGeneration += 1;
        if (!translationState.attached && translationRoot === null) {
            return true;
        }
        return runOnMainSync(function () {
            try {
                if (translationWindowRoot !== null && ClipHub.Window &&
                        typeof ClipHub.Window.detachWindow === "function") {
                    try { ClipHub.Window.detachWindow(translationWindowRoot); }
                    catch (ignoredDetach) {}
                }
                if (translationRoot !== null) {
                    try {
                        windowManager.removeViewImmediate(
                            translationWindowRoot !== null ?
                                translationWindowRoot : translationRoot);
                    } catch (error) {
                        if (translationWindowRoot !== null ?
                                translationWindowRoot.isAttachedToWindow() :
                                translationRoot.isAttachedToWindow()) {
                            throw error;
                        }
                    }
                }
                translationState.closeCount += 1;
                return true;
            } finally {
                translationState.attached = false;
                translationState.running = false;
                translationRoot = null;
                translationWindowRoot = null;
                translationManagedFrame = null;
                translationParams = null;
                translationOriginalView = null;
                translationResultView = null;
                translationStatusView = null;
                translationProviderView = null;
                translationCopyView = null;
                translationReplaceView = null;
                translationSaveView = null;
                translationRetryView = null;
                translationCloseView = null;
            }
        }, 3000);
    }

    function getTranslationState() {
        var attachedToWindow = false;
        try {
            attachedToWindow = translationRoot !== null &&
                translationRoot.isAttachedToWindow();
        } catch (ignored) {}
        return {
            ready: initialized,
            attached: translationState.attached,
            attachedToWindow: attachedToWindow,
            open: translationState.attached,
            itemId: translationState.itemId,
            provider: translationState.provider,
            sourceLength: String(translationState.sourceText || "").length,
            translatedLength:
                String(translationState.translatedText || "").length,
            targetLanguage: translationState.targetLanguage,
            running: translationState.running,
            requestCount: Number(translationState.requestCount),
            successCount: Number(translationState.successCount),
            errorCount: Number(translationState.errorCount),
            copyCount: Number(translationState.copyCount),
            replaceCount: Number(translationState.replaceCount),
            saveNewCount: Number(translationState.saveNewCount),
            retryCount: Number(translationState.retryCount),
            closeCount: Number(translationState.closeCount),
            panelWidthDp: Number(translationState.panelWidthDp),
            panelHeightDp: Number(translationState.panelHeightDp),
            resultStyle: translationState.resultStyle,
            resultPopupPresent: translationState.attached,
            originalContentPreserved:
                translationState.replaceCount === 0,
            lastError: translationState.lastError
        };
    }
    ClipHub.Translation = {
        MODULE_NAME: "ch_12_translation",
        MODULE_VERSION: 9,
        init: function (context) {
            translationConfig = { enabled: true, provider: "settings" };
            navigationInit(context || {});
            translationState.attached = false;
            translationState.itemId = null;
            translationState.provider = "none";
            translationState.sourceText = "";
            translationState.translatedText = "";
            translationState.running = false;
            translationState.lastError = null;
            return true;
        },
        configure: function (provider, enabled) {
            translationConfig.provider = String(provider || "settings");
            translationConfig.enabled = enabled !== false;
            return translationConfig;
        },
        translate: function (text, callback, provider) {
            if (typeof callback === "function") {
                return translateConfiguredAsync(text, callback, provider);
            }
            return translateConfiguredSync(text, provider);
        },
        testConfigured: function (text, callback) {
            return translateConfiguredAsync(text || "ClipHub 翻译测试",
                callback);
        },
        openForItem: openTranslationForItem,
        close: closeTranslationPanel,
        isAttached: function () {
            return translationState.attached === true;
        },
        getState: getTranslationState,
        performCopyClick: copyTranslatedText,
        performReplaceClick: replaceOriginalText,
        performSaveNewClick: saveTranslationAsNew,
        performRetryClick: beginTranslation,
        shutdown: function () {
            try { closeTranslationPanel("shutdown"); }
            catch (ignoredTranslationClose) {}
            try { navigationShutdown(); }
            catch (ignoredNavigation) {}
            translationConfig.enabled = false;
            translationGeneration += 1;
            return true;
        }
    };

}((function () { return this; }())));
