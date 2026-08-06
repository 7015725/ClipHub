(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var Handler = Packages.android.os.Handler;
    var Looper = Packages.android.os.Looper;
    var System = Packages.java.lang.System;
    var ViewConfiguration = Packages.android.view.ViewConfiguration;

    var installed = false;
    var handler = null;
    var originalShowPanel = null;
    var originalShowRoot = null;
    var originalClosePanel = null;
    var originalShutdown = null;
    var monitorGeneration = 0;
    var lastBuiltWidthDp = 0;
    var lastObservedWidthDp = 0;
    var stableWidthCount = 0;
    var state = {
        installCount: 0,
        showCheckCount: 0,
        monitorTickCount: 0,
        widthChangeCount: 0,
        metricMismatchCount: 0,
        rebuildAttemptCount: 0,
        rebuildSuccessCount: 0,
        rebuildFailureCount: 0,
        lastReason: "",
        lastPanelWidthDp: 0,
        lastHeaderActionSizeDp: 0,
        lastCardActionGridWidthDp: 0,
        lastExpectedHeaderActionSizeDp: 0,
        lastError: null
    };

    function clamp(value, minimum, maximum) {
        value = Number(value);
        minimum = Number(minimum);
        maximum = Number(maximum);
        if (!isFinite(value)) { value = minimum; }
        if (maximum < minimum) { maximum = minimum; }
        return Math.max(minimum, Math.min(maximum, value));
    }

    function panelState() {
        try {
            if (ClipHub.Filter &&
                    typeof ClipHub.Filter.getPanelState === "function") {
                return ClipHub.Filter.getPanelState() || {};
            }
        } catch (error) {
            state.lastError = String(error);
        }
        return {};
    }

    function keywordValue() {
        var value = null;
        try {
            if (ClipHub.Filter && typeof ClipHub.Filter.get === "function") {
                value = ClipHub.Filter.get();
            }
        } catch (ignored) {}
        return value && value.keyword !== undefined ?
            String(value.keyword || "") : "";
    }

    function densityValue() {
        var context = global.context;
        try {
            if (ClipHub.Window &&
                    typeof ClipHub.Window.getAndroidContext === "function") {
                context = ClipHub.Window.getAndroidContext() || context;
            }
        } catch (ignoredContext) {}
        try {
            return Number(context.getResources()
                .getDisplayMetrics().density || 1);
        } catch (ignoredDensity) {
            return 1;
        }
    }

    function touchSlopDp() {
        var context = global.context;
        var density = densityValue();
        try {
            if (ClipHub.Window &&
                    typeof ClipHub.Window.getAndroidContext === "function") {
                context = ClipHub.Window.getAndroidContext() || context;
            }
        } catch (ignoredContext) {}
        try {
            return Number(ViewConfiguration.get(context)
                .getScaledTouchSlop()) / Math.max(0.1, density);
        } catch (ignoredTouch) {
            return 4;
        }
    }

    function expectedHeaderActionSizeDp(widthDp) {
        var touchDp = Math.max(1, touchSlopDp());
        var baseDp = Math.max(touchDp, Number(widthDp) * 0.018);
        return clamp(Number(widthDp) * 0.092,
            baseDp * 4.4, Number(widthDp) * 0.12);
    }

    function copyMetrics(panel) {
        var width = Number(panel.panelWidthDp || 0);
        state.lastPanelWidthDp = width;
        state.lastHeaderActionSizeDp =
            Number(panel.headerActionSizeDp || 0);
        state.lastCardActionGridWidthDp =
            Number(panel.cardActionGridWidthDp || 0);
        state.lastExpectedHeaderActionSizeDp =
            width > 0 ? expectedHeaderActionSizeDp(width) : 0;
        return width;
    }

    function metricMismatch(panel) {
        var width = copyMetrics(panel);
        var actual = Number(panel.headerActionSizeDp || 0);
        var expected = state.lastExpectedHeaderActionSizeDp;
        var grid = Number(panel.cardActionGridWidthDp || 0);
        var headerMismatch;
        var gridMismatch;
        if (width <= 0 || actual <= 0) { return false; }
        headerMismatch = Math.abs(actual - expected) > 1.25;
        gridMismatch = grid > width * 0.34 + 1;
        if (headerMismatch || gridMismatch) {
            state.metricMismatchCount += 1;
            return true;
        }
        return false;
    }

    function rebuildForWidth(reason) {
        var before = panelState();
        var result;
        var after;
        if (before.attached !== true || before.inputFocused === true ||
                !ClipHub.Filter ||
                typeof ClipHub.Filter.performSearch !== "function") {
            return false;
        }
        state.rebuildAttemptCount += 1;
        state.lastReason = String(reason || "width_changed");
        try {
            result = ClipHub.Filter.performSearch(keywordValue());
            after = panelState();
            lastBuiltWidthDp = copyMetrics(after);
            lastObservedWidthDp = lastBuiltWidthDp;
            stableWidthCount = 0;
            if (result === true) {
                state.rebuildSuccessCount += 1;
                state.lastError = null;
                return true;
            }
            state.rebuildFailureCount += 1;
            state.lastError = "Adaptive width rebuild returned false";
            return false;
        } catch (error) {
            state.rebuildFailureCount += 1;
            state.lastError = String(error);
            return false;
        }
    }

    function scheduleShowCheck(generation, attempt) {
        if (handler === null) { return false; }
        handler.postDelayed(new Packages.java.lang.Runnable({
            run: function () {
                var panel;
                var width;
                if (generation !== monitorGeneration) { return; }
                panel = panelState();
                if (panel.attached !== true) { return; }
                if (panel.contentReady !== true && attempt < 20) {
                    scheduleShowCheck(generation, attempt + 1);
                    return;
                }
                state.showCheckCount += 1;
                width = copyMetrics(panel);
                if (metricMismatch(panel)) {
                    rebuildForWidth("show_metric_mismatch");
                } else if (lastBuiltWidthDp > 0 && width > 0 &&
                        Math.abs(width - lastBuiltWidthDp) >= 2) {
                    state.widthChangeCount += 1;
                    rebuildForWidth("show_width_changed");
                } else if (width > 0) {
                    lastBuiltWidthDp = width;
                    lastObservedWidthDp = width;
                }
                scheduleMonitor(generation);
            }
        }), attempt === 0 ? 90 : 45);
        return true;
    }

    function scheduleMonitor(generation) {
        if (handler === null) { return false; }
        handler.postDelayed(new Packages.java.lang.Runnable({
            run: function () {
                var panel;
                var width;
                if (generation !== monitorGeneration) { return; }
                panel = panelState();
                if (panel.attached !== true) { return; }
                state.monitorTickCount += 1;
                width = copyMetrics(panel);
                if (width > 0 && lastObservedWidthDp > 0 &&
                        Math.abs(width - lastObservedWidthDp) < 0.75) {
                    stableWidthCount += 1;
                } else {
                    stableWidthCount = 0;
                }
                if (width > 0 && lastObservedWidthDp > 0 &&
                        Math.abs(width - lastObservedWidthDp) >= 0.75) {
                    state.widthChangeCount += 1;
                }
                lastObservedWidthDp = width;
                if (width > 0 && lastBuiltWidthDp > 0 &&
                        Math.abs(width - lastBuiltWidthDp) >= 2 &&
                        stableWidthCount >= 2) {
                    rebuildForWidth("settled_geometry_width_changed");
                } else if (metricMismatch(panel) && stableWidthCount >= 1) {
                    rebuildForWidth("settled_metric_mismatch");
                }
                scheduleMonitor(generation);
            }
        }), 120);
        return true;
    }

    function afterShow() {
        monitorGeneration += 1;
        stableWidthCount = 0;
        scheduleShowCheck(monitorGeneration, 0);
    }

    function install() {
        if (installed) { return true; }
        if (!ClipHub.Filter ||
                typeof ClipHub.Filter.showPanel !== "function" ||
                typeof ClipHub.Filter.showRoot !== "function" ||
                typeof ClipHub.Filter.closePanel !== "function") {
            throw new Error("ClipHub adaptive-width dependencies unavailable");
        }
        handler = new Handler(Looper.getMainLooper());
        originalShowPanel = ClipHub.Filter.showPanel;
        originalShowRoot = ClipHub.Filter.showRoot;
        originalClosePanel = ClipHub.Filter.closePanel;
        originalShutdown = typeof ClipHub.Filter.shutdown === "function" ?
            ClipHub.Filter.shutdown : null;

        ClipHub.Filter.showPanel = function (options) {
            var result = originalShowPanel(options);
            afterShow();
            return result;
        };
        ClipHub.Filter.showRoot = function (options) {
            var result = originalShowRoot(options);
            afterShow();
            return result;
        };
        ClipHub.Filter.closePanel = function (options) {
            monitorGeneration += 1;
            stableWidthCount = 0;
            return originalClosePanel(options);
        };
        if (originalShutdown !== null) {
            ClipHub.Filter.shutdown = function () {
                monitorGeneration += 1;
                stableWidthCount = 0;
                return originalShutdown();
            };
        }
        installed = true;
        state.installCount += 1;
        state.lastError = null;
        return true;
    }

    ClipHub.AdaptiveWidthFix = {
        MODULE_NAME: "ch_17_adaptive_width_fix",
        MODULE_VERSION: 1,
        install: install,
        isInstalled: function () { return installed === true; },
        getState: function () {
            return {
                installed: installed === true,
                installCount: Number(state.installCount),
                showCheckCount: Number(state.showCheckCount),
                monitorTickCount: Number(state.monitorTickCount),
                widthChangeCount: Number(state.widthChangeCount),
                metricMismatchCount: Number(state.metricMismatchCount),
                rebuildAttemptCount: Number(state.rebuildAttemptCount),
                rebuildSuccessCount: Number(state.rebuildSuccessCount),
                rebuildFailureCount: Number(state.rebuildFailureCount),
                lastBuiltWidthDp: Number(lastBuiltWidthDp),
                lastObservedWidthDp: Number(lastObservedWidthDp),
                lastReason: state.lastReason,
                lastPanelWidthDp: Number(state.lastPanelWidthDp),
                lastHeaderActionSizeDp:
                    Number(state.lastHeaderActionSizeDp),
                lastExpectedHeaderActionSizeDp:
                    Number(state.lastExpectedHeaderActionSizeDp),
                lastCardActionGridWidthDp:
                    Number(state.lastCardActionGridWidthDp),
                lastError: state.lastError,
                checkedAt: Number(System.currentTimeMillis())
            };
        }
    };

    install();
}((function () { return this; }())));
