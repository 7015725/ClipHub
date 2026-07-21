(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var Context = Packages.android.content.Context;
    var Build = Packages.android.os.Build;
    var Looper = Packages.android.os.Looper;
    var Handler = Packages.android.os.Handler;
    var CountDownLatch = Packages.java.util.concurrent.CountDownLatch;
    var TimeUnit = Packages.java.util.concurrent.TimeUnit;
    var Thread = Packages.java.lang.Thread;
    var View = Packages.android.view.View;
    var Gravity = Packages.android.view.Gravity;
    var WindowManager = Packages.android.view.WindowManager;
    var PixelFormat = Packages.android.graphics.PixelFormat;
    var Color = Packages.android.graphics.Color;
    var GradientDrawable = Packages.android.graphics.drawable.GradientDrawable;
    var LinearLayout = Packages.android.widget.LinearLayout;
    var ScrollView = Packages.android.widget.ScrollView;
    var HorizontalScrollView = Packages.android.widget.HorizontalScrollView;
    var TextView = Packages.android.widget.TextView;
    var EditText = Packages.android.widget.EditText;
    var TypedValue = Packages.android.util.TypedValue;
    var InputType = Packages.android.text.InputType;
    var EditorInfo = Packages.android.view.inputmethod.EditorInfo;
    var InputMethodManager = Packages.android.view.inputmethod.InputMethodManager;
    var DisplayMetrics = Packages.android.util.DisplayMetrics;

    var androidContext = null;
    var appContext = null;
    var windowManager = null;
    var inputMethodManager = null;
    var mainHandler = null;
    var density = 1;
    var value = null;
    var ready = false;
    var eventListeners = [];
    var panelRoot = null;
    var panelParams = null;
    var keywordInput = null;
    var searchView = null;
    var resetView = null;
    var closeView = null;
    var sourceViews = {};
    var typeViews = {};
    var state = {
        applyCount: 0,
        eventApplyCount: 0,
        lastResultCount: 0,
        lastApplyThreadId: null,
        lastApplyThreadName: null,
        panelAttached: false,
        panelOpenCount: 0,
        panelCloseCount: 0,
        panelRenderCount: 0,
        searchActionCount: 0,
        sourceToggleCount: 0,
        typeToggleCount: 0,
        resetActionCount: 0,
        keyboardRequestCount: 0,
        panelWindowType: null,
        panelFlags: null,
        panelAddThreadId: null,
        panelAddThreadName: null,
        panelRemoveThreadId: null,
        panelRemoveThreadName: null,
        lastUiThreadId: null,
        lastUiThreadName: null,
        inputFocused: false,
        sourceOptionCount: 0,
        contentTypeOptionCount: 0,
        lastError: null
    };

    function dp(number) {
        return Math.max(1, Math.floor(Number(number) * density + 0.5));
    }

    function normalizeText(input) {
        return String(input === null || input === undefined ? "" : input)
            .replace(/^\s+|\s+$/g, "");
    }

    function normalizeList(input) {
        var source = input instanceof Array ? input : [];
        var seen = {};
        var output = [];
        var index;
        var text;
        for (index = 0; index < source.length; index += 1) {
            text = normalizeText(source[index]);
            if (text.length > 0 && !seen[text]) {
                seen[text] = true;
                output.push(text);
            }
        }
        return output;
    }

    function copyList(input) {
        var output = [];
        var index;
        input = input || [];
        for (index = 0; index < input.length; index += 1) {
            output.push(input[index]);
        }
        return output;
    }

    function contains(input, target) {
        var index;
        input = input || [];
        for (index = 0; index < input.length; index += 1) {
            if (String(input[index]) === String(target)) { return true; }
        }
        return false;
    }

    function toggle(input, target) {
        var output = [];
        var found = false;
        var index;
        for (index = 0; index < input.length; index += 1) {
            if (String(input[index]) === String(target)) {
                found = true;
            } else {
                output.push(input[index]);
            }
        }
        if (!found) { output.push(String(target)); }
        return output;
    }

    function emptyValue() {
        return {
            keyword: "",
            sourcePackages: [],
            contentTypes: [],
            tagIds: [],
            pinnedOnly: false,
            sensitiveMode: "all"
        };
    }

    function copyValue(input) {
        input = input || emptyValue();
        return {
            keyword: String(input.keyword || ""),
            sourcePackages: copyList(input.sourcePackages),
            contentTypes: copyList(input.contentTypes),
            tagIds: copyList(input.tagIds),
            pinnedOnly: input.pinnedOnly === true,
            sensitiveMode: String(input.sensitiveMode || "all")
        };
    }

    function isActive(input) {
        input = input || value || emptyValue();
        return normalizeText(input.keyword).length > 0 ||
            input.sourcePackages.length > 0 ||
            input.contentTypes.length > 0 ||
            input.pinnedOnly === true ||
            String(input.sensitiveMode || "all") !== "all";
    }

    function validateSensitiveMode(mode) {
        mode = String(mode || "all");
        if (mode !== "all" && mode !== "only" && mode !== "exclude") {
            throw new Error("Invalid sensitive filter mode");
        }
        return mode;
    }

    function toQueryOptions(extra) {
        var options = {};
        var key;
        extra = extra || {};
        for (key in extra) {
            if (extra.hasOwnProperty(key)) { options[key] = extra[key]; }
        }
        options.keyword = value.keyword;
        options.sourcePackages = copyList(value.sourcePackages);
        options.contentTypes = copyList(value.contentTypes);
        options.pinnedOnly = value.pinnedOnly;
        if (value.sensitiveMode === "only") { options.sensitiveOnly = true; }
        if (value.sensitiveMode === "exclude") { options.excludeSensitive = true; }
        return options;
    }

    function nowThread() {
        var thread = Thread.currentThread();
        return { id: Number(thread.getId()), name: String(thread.getName()) };
    }

    function runOnMainSync(callback, timeoutMs) {
        var mainLooper = Looper.getMainLooper();
        var currentLooper = Looper.myLooper();
        var box;
        var latch;
        var runnable;
        var posted;
        var completed;
        if (mainLooper !== null && currentLooper !== null &&
                currentLooper === mainLooper) {
            return { ok: true, value: callback(), direct: true };
        }
        box = { ok: false, value: null, error: null };
        latch = new CountDownLatch(1);
        runnable = new Packages.java.lang.Runnable({
            run: function () {
                try {
                    box.value = callback();
                    box.ok = true;
                } catch (error) {
                    box.error = error;
                } finally {
                    latch.countDown();
                }
            }
        });
        posted = mainHandler.post(runnable);
        if (!posted) {
            return { ok: false, error: new Error("Filter main handler post failed") };
        }
        completed = latch.await(Number(timeoutMs || 2500), TimeUnit.MILLISECONDS);
        if (!completed) {
            try { mainHandler.removeCallbacks(runnable); } catch (ignored) {}
            return { ok: false, error: new Error("Filter main handler timeout") };
        }
        return box;
    }

    function requireMain(result) {
        if (!result || result.ok !== true) {
            throw result && result.error ? result.error :
                new Error("Filter main-thread operation failed");
        }
        return result.value;
    }

    function emitChanged(rows, origin) {
        var thread = Thread.currentThread();
        var payload = {
            active: isActive(value),
            criteria: {
                keyword: String(value.keyword || ""),
                sourcePackages: copyList(value.sourcePackages),
                types: copyList(value.contentTypes),
                pinnedOnly: value.pinnedOnly === true,
                sensitiveMode: String(value.sensitiveMode || "all")
            },
            resultCount: rows.length,
            origin: String(origin || "manual"),
            threadId: Number(thread.getId()),
            threadName: String(thread.getName())
        };
        try {
            if (ClipHub.EventBus && typeof ClipHub.EventBus.emit === "function") {
                ClipHub.EventBus.emit("filter_changed", payload);
            }
        } catch (ignored) {}
    }

    function apply(options) {
        var queryOptions;
        var rows;
        var thread;
        options = options || {};
        if (!ready || value === null) {
            throw new Error("ClipHub filter is not ready");
        }
        queryOptions = toQueryOptions({
            limit: options.limit === undefined ? 100 : options.limit,
            offset: options.offset === undefined ? 0 : options.offset
        });
        try {
            rows = ClipHub.Repository.listItems(queryOptions);
            if (ClipHub.List && typeof ClipHub.List.setItems === "function") {
                ClipHub.List.setItems(rows);
            }
            state.applyCount += 1;
            if (options.fromEvent === true) { state.eventApplyCount += 1; }
            state.lastResultCount = rows.length;
            thread = Thread.currentThread();
            state.lastApplyThreadId = Number(thread.getId());
            state.lastApplyThreadName = String(thread.getName());
            state.lastError = null;
            emitChanged(rows,
                options.origin || (options.fromEvent ? "event" : "manual"));
            return rows;
        } catch (error) {
            state.lastError = String(error);
            throw error;
        }
    }

    function applyIfRequested(options) {
        options = options || {};
        if (options.apply === false || !ready) { return copyValue(value); }
        apply({
            limit: options.limit,
            offset: options.offset,
            origin: options.origin || "criteria",
            fromEvent: options.fromEvent === true
        });
        return copyValue(value);
    }

    function setValue(patch, options) {
        patch = patch || {};
        if (patch.hasOwnProperty("keyword")) {
            value.keyword = normalizeText(patch.keyword);
        }
        if (patch.hasOwnProperty("sourcePackages")) {
            value.sourcePackages = normalizeList(patch.sourcePackages);
        }
        if (patch.hasOwnProperty("contentTypes")) {
            value.contentTypes = normalizeList(patch.contentTypes);
        }
        if (patch.hasOwnProperty("pinnedOnly")) {
            value.pinnedOnly = patch.pinnedOnly === true;
        }
        if (patch.hasOwnProperty("sensitiveMode")) {
            value.sensitiveMode = validateSensitiveMode(patch.sensitiveMode);
        }
        return applyIfRequested(options);
    }

    function reset(options) {
        value = emptyValue();
        return applyIfRequested(options);
    }

    function onClipboardChange() {
        if (!ready || !isActive(value)) { return; }
        try {
            apply({ fromEvent: true, origin: "clipboard_event" });
        } catch (error) {
            state.lastError = String(error);
        }
    }

    function registerEvent(name) {
        var listener = onClipboardChange;
        if (ClipHub.EventBus && typeof ClipHub.EventBus.on === "function") {
            ClipHub.EventBus.on(name, listener);
            eventListeners.push({ name: name, listener: listener });
        }
    }

    function unregisterEvents() {
        var index;
        if (ClipHub.EventBus && typeof ClipHub.EventBus.off === "function") {
            for (index = 0; index < eventListeners.length; index += 1) {
                ClipHub.EventBus.off(
                    eventListeners[index].name,
                    eventListeners[index].listener
                );
            }
        }
        eventListeners = [];
    }

    function isDarkMode() {
        var mode = "system";
        var config;
        try {
            if (ClipHub.Settings && typeof ClipHub.Settings.get === "function") {
                mode = String(ClipHub.Settings.get("themeMode", "system"));
            }
        } catch (ignored) {}
        if (mode === "dark") { return true; }
        if (mode === "light") { return false; }
        try {
            config = appContext.getResources().getConfiguration();
            return (Number(config.uiMode) &
                Number(Packages.android.content.res.Configuration.UI_MODE_NIGHT_MASK)) ===
                Number(Packages.android.content.res.Configuration.UI_MODE_NIGHT_YES);
        } catch (ignoredConfig) { return false; }
    }

    function roundedBackground(fill, stroke, radiusDp) {
        var drawable = new GradientDrawable();
        drawable.setShape(GradientDrawable.RECTANGLE);
        drawable.setColor(Color.parseColor(String(fill)));
        drawable.setCornerRadius(dp(radiusDp));
        if (stroke !== null) {
            drawable.setStroke(dp(1), Color.parseColor(String(stroke)));
        }
        return drawable;
    }

    function makeText(text, sizeSp, color, bold) {
        var view = new TextView(appContext);
        view.setText(String(text));
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, Number(sizeSp));
        view.setTextColor(Color.parseColor(String(color)));
        view.setIncludeFontPadding(false);
        if (bold) {
            view.setTypeface(Packages.android.graphics.Typeface.DEFAULT,
                Packages.android.graphics.Typeface.BOLD);
        }
        return view;
    }

    function makeButton(text, dark, selected) {
        var view = makeText(text, 12,
            selected ? (dark ? "#FFDCEEFF" : "#FF275A8A") :
                (dark ? "#FFE4E4E7" : "#FF3F3F46"), true);
        view.setGravity(Gravity.CENTER);
        view.setPadding(dp(11), dp(7), dp(11), dp(7));
        view.setBackground(roundedBackground(
            selected ? (dark ? "#FF364A61" : "#FFE4EEF9") :
                (dark ? "#FF292C32" : "#FFF1F1F3"),
            selected ? (dark ? "#667DB4E8" : "#55719BC6") :
                (dark ? "#28FFFFFF" : "#16000000"), 9));
        view.setClickable(true);
        view.setFocusable(true);
        return view;
    }

    function typeLabel(type) {
        type = String(type || "");
        if (type === "text") { return "文本"; }
        if (type === "url") { return "链接"; }
        if (type === "phone") { return "电话"; }
        if (type === "email") { return "邮箱"; }
        return type.length > 0 ? type : "未知";
    }

    function sourceLabel(row) {
        return String(row.source_label || row.source_package || "未知来源");
    }

    function hideKeyboardOnMain() {
        try {
            if (inputMethodManager !== null && keywordInput !== null) {
                inputMethodManager.hideSoftInputFromWindow(
                    keywordInput.getWindowToken(), 0);
            }
        } catch (ignored) {}
    }

    function requestKeyboardOnMain() {
        var target = keywordInput;
        var focused = false;
        if (target === null) { return false; }
        try { focused = target.requestFocus(); } catch (ignoredFocus) {}
        state.inputFocused = focused || target.hasFocus();
        state.keyboardRequestCount += 1;
        mainHandler.postDelayed(new Packages.java.lang.Runnable({
            run: function () {
                if (!state.panelAttached || target === null) { return; }
                try {
                    if (inputMethodManager !== null) {
                        inputMethodManager.showSoftInput(
                            target, InputMethodManager.SHOW_IMPLICIT);
                    }
                } catch (ignoredKeyboard) {}
            }
        }), 120);
        return state.inputFocused;
    }

    function markUiThread() {
        var thread = nowThread();
        state.lastUiThreadId = thread.id;
        state.lastUiThreadName = thread.name;
    }

    function performKeywordFromInput() {
        markUiThread();
        state.searchActionCount += 1;
        setValue({ keyword: keywordInput === null ? "" :
            String(keywordInput.getText()) }, { origin: "ui_search" });
        hideKeyboardOnMain();
        renderPanelOnMain(false);
        return true;
    }

    function toggleSource(packageName) {
        markUiThread();
        state.sourceToggleCount += 1;
        setValue({ sourcePackages: toggle(value.sourcePackages, packageName) },
            { origin: "ui_source" });
        renderPanelOnMain(false);
        return true;
    }

    function toggleType(type) {
        markUiThread();
        state.typeToggleCount += 1;
        setValue({ contentTypes: toggle(value.contentTypes, type) },
            { origin: "ui_type" });
        renderPanelOnMain(false);
        return true;
    }

    function resetFromUi() {
        markUiThread();
        state.resetActionCount += 1;
        reset({ origin: "ui_reset" });
        renderPanelOnMain(false);
        return true;
    }

    function makeChipRow(options, kind, dark) {
        var horizontal = new HorizontalScrollView(appContext);
        var row = new LinearLayout(appContext);
        var allView;
        var index;
        var option;
        var key;
        var selected;
        var chip;
        var params;
        horizontal.setHorizontalScrollBarEnabled(false);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        allView = makeButton("全部", dark,
            kind === "source" ? value.sourcePackages.length === 0 :
                value.contentTypes.length === 0);
        allView.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () {
                markUiThread();
                if (kind === "source") {
                    state.sourceToggleCount += 1;
                    setValue({ sourcePackages: [] }, { origin: "ui_source_all" });
                } else {
                    state.typeToggleCount += 1;
                    setValue({ contentTypes: [] }, { origin: "ui_type_all" });
                }
                renderPanelOnMain(false);
            }
        }));
        row.addView(allView, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        for (index = 0; index < options.length && index < 20; index += 1) {
            option = options[index];
            key = kind === "source" ? String(option.source_package) :
                String(option.content_type);
            selected = kind === "source" ? contains(value.sourcePackages, key) :
                contains(value.contentTypes, key);
            chip = makeButton(kind === "source" ? sourceLabel(option) :
                typeLabel(key), dark, selected);
            chip.setContentDescription((kind === "source" ? "筛选来源 " :
                "筛选类型 ") + key);
            if (kind === "source") {
                (function (packageValue, chipView) {
                    chipView.setOnClickListener(new JavaAdapter(View.OnClickListener, {
                        onClick: function () { toggleSource(packageValue); }
                    }));
                    sourceViews[packageValue] = chipView;
                }(key, chip));
            } else {
                (function (typeValue, chipView) {
                    chipView.setOnClickListener(new JavaAdapter(View.OnClickListener, {
                        onClick: function () { toggleType(typeValue); }
                    }));
                    typeViews[typeValue] = chipView;
                }(key, chip));
            }
            params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
            params.leftMargin = dp(7);
            row.addView(chip, params);
        }
        horizontal.addView(row, new Packages.android.widget.FrameLayout.LayoutParams(
            Packages.android.widget.FrameLayout.LayoutParams.WRAP_CONTENT,
            Packages.android.widget.FrameLayout.LayoutParams.WRAP_CONTENT));
        return horizontal;
    }

    function buildPanelContent(requestFocus) {
        var dark = isDarkMode();
        var primary = dark ? "#FFF4F4F5" : "#FF171717";
        var secondary = dark ? "#FFB4B4BC" : "#FF66666F";
        var titleRow = new LinearLayout(appContext);
        var title;
        var searchRow;
        var sourceOptions;
        var typeOptions;
        var section;
        var summary;
        var footer;
        var params;
        var inputParams;

        panelRoot.removeAllViews();
        sourceViews = {};
        typeViews = {};
        titleRow.setOrientation(LinearLayout.HORIZONTAL);
        titleRow.setGravity(Gravity.CENTER_VERTICAL);
        title = makeText("搜索与筛选", 16, primary, true);
        titleRow.addView(title, new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        closeView = makeButton("关闭", dark, false);
        closeView.setContentDescription("关闭搜索与筛选");
        closeView.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { closePanel(); }
        }));
        titleRow.addView(closeView, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(12);
        panelRoot.addView(titleRow, params);

        searchRow = new LinearLayout(appContext);
        searchRow.setOrientation(LinearLayout.HORIZONTAL);
        searchRow.setGravity(Gravity.CENTER_VERTICAL);
        keywordInput = new EditText(appContext);
        keywordInput.setSingleLine(true);
        keywordInput.setText(String(value.keyword || ""));
        keywordInput.setHint("搜索正文、来源应用");
        keywordInput.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        keywordInput.setTextColor(Color.parseColor(primary));
        keywordInput.setHintTextColor(Color.parseColor(secondary));
        keywordInput.setInputType(InputType.TYPE_CLASS_TEXT |
            InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        keywordInput.setImeOptions(EditorInfo.IME_ACTION_SEARCH);
        keywordInput.setPadding(dp(11), dp(7), dp(11), dp(7));
        keywordInput.setBackground(roundedBackground(
            dark ? "#FF202328" : "#FFF7F7F8",
            dark ? "#35FFFFFF" : "#1D000000", 10));
        keywordInput.setSelectAllOnFocus(false);
        keywordInput.setOnEditorActionListener(new JavaAdapter(
            TextView.OnEditorActionListener, {
                onEditorAction: function (view, actionId) {
                    if (Number(actionId) === Number(EditorInfo.IME_ACTION_SEARCH)) {
                        performKeywordFromInput();
                        return true;
                    }
                    return false;
                }
            }));
        inputParams = new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1);
        inputParams.rightMargin = dp(8);
        searchRow.addView(keywordInput, inputParams);
        searchView = makeButton("搜索", dark, true);
        searchView.setContentDescription("应用关键词搜索");
        searchView.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { performKeywordFromInput(); }
        }));
        searchRow.addView(searchView, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(14);
        panelRoot.addView(searchRow, params);

        sourceOptions = ClipHub.Repository.listSourceOptions();
        typeOptions = ClipHub.Repository.listContentTypeOptions();
        state.sourceOptionCount = sourceOptions.length;
        state.contentTypeOptionCount = typeOptions.length;

        section = makeText("来源应用", 12, secondary, true);
        section.setPadding(0, 0, 0, dp(7));
        panelRoot.addView(section, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(14);
        panelRoot.addView(makeChipRow(sourceOptions, "source", dark), params);

        section = makeText("内容类型", 12, secondary, true);
        section.setPadding(0, 0, 0, dp(7));
        panelRoot.addView(section, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(14);
        panelRoot.addView(makeChipRow(typeOptions, "type", dark), params);

        summary = makeText((isActive(value) ? "已启用筛选" : "显示全部记录") +
            "  ·  结果 " + Number(state.lastResultCount) + " 条",
            12, secondary, false);
        summary.setPadding(0, dp(2), 0, dp(10));
        panelRoot.addView(summary, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));

        footer = new LinearLayout(appContext);
        footer.setOrientation(LinearLayout.HORIZONTAL);
        footer.setGravity(Gravity.END | Gravity.CENTER_VERTICAL);
        resetView = makeButton("重置筛选", dark, false);
        resetView.setContentDescription("重置全部筛选条件");
        resetView.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { resetFromUi(); }
        }));
        footer.addView(resetView, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        panelRoot.addView(footer, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        state.panelRenderCount += 1;
        if (requestFocus) { requestKeyboardOnMain(); }
        return true;
    }

    function renderPanelOnMain(requestFocus) {
        if (!state.panelAttached || panelRoot === null) { return false; }
        return buildPanelContent(requestFocus === true);
    }

    function panelDimensions() {
        var metrics = new DisplayMetrics();
        var width;
        var height;
        try {
            windowManager.getDefaultDisplay().getRealMetrics(metrics);
        } catch (ignored) {
            metrics = appContext.getResources().getDisplayMetrics();
        }
        width = Math.min(dp(380), Math.max(dp(260),
            Number(metrics.widthPixels) - dp(24)));
        height = Math.min(dp(500), Math.max(dp(320),
            Number(metrics.heightPixels) - dp(96)));
        return { width: width, height: height };
    }

    function showPanel(options) {
        options = options || {};
        if (!ready) { throw new Error("ClipHub filter is not ready"); }
        if (state.panelAttached) {
            requireMain(runOnMainSync(function () {
                renderPanelOnMain(options.requestKeyboard === true);
                return true;
            }, 2500));
            return { ok: true, attached: true, reused: true,
                state: getPanelState() };
        }
        return requireMain(runOnMainSync(function () {
            var size = panelDimensions();
            var type = Build.VERSION.SDK_INT >= 26 ?
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY :
                WindowManager.LayoutParams.TYPE_SYSTEM_ALERT;
            var thread = nowThread();
            panelRoot = new LinearLayout(appContext);
            panelRoot.setOrientation(LinearLayout.VERTICAL);
            panelRoot.setPadding(dp(16), dp(14), dp(16), dp(14));
            panelRoot.setBackground(roundedBackground(
                isDarkMode() ? "#FA181A1F" : "#FCFFFFFF",
                isDarkMode() ? "#38FFFFFF" : "#1C000000", 17));
            if (Build.VERSION.SDK_INT >= 21) { panelRoot.setElevation(dp(18)); }
            panelParams = new WindowManager.LayoutParams(
                size.width, size.height, type,
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL |
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
                    WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                PixelFormat.TRANSLUCENT);
            panelParams.gravity = Gravity.CENTER;
            panelParams.softInputMode =
                WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE |
                WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE;
            try { panelParams.setTitle("ClipHub Filter Panel"); } catch (ignoredTitle) {}
            windowManager.addView(panelRoot, panelParams);
            state.panelAttached = true;
            state.panelOpenCount += 1;
            state.panelWindowType = Number(type);
            state.panelFlags = Number(panelParams.flags);
            state.panelAddThreadId = thread.id;
            state.panelAddThreadName = thread.name;
            state.lastError = null;
            buildPanelContent(options.requestKeyboard !== false);
            return { ok: true, attached: true, reused: false,
                state: getPanelState() };
        }, 3000));
    }

    function closePanel() {
        if (!state.panelAttached && panelRoot === null) {
            return { ok: true, attached: false, alreadyClosed: true,
                state: getPanelState() };
        }
        requireMain(runOnMainSync(function () {
            var thread = nowThread();
            try {
                hideKeyboardOnMain();
                if (panelRoot !== null) {
                    try { windowManager.removeViewImmediate(panelRoot); }
                    catch (error) {
                        if (panelRoot.isAttachedToWindow()) { throw error; }
                    }
                }
                state.panelCloseCount += 1;
                state.panelRemoveThreadId = thread.id;
                state.panelRemoveThreadName = thread.name;
                state.lastError = null;
                return true;
            } finally {
                state.panelAttached = false;
                state.inputFocused = false;
                panelRoot = null;
                panelParams = null;
                keywordInput = null;
                searchView = null;
                resetView = null;
                closeView = null;
                sourceViews = {};
                typeViews = {};
            }
        }, 3000));
        return { ok: true, attached: false, alreadyClosed: false,
            state: getPanelState() };
    }

    function getPanelState() {
        var attachedToWindow = false;
        var notFocusable = false;
        try {
            attachedToWindow = panelRoot !== null && panelRoot.isAttachedToWindow();
        } catch (ignored) {}
        try {
            notFocusable = panelParams !== null &&
                (Number(panelParams.flags) &
                    Number(WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE)) !== 0;
        } catch (ignoredFlag) {}
        try {
            state.inputFocused = keywordInput !== null && keywordInput.hasFocus();
        } catch (ignoredFocus) {}
        return {
            attached: state.panelAttached,
            attachedToWindow: attachedToWindow,
            focusableWindow: !notFocusable,
            inputPresent: keywordInput !== null,
            inputFocused: state.inputFocused,
            sourceOptionCount: Number(state.sourceOptionCount),
            contentTypeOptionCount: Number(state.contentTypeOptionCount),
            sourceChipCount: Object.keys(sourceViews).length,
            typeChipCount: Object.keys(typeViews).length,
            panelWindowType: state.panelWindowType,
            panelFlags: state.panelFlags,
            panelOpenCount: Number(state.panelOpenCount),
            panelCloseCount: Number(state.panelCloseCount),
            panelRenderCount: Number(state.panelRenderCount),
            searchActionCount: Number(state.searchActionCount),
            sourceToggleCount: Number(state.sourceToggleCount),
            typeToggleCount: Number(state.typeToggleCount),
            resetActionCount: Number(state.resetActionCount),
            keyboardRequestCount: Number(state.keyboardRequestCount),
            panelAddThreadId: state.panelAddThreadId,
            panelAddThreadName: state.panelAddThreadName,
            panelRemoveThreadId: state.panelRemoveThreadId,
            panelRemoveThreadName: state.panelRemoveThreadName,
            lastUiThreadId: state.lastUiThreadId,
            lastUiThreadName: state.lastUiThreadName,
            lastError: state.lastError
        };
    }

    function resetState() {
        state.applyCount = 0;
        state.eventApplyCount = 0;
        state.lastResultCount = 0;
        state.lastApplyThreadId = null;
        state.lastApplyThreadName = null;
        state.panelAttached = false;
        state.panelOpenCount = 0;
        state.panelCloseCount = 0;
        state.panelRenderCount = 0;
        state.searchActionCount = 0;
        state.sourceToggleCount = 0;
        state.typeToggleCount = 0;
        state.resetActionCount = 0;
        state.keyboardRequestCount = 0;
        state.panelWindowType = null;
        state.panelFlags = null;
        state.panelAddThreadId = null;
        state.panelAddThreadName = null;
        state.panelRemoveThreadId = null;
        state.panelRemoveThreadName = null;
        state.lastUiThreadId = null;
        state.lastUiThreadName = null;
        state.inputFocused = false;
        state.sourceOptionCount = 0;
        state.contentTypeOptionCount = 0;
        state.lastError = null;
    }

    ClipHub.Filter = {
        MODULE_NAME: "ch_11_filter",
        MODULE_VERSION: 3,
        init: function (context) {
            androidContext = context && context.androidContext ?
                context.androidContext : global.context;
            if (androidContext === null || androidContext === undefined) {
                throw new Error("Android context unavailable for filter");
            }
            appContext = androidContext.getApplicationContext() || androidContext;
            windowManager = appContext.getSystemService(Context.WINDOW_SERVICE);
            inputMethodManager = appContext.getSystemService(
                Context.INPUT_METHOD_SERVICE);
            if (windowManager === null) {
                throw new Error("WindowManager unavailable for filter panel");
            }
            mainHandler = new Handler(Looper.getMainLooper());
            density = Number(appContext.getResources()
                .getDisplayMetrics().density || 1);
            value = emptyValue();
            ready = true;
            eventListeners = [];
            panelRoot = null;
            panelParams = null;
            resetState();
            registerEvent("clipboard_added");
            registerEvent("clipboard_merged");
            registerEvent("clipboard_deleted");
            registerEvent("clipboard_restored");
            return true;
        },
        isReady: function () { return ready; },
        isActive: function () { return isActive(value); },
        get: function () { return copyValue(value); },
        getState: function () {
            return {
                ready: ready,
                active: isActive(value),
                criteria: copyValue(value),
                applyCount: Number(state.applyCount),
                eventApplyCount: Number(state.eventApplyCount),
                lastResultCount: Number(state.lastResultCount),
                lastApplyThreadId: state.lastApplyThreadId,
                lastApplyThreadName: state.lastApplyThreadName,
                panel: getPanelState(),
                lastError: state.lastError
            };
        },
        toQueryOptions: toQueryOptions,
        query: function (options) {
            return ClipHub.Repository.listItems(toQueryOptions(options || {}));
        },
        apply: apply,
        set: setValue,
        reset: reset,
        setKeyword: function (keyword, options) {
            return setValue({ keyword: keyword }, options);
        },
        setSourcePackages: function (packages, options) {
            return setValue({ sourcePackages: packages }, options);
        },
        setContentTypes: function (types, options) {
            return setValue({ contentTypes: types }, options);
        },
        setPinnedOnly: function (enabled, options) {
            return setValue({ pinnedOnly: enabled }, options);
        },
        setSensitiveMode: function (mode, options) {
            return setValue({ sensitiveMode: mode }, options);
        },
        getSourceOptions: function () {
            return ClipHub.Repository.listSourceOptions();
        },
        getContentTypeOptions: function () {
            return ClipHub.Repository.listContentTypeOptions();
        },
        showPanel: showPanel,
        closePanel: closePanel,
        getPanelState: getPanelState,
        performSearch: function (text) {
            return requireMain(runOnMainSync(function () {
                if (!state.panelAttached || keywordInput === null ||
                        searchView === null) { return false; }
                keywordInput.setText(String(text === null || text === undefined ?
                    "" : text));
                keywordInput.setSelection(keywordInput.length());
                return searchView.performClick();
            }, 2500));
        },
        performSourceClick: function (packageName) {
            packageName = String(packageName || "");
            return requireMain(runOnMainSync(function () {
                return sourceViews[packageName] ?
                    sourceViews[packageName].performClick() : false;
            }, 2500));
        },
        performTypeClick: function (type) {
            type = String(type || "");
            return requireMain(runOnMainSync(function () {
                return typeViews[type] ? typeViews[type].performClick() : false;
            }, 2500));
        },
        performResetClick: function () {
            return requireMain(runOnMainSync(function () {
                return resetView !== null ? resetView.performClick() : false;
            }, 2500));
        },
        performCloseClick: function () {
            return requireMain(runOnMainSync(function () {
                return closeView !== null ? closeView.performClick() : false;
            }, 2500));
        },
        shutdown: function () {
            try { closePanel(); } catch (ignoredClose) {}
            unregisterEvents();
            value = null;
            ready = false;
            androidContext = null;
            appContext = null;
            windowManager = null;
            inputMethodManager = null;
            mainHandler = null;
            return true;
        }
    };
}((function () { return this; }())));
