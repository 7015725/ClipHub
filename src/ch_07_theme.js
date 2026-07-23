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
        minTouchDp: 40
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
        MODULE_VERSION: 4,
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
        token: function (name, context) {
            var value = palette(context)[String(name)];
            return value === undefined ? null : value;
        },
        shutdown: function () { mode = "system"; return true; }
    };
}((function () { return this; }())));
