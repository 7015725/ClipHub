(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var Thread = Packages.java.lang.Thread;
    var value = null;
    var ready = false;
    var eventListeners = [];
    var state = {
        applyCount: 0,
        eventApplyCount: 0,
        lastResultCount: 0,
        lastApplyThreadId: null,
        lastApplyThreadName: null,
        lastError: null
    };

    function normalizeText(value) {
        return String(value === null || value === undefined ? "" : value)
            .replace(/^\s+|\s+$/g, "");
    }

    function normalizeList(input) {
        var source = input instanceof Array ? input : [];
        var seen = {};
        var output = [];
        var index;
        var text;
        for (index = 0; index < source.length; index += 1) {
            text = normalizeText(source[index]);
            if (text.length > 0 && !seen[text]) {
                seen[text] = true;
                output.push(text);
            }
        }
        return output;
    }

    function copyList(input) {
        var output = [];
        var index;
        input = input || [];
        for (index = 0; index < input.length; index += 1) {
            output.push(input[index]);
        }
        return output;
    }

    function emptyValue() {
        return {
            keyword: "",
            sourcePackages: [],
            contentTypes: [],
            tagIds: [],
            pinnedOnly: false,
            sensitiveMode: "all"
        };
    }

    function copyValue(input) {
        input = input || emptyValue();
        return {
            keyword: String(input.keyword || ""),
            sourcePackages: copyList(input.sourcePackages),
            contentTypes: copyList(input.contentTypes),
            tagIds: copyList(input.tagIds),
            pinnedOnly: input.pinnedOnly === true,
            sensitiveMode: String(input.sensitiveMode || "all")
        };
    }

    function isActive(input) {
        input = input || value || emptyValue();
        return normalizeText(input.keyword).length > 0 ||
            input.sourcePackages.length > 0 ||
            input.contentTypes.length > 0 ||
            input.pinnedOnly === true ||
            String(input.sensitiveMode || "all") !== "all";
    }

    function validateSensitiveMode(mode) {
        mode = String(mode || "all");
        if (mode !== "all" && mode !== "only" && mode !== "exclude") {
            throw new Error("Invalid sensitive filter mode");
        }
        return mode;
    }

    function toQueryOptions(extra) {
        var options = {};
        var key;
        extra = extra || {};
        for (key in extra) {
            if (extra.hasOwnProperty(key)) { options[key] = extra[key]; }
        }
        options.keyword = value.keyword;
        options.sourcePackages = copyList(value.sourcePackages);
        options.contentTypes = copyList(value.contentTypes);
        options.pinnedOnly = value.pinnedOnly;
        if (value.sensitiveMode === "only") { options.sensitiveOnly = true; }
        if (value.sensitiveMode === "exclude") { options.excludeSensitive = true; }
        return options;
    }

    function emitChanged(rows, origin) {
        var thread = Thread.currentThread();
        var payload = {
            active: isActive(value),
            criteria: copyValue(value),
            resultCount: rows.length,
            origin: String(origin || "manual"),
            threadId: Number(thread.getId()),
            threadName: String(thread.getName())
        };
        try {
            if (ClipHub.EventBus && typeof ClipHub.EventBus.emit === "function") {
                ClipHub.EventBus.emit("filter_changed", payload);
            }
        } catch (ignored) {}
    }

    function apply(options) {
        var queryOptions;
        var rows;
        var thread;
        options = options || {};
        if (!ready || value === null) {
            throw new Error("ClipHub filter is not ready");
        }
        queryOptions = toQueryOptions({
            limit: options.limit === undefined ? 100 : options.limit,
            offset: options.offset === undefined ? 0 : options.offset
        });
        try {
            rows = ClipHub.Repository.listItems(queryOptions);
            if (ClipHub.List && typeof ClipHub.List.setItems === "function") {
                ClipHub.List.setItems(rows);
            }
            state.applyCount += 1;
            if (options.fromEvent === true) { state.eventApplyCount += 1; }
            state.lastResultCount = rows.length;
            thread = Thread.currentThread();
            state.lastApplyThreadId = Number(thread.getId());
            state.lastApplyThreadName = String(thread.getName());
            state.lastError = null;
            emitChanged(rows, options.origin || (options.fromEvent ? "event" : "manual"));
            return rows;
        } catch (error) {
            state.lastError = String(error);
            throw error;
        }
    }

    function applyIfRequested(options) {
        options = options || {};
        if (options.apply === false || !ready) { return copyValue(value); }
        apply({
            limit: options.limit,
            offset: options.offset,
            origin: options.origin || "criteria",
            fromEvent: options.fromEvent === true
        });
        return copyValue(value);
    }

    function setValue(patch, options) {
        patch = patch || {};
        if (patch.hasOwnProperty("keyword")) {
            value.keyword = normalizeText(patch.keyword);
        }
        if (patch.hasOwnProperty("sourcePackages")) {
            value.sourcePackages = normalizeList(patch.sourcePackages);
        }
        if (patch.hasOwnProperty("contentTypes")) {
            value.contentTypes = normalizeList(patch.contentTypes);
        }
        if (patch.hasOwnProperty("pinnedOnly")) {
            value.pinnedOnly = patch.pinnedOnly === true;
        }
        if (patch.hasOwnProperty("sensitiveMode")) {
            value.sensitiveMode = validateSensitiveMode(patch.sensitiveMode);
        }
        return applyIfRequested(options);
    }

    function reset(options) {
        value = emptyValue();
        return applyIfRequested(options);
    }

    function onClipboardChange() {
        if (!ready || !isActive(value)) { return; }
        try {
            apply({ fromEvent: true, origin: "clipboard_event" });
        } catch (error) {
            state.lastError = String(error);
        }
    }

    function registerEvent(name) {
        var listener = onClipboardChange;
        if (ClipHub.EventBus && typeof ClipHub.EventBus.on === "function") {
            ClipHub.EventBus.on(name, listener);
            eventListeners.push({ name: name, listener: listener });
        }
    }

    function unregisterEvents() {
        var index;
        if (ClipHub.EventBus && typeof ClipHub.EventBus.off === "function") {
            for (index = 0; index < eventListeners.length; index += 1) {
                ClipHub.EventBus.off(
                    eventListeners[index].name,
                    eventListeners[index].listener
                );
            }
        }
        eventListeners = [];
    }

    function resetState() {
        state.applyCount = 0;
        state.eventApplyCount = 0;
        state.lastResultCount = 0;
        state.lastApplyThreadId = null;
        state.lastApplyThreadName = null;
        state.lastError = null;
    }

    ClipHub.Filter = {
        MODULE_NAME: "ch_11_filter",
        MODULE_VERSION: 2,
        init: function () {
            value = emptyValue();
            ready = true;
            eventListeners = [];
            resetState();
            registerEvent("clipboard_added");
            registerEvent("clipboard_merged");
            registerEvent("clipboard_deleted");
            registerEvent("clipboard_restored");
            return true;
        },
        isReady: function () { return ready; },
        isActive: function () { return isActive(value); },
        get: function () { return copyValue(value); },
        getState: function () {
            return {
                ready: ready,
                active: isActive(value),
                criteria: copyValue(value),
                applyCount: Number(state.applyCount),
                eventApplyCount: Number(state.eventApplyCount),
                lastResultCount: Number(state.lastResultCount),
                lastApplyThreadId: state.lastApplyThreadId,
                lastApplyThreadName: state.lastApplyThreadName,
                lastError: state.lastError
            };
        },
        toQueryOptions: toQueryOptions,
        query: function (options) {
            return ClipHub.Repository.listItems(toQueryOptions(options || {}));
        },
        apply: apply,
        set: setValue,
        reset: reset,
        setKeyword: function (keyword, options) {
            return setValue({ keyword: keyword }, options);
        },
        setSourcePackages: function (packages, options) {
            return setValue({ sourcePackages: packages }, options);
        },
        setContentTypes: function (types, options) {
            return setValue({ contentTypes: types }, options);
        },
        setPinnedOnly: function (enabled, options) {
            return setValue({ pinnedOnly: enabled }, options);
        },
        setSensitiveMode: function (mode, options) {
            return setValue({ sensitiveMode: mode }, options);
        },
        getSourceOptions: function () {
            return ClipHub.Repository.listSourceOptions();
        },
        getContentTypeOptions: function () {
            return ClipHub.Repository.listContentTypeOptions();
        },
        shutdown: function () {
            unregisterEvents();
            value = null;
            ready = false;
            return true;
        }
    };
}((function () { return this; }())));
