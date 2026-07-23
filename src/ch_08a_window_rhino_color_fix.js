(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var Build = Packages.android.os.Build;
    var View = Packages.android.view.View;
    var Gravity = Packages.android.view.Gravity;
    var FrameLayout = Packages.android.widget.FrameLayout;
    var Paint = Packages.android.graphics.Paint;
    var Color = Packages.android.graphics.Color;
    var PixelFormat = Packages.android.graphics.PixelFormat;
    var Drawable = Packages.android.graphics.drawable.Drawable;

    var appContext = global.context;
    var density = 1;

    if (appContext !== null && appContext !== undefined) {
        try {
            appContext = appContext.getApplicationContext() || appContext;
            density = Number(appContext.getResources()
                .getDisplayMetrics().density || 1);
        } catch (ignoredContext) {}
    }

    function dp(value) {
        return Math.max(1, Math.floor(Number(value) * density + 0.5));
    }

    function clamp(value, minimum, maximum) {
        value = Number(value);
        if (!isFinite(value)) { value = minimum; }
        return Math.max(Number(minimum), Math.min(Number(maximum), value));
    }

    function parseColor(value, fallback) {
        try { return Color.parseColor(String(value)); }
        catch (ignored) {
            try { return Color.parseColor(String(fallback)); }
            catch (ignoredFallback) { return Color.WHITE; }
        }
    }

    function applyPaintColor(paint, colorValue) {
        paint.setARGB(
            Number(Color.alpha(colorValue)),
            Number(Color.red(colorValue)),
            Number(Color.green(colorValue)),
            Number(Color.blue(colorValue))
        );
    }

    function createResizeVisual(colorText) {
        var visual = { active: false, alpha: 1 };
        var paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        var colorValue = parseColor(colorText, "#7C5CFC");
        var drawable;
        var view;

        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeCap(Paint.Cap.ROUND);
        applyPaintColor(paint, colorValue);

        drawable = new JavaAdapter(Drawable, {
            draw: function (canvas) {
                var width = Number(canvas.getWidth());
                var height = Number(canvas.getHeight());
                var right = width - dp(6);
                var bottom = height - dp(6);
                var index;
                var length;
                var offset;

                paint.setStrokeWidth(dp(visual.active ? 2.2 : 1.5));
                paint.setAlpha(Math.floor((visual.active ? 205 : 78) *
                    Number(visual.alpha || 1)));
                for (index = 0; index < 3; index += 1) {
                    length = dp(7 + index * 5);
                    offset = dp(index * 4);
                    canvas.drawLine(right - length, bottom - offset,
                        right - offset, bottom - length, paint);
                }
            },
            setAlpha: function (alpha) {
                visual.alpha = clamp(Number(alpha) / 255, 0, 1);
            },
            setColorFilter: function (filter) {
                paint.setColorFilter(filter);
            },
            getOpacity: function () {
                return PixelFormat.TRANSLUCENT;
            }
        });

        view = new View(appContext);
        view.setBackground(drawable);
        view.setClickable(true);
        view.setFocusable(true);
        view.setContentDescription("长按并拖动调整窗口大小");
        return {
            view: view,
            setActive: function (active) {
                visual.active = active === true;
                try { view.invalidate(); } catch (ignoredInvalidate) {}
            }
        };
    }

    function createManagedFrame(contentView, options) {
        var root;
        var contentParams;
        var dragView;
        var dragParams;
        var resizeVisual;
        var resizeParams;

        options = options || {};
        if (contentView === null || contentView === undefined) {
            throw new Error("Managed window content view is required");
        }
        if (appContext === null || appContext === undefined) {
            throw new Error("Android context unavailable for Rhino window fix");
        }

        root = new FrameLayout(appContext);
        root.setClipChildren(false);
        root.setClipToPadding(false);
        contentParams = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT);
        root.addView(contentView, contentParams);

        if (Build.VERSION.SDK_INT >= 21) {
            try { contentView.setElevation(0); } catch (ignoredElevation) {}
            try { contentView.setClipToOutline(true); } catch (ignoredClip) {}
        }

        dragView = new View(appContext);
        dragView.setClickable(true);
        dragView.setFocusable(true);
        dragView.setContentDescription("长按并拖动移动窗口");
        dragParams = new FrameLayout.LayoutParams(dp(86), dp(24));
        dragParams.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        root.addView(dragView, dragParams);

        resizeVisual = createResizeVisual(
            options.accentColor || "#7C5CFC");
        resizeParams = new FrameLayout.LayoutParams(dp(40), dp(40));
        resizeParams.gravity = Gravity.END | Gravity.BOTTOM;
        root.addView(resizeVisual.view, resizeParams);

        return {
            rootView: root,
            contentView: contentView,
            dragView: dragView,
            resizeView: resizeVisual.view,
            resizeVisual: resizeVisual
        };
    }

    if (!ClipHub.Window ||
            typeof ClipHub.Window.createManagedFrame !== "function") {
        throw new Error("ClipHub window module unavailable for Rhino fix");
    }

    ClipHub.Window.createManagedFrame = createManagedFrame;
    ClipHub.Window.RHINO_COLOR_OVERLOAD_FIX_VERSION = 1;

    ClipHub.WindowRhinoColorFix = {
        MODULE_NAME: "ch_08a_window_rhino_color_fix",
        MODULE_VERSION: 1,
        applied: true,
        strategy: "paint_set_argb_unique_overload"
    };
}((function () { return this; }())));
