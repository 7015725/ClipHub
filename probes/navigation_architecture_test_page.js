/* ClipHub NavigationArchitectureTestPage. Rhino ES5 only.
 * Stage 9 zero-navigation-core acceptance page.
 * Run after ClipHub is started on moduleSetVersion 20260818.12 or newer.
 */
(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var LinearLayout = Packages.android.widget.LinearLayout;
    var TextView = Packages.android.widget.TextView;
    var EditText = Packages.android.widget.EditText;
    var Gravity = Packages.android.view.Gravity;
    var TypedValue = Packages.android.util.TypedValue;
    var InputMethodManager = Packages.android.view.inputmethod.InputMethodManager;
    var Context = Packages.android.content.Context;
    var Handler = Packages.android.os.Handler;
    var Looper = Packages.android.os.Looper;
    var Runnable = Packages.java.lang.Runnable;
    var PAGE_ID = "navigation_architecture_test_page";
    var state = ClipHub.NavigationArchitectureTestPageState || {
        factoryCount: 0,
        beforeEnterCount: 0,
        enterCount: 0,
        beforeLeaveCount: 0,
        leaveCount: 0,
        lastReason: "",
        lastError: null
    };
    ClipHub.NavigationArchitectureTestPageState = state;

    function androidContext(payload) {
        var value = payload && payload.context ? payload.context : {};
        var context = value && value.androidContext ?
            value.androidContext : global.context;
        if (context && context.getApplicationContext) {
            context = context.getApplicationContext() || context;
        }
        return context;
    }

    function dp(context, value) {
        var density = Number(context.getResources()
            .getDisplayMetrics().density || 1);
        return Math.max(1, Math.floor(Number(value) * density + 0.5));
    }

    function makeText(context, text, sp, bold) {
        var view = new TextView(context);
        view.setText(String(text));
        view.setTextSize(TypedValue.COMPLEX_UNIT_SP, Number(sp));
        view.setIncludeFontPadding(false);
        if (bold) {
            view.setTypeface(Packages.android.graphics.Typeface.DEFAULT,
                Packages.android.graphics.Typeface.BOLD);
        }
        return view;
    }

    function requestIme(context, input) {
        var handler = new Handler(Looper.getMainLooper());
        handler.postDelayed(new Runnable({
            run: function () {
                var imm;
                try {
                    input.requestFocus();
                    input.setSelection(input.getText().length());
                    imm = context.getSystemService(Context.INPUT_METHOD_SERVICE);
                    if (imm !== null) {
                        imm.showSoftInput(input, InputMethodManager.SHOW_IMPLICIT);
                    }
                } catch (error) {
                    state.lastError = String(error);
                }
            }
        }), 220);
    }

    function createPage(payload) {
        var context = androidContext(payload);
        var root;
        var title;
        var description;
        var input;
        var params;
        if (!context) { throw new Error("Android context unavailable"); }
        state.factoryCount += 1;
        root = new LinearLayout(context);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.TOP);
        root.setPadding(dp(context, 20), dp(context, 18),
            dp(context, 20), dp(context, 18));

        title = makeText(context, "Navigation Architecture Test", 18, true);
        description = makeText(context,
            "本页面只通过 PageRegistry.register() + Navigator.push() 接入。\n" +
            "输入法显示时第一次 Back 只收起 IME，第二次 Back 应 pop 回首页。",
            12, false);
        description.setPadding(0, dp(context, 10), 0, dp(context, 16));
        input = new EditText(context);
        input.setSingleLine(true);
        input.setHint("输入任意文字测试 IME Back");
        input.setText("Navigation Contract v2");
        input.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        input.setPadding(dp(context, 12), dp(context, 10),
            dp(context, 12), dp(context, 10));

        root.addView(title, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        root.addView(description, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(context, 48));
        root.addView(input, params);
        requestIme(context, input);
        return {
            view: root,
            title: "导航架构测试",
            showBack: true
        };
    }

    if (!ClipHub.PageRegistry || !ClipHub.Navigator) {
        throw new Error("Navigation Contract v2 owners unavailable");
    }

    if (!ClipHub.PageRegistry.has(PAGE_ID)) {
        ClipHub.PageRegistry.register({
            id: PAGE_ID,
            parentId: "home",
            owner: "navigation_architecture_test",
            family: "navigation_architecture_test",
            moduleName: "NavigationArchitectureTestPage",
            cachePolicy: "transient",
            shellReady: true,
            factory: createPage,
            contract: {
                allowDuplicate: false,
                canPop: true,
                systemBack: true,
                swipeBack: true,
                predictiveBack: true,
                imeBackFirst: true,
                host: "primary"
            },
            hooks: {
                onBeforeEnter: function (payload) {
                    state.beforeEnterCount += 1;
                    state.lastReason = String(payload && payload.reason || "");
                },
                onEnter: function (payload) {
                    state.enterCount += 1;
                    state.lastReason = String(payload && payload.reason || "");
                },
                onBeforeLeave: function (payload) {
                    state.beforeLeaveCount += 1;
                    state.lastReason = String(payload && payload.reason || "");
                },
                onLeave: function (payload) {
                    state.leaveCount += 1;
                    state.lastReason = String(payload && payload.reason || "");
                }
            },
            metadata: {
                purpose: "stage9_zero_core_acceptance"
            }
        });
    }

    ClipHub.NavigationArchitectureTestPageResult =
        ClipHub.Navigator.push(PAGE_ID, {
            source: "stage9_probe"
        }, "stage9_architecture_test");
}((function () { return this; }())));

JSON.stringify({
    ok: true,
    pageId: "navigation_architecture_test_page",
    state: ClipHub.NavigationArchitectureTestPageState,
    shell: ClipHub.UIShell && ClipHub.UIShell.getState ?
        ClipHub.UIShell.getState() : null
});
