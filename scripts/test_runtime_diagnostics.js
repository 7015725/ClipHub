/* Stage7 runtime diagnostics regression. Node-only; keep ES5 syntax. */
(function () {
    var fs = require("fs");
    var vm = require("vm");
    var source = fs.readFileSync("src/ch_16_ui_shell.js", "utf8");
    var mounted = null;
    var runtime = {
        filter: {
            attached: true,
            attachedToWindow: true,
            rootMode: true,
            panelWidthDp: 390,
            panelHeightDp: 688
        },
        windowState: {
            primaryAttached: true,
            managedWindowCount: 1,
            managedWindowRoles: ["filter_root"],
            moving: false,
            resizing: false
        },
        removal: {
            pendingSafeRemoveCount: 0,
            safeRemoveFailureCount: 0,
            safeRemoveTimeoutCount: 0,
            lastSafeRemoveRole: null,
            lastSafeRemoveReason: null,
            lastSafeRemoveError: null
        },
        detail: {},
        editor: {},
        settings: {},
        translation: {},
        tokenizer: {}
    };
    var sandbox = {
        console: console,
        ClipHub: {
            Filter: {
                getPrimaryHostState: function () {
                    return {
                        ready: true,
                        attached: true,
                        rootMode: true,
                        childAttached: mounted !== null,
                        childPageId: mounted ? String(mounted.pageId || "") : "",
                        childTitle: mounted ? String(mounted.title || "") : "",
                        widthDp: 390,
                        heightDp: 688,
                        homeCachePreserved: true,
                        windowReuseOnly: true
                    };
                },
                getPanelState: function () { return runtime.filter; },
                getImeAvoidanceState: function () {
                    return { active: false, keyboardVisible: false };
                },
                mountPrimaryChildPage: function (spec) {
                    mounted = spec;
                    return true;
                },
                unmountPrimaryChildPage: function () {
                    mounted = null;
                    return true;
                }
            },
            Window: {
                getState: function () { return runtime.windowState; },
                getRemovalState: function () { return runtime.removal; }
            },
            List: {
                getDetailState: function () { return runtime.detail; }
            },
            Editor: {
                getState: function () { return runtime.editor; }
            },
            Settings: {
                getState: function () { return runtime.settings; }
            },
            Translation: {
                getState: function () { return runtime.translation; }
            },
            TokenizerUI: {
                getState: function () { return runtime.tokenizer; }
            }
        }
    };
    var ui;
    var diag;

    function assertTrue(value, label) {
        if (!value) { throw new Error(label); }
    }

    function hasIssue(code) {
        var index;
        for (index = 0; index < diag.issues.length; index += 1) {
            if (diag.issues[index].code === code) { return true; }
        }
        return false;
    }

    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, { filename: "ch_16_ui_shell.js" });
    ui = sandbox.ClipHub.UIShell;
    ui.init({});

    diag = ui.getRuntimeDiagnostics();
    assertTrue(diag.schemaVersion === 1, "diagnostic schema");
    assertTrue(diag.health === "ok", "home diagnostics must be ok");
    assertTrue(diag.issueCount === 0, "home issue count");
    assertTrue(diag.primaryWindow.managedWindowCount === 1,
        "single primary window");

    runtime.detail = {
        attached: true,
        attachedToWindow: true,
        embeddedInPrimary: true,
        itemId: 7
    };
    ui.mountPage("detail", { id: "detail" }, {
        title: "内容详情",
        showBack: true,
        onBack: function () {
            runtime.detail = {};
            return ui.unmountPage("detail", "test_detail_back");
        }
    });
    diag = ui.getRuntimeDiagnostics();
    assertTrue(diag.health === "ok", "detail diagnostics");
    assertTrue(diag.shell.activePageId === "detail", "detail active");
    ui.dispatchBack("test");

    runtime.editor = {
        attached: true,
        attachedToWindow: true,
        embeddedInPrimary: true,
        mode: "edit",
        itemId: 8,
        panelWidthDp: 390,
        panelHeightDp: 688,
        inputFocused: false,
        keyboardVisible: false,
        imeInsetBottomDp: 0,
        normalPanelHeightDp: 688,
        currentPanelHeightDp: 688,
        currentPanelTopDp: 0
    };
    ui.mountPage("editor", { id: "editor" }, {
        title: "编辑剪贴板", showBack: true
    });
    runtime.tokenizer = {
        mounted: true,
        embeddedInPrimary: true,
        mode: "normal",
        editorRootCaptured: true
    };
    ui.syncEmbeddedPage({
        pageId: "tokenizer",
        path: ["editor", "tokenizer"],
        title: "分词",
        showBack: true,
        view: { id: "editor" }
    });
    diag = ui.getRuntimeDiagnostics();
    assertTrue(diag.health === "ok", "tokenizer diagnostics");
    assertTrue(diag.pages.tokenizer.mounted === true, "tokenizer mounted");

    runtime.editor.currentPanelHeightDp = 520;
    diag = ui.getRuntimeDiagnostics();
    assertTrue(hasIssue("EDITOR_IME_HEIGHT_NOT_RESTORED"),
        "editor IME restore mismatch must be detected");
    runtime.editor.currentPanelHeightDp = 688;

    runtime.windowState.managedWindowCount = 2;
    diag = ui.getRuntimeDiagnostics();
    assertTrue(hasIssue("MULTIPLE_MANAGED_WINDOWS"),
        "multiple managed windows must be detected");
    runtime.windowState.managedWindowCount = 1;

    runtime.tokenizer = {};
    runtime.editor = {};
    ui.unmountPage("editor", "test_editor_close");

    runtime.settings = {
        attached: true,
        attachedToWindow: true,
        embeddedInPrimary: true,
        settingsPage: "regex_test",
        settingsTab: "filter",
        panelWidthDp: 390,
        panelHeightDp: 688,
        inputFocused: false,
        keyboardVisible: false,
        imeInsetBottomDp: 0,
        normalPanelHeightDp: 688,
        currentPanelHeightDp: 688,
        currentPanelTopDp: 0
    };
    ui.mountPage("settings", { id: "settings" }, {
        title: "ClipHub 设置", showBack: false
    });
    ui.syncEmbeddedPage({
        pageId: "regex_test",
        path: ["settings", "regex_rules", "regex_editor", "regex_test"],
        title: "正则测试",
        showBack: true,
        view: { id: "settings" }
    });
    diag = ui.getRuntimeDiagnostics();
    assertTrue(diag.health === "ok", "regex diagnostics");
    runtime.settings = {};
    ui.unmountPage("settings", "test_settings_close");

    runtime.translation = {
        attached: true,
        attachedToWindow: true,
        embeddedInPrimary: true,
        itemId: 9,
        running: false,
        panelWidthDp: 390,
        panelHeightDp: 688
    };
    ui.mountPage("translation", { id: "translation" }, {
        title: "翻译结果", showBack: false
    });
    diag = ui.getRuntimeDiagnostics();
    assertTrue(diag.health === "ok", "translation diagnostics");
    runtime.translation = {};
    ui.unmountPage("translation", "test_translation_close");

    runtime.detail = {
        attached: true,
        attachedToWindow: true,
        embeddedInPrimary: false,
        itemId: 10
    };
    mounted = null;
    sandbox.ClipHub.Filter.getPrimaryHostState = function () {
        return {
            ready: false, attached: false, rootMode: false,
            childAttached: false, childPageId: "",
            widthDp: 0, heightDp: 0, homeCachePreserved: false
        };
    };
    runtime.filter = {};
    runtime.windowState = {
        primaryAttached: false,
        managedWindowCount: 1,
        managedWindowRoles: ["detail"]
    };
    diag = ui.getRuntimeDiagnostics();
    assertTrue(diag.health === "fallback", "legacy fallback health");
    assertTrue(diag.legacyFallbackActive[0] === "detail",
        "legacy detail must be visible in diagnostics");

    console.log("UIShell Stage7 runtime diagnostics: passed");
}());
