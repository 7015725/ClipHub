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
    var FrameLayout = Packages.android.widget.FrameLayout;
    var ScrollView = Packages.android.widget.ScrollView;
    var HorizontalScrollView = Packages.android.widget.HorizontalScrollView;
    var TextView = Packages.android.widget.TextView;
    var EditText = Packages.android.widget.EditText;
    var ImageView = Packages.android.widget.ImageView;
    var TypedValue = Packages.android.util.TypedValue;
    var InputType = Packages.android.text.InputType;
    var EditorInfo = Packages.android.view.inputmethod.EditorInfo;
    var InputMethodManager = Packages.android.view.inputmethod.InputMethodManager;
    var DisplayMetrics = Packages.android.util.DisplayMetrics;
    var TextUtils = Packages.android.text.TextUtils;
    var TextWatcher = Packages.android.text.TextWatcher;
    var Date = Packages.java.util.Date;
    var SimpleDateFormat = Packages.java.text.SimpleDateFormat;
    var Locale = Packages.java.util.Locale;

    var HISTORY_KEY = "filterSearchHistory";
    var HISTORY_LIMIT = 6;
    var RESULT_LIMIT = 40;
    var PREVIEW_LIMIT = 8;

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
    var advancedKeywordInput = null;
    var searchView = null;
    var resetView = null;
    var closeView = null;
    var advancedView = null;
    var applyView = null;
    var clearHistoryView = null;
    var resultContainer = null;
    var resultCountView = null;
    var drawerContainer = null;
    var sourceViews = {};
    var typeViews = {};
    var tagViews = {};
    var pinnedViews = {};
    var sensitiveViews = {};
    var sortViews = {};
    var historyViews = [];
    var advancedVisible = false;
    var searchHistory = [];
    var previewRows = [];
    var suppressTextWatcher = false;
    var searchGeneration = 0;

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
        realtimeSearchCount: 0,
        sourceToggleCount: 0,
        typeToggleCount: 0,
        tagToggleCount: 0,
        pinnedToggleCount: 0,
        sensitiveToggleCount: 0,
        sortToggleCount: 0,
        resetActionCount: 0,
        applyActionCount: 0,
        advancedOpenCount: 0,
        advancedCloseCount: 0,
        historyUseCount: 0,
        historyClearCount: 0,
        keyboardRequestCount: 0,
        panelWindowType: null,
        panelFlags: null,
        panelWidthPx: null,
        panelHeightPx: null,
        panelWidthDp: null,
        panelHeightDp: null,
        dimAmount: 0,
        modalWindow: false,
        opaqueBackground: false,
        horizontalFadeEnabled: false,
        advancedKeywordInputPresent: false,
        sortOptionCount: 0,
        sourceWrapRowCount: 0,
        typeWrapRowCount: 0,
        tagWrapRowCount: 0,
        drawerWidthDp: 0,
        drawerHeightDp: 0,
        backLayerCloseCount: 0,
        lastBackLayer: "",
        repositorySortUnchanged: true,
        sortScope: "result_window",
        panelAddThreadId: null,
        panelAddThreadName: null,
        panelRemoveThreadId: null,
        panelRemoveThreadName: null,
        lastUiThreadId: null,
        lastUiThreadName: null,
        inputFocused: false,
        sourceOptionCount: 0,
        contentTypeOptionCount: 0,
        tagOptionCount: 0,
        sourceChipCount: 0,
        typeChipCount: 0,
        tagChipCount: 0,
        historyChipCount: 0,
        resultCardCount: 0,
        resultSourceIconCount: 0,
        advancedDrawerVisible: false,
        searchPageStyle: "reference_search_v2",
        lastError: null
    };

    function dp(number) {
        return Math.max(1, Math.floor(Number(number) * density + 0.5));
    }

    function pxToDp(valuePx) {
        return Math.round(Number(valuePx) / density);
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

    function normalizeIdList(input) {
        var source = input instanceof Array ? input : [];
        var seen = {};
        var output = [];
        var index;
        var number;
        for (index = 0; index < source.length; index += 1) {
            number = Math.floor(Number(source[index]));
            if (isFinite(number) && number > 0 && !seen[number]) {
                seen[number] = true;
                output.push(number);
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
            if (String(input[index]) === String(target)) {
                return true;
            }
        }
        return false;
    }

    function toggle(input, target, numeric) {
        var output = [];
        var found = false;
        var index;
        var valueToAdd = numeric ? Number(target) : String(target);
        for (index = 0; index < input.length; index += 1) {
            if (String(input[index]) === String(target)) {
                found = true;
            } else {
                output.push(input[index]);
            }
        }
        if (!found) {
            output.push(valueToAdd);
        }
        return output;
    }

    function emptyValue() {
        return {
            keyword: "",
            sourcePackages: [],
            contentTypes: [],
            tagIds: [],
            pinnedOnly: false,
            sensitiveMode: "all",
            sortMode: "latest"
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
            sensitiveMode: String(input.sensitiveMode || "all"),
            sortMode: validateSortMode(input.sortMode)
        };
    }

    function isActive(input) {
        input = input || value || emptyValue();
        return normalizeText(input.keyword).length > 0 ||
            input.sourcePackages.length > 0 ||
            input.contentTypes.length > 0 ||
            input.tagIds.length > 0 ||
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

    function validateSortMode(mode) {
        mode = String(mode || "latest");
        if (mode !== "latest" && mode !== "pinned" &&
                mode !== "source") {
            throw new Error("Invalid filter sort mode");
        }
        return mode;
    }

    function sortModeLabel(mode) {
        mode = validateSortMode(mode);
        if (mode === "pinned") { return "置顶优先"; }
        if (mode === "source") { return "来源应用"; }
        return "最新优先";
    }

    function sortRows(rows) {
        var mode = validateSortMode(value && value.sortMode);
        var decorated = [];
        var output = [];
        var index;
        rows = rows || [];
        if (mode === "latest") { return rows.slice(0); }
        for (index = 0; index < rows.length; index += 1) {
            decorated.push({ row: rows[index], index: index });
        }
        decorated.sort(function (left, right) {
            var leftPinned;
            var rightPinned;
            var leftSource;
            var rightSource;
            if (mode === "pinned") {
                leftPinned = Number(left.row.is_pinned || 0);
                rightPinned = Number(right.row.is_pinned || 0);
                if (leftPinned !== rightPinned) {
                    return rightPinned - leftPinned;
                }
            } else {
                leftSource = sourceLabel(left.row).toLowerCase();
                rightSource = sourceLabel(right.row).toLowerCase();
                if (leftSource < rightSource) { return -1; }
                if (leftSource > rightSource) { return 1; }
            }
            return left.index - right.index;
        });
        for (index = 0; index < decorated.length; index += 1) {
            output.push(decorated[index].row);
        }
        return output;
    }

    function toQueryOptions(extra) {
        var options = {};
        var key;
        extra = extra || {};
        for (key in extra) {
            if (extra.hasOwnProperty(key)) {
                options[key] = extra[key];
            }
        }
        options.keyword = value.keyword;
        options.sourcePackages = copyList(value.sourcePackages);
        options.contentTypes = copyList(value.contentTypes);
        options.tagIds = copyList(value.tagIds);
        options.pinnedOnly = value.pinnedOnly;
        if (value.sensitiveMode === "only") {
            options.sensitiveOnly = true;
        }
        if (value.sensitiveMode === "exclude") {
            options.excludeSensitive = true;
        }
        return options;
    }

    function nowThread() {
        var thread = Thread.currentThread();
        return {
            id: Number(thread.getId()),
            name: String(thread.getName())
        };
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
            return {
                ok: false,
                error: new Error("Filter main handler post failed")
            };
        }
        completed = latch.await(Number(timeoutMs || 2500),
            TimeUnit.MILLISECONDS);
        if (!completed) {
            try {
                mainHandler.removeCallbacks(runnable);
            } catch (ignored) {}
            return {
                ok: false,
                error: new Error("Filter main handler timeout")
            };
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

    function palette() {
        if (ClipHub.Theme &&
                typeof ClipHub.Theme.getPalette === "function") {
            return ClipHub.Theme.getPalette(appContext);
        }
        return {
            dark: false,
            accent: "#FF6D4AFF",
            accentStrong: "#FF5A37E6",
            accentSoft: "#FFF0ECFF",
            accentBorder: "#FFBBAAF8",
            surface: "#FFFFFFFF",
            surfaceMuted: "#FFF5F3FB",
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
            toolbar: "#FFF0EBFF"
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

    function circleBackground(fill, stroke) {
        var drawable = new GradientDrawable();
        drawable.setShape(GradientDrawable.OVAL);
        drawable.setColor(Color.parseColor(String(fill)));
        if (stroke !== null && stroke !== undefined) {
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

    function makeIcon(text, sizeSp, color, description) {
        var view = makeText(text, sizeSp, color, false);
        view.setGravity(Gravity.CENTER);
        view.setClickable(true);
        view.setFocusable(true);
        if (description) {
            view.setContentDescription(String(description));
        }
        return view;
    }

    function makeChip(text, selected, colors) {
        var view = makeText(text, 10,
            selected ? colors.accentStrong : colors.textSecondary,
            selected);
        view.setGravity(Gravity.CENTER);
        view.setPadding(dp(9), dp(6), dp(9), dp(6));
        view.setBackground(roundedBackground(
            selected ? colors.accentSoft : colors.surface,
            selected ? colors.accentBorder : colors.stroke, 9));
        view.setClickable(true);
        view.setFocusable(true);
        return view;
    }

    function makePrimaryButton(text, colors) {
        var view = makeText(text, 11, "#FFFFFFFF", true);
        view.setGravity(Gravity.CENTER);
        view.setPadding(dp(14), dp(8), dp(14), dp(8));
        view.setBackground(roundedBackground(
            colors.accentStrong, null, 11));
        view.setClickable(true);
        view.setFocusable(true);
        return view;
    }

    function makeSecondaryButton(text, colors) {
        var view = makeText(text, 11, colors.accentStrong, true);
        view.setGravity(Gravity.CENTER);
        view.setPadding(dp(13), dp(8), dp(13), dp(8));
        view.setBackground(roundedBackground(
            colors.surface, colors.accentBorder, 11));
        view.setClickable(true);
        view.setFocusable(true);
        return view;
    }

    function formatTime(valueTime) {
        try {
            return String(new SimpleDateFormat("HH:mm", Locale.getDefault())
                .format(new Date(Number(valueTime || 0))));
        } catch (ignored) {
            return "";
        }
    }

    function typeLabel(type) {
        type = String(type || "");
        if (type === "text") { return "文本"; }
        if (type === "url") { return "链接"; }
        if (type === "phone") { return "电话"; }
        if (type === "email") { return "邮箱"; }
        if (type === "code") { return "代码"; }
        return type.length > 0 ? type : "未知";
    }

    function sourceLabel(row) {
        return String(row.source_label || row.source_package || "未知来源");
    }

    function loadHistory() {
        var stored = [];
        try {
            if (ClipHub.Settings &&
                    typeof ClipHub.Settings.get === "function") {
                stored = ClipHub.Settings.get(HISTORY_KEY, []);
            }
        } catch (ignored) {
            stored = [];
        }
        searchHistory = normalizeList(stored).slice(0, HISTORY_LIMIT);
        return copyList(searchHistory);
    }

    function saveHistory() {
        try {
            if (ClipHub.Settings &&
                    typeof ClipHub.Settings.set === "function") {
                ClipHub.Settings.set(HISTORY_KEY,
                    copyList(searchHistory), { cleanup: false });
            }
        } catch (ignored) {}
    }

    function rememberKeyword(keyword) {
        var normalized = normalizeText(keyword);
        var next = [];
        var index;
        if (normalized.length === 0) {
            return false;
        }
        next.push(normalized);
        for (index = 0; index < searchHistory.length; index += 1) {
            if (String(searchHistory[index]).toLowerCase() !==
                    normalized.toLowerCase()) {
                next.push(searchHistory[index]);
            }
            if (next.length >= HISTORY_LIMIT) {
                break;
            }
        }
        searchHistory = next;
        saveHistory();
        return true;
    }

    function clearHistory() {
        searchHistory = [];
        saveHistory();
        state.historyClearCount += 1;
        if (state.panelAttached) {
            buildPanelContent(false);
        }
        return true;
    }

    function emitChanged(rows, origin) {
        var thread = Thread.currentThread();
        var payload = {
            active: isActive(value),
            criteria: {
                keyword: String(value.keyword || ""),
                sourcePackages: copyList(value.sourcePackages),
                types: copyList(value.contentTypes),
                tagIds: copyList(value.tagIds),
                pinnedOnly: value.pinnedOnly === true,
                sensitiveMode: String(value.sensitiveMode || "all"),
                sortMode: validateSortMode(value.sortMode)
            },
            resultCount: rows.length,
            origin: String(origin || "manual"),
            threadId: Number(thread.getId()),
            threadName: String(thread.getName())
        };
        try {
            if (ClipHub.EventBus &&
                    typeof ClipHub.EventBus.emit === "function") {
                ClipHub.EventBus.emit("filter_changed", payload);
            }
        } catch (ignored) {}
    }

    function apply(options) {
        var rows;
        var thread;
        options = options || {};
        if (!ready || value === null) {
            throw new Error("ClipHub filter is not ready");
        }
        try {
            rows = ClipHub.Repository.listItems(toQueryOptions({
                limit: options.limit === undefined ? RESULT_LIMIT : options.limit,
                offset: options.offset === undefined ? 0 : options.offset
            }));
            rows = sortRows(rows);
            previewRows = rows.slice(0, PREVIEW_LIMIT);
            if (ClipHub.List &&
                    typeof ClipHub.List.setItems === "function") {
                ClipHub.List.setItems(rows);
            }
            state.applyCount += 1;
            if (options.fromEvent === true) {
                state.eventApplyCount += 1;
            }
            state.lastResultCount = rows.length;
            thread = Thread.currentThread();
            state.lastApplyThreadId = Number(thread.getId());
            state.lastApplyThreadName = String(thread.getName());
            state.lastError = null;
            emitChanged(rows,
                options.origin ||
                (options.fromEvent ? "event" : "manual"));
            return rows;
        } catch (error) {
            state.lastError = String(error);
            throw error;
        }
    }

    function applyIfRequested(options) {
        options = options || {};
        if (options.apply === false || !ready) {
            return copyValue(value);
        }
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
        if (patch.hasOwnProperty("tagIds")) {
            value.tagIds = normalizeIdList(patch.tagIds);
        }
        if (patch.hasOwnProperty("pinnedOnly")) {
            value.pinnedOnly = patch.pinnedOnly === true;
        }
        if (patch.hasOwnProperty("sensitiveMode")) {
            value.sensitiveMode = validateSensitiveMode(
                patch.sensitiveMode);
        }
        if (patch.hasOwnProperty("sortMode")) {
            value.sortMode = validateSortMode(patch.sortMode);
        }
        return applyIfRequested(options);
    }

    function reset(options) {
        value = emptyValue();
        return applyIfRequested(options);
    }

    function onClipboardChange(payload) {
        var wasActive;
        var nextIds;
        var index;
        var deletedId;
        if (!ready) {
            return;
        }
        wasActive = isActive(value);
        if (payload && String(payload.action || "") === "tag_deleted") {
            deletedId = Number(payload.tagId);
            nextIds = [];
            for (index = 0; index < value.tagIds.length; index += 1) {
                if (Number(value.tagIds[index]) !== deletedId) {
                    nextIds.push(value.tagIds[index]);
                }
            }
            value.tagIds = nextIds;
        }
        if (!wasActive && !isActive(value) && !state.panelAttached) {
            return;
        }
        try {
            apply({ fromEvent: true, origin: "clipboard_event" });
            if (state.panelAttached) {
                requireMain(runOnMainSync(function () {
                    refreshResultsOnMain();
                    return true;
                }, 2500));
            }
        } catch (error) {
            state.lastError = String(error);
        }
    }

    function registerEvent(name) {
        var listener = onClipboardChange;
        if (ClipHub.EventBus &&
                typeof ClipHub.EventBus.on === "function") {
            ClipHub.EventBus.on(name, listener);
            eventListeners.push({ name: name, listener: listener });
        }
    }

    function unregisterEvents() {
        var index;
        if (ClipHub.EventBus &&
                typeof ClipHub.EventBus.off === "function") {
            for (index = 0; index < eventListeners.length; index += 1) {
                ClipHub.EventBus.off(eventListeners[index].name,
                    eventListeners[index].listener);
            }
        }
        eventListeners = [];
    }

    function hideKeyboardOnMain() {
        try {
            if (inputMethodManager !== null && keywordInput !== null) {
                inputMethodManager.hideSoftInputFromWindow(
                    keywordInput.getWindowToken(), 0);
            }
        } catch (ignoredHeader) {}
        try {
            if (inputMethodManager !== null &&
                    advancedKeywordInput !== null) {
                inputMethodManager.hideSoftInputFromWindow(
                    advancedKeywordInput.getWindowToken(), 0);
            }
        } catch (ignoredDrawer) {}
    }

    function requestKeyboardOnMain() {
        var target = keywordInput;
        var focused = false;
        if (target === null) {
            return false;
        }
        try {
            focused = target.requestFocus();
        } catch (ignoredFocus) {}
        state.inputFocused = focused || target.hasFocus();
        state.keyboardRequestCount += 1;
        mainHandler.postDelayed(new Packages.java.lang.Runnable({
            run: function () {
                if (!state.panelAttached || target === null) {
                    return;
                }
                try {
                    if (inputMethodManager !== null) {
                        inputMethodManager.showSoftInput(target,
                            InputMethodManager.SHOW_IMPLICIT);
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

    function performKeywordFromInput(origin) {
        var text = keywordInput === null ? "" :
            String(keywordInput.getText());
        markUiThread();
        state.searchActionCount += 1;
        setValue({ keyword: text }, {
            origin: origin || "ui_search"
        });
        rememberKeyword(text);
        hideKeyboardOnMain();
        buildPanelContent(false);
        return true;
    }

    function performAdvancedKeywordFromInput(origin) {
        var text = advancedKeywordInput === null ? "" :
            String(advancedKeywordInput.getText());
        markUiThread();
        state.searchActionCount += 1;
        setValue({ keyword: text }, {
            origin: origin || "ui_advanced_search"
        });
        rememberKeyword(text);
        hideKeyboardOnMain();
        buildPanelContent(false);
        return true;
    }

    function scheduleRealtimeSearch(text) {
        var generation = searchGeneration + 1;
        searchGeneration = generation;
        mainHandler.postDelayed(new Packages.java.lang.Runnable({
            run: function () {
                if (!state.panelAttached ||
                        generation !== searchGeneration) {
                    return;
                }
                try {
                    state.realtimeSearchCount += 1;
                    setValue({ keyword: text }, {
                        origin: "ui_realtime"
                    });
                    refreshResultsOnMain();
                    updateResultCountOnMain();
                } catch (error) {
                    state.lastError = String(error);
                }
            }
        }), 260);
    }

    function toggleSource(packageName) {
        markUiThread();
        state.sourceToggleCount += 1;
        setValue({
            sourcePackages: toggle(value.sourcePackages,
                packageName, false)
        }, { origin: "ui_source" });
        buildPanelContent(false);
        return true;
    }

    function toggleType(type) {
        markUiThread();
        state.typeToggleCount += 1;
        setValue({
            contentTypes: toggle(value.contentTypes, type, false)
        }, { origin: "ui_type" });
        buildPanelContent(false);
        return true;
    }

    function toggleTag(tagId) {
        markUiThread();
        state.tagToggleCount += 1;
        setValue({
            tagIds: toggle(value.tagIds, Number(tagId), true)
        }, { origin: "ui_tag" });
        buildPanelContent(false);
        return true;
    }

    function togglePinned() {
        markUiThread();
        state.pinnedToggleCount += 1;
        setValue({ pinnedOnly: !value.pinnedOnly }, {
            origin: "ui_pinned"
        });
        buildPanelContent(false);
        return true;
    }

    function setSensitive(mode) {
        markUiThread();
        state.sensitiveToggleCount += 1;
        setValue({ sensitiveMode: mode }, {
            origin: "ui_sensitive"
        });
        buildPanelContent(false);
        return true;
    }

    function setSortMode(mode) {
        markUiThread();
        state.sortToggleCount += 1;
        setValue({ sortMode: validateSortMode(mode) }, {
            origin: "ui_sort"
        });
        buildPanelContent(false);
        return true;
    }

    function resetFromUi() {
        markUiThread();
        state.resetActionCount += 1;
        reset({ origin: "ui_reset" });
        suppressTextWatcher = true;
        try {
            if (keywordInput !== null) {
                keywordInput.setText("");
            }
            if (advancedKeywordInput !== null) {
                advancedKeywordInput.setText("");
            }
        } finally {
            suppressTextWatcher = false;
        }
        buildPanelContent(false);
        return true;
    }

    function applyFromUi() {
        markUiThread();
        state.applyActionCount += 1;
        apply({ origin: "ui_apply" });
        advancedVisible = false;
        state.advancedDrawerVisible = false;
        buildPanelContent(false);
        return true;
    }

    function toggleAdvanced() {
        advancedVisible = !advancedVisible;
        state.advancedDrawerVisible = advancedVisible;
        if (advancedVisible) {
            state.advancedOpenCount += 1;
            hideKeyboardOnMain();
        } else {
            state.advancedCloseCount += 1;
        }
        buildPanelContent(false);
        return true;
    }

    function optionKey(option, kind) {
        if (kind === "source") {
            return String(option.source_package);
        }
        if (kind === "type") {
            return String(option.content_type);
        }
        return String(Number(option.id));
    }

    function optionLabel(option, kind) {
        if (kind === "source") {
            return sourceLabel(option);
        }
        if (kind === "type") {
            return typeLabel(option.content_type);
        }
        return String(option.name);
    }

    function selectedList(kind) {
        if (kind === "source") {
            return value.sourcePackages;
        }
        if (kind === "type") {
            return value.contentTypes;
        }
        return value.tagIds;
    }

    function clearKind(kind) {
        if (kind === "source") {
            state.sourceToggleCount += 1;
            setValue({ sourcePackages: [] }, {
                origin: "ui_source_all"
            });
        } else if (kind === "type") {
            state.typeToggleCount += 1;
            setValue({ contentTypes: [] }, {
                origin: "ui_type_all"
            });
        } else {
            state.tagToggleCount += 1;
            setValue({ tagIds: [] }, {
                origin: "ui_tag_all"
            });
        }
    }

    function chipWidthDp(label) {
        var text = String(label || "");
        var units = 0;
        var index;
        var code;
        for (index = 0; index < text.length; index += 1) {
            code = text.charCodeAt(index);
            units += code <= 127 ? 0.62 : 1;
        }
        return Math.min(202, Math.max(42, 19 + units * 9));
    }

    function optionClick(kind, key, chip) {
        if (kind === "source") {
            (function (target, view) {
                view.setOnClickListener(new JavaAdapter(
                    View.OnClickListener, {
                        onClick: function () { toggleSource(target); }
                    }));
                sourceViews[target] = view;
            }(key, chip));
        } else if (kind === "type") {
            (function (target, view) {
                view.setOnClickListener(new JavaAdapter(
                    View.OnClickListener, {
                        onClick: function () { toggleType(target); }
                    }));
                typeViews[target] = view;
            }(key, chip));
        } else {
            (function (target, view) {
                view.setOnClickListener(new JavaAdapter(
                    View.OnClickListener, {
                        onClick: function () { toggleTag(Number(target)); }
                    }));
                tagViews[target] = view;
            }(key, chip));
        }
    }

    function makeChipRow(options, kind, colors) {
        var root = new LinearLayout(appContext);
        var row = null;
        var rowWidth = 0;
        var maxWidth = 208;
        var rowCount = 0;
        var items = [{ all: true, key: "", label: "全部" }];
        var index;
        var option;
        var key;
        var label;
        var selected;
        var chip;
        var width;
        var params;
        root.setOrientation(LinearLayout.VERTICAL);
        state.horizontalFadeEnabled = false;
        for (index = 0; index < options.length && index < 30;
                index += 1) {
            option = options[index];
            items.push({
                all: false,
                key: optionKey(option, kind),
                label: optionLabel(option, kind)
            });
        }
        for (index = 0; index < items.length; index += 1) {
            key = items[index].key;
            label = items[index].label;
            selected = items[index].all ?
                selectedList(kind).length === 0 :
                contains(selectedList(kind), key);
            chip = makeChip(label, selected, colors);
            chip.setContentDescription(items[index].all ?
                "筛选" + kind + " 全部" :
                "筛选" + kind + " " + key);
            if (items[index].all) {
                chip.setOnClickListener(new JavaAdapter(
                    View.OnClickListener, {
                        onClick: function () {
                            markUiThread();
                            clearKind(kind);
                            buildPanelContent(false);
                        }
                    }));
            } else {
                optionClick(kind, key, chip);
            }
            width = chipWidthDp(label);
            if (row === null ||
                    (rowWidth > 0 && rowWidth + 6 + width > maxWidth)) {
                row = new LinearLayout(appContext);
                row.setOrientation(LinearLayout.HORIZONTAL);
                row.setGravity(Gravity.CENTER_VERTICAL);
                params = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT);
                if (rowCount > 0) { params.topMargin = dp(5); }
                root.addView(row, params);
                rowWidth = 0;
                rowCount += 1;
            }
            params = new LinearLayout.LayoutParams(dp(width),
                LinearLayout.LayoutParams.WRAP_CONTENT);
            if (rowWidth > 0) { params.leftMargin = dp(6); }
            row.addView(chip, params);
            rowWidth += (rowWidth > 0 ? 6 : 0) + width;
        }
        if (kind === "source") { state.sourceWrapRowCount = rowCount; }
        if (kind === "type") { state.typeWrapRowCount = rowCount; }
        if (kind === "tag") { state.tagWrapRowCount = rowCount; }
        return root;
    }

    function addSection(parent, title, options, kind, colors) {
        var section = makeText(title, 10,
            colors.textSecondary, true);
        var params;
        section.setPadding(0, 0, 0, dp(5));
        parent.addView(section, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(8);
        parent.addView(makeChipRow(options, kind, colors), params);
    }

    function optionCounts() {
        var sources = ClipHub.Repository.listSourceOptions();
        var types = ClipHub.Repository.listContentTypeOptions();
        var tags = ClipHub.Repository.listTags();
        return { sources: sources, types: types, tags: tags };
    }

    function displayMetrics() {
        var metrics = new DisplayMetrics();
        try {
            windowManager.getDefaultDisplay().getRealMetrics(metrics);
        } catch (ignored) {
            metrics = appContext.getResources().getDisplayMetrics();
        }
        return metrics;
    }

    function panelDimensions() {
        var metrics = displayMetrics();
        var screenWidthDp = Number(metrics.widthPixels) / density;
        var screenHeightDp = Number(metrics.heightPixels) / density;
        var widthDp = Math.min(390, Math.max(300,
            screenWidthDp - 20));
        var heightDp = Math.min(720, Math.max(560,
            screenHeightDp - 170));
        return {
            width: dp(widthDp),
            height: dp(heightDp),
            widthDp: widthDp,
            heightDp: heightDp
        };
    }

    function updatePanelSize() {
        var size;
        if (panelRoot === null || panelParams === null) {
            return false;
        }
        size = panelDimensions();
        panelParams.width = size.width;
        panelParams.height = size.height;
        state.panelWidthPx = size.width;
        state.panelHeightPx = size.height;
        state.panelWidthDp = size.widthDp;
        state.panelHeightDp = size.heightDp;
        try {
            windowManager.updateViewLayout(panelRoot, panelParams);
        } catch (ignoredUpdate) {}
        return true;
    }

    function makeSourceIcon(row, colors) {
        var holder = new FrameLayout(appContext);
        var image;
        var drawable;
        var fallback;
        var packageName = String(row.source_package || "");
        holder.setBackground(circleBackground(colors.surfaceMuted, null));
        try {
            if (packageName.length > 0) {
                drawable = appContext.getPackageManager()
                    .getApplicationIcon(packageName);
                image = new ImageView(appContext);
                image.setImageDrawable(drawable);
                image.setScaleType(ImageView.ScaleType.CENTER_INSIDE);
                image.setPadding(dp(4), dp(4), dp(4), dp(4));
                holder.addView(image, new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT));
                state.resultSourceIconCount += 1;
            }
        } catch (ignoredIcon) {}
        if (holder.getChildCount() === 0) {
            fallback = makeText(typeLabel(row.content_type).substring(0, 1),
                14, colors.accentStrong, true);
            fallback.setGravity(Gravity.CENTER);
            holder.addView(fallback, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));
        }
        return holder;
    }

    function makeResultCard(row, colors) {
        var card = new LinearLayout(appContext);
        var icon = makeSourceIcon(row, colors);
        var center = new LinearLayout(appContext);
        var content = makeText(String(row.content || ""),
            11, colors.textPrimary, false);
        var metaRow = new LinearLayout(appContext);
        var type = makeText(typeLabel(row.content_type),
            8, colors.accentStrong, true);
        var source = makeText(sourceLabel(row),
            8, colors.textSecondary, false);
        var right = new LinearLayout(appContext);
        var time = makeText(formatTime(row.last_copied_at),
            8, colors.textTertiary, false);
        var star = makeText(Number(row.is_pinned || 0) === 1 ?
            "★" : "☆", 17,
            Number(row.is_pinned || 0) === 1 ?
                colors.accentStrong : colors.textTertiary, false);
        var params;

        card.setOrientation(LinearLayout.HORIZONTAL);
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setPadding(dp(8), dp(7), dp(7), dp(7));
        card.setBackground(roundedBackground(colors.card,
            colors.stroke, 12));

        params = new LinearLayout.LayoutParams(dp(34), dp(34));
        params.rightMargin = dp(8);
        card.addView(icon, params);

        center.setOrientation(LinearLayout.VERTICAL);
        content.setMaxLines(2);
        content.setEllipsize(TextUtils.TruncateAt.END);
        center.addView(content, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        metaRow.setOrientation(LinearLayout.HORIZONTAL);
        metaRow.setGravity(Gravity.CENTER_VERTICAL);
        type.setPadding(dp(6), dp(2), dp(6), dp(2));
        type.setBackground(roundedBackground(colors.accentSoft,
            null, 7));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.rightMargin = dp(6);
        metaRow.addView(type, params);
        source.setSingleLine(true);
        source.setEllipsize(TextUtils.TruncateAt.END);
        metaRow.addView(source, new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        center.addView(metaRow, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        card.addView(center, new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        right.setOrientation(LinearLayout.VERTICAL);
        right.setGravity(Gravity.END | Gravity.CENTER_VERTICAL);
        time.setGravity(Gravity.END);
        right.addView(time, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(16)));
        star.setGravity(Gravity.END | Gravity.CENTER_VERTICAL);
        right.addView(star, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(28)));
        card.addView(right, new LinearLayout.LayoutParams(dp(48),
            LinearLayout.LayoutParams.WRAP_CONTENT));
        state.resultCardCount += 1;
        return card;
    }

    function refreshResultsOnMain() {
        var colors = palette();
        var index;
        var empty;
        var params;
        if (resultContainer === null) {
            return false;
        }
        resultContainer.removeAllViews();
        state.resultCardCount = 0;
        state.resultSourceIconCount = 0;
        if (previewRows.length === 0) {
            empty = makeText("没有匹配的剪贴板记录",
                12, colors.textSecondary, false);
            empty.setGravity(Gravity.CENTER);
            empty.setPadding(dp(10), dp(42), dp(10), dp(42));
            resultContainer.addView(empty,
                new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT));
            return true;
        }
        for (index = 0; index < previewRows.length; index += 1) {
            params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
            params.bottomMargin = dp(6);
            resultContainer.addView(makeResultCard(
                previewRows[index], colors), params);
        }
        return true;
    }

    function updateResultCountOnMain() {
        if (resultCountView !== null) {
            resultCountView.setText("共 " +
                Number(state.lastResultCount) +
                " 条" + (isActive(value) ? "（已筛选）" : ""));
        }
    }

    function buildHistoryRow(colors) {
        var container = new LinearLayout(appContext);
        var header = new LinearLayout(appContext);
        var label = makeText("搜索历史", 9,
            colors.textSecondary, true);
        var scroll;
        var row;
        var index;
        var chip;
        var params;

        container.setOrientation(LinearLayout.VERTICAL);
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.addView(label, new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        clearHistoryView = makeText("清除", 9,
            colors.accentStrong, false);
        clearHistoryView.setClickable(true);
        clearHistoryView.setFocusable(true);
        clearHistoryView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () { clearHistory(); }
            }));
        header.addView(clearHistoryView,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));
        container.addView(header, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));

        scroll = new HorizontalScrollView(appContext);
        scroll.setHorizontalScrollBarEnabled(false);
        row = new LinearLayout(appContext);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setPadding(0, dp(5), 0, 0);
        historyViews = [];
        for (index = 0; index < searchHistory.length; index += 1) {
            chip = makeChip(String(searchHistory[index]), false, colors);
            (function (target, view) {
                view.setOnClickListener(new JavaAdapter(
                    View.OnClickListener, {
                        onClick: function () {
                            state.historyUseCount += 1;
                            suppressTextWatcher = true;
                            try {
                                keywordInput.setText(String(target));
                                keywordInput.setSelection(
                                    keywordInput.getText().length());
                            } finally {
                                suppressTextWatcher = false;
                            }
                            performKeywordFromInput("ui_history");
                        }
                    }));
            }(searchHistory[index], chip));
            historyViews.push(chip);
            params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
            if (index > 0) {
                params.leftMargin = dp(6);
            }
            row.addView(chip, params);
        }
        scroll.addView(row, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            FrameLayout.LayoutParams.WRAP_CONTENT));
        container.addView(scroll, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        state.historyChipCount = historyViews.length;
        return container;
    }

    function buildSearchHeader(colors) {
        var container = new LinearLayout(appContext);
        var titleRow = new LinearLayout(appContext);
        var logo = makeText("▤", 19,
            colors.accentStrong, true);
        var title = makeText("全局剪切板", 17,
            colors.textPrimary, true);
        var searchRow = new LinearLayout(appContext);
        var params;
        var addButton;

        container.setOrientation(LinearLayout.VERTICAL);
        titleRow.setOrientation(LinearLayout.HORIZONTAL);
        titleRow.setGravity(Gravity.CENTER_VERTICAL);
        logo.setGravity(Gravity.CENTER);
        logo.setBackground(roundedBackground(colors.accentSoft,
            colors.accentBorder, 9));
        params = new LinearLayout.LayoutParams(dp(34), dp(34));
        params.rightMargin = dp(8);
        titleRow.addView(logo, params);
        titleRow.addView(title, new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        closeView = makeIcon("×", 22, colors.icon,
            "关闭搜索与筛选");
        closeView.setBackground(circleBackground(colors.surfaceMuted, null));
        closeView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () { closePanel(); }
            }));
        titleRow.addView(closeView,
            new LinearLayout.LayoutParams(dp(36), dp(36)));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(8);
        container.addView(titleRow, params);

        searchRow.setOrientation(LinearLayout.HORIZONTAL);
        searchRow.setGravity(Gravity.CENTER_VERTICAL);
        keywordInput = new EditText(appContext);
        keywordInput.setSingleLine(true);
        suppressTextWatcher = true;
        keywordInput.setText(String(value.keyword || ""));
        keywordInput.setSelection(keywordInput.getText().length());
        suppressTextWatcher = false;
        keywordInput.setHint("搜索剪切板内容");
        keywordInput.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        keywordInput.setTextColor(Color.parseColor(colors.textPrimary));
        keywordInput.setHintTextColor(Color.parseColor(colors.textSecondary));
        keywordInput.setInputType(InputType.TYPE_CLASS_TEXT |
            InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        keywordInput.setImeOptions(EditorInfo.IME_ACTION_SEARCH);
        keywordInput.setPadding(dp(12), dp(6), dp(10), dp(6));
        keywordInput.setBackground(roundedBackground(colors.surface,
            colors.stroke, 20));
        keywordInput.setOnEditorActionListener(new JavaAdapter(
            TextView.OnEditorActionListener, {
                onEditorAction: function (view, actionId) {
                    if (Number(actionId) ===
                            Number(EditorInfo.IME_ACTION_SEARCH)) {
                        performKeywordFromInput("ui_search_ime");
                        return true;
                    }
                    return false;
                }
            }));
        keywordInput.addTextChangedListener(new JavaAdapter(TextWatcher, {
            beforeTextChanged: function () {},
            onTextChanged: function (text) {
                if (!suppressTextWatcher) {
                    scheduleRealtimeSearch(String(text));
                }
            },
            afterTextChanged: function () {}
        }));
        params = new LinearLayout.LayoutParams(0, dp(44), 1);
        params.rightMargin = dp(8);
        searchRow.addView(keywordInput, params);

        advancedView = makeText("☷  筛选", 11,
            colors.accentStrong, true);
        advancedView.setGravity(Gravity.CENTER);
        advancedView.setBackground(roundedBackground(colors.accentSoft,
            null, 14));
        advancedView.setClickable(true);
        advancedView.setFocusable(true);
        advancedView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () { toggleAdvanced(); }
            }));
        params = new LinearLayout.LayoutParams(dp(78), dp(44));
        params.rightMargin = dp(8);
        searchRow.addView(advancedView, params);

        addButton = makeIcon("+", 24,
            colors.accentStrong, "新增剪切板内容");
        addButton.setBackground(circleBackground(colors.accentSoft, null));
        addButton.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () {
                    try {
                        if (ClipHub.Editor && ClipHub.Editor.openNew) {
                            ClipHub.Editor.openNew();
                        }
                    } catch (error) {
                        state.lastError = String(error);
                    }
                }
            }));
        searchRow.addView(addButton,
            new LinearLayout.LayoutParams(dp(44), dp(44)));
        container.addView(searchRow,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));
        return container;
    }

    function buildResultArea(colors) {
        var root = new LinearLayout(appContext);
        var status = new LinearLayout(appContext);
        var sort = makeText("按" + sortModeLabel(value.sortMode), 9,
            colors.textSecondary, false);
        var scroll = new ScrollView(appContext);
        root.setOrientation(LinearLayout.VERTICAL);
        status.setOrientation(LinearLayout.HORIZONTAL);
        status.setGravity(Gravity.CENTER_VERTICAL);
        resultCountView = makeText("", 10,
            colors.textSecondary, false);
        updateResultCountOnMain();
        status.addView(resultCountView, new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        status.addView(sort, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        root.addView(status, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(31)));
        resultContainer = new LinearLayout(appContext);
        resultContainer.setOrientation(LinearLayout.VERTICAL);
        scroll.setFillViewport(false);
        scroll.setVerticalScrollBarEnabled(false);
        scroll.addView(resultContainer, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT));
        root.addView(scroll, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));
        refreshResultsOnMain();
        return root;
    }

    function makeChoiceChipRow(items, selectedKey, colors, onSelect,
            targetViews) {
        var row = new LinearLayout(appContext);
        var index;
        var chip;
        var params;
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        for (index = 0; index < items.length; index += 1) {
            chip = makeChip(items[index].label,
                String(items[index].key) === String(selectedKey), colors);
            (function (key, view) {
                view.setOnClickListener(new JavaAdapter(
                    View.OnClickListener, {
                        onClick: function () { onSelect(key); }
                    }));
                if (targetViews) { targetViews[String(key)] = view; }
            }(items[index].key, chip));
            params = new LinearLayout.LayoutParams(0,
                LinearLayout.LayoutParams.WRAP_CONTENT, 1);
            if (index > 0) { params.leftMargin = dp(5); }
            row.addView(chip, params);
        }
        return row;
    }

    function addChoiceSection(parent, title, row, bottomDp, colors) {
        var label = makeText(title, 10, colors.textSecondary, true);
        var params;
        parent.addView(label, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(5);
        params.bottomMargin = dp(bottomDp);
        parent.addView(row, params);
    }

    function buildAdvancedKeywordInput(colors) {
        var input = new EditText(appContext);
        input.setSingleLine(true);
        suppressTextWatcher = true;
        input.setText(String(value.keyword || ""));
        input.setSelection(input.getText().length());
        suppressTextWatcher = false;
        input.setHint("在筛选结果中搜索");
        input.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        input.setTextColor(Color.parseColor(colors.textPrimary));
        input.setHintTextColor(Color.parseColor(colors.textSecondary));
        input.setInputType(InputType.TYPE_CLASS_TEXT |
            InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        input.setImeOptions(EditorInfo.IME_ACTION_SEARCH);
        input.setPadding(dp(10), dp(5), dp(8), dp(5));
        input.setBackground(roundedBackground(colors.surfaceMuted,
            colors.stroke, 13));
        input.setOnEditorActionListener(new JavaAdapter(
            TextView.OnEditorActionListener, {
                onEditorAction: function (view, actionId) {
                    if (Number(actionId) ===
                            Number(EditorInfo.IME_ACTION_SEARCH)) {
                        performAdvancedKeywordFromInput(
                            "ui_advanced_search_ime");
                        return true;
                    }
                    return false;
                }
            }));
        input.addTextChangedListener(new JavaAdapter(TextWatcher, {
            beforeTextChanged: function () {},
            onTextChanged: function (text) {
                if (!suppressTextWatcher) {
                    scheduleRealtimeSearch(String(text));
                }
            },
            afterTextChanged: function () {}
        }));
        advancedKeywordInput = input;
        state.advancedKeywordInputPresent = true;
        return input;
    }

    function buildAdvancedDrawer(colors, counts) {
        var drawer = new LinearLayout(appContext);
        var titleRow = new LinearLayout(appContext);
        var title = makeText("高级筛选", 14,
            colors.textPrimary, true);
        var close = makeIcon("×", 18,
            colors.textSecondary, "收起高级筛选");
        var scroll = new ScrollView(appContext);
        var content = new LinearLayout(appContext);
        var footer = new LinearLayout(appContext);
        var params;
        var pinnedRow;
        var sensitiveRow;
        var sortRow;

        drawer.setOrientation(LinearLayout.VERTICAL);
        drawer.setPadding(dp(11), dp(9), dp(11), dp(9));
        drawer.setBackground(roundedBackground(colors.surface,
            colors.stroke, 17));
        if (Build.VERSION.SDK_INT >= 21) { drawer.setElevation(dp(16)); }
        titleRow.setOrientation(LinearLayout.HORIZONTAL);
        titleRow.setGravity(Gravity.CENTER_VERTICAL);
        titleRow.addView(title, new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        close.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { toggleAdvanced(); }
        }));
        titleRow.addView(close, new LinearLayout.LayoutParams(dp(30), dp(30)));
        drawer.addView(titleRow, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(34)));

        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(40));
        params.bottomMargin = dp(9);
        drawer.addView(buildAdvancedKeywordInput(colors), params);

        content.setOrientation(LinearLayout.VERTICAL);
        if (counts.sources.length > 0) {
            addSection(content, "来源应用（多选）",
                counts.sources, "source", colors);
        }
        if (counts.types.length > 0) {
            addSection(content, "内容类型（多选）",
                counts.types, "type", colors);
        }
        if (counts.tags.length > 0) {
            addSection(content, "标签（多选）",
                counts.tags, "tag", colors);
        }

        sortRow = makeChoiceChipRow([
            { key: "latest", label: "最新优先" },
            { key: "pinned", label: "置顶优先" },
            { key: "source", label: "来源应用" }
        ], value.sortMode, colors, function (mode) {
            setSortMode(mode);
        }, sortViews);
        state.sortOptionCount = 3;
        addChoiceSection(content, "排序方式", sortRow, 8, colors);

        pinnedRow = makeChoiceChipRow([
            { key: "all", label: "全部" },
            { key: "only", label: "仅置顶" }
        ], value.pinnedOnly ? "only" : "all", colors, function (mode) {
            if ((mode === "only") !== value.pinnedOnly) { togglePinned(); }
        }, pinnedViews);
        addChoiceSection(content, "置顶状态", pinnedRow, 8, colors);

        sensitiveRow = makeChoiceChipRow([
            { key: "all", label: "全部" },
            { key: "only", label: "仅敏感" },
            { key: "exclude", label: "隐藏敏感" }
        ], value.sensitiveMode, colors, function (mode) {
            setSensitive(mode);
        }, sensitiveViews);
        addChoiceSection(content, "敏感内容", sensitiveRow, 3, colors);

        scroll.setVerticalScrollBarEnabled(false);
        scroll.addView(content, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT));
        drawer.addView(scroll, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));

        footer.setOrientation(LinearLayout.HORIZONTAL);
        footer.setGravity(Gravity.CENTER_VERTICAL);
        resetView = makeSecondaryButton("重置", colors);
        resetView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () { resetFromUi(); }
            }));
        applyView = makePrimaryButton("应用筛选", colors);
        applyView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () { applyFromUi(); }
            }));
        params = new LinearLayout.LayoutParams(0, dp(40), 1);
        params.rightMargin = dp(7);
        footer.addView(resetView, params);
        footer.addView(applyView,
            new LinearLayout.LayoutParams(0, dp(40), 1));
        drawer.addView(footer, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(48)));
        return drawer;
    }

    function buildBottomToolbar(colors) {
        var toolbar = new LinearLayout(appContext);
        var labels = ["置顶", "编辑", "新增", "删除", "翻译"];
        var icons = ["⌖", "✎", "+", "⌫", "文"];
        var index;
        var item;
        var icon;
        var label;
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setGravity(Gravity.CENTER);
        toolbar.setPadding(dp(4), dp(3), dp(4), dp(3));
        toolbar.setBackground(roundedBackground(colors.toolbar,
            null, 17));
        for (index = 0; index < labels.length; index += 1) {
            item = new LinearLayout(appContext);
            item.setOrientation(LinearLayout.VERTICAL);
            item.setGravity(Gravity.CENTER);
            icon = makeText(icons[index], index === 2 ? 22 : 16,
                index === 2 ? colors.accentStrong : colors.icon,
                index === 2);
            icon.setGravity(Gravity.CENTER);
            label = makeText(labels[index], 9,
                colors.textSecondary, index === 2);
            label.setGravity(Gravity.CENTER);
            item.addView(icon, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(26)));
            item.addView(label, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));
            toolbar.addView(item, new LinearLayout.LayoutParams(
                0, dp(56), 1));
        }
        return toolbar;
    }

    function buildPanelContent(requestFocus) {
        var colors = palette();
        var counts = optionCounts();
        var handle;
        var params;
        var history;
        var bodyFrame;
        var resultArea;

        if (!state.panelAttached || panelRoot === null) {
            return false;
        }
        panelRoot.removeAllViews();
        sourceViews = {};
        typeViews = {};
        tagViews = {};
        pinnedViews = {};
        sensitiveViews = {};
        sortViews = {};
        advancedKeywordInput = null;
        state.advancedKeywordInputPresent = false;
        state.sortOptionCount = 0;
        state.sourceWrapRowCount = 0;
        state.typeWrapRowCount = 0;
        state.tagWrapRowCount = 0;
        state.drawerWidthDp = 0;
        state.drawerHeightDp = 0;
        drawerContainer = null;
        resultContainer = null;
        resultCountView = null;
        state.sourceOptionCount = counts.sources.length;
        state.contentTypeOptionCount = counts.types.length;
        state.tagOptionCount = counts.tags.length;

        handle = new View(appContext);
        handle.setBackground(roundedBackground(colors.strokeStrong,
            null, 3));
        params = new LinearLayout.LayoutParams(dp(42), dp(4));
        params.gravity = Gravity.CENTER_HORIZONTAL;
        params.bottomMargin = dp(8);
        panelRoot.addView(handle, params);

        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(7);
        panelRoot.addView(buildSearchHeader(colors), params);

        if (searchHistory.length > 0 && !advancedVisible) {
            history = buildHistoryRow(colors);
            params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
            params.bottomMargin = dp(5);
            panelRoot.addView(history, params);
        } else {
            state.historyChipCount = 0;
        }

        bodyFrame = new FrameLayout(appContext);
        resultArea = buildResultArea(colors);
        bodyFrame.addView(resultArea, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT));
        if (advancedVisible) {
            drawerContainer = buildAdvancedDrawer(colors, counts);
            state.drawerWidthDp = 238;
            state.drawerHeightDp = 540;
            params = new FrameLayout.LayoutParams(dp(state.drawerWidthDp),
                dp(state.drawerHeightDp));
            params.gravity = Gravity.END | Gravity.TOP;
            bodyFrame.addView(drawerContainer, params);
        }
        panelRoot.addView(bodyFrame, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));

        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(64));
        params.topMargin = dp(4);
        panelRoot.addView(buildBottomToolbar(colors), params);

        state.sourceChipCount = Object.keys(sourceViews).length;
        state.typeChipCount = Object.keys(typeViews).length;
        state.tagChipCount = Object.keys(tagViews).length;
        state.advancedDrawerVisible = advancedVisible;
        state.panelRenderCount += 1;
        updatePanelSize();
        if (requestFocus && !advancedVisible) {
            requestKeyboardOnMain();
        }
        return true;
    }

    function showPanel(options) {
        options = options || {};
        if (!ready) {
            throw new Error("ClipHub filter is not ready");
        }
        loadHistory();
        advancedVisible = options.showAdvanced === true;
        state.advancedDrawerVisible = advancedVisible;
        if (state.panelAttached) {
            requireMain(runOnMainSync(function () {
                buildPanelContent(options.requestKeyboard === true);
                return true;
            }, 2500));
            return {
                ok: true,
                attached: true,
                reused: true,
                state: getPanelState()
            };
        }
        return requireMain(runOnMainSync(function () {
            var size = panelDimensions();
            var type = Build.VERSION.SDK_INT >= 26 ?
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY :
                WindowManager.LayoutParams.TYPE_SYSTEM_ALERT;
            var thread = nowThread();
            var colors = palette();
            panelRoot = new LinearLayout(appContext);
            panelRoot.setOrientation(LinearLayout.VERTICAL);
            panelRoot.setPadding(dp(12), dp(8), dp(12), dp(10));
            panelRoot.setBackground(roundedBackground(colors.surface,
                colors.stroke, 24));
            if (Build.VERSION.SDK_INT >= 21) {
                panelRoot.setElevation(dp(20));
            }
            panelParams = new WindowManager.LayoutParams(
                size.width, size.height, type,
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
                    WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED |
                    WindowManager.LayoutParams.FLAG_DIM_BEHIND,
                PixelFormat.TRANSLUCENT);
            panelParams.gravity = Gravity.BOTTOM |
                Gravity.CENTER_HORIZONTAL;
            panelParams.y = dp(10);
            panelParams.dimAmount = 0.44;
            panelParams.softInputMode =
                WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE |
                WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE;
            try {
                panelParams.setTitle("ClipHub Filter Panel");
            } catch (ignoredTitle) {}
            windowManager.addView(panelRoot, panelParams);
            state.panelAttached = true;
            state.panelOpenCount += 1;
            state.panelWindowType = Number(type);
            state.panelFlags = Number(panelParams.flags);
            state.panelWidthPx = size.width;
            state.panelHeightPx = size.height;
            state.panelWidthDp = size.widthDp;
            state.panelHeightDp = size.heightDp;
            state.dimAmount = Number(panelParams.dimAmount);
            state.modalWindow = true;
            state.opaqueBackground = true;
            state.panelAddThreadId = thread.id;
            state.panelAddThreadName = thread.name;
            state.lastError = null;
            try {
                previewRows = ClipHub.Repository.listItems(
                    toQueryOptions({ limit: RESULT_LIMIT, offset: 0 }));
                previewRows = sortRows(previewRows);
                state.lastResultCount = previewRows.length;
                previewRows = previewRows.slice(0, PREVIEW_LIMIT);
            } catch (previewError) {
                state.lastError = String(previewError);
                previewRows = [];
            }
            buildPanelContent(options.requestKeyboard !== false);
            return {
                ok: true,
                attached: true,
                reused: false,
                state: getPanelState()
            };
        }, 3000));
    }

    function closePanel() {
        if (!state.panelAttached && panelRoot === null) {
            return {
                ok: true,
                attached: false,
                alreadyClosed: true,
                state: getPanelState()
            };
        }
        requireMain(runOnMainSync(function () {
            var thread = nowThread();
            try {
                hideKeyboardOnMain();
                if (panelRoot !== null) {
                    try {
                        windowManager.removeViewImmediate(panelRoot);
                    } catch (error) {
                        if (panelRoot.isAttachedToWindow()) {
                            throw error;
                        }
                    }
                }
                state.panelCloseCount += 1;
                state.panelRemoveThreadId = thread.id;
                state.panelRemoveThreadName = thread.name;
                state.lastError = null;
                return true;
            } finally {
                searchGeneration += 1;
                state.panelAttached = false;
                state.inputFocused = false;
                advancedVisible = false;
                state.advancedDrawerVisible = false;
                panelRoot = null;
                panelParams = null;
                keywordInput = null;
                advancedKeywordInput = null;
                searchView = null;
                resetView = null;
                closeView = null;
                advancedView = null;
                applyView = null;
                clearHistoryView = null;
                resultContainer = null;
                resultCountView = null;
                drawerContainer = null;
                sourceViews = {};
                typeViews = {};
                tagViews = {};
                pinnedViews = {};
                sensitiveViews = {};
                sortViews = {};
                historyViews = [];
            }
        }, 3000));
        return {
            ok: true,
            attached: false,
            alreadyClosed: false,
            state: getPanelState()
        };
    }

    function handleBack() {
        if (!state.panelAttached) { return false; }
        if (advancedVisible) {
            advancedVisible = false;
            state.advancedDrawerVisible = false;
            state.advancedCloseCount += 1;
            state.backLayerCloseCount += 1;
            state.lastBackLayer = "advanced_drawer";
            requireMain(runOnMainSync(function () {
                buildPanelContent(false);
                return true;
            }, 2500));
            return true;
        }
        state.backLayerCloseCount += 1;
        state.lastBackLayer = "search_panel";
        closePanel();
        return true;
    }

    function getPanelState() {
        var attachedToWindow = false;
        var notFocusable = false;
        try {
            attachedToWindow = panelRoot !== null &&
                panelRoot.isAttachedToWindow();
        } catch (ignored) {}
        try {
            notFocusable = panelParams !== null &&
                (Number(panelParams.flags) & Number(
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE)) !== 0;
        } catch (ignoredFlag) {}
        try {
            state.inputFocused = keywordInput !== null &&
                keywordInput.hasFocus();
        } catch (ignoredFocus) {}
        return {
            attached: state.panelAttached,
            attachedToWindow: attachedToWindow,
            focusableWindow: !notFocusable,
            inputPresent: keywordInput !== null,
            advancedKeywordInputPresent:
                advancedKeywordInput !== null,
            inputFocused: state.inputFocused,
            sourceOptionCount: Number(state.sourceOptionCount),
            contentTypeOptionCount:
                Number(state.contentTypeOptionCount),
            tagOptionCount: Number(state.tagOptionCount),
            sourceChipCount: Object.keys(sourceViews).length,
            typeChipCount: Object.keys(typeViews).length,
            tagChipCount: Object.keys(tagViews).length,
            historyChipCount: Number(state.historyChipCount),
            resultCardCount: Number(state.resultCardCount),
            resultSourceIconCount:
                Number(state.resultSourceIconCount),
            advancedDrawerVisible: advancedVisible,
            advancedButtonText: advancedView !== null ?
                String(advancedView.getText()) : "",
            sortMode: validateSortMode(value && value.sortMode),
            sortOptionCount: Number(state.sortOptionCount),
            sourceWrapRowCount: Number(state.sourceWrapRowCount),
            typeWrapRowCount: Number(state.typeWrapRowCount),
            tagWrapRowCount: Number(state.tagWrapRowCount),
            drawerWidthDp: Number(state.drawerWidthDp),
            drawerHeightDp: Number(state.drawerHeightDp),
            repositorySortUnchanged: true,
            sortScope: state.sortScope,
            backLayerCloseCount: Number(state.backLayerCloseCount),
            lastBackLayer: state.lastBackLayer,
            panelWindowType: state.panelWindowType,
            panelFlags: state.panelFlags,
            panelWidthPx: state.panelWidthPx,
            panelHeightPx: state.panelHeightPx,
            panelWidthDp: state.panelWidthDp,
            panelHeightDp: state.panelHeightDp,
            dimAmount: state.dimAmount,
            modalWindow: state.modalWindow,
            opaqueBackground: state.opaqueBackground,
            horizontalFadeEnabled: state.horizontalFadeEnabled,
            panelOpenCount: Number(state.panelOpenCount),
            panelCloseCount: Number(state.panelCloseCount),
            panelRenderCount: Number(state.panelRenderCount),
            searchActionCount: Number(state.searchActionCount),
            realtimeSearchCount:
                Number(state.realtimeSearchCount),
            sourceToggleCount: Number(state.sourceToggleCount),
            typeToggleCount: Number(state.typeToggleCount),
            tagToggleCount: Number(state.tagToggleCount),
            pinnedToggleCount: Number(state.pinnedToggleCount),
            sensitiveToggleCount:
                Number(state.sensitiveToggleCount),
            sortToggleCount: Number(state.sortToggleCount),
            resetActionCount: Number(state.resetActionCount),
            applyActionCount: Number(state.applyActionCount),
            advancedOpenCount: Number(state.advancedOpenCount),
            advancedCloseCount: Number(state.advancedCloseCount),
            historyUseCount: Number(state.historyUseCount),
            historyClearCount: Number(state.historyClearCount),
            keyboardRequestCount: Number(state.keyboardRequestCount),
            panelAddThreadId: state.panelAddThreadId,
            panelAddThreadName: state.panelAddThreadName,
            panelRemoveThreadId: state.panelRemoveThreadId,
            panelRemoveThreadName: state.panelRemoveThreadName,
            lastUiThreadId: state.lastUiThreadId,
            lastUiThreadName: state.lastUiThreadName,
            searchPageStyle: state.searchPageStyle,
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
        state.realtimeSearchCount = 0;
        state.sourceToggleCount = 0;
        state.typeToggleCount = 0;
        state.tagToggleCount = 0;
        state.pinnedToggleCount = 0;
        state.sensitiveToggleCount = 0;
        state.sortToggleCount = 0;
        state.resetActionCount = 0;
        state.applyActionCount = 0;
        state.advancedOpenCount = 0;
        state.advancedCloseCount = 0;
        state.historyUseCount = 0;
        state.historyClearCount = 0;
        state.keyboardRequestCount = 0;
        state.panelWindowType = null;
        state.panelFlags = null;
        state.panelWidthPx = null;
        state.panelHeightPx = null;
        state.panelWidthDp = null;
        state.panelHeightDp = null;
        state.dimAmount = 0;
        state.modalWindow = false;
        state.opaqueBackground = false;
        state.horizontalFadeEnabled = false;
        state.advancedKeywordInputPresent = false;
        state.sortOptionCount = 0;
        state.sourceWrapRowCount = 0;
        state.typeWrapRowCount = 0;
        state.tagWrapRowCount = 0;
        state.drawerWidthDp = 0;
        state.drawerHeightDp = 0;
        state.backLayerCloseCount = 0;
        state.lastBackLayer = "";
        state.repositorySortUnchanged = true;
        state.sortScope = "result_window";
        state.panelAddThreadId = null;
        state.panelAddThreadName = null;
        state.panelRemoveThreadId = null;
        state.panelRemoveThreadName = null;
        state.lastUiThreadId = null;
        state.lastUiThreadName = null;
        state.inputFocused = false;
        state.sourceOptionCount = 0;
        state.contentTypeOptionCount = 0;
        state.tagOptionCount = 0;
        state.sourceChipCount = 0;
        state.typeChipCount = 0;
        state.tagChipCount = 0;
        state.historyChipCount = 0;
        state.resultCardCount = 0;
        state.resultSourceIconCount = 0;
        state.advancedDrawerVisible = false;
        state.searchPageStyle = "reference_search_v2";
        state.lastError = null;
    }

    ClipHub.Filter = {
        MODULE_NAME: "ch_11_filter",
        MODULE_VERSION: 7,

        init: function (context) {
            androidContext = context && context.androidContext ?
                context.androidContext : global.context;
            if (androidContext === null || androidContext === undefined) {
                throw new Error("Android context unavailable for filter");
            }
            appContext = androidContext.getApplicationContext() ||
                androidContext;
            windowManager = appContext.getSystemService(
                Context.WINDOW_SERVICE);
            inputMethodManager = appContext.getSystemService(
                Context.INPUT_METHOD_SERVICE);
            if (windowManager === null) {
                throw new Error(
                    "WindowManager unavailable for filter panel");
            }
            mainHandler = new Handler(Looper.getMainLooper());
            density = Number(appContext.getResources()
                .getDisplayMetrics().density || 1);
            value = emptyValue();
            ready = true;
            eventListeners = [];
            panelRoot = null;
            panelParams = null;
            advancedVisible = false;
            previewRows = [];
            searchGeneration = 0;
            resetState();
            loadHistory();
            registerEvent("clipboard_added");
            registerEvent("clipboard_merged");
            registerEvent("clipboard_deleted");
            registerEvent("clipboard_restored");
            registerEvent("tags_changed");
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
                searchHistory: copyList(searchHistory),
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
            return sortRows(ClipHub.Repository.listItems(
                toQueryOptions(options || {})));
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

        setTagIds: function (tagIds, options) {
            return setValue({ tagIds: tagIds }, options);
        },

        setPinnedOnly: function (enabled, options) {
            return setValue({ pinnedOnly: enabled }, options);
        },

        setSensitiveMode: function (mode, options) {
            return setValue({ sensitiveMode: mode }, options);
        },

        setSortMode: function (mode, options) {
            return setValue({ sortMode: mode }, options);
        },

        getSourceOptions: function () {
            return ClipHub.Repository.listSourceOptions();
        },

        getContentTypeOptions: function () {
            return ClipHub.Repository.listContentTypeOptions();
        },

        getTagOptions: function () {
            return ClipHub.Repository.listTags();
        },

        showPanel: showPanel,
        closePanel: closePanel,
        handleBack: handleBack,
        getPanelState: getPanelState,

        performSearch: function (text) {
            return requireMain(runOnMainSync(function () {
                if (!state.panelAttached || keywordInput === null) {
                    return false;
                }
                suppressTextWatcher = true;
                try {
                    keywordInput.setText(String(text === null ||
                        text === undefined ? "" : text));
                    keywordInput.setSelection(
                        keywordInput.getText().length());
                } finally {
                    suppressTextWatcher = false;
                }
                return performKeywordFromInput("api_search");
            }, 3000));
        },

        performAdvancedClick: function () {
            return requireMain(runOnMainSync(function () {
                return advancedView !== null ?
                    advancedView.performClick() : false;
            }, 2500));
        },

        performAdvancedKeywordSearch: function (text) {
            return requireMain(runOnMainSync(function () {
                if (!state.panelAttached ||
                        advancedKeywordInput === null) {
                    return false;
                }
                suppressTextWatcher = true;
                try {
                    advancedKeywordInput.setText(String(text === null ||
                        text === undefined ? "" : text));
                    advancedKeywordInput.setSelection(
                        advancedKeywordInput.getText().length());
                } finally {
                    suppressTextWatcher = false;
                }
                return performAdvancedKeywordFromInput(
                    "api_advanced_search");
            }, 3000));
        },

        performApplyClick: function () {
            return requireMain(runOnMainSync(function () {
                return applyView !== null ?
                    applyView.performClick() : false;
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
                return typeViews[type] ?
                    typeViews[type].performClick() : false;
            }, 2500));
        },

        performTagClick: function (tagId) {
            tagId = String(Number(tagId));
            return requireMain(runOnMainSync(function () {
                return tagViews[tagId] ?
                    tagViews[tagId].performClick() : false;
            }, 2500));
        },

        performSortClick: function (mode) {
            mode = validateSortMode(mode);
            return requireMain(runOnMainSync(function () {
                return sortViews[mode] ?
                    sortViews[mode].performClick() : false;
            }, 2500));
        },

        performPinnedClick: function (onlyPinned) {
            return requireMain(runOnMainSync(function () {
                var target = onlyPinned === true ? "only" : "all";
                return pinnedViews[target] ?
                    pinnedViews[target].performClick() : false;
            }, 2500));
        },

        performSensitiveClick: function (mode) {
            mode = String(mode || "all");
            return requireMain(runOnMainSync(function () {
                return sensitiveViews[mode] ?
                    sensitiveViews[mode].performClick() : false;
            }, 2500));
        },

        performHistoryClick: function (index) {
            index = Math.floor(Number(index));
            return requireMain(runOnMainSync(function () {
                return index >= 0 && index < historyViews.length ?
                    historyViews[index].performClick() : false;
            }, 2500));
        },

        performResetClick: function () {
            return requireMain(runOnMainSync(function () {
                return resetView !== null ?
                    resetView.performClick() : resetFromUi();
            }, 2500));
        },

        performCloseClick: function () {
            return requireMain(runOnMainSync(function () {
                return closeView !== null ?
                    closeView.performClick() : false;
            }, 2500));
        },

        shutdown: function () {
            try {
                closePanel();
            } catch (ignoredClose) {}
            unregisterEvents();
            searchGeneration += 1;
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
