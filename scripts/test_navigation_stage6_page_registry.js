var fs = require("fs");
var shell = fs.readFileSync("src/ch_16_ui_shell.js", "utf8");
function need(token) { if (shell.indexOf(token) < 0) { throw new Error(token); } }
need("ClipHub.PageRegistry = {");
need("register: registerPage");
need("getFactory: getPageFactory");
need("hasFactory: typeof source.factory === \"function\"");
need("metadata: copyObject(source.metadata)");
need("family: normalizeId(value.family || value.owner || id)");
if ((shell.match(/var pages = \{\};/g) || []).length !== 1) {
    throw new Error("PageRegistry must reuse the single existing pages SSOT");
}
need('family: "root"');
need('family: "editor"');
need('family: "settings"');
var version = shell.match(/MODULE_NAME:\s*"ch_16_ui_shell"[\s\S]*?MODULE_VERSION:\s*(\d+)/);
if (!version || Number(version[1]) < 14) { throw new Error("UIShell < 14"); }
console.log("Navigation Stage 6 PageRegistry: passed");
