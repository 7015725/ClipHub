var fs = require("fs");
var nav = fs.readFileSync("src/ch_12_translation.js", "utf8");
var editor = fs.readFileSync("src/ch_10_editor.js", "utf8");
var shell = fs.readFileSync("src/ch_16_ui_shell.js", "utf8");
function need(source, token, message) {
    if (source.indexOf(token) < 0) {
        throw new Error(message + ": " + token);
    }
}
need(nav, "function detectBackCapability(context)", "capability owner missing");
need(nav, "WindowOnBackInvokedDispatcher", "runtime predictive detection missing");
need(nav, 'backMode: "uninitialized"', "back mode SSOT missing");
need(nav, '"legacy_key"', "legacy fallback missing");
need(nav, "navState.predictiveBackEnabled", "predictive gate missing");
need(nav, "resolveBackFocusRoot", "back focus root contract missing");
need(nav, "handoffBackFocus", "focus handoff API missing");
need(nav, "getBackCapability", "capability API missing");
need(editor, "function editorBackFocusRoot()", "editor focus adapter missing");
need(editor, "panelPageRoot.getRootView()", "embedded primary root fallback missing");
need(editor, "editorBackFocusRoot();", "editor handoff does not use contract root");
if (editor.indexOf("OnBackInvokedCallback") >= 0 ||
        editor.indexOf("OnBackAnimationCallback") >= 0) {
    throw new Error("page must not own Android Back callbacks");
}
need(shell, "function mountPage(pageId, view, options)", "UIShell mount owner missing");
need(shell, "function dispatchBack(reason, request)", "UIShell back owner missing");
console.log("ShortX Navigation Contract v1: passed");
