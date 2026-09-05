(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var File = Packages.java.io.File;
    var FileInputStream = Packages.java.io.FileInputStream;
    var FileOutputStream = Packages.java.io.FileOutputStream;
    var ByteArrayOutputStream = Packages.java.io.ByteArrayOutputStream;
    var JavaString = Packages.java.lang.String;
    var ReflectArray = Packages.java.lang.reflect.Array;
    var JavaByte = Packages.java.lang.Byte;
    var System = Packages.java.lang.System;
    var Executors = Packages.java.util.concurrent.Executors;
    var Handler = Packages.android.os.Handler;
    var Looper = Packages.android.os.Looper;
    var Runnable = Packages.java.lang.Runnable;
    var RhinoContext = null;
    var executor = null;
    var mainHandler = null;
    var ruleStateFile = null;
    var generation = 0;
    var customIdCounter = 0;

    var RULE_STORAGE_NAMESPACE = "cliphub_tokenizer_rules_v1";
    var RULE_FILE_NAME = "tokenizer_rules_v1.json";
    var RULE_SCHEMA_VERSION = 2;
    var MAX_CUSTOM_RULES = 64;
    var MAX_SELECTED_RULES = 64;
    var MAX_TITLE_LENGTH = 80;
    var MAX_PATTERN_LENGTH = 2048;
    var DEFAULT_SELECTED_IDS = [
        "builtin.url",
        "builtin.number_unit",
        "tokenizer.preset.punctuation"
    ];
    var OVERRIDE_FIELDS = [
        "title",
        "pattern",
        "flags",
        "priority",
        "mode",
        "keepDelimiter",
        "groupMode"
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

    var ruleOverrides = [];
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
        skippedStaleTaskCount: 0,
        ruleConfigSaveCount: 0,
        ruleConfigDeleteCount: 0,
        ruleSelectionChangeCount: 0,
        ruleConfigLoadErrorCount: 0,
        ruleMigrationCount: 0,
        engine: "regex-tokenizer-v3"
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
        if (!title) { title = "分词规则"; }
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
            enabled: true,
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

    function defaultRuleConfigs() {
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

    function defaultRuleById(id) {
        var rules = defaultRuleConfigs();
        var value = String(id || "");
        var index;
        for (index = 0; index < rules.length; index += 1) {
            if (String(rules[index].id) === value) { return rules[index]; }
        }
        return null;
    }

    function ruleOverrideById(id) {
        var value = String(id || "");
        var index;
        for (index = 0; index < ruleOverrides.length; index += 1) {
            if (String(ruleOverrides[index].id) === value) {
                return ruleOverrides[index];
            }
        }
        return null;
    }

    function editableValueEqual(left, right) {
        if (typeof left === "number" || typeof right === "number") {
            return Number(left) === Number(right);
        }
        if (typeof left === "boolean" || typeof right === "boolean") {
            return (left === true) === (right === true);
        }
        return String(left === undefined ? "" : left) ===
            String(right === undefined ? "" : right);
    }

    function buildRuleOverride(base, effective) {
        var out = { id: String(base.id) };
        var index;
        var key;
        for (index = 0; index < OVERRIDE_FIELDS.length; index += 1) {
            key = OVERRIDE_FIELDS[index];
            if (!editableValueEqual(base[key], effective[key])) {
                out[key] = effective[key];
            }
        }
        return out;
    }

    function overrideHasChanges(value) {
        var index;
        for (index = 0; index < OVERRIDE_FIELDS.length; index += 1) {
            if (own(value, OVERRIDE_FIELDS[index])) { return true; }
        }
        return false;
    }

    function applyRuleOverride(base, override) {
        var merged = copyObject(base);
        var index;
        var key;
        override = override || {};
        for (index = 0; index < OVERRIDE_FIELDS.length; index += 1) {
            key = OVERRIDE_FIELDS[index];
            if (own(override, key)) { merged[key] = override[key]; }
        }
        merged.id = base.id;
        merged.type = base.type;
        return normalizeRuleConfig(merged, true, base.id);
    }

    function sanitizeRuleOverrides(source) {
        var input = source || [];
        var out = [];
        var seen = {};
        var index;
        var raw;
        var id;
        var base;
        var effective;
        var delta;
        for (index = 0; index < input.length; index += 1) {
            raw = input[index] || {};
            id = trimText(raw.id || "");
            if (!id || seen[id]) { continue; }
            base = defaultRuleById(id);
            if (base === null) { continue; }
            try {
                effective = applyRuleOverride(base, raw);
                delta = buildRuleOverride(base, effective);
                if (overrideHasChanges(delta)) {
                    seen[id] = true;
                    out.push(delta);
                }
            } catch (ignoredOverride) {}
        }
        return out;
    }

    function effectiveDefaultRules() {
        var defaults = defaultRuleConfigs();
        var out = [];
        var index;
        var override;
        for (index = 0; index < defaults.length; index += 1) {
            override = ruleOverrideById(defaults[index].id);
            out.push(override === null ? copyObject(defaults[index]) :
                applyRuleOverride(defaults[index], override));
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
        return effectiveDefaultRules().concat(copyArray(customRules));
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
        var requested = {};
        var rules = allRuleConfigs();
        var out = [];
        var index;
        var id;
        for (index = 0; index < input.length; index += 1) {
            id = String(input[index] || "");
            if (id) { requested[id] = true; }
        }
        for (index = 0; index < rules.length && out.length < MAX_SELECTED_RULES; index += 1) {
            id = String(rules[index].id || "");
            if (requested[id] === true) { out.push(id); }
        }
        return out;
    }

    function closeQuietly(value) {
        if (value !== null && value !== undefined) {
            try { value.close(); } catch (ignoredClose) {}
        }
    }

    function readUtf8File(file) {
        var input = null;
        var output = null;
        var buffer = ReflectArray.newInstance(JavaByte.TYPE, 4096);
        var count;
        try {
            input = new FileInputStream(file);
            output = new ByteArrayOutputStream();
            while ((count = Number(input.read(buffer))) > 0) {
                output.write(buffer, 0, count);
            }
            return String(new JavaString(output.toByteArray(), "UTF-8"));
        } finally {
            closeQuietly(output);
            closeQuietly(input);
        }
    }

    function writeUtf8File(file, value) {
        var output = null;
        try {
            output = new FileOutputStream(file, false);
            output.write(new JavaString(String(value)).getBytes("UTF-8"));
            output.flush();
            try { output.getFD().sync(); } catch (ignoredSync) {}
            return true;
        } finally {
            closeQuietly(output);
        }
    }

    function parseRuleState(text) {
        var value;
        try {
            value = JSON.parse(String(text || "{}"));
            if (!value || Object.prototype.toString.call(value) !== "[object Object]") {
                throw new Error("Rule state JSON value is not an object");
            }
            return value;
        } catch (error) {
            state.ruleConfigLoadErrorCount += 1;
            state.lastError = String(error);
            return {};
        }
    }

    function persistRuleState() {
        var parent;
        var temporary;
        var backup;
        var payload;
        if (ruleStateFile === null) { return false; }
        parent = ruleStateFile.getParentFile();
        if (parent !== null && !parent.isDirectory() &&
                !parent.mkdirs() && !parent.isDirectory()) {
            throw new Error("Cannot create tokenizer rule directory: " +
                String(parent.getAbsolutePath()));
        }
        payload = JSON.stringify({
            schemaVersion: RULE_SCHEMA_VERSION,
            storageNamespace: RULE_STORAGE_NAMESPACE,
            ruleOverrides: ruleOverrides,
            customRules: customRules,
            selectedRuleIds: selectedRuleIds
        }, null, 2) + "\n";
        temporary = new File(parent, RULE_FILE_NAME + ".tmp");
        backup = new File(parent, RULE_FILE_NAME + ".bak");
        writeUtf8File(temporary, payload);
        backup.delete();
        if (ruleStateFile.exists() && !ruleStateFile.renameTo(backup)) {
            try { temporary.delete(); } catch (ignoredTempDelete) {}
            throw new Error("Cannot back up tokenizer rule state file");
        }
        if (!temporary.renameTo(ruleStateFile)) {
            try { temporary.delete(); } catch (ignoredRenameDelete) {}
            if (backup.exists()) {
                try { backup.renameTo(ruleStateFile); } catch (ignoredRestore) {}
            }
            throw new Error("Cannot commit tokenizer rule state file");
        }
        backup.delete();
        return true;
    }

    function backupV1State(rawText) {
        var parent;
        var backup;
        if (ruleStateFile === null || !ruleStateFile.isFile()) { return false; }
        parent = ruleStateFile.getParentFile();
        backup = new File(parent, RULE_FILE_NAME + ".bak.v1");
        if (backup.exists()) { return false; }
        writeUtf8File(backup, rawText);
        return true;
    }

    function removeDisabledV1Selections(rawRules, ids) {
        var blocked = {};
        var out = [];
        var index;
        var id;
        rawRules = rawRules || [];
        ids = ids || [];
        for (index = 0; index < rawRules.length; index += 1) {
            if (rawRules[index] && rawRules[index].enabled === false) {
                id = String(rawRules[index].id || "");
                if (id) { blocked[id] = true; }
            }
        }
        for (index = 0; index < ids.length; index += 1) {
            id = String(ids[index] || "");
            if (id && blocked[id] !== true) { out.push(id); }
        }
        return out;
    }

    function loadRuleState() {
        var stored = {};
        var rawText = "";
        var hasSelected = false;
        var schemaVersion = 1;
        var rawSelected = [];
        ruleOverrides = [];
        customRules = [];
        selectedRuleIds = [];
        if (ruleStateFile === null) { return false; }
        if (ruleStateFile.isFile()) {
            rawText = readUtf8File(ruleStateFile);
            stored = parseRuleState(rawText);
            schemaVersion = Number(stored.schemaVersion || 1);
            hasSelected = own(stored, "selectedRuleIds");
            rawSelected = copyArray(stored.selectedRuleIds || DEFAULT_SELECTED_IDS);
            if (schemaVersion < 2) {
                backupV1State(rawText);
                rawSelected = removeDisabledV1Selections(stored.customRules || [], rawSelected);
                ruleOverrides = [];
                customRules = sanitizeCustomRules(stored.customRules || []);
                state.ruleMigrationCount += 1;
            } else {
                ruleOverrides = sanitizeRuleOverrides(stored.ruleOverrides || []);
                customRules = sanitizeCustomRules(stored.customRules || []);
            }
            selectedRuleIds = sanitizeSelectedIds(rawSelected);
        }
        if (!hasSelected) {
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
            storageNamespace: RULE_STORAGE_NAMESPACE,
            selectedRuleIds: copyArray(selectedRuleIds),
            rules: out,
            presetCount: defaultRuleConfigs().length,
            overrideCount: ruleOverrides.length,
            customCount: customRules.length
        };
    }

    function getSelectedRuleIds() {
        return copyArray(selectedRuleIds);
    }

    function getDefaultSelectedRuleIds() {
        return sanitizeSelectedIds(DEFAULT_SELECTED_IDS);
    }

    function setSelectedRuleIds(ids) {
        selectedRuleIds = sanitizeSelectedIds(ids || []);
        state.ruleSelectionChangeCount += 1;
        persistRuleState();
        return getSelectedRuleIds();
    }

    function toggleRuleSelection(id, selected) {
        var value = String(id || "");
        var requested = copyArray(selectedRuleIds);
        var current = requested.indexOf(value);
        if (ruleById(value) === null) { return false; }
        if (selected === undefined) { selected = current < 0; }
        if (selected && current < 0 && requested.length < MAX_SELECTED_RULES) {
            requested.push(value);
        } else if (!selected && current >= 0) {
            requested.splice(current, 1);
        }
        selectedRuleIds = sanitizeSelectedIds(requested);
        state.ruleSelectionChangeCount += 1;
        persistRuleState();
        return selectedRuleIds.indexOf(value) >= 0;
    }

    function replaceRuleOverride(delta) {
        var id = String(delta.id || "");
        var index;
        for (index = 0; index < ruleOverrides.length; index += 1) {
            if (String(ruleOverrides[index].id) === id) {
                if (overrideHasChanges(delta)) {
                    ruleOverrides[index] = delta;
                } else {
                    ruleOverrides.splice(index, 1);
                }
                return true;
            }
        }
        if (overrideHasChanges(delta)) { ruleOverrides.push(delta); }
        return true;
    }

    function upsertRuleConfig(config) {
        var source = copyObject(config || {});
        var id = trimText(source.id || "");
        var base;
        var merged;
        var effective;
        var delta;
        var item;
        var index;
        if (!id) {
            id = newCustomId();
            source.id = id;
            item = normalizeRuleConfig(source, false, id);
            if (customRules.length >= MAX_CUSTOM_RULES) {
                throw new Error("分词规则数量已达上限");
            }
            customRules.push(item);
            state.ruleConfigSaveCount += 1;
            persistRuleState();
            return copyObject(item);
        }
        base = defaultRuleById(id);
        if (base !== null) {
            merged = copyObject(base);
            for (index = 0; index < OVERRIDE_FIELDS.length; index += 1) {
                if (own(source, OVERRIDE_FIELDS[index])) {
                    merged[OVERRIDE_FIELDS[index]] = source[OVERRIDE_FIELDS[index]];
                }
            }
            effective = normalizeRuleConfig(merged, true, id);
            delta = buildRuleOverride(base, effective);
            replaceRuleOverride(delta);
            state.ruleConfigSaveCount += 1;
            persistRuleState();
            return copyObject(effective);
        }
        if (id.indexOf("tokenizer.custom.") !== 0) {
            throw new Error("未知分词规则 ID");
        }
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
        throw new Error("分词规则不存在");
    }

    function resetRuleOverride(id) {
        var value = String(id || "");
        var base = defaultRuleById(value);
        var index;
        if (base === null) { return null; }
        for (index = 0; index < ruleOverrides.length; index += 1) {
            if (String(ruleOverrides[index].id) === value) {
                ruleOverrides.splice(index, 1);
                state.ruleConfigSaveCount += 1;
                persistRuleState();
                return copyObject(base);
            }
        }
        return copyObject(base);
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
                selectedRuleIds = sanitizeSelectedIds(selectedRuleIds);
                state.ruleConfigDeleteCount += 1;
                persistRuleState();
                return true;
            }
        }
        return false;
    }

    function resetRuleConfigs() {
        ruleOverrides = [];
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
            if (rule !== null) { out.push(copyObject(rule)); }
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
                temporaryPriority: true,
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
        settings.gapMode = mode === "regex" ? "raw" : "fallback";
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
            if (String(settings.mode || "normal") === "regex") {
                if (typeof ClipHub.TokenizerCore.tokenizeRegexExact !== "function") {
                    throw new Error("TokenizerCore exact regex tokenizer unavailable");
                }
                result = ClipHub.TokenizerCore.tokenizeRegexExact(text, settings);
            } else {
                result = ClipHub.TokenizerCore.tokenize(text, settings);
            }
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
                var stillCurrent;
                try {
                    if (requestGeneration !== generation) {
                        state.skippedStaleTaskCount += 1;
                        return;
                    }
                    if (RhinoContext !== null &&
                            typeof RhinoContext.enter === "function") {
                        RhinoContext.enter();
                        entered = true;
                    }
                    result = tokenizeSync(requestText, requestOptions);
                    stillCurrent = requestGeneration === generation;
                    if (!stillCurrent) {
                        state.lateCallbackCount += 1;
                        return;
                    }
                } catch (error) {
                    result = plainError(error);
                } finally {
                    if (entered && RhinoContext !== null &&
                            typeof RhinoContext.exit === "function") {
                        try { RhinoContext.exit(); } catch (ignoredExit) {}
                    }
                }
                if (requestGeneration === generation) {
                    postCallback(callback, result, requestGeneration);
                } else {
                    state.lateCallbackCount += 1;
                }
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
        var dataDir;
        if (!context || !context.runtimeDir) {
            throw new Error("TokenizerService runtimeDir unavailable");
        }
        dataDir = ClipHub.Base.ensureDir(
            ClipHub.Base.joinPath(context.runtimeDir, "data"));
        ruleStateFile = new File(dataDir, RULE_FILE_NAME);
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
        ruleStateFile = null;
        ruleOverrides = [];
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
            skippedStaleTaskCount: Number(state.skippedStaleTaskCount),
            generation: Number(generation),
            engine: String(state.engine),
            ruleSchemaVersion: RULE_SCHEMA_VERSION,
            ruleStorageNamespace: RULE_STORAGE_NAMESPACE,
            ruleStoragePath: ruleStateFile === null ? "" :
                String(ruleStateFile.getAbsolutePath()),
            tokenizerRulesIsolatedFromFilter: true,
            presetRuleCount: defaultRuleConfigs().length,
            overrideRuleCount: ruleOverrides.length,
            customRuleCount: customRules.length,
            selectedRuleCount: selectedRuleIds.length,
            ruleConfigSaveCount: Number(state.ruleConfigSaveCount),
            ruleConfigDeleteCount: Number(state.ruleConfigDeleteCount),
            ruleSelectionChangeCount: Number(state.ruleSelectionChangeCount),
            ruleConfigLoadErrorCount: Number(state.ruleConfigLoadErrorCount),
            ruleMigrationCount: Number(state.ruleMigrationCount),
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
            strongReferences: "file-state-only",
            configuredRuleTransport: "json-string",
            tokenizerRulesIsolatedFromFilter: true,
            engine: state.engine
        };
    }

    ClipHub.TokenizerService = {
        MODULE_NAME: "ch_19_tokenizer_service",
        MODULE_VERSION: 7,
        ENGINE_VERSION: 3,
        RULE_SCHEMA_VERSION: RULE_SCHEMA_VERSION,
        RULE_STORAGE_NAMESPACE: RULE_STORAGE_NAMESPACE,
        init: init,
        shutdown: shutdown,
        tokenizeSync: tokenizeSync,
        tokenizeAsync: tokenizeAsync,
        tokenizeWithRulesSync: tokenizeWithRulesSync,
        tokenizeWithRulesAsync: tokenizeWithRulesAsync,
        scanRegexRanges: scanRegexRanges,
        listRuleConfigs: listRuleConfigs,
        getSelectedRuleIds: getSelectedRuleIds,
        getDefaultSelectedRuleIds: getDefaultSelectedRuleIds,
        setSelectedRuleIds: setSelectedRuleIds,
        toggleRuleSelection: toggleRuleSelection,
        upsertRuleConfig: upsertRuleConfig,
        resetRuleOverride: resetRuleOverride,
        deleteRuleConfig: deleteRuleConfig,
        resetRuleConfigs: resetRuleConfigs,
        cancel: cancel,
        getState: getState,
        getWorkerProbeSpec: workerProbeSpec
    };
}((function () { return this; }())));
