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

var source = expanded("src/ch_17_tokenizer_ui.js");
var mount = body(source, "mountFromEditor");
var mode = body(source, "switchMode");
var request = body(source, "requestTokenizerRun");
var apply = body(source, "applyTokenizerRuleSelection");
var toggle = body(source, "toggleTokenizerRuleConfig");
if (source.indexOf('presentationState: "source"') < 0) { throw new Error("source presentation state missing"); }
if (mount.indexOf("tokenizer_open_autorun_normal_v1") < 0 ||
        mount.indexOf('requestTokenizerRun("open")') < 0 ||
        mount.indexOf('presentationState = "source"') >= 0) {
    throw new Error("initial mount must immediately run normal tokenization");
}
if (mode.indexOf('mode === "regex"') < 0 ||
        mode.indexOf('requestTokenizerRun("mode_regex")') < 0 ||
        mode.indexOf('presentationState = "source"') >= 0 ||
        mode.indexOf('requestTokenizerRun("mode_normal")') < 0) {
    throw new Error("normal/regex mode-run contract missing");
}
if (request.indexOf('presentationState = "tokenizing"') < 0 ||
        request.indexOf('generation !== state.requestGeneration') < 0) {
    throw new Error("tokenize generation contract missing");
}
if (toggle.indexOf("requestTokenizerRun") >= 0 || toggle.indexOf("TokenizerService.") >= 0) {
    throw new Error("regex rule toggle must remain draft-only");
}
if (apply.indexOf("setSelectedRuleIds") < 0 || apply.indexOf("requestTokenizerRun") < 0) {
    throw new Error("regex apply commit/run contract missing");
}
console.log("Tokenizer source-state contract: passed");
