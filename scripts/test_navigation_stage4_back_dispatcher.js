var fs = require("fs");
var shell = fs.readFileSync("src/ch_16_ui_shell.js", "utf8");
var nav = fs.readFileSync("src/ch_12_translation.js", "utf8");
function need(source, token, message) {
    if (source.indexOf(token) < 0) { throw new Error(message + ": " + token); }
}
need(shell, "ClipHub.BackDispatcher = {", "BackDispatcher owner missing");
need(shell, "dispatch: backDispatcherDispatch", "BackDispatcher dispatch API missing");
need(shell, "function backDispatcherDispatch(reason, request)", "BackDispatcher state machine missing");
need(shell, "return backDispatcherDispatch(reason, request);", "UIShell Back does not delegate to BackDispatcher");
need(shell, "if (typeof activeBack === \"function\")", "page Back hook phase missing");
need(shell, "hookChangedNavigation", "legacy hook navigation bridge missing");
need(shell, "if (navigatorCanPop())", "BackDispatcher canPop phase missing");
need(shell, "handled = navigatorPop(reason || \"back_dispatcher_pop\") === true", "BackDispatcher final pop missing");
need(shell, "lastBackOutcome = \"page_hook_consumed\"", "page consume outcome missing");
need(shell, "lastBackOutcome = \"navigator_pop\"", "navigator pop outcome missing");
need(shell, "lastBackOutcome = \"root_unhandled\"", "root outcome missing");
need(shell, "backDispatchInProgress", "Back concurrency guard missing");
need(shell, "duplicateBackRequestCount", "Back request dedupe missing");
need(nav, "ClipHub.UIShell.dispatchBack(", "Android Back no longer enters UIShell bridge");
need(nav, "onBackStarted: function", "Predictive start missing");
need(nav, "onBackProgressed: function", "Predictive progress missing");
need(nav, "onBackCancelled: function", "Predictive cancel missing");
need(nav, "onBackInvoked: function", "Predictive commit missing");
need(shell, 'MODULE_VERSION: 12,', "UIShell module version not bumped");
console.log("Navigation Stage 4 BackDispatcher contract: passed");
