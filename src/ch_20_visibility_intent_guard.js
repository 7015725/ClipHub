/* ClipHub deferred show visibility intent guard. Rhino ES5 only. */
(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var Handler = Packages.android.os.Handler;
    var Looper = Packages.android.os.Looper;

    var CLEANUP_DELAY_MS = 120;
    var CLEANUP_VERIFY_DELAY_MS = 120;
    var CLEANUP_MAX_PASSES = 2;

    var state = {
        started: false,
        desiredVisible: false,
        intentGeneration: 0,
        lastIntent: "none",
        lastIntentReason: "",
        lastIntentAt: 0,
        filterShowCount: 0,
        filterHideCount: 0,
        attachAllowedCount: 0,
        staleAttachDropCount: 0,
        cleanupScheduledCount: 0,
        cleanupRunCount: 0,
        cleanupSkippedCount: 0,
        cleanupFailureCount: 0,
        cleanupVerifyScheduledCount: 0,
        cleanupVerifyRunCount: 0,
        lastCleanupPass: 0,
        lastDroppedRole: "",
        lastDroppedGeneration: 0,
        lastError: null,
        showDepth: 0,
        closeDepth: 0,
        cleanupDepth: 0,
        mainHandler: null,
        filter: null,
        windowModule: null,
        originalShowRoot: null,
        originalShowPanel: null,
        originalClosePanel: null,
        originalAttachWindow: null,
        wrappedShowRoot: null,
        wrappedShowPanel: null,
        wrappedClosePanel: null,
        wrappedAttachWindow: null,
        pendingCleanupTasks: []
    };

    function now() {
        try {
            if (ClipHub.Base && typeof ClipHub.Base.now === "function") {
                return Number(ClipHub.Base.now());
            }
        } catch (ignoredBase) {}
        return Number(Packages.java.lang.System.currentTimeMillis());
    }

    function errorText(error) {
        try {
            if (error && error.javaException) {
                return String(error.javaException.getClass().getName()) +
                    ": " + String(error);
            }
        } catch (ignored) {}
        return String(error);
    }

    function safeWindowState() {
        try {
            if (state.windowModule &&
                    typeof state.windowModule.getState === "function") {
                return state.windowModule.getState() || {};
            }
        } catch (ignored) {}
        return {};
    }

    function safeFilterState() {
        try {
            if (state.filter && typeof state.filter.getPanelState === "function") {
                return state.filter.getPanelState() || {};
            }
        } catch (ignored) {}
        return {};
    }

    function hiddenResiduePresent() {
        var windowState = safeWindowState();
        var filterState = safeFilterState();
        return windowState.primaryAttached === true ||
            filterState.attached === true ||
            filterState.attachedToWindow === true ||
            filterState.rootMode === true;
    }

    function beginIntent(visible, reason) {
        state.intentGeneration += 1;
        state.desiredVisible = visible === true;
        state.lastIntent = state.desiredVisible ? "show" : "hide";
        state.lastIntentReason = String(reason || "unknown");
        state.lastIntentAt = now();
        if (state.desiredVisible) {
            state.filterShowCount += 1;
        } else {
            state.filterHideCount += 1;
        }
        return state.intentGeneration;
    }

    function shouldTreatCloseAsHide(options) {
        if (state.cleanupDepth > 0) { return false; }
        options = options || {};
        return options.restoreList === false;
    }

    function removePendingCleanupTask(task) {
        var index = state.pendingCleanupTasks.indexOf(task);
        if (index >= 0) {
            state.pendingCleanupTasks.splice(index, 1);
        }
    }

    function cancelPendingCleanupTasks() {
        var handler = state.mainHandler;
        var tasks = state.pendingCleanupTasks.slice(0);
        var index;
        state.pendingCleanupTasks = [];
        if (handler === null) { return 0; }
        for (index = 0; index < tasks.length; index += 1) {
            try { handler.removeCallbacks(tasks[index]); }
            catch (ignoredRemove) {}
        }
        return tasks.length;
    }

    function scheduleLogicalCleanup(generation, pass) {
        var task;
        var delayMs;
        if (!state.started) { return false; }
        pass = Math.max(1, Number(pass || 1));
        if (pass > CLEANUP_MAX_PASSES) { return false; }
        state.cleanupScheduledCount += 1;
        if (pass > 1) { state.cleanupVerifyScheduledCount += 1; }
        delayMs = pass === 1 ? CLEANUP_DELAY_MS : CLEANUP_VERIFY_DELAY_MS;
        task = new Packages.java.lang.Runnable({
            run: function () {
                var currentGeneration;
                removePendingCleanupTask(task);
                if (!state.started) {
                    state.cleanupSkippedCount += 1;
                    return;
                }
                if (state.desiredVisible === true) {
                    state.cleanupSkippedCount += 1;
                    return;
                }
                currentGeneration = Number(state.intentGeneration);
                if (Number(generation) !== currentGeneration) {
                    state.cleanupSkippedCount += 1;
                    if (state.desiredVisible !== true) {
                        scheduleLogicalCleanup(currentGeneration, 1);
                    }
                    return;
                }
                state.cleanupRunCount += 1;
                state.lastCleanupPass = pass;
                if (pass > 1) { state.cleanupVerifyRunCount += 1; }
                if (typeof state.originalClosePanel !== "function") {
                    return;
                }
                state.cleanupDepth += 1;
                try {
                    state.originalClosePanel({
                        restoreList: false,
                        reason: pass > 1 ?
                            "stale_attach_visibility_guard_verify" :
                            "stale_attach_visibility_guard"
                    });
                } catch (error) {
                    state.cleanupFailureCount += 1;
                    state.lastError = errorText(error);
                } finally {
                    state.cleanupDepth -= 1;
                }
                if (pass < CLEANUP_MAX_PASSES &&
                        state.desiredVisible !== true &&
                        Number(generation) === Number(state.intentGeneration) &&
                        hiddenResiduePresent()) {
                    scheduleLogicalCleanup(generation, pass + 1);
                }
            }
        });
        try {
            if (state.mainHandler === null) {
                state.mainHandler = new Handler(Looper.getMainLooper());
            }
            if (!state.mainHandler.postDelayed(task, Number(delayMs))) {
                state.cleanupFailureCount += 1;
                state.lastError = "Visibility guard cleanup post failed";
                return false;
            }
            state.pendingCleanupTasks.push(task);
            return true;
        } catch (error) {
            state.cleanupFailureCount += 1;
            state.lastError = errorText(error);
            return false;
        }
    }

    function installFilterHooks() {
        var filter = state.filter;
        if (!filter) { return false; }
        if (filter.__visibilityIntentGuardController) { return true; }

        state.originalShowRoot = filter.showRoot;
        state.originalShowPanel = filter.showPanel;
        state.originalClosePanel = filter.closePanel;

        if (typeof state.originalShowRoot === "function") {
            state.wrappedShowRoot = function (options) {
                var outer = state.showDepth === 0;
                if (outer) { beginIntent(true, "filter_show_root"); }
                state.showDepth += 1;
                try {
                    return state.originalShowRoot.apply(filter, arguments);
                } finally {
                    state.showDepth -= 1;
                }
            };
            state.wrappedShowRoot.__visibilityIntentGuardNext =
                state.originalShowRoot;
            filter.showRoot = state.wrappedShowRoot;
        }

        if (typeof state.originalShowPanel === "function") {
            state.wrappedShowPanel = function (options) {
                var outer = state.showDepth === 0;
                var rootMode = options && options.rootMode === true;
                if (outer && rootMode) {
                    beginIntent(true, "filter_show_panel_root");
                }
                state.showDepth += 1;
                try {
                    return state.originalShowPanel.apply(filter, arguments);
                } finally {
                    state.showDepth -= 1;
                }
            };
            state.wrappedShowPanel.__visibilityIntentGuardNext =
                state.originalShowPanel;
            filter.showPanel = state.wrappedShowPanel;
        }

        if (typeof state.originalClosePanel === "function") {
            state.wrappedClosePanel = function (options) {
                var outer = state.closeDepth === 0;
                if (outer && shouldTreatCloseAsHide(options)) {
                    beginIntent(false, String(options && options.reason ||
                        "filter_close_panel"));
                }
                state.closeDepth += 1;
                try {
                    return state.originalClosePanel.apply(filter, arguments);
                } finally {
                    state.closeDepth -= 1;
                }
            };
            state.wrappedClosePanel.__visibilityIntentGuardNext =
                state.originalClosePanel;
            filter.closePanel = state.wrappedClosePanel;
        }

        filter.__visibilityIntentGuardController = state;
        return true;
    }

    function installWindowHook() {
        var windowModule = state.windowModule;
        if (!windowModule || typeof windowModule.attachWindow !== "function") {
            return false;
        }
        if (windowModule.__visibilityIntentGuardController) { return true; }
        state.originalAttachWindow = windowModule.attachWindow;
        state.wrappedAttachWindow = function (options) {
            var generation = Number(state.intentGeneration);
            var role = String(options && options.role || "shared");
            if (state.desiredVisible !== true) {
                state.staleAttachDropCount += 1;
                state.lastDroppedRole = role;
                state.lastDroppedGeneration = generation;
                scheduleLogicalCleanup(generation, 1);
                return safeWindowState();
            }
            state.attachAllowedCount += 1;
            return state.originalAttachWindow.apply(windowModule, arguments);
        };
        state.wrappedAttachWindow.__visibilityIntentGuardNext =
            state.originalAttachWindow;
        windowModule.attachWindow = state.wrappedAttachWindow;
        windowModule.__visibilityIntentGuardController = state;
        return true;
    }

    function spliceOutWrapper(current, target, replacement) {
        var cursor = current;
        var guard = 0;
        while (cursor && typeof cursor === "function" &&
                cursor !== target && cursor !== replacement && guard < 64) {
            cursor = cursor.__visibilityIntentGuardNext;
            guard += 1;
        }
        if (cursor === target && target !== replacement) {
            if (replacement && typeof replacement === "function") {
                replacement.__visibilityIntentGuardNext =
                    target.__visibilityIntentGuardNext || null;
            }
            return replacement;
        }
        return current;
    }

    function clearControllerMarker(target) {
        if (!target || target.__visibilityIntentGuardController !== state) {
            return false;
        }
        try { delete target.__visibilityIntentGuardController; }
        catch (ignoredDelete) {
            target.__visibilityIntentGuardController = null;
        }
        return true;
    }

    function uninstallHooks() {
        var filter = state.filter;
        var windowModule = state.windowModule;
        if (filter) {
            if (filter.showRoot === state.wrappedShowRoot) {
                filter.showRoot = state.originalShowRoot;
            } else if (typeof filter.showRoot === "function" &&
                    typeof state.wrappedShowRoot === "function" &&
                    state.originalShowRoot) {
                filter.showRoot = spliceOutWrapper(filter.showRoot,
                    state.wrappedShowRoot, state.originalShowRoot);
            }
            if (filter.showPanel === state.wrappedShowPanel) {
                filter.showPanel = state.originalShowPanel;
            } else if (typeof filter.showPanel === "function" &&
                    typeof state.wrappedShowPanel === "function" &&
                    state.originalShowPanel) {
                filter.showPanel = spliceOutWrapper(filter.showPanel,
                    state.wrappedShowPanel, state.originalShowPanel);
            }
            if (filter.closePanel === state.wrappedClosePanel) {
                filter.closePanel = state.originalClosePanel;
            } else if (typeof filter.closePanel === "function" &&
                    typeof state.wrappedClosePanel === "function" &&
                    state.originalClosePanel) {
                filter.closePanel = spliceOutWrapper(filter.closePanel,
                    state.wrappedClosePanel, state.originalClosePanel);
            }
            clearControllerMarker(filter);
        }
        if (windowModule) {
            if (windowModule.attachWindow === state.wrappedAttachWindow) {
                windowModule.attachWindow = state.originalAttachWindow;
            } else if (typeof windowModule.attachWindow === "function" &&
                    typeof state.wrappedAttachWindow === "function" &&
                    state.originalAttachWindow) {
                windowModule.attachWindow = spliceOutWrapper(
                    windowModule.attachWindow, state.wrappedAttachWindow,
                    state.originalAttachWindow);
            }
            clearControllerMarker(windowModule);
        }
        state.originalShowRoot = null;
        state.originalShowPanel = null;
        state.originalClosePanel = null;
        state.originalAttachWindow = null;
        state.wrappedShowRoot = null;
        state.wrappedShowPanel = null;
        state.wrappedClosePanel = null;
        state.wrappedAttachWindow = null;
        return true;
    }

    function currentDiagnostics() {
        var windowState = safeWindowState();
        var filterState = safeFilterState();
        return {
            started: state.started === true,
            desiredVisible: state.desiredVisible === true,
            intentGeneration: Number(state.intentGeneration),
            lastIntent: String(state.lastIntent || "none"),
            lastIntentReason: String(state.lastIntentReason || ""),
            lastIntentAt: Number(state.lastIntentAt || 0),
            filterShowCount: Number(state.filterShowCount),
            filterHideCount: Number(state.filterHideCount),
            attachAllowedCount: Number(state.attachAllowedCount),
            staleAttachDropCount: Number(state.staleAttachDropCount),
            cleanupScheduledCount: Number(state.cleanupScheduledCount),
            cleanupRunCount: Number(state.cleanupRunCount),
            cleanupSkippedCount: Number(state.cleanupSkippedCount),
            cleanupFailureCount: Number(state.cleanupFailureCount),
            cleanupVerifyScheduledCount:
                Number(state.cleanupVerifyScheduledCount),
            cleanupVerifyRunCount: Number(state.cleanupVerifyRunCount),
            pendingCleanupCount: Number(state.pendingCleanupTasks.length),
            lastCleanupPass: Number(state.lastCleanupPass),
            cleanupDelayMs: CLEANUP_DELAY_MS,
            cleanupVerifyDelayMs: CLEANUP_VERIFY_DELAY_MS,
            lastDroppedRole: String(state.lastDroppedRole || ""),
            lastDroppedGeneration: Number(state.lastDroppedGeneration || 0),
            primaryAttached: windowState.primaryAttached === true,
            filterAttached: filterState.attached === true ||
                filterState.attachedToWindow === true,
            filterRootMode: filterState.rootMode === true,
            lastError: state.lastError
        };
    }

    ClipHub.VisibilityIntentGuard = {
        MODULE_NAME: "ch_20_visibility_intent_guard",
        MODULE_VERSION: 4,
        init: function () {
            var windowState;
            if (state.started) { return currentDiagnostics(); }
            state.filter = ClipHub.Filter || null;
            state.windowModule = ClipHub.Window || null;
            if (!state.filter || !state.windowModule) {
                throw new Error("Visibility intent guard dependencies unavailable");
            }
            if (state.mainHandler === null) {
                state.mainHandler = new Handler(Looper.getMainLooper());
            }
            windowState = safeWindowState();
            state.desiredVisible = windowState.primaryAttached === true;
            state.intentGeneration += 1;
            state.lastIntent = state.desiredVisible ? "show" : "hide";
            state.lastIntentReason = "guard_init";
            state.lastIntentAt = now();
            state.started = true;
            if (!installFilterHooks() || !installWindowHook()) {
                state.started = false;
                uninstallHooks();
                state.filter = null;
                state.windowModule = null;
                state.mainHandler = null;
                throw new Error("Visibility intent guard hook install failed");
            }
            return currentDiagnostics();
        },
        shutdown: function () {
            state.started = false;
            state.desiredVisible = false;
            state.intentGeneration += 1;
            state.lastIntent = "hide";
            state.lastIntentReason = "guard_shutdown";
            state.lastIntentAt = now();
            cancelPendingCleanupTasks();
            uninstallHooks();
            state.filter = null;
            state.windowModule = null;
            state.mainHandler = null;
            state.showDepth = 0;
            state.closeDepth = 0;
            state.cleanupDepth = 0;
            return currentDiagnostics();
        },
        getState: currentDiagnostics,
        markVisibleIntent: function (visible, reason) {
            if (!state.started) { return currentDiagnostics(); }
            beginIntent(visible === true, reason || "external");
            return currentDiagnostics();
        }
    };
}((function () { return this; }())));
