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

function requireText(source, value) {
    if (source.indexOf(value) < 0) { throw new Error("missing: " + value); }
}

var filter = expanded("src/ch_11_filter.js");
var tokenizer = expanded("src/ch_17_tokenizer_ui.js");
var swipe;
var card;
requireText(filter, "tokenizer_home_long_press_v1");
requireText(filter, "function openTokenizerForResultRow(row, origin)");
requireText(filter, "View.OnLongClickListener");
requireText(filter, "TokenizerUI.openFromHomeItem");
requireText(filter, "MODULE_VERSION: 91");
requireText(filter, "tokenizer_home_long_press_guard_v1");
requireText(filter, "primary_host_panel_attached_fix_v1");
requireText(tokenizer, "tokenizer_home_direct_open_v3");
requireText(tokenizer, "function openFromHomeItem(itemId, options)");
requireText(tokenizer, "function scheduleHomeTokenizerMount(itemId, origin, generation, attempt)");
requireText(tokenizer, "function runTokenizerOnMainSync(callback, timeoutMs)");
requireText(tokenizer, "function editorReadyForHomeTokenizer(itemId)");
requireText(tokenizer, "editorState.removalPending === true");
requireText(tokenizer, "editorState.attached !== true");
requireText(tokenizer, "Math.floor(Number(editorState.itemId)) !== expectedId");
requireText(tokenizer, "attempt >= 10");
requireText(tokenizer, "result.value === true");
requireText(tokenizer, "ClipHub.Editor.openItem(id, { requestKeyboard: false })");
requireText(tokenizer, "tokenizerLaunchOrigin = String(options.origin || \"editor\")");
requireText(tokenizer, "ClipHub.Editor.requestExit(\"tokenizer_home_back\")");
requireText(tokenizer, "openFromHomeItem: function (itemId, options)");
requireText(tokenizer, "MODULE_VERSION: 14");
if (tokenizer.indexOf("runOnMainSync(") >= 0) { throw new Error("foreign runOnMainSync reference remains"); }
swipe = filter.match(/function bindSwipeGesture\([\s\S]*?function resultPreviewText/);
if (!swipe || swipe[0].indexOf("if (!gesture.swiping) { return false; }") < 0) {
    throw new Error("swipe non-capture contract changed");
}
if (swipe[0].indexOf("holder.longPressConsumed = false") < 0) {
    throw new Error("long-press guard ACTION_DOWN reset missing");
}
card = filter.match(/function makeResultCard\([\s\S]*?function updateResultScrollState/);
if (!card || card[0].indexOf("inputResultRow(currentCardHolderRow(holder)") < 0 ||
        card[0].indexOf("bindSwipeGesture(holder, wrapper, card") < 0) {
    throw new Error("card click/swipe contract missing");
}
if (card[0].indexOf("holder.longPressConsumed === true") < 0 ||
        card[0].indexOf("holder.longPressConsumed = true") < 0 ||
        card[0].indexOf("state.resultCardLongPressCount += 1") < 0 ||
        card[0].indexOf("openTokenizerForResultRow(launchRow") < 0 ||
        card[0].indexOf("card.post(new Packages.java.lang.Runnable") >= 0) {
    throw new Error("long-press consumption guard contract missing");
}
var hostStart = filter.indexOf("function getPrimaryHostState()");
var hostEnd = filter.indexOf("function mountPrimaryChildPage", hostStart);
var primaryHost = hostStart >= 0 && hostEnd > hostStart ?
    filter.substring(hostStart, hostEnd) : "";
if (primaryHost.indexOf("state.panelAttached === true") < 0 ||
        primaryHost.indexOf("state.attached") >= 0) {
    throw new Error("primary host attached state contract invalid");
}
console.log("Tokenizer home long-press contract: passed");
