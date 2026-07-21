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
    var tagNameInput = null;
    var saveView = null;
    var cancelView = null;
    var createTagView = null;
    var tagViews = {};
    var tagDeleteViews = {};
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
        tagCreateCount: 0,
        tagToggleCount: 0,
        tagDeleteCount: 0,
        tagRenameCount: 0,
        tagOptionCount: 0,
        attachedTagCount: 0,
        lastSavedId: null,
        lastSaveAction: null,
        lastTagId: null,
        lastTagAction: null,
        windowType: null,
        windowFlags: null,
        addThreadId: null,
        addThreadName: null,
        removeThreadId: null,
        removeThreadName: null,
        saveThreadId: null,
        saveThreadName: null,
        tagThreadId: null,
        tagThreadName: null,
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

    function makeButton(text, dark, primary, danger, selected) {
        var color;
        var fill;
        var stroke;
        if (danger) {
            color = dark ? "#FFFFA3A3" : "#FFB91C1C";
            fill = dark ? "#2EF87171" : "#18DC2626";
            stroke = dark ? "#55F87171" : "#35DC2626";
        } else if (selected || primary) {
            color = dark ? "#FFE6F2FF" : "#FF174A78";
            fill = dark ? "#FF344D66" : "#FFE3EEF8";
            stroke = dark ? "#667DB4E8" : "#55719BC6";
        } else {
            color = dark ? "#FFE4E4E7" : "#FF3F3F46";
            fill = dark ? "#22FFFFFF" : "#10000000";
            stroke = dark ? "#25FFFFFF" : "#16000000";
        }
        var view = makeText(text, 13, color, true);
        view.setGravity(Gravity.CENTER);
        view.setPadding(dp(12), dp(7), dp(12), dp(7));
        view.setBackground(roundedBackground(fill, stroke, 10));
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

    function emitTagChanged(action, itemId, tagId) {
        var thread = nowThread();
        try {
            if (ClipHub.EventBus && typeof ClipHub.EventBus.emit === "function") {
                return ClipHub.EventBus.emit("tags_changed", {
                    action: String(action),
                    itemId: itemId === null || itemId === undefined ?
                        null : Number(itemId),
                    tagId: tagId === null || tagId === undefined ?
                        null : Number(tagId),
                    threadId: thread.id,
                    threadName: thread.name
                });
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
        height = Math.min(dp(540), Math.max(dp(340),
            Number(metrics.heightPixels) - dp(96)));
        return { width: width, height: height };
    }

    function activeInput() {
        return state.mode === "tags" ? tagNameInput : contentInput;
    }

    function requestKeyboardOnMain() {
        var target = activeInput();
        if (target === null) { return false; }
        target.requestFocus();
        state.inputFocused = target.hasFocus();
        state.keyboardRequestCount += 1;
        mainHandler.postDelayed(new Packages.java.lang.Runnable({
            run: function () {
                try {
                    if (target !== null && inputMethodManager !== null) {
                        inputMethodManager.showSoftInput(
                            target, InputMethodManager.SHOW_IMPLICIT);
                        state.inputFocused = target.hasFocus();
                    }
                } catch (ignored) {}
            }
        }), 120);
        return state.inputFocused;
    }

    function hideKeyboardOnMain() {
        var target = activeInput();
        try {
            if (target !== null && inputMethodManager !== null) {
                inputMethodManager.hideSoftInputFromWindow(target.getWindowToken(), 0);
            }
        } catch (ignored) {}
    }

    function clearViews() {
        panelRoot = null;
        panelParams = null;
        contentInput = null;
        tagNameInput = null;
        saveView = null;
        cancelView = null;
        createTagView = null;
        tagViews = {};
        tagDeleteViews = {};
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
                clearViews();
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

    function itemHasTag(tagId) {
        var tags = ClipHub.Repository.listItemTags(Number(state.itemId));
        var index;
        for (index = 0; index < tags.length; index += 1) {
            if (Number(tags[index].id) === Number(tagId)) { return true; }
        }
        return false;
    }

    function recordTagAction(action, tagId) {
        var thread = nowThread();
        state.lastTagAction = String(action);
        state.lastTagId = Number(tagId);
        state.tagThreadId = thread.id;
        state.tagThreadName = thread.name;
        state.lastError = null;
        emitTagChanged(action, state.itemId, tagId);
    }

    function createTagFromInput() {
        var name;
        var tagId;
        if (tagNameInput === null || state.mode !== "tags") { return false; }
        try {
            name = ClipHub.Repository.normalizeTagName(String(tagNameInput.getText()));
            if (name.length === 0) { throw new Error("标签名称不能为空"); }
            tagId = Number(ClipHub.Repository.ensureTag(name, null));
            if (state.itemId !== null && !itemHasTag(tagId)) {
                ClipHub.Repository.attachTag(Number(state.itemId), tagId);
            }
            state.tagCreateCount += 1;
            recordTagAction("tag_created", tagId);
            buildTagContent(false);
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function toggleTag(tagId) {
        var attached;
        if (state.mode !== "tags" || state.itemId === null) { return false; }
        try {
            attached = itemHasTag(tagId);
            if (attached) {
                ClipHub.Repository.detachTag(Number(state.itemId), Number(tagId));
                recordTagAction("tag_detached", tagId);
            } else {
                ClipHub.Repository.attachTag(Number(state.itemId), Number(tagId));
                recordTagAction("tag_attached", tagId);
            }
            state.tagToggleCount += 1;
            buildTagContent(false);
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function deleteTag(tagId) {
        var changed;
        if (state.mode !== "tags") { return false; }
        try {
            changed = ClipHub.Repository.deleteTag(Number(tagId));
            if (Number(changed) < 1) { return false; }
            state.tagDeleteCount += 1;
            recordTagAction("tag_deleted", tagId);
            buildTagContent(false);
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function renameTag(tagId, name) {
        var changed;
        try {
            changed = ClipHub.Repository.updateTag(Number(tagId), { name: name });
            if (Number(changed) < 1) { return false; }
            state.tagRenameCount += 1;
            recordTagAction("tag_renamed", tagId);
            if (state.mode === "tags" && state.attached) { buildTagContent(false); }
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function addTitle(titleText, subtitleText) {
        var dark = isDarkMode();
        var primary = dark ? "#FFF4F4F5" : "#FF171717";
        var secondary = dark ? "#FFB4B4BC" : "#FF66666F";
        var titleRow = new LinearLayout(appContext);
        var title = makeText(titleText, 16, primary, true);
        var subtitle;
        var params;
        titleRow.setOrientation(LinearLayout.HORIZONTAL);
        titleRow.setGravity(Gravity.CENTER_VERTICAL);
        titleRow.addView(title, new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        cancelView = makeButton("关闭", dark, false, false, false);
        cancelView.setContentDescription("关闭编辑窗口");
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
        subtitle = makeText(subtitleText, 12, secondary, false);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(10);
        panelRoot.addView(subtitle, params);
    }

    function buildTextContent(initialText) {
        var dark = isDarkMode();
        var primary = dark ? "#FFF4F4F5" : "#FF171717";
        var secondary = dark ? "#FFB4B4BC" : "#FF66666F";
        var scroll;
        var footer;
        panelRoot.removeAllViews();
        addTitle(state.mode === "new" ? "新增记录" : "编辑记录",
            state.mode === "new" ? "手动添加文本记录" :
                "仅修改正文，来源和类型保持不变");
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
        saveView = makeButton("保存", dark, true, false, false);
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

    function buildTagContent(requestFocus) {
        var dark = isDarkMode();
        var primary = dark ? "#FFF4F4F5" : "#FF171717";
        var secondary = dark ? "#FFB4B4BC" : "#FF66666F";
        var inputRow;
        var scroll;
        var list;
        var allTags;
        var attachedTags;
        var attached = {};
        var index;
        var tag;
        var row;
        var toggleView;
        var deleteView;
        var params;
        var inputParams;
        panelRoot.removeAllViews();
        tagViews = {};
        tagDeleteViews = {};
        addTitle("管理标签", "创建标签并绑定到当前记录");
        inputRow = new LinearLayout(appContext);
        inputRow.setOrientation(LinearLayout.HORIZONTAL);
        inputRow.setGravity(Gravity.CENTER_VERTICAL);
        tagNameInput = new EditText(appContext);
        tagNameInput.setSingleLine(true);
        tagNameInput.setHint("新标签名称");
        tagNameInput.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        tagNameInput.setTextColor(Color.parseColor(primary));
        tagNameInput.setHintTextColor(Color.parseColor(secondary));
        tagNameInput.setInputType(InputType.TYPE_CLASS_TEXT |
            InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        tagNameInput.setPadding(dp(11), dp(7), dp(11), dp(7));
        tagNameInput.setBackground(roundedBackground(
            dark ? "#FF202328" : "#FFF7F7F8",
            dark ? "#35FFFFFF" : "#1D000000", 10));
        inputParams = new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1);
        inputParams.rightMargin = dp(8);
        inputRow.addView(tagNameInput, inputParams);
        createTagView = makeButton("新增", dark, true, false, false);
        createTagView.setContentDescription("创建新标签");
        createTagView.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { createTagFromInput(); }
        }));
        inputRow.addView(createTagView, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(12);
        panelRoot.addView(inputRow, params);
        allTags = ClipHub.Repository.listTags();
        attachedTags = ClipHub.Repository.listItemTags(Number(state.itemId));
        for (index = 0; index < attachedTags.length; index += 1) {
            attached[String(attachedTags[index].id)] = true;
        }
        state.tagOptionCount = allTags.length;
        state.attachedTagCount = attachedTags.length;
        scroll = new ScrollView(appContext);
        scroll.setFillViewport(true);
        list = new LinearLayout(appContext);
        list.setOrientation(LinearLayout.VERTICAL);
        if (allTags.length === 0) {
            row = makeText("暂无标签\n在上方输入名称后创建", 14,
                secondary, false);
            row.setGravity(Gravity.CENTER);
            row.setPadding(dp(12), dp(36), dp(12), dp(36));
            list.addView(row, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));
        } else {
            for (index = 0; index < allTags.length; index += 1) {
                tag = allTags[index];
                row = new LinearLayout(appContext);
                row.setOrientation(LinearLayout.HORIZONTAL);
                row.setGravity(Gravity.CENTER_VERTICAL);
                row.setPadding(dp(9), dp(8), dp(8), dp(8));
                row.setBackground(roundedBackground(
                    dark ? "#FF24272D" : "#FFF4F4F6",
                    dark ? "#24FFFFFF" : "#12000000", 11));
                toggleView = makeButton(String(tag.name), dark, false, false,
                    attached[String(tag.id)] === true);
                toggleView.setContentDescription(
                    (attached[String(tag.id)] ? "移除标签 " : "添加标签 ") +
                    String(tag.name));
                (function (tagId, view) {
                    view.setOnClickListener(new JavaAdapter(View.OnClickListener, {
                        onClick: function () { toggleTag(tagId); }
                    }));
                    tagViews[String(tagId)] = view;
                }(Number(tag.id), toggleView));
                row.addView(toggleView, new LinearLayout.LayoutParams(
                    0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
                deleteView = makeButton("删除", dark, false, true, false);
                deleteView.setContentDescription("删除标签 " + String(tag.name));
                (function (tagId, view) {
                    view.setOnClickListener(new JavaAdapter(View.OnClickListener, {
                        onClick: function () { deleteTag(tagId); }
                    }));
                    tagDeleteViews[String(tagId)] = view;
                }(Number(tag.id), deleteView));
                params = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT);
                params.leftMargin = dp(8);
                row.addView(deleteView, params);
                params = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.MATCH_PARENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT);
                params.bottomMargin = dp(7);
                list.addView(row, params);
            }
        }
        scroll.addView(list, new Packages.android.widget.FrameLayout.LayoutParams(
            Packages.android.widget.FrameLayout.LayoutParams.MATCH_PARENT,
            Packages.android.widget.FrameLayout.LayoutParams.WRAP_CONTENT));
        panelRoot.addView(scroll, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));
        if (requestFocus) { requestKeyboardOnMain(); }
        return true;
    }

    function openPanel(mode, itemId) {
        var row = null;
        var initialText = "";
        if (!ready) { throw new Error("ClipHub editor is not ready"); }
        mode = String(mode || "new");
        if (mode === "edit" || mode === "tags") {
            row = ClipHub.Repository.getItem(Number(itemId), false);
            if (row === null || row === undefined) {
                throw new Error("编辑目标不存在");
            }
            initialText = String(row.content);
        }
        if (state.attached) { closePanel("replace"); }
        state.mode = mode === "edit" ? "edit" :
            (mode === "tags" ? "tags" : "new");
        state.itemId = state.mode === "new" ? null : Number(itemId);
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
            if (state.mode === "tags") {
                buildTagContent(true);
            } else {
                buildTextContent(initialText);
            }
            return { ok: true, attached: true, mode: state.mode,
                itemId: state.itemId, state: getState() };
        }, 3000));
    }

    function getState() {
        var attachedToWindow = false;
        var input = activeInput();
        var inputLength = 0;
        var notFocusable = false;
        try {
            attachedToWindow = panelRoot !== null && panelRoot.isAttachedToWindow();
        } catch (ignoredAttached) {}
        try {
            inputLength = input !== null ? String(input.getText()).length : 0;
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
            inputPresent: input !== null,
            inputLength: inputLength,
            inputFocused: input !== null ? input.hasFocus() : false,
            keyboardRequestCount: Number(state.keyboardRequestCount),
            focusableWindow: !notFocusable,
            openCount: Number(state.openCount),
            closeCount: Number(state.closeCount),
            saveCount: Number(state.saveCount),
            createCount: Number(state.createCount),
            updateCount: Number(state.updateCount),
            cancelCount: Number(state.cancelCount),
            tagCreateCount: Number(state.tagCreateCount),
            tagToggleCount: Number(state.tagToggleCount),
            tagDeleteCount: Number(state.tagDeleteCount),
            tagRenameCount: Number(state.tagRenameCount),
            tagOptionCount: Number(state.tagOptionCount),
            attachedTagCount: Number(state.attachedTagCount),
            tagButtonCount: Object.keys(tagViews).length,
            tagDeleteButtonCount: Object.keys(tagDeleteViews).length,
            lastSavedId: state.lastSavedId,
            lastSaveAction: state.lastSaveAction,
            lastTagId: state.lastTagId,
            lastTagAction: state.lastTagAction,
            windowType: state.windowType,
            windowFlags: state.windowFlags,
            addThreadId: state.addThreadId,
            addThreadName: state.addThreadName,
            removeThreadId: state.removeThreadId,
            removeThreadName: state.removeThreadName,
            saveThreadId: state.saveThreadId,
            saveThreadName: state.saveThreadName,
            tagThreadId: state.tagThreadId,
            tagThreadName: state.tagThreadName,
            lastError: state.lastError
        };
    }

    function resetState() {
        var key;
        var defaults = {
            open: false, attached: false, mode: "new", itemId: null,
            inputFocused: false, keyboardRequestCount: 0, openCount: 0,
            closeCount: 0, saveCount: 0, createCount: 0, updateCount: 0,
            cancelCount: 0, tagCreateCount: 0, tagToggleCount: 0,
            tagDeleteCount: 0, tagRenameCount: 0, tagOptionCount: 0,
            attachedTagCount: 0, lastSavedId: null, lastSaveAction: null,
            lastTagId: null, lastTagAction: null, windowType: null,
            windowFlags: null, addThreadId: null, addThreadName: null,
            removeThreadId: null, removeThreadName: null, saveThreadId: null,
            saveThreadName: null, tagThreadId: null, tagThreadName: null,
            lastError: null
        };
        for (key in defaults) {
            if (defaults.hasOwnProperty(key)) { state[key] = defaults[key]; }
        }
    }

    ClipHub.Editor = {
        MODULE_NAME: "ch_10_editor",
        MODULE_VERSION: 3,
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
            clearViews();
            resetState();
            ready = true;
            return true;
        },
        isReady: function () { return ready; },
        isOpen: function () { return state.attached; },
        openNew: function () { return openPanel("new", null); },
        openItem: function (id) { return openPanel("edit", Number(id)); },
        openTags: function (id) { return openPanel("tags", Number(id)); },
        close: function () { return closePanel("close"); },
        getState: getState,
        setInputText: function (text) {
            return requireMain(runOnMainSync(function () {
                var input = activeInput();
                if (input === null) { return false; }
                input.setText(String(text === null || text === undefined ? "" : text));
                input.setSelection(input.length());
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
        performCreateTagClick: function (name) {
            return requireMain(runOnMainSync(function () {
                if (tagNameInput === null || createTagView === null) { return false; }
                tagNameInput.setText(String(name === null || name === undefined ? "" : name));
                tagNameInput.setSelection(tagNameInput.length());
                return createTagView.performClick();
            }, 2500));
        },
        performTagToggleClick: function (tagId) {
            tagId = String(Number(tagId));
            return requireMain(runOnMainSync(function () {
                return tagViews[tagId] ? tagViews[tagId].performClick() : false;
            }, 2500));
        },
        performTagDeleteClick: function (tagId) {
            tagId = String(Number(tagId));
            return requireMain(runOnMainSync(function () {
                return tagDeleteViews[tagId] ?
                    tagDeleteViews[tagId].performClick() : false;
            }, 2500));
        },
        renameTag: renameTag,
        shutdown: function () {
            try { closePanel("shutdown"); } catch (ignoredClose) {}
            ready = false;
            androidContext = null;
            appContext = null;
            windowManager = null;
            inputMethodManager = null;
            mainHandler = null;
            clearViews();
            return true;
        }
    };
}((function () { return this; }())));
