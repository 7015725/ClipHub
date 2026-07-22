(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var Build = Packages.android.os.Build;
    var Looper = Packages.android.os.Looper;
    var Handler = Packages.android.os.Handler;
    var System = Packages.java.lang.System;
    var View = Packages.android.view.View;
    var KeyEvent = Packages.android.view.KeyEvent;
    var WindowManager = Packages.android.view.WindowManager;
    var Context = Packages.android.content.Context;
    var CountDownLatch = Packages.java.util.concurrent.CountDownLatch;
    var TimeUnit = Packages.java.util.concurrent.TimeUnit;
    var AtomicReference = Packages.java.util.concurrent.atomic.AtomicReference;

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

    ClipHub.Translation = {
        MODULE_NAME: "ch_12_translation",
        MODULE_VERSION: 4,
        init: function (context) {
            translationConfig = { enabled: false, provider: "none" };
            navigationInit(context || {});
            return true;
        },
        configure: function (provider, enabled) {
            translationConfig.provider = String(provider || "none");
            translationConfig.enabled = Boolean(enabled);
            return translationConfig;
        },
        translate: function () {
            throw new Error("Translation is not implemented");
        },
        shutdown: function () {
            try { navigationShutdown(); }
            catch (ignoredNavigation) {}
            translationConfig.enabled = false;
            return true;
        }
    };
}((function () { return this; }())));
