from pathlib import Path
import hashlib
import json
import re


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise SystemExit("%s replacement count=%d for anchor %r" %
                         (path, count, old[:120]))
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


def regex_once(path, pattern, replacement):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    updated, count = re.subn(pattern, replacement, text, count=1,
                             flags=re.MULTILINE)
    if count != 1:
        raise SystemExit("%s regex replacement count=%d for %r" %
                         (path, count, pattern[:120]))
    p.write_text(updated, encoding="utf-8")


# ---------------------------------------------------------------------------
# UIShell: BackDispatcher v2 Predictive Back transaction
# ---------------------------------------------------------------------------
replace_once(
    "src/ch_16_ui_shell.js",
    "    var lastBackDepthBefore = 0;\n"
    "    var lastBackDepthAfter = 0;\n\n"
    "    function normalizeId(value) {",
    """    var lastBackDepthBefore = 0;
    var lastBackDepthAfter = 0;
    var predictiveBackSession = null;
    var predictiveBackStartCount = 0;
    var predictiveBackProgressCount = 0;
    var predictiveBackCancelCount = 0;
    var predictiveBackCommitCount = 0;
    var predictiveBackStableCancelCount = 0;
    var predictiveBackSnapshotMismatchCount = 0;
    var predictiveBackDuplicateCommitCount = 0;
    var lastPredictiveCommitRequestId = "";
    var lastPredictiveProgress = 0;

    function normalizeId(value) {""")

replace_once(
    "src/ch_16_ui_shell.js",
    "    function backDispatcherState() {\n",
    """    function predictiveBackSnapshot() {
        var ids = stackIds();
        return {
            generation: Number(generation),
            depth: Number(ids.length),
            currentPageId: ids.length > 0 ? String(ids[ids.length - 1]) : null,
            previousPageId: ids.length > 1 ? String(ids[ids.length - 2]) : null,
            pageIds: ids.slice(0),
            entries: stackSnapshot()
        };
    }

    function copyPredictiveBackSnapshot(snapshot) {
        if (!snapshot) { return null; }
        return {
            generation: Number(snapshot.generation),
            depth: Number(snapshot.depth),
            currentPageId: snapshot.currentPageId === null ? null :
                String(snapshot.currentPageId),
            previousPageId: snapshot.previousPageId === null ? null :
                String(snapshot.previousPageId),
            pageIds: (snapshot.pageIds || []).slice(0)
        };
    }

    function predictiveBackSnapshotMatches(snapshot) {
        var ids;
        var expected;
        var index;
        if (!snapshot) { return false; }
        ids = stackIds();
        expected = snapshot.pageIds || [];
        if (Number(generation) !== Number(snapshot.generation) ||
                ids.length !== expected.length ||
                currentPageId() !== snapshot.currentPageId) {
            return false;
        }
        for (index = 0; index < ids.length; index += 1) {
            if (String(ids[index]) !== String(expected[index])) { return false; }
        }
        return true;
    }

    function predictiveRequestId(request) {
        var value = request || {};
        return normalizeId(value.requestId || value.gestureId || "");
    }

    function beginPredictiveBack(request) {
        var value = request || {};
        var requestId = predictiveRequestId(value);
        if (predictiveBackSession !== null) {
            if (!requestId || requestId === predictiveBackSession.requestId) {
                return true;
            }
            predictiveBackSnapshotMismatchCount += 1;
        }
        predictiveBackSession = {
            requestId: requestId,
            gestureId: normalizeId(value.gestureId || ""),
            sourceReason: normalizeId(value.sourceReason || "predictive_back"),
            snapshot: predictiveBackSnapshot(),
            lastProgress: 0
        };
        predictiveBackStartCount += 1;
        lastPredictiveProgress = 0;
        return true;
    }

    function progressPredictiveBack(progress, request) {
        var value = Number(progress || 0);
        var requestId = predictiveRequestId(request || {});
        if (!predictiveBackSession) {
            beginPredictiveBack(request || {});
        }
        if (!predictiveBackSession) { return false; }
        if (requestId && predictiveBackSession.requestId &&
                requestId !== predictiveBackSession.requestId) {
            predictiveBackSnapshotMismatchCount += 1;
            return false;
        }
        if (!isFinite(value)) { value = 0; }
        value = Math.max(0, Math.min(1, value));
        predictiveBackSession.lastProgress = value;
        lastPredictiveProgress = value;
        predictiveBackProgressCount += 1;
        if (!predictiveBackSnapshotMatches(predictiveBackSession.snapshot)) {
            predictiveBackSnapshotMismatchCount += 1;
            return false;
        }
        return true;
    }

    function cancelPredictiveBack(request) {
        var requestId = predictiveRequestId(request || {});
        var stable = true;
        if (!predictiveBackSession) { return true; }
        if (requestId && predictiveBackSession.requestId &&
                requestId !== predictiveBackSession.requestId) {
            predictiveBackSnapshotMismatchCount += 1;
            stable = false;
        }
        if (!predictiveBackSnapshotMatches(predictiveBackSession.snapshot)) {
            predictiveBackSnapshotMismatchCount += 1;
            stable = false;
        }
        predictiveBackCancelCount += 1;
        if (stable) { predictiveBackStableCancelCount += 1; }
        predictiveBackSession = null;
        lastPredictiveProgress = 0;
        return stable;
    }

    function commitPredictiveBack(reason, request) {
        var value = request || {};
        var requestId = predictiveRequestId(value);
        var stable;
        var handled;
        if (requestId && requestId === lastPredictiveCommitRequestId) {
            predictiveBackDuplicateCommitCount += 1;
            return true;
        }
        if (!predictiveBackSession) {
            beginPredictiveBack(value);
        }
        if (!predictiveBackSession) { return false; }
        if (requestId && predictiveBackSession.requestId &&
                requestId !== predictiveBackSession.requestId) {
            predictiveBackSnapshotMismatchCount += 1;
            predictiveBackSession = null;
            return false;
        }
        stable = predictiveBackSnapshotMatches(predictiveBackSession.snapshot);
        if (!stable) {
            predictiveBackSnapshotMismatchCount += 1;
            predictiveBackSession = null;
            return false;
        }
        predictiveBackCommitCount += 1;
        lastPredictiveCommitRequestId = requestId;
        predictiveBackSession = null;
        lastPredictiveProgress = 1;
        handled = backDispatcherDispatch(reason || "predictive_back", value) === true;
        return handled;
    }

    function backDispatcherState() {
""")

replace_once(
    "src/ch_16_ui_shell.js",
    "            apiVersion: 1,\n"
    "            dispatching: backDispatchInProgress === true,",
    """            apiVersion: 2,
            owner: "ClipHub.BackDispatcher",
            dispatching: backDispatchInProgress === true,
            predictiveBackActive: predictiveBackSession !== null,
            predictiveBackStartCount: Number(predictiveBackStartCount),
            predictiveBackProgressCount: Number(predictiveBackProgressCount),
            predictiveBackCancelCount: Number(predictiveBackCancelCount),
            predictiveBackCommitCount: Number(predictiveBackCommitCount),
            predictiveBackStableCancelCount:
                Number(predictiveBackStableCancelCount),
            predictiveBackSnapshotMismatchCount:
                Number(predictiveBackSnapshotMismatchCount),
            predictiveBackDuplicateCommitCount:
                Number(predictiveBackDuplicateCommitCount),
            predictiveBackSnapshot: predictiveBackSession === null ? null :
                copyPredictiveBackSnapshot(predictiveBackSession.snapshot),
            lastPredictiveProgress: Number(lastPredictiveProgress),""")

replace_once(
    "src/ch_16_ui_shell.js",
    "            pageStackOwner: \"ClipHub.PageStack\",\n"
    "            navigationManagerOwner: \"ClipHub.Navigator\",\n"
    "            navigationApiVersion: 2,",
    """            pageStackOwner: "ClipHub.PageStack",
            navigationManagerOwner: "ClipHub.Navigator",
            navigationApiVersion: 2,
            backDispatcherOwner: "ClipHub.BackDispatcher",
            backDispatcherApiVersion: 2,
            predictiveBackActive: predictiveBackSession !== null,
            predictiveBackStartCount: Number(predictiveBackStartCount),
            predictiveBackProgressCount: Number(predictiveBackProgressCount),
            predictiveBackCancelCount: Number(predictiveBackCancelCount),
            predictiveBackCommitCount: Number(predictiveBackCommitCount),
            predictiveBackStableCancelCount:
                Number(predictiveBackStableCancelCount),
            predictiveBackSnapshotMismatchCount:
                Number(predictiveBackSnapshotMismatchCount),
            predictiveBackDuplicateCommitCount:
                Number(predictiveBackDuplicateCommitCount),
            predictiveBackSnapshot: predictiveBackSession === null ? null :
                copyPredictiveBackSnapshot(predictiveBackSession.snapshot),""")

replace_once(
    "src/ch_16_ui_shell.js",
    "        lastBackDepthBefore = 0;\n"
    "        lastBackDepthAfter = 0;\n"
    "        mutationCount = 0;",
    """        lastBackDepthBefore = 0;
        lastBackDepthAfter = 0;
        predictiveBackSession = null;
        predictiveBackStartCount = 0;
        predictiveBackProgressCount = 0;
        predictiveBackCancelCount = 0;
        predictiveBackCommitCount = 0;
        predictiveBackStableCancelCount = 0;
        predictiveBackSnapshotMismatchCount = 0;
        predictiveBackDuplicateCommitCount = 0;
        lastPredictiveCommitRequestId = "";
        lastPredictiveProgress = 0;
        mutationCount = 0;""")

replace_once(
    "src/ch_16_ui_shell.js",
    """    ClipHub.BackDispatcher = {
        API_VERSION: 1,
        dispatch: backDispatcherDispatch,
        getState: backDispatcherState
    };""",
    """    ClipHub.BackDispatcher = {
        API_VERSION: 2,
        OWNER: "ClipHub.BackDispatcher",
        dispatch: backDispatcherDispatch,
        beginPredictive: beginPredictiveBack,
        progressPredictive: progressPredictiveBack,
        cancelPredictive: cancelPredictiveBack,
        commitPredictive: commitPredictiveBack,
        getState: backDispatcherState
    };""")

replace_once(
    "src/ch_16_ui_shell.js",
    "        MODULE_NAME: \"ch_16_ui_shell\",\n        MODULE_VERSION: 19,",
    "        MODULE_NAME: \"ch_16_ui_shell\",\n        MODULE_VERSION: 20,")

# ---------------------------------------------------------------------------
# Android Navigation bridge -> BackDispatcher predictive transaction
# ---------------------------------------------------------------------------
replace_once(
    "src/ch_12_translation.js",
    "\nfunction beginSystemBackGesture(reason) {",
    """
function predictiveBackRequest(owner, reason, gestureId) {
    var shell = shellBackSnapshot();
    return {
        sourceFamily: "predictive",
        sourceReason: String(reason || "predictive_back"),
        ownerPageId: shell.pageId || String(owner || ""),
        generation: Number(shell.generation || 0),
        requestId: "back:" + String(gestureId || ""),
        gestureId: String(gestureId || "")
    };
}

function beginPredictiveBackContract(owner, reason, gestureId) {
    try {
        if (ClipHub.BackDispatcher &&
                typeof ClipHub.BackDispatcher.beginPredictive === "function") {
            return ClipHub.BackDispatcher.beginPredictive(
                predictiveBackRequest(owner, reason, gestureId)) === true;
        }
    } catch (error) { navState.lastError = String(error); }
    return false;
}

function progressPredictiveBackContract(owner, event, gestureId) {
    var progress = 0;
    try { progress = Number(event.getProgress()); }
    catch (ignoredProgress) { progress = 0; }
    try {
        if (ClipHub.BackDispatcher &&
                typeof ClipHub.BackDispatcher.progressPredictive === "function") {
            return ClipHub.BackDispatcher.progressPredictive(progress,
                predictiveBackRequest(owner, "predictive_back", gestureId)) === true;
        }
    } catch (error) { navState.lastError = String(error); }
    return false;
}

function cancelPredictiveBackContract(owner, gestureId) {
    try {
        if (ClipHub.BackDispatcher &&
                typeof ClipHub.BackDispatcher.cancelPredictive === "function") {
            return ClipHub.BackDispatcher.cancelPredictive(
                predictiveBackRequest(owner, "predictive_back", gestureId)) === true;
        }
    } catch (error) { navState.lastError = String(error); }
    return false;
}

function beginSystemBackGesture(reason) {""")

regex_once(
    "src/ch_12_translation.js",
    r'''    if \(shell\.pageId && ClipHub\.UIShell &&\n\s+typeof ClipHub\.UIShell\.dispatchBack === "function"\) \{\n\s+handled = ClipHub\.UIShell\.dispatchBack\(\n\s+navState\.lastBackReason, request\) === true;''',
    """    if (shell.pageId && ClipHub.UIShell &&
            typeof ClipHub.UIShell.dispatchBack === "function") {
        if (systemBack && request && request.sourceFamily === "predictive" &&
                ClipHub.BackDispatcher &&
                typeof ClipHub.BackDispatcher.commitPredictive === "function") {
            handled = ClipHub.BackDispatcher.commitPredictive(
                navState.lastBackReason, request) === true;
        } else {
            handled = ClipHub.UIShell.dispatchBack(
                navState.lastBackReason, request) === true;
        }""")

replace_once(
    "src/ch_12_translation.js",
    """                        onBackStarted: function (event) {
                            navState.backStartedCount += 1;
                            beginSystemBackGesture("predictive_back");
                            applyProgress(entry.view, event);
                        },
                        onBackProgressed: function (event) {
                            applyProgress(entry.view, event);
                        },
                        onBackCancelled: function () {
                            navState.backCancelledCount += 1;
                            cancelSystemBackGesture();
                            resetVisual(entry.view);
                        },
                        onBackInvoked: function () {
                            resetVisual(entry.view);
                            dispatchBack(entry.owner, "predictive_back");
                        }""",
    """                        onBackStarted: function (event) {
                            var gestureId;
                            navState.backStartedCount += 1;
                            gestureId = beginSystemBackGesture("predictive_back");
                            beginPredictiveBackContract(entry.owner,
                                "predictive_back", gestureId);
                            progressPredictiveBackContract(entry.owner,
                                event, gestureId);
                            applyProgress(entry.view, event);
                        },
                        onBackProgressed: function (event) {
                            var gestureId = activeBackGestureId ||
                                beginSystemBackGesture("predictive_back");
                            progressPredictiveBackContract(entry.owner,
                                event, gestureId);
                            applyProgress(entry.view, event);
                        },
                        onBackCancelled: function () {
                            var gestureId = activeBackGestureId;
                            navState.backCancelledCount += 1;
                            cancelPredictiveBackContract(entry.owner, gestureId);
                            cancelSystemBackGesture();
                            resetVisual(entry.view);
                        },
                        onBackInvoked: function () {
                            resetVisual(entry.view);
                            dispatchBack(entry.owner, "predictive_back");
                        }""")

replace_once(
    "src/ch_12_translation.js",
    "        MODULE_NAME: \"ch_14_navigation_embedded\",\n"
    "        MODULE_VERSION: 11,",
    "        MODULE_NAME: \"ch_14_navigation_embedded\",\n"
    "        MODULE_VERSION: 12,")

# ---------------------------------------------------------------------------
# Stage 8: freeze LegacyNavigationAdapter hardcoding, keep Core at zero IDs
# ---------------------------------------------------------------------------
Path("scripts/audit_navigation_page_id_hardcoding.js").write_text(
    r'''var fs = require("fs");
var shell = fs.readFileSync("src/ch_16_ui_shell.js", "utf8");
var nav = fs.readFileSync("src/ch_12_translation.js", "utf8");
var ids = ["home", "detail", "editor", "tags", "settings", "regex_rules", "regex_editor", "regex_test", "translation", "tokenizer", "tokenizer_rules", "tokenizer_rule_editor"];
var baselineMax = {home:18, detail:11, editor:17, tags:7, settings:19, regex_rules:2, regex_editor:2, regex_test:1, translation:13, tokenizer:8, tokenizer_rules:2, tokenizer_rule_editor:1};
var coreFunctions = ["isSameShellFamily", "canEmbed", "pageStackPush", "pageStackPop", "pageStackReplace", "navigatorPush", "navigatorPop", "navigatorReplace", "backDispatcherDispatch", "predictiveBackSnapshot", "beginPredictiveBack", "progressPredictiveBack", "cancelPredictiveBack", "commitPredictiveBack"];
function block(source, name) {
    var start = source.indexOf("function " + name + "(");
    var end;
    if (start < 0) { throw new Error("missing core function " + name); }
    end = source.indexOf("\n    function ", start + 10);
    if (end < 0) { end = source.indexOf("\nfunction ", start + 10); }
    return source.substring(start, end < 0 ? source.length : end);
}
coreFunctions.forEach(function (name) {
    var source = block(shell, name);
    ids.forEach(function (id) {
        if (source.indexOf('"' + id + '"') >= 0) {
            throw new Error("Navigation core hardcodes business page id " + id + " in " + name);
        }
    });
});
var counts = {};
ids.forEach(function (id) {
    var re = new RegExp('\\"' + id + '\\"', 'g');
    counts[id] = (shell.match(re) || []).length + (nav.match(re) || []).length;
    if (counts[id] > baselineMax[id]) {
        throw new Error("legacy/core business page-id count grew for " + id + ": " + counts[id] + " > " + baselineMax[id]);
    }
});
console.log(JSON.stringify({status:"passed", coreBusinessPageIds:0, legacyCompatibilityFrozen:true, counts:counts}));
''', encoding="utf-8")

replace_once(
    "scripts/test_navigation_stage8_no_page_hardcoding.js",
    '["isSameShellFamily", "canEmbed", "unmountPage", "navigatorPush", "navigatorPop", "backDispatcherDispatch"].forEach(function (name) {',
    '["isSameShellFamily", "canEmbed", "unmountPage", "navigatorPush", "navigatorPop", "backDispatcherDispatch", "predictiveBackSnapshot", "beginPredictiveBack", "progressPredictiveBack", "cancelPredictiveBack", "commitPredictiveBack"].forEach(function (name) {')

# ---------------------------------------------------------------------------
# Predictive Back contract simulation
# ---------------------------------------------------------------------------
Path("scripts/test_navigation_predictive_snapshot_contract.js").write_text(
    r'''var fs = require("fs");
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
''', encoding="utf-8")

replace_once(
    "scripts/test_navigation_stage4_back_dispatcher.js",
    'need(shell, "dispatch: backDispatcherDispatch", "BackDispatcher dispatch API missing");\n',
    '''need(shell, "dispatch: backDispatcherDispatch", "BackDispatcher dispatch API missing");
need(shell, "beginPredictive: beginPredictiveBack", "Predictive begin API missing");
need(shell, "progressPredictive: progressPredictiveBack", "Predictive progress API missing");
need(shell, "cancelPredictive: cancelPredictiveBack", "Predictive cancel API missing");
need(shell, "commitPredictive: commitPredictiveBack", "Predictive commit API missing");
need(shell, 'backDispatcherOwner: "ClipHub.BackDispatcher"', "BackDispatcher owner diagnostics missing");
''')

replace_once(
    ".github/workflows/navigation_stage1_3_gate.yml",
    "          node scripts/test_system_back_gesture_contract.js\n",
    "          node scripts/test_system_back_gesture_contract.js\n"
    "          node scripts/test_navigation_predictive_snapshot_contract.js\n")

# ---------------------------------------------------------------------------
# Probe 065 v2 / owner coverage / final module set
# ---------------------------------------------------------------------------
p = Path("probes/cliphub_navigation_contract_probe_065.js")
probe = p.read_text(encoding="utf-8")
probe = probe.replace("module set 20260818.11", "module set 20260818.12", 1)
probe = probe.replace('var REQUIRED_SET = "20260818.11";',
                      'var REQUIRED_SET = "20260818.12";', 1)
probe = probe.replace("probeVersion: 1", "probeVersion: 2")
old = """                navigationApiVersion: number(shell.navigationApiVersion),
                backDispatchCount: number(shell.backDispatchCount),"""
new = """                navigationApiVersion: number(shell.navigationApiVersion),
                backDispatcherOwner: String(shell.backDispatcherOwner || ""),
                backDispatcherApiVersion:
                    number(shell.backDispatcherApiVersion),
                predictiveBackActive: shell.predictiveBackActive === true,
                predictiveBackStartCount:
                    number(shell.predictiveBackStartCount),
                predictiveBackCancelCount:
                    number(shell.predictiveBackCancelCount),
                predictiveBackCommitCount:
                    number(shell.predictiveBackCommitCount),
                predictiveBackSnapshotMismatchCount:
                    number(shell.predictiveBackSnapshotMismatchCount),
                backDispatchCount: number(shell.backDispatchCount),"""
if probe.count(old) != 1:
    raise SystemExit("probe shell owner anchor mismatch")
probe = probe.replace(old, new, 1)
old = """            current.shell.pageStackOwner === "ClipHub.PageStack" &&
            current.shell.navigationManagerOwner === "ClipHub.Navigator" &&
            current.shell.navigationApiVersion >= 2;"""
new = """            current.shell.pageStackOwner === "ClipHub.PageStack" &&
            current.shell.navigationManagerOwner === "ClipHub.Navigator" &&
            current.shell.navigationApiVersion >= 2 &&
            current.shell.backDispatcherOwner === "ClipHub.BackDispatcher" &&
            current.shell.backDispatcherApiVersion >= 2;"""
if probe.count(old) != 1:
    raise SystemExit("probe architectureReady anchor mismatch")
probe = probe.replace(old, new, 1)
old = """            backDispatcherCount: after.shell.backDispatcherCount -
                before.shell.backDispatcherCount,
            imeBackConsumeCount: after.shell.imeBackConsumeCount -"""
new = """            backDispatcherCount: after.shell.backDispatcherCount -
                before.shell.backDispatcherCount,
            predictiveBackStartCount: after.shell.predictiveBackStartCount -
                before.shell.predictiveBackStartCount,
            predictiveBackCancelCount: after.shell.predictiveBackCancelCount -
                before.shell.predictiveBackCancelCount,
            predictiveBackCommitCount: after.shell.predictiveBackCommitCount -
                before.shell.predictiveBackCommitCount,
            predictiveBackSnapshotMismatchCount:
                after.shell.predictiveBackSnapshotMismatchCount -
                before.shell.predictiveBackSnapshotMismatchCount,
            imeBackConsumeCount: after.shell.imeBackConsumeCount -"""
if probe.count(old) != 1:
    raise SystemExit("probe diff anchor mismatch")
probe = probe.replace(old, new, 1)
p.write_text(probe, encoding="utf-8")

replace_once(
    "probes/navigation_architecture_test_page.js",
    " * Run after ClipHub is started on moduleSetVersion 20260818.09.\n",
    " * Run after ClipHub is started on moduleSetVersion 20260818.12 or newer.\n")

# ---------------------------------------------------------------------------
# Manifest: exact Git blob SHA and module set
# ---------------------------------------------------------------------------
manifest_path = Path("module-manifest.json")
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["moduleSetVersion"] = "20260818.12"


def git_blob_sha(path):
    data = Path(path).read_bytes()
    header = ("blob %d\0" % len(data)).encode("ascii")
    return hashlib.sha1(header + data).hexdigest()


updates = {
    "src/ch_12_translation.js": git_blob_sha("src/ch_12_translation.js"),
    "src/ch_16_ui_shell.js": git_blob_sha("src/ch_16_ui_shell.js")
}
for module in manifest.get("modules", []):
    if module.get("path") in updates:
        module["sha"] = updates[module["path"]
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                         encoding="utf-8")

print(json.dumps({
    "ok": True,
    "moduleSetVersion": manifest["moduleSetVersion"],
    "updatedModuleShas": updates
}, ensure_ascii=False))
