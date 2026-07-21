(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var RAF = Packages.java.io.RandomAccessFile;
    var File = Packages.java.io.File;
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
        lockHandle: null
    };

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
            if (errorName.indexOf("OverlappingFileLockException") >= 0) {
                throw new Error("ClipHub is already running");
            }
            throw error;
        }

        if (state.lockHandle === null) {
            releaseLock();
            throw new Error("ClipHub is already running");
        }
    }

    ClipHub.App = {
        MODULE_NAME: "ch_15_app",
        MODULE_VERSION: 1,
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
                    if (!item) { throw new Error("Missing module: " + order[index]); }
                    if (typeof item.init === "function") { item.init(context); }
                    state.initialized.push(item);
                }

                state.started = true;
                ClipHub.Log.info("application skeleton started");
                return {
                    ok: true,
                    started: true,
                    reused: false,
                    status: "skeleton_ready",
                    runtimeDir: context.runtimeDir,
                    databasePath: ClipHub.Database.getPath(),
                    moduleCount: order.length + 1
                };
            } catch (error) {
                shutdownModules();
                releaseLock();
                state.context = null;
                state.started = false;
                throw error;
            }
        },
        stop: function () {
            shutdownModules();
            releaseLock();
            state.context = null;
            state.started = false;
            return { ok: true, stopped: true };
        },
        isStarted: function () { return state.started; }
    };
}((function () { return this; }())));
