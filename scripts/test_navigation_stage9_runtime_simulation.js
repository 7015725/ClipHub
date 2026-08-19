var fs = require("fs");
var vm = require("vm");
var source = fs.readFileSync("src/ch_16_ui_shell.js", "utf8");
var imeVisible = true;
var imeHideCount = 0;
var focusHandoffCount = 0;
var backRefreshCount = 0;
var rootHideCount = 0;
var mountedPageId = null;
var lifecycle = {
    beforeEnter: 0,
    enter: 0,
    beforeLeave: 0,
    leave: 0
};
var token = {};
var fakeInput = {
    getWindowToken: function () { return token; },
    clearFocus: function () {}
};
var fakeRoot = {
    getRootWindowInsets: function () {
        return {
            isVisible: function () { return imeVisible; }
        };
    },
    findFocus: function () { return fakeInput; }
};
var fakeView = {
    getRootView: function () { return fakeRoot; },
    isAttachedToWindow: function () { return true; }
};
var imm = {
    hideSoftInputFromWindow: function (value) {
        if (value !== token) { throw new Error("wrong window token"); }
        imeHideCount += 1;
        imeVisible = false;
        return true;
    }
};
var androidContext = {
    getSystemService: function () { return imm; }
};
var hostState = {
    ready: true,
    rootMode: true,
    childAttached: false,
    childPageId: null
};
var ClipHub = {
    Filter: {
        getPrimaryHostState: function () {
            return {
                ready: hostState.ready,
                rootMode: hostState.rootMode,
                childAttached: hostState.childAttached,
                childPageId: hostState.childPageId
            };
        },
        mountPrimaryChildPage: function (spec) {
            hostState.childAttached = true;
            hostState.childPageId = String(spec.pageId);
            mountedPageId = String(spec.pageId);
            return true;
        },
        unmountPrimaryChildPage: function () {
            hostState.childAttached = false;
            hostState.childPageId = null;
            mountedPageId = null;
            return true;
        }
    },
    Navigation: {
        handoffBackFocus: function () {
            focusHandoffCount += 1;
            return { ok: true };
        },
        refreshSystemBackCapture: function () {
            backRefreshCount += 1;
            return true;
        }
    },
    App: {
        hideUi: function () {
            rootHideCount += 1;
            return true;
        }
    }
};
var context = {
    console: console,
    ClipHub: ClipHub,
    context: androidContext,
    Packages: {
        android: {
            os: { Build: { VERSION: { SDK_INT: 34 } } },
            view: {
                WindowInsets: {
                    Type: { ime: function () { return 1; } }
                }
            },
            content: {
                Context: { INPUT_METHOD_SERVICE: "input_method" }
            }
        }
    }
};
context.global = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: "ch_16_ui_shell.js" });
var shell = context.ClipHub.UIShell;
var registry = context.ClipHub.PageRegistry;
var navigator = context.ClipHub.Navigator;
var dispatcher = context.ClipHub.BackDispatcher;

shell.init({ androidContext: androidContext });
if (navigator.current().id !== "home" || navigator.stackSize() !== 1) {
    throw new Error("initial PageStack root invalid");
}

registry.register({
    id: "runtime_sim_test_page",
    parentId: "home",
    family: "runtime_sim",
    owner: "runtime_sim",
    moduleName: "RuntimeSimPage",
    shellReady: true,
    factory: function () {
        return { view: fakeView, title: "runtime sim", showBack: true };
    },
    contract: {
        imeBackFirst: true,
        systemBack: true,
        swipeBack: true,
        predictiveBack: true
    },
    hooks: {
        onBeforeEnter: function () { lifecycle.beforeEnter += 1; },
        onEnter: function () { lifecycle.enter += 1; },
        onBeforeLeave: function () { lifecycle.beforeLeave += 1; },
        onLeave: function () { lifecycle.leave += 1; }
    }
});

navigator.push("runtime_sim_test_page", { test: 1 }, "runtime_sim_push");
if (navigator.stackSize() !== 2 || navigator.current().id !== "runtime_sim_test_page") {
    throw new Error("Navigator.push did not mutate PageStack once");
}
if (mountedPageId !== "runtime_sim_test_page" || !hostState.childAttached) {
    throw new Error("factory page was not mounted by NavigationHost");
}
if (lifecycle.beforeEnter !== 1 || lifecycle.enter !== 1) {
    throw new Error("enter lifecycle hooks were not dispatched exactly once");
}

var first = dispatcher.dispatch("back_key", {
    sourceFamily: "legacy_key",
    requestId: "runtime-back-1"
});
if (first !== true || imeHideCount !== 1 || navigator.stackSize() !== 2) {
    throw new Error("IME-first Back must consume without pop");
}
if (focusHandoffCount !== 1 || backRefreshCount !== 1) {
    throw new Error("IME Back did not hand off focus/rearm system Back");
}
if (!hostState.childAttached || lifecycle.beforeLeave !== 0) {
    throw new Error("IME-first Back incorrectly started page leave");
}

var second = dispatcher.dispatch("back_key", {
    sourceFamily: "legacy_key",
    requestId: "runtime-back-2"
});
if (second !== true || navigator.stackSize() !== 1 || navigator.current().id !== "home") {
    throw new Error("second Back did not Navigator.pop to root");
}
if (hostState.childAttached || mountedPageId !== null) {
    throw new Error("factory page host was not detached on pop");
}
if (lifecycle.beforeLeave !== 1 || lifecycle.leave !== 1) {
    throw new Error("leave lifecycle hooks were not dispatched exactly once");
}

var root = dispatcher.dispatch("back_key", {
    sourceFamily: "legacy_key",
    requestId: "runtime-back-root"
});
if (root !== true || rootHideCount !== 1) {
    throw new Error("rootBehavior=close_host did not handle root Back");
}

var duplicate = dispatcher.dispatch("back_key", {
    sourceFamily: "legacy_key",
    requestId: "runtime-back-root"
});
if (duplicate !== true || rootHideCount !== 1) {
    throw new Error("duplicate Back request executed root behavior twice");
}

registry.register({
    id: "runtime_legacy_page",
    parentId: "home",
    family: "runtime_legacy",
    owner: "runtime_legacy",
    moduleName: "RuntimeLegacyPage",
    shellReady: true,
    contract: {
        imeBackFirst: false,
        systemBack: true
    }
});
shell.mountPage("runtime_legacy_page", fakeView, {
    title: "legacy",
    showBack: true,
    imeBackFirst: false,
    onBack: function () {
        return shell.unmountPage("runtime_legacy_page", "legacy_hook_back");
    }
});
var legacyBefore = dispatcher.getState();
var legacyBack = dispatcher.dispatch("back_key", {
    sourceFamily: "legacy_key",
    requestId: "runtime-legacy-back"
});
var legacyAfter = dispatcher.getState();
if (legacyBack !== true || navigator.current().id !== "home" ||
        navigator.stackSize() !== 1 || hostState.childAttached) {
    throw new Error("legacy hook intent was not committed by Navigator");
}
if (legacyAfter.legacyHookIntentCount !== legacyBefore.legacyHookIntentCount + 1 ||
        legacyAfter.deferredHookNavigationCount !==
            legacyBefore.deferredHookNavigationCount + 1 ||
        legacyAfter.navigatorPopCount !== legacyBefore.navigatorPopCount + 1) {
    throw new Error("legacy hook did not produce one deferred Navigator pop");
}
if (legacyAfter.legacyHookNavigationCount !==
        legacyBefore.legacyHookNavigationCount) {
    throw new Error("legacy hook directly mutated PageStack");
}
if (legacyAfter.lastOutcome !== "navigator_pop_after_page_hook") {
    throw new Error("legacy hook outcome did not converge on Navigator");
}

/* tokenizer_transient_swipe_restore_v1 */
shell.mountPage("editor", fakeView, {
    title: "编辑选中文本",
    showBack: true,
    imeBackFirst: false,
    onBack: function () {
        shell.syncEmbeddedPage({
            pageId: "tokenizer",
            path: ["tokenizer"],
            title: "分词",
            showBack: false,
            view: fakeView,
            onBack: function () { return true; }
        });
        return true;
    }
});
var transientBefore = dispatcher.getState();
var transientBack = dispatcher.dispatch("system_swipe_back", {
    sourceFamily: "gesture",
    requestId: "tokenizer-transient-swipe-back"
});
var transientAfter = dispatcher.getState();
var transientShellAfter = shell.getState();
if (transientBack !== true || navigator.stackSize() !== 2 ||
        navigator.current().id !== "tokenizer" ||
        transientShellAfter.currentPageId !== "tokenizer" ||
        transientShellAfter.activePageId !== "tokenizer") {
    throw new Error("transient editor Back did not restore tokenizer leaf: " +
        JSON.stringify({ back: transientBack, size: navigator.stackSize(),
            current: navigator.current(), shell: transientShellAfter,
            dispatcher: transientAfter }));
}
if (!hostState.childAttached || mountedPageId !== "tokenizer") {
    throw new Error("transient editor Back detached primary child to home");
}
if (transientAfter.deferredHookNavigationCount !==
        transientBefore.deferredHookNavigationCount + 1 ||
        transientAfter.navigatorPopCount !== transientBefore.navigatorPopCount + 1 ||
        transientAfter.lastOutcome !== "navigator_pop_after_page_hook") {
    throw new Error("transient editor Back did not commit one deferred leaf replace");
}

console.log("Navigation Stage 9 runtime simulation: passed");
