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

var tokenizer = expanded("src/ch_17_tokenizer_ui.js");
var theme = fs.readFileSync("src/ch_07_theme.js", "utf8");
var toolbar = body(tokenizer, "buildToolbar");
var cell = body(tokenizer, "makeToolbarCell");
if (theme.indexOf('copy: "ic_remix_file_copy_line"') < 0 ||
        theme.indexOf('input: "ic_remix_login_box_line"') < 0 ||
        theme.indexOf('edit: "ic_remix_edit_line"') < 0) {
    throw new Error("ShortX semantic resource mapping missing");
}
if (theme.indexOf("makeShortXSemanticIconDrawable") < 0 ||
        theme.indexOf("decorateSemanticPanelIcon") < 0 ||
        cell.indexOf("decorateSemanticPanelIcon") < 0) {
    throw new Error("semantic drawable API contract missing");
}
if (toolbar.indexOf("▣") >= 0 || toolbar.indexOf("↵") >= 0 || toolbar.indexOf("✎") >= 0 ||
        cell.indexOf("▣") >= 0 || cell.indexOf("↵") >= 0 || cell.indexOf("✎") >= 0) {
    throw new Error("Unicode toolbar icon fallback remains");
}
console.log("Tokenizer icon contract: passed");
