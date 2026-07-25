#!/usr/bin/env python3
from pathlib import Path
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]
VERSION = "20260726.08"
BRANCH = "agent/release-review-p2"


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def write(path, value):
    (ROOT / path).write_text(value, encoding="utf-8")


def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError("%s expected one match, found %d" % (path, count))
    write(path, text.replace(old, new, 1))


# Repository: enforce content invariants and expose order-independent latest row.
old_insert = r'''    function insertItem(item) {
        var content;
        var normalized;
        var now;
        var createdAt;
        var lastCopiedAt;
        var updatedAt;
        requireReady();
        item = item || {};
        content = String(item.content === null || item.content === undefined
            ? "" : item.content);
        if (content.length === 0) {
            throw new Error("Clipboard content must not be empty");
        }
        normalized = normalizeContent(content);
        now = ClipHub.Base.now();
        createdAt = intValue(item.createdAt, now);
        lastCopiedAt = intValue(item.lastCopiedAt, createdAt);
        updatedAt = intValue(item.updatedAt, now);
        return ClipHub.Database.executeInsert(
            "INSERT INTO clipboard_items(" +
            "content, normalized_hash, content_type, source_package, " +
            "source_label, source_uid, source_confidence, is_sensitive, " +
            "is_pinned, manual_order, copy_count, created_at, " +
            "last_copied_at, updated_at, deleted_at" +
            ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                content,
                item.normalizedHash || sha256(normalized),
                normalizeContentType(item.contentType),
                item.sourcePackage === undefined ? null : item.sourcePackage,
                item.sourceLabel === undefined ? null : item.sourceLabel,
                item.sourceUid === undefined || item.sourceUid === null
                    ? null : intValue(item.sourceUid, 0),
                intValue(item.sourceConfidence, 0),
                item.isSensitive ? 1 : 0,
                item.isPinned ? 1 : 0,
                intValue(item.manualOrder, 0),
                positiveLimit(item.copyCount, 1, 2147483647),
                createdAt,
                lastCopiedAt,
                updatedAt,
                item.deletedAt === undefined || item.deletedAt === null
                    ? null : intValue(item.deletedAt, now)
            ]
        );
    }
'''
new_insert = r'''    function insertItem(item) {
        var content;
        var normalized;
        var normalizedHash;
        var now;
        var createdAt;
        var lastCopiedAt;
        var updatedAt;
        requireReady();
        item = item || {};
        content = String(item.content === null || item.content === undefined
            ? "" : item.content);
        normalized = normalizeContent(content);
        if (normalized.length === 0) {
            throw new Error("Clipboard content must not be blank");
        }
        normalizedHash = sha256(normalized);
        now = ClipHub.Base.now();
        createdAt = intValue(item.createdAt, now);
        lastCopiedAt = intValue(item.lastCopiedAt, createdAt);
        updatedAt = intValue(item.updatedAt, now);
        return ClipHub.Database.executeInsert(
            "INSERT INTO clipboard_items(" +
            "content, normalized_hash, content_type, source_package, " +
            "source_label, source_uid, source_confidence, is_sensitive, " +
            "is_pinned, manual_order, copy_count, created_at, " +
            "last_copied_at, updated_at, deleted_at" +
            ") VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                content,
                normalizedHash,
                normalizeContentType(item.contentType),
                item.sourcePackage === undefined ? null : item.sourcePackage,
                item.sourceLabel === undefined ? null : item.sourceLabel,
                item.sourceUid === undefined || item.sourceUid === null
                    ? null : intValue(item.sourceUid, 0),
                intValue(item.sourceConfidence, 0),
                item.isSensitive ? 1 : 0,
                item.isPinned ? 1 : 0,
                intValue(item.manualOrder, 0),
                positiveLimit(item.copyCount, 1, 2147483647),
                createdAt,
                lastCopiedAt,
                updatedAt,
                item.deletedAt === undefined || item.deletedAt === null
                    ? null : intValue(item.deletedAt, now)
            ]
        );
    }
'''
replace_once("src/ch_06_repository.js", old_insert, new_insert)

old_get = r'''    function getItem(id, includeDeleted) {
        var sql = "SELECT * FROM clipboard_items WHERE id = ?" +
            (includeDeleted ? "" : " AND deleted_at IS NULL") + " LIMIT 1";
        requireReady();
        return ClipHub.Database.queryOne(sql, [intValue(id, -1)]);
    }
'''
new_get = old_get + r'''
    function getLatestActiveItem() {
        requireReady();
        return ClipHub.Database.queryOne(
            "SELECT * FROM clipboard_items WHERE deleted_at IS NULL " +
            "ORDER BY last_copied_at DESC, id DESC LIMIT 1", []
        );
    }
'''
replace_once("src/ch_06_repository.js", old_get, new_get)

old_update = r'''    function updateItem(id, patch) {
        var allowed = {
            content: true,
            content_type: true,
            source_package: true,
            source_label: true,
            source_uid: true,
            source_confidence: true,
            is_sensitive: true,
            is_pinned: true,
            manual_order: true,
            copy_count: true,
            last_copied_at: true,
            deleted_at: true
        };
        var columns = [];
        var args = [];
        var key;
        var value;
        var normalized;
        requireReady();
        patch = patch || {};
        for (key in patch) {
            if (patch.hasOwnProperty(key) && allowed[key]) {
                value = patch[key];
                columns.push(key + " = ?");
                args.push(value);
            }
        }
        if (patch.hasOwnProperty("content")) {
            if (patch.content === null || patch.content === undefined ||
                    String(patch.content).length === 0) {
                throw new Error("Clipboard content must not be empty");
            }
            normalized = normalizeContent(patch.content);
            columns.push("normalized_hash = ?");
            args.push(sha256(normalized));
        }
        if (columns.length === 0) { return 0; }
        columns.push("updated_at = ?");
        args.push(ClipHub.Base.now());
        args.push(intValue(id, -1));
        return ClipHub.Database.executeUpdateDelete(
            "UPDATE clipboard_items SET " + columns.join(", ") + " WHERE id = ?",
            args
        );
    }
'''
new_update = r'''    function updateItem(id, patch) {
        var allowed = {
            content: true,
            content_type: true,
            source_package: true,
            source_label: true,
            source_uid: true,
            source_confidence: true,
            is_sensitive: true,
            is_pinned: true,
            manual_order: true,
            copy_count: true,
            last_copied_at: true,
            deleted_at: true
        };
        var columns = [];
        var args = [];
        var key;
        var value;
        var normalized = null;
        requireReady();
        patch = patch || {};
        for (key in patch) {
            if (!patch.hasOwnProperty(key) || !allowed[key]) { continue; }
            value = patch[key];
            if (key === "content") {
                value = String(value === null || value === undefined ? "" : value);
                normalized = normalizeContent(value);
                if (normalized.length === 0) {
                    throw new Error("Clipboard content must not be blank");
                }
            } else if (key === "content_type") {
                value = normalizeContentType(value);
            }
            columns.push(key + " = ?");
            args.push(value);
        }
        if (normalized !== null) {
            columns.push("normalized_hash = ?");
            args.push(sha256(normalized));
        }
        if (columns.length === 0) { return 0; }
        columns.push("updated_at = ?");
        args.push(ClipHub.Base.now());
        args.push(intValue(id, -1));
        return ClipHub.Database.executeUpdateDelete(
            "UPDATE clipboard_items SET " + columns.join(", ") + " WHERE id = ?",
            args
        );
    }
'''
replace_once("src/ch_06_repository.js", old_update, new_update)

old_restore = r'''    function restoreItem(id) {
        return updateItem(id, { deleted_at: null });
    }
'''
new_restore = old_restore + r'''
    function restoreItemIfDeletedAt(id, deletedAt) {
        var now = ClipHub.Base.now();
        requireReady();
        return ClipHub.Database.executeUpdateDelete(
            "UPDATE clipboard_items SET deleted_at = NULL, updated_at = ? " +
            "WHERE id = ? AND deleted_at = ?",
            [now, intValue(id, -1), intValue(deletedAt, -1)]
        );
    }
'''
replace_once("src/ch_06_repository.js", old_restore, new_restore)

old_ensure = r'''    function ensureTag(name, colorValue) {
        var existing = getTagByName(name);
        if (existing !== null) { return Number(existing.id); }
        return Number(insertTag({ name: name, colorValue: colorValue }));
    }
'''
new_ensure = r'''    function ensureTag(name, colorValue) {
        var existing = getTagByName(name);
        if (existing !== null) { return Number(existing.id); }
        try {
            return Number(insertTag({ name: name, colorValue: colorValue }));
        } catch (error) {
            existing = getTagByName(name);
            if (existing !== null) { return Number(existing.id); }
            throw error;
        }
    }
'''
replace_once("src/ch_06_repository.js", old_ensure, new_ensure)
replace_once("src/ch_06_repository.js", 'MODULE_VERSION: 11', 'MODULE_VERSION: 12')
replace_once(
    "src/ch_06_repository.js",
    '        getItem: getItem,\n        listItems: listItems,',
    '        getItem: getItem,\n        getLatestActiveItem: getLatestActiveItem,\n        listItems: listItems,'
)
replace_once(
    "src/ch_06_repository.js",
    '        restoreItem: restoreItem,\n        countItems: countItems,',
    '        restoreItem: restoreItem,\n        restoreItemIfDeletedAt: restoreItemIfDeletedAt,\n        countItems: countItems,'
)

# Clipboard: atomically merge against the actual latest copied item, not UI order.
replace_once(
    "src/ch_04_clipboard.js",
    '        lastObserved: { hash: "", at: 0 },',
    '        lastObserved: { hash: "", at: 0, seq: 0 },'
)

old_record = r'''    function recordText(text, hash, contentType, eventAt, metadata) {
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
'''
new_record = r'''    function recordText(text, hash, contentType, eventAt, metadata) {
        return ClipHub.Database.transaction(function () {
            var row = ClipHub.Repository.getLatestActiveItem();
            var copiedAt;
            var copyDeltaMs;
            var copyCount;
            var id;
            var patch;
            var insert;
            var sourceValues;
            var key;
            if (row !== null && String(row.normalized_hash) === hash) {
                copiedAt = Number(row.last_copied_at || 0);
                copyDeltaMs = Number(eventAt) - copiedAt;
                if (copyDeltaMs >= 0 &&
                        copyDeltaMs <= Number(config.mergeWindowMs)) {
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
        });
    }
'''
replace_once("src/ch_04_clipboard.js", old_record, new_record)

replace_once(
    "src/ch_04_clipboard.js",
    '                state.lastObserved.hash = hash;\n                state.lastObserved.at = eventAt;\n                state.ignoredCount += 1;',
    '                state.lastObserved.hash = hash;\n                state.lastObserved.at = eventAt;\n                state.lastObserved.seq = state.eventSeq;\n                state.ignoredCount += 1;'
)
replace_once(
    "src/ch_04_clipboard.js",
    '                state.lastObserved.at = eventAt;\n                state.ignoredCount += 1;',
    '                state.lastObserved.at = eventAt;\n                state.lastObserved.seq = state.eventSeq;\n                state.ignoredCount += 1;'
)
replace_once(
    "src/ch_04_clipboard.js",
    '            state.lastObserved.hash = hash;\n            state.lastObserved.at = eventAt;\n            classified = ClipHub.Classifier &&',
    '            state.lastObserved.hash = hash;\n            state.lastObserved.at = eventAt;\n            state.lastObserved.seq = state.eventSeq;\n            classified = ClipHub.Classifier &&'
)

old_catch = r'''        } catch (error) {
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
'''
new_catch = r'''        } catch (error) {
            if (Number(state.lastObserved.seq || 0) === Number(state.eventSeq)) {
                state.lastObserved.hash = "";
                state.lastObserved.at = 0;
                state.lastObserved.seq = 0;
            }
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
'''
replace_once("src/ch_04_clipboard.js", old_catch, new_catch)
replace_once(
    "src/ch_04_clipboard.js",
    '            lastObserved: {\n                hash: state.lastObserved.hash,\n                at: state.lastObserved.at\n            },',
    '            lastObserved: {\n                hash: state.lastObserved.hash,\n                at: state.lastObserved.at,\n                seq: Number(state.lastObserved.seq || 0)\n            },'
)
replace_once("src/ch_04_clipboard.js", 'MODULE_VERSION: 6', 'MODULE_VERSION: 7')

# List: bind undo to the exact soft-delete operation that created the token.
old_undo = r'''        changed = ClipHub.Repository.restoreItem(Number(target.id));
        if (Number(changed) < 1) { return false; }
'''
new_undo = r'''        if (Number(row.deleted_at) !== Number(target.deletedAt)) {
            lastDeleted = null;
            refreshQuietly();
            return false;
        }
        changed = ClipHub.Repository.restoreItemIfDeletedAt &&
            typeof ClipHub.Repository.restoreItemIfDeletedAt === "function" ?
            ClipHub.Repository.restoreItemIfDeletedAt(
                Number(target.id), Number(target.deletedAt)) :
            ClipHub.Repository.restoreItem(Number(target.id));
        if (Number(changed) < 1) {
            lastDeleted = null;
            refreshQuietly();
            return false;
        }
'''
replace_once("src/ch_09_list.js", old_undo, new_undo)
replace_once("src/ch_09_list.js", 'MODULE_VERSION: 18', 'MODULE_VERSION: 19')

# Make the P2 branch directly runnable.
replace_once(
    "ClipHub.js",
    'var DEFAULT_REF = "agent/fix-release-review-p1";',
    'var DEFAULT_REF = "agent/release-review-p2";'
)

manifest_path = ROOT / "module-manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["moduleSetVersion"] = VERSION
manifest["sourceRef"] = BRANCH
for module in manifest["modules"]:
    module["sha"] = subprocess.check_output(
        ["git", "hash-object", module["path"]], cwd=str(ROOT), text=True
    ).strip()
manifest_path.write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8"
)

# Contract checks: protect against accidental reintroduction of the reviewed bugs.
clipboard = read("src/ch_04_clipboard.js")
repository = read("src/ch_06_repository.js")
listing = read("src/ch_09_list.js")
entry = read("ClipHub.js")
if "Repository.listItems({limit: 1" in clipboard or "Repository.listItems({ limit: 1" in clipboard:
    raise RuntimeError("clipboard merge still depends on UI list ordering")
if "ClipHub.Database.transaction(function ()" not in clipboard:
    raise RuntimeError("clipboard merge transaction missing")
if "getLatestActiveItem" not in repository:
    raise RuntimeError("latest active item API missing")
if "item.normalizedHash ||" in repository:
    raise RuntimeError("repository still trusts caller-provided hashes")
if "restoreItemIfDeletedAt" not in repository or "target.deletedAt" not in listing:
    raise RuntimeError("delete-token guard missing")
if 'var DEFAULT_REF = "' + BRANCH + '";' not in entry:
    raise RuntimeError("entry ref not updated")
print("applied", VERSION, BRANCH)
