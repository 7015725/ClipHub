(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var Context = Packages.android.content.Context;
    var System = Packages.java.lang.System;
    var Executors = Packages.java.util.concurrent.Executors;
    var Handler = Packages.android.os.Handler;
    var Looper = Packages.android.os.Looper;
    var Runnable = Packages.java.lang.Runnable;
    var RhinoContext = null;
    var executor = null;
    var mainHandler = null;
    var appContext = null;
    var preferences = null;
    var generation = 0;
    var customIdCounter = 0;

    var PREFS_NAME = "cliphub_tokenizer_rules_v1";
    var KEY_CUSTOM_RULES = "custom_rules_json";
    var KEY_SELECTED_RULES = "selected_rule_ids_json";
    var KEY_SCHEMA_VERSION = "schema_version";
    var RULE_SCHEMA_VERSION = 1;
    var MAX_CUSTOM_RULES = 64;
    var MAX_SELECTED_RULES = 64;
    var MAX_TITLE_LENGTH = 80;
    var MAX_PATTERN_LENGTH = 2048;
    var DEFAULT_SELECTED_IDS = [
        "builtin.url",
        "builtin.number_unit",
        "tokenizer.preset.punctuation"
    ];
    var EXTRA_PRESETS = [
        {
            id: "tokenizer.preset.punctuation",
            title: "标点切分",
            pattern: "[，。！？；、,;!?]+",
            priority: 1180,
            mode: "split",
            keepDelimiter: true,
            type: "symbol"
        },
        {
            id: "tokenizer.preset.whitespace",
            title: "空白切分",
            pattern: "\\s+",
            priority: 1160,
            mode: "split",
            keepDelimiter: false,
            type: "symbol"
        },
        {
            id: "tokenizer.preset.chinese_brackets",
            title: "中文括号",
            pattern: "[（）【】《》「」『』]+",
            priority: 1140,
            mode: "split",
            keepDelimiter: true,
            type: "symbol"
        }
    ];

    var customRules = [];
    var selectedRuleIds = [];
    var state = {
        ready: false,
        status: "idle",
        lastError: null,
        requestCount: 0,
        completedCount: 0,
        cancelledCount: 0,
        lateCallbackCount: 0,
        ruleConfigSaveCount: 0,
        ruleConfigDeleteCount: 0,
        ruleSelectionChangeCount: 0,
        ruleConfigLoadErrorCount: 0,
        engine: "regex-tokenizer-v2"
    };

    try { RhinoContext = Packages.org.mozilla.javascript.Context; }
    catch (ignoredRhinoContext) { RhinoContext = null; }

    function own(object, key) {
        return Object.prototype.hasOwnProperty.call(object, key);
    }

    function copyObject(value) {
        var out = {};
        var key;
        value = value || {};
        for (key in value) {
            if (own(value, key)) { out[key] = value[key]; }
        }
        return out;
    }

    function copyArray(value) {
        return value && value.slice ? value.slice(0) : [];
    }

    function copyOptions(options) {
        return copyObject(options || {});
    }

    function trimText(value) {
        return String(value === null || value === undefined ? "" : value)
            .replace(/^\s+|\s+$/g, "");
    }

    function parseJsonArray(text, fallback) {
        var value;
        try {
            value = JSON.parse(String(text || "[]"));
            if (Object.prototype.toString.call(value) !== "[object Array]") {
                throw new Error("JSON value is not an array");
            }
            return value;
        } catch (error) {
            state.ruleConfigLoadErrorCount += 1;
            state.lastError = String(error);
            return copyArray(fallback || []);
        }
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

    function normalizeRuleConfig(input, preset, fallbackId) {
        var source = input || {};
        var id = trimText(source.id || fallbackId || "");
        var title = trimText(source.title || source.remark || source.name || "");
        var pattern = String(source.pattern || source.regex || "");
        var mode = String(source.mode || source.action || "match").toLowerCase();
        var priority = Number(source.priority);
        if (!id) { throw new Error("分词规则 ID 不能为空"); }
        if (!title) { title = preset ? "预制规则" : "自定义规则"; }
        if (title.length > MAX_TITLE_LENGTH) {
            title = title.substring(0, MAX_TITLE_LENGTH);
        }
        if (!pattern || pattern.length > MAX_PATTERN_LENGTH) {
            throw new Error("分词正则长度无效");
        }
        if (!isFinite(priority)) { priority = preset ? 1000 : 1400; }
        return {
            id: id,
            title: title,
            pattern: pattern,
            flags: source.flags === undefined ? 0 : source.flags,
            enabled: source.enabled !== false,
            priority: priority,
            mode: mode === "split" ? "split" : "match",
            keepDelimiter: source.keepDelimiter === true,
            groupMode: String(source.groupMode || "whole").toLowerCase() === "groups" ?
                "groups" : "whole",
            type: String(source.type || "word") === "symbol" ? "symbol" : "word",
            source: preset ? "tokenizer-preset" : "tokenizer-config",
            preset: preset === true
        };
    }

    function builtinPresetRules() {
        var source = [];
        var out = [];
        var index;
        var item;
        if (ClipHub.TokenizerCore &&
                typeof ClipHub.TokenizerCore.getDefaultRules === "function") {
            source = ClipHub.TokenizerCore.getDefaultRules() || [];
        }
        for (index = 0; index < source.length; index += 1) {
            item = copyObject(source[index]);
            item.enabled = true;
            item.source = "tokenizer-preset";
            out.push(normalizeRuleConfig(item, true, "builtin." + index));
        }
        for (index = 0; index < EXTRA_PRESETS.length; index += 1) {
            out.push(normalizeRuleConfig(EXTRA_PRESETS[index], true,
                "tokenizer.preset." + index));
        }
        return out;
    }

    function sanitizeCustomRules(source) {
        var input = source || [];
        var out = [];
        var seen = {};
        var index;
        var item;
        for (index = 0; index < input.length && out.length < MAX_CUSTOM_RULES; index += 1) {
            try {
                item = normalizeRuleConfig(input[index], false,
                    "tokenizer.custom.imported." + index);
                if (item.id.indexOf("tokenizer.custom.") !== 0 || seen[item.id]) {
                    continue;
                }
                seen[item.id] = true;
                out.push(item);
            } catch (ignoredRule) {}
        }
        return out;
    }

    function allRuleConfigs() {
        return builtinPresetRules().concat(copyArray(customRules));
    }

    function ruleById(id) {
        var rules = allRuleConfigs();
        var value = String(id || "");
        var index;
        for (index = 0; index < rules.length; index += 1) {
            if (String(rules[index].id) === value) { return rules[index]; }
        }
        return null;
    }

    function sanitizeSelectedIds(source) {
        var input = source || [];
        var out = [];
        var seen = {};
        var index;
        var id;
        for (index = 0; index < input.length && out.length < MAX_SELECTED_RULES; index += 1) {
            id = String(input[index] || "");
            if (!id || seen[id] || ruleById(id) === null) { continue; }
            seen[id] = true;
            out.push(id);
        }
        return out;
    }

    function persistRuleState() {
        var editor;
        if (preferences === null) { return false; }
        editor = preferences.edit();
        editor.putInt(KEY_SCHEMA_VERSION, RULE_SCHEMA_VERSION);
        editor.putString(KEY_CUSTOM_RULES, JSON.stringify(customRules));
        editor.putString(KEY_SELECTED_RULES, JSON.stringify(selectedRuleIds));
        editor.apply();
        return true;
    }

    function loadRuleState() {
        var storedCustom;
        var storedSelected;
        var hasSelected;
        customRules = [];
        selectedRuleIds = [];
        if (preferences === null) { return false; }
        storedCustom = preferences.getString(KEY_CUSTOM_RULES, "[]");
        customRules = sanitizeCustomRules(parseJsonArray(storedCustom, []));
        hasSelected = preferences.contains(KEY_SELECTED_RULES);
        storedSelected = preferences.getString(KEY_SELECTED_RULES,
            JSON.stringify(DEFAULT_SELECTED_IDS));
        selectedRuleIds = sanitizeSelectedIds(parseJsonArray(storedSelected,
            DEFAULT_SELECTED_IDS));
        if (!hasSelected && selectedRuleIds.length === 0) {
            selectedRuleIds = sanitizeSelectedIds(DEFAULT_SELECTED_IDS);
        }
        persistRuleState();
        return true;
    }

    function newCustomId() {
        customIdCounter += 1;
        return "tokenizer.custom." + String(System.currentTimeMillis()) + "." +
            String(customIdCounter);
    }

    function listRuleConfigs() {
        var rules = allRuleConfigs();
        var selected = {};
        var out = [];
        var index;
        var item;
        for (index = 0; index < selectedRuleIds.length; index += 1) {
            selected[String(selectedRuleIds[index])] = true;
        }
        for (index = 0; index < rules.length; index += 1) {
            item = copyObject(rules[index]);
            item.selected = selected[String(item.id)] === true;
            out.push(item);
        }
        return {
            schemaVersion: RULE_SCHEMA_VERSION,
            storageNamespace: PREFS_NAME,
            selectedRuleIds: copyArray(selectedRuleIds),
            rules: out,
            presetCount: builtinPresetRules().length,
            customCount: customRules.length
        };
    }

    function getSelectedRuleIds() {
        return copyArray(selectedRuleIds);
    }

    function setSelectedRuleIds(ids) {
        selectedRuleIds = sanitizeSelectedIds(ids || []);
        state.ruleSelectionChangeCount += 1;
        persistRuleState();
        return getSelectedRuleIds();
    }

    function toggleRuleSelection(id, selected) {
        var value = String(id || "");
        var current = selectedRuleIds.indexOf(value);
        if (ruleById(value) === null) { return false; }
        if (selected === undefined) { selected = current < 0; }
        if (selected && current < 0 && selectedRuleIds.length < MAX_SELECTED_RULES) {
            selectedRuleIds.push(value);
        } else if (!selected && current >= 0) {
            selectedRuleIds.splice(current, 1);
        }
        state.ruleSelectionChangeCount += 1;
        persistRuleState();
        return selectedRuleIds.indexOf(value) >= 0;
    }

    function upsertRuleConfig(config) {
        var source = config || {};
        var id = trimText(source.id || "");
        var item;
        var index;
        if (id && id.indexOf("tokenizer.custom.") !== 0) {
            throw new Error("预制分词规则不可覆盖");
        }
        if (!id) { id = newCustomId(); }
        source = copyObject(source);
        source.id = id;
        item = normalizeRuleConfig(source, false, id);
        for (index = 0; index < customRules.length; index += 1) {
            if (String(customRules[index].id) === id) {
                customRules[index] = item;
                state.ruleConfigSaveCount += 1;
                persistRuleState();
                return copyObject(item);
            }
        }
        if (customRules.length >= MAX_CUSTOM_RULES) {
            throw new Error("自定义分词规则数量已达上限");
        }
        customRules.push(item);
        state.ruleConfigSaveCount += 1;
        if (selectedRuleIds.indexOf(id) < 0 &&
                selectedRuleIds.length < MAX_SELECTED_RULES) {
            selectedRuleIds.push(id);
        }
        persistRuleState();
        return copyObject(item);
    }

    function deleteRuleConfig(id) {
        var value = String(id || "");
        var index;
        if (value.indexOf("tokenizer.custom.") !== 0) { return false; }
        for (index = 0; index < customRules.length; index += 1) {
            if (String(customRules[index].id) === value) {
                customRules.splice(index, 1);
                index = selectedRuleIds.indexOf(value);
                if (index >= 0) { selectedRuleIds.splice(index, 1); }
                state.ruleConfigDeleteCount += 1;
                persistRuleState();
                return true;
            }
        }
        return false;
    }

    function resetRuleConfigs() {
        customRules = [];
        selectedRuleIds = sanitizeSelectedIds(DEFAULT_SELECTED_IDS);
        persistRuleState();
        return listRuleConfigs();
    }

    function selectedRulesForTokenize() {
        var out = [];
        var index;
        var rule;
        for (index = 0; index < selectedRuleIds.length; index += 1) {
            rule = ruleById(selectedRuleIds[index]);
            if (rule !== null && rule.enabled !== false) {
                out.push(copyObject(rule));
            }
        }
        return out;
    }

    function configuredRules(regexText, regexMode) {
        var rules = selectedRulesForTokenize();
        var temporary = trimText(regexText || "");
        var temporaryMode = String(regexMode || "match") === "split" ?
            "split" : "match";
        if (temporary) {
            rules.push({
                id: "tokenizer.temporary",
                title: "临时规则",
                pattern: temporary,
                flags: 0,
                enabled: true,
                priority: 2000,
                mode: temporaryMode,
                keepDelimiter: temporaryMode === "split",
                groupMode: "whole",
                type: temporaryMode === "split" ? "symbol" : "word",
                source: "tokenizer-temporary"
            });
        }
        return rules;
    }

    function prepareConfiguredOptions(options) {
        var settings = copyOptions(options);
        var mode = String(settings.mode || "normal");
        if (settings.__explicitRules === true) {
            delete settings.__explicitRules;
            return settings;
        }
        if (mode === "regex") {
            settings.includeBuiltins = false;
            if (settings.configuredRulesJson) {
                settings.rules = parseJsonArray(settings.configuredRulesJson, []);
            } else {
                settings.rules = configuredRules(settings.regexText || "",
                    settings.regexMode || "match");
            }
        } else {
            settings.includeBuiltins = true;
            settings.rules = [];
        }
        return settings;
    }

    function prepareAsyncOptions(options) {
        var settings = copyOptions(options);
        if (String(settings.mode || "normal") === "regex" &&
                settings.__explicitRules !== true) {
            settings.configuredRulesJson = JSON.stringify(
                configuredRules(settings.regexText || "",
                    settings.regexMode || "match"));
            settings.selectedRuleIdsJson = JSON.stringify(
                getSelectedRuleIds());
        }
        return settings;
    }

    function tokenizeSync(text, options) {
        var result;
        var settings;
        try {
            if (!ClipHub.TokenizerCore ||
                    typeof ClipHub.TokenizerCore.tokenize !== "function") {
                throw new Error("TokenizerCore is unavailable");
            }
            settings = prepareConfiguredOptions(options || {});
            result = ClipHub.TokenizerCore.tokenize(text, settings);
            result.requestId = options && options.requestId !== undefined ?
                String(options.requestId) : "";
            result.status = result.ok === true ? "ready" : "failed";
            result.selectedRuleIds = String(settings.mode || "normal") === "regex" ?
                (settings.selectedRuleIdsJson ?
                    parseJsonArray(settings.selectedRuleIdsJson, []) :
                    getSelectedRuleIds()) : [];
            state.status = result.status;
            state.completedCount += 1;
            state.lastError = result.ok === true ? null :
                String(result.code || "TOKENIZER_ERROR");
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
        settings.includeBuiltins = settings.includeBuiltins === true;
        settings.__explicitRules = true;
        return tokenizeSync(text, settings);
    }

    function scanRegexRanges(text, rules, options) {
        if (!ClipHub.TokenizerCore ||
                typeof ClipHub.TokenizerCore.scanRegexRanges !== "function") {
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
        var requestOptions = prepareAsyncOptions(options || {});
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
        settings.includeBuiltins = settings.includeBuiltins === true;
        settings.__explicitRules = true;
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
        appContext = context && context.androidContext ?
            context.androidContext : global.context;
        if (appContext === null || appContext === undefined) {
            throw new Error("Android context unavailable for TokenizerService");
        }
        try { appContext = appContext.getApplicationContext() || appContext; }
        catch (ignoredContext) {}
        preferences = appContext.getSharedPreferences(PREFS_NAME,
            Context.MODE_PRIVATE);
        loadRuleState();
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
        preferences = null;
        appContext = null;
        customRules = [];
        selectedRuleIds = [];
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
            ruleSchemaVersion: RULE_SCHEMA_VERSION,
            ruleStorageNamespace: PREFS_NAME,
            tokenizerRulesIsolatedFromFilter: true,
            presetRuleCount: builtinPresetRules().length,
            customRuleCount: customRules.length,
            selectedRuleCount: selectedRuleIds.length,
            ruleConfigSaveCount: Number(state.ruleConfigSaveCount),
            ruleConfigDeleteCount: Number(state.ruleConfigDeleteCount),
            ruleSelectionChangeCount: Number(state.ruleSelectionChangeCount),
            ruleConfigLoadErrorCount: Number(state.ruleConfigLoadErrorCount),
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
            strongReferences: "preferences-only",
            configuredRuleTransport: "json-string",
            tokenizerRulesIsolatedFromFilter: true,
            engine: state.engine
        };
    }

    ClipHub.TokenizerService = {
        MODULE_NAME: "ch_19_tokenizer_service",
        MODULE_VERSION: 3,
        ENGINE_VERSION: 2,
        RULE_SCHEMA_VERSION: RULE_SCHEMA_VERSION,
        RULE_STORAGE_NAMESPACE: PREFS_NAME,
        init: init,
        shutdown: shutdown,
        tokenizeSync: tokenizeSync,
        tokenizeAsync: tokenizeAsync,
        tokenizeWithRulesSync: tokenizeWithRulesSync,
        tokenizeWithRulesAsync: tokenizeWithRulesAsync,
        scanRegexRanges: scanRegexRanges,
        listRuleConfigs: listRuleConfigs,
        getSelectedRuleIds: getSelectedRuleIds,
        setSelectedRuleIds: setSelectedRuleIds,
        toggleRuleSelection: toggleRuleSelection,
        upsertRuleConfig: upsertRuleConfig,
        deleteRuleConfig: deleteRuleConfig,
        resetRuleConfigs: resetRuleConfigs,
        cancel: cancel,
        getState: getState,
        getWorkerProbeSpec: workerProbeSpec
    };
}((function () { return this; }())));
