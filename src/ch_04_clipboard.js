(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var AndroidContext = Packages.android.content.Context;
    var AndroidClipData = Packages.android.content.ClipData;
    var ClipboardManager = Packages.android.content.ClipboardManager;
    var Build = Packages.android.os.Build;
    var Thread = Packages.java.lang.Thread;
    var SENSITIVE_KEY = "android.content.extra.IS_SENSITIVE";
    var manager = null;
    var vibrator = null;
    var listener = null;
    var androidContext = null;
    var packageManager = null;
    var running = false;
    var sourceCache = {};
    var config = {
        callbackDedupMs: 750,
        mergeWindowMs: 2000,
        ownWriteWindowMs: 3000,
        maxChars: 100000,
        maxItems: 10,
        sourceEnabled: true,
        sensitivePolicy: "skip",
        ignorePackages: []
    };
    var state = {
        eventSeq: 0,
        handledCount: 0,
        insertedCount: 0,
        mergedCount: 0,
        ignoredCount: 0,
        errorCount: 0,
        sourceReadCount: 0,
        sourceErrorCount: 0,
        sensitiveIgnoredCount: 0,
        ignoredPackageCount: 0,
        copyHapticCount: 0,
        copyHapticFailureCount: 0,
        lastCopyHapticAt: 0,
        lastCopyHapticLabel: null,
        lastCopyHapticThreadId: null,
        lastCopyHapticThreadName: null,
        lastEvent: null,
        lastObserved: { hash: "", at: 0 },
        ownWrite: { hash: "", at: 0, expiresAt: 0, consumed: false },
        callbackThreadId: null,
        callbackThreadName: null
    };

    function now() { return ClipHub.Base.now(); }

    function resolveVibrator() {
        var managerService;
        if (androidContext === null || androidContext === undefined) {
            return null;
        }
        if (Build.VERSION.SDK_INT >= 31) {
            try {
                managerService = androidContext.getSystemService(
                    AndroidContext.VIBRATOR_MANAGER_SERVICE);
                if (managerService !== null && managerService !== undefined &&
                        typeof managerService.getDefaultVibrator === "function") {
                    return managerService.getDefaultVibrator();
                }
            } catch (ignoredManager) {}
        }
        try {
            return androidContext.getSystemService(
                AndroidContext.VIBRATOR_SERVICE);
        } catch (ignoredVibrator) {
            return null;
        }
    }

    function performCopySuccessHaptic(options) {
        var durationMs;
        var amplitude;
        var effect;
        var thread;
        options = options || {};
        if (options.haptic === false) { return false; }
        if (vibrator === null || vibrator === undefined) {
            vibrator = resolveVibrator();
        }
        if (vibrator === null || vibrator === undefined) { return false; }
        try {
            if (typeof vibrator.hasVibrator === "function" &&
                    !vibrator.hasVibrator()) {
                return false;
            }
            durationMs = Math.max(8, Math.min(40,
                Math.floor(Number(options.hapticDurationMs || 18))));
            amplitude = Math.max(1, Math.min(255,
                Math.floor(Number(options.hapticAmplitude || 60))));
            if (Build.VERSION.SDK_INT >= 26) {
                effect = Packages.android.os.VibrationEffect.createOneShot(
                    durationMs, amplitude);
                vibrator.vibrate(effect);
            } else {
                vibrator.vibrate(durationMs);
            }
            thread = Thread.currentThread();
            state.copyHapticCount += 1;
            state.lastCopyHapticAt = now();
            state.lastCopyHapticLabel = String(
                options.hapticLabel || options.label || "ClipHub");
            state.lastCopyHapticThreadId = Number(thread.getId());
            state.lastCopyHapticThreadName = String(thread.getName());
            return true;
        } catch (error) {
            state.copyHapticFailureCount += 1;
            return false;
        }
    }

    function log(level, message) {
        try {
            if (ClipHub.Log && typeof ClipHub.Log[level] === "function") {
                ClipHub.Log[level](message);
            }
        } catch (ignored) {}
    }

    function copyOwnWrite() {
        return {
            hash: state.ownWrite.hash,
            at: state.ownWrite.at,
            expiresAt: state.ownWrite.expiresAt,
            consumed: state.ownWrite.consumed
        };
    }

    function copyArray(values) {
        var result = [];
        var index;
        values = values || [];
        for (index = 0; index < values.length; index += 1) {
            result.push(String(values[index]));
        }
        return result;
    }

    function normalizePackageList(values) {
        var result = [];
        var seen = {};
        var index;
        var value;
        values = values || [];
        for (index = 0; index < values.length; index += 1) {
            value = String(values[index] === null || values[index] === undefined
                ? "" : values[index]).replace(/^\s+|\s+$/g, "");
            if (value.length > 0 && !seen[value]) {
                seen[value] = true;
                result.push(value);
            }
        }
        return result;
    }

    function isIgnoredPackage(packageName) {
        var index;
        var value = String(packageName || "");
        if (value.length === 0) { return false; }
        for (index = 0; index < config.ignorePackages.length; index += 1) {
            if (String(config.ignorePackages[index]) === value) { return true; }
        }
        return false;
    }

    function setLastEvent(event) {
        state.lastEvent = event;
        return event;
    }

    function readSensitive(description) {
        var extras;
        if (description === null || description === undefined) { return false; }
        try {
            extras = description.getExtras();
            return extras !== null && extras.getBoolean(SENSITIVE_KEY, false);
        } catch (ignored) {
            return false;
        }
    }

    function resolveSourcePackage(packageName) {
        var key = String(packageName || "");
        var cached;
        var info;
        var result;
        if (key.length === 0) {
            return {
                sourcePackage: null,
                sourceLabel: null,
                sourceUid: null,
                sourceConfidence: 0,
                sourceAvailable: true,
                sourceError: null
            };
        }
        cached = sourceCache[key];
        if (cached) {
            return {
                sourcePackage: cached.sourcePackage,
                sourceLabel: cached.sourceLabel,
                sourceUid: cached.sourceUid,
                sourceConfidence: cached.sourceConfidence,
                sourceAvailable: true,
                sourceError: null
            };
        }
        result = {
            sourcePackage: key,
            sourceLabel: null,
            sourceUid: null,
            sourceConfidence: 80
        };
        try {
            if (packageManager !== null) {
                info = packageManager.getApplicationInfo(key, 0);
                if (info !== null) {
                    result.sourceUid = Number(info.uid);
                    result.sourceLabel = String(info.loadLabel(packageManager));
                    result.sourceConfidence = 100;
                }
            }
        } catch (ignored) {}
        sourceCache[key] = result;
        return {
            sourcePackage: result.sourcePackage,
            sourceLabel: result.sourceLabel,
            sourceUid: result.sourceUid,
            sourceConfidence: result.sourceConfidence,
            sourceAvailable: true,
            sourceError: null
        };
    }

    function readSource() {
        var packageName;
        if (!config.sourceEnabled || manager === null) {
            return {
                sourcePackage: null,
                sourceLabel: null,
                sourceUid: null,
                sourceConfidence: 0,
                sourceAvailable: false,
                sourceError: null
            };
        }
        try {
            if (typeof manager.getPrimaryClipSource !== "function") {
                return {
                    sourcePackage: null,
                    sourceLabel: null,
                    sourceUid: null,
                    sourceConfidence: 0,
                    sourceAvailable: false,
                    sourceError: null
                };
            }
            packageName = manager.getPrimaryClipSource();
            state.sourceReadCount += 1;
            if (packageName === null) {
                return {
                    sourcePackage: null,
                    sourceLabel: null,
                    sourceUid: null,
                    sourceConfidence: 0,
                    sourceAvailable: true,
                    sourceError: null
                };
            }
            return resolveSourcePackage(String(packageName));
        } catch (error) {
            state.sourceErrorCount += 1;
            return {
                sourcePackage: null,
                sourceLabel: null,
                sourceUid: null,
                sourceConfidence: 0,
                sourceAvailable: true,
                sourceError: String(error)
            };
        }
    }

    function readPrimaryText() {
        var clip;
        var description;
        var itemCount;
        var limit;
        var index;
        var item;
        var value;
        var parts = [];
        var text;
        var source;
        var sensitive;
        if (manager === null) {
            return { ok: false, reason: "manager_unavailable", text: "" };
        }
        clip = manager.getPrimaryClip();
        if (clip === null) {
            return { ok: false, reason: "no_primary_clip", text: "" };
        }
        description = clip.getDescription();
        sensitive = readSensitive(description);
        source = readSource();
        if (sensitive && config.sensitivePolicy === "skip") {
            return {
                ok: false,
                reason: "sensitive_clip",
                text: "",
                sensitive: true,
                sourcePackage: source.sourcePackage,
                sourceLabel: source.sourceLabel,
                sourceUid: source.sourceUid,
                sourceConfidence: source.sourceConfidence
            };
        }
        if (isIgnoredPackage(source.sourcePackage)) {
            return {
                ok: false,
                reason: "ignored_source_package",
                text: "",
                sensitive: sensitive,
                sourcePackage: source.sourcePackage,
                sourceLabel: source.sourceLabel,
                sourceUid: source.sourceUid,
                sourceConfidence: source.sourceConfidence
            };
        }
        itemCount = Number(clip.getItemCount());
        if (itemCount < 1) {
            return { ok: false, reason: "empty_clip", text: "" };
        }
        limit = itemCount > config.maxItems ? config.maxItems : itemCount;
        for (index = 0; index < limit; index += 1) {
            item = clip.getItemAt(index);
            value = item === null ? null : item.getText();
            if (value === null && description !== null &&
                    (description.hasMimeType("text/plain") ||
                    description.hasMimeType("text/html"))) {
                try { value = item.coerceToText(androidContext); }
                catch (ignored) { value = null; }
            }
            if (value !== null) { parts.push(String(value)); }
        }
        if (parts.length === 0) {
            return {
                ok: false,
                reason: "non_text_clip",
                text: "",
                itemCount: itemCount,
                sensitive: sensitive,
                sourcePackage: source.sourcePackage
            };
        }
        text = parts.join("\n");
        if (text.length === 0 ||
                ClipHub.Repository.normalizeContent(text).length === 0) {
            return {
                ok: false,
                reason: "blank_text",
                text: "",
                itemCount: itemCount,
                sensitive: sensitive,
                sourcePackage: source.sourcePackage
            };
        }
        if (text.length > config.maxChars) {
            return {
                ok: false,
                reason: "text_too_large",
                text: "",
                contentLength: text.length,
                itemCount: itemCount,
                sensitive: sensitive,
                sourcePackage: source.sourcePackage
            };
        }
        return {
            ok: true,
            reason: null,
            text: text,
            contentLength: text.length,
            itemCount: itemCount,
            sensitive: sensitive,
            sourcePackage: source.sourcePackage,
            sourceLabel: source.sourceLabel,
            sourceUid: source.sourceUid,
            sourceConfidence: source.sourceConfidence,
            sourceAvailable: source.sourceAvailable,
            sourceError: source.sourceError
        };
    }

    function emit(name, payload) {
        try {
            if (ClipHub.EventBus && typeof ClipHub.EventBus.emit === "function") {
                ClipHub.EventBus.emit(name, payload);
            }
        } catch (ignored) {}
    }

    function sourcePatch(metadata) {
        var patch = {};
        if (metadata && metadata.sourcePackage) {
            patch.source_package = String(metadata.sourcePackage);
            patch.source_label = metadata.sourceLabel === null ||
                metadata.sourceLabel === undefined ? null :
                String(metadata.sourceLabel);
            patch.source_uid = metadata.sourceUid === null ||
                metadata.sourceUid === undefined ? null :
                Number(metadata.sourceUid);
            patch.source_confidence = Number(metadata.sourceConfidence || 0);
        }
        return patch;
    }

    function recordText(text, hash, contentType, eventAt, metadata) {
        var latest = ClipHub.Repository.listItems({limit: 1, offset: 0});
        var row = latest && latest.length > 0 ? latest[0] : null;
        var copiedAt;
        var copyCount;
        var id;
        var patch;
        var insert;
        var sourceValues;
        var key;
        if (row !== null && String(row.normalized_hash) === hash) {
            copiedAt = Number(row.last_copied_at || 0);
            if (eventAt - copiedAt <= config.mergeWindowMs) {
                copyCount = Number(row.copy_count || 1) + 1;
                patch = {
                    content: text,
                    content_type: contentType,
                    is_sensitive: metadata.sensitive === true ? 1 : 0,
                    copy_count: copyCount,
                    last_copied_at: eventAt,
                    deleted_at: null
                };
                sourceValues = sourcePatch(metadata);
                for (key in sourceValues) {
                    if (sourceValues.hasOwnProperty(key)) {
                        patch[key] = sourceValues[key];
                    }
                }
                ClipHub.Repository.updateItem(Number(row.id), patch);
                return {
                    id: Number(row.id),
                    inserted: false,
                    merged: true,
                    copyCount: copyCount,
                    hash: hash
                };
            }
        }
        insert = {
            content: text,
            contentType: contentType,
            normalizedHash: hash,
            lastCopiedAt: eventAt,
            createdAt: eventAt,
            updatedAt: eventAt,
            sourcePackage: metadata.sourcePackage,
            sourceLabel: metadata.sourceLabel,
            sourceUid: metadata.sourceUid,
            sourceConfidence: metadata.sourceConfidence,
            isSensitive: metadata.sensitive === true
        };
        id = ClipHub.Repository.insertItem(insert);
        return {
            id: Number(id),
            inserted: true,
            merged: false,
            copyCount: 1,
            hash: hash
        };
    }

    function ignoredEvent(read, origin, eventAt) {
        var event;
        state.ignoredCount += 1;
        if (read.reason === "sensitive_clip") {
            state.sensitiveIgnoredCount += 1;
        }
        if (read.reason === "ignored_source_package") {
            state.ignoredPackageCount += 1;
        }
        event = {
            seq: state.eventSeq,
            at: eventAt,
            origin: String(origin || "listener"),
            status: "ignored",
            reason: read.reason,
            contentLength: Number(read.contentLength || 0),
            sensitive: read.sensitive === true,
            sourcePackage: read.sourcePackage || null,
            threadId: state.callbackThreadId,
            threadName: state.callbackThreadName
        };
        emit("clipboard_ignored", event);
        return setLastEvent(event);
    }

    function handlePrimaryClipChanged(origin) {
        var eventAt = now();
        var thread = Thread.currentThread();
        var read;
        var hash;
        var result;
        var classified;
        var event;
        state.eventSeq += 1;
        state.callbackThreadId = Number(thread.getId());
        state.callbackThreadName = String(thread.getName());
        try {
            read = readPrimaryText();
            if (!read.ok) {
                return ignoredEvent(read, origin, eventAt);
            }
            hash = ClipHub.Repository.hashContent(read.text);
            if (state.ownWrite.hash === hash &&
                    eventAt <= state.ownWrite.expiresAt) {
                state.ownWrite.consumed = true;
                state.lastObserved.hash = hash;
                state.lastObserved.at = eventAt;
                state.ignoredCount += 1;
                event = {
                    seq: state.eventSeq,
                    at: eventAt,
                    origin: String(origin || "listener"),
                    status: "own_write_suppressed",
                    hashPrefix: hash.substring(0, 12),
                    contentLength: read.contentLength,
                    sourcePackage: read.sourcePackage || null,
                    threadId: state.callbackThreadId,
                    threadName: state.callbackThreadName
                };
                emit("clipboard_ignored", event);
                return setLastEvent(event);
            }
            if (state.lastObserved.hash === hash &&
                    eventAt - state.lastObserved.at <= config.callbackDedupMs) {
                state.lastObserved.at = eventAt;
                state.ignoredCount += 1;
                event = {
                    seq: state.eventSeq,
                    at: eventAt,
                    origin: String(origin || "listener"),
                    status: "duplicate_callback",
                    hashPrefix: hash.substring(0, 12),
                    contentLength: read.contentLength,
                    sourcePackage: read.sourcePackage || null,
                    threadId: state.callbackThreadId,
                    threadName: state.callbackThreadName
                };
                emit("clipboard_ignored", event);
                return setLastEvent(event);
            }
            state.lastObserved.hash = hash;
            state.lastObserved.at = eventAt;
            classified = { type: "text", confidence: 100 };
            result = recordText(
                read.text,
                hash,
                "text",
                eventAt,
                read
            );
            state.handledCount += 1;
            if (result.inserted) { state.insertedCount += 1; }
            if (result.merged) { state.mergedCount += 1; }
            event = {
                seq: state.eventSeq,
                at: eventAt,
                origin: String(origin || "listener"),
                status: result.inserted ? "inserted" : "merged",
                id: Number(result.id),
                copyCount: Number(result.copyCount || 1),
                hashPrefix: hash.substring(0, 12),
                contentLength: read.contentLength,
                contentType: classified && classified.type
                    ? String(classified.type) : "text",
                sensitive: read.sensitive === true,
                sourcePackage: read.sourcePackage || null,
                sourceLabel: read.sourceLabel || null,
                sourceUid: read.sourceUid === undefined ? null : read.sourceUid,
                sourceConfidence: Number(read.sourceConfidence || 0),
                threadId: state.callbackThreadId,
                threadName: state.callbackThreadName
            };
            log("info", "clipboard " + event.status + " seq=" +
                event.seq + " id=" + event.id + " len=" +
                event.contentLength + " hash=" + event.hashPrefix +
                " source=" + String(event.sourcePackage || "unknown"));
            emit(result.inserted ? "clipboard_added" : "clipboard_merged", event);
            return setLastEvent(event);
        } catch (error) {
            state.errorCount += 1;
            event = {
                seq: state.eventSeq,
                at: eventAt,
                origin: String(origin || "listener"),
                status: "error",
                error: String(error),
                threadId: state.callbackThreadId,
                threadName: state.callbackThreadName
            };
            log("error", "clipboard event failed seq=" + event.seq +
                " error=" + event.error);
            emit("clipboard_error", event);
            return setLastEvent(event);
        }
    }

    function markOwnWrite(hash, at, windowMs) {
        var startedAt = Number(at || now());
        var duration = Number(windowMs || config.ownWriteWindowMs);
        state.ownWrite.hash = String(hash || "");
        state.ownWrite.at = startedAt;
        state.ownWrite.expiresAt = startedAt + duration;
        state.ownWrite.consumed = false;
        return copyOwnWrite();
    }

    function writeText(value, options) {
        var text = String(value === null || value === undefined ? "" : value);
        var hash;
        var clip;
        var at;
        var PersistableBundle;
        var extras;
        var hapticPerformed = false;
        options = options || {};
        if (manager === null) { throw new Error("ClipboardManager unavailable"); }
        if (text.length === 0) { throw new Error("Clipboard text must not be empty"); }
        if (text.length > config.maxChars) {
            throw new Error("Clipboard text exceeds limit");
        }
        hash = ClipHub.Repository.hashContent(text);
        at = now();
        markOwnWrite(hash, at, options.suppressWindowMs);
        try {
            clip = AndroidClipData.newPlainText(
                options.label === undefined ? "ClipHub" : String(options.label),
                text
            );
            if (options.sensitive === true) {
                PersistableBundle = Packages.android.os.PersistableBundle;
                extras = new PersistableBundle();
                extras.putBoolean(SENSITIVE_KEY, true);
                clip.getDescription().setExtras(extras);
            }
            manager.setPrimaryClip(clip);
            hapticPerformed = performCopySuccessHaptic(options);
            return {
                ok: true,
                written: true,
                hash: hash,
                at: at,
                contentLength: text.length,
                sensitive: options.sensitive === true,
                hapticPerformed: hapticPerformed
            };
        } catch (error) {
            state.ownWrite.hash = "";
            state.ownWrite.at = 0;
            state.ownWrite.expiresAt = 0;
            state.ownWrite.consumed = false;
            throw error;
        }
    }

    function start() {
        if (running) { return { ok: true, running: true, reused: true }; }
        if (manager === null) { throw new Error("ClipboardManager unavailable"); }
        listener = new JavaAdapter(
            ClipboardManager.OnPrimaryClipChangedListener,
            { onPrimaryClipChanged: function () {
                handlePrimaryClipChanged("listener");
            } }
        );
        manager.addPrimaryClipChangedListener(listener);
        running = true;
        return { ok: true, running: true, reused: false };
    }

    function stop() {
        if (manager !== null && listener !== null) {
            try { manager.removePrimaryClipChangedListener(listener); }
            catch (ignored) {}
        }
        listener = null;
        running = false;
        return { ok: true, running: false };
    }

    function configure(patch) {
        var key;
        var numberKeys = {
            callbackDedupMs: true,
            mergeWindowMs: true,
            ownWriteWindowMs: true,
            maxChars: true,
            maxItems: true
        };
        patch = patch || {};
        for (key in patch) {
            if (!patch.hasOwnProperty(key)) { continue; }
            if (numberKeys[key]) {
                config[key] = Math.max(0, Math.floor(Number(patch[key])));
            } else if (key === "sourceEnabled") {
                config.sourceEnabled = patch[key] !== false;
            } else if (key === "sensitivePolicy") {
                if (String(patch[key]) !== "skip" && String(patch[key]) !== "save") {
                    throw new Error("Invalid sensitive policy");
                }
                config.sensitivePolicy = String(patch[key]);
            } else if (key === "ignorePackages") {
                config.ignorePackages = normalizePackageList(patch[key]);
            }
        }
        return getState().config;
    }

    function getState() {
        return {
            running: running,
            eventSeq: state.eventSeq,
            handledCount: state.handledCount,
            insertedCount: state.insertedCount,
            mergedCount: state.mergedCount,
            ignoredCount: state.ignoredCount,
            errorCount: state.errorCount,
            sourceReadCount: state.sourceReadCount,
            sourceErrorCount: state.sourceErrorCount,
            sensitiveIgnoredCount: state.sensitiveIgnoredCount,
            ignoredPackageCount: state.ignoredPackageCount,
            copyHapticCount: state.copyHapticCount,
            copyHapticFailureCount: state.copyHapticFailureCount,
            lastCopyHapticAt: state.lastCopyHapticAt,
            lastCopyHapticLabel: state.lastCopyHapticLabel,
            lastCopyHapticThreadId: state.lastCopyHapticThreadId,
            lastCopyHapticThreadName: state.lastCopyHapticThreadName,
            lastEvent: state.lastEvent,
            lastObserved: {
                hash: state.lastObserved.hash,
                at: state.lastObserved.at
            },
            ownWrite: copyOwnWrite(),
            callbackThreadId: state.callbackThreadId,
            callbackThreadName: state.callbackThreadName,
            config: {
                callbackDedupMs: config.callbackDedupMs,
                mergeWindowMs: config.mergeWindowMs,
                ownWriteWindowMs: config.ownWriteWindowMs,
                maxChars: config.maxChars,
                maxItems: config.maxItems,
                sourceEnabled: config.sourceEnabled,
                sensitivePolicy: config.sensitivePolicy,
                ignorePackages: copyArray(config.ignorePackages)
            }
        };
    }

    ClipHub.Clipboard = {
        MODULE_NAME: "ch_04_clipboard",
        MODULE_VERSION: 4,
        SENSITIVE_KEY: SENSITIVE_KEY,
        init: function (context) {
            androidContext = context && context.androidContext
                ? context.androidContext : global.context;
            if (androidContext === null || androidContext === undefined) {
                throw new Error("Android context unavailable");
            }
            packageManager = androidContext.getPackageManager();
            manager = androidContext.getSystemService(AndroidContext.CLIPBOARD_SERVICE);
            if (manager === null) { throw new Error("ClipboardManager unavailable"); }
            vibrator = resolveVibrator();
            return start();
        },
        start: start,
        stop: stop,
        readPrimaryText: readPrimaryText,
        readSource: readSource,
        processCurrentClip: function () {
            return handlePrimaryClipChanged("manual");
        },
        writeText: writeText,
        markOwnWrite: markOwnWrite,
        configure: configure,
        getState: getState,
        shutdown: function () {
            stop();
            manager = null;
            vibrator = null;
            androidContext = null;
            packageManager = null;
            sourceCache = {};
            return true;
        }
    };
}((function () { return this; }())));
