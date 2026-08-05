(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var Context = Packages.android.content.Context;
    var installed = false;
    var guardDepth = 0;
    var originalDetachWindow = null;
    var originalClosePanel = null;
    var originalShutdown = null;
    var state = {
        installCount: 0,
        guardedCloseCount: 0,
        guardedShutdownCount: 0,
        removeAttemptCount: 0,
        removeSuccessCount: 0,
        removeIgnoredCount: 0,
        removeFailureCount: 0,
        lastError: null
    };

    function errorText(error) {
        try {
            if (error && error.javaException) {
                return String(error.javaException.getClass().getName()) +
                    ": " + String(error);
            }
        } catch (ignored) {}
        return String(error);
    }

    function windowManager() {
        var context = null;
        try {
            if (ClipHub.Window &&
                    typeof ClipHub.Window.getAndroidContext === "function") {
                context = ClipHub.Window.getAndroidContext();
            }
        } catch (ignoredContext) {}
        if (context === null || context === undefined) {
            context = global.context;
        }
        return context === null || context === undefined ? null :
            context.getSystemService(Context.WINDOW_SERVICE);
    }

    function removeForRapidClose(rootView) {
        var manager;
        var attached = false;
        if (rootView === null || rootView === undefined) { return false; }
        manager = windowManager();
        if (manager === null || manager === undefined) { return false; }
        state.removeAttemptCount += 1;
        try {
            manager.removeViewImmediate(rootView);
            state.removeSuccessCount += 1;
            state.lastError = null;
            return true;
        } catch (error) {
            try { attached = rootView.isAttachedToWindow() === true; }
            catch (ignoredAttached) { attached = false; }
            if (!attached) {
                state.removeIgnoredCount += 1;
                state.lastError = null;
                return false;
            }
            state.removeFailureCount += 1;
            state.lastError = errorText(error);
            throw error;
        }
    }

    function guardedDetachWindow(rootView, options) {
        if (guardDepth > 0) { removeForRapidClose(rootView); }
        return originalDetachWindow(rootView, options);
    }

    function runGuarded(callback) {
        guardDepth += 1;
        try { return callback(); }
        finally { guardDepth = Math.max(0, guardDepth - 1); }
    }

    function install() {
        if (installed) { return true; }
        if (!ClipHub.Window || !ClipHub.Filter ||
                typeof ClipHub.Window.detachWindow !== "function" ||
                typeof ClipHub.Filter.closePanel !== "function") {
            throw new Error("ClipHub rapid-close dependencies unavailable");
        }
        originalDetachWindow = ClipHub.Window.detachWindow;
        originalClosePanel = ClipHub.Filter.closePanel;
        originalShutdown = typeof ClipHub.Filter.shutdown === "function" ?
            ClipHub.Filter.shutdown : null;

        ClipHub.Window.detachWindow = guardedDetachWindow;
        ClipHub.Filter.closePanel = function (options) {
            state.guardedCloseCount += 1;
            return runGuarded(function () {
                return originalClosePanel(options);
            });
        };
        if (originalShutdown !== null) {
            ClipHub.Filter.shutdown = function () {
                state.guardedShutdownCount += 1;
                return runGuarded(function () {
                    return originalShutdown();
                });
            };
        }
        installed = true;
        state.installCount += 1;
        state.lastError = null;
        return true;
    }

    ClipHub.RapidCloseFix = {
        MODULE_NAME: "ch_16_rapid_close_fix",
        MODULE_VERSION: 1,
        install: install,
        isInstalled: function () { return installed === true; },
        getState: function () {
            return {
                installed: installed === true,
                guardDepth: Number(guardDepth),
                installCount: Number(state.installCount),
                guardedCloseCount: Number(state.guardedCloseCount),
                guardedShutdownCount:
                    Number(state.guardedShutdownCount),
                removeAttemptCount: Number(state.removeAttemptCount),
                removeSuccessCount: Number(state.removeSuccessCount),
                removeIgnoredCount: Number(state.removeIgnoredCount),
                removeFailureCount: Number(state.removeFailureCount),
                lastError: state.lastError
            };
        }
    };

    install();
}((function () { return this; }())));
