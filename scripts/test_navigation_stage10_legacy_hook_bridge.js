var fs = require("fs");
var shell = fs.readFileSync("src/ch_16_ui_shell.js", "utf8");
function need(token) { if (shell.indexOf(token) < 0) { throw new Error(token); } }
need("var backHookInProgress = false");
need("var pendingLegacyNavigation = null");
need("function applyDeferredHookNavigation(pending, reason)");
need('pendingLegacyNavigation = {\n                type: "sync_path"');
need('pendingLegacyNavigation = {\n                type: "pop_to_root"');
need("var pageBackHook = typeof activeBack === \"function\" ? activeBack");
need("page.hooks.onBack");
need("backHookInProgress = true");
need("handled = applyDeferredHookNavigation(");
need('lastBackOutcome = "navigator_pop_after_page_hook"');
need('lastBackOutcome = "unexpected_hook_navigation"');
need("hooks: {\n                onBack: defaultHomeBackHook");
need("ClipHub.Filter.handleBack()");
console.log("Navigation Stage 10 legacy-hook Navigator bridge: passed");
