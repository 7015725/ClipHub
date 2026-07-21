// @version 1.0.0
// ClipHub - 基础环境与线程边界
(function (CH) {
    "use strict";

    var base = {};
    var appContext = null;
    var mainHandler = null;

    base.VERSION = "1.0.0";
    base.RUNTIME_KEY = "cliphub.runtime.beta.v1";
    base.PANEL_TAG = "ClipHubRootPanel";

    base.getContext = function () {
        if (appContext) return appContext;
        try {
            if (typeof context !== "undefined" && context) {
                appContext = context;
            }
        } catch (eContext) {}
        if (!appContext) {
            try {
                if (typeof shortx !== "undefined" && shortx &&
                    typeof shortx.getContext === "function") {
                    appContext = shortx.getContext();
                }
            } catch (eShortXContext) {}
        }
        if (!appContext) {
            throw new Error("无法取得 Android Context");
        }
        try {
            var applicationContext = appContext.getApplicationContext();
            if (applicationContext) appContext = applicationContext;
        } catch (eApplicationContext) {}
        return appContext;
    };

    base.getMainHandler = function () {
        if (!mainHandler) {
            mainHandler = new android.os.Handler(android.os.Looper.getMainLooper());
        }
        return mainHandler;
    };

    base.isMainThread = function () {
        try {
            return android.os.Looper.myLooper() === android.os.Looper.getMainLooper();
        } catch (eLooper) {
            return false;
        }
    };

    base.runOnMain = function (fn) {
        if (typeof fn !== "function") return;
        if (base.isMainThread()) {
            fn();
            return;
        }
        base.getMainHandler().post(new JavaAdapter(java.lang.Runnable, {
            run: function () {
                fn();
            }
        }));
    };

    base.runOnMainSync = function (fn, timeoutMs) {
        if (typeof fn !== "function") return null;
        if (base.isMainThread()) return fn();
        var latch = new java.util.concurrent.CountDownLatch(1);
        var box = { value: null, error: null };
        base.getMainHandler().post(new JavaAdapter(java.lang.Runnable, {
            run: function () {
                try {
                    box.value = fn();
                } catch (eRun) {
                    box.error = eRun;
                } finally {
                    latch.countDown();
                }
            }
        }));
        var waitMs = Number(timeoutMs || 8000);
        if (waitMs < 500) waitMs = 500;
        var completed = latch.await(waitMs, java.util.concurrent.TimeUnit.MILLISECONDS);
        if (!completed) throw new Error("等待 Android 主线程超时");
        if (box.error) throw box.error;
        return box.value;
    };

    base.dp = function (value) {
        var metrics = base.getContext().getResources().getDisplayMetrics();
        return Math.round(Number(value || 0) * Number(metrics.density || 1));
    };

    base.sp = function (value) {
        var metrics = base.getContext().getResources().getDisplayMetrics();
        return Math.round(Number(value || 0) * Number(metrics.scaledDensity || metrics.density || 1));
    };

    base.getDisplayMetrics = function () {
        var contextValue = base.getContext();
        var wm = contextValue.getSystemService(android.content.Context.WINDOW_SERVICE);
        var width = 0;
        var height = 0;
        var density = 1;
        var scaledDensity = 1;
        var metrics = contextValue.getResources().getDisplayMetrics();
        density = Number(metrics.density || 1);
        scaledDensity = Number(metrics.scaledDensity || density);

        try {
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                var bounds = wm.getCurrentWindowMetrics().getBounds();
                width = bounds.width();
                height = bounds.height();
            }
        } catch (eCurrentMetrics) {}

        if (width <= 0 || height <= 0) {
            try {
                var displayMetrics = new android.util.DisplayMetrics();
                wm.getDefaultDisplay().getRealMetrics(displayMetrics);
                width = displayMetrics.widthPixels;
                height = displayMetrics.heightPixels;
            } catch (eRealMetrics) {
                width = metrics.widthPixels;
                height = metrics.heightPixels;
            }
        }

        return {
            width: Number(width),
            height: Number(height),
            density: density,
            scaledDensity: scaledDensity,
            fontScale: scaledDensity / density
        };
    };

    base.clamp = function (value, minValue, maxValue) {
        var numberValue = Number(value);
        if (numberValue < minValue) return minValue;
        if (numberValue > maxValue) return maxValue;
        return numberValue;
    };

    base.now = function () {
        return Number(java.lang.System.currentTimeMillis());
    };

    base.string = function (value, fallback) {
        if (value == null) return String(fallback == null ? "" : fallback);
        try {
            return String(value);
        } catch (eString) {
            return String(fallback == null ? "" : fallback);
        }
    };

    base.safe = function (label, fn, fallback) {
        try {
            return fn();
        } catch (eSafe) {
            try {
                if (CH.log && CH.log.error) {
                    CH.log.error(String(label || "operation") + " failed: " + String(eSafe));
                }
            } catch (eLog) {}
            return fallback;
        }
    };

    base.setMargins = function (layoutParams, left, top, right, bottom) {
        if (!layoutParams || typeof layoutParams.setMargins !== "function") return layoutParams;
        layoutParams.setMargins(base.dp(left), base.dp(top), base.dp(right), base.dp(bottom));
        return layoutParams;
    };

    base.makeRunnable = function (fn) {
        return new JavaAdapter(java.lang.Runnable, {
            run: function () {
                if (typeof fn === "function") fn();
            }
        });
    };

    base.makeClickListener = function (fn) {
        return new JavaAdapter(android.view.View.OnClickListener, {
            onClick: function (view) {
                if (typeof fn === "function") fn(view);
            }
        });
    };

    base.makeLongClickListener = function (fn) {
        return new JavaAdapter(android.view.View.OnLongClickListener, {
            onLongClick: function (view) {
                if (typeof fn === "function") return !!fn(view);
                return false;
            }
        });
    };

    base.makeTouchListener = function (fn) {
        return new JavaAdapter(android.view.View.OnTouchListener, {
            onTouch: function (view, event) {
                if (typeof fn === "function") return !!fn(view, event);
                return false;
            }
        });
    };

    base.removeFromParent = function (view) {
        if (!view) return;
        try {
            var parent = view.getParent();
            if (parent && parent.removeView) parent.removeView(view);
        } catch (eParent) {}
    };

    base.getRootDir = function () {
        return String(CH.bootstrap && CH.bootstrap.rootDir || "");
    };

    base.ensureChildDir = function (name) {
        var root = new java.io.File(base.getRootDir());
        var child = new java.io.File(root, String(name || ""));
        if (!child.exists() && !child.mkdirs() && !child.isDirectory()) {
            throw new Error("无法创建目录: " + child.getAbsolutePath());
        }
        return child;
    };

    base.getProcessRegistry = function () {
        return java.lang.System.getProperties();
    };

    base.getRuntimeBridge = function () {
        try {
            return base.getProcessRegistry().get(base.RUNTIME_KEY);
        } catch (eGetBridge) {
            return null;
        }
    };

    base.setRuntimeBridge = function (bridge) {
        try {
            base.getProcessRegistry().put(base.RUNTIME_KEY, bridge);
            return true;
        } catch (eSetBridge) {
            return false;
        }
    };

    base.clearRuntimeBridge = function (expectedBridge) {
        try {
            var registry = base.getProcessRegistry();
            var current = registry.get(base.RUNTIME_KEY);
            if (!expectedBridge || current === expectedBridge || current == expectedBridge) {
                registry.remove(base.RUNTIME_KEY);
            }
        } catch (eClearBridge) {}
    };

    CH.base = base;
    CH.state = CH.state || {
        startedAt: base.now(),
        closing: false,
        visible: false,
        rootView: null,
        windowManager: null,
        windowParams: null,
        pageHost: null,
        bridge: null,
        currentRoute: "home",
        selectedCount: 1,
        demoMode: true
    };
}(CH));
