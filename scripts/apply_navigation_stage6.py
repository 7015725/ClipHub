from pathlib import Path
import json
import subprocess

BRANCH = "refactor/navigation-contract-v2-20260818"
SHELL = Path("src/ch_16_ui_shell.js")
text = SHELL.read_text(encoding="utf-8")

old_copy = '''        return {
            id: String(source.id),
            parentId: source.parentId === null ? null : String(source.parentId),
            alternateParentIds: (source.alternateParentIds || []).slice(0),
            owner: String(source.owner || source.id),
            moduleName: String(source.moduleName || ""),
            cachePolicy: String(source.cachePolicy || "lazy"),
            legacySurface: String(source.legacySurface || ""),
            shellReady: source.shellReady === true
        };
'''
new_copy = '''        return {
            id: String(source.id),
            parentId: source.parentId === null ? null : String(source.parentId),
            alternateParentIds: (source.alternateParentIds || []).slice(0),
            owner: String(source.owner || source.id),
            family: String(source.family || source.owner || source.id),
            moduleName: String(source.moduleName || ""),
            cachePolicy: String(source.cachePolicy || "lazy"),
            legacySurface: String(source.legacySurface || ""),
            shellReady: source.shellReady === true,
            hasFactory: typeof source.factory === "function",
            metadata: copyObject(source.metadata)
        };
'''
if old_copy not in text:
    raise SystemExit("copyDescriptor anchor missing")
text = text.replace(old_copy, new_copy, 1)

old_page = '''            owner: normalizeId(value.owner || id),
            moduleName: normalizeId(value.moduleName || ""),
            cachePolicy: normalizeId(value.cachePolicy || "lazy"),
            legacySurface: normalizeId(value.legacySurface || ""),
            shellReady: value.shellReady === true
'''
new_page = '''            owner: normalizeId(value.owner || id),
            family: normalizeId(value.family || value.owner || id),
            moduleName: normalizeId(value.moduleName || ""),
            cachePolicy: normalizeId(value.cachePolicy || "lazy"),
            legacySurface: normalizeId(value.legacySurface || ""),
            shellReady: value.shellReady === true,
            factory: typeof value.factory === "function" ? value.factory : null,
            metadata: copyObject(value.metadata)
'''
if old_page not in text:
    raise SystemExit("registerPage descriptor anchor missing")
text = text.replace(old_page, new_page, 1)

replacements = {
    'registerPage({ id: "home", parentId: null, owner: "home",': 'registerPage({ id: "home", parentId: null, owner: "home", family: "root",',
    'registerPage({ id: "detail", parentId: "home", owner: "detail",': 'registerPage({ id: "detail", parentId: "home", owner: "detail", family: "detail",',
    'registerPage({ id: "editor", parentId: "home", owner: "editor",': 'registerPage({ id: "editor", parentId: "home", owner: "editor", family: "editor",',
    'registerPage({ id: "tags", parentId: "editor", owner: "tags",': 'registerPage({ id: "tags", parentId: "editor", owner: "tags", family: "editor",',
    'registerPage({ id: "settings", parentId: "home", owner: "settings",': 'registerPage({ id: "settings", parentId: "home", owner: "settings", family: "settings",',
    'registerPage({ id: "regex_rules", parentId: "settings",\n            owner: "settings",': 'registerPage({ id: "regex_rules", parentId: "settings",\n            owner: "settings", family: "settings",',
    'registerPage({ id: "regex_editor", parentId: "regex_rules",\n            owner: "settings",': 'registerPage({ id: "regex_editor", parentId: "regex_rules",\n            owner: "settings", family: "settings",',
    'registerPage({ id: "regex_test", parentId: "regex_editor",\n            owner: "settings",': 'registerPage({ id: "regex_test", parentId: "regex_editor",\n            owner: "settings", family: "settings",',
    'registerPage({ id: "translation", parentId: "home",\n            owner: "translation",': 'registerPage({ id: "translation", parentId: "home",\n            owner: "translation", family: "translation",',
    'alternateParentIds: ["home"], owner: "tokenizer",': 'alternateParentIds: ["home"], owner: "tokenizer", family: "editor",',
    'registerPage({ id: "tokenizer_rules", parentId: "tokenizer",\n            owner: "tokenizer",': 'registerPage({ id: "tokenizer_rules", parentId: "tokenizer",\n            owner: "tokenizer", family: "editor",',
    'registerPage({ id: "tokenizer_rule_editor", parentId: "tokenizer_rules",\n            owner: "tokenizer",': 'registerPage({ id: "tokenizer_rule_editor", parentId: "tokenizer_rules",\n            owner: "tokenizer", family: "editor",'
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit("default page family anchor missing: " + old[:60])
    text = text.replace(old, new, 1)

anchor = '    function stackIds() {\n'
helpers = r'''    function hasPage(pageId) {
        var id = normalizeId(pageId);
        return !!(id && pages[id]);
    }

    function getPageFactory(pageId) {
        var page = requirePage(pageId);
        return typeof page.factory === "function" ? page.factory : null;
    }

    function pageRegistryState() {
        return {
            apiVersion: 1,
            pageCount: Number(pageOrder.length),
            pageIds: pageIds(),
            rootPageId: pageOrder.length > 0 ? rootPageId() : null
        };
    }

'''
if anchor not in text:
    raise SystemExit("PageRegistry helper anchor missing")
text = text.replace(anchor, helpers + anchor, 1)

state_anchor = '            pageStackOwner: "ClipHub.PageStack",\n            navigationManagerOwner: "ClipHub.Navigator",\n'
state_replacement = '            pageRegistryOwner: "ClipHub.PageRegistry",\n            pageStackOwner: "ClipHub.PageStack",\n            navigationManagerOwner: "ClipHub.Navigator",\n'
if state_anchor not in text:
    raise SystemExit("getState owner anchor missing")
text = text.replace(state_anchor, state_replacement, 1)

export_anchor = '    ClipHub.BackDispatcher = {\n'
registry_export = r'''    ClipHub.PageRegistry = {
        API_VERSION: 1,
        register: registerPage,
        get: function (pageId) { return copyDescriptor(requirePage(pageId)); },
        has: hasPage,
        list: pageIds,
        getFactory: getPageFactory,
        getState: pageRegistryState
    };

'''
if export_anchor not in text:
    raise SystemExit("PageRegistry export anchor missing")
text = text.replace(export_anchor, registry_export + export_anchor, 1)

if 'MODULE_VERSION: 13,' not in text:
    raise SystemExit("UIShell v13 anchor missing")
text = text.replace('MODULE_VERSION: 13,', 'MODULE_VERSION: 14,', 1)
SHELL.write_text(text, encoding="utf-8")

Path("scripts/test_navigation_stage6_page_registry.js").write_text(r'''var fs = require("fs");
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
''', encoding="utf-8")

Path("docs/Navigation_Stage6_PageRegistry_20260818.md").write_text('''# Navigation Stage 6｜PageRegistry\n\n`ClipHub.PageRegistry` 正式成为页面定义 Owner，并直接复用原 `pages` 对象，不创建第二套 Registry。Registry 当前管理 pageId、parent/alternateParent、owner、family、moduleName、factory、metadata、cachePolicy、legacySurface、shellReady。现有产品页面继续由 `installDefaultPages()` 注册；未来页面可在自己的模块中调用 `PageRegistry.register()`，无需进入 Registry 核心增加分支。\n''', encoding="utf-8")

blob = subprocess.check_output(["git", "hash-object", str(SHELL)], text=True).strip()
manifest_path = Path("module-manifest.json")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["moduleSetVersion"] = "20260818.06"
manifest["sourceRef"] = BRANCH
for item in manifest["modules"]:
    if item["name"] == "ch_16_ui_shell.js":
        item["sha"] = blob
        break
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
