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
var hit = functionBody(source, "tokenAtRawPoint");
var surface = functionBody(source, "renderTokenizerSurface");
var header = functionBody(source, "buildHeader");
var segment = functionBody(source, "buildSegment");
var top = functionBody(source, "makeTokenizerTopActions");
var toolbar = functionBody(source, "buildToolbar");
var cell = functionBody(source, "makeToolbarCell");
var click = functionBody(source, "performToolbarClick");
if (source.indexOf("MODULE_VERSION: 16") < 0) { throw new Error("TokenizerUI v16 missing"); }
if (source.indexOf("tokenizer_chip_layout_cleanup_v1") < 0) { throw new Error("chip cleanup marker missing"); }
if (source.indexOf("tokenizer_previous_top_layout_v1") < 0 ||
        header.indexOf("back.setVisibility(View.GONE)") < 0 ||
        header.indexOf("title.setVisibility(View.INVISIBLE)") < 0) {
    throw new Error("previous top layout not restored");
}
if (segment.indexOf("makeTokenizerTopActions") >= 0 ||
        segment.indexOf("editorEmbeddedInPrimary") >= 0) {
    throw new Error("compact segment/action merge remains");
}
if (top.indexOf("关闭分词") < 0 || top.indexOf("返回编辑页") < 0 ||
        top.indexOf("dispatchTokenizerBack") < 0 ||
        top.indexOf("规则") >= 0 || top.indexOf("帮助") >= 0) {
    throw new Error("top controls were not cleaned to context navigation");
}
var requiredActions = ["copy", "input", "edit", "export", "back"];
var actionIndex;
var action;
for (actionIndex = 0; actionIndex < requiredActions.length; actionIndex += 1) {
    action = requiredActions[actionIndex];
    if (toolbar.indexOf('"' + action + '"') < 0) {
        throw new Error("toolbar action missing: " + action);
    }
}
if (toolbar.indexOf('"清空"') >= 0 || toolbar.indexOf('"clear"') >= 0 ||
        click.indexOf("clear: true") >= 0) {
    throw new Error("destructive clear toolbar contract remains");
}
if (cell.indexOf('String(action) === "back"') < 0 ||
        click.indexOf('action === "back"') < 0) {
    throw new Error("toolbar back/close dispatch missing");
}
if (build.indexOf("/^\\s*$/.test") < 0 || build.indexOf("view.setVisibility(View.GONE)") < 0 ||
        reflow.indexOf("view.getVisibility() !== View.VISIBLE") < 0 ||
        hit.indexOf("view.getVisibility() !== View.VISIBLE") < 0) {
    throw new Error("whitespace token cleanup regressed");
}
if (surface.indexOf("buildIndicator(pageColumn)") >= 0 ||
        source.indexOf("function buildIndicator(column)") >= 0) {
    throw new Error("static purple indicator regressed");
}
console.log("Tokenizer layout/navigation contract: passed");
