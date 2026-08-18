from pathlib import Path
import json
import subprocess

BRANCH = "refactor/navigation-contract-v2-20260818"
SHELL = Path("src/ch_16_ui_shell.js")
text = SHELL.read_text(encoding="utf-8")

contract_decl = '''    var DEFAULT_PAGE_CONTRACT = {
        allowDuplicate: false,
        canPop: true,
        systemBack: true,
        swipeBack: true,
        predictiveBack: true,
        imeBackFirst: true,
        host: "primary",
        rootBehavior: "none"
    };
'''
anchor = '    var pages = {};\n'
if anchor not in text:
    raise SystemExit("PageContract declaration anchor missing")
text = text.replace(anchor, anchor + contract_decl, 1)

copy_anchor = '    function copyDescriptor(source) {\n'
helpers = r'''    function mergePageContract(override) {
        var output = copyObject(DEFAULT_PAGE_CONTRACT);
        var value = override || {};
        var key;
        for (key in value) {
            if (value.hasOwnProperty(key)) { output[key] = value[key]; }
        }
        output.allowDuplicate = output.allowDuplicate === true;
        output.canPop = output.canPop !== false;
        output.systemBack = output.systemBack !== false;
        output.swipeBack = output.swipeBack !== false;
        output.predictiveBack = output.predictiveBack !== false;
        output.imeBackFirst = output.imeBackFirst !== false;
        output.host = normalizeId(output.host || "primary");
        output.rootBehavior = normalizeId(output.rootBehavior || "none");
        return output;
    }

    function copyPageContract(contract) {
        return mergePageContract(contract || {});
    }

    function currentPageContract() {
        var id = currentPageId();
        if (!id || !pages[id]) { return copyPageContract(DEFAULT_PAGE_CONTRACT); }
        return copyPageContract(pages[id].contract);
    }

'''
if copy_anchor not in text:
    raise SystemExit("PageContract helper anchor missing")
text = text.replace(copy_anchor, helpers + copy_anchor, 1)

text = text.replace(
    '            hasFactory: typeof source.factory === "function",\n            metadata: copyObject(source.metadata)\n',
    '            hasFactory: typeof source.factory === "function",\n            metadata: copyObject(source.metadata),\n            contract: copyPageContract(source.contract)\n', 1)
text = text.replace(
    '            factory: typeof value.factory === "function" ? value.factory : null,\n            metadata: copyObject(value.metadata)\n',
    '            factory: typeof value.factory === "function" ? value.factory : null,\n            metadata: copyObject(value.metadata),\n            contract: mergePageContract(value.contract)\n', 1)

home_anchor = '''        registerPage({ id: "home", parentId: null, owner: "home", family: "root",
            moduleName: "Filter", cachePolicy: "keep",
            legacySurface: "filter_root", shellReady: true });
'''
home_replacement = '''        registerPage({ id: "home", parentId: null, owner: "home", family: "root",
            moduleName: "Filter", cachePolicy: "keep",
            legacySurface: "filter_root", shellReady: true,
            contract: {
                canPop: false,
                swipeBack: false,
                predictiveBack: false,
                imeBackFirst: false,
                rootBehavior: "close_host"
            } });
'''
if home_anchor not in text:
    raise SystemExit("home PageContract anchor missing")
text = text.replace(home_anchor, home_replacement, 1)

factory_anchor = '''    function getPageFactory(pageId) {
        var page = requirePage(pageId);
        return typeof page.factory === "function" ? page.factory : null;
    }
'''
factory_replacement = factory_anchor + r'''
    function getPageContract(pageId) {
        return copyPageContract(requirePage(pageId).contract);
    }
'''
if factory_anchor not in text:
    raise SystemExit("PageRegistry contract API anchor missing")
text = text.replace(factory_anchor, factory_replacement, 1)

text = text.replace(
    '            rootPageId: pageOrder.length > 0 ? rootPageId() : null\n',
    '            rootPageId: pageOrder.length > 0 ? rootPageId() : null,\n            contractVersion: 1\n', 1)

old_push = '''    function pageStackPush(pageId, params, reason) {
        var page = requirePage(pageId);
        var currentId = currentPageId();
        var next = stackSnapshot();
        if (page.parentId !== null && !pageAcceptsParent(page, currentId)) {
            throw new Error("UI page parent mismatch: " + page.id +
                " requires " + page.parentId + ", current=" + currentId);
        }
        next.push({ id: page.id, params: copyObject(params) });
        return commitStackState(next, "push", reason);
    }
'''
new_push = '''    function pageStackPush(pageId, params, reason) {
        var page = requirePage(pageId);
        var currentId = currentPageId();
        var next = stackSnapshot();
        if (page.parentId !== null && !pageAcceptsParent(page, currentId)) {
            throw new Error("UI page parent mismatch: " + page.id +
                " requires " + page.parentId + ", current=" + currentId);
        }
        if (currentId === page.id && page.contract.allowDuplicate !== true) {
            lastAction = "push_duplicate_ignored";
            lastReason = String(reason || "");
            return getState();
        }
        next.push({ id: page.id, params: copyObject(params) });
        return commitStackState(next, "push", reason);
    }
'''
if old_push not in text:
    raise SystemExit("PageStack push contract anchor missing")
text = text.replace(old_push, new_push, 1)

text = text.replace(
    '    function navigatorCanPop() { return pageStackCanPop(); }\n',
    '    function navigatorCanPop() {\n        var contract = currentPageContract();\n        return contract.canPop !== false && pageStackCanPop();\n    }\n', 1)

apply_old = '        activeImeBackFirst = spec.imeBackFirst !== false;\n'
apply_new = '        activeImeBackFirst = requirePage(activePageId).contract.imeBackFirst === true;\n'
if apply_old not in text:
    raise SystemExit("active PageContract IME anchor missing")
text = text.replace(apply_old, apply_new, 1)

back_anchor = '''        lastAction = "dispatch_back";
        lastReason = String(reason || "");
        lastBackSourceFamily = backSourceFamily(reason);
'''
back_replacement = '''        lastAction = "dispatch_back";
        lastReason = String(reason || "");
        lastBackSourceFamily = backSourceFamily(reason);
        var pageContract = currentPageContract();
        if (lastBackSourceFamily === "predictive" &&
                pageContract.predictiveBack === false) {
            lastBackOutcome = "predictive_disabled_by_contract";
            return true;
        }
        if (lastBackSourceFamily === "gesture" &&
                pageContract.swipeBack === false) {
            lastBackOutcome = "swipe_disabled_by_contract";
            return true;
        }
        if ((lastBackSourceFamily === "legacy_key" ||
                lastBackSourceFamily === "system") &&
                pageContract.systemBack === false) {
            lastBackOutcome = "system_back_disabled_by_contract";
            return true;
        }
'''
if back_anchor not in text:
    raise SystemExit("BackDispatcher PageContract gate anchor missing")
text = text.replace(back_anchor, back_replacement, 1)

registry_export_anchor = '''        getFactory: getPageFactory,
        getState: pageRegistryState
'''
registry_export_replacement = '''        getFactory: getPageFactory,
        getContract: getPageContract,
        getDefaultContract: function () {
            return copyPageContract(DEFAULT_PAGE_CONTRACT);
        },
        getState: pageRegistryState
'''
if registry_export_anchor not in text:
    raise SystemExit("PageRegistry export contract anchor missing")
text = text.replace(registry_export_anchor, registry_export_replacement, 1)

state_anchor = '            pageRegistryOwner: "ClipHub.PageRegistry",\n'
state_replacement = '            pageRegistryOwner: "ClipHub.PageRegistry",\n            pageContractOwner: "ClipHub.PageRegistry",\n            pageContractVersion: 1,\n'
if state_anchor not in text:
    raise SystemExit("getState PageContract owner anchor missing")
text = text.replace(state_anchor, state_replacement, 1)

if 'MODULE_VERSION: 14,' not in text:
    raise SystemExit("UIShell v14 anchor missing")
text = text.replace('MODULE_VERSION: 14,', 'MODULE_VERSION: 15,', 1)
SHELL.write_text(text, encoding="utf-8")

Path("scripts/test_navigation_stage7_page_contract.js").write_text(r'''var fs = require("fs");
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
''', encoding="utf-8")

Path("docs/Navigation_Stage7_PageContract_20260818.md").write_text('''# Navigation Stage 7｜PageContract\n\n`DEFAULT_PAGE_CONTRACT`：`allowDuplicate=false`、`canPop=true`、`systemBack=true`、`swipeBack=true`、`predictiveBack=true`、`imeBackFirst=true`、`host=primary`、`rootBehavior=none`。\n\n页面只覆盖差异。Home 覆盖为不可 pop、不可 swipe/predictive、无 IME-first，rootBehavior=`close_host`。BackDispatcher 与 Navigator 从 Registry 读取 Contract，不再由 mount 参数决定 IME 优先级。\n''', encoding="utf-8")

blob = subprocess.check_output(["git", "hash-object", str(SHELL)], text=True).strip()
manifest_path = Path("module-manifest.json")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["moduleSetVersion"] = "20260818.07"
manifest["sourceRef"] = BRANCH
for item in manifest["modules"]:
    if item["name"] == "ch_16_ui_shell.js":
        item["sha"] = blob
        break
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
