var fs = require("fs");
var shell = fs.readFileSync("src/ch_16_ui_shell.js", "utf8");
var nav = fs.readFileSync("src/ch_12_translation.js", "utf8");
var ids = ["home", "detail", "editor", "tags", "settings", "regex_rules", "regex_editor", "regex_test", "translation", "tokenizer", "tokenizer_rules", "tokenizer_rule_editor"];
var baselineMax = {home:18, detail:11, editor:17, tags:7, settings:19, regex_rules:2, regex_editor:2, regex_test:1, translation:13, tokenizer:8, tokenizer_rules:2, tokenizer_rule_editor:1};
var coreFunctions = ["isSameShellFamily", "canEmbed", "pageStackPush", "pageStackPop", "pageStackReplace", "navigatorPush", "navigatorPop", "navigatorReplace", "backDispatcherDispatch", "predictiveBackSnapshot", "beginPredictiveBack", "progressPredictiveBack", "cancelPredictiveBack", "commitPredictiveBack"];
function block(source, name) {
    var start = source.indexOf("function " + name + "(");
    var end;
    if (start < 0) { throw new Error("missing core function " + name); }
    end = source.indexOf("\n    function ", start + 10);
    if (end < 0) { end = source.indexOf("\nfunction ", start + 10); }
    return source.substring(start, end < 0 ? source.length : end);
}
coreFunctions.forEach(function (name) {
    var source = block(shell, name);
    ids.forEach(function (id) {
        if (source.indexOf('"' + id + '"') >= 0) {
            throw new Error("Navigation core hardcodes business page id " + id + " in " + name);
        }
    });
});
var counts = {};
ids.forEach(function (id) {
    var re = new RegExp('\\"' + id + '\\"', 'g');
    counts[id] = (shell.match(re) || []).length + (nav.match(re) || []).length;
    if (counts[id] > baselineMax[id]) {
        throw new Error("legacy/core business page-id count grew for " + id + ": " + counts[id] + " > " + baselineMax[id]);
    }
});
console.log(JSON.stringify({status:"passed", coreBusinessPageIds:0, legacyCompatibilityFrozen:true, counts:counts}));
