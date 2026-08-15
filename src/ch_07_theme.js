(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var Configuration = Packages.android.content.res.Configuration;
    var ColorStateList = Packages.android.content.res.ColorStateList;
    var Color = Packages.android.graphics.Color;
    var GradientDrawable = Packages.android.graphics.drawable.GradientDrawable;
    var JavaArray = Packages.java.lang.reflect.Array;
    var JavaClass = Packages.java.lang.Class;
    var JavaInteger = Packages.java.lang.Integer;
    var mode = "system";

    var LIGHT = {
        dark: false,
        accent: "#FF6D4AFF",
        accentStrong: "#FF5A37E6",
        accentSoft: "#FFF0ECFF",
        accentSoftStrong: "#FFE7DFFF",
        accentBorder: "#FFBBAAF8",
        scrim: "#70000000",
        sheet: "#FFF9F8FF",
        surface: "#FFFFFFFF",
        surfaceMuted: "#FFF5F3FB",
        surfaceRaised: "#FFFFFFFF",
        card: "#FFFFFFFF",
        cardSelected: "#FFF8F5FF",
        stroke: "#FFE5E0EF",
        strokeStrong: "#FFD3C8E8",
        divider: "#FFE9E4F0",
        textPrimary: "#FF1F1C28",
        textSecondary: "#FF6F697A",
        textTertiary: "#FF9992A3",
        icon: "#FF3D3748",
        danger: "#FFD84A5B",
        dangerSoft: "#FFFFECEF",
        success: "#FF2D9B62",
        successSoft: "#FFE8F7EF",
        warning: "#FFC57A12",
        warningSoft: "#FFFFF3DF",
        blue: "#FF3C7BEA",
        blueSoft: "#FFEAF2FF",
        cyan: "#FF159DB5",
        cyanSoft: "#FFE6F8FB",
        green: "#FF35A568",
        greenSoft: "#FFEAF7EF",
        orange: "#FFE48A25",
        orangeSoft: "#FFFFF1E1",
        purple: "#FF7B58E8",
        purpleSoft: "#FFF0EAFF",
        toolbar: "#FFF0EBFF",
        toolbarPressed: "#FFE4DAFF"
    };

    var DARK = {
        dark: true,
        accent: "#FFA992FF",
        accentStrong: "#FF9476F8",
        accentSoft: "#FF302946",
        accentSoftStrong: "#FF3A3154",
        accentBorder: "#FF6F5A9D",
        scrim: "#98000000",
        sheet: "#FF17151E",
        surface: "#FF211E2A",
        surfaceMuted: "#FF292532",
        surfaceRaised: "#FF25212F",
        card: "#FF24202D",
        cardSelected: "#FF30283F",
        stroke: "#FF3D3748",
        strokeStrong: "#FF665784",
        divider: "#FF37313F",
        textPrimary: "#FFF7F3FF",
        textSecondary: "#FFC8C0D1",
        textTertiary: "#FF968DA1",
        icon: "#FFE7DFF1",
        danger: "#FFFF8794",
        dangerSoft: "#FF3E252B",
        success: "#FF6DD09A",
        successSoft: "#FF20382C",
        warning: "#FFFFBC63",
        warningSoft: "#FF40321F",
        blue: "#FF77A7FF",
        blueSoft: "#FF24354F",
        cyan: "#FF5FCBDD",
        cyanSoft: "#FF203A3F",
        green: "#FF70D59D",
        greenSoft: "#FF223A2E",
        orange: "#FFFFB766",
        orangeSoft: "#FF43301F",
        purple: "#FFB099FF",
        purpleSoft: "#FF352B4D",
        toolbar: "#FF2C263A",
        toolbarPressed: "#FF3A3150"
    };

    var METRICS = {
        sheetRadiusDp: 26,
        cardRadiusDp: 15,
        controlRadiusDp: 13,
        chipRadiusDp: 8,
        titleSizeSp: 18,
        bodySizeSp: 13,
        secondarySizeSp: 11,
        captionSizeSp: 10,
        screenPaddingDp: 12,
        sectionGapDp: 10,
        cardGapDp: 8,
        toolbarHeightDp: 66,
        dragHandleWidthDp: 42,
        dragHandleHeightDp: 4,
        dragHandleTopDp: 8,
        dragHandleBottomDp: 7,
        headerHeightDp: 44,
        searchHeightDp: 44,
        minTouchDp: 40,
        pageRadiusDp: 24,
        pagePaddingTopDp: 8,
        pagePaddingBottomDp: 10,
        sectionPaddingHorizontalDp: 11,
        sectionPaddingVerticalDp: 10,
        headerTopOffsetDp: -2,
        headerBottomGapDp: 8,
        tabMinHeightDp: 38,
        tabBottomGapDp: 8
    };


    function colorInt(value, fallback) {
        var source = value;
        var text;
        var number;
        if (source === null || source === undefined || source === "") {
            source = fallback;
        }
        if (typeof source === "string") {
            text = String(source).replace(/^\s+|\s+$/g, "");
            if (text.length > 0) {
                try { return Number(Color.parseColor(text)) | 0; }
                catch (ignoredParse) {}
            }
        }
        number = Number(source);
        if (!isFinite(number)) {
            try { number = Number(Color.parseColor(String(fallback || "#00000000"))); }
            catch (ignoredFallback) { number = 0; }
        }
        return number | 0;
    }

    function jintArray(values) {
        var source = values || [];
        var output = JavaArray.newInstance(JavaInteger.TYPE, source.length);
        var index;
        for (index = 0; index < source.length; index += 1) {
            output[index] = colorInt(source[index], 0);
        }
        return output;
    }

    function jint2Array(rows) {
        var source = rows || [];
        var output = JavaArray.newInstance(JavaClass.forName("[I"), source.length);
        var index;
        for (index = 0; index < source.length; index += 1) {
            output[index] = jintArray(source[index]);
        }
        return output;
    }

    var colorSafetyState = {
        applyCount: 0,
        failureCount: 0,
        lastError: null
    };

    function safeColorStateList(colorValue) {
        var color = colorInt(colorValue, 0);
        return new ColorStateList(jint2Array([
            [Packages.android.R.attr.state_pressed],
            [Packages.android.R.attr.state_focused],
            [Packages.android.R.attr.state_selected],
            []
        ]), jintArray([color, color, color, color]));
    }

    function safeApply(callback) {
        try {
            callback();
            colorSafetyState.applyCount += 1;
            colorSafetyState.lastError = null;
            return true;
        } catch (error) {
            colorSafetyState.failureCount += 1;
            colorSafetyState.lastError = String(error);
            return false;
        }
    }

    function safeSetTextColor(viewObj, colorValue) {
        if (viewObj === null || viewObj === undefined) { return false; }
        return safeApply(function () {
            viewObj.setTextColor(safeColorStateList(colorValue));
        });
    }

    function safeSetHintTextColor(viewObj, colorValue) {
        if (viewObj === null || viewObj === undefined) { return false; }
        return safeApply(function () {
            viewObj.setHintTextColor(safeColorStateList(colorValue));
        });
    }

    function safeSetLinkTextColor(viewObj, colorValue) {
        if (viewObj === null || viewObj === undefined) { return false; }
        return safeApply(function () {
            viewObj.setLinkTextColor(safeColorStateList(colorValue));
        });
    }

    function safeSetGradientColor(drawableObj, colorValue) {
        if (drawableObj === null || drawableObj === undefined) { return false; }
        return safeApply(function () {
            drawableObj.setColor(safeColorStateList(colorValue));
        });
    }

    function safeSetGradientStroke(drawableObj, widthPx, colorValue) {
        if (drawableObj === null || drawableObj === undefined) { return false; }
        return safeApply(function () {
            drawableObj.setStroke(
                Math.max(0, Math.round(Number(widthPx) || 0)),
                safeColorStateList(colorValue)
            );
        });
    }

    function safeSetBackgroundColor(viewObj, colorValue) {
        if (viewObj === null || viewObj === undefined) { return false; }
        return safeApply(function () {
            var background = new GradientDrawable();
            background.setShape(GradientDrawable.RECTANGLE);
            background.setColor(safeColorStateList(colorValue));
            viewObj.setBackground(background);
        });
    }

    function safeSetTintColor(drawableObj, colorValue) {
        if (drawableObj === null || drawableObj === undefined) { return false; }
        return safeApply(function () {
            drawableObj.setTintList(safeColorStateList(colorValue));
        });
    }

    function safeSetPaintColor(paintObj, colorValue) {
        if (paintObj === null || paintObj === undefined) { return false; }
        return safeApply(function () {
            var color = colorInt(colorValue, 0);
            paintObj.setARGB(
                (color >>> 24) & 255,
                (color >>> 16) & 255,
                (color >>> 8) & 255,
                color & 255
            );
        });
    }

    function getColorSafetyState() {
        return {
            applyCount: Number(colorSafetyState.applyCount),
            failureCount: Number(colorSafetyState.failureCount),
            lastError: colorSafetyState.lastError
        };
    }

    function copy(value) {
        var out = {};
        var key;
        for (key in value) {
            if (value.hasOwnProperty(key)) { out[key] = value[key]; }
        }
        return out;
    }

    function clampNumber(value, minValue, maxValue) {
        return Math.max(minValue, Math.min(maxValue, value));
    }

    function getLayoutMetrics(widthDp, fontScale, touchSlopDp) {
        var width = Number(widthDp || 0);
        var scale = Number(fontScale || 1);
        var touch = Number(touchSlopDp || 1);
        var baseDp;
        var actionSizeDp;
        var controlHeightDp;
        var gapDp;
        var titleSp;
        var iconSp;
        var statusSp;
        var searchSp;
        var radiusDp;
        var inputPaddingDp;
        var badgeSizeDp;
        var badgeSp;
        if (!isFinite(width) || width <= 0) { width = 390; }
        if (!isFinite(scale) || scale <= 0) { scale = 1; }
        if (!isFinite(touch) || touch <= 0) { touch = 1; }
        baseDp = Math.max(touch, width * 0.018);
        actionSizeDp = clampNumber(width * 0.092,
            baseDp * 4.4, width * 0.12);
        controlHeightDp = clampNumber(actionSizeDp * 1.02,
            baseDp * 4.6, width * 0.125);
        gapDp = clampNumber(width * 0.014,
            baseDp * 0.65, actionSizeDp * 0.24);
        titleSp = clampNumber(width / (scale * 23),
            actionSizeDp / (scale * 2.45),
            actionSizeDp / (scale * 1.85));
        iconSp = clampNumber(actionSizeDp / (scale * 2.05),
            titleSp * 0.86, titleSp * 1.18);
        statusSp = clampNumber(titleSp * 0.60,
            iconSp * 0.58, titleSp * 0.72);
        searchSp = clampNumber(titleSp * 0.70,
            statusSp, titleSp * 0.82);
        radiusDp = Math.max(baseDp * 1.3, controlHeightDp * 0.44);
        inputPaddingDp = Math.max(baseDp * 0.65, gapDp);
        badgeSizeDp = Math.max(baseDp * 2.0, actionSizeDp * 0.38);
        badgeSp = Math.max(statusSp * 0.64,
            badgeSizeDp / (scale * 3.4));
        return {
            widthDp: width,
            fontScale: scale,
            baseDp: baseDp,
            actionSizeDp: actionSizeDp,
            controlHeightDp: controlHeightDp,
            gapDp: gapDp,
            titleSp: titleSp,
            iconSp: iconSp,
            statusSp: statusSp,
            searchSp: searchSp,
            radiusDp: radiusDp,
            inputPaddingDp: inputPaddingDp,
            badgeSizeDp: badgeSizeDp,
            badgeSp: badgeSp
        };
    }

    function getPanelChromeMetrics(widthDp, fontScale, touchSlopDp) {
        var adaptive = getLayoutMetrics(widthDp, fontScale, touchSlopDp);
        var metrics = copy(METRICS);
        var key;
        for (key in adaptive) {
            if (adaptive.hasOwnProperty(key)) { metrics[key] = adaptive[key]; }
        }
        /* panel_chrome_home_baseline_v1 */
        metrics.dragHandleSlotDp = 12;
        metrics.dragHandleTopDp = 6;
        metrics.dragHandleBottomDp = 2;
        metrics.headerHeightDp = adaptive.actionSizeDp;
        metrics.headerTopOffsetDp = 0;
        metrics.headerBottomGapDp = adaptive.gapDp;
        return metrics;
    }


    /* panel_icon_system_v1: font-independent semantic icons on a 24x24 logical grid. */
    var PANEL_ICON_TOKENS = {
        "+": "add",
        "＋": "add",
        "×": "close",
        "✕": "close",
        "✖": "close",
        "‹": "back",
        "←": "back",
        "›": "forward",
        "→": "forward",
        "✓": "check",
        "✔": "check",
        "⚙": "settings",
        "🔍": "search",
        "⌕": "search",
        "☰": "list",
        "⋮": "more_vertical",
        "✎": "edit",
        "✏": "edit",
        "🗑": "delete",
        "📋": "copy",
        "⧉": "copy",
        "▣": "copy",
        "?": "help",
        "↵": "input",
        "⇩": "download",
        "▲": "up",
        "▼": "down",
        "📌": "pin",
        "⚑": "pin",
        "⚐": "pin",
        "🌐": "globe",
        "◎": "globe",
        "⊙": "globe",
        "⌗": "rules"
    };

    function panelIconName(value) {
        var key = String(value === null || value === undefined ? "" : value);
        return PANEL_ICON_TOKENS.hasOwnProperty(key) ? PANEL_ICON_TOKENS[key] : null;
    }

    function isPanelIconToken(value) {
        return panelIconName(value) !== null;
    }

    function makePanelIconDrawable(context, value, colorValue, sizeDp) {
        var name = panelIconName(value);
        var Bitmap = Packages.android.graphics.Bitmap;
        var Canvas = Packages.android.graphics.Canvas;
        var Paint = Packages.android.graphics.Paint;
        var Path = Packages.android.graphics.Path;
        var RectF = Packages.android.graphics.RectF;
        var BitmapDrawable = Packages.android.graphics.drawable.BitmapDrawable;
        var density = 1;
        var logicalSize = Number(sizeDp || 18);
        var px;
        var scale;
        var bitmap;
        var canvas;
        var stroke;
        var fill;
        var path;
        var drawable;
        var i;
        var angle;
        var x1;
        var y1;
        var x2;
        var y2;
        function v(number) { return Number(number) * scale; }
        function line(ax, ay, bx, by) {
            canvas.drawLine(v(ax), v(ay), v(bx), v(by), stroke);
        }
        function circle(cx, cy, radius, paintObj) {
            canvas.drawCircle(v(cx), v(cy), v(radius), paintObj || stroke);
        }
        function rect(left, top, right, bottom, radius, paintObj) {
            canvas.drawRoundRect(new RectF(v(left), v(top), v(right), v(bottom)),
                v(radius || 0), v(radius || 0), paintObj || stroke);
        }
        if (name === null || context === null || context === undefined) { return null; }
        try { density = Number(context.getResources().getDisplayMetrics().density || 1); }
        catch (ignoredIconDensity) { density = 1; }
        if (!isFinite(density) || density <= 0) { density = 1; }
        if (!isFinite(logicalSize)) { logicalSize = 18; }
        logicalSize = clampNumber(logicalSize, 14, 22);
        px = Math.max(1, Math.round(logicalSize * density));
        scale = px / 24;
        bitmap = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888);
        canvas = new Canvas(bitmap);
        stroke = new Paint();
        stroke.setAntiAlias(true);
        stroke.setStyle(Paint.Style.STROKE);
        stroke.setStrokeWidth(Math.max(1, v(2.05)));
        stroke.setStrokeCap(Paint.Cap.ROUND);
        stroke.setStrokeJoin(Paint.Join.ROUND);
        safeSetPaintColor(stroke, colorValue);
        fill = new Paint();
        fill.setAntiAlias(true);
        fill.setStyle(Paint.Style.FILL);
        safeSetPaintColor(fill, colorValue);

        if (name === "add") {
            line(12, 5, 12, 19); line(5, 12, 19, 12);
        } else if (name === "close") {
            line(6.5, 6.5, 17.5, 17.5); line(17.5, 6.5, 6.5, 17.5);
        } else if (name === "back") {
            line(15.5, 5.5, 9, 12); line(9, 12, 15.5, 18.5);
        } else if (name === "forward") {
            line(8.5, 5.5, 15, 12); line(15, 12, 8.5, 18.5);
        } else if (name === "check") {
            line(5.5, 12.5, 10, 17); line(10, 17, 18.5, 7.5);
        } else if (name === "search") {
            circle(10.5, 10.5, 5.5); line(14.7, 14.7, 19, 19);
        } else if (name === "settings") {
            circle(12, 12, 3.2);
            for (i = 0; i < 8; i += 1) {
                angle = Math.PI * i / 4;
                x1 = 12 + Math.cos(angle) * 6.0;
                y1 = 12 + Math.sin(angle) * 6.0;
                x2 = 12 + Math.cos(angle) * 8.2;
                y2 = 12 + Math.sin(angle) * 8.2;
                line(x1, y1, x2, y2);
            }
        } else if (name === "list") {
            for (i = 0; i < 3; i += 1) {
                circle(5.5, 7 + i * 5, 0.9, fill);
                line(9, 7 + i * 5, 19, 7 + i * 5);
            }
        } else if (name === "more_vertical") {
            circle(12, 6.5, 1.3, fill); circle(12, 12, 1.3, fill); circle(12, 17.5, 1.3, fill);
        } else if (name === "edit") {
            path = new Path();
            path.moveTo(v(6.5), v(17.5));
            path.lineTo(v(8), v(13.5));
            path.lineTo(v(15.5), v(6));
            path.lineTo(v(18), v(8.5));
            path.lineTo(v(10.5), v(16));
            path.close();
            canvas.drawPath(path, stroke);
            line(6.5, 17.5, 10.5, 16);
        } else if (name === "copy") {
            rect(8, 8, 18.5, 18.5, 1.8); rect(5.5, 5.5, 16, 16, 1.8);
        } else if (name === "delete") {
            rect(7.5, 8.5, 16.5, 19, 1.2);
            line(6, 6.5, 18, 6.5); line(9.5, 5, 14.5, 5);
            line(10.5, 10.5, 10.5, 16.8); line(13.5, 10.5, 13.5, 16.8);
        } else if (name === "help") {
            path = new Path();
            path.moveTo(v(8), v(8.3));
            path.cubicTo(v(8.5), v(4.8), v(15.8), v(4.8), v(16), v(9));
            path.cubicTo(v(16.1), v(12.2), v(12), v(12.4), v(12), v(15));
            canvas.drawPath(path, stroke);
            circle(12, 19, 1.0, fill);
        } else if (name === "pin") {
            line(8, 6, 16, 6); line(9.2, 6, 10, 11.5); line(14.8, 6, 14, 11.5);
            line(7, 11.5, 17, 11.5); line(12, 11.5, 12, 19);
        } else if (name === "globe") {
            circle(12, 12, 8);
            canvas.drawOval(new RectF(v(8.5), v(4), v(15.5), v(20)), stroke);
            line(4.5, 12, 19.5, 12);
        } else if (name === "input") {
            line(5, 12, 15.5, 12); line(12.5, 9, 15.5, 12); line(15.5, 12, 12.5, 15);
            line(18.5, 6, 18.5, 18);
        } else if (name === "download") {
            line(12, 5, 12, 15); line(8.5, 11.5, 12, 15); line(12, 15, 15.5, 11.5);
            line(6, 19, 18, 19);
        } else if (name === "up") {
            line(6, 15.5, 12, 9.5); line(12, 9.5, 18, 15.5);
        } else if (name === "down") {
            line(6, 8.5, 12, 14.5); line(12, 14.5, 18, 8.5);
        } else if (name === "rules") {
            line(8, 5, 6.5, 19); line(16.5, 5, 15, 19); line(4.5, 9.5, 19, 9.5); line(4, 14.5, 18.5, 14.5);
        }

        drawable = new BitmapDrawable(context.getResources(), bitmap);
        drawable.setBounds(0, 0, px, px);
        return drawable;
    }

    function decoratePanelIcon(viewObj, value, colorValue, sizeDp) {
        var drawable;
        if (viewObj === null || viewObj === undefined || !isPanelIconToken(value)) { return false; }
        try {
            drawable = makePanelIconDrawable(viewObj.getContext(), value, colorValue, sizeDp);
            if (drawable === null) { return false; }
            viewObj.setText("");
            viewObj.setCompoundDrawablePadding(0);
            viewObj.setCompoundDrawables(drawable, null, null, null);
            return true;
        } catch (error) {
            return false;
        }
    }

    function configuredMode() {
        var value = mode;
        try {
            if (ClipHub.Settings && typeof ClipHub.Settings.get === "function") {
                value = String(ClipHub.Settings.get("themeMode", value));
            }
        } catch (ignored) {}
        return value;
    }

    function isDark(context) {
        var selected = configuredMode();
        var configuration;
        if (selected === "dark") { return true; }
        if (selected === "light") { return false; }
        try {
            configuration = context.getResources().getConfiguration();
            return (Number(configuration.uiMode) &
                Number(Configuration.UI_MODE_NIGHT_MASK)) ===
                Number(Configuration.UI_MODE_NIGHT_YES);
        } catch (ignored) { return false; }
    }

    function palette(context) {
        return copy(isDark(context || global.context) ? DARK : LIGHT);
    }

    ClipHub.Theme = {
        MODULE_NAME: "ch_07_theme",
        MODULE_VERSION: 7,
        init: function () { mode = "system"; return true; },
        setMode: function (value) {
            value = String(value || "system");
            if (value !== "system" && value !== "light" && value !== "dark") {
                throw new Error("Unsupported theme mode: " + value);
            }
            mode = value;
            return mode;
        },
        getMode: function () { return configuredMode(); },
        toColorInt: colorInt,
        safeColorStateList: safeColorStateList,
        applyTextColor: safeSetTextColor,
        applyHintTextColor: safeSetHintTextColor,
        applyLinkTextColor: safeSetLinkTextColor,
        applyGradientColor: safeSetGradientColor,
        applyGradientStroke: safeSetGradientStroke,
        applyBackgroundColor: safeSetBackgroundColor,
        applyTintColor: safeSetTintColor,
        applyPaintColor: safeSetPaintColor,
        getColorSafetyState: getColorSafetyState,
        isDark: isDark,
        getPalette: palette,
        getMetrics: function () { return copy(METRICS); },
        getLayoutMetrics: getLayoutMetrics,
        getPanelChromeMetrics: getPanelChromeMetrics,
        isPanelIconToken: isPanelIconToken,
        makePanelIconDrawable: makePanelIconDrawable,
        decoratePanelIcon: decoratePanelIcon,
        token: function (name, context) {
            var value = palette(context)[String(name)];
            return value === undefined ? null : value;
        },
        shutdown: function () { mode = "system"; return true; }
    };
}((function () { return this; }())));
