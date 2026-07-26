(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var Context = Packages.android.content.Context;
    var Handler = Packages.android.os.Handler;
    var Looper = Packages.android.os.Looper;
    var MotionEvent = Packages.android.view.MotionEvent;
    var ViewConfiguration = Packages.android.view.ViewConfiguration;

    var listeners = {};
    var ready = false;
    var androidContext = null;
    var appContext = null;
    var activityManager = null;
    var mainHandler = null;
    var density = 1;
    var touchSlopPx = 8;

    var watchRunnable = null;
    var watchGeneration = 0;
    var watchVisible = false;
    var pendingSignature = "";
    var pendingCount = 0;

    var originalAttachWindow = null;
    var originalDetachWindow = null;
    var windowPatchInstalled = false;
    var windowEntries = [];

    var state = {
        initCount: 0,
        shutdownCount: 0,
        emitCount: 0,
        deliveryCount: 0,
        listenerCount: 0,
        lastEventName: "",
        windowPatchInstalled: false,
        outsideListenerAttachCount: 0,
        outsideListenerDetachCount: 0,
        outsideDownCount: 0,
        outsideTapCount: 0,
        outsideCancelCount: 0,
        insidePassCount: 0,
        gestureEdgePassCount: 0,
        lastOutsideRole: "",
        lastError: null
    };

    var recentsState = {
        retired: false,
        owner: "EventBusRuntimePatch",
        reason: "focus_independent_task_watch",
        running: false,
        startCount: 0,
        stopCount: 0,
        sampleCount: 0,
        signalCount: 0,
        confirmedSignalCount: 0,
        hideCount: 0,
        intervalMs: 180,
        confirmCount: 2,
        baselinePackage: "",
        baselineActivityType: 0,
        baselineTaskId: -1,
        lastPackage: "",
        lastActivityType: 0,
        lastTaskId: -1,
        lastSignalReason: "",
        lastStartReason: "",
        lastStopReason: "",
        lastHideReason: "",
        lastError: null
    };

    function logError(error) {
        state.lastError = String(error);
        try {
            if (ClipHub.Log && typeof ClipHub.Log.error === "function") {
                ClipHub.Log.error(error);
            }
        } catch (ignored) {}
    }

    function dp(value) {
        return Math.max(1, Math.floor(Number(value) * density + 0.5));
    }

    function countListeners() {
        var names = Object.keys(listeners);
        var total = 0;
        var index;
        for (index = 0; index < names.length; index += 1) {
            total += listeners[names[index]].length;
        }
        state.listenerCount = total;
        return total;
    }

    function eventState() {
        return {
            ready: ready,
            initCount: Number(state.initCount),
            shutdownCount: Number(state.shutdownCount),
            emitCount: Number(state.emitCount),
            deliveryCount: Number(state.deliveryCount),
            listenerCount: countListeners(),
            eventNameCount: Object.keys(listeners).length,
            lastEventName: state.lastEventName,
            windowPatchInstalled: windowPatchInstalled === true,
            outsideListenerAttachCount:
                Number(state.outsideListenerAttachCount),
            outsideListenerDetachCount:
                Number(state.outsideListenerDetachCount),
            outsideDownCount: Number(state.outsideDownCount),
            outsideTapCount: Number(state.outsideTapCount),
            outsideCancelCount: Number(state.outsideCancelCount),
            insidePassCount: Number(state.insidePassCount),
            gestureEdgePassCount: Number(state.gestureEdgePassCount),
            lastOutsideRole: state.lastOutsideRole,
            lastError: state.lastError
        };
    }

    function safeModuleState(module, method) {
        try {
            if (module && typeof module[method] === "function") {
                return module[method]() || {};
            }
        } catch (ignored) {}
        return {};
    }

    function uiVisible() {
        var filter = safeModuleState(ClipHub.Filter, "getPanelState");
        var editor = safeModuleState(ClipHub.Editor, "getState");
        var detail = safeModuleState(ClipHub.List, "getDetailState");
        var settings = safeModuleState(ClipHub.Settings, "getState");
        var translation = safeModuleState(ClipHub.Translation, "getState");
        return filter.panelAttached === true || filter.attached === true ||
            editor.attached === true || editor.open === true ||
            detail.attached === true || detail.attachedToWindow === true ||
            settings.attached === true || settings.open === true ||
            translation.attached === true || translation.open === true;
    }

    function taskSnapshot() {
        var result = {
            available: false,
            packageName: "",
            activityType: 0,
            taskId: -1
        };
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
                try { result.taskId = Number(info.taskId); }
                catch (ignoredTaskId) {}
                result.available = true;
                return result;
            }
        } catch (ignoredAtm) {}
        try {
            tasks = activityManager === null ? null :
                activityManager.getRunningTasks(1);
            if (tasks && Number(tasks.size()) > 0) {
                task = tasks.get(0);
                component = task.topActivity;
                if (component) {
                    result.packageName = String(component.getPackageName());
                }
                try { result.taskId = Number(task.id); }
                catch (ignoredId) {}
                result.available = true;
            }
        } catch (ignoredTasks) {}
        return result;
    }

    function resetRecentsBaseline() {
        recentsState.baselinePackage = "";
        recentsState.baselineActivityType = 0;
        recentsState.baselineTaskId = -1;
        pendingSignature = "";
        pendingCount = 0;
    }

    function captureBaseline(snapshot) {
        snapshot = snapshot || taskSnapshot();
        if (!snapshot.available || !snapshot.packageName) {
            return snapshot;
        }
        recentsState.baselinePackage = String(snapshot.packageName || "");
        recentsState.baselineActivityType =
            Number(snapshot.activityType || 0);
        recentsState.baselineTaskId = Number(snapshot.taskId || -1);
        recentsState.lastPackage = String(snapshot.packageName || "");
        recentsState.lastActivityType = Number(snapshot.activityType || 0);
        recentsState.lastTaskId = Number(snapshot.taskId || -1);
        pendingSignature = "";
        pendingCount = 0;
        return snapshot;
    }

    function recentsSignal(snapshot) {
        var packageName = String(snapshot.packageName || "").toLowerCase();
        var baselinePackage =
            String(recentsState.baselinePackage || "").toLowerCase();
        var packageChanged = packageName && baselinePackage &&
            packageName !== baselinePackage;
        var taskChanged = Number(snapshot.taskId) >= 0 &&
            Number(recentsState.baselineTaskId) >= 0 &&
            Number(snapshot.taskId) !== Number(recentsState.baselineTaskId);
        if (!snapshot.available) { return ""; }
        if (Number(snapshot.activityType) === 3) {
            return "activity_type_recents";
        }
        if (packageName.indexOf("quickstep") >= 0 ||
                packageName.indexOf("recents") >= 0) {
            return "recents_package";
        }
        if (packageName.indexOf("systemui") >= 0 &&
                (taskChanged || packageChanged)) {
            return "systemui_task_changed";
        }
        if (packageChanged && (Number(snapshot.activityType) === 2 ||
                packageName.indexOf("launcher") >= 0 ||
                packageName.indexOf("home") >= 0)) {
            return "launcher_or_home_changed";
        }
        return "";
    }

    function hideForRecents(reason) {
        var hideReason = "task_watch_" + String(reason || "recents");
        recentsState.confirmedSignalCount += 1;
        recentsState.hideCount += 1;
        recentsState.lastHideReason = hideReason;
        pendingSignature = "";
        pendingCount = 0;
        watchVisible = false;
        recentsState.running = false;
        try {
            if (ClipHub.Navigation &&
                    typeof ClipHub.Navigation.hideUi === "function") {
                ClipHub.Navigation.hideUi(hideReason);
            } else if (ClipHub.App &&
                    typeof ClipHub.App.hideUi === "function") {
                ClipHub.App.hideUi(hideReason);
            } else {
                throw new Error("ClipHub UI hide API unavailable");
            }
            return true;
        } catch (error) {
            recentsState.lastError = String(error);
            logError(error);
            return false;
        }
    }

    function sampleRecentsNow(allowHide) {
        var snapshot = taskSnapshot();
        var reason;
        var signature;
        recentsState.sampleCount += 1;
        recentsState.lastPackage = String(snapshot.packageName || "");
        recentsState.lastActivityType = Number(snapshot.activityType || 0);
        recentsState.lastTaskId = Number(snapshot.taskId || -1);
        if (!recentsState.baselinePackage && snapshot.available &&
                snapshot.packageName) {
            captureBaseline(snapshot);
            return { snapshot: snapshot, signalReason: "" };
        }
        reason = recentsSignal(snapshot);
        recentsState.lastSignalReason = reason;
        if (!reason) {
            pendingSignature = "";
            pendingCount = 0;
            return { snapshot: snapshot, signalReason: "" };
        }
        recentsState.signalCount += 1;
        signature = String(snapshot.packageName || "") + "#" +
            String(Number(snapshot.activityType || 0)) + "#" +
            String(Number(snapshot.taskId || -1)) + "#" + reason;
        if (signature === pendingSignature) {
            pendingCount += 1;
        } else {
            pendingSignature = signature;
            pendingCount = 1;
        }
        if (allowHide === true &&
                pendingCount >= Number(recentsState.confirmCount)) {
            hideForRecents(reason);
        }
        return { snapshot: snapshot, signalReason: reason };
    }

    function watchTick(generation) {
        var visible;
        if (!ready || generation !== watchGeneration) { return; }
        visible = uiVisible();
        if (visible && !watchVisible) {
            watchVisible = true;
            recentsState.running = true;
            recentsState.startCount += 1;
            recentsState.lastStartReason = "ui_visible";
            captureBaseline();
        } else if (!visible && watchVisible) {
            watchVisible = false;
            recentsState.running = false;
            recentsState.stopCount += 1;
            recentsState.lastStopReason = "ui_hidden";
            resetRecentsBaseline();
        }
        if (visible) { sampleRecentsNow(true); }
        if (ready && generation === watchGeneration &&
                mainHandler !== null) {
            watchRunnable = new Packages.java.lang.Runnable({
                run: function () { watchTick(generation); }
            });
            mainHandler.postDelayed(
                watchRunnable, Number(recentsState.intervalMs));
        }
    }

    function startWatch(reason) {
        watchGeneration += 1;
        if (mainHandler === null) { return false; }
        recentsState.lastStartReason = String(reason || "init");
        watchRunnable = new Packages.java.lang.Runnable({
            run: function () { watchTick(watchGeneration); }
        });
        mainHandler.postDelayed(
            watchRunnable, Number(recentsState.intervalMs));
        return true;
    }

    function stopWatch(reason) {
        watchGeneration += 1;
        if (mainHandler !== null && watchRunnable !== null) {
            try { mainHandler.removeCallbacks(watchRunnable); }
            catch (ignored) {}
        }
        watchRunnable = null;
        watchVisible = false;
        recentsState.running = false;
        recentsState.lastStopReason = String(reason || "stop");
        resetRecentsBaseline();
        return true;
    }

    function recentsStateSnapshot() {
        return {
            retired: false,
            owner: recentsState.owner,
            reason: recentsState.reason,
            running: recentsState.running === true,
            startCount: Number(recentsState.startCount),
            stopCount: Number(recentsState.stopCount),
            sampleCount: Number(recentsState.sampleCount),
            signalCount: Number(recentsState.signalCount),
            confirmedSignalCount:
                Number(recentsState.confirmedSignalCount),
            hideCount: Number(recentsState.hideCount),
            intervalMs: Number(recentsState.intervalMs),
            confirmCount: Number(recentsState.confirmCount),
            baselinePackage: recentsState.baselinePackage,
            baselineActivityType:
                Number(recentsState.baselineActivityType),
            baselineTaskId: Number(recentsState.baselineTaskId),
            lastPackage: recentsState.lastPackage,
            lastActivityType: Number(recentsState.lastActivityType),
            lastTaskId: Number(recentsState.lastTaskId),
            lastSignalReason: recentsState.lastSignalReason,
            lastStartReason: recentsState.lastStartReason,
            lastStopReason: recentsState.lastStopReason,
            lastHideReason: recentsState.lastHideReason,
            lastError: recentsState.lastError
        };
    }

    function copyGeometry(geometry) {
        if (!geometry) { return null; }
        return {
            x: Number(geometry.x || 0),
            y: Number(geometry.y || 0),
            width: Number(geometry.width || 0),
            height: Number(geometry.height || 0),
            bounds: geometry.bounds ? {
                left: Number(geometry.bounds.left || 0),
                top: Number(geometry.bounds.top || 0),
                right: Number(geometry.bounds.right || 0),
                bottom: Number(geometry.bounds.bottom || 0)
            } : null
        };
    }

    function findWindowEntry(rootView) {
        var index;
        for (index = windowEntries.length - 1; index >= 0; index -= 1) {
            if (windowEntries[index].rootView === rootView) {
                return windowEntries[index];
            }
        }
        return null;
    }

    function removeWindowEntry(rootView) {
        var kept = [];
        var removed = null;
        var index;
        for (index = 0; index < windowEntries.length; index += 1) {
            if (windowEntries[index].rootView === rootView) {
                removed = windowEntries[index];
                try { rootView.setOnTouchListener(null); }
                catch (ignoredListener) {}
            } else {
                kept.push(windowEntries[index]);
            }
        }
        windowEntries = kept;
        if (removed !== null) {
            state.outsideListenerDetachCount += 1;
        }
        return removed;
    }

    function pointInsidePanel(entry, rawX, rawY) {
        var geometry = entry ? entry.geometry : null;
        if (!geometry || Number(geometry.width) <= 0 ||
                Number(geometry.height) <= 0) {
            return true;
        }
        return Number(rawX) >= Number(geometry.x) &&
            Number(rawX) < Number(geometry.x) + Number(geometry.width) &&
            Number(rawY) >= Number(geometry.y) &&
            Number(rawY) < Number(geometry.y) + Number(geometry.height);
    }

    function pointInSystemGestureEdge(entry, rawX, rawY) {
        var geometry = entry ? entry.geometry : null;
        var bounds = geometry ? geometry.bounds : null;
        var edgeInset = dp(24);
        var bottomInset = dp(32);
        if (!bounds) { return false; }
        return Number(rawX) <= Number(bounds.left) + edgeInset ||
            Number(rawX) >= Number(bounds.right) - edgeInset ||
            Number(rawY) >= Number(bounds.bottom) - bottomInset ||
            Number(rawY) < Number(bounds.top);
    }

    function createRootOutsideListener(entry) {
        var tracking = false;
        var canceled = false;
        var downX = 0;
        var downY = 0;
        return new JavaAdapter(Packages.android.view.View.OnTouchListener, {
            onTouch: function (view, event) {
                var action = Number(event.getActionMasked());
                var rawX = Number(event.getRawX());
                var rawY = Number(event.getRawY());
                var dx;
                var dy;
                if (action === MotionEvent.ACTION_DOWN) {
                    tracking = false;
                    canceled = false;
                    if (pointInsidePanel(entry, rawX, rawY)) {
                        state.insidePassCount += 1;
                        return false;
                    }
                    if (pointInSystemGestureEdge(entry, rawX, rawY)) {
                        state.gestureEdgePassCount += 1;
                        return false;
                    }
                    tracking = true;
                    downX = rawX;
                    downY = rawY;
                    state.outsideDownCount += 1;
                    return true;
                }
                if (!tracking) { return false; }
                if (action === MotionEvent.ACTION_MOVE) {
                    dx = rawX - downX;
                    dy = rawY - downY;
                    if (Math.sqrt(dx * dx + dy * dy) > touchSlopPx) {
                        canceled = true;
                    }
                    return true;
                }
                if (action === MotionEvent.ACTION_CANCEL) {
                    tracking = false;
                    canceled = true;
                    state.outsideCancelCount += 1;
                    return true;
                }
                if (action === MotionEvent.ACTION_UP) {
                    if (!canceled &&
                            !pointInsidePanel(entry, rawX, rawY) &&
                            !pointInSystemGestureEdge(entry, rawX, rawY) &&
                            ClipHub.Window &&
                            typeof ClipHub.Window.requestOutsideDismiss ===
                                "function") {
                        state.outsideTapCount += 1;
                        state.lastOutsideRole = String(entry.role || "shared");
                        ClipHub.Window.requestOutsideDismiss(
                            "outside_root_tap");
                    }
                    tracking = false;
                    canceled = false;
                    return true;
                }
                return true;
            }
        });
    }

    function installRootOutsideListener(options) {
        var entry;
        if (!options || !options.rootView) { return false; }
        removeWindowEntry(options.rootView);
        entry = {
            rootView: options.rootView,
            role: String(options.role || "shared"),
            geometry: copyGeometry(options.geometry),
            listener: null
        };
        entry.listener = createRootOutsideListener(entry);
        try {
            entry.rootView.setClickable(false);
            entry.rootView.setOnTouchListener(entry.listener);
        } catch (error) {
            logError(error);
            return false;
        }
        windowEntries.push(entry);
        state.outsideListenerAttachCount += 1;
        return true;
    }

    function installWindowPatch() {
        if (windowPatchInstalled || !ClipHub.Window ||
                typeof ClipHub.Window.attachWindow !== "function") {
            return false;
        }
        originalAttachWindow = ClipHub.Window.attachWindow;
        originalDetachWindow = ClipHub.Window.detachWindow;

        ClipHub.Window.attachWindow = function (options) {
            var originalGeometryChanged;
            var result;
            var entry;
            options = options || {};
            originalGeometryChanged = options.onGeometryChanged;
            options.onGeometryChanged = function (geometry, reason) {
                entry = findWindowEntry(options.rootView);
                if (entry) { entry.geometry = copyGeometry(geometry); }
                if (typeof originalGeometryChanged === "function") {
                    return originalGeometryChanged(geometry, reason);
                }
                return true;
            };
            result = originalAttachWindow.call(ClipHub.Window, options);
            installRootOutsideListener(options);
            entry = findWindowEntry(options.rootView);
            if (entry) { entry.geometry = copyGeometry(options.geometry); }
            return result;
        };

        if (typeof originalDetachWindow === "function") {
            ClipHub.Window.detachWindow = function (rootView) {
                removeWindowEntry(rootView);
                return originalDetachWindow.call(ClipHub.Window, rootView);
            };
        }
        windowPatchInstalled = true;
        state.windowPatchInstalled = true;
        return true;
    }

    function restoreWindowPatch() {
        var snapshot = windowEntries.slice(0);
        var index;
        if (ClipHub.Window) {
            if (originalAttachWindow !== null) {
                ClipHub.Window.attachWindow = originalAttachWindow;
            }
            if (originalDetachWindow !== null) {
                ClipHub.Window.detachWindow = originalDetachWindow;
            }
        }
        for (index = 0; index < snapshot.length; index += 1) {
            removeWindowEntry(snapshot[index].rootView);
        }
        originalAttachWindow = null;
        originalDetachWindow = null;
        windowPatchInstalled = false;
        state.windowPatchInstalled = false;
        return true;
    }

    ClipHub.RecentsWatch = {
        MODULE_NAME: "ch_16_recents_watch_compat",
        MODULE_VERSION: 5,
        init: function () { return startWatch("compat_init"); },
        start: function (reason) {
            return startWatch(reason || "compat_start");
        },
        stop: function (reason) {
            return stopWatch(reason || "compat_stop");
        },
        sampleNow: function () {
            var result = sampleRecentsNow(false);
            return {
                snapshot: result.snapshot,
                signalReason: result.signalReason,
                navigationState:
                    safeModuleState(ClipHub.Navigation, "getState"),
                state: recentsStateSnapshot()
            };
        },
        getState: recentsStateSnapshot,
        shutdown: function () { return stopWatch("compat_shutdown"); }
    };

    ClipHub.EventBus = {
        MODULE_NAME: "ch_14_event_bus",
        MODULE_VERSION: 8,
        init: function (context) {
            listeners = {};
            androidContext = context && context.androidContext ?
                context.androidContext : global.context;
            appContext = androidContext && androidContext.getApplicationContext ?
                androidContext.getApplicationContext() : androidContext;
            if (!appContext) {
                throw new Error("Android context unavailable for EventBus");
            }
            activityManager = appContext.getSystemService(
                Context.ACTIVITY_SERVICE);
            mainHandler = new Handler(Looper.getMainLooper());
            density = Number(appContext.getResources()
                .getDisplayMetrics().density || 1);
            touchSlopPx = Number(ViewConfiguration.get(appContext)
                .getScaledTouchSlop());
            ready = true;
            state.initCount += 1;
            state.emitCount = 0;
            state.deliveryCount = 0;
            state.listenerCount = 0;
            state.lastEventName = "";
            state.lastError = null;
            installWindowPatch();
            startWatch("event_bus_init");
            return true;
        },
        on: function (name, listener) {
            name = String(name);
            if (typeof listener !== "function") {
                throw new Error("Listener must be a function");
            }
            listeners[name] = listeners[name] || [];
            listeners[name].push(listener);
            countListeners();
            return listener;
        },
        off: function (name, listener) {
            var list = listeners[String(name)];
            var index;
            if (!list) { return false; }
            for (index = list.length - 1; index >= 0; index -= 1) {
                if (list[index] === listener) {
                    list.splice(index, 1);
                    if (list.length === 0) {
                        delete listeners[String(name)];
                    }
                    countListeners();
                    return true;
                }
            }
            return false;
        },
        emit: function (name, payload) {
            var eventName = String(name);
            var list = listeners[eventName];
            var snapshot;
            var index;
            state.emitCount += 1;
            state.lastEventName = eventName;
            if (!list) { return 0; }
            snapshot = list.slice(0);
            for (index = 0; index < snapshot.length; index += 1) {
                try {
                    snapshot[index](payload);
                    state.deliveryCount += 1;
                } catch (error) {
                    logError(error);
                }
            }
            return snapshot.length;
        },
        getState: eventState,
        shutdown: function () {
            stopWatch("event_bus_shutdown");
            restoreWindowPatch();
            listeners = {};
            ready = false;
            state.shutdownCount += 1;
            state.listenerCount = 0;
            androidContext = null;
            appContext = null;
            activityManager = null;
            mainHandler = null;
            return true;
        }
    };
}((function () { return this; }())));
