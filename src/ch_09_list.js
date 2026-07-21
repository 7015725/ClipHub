(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var Context = Packages.android.content.Context;
    var Build = Packages.android.os.Build;
    var View = Packages.android.view.View;
    var Gravity = Packages.android.view.Gravity;
    var WindowManager = Packages.android.view.WindowManager;
    var PixelFormat = Packages.android.graphics.PixelFormat;
    var Color = Packages.android.graphics.Color;
    var GradientDrawable = Packages.android.graphics.drawable.GradientDrawable;
    var LinearLayout = Packages.android.widget.LinearLayout;
    var FrameLayout = Packages.android.widget.FrameLayout;
    var ScrollView = Packages.android.widget.ScrollView;
    var TextView = Packages.android.widget.TextView;
    var TypedValue = Packages.android.util.TypedValue;
    var TextUtils = Packages.android.text.TextUtils;
    var DisplayMetrics = Packages.android.util.DisplayMetrics;
    var Thread = Packages.java.lang.Thread;
    var SimpleDateFormat = Packages.java.text.SimpleDateFormat;
    var Locale = Packages.java.util.Locale;
    var Date = Packages.java.util.Date;

    var LONG_TEXT_THRESHOLD = 180;
    var LONG_TEXT_LINE_THRESHOLD = 4;
    var androidContext = null;
    var density = 1;
    var ready = false;
    var visible = false;
    var limit = 20;
    var items = [];
    var itemViews = [];
    var deleteViews = [];
    var editViews = [];
    var pinViews = [];
    var tagViews = [];
    var detailViews = [];
    var undoView = null;
    var filterView = null;
    var addView = null;
    var lastDeleted = null;
    var eventBindings = [];
    var detailWindowManager = null;
    var detailRoot = null;
    var detailParams = null;
    var detailRow = null;
    var detailCopyView = null;
    var detailEditView = null;
    var detailCloseView = null;
    var state = {
        renderedCount: 0,
        emptyVisible: false,
        refreshCount: 0,
        eventRefreshCount: 0,
        copyCount: 0,
        deleteCount: 0,
        restoreCount: 0,
        pinToggleCount: 0,
        addOpenCount: 0,
        editOpenCount: 0,
        tagOpenCount: 0,
        filterOpenCount: 0,
        detailOpenCount: 0,
        detailCloseCount: 0,
        detailCopyCount: 0,
        detailEditCount: 0,
        longItemCount: 0,
        renderedTagLabelCount: 0,
        renderedSensitiveMaskCount: 0,
        lastCopiedId: null,
        lastDeletedId: null,
        lastRestoredId: null,
        lastPinnedId: null,
        lastPinnedValue: null,
        lastTagItemId: null,
        lastDetailItemId: null,
        lastCopyOk: false,
        clickThreadId: null,
        clickThreadName: null,
        deleteThreadId: null,
        deleteThreadName: null,
        restoreThreadId: null,
        restoreThreadName: null,
        pinThreadId: null,
        pinThreadName: null,
        addThreadId: null,
        addThreadName: null,
        editThreadId: null,
        editThreadName: null,
        tagThreadId: null,
        tagThreadName: null,
        filterThreadId: null,
        filterThreadName: null,
        detailActionThreadId: null,
        detailActionThreadName: null,
        detailAddThreadId: null,
        detailAddThreadName: null,
        detailRemoveThreadId: null,
        detailRemoveThreadName: null,
        renderThreadId: null,
        renderThreadName: null,
        lastDetailAction: null,
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
            dark ? "#24FFFFFF" : "#12000000", 13);
    }

    function actionBackground(dark, danger, selected) {
        if (selected) {
            return roundedBackground(
                dark ? "#FF364A61" : "#FFE4EEF9",
                dark ? "#667DB4E8" : "#55719BC6", 9);
        }
        return roundedBackground(
            danger ? (dark ? "#2EF87171" : "#18DC2626") :
                (dark ? "#22FFFFFF" : "#10000000"),
            danger ? (dark ? "#55F87171" : "#35DC2626") :
                (dark ? "#25FFFFFF" : "#16000000"), 9);
    }

    function makeAction(text, dark, danger, selected, compact) {
        var color = danger ? (dark ? "#FFFFA3A3" : "#FFB91C1C") :
            (selected ? (dark ? "#FFDCEEFF" : "#FF275A8A") :
                (dark ? "#FFE4E4E7" : "#FF3F3F46"));
        var view = makeText(text, compact ? 11 : 12, color, true);
        view.setGravity(Gravity.CENTER);
        view.setPadding(dp(compact ? 7 : 11), dp(6),
            dp(compact ? 7 : 11), dp(6));
        view.setBackground(actionBackground(dark, danger, selected));
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

    function tagText(tags) {
        var parts = [];
        var index;
        tags = tags || [];
        for (index = 0; index < tags.length && index < 4; index += 1) {
            parts.push("#" + String(tags[index].name));
        }
        if (tags.length > 4) { parts.push("+" + (tags.length - 4)); }
        return parts.join("  ");
    }

    function isLongText(row) {
        var content = String(row && row.content !== undefined ? row.content : "");
        var lines = content.split("\n").length;
        return content.length > LONG_TEXT_THRESHOLD ||
            lines >= LONG_TEXT_LINE_THRESHOLD;
    }

    function filterState() {
        try {
            if (ClipHub.Filter && typeof ClipHub.Filter.getState === "function") {
                return ClipHub.Filter.getState();
            }
        } catch (ignored) {}
        return {
            active: false,
            criteria: {
                keyword: "", sourcePackages: [], contentTypes: [], tagIds: [],
                pinnedOnly: false, sensitiveMode: "all"
            }
        };
    }

    function filterSummary() {
        var current = filterState();
        var criteria = current.criteria || {};
        var parts = [];
        if (String(criteria.keyword || "").length > 0) {
            parts.push("关键词：" + String(criteria.keyword));
        }
        if (criteria.sourcePackages && criteria.sourcePackages.length > 0) {
            parts.push("来源 " + criteria.sourcePackages.length);
        }
        if (criteria.contentTypes && criteria.contentTypes.length > 0) {
            parts.push("类型 " + criteria.contentTypes.length);
        }
        if (criteria.tagIds && criteria.tagIds.length > 0) {
            parts.push("标签 " + criteria.tagIds.length);
        }
        if (criteria.pinnedOnly === true) { parts.push("仅置顶"); }
        if (String(criteria.sensitiveMode || "all") === "only") {
            parts.push("仅敏感");
        }
        if (String(criteria.sensitiveMode || "all") === "exclude") {
            parts.push("隐藏敏感");
        }
        return parts.join("  ·  ");
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
                closeDetail("copy_close");
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

    function togglePinned(row) {
        var thread = Thread.currentThread();
        var id = Number(row.id);
        var next = Number(row.is_pinned || 0) === 1 ? 0 : 1;
        var changed;
        var delivered;
        try {
            changed = ClipHub.Repository.updateItem(id, { is_pinned: next });
            if (Number(changed) < 1) { return false; }
            state.pinToggleCount += 1;
            state.lastPinnedId = id;
            state.lastPinnedValue = next;
            state.pinThreadId = Number(thread.getId());
            state.pinThreadName = String(thread.getName());
            delivered = emit("clipboard_merged", {
                id: id,
                manual: true,
                mutation: "pin_changed",
                pinned: next === 1,
                threadId: state.pinThreadId,
                threadName: state.pinThreadName
            });
            if (delivered < 1 && visible) { refresh(false); }
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function openNewEditor() {
        var thread = Thread.currentThread();
        try {
            state.addOpenCount += 1;
            state.addThreadId = Number(thread.getId());
            state.addThreadName = String(thread.getName());
            ClipHub.Editor.openNew();
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function openEditEditor(row) {
        var thread = Thread.currentThread();
        try {
            state.editOpenCount += 1;
            state.editThreadId = Number(thread.getId());
            state.editThreadName = String(thread.getName());
            ClipHub.Editor.openItem(Number(row.id));
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function openTagEditor(row) {
        var thread = Thread.currentThread();
        try {
            if (!ClipHub.Editor || typeof ClipHub.Editor.openTags !== "function") {
                throw new Error("ClipHub tag editor is unavailable");
            }
            state.tagOpenCount += 1;
            state.lastTagItemId = Number(row.id);
            state.tagThreadId = Number(thread.getId());
            state.tagThreadName = String(thread.getName());
            ClipHub.Editor.openTags(Number(row.id));
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function openFilterPanel() {
        var thread = Thread.currentThread();
        try {
            state.filterOpenCount += 1;
            state.filterThreadId = Number(thread.getId());
            state.filterThreadName = String(thread.getName());
            ClipHub.Filter.showPanel({ requestKeyboard: true });
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function detailDimensions() {
        var metrics = new DisplayMetrics();
        var width;
        var height;
        try {
            detailWindowManager.getDefaultDisplay().getRealMetrics(metrics);
        } catch (ignored) {
            metrics = androidContext.getResources().getDisplayMetrics();
        }
        width = Math.min(dp(400), Math.max(dp(280),
            Number(metrics.widthPixels) - dp(24)));
        height = Math.min(dp(560), Math.max(dp(360),
            Number(metrics.heightPixels) - dp(96)));
        return { width: width, height: height };
    }

    function closeDetail(reason) {
        if (detailRoot === null) {
            detailRow = null;
            return { ok: true, attached: false, alreadyClosed: true,
                state: getDetailState() };
        }
        return ClipHub.Window.runOnMain(function () {
            var thread = Thread.currentThread();
            try {
                if (detailRoot !== null) {
                    try { detailWindowManager.removeViewImmediate(detailRoot); }
                    catch (error) {
                        if (detailRoot.isAttachedToWindow()) { throw error; }
                    }
                }
                state.detailCloseCount += 1;
                state.detailRemoveThreadId = Number(thread.getId());
                state.detailRemoveThreadName = String(thread.getName());
                state.lastDetailAction = String(reason || "close");
                return { ok: true, attached: false, alreadyClosed: false };
            } finally {
                detailRoot = null;
                detailParams = null;
                detailRow = null;
                detailCopyView = null;
                detailEditView = null;
                detailCloseView = null;
            }
        }, 3000);
    }

    function copyDetail() {
        var thread = Thread.currentThread();
        var result;
        if (detailRow === null) { return false; }
        try {
            result = ClipHub.Clipboard.writeText(String(detailRow.content), {
                label: "ClipHub 详情",
                sensitive: Number(detailRow.is_sensitive || 0) === 1
            });
            state.detailCopyCount += 1;
            state.detailActionThreadId = Number(thread.getId());
            state.detailActionThreadName = String(thread.getName());
            state.lastDetailAction = "copy";
            state.lastCopiedId = Number(detailRow.id);
            state.lastCopyOk = result && result.ok === true;
            return state.lastCopyOk;
        } catch (error) {
            state.lastError = String(error);
            state.lastCopyOk = false;
            return false;
        }
    }

    function editFromDetail() {
        var row = detailRow;
        var thread = Thread.currentThread();
        if (row === null) { return false; }
        try {
            state.detailEditCount += 1;
            state.detailActionThreadId = Number(thread.getId());
            state.detailActionThreadName = String(thread.getName());
            state.lastDetailAction = "edit";
            closeDetail("edit");
            ClipHub.Editor.openItem(Number(row.id));
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function buildDetailView(row) {
        var dark = isDarkMode();
        var primary = dark ? "#FFF4F4F5" : "#FF171717";
        var secondary = dark ? "#FFB4B4BC" : "#FF66666F";
        var root = new LinearLayout(androidContext);
        var titleRow = new LinearLayout(androidContext);
        var title = makeText("内容详情", 16, primary, true);
        var meta;
        var scroll = new ScrollView(androidContext);
        var body = makeText(String(row.content), 15, primary, false);
        var footer = new LinearLayout(androidContext);
        var params;
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(16), dp(14), dp(16), dp(14));
        root.setBackground(roundedBackground(
            dark ? "#FA181A1F" : "#FCFFFFFF",
            dark ? "#38FFFFFF" : "#1C000000", 17));
        if (Build.VERSION.SDK_INT >= 21) { root.setElevation(dp(18)); }
        titleRow.setOrientation(LinearLayout.HORIZONTAL);
        titleRow.setGravity(Gravity.CENTER_VERTICAL);
        titleRow.addView(title, new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        detailCloseView = makeAction("关闭", dark, false, false, false);
        detailCloseView.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { closeDetail("button"); }
        }));
        titleRow.addView(detailCloseView, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(8);
        root.addView(titleRow, params);
        meta = makeText((Number(row.is_sensitive || 0) === 1 ?
            "敏感内容  ·  " : "") + String(row.content).length + " 字符  ·  " +
            sourceText(row), 11, secondary, false);
        meta.setSingleLine(true);
        meta.setEllipsize(TextUtils.TruncateAt.END);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(10);
        root.addView(meta, params);
        body.setTextIsSelectable(true);
        body.setGravity(Gravity.TOP | Gravity.START);
        body.setLineSpacing(0, 1.18);
        body.setPadding(dp(12), dp(10), dp(12), dp(10));
        body.setBackground(roundedBackground(
            dark ? "#FF202328" : "#FFF7F7F8",
            dark ? "#35FFFFFF" : "#1D000000", 11));
        scroll.setFillViewport(true);
        scroll.addView(body, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT));
        root.addView(scroll, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));
        footer.setOrientation(LinearLayout.HORIZONTAL);
        footer.setGravity(Gravity.END | Gravity.CENTER_VERTICAL);
        footer.setPadding(0, dp(12), 0, 0);
        detailEditView = makeAction("编辑", dark, false, false, false);
        detailEditView.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { editFromDetail(); }
        }));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.rightMargin = dp(8);
        footer.addView(detailEditView, params);
        detailCopyView = makeAction("复制", dark, false, true, false);
        detailCopyView.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { copyDetail(); }
        }));
        footer.addView(detailCopyView, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        root.addView(footer, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        return root;
    }

    function openDetail(row) {
        if (!isLongText(row)) { return false; }
        if (detailRoot !== null) { closeDetail("replace"); }
        return ClipHub.Window.runOnMain(function () {
            var size = detailDimensions();
            var type = Build.VERSION.SDK_INT >= 26 ?
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY :
                WindowManager.LayoutParams.TYPE_SYSTEM_ALERT;
            var thread = Thread.currentThread();
            detailRow = row;
            detailRoot = buildDetailView(row);
            detailParams = new WindowManager.LayoutParams(
                size.width, size.height, type,
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL |
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
                    WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                PixelFormat.TRANSLUCENT);
            detailParams.gravity = Gravity.CENTER;
            try { detailParams.setTitle("ClipHub Content Detail"); }
            catch (ignoredTitle) {}
            detailWindowManager.addView(detailRoot, detailParams);
            state.detailOpenCount += 1;
            state.lastDetailItemId = Number(row.id);
            state.detailAddThreadId = Number(thread.getId());
            state.detailAddThreadName = String(thread.getName());
            state.lastDetailAction = "open";
            state.lastError = null;
            return true;
        }, 3000);
    }

    function getDetailState() {
        var attached = false;
        try { attached = detailRoot !== null && detailRoot.isAttachedToWindow(); }
        catch (ignored) {}
        return {
            attached: detailRoot !== null,
            attachedToWindow: attached,
            itemId: detailRow === null ? null : Number(detailRow.id),
            sensitive: detailRow !== null && Number(detailRow.is_sensitive || 0) === 1,
            contentLength: detailRow === null ? 0 : String(detailRow.content).length,
            textVisible: detailRoot !== null && detailRow !== null,
            textSelectable: detailRoot !== null,
            scrollable: detailRoot !== null,
            copyButtonPresent: detailCopyView !== null,
            editButtonPresent: detailEditView !== null,
            closeButtonPresent: detailCloseView !== null,
            windowType: detailParams === null ? null : Number(detailParams.type),
            openCount: Number(state.detailOpenCount),
            closeCount: Number(state.detailCloseCount),
            copyCount: Number(state.detailCopyCount),
            editCount: Number(state.detailEditCount),
            addThreadName: state.detailAddThreadName,
            removeThreadName: state.detailRemoveThreadName,
            actionThreadName: state.detailActionThreadName,
            lastAction: state.lastDetailAction
        };
    }

    function buildContent(rows) {
        var dark = isDarkMode();
        var primary = dark ? "#FFF4F4F5" : "#FF171717";
        var secondary = dark ? "#FFB4B4BC" : "#FF66666F";
        var tagColor = dark ? "#FF9FC6EA" : "#FF426B91";
        var outer = new LinearLayout(androidContext);
        var headerRow;
        var header;
        var summary;
        var active = filterState().active === true;
        var undoBar;
        var undoText;
        var scroll;
        var list;
        var index;
        var row;
        var card;
        var preview;
        var tagsLabel;
        var actionRow;
        var meta;
        var detailView;
        var tagView;
        var pinView;
        var editView;
        var deleteView;
        var params;
        var metaParams;
        var buttonParams;
        var thread = Thread.currentThread();
        var ids = [];
        var tagMap;
        var rowTags;
        state.renderedTagLabelCount = 0;
        state.renderedSensitiveMaskCount = 0;
        state.longItemCount = 0;
        for (index = 0; index < rows.length; index += 1) {
            ids.push(Number(rows[index].id));
        }
        tagMap = ClipHub.Repository.listItemTagMap(ids);
        outer.setOrientation(LinearLayout.VERTICAL);
        headerRow = new LinearLayout(androidContext);
        headerRow.setOrientation(LinearLayout.HORIZONTAL);
        headerRow.setGravity(Gravity.CENTER_VERTICAL);
        header = makeText(active ? "筛选结果  " + rows.length :
            (rows.length > 0 ? "最近记录  " + rows.length : "剪贴板历史"),
            13, secondary, false);
        headerRow.addView(header, new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        addView = makeAction("新增", dark, false, false, false);
        addView.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { openNewEditor(); }
        }));
        buttonParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        buttonParams.rightMargin = dp(6);
        headerRow.addView(addView, buttonParams);
        filterView = makeAction(active ? "筛选中" : "筛选",
            dark, false, active, false);
        filterView.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { openFilterPanel(); }
        }));
        headerRow.addView(filterView, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(8);
        outer.addView(headerRow, params);
        if (active) {
            summary = makeText(filterSummary(), 11, secondary, false);
            summary.setSingleLine(true);
            summary.setEllipsize(TextUtils.TruncateAt.END);
            summary.setPadding(dp(2), 0, dp(2), dp(8));
            outer.addView(summary, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));
        }
        undoView = null;
        if (lastDeleted !== null) {
            undoBar = new LinearLayout(androidContext);
            undoBar.setOrientation(LinearLayout.HORIZONTAL);
            undoBar.setGravity(Gravity.CENTER_VERTICAL);
            undoBar.setPadding(dp(10), dp(8), dp(8), dp(8));
            undoBar.setBackground(roundedBackground(
                dark ? "#FF20242A" : "#FFF7F7F8",
                dark ? "#24FFFFFF" : "#12000000", 11));
            undoText = makeText("已删除 1 条记录", 12, secondary, false);
            undoBar.addView(undoText, new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
            undoView = makeAction("撤销", dark, false, false, false);
            undoView.setOnClickListener(new JavaAdapter(View.OnClickListener, {
                onClick: function () { undoLastDelete(); }
            }));
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
        editViews = [];
        pinViews = [];
        tagViews = [];
        detailViews = [];
        if (rows.length === 0) {
            state.emptyVisible = true;
            preview = makeText(active ?
                "没有匹配的记录\n调整筛选条件后重试" :
                "暂无剪贴板记录\n复制文本或点击新增后会显示在这里",
                14, secondary, false);
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
                rowTags = tagMap[String(row.id)] || [];
                card = new LinearLayout(androidContext);
                card.setOrientation(LinearLayout.VERTICAL);
                card.setPadding(dp(12), dp(10), dp(10), dp(9));
                card.setBackground(cardBackground(dark));
                card.setClickable(true);
                card.setFocusable(true);
                preview = makeText(Number(row.is_sensitive || 0) === 1 ?
                    "敏感内容" : String(row.content), 14, primary, false);
                if (Number(row.is_sensitive || 0) === 1) {
                    state.renderedSensitiveMaskCount += 1;
                }
                preview.setMaxLines(3);
                preview.setEllipsize(TextUtils.TruncateAt.END);
                preview.setLineSpacing(0, 1.12);
                card.addView(preview, new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT));
                if (rowTags.length > 0) {
                    tagsLabel = makeText(tagText(rowTags), 11, tagColor, true);
                    tagsLabel.setSingleLine(true);
                    tagsLabel.setEllipsize(TextUtils.TruncateAt.END);
                    tagsLabel.setPadding(0, dp(6), 0, 0);
                    card.addView(tagsLabel, new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT));
                    state.renderedTagLabelCount += 1;
                }
                actionRow = new LinearLayout(androidContext);
                actionRow.setOrientation(LinearLayout.HORIZONTAL);
                actionRow.setGravity(Gravity.CENTER_VERTICAL);
                actionRow.setPadding(0, dp(7), 0, 0);
                meta = makeText(sourceText(row), 11, secondary, false);
                meta.setSingleLine(true);
                meta.setEllipsize(TextUtils.TruncateAt.END);
                metaParams = new LinearLayout.LayoutParams(
                    0, LinearLayout.LayoutParams.WRAP_CONTENT, 1);
                metaParams.rightMargin = dp(4);
                actionRow.addView(meta, metaParams);
                detailView = null;
                if (isLongText(row)) {
                    state.longItemCount += 1;
                    detailView = makeAction("详情", dark, false, false, true);
                    (function (targetRow, targetView) {
                        targetView.setOnClickListener(new JavaAdapter(
                            View.OnClickListener, {
                                onClick: function () { openDetail(targetRow); }
                            }));
                    }(row, detailView));
                    buttonParams = new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT);
                    buttonParams.rightMargin = dp(3);
                    actionRow.addView(detailView, buttonParams);
                }
                tagView = makeAction("标签", dark, false,
                    rowTags.length > 0, true);
                (function (targetRow, targetView) {
                    targetView.setOnClickListener(new JavaAdapter(
                        View.OnClickListener, {
                            onClick: function () { openTagEditor(targetRow); }
                        }));
                }(row, tagView));
                buttonParams = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT);
                buttonParams.rightMargin = dp(3);
                actionRow.addView(tagView, buttonParams);
                pinView = makeAction(Number(row.is_pinned || 0) === 1 ?
                    "取消置顶" : "置顶", dark, false,
                    Number(row.is_pinned || 0) === 1, true);
                (function (targetRow, targetView) {
                    targetView.setOnClickListener(new JavaAdapter(
                        View.OnClickListener, {
                            onClick: function () { togglePinned(targetRow); }
                        }));
                }(row, pinView));
                buttonParams = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT);
                buttonParams.rightMargin = dp(3);
                actionRow.addView(pinView, buttonParams);
                editView = makeAction("编辑", dark, false, false, true);
                (function (targetRow, targetView) {
                    targetView.setOnClickListener(new JavaAdapter(
                        View.OnClickListener, {
                            onClick: function () { openEditEditor(targetRow); }
                        }));
                }(row, editView));
                buttonParams = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT);
                buttonParams.rightMargin = dp(3);
                actionRow.addView(editView, buttonParams);
                deleteView = makeAction("删除", dark, true, false, true);
                (function (targetRow, targetView) {
                    targetView.setOnClickListener(new JavaAdapter(
                        View.OnClickListener, {
                            onClick: function () { deleteRow(targetRow); }
                        }));
                }(row, deleteView));
                actionRow.addView(deleteView, new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT));
                card.addView(actionRow, new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT));
                (function (targetRow, targetCard) {
                    targetCard.setOnClickListener(new JavaAdapter(
                        View.OnClickListener, {
                            onClick: function () { copyRow(targetRow); }
                        }));
                }(row, card));
                params = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT);
                params.bottomMargin = dp(8);
                list.addView(card, params);
                itemViews.push(card);
                detailViews.push(detailView);
                tagViews.push(tagView);
                pinViews.push(pinView);
                editViews.push(editView);
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

    function queryCurrentRows() {
        if (ClipHub.Filter && typeof ClipHub.Filter.isActive === "function" &&
                ClipHub.Filter.isActive() &&
                typeof ClipHub.Filter.query === "function") {
            return ClipHub.Filter.query({ limit: limit, offset: 0 });
        }
        return ClipHub.Repository.listItems({ limit: limit, offset: 0 });
    }

    function refresh(fromEvent) {
        if (!ready) { throw new Error("ClipHub list is not ready"); }
        items = queryCurrentRows();
        state.refreshCount += 1;
        if (fromEvent === true) { state.eventRefreshCount += 1; }
        if (visible && ClipHub.Window && ClipHub.Window.isAttached()) {
            renderRows(items);
        }
        return items.length;
    }

    function onRepositoryEvent() {
        if (!visible) { return; }
        try {
            if (ClipHub.Filter && typeof ClipHub.Filter.isActive === "function" &&
                    ClipHub.Filter.isActive()) { return; }
            refresh(true);
        } catch (error) { state.lastError = String(error); }
    }

    function bindEvent(name) {
        var listener = onRepositoryEvent;
        if (ClipHub.EventBus && typeof ClipHub.EventBus.on === "function") {
            ClipHub.EventBus.on(name, listener);
            eventBindings.push({ name: name, listener: listener });
        }
    }

    function unbindEvents() {
        var index;
        if (ClipHub.EventBus && typeof ClipHub.EventBus.off === "function") {
            for (index = 0; index < eventBindings.length; index += 1) {
                ClipHub.EventBus.off(eventBindings[index].name,
                    eventBindings[index].listener);
            }
        }
        eventBindings = [];
    }

    function show(options) {
        var openResult;
        options = options || {};
        limit = Math.max(1, Math.min(100,
            Math.floor(Number(options.limit || limit))));
        openResult = ClipHub.Window.open({
            widthDp: Number(options.widthDp || 340),
            heightDp: Number(options.heightDp || 420),
            statusText: "正在加载剪贴板历史"
        });
        visible = true;
        refresh(false);
        return { ok: true, visible: true, open: openResult, state: getState() };
    }

    function getState() {
        var ids = [];
        var index;
        var currentFilter = filterState();
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
            pinToggleCount: Number(state.pinToggleCount),
            addOpenCount: Number(state.addOpenCount),
            editOpenCount: Number(state.editOpenCount),
            tagOpenCount: Number(state.tagOpenCount),
            filterOpenCount: Number(state.filterOpenCount),
            detailOpenCount: Number(state.detailOpenCount),
            detailCloseCount: Number(state.detailCloseCount),
            detailCopyCount: Number(state.detailCopyCount),
            detailEditCount: Number(state.detailEditCount),
            longItemCount: Number(state.longItemCount),
            lastCopiedId: state.lastCopiedId,
            lastDeletedId: state.lastDeletedId,
            lastRestoredId: state.lastRestoredId,
            lastPinnedId: state.lastPinnedId,
            lastPinnedValue: state.lastPinnedValue,
            lastTagItemId: state.lastTagItemId,
            lastDetailItemId: state.lastDetailItemId,
            lastCopyOk: state.lastCopyOk,
            undoAvailable: lastDeleted !== null,
            addButtonPresent: addView !== null,
            filterButtonPresent: filterView !== null,
            editButtonCount: editViews.length,
            pinButtonCount: pinViews.length,
            tagButtonCount: tagViews.length,
            detailButtonCount: state.longItemCount,
            renderedTagLabelCount: Number(state.renderedTagLabelCount),
            renderedSensitiveMaskCount: Number(state.renderedSensitiveMaskCount),
            filterActive: currentFilter.active === true,
            filterSummary: filterSummary(),
            clickThreadName: state.clickThreadName,
            deleteThreadName: state.deleteThreadName,
            restoreThreadName: state.restoreThreadName,
            pinThreadName: state.pinThreadName,
            addThreadName: state.addThreadName,
            editThreadName: state.editThreadName,
            tagThreadName: state.tagThreadName,
            filterThreadName: state.filterThreadName,
            detailActionThreadName: state.detailActionThreadName,
            renderThreadName: state.renderThreadName,
            detail: getDetailState(),
            lastError: state.lastError,
            windowAttached: !!(ClipHub.Window && ClipHub.Window.isAttached())
        };
    }

    function resetState() {
        var key;
        for (key in state) {
            if (state.hasOwnProperty(key)) {
                if (/Count$/.test(key)) { state[key] = 0; }
                else if (/Ok$/.test(key) || key === "emptyVisible") { state[key] = false; }
                else { state[key] = null; }
            }
        }
        state.renderedCount = 0;
        state.emptyVisible = false;
        state.refreshCount = 0;
        state.eventRefreshCount = 0;
        state.copyCount = 0;
        state.deleteCount = 0;
        state.restoreCount = 0;
        state.pinToggleCount = 0;
        state.addOpenCount = 0;
        state.editOpenCount = 0;
        state.tagOpenCount = 0;
        state.filterOpenCount = 0;
        state.detailOpenCount = 0;
        state.detailCloseCount = 0;
        state.detailCopyCount = 0;
        state.detailEditCount = 0;
        state.longItemCount = 0;
        state.renderedTagLabelCount = 0;
        state.renderedSensitiveMaskCount = 0;
        state.lastCopyOk = false;
    }

    function performViewClick(collection, index) {
        index = Math.floor(Number(index));
        return ClipHub.Window.runOnMain(function () {
            if (index < 0 || index >= collection.length || collection[index] === null) {
                return false;
            }
            return collection[index].performClick();
        }, 2500);
    }

    ClipHub.List = {
        MODULE_NAME: "ch_09_list",
        MODULE_VERSION: 7,
        LONG_TEXT_THRESHOLD: LONG_TEXT_THRESHOLD,
        init: function (context) {
            androidContext = context && context.androidContext ?
                context.androidContext : global.context;
            if (androidContext === null || androidContext === undefined) {
                throw new Error("Android context unavailable for list");
            }
            androidContext = androidContext.getApplicationContext() || androidContext;
            detailWindowManager = androidContext.getSystemService(Context.WINDOW_SERVICE);
            if (detailWindowManager === null) {
                throw new Error("WindowManager unavailable for detail");
            }
            density = Number(androidContext.getResources()
                .getDisplayMetrics().density || 1);
            items = [];
            itemViews = [];
            deleteViews = [];
            editViews = [];
            pinViews = [];
            tagViews = [];
            detailViews = [];
            undoView = null;
            filterView = null;
            addView = null;
            lastDeleted = null;
            visible = false;
            eventBindings = [];
            detailRoot = null;
            detailParams = null;
            detailRow = null;
            resetState();
            bindEvent("clipboard_added");
            bindEvent("clipboard_merged");
            bindEvent("clipboard_deleted");
            bindEvent("clipboard_restored");
            bindEvent("tags_changed");
            ready = true;
            return true;
        },
        show: show,
        refresh: function () { return refresh(false); },
        hide: function (closeWindow) {
            visible = false;
            closeDetail("list_hide");
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
        performItemClick: function (index) { return performViewClick(itemViews, index); },
        performDeleteClick: function (index) { return performViewClick(deleteViews, index); },
        performEditClick: function (index) { return performViewClick(editViews, index); },
        performPinClick: function (index) { return performViewClick(pinViews, index); },
        performTagClick: function (index) { return performViewClick(tagViews, index); },
        performDetailClick: function (index) { return performViewClick(detailViews, index); },
        performDetailCopyClick: function () {
            return ClipHub.Window.runOnMain(function () {
                return detailCopyView !== null ? detailCopyView.performClick() : false;
            }, 2500);
        },
        performDetailEditClick: function () {
            return ClipHub.Window.runOnMain(function () {
                return detailEditView !== null ? detailEditView.performClick() : false;
            }, 2500);
        },
        performDetailCloseClick: function () {
            return ClipHub.Window.runOnMain(function () {
                return detailCloseView !== null ? detailCloseView.performClick() : false;
            }, 2500);
        },
        openDetail: function (id) {
            var row = ClipHub.Repository.getItem(Number(id), false);
            return row === null || row === undefined ? false : openDetail(row);
        },
        closeDetail: function () { return closeDetail("api"); },
        getDetailState: getDetailState,
        performUndoClick: function () {
            return ClipHub.Window.runOnMain(function () {
                return undoView !== null ? undoView.performClick() : false;
            }, 2500);
        },
        performFilterClick: function () {
            return ClipHub.Window.runOnMain(function () {
                return filterView !== null ? filterView.performClick() : false;
            }, 2500);
        },
        performAddClick: function () {
            return ClipHub.Window.runOnMain(function () {
                return addView !== null ? addView.performClick() : false;
            }, 2500);
        },
        deleteItem: function (id) {
            var row = ClipHub.Repository.getItem(Number(id), false);
            return row === null || row === undefined ? false : deleteRow(row);
        },
        undoLastDelete: undoLastDelete,
        togglePinned: function (id) {
            var row = ClipHub.Repository.getItem(Number(id), false);
            return row === null || row === undefined ? false : togglePinned(row);
        },
        getState: getState,
        shutdown: function () {
            try { closeDetail("shutdown"); } catch (ignoredDetail) {}
            unbindEvents();
            items = [];
            itemViews = [];
            deleteViews = [];
            editViews = [];
            pinViews = [];
            tagViews = [];
            detailViews = [];
            undoView = null;
            filterView = null;
            addView = null;
            lastDeleted = null;
            visible = false;
            ready = false;
            detailWindowManager = null;
            androidContext = null;
            return true;
        }
    };
}((function () { return this; }())));
