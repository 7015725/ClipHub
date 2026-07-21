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
    var deleteViews = [];
    var undoView = null;
    var lastDeleted = null;
    var addedListener = null;
    var mergedListener = null;
    var deletedListener = null;
    var restoredListener = null;
    var state = {
        renderedCount: 0,
        emptyVisible: false,
        refreshCount: 0,
        eventRefreshCount: 0,
        copyCount: 0,
        deleteCount: 0,
        restoreCount: 0,
        lastCopiedId: null,
        lastDeletedId: null,
        lastRestoredId: null,
        lastCopyOk: false,
        clickThreadId: null,
        clickThreadName: null,
        deleteThreadId: null,
        deleteThreadName: null,
        restoreThreadId: null,
        restoreThreadName: null,
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

    function cardBackground(dark) {
        return roundedBackground(
            dark ? "#FF24272D" : "#FFF4F4F6",
            dark ? "#24FFFFFF" : "#12000000",
            13
        );
    }

    function actionBackground(dark, danger) {
        return roundedBackground(
            danger
                ? (dark ? "#2EF87171" : "#18DC2626")
                : (dark ? "#22FFFFFF" : "#10000000"),
            danger
                ? (dark ? "#55F87171" : "#35DC2626")
                : (dark ? "#25FFFFFF" : "#16000000"),
            9
        );
    }

    function makeAction(text, dark, danger) {
        var color = danger
            ? (dark ? "#FFFFA3A3" : "#FFB91C1C")
            : (dark ? "#FFE4E4E7" : "#FF3F3F46");
        var view = makeText(text, 12, color, true);
        view.setGravity(Gravity.CENTER);
        view.setPadding(dp(11), dp(6), dp(11), dp(6));
        view.setBackground(actionBackground(dark, danger));
        view.setClickable(true);
        view.setFocusable(true);
        return view;
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

    function emit(name, payload) {
        try {
            if (ClipHub.EventBus && typeof ClipHub.EventBus.emit === "function") {
                return ClipHub.EventBus.emit(String(name), payload || {});
            }
        } catch (ignored) {}
        return 0;
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

    function deleteRow(row) {
        var thread = Thread.currentThread();
        var id = Number(row.id);
        var deletedAt = ClipHub.Base.now();
        var changed;
        var delivered;
        try {
            changed = ClipHub.Repository.softDeleteItem(id, deletedAt);
            if (Number(changed) < 1) { return false; }
            lastDeleted = { id: id, deletedAt: deletedAt };
            state.deleteCount += 1;
            state.lastDeletedId = id;
            state.deleteThreadId = Number(thread.getId());
            state.deleteThreadName = String(thread.getName());
            delivered = emit("clipboard_deleted", {
                id: id,
                deletedAt: deletedAt,
                threadId: state.deleteThreadId,
                threadName: state.deleteThreadName
            });
            if (delivered < 1 && visible) { refresh(false); }
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function undoLastDelete() {
        var thread = Thread.currentThread();
        var target = lastDeleted;
        var row;
        var changed;
        var delivered;
        if (target === null) { return false; }
        try {
            row = ClipHub.Repository.getItem(Number(target.id), true);
            if (row === null || row === undefined || row.deleted_at === null ||
                    row.deleted_at === undefined) {
                lastDeleted = null;
                if (visible) { refresh(false); }
                return false;
            }
            changed = ClipHub.Repository.restoreItem(Number(target.id));
            if (Number(changed) < 1) { return false; }
            lastDeleted = null;
            state.restoreCount += 1;
            state.lastRestoredId = Number(target.id);
            state.restoreThreadId = Number(thread.getId());
            state.restoreThreadName = String(thread.getName());
            delivered = emit("clipboard_restored", {
                id: Number(target.id),
                threadId: state.restoreThreadId,
                threadName: state.restoreThreadName
            });
            if (delivered < 1 && visible) { refresh(false); }
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function clickListener(row) {
        return new JavaAdapter(View.OnClickListener, {
            onClick: function () { copyRow(row); }
        });
    }

    function deleteListener(row) {
        return new JavaAdapter(View.OnClickListener, {
            onClick: function () { deleteRow(row); }
        });
    }

    function undoListener() {
        return new JavaAdapter(View.OnClickListener, {
            onClick: function () { undoLastDelete(); }
        });
    }

    function buildContent(rows) {
        var dark = isDarkMode();
        var primary = dark ? "#FFF4F4F5" : "#FF171717";
        var secondary = dark ? "#FFB4B4BC" : "#FF66666F";
        var outer = new LinearLayout(androidContext);
        var header;
        var undoBar;
        var undoText;
        var scroll;
        var list;
        var index;
        var row;
        var card;
        var preview;
        var actionRow;
        var meta;
        var deleteView;
        var params;
        var metaParams;
        var thread = Thread.currentThread();

        outer.setOrientation(LinearLayout.VERTICAL);
        header = makeText(rows.length > 0 ? "最近记录  " + rows.length : "剪贴板历史", 13,
            secondary, false);
        header.setPadding(dp(2), 0, dp(2), dp(8));
        outer.addView(header, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));

        undoView = null;
        if (lastDeleted !== null) {
            undoBar = new LinearLayout(androidContext);
            undoBar.setOrientation(LinearLayout.HORIZONTAL);
            undoBar.setGravity(Gravity.CENTER_VERTICAL);
            undoBar.setPadding(dp(10), dp(8), dp(8), dp(8));
            undoBar.setBackground(roundedBackground(
                dark ? "#FF20242A" : "#FFF7F7F8",
                dark ? "#24FFFFFF" : "#12000000",
                11
            ));
            undoText = makeText("已删除 1 条记录", 12, secondary, false);
            undoBar.addView(undoText, new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
            undoView = makeAction("撤销", dark, false);
            undoView.setContentDescription("撤销最近一次删除");
            undoView.setOnClickListener(undoListener());
            undoBar.addView(undoView, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));
            params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
            params.bottomMargin = dp(8);
            outer.addView(undoBar, params);
        }

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
        deleteViews = [];
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
                card.setPadding(dp(12), dp(10), dp(10), dp(9));
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

                actionRow = new LinearLayout(androidContext);
                actionRow.setOrientation(LinearLayout.HORIZONTAL);
                actionRow.setGravity(Gravity.CENTER_VERTICAL);
                actionRow.setPadding(0, dp(7), 0, 0);
                meta = makeText(sourceText(row), 11, secondary, false);
                meta.setSingleLine(true);
                meta.setEllipsize(TextUtils.TruncateAt.END);
                metaParams = new LinearLayout.LayoutParams(
                    0, LinearLayout.LayoutParams.WRAP_CONTENT, 1);
                metaParams.rightMargin = dp(8);
                actionRow.addView(meta, metaParams);

                deleteView = makeAction("删除", dark, true);
                deleteView.setContentDescription("删除第 " + (index + 1) + " 条剪贴板记录");
                deleteView.setOnClickListener(deleteListener(row));
                actionRow.addView(deleteView, new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT));
                card.addView(actionRow, new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT));
                card.setOnClickListener(clickListener(row));

                params = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT);
                params.bottomMargin = dp(8);
                list.addView(card, params);
                itemViews.push(card);
                deleteViews.push(deleteView);
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
            deleteCount: Number(state.deleteCount),
            restoreCount: Number(state.restoreCount),
            lastCopiedId: state.lastCopiedId,
            lastDeletedId: state.lastDeletedId,
            lastRestoredId: state.lastRestoredId,
            lastCopyOk: state.lastCopyOk,
            undoAvailable: lastDeleted !== null,
            clickThreadId: state.clickThreadId,
            clickThreadName: state.clickThreadName,
            deleteThreadId: state.deleteThreadId,
            deleteThreadName: state.deleteThreadName,
            restoreThreadId: state.restoreThreadId,
            restoreThreadName: state.restoreThreadName,
            renderThreadId: state.renderThreadId,
            renderThreadName: state.renderThreadName,
            lastError: state.lastError,
            windowAttached: !!(ClipHub.Window && ClipHub.Window.isAttached())
        };
    }

    function resetState() {
        state.renderedCount = 0;
        state.emptyVisible = false;
        state.refreshCount = 0;
        state.eventRefreshCount = 0;
        state.copyCount = 0;
        state.deleteCount = 0;
        state.restoreCount = 0;
        state.lastCopiedId = null;
        state.lastDeletedId = null;
        state.lastRestoredId = null;
        state.lastCopyOk = false;
        state.clickThreadId = null;
        state.clickThreadName = null;
        state.deleteThreadId = null;
        state.deleteThreadName = null;
        state.restoreThreadId = null;
        state.restoreThreadName = null;
        state.renderThreadId = null;
        state.renderThreadName = null;
        state.lastError = null;
    }

    ClipHub.List = {
        MODULE_NAME: "ch_09_list",
        MODULE_VERSION: 3,
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
            deleteViews = [];
            undoView = null;
            lastDeleted = null;
            visible = false;
            resetState();
            addedListener = function () {
                if (visible) {
                    try { refresh(true); } catch (error) { state.lastError = String(error); }
                }
            };
            mergedListener = addedListener;
            deletedListener = addedListener;
            restoredListener = addedListener;
            if (ClipHub.EventBus) {
                ClipHub.EventBus.on("clipboard_added", addedListener);
                ClipHub.EventBus.on("clipboard_merged", mergedListener);
                ClipHub.EventBus.on("clipboard_deleted", deletedListener);
                ClipHub.EventBus.on("clipboard_restored", restoredListener);
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
        performDeleteClick: function (index) {
            index = Math.floor(Number(index));
            return ClipHub.Window.runOnMain(function () {
                if (index < 0 || index >= deleteViews.length) { return false; }
                return deleteViews[index].performClick();
            }, 2500);
        },
        performUndoClick: function () {
            return ClipHub.Window.runOnMain(function () {
                return undoView !== null ? undoView.performClick() : false;
            }, 2500);
        },
        deleteItem: function (id) {
            var row = ClipHub.Repository.getItem(Number(id), false);
            return row === null || row === undefined ? false : deleteRow(row);
        },
        undoLastDelete: undoLastDelete,
        getState: getState,
        shutdown: function () {
            if (ClipHub.EventBus) {
                if (addedListener !== null) {
                    ClipHub.EventBus.off("clipboard_added", addedListener);
                }
                if (mergedListener !== null) {
                    ClipHub.EventBus.off("clipboard_merged", mergedListener);
                }
                if (deletedListener !== null) {
                    ClipHub.EventBus.off("clipboard_deleted", deletedListener);
                }
                if (restoredListener !== null) {
                    ClipHub.EventBus.off("clipboard_restored", restoredListener);
                }
            }
            addedListener = null;
            mergedListener = null;
            deletedListener = null;
            restoredListener = null;
            items = [];
            itemViews = [];
            deleteViews = [];
            undoView = null;
            lastDeleted = null;
            visible = false;
            ready = false;
            androidContext = null;
            return true;
        }
    };
}((function () { return this; }())));
