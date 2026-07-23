(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var Handler = Packages.android.os.Handler;
    var Looper = Packages.android.os.Looper;
    var Context = Packages.android.content.Context;
    var System = Packages.java.lang.System;

    var WATCH_INTERVAL_MS = 180;
    var WATCH_CONFIRM_COUNT = 2;

    var listeners = {};
    var wrappers = [];
    var androidContext = null;
    var activityManager = null;
    var watchHandler = null;
    var initialized = false;
    var watchGeneration = 0;
    var watchRunnable = null;
    var pendingSignature = "";
    var pendingCount = 0;
    var watchState = {
        running: false,
        startCount: 0,
        stopCount: 0,
        sampleCount: 0,
        signalCount: 0,
        confirmedSignalCount: 0,
        hideCount: 0,
        intervalMs: WATCH_INTERVAL_MS,
        confirmCount: WATCH_CONFIRM_COUNT,
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
                moduleAttached(ClipHub.Settings, "getState") ||
                moduleAttached(ClipHub.Translation, "getState")) {
            return true;
        }
        try {
            listState = ClipHub.List && ClipHub.List.getState ?
                ClipHub.List.getState() : null;
            return !!(listState && listState.visible === true);
        } catch (ignored) {}
        return false;
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

    function captureBaseline(force) {
        var snapshot = taskSnapshot();
        if (snapshot.available && snapshot.packageName &&
                (force === true || !watchState.baselinePackage)) {
            watchState.baselinePackage = snapshot.packageName;
            watchState.baselineActivityType =
                Number(snapshot.activityType || 0);
            watchState.baselineTaskId = Number(snapshot.taskId);
        }
        watchState.lastPackage = snapshot.packageName;
        watchState.lastActivityType = Number(snapshot.activityType || 0);
        watchState.lastTaskId = Number(snapshot.taskId);
        return snapshot;
    }

    function signalReason(snapshot) {
        var packageChanged;
        var activityChanged;
        var taskChanged;
        if (!snapshot.available || !snapshot.packageName ||
                !watchState.baselinePackage) {
            return "";
        }
        packageChanged =
            snapshot.packageName !== watchState.baselinePackage;
        activityChanged =
            Number(snapshot.activityType) !==
            Number(watchState.baselineActivityType);
        taskChanged = Number(snapshot.taskId) >= 0 &&
            Number(watchState.baselineTaskId) >= 0 &&
            Number(snapshot.taskId) !== Number(watchState.baselineTaskId);
        if (packageChanged) {
            return "top_package_changed";
        }
        if ((Number(snapshot.activityType) === 2 ||
                Number(snapshot.activityType) === 3) &&
                (activityChanged || taskChanged)) {
            return activityChanged ?
                "home_or_recents_activity_type_changed" :
                "home_or_recents_task_changed";
        }
        return "";
    }

    function cancelWatch(reason) {
        watchGeneration += 1;
        if (watchHandler !== null && watchRunnable !== null) {
            try { watchHandler.removeCallbacks(watchRunnable); }
            catch (ignored) {}
        }
        if (watchState.running) { watchState.stopCount += 1; }
        watchState.running = false;
        watchState.lastStopReason = String(reason || "cancel");
        pendingSignature = "";
        pendingCount = 0;
        watchRunnable = null;
        return true;
    }

    function hideForSignal(reason, snapshot) {
        var hideReason = "task_watch_" + String(reason || "background");
        watchState.confirmedSignalCount += 1;
        watchState.lastSignalReason = String(reason || "");
        watchState.lastHideReason = hideReason;
        cancelWatch("confirmed_" + String(reason || "background"));
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
            watchState.hideCount += 1;
            log("I", "recents watch hide reason=" + hideReason +
                " package=" + String(snapshot.packageName || "") +
                " activityType=" +
                String(Number(snapshot.activityType || 0)) +
                " taskId=" + String(Number(snapshot.taskId)));
            return true;
        } catch (error) {
            watchState.lastError = String(error);
            log("W", "recents watch hide failed: " + String(error));
            return false;
        }
    }

    function watchTick(generation) {
        var snapshot;
        var reason;
        var signature;
        if (!initialized || generation !== watchGeneration ||
                !watchState.running) {
            return;
        }
        if (!uiVisible()) {
            cancelWatch("ui_not_visible");
            return;
        }
        watchState.sampleCount += 1;
        snapshot = taskSnapshot();
        watchState.lastPackage = snapshot.packageName;
        watchState.lastActivityType = Number(snapshot.activityType || 0);
        watchState.lastTaskId = Number(snapshot.taskId);
        reason = signalReason(snapshot);
        if (reason) {
            signature = String(snapshot.packageName || "") + "#" +
                String(Number(snapshot.activityType || 0)) + "#" +
                String(Number(snapshot.taskId)) + "#" + reason;
            watchState.signalCount += 1;
            watchState.lastSignalReason = reason;
            if (signature === pendingSignature) {
                pendingCount += 1;
            } else {
                pendingSignature = signature;
                pendingCount = 1;
            }
            if (pendingCount >= WATCH_CONFIRM_COUNT) {
                hideForSignal(reason, snapshot);
                return;
            }
        } else {
            pendingSignature = "";
            pendingCount = 0;
        }
        if (initialized && generation === watchGeneration &&
                watchState.running && watchHandler !== null) {
            watchRunnable = new Packages.java.lang.Runnable({
                run: function () { watchTick(generation); }
            });
            watchHandler.postDelayed(watchRunnable, WATCH_INTERVAL_MS);
        }
    }

    function startWatch(reason) {
        var generation;
        if (!initialized || watchHandler === null) { return false; }
        if (watchState.running) { return true; }
        captureBaseline(true);
        if (!watchState.baselinePackage) {
            watchState.lastError = "Task baseline unavailable";
            return false;
        }
        watchGeneration += 1;
        generation = watchGeneration;
        watchState.running = true;
        watchState.startCount += 1;
        watchState.lastStartReason = String(reason || "ui_visible");
        watchState.lastStopReason = "";
        pendingSignature = "";
        pendingCount = 0;
        watchRunnable = new Packages.java.lang.Runnable({
            run: function () {
                if (!uiVisible()) {
                    cancelWatch("ui_not_ready");
                    return;
                }
                watchTick(generation);
            }
        });
        watchHandler.postDelayed(watchRunnable, 90);
        return true;
    }

    function scheduleWatch(reason) {
        if (!initialized || watchHandler === null) { return false; }
        watchHandler.postDelayed(new Packages.java.lang.Runnable({
            run: function () {
                if (initialized && uiVisible()) {
                    startWatch(reason || "wrapped_ui_open");
                }
            }
        }), 70);
        return true;
    }

    function wrap(module, name, owner) {
        var original;
        var wrapped;
        if (!module || typeof module[name] !== "function") { return false; }
        original = module[name];
        wrapped = function () {
            var result = original.apply(module, arguments);
            scheduleWatch(owner + "." + name);
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

    function installWatchWrappers() {
        wrap(ClipHub.List, "openDetail", "List");
        wrap(ClipHub.Editor, "openNew", "Editor");
        wrap(ClipHub.Editor, "openItem", "Editor");
        wrap(ClipHub.Editor, "openTags", "Editor");
        wrap(ClipHub.Filter, "showPanel", "Filter");
    }

    function restoreWatchWrappers() {
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
    }

    function watchStateSnapshot() {
        return {
            running: watchState.running,
            startCount: Number(watchState.startCount),
            stopCount: Number(watchState.stopCount),
            sampleCount: Number(watchState.sampleCount),
            signalCount: Number(watchState.signalCount),
            confirmedSignalCount:
                Number(watchState.confirmedSignalCount),
            hideCount: Number(watchState.hideCount),
            intervalMs: Number(watchState.intervalMs),
            confirmCount: Number(watchState.confirmCount),
            baselinePackage: watchState.baselinePackage,
            baselineActivityType:
                Number(watchState.baselineActivityType),
            baselineTaskId: Number(watchState.baselineTaskId),
            lastPackage: watchState.lastPackage,
            lastActivityType: Number(watchState.lastActivityType),
            lastTaskId: Number(watchState.lastTaskId),
            lastSignalReason: watchState.lastSignalReason,
            lastStartReason: watchState.lastStartReason,
            lastStopReason: watchState.lastStopReason,
            lastHideReason: watchState.lastHideReason,
            lastError: watchState.lastError
        };
    }

    ClipHub.RecentsWatch = {
        MODULE_NAME: "ch_16_recents_watch_embedded",
        MODULE_VERSION: 1,
        start: function (reason) {
            return scheduleWatch(reason || "api_start");
        },
        stop: function (reason) {
            return cancelWatch(reason || "api_stop");
        },
        sampleNow: function () {
            var snapshot = taskSnapshot();
            return {
                snapshot: snapshot,
                signalReason: signalReason(snapshot),
                state: watchStateSnapshot()
            };
        },
        getState: watchStateSnapshot
    };

    ClipHub.EventBus = {
        MODULE_NAME: "ch_14_event_bus",
        MODULE_VERSION: 3,
        init: function (context) {
            listeners = {};
            androidContext = context && context.androidContext ?
                context.androidContext : global.context;
            if (!androidContext) {
                throw new Error("Android context unavailable for RecentsWatch");
            }
            androidContext =
                androidContext.getApplicationContext() || androidContext;
            activityManager = androidContext.getSystemService(
                Context.ACTIVITY_SERVICE);
            watchHandler = new Handler(Looper.getMainLooper());
            initialized = true;
            installWatchWrappers();
            return true;
        },
        on: function (name, listener) {
            name = String(name);
            if (typeof listener !== "function") {
                throw new Error("Listener must be a function");
            }
            listeners[name] = listeners[name] || [];
            listeners[name].push(listener);
            return listener;
        },
        off: function (name, listener) {
            var list = listeners[String(name)];
            var index;
            if (!list) { return false; }
            for (index = list.length - 1; index >= 0; index -= 1) {
                if (list[index] === listener) {
                    list.splice(index, 1);
                    return true;
                }
            }
            return false;
        },
        emit: function (name, payload) {
            var list = listeners[String(name)];
            var snapshot;
            var index;
            if (!list) { return 0; }
            snapshot = list.slice(0);
            for (index = 0; index < snapshot.length; index += 1) {
                try { snapshot[index](payload); } catch (error) {
                    if (ClipHub.Log) { ClipHub.Log.error(error); }
                }
            }
            return snapshot.length;
        },
        shutdown: function () {
            initialized = false;
            cancelWatch("event_bus_shutdown");
            restoreWatchWrappers();
            listeners = {};
            watchHandler = null;
            activityManager = null;
            androidContext = null;
            return true;
        }
    };
}((function () { return this; }())));
