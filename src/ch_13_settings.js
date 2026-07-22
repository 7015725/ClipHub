(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var Context = Packages.android.content.Context;
    var Build = Packages.android.os.Build;
    var Looper = Packages.android.os.Looper;
    var Handler = Packages.android.os.Handler;
    var View = Packages.android.view.View;
    var MotionEvent = Packages.android.view.MotionEvent;
    var Gravity = Packages.android.view.Gravity;
    var WindowManager = Packages.android.view.WindowManager;
    var PixelFormat = Packages.android.graphics.PixelFormat;
    var Color = Packages.android.graphics.Color;
    var GradientDrawable = Packages.android.graphics.drawable.GradientDrawable;
    var LinearLayout = Packages.android.widget.LinearLayout;
    var FrameLayout = Packages.android.widget.FrameLayout;
    var ScrollView = Packages.android.widget.ScrollView;
    var TextView = Packages.android.widget.TextView;
    var EditText = Packages.android.widget.EditText;
    var TypedValue = Packages.android.util.TypedValue;
    var InputType = Packages.android.text.InputType;
    var TextWatcher = Packages.android.text.TextWatcher;
    var TextUtils = Packages.android.text.TextUtils;
    var CountDownLatch = Packages.java.util.concurrent.CountDownLatch;
    var TimeUnit = Packages.java.util.concurrent.TimeUnit;
    var Thread = Packages.java.lang.Thread;
    var File = Packages.java.io.File;
    var FIS = Packages.java.io.FileInputStream;
    var ISR = Packages.java.io.InputStreamReader;
    var BR = Packages.java.io.BufferedReader;
    var SB = Packages.java.lang.StringBuilder;

    var values = {};
    var ready = false;
    var lastCleanup = null;
    var initContext = null;
    var appContext = null;
    var windowManager = null;
    var mainHandler = null;
    var density = 1;
    var panelRoot = null;
    var panelParams = null;
    var scrollRoot = null;
    var translationStatusView = null;
    var engineBaiduView = null;
    var engineYoudaoView = null;
    var baiduGroup = null;
    var youdaoGroup = null;
    var baiduIdInput = null;
    var baiduSecretInput = null;
    var youdaoKeyInput = null;
    var youdaoSecretInput = null;
    var newTagNameInput = null;
    var newTagColorInput = null;
    var closeView = null;
    var sensitivePolicyView = null;
    var historyEnabledView = null;
    var draftEngine = "baidu";
    var tagRowViews = {};
    var translationSectionView = null;
    var tagsSectionView = null;
    var dataSectionView = null;
    var pendingDeleteTagId = null;
    var uiState = {
        attached: false,
        openCount: 0,
        closeCount: 0,
        renderCount: 0,
        saveTranslationCount: 0,
        testTranslationCount: 0,
        testTranslationSuccessCount: 0,
        tagCreateCount: 0,
        tagUpdateCount: 0,
        tagDeleteCount: 0,
        tagReorderCount: 0,
        tagDragStartCount: 0,
        tagDragCommitCount: 0,
        tagColorPreviewCount: 0,
        tagDeleteConfirmCount: 0,
        lastDraggedTagId: null,
        pendingDeleteTagId: null,
        clearHistoryCount: 0,
        settingsStyle: "reference_settings_v2",
        sectionCount: 4,
        translationFieldCount: 4,
        tagRowCount: 0,
        panelWidthDp: 0,
        panelHeightDp: 0,
        lastTestResult: "",
        lastError: null
    };

    var DEFAULTS = {
        historyLimit: 0,
        autoCleanupDays: 0,
        closeAfterCopy: false,
        themeMode: "system",
        sourceEnabled: true,
        sensitivePolicy: "skip",
        ignorePackages: [],
        windowPosition: null,
        filterSearchHistory: [],
        searchHistoryEnabled: true,
        "translation.engine": "baidu",
        "translation.baidu.app_id": "",
        "translation.baidu.app_secret": "",
        "translation.youdao.app_key": "",
        "translation.youdao.app_secret": "",
        "translation.auto_direction": true,
        "translation.max_chars": 5000
    };

    function dp(value) {
        return Math.max(1, Math.floor(Number(value) * density + 0.5));
    }

    function closeQuietly(value) {
        if (value !== null && value !== undefined) {
            try { value.close(); } catch (ignored) {}
        }
    }

    function runOnMainSync(callback, timeoutMs) {
        var mainLooper = Looper.getMainLooper();
        var box;
        var latch;
        var runnable;
        var posted;
        var completed;
        if (Looper.myLooper() === mainLooper) { return callback(); }
        box = { value: null, error: null };
        latch = new CountDownLatch(1);
        runnable = new Packages.java.lang.Runnable({
            run: function () {
                try { box.value = callback(); }
                catch (error) { box.error = error; }
                finally { latch.countDown(); }
            }
        });
        posted = mainHandler.post(runnable);
        if (!posted) { throw new Error("Settings main handler post failed"); }
        completed = latch.await(Number(timeoutMs || 3000), TimeUnit.MILLISECONDS);
        if (!completed) {
            try { mainHandler.removeCallbacks(runnable); } catch (ignored) {}
            throw new Error("Settings main handler timeout");
        }
        if (box.error !== null) { throw box.error; }
        return box.value;
    }

    function copyArray(input) {
        var output = [];
        var index;
        input = input || [];
        for (index = 0; index < input.length; index += 1) {
            output.push(String(input[index]));
        }
        return output;
    }

    function copyPosition(input) {
        if (!input || typeof input !== "object") { return null; }
        return { xRatio: Number(input.xRatio), yRatio: Number(input.yRatio) };
    }

    function copyValue(value) {
        if (value && typeof value === "object" &&
                Object.prototype.toString.call(value) === "[object Array]") {
            return copyArray(value);
        }
        if (value && typeof value === "object" &&
                Object.prototype.hasOwnProperty.call(value, "xRatio") &&
                Object.prototype.hasOwnProperty.call(value, "yRatio")) {
            return copyPosition(value);
        }
        return value;
    }

    function defaultsCopy() {
        var output = {};
        var key;
        for (key in DEFAULTS) {
            if (DEFAULTS.hasOwnProperty(key)) {
                output[key] = copyValue(DEFAULTS[key]);
            }
        }
        return output;
    }

    function intRange(value, minimum, maximum, fallback) {
        var number = Number(value);
        if (!isFinite(number)) { return fallback; }
        number = Math.floor(number);
        if (number < minimum) { number = minimum; }
        if (number > maximum) { number = maximum; }
        return number;
    }

    function ratio(value, fallback) {
        var number = Number(value);
        if (!isFinite(number)) { return fallback; }
        if (number < 0) { number = 0; }
        if (number > 1) { number = 1; }
        return number;
    }

    function normalizePosition(input) {
        if (input === null || input === undefined) { return null; }
        if (typeof input !== "object") {
            throw new Error("windowPosition must be null or an object");
        }
        return { xRatio: ratio(input.xRatio, 1), yRatio: ratio(input.yRatio, 0) };
    }

    function normalizePackages(input) {
        var output = [];
        var seen = {};
        var index;
        var value;
        input = input || [];
        if (Object.prototype.toString.call(input) !== "[object Array]") {
            throw new Error("ignorePackages must be an array");
        }
        for (index = 0; index < input.length; index += 1) {
            value = String(input[index] === null || input[index] === undefined
                ? "" : input[index]).replace(/^\s+|\s+$/g, "");
            if (value.length > 0 && !seen[value]) {
                seen[value] = true;
                output.push(value);
            }
        }
        return output;
    }

    function normalizeSearchHistory(input) {
        var output = [];
        var seen = {};
        var index;
        var item;
        input = input || [];
        if (Object.prototype.toString.call(input) !== "[object Array]") {
            throw new Error("filterSearchHistory must be an array");
        }
        for (index = 0; index < input.length && output.length < 10;
                index += 1) {
            item = String(input[index] === null || input[index] === undefined
                ? "" : input[index]).replace(/^\s+|\s+$/g, "");
            if (item.length > 0 && !seen[item.toLowerCase()]) {
                seen[item.toLowerCase()] = true;
                output.push(item.substring(0, 120));
            }
        }
        return output;
    }

    function normalizedSecret(value) {
        return String(value === null || value === undefined ? "" : value)
            .replace(/^\s+|\s+$/g, "").substring(0, 512);
    }

    function normalize(key, value) {
        if (key === "historyLimit") {
            return intRange(value, 0, 100000, DEFAULTS.historyLimit);
        }
        if (key === "autoCleanupDays") {
            return intRange(value, 0, 3650, DEFAULTS.autoCleanupDays);
        }
        if (key === "closeAfterCopy" || key === "sourceEnabled" ||
                key === "searchHistoryEnabled" ||
                key === "translation.auto_direction") {
            return value === true;
        }
        if (key === "translation.max_chars") {
            return intRange(value, 1, 10000, DEFAULTS["translation.max_chars"]);
        }
        if (key === "translation.engine") {
            value = String(value || "baidu");
            return value === "youdao" ? "youdao" : "baidu";
        }
        if (key === "translation.baidu.app_id" ||
                key === "translation.baidu.app_secret" ||
                key === "translation.youdao.app_key" ||
                key === "translation.youdao.app_secret") {
            return normalizedSecret(value);
        }
        if (key === "themeMode") {
            value = String(value);
            return value === "light" || value === "dark" || value === "system"
                ? value : DEFAULTS.themeMode;
        }
        if (key === "sensitivePolicy") {
            value = String(value);
            if (value !== "skip" && value !== "save") {
                throw new Error("Invalid sensitive policy");
            }
            return value;
        }
        if (key === "ignorePackages") { return normalizePackages(value); }
        if (key === "windowPosition") { return normalizePosition(value); }
        if (key === "filterSearchHistory") {
            return normalizeSearchHistory(value);
        }
        throw new Error("Unknown setting: " + key);
    }

    function serialize(value) { return JSON.stringify(value); }

    function deserialize(key, text) {
        var parsed;
        try { parsed = JSON.parse(String(text)); }
        catch (ignored) { parsed = DEFAULTS[key]; }
        return normalize(key, parsed);
    }

    function requireReady() {
        if (!ready || !ClipHub.Database || !ClipHub.Database.isOpen()) {
            throw new Error("ClipHub settings are not ready");
        }
    }

    function persist(key, value) {
        return ClipHub.Database.executeInsert(
            "INSERT OR REPLACE INTO settings(key, value, updated_at) " +
            "VALUES (?, ?, ?)",
            [key, serialize(value), ClipHub.Base.now()]
        );
    }

    function load() {
        var rows = ClipHub.Database.queryAll("SELECT key, value FROM settings", []);
        var output = defaultsCopy();
        var index;
        var key;
        for (index = 0; index < rows.length; index += 1) {
            key = String(rows[index].key || "");
            if (DEFAULTS.hasOwnProperty(key)) {
                output[key] = deserialize(key, rows[index].value);
            }
        }
        values = output;
        return getAll();
    }

    function applyClipboard() {
        if (ClipHub.Clipboard &&
                typeof ClipHub.Clipboard.configure === "function") {
            ClipHub.Clipboard.configure({
                sourceEnabled: values.sourceEnabled,
                sensitivePolicy: values.sensitivePolicy,
                ignorePackages: copyArray(values.ignorePackages)
            });
            return true;
        }
        return false;
    }

    function cleanup(referenceAt) {
        requireReady();
        if (!ClipHub.Repository ||
                typeof ClipHub.Repository.cleanupHistory !== "function") {
            throw new Error("Repository cleanup is unavailable");
        }
        lastCleanup = ClipHub.Repository.cleanupHistory({
            historyLimit: values.historyLimit,
            autoCleanupDays: values.autoCleanupDays,
            referenceAt: referenceAt
        });
        lastCleanup.at = ClipHub.Base.now();
        return getLastCleanup();
    }

    function setValue(key, value, options) {
        var normalized;
        var shouldCleanup;
        options = options || {};
        requireReady();
        key = String(key);
        normalized = normalize(key, value);
        persist(key, normalized);
        values[key] = copyValue(normalized);
        if (key === "sourceEnabled" || key === "sensitivePolicy" ||
                key === "ignorePackages") {
            applyClipboard();
        }
        shouldCleanup = key === "historyLimit" ||
            key === "autoCleanupDays";
        if (shouldCleanup && options.cleanup !== false) { cleanup(); }
        return copyValue(values[key]);
    }

    function setMany(patch, options) {
        var normalized = {};
        var key;
        var needsClipboard = false;
        var needsCleanup = false;
        options = options || {};
        requireReady();
        patch = patch || {};
        for (key in patch) {
            if (patch.hasOwnProperty(key)) {
                normalized[key] = normalize(String(key), patch[key]);
            }
        }
        ClipHub.Database.transaction(function () {
            for (key in normalized) {
                if (normalized.hasOwnProperty(key)) {
                    persist(key, normalized[key]);
                }
            }
        });
        for (key in normalized) {
            if (normalized.hasOwnProperty(key)) {
                values[key] = copyValue(normalized[key]);
                if (key === "sourceEnabled" || key === "sensitivePolicy" ||
                        key === "ignorePackages") {
                    needsClipboard = true;
                }
                if (key === "historyLimit" || key === "autoCleanupDays") {
                    needsCleanup = true;
                }
            }
        }
        if (needsClipboard) { applyClipboard(); }
        if (needsCleanup && options.cleanup !== false) { cleanup(); }
        return getAll();
    }

    function getAll() {
        var output = {};
        var key;
        for (key in values) {
            if (values.hasOwnProperty(key)) {
                output[key] = copyValue(values[key]);
            }
        }
        return output;
    }

    function getLastCleanup() {
        var output = {};
        var key;
        if (lastCleanup === null) { return null; }
        for (key in lastCleanup) {
            if (lastCleanup.hasOwnProperty(key)) { output[key] = lastCleanup[key]; }
        }
        return output;
    }

    function isDark() {
        var mode = String(values.themeMode || "system");
        var config;
        if (mode === "dark") { return true; }
        if (mode === "light") { return false; }
        try {
            config = appContext.getResources().getConfiguration();
            return (Number(config.uiMode) &
                Number(Packages.android.content.res.Configuration.UI_MODE_NIGHT_MASK)) ===
                Number(Packages.android.content.res.Configuration.UI_MODE_NIGHT_YES);
        } catch (ignored) { return false; }
    }

    function palette() {
        try {
            if (ClipHub.Theme && typeof ClipHub.Theme.getPalette === "function") {
                return ClipHub.Theme.getPalette(appContext);
            }
        } catch (ignored) {}
        return isDark() ? {
            surface: "#FF211E2A", surfaceMuted: "#FF292532",
            stroke: "#FF3D3748", accentStrong: "#FF9476F8",
            accentSoft: "#FF302946", accentBorder: "#FF6F5A9D",
            textPrimary: "#FFF7F3FF", textSecondary: "#FFC8C0D1",
            textTertiary: "#FF968DA1", icon: "#FFE7DFF1"
        } : {
            surface: "#FFFFFFFF", surfaceMuted: "#FFF5F3FB",
            stroke: "#FFE5E0EF", accentStrong: "#FF5A37E6",
            accentSoft: "#FFF0ECFF", accentBorder: "#FFBBAAF8",
            textPrimary: "#FF1F1C28", textSecondary: "#FF6F697A",
            textTertiary: "#FF9992A3", icon: "#FF3D3748"
        };
    }

    function roundedBackground(fill, stroke, radiusDp) {
        var drawable = new GradientDrawable();
        drawable.setShape(GradientDrawable.RECTANGLE);
        drawable.setColor(Color.parseColor(String(fill)));
        drawable.setCornerRadius(dp(radiusDp));
        if (stroke !== null && stroke !== undefined) {
            drawable.setStroke(dp(1), Color.parseColor(String(stroke)));
        }
        return drawable;
    }

    function makeText(text, size, color, bold) {
        var view = new TextView(appContext);
        view.setText(String(text));
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, Number(size));
        view.setTextColor(Color.parseColor(String(color)));
        view.setIncludeFontPadding(false);
        if (bold) {
            view.setTypeface(Packages.android.graphics.Typeface.DEFAULT,
                Packages.android.graphics.Typeface.BOLD);
        }
        return view;
    }

    function makeButton(text, colors, primary, danger) {
        var view = makeText(text, 10,
            danger ? "#FFB42323" : (primary ? "#FFFFFFFF" : colors.accentStrong),
            primary || danger);
        view.setGravity(Gravity.CENTER);
        view.setSingleLine(true);
        view.setPadding(dp(8), dp(6), dp(8), dp(6));
        view.setBackground(roundedBackground(
            primary ? colors.accentStrong : colors.accentSoft,
            primary ? colors.accentStrong : colors.accentBorder, 11));
        view.setClickable(true);
        view.setFocusable(true);
        return view;
    }

    function makeInput(hint, value, colors, secret) {
        var input = new EditText(appContext);
        input.setSingleLine(true);
        input.setHint(String(hint));
        input.setText(String(value || ""));
        input.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        input.setTextColor(Color.parseColor(colors.textPrimary));
        input.setHintTextColor(Color.parseColor(colors.textTertiary));
        input.setPadding(dp(10), dp(5), dp(10), dp(5));
        input.setBackground(roundedBackground(colors.surfaceMuted,
            colors.stroke, 11));
        if (secret) {
            input.setInputType(InputType.TYPE_CLASS_TEXT |
                InputType.TYPE_TEXT_VARIATION_PASSWORD);
        } else {
            input.setInputType(InputType.TYPE_CLASS_TEXT);
        }
        return input;
    }

    function addField(parent, label, input, colors) {
        var labelView = makeText(label, 10, colors.textSecondary, true);
        var params;
        parent.addView(labelView, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(42));
        params.topMargin = dp(4);
        params.bottomMargin = dp(7);
        parent.addView(input, params);
    }

    function makeSection(colors) {
        var section = new LinearLayout(appContext);
        section.setOrientation(LinearLayout.VERTICAL);
        section.setPadding(dp(11), dp(10), dp(11), dp(10));
        section.setBackground(roundedBackground(colors.surface,
            colors.stroke, 15));
        return section;
    }

    function addSection(parent, section) {
        var params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(9);
        parent.addView(section, params);
    }

    function updateGeneralButtons(colors) {
        if (sensitivePolicyView !== null) {
            sensitivePolicyView.setText(values.sensitivePolicy === "save" ?
                "敏感内容：保存" : "敏感内容：跳过");
        }
        if (historyEnabledView !== null) {
            historyEnabledView.setText(values.searchHistoryEnabled ?
                "搜索历史：开启" : "搜索历史：关闭");
        }
    }

    function translationDraftFromInputs() {
        return {
            "translation.engine": draftEngine,
            "translation.baidu.app_id": baiduIdInput === null ? "" :
                String(baiduIdInput.getText()),
            "translation.baidu.app_secret": baiduSecretInput === null ? "" :
                String(baiduSecretInput.getText()),
            "translation.youdao.app_key": youdaoKeyInput === null ? "" :
                String(youdaoKeyInput.getText()),
            "translation.youdao.app_secret": youdaoSecretInput === null ? "" :
                String(youdaoSecretInput.getText()),
            "translation.auto_direction": true,
            "translation.max_chars": 5000
        };
    }

    function updateEngineViews(colors) {
        var baidu = draftEngine === "baidu";
        if (baiduGroup !== null) {
            baiduGroup.setVisibility(baidu ? View.VISIBLE : View.GONE);
        }
        if (youdaoGroup !== null) {
            youdaoGroup.setVisibility(baidu ? View.GONE : View.VISIBLE);
        }
        if (engineBaiduView !== null) {
            engineBaiduView.setBackground(roundedBackground(
                baidu ? colors.accentStrong : colors.accentSoft,
                colors.accentBorder, 11));
            engineBaiduView.setTextColor(Color.parseColor(
                baidu ? "#FFFFFFFF" : colors.accentStrong));
        }
        if (engineYoudaoView !== null) {
            engineYoudaoView.setBackground(roundedBackground(
                baidu ? colors.accentSoft : colors.accentStrong,
                colors.accentBorder, 11));
            engineYoudaoView.setTextColor(Color.parseColor(
                baidu ? colors.accentStrong : "#FFFFFFFF"));
        }
    }

    function saveTranslationSettings() {
        try {
            setMany(translationDraftFromInputs(), { cleanup: false });
            uiState.saveTranslationCount += 1;
            if (translationStatusView !== null) {
                translationStatusView.setText("配置已保存到 SQLite");
            }
            return true;
        } catch (error) {
            uiState.lastError = String(error);
            if (translationStatusView !== null) {
                translationStatusView.setText("保存失败：" + String(error));
            }
            return false;
        }
    }

    function testTranslationSettings() {
        if (!saveTranslationSettings()) { return false; }
        uiState.testTranslationCount += 1;
        if (translationStatusView !== null) {
            translationStatusView.setText("正在测试翻译…");
        }
        try {
            if (!ClipHub.Translation ||
                    typeof ClipHub.Translation.testConfigured !== "function") {
                throw new Error("翻译模块尚未就绪");
            }
            ClipHub.Translation.testConfigured("ClipHub 翻译测试",
                function (result) {
                    runOnMainSync(function () {
                        if (result && result.ok === true) {
                            uiState.testTranslationSuccessCount += 1;
                            uiState.lastTestResult = String(result.translatedText || "");
                            if (translationStatusView !== null) {
                                translationStatusView.setText("测试成功：" +
                                    uiState.lastTestResult);
                            }
                        } else {
                            uiState.lastError = result ? String(result.error) :
                                "翻译测试失败";
                            if (translationStatusView !== null) {
                                translationStatusView.setText("测试失败：" +
                                    uiState.lastError);
                            }
                        }
                        return true;
                    }, 3000);
                });
            return true;
        } catch (error) {
            uiState.lastError = String(error);
            if (translationStatusView !== null) {
                translationStatusView.setText("测试失败：" + String(error));
            }
            return false;
        }
    }

    function parseColorValue(text, fallback) {
        try { return Number(Color.parseColor(String(text || ""))); }
        catch (ignored) { return fallback; }
    }

    function colorText(value) {
        var number;
        var hex;
        if (value === null || value === undefined) { return "#7C5CFC"; }
        number = Number(value) >>> 0;
        hex = number.toString(16).toUpperCase();
        while (hex.length < 8) { hex = "0" + hex; }
        return "#" + hex.substring(2);
    }

    function colorValueText(value, fallback) {
        var number;
        var hex;
        if (value === null || value === undefined) {
            return String(fallback || "#7C5CFC");
        }
        number = Number(value) >>> 0;
        hex = number.toString(16).toUpperCase();
        while (hex.length < 8) { hex = "0" + hex; }
        return "#" + hex;
    }

    function makeColorSwatch(value, colors) {
        var swatch = new View(appContext);
        swatch.setBackground(roundedBackground(
            colorValueText(value, colors.accentStrong), colors.stroke, 99));
        uiState.tagColorPreviewCount += 1;
        return swatch;
    }

    function bindColorPreview(input, swatch, fallback, colors) {
        input.addTextChangedListener(new JavaAdapter(TextWatcher, {
            beforeTextChanged: function () {},
            onTextChanged: function () {
                var value = parseColorValue(String(input.getText()), fallback);
                swatch.setBackground(roundedBackground(
                    colorValueText(value, colors.accentStrong),
                    colors.stroke, 99));
            },
            afterTextChanged: function () {}
        }));
    }

    function rebuildTagPage() {
        buildPage();
        if (mainHandler !== null) {
            mainHandler.post(new Packages.java.lang.Runnable({
                run: function () { scrollToSection("tags"); }
            }));
        }
        return true;
    }

    function requestDeleteTag(tagId, itemCount, deleteView) {
        tagId = Number(tagId);
        if (pendingDeleteTagId !== tagId) {
            pendingDeleteTagId = tagId;
            uiState.pendingDeleteTagId = tagId;
            uiState.tagDeleteConfirmCount += 1;
            deleteView.setText("确认删除");
            deleteView.setContentDescription("再次点击删除标签，当前关联 " +
                String(Number(itemCount || 0)) + " 条记录");
            return false;
        }
        pendingDeleteTagId = null;
        uiState.pendingDeleteTagId = null;
        return deleteTagRow(tagId);
    }

    function bindTagDrag(handle, rowRoot, tagId) {
        var startY = 0;
        var dragging = false;
        handle.setOnTouchListener(new JavaAdapter(View.OnTouchListener, {
            onTouch: function (view, event) {
                var action = Number(event.getActionMasked());
                var delta;
                if (action === MotionEvent.ACTION_DOWN) {
                    startY = Number(event.getRawY());
                    dragging = true;
                    uiState.tagDragStartCount += 1;
                    uiState.lastDraggedTagId = Number(tagId);
                    rowRoot.setAlpha(0.92);
                    return true;
                }
                if (action === MotionEvent.ACTION_MOVE && dragging) {
                    delta = Math.max(-dp(64), Math.min(dp(64),
                        Number(event.getRawY()) - startY));
                    rowRoot.setTranslationY(delta);
                    return true;
                }
                if ((action === MotionEvent.ACTION_UP ||
                        action === MotionEvent.ACTION_CANCEL) && dragging) {
                    delta = Number(event.getRawY()) - startY;
                    dragging = false;
                    rowRoot.setTranslationY(0);
                    rowRoot.setAlpha(1);
                    if (Math.abs(delta) >= dp(28)) {
                        if (moveTag(Number(tagId), delta > 0 ? 1 : -1)) {
                            uiState.tagDragCommitCount += 1;
                        }
                    }
                    return true;
                }
                return false;
            }
        }));
    }

    function emitTagsChanged(action, tagId) {
        try {
            if (ClipHub.EventBus && typeof ClipHub.EventBus.emit === "function") {
                ClipHub.EventBus.emit("tags_changed", {
                    action: String(action), tagId: Number(tagId || 0),
                    at: ClipHub.Base.now()
                });
            }
        } catch (ignored) {}
    }

    function createTagFromSettings() {
        var name;
        var color;
        var id;
        try {
            name = newTagNameInput === null ? "" :
                String(newTagNameInput.getText());
            color = parseColorValue(newTagColorInput === null ? "" :
                String(newTagColorInput.getText()),
                Number(Color.parseColor("#7C5CFC")));
            id = Number(ClipHub.Repository.insertTag({
                name: name, colorValue: color,
                manualOrder: ClipHub.Repository.listTags().length * 1000
            }));
            uiState.tagCreateCount += 1;
            emitTagsChanged("tag_created", id);
            rebuildTagPage();
            return true;
        } catch (error) {
            uiState.lastError = String(error);
            return false;
        }
    }

    function saveTagRow(tagId, nameInput, colorInput) {
        var changed;
        try {
            changed = ClipHub.Repository.updateTag(Number(tagId), {
                name: String(nameInput.getText()),
                colorValue: parseColorValue(String(colorInput.getText()), null)
            });
            if (Number(changed) > 0) {
                uiState.tagUpdateCount += 1;
                emitTagsChanged("tag_updated", tagId);
                buildPage();
                return true;
            }
            return false;
        } catch (error) {
            uiState.lastError = String(error);
            return false;
        }
    }

    function deleteTagRow(tagId) {
        try {
            if (ClipHub.Repository.deleteTag(Number(tagId)) > 0) {
                uiState.tagDeleteCount += 1;
                emitTagsChanged("tag_deleted", tagId);
                buildPage();
                return true;
            }
            return false;
        } catch (error) {
            uiState.lastError = String(error);
            return false;
        }
    }

    function moveTag(tagId, delta) {
        var tags = ClipHub.Repository.listTags();
        var ids = [];
        var index;
        var current = -1;
        var target;
        for (index = 0; index < tags.length; index += 1) {
            ids.push(Number(tags[index].id));
            if (Number(tags[index].id) === Number(tagId)) { current = index; }
        }
        target = current + Number(delta);
        if (current < 0 || target < 0 || target >= ids.length) { return false; }
        ids.splice(current, 1);
        ids.splice(target, 0, Number(tagId));
        try {
            ClipHub.Repository.reorderTags(ids);
            uiState.tagReorderCount += 1;
            emitTagsChanged("tag_reordered", tagId);
            rebuildTagPage();
            return true;
        } catch (error) {
            uiState.lastError = String(error);
            return false;
        }
    }

    function clearSearchHistory() {
        try {
            setValue("filterSearchHistory", [], { cleanup: false });
            uiState.clearHistoryCount += 1;
            return true;
        } catch (error) {
            uiState.lastError = String(error);
            return false;
        }
    }

    function makeSectionTitle(section, title, subtitle, colors) {
        var titleView = makeText(title, 14, colors.textPrimary, true);
        var subtitleView = makeText(subtitle, 9, colors.textSecondary, false);
        var params;
        section.addView(titleView, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(2);
        params.bottomMargin = dp(8);
        section.addView(subtitleView, params);
    }

    function makeGeneralSection(colors) {
        var section = makeSection(colors);
        var row = new LinearLayout(appContext);
        var clearView;
        var params;
        makeSectionTitle(section, "常规",
            "敏感内容、搜索历史与复制行为", colors);
        row.setOrientation(LinearLayout.HORIZONTAL);
        sensitivePolicyView = makeButton("", colors, false, false);
        sensitivePolicyView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, { onClick: function () {
                setValue("sensitivePolicy",
                    values.sensitivePolicy === "save" ? "skip" : "save",
                    { cleanup: false });
                updateGeneralButtons(colors);
            }}));
        historyEnabledView = makeButton("", colors, false, false);
        historyEnabledView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, { onClick: function () {
                setValue("searchHistoryEnabled", !values.searchHistoryEnabled,
                    { cleanup: false });
                updateGeneralButtons(colors);
            }}));
        params = new LinearLayout.LayoutParams(0, dp(40), 1);
        params.rightMargin = dp(6);
        row.addView(sensitivePolicyView, params);
        row.addView(historyEnabledView,
            new LinearLayout.LayoutParams(0, dp(40), 1));
        section.addView(row, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(40)));
        clearView = makeButton("清空搜索历史", colors, false, false);
        clearView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, { onClick: clearSearchHistory }));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(40));
        params.topMargin = dp(7);
        section.addView(clearView, params);
        updateGeneralButtons(colors);
        return section;
    }

    function makeTranslationSection(colors) {
        var section = makeSection(colors);
        var engineRow = new LinearLayout(appContext);
        var actionRow = new LinearLayout(appContext);
        var saveButton;
        var testButton;
        var params;
        makeSectionTitle(section, "翻译",
            "中文自动译为英文，非中文自动译为中文", colors);
        draftEngine = String(values["translation.engine"] || "baidu");
        engineRow.setOrientation(LinearLayout.HORIZONTAL);
        engineBaiduView = makeButton("百度翻译", colors, false, false);
        engineYoudaoView = makeButton("有道翻译", colors, false, false);
        engineBaiduView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, { onClick: function () {
                draftEngine = "baidu";
                updateEngineViews(colors);
            }}));
        engineYoudaoView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, { onClick: function () {
                draftEngine = "youdao";
                updateEngineViews(colors);
            }}));
        params = new LinearLayout.LayoutParams(0, dp(40), 1);
        params.rightMargin = dp(6);
        engineRow.addView(engineBaiduView, params);
        engineRow.addView(engineYoudaoView,
            new LinearLayout.LayoutParams(0, dp(40), 1));
        section.addView(engineRow, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(40)));

        baiduGroup = new LinearLayout(appContext);
        baiduGroup.setOrientation(LinearLayout.VERTICAL);
        baiduIdInput = makeInput("百度 APP ID",
            values["translation.baidu.app_id"], colors, false);
        baiduSecretInput = makeInput("百度密钥",
            values["translation.baidu.app_secret"], colors, true);
        addField(baiduGroup, "百度 APP ID", baiduIdInput, colors);
        addField(baiduGroup, "百度密钥", baiduSecretInput, colors);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(8);
        section.addView(baiduGroup, params);

        youdaoGroup = new LinearLayout(appContext);
        youdaoGroup.setOrientation(LinearLayout.VERTICAL);
        youdaoKeyInput = makeInput("有道 App Key",
            values["translation.youdao.app_key"], colors, false);
        youdaoSecretInput = makeInput("有道应用密钥",
            values["translation.youdao.app_secret"], colors, true);
        addField(youdaoGroup, "有道 App Key", youdaoKeyInput, colors);
        addField(youdaoGroup, "有道应用密钥", youdaoSecretInput, colors);
        section.addView(youdaoGroup, params);

        translationStatusView = makeText("配置存储于 ClipHub SQLite",
            9, colors.textSecondary, false);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(6);
        section.addView(translationStatusView, params);
        actionRow.setOrientation(LinearLayout.HORIZONTAL);
        saveButton = makeButton("保存配置", colors, true, false);
        testButton = makeButton("测试翻译", colors, false, false);
        saveButton.setOnClickListener(new JavaAdapter(
            View.OnClickListener, { onClick: saveTranslationSettings }));
        testButton.setOnClickListener(new JavaAdapter(
            View.OnClickListener, { onClick: testTranslationSettings }));
        params = new LinearLayout.LayoutParams(0, dp(40), 1);
        params.rightMargin = dp(6);
        actionRow.addView(saveButton, params);
        actionRow.addView(testButton,
            new LinearLayout.LayoutParams(0, dp(40), 1));
        section.addView(actionRow, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(40)));
        updateEngineViews(colors);
        return section;
    }

    function makeTagRow(tag, index, total, colors) {
        var root = new LinearLayout(appContext);
        var first = new LinearLayout(appContext);
        var actions = new LinearLayout(appContext);
        var handle = makeText("≡", 18, colors.textTertiary, true);
        var swatch = makeColorSwatch(tag.color_value, colors);
        var nameInput = makeInput("标签名称", String(tag.name), colors, false);
        var colorInput = makeInput("#RRGGBB", colorText(tag.color_value),
            colors, false);
        var count = makeText(String(Number(tag.item_count || 0)) + " 条记录",
            9, colors.textSecondary, false);
        var save = makeButton("保存", colors, false, false);
        var del = makeButton("删除", colors, false, true);
        var params;
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(8), dp(8), dp(8), dp(8));
        root.setBackground(roundedBackground(colors.surfaceMuted,
            colors.stroke, 12));
        first.setOrientation(LinearLayout.HORIZONTAL);
        first.setGravity(Gravity.CENTER_VERTICAL);
        handle.setGravity(Gravity.CENTER);
        handle.setContentDescription("拖动排序标签 " + String(tag.name));
        params = new LinearLayout.LayoutParams(dp(32), dp(40));
        params.rightMargin = dp(5);
        first.addView(handle, params);
        params = new LinearLayout.LayoutParams(dp(22), dp(22));
        params.rightMargin = dp(7);
        first.addView(swatch, params);
        params = new LinearLayout.LayoutParams(0, dp(40), 1);
        params.rightMargin = dp(5);
        first.addView(nameInput, params);
        first.addView(colorInput,
            new LinearLayout.LayoutParams(dp(88), dp(40)));
        root.addView(first, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(40)));
        actions.setOrientation(LinearLayout.HORIZONTAL);
        actions.setGravity(Gravity.CENTER_VERTICAL);
        actions.addView(count, new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        (function (tagId, itemCount) {
            save.setOnClickListener(new JavaAdapter(View.OnClickListener, {
                onClick: function () {
                    pendingDeleteTagId = null;
                    uiState.pendingDeleteTagId = null;
                    saveTagRow(tagId, nameInput, colorInput);
                }
            }));
            del.setOnClickListener(new JavaAdapter(View.OnClickListener, {
                onClick: function () {
                    requestDeleteTag(tagId, itemCount, del);
                }
            }));
            bindTagDrag(handle, root, tagId);
        }(Number(tag.id), Number(tag.item_count || 0)));
        actions.addView(save, new LinearLayout.LayoutParams(dp(58), dp(34)));
        params = new LinearLayout.LayoutParams(dp(68), dp(34));
        params.leftMargin = dp(5);
        actions.addView(del, params);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(34));
        params.topMargin = dp(6);
        root.addView(actions, params);
        bindColorPreview(colorInput, swatch,
            Number(tag.color_value || Color.parseColor("#7C5CFC")), colors);
        tagRowViews[String(tag.id)] = {
            root: root, name: nameInput, color: colorInput,
            handle: handle, swatch: swatch, save: save, deleteView: del
        };
        return root;
    }

    function makeTagsSection(colors) {
        var section = makeSection(colors);
        var createRow = new LinearLayout(appContext);
        var createButton;
        var preview;
        var tags = ClipHub.Repository.listTags();
        var index;
        var params;
        var empty;
        makeSectionTitle(section, "标签管理",
            "拖动排序 · 颜色预览 · 删除只解除关联", colors);
        createRow.setOrientation(LinearLayout.HORIZONTAL);
        createRow.setGravity(Gravity.CENTER_VERTICAL);
        preview = makeColorSwatch(Number(Color.parseColor("#7C5CFC")), colors);
        params = new LinearLayout.LayoutParams(dp(24), dp(24));
        params.rightMargin = dp(6);
        createRow.addView(preview, params);
        newTagNameInput = makeInput("新标签名称", "", colors, false);
        newTagColorInput = makeInput("#7C5CFC", "#7C5CFC", colors, false);
        createButton = makeButton("新增", colors, true, false);
        createButton.setOnClickListener(new JavaAdapter(
            View.OnClickListener, { onClick: createTagFromSettings }));
        params = new LinearLayout.LayoutParams(0, dp(40), 1);
        params.rightMargin = dp(5);
        createRow.addView(newTagNameInput, params);
        params = new LinearLayout.LayoutParams(dp(88), dp(40));
        params.rightMargin = dp(5);
        createRow.addView(newTagColorInput, params);
        createRow.addView(createButton,
            new LinearLayout.LayoutParams(dp(54), dp(40)));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(40));
        params.bottomMargin = dp(8);
        section.addView(createRow, params);
        bindColorPreview(newTagColorInput, preview,
            Number(Color.parseColor("#7C5CFC")), colors);
        tagRowViews = {};
        for (index = 0; index < tags.length; index += 1) {
            params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
            params.bottomMargin = dp(6);
            section.addView(makeTagRow(tags[index], index, tags.length, colors),
                params);
        }
        uiState.tagRowCount = tags.length;
        if (tags.length === 0) {
            empty = makeText("暂无标签", 11, colors.textSecondary, false);
            empty.setGravity(Gravity.CENTER);
            empty.setPadding(dp(8), dp(18), dp(8), dp(18));
            section.addView(empty, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));
        }
        return section;
    }

    function makeDataSection(colors) {
        var section = makeSection(colors);
        var path = initContext && initContext.runtimeDir ?
            String(initContext.runtimeDir) + "/data/cliphub.db" : "";
        var text;
        makeSectionTitle(section, "数据与关于",
            "当前数据库和模块运行信息", colors);
        text = makeText(
            "剪贴板记录：" + String(ClipHub.Repository.countItems(false)) +
            "\n标签数量：" + String(ClipHub.Repository.listTags().length) +
            "\n数据库：" + path +
            "\nSchema：v" + String(ClipHub.Database.getVersion()) +
            "\n模块集：" + String(initContext.moduleSetVersion || "运行中"),
            10, colors.textSecondary, false);
        text.setTextIsSelectable(true);
        text.setLineSpacing(0, 1.15);
        section.addView(text, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        return section;
    }

    function buildPage() {
        var colors = palette();
        var content = new LinearLayout(appContext);
        var header = new LinearLayout(appContext);
        var title = makeText("ClipHub 设置", 18, colors.textPrimary, true);
        var params;
        if (scrollRoot === null) { return false; }
        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(dp(12), dp(9), dp(12), dp(28));
        (function () {
            var handleRow = new LinearLayout(appContext);
            var handle = new View(appContext);
            handleRow.setGravity(Gravity.CENTER);
            handle.setBackground(roundedBackground(colors.accentBorder,
                null, 3));
            handleRow.addView(handle,
                new LinearLayout.LayoutParams(dp(42), dp(4)));
            content.addView(handleRow, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(16)));
        }());
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.addView(title, new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        closeView = makeText("×", 22, colors.icon, true);
        closeView.setGravity(Gravity.CENTER);
        closeView.setBackground(roundedBackground(colors.surfaceMuted,
            null, 18));
        closeView.setClickable(true);
        closeView.setFocusable(true);
        closeView.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { closePage("button"); }
        }));
        header.addView(closeView, new LinearLayout.LayoutParams(dp(38), dp(38)));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(42));
        params.bottomMargin = dp(8);
        content.addView(header, params);

        addSection(content, makeGeneralSection(colors));
        translationSectionView = makeTranslationSection(colors);
        addSection(content, translationSectionView);
        tagsSectionView = makeTagsSection(colors);
        addSection(content, tagsSectionView);
        dataSectionView = makeDataSection(colors);
        addSection(content, dataSectionView);
        scrollRoot.removeAllViews();
        scrollRoot.addView(content, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT));
        uiState.renderCount += 1;
        return true;
    }

    function panelSize() {
        var metrics = appContext.getResources().getDisplayMetrics();
        var widthDp = Math.min(390, Math.max(300,
            Number(metrics.widthPixels) / density - 20));
        var heightDp = Math.min(720, Math.max(560,
            Number(metrics.heightPixels) / density - 170));
        return { width: dp(widthDp), height: dp(heightDp),
            widthDp: widthDp, heightDp: heightDp };
    }

    function openPage() {
        var size;
        var type;
        requireReady();
        if (uiState.attached) { return getState(); }
        return runOnMainSync(function () {
            size = panelSize();
            type = Build.VERSION.SDK_INT >= 26 ?
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY :
                WindowManager.LayoutParams.TYPE_SYSTEM_ALERT;
            panelRoot = new FrameLayout(appContext);
            panelRoot.setBackground(roundedBackground(palette().surface,
                palette().stroke, 24));
            if (Build.VERSION.SDK_INT >= 21) { panelRoot.setElevation(dp(20)); }
            scrollRoot = new ScrollView(appContext);
            scrollRoot.setVerticalScrollBarEnabled(false);
            panelRoot.addView(scrollRoot, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));
            panelParams = new WindowManager.LayoutParams(
                size.width, size.height, type,
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
                    WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED |
                    WindowManager.LayoutParams.FLAG_DIM_BEHIND,
                PixelFormat.TRANSLUCENT);
            panelParams.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
            panelParams.y = dp(10);
            panelParams.dimAmount = 0.44;
            try { panelParams.setTitle("ClipHub Detail Settings Panel"); }
            catch (ignoredTitle) {}
            windowManager.addView(panelRoot, panelParams);
            uiState.attached = true;
            uiState.openCount += 1;
            uiState.panelWidthDp = size.widthDp;
            uiState.panelHeightDp = size.heightDp;
            uiState.lastError = null;
            buildPage();
            try {
                if (ClipHub.Navigation && ClipHub.Navigation.scanNow) {
                    ClipHub.Navigation.scanNow();
                }
            } catch (ignoredScan) {}
            return getState();
        }, 3000);
    }

    function closePage(reason) {
        if (!uiState.attached && panelRoot === null) { return true; }
        return runOnMainSync(function () {
            try {
                if (panelRoot !== null) {
                    try { windowManager.removeViewImmediate(panelRoot); }
                    catch (error) {
                        if (panelRoot.isAttachedToWindow()) { throw error; }
                    }
                }
                uiState.closeCount += 1;
                uiState.lastError = null;
                return true;
            } finally {
                uiState.attached = false;
                panelRoot = null;
                panelParams = null;
                scrollRoot = null;
                translationStatusView = null;
                engineBaiduView = null;
                engineYoudaoView = null;
                baiduGroup = null;
                youdaoGroup = null;
                baiduIdInput = null;
                baiduSecretInput = null;
                youdaoKeyInput = null;
                youdaoSecretInput = null;
                newTagNameInput = null;
                newTagColorInput = null;
                closeView = null;
                sensitivePolicyView = null;
                historyEnabledView = null;
                tagRowViews = {};
                translationSectionView = null;
                tagsSectionView = null;
                dataSectionView = null;
                pendingDeleteTagId = null;
                uiState.pendingDeleteTagId = null;
            }
        }, 3000);
    }

    function scrollToSection(name) {
        var target = null;
        name = String(name || "");
        if (name === "translation") { target = translationSectionView; }
        if (name === "tags") { target = tagsSectionView; }
        if (name === "data") { target = dataSectionView; }
        if (scrollRoot === null || target === null) { return false; }
        return runOnMainSync(function () {
            var y = Math.max(0, Number(target.getTop()) - dp(8));
            scrollRoot.scrollTo(0, y);
            return true;
        }, 3000);
    }

    function getState() {
        var attachedToWindow = false;
        try {
            attachedToWindow = panelRoot !== null &&
                panelRoot.isAttachedToWindow();
        } catch (ignored) {}
        return {
            ready: ready,
            attached: uiState.attached,
            attachedToWindow: attachedToWindow,
            open: uiState.attached,
            openCount: Number(uiState.openCount),
            closeCount: Number(uiState.closeCount),
            renderCount: Number(uiState.renderCount),
            saveTranslationCount: Number(uiState.saveTranslationCount),
            testTranslationCount: Number(uiState.testTranslationCount),
            testTranslationSuccessCount:
                Number(uiState.testTranslationSuccessCount),
            tagCreateCount: Number(uiState.tagCreateCount),
            tagUpdateCount: Number(uiState.tagUpdateCount),
            tagDeleteCount: Number(uiState.tagDeleteCount),
            tagReorderCount: Number(uiState.tagReorderCount),
            tagDragStartCount: Number(uiState.tagDragStartCount),
            tagDragCommitCount: Number(uiState.tagDragCommitCount),
            tagColorPreviewCount: Number(uiState.tagColorPreviewCount),
            tagDeleteConfirmCount: Number(uiState.tagDeleteConfirmCount),
            lastDraggedTagId: uiState.lastDraggedTagId,
            pendingDeleteTagId: uiState.pendingDeleteTagId,
            dragReorderEnabled: true,
            deleteRequiresConfirmation: true,
            clearHistoryCount: Number(uiState.clearHistoryCount),
            settingsStyle: uiState.settingsStyle,
            sectionCount: Number(uiState.sectionCount),
            translationFieldCount: Number(uiState.translationFieldCount),
            tagRowCount: Number(uiState.tagRowCount),
            selectedEngine: String(draftEngine),
            configuredEngine: String(values["translation.engine"] || "baidu"),
            baiduAppIdStored:
                String(values["translation.baidu.app_id"] || "").length > 0,
            baiduSecretStored:
                String(values["translation.baidu.app_secret"] || "").length > 0,
            youdaoAppKeyStored:
                String(values["translation.youdao.app_key"] || "").length > 0,
            youdaoSecretStored:
                String(values["translation.youdao.app_secret"] || "").length > 0,
            contentTypeSettingsPresent: false,
            panelWidthDp: Number(uiState.panelWidthDp),
            panelHeightDp: Number(uiState.panelHeightDp),
            lastTestResult: uiState.lastTestResult,
            lastError: uiState.lastError
        };
    }

    ClipHub.Settings = {
        MODULE_NAME: "ch_13_settings",
        MODULE_VERSION: 6,
        DEFAULTS: defaultsCopy(),
        init: function (context) {
            if (!ClipHub.Database || !ClipHub.Database.isOpen()) {
                throw new Error("Database is unavailable for settings");
            }
            initContext = context || {};
            appContext = initContext.androidContext || global.context;
            if (!appContext) { throw new Error("Android context unavailable"); }
            appContext = appContext.getApplicationContext() || appContext;
            windowManager = appContext.getSystemService(Context.WINDOW_SERVICE);
            mainHandler = new Handler(Looper.getMainLooper());
            density = Number(appContext.getResources()
                .getDisplayMetrics().density || 1);
            load();
            ready = true;
            applyClipboard();
            cleanup();
            return { ok: true, ready: true, values: getAll(),
                cleanup: getLastCleanup() };
        },
        isReady: function () { return ready; },
        get: function (key, fallback) {
            key = String(key);
            return Object.prototype.hasOwnProperty.call(values, key) ?
                copyValue(values[key]) : fallback;
        },
        getAll: getAll,
        getLastCleanup: getLastCleanup,
        set: setValue,
        setMany: setMany,
        reload: function () {
            requireReady();
            load();
            applyClipboard();
            return getAll();
        },
        applyClipboard: applyClipboard,
        cleanup: cleanup,
        open: openPage,
        close: closePage,
        getState: getState,
        isAttached: function () { return uiState.attached === true; },
        performSaveTranslationClick: saveTranslationSettings,
        performTestTranslationClick: testTranslationSettings,
        scrollToSection: scrollToSection,
        performCreateTag: function (name, colorTextValue) {
            return runOnMainSync(function () {
                if (newTagNameInput === null || newTagColorInput === null) {
                    return false;
                }
                newTagNameInput.setText(String(name || ""));
                newTagColorInput.setText(String(colorTextValue || "#7C5CFC"));
                return createTagFromSettings();
            }, 3000);
        },
        performUpdateTag: function (tagId, name, colorTextValue) {
            tagId = String(Number(tagId));
            return runOnMainSync(function () {
                var row = tagRowViews[tagId];
                if (!row) { return false; }
                row.name.setText(String(name || ""));
                row.color.setText(String(colorTextValue || "#7C5CFC"));
                return row.save.performClick();
            }, 3000);
        },
        performMoveTag: function (tagId, delta) {
            return runOnMainSync(function () {
                return moveTag(Number(tagId), Number(delta));
            }, 3000);
        },
        performDeleteTagConfirm: function (tagId) {
            tagId = String(Number(tagId));
            return runOnMainSync(function () {
                var row = tagRowViews[tagId];
                if (!row) { return false; }
                row.deleteView.performClick();
                return row.deleteView.performClick();
            }, 3000);
        },
        getTagOrder: function () {
            var tags = ClipHub.Repository.listTags();
            var ids = [];
            var index;
            for (index = 0; index < tags.length; index += 1) {
                ids.push(Number(tags[index].id));
            }
            return ids;
        },
        reset: function (options) {
            var defaults = defaultsCopy();
            requireReady();
            ClipHub.Database.transaction(function () {
                var key;
                ClipHub.Database.executeUpdateDelete("DELETE FROM settings", []);
                for (key in defaults) {
                    if (defaults.hasOwnProperty(key)) {
                        persist(key, defaults[key]);
                    }
                }
            });
            values = defaults;
            applyClipboard();
            if (!options || options.cleanup !== false) { cleanup(); }
            return getAll();
        },
        shutdown: function () {
            try { closePage("shutdown"); } catch (ignoredClose) {}
            values = {};
            lastCleanup = null;
            ready = false;
            initContext = null;
            appContext = null;
            windowManager = null;
            mainHandler = null;
            return true;
        }
    };
}((function () { return this; }())));
