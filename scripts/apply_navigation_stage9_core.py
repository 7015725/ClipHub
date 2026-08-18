from pathlib import Path
import json
import subprocess

BRANCH = "refactor/navigation-contract-v2-20260818"
SHELL = Path("src/ch_16_ui_shell.js")
text = SHELL.read_text(encoding="utf-8")

text = text.replace(
    '            metadata: copyObject(source.metadata),\n            contract: copyPageContract(source.contract)\n',
    '            metadata: copyObject(source.metadata),\n            contract: copyPageContract(source.contract),\n            hookNames: source.hooks ? source.hooks.names.slice(0) : []\n', 1)

register_anchor = '''        page = {
            id: id,
'''
if register_anchor not in text:
    raise SystemExit("register page anchor missing")
# Insert hook normalization before constructing the page object.
text = text.replace(
    register_anchor,
    '''        var hookInput = value.hooks || {};
        var hookNames = ["onBeforeEnter", "onEnter", "onBeforeLeave",
            "onLeave", "onBack", "onClose"];
        var hooks = { names: [] };
        var hookIndex;
        var hookName;
        for (hookIndex = 0; hookIndex < hookNames.length; hookIndex += 1) {
            hookName = hookNames[hookIndex];
            if (typeof hookInput[hookName] === "function") {
                hooks[hookName] = hookInput[hookName];
                hooks.names.push(hookName);
            }
        }
''' + register_anchor, 1)
text = text.replace(
    '            contract: mergePageContract(value.contract)\n',
    '            contract: mergePageContract(value.contract),\n            hooks: hooks\n', 1)

anchor = '    function pageStackPopToRoot(reason) {\n'
helpers = r'''    function invokePageHook(page, hookName, payload) {
        var hooks = page && page.hooks ? page.hooks : null;
        if (!hooks || typeof hooks[hookName] !== "function") { return null; }
        return hooks[hookName](payload || {});
    }

    function normalizeFactoryPageSpec(page, created, params) {
        var spec = created || {};
        var view = null;
        if (spec && spec.view) {
            view = spec.view;
        } else if (spec && typeof spec.getRootView === "function") {
            view = spec;
            spec = {};
        }
        if (!view) { throw new Error("Page factory did not return a view: " + page.id); }
        return {
            pageId: page.id,
            title: String(spec.title || page.id),
            showBack: spec.showBack !== false,
            view: view,
            onBack: typeof spec.onBack === "function" ? spec.onBack :
                (page.hooks && page.hooks.onBack ? page.hooks.onBack : null),
            onClose: typeof spec.onClose === "function" ? spec.onClose :
                (page.hooks && page.hooks.onClose ? page.hooks.onClose : null),
            imeBackFirst: page.contract.imeBackFirst === true,
            params: copyObject(params)
        };
    }

    function createFactoryPageSpec(page, params, reason) {
        var payload;
        var created;
        if (!page || typeof page.factory !== "function") { return null; }
        payload = {
            context: runtimeContext,
            pageId: page.id,
            params: copyObject(params),
            reason: String(reason || ""),
            registry: ClipHub.PageRegistry,
            navigator: ClipHub.Navigator
        };
        invokePageHook(page, "onBeforeEnter", payload);
        created = page.factory(payload);
        return normalizeFactoryPageSpec(page, created, params);
    }

'''
if anchor not in text:
    raise SystemExit("factory helper anchor missing")
text = text.replace(anchor, helpers + anchor, 1)

old_push = '''    function navigatorPush(pageId, params, reason) {
        return pageStackPush(pageId, params, reason || "navigator_push");
    }
'''
new_push = '''    function navigatorPush(pageId, params, reason) {
        var page = requirePage(pageId);
        var actualReason = reason || "navigator_push";
        var spec = null;
        var result;
        if (typeof page.factory !== "function") {
            return pageStackPush(page.id, params, actualReason);
        }
        if (!canEmbed(page.id)) {
            throw new Error("Navigator host unavailable: " + page.id);
        }
        spec = createFactoryPageSpec(page, params, actualReason);
        result = pageStackPush(page.id, params, actualReason);
        if (currentPageId() !== page.id) { return result; }
        mountCount += 1;
        applyActivePage(spec, actualReason);
        invokePageHook(page, "onEnter", {
            pageId: page.id,
            params: copyObject(params),
            reason: String(actualReason)
        });
        return getState();
    }
'''
if old_push not in text:
    raise SystemExit("navigatorPush anchor missing")
text = text.replace(old_push, new_push, 1)

old_pop = '''    function navigatorPop(reason) {
        return pageStackPop(reason || "navigator_pop");
    }
'''
new_pop = '''    function navigatorPop(reason) {
        var actualReason = reason || "navigator_pop";
        var current = pageStackCurrent();
        var page = current && hasPage(current.id) ? requirePage(current.id) : null;
        var factoryManaged = page && typeof page.factory === "function";
        var result;
        if (factoryManaged) {
            invokePageHook(page, "onBeforeLeave", {
                pageId: page.id,
                params: copyObject(current.params),
                reason: String(actualReason)
            });
            if (activePageId === page.id) {
                detachActivePageForNavigator(actualReason);
            }
        }
        result = pageStackPop(actualReason);
        if (factoryManaged && result === true) {
            invokePageHook(page, "onLeave", {
                pageId: page.id,
                reason: String(actualReason),
                current: pageStackCurrent()
            });
        }
        return result;
    }
'''
if old_pop not in text:
    raise SystemExit("navigatorPop anchor missing")
text = text.replace(old_pop, new_pop, 1)

old_replace = '''    function navigatorReplace(pageId, params, reason) {
        return pageStackReplace(pageId, params, reason || "navigator_replace");
    }
'''
new_replace = '''    function navigatorReplace(pageId, params, reason) {
        var actualReason = reason || "navigator_replace";
        var target = requirePage(pageId);
        var current = pageStackCurrent();
        var oldPage = current && hasPage(current.id) ? requirePage(current.id) : null;
        var targetSpec = null;
        var result;
        if (oldPage && typeof oldPage.factory === "function") {
            invokePageHook(oldPage, "onBeforeLeave", {
                pageId: oldPage.id,
                reason: String(actualReason)
            });
            if (activePageId === oldPage.id) {
                detachActivePageForNavigator(actualReason);
            }
        }
        if (typeof target.factory === "function") {
            if (!canEmbed(target.id)) {
                throw new Error("Navigator host unavailable: " + target.id);
            }
            targetSpec = createFactoryPageSpec(target, params, actualReason);
        }
        result = pageStackReplace(target.id, params, actualReason);
        if (oldPage && typeof oldPage.factory === "function") {
            invokePageHook(oldPage, "onLeave", {
                pageId: oldPage.id,
                reason: String(actualReason),
                current: pageStackCurrent()
            });
        }
        if (targetSpec !== null) {
            mountCount += 1;
            applyActivePage(targetSpec, actualReason);
            invokePageHook(target, "onEnter", {
                pageId: target.id,
                params: copyObject(params),
                reason: String(actualReason)
            });
            return getState();
        }
        return result;
    }
'''
if old_replace not in text:
    raise SystemExit("navigatorReplace anchor missing")
text = text.replace(old_replace, new_replace, 1)

# BackDispatcher must leave host/lifecycle teardown to Navigator.pop for factory pages.
old_detach = '''            if (navigatorCanPop()) {
                if (activePageId !== null) {
                    detachActivePageForNavigator(reason || "back_dispatcher_pop");
                }
                handled = navigatorPop(reason || "back_dispatcher_pop") === true;
'''
new_detach = '''            if (navigatorCanPop()) {
                if (activePageId !== null &&
                        typeof requirePage(currentPageId()).factory !== "function") {
                    detachActivePageForNavigator(reason || "back_dispatcher_pop");
                }
                handled = navigatorPop(reason || "back_dispatcher_pop") === true;
'''
if old_detach not in text:
    raise SystemExit("BackDispatcher factory lifecycle anchor missing")
text = text.replace(old_detach, new_detach, 1)

if 'MODULE_VERSION: 16,' not in text:
    raise SystemExit("UIShell v16 anchor missing")
text = text.replace('MODULE_VERSION: 16,', 'MODULE_VERSION: 17,', 1)
SHELL.write_text(text, encoding="utf-8")

Path("scripts/test_navigation_stage9_factory_core.js").write_text(r'''var fs = require("fs");
var shell = fs.readFileSync("src/ch_16_ui_shell.js", "utf8");
function need(token) { if (shell.indexOf(token) < 0) { throw new Error(token); } }
need("function normalizeFactoryPageSpec(page, created, params)");
need("function createFactoryPageSpec(page, params, reason)");
need("page.factory(payload)");
need("invokePageHook(page, \"onBeforeEnter\"");
need("invokePageHook(page, \"onEnter\"");
need("invokePageHook(page, \"onBeforeLeave\"");
need("invokePageHook(page, \"onLeave\"");
need("if (typeof page.factory !== \"function\")");
need("applyActivePage(spec, actualReason)");
need("detachActivePageForNavigator(actualReason)");
if (shell.indexOf("navigation_architecture_test_page") >= 0) {
    throw new Error("navigation core contains Stage9 test page id before test page is added");
}
console.log("Navigation Stage 9 generic factory/lifecycle core: passed");
''', encoding="utf-8")

Path("docs/Navigation_Stage9_Factory_Core_20260818.md").write_text('''# Navigation Stage 9 准备｜通用 factory / lifecycle\n\nNavigator 对 `PageRegistry` 中带 factory 的页面提供通用创建、Primary Host 挂载、IME Contract、Back、离场与生命周期 hook。旧产品页面 factory 为空，继续走 legacy 兼容路径，因此本阶段不改变现有页面创建行为。\n\n支持 hook：onBeforeEnter、onEnter、onBeforeLeave、onLeave、onBack、onClose。hook 扩展页面行为，但 PageStack mutation 仍只能由 Navigator 执行。下一提交将只新增 `NavigationArchitectureTestPage` 页面文件与注册/调用代码，不修改导航核心。\n''', encoding="utf-8")

blob = subprocess.check_output(["git", "hash-object", str(SHELL)], text=True).strip()
manifest_path = Path("module-manifest.json")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["moduleSetVersion"] = "20260818.09"
manifest["sourceRef"] = BRANCH
for item in manifest["modules"]:
    if item["name"] == "ch_16_ui_shell.js":
        item["sha"] = blob
        break
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
