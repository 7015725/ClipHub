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

function functionBody(source, name) {
    var start = source.indexOf("function " + name + "(");
    var next;
    if (start < 0) { throw new Error("missing function: " + name); }
    next = source.indexOf("\n    function ", start + 10);
    return source.substring(start, next < 0 ? source.length : next);
}

var source = expanded("src/ch_17_tokenizer_ui.js");
var build = functionBody(source, "buildTokenView");
var reflow = functionBody(source, "reflowTokens");
var surface = functionBody(source, "renderTokenizerSurface");
var hit = functionBody(source, "tokenAtRawPoint");
if (source.indexOf("MODULE_VERSION: 14") < 0) { throw new Error("TokenizerUI v14 missing"); }
if (source.indexOf("tokenizer_chip_layout_cleanup_v1") < 0) { throw new Error("layout marker missing"); }
if (build.indexOf("/^\\s*$/.test") < 0 || build.indexOf("view.setVisibility(View.GONE)") < 0 ||
        build.indexOf("view.setClickable(false)") < 0) {
    throw new Error("whitespace token visual suppression missing");
}
if (reflow.indexOf("view.getVisibility() !== View.VISIBLE") < 0) {
    throw new Error("reflow does not skip hidden whitespace tokens");
}
if (hit.indexOf("view.getVisibility() !== View.VISIBLE") < 0) {
    throw new Error("hit testing does not skip hidden tokens");
}
if (surface.indexOf("buildIndicator(pageColumn)") >= 0 ||
        source.indexOf("function buildIndicator(column)") >= 0) {
    throw new Error("static purple indicator remains");
}
if (surface.indexOf("buildDivider(pageColumn)") < 0 ||
        surface.indexOf("buildToolbar(pageColumn)") < 0 ||
        surface.indexOf("buildHint(pageColumn)") < 0) {
    throw new Error("bottom action chrome changed unexpectedly");
}
console.log("Tokenizer layout contract: passed");
