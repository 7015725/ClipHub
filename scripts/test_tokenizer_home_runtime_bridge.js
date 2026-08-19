var fs = require("fs");
var vm = require("vm");
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

function extractFunction(source, name) {
    var marker = "function " + name + "(";
    var start = source.indexOf(marker);
    var brace;
    var i;
    var depth = 0;
    var quote = null;
    var escaped = false;
    if (start < 0) { throw new Error("missing function: " + name); }
    brace = source.indexOf("{", start);
    if (brace < 0) { throw new Error("missing body: " + name); }
    for (i = brace; i < source.length; i += 1) {
        var ch = source.charAt(i);
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
            if (depth === 0) { return source.substring(start, i + 1); }
        }
    }
    throw new Error("unterminated function: " + name);
}

var source = expanded("src/ch_17_tokenizer_ui.js");
if (source.indexOf("runOnMainSync(") >= 0) {
    throw new Error("foreign runOnMainSync reference remains");
}
var names = [
    "isTokenizerMainThread",
    "runTokenizerOnMainSync",
    "editorReadyForHomeTokenizer",
    "scheduleHomeTokenizerMount",
    "recoverStaleHomeTokenizerMount",
    "openFromHomeItem"
];
var functionSource = names.map(function (name) {
    return extractFunction(source, name);
}).join("\n");
var harness = [
    "var ready = true;",
    "var state = { mounted: false, lastError: null };",
    "var editorPanelRoot = {};",
    "var homeLaunchGeneration = 0;",
    "var staleDiscardCount = 0;",
    "var shellState = { currentPageId: 'tokenizer', childAttached: true };",
    "var mainHandler = { post: function () { return true; }, removeCallbacks: function () {} };",
    "var mountedCount = 0;",
    "var scheduledId = null;",
    "var emitted = 0;",
    "var editorState = { ready: true, open: true, attached: true, closing: false, removalPending: false, itemId: 42 };",
    "var ClipHub = { UIShell: { getState: function () { return shellState; } }, Editor: {",
    "  openItem: function (id, options) { scheduledId = Number(id); return { ok: true, attached: true }; },",
    "  getState: function () { return editorState; }",
    "} };",
    "var Packages = {",
    " android: { os: {",
    "  Build: { VERSION: { SDK_INT: 34 } },",
    "  Looper: { getMainLooper: function () { return { isCurrentThread: function () { return true; }, getThread: function () { return { getId: function () { return 1; } }; } }; } }",
    " } },",
    " java: { lang: {",
    "  Thread: { currentThread: function () { return { getId: function () { return 1; } }; } },",
    "  Runnable: function (value) { return value; }",
    " }, util: { concurrent: {",
    "  CountDownLatch: function () { return { countDown: function () {}, await: function () { return true; } }; },",
    "  TimeUnit: { MILLISECONDS: {} }",
    " } } }",
    "};",
    "function mountFromEditor() { mountedCount += 1; state.mounted = true; return true; }",
    "function discardMountedPage() { staleDiscardCount += 1; state.mounted = false; return true; }",
    "function emitAction() { emitted += 1; }",
    "function failHomeTokenizerLaunch(generation, reason) { state.lastError = String(reason); return false; }",
    functionSource,
    "if (editorReadyForHomeTokenizer(42) !== true) { throw new Error('ready editor rejected'); }",
    "editorState.removalPending = true; if (editorReadyForHomeTokenizer(42) !== false) { throw new Error('pending editor accepted'); }",
    "editorState.removalPending = false; editorState.attached = false; if (editorReadyForHomeTokenizer(42) !== false) { throw new Error('detached editor accepted'); }",
    "editorState.attached = true; editorState.itemId = 41; if (editorReadyForHomeTokenizer(42) !== false) { throw new Error('wrong item accepted'); }",
    "editorState.itemId = 42;",
    "var result = runTokenizerOnMainSync(function () { return openFromHomeItem(42, { origin: 'runtime_test' }); }, 2500);",
    "if (!result || result.ok !== true || result.value !== true) { throw new Error('main dispatch failed'); }",
    "if (scheduledId !== 42 || mountedCount !== 1 || emitted !== 1) { throw new Error('home launch chain incomplete'); }",
    "if (openFromHomeItem(42, { origin: 'mounted_guard_test' }) !== false || staleDiscardCount !== 0) { throw new Error('live mounted tokenizer must reject duplicate home launch'); }",
    "shellState = { currentPageId: 'home', childAttached: false };",
    "if (openFromHomeItem(42, { origin: 'stale_recovery_test' }) !== true) { throw new Error('stale home mount did not recover'); }",
    "if (staleDiscardCount !== 1 || mountedCount !== 2 || emitted !== 2) { throw new Error('stale home recovery chain incomplete'); }"
].join("\n");
vm.runInNewContext(harness, { Error: Error, Math: Math, Number: Number, String: String, isFinite: isFinite });
console.log("Tokenizer home runtime bridge: passed");
