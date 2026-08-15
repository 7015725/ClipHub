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
    var activePageId = null;
    var activeView = null;
    var activeBack = null;
    var activeClose = null;
    var mountCount = 0;
    var unmountCount = 0;
    var syncCount = 0;

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
            legacySurface: "filter_root", shellReady: true });
        registerPage({ id: "detail", parentId: "home", owner: "detail",
            moduleName: "List", cachePolicy: "rebind",
            legacySurface: "detail", shellReady: true });
        registerPage({ id: "editor", parentId: "home", owner: "editor",
            moduleName: "Editor", cachePolicy: "rebind",
            legacySurface: "editor", shellReady: true });
        registerPage({ id: "tags", parentId: "editor", owner: "tags",
            moduleName: "Editor", cachePolicy: "lazy",
            legacySurface: "tags", shellReady: true });
        registerPage({ id: "settings", parentId: "home", owner: "settings",
            moduleName: "Settings", cachePolicy: "lazy",
            legacySurface: "settings", shellReady: true });
        registerPage({ id: "regex_rules", parentId: "settings",
            owner: "settings", moduleName: "Settings", cachePolicy: "lazy",
            legacySurface: "settings", shellReady: true });
        registerPage({ id: "regex_editor", parentId: "regex_rules",
            owner: "settings", moduleName: "Settings", cachePolicy: "rebind",
            legacySurface: "settings", shellReady: true });
        registerPage({ id: "regex_test", parentId: "regex_editor",
            owner: "settings", moduleName: "Settings", cachePolicy: "transient",
            legacySurface: "settings", shellReady: true });
        registerPage({ id: "translation", parentId: "home",
            owner: "translation", moduleName: "Translation",
            cachePolicy: "rebind", legacySurface: "translation",
            shellReady: true });
        registerPage({ id: "tokenizer", parentId: "editor", owner: "tokenizer",
            moduleName: "TokenizerUI", cachePolicy: "rebind",
            legacySurface: "tokenizer", shellReady: true });
    }

    function stackIds() {
        var output = [];
        var index;
        for (index = 0; index < stack.length; index += 1) {
            output.push(String(stack[index].id));
        }
        return output;
    }

    function pageIds() { return pageOrder.slice(0); }

    function primaryHostState() {
        try {
            if (ClipHub.Filter &&
                    typeof ClipHub.Filter.getPrimaryHostState === "function") {
                return ClipHub.Filter.getPrimaryHostState() || {};
            }
        } catch (ignored) {}
        return { ready: false, attached: false, rootMode: false };
    }

    function currentPageId() {
        return stack.length > 0 ? String(stack[stack.length - 1].id) : null;
    }

    function isSameShellFamily(pageId) {
        var current = currentPageId();
        if (current === "home") { return true; }
        if (pageId === "detail") { return current === "detail"; }
        if (pageId === "translation") { return current === "translation"; }
        if (pageId === "settings") {
            return current === "settings" || current === "regex_rules" ||
                current === "regex_editor" || current === "regex_test";
        }
        if (pageId === "editor" || pageId === "tags" ||
                pageId === "tokenizer") {
            return current === "editor" || current === "tags" ||
                current === "tokenizer";
        }
        return false;
    }

    function canEmbed(pageId) {
        var id = normalizeId(pageId);
        var host = primaryHostState();
        if (!initialized || host.ready !== true) { return false; }
        if (id !== "settings" && id !== "translation" && id !== "detail" &&
                id !== "regex_rules" && id !== "regex_editor" &&
                id !== "regex_test" && id !== "editor" &&
                id !== "tags" && id !== "tokenizer") { return false; }
        if (id === "detail") { return isSameShellFamily("detail"); }
        if (id === "translation") { return isSameShellFamily("translation"); }
        if (id === "editor" || id === "tags" || id === "tokenizer") {
            return isSameShellFamily(id);
        }
        return isSameShellFamily("settings");
    }

    function setStackPath(path, reason) {
        var ids = path || [];
        var next = [{ id: "home", params: {} }];
        var parent = "home";
        var index;
        var page;
        for (index = 0; index < ids.length; index += 1) {
            page = requirePage(ids[index]);
            if (page.parentId !== parent) {
                throw new Error("UI shell path parent mismatch: " + page.id);
            }
            next.push({ id: page.id, params: {} });
            parent = page.id;
        }
        stack = next;
        visible = true;
        generation += 1;
        mutationCount += 1;
        syncCount += 1;
        lastAction = "sync_path";
        lastReason = String(reason || "");
        return getState();
    }

    function applyActivePage(spec, reason) {
        activePageId = normalizeId(spec.pageId);
        activeView = spec.view || activeView;
        activeBack = typeof spec.onBack === "function" ? spec.onBack : null;
        activeClose = typeof spec.onClose === "function" ? spec.onClose : null;
        ClipHub.Filter.mountPrimaryChildPage({
            pageId: activePageId,
            title: String(spec.title || ""),
            showBack: spec.showBack === true,
            view: activeView
        });
        lastReason = String(reason || "");
        return getState();
    }

    function mountPage(pageId, view, options) {
        var id = normalizeId(pageId);
        var page = requirePage(id);
        var opts = options || {};
        if (!view) { throw new Error("UI shell page view is required: " + id); }
        if (!canEmbed(id)) { throw new Error("UI shell embed unavailable: " + id); }
        if (page.parentId !== "home") {
            throw new Error("mountPage only accepts direct home children: " + id);
        }
        setStackPath([id], "mount:" + id);
        activeView = view;
        mountCount += 1;
        return applyActivePage({
            pageId: id,
            title: opts.title || id,
            showBack: opts.showBack === true,
            view: view,
            onBack: opts.onBack,
            onClose: opts.onClose
        }, "mount:" + id);
    }

    function syncEmbeddedPage(spec) {
        var value = spec || {};
        var path = value.path || [];
        var id = normalizeId(value.pageId);
        if (!activeView || !canEmbed(id)) { return false; }
        setStackPath(path, "sync:" + id);
        applyActivePage({
            pageId: id,
            title: value.title || id,
            showBack: value.showBack === true,
            view: value.view || activeView,
            onBack: value.onBack,
            onClose: value.onClose
        }, "sync:" + id);
        return true;
    }

    function unmountPage(pageId, reason) {
        var id = normalizeId(pageId);
        if (activePageId === null) { return true; }
        if (id && id !== activePageId &&
                !(id === "settings" && (activePageId === "regex_rules" ||
                    activePageId === "regex_editor" || activePageId === "regex_test")) &&
                !(id === "editor" && (activePageId === "tags" ||
                    activePageId === "tokenizer"))) {
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
        stack = [{ id: "home", params: {} }];
        visible = true;
        generation += 1;
        mutationCount += 1;
        lastAction = "unmount";
        lastReason = String(reason || "");
        return true;
    }

    function dispatchBack(reason) {
        lastAction = "dispatch_back";
        lastReason = String(reason || "");
        if (typeof activeBack === "function") { return activeBack(); }
        if (activePageId !== null) { return unmountPage(activePageId, reason); }
        return false;
    }

    function dispatchClose(reason) {
        lastAction = "dispatch_close";
        lastReason = String(reason || "");
        if (typeof activeClose === "function") { return activeClose(); }
        if (activePageId !== null) { return unmountPage(activePageId, reason); }
        return false;
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
        var currentId = currentPageId();
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
        if (activePageId !== null) { unmountPage(activePageId, reason); }
        if (stack.length < 1) { stack = [{ id: "home", params: {} }]; }
        else if (stack.length > 1) { stack = [stack[0]]; }
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
        var host = primaryHostState();
        return {
            initialized: initialized === true,
            migrationStage: "primary_window_settings_regex_translation_editor_tags_tokenizer_detail_filter_overlay_closed",
            primaryWindowMode: true,
            legacyWindowBridge: true,
            hostAttached: host.ready === true,
            hostRootMode: host.rootMode === true,
            childAttached: host.childAttached === true,
            activePageId: activePageId,
            visible: visible === true,
            rootPageId: stack.length > 0 ? String(stack[0].id) : null,
            currentPageId: currentPageId(),
            stackDepth: Number(stack.length),
            pageStack: stackIds(),
            pageCount: Number(pageOrder.length),
            registeredPageIds: pageIds(),
            generation: Number(generation),
            mutationCount: Number(mutationCount),
            mountCount: Number(mountCount),
            unmountCount: Number(unmountCount),
            syncCount: Number(syncCount),
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
        activePageId = null;
        activeView = null;
        activeBack = null;
        activeClose = null;
        mountCount = 0;
        unmountCount = 0;
        syncCount = 0;
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
        try {
            if (activePageId !== null) { unmountPage(activePageId, "shutdown"); }
        } catch (ignored) {}
        initialized = false;
        runtimeContext = null;
        pages = {};
        pageOrder = [];
        stack = [];
        visible = false;
        activePageId = null;
        activeView = null;
        activeBack = null;
        activeClose = null;
        generation += 1;
        lastAction = "shutdown";
        lastReason = "";
        return true;
    }

    ClipHub.UIShell = {
        MODULE_NAME: "ch_16_ui_shell",
        MODULE_VERSION: 5,
        init: init,
        registerPage: registerPage,
        getPage: function (pageId) { return copyDescriptor(requirePage(pageId)); },
        getRegisteredPageIds: pageIds,
        enterRoot: enterRoot,
        pushPage: pushPage,
        popPage: popPage,
        clearToRoot: clearToRoot,
        setVisible: setVisible,
        markShellReady: markShellReady,
        canEmbed: canEmbed,
        mountPage: mountPage,
        syncEmbeddedPage: syncEmbeddedPage,
        unmountPage: unmountPage,
        dispatchBack: dispatchBack,
        dispatchClose: dispatchClose,
        getState: getState,
        shutdown: shutdown
    };
}((function () { return this; }())));
