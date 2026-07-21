(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var MessageDigest = Packages.java.security.MessageDigest;
    var JavaString = Packages.java.lang.String;
    var ready = false;

    function requireReady() {
        if (!ready || !ClipHub.Database || !ClipHub.Database.isOpen()) {
            throw new Error("ClipHub repository is not ready");
        }
    }

    function normalizeContent(value) {
        return String(value === null || value === undefined ? "" : value)
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .replace(/^\s+|\s+$/g, "");
    }

    function sha256(value) {
        var digest = MessageDigest.getInstance("SHA-256");
        var bytes = new JavaString(String(value)).getBytes("UTF-8");
        var result = digest.digest(bytes);
        var output = [];
        var index;
        var number;
        var hex;
        for (index = 0; index < result.length; index += 1) {
            number = Number(result[index]);
            if (number < 0) { number += 256; }
            hex = number.toString(16);
            output.push(hex.length === 1 ? "0" + hex : hex);
        }
        return output.join("");
    }

    function intValue(value, fallback) {
        var number = Number(value);
        if (!isFinite(number)) { return fallback; }
        return Math.floor(number);
    }

    function positiveLimit(value, fallback, maximum) {
        var number = intValue(value, fallback);
        if (number < 1) { number = fallback; }
        if (number > maximum) { number = maximum; }
        return number;
    }

    function insertItem(item) {
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
                item.contentType || "text",
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

    function getItem(id, includeDeleted) {
        var sql =
            "SELECT * FROM clipboard_items WHERE id = ?" +
            (includeDeleted ? "" : " AND deleted_at IS NULL") +
            " LIMIT 1";
        requireReady();
        return ClipHub.Database.queryOne(sql, [intValue(id, -1)]);
    }

    function listItems(options) {
        var where = [];
        var args = [];
        var sql;
        var limit;
        var offset;
        requireReady();
        options = options || {};
        if (!options.includeDeleted) { where.push("deleted_at IS NULL"); }
        if (options.contentType) {
            where.push("content_type = ?");
            args.push(String(options.contentType));
        }
        if (options.sourcePackage) {
            where.push("source_package = ?");
            args.push(String(options.sourcePackage));
        }
        if (options.sensitiveOnly) { where.push("is_sensitive = 1"); }
        if (options.excludeSensitive) { where.push("is_sensitive = 0"); }
        if (options.pinnedOnly) { where.push("is_pinned = 1"); }
        limit = positiveLimit(options.limit, 50, 500);
        offset = intValue(options.offset, 0);
        if (offset < 0) { offset = 0; }
        sql = "SELECT * FROM clipboard_items";
        if (where.length > 0) { sql += " WHERE " + where.join(" AND "); }
        sql += " ORDER BY is_pinned DESC, manual_order ASC, " +
            "last_copied_at DESC, id DESC LIMIT ? OFFSET ?";
        args.push(limit);
        args.push(offset);
        return ClipHub.Database.queryAll(sql, args);
    }

    function updateItem(id, patch) {
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
            "UPDATE clipboard_items SET " + columns.join(", ") +
            " WHERE id = ?",
            args
        );
    }

    function softDeleteItem(id, deletedAt) {
        return updateItem(id, {
            deleted_at: intValue(deletedAt, ClipHub.Base.now())
        });
    }

    function restoreItem(id) {
        return updateItem(id, { deleted_at: null });
    }

    function countItems(includeDeleted) {
        requireReady();
        return ClipHub.Database.scalarLong(
            "SELECT COUNT(*) AS count FROM clipboard_items" +
            (includeDeleted ? "" : " WHERE deleted_at IS NULL"),
            [],
            0
        );
    }

    function insertTag(tag) {
        var name;
        var normalized;
        var now;
        requireReady();
        tag = tag || {};
        name = String(tag.name === null || tag.name === undefined
            ? "" : tag.name).replace(/^\s+|\s+$/g, "");
        if (name.length === 0) { throw new Error("Tag name must not be empty"); }
        normalized = name.toLowerCase();
        now = ClipHub.Base.now();
        return ClipHub.Database.executeInsert(
            "INSERT INTO tags(name, normalized_name, color_value, " +
            "manual_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            [
                name,
                normalized,
                tag.colorValue === undefined || tag.colorValue === null
                    ? null : intValue(tag.colorValue, 0),
                intValue(tag.manualOrder, 0),
                now,
                now
            ]
        );
    }

    function listTags() {
        requireReady();
        return ClipHub.Database.queryAll(
            "SELECT * FROM tags ORDER BY manual_order ASC, name COLLATE NOCASE ASC",
            []
        );
    }

    function attachTag(itemId, tagId) {
        requireReady();
        return ClipHub.Database.executeInsert(
            "INSERT OR IGNORE INTO clipboard_item_tags" +
            "(item_id, tag_id, created_at) VALUES (?, ?, ?)",
            [intValue(itemId, -1), intValue(tagId, -1), ClipHub.Base.now()]
        );
    }

    function detachTag(itemId, tagId) {
        requireReady();
        return ClipHub.Database.executeUpdateDelete(
            "DELETE FROM clipboard_item_tags WHERE item_id = ? AND tag_id = ?",
            [intValue(itemId, -1), intValue(tagId, -1)]
        );
    }

    ClipHub.Repository = {
        MODULE_NAME: "ch_06_repository",
        MODULE_VERSION: 3,
        init: function () {
            ready = !!(ClipHub.Database && ClipHub.Database.isOpen());
            if (!ready) { throw new Error("Database is unavailable"); }
            return true;
        },
        isReady: function () { return ready; },
        normalizeContent: normalizeContent,
        hashContent: function (content) {
            return sha256(normalizeContent(content));
        },
        insertItem: insertItem,
        getItem: getItem,
        listItems: listItems,
        updateItem: updateItem,
        softDeleteItem: softDeleteItem,
        restoreItem: restoreItem,
        countItems: countItems,
        insertTag: insertTag,
        listTags: listTags,
        attachTag: attachTag,
        detachTag: detachTag,
        insert: insertItem,
        update: updateItem,
        remove: softDeleteItem,
        query: listItems,
        shutdown: function () { ready = false; return true; }
    };
}((function () { return this; }())));
