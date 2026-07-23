(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var Context = Packages.android.content.Context;
    var Build = Packages.android.os.Build;
    var View = Packages.android.view.View;
    var MotionEvent = Packages.android.view.MotionEvent;
    var ViewConfiguration = Packages.android.view.ViewConfiguration;
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
    var ImageView = Packages.android.widget.ImageView;
    var TypedValue = Packages.android.util.TypedValue;
    var TextUtils = Packages.android.text.TextUtils;
    var DisplayMetrics = Packages.android.util.DisplayMetrics;
    var Thread = Packages.java.lang.Thread;
    var JavaInteger = Packages.java.lang.Integer;
    var JavaArray = Packages.java.lang.reflect.Array;
    var SimpleDateFormat = Packages.java.text.SimpleDateFormat;
    var Locale = Packages.java.util.Locale;
    var Date = Packages.java.util.Date;

    var LONG_TEXT_THRESHOLD = 180;
    var LONG_TEXT_LINE_THRESHOLD = 4;
    var DETAIL_DIM_AMOUNT = 0.72;

    var androidContext = null;
    var density = 1;
    var touchSlop = 8;
    var ready = false;
    var visible = false;
    var limit = 20;
    var lastShowOptions = { widthDp: 390, heightDp: 720 };
    var items = [];
    var itemViews = [];
    var cardContainers = [];
    var deleteViews = [];
    var editViews = [];
    var pinViews = [];
    var tagViews = [];
    var detailViews = [];
    var reorderViews = [];
    var undoView = null;
    var filterView = null;
    var addView = null;
    var manageView = null;
    var searchView = null;
    var headerPinView = null;
    var headerSettingsView = null;
    var bottomPinView = null;
    var bottomEditView = null;
    var bottomAddView = null;
    var bottomDeleteView = null;
    var bottomTranslateView = null;
    var lastDeleted = null;
    var selectedItemId = null;
    var selectionMode = false;
    var eventBindings = [];
    var filterPanelSuspended = false;

    var detailWindowManager = null;
    var detailRoot = null;
    var detailWindowRoot = null;
    var detailManagedFrame = null;
    var detailParams = null;
    var detailRow = null;
    var detailCopyView = null;
    var detailEditView = null;
    var detailCloseView = null;
    var detailRestoreList = false;
    var detailWidthPx = 0;
    var detailHeightPx = 0;

    var reorderDrag = {
        active: false,
        sourceIndex: -1,
        targetIndex: -1,
        sourcePinned: false,
        startRawY: 0,
        moved: false,
        syntheticTargetIndex: null
    };

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
        filterPanelHideCount: 0,
        filterPanelRestoreCount: 0,
        filterPanelCancelCount: 0,
        detailOpenCount: 0,
        detailCloseCount: 0,
        detailCopyCount: 0,
        detailEditCount: 0,
        detailListHideCount: 0,
        detailListRestoreCount: 0,
        reorderCount: 0,
        reorderRejectCount: 0,
        reorderDragStartCount: 0,
        reorderDragMoveCount: 0,
        reorderDragCommitCount: 0,
        reorderSyntheticCount: 0,
        longItemCount: 0,
        renderedTagLabelCount: 0,
        renderedSensitiveMaskCount: 0,
        metaRowCount: 0,
        actionRowCount: 0,
        sourceIconCount: 0,
        actualSourceAppIconCount: 0,
        toolbarActionCount: 0,
        cardMoreButtonCount: 0,
        cardOpenDetailCount: 0,
        selectionMode: false,
        selectedItemId: null,
        selectedCount: 0,
        lastCopiedId: null,
        lastDeletedId: null,
        lastRestoredId: null,
        lastPinnedId: null,
        lastPinnedValue: null,
        lastTagItemId: null,
        lastDetailItemId: null,
        lastReorderItemId: null,
        lastReorderTargetId: null,
        lastReorderPinned: null,
        lastReorderPlaceAfter: null,
        lastReorderReason: null,
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
        reorderThreadId: null,
        reorderThreadName: null,
        renderThreadId: null,
        renderThreadName: null,
        lastDetailAction: null,
        lastFilterPanelAction: null,
        homeStyle: "reference_home_v2",
        lastError: null
    };

    function dp(value) {
        return Math.max(1, Math.floor(Number(value) * density + 0.5));
    }

    function colors() {
        if (ClipHub.Theme && typeof ClipHub.Theme.getPalette === "function") {
            return ClipHub.Theme.getPalette(androidContext);
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
        ClipHub.Theme.applyGradientColor(drawable, fill);
        drawable.setCornerRadius(dp(radiusDp));
        if (stroke !== null && stroke !== undefined) {
            ClipHub.Theme.applyGradientStroke(drawable, dp(1), stroke);
        }
        return drawable;
    }

    function circleBackground(fill, stroke) {
        var drawable = new GradientDrawable();
        drawable.setShape(GradientDrawable.OVAL);
        ClipHub.Theme.applyGradientColor(drawable, fill);
        if (stroke !== null && stroke !== undefined) {
            ClipHub.Theme.applyGradientStroke(drawable, dp(1), stroke);
        }
        return drawable;
    }

    function makeText(text, sizeSp, color, bold) {
        var view = new TextView(androidContext);
        view.setText(String(text));
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, Number(sizeSp));
        ClipHub.Theme.applyTextColor(view, color);
        view.setIncludeFontPadding(false);
        if (bold) {
            view.setTypeface(Packages.android.graphics.Typeface.DEFAULT,
                Packages.android.graphics.Typeface.BOLD);
        }
        return view;
    }

    function makeIcon(text, color, sizeSp, contentDescription) {
        var view = makeText(text, sizeSp, color, false);
        view.setGravity(Gravity.CENTER);
        view.setClickable(true);
        view.setFocusable(true);
        if (contentDescription) {
            view.setContentDescription(String(contentDescription));
        }
        return view;
    }

    function makePill(text, palette, selected) {
        var view = makeText(text, 9,
            selected ? palette.accentStrong : palette.textSecondary,
            selected);
        view.setGravity(Gravity.CENTER);
        view.setPadding(dp(7), dp(3), dp(7), dp(3));
        view.setBackground(roundedBackground(
            selected ? palette.accentSoft : palette.surfaceMuted,
            selected ? palette.accentBorder : palette.stroke, 8));
        return view;
    }

    function makeActionButton(icon, label, palette, enabled) {
        var root = new LinearLayout(androidContext);
        var iconView;
        var labelView;
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(dp(4), dp(3), dp(4), dp(3));
        root.setClickable(true);
        root.setFocusable(true);
        root.setAlpha(enabled ? 1 : 0.42);
        iconView = makeText(icon, 18, palette.icon, false);
        iconView.setGravity(Gravity.CENTER);
        root.addView(iconView, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(25)));
        labelView = makeText(label, 10, palette.textSecondary, false);
        labelView.setGravity(Gravity.CENTER);
        root.addView(labelView, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        return root;
    }

    function makeCenterAddAction(palette) {
        var root = new LinearLayout(androidContext);
        var circle = makeText("+", 24, palette.accentStrong, false);
        var label = makeText("新增", 10, palette.textSecondary, true);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setClickable(true);
        root.setFocusable(true);
        circle.setGravity(Gravity.CENTER);
        circle.setBackground(circleBackground(palette.accentSoft, null));
        root.addView(circle, new LinearLayout.LayoutParams(dp(38), dp(38)));
        label.setGravity(Gravity.CENTER);
        root.addView(label, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        return root;
    }

    function formatTime(value) {
        try {
            return String(new SimpleDateFormat("HH:mm", Locale.getDefault())
                .format(new Date(Number(value || 0))));
        } catch (ignored) {
            return "";
        }
    }

    function sourceText(row) {
        return String(row.source_label || row.source_package || "未知来源");
    }

    function isLongText(row) {
        var content = String(row && row.content !== undefined ?
            row.content : "");
        return content.length > LONG_TEXT_THRESHOLD ||
            content.split("\n").length >= LONG_TEXT_LINE_THRESHOLD;
    }

    function typeInfo(row, palette) {
        var content = String(row && row.content !== undefined ?
            row.content : "");
        var declared = String(row && row.content_type ?
            row.content_type : "text");
        if (/https?:\/\//i.test(content) || declared === "url") {
            return { key: "url", label: "网址", icon: "G",
                color: palette.blue, soft: palette.blueSoft };
        }
        if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(content.replace(/^\s+|\s+$/g, "")) ||
                declared === "email") {
            return { key: "email", label: "邮箱", icon: "@",
                color: palette.orange, soft: palette.orangeSoft };
        }
        if (/(?:\+?\d[\d\s-]{5,}\d)/.test(content) ||
                declared === "phone") {
            return { key: "phone", label: "电话号码",
                icon: "☎︎",
                color: palette.green, soft: palette.greenSoft };
        }
        if (/[{};]/.test(content) &&
                (content.indexOf("function") >= 0 ||
                content.indexOf("var ") >= 0 ||
                content.indexOf("return ") >= 0 ||
                content.indexOf("=" + ">") >= 0 ||
                content.indexOf("const ") >= 0 ||
                content.indexOf("let ") >= 0)) {
            return { key: "code", label: "代码", icon: "</>",
                color: palette.cyan, soft: palette.cyanSoft };
        }
        return { key: "text", label: "文本", icon: "T",
            color: palette.accent, soft: palette.accentSoft };
    }

    function filterState() {
        try {
            if (ClipHub.Filter &&
                    typeof ClipHub.Filter.getState === "function") {
                return ClipHub.Filter.getState();
            }
        } catch (ignored) {}
        return { active: false, criteria: { keyword: "",
            sourcePackages: [], contentTypes: [], tagIds: [],
            pinnedOnly: false, sensitiveMode: "all" } };
    }

    function filterSummary() {
        var current = filterState();
        var criteria = current.criteria || {};
        var parts = [];
        if (String(criteria.keyword || "").length > 0) {
            parts.push("关键词：" + String(criteria.keyword));
        }
        if (criteria.sourcePackages &&
                criteria.sourcePackages.length > 0) {
            parts.push("来源 " + criteria.sourcePackages.length);
        }
        if (criteria.contentTypes &&
                criteria.contentTypes.length > 0) {
            parts.push("类型 " + criteria.contentTypes.length);
        }
        if (criteria.tagIds && criteria.tagIds.length > 0) {
            parts.push("标签 " + criteria.tagIds.length);
        }
        if (criteria.pinnedOnly === true) {
            parts.push("仅置顶");
        }
        if (String(criteria.sensitiveMode || "all") === "only") {
            parts.push("仅敏感");
        }
        if (String(criteria.sensitiveMode || "all") === "exclude") {
            parts.push("隐藏敏感");
        }
        return parts.join("  ·  ");
    }

    function reorderEnabled() {
        return ready && visible && filterState().active !== true &&
            items.length > 1;
    }

    function emit(name, payload) {
        try {
            if (ClipHub.EventBus &&
                    typeof ClipHub.EventBus.emit === "function") {
                return ClipHub.EventBus.emit(String(name), payload || {});
            }
        } catch (ignored) {}
        return 0;
    }

    function selectedRow() {
        var index;
        if (selectedItemId === null) {
            return null;
        }
        for (index = 0; index < items.length; index += 1) {
            if (Number(items[index].id) === Number(selectedItemId)) {
                return items[index];
            }
        }
        selectedItemId = null;
        return null;
    }

    function selectRow(row) {
        selectedItemId = row === null ? null : Number(row.id);
        state.selectedItemId = selectedItemId;
        state.selectedCount = selectedItemId === null ? 0 : 1;
        return selectedItemId;
    }

    function enterSelection(row) {
        selectionMode = true;
        state.selectionMode = true;
        selectRow(row);
        if (visible && ClipHub.Window && ClipHub.Window.isAttached()) {
            renderRows(items);
        }
        return true;
    }

    function leaveSelection() {
        selectionMode = false;
        state.selectionMode = false;
        selectRow(null);
        if (visible && ClipHub.Window && ClipHub.Window.isAttached()) {
            renderRows(items);
        }
        return true;
    }

    function toggleSelection(row) {
        if (!selectionMode) {
            return enterSelection(row);
        }
        if (selectedItemId !== null &&
                Number(selectedItemId) === Number(row.id)) {
            selectRow(null);
        } else {
            selectRow(row);
        }
        if (visible && ClipHub.Window && ClipHub.Window.isAttached()) {
            renderRows(items);
        }
        return true;
    }

    function copyRow(row, selectAfter) {
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
            if (selectAfter === true) {
                selectionMode = true;
                state.selectionMode = true;
                selectRow(row);
            }
            try {
                closeAfter = ClipHub.Settings &&
                    ClipHub.Settings.get("closeAfterCopy", false) === true;
            } catch (ignoredSetting) {}
            if (closeAfter) {
                visible = false;
                closeDetail("copy_close");
                ClipHub.Window.close();
            } else if (selectAfter === true && visible &&
                    ClipHub.Window && ClipHub.Window.isAttached()) {
                renderRows(items);
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
        var id;
        var deletedAt;
        var changed;
        var delivered;
        if (row === null) {
            return false;
        }
        id = Number(row.id);
        deletedAt = ClipHub.Base.now();
        try {
            changed = ClipHub.Repository.softDeleteItem(id, deletedAt);
            if (Number(changed) < 1) {
                return false;
            }
            lastDeleted = { id: id, deletedAt: deletedAt };
            if (Number(selectedItemId) === id) {
                selectRow(null);
            }
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
            if (delivered < 1 && visible) {
                refresh(false);
            }
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
        if (target === null) {
            return false;
        }
        try {
            row = ClipHub.Repository.getItem(Number(target.id), true);
            if (row === null || row === undefined ||
                    row.deleted_at === null ||
                    row.deleted_at === undefined) {
                lastDeleted = null;
                if (visible) {
                    refresh(false);
                }
                return false;
            }
            changed = ClipHub.Repository.restoreItem(Number(target.id));
            if (Number(changed) < 1) {
                return false;
            }
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
            if (delivered < 1 && visible) {
                refresh(false);
            }
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function togglePinned(row) {
        var thread = Thread.currentThread();
        var id;
        var next;
        var changed;
        var delivered;
        if (row === null) {
            return false;
        }
        id = Number(row.id);
        next = Number(row.is_pinned || 0) === 1 ? 0 : 1;
        try {
            changed = ClipHub.Repository.updateItem(id, {
                is_pinned: next,
                manual_order: 0
            });
            if (Number(changed) < 1) {
                return false;
            }
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
            if (delivered < 1 && visible) {
                refresh(false);
            }
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
        if (row === null) {
            return false;
        }
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
        if (row === null) {
            return false;
        }
        try {
            if (!ClipHub.Editor ||
                    typeof ClipHub.Editor.openTags !== "function") {
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

    function suspendForFilterPanel() {
        filterPanelSuspended = false;
        state.lastFilterPanelAction = "legacy_home_removed";
        return false;
    }

    function finishFilterPanel(options) {
        filterPanelSuspended = false;
        state.lastFilterPanelAction = "legacy_home_removed";
        return false;
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
        if (ClipHub.Window &&
                typeof ClipHub.Window.computeGeometry === "function") {
            return ClipHub.Window.computeGeometry("detail", {
                useSaved: true
            });
        }
        return { x: 0, y: 0, width: dp(390), height: dp(650),
            widthDp: 390, heightDp: 650 };
    }

    function shouldRestoreList(reason) {
        return false;
    }

    function restoreListAfterDetail(reason) {
        detailRestoreList = false;
        return false;
    }

    function closeDetail(reason) {
        var restore;
        if (detailRoot === null) {
            detailRow = null;
            detailRestoreList = false;
            return {
                ok: true,
                attached: false,
                alreadyClosed: true,
                state: getDetailState()
            };
        }
        restore = shouldRestoreList(reason);
        return ClipHub.Window.runOnMain(function () {
            var thread = Thread.currentThread();
            try {
                try {
                    if (ClipHub.Window && detailWindowRoot !== null &&
                            typeof ClipHub.Window.detachWindow === "function") {
                        ClipHub.Window.detachWindow(detailWindowRoot);
                    }
                } catch (ignoredDetach) {}
                try {
                    detailWindowManager.removeViewImmediate(
                        detailWindowRoot !== null ? detailWindowRoot : detailRoot);
                } catch (error) {
                    if (detailWindowRoot !== null ?
                            detailWindowRoot.isAttachedToWindow() :
                            detailRoot.isAttachedToWindow()) {
                        throw error;
                    }
                }
                state.detailCloseCount += 1;
                state.detailRemoveThreadId = Number(thread.getId());
                state.detailRemoveThreadName = String(thread.getName());
                state.lastDetailAction = String(reason || "close");
            } finally {
                detailRoot = null;
                detailWindowRoot = null;
                detailManagedFrame = null;
                detailParams = null;
                detailRow = null;
                detailCopyView = null;
                detailEditView = null;
                detailCloseView = null;
                detailWidthPx = 0;
                detailHeightPx = 0;
            }
            if (restore) {
                restoreListAfterDetail(reason);
            }
            detailRestoreList = false;
            return { ok: true, attached: false, alreadyClosed: false };
        }, 3000);
    }

    function copyDetail() {
        var thread = Thread.currentThread();
        var result;
        if (detailRow === null) {
            return false;
        }
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
        if (row === null) {
            return false;
        }
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
        var palette = colors();
        var root = new LinearLayout(androidContext);
        var handle = new View(androidContext);
        var header = new LinearLayout(androidContext);
        var title = makeText("内容详情", 17,
            palette.textPrimary, true);
        var meta = makeText(sourceText(row) + "  ·  " +
            formatTime(row.last_copied_at), 10,
            palette.textSecondary, false);
        var scroll = new ScrollView(androidContext);
        var body = makeText(String(row.content), 13,
            palette.textPrimary, false);
        var footer = new LinearLayout(androidContext);
        var params;

        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(14), dp(8), dp(14), dp(12));
        root.setBackground(roundedBackground(palette.surface,
            palette.stroke, 24));
        if (Build.VERSION.SDK_INT >= 21) {
            root.setElevation(dp(18));
        }

        handle.setBackground(roundedBackground(
            palette.strokeStrong, null, 3));
        params = new LinearLayout.LayoutParams(dp(42), dp(4));
        params.gravity = Gravity.CENTER_HORIZONTAL;
        params.bottomMargin = dp(8);
        root.addView(handle, params);

        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        header.addView(title, new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        detailCloseView = makeIcon("×", palette.icon, 23,
            "关闭内容详情");
        detailCloseView.setBackground(circleBackground(
            palette.surfaceMuted, null));
        detailCloseView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () {
                    closeDetail("button");
                }
            }));
        header.addView(detailCloseView,
            new LinearLayout.LayoutParams(dp(38), dp(38)));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(4);
        root.addView(header, params);

        meta.setSingleLine(true);
        meta.setEllipsize(TextUtils.TruncateAt.END);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(9);
        root.addView(meta, params);

        body.setTextIsSelectable(true);
        body.setGravity(Gravity.TOP | Gravity.START);
        body.setLineSpacing(0, 1.13);
        body.setPadding(dp(12), dp(11), dp(12), dp(11));
        body.setBackground(roundedBackground(palette.surfaceMuted,
            palette.stroke, 14));
        scroll.setFillViewport(true);
        scroll.setVerticalScrollBarEnabled(false);
        scroll.addView(body, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT));
        root.addView(scroll, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));

        footer.setOrientation(LinearLayout.HORIZONTAL);
        footer.setGravity(Gravity.END | Gravity.CENTER_VERTICAL);
        footer.setPadding(0, dp(10), 0, 0);

        detailEditView = makePill("✎  编辑", palette, false);
        detailEditView.setClickable(true);
        detailEditView.setFocusable(true);
        detailEditView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () {
                    editFromDetail();
                }
            }));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.rightMargin = dp(7);
        footer.addView(detailEditView, params);

        detailCopyView = makePill("复制", palette, true);
        detailCopyView.setClickable(true);
        detailCopyView.setFocusable(true);
        detailCopyView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () {
                    copyDetail();
                }
            }));
        footer.addView(detailCopyView,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));

        root.addView(footer, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        return root;
    }

    function openDetail(row, force) {
        var restoreFromPrevious = detailRestoreList;
        if (!force && !isLongText(row)) {
            return false;
        }
        if (detailRoot !== null) {
            closeDetail("replace");
        }
        detailRestoreList = false;
        return ClipHub.Window.runOnMain(function () {
            var size = detailDimensions();
            var type = Build.VERSION.SDK_INT >= 26 ?
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY :
                WindowManager.LayoutParams.TYPE_SYSTEM_ALERT;
            var flags =
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED |
                WindowManager.LayoutParams.FLAG_DIM_BEHIND;
            var thread = Thread.currentThread();

            detailRow = row;
            detailRoot = buildDetailView(row);
            detailManagedFrame = ClipHub.Window.createManagedFrame(detailRoot, {
                accentColor: colors().accentStrong
            });
            detailWindowRoot = detailManagedFrame.rootView;
            detailWidthPx = Number(size.width);
            detailHeightPx = Number(size.height);
            detailParams = new WindowManager.LayoutParams(
                size.width, size.height, type, flags,
                PixelFormat.TRANSLUCENT);
            detailParams.gravity = Gravity.TOP | Gravity.START;
            detailParams.x = Number(size.x || 0);
            detailParams.y = Number(size.y || 0);
            detailParams.dimAmount = DETAIL_DIM_AMOUNT;
            try {
                detailParams.setTitle("ClipHub Content Detail");
            } catch (ignoredTitle) {}
            detailWindowManager.addView(detailWindowRoot, detailParams);
            ClipHub.Window.attachWindow({
                role: "detail",
                rootView: detailWindowRoot,
                contentView: detailRoot,
                layoutParams: detailParams,
                windowManager: detailWindowManager,
                dragView: detailManagedFrame.dragView,
                resizeView: detailManagedFrame.resizeView,
                resizeVisual: detailManagedFrame.resizeVisual,
                geometry: size,
                onGeometryChanged: function (geometry) {
                    detailWidthPx = Number(geometry.width || 0);
                    detailHeightPx = Number(geometry.height || 0);
                },
                onRequestClose: function () {
                    return closeDetail("managed_close").ok === true;
                }
            });
            state.detailOpenCount += 1;
            state.cardOpenDetailCount += 1;
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
        var flags = detailParams === null ? 0 :
            Number(detailParams.flags);
        try {
            attached = detailRoot !== null &&
                detailRoot.isAttachedToWindow();
        } catch (ignored) {}
        return {
            attached: detailRoot !== null,
            attachedToWindow: attached,
            itemId: detailRow === null ? null :
                Number(detailRow.id),
            sensitive: detailRow !== null &&
                Number(detailRow.is_sensitive || 0) === 1,
            contentLength: detailRow === null ? 0 :
                String(detailRow.content).length,
            textVisible: detailRoot !== null && detailRow !== null,
            textSelectable: detailRoot !== null,
            scrollable: detailRoot !== null,
            copyButtonPresent: detailCopyView !== null,
            editButtonPresent: detailEditView !== null,
            closeButtonPresent: detailCloseView !== null,
            modal: detailParams !== null &&
                (flags & Number(
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL)) === 0,
            opaque: detailRoot !== null,
            dimFlagPresent: detailParams !== null &&
                (flags & Number(
                    WindowManager.LayoutParams.FLAG_DIM_BEHIND)) !== 0,
            dimAmount: detailParams === null ? 0 :
                Number(detailParams.dimAmount || 0),
            notTouchModalAbsent: detailParams !== null &&
                (flags & Number(
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL)) === 0,
            mainWindowHidden: detailRoot !== null &&
                detailRestoreList &&
                !(ClipHub.Window && ClipHub.Window.isAttached()),
            windowType: detailParams === null ? null :
                Number(detailParams.type),
            windowFlags: flags,
            windowWidthDp: detailWidthPx > 0 ?
                Math.round(detailWidthPx / density) : 0,
            windowHeightDp: detailHeightPx > 0 ?
                Math.round(detailHeightPx / density) : 0,
            openCount: Number(state.detailOpenCount),
            closeCount: Number(state.detailCloseCount),
            copyCount: Number(state.detailCopyCount),
            editCount: Number(state.detailEditCount),
            listHideCount: Number(state.detailListHideCount),
            listRestoreCount: Number(state.detailListRestoreCount),
            addThreadName: state.detailAddThreadName,
            removeThreadName: state.detailRemoveThreadName,
            actionThreadName: state.detailActionThreadName,
            lastAction: state.lastDetailAction
        };
    }

    function requestNoIntercept(view, disallow) {
        var parent = view === null ? null : view.getParent();
        while (parent !== null) {
            try {
                parent.requestDisallowInterceptTouchEvent(
                    disallow === true);
            } catch (ignored) {}
            try {
                parent = parent.getParent();
            } catch (ignoredParent) {
                parent = null;
            }
        }
    }

    function setReorderTargetVisual(targetIndex) {
        var index;
        for (index = 0; index < cardContainers.length; index += 1) {
            try {
                cardContainers[index].setAlpha(
                    index === targetIndex ? 0.70 : 1);
            } catch (ignored) {}
        }
    }

    function resetReorderVisuals() {
        var index;
        for (index = 0; index < cardContainers.length; index += 1) {
            try {
                cardContainers[index].setAlpha(1);
            } catch (ignored) {}
        }
        for (index = 0; index < reorderViews.length; index += 1) {
            if (reorderViews[index] !== null) {
                try {
                    reorderViews[index].setPressed(false);
                } catch (ignoredPressed) {}
            }
        }
    }

    function nearestReorderIndex(rawY, pinned) {
        var best = -1;
        var bestDistance = JavaInteger.MAX_VALUE;
        var location = JavaArray.newInstance(
            JavaInteger.TYPE, 2);
        var index;
        var center;
        var distance;
        for (index = 0; index < cardContainers.length; index += 1) {
            if (Number(items[index].is_pinned || 0) !==
                    (pinned ? 1 : 0)) {
                continue;
            }
            try {
                cardContainers[index].getLocationOnScreen(location);
                center = Number(location[1]) +
                    Number(cardContainers[index].getHeight()) / 2;
                distance = Math.abs(Number(rawY) - center);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    best = index;
                }
            } catch (ignored) {}
        }
        return best;
    }

    function commitReorder(fromIndex, toIndex, origin) {
        var source;
        var target;
        var placeAfter;
        var thread = Thread.currentThread();
        var result;
        var delivered;
        if (!reorderEnabled()) {
            state.reorderRejectCount += 1;
            state.lastReorderReason = "filter_active_or_hidden";
            return false;
        }
        fromIndex = Math.floor(Number(fromIndex));
        toIndex = Math.floor(Number(toIndex));
        if (fromIndex < 0 || toIndex < 0 ||
                fromIndex >= items.length ||
                toIndex >= items.length ||
                fromIndex === toIndex) {
            state.reorderRejectCount += 1;
            state.lastReorderReason = "invalid_or_same_index";
            return false;
        }
        source = items[fromIndex];
        target = items[toIndex];
        if (Number(source.is_pinned || 0) !==
                Number(target.is_pinned || 0)) {
            state.reorderRejectCount += 1;
            state.lastReorderReason = "cross_pinned_group";
            return false;
        }
        placeAfter = fromIndex < toIndex;
        try {
            result = ClipHub.Repository.reorderItem(
                Number(source.id), Number(target.id), placeAfter);
            if (!result || result.ok !== true ||
                    result.changed !== true) {
                state.reorderRejectCount += 1;
                state.lastReorderReason =
                    result && result.reason ?
                    String(result.reason) :
                    "repository_rejected";
                return false;
            }
            state.reorderCount += 1;
            state.reorderDragCommitCount +=
                origin === "drag" ? 1 : 0;
            state.lastReorderItemId = Number(source.id);
            state.lastReorderTargetId = Number(target.id);
            state.lastReorderPinned =
                Number(source.is_pinned || 0) === 1;
            state.lastReorderPlaceAfter = placeAfter;
            state.lastReorderReason = String(origin || "api");
            state.reorderThreadId = Number(thread.getId());
            state.reorderThreadName = String(thread.getName());
            delivered = emit("clipboard_merged", {
                id: Number(source.id),
                targetId: Number(target.id),
                manual: true,
                mutation: "manual_order_changed",
                pinned: state.lastReorderPinned,
                placeAfter: placeAfter,
                threadId: state.reorderThreadId,
                threadName: state.reorderThreadName
            });
            if (delivered < 1 && visible) {
                refresh(false);
            }
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function handleReorderTouch(index, view, event) {
        var action = Number(event.getActionMasked());
        var rawY;
        var targetIndex;
        var commitFrom;
        var commitTo;
        var moved;

        if (action === Number(MotionEvent.ACTION_DOWN)) {
            if (!reorderEnabled()) {
                state.reorderRejectCount += 1;
                state.lastReorderReason =
                    "filter_active_or_hidden";
                return false;
            }
            reorderDrag.active = true;
            reorderDrag.sourceIndex = index;
            reorderDrag.targetIndex = index;
            reorderDrag.sourcePinned =
                Number(items[index].is_pinned || 0) === 1;
            reorderDrag.startRawY = Number(event.getRawY());
            reorderDrag.moved = false;
            state.reorderDragStartCount += 1;
            view.setPressed(true);
            requestNoIntercept(view, true);
            setReorderTargetVisual(index);
            return true;
        }

        if (!reorderDrag.active ||
                index !== reorderDrag.sourceIndex) {
            return false;
        }

        if (action === Number(MotionEvent.ACTION_MOVE)) {
            rawY = Number(event.getRawY());
            if (Math.abs(rawY - reorderDrag.startRawY) >=
                    touchSlop ||
                    reorderDrag.syntheticTargetIndex !== null) {
                reorderDrag.moved = true;
            }
            if (reorderDrag.moved) {
                targetIndex =
                    reorderDrag.syntheticTargetIndex !== null ?
                    Number(reorderDrag.syntheticTargetIndex) :
                    nearestReorderIndex(rawY,
                        reorderDrag.sourcePinned);
                if (targetIndex >= 0 &&
                        targetIndex < items.length &&
                        Number(items[targetIndex].is_pinned || 0) ===
                        (reorderDrag.sourcePinned ? 1 : 0)) {
                    reorderDrag.targetIndex = targetIndex;
                    state.reorderDragMoveCount += 1;
                    setReorderTargetVisual(targetIndex);
                }
            }
            return true;
        }

        if (action === Number(MotionEvent.ACTION_UP) ||
                action === Number(MotionEvent.ACTION_CANCEL)) {
            commitFrom = reorderDrag.sourceIndex;
            commitTo = reorderDrag.targetIndex;
            moved = reorderDrag.moved;
            requestNoIntercept(view, false);
            resetReorderVisuals();
            reorderDrag.active = false;
            reorderDrag.sourceIndex = -1;
            reorderDrag.targetIndex = -1;
            reorderDrag.syntheticTargetIndex = null;
            reorderDrag.moved = false;

            if (action === Number(MotionEvent.ACTION_UP) &&
                    moved && commitFrom !== commitTo) {
                return commitReorder(
                    commitFrom, commitTo, "drag");
            }
            if (action === Number(MotionEvent.ACTION_UP) &&
                    !moved && index >= 0 &&
                    index < items.length) {
                return openTagEditor(items[index]);
            }
            return true;
        }
        return true;
    }

    function buildContent(rows) {
        state.renderedCount = rows ? rows.length : 0;
        state.emptyVisible = !rows || rows.length === 0;
        return null;
    }

    function copyRows(rows) {
        var output = [];
        var index;
        rows = rows || [];
        for (index = 0; index < rows.length; index += 1) {
            output.push(rows[index]);
        }
        return output;
    }

    function renderRows(rows) {
        state.renderedCount = rows ? rows.length : 0;
        state.emptyVisible = !rows || rows.length === 0;
        return true;
    }

    function queryCurrentRows() {
        if (ClipHub.Filter &&
                typeof ClipHub.Filter.isActive === "function" &&
                ClipHub.Filter.isActive() &&
                typeof ClipHub.Filter.query === "function") {
            return ClipHub.Filter.query({
                limit: limit, offset: 0
            });
        }
        return ClipHub.Repository.listItems({
            limit: limit, offset: 0
        });
    }

    function refresh(fromEvent) {
        if (!ready) {
            throw new Error("ClipHub list is not ready");
        }
        items = queryCurrentRows();
        selectedRow();
        state.refreshCount += 1;
        if (fromEvent === true) {
            state.eventRefreshCount += 1;
        }
        if (visible && ClipHub.Window &&
                ClipHub.Window.isAttached()) {
            renderRows(items);
        }
        return items.length;
    }

    function onRepositoryEvent() {
        if (!visible) {
            return;
        }
        try {
            if (ClipHub.Filter &&
                    typeof ClipHub.Filter.isActive === "function" &&
                    ClipHub.Filter.isActive()) {
                return;
            }
            refresh(true);
        } catch (error) {
            state.lastError = String(error);
        }
    }

    function bindEvent(name) {
        var listener = onRepositoryEvent;
        if (ClipHub.EventBus &&
                typeof ClipHub.EventBus.on === "function") {
            ClipHub.EventBus.on(name, listener);
            eventBindings.push({
                name: name,
                listener: listener
            });
        }
    }

    function unbindEvents() {
        var index;
        if (ClipHub.EventBus &&
                typeof ClipHub.EventBus.off === "function") {
            for (index = 0;
                    index < eventBindings.length;
                    index += 1) {
                ClipHub.EventBus.off(
                    eventBindings[index].name,
                    eventBindings[index].listener);
            }
        }
        eventBindings = [];
    }

    function preferredHomeDimensions(options) {
        var geometry;
        options = options || {};
        if (ClipHub.Window &&
                typeof ClipHub.Window.computeGeometry === "function") {
            geometry = ClipHub.Window.computeGeometry("primary", {
                useSaved: true
            });
            return {
                widthDp: Number(geometry.widthDp),
                heightDp: Number(geometry.heightDp)
            };
        }
        return { widthDp: 390, heightDp: 720 };
    }

    function show(options) {
        options = options || {};
        visible = false;
        if (!ClipHub.Filter ||
                typeof ClipHub.Filter.showRoot !== "function") {
            throw new Error("ClipHub primary home is unavailable");
        }
        return ClipHub.Filter.showRoot({
            requestKeyboard: options.requestKeyboard === true,
            showAdvanced: options.showAdvanced === true
        });
    }

    function currentManualOrders() {
        var output = [];
        var index;
        for (index = 0; index < items.length;
                index += 1) {
            output.push({
                id: Number(items[index].id),
                pinned:
                    Number(items[index].is_pinned || 0) === 1,
                manualOrder:
                    Number(items[index].manual_order || 0)
            });
        }
        return output;
    }

    function countPresent(values) {
        var count = 0;
        var index;
        for (index = 0; index < values.length;
                index += 1) {
            if (values[index] !== null &&
                    values[index] !== undefined) {
                count += 1;
            }
        }
        return count;
    }

    function getState() {
        var ids = [];
        var index;
        var currentFilter = filterState();
        for (index = 0; index < items.length;
                index += 1) {
            ids.push(Number(items[index].id));
        }
        return {
            ready: ready,
            visible: visible,
            itemCount: items.length,
            itemIds: ids,
            manualOrders: currentManualOrders(),
            renderedCount: Number(state.renderedCount),
            emptyVisible: state.emptyVisible,
            refreshCount: Number(state.refreshCount),
            eventRefreshCount:
                Number(state.eventRefreshCount),
            copyCount: Number(state.copyCount),
            deleteCount: Number(state.deleteCount),
            restoreCount: Number(state.restoreCount),
            pinToggleCount: Number(state.pinToggleCount),
            addOpenCount: Number(state.addOpenCount),
            editOpenCount: Number(state.editOpenCount),
            tagOpenCount: Number(state.tagOpenCount),
            filterOpenCount: Number(state.filterOpenCount),
            filterPanelSuspended: filterPanelSuspended === true,
            filterPanelHideCount:
                Number(state.filterPanelHideCount),
            filterPanelRestoreCount:
                Number(state.filterPanelRestoreCount),
            filterPanelCancelCount:
                Number(state.filterPanelCancelCount),
            lastFilterPanelAction: state.lastFilterPanelAction,
            detailOpenCount: Number(state.detailOpenCount),
            detailCloseCount: Number(state.detailCloseCount),
            detailCopyCount: Number(state.detailCopyCount),
            detailEditCount: Number(state.detailEditCount),
            detailListHideCount:
                Number(state.detailListHideCount),
            detailListRestoreCount:
                Number(state.detailListRestoreCount),
            reorderCount: Number(state.reorderCount),
            reorderRejectCount:
                Number(state.reorderRejectCount),
            reorderDragStartCount:
                Number(state.reorderDragStartCount),
            reorderDragMoveCount:
                Number(state.reorderDragMoveCount),
            reorderDragCommitCount:
                Number(state.reorderDragCommitCount),
            reorderSyntheticCount:
                Number(state.reorderSyntheticCount),
            reorderEnabled: reorderEnabled(),
            reorderHandleCount:
                countPresent(reorderViews),
            reorderDragActive: reorderDrag.active,
            longItemCount: Number(state.longItemCount),
            metaRowCount: Number(state.metaRowCount),
            actionRowCount: Number(state.actionRowCount),
            sourceIconCount:
                Number(state.sourceIconCount),
            actualSourceAppIconCount:
                Number(state.actualSourceAppIconCount),
            toolbarActionCount:
                Number(state.toolbarActionCount),
            cardMoreButtonCount:
                Number(state.cardMoreButtonCount),
            cardOpenDetailCount:
                Number(state.cardOpenDetailCount),
            selectionMode: selectionMode,
            selectedItemId: selectedItemId,
            selectedCount:
                selectedItemId === null ? 0 : 1,
            lastCopiedId: state.lastCopiedId,
            lastDeletedId: state.lastDeletedId,
            lastRestoredId: state.lastRestoredId,
            lastPinnedId: state.lastPinnedId,
            lastPinnedValue: state.lastPinnedValue,
            lastTagItemId: state.lastTagItemId,
            lastDetailItemId: state.lastDetailItemId,
            lastReorderItemId: state.lastReorderItemId,
            lastReorderTargetId:
                state.lastReorderTargetId,
            lastReorderPinned:
                state.lastReorderPinned,
            lastReorderPlaceAfter:
                state.lastReorderPlaceAfter,
            lastReorderReason:
                state.lastReorderReason,
            lastCopyOk: state.lastCopyOk,
            undoAvailable: lastDeleted !== null,
            addButtonPresent: addView !== null,
            filterButtonPresent: filterView !== null,
            searchButtonPresent: searchView !== null,
            manageButtonPresent: manageView !== null,
            headerPinButtonPresent:
                headerPinView !== null,
            headerSettingsButtonPresent:
                headerSettingsView !== null,
            editButtonCount: editViews.length,
            pinButtonCount: pinViews.length,
            tagButtonCount: tagViews.length,
            detailButtonCount:
                Number(state.longItemCount),
            renderedTagLabelCount:
                Number(state.renderedTagLabelCount),
            renderedSensitiveMaskCount:
                Number(state.renderedSensitiveMaskCount),
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
            detailActionThreadName:
                state.detailActionThreadName,
            reorderThreadName: state.reorderThreadName,
            renderThreadName: state.renderThreadName,
            homeStyle: state.homeStyle,
            preferredWidthDp:
                Number(lastShowOptions.widthDp),
            preferredHeightDp:
                Number(lastShowOptions.heightDp),
            detail: getDetailState(),
            lastError: state.lastError,
            windowAttached: false,
            legacyHomeRemoved: true
        };
    }

    function resetState() {
        var key;
        for (key in state) {
            if (state.hasOwnProperty(key)) {
                if (/Count$/.test(key)) {
                    state[key] = 0;
                } else if (/Ok$/.test(key) ||
                        key === "emptyVisible" ||
                        key === "selectionMode") {
                    state[key] = false;
                } else if (key !== "homeStyle") {
                    state[key] = null;
                }
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
        state.filterPanelHideCount = 0;
        state.filterPanelRestoreCount = 0;
        state.filterPanelCancelCount = 0;
        state.lastFilterPanelAction = null;
        state.detailOpenCount = 0;
        state.detailCloseCount = 0;
        state.detailCopyCount = 0;
        state.detailEditCount = 0;
        state.detailListHideCount = 0;
        state.detailListRestoreCount = 0;
        state.reorderCount = 0;
        state.reorderRejectCount = 0;
        state.reorderDragStartCount = 0;
        state.reorderDragMoveCount = 0;
        state.reorderDragCommitCount = 0;
        state.reorderSyntheticCount = 0;
        state.longItemCount = 0;
        state.renderedTagLabelCount = 0;
        state.renderedSensitiveMaskCount = 0;
        state.metaRowCount = 0;
        state.actionRowCount = 0;
        state.sourceIconCount = 0;
        state.actualSourceAppIconCount = 0;
        state.toolbarActionCount = 0;
        state.cardMoreButtonCount = 0;
        state.cardOpenDetailCount = 0;
        state.selectionMode = false;
        state.selectedItemId = null;
        state.selectedCount = 0;
        state.lastCopyOk = false;
        state.homeStyle = "reference_home_v2";
    }

    function performViewClick(collection, index) {
        index = Math.floor(Number(index));
        return ClipHub.Window.runOnMain(function () {
            if (index < 0 ||
                    index >= collection.length ||
                    collection[index] === null) {
                return false;
            }
            return collection[index].performClick();
        }, 2500);
    }

    function performHandleDrag(fromIndex, toIndex) {
        return ClipHub.Window.runOnMain(function () {
            var view;
            var downTime;
            var event;
            var x;
            var y;
            var okDown;
            var okMove;
            var okUp;

            fromIndex = Math.floor(Number(fromIndex));
            toIndex = Math.floor(Number(toIndex));
            if (fromIndex < 0 ||
                    fromIndex >= reorderViews.length ||
                    reorderViews[fromIndex] === null ||
                    toIndex < 0 ||
                    toIndex >= items.length) {
                return false;
            }

            view = reorderViews[fromIndex];
            reorderDrag.syntheticTargetIndex = toIndex;
            state.reorderSyntheticCount += 1;
            downTime = ClipHub.Base.now();
            x = Math.max(1,
                Number(view.getWidth()) / 2);
            y = Math.max(1,
                Number(view.getHeight()) / 2);

            event = MotionEvent.obtain(
                downTime, downTime,
                MotionEvent.ACTION_DOWN, x, y, 0);
            okDown = view.dispatchTouchEvent(event);
            event.recycle();

            event = MotionEvent.obtain(
                downTime, downTime + 20,
                MotionEvent.ACTION_MOVE,
                x, y + touchSlop + dp(8), 0);
            okMove = view.dispatchTouchEvent(event);
            event.recycle();

            event = MotionEvent.obtain(
                downTime, downTime + 40,
                MotionEvent.ACTION_UP,
                x, y + touchSlop + dp(8), 0);
            okUp = view.dispatchTouchEvent(event);
            event.recycle();

            reorderDrag.syntheticTargetIndex = null;
            return okDown && okMove && okUp;
        }, 3500);
    }

    ClipHub.List = {
        MODULE_NAME: "ch_09_list",
        MODULE_VERSION: 16,
        LONG_TEXT_THRESHOLD: LONG_TEXT_THRESHOLD,

        init: function (context) {
            androidContext =
                context && context.androidContext ?
                context.androidContext : global.context;
            if (androidContext === null ||
                    androidContext === undefined) {
                throw new Error(
                    "Android context unavailable for list");
            }
            androidContext =
                androidContext.getApplicationContext() ||
                androidContext;
            detailWindowManager =
                androidContext.getSystemService(
                    Context.WINDOW_SERVICE);
            if (detailWindowManager === null) {
                throw new Error(
                    "WindowManager unavailable for detail");
            }
            density = Number(androidContext.getResources()
                .getDisplayMetrics().density || 1);
            try {
                touchSlop = Number(
                    ViewConfiguration.get(androidContext)
                    .getScaledTouchSlop());
            } catch (ignoredSlop) {
                touchSlop = dp(8);
            }

            items = [];
            itemViews = [];
            cardContainers = [];
            deleteViews = [];
            editViews = [];
            pinViews = [];
            tagViews = [];
            detailViews = [];
            reorderViews = [];
            undoView = null;
            filterView = null;
            addView = null;
            manageView = null;
            searchView = null;
            headerPinView = null;
            headerSettingsView = null;
            bottomPinView = null;
            bottomEditView = null;
            bottomAddView = null;
            bottomDeleteView = null;
            bottomTranslateView = null;
            lastDeleted = null;
            selectedItemId = null;
            selectionMode = false;
            visible = false;
            filterPanelSuspended = false;
            eventBindings = [];
            detailRoot = null;
            detailWindowRoot = null;
            detailManagedFrame = null;
            detailParams = null;
            detailRow = null;
            detailRestoreList = false;
            detailWidthPx = 0;
            detailHeightPx = 0;
            reorderDrag.active = false;
            reorderDrag.sourceIndex = -1;
            reorderDrag.targetIndex = -1;
            reorderDrag.syntheticTargetIndex = null;
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

        refresh: function () {
            return refresh(false);
        },

        hide: function (closeWindow) {
            try {
                if (ClipHub.Translation && ClipHub.Translation.isAttached &&
                        ClipHub.Translation.isAttached()) {
                    ClipHub.Translation.close("list_hide");
                }
            } catch (ignoredTranslation) {}
            try {
                if (ClipHub.Settings && ClipHub.Settings.isAttached &&
                        ClipHub.Settings.isAttached()) {
                    ClipHub.Settings.close("list_hide");
                }
            } catch (ignoredSettings) {}
            visible = false;
            filterPanelSuspended = false;
            selectionMode = false;
            selectRow(null);
            closeDetail("list_hide");
            filterPanelSuspended = false;
            return true;
        },

        suspendForFilterPanel: suspendForFilterPanel,

        finishFilterPanel: finishFilterPanel,

        setItems: function (value) {
            items = copyRows(value || []);
            selectedRow();
            if (visible && ClipHub.Window &&
                    ClipHub.Window.isAttached()) {
                renderRows(items);
            }
            return items.length;
        },

        clear: function () {
            items = [];
            selectionMode = false;
            selectRow(null);
            if (visible && ClipHub.Window &&
                    ClipHub.Window.isAttached()) {
                renderRows(items);
            }
            return true;
        },

        performItemClick: function (index) {
            index = Math.floor(Number(index));
            if (index < 0 || index >= items.length) {
                return false;
            }
            return ClipHub.Window.runOnMain(function () {
                return copyRow(items[index], false);
            }, 2500);
        },

        performSelectClick: function (index) {
            index = Math.floor(Number(index));
            if (index < 0 || index >= items.length) {
                return false;
            }
            return ClipHub.Window.runOnMain(function () {
                selectionMode = true;
                state.selectionMode = true;
                selectRow(items[index]);
                renderRows(items);
                return true;
            }, 3000);
        },

        performCardOpenClick: function (index) {
            index = Math.floor(Number(index));
            if (index < 0 || index >= items.length) {
                return false;
            }
            return openDetail(items[index], true);
        },

        performDeleteClick: function (index) {
            return performViewClick(deleteViews, index);
        },

        performEditClick: function (index) {
            return performViewClick(editViews, index);
        },

        performPinClick: function (index) {
            return performViewClick(pinViews, index);
        },

        performTagClick: function (index) {
            return performViewClick(tagViews, index);
        },

        performDetailClick: function (index) {
            return performViewClick(detailViews, index);
        },

        performReorder: function (fromIndex, toIndex) {
            return ClipHub.Window.runOnMain(function () {
                return commitReorder(
                    fromIndex, toIndex, "api");
            }, 3000);
        },

        performReorderHandleDrag: performHandleDrag,

        performDetailCopyClick: function () {
            return ClipHub.Window.runOnMain(function () {
                return detailCopyView !== null ?
                    detailCopyView.performClick() : false;
            }, 2500);
        },

        performDetailEditClick: function () {
            return ClipHub.Window.runOnMain(function () {
                return detailEditView !== null ?
                    detailEditView.performClick() : false;
            }, 2500);
        },

        performDetailCloseClick: function () {
            return ClipHub.Window.runOnMain(function () {
                return detailCloseView !== null ?
                    detailCloseView.performClick() : false;
            }, 2500);
        },

        openDetail: function (id) {
            var row = ClipHub.Repository.getItem(
                Number(id), false);
            return row === null || row === undefined ?
                false : openDetail(row, true);
        },

        closeDetail: function () {
            try {
                if (ClipHub.Translation && ClipHub.Translation.isAttached &&
                        ClipHub.Translation.isAttached()) {
                    return ClipHub.Translation.close("navigation");
                }
            } catch (ignoredTranslation) {}
            try {
                if (ClipHub.Settings && ClipHub.Settings.isAttached &&
                        ClipHub.Settings.isAttached()) {
                    return ClipHub.Settings.close("navigation");
                }
            } catch (ignoredSettings) {}
            return closeDetail("api");
        },

        getDetailState: function () {
            var external;
            try {
                external = ClipHub.Translation && ClipHub.Translation.getState ?
                    ClipHub.Translation.getState() : null;
                if (external && (external.attached === true ||
                        external.open === true)) { return external; }
            } catch (ignoredTranslation) {}
            try {
                external = ClipHub.Settings && ClipHub.Settings.getState ?
                    ClipHub.Settings.getState() : null;
                if (external && (external.attached === true ||
                        external.open === true)) { return external; }
            } catch (ignoredSettings) {}
            return getDetailState();
        },

        performUndoClick: function () {
            return ClipHub.Window.runOnMain(function () {
                return undoView !== null ?
                    undoView.performClick() : false;
            }, 2500);
        },

        performFilterClick: function () {
            return ClipHub.Window.runOnMain(function () {
                return filterView !== null ?
                    filterView.performClick() : false;
            }, 2500);
        },

        performAddClick: function () {
            return ClipHub.Window.runOnMain(function () {
                return addView !== null ?
                    addView.performClick() : false;
            }, 2500);
        },

        deleteItem: function (id) {
            var row = ClipHub.Repository.getItem(
                Number(id), false);
            return row === null || row === undefined ?
                false : deleteRow(row);
        },

        undoLastDelete: undoLastDelete,

        togglePinned: function (id) {
            var row = ClipHub.Repository.getItem(
                Number(id), false);
            return row === null || row === undefined ?
                false : togglePinned(row);
        },

        enterSelection: function (id) {
            var row = ClipHub.Repository.getItem(
                Number(id), false);
            return row === null || row === undefined ?
                false : enterSelection(row);
        },

        leaveSelection: leaveSelection,

        getState: getState,

        shutdown: function () {
            try {
                closeDetail("shutdown");
            } catch (ignoredDetail) {}
            resetReorderVisuals();
            unbindEvents();
            items = [];
            itemViews = [];
            cardContainers = [];
            deleteViews = [];
            editViews = [];
            pinViews = [];
            tagViews = [];
            detailViews = [];
            reorderViews = [];
            undoView = null;
            filterView = null;
            addView = null;
            manageView = null;
            searchView = null;
            headerPinView = null;
            headerSettingsView = null;
            bottomPinView = null;
            bottomEditView = null;
            bottomAddView = null;
            bottomDeleteView = null;
            bottomTranslateView = null;
            lastDeleted = null;
            selectedItemId = null;
            selectionMode = false;
            visible = false;
            filterPanelSuspended = false;
            ready = false;
            detailWindowManager = null;
            androidContext = null;
            return true;
        }
    };
}((function () { return this; }())));
