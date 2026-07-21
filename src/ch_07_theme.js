// @version 1.0.0
// ClipHub - 参考图固定视觉令牌
(function (CH) {
    "use strict";

    var base = CH.base;
    var theme = {};

    function color(hex) {
        return android.graphics.Color.parseColor(String(hex));
    }

    theme.colors = {
        primary: color("#6647D9"),
        primaryDark: color("#5638C8"),
        primarySoft: color("#EEE9FF"),
        primaryFaint: color("#F7F4FF"),
        panel: color("#FBFAFF"),
        surface: color("#FFFFFF"),
        surfaceMuted: color("#F7F6FB"),
        surfacePressed: color("#F1EEFA"),
        textPrimary: color("#24212D"),
        textSecondary: color("#777281"),
        textTertiary: color("#A19BAA"),
        border: color("#E9E5F0"),
        borderStrong: color("#D9D1EC"),
        shadow: color("#24000000"),
        success: color("#31B878"),
        successSoft: color("#E7F8EF"),
        info: color("#4392F1"),
        infoSoft: color("#EAF4FF"),
        warning: color("#E6A21A"),
        warningSoft: color("#FFF5D8"),
        danger: color("#D75B64"),
        dangerSoft: color("#FCEAEC"),
        chipBlue: color("#E6F2FF"),
        chipBlueText: color("#3B82D6"),
        chipGreen: color("#E5F7EA"),
        chipGreenText: color("#2C9E60"),
        chipOrange: color("#FFF1D8"),
        chipOrangeText: color("#C58316"),
        chipPurple: color("#F0E9FF"),
        chipPurpleText: color("#7351C7"),
        chipPink: color("#FFE9F3"),
        chipPinkText: color("#C54F82"),
        selectedBorder: color("#7659DF"),
        selectedFill: color("#FAF8FF"),
        transparent: android.graphics.Color.TRANSPARENT,
        white: android.graphics.Color.WHITE,
        black: android.graphics.Color.BLACK
    };

    theme.dimensions = {
        panelRadius: 24,
        cardRadius: 14,
        fieldRadius: 18,
        chipRadius: 7,
        buttonRadius: 15,
        panelPaddingH: 14,
        panelPaddingBottom: 12,
        sectionGap: 10,
        cardGap: 8,
        iconButton: 42,
        smallIconButton: 36,
        bottomBarHeight: 70,
        dragHandleWidth: 42,
        dragHandleHeight: 4,
        headerHeight: 54,
        searchHeight: 48,
        cardMinHeight: 82
    };

    theme.text = {
        titleSp: 21,
        sectionSp: 15,
        bodySp: 14,
        bodySmallSp: 13,
        captionSp: 11,
        chipSp: 10,
        actionSp: 11
    };

    theme.color = color;

    theme.setColor = function (drawable, colorValue) {
        if (!drawable) return;
        try {
            drawable.setColor(Number(colorValue));
        } catch (eNumber) {
            try {
                drawable.setColor(java.lang.Integer.valueOf(Number(colorValue)));
            } catch (eInteger) {}
        }
    };

    theme.setTextColor = function (textView, colorValue) {
        if (!textView) return;
        try {
            textView.setTextColor(Number(colorValue));
        } catch (eNumber) {
            try {
                textView.setTextColor(java.lang.Integer.valueOf(Number(colorValue)));
            } catch (eInteger) {}
        }
    };

    theme.rounded = function (fillColor, radiusDp, strokeColor, strokeWidthDp, radiiDp) {
        var drawable = new android.graphics.drawable.GradientDrawable();
        theme.setColor(drawable, fillColor);
        if (radiiDp && radiiDp.length === 8) {
            var radii = java.lang.reflect.Array.newInstance(java.lang.Float.TYPE, 8);
            var i = 0;
            for (i = 0; i < 8; i++) radii[i] = base.dp(radiiDp[i]);
            drawable.setCornerRadii(radii);
        } else {
            drawable.setCornerRadius(base.dp(radiusDp || 0));
        }
        if (strokeColor != null && Number(strokeWidthDp || 0) > 0) {
            try {
                drawable.setStroke(base.dp(strokeWidthDp), Number(strokeColor));
            } catch (eStroke) {
                try {
                    drawable.setStroke(base.dp(strokeWidthDp), java.lang.Integer.valueOf(Number(strokeColor)));
                } catch (eStroke2) {}
            }
        }
        return drawable;
    };

    theme.ripple = function (normalDrawable, rippleColor) {
        if (android.os.Build.VERSION.SDK_INT < 21) return normalDrawable;
        try {
            var states = [
                [android.R.attr.state_pressed],
                []
            ];
            var colors = [Number(rippleColor), Number(theme.colors.transparent)];
            var colorState = new android.content.res.ColorStateList(states, colors);
            return new android.graphics.drawable.RippleDrawable(colorState, normalDrawable, null);
        } catch (eRipple) {
            return normalDrawable;
        }
    };

    theme.applyElevation = function (view, elevationDp) {
        try {
            view.setElevation(base.dp(elevationDp));
        } catch (eElevation) {}
    };

    theme.applyText = function (textView, sizeSp, colorValue, bold) {
        if (!textView) return textView;
        textView.setTextSize(android.util.TypedValue.COMPLEX_UNIT_SP, Number(sizeSp));
        theme.setTextColor(textView, colorValue);
        try {
            textView.setIncludeFontPadding(false);
        } catch (ePadding) {}
        try {
            textView.setFontFeatureSettings("kern");
        } catch (eFeature) {}
        if (bold) {
            try {
                textView.setTypeface(android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL));
            } catch (eTypeface) {
                textView.setTypeface(android.graphics.Typeface.DEFAULT_BOLD);
            }
        } else {
            try {
                textView.setTypeface(android.graphics.Typeface.create("sans-serif", android.graphics.Typeface.NORMAL));
            } catch (eTypefaceNormal) {}
        }
        return textView;
    };

    CH.theme = theme;
}(CH));
