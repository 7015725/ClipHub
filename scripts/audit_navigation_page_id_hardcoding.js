var fs = require("fs");
var shell = fs.readFileSync("src/ch_16_ui_shell.js", "utf8");
var nav = fs.readFileSync("src/ch_12_translation.js", "utf8");
var tokens = ["home", "detail", "editor", "tags", "settings", "regex_rules", "regex_editor", "regex_test", "translation", "tokenizer", "tokenizer_rules", "tokenizer_rule_editor"];
var result = {};
tokens.forEach(function (id) {
    var re = new RegExp('\\"' + id + '\\"', 'g');
    result[id] = (shell.match(re) || []).length + (nav.match(re) || []).length;
});
console.log(JSON.stringify(result));
