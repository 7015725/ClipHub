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
    var CONTROL_COMMANDS = ["show", "hide", "toggle", "status", "stop"];
    var order = [
        "Log", "Database", "Classifier", "Repository",
        "EventBus", "Theme", "Clipboard", "Window", "List",
        "Editor", "Filter", "Translation", "Settings"
    ];
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
        controlEndpointFile: null
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

    function runOnMainSync(fn, timeoutMs) {
        var mainLooper = Looper.getMainLooper();
        var currentLooper = Looper.myLooper();
        var box;
        var latch;
        var handler;
        var task;
        var posted;
        var done;
        if (mainLooper !== null && currentLooper !== null &&
                currentLooper === mainLooper) {
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
            schemaVersion: 2,
            transport: "dynamic_broadcast_token",
            action: String(action),
            token: String(token),
            runtimeDir: String(context.runtimeDir),
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

    function shutdownModules() {
        var index;
        var item;
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
        var windowState = safeState(ClipHub.Window, "getState", {});
        var detail = safeState(ClipHub.List, "getDetailState", {});
        var editor = safeState(ClipHub.Editor, "getState", {});
        var filter = safeState(ClipHub.Filter, "getPanelState", {});
        var windowAttached = windowState.attachedToWindow === true ||
            windowState.attached === true;
        var detailAttached = detail.attachedToWindow === true ||
            detail.attached === true;
        var editorAttached = editor.attachedToWindow === true ||
            editor.attached === true;
        var filterAttached = filter.attachedToWindow === true ||
            filter.attached === true;
        return {
            started: state.started === true,
            uiVisible: windowAttached || detailAttached || editorAttached ||
                filterAttached,
            listVisible: list.visible === true,
            windowAttached: windowAttached,
            detailAttached: detailAttached,
            editorAttached: editorAttached,
            filterAttached: filterAttached,
            itemCount: Number(list.itemCount || 0),
            renderedCount: Number(list.renderedCount || 0),
            filterActive: list.filterActive === true
        };
    }

    function closeUi() {
        try {
            if (ClipHub.Filter && typeof ClipHub.Filter.closePanel === "function") {
                ClipHub.Filter.closePanel();
            }
        } catch (ignoredFilter) {}
        try {
            if (ClipHub.Editor && typeof ClipHub.Editor.close === "function") {
                ClipHub.Editor.close();
            }
        } catch (ignoredEditor) {}
        try {
            if (ClipHub.List && typeof ClipHub.List.hide === "function") {
                ClipHub.List.hide(true);
            } else if (ClipHub.Window && typeof ClipHub.Window.close === "function") {
                ClipHub.Window.close();
            }
        } catch (ignoredList) {}
        return uiStatus();
    }

    function showUi() {
        var result;
        closeUi();
        if (!ClipHub.List || typeof ClipHub.List.show !== "function") {
            throw new Error("ClipHub list is unavailable");
        }
        result = ClipHub.List.show({ limit: 100, widthDp: 340, heightDp: 500 });
        return { result: result, status: uiStatus() };
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
        if (!state.started) {
            return { ok: false, command: command,
                error: "ClipHub is not started" };
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
            after = closeUi();
            return { ok: true, command: command, action: "hidden",
                status: after };
        }
        before = uiStatus();
        if (before.uiVisible) {
            after = closeUi();
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
        MODULE_VERSION: 5,
        CONTROL_ACTION_BASE: CONTROL_ACTION_BASE,
        CONTROL_COMMANDS: CONTROL_COMMANDS,
        start: function (context) {
            var index;
            var item;
            if (state.started) {
                return { ok: true, started: true, reused: true };
            }
            state.context = context;
            try {
                ClipHub.Base.init(context);
                state.initialized.push(ClipHub.Base);
                acquireLock(context);
                for (index = 0; index < order.length; index += 1) {
                    item = ClipHub[order[index]];
                    if (!item) {
                        throw new Error("Missing module: " + order[index]);
                    }
                    if (typeof item.init === "function") { item.init(context); }
                    state.initialized.push(item);
                }
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
                    initializedModuleCount: order.length + 1,
                    moduleFileCount: order.length + 2,
                    moduleCount: order.length + 1,
                    controlTransport: "dynamic_broadcast_token",
                    controlCommands: CONTROL_COMMANDS,
                    controlEndpointPath: String(
                        state.controlEndpointFile.getAbsolutePath()
                    )
                };
            } catch (error) {
                unregisterControlReceiver();
                shutdownModules();
                releaseLock();
                state.context = null;
                state.started = false;
                throw error;
            }
        },
        stop: function (reason) {
            var wasStarted = state.started;
            unregisterControlReceiver();
            shutdownModules();
            releaseLock();
            state.context = null;
            state.started = false;
            return {
                ok: true,
                stopped: true,
                wasStarted: wasStarted,
                reason: String(reason || "direct")
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
        getControlEndpointPath: function () {
            return state.controlEndpointFile === null ? null :
                String(state.controlEndpointFile.getAbsolutePath());
        }
    };
}((function () { return this; }())));
