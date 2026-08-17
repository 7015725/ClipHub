var fs = require("fs");
var zlib = require("zlib");
function expanded(path) {
    var loader = fs.readFileSync(path, "utf8");
    var match = loader.match(/var PACKED_B64\s*=\s*([\s\S]*?)\n\s*;/);
    var chunks = [];
    var reChunk = /"([A-Za-z0-9+/=]+)"/g;
    var item;
    if (!match) { throw new Error("PACKED_B64 missing: " + path); }
    while ((item = reChunk.exec(match[1])) !== null) { chunks.push(item[1]); }
    return zlib.gunzipSync(Buffer.from(chunks.join(""), "base64")).toString("utf8");
}
function body(source, name) {
    var start = source.indexOf("function " + name + "(");
    var index;
    var depth = 0;
    var quote = null;
    var escaped = false;
    var brace;
    if (start < 0) { throw new Error("missing function: " + name); }
    brace = source.indexOf("{", start);
    for (index = brace; index < source.length; index += 1) {
        var c = source.charAt(index);
        if (quote !== null) {
            if (escaped) { escaped = false; }
            else if (c === "\\") { escaped = true; }
            else if (c === quote) { quote = null; }
            continue;
        }
        if (c === "\"" || c === "'") { quote = c; continue; }
        if (c === "{") { depth += 1; }
        else if (c === "}") {
            depth -= 1;
            if (depth === 0) { return source.substring(start, index + 1); }
        }
    }
    throw new Error("unterminated function: " + name);
}

var filter = expanded("src/ch_11_filter.js");
var tokenizer = expanded("src/ch_17_tokenizer_ui.js");
var inputRow = body(filter, "inputResultRow");
var sharedInput = body(filter, "inputTextToFocusedTargetOnMain");
var toolbar = body(tokenizer, "performToolbarClick");
if (filter.indexOf("MODULE_VERSION: 95") < 0 ||
        filter.indexOf("inputTextToFocusedTarget: inputTextToFocusedTarget") < 0) {
    throw new Error("shared input public adapter missing");
}
if (inputRow.indexOf("inputTextToFocusedTargetOnMain") < 0 ||
        sharedInput.indexOf("scheduleInputAttempt") < 0 || sharedInput.indexOf("closePanel") < 0) {
    throw new Error("homepage input was not routed through shared text input helper");
}
if (toolbar.indexOf("ClipHub.Filter.inputTextToFocusedTarget") < 0 ||
        tokenizer.indexOf("InputText.newBuilder") >= 0) {
    throw new Error("Tokenizer did not reuse shared input helper");
}
console.log("Shared input action contract: passed");