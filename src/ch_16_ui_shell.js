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
    var backDispatchInProgress = false;
    var backDispatchCount = 0;
    var duplicateBackRequestCount = 0;
    var backCascadeGuardCount = 0;
    var lastBackRequestId = "";
    var lastBackRequestGeneration = -1;
    var lastBackFromPageId = "";
    var lastBackToPageId = "";
    var lastBackDepthBefore = 0;
    var lastBackDepthAfter = 0;

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
        registerPage({ id: "tokenizer_rules", parentId: "tokenizer",
            owner: "tokenizer", moduleName: "TokenizerUI", cachePolicy: "lazy",
            legacySurface: "tokenizer", shellReady: true });
        registerPage({ id: "tokenizer_rule_editor", parentId: "tokenizer_rules",
            owner: "tokenizer", moduleName: "TokenizerUI", cachePolicy: "rebind",
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
                pageId === "tokenizer" || pageId === "tokenizer_rules" ||
                pageId === "tokenizer_rule_editor") {
            return current === "editor" || current === "tags" ||
                current === "tokenizer" || current === "tokenizer_rules" ||
                current === "tokenizer_rule_editor";
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
                id !== "tags" && id !== "tokenizer" &&
                id !== "tokenizer_rules" &&
                id !== "tokenizer_rule_editor") { return false; }
        if (id === "detail") { return isSameShellFamily("detail"); }
        if (id === "translation") { return isSameShellFamily("translation"); }
        if (id === "editor" || id === "tags" || id === "tokenizer" ||
                id === "tokenizer_rules" ||
                id === "tokenizer_rule_editor") {
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
                    activePageId === "tokenizer" ||
                    activePageId === "tokenizer_rules" ||
                    activePageId === "tokenizer_rule_editor"))) {
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

    function dispatchBack(reason, request) {
    var value = request || {};
    var requestId = normalizeId(value.requestId || "");
    var beforeDepth = Number(stack.length);
    var beforePageId = currentPageId();
    var handled = false;
    lastAction = "dispatch_back";
    lastReason = String(reason || "");
    if (requestId && requestId === lastBackRequestId) {
        duplicateBackRequestCount += 1;
        return true;
    }
    if (backDispatchInProgress) {
        duplicateBackRequestCount += 1;
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
    try {
        if (typeof activeBack === "function") {
            handled = activeBack() === true;
        } else if (activePageId !== null) {
            handled = unmountPage(activePageId, reason) === true;
        }
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

    function runtimeEditorFamily(pageId) {
        return pageId === "editor" || pageId === "tags" ||
            pageId === "tokenizer" || pageId === "tokenizer_rules" ||
            pageId === "tokenizer_rule_editor";
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
        if (tokenizer.mounted === true && active !== "tokenizer" &&
                active !== "tokenizer_rules" &&
                active !== "tokenizer_rule_editor") {
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
            migrationStage: "primary_window_settings_regex_translation_editor_tags_tokenizer_detail_filter_overlay_closed_runtime_diagnostics",
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
            backDispatchCount: Number(backDispatchCount),
            duplicateBackRequestCount:
                Number(duplicateBackRequestCount),
            backCascadeGuardCount:
                Number(backCascadeGuardCount),
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
        stack = [];
        visible = false;
        activePageId = null;
        activeView = null;
        activeBack = null;
        activeClose = null;
        mountCount = 0;
        unmountCount = 0;
        syncCount = 0;
        backDispatchInProgress = false;
        backDispatchCount = 0;
        duplicateBackRequestCount = 0;
        backCascadeGuardCount = 0;
        lastBackRequestId = "";
        lastBackRequestGeneration = -1;
        lastBackFromPageId = "";
        lastBackToPageId = "";
        lastBackDepthBefore = 0;
        lastBackDepthAfter = 0;
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
        backDispatchInProgress = false;
        lastBackRequestId = "";
        lastBackRequestGeneration = -1;
        generation += 1;
        lastAction = "shutdown";
        lastReason = "";
        return true;
    }

    ClipHub.UIShell = {
        MODULE_NAME: "ch_16_ui_shell",
        MODULE_VERSION: 9,
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
