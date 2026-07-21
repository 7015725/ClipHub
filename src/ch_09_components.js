// @version 1.0.0
// ClipHub - 统一原生组件工厂
(function (CH) {
    "use strict";

    var base = CH.base;
    var theme = CH.theme;
    var icons = CH.icons;
    var C = theme.colors;
    var D = theme.dimensions;
    var components = {};

    function contextValue() {
        return base.getContext();
    }

    components.text = function (text, sizeSp, colorValue, bold) {
        var view = new android.widget.TextView(contextValue());
        view.setText(base.string(text, ""));
        theme.applyText(view, sizeSp, colorValue, !!bold);
        view.setGravity(android.view.Gravity.CENTER_VERTICAL);
        return view;
    };

    components.iconView = function (type, colorValue, sizeDp, filled) {
        var image = new android.widget.ImageView(contextValue());
        image.setImageDrawable(icons.create(type, colorValue, sizeDp, !!filled));
        image.setScaleType(android.widget.ImageView.ScaleType.CENTER);
        return image;
    };

    components.iconButton = function (type, onClick, options) {
        var opts = options || {};
        var sizeDp = Number(opts.sizeDp || D.iconButton);
        var iconSizeDp = Number(opts.iconSizeDp || 22);
        var fillColor = opts.fillColor == null ? C.transparent : Number(opts.fillColor);
        var iconColor = opts.iconColor == null ? C.textPrimary : Number(opts.iconColor);
        var radiusDp = Number(opts.radiusDp || sizeDp / 2);
        var strokeColor = opts.strokeColor == null ? null : Number(opts.strokeColor);
        var strokeWidthDp = Number(opts.strokeWidthDp || 0);

        var root = new android.widget.FrameLayout(contextValue());
        root.setLayoutParams(new android.widget.LinearLayout.LayoutParams(base.dp(sizeDp), base.dp(sizeDp)));
        root.setBackground(theme.ripple(
            theme.rounded(fillColor, radiusDp, strokeColor, strokeWidthDp),
            C.surfacePressed
        ));
        root.setClickable(true);
        root.setFocusable(true);

        var image = components.iconView(type, iconColor, iconSizeDp, !!opts.filled);
        var imageLp = new android.widget.FrameLayout.LayoutParams(base.dp(iconSizeDp), base.dp(iconSizeDp));
        imageLp.gravity = android.view.Gravity.CENTER;
        root.addView(image, imageLp);
        root.setOnClickListener(base.makeClickListener(onClick));
        return root;
    };

    components.chip = function (text, fillColor, textColor, options) {
        var opts = options || {};
        var chip = components.text(text, Number(opts.textSp || theme.text.chipSp), textColor, !!opts.bold);
        chip.setGravity(android.view.Gravity.CENTER);
        chip.setSingleLine(true);
        chip.setPadding(base.dp(Number(opts.paddingH || 8)), 0, base.dp(Number(opts.paddingH || 8)), 0);
        chip.setMinHeight(base.dp(Number(opts.heightDp || 23)));
        chip.setBackground(theme.rounded(fillColor, Number(opts.radiusDp || D.chipRadius),
            opts.strokeColor == null ? null : opts.strokeColor, Number(opts.strokeWidthDp || 0)));
        return chip;
    };

    components.divider = function (vertical) {
        var view = new android.view.View(contextValue());
        if (vertical) {
            view.setLayoutParams(new android.widget.LinearLayout.LayoutParams(base.dp(1),
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT));
        } else {
            view.setLayoutParams(new android.widget.LinearLayout.LayoutParams(
                android.widget.LinearLayout.LayoutParams.MATCH_PARENT, base.dp(1)));
        }
        view.setBackgroundColor(C.border);
        return view;
    };

    components.cardBackground = function (selected) {
        return theme.rounded(selected ? C.selectedFill : C.surface, D.cardRadius,
            selected ? C.selectedBorder : C.border, selected ? 1.5 : 1);
    };

    components.appIcon = function (packageName, fallbackText, fallbackColor, sizeDp) {
        var size = Number(sizeDp || 38);
        var root = new android.widget.FrameLayout(contextValue());
        root.setLayoutParams(new android.widget.LinearLayout.LayoutParams(base.dp(size), base.dp(size)));
        root.setClipToOutline(true);
        try {
            root.setBackground(theme.rounded(C.surfaceMuted, size / 2, C.border, 1));
        } catch (eBackground) {}

        var loaded = false;
        try {
            if (packageName) {
                var drawable = contextValue().getPackageManager().getApplicationIcon(String(packageName));
                if (drawable) {
                    var image = new android.widget.ImageView(contextValue());
                    image.setImageDrawable(drawable);
                    image.setScaleType(android.widget.ImageView.ScaleType.FIT_CENTER);
                    var imageLp = new android.widget.FrameLayout.LayoutParams(base.dp(size - 4), base.dp(size - 4));
                    imageLp.gravity = android.view.Gravity.CENTER;
                    root.addView(image, imageLp);
                    loaded = true;
                }
            }
        } catch (ePackageIcon) {}

        if (!loaded) {
            var fallback = components.text(base.string(fallbackText, "?").substring(0, 1),
                Math.max(13, Math.round(size * 0.42)), C.white, true);
            fallback.setGravity(android.view.Gravity.CENTER);
            fallback.setBackground(theme.rounded(fallbackColor || C.primary, size / 2, null, 0));
            var fallbackLp = new android.widget.FrameLayout.LayoutParams(base.dp(size - 4), base.dp(size - 4));
            fallbackLp.gravity = android.view.Gravity.CENTER;
            root.addView(fallback, fallbackLp);
        }
        return root;
    };

    components.searchField = function (hintText, onClick) {
        var root = new android.widget.LinearLayout(contextValue());
        root.setOrientation(android.widget.LinearLayout.HORIZONTAL);
        root.setGravity(android.view.Gravity.CENTER_VERTICAL);
        root.setPadding(base.dp(14), 0, base.dp(12), 0);
        root.setBackground(theme.ripple(
            theme.rounded(C.surface, D.fieldRadius, C.border, 1),
            C.surfacePressed
        ));
        root.setClickable(true);
        root.setFocusable(true);
        root.setOnClickListener(base.makeClickListener(onClick));

        var searchIcon = components.iconView("search", C.textSecondary, 20, false);
        root.addView(searchIcon, new android.widget.LinearLayout.LayoutParams(base.dp(22), base.dp(22)));

        var hint = components.text(hintText, 13, C.textTertiary, false);
        hint.setSingleLine(true);
        var hintLp = new android.widget.LinearLayout.LayoutParams(0,
            android.widget.LinearLayout.LayoutParams.MATCH_PARENT, 1);
        hintLp.leftMargin = base.dp(10);
        root.addView(hint, hintLp);
        return root;
    };

    components.bottomAction = function (type, label, onClick, selected) {
        var root = new android.widget.LinearLayout(contextValue());
        root.setOrientation(android.widget.LinearLayout.VERTICAL);
        root.setGravity(android.view.Gravity.CENTER);
        root.setPadding(base.dp(2), base.dp(6), base.dp(2), base.dp(5));
        root.setClickable(true);
        root.setFocusable(true);
        root.setBackground(theme.ripple(
            theme.rounded(selected ? C.primarySoft : C.transparent, 14, null, 0),
            C.surfacePressed
        ));
        root.setOnClickListener(base.makeClickListener(onClick));

        var colorValue = selected ? C.primary : C.textPrimary;
        var icon = components.iconView(type, colorValue, 22, selected && type === "star");
        root.addView(icon, new android.widget.LinearLayout.LayoutParams(base.dp(25), base.dp(25)));

        var labelView = components.text(label, theme.text.actionSp, colorValue, false);
        labelView.setGravity(android.view.Gravity.CENTER);
        var labelLp = new android.widget.LinearLayout.LayoutParams(
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT,
            base.dp(18));
        labelLp.topMargin = base.dp(3);
        root.addView(labelView, labelLp);
        return root;
    };

    components.sectionHeader = function (title, actionText, onAction) {
        var row = new android.widget.LinearLayout(contextValue());
        row.setOrientation(android.widget.LinearLayout.HORIZONTAL);
        row.setGravity(android.view.Gravity.CENTER_VERTICAL);
        var titleView = components.text(title, theme.text.sectionSp, C.textPrimary, true);
        row.addView(titleView, new android.widget.LinearLayout.LayoutParams(0,
            android.widget.LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        if (actionText) {
            var action = components.text(actionText, 12, C.primary, false);
            action.setPadding(base.dp(8), base.dp(6), base.dp(2), base.dp(6));
            action.setClickable(true);
            action.setOnClickListener(base.makeClickListener(onAction));
            row.addView(action);
        }
        return row;
    };

    components.toast = function (message) {
        base.runOnMain(function () {
            try {
                android.widget.Toast.makeText(contextValue(), base.string(message, ""),
                    android.widget.Toast.LENGTH_SHORT).show();
            } catch (eToast) {}
        });
    };

    components.setContentDescription = function (view, description) {
        try {
            view.setContentDescription(base.string(description, ""));
        } catch (eDescription) {}
        return view;
    };

    CH.components = components;
}(CH));
