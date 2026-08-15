(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var RAF = Packages.java.io.RandomAccessFile;
    var File = Packages.java.io.File;
    var FOS = Packages.java.io.FileOutputStream;
    var JavaString = Packages.java.lang.String;
    var Thread = Packages.java.lang.Thread;
    var CountDownLatch = Packages.java.util.concurrent.CountDownLatch;
    var TimeUnit = Packages.java.util.concurrent.TimeUnit;
    var SecureRandom = Packages.java.security.SecureRandom;
    var Build = Packages.android.os.Build;
    var Looper = Packages.android.os.Looper;
    var Handler = Packages.android.os.Handler;
    var AndroidContext = Packages.android.content.Context;
    var IntentFilter = Packages.android.content.IntentFilter;

    var CONTROL_ACTION_BASE = "com.cliphub.runtime.CONTROL";
    var CONTROL_ENDPOINT_SCHEMA = 3;
    var CONTROL_COMMANDS = ["show", "hide", "toggle", "status", "stop"];
    var state = {
        started: false,
        context: null,
        initialized: [],
        lockFile: null,
        lockChannel: null,
        lockHandle: null,
        controlContext: null,
        controlReceiver: null,
        controlAction: "",
        controlToken: "",
        controlEndpointFile: null,
        entryVersion: 0,
        moduleSetVersion: "",
        sourceRef: "",
        stopping: false,
        lifecycleGeneration: 0,
        lastStopReason: "",
        filterPreparedForShutdown: false,
        filterStopping: false,
        filterGuardInstalled: false,
        runtimePlan: []
    };

    function closeQuietly(value) {
        if (value !== null && value !== undefined) {
            try { value.close(); } catch (ignored) {}
        }
    }

    function errorText(error) {
        try {
            if (error && error.javaException) {
                return String(error.javaException.getClass().getName()) +
                    ": " + String(error);
            }
        } catch (ignored) {}
        return String(error);
    }

    function isMainThread() {
        var mainLooper;
        var mainThread;
        try {
            if (ClipHub.Window &&
                    typeof ClipHub.Window.isMainThread === "function") {
                return ClipHub.Window.isMainThread();
            }
        } catch (ignoredWindow) {}
        mainLooper = Looper.getMainLooper();
        if (mainLooper === null) { return false; }
        try {
            if (Build.VERSION.SDK_INT >= 23) {
                return mainLooper.isCurrentThread();
            }
        } catch (ignoredCurrentThread) {}
        try {
            mainThread = mainLooper.getThread();
            return mainThread !== null &&
                Number(Thread.currentThread().getId()) ===
                Number(mainThread.getId());
        } catch (ignoredThread) { return false; }
    }

    function runOnMainSync(fn, timeoutMs) {
        var mainLooper = Looper.getMainLooper();
        var box;
        var latch;
        var handler;
        var task;
        var posted;
        var done;
        if (isMainThread()) {
            return { ok: true, value: fn(), direct: true };
        }
        box = { ok: false, value: null, error: null };
        latch = new CountDownLatch(1);
        handler = new Handler(mainLooper);
        task = new Packages.java.lang.Runnable({
            run: function () {
                try {
                    box.value = fn();
                    box.ok = true;
                } catch (error) {
                    box.error = error;
                } finally {
                    latch.countDown();
                }
            }
        });
        posted = handler.post(task);
        if (!posted) {
            return { ok: false, error: new Error("Main handler post failed") };
        }
        done = latch.await(Number(timeoutMs || 2000), TimeUnit.MILLISECONDS);
        if (!done) {
            try { handler.removeCallbacks(task); } catch (ignored) {}
            return { ok: false, error: new Error("Main handler timeout") };
        }
        return box;
    }

    function randomToken() {
        var bytes = Packages.java.lang.reflect.Array.newInstance(
            Packages.java.lang.Byte.TYPE, 24
        );
        var random = new SecureRandom();
        var parts = [];
        var index;
        var number;
        var hex;
        random.nextBytes(bytes);
        for (index = 0; index < bytes.length; index += 1) {
            number = Number(bytes[index]);
            if (number < 0) { number += 256; }
            hex = number.toString(16);
            parts.push(hex.length === 1 ? "0" + hex : hex);
        }
        return parts.join("");
    }

    function writeUtf8(file, value) {
        var stream = null;
        try {
            stream = new FOS(file, false);
            stream.write(new JavaString(String(value)).getBytes("UTF-8"));
            stream.flush();
            return true;
        } finally {
            closeQuietly(stream);
        }
    }

    function writeControlAck(runtimeDir, requestId, payload) {
        var safeId = String(requestId || "").replace(/[^A-Za-z0-9._-]/g, "_");
        var cacheDir;
        var file;
        if (!safeId) { return false; }
        cacheDir = ClipHub.Base.ensureDir(
            ClipHub.Base.joinPath(runtimeDir, "cache")
        );
        file = new File(cacheDir, "control_ack_" + safeId + ".json");
        return writeUtf8(file, JSON.stringify(payload, null, 2) + "\n");
    }

    function writeControlEndpoint(context, action, token) {
        var cacheDir = ClipHub.Base.ensureDir(
            ClipHub.Base.joinPath(context.runtimeDir, "cache")
        );
        var file = new File(cacheDir, "control_endpoint.json");
        writeUtf8(file, JSON.stringify({
            schemaVersion: CONTROL_ENDPOINT_SCHEMA,
            transport: "dynamic_broadcast_token",
            action: String(action),
            token: String(token),
            runtimeDir: String(context.runtimeDir),
            entryVersion: Number(state.entryVersion || 0),
            moduleSetVersion: String(state.moduleSetVersion || ""),
            sourceRef: String(state.sourceRef || ""),
            commands: CONTROL_COMMANDS,
            createdAt: ClipHub.Base.now()
        }, null, 2) + "\n");
        state.controlEndpointFile = file;
        return file;
    }

    function removeControlEndpoint() {
        var file = state.controlEndpointFile;
        state.controlEndpointFile = null;
        if (file !== null && file.exists()) {
            try { file.delete(); } catch (ignored) {}
        }
    }

    function releaseLock() {
        if (state.lockHandle !== null) {
            try { state.lockHandle.release(); } catch (ignored) {}
        }
        if (state.lockChannel !== null) {
            try { state.lockChannel.close(); } catch (channelIgnored) {}
        }
        if (state.lockFile !== null) {
            try { state.lockFile.close(); } catch (fileIgnored) {}
        }
        state.lockHandle = null;
        state.lockChannel = null;
        state.lockFile = null;
    }

    function installFilterLifecycleGuard() {
        var filter = ClipHub.Filter;
        var originalShowPanel;
        var originalShowRoot;
        var originalClosePanel;
        var originalGetPanelState;
        var originalShutdown;
        if (!filter) { return false; }
        if (filter.__paginationStage0GuardInstalled === true) {
            state.filterGuardInstalled = true;
            return true;
        }
        originalShowPanel = filter.showPanel;
        originalShowRoot = filter.showRoot;
        originalClosePanel = filter.closePanel;
        originalGetPanelState = filter.getPanelState;
        originalShutdown = filter.shutdown;

        if (typeof originalShowPanel === "function") {
            filter.showPanel = function (options) {
                if (!state.started || state.stopping ||
                        state.filterStopping) {
                    throw new Error(
                        "ClipHub filter show rejected during lifecycle stop");
                }
                return originalShowPanel(options);
            };
        }
        if (typeof originalShowRoot === "function") {
            filter.showRoot = function (options) {
                if (!state.started || state.stopping ||
                        state.filterStopping) {
                    throw new Error(
                        "ClipHub filter root rejected during lifecycle stop");
                }
                return originalShowRoot(options);
            };
        }
        filter.prepareForAppShutdown = function (reason) {
            var closeResult = null;
            state.filterPreparedForShutdown = true;
            state.filterStopping = true;
            if (typeof originalClosePanel === "function") {
                try {
                    closeResult = originalClosePanel({
                        restoreList: false,
                        reason: String(reason || "app_shutdown"),
                        destroyCache: true
                    });
                } catch (ignoredClose) {}
            }
            return {
                ok: true,
                prepared: true,
                reason: String(reason || "app_shutdown"),
                lifecycleGeneration:
                    Number(state.lifecycleGeneration),
                closeResult: closeResult
            };
        };
        if (typeof originalGetPanelState === "function") {
            filter.getPanelState = function () {
                var panel = originalGetPanelState() || {};
                panel.appLifecycleGeneration =
                    Number(state.lifecycleGeneration);
                panel.appStopping = state.stopping === true;
                panel.filterStopping = state.filterStopping === true;
                panel.rapidCloseGuardInline = true;
                return panel;
            };
        }
        if (typeof originalShutdown === "function") {
            filter.shutdown = function () {
                state.filterStopping = true;
                return originalShutdown();
            };
        }
        filter.__paginationStage0GuardInstalled = true;
        state.filterGuardInstalled = true;
        return true;
    }

    function prepareFilterForShutdown(reason) {
        if (state.filterPreparedForShutdown) { return true; }
        state.filterPreparedForShutdown = true;
        state.filterStopping = true;
        try {
            if (ClipHub.Filter &&
                    typeof ClipHub.Filter.prepareForAppShutdown ===
                        "function") {
                ClipHub.Filter.prepareForAppShutdown(
                    reason || "app_shutdown");
                return true;
            }
            if (ClipHub.Filter &&
                    typeof ClipHub.Filter.closePanel === "function") {
                ClipHub.Filter.closePanel({
                    restoreList: false,
                    reason: String(reason || "app_shutdown"),
                    destroyCache: true
                });
            }
        } catch (ignored) {}
        return true;
    }

    function shutdownModules(reason) {
        var index;
        var item;
        prepareFilterForShutdown(reason || "app_shutdown");
        for (index = state.initialized.length - 1; index >= 0; index -= 1) {
            item = state.initialized[index];
            try {
                if (item && typeof item.shutdown === "function") {
                    item.shutdown();
                }
            } catch (ignored) {}
        }
        state.initialized = [];
    }

    function acquireLock(context) {
        var dir = ClipHub.Base.ensureDir(
            ClipHub.Base.joinPath(context.runtimeDir, "data")
        );
        var errorName;
        try {
            state.lockFile = new RAF(new File(dir, "cliphub.lock"), "rw");
            state.lockChannel = state.lockFile.getChannel();
            state.lockHandle = state.lockChannel.tryLock();
        } catch (error) {
            errorName = error && error.getClass
                ? String(error.getClass().getName()) : String(error);
            releaseLock();
            if (errorName.indexOf("OverlappingFileLockException") >= 0 ||
                    String(error).indexOf("OverlappingFileLockException") >= 0) {
                throw new Error("ClipHub is already running");
            }
            throw error;
        }
        if (state.lockHandle === null) {
            releaseLock();
            throw new Error("ClipHub is already running");
        }
    }

    function buildLifecyclePlan(context) {
        var source = context && context.runtimePlan ? context.runtimePlan : [];
        var plan = [];
        var index;
        var item;
        for (index = 0; index < source.length; index += 1) {
            item = source[index];
            if (item && String(item.runtimeRole || "") === "managed") {
                plan.push({
                    name: String(item.name || ""),
                    exportName: String(item.export || ""),
                    lifecycleIndex: Number(item.lifecycleIndex || 0)
                });
            }
        }
        plan.sort(function (left, right) {
            if (left.lifecycleIndex !== right.lifecycleIndex) {
                return left.lifecycleIndex - right.lifecycleIndex;
            }
            return left.name.localeCompare(right.name);
        });
        return plan;
    }

    function runtimeModuleCount(context) {
        var source = context && context.runtimePlan ?
            context.runtimePlan : state.runtimePlan;
        return source && source.length ? source.length : state.initialized.length;
    }

    function moduleFileCount(context) {
        var moduleDir;
        var files;
        var count = 0;
        var index;
        var name;
        try {
            moduleDir = context && context.moduleDir ?
                new File(String(context.moduleDir)) : null;
            if (moduleDir === null || !moduleDir.isDirectory()) { return 0; }
            files = moduleDir.listFiles();
            if (files === null) { return 0; }
            for (index = 0; index < files.length; index += 1) {
                if (files[index] === null || !files[index].isFile()) { continue; }
                name = String(files[index].getName());
                if (/^ch_[0-9][0-9]_.+\.js$/.test(name)) { count += 1; }
            }
        } catch (ignored) { return 0; }
        return count;
    }

    function safeState(module, method, fallback) {
        try {
            if (module && typeof module[method] === "function") {
                return module[method]();
            }
        } catch (ignored) {}
        return fallback;
    }

    function uiStatus() {
        var list = safeState(ClipHub.List, "getState", {});
        var detail = safeState(ClipHub.List, "getDetailState", {});
        var editor = safeState(ClipHub.Editor, "getState", {});
        var filter = safeState(ClipHub.Filter, "getPanelState", {});
        var settings = safeState(ClipHub.Settings, "getState", {});
        var translation = safeState(ClipHub.Translation, "getState", {});
        var geometry = safeState(ClipHub.Window, "getState", {});
        var removal = safeState(ClipHub.Window, "getRemovalState", {});
        var colorSafety = safeState(
            ClipHub.Theme, "getColorSafetyState", {});
        var uiShell = safeState(ClipHub.UIShell, "getState", {});
        var runtimeDiagnostics = safeState(
            ClipHub.UIShell, "getRuntimeDiagnostics", null);
        var detailAttached = detail.attachedToWindow === true ||
            detail.attached === true;
        var editorAttached = editor.attachedToWindow === true ||
            editor.attached === true;
        var filterAttached = filter.attachedToWindow === true ||
            filter.attached === true;
        var settingsAttached = settings.attachedToWindow === true ||
            settings.attached === true;
        var translationAttached = translation.attachedToWindow === true ||
            translation.attached === true;
        return {
            started: state.started === true,
            stopping: state.stopping === true,
            lifecycleGeneration: Number(state.lifecycleGeneration),
            lastStopReason: String(state.lastStopReason || ""),
            filterPreparedForShutdown:
                state.filterPreparedForShutdown === true,
            filterStopping: state.filterStopping === true,
            filterGuardInstalled: state.filterGuardInstalled === true,
            rapidCloseGuardInline:
                filter.rapidCloseGuardInline === true,
            uiVisible: detailAttached || editorAttached || filterAttached ||
                settingsAttached || translationAttached,
            listVisible: false,
            windowAttached: false,
            geometryServiceAttached: geometry.primaryAttached === true,
            detailAttached: detailAttached,
            editorAttached: editorAttached,
            filterAttached: filterAttached,
            settingsAttached: settingsAttached,
            translationAttached: translationAttached,
            homeFilterAttachedCount: filterAttached ? 1 : 0,
            homeFilterExclusive: true,
            primarySurface: filterAttached && filter.rootMode === true ?
                "filter_root" : "none",
            filterRootMode: filter.rootMode === true,
            legacyHomeAttached: false,
            legacyHomeRemoved: true,
            resizeCorner: geometry.resizeCorner || "bottom_right",
            itemCount: Number(list.itemCount || 0),
            renderedCount: Number(filter.resultCardCount ||
                list.renderedCount || 0),
            filterActive: filter.active === true ||
                list.filterActive === true,
            contentReady: filter.contentReady === true,
            windowCacheBuilt: filter.panelBuilt === true,
            windowCacheReused: filter.lastShowReused === true,
            startupPerformance: filter.performance || null,
            windowRemoval: removal,
            colorSafety: colorSafety,
            hydrationWorker: safeState(
                ClipHub.Filter, "getHydrationWorkerState", null),
            scrollPerformance: safeState(
                ClipHub.Filter, "getScrollPerformanceState", null),
            uiShell: uiShell,
            runtimeDiagnostics: runtimeDiagnostics
        };
    }

    function closeUi(reason) {
        var hideReason = String(reason || "app_hide");
        try {
            if (ClipHub.Translation &&
                    typeof ClipHub.Translation.close === "function") {
                ClipHub.Translation.close(hideReason);
            }
        } catch (ignoredTranslation) {}
        try {
            if (ClipHub.Settings &&
                    typeof ClipHub.Settings.close === "function") {
                ClipHub.Settings.close(hideReason);
            }
        } catch (ignoredSettings) {}
        try {
            if (ClipHub.Filter &&
                    typeof ClipHub.Filter.closePanel === "function") {
                ClipHub.Filter.closePanel({
                    restoreList: false,
                    reason: hideReason
                });
            }
        } catch (ignoredFilter) {}
        try {
            if (ClipHub.Editor &&
                    typeof ClipHub.Editor.captureDraft === "function") {
                ClipHub.Editor.captureDraft(hideReason);
            }
        } catch (ignoredEditorDraft) {}
        try {
            if (ClipHub.Editor &&
                    typeof ClipHub.Editor.close === "function") {
                ClipHub.Editor.close();
            }
        } catch (ignoredEditorClose) {}
        try {
            if (ClipHub.List && typeof ClipHub.List.hide === "function") {
                ClipHub.List.hide(false);
            }
        } catch (ignoredList) {}
        return uiStatus();
    }

    function showUi() {
        var result;
        var before;
        if (!state.started || state.stopping || state.filterStopping) {
            throw new Error("ClipHub is not available for show");
        }
        before = uiStatus();
        if (before.uiVisible) {
            return { result: null, reused: true, status: before };
        }
        if (ClipHub.Editor &&
                typeof ClipHub.Editor.hasPendingDraft === "function" &&
                ClipHub.Editor.hasPendingDraft() === true &&
                typeof ClipHub.Editor.restoreDraft === "function") {
            result = ClipHub.Editor.restoreDraft({ requestKeyboard: false });
            if (result && result.ok === true) {
                return { result: result, restoredDraft: true,
                    status: uiStatus() };
            }
        }
        if (!ClipHub.Filter) {
            throw new Error("ClipHub filter root is unavailable");
        }
        if (typeof ClipHub.Filter.showRoot === "function") {
            result = ClipHub.Filter.showRoot({
                requestKeyboard: false,
                showAdvanced: false
            });
        } else if (typeof ClipHub.Filter.showPanel === "function") {
            result = ClipHub.Filter.showPanel({
                requestKeyboard: false,
                showAdvanced: false,
                rootMode: true
            });
        } else {
            throw new Error("ClipHub filter root cannot be shown");
        }
        return { result: result, reused: false, status: uiStatus() };
    }

    function executeControlCommand(command) {
        var before;
        var after;
        var stopResult;
        command = String(command || "").toLowerCase();
        if (CONTROL_COMMANDS.indexOf(command) < 0) {
            return { ok: false, command: command,
                error: "Unsupported control command" };
        }
        if (command === "stop") {
            stopResult = ClipHub.App.stop("broadcast_token");
            return {
                ok: true,
                command: command,
                action: "stopped",
                stopped: stopResult.stopped === true
            };
        }
        if (!state.started || state.stopping) {
            return { ok: false, command: command,
                error: "ClipHub is not started or is stopping" };
        }
        if (command === "status") {
            return { ok: true, command: command, action: "status",
                status: uiStatus() };
        }
        if (command === "show") {
            after = showUi().status;
            return { ok: true, command: command, action: "shown",
                status: after };
        }
        if (command === "hide") {
            after = closeUi("control_hide");
            return { ok: true, command: command, action: "hidden",
                status: after };
        }
        before = uiStatus();
        if (before.uiVisible) {
            after = closeUi("control_toggle_hide");
            return { ok: true, command: command, action: "hidden",
                status: after };
        }
        after = showUi().status;
        return { ok: true, command: command, action: "shown",
            status: after };
    }

    function unregisterControlReceiver() {
        var appContext = state.controlContext;
        var receiver = state.controlReceiver;
        var result;
        state.controlContext = null;
        state.controlReceiver = null;
        state.controlAction = "";
        state.controlToken = "";
        removeControlEndpoint();
        if (appContext === null || receiver === null) { return true; }
        result = runOnMainSync(function () {
            try { appContext.unregisterReceiver(receiver); }
            catch (ignored) {}
            return true;
        }, 2000);
        return result.ok === true;
    }

    function registerControlReceiver(context) {
        var androidContext = context && context.androidContext
            ? context.androidContext : global.context;
        var appContext;
        var receiver;
        var filter;
        var result;
        var token;
        var action;
        if (androidContext === null || androidContext === undefined) {
            throw new Error("Android context unavailable for control receiver");
        }
        appContext = androidContext.getApplicationContext();
        if (appContext === null) { appContext = androidContext; }
        token = randomToken();
        action = CONTROL_ACTION_BASE + "." + token;
        receiver = new JavaAdapter(Packages.android.content.BroadcastReceiver, {
            onReceive: function (receiverContext, intent) {
                var target;
                var command;
                var requestId;
                var suppliedToken;
                var runtimeDir = String(context.runtimeDir);
                var response;
                var callbackThread = Thread.currentThread();
                try {
                    target = intent === null ? null :
                        intent.getStringExtra("runtimeDir");
                    command = intent === null ? null :
                        intent.getStringExtra("command");
                    requestId = intent === null ? null :
                        intent.getStringExtra("requestId");
                    suppliedToken = intent === null ? null :
                        intent.getStringExtra("controlToken");
                    if (String(target || "") !== runtimeDir ||
                            String(suppliedToken || "") !== token) {
                        return;
                    }
                    response = executeControlCommand(command);
                    response.runtimeDir = runtimeDir;
                    response.transport = "dynamic_broadcast_token";
                    response.endpointSchemaVersion = CONTROL_ENDPOINT_SCHEMA;
                    response.entryVersion = Number(state.entryVersion || 0);
                    response.moduleSetVersion = String(state.moduleSetVersion || "");
                    response.sourceRef = String(state.sourceRef || "");
                    response.threadId = Number(callbackThread.getId());
                    response.threadName = String(callbackThread.getName());
                    writeControlAck(runtimeDir, requestId, response);
                } catch (error) {
                    try {
                        writeControlAck(runtimeDir, requestId, {
                            ok: false,
                            command: String(command || ""),
                            stopped: false,
                            runtimeDir: runtimeDir,
                            transport: "dynamic_broadcast_token",
                            threadId: Number(callbackThread.getId()),
                            threadName: String(callbackThread.getName()),
                            error: errorText(error)
                        });
                    } catch (ignored) {}
                }
            }
        });
        filter = new IntentFilter(action);
        result = runOnMainSync(function () {
            if (Build.VERSION.SDK_INT >= 33) {
                appContext.registerReceiver(receiver, filter,
                    AndroidContext.RECEIVER_EXPORTED);
            } else {
                appContext.registerReceiver(receiver, filter);
            }
            return true;
        }, 2000);
        if (!result.ok) {
            throw result.error || new Error("Control receiver registration failed");
        }
        state.controlContext = appContext;
        state.controlReceiver = receiver;
        state.controlAction = action;
        state.controlToken = token;
        try {
            writeControlEndpoint(context, action, token);
        } catch (endpointError) {
            unregisterControlReceiver();
            throw endpointError;
        }
        return true;
    }

    ClipHub.App = {
        MODULE_NAME: "ch_15_app",
        MODULE_VERSION: 23,
        CONTROL_ACTION_BASE: CONTROL_ACTION_BASE,
        CONTROL_ENDPOINT_SCHEMA: CONTROL_ENDPOINT_SCHEMA,
        CONTROL_COMMANDS: CONTROL_COMMANDS,
        start: function (context) {
            var index;
            var item;
            var plan;
            if (state.started) {
                return { ok: true, started: true, reused: true };
            }
            if (state.stopping) {
                throw new Error("ClipHub is stopping");
            }
            state.stopping = false;
            state.filterPreparedForShutdown = false;
            state.filterStopping = false;
            state.filterGuardInstalled = false;
            state.lastStopReason = "";
            state.lifecycleGeneration += 1;
            state.context = context;
            state.runtimePlan = context && context.runtimePlan ? context.runtimePlan : [];
            state.entryVersion = Number(context && context.entryVersion || 0);
            state.moduleSetVersion = String(
                context && context.moduleSetVersion || "");
            state.sourceRef = String(context && context.sourceRef || "");
            try {
                ClipHub.Base.init(context);
                state.initialized.push(ClipHub.Base);
                acquireLock(context);
                plan = buildLifecyclePlan(context);
                for (index = 0; index < plan.length; index += 1) {
                    item = ClipHub[plan[index].exportName];
                    if (!item) {
                        throw new Error("Missing module: " + plan[index].exportName);
                    }
                    if (typeof item.init === "function") { item.init(context); }
                    state.initialized.push(item);
                }
                installFilterLifecycleGuard();
                state.started = true;
                registerControlReceiver(context);
                ClipHub.Log.info("application skeleton started");
                return {
                    ok: true,
                    started: true,
                    reused: false,
                    status: "skeleton_ready",
                    runtimeDir: context.runtimeDir,
                    databasePath: ClipHub.Database.getPath(),
                    initializedModuleCount: state.initialized.length,
                    moduleFileCount: moduleFileCount(context),
                    moduleCount: runtimeModuleCount(context),
                    placeholderModuleFileCount: Math.max(0,
                        moduleFileCount(context) - runtimeModuleCount()),
                    entryVersion: Number(state.entryVersion || 0),
                    moduleSetVersion: String(state.moduleSetVersion || ""),
                    sourceRef: String(state.sourceRef || ""),
                    controlTransport: "dynamic_broadcast_token",
                    controlEndpointSchemaVersion: CONTROL_ENDPOINT_SCHEMA,
                    controlCommands: CONTROL_COMMANDS,
                    controlEndpointPath: String(
                        state.controlEndpointFile.getAbsolutePath()
                    )
                };
            } catch (error) {
                state.stopping = true;
                state.started = false;
                state.lifecycleGeneration += 1;
                state.lastStopReason = "start_failed";
                state.filterPreparedForShutdown = false;
                prepareFilterForShutdown("start_failed");
                unregisterControlReceiver();
                shutdownModules("start_failed");
                releaseLock();
                state.context = null;
                state.entryVersion = 0;
                state.moduleSetVersion = "";
                state.sourceRef = "";
                state.runtimePlan = [];
                state.started = false;
                state.stopping = false;
                throw error;
            }
        },
        stop: function (reason) {
            var wasStarted = state.started;
            var stopReason = String(reason || "direct");
            if (state.stopping) {
                return {
                    ok: true,
                    stopped: true,
                    reused: true,
                    wasStarted: wasStarted,
                    reason: stopReason,
                    lifecycleGeneration:
                        Number(state.lifecycleGeneration)
                };
            }
            state.stopping = true;
            state.started = false;
            state.lifecycleGeneration += 1;
            state.lastStopReason = stopReason;
            state.filterPreparedForShutdown = false;
            prepareFilterForShutdown(stopReason);
            unregisterControlReceiver();
            shutdownModules(stopReason);
            releaseLock();
            state.context = null;
            state.entryVersion = 0;
            state.moduleSetVersion = "";
            state.sourceRef = "";
            state.runtimePlan = [];
            state.stopping = false;
            return {
                ok: true,
                stopped: true,
                reused: false,
                wasStarted: wasStarted,
                reason: stopReason,
                lifecycleGeneration:
                    Number(state.lifecycleGeneration),
                filterPreparedForShutdown:
                    state.filterPreparedForShutdown === true,
                filterStopping: state.filterStopping === true
            };
        },
        isStarted: function () { return state.started; },
        getStatus: uiStatus,
        executeControlCommand: executeControlCommand,
        getControlTransport: function () {
            return "dynamic_broadcast_token";
        },
        getControlCommands: function () {
            return CONTROL_COMMANDS.slice(0);
        },
        getControlMetadata: function () {
            return {
                endpointSchemaVersion: CONTROL_ENDPOINT_SCHEMA,
                entryVersion: Number(state.entryVersion || 0),
                moduleSetVersion: String(state.moduleSetVersion || ""),
                sourceRef: String(state.sourceRef || "")
            };
        },
        getControlEndpointPath: function () {
            return state.controlEndpointFile === null ? null :
                String(state.controlEndpointFile.getAbsolutePath());
        }
    };
}((function () { return this; }())));
