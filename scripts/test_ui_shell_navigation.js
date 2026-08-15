/* Stage6 UI shell navigation regression. Node-only test; keep ES5 syntax. */
(function () {
    var fs = require("fs");
    var vm = require("vm");
    var source = fs.readFileSync("src/ch_16_ui_shell.js", "utf8");
    var mounted = null;
    var mountCalls = 0;
    var unmountCalls = 0;
    var sandbox = {
        console: console,
        ClipHub: {
            Filter: {
                getPrimaryHostState: function () {
                    return {
                        ready: true,
                        attached: true,
                        rootMode: true,
                        childAttached: mounted !== null
                    };
                },
                mountPrimaryChildPage: function (spec) {
                    mounted = spec;
                    mountCalls += 1;
                    return true;
                },
                unmountPrimaryChildPage: function () {
                    mounted = null;
                    unmountCalls += 1;
                    return true;
                }
            }
        }
    };
    var ui;
    var state;
    var steps;
    var index;
    var nestedRejected = false;

    function equal(actual, expected, label) {
        var a = JSON.stringify(actual);
        var e = JSON.stringify(expected);
        if (a !== e) {
            throw new Error(label + ": " + a + " != " + e);
        }
    }

    function assertTrue(value, label) {
        if (!value) { throw new Error(label); }
    }

    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, { filename: "ch_16_ui_shell.js" });
    ui = sandbox.ClipHub.UIShell;
    assertTrue(!!ui, "UIShell export missing");
    ui.init({});
    state = ui.getState();

    equal(state.registeredPageIds, [
        "home", "detail", "editor", "tags", "settings",
        "regex_rules", "regex_editor", "regex_test",
        "translation", "tokenizer"
    ], "registered pages");
    equal(state.pageStack, ["home"], "initial stack");
    assertTrue(state.pageCount === 10, "page count must be 10");
    assertTrue(ui.canEmbed("detail") === true, "detail embed from home");
    assertTrue(ui.canEmbed("settings") === true, "settings embed from home");
    assertTrue(ui.canEmbed("editor") === true, "editor embed from home");
    assertTrue(ui.canEmbed("translation") === true,
        "translation embed from home");

    ui.mountPage("detail", { id: "detailView" }, {
        title: "内容详情",
        showBack: true,
        onBack: function () {
            return ui.unmountPage("detail", "test_detail_back");
        },
        onClose: function () {
            return ui.unmountPage("detail", "test_detail_close");
        }
    });
    equal(ui.getState().pageStack, ["home", "detail"], "detail stack");
    assertTrue(ui.dispatchBack("test") === true, "detail back");
    equal(ui.getState().pageStack, ["home"], "detail back home");

    ui.mountPage("editor", { id: "editorView" }, {
        title: "编辑剪贴板",
        showBack: true,
        onBack: function () {
            return ui.unmountPage("editor", "test_editor_back");
        },
        onClose: function () {
            return ui.unmountPage("editor", "test_editor_close");
        }
    });
    assertTrue(ui.syncEmbeddedPage({
        pageId: "tags",
        path: ["editor", "tags"],
        title: "标签",
        showBack: true,
        view: { id: "tagsView" },
        onBack: function () { return true; }
    }) === true, "sync tags");
    equal(ui.getState().pageStack,
        ["home", "editor", "tags"], "tags stack");
    assertTrue(ui.syncEmbeddedPage({
        pageId: "tokenizer",
        path: ["editor", "tokenizer"],
        title: "分词",
        showBack: true,
        view: { id: "tokenizerView" },
        onBack: function () { return true; }
    }) === true, "sync tokenizer");
    equal(ui.getState().pageStack,
        ["home", "editor", "tokenizer"], "tokenizer stack");
    assertTrue(ui.unmountPage("editor", "test_editor_family_close") === true,
        "editor family unmount");
    equal(ui.getState().pageStack, ["home"], "editor family home");

    ui.mountPage("settings", { id: "settingsView" }, {
        title: "ClipHub 设置",
        showBack: false,
        onBack: function () {
            return ui.unmountPage("settings", "test_settings_back");
        },
        onClose: function () {
            return ui.unmountPage("settings", "test_settings_close");
        }
    });
    steps = [
        ["regex_rules", ["settings", "regex_rules"]],
        ["regex_editor", ["settings", "regex_rules", "regex_editor"]],
        ["regex_test", ["settings", "regex_rules", "regex_editor", "regex_test"]]
    ];
    for (index = 0; index < steps.length; index += 1) {
        assertTrue(ui.syncEmbeddedPage({
            pageId: steps[index][0],
            path: steps[index][1],
            title: steps[index][0],
            showBack: true,
            view: { id: steps[index][0] },
            onBack: function () { return true; }
        }) === true, "sync " + steps[index][0]);
        equal(ui.getState().pageStack,
            ["home"].concat(steps[index][1]),
            steps[index][0] + " stack");
    }
    assertTrue(ui.unmountPage("settings", "test_settings_family_close") === true,
        "settings family unmount");
    equal(ui.getState().pageStack, ["home"], "settings family home");

    ui.mountPage("translation", { id: "translationView" }, {
        title: "翻译结果",
        showBack: false,
        onBack: function () {
            return ui.unmountPage("translation", "test_translation_back");
        },
        onClose: function () {
            return ui.unmountPage("translation", "test_translation_close");
        }
    });
    equal(ui.getState().pageStack,
        ["home", "translation"], "translation stack");
    assertTrue(ui.dispatchClose("test") === true, "translation close");
    equal(ui.getState().pageStack, ["home"], "translation close home");

    try {
        ui.mountPage("regex_rules", { id: "invalidNested" }, {});
    } catch (error) {
        nestedRejected = true;
    }
    assertTrue(nestedRejected,
        "nested settings page must reject direct mountPage");
    equal(ui.getState().pageStack, ["home"], "final stack");
    assertTrue(mountCalls >= 7, "primary child mount calls unexpectedly low");
    assertTrue(unmountCalls >= 4, "primary child unmount calls unexpectedly low");

    ui.shutdown();
    assertTrue(ui.getState().initialized === false, "shutdown state");
    console.log("UIShell Stage6 navigation regression: passed");
}());
