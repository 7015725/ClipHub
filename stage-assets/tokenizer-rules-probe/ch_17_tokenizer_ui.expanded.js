(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var Context = Packages.android.content.Context;
    var Looper = Packages.android.os.Looper;
    var Handler = Packages.android.os.Handler;
    var View = Packages.android.view.View;
    var ViewGroup = Packages.android.view.ViewGroup;
    var MotionEvent = Packages.android.view.MotionEvent;
    var ViewConfiguration = Packages.android.view.ViewConfiguration;
    var Gravity = Packages.android.view.Gravity;
    var GradientDrawable = Packages.android.graphics.drawable.GradientDrawable;
    var LinearLayout = Packages.android.widget.LinearLayout;
    var FrameLayout = Packages.android.widget.FrameLayout;
    var ScrollView = Packages.android.widget.ScrollView;
    var TextView = Packages.android.widget.TextView;
    var EditText = Packages.android.widget.EditText;
    var TypedValue = Packages.android.util.TypedValue;
    var InputType = Packages.android.text.InputType;
    var TextWatcher = Packages.android.text.TextWatcher;
    var Typeface = Packages.android.graphics.Typeface;

    var appContext = null;
    var mainHandler = null;
    var density = 1;
    var touchSlopPx = 8;
    var longPressTimeoutMs = 500;
    var ready = false;

    var originalWindowAttach = null;
    var originalWindowDetach = null;
    var windowHooksInstalled = false;

    var originalAppStart = null;
    var originalAppStop = null;
    var originalAppGetStatus = null;
    var appHooksInstalled = false;

    var editorPanelRoot = null;
    var editorWindowRoot = null;
    var editorEmbeddedInPrimary = false;
    var editorObserver = null;
    var editorLayoutListener = null;
    var editorEntryView = null;
    var ensureEntryPosted = false;
    var entryInstallGuard = false;
    var savedEditorChildren = [];
    var savedEditorPadding = null;

    var pageRoot = null;
    var pageColumn = null;
    var modeNormalView = null;
    var modeRegexView = null;
    var bodyContainer = null;
    var statsLeftView = null;
    var statsRightView = null;
    var tokenScroll = null;
    var tokenFlowRoot = null;
    var regexInput = null;
    var popupCard = null;
    var tokenViews = [];
    var tokenRows = [];
    var flowObserver = null;
    var flowLayoutListener = null;
    var lastFlowWidth = 0;
    var reflowPosted = false;

    var gesture = {
        tracking: false,
        longPressed: false,
        dragActive: false,
        startIndex: -1,
        targetSelected: false,
        downRawX: 0,
        downRawY: 0,
        longRunnable: null
    };

    var state = {
        ready: false,
        mounted: false,
        mode: "normal",
        sourceText: "",
        regexText: "",
        tokens: [],
        selectedIndexes: [],
        tokenCount: 0,
        wordCount: 0,
        symbolCount: 0,
        mountCount: 0,
        unmountCount: 0,
        entryInstallCount: 0,
        renderCount: 0,
        reflowCount: 0,
        actionCount: 0,
        popupVisible: false,
        popupTokenIndex: -1,
        lastAction: "",
        lastError: null,
        serviceStatus: "idle",
        serviceError: null
    };

    function dp(value) {
        return Math.max(1, Math.floor(Number(value) * density + 0.5));
    }

    function palette() {
        if (!ClipHub.Theme ||
                typeof ClipHub.Theme.getPalette !== "function") {
            throw new Error("ClipHub Theme palette unavailable for TokenizerUI");
        }
        return ClipHub.Theme.getPalette(appContext);
    }

    function safeTextColor(view, color) {
        if (!ClipHub.Theme ||
                typeof ClipHub.Theme.applyTextColor !== "function") {
            throw new Error("ClipHub Theme text color API unavailable");
        }
        ClipHub.Theme.applyTextColor(view, color);
    }

    function safeHintColor(view, color) {
        if (!ClipHub.Theme ||
                typeof ClipHub.Theme.applyHintTextColor !== "function") {
            throw new Error("ClipHub Theme hint color API unavailable");
        }
        ClipHub.Theme.applyHintTextColor(view, color);
    }

    function roundedBackground(fill, stroke, radiusDp) {
        var drawable = new GradientDrawable();
        drawable.setShape(GradientDrawable.RECTANGLE);
        if (!ClipHub.Theme ||
                typeof ClipHub.Theme.applyGradientColor !== "function" ||
                typeof ClipHub.Theme.applyGradientStroke !== "function") {
            throw new Error("ClipHub Theme gradient color API unavailable");
        }
        ClipHub.Theme.applyGradientColor(drawable, fill);
        drawable.setCornerRadius(dp(radiusDp));
        if (stroke !== null && stroke !== undefined) {
            ClipHub.Theme.applyGradientStroke(drawable, dp(1), stroke);
        }
        return drawable;
    }

    function applyBackground(view, fill, stroke, radiusDp) {
        if (view === null || view === undefined) { return false; }
        view.setBackground(roundedBackground(fill, stroke, radiusDp));
        return true;
    }

    function makeText(text, sizeSp, color, bold, semanticIcon) {
        var view = new TextView(appContext);
        view.setText(String(text));
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, Number(sizeSp));
        safeTextColor(view, color);
        view.setIncludeFontPadding(false);
        if (bold) {
            view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        }
        /* panel_icon_explicit_v2 */
if (semanticIcon === true && ClipHub.Theme &&
        typeof ClipHub.Theme.decoratePanelIcon === "function") {
    ClipHub.Theme.decoratePanelIcon(view, text, view.getCurrentTextColor(), sizeSp, true);
}
return view;
    }

    function selectedTextColor(colors) {
        return colors.dark ? colors.textPrimary : "#FFFFFFFF";
    }

    function makeClickText(text, sizeSp, colors, description) {
        var view = makeText(text, sizeSp, colors.icon, false);
        view.setGravity(Gravity.CENTER);
        view.setClickable(true);
        view.setFocusable(true);
        if (description) { view.setContentDescription(String(description)); }
        return view;
    }

    function copyArray(value) {
        return value && value.slice ? value.slice(0) : [];
    }

    function indexSelected(index) {
        return state.selectedIndexes.indexOf(Number(index)) >= 0;
    }

    function selectedCount() {
        return state.selectedIndexes.length;
    }

    function normalizeToken(value, index) {
        var token = value || {};
        return {
            index: Number(index),
            text: String(token.text === undefined || token.text === null ?
                "" : token.text),
            type: String(token.type || "word") === "symbol" ?
                "symbol" : "word"
        };
    }

    function normalizeTokens(values) {
        var source = values || [];
        var out = [];
        var index;
        for (index = 0; index < source.length; index += 1) {
            out.push(normalizeToken(source[index], index));
        }
        return out;
    }

    function recalculateStats(stats) {
        var words = 0;
        var symbols = 0;
        var index;
        for (index = 0; index < state.tokens.length; index += 1) {
            if (String(state.tokens[index].type) === "symbol") {
                symbols += 1;
            } else {
                words += 1;
            }
        }
        state.tokenCount = stats && stats.total !== undefined ?
            Number(stats.total) : state.tokens.length;
        state.wordCount = stats && stats.words !== undefined ?
            Number(stats.words) : words;
        state.symbolCount = stats && stats.symbols !== undefined ?
            Number(stats.symbols) : symbols;
    }

    function updateStatsViews() {
        if (statsLeftView !== null) {
            if (state.serviceStatus === "loading") {
                statsLeftView.setText("正在分词…");
            } else if (state.serviceStatus === "failed") {
                statsLeftView.setText("分词失败");
            } else {
                statsLeftView.setText(selectedCount() > 0 ?
                    "已选择 " + String(selectedCount()) + " 项" :
                    "共 " + String(state.tokenCount) + " 个词语");
            }
        }
        if (statsRightView !== null) {
            statsRightView.setText(
                "单词 " + String(state.wordCount) +
                " / 符号 " + String(state.symbolCount));
        }
    }

    function emitAction(action, extra) {
        var payload = {
            action: String(action || ""),
            mode: String(state.mode),
            tokenIndex: -1,
            selectedIndexes: copyArray(state.selectedIndexes),
            regexText: String(state.regexText || ""),
            sourceText: String(state.sourceText || "")
        };
        var key;
        extra = extra || {};
        for (key in extra) {
            if (extra.hasOwnProperty(key)) { payload[key] = extra[key]; }
        }
        state.actionCount += 1;
        state.lastAction = payload.action;
        try {
            if (ClipHub.EventBus &&
                    typeof ClipHub.EventBus.emit === "function") {
                ClipHub.EventBus.emit("tokenizer_ui_action", payload);
            }
        } catch (error) {
            state.lastError = String(error);
        }
        return payload;
    }

    function cancelLongPress() {
        if (mainHandler !== null && gesture.longRunnable !== null) {
            try { mainHandler.removeCallbacks(gesture.longRunnable); }
            catch (ignored) {}
        }
        gesture.longRunnable = null;
    }

    function resetGesture() {
        cancelLongPress();
        gesture.tracking = false;
        gesture.longPressed = false;
        gesture.dragActive = false;
        gesture.startIndex = -1;
        gesture.targetSelected = false;
        gesture.downRawX = 0;
        gesture.downRawY = 0;
    }

    function applyTokenStyle(index) {
        var colors = palette();
        var view = tokenViews[Number(index)];
        var selected;
        if (!view) { return false; }
        selected = indexSelected(index);
        applyBackground(view,
            selected ? colors.accentStrong : colors.surfaceMuted,
            selected ? colors.accentStrong : colors.stroke,
            8);
        safeTextColor(view,
            selected ? selectedTextColor(colors) : colors.textPrimary);
        view.setSelected(selected);
        return true;
    }

    function setTokenSelected(index, selected) {
        var numeric = Number(index);
        var current = state.selectedIndexes.indexOf(numeric);
        if (numeric < 0 || numeric >= state.tokens.length) { return false; }
        if (selected && current < 0) {
            state.selectedIndexes.push(numeric);
            state.selectedIndexes.sort(function (a, b) { return a - b; });
        } else if (!selected && current >= 0) {
            state.selectedIndexes.splice(current, 1);
        }
        applyTokenStyle(numeric);
        updateStatsViews();
        return true;
    }

    function toggleToken(index) {
        return setTokenSelected(index, !indexSelected(index));
    }

    function tokenAtRawPoint(rawX, rawY) {
        var index;
        var view;
        var location = Packages.java.lang.reflect.Array.newInstance(
            Packages.java.lang.Integer.TYPE, 2);
        var left;
        var top;
        for (index = 0; index < tokenViews.length; index += 1) {
            view = tokenViews[index];
            if (!view || view.getVisibility() !== View.VISIBLE) { continue; }
            try {
                view.getLocationOnScreen(location);
                left = Number(location[0]);
                top = Number(location[1]);
                if (Number(rawX) >= left &&
                        Number(rawX) < left + Number(view.getWidth()) &&
                        Number(rawY) >= top &&
                        Number(rawY) < top + Number(view.getHeight())) {
                    return index;
                }
            } catch (ignored) {}
        }
        return -1;
    }

    function hidePopup() {
        if (popupCard !== null) {
            try {
                if (popupCard.getParent() !== null) {
                    popupCard.getParent().removeView(popupCard);
                }
            } catch (ignored) {}
        }
        popupCard = null;
        state.popupVisible = false;
        state.popupTokenIndex = -1;
        return true;
    }

    function makePopupAction(label, action, danger) {
        var colors = palette();
        var view = makeText(label, 10,
            danger ? colors.danger : colors.textPrimary, false);
        view.setGravity(Gravity.CENTER);
        view.setClickable(true);
        view.setFocusable(true);
        view.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () {
                var tokenIndex = Number(state.popupTokenIndex);
                emitAction(action, { tokenIndex: tokenIndex });
                hidePopup();
            }
        }));
        return view;
    }

    function showPopup(index) {
        var colors = palette();
        var labels = [
            ["复制", "copy", false],
            ["输入", "input", false],
            ["搜索", "search", false],
            ["编辑", "edit", false],
            ["删除", "delete", true]
        ];
        var item;
        var params;
        var index2;
        if (!state.mounted || pageRoot === null) { return false; }
        hidePopup();
        popupCard = new LinearLayout(appContext);
        popupCard.setOrientation(LinearLayout.HORIZONTAL);
        popupCard.setGravity(Gravity.CENTER_VERTICAL);
        popupCard.setPadding(dp(6), dp(4), dp(6), dp(4));
        applyBackground(popupCard, colors.surfaceRaised, colors.stroke, 13);
        if (Packages.android.os.Build.VERSION.SDK_INT >= 21) {
            try { popupCard.setElevation(dp(12)); } catch (ignoredElevation) {}
        }
        for (index2 = 0; index2 < labels.length; index2 += 1) {
            item = makePopupAction(labels[index2][0], labels[index2][1],
                labels[index2][2]);
            popupCard.addView(item,
                new LinearLayout.LayoutParams(0, dp(44), 1));
        }
        params = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, dp(52));
        params.gravity = Gravity.BOTTOM;
        params.leftMargin = dp(24);
        params.rightMargin = dp(24);
        params.bottomMargin = dp(84);
        pageRoot.addView(popupCard, params);
        state.popupVisible = true;
        state.popupTokenIndex = Number(index);
        return true;
    }

    function scheduleTokenLongPress(view, index) {
        cancelLongPress();
        gesture.longRunnable = new Packages.java.lang.Runnable({
            run: function () {
                if (!state.mounted || !gesture.tracking ||
                        gesture.startIndex !== Number(index)) {
                    return;
                }
                gesture.longPressed = true;
                gesture.dragActive = false;
                if (!indexSelected(index)) {
                    setTokenSelected(index, true);
                }
                try {
                    if (ClipHub.Window &&
                            typeof ClipHub.Window.performHaptic === "function") {
                        ClipHub.Window.performHaptic(view, "confirm");
                    } else {
                        view.performHapticFeedback(
                            Packages.android.view.HapticFeedbackConstants.LONG_PRESS);
                    }
                } catch (ignoredHaptic) {}
                showPopup(index);
                emitAction("token_long_press", { tokenIndex: Number(index) });
            }
        });
        mainHandler.postDelayed(gesture.longRunnable, longPressTimeoutMs);
    }

    function makeTokenTouchListener(index) {
        return new JavaAdapter(View.OnTouchListener, {
            onTouch: function (view, event) {
                var action = Number(event.getActionMasked());
                var rawX = Number(event.getRawX());
                var rawY = Number(event.getRawY());
                var dx;
                var dy;
                var hit;
                if (action === MotionEvent.ACTION_DOWN) {
                    hidePopup();
                    resetGesture();
                    gesture.tracking = true;
                    gesture.startIndex = Number(index);
                    gesture.targetSelected = !indexSelected(index);
                    gesture.downRawX = rawX;
                    gesture.downRawY = rawY;
                    scheduleTokenLongPress(view, index);
                    return true;
                }
                if (!gesture.tracking) { return true; }
                if (action === MotionEvent.ACTION_MOVE) {
                    dx = rawX - gesture.downRawX;
                    dy = rawY - gesture.downRawY;
                    if (!gesture.longPressed &&
                            Math.sqrt(dx * dx + dy * dy) > touchSlopPx) {
                        cancelLongPress();
                        if (!gesture.dragActive) {
                            gesture.dragActive = true;
                            setTokenSelected(gesture.startIndex,
                                gesture.targetSelected);
                        }
                        hit = tokenAtRawPoint(rawX, rawY);
                        if (hit >= 0) {
                            setTokenSelected(hit, gesture.targetSelected);
                        }
                    }
                    return true;
                }
                if (action === MotionEvent.ACTION_UP) {
                    cancelLongPress();
                    if (!gesture.longPressed && !gesture.dragActive) {
                        toggleToken(index);
                        emitAction("token_toggle", {
                            tokenIndex: Number(index),
                            selected: indexSelected(index)
                        });
                    } else if (gesture.dragActive) {
                        hit = tokenAtRawPoint(rawX, rawY);
                        if (hit >= 0) {
                            setTokenSelected(hit, gesture.targetSelected);
                        }
                        emitAction("token_drag_select", {
                            tokenIndex: Number(index)
                        });
                    }
                    resetGesture();
                    return true;
                }
                if (action === MotionEvent.ACTION_CANCEL) {
                    resetGesture();
                    return true;
                }
                return true;
            }
        });
    }

    function buildTokenView(token, index) {
        var colors = palette();
        var view = makeText(token.text, 11.5, colors.textPrimary, false);
        view.setGravity(Gravity.CENTER);
        view.setPadding(dp(10), 0, dp(10), 0);
        view.setMinWidth(dp(30));
        view.setClickable(true);
        view.setFocusable(true);
        view.setContentDescription("分词：" + token.text);
        view.setOnTouchListener(makeTokenTouchListener(index));
        applyBackground(view, colors.surfaceMuted, colors.stroke, 8);
        return view;
    }

    function clearFlowObserver() {
        try {
            if (flowObserver !== null && flowLayoutListener !== null &&
                    flowObserver.isAlive()) {
                flowObserver.removeOnGlobalLayoutListener(flowLayoutListener);
            }
        } catch (ignored) {}
        flowObserver = null;
        flowLayoutListener = null;
        reflowPosted = false;
        lastFlowWidth = 0;
    }

    function reflowTokens() {
        var width;
        var available;
        var row = null;
        var rowWidth = 0;
        var index;
        var view;
        var measured;
        var params;
        var rowParams;
        var gap = dp(7);
        var measureSpec = View.MeasureSpec.makeMeasureSpec(
            0, View.MeasureSpec.UNSPECIFIED);
        if (!state.mounted || tokenFlowRoot === null || tokenScroll === null) {
            return false;
        }
        width = Number(tokenScroll.getWidth());
        if (width <= 0 && editorPanelRoot !== null) {
            width = Number(editorPanelRoot.getWidth()) - dp(28);
        }
        available = Math.max(dp(120), width - dp(4));
        tokenFlowRoot.removeAllViews();
        tokenRows = [];
        if (tokenViews.length === 0) {
            view = makeText("暂无分词结果", 12,
                palette().textSecondary, false);
            view.setGravity(Gravity.CENTER);
            params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(120));
            tokenFlowRoot.addView(view, params);
            state.reflowCount += 1;
            return true;
        }
        for (index = 0; index < tokenViews.length; index += 1) {
            view = tokenViews[index];
            try {
                if (view.getParent() !== null) {
                    view.getParent().removeView(view);
                }
            } catch (ignoredParent) {}
            view.measure(measureSpec, measureSpec);
            measured = Math.max(dp(30), Number(view.getMeasuredWidth()));
            if (row === null || (rowWidth > 0 &&
                    rowWidth + gap + measured > available)) {
                row = new LinearLayout(appContext);
                row.setOrientation(LinearLayout.HORIZONTAL);
                row.setGravity(Gravity.START | Gravity.CENTER_VERTICAL);
                rowParams = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, dp(36));
                rowParams.bottomMargin = dp(7);
                tokenFlowRoot.addView(row, rowParams);
                tokenRows.push(row);
                rowWidth = 0;
            }
            params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, dp(34));
            if (rowWidth > 0) { params.leftMargin = gap; }
            row.addView(view, params);
            rowWidth += (rowWidth > 0 ? gap : 0) + measured;
        }
        state.reflowCount += 1;
        return true;
    }

    function scheduleReflow() {
        if (reflowPosted || mainHandler === null || !state.mounted) {
            return false;
        }
        reflowPosted = true;
        mainHandler.post(new Packages.java.lang.Runnable({
            run: function () {
                reflowPosted = false;
                try { reflowTokens(); }
                catch (error) { state.lastError = String(error); }
            }
        }));
        return true;
    }

    function installFlowObserver() {
        clearFlowObserver();
        if (tokenScroll === null) { return false; }
        try {
            flowObserver = tokenScroll.getViewTreeObserver();
            flowLayoutListener = new JavaAdapter(
                Packages.android.view.ViewTreeObserver.OnGlobalLayoutListener, {
                    onGlobalLayout: function () {
                        var width = tokenScroll === null ? 0 :
                            Number(tokenScroll.getWidth());
                        if (width > 0 && width !== lastFlowWidth) {
                            lastFlowWidth = width;
                            scheduleReflow();
                        }
                    }
                });
            flowObserver.addOnGlobalLayoutListener(flowLayoutListener);
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function renderTokenViews() {
        var index;
        tokenViews = [];
        for (index = 0; index < state.tokens.length; index += 1) {
            tokenViews.push(buildTokenView(state.tokens[index], index));
        }
        state.renderCount += 1;
        updateStatsViews();
        scheduleReflow();
        return true;
    }

    function buildStatsRow(parent) {
        var colors = palette();
        var row = new LinearLayout(appContext);
        var params;
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        statsLeftView = makeText("共 0 个词语", 10,
            colors.textSecondary, false);
        statsRightView = makeText("单词 0 / 符号 0", 10,
            colors.textTertiary, false);
        row.addView(statsLeftView,
            new LinearLayout.LayoutParams(0,
                LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        row.addView(statsRightView,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(30));
        parent.addView(row, params);
        updateStatsViews();
        return row;
    }

    function buildTokenScroll(parent) {
        var params;
        tokenScroll = new ScrollView(appContext);
        tokenScroll.setFillViewport(true);
        tokenScroll.setVerticalScrollBarEnabled(false);
        tokenFlowRoot = new LinearLayout(appContext);
        tokenFlowRoot.setOrientation(LinearLayout.VERTICAL);
        tokenFlowRoot.setPadding(dp(2), dp(4), dp(2), dp(8));
        tokenScroll.addView(tokenFlowRoot,
            new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.WRAP_CONTENT));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1);
        parent.addView(tokenScroll, params);
        installFlowObserver();
        renderTokenViews();
        return tokenScroll;
    }

    function buildNormalBody() {
        bodyContainer.removeAllViews();
        buildStatsRow(bodyContainer);
        buildTokenScroll(bodyContainer);
    }

    function buildRegexBody() {
        var colors = palette();
        var ruleHeader = new LinearLayout(appContext);
        var label = makeText("规则", 10.5, colors.textSecondary, true);
        var example = makeText("示例", 9.5, colors.textTertiary, false);
        var params;
        bodyContainer.removeAllViews();
        ruleHeader.setOrientation(LinearLayout.HORIZONTAL);
        ruleHeader.setGravity(Gravity.CENTER_VERTICAL);
        ruleHeader.addView(label,
            new LinearLayout.LayoutParams(0,
                LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        example.setGravity(Gravity.CENTER);
        example.setClickable(true);
        example.setFocusable(true);
        example.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { emitAction("regex_example", {}); }
        }));
        ruleHeader.addView(example,
            new LinearLayout.LayoutParams(dp(48), dp(28)));
        bodyContainer.addView(ruleHeader,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(30)));

        regexInput = new EditText(appContext);
        regexInput.setSingleLine(false);
        regexInput.setGravity(Gravity.TOP | Gravity.START);
        regexInput.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        regexInput.setHint("输入正则表达式");
        regexInput.setText(String(state.regexText || ""));
        regexInput.setPadding(dp(10), dp(8), dp(10), dp(8));
        regexInput.setInputType(InputType.TYPE_CLASS_TEXT |
            InputType.TYPE_TEXT_FLAG_MULTI_LINE |
            InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        safeTextColor(regexInput, colors.textPrimary);
        safeHintColor(regexInput, colors.textTertiary);
        applyBackground(regexInput, colors.surface, colors.stroke, 11);
        regexInput.addTextChangedListener(new JavaAdapter(TextWatcher, {
            beforeTextChanged: function () {},
            onTextChanged: function () {
                state.regexText = String(regexInput.getText());
            },
            afterTextChanged: function () {}
        }));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(76));
        params.bottomMargin = dp(5);
        bodyContainer.addView(regexInput, params);
        buildStatsRow(bodyContainer);
        buildTokenScroll(bodyContainer);
    }

    function applyModeStyles() {
        var colors = palette();
        var normal = state.mode === "normal";
        if (modeNormalView !== null) {
            applyBackground(modeNormalView,
                normal ? colors.accentStrong : colors.surfaceMuted,
                null, 8);
            safeTextColor(modeNormalView,
                normal ? selectedTextColor(colors) : colors.textSecondary);
        }
        if (modeRegexView !== null) {
            applyBackground(modeRegexView,
                normal ? colors.surfaceMuted : colors.accentStrong,
                null, 8);
            safeTextColor(modeRegexView,
                normal ? colors.textSecondary : selectedTextColor(colors));
        }
    }

    function renderMode() {
        clearFlowObserver();
        hidePopup();
        applyModeStyles();
        if (state.mode === "regex") {
            buildRegexBody();
        } else {
            buildNormalBody();
        }
        return true;
    }

    function switchMode(mode) {
        mode = String(mode || "normal") === "regex" ? "regex" : "normal";
        if (state.mode === mode) { return true; }
        if (regexInput !== null) {
            try { state.regexText = String(regexInput.getText()); }
            catch (ignored) {}
        }
        state.mode = mode;
        renderMode();
        emitAction(mode === "regex" ? "regex_mode" : "normal_mode", {});
        requestTokenizerRun("mode_" + mode);
        return true;
    }

    function makeToolbarCell(icon, label, action, danger) {
        var colors = palette();
        var cell = new LinearLayout(appContext);
        var iconView = makeText(icon, 14.5,
            danger ? colors.danger : colors.icon, false);
        var labelView = makeText(label, 12,
            danger ? colors.danger : colors.textPrimary, true);
        cell.setOrientation(LinearLayout.VERTICAL);
        cell.setGravity(Gravity.CENTER);
        cell.setPadding(dp(2), dp(2), dp(2), dp(2));
        cell.setClickable(true);
        cell.setFocusable(true);
        cell.setContentDescription(String(label));
        applyBackground(cell,
            danger ? colors.dangerSoft : colors.surfaceMuted,
            danger ? colors.danger : colors.stroke, 13);
        iconView.setGravity(Gravity.CENTER);
        labelView.setGravity(Gravity.CENTER);
        cell.addView(iconView,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(20)));
        cell.addView(labelView,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(17)));
        cell.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { emitAction(action, {}); }
        }));
        return cell;
    }

    function tokenizerChromeMetrics() {
        var widthDp = 390;
        var fontScale = 1;
        var filterState = null;
        try {
            if (ClipHub.Filter && typeof ClipHub.Filter.getState === "function") {
                filterState = ClipHub.Filter.getState();
                if (filterState && Number(filterState.panelWidthDp || 0) > 0) {
                    widthDp = Number(filterState.panelWidthDp);
                }
            }
        } catch (ignoredTokenizerFilterMetrics) {}
        try {
            fontScale = Number(appContext.getResources()
                .getConfiguration().fontScale || 1);
        } catch (ignoredTokenizerFontScale) { fontScale = 1; }
        return ClipHub.Theme.getPanelChromeMetrics(widthDp, fontScale, 1);
    }

    function buildDragHandle(column) {
        if (editorEmbeddedInPrimary) { return; }
        var colors = palette();
        var chrome = tokenizerChromeMetrics();
        var slot = new FrameLayout(appContext);
        var handle = new View(appContext);
        var params;
        applyBackground(handle, colors.accentBorder, null, 3);
        params = new FrameLayout.LayoutParams(
            dp(chrome.dragHandleWidthDp), dp(chrome.dragHandleHeightDp));
        params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
        params.topMargin = dp(chrome.dragHandleTopDp);
        slot.addView(handle, params);
        column.addView(slot, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(chrome.dragHandleSlotDp)));
    }

    function buildHeader(column) {
        var colors = palette();
        var chrome = tokenizerChromeMetrics();
        var header = new LinearLayout(appContext);
        var back = makeClickText("‹", chrome.iconSp, colors, "返回编辑页");
        var title = makeText("分词", chrome.titleSp, colors.textPrimary, true);
        var right = new LinearLayout(appContext);
        var rule = makeClickText("▣", chrome.iconSp, colors, "规则");
        var help = makeClickText("?", chrome.iconSp, colors, "帮助");
        var params;
        if (editorEmbeddedInPrimary) {
            back.setVisibility(View.GONE);
            title.setText("");
            title.setVisibility(View.INVISIBLE);
        }
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        back.setGravity(Gravity.CENTER);
        applyBackground(back, colors.surfaceMuted, null, chrome.actionSizeDp / 2);
        title.setGravity(Gravity.CENTER_VERTICAL);
        rule.setGravity(Gravity.CENTER);
        safeTextColor(rule, colors.accentStrong);
        applyBackground(rule, colors.accentSoft, colors.accentBorder,
            chrome.actionSizeDp / 2);
        help.setGravity(Gravity.CENTER);
        applyBackground(help, colors.surfaceMuted, null, chrome.actionSizeDp / 2);
        back.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { returnToEditor("header_back"); }
        }));
        rule.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { emitAction("rule", {}); }
        }));
        help.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { emitAction("help", {}); }
        }));
        header.addView(back,
            new LinearLayout.LayoutParams(dp(chrome.actionSizeDp),
                dp(chrome.actionSizeDp)));
        params = new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1);
        params.leftMargin = dp(chrome.gapDp);
        params.rightMargin = dp(chrome.gapDp);
        header.addView(title, params);
        right.setOrientation(LinearLayout.HORIZONTAL);
        right.setGravity(Gravity.CENTER_VERTICAL);
        right.addView(rule,
            new LinearLayout.LayoutParams(dp(chrome.actionSizeDp),
                dp(chrome.actionSizeDp)));
        params = new LinearLayout.LayoutParams(dp(chrome.actionSizeDp),
            dp(chrome.actionSizeDp));
        params.leftMargin = dp(chrome.gapDp);
        right.addView(help, params);
        header.addView(right,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, dp(chrome.actionSizeDp)));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(chrome.headerHeightDp));
        params.bottomMargin = dp(chrome.headerBottomGapDp);
        column.addView(header, params);
    }

    function buildSegment(column) {
        var colors = palette();
        var shell = new LinearLayout(appContext);
        var params;
        shell.setOrientation(LinearLayout.HORIZONTAL);
        shell.setPadding(dp(2), dp(2), dp(2), dp(2));
        applyBackground(shell, colors.surfaceMuted, colors.stroke, 10);
        modeNormalView = makeText("普通分词", 10.5,
            colors.textSecondary, true);
        modeRegexView = makeText("正则规则", 10.5,
            colors.textSecondary, true);
        modeNormalView.setGravity(Gravity.CENTER);
        modeRegexView.setGravity(Gravity.CENTER);
        modeNormalView.setClickable(true);
        modeNormalView.setFocusable(true);
        modeRegexView.setClickable(true);
        modeRegexView.setFocusable(true);
        modeNormalView.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { switchMode("normal"); }
        }));
        modeRegexView.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { switchMode("regex"); }
        }));
        shell.addView(modeNormalView,
            new LinearLayout.LayoutParams(0, dp(32), 1));
        shell.addView(modeRegexView,
            new LinearLayout.LayoutParams(0, dp(32), 1));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(36));
        params.leftMargin = dp(2);
        params.rightMargin = dp(2);
        params.bottomMargin = dp(8);
        column.addView(shell, params);
        applyModeStyles();
    }

    function buildDivider(column) {
        var colors = palette();
        var line = new View(appContext);
        ClipHub.Theme.applyBackgroundColor(line, colors.divider);
        column.addView(line,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(1)));
    }

    function buildIndicator(column) {
        var colors = palette();
        var row = new LinearLayout(appContext);
        var line = new View(appContext);
        var spacer = new View(appContext);
        row.setOrientation(LinearLayout.HORIZONTAL);
        ClipHub.Theme.applyBackgroundColor(line, colors.accentStrong);
        row.addView(line, new LinearLayout.LayoutParams(0, dp(2), 3));
        row.addView(spacer, new LinearLayout.LayoutParams(0, dp(2), 2));
        column.addView(row,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(3)));
    }

    function buildToolbar(column) {
        var colors = palette();
        var toolbar = new LinearLayout(appContext);
        var params;
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(0, dp(3), 0, dp(3));
        ClipHub.Theme.applyBackgroundColor(toolbar, colors.surface);
        params = new LinearLayout.LayoutParams(0, dp(42), 1);
        params.rightMargin = dp(6);
        toolbar.addView(makeToolbarCell("▣", "复制", "copy", false), params);
        params = new LinearLayout.LayoutParams(0, dp(42), 1);
        params.rightMargin = dp(6);
        toolbar.addView(makeToolbarCell("↵", "输入", "input", false), params);
        params = new LinearLayout.LayoutParams(0, dp(42), 1);
        params.rightMargin = dp(6);
        toolbar.addView(makeToolbarCell("✎", "编辑", "edit", false), params);
        params = new LinearLayout.LayoutParams(0, dp(42), 1);
        params.rightMargin = dp(6);
        toolbar.addView(makeToolbarCell("⇩", "导出", "export", false), params);
        toolbar.addView(makeToolbarCell("⌫", "清空", "clear", true),
            new LinearLayout.LayoutParams(0, dp(42), 1));
        column.addView(toolbar,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(48)));
    }

    function buildHint(column) {
        var colors = palette();
        var hint = makeText("◇  长按词块可进行更多操作  ›", 9,
            colors.textTertiary, false);
        hint.setGravity(Gravity.CENTER);
        column.addView(hint,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(27)));
    }

    function resetContentState() {
        state.mode = "normal";
        state.regexText = "";
        state.tokens = [];
        state.selectedIndexes = [];
        state.tokenCount = 0;
        state.wordCount = 0;
        state.symbolCount = 0;
        state.popupVisible = false;
        state.popupTokenIndex = -1;
        state.serviceStatus = "idle";
        state.serviceError = null;
        tokenViews = [];
        tokenRows = [];
        resetGesture();
    }

    function clearPageRefs() {
        clearFlowObserver();
        hidePopup();
        resetGesture();
        pageRoot = null;
        pageColumn = null;
        modeNormalView = null;
        modeRegexView = null;
        bodyContainer = null;
        statsLeftView = null;
        statsRightView = null;
        tokenScroll = null;
        tokenFlowRoot = null;
        regexInput = null;
        tokenViews = [];
        tokenRows = [];
    }

    function buildPage() {
        var colors = palette();
        var chrome = tokenizerChromeMetrics();
        var bodyParams;
        var horizontalPadding = editorEmbeddedInPrimary ? 0 : chrome.screenPaddingDp;
        var topPadding = editorEmbeddedInPrimary ? 0 : chrome.pagePaddingTopDp;
        var bottomPadding = editorEmbeddedInPrimary ? 0 : chrome.pagePaddingBottomDp;
        pageRoot = new FrameLayout(appContext);
        pageColumn = new LinearLayout(appContext);
        pageColumn.setOrientation(LinearLayout.VERTICAL);
        /* tokenizer_chrome_unified_v1 */
        pageColumn.setPadding(dp(horizontalPadding), dp(topPadding),
            dp(horizontalPadding), dp(bottomPadding));
        ClipHub.Theme.applyBackgroundColor(pageRoot, colors.surface);
        buildDragHandle(pageColumn);
        buildHeader(pageColumn);
        buildSegment(pageColumn);
        buildDivider(pageColumn);
        bodyContainer = new LinearLayout(appContext);
        bodyContainer.setOrientation(LinearLayout.VERTICAL);
        bodyContainer.setPadding(0, dp(3), 0, 0);
        bodyParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1);
        pageColumn.addView(bodyContainer, bodyParams);
        buildIndicator(pageColumn);
        buildDivider(pageColumn);
        buildToolbar(pageColumn);
        buildHint(pageColumn);
        pageRoot.addView(pageColumn,
            new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT));
        renderMode();
        return pageRoot;
    }

    function findTextByPrefix(root, prefix) {
        var text;
        var group;
        var index;
        var found;
        if (root === null || root === undefined) { return null; }
        if (root instanceof TextView) {
            try {
                text = String(root.getText());
                if (text.indexOf(String(prefix)) === 0) { return root; }
            } catch (ignoredText) {}
        }
        if (root instanceof ViewGroup) {
            group = root;
            for (index = 0; index < group.getChildCount(); index += 1) {
                found = findTextByPrefix(group.getChildAt(index), prefix);
                if (found !== null) { return found; }
            }
        }
        return null;
    }

    function findEditorInput(root) {
        var group;
        var index;
        var child;
        var hint;
        var found;
        if (root === null || root === undefined) { return null; }
        if (root instanceof EditText) {
            try {
                hint = root.getHint();
                if (hint !== null && String(hint).indexOf("剪贴板内容") >= 0) {
                    return root;
                }
            } catch (ignoredHint) {}
        }
        if (root instanceof ViewGroup) {
            group = root;
            for (index = 0; index < group.getChildCount(); index += 1) {
                child = group.getChildAt(index);
                found = findEditorInput(child);
                if (found !== null) { return found; }
            }
        }
        return null;
    }

    function makeEditorEntry() {
        var colors = palette();
        var view = makeText("分词", 10, colors.accentStrong, true);
        view.setGravity(Gravity.CENTER);
        view.setClickable(true);
        view.setFocusable(true);
        view.setContentDescription("打开分词页面");
        applyBackground(view, colors.accentSoft, colors.accentBorder, 10);
        view.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { mountFromEditor(); }
        }));
        return view;
    }

    function installEditorEntry() {
        var source;
        var tags;
        var parent;
        var sourceParams;
        var tagParams;
        var params;
        if (!ready || state.mounted || editorPanelRoot === null ||
                entryInstallGuard) {
            return false;
        }
        entryInstallGuard = true;
        try {
            source = findTextByPrefix(editorPanelRoot, "来源  ");
            tags = findTextByPrefix(editorPanelRoot, "标签  ");
            if (source === null || tags === null ||
                    source.getParent() === null ||
                    source.getParent() !== tags.getParent() ||
                    !(source.getParent() instanceof LinearLayout)) {
                return false;
            }
            parent = source.getParent();
            if (editorEntryView !== null &&
                    editorEntryView.getParent() === parent) {
                return true;
            }
            if (editorEntryView !== null) {
                try {
                    if (editorEntryView.getParent() !== null) {
                        editorEntryView.getParent().removeView(editorEntryView);
                    }
                } catch (ignoredOld) {}
            }
            sourceParams = source.getLayoutParams();
            sourceParams.width = 0;
            sourceParams.height = dp(32);
            sourceParams.weight = 1;
            sourceParams.rightMargin = dp(6);
            source.setLayoutParams(sourceParams);
            tagParams = tags.getLayoutParams();
            tagParams.width = dp(92);
            tagParams.height = dp(32);
            tagParams.weight = 0;
            tagParams.rightMargin = dp(6);
            tags.setLayoutParams(tagParams);
            editorEntryView = makeEditorEntry();
            params = new LinearLayout.LayoutParams(dp(76), dp(32));
            parent.addView(editorEntryView, params);
            state.entryInstallCount += 1;
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        } finally {
            entryInstallGuard = false;
        }
    }

    function scheduleEnsureEntry() {
        if (ensureEntryPosted || mainHandler === null || !ready) { return false; }
        ensureEntryPosted = true;
        return mainHandler.post(new Packages.java.lang.Runnable({
            run: function () {
                ensureEntryPosted = false;
                installEditorEntry();
            }
        }));
    }

    function removeEditorObserver() {
        try {
            if (editorObserver !== null && editorLayoutListener !== null &&
                    editorObserver.isAlive()) {
                editorObserver.removeOnGlobalLayoutListener(editorLayoutListener);
            }
        } catch (ignored) {}
        editorObserver = null;
        editorLayoutListener = null;
        ensureEntryPosted = false;
    }

    function installEditorObserver() {
        removeEditorObserver();
        if (editorPanelRoot === null) { return false; }
        try {
            editorObserver = editorPanelRoot.getViewTreeObserver();
            editorLayoutListener = new JavaAdapter(
                Packages.android.view.ViewTreeObserver.OnGlobalLayoutListener, {
                    onGlobalLayout: function () {
                        if (!state.mounted) { scheduleEnsureEntry(); }
                    }
                });
            editorObserver.addOnGlobalLayoutListener(editorLayoutListener);
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function captureEditorChildren() {
        var input = findEditorInput(editorPanelRoot);
        var index;
        var child;
        var params;
        savedEditorChildren = [];
        savedEditorPadding = {
            left: Number(editorPanelRoot.getPaddingLeft()),
            top: Number(editorPanelRoot.getPaddingTop()),
            right: Number(editorPanelRoot.getPaddingRight()),
            bottom: Number(editorPanelRoot.getPaddingBottom())
        };
        if (input === null) { return false; }
        try { state.sourceText = String(input.getText()); }
        catch (ignoredText) { state.sourceText = ""; }
        for (index = 0; index < editorPanelRoot.getChildCount(); index += 1) {
            child = editorPanelRoot.getChildAt(index);
            params = child.getLayoutParams();
            savedEditorChildren.push({ view: child, params: params });
        }
        editorPanelRoot.removeAllViews();
        editorPanelRoot.setPadding(0, 0, 0, 0);
        return true;
    }

    function restoreEditorChildren() {
        var index;
        var item;
        if (editorPanelRoot === null) { return false; }
        editorPanelRoot.removeAllViews();
        if (savedEditorPadding !== null) {
            editorPanelRoot.setPadding(
                Number(savedEditorPadding.left),
                Number(savedEditorPadding.top),
                Number(savedEditorPadding.right),
                Number(savedEditorPadding.bottom));
        }
        for (index = 0; index < savedEditorChildren.length; index += 1) {
            item = savedEditorChildren[index];
            try {
                editorPanelRoot.addView(item.view, item.params);
            } catch (error) {
                state.lastError = String(error);
                return false;
            }
        }
        savedEditorChildren = [];
        savedEditorPadding = null;
        return true;
    }

    function mountFromEditor() {
        var success;
        if (!ready || state.mounted || editorPanelRoot === null) {
            return false;
        }
        try {
            if (ClipHub.Editor && typeof ClipHub.Editor.hideKeyboard === "function") {
                try { ClipHub.Editor.hideKeyboard(); } catch (ignoredKeyboard) {}
            }
            resetContentState();
            success = captureEditorChildren();
            if (!success) { return false; }
            state.mounted = true;
            editorPanelRoot.addView(buildPage(),
                new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));
            state.mountCount += 1;
            if (editorEmbeddedInPrimary) {
                syncTokenizerShell("tokenizer", "分词", function () {
                    return returnToEditor("shell_back");
                });
            }
            emitAction("open", {});
            requestTokenizerRun("open");
            return true;
        } catch (error) {
            state.lastError = String(error);
            state.mounted = false;
            try { restoreEditorChildren(); } catch (ignoredRestore) {}
            clearPageRefs();
            return false;
        }
    }

    function returnToEditor(reason) {
        var restored;
        if (!state.mounted) { return false; }
        hidePopup();
        cancelTokenizerRun(reason || "back");
        clearFlowObserver();
        state.mounted = false;
        restored = restoreEditorChildren();
        clearPageRefs();
        state.unmountCount += 1;
        if (editorEmbeddedInPrimary) {
            var editorState = ClipHub.Editor &&
                typeof ClipHub.Editor.getState === "function" ?
                ClipHub.Editor.getState() : {};
            syncTokenizerShell("editor",
                String(editorState.mode) === "new" ?
                    "新增剪贴板" : "编辑剪贴板",
                function () {
                    return ClipHub.Editor &&
                        typeof ClipHub.Editor.requestExit === "function" ?
                        ClipHub.Editor.requestExit("shell_back") : false;
                });
        }
        emitAction("back", { reason: String(reason || "back") });
        scheduleEnsureEntry();
        try {
            if (ClipHub.Editor &&
                    typeof ClipHub.Editor.refreshLayoutMetrics === "function") {
                ClipHub.Editor.refreshLayoutMetrics();
            }
        } catch (ignoredMetrics) {}
        return restored;
    }

    function discardMountedPage() {
        if (!state.mounted) { return false; }
        state.mounted = false;
        savedEditorChildren = [];
        savedEditorPadding = null;
        clearPageRefs();
        return true;
    }

    function clearEditorBinding(discard) {
        if (discard === true) {
            discardMountedPage();
        } else if (state.mounted) {
            returnToEditor("binding_clear");
        }
        removeEditorObserver();
        editorPanelRoot = null;
        editorWindowRoot = null;
        editorEmbeddedInPrimary = false;
        editorEntryView = null;
        savedEditorChildren = [];
        savedEditorPadding = null;
        return true;
    }


    function bindEditorRoot(contentView, rootView, embedded) {
        if (!contentView) { return false; }
        if (editorPanelRoot !== null && editorPanelRoot !== contentView) {
            clearEditorBinding(true);
        }
        editorPanelRoot = contentView;
        editorWindowRoot = rootView || contentView;
        editorEmbeddedInPrimary = embedded === true;
        installEditorObserver();
        scheduleEnsureEntry();
        return true;
    }

    function syncTokenizerShell(pageId, title, onBack) {
        var id = String(pageId || "editor");
        var path = id === "editor" ? ["editor"] : ["editor", id];
        if (!editorEmbeddedInPrimary || !ClipHub.UIShell ||
                typeof ClipHub.UIShell.syncEmbeddedPage !== "function" ||
                editorWindowRoot === null) {
            return false;
        }
        return ClipHub.UIShell.syncEmbeddedPage({
            pageId: id,
            path: path,
            title: String(title || (id === "tokenizer" ? "分词" : "编辑剪贴板")),
            showBack: true,
            view: editorWindowRoot,
            onBack: typeof onBack === "function" ? onBack : function () {
                return ClipHub.Editor &&
                    typeof ClipHub.Editor.requestExit === "function" ?
                    ClipHub.Editor.requestExit("shell_back") : false;
            },
            onClose: function () {
                return ClipHub.Editor &&
                    typeof ClipHub.Editor.requestExit === "function" ?
                    ClipHub.Editor.requestExit("shell_close") : false;
            }
        }) === true;
    }

    function installWindowHooks() {
        if (windowHooksInstalled || !ClipHub.Window ||
                typeof ClipHub.Window.attachWindow !== "function") {
            return false;
        }
        originalWindowAttach = ClipHub.Window.attachWindow;
        originalWindowDetach = ClipHub.Window.detachWindow;
        ClipHub.Window.attachWindow = function (options) {
            var role;
            var originalBack;
            var originalOutside;
            var result;
            options = options || {};
            role = String(options.role || "shared");
            if (role === "editor") {
                editorPanelRoot = options.contentView || null;
                editorWindowRoot = options.rootView || null;
                installEditorObserver();
                originalBack = options.onRequestBack;
                originalOutside = options.onRequestOutsideDismiss;
                options.onRequestBack = function (reason) {
                    if (state.mounted) {
                        return returnToEditor(String(reason || "system_back"));
                    }
                    return typeof originalBack === "function" ?
                        originalBack(reason) : false;
                };
                options.onRequestOutsideDismiss = function (reason) {
                    if (state.mounted) {
                        return returnToEditor(String(reason || "outside_tap"));
                    }
                    return typeof originalOutside === "function" ?
                        originalOutside(reason) : false;
                };
            }
            result = originalWindowAttach.call(ClipHub.Window, options);
            if (role === "editor") { scheduleEnsureEntry(); }
            return result;
        };
        if (typeof originalWindowDetach === "function") {
            ClipHub.Window.detachWindow = function (rootView, options) {
                var matches = editorWindowRoot !== null &&
                    rootView === editorWindowRoot;
                var result;
                if (matches) { clearEditorBinding(true); }
                result = originalWindowDetach.call(
                    ClipHub.Window, rootView, options || {});
                return result;
            };
        }
        windowHooksInstalled = true;
        return true;
    }

    function restoreWindowHooks() {
        if (!windowHooksInstalled) { return true; }
        if (ClipHub.Window) {
            if (originalWindowAttach !== null) {
                ClipHub.Window.attachWindow = originalWindowAttach;
            }
            if (originalWindowDetach !== null) {
                ClipHub.Window.detachWindow = originalWindowDetach;
            }
        }
        originalWindowAttach = null;
        originalWindowDetach = null;
        windowHooksInstalled = false;
        return true;
    }

    function init(context) {
        if (ready) { return true; }
        appContext = context && context.androidContext ?
            context.androidContext : global.context;
        if (appContext === null || appContext === undefined) {
            throw new Error("Android context unavailable for TokenizerUI");
        }
        try {
            appContext = appContext.getApplicationContext() || appContext;
        } catch (ignoredContext) {}
        if (!ClipHub.Theme ||
                typeof ClipHub.Theme.getPalette !== "function" ||
                typeof ClipHub.Theme.applyTextColor !== "function" ||
                typeof ClipHub.Theme.applyHintTextColor !== "function" ||
                typeof ClipHub.Theme.applyGradientColor !== "function" ||
                typeof ClipHub.Theme.applyGradientStroke !== "function" ||
                typeof ClipHub.Theme.applyBackgroundColor !== "function") {
            throw new Error("ClipHub Theme safe color APIs unavailable");
        }
        mainHandler = new Handler(Looper.getMainLooper());
        density = Number(appContext.getResources()
            .getDisplayMetrics().density || 1);
        touchSlopPx = Number(ViewConfiguration.get(appContext)
            .getScaledTouchSlop());
        longPressTimeoutMs = Number(ViewConfiguration.getLongPressTimeout());
        ready = true;
        state.ready = true;
        state.lastError = null;
        installWindowHooks();
        return true;
    }

    function shutdown() {
        if (!ready) { return true; }
        if (state.mounted) {
            try { returnToEditor("shutdown"); } catch (ignoredReturn) {}
        }
        cancelTokenizerRun("shutdown");
        clearEditorBinding(true);
        restoreWindowHooks();
        ready = false;
        state.ready = false;
        state.mounted = false;
        appContext = null;
        mainHandler = null;
        return true;
    }

    function setTokens(tokens, stats) {
        state.tokens = normalizeTokens(tokens);
        state.selectedIndexes = [];
        recalculateStats(stats || null);
        if (state.mounted && tokenFlowRoot !== null) {
            renderTokenViews();
        }
        return state.tokens.length;
    }

    function setServiceStatus(status, error) {
        state.serviceStatus = String(status || "idle");
        state.serviceError = error === undefined ? null : error;
        if (state.serviceStatus === "failed") {
            state.lastError = String(error || "TokenizerService failed");
        }
        updateStatsViews();
        return state.serviceStatus;
    }

    function requestTokenizerRun(reason) {
        if (!ClipHub.TokenizerService ||
                typeof ClipHub.TokenizerService.tokenizeAsync !== "function") {
            setServiceStatus("failed", "TokenizerService unavailable");
            return false;
        }
        setServiceStatus("loading", null);
        return ClipHub.TokenizerService.tokenizeAsync(
            String(state.sourceText || ""),
            {
                mode: String(state.mode || "normal"),
                regexText: String(state.regexText || ""),
                reason: String(reason || "tokenizer_ui")
            },
            function (result) {
                if (result && result.ok === true) {
                    setServiceStatus("ready", null);
                    setTokens(result.tokens || [], result.stats || null);
                } else {
                    setServiceStatus("failed", result && result.message ?
                        result.message : "TokenizerService failed");
                }
            }
        );
    }

    function cancelTokenizerRun(reason) {
        if (ClipHub.TokenizerService &&
                typeof ClipHub.TokenizerService.cancel === "function") {
            try { ClipHub.TokenizerService.cancel(reason || "tokenizer_ui_close"); }
            catch (ignoredCancel) {}
        }
        return true;
    }

    function performTokenClick(index) {
        return toggleToken(Number(index));
    }

    function performTokenLongClick(index) {
        index = Number(index);
        if (index < 0 || index >= state.tokens.length) { return false; }
        if (!indexSelected(index)) { setTokenSelected(index, true); }
        showPopup(index);
        emitAction("token_long_press", { tokenIndex: index });
        return true;
    }

    function performToolbarClick(action) {
        var allowed = {
            copy: true, input: true, edit: true,
            export: true, clear: true
        };
        action = String(action || "");
        if (!allowed[action]) { return false; }
        emitAction(action, {});
        return true;
    }

    function performPopupActionClick(action) {
        var allowed = {
            copy: true, input: true, search: true,
            edit: true, delete: true
        };
        action = String(action || "");
        if (!allowed[action]) { return false; }
        emitAction(action, { tokenIndex: Number(state.popupTokenIndex) });
        hidePopup();
        return true;
    }

    function getState() {
        return {
            ready: ready,
            mounted: state.mounted === true,
            embeddedInPrimary: editorEmbeddedInPrimary === true,
            mode: String(state.mode),
            sourceTextLength: String(state.sourceText || "").length,
            regexText: String(state.regexText || ""),
            tokenCount: Number(state.tokenCount),
            wordCount: Number(state.wordCount),
            symbolCount: Number(state.symbolCount),
            selectedIndexes: copyArray(state.selectedIndexes),
            selectedCount: selectedCount(),
            popupVisible: state.popupVisible === true,
            popupTokenIndex: Number(state.popupTokenIndex),
            editorRootCaptured: editorPanelRoot !== null,
            entryPresent: editorEntryView !== null &&
                editorEntryView.getParent() !== null,
            entryInstallCount: Number(state.entryInstallCount),
            mountCount: Number(state.mountCount),
            unmountCount: Number(state.unmountCount),
            renderCount: Number(state.renderCount),
            reflowCount: Number(state.reflowCount),
            actionCount: Number(state.actionCount),
            lastAction: String(state.lastAction || ""),
            lastError: state.lastError,
            tokenizerServiceStatus: String(state.serviceStatus || "idle"),
            tokenizerServiceError: state.serviceError
        };
    }

    ClipHub.TokenizerUI = {
        MODULE_NAME: "ch_17_tokenizer_ui",
        MODULE_VERSION: 7,
        init: init,
        shutdown: shutdown,
        mount: mountFromEditor,
        unmount: function () { return returnToEditor("api_unmount"); },
        bindEditorRoot: function (contentView, rootView, embedded) {
            return runOnMainSync(function () {
                return bindEditorRoot(contentView, rootView, embedded === true);
            }, 2500);
        },
        unbindEditorRoot: function (discardMounted) {
            return runOnMainSync(function () {
                clearEditorBinding(discardMounted === true);
                return true;
            }, 2500);
        },
        isMounted: function () { return state.mounted === true; },
        setMode: switchMode,
        setPreviewTokens: function (tokens, stats) {
            return setTokens(tokens, stats || null);
        },
        setTokens: setTokens,
        setRegexText: function (text) {
            state.regexText = String(text === null || text === undefined ?
                "" : text);
            if (regexInput !== null) {
                regexInput.setText(state.regexText);
                regexInput.setSelection(regexInput.getText().length());
            }
            return state.regexText;
        },
        getState: getState,
        performBackClick: function () {
            return returnToEditor("api_back");
        },
        performNormalModeClick: function () {
            return switchMode("normal");
        },
        performRegexModeClick: function () {
            return switchMode("regex");
        },
        performTokenClick: performTokenClick,
        performTokenLongClick: performTokenLongClick,
        performToolbarClick: performToolbarClick,
        performPopupActionClick: performPopupActionClick,
        ensureEditorEntry: installEditorEntry
    };

    function installAppHooks() {
        if (appHooksInstalled || !ClipHub.App ||
                typeof ClipHub.App.start !== "function" ||
                typeof ClipHub.App.stop !== "function") {
            return false;
        }
        originalAppStart = ClipHub.App.start;
        originalAppStop = ClipHub.App.stop;
        originalAppGetStatus = ClipHub.App.getStatus;
        ClipHub.App.start = function (context) {
            var result = originalAppStart.call(ClipHub.App, context);
            try {
                init(context);
                if (result) { result.tokenizerUiReady = true; }
                return result;
            } catch (error) {
                try { originalAppStop.call(ClipHub.App, "tokenizer_init_failed"); }
                catch (ignoredStop) {}
                throw error;
            }
        };
        ClipHub.App.stop = function (reason) {
            try { shutdown(); } catch (ignoredShutdown) {}
            return originalAppStop.call(ClipHub.App, reason);
        };
        if (typeof originalAppGetStatus === "function") {
            ClipHub.App.getStatus = function () {
                var status = originalAppGetStatus.call(ClipHub.App) || {};
                status.tokenizerUiReady = ready === true;
                status.tokenizerAttached = state.mounted === true;
                status.tokenizerState = getState();
                return status;
            };
        }
        appHooksInstalled = true;
        return true;
    }

    installAppHooks();
}((function () { return this; }())));
