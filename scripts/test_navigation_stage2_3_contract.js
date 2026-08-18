var fs = require("fs");
var shell = fs.readFileSync("src/ch_16_ui_shell.js", "utf8");
function need(token, message) {
    if (shell.indexOf(token) < 0) { throw new Error(message + ": " + token); }
}
need("function commitStackState(nextEntries, action, reason)", "PageStack commit owner missing");
need("function pageStackPush(pageId, params, reason)", "PageStack push missing");
need("function pageStackPop(reason)", "PageStack pop missing");
need("function pageStackReplace(pageId, params, reason)", "PageStack replace missing");
need("function pageStackCurrent()", "PageStack current missing");
need("function pageStackCanPop()", "PageStack canPop missing");
need("function pageStackSize()", "PageStack size missing");
need("ClipHub.PageStack = {", "PageStack public owner missing");
need("ClipHub.Navigator = {", "NavigationManager owner missing");
need("push: navigatorPush", "Navigator push missing");
need("pop: navigatorPop", "Navigator pop missing");
need("replace: navigatorReplace", "Navigator replace missing");
need("current: navigatorCurrent", "Navigator current missing");
need("canPop: navigatorCanPop", "Navigator canPop missing");
need("stackSize: navigatorStackSize", "Navigator stackSize missing");
need("return navigatorSyncPath(path, reason || \"legacy_set_stack_path\")", "legacy setStackPath bypasses Navigator");
need("return navigatorPush(pageId, params, reason || \"legacy_push_page\")", "legacy push bypasses Navigator");
need("return navigatorPop(reason || \"legacy_pop_page\")", "legacy pop bypasses Navigator");
need("navigatorPopToRoot(reason || \"unmount\")", "unmount bypasses Navigator");
if (shell.indexOf("stack.push(") >= 0 || shell.indexOf("stack.pop(") >= 0 ||
        shell.indexOf('stack = [{ id: "home"') >= 0 ||
        shell.indexOf("stack = [stack[0]]") >= 0 ||
        shell.indexOf("stack = next;") >= 0) {
    throw new Error("legacy direct stack mutation remains");
}
var versionMatch = shell.match(/MODULE_NAME:\s*"ch_16_ui_shell"[\s\S]*?MODULE_VERSION:\s*(\d+)/);
if (!versionMatch || Number(versionMatch[1]) < 11) {
    throw new Error("UIShell module version must remain >= 11");
}
console.log("Navigation Stage 2-3 contract: passed");
