(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var Executors = Packages.java.util.concurrent.Executors;
    var Handler = Packages.android.os.Handler;
    var Looper = Packages.android.os.Looper;
    var Runnable = Packages.java.lang.Runnable;
    var RhinoContext = null;
    var executor = null;
    var mainHandler = null;
    var generation = 0;
    var state = {
        ready: false,
        status: "idle",
        lastError: null,
        requestCount: 0,
        completedCount: 0,
        cancelledCount: 0,
        lateCallbackCount: 0,
        engine: "regex-tokenizer-v2"
    };

    try { RhinoContext = Packages.org.mozilla.javascript.Context; }
    catch (ignoredRhinoContext) { RhinoContext = null; }

    function own(object, key) {
        return Object.prototype.hasOwnProperty.call(object, key);
    }

    function copyOptions(options) {
        var out = {};
        var key;
        options = options || {};
        for (key in options) { if (own(options, key)) { out[key] = options[key]; } }
        return out;
    }

    function plainError(error) {
        return {
            ok: false,
            code: "TOKENIZER_ERROR",
            message: String(error),
            retryable: true,
            engine: state.engine
        };
    }

    function tokenizeSync(text, options) {
        var result;
        try {
            if (!ClipHub.TokenizerCore || typeof ClipHub.TokenizerCore.tokenize !== "function") {
                throw new Error("TokenizerCore is unavailable");
            }
            result = ClipHub.TokenizerCore.tokenize(text, options || {});
            result.requestId = options && options.requestId !== undefined ? String(options.requestId) : "";
            result.status = result.ok === true ? "ready" : "failed";
            state.status = result.status;
            state.completedCount += 1;
            state.lastError = result.ok === true ? null : String(result.code || "TOKENIZER_ERROR");
            return result;
        } catch (error) {
            state.status = "failed";
            state.lastError = String(error);
            return plainError(error);
        }
    }

    function tokenizeWithRulesSync(text, rules, options) {
        var settings = copyOptions(options);
        settings.rules = rules || [];
        return tokenizeSync(text, settings);
    }

    function scanRegexRanges(text, rules, options) {
        if (!ClipHub.TokenizerCore || typeof ClipHub.TokenizerCore.scanRegexRanges !== "function") {
            return plainError(new Error("TokenizerCore regex adapter unavailable"));
        }
        return ClipHub.TokenizerCore.scanRegexRanges(text, rules, options || {});
    }

    function postCallback(callback, payload, requestGeneration) {
        if (typeof callback !== "function" || mainHandler === null) { return false; }
        mainHandler.post(new Runnable({
            run: function () {
                if (requestGeneration !== generation) {
                    state.lateCallbackCount += 1;
                    return;
                }
                callback(payload);
            }
        }));
        return true;
    }

    function queue(text, options, callback) {
        var requestText = String(text === null || text === undefined ? "" : text);
        var requestOptions = copyOptions(options);
        var requestGeneration;
        var task;
        if (executor === null) { executor = Executors.newSingleThreadExecutor(); }
        generation += 1;
        requestGeneration = generation;
        state.requestCount += 1;
        state.status = "loading";
        task = new Runnable({
            run: function () {
                var entered = false;
                var result;
                try {
                    if (RhinoContext !== null && typeof RhinoContext.enter === "function") {
                        RhinoContext.enter();
                        entered = true;
                    }
                    result = tokenizeSync(requestText, requestOptions);
                } catch (error) {
                    result = plainError(error);
                } finally {
                    if (entered && RhinoContext !== null && typeof RhinoContext.exit === "function") {
                        try { RhinoContext.exit(); } catch (ignoredExit) {}
                    }
                }
                postCallback(callback, result, requestGeneration);
            }
        });
        executor.submit(task);
        return {
            ok: true,
            queued: true,
            generation: requestGeneration,
            status: String(state.status),
            engine: state.engine
        };
    }

    function tokenizeAsync(text, options, callback) {
        return queue(text, options, callback);
    }

    function tokenizeWithRulesAsync(text, rules, options, callback) {
        var settings = copyOptions(options);
        settings.rules = rules || [];
        return queue(text, settings, callback);
    }

    function cancel(reason) {
        generation += 1;
        state.cancelledCount += 1;
        state.status = "cancelled";
        state.lastError = String(reason || "cancelled");
        return { ok: true, cancelled: true, generation: generation };
    }

    function init(context) {
        mainHandler = new Handler(Looper.getMainLooper());
        state.ready = true;
        state.status = "idle";
        state.lastError = null;
        return true;
    }

    function shutdown() {
        cancel("shutdown");
        if (executor !== null) {
            try { executor.shutdownNow(); } catch (ignoredExecutor) {}
        }
        executor = null;
        mainHandler = null;
        state.ready = false;
        return true;
    }

    function getState() {
        return {
            ready: state.ready === true,
            status: String(state.status),
            lastError: state.lastError,
            requestCount: Number(state.requestCount),
            completedCount: Number(state.completedCount),
            cancelledCount: Number(state.cancelledCount),
            lateCallbackCount: Number(state.lateCallbackCount),
            generation: Number(generation),
            engine: String(state.engine),
            dictionaryLoaded: false,
            dictionaryWordCount: 0,
            dictionaryPath: ""
        };
    }

    function workerProbeSpec() {
        return {
            contextEnter: RhinoContext !== null,
            callbackThread: "main-handler",
            callbackPayload: "plain-object",
            shutdownGuard: "generation-token",
            strongReferences: "none",
            engine: state.engine
        };
    }

    ClipHub.TokenizerService = {
        MODULE_NAME: "ch_19_tokenizer_service",
        MODULE_VERSION: 1,
        ENGINE_VERSION: 2,
        init: init,
        shutdown: shutdown,
        tokenizeSync: tokenizeSync,
        tokenizeAsync: tokenizeAsync,
        tokenizeWithRulesSync: tokenizeWithRulesSync,
        tokenizeWithRulesAsync: tokenizeWithRulesAsync,
        scanRegexRanges: scanRegexRanges,
        cancel: cancel,
        getState: getState,
        getWorkerProbeSpec: workerProbeSpec
    };
}((function () { return this; }())));
