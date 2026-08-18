/* ClipHub deferred show visibility intent guard. Rhino ES5 only. */
(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var Handler = Packages.android.os.Handler;
    var Looper = Packages.android.os.Looper;

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
        wrappedAttachWindow: null
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

    function scheduleLogicalCleanup(generation) {
        var task;
        state.cleanupScheduledCount += 1;
        task = new Packages.java.lang.Runnable({
            run: function () {
                if (!state.started ||
                        state.desiredVisible === true ||
                        Number(generation) !== Number(state.intentGeneration)) {
                    state.cleanupSkippedCount += 1;
                    return;
                }
                state.cleanupRunCount += 1;
                if (typeof state.originalClosePanel !== "function") {
                    return;
                }
                state.cleanupDepth += 1;
                try {
                    state.originalClosePanel({
                        restoreList: false,
                        reason: "stale_attach_visibility_guard"
                    });
                } catch (error) {
                    state.cleanupFailureCount += 1;
                    state.lastError = errorText(error);
                } finally {
                    state.cleanupDepth -= 1;
                }
            }
        });
        try {
            if (state.mainHandler === null) {
                state.mainHandler = new Handler(Looper.getMainLooper());
            }
            if (!state.mainHandler.post(task)) {
                state.cleanupFailureCount += 1;
                state.lastError = "Visibility guard cleanup post failed";
                return false;
            }
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

        if (filter.__visibilityIntentGuardController) {
            return true;
        }

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
        if (windowModule.__visibilityIntentGuardController) {
            return true;
        }
        state.originalAttachWindow = windowModule.attachWindow;
        state.wrappedAttachWindow = function (options) {
            var generation = Number(state.intentGeneration);
            var role = String(options && options.role || "shared");
            if (state.desiredVisible !== true) {
                state.staleAttachDropCount += 1;
                state.lastDroppedRole = role;
                state.lastDroppedGeneration = generation;
                scheduleLogicalCleanup(generation);
                return safeWindowState();
            }
            state.attachAllowedCount += 1;
            return state.originalAttachWindow.apply(windowModule, arguments);
        };
        windowModule.attachWindow = state.wrappedAttachWindow;
        windowModule.__visibilityIntentGuardController = state;
        return true;
    }

    function currentDiagnostics() {
        var windowState = safeWindowState();
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
            lastDroppedRole: String(state.lastDroppedRole || ""),
            lastDroppedGeneration: Number(state.lastDroppedGeneration || 0),
            primaryAttached: windowState.primaryAttached === true,
            lastError: state.lastError
        };
    }

    ClipHub.VisibilityIntentGuard = {
        MODULE_NAME: "ch_20_visibility_intent_guard",
        MODULE_VERSION: 2,
        init: function () {
            var windowState;
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
            installFilterHooks();
            installWindowHook();
            return currentDiagnostics();
        },
        shutdown: function () {
            state.started = false;
            state.desiredVisible = false;
            state.intentGeneration += 1;
            state.lastIntent = "hide";
            state.lastIntentReason = "guard_shutdown";
            state.lastIntentAt = now();
            return currentDiagnostics();
        },
        getState: currentDiagnostics,
        markVisibleIntent: function (visible, reason) {
            beginIntent(visible === true, reason || "external");
            return currentDiagnostics();
        }
    };
}((function () { return this; }())));
