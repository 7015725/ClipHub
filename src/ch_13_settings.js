(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var values = {};
    var ready = false;
    var lastCleanup = null;
    var DEFAULTS = {
        historyLimit: 0,
        autoCleanupDays: 0,
        closeAfterCopy: false,
        themeMode: "system",
        sourceEnabled: true,
        sensitivePolicy: "skip",
        ignorePackages: []
    };

    function copyArray(input) {
        var output = [];
        var index;
        input = input || [];
        for (index = 0; index < input.length; index += 1) {
            output.push(String(input[index]));
        }
        return output;
    }

    function copyValue(value) {
        if (value && typeof value === "object" &&
                Object.prototype.toString.call(value) === "[object Array]") {
            return copyArray(value);
        }
        return value;
    }

    function defaultsCopy() {
        var output = {};
        var key;
        for (key in DEFAULTS) {
            if (DEFAULTS.hasOwnProperty(key)) {
                output[key] = copyValue(DEFAULTS[key]);
            }
        }
        return output;
    }

    function intRange(value, minimum, maximum, fallback) {
        var number = Number(value);
        if (!isFinite(number)) { return fallback; }
        number = Math.floor(number);
        if (number < minimum) { number = minimum; }
        if (number > maximum) { number = maximum; }
        return number;
    }

    function normalizePackages(input) {
        var output = [];
        var seen = {};
        var index;
        var value;
        input = input || [];
        if (Object.prototype.toString.call(input) !== "[object Array]") {
            throw new Error("ignorePackages must be an array");
        }
        for (index = 0; index < input.length; index += 1) {
            value = String(input[index] === null || input[index] === undefined
                ? "" : input[index]).replace(/^\s+|\s+$/g, "");
            if (value.length > 0 && !seen[value]) {
                seen[value] = true;
                output.push(value);
            }
        }
        return output;
    }

    function normalize(key, value) {
        if (key === "historyLimit") {
            return intRange(value, 0, 100000, DEFAULTS.historyLimit);
        }
        if (key === "autoCleanupDays") {
            return intRange(value, 0, 3650, DEFAULTS.autoCleanupDays);
        }
        if (key === "closeAfterCopy" || key === "sourceEnabled") {
            return value === true;
        }
        if (key === "themeMode") {
            value = String(value);
            return value === "light" || value === "dark" || value === "system"
                ? value : DEFAULTS.themeMode;
        }
        if (key === "sensitivePolicy") {
            value = String(value);
            if (value !== "skip" && value !== "save") {
                throw new Error("Invalid sensitive policy");
            }
            return value;
        }
        if (key === "ignorePackages") {
            return normalizePackages(value);
        }
        throw new Error("Unknown setting: " + key);
    }

    function serialize(value) {
        return JSON.stringify(value);
    }

    function deserialize(key, text) {
        var parsed;
        try { parsed = JSON.parse(String(text)); }
        catch (ignored) { parsed = DEFAULTS[key]; }
        return normalize(key, parsed);
    }

    function requireReady() {
        if (!ready || !ClipHub.Database || !ClipHub.Database.isOpen()) {
            throw new Error("ClipHub settings are not ready");
        }
    }

    function persist(key, value) {
        return ClipHub.Database.executeInsert(
            "INSERT OR REPLACE INTO settings(key, value, updated_at) " +
            "VALUES (?, ?, ?)",
            [key, serialize(value), ClipHub.Base.now()]
        );
    }

    function load() {
        var rows = ClipHub.Database.queryAll(
            "SELECT key, value FROM settings",
            []
        );
        var output = defaultsCopy();
        var index;
        var key;
        for (index = 0; index < rows.length; index += 1) {
            key = String(rows[index].key || "");
            if (DEFAULTS.hasOwnProperty(key)) {
                output[key] = deserialize(key, rows[index].value);
            }
        }
        values = output;
        return getAll();
    }

    function applyClipboard() {
        if (ClipHub.Clipboard && typeof ClipHub.Clipboard.configure === "function") {
            ClipHub.Clipboard.configure({
                sourceEnabled: values.sourceEnabled,
                sensitivePolicy: values.sensitivePolicy,
                ignorePackages: copyArray(values.ignorePackages)
            });
            return true;
        }
        return false;
    }

    function cleanup(referenceAt) {
        requireReady();
        if (!ClipHub.Repository ||
                typeof ClipHub.Repository.cleanupHistory !== "function") {
            throw new Error("Repository cleanup is unavailable");
        }
        lastCleanup = ClipHub.Repository.cleanupHistory({
            historyLimit: values.historyLimit,
            autoCleanupDays: values.autoCleanupDays,
            referenceAt: referenceAt
        });
        lastCleanup.at = ClipHub.Base.now();
        return getLastCleanup();
    }

    function setValue(key, value, options) {
        var normalized;
        var shouldCleanup;
        options = options || {};
        requireReady();
        key = String(key);
        normalized = normalize(key, value);
        persist(key, normalized);
        values[key] = copyValue(normalized);
        if (key === "sourceEnabled" || key === "sensitivePolicy" ||
                key === "ignorePackages") {
            applyClipboard();
        }
        shouldCleanup = key === "historyLimit" || key === "autoCleanupDays";
        if (shouldCleanup && options.cleanup !== false) { cleanup(); }
        return copyValue(values[key]);
    }

    function setMany(patch, options) {
        var normalized = {};
        var key;
        var needsClipboard = false;
        var needsCleanup = false;
        options = options || {};
        requireReady();
        patch = patch || {};
        for (key in patch) {
            if (patch.hasOwnProperty(key)) {
                normalized[key] = normalize(String(key), patch[key]);
            }
        }
        ClipHub.Database.transaction(function () {
            for (key in normalized) {
                if (normalized.hasOwnProperty(key)) {
                    persist(key, normalized[key]);
                }
            }
        });
        for (key in normalized) {
            if (normalized.hasOwnProperty(key)) {
                values[key] = copyValue(normalized[key]);
                if (key === "sourceEnabled" || key === "sensitivePolicy" ||
                        key === "ignorePackages") {
                    needsClipboard = true;
                }
                if (key === "historyLimit" || key === "autoCleanupDays") {
                    needsCleanup = true;
                }
            }
        }
        if (needsClipboard) { applyClipboard(); }
        if (needsCleanup && options.cleanup !== false) { cleanup(); }
        return getAll();
    }

    function getAll() {
        var output = {};
        var key;
        for (key in values) {
            if (values.hasOwnProperty(key)) {
                output[key] = copyValue(values[key]);
            }
        }
        return output;
    }

    function getLastCleanup() {
        var output = {};
        var key;
        if (lastCleanup === null) { return null; }
        for (key in lastCleanup) {
            if (lastCleanup.hasOwnProperty(key)) { output[key] = lastCleanup[key]; }
        }
        return output;
    }

    ClipHub.Settings = {
        MODULE_NAME: "ch_13_settings",
        MODULE_VERSION: 2,
        DEFAULTS: defaultsCopy(),
        init: function () {
            if (!ClipHub.Database || !ClipHub.Database.isOpen()) {
                throw new Error("Database is unavailable for settings");
            }
            load();
            ready = true;
            applyClipboard();
            cleanup();
            return {
                ok: true,
                ready: true,
                values: getAll(),
                cleanup: getLastCleanup()
            };
        },
        isReady: function () { return ready; },
        get: function (key, fallback) {
            key = String(key);
            return Object.prototype.hasOwnProperty.call(values, key)
                ? copyValue(values[key]) : fallback;
        },
        getAll: getAll,
        getLastCleanup: getLastCleanup,
        set: setValue,
        setMany: setMany,
        reload: function () {
            requireReady();
            load();
            applyClipboard();
            return getAll();
        },
        applyClipboard: applyClipboard,
        cleanup: cleanup,
        reset: function (options) {
            var defaults = defaultsCopy();
            requireReady();
            ClipHub.Database.transaction(function () {
                ClipHub.Database.executeUpdateDelete(
                    "DELETE FROM settings",
                    []
                );
                var key;
                for (key in defaults) {
                    if (defaults.hasOwnProperty(key)) {
                        persist(key, defaults[key]);
                    }
                }
            });
            values = defaults;
            applyClipboard();
            if (!options || options.cleanup !== false) { cleanup(); }
            return getAll();
        },
        shutdown: function () {
            values = {};
            lastCleanup = null;
            ready = false;
            return true;
        }
    };
}((function () { return this; }())));
