(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var Context = Packages.android.content.Context;
    var Build = Packages.android.os.Build;
    var Looper = Packages.android.os.Looper;
    var Handler = Packages.android.os.Handler;
    var CountDownLatch = Packages.java.util.concurrent.CountDownLatch;
    var TimeUnit = Packages.java.util.concurrent.TimeUnit;
    var Thread = Packages.java.lang.Thread;
    var System = Packages.java.lang.System;
    var View = Packages.android.view.View;
    var MotionEvent = Packages.android.view.MotionEvent;
    var ViewConfiguration = Packages.android.view.ViewConfiguration;
    var Gravity = Packages.android.view.Gravity;
    var WindowManager = Packages.android.view.WindowManager;
    var PixelFormat = Packages.android.graphics.PixelFormat;
    var Color = Packages.android.graphics.Color;
    var GradientDrawable = Packages.android.graphics.drawable.GradientDrawable;
    var Drawable = Packages.android.graphics.drawable.Drawable;
    var Paint = Packages.android.graphics.Paint;
    var Path = Packages.android.graphics.Path;
    var RectF = Packages.android.graphics.RectF;
    var Rect = Packages.android.graphics.Rect;
    var WindowInsets = Packages.android.view.WindowInsets;
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
    var RESULT_PAGE_SIZE = 20;
    var SELECTION_ENABLED = false;
    var DELETE_UNDO_TIMEOUT_MS = 5000;
    var COPY_FEEDBACK_TIMEOUT_MS = 1600;
    var INPUT_FOCUS_DELAY_MS = 160;
    var INPUT_RETRY_DELAY_MS = 180;
    var INPUT_MAX_ATTEMPTS = 2;
    var FIRST_RENDER_COUNT = 6;
    var RENDER_BATCH_COUNT = 4;
    var REFRESH_COALESCE_MS = 80;
    var MUTATION_RELOAD_PAGE_LIMIT = 20;

    var androidContext = null;
    var appContext = null;
    var windowManager = null;
    var inputMethodManager = null;
    var mainHandler = null;
    var density = 1;
    var touchSlop = 8;
    var value = null;
    var ready = false;
    var eventListeners = [];

    var panelRoot = null;
    var panelWindowRoot = null;
    var panelManagedFrame = null;
    var panelParams = null;
    var primaryDragView = null;
    var primaryResizeView = null;
    var keywordInput = null;
    var searchView = null;
    var resetView = null;
    var closeView = null;
    var settingsButton = null;
    var advancedView = null;
    var applyView = null;
    var clearHistoryView = null;
    var resultContainer = null;
    var resultCountView = null;
    var drawerContainer = null;
    var drawerScrollView = null;
    var drawerContentView = null;
    var drawerFooterView = null;
    var sourceViews = {};
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
    var restoreListOnClose = false;
    var rootMode = false;
    var selectedItemId = null;
    var resultCardViews = [];
    var toolbarActionViews = {};
    var resultTagMap = {};
    var resultPageLimit = RESULT_PAGE_SIZE;
    var resultHasMore = false;
    var resultScrollView = null;
    var loadMoreView = null;
    var PAGINATION_STAGE = 9;
    var paginationState = {
        ready: false,
        mode: "ajax",
        repositoryMode: "append",
        pageSize: 100,
        prefetchEnabled: true,
        pageNumber: 1,
        loadedCount: 0,
        totalCount: 0,
        totalPages: 0,
        hasMore: false,
        endCursor: null,
        queryGeneration: 0,
        resetCount: 0,
        loadCount: 0,
        settingsSyncCount: 0,
        settingsEventCount: 0,
        criteriaChangeCount: 0,
        lastResetReason: "",
        lastLoadMode: "",
        lastCriteriaSignature: "",
        newContentPending: false,
        quickResetAvailable: false,
        lastError: null
    };
    var ajaxFooterState = {
        present: false,
        visible: false,
        action: "none",
        text: "",
        clickable: false,
        loading: false,
        clickCount: 0,
        blockedClickCount: 0,
        successCount: 0,
        endCount: 0,
        appendedRowCount: 0,
        duplicateBlockedCount: 0,
        renderBatchCount: 0,
        lastScrollYBeforeAppend: 0,
        lastScrollYAfterAppend: 0,
        positionPreserved: true,
        lastError: null
    };
    var numberPagerView = null;
    var numberPageViews = {};
    var numberActionViews = {};
    var numberPagerState = {
        present: false,
        visible: false,
        loading: false,
        currentPage: 1,
        totalPages: 0,
        totalCount: 0,
        tokens: [],
        selectedPage: 1,
        nearbyPageLimit: 5,
        jumpInputPresent: false,
        layoutStyle:
            "first_previous_nearby_next_last",
        firstEnabled: false,
        previousEnabled: false,
        nextEnabled: false,
        lastEnabled: false,
        clickCount: 0,
        pageClickCount: 0,
        actionClickCount: 0,
        blockedClickCount: 0,
        samePageBlockedCount: 0,
        successCount: 0,
        failureCount: 0,
        pageReplaceCount: 0,
        scrollResetCount: 0,
        nonZeroScrollResetCount: 0,
        maximumScrollYBeforeChange: 0,
        lastScrollYBeforeChange: 0,
        lastScrollYAfterChange: 0,
        lastTargetPage: 1,
        lastAction: "",
        lastOrigin: "",
        lastError: null
    };
    var ajaxAppendGeneration = 0;
    var LAZY_TRIGGER_MIN_DP = 120;
    var LAZY_TRIGGER_VIEWPORT_RATIO = 0.38;
    var LAZY_TRIGGER_COOLDOWN_MS = 260;
    var PREFETCH_DELAY_MS = 160;
    var lazyScrollListener = null;
    var lazyGeneration = 0;
    var lazyLoadState = {
        listenerBound: false,
        enabled: false,
        pending: false,
        thresholdPx: 0,
        remainingPx: 0,
        lastScrollY: 0,
        lastOldScrollY: 0,
        scrollEventCount: 0,
        downwardScrollCount: 0,
        nearBottomCount: 0,
        triggerCount: 0,
        successCount: 0,
        failureCount: 0,
        blockedCount: 0,
        lastTriggeredLoadedCount: -1,
        lastTriggerAt: 0,
        lastOrigin: "",
        lastError: null
    };
    var prefetchGeneration = 0;
    var prefetchedPage = null;
    var prefetchState = {
        enabled: true,
        scheduled: false,
        inFlight: false,
        ready: false,
        mode: "",
        targetPage: 0,
        rowCount: 0,
        scheduleCount: 0,
        requestCount: 0,
        successCount: 0,
        hitCount: 0,
        missCount: 0,
        invalidationCount: 0,
        staleDiscardCount: 0,
        lastOrigin: "",
        lastInvalidationReason: "",
        lastError: null
    };
    var VIRTUAL_BEFORE_SCREENS = 3;
    var VIRTUAL_AFTER_SCREENS = 5;
    var VIRTUAL_UPDATE_DELAY_MS = 24;
    var virtualTopSpacer = null;
    var virtualCardHost = null;
    var virtualBottomSpacer = null;
    var paginationFooterHost = null;
    var quickResetView = null;
    var virtualRenderedItemIds = [];
    var virtualRenderedSignatures = [];
    var virtualGeneration = 0;
    var virtualPendingOrigin = "";
    var virtualPendingForce = false;
    var virtualState = {
        firstRenderedIndex: 0,
        lastRenderedIndex: -1,
        firstVisibleIndex: 0,
        lastVisibleIndex: -1,
        visibleCount: 1,
        averageHeightPx: 0,
        defaultHeightPx: 0,
        heightById: {},
        topSpacerPx: 0,
        bottomSpacerPx: 0,
        anchorItemId: null,
        anchorIndex: -1,
        anchorOffsetPx: 0,
        anchorRestoreErrorPx: 0,
        updateScheduled: false,
        updateDeferred: false,
        scrollListenerBound: false,
        scrollToTopPending: false,
        updateCount: 0,
        recycleCount: 0,
        rebuildCount: 0,
        staleUpdateCount: 0,
        lastOrigin: "",
        lastError: null
    };
    var DATA_BLOCK_MIN_ROWS = 24;
    var DATA_BLOCK_MAX_ROWS = 100;
    var DATA_BLOCK_VISIBLE_MULTIPLIER = 2;
    var DATA_BLOCK_KEEP_BEFORE = 1;
    var DATA_BLOCK_KEEP_AFTER = 1;
    var dataTagLoadedById = {};
    var dataWindowState = {
        blockSize: DATA_BLOCK_MIN_ROWS,
        blockCount: 0,
        hydratedBlockCount: 0,
        hydratedRowCount: 0,
        dehydratedRowCount: 0,
        hydrationPassCount: 0,
        dehydrationPassCount: 0,
        hydrateQueryCount: 0,
        tagQueryCount: 0,
        hydratedRowTotal: 0,
        dehydratedRowTotal: 0,
        missingIdCount: 0,
        resetCount: 0,
        keepStartIndex: 0,
        keepEndIndex: -1,
        lastHydrateStartIndex: 0,
        lastHydrateEndIndex: -1,
        lastOrigin: "",
        lastError: null
    };
    var pendingNewItemId = null;
    var mutationRefreshPlan = null;
    var mutationAnchorLocked = false;
    var mutationState = {
        eventCount: 0,
        refreshRequestCount: 0,
        refreshCount: 0,
        coalescedCount: 0,
        addedPendingCount: 0,
        relatedEventSuppressedCount: 0,
        settingsChangeCount: 0,
        anchorRestoreCount: 0,
        anchorFallbackCount: 0,
        lastEventName: "",
        lastAction: "",
        lastOrigin: "",
        lastModeBefore: "",
        lastModeAfter: "",
        lastPageNumberBefore: 1,
        lastPageNumberAfter: 1,
        lastLoadedCountBefore: 0,
        lastLoadedCountAfter: 0,
        lastReloadPageCount: 0,
        lastAnchorItemIdBefore: null,
        lastAnchorItemIdAfter: null,
        lastAnchorIndexBefore: -1,
        lastAnchorIndexAfter: -1,
        lastAnchorOffsetPxBefore: 0,
        lastAnchorOffsetPxAfter: 0,
        lastAnchorRestoreErrorPx: 0,
        lastPositionPreserved: true,
        lastError: null
    };
    var activeSwipeCard = null;
    var resultBodyFrame = null;
    var resultActionViews = [];
    var sourceIconConstantStateCache = {};
    var deleteUndoView = null;
    var pendingDeleteUndo = null;
    var deleteUndoGeneration = 0;
    var copyFeedbackView = null;
    var copyFeedbackGeneration = 0;
    var adaptiveRenderGeneration = 0;
    var searchExpanded = false;
    var searchStatusRow = null;
    var searchInputRow = null;
    var searchToggleView = null;
    var searchClearView = null;
    var historyContainerView = null;
    var inputDispatchGeneration = 0;
    var inputDispatchPending = false;
    var panelBuilt = false;
    var panelBuiltRootMode = null;
    var panelStructureDirty = true;
    var panelDataDirty = true;
    var panelDataVersion = 1;
    var renderedDataVersion = 0;
    var renderGeneration = 0;
    var renderCursor = 0;
    var renderBatchCount = 0;
    var optionCountsCache = null;
    var optionCountsDirty = true;
    var refreshGeneration = 0;
    var refreshScheduled = false;
    var refreshReason = "";
    var lastShowReused = false;
    var timeFormatter = null;
    var performance = {
        showGeneration: 0,
        showStartedAtNs: 0,
        windowAttachedAtNs: 0,
        firstDrawAtNs: 0,
        firstBatchReadyAtNs: 0,
        fullRenderReadyAtNs: 0,
        showToAttachMs: null,
        showToFirstDrawMs: null,
        showToFirstBatchMs: null,
        showToFullRenderMs: null,
        renderBatchCount: 0,
        lastRefreshOrigin: "",
        lastError: null
    };

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
        searchExpanded: false,
        searchExpandCount: 0,
        searchCollapseCount: 0,
        headerHeightDp: 0,
        headerControlHeightDp: 0,
        headerActionSizeDp: 0,
        headerGapDp: 0,
        headerFilterActiveCount: 0,
        sourceToggleCount: 0,
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
        panelX: 0,
        panelY: 0,
        primaryGeometryManaged: false,
        primaryDragViewPresent: false,
        primaryResizeViewPresent: false,
        resizeCorner: "bottom_right",
        dimAmount: 0,
        modalWindow: false,
        opaqueBackground: false,
        horizontalFadeEnabled: false,
        chipSingleLineEnforced: true,
        chipEllipsizeEndEnforced: true,
        drawerContentBottomPaddingDp: 0,
        drawerFooterTopGapDp: 0,
        drawerFooterHeightDp: 0,
        advancedChipVerticalPaddingDp: 0,
        drawerMeasured: false,
        drawerContentHeightDp: 0,
        drawerViewportHeightDp: 0,
        drawerScrollYDp: 0,
        drawerCanScrollDownAtTop: false,
        drawerContentFitsViewport: false,
        advancedKeywordInputPresent: false,
        sortOptionCount: 0,
        sourceWrapRowCount: 0,
        tagWrapRowCount: 0,
        drawerWidthDp: 0,
        drawerHeightDp: 0,
        backLayerCloseCount: 0,
        lastBackLayer: "",
        homeWindowSuspended: false,
        homeSuspendCount: 0,
        homeRestoreCount: 0,
        homeRestoreCancelCount: 0,
        exclusiveHomeFilter: true,
        rootMode: false,
        primarySurface: "filter_overlay",
        selectedItemId: null,
        selectionMode: false,
        resultCardClickCount: 0,
        resultCardLongPressCount: 0,
        inputActionCount: 0,
        inputSuccessCount: 0,
        inputFailureCount: 0,
        inputRetryCount: 0,
        inputDuplicateBlockedCount: 0,
        lastInputItemId: null,
        lastInputContentLength: 0,
        lastInputAttemptCount: 0,
        lastInputAt: 0,
        lastInputOrigin: "",
        lastInputError: null,
        copyActionCount: 0,
        pinActionCount: 0,
        editActionCount: 0,
        addActionCount: 0,
        deleteActionCount: 0,
        detailActionCount: 0,
        cardActionButtonCount: 0,
        cardEditActionCount: 0,
        cardTranslateActionCount: 0,
        cardCopyActionCount: 0,
        cardDeleteActionCount: 0,
        cardActionGridWidthDp: 0,
        cardActionCellHeightDp: 0,
        cardActionFontScale: 1,
        cardActionIconSizeDp: 0,
        pinnedBadgeCount: 0,
        pinBadgeSizeDp: 0,
        deleteUndoVisible: false,
        deleteUndoItemId: null,
        deleteUndoShowCount: 0,
        deleteUndoActionCount: 0,
        deleteUndoTimeoutCount: 0,
        copyFeedbackVisible: false,
        copyFeedbackShowCount: 0,
        copyFeedbackTimeoutCount: 0,
        adaptiveLayoutRefreshCount: 0,
        swipeEnabled: true,
        swipeStartCount: 0,
        swipeMoveCount: 0,
        swipePinCount: 0,
        swipeDeleteCount: 0,
        swipeCancelCount: 0,
        lastSwipeItemId: null,
        lastSwipeAction: null,
        settingsOpenCount: 0,
        settingsButtonPresent: false,
        renderedTagLabelCount: 0,
        tagColorPreviewCount: 0,
        loadedResultCount: 0,
        resultPageSize: RESULT_PAGE_SIZE,
        resultPageLimit: RESULT_PAGE_SIZE,
        resultHasMore: false,
        resultCanScroll: false,
        loadMoreCount: 0,
        toolbarEnabledCount: 1,
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
        tagOptionCount: 0,
        sourceChipCount: 0,
        tagChipCount: 0,
        historyChipCount: 0,
        resultCardCount: 0,
        resultSourceIconCount: 0,
        advancedDrawerVisible: false,
        searchPageStyle: "reference_search_v14_fast_start",
        panelBuilt: false,
        panelStructureDirty: true,
        panelDataDirty: true,
        panelDataVersion: 1,
        renderedDataVersion: 0,
        contentReady: false,
        lastShowReused: false,
        panelCacheReuseCount: 0,
        panelCacheBuildCount: 0,
        panelCacheDestroyCount: 0,
        renderBatchCount: 0,
        firstRenderCount: FIRST_RENDER_COUNT,
        renderBatchSize: RENDER_BATCH_COUNT,
        refreshCoalescedCount: 0,
        lastError: null
    };

    function nowNanos() {
        return Number(System.nanoTime());
    }

    function elapsedMs(startNs, endNs) {
        if (!startNs || !endNs || endNs < startNs) { return null; }
        return Math.round(((endNs - startNs) / 1000000) * 1000) / 1000;
    }

    function resetShowPerformance(origin) {
        performance.showGeneration += 1;
        performance.showStartedAtNs = nowNanos();
        performance.windowAttachedAtNs = 0;
        performance.firstDrawAtNs = 0;
        performance.firstBatchReadyAtNs = 0;
        performance.fullRenderReadyAtNs = 0;
        performance.showToAttachMs = null;
        performance.showToFirstDrawMs = null;
        performance.showToFirstBatchMs = null;
        performance.showToFullRenderMs = null;
        performance.renderBatchCount = 0;
        performance.lastRefreshOrigin = String(origin || "show");
        performance.lastError = null;
        return performance.showGeneration;
    }

    function copyPerformance() {
        return {
            showGeneration: Number(performance.showGeneration),
            showToAttachMs: performance.showToAttachMs,
            showToFirstDrawMs: performance.showToFirstDrawMs,
            showToFirstBatchMs: performance.showToFirstBatchMs,
            showToFullRenderMs: performance.showToFullRenderMs,
            renderBatchCount: Number(performance.renderBatchCount),
            lastRefreshOrigin: String(performance.lastRefreshOrigin || ""),
            lastError: performance.lastError
        };
    }

    function markPanelDataDirty(reason) {
        panelDataVersion += 1;
        panelDataDirty = true;
        state.panelDataDirty = true;
        state.panelDataVersion = panelDataVersion;
        state.contentReady = false;
        refreshReason = String(reason || "data_changed");
        return panelDataVersion;
    }

    function dp(number) {
        return Math.max(1, Math.floor(Number(number) * density + 0.5));
    }

    function pxToDp(valuePx) {
        return Math.round(Number(valuePx) / density);
    }

    function clampNumber(value, minimum, maximum) {
        var number = Number(value);
        var low = Number(minimum);
        var high = Number(maximum);
        if (high < low) { high = low; }
        return Math.max(low, Math.min(high, number));
    }

    function resourceFontScale() {
        var scale = 1;
        try {
            scale = Number(appContext.getResources()
                .getConfiguration().fontScale || 1);
        } catch (ignoredFontScale) {}
        return clampNumber(scale, 0.85, 1.6);
    }

    function availableResultWidthPx() {
        var width = 0;
        var horizontalPadding = 0;
        try {
            if (panelRoot !== null) {
                width = Number(panelRoot.getWidth());
                horizontalPadding = Number(panelRoot.getPaddingLeft()) +
                    Number(panelRoot.getPaddingRight());
            }
        } catch (ignoredMeasuredWidth) {
            width = 0;
            horizontalPadding = 0;
        }
        if (width <= 0) {
            width = Number(state.panelWidthPx || 0);
        }
        if (width <= 0) {
            width = dp(Number(state.panelWidthDp || 390));
        }
        return Math.max(touchSlop * 18, width - horizontalPadding);
    }

    function resultCardMetrics(cardWidthPx) {
        var width = Number(cardWidthPx || 0);
        var fontScale = resourceFontScale();
        var baseUnit;
        var actionGap;
        var minimumCellWidth;
        var maximumGridWidth;
        var actionGridWidth;
        var actionCellWidth;
        var actionCellHeight;
        var actionGridHeight;
        var iconSize;
        var contentGap;
        var availableCenter;
        var tagWidth;
        var actionTextSp;
        var actionRadiusDp;
        var actionIconSize;
        var actionIconStroke;
        var pinBadgeSize;
        var pinIconSize;
        var pinIconStroke;
        var cardPaddingHorizontal;
        var cardPaddingVertical;
        var swipeRevealWidth;
        if (width <= 0) { width = availableResultWidthPx(); }
        baseUnit = Math.max(1,
            Math.round(Math.max(touchSlop, width * 0.018)));
        actionGap = Math.max(1, Math.round(baseUnit * 0.42));
        minimumCellWidth = Math.max(touchSlop * 2 + baseUnit,
            Math.round(width * 0.085));
        maximumGridWidth = Math.max(minimumCellWidth * 2 + actionGap,
            Math.round(width * 0.31));
        actionGridWidth = Math.round(clampNumber(width * 0.24,
            minimumCellWidth * 2 + actionGap, maximumGridWidth));
        actionCellWidth = Math.max(1,
            Math.floor((actionGridWidth - actionGap) / 2));
        actionCellHeight = Math.round(clampNumber(actionCellWidth * 0.66,
            touchSlop * 2 + baseUnit, width * 0.105));
        actionGridHeight = actionCellHeight * 2 + actionGap;
        iconSize = Math.round(clampNumber(width * 0.095,
            touchSlop * 3, width * 0.12));
        contentGap = Math.max(1, Math.round(baseUnit * 0.75));
        availableCenter = Math.max(touchSlop * 8,
            width - actionGridWidth - iconSize - contentGap * 4);
        tagWidth = Math.round(clampNumber(availableCenter * 0.46,
            width * 0.18, width * 0.36));
        actionTextSp = clampNumber(pxToDp(actionCellHeight) /
            (fontScale * 3.2), 7.5, 10.5);
        actionRadiusDp = clampNumber(pxToDp(actionCellHeight) * 0.34,
            6, 12);
        actionIconSize = Math.round(clampNumber(
            Math.min(actionCellWidth, actionCellHeight) * 0.48,
            touchSlop * 1.25,
            Math.min(actionCellWidth, actionCellHeight) * 0.68));
        actionIconStroke = clampNumber(actionIconSize * 0.105,
            1, actionIconSize * 0.16);
        pinBadgeSize = Math.round(clampNumber(
            actionCellHeight * 0.60, touchSlop * 1.35,
            actionCellHeight * 0.78));
        pinIconSize = Math.round(pinBadgeSize * 0.56);
        pinIconStroke = clampNumber(pinIconSize * 0.10,
            1, pinIconSize * 0.16);
        cardPaddingHorizontal = Math.max(baseUnit,
            Math.round(width * 0.018));
        cardPaddingVertical = Math.max(Math.round(baseUnit * 0.75),
            Math.round(actionGridHeight * 0.08));
        swipeRevealWidth = Math.round(clampNumber(actionGridWidth * 0.96,
            width * 0.18, width * 0.30));
        return {
            cardWidthPx: width,
            fontScale: fontScale,
            baseUnitPx: baseUnit,
            actionGapPx: actionGap,
            actionGridWidthPx: actionGridWidth,
            actionGridHeightPx: actionGridHeight,
            actionCellWidthPx: actionCellWidth,
            actionCellHeightPx: actionCellHeight,
            actionTextSp: actionTextSp,
            actionRadiusDp: actionRadiusDp,
            actionIconSizePx: actionIconSize,
            actionIconStrokePx: actionIconStroke,
            pinBadgeSizePx: pinBadgeSize,
            pinIconSizePx: pinIconSize,
            pinIconStrokePx: pinIconStroke,
            pinBadgeGapPx: Math.max(1, Math.round(contentGap * 0.72)),
            pinBadgeRadiusDp: clampNumber(
                pxToDp(pinBadgeSize) * 0.36, 5, 11),
            actionHorizontalPaddingPx: Math.max(1,
                Math.round(actionCellWidth * 0.06)),
            iconSizePx: iconSize,
            contentGapPx: contentGap,
            tagWidthPx: tagWidth,
            cardPaddingHorizontalPx: cardPaddingHorizontal,
            cardPaddingVerticalPx: cardPaddingVertical,
            cardMinimumHeightPx: Math.max(actionGridHeight +
                cardPaddingVertical * 2, iconSize + cardPaddingVertical * 2),
            swipeRevealWidthPx: swipeRevealWidth,
            swipeCommitDistancePx: Math.round(swipeRevealWidth * 0.8),
            swipeMaximumOffsetPx: Math.round(swipeRevealWidth * 1.28),
            swipeTextSp: clampNumber(actionTextSp + 1, 8.5, 11.5),
            swipeHorizontalPaddingPx: Math.max(baseUnit,
                Math.round(swipeRevealWidth * 0.16)),
            sourceTextSp: clampNumber(actionTextSp, 7.5, 9.5),
            contentTextSp: clampNumber(actionTextSp + 2.5, 10.5, 13)
        };
    }

    function deleteUndoMetrics() {
        var width = availableResultWidthPx();
        var cardMetrics = resultCardMetrics(width);
        var sideMargin = Math.max(touchSlop,
            Math.round(width * 0.025));
        var resizeClearance = Math.max(touchSlop * 4,
            Math.round(width * 0.10));
        var height = Math.round(clampNumber(
            cardMetrics.actionCellHeightPx * 1.45,
            touchSlop * 3, width * 0.14));
        return {
            heightPx: height,
            sideMarginPx: sideMargin,
            bottomMarginPx: Math.max(touchSlop,
                Math.round(width * 0.02)),
            resizeClearancePx: resizeClearance,
            horizontalPaddingPx: Math.max(touchSlop,
                Math.round(width * 0.025)),
            actionWidthPx: Math.round(clampNumber(width * 0.20,
                touchSlop * 5, width * 0.28)),
            textSp: clampNumber(pxToDp(height) /
                (resourceFontScale() * 3.8), 8.5, 11.5),
            radiusDp: clampNumber(pxToDp(height) * 0.30, 8, 15)
        };
    }

    function removeCopyFeedbackView() {
        var parent;
        if (copyFeedbackView !== null) {
            try {
                parent = copyFeedbackView.getParent();
                if (parent !== null) { parent.removeView(copyFeedbackView); }
            } catch (ignoredRemoveCopyFeedback) {}
        }
        copyFeedbackView = null;
        state.copyFeedbackVisible = false;
        return true;
    }

    function clearCopyFeedback() {
        copyFeedbackGeneration += 1;
        removeCopyFeedbackView();
        return true;
    }

    function scheduleCopyFeedbackTimeout(generation) {
        if (mainHandler === null) { return false; }
        mainHandler.postDelayed(new Packages.java.lang.Runnable({
            run: function () {
                if (generation !== copyFeedbackGeneration) { return; }
                state.copyFeedbackTimeoutCount += 1;
                removeCopyFeedbackView();
                copyFeedbackGeneration += 1;
                attachDeleteUndoBanner();
            }
        }), COPY_FEEDBACK_TIMEOUT_MS);
        return true;
    }

    function attachCopyFeedbackBanner() {
        var metrics;
        var colors;
        var root;
        var message;
        var params;
        var generation;
        if (resultBodyFrame === null || !state.panelAttached ||
                advancedVisible) {
            clearCopyFeedback();
            return false;
        }
        clearCopyFeedback();
        removeDeleteUndoView();
        metrics = deleteUndoMetrics();
        colors = palette();
        root = new LinearLayout(appContext);
        root.setOrientation(LinearLayout.HORIZONTAL);
        root.setGravity(Gravity.CENTER_VERTICAL);
        root.setPadding(metrics.horizontalPaddingPx, 0,
            metrics.horizontalPaddingPx, 0);
        root.setBackground(roundedBackground(colors.textPrimary,
            colors.strokeStrong, metrics.radiusDp));
        message = makeText("已复制", metrics.textSp,
            colors.surface, false);
        message.setSingleLine(true);
        message.setGravity(Gravity.CENTER_VERTICAL);
        root.addView(message, new LinearLayout.LayoutParams(0,
            LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        params = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, metrics.heightPx);
        params.gravity = Gravity.BOTTOM;
        params.setMargins(metrics.sideMarginPx, 0,
            metrics.sideMarginPx + metrics.resizeClearancePx,
            metrics.bottomMarginPx);
        resultBodyFrame.addView(root, params);
        copyFeedbackView = root;
        state.copyFeedbackVisible = true;
        state.copyFeedbackShowCount += 1;
        copyFeedbackGeneration += 1;
        generation = copyFeedbackGeneration;
        scheduleCopyFeedbackTimeout(generation);
        return true;
    }

    function removeDeleteUndoView() {
        var parent;
        if (deleteUndoView !== null) {
            try {
                parent = deleteUndoView.getParent();
                if (parent !== null) { parent.removeView(deleteUndoView); }
            } catch (ignoredRemoveUndo) {}
        }
        deleteUndoView = null;
        state.deleteUndoVisible = false;
        return true;
    }

    function clearDeleteUndo(clearPending) {
        deleteUndoGeneration += 1;
        removeDeleteUndoView();
        if (clearPending === true) {
            pendingDeleteUndo = null;
            state.deleteUndoItemId = null;
        }
        return true;
    }

    function scheduleDeleteUndoTimeout(generation) {
        if (mainHandler === null) { return false; }
        mainHandler.postDelayed(new Packages.java.lang.Runnable({
            run: function () {
                if (generation !== deleteUndoGeneration ||
                        pendingDeleteUndo === null) {
                    return;
                }
                state.deleteUndoTimeoutCount += 1;
                clearDeleteUndo(true);
            }
        }), DELETE_UNDO_TIMEOUT_MS);
        return true;
    }

    function rememberDeleteUndo(row) {
        var now = ClipHub.Base.now();
        clearDeleteUndo(true);
        pendingDeleteUndo = {
            itemId: Number(row.id),
            expiresAt: now + DELETE_UNDO_TIMEOUT_MS
        };
        deleteUndoGeneration += 1;
        state.deleteUndoItemId = Number(row.id);
        state.deleteUndoShowCount += 1;
        scheduleDeleteUndoTimeout(deleteUndoGeneration);
        return pendingDeleteUndo;
    }

    function performDeleteUndo() {
        var target = pendingDeleteUndo;
        var changed = false;
        if (target === null || !ClipHub.List ||
                typeof ClipHub.List.undoLastDelete !== "function") {
            return false;
        }
        clearDeleteUndo(true);
        try {
            changed = ClipHub.List.undoLastDelete();
            if (changed) {
                state.deleteUndoActionCount += 1;
                refreshPrimaryResults("delete_undo");
                state.lastError = null;
            }
            return changed === true;
        } catch (error) {
            state.lastError = "Delete undo failed: " + String(error);
            return false;
        }
    }

    function attachDeleteUndoBanner() {
        var metrics;
        var colors;
        var root;
        var message;
        var undo;
        var params;
        if (pendingDeleteUndo === null || resultBodyFrame === null ||
                !state.panelAttached || advancedVisible) {
            removeDeleteUndoView();
            return false;
        }
        if (Number(pendingDeleteUndo.expiresAt || 0) <= ClipHub.Base.now()) {
            state.deleteUndoTimeoutCount += 1;
            clearDeleteUndo(true);
            return false;
        }
        removeDeleteUndoView();
        metrics = deleteUndoMetrics();
        colors = palette();
        root = new LinearLayout(appContext);
        root.setOrientation(LinearLayout.HORIZONTAL);
        root.setGravity(Gravity.CENTER_VERTICAL);
        root.setPadding(metrics.horizontalPaddingPx, 0,
            metrics.horizontalPaddingPx, 0);
        root.setBackground(roundedBackground(colors.textPrimary,
            colors.strokeStrong, metrics.radiusDp));
        message = makeText("已删除剪贴板记录", metrics.textSp,
            colors.surface, false);
        message.setSingleLine(true);
        message.setEllipsize(TextUtils.TruncateAt.END);
        root.addView(message, new LinearLayout.LayoutParams(0,
            LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        undo = makeText("撤销", metrics.textSp,
            colors.accentStrong, true);
        undo.setGravity(Gravity.CENTER);
        undo.setClickable(true);
        undo.setFocusable(true);
        undo.setContentDescription("撤销最近一次删除");
        undo.setBackground(roundedBackground(colors.accentSoft,
            colors.accentBorder, metrics.radiusDp));
        undo.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () { performDeleteUndo(); }
            }));
        root.addView(undo, new LinearLayout.LayoutParams(
            metrics.actionWidthPx,
            Math.max(1, metrics.heightPx - metrics.horizontalPaddingPx)));
        params = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, metrics.heightPx);
        params.gravity = Gravity.BOTTOM;
        params.setMargins(metrics.sideMarginPx, 0,
            metrics.sideMarginPx + metrics.resizeClearancePx,
            metrics.bottomMarginPx);
        resultBodyFrame.addView(root, params);
        deleteUndoView = root;
        state.deleteUndoVisible = true;
        state.deleteUndoItemId = Number(pendingDeleteUndo.itemId);
        return true;
    }

    function scheduleAdaptiveResultRefresh(previousWidth, nextWidth) {
        var generation;
        if (mainHandler === null || !state.panelAttached ||
                Math.abs(Number(nextWidth) - Number(previousWidth)) <=
                    touchSlop * 2) {
            return false;
        }
        adaptiveRenderGeneration += 1;
        generation = adaptiveRenderGeneration;
        mainHandler.post(new Packages.java.lang.Runnable({
            run: function () {
                if (generation !== adaptiveRenderGeneration ||
                        !state.panelAttached) {
                    return;
                }
                state.adaptiveLayoutRefreshCount += 1;
                buildPanelContent(false);
            }
        }));
        return true;
    }

    function updateDrawerMeasurements() {
        var viewportPx = 0;
        var contentPx = 0;
        var footerPx = 0;
        var scrollYPx = 0;
        var measured = false;
        var canScrollDown = false;
        if (!advancedVisible || drawerScrollView === null ||
                drawerContentView === null || drawerFooterView === null) {
            state.drawerMeasured = false;
            state.drawerContentHeightDp = 0;
            state.drawerViewportHeightDp = 0;
            state.drawerScrollYDp = 0;
            state.drawerCanScrollDownAtTop = false;
            state.drawerContentFitsViewport = false;
            state.drawerFooterHeightDp = 0;
            return false;
        }
        try {
            viewportPx = Number(drawerScrollView.getHeight());
            contentPx = Number(drawerContentView.getHeight());
            footerPx = Number(drawerFooterView.getHeight());
            scrollYPx = Number(drawerScrollView.getScrollY());
            measured = viewportPx > 0 && contentPx > 0 && footerPx > 0;
            canScrollDown = measured && scrollYPx === 0 &&
                drawerScrollView.canScrollVertically(1);
        } catch (ignoredMeasure) {
            measured = false;
            canScrollDown = false;
        }
        state.drawerMeasured = measured;
        state.drawerContentHeightDp = measured ? pxToDp(contentPx) : 0;
        state.drawerViewportHeightDp = measured ? pxToDp(viewportPx) : 0;
        state.drawerScrollYDp = measured ? pxToDp(scrollYPx) : 0;
        state.drawerFooterHeightDp = measured ? pxToDp(footerPx) : 0;
        state.drawerCanScrollDownAtTop = canScrollDown;
        state.drawerContentFitsViewport = measured &&
            contentPx <= viewportPx + dp(1);
        return state.drawerContentFitsViewport;
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
        var view = new TextView(appContext);
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

    function makeChip(text, selected, colors, compact) {
        var verticalPaddingDp = compact === true ? 4 : 6;
        var view = makeText(text, 10,
            selected ? colors.accentStrong : colors.textSecondary,
            selected);
        view.setGravity(Gravity.CENTER);
        view.setSingleLine(true);
        view.setMaxLines(1);
        view.setEllipsize(TextUtils.TruncateAt.END);
        view.setPadding(dp(9), dp(verticalPaddingDp),
            dp(9), dp(verticalPaddingDp));
        if (compact === true) {
            state.advancedChipVerticalPaddingDp = verticalPaddingDp;
        }
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
            if (timeFormatter === null) {
                timeFormatter = new SimpleDateFormat(
                    "HH:mm", Locale.getDefault());
            }
            return String(timeFormatter.format(
                new Date(Number(valueTime || 0))));
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

    function paginationMode(valueMode) {
        return String(valueMode || "ajax") === "number" ?
            "number" : "ajax";
    }

    function paginationPageSize(valueSize) {
        var size = Number(valueSize);
        if (!isFinite(size) || Math.floor(size) !== size ||
                size < 5 || size > 1000) {
            return 100;
        }
        return size;
    }

    function copyPaginationState() {
        return {
            ready: paginationState.ready === true,
            mode: paginationState.mode,
            repositoryMode: paginationState.repositoryMode,
            pageSize: Number(paginationState.pageSize),
            prefetchEnabled:
                paginationState.prefetchEnabled === true,
            pageNumber: Number(paginationState.pageNumber),
            loadedCount: Number(paginationState.loadedCount),
            totalCount: Number(paginationState.totalCount),
            totalPages: Number(paginationState.totalPages),
            hasMore: paginationState.hasMore === true,
            endCursor: paginationState.endCursor,
            queryGeneration: Number(paginationState.queryGeneration),
            resetCount: Number(paginationState.resetCount),
            loadCount: Number(paginationState.loadCount),
            settingsSyncCount:
                Number(paginationState.settingsSyncCount),
            settingsEventCount:
                Number(paginationState.settingsEventCount),
            criteriaChangeCount:
                Number(paginationState.criteriaChangeCount),
            lastResetReason: paginationState.lastResetReason,
            lastLoadMode: paginationState.lastLoadMode,
            lastCriteriaSignature:
                paginationState.lastCriteriaSignature,
            newContentPending:
                paginationState.newContentPending === true,
            quickResetAvailable:
                paginationState.quickResetAvailable === true,
            lastError: paginationState.lastError
        };
    }

    function copyAjaxFooterState() {
        return {
            present: ajaxFooterState.present === true,
            visible: ajaxFooterState.visible === true,
            action: ajaxFooterState.action,
            text: ajaxFooterState.text,
            clickable: ajaxFooterState.clickable === true,
            loading: ajaxFooterState.loading === true,
            clickCount: Number(ajaxFooterState.clickCount),
            blockedClickCount:
                Number(ajaxFooterState.blockedClickCount),
            successCount: Number(ajaxFooterState.successCount),
            endCount: Number(ajaxFooterState.endCount),
            appendedRowCount:
                Number(ajaxFooterState.appendedRowCount),
            duplicateBlockedCount:
                Number(ajaxFooterState.duplicateBlockedCount),
            renderBatchCount:
                Number(ajaxFooterState.renderBatchCount),
            lastScrollYBeforeAppend:
                Number(ajaxFooterState.lastScrollYBeforeAppend),
            lastScrollYAfterAppend:
                Number(ajaxFooterState.lastScrollYAfterAppend),
            positionPreserved:
                ajaxFooterState.positionPreserved === true,
            lastError: ajaxFooterState.lastError
        };
    }

    function copyNumberPagerState() {
        return {
            present: numberPagerState.present === true,
            visible: numberPagerState.visible === true,
            loading: numberPagerState.loading === true,
            currentPage: Number(numberPagerState.currentPage),
            totalPages: Number(numberPagerState.totalPages),
            totalCount: Number(numberPagerState.totalCount),
            tokens: copyList(numberPagerState.tokens),
            selectedPage: Number(numberPagerState.selectedPage),
            nearbyPageLimit:
                Number(numberPagerState.nearbyPageLimit),
            jumpInputPresent:
                numberPagerState.jumpInputPresent === true,
            layoutStyle: numberPagerState.layoutStyle,
            firstEnabled: numberPagerState.firstEnabled === true,
            previousEnabled:
                numberPagerState.previousEnabled === true,
            nextEnabled: numberPagerState.nextEnabled === true,
            lastEnabled: numberPagerState.lastEnabled === true,
            clickCount: Number(numberPagerState.clickCount),
            pageClickCount:
                Number(numberPagerState.pageClickCount),
            actionClickCount:
                Number(numberPagerState.actionClickCount),
            blockedClickCount:
                Number(numberPagerState.blockedClickCount),
            samePageBlockedCount:
                Number(numberPagerState.samePageBlockedCount),
            successCount: Number(numberPagerState.successCount),
            failureCount: Number(numberPagerState.failureCount),
            pageReplaceCount:
                Number(numberPagerState.pageReplaceCount),
            scrollResetCount:
                Number(numberPagerState.scrollResetCount),
            nonZeroScrollResetCount:
                Number(numberPagerState.nonZeroScrollResetCount),
            maximumScrollYBeforeChange:
                Number(numberPagerState.maximumScrollYBeforeChange),
            lastScrollYBeforeChange:
                Number(numberPagerState.lastScrollYBeforeChange),
            lastScrollYAfterChange:
                Number(numberPagerState.lastScrollYAfterChange),
            lastTargetPage:
                Number(numberPagerState.lastTargetPage),
            lastAction: numberPagerState.lastAction,
            lastOrigin: numberPagerState.lastOrigin,
            lastError: numberPagerState.lastError
        };
    }

    function readPaginationSettings() {
        var settings = ClipHub.Settings;
        var mode = "ajax";
        var pageSize = 100;
        var prefetchEnabled = true;
        if (settings && typeof settings.get === "function") {
            mode = paginationMode(
                settings.get("paginationMode", "ajax"));
            pageSize = paginationPageSize(
                settings.get("paginationPageSize", 100));
            prefetchEnabled =
                settings.get("paginationPrefetchEnabled", true) === true;
        }
        return {
            mode: mode,
            repositoryMode: mode === "number" ?
                "number" : "append",
            pageSize: pageSize,
            prefetchEnabled: prefetchEnabled
        };
    }

    function paginationCriteriaSignature() {
        return JSON.stringify({
            keyword: String(value && value.keyword || ""),
            sourcePackages:
                copyList(value && value.sourcePackages || []),
            tagIds: copyList(value && value.tagIds || []),
            pinnedOnly: value && value.pinnedOnly === true,
            sensitiveOnly: value &&
                value.sensitiveMode === "only",
            excludeSensitive: value &&
                value.sensitiveMode === "exclude",
            sortMode: validateSortMode(
                value && value.sortMode || "latest")
        });
    }

    function resetUnifiedPagination(reason) {
        ajaxAppendGeneration += 1;
        resetLazyLoadRuntime(
            reason || "pagination_reset");
        clearPrefetchedPage(
            reason || "pagination_reset");
        paginationState.pageNumber = 1;
        paginationState.loadedCount = 0;
        paginationState.totalCount = 0;
        paginationState.totalPages = 0;
        paginationState.hasMore = false;
        paginationState.endCursor = null;
        paginationState.queryGeneration += 1;
        paginationState.resetCount += 1;
        paginationState.lastResetReason =
            String(reason || "pagination_reset");
        paginationState.lastLoadMode = "";
        paginationState.lastCriteriaSignature =
            paginationCriteriaSignature();
        paginationState.lastError = null;
        ajaxFooterState.loading = false;
        ajaxFooterState.present = false;
        ajaxFooterState.visible = false;
        ajaxFooterState.action = "none";
        ajaxFooterState.text = "";
        ajaxFooterState.clickable = false;
        ajaxFooterState.lastError = null;
        numberPagerState.loading = false;
        numberPagerState.present = false;
        numberPagerState.visible = false;
        numberPagerState.currentPage = 1;
        numberPagerState.totalPages = 0;
        numberPagerState.totalCount = 0;
        numberPagerState.tokens = [];
        numberPagerState.selectedPage = 1;
        numberPagerState.firstEnabled = false;
        numberPagerState.previousEnabled = false;
        numberPagerState.nextEnabled = false;
        numberPagerState.lastEnabled = false;
        numberPagerState.lastError = null;
        numberPagerView = null;
        numberPageViews = {};
        numberActionViews = {};
        resultHasMore = false;
        resultPageLimit = Number(paginationState.pageSize);
        state.loadedResultCount = 0;
        state.resultPageSize = Number(paginationState.pageSize);
        state.resultPageLimit = resultPageLimit;
        state.resultHasMore = false;
        return copyPaginationState();
    }

    function syncPaginationSettings(reason) {
        var next = readPaginationSettings();
        var changed;
        paginationState.settingsSyncCount += 1;
        changed = paginationState.ready === true &&
            (paginationState.mode !== next.mode ||
                Number(paginationState.pageSize) !==
                    Number(next.pageSize) ||
                paginationState.prefetchEnabled !==
                    next.prefetchEnabled);
        paginationState.mode = next.mode;
        paginationState.repositoryMode = next.repositoryMode;
        paginationState.pageSize = next.pageSize;
        paginationState.prefetchEnabled =
            next.prefetchEnabled === true;
        if (!paginationState.ready) {
            paginationState.ready = true;
        } else if (changed) {
            resetUnifiedPagination(
                reason || "pagination_settings_sync");
        }
        state.resultPageSize = Number(paginationState.pageSize);
        return copyPaginationState();
    }

    function ensurePaginationCriteria() {
        var signature = paginationCriteriaSignature();
        if (paginationState.lastCriteriaSignature !== signature) {
            paginationState.criteriaChangeCount += 1;
            resetUnifiedPagination("state_criteria_sync");
            paginationState.lastCriteriaSignature = signature;
            return true;
        }
        return false;
    }

    function paginationQueryOptions(request) {
        var options;
        var append;
        request = request || {};
        syncPaginationSettings("query_options_sync");
        ensurePaginationCriteria();
        append = paginationState.mode === "ajax" &&
            request.append === true;
        options = toQueryOptions({
            mode: paginationState.repositoryMode,
            pageSize: paginationState.pageSize,
            sortMode: validateSortMode(
                value && value.sortMode || "latest")
        });
        if (paginationState.repositoryMode === "number") {
            options.page = Math.max(1, Math.floor(Number(
                request.page || paginationState.pageNumber || 1)));
            options.includeTotal =
                request.includeTotal !== false;
        } else {
            options.cursor = append ?
                paginationState.endCursor : null;
            options.includeTotal = !append ||
                request.includeTotal === true;
        }
        options.previewOnly = true;
        return options;
    }

    function rowIdMap(rows) {
        var map = {};
        var index;
        rows = rows || [];
        for (index = 0; index < rows.length; index += 1) {
            map[String(Number(rows[index].id))] = true;
        }
        return map;
    }

    function uniqueAppendRows(existingRows, incomingRows) {
        var seen = rowIdMap(existingRows);
        var output = [];
        var index;
        var key;
        incomingRows = incomingRows || [];
        for (index = 0; index < incomingRows.length; index += 1) {
            key = String(Number(incomingRows[index].id));
            if (!seen[key]) {
                seen[key] = true;
                output.push(incomingRows[index]);
            } else {
                ajaxFooterState.duplicateBlockedCount += 1;
            }
        }
        return output;
    }

    function readItemTagMap(ids) {
        if (ClipHub.Repository &&
                typeof ClipHub.Repository
                    .listItemTagMapChunked === "function") {
            return ClipHub.Repository.listItemTagMapChunked(ids);
        }
        return ClipHub.Repository.listItemTagMap(ids);
    }

    function mergeItemTagMap(target, patch) {
        var key;
        target = target || {};
        patch = patch || {};
        for (key in patch) {
            if (patch.hasOwnProperty(key)) {
                target[key] = patch[key];
            }
        }
        return target;
    }

    function copyLazyLoadState() {
        return {
            listenerBound:
                lazyLoadState.listenerBound === true,
            enabled: lazyLoadState.enabled === true,
            pending: lazyLoadState.pending === true,
            thresholdPx: Number(
                lazyLoadState.thresholdPx),
            remainingPx: Number(
                lazyLoadState.remainingPx),
            lastScrollY: Number(
                lazyLoadState.lastScrollY),
            lastOldScrollY: Number(
                lazyLoadState.lastOldScrollY),
            scrollEventCount: Number(
                lazyLoadState.scrollEventCount),
            downwardScrollCount: Number(
                lazyLoadState.downwardScrollCount),
            nearBottomCount: Number(
                lazyLoadState.nearBottomCount),
            triggerCount: Number(
                lazyLoadState.triggerCount),
            successCount: Number(
                lazyLoadState.successCount),
            failureCount: Number(
                lazyLoadState.failureCount),
            blockedCount: Number(
                lazyLoadState.blockedCount),
            lastTriggeredLoadedCount: Number(
                lazyLoadState
                    .lastTriggeredLoadedCount),
            lastTriggerAt: Number(
                lazyLoadState.lastTriggerAt),
            lastOrigin: lazyLoadState.lastOrigin,
            lastError: lazyLoadState.lastError
        };
    }

    function copyPrefetchState() {
        return {
            enabled: prefetchState.enabled === true,
            scheduled:
                prefetchState.scheduled === true,
            inFlight: prefetchState.inFlight === true,
            ready: prefetchState.ready === true,
            mode: prefetchState.mode,
            targetPage: Number(
                prefetchState.targetPage),
            rowCount: Number(prefetchState.rowCount),
            scheduleCount: Number(
                prefetchState.scheduleCount),
            requestCount: Number(
                prefetchState.requestCount),
            successCount: Number(
                prefetchState.successCount),
            hitCount: Number(prefetchState.hitCount),
            missCount: Number(
                prefetchState.missCount),
            invalidationCount: Number(
                prefetchState.invalidationCount),
            staleDiscardCount: Number(
                prefetchState.staleDiscardCount),
            lastOrigin: prefetchState.lastOrigin,
            lastInvalidationReason:
                prefetchState.lastInvalidationReason,
            lastError: prefetchState.lastError
        };
    }

    function resetLazyLoadRuntime(reason) {
        lazyGeneration += 1;
        lazyLoadState.enabled =
            paginationState.mode === "ajax";
        lazyLoadState.pending = false;
        lazyLoadState.thresholdPx = 0;
        lazyLoadState.remainingPx = 0;
        lazyLoadState.lastScrollY = 0;
        lazyLoadState.lastOldScrollY = 0;
        lazyLoadState.lastTriggeredLoadedCount = -1;
        lazyLoadState.lastTriggerAt = 0;
        lazyLoadState.lastOrigin =
            String(reason || "lazy_reset");
        lazyLoadState.lastError = null;
        return copyLazyLoadState();
    }

    function clearPrefetchedPage(reason) {
        var hadValue = prefetchedPage !== null ||
            prefetchState.scheduled ||
            prefetchState.inFlight ||
            prefetchState.ready;
        prefetchGeneration += 1;
        prefetchedPage = null;
        prefetchState.enabled =
            paginationState.prefetchEnabled === true;
        prefetchState.scheduled = false;
        prefetchState.inFlight = false;
        prefetchState.ready = false;
        prefetchState.mode = "";
        prefetchState.targetPage = 0;
        prefetchState.rowCount = 0;
        if (hadValue) {
            prefetchState.invalidationCount += 1;
        }
        prefetchState.lastInvalidationReason =
            String(reason || "prefetch_clear");
        prefetchState.lastError = null;
        return true;
    }

    function prefetchOptionsKey(options) {
        return JSON.stringify({
            queryGeneration:
                Number(paginationState.queryGeneration),
            criteria:
                String(paginationState
                    .lastCriteriaSignature ||
                    paginationCriteriaSignature()),
            mode: String(options.mode || ""),
            pageSize: Number(options.pageSize || 0),
            page: Number(options.page || 0),
            cursor: options.cursor === undefined ?
                null : options.cursor
        });
    }

    function nextPrefetchDescriptor() {
        var request;
        var options;
        var targetPage;
        if (!ready ||
                paginationState.prefetchEnabled !== true ||
                paginationState.hasMore !== true) {
            return null;
        }
        if (paginationState.mode === "ajax") {
            targetPage = Math.max(2,
                Number(paginationState.pageNumber || 1) + 1);
            request = {
                append: true,
                includeTotal: false
            };
        } else {
            targetPage = Number(
                paginationState.pageNumber || 1) + 1;
            if (targetPage >
                    Math.max(1, Number(
                        paginationState.totalPages || 1))) {
                return null;
            }
            request = {
                append: false,
                page: targetPage,
                includeTotal: true
            };
        }
        options = paginationQueryOptions(request);
        return {
            request: request,
            options: options,
            key: prefetchOptionsKey(options),
            targetPage: targetPage,
            mode: paginationState.mode,
            queryGeneration:
                Number(paginationState.queryGeneration)
        };
    }

    function executeNextPagePrefetch(origin, generation) {
        var descriptor;
        var result;
        var rows;
        origin = String(origin || "prefetch_now");
        descriptor = nextPrefetchDescriptor();
        prefetchState.enabled =
            paginationState.prefetchEnabled === true;
        prefetchState.scheduled = false;
        if (descriptor === null) {
            prefetchState.inFlight = false;
            prefetchState.ready = false;
            prefetchedPage = null;
            prefetchState.mode = "";
            prefetchState.targetPage = 0;
            prefetchState.rowCount = 0;
            prefetchState.lastOrigin = origin;
            return false;
        }
        if (prefetchedPage !== null &&
                prefetchState.ready === true &&
                prefetchedPage.key === descriptor.key &&
                Number(prefetchedPage.queryGeneration) ===
                    Number(descriptor.queryGeneration)) {
            prefetchState.lastOrigin =
                origin + "_reuse";
            return true;
        }
        prefetchState.inFlight = true;
        prefetchState.ready = false;
        prefetchState.mode = descriptor.mode;
        prefetchState.targetPage =
            Number(descriptor.targetPage);
        prefetchState.rowCount = 0;
        prefetchState.requestCount += 1;
        prefetchState.lastOrigin = origin;
        prefetchState.lastError = null;
        try {
            result = ClipHub.Repository.listItemPage(
                descriptor.options);
            rows = result && result.rows ?
                result.rows : [];
            if (generation !== prefetchGeneration ||
                    Number(descriptor.queryGeneration) !==
                        Number(paginationState
                            .queryGeneration)) {
                prefetchState.staleDiscardCount += 1;
                prefetchState.inFlight = false;
                prefetchState.ready = false;
                prefetchedPage = null;
                return false;
            }
            prefetchedPage = {
                key: descriptor.key,
                queryGeneration:
                    Number(descriptor.queryGeneration),
                mode: descriptor.mode,
                targetPage:
                    Number(descriptor.targetPage),
                result: result
            };
            prefetchState.inFlight = false;
            prefetchState.ready = true;
            prefetchState.rowCount = rows.length;
            prefetchState.successCount += 1;
            return true;
        } catch (error) {
            prefetchState.inFlight = false;
            prefetchState.ready = false;
            prefetchedPage = null;
            prefetchState.lastError = String(error);
            return false;
        }
    }

    function prefetchNextPageNow(origin) {
        prefetchGeneration += 1;
        prefetchState.scheduled = false;
        return executeNextPagePrefetch(
            origin || "prefetch_now",
            prefetchGeneration);
    }

    function scheduleNextPagePrefetch(origin) {
        var descriptor;
        var generation;
        if (paginationState.prefetchEnabled !== true ||
                paginationState.hasMore !== true ||
                mainHandler === null ||
                !state.panelAttached) {
            prefetchState.enabled =
                paginationState.prefetchEnabled === true;
            if (paginationState.prefetchEnabled !== true) {
                clearPrefetchedPage(
                    "prefetch_disabled");
            }
            return false;
        }
        descriptor = nextPrefetchDescriptor();
        if (descriptor === null) {
            return false;
        }
        if (prefetchedPage !== null &&
                prefetchState.ready === true &&
                prefetchedPage.key === descriptor.key) {
            return true;
        }
        prefetchGeneration += 1;
        generation = prefetchGeneration;
        prefetchState.enabled = true;
        prefetchState.scheduled = true;
        prefetchState.scheduleCount += 1;
        prefetchState.mode = descriptor.mode;
        prefetchState.targetPage =
            Number(descriptor.targetPage);
        prefetchState.lastOrigin =
            String(origin || "prefetch_schedule");
        mainHandler.postDelayed(
            new Packages.java.lang.Runnable({
                run: function () {
                    if (generation !==
                            prefetchGeneration ||
                            !state.panelAttached) {
                        prefetchState
                            .staleDiscardCount += 1;
                        return;
                    }
                    executeNextPagePrefetch(
                        origin || "prefetch_schedule",
                        generation);
                }
            }), PREFETCH_DELAY_MS);
        return true;
    }

    function consumePrefetchedPage(options) {
        var key;
        var result;
        var pageRequest;
        if (paginationState.prefetchEnabled !== true) {
            return null;
        }
        pageRequest =
            (String(options.mode || "") === "append" &&
                options.cursor !== null &&
                options.cursor !== undefined) ||
            (String(options.mode || "") === "number" &&
                Number(options.page || 1) > 1);
        if (!pageRequest) {
            return null;
        }
        key = prefetchOptionsKey(options);
        if (prefetchedPage !== null &&
                prefetchState.ready === true &&
                prefetchedPage.key === key &&
                Number(prefetchedPage.queryGeneration) ===
                    Number(paginationState
                        .queryGeneration)) {
            result = prefetchedPage.result;
            prefetchedPage = null;
            prefetchState.ready = false;
            prefetchState.inFlight = false;
            prefetchState.scheduled = false;
            prefetchState.rowCount = 0;
            prefetchState.hitCount += 1;
            prefetchState.lastOrigin =
                "prefetch_consume";
            return result;
        }
        prefetchState.missCount += 1;
        if (prefetchedPage !== null ||
                prefetchState.ready === true) {
            clearPrefetchedPage(
                "prefetch_request_mismatch");
        }
        return null;
    }

    function resultRemainingScrollPx() {
        var child;
        var contentHeight;
        var viewportHeight;
        var scrollY;
        if (resultScrollView === null) {
            return 0;
        }
        try {
            child = resultScrollView.getChildCount() > 0 ?
                resultScrollView.getChildAt(0) : null;
            contentHeight = child === null ? 0 :
                Number(child.getHeight());
            viewportHeight =
                Number(resultScrollView.getHeight());
            scrollY =
                Number(resultScrollView.getScrollY());
            return Math.max(0,
                contentHeight - viewportHeight - scrollY);
        } catch (error) {
            lazyLoadState.lastError = String(error);
            return 0;
        }
    }

    function lazyTriggerThresholdPx() {
        var viewport = 0;
        try {
            viewport = resultScrollView === null ?
                0 : Number(resultScrollView.getHeight());
        } catch (ignoredViewport) {
            viewport = 0;
        }
        return Math.max(
            dp(LAZY_TRIGGER_MIN_DP),
            Math.floor(viewport *
                LAZY_TRIGGER_VIEWPORT_RATIO));
    }

    function maybeTriggerLazyLoad(origin, requireDownward) {
        var now = Number(System.currentTimeMillis());
        var loaded = previewRows.length;
        var remaining;
        var threshold;
        origin = String(origin || "lazy_scroll");
        lazyLoadState.enabled =
            paginationState.mode === "ajax";
        if (!state.panelAttached ||
                paginationState.mode !== "ajax" ||
                paginationState.hasMore !== true ||
                ajaxFooterState.loading ||
                lazyLoadState.pending) {
            lazyLoadState.blockedCount += 1;
            return false;
        }
        if (requireDownward === true &&
                Number(lazyLoadState.lastScrollY) <=
                    Number(lazyLoadState.lastOldScrollY)) {
            return false;
        }
        threshold = lazyTriggerThresholdPx();
        remaining = resultRemainingScrollPx();
        lazyLoadState.thresholdPx = threshold;
        lazyLoadState.remainingPx = remaining;
        if (remaining > threshold) {
            return false;
        }
        lazyLoadState.nearBottomCount += 1;
        if (Number(lazyLoadState
                    .lastTriggeredLoadedCount) ===
                Number(loaded) ||
                now - Number(
                    lazyLoadState.lastTriggerAt || 0) <
                    LAZY_TRIGGER_COOLDOWN_MS) {
            lazyLoadState.blockedCount += 1;
            return false;
        }
        lazyLoadState.pending = true;
        lazyLoadState.triggerCount += 1;
        lazyLoadState.lastTriggeredLoadedCount =
            Number(loaded);
        lazyLoadState.lastTriggerAt = now;
        lazyLoadState.lastOrigin = origin;
        lazyLoadState.lastError = null;
        if (!loadMoreResults(origin)) {
            lazyLoadState.pending = false;
            lazyLoadState.failureCount += 1;
            return false;
        }
        return true;
    }

    function bindLazyScrollListener() {
        var target = resultScrollView;
        if (target === null) {
            lazyLoadState.listenerBound = false;
            virtualState.scrollListenerBound = false;
            return false;
        }
        lazyLoadState.enabled =
            paginationState.mode === "ajax";
        if (Build.VERSION.SDK_INT < 23) {
            try {
                target.setOnScrollChangeListener(null);
            } catch (ignoredClearListener) {}
            lazyScrollListener = null;
            lazyLoadState.listenerBound = false;
            virtualState.scrollListenerBound = false;
            return false;
        }
        lazyGeneration += 1;
        lazyScrollListener = new JavaAdapter(
            View.OnScrollChangeListener, {
                onScrollChange: function (view,
                        scrollX, scrollY,
                        oldScrollX, oldScrollY) {
                    lazyLoadState.scrollEventCount += 1;
                    lazyLoadState.lastOldScrollY =
                        Number(oldScrollY);
                    lazyLoadState.lastScrollY =
                        Number(scrollY);
                    scheduleVirtualUpdate(
                        "result_scroll");
                    if (paginationState.mode === "ajax" &&
                            Number(scrollY) >
                            Number(oldScrollY)) {
                        lazyLoadState
                            .downwardScrollCount += 1;
                        maybeTriggerLazyLoad(
                            "lazy_scroll", true);
                    }
                }
            });
        target.setOnScrollChangeListener(
            lazyScrollListener);
        lazyLoadState.listenerBound =
            paginationState.mode === "ajax";
        virtualState.scrollListenerBound = true;
        lazyLoadState.thresholdPx =
            lazyTriggerThresholdPx();
        lazyLoadState.remainingPx =
            resultRemainingScrollPx();
        return true;
    }

    function loadPaginationPageInternal(request) {
        var options;
        var result;
        var rows;
        var appendedRows;
        var append;
        request = request || {};
        append = paginationState.mode === "ajax" &&
            request.append === true;
        options = paginationQueryOptions(request);
        try {
            result = consumePrefetchedPage(options);
            if (result === null) {
                result = ClipHub.Repository.listItemPage(
                    options);
            }
            rows = result && result.rows ? result.rows : [];
            if (paginationState.repositoryMode === "number" &&
                    rows.length === 0 &&
                    Number(options.page || 1) > 1 &&
                    Number(options.page) >
                        Math.max(1,
                            Number(result.totalPages || 0))) {
                options.page = Math.max(1,
                    Number(result.totalPages || 0));
                result = ClipHub.Repository.listItemPage(options);
                rows = result && result.rows ?
                    result.rows : [];
            }
            if (append) {
                appendedRows = uniqueAppendRows(
                    previewRows, rows);
                previewRows = previewRows.concat(appendedRows);
            } else {
                appendedRows = rows.slice(0);
                previewRows = rows.slice(0);
                resetDataWindowState(true);
            }
            paginationState.pageNumber =
                paginationState.repositoryMode === "number" ?
                    Math.max(1, Number(result.page ||
                        options.page || 1)) :
                    Math.max(1, Math.ceil(
                        previewRows.length /
                        Math.max(1,
                            Number(paginationState.pageSize))));
            paginationState.loadedCount = previewRows.length;
            if (options.includeTotal === true &&
                    result.totalCount !== undefined &&
                    result.totalCount !== null) {
                paginationState.totalCount =
                    Number(result.totalCount);
            } else if (result.hasMore !== true) {
                paginationState.totalCount =
                    Math.max(
                        Number(paginationState.totalCount),
                        previewRows.length);
            }
            if (options.includeTotal === true &&
                    result.totalPages !== undefined &&
                    result.totalPages !== null) {
                paginationState.totalPages =
                    Number(result.totalPages);
            } else if (paginationState.totalCount > 0) {
                paginationState.totalPages = Math.ceil(
                    paginationState.totalCount /
                    Math.max(1,
                        Number(paginationState.pageSize)));
            } else if (result.hasMore !== true &&
                    previewRows.length > 0) {
                paginationState.totalPages = Math.ceil(
                    previewRows.length /
                    Math.max(1,
                        Number(paginationState.pageSize)));
            } else {
                paginationState.totalPages = 0;
            }
            paginationState.hasMore =
                result.hasMore === true;
            paginationState.endCursor =
                result.endCursor === undefined ?
                    null : result.endCursor;
            paginationState.loadCount += 1;
            paginationState.lastLoadMode =
                paginationState.repositoryMode;
            paginationState.lastError = null;
            resultHasMore = paginationState.hasMore;
            resultPageLimit = Math.max(
                Number(paginationState.pageSize),
                previewRows.length);
            state.loadedResultCount =
                previewRows.length;
            state.resultPageSize =
                Number(paginationState.pageSize);
            state.resultPageLimit = resultPageLimit;
            state.resultHasMore = resultHasMore;
            if (paginationState.repositoryMode === "number") {
                numberPagerState.currentPage =
                    Number(paginationState.pageNumber);
                numberPagerState.totalPages =
                    Number(paginationState.totalPages);
                numberPagerState.totalCount =
                    Number(paginationState.totalCount);
                numberPagerState.selectedPage =
                    Number(paginationState.pageNumber);
            }
            return {
                rows: rows,
                appendedRows: appendedRows,
                allRows: previewRows.slice(0),
                options: options,
                hasMore: paginationState.hasMore,
                endCursor: paginationState.endCursor,
                totalCount:
                    Number(paginationState.totalCount),
                totalPages:
                    Number(paginationState.totalPages),
                pageNumber:
                    Number(paginationState.pageNumber),
                pagination: copyPaginationState()
            };
        } catch (error) {
            paginationState.lastError = String(error);
            ajaxFooterState.lastError = String(error);
            numberPagerState.lastError = String(error);
            throw error;
        }
    }

    function onPaginationSettingsChanged() {
        var action;
        if (!ready) { return; }
        action = mutationAction(
            "pagination_settings_changed", null);
        mutationState.eventCount += 1;
        paginationState.settingsEventCount += 1;
        mutationState.settingsChangeCount += 1;
        rememberMutationRefresh(
            "pagination_settings_changed", action,
            "pagination_settings_changed", true);
        syncPaginationSettings(
            "pagination_settings_changed");
        markPanelDataDirty(
            "pagination_settings_changed");
        if (state.panelAttached) {
            scheduleCoalescedRefresh(
                "pagination_settings_changed");
        }
    }

    function loadedResultIds() {
        var ids = [];
        var index;
        for (index = 0; index < previewRows.length;
                index += 1) {
            ids.push(Number(previewRows[index].id));
        }
        return ids;
    }

    function isDataWindowStub(row) {
        return row !== null && row !== undefined &&
            row.__clipHubDehydrated === true;
    }

    function dataWindowBlockSize() {
        var visible = Math.max(1,
            Number(virtualState.visibleCount || 1));
        return Math.max(DATA_BLOCK_MIN_ROWS,
            Math.min(DATA_BLOCK_MAX_ROWS,
                Math.ceil(visible *
                    DATA_BLOCK_VISIBLE_MULTIPLIER)));
    }

    function updateDataWindowCounts() {
        var hydrated = 0;
        var dehydrated = 0;
        var hydratedBlocks = {};
        var hydratedBlockCount = 0;
        var blockSize = dataWindowBlockSize();
        var index;
        var key;
        dataWindowState.blockSize = blockSize;
        dataWindowState.blockCount = previewRows.length > 0 ?
            Math.ceil(previewRows.length / blockSize) : 0;
        for (index = 0; index < previewRows.length; index += 1) {
            if (isDataWindowStub(previewRows[index])) {
                dehydrated += 1;
            } else {
                hydrated += 1;
                hydratedBlocks[String(Math.floor(
                    index / blockSize))] = true;
            }
        }
        for (key in hydratedBlocks) {
            if (hydratedBlocks.hasOwnProperty(key)) {
                hydratedBlockCount += 1;
            }
        }
        dataWindowState.hydratedRowCount = hydrated;
        dataWindowState.dehydratedRowCount = dehydrated;
        dataWindowState.hydratedBlockCount = hydratedBlockCount;
        return dataWindowState;
    }

    function copyDataWindowState() {
        updateDataWindowCounts();
        return {
            blockSize: Number(dataWindowState.blockSize),
            blockCount: Number(dataWindowState.blockCount),
            hydratedBlockCount:
                Number(dataWindowState.hydratedBlockCount),
            loadedDataCount: previewRows.length,
            hydratedRowCount:
                Number(dataWindowState.hydratedRowCount),
            dehydratedRowCount:
                Number(dataWindowState.dehydratedRowCount),
            hydrationPassCount:
                Number(dataWindowState.hydrationPassCount),
            dehydrationPassCount:
                Number(dataWindowState.dehydrationPassCount),
            hydrateQueryCount:
                Number(dataWindowState.hydrateQueryCount),
            tagQueryCount:
                Number(dataWindowState.tagQueryCount),
            hydratedRowTotal:
                Number(dataWindowState.hydratedRowTotal),
            dehydratedRowTotal:
                Number(dataWindowState.dehydratedRowTotal),
            missingIdCount:
                Number(dataWindowState.missingIdCount),
            resetCount: Number(dataWindowState.resetCount),
            keepStartIndex:
                Number(dataWindowState.keepStartIndex),
            keepEndIndex:
                Number(dataWindowState.keepEndIndex),
            lastHydrateStartIndex:
                Number(dataWindowState.lastHydrateStartIndex),
            lastHydrateEndIndex:
                Number(dataWindowState.lastHydrateEndIndex),
            keepBeforeBlocks: DATA_BLOCK_KEEP_BEFORE,
            keepAfterBlocks: DATA_BLOCK_KEEP_AFTER,
            lastOrigin: dataWindowState.lastOrigin,
            lastError: dataWindowState.lastError
        };
    }

    function copyMutationState() {
        return {
            eventCount: Number(mutationState.eventCount),
            refreshRequestCount:
                Number(mutationState.refreshRequestCount),
            refreshCount: Number(mutationState.refreshCount),
            coalescedCount: Number(mutationState.coalescedCount),
            addedPendingCount:
                Number(mutationState.addedPendingCount),
            relatedEventSuppressedCount:
                Number(mutationState.relatedEventSuppressedCount),
            settingsChangeCount:
                Number(mutationState.settingsChangeCount),
            anchorRestoreCount:
                Number(mutationState.anchorRestoreCount),
            anchorFallbackCount:
                Number(mutationState.anchorFallbackCount),
            pending: mutationRefreshPlan !== null,
            anchorLocked: mutationAnchorLocked === true,
            pendingNewItemId: pendingNewItemId,
            lastEventName: mutationState.lastEventName,
            lastAction: mutationState.lastAction,
            lastOrigin: mutationState.lastOrigin,
            lastModeBefore: mutationState.lastModeBefore,
            lastModeAfter: mutationState.lastModeAfter,
            lastPageNumberBefore:
                Number(mutationState.lastPageNumberBefore),
            lastPageNumberAfter:
                Number(mutationState.lastPageNumberAfter),
            lastLoadedCountBefore:
                Number(mutationState.lastLoadedCountBefore),
            lastLoadedCountAfter:
                Number(mutationState.lastLoadedCountAfter),
            lastReloadPageCount:
                Number(mutationState.lastReloadPageCount),
            lastAnchorItemIdBefore:
                mutationState.lastAnchorItemIdBefore,
            lastAnchorItemIdAfter:
                mutationState.lastAnchorItemIdAfter,
            lastAnchorIndexBefore:
                Number(mutationState.lastAnchorIndexBefore),
            lastAnchorIndexAfter:
                Number(mutationState.lastAnchorIndexAfter),
            lastAnchorOffsetPxBefore:
                Number(mutationState.lastAnchorOffsetPxBefore),
            lastAnchorOffsetPxAfter:
                Number(mutationState.lastAnchorOffsetPxAfter),
            lastAnchorRestoreErrorPx:
                Number(mutationState.lastAnchorRestoreErrorPx),
            lastPositionPreserved:
                mutationState.lastPositionPreserved === true,
            lastError: mutationState.lastError
        };
    }

    function resetMutationState() {
        pendingNewItemId = null;
        mutationRefreshPlan = null;
        mutationAnchorLocked = false;
        mutationState.eventCount = 0;
        mutationState.refreshRequestCount = 0;
        mutationState.refreshCount = 0;
        mutationState.coalescedCount = 0;
        mutationState.addedPendingCount = 0;
        mutationState.relatedEventSuppressedCount = 0;
        mutationState.settingsChangeCount = 0;
        mutationState.anchorRestoreCount = 0;
        mutationState.anchorFallbackCount = 0;
        mutationState.lastEventName = "";
        mutationState.lastAction = "";
        mutationState.lastOrigin = "";
        mutationState.lastModeBefore = "";
        mutationState.lastModeAfter = "";
        mutationState.lastPageNumberBefore = 1;
        mutationState.lastPageNumberAfter = 1;
        mutationState.lastLoadedCountBefore = 0;
        mutationState.lastLoadedCountAfter = 0;
        mutationState.lastReloadPageCount = 0;
        mutationState.lastAnchorItemIdBefore = null;
        mutationState.lastAnchorItemIdAfter = null;
        mutationState.lastAnchorIndexBefore = -1;
        mutationState.lastAnchorIndexAfter = -1;
        mutationState.lastAnchorOffsetPxBefore = 0;
        mutationState.lastAnchorOffsetPxAfter = 0;
        mutationState.lastAnchorRestoreErrorPx = 0;
        mutationState.lastPositionPreserved = true;
        mutationState.lastError = null;
        return copyMutationState();
    }

    function mutationAction(eventName, payload) {
        var action = payload ? String(payload.action ||
            payload.status || payload.mutation || "") : "";
        if (action.length > 0) { return action; }
        eventName = String(eventName || "");
        if (eventName === "clipboard_deleted") { return "deleted"; }
        if (eventName === "clipboard_restored") { return "restored"; }
        if (eventName === "clipboard_merged") { return "merged"; }
        if (eventName === "tags_changed") { return "tags_changed"; }
        if (eventName === "pagination_settings_changed") {
            return "settings_changed";
        }
        return eventName;
    }

    function rememberMutationRefresh(eventName, action,
            origin, settingsChanged) {
        var plan = mutationRefreshPlan;
        if (plan === null) {
            plan = {
                eventName: String(eventName || "mutation"),
                action: String(action || "changed"),
                origin: String(origin || "mutation_refresh"),
                modeBefore: paginationState.mode,
                pageSizeBefore: Number(paginationState.pageSize),
                pageNumberBefore: Number(paginationState.pageNumber),
                loadedCountBefore: previewRows.length,
                anchorItemId: virtualState.anchorItemId,
                anchorIndex: Number(virtualState.anchorIndex),
                anchorOffsetPx: Number(virtualState.anchorOffsetPx),
                newContentPending:
                    paginationState.newContentPending === true,
                settingsChanged: settingsChanged === true,
                criteriaChanged: false,
                rebuildStructure:
                    String(eventName) === "tags_changed"
            };
            mutationRefreshPlan = plan;
        } else {
            plan.eventName = String(eventName || plan.eventName);
            plan.action = String(action || plan.action);
            plan.origin = String(origin || plan.origin);
            plan.settingsChanged = plan.settingsChanged === true ||
                settingsChanged === true;
            plan.rebuildStructure = plan.rebuildStructure === true ||
                String(eventName) === "tags_changed";
            mutationState.coalescedCount += 1;
        }
        mutationState.refreshRequestCount += 1;
        mutationState.lastEventName = plan.eventName;
        mutationState.lastAction = plan.action;
        mutationState.lastOrigin = plan.origin;
        return plan;
    }

    function cancelMutationRefresh(origin) {
        mutationRefreshPlan = null;
        mutationState.lastOrigin = String(origin ||
            "mutation_refresh_cancelled");
        return true;
    }

    function mutationGlobalAnchorIndex(plan) {
        var index = Math.max(0, Number(plan.anchorIndex));
        if (String(plan.modeBefore) === "number") {
            index += (Math.max(1,
                Number(plan.pageNumberBefore)) - 1) *
                Math.max(1, Number(plan.pageSizeBefore));
        }
        return index;
    }

    function refreshMutationResultsOnMain(origin) {
        var plan = mutationRefreshPlan;
        var pendingBefore;
        var quickBefore;
        var globalAnchorIndex;
        var targetPage = 1;
        var targetLoaded;
        var reloadPages = 0;
        var anchorFound;
        var fallbackIndex;
        var beforeItemId;
        var beforeIndex;
        var beforeOffset;
        var afterItemId;
        var afterIndex;
        var positionPreserved;
        if (plan === null) {
            plan = rememberMutationRefresh(
                "manual", "changed",
                origin || "manual_mutation_refresh", false);
        }
        try {
            if (state.panelAttached) {
                captureScrollAnchor();
            }
            if (virtualState.anchorItemId !== null) {
                plan.anchorItemId = virtualState.anchorItemId;
                plan.anchorIndex = Number(virtualState.anchorIndex);
                plan.anchorOffsetPx = Number(
                    virtualState.anchorOffsetPx);
            }
            beforeItemId = plan.anchorItemId;
            beforeIndex = Number(plan.anchorIndex);
            beforeOffset = Number(plan.anchorOffsetPx);
            pendingBefore = paginationState.newContentPending === true ||
                plan.newContentPending === true;
            quickBefore = paginationState.quickResetAvailable === true;
            globalAnchorIndex = mutationGlobalAnchorIndex(plan);
            mutationState.lastModeBefore = String(plan.modeBefore);
            mutationState.lastPageNumberBefore =
                Number(plan.pageNumberBefore);
            mutationState.lastLoadedCountBefore =
                Number(plan.loadedCountBefore);
            mutationState.lastAnchorItemIdBefore = beforeItemId;
            mutationState.lastAnchorIndexBefore = beforeIndex;
            mutationState.lastAnchorOffsetPxBefore = beforeOffset;
            mutationRefreshPlan = null;
            mutationAnchorLocked = true;
            clearPrefetchedPage(
                origin || "mutation_refresh");
            resetUnifiedPagination(
                origin || "mutation_refresh");
            if (paginationState.mode === "number") {
                targetPage = plan.criteriaChanged === true ? 1 :
                    (plan.settingsChanged === true ?
                    Math.floor(globalAnchorIndex /
                        Math.max(1,
                            Number(paginationState.pageSize))) + 1 :
                    Math.max(1, Number(plan.pageNumberBefore)));
                loadPaginationPageInternal({
                    append: false,
                    page: targetPage,
                    includeTotal: true
                });
                reloadPages = 1;
                if (plan.criteriaChanged === true &&
                        beforeItemId !== null) {
                    while (virtualRowIndexById(beforeItemId) < 0 &&
                            targetPage < Number(
                                paginationState.totalPages) &&
                            reloadPages <
                                MUTATION_RELOAD_PAGE_LIMIT) {
                        targetPage += 1;
                        loadPaginationPageInternal({
                            append: false,
                            page: targetPage,
                            includeTotal: true
                        });
                        reloadPages += 1;
                    }
                    if (virtualRowIndexById(beforeItemId) < 0 &&
                            targetPage !== 1) {
                        targetPage = 1;
                        loadPaginationPageInternal({
                            append: false,
                            page: 1,
                            includeTotal: true
                        });
                        reloadPages += 1;
                    }
                }
                fallbackIndex = plan.settingsChanged === true ?
                    globalAnchorIndex % Math.max(1,
                        Number(paginationState.pageSize)) :
                    beforeIndex;
            } else {
                loadPaginationPageInternal({
                    append: false,
                    includeTotal: true
                });
                reloadPages = 1;
                targetLoaded = Math.max(
                    Number(paginationState.pageSize),
                    Number(plan.loadedCountBefore));
                if (plan.settingsChanged === true) {
                    targetLoaded = Math.max(targetLoaded,
                        globalAnchorIndex + 1);
                }
                while ((previewRows.length < targetLoaded ||
                        (plan.criteriaChanged === true &&
                            beforeItemId !== null &&
                            virtualRowIndexById(beforeItemId) < 0)) &&
                        paginationState.hasMore === true &&
                        reloadPages < MUTATION_RELOAD_PAGE_LIMIT) {
                    loadPaginationPageInternal({
                        append: true,
                        includeTotal: false
                    });
                    reloadPages += 1;
                }
                fallbackIndex = plan.settingsChanged === true ?
                    globalAnchorIndex : beforeIndex;
            }
            paginationState.newContentPending = pendingBefore;
            paginationState.quickResetAvailable =
                pendingBefore || quickBefore;
            virtualState.anchorItemId = beforeItemId;
            virtualState.anchorIndex = fallbackIndex;
            virtualState.anchorOffsetPx = beforeOffset;
            virtualState.scrollToTopPending = false;
            if (state.panelAttached) {
                if (plan.rebuildStructure === true ||
                        panelStructureDirty === true ||
                        resultContainer === null) {
                    buildPanelContent(false);
                    panelStructureDirty = false;
                    state.panelStructureDirty = false;
                } else {
                    refreshResultsOnMain();
                    updateResultCountOnMain();
                }
                restoreScrollAnchor();
                updateQuickResetView();
            }
            mutationAnchorLocked = false;
            anchorFound = beforeItemId !== null &&
                virtualRowIndexById(beforeItemId) >= 0;
            afterItemId = virtualState.anchorItemId;
            afterIndex = Number(virtualState.anchorIndex);
            positionPreserved = beforeItemId === null ?
                afterItemId === null :
                (anchorFound ?
                    Number(afterItemId) === Number(beforeItemId) :
                    Math.abs(afterIndex - fallbackIndex) <= 1);
            if (anchorFound && positionPreserved) {
                mutationState.anchorRestoreCount += 1;
            } else if (!anchorFound) {
                mutationState.anchorFallbackCount += 1;
            }
            mutationState.refreshCount += 1;
            mutationState.lastOrigin = String(origin || plan.origin);
            mutationState.lastModeAfter = paginationState.mode;
            mutationState.lastPageNumberAfter =
                Number(paginationState.pageNumber);
            mutationState.lastLoadedCountAfter = previewRows.length;
            mutationState.lastReloadPageCount = reloadPages;
            mutationState.lastAnchorItemIdAfter = afterItemId;
            mutationState.lastAnchorIndexAfter = afterIndex;
            mutationState.lastAnchorOffsetPxAfter =
                Number(virtualState.anchorOffsetPx);
            mutationState.lastAnchorRestoreErrorPx =
                Number(virtualState.anchorRestoreErrorPx);
            mutationState.lastPositionPreserved =
                positionPreserved === true;
            mutationState.lastError = null;
            panelDataDirty = false;
            state.panelDataDirty = false;
            return copyMutationState();
        } catch (error) {
            mutationAnchorLocked = false;
            mutationState.lastError = String(error);
            state.lastError = String(error);
            mutationRefreshPlan = null;
            throw error;
        }
    }

    function resetDataWindowState(clearTags) {
        dataWindowState.blockSize = dataWindowBlockSize();
        dataWindowState.blockCount = 0;
        dataWindowState.hydratedBlockCount = 0;
        dataWindowState.hydratedRowCount = previewRows.length;
        dataWindowState.dehydratedRowCount = 0;
        dataWindowState.hydrationPassCount = 0;
        dataWindowState.dehydrationPassCount = 0;
        dataWindowState.hydrateQueryCount = 0;
        dataWindowState.tagQueryCount = 0;
        dataWindowState.hydratedRowTotal = 0;
        dataWindowState.dehydratedRowTotal = 0;
        dataWindowState.missingIdCount = 0;
        dataWindowState.resetCount += 1;
        dataWindowState.keepStartIndex = 0;
        dataWindowState.keepEndIndex = -1;
        dataWindowState.lastHydrateStartIndex = 0;
        dataWindowState.lastHydrateEndIndex = -1;
        dataWindowState.lastOrigin = "data_window_reset";
        dataWindowState.lastError = null;
        dataTagLoadedById = {};
        if (clearTags === true) {
            resultTagMap = {};
        }
        return copyDataWindowState();
    }

    function dataWindowStub(itemId) {
        return {
            id: Number(itemId),
            __clipHubDehydrated: true
        };
    }

    function removeMissingDataWindowIds(missingById) {
        var next = [];
        var index;
        var key;
        var removed = 0;
        for (index = 0; index < previewRows.length; index += 1) {
            key = String(Number(previewRows[index].id));
            if (missingById[key] === true) {
                delete resultTagMap[key];
                delete dataTagLoadedById[key];
                delete virtualState.heightById[key];
                removed += 1;
            } else {
                next.push(previewRows[index]);
            }
        }
        if (removed > 0) {
            previewRows = next;
            paginationState.loadedCount = previewRows.length;
            paginationState.totalCount = Math.max(
                previewRows.length,
                Number(paginationState.totalCount) - removed);
            paginationState.totalPages =
                paginationState.totalCount > 0 ?
                    Math.ceil(paginationState.totalCount /
                        Math.max(1,
                            Number(paginationState.pageSize))) : 0;
            state.loadedResultCount = previewRows.length;
            state.lastResultCount = previewRows.length;
            resultPageLimit = Math.max(
                Number(paginationState.pageSize),
                previewRows.length);
            state.resultPageLimit = resultPageLimit;
            if (ClipHub.List &&
                    typeof ClipHub.List.setItems === "function") {
                ClipHub.List.setItems(previewRows);
            }
        }
        return removed;
    }


    var hydrationLatestRequestRef =
        new Packages.java.util.concurrent.atomic.AtomicReference();
    var hydrationWorkerBusyFlag =
        new Packages.java.util.concurrent.atomic.AtomicBoolean(false);
    var hydrationWorkerStoppingFlag =
        new Packages.java.util.concurrent.atomic.AtomicBoolean(false);
    var hydrationRequestSequence =
        new Packages.java.util.concurrent.atomic.AtomicLong(0);
    var hydrationEpochSequence =
        new Packages.java.util.concurrent.atomic.AtomicLong(0);
    var hydrationResultQueue =
        new Packages.java.util.concurrent.ConcurrentLinkedQueue();
    var hydrationExecutor = null;
    var hydrationActiveFuture = null;
    var hydrationApplyRunnable = null;
    var hydrationWorkerState = {
        enabled: true,
        requestCount: 0,
        queryCount: 0,
        successCount: 0,
        failureCount: 0,
        latestRequestReplaceCount: 0,
        staleResultDropCount: 0,
        postCloseDropCount: 0,
        workerQueryLastMs: 0,
        workerQueryMaxMs: 0,
        mainApplyLastMs: 0,
        mainApplyMaxMs: 0,
        visualForceCount: 0,
        visualDeltaCount: 0,
        lastRequestId: 0,
        lastOrigin: "",
        lastError: null,
        lastInvalidateReason: "",
        pendingSignature: null
    };
    var scrollPerformanceState = {
        scrollEventCount: 0,
        virtualScheduleCount: 0,
        virtualUpdateCount: 0,
        virtualUpdateLastMs: 0,
        virtualUpdateMaxMs: 0,
        viewRebuildCount: 0,
        viewRebuildLastMs: 0,
        viewRebuildMaxMs: 0,
        createdViewCount: 0,
        removedViewCount: 0,
        hydrateRequestedCount: 0,
        updateRequestCount: 0,
        updateCoalescedCount: 0,
        forceEscalationCount: 0,
        keyedReconcileCount: 0,
        sameIdReuseCount: 0,
        signatureRebuildCount: 0,
        movedViewCount: 0,
        structuralInsertCount: 0,
        structuralRemoveCount: 0,
        alignmentFallbackCount: 0,
        spacerApplyCount: 0,
        spacerNoopCount: 0,
        sameRangeNoLayoutCount: 0,
        anchorScrollApplyCount: 0,
        anchorScrollNoopCount: 0,
        measurePassCount: 0,
        measureLastMs: 0,
        measureMaxMs: 0,
        keyedReconcileLastMs: 0,
        keyedReconcileMaxMs: 0,
        keyedSignatureLastMs: 0,
        keyedSignatureMaxMs: 0,
        keyedStructureLastMs: 0,
        keyedStructureMaxMs: 0,
        overlapUpdateLastMs: 0,
        overlapUpdateMaxMs: 0,
        slowRebuildCount: 0,
        slowRebuildSamples: []
    };

    function resetHydrationWorkerDiagnostics() {
        hydrationWorkerStoppingFlag.set(false);
        hydrationLatestRequestRef.set(null);
        hydrationResultQueue.clear();
        hydrationWorkerBusyFlag.set(false);
        hydrationWorkerState.enabled = true;
        hydrationWorkerState.requestCount = 0;
        hydrationWorkerState.queryCount = 0;
        hydrationWorkerState.successCount = 0;
        hydrationWorkerState.failureCount = 0;
        hydrationWorkerState.latestRequestReplaceCount = 0;
        hydrationWorkerState.staleResultDropCount = 0;
        hydrationWorkerState.postCloseDropCount = 0;
        hydrationWorkerState.workerQueryLastMs = 0;
        hydrationWorkerState.workerQueryMaxMs = 0;
        hydrationWorkerState.mainApplyLastMs = 0;
        hydrationWorkerState.mainApplyMaxMs = 0;
        hydrationWorkerState.lastRequestId = 0;
        hydrationWorkerState.lastOrigin = "";
        hydrationWorkerState.lastError = null;
        hydrationWorkerState.lastInvalidateReason = "";
        hydrationWorkerState.pendingSignature = null;
        scrollPerformanceState.scrollEventCount = 0;
        scrollPerformanceState.virtualScheduleCount = 0;
        scrollPerformanceState.virtualUpdateCount = 0;
        scrollPerformanceState.virtualUpdateLastMs = 0;
        scrollPerformanceState.virtualUpdateMaxMs = 0;
        scrollPerformanceState.viewRebuildCount = 0;
        scrollPerformanceState.viewRebuildLastMs = 0;
        scrollPerformanceState.viewRebuildMaxMs = 0;
        scrollPerformanceState.createdViewCount = 0;
        scrollPerformanceState.removedViewCount = 0;
        scrollPerformanceState.hydrateRequestedCount = 0;
        scrollPerformanceState.updateRequestCount = 0;
        scrollPerformanceState.updateCoalescedCount = 0;
        scrollPerformanceState.forceEscalationCount = 0;
        scrollPerformanceState.keyedReconcileCount = 0;
        scrollPerformanceState.sameIdReuseCount = 0;
        scrollPerformanceState.signatureRebuildCount = 0;
        scrollPerformanceState.movedViewCount = 0;
        scrollPerformanceState.structuralInsertCount = 0;
        scrollPerformanceState.structuralRemoveCount = 0;
        scrollPerformanceState.alignmentFallbackCount = 0;
        scrollPerformanceState.spacerApplyCount = 0;
        scrollPerformanceState.spacerNoopCount = 0;
        scrollPerformanceState.sameRangeNoLayoutCount = 0;
        scrollPerformanceState.anchorScrollApplyCount = 0;
        scrollPerformanceState.anchorScrollNoopCount = 0;
        scrollPerformanceState.measurePassCount = 0;
        scrollPerformanceState.measureLastMs = 0;
        scrollPerformanceState.measureMaxMs = 0;
        scrollPerformanceState.keyedReconcileLastMs = 0;
        scrollPerformanceState.keyedReconcileMaxMs = 0;
        scrollPerformanceState.keyedSignatureLastMs = 0;
        scrollPerformanceState.keyedSignatureMaxMs = 0;
        scrollPerformanceState.keyedStructureLastMs = 0;
        scrollPerformanceState.keyedStructureMaxMs = 0;
        scrollPerformanceState.overlapUpdateLastMs = 0;
        scrollPerformanceState.overlapUpdateMaxMs = 0;
        scrollPerformanceState.slowRebuildCount = 0;
        scrollPerformanceState.slowRebuildSamples = [];
        virtualPendingOrigin = "";
        virtualPendingForce = false;
    }

    function copyHydrationWorkerState() {
        return {
            enabled: hydrationWorkerState.enabled === true,
            executorCreated: hydrationExecutor !== null,
            workerBusy: hydrationWorkerBusyFlag.get() === true,
            requestCount: Number(hydrationWorkerState.requestCount),
            queryCount: Number(hydrationWorkerState.queryCount),
            successCount: Number(hydrationWorkerState.successCount),
            failureCount: Number(hydrationWorkerState.failureCount),
            latestRequestReplaceCount:
                Number(hydrationWorkerState.latestRequestReplaceCount),
            staleResultDropCount:
                Number(hydrationWorkerState.staleResultDropCount),
            postCloseDropCount:
                Number(hydrationWorkerState.postCloseDropCount),
            workerQueryLastMs:
                Number(hydrationWorkerState.workerQueryLastMs),
            workerQueryMaxMs:
                Number(hydrationWorkerState.workerQueryMaxMs),
            mainApplyLastMs:
                Number(hydrationWorkerState.mainApplyLastMs),
            mainApplyMaxMs:
                Number(hydrationWorkerState.mainApplyMaxMs),
            lastRequestId: Number(hydrationWorkerState.lastRequestId),
            lastOrigin: hydrationWorkerState.lastOrigin,
            lastError: hydrationWorkerState.lastError,
            hydrationEpoch: Number(hydrationEpochSequence.get()),
            lastInvalidateReason:
                hydrationWorkerState.lastInvalidateReason
        };
    }

    function copyScrollPerformanceState() {
        return {
            scrollEventCount:
                Number(scrollPerformanceState.scrollEventCount),
            virtualScheduleCount:
                Number(scrollPerformanceState.virtualScheduleCount),
            virtualUpdateCount:
                Number(scrollPerformanceState.virtualUpdateCount),
            virtualUpdateLastMs:
                Number(scrollPerformanceState.virtualUpdateLastMs),
            virtualUpdateMaxMs:
                Number(scrollPerformanceState.virtualUpdateMaxMs),
            viewRebuildCount:
                Number(scrollPerformanceState.viewRebuildCount),
            viewRebuildLastMs:
                Number(scrollPerformanceState.viewRebuildLastMs),
            viewRebuildMaxMs:
                Number(scrollPerformanceState.viewRebuildMaxMs),
            createdViewCount:
                Number(scrollPerformanceState.createdViewCount),
            removedViewCount:
                Number(scrollPerformanceState.removedViewCount),
            hydrateRequestedCount:
                Number(scrollPerformanceState.hydrateRequestedCount),
            updateRequestCount:
                Number(scrollPerformanceState.updateRequestCount),
            updateCoalescedCount:
                Number(scrollPerformanceState.updateCoalescedCount),
            forceEscalationCount:
                Number(scrollPerformanceState.forceEscalationCount),
            keyedReconcileCount:
                Number(scrollPerformanceState.keyedReconcileCount),
            sameIdReuseCount:
                Number(scrollPerformanceState.sameIdReuseCount),
            signatureRebuildCount:
                Number(scrollPerformanceState.signatureRebuildCount),
            movedViewCount:
                Number(scrollPerformanceState.movedViewCount),
            structuralInsertCount:
                Number(scrollPerformanceState.structuralInsertCount),
            structuralRemoveCount:
                Number(scrollPerformanceState.structuralRemoveCount),
            alignmentFallbackCount:
                Number(scrollPerformanceState.alignmentFallbackCount),
            spacerApplyCount:
                Number(scrollPerformanceState.spacerApplyCount),
            spacerNoopCount:
                Number(scrollPerformanceState.spacerNoopCount),
            sameRangeNoLayoutCount:
                Number(scrollPerformanceState.sameRangeNoLayoutCount),
            anchorScrollApplyCount:
                Number(scrollPerformanceState.anchorScrollApplyCount),
            anchorScrollNoopCount:
                Number(scrollPerformanceState.anchorScrollNoopCount),
            measurePassCount:
                Number(scrollPerformanceState.measurePassCount),
            measureLastMs:
                Number(scrollPerformanceState.measureLastMs),
            measureMaxMs:
                Number(scrollPerformanceState.measureMaxMs),
            keyedReconcileLastMs:
                Number(scrollPerformanceState.keyedReconcileLastMs),
            keyedReconcileMaxMs:
                Number(scrollPerformanceState.keyedReconcileMaxMs),
            keyedSignatureLastMs:
                Number(scrollPerformanceState.keyedSignatureLastMs),
            keyedSignatureMaxMs:
                Number(scrollPerformanceState.keyedSignatureMaxMs),
            keyedStructureLastMs:
                Number(scrollPerformanceState.keyedStructureLastMs),
            keyedStructureMaxMs:
                Number(scrollPerformanceState.keyedStructureMaxMs),
            overlapUpdateLastMs:
                Number(scrollPerformanceState.overlapUpdateLastMs),
            overlapUpdateMaxMs:
                Number(scrollPerformanceState.overlapUpdateMaxMs),
            slowRebuildCount:
                Number(scrollPerformanceState.slowRebuildCount),
            slowRebuildSamples:
                scrollPerformanceState.slowRebuildSamples.slice(0),
            pendingOrigin: virtualPendingOrigin,
            pendingForce: virtualPendingForce === true
        };
    }

    function invalidateHydrationWorker(reason) {
        hydrationEpochSequence.incrementAndGet();
        hydrationLatestRequestRef.set(null);
        hydrationWorkerState.pendingSignature = null;
        hydrationWorkerState.lastInvalidateReason =
            String(reason || "invalidate");
        return Number(hydrationEpochSequence.get());
    }

    function ensureHydrationWorker() {
        if (hydrationWorkerStoppingFlag.get() === true ||
                !hydrationWorkerState.enabled) {
            return false;
        }
        if (hydrationExecutor === null ||
                hydrationExecutor.isShutdown() ||
                hydrationExecutor.isTerminated()) {
            hydrationExecutor =
                Packages.java.util.concurrent.Executors
                    .newSingleThreadExecutor();
        }
        if (hydrationApplyRunnable === null) {
            hydrationApplyRunnable = new Packages.java.lang.Runnable({
                run: function () {
                    drainHydrationResultsOnMain();
                }
            });
        }
        return true;
    }

    function findPreviewRowIndexByIdForHydration(itemId) {
        var index;
        for (index = 0; index < previewRows.length; index += 1) {
            if (Number(previewRows[index].id) === Number(itemId)) {
                return index;
            }
        }
        return -1;
    }

    function hydrationRequestSignature(request) {
        return [
            Number(request.hydrationEpoch),
            Number(request.queryGeneration),
            Number(request.renderGeneration),
            Number(request.startIndex),
            Number(request.endIndex),
            request.ids.join(","),
            request.tagIds.join(",")
        ].join("|");
    }

    function collectHydrationRequest(startIndex, endIndex, origin) {
        var start;
        var end;
        var ids = [];
        var tagIds = [];
        var seenIds = {};
        var seenTagIds = {};
        var index;
        var row;
        var key;
        var request;
        if (previewRows.length === 0) { return null; }
        start = Math.max(0, Math.min(
            previewRows.length - 1,
            Math.floor(Number(startIndex || 0))));
        end = Math.max(start, Math.min(
            previewRows.length - 1,
            Math.floor(Number(endIndex))));
        for (index = start; index <= end; index += 1) {
            row = previewRows[index];
            if (row === null || row === undefined) { continue; }
            key = String(Number(row.id));
            if (isDataWindowStub(row) && seenIds[key] !== true) {
                seenIds[key] = true;
                ids.push(Number(row.id));
            }
            if (dataTagLoadedById[key] !== true &&
                    seenTagIds[key] !== true) {
                seenTagIds[key] = true;
                tagIds.push(Number(row.id));
            }
        }
        if (ids.length === 0 && tagIds.length === 0) {
            return null;
        }
        request = {
            requestId: Number(hydrationRequestSequence.incrementAndGet()),
            hydrationEpoch: Number(hydrationEpochSequence.get()),
            queryGeneration: Number(paginationState.queryGeneration),
            renderGeneration: Number(renderGeneration),
            startIndex: start,
            endIndex: end,
            ids: ids,
            tagIds: tagIds,
            origin: String(origin || "virtual_scroll")
        };
        request.signature = hydrationRequestSignature(request);
        return request;
    }

    function postHydrationResult(resultJson) {
        hydrationResultQueue.offer(
            new Packages.java.lang.String(String(resultJson)));
        if (mainHandler !== null && hydrationApplyRunnable !== null) {
            mainHandler.post(hydrationApplyRunnable);
        }
    }

    function queryHydrationRequest(requestJson) {
        var request = JSON.parse(String(requestJson));
        var rows = [];
        var tags = {};
        var startedAt = Number(System.currentTimeMillis());
        var finishedAt;
        var error = null;
        try {
            if (request.ids.length > 0) {
                if (!ClipHub.Repository ||
                        typeof ClipHub.Repository.listItemsByIds !==
                            "function") {
                    throw new Error(
                        "Repository.listItemsByIds unavailable");
                }
                rows = ClipHub.Repository.listItemsByIds(
                    request.ids, true);
            }
            if (request.tagIds.length > 0) {
                if (!ClipHub.Repository ||
                        typeof ClipHub.Repository.listItemTagMap !==
                            "function") {
                    throw new Error(
                        "Repository.listItemTagMap unavailable");
                }
                tags = ClipHub.Repository.listItemTagMap(
                    request.tagIds);
            }
        } catch (queryError) {
            error = String(queryError);
        }
        finishedAt = Number(System.currentTimeMillis());
        return JSON.stringify({
            requestId: Number(request.requestId),
            hydrationEpoch: Number(request.hydrationEpoch),
            queryGeneration: Number(request.queryGeneration),
            renderGeneration: Number(request.renderGeneration),
            startIndex: Number(request.startIndex),
            endIndex: Number(request.endIndex),
            ids: request.ids,
            tagIds: request.tagIds,
            rows: rows,
            tags: tags,
            origin: request.origin,
            startedAt: startedAt,
            finishedAt: finishedAt,
            queryMs: Math.max(0, finishedAt - startedAt),
            error: error
        });
    }

    function runHydrationWorkerLoop() {
        var requestJson;
        var resultJson;
        while (hydrationWorkerStoppingFlag.get() !== true) {
            requestJson = hydrationLatestRequestRef.getAndSet(null);
            if (requestJson === null) {
                hydrationWorkerBusyFlag.set(false);
                if (hydrationLatestRequestRef.get() !== null &&
                        hydrationWorkerBusyFlag.compareAndSet(
                            false, true)) {
                    continue;
                }
                return;
            }
            resultJson = queryHydrationRequest(String(requestJson));
            postHydrationResult(resultJson);
        }
        hydrationWorkerBusyFlag.set(false);
    }

    function submitHydrationRequest(request) {
        var previous;
        var runnable;
        if (request === null || request === undefined) {
            return false;
        }
        if (!ensureHydrationWorker()) { return false; }
        if (hydrationWorkerState.pendingSignature ===
                request.signature) {
            return false;
        }
        previous = hydrationLatestRequestRef.getAndSet(
            new Packages.java.lang.String(JSON.stringify(request)));
        if (previous !== null) {
            hydrationWorkerState.latestRequestReplaceCount += 1;
        }
        hydrationWorkerState.pendingSignature = request.signature;
        hydrationWorkerState.requestCount += 1;
        hydrationWorkerState.queryCount += 1;
        hydrationWorkerState.lastRequestId =
            Number(request.requestId);
        hydrationWorkerState.lastOrigin = request.origin;
        hydrationWorkerState.lastError = null;
        scrollPerformanceState.hydrateRequestedCount +=
            request.ids.length;
        if (request.ids.length > 0) {
            dataWindowState.hydrateQueryCount += 1;
        }
        if (request.tagIds.length > 0) {
            dataWindowState.tagQueryCount += 1;
        }
        if (hydrationWorkerBusyFlag.compareAndSet(false, true)) {
            runnable = new Packages.java.lang.Runnable({
                run: function () {
                    runHydrationWorkerLoop();
                }
            });
            hydrationActiveFuture =
                hydrationExecutor.submit(runnable);
        }
        return true;
    }

    function clearPendingHydrationIfCurrent(result) {
        if (Number(result.requestId) ===
                Number(hydrationWorkerState.lastRequestId)) {
            hydrationWorkerState.pendingSignature = null;
        }
    }

    function dropHydrationResult(result, postClose) {
        clearPendingHydrationIfCurrent(result);
        hydrationWorkerState.staleResultDropCount += 1;
        if (postClose === true) {
            hydrationWorkerState.postCloseDropCount += 1;
        }
        return false;
    }


    function hydrationResultTouchesRendered(result) {
        var lists = [result.ids || [], result.tagIds || []];
        var listIndex;
        var itemIndex;
        var itemId;
        for (listIndex = 0; listIndex < lists.length; listIndex += 1) {
            for (itemIndex = 0;
                    itemIndex < lists[listIndex].length; itemIndex += 1) {
                itemId = Number(lists[listIndex][itemIndex]);
                if (virtualRenderedItemIds.indexOf(itemId) >= 0) {
                    return true;
                }
            }
        }
        return false;
    }

    function applyHydrationResult(resultJson) {
        var applyStartedAt = Number(System.currentTimeMillis());
        var result = JSON.parse(String(resultJson));
        var rows = result.rows || [];
        var byId = {};
        var missingById = {};
        var index;
        var currentIndex;
        var key;
        var hydrated = 0;
        var missing = 0;
        var elapsed;
        if (!hydrationWorkerState.enabled ||
                hydrationWorkerStoppingFlag.get() === true) {
            return dropHydrationResult(result, false);
        }
        if (Number(result.hydrationEpoch) !==
                Number(hydrationEpochSequence.get()) ||
                Number(result.queryGeneration) !==
                Number(paginationState.queryGeneration) ||
                Number(result.renderGeneration) !==
                Number(renderGeneration) ||
                Number(result.requestId) !==
                Number(hydrationWorkerState.lastRequestId)) {
            return dropHydrationResult(result, false);
        }
        if (!state.panelAttached) {
            return dropHydrationResult(result, true);
        }
        clearPendingHydrationIfCurrent(result);
        hydrationWorkerState.workerQueryLastMs =
            Number(result.queryMs || 0);
        hydrationWorkerState.workerQueryMaxMs = Math.max(
            Number(hydrationWorkerState.workerQueryMaxMs),
            Number(result.queryMs || 0));
        if (result.error !== null &&
                result.error !== undefined &&
                String(result.error).length > 0) {
            hydrationWorkerState.failureCount += 1;
            hydrationWorkerState.lastError = String(result.error);
            dataWindowState.lastError = String(result.error);
            return false;
        }
        for (index = 0; index < rows.length; index += 1) {
            byId[String(Number(rows[index].id))] = rows[index];
        }
        for (index = 0; index < result.ids.length; index += 1) {
            key = String(Number(result.ids[index]));
            currentIndex = findPreviewRowIndexByIdForHydration(
                Number(result.ids[index]));
            if (currentIndex < 0 ||
                    !isDataWindowStub(previewRows[currentIndex])) {
                continue;
            }
            if (byId[key]) {
                previewRows[currentIndex] = byId[key];
                hydrated += 1;
            } else {
                missingById[key] = true;
            }
        }
        for (key in missingById) {
            if (missingById.hasOwnProperty(key)) {
                missing += 1;
            }
        }
        if (missing > 0) {
            removeMissingDataWindowIds(missingById);
        }
        if (result.tags !== null && result.tags !== undefined) {
            resultTagMap = mergeItemTagMap(resultTagMap, result.tags);
        }
        for (index = 0; index < result.tagIds.length; index += 1) {
            currentIndex = findPreviewRowIndexByIdForHydration(
                Number(result.tagIds[index]));
            if (currentIndex < 0 ||
                    isDataWindowStub(previewRows[currentIndex])) {
                continue;
            }
            dataTagLoadedById[
                String(Number(result.tagIds[index]))] = true;
        }
        dataWindowState.hydratedRowTotal += hydrated;
        dataWindowState.missingIdCount += missing;
        dataWindowState.lastError = null;
        if ((hydrated > 0 || missing > 0) &&
                ClipHub.List &&
                typeof ClipHub.List.setItems === "function") {
            ClipHub.List.setItems(previewRows);
        }
        updateDataWindowCounts();
        hydrationWorkerState.successCount += 1;
        hydrationWorkerState.lastError = null;
        elapsed = Math.max(0,
            Number(System.currentTimeMillis()) - applyStartedAt);
        hydrationWorkerState.mainApplyLastMs = elapsed;
        hydrationWorkerState.mainApplyMaxMs = Math.max(
            Number(hydrationWorkerState.mainApplyMaxMs), elapsed);
        var forceVisual = missing > 0 ||
            hydrationResultTouchesRendered(result);
        if (forceVisual) {
            hydrationWorkerState.visualForceCount += 1;
        } else {
            hydrationWorkerState.visualDeltaCount += 1;
        }
        scheduleVirtualUpdate("hydration_apply", forceVisual);
        return true;
    }

    function drainHydrationResultsOnMain() {
        var resultJson;
        if (Looper.myLooper() !== Looper.getMainLooper()) {
            if (mainHandler !== null && hydrationApplyRunnable !== null) {
                mainHandler.post(hydrationApplyRunnable);
            }
            return false;
        }
        while ((resultJson = hydrationResultQueue.poll()) !== null) {
            applyHydrationResult(String(resultJson));
        }
        return true;
    }

    function shutdownHydrationWorker() {
        var executor = hydrationExecutor;
        var future = hydrationActiveFuture;
        invalidateHydrationWorker("shutdown");
        hydrationWorkerState.enabled = false;
        hydrationWorkerStoppingFlag.set(true);
        hydrationLatestRequestRef.set(null);
        if (future !== null) {
            try { future.cancel(true); }
            catch (ignoredFutureCancel) {}
        }
        if (executor !== null) {
            try { executor.shutdownNow(); }
            catch (ignoredExecutorShutdown) {}
            try {
                executor.awaitTermination(
                    5000,
                    Packages.java.util.concurrent.TimeUnit.MILLISECONDS);
            } catch (ignoredAwait) {}
        }
        hydrationResultQueue.clear();
        hydrationWorkerBusyFlag.set(false);
        hydrationActiveFuture = null;
        hydrationExecutor = null;
        hydrationApplyRunnable = null;
        hydrationWorkerState.pendingSignature = null;
        return true;
    }

    function hydrateDataWindowRange(startIndex, endIndex, origin) {
        var start;
        var end;
        var request;
        if (previewRows.length === 0) {
            return {
                hydratedCount: 0,
                missingCount: 0,
                tagCount: 0,
                pending: false,
                requiresRows: false
            };
        }
        start = Math.max(0, Math.min(
            previewRows.length - 1,
            Math.floor(Number(startIndex || 0))));
        end = Math.max(start, Math.min(
            previewRows.length - 1,
            Math.floor(Number(endIndex))));
        dataWindowState.lastHydrateStartIndex = start;
        dataWindowState.lastHydrateEndIndex = end;
        dataWindowState.lastOrigin = String(
            origin || "data_window_hydrate");
        dataWindowState.lastError = null;
        dataWindowState.hydrationPassCount += 1;
        request = collectHydrationRequest(
            start, end, origin || "data_window_hydrate");
        if (request === null) {
            updateDataWindowCounts();
            return {
                hydratedCount: 0,
                missingCount: 0,
                tagCount: 0,
                pending: false,
                requiresRows: false
            };
        }
        submitHydrationRequest(request);
        updateDataWindowCounts();
        return {
            hydratedCount: 0,
            missingCount: 0,
            tagCount: request.tagIds.length,
            pending: true,
            requiresRows: request.ids.length > 0,
            requestId: Number(request.requestId)
        };
    }

    function dehydrateDataWindowOutside(startIndex, endIndex, origin) {
        var blockSize;
        var startBlock;
        var endBlock;
        var keepStart;
        var keepEnd;
        var index;
        var row;
        var itemId;
        var key;
        var changed = 0;
        if (previewRows.length === 0) {
            return 0;
        }
        blockSize = dataWindowBlockSize();
        startBlock = Math.max(0,
            Math.floor(Math.max(0,
                Number(startIndex || 0)) / blockSize) -
                DATA_BLOCK_KEEP_BEFORE);
        endBlock = Math.min(
            Math.max(0,
                Math.ceil(previewRows.length / blockSize) - 1),
            Math.floor(Math.max(0,
                Number(endIndex || 0)) / blockSize) +
                DATA_BLOCK_KEEP_AFTER);
        keepStart = startBlock * blockSize;
        keepEnd = Math.min(previewRows.length - 1,
            (endBlock + 1) * blockSize - 1);
        dataWindowState.keepStartIndex = keepStart;
        dataWindowState.keepEndIndex = keepEnd;
        dataWindowState.lastOrigin = String(
            origin || "data_window_dehydrate");
        dataWindowState.lastError = null;
        for (index = 0; index < previewRows.length; index += 1) {
            if (index >= keepStart && index <= keepEnd) {
                continue;
            }
            row = previewRows[index];
            if (isDataWindowStub(row)) { continue; }
            itemId = Number(row.id);
            if ((selectedItemId !== null &&
                    itemId === Number(selectedItemId)) ||
                    (virtualState.anchorItemId !== null &&
                    itemId === Number(virtualState.anchorItemId))) {
                continue;
            }
            key = String(itemId);
            previewRows[index] = dataWindowStub(itemId);
            delete resultTagMap[key];
            delete dataTagLoadedById[key];
            changed += 1;
        }
        dataWindowState.dehydrationPassCount += 1;
        dataWindowState.dehydratedRowTotal += changed;
        if (changed > 0 && ClipHub.List &&
                typeof ClipHub.List.setItems === "function") {
            ClipHub.List.setItems(previewRows);
        }
        updateDataWindowCounts();
        return changed;
    }

    function dataWindowRowSnapshot(itemId) {
        var index;
        var row;
        var key = String(Number(itemId));
        for (index = 0; index < previewRows.length; index += 1) {
            row = previewRows[index];
            if (Number(row.id) === Number(itemId)) {
                return {
                    index: index,
                    id: Number(row.id),
                    hydrated: !isDataWindowStub(row),
                    content: isDataWindowStub(row) ? null :
                        String(row.content || ""),
                    previewLength: isDataWindowStub(row) ? 0 :
                        String(row.content || "").length,
                    contentLength: isDataWindowStub(row) ? 0 :
                        Number(row.content_length || 0),
                    contentTruncated: isDataWindowStub(row) ? 0 :
                        Number(row.content_truncated || 0),
                    fullContentLoaded: false,
                    sourcePackage: isDataWindowStub(row) ? null :
                        String(row.source_package || ""),
                    tagDataLoaded:
                        dataTagLoadedById[key] === true,
                    heightKnown:
                        virtualState.heightById[key] !== undefined
                };
            }
        }
        return null;
    }

    function currentResultScrollY() {
        try {
            return resultScrollView === null ? 0 :
                Number(resultScrollView.getScrollY());
        } catch (ignored) {
            return 0;
        }
    }

    function setResultScrollY(valueY) {
        var target = Math.max(0,
            Math.floor(Number(valueY || 0)));
        if (resultScrollView === null) { return 0; }
        resultScrollView.scrollTo(0, target);
        return currentResultScrollY();
    }

    function virtualRowIndexById(itemId) {
        var index;
        if (itemId === null || itemId === undefined) {
            return -1;
        }
        for (index = 0; index < previewRows.length; index += 1) {
            if (Number(previewRows[index].id) === Number(itemId)) {
                return index;
            }
        }
        return -1;
    }

    function virtualDefaultHeightPx() {
        var metrics;
        if (Number(virtualState.defaultHeightPx) > 0) {
            return Number(virtualState.defaultHeightPx);
        }
        metrics = resultCardMetrics(availableResultWidthPx());
        virtualState.defaultHeightPx = Math.max(
            dp(48), Number(metrics.cardMinimumHeightPx) + dp(6));
        if (Number(virtualState.averageHeightPx) <= 0) {
            virtualState.averageHeightPx =
                Number(virtualState.defaultHeightPx);
        }
        return Number(virtualState.defaultHeightPx);
    }

    function virtualHeightForIndex(index) {
        var row;
        var cached;
        if (index < 0 || index >= previewRows.length) {
            return 0;
        }
        row = previewRows[index];
        cached = virtualState.heightById[
            String(Number(row.id))];
        if (cached !== undefined && Number(cached) > 0) {
            return Number(cached);
        }
        return Math.max(1,
            Number(virtualState.averageHeightPx) ||
                virtualDefaultHeightPx());
    }

    function virtualHeightRange(start, endExclusive) {
        var total = 0;
        var index;
        start = Math.max(0, Number(start || 0));
        endExclusive = Math.min(previewRows.length,
            Math.max(start, Number(endExclusive || 0)));
        for (index = start; index < endExclusive; index += 1) {
            total += virtualHeightForIndex(index);
        }
        return Math.max(0, Math.round(total));
    }

    function setVirtualSpacerHeight(view, heightPx) {
        var params;
        heightPx = Math.max(0, Math.round(Number(heightPx || 0)));
        if (view === null) { return heightPx; }
        params = view.getLayoutParams();
        if (params !== null && Number(params.height) === heightPx) {
            scrollPerformanceState.spacerNoopCount += 1;
            return heightPx;
        }
        if (params === null) {
            params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, heightPx);
        } else {
            params.height = heightPx;
        }
        view.setLayoutParams(params);
        scrollPerformanceState.spacerApplyCount += 1;
        return heightPx;
    }

    function copyVirtualState() {
        return {
            firstRenderedIndex:
                Number(virtualState.firstRenderedIndex),
            lastRenderedIndex:
                Number(virtualState.lastRenderedIndex),
            firstVisibleIndex:
                Number(virtualState.firstVisibleIndex),
            lastVisibleIndex:
                Number(virtualState.lastVisibleIndex),
            visibleCount: Number(virtualState.visibleCount),
            renderedViewCount:
                virtualCardHost === null ? 0 :
                    Number(virtualCardHost.getChildCount()),
            loadedDataCount: previewRows.length,
            topSpacerPx: Number(virtualState.topSpacerPx),
            bottomSpacerPx: Number(virtualState.bottomSpacerPx),
            averageCardHeightPx:
                Number(virtualState.averageHeightPx),
            defaultCardHeightPx:
                Number(virtualState.defaultHeightPx),
            anchorItemId: virtualState.anchorItemId,
            anchorIndex: Number(virtualState.anchorIndex),
            anchorOffsetPx: Number(virtualState.anchorOffsetPx),
            anchorRestoreErrorPx:
                Number(virtualState.anchorRestoreErrorPx),
            updateScheduled:
                virtualState.updateScheduled === true,
            updateDeferred:
                virtualState.updateDeferred === true,
            scrollListenerBound:
                virtualState.scrollListenerBound === true,
            updateCount: Number(virtualState.updateCount),
            recycleCount: Number(virtualState.recycleCount),
            rebuildCount: Number(virtualState.rebuildCount),
            staleUpdateCount:
                Number(virtualState.staleUpdateCount),
            beforeScreens: VIRTUAL_BEFORE_SCREENS,
            afterScreens: VIRTUAL_AFTER_SCREENS,
            lastOrigin: virtualState.lastOrigin,
            lastError: virtualState.lastError
        };
    }

    function clearVirtualViewReferences() {
        virtualTopSpacer = null;
        virtualCardHost = null;
        virtualBottomSpacer = null;
        paginationFooterHost = null;
        quickResetView = null;
        virtualRenderedItemIds = [];
        virtualRenderedSignatures = [];
        virtualPendingOrigin = "";
        virtualPendingForce = false;
        return true;
    }

    function resetVirtualState(clearHeights) {
        virtualGeneration += 1;
        virtualState.firstRenderedIndex = 0;
        virtualState.lastRenderedIndex = -1;
        virtualState.firstVisibleIndex = 0;
        virtualState.lastVisibleIndex = -1;
        virtualState.visibleCount = 1;
        virtualState.topSpacerPx = 0;
        virtualState.bottomSpacerPx = 0;
        virtualState.anchorItemId = null;
        virtualState.anchorIndex = -1;
        virtualState.anchorOffsetPx = 0;
        virtualState.anchorRestoreErrorPx = 0;
        virtualState.updateScheduled = false;
        virtualState.updateDeferred = false;
        virtualState.scrollListenerBound = false;
        virtualState.scrollToTopPending = false;
        virtualState.lastOrigin = "virtual_reset";
        virtualState.lastError = null;
        if (clearHeights === true) {
            virtualState.heightById = {};
            virtualState.averageHeightPx = 0;
            virtualState.defaultHeightPx = 0;
            resetDataWindowState(true);
        }
        return copyVirtualState();
    }

    function virtualViewportHeightPx() {
        var height = 0;
        try {
            height = resultScrollView === null ? 0 :
                Number(resultScrollView.getHeight());
        } catch (ignoredHeight) {}
        if (height <= 0) {
            height = Math.max(dp(180),
                Math.floor(Number(state.panelHeightPx || dp(560)) * 0.58));
        }
        return height;
    }

    function updateVirtualVisibleCount() {
        var average = Math.max(1,
            Number(virtualState.averageHeightPx) ||
                virtualDefaultHeightPx());
        virtualState.visibleCount = Math.max(1,
            Math.ceil(virtualViewportHeightPx() / average));
        return Number(virtualState.visibleCount);
    }

    function estimatedFirstVisibleIndex(scrollY) {
        var offset = Math.max(0, Number(scrollY || 0));
        var total = 0;
        var index;
        for (index = 0; index < previewRows.length; index += 1) {
            if (total + virtualHeightForIndex(index) > offset) {
                return index;
            }
            total += virtualHeightForIndex(index);
        }
        return Math.max(0, previewRows.length - 1);
    }

    function captureScrollAnchor() {
        var scrollY;
        var viewportBottom;
        var index;
        var child;
        var top;
        var bottom;
        var first = -1;
        var last = -1;
        if (mutationAnchorLocked === true ||
                virtualState.scrollToTopPending === true) {
            return copyVirtualState();
        }
        if (resultScrollView === null ||
                virtualCardHost === null ||
                previewRows.length === 0) {
            return copyVirtualState();
        }
        try {
            scrollY = currentResultScrollY();
            viewportBottom = scrollY + virtualViewportHeightPx();
            if (scrollY <= 0 &&
                    Number(virtualState.firstRenderedIndex) === 0) {
                virtualState.anchorItemId = null;
                virtualState.anchorIndex = -1;
                virtualState.anchorOffsetPx = 0;
                virtualState.firstVisibleIndex = 0;
                virtualState.lastVisibleIndex = Math.min(
                    previewRows.length - 1,
                    Math.max(0,
                        Number(virtualState.visibleCount) - 1));
                return copyVirtualState();
            }
            for (index = 0;
                    index < virtualCardHost.getChildCount();
                    index += 1) {
                child = virtualCardHost.getChildAt(index);
                top = Number(virtualState.topSpacerPx) +
                    Number(child.getTop());
                bottom = top + Math.max(1,
                    Number(child.getHeight()));
                if (first < 0 && bottom > scrollY) {
                    first = Number(virtualState.firstRenderedIndex) + index;
                    virtualState.anchorItemId =
                        virtualRenderedItemIds.length > index ?
                            Number(virtualRenderedItemIds[index]) :
                            Number(previewRows[first].id);
                    virtualState.anchorIndex =
                        virtualRowIndexById(
                            virtualState.anchorItemId);
                    if (virtualState.anchorIndex >= 0) {
                        first = Number(virtualState.anchorIndex);
                    } else {
                        virtualState.anchorIndex = first;
                    }
                    virtualState.anchorOffsetPx = top - scrollY;
                }
                if (top < viewportBottom) {
                    last = Number(virtualState.firstRenderedIndex) + index;
                }
            }
            if (first < 0) {
                first = estimatedFirstVisibleIndex(scrollY);
                virtualState.anchorItemId =
                    Number(previewRows[first].id);
                virtualState.anchorIndex = first;
                virtualState.anchorOffsetPx = 0;
            }
            virtualState.firstVisibleIndex = first;
            virtualState.lastVisibleIndex = Math.max(first, last);
            return copyVirtualState();
        } catch (error) {
            virtualState.lastError = String(error);
            return copyVirtualState();
        }
    }

    function measureVirtualCards() {
        var measureStartedAt = Number(System.currentTimeMillis());
        var measureElapsed;
        var index;
        var child;
        var rowIndex;
        var itemId;
        var height;
        var total = 0;
        var measured = 0;
        if (virtualCardHost === null) { return false; }
        for (index = 0;
                index < virtualCardHost.getChildCount(); index += 1) {
            child = virtualCardHost.getChildAt(index);
            rowIndex = Number(virtualState.firstRenderedIndex) + index;
            if (rowIndex >= previewRows.length) { break; }
            itemId = virtualRenderedItemIds.length > index ?
                Number(virtualRenderedItemIds[index]) :
                Number(previewRows[rowIndex].id);
            height = Number(child.getHeight());
            if (height <= 0) {
                height = Number(child.getMeasuredHeight());
            }
            if (height > 0) {
                height += dp(6);
                virtualState.heightById[
                    String(itemId)] = height;
                total += height;
                measured += 1;
            }
        }
        if (measured > 0) {
            height = total / measured;
            virtualState.averageHeightPx =
                Number(virtualState.averageHeightPx) > 0 ?
                    Number(virtualState.averageHeightPx) * 0.72 +
                        height * 0.28 : height;
        }
        virtualState.topSpacerPx = setVirtualSpacerHeight(
            virtualTopSpacer,
            virtualHeightRange(0,
                virtualState.firstRenderedIndex));
        virtualState.bottomSpacerPx = setVirtualSpacerHeight(
            virtualBottomSpacer,
            virtualHeightRange(
                virtualState.lastRenderedIndex + 1,
                previewRows.length));
        measureElapsed = Math.max(0,
            Number(System.currentTimeMillis()) - measureStartedAt);
        scrollPerformanceState.measurePassCount += 1;
        scrollPerformanceState.measureLastMs = measureElapsed;
        scrollPerformanceState.measureMaxMs = Math.max(
            Number(scrollPerformanceState.measureMaxMs), measureElapsed);
        return measured > 0;
    }

    function restoreScrollAnchor() {
        var index;
        var childIndex;
        var child;
        var target;
        var actual;
        if (resultScrollView === null) { return false; }
        if (virtualState.scrollToTopPending === true) {
            resultScrollView.scrollTo(0, 0);
            virtualState.scrollToTopPending = false;
            virtualState.anchorItemId = null;
            virtualState.anchorIndex = -1;
            virtualState.anchorOffsetPx = 0;
            virtualState.anchorRestoreErrorPx = 0;
            return true;
        }
        index = virtualRowIndexById(
            virtualState.anchorItemId);
        if (index < 0 && previewRows.length > 0) {
            index = Math.max(0, Math.min(
                previewRows.length - 1,
                Number(virtualState.anchorIndex)));
            virtualState.anchorItemId =
                Number(previewRows[index].id);
            virtualState.anchorIndex = index;
        }
        childIndex = index -
            Number(virtualState.firstRenderedIndex);
        if (index < 0 || virtualCardHost === null ||
                childIndex < 0 ||
                childIndex >= virtualCardHost.getChildCount()) {
            return false;
        }
        child = virtualCardHost.getChildAt(childIndex);
        target = Number(virtualState.topSpacerPx) +
            Number(child.getTop()) -
            Number(virtualState.anchorOffsetPx);
        target = Math.max(0, Math.round(target));
        actual = currentResultScrollY();
        if (Math.abs(actual - target) <= 1) {
            scrollPerformanceState.anchorScrollNoopCount += 1;
            virtualState.anchorRestoreErrorPx = actual - target;
            virtualState.anchorIndex = index;
            return true;
        }
        resultScrollView.scrollTo(0, target);
        scrollPerformanceState.anchorScrollApplyCount += 1;
        actual = currentResultScrollY();
        virtualState.anchorRestoreErrorPx = actual - target;
        virtualState.anchorIndex = index;
        return true;
    }

    function createVirtualHierarchy() {
        var params;
        if (resultContainer === null) { return false; }
        resultContainer.removeAllViews();
        virtualTopSpacer = new View(appContext);
        virtualCardHost = new LinearLayout(appContext);
        virtualCardHost.setOrientation(LinearLayout.VERTICAL);
        virtualBottomSpacer = new View(appContext);
        paginationFooterHost = new LinearLayout(appContext);
        paginationFooterHost.setOrientation(LinearLayout.VERTICAL);
        resultContainer.addView(virtualTopSpacer,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0));
        resultContainer.addView(virtualCardHost,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));
        resultContainer.addView(virtualBottomSpacer,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, 0));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        resultContainer.addView(paginationFooterHost, params);
        return true;
    }

    function virtualTargetRange(preferredIndex) {
        var visible = updateVirtualVisibleCount();
        var firstVisible;
        var lastVisible;
        var start;
        var end;
        if (previewRows.length === 0) {
            return { start: 0, end: -1, first: 0, last: -1 };
        }
        firstVisible = preferredIndex === undefined ||
                preferredIndex === null ||
                Number(preferredIndex) < 0 ?
            estimatedFirstVisibleIndex(currentResultScrollY()) :
            Math.max(0, Math.min(previewRows.length - 1,
                Number(preferredIndex)));
        lastVisible = Math.min(previewRows.length - 1,
            firstVisible + visible - 1);
        start = Math.max(0,
            firstVisible - visible * VIRTUAL_BEFORE_SCREENS);
        end = Math.min(previewRows.length - 1,
            lastVisible + visible * VIRTUAL_AFTER_SCREENS);
        return {
            start: start,
            end: end,
            first: firstVisible,
            last: lastVisible
        };
    }


    function virtualRenderSignature(row, colors) {
        var tags = tagsForResult(row);
        var selected = SELECTION_ENABLED && selectedItemId !== null &&
  Number(selectedItemId) === Number(row && row.id);
        return [
  JSON.stringify(row || {}),
  JSON.stringify(tags || []),
  selected ? "1" : "0",
  rootMode ? "1" : "0",
  String(colors.card),
  String(colors.surfaceMuted),
  String(colors.stroke),
  String(colors.textPrimary),
  String(colors.textSecondary),
  String(colors.accentSoft),
  String(colors.accentStrong),
  Number(state.panelWidthPx || 0),
  Number(state.panelHeightPx || 0)
        ].join("\u001f");
    }

    function syncRenderedResultCounters(range) {
        var index;
        var row;
        var tags;
        var cardCount = Math.max(0, Number(range.end) -
  Number(range.start) + 1);
        var pinnedCount = 0;
        var tagLabelCount = 0;
        var tagColorCount = 0;
        var sourceIconCount = 0;
        for (index = range.start; index <= range.end; index += 1) {
  row = previewRows[index];
  if (!row) { continue; }
  if (Number(row.is_pinned || 0) === 1) { pinnedCount += 1; }
  tags = tagsForResult(row);
  tagLabelCount += Math.min(2, tags.length);
  if (tags.length > 0) { tagColorCount += 1; }
  if (String(row.source_package || "").length > 0) {
      sourceIconCount += 1;
  }
        }
        state.resultCardCount = cardCount;
        state.cardActionButtonCount = cardCount * 4;
        state.pinnedBadgeCount = pinnedCount;
        state.renderedTagLabelCount = tagLabelCount;
        state.tagColorPreviewCount = tagColorCount;
        state.resultSourceIconCount = sourceIconCount;
        return true;
    }

    function removeVirtualEntryAt(index) {
        virtualCardHost.removeViewAt(index);
        virtualRenderedItemIds.splice(index, 1);
        virtualRenderedSignatures.splice(index, 1);
        resultCardViews.splice(index, 1);
        resultActionViews.splice(index, 1);
        scrollPerformanceState.removedViewCount += 1;
        scrollPerformanceState.structuralRemoveCount += 1;
        return true;
    }

    function insertVirtualEntryAt(index, row, colors, signature) {
        var params = new LinearLayout.LayoutParams(
  LinearLayout.LayoutParams.MATCH_PARENT,
  LinearLayout.LayoutParams.WRAP_CONTENT);
        var wrapper;
        var cardRef;
        var actionRef;
        params.bottomMargin = dp(6);
        wrapper = makeResultCard(row, colors);
        cardRef = resultCardViews.pop();
        actionRef = resultActionViews.pop();
        virtualCardHost.addView(wrapper, index, params);
        virtualRenderedItemIds.splice(index, 0, Number(row.id));
        virtualRenderedSignatures.splice(index, 0, signature);
        resultCardViews.splice(index, 0, cardRef);
        resultActionViews.splice(index, 0, actionRef);
        scrollPerformanceState.createdViewCount += 1;
        scrollPerformanceState.structuralInsertCount += 1;
        scrollPerformanceState.signatureRebuildCount += 1;
        return true;
    }

    function moveVirtualEntry(fromIndex, toIndex) {
        var wrapper = virtualCardHost.getChildAt(fromIndex);
        var params = wrapper.getLayoutParams();
        var itemId = virtualRenderedItemIds[fromIndex];
        var signature = virtualRenderedSignatures[fromIndex];
        var cardRef = resultCardViews[fromIndex];
        var actionRef = resultActionViews[fromIndex];
        virtualCardHost.removeViewAt(fromIndex);
        virtualRenderedItemIds.splice(fromIndex, 1);
        virtualRenderedSignatures.splice(fromIndex, 1);
        resultCardViews.splice(fromIndex, 1);
        resultActionViews.splice(fromIndex, 1);
        virtualCardHost.addView(wrapper, toIndex, params);
        virtualRenderedItemIds.splice(toIndex, 0, itemId);
        virtualRenderedSignatures.splice(toIndex, 0, signature);
        resultCardViews.splice(toIndex, 0, cardRef);
        resultActionViews.splice(toIndex, 0, actionRef);
        scrollPerformanceState.movedViewCount += 1;
        return true;
    }

    function keyedReconcileVirtualWindow(range, colors) {
        var keyedStartedAt = Number(System.currentTimeMillis());
        var keyedSignatureStartedAt;
        var keyedStructureStartedAt;
        var keyedElapsed;
        var keyedSignatureElapsed;
        var keyedStructureElapsed;
        var desiredCount = Math.max(0, range.end - range.start + 1);
        var desiredIds = [];
        var desiredSignatures = [];
        var desiredKeys = {};
        var index;
        var localIndex;
        var scanIndex;
        var row;
        var key;
        var childCount = Number(virtualCardHost.getChildCount());
        scrollPerformanceState.keyedReconcileCount += 1;
        if (virtualRenderedItemIds.length !== childCount ||
      virtualRenderedSignatures.length !== childCount ||
      resultCardViews.length !== childCount ||
      resultActionViews.length !== childCount) {
  scrollPerformanceState.alignmentFallbackCount += 1;
  while (virtualCardHost.getChildCount() > 0) {
      virtualCardHost.removeViewAt(
          Number(virtualCardHost.getChildCount()) - 1);
      scrollPerformanceState.removedViewCount += 1;
      scrollPerformanceState.structuralRemoveCount += 1;
  }
  virtualRenderedItemIds = [];
  virtualRenderedSignatures = [];
  resultCardViews = [];
  resultActionViews = [];
        }
        keyedSignatureStartedAt = Number(System.currentTimeMillis());
        for (index = range.start; index <= range.end; index += 1) {
  row = previewRows[index];
  desiredIds.push(Number(row.id));
  desiredSignatures.push(virtualRenderSignature(row, colors));
  key = "k:" + String(Number(row.id)) + "\u001e" +
      desiredSignatures[desiredSignatures.length - 1];
  desiredKeys[key] = true;
        }
        keyedSignatureElapsed = Math.max(0,
            Number(System.currentTimeMillis()) - keyedSignatureStartedAt);
        keyedStructureStartedAt = Number(System.currentTimeMillis());
        for (localIndex = Number(virtualCardHost.getChildCount()) - 1;
      localIndex >= 0; localIndex -= 1) {
  key = "k:" + String(Number(virtualRenderedItemIds[localIndex])) +
      "\u001e" + String(virtualRenderedSignatures[localIndex]);
  if (desiredKeys[key] !== true) {
      removeVirtualEntryAt(localIndex);
  }
        }
        for (localIndex = 0; localIndex < desiredCount; localIndex += 1) {
  if (localIndex < virtualRenderedItemIds.length &&
          Number(virtualRenderedItemIds[localIndex]) ===
              Number(desiredIds[localIndex]) &&
          String(virtualRenderedSignatures[localIndex]) ===
              String(desiredSignatures[localIndex])) {
      scrollPerformanceState.sameIdReuseCount += 1;
      continue;
  }
  scanIndex = -1;
  for (index = localIndex + 1;
          index < virtualRenderedItemIds.length; index += 1) {
      if (Number(virtualRenderedItemIds[index]) ===
              Number(desiredIds[localIndex]) &&
              String(virtualRenderedSignatures[index]) ===
                  String(desiredSignatures[localIndex])) {
          scanIndex = index;
          break;
      }
  }
  if (scanIndex >= 0) {
      moveVirtualEntry(scanIndex, localIndex);
      scrollPerformanceState.sameIdReuseCount += 1;
  } else {
      insertVirtualEntryAt(localIndex,
          previewRows[range.start + localIndex], colors,
          desiredSignatures[localIndex]);
  }
        }
        while (virtualCardHost.getChildCount() > desiredCount) {
  removeVirtualEntryAt(
      Number(virtualCardHost.getChildCount()) - 1);
        }
        syncRenderedResultCounters(range);
        keyedStructureElapsed = Math.max(0,
            Number(System.currentTimeMillis()) - keyedStructureStartedAt);
        keyedElapsed = Math.max(0,
            Number(System.currentTimeMillis()) - keyedStartedAt);
        scrollPerformanceState.keyedReconcileLastMs = keyedElapsed;
        scrollPerformanceState.keyedReconcileMaxMs = Math.max(
            Number(scrollPerformanceState.keyedReconcileMaxMs), keyedElapsed);
        scrollPerformanceState.keyedSignatureLastMs = keyedSignatureElapsed;
        scrollPerformanceState.keyedSignatureMaxMs = Math.max(
            Number(scrollPerformanceState.keyedSignatureMaxMs), keyedSignatureElapsed);
        scrollPerformanceState.keyedStructureLastMs = keyedStructureElapsed;
        scrollPerformanceState.keyedStructureMaxMs = Math.max(
            Number(scrollPerformanceState.keyedStructureMaxMs), keyedStructureElapsed);
        return true;
    }

    function rebuildVirtualWindow(origin, force, preferredIndex) {
        var colors = palette();
        var range;
        var oldCount;
        var index;
        var params;
        var generation;
        var hydration;
        var oldStart;
        var oldEnd;
        var overlap;
        var removeTop;
        var removeBottom;
        var removeIndex;
        var wrapper;
        var cardRef;
        var actionRef;
        var recycledCount;
        var rebuildCreatedBefore;
        var rebuildRemovedBefore;
        var rebuildReusedBefore;
        var overlapStartedAt;
        var overlapElapsed = 0;
        if (virtualCardHost === null || !state.panelAttached) {
            return false;
        }
        if (activeSwipeCard !== null) {
            virtualState.updateDeferred = true;
            return false;
        }
        range = virtualTargetRange(preferredIndex);
        virtualState.firstVisibleIndex = range.first;
        virtualState.lastVisibleIndex = range.last;
        if (force !== true &&
                String(origin || "") === "result_scroll" &&
                range.start === Number(
                    virtualState.firstRenderedIndex) &&
                range.end === Number(
                    virtualState.lastRenderedIndex)) {
            scrollPerformanceState.sameRangeNoLayoutCount += 1;
            virtualState.lastOrigin =
                "result_scroll_same_range_fast";
            virtualState.lastError = null;
            return false;
        }
        hydration = hydrateDataWindowRange(
            range.start, range.end,
            String(origin || "virtual_rebuild") + "_hydrate");
        if (hydration.pending === true &&
                hydration.requiresRows === true) {
            virtualState.lastOrigin = String(
                origin || "virtual_rebuild") +
                "_hydrate_pending";
            return false;
        }
        dehydrateDataWindowOutside(
            range.start, range.end,
            String(origin || "virtual_rebuild") + "_dehydrate");
        if (force !== true &&
                range.start === Number(
                    virtualState.firstRenderedIndex) &&
                range.end === Number(
                    virtualState.lastRenderedIndex)) {
            virtualState.topSpacerPx = setVirtualSpacerHeight(
                virtualTopSpacer,
                virtualHeightRange(0, range.start));
            virtualState.bottomSpacerPx = setVirtualSpacerHeight(
                virtualBottomSpacer,
                virtualHeightRange(range.end + 1,
                    previewRows.length));
            return false;
        }
        var viewRebuildStartedAt =
            Number(System.currentTimeMillis());
        rebuildCreatedBefore = Number(scrollPerformanceState.createdViewCount);
        rebuildRemovedBefore = Number(scrollPerformanceState.removedViewCount);
        rebuildReusedBefore = Number(scrollPerformanceState.sameIdReuseCount);
        var viewRebuildElapsed;
        scrollPerformanceState.viewRebuildCount += 1;
        measureVirtualCards();
        oldCount = Number(virtualCardHost.getChildCount());
        oldStart = Number(virtualState.firstRenderedIndex);
        oldEnd = Number(virtualState.lastRenderedIndex);
        recycledCount = oldCount;
        overlap = force !== true && oldCount > 0 &&
            oldEnd >= oldStart && range.start <= oldEnd &&
            range.end >= oldStart &&
            virtualRenderedItemIds.length === oldCount &&
            virtualRenderedSignatures.length === oldCount &&
            resultCardViews.length === oldCount &&
            resultActionViews.length === oldCount;
        if (overlap) {
            overlapStartedAt = Number(System.currentTimeMillis());
            recycledCount = 0;
            removeTop = Math.max(0, range.start - oldStart);
            for (removeIndex = 0;
                    removeIndex < removeTop; removeIndex += 1) {
                virtualCardHost.removeViewAt(0);
                virtualRenderedItemIds.shift();
                virtualRenderedSignatures.shift();
                resultCardViews.shift();
                resultActionViews.shift();
                recycledCount += 1;
                scrollPerformanceState.structuralRemoveCount += 1;
            }
            removeBottom = Math.max(0, oldEnd - range.end);
            for (removeIndex = 0;
                    removeIndex < removeBottom; removeIndex += 1) {
                virtualCardHost.removeViewAt(
                    Number(virtualCardHost.getChildCount()) - 1);
                virtualRenderedItemIds.pop();
                virtualRenderedSignatures.pop();
                resultCardViews.pop();
                resultActionViews.pop();
                recycledCount += 1;
                scrollPerformanceState.structuralRemoveCount += 1;
            }
            scrollPerformanceState.removedViewCount += recycledCount;
            if (range.start < oldStart) {
                for (index = oldStart - 1;
                        index >= range.start; index -= 1) {
                    params = new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT);
                    params.bottomMargin = dp(6);
                    wrapper = makeResultCard(previewRows[index], colors);
                    cardRef = resultCardViews.pop();
                    actionRef = resultActionViews.pop();
                    virtualCardHost.addView(wrapper, 0, params);
                    resultCardViews.unshift(cardRef);
                    resultActionViews.unshift(actionRef);
                    virtualRenderedItemIds.unshift(
                        Number(previewRows[index].id));
                    virtualRenderedSignatures.unshift(
                        virtualRenderSignature(previewRows[index], colors));
                    scrollPerformanceState.createdViewCount += 1;
                    scrollPerformanceState.structuralInsertCount += 1;
                }
            }
            if (range.end > oldEnd) {
                for (index = oldEnd + 1;
                        index <= range.end; index += 1) {
                    params = new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT);
                    params.bottomMargin = dp(6);
                    virtualCardHost.addView(makeResultCard(
                        previewRows[index], colors), params);
                    virtualRenderedItemIds.push(
                        Number(previewRows[index].id));
                    virtualRenderedSignatures.push(
                        virtualRenderSignature(previewRows[index], colors));
                    scrollPerformanceState.createdViewCount += 1;
                    scrollPerformanceState.structuralInsertCount += 1;
                }
            }
            state.resultCardCount = Number(
                virtualCardHost.getChildCount());
            overlapElapsed = Math.max(0,
                Number(System.currentTimeMillis()) - overlapStartedAt);
            scrollPerformanceState.overlapUpdateLastMs = overlapElapsed;
            scrollPerformanceState.overlapUpdateMaxMs = Math.max(
                Number(scrollPerformanceState.overlapUpdateMaxMs), overlapElapsed);
        } else {
  keyedReconcileVirtualWindow(range, colors);
  recycledCount = Math.max(0, oldCount -
      Number(virtualCardHost.getChildCount()));
        }
        syncRenderedResultCounters(range);
        viewRebuildElapsed = Math.max(0,
            Number(System.currentTimeMillis()) -
                viewRebuildStartedAt);
        scrollPerformanceState.viewRebuildLastMs =
            viewRebuildElapsed;
        scrollPerformanceState.viewRebuildMaxMs = Math.max(
            Number(scrollPerformanceState.viewRebuildMaxMs),
            viewRebuildElapsed);
        if (viewRebuildElapsed > 32) {
            scrollPerformanceState.slowRebuildCount += 1;
            scrollPerformanceState.slowRebuildSamples.push({
                origin: String(origin || "virtual_rebuild"),
                force: force === true,
                mode: overlap ? "overlap" : "keyed",
                elapsedMs: viewRebuildElapsed,
                rangeStart: Number(range.start),
                rangeEnd: Number(range.end),
                oldCount: oldCount,
                newCount: Number(virtualCardHost.getChildCount()),
                created: Number(scrollPerformanceState.createdViewCount) -
                    rebuildCreatedBefore,
                removed: Number(scrollPerformanceState.removedViewCount) -
                    rebuildRemovedBefore,
                reused: Number(scrollPerformanceState.sameIdReuseCount) -
                    rebuildReusedBefore,
                measureMs: Number(scrollPerformanceState.measureLastMs),
                keyedMs: overlap ? 0 :
                    Number(scrollPerformanceState.keyedReconcileLastMs),
                signatureMs: overlap ? 0 :
                    Number(scrollPerformanceState.keyedSignatureLastMs),
                structureMs: overlap ? overlapElapsed :
                    Number(scrollPerformanceState.keyedStructureLastMs)
            });
            while (scrollPerformanceState.slowRebuildSamples.length > 8) {
                scrollPerformanceState.slowRebuildSamples.shift();
            }
        }
        virtualState.firstRenderedIndex = range.start;
        virtualState.lastRenderedIndex = range.end;
        virtualState.topSpacerPx = setVirtualSpacerHeight(
            virtualTopSpacer,
            virtualHeightRange(0, range.start));
        virtualState.bottomSpacerPx = setVirtualSpacerHeight(
            virtualBottomSpacer,
            virtualHeightRange(range.end + 1,
                previewRows.length));
        virtualState.updateCount += 1;
        virtualState.rebuildCount += 1;
        virtualState.recycleCount += recycledCount;
        virtualState.updateDeferred = false;
        virtualState.lastOrigin = String(origin || "virtual_rebuild");
        virtualState.lastError = null;
        virtualGeneration += 1;
        generation = virtualGeneration;
        if (mainHandler !== null) {
            mainHandler.post(new Packages.java.lang.Runnable({
                run: function () {
                    if (!state.panelAttached ||
                            virtualCardHost === null) {
                        virtualState.staleUpdateCount += 1;
                        return;
                    }
                    measureVirtualCards();
                    restoreScrollAnchor();
                    captureScrollAnchor();
                    updateQuickResetView();
                }
            }));
        }
        return true;
    }

    function scheduleVirtualUpdate(origin, force) {
        var generation;
        var requestedOrigin = String(origin || "virtual_scroll");
        var requestedForce = force === true;
        scrollPerformanceState.updateRequestCount += 1;
        if (requestedOrigin.indexOf("scroll") >= 0) {
  scrollPerformanceState.scrollEventCount += 1;
        }
        if (mainHandler === null) { return false; }
        if (virtualPendingOrigin.length === 0 || requestedForce === true ||
      virtualPendingOrigin === "result_scroll") {
  virtualPendingOrigin = requestedOrigin;
        }
        if (requestedForce === true && virtualPendingForce !== true) {
  if (virtualState.updateScheduled) {
      scrollPerformanceState.forceEscalationCount += 1;
  }
  virtualPendingForce = true;
        }
        if (virtualState.updateScheduled) {
  scrollPerformanceState.updateCoalescedCount += 1;
  return false;
        }
        virtualState.updateScheduled = true;
        scrollPerformanceState.virtualScheduleCount += 1;
        virtualGeneration += 1;
        generation = virtualGeneration;
        mainHandler.postDelayed(new Packages.java.lang.Runnable({
  run: function () {
      var commitOrigin;
      var commitForce;
      var virtualUpdateStartedAt;
      var virtualUpdateElapsed;
      if (generation !== virtualGeneration ||
              !state.panelAttached) {
          virtualState.updateScheduled = false;
          virtualPendingOrigin = "";
          virtualPendingForce = false;
          virtualState.staleUpdateCount += 1;
          return;
      }
      virtualState.updateScheduled = false;
      commitOrigin = virtualPendingOrigin.length > 0 ?
          virtualPendingOrigin : requestedOrigin;
      commitForce = virtualPendingForce === true;
      virtualPendingOrigin = "";
      virtualPendingForce = false;
      virtualUpdateStartedAt = Number(System.currentTimeMillis());
      scrollPerformanceState.virtualUpdateCount += 1;
      captureScrollAnchor();
      rebuildVirtualWindow(commitOrigin, commitForce,
          virtualState.firstVisibleIndex);
      updateQuickResetView();
      virtualUpdateElapsed = Math.max(0,
          Number(System.currentTimeMillis()) -
              virtualUpdateStartedAt);
      scrollPerformanceState.virtualUpdateLastMs =
          virtualUpdateElapsed;
      scrollPerformanceState.virtualUpdateMaxMs = Math.max(
          Number(scrollPerformanceState.virtualUpdateMaxMs),
          virtualUpdateElapsed);
  }
        }), VIRTUAL_UPDATE_DELAY_MS);
        return true;
    }

    function scrollToVirtualItem(itemId, offsetPx, origin) {
        var index = virtualRowIndexById(itemId);
        var target;
        if (index < 0 || resultScrollView === null) {
            return false;
        }
        virtualState.anchorItemId = Number(itemId);
        virtualState.anchorIndex = index;
        virtualState.anchorOffsetPx = Number(offsetPx || 0);
        target = virtualHeightRange(0, index) -
            Number(virtualState.anchorOffsetPx);
        resultScrollView.scrollTo(0, Math.max(0, Math.round(target)));
        rebuildVirtualWindow(
            origin || "virtual_scroll_to_item", true, index);
        return true;
    }

    function isLatestResultPosition() {
        return Number(paginationState.pageNumber) === 1 &&
            previewRows.length <=
                Number(paginationState.pageSize) &&
            currentResultScrollY() <= dp(8) &&
            Number(virtualState.firstVisibleIndex) <= 0;
    }

    function updateQuickResetView() {
        var available =
            paginationState.newContentPending === true ||
            Number(paginationState.pageNumber) > 1 ||
            previewRows.length > Number(paginationState.pageSize) ||
            Number(virtualState.firstVisibleIndex) > 0 ||
            currentResultScrollY() > dp(8);
        paginationState.quickResetAvailable = available;
        if (quickResetView !== null) {
            quickResetView.setText(
                paginationState.newContentPending === true ?
                    "有新内容" : "回到最新");
            quickResetView.setVisibility(
                available ? View.VISIBLE : View.GONE);
            quickResetView.setEnabled(available);
            quickResetView.setClickable(available);
        }
        return available;
    }

    function markNewContentPending(origin) {
        paginationState.newContentPending = true;
        paginationState.quickResetAvailable = true;
        clearPrefetchedPage(
            origin || "new_content_pending");
        if (mainHandler !== null &&
                Looper.myLooper() !== Looper.getMainLooper()) {
            mainHandler.post(new Packages.java.lang.Runnable({
                run: function () {
                    if (!state.panelAttached) { return; }
                    updateQuickResetView();
                    updateResultCountOnMain();
                }
            }));
        } else {
            updateQuickResetView();
            updateResultCountOnMain();
        }
        return true;
    }

    function resetToLatest(options) {
        options = options || {};
        return requireMain(runOnMainSync(function () {
            cancelMutationRefresh("reset_to_latest");
            pendingNewItemId = null;
            renderGeneration += 1;
            ajaxAppendGeneration += 1;
            clearPrefetchedPage("reset_to_latest");
            resetVirtualState(false);
            virtualState.scrollToTopPending = true;
            paginationState.newContentPending = false;
            paginationState.quickResetAvailable = false;
            resetResultPaging("reset_to_latest");
            apply({
                origin: String(options.origin ||
                    "reset_to_latest")
            });
            paginationState.newContentPending = false;
            paginationState.quickResetAvailable = false;
            if (state.panelAttached) {
                if (resultContainer === null) {
                    buildPanelContent(false);
                } else {
                    refreshResultsOnMain();
                }
                setResultScrollY(0);
                updateResultCountOnMain();
                updateQuickResetView();
            }
            return getPanelState();
        }, 5000));
    }

    function refreshPaginationUi(origin) {
        return requireMain(runOnMainSync(function () {
            cancelMutationRefresh(
                origin || "pagination_ui_refresh");
            pendingNewItemId = null;
            refreshGeneration += 1;
            refreshScheduled = false;
            syncPaginationSettings(
                "pagination_ui_refresh_sync");
            resetUnifiedPagination(
                origin || "pagination_ui_refresh");
            apply({
                origin: origin || "pagination_ui_refresh"
            });
            if (state.panelAttached) {
                buildPanelContent(false);
                panelStructureDirty = false;
                state.panelStructureDirty = false;
            }
            return getPanelState();
        }, 5000));
    }

    function resetResultPaging(reason) {
        invalidateHydrationWorker("result_paging_reset");
        syncPaginationSettings(
            reason || "pagination_reset_sync");
        resetUnifiedPagination(
            reason || "pagination_reset");
        return resultPageLimit;
    }

    function apply(options) {
        var rows;
        var thread;
        var pagedRequest;
        var requestedLimit;
        var pageResult;
        options = options || {};
        if (!ready || value === null) {
            throw new Error("ClipHub filter is not ready");
        }
        pagedRequest = options.limit === undefined &&
            (options.offset === undefined ||
                Number(options.offset) === 0);
        requestedLimit = Math.max(1, Math.floor(
            Number(options.limit || RESULT_PAGE_SIZE)));
        try {
            if (pagedRequest) {
                pageResult = loadPaginationPageInternal({
                    append: false,
                    page: options.page,
                    includeTotal: true
                });
                rows = pageResult.rows;
            } else {
                rows = ClipHub.Repository.listItems(
                    toQueryOptions({
                        previewOnly: true,
                        limit: requestedLimit,
                        offset: options.offset === undefined ?
                            0 : options.offset
                    }));
                rows = sortRows(rows);
                resultHasMore = false;
                previewRows = rows;
                resetDataWindowState(true);
                paginationState.loadedCount =
                    previewRows.length;
                paginationState.totalCount =
                    previewRows.length;
                paginationState.totalPages =
                    previewRows.length > 0 ? 1 : 0;
                paginationState.hasMore = false;
                paginationState.endCursor = null;
            }
            if (ClipHub.List &&
                    typeof ClipHub.List.setItems === "function") {
                ClipHub.List.setItems(previewRows);
            }
            state.applyCount += 1;
            if (options.fromEvent === true) {
                state.eventApplyCount += 1;
            }
            state.lastResultCount = previewRows.length;
            state.loadedResultCount = previewRows.length;
            state.resultPageSize =
                Number(paginationState.pageSize);
            state.resultPageLimit = resultPageLimit;
            state.resultHasMore = resultHasMore;
            thread = Thread.currentThread();
            state.lastApplyThreadId =
                Number(thread.getId());
            state.lastApplyThreadName =
                String(thread.getName());
            state.lastError = null;
            emitChanged(previewRows,
                options.origin ||
                (options.fromEvent ?
                    "event" : "manual"));
            return previewRows;
        } catch (error) {
            state.lastError = String(error);
            paginationState.lastError =
                String(error);
            throw error;
        }
    }

    function applyIfRequested(options) {
        options = options || {};
        if (options.apply === false || !ready) {
            return copyValue(value);
        }
        if (mutationRefreshPlan !== null &&
                mutationRefreshPlan.criteriaChanged === true &&
                state.panelAttached) {
            return requireMain(runOnMainSync(function () {
                refreshMutationResultsOnMain(
                    options.origin || "criteria_refresh");
                return copyValue(value);
            }, 10000));
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
        var plan;
        patch = patch || {};
        options = options || {};
        if (options.apply !== false && ready && state.panelAttached) {
            plan = rememberMutationRefresh(
                "criteria_changed",
                String(options.origin || "criteria_patch"),
                String(options.origin || "criteria_patch"), false);
            plan.criteriaChanged = true;
        } else {
            cancelMutationRefresh("criteria_patch");
        }
        resetResultPaging("criteria_patch");
        if (patch.hasOwnProperty("keyword")) {
            value.keyword = normalizeText(patch.keyword);
        }
        if (patch.hasOwnProperty("sourcePackages")) {
            value.sourcePackages = normalizeList(patch.sourcePackages);
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
        var plan;
        options = options || {};
        if (options.apply !== false && ready && state.panelAttached) {
            plan = rememberMutationRefresh(
                "criteria_changed", "criteria_reset",
                String(options.origin || "criteria_reset"), false);
            plan.criteriaChanged = true;
        } else {
            cancelMutationRefresh("criteria_reset");
        }
        resetResultPaging("criteria_reset");
        value = emptyValue();
        return applyIfRequested(options);
    }

    function onClipboardChange(payload, eventName) {
        var wasActive;
        var nextIds;
        var index;
        var deletedId;
        var action;
        var itemId;
        if (!ready) { return; }
        eventName = String(eventName || "clipboard_changed");
        wasActive = isActive(value);
        action = mutationAction(eventName, payload);
        itemId = payload && payload.id !== undefined ?
            Number(payload.id) :
            (payload && payload.itemId !== undefined &&
                payload.itemId !== null ?
                Number(payload.itemId) : null);
        mutationState.eventCount += 1;
        mutationState.lastEventName = eventName;
        mutationState.lastAction = action;
        if (action === "tag_deleted") {
            deletedId = Number(payload.tagId);
            nextIds = [];
            for (index = 0; index < value.tagIds.length; index += 1) {
                if (Number(value.tagIds[index]) !== deletedId) {
                    nextIds.push(value.tagIds[index]);
                }
            }
            value.tagIds = nextIds;
        }
        optionCountsDirty = true;
        if (state.panelAttached &&
                (eventName === "clipboard_added" ||
                    action === "clipboard_added" ||
                    action === "inserted" ||
                    action === "created") &&
                !isLatestResultPosition()) {
            pendingNewItemId = itemId;
            mutationState.addedPendingCount += 1;
            markNewContentPending("clipboard_added");
            return;
        }
        if (eventName === "tags_changed" &&
                paginationState.newContentPending === true &&
                pendingNewItemId !== null &&
                itemId !== null &&
                Number(itemId) === Number(pendingNewItemId)) {
            mutationState.relatedEventSuppressedCount += 1;
            mutationState.lastOrigin =
                "pending_new_item_related_tag";
            return;
        }
        if (state.panelAttached &&
                (eventName === "clipboard_added" ||
                    action === "clipboard_added" ||
                    action === "inserted" ||
                    action === "created")) {
            pendingNewItemId = null;
            cancelMutationRefresh("clipboard_added_latest");
            virtualState.anchorItemId = null;
            virtualState.anchorIndex = -1;
            virtualState.anchorOffsetPx = 0;
            virtualState.scrollToTopPending = true;
        }
        markPanelDataDirty("clipboard_event");
        if (!state.panelAttached) { return; }
        rememberMutationRefresh(eventName, action,
            "clipboard_event", false);
        if (!wasActive && !isActive(value) && payload &&
                (action === "clipboard_merged" ||
                    action === "merged")) {
            scheduleCoalescedRefresh("clipboard_merged");
            return;
        }
        scheduleCoalescedRefresh("clipboard_event");
    }

    function registerEvent(name) {
        var eventName = String(name);
        var listener = eventName ===
            "pagination_settings_changed" ?
                onPaginationSettingsChanged :
                function (payload) {
                    return onClipboardChange(payload, eventName);
                };
        if (ClipHub.EventBus &&
                typeof ClipHub.EventBus.on === "function") {
            ClipHub.EventBus.on(name, listener);
            eventListeners.push({
                name: name,
                listener: listener
            });
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
    }

    function requestKeyboardOnMain() {
        var target = keywordInput;
        var generation = searchGeneration;
        var focused = false;
        if (target === null) {
            return false;
        }
        startFilterImeAvoidance();
        try {
            focused = target.requestFocus();
        } catch (ignoredFocus) {}
        state.inputFocused = focused || target.hasFocus();
        state.keyboardRequestCount += 1;
        mainHandler.postDelayed(new Packages.java.lang.Runnable({
            run: function () {
                if (!state.panelAttached || target === null ||
                        target !== keywordInput || !searchExpanded ||
                        generation !== searchGeneration) {
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
            if (searchExpanded) {
                searchExpanded = false;
                state.searchCollapseCount += 1;
            }
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
        return String(Number(option.id));
    }

    function optionLabel(option, kind) {
        if (kind === "source") {
            return sourceLabel(option);
        }
        return String(option.name);
    }

    function selectedList(kind) {
        if (kind === "source") {
            return value.sourcePackages;
        }
        return value.tagIds;
    }

    function clearKind(kind) {
        if (kind === "source") {
            state.sourceToggleCount += 1;
            setValue({ sourcePackages: [] }, {
                origin: "ui_source_all"
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
        return Math.min(202, Math.max(44, 22 + units * 10));
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
        } else {
            (function (target, view) {
                view.setOnClickListener(new JavaAdapter(
                    View.OnClickListener, {
                        onClick: function () {
                            toggleTag(Number(target));
                        }
                    }));
                tagViews[target] = view;
            }(key, chip));
        }
    }

    function adaptiveSourceGridMetrics(itemCount) {
        var availableWidth = availableResultWidthPx();
        var fontScale = resourceFontScale();
        var outerInset = Math.max(touchSlop * 2,
            Math.round(availableWidth * 0.055));
        var usableWidth = Math.max(touchSlop * 12,
            availableWidth - outerInset);
        var gapPx = Math.max(1, Math.round(Math.max(touchSlop,
            usableWidth * 0.018) * 0.48));
        var minimumCellWidth = Math.max(touchSlop * 7,
            Math.round(usableWidth * (0.21 +
                Math.max(0, fontScale - 1) * 0.05)));
        var maxColumns = Math.floor((usableWidth + gapPx) /
            Math.max(1, minimumCellWidth + gapPx));
        maxColumns = Math.max(1, Math.min(4,
            Math.min(Math.max(1, Number(itemCount || 1)), maxColumns)));
        return {
            gapPx: gapPx,
            maxColumns: maxColumns
        };
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
        var sourceMetrics = null;
        var sourceRowTarget = 0;
        var sourceRowItems = 0;
        var sourceRemaining = 0;
        var sourceRowsRemaining = 0;
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
        if (kind === "source") {
            sourceMetrics = adaptiveSourceGridMetrics(items.length);
            sourceRemaining = items.length;
            sourceRowsRemaining = Math.max(1, Math.ceil(
                items.length / sourceMetrics.maxColumns));
        }
        for (index = 0; index < items.length; index += 1) {
            key = items[index].key;
            label = items[index].label;
            selected = items[index].all ?
                selectedList(kind).length === 0 :
                contains(selectedList(kind), key);
            chip = makeChip(label, selected, colors, true);
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
            if (kind === "source") {
                if (row === null || sourceRowItems >= sourceRowTarget) {
                    sourceRowTarget = Math.max(1, Math.ceil(
                        sourceRemaining / sourceRowsRemaining));
                    row = new LinearLayout(appContext);
                    row.setOrientation(LinearLayout.HORIZONTAL);
                    row.setGravity(Gravity.CENTER_VERTICAL);
                    params = new LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.MATCH_PARENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT);
                    if (rowCount > 0) {
                        params.topMargin = sourceMetrics.gapPx;
                    }
                    root.addView(row, params);
                    sourceRowItems = 0;
                    rowCount += 1;
                }
                params = new LinearLayout.LayoutParams(0,
                    LinearLayout.LayoutParams.WRAP_CONTENT, 1);
                if (sourceRowItems > 0) {
                    params.leftMargin = sourceMetrics.gapPx;
                }
                row.addView(chip, params);
                sourceRowItems += 1;
                sourceRemaining -= 1;
                if (sourceRowItems >= sourceRowTarget) {
                    sourceRowsRemaining = Math.max(0,
                        sourceRowsRemaining - 1);
                }
                continue;
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
        if (optionCountsCache !== null && !optionCountsDirty) {
            return optionCountsCache;
        }
        optionCountsCache = {
            sources: ClipHub.Repository.listSourceOptions(),
            tags: ClipHub.Repository.listTags()
        };
        optionCountsDirty = false;
        return optionCountsCache;
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
        var geometry;
        var metrics;
        var screenWidthDp;
        var screenHeightDp;
        var widthDp;
        var heightDp;
        if (ClipHub.Window &&
                typeof ClipHub.Window.computeGeometry === "function") {
            geometry = ClipHub.Window.computeGeometry(
                rootMode ? "primary" : "filter_overlay", {
                    useSaved: true
                });
            return geometry;
        }
        metrics = displayMetrics();
        screenWidthDp = Number(metrics.widthPixels) / density;
        screenHeightDp = Number(metrics.heightPixels) / density;
        widthDp = Math.min(390, Math.max(300, screenWidthDp - 20));
        heightDp = Math.min(720, Math.max(360, screenHeightDp * 0.82));
        return {
            x: 0,
            y: 0,
            width: dp(widthDp),
            height: dp(heightDp),
            widthDp: widthDp,
            heightDp: heightDp
        };
    }

    function updatePanelSize() {
        var size;
        var targetRoot;
        if (panelRoot === null || panelParams === null) { return false; }
        if (!state.panelAttached) { return true; }
        if (panelWindowRoot !== null && ClipHub.Window &&
                typeof ClipHub.Window.refreshWindow === "function") {
            ClipHub.Window.refreshWindow(panelWindowRoot,
                "filter_content_changed");
            return true;
        }
        size = panelDimensions();
        panelParams.width = size.width;
        panelParams.height = size.height;
        panelParams.gravity = Gravity.TOP | Gravity.START;
        panelParams.x = Number(size.x || 0);
        panelParams.y = Number(size.y || 0);
        state.panelX = Number(size.x || 0);
        state.panelY = Number(size.y || 0);
        state.panelWidthPx = size.width;
        state.panelHeightPx = size.height;
        state.panelWidthDp = size.widthDp;
        state.panelHeightDp = size.heightDp;
        targetRoot = panelWindowRoot !== null ? panelWindowRoot : panelRoot;
        try { windowManager.updateViewLayout(targetRoot, panelParams); }
        catch (ignoredUpdate) {}
        return true;
    }

    function makeSourceIcon(row, colors) {
        var holder = new FrameLayout(appContext);
        var image;
        var drawable = null;
        var constantState = null;
        var fallback;
        var packageName = String(row.source_package || "");
        holder.setBackground(circleBackground(colors.surfaceMuted, null));
        try {
            if (packageName.length > 0) {
      constantState = sourceIconConstantStateCache[packageName];
      if (constantState !== null &&
              constantState !== undefined) {
          try { drawable = constantState.newDrawable(); }
          catch (ignoredCachedDrawable) { drawable = null; }
      }
      if (drawable === null) {
          drawable = appContext.getPackageManager()
              .getApplicationIcon(packageName);
          try {
              constantState = drawable.getConstantState();
              if (constantState !== null) {
                  sourceIconConstantStateCache[packageName] =
                      constantState;
              }
          } catch (ignoredConstantState) {}
      }
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
            fallback = makeText("剪", 14, colors.accentStrong, true);
            fallback.setGravity(Gravity.CENTER);
            holder.addView(fallback, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));
        }
        return holder;
    }

    function tagsForResult(row) {
        var key = row && row.id !== undefined ? String(row.id) : "";
        return resultTagMap[key] || [];
    }

    function tagSummary(tags) {
        var labels = [];
        var index;
        tags = tags || [];
        for (index = 0; index < tags.length && index < 2; index += 1) {
            labels.push(String(tags[index].name || ""));
        }
        if (tags.length > 2) { labels.push("+" + String(tags.length - 2)); }
        return labels.length > 0 ? labels.join("  ") : "无标签";
    }

    function tagColorText(tag, fallback) {
        var value;
        var hex;
        if (!tag || tag.color_value === null || tag.color_value === undefined) {
            return String(fallback || "#7C5CFC");
        }
        value = Number(tag.color_value) >>> 0;
        hex = value.toString(16).toUpperCase();
        while (hex.length < 8) { hex = "0" + hex; }
        return "#" + hex;
    }

    function selectedResultRow() {
        var index;
        if (selectedItemId === null) { return null; }
        for (index = 0; index < previewRows.length; index += 1) {
            if (Number(previewRows[index].id) === Number(selectedItemId)) {
                if (isDataWindowStub(previewRows[index])) {
                    hydrateDataWindowRange(
                        index, index,
                        "selected_result_hydrate");
                }
                if (index >= previewRows.length ||
                        Number(previewRows[index].id) !==
                            Number(selectedItemId)) {
                    return null;
                }
                return previewRows[index];
            }
        }
        return null;
    }

    function setSelectedResult(row) {
        selectedItemId = SELECTION_ENABLED && row !== null &&
            row !== undefined ? Number(row.id) : null;
        state.selectedItemId = selectedItemId;
        state.selectionMode = SELECTION_ENABLED && selectedItemId !== null;
        return selectedItemId;
    }

    function clearSelectedResult() {
        setSelectedResult(null);
        return true;
    }

    function refreshPrimaryResults(origin) {
        origin = String(origin || "primary_action");
        rememberMutationRefresh(
            "primary_action", origin, origin, false);
        refreshMutationResultsOnMain(origin);
        return true;
    }

    function showInputToast(message) {
        try {
            Packages.android.widget.Toast.makeText(
                appContext, String(message),
                Packages.android.widget.Toast.LENGTH_SHORT).show();
            return true;
        } catch (ignored) {
            return false;
        }
    }

    function inputContextPendingError(error) {
        return String(error || "").indexOf("No Input context") >= 0;
    }

    function executeInputText(text) {
        var InputTextAction;
        var action;
        if (typeof shortx === "undefined" ||
                typeof shortx.executeAction !== "function") {
            throw new Error("ShortX executeAction unavailable");
        }
        InputTextAction =
            Packages.tornaco.apps.shortx.core.proto.action.InputText;
        action = InputTextAction.newBuilder()
            .setText(String(text))
            .setId("ClipHub#InputText")
            .setNote("ClipHub 列表正文单击输入")
            .build();
        return shortx.executeAction(action);
    }

    function finishInputDispatch(success, error, attempt) {
        inputDispatchPending = false;
        state.lastInputAttemptCount = Number(attempt || 0);
        state.lastInputAt = Number(
            Packages.java.lang.System.currentTimeMillis());
        if (success === true) {
            state.inputSuccessCount += 1;
            state.lastInputError = null;
            state.lastError = null;
            showInputToast("已输入");
            return true;
        }
        state.inputFailureCount += 1;
        state.lastInputError = String(error || "InputText failed");
        state.lastError = "InputText failed: " + state.lastInputError;
        showInputToast(inputContextPendingError(error) ?
            "未找到可输入的文本框" : "输入失败");
        return false;
    }

    function scheduleInputAttempt(text, generation, attempt, delayMs) {
        var posted;
        if (mainHandler === null) {
            return finishInputDispatch(false,
                "Main handler unavailable", attempt);
        }
        posted = mainHandler.postDelayed(new Packages.java.lang.Runnable({
            run: function () {
                if (!ready || generation !== inputDispatchGeneration) {
                    return;
                }
                state.lastInputAttemptCount = Number(attempt);
                try {
                    executeInputText(text);
                    finishInputDispatch(true, null, attempt);
                } catch (error) {
                    if (inputContextPendingError(error) &&
                            attempt < INPUT_MAX_ATTEMPTS) {
                        state.inputRetryCount += 1;
                        scheduleInputAttempt(text, generation,
                            attempt + 1, INPUT_RETRY_DELAY_MS);
                        return;
                    }
                    finishInputDispatch(false, error, attempt);
                }
            }
        }), Number(delayMs));
        if (posted !== true) {
            return finishInputDispatch(false,
                "Input callback post failed", attempt);
        }
        return true;
    }

    function fullResultRowById(row, origin) {
        var itemId;
        var full;
        if (row === null || row === undefined) {
            return null;
        }
        itemId = Number(row.id);
        full = ClipHub.Repository.getItem(itemId, false);
        if (full === null || full === undefined) {
            state.lastError = "Result item missing: " + String(itemId) +
                " · " + String(origin || "full_row");
            return null;
        }
        return full;
    }

    function inputResultRow(row, origin) {
        var full = fullResultRowById(row, "input");
        if (full === null) {
            showInputToast("记录已不存在");
            return false;
        }
        var text;
        var generation;
        var closeResult;
        if (row === null || row === undefined) {
            return false;
        }
        text = String(full.content || "");
        if (text.length === 0) {
            state.lastInputError = "Input text must not be empty";
            showInputToast("文本为空");
            return false;
        }
        if (inputDispatchPending) {
            state.inputDuplicateBlockedCount += 1;
            return false;
        }
        inputDispatchPending = true;
        inputDispatchGeneration += 1;
        generation = inputDispatchGeneration;
        state.resultCardClickCount += 1;
        state.inputActionCount += 1;
        state.lastInputItemId = Number(row.id);
        state.lastInputContentLength = text.length;
        state.lastInputAttemptCount = 0;
        state.lastInputOrigin = String(origin || "card_click");
        state.lastInputError = null;
        try {
            closeResult = closePanel({
                restoreList: false,
                reason: "input_text_prepare"
            });
            if (closeResult && closeResult.ok === false) {
                throw new Error("ClipHub panel close failed");
            }
        } catch (error) {
            return finishInputDispatch(false, error, 0);
        }
        scheduleInputAttempt(text, generation, 1,
            INPUT_FOCUS_DELAY_MS);
        return true;
    }

    function copyResultRow(row, origin) {
        var full = fullResultRowById(row, "copy");
        if (full === null) {
            return false;
        }
        var result;
        var copied = false;
        var closeAfter = false;
        var actionOrigin = String(origin || "card_click");
        if (row === null || row === undefined) { return false; }
        try {
            result = ClipHub.Clipboard.writeText(String(full.content || ""), {
                label: "ClipHub",
                sensitive: Number(full.is_sensitive || 0) === 1
            });
            copied = result && result.ok === true;
            if (actionOrigin === "card_click") {
                state.resultCardClickCount += 1;
            }
            if (actionOrigin === "card_action_copy") {
                state.cardCopyActionCount += 1;
            }
            state.copyActionCount += 1;
            try {
                closeAfter = ClipHub.Settings &&
                    ClipHub.Settings.get("closeAfterCopy", false) === true;
            } catch (ignoredSetting) {}
            if (copied && !closeAfter) {
                attachCopyFeedbackBanner();
            }
            if (closeAfter) {
                closePanel({
                    restoreList: false,
                    reason: "copy_close"
                });
            }
            return copied;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function selectResultRow(row) {
        clearSelectedResult();
        return false;
    }

    function toggleResultPinned(row) {
        var changed;
        if (row === null || row === undefined || !ClipHub.List ||
                typeof ClipHub.List.togglePinned !== "function") {
            return false;
        }
        captureScrollAnchor();
        changed = ClipHub.List.togglePinned(Number(row.id));
        if (changed) {
            state.pinActionCount += 1;
            refreshPrimaryResults("primary_pin");
        }
        return changed === true;
    }

    function editResultRow(row, origin) {
        if (row === null || row === undefined || !ClipHub.Editor ||
                typeof ClipHub.Editor.openItem !== "function") {
            return false;
        }
        try {
            state.editActionCount += 1;
            if (String(origin || "") === "card_action_edit") {
                state.cardEditActionCount += 1;
            }
            ClipHub.Editor.openItem(Number(row.id));
            state.lastError = null;
            return true;
        } catch (error) {
            state.lastError = "Editor open failed: " + String(error);
            return false;
        }
    }

    function editSelectedResult() {
        return editResultRow(selectedResultRow(), "selected_edit");
    }

    function addNewResult() {
        if (!ClipHub.Editor ||
                typeof ClipHub.Editor.openNew !== "function") {
            return false;
        }
        state.addActionCount += 1;
        ClipHub.Editor.openNew();
        return true;
    }

    function deleteResultRow(row, origin) {
        var changed;
        var actionOrigin = String(origin || "primary_delete");
        if (row === null || row === undefined || !ClipHub.List ||
                typeof ClipHub.List.deleteItem !== "function") {
            return false;
        }
        captureScrollAnchor();
        changed = ClipHub.List.deleteItem(Number(row.id));
        if (changed) {
            state.deleteActionCount += 1;
            if (actionOrigin === "card_action_delete") {
                state.cardDeleteActionCount += 1;
            }
            if (selectedItemId !== null &&
                    Number(selectedItemId) === Number(row.id)) {
                clearSelectedResult();
            }
            clearCopyFeedback();
            rememberDeleteUndo(row);
            refreshPrimaryResults(actionOrigin);
            attachDeleteUndoBanner();
        }
        return changed === true;
    }

    function deleteSelectedResult() {
        return deleteResultRow(selectedResultRow(), "primary_delete");
    }

    function translateResultRow(row, origin) {
        if (row === null || row === undefined || !ClipHub.Translation ||
                typeof ClipHub.Translation.openForItem !== "function") {
            return false;
        }
        try {
            ClipHub.Translation.openForItem(Number(row.id));
            state.detailActionCount += 1;
            if (String(origin || "") === "card_action_translate") {
                state.cardTranslateActionCount += 1;
            }
            state.lastError = null;
            return true;
        } catch (error) {
            state.lastError = "Translation open failed: " + String(error);
            return false;
        }
    }

    function openSelectedDetail() {
        return translateResultRow(selectedResultRow(), "selected_translate");
    }

    function swipeInteractionBlocked() {
        var windowBusy = false;
        if (!rootMode || advancedVisible || selectedItemId !== null) {
            return true;
        }
        try {
            windowBusy = ClipHub.Window &&
                ((typeof ClipHub.Window.isMoving === "function" &&
                    ClipHub.Window.isMoving()) ||
                (typeof ClipHub.Window.isResizing === "function" &&
                    ClipHub.Window.isResizing()));
        } catch (ignoredWindowState) {
            windowBusy = false;
        }
        return windowBusy;
    }

    function makeSwipeAction(label, fill, textColor, gravityValue,
            metrics) {
        var view = makeText(label, metrics.swipeTextSp, textColor, true);
        view.setGravity(gravityValue | Gravity.CENTER_VERTICAL);
        view.setPadding(metrics.swipeHorizontalPaddingPx, 0,
            metrics.swipeHorizontalPaddingPx, 0);
        view.setBackground(roundedBackground(fill, null,
            metrics.actionRadiusDp));
        view.setAlpha(0);
        return view;
    }

    function safeColorInt(value, fallback) {
        try { return Color.parseColor(String(value)); }
        catch (ignoredColor) { return Color.parseColor(String(fallback)); }
    }

    function makeVectorIconDrawable(kind, colorValue, iconSizePx,
            strokeWidthPx) {
        var paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        var path = new Path();
        var drawable;
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setStrokeJoin(Paint.Join.ROUND);
        paint.setStrokeWidth(Number(strokeWidthPx));
        paint["setColor(int)"](safeColorInt(colorValue, "#FF5A37E6"));
        drawable = new JavaAdapter(Drawable, {
            draw: function (canvas) {
                var bounds = drawable.getBounds();
                var width = Number(bounds.width());
                var height = Number(bounds.height());
                var size = Math.min(width, height,
                    Math.max(1, Number(iconSizePx)));
                var left = Number(bounds.left) + (width - size) / 2;
                var top = Number(bounds.top) + (height - size) / 2;
                var right = left + size;
                var bottom = top + size;
                var radius = Math.max(1, size * 0.08);
                var rect;
                path.reset();
                paint.setStyle(Paint.Style.STROKE);
                if (kind === "edit") {
                    path.moveTo(left + size * 0.25, top + size * 0.72);
                    path.lineTo(left + size * 0.66, top + size * 0.31);
                    path.lineTo(left + size * 0.79, top + size * 0.44);
                    path.lineTo(left + size * 0.38, top + size * 0.85);
                    path.lineTo(left + size * 0.23, top + size * 0.88);
                    path.close();
                    canvas.drawPath(path, paint);
                    canvas.drawLine(left + size * 0.61, top + size * 0.36,
                        left + size * 0.74, top + size * 0.49, paint);
                    return;
                }
                if (kind === "translate") {
                    rect = new RectF(left + size * 0.19, top + size * 0.19,
                        right - size * 0.19, bottom - size * 0.19);
                    canvas.drawOval(rect, paint);
                    canvas.drawOval(new RectF(left + size * 0.37,
                        top + size * 0.19, right - size * 0.37,
                        bottom - size * 0.19), paint);
                    canvas.drawLine(left + size * 0.20, top + size * 0.50,
                        right - size * 0.20, top + size * 0.50, paint);
                    canvas.drawLine(left + size * 0.28, top + size * 0.34,
                        right - size * 0.28, top + size * 0.34, paint);
                    canvas.drawLine(left + size * 0.28, top + size * 0.66,
                        right - size * 0.28, top + size * 0.66, paint);
                    return;
                }
                if (kind === "copy") {
                    canvas.drawRoundRect(new RectF(left + size * 0.34,
                        top + size * 0.20, right - size * 0.17,
                        bottom - size * 0.31), radius, radius, paint);
                    canvas.drawRoundRect(new RectF(left + size * 0.18,
                        top + size * 0.35, right - size * 0.33,
                        bottom - size * 0.16), radius, radius, paint);
                    return;
                }
                if (kind === "delete") {
                    canvas.drawLine(left + size * 0.22, top + size * 0.30,
                        right - size * 0.22, top + size * 0.30, paint);
                    canvas.drawLine(left + size * 0.40, top + size * 0.21,
                        right - size * 0.40, top + size * 0.21, paint);
                    canvas.drawRoundRect(new RectF(left + size * 0.29,
                        top + size * 0.34, right - size * 0.29,
                        bottom - size * 0.17), radius, radius, paint);
                    canvas.drawLine(left + size * 0.42, top + size * 0.45,
                        left + size * 0.42, bottom - size * 0.28, paint);
                    canvas.drawLine(right - size * 0.42, top + size * 0.45,
                        right - size * 0.42, bottom - size * 0.28, paint);
                    return;
                }
                if (kind === "pin") {
                    paint.setStyle(Paint.Style.FILL);
                    path.moveTo(left + size * 0.31, top + size * 0.20);
                    path.lineTo(right - size * 0.31, top + size * 0.20);
                    path.lineTo(right - size * 0.36, top + size * 0.43);
                    path.lineTo(right - size * 0.23, top + size * 0.57);
                    path.lineTo(left + size * 0.55, top + size * 0.57);
                    path.lineTo(left + size * 0.50, bottom - size * 0.12);
                    path.lineTo(left + size * 0.45, top + size * 0.57);
                    path.lineTo(left + size * 0.23, top + size * 0.57);
                    path.lineTo(left + size * 0.36, top + size * 0.43);
                    path.close();
                    canvas.drawPath(path, paint);
                }
            },
            setAlpha: function (alpha) { paint.setAlpha(Number(alpha)); },
            setColorFilter: function (filter) {
                paint.setColorFilter(filter);
            },
            getOpacity: function () { return PixelFormat.TRANSLUCENT; }
        });
        return drawable;
    }

    function makePinnedBadge(colors, metrics) {
        var root = new FrameLayout(appContext);
        var icon = new View(appContext);
        var params;
        root.setBackground(roundedBackground(colors.accentSoft,
            colors.accentBorder, metrics.pinBadgeRadiusDp));
        root.setContentDescription("已置顶");
        root.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_YES);
        icon.setBackground(makeVectorIconDrawable("pin",
            colors.accentStrong, metrics.pinIconSizePx,
            metrics.pinIconStrokePx));
        params = new FrameLayout.LayoutParams(metrics.pinIconSizePx,
            metrics.pinIconSizePx);
        params.gravity = Gravity.CENTER;
        root.addView(icon, params);
        return root;
    }

    function makeCardActionButton(kind, contentDescription, colors,
            danger, metrics, callback) {
        var root = new FrameLayout(appContext);
        var icon = new View(appContext);
        var params;
        root.setBackground(roundedBackground(
            colors.surface,
            danger ? colors.dangerSoft : colors.divider,
            metrics.actionRadiusDp));
        root.setClickable(true);
        root.setFocusable(true);
        root.setContentDescription(contentDescription);
        root.setOnClickListener(new JavaAdapter(
            View.OnClickListener, { onClick: callback }));
        icon.setBackground(makeVectorIconDrawable(kind,
            danger ? colors.danger : colors.textSecondary,
            metrics.actionIconSizePx, metrics.actionIconStrokePx));
        params = new FrameLayout.LayoutParams(metrics.actionIconSizePx,
            metrics.actionIconSizePx);
        params.gravity = Gravity.CENTER;
        root.addView(icon, params);
        return root;
    }

    function currentCardHolderRow(holder) {
        if (holder === null || holder === undefined ||
                holder.row === null || holder.row === undefined) {
            return null;
        }
        holder.itemId = Number(holder.row.id);
        return holder.row;
    }

    function buildCardActionGrid(holder, colors, metrics) {
        var grid = new LinearLayout(appContext);
        var top = new LinearLayout(appContext);
        var bottom = new LinearLayout(appContext);
        var edit;
        var translate;
        var copy;
        var remove;
        var params;
        grid.setOrientation(LinearLayout.VERTICAL);
        top.setOrientation(LinearLayout.HORIZONTAL);
        bottom.setOrientation(LinearLayout.HORIZONTAL);
        edit = makeCardActionButton("edit", "编辑剪贴板记录", colors,
            false, metrics, function () {
                editResultRow(currentCardHolderRow(holder),
                    "card_action_edit");
            });
        translate = makeCardActionButton("translate", "翻译剪贴板记录", colors,
            false, metrics, function () {
                translateResultRow(currentCardHolderRow(holder),
                    "card_action_translate");
            });
        copy = makeCardActionButton("copy", "复制剪贴板记录", colors,
            false, metrics, function () {
                copyResultRow(currentCardHolderRow(holder),
                    "card_action_copy");
            });
        remove = makeCardActionButton("delete", "删除剪贴板记录", colors,
            true, metrics, function () {
                deleteResultRow(currentCardHolderRow(holder),
                    "card_action_delete");
            });
        params = new LinearLayout.LayoutParams(0,
            metrics.actionCellHeightPx, 1);
        params.rightMargin = metrics.actionGapPx;
        top.addView(edit, params);
        top.addView(translate, new LinearLayout.LayoutParams(0,
            metrics.actionCellHeightPx, 1));
        params = new LinearLayout.LayoutParams(0,
            metrics.actionCellHeightPx, 1);
        params.rightMargin = metrics.actionGapPx;
        bottom.addView(copy, params);
        bottom.addView(remove, new LinearLayout.LayoutParams(0,
            metrics.actionCellHeightPx, 1));
        grid.addView(top, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            metrics.actionCellHeightPx));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            metrics.actionCellHeightPx);
        params.topMargin = metrics.actionGapPx;
        grid.addView(bottom, params);
        holder.editButton = edit;
        holder.translateButton = translate;
        holder.copyButton = copy;
        holder.deleteButton = remove;
        resultActionViews.push({
            edit: edit,
            translate: translate,
            copy: copy,
            delete: remove
        });
        state.cardActionButtonCount += 4;
        return grid;
    }

    function setSwipeVisual(foreground, deleteAction, pinAction, offset,
            revealWidth) {
        var progress = Math.min(1,
            Math.abs(Number(offset)) / Math.max(1, Number(revealWidth)));
        foreground.setTranslationX(Number(offset));
        deleteAction.setAlpha(offset > 0 ? progress : 0);
        pinAction.setAlpha(offset < 0 ? progress : 0);
    }

    function resetSwipeVisual(foreground, deleteAction, pinAction, animated) {
        if (foreground === null || foreground === undefined) { return false; }
        try { foreground.animate().cancel(); } catch (ignoredCancel) {}
        if (animated === true) {
            try {
                foreground.animate().translationX(0).setDuration(135).start();
            } catch (ignoredAnimation) {
                foreground.setTranslationX(0);
            }
        } else {
            foreground.setTranslationX(0);
        }
        deleteAction.setAlpha(0);
        pinAction.setAlpha(0);
        if (activeSwipeCard !== null &&
                activeSwipeCard.foreground === foreground) {
            activeSwipeCard = null;
        }
        if (virtualState.updateDeferred === true) {
            virtualState.updateDeferred = false;
            scheduleVirtualUpdate("swipe_release");
        }
        return true;
    }

    function cancelActiveSwipe(animated) {
        var current = activeSwipeCard;
        if (current === null) { return false; }
        resetSwipeVisual(current.foreground, current.deleteAction,
            current.pinAction, animated === true);
        activeSwipeCard = null;
        return true;
    }

    function performSwipeAction(row, direction, foreground) {
        var changed = false;
        state.lastSwipeItemId = Number(row.id);
        if (direction < 0) {
            changed = toggleResultPinned(row);
            if (changed) {
                state.swipePinCount += 1;
                state.lastSwipeAction = Number(row.is_pinned || 0) === 1 ?
                    "unpin" : "pin";
            }
        } else {
            changed = deleteResultRow(row, "swipe_delete");
            if (changed) {
                state.swipeDeleteCount += 1;
                state.lastSwipeAction = "delete";
            }
        }
        if (changed && ClipHub.Window &&
                typeof ClipHub.Window.performHaptic === "function") {
            try { ClipHub.Window.performHaptic(foreground, "confirm"); }
            catch (ignoredHaptic) {}
        }
        return changed;
    }

    function bindSwipeGesture(holder, wrapper, foreground, deleteAction,
            pinAction, metrics) {
        var gesture = {
            downX: 0,
            downY: 0,
            swiping: false,
            rejected: false,
            disabled: false,
            offset: 0
        };
        foreground.setOnTouchListener(new JavaAdapter(
            View.OnTouchListener, {
                onTouch: function (target, event) {
                    var action = Number(event.getActionMasked());
                    var rawX = Number(event.getRawX());
                    var rawY = Number(event.getRawY());
                    var deltaX;
                    var deltaY;
                    var absX;
                    var absY;
                    var offset;
                    var parent;
                    var commit;
                    var direction;
                    if (action === MotionEvent.ACTION_DOWN) {
                        gesture.downX = rawX;
                        gesture.downY = rawY;
                        gesture.swiping = false;
                        gesture.rejected = false;
                        gesture.disabled = swipeInteractionBlocked() ||
                            Number(event.getX()) > Math.max(0,
                                Number(target.getWidth()) -
                                metrics.actionGridWidthPx -
                                metrics.contentGapPx);
                        gesture.offset = 0;
                        if (!gesture.disabled) {
                            cancelActiveSwipe(true);
                            try { target.animate().cancel(); }
                            catch (ignoredAnimationCancel) {}
                        }
                        return false;
                    }
                    if (gesture.disabled) { return false; }
                    if (action === MotionEvent.ACTION_MOVE) {
                        deltaX = rawX - gesture.downX;
                        deltaY = rawY - gesture.downY;
                        absX = Math.abs(deltaX);
                        absY = Math.abs(deltaY);
                        if (!gesture.swiping && !gesture.rejected) {
                            if (absY > touchSlop && absY >= absX) {
                                gesture.rejected = true;
                                return false;
                            }
                            if (absX > touchSlop && absX > absY * 1.2) {
                                gesture.swiping = true;
                                state.swipeStartCount += 1;
                                activeSwipeCard = {
                                    foreground: foreground,
                                    deleteAction: deleteAction,
                                    pinAction: pinAction
                                };
                                try { target.setPressed(false); }
                                catch (ignoredPressed) {}
                                try {
                                    parent = wrapper.getParent();
                                    if (parent !== null) {
                                        parent.requestDisallowInterceptTouchEvent(
                                            true);
                                    }
                                } catch (ignoredParent) {}
                            }
                        }
                        if (!gesture.swiping) { return false; }
                        offset = deltaX;
                        if (Math.abs(offset) > metrics.swipeRevealWidthPx) {
                            offset = (offset < 0 ? -1 : 1) *
                                (metrics.swipeRevealWidthPx +
                                (Math.abs(offset) -
                                metrics.swipeRevealWidthPx) * 0.22);
                        }
                        offset = Math.max(-metrics.swipeMaximumOffsetPx,
                            Math.min(metrics.swipeMaximumOffsetPx, offset));
                        gesture.offset = offset;
                        setSwipeVisual(foreground, deleteAction, pinAction,
                            offset, metrics.swipeRevealWidthPx);
                        state.swipeMoveCount += 1;
                        return true;
                    }
                    if (action === MotionEvent.ACTION_UP ||
                            action === MotionEvent.ACTION_CANCEL) {
                        if (!gesture.swiping) { return false; }
                        try {
                            parent = wrapper.getParent();
                            if (parent !== null) {
                                parent.requestDisallowInterceptTouchEvent(false);
                            }
                        } catch (ignoredReleaseParent) {}
                        commit = action === MotionEvent.ACTION_UP &&
                            Math.abs(gesture.offset) >=
                                metrics.swipeCommitDistancePx;
                        direction = gesture.offset < 0 ? -1 : 1;
                        resetSwipeVisual(foreground, deleteAction, pinAction,
                            !commit);
                        if (commit) {
                            performSwipeAction(
                                currentCardHolderRow(holder),
                                direction, foreground);
                        } else {
                            state.swipeCancelCount += 1;
                        }
                        gesture.swiping = false;
                        gesture.offset = 0;
                        return true;
                    }
                    return false;
                }
            }));
        return wrapper;
    }

    function resultPreviewText(row) {
        var text = String(row && row.content || "");
        return Number(row && row.content_truncated || 0) === 1 ?
            text + "…" : text;
    }

    function makeResultCard(row, colors) {
        var selected = SELECTION_ENABLED && selectedItemId !== null &&
            Number(selectedItemId) === Number(row.id);
        var pinned = Number(row.is_pinned || 0) === 1;
        var metrics = resultCardMetrics(0);
        var wrapper = new FrameLayout(appContext);
        var actionLayer = new FrameLayout(appContext);
        var deleteAction = makeSwipeAction("删除", colors.dangerSoft,
            colors.danger, Gravity.START, metrics);
        var pinAction = makeSwipeAction(
            pinned ? "取消置顶" : "置顶",
            colors.accentSoft, colors.accentStrong, Gravity.END, metrics);
        var card = new LinearLayout(appContext);
        var icon = makeSourceIcon(row, colors);
        var center = new LinearLayout(appContext);
        var contentRow = new LinearLayout(appContext);
        var pinBadge = null;
        var content = makeText(resultPreviewText(row),
            metrics.contentTextSp, colors.textPrimary, selected);
        var metaRow = new LinearLayout(appContext);
        var tags = tagsForResult(row);
        var tagBadge = makeText((tags.length > 0 ? "●  " : "") +
            tagSummary(tags), metrics.sourceTextSp,
            tags.length > 0 ? tagColorText(tags[0], colors.accentStrong) :
                colors.textTertiary, tags.length > 0);
        var source = makeText(sourceLabel(row) + " · " +
            formatTime(row.last_copied_at), metrics.sourceTextSp,
            colors.textSecondary, false);
        var holder = {
            itemId: Number(row.id),
            row: row,
            wrapper: wrapper,
            actionLayer: actionLayer,
            deleteAction: deleteAction,
            pinAction: pinAction,
            card: card,
            iconView: icon,
            center: center,
            contentRow: contentRow,
            contentView: content,
            metaRow: metaRow,
            tagBadge: tagBadge,
            sourceView: source,
            pinBadge: null,
            actionGrid: null,
            selected: selected,
            pinned: pinned,
            metrics: metrics
        };
        var actionGrid = buildCardActionGrid(holder, colors, metrics);
        holder.actionGrid = actionGrid;
        var params;

        state.cardActionGridWidthDp = pxToDp(metrics.actionGridWidthPx);
        state.cardActionCellHeightDp = pxToDp(metrics.actionCellHeightPx);
        state.cardActionFontScale = metrics.fontScale;
        state.cardActionIconSizeDp = pxToDp(metrics.actionIconSizePx);
        state.pinBadgeSizeDp = pxToDp(metrics.pinBadgeSizePx);
        wrapper.setClipChildren(true);
        wrapper.setClipToPadding(true);
        wrapper.setBackground(roundedBackground(colors.surfaceMuted,
            colors.stroke, 12));
        actionLayer.setClipChildren(true);
        actionLayer.setClipToPadding(true);
        params = new FrameLayout.LayoutParams(metrics.swipeRevealWidthPx,
            FrameLayout.LayoutParams.MATCH_PARENT);
        params.gravity = Gravity.START | Gravity.CENTER_VERTICAL;
        actionLayer.addView(deleteAction, params);
        params = new FrameLayout.LayoutParams(metrics.swipeRevealWidthPx,
            FrameLayout.LayoutParams.MATCH_PARENT);
        params.gravity = Gravity.END | Gravity.CENTER_VERTICAL;
        actionLayer.addView(pinAction, params);
        wrapper.addView(actionLayer, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT));

        card.setOrientation(LinearLayout.HORIZONTAL);
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setPadding(metrics.cardPaddingHorizontalPx,
            metrics.cardPaddingVerticalPx,
            metrics.cardPaddingHorizontalPx,
            metrics.cardPaddingVerticalPx);
        card.setMinimumHeight(metrics.cardMinimumHeightPx);
        card.setBackground(roundedBackground(
            selected ? colors.accentSoft : colors.card,
            selected ? colors.accentBorder : colors.stroke, 12));
        card.setClickable(true);
        card.setFocusable(true);
        card.setContentDescription((pinned ? "已置顶，" : "") +
            "剪贴板记录，点击正文输入到当前文本框，左滑置顶，右滑删除，右侧提供编辑翻译复制删除图标");
        card.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () {
                    inputResultRow(currentCardHolderRow(holder),
                        "card_click");
                }
            }));

        params = new LinearLayout.LayoutParams(metrics.iconSizePx,
            metrics.iconSizePx);
        params.rightMargin = metrics.contentGapPx;
        card.addView(icon, params);

        center.setOrientation(LinearLayout.VERTICAL);
        contentRow.setOrientation(LinearLayout.HORIZONTAL);
        contentRow.setGravity(Gravity.TOP);
        content.setMaxLines(2);
        content.setEllipsize(TextUtils.TruncateAt.END);
        contentRow.addView(content, new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        if (pinned) {
            pinBadge = makePinnedBadge(colors, metrics);
            holder.pinBadge = pinBadge;
            params = new LinearLayout.LayoutParams(metrics.pinBadgeSizePx,
                metrics.pinBadgeSizePx);
            params.leftMargin = metrics.pinBadgeGapPx;
            contentRow.addView(pinBadge, params);
            state.pinnedBadgeCount += 1;
        }
        center.addView(contentRow, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        metaRow.setOrientation(LinearLayout.HORIZONTAL);
        metaRow.setGravity(Gravity.CENTER_VERTICAL);
        tagBadge.setPadding(metrics.baseUnitPx,
            Math.max(1, Math.round(metrics.baseUnitPx * 0.28)),
            metrics.baseUnitPx,
            Math.max(1, Math.round(metrics.baseUnitPx * 0.28)));
        tagBadge.setSingleLine(true);
        tagBadge.setMaxLines(1);
        tagBadge.setEllipsize(TextUtils.TruncateAt.END);
        tagBadge.setBackground(roundedBackground(
            tags.length > 0 ? colors.accentSoft : colors.surfaceMuted,
            null, metrics.actionRadiusDp));
        params = new LinearLayout.LayoutParams(metrics.tagWidthPx,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.rightMargin = metrics.contentGapPx;
        metaRow.addView(tagBadge, params);
        state.renderedTagLabelCount += Math.min(2, tags.length);
        if (tags.length > 0) { state.tagColorPreviewCount += 1; }
        source.setSingleLine(true);
        source.setEllipsize(TextUtils.TruncateAt.END);
        metaRow.addView(source, new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        center.addView(metaRow, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        params = new LinearLayout.LayoutParams(0,
            LinearLayout.LayoutParams.WRAP_CONTENT, 1);
        params.rightMargin = metrics.contentGapPx;
        card.addView(center, params);
        card.addView(actionGrid, new LinearLayout.LayoutParams(
            metrics.actionGridWidthPx, metrics.actionGridHeightPx));

        wrapper.addView(card, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT));
        bindSwipeGesture(holder, wrapper, card, deleteAction, pinAction, metrics);
        resultCardViews.push(card);
        state.resultCardCount += 1;
        return wrapper;
    }

    function updateResultScrollState() {
        try {
            state.resultCanScroll = resultScrollView !== null &&
                resultScrollView.canScrollVertically(1);
        } catch (ignored) {
            state.resultCanScroll = false;
        }
        return state.resultCanScroll;
    }

    function finishAjaxAppendRender(generation,
            appendedRows, colors) {
        if (generation !== ajaxAppendGeneration ||
                !state.panelAttached) {
            return false;
        }
        ajaxFooterState.loading = false;
        ajaxFooterState.successCount += 1;
        ajaxFooterState.appendedRowCount +=
            appendedRows.length;
        measureVirtualCards();
        restoreScrollAnchor();
        ajaxFooterState.lastScrollYAfterAppend =
            currentResultScrollY();
        ajaxFooterState.positionPreserved =
            Number(ajaxFooterState
                .lastScrollYBeforeAppend) ===
            Number(ajaxFooterState
                .lastScrollYAfterAppend);
        if (!paginationState.hasMore) {
            ajaxFooterState.endCount += 1;
        }
        state.loadMoreCount += 1;
        state.loadedResultCount = previewRows.length;
        state.resultHasMore =
            paginationState.hasMore === true;
        state.resultPageLimit = Math.max(
            Number(paginationState.pageSize),
            previewRows.length);
        state.contentReady = true;
        if (ClipHub.List &&
                typeof ClipHub.List.setItems === "function") {
            ClipHub.List.setItems(previewRows);
        }
        appendLoadMoreControl(colors);
        updateResultCountOnMain();
        updateQuickResetView();
        attachDeleteUndoBanner();
        updateResultScrollState();
        if (lazyLoadState.pending) {
            lazyLoadState.pending = false;
            lazyLoadState.successCount += 1;
            lazyLoadState.lastError = null;
        }
        scheduleNextPagePrefetch(
            "ajax_append_complete");
        if (mainHandler !== null) {
            mainHandler.post(new Packages.java.lang.Runnable({
                run: function () {
                    if (!state.panelAttached) { return; }
                    measureVirtualCards();
                    restoreScrollAnchor();
                    captureScrollAnchor();
                    ajaxFooterState.lastScrollYAfterAppend =
                        currentResultScrollY();
                    ajaxFooterState.positionPreserved =
                        Number(ajaxFooterState
                            .lastScrollYBeforeAppend) ===
                        Number(ajaxFooterState
                            .lastScrollYAfterAppend);
                }
            }));
        }
        return true;
    }

    function renderAjaxAppendBatch(context) {
        var end;
        var index;
        var params;
        if (context.generation !== ajaxAppendGeneration ||
                resultContainer === null ||
                !state.panelAttached) {
            ajaxFooterState.loading = false;
            return false;
        }
        end = Math.min(context.rows.length,
            context.index + RENDER_BATCH_COUNT);
        for (index = context.index; index < end;
                index += 1) {
            params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
            params.bottomMargin = dp(6);
            resultContainer.addView(makeResultCard(
                context.rows[index],
                context.colors), params);
        }
        context.index = end;
        ajaxFooterState.renderBatchCount += 1;
        if (context.index < context.rows.length) {
            if (context.synchronous === true) {
                return true;
            }
            if (mainHandler !== null) {
                mainHandler.post(
                    new Packages.java.lang.Runnable({
                        run: function () {
                            renderAjaxAppendBatch(context);
                        }
                    }));
                return true;
            }
        }
        return finishAjaxAppendRender(
            context.generation,
            context.rows,
            context.colors);
    }

    function startAjaxAppendRender(appendedRows) {
        var colors = palette();
        captureScrollAnchor();
        if (loadMoreView !== null) {
            try {
                if (loadMoreView.getParent() !== null) {
                    loadMoreView.getParent()
                        .removeView(loadMoreView);
                }
            } catch (ignoredFooterRemove) {}
        }
        loadMoreView = null;
        ajaxAppendGeneration += 1;
        ajaxFooterState.renderBatchCount += 1;
        rebuildVirtualWindow(
            "ajax_append", false,
            virtualState.firstVisibleIndex);
        return finishAjaxAppendRender(
            ajaxAppendGeneration,
            appendedRows, colors);
    }

    function loadMoreResults(origin) {
        var pageResult;
        var lazyOrigin;
        origin = String(origin || "footer_click");
        lazyOrigin = origin !== "footer_click";
        if (!state.panelAttached ||
                paginationState.mode !== "ajax" ||
                !paginationState.hasMore) {
            if (!lazyOrigin) {
                ajaxFooterState.blockedClickCount += 1;
            }
            return false;
        }
        if (ajaxFooterState.loading) {
            if (!lazyOrigin) {
                ajaxFooterState.blockedClickCount += 1;
            }
            return false;
        }
        if (!lazyOrigin) {
            ajaxFooterState.clickCount += 1;
        }
        ajaxFooterState.loading = true;
        ajaxFooterState.lastError = null;
        ajaxFooterState.lastScrollYBeforeAppend =
            currentResultScrollY();
        appendLoadMoreControl(palette());
        try {
            pageResult = loadPaginationPageInternal({
                append: true,
                includeTotal: false
            });
            return startAjaxAppendRender(
                pageResult.appendedRows);
        } catch (error) {
            ajaxFooterState.loading = false;
            ajaxFooterState.lastError =
                String(error);
            if (lazyOrigin) {
                lazyLoadState.pending = false;
                lazyLoadState.failureCount += 1;
                lazyLoadState.lastError =
                    String(error);
            }
            appendLoadMoreControl(palette());
            state.lastError = String(error);
            return false;
        }
    }

    function removePaginationFooterViews() {
        var parent;
        if (loadMoreView !== null) {
            try {
                parent = loadMoreView.getParent();
                if (parent !== null) {
                    parent.removeView(loadMoreView);
                }
            } catch (ignoredRemoveLoadMore) {}
        }
        if (numberPagerView !== null) {
            try {
                parent = numberPagerView.getParent();
                if (parent !== null) {
                    parent.removeView(numberPagerView);
                }
            } catch (ignoredRemoveNumberPager) {}
        }
        loadMoreView = null;
        numberPagerView = null;
        numberPageViews = {};
        numberActionViews = {};
        return true;
    }

    function calculatePageButtons(currentPage, totalPages) {
        var current = Math.max(1,
            Math.floor(Number(currentPage || 1)));
        var total = Math.max(0,
            Math.floor(Number(totalPages || 0)));
        var start;
        var end;
        var page;
        var output = [];
        if (total <= 0) { return output; }
        current = Math.min(current, total);
        if (total <= 7) {
            for (page = 1; page <= total; page += 1) {
                output.push({
                    type: "page",
                    page: page,
                    label: String(page)
                });
            }
            return output;
        }
        output.push({
            type: "page",
            page: 1,
            label: "1"
        });
        start = Math.max(2, current - 2);
        end = Math.min(total - 1, current + 2);
        if (end - start + 1 < 5) {
            if (start === 2) {
                end = Math.min(total - 1, start + 4);
            } else if (end === total - 1) {
                start = Math.max(2, end - 4);
            }
        }
        if (start > 2) {
            output.push({
                type: "ellipsis",
                page: null,
                label: "…"
            });
        }
        for (page = start; page <= end; page += 1) {
            output.push({
                type: "page",
                page: page,
                label: String(page)
            });
        }
        if (end < total - 1) {
            output.push({
                type: "ellipsis",
                page: null,
                label: "…"
            });
        }
        output.push({
            type: "page",
            page: total,
            label: String(total)
        });
        return output;
    }

    function numberTokenLabels(tokens) {
        var labels = [];
        var index;
        tokens = tokens || [];
        for (index = 0; index < tokens.length;
                index += 1) {
            labels.push(String(tokens[index].label));
        }
        return labels;
    }

    function makeNumberPagerButton(label, selected,
            enabled, colors, description) {
        var view = makeText(String(label), 10,
            selected ? "#FFFFFFFF" :
                (enabled ?
                    colors.accentStrong :
                    colors.textTertiary),
            selected === true);
        view.setGravity(Gravity.CENTER);
        view.setSingleLine(true);
        view.setMinWidth(dp(34));
        view.setPadding(dp(8), 0, dp(8), 0);
        view.setBackground(roundedBackground(
            selected ? colors.accentStrong :
                (enabled ?
                    colors.accentSoft :
                    colors.surfaceMuted),
            selected ? colors.accentStrong :
                (enabled ?
                    colors.accentBorder :
                    colors.stroke),
            10));
        view.setEnabled(enabled === true);
        view.setClickable(enabled === true);
        view.setFocusable(enabled === true);
        view.setAlpha(enabled || selected ? 1 : 0.52);
        view.setContentDescription(String(description || label));
        return view;
    }

    function numberActionTarget(action) {
        var current = Math.max(1,
            Number(paginationState.pageNumber || 1));
        var total = Math.max(1,
            Number(paginationState.totalPages || 1));
        action = String(action || "");
        if (action === "first") { return 1; }
        if (action === "previous") {
            return Math.max(1, current - 1);
        }
        if (action === "next") {
            return Math.min(total, current + 1);
        }
        if (action === "last") { return total; }
        return current;
    }

    function goToPage(page, origin, action) {
        var target = Math.floor(Number(page));
        var total = Math.max(1,
            Number(paginationState.totalPages || 1));
        var current = Math.max(1,
            Number(paginationState.pageNumber || 1));
        var beforeScroll;
        var afterScroll;
        action = String(action || "page");
        origin = String(origin || "number_page");
        if (!state.panelAttached ||
                paginationState.mode !== "number" ||
                numberPagerState.loading ||
                !isFinite(target)) {
            numberPagerState.blockedClickCount += 1;
            return false;
        }
        target = Math.max(1, Math.min(total, target));
        if (target === current) {
            numberPagerState.blockedClickCount += 1;
            numberPagerState.samePageBlockedCount += 1;
            return false;
        }
        beforeScroll = currentResultScrollY();
        numberPagerState.clickCount += 1;
        if (action === "page") {
            numberPagerState.pageClickCount += 1;
        } else {
            numberPagerState.actionClickCount += 1;
        }
        numberPagerState.loading = true;
        numberPagerState.lastTargetPage = target;
        numberPagerState.lastAction = action;
        numberPagerState.lastOrigin = origin;
        numberPagerState.lastScrollYBeforeChange =
            beforeScroll;
        numberPagerState.maximumScrollYBeforeChange =
            Math.max(
                Number(numberPagerState
                    .maximumScrollYBeforeChange),
                beforeScroll);
        numberPagerState.lastError = null;
        captureScrollAnchor();
        appendLoadMoreControl(palette());
        try {
            apply({
                page: target,
                origin: origin
            });
            numberPagerState.loading = false;
            numberPagerState.successCount += 1;
            numberPagerState.pageReplaceCount += 1;
            refreshResultsOnMain();
            updateResultCountOnMain();
            restoreScrollAnchor();
            afterScroll = currentResultScrollY();
            numberPagerState.lastScrollYAfterChange =
                afterScroll;
            if (beforeScroll > 0 && afterScroll === 0) {
                numberPagerState.scrollResetCount += 1;
                numberPagerState.nonZeroScrollResetCount += 1;
            }
            return true;
        } catch (error) {
            numberPagerState.loading = false;
            numberPagerState.failureCount += 1;
            numberPagerState.lastError = String(error);
            state.lastError = String(error);
            appendLoadMoreControl(palette());
            return false;
        }
    }

    function performNumberAction(action, origin) {
        var target;
        action = String(action || "");
        if (action !== "first" &&
                action !== "previous" &&
                action !== "next" &&
                action !== "last") {
            numberPagerState.blockedClickCount += 1;
            return false;
        }
        target = numberActionTarget(action);
        return goToPage(target,
            origin || ("number_" + action), action);
    }

    function addNumberPagerChild(row, view, index) {
        var params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            dp(38));
        if (index > 0) {
            params.leftMargin = dp(5);
        }
        row.addView(view, params);
    }

    function buildNumberPaginationFooter(colors) {
        var scroll;
        var row;
        var tokens;
        var index = 0;
        var token;
        var view;
        var current = Math.max(1,
            Number(paginationState.pageNumber || 1));
        var total = Math.max(0,
            Number(paginationState.totalPages || 0));
        var firstEnabled;
        var previousEnabled;
        var nextEnabled;
        var lastEnabled;
        var params;
        numberPagerState.present = false;
        numberPagerState.visible = false;
        numberPagerState.currentPage = current;
        numberPagerState.totalPages = total;
        numberPagerState.totalCount =
            Number(paginationState.totalCount);
        numberPagerState.selectedPage = current;
        numberPagerState.tokens = [];
        numberPageViews = {};
        numberActionViews = {};
        if (paginationFooterHost === null ||
                paginationState.mode !== "number" ||
                total <= 0) {
            return false;
        }
        firstEnabled = current > 1 &&
            !numberPagerState.loading;
        previousEnabled = firstEnabled;
        nextEnabled = current < total &&
            !numberPagerState.loading;
        lastEnabled = nextEnabled;
        numberPagerState.firstEnabled = firstEnabled;
        numberPagerState.previousEnabled =
            previousEnabled;
        numberPagerState.nextEnabled = nextEnabled;
        numberPagerState.lastEnabled = lastEnabled;
        tokens = calculatePageButtons(current, total);
        numberPagerState.tokens =
            numberTokenLabels(tokens);

        scroll = new HorizontalScrollView(appContext);
        scroll.setHorizontalScrollBarEnabled(false);
        scroll.setFillViewport(false);
        row = new LinearLayout(appContext);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        row.setPadding(0, dp(3), 0, dp(3));

        if (numberPagerState.loading) {
            view = makeNumberPagerButton(
                "加载中", false, false, colors,
                "正在加载数字分页");
            addNumberPagerChild(row, view, index);
            index += 1;
        }

        view = makeNumberPagerButton(
            "«", false, firstEnabled, colors,
            "首页");
        if (firstEnabled) {
            view.setOnClickListener(new JavaAdapter(
                View.OnClickListener, {
                    onClick: function () {
                        performNumberAction(
                            "first", "ui_number_first");
                    }
                }));
        }
        numberActionViews.first = view;
        addNumberPagerChild(row, view, index);
        index += 1;

        view = makeNumberPagerButton(
            "‹", false, previousEnabled, colors,
            "上一页");
        if (previousEnabled) {
            view.setOnClickListener(new JavaAdapter(
                View.OnClickListener, {
                    onClick: function () {
                        performNumberAction(
                            "previous",
                            "ui_number_previous");
                    }
                }));
        }
        numberActionViews.previous = view;
        addNumberPagerChild(row, view, index);
        index += 1;

        for (var tokenIndex = 0;
                tokenIndex < tokens.length;
                tokenIndex += 1) {
            token = tokens[tokenIndex];
            if (token.type === "ellipsis") {
                view = makeNumberPagerButton(
                    token.label, false, false,
                    colors, "省略页码");
            } else {
                view = makeNumberPagerButton(
                    token.label,
                    Number(token.page) === current,
                    Number(token.page) !== current &&
                        !numberPagerState.loading,
                    colors,
                    Number(token.page) === current ?
                        "当前第 " + token.label + " 页" :
                        "第 " + token.label + " 页");
                if (Number(token.page) !== current &&
                        !numberPagerState.loading) {
                    (function (targetPage,
                            targetView) {
                        targetView.setOnClickListener(
                            new JavaAdapter(
                                View.OnClickListener, {
                                    onClick: function () {
                                        goToPage(
                                            targetPage,
                                            "ui_number_page",
                                            "page");
                                    }
                                }));
                    }(Number(token.page), view));
                }
                numberPageViews[
                    String(Number(token.page))] = view;
            }
            addNumberPagerChild(row, view, index);
            index += 1;
        }

        view = makeNumberPagerButton(
            "›", false, nextEnabled, colors,
            "下一页");
        if (nextEnabled) {
            view.setOnClickListener(new JavaAdapter(
                View.OnClickListener, {
                    onClick: function () {
                        performNumberAction(
                            "next", "ui_number_next");
                    }
                }));
        }
        numberActionViews.next = view;
        addNumberPagerChild(row, view, index);
        index += 1;

        view = makeNumberPagerButton(
            "»", false, lastEnabled, colors,
            "末页");
        if (lastEnabled) {
            view.setOnClickListener(new JavaAdapter(
                View.OnClickListener, {
                    onClick: function () {
                        performNumberAction(
                            "last", "ui_number_last");
                    }
                }));
        }
        numberActionViews.last = view;
        addNumberPagerChild(row, view, index);

        scroll.addView(row, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT,
            dp(44)));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(44));
        params.topMargin = dp(2);
        params.bottomMargin = dp(4);
        paginationFooterHost.addView(scroll, params);
        numberPagerView = scroll;
        numberPagerState.present = true;
        numberPagerState.visible = true;
        return true;
    }

    function buildAjaxPaginationFooter(colors) {
        var params;
        var remaining;
        ajaxFooterState.present = false;
        ajaxFooterState.visible = false;
        ajaxFooterState.action = "none";
        ajaxFooterState.text = "";
        ajaxFooterState.clickable = false;
        if (paginationFooterHost === null ||
                paginationState.mode !== "ajax" ||
                (previewRows.length === 0 &&
                    !paginationState.hasMore)) {
            return false;
        }
        remaining = Math.max(0,
            Number(paginationState.totalCount) -
                previewRows.length);
        if (ajaxFooterState.loading) {
            ajaxFooterState.action = "loading";
            ajaxFooterState.text =
                "正在加载下一页…";
            ajaxFooterState.clickable = false;
        } else if (paginationState.hasMore) {
            ajaxFooterState.action = "load_more";
            ajaxFooterState.text = remaining > 0 ?
                "加载更多 · 剩余 " +
                    String(remaining) + " 条" :
                "加载更多";
            ajaxFooterState.clickable = true;
        } else {
            ajaxFooterState.action = "end";
            ajaxFooterState.text = "已加载全部 " +
                String(previewRows.length) + " 条";
            ajaxFooterState.clickable = false;
        }
        loadMoreView = makeText(
            ajaxFooterState.text, 11,
            ajaxFooterState.clickable ?
                colors.accentStrong :
                colors.textSecondary,
            ajaxFooterState.clickable);
        loadMoreView.setGravity(Gravity.CENTER);
        loadMoreView.setPadding(
            dp(10), dp(10), dp(10), dp(10));
        loadMoreView.setBackground(roundedBackground(
            ajaxFooterState.clickable ?
                colors.accentSoft :
                colors.surfaceMuted,
            ajaxFooterState.clickable ?
                colors.accentBorder :
                colors.stroke, 12));
        loadMoreView.setClickable(
            ajaxFooterState.clickable);
        loadMoreView.setFocusable(
            ajaxFooterState.clickable);
        loadMoreView.setEnabled(
            ajaxFooterState.clickable);
        loadMoreView.setContentDescription(
            paginationState.hasMore &&
                paginationState.mode === "ajax" ?
                ajaxFooterState.text +
                    "；接近列表底部会自动加载" :
                ajaxFooterState.text);
        if (ajaxFooterState.clickable) {
            loadMoreView.setOnClickListener(
                new JavaAdapter(
                    View.OnClickListener, {
                        onClick: function () {
                            loadMoreResults(
                                "footer_click");
                        }
                    }));
        }
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(44));
        params.topMargin = dp(2);
        params.bottomMargin = dp(4);
        paginationFooterHost.addView(
            loadMoreView, params);
        ajaxFooterState.present = true;
        ajaxFooterState.visible = true;
        return true;
    }

    function appendLoadMoreControl(colors) {
        removePaginationFooterViews();
        if (paginationState.mode === "number") {
            ajaxFooterState.present = false;
            ajaxFooterState.visible = false;
            ajaxFooterState.action = "none";
            ajaxFooterState.text = "";
            ajaxFooterState.clickable = false;
            return buildNumberPaginationFooter(colors);
        }
        numberPagerState.present = false;
        numberPagerState.visible = false;
        numberPagerState.loading = false;
        numberPagerState.tokens = [];
        return buildAjaxPaginationFooter(colors);
    }

    function finishResultRender(generation, colors) {
        if (generation !== renderGeneration) { return false; }
        appendLoadMoreControl(colors);
        state.loadedResultCount = previewRows.length;
        state.resultPageSize =
            Number(paginationState.pageSize);
        state.resultHasMore =
            paginationState.hasMore === true;
        state.resultPageLimit = Math.max(
            Number(paginationState.pageSize),
            previewRows.length);
        state.contentReady = true;
        state.renderedDataVersion = panelDataVersion;
        state.renderBatchCount = renderBatchCount;
        renderedDataVersion = panelDataVersion;
        panelDataDirty = false;
        performance.fullRenderReadyAtNs = nowNanos();
        performance.showToFullRenderMs = elapsedMs(
            performance.showStartedAtNs, performance.fullRenderReadyAtNs);
        performance.renderBatchCount = renderBatchCount;
        updateResultCountOnMain();
        attachDeleteUndoBanner();
        bindLazyScrollListener();
        scheduleNextPagePrefetch(
            "full_render_complete");
        if (mainHandler !== null) {
            mainHandler.post(new Packages.java.lang.Runnable({
                run: function () {
                    measureVirtualCards();
                    restoreScrollAnchor();
                    captureScrollAnchor();
                    updateQuickResetView();
                    updateResultScrollState();
                    lazyLoadState.remainingPx =
                        resultRemainingScrollPx();
                }
            }));
        }
        return true;
    }

    function renderResultBatch(generation, batchSize, colors) {
        var end;
        var index;
        var params;
        if (generation !== renderGeneration ||
                resultContainer === null || !state.panelAttached) {
            return false;
        }
        end = Math.min(previewRows.length,
            renderCursor + Math.max(1, Number(batchSize)));
        for (index = renderCursor; index < end; index += 1) {
            params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
            params.bottomMargin = dp(6);
            resultContainer.addView(makeResultCard(
                previewRows[index], colors), params);
        }
        renderCursor = end;
        renderBatchCount += 1;
        state.renderBatchCount = renderBatchCount;
        if (performance.firstBatchReadyAtNs === 0) {
            performance.firstBatchReadyAtNs = nowNanos();
            performance.showToFirstBatchMs = elapsedMs(
                performance.showStartedAtNs,
                performance.firstBatchReadyAtNs);
        }
        if (renderCursor < previewRows.length && mainHandler !== null) {
            mainHandler.post(new Packages.java.lang.Runnable({
                run: function () {
                    renderResultBatch(generation,
                        RENDER_BATCH_COUNT, colors);
                }
            }));
            return true;
        }
        return finishResultRender(generation, colors);
    }

    function refreshResultsOnMain() {
        var colors = palette();
        var empty;
        var generation;
        var preferredIndex;
        if (resultContainer === null) { return false; }
        captureScrollAnchor();
        renderGeneration += 1;
        generation = renderGeneration;
        renderCursor = 0;
        renderBatchCount = 0;
        state.contentReady = false;
        cancelActiveSwipe(false);
        createVirtualHierarchy();
        state.resultCardCount = 0;
        state.resultSourceIconCount = 0;
        state.renderedTagLabelCount = 0;
        state.cardActionButtonCount = 0;
        state.pinnedBadgeCount = 0;
        resultCardViews = [];
        resultActionViews = [];
        resultTagMap = {};
        dataTagLoadedById = {};
        if (selectedItemId !== null && selectedResultRow() === null) {
            clearSelectedResult();
        }
        if (previewRows.length === 0) {
            empty = makeText("没有匹配的剪贴板记录",
                12, colors.textSecondary, false);
            empty.setGravity(Gravity.CENTER);
            empty.setPadding(dp(10), dp(42), dp(10), dp(42));
            virtualCardHost.addView(empty,
                new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT));
            virtualRenderedItemIds = [];
            virtualRenderedSignatures = [];
            virtualState.firstRenderedIndex = 0;
            virtualState.lastRenderedIndex = -1;
            virtualState.firstVisibleIndex = 0;
            virtualState.lastVisibleIndex = -1;
            virtualState.topSpacerPx = 0;
            virtualState.bottomSpacerPx = 0;
            performance.firstBatchReadyAtNs = nowNanos();
            performance.showToFirstBatchMs = elapsedMs(
                performance.showStartedAtNs,
                performance.firstBatchReadyAtNs);
            return finishResultRender(generation, colors);
        }
        preferredIndex = virtualRowIndexById(
            virtualState.anchorItemId);
        if (preferredIndex < 0) {
            preferredIndex = Math.max(0, Math.min(
                previewRows.length - 1,
                Number(virtualState.anchorIndex)));
        }
        if (virtualState.scrollToTopPending === true) {
            preferredIndex = 0;
        }
        rebuildVirtualWindow(
            "full_refresh", true, preferredIndex);
        renderCursor = Math.max(0,
            Number(virtualState.lastRenderedIndex) + 1);
        renderBatchCount = 1;
        performance.firstBatchReadyAtNs = nowNanos();
        performance.showToFirstBatchMs = elapsedMs(
            performance.showStartedAtNs,
            performance.firstBatchReadyAtNs);
        return finishResultRender(generation, colors);
    }

    function updateResultCountOnMain() {
        var text;
        if (resultCountView === null) { return false; }
        if (paginationState.mode === "ajax") {
            text = paginationState.totalCount > 0 ?
                "已加载 " +
                    String(previewRows.length) +
                    " / " +
                    String(paginationState.totalCount) +
                    " 条" :
                "共 " + String(previewRows.length) +
                    " 条";
            if (paginationState.hasMore) {
                text += "（还有更多）";
            }
        } else {
            text = "第 " +
                String(paginationState.pageNumber) +
                " / " +
                String(Math.max(1,
                    paginationState.totalPages)) +
                " 页 · 共 " +
                String(paginationState.totalCount) +
                " 条";
        }
        if (isActive(value)) {
            text += "（已筛选）";
        }
        resultCountView.setText(text);
        return true;
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

    function activeAdvancedFilterCount() {
        var count = 0;
        if (value === null || value === undefined) { return 0; }
        if (value.sourcePackages && value.sourcePackages.length > 0) {
            count += 1;
        }
        if (value.tagIds && value.tagIds.length > 0) {
            count += 1;
        }
        if (value.pinnedOnly === true) { count += 1; }
        if (String(value.sensitiveMode || "all") !== "all") {
            count += 1;
        }
        if (validateSortMode(value.sortMode) !== "latest") {
            count += 1;
        }
        return count;
    }

    function headerMetrics() {
        var widthDp = Number(state.panelWidthDp || 0);
        var fontScale = resourceFontScale();
        var touchDp = Math.max(1, Number(touchSlop || 1) / density);
        var baseDp;
        var actionSizeDp;
        var controlHeightDp;
        var gapDp;
        var titleSp;
        var iconSp;
        var statusSp;
        var searchSp;
        var radiusDp;
        var inputPaddingDp;
        var badgeSizeDp;
        var badgeSp;
        if (widthDp <= 0 && Number(state.panelWidthPx || 0) > 0) {
            widthDp = Number(state.panelWidthPx) / density;
        }
        if (widthDp <= 0) {
            widthDp = Number(appContext.getResources()
                .getDisplayMetrics().widthPixels) / density;
        }
        baseDp = Math.max(touchDp, widthDp * 0.018);
        actionSizeDp = clampNumber(widthDp * 0.092,
            baseDp * 4.4, widthDp * 0.12);
        controlHeightDp = clampNumber(actionSizeDp * 1.02,
            baseDp * 4.6, widthDp * 0.125);
        gapDp = clampNumber(widthDp * 0.014,
            baseDp * 0.65, actionSizeDp * 0.24);
        titleSp = clampNumber(widthDp / (fontScale * 23),
            actionSizeDp / (fontScale * 2.45),
            actionSizeDp / (fontScale * 1.85));
        iconSp = clampNumber(actionSizeDp / (fontScale * 2.05),
            titleSp * 0.86, titleSp * 1.18);
        statusSp = clampNumber(titleSp * 0.60,
            iconSp * 0.58, titleSp * 0.72);
        searchSp = clampNumber(titleSp * 0.70,
            statusSp, titleSp * 0.82);
        radiusDp = Math.max(baseDp * 1.3, controlHeightDp * 0.44);
        inputPaddingDp = Math.max(baseDp * 0.65, gapDp);
        badgeSizeDp = Math.max(baseDp * 2.0, actionSizeDp * 0.38);
        badgeSp = Math.max(statusSp * 0.64,
            badgeSizeDp / (fontScale * 3.4));
        state.headerHeightDp = actionSizeDp + gapDp + controlHeightDp;
        state.headerControlHeightDp = controlHeightDp;
        state.headerActionSizeDp = actionSizeDp;
        state.headerGapDp = gapDp;
        return {
            widthDp: widthDp,
            fontScale: fontScale,
            baseDp: baseDp,
            actionSizeDp: actionSizeDp,
            controlHeightDp: controlHeightDp,
            gapDp: gapDp,
            titleSp: titleSp,
            iconSp: iconSp,
            statusSp: statusSp,
            searchSp: searchSp,
            radiusDp: radiusDp,
            inputPaddingDp: inputPaddingDp,
            badgeSizeDp: badgeSizeDp,
            badgeSp: badgeSp
        };
    }

    function makeHeaderAction(iconText, description, colors, metrics,
            emphasized) {
        var view = makeIcon(iconText, metrics.iconSp,
            emphasized ? colors.accentStrong : colors.icon,
            description);
        view.setBackground(circleBackground(
            emphasized ? colors.accentSoft : colors.surfaceMuted,
            null));
        return view;
    }

    function makeFilterAction(colors, metrics) {
        var activeCount = activeAdvancedFilterCount();
        var root = new FrameLayout(appContext);
        var icon = makeIcon("☷", metrics.iconSp,
            activeCount > 0 ? colors.accentStrong : colors.icon,
            activeCount > 0 ?
                "打开筛选，已启用 " + String(activeCount) + " 类条件" :
                "打开筛选");
        var badge;
        var params;
        icon.setClickable(false);
        icon.setFocusable(false);
        root.setClickable(true);
        root.setFocusable(true);
        root.setContentDescription(activeCount > 0 ?
            "打开筛选，已启用 " + String(activeCount) + " 类条件" :
            "打开筛选");
        root.setBackground(circleBackground(
            activeCount > 0 ? colors.accentSoft : colors.surfaceMuted,
            activeCount > 0 ? colors.accentBorder : null));
        root.addView(icon, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT));
        if (activeCount > 0) {
            badge = makeText(String(Math.min(9, activeCount)),
                metrics.badgeSp, "#FFFFFFFF", true);
            badge.setGravity(Gravity.CENTER);
            badge.setBackground(circleBackground(colors.accentStrong, null));
            params = new FrameLayout.LayoutParams(
                dp(metrics.badgeSizeDp), dp(metrics.badgeSizeDp));
            params.gravity = Gravity.TOP | Gravity.END;
            root.addView(badge, params);
        }
        root.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () { toggleAdvanced(); }
            }));
        state.headerFilterActiveCount = activeCount;
        return root;
    }

    function updateSearchVisibility(requestKeyboard) {
        var showInput = searchExpanded && !advancedVisible;
        if (searchStatusRow !== null) {
            searchStatusRow.setVisibility(
                showInput ? View.GONE : View.VISIBLE);
        }
        if (searchInputRow !== null) {
            searchInputRow.setVisibility(
                showInput ? View.VISIBLE : View.GONE);
        }
        if (historyContainerView !== null) {
            historyContainerView.setVisibility(
                showInput ? View.VISIBLE : View.GONE);
        }
        state.searchExpanded = searchExpanded === true;
        if (showInput && requestKeyboard === true) {
            requestKeyboardOnMain();
        } else if (!showInput) {
            hideKeyboardOnMain();
            stopFilterImeAvoidance(true);
        }
        return showInput;
    }

    function setSearchExpanded(expanded, requestKeyboard) {
        var next = expanded === true;
        if (next && advancedVisible) {
            advancedVisible = false;
            state.advancedDrawerVisible = false;
            state.advancedCloseCount += 1;
            searchExpanded = true;
            state.searchExpandCount += 1;
            buildPanelContent(requestKeyboard === true);
            return true;
        }
        if (searchExpanded !== next) {
            if (next) {
                state.searchExpandCount += 1;
            } else {
                state.searchCollapseCount += 1;
            }
        }
        searchExpanded = next;
        updateSearchVisibility(requestKeyboard === true);
        return true;
    }

    function buildSearchHeader(colors) {
        var container = new LinearLayout(appContext);
        var titleRow = new LinearLayout(appContext);
        var title;
        var statusRow = new LinearLayout(appContext);
        var inputRow = new LinearLayout(appContext);
        var sort;
        var statusFilter;
        var inputFilter;
        var addButton;
        var params;
        var metrics = headerMetrics();

        container.setOrientation(LinearLayout.VERTICAL);
        titleRow.setOrientation(LinearLayout.HORIZONTAL);
        titleRow.setGravity(Gravity.CENTER_VERTICAL);
        title = makeText("全局剪切板", metrics.titleSp,
            colors.textPrimary, true);
        title.setSingleLine(true);
        title.setEllipsize(TextUtils.TruncateAt.END);
        titleRow.addView(title, new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        addButton = makeHeaderAction("+", "新增剪切板内容",
            colors, metrics, true);
        addButton.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () { addNewResult(); }
            }));
        params = new LinearLayout.LayoutParams(
            dp(metrics.actionSizeDp), dp(metrics.actionSizeDp));
        params.leftMargin = dp(metrics.gapDp);
        titleRow.addView(addButton, params);

        settingsButton = makeHeaderAction("⚙", "打开 ClipHub 设置",
            colors, metrics, false);
        settingsButton.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () {
                    try {
                        if (ClipHub.Settings && ClipHub.Settings.open) {
                            state.settingsOpenCount += 1;
                            ClipHub.Settings.open();
                        }
                    } catch (error) {
                        state.lastError = String(error);
                    }
                }
            }));
        params = new LinearLayout.LayoutParams(
            dp(metrics.actionSizeDp), dp(metrics.actionSizeDp));
        params.leftMargin = dp(metrics.gapDp);
        titleRow.addView(settingsButton, params);
        state.settingsButtonPresent = true;

        closeView = makeHeaderAction("×", "关闭全局剪切板",
            colors, metrics, false);
        closeView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () {
                    closePanel({
                        reason: "button",
                        restoreList: rootMode ? false : true
                    });
                }
            }));
        params = new LinearLayout.LayoutParams(
            dp(metrics.actionSizeDp), dp(metrics.actionSizeDp));
        params.leftMargin = dp(metrics.gapDp);
        titleRow.addView(closeView, params);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(metrics.actionSizeDp));
        params.bottomMargin = dp(metrics.gapDp);
        container.addView(titleRow, params);

        statusRow.setOrientation(LinearLayout.HORIZONTAL);
        statusRow.setGravity(Gravity.CENTER_VERTICAL);
        resultCountView = makeText("", metrics.statusSp,
            colors.textSecondary, false);
        resultCountView.setSingleLine(true);
        resultCountView.setEllipsize(TextUtils.TruncateAt.END);
        updateResultCountOnMain();
        statusRow.addView(resultCountView,
            new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        quickResetView = makeText("回到最新",
            metrics.statusSp, colors.accentStrong, true);
        quickResetView.setSingleLine(true);
        quickResetView.setPadding(
            dp(metrics.inputPaddingDp), dp(3),
            dp(metrics.inputPaddingDp), dp(3));
        quickResetView.setBackground(roundedBackground(
            colors.accentSoft, colors.accentBorder,
            Math.max(6, metrics.radiusDp * 0.62)));
        quickResetView.setContentDescription(
            "清除当前位置并回到第一页最新记录");
        quickResetView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () {
                    resetToLatest({
                        origin: "ui_quick_reset"
                    });
                }
            }));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.leftMargin = dp(metrics.gapDp);
        statusRow.addView(quickResetView, params);
        updateQuickResetView();

        sort = makeText("按" + sortModeLabel(value.sortMode),
            metrics.statusSp, colors.textSecondary, false);
        sort.setSingleLine(true);
        sort.setEllipsize(TextUtils.TruncateAt.END);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.leftMargin = dp(metrics.gapDp);
        statusRow.addView(sort, params);

        searchToggleView = makeHeaderAction("⌕", "展开搜索",
            colors, metrics, false);
        searchToggleView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () {
                    setSearchExpanded(true, true);
                }
            }));
        searchView = searchToggleView;
        params = new LinearLayout.LayoutParams(
            dp(metrics.actionSizeDp), dp(metrics.actionSizeDp));
        params.leftMargin = dp(metrics.gapDp);
        statusRow.addView(searchToggleView, params);

        statusFilter = makeFilterAction(colors, metrics);
        advancedView = statusFilter;
        params = new LinearLayout.LayoutParams(
            dp(metrics.actionSizeDp), dp(metrics.actionSizeDp));
        params.leftMargin = dp(metrics.gapDp);
        statusRow.addView(statusFilter, params);
        searchStatusRow = statusRow;
        container.addView(statusRow,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(metrics.controlHeightDp)));

        inputRow.setOrientation(LinearLayout.HORIZONTAL);
        inputRow.setGravity(Gravity.CENTER_VERTICAL);
        keywordInput = new EditText(appContext);
        keywordInput.setSingleLine(true);
        suppressTextWatcher = true;
        keywordInput.setText(String(value.keyword || ""));
        keywordInput.setSelection(keywordInput.getText().length());
        suppressTextWatcher = false;
        keywordInput.setHint("搜索剪切板内容");
        keywordInput.setTextSize(TypedValue.COMPLEX_UNIT_SP,
            metrics.searchSp);
        ClipHub.Theme.applyTextColor(keywordInput, colors.textPrimary);
        ClipHub.Theme.applyHintTextColor(keywordInput, colors.textSecondary);
        keywordInput.setInputType(InputType.TYPE_CLASS_TEXT |
            InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        keywordInput.setImeOptions(EditorInfo.IME_ACTION_SEARCH);
        keywordInput.setPadding(dp(metrics.inputPaddingDp), 0,
            dp(metrics.inputPaddingDp), 0);
        keywordInput.setBackground(roundedBackground(colors.surface,
            colors.stroke, metrics.radiusDp));
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
        params = new LinearLayout.LayoutParams(
            0, dp(metrics.controlHeightDp), 1);
        params.rightMargin = dp(metrics.gapDp);
        inputRow.addView(keywordInput, params);

        searchClearView = makeHeaderAction("×",
            "清空搜索；搜索为空时收起搜索框",
            colors, metrics, false);
        searchClearView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () {
                    var current = keywordInput === null ? "" :
                        normalizeText(String(keywordInput.getText()));
                    if (current.length === 0) {
                        setSearchExpanded(false, false);
                        return;
                    }
                    suppressTextWatcher = true;
                    try {
                        keywordInput.setText("");
                        keywordInput.setSelection(0);
                    } finally {
                        suppressTextWatcher = false;
                    }
                    state.searchActionCount += 1;
                    setValue({ keyword: "" }, {
                        origin: "ui_search_clear"
                    });
                    refreshResultsOnMain();
                    updateResultCountOnMain();
                    requestKeyboardOnMain();
                }
            }));
        inputRow.addView(searchClearView,
            new LinearLayout.LayoutParams(
                dp(metrics.actionSizeDp), dp(metrics.actionSizeDp)));

        inputFilter = makeFilterAction(colors, metrics);
        params = new LinearLayout.LayoutParams(
            dp(metrics.actionSizeDp), dp(metrics.actionSizeDp));
        params.leftMargin = dp(metrics.gapDp);
        inputRow.addView(inputFilter, params);
        searchInputRow = inputRow;
        container.addView(inputRow,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(metrics.controlHeightDp)));

        updateSearchVisibility(false);
        return container;
    }

    function buildResultArea(colors) {
        var root = new LinearLayout(appContext);
        var scroll = new ScrollView(appContext);
        resultScrollView = scroll;
        root.setOrientation(LinearLayout.VERTICAL);
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
        if (mainHandler !== null) {
            mainHandler.post(new Packages.java.lang.Runnable({
                run: function () { updateResultScrollState(); }
            }));
        }
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
                String(items[index].key) === String(selectedKey),
                colors, true);
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
        drawerScrollView = scroll;
        drawerContentView = content;
        drawerFooterView = footer;
        var pinnedRow;
        var sensitiveRow;
        var sortRow;
        var compact = compactWindowLayout();
        var footerButtonHeightDp = compact ? 36 : 40;
        var footerHeightDp = compact ? 44 : 48;

        drawer.setOrientation(LinearLayout.VERTICAL);
        drawer.setPadding(dp(11), dp(9), dp(11), dp(9));
        drawer.setBackground(roundedBackground(colors.surface,
            colors.stroke, 17));
        if (Build.VERSION.SDK_INT >= 21) {
            drawer.setElevation(0);
            drawer.setClipToOutline(true);
        }
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

        state.advancedKeywordInputPresent = false;

        content.setOrientation(LinearLayout.VERTICAL);
        content.setPadding(0, 0, 0, dp(6));
        state.drawerContentBottomPaddingDp = 6;
        if (counts.sources.length > 0) {
            addSection(content, "来源应用（多选）",
                counts.sources, "source", colors);
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
        addChoiceSection(content, "敏感内容", sensitiveRow, 4, colors);

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
        params = new LinearLayout.LayoutParams(0,
            dp(footerButtonHeightDp), 1);
        params.rightMargin = dp(7);
        footer.addView(resetView, params);
        footer.addView(applyView,
            new LinearLayout.LayoutParams(0,
                dp(footerButtonHeightDp), 1));
        drawer.addView(footer, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(footerHeightDp)));
        state.drawerFooterTopGapDp = 0;
        state.drawerFooterHeightDp = footerHeightDp;
        return drawer;
    }

    function makeToolbarAction(key, iconText, labelText, colors,
            enabled, primary, callback) {
        var item = new LinearLayout(appContext);
        var icon = makeText(iconText, primary ? 22 : 16,
            enabled ? (primary ? colors.accentStrong : colors.icon) :
                colors.textTertiary,
            primary === true);
        var label = makeText(labelText, 9,
            enabled ? colors.textSecondary : colors.textTertiary,
            primary === true);
        item.setOrientation(LinearLayout.VERTICAL);
        item.setGravity(Gravity.CENTER);
        item.setAlpha(enabled ? 1 : 0.48);
        item.setEnabled(enabled);
        item.setClickable(enabled);
        item.setFocusable(enabled);
        item.setContentDescription(String(labelText));
        icon.setGravity(Gravity.CENTER);
        label.setGravity(Gravity.CENTER);
        item.addView(icon, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(26)));
        item.addView(label, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        if (enabled && typeof callback === "function") {
            item.setOnClickListener(new JavaAdapter(
                View.OnClickListener, {
                    onClick: function () {
                        try {
                            callback();
                        } catch (error) {
                            state.lastError = "Toolbar action " +
                                String(key) + " failed: " + String(error);
                        }
                    }
                }));
        }
        toolbarActionViews[String(key)] = item;
        return item;
    }

    function buildBottomToolbar(colors) {
        var toolbar = new LinearLayout(appContext);
        var hasSelection = selectedResultRow() !== null;
        var params = new LinearLayout.LayoutParams(0, dp(56), 1);
        toolbarActionViews = {};
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setGravity(Gravity.CENTER);
        toolbar.setPadding(dp(4), dp(3), dp(4), dp(3));
        toolbar.setBackground(roundedBackground(colors.toolbar,
            null, 17));
        toolbar.addView(makeToolbarAction("pin", "⌖", "置顶", colors,
            hasSelection, false, function () {
                toggleResultPinned(selectedResultRow());
            }), params);
        toolbar.addView(makeToolbarAction("edit", "✎", "编辑", colors,
            hasSelection, false, editSelectedResult),
            new LinearLayout.LayoutParams(0, dp(56), 1));
        toolbar.addView(makeToolbarAction("add", "+", "新增", colors,
            true, true, addNewResult),
            new LinearLayout.LayoutParams(0, dp(56), 1));
        toolbar.addView(makeToolbarAction("delete", "⌫", "删除", colors,
            hasSelection, false, deleteSelectedResult),
            new LinearLayout.LayoutParams(0, dp(56), 1));
        toolbar.addView(makeToolbarAction("detail", "文", "翻译", colors,
            hasSelection, false, openSelectedDetail),
            new LinearLayout.LayoutParams(0, dp(56), 1));
        state.toolbarEnabledCount = hasSelection ? 5 : 1;
        return toolbar;
    }

    function compactWindowLayout() {
        return Number(state.panelWidthDp || 390) <= 340;
    }

    function buildPanelContent(requestFocus) {
        var colors = palette();
        var counts = advancedVisible ? optionCounts() :
            { sources: [], tags: [] };
        var handle;
        var params;
        var history;
        var bodyFrame;
        var resultArea;

        if (panelRoot === null) {
            return false;
        }
        captureScrollAnchor();
        panelRoot.removeAllViews();
        sourceViews = {};
        tagViews = {};
        pinnedViews = {};
        sensitiveViews = {};
        sortViews = {};
        state.advancedKeywordInputPresent = false;
        state.sortOptionCount = 0;
        state.sourceWrapRowCount = 0;
        state.tagWrapRowCount = 0;
        state.drawerWidthDp = 0;
        state.drawerHeightDp = 0;
        state.drawerContentBottomPaddingDp = 0;
        state.drawerFooterTopGapDp = 0;
        state.drawerFooterHeightDp = 0;
        state.advancedChipVerticalPaddingDp = 0;
        state.drawerMeasured = false;
        state.drawerContentHeightDp = 0;
        state.drawerViewportHeightDp = 0;
        state.drawerScrollYDp = 0;
        state.drawerCanScrollDownAtTop = false;
        state.drawerContentFitsViewport = false;
        drawerContainer = null;
        drawerScrollView = null;
        drawerContentView = null;
        drawerFooterView = null;
        resultBodyFrame = null;
        searchStatusRow = null;
        searchInputRow = null;
        searchToggleView = null;
        searchClearView = null;
        historyContainerView = null;
        deleteUndoView = null;
        state.deleteUndoVisible = false;
        resultContainer = null;
        resultCountView = null;
        clearVirtualViewReferences();
        state.sourceOptionCount = counts.sources.length;
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
            historyContainerView = history;
            history.setVisibility(searchExpanded ?
                View.VISIBLE : View.GONE);
            params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
            params.bottomMargin = dp(headerMetrics().gapDp);
            panelRoot.addView(history, params);
        } else {
            historyContainerView = null;
            state.historyChipCount = 0;
        }

        bodyFrame = new FrameLayout(appContext);
        resultArea = buildResultArea(colors);
        bodyFrame.addView(resultArea, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT));
        resultBodyFrame = bodyFrame;
        if (advancedVisible) {
            drawerContainer = buildAdvancedDrawer(colors, counts);
            state.drawerWidthDp = compactWindowLayout() ?
                Math.max(176, Number(state.panelWidthDp || 320) - 16) :
                Math.max(196, Math.min(238,
                    Number(state.panelWidthDp || 390) - 24));
            state.drawerHeightDp = Math.max(180,
                Number(state.panelHeightDp || 560) - 128);
            params = new FrameLayout.LayoutParams(dp(state.drawerWidthDp),
                FrameLayout.LayoutParams.MATCH_PARENT);
            params.gravity = Gravity.END | Gravity.TOP;
            bodyFrame.addView(drawerContainer, params);
        }
        panelRoot.addView(bodyFrame, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));
        attachDeleteUndoBanner();

        toolbarActionViews = {};
        state.toolbarEnabledCount = 0;

        state.sourceChipCount = Object.keys(sourceViews).length;
        state.tagChipCount = Object.keys(tagViews).length;
        state.advancedDrawerVisible = advancedVisible;
        state.panelRenderCount += 1;
        updatePanelSize();
        if (requestFocus && !advancedVisible && searchExpanded) {
            requestKeyboardOnMain();
        }
        return true;
    }

    function suspendHomeWindow() {
        restoreListOnClose = false;
        state.homeWindowSuspended = false;
        state.lastError = null;
        return false;
    }

    function finishHomeWindow(options) {
        restoreListOnClose = false;
        state.homeWindowSuspended = false;
        return false;
    }

    var filterImeController = null;

    function copyImeLayout(params) {
        return {
            width: Number(params.width),
            height: Number(params.height),
            gravity: Number(params.gravity),
            x: Number(params.x),
            y: Number(params.y)
        };
    }

    function sameImeLayout(params, target) {
        return Number(params.width) === Number(target.width) &&
            Number(params.height) === Number(target.height) &&
            Number(params.gravity) === Number(target.gravity) &&
            Number(params.x) === Number(target.x) &&
            Number(params.y) === Number(target.y);
    }

    function hasFocusedFilterInput(rootView) {
        var focused;
        var type;
        try {
            if (rootView === null || !rootView.hasWindowFocus()) {
                return false;
            }
            focused = rootView.findFocus();
            if (focused === null) { return false; }
            type = focused.getClass();
            while (type !== null) {
                if (String(type.getName()) === "android.widget.EditText") {
                    return true;
                }
                type = type.getSuperclass();
            }
        } catch (ignored) {}
        return false;
    }

    function createFilterImeController(rootView, params) {
        var handler = mainHandler || new Handler(Looper.getMainLooper());
        var stateValue = {
            started: false,
            stopped: false,
            generation: 0,
            runnable: null,
            observer: null,
            listener: null,
            restore: null,
            applied: false,
            applyCount: 0,
            restoreCount: 0,
            staleSignalIgnoredCount: 0,
            updateCount: 0,
            lastSource: "none",
            lastInsetPx: 0,
            lastError: null
        };

        function displayMetrics() {
            var metrics = new DisplayMetrics();
            try {
                windowManager.getDefaultDisplay().getRealMetrics(metrics);
            } catch (ignoredManager) {
                metrics = appContext.getResources().getDisplayMetrics();
            }
            return metrics;
        }

        function thresholdPx(metrics) {
            var screenHeight = Math.max(1, Number(metrics.heightPixels || 1));
            var lower = Math.max(touchSlop * 6,
                Math.round(screenHeight * 0.055));
            var upper = Math.max(lower,
                Math.round(screenHeight * 0.22));
            return Math.round(clampNumber(screenHeight * 0.12,
                lower, upper));
        }

        function inputMethodHeightPx() {
            var height = 0;
            if (inputMethodManager === null) { return 0; }
            try {
                height = Number(inputMethodManager
                    .getInputMethodWindowVisibleHeight());
            } catch (ignored) {
                height = 0;
            }
            return isFinite(height) && height > 0 ? height : 0;
        }

        function readImeState() {
            var metrics = displayMetrics();
            var threshold = thresholdPx(metrics);
            var output = {
                visible: false,
                bottomPx: 0,
                topInsetPx: 0,
                source: "none",
                screenWidthPx: Number(metrics.widthPixels),
                screenHeightPx: Number(metrics.heightPixels)
            };
            var insets;
            var imeMask;
            var systemMask;
            var imeInsets;
            var systemInsets;
            var rootAvailable = false;
            var rootVisible = false;
            var rootBottom = 0;
            var frame = new Rect();
            var frameAvailable = false;
            var frameGap = 0;
            var frameVisible = false;
            var immHeight = 0;

            if (Build.VERSION.SDK_INT >= 30) {
                try {
                    insets = rootView.getRootWindowInsets();
                    if (insets !== null) {
                        imeMask = WindowInsets.Type.ime();
                        systemMask = WindowInsets.Type.systemBars();
                        imeInsets = insets.getInsets(imeMask);
                        systemInsets = insets.getInsets(systemMask);
                        rootAvailable = true;
                        rootBottom = Math.max(0,
                            Number(imeInsets.bottom));
                        rootVisible = insets.isVisible(imeMask) === true ||
                            rootBottom >= threshold;
                        output.topInsetPx = Math.max(0,
                            Number(systemInsets.top));
                    }
                } catch (ignoredInsets) {}
            }

            try {
                rootView.getWindowVisibleDisplayFrame(frame);
                frameAvailable = true;
                frameGap = Math.max(0,
                    Number(metrics.heightPixels) - Number(frame.bottom));
                frameVisible = frameGap >= threshold;
                output.topInsetPx = Math.max(output.topInsetPx,
                    Number(frame.top));
            } catch (ignoredFrame) {}

            immHeight = inputMethodHeightPx();
            if (rootVisible) {
                output.visible = true;
                output.bottomPx = Math.max(rootBottom,
                    frameVisible ? frameGap : 0,
                    immHeight >= threshold ? immHeight : 0);
                output.source = "root_window_insets";
            } else if (frameVisible) {
                output.visible = true;
                output.bottomPx = Math.max(frameGap,
                    immHeight >= threshold ? immHeight : 0);
                output.source = "visible_display_frame";
            } else if (!rootAvailable && !frameAvailable &&
                    immHeight >= threshold) {
                output.visible = true;
                output.bottomPx = immHeight;
                output.source = "input_method_visible_height";
            } else {
                output.visible = false;
                output.bottomPx = 0;
                output.source = rootAvailable ?
                    "root_window_insets_hidden" :
                    (frameAvailable ?
                        "visible_display_frame_hidden" : "none");
                if (immHeight >= threshold) {
                    stateValue.staleSignalIgnoredCount += 1;
                }
            }
            return output;
        }

        function updateLayout(target) {
            if (sameImeLayout(params, target)) { return false; }
            params.width = Number(target.width);
            params.height = Number(target.height);
            params.gravity = Number(target.gravity);
            params.x = Number(target.x);
            params.y = Number(target.y);
            try {
                if (rootView.isAttachedToWindow()) {
                    if (!ClipHub.Window ||
                            typeof ClipHub.Window.applyExternalLayout !== "function" ||
                            ClipHub.Window.applyExternalLayout(rootView, params,
                                "ch_11_filter.js_external_layout") !== true) {
                        windowManager.updateViewLayout(rootView, params);
                    }
                    stateValue.updateCount += 1;
                }
                return true;
            } catch (error) {
                stateValue.lastError = String(error);
                return false;
            }
        }

        function restoreLayout() {
            var target = stateValue.restore;
            if (target === null) {
                stateValue.applied = false;
                return false;
            }
            updateLayout(target);
            stateValue.restore = null;
            if (stateValue.applied) { stateValue.restoreCount += 1; }
            stateValue.applied = false;
            return true;
        }

        function applyImeLayout(ime) {
            var keyboardActive = ime.visible === true &&
                hasFocusedFilterInput(rootView);
            var screenHeight = Math.max(1, Number(ime.screenHeightPx));
            var screenWidth = Math.max(1, Number(ime.screenWidthPx));
            var adaptiveGap = Math.max(touchSlop,
                Math.round(Math.min(screenWidth, screenHeight) * 0.008));
            var keyboardTop;
            var topSafe;
            var minimumHeight;
            var minimumTop;
            var bottomLimit;
            var originalTop;
            var availableAtOriginalTop;
            var targetHeight;
            var target;

            stateValue.lastSource = String(ime.source || "none");
            stateValue.lastInsetPx = Number(ime.bottomPx || 0);
            if (!keyboardActive) {
                if (stateValue.applied) { restoreLayout(); }
                return false;
            }
            if (!stateValue.applied || stateValue.restore === null) {
                stateValue.restore = copyImeLayout(params);
            }
            keyboardTop = Math.max(0,
                screenHeight - Number(ime.bottomPx));
            topSafe = Math.max(0, Number(ime.topInsetPx || 0));
            minimumHeight = Math.max(touchSlop * 18,
                Math.round(screenHeight * 0.22));
            minimumTop = topSafe;
            bottomLimit = Math.max(minimumTop + 1,
                keyboardTop - adaptiveGap);
            originalTop = Math.max(minimumTop,
                Number(stateValue.restore.y));
            availableAtOriginalTop = Math.max(1,
                bottomLimit - originalTop);
            targetHeight = Math.min(
                Number(stateValue.restore.height),
                availableAtOriginalTop);
            if (targetHeight < minimumHeight) {
                targetHeight = Math.min(
                    Number(stateValue.restore.height),
                    Math.max(1, bottomLimit - minimumTop));
            }
            target = {
                width: Number(stateValue.restore.width),
                height: targetHeight,
                gravity: Number(Gravity.TOP | Gravity.START),
                x: Number(stateValue.restore.x),
                y: Math.max(minimumTop,
                    Math.min(originalTop,
                        bottomLimit - targetHeight))
            };
            updateLayout(target);
            if (!stateValue.applied) { stateValue.applyCount += 1; }
            stateValue.applied = true;
            return true;
        }

        function poll(generation) {
            var ime;
            var active;
            if (stateValue.stopped || generation !== stateValue.generation) {
                return false;
            }
            try {
                if (rootView === null || !rootView.isAttachedToWindow()) {
                    stop(false);
                    return false;
                }
                ime = readImeState();
                applyImeLayout(ime);
                active = stateValue.applied ||
                    hasFocusedFilterInput(rootView) || ime.visible === true;
                handler.postDelayed(stateValue.runnable, active ? 90 : 420);
                return true;
            } catch (error) {
                stateValue.lastError = String(error);
                handler.postDelayed(stateValue.runnable, 420);
                return false;
            }
        }

        function start() {
            var generation;
            if (stateValue.started || stateValue.stopped) { return false; }
            stateValue.started = true;
            stateValue.generation += 1;
            generation = stateValue.generation;
            stateValue.runnable = new Packages.java.lang.Runnable({
                run: function () { poll(generation); }
            });
            try {
                stateValue.observer = rootView.getViewTreeObserver();
                stateValue.listener = new JavaAdapter(
                    Packages.android.view.ViewTreeObserver
                        .OnGlobalLayoutListener, {
                        onGlobalLayout: function () {
                            if (!stateValue.stopped) {
                                try {
                                    applyImeLayout(readImeState());
                                } catch (error) {
                                    stateValue.lastError = String(error);
                                }
                            }
                        }
                    });
                stateValue.observer.addOnGlobalLayoutListener(
                    stateValue.listener);
            } catch (error) {
                stateValue.lastError = String(error);
                stateValue.observer = null;
                stateValue.listener = null;
            }
            return handler.post(stateValue.runnable) === true;
        }

        function stop(restoreBeforeStop) {
            if (stateValue.stopped) { return true; }
            stateValue.stopped = true;
            stateValue.generation += 1;
            if (stateValue.runnable !== null) {
                try { handler.removeCallbacks(stateValue.runnable); }
                catch (ignoredRunnable) {}
            }
            if (stateValue.observer !== null &&
                    stateValue.listener !== null) {
                try {
                    if (Build.VERSION.SDK_INT >= 16) {
                        stateValue.observer.removeOnGlobalLayoutListener(
                            stateValue.listener);
                    } else {
                        stateValue.observer.removeGlobalOnLayoutListener(
                            stateValue.listener);
                    }
                } catch (ignoredObserver) {}
            }
            if (restoreBeforeStop === true && stateValue.applied) {
                restoreLayout();
            }
            stateValue.runnable = null;
            stateValue.observer = null;
            stateValue.listener = null;
            return true;
        }

        return {
            start: start,
            stop: stop,
            getState: function () {
                return {
                    started: stateValue.started === true,
                    stopped: stateValue.stopped === true,
                    applied: stateValue.applied === true,
                    applyCount: Number(stateValue.applyCount),
                    restoreCount: Number(stateValue.restoreCount),
                    staleSignalIgnoredCount:
                        Number(stateValue.staleSignalIgnoredCount),
                    updateCount: Number(stateValue.updateCount),
                    lastSource: stateValue.lastSource,
                    lastInsetPx: Number(stateValue.lastInsetPx),
                    lastError: stateValue.lastError
                };
            }
        };
    }

    function stopFilterImeAvoidance(restoreBeforeStop) {
        if (filterImeController !== null) {
            try {
                filterImeController.stop(restoreBeforeStop === true);
            } catch (ignored) {}
        }
        filterImeController = null;
        return true;
    }

    function startFilterImeAvoidance() {
        if (panelWindowRoot === null || panelParams === null ||
                windowManager === null) {
            return false;
        }
        stopFilterImeAvoidance(false);
        filterImeController = createFilterImeController(
            panelWindowRoot, panelParams);
        return filterImeController.start();
    }

    function getFilterImeAvoidanceState() {
        return filterImeController === null ? {
            started: false,
            stopped: true,
            applied: false,
            applyCount: 0,
            restoreCount: 0,
            staleSignalIgnoredCount: 0,
            updateCount: 0,
            lastSource: "none",
            lastInsetPx: 0,
            lastError: null
        } : filterImeController.getState();
    }

    function installFirstDrawProbe(rootView, generation) {
        var observer;
        var listener;
        if (rootView === null) { return false; }
        try {
            observer = rootView.getViewTreeObserver();
            listener = new JavaAdapter(
                Packages.android.view.ViewTreeObserver.OnPreDrawListener, {
                onPreDraw: function () {
                    var currentObserver;
                    try {
                        currentObserver = rootView.getViewTreeObserver();
                        if (currentObserver !== null &&
                                currentObserver.isAlive()) {
                            currentObserver.removeOnPreDrawListener(listener);
                        }
                    } catch (ignoredRemove) {}
                    if (generation === performance.showGeneration &&
                            performance.firstDrawAtNs === 0) {
                        performance.firstDrawAtNs = nowNanos();
                        performance.showToFirstDrawMs = elapsedMs(
                            performance.showStartedAtNs,
                            performance.firstDrawAtNs);
                    }
                    return true;
                }
            });
            observer.addOnPreDrawListener(listener);
            return true;
        } catch (error) {
            performance.lastError = String(error);
            return false;
        }
    }

    function createPanelCache(size, type, colors) {
        panelRoot = new LinearLayout(appContext);
        panelRoot.setOrientation(LinearLayout.VERTICAL);
        panelRoot.setPadding(dp(12), dp(8), dp(12), dp(10));
        panelRoot.setBackground(roundedBackground(colors.surface,
            colors.stroke, 24));
        if (Build.VERSION.SDK_INT >= 21) {
            panelRoot.setElevation(dp(20));
        }
        panelManagedFrame = ClipHub.Window.createManagedFrame(
            panelRoot, { accentColor: colors.accentStrong });
        panelWindowRoot = panelManagedFrame.rootView;
        primaryDragView = panelManagedFrame.dragView;
        primaryResizeView = panelManagedFrame.resizeView;
        panelParams = new WindowManager.LayoutParams(
            size.width, size.height, type,
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
                WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED |
                WindowManager.LayoutParams.FLAG_DIM_BEHIND,
            PixelFormat.TRANSLUCENT);
        panelParams.gravity = Gravity.TOP | Gravity.START;
        panelParams.dimAmount = 0.44;
        panelParams.softInputMode =
            WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE |
            WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN;
        try {
            panelParams.setTitle(rootMode ?
                "ClipHub Primary Window" : "ClipHub Filter Panel");
        } catch (ignoredTitle) {}
        panelBuilt = true;
        panelBuiltRootMode = rootMode;
        panelStructureDirty = true;
        state.panelBuilt = true;
        state.panelCacheBuildCount += 1;
        return true;
    }

    function attachPanelCache(size, generation) {
        var thread = nowThread();
        panelParams.width = size.width;
        panelParams.height = size.height;
        panelParams.gravity = Gravity.TOP | Gravity.START;
        panelParams.x = Number(size.x || 0);
        panelParams.y = Number(size.y || 0);
        windowManager.addView(panelWindowRoot, panelParams);
        state.panelAttached = true;
        state.panelOpenCount += 1;
        state.panelWindowType = Number(panelParams.type);
        state.panelFlags = Number(panelParams.flags);
        state.panelX = Number(size.x || 0);
        state.panelY = Number(size.y || 0);
        state.panelWidthPx = size.width;
        state.panelHeightPx = size.height;
        state.panelWidthDp = size.widthDp;
        state.panelHeightDp = size.heightDp;
        state.dimAmount = Number(panelParams.dimAmount);
        state.modalWindow = true;
        state.opaqueBackground = true;
        state.panelAddThreadId = thread.id;
        state.panelAddThreadName = thread.name;
        state.primaryGeometryManaged = rootMode;
        state.primaryResizeViewPresent = primaryResizeView !== null;
        ClipHub.Window.attachWindow({
            role: rootMode ? "primary" : "filter_overlay",
            rootView: panelWindowRoot,
            contentView: panelRoot,
            layoutParams: panelParams,
            windowManager: windowManager,
            dragView: primaryDragView,
            resizeView: primaryResizeView,
            resizeVisual: panelManagedFrame.resizeVisual,
            geometry: size,
            onGeometryChanged: function (geometry) {
                var previousWidth;
                var nextWidth;
                if (!geometry) { return; }
                previousWidth = Number(state.panelWidthPx || 0);
                nextWidth = Number(geometry.width || 0);
                state.panelX = Number(geometry.x || 0);
                state.panelY = Number(geometry.y || 0);
                state.panelWidthPx = nextWidth;
                state.panelHeightPx = Number(geometry.height || 0);
                state.panelWidthDp = Number(geometry.widthDp || 0);
                state.panelHeightDp = Number(geometry.heightDp || 0);
                scheduleAdaptiveResultRefresh(previousWidth, nextWidth);
            },
            onRequestClose: function (reason) {
                return closePanel({ restoreList: false,
                    reason: String(reason || "managed_close") }).ok === true;
            }
        });
        state.primaryGeometryManaged = true;
        state.primaryDragViewPresent = primaryDragView !== null;
        state.primaryResizeViewPresent = primaryResizeView !== null;
        performance.windowAttachedAtNs = nowNanos();
        performance.showToAttachMs = elapsedMs(
            performance.showStartedAtNs, performance.windowAttachedAtNs);
        installFirstDrawProbe(panelWindowRoot, generation);
        return true;
    }

    function destroyPanelCache(reason) {
        stopFilterImeAvoidance(false);
        renderGeneration += 1;
        refreshGeneration += 1;
        refreshScheduled = false;
        try {
            if (panelWindowRoot !== null && ClipHub.Window &&
                    typeof ClipHub.Window.detachWindow === "function") {
                ClipHub.Window.detachWindow(panelWindowRoot);
            }
        } catch (ignoredDetach) {}
        try {
            if (panelWindowRoot !== null &&
                    panelWindowRoot.isAttachedToWindow()) {
                windowManager.removeViewImmediate(panelWindowRoot);
            }
        } catch (ignoredRemove) {}
        state.panelAttached = false;
        panelRoot = null;
        panelWindowRoot = null;
        panelManagedFrame = null;
        panelParams = null;
        primaryDragView = null;
        primaryResizeView = null;
        keywordInput = null;
        searchView = null;
        searchStatusRow = null;
        searchInputRow = null;
        searchToggleView = null;
        searchClearView = null;
        historyContainerView = null;
        resetView = null;
        closeView = null;
        settingsButton = null;
        advancedView = null;
        applyView = null;
        clearHistoryView = null;
        resultContainer = null;
        resultCountView = null;
        resultBodyFrame = null;
        resultScrollView = null;
        loadMoreView = null;
        clearVirtualViewReferences();
        drawerContainer = null;
        drawerScrollView = null;
        drawerContentView = null;
        drawerFooterView = null;
        resultCardViews = [];
        resultActionViews = [];
        panelBuilt = false;
        panelBuiltRootMode = null;
        panelStructureDirty = true;
        state.panelBuilt = false;
        state.panelCacheDestroyCount += 1;
        state.lastError = reason ? String(reason) : state.lastError;
        return true;
    }

    function schedulePanelRefresh(origin, rebuildStructure, requestFocus) {
        var generation = refreshGeneration;
        refreshReason = String(origin || refreshReason || "refresh");
        if (refreshScheduled || mainHandler === null) { return false; }
        refreshScheduled = true;
        mainHandler.post(new Packages.java.lang.Runnable({
            run: function () {
                if (generation !== refreshGeneration) { return; }
                refreshScheduled = false;
                if (!state.panelAttached) { return; }
                try {
                    performance.lastRefreshOrigin = refreshReason;
                    if (mutationRefreshPlan !== null) {
                        refreshMutationResultsOnMain(refreshReason);
                    } else if (panelDataDirty ||
                            rebuildStructure === true ||
                            resultContainer === null) {
                        resetResultPaging(
                            "panel_refresh");
                        apply({ origin: refreshReason });
                        if (rebuildStructure === true ||
                                panelStructureDirty ||
                                resultContainer === null) {
                            buildPanelContent(requestFocus === true);
                            panelStructureDirty = false;
                            state.panelStructureDirty = false;
                        } else {
                            refreshResultsOnMain();
                            updateResultCountOnMain();
                        }
                    }
                } catch (error) {
                    state.lastError = String(error);
                    performance.lastError = String(error);
                }
            }
        }));
        return true;
    }

    function scheduleCoalescedRefresh(origin) {
        invalidateHydrationWorker("coalesced_refresh");
        var generation = refreshGeneration;
        refreshReason = String(origin || "event");
        if (refreshScheduled || mainHandler === null) {
            state.refreshCoalescedCount += 1;
            return false;
        }
        refreshScheduled = true;
        mainHandler.postDelayed(new Packages.java.lang.Runnable({
            run: function () {
                if (generation !== refreshGeneration) { return; }
                refreshScheduled = false;
                if (state.panelAttached && panelDataDirty) {
                    schedulePanelRefresh(refreshReason, false, false);
                }
            }
        }), REFRESH_COALESCE_MS);
        return true;
    }

    function showPanel(options) {
        var result;
        var generation;
        options = options || {};
        rootMode = options.rootMode === true;
        state.rootMode = rootMode;
        state.primarySurface = rootMode ?
            "filter_root" : "filter_overlay";
        if (!ready) { throw new Error("ClipHub filter is not ready"); }
        loadHistory();
        advancedVisible = options.showAdvanced === true;
        searchExpanded = options.requestKeyboard === true &&
            !advancedVisible;
        state.searchExpanded = searchExpanded;
        state.advancedDrawerVisible = advancedVisible;
        restoreListOnClose = false;
        state.homeWindowSuspended = false;
        generation = resetShowPerformance("panel_show");
        if (state.panelAttached) {
            lastShowReused = true;
            state.lastShowReused = true;
            state.panelCacheReuseCount += 1;
            if (advancedVisible || searchExpanded) {
                requireMain(runOnMainSync(function () {
                    buildPanelContent(options.requestKeyboard === true);
                    return true;
                }, 2500));
            }
            return { ok: true, attached: true, reused: true,
                contentReady: state.contentReady === true,
                state: getPanelState() };
        }
        try {
            result = requireMain(runOnMainSync(function () {
                var size = panelDimensions();
                var type = Build.VERSION.SDK_INT >= 26 ?
                    WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY :
                    WindowManager.LayoutParams.TYPE_SYSTEM_ALERT;
                var colors = palette();
                var reused = panelBuilt && panelWindowRoot !== null &&
                    panelBuiltRootMode === rootMode;
                if (panelBuilt && panelBuiltRootMode !== rootMode) {
                    destroyPanelCache("root_mode_changed");
                    reused = false;
                }
                if (!panelBuilt || panelWindowRoot === null) {
                    createPanelCache(size, type, colors);
                }
                lastShowReused = reused;
                state.lastShowReused = reused;
                if (reused) { state.panelCacheReuseCount += 1; }
                attachPanelCache(size, generation);
                if (resultContainer === null || panelStructureDirty) {
                    schedulePanelRefresh("panel_first_content", true,
                        options.requestKeyboard === true);
                } else if (panelDataDirty ||
                        renderedDataVersion !== panelDataVersion) {
                    schedulePanelRefresh("panel_data_refresh", false,
                        false);
                } else {
                    state.contentReady = true;
                    performance.firstBatchReadyAtNs = nowNanos();
                    performance.fullRenderReadyAtNs =
                        performance.firstBatchReadyAtNs;
                    performance.showToFirstBatchMs = elapsedMs(
                        performance.showStartedAtNs,
                        performance.firstBatchReadyAtNs);
                    performance.showToFullRenderMs =
                        performance.showToFirstBatchMs;
                }
                return { ok: true, attached: true, reused: reused,
                    contentReady: state.contentReady === true,
                    state: getPanelState() };
            }, 3000));
            return result;
        } catch (error) {
            performance.lastError = String(error);
            destroyPanelCache("attach_failed: " + String(error));
            rootMode = false;
            state.rootMode = false;
            state.primarySurface = "filter_overlay";
            throw error;
        }
    }

    function closePanel(options) {
        var result;
        var hadTransientLayer;
        options = options || {};
        stopFilterImeAvoidance(false);
        invalidateHydrationWorker("close_panel");
        renderGeneration += 1;
        refreshGeneration += 1;
        refreshScheduled = false;
        hadTransientLayer = advancedVisible || searchExpanded;
        if (!state.panelAttached) {
            if (options.destroyCache === true) {
                destroyPanelCache(options.reason || "destroy");
            }
            rootMode = false;
            state.rootMode = false;
            state.primarySurface = "filter_overlay";
            clearSelectedResult();
            clearDeleteUndo(true);
            return { ok: true, attached: false, alreadyClosed: true,
                state: getPanelState() };
        }
        result = requireMain(runOnMainSync(function () {
            var thread = nowThread();
            try {
                hideKeyboardOnMain();
                if (panelWindowRoot !== null &&
                        panelWindowRoot.isAttachedToWindow()) {
                    windowManager.removeViewImmediate(panelWindowRoot);
                }
                state.panelCloseCount += 1;
                state.panelRemoveThreadId = thread.id;
                state.panelRemoveThreadName = thread.name;
                state.lastError = null;
                return true;
            } finally {
                if (panelWindowRoot !== null && ClipHub.Window &&
                        typeof ClipHub.Window.detachWindow === "function") {
                    try {
                        ClipHub.Window.detachWindow(panelWindowRoot, {
                            preservePreparedFrame:
                                options.destroyCache !== true
                        });
                    }
                    catch (ignoredDetach) {}
                }
                searchGeneration += 1;
                adaptiveRenderGeneration += 1;
                clearDeleteUndo(true);
                clearCopyFeedback();
                state.panelAttached = false;
                state.inputFocused = false;
                state.primaryGeometryManaged = false;
                state.primaryDragViewPresent = false;
                state.primaryResizeViewPresent = false;
            }
        }, 3000));
        if (hadTransientLayer) {
            panelStructureDirty = true;
            state.panelStructureDirty = true;
        }
        advancedVisible = false;
        searchExpanded = false;
        state.searchExpanded = false;
        state.advancedDrawerVisible = false;
        rootMode = false;
        state.rootMode = false;
        state.primarySurface = "filter_overlay";
        restoreListOnClose = false;
        state.homeWindowSuspended = false;
        clearSelectedResult();
        lastShowReused = false;
        state.lastShowReused = false;
        if (options.destroyCache === true) {
            destroyPanelCache(options.reason || "destroy");
        }
        return { ok: result === true, attached: false,
            alreadyClosed: false, state: getPanelState() };
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
        if (searchExpanded) {
            state.backLayerCloseCount += 1;
            state.lastBackLayer = "search_input";
            return setSearchExpanded(false, false);
        }
        state.backLayerCloseCount += 1;
        state.lastBackLayer = "search_panel";
        closePanel({
            reason: "back",
            restoreList: rootMode ? false : true
        });
        return true;
    }

    function getPanelState() {
        var attachedToWindow = false;
        var notFocusable = false;
        try {
            attachedToWindow = (panelWindowRoot !== null ?
                panelWindowRoot : panelRoot) !== null &&
                (panelWindowRoot !== null ?
                    panelWindowRoot : panelRoot).isAttachedToWindow();
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
        updateDrawerMeasurements();
        return {
            pagination: copyPaginationState(),
            ajaxFooter: copyAjaxFooterState(),
            numberPager: copyNumberPagerState(),
            lazyLoad: copyLazyLoadState(),
            prefetch: copyPrefetchState(),
            virtual: copyVirtualState(),
            dataWindow: copyDataWindowState(),
            mutation: copyMutationState(),
            newContentPending:
                paginationState.newContentPending === true,
            quickResetAvailable:
                paginationState.quickResetAvailable === true,
            quickResetPresent: quickResetView !== null,
            attached: state.panelAttached,
            attachedToWindow: attachedToWindow,
            panelBuilt: panelBuilt === true,
            panelStructureDirty: panelStructureDirty === true,
            panelDataDirty: panelDataDirty === true,
            panelDataVersion: Number(panelDataVersion),
            renderedDataVersion: Number(renderedDataVersion),
            contentReady: state.contentReady === true,
            lastShowReused: lastShowReused === true,
            panelCacheReuseCount: Number(state.panelCacheReuseCount),
            panelCacheBuildCount: Number(state.panelCacheBuildCount),
            panelCacheDestroyCount: Number(state.panelCacheDestroyCount),
            renderBatchCount: Number(renderBatchCount),
            firstRenderCount: FIRST_RENDER_COUNT,
            renderBatchSize: RENDER_BATCH_COUNT,
            performance: copyPerformance(),
            focusableWindow: !notFocusable,
            inputPresent: keywordInput !== null,
            advancedKeywordInputPresent: false,
            inputFocused: state.inputFocused,
            sourceOptionCount: Number(state.sourceOptionCount),
            tagOptionCount: Number(state.tagOptionCount),
            sourceChipCount: Object.keys(sourceViews).length,
            tagChipCount: Object.keys(tagViews).length,
            historyChipCount: Number(state.historyChipCount),
            searchExpanded: searchExpanded === true,
            searchTogglePresent: searchToggleView !== null,
            searchClearPresent: searchClearView !== null,
            searchExpandCount: Number(state.searchExpandCount),
            searchCollapseCount: Number(state.searchCollapseCount),
            headerHeightDp: Number(state.headerHeightDp),
            headerControlHeightDp:
                Number(state.headerControlHeightDp),
            headerActionSizeDp: Number(state.headerActionSizeDp),
            headerGapDp: Number(state.headerGapDp),
            headerFilterActiveCount:
                Number(state.headerFilterActiveCount),
            resultCardCount: Number(state.resultCardCount),
            settingsButtonPresent: settingsButton !== null,
            settingsOpenCount: Number(state.settingsOpenCount),
            renderedTagLabelCount: Number(state.renderedTagLabelCount),
            tagColorPreviewCount: Number(state.tagColorPreviewCount),
            loadedResultCount: Number(state.loadedResultCount),
            resultPageSize: Number(state.resultPageSize),
            resultPageLimit: Number(state.resultPageLimit),
            resultHasMore: state.resultHasMore === true,
            resultCanScroll: state.resultCanScroll === true,
            loadMorePresent: loadMoreView !== null,
            loadMoreCount: Number(state.loadMoreCount),
            resultSourceIconCount:
                Number(state.resultSourceIconCount),
            advancedDrawerVisible: advancedVisible,
            advancedButtonText: advancedView !== null ?
                (activeAdvancedFilterCount() > 0 ?
                    "筛选(" + String(activeAdvancedFilterCount()) + ")" :
                    "筛选") : "",
            sortMode: validateSortMode(value && value.sortMode),
            sortOptionCount: Number(state.sortOptionCount),
            sourceWrapRowCount: Number(state.sourceWrapRowCount),
            tagWrapRowCount: Number(state.tagWrapRowCount),
            drawerWidthDp: Number(state.drawerWidthDp),
            drawerHeightDp: Number(state.drawerHeightDp),
            chipSingleLineEnforced:
                state.chipSingleLineEnforced === true,
            chipEllipsizeEndEnforced:
                state.chipEllipsizeEndEnforced === true,
            drawerContentBottomPaddingDp:
                Number(state.drawerContentBottomPaddingDp),
            drawerFooterTopGapDp:
                Number(state.drawerFooterTopGapDp),
            drawerFooterHeightDp:
                Number(state.drawerFooterHeightDp),
            advancedChipVerticalPaddingDp:
                Number(state.advancedChipVerticalPaddingDp),
            drawerMeasured: state.drawerMeasured === true,
            drawerContentHeightDp:
                Number(state.drawerContentHeightDp),
            drawerViewportHeightDp:
                Number(state.drawerViewportHeightDp),
            drawerScrollYDp: Number(state.drawerScrollYDp),
            drawerCanScrollDownAtTop:
                state.drawerCanScrollDownAtTop === true,
            drawerContentFitsViewport:
                state.drawerContentFitsViewport === true,
            repositorySortUnchanged: true,
            sortScope: state.sortScope,
            backLayerCloseCount: Number(state.backLayerCloseCount),
            lastBackLayer: state.lastBackLayer,
            homeWindowSuspended: state.homeWindowSuspended === true,
            homeSuspendCount: Number(state.homeSuspendCount),
            homeRestoreCount: Number(state.homeRestoreCount),
            homeRestoreCancelCount:
                Number(state.homeRestoreCancelCount),
            exclusiveHomeFilter: state.exclusiveHomeFilter === true,
            rootMode: rootMode === true,
            primarySurface: state.primarySurface,
            selectedItemId: selectedItemId,
            selectionEnabled: SELECTION_ENABLED === true,
            selectionMode: SELECTION_ENABLED && selectedItemId !== null,
            resultCardClickCount:
                Number(state.resultCardClickCount),
            resultCardLongPressCount:
                Number(state.resultCardLongPressCount),
            inputActionCount: Number(state.inputActionCount),
            inputSuccessCount: Number(state.inputSuccessCount),
            inputFailureCount: Number(state.inputFailureCount),
            inputRetryCount: Number(state.inputRetryCount),
            inputDuplicateBlockedCount:
                Number(state.inputDuplicateBlockedCount),
            inputDispatchPending: inputDispatchPending === true,
            lastInputItemId: state.lastInputItemId,
            lastInputContentLength:
                Number(state.lastInputContentLength),
            lastInputAttemptCount:
                Number(state.lastInputAttemptCount),
            lastInputAt: Number(state.lastInputAt),
            lastInputOrigin: state.lastInputOrigin,
            lastInputError: state.lastInputError,
            copyActionCount: Number(state.copyActionCount),
            pinActionCount: Number(state.pinActionCount),
            editActionCount: Number(state.editActionCount),
            addActionCount: Number(state.addActionCount),
            deleteActionCount: Number(state.deleteActionCount),
            detailActionCount: Number(state.detailActionCount),
            cardActionButtonCount: Number(state.cardActionButtonCount),
            cardEditActionCount: Number(state.cardEditActionCount),
            cardTranslateActionCount:
                Number(state.cardTranslateActionCount),
            cardCopyActionCount: Number(state.cardCopyActionCount),
            cardDeleteActionCount: Number(state.cardDeleteActionCount),
            cardActionGridWidthDp:
                Number(state.cardActionGridWidthDp),
            cardActionCellHeightDp:
                Number(state.cardActionCellHeightDp),
            cardActionFontScale: Number(state.cardActionFontScale),
            cardActionIconSizeDp:
                Number(state.cardActionIconSizeDp),
            pinnedBadgeCount: Number(state.pinnedBadgeCount),
            pinBadgeSizeDp: Number(state.pinBadgeSizeDp),
            deleteUndoVisible: state.deleteUndoVisible === true,
            deleteUndoItemId: state.deleteUndoItemId,
            deleteUndoShowCount: Number(state.deleteUndoShowCount),
            deleteUndoActionCount: Number(state.deleteUndoActionCount),
            deleteUndoTimeoutCount:
                Number(state.deleteUndoTimeoutCount),
            copyFeedbackVisible: state.copyFeedbackVisible === true,
            copyFeedbackShowCount:
                Number(state.copyFeedbackShowCount),
            copyFeedbackTimeoutCount:
                Number(state.copyFeedbackTimeoutCount),
            adaptiveLayoutRefreshCount:
                Number(state.adaptiveLayoutRefreshCount),
            swipeEnabled: state.swipeEnabled === true,
            swipeStartCount: Number(state.swipeStartCount),
            swipeMoveCount: Number(state.swipeMoveCount),
            swipePinCount: Number(state.swipePinCount),
            swipeDeleteCount: Number(state.swipeDeleteCount),
            swipeCancelCount: Number(state.swipeCancelCount),
            lastSwipeItemId: state.lastSwipeItemId,
            lastSwipeAction: state.lastSwipeAction,
            toolbarEnabledCount:
                Number(state.toolbarEnabledCount),
            panelWindowType: state.panelWindowType,
            panelFlags: state.panelFlags,
            panelWidthPx: state.panelWidthPx,
            panelHeightPx: state.panelHeightPx,
            panelWidthDp: state.panelWidthDp,
            panelHeightDp: state.panelHeightDp,
            panelX: Number(state.panelX || 0),
            panelY: Number(state.panelY || 0),
            primaryGeometryManaged: state.primaryGeometryManaged === true,
            primaryDragViewPresent: state.primaryDragViewPresent === true,
            primaryResizeViewPresent: state.primaryResizeViewPresent === true,
            resizeCorner: state.resizeCorner,
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
        state.searchExpanded = false;
        state.searchExpandCount = 0;
        state.searchCollapseCount = 0;
        state.headerHeightDp = 0;
        state.headerControlHeightDp = 0;
        state.headerActionSizeDp = 0;
        state.headerGapDp = 0;
        state.headerFilterActiveCount = 0;
        state.sourceToggleCount = 0;
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
        state.chipSingleLineEnforced = true;
        state.chipEllipsizeEndEnforced = true;
        state.drawerContentBottomPaddingDp = 0;
        state.drawerFooterTopGapDp = 0;
        state.drawerFooterHeightDp = 0;
        state.advancedChipVerticalPaddingDp = 0;
        state.drawerMeasured = false;
        state.drawerContentHeightDp = 0;
        state.drawerViewportHeightDp = 0;
        state.drawerScrollYDp = 0;
        state.drawerCanScrollDownAtTop = false;
        state.drawerContentFitsViewport = false;
        state.advancedKeywordInputPresent = false;
        state.sortOptionCount = 0;
        state.sourceWrapRowCount = 0;
        state.tagWrapRowCount = 0;
        state.drawerWidthDp = 0;
        state.drawerHeightDp = 0;
        state.backLayerCloseCount = 0;
        state.lastBackLayer = "";
        state.homeWindowSuspended = false;
        state.homeSuspendCount = 0;
        state.homeRestoreCount = 0;
        state.homeRestoreCancelCount = 0;
        state.exclusiveHomeFilter = true;
        state.rootMode = false;
        state.primarySurface = "filter_overlay";
        state.selectedItemId = null;
        state.selectionMode = false;
        state.resultCardClickCount = 0;
        state.resultCardLongPressCount = 0;
        state.inputActionCount = 0;
        state.inputSuccessCount = 0;
        state.inputFailureCount = 0;
        state.inputRetryCount = 0;
        state.inputDuplicateBlockedCount = 0;
        state.lastInputItemId = null;
        state.lastInputContentLength = 0;
        state.lastInputAttemptCount = 0;
        state.lastInputAt = 0;
        state.lastInputOrigin = "";
        state.lastInputError = null;
        state.copyActionCount = 0;
        state.pinActionCount = 0;
        state.editActionCount = 0;
        state.addActionCount = 0;
        state.deleteActionCount = 0;
        state.detailActionCount = 0;
        state.cardActionButtonCount = 0;
        state.cardEditActionCount = 0;
        state.cardTranslateActionCount = 0;
        state.cardCopyActionCount = 0;
        state.cardDeleteActionCount = 0;
        state.cardActionGridWidthDp = 0;
        state.cardActionCellHeightDp = 0;
        state.cardActionFontScale = 1;
        state.cardActionIconSizeDp = 0;
        state.pinnedBadgeCount = 0;
        state.pinBadgeSizeDp = 0;
        state.deleteUndoVisible = false;
        state.deleteUndoItemId = null;
        state.deleteUndoShowCount = 0;
        state.deleteUndoActionCount = 0;
        state.deleteUndoTimeoutCount = 0;
        state.copyFeedbackVisible = false;
        state.copyFeedbackShowCount = 0;
        state.copyFeedbackTimeoutCount = 0;
        state.adaptiveLayoutRefreshCount = 0;
        state.swipeEnabled = true;
        state.swipeStartCount = 0;
        state.swipeMoveCount = 0;
        state.swipePinCount = 0;
        state.swipeDeleteCount = 0;
        state.swipeCancelCount = 0;
        state.lastSwipeItemId = null;
        state.lastSwipeAction = null;
        state.settingsOpenCount = 0;
        state.settingsButtonPresent = false;
        state.renderedTagLabelCount = 0;
        state.tagColorPreviewCount = 0;
        state.loadedResultCount = 0;
        state.resultPageSize =
            Number(paginationState.pageSize);
        state.resultPageLimit =
            Number(paginationState.pageSize);
        state.resultHasMore = false;
        state.resultCanScroll = false;
        state.loadMoreCount = 0;
        state.toolbarEnabledCount = 0;
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
        state.tagOptionCount = 0;
        state.sourceChipCount = 0;
        state.tagChipCount = 0;
        state.historyChipCount = 0;
        state.resultCardCount = 0;
        state.resultSourceIconCount = 0;
        state.advancedDrawerVisible = false;
        state.searchPageStyle = "reference_search_v14_fast_start";
        state.panelBuilt = panelBuilt === true;
        state.panelStructureDirty = panelStructureDirty === true;
        state.panelDataDirty = panelDataDirty === true;
        state.panelDataVersion = panelDataVersion;
        state.renderedDataVersion = renderedDataVersion;
        state.contentReady = false;
        state.lastShowReused = false;
        state.panelCacheReuseCount = 0;
        state.panelCacheBuildCount = 0;
        state.panelCacheDestroyCount = 0;
        state.renderBatchCount = 0;
        state.firstRenderCount = FIRST_RENDER_COUNT;
        state.renderBatchSize = RENDER_BATCH_COUNT;
        state.refreshCoalescedCount = 0;
        state.lastError = null;
    }

    ClipHub.Filter = {
        MODULE_NAME: "ch_11_filter",
        MODULE_VERSION: 58,
        PAGINATION_STAGE: PAGINATION_STAGE,

        getHydrationWorkerState: function () {
            return copyHydrationWorkerState();
        },

        getScrollPerformanceState: function () {
            return copyScrollPerformanceState();
        },

        init: function (context) {
            stopFilterImeAvoidance(false);
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
            resetHydrationWorkerDiagnostics();
            density = Number(appContext.getResources()
                .getDisplayMetrics().density || 1);
            touchSlop = Number(ViewConfiguration.get(appContext)
                .getScaledTouchSlop());
            value = emptyValue();
            ready = true;
            eventListeners = [];
            panelRoot = null;
            panelWindowRoot = null;
            panelManagedFrame = null;
            panelParams = null;
            primaryDragView = null;
            primaryResizeView = null;
            panelBuilt = false;
            panelBuiltRootMode = null;
            panelStructureDirty = true;
            panelDataDirty = true;
            panelDataVersion = 1;
            renderedDataVersion = 0;
            renderGeneration = 0;
            renderCursor = 0;
            renderBatchCount = 0;
            optionCountsCache = null;
            optionCountsDirty = true;
            refreshGeneration = 0;
            refreshScheduled = false;
            refreshReason = "";
            lastShowReused = false;
            timeFormatter = null;
            advancedVisible = false;
            previewRows = [];
            searchGeneration = 0;
            restoreListOnClose = false;
            rootMode = false;
            selectedItemId = null;
            resultCardViews = [];
            toolbarActionViews = {};
            resultTagMap = {};
            resultScrollView = null;
            loadMoreView = null;
            resultBodyFrame = null;
            resultActionViews = [];
            sourceIconConstantStateCache = {};
            deleteUndoView = null;
            pendingDeleteUndo = null;
            deleteUndoGeneration = 0;
            copyFeedbackView = null;
            copyFeedbackGeneration = 0;
            adaptiveRenderGeneration = 0;
            searchExpanded = false;
            searchStatusRow = null;
            searchInputRow = null;
            searchToggleView = null;
            searchClearView = null;
            historyContainerView = null;
            inputDispatchGeneration += 1;
            inputDispatchPending = false;
            paginationState.newContentPending = false;
            paginationState.quickResetAvailable = false;
            resetVirtualState(true);
            resetMutationState();
            resetResultPaging("filter_init");
            resetState();
            loadHistory();
            registerEvent("clipboard_added");
            registerEvent("clipboard_merged");
            registerEvent("clipboard_deleted");
            registerEvent("clipboard_restored");
            registerEvent("tags_changed");
            registerEvent(
                "pagination_settings_changed");
            return true;
        },

        isReady: function () { return ready; },
        isActive: function () { return isActive(value); },
        get: function () { return copyValue(value); },

        getState: function () {
            return {
                ready: ready,
                active: isActive(value),
                pagination:
                    copyPaginationState(),
                ajaxFooter:
                    copyAjaxFooterState(),
                numberPager:
                    copyNumberPagerState(),
                lazyLoad:
                    copyLazyLoadState(),
                prefetch:
                    copyPrefetchState(),
                virtual:
                    copyVirtualState(),
                dataWindow:
                    copyDataWindowState(),
                hydrationWorker:
                    copyHydrationWorkerState(),
                scrollPerformance:
                    copyScrollPerformanceState(),
                mutation:
                    copyMutationState(),
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
        syncPaginationSettings: function () {
            return syncPaginationSettings(
                "public_settings_sync");
        },
        resetPagination: function (reason) {
            return resetUnifiedPagination(
                reason || "public_reset");
        },
        getPaginationState:
            copyPaginationState,
        getPaginationQueryOptions:
            paginationQueryOptions,
        loadPaginationPage: function (request) {
            return loadPaginationPageInternal(
                request || {});
        },
        getAjaxFooterState:
            copyAjaxFooterState,
        getNumberPagerState:
            copyNumberPagerState,
        getLazyLoadState:
            copyLazyLoadState,
        getPrefetchState:
            copyPrefetchState,
        getVirtualState:
            copyVirtualState,
        getDataWindowState:
            copyDataWindowState,
        getMutationState:
            copyMutationState,
        performMutationRefresh: function (origin) {
            return requireMain(runOnMainSync(function () {
                return refreshMutationResultsOnMain(
                    origin || "api_mutation_refresh");
            }, 10000));
        },
        getDataWindowRowSnapshot:
            dataWindowRowSnapshot,
        performDataWindowMaintenance: function (origin) {
            return requireMain(runOnMainSync(function () {
                var range = virtualTargetRange(
                    virtualState.firstVisibleIndex);
                var hydration = hydrateDataWindowRange(
                    range.start, range.end,
                    origin || "api_data_window_hydrate");
                if (Number(hydration.missingCount) > 0) {
                    range = virtualTargetRange(
                        virtualState.firstVisibleIndex);
                    hydrateDataWindowRange(
                        range.start, range.end,
                        origin ||
                            "api_data_window_hydrate_after_missing");
                }
                dehydrateDataWindowOutside(
                    range.start, range.end,
                    origin || "api_data_window_dehydrate");
                rebuildVirtualWindow(
                    origin || "api_data_window_rebuild",
                    true, range.first);
                return copyDataWindowState();
            }, 5000));
        },
        captureResultAnchor: function () {
            return requireMain(runOnMainSync(function () {
                return captureScrollAnchor();
            }, 2500));
        },
        performVirtualUpdate: function (origin) {
            return requireMain(runOnMainSync(function () {
                captureScrollAnchor();
                rebuildVirtualWindow(
                    origin || "api_virtual_update",
                    false,
                    virtualState.firstVisibleIndex);
                return copyVirtualState();
            }, 2500));
        },
        performScrollToItemId: function (itemId,
                offsetPx, origin) {
            return requireMain(runOnMainSync(function () {
                return scrollToVirtualItem(
                    itemId, offsetPx,
                    origin || "api_scroll_to_item");
            }, 2500));
        },
        resetToLatest: resetToLatest,
        performQuickResetClick: function () {
            return requireMain(runOnMainSync(function () {
                return quickResetView !== null &&
                    quickResetView.getVisibility() === View.VISIBLE ?
                        quickResetView.performClick() : false;
            }, 2500));
        },
        performPrefetchNow: function (origin) {
            return requireMain(
                runOnMainSync(function () {
                    return prefetchNextPageNow(
                        origin || "api_prefetch_now");
                }, 5000));
        },
        performLazyLoadCheck: function (origin) {
            return requireMain(
                runOnMainSync(function () {
                    lazyLoadState.lastOldScrollY =
                        Math.max(0,
                            currentResultScrollY() - 1);
                    lazyLoadState.lastScrollY =
                        currentResultScrollY();
                    return maybeTriggerLazyLoad(
                        origin || "api_lazy_check",
                        false);
                }, 5000));
        },
        getRemainingScrollPx:
            resultRemainingScrollPx,
        calculatePageButtons:
            calculatePageButtons,
        goToPage: function (page, origin) {
            return requireMain(runOnMainSync(function () {
                return goToPage(page,
                    origin || "api_number_page",
                    "page");
            }, 5000));
        },
        performNumberPageClick: function (page) {
            page = String(Math.floor(Number(page)));
            return requireMain(runOnMainSync(function () {
                return numberPageViews[page] ?
                    numberPageViews[page].performClick() :
                    false;
            }, 5000));
        },
        performNumberActionClick: function (action) {
            action = String(action || "");
            return requireMain(runOnMainSync(function () {
                return numberActionViews[action] ?
                    numberActionViews[action].performClick() :
                    false;
            }, 5000));
        },
        getLoadedResultIds:
            loadedResultIds,
        refreshPaginationUi:
            refreshPaginationUi,
        getResultScrollY:
            currentResultScrollY,
        performSetResultScrollY:
            function (valueY) {
                return requireMain(
                    runOnMainSync(function () {
                        return setResultScrollY(
                            valueY);
                    }, 2500));
            },

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

        getTagOptions: function () {
            return ClipHub.Repository.listTags();
        },

        showPanel: showPanel,
        showRoot: function (options) {
            options = options || {};
            options.rootMode = true;
            if (options.requestKeyboard === undefined) {
                options.requestKeyboard = false;
            }
            return showPanel(options);
        },
        closePanel: closePanel,
        handleBack: handleBack,
        getPanelState: getPanelState,
        getImeAvoidanceState: getFilterImeAvoidanceState,
        FILTER_IME_AVOIDANCE: "formal_v34",
        getSelectedItemId: function () { return selectedItemId; },

        performResultClick: function (index) {
            index = Math.floor(Number(index));
            return requireMain(runOnMainSync(function () {
                return index >= 0 && index < resultCardViews.length ?
                    resultCardViews[index].performClick() : false;
            }, 2500));
        },

        performResultLongClick: function (index) {
            index = Math.floor(Number(index));
            return requireMain(runOnMainSync(function () {
                return index >= 0 && index < resultCardViews.length ?
                    resultCardViews[index].performLongClick() : false;
            }, 2500));
        },

        performResultActionClick: function (index, action) {
            index = Math.floor(Number(index));
            action = String(action || "");
            return requireMain(runOnMainSync(function () {
                var views = index >= 0 && index < resultActionViews.length ?
                    resultActionViews[index] : null;
                return views !== null && views[action] ?
                    views[action].performClick() : false;
            }, 2500));
        },

        performDeleteUndoClick: function () {
            return requireMain(runOnMainSync(function () {
                return deleteUndoView !== null ?
                    performDeleteUndo() : false;
            }, 2500));
        },

        performBottomActionClick: function (action) {
            action = String(action || "");
            return requireMain(runOnMainSync(function () {
                return toolbarActionViews[action] ?
                    toolbarActionViews[action].performClick() : false;
            }, 2500));
        },

        performLoadMoreClick: function () {
            return requireMain(runOnMainSync(function () {
                return loadMoreView !== null ?
                    loadMoreView.performClick() : false;
            }, 2500));
        },

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

        performSearchToggleClick: function () {
            return requireMain(runOnMainSync(function () {
                return searchToggleView !== null ?
                    searchToggleView.performClick() : false;
            }, 2500));
        },

        performSearchClearClick: function () {
            return requireMain(runOnMainSync(function () {
                return searchClearView !== null ?
                    searchClearView.performClick() : false;
            }, 2500));
        },

        performSettingsClick: function () {
            return requireMain(runOnMainSync(function () {
                return settingsButton !== null ?
                    settingsButton.performClick() : false;
            }, 2500));
        },

        performAdvancedClick: function () {
            return requireMain(runOnMainSync(function () {
                return advancedView !== null ?
                    advancedView.performClick() : false;
            }, 2500));
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
                closePanel({
                    restoreList: false,
                    reason: "shutdown",
                    destroyCache: true
                });
            } catch (ignoredClose) {}
            shutdownHydrationWorker();
            unregisterEvents();
            searchGeneration += 1;
            adaptiveRenderGeneration += 1;
            inputDispatchGeneration += 1;
            inputDispatchPending = false;
            clearDeleteUndo(true);
            clearCopyFeedback();
            rootMode = false;
            searchExpanded = false;
            selectedItemId = null;
            resultCardViews = [];
            toolbarActionViews = {};
            resultTagMap = {};
            resultScrollView = null;
            loadMoreView = null;
            clearVirtualViewReferences();
            resultBodyFrame = null;
            resultActionViews = [];
            sourceIconConstantStateCache = {};
            deleteUndoView = null;
            pendingDeleteUndo = null;
            copyFeedbackView = null;
            copyFeedbackGeneration = 0;
            cancelActiveSwipe(false);
            activeSwipeCard = null;
            paginationState.newContentPending = false;
            paginationState.quickResetAvailable = false;
            resetMutationState();
            resetVirtualState(true);
            resetResultPaging();
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
