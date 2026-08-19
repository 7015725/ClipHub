var fs = require("fs");
var shell = fs.readFileSync("src/ch_16_ui_shell.js", "utf8");
function need(token) { if (shell.indexOf(token) < 0) { throw new Error(token); } }
need("function imeVisibleForBack()");
need("WindowInsets.Type.ime()");
need("function consumeImeBackFirst()");
need("hideSoftInputFromWindow(token, 0)");
need("ClipHub.Navigation.handoffBackFocus({");
need('lastBackOutcome = "ime_consumed"');
var start = shell.indexOf("function backDispatcherDispatch(reason, request)");
var end = shell.indexOf("function dispatchBack(reason, request)", start);
var block = shell.substring(start, end);
if (!(block.indexOf("consumeImeBackFirst()") < block.indexOf('typeof activeBack === "function"') &&
      block.indexOf('typeof activeBack === "function"') < block.indexOf("navigatorCanPop()"))) {
    throw new Error("Back order must be IME -> page hook -> pop");
}
console.log("Navigation Stage 5 IME priority: passed");
