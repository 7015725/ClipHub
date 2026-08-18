from pathlib import Path
import json
import subprocess

BRANCH = "refactor/navigation-contract-v2-20260818"
SHELL = Path("src/ch_16_ui_shell.js")
text = SHELL.read_text(encoding="utf-8")

# Back-hook compatibility is translated into Navigator mutations instead of allowing hooks to own PageStack.
state_anchor = '''    var backDispatchInProgress = false;
    var backDispatchCount = 0;
'''
state_replacement = '''    var backDispatchInProgress = false;
    var backHookInProgress = false;
    var pendingLegacyNavigation = null;
    var backDispatchCount = 0;
'''
if state_anchor not in text:
    raise SystemExit("Back hook transaction state anchor missing")
text = text.replace(state_anchor, state_replacement, 1)

counter_anchor = '''    var backHookNavigationCount = 0;
    var navigatorBackPopCount = 0;
'''
counter_replacement = '''    var backHookNavigationCount = 0;
    var legacyHookIntentCount = 0;
    var deferredHookNavigationCount = 0;
    var navigatorBackPopCount = 0;
'''
if counter_anchor not in text:
    raise SystemExit("legacy hook counters anchor missing")
text = text.replace(counter_anchor, counter_replacement, 1)

# Home gets a registry hook for transient Filter state; root close itself remains PageContract rootBehavior.
install_anchor = '    function installDefaultPages() {\n'
home_helper = r'''    function defaultHomeBackHook() {
        try {
            if (ClipHub.Filter &&
                    typeof ClipHub.Filter.handleBack === "function") {
                return ClipHub.Filter.handleBack() === true;
            }
        } catch (ignoredFilterBack) {}
        return false;
    }

'''
if install_anchor not in text:
    raise SystemExit("home hook helper anchor missing")
text = text.replace(install_anchor, home_helper + install_anchor, 1)

home_contract_anchor = '''                imeBackFirst: false,
                rootBehavior: "close_host"
            } });
'''
home_contract_replacement = '''                imeBackFirst: false,
                rootBehavior: "close_host"
            },
            hooks: {
                onBack: defaultHomeBackHook
            } });
'''
if home_contract_anchor not in text:
    raise SystemExit("home hook registration anchor missing")
text = text.replace(home_contract_anchor, home_contract_replacement, 1)

old_set_stack = '''    function setStackPath(path, reason) {
        return navigatorSyncPath(path, reason || "legacy_set_stack_path");
    }
'''
new_set_stack = '''    function setStackPath(path, reason) {
        if (backHookInProgress) {
            pendingLegacyNavigation = {
                type: "sync_path",
                path: (path || []).slice(0),
                reason: String(reason || "legacy_set_stack_path")
            };
            legacyHookIntentCount += 1;
            return getState();
        }
        return navigatorSyncPath(path, reason || "legacy_set_stack_path");
    }
'''
if old_set_stack not in text:
    raise SystemExit("setStackPath bridge anchor missing")
text = text.replace(old_set_stack, new_set_stack, 1)

# Add helpers before unmountPage.
unmount_anchor = '    function unmountPage(pageId, reason) {\n'
helpers = r'''    function normalizeDeferredPath(path) {
        var input = path || [];
        var output = [];
        var rootId = rootPageId();
        var index = 0;
        if (input.length <= 0 || normalizeId(input[0]) !== rootId) {
            output.push(rootId);
        }
        for (index = 0; index < input.length; index += 1) {
            output.push(normalizeId(input[index]));
        }
        return output;
    }

    function pathIsCurrentPrefix(path) {
        var ids = normalizeDeferredPath(path);
        var current = stackIds();
        var index;
        if (ids.length <= 0 || ids.length >= current.length) { return false; }
        for (index = 0; index < ids.length; index += 1) {
            if (String(ids[index]) !== String(current[index])) { return false; }
        }
        return true;
    }

    function applyDeferredHookNavigation(pending, reason) {
        var target;
        var ids;
        var currentDepth = pageStackSize();
        if (!pending) { return false; }
        deferredHookNavigationCount += 1;
        if (pending.type === "pop_to_root") {
            if (currentDepth === 2) {
                return navigatorPop(reason || pending.reason ||
                    "deferred_hook_pop") === true;
            }
            return navigatorPopToRoot(reason || pending.reason ||
                "deferred_hook_pop_to_root") === true;
        }
        if (pending.type === "sync_path") {
            ids = normalizeDeferredPath(pending.path);
            if (!pathIsCurrentPrefix(ids)) {
                return false;
            }
            if (ids.length === currentDepth - 1) {
                return navigatorPop(reason || pending.reason ||
                    "deferred_hook_pop") === true;
            }
            target = ids[ids.length - 1];
            return navigatorPopTo(target, reason || pending.reason ||
                "deferred_hook_pop_to") === true;
        }
        return false;
    }

'''
if unmount_anchor not in text:
    raise SystemExit("deferred hook helpers anchor missing")
text = text.replace(unmount_anchor, helpers + unmount_anchor, 1)

# In a page Back hook, legacy unmount performs host cleanup but defers PageStack mutation to BackDispatcher/Navigator.
unmount_mutation_anchor = '''        activeBack = null;
        activeClose = null;
        unmountCount += 1;
        navigatorPopToRoot(reason || "unmount");
        lastAction = "unmount";
        lastReason = String(reason || "");
        return true;
'''
unmount_mutation_replacement = '''        activeBack = null;
        activeClose = null;
        activeImeBackFirst = false;
        unmountCount += 1;
        if (backHookInProgress) {
            pendingLegacyNavigation = {
                type: "pop_to_root",
                reason: String(reason || "unmount")
            };
            legacyHookIntentCount += 1;
            lastAction = "unmount_deferred";
            lastReason = String(reason || "");
            return true;
        }
        navigatorPopToRoot(reason || "unmount");
        lastAction = "unmount";
        lastReason = String(reason || "");
        return true;
'''
if unmount_mutation_anchor not in text:
    raise SystemExit("unmount deferred mutation anchor missing")
text = text.replace(unmount_mutation_anchor, unmount_mutation_replacement, 1)

# BackDispatcher resolves current page hook from active binding or Registry, executes it inside transaction, then applies deferred Navigator intent.
hook_block_old = '''            if (typeof activeBack === "function") {
                backHookDispatchCount += 1;
                handled = activeBack() === true;
                hookChangedNavigation = Number(generation) !== beforeGeneration ||
                    Number(stack.length) !== beforeDepth ||
                    currentPageId() !== beforePageId;
                if (hookChangedNavigation) {
                    backHookNavigationCount += 1;
                    lastBackOutcome = "legacy_hook_navigation";
                    return true;
                }
                if (handled) {
                    backHookConsumedCount += 1;
                    lastBackOutcome = "page_hook_consumed";
                    return true;
                }
            }
'''
hook_block_new = '''            var page = beforePageId && hasPage(beforePageId) ?
                requirePage(beforePageId) : null;
            var pageBackHook = typeof activeBack === "function" ? activeBack :
                (page && page.hooks && typeof page.hooks.onBack === "function" ?
                    page.hooks.onBack : null);
            if (typeof pageBackHook === "function") {
                backHookDispatchCount += 1;
                pendingLegacyNavigation = null;
                backHookInProgress = true;
                try {
                    handled = pageBackHook() === true;
                } finally {
                    backHookInProgress = false;
                }
                if (pendingLegacyNavigation !== null) {
                    handled = applyDeferredHookNavigation(
                        pendingLegacyNavigation,
                        reason || "back_dispatcher_page_hook") === true;
                    pendingLegacyNavigation = null;
                    if (handled) {
                        navigatorBackPopCount += 1;
                        lastBackOutcome = "navigator_pop_after_page_hook";
                        return true;
                    }
                }
                hookChangedNavigation = Number(generation) !== beforeGeneration ||
                    Number(stack.length) !== beforeDepth ||
                    currentPageId() !== beforePageId;
                if (hookChangedNavigation) {
                    backHookNavigationCount += 1;
                    lastBackOutcome = "unexpected_hook_navigation";
                    return true;
                }
                if (handled) {
                    backHookConsumedCount += 1;
                    lastBackOutcome = "page_hook_consumed";
                    return true;
                }
            }
'''
if hook_block_old not in text:
    raise SystemExit("BackDispatcher hook transaction anchor missing")
text = text.replace(hook_block_old, hook_block_new, 1)

# Export state counters.
state_export_anchor = '''            legacyHookNavigationCount: Number(backHookNavigationCount),
            navigatorBackPopCount: Number(navigatorBackPopCount),
'''
state_export_replacement = '''            legacyHookNavigationCount: Number(backHookNavigationCount),
            legacyHookIntentCount: Number(legacyHookIntentCount),
            deferredHookNavigationCount: Number(deferredHookNavigationCount),
            navigatorBackPopCount: Number(navigatorBackPopCount),
'''
if state_export_anchor not in text:
    raise SystemExit("getState legacy hook counters anchor missing")
text = text.replace(state_export_anchor, state_export_replacement, 1)

back_state_anchor = '''            legacyHookNavigationCount: Number(backHookNavigationCount),
            navigatorPopCount: Number(navigatorBackPopCount),
'''
back_state_replacement = '''            legacyHookNavigationCount: Number(backHookNavigationCount),
            legacyHookIntentCount: Number(legacyHookIntentCount),
            deferredHookNavigationCount: Number(deferredHookNavigationCount),
            navigatorPopCount: Number(navigatorBackPopCount),
'''
if back_state_anchor not in text:
    raise SystemExit("BackDispatcher state legacy counters anchor missing")
text = text.replace(back_state_anchor, back_state_replacement, 1)

reset_anchor = '''        backHookNavigationCount = 0;
        navigatorBackPopCount = 0;
'''
reset_replacement = '''        backHookNavigationCount = 0;
        legacyHookIntentCount = 0;
        deferredHookNavigationCount = 0;
        navigatorBackPopCount = 0;
'''
if reset_anchor not in text:
    raise SystemExit("legacy hook counter reset anchor missing")
text = text.replace(reset_anchor, reset_replacement, 1)

init_hook_anchor = '''        backDispatchInProgress = false;
        backDispatchCount = 0;
'''
init_hook_replacement = '''        backDispatchInProgress = false;
        backHookInProgress = false;
        pendingLegacyNavigation = null;
        backDispatchCount = 0;
'''
if init_hook_anchor not in text:
    raise SystemExit("hook transaction init reset anchor missing")
text = text.replace(init_hook_anchor, init_hook_replacement, 1)

if 'MODULE_NAME: "ch_16_ui_shell",\n        MODULE_VERSION: 18,' not in text:
    raise SystemExit("UIShell v18 anchor missing")
text = text.replace('MODULE_NAME: "ch_16_ui_shell",\n        MODULE_VERSION: 18,',
                    'MODULE_NAME: "ch_16_ui_shell",\n        MODULE_VERSION: 19,', 1)
SHELL.write_text(text, encoding="utf-8")

Path("scripts/test_navigation_stage10_legacy_hook_bridge.js").write_text(r'''var fs = require("fs");
var shell = fs.readFileSync("src/ch_16_ui_shell.js", "utf8");
function need(token) { if (shell.indexOf(token) < 0) { throw new Error(token); } }
need("var backHookInProgress = false");
need("var pendingLegacyNavigation = null");
need("function applyDeferredHookNavigation(pending, reason)");
need('pendingLegacyNavigation = {\n                type: "sync_path"');
need('pendingLegacyNavigation = {\n                type: "pop_to_root"');
need("var pageBackHook = typeof activeBack === \"function\" ? activeBack");
need("page.hooks.onBack");
need("backHookInProgress = true");
need("handled = applyDeferredHookNavigation(");
need('lastBackOutcome = "navigator_pop_after_page_hook"');
need('lastBackOutcome = "unexpected_hook_navigation"');
need("hooks: {\n                onBack: defaultHomeBackHook");
need("ClipHub.Filter.handleBack()");
console.log("Navigation Stage 10 legacy-hook Navigator bridge: passed");
''', encoding="utf-8")

Path("docs/Navigation_Stage10_Legacy_Hook_Bridge_20260818.md").write_text('''# Navigation Stage 10｜旧页面 Back Hook 收口\n\n现有 Editor/Settings/Translation/Detail 等页面的旧 `onBack/requestExit` 仍会调用 `UIShell.unmountPage()` 或 `syncEmbeddedPage()`。本阶段不要求业务模块一次性重写，而是在 BackDispatcher hook transaction 中把这些旧调用转换为“导航意图”：宿主/业务清理可以继续执行，但 PageStack mutation 被延迟，最终只由 `Navigator.pop/popTo/popToRoot` 提交。\n\n因此旧页面 hook 不再直接拥有 PageStack。若 hook 绕过兼容 API 直接改变 generation/stack，会记录 `unexpected_hook_navigation`，作为回归异常。Home 的 Registry hook 继续把 Filter 内部临时层交给 `Filter.handleBack()` 优先消费；无临时层时再执行 PageContract `rootBehavior=close_host`。\n''', encoding="utf-8")

blob = subprocess.check_output(["git", "hash-object", str(SHELL)], text=True).strip()
manifest_path = Path("module-manifest.json")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["moduleSetVersion"] = "20260818.11"
manifest["sourceRef"] = BRANCH
for item in manifest["modules"]:
    if item["name"] == "ch_16_ui_shell.js":
        item["sha"] = blob
        break
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
