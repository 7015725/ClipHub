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
var normalize = body(source, "normalizeToken");
var range = body(source, "applySelectionTokenRange");
var effective = body(source, "getEffectiveActionText");
var toolbar = body(source, "performToolbarClick");
var request = body(source, "requestTokenizerRun");
var modeSwitch = body(source, "switchMode");
var service = fs.readFileSync("src/ch_19_tokenizer_service.js", "utf8");
var configuredRules = body(service, "configuredRules");
var asyncOptions = body(service, "prepareAsyncOptions");
if (normalize.indexOf("start:") < 0 || normalize.indexOf("end:") < 0) {
    throw new Error("UTF-16 token ranges are not preserved");
}
if (range.indexOf("state.tokens[firstSelectable].start") < 0 ||
        range.indexOf("state.tokens[lastSelectable].end") < 0) {
    throw new Error("selection range does not derive from source offsets");
}
if (effective.indexOf("substring") < 0 || effective.indexOf("selectionStart") < 0 ||
        effective.indexOf("selectionEnd") < 0) {
    throw new Error("action text must use sourceText.substring range truth");
}
if (toolbar.indexOf("ClipHub.Clipboard.writeText") < 0 || toolbar.indexOf("List.copyRow") >= 0 ||
        toolbar.indexOf("inputTextToFocusedTarget") < 0 ||
        toolbar.indexOf("beginTokenizerTransientEdit") < 0) {
    throw new Error("copy/input/edit action dispatch contract missing");
}
if (source.indexOf("actionDraft") < 0 || source.indexOf("selectionGeneration") < 0 ||
        source.indexOf("resultGeneration") < 0 || request.indexOf("requestGeneration") < 0) {
    throw new Error("selection/action generation invalidation contract missing");
}
if (modeSwitch.indexOf("tokenizer_regex_mode_autorun_selected_v1") < 0 ||
        modeSwitch.indexOf('return requestTokenizerRun("mode_regex");') < 0 ||
        modeSwitch.indexOf('cancelTokenizerRun("mode_regex_source")') >= 0 ||
        modeSwitch.indexOf('state.presentationState = "source"') >= 0) {
    throw new Error("regex mode must immediately tokenize with configured selected rules");
}
if (configuredRules.indexOf("selectedRulesForTokenize()") < 0 ||
        asyncOptions.indexOf("configuredRulesJson") < 0 ||
        asyncOptions.indexOf("selectedRuleIdsJson") < 0) {
    throw new Error("regex async request must snapshot persisted selected rules");
}
console.log("Tokenizer action contract: passed");
