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
    var TextView = Packages.android.widget.TextView;
    var EditText = Packages.android.widget.EditText;
    var TypedValue = Packages.android.util.TypedValue;
    var InputType = Packages.android.text.InputType;
    var InputMethodManager = Packages.android.view.inputmethod.InputMethodManager;
    var DisplayMetrics = Packages.android.util.DisplayMetrics;

    var androidContext = null;
    var appContext = null;
    var windowManager = null;
    var inputMethodManager = null;
    var mainHandler = null;
    var density = 1;
    var panelRoot = null;
    var panelParams = null;
    var contentInput = null;
    var saveView = null;
    var cancelView = null;
    var ready = false;
    var state = {
        open: false,
        attached: false,
        mode: "new",
        itemId: null,
        inputFocused: false,
        keyboardRequestCount: 0,
        openCount: 0,
        closeCount: 0,
        saveCount: 0,
        createCount: 0,
        updateCount: 0,
        cancelCount: 0,
        lastSavedId: null,
        lastSaveAction: null,
        windowType: null,
        windowFlags: null,
        addThreadId: null,
        addThreadName: null,
        removeThreadId: null,
        removeThreadName: null,
        saveThreadId: null,
        saveThreadName: null,
        lastError: null
    };

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
        if (mainLooper !== null && currentLooper !== null && currentLooper === mainLooper) {
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
            return { ok: false, error: new Error("Editor main handler post failed") };
        }
        completed = latch.await(Number(timeoutMs || 2500), TimeUnit.MILLISECONDS);
        if (!completed) {
            try { mainHandler.removeCallbacks(runnable); } catch (ignored) {}
            return { ok: false, error: new Error("Editor main handler timeout") };
        }
        return box;
    }

    function requireMain(result) {
        if (!result || result.ok !== true) {
            throw result && result.error ? result.error :
                new Error("Editor main-thread operation failed");
        }
        return result.value;
    }

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

    function makeButton(text, dark, primary) {
        var view = makeText(text, 13,
            primary ? (dark ? "#FFE6F2FF" : "#FF174A78") :
                (dark ? "#FFE4E4E7" : "#FF3F3F46"), true);
        view.setGravity(Gravity.CENTER);
        view.setPadding(dp(14), dp(8), dp(14), dp(8));
        view.setBackground(roundedBackground(
            primary ? (dark ? "#FF344D66" : "#FFE3EEF8") :
                (dark ? "#22FFFFFF" : "#10000000"),
            primary ? (dark ? "#667DB4E8" : "#55719BC6") :
                (dark ? "#25FFFFFF" : "#16000000"), 10));
        view.setClickable(true);
        view.setFocusable(true);
        return view;
    }

    function emitMutation(name, id, mutation, extra) {
        var thread = nowThread();
        var payload = {
            id: Number(id),
            manual: true,
            mutation: String(mutation),
            threadId: thread.id,
            threadName: thread.name
        };
        var key;
        extra = extra || {};
        for (key in extra) {
            if (extra.hasOwnProperty(key)) { payload[key] = extra[key]; }
        }
        try {
            if (ClipHub.EventBus && typeof ClipHub.EventBus.emit === "function") {
                return ClipHub.EventBus.emit(String(name), payload);
            }
        } catch (ignored) {}
        return 0;
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
        width = Math.min(dp(400), Math.max(dp(270),
            Number(metrics.widthPixels) - dp(24)));
        height = Math.min(dp(520), Math.max(dp(330),
            Number(metrics.heightPixels) - dp(96)));
        return { width: width, height: height };
    }

    function requestKeyboardOnMain() {
        if (contentInput === null) { return false; }
        contentInput.requestFocus();
        state.inputFocused = contentInput.hasFocus();
        state.keyboardRequestCount += 1;
        mainHandler.postDelayed(new Packages.java.lang.Runnable({
            run: function () {
                try {
                    if (contentInput !== null && inputMethodManager !== null) {
                        inputMethodManager.showSoftInput(
                            contentInput, InputMethodManager.SHOW_IMPLICIT);
                        state.inputFocused = contentInput.hasFocus();
                    }
                } catch (ignored) {}
            }
        }), 120);
        return state.inputFocused;
    }

    function hideKeyboardOnMain() {
        try {
            if (contentInput !== null && inputMethodManager !== null) {
                inputMethodManager.hideSoftInputFromWindow(
                    contentInput.getWindowToken(), 0);
            }
        } catch (ignored) {}
    }

    function closePanel(reason) {
        if (!state.attached && panelRoot === null) {
            state.open = false;
            state.itemId = null;
            return { ok: true, attached: false, alreadyClosed: true,
                state: getState() };
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
                state.closeCount += 1;
                if (String(reason || "") === "cancel") {
                    state.cancelCount += 1;
                }
                state.removeThreadId = thread.id;
                state.removeThreadName = thread.name;
                state.lastError = null;
                return true;
            } finally {
                state.open = false;
                state.attached = false;
                state.inputFocused = false;
                state.itemId = null;
                panelRoot = null;
                panelParams = null;
                contentInput = null;
                saveView = null;
                cancelView = null;
            }
        }, 3000));
        return { ok: true, attached: false, alreadyClosed: false,
            state: getState() };
    }

    function saveFromInput() {
        var thread = nowThread();
        var content;
        var id;
        var changed;
        var delivered;
        if (contentInput === null) { return false; }
        try {
            content = String(contentInput.getText());
            if (content.replace(/^\s+|\s+$/g, "").length === 0) {
                throw new Error("内容不能为空");
            }
            if (content.length > 200000) {
                throw new Error("内容长度不能超过 200000 字符");
            }
            if (state.mode === "new") {
                id = Number(ClipHub.Repository.insertItem({
                    content: content,
                    contentType: "text",
                    sourcePackage: null,
                    sourceLabel: "ClipHub 手动",
                    sourceUid: Number(Packages.android.os.Process.myUid()),
                    sourceConfidence: 100,
                    isSensitive: false,
                    isPinned: false
                }));
                state.createCount += 1;
                state.lastSaveAction = "created";
                delivered = emitMutation("clipboard_added", id, "created", {});
            } else {
                id = Number(state.itemId);
                changed = ClipHub.Repository.updateItem(id, { content: content });
                if (Number(changed) < 1) {
                    throw new Error("编辑目标不存在或未更新");
                }
                state.updateCount += 1;
                state.lastSaveAction = "updated";
                delivered = emitMutation("clipboard_merged", id, "updated", {});
            }
            state.saveCount += 1;
            state.lastSavedId = id;
            state.saveThreadId = thread.id;
            state.saveThreadName = thread.name;
            state.lastError = null;
            if (delivered < 1 && ClipHub.List &&
                    typeof ClipHub.List.refresh === "function") {
                ClipHub.List.refresh();
            }
            closePanel("save");
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function buildPanelContent(initialText) {
        var dark = isDarkMode();
        var primary = dark ? "#FFF4F4F5" : "#FF171717";
        var secondary = dark ? "#FFB4B4BC" : "#FF66666F";
        var titleRow = new LinearLayout(appContext);
        var title;
        var subtitle;
        var scroll;
        var footer;
        var params;

        panelRoot.removeAllViews();
        titleRow.setOrientation(LinearLayout.HORIZONTAL);
        titleRow.setGravity(Gravity.CENTER_VERTICAL);
        title = makeText(state.mode === "new" ? "新增记录" : "编辑记录",
            16, primary, true);
        titleRow.addView(title, new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        cancelView = makeButton("取消", dark, false);
        cancelView.setContentDescription("取消编辑");
        cancelView.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { closePanel("cancel"); }
        }));
        titleRow.addView(cancelView, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(8);
        panelRoot.addView(titleRow, params);

        subtitle = makeText(state.mode === "new" ?
            "手动添加文本记录" : "仅修改正文，来源和类型保持不变",
            12, secondary, false);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(10);
        panelRoot.addView(subtitle, params);

        scroll = new ScrollView(appContext);
        scroll.setFillViewport(true);
        contentInput = new EditText(appContext);
        contentInput.setText(String(initialText || ""));
        contentInput.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        contentInput.setTextColor(Color.parseColor(primary));
        contentInput.setHintTextColor(Color.parseColor(secondary));
        contentInput.setHint("输入剪贴板内容");
        contentInput.setGravity(Gravity.TOP | Gravity.START);
        contentInput.setInputType(InputType.TYPE_CLASS_TEXT |
            InputType.TYPE_TEXT_FLAG_MULTI_LINE |
            InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        contentInput.setSingleLine(false);
        contentInput.setMinLines(8);
        contentInput.setPadding(dp(12), dp(10), dp(12), dp(10));
        contentInput.setBackground(roundedBackground(
            dark ? "#FF202328" : "#FFF7F7F8",
            dark ? "#35FFFFFF" : "#1D000000", 11));
        scroll.addView(contentInput, new Packages.android.widget.FrameLayout.LayoutParams(
            Packages.android.widget.FrameLayout.LayoutParams.MATCH_PARENT,
            Packages.android.widget.FrameLayout.LayoutParams.WRAP_CONTENT));
        panelRoot.addView(scroll, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));

        footer = new LinearLayout(appContext);
        footer.setOrientation(LinearLayout.HORIZONTAL);
        footer.setGravity(Gravity.END | Gravity.CENTER_VERTICAL);
        footer.setPadding(0, dp(12), 0, 0);
        saveView = makeButton("保存", dark, true);
        saveView.setContentDescription("保存记录");
        saveView.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { saveFromInput(); }
        }));
        footer.addView(saveView, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        panelRoot.addView(footer, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        requestKeyboardOnMain();
    }

    function openPanel(mode, itemId) {
        var row = null;
        var initialText = "";
        if (!ready) { throw new Error("ClipHub editor is not ready"); }
        mode = String(mode || "new");
        if (mode === "edit") {
            row = ClipHub.Repository.getItem(Number(itemId), false);
            if (row === null || row === undefined) {
                throw new Error("编辑目标不存在");
            }
            initialText = String(row.content);
        }
        if (state.attached) { closePanel("replace"); }
        state.mode = mode === "edit" ? "edit" : "new";
        state.itemId = state.mode === "edit" ? Number(itemId) : null;
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
            try { panelParams.setTitle("ClipHub Editor Panel"); }
            catch (ignoredTitle) {}
            windowManager.addView(panelRoot, panelParams);
            state.open = true;
            state.attached = true;
            state.openCount += 1;
            state.windowType = Number(type);
            state.windowFlags = Number(panelParams.flags);
            state.addThreadId = thread.id;
            state.addThreadName = thread.name;
            state.lastError = null;
            buildPanelContent(initialText);
            return { ok: true, attached: true, mode: state.mode,
                itemId: state.itemId, state: getState() };
        }, 3000));
    }

    function getState() {
        var attachedToWindow = false;
        var inputPresent = contentInput !== null;
        var inputLength = 0;
        var notFocusable = false;
        try {
            attachedToWindow = panelRoot !== null && panelRoot.isAttachedToWindow();
        } catch (ignoredAttached) {}
        try {
            inputLength = contentInput !== null ?
                String(contentInput.getText()).length : 0;
        } catch (ignoredInput) {}
        if (panelParams !== null) {
            notFocusable = (Number(panelParams.flags) &
                Number(WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE)) !== 0;
        }
        return {
            ready: ready,
            open: state.open,
            attached: state.attached,
            attachedToWindow: attachedToWindow,
            mode: state.mode,
            itemId: state.itemId,
            inputPresent: inputPresent,
            inputLength: inputLength,
            inputFocused: contentInput !== null ? contentInput.hasFocus() : false,
            keyboardRequestCount: Number(state.keyboardRequestCount),
            focusableWindow: !notFocusable,
            openCount: Number(state.openCount),
            closeCount: Number(state.closeCount),
            saveCount: Number(state.saveCount),
            createCount: Number(state.createCount),
            updateCount: Number(state.updateCount),
            cancelCount: Number(state.cancelCount),
            lastSavedId: state.lastSavedId,
            lastSaveAction: state.lastSaveAction,
            windowType: state.windowType,
            windowFlags: state.windowFlags,
            addThreadId: state.addThreadId,
            addThreadName: state.addThreadName,
            removeThreadId: state.removeThreadId,
            removeThreadName: state.removeThreadName,
            saveThreadId: state.saveThreadId,
            saveThreadName: state.saveThreadName,
            lastError: state.lastError
        };
    }

    function resetState() {
        state.open = false;
        state.attached = false;
        state.mode = "new";
        state.itemId = null;
        state.inputFocused = false;
        state.keyboardRequestCount = 0;
        state.openCount = 0;
        state.closeCount = 0;
        state.saveCount = 0;
        state.createCount = 0;
        state.updateCount = 0;
        state.cancelCount = 0;
        state.lastSavedId = null;
        state.lastSaveAction = null;
        state.windowType = null;
        state.windowFlags = null;
        state.addThreadId = null;
        state.addThreadName = null;
        state.removeThreadId = null;
        state.removeThreadName = null;
        state.saveThreadId = null;
        state.saveThreadName = null;
        state.lastError = null;
    }

    ClipHub.Editor = {
        MODULE_NAME: "ch_10_editor",
        MODULE_VERSION: 2,
        init: function (context) {
            androidContext = context && context.androidContext ?
                context.androidContext : global.context;
            if (androidContext === null || androidContext === undefined) {
                throw new Error("Android context unavailable for editor");
            }
            appContext = androidContext.getApplicationContext() || androidContext;
            windowManager = appContext.getSystemService(Context.WINDOW_SERVICE);
            inputMethodManager = appContext.getSystemService(
                Context.INPUT_METHOD_SERVICE);
            if (windowManager === null) {
                throw new Error("WindowManager service unavailable for editor");
            }
            mainHandler = new Handler(Looper.getMainLooper());
            density = Number(appContext.getResources().getDisplayMetrics().density || 1);
            resetState();
            ready = true;
            return true;
        },
        isReady: function () { return ready; },
        isOpen: function () { return state.attached; },
        openNew: function () { return openPanel("new", null); },
        openItem: function (id) { return openPanel("edit", Number(id)); },
        close: function () { return closePanel("close"); },
        getState: getState,
        setInputText: function (text) {
            return requireMain(runOnMainSync(function () {
                if (contentInput === null) { return false; }
                contentInput.setText(String(text === null || text === undefined ? "" : text));
                contentInput.setSelection(contentInput.length());
                return true;
            }, 2500));
        },
        performSaveClick: function () {
            return requireMain(runOnMainSync(function () {
                return saveView !== null ? saveView.performClick() : false;
            }, 2500));
        },
        performCancelClick: function () {
            return requireMain(runOnMainSync(function () {
                return cancelView !== null ? cancelView.performClick() : false;
            }, 2500));
        },
        shutdown: function () {
            try { closePanel("shutdown"); } catch (ignoredClose) {}
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
