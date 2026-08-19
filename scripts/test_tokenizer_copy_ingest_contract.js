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
var clipboard = expanded("src/ch_04_clipboard.js");
var tokenizer = expanded("src/ch_17_tokenizer_ui.js");
var writeText = body(clipboard, "writeText");
var handle = body(clipboard, "handlePrimaryClipChangedUnlocked");
var recordText = body(clipboard, "recordText");
var recordManual = body(clipboard, "recordManualText");
var copyAndRecord = body(clipboard, "copyAndRecordText");
var selectedOriginal = body(tokenizer, "getSelectedOriginalText");
var sharedCopy = body(tokenizer, "copyTokenizerSelectionToHome");
var toolbar = body(tokenizer, "performToolbarClick");
var popup = body(tokenizer, "performPopupActionClick");
var popupView = body(tokenizer, "makePopupAction");
if (clipboard.indexOf('MODULE_VERSION: 10') < 0 || tokenizer.indexOf('MODULE_VERSION: 30') < 0) {
    throw new Error("copy ingest module versions missing");
}
if (writeText.indexOf("markOwnWrite(hash") < 0 ||
        handle.indexOf("state.ownWrite.consumed !== true") < 0 ||
        handle.indexOf('status: "own_write_suppressed"') < 0) {
    throw new Error("one-shot own-write suppression contract missing");
}
if (recordText.indexOf("getLatestActiveItemByHash(hash)") < 0 ||
        recordText.indexOf("Repository.updateItem") < 0 ||
        recordText.indexOf("Repository.insertItem") < 0) {
    throw new Error("standard duplicate/insert record path missing");
}
if (recordManual.indexOf("processingLock.lock()") < 0 ||
        recordManual.indexOf("recordText(text, hash") < 0 ||
        recordManual.indexOf('emit(result.inserted ? "clipboard_added" : "clipboard_merged"') < 0 ||
        recordManual.indexOf("processingLock.unlock()") < 0) {
    throw new Error("manual ingest must reuse serialized standard record/event path");
}
if (copyAndRecord.indexOf("writeText(text") < 0 ||
        copyAndRecord.indexOf("recordManualText(text") < 0 ||
        clipboard.indexOf("copyAndRecordText: copyAndRecordText") < 0) {
    throw new Error("atomic copy-and-record Clipboard API missing");
}
if (selectedOriginal.indexOf("selectedOriginalTextFromIndexes()") < 0 ||
        tokenizer.indexOf("function selectedOriginalTextFromIndexes()") < 0 ||
        tokenizer.indexOf("state.selectedIndexes") < 0) {
    throw new Error("selected copy must follow exact selected token indexes");
}
if (sharedCopy.indexOf("tokenizer_selection_copy_ingest_v1") < 0 ||
        sharedCopy.indexOf("ClipHub.Clipboard.copyAndRecordText") < 0 ||
        sharedCopy.indexOf('sourcePackage: "tokenizer"') < 0 ||
        sharedCopy.indexOf('sourceLabel: "分词"') < 0 ||
        sharedCopy.indexOf("haptic: false") >= 0) {
    throw new Error("tokenizer shared copy-and-ingest contract missing");
}
if (toolbar.indexOf("getSelectedOriginalText()") < 0 ||
        toolbar.indexOf('copyTokenizerSelectionToHome(text, "tokenizer_toolbar_copy")') < 0) {
    throw new Error("bottom copy must use shared selected-copy ingest");
}
if (popup.indexOf('action === "copy"') < 0 ||
        popup.indexOf("getSelectedOriginalText()") < 0 ||
        popup.indexOf('copyTokenizerSelectionToHome(text, "tokenizer_long_press_copy")') < 0) {
    throw new Error("long-press copy must use shared selected-copy ingest");
}
if (popupView.indexOf("performPopupActionClick(action)") < 0 ||
        popupView.indexOf('emitAction(action') >= 0) {
    throw new Error("popup UI must route through popup action dispatcher");
}
if (toolbar.indexOf("invalidateSelection") >= 0 || popup.indexOf("invalidateSelection") >= 0 ||
        sharedCopy.indexOf("invalidateSelection") >= 0) {
    throw new Error("copy must preserve selection");
}
console.log("Tokenizer copy ingest contract: passed");
