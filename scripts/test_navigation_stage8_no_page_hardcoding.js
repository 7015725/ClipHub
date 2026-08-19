var fs = require("fs");
var shell = fs.readFileSync("src/ch_16_ui_shell.js", "utf8");
var ids = ["home", "detail", "editor", "tags", "settings", "regex_rules", "regex_editor", "regex_test", "translation", "tokenizer", "tokenizer_rules", "tokenizer_rule_editor"];
function block(name) {
    var start = shell.indexOf("function " + name + "(");
    if (start < 0) { throw new Error("missing " + name); }
    var end = shell.indexOf("\n    function ", start + 10);
    return shell.substring(start, end < 0 ? shell.length : end);
}
["isSameShellFamily", "canEmbed", "unmountPage", "navigatorPush", "navigatorPop", "backDispatcherDispatch", "predictiveBackSnapshot", "beginPredictiveBack", "progressPredictiveBack", "cancelPredictiveBack", "commitPredictiveBack"].forEach(function (name) {
    var source = block(name);
    ids.forEach(function (id) {
        if (source.indexOf('"' + id + '"') >= 0) {
            throw new Error(name + " hardcodes page id " + id);
        }
    });
});
var family = block("isSameShellFamily");
if (family.indexOf("target.family") < 0 || family.indexOf("current.family") < 0) {
    throw new Error("family routing is not Registry-driven");
}
var embed = block("canEmbed");
if (embed.indexOf("page.contract.host") < 0 || embed.indexOf("page.shellReady") < 0) {
    throw new Error("canEmbed is not PageContract-driven");
}
var unmount = block("unmountPage");
if (unmount.indexOf("requirePage(id).family") < 0 || unmount.indexOf("requirePage(activePageId).family") < 0) {
    throw new Error("unmount family check is not Registry-driven");
}
if (shell.indexOf('page.parentId !== rootPageId()') < 0) {
    throw new Error("mountPage still hardcodes root id");
}
if (shell.indexOf("function runtimePageUsesModule(pageId, moduleName)") < 0 ||
        shell.indexOf("function runtimePageInModuleFamily(pageId, moduleName)") < 0) {
    throw new Error("runtime diagnostics still need page-id family helpers");
}
console.log("Navigation Stage 8 core page-id hardcoding: passed");
