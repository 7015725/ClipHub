var fs = require("fs");
var vm = require("vm");
var zlib = require("zlib");
function expanded(path) {
    var loader = fs.readFileSync(path, "utf8");
    var match = loader.match(/var PACKED_B64\s*=\s*([\s\S]*?)\n\s*;/);
    var chunks = [];
    var reChunk = /"([A-Za-z0-9+/=]+)"/g;
    var item;
    if (!match) { throw new Error("PACKED_B64 missing"); }
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
var names = [
    "indexSelected", "isSelectableTokenIndex", "isCurrentSelectionValid",
    "invalidateSelection", "applySelectionIndexes", "applySelectionTokenRange",
    "setTokenSelected", "toggleToken", "selectedIndexesKey",
    "selectedOriginalTextFromIndexes", "getSelectedOriginalText"
];
var code = names.map(function (name) { return body(source, name); }).join("\n");
var context = {
    state: {
        presentationState: "tokens",
        resultGeneration: 1,
        selectionGeneration: 1,
        selectedIndexes: [],
        selectionStart: -1,
        selectionEnd: -1,
        sourceText: "A B C",
        tokens: [
            { text: "A", start: 0, end: 1 },
            { text: " ", start: 1, end: 2 },
            { text: "B", start: 2, end: 3 },
            { text: " ", start: 3, end: 4 },
            { text: "C", start: 4, end: 5 }
        ]
    },
    tokenViews: [],
    actionDraft: null,
    invalidateActionDraft: function () { context.actionDraft = null; },
    applyTokenStyle: function () { return true; },
    updateStatsViews: function () { return true; },
    updateToolbarActionState: function () { return true; },
    isFinite: isFinite,
    Math: Math,
    Number: Number,
    String: String
};
vm.createContext(context);
vm.runInContext(code, context);
function expectIndexes(values) {
    var actual = JSON.stringify(context.state.selectedIndexes);
    var expected = JSON.stringify(values);
    if (actual !== expected) { throw new Error("selectedIndexes " + actual + " != " + expected); }
}
context.toggleToken(0);
expectIndexes([0]);
if (context.getSelectedOriginalText() !== "A") { throw new Error("single tap select failed"); }
context.toggleToken(2);
expectIndexes([0, 2]);
if (context.getSelectedOriginalText() !== "A B") { throw new Error("multi-select whitespace preservation failed"); }
context.toggleToken(0);
expectIndexes([2]);
if (context.getSelectedOriginalText() !== "B") { throw new Error("reverse toggle deselect failed"); }
context.toggleToken(4);
expectIndexes([2, 4]);
if (context.getSelectedOriginalText() !== "B C") { throw new Error("second multi-select failed"); }
context.toggleToken(2);
expectIndexes([4]);
context.toggleToken(4);
expectIndexes([]);
if (context.getSelectedOriginalText() !== "") { throw new Error("last deselect failed"); }
context.toggleToken(0);
context.toggleToken(4);
expectIndexes([0, 4]);
if (context.getSelectedOriginalText() !== "AC") { throw new Error("deselected middle token leaked into action text"); }
context.applySelectionTokenRange(0, 4);
expectIndexes([0, 2, 4]);
if (context.getSelectedOriginalText() !== "A B C") { throw new Error("drag range selection regressed"); }
if (source.indexOf("tokenizer_click_toggle_multiselect_v1") < 0 ||
        source.indexOf("return setTokenSelected(numeric, !indexSelected(numeric));") < 0) {
    throw new Error("toggle selection marker missing");
}
console.log("Tokenizer toggle selection contract: passed");
