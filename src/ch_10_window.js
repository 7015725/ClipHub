// @version 1.0.0
// ClipHub - WindowManager 单实例、拖动与幂等关闭
(function (CH) {
    "use strict";

    var base = CH.base;
    var theme = CH.theme;
    var C = theme.colors;
    var D = theme.dimensions;
    var state = CH.state;
    var windowApi = {};

    function getWindowManager() {
        if (!state.windowManager) {
            state.windowManager = base.getContext().getSystemService(android.content.Context.WINDOW_SERVICE);
        }
        return state.windowManager;
    }

    function computeGeometry() {
        var metrics = base.getDisplayMetrics();
        var sideGap = base.dp(12);
        var bottomGap = base.dp(10);
        var width = Math.min(metrics.width - sideGap * 2, base.dp(520));
        var height = Math.round(metrics.height * 0.79);
        height = Math.min(height, metrics.height - base.dp(44));
        height = Math.max(height, base.dp(520));
        if (height > metrics.height - base.dp(20)) height = metrics.height - base.dp(20);
        var x = Math.round((metrics.width - width) / 2);
        var y = metrics.height - height - bottomGap;
        if (y < base.dp(8)) y = base.dp(8);
        return {
            screenWidth: metrics.width,
            screenHeight: metrics.height,
            width: width,
            height: height,
            x: x,
            y: y
        };
    }

    function clampPosition(lp, geometry) {
        if (!lp || !geometry) return;
        var maxX = Math.max(0, geometry.screenWidth - geometry.width);
        var maxY = Math.max(0, geometry.screenHeight - geometry.height);
        lp.x = Math.round(base.clamp(Number(lp.x), 0, maxX));
        lp.y = Math.round(base.clamp(Number(lp.y), 0, maxY));
    }

    function attachDrag(handle) {
        var drag = {
            downRawX: 0,
            downRawY: 0,
            startX: 0,
            startY: 0,
            dragging: false,
            slop: base.dp(5)
        };

        handle.setOnTouchListener(base.makeTouchListener(function (view, event) {
            var action = event.getActionMasked();
            if (action === android.view.MotionEvent.ACTION_DOWN) {
                drag.downRawX = event.getRawX();
                drag.downRawY = event.getRawY();
                drag.startX = state.windowParams ? Number(state.windowParams.x) : 0;
                drag.startY = state.windowParams ? Number(state.windowParams.y) : 0;
                drag.dragging = false;
                return true;
            }
            if (action === android.view.MotionEvent.ACTION_MOVE) {
                var dx = event.getRawX() - drag.downRawX;
                var dy = event.getRawY() - drag.downRawY;
                if (!drag.dragging && Math.sqrt(dx * dx + dy * dy) >= drag.slop) {
                    drag.dragging = true;
                }
                if (drag.dragging && state.windowParams && state.rootView) {
                    state.windowParams.x = Math.round(drag.startX + dx);
                    state.windowParams.y = Math.round(drag.startY + dy);
                    clampPosition(state.windowParams, state.geometry);
                    try {
                        getWindowManager().updateViewLayout(state.rootView, state.windowParams);
                    } catch (eUpdate) {
                        if (CH.log) CH.log.warn("window drag update failed: " + String(eUpdate));
                    }
                }
                return true;
            }
            if (action === android.view.MotionEvent.ACTION_UP ||
                action === android.view.MotionEvent.ACTION_CANCEL) {
                if (drag.dragging && CH.log) {
                    CH.log.event("WINDOW_MOVED", {
                        x: state.windowParams ? state.windowParams.x : 0,
                        y: state.windowParams ? state.windowParams.y : 0
                    });
                }
                drag.dragging = false;
                return true;
            }
            return true;
        }));
    }

    function buildShell() {
        var root = new android.widget.LinearLayout(base.getContext());
        root.setOrientation(android.widget.LinearLayout.VERTICAL);
        root.setTag(base.PANEL_TAG);
        root.setClipChildren(false);
        root.setClipToPadding(false);
        root.setPadding(base.dp(D.panelPaddingH), 0,
            base.dp(D.panelPaddingH), base.dp(D.panelPaddingBottom));
        root.setBackground(theme.rounded(C.panel, D.panelRadius, C.borderStrong, 1));
        theme.applyElevation(root, 16);

        var dragZone = new android.widget.FrameLayout(base.getContext());
        dragZone.setClickable(true);
        dragZone.setFocusable(true);
        dragZone.setContentDescription("拖动 ClipHub 窗口");
        var dragZoneLp = new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT, base.dp(24));
        root.addView(dragZone, dragZoneLp);

        var handle = new android.view.View(base.getContext());
        handle.setBackground(theme.rounded(C.textTertiary, 3, null, 0));
        var handleLp = new android.widget.FrameLayout.LayoutParams(
            base.dp(D.dragHandleWidth), base.dp(D.dragHandleHeight));
        handleLp.gravity = android.view.Gravity.CENTER;
        dragZone.addView(handle, handleLp);
        attachDrag(dragZone);

        var pageHost = new android.widget.FrameLayout(base.getContext());
        pageHost.setClipChildren(false);
        pageHost.setClipToPadding(false);
        var hostLp = new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT, 0, 1);
        root.addView(pageHost, hostLp);

        root.setFocusableInTouchMode(true);
        root.setOnKeyListener(new JavaAdapter(android.view.View.OnKeyListener, {
            onKey: function (view, keyCode, event) {
                if (keyCode !== android.view.KeyEvent.KEYCODE_BACK ||
                    event.getAction() !== android.view.KeyEvent.ACTION_UP) {
                    return false;
                }
                try {
                    if (CH.router && CH.router.canGoBack && CH.router.canGoBack()) {
                        CH.router.back();
                    } else {
                        windowApi.close("back_key");
                    }
                } catch (eBack) {
                    windowApi.close("back_key_error");
                }
                return true;
            }
        }));

        state.pageHost = pageHost;
        return root;
    }

    function buildLayoutParams(geometry) {
        var flags = android.view.WindowManager.LayoutParams.FLAG_DIM_BEHIND |
            android.view.WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN;
        var lp = new android.view.WindowManager.LayoutParams(
            geometry.width,
            geometry.height,
            android.view.WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            flags,
            android.graphics.PixelFormat.TRANSLUCENT
        );
        lp.gravity = android.view.Gravity.TOP | android.view.Gravity.START;
        lp.x = geometry.x;
        lp.y = geometry.y;
        lp.dimAmount = 0.46;
        lp.softInputMode = android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE |
            android.view.WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN;
        try {
            lp.setTitle("ClipHub");
        } catch (eTitle) {}
        return lp;
    }

    windowApi.isVisible = function () {
        return !!state.visible && !!state.rootView;
    };

    windowApi.show = function (reason) {
        base.runOnMain(function () {
            if (state.closing) return;
            if (windowApi.isVisible()) {
                try {
                    state.rootView.requestFocus();
                    state.rootView.bringToFront();
                } catch (eFocusExisting) {}
                return;
            }

            state.geometry = computeGeometry();
            var root = buildShell();
            var lp = buildLayoutParams(state.geometry);
            state.rootView = root;
            state.windowParams = lp;

            try {
                getWindowManager().addView(root, lp);
                state.visible = true;
                if (state.visibleFlag) state.visibleFlag.set(true);
                root.setAlpha(0);
                root.setTranslationY(base.dp(18));
                root.animate().cancel();
                root.animate().alpha(1).translationY(0).setDuration(180).start();
                try {
                    root.requestFocus();
                } catch (eFocus) {}
                if (CH.router && CH.router.reset) CH.router.reset("home");
                if (CH.log) CH.log.event("WINDOW_SHOWN", { reason: reason || "unknown" });
            } catch (eAdd) {
                state.rootView = null;
                state.pageHost = null;
                state.windowParams = null;
                state.visible = false;
                if (state.visibleFlag) state.visibleFlag.set(false);
                if (CH.log) CH.log.error("WindowManager addView failed: " + String(eAdd));
            }
        });
        return true;
    };

    windowApi.close = function (reason) {
        base.runOnMain(function () {
            if (state.closing) return;
            state.closing = true;
            var root = state.rootView;
            try {
                if (root) {
                    try {
                        root.animate().cancel();
                        root.clearAnimation();
                    } catch (eCancelAnimation) {}
                    try {
                        getWindowManager().removeViewImmediate(root);
                    } catch (eRemoveImmediate) {
                        try {
                            getWindowManager().removeView(root);
                        } catch (eRemove) {}
                    }
                }
            } finally {
                state.visible = false;
                if (state.visibleFlag) state.visibleFlag.set(false);
                state.rootView = null;
                state.pageHost = null;
                state.windowParams = null;
                state.closing = false;
                base.clearRuntimeBridge(state.bridge);
                state.bridge = null;
                if (CH.log) CH.log.event("WINDOW_CLOSED", { reason: reason || "unknown" });
            }
        });
        return true;
    };

    windowApi.toggle = function (reason) {
        if (windowApi.isVisible()) return windowApi.close(reason || "toggle");
        return windowApi.show(reason || "toggle");
    };

    windowApi.replacePage = function (pageView) {
        if (!state.pageHost || !pageView) return false;
        base.removeFromParent(pageView);
        state.pageHost.removeAllViews();
        state.pageHost.addView(pageView, new android.widget.FrameLayout.LayoutParams(
            android.widget.FrameLayout.LayoutParams.MATCH_PARENT,
            android.widget.FrameLayout.LayoutParams.MATCH_PARENT));
        return true;
    };

    function makeBridge() {
        var bridge = new java.util.HashMap();
        var visibleFlag = new java.util.concurrent.atomic.AtomicBoolean(false);
        state.visibleFlag = visibleFlag;
        bridge.put("visible", visibleFlag);
        bridge.put("version", String(CH.bootstrap.moduleSetVersion));
        bridge.put("show", base.makeRunnable(function () { windowApi.show("bridge_show"); }));
        bridge.put("close", base.makeRunnable(function () { windowApi.close("bridge_close"); }));
        bridge.put("toggle", base.makeRunnable(function () { windowApi.toggle("bridge_toggle"); }));
        return bridge;
    }

    function invokeBridge(bridge, command) {
        if (!bridge) return false;
        try {
            var runnable = bridge.get(String(command));
            if (!runnable || !runnable.run) return false;
            runnable.run();
            return true;
        } catch (eBridgeRun) {
            base.clearRuntimeBridge(bridge);
            return false;
        }
    }

    CH.app = {
        dispatch: function (commandText) {
            var command = String(commandText || "toggle").toLowerCase();
            var existing = base.getRuntimeBridge();
            if (existing) {
                var visible = false;
                try {
                    visible = !!existing.get("visible").get();
                } catch (eVisible) {}
                if (command === "status") {
                    return {
                        ok: true,
                        project: "ClipHub",
                        branch: CH.bootstrap.branch,
                        running: visible,
                        reused: true,
                        moduleSetVersion: CH.bootstrap.moduleSetVersion
                    };
                }
                if (command === "toggle") command = visible ? "close" : "show";
                if (invokeBridge(existing, command)) {
                    return {
                        ok: true,
                        project: "ClipHub",
                        branch: CH.bootstrap.branch,
                        command: command,
                        running: command !== "close",
                        reused: true,
                        moduleSetVersion: CH.bootstrap.moduleSetVersion
                    };
                }
            }

            if (command === "close" || command === "status") {
                return {
                    ok: true,
                    project: "ClipHub",
                    branch: CH.bootstrap.branch,
                    command: command,
                    running: false,
                    reused: false,
                    moduleSetVersion: CH.bootstrap.moduleSetVersion
                };
            }

            state.bridge = makeBridge();
            base.setRuntimeBridge(state.bridge);
            windowApi.show("bootstrap_" + command);
            return {
                ok: true,
                project: "ClipHub",
                branch: CH.bootstrap.branch,
                command: "show",
                running: true,
                reused: false,
                moduleSetVersion: CH.bootstrap.moduleSetVersion,
                modulesUpdated: !!(CH.bootstrap.syncResult && CH.bootstrap.syncResult.updated),
                updateFallback: !!(CH.bootstrap.syncResult && CH.bootstrap.syncResult.fallback)
            };
        }
    };

    CH.window = windowApi;
}(CH));
