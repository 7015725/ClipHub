(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var AndroidContext = Packages.android.content.Context;
    var AndroidClipData = Packages.android.content.ClipData;
    var ClipboardManager = Packages.android.content.ClipboardManager;
    var Thread = Packages.java.lang.Thread;
    var manager = null;
    var listener = null;
    var androidContext = null;
    var running = false;
    var config = {
        callbackDedupMs: 750,
        mergeWindowMs: 2000,
        ownWriteWindowMs: 3000,
        maxChars: 100000,
        maxItems: 10
    };
    var state = {
        eventSeq: 0,
        handledCount: 0,
        insertedCount: 0,
        mergedCount: 0,
        ignoredCount: 0,
        errorCount: 0,
        lastEvent: null,
        lastObserved: { hash: "", at: 0 },
        ownWrite: { hash: "", at: 0, expiresAt: 0, consumed: false },
        callbackThreadId: null,
        callbackThreadName: null
    };

    function now() { return ClipHub.Base.now(); }

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

    function setLastEvent(event) {
        state.lastEvent = event;
        return event;
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
        if (manager === null) {
            return { ok: false, reason: "manager_unavailable", text: "" };
        }
        clip = manager.getPrimaryClip();
        if (clip === null) {
            return { ok: false, reason: "no_primary_clip", text: "" };
        }
        itemCount = Number(clip.getItemCount());
        if (itemCount < 1) {
            return { ok: false, reason: "empty_clip", text: "" };
        }
        description = clip.getDescription();
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
                itemCount: itemCount
            };
        }
        text = parts.join("\n");
        if (text.length === 0 ||
                ClipHub.Repository.normalizeContent(text).length === 0) {
            return {
                ok: false,
                reason: "blank_text",
                text: "",
                itemCount: itemCount
            };
        }
        if (text.length > config.maxChars) {
            return {
                ok: false,
                reason: "text_too_large",
                text: "",
                contentLength: text.length,
                itemCount: itemCount
            };
        }
        return {
            ok: true,
            reason: null,
            text: text,
            contentLength: text.length,
            itemCount: itemCount
        };
    }

    function emit(name, payload) {
        try {
            if (ClipHub.EventBus && typeof ClipHub.EventBus.emit === "function") {
                ClipHub.EventBus.emit(name, payload);
            }
        } catch (ignored) {}
    }

    function recordText(text, hash, contentType, eventAt) {
        var latest = ClipHub.Repository.listItems({limit: 1, offset: 0});
        var row = latest && latest.length > 0 ? latest[0] : null;
        var copiedAt;
        var copyCount;
        var id;
        if (row !== null && String(row.normalized_hash) === hash) {
            copiedAt = Number(row.last_copied_at || 0);
            if (eventAt - copiedAt <= config.mergeWindowMs) {
                copyCount = Number(row.copy_count || 1) + 1;
                ClipHub.Repository.updateItem(Number(row.id), {
                    content: text,
                    content_type: contentType,
                    copy_count: copyCount,
                    last_copied_at: eventAt,
                    deleted_at: null
                });
                return {
                    id: Number(row.id),
                    inserted: false,
                    merged: true,
                    copyCount: copyCount,
                    hash: hash
                };
            }
        }
        id = ClipHub.Repository.insertItem({
            content: text,
            contentType: contentType,
            normalizedHash: hash,
            lastCopiedAt: eventAt,
            createdAt: eventAt,
            updatedAt: eventAt
        });
        return {
            id: Number(id),
            inserted: true,
            merged: false,
            copyCount: 1,
            hash: hash
        };
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
                state.ignoredCount += 1;
                return setLastEvent({
                    seq: state.eventSeq,
                    at: eventAt,
                    origin: String(origin || "listener"),
                    status: "ignored",
                    reason: read.reason,
                    contentLength: Number(read.contentLength || 0),
                    threadId: state.callbackThreadId,
                    threadName: state.callbackThreadName
                });
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
                    threadId: state.callbackThreadId,
                    threadName: state.callbackThreadName
                };
                emit("clipboard_ignored", event);
                return setLastEvent(event);
            }
            state.lastObserved.hash = hash;
            state.lastObserved.at = eventAt;
            classified = ClipHub.Classifier &&
                typeof ClipHub.Classifier.classify === "function"
                ? ClipHub.Classifier.classify(read.text)
                : { type: "text" };
            result = recordText(
                read.text,
                hash,
                classified && classified.type
                    ? String(classified.type) : "text",
                eventAt
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
                threadId: state.callbackThreadId,
                threadName: state.callbackThreadName
            };
            log("info", "clipboard " + event.status + " seq=" +
                event.seq + " id=" + event.id + " len=" +
                event.contentLength + " hash=" + event.hashPrefix);
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
            manager.setPrimaryClip(clip);
            return {
                ok: true,
                written: true,
                hash: hash,
                at: at,
                contentLength: text.length
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

    ClipHub.Clipboard = {
        MODULE_NAME: "ch_04_clipboard",
        MODULE_VERSION: 2,
        init: function (context) {
            androidContext = context && context.androidContext
                ? context.androidContext : global.context;
            if (androidContext === null || androidContext === undefined) {
                throw new Error("Android context unavailable");
            }
            manager = androidContext.getSystemService(AndroidContext.CLIPBOARD_SERVICE);
            if (manager === null) { throw new Error("ClipboardManager unavailable"); }
            return start();
        },
        start: start,
        stop: stop,
        readPrimaryText: readPrimaryText,
        processCurrentClip: function () {
            return handlePrimaryClipChanged("manual");
        },
        writeText: writeText,
        markOwnWrite: markOwnWrite,
        configure: function (patch) {
            var key;
            patch = patch || {};
            for (key in patch) {
                if (patch.hasOwnProperty(key) && config.hasOwnProperty(key)) {
                    config[key] = Math.max(0, Math.floor(Number(patch[key])));
                }
            }
            return this.getState().config;
        },
        getState: function () {
            return {
                running: running,
                eventSeq: state.eventSeq,
                handledCount: state.handledCount,
                insertedCount: state.insertedCount,
                mergedCount: state.mergedCount,
                ignoredCount: state.ignoredCount,
                errorCount: state.errorCount,
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
                    maxItems: config.maxItems
                }
            };
        },
        shutdown: function () {
            stop();
            manager = null;
            androidContext = null;
            return true;
        }
    };
}((function () { return this; }())));
