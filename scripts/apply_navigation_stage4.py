from pathlib import Path
import json
import subprocess

BRANCH = "refactor/navigation-contract-v2-20260818"
MODULE_SET = "20260818.04"
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


state_anchor = '''    var backCascadeGuardCount = 0;
    var lastBackRequestId = "";
'''
state_replacement = '''    var backCascadeGuardCount = 0;
    var backDispatcherCount = 0;
    var backHookDispatchCount = 0;
    var backHookConsumedCount = 0;
    var backHookNavigationCount = 0;
    var navigatorBackPopCount = 0;
    var rootBackCount = 0;
    var lastBackSourceFamily = "";
    var lastBackOutcome = "none";
    var lastBackRequestId = "";
'''
if state_anchor not in text:
    raise SystemExit("BackDispatcher state anchor missing")
text = text.replace(state_anchor, state_replacement, 1)

old_dispatch = '''    function dispatchBack(reason, request) {
    var value = request || {};
    var requestId = normalizeId(value.requestId || "");
    var beforeDepth = Number(stack.length);
    var beforePageId = currentPageId();
    var handled = false;
    lastAction = "dispatch_back";
    lastReason = String(reason || "");
    if (requestId && requestId === lastBackRequestId) {
        duplicateBackRequestCount += 1;
        return true;
    }
    if (backDispatchInProgress) {
        duplicateBackRequestCount += 1;
        return true;
    }
    if (requestId) { lastBackRequestId = requestId; }
    lastBackRequestGeneration = value.generation === undefined ? -1 :
        Number(value.generation);
    lastBackFromPageId = beforePageId === null ? "" :
        String(beforePageId);
    lastBackDepthBefore = beforeDepth;
    backDispatchInProgress = true;
    backDispatchCount += 1;
    try {
        if (typeof activeBack === "function") {
            handled = activeBack() === true;
        } else if (activePageId !== null) {
            handled = unmountPage(activePageId, reason) === true;
        }
        return handled;
    } finally {
        lastBackToPageId = currentPageId() === null ? "" :
            String(currentPageId());
        lastBackDepthAfter = Number(stack.length);
        if (lastBackDepthBefore - lastBackDepthAfter > 1) {
            backCascadeGuardCount += 1;
        }
        backDispatchInProgress = false;
    }
}'''
if old_dispatch not in text:
    raise SystemExit("existing dispatchBack block changed")
new_dispatch = r'''    function backSourceFamily(reason) {
        var value = String(reason || "").toLowerCase();
        if (value.indexOf("predictive") >= 0) { return "predictive"; }
        if (value === "on_back_invoked") { return "system"; }
        if (value === "back_key" || value === "escape_key") {
            return "legacy_key";
        }
        if (value.indexOf("gesture") >= 0 || value.indexOf("swipe") >= 0) {
            return "gesture";
        }
        if (value.indexOf("toolbar") >= 0 || value.indexOf("header") >= 0) {
            return "toolbar";
        }
        return "page";
    }

    function detachActivePageForNavigator(reason) {
        if (activePageId === null) { return true; }
        if (ClipHub.Filter &&
                typeof ClipHub.Filter.unmountPrimaryChildPage === "function") {
            ClipHub.Filter.unmountPrimaryChildPage(reason || "navigator_back");
        }
        activePageId = null;
        activeView = null;
        activeBack = null;
        activeClose = null;
        unmountCount += 1;
        return true;
    }

    function backDispatcherState() {
        return {
            apiVersion: 1,
            dispatching: backDispatchInProgress === true,
            dispatchCount: Number(backDispatcherCount),
            pageHookDispatchCount: Number(backHookDispatchCount),
            pageHookConsumedCount: Number(backHookConsumedCount),
            legacyHookNavigationCount: Number(backHookNavigationCount),
            navigatorPopCount: Number(navigatorBackPopCount),
            rootBackCount: Number(rootBackCount),
            duplicateCount: Number(duplicateBackRequestCount),
            lastSourceFamily: String(lastBackSourceFamily || ""),
            lastOutcome: String(lastBackOutcome || "none"),
            lastRequestId: String(lastBackRequestId || ""),
            lastFromPageId: String(lastBackFromPageId || ""),
            lastToPageId: String(lastBackToPageId || "")
        };
    }

    function backDispatcherDispatch(reason, request) {
        var value = request || {};
        var requestId = normalizeId(value.requestId || "");
        var beforeDepth = Number(stack.length);
        var beforePageId = currentPageId();
        var beforeGeneration = Number(generation);
        var handled = false;
        var hookChangedNavigation = false;
        lastAction = "dispatch_back";
        lastReason = String(reason || "");
        lastBackSourceFamily = backSourceFamily(reason);
        if (requestId && requestId === lastBackRequestId) {
            duplicateBackRequestCount += 1;
            lastBackOutcome = "duplicate_request";
            return true;
        }
        if (backDispatchInProgress) {
            duplicateBackRequestCount += 1;
            lastBackOutcome = "navigation_busy";
            return true;
        }
        if (requestId) { lastBackRequestId = requestId; }
        lastBackRequestGeneration = value.generation === undefined ? -1 :
            Number(value.generation);
        lastBackFromPageId = beforePageId === null ? "" :
            String(beforePageId);
        lastBackDepthBefore = beforeDepth;
        backDispatchInProgress = true;
        backDispatchCount += 1;
        backDispatcherCount += 1;
        try {
            if (typeof activeBack === "function") {
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
            if (navigatorCanPop()) {
                if (activePageId !== null) {
                    detachActivePageForNavigator(reason || "back_dispatcher_pop");
                }
                handled = navigatorPop(reason || "back_dispatcher_pop") === true;
                if (handled) {
                    navigatorBackPopCount += 1;
                    lastBackOutcome = "navigator_pop";
                    return true;
                }
            }
            rootBackCount += 1;
            lastBackOutcome = "root_unhandled";
            return false;
        } finally {
            lastBackToPageId = currentPageId() === null ? "" :
                String(currentPageId());
            lastBackDepthAfter = Number(stack.length);
            if (lastBackDepthBefore - lastBackDepthAfter > 1) {
                backCascadeGuardCount += 1;
            }
            backDispatchInProgress = false;
        }
    }

    function dispatchBack(reason, request) {
        return backDispatcherDispatch(reason, request);
    }'''
text = text.replace(old_dispatch, new_dispatch, 1)

state_output_anchor = '''            backCascadeGuardCount:
                Number(backCascadeGuardCount),
            lastBackRequestId: String(lastBackRequestId || ""),
'''
state_output_replacement = '''            backCascadeGuardCount:
                Number(backCascadeGuardCount),
            backDispatcherCount: Number(backDispatcherCount),
            backHookDispatchCount: Number(backHookDispatchCount),
            backHookConsumedCount: Number(backHookConsumedCount),
            legacyHookNavigationCount: Number(backHookNavigationCount),
            navigatorBackPopCount: Number(navigatorBackPopCount),
            rootBackCount: Number(rootBackCount),
            lastBackSourceFamily: String(lastBackSourceFamily || ""),
            lastBackOutcome: String(lastBackOutcome || "none"),
            lastBackRequestId: String(lastBackRequestId || ""),
'''
if state_output_anchor not in text:
    raise SystemExit("getState BackDispatcher anchor missing")
text = text.replace(state_output_anchor, state_output_replacement, 1)

init_anchor = '''        backCascadeGuardCount = 0;
        lastBackRequestId = "";
'''
init_replacement = '''        backCascadeGuardCount = 0;
        backDispatcherCount = 0;
        backHookDispatchCount = 0;
        backHookConsumedCount = 0;
        backHookNavigationCount = 0;
        navigatorBackPopCount = 0;
        rootBackCount = 0;
        lastBackSourceFamily = "";
        lastBackOutcome = "none";
        lastBackRequestId = "";
'''
if init_anchor not in text:
    raise SystemExit("init BackDispatcher reset anchor missing")
text = text.replace(init_anchor, init_replacement, 1)

export_anchor = '''    ClipHub.PageStack = {
        API_VERSION: 1,
'''
back_export = '''    ClipHub.BackDispatcher = {
        API_VERSION: 1,
        dispatch: backDispatcherDispatch,
        getState: backDispatcherState
    };

'''
if export_anchor not in text:
    raise SystemExit("PageStack export anchor missing")
text = text.replace(export_anchor, back_export + export_anchor, 1)

if 'MODULE_VERSION: 11,' not in text:
    raise SystemExit("UIShell v11 anchor missing")
text = text.replace('MODULE_VERSION: 11,', 'MODULE_VERSION: 12,', 1)
text = text.replace('_navigation_stage2_3",', '_navigation_stage2_3_back_dispatcher",', 1)
SHELL.write_text(text, encoding="utf-8")

TEST = r'''var fs = require("fs");
var shell = fs.readFileSync("src/ch_16_ui_shell.js", "utf8");
var nav = fs.readFileSync("src/ch_12_translation.js", "utf8");
function need(source, token, message) {
    if (source.indexOf(token) < 0) { throw new Error(message + ": " + token); }
}
need(shell, "ClipHub.BackDispatcher = {", "BackDispatcher owner missing");
need(shell, "dispatch: backDispatcherDispatch", "BackDispatcher dispatch API missing");
need(shell, "function backDispatcherDispatch(reason, request)", "BackDispatcher state machine missing");
need(shell, "return backDispatcherDispatch(reason, request);", "UIShell Back does not delegate to BackDispatcher");
need(shell, "if (typeof activeBack === \"function\")", "page Back hook phase missing");
need(shell, "hookChangedNavigation", "legacy hook navigation bridge missing");
need(shell, "if (navigatorCanPop())", "BackDispatcher canPop phase missing");
need(shell, "handled = navigatorPop(reason || \"back_dispatcher_pop\") === true", "BackDispatcher final pop missing");
need(shell, "lastBackOutcome = \"page_hook_consumed\"", "page consume outcome missing");
need(shell, "lastBackOutcome = \"navigator_pop\"", "navigator pop outcome missing");
need(shell, "lastBackOutcome = \"root_unhandled\"", "root outcome missing");
need(shell, "backDispatchInProgress", "Back concurrency guard missing");
need(shell, "duplicateBackRequestCount", "Back request dedupe missing");
need(nav, "ClipHub.UIShell.dispatchBack(", "Android Back no longer enters UIShell bridge");
need(nav, "onBackStarted: function", "Predictive start missing");
need(nav, "onBackProgressed: function", "Predictive progress missing");
need(nav, "onBackCancelled: function", "Predictive cancel missing");
need(nav, "onBackInvoked: function", "Predictive commit missing");
need(shell, 'MODULE_VERSION: 12,', "UIShell module version not bumped");
console.log("Navigation Stage 4 BackDispatcher contract: passed");
'''
Path("scripts/test_navigation_stage4_back_dispatcher.js").write_text(TEST, encoding="utf-8")

DOC = '''# Navigation Stage 4｜BackDispatcher 收口｜2026-08-18

## Owner

`ClipHub.BackDispatcher` 成为页面 Back 状态机入口。Android Legacy Back、Predictive Back 当前仍由 `ClipHub.Navigation` 捕获，再通过兼容的 `UIShell.dispatchBack()` 进入 BackDispatcher；UIShell 不再拥有独立的返回算法。

## 顺序

1. 请求去重 / 导航忙保护；
2. 当前页面 Back hook；
3. hook 若只消费事件则停止；
4. 兼容期若旧 hook 已修改导航状态，识别为 `legacy_hook_navigation`，禁止第二次 pop；
5. 未消费且 `Navigator.canPop()` 时，最终只调用一次 `Navigator.pop()`；
6. 根页面返回 `root_unhandled`，由现有 Window/Home 行为继续处理。

## Predictive Back

`start/progress/cancel` 不进入 PageStack mutation；只有 `onBackInvoked` 才进入统一 BackDispatcher。当前 ShortX 真机 capability=false，实际仍使用已通过 Probe064 的 `legacy_key` 路径。

## 兼容边界

现有页面 `onBack/requestExit` 仍可能自行关闭页面并同步栈。Stage 4 通过 `legacy_hook_navigation` 检测避免 double-pop；Stage 6-8 迁移 PageContract 后，这类 hook 将只允许 consume/continue，不再修改 PageStack。
'''
Path("docs/Navigation_Stage4_BackDispatcher_20260818.md").write_text(DOC, encoding="utf-8")

blob_sha = subprocess.check_output(["git", "hash-object", str(SHELL)], text=True).strip()
manifest_path = Path("module-manifest.json")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["moduleSetVersion"] = MODULE_SET
manifest["sourceRef"] = BRANCH
for item in manifest.get("modules", []):
    if item.get("name") == "ch_16_ui_shell.js":
        item["sha"] = blob_sha
        break
else:
    raise SystemExit("manifest UIShell entry missing")
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
