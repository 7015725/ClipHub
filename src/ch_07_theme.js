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



    /* panel_shortx_icon_system_v1: resolve ShortX built-in Remix drawables at runtime. */
    var SHORTX_ICON_PACKAGE = "tornaco.apps.shortx";
    var SHORTX_ICON_RESOURCES = {
        add: "ic_remix_add_line",
        close: "ic_remix_close_line",
        back: "ic_remix_arrow_left_s_line",
        forward: "ic_remix_arrow_right_s_line",
        check: "ic_remix_check_line",
        settings: "ic_remix_settings_3_line",
        search: "ic_remix_search_line",
        list: "ic_remix_list_unordered",
        more_vertical: "ic_remix_more_2_line",
        edit: "ic_remix_edit_line",
        copy: "ic_remix_file_copy_line",
        delete: "ic_remix_delete_bin_line",
        help: "ic_remix_question_mark",
        pin: "ic_remix_pushpin_line",
        globe: "ic_remix_global_line",
        input: "ic_remix_login_box_line",
        download: "ic_remix_download_line",
        up: "ic_remix_arrow_up_s_line",
        down: "ic_remix_arrow_down_s_line",
        rules: "ic_remix_braces_line"
    };
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
    var shortxIconRuntime = {
        remoteContext: null,
        resources: null,
        resourceIds: {},
        bitmaps: {}
    };

    function panelIconName(value) {
        var key = String(value === null || value === undefined ? "" : value);
        return PANEL_ICON_TOKENS.hasOwnProperty(key) ? PANEL_ICON_TOKENS[key] : null;
    }

    function isPanelIconToken(value) {
        return panelIconName(value) !== null;
    }

    function getShortXIconRuntime(context) {
        if (shortxIconRuntime.resources !== null) { return shortxIconRuntime; }
        try {
            shortxIconRuntime.remoteContext = context.createPackageContext(
                SHORTX_ICON_PACKAGE,
                Packages.android.content.Context.CONTEXT_IGNORE_SECURITY
            );
            shortxIconRuntime.resources = shortxIconRuntime.remoteContext.getResources();
        } catch (error) {
            shortxIconRuntime.remoteContext = null;
            shortxIconRuntime.resources = null;
        }
        return shortxIconRuntime;
    }

    function getShortXIconResourceId(context, resourceName) {
        var runtime = getShortXIconRuntime(context);
        var key = String(resourceName || "");
        var id;
        if (runtime.resources === null || key === "") { return 0; }
        if (runtime.resourceIds.hasOwnProperty(key)) { return Number(runtime.resourceIds[key]) || 0; }
        try {
            id = Number(runtime.resources.getIdentifier(key, "drawable", SHORTX_ICON_PACKAGE)) || 0;
        } catch (error) { id = 0; }
        runtime.resourceIds[key] = id;
        return id;
    }

    function makeShortXPanelIconDrawable(context, value, colorValue, sizeDp) {
        var semanticKey = String(value === null || value === undefined ? "" : value);
        var semantic = SHORTX_ICON_RESOURCES.hasOwnProperty(semanticKey) ?
            semanticKey : panelIconName(value);
        var resourceName;
        var runtime;
        var resourceId;
        var sourceDrawable;
        var Bitmap = Packages.android.graphics.Bitmap;
        var Canvas = Packages.android.graphics.Canvas;
        var BitmapDrawable = Packages.android.graphics.drawable.BitmapDrawable;
        var density = 1;
        var logicalSize = Number(sizeDp || 18);
        var px;
        var tintColor;
        var cacheKey;
        var bitmap;
        var drawable;
        if (semantic === null || context === null || context === undefined) { return null; }
        resourceName = SHORTX_ICON_RESOURCES[semantic];
        if (!resourceName) { return null; }
        runtime = getShortXIconRuntime(context);
        if (runtime.resources === null) { return null; }
        resourceId = getShortXIconResourceId(context, resourceName);
        if (resourceId <= 0) { return null; }
        try { density = Number(context.getResources().getDisplayMetrics().density || 1); }
        catch (ignoredDensity) { density = 1; }
        if (!isFinite(density) || density <= 0) { density = 1; }
        if (!isFinite(logicalSize)) { logicalSize = 18; }
        logicalSize = clampNumber(logicalSize, 14, 22);
        px = Math.max(1, Math.round(logicalSize * density));
        tintColor = colorInt(colorValue, 0);
        cacheKey = resourceName + "|" + String(tintColor) + "|" + String(px);
        bitmap = runtime.bitmaps[cacheKey];
        if (bitmap === undefined || bitmap === null) {
            try {
                sourceDrawable = runtime.resources.getDrawable(resourceId, null);
                if (sourceDrawable === null || sourceDrawable === undefined) { return null; }
                sourceDrawable = sourceDrawable.mutate();
                safeSetTintColor(sourceDrawable, tintColor);
                bitmap = Bitmap.createBitmap(px, px, Bitmap.Config.ARGB_8888);
                sourceDrawable.setBounds(0, 0, px, px);
                sourceDrawable.draw(new Canvas(bitmap));
                runtime.bitmaps[cacheKey] = bitmap;
            } catch (error) { return null; }
        }
        drawable = new BitmapDrawable(context.getResources(), bitmap);
        drawable.setBounds(0, 0, px, px);
        return drawable;
    }

        function makeShortXSemanticIconDrawable(context, semanticName, colorValue, sizeDp) {
        var semantic = String(semanticName || "");
        if (!SHORTX_ICON_RESOURCES[semantic]) { return null; }
        return makeShortXPanelIconDrawable(context, semantic, colorValue, sizeDp);
    }

    function decorateSemanticPanelIcon(view, semanticName, colorValue, sizeDp) {
        var drawable;
        if (view === null || view === undefined) { return false; }
        drawable = makeShortXSemanticIconDrawable(
            view.getContext(), semanticName, colorValue, sizeDp);
        try {
            view.setText("");
            if (drawable !== null) {
                view.setCompoundDrawables(drawable, null, null, null);
                return true;
            }
            view.setCompoundDrawables(null, null, null, null);
        } catch (ignored) {}
        return false;
    }

function decoratePanelIcon(viewObj, value, colorValue, sizeDp, explicitIcon) {
        var drawable;
        var Gravity = Packages.android.view.Gravity;
        if (viewObj === null || viewObj === undefined || explicitIcon !== true ||
                !isPanelIconToken(value)) { return false; }
        drawable = makeShortXPanelIconDrawable(viewObj.getContext(), value, colorValue, sizeDp);
        if (drawable === null) { return false; }
        try { viewObj.setText(""); } catch (ignoredText) {}
        try { viewObj.setCompoundDrawables(null, null, null, null); } catch (ignoredCompound) {}
        try {
            viewObj.setForeground(drawable);
            viewObj.setForegroundGravity(Gravity.CENTER);
            try { viewObj.setGravity(Gravity.CENTER); } catch (ignoredGravity) {}
            return true;
        } catch (ignoredForeground) {}
        try {
            viewObj.setCompoundDrawables(drawable, null, null, null);
            viewObj.setGravity(Gravity.CENTER);
            return true;
        } catch (ignoredFallback) {}
        return false;
    }

    function resetShortXPanelIconRuntime() {
        shortxIconRuntime = {
            remoteContext: null,
            resources: null,
            resourceIds: {},
            bitmaps: {}
        };
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
        MODULE_VERSION: 11,
        makeShortXSemanticIconDrawable: makeShortXSemanticIconDrawable,
        decorateSemanticPanelIcon: decorateSemanticPanelIcon,
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
        makePanelIconDrawable: makeShortXPanelIconDrawable,
        getShortXPanelIconDrawable: makeShortXPanelIconDrawable,
        decoratePanelIcon: decoratePanelIcon,
        token: function (name, context) {
            var value = palette(context)[String(name)];
            return value === undefined ? null : value;
        },
        shutdown: function () { mode = "system"; resetShortXPanelIconRuntime(); return true; }
    };
}((function () { return this; }())));
