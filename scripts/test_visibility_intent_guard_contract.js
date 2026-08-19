var fs = require("fs");
var source = fs.readFileSync("src/ch_20_visibility_intent_guard.js", "utf8");

function requireText(value, label) {
    if (source.indexOf(value) < 0) {
        throw new Error(label + " missing");
    }
}

requireText("MODULE_VERSION: 4", "guard module version");
requireText("pendingCleanupTasks: []", "pending cleanup registry");
requireText("handler.removeCallbacks(tasks[index])", "cleanup cancellation");
requireText("function uninstallHooks()", "hook uninstall");
requireText("!installFilterHooks() || !installWindowHook()",
    "atomic hook installation");
requireText("filter.showRoot === state.wrappedShowRoot", "showRoot ownership check");
requireText("filter.showPanel === state.wrappedShowPanel", "showPanel ownership check");
requireText("filter.closePanel === state.wrappedClosePanel", "closePanel ownership check");
requireText("windowModule.attachWindow === state.wrappedAttachWindow",
    "attachWindow ownership check");
requireText("delete target.__visibilityIntentGuardController",
    "controller marker cleanup");
requireText("state.filter = null", "filter reference release");
requireText("state.windowModule = null", "window reference release");
requireText("state.mainHandler = null", "handler reference release");

console.log("Visibility intent guard lifecycle contract: passed");
