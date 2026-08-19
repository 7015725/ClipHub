var fs = require("fs");
var vm = require("vm");
var nav = fs.readFileSync("src/ch_12_translation.js", "utf8");
var shellSource = fs.readFileSync("src/ch_16_ui_shell.js", "utf8");
function requireText(source, text) {
    if (source.indexOf(text) < 0) { throw new Error("missing: " + text); }
}
requireText(nav, "function beginSystemBackGesture(reason)");
requireText(nav, "function resolveSystemBackGesture(reason)");
requireText(nav, "function consumeSystemBackGesture(gestureId)");
requireText(nav, "function systemBackInputFamily(reason)");
requireText(nav, 'requestId: "back:" + gestureId');
requireText(nav, "sourceFamily: systemBackInputFamily(reason)");
requireText(nav, 'sourceReason: String(reason || "system_back")');
requireText(nav, "ClipHub.UIShell.dispatchBack(");
requireText(nav, "navState.lastBackReason, request");
var navDispatchStart = nav.indexOf("function dispatchBack(owner, reason)");
var navDispatchEnd = nav.indexOf("function anyFocused()", navDispatchStart);
var navDispatch = nav.substring(navDispatchStart, navDispatchEnd);
if (navDispatch.indexOf("consumeSystemBackGesture") < 0 ||
        navDispatch.indexOf("ClipHub.UIShell.dispatchBack") < 0 ||
        navDispatch.indexOf("consumeSystemBackGesture") >
  navDispatch.indexOf("ClipHub.UIShell.dispatchBack")) {
    throw new Error("system gesture must be consumed before child dispatch");
}
requireText(shellSource, "function dispatchBack(reason, request)");
requireText(shellSource, "duplicateBackRequestCount += 1");
requireText(shellSource, "backDispatchInProgress");

var mounted = null;
var sandbox = {
    console: console,
    ClipHub: {
        Filter: {
  getPrimaryHostState: function () {
      return { ready: true, attached: true, rootMode: true,
          childAttached: mounted !== null };
  },
  mountPrimaryChildPage: function (spec) {
      mounted = spec;
      return true;
  },
  unmountPrimaryChildPage: function () {
      mounted = null;
      return true;
  }
        }
    }
};
vm.createContext(sandbox);
vm.runInContext(shellSource, sandbox, { filename: "ch_16_ui_shell.js" });
var ui = sandbox.ClipHub.UIShell;
var editorView = { id: "editor" };
var editorBackCount = 0;
var tagBackCount = 0;
function mountEditor() {
    ui.mountPage("editor", editorView, {
        title: "编辑",
        showBack: true,
        onBack: function () {
  editorBackCount += 1;
  return ui.unmountPage("editor", "test_editor_back");
        }
    });
}
function syncEditor() {
    return ui.syncEmbeddedPage({
        pageId: "editor",
        path: ["editor"],
        title: "编辑",
        showBack: true,
        view: editorView,
        onBack: function () {
  editorBackCount += 1;
  return ui.unmountPage("editor", "test_editor_back");
        }
    });
}
ui.init({});
mountEditor();
ui.syncEmbeddedPage({
    pageId: "tags",
    path: ["editor", "tags"],
    title: "标签",
    showBack: true,
    view: editorView,
    onBack: function () {
        tagBackCount += 1;
        return syncEditor();
    }
});
var request1 = {
    sourceFamily: "system", ownerPageId: "tags",
    generation: ui.getState().generation,
    requestId: "back:system:1", gestureId: "system:1"
};
if (ui.dispatchBack("navigation_system_back", request1) !== true) {
    throw new Error("first child back not handled");
}
if (ui.getState().currentPageId !== "editor" || tagBackCount !== 1) {
    throw new Error("tags must return exactly one level to editor");
}
if (ui.dispatchBack("navigation_system_back", request1) !== true) {
    throw new Error("duplicate request must be consumed");
}
if (ui.getState().currentPageId !== "editor" || editorBackCount !== 0) {
    throw new Error("same gesture cascaded through editor");
}
var request2 = {
    sourceFamily: "system", ownerPageId: "editor",
    generation: ui.getState().generation,
    requestId: "back:system:2", gestureId: "system:2"
};
if (ui.dispatchBack("navigation_system_back", request2) !== true) {
    throw new Error("second distinct back not handled");
}
if (ui.getState().currentPageId !== "home" || editorBackCount !== 1) {
    throw new Error("distinct gesture must return editor to home");
}
if (ui.getState().duplicateBackRequestCount !== 1) {
    throw new Error("duplicate request diagnostics mismatch");
}
if (ui.getState().backCascadeGuardCount !== 0) {
    throw new Error("unexpected multi-level cascade detected");
}
console.log("System Back gesture/request contract: passed");
