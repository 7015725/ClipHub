var fs = require("fs");
var source = fs.readFileSync("src/ch_10_editor.js", "utf8");
function section(name) {
    var start = source.indexOf("function " + name + "(");
    var next;
    if (start < 0) { throw new Error("missing function: " + name); }
    next = source.indexOf("\n    function ", start + 10);
    return source.substring(start, next < 0 ? source.length : next);
}
var rearm = section("rearmSystemBackAfterImeHide");
var handoff = section("handoffEditorFocusAfterImeHide");
var rearmCalls = handoff.match(/rearmSystemBackAfterImeHide\(\)/g) || [];
if (rearm.indexOf("!state.attached || state.keyboardVisible") < 0 ||
        rearm.indexOf('state.mode === "tags"') < 0 ||
        rearm.indexOf("ClipHub.Navigation") < 0 ||
        rearm.indexOf("refreshSystemBackCapture") < 0) {
    throw new Error("IME-hidden system Back rearm guard missing");
}
if (rearmCalls.length !== 2 ||
        handoff.indexOf("}, 80, true);") < 0 ||
        handoff.indexOf("}, 220, true);") < 0) {
    throw new Error("IME-hidden dual rearm timing contract regressed");
}
if (!/if\s*\(keyboardWasVisible\)\s*\{\s*handoffEditorFocusAfterImeHide\(\);/.test(source)) {
    throw new Error("IME visible-to-hidden handoff trigger missing");
}
if (source.indexOf("OnBackInvokedCallback") >= 0 ||
        source.indexOf("OnBackAnimationCallback") >= 0) {
    throw new Error("Editor must not install a competing Android Back callback");
}
console.log("Editor IME Back rearm contract: passed");
