var fs = require("fs");
var source = fs.readFileSync("src/ch_10_editor.js", "utf8");
function section(name) {
    var start = source.indexOf("function " + name + "(");
    var next;
    if (start < 0) { throw new Error("missing function: " + name); }
    next = source.indexOf("\n    function ", start + 10);
    return source.substring(start, next < 0 ? source.length : next);
}
var begin = section("beginTransientTextSessionOnMain");
var complete = section("completeTransientTextSession");
var save = section("saveFromInput");
var bind = section("bindTokenizerToEditor");
var exit = section("requestExit");
if (source.indexOf("MODULE_VERSION: 37") < 0 || source.indexOf('openPanel("transient"') >= 0) {
    throw new Error("Editor transient mode boundary regressed");
}
if (begin.indexOf("Repository.") >= 0 || complete.indexOf("Repository.") >= 0) {
    throw new Error("transient session must not write Repository");
}
if (save.indexOf("completeTransientTextSession(true)") < 0 ||
        save.indexOf("completeTransientTextSession(true)") > save.indexOf("Repository.saveItemWithTags")) {
    throw new Error("transient save is not intercepted before Repository");
}
if (bind.indexOf("transientTextSession !== null") < 0 ||
        exit.indexOf("completeTransientTextSession(false)") < 0) {
    throw new Error("transient bind/back guard missing");
}
if (source.indexOf("beginTransientTextSession:") < 0 ||
        source.indexOf("cancelTransientTextSession:") < 0) {
    throw new Error("Editor transient public adapter missing");
}
console.log("Editor transient contract: passed");
