var fs = require("fs");
var zlib = require("zlib");
var loader = fs.readFileSync("src/ch_17_tokenizer_ui.js", "utf8");
var match = loader.match(/var PACKED_B64\s*=\s*([\s\S]*?)\n\s*;/);
var chunks = [], item, reChunk = /"([A-Za-z0-9+/=]+)"/g;
if (!match) { throw new Error("PACKED_B64 missing"); }
while ((item = reChunk.exec(match[1])) !== null) { chunks.push(item[1]); }
var source = zlib.gunzipSync(Buffer.from(chunks.join(""), "base64")).toString("utf8");
var start = source.indexOf("function buildSourceTextContent(");
var end = source.indexOf("\n    function ", start + 10);
var body = source.substring(start, end < 0 ? source.length : end);
if (start < 0) { throw new Error("buildSourceTextContent missing"); }
if (source.indexOf("MODULE_VERSION: 27") < 0) { throw new Error("TokenizerUI v26 missing"); }
if (body.indexOf("ScrollView.LayoutParams") >= 0) { throw new Error("Rhino-unsafe ScrollView.LayoutParams remains"); }
if (body.indexOf("new FrameLayout.LayoutParams(") < 0) { throw new Error("FrameLayout.LayoutParams constructor missing"); }
if (body.indexOf("ViewGroup.LayoutParams.MATCH_PARENT") < 0 || body.indexOf("ViewGroup.LayoutParams.WRAP_CONTENT") < 0) { throw new Error("ViewGroup LayoutParams constants missing"); }
console.log("Tokenizer source render LayoutParams contract: passed");
