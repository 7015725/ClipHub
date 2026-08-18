(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var initialized = false;
    var runtimeContext = null;
    var pages = {};
    var DEFAULT_PAGE_CONTRACT = {
        allowDuplicate: false,
        canPop: true,
        systemBack: true,
        swipeBack: true,
        predictiveBack: true,
        imeBackFirst: true,
        host: "primary",
        rootBehavior: "none"
    };
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
    var activeImeBackFirst = false;
    var mountCount = 0;
    var unmountCount = 0;
    var syncCount = 0;
    var backDispatchInProgress = false;
    var backHookInProgress = false;
    var pendingLegacyNavigation = null;
    var backDispatchCount = 0;
    var duplicateBackRequestCount = 0;
    var backCascadeGuardCount = 0;
    var backDispatcherCount = 0;
    var backHookDispatchCount = 0;
    var backHookConsumedCount = 0;
    var backHookNavigationCount = 0;
    var legacyHookIntentCount = 0;
    var deferredHookNavigationCount = 0;
    var navigatorBackPopCount = 0;
    var rootBackCount = 0;
    var imeBackConsumeCount = 0;
    var lastBackSourceFamily = "";
    var lastBackOutcome = "none";
    var lastBackRequestId = "";
    var lastBackRequestGeneration = -1;
    var lastBackFromPageId = "";
    var lastBackToPageId = "";
    var lastBackDepthBefore = 0;
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

    function mergePageContract(override) {
        var output = copyObject(DEFAULT_PAGE_CONTRACT);
        var value = override || {};
        var key;
        for (key in value) {
            if (value.hasOwnProperty(key)) { output[key] = value[key]; }
        }
        output.allowDuplicate = output.allowDuplicate === true;
        output.canPop = output.canPop !== false;
        output.systemBack = output.systemBack !== false;
        output.swipeBack = output.swipeBack !== false;
        output.predictiveBack = output.predictiveBack !== false;
        output.imeBackFirst = output.imeBackFirst !== false;
        output.host = normalizeId(output.host || "primary");
        output.rootBehavior = normalizeId(output.rootBehavior || "none");
        return output;
    }

    function copyPageContract(contract) {
        return mergePageContract(contract || {});
    }

    function currentPageContract() {
        var id = currentPageId();
        if (!id || !pages[id]) { return copyPageContract(DEFAULT_PAGE_CONTRACT); }
        return copyPageContract(pages[id].contract);
    }

    function copyDescriptor(source) {
        return {
            id: String(source.id),
            parentId: source.parentId === null ? null : String(source.parentId),
            alternateParentIds: (source.alternateParentIds || []).slice(0),
            owner: String(source.owner || source.id),
            family: String(source.family || source.owner || source.id),
            moduleName: String(source.moduleName || ""),
            cachePolicy: String(source.cachePolicy || "lazy"),
            legacySurface: String(source.legacySurface || ""),
            shellReady: source.shellReady === true,
            hasFactory: typeof source.factory === "function",
            metadata: copyObject(source.metadata),
            contract: copyPageContract(source.contract),
            hookNames: source.hooks ? source.hooks.names.slice(0) : []
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
        var alternateParentIds = [];
        var alternateInput = value.alternateParentIds || [];
        var alternateIndex;
        var alternateId;
        if (!id) { throw new Error("UI page id is required"); }
        if (pages[id]) { throw new Error("Duplicate UI page: " + id); }
        if (parentId !== null && !pages[parentId]) {
            throw new Error("UI page parent is not registered: " + parentId);
        }
        for (alternateIndex = 0; alternateIndex < alternateInput.length;
                alternateIndex += 1) {
            alternateId = normalizeId(alternateInput[alternateIndex]);
            if (!alternateId || !pages[alternateId]) {
                throw new Error("UI page alternate parent is not registered: " +
                    alternateId);
            }
            if (alternateId !== parentId) { alternateParentIds.push(alternateId); }
        }
        var hookInput = value.hooks || {};
        var hookNames = ["onBeforeEnter", "onEnter", "onBeforeLeave",
            "onLeave", "onBack", "onClose"];
        var hooks = { names: [] };
        var hookIndex;
        var hookName;
        for (hookIndex = 0; hookIndex < hookNames.length; hookIndex += 1) {
            hookName = hookNames[hookIndex];
            if (typeof hookInput[hookName] === "function") {
                hooks[hookName] = hookInput[hookName];
                hooks.names.push(hookName);
            }
        }
        page = {
            id: id,
            parentId: parentId,
            alternateParentIds: alternateParentIds,
            owner: normalizeId(value.owner || id),
            family: normalizeId(value.family || value.owner || id),
            moduleName: normalizeId(value.moduleName || ""),
            cachePolicy: normalizeId(value.cachePolicy || "lazy"),
            legacySurface: normalizeId(value.legacySurface || ""),
            shellReady: value.shellReady === true,
            factory: typeof value.factory === "function" ? value.factory : null,
            metadata: copyObject(value.metadata),
            contract: mergePageContract(value.contract),
            hooks: hooks
        };
        pages[id] = page;
        pageOrder.push(id);
        mutationCount += 1;
        return copyDescriptor(page);
    }

    function defaultHomeBackHook() {
        try {
            if (ClipHub.Filter &&
                    typeof ClipHub.Filter.handleBack === "function") {
                return ClipHub.Filter.handleBack() === true;
            }
        } catch (ignoredFilterBack) {}
        return false;
    }

    function installDefaultPages() {
        registerPage({ id: "home", parentId: null, owner: "home", family: "root",
            moduleName: "Filter", cachePolicy: "keep",
            legacySurface: "filter_root", shellReady: true,
            contract: {
                canPop: false,
                swipeBack: false,
                predictiveBack: false,
                imeBackFirst: false,
                rootBehavior: "close_host"
            },
            hooks: {
                onBack: defaultHomeBackHook
            } });
        registerPage({ id: "detail", parentId: "home", owner: "detail", family: "detail",
            moduleName: "List", cachePolicy: "rebind",
            legacySurface: "detail", shellReady: true });
        registerPage({ id: "editor", parentId: "home", owner: "editor", family: "editor",
            moduleName: "Editor", cachePolicy: "rebind",
            legacySurface: "editor", shellReady: true });
        registerPage({ id: "tags", parentId: "editor", owner: "tags", family: "editor",
            moduleName: "Editor", cachePolicy: "lazy",
            legacySurface: "tags", shellReady: true });
        registerPage({ id: "settings", parentId: "home", owner: "settings", family: "settings",
            moduleName: "Settings", cachePolicy: "lazy",
            legacySurface: "settings", shellReady: true });
        registerPage({ id: "regex_rules", parentId: "settings",
            owner: "settings", family: "settings", moduleName: "Settings", cachePolicy: "lazy",
            legacySurface: "settings", shellReady: true });
        registerPage({ id: "regex_editor", parentId: "regex_rules",
            owner: "settings", family: "settings", moduleName: "Settings", cachePolicy: "rebind",
            legacySurface: "settings", shellReady: true });
        registerPage({ id: "regex_test", parentId: "regex_editor",
            owner: "settings", family: "settings", moduleName: "Settings", cachePolicy: "transient",
            legacySurface: "settings", shellReady: true });
        registerPage({ id: "translation", parentId: "home",
            owner: "translation", family: "translation", moduleName: "Translation",
            cachePolicy: "rebind", legacySurface: "translation",
            shellReady: true });
        registerPage({ id: "tokenizer", parentId: "editor",
            alternateParentIds: ["home"], owner: "tokenizer", family: "editor",
            moduleName: "TokenizerUI", cachePolicy: "rebind",
            legacySurface: "tokenizer", shellReady: true });
        registerPage({ id: "tokenizer_rules", parentId: "tokenizer",
            owner: "tokenizer", family: "editor", moduleName: "TokenizerUI", cachePolicy: "lazy",
            legacySurface: "tokenizer", shellReady: true });
        registerPage({ id: "tokenizer_rule_editor", parentId: "tokenizer_rules",
            owner: "tokenizer", family: "editor", moduleName: "TokenizerUI", cachePolicy: "rebind",
            legacySurface: "tokenizer", shellReady: true });
    }

    function hasPage(pageId) {
        var id = normalizeId(pageId);
        return !!(id && pages[id]);
    }

    function getPageFactory(pageId) {
        var page = requirePage(pageId);
        return typeof page.factory === "function" ? page.factory : null;
    }

    function getPageContract(pageId) {
        return copyPageContract(requirePage(pageId).contract);
    }

    function pageRegistryState() {
        return {
            apiVersion: 1,
            pageCount: Number(pageOrder.length),
            pageIds: pageIds(),
            rootPageId: pageOrder.length > 0 ? rootPageId() : null,
            contractVersion: 1
        };
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
        var target = requirePage(pageId);
        var currentId = currentPageId();
        var current;
        if (!currentId || !hasPage(currentId)) { return false; }
        current = requirePage(currentId);
        if (current.parentId === null) { return true; }
        return String(current.family || "") === String(target.family || "");
    }

    function canEmbed(pageId) {
        var id = normalizeId(pageId);
        var host = primaryHostState();
        var page;
        if (!initialized || host.ready !== true || !hasPage(id)) { return false; }
        page = requirePage(id);
        if (page.shellReady !== true ||
                String(page.contract.host || "") !== "primary") {
            return false;
        }
        return isSameShellFamily(id);
    }

    function pageAcceptsParent(page, parentId) {
        var alternates = page && page.alternateParentIds ?
            page.alternateParentIds : [];
        var index;
        if (page && page.parentId === parentId) { return true; }
        for (index = 0; index < alternates.length; index += 1) {
            if (String(alternates[index]) === String(parentId)) { return true; }
        }
        return false;
    }

    function rootPageId() {
        var root = null;
        var index;
        var page;
        for (index = 0; index < pageOrder.length; index += 1) {
            page = pages[pageOrder[index]];
            if (page && page.parentId === null) {
                if (root !== null && root !== page.id) {
                    throw new Error("Multiple UI root pages registered");
                }
                root = String(page.id);
            }
        }
        if (root === null) { throw new Error("UI root page is not registered"); }
        return root;
    }

    function copyStackEntry(entry) {
        if (!entry) { return null; }
        return { id: String(entry.id), params: copyObject(entry.params) };
    }

    function stackSnapshot() {
        var output = [];
        var index;
        for (index = 0; index < stack.length; index += 1) {
            output.push(copyStackEntry(stack[index]));
        }
        return output;
    }

    function commitStackState(nextEntries, action, reason) {
        var next = nextEntries || [];
        var normalized = [];
        var index;
        var page;
        var previousId = null;
        if (next.length < 1) {
            throw new Error("PageStack cannot commit an empty stack");
        }
        for (index = 0; index < next.length; index += 1) {
            page = requirePage(next[index].id);
            if (index === 0) {
                if (page.parentId !== null) {
                    throw new Error("PageStack root must be a root page: " + page.id);
                }
            } else if (!pageAcceptsParent(page, previousId)) {
                throw new Error("PageStack parent mismatch: " + page.id +
                    ", previous=" + String(previousId || ""));
            }
            normalized.push({
                id: page.id,
                params: copyObject(next[index].params)
            });
            previousId = page.id;
        }
        stack = normalized;
        visible = true;
        generation += 1;
        mutationCount += 1;
        lastAction = String(action || "stack_commit");
        lastReason = String(reason || "");
        return getState();
    }

    function clearStackState(action, reason) {
        stack = [];
        generation += 1;
        mutationCount += 1;
        lastAction = String(action || "stack_clear");
        lastReason = String(reason || "");
        return true;
    }

    function pageStackSetPath(path, reason) {
        var ids = path || [];
        var rootId = rootPageId();
        var next = [{ id: rootId, params: {} }];
        var index = 0;
        if (ids.length > 0 && normalizeId(ids[0]) === rootId) {
            index = 1;
        }
        for (; index < ids.length; index += 1) {
            next.push({ id: normalizeId(ids[index]), params: {} });
        }
        syncCount += 1;
        return commitStackState(next, "sync_path", reason);
    }

    function pageStackResetRoot(pageId, params, reason) {
        var page = requirePage(pageId);
        if (page.parentId !== null) {
            throw new Error("UI root page must not have a parent: " + page.id);
        }
        return commitStackState([
            { id: page.id, params: copyObject(params) }
        ], "enter_root", reason);
    }

    function pageStackPush(pageId, params, reason) {
        var page = requirePage(pageId);
        var currentId = currentPageId();
        var next = stackSnapshot();
        if (page.parentId !== null && !pageAcceptsParent(page, currentId)) {
            throw new Error("UI page parent mismatch: " + page.id +
                " requires " + page.parentId + ", current=" + currentId);
        }
        if (currentId === page.id && page.contract.allowDuplicate !== true) {
            lastAction = "push_duplicate_ignored";
            lastReason = String(reason || "");
            return getState();
        }
        next.push({ id: page.id, params: copyObject(params) });
        return commitStackState(next, "push", reason);
    }

    function pageStackPop(reason) {
        var next;
        if (stack.length <= 1) { return false; }
        next = stackSnapshot();
        next.pop();
        commitStackState(next, "pop", reason);
        return true;
    }

    function pageStackReplace(pageId, params, reason) {
        var page = requirePage(pageId);
        var next = stackSnapshot();
        var parentId = next.length > 1 ? String(next[next.length - 2].id) : null;
        if (next.length === 0) {
            return pageStackResetRoot(page.id, params, reason);
        }
        if (next.length === 1) {
            if (page.parentId !== null) {
                throw new Error("Root replace requires a root page: " + page.id);
            }
        } else if (!pageAcceptsParent(page, parentId)) {
            throw new Error("UI replace parent mismatch: " + page.id +
                ", parent=" + String(parentId || ""));
        }
        next[next.length - 1] = { id: page.id, params: copyObject(params) };
        return commitStackState(next, "replace", reason);
    }

    function pageStackCurrent() {
        return stack.length > 0 ? copyStackEntry(stack[stack.length - 1]) : null;
    }

    function pageStackCanPop() { return stack.length > 1; }

    function pageStackSize() { return Number(stack.length); }

    function pageStackPopTo(pageId, reason) {
        var id = normalizeId(pageId);
        var next = stackSnapshot();
        var index = next.length - 1;
        for (; index >= 0; index -= 1) {
            if (String(next[index].id) === id) {
                next = next.slice(0, index + 1);
                commitStackState(next, "pop_to", reason);
                return true;
            }
        }
        return false;
    }

    function invokePageHook(page, hookName, payload) {
        var hooks = page && page.hooks ? page.hooks : null;
        if (!hooks || typeof hooks[hookName] !== "function") { return null; }
        return hooks[hookName](payload || {});
    }

    function normalizeFactoryPageSpec(page, created, params) {
        var spec = created || {};
        var view = null;
        if (spec && spec.view) {
            view = spec.view;
        } else if (spec && typeof spec.getRootView === "function") {
            view = spec;
            spec = {};
        }
        if (!view) { throw new Error("Page factory did not return a view: " + page.id); }
        return {
            pageId: page.id,
            title: String(spec.title || page.id),
            showBack: spec.showBack !== false,
            view: view,
            onBack: typeof spec.onBack === "function" ? spec.onBack :
                (page.hooks && page.hooks.onBack ? page.hooks.onBack : null),
            onClose: typeof spec.onClose === "function" ? spec.onClose :
                (page.hooks && page.hooks.onClose ? page.hooks.onClose : null),
            imeBackFirst: page.contract.imeBackFirst === true,
            params: copyObject(params)
        };
    }

    function createFactoryPageSpec(page, params, reason) {
        var payload;
        var created;
        if (!page || typeof page.factory !== "function") { return null; }
        payload = {
            context: runtimeContext,
            pageId: page.id,
            params: copyObject(params),
            reason: String(reason || ""),
            registry: ClipHub.PageRegistry,
            navigator: ClipHub.Navigator
        };
        invokePageHook(page, "onBeforeEnter", payload);
        created = page.factory(payload);
        return normalizeFactoryPageSpec(page, created, params);
    }

    function pageStackPopToRoot(reason) {
        return pageStackPopTo(rootPageId(), reason);
    }

    function navigatorPush(pageId, params, reason) {
        var page = requirePage(pageId);
        var actualReason = reason || "navigator_push";
        var spec = null;
        var result;
        if (typeof page.factory !== "function") {
            return pageStackPush(page.id, params, actualReason);
        }
        if (!canEmbed(page.id)) {
            throw new Error("Navigator host unavailable: " + page.id);
        }
        spec = createFactoryPageSpec(page, params, actualReason);
        result = pageStackPush(page.id, params, actualReason);
        if (currentPageId() !== page.id) { return result; }
        mountCount += 1;
        applyActivePage(spec, actualReason);
        invokePageHook(page, "onEnter", {
            pageId: page.id,
            params: copyObject(params),
            reason: String(actualReason)
        });
        return getState();
    }

    function navigatorPop(reason) {
        var actualReason = reason || "navigator_pop";
        var current = pageStackCurrent();
        var page = current && hasPage(current.id) ? requirePage(current.id) : null;
        var factoryManaged = page && typeof page.factory === "function";
        var result;
        if (factoryManaged) {
            invokePageHook(page, "onBeforeLeave", {
                pageId: page.id,
                params: copyObject(current.params),
                reason: String(actualReason)
            });
            if (activePageId === page.id) {
                detachActivePageForNavigator(actualReason);
            }
        }
        result = pageStackPop(actualReason);
        if (factoryManaged && result === true) {
            invokePageHook(page, "onLeave", {
                pageId: page.id,
                reason: String(actualReason),
                current: pageStackCurrent()
            });
        }
        return result;
    }

    function navigatorReplace(pageId, params, reason) {
        var actualReason = reason || "navigator_replace";
        var target = requirePage(pageId);
        var current = pageStackCurrent();
        var oldPage = current && hasPage(current.id) ? requirePage(current.id) : null;
        var targetSpec = null;
        var result;
        if (oldPage && typeof oldPage.factory === "function") {
            invokePageHook(oldPage, "onBeforeLeave", {
                pageId: oldPage.id,
                reason: String(actualReason)
            });
            if (activePageId === oldPage.id) {
                detachActivePageForNavigator(actualReason);
            }
        }
        if (typeof target.factory === "function") {
            if (!canEmbed(target.id)) {
                throw new Error("Navigator host unavailable: " + target.id);
            }
            targetSpec = createFactoryPageSpec(target, params, actualReason);
        }
        result = pageStackReplace(target.id, params, actualReason);
        if (oldPage && typeof oldPage.factory === "function") {
            invokePageHook(oldPage, "onLeave", {
                pageId: oldPage.id,
                reason: String(actualReason),
                current: pageStackCurrent()
            });
        }
        if (targetSpec !== null) {
            mountCount += 1;
            applyActivePage(targetSpec, actualReason);
            invokePageHook(target, "onEnter", {
                pageId: target.id,
                params: copyObject(params),
                reason: String(actualReason)
            });
            return getState();
        }
        return result;
    }

    function navigatorCurrent() { return pageStackCurrent(); }

    function navigatorCanPop() {
        var contract = currentPageContract();
        return contract.canPop !== false && pageStackCanPop();
    }

    function navigatorStackSize() { return pageStackSize(); }

    function navigatorPopTo(pageId, reason) {
        return pageStackPopTo(pageId, reason || "navigator_pop_to");
    }

    function navigatorPopToRoot(reason) {
        return pageStackPopToRoot(reason || "navigator_pop_to_root");
    }

    function navigatorReset(pageId, params, reason) {
        return pageStackResetRoot(pageId, params, reason || "navigator_reset");
    }

    function navigatorSyncPath(path, reason) {
        return pageStackSetPath(path, reason || "navigator_sync_path");
    }

    function setStackPath(path, reason) {
        if (backHookInProgress) {
            pendingLegacyNavigation = {
                type: "sync_path",
                path: (path || []).slice(0),
                reason: String(reason || "legacy_set_stack_path")
            };
            legacyHookIntentCount += 1;
            return getState();
        }
        return navigatorSyncPath(path, reason || "legacy_set_stack_path");
    }

    function applyActivePage(spec, reason) {
        activePageId = normalizeId(spec.pageId);
        activeView = spec.view || activeView;
        activeBack = typeof spec.onBack === "function" ? spec.onBack : null;
        activeClose = typeof spec.onClose === "function" ? spec.onClose : null;
        activeImeBackFirst = requirePage(activePageId).contract.imeBackFirst === true;
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
        if (page.parentId !== rootPageId()) {
            throw new Error("mountPage only accepts direct root children: " + id);
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
            onClose: opts.onClose,
            imeBackFirst: opts.imeBackFirst !== false
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
            onClose: value.onClose,
            imeBackFirst: value.imeBackFirst !== false
        }, "sync:" + id);
        return true;
    }

    function normalizeDeferredPath(path) {
        var input = path || [];
        var output = [];
        var rootId = rootPageId();
        var index = 0;
        if (input.length <= 0 || normalizeId(input[0]) !== rootId) {
            output.push(rootId);
        }
        for (index = 0; index < input.length; index += 1) {
            output.push(normalizeId(input[index]));
        }
        return output;
    }

    function pathIsCurrentPrefix(path) {
        var ids = normalizeDeferredPath(path);
        var current = stackIds();
        var index;
        if (ids.length <= 0 || ids.length >= current.length) { return false; }
        for (index = 0; index < ids.length; index += 1) {
            if (String(ids[index]) !== String(current[index])) { return false; }
        }
        return true;
    }

    function applyDeferredHookNavigation(pending, reason) {
        var target;
        var ids;
        var currentDepth = pageStackSize();
        if (!pending) { return false; }
        deferredHookNavigationCount += 1;
        if (pending.type === "pop_to_root") {
            if (currentDepth === 2) {
                return navigatorPop(reason || pending.reason ||
                    "deferred_hook_pop") === true;
            }
            return navigatorPopToRoot(reason || pending.reason ||
                "deferred_hook_pop_to_root") === true;
        }
        if (pending.type === "sync_path") {
            ids = normalizeDeferredPath(pending.path);
            if (!pathIsCurrentPrefix(ids)) {
                return false;
            }
            if (ids.length === currentDepth - 1) {
                return navigatorPop(reason || pending.reason ||
                    "deferred_hook_pop") === true;
            }
            target = ids[ids.length - 1];
            return navigatorPopTo(target, reason || pending.reason ||
                "deferred_hook_pop_to") === true;
        }
        return false;
    }

    function unmountPage(pageId, reason) {
        var id = normalizeId(pageId);
        if (activePageId === null) {
            navigatorPopToRoot(reason || "unmount_without_active");
            return true;
        }
        if (id && id !== activePageId) {
            if (!hasPage(id) || !hasPage(activePageId) ||
                    String(requirePage(id).family || "") !==
                    String(requirePage(activePageId).family || "")) {
                return false;
            }
        }
        if (ClipHub.Filter &&
                typeof ClipHub.Filter.unmountPrimaryChildPage === "function") {
            ClipHub.Filter.unmountPrimaryChildPage(reason || "unmount");
        }
        activePageId = null;
        activeView = null;
        activeBack = null;
        activeClose = null;
        activeImeBackFirst = false;
        unmountCount += 1;
        if (backHookInProgress) {
            pendingLegacyNavigation = {
                type: "pop_to_root",
                reason: String(reason || "unmount")
            };
            legacyHookIntentCount += 1;
            lastAction = "unmount_deferred";
            lastReason = String(reason || "");
            return true;
        }
        navigatorPopToRoot(reason || "unmount");
        lastAction = "unmount";
        lastReason = String(reason || "");
        return true;
    }

    function imeVisibleForBack() {
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

    function backSourceFamily(reason) {
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

    function executeRootBehavior(contract, reason) {
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

    function predictiveBackSnapshot() {
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
        return {
            apiVersion: 2,
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
            lastPredictiveProgress: Number(lastPredictiveProgress),
            dispatchCount: Number(backDispatcherCount),
            pageHookDispatchCount: Number(backHookDispatchCount),
            pageHookConsumedCount: Number(backHookConsumedCount),
            legacyHookNavigationCount: Number(backHookNavigationCount),
            legacyHookIntentCount: Number(legacyHookIntentCount),
            deferredHookNavigationCount: Number(deferredHookNavigationCount),
            navigatorPopCount: Number(navigatorBackPopCount),
            rootBackCount: Number(rootBackCount),
            imeBackFirst: activeImeBackFirst === true,
            imeBackConsumeCount: Number(imeBackConsumeCount),
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
        lastBackSourceFamily = normalizeId(value.sourceFamily || "");
        if (!lastBackSourceFamily) {
            lastBackSourceFamily = backSourceFamily(reason);
        }
        var pageContract = currentPageContract();
        if (lastBackSourceFamily === "predictive" &&
                pageContract.predictiveBack === false) {
            lastBackOutcome = "predictive_disabled_by_contract";
            return true;
        }
        if (lastBackSourceFamily === "gesture" &&
                pageContract.swipeBack === false) {
            lastBackOutcome = "swipe_disabled_by_contract";
            return true;
        }
        if ((lastBackSourceFamily === "legacy_key" ||
                lastBackSourceFamily === "system") &&
                pageContract.systemBack === false) {
            lastBackOutcome = "system_back_disabled_by_contract";
            return true;
        }
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
            if (consumeImeBackFirst()) {
                lastBackOutcome = "ime_consumed";
                return true;
            }
            var page = beforePageId && hasPage(beforePageId) ?
                requirePage(beforePageId) : null;
            var pageBackHook = typeof activeBack === "function" ? activeBack :
                (page && page.hooks && typeof page.hooks.onBack === "function" ?
                    page.hooks.onBack : null);
            if (typeof pageBackHook === "function") {
                backHookDispatchCount += 1;
                pendingLegacyNavigation = null;
                backHookInProgress = true;
                try {
                    handled = pageBackHook() === true;
                } finally {
                    backHookInProgress = false;
                }
                if (pendingLegacyNavigation !== null) {
                    handled = applyDeferredHookNavigation(
                        pendingLegacyNavigation,
                        reason || "back_dispatcher_page_hook") === true;
                    pendingLegacyNavigation = null;
                    if (handled) {
                        navigatorBackPopCount += 1;
                        lastBackOutcome = "navigator_pop_after_page_hook";
                        return true;
                    }
                }
                hookChangedNavigation = Number(generation) !== beforeGeneration ||
                    Number(stack.length) !== beforeDepth ||
                    currentPageId() !== beforePageId;
                if (hookChangedNavigation) {
                    backHookNavigationCount += 1;
                    lastBackOutcome = "unexpected_hook_navigation";
                    return true;
                }
                if (handled) {
                    backHookConsumedCount += 1;
                    lastBackOutcome = "page_hook_consumed";
                    return true;
                }
            }
            if (navigatorCanPop()) {
                if (activePageId !== null &&
                        typeof requirePage(currentPageId()).factory !== "function") {
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
            handled = executeRootBehavior(pageContract,
                reason || "navigation_root_back") === true;
            lastBackOutcome = handled ? "root_handled" : "root_unhandled";
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
    }

    function dispatchBack(reason, request) {
        return backDispatcherDispatch(reason, request);
    }

    function dispatchClose(reason) {
        lastAction = "dispatch_close";
        lastReason = String(reason || "");
        if (typeof activeClose === "function") { return activeClose(); }
        if (activePageId !== null) { return unmountPage(activePageId, reason); }
        return false;
    }

    function enterRoot(pageId, params, reason) {
        return navigatorReset(pageId, params, reason || "legacy_enter_root");
    }

    function pushPage(pageId, params, reason) {
        return navigatorPush(pageId, params, reason || "legacy_push_page");
    }

    function popPage(reason) {
        return navigatorPop(reason || "legacy_pop_page");
    }

    function clearToRoot(reason) {
        if (activePageId !== null) {
            return unmountPage(activePageId, reason || "legacy_clear_to_root");
        }
        navigatorPopToRoot(reason || "legacy_clear_to_root");
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


    function runtimeAddIssue(issues, code, detail) {
        issues.push({ code: String(code), detail: String(detail || "") });
    }

    function runtimePageUsesModule(pageId, moduleName) {
        var id = normalizeId(pageId);
        if (!id || !hasPage(id)) { return false; }
        return String(requirePage(id).moduleName || "") === String(moduleName || "");
    }

    function runtimeModuleFamily(moduleName) {
        var index;
        var page;
        var family = "";
        for (index = 0; index < pageOrder.length; index += 1) {
            page = pages[pageOrder[index]];
            if (!page || String(page.moduleName || "") !== String(moduleName || "")) {
                continue;
            }
            if (!family) { family = String(page.family || ""); }
        }
        return family;
    }

    function runtimePageInModuleFamily(pageId, moduleName) {
        var id = normalizeId(pageId);
        var family = runtimeModuleFamily(moduleName);
        return !!(id && family && hasPage(id) &&
            String(requirePage(id).family || "") === family);
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
            if (current && current !== rootPageId()) {
                runtimeAddIssue(issues, "HOME_STACK_MISMATCH", current);
            }
        }

        if (attachedFamilies.length > 1) {
            runtimeAddIssue(issues, "PAGE_STATE_OVERLAP",
                attachedFamilies.join(","));
        }

        if (detailAttached && detail.embeddedInPrimary === true &&
                !runtimePageUsesModule(active, "List")) {
            runtimeAddIssue(issues, "STALE_DETAIL_STATE", active || "home");
        }
        if (editorAttached && editor.embeddedInPrimary === true &&
                !runtimePageInModuleFamily(active, "Editor")) {
            runtimeAddIssue(issues, "STALE_EDITOR_STATE", active || "home");
        }
        if (settingsAttached && settings.embeddedInPrimary === true &&
                !runtimePageInModuleFamily(active, "Settings")) {
            runtimeAddIssue(issues, "STALE_SETTINGS_STATE", active || "home");
        }
        if (translationAttached && translation.embeddedInPrimary === true &&
                !runtimePageUsesModule(active, "Translation")) {
            runtimeAddIssue(issues, "STALE_TRANSLATION_STATE",
                active || "home");
        }

        if (runtimePageUsesModule(active, "List") && !detailAttached) {
            runtimeAddIssue(issues, "ACTIVE_DETAIL_NOT_ATTACHED", "detail");
        }
        if (runtimePageInModuleFamily(active, "Editor") && !editorAttached) {
            runtimeAddIssue(issues, "ACTIVE_EDITOR_FAMILY_NOT_ATTACHED", active);
        }
        if (runtimePageInModuleFamily(active, "Settings") && !settingsAttached) {
            runtimeAddIssue(issues, "ACTIVE_SETTINGS_FAMILY_NOT_ATTACHED", active);
        }
        if (runtimePageUsesModule(active, "Translation") && !translationAttached) {
            runtimeAddIssue(issues, "ACTIVE_TRANSLATION_NOT_ATTACHED",
                "translation");
        }
        if (tokenizer.mounted === true &&
                !runtimePageUsesModule(active, "TokenizerUI")) {
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

    function getState() {
        var host = primaryHostState();
        return {
            initialized: initialized === true,
            migrationStage: "primary_window_settings_regex_translation_editor_tags_tokenizer_detail_filter_overlay_closed_runtime_diagnostics_navigation_stage2_3_back_dispatcher",
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
            pageRegistryOwner: "ClipHub.PageRegistry",
            pageContractOwner: "ClipHub.PageRegistry",
            pageContractVersion: 1,
            pageStackOwner: "ClipHub.PageStack",
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
                copyPredictiveBackSnapshot(predictiveBackSession.snapshot),
            canPop: navigatorCanPop(),
            pageCount: Number(pageOrder.length),
            registeredPageIds: pageIds(),
            generation: Number(generation),
            mutationCount: Number(mutationCount),
            mountCount: Number(mountCount),
            unmountCount: Number(unmountCount),
            syncCount: Number(syncCount),
            backDispatchCount: Number(backDispatchCount),
            duplicateBackRequestCount:
                Number(duplicateBackRequestCount),
            backCascadeGuardCount:
                Number(backCascadeGuardCount),
            backDispatcherCount: Number(backDispatcherCount),
            backHookDispatchCount: Number(backHookDispatchCount),
            backHookConsumedCount: Number(backHookConsumedCount),
            legacyHookNavigationCount: Number(backHookNavigationCount),
            legacyHookIntentCount: Number(legacyHookIntentCount),
            deferredHookNavigationCount: Number(deferredHookNavigationCount),
            navigatorBackPopCount: Number(navigatorBackPopCount),
            rootBackCount: Number(rootBackCount),
            imeBackFirst: activeImeBackFirst === true,
            imeBackConsumeCount: Number(imeBackConsumeCount),
            lastBackSourceFamily: String(lastBackSourceFamily || ""),
            lastBackOutcome: String(lastBackOutcome || "none"),
            lastBackRequestId: String(lastBackRequestId || ""),
            lastBackRequestGeneration:
                Number(lastBackRequestGeneration),
            lastBackFromPageId: String(lastBackFromPageId || ""),
            lastBackToPageId: String(lastBackToPageId || ""),
            lastBackDepthBefore: Number(lastBackDepthBefore),
            lastBackDepthAfter: Number(lastBackDepthAfter),
            lastAction: String(lastAction || ""),
            lastReason: String(lastReason || "")
        };
    }

    function init(context) {
        if (initialized) { return getState(); }
        runtimeContext = context || {};
        pages = {};
        pageOrder = [];
        clearStackState("init_clear", "init");
        visible = false;
        activePageId = null;
        activeView = null;
        activeBack = null;
        activeClose = null;
        activeImeBackFirst = false;
        mountCount = 0;
        unmountCount = 0;
        syncCount = 0;
        backDispatchInProgress = false;
        backHookInProgress = false;
        pendingLegacyNavigation = null;
        backDispatchCount = 0;
        duplicateBackRequestCount = 0;
        backCascadeGuardCount = 0;
        backDispatcherCount = 0;
        backHookDispatchCount = 0;
        backHookConsumedCount = 0;
        backHookNavigationCount = 0;
        legacyHookIntentCount = 0;
        deferredHookNavigationCount = 0;
        navigatorBackPopCount = 0;
        rootBackCount = 0;
        imeBackConsumeCount = 0;
        lastBackSourceFamily = "";
        lastBackOutcome = "none";
        lastBackRequestId = "";
        lastBackRequestGeneration = -1;
        lastBackFromPageId = "";
        lastBackToPageId = "";
        lastBackDepthBefore = 0;
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
        mutationCount = 0;
        lastAction = "init";
        lastReason = "";
        initialized = true;
        installDefaultPages();
        navigatorReset(rootPageId(), {}, "init_root");
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
        clearStackState("shutdown_clear", "shutdown");
        visible = false;
        activePageId = null;
        activeView = null;
        activeBack = null;
        activeClose = null;
        backDispatchInProgress = false;
        lastBackRequestId = "";
        lastBackRequestGeneration = -1;
        lastAction = "shutdown";
        lastReason = "";
        return true;
    }

    ClipHub.PageRegistry = {
        API_VERSION: 1,
        register: registerPage,
        get: function (pageId) { return copyDescriptor(requirePage(pageId)); },
        has: hasPage,
        list: pageIds,
        getFactory: getPageFactory,
        getContract: getPageContract,
        getDefaultContract: function () {
            return copyPageContract(DEFAULT_PAGE_CONTRACT);
        },
        getState: pageRegistryState
    };

    ClipHub.BackDispatcher = {
        API_VERSION: 2,
        OWNER: "ClipHub.BackDispatcher",
        dispatch: backDispatcherDispatch,
        beginPredictive: beginPredictiveBack,
        progressPredictive: progressPredictiveBack,
        cancelPredictive: cancelPredictiveBack,
        commitPredictive: commitPredictiveBack,
        getState: backDispatcherState
    };

    ClipHub.PageStack = {
        API_VERSION: 1,
        push: pageStackPush,
        pop: pageStackPop,
        replace: pageStackReplace,
        current: pageStackCurrent,
        canPop: pageStackCanPop,
        size: pageStackSize,
        popTo: pageStackPopTo,
        popToRoot: pageStackPopToRoot,
        resetRoot: pageStackResetRoot,
        snapshot: stackSnapshot
    };

    ClipHub.Navigator = {
        API_VERSION: 1,
        push: navigatorPush,
        pop: navigatorPop,
        replace: navigatorReplace,
        current: navigatorCurrent,
        canPop: navigatorCanPop,
        stackSize: navigatorStackSize,
        popTo: navigatorPopTo,
        popToRoot: navigatorPopToRoot,
        reset: navigatorReset
    };

    ClipHub.UIShell = {
        MODULE_NAME: "ch_16_ui_shell",
        MODULE_VERSION: 20,
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
        getRuntimeDiagnostics: getRuntimeDiagnostics,
        shutdown: shutdown
    };
}((function () { return this; }())));
