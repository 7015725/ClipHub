var fs = require("fs");
var shell = fs.readFileSync("src/ch_16_ui_shell.js", "utf8");
var nav = fs.readFileSync("src/ch_12_translation.js", "utf8");
var page = fs.readFileSync("probes/navigation_architecture_test_page.js", "utf8");
var id = "navigation_architecture_test_page";

if (shell.indexOf(id) >= 0) {
    throw new Error("UIShell core knows NavigationArchitectureTestPage id");
}
if (nav.indexOf(id) >= 0) {
    throw new Error("Navigation core knows NavigationArchitectureTestPage id");
}
if (page.indexOf('ClipHub.PageRegistry.register({') < 0) {
    throw new Error("test page is not registered through PageRegistry");
}
if (page.indexOf('ClipHub.Navigator.push(PAGE_ID') < 0) {
    throw new Error("test page is not opened through Navigator.push");
}
if (page.indexOf('factory: createPage') < 0 ||
        page.indexOf('contract: {') < 0 ||
        page.indexOf('imeBackFirst: true') < 0) {
    throw new Error("test page does not exercise factory/PageContract/IME contract");
}
[
    "ClipHub.UIShell.registerPage",
    "ClipHub.UIShell.pushPage",
    "ClipHub.PageStack.push",
    "OnBackInvokedCallback",
    "OnBackAnimationCallback",
    "setOnKeyListener"
].forEach(function (forbidden) {
    if (page.indexOf(forbidden) >= 0) {
        throw new Error("test page bypasses navigation architecture: " + forbidden);
    }
});
[
    "function createFactoryPageSpec(page, params, reason)",
    "function navigatorPush(pageId, params, reason)",
    "function navigatorPop(reason)",
    "ClipHub.PageRegistry = {",
    "ClipHub.Navigator = {",
    "ClipHub.BackDispatcher = {"
].forEach(function (required) {
    if (shell.indexOf(required) < 0) {
        throw new Error("generic navigation core missing: " + required);
    }
});
console.log("Navigation Stage 9 zero-core page acceptance: passed");
