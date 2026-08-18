var fs = require("fs");
var nav = fs.readFileSync("src/ch_12_translation.js", "utf8");
var shell = fs.readFileSync("src/ch_16_ui_shell.js", "utf8");
function need(source, token) {
    if (source.indexOf(token) < 0) { throw new Error(token); }
}
need(nav, "function systemBackInputFamily(reason)");
need(nav, 'reason === "predictive_back"');
need(nav, 'return "legacy_key";');
need(nav, "sourceFamily: systemBackInputFamily(reason)");
need(nav, "sourceReason: String(reason || \"system_back\")");
need(nav, "if (shell.pageId && ClipHub.UIShell");
need(nav, "navState.lastBackReason, request");
if (nav.indexOf("if (shell.childAttached === true && ClipHub.UIShell") >= 0) {
    throw new Error("Home Back still bypasses BackDispatcher");
}
need(shell, 'lastBackSourceFamily = normalizeId(value.sourceFamily || "")');
need(shell, "function executeRootBehavior(contract, reason)");
need(shell, 'behavior !== "close_host"');
need(shell, "ClipHub.App.hideUi(");
need(shell, 'lastBackOutcome = handled ? "root_handled" : "root_unhandled"');
need(shell, 'rootBehavior: "close_host"');
var callbackStart = nav.indexOf("function callbackFor(entry)");
var callbackEnd = nav.indexOf("function makeFocusable(entry)", callbackStart);
var callback = nav.substring(callbackStart, callbackEnd);
var started = callback.indexOf("onBackStarted: function");
var progressed = callback.indexOf("onBackProgressed: function");
var cancelled = callback.indexOf("onBackCancelled: function");
var invoked = callback.indexOf("onBackInvoked: function");
if (!(started >= 0 && progressed > started && cancelled > progressed && invoked > cancelled)) {
    throw new Error("Predictive Back phase order missing");
}
var preCommit = callback.substring(started, invoked);
if (preCommit.indexOf("dispatchBack(entry.owner") >= 0 ||
        preCommit.indexOf("Navigator.pop") >= 0 ||
        preCommit.indexOf("PageStack.pop") >= 0) {
    throw new Error("Predictive start/progress/cancel mutates navigation");
}
need(callback.substring(invoked), 'dispatchBack(entry.owner, "predictive_back")');
console.log("Navigation Stage 10 source/root Back: passed");
