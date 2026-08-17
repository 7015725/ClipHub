var fs = require("fs");
var zlib = require("zlib");

function expanded(path) {
    var loader = fs.readFileSync(path, "utf8");
    var match = loader.match(/var PACKED_B64\s*=\s*([\s\S]*?)\n\s*;/);
    var chunks = [];
    var reChunk = /"([A-Za-z0-9+/=]+)"/g;
    var item;
    if (!match) { return loader; }
    while ((item = reChunk.exec(match[1])) !== null) { chunks.push(item[1]); }
    return zlib.gunzipSync(Buffer.from(chunks.join(""), "base64")).toString("utf8");
}

function functionBody(source, name) {
    var marker = "function " + name + "(";
    var start = source.indexOf(marker);
    var brace;
    var index;
    var depth = 0;
    var quote = null;
    var escaped = false;
    var ch;
    if (start < 0) { throw new Error("missing function: " + name); }
    brace = source.indexOf("{", start);
    if (brace < 0) { throw new Error("missing function body: " + name); }
    for (index = brace; index < source.length; index += 1) {
        ch = source.charAt(index);
        if (quote !== null) {
            if (escaped) { escaped = false; }
            else if (ch === "\\") { escaped = true; }
            else if (ch === quote) { quote = null; }
            continue;
        }
        if (ch === "\"" || ch === "'") { quote = ch; continue; }
        if (ch === "{") { depth += 1; }
        else if (ch === "}") {
            depth -= 1;
            if (depth === 0) { return source.substring(start, index + 1); }
        }
    }
    throw new Error("unterminated function: " + name);
}

function requireText(source, value, label) {
    if (source.indexOf(value) < 0) {
        throw new Error(label + " missing: " + value);
    }
}

function requireOrder(source, values, label) {
    var last = -1;
    var index;
    var at;
    for (index = 0; index < values.length; index += 1) {
        at = source.indexOf(values[index]);
        if (at < 0) { throw new Error(label + " missing: " + values[index]); }
        if (at <= last) { throw new Error(label + " order changed at: " + values[index]); }
        last = at;
    }
}

var settings = expanded("src/ch_13_settings.js");
var tokenizer = expanded("src/ch_17_tokenizer_ui.js");
var editor = expanded("src/ch_10_editor.js");
var filter = expanded("src/ch_11_filter.js");
var settingsBack = functionBody(settings, "handleSettingsBack");
var settingsPath = functionBody(settings, "settingsShellPath");
var tokenizerBack = functionBody(tokenizer, "dispatchTokenizerBack");
var tokenizerReturn = functionBody(tokenizer, "returnToEditor");
var tokenizerSync = functionBody(tokenizer, "syncTokenizerShell");
var editorBack = functionBody(editor, "requestExit");
var filterBack = functionBody(filter, "handleBack");

requireOrder(settingsBack, [
    "if (ime.visible)",
    'settingsPage === "regex_test"',
    'settingsPage === "regex_editor"',
    'settingsPage === "regex_rules"',
    'return closePage("managed_back")'
], "settings Back priority");
requireText(settingsBack, 'settingsPage = "regex_editor";', "regex test parent");
requireText(settingsBack, 'settingsPage = "regex_rules";', "regex editor parent");
requireText(settingsBack, 'settingsPage = "root";', "regex rules parent");
requireText(settingsBack, 'cancelRegexTest("managed_back")', "regex test cancel");
requireText(settingsPath,
    'return ["settings", "regex_rules", "regex_editor", "regex_test"]',
    "regex test shell path");
requireText(settingsPath,
    'return ["settings", "regex_rules", "regex_editor"]',
    "regex editor shell path");
requireText(settingsPath,
    'return ["settings", "regex_rules"]',
    "regex rules shell path");
requireText(settingsPath, 'return ["settings"]', "settings root shell path");

requireOrder(tokenizerBack, [
    'state.tokenizerOverlay === "rule_editor"',
    'returnToTokenizerRulesDrawer',
    'state.tokenizerOverlay === "rules"',
    'closeTokenizerRulesDrawer',
    'return returnToEditor'
], "tokenizer Back priority");
requireText(tokenizerReturn,
    'var returnHome = tokenizerLaunchOrigin === "home";',
    "tokenizer home origin");
requireText(tokenizerReturn,
    'ClipHub.Editor.requestExit("tokenizer_home_back")',
    "tokenizer home return");
requireText(tokenizerReturn,
    'syncTokenizerShell("editor"',
    "tokenizer editor return");
requireText(tokenizerSync,
    'showBack: tokenizerPage ? tokenizerLaunchOrigin !== "home" : true',
    "tokenizer header Back visibility");

requireOrder(editorBack, [
    "transientTextSession !== null",
    "exitConfirmOverlay !== null",
    'state.mode === "tags"',
    "hasEditorUnsavedChanges()",
    'closePanel("clean_exit")'
], "editor Back priority");

requireOrder(filterBack, [
    "if (advancedVisible)",
    "if (searchExpanded)",
    "closePanel({"
], "filter Back priority");
requireText(filterBack, 'state.lastBackLayer = "advanced_drawer"',
    "filter drawer Back");

console.log("Child Back route contract: passed");
