from pathlib import Path
import json
import subprocess

BRANCH = "refactor/navigation-contract-v2-20260818"
NAV = Path("src/ch_12_translation.js")
SHELL = Path("src/ch_16_ui_shell.js")
nav = NAV.read_text(encoding="utf-8")
shell = SHELL.read_text(encoding="utf-8")

# Navigation: preserve exact Back input family across the system-capture bridge.
anchor = '''    function isSystemBackReason(reason) {
        reason = String(reason || "");
        return reason === "predictive_back" ||
            reason === "on_back_invoked" ||
            reason === "back_key" || reason === "escape_key";
    }
'''
helper = anchor + r'''
    function systemBackInputFamily(reason) {
        reason = String(reason || "");
        if (reason === "predictive_back") { return "predictive"; }
        if (reason === "back_key" || reason === "escape_key") {
            return "legacy_key";
        }
        if (reason === "on_back_invoked") { return "system"; }
        return "system";
    }
'''
if anchor not in nav:
    raise SystemExit("Navigation system Back reason anchor missing")
nav = nav.replace(anchor, helper, 1)

old_request = '''        request = {
            sourceFamily: "system",
            ownerPageId: shell.pageId || String(owner || ""),
            generation: Number(shell.generation || 0),
            requestId: "back:" + gestureId,
            gestureId: gestureId
        };
'''
new_request = '''        request = {
            sourceFamily: systemBackInputFamily(reason),
            sourceReason: String(reason || "system_back"),
            ownerPageId: shell.pageId || String(owner || ""),
            generation: Number(shell.generation || 0),
            requestId: "back:" + gestureId,
            gestureId: gestureId
        };
'''
if old_request not in nav:
    raise SystemExit("Navigation Back request anchor missing")
nav = nav.replace(old_request, new_request, 1)

old_shell_route = '''    if (shell.childAttached === true && ClipHub.UIShell &&
            typeof ClipHub.UIShell.dispatchBack === "function") {
        handled = ClipHub.UIShell.dispatchBack(
            "navigation_system_back", request) === true;
        if (handled) { navState.backHandledCount += 1; }
        log("I", "navigation child back page=" + shell.pageId +
            " request=" + String(request && request.requestId || "") +
            " handled=" + String(handled));
        return handled;
    }
'''
new_shell_route = '''    if (shell.pageId && ClipHub.UIShell &&
            typeof ClipHub.UIShell.dispatchBack === "function") {
        handled = ClipHub.UIShell.dispatchBack(
            navState.lastBackReason, request) === true;
        if (handled) { navState.backHandledCount += 1; }
        log("I", "navigation shell back page=" + shell.pageId +
            " source=" + String(request && request.sourceFamily || "page") +
            " request=" + String(request && request.requestId || "") +
            " handled=" + String(handled));
        return handled;
    }
'''
if old_shell_route not in nav:
    raise SystemExit("Navigation child Back route anchor missing")
nav = nav.replace(old_shell_route, new_shell_route, 1)

if 'MODULE_NAME: "ch_14_navigation_embedded",\n        MODULE_VERSION: 10,' not in nav:
    raise SystemExit("Navigation embedded v10 anchor missing")
nav = nav.replace('MODULE_NAME: "ch_14_navigation_embedded",\n        MODULE_VERSION: 10,',
                  'MODULE_NAME: "ch_14_navigation_embedded",\n        MODULE_VERSION: 11,', 1)
if 'MODULE_NAME: "ch_12_translation",\n        MODULE_VERSION: 23,' in nav:
    nav = nav.replace('MODULE_NAME: "ch_12_translation",\n        MODULE_VERSION: 23,',
                      'MODULE_NAME: "ch_12_translation",\n        MODULE_VERSION: 24,', 1)

# UIShell: trust explicit sourceFamily from Navigation and execute root behavior here.
old_source = '        lastBackSourceFamily = backSourceFamily(reason);\n        var pageContract = currentPageContract();\n'
new_source = '''        lastBackSourceFamily = normalizeId(value.sourceFamily || "");
        if (!lastBackSourceFamily) {
            lastBackSourceFamily = backSourceFamily(reason);
        }
        var pageContract = currentPageContract();
'''
if old_source not in shell:
    raise SystemExit("BackDispatcher source-family anchor missing")
shell = shell.replace(old_source, new_source, 1)

root_anchor = '''    function backDispatcherState() {
'''
root_helpers = r'''    function executeRootBehavior(contract, reason) {
        var behavior = String(contract && contract.rootBehavior || "none");
        var result = null;
        if (behavior === "consume") { return true; }
        if (behavior !== "close_host") { return false; }
        try {
            if (ClipHub.App && typeof ClipHub.App.hideUi === "function") {
                result = ClipHub.App.hideUi(
                    String(reason || "navigation_root_back"));
                return result !== false;
            }
        } catch (appHideError) {}
        try {
            if (ClipHub.Navigation &&
                    typeof ClipHub.Navigation.hideUi === "function") {
                result = ClipHub.Navigation.hideUi(
                    String(reason || "navigation_root_back"));
                return result !== false;
            }
        } catch (navigationHideError) {}
        return false;
    }

'''
if root_anchor not in shell:
    raise SystemExit("BackDispatcher root behavior anchor missing")
shell = shell.replace(root_anchor, root_helpers + root_anchor, 1)

old_root = '''            rootBackCount += 1;
            lastBackOutcome = "root_unhandled";
            return false;
'''
new_root = '''            rootBackCount += 1;
            handled = executeRootBehavior(pageContract,
                reason || "navigation_root_back") === true;
            lastBackOutcome = handled ? "root_handled" : "root_unhandled";
            return handled;
'''
if old_root not in shell:
    raise SystemExit("BackDispatcher root outcome anchor missing")
shell = shell.replace(old_root, new_root, 1)

if 'MODULE_NAME: "ch_16_ui_shell",\n        MODULE_VERSION: 17,' not in shell:
    raise SystemExit("UIShell v17 anchor missing")
shell = shell.replace('MODULE_NAME: "ch_16_ui_shell",\n        MODULE_VERSION: 17,',
                      'MODULE_NAME: "ch_16_ui_shell",\n        MODULE_VERSION: 18,', 1)

NAV.write_text(nav, encoding="utf-8")
SHELL.write_text(shell, encoding="utf-8")

Path("scripts/test_navigation_stage10_source_root.js").write_text(r'''var fs = require("fs");
var nav = fs.readFileSync("src/ch_12_translation.js", "utf8");
var shell = fs.readFileSync("src/ch_16_ui_shell.js", "utf8");
function need(source, token) {
    if (source.indexOf(token) < 0) { throw new Error(token); }
}
need(nav, "function systemBackInputFamily(reason)");
need(nav, 'reason === "predictive_back"');
need(nav, 'return "legacy_key";');
need(nav, "sourceFamily: systemBackInputFamily(reason)");
need(nav, "sourceReason: String(reason || \"system_back\")");
need(nav, "if (shell.pageId && ClipHub.UIShell");
need(nav, "navState.lastBackReason, request");
if (nav.indexOf("if (shell.childAttached === true && ClipHub.UIShell") >= 0) {
    throw new Error("Home Back still bypasses BackDispatcher");
}
need(shell, 'lastBackSourceFamily = normalizeId(value.sourceFamily || "")');
need(shell, "function executeRootBehavior(contract, reason)");
need(shell, 'behavior !== "close_host"');
need(shell, "ClipHub.App.hideUi(");
need(shell, 'lastBackOutcome = handled ? "root_handled" : "root_unhandled"');
need(shell, 'rootBehavior: "close_host"');
var callbackStart = nav.indexOf("function callbackFor(entry)");
var callbackEnd = nav.indexOf("function makeFocusable(entry)", callbackStart);
var callback = nav.substring(callbackStart, callbackEnd);
var started = callback.indexOf("onBackStarted: function");
var progressed = callback.indexOf("onBackProgressed: function");
var cancelled = callback.indexOf("onBackCancelled: function");
var invoked = callback.indexOf("onBackInvoked: function");
if (!(started >= 0 && progressed > started && cancelled > progressed && invoked > cancelled)) {
    throw new Error("Predictive Back phase order missing");
}
var preCommit = callback.substring(started, invoked);
if (preCommit.indexOf("dispatchBack(entry.owner") >= 0 ||
        preCommit.indexOf("Navigator.pop") >= 0 ||
        preCommit.indexOf("PageStack.pop") >= 0) {
    throw new Error("Predictive start/progress/cancel mutates navigation");
}
need(callback.substring(invoked), 'dispatchBack(entry.owner, "predictive_back")');
console.log("Navigation Stage 10 source/root Back: passed");
''', encoding="utf-8")

Path("docs/Navigation_Stage10_Static_Regression_20260818.md").write_text('''# Navigation Stage 10｜静态回归候选\n\n本阶段完成系统 Back source-family 透传与根页面统一 BackDispatcher：Predictive/Legacy/System 的来源由 Navigation 捕获后随 BackRequest 传入 BackDispatcher；Primary Host 的 Home Back 也进入同一个 BackDispatcher，不再在 Navigation 中单独走 Window Back 分支。Home 的 `rootBehavior=close_host` 由 BackDispatcher 执行。\n\nPredictive Back 保持 start/progress/cancel 不修改 PageStack，仅 commit/onBackInvoked 进入统一 BackDispatcher。\n\n静态门禁不能代替真机：最终仍需在 ShortX Android 14 上执行 Stage10 自动探测，复验 Editor IME 两段 Back，并验证 NavigationArchitectureTestPage 的 Registry + factory + IME + pop。\n''', encoding="utf-8")

# Make the existing primary Back test forward-compatible and check the new bridge.
test_path = Path("scripts/test_primary_window_system_back.py")
test = test_path.read_text(encoding="utf-8")
test = test.replace("assert 'MODULE_VERSION: 10' in nav",
                    "assert re.search(r'MODULE_NAME:\\s*\"ch_14_navigation_embedded\"[\\s\\S]*?MODULE_VERSION:\\s*(?:1[1-9]|[2-9][0-9])', nav)")
test = test.replace("assert '\"navigation_system_back\", request' in nav",
                    "assert 'navState.lastBackReason, request' in nav\nassert 'sourceFamily: systemBackInputFamily(reason)' in nav")
test_path.write_text(test, encoding="utf-8")

nav_blob = subprocess.check_output(["git", "hash-object", str(NAV)], text=True).strip()
shell_blob = subprocess.check_output(["git", "hash-object", str(SHELL)], text=True).strip()
manifest_path = Path("module-manifest.json")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["moduleSetVersion"] = "20260818.10"
manifest["sourceRef"] = BRANCH
for item in manifest["modules"]:
    if item["name"] == "ch_12_translation.js":
        item["sha"] = nav_blob
    if item["name"] == "ch_16_ui_shell.js":
        item["sha"] = shell_blob
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
