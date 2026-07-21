(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var View = Packages.android.view.View;
    var Gravity = Packages.android.view.Gravity;
    var Color = Packages.android.graphics.Color;
    var GradientDrawable = Packages.android.graphics.drawable.GradientDrawable;
    var LinearLayout = Packages.android.widget.LinearLayout;
    var FrameLayout = Packages.android.widget.FrameLayout;
    var ScrollView = Packages.android.widget.ScrollView;
    var TextView = Packages.android.widget.TextView;
    var TypedValue = Packages.android.util.TypedValue;
    var TextUtils = Packages.android.text.TextUtils;
    var Thread = Packages.java.lang.Thread;
    var SimpleDateFormat = Packages.java.text.SimpleDateFormat;
    var Locale = Packages.java.util.Locale;
    var Date = Packages.java.util.Date;

    var androidContext = null;
    var density = 1;
    var ready = false;
    var visible = false;
    var limit = 20;
    var items = [];
    var itemViews = [];
    var addedListener = null;
    var mergedListener = null;
    var state = {
        renderedCount: 0,
        emptyVisible: false,
        refreshCount: 0,
        eventRefreshCount: 0,
        copyCount: 0,
        lastCopiedId: null,
        lastCopyOk: false,
        clickThreadId: null,
        clickThreadName: null,
        renderThreadId: null,
        renderThreadName: null,
        lastError: null
    };

    function dp(value) {
        return Math.max(1, Math.floor(Number(value) * density + 0.5));
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
            config = androidContext.getResources().getConfiguration();
            return (Number(config.uiMode) &
                Number(Packages.android.content.res.Configuration.UI_MODE_NIGHT_MASK)) ===
                Number(Packages.android.content.res.Configuration.UI_MODE_NIGHT_YES);
        } catch (ignoredConfig) { return false; }
    }

    function makeText(text, sizeSp, color, bold) {
        var view = new TextView(androidContext);
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

    function cardBackground(dark) {
        var drawable = new GradientDrawable();
        drawable.setShape(GradientDrawable.RECTANGLE);
        drawable.setColor(Color.parseColor(dark ? "#FF24272D" : "#FFF4F4F6"));
        drawable.setCornerRadius(dp(13));
        drawable.setStroke(dp(1), Color.parseColor(dark ? "#24FFFFFF" : "#12000000"));
        return drawable;
    }

    function formatTime(value) {
        try {
            return String(new SimpleDateFormat("MM-dd HH:mm", Locale.getDefault())
                .format(new Date(Number(value || 0))));
        } catch (ignored) { return ""; }
    }

    function sourceText(row) {
        var source = row.source_label || row.source_package || "未知来源";
        var copied = Number(row.copy_count || 1);
        var time = formatTime(row.last_copied_at);
        return String(source) + (copied > 1 ? "  ·  " + copied + " 次" : "") +
            (time ? "  ·  " + time : "");
    }

    function copyRow(row) {
        var thread = Thread.currentThread();
        var result;
        var closeAfter = false;
        try {
            result = ClipHub.Clipboard.writeText(String(row.content), {
                label: "ClipHub",
                sensitive: Number(row.is_sensitive || 0) === 1
            });
            state.copyCount += 1;
            state.lastCopiedId = Number(row.id);
            state.lastCopyOk = result && result.ok === true;
            state.clickThreadId = Number(thread.getId());
            state.clickThreadName = String(thread.getName());
            try {
                closeAfter = ClipHub.Settings &&
                    ClipHub.Settings.get("closeAfterCopy", false) === true;
            } catch (ignoredSetting) {}
            if (closeAfter) {
                visible = false;
                ClipHub.Window.close();
            }
            return state.lastCopyOk;
        } catch (error) {
            state.lastError = String(error);
            state.lastCopyOk = false;
            return false;
        }
    }

    function clickListener(row) {
        return new JavaAdapter(View.OnClickListener, {
            onClick: function () { copyRow(row); }
        });
    }

    function buildContent(rows) {
        var dark = isDarkMode();
        var primary = dark ? "#FFF4F4F5" : "#FF171717";
        var secondary = dark ? "#FFB4B4BC" : "#FF66666F";
        var outer = new LinearLayout(androidContext);
        var header;
        var scroll;
        var list;
        var index;
        var row;
        var card;
        var preview;
        var meta;
        var params;
        var thread = Thread.currentThread();

        outer.setOrientation(LinearLayout.VERTICAL);
        header = makeText(rows.length > 0 ? "最近记录  " + rows.length : "剪贴板历史", 13,
            secondary, false);
        header.setPadding(dp(2), 0, dp(2), dp(8));
        outer.addView(header, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));

        scroll = new ScrollView(androidContext);
        scroll.setFillViewport(true);
        scroll.setVerticalScrollBarEnabled(false);
        list = new LinearLayout(androidContext);
        list.setOrientation(LinearLayout.VERTICAL);
        scroll.addView(list, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT));
        outer.addView(scroll, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));

        itemViews = [];
        if (rows.length === 0) {
            state.emptyVisible = true;
            preview = makeText("暂无剪贴板记录\n复制文本后会显示在这里", 14,
                secondary, false);
            preview.setGravity(Gravity.CENTER);
            preview.setLineSpacing(0, 1.18);
            preview.setPadding(dp(12), dp(40), dp(12), dp(40));
            list.addView(preview, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));
        } else {
            state.emptyVisible = false;
            for (index = 0; index < rows.length; index += 1) {
                row = rows[index];
                card = new LinearLayout(androidContext);
                card.setOrientation(LinearLayout.VERTICAL);
                card.setPadding(dp(12), dp(10), dp(12), dp(9));
                card.setBackground(cardBackground(dark));
                card.setClickable(true);
                card.setFocusable(true);
                card.setContentDescription("复制第 " + (index + 1) + " 条剪贴板记录");

                preview = makeText(Number(row.is_sensitive || 0) === 1
                    ? "敏感内容" : String(row.content), 14, primary, false);
                preview.setMaxLines(3);
                preview.setEllipsize(TextUtils.TruncateAt.END);
                preview.setLineSpacing(0, 1.12);
                card.addView(preview, new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT));

                meta = makeText(sourceText(row), 11, secondary, false);
                meta.setPadding(0, dp(7), 0, 0);
                meta.setSingleLine(true);
                meta.setEllipsize(TextUtils.TruncateAt.END);
                card.addView(meta, new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT));
                card.setOnClickListener(clickListener(row));

                params = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT);
                params.bottomMargin = dp(8);
                list.addView(card, params);
                itemViews.push(card);
            }
        }
        state.renderedCount = rows.length;
        state.renderThreadId = Number(thread.getId());
        state.renderThreadName = String(thread.getName());
        return outer;
    }

    function copyRows(rows) {
        var output = [];
        var index;
        rows = rows || [];
        for (index = 0; index < rows.length; index += 1) { output.push(rows[index]); }
        return output;
    }

    function renderRows(rows) {
        return ClipHub.Window.runOnMain(function () {
            var view = buildContent(rows);
            ClipHub.Window.setContentView(view);
            return true;
        }, 3000);
    }

    function refresh(fromEvent) {
        if (!ready) { throw new Error("ClipHub list is not ready"); }
        items = ClipHub.Repository.listItems({ limit: limit, offset: 0 });
        state.refreshCount += 1;
        if (fromEvent === true) { state.eventRefreshCount += 1; }
        if (visible && ClipHub.Window && ClipHub.Window.isAttached()) {
            renderRows(items);
        }
        return items.length;
    }

    function show(options) {
        var openResult;
        options = options || {};
        limit = Math.max(1, Math.min(100, Math.floor(Number(options.limit || limit))));
        if (!ClipHub.Window || typeof ClipHub.Window.open !== "function") {
            throw new Error("ClipHub window is unavailable");
        }
        openResult = ClipHub.Window.open({
            widthDp: Number(options.widthDp || 340),
            heightDp: Number(options.heightDp || 420),
            statusText: "正在加载剪贴板历史"
        });
        visible = true;
        refresh(false);
        return {
            ok: true,
            visible: true,
            open: openResult,
            state: getState()
        };
    }

    function getState() {
        var ids = [];
        var index;
        for (index = 0; index < items.length; index += 1) {
            ids.push(Number(items[index].id));
        }
        return {
            ready: ready,
            visible: visible,
            itemCount: items.length,
            itemIds: ids,
            renderedCount: Number(state.renderedCount),
            emptyVisible: state.emptyVisible,
            refreshCount: Number(state.refreshCount),
            eventRefreshCount: Number(state.eventRefreshCount),
            copyCount: Number(state.copyCount),
            lastCopiedId: state.lastCopiedId,
            lastCopyOk: state.lastCopyOk,
            clickThreadId: state.clickThreadId,
            clickThreadName: state.clickThreadName,
            renderThreadId: state.renderThreadId,
            renderThreadName: state.renderThreadName,
            lastError: state.lastError,
            windowAttached: !!(ClipHub.Window && ClipHub.Window.isAttached())
        };
    }

    ClipHub.List = {
        MODULE_NAME: "ch_09_list",
        MODULE_VERSION: 2,
        init: function (context) {
            androidContext = context && context.androidContext
                ? context.androidContext : global.context;
            if (androidContext === null || androidContext === undefined) {
                throw new Error("Android context unavailable for list");
            }
            androidContext = androidContext.getApplicationContext() || androidContext;
            density = Number(androidContext.getResources().getDisplayMetrics().density || 1);
            items = [];
            itemViews = [];
            visible = false;
            state.renderedCount = 0;
            state.emptyVisible = false;
            state.refreshCount = 0;
            state.eventRefreshCount = 0;
            state.copyCount = 0;
            state.lastCopiedId = null;
            state.lastCopyOk = false;
            state.clickThreadId = null;
            state.clickThreadName = null;
            state.renderThreadId = null;
            state.renderThreadName = null;
            state.lastError = null;
            addedListener = function () {
                if (visible) {
                    try { refresh(true); } catch (error) { state.lastError = String(error); }
                }
            };
            mergedListener = addedListener;
            if (ClipHub.EventBus) {
                ClipHub.EventBus.on("clipboard_added", addedListener);
                ClipHub.EventBus.on("clipboard_merged", mergedListener);
            }
            ready = true;
            return true;
        },
        show: show,
        refresh: function () { return refresh(false); },
        hide: function (closeWindow) {
            visible = false;
            if (closeWindow !== false && ClipHub.Window) { ClipHub.Window.close(); }
            return true;
        },
        setItems: function (value) {
            items = copyRows(value || []);
            if (visible && ClipHub.Window && ClipHub.Window.isAttached()) {
                renderRows(items);
            }
            return items.length;
        },
        clear: function () {
            items = [];
            if (visible && ClipHub.Window && ClipHub.Window.isAttached()) {
                renderRows(items);
            }
            return true;
        },
        performItemClick: function (index) {
            index = Math.floor(Number(index));
            return ClipHub.Window.runOnMain(function () {
                if (index < 0 || index >= itemViews.length) { return false; }
                return itemViews[index].performClick();
            }, 2500);
        },
        getState: getState,
        shutdown: function () {
            if (ClipHub.EventBus) {
                if (addedListener !== null) {
                    ClipHub.EventBus.off("clipboard_added", addedListener);
                }
                if (mergedListener !== null) {
                    ClipHub.EventBus.off("clipboard_merged", mergedListener);
                }
            }
            addedListener = null;
            mergedListener = null;
            items = [];
            itemViews = [];
            visible = false;
            ready = false;
            androidContext = null;
            return true;
        }
    };
}((function () { return this; }())));
