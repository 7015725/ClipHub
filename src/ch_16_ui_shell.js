(function (global) {
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
