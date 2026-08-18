var fs = require("fs");
var shell = fs.readFileSync("src/ch_16_ui_shell.js", "utf8");
function need(token) { if (shell.indexOf(token) < 0) { throw new Error(token); } }
need("var DEFAULT_PAGE_CONTRACT = {");
["allowDuplicate", "canPop", "systemBack", "swipeBack", "predictiveBack", "imeBackFirst", "host", "rootBehavior"].forEach(need);
need("function mergePageContract(override)");
need("contract: mergePageContract(value.contract)");
need("getContract: getPageContract");
need("getDefaultContract: function ()");
need('rootBehavior: "close_host"');
need("page.contract.allowDuplicate !== true");
need("contract.canPop !== false && pageStackCanPop()");
need("pageContract.predictiveBack === false");
need("pageContract.swipeBack === false");
need("pageContract.systemBack === false");
need("requirePage(activePageId).contract.imeBackFirst === true");
console.log("Navigation Stage 7 PageContract: passed");
