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

    function stringList(value) {
        var source = value instanceof Array ? value : [];
        var seen = {};
        var output = [];
        var index;
        var text;
        for (index = 0; index < source.length; index += 1) {
            text = String(source[index] === null || source[index] === undefined
                ? "" : source[index]).replace(/^\s+|\s+$/g, "");
            if (text.length > 0 && !seen[text]) {
                seen[text] = true;
                output.push(text);
            }
        }
        return output;
    }

    function intList(value) {
        var source = value instanceof Array ? value : [];
        var seen = {};
        var output = [];
        var index;
        var number;
        for (index = 0; index < source.length; index += 1) {
            number = intValue(source[index], -1);
            if (number > 0 && !seen[number]) {
                seen[number] = true;
                output.push(number);
            }
        }
        return output;
    }

    function placeholders(count) {
        var output = [];
        var index;
        for (index = 0; index < count; index += 1) { output.push("?"); }
        return output.join(", ");
    }

    function appendIn(where, args, column, values) {
        var index;
        if (values.length < 1) { return; }
        where.push(column + " IN (" + placeholders(values.length) + ")");
        for (index = 0; index < values.length; index += 1) {
            args.push(values[index]);
        }
    }

    function escapeLike(value) {
        return String(value).replace(/\\/g, "\\\\")
            .replace(/%/g, "\\%")
            .replace(/_/g, "\\_");
    }

    function normalizeTagName(value) {
        return String(value === null || value === undefined ? "" : value)
            .replace(/^\s+|\s+$/g, "")
            .replace(/\s+/g, " ");
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
        var sql = "SELECT * FROM clipboard_items WHERE id = ?" +
            (includeDeleted ? "" : " AND deleted_at IS NULL") + " LIMIT 1";
        requireReady();
        return ClipHub.Database.queryOne(sql, [intValue(id, -1)]);
    }

    function listItems(options) {
        var where = [];
        var args = [];
        var sql;
        var limit;
        var offset;
        var keyword;
        var pattern;
        var sources;
        var types;
        var tagIds;
        var index;
        requireReady();
        options = options || {};
        if (!options.includeDeleted) { where.push("clipboard_items.deleted_at IS NULL"); }
        keyword = String(options.keyword === null || options.keyword === undefined
            ? "" : options.keyword).replace(/^\s+|\s+$/g, "");
        if (keyword.length > 0) {
            pattern = "%" + escapeLike(keyword) + "%";
            where.push("(clipboard_items.content LIKE ? ESCAPE '\\' OR " +
                "clipboard_items.source_label LIKE ? ESCAPE '\\' OR " +
                "clipboard_items.source_package LIKE ? ESCAPE '\\')");
            args.push(pattern);
            args.push(pattern);
            args.push(pattern);
        }
        sources = stringList(options.sourcePackages);
        if (sources.length < 1 && options.sourcePackage) {
            sources = [String(options.sourcePackage)];
        }
        appendIn(where, args, "clipboard_items.source_package", sources);
        types = stringList(options.contentTypes);
        if (types.length < 1 && options.contentType) {
            types = [String(options.contentType)];
        }
        appendIn(where, args, "clipboard_items.content_type", types);
        tagIds = intList(options.tagIds);
        if (tagIds.length > 0) {
            where.push("EXISTS (SELECT 1 FROM clipboard_item_tags filter_tags " +
                "WHERE filter_tags.item_id = clipboard_items.id AND " +
                "filter_tags.tag_id IN (" + placeholders(tagIds.length) + "))");
            for (index = 0; index < tagIds.length; index += 1) {
                args.push(tagIds[index]);
            }
        }
        if (options.sensitiveOnly) { where.push("clipboard_items.is_sensitive = 1"); }
        if (options.excludeSensitive) { where.push("clipboard_items.is_sensitive = 0"); }
        if (options.pinnedOnly) { where.push("clipboard_items.is_pinned = 1"); }
        limit = positiveLimit(options.limit, 50, 500);
        offset = intValue(options.offset, 0);
        if (offset < 0) { offset = 0; }
        sql = "SELECT clipboard_items.* FROM clipboard_items";
        if (where.length > 0) { sql += " WHERE " + where.join(" AND "); }
        sql += " ORDER BY clipboard_items.is_pinned DESC, " +
            "clipboard_items.manual_order ASC, " +
            "clipboard_items.last_copied_at DESC, clipboard_items.id DESC " +
            "LIMIT ? OFFSET ?";
        args.push(limit);
        args.push(offset);
        return ClipHub.Database.queryAll(sql, args);
    }

    function listSourceOptions() {
        requireReady();
        return ClipHub.Database.queryAll(
            "SELECT source_package, MAX(source_label) AS source_label, " +
            "COUNT(*) AS item_count FROM clipboard_items " +
            "WHERE deleted_at IS NULL AND source_package IS NOT NULL " +
            "AND source_package <> '' GROUP BY source_package " +
            "ORDER BY COALESCE(MAX(source_label), source_package) COLLATE NOCASE ASC",
            []
        );
    }

    function listContentTypeOptions() {
        requireReady();
        return ClipHub.Database.queryAll(
            "SELECT content_type, COUNT(*) AS item_count FROM clipboard_items " +
            "WHERE deleted_at IS NULL AND content_type IS NOT NULL " +
            "AND content_type <> '' GROUP BY content_type " +
            "ORDER BY content_type COLLATE NOCASE ASC",
            []
        );
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
            "UPDATE clipboard_items SET " + columns.join(", ") + " WHERE id = ?",
            args
        );
    }

    function listOrderRows(pinned) {
        requireReady();
        return ClipHub.Database.queryAll(
            "SELECT id, is_pinned, manual_order, last_copied_at FROM clipboard_items " +
            "WHERE deleted_at IS NULL AND is_pinned = ? " +
            "ORDER BY manual_order ASC, last_copied_at DESC, id DESC",
            [pinned ? 1 : 0]
        );
    }

    function reorderItem(itemId, targetId, placeAfter) {
        var source = getItem(itemId, false);
        var target = getItem(targetId, false);
        var rows;
        var sourceIndex = -1;
        var targetIndex = -1;
        var index;
        var moved;
        var orderIds = [];
        var pinned;
        var changed = 0;
        requireReady();
        if (source === null || target === null) {
            return { ok: false, changed: false, reason: "missing_item" };
        }
        if (Number(source.id) === Number(target.id)) {
            return { ok: true, changed: false, reason: "same_item",
                itemId: Number(source.id), targetId: Number(target.id),
                pinned: Number(source.is_pinned) === 1 };
        }
        if (Number(source.is_pinned) !== Number(target.is_pinned)) {
            return { ok: false, changed: false, reason: "cross_pinned_group" };
        }
        pinned = Number(source.is_pinned) === 1;
        rows = listOrderRows(pinned);
        for (index = 0; index < rows.length; index += 1) {
            if (Number(rows[index].id) === Number(source.id)) { sourceIndex = index; }
            if (Number(rows[index].id) === Number(target.id)) { targetIndex = index; }
        }
        if (sourceIndex < 0 || targetIndex < 0) {
            return { ok: false, changed: false, reason: "group_item_missing" };
        }
        moved = rows.splice(sourceIndex, 1)[0];
        targetIndex = -1;
        for (index = 0; index < rows.length; index += 1) {
            if (Number(rows[index].id) === Number(target.id)) {
                targetIndex = index;
                break;
            }
        }
        if (targetIndex < 0) {
            return { ok: false, changed: false, reason: "target_missing_after_remove" };
        }
        if (placeAfter === true) { targetIndex += 1; }
        rows.splice(targetIndex, 0, moved);
        ClipHub.Database.transaction(function () {
            for (index = 0; index < rows.length; index += 1) {
                changed += ClipHub.Database.executeUpdateDelete(
                    "UPDATE clipboard_items SET manual_order = ? WHERE id = ?",
                    [(index + 1) * 1000, Number(rows[index].id)]
                );
                orderIds.push(Number(rows[index].id));
            }
        });
        return {
            ok: true,
            changed: true,
            updatedCount: changed,
            itemId: Number(source.id),
            targetId: Number(target.id),
            placeAfter: placeAfter === true,
            pinned: pinned,
            orderIds: orderIds
        };
    }

    function getManualOrderState(pinned) {
        var rows = listOrderRows(pinned === true);
        var output = [];
        var index;
        for (index = 0; index < rows.length; index += 1) {
            output.push({
                id: Number(rows[index].id),
                manualOrder: Number(rows[index].manual_order),
                pinned: Number(rows[index].is_pinned) === 1
            });
        }
        return output;
    }

    function softDeleteItem(id, deletedAt) {
        return updateItem(id, { deleted_at: intValue(deletedAt, ClipHub.Base.now()) });
    }

    function restoreItem(id) {
        return updateItem(id, { deleted_at: null });
    }

    function countItems(includeDeleted) {
        requireReady();
        return ClipHub.Database.scalarLong(
            "SELECT COUNT(*) AS count FROM clipboard_items" +
            (includeDeleted ? "" : " WHERE deleted_at IS NULL"), [], 0
        );
    }

    function purgeExpired(days, referenceAt) {
        var safeDays = intValue(days, 0);
        var now = intValue(referenceAt, ClipHub.Base.now());
        var cutoff;
        requireReady();
        if (safeDays <= 0) { return 0; }
        cutoff = now - safeDays * 86400000;
        return ClipHub.Database.executeUpdateDelete(
            "DELETE FROM clipboard_items WHERE is_pinned = 0 " +
            "AND last_copied_at < ?", [cutoff]
        );
    }

    function trimHistory(limit) {
        var safeLimit = intValue(limit, 0);
        requireReady();
        if (safeLimit <= 0) { return 0; }
        return ClipHub.Database.executeUpdateDelete(
            "DELETE FROM clipboard_items WHERE is_pinned = 0 AND id IN (" +
            "SELECT id FROM clipboard_items WHERE is_pinned = 0 " +
            "ORDER BY last_copied_at DESC, id DESC LIMIT -1 OFFSET ?)",
            [safeLimit]
        );
    }

    function cleanupHistory(options) {
        var result = { expiredDeleted: 0, overflowDeleted: 0,
            totalDeleted: 0, remainingActive: 0, remainingTotal: 0 };
        options = options || {};
        requireReady();
        ClipHub.Database.transaction(function () {
            result.expiredDeleted = purgeExpired(options.autoCleanupDays,
                options.referenceAt);
            result.overflowDeleted = trimHistory(options.historyLimit);
        });
        result.totalDeleted = result.expiredDeleted + result.overflowDeleted;
        result.remainingActive = countItems(false);
        result.remainingTotal = countItems(true);
        return result;
    }

    function getTag(id) {
        requireReady();
        return ClipHub.Database.queryOne(
            "SELECT t.*, (SELECT COUNT(*) FROM clipboard_item_tags cit " +
            "JOIN clipboard_items ci ON ci.id = cit.item_id " +
            "WHERE cit.tag_id = t.id AND ci.deleted_at IS NULL) AS item_count " +
            "FROM tags t WHERE t.id = ? LIMIT 1", [intValue(id, -1)]
        );
    }

    function getTagByName(name) {
        var normalized = normalizeTagName(name).toLowerCase();
        requireReady();
        if (normalized.length === 0) { return null; }
        return ClipHub.Database.queryOne(
            "SELECT * FROM tags WHERE normalized_name = ? LIMIT 1", [normalized]
        );
    }

    function insertTag(tag) {
        var name;
        var normalized;
        var now;
        requireReady();
        tag = tag || {};
        name = normalizeTagName(tag.name);
        if (name.length === 0) { throw new Error("Tag name must not be empty"); }
        if (name.length > 40) { throw new Error("Tag name is too long"); }
        normalized = name.toLowerCase();
        now = ClipHub.Base.now();
        return ClipHub.Database.executeInsert(
            "INSERT INTO tags(name, normalized_name, color_value, " +
            "manual_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
            [name, normalized,
                tag.colorValue === undefined || tag.colorValue === null
                    ? null : intValue(tag.colorValue, 0),
                intValue(tag.manualOrder, 0), now, now]
        );
    }

    function ensureTag(name, colorValue) {
        var existing = getTagByName(name);
        if (existing !== null) { return Number(existing.id); }
        return Number(insertTag({ name: name, colorValue: colorValue }));
    }

    function updateTag(id, patch) {
        var columns = [];
        var args = [];
        var name;
        requireReady();
        patch = patch || {};
        if (patch.hasOwnProperty("name")) {
            name = normalizeTagName(patch.name);
            if (name.length === 0) { throw new Error("Tag name must not be empty"); }
            if (name.length > 40) { throw new Error("Tag name is too long"); }
            columns.push("name = ?"); args.push(name);
            columns.push("normalized_name = ?"); args.push(name.toLowerCase());
        }
        if (patch.hasOwnProperty("color_value")) {
            columns.push("color_value = ?");
            args.push(patch.color_value === null || patch.color_value === undefined
                ? null : intValue(patch.color_value, 0));
        }
        if (patch.hasOwnProperty("colorValue")) {
            columns.push("color_value = ?");
            args.push(patch.colorValue === null || patch.colorValue === undefined
                ? null : intValue(patch.colorValue, 0));
        }
        if (patch.hasOwnProperty("manual_order")) {
            columns.push("manual_order = ?"); args.push(intValue(patch.manual_order, 0));
        }
        if (patch.hasOwnProperty("manualOrder")) {
            columns.push("manual_order = ?"); args.push(intValue(patch.manualOrder, 0));
        }
        if (columns.length === 0) { return 0; }
        columns.push("updated_at = ?"); args.push(ClipHub.Base.now());
        args.push(intValue(id, -1));
        return ClipHub.Database.executeUpdateDelete(
            "UPDATE tags SET " + columns.join(", ") + " WHERE id = ?", args
        );
    }

    function deleteTag(id) {
        var changed = 0;
        requireReady();
        ClipHub.Database.transaction(function () {
            ClipHub.Database.executeUpdateDelete(
                "DELETE FROM clipboard_item_tags WHERE tag_id = ?", [intValue(id, -1)]
            );
            changed = ClipHub.Database.executeUpdateDelete(
                "DELETE FROM tags WHERE id = ?", [intValue(id, -1)]
            );
        });
        return changed;
    }

    function listTags() {
        requireReady();
        return ClipHub.Database.queryAll(
            "SELECT t.*, COUNT(ci.id) AS item_count FROM tags t " +
            "LEFT JOIN clipboard_item_tags cit ON cit.tag_id = t.id " +
            "LEFT JOIN clipboard_items ci ON ci.id = cit.item_id " +
            "AND ci.deleted_at IS NULL GROUP BY t.id " +
            "ORDER BY t.manual_order ASC, t.name COLLATE NOCASE ASC", []
        );
    }

    function listItemTags(itemId) {
        requireReady();
        return ClipHub.Database.queryAll(
            "SELECT t.* FROM tags t JOIN clipboard_item_tags cit " +
            "ON cit.tag_id = t.id WHERE cit.item_id = ? " +
            "ORDER BY t.manual_order ASC, t.name COLLATE NOCASE ASC",
            [intValue(itemId, -1)]
        );
    }

    function listItemTagMap(itemIds) {
        var ids = intList(itemIds);
        var rows;
        var result = {};
        var args = [];
        var index;
        var key;
        requireReady();
        if (ids.length < 1) { return result; }
        for (index = 0; index < ids.length; index += 1) { args.push(ids[index]); }
        rows = ClipHub.Database.queryAll(
            "SELECT cit.item_id, t.id, t.name, t.normalized_name, " +
            "t.color_value, t.manual_order FROM clipboard_item_tags cit " +
            "JOIN tags t ON t.id = cit.tag_id WHERE cit.item_id IN (" +
            placeholders(ids.length) + ") ORDER BY cit.item_id ASC, " +
            "t.manual_order ASC, t.name COLLATE NOCASE ASC", args
        );
        for (index = 0; index < rows.length; index += 1) {
            key = String(rows[index].item_id);
            if (!result[key]) { result[key] = []; }
            result[key].push(rows[index]);
        }
        return result;
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

    function setItemTags(itemId, tagIds) {
        var ids = intList(tagIds);
        var index;
        var attached = 0;
        requireReady();
        ClipHub.Database.transaction(function () {
            ClipHub.Database.executeUpdateDelete(
                "DELETE FROM clipboard_item_tags WHERE item_id = ?", [intValue(itemId, -1)]
            );
            for (index = 0; index < ids.length; index += 1) {
                if (attachTag(itemId, ids[index]) >= 0) { attached += 1; }
            }
        });
        return attached;
    }

    ClipHub.Repository = {
        MODULE_NAME: "ch_06_repository",
        MODULE_VERSION: 7,
        init: function () {
            ready = !!(ClipHub.Database && ClipHub.Database.isOpen());
            if (!ready) { throw new Error("Database is unavailable"); }
            return true;
        },
        isReady: function () { return ready; },
        normalizeContent: normalizeContent,
        hashContent: function (content) { return sha256(normalizeContent(content)); },
        insertItem: insertItem,
        getItem: getItem,
        listItems: listItems,
        listSourceOptions: listSourceOptions,
        listContentTypeOptions: listContentTypeOptions,
        updateItem: updateItem,
        listOrderRows: listOrderRows,
        reorderItem: reorderItem,
        getManualOrderState: getManualOrderState,
        softDeleteItem: softDeleteItem,
        restoreItem: restoreItem,
        countItems: countItems,
        purgeExpired: purgeExpired,
        trimHistory: trimHistory,
        cleanupHistory: cleanupHistory,
        normalizeTagName: normalizeTagName,
        getTag: getTag,
        getTagByName: getTagByName,
        insertTag: insertTag,
        ensureTag: ensureTag,
        updateTag: updateTag,
        deleteTag: deleteTag,
        listTags: listTags,
        listItemTags: listItemTags,
        listItemTagMap: listItemTagMap,
        attachTag: attachTag,
        detachTag: detachTag,
        setItemTags: setItemTags,
        insert: insertItem,
        update: updateItem,
        remove: softDeleteItem,
        query: listItems,
        shutdown: function () { ready = false; return true; }
    };
}((function () { return this; }())));
