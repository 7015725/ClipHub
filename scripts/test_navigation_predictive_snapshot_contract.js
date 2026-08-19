var fs = require("fs");
var vm = require("vm");
var shellSource = fs.readFileSync("src/ch_16_ui_shell.js", "utf8");
var mounted = null;
var sandbox = {
    console: console,
    ClipHub: {
        Filter: {
            getPrimaryHostState: function () {
                return { ready: true, attached: true, rootMode: true,
                    childAttached: mounted !== null };
            },
            mountPrimaryChildPage: function (spec) { mounted = spec; return true; },
            unmountPrimaryChildPage: function () { mounted = null; return true; }
        }
    }
};
vm.createContext(sandbox);
vm.runInContext(shellSource, sandbox, { filename: "ch_16_ui_shell.js" });
var ui = sandbox.ClipHub.UIShell;
var back = sandbox.ClipHub.BackDispatcher;
var view = {};
ui.init({});
ui.mountPage("editor", view, {
    title: "Editor",
    showBack: true,
    onBack: function () { return ui.unmountPage("editor", "predictive_test_back"); }
});
if (!back || back.API_VERSION < 2 || back.OWNER !== "ClipHub.BackDispatcher") {
    throw new Error("BackDispatcher v2 owner missing");
}
var before = ui.getState();
var request1 = { sourceFamily: "predictive", sourceReason: "predictive_back",
    ownerPageId: "editor", generation: before.generation,
    requestId: "back:predictive:test:1", gestureId: "predictive:test:1" };
if (back.beginPredictive(request1) !== true) { throw new Error("predictive start failed"); }
var started = back.getState();
if (!started.predictiveBackActive || !started.predictiveBackSnapshot ||
        started.predictiveBackSnapshot.currentPageId !== "editor" ||
        started.predictiveBackSnapshot.previousPageId !== "home" ||
        started.predictiveBackSnapshot.depth !== 2) {
    throw new Error("predictive start did not freeze current/previous/stack");
}
back.progressPredictive(0.45, request1);
var progressed = ui.getState();
if (progressed.currentPageId !== "editor" || progressed.stackDepth !== 2 ||
        progressed.generation !== before.generation) {
    throw new Error("predictive start/progress mutated PageStack");
}
if (back.cancelPredictive(request1) !== true) { throw new Error("stable predictive cancel failed"); }
var cancelled = back.getState();
if (cancelled.predictiveBackActive || ui.getState().currentPageId !== "editor" ||
        ui.getState().stackDepth !== 2 || cancelled.predictiveBackCancelCount !== 1 ||
        cancelled.predictiveBackStableCancelCount !== 1) {
    throw new Error("predictive cancel did not preserve frozen stack");
}
var request2 = { sourceFamily: "predictive", sourceReason: "predictive_back",
    ownerPageId: "editor", generation: ui.getState().generation,
    requestId: "back:predictive:test:2", gestureId: "predictive:test:2" };
back.beginPredictive(request2);
back.progressPredictive(0.9, request2);
if (back.commitPredictive("predictive_back", request2) !== true) {
    throw new Error("predictive commit not handled");
}
if (ui.getState().currentPageId !== "home" || ui.getState().stackDepth !== 1) {
    throw new Error("predictive commit did not pop exactly once");
}
var committed = back.getState();
if (committed.predictiveBackCommitCount !== 1 ||
        committed.predictiveBackSnapshotMismatchCount !== 0) {
    throw new Error("predictive commit diagnostics mismatch");
}
if (back.commitPredictive("predictive_back", request2) !== true) {
    throw new Error("duplicate predictive commit must be consumed");
}
var duplicate = back.getState();
if (duplicate.predictiveBackCommitCount !== 1 ||
        duplicate.predictiveBackDuplicateCommitCount !== 1 ||
        ui.getState().stackDepth !== 1) {
    throw new Error("duplicate predictive commit caused second pop");
}
console.log("Navigation Predictive Back snapshot/commit contract: passed");
