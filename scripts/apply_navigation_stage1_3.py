from pathlib import Path
import json
import subprocess

BRANCH = "refactor/navigation-contract-v2-finalwork-20260818"
MODULE_SET = "20260818.03"
SHELL_PATH = Path("src/ch_16_ui_shell.js")


def replace_function(source, name, replacement):
    start_token = "    function " + name + "("
    start = source.find(start_token)
    if start < 0:
        raise SystemExit("missing function: " + name)
    next_pos = source.find("\n    function ", start + len(start_token))
    if next_pos < 0:
        raise SystemExit("next function missing after: " + name)
    return source[:start] + replacement.rstrip() + "\n" + source[next_pos:]


text = SHELL_PATH.read_text(encoding="utf-8")

marker = '''    function pageAcceptsParent(page, parentId) {
        var alternates = page && page.alternateParentIds ?
            page.alternateParentIds : [];
        var index;
        if (page && page.parentId === parentId) { return true; }
        for (index = 0; index < alternates.length; index += 1) {
            if (String(alternates[index]) === String(parentId)) { return true; }
        }
        return false;
    }
'''
if marker not in text:
    raise SystemExit("pageAcceptsParent anchor missing")

helpers = r'''

    function rootPageId() {
        var root = null;
        var index;
        var page;
        for (index = 0; index < pageOrder.length; index += 1) {
            page = pages[pageOrder[index]];
            if (page && page.parentId === null) {
                if (root !== null && root !== page.id) {
                    throw new Error("Multiple UI root pages registered");
                }
                root = String(page.id);
            }
        }
        if (root === null) { throw new Error("UI root page is not registered"); }
        return root;
    }

    function copyStackEntry(entry) {
        if (!entry) { return null; }
        return { id: String(entry.id), params: copyObject(entry.params) };
    }

    function stackSnapshot() {
        var output = [];
        var index;
        for (index = 0; index < stack.length; index += 1) {
            output.push(copyStackEntry(stack[index]));
        }
        return output;
    }

    function commitStackState(nextEntries, action, reason) {
        var next = nextEntries || [];
        var normalized = [];
        var index;
        var page;
        var previousId = null;
        if (next.length < 1) {
            throw new Error("PageStack cannot commit an empty stack");
        }
        for (index = 0; index < next.length; index += 1) {
            page = requirePage(next[index].id);
            if (index === 0) {
                if (page.parentId !== null) {
                    throw new Error("PageStack root must be a root page: " + page.id);
                }
            } else if (!pageAcceptsParent(page, previousId)) {
                throw new Error("PageStack parent mismatch: " + page.id +
                    ", previous=" + String(previousId || ""));
            }
            normalized.push({
                id: page.id,
                params: copyObject(next[index].params)
            });
            previousId = page.id;
        }
        stack = normalized;
        visible = true;
        generation += 1;
        mutationCount += 1;
        lastAction = String(action || "stack_commit");
        lastReason = String(reason || "");
        return getState();
    }

    function clearStackState(action, reason) {
        stack = [];
        generation += 1;
        mutationCount += 1;
        lastAction = String(action || "stack_clear");
        lastReason = String(reason || "");
        return true;
    }

    function pageStackSetPath(path, reason) {
        var ids = path || [];
        var rootId = rootPageId();
        var next = [{ id: rootId, params: {} }];
        var index = 0;
        if (ids.length > 0 && normalizeId(ids[0]) === rootId) {
            index = 1;
        }
        for (; index < ids.length; index += 1) {
            next.push({ id: normalizeId(ids[index]), params: {} });
        }
        syncCount += 1;
        return commitStackState(next, "sync_path", reason);
    }

    function pageStackResetRoot(pageId, params, reason) {
        var page = requirePage(pageId);
        if (page.parentId !== null) {
            throw new Error("UI root page must not have a parent: " + page.id);
        }
        return commitStackState([
            { id: page.id, params: copyObject(params) }
        ], "enter_root", reason);
    }

    function pageStackPush(pageId, params, reason) {
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

    function pageStackPop(reason) {
        var next;
        if (stack.length <= 1) { return false; }
        next = stackSnapshot();
        next.pop();
        commitStackState(next, "pop", reason);
        return true;
    }

    function pageStackReplace(pageId, params, reason) {
        var page = requirePage(pageId);
        var next = stackSnapshot();
        var parentId = next.length > 1 ? String(next[next.length - 2].id) : null;
        if (next.length === 0) {
            return pageStackResetRoot(page.id, params, reason);
        }
        if (next.length === 1) {
            if (page.parentId !== null) {
                throw new Error("Root replace requires a root page: " + page.id);
            }
        } else if (!pageAcceptsParent(page, parentId)) {
            throw new Error("UI replace parent mismatch: " + page.id +
                ", parent=" + String(parentId || ""));
        }
        next[next.length - 1] = { id: page.id, params: copyObject(params) };
        return commitStackState(next, "replace", reason);
    }

    function pageStackCurrent() {
        return stack.length > 0 ? copyStackEntry(stack[stack.length - 1]) : null;
    }

    function pageStackCanPop() { return stack.length > 1; }

    function pageStackSize() { return Number(stack.length); }

    function pageStackPopTo(pageId, reason) {
        var id = normalizeId(pageId);
        var next = stackSnapshot();
        var index = next.length - 1;
        for (; index >= 0; index -= 1) {
            if (String(next[index].id) === id) {
                next = next.slice(0, index + 1);
                commitStackState(next, "pop_to", reason);
                return true;
            }
        }
        return false;
    }

    function pageStackPopToRoot(reason) {
        return pageStackPopTo(rootPageId(), reason);
    }

    function navigatorPush(pageId, params, reason) {
        return pageStackPush(pageId, params, reason || "navigator_push");
    }

    function navigatorPop(reason) {
        return pageStackPop(reason || "navigator_pop");
    }

    function navigatorReplace(pageId, params, reason) {
        return pageStackReplace(pageId, params, reason || "navigator_replace");
    }

    function navigatorCurrent() { return pageStackCurrent(); }

    function navigatorCanPop() { return pageStackCanPop(); }

    function navigatorStackSize() { return pageStackSize(); }

    function navigatorPopTo(pageId, reason) {
        return pageStackPopTo(pageId, reason || "navigator_pop_to");
    }

    function navigatorPopToRoot(reason) {
        return pageStackPopToRoot(reason || "navigator_pop_to_root");
    }

    function navigatorReset(pageId, params, reason) {
        return pageStackResetRoot(pageId, params, reason || "navigator_reset");
    }

    function navigatorSyncPath(path, reason) {
        return pageStackSetPath(path, reason || "navigator_sync_path");
    }
'''

if "function pageStackPush(pageId, params, reason)" not in text:
    text = text.replace(marker, marker + helpers, 1)

text = replace_function(text, "setStackPath", r'''    function setStackPath(path, reason) {
        return navigatorSyncPath(path, reason || "legacy_set_stack_path");
    }''')

text = replace_function(text, "enterRoot", r'''    function enterRoot(pageId, params, reason) {
        return navigatorReset(pageId, params, reason || "legacy_enter_root");
    }''')

text = replace_function(text, "pushPage", r'''    function pushPage(pageId, params, reason) {
        return navigatorPush(pageId, params, reason || "legacy_push_page");
    }''')

text = replace_function(text, "popPage", r'''    function popPage(reason) {
        return navigatorPop(reason || "legacy_pop_page");
    }''')

text = replace_function(text, "clearToRoot", r'''    function clearToRoot(reason) {
        if (activePageId !== null) {
            return unmountPage(activePageId, reason || "legacy_clear_to_root");
        }
        navigatorPopToRoot(reason || "legacy_clear_to_root");
        return getState();
    }''')

text = replace_function(text, "unmountPage", r'''    function unmountPage(pageId, reason) {
        var id = normalizeId(pageId);
        if (activePageId === null) {
            navigatorPopToRoot(reason || "unmount_without_active");
            return true;
        }
        if (id && id !== activePageId &&
                !(id === "settings" && (activePageId === "regex_rules" ||
                    activePageId === "regex_editor" || activePageId === "regex_test")) &&
                !(id === "editor" && (activePageId === "tags" ||
                    activePageId === "tokenizer" ||
                    activePageId === "tokenizer_rules" ||
                    activePageId === "tokenizer_rule_editor"))) {
            return false;
        }
        if (ClipHub.Filter &&
                typeof ClipHub.Filter.unmountPrimaryChildPage === "function") {
            ClipHub.Filter.unmountPrimaryChildPage(reason || "unmount");
        }
        activePageId = null;
        activeView = null;
        activeBack = null;
        activeClose = null;
        unmountCount += 1;
        navigatorPopToRoot(reason || "unmount");
        lastAction = "unmount";
        lastReason = String(reason || "");
        return true;
    }''')

text = replace_function(text, "init", r'''    function init(context) {
        if (initialized) { return getState(); }
        runtimeContext = context || {};
        pages = {};
        pageOrder = [];
        clearStackState("init_clear", "init");
        visible = false;
        activePageId = null;
        activeView = null;
        activeBack = null;
        activeClose = null;
        mountCount = 0;
        unmountCount = 0;
        syncCount = 0;
        backDispatchInProgress = false;
        backDispatchCount = 0;
        duplicateBackRequestCount = 0;
        backCascadeGuardCount = 0;
        lastBackRequestId = "";
        lastBackRequestGeneration = -1;
        lastBackFromPageId = "";
        lastBackToPageId = "";
        lastBackDepthBefore = 0;
        lastBackDepthAfter = 0;
        mutationCount = 0;
        lastAction = "init";
        lastReason = "";
        initialized = true;
        installDefaultPages();
        navigatorReset(rootPageId(), {}, "init_root");
        return getState();
    }''')

text = replace_function(text, "shutdown", r'''    function shutdown() {
        try {
            if (activePageId !== null) { unmountPage(activePageId, "shutdown"); }
        } catch (ignored) {}
        initialized = false;
        runtimeContext = null;
        pages = {};
        pageOrder = [];
        clearStackState("shutdown_clear", "shutdown");
        visible = false;
        activePageId = null;
        activeView = null;
        activeBack = null;
        activeClose = null;
        backDispatchInProgress = false;
        lastBackRequestId = "";
        lastBackRequestGeneration = -1;
        lastAction = "shutdown";
        lastReason = "";
        return true;
    }''')

old_state = '''            currentPageId: currentPageId(),
            stackDepth: Number(stack.length),
            pageStack: stackIds(),
'''
new_state = '''            currentPageId: currentPageId(),
            stackDepth: Number(stack.length),
            pageStack: stackIds(),
            pageStackOwner: "ClipHub.PageStack",
            navigationManagerOwner: "ClipHub.Navigator",
            navigationApiVersion: 2,
            canPop: navigatorCanPop(),
'''
if old_state not in text:
    raise SystemExit("getState stack anchor missing")
text = text.replace(old_state, new_state, 1)

export_anchor = '''    ClipHub.UIShell = {
        MODULE_NAME: "ch_16_ui_shell",
        MODULE_VERSION: 10,
'''
if export_anchor not in text:
    raise SystemExit("UIShell export anchor missing")
exports = r'''    ClipHub.PageStack = {
        API_VERSION: 1,
        push: pageStackPush,
        pop: pageStackPop,
        replace: pageStackReplace,
        current: pageStackCurrent,
        canPop: pageStackCanPop,
        size: pageStackSize,
        popTo: pageStackPopTo,
        popToRoot: pageStackPopToRoot,
        resetRoot: pageStackResetRoot,
        snapshot: stackSnapshot
    };

    ClipHub.Navigator = {
        API_VERSION: 1,
        push: navigatorPush,
        pop: navigatorPop,
        replace: navigatorReplace,
        current: navigatorCurrent,
        canPop: navigatorCanPop,
        stackSize: navigatorStackSize,
        popTo: navigatorPopTo,
        popToRoot: navigatorPopToRoot,
        reset: navigatorReset
    };

'''
text = text.replace(
    export_anchor,
    exports + export_anchor.replace("MODULE_VERSION: 10,", "MODULE_VERSION: 11,"),
    1,
)

SHELL_PATH.write_text(text, encoding="utf-8")

AUDIT = '''# Navigation Stage 1 审查记录｜2026-08-18

基线：`moduleSetVersion=20260818.02`，真机 Probe064=`LEGACY_BACK_SUCCEEDED`。

## 当前 Owner

- 页面定义：`ch_16_ui_shell.js / pages + registerPage()`。
- 页面栈：`ch_16_ui_shell.js / stack`。
- 页面宿主：`UIShell + Filter.mountPrimaryChildPage()`。
- Android Back：`ClipHub.Navigation`。
- 页面 Back：`UIShell.dispatchBack()` -> active page hook。
- IME Back：当前 Editor 已真机验证，公共 focus helper 位于 `ClipHub.Navigation`。

## Stage 1 发现

1. `stack` 已存在，但此前允许 `setStackPath/pushPage/popPage/unmountPage/init` 分别直接改写。
2. `UIShell` 同时承担 Registry、Stack、Host、Back 路由，职责重叠。
3. `isSameShellFamily/canEmbed/unmountPage/runtime diagnostics` 仍包含业务 pageId 硬编码。
4. `activePageId` 与 `stack.current` 同时存在；Stage 6-8 需进一步收口。
5. Navigation 仍有业务 module wrapper；Stage 8 清理。
6. Page Contract 尚未建立；Stage 7 实施。

## Stage 2-3 本轮边界

本轮只收口 PageStack 与 NavigationManager API，不改变既有页面创建方式、UIShell Host、业务退出逻辑、Back Owner、IME 行为。

新增 SSOT API：

- `ClipHub.PageStack`: `push/pop/replace/current/canPop/size/popTo/popToRoot/resetRoot/snapshot`
- `ClipHub.Navigator`: `push/pop/replace/current/canPop/stackSize/popTo/popToRoot/reset`

旧 `UIShell.enterRoot/pushPage/popPage/clearToRoot` 保留为兼容适配层，但不再直接修改 stack。

## 后续必须处理

Stage 4: BackDispatcher 最终只调用 Navigator。
Stage 5: IME Back 进入页面 Contract。
Stage 6-7: PageRegistry + DEFAULT_PAGE_CONTRACT。
Stage 8: 删除业务 pageId 硬编码。
Stage 9: NavigationArchitectureTestPage 零核心修改测试。
Stage 10: 完整回归 + Probe064 真机复验。
'''
Path("docs/Navigation_Stage1_Audit_20260818.md").write_text(AUDIT, encoding="utf-8")

TEST = r'''var fs = require("fs");
var shell = fs.readFileSync("src/ch_16_ui_shell.js", "utf8");
function need(token, message) {
    if (shell.indexOf(token) < 0) { throw new Error(message + ": " + token); }
}
need("function commitStackState(nextEntries, action, reason)", "PageStack commit owner missing");
need("function pageStackPush(pageId, params, reason)", "PageStack push missing");
need("function pageStackPop(reason)", "PageStack pop missing");
need("function pageStackReplace(pageId, params, reason)", "PageStack replace missing");
need("function pageStackCurrent()", "PageStack current missing");
need("function pageStackCanPop()", "PageStack canPop missing");
need("function pageStackSize()", "PageStack size missing");
need("ClipHub.PageStack = {", "PageStack public owner missing");
need("ClipHub.Navigator = {", "NavigationManager owner missing");
need("push: navigatorPush", "Navigator push missing");
need("pop: navigatorPop", "Navigator pop missing");
need("replace: navigatorReplace", "Navigator replace missing");
need("current: navigatorCurrent", "Navigator current missing");
need("canPop: navigatorCanPop", "Navigator canPop missing");
need("stackSize: navigatorStackSize", "Navigator stackSize missing");
need("return navigatorSyncPath(path, reason || \"legacy_set_stack_path\")", "legacy setStackPath bypasses Navigator");
need("return navigatorPush(pageId, params, reason || \"legacy_push_page\")", "legacy push bypasses Navigator");
need("return navigatorPop(reason || \"legacy_pop_page\")", "legacy pop bypasses Navigator");
need("navigatorPopToRoot(reason || \"unmount\")", "unmount bypasses Navigator");
if (shell.indexOf("stack.push(") >= 0 || shell.indexOf("stack.pop(") >= 0 ||
        shell.indexOf('stack = [{ id: "home"') >= 0 ||
        shell.indexOf("stack = [stack[0]]") >= 0 ||
        shell.indexOf("stack = next;") >= 0) {
    throw new Error("legacy direct stack mutation remains");
}
need('MODULE_VERSION: 11,', "UIShell module version not bumped");
console.log("Navigation Stage 2-3 contract: passed");
'''
Path("scripts/test_navigation_stage2_3_contract.js").write_text(TEST, encoding="utf-8")

AUDIT_SCRIPT = r'''var fs = require("fs");
var shell = fs.readFileSync("src/ch_16_ui_shell.js", "utf8");
var nav = fs.readFileSync("src/ch_12_translation.js", "utf8");
var tokens = ["home", "detail", "editor", "tags", "settings", "regex_rules", "regex_editor", "regex_test", "translation", "tokenizer", "tokenizer_rules", "tokenizer_rule_editor"];
var result = {};
tokens.forEach(function (id) {
    var re = new RegExp('\\"' + id + '\\"', 'g');
    result[id] = (shell.match(re) || []).length + (nav.match(re) || []).length;
});
console.log(JSON.stringify(result));
'''
Path("scripts/audit_navigation_page_id_hardcoding.js").write_text(AUDIT_SCRIPT, encoding="utf-8")

blob_sha = subprocess.check_output(["git", "hash-object", str(SHELL_PATH)], text=True).strip()
manifest_path = Path("module-manifest.json")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["moduleSetVersion"] = MODULE_SET
manifest["sourceRef"] = BRANCH
found = False
for item in manifest.get("modules", []):
    if item.get("name") == "ch_16_ui_shell.js":
        item["sha"] = blob_sha
        found = True
        break
if not found:
    raise SystemExit("manifest ch_16_ui_shell.js missing")
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
