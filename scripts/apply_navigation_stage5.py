from pathlib import Path
import json
import subprocess

BRANCH = "refactor/navigation-contract-v2-20260818"
SHELL = Path("src/ch_16_ui_shell.js")
text = SHELL.read_text(encoding="utf-8")

text = text.replace(
    '    var activeClose = null;\n    var mountCount = 0;\n',
    '    var activeClose = null;\n    var activeImeBackFirst = false;\n    var mountCount = 0;\n', 1)
text = text.replace(
    '    var rootBackCount = 0;\n    var lastBackSourceFamily = "";\n',
    '    var rootBackCount = 0;\n    var imeBackConsumeCount = 0;\n    var lastBackSourceFamily = "";\n', 1)

anchor = '    function backSourceFamily(reason) {\n'
helpers = r'''    function imeVisibleForBack() {
        var root = null;
        var insets = null;
        if (activeImeBackFirst !== true || activeView === null) { return false; }
        try { root = activeView.getRootView(); } catch (ignoredRoot) { root = null; }
        if (root === null) { return false; }
        try {
            if (Number(Packages.android.os.Build.VERSION.SDK_INT) >= 30) {
                insets = root.getRootWindowInsets();
                return insets !== null && insets.isVisible(
                    Packages.android.view.WindowInsets.Type.ime()) === true;
            }
        } catch (ignoredInsets) {}
        return false;
    }

    function consumeImeBackFirst() {
        var root = null;
        var focus = null;
        var token = null;
        var context = null;
        var imm = null;
        if (!imeVisibleForBack()) { return false; }
        try { root = activeView.getRootView(); } catch (ignoredRoot) { root = null; }
        if (root === null) { return false; }
        try { focus = root.findFocus(); } catch (ignoredFocus) { focus = null; }
        try { token = (focus !== null ? focus : root).getWindowToken(); }
        catch (ignoredToken) { token = null; }
        try {
            context = runtimeContext && runtimeContext.androidContext ?
                runtimeContext.androidContext : global.context;
            imm = context.getSystemService(
                Packages.android.content.Context.INPUT_METHOD_SERVICE);
        } catch (ignoredImm) { imm = null; }
        if (imm === null || token === null) { return false; }
        try { imm.hideSoftInputFromWindow(token, 0); }
        catch (hideError) { return false; }
        try {
            if (ClipHub.Navigation &&
                    typeof ClipHub.Navigation.handoffBackFocus === "function") {
                ClipHub.Navigation.handoffBackFocus({
                    pageRoot: activeView,
                    fallbackRoot: root,
                    inputView: focus
                });
            }
        } catch (ignoredHandoff) {}
        try {
            if (ClipHub.Navigation &&
                    typeof ClipHub.Navigation.refreshSystemBackCapture === "function") {
                ClipHub.Navigation.refreshSystemBackCapture(
                    "back_dispatcher_ime_hidden");
            }
        } catch (ignoredRefresh) {}
        imeBackConsumeCount += 1;
        return true;
    }

'''
if anchor not in text:
    raise SystemExit("Stage5 helper anchor missing")
text = text.replace(anchor, helpers + anchor, 1)

text = text.replace(
    '        activeClose = typeof spec.onClose === "function" ? spec.onClose : null;\n        ClipHub.Filter.mountPrimaryChildPage({\n',
    '        activeClose = typeof spec.onClose === "function" ? spec.onClose : null;\n        activeImeBackFirst = spec.imeBackFirst !== false;\n        ClipHub.Filter.mountPrimaryChildPage({\n', 1)
text = text.replace(
    '            onBack: opts.onBack,\n            onClose: opts.onClose\n',
    '            onBack: opts.onBack,\n            onClose: opts.onClose,\n            imeBackFirst: opts.imeBackFirst !== false\n', 1)
text = text.replace(
    '            onBack: value.onBack,\n            onClose: value.onClose\n',
    '            onBack: value.onBack,\n            onClose: value.onClose,\n            imeBackFirst: value.imeBackFirst !== false\n', 1)
text = text.replace(
    '        try {\n            if (typeof activeBack === "function") {\n',
    '        try {\n            if (consumeImeBackFirst()) {\n                lastBackOutcome = "ime_consumed";\n                return true;\n            }\n            if (typeof activeBack === "function") {\n', 1)
text = text.replace(
    '            rootBackCount: Number(rootBackCount),\n            duplicateCount: Number(duplicateBackRequestCount),\n',
    '            rootBackCount: Number(rootBackCount),\n            imeBackFirst: activeImeBackFirst === true,\n            imeBackConsumeCount: Number(imeBackConsumeCount),\n            duplicateCount: Number(duplicateBackRequestCount),\n', 1)
text = text.replace(
    '            rootBackCount: Number(rootBackCount),\n            lastBackSourceFamily: String(lastBackSourceFamily || ""),\n',
    '            rootBackCount: Number(rootBackCount),\n            imeBackFirst: activeImeBackFirst === true,\n            imeBackConsumeCount: Number(imeBackConsumeCount),\n            lastBackSourceFamily: String(lastBackSourceFamily || ""),\n', 1)
text = text.replace(
    '        activeClose = null;\n        mountCount = 0;\n',
    '        activeClose = null;\n        activeImeBackFirst = false;\n        mountCount = 0;\n', 1)
text = text.replace(
    '        rootBackCount = 0;\n        lastBackSourceFamily = "";\n',
    '        rootBackCount = 0;\n        imeBackConsumeCount = 0;\n        lastBackSourceFamily = "";\n', 1)
text = text.replace('MODULE_VERSION: 12,', 'MODULE_VERSION: 13,', 1)
SHELL.write_text(text, encoding="utf-8")

Path("scripts/test_navigation_stage5_ime_priority.js").write_text(r'''var fs = require("fs");
var shell = fs.readFileSync("src/ch_16_ui_shell.js", "utf8");
function need(token) { if (shell.indexOf(token) < 0) { throw new Error(token); } }
need("function imeVisibleForBack()");
need("WindowInsets.Type.ime()");
need("function consumeImeBackFirst()");
need("hideSoftInputFromWindow(token, 0)");
need("ClipHub.Navigation.handoffBackFocus({");
need('lastBackOutcome = "ime_consumed"');
var start = shell.indexOf("function backDispatcherDispatch(reason, request)");
var end = shell.indexOf("function dispatchBack(reason, request)", start);
var block = shell.substring(start, end);
if (!(block.indexOf("consumeImeBackFirst()") < block.indexOf('typeof activeBack === "function"') &&
      block.indexOf('typeof activeBack === "function"') < block.indexOf("navigatorCanPop()"))) {
    throw new Error("Back order must be IME -> page hook -> pop");
}
console.log("Navigation Stage 5 IME priority: passed");
''', encoding="utf-8")

Path("docs/Navigation_Stage5_IME_Back_20260818.md").write_text('''# Navigation Stage 5｜IME First-Back Priority\n\nBackDispatcher 顺序固定为：IME -> Page hook -> Navigator.pop。\n\n当前 Android/ShortX 真机上第一次系统侧滑仍可能由 IME 在 ClipHub 收到 Back 前直接消费；该路径保留 Probe064 已验证的 Editor visible-to-hidden + Primary Window Root focus handoff。对于 Toolbar、未来自定义手势或到达 BackDispatcher 时 IME 仍可见的情况，统一层只隐藏 IME并 consume，不允许同一次 Back 再 pop 页面。\n''', encoding="utf-8")

blob = subprocess.check_output(["git", "hash-object", str(SHELL)], text=True).strip()
manifest_path = Path("module-manifest.json")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["moduleSetVersion"] = "20260818.05"
manifest["sourceRef"] = BRANCH
for item in manifest["modules"]:
    if item["name"] == "ch_16_ui_shell.js":
        item["sha"] = blob
        break
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
