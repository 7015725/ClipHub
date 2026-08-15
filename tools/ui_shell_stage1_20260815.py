#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
ENTRY = ROOT / 'ClipHub.js'
MANIFEST = ROOT / 'module-manifest.json'
APP = ROOT / 'src/ch_15_app.js'
SHELL = ROOT / 'src/ch_16_ui_shell.js'
PREFLIGHT = ROOT / 'scripts/release_preflight.sh'


def blob_sha(data):
    return hashlib.sha1(b'blob ' + str(len(data)).encode('ascii') + b'\0' + data).hexdigest()


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit('%s anchor count=%d' % (label, count))
    return text.replace(old, new, 1)


def verify_baseline():
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    if manifest.get('moduleSetVersion') != '20260815.09':
        raise SystemExit('unexpected moduleSetVersion=' + str(manifest.get('moduleSetVersion')))
    if manifest.get('sourceRef') != 'beta-regex-settings-tabs-20260814':
        raise SystemExit('unexpected sourceRef')
    if len(manifest.get('modules', [])) != 16:
        raise SystemExit('unexpected module count')
    if SHELL.exists():
        raise SystemExit('ch_16_ui_shell.js already exists')
    by_path = {item['path']: item for item in manifest['modules']}
    for rel in ('src/ch_15_app.js', 'src/ch_11_filter.js', 'src/ch_10_editor.js',
                'src/ch_12_translation.js', 'src/ch_13_settings.js', 'src/ch_08_window.js'):
        actual = blob_sha((ROOT / rel).read_bytes())
        if by_path[rel]['sha'] != actual:
            raise SystemExit('baseline manifest mismatch ' + rel)
    return manifest


SHELL_SOURCE = r'''(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var initialized = false;
    var runtimeContext = null;
    var pages = {};
    var pageOrder = [];
    var stack = [];
    var visible = false;
    var generation = 0;
    var mutationCount = 0;
    var lastAction = "none";
    var lastReason = "";

    function normalizeId(value) {
        return String(value === null || value === undefined ? "" : value)
            .replace(/^\s+|\s+$/g, "");
    }

    function copyObject(source) {
        var output = {};
        var key;
        source = source || {};
        for (key in source) {
            if (source.hasOwnProperty(key)) { output[key] = source[key]; }
        }
        return output;
    }

    function copyDescriptor(source) {
        return {
            id: String(source.id),
            parentId: source.parentId === null ? null : String(source.parentId),
            owner: String(source.owner || source.id),
            moduleName: String(source.moduleName || ""),
            cachePolicy: String(source.cachePolicy || "lazy"),
            legacySurface: String(source.legacySurface || ""),
            shellReady: source.shellReady === true
        };
    }

    function requirePage(pageId) {
        var id = normalizeId(pageId);
        if (!id || !pages[id]) { throw new Error("Unknown UI page: " + id); }
        return pages[id];
    }

    function registerPage(descriptor) {
        var value = descriptor || {};
        var id = normalizeId(value.id);
        var parentId = value.parentId === null || value.parentId === undefined ?
            null : normalizeId(value.parentId);
        var page;
        if (!id) { throw new Error("UI page id is required"); }
        if (pages[id]) { throw new Error("Duplicate UI page: " + id); }
        if (parentId !== null && !pages[parentId]) {
            throw new Error("UI page parent is not registered: " + parentId);
        }
        page = {
            id: id,
            parentId: parentId,
            owner: normalizeId(value.owner || id),
            moduleName: normalizeId(value.moduleName || ""),
            cachePolicy: normalizeId(value.cachePolicy || "lazy"),
            legacySurface: normalizeId(value.legacySurface || ""),
            shellReady: value.shellReady === true
        };
        pages[id] = page;
        pageOrder.push(id);
        mutationCount += 1;
        return copyDescriptor(page);
    }

    function installDefaultPages() {
        registerPage({ id: "home", parentId: null, owner: "home",
            moduleName: "Filter", cachePolicy: "keep",
            legacySurface: "filter_root", shellReady: false });
        registerPage({ id: "detail", parentId: "home", owner: "detail",
            moduleName: "List", cachePolicy: "rebind",
            legacySurface: "detail", shellReady: false });
        registerPage({ id: "editor", parentId: "home", owner: "editor",
            moduleName: "Editor", cachePolicy: "rebind",
            legacySurface: "editor", shellReady: false });
        registerPage({ id: "tags", parentId: "editor", owner: "tags",
            moduleName: "Editor", cachePolicy: "lazy",
            legacySurface: "tags", shellReady: false });
        registerPage({ id: "filter", parentId: "home", owner: "filter",
            moduleName: "Filter", cachePolicy: "lazy",
            legacySurface: "filter", shellReady: false });
        registerPage({ id: "settings", parentId: "home", owner: "settings",
            moduleName: "Settings", cachePolicy: "lazy",
            legacySurface: "settings", shellReady: false });
        registerPage({ id: "regex_rules", parentId: "settings",
            owner: "settings", moduleName: "Settings", cachePolicy: "lazy",
            legacySurface: "settings", shellReady: false });
        registerPage({ id: "regex_editor", parentId: "regex_rules",
            owner: "settings", moduleName: "Settings", cachePolicy: "rebind",
            legacySurface: "settings", shellReady: false });
        registerPage({ id: "regex_test", parentId: "regex_editor",
            owner: "settings", moduleName: "Settings", cachePolicy: "transient",
            legacySurface: "settings", shellReady: false });
        registerPage({ id: "translation", parentId: "home",
            owner: "translation", moduleName: "Translation",
            cachePolicy: "rebind", legacySurface: "translation",
            shellReady: false });
        registerPage({ id: "tokenizer", parentId: "home", owner: "tokenizer",
            moduleName: "TokenizerUI", cachePolicy: "rebind",
            legacySurface: "tokenizer", shellReady: false });
    }

    function stackIds() {
        var output = [];
        var index;
        for (index = 0; index < stack.length; index += 1) {
            output.push(String(stack[index].id));
        }
        return output;
    }

    function pageIds() {
        return pageOrder.slice(0);
    }

    function enterRoot(pageId, params, reason) {
        var page = requirePage(pageId);
        if (page.parentId !== null) {
            throw new Error("UI root page must not have a parent: " + page.id);
        }
        stack = [{ id: page.id, params: copyObject(params) }];
        visible = true;
        generation += 1;
        mutationCount += 1;
        lastAction = "enter_root";
        lastReason = String(reason || "");
        return getState();
    }

    function pushPage(pageId, params, reason) {
        var page = requirePage(pageId);
        var currentId = stack.length > 0 ? stack[stack.length - 1].id : null;
        if (page.parentId !== null && currentId !== page.parentId) {
            throw new Error("UI page parent mismatch: " + page.id +
                " requires " + page.parentId + ", current=" + currentId);
        }
        stack.push({ id: page.id, params: copyObject(params) });
        visible = true;
        generation += 1;
        mutationCount += 1;
        lastAction = "push";
        lastReason = String(reason || "");
        return getState();
    }

    function popPage(reason) {
        if (stack.length <= 1) { return false; }
        stack.pop();
        generation += 1;
        mutationCount += 1;
        lastAction = "pop";
        lastReason = String(reason || "");
        return true;
    }

    function clearToRoot(reason) {
        if (stack.length < 1) {
            stack = [{ id: "home", params: {} }];
        } else if (stack.length > 1) {
            stack = [stack[0]];
        }
        generation += 1;
        mutationCount += 1;
        lastAction = "clear_to_root";
        lastReason = String(reason || "");
        return getState();
    }

    function setVisible(value, reason) {
        visible = value === true;
        generation += 1;
        mutationCount += 1;
        lastAction = visible ? "visible" : "hidden";
        lastReason = String(reason || "");
        return visible;
    }

    function markShellReady(pageId, ready) {
        var page = requirePage(pageId);
        page.shellReady = ready === true;
        mutationCount += 1;
        return page.shellReady;
    }

    function getState() {
        var currentId = stack.length > 0 ?
            String(stack[stack.length - 1].id) : null;
        return {
            initialized: initialized === true,
            migrationStage: "registry_only",
            primaryWindowMode: false,
            legacyWindowBridge: true,
            hostAttached: false,
            visible: visible === true,
            rootPageId: stack.length > 0 ? String(stack[0].id) : null,
            currentPageId: currentId,
            stackDepth: Number(stack.length),
            pageStack: stackIds(),
            pageCount: Number(pageOrder.length),
            registeredPageIds: pageIds(),
            generation: Number(generation),
            mutationCount: Number(mutationCount),
            lastAction: String(lastAction || ""),
            lastReason: String(lastReason || "")
        };
    }

    function init(context) {
        if (initialized) { return getState(); }
        runtimeContext = context || {};
        pages = {};
        pageOrder = [];
        stack = [];
        visible = false;
        generation += 1;
        mutationCount = 0;
        lastAction = "init";
        lastReason = "";
        initialized = true;
        installDefaultPages();
        stack = [{ id: "home", params: {} }];
        return getState();
    }

    function shutdown() {
        initialized = false;
        runtimeContext = null;
        pages = {};
        pageOrder = [];
        stack = [];
        visible = false;
        generation += 1;
        lastAction = "shutdown";
        lastReason = "";
        return true;
    }

    ClipHub.UIShell = {
        MODULE_NAME: "ch_16_ui_shell",
        MODULE_VERSION: 1,
        init: init,
        registerPage: registerPage,
        getPage: function (pageId) {
            return copyDescriptor(requirePage(pageId));
        },
        getRegisteredPageIds: pageIds,
        enterRoot: enterRoot,
        pushPage: pushPage,
        popPage: popPage,
        clearToRoot: clearToRoot,
        setVisible: setVisible,
        markShellReady: markShellReady,
        getState: getState,
        shutdown: shutdown
    };
}((function () { return this; }())));
'''


def patch_entry():
    text = ENTRY.read_text(encoding='utf-8')
    text = replace_once(
        text,
        '        "ch_12_translation.js", "ch_13_settings.js",\n        "ch_14_event_bus.js", "ch_15_app.js", "ch_17_tokenizer_ui.js"',
        '        "ch_12_translation.js", "ch_13_settings.js",\n        "ch_14_event_bus.js", "ch_15_app.js", "ch_16_ui_shell.js",\n        "ch_17_tokenizer_ui.js"',
        'entry module list')
    ENTRY.write_text(text, encoding='utf-8')


def patch_app():
    text = APP.read_text(encoding='utf-8')
    text = replace_once(
        text,
        '        "Editor", "Filter", "Settings", "Translation"\n    ];',
        '        "Editor", "Filter", "Settings", "Translation", "UIShell"\n    ];',
        'app init order')
    text = replace_once(
        text,
        '        var colorSafety = safeState(\n            ClipHub.Theme, "getColorSafetyState", {});',
        '        var colorSafety = safeState(\n            ClipHub.Theme, "getColorSafetyState", {});\n        var uiShell = safeState(ClipHub.UIShell, "getState", {});',
        'app ui shell state')
    text = replace_once(
        text,
        '            scrollPerformance: safeState(\n                ClipHub.Filter, "getScrollPerformanceState", null)\n        };',
        '            scrollPerformance: safeState(\n                ClipHub.Filter, "getScrollPerformanceState", null),\n            uiShell: uiShell\n        };',
        'app ui status shell field')
    text = replace_once(
        text,
        '        MODULE_NAME: "ch_15_app",\n        MODULE_VERSION: 20,',
        '        MODULE_NAME: "ch_15_app",\n        MODULE_VERSION: 21,',
        'app module version')
    APP.write_text(text, encoding='utf-8')


def patch_preflight():
    text = PREFLIGHT.read_text(encoding='utf-8')
    text = replace_once(text,
        "    EXPECTED_MODULE_SET='20260815.09'\n    EXPECTED_ENTRY_VERSION='6'\n    EXPECTED_APP_MODULE_VERSION='20'",
        "    EXPECTED_MODULE_SET='20260815.11'\n    EXPECTED_ENTRY_VERSION='6'\n    EXPECTED_APP_MODULE_VERSION='21'",
        'settings preflight version')
    text = replace_once(text,
        'expected_module_count = 16 if mode == "--settings-tabs-beta" else 15',
        'expected_module_count = 17 if mode == "--settings-tabs-beta" else 15',
        'manifest module count')
    text = replace_once(text,
        '            "ch_13_settings.js": ("ch_13_settings", 32),\n            "ch_15_app.js": ("ch_15_app", 20),',
        '            "ch_13_settings.js": ("ch_13_settings", 32),\n            "ch_15_app.js": ("ch_15_app", 21),\n            "ch_16_ui_shell.js": ("ch_16_ui_shell", 1),',
        'settings required versions')
    text = replace_once(text,
        '    assert len(manifest.get("modules", [])) == (16 if mode == "--settings-tabs-beta" else 15)',
        '    assert len(manifest.get("modules", [])) == (17 if mode == "--settings-tabs-beta" else 15)',
        'regex manifest count')
    needle = '        assert "Settings24 ES5 loader" not in settings_loader\n        print("Settings tabs safety contracts: passed")'
    addition = '''        assert "Settings24 ES5 loader" not in settings_loader
        ui_shell_source = actual_sources["ch_16_ui_shell.js"]
        assert 'MODULE_NAME: "ch_16_ui_shell"' in ui_shell_source
        assert "MODULE_VERSION: 1" in ui_shell_source
        assert 'migrationStage: "registry_only"' in ui_shell_source
        assert 'primaryWindowMode: false' in ui_shell_source
        assert 'legacyWindowBridge: true' in ui_shell_source
        assert 'registerPage({ id: "home"' in ui_shell_source
        assert 'registerPage({ id: "settings"' in ui_shell_source
        assert 'registerPage({ id: "regex_rules"' in ui_shell_source
        assert 'registerPage({ id: "editor"' in ui_shell_source
        assert 'registerPage({ id: "translation"' in ui_shell_source
        assert '"ch_16_ui_shell.js"' in entry
        assert '"Translation", "UIShell"' in app
        assert 'uiShell: uiShell' in app
        print("UI shell stage1 contracts: passed")
        print("Settings tabs safety contracts: passed")'''
    text = replace_once(text, needle, addition, 'ui shell preflight contracts')
    PREFLIGHT.write_text(text, encoding='utf-8')


def update_manifest(manifest):
    manifest['moduleSetVersion'] = '20260815.11'
    by_path = {item['path']: item for item in manifest['modules']}
    by_path['src/ch_15_app.js']['sha'] = blob_sha(APP.read_bytes())
    shell_item = {
        'name': 'ch_16_ui_shell.js',
        'path': 'src/ch_16_ui_shell.js',
        'sha': blob_sha(SHELL.read_bytes())
    }
    insert_at = len(manifest['modules'])
    for index, item in enumerate(manifest['modules']):
        if item['name'] == 'ch_17_tokenizer_ui.js':
            insert_at = index
            break
    manifest['modules'].insert(insert_at, shell_item)
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n',
                        encoding='utf-8')


def main():
    manifest = verify_baseline()
    SHELL.write_text(SHELL_SOURCE, encoding='utf-8')
    patch_entry()
    patch_app()
    patch_preflight()
    update_manifest(manifest)
    print('UI shell stage1 generated')
    print('moduleSetVersion=20260815.11')
    print('App=21 UIShell=1')
    print('visual modules untouched: Window/List/Editor/Filter/Translation/Settings/Tokenizer')


if __name__ == '__main__':
    main()
