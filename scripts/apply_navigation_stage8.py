from pathlib import Path
import json
import subprocess

BRANCH = "refactor/navigation-contract-v2-20260818"
SHELL = Path("src/ch_16_ui_shell.js")
text = SHELL.read_text(encoding="utf-8")


def replace_function(source, name, replacement):
    token = "    function " + name + "("
    start = source.find(token)
    if start < 0:
        raise SystemExit("missing function: " + name)
    nxt = source.find("\n    function ", start + len(token))
    if nxt < 0:
        raise SystemExit("missing next function after: " + name)
    return source[:start] + replacement.rstrip() + "\n" + source[nxt:]


text = replace_function(text, "isSameShellFamily", r'''    function isSameShellFamily(pageId) {
        var target = requirePage(pageId);
        var currentId = currentPageId();
        var current;
        if (!currentId || !hasPage(currentId)) { return false; }
        current = requirePage(currentId);
        if (current.parentId === null) { return true; }
        return String(current.family || "") === String(target.family || "");
    }''')

text = replace_function(text, "canEmbed", r'''    function canEmbed(pageId) {
        var id = normalizeId(pageId);
        var host = primaryHostState();
        var page;
        if (!initialized || host.ready !== true || !hasPage(id)) { return false; }
        page = requirePage(id);
        if (page.shellReady !== true ||
                String(page.contract.host || "") !== "primary") {
            return false;
        }
        return isSameShellFamily(id);
    }''')

text = text.replace(
    '        if (page.parentId !== "home") {\n            throw new Error("mountPage only accepts direct home children: " + id);\n        }\n',
    '        if (page.parentId !== rootPageId()) {\n            throw new Error("mountPage only accepts direct root children: " + id);\n        }\n', 1)

old_unmount_guard = '''        if (id && id !== activePageId &&
                !(id === "settings" && (activePageId === "regex_rules" ||
                    activePageId === "regex_editor" || activePageId === "regex_test")) &&
                !(id === "editor" && (activePageId === "tags" ||
                    activePageId === "tokenizer" ||
                    activePageId === "tokenizer_rules" ||
                    activePageId === "tokenizer_rule_editor"))) {
            return false;
        }
'''
new_unmount_guard = '''        if (id && id !== activePageId) {
            if (!hasPage(id) || !hasPage(activePageId) ||
                    String(requirePage(id).family || "") !==
                    String(requirePage(activePageId).family || "")) {
                return false;
            }
        }
'''
if old_unmount_guard not in text:
    raise SystemExit("unmount family hardcoding anchor missing")
text = text.replace(old_unmount_guard, new_unmount_guard, 1)

# Replace runtime page-family helpers with Registry-driven module/family resolution.
start = text.find('    function runtimeEditorFamily(pageId) {')
end = text.find('    function runtimeSizeMismatch(actual, expected) {', start)
if start < 0 or end < 0:
    raise SystemExit("runtime family helper block missing")
runtime_helpers = r'''    function runtimePageUsesModule(pageId, moduleName) {
        var id = normalizeId(pageId);
        if (!id || !hasPage(id)) { return false; }
        return String(requirePage(id).moduleName || "") === String(moduleName || "");
    }

    function runtimeModuleFamily(moduleName) {
        var index;
        var page;
        var family = "";
        for (index = 0; index < pageOrder.length; index += 1) {
            page = pages[pageOrder[index]];
            if (!page || String(page.moduleName || "") !== String(moduleName || "")) {
                continue;
            }
            if (!family) { family = String(page.family || ""); }
        }
        return family;
    }

    function runtimePageInModuleFamily(pageId, moduleName) {
        var id = normalizeId(pageId);
        var family = runtimeModuleFamily(moduleName);
        return !!(id && family && hasPage(id) &&
            String(requirePage(id).family || "") === family);
    }

'''
text = text[:start] + runtime_helpers + text[end:]

replacements = {
    'current !== "home"': 'current !== rootPageId()',
    'active !== "detail"': '!runtimePageUsesModule(active, "List")',
    '!runtimeEditorFamily(active)': '!runtimePageInModuleFamily(active, "Editor")',
    '!runtimeSettingsFamily(active)': '!runtimePageInModuleFamily(active, "Settings")',
    'active !== "translation"': '!runtimePageUsesModule(active, "Translation")',
    'active === "detail" && !detailAttached': 'runtimePageUsesModule(active, "List") && !detailAttached',
    'runtimeEditorFamily(active) && !editorAttached': 'runtimePageInModuleFamily(active, "Editor") && !editorAttached',
    'runtimeSettingsFamily(active) && !settingsAttached': 'runtimePageInModuleFamily(active, "Settings") && !settingsAttached',
    'active === "translation" && !translationAttached': 'runtimePageUsesModule(active, "Translation") && !translationAttached'
}
for old, new in replacements.items():
    if old not in text:
        raise SystemExit("runtime hardcoding anchor missing: " + old)
    text = text.replace(old, new)

old_tokenizer_check = '''        if (tokenizer.mounted === true && active !== "tokenizer" &&
                active !== "tokenizer_rules" &&
                active !== "tokenizer_rule_editor") {
'''
new_tokenizer_check = '''        if (tokenizer.mounted === true &&
                !runtimePageUsesModule(active, "TokenizerUI")) {
'''
if old_tokenizer_check not in text:
    raise SystemExit("tokenizer runtime page hardcoding anchor missing")
text = text.replace(old_tokenizer_check, new_tokenizer_check, 1)

if 'MODULE_VERSION: 15,' not in text:
    raise SystemExit("UIShell v15 anchor missing")
text = text.replace('MODULE_VERSION: 15,', 'MODULE_VERSION: 16,', 1)
SHELL.write_text(text, encoding="utf-8")

Path("scripts/test_navigation_stage8_no_page_hardcoding.js").write_text(r'''var fs = require("fs");
var shell = fs.readFileSync("src/ch_16_ui_shell.js", "utf8");
var ids = ["home", "detail", "editor", "tags", "settings", "regex_rules", "regex_editor", "regex_test", "translation", "tokenizer", "tokenizer_rules", "tokenizer_rule_editor"];
function block(name) {
    var start = shell.indexOf("function " + name + "(");
    if (start < 0) { throw new Error("missing " + name); }
    var end = shell.indexOf("\n    function ", start + 10);
    return shell.substring(start, end < 0 ? shell.length : end);
}
["isSameShellFamily", "canEmbed", "unmountPage", "navigatorPush", "navigatorPop", "backDispatcherDispatch"].forEach(function (name) {
    var source = block(name);
    ids.forEach(function (id) {
        if (source.indexOf('"' + id + '"') >= 0) {
            throw new Error(name + " hardcodes page id " + id);
        }
    });
});
var family = block("isSameShellFamily");
if (family.indexOf("target.family") < 0 || family.indexOf("current.family") < 0) {
    throw new Error("family routing is not Registry-driven");
}
var embed = block("canEmbed");
if (embed.indexOf("page.contract.host") < 0 || embed.indexOf("page.shellReady") < 0) {
    throw new Error("canEmbed is not PageContract-driven");
}
var unmount = block("unmountPage");
if (unmount.indexOf("requirePage(id).family") < 0 || unmount.indexOf("requirePage(activePageId).family") < 0) {
    throw new Error("unmount family check is not Registry-driven");
}
if (shell.indexOf('page.parentId !== rootPageId()') < 0) {
    throw new Error("mountPage still hardcodes root id");
}
if (shell.indexOf("function runtimePageUsesModule(pageId, moduleName)") < 0 ||
        shell.indexOf("function runtimePageInModuleFamily(pageId, moduleName)") < 0) {
    throw new Error("runtime diagnostics still need page-id family helpers");
}
console.log("Navigation Stage 8 core page-id hardcoding: passed");
''', encoding="utf-8")

Path("docs/Navigation_Stage8_Core_Hardcoding_20260818.md").write_text('''# Navigation Stage 8｜导航核心业务 Page ID 清理\n\n本阶段把 `isSameShellFamily()`、`canEmbed()`、`unmountPage()`、root-child 判断和 runtime family 判断改为 PageRegistry / PageContract 数据驱动。\n\n核心规则：根页面可进入任意 contract.host=primary 的注册页面；非根页面只允许同 family 内嵌导航；unmount 兼容调用只比较 Registry family；mount 只比较动态 rootPageId。\n\n`installDefaultPages()` 仍包含产品页面注册数据，这是 Registry 数据，不属于导航算法的业务 if/switch。`ClipHub.Navigation` 中 standalone legacy window owner/close fallback 仍保留为兼容桥；新的 Primary Host 普通页面不需要修改该 fallback。\n''', encoding="utf-8")

blob = subprocess.check_output(["git", "hash-object", str(SHELL)], text=True).strip()
manifest_path = Path("module-manifest.json")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["moduleSetVersion"] = "20260818.08"
manifest["sourceRef"] = BRANCH
for item in manifest["modules"]:
    if item["name"] == "ch_16_ui_shell.js":
        item["sha"] = blob
        break
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
