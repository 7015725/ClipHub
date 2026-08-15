#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = '5c172ff793dab66673f2fd5a404834d6f7a92b29'
MODULE_SET = '20260815.17'

ui_path = ROOT / 'src/ch_16_ui_shell.js'
app_path = ROOT / 'src/ch_15_app.js'
preflight_path = ROOT / 'scripts/release_preflight.sh'
manifest_path = ROOT / 'module-manifest.json'
test_path = ROOT / 'scripts/test_runtime_diagnostics.js'

ui = ui_path.read_text(encoding='utf-8')
app = app_path.read_text(encoding='utf-8')
preflight = preflight_path.read_text(encoding='utf-8')

if 'MODULE_VERSION: 5' not in ui:
    raise SystemExit('UIShell v5 anchor missing')
if 'MODULE_VERSION: 21' not in app:
    raise SystemExit('App v21 anchor missing')

runtime_diag = r'''
    var RUNTIME_DIAGNOSTIC_SCHEMA_VERSION = 1;

    function safeRuntimeState(module, method) {
        try {
            if (module && typeof module[method] === "function") {
                return module[method]() || {};
            }
        } catch (ignored) {}
        return {};
    }

    function runtimeAttached(value) {
        value = value || {};
        return value.attached === true || value.attachedToWindow === true;
    }

    function runtimeListContains(values, target) {
        var index;
        values = values || [];
        for (index = 0; index < values.length; index += 1) {
            if (String(values[index]) === String(target)) { return true; }
        }
        return false;
    }

    function runtimeAddIssue(issues, code, detail) {
        issues.push({ code: String(code), detail: String(detail || "") });
    }

    function runtimeEditorFamily(pageId) {
        return pageId === "editor" || pageId === "tags" ||
            pageId === "tokenizer";
    }

    function runtimeSettingsFamily(pageId) {
        return pageId === "settings" || pageId === "regex_rules" ||
            pageId === "regex_editor" || pageId === "regex_test";
    }

    function runtimeSizeMismatch(actual, expected) {
        actual = Number(actual || 0);
        expected = Number(expected || 0);
        return actual > 0 && expected > 0 && Math.abs(actual - expected) > 2;
    }

    function getRuntimeDiagnostics() {
        var shell = getState();
        var host = primaryHostState();
        var filter = safeRuntimeState(ClipHub.Filter, "getPanelState");
        var filterIme = safeRuntimeState(ClipHub.Filter, "getImeAvoidanceState");
        var windowState = safeRuntimeState(ClipHub.Window, "getState");
        var removal = safeRuntimeState(ClipHub.Window, "getRemovalState");
        var detail = safeRuntimeState(ClipHub.List, "getDetailState");
        var editor = safeRuntimeState(ClipHub.Editor, "getState");
        var settings = safeRuntimeState(ClipHub.Settings, "getState");
        var translation = safeRuntimeState(ClipHub.Translation, "getState");
        var tokenizer = safeRuntimeState(ClipHub.TokenizerUI, "getState");
        var issues = [];
        var legacy = [];
        var attachedFamilies = [];
        var active = normalizeId(shell.activePageId);
        var current = normalizeId(shell.currentPageId);
        var childPage = normalizeId(host.childPageId);
        var stack = shell.pageStack || [];
        var stackLast = stack.length > 0 ? normalizeId(stack[stack.length - 1]) : "";
        var detailAttached = runtimeAttached(detail);
        var editorAttached = runtimeAttached(editor);
        var settingsAttached = runtimeAttached(settings);
        var translationAttached = runtimeAttached(translation);
        var filterAttached = runtimeAttached(filter);
        var editorImeHidden;
        var settingsImeHidden;

        if (detailAttached) { attachedFamilies.push("detail"); }
        if (editorAttached) { attachedFamilies.push("editor"); }
        if (settingsAttached) { attachedFamilies.push("settings"); }
        if (translationAttached) { attachedFamilies.push("translation"); }

        if (detailAttached && detail.embeddedInPrimary !== true) {
            legacy.push("detail");
        }
        if (editorAttached && editor.embeddedInPrimary !== true) {
            legacy.push("editor");
        }
        if (settingsAttached && settings.embeddedInPrimary !== true) {
            legacy.push("settings");
        }
        if (translationAttached && translation.embeddedInPrimary !== true) {
            legacy.push("translation");
        }

        if (host.ready === true) {
            if (filterAttached !== true || host.rootMode !== true ||
                    filter.rootMode !== true) {
                runtimeAddIssue(issues, "PRIMARY_HOST_STATE_MISMATCH",
                    "primary host ready without attached root Filter");
            }
            if (windowState.primaryAttached !== true) {
                runtimeAddIssue(issues, "PRIMARY_BINDING_MISSING",
                    "Filter host is ready but Window primary binding is absent");
            }
            if (Number(windowState.managedWindowCount || 0) !== 1) {
                runtimeAddIssue(issues, "MULTIPLE_MANAGED_WINDOWS",
                    "managedWindowCount=" +
                    String(Number(windowState.managedWindowCount || 0)));
            }
            if (host.homeCachePreserved !== true) {
                runtimeAddIssue(issues, "HOME_CACHE_NOT_PRESERVED",
                    "primary host lost cached Home root");
            }
        }

        if (active) {
            if (host.ready !== true) {
                runtimeAddIssue(issues, "ACTIVE_PAGE_WITHOUT_PRIMARY_HOST",
                    active);
            }
            if (host.childAttached !== true) {
                runtimeAddIssue(issues, "SHELL_ACTIVE_WITHOUT_CHILD", active);
            }
            if (current !== active || stackLast !== active) {
                runtimeAddIssue(issues, "SHELL_STACK_ACTIVE_MISMATCH",
                    "active=" + active + ",current=" + current +
                    ",last=" + stackLast);
            }
            if (childPage && childPage !== active) {
                runtimeAddIssue(issues, "HOST_CHILD_PAGE_MISMATCH",
                    "host=" + childPage + ",active=" + active);
            }
        } else {
            if (host.childAttached === true) {
                runtimeAddIssue(issues, "SHELL_CHILD_WITHOUT_ACTIVE",
                    childPage || "unknown");
            }
            if (current && current !== "home") {
                runtimeAddIssue(issues, "HOME_STACK_MISMATCH", current);
            }
        }

        if (attachedFamilies.length > 1) {
            runtimeAddIssue(issues, "PAGE_STATE_OVERLAP",
                attachedFamilies.join(","));
        }

        if (detailAttached && detail.embeddedInPrimary === true &&
                active !== "detail") {
            runtimeAddIssue(issues, "STALE_DETAIL_STATE", active || "home");
        }
        if (editorAttached && editor.embeddedInPrimary === true &&
                !runtimeEditorFamily(active)) {
            runtimeAddIssue(issues, "STALE_EDITOR_STATE", active || "home");
        }
        if (settingsAttached && settings.embeddedInPrimary === true &&
                !runtimeSettingsFamily(active)) {
            runtimeAddIssue(issues, "STALE_SETTINGS_STATE", active || "home");
        }
        if (translationAttached && translation.embeddedInPrimary === true &&
                active !== "translation") {
            runtimeAddIssue(issues, "STALE_TRANSLATION_STATE",
                active || "home");
        }

        if (active === "detail" && !detailAttached) {
            runtimeAddIssue(issues, "ACTIVE_DETAIL_NOT_ATTACHED", "detail");
        }
        if (runtimeEditorFamily(active) && !editorAttached) {
            runtimeAddIssue(issues, "ACTIVE_EDITOR_FAMILY_NOT_ATTACHED", active);
        }
        if (runtimeSettingsFamily(active) && !settingsAttached) {
            runtimeAddIssue(issues, "ACTIVE_SETTINGS_FAMILY_NOT_ATTACHED", active);
        }
        if (active === "translation" && !translationAttached) {
            runtimeAddIssue(issues, "ACTIVE_TRANSLATION_NOT_ATTACHED",
                "translation");
        }
        if (tokenizer.mounted === true && active !== "tokenizer") {
            runtimeAddIssue(issues, "TOKENIZER_STACK_MISMATCH",
                active || "home");
        }
        if (tokenizer.mounted === true && !editorAttached) {
            runtimeAddIssue(issues, "TOKENIZER_WITHOUT_EDITOR", "mounted");
        }
        if (tokenizer.embeddedInPrimary === true &&
                editor.embeddedInPrimary !== true) {
            runtimeAddIssue(issues, "TOKENIZER_EMBED_WITHOUT_EDITOR_EMBED",
                "embedded");
        }

        if (host.ready === true && editorAttached &&
                editor.embeddedInPrimary === true) {
            if (runtimeSizeMismatch(editor.panelWidthDp, host.widthDp) ||
                    runtimeSizeMismatch(editor.panelHeightDp, host.heightDp)) {
                runtimeAddIssue(issues, "EDITOR_HOST_SIZE_MISMATCH",
                    String(editor.panelWidthDp) + "x" +
                    String(editor.panelHeightDp) + " vs " +
                    String(host.widthDp) + "x" + String(host.heightDp));
            }
        }
        if (host.ready === true && settingsAttached &&
                settings.embeddedInPrimary === true) {
            if (runtimeSizeMismatch(settings.panelWidthDp, host.widthDp) ||
                    runtimeSizeMismatch(settings.panelHeightDp, host.heightDp)) {
                runtimeAddIssue(issues, "SETTINGS_HOST_SIZE_MISMATCH",
                    String(settings.panelWidthDp) + "x" +
                    String(settings.panelHeightDp) + " vs " +
                    String(host.widthDp) + "x" + String(host.heightDp));
            }
        }
        if (host.ready === true && translationAttached &&
                translation.embeddedInPrimary === true) {
            if (runtimeSizeMismatch(translation.panelWidthDp, host.widthDp) ||
                    runtimeSizeMismatch(translation.panelHeightDp, host.heightDp)) {
                runtimeAddIssue(issues, "TRANSLATION_HOST_SIZE_MISMATCH",
                    String(translation.panelWidthDp) + "x" +
                    String(translation.panelHeightDp) + " vs " +
                    String(host.widthDp) + "x" + String(host.heightDp));
            }
        }

        editorImeHidden = editor.inputFocused !== true &&
            editor.keyboardVisible !== true &&
            Number(editor.imeInsetBottomDp || 0) <= 0;
        if (editorAttached && editor.embeddedInPrimary === true &&
                editorImeHidden && Number(editor.normalPanelHeightDp || 0) > 0 &&
                Number(editor.currentPanelHeightDp || 0) > 0 &&
                runtimeSizeMismatch(editor.currentPanelHeightDp,
                    editor.normalPanelHeightDp)) {
            runtimeAddIssue(issues, "EDITOR_IME_HEIGHT_NOT_RESTORED",
                String(editor.currentPanelHeightDp) + " vs " +
                String(editor.normalPanelHeightDp));
        }
        if (editorAttached && editor.embeddedInPrimary === true &&
                editorImeHidden && Math.abs(Number(editor.currentPanelTopDp || 0)) > 2) {
            runtimeAddIssue(issues, "EDITOR_IME_TOP_NOT_RESTORED",
                String(editor.currentPanelTopDp));
        }

        settingsImeHidden = settings.inputFocused !== true &&
            settings.keyboardVisible !== true &&
            Number(settings.imeInsetBottomDp || 0) <= 0;
        if (settingsAttached && settings.embeddedInPrimary === true &&
                settingsImeHidden && Number(settings.normalPanelHeightDp || 0) > 0 &&
                Number(settings.currentPanelHeightDp || 0) > 0 &&
                runtimeSizeMismatch(settings.currentPanelHeightDp,
                    settings.normalPanelHeightDp)) {
            runtimeAddIssue(issues, "SETTINGS_IME_HEIGHT_NOT_RESTORED",
                String(settings.currentPanelHeightDp) + " vs " +
                String(settings.normalPanelHeightDp));
        }
        if (settingsAttached && settings.embeddedInPrimary === true &&
                settingsImeHidden && Math.abs(Number(settings.currentPanelTopDp || 0)) > 2) {
            runtimeAddIssue(issues, "SETTINGS_IME_TOP_NOT_RESTORED",
                String(settings.currentPanelTopDp));
        }

        return {
            schemaVersion: RUNTIME_DIAGNOSTIC_SCHEMA_VERSION,
            health: issues.length > 0 ? "warn" :
                (legacy.length > 0 ? "fallback" : "ok"),
            issueCount: Number(issues.length),
            issues: issues,
            legacyFallbackActive: legacy,
            shell: {
                activePageId: active || null,
                currentPageId: current || null,
                pageStack: stack.slice(0),
                childAttached: host.childAttached === true,
                childPageId: childPage || null
            },
            primaryWindow: {
                ready: host.ready === true,
                attached: host.attached === true,
                rootMode: host.rootMode === true,
                homeCachePreserved: host.homeCachePreserved === true,
                widthDp: Number(host.widthDp || 0),
                heightDp: Number(host.heightDp || 0),
                primaryAttached: windowState.primaryAttached === true,
                managedWindowCount: Number(windowState.managedWindowCount || 0),
                managedWindowRoles: (windowState.managedWindowRoles || []).slice(0),
                moving: windowState.moving === true,
                resizing: windowState.resizing === true
            },
            pages: {
                detail: {
                    attached: detailAttached,
                    embeddedInPrimary: detail.embeddedInPrimary === true,
                    itemId: detail.itemId === undefined ? null : detail.itemId
                },
                editor: {
                    attached: editorAttached,
                    embeddedInPrimary: editor.embeddedInPrimary === true,
                    mode: String(editor.mode || ""),
                    itemId: editor.itemId === undefined ? null : editor.itemId,
                    unsavedChanges: editor.unsavedChanges === true,
                    pendingDraftPresent: editor.pendingDraftPresent === true,
                    exitConfirmVisible: editor.exitConfirmVisible === true
                },
                settings: {
                    attached: settingsAttached,
                    embeddedInPrimary: settings.embeddedInPrimary === true,
                    page: String(settings.settingsPage || ""),
                    tab: String(settings.settingsTab || ""),
                    regexEditorOpen: settings.regexEditorOpen === true,
                    regexTestRunning: settings.regexTestRunning === true
                },
                translation: {
                    attached: translationAttached,
                    embeddedInPrimary: translation.embeddedInPrimary === true,
                    itemId: translation.itemId === undefined ? null :
                        translation.itemId,
                    running: translation.running === true
                },
                tokenizer: {
                    mounted: tokenizer.mounted === true,
                    embeddedInPrimary: tokenizer.embeddedInPrimary === true,
                    mode: String(tokenizer.mode || ""),
                    editorRootCaptured: tokenizer.editorRootCaptured === true
                }
            },
            ime: {
                filter: filterIme,
                editor: {
                    inputFocused: editor.inputFocused === true,
                    keyboardVisible: editor.keyboardVisible === true,
                    keyboardRequestCount: Number(editor.keyboardRequestCount || 0),
                    softInputAdjustResize: editor.softInputAdjustResize === true,
                    imeInsetsSupported: editor.imeInsetsSupported === true,
                    imeInsetSource: String(editor.imeInsetSource || "none"),
                    imeInsetBottomDp: Number(editor.imeInsetBottomDp || 0),
                    availableAboveImeDp: Number(editor.availableAboveImeDp || 0),
                    normalPanelHeightDp: Number(editor.normalPanelHeightDp || 0),
                    currentPanelHeightDp: Number(editor.currentPanelHeightDp || 0),
                    currentPanelTopDp: Number(editor.currentPanelTopDp || 0),
                    restoreSnapshotCount: Number(editor.imeRestoreSnapshotCount || 0),
                    restoreApplyCount: Number(editor.imeRestoreApplyCount || 0)
                },
                settings: {
                    inputFocused: settings.inputFocused === true,
                    keyboardVisible: settings.keyboardVisible === true,
                    keyboardRequestCount: Number(settings.keyboardRequestCount || 0),
                    softInputAdjustResize: settings.softInputAdjustResize === true,
                    imeInsetsSupported: settings.imeInsetsSupported === true,
                    imeInsetSource: String(settings.imeInsetSource || "none"),
                    imeInsetBottomDp: Number(settings.imeInsetBottomDp || 0),
                    availableAboveImeDp: Number(settings.availableAboveImeDp || 0),
                    normalPanelHeightDp: Number(settings.normalPanelHeightDp || 0),
                    currentPanelHeightDp: Number(settings.currentPanelHeightDp || 0),
                    currentPanelTopDp: Number(settings.currentPanelTopDp || 0),
                    restoreSnapshotCount: Number(settings.imeRestoreSnapshotCount || 0),
                    restoreFallbackCount: Number(settings.imeRestoreFallbackCount || 0),
                    staleSignalIgnoredCount:
                        Number(settings.imeStaleSignalIgnoredCount || 0)
                }
            },
            removal: {
                pendingSafeRemoveCount: Number(removal.pendingSafeRemoveCount || 0),
                failureCount: Number(removal.safeRemoveFailureCount || 0),
                timeoutCount: Number(removal.safeRemoveTimeoutCount || 0),
                lastRole: removal.lastSafeRemoveRole || null,
                lastReason: removal.lastSafeRemoveReason || null,
                lastError: removal.lastSafeRemoveError || null
            }
        };
    }
'''

anchor = '''    function getState() {\n        var host = primaryHostState();'''
if anchor not in ui:
    raise SystemExit('UIShell getState anchor missing')
ui = ui.replace(anchor, runtime_diag + '\n' + anchor, 1)
ui = ui.replace('MODULE_VERSION: 5,', 'MODULE_VERSION: 6,', 1)
ui = ui.replace(
    'migrationStage: "primary_window_settings_regex_translation_editor_tags_tokenizer_detail_filter_overlay_closed",',
    'migrationStage: "primary_window_settings_regex_translation_editor_tags_tokenizer_detail_filter_overlay_closed_runtime_diagnostics",',
    1)
export_anchor = '''        getState: getState,\n        shutdown: shutdown'''
if export_anchor not in ui:
    raise SystemExit('UIShell export anchor missing')
ui = ui.replace(export_anchor,
    '''        getState: getState,\n        getRuntimeDiagnostics: getRuntimeDiagnostics,\n        shutdown: shutdown''', 1)
ui_path.write_text(ui, encoding='utf-8')

app = app.replace('MODULE_VERSION: 21,', 'MODULE_VERSION: 22,', 1)
app_anchor = '''        var uiShell = safeState(ClipHub.UIShell, "getState", {});\n        var detailAttached = detail.attachedToWindow === true ||'''
if app_anchor not in app:
    raise SystemExit('App uiStatus anchor missing')
app = app.replace(app_anchor,
    '''        var uiShell = safeState(ClipHub.UIShell, "getState", {});\n        var runtimeDiagnostics = safeState(\n            ClipHub.UIShell, "getRuntimeDiagnostics", null);\n        var detailAttached = detail.attachedToWindow === true ||''', 1)
return_anchor = '''            scrollPerformance: safeState(\n                ClipHub.Filter, "getScrollPerformanceState", null),\n            uiShell: uiShell\n        };'''
if return_anchor not in app:
    raise SystemExit('App status return anchor missing')
app = app.replace(return_anchor,
    '''            scrollPerformance: safeState(\n                ClipHub.Filter, "getScrollPerformanceState", null),\n            uiShell: uiShell,\n            runtimeDiagnostics: runtimeDiagnostics\n        };''', 1)
app_path.write_text(app, encoding='utf-8')

test_source = r'''/* Stage7 runtime diagnostics regression. Node-only; keep ES5 syntax. */
(function () {
    var fs = require("fs");
    var vm = require("vm");
    var source = fs.readFileSync("src/ch_16_ui_shell.js", "utf8");
    var mounted = null;
    var runtime = {
        filter: {
            attached: true,
            attachedToWindow: true,
            rootMode: true,
            panelWidthDp: 390,
            panelHeightDp: 688
        },
        windowState: {
            primaryAttached: true,
            managedWindowCount: 1,
            managedWindowRoles: ["filter_root"],
            moving: false,
            resizing: false
        },
        removal: {
            pendingSafeRemoveCount: 0,
            safeRemoveFailureCount: 0,
            safeRemoveTimeoutCount: 0,
            lastSafeRemoveRole: null,
            lastSafeRemoveReason: null,
            lastSafeRemoveError: null
        },
        detail: {},
        editor: {},
        settings: {},
        translation: {},
        tokenizer: {}
    };
    var sandbox = {
        console: console,
        ClipHub: {
            Filter: {
                getPrimaryHostState: function () {
                    return {
                        ready: true,
                        attached: true,
                        rootMode: true,
                        childAttached: mounted !== null,
                        childPageId: mounted ? String(mounted.pageId || "") : "",
                        childTitle: mounted ? String(mounted.title || "") : "",
                        widthDp: 390,
                        heightDp: 688,
                        homeCachePreserved: true,
                        windowReuseOnly: true
                    };
                },
                getPanelState: function () { return runtime.filter; },
                getImeAvoidanceState: function () {
                    return { active: false, keyboardVisible: false };
                },
                mountPrimaryChildPage: function (spec) {
                    mounted = spec;
                    return true;
                },
                unmountPrimaryChildPage: function () {
                    mounted = null;
                    return true;
                }
            },
            Window: {
                getState: function () { return runtime.windowState; },
                getRemovalState: function () { return runtime.removal; }
            },
            List: {
                getDetailState: function () { return runtime.detail; }
            },
            Editor: {
                getState: function () { return runtime.editor; }
            },
            Settings: {
                getState: function () { return runtime.settings; }
            },
            Translation: {
                getState: function () { return runtime.translation; }
            },
            TokenizerUI: {
                getState: function () { return runtime.tokenizer; }
            }
        }
    };
    var ui;
    var diag;

    function assertTrue(value, label) {
        if (!value) { throw new Error(label); }
    }

    function hasIssue(code) {
        var index;
        for (index = 0; index < diag.issues.length; index += 1) {
            if (diag.issues[index].code === code) { return true; }
        }
        return false;
    }

    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, { filename: "ch_16_ui_shell.js" });
    ui = sandbox.ClipHub.UIShell;
    ui.init({});

    diag = ui.getRuntimeDiagnostics();
    assertTrue(diag.schemaVersion === 1, "diagnostic schema");
    assertTrue(diag.health === "ok", "home diagnostics must be ok");
    assertTrue(diag.issueCount === 0, "home issue count");
    assertTrue(diag.primaryWindow.managedWindowCount === 1,
        "single primary window");

    runtime.detail = {
        attached: true,
        attachedToWindow: true,
        embeddedInPrimary: true,
        itemId: 7
    };
    ui.mountPage("detail", { id: "detail" }, {
        title: "内容详情",
        showBack: true,
        onBack: function () {
            runtime.detail = {};
            return ui.unmountPage("detail", "test_detail_back");
        }
    });
    diag = ui.getRuntimeDiagnostics();
    assertTrue(diag.health === "ok", "detail diagnostics");
    assertTrue(diag.shell.activePageId === "detail", "detail active");
    ui.dispatchBack("test");

    runtime.editor = {
        attached: true,
        attachedToWindow: true,
        embeddedInPrimary: true,
        mode: "edit",
        itemId: 8,
        panelWidthDp: 390,
        panelHeightDp: 688,
        inputFocused: false,
        keyboardVisible: false,
        imeInsetBottomDp: 0,
        normalPanelHeightDp: 688,
        currentPanelHeightDp: 688,
        currentPanelTopDp: 0
    };
    ui.mountPage("editor", { id: "editor" }, {
        title: "编辑剪贴板", showBack: true
    });
    runtime.tokenizer = {
        mounted: true,
        embeddedInPrimary: true,
        mode: "normal",
        editorRootCaptured: true
    };
    ui.syncEmbeddedPage({
        pageId: "tokenizer",
        path: ["editor", "tokenizer"],
        title: "分词",
        showBack: true,
        view: { id: "editor" }
    });
    diag = ui.getRuntimeDiagnostics();
    assertTrue(diag.health === "ok", "tokenizer diagnostics");
    assertTrue(diag.pages.tokenizer.mounted === true, "tokenizer mounted");

    runtime.editor.currentPanelHeightDp = 520;
    diag = ui.getRuntimeDiagnostics();
    assertTrue(hasIssue("EDITOR_IME_HEIGHT_NOT_RESTORED"),
        "editor IME restore mismatch must be detected");
    runtime.editor.currentPanelHeightDp = 688;

    runtime.windowState.managedWindowCount = 2;
    diag = ui.getRuntimeDiagnostics();
    assertTrue(hasIssue("MULTIPLE_MANAGED_WINDOWS"),
        "multiple managed windows must be detected");
    runtime.windowState.managedWindowCount = 1;

    runtime.tokenizer = {};
    runtime.editor = {};
    ui.unmountPage("editor", "test_editor_close");

    runtime.settings = {
        attached: true,
        attachedToWindow: true,
        embeddedInPrimary: true,
        settingsPage: "regex_test",
        settingsTab: "filter",
        panelWidthDp: 390,
        panelHeightDp: 688,
        inputFocused: false,
        keyboardVisible: false,
        imeInsetBottomDp: 0,
        normalPanelHeightDp: 688,
        currentPanelHeightDp: 688,
        currentPanelTopDp: 0
    };
    ui.mountPage("settings", { id: "settings" }, {
        title: "ClipHub 设置", showBack: false
    });
    ui.syncEmbeddedPage({
        pageId: "regex_test",
        path: ["settings", "regex_rules", "regex_editor", "regex_test"],
        title: "正则测试",
        showBack: true,
        view: { id: "settings" }
    });
    diag = ui.getRuntimeDiagnostics();
    assertTrue(diag.health === "ok", "regex diagnostics");
    runtime.settings = {};
    ui.unmountPage("settings", "test_settings_close");

    runtime.translation = {
        attached: true,
        attachedToWindow: true,
        embeddedInPrimary: true,
        itemId: 9,
        running: false,
        panelWidthDp: 390,
        panelHeightDp: 688
    };
    ui.mountPage("translation", { id: "translation" }, {
        title: "翻译结果", showBack: false
    });
    diag = ui.getRuntimeDiagnostics();
    assertTrue(diag.health === "ok", "translation diagnostics");
    runtime.translation = {};
    ui.unmountPage("translation", "test_translation_close");

    runtime.detail = {
        attached: true,
        attachedToWindow: true,
        embeddedInPrimary: false,
        itemId: 10
    };
    mounted = null;
    sandbox.ClipHub.Filter.getPrimaryHostState = function () {
        return {
            ready: false, attached: false, rootMode: false,
            childAttached: false, childPageId: "",
            widthDp: 0, heightDp: 0, homeCachePreserved: false
        };
    };
    runtime.filter = {};
    runtime.windowState = {
        primaryAttached: false,
        managedWindowCount: 1,
        managedWindowRoles: ["detail"]
    };
    diag = ui.getRuntimeDiagnostics();
    assertTrue(diag.health === "fallback", "legacy fallback health");
    assertTrue(diag.legacyFallbackActive[0] === "detail",
        "legacy detail must be visible in diagnostics");

    console.log("UIShell Stage7 runtime diagnostics: passed");
}());
'''
test_path.write_text(test_source, encoding='utf-8')

preflight = preflight.replace("EXPECTED_MODULE_SET='20260815.16'", "EXPECTED_MODULE_SET='20260815.17'", 1)
# The settings-tabs case contains its own module set assignment.
preflight = preflight.replace("EXPECTED_MODULE_SET='20260815.16'", "EXPECTED_MODULE_SET='20260815.17'", 1)
preflight = preflight.replace("EXPECTED_APP_MODULE_VERSION='21'", "EXPECTED_APP_MODULE_VERSION='22'", 1)
preflight = preflight.replace('"ch_15_app.js": ("ch_15_app", 21),',
                              '"ch_15_app.js": ("ch_15_app", 22),', 1)
preflight = preflight.replace('"ch_16_ui_shell.js": ("ch_16_ui_shell", 5),',
                              '"ch_16_ui_shell.js": ("ch_16_ui_shell", 6),', 1)
preflight = preflight.replace('assert "MODULE_VERSION: 5" in ui_shell_source',
                              'assert "MODULE_VERSION: 6" in ui_shell_source', 1)
preflight = preflight.replace(
    'assert \'migrationStage: "primary_window_settings_regex_translation_editor_tags_tokenizer_detail_filter_overlay_closed"\' in ui_shell_source',
    'assert \'migrationStage: "primary_window_settings_regex_translation_editor_tags_tokenizer_detail_filter_overlay_closed_runtime_diagnostics"\' in ui_shell_source',
    1)
contract_anchor = '''        assert 'uiShell: uiShell' in app\n        print("UI shell stage5 contracts: passed")'''
if contract_anchor not in preflight:
    raise SystemExit('preflight stage5 contract anchor missing')
preflight = preflight.replace(contract_anchor,
    '''        assert 'uiShell: uiShell' in app\n        assert 'runtimeDiagnostics: runtimeDiagnostics' in app\n        assert 'RUNTIME_DIAGNOSTIC_SCHEMA_VERSION = 1' in ui_shell_source\n        assert 'getRuntimeDiagnostics: getRuntimeDiagnostics' in ui_shell_source\n        print("UI shell stage7 contracts: passed")''', 1)
nav_anchor = '''if [ "$MODE" = '--settings-tabs-beta' ]; then\n  node scripts/test_ui_shell_navigation.js\nfi'''
if nav_anchor not in preflight:
    raise SystemExit('preflight navigation test anchor missing')
preflight = preflight.replace(nav_anchor,
    '''if [ "$MODE" = '--settings-tabs-beta' ]; then\n  node scripts/test_ui_shell_navigation.js\n  node scripts/test_runtime_diagnostics.js\nfi''', 1)
preflight_path.write_text(preflight, encoding='utf-8')

manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
manifest['moduleSetVersion'] = MODULE_SET
for module in manifest['modules']:
    if module['name'] in ('ch_15_app.js', 'ch_16_ui_shell.js'):
        module['sha'] = subprocess.check_output(
            ['git', 'hash-object', str(ROOT / module['path'])],
            text=True).strip()
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

print('Stage7 runtime diagnostics applied')
print('base=' + BASE)
print('moduleSetVersion=' + MODULE_SET)
print('App MODULE_VERSION=22')
print('UIShell MODULE_VERSION=6')
