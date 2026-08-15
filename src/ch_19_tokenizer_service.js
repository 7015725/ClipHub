(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var File = Packages.java.io.File;
    var FIS = Packages.java.io.FileInputStream;
    var BAOS = Packages.java.io.ByteArrayOutputStream;
    var ReflectArray = Packages.java.lang.reflect.Array;
    var JavaByte = Packages.java.lang.Byte;
    var JavaString = Packages.java.lang.String;
    var Base64 = Packages.android.util.Base64;
    var ByteArrayInputStream = Packages.java.io.ByteArrayInputStream;
    var GZIPInputStream = Packages.java.util.zip.GZIPInputStream;
    var Executors = Packages.java.util.concurrent.Executors;
    var Handler = Packages.android.os.Handler;
    var Looper = Packages.android.os.Looper;
    var Runnable = Packages.java.lang.Runnable;
    var RhinoContext = null;

    try { RhinoContext = Packages.org.mozilla.javascript.Context; }
    catch (ignoredRhinoContext) { RhinoContext = null; }

    var executor = null;
    var mainHandler = null;
    var resourceMap = {};
    var dictionary = null;
    var dictionaryWordCount = 0;
    var generation = 0;
    var state = {
        ready: false,
        status: "idle",
        lastError: null,
        requestCount: 0,
        completedCount: 0,
        cancelledCount: 0,
        lateCallbackCount: 0,
        dictionaryLoaded: false,
        dictionaryPath: ""
    };

    function closeQuietly(value) {
        if (value !== null && value !== undefined) {
            try { value.close(); } catch (ignored) {}
        }
    }

    function readBytes(stream) {
        var output = new BAOS();
        var buffer = ReflectArray.newInstance(JavaByte.TYPE, 8192);
        var count;
        try {
            while ((count = stream.read(buffer)) >= 0) {
                if (count > 0) { output.write(buffer, 0, count); }
            }
            return output.toByteArray();
        } finally {
            closeQuietly(stream);
            closeQuietly(output);
        }
    }

    function inflateGzipBase64(text) {
        var compressed = Base64.decode(String(text), Base64.DEFAULT);
        var input = new GZIPInputStream(new ByteArrayInputStream(compressed));
        return String(new JavaString(readBytes(input), "UTF-8"));
    }

    function defaultDictionaryText() {
        return [
            "剪贴板", "分词", "系统", "正则", "规则", "标签",
            "翻译", "编辑", "搜索", "复制", "删除", "导出",
            "设置", "窗口", "模块", "资源", "回退", "缓存",
            "内容", "文本", "用户", "输入", "输出", "历史",
            "ClipHub", "ShortX"
        ].join("\n");
    }

    function dictionaryResource() {
        return resourceMap && resourceMap["tokenizer.dictionary.default"] ?
            resourceMap["tokenizer.dictionary.default"] : null;
    }

    function loadDictionaryText() {
        var resource = dictionaryResource();
        var file;
        var text;
        if (!resource || !resource.runtimePath) {
            state.dictionaryPath = "builtin";
            return defaultDictionaryText();
        }
        file = new File(String(resource.runtimePath));
        if (!file.isFile()) {
            throw new Error("Tokenizer dictionary missing: " + resource.runtimePath);
        }
        text = String(new JavaString(readBytes(new FIS(file)), "UTF-8"));
        state.dictionaryPath = String(resource.runtimePath);
        if (String(resource.encoding || "") === "gzip+base64") {
            return inflateGzipBase64(text);
        }
        return text;
    }

    function ensureDictionary() {
        if (dictionary !== null) { return dictionary; }
        if (!ClipHub.TokenizerCore ||
                typeof ClipHub.TokenizerCore.normalizeDictionary !== "function") {
            throw new Error("TokenizerCore is unavailable");
        }
        state.status = "loading";
        dictionary = ClipHub.TokenizerCore.normalizeDictionary(loadDictionaryText());
        dictionaryWordCount = dictionary.words.length;
        state.dictionaryLoaded = true;
        state.status = "ready";
        state.lastError = null;
        return dictionary;
    }

    function plainError(error) {
        return {
            ok: false,
            code: "TOKENIZER_ERROR",
            message: String(error),
            retryable: true
        };
    }

    function tokenizeSync(text, options) {
        var dictionaryValue;
        var result;
        try {
            dictionaryValue = ensureDictionary();
            result = ClipHub.TokenizerCore.tokenize(text, {
                dictionary: dictionaryValue
            });
            result.requestId = options && options.requestId !== undefined ?
                String(options.requestId) : "";
            result.status = "ready";
            result.dictionaryWordCount = dictionaryWordCount;
            state.status = "ready";
            state.completedCount += 1;
            state.lastError = null;
            return result;
        } catch (error) {
            state.status = "failed";
            state.lastError = String(error);
            return plainError(error);
        }
    }

    function scanRegexRanges(text, rules, options) {
        if (!ClipHub.TokenizerCore ||
                typeof ClipHub.TokenizerCore.scanRegexRanges !== "function") {
            return plainError(new Error("TokenizerCore regex adapter unavailable"));
        }
        return ClipHub.TokenizerCore.scanRegexRanges(text, rules, options || {});
    }

    function postCallback(callback, payload, requestGeneration) {
        if (typeof callback !== "function") { return false; }
        if (mainHandler === null) { return false; }
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

    function tokenizeAsync(text, options, callback) {
        var requestGeneration;
        var requestText = String(text === null || text === undefined ? "" : text);
        var requestOptions = options || {};
        var task;
        if (executor === null) {
            executor = Executors.newSingleThreadExecutor();
        }
        generation += 1;
        requestGeneration = generation;
        state.requestCount += 1;
        state.status = "loading";
        task = new Runnable({
            run: function () {
                var entered = false;
                var result;
                try {
                    if (RhinoContext !== null &&
                            typeof RhinoContext.enter === "function") {
                        RhinoContext.enter();
                        entered = true;
                    }
                    result = tokenizeSync(requestText, requestOptions);
                } catch (error) {
                    result = plainError(error);
                } finally {
                    if (entered && RhinoContext !== null &&
                            typeof RhinoContext.exit === "function") {
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
            status: String(state.status)
        };
    }

    function cancel(reason) {
        generation += 1;
        state.cancelledCount += 1;
        state.status = "cancelled";
        state.lastError = String(reason || "cancelled");
        return { ok: true, cancelled: true, generation: generation };
    }

    function init(context) {
        resourceMap = context && context.resourceMap ? context.resourceMap : {};
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
        resourceMap = {};
        dictionary = null;
        state.ready = false;
        state.dictionaryLoaded = false;
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
            dictionaryLoaded: state.dictionaryLoaded === true,
            dictionaryWordCount: Number(dictionaryWordCount),
            dictionaryPath: String(state.dictionaryPath || ""),
            generation: Number(generation)
        };
    }

    function workerProbeSpec() {
        return {
            contextEnter: RhinoContext !== null,
            callbackThread: "main-handler",
            callbackPayload: "plain-object",
            shutdownGuard: "generation-token",
            strongReferences: "resourceMap-only"
        };
    }

    ClipHub.TokenizerService = {
        MODULE_NAME: "ch_19_tokenizer_service",
        MODULE_VERSION: 1,
        init: init,
        shutdown: shutdown,
        tokenizeSync: tokenizeSync,
        tokenizeAsync: tokenizeAsync,
        scanRegexRanges: scanRegexRanges,
        cancel: cancel,
        getState: getState,
        getWorkerProbeSpec: workerProbeSpec
    };
}((function () { return this; }())));
