var fs = require("fs");
var shell = fs.readFileSync("src/ch_16_ui_shell.js", "utf8");
function need(token) { if (shell.indexOf(token) < 0) { throw new Error(token); } }
need("function normalizeFactoryPageSpec(page, created, params)");
need("function createFactoryPageSpec(page, params, reason)");
need("page.factory(payload)");
need("invokePageHook(page, \"onBeforeEnter\"");
need("invokePageHook(page, \"onEnter\"");
need("invokePageHook(page, \"onBeforeLeave\"");
need("invokePageHook(page, \"onLeave\"");
need("if (typeof page.factory !== \"function\")");
need("applyActivePage(spec, actualReason)");
need("detachActivePageForNavigator(actualReason)");
if (shell.indexOf("navigation_architecture_test_page") >= 0) {
    throw new Error("navigation core contains Stage9 test page id before test page is added");
}
console.log("Navigation Stage 9 generic factory/lifecycle core: passed");
