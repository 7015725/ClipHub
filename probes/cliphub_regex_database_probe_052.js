/* ClipHub regex database probe 052 v2. Rhino ES5. Standalone read-only. */
(function (global) {
    var File = Packages.java.io.File;
    var SQLiteDatabase = Packages.android.database.sqlite.SQLiteDatabase;
    var db = null;
    var cursor = null;
    var result = {
        probe: 52,
        probeVersion: 2,
        ok: false,
        runtimePath: null,
        databasePath: null,
        dbVersion: null,
        regexRulesTable: false,
        featureMarker: null,
        ruleCount: null,
        columns: [],
        requiredColumnsPresent: false,
        integrityCheck: null,
        error: null
    };
    var requiredColumns = [
        "id", "title", "title_normalized", "note", "pattern", "flags",
        "enabled", "manual_order", "created_at", "updated_at"
    ];
    var foundColumns = {};
    var index;
    var name;

    function closeQuietly(value) {
        if (value !== null && value !== undefined) {
            try { value.close(); } catch (ignored) {}
        }
    }

    function scalarString(database, sql) {
        var c = null;
        try {
            c = database.rawQuery(String(sql), null);
            if (!c.moveToFirst()) { return null; }
            return c.isNull(0) ? null : String(c.getString(0));
        } finally {
            closeQuietly(c);
        }
    }

    function scalarLong(database, sql) {
        var c = null;
        try {
            c = database.rawQuery(String(sql), null);
            if (!c.moveToFirst()) { return null; }
            return Number(c.getLong(0));
        } finally {
            closeQuietly(c);
        }
    }

    try {
        if (typeof shortx === "undefined" ||
                typeof shortx.getShortXDir !== "function") {
            throw new Error("ShortX runtime unavailable");
        }
        result.runtimePath = String(new File(
            String(shortx.getShortXDir()), "ClipHub").getAbsolutePath());
        result.databasePath = String(new File(
            new File(result.runtimePath, "data"),
            "cliphub.db").getAbsolutePath());
        if (!new File(result.databasePath).isFile()) {
            throw new Error("ClipHub database missing: " + result.databasePath);
        }

        db = SQLiteDatabase.openDatabase(
            result.databasePath,
            null,
            SQLiteDatabase.OPEN_READONLY
        );
        result.dbVersion = Number(db.getVersion());
        result.regexRulesTable = scalarLong(
            db,
            "SELECT COUNT(*) FROM sqlite_master " +
                "WHERE type='table' AND name='regex_rules'"
        ) === 1;
        result.featureMarker = scalarString(
            db,
            "SELECT value FROM schema_meta " +
                "WHERE key='feature.regex_rules.schema_version'"
        );
        if (result.regexRulesTable) {
            result.ruleCount = scalarLong(db, "SELECT COUNT(*) FROM regex_rules");
            cursor = db.rawQuery("PRAGMA table_info(regex_rules)", null);
            while (cursor.moveToNext()) {
                name = String(cursor.getString(
                    Number(cursor.getColumnIndexOrThrow("name"))));
                result.columns.push(name);
                foundColumns[name] = true;
            }
            closeQuietly(cursor);
            cursor = null;
        }
        result.requiredColumnsPresent = true;
        for (index = 0; index < requiredColumns.length; index += 1) {
            if (foundColumns[requiredColumns[index]] !== true) {
                result.requiredColumnsPresent = false;
                break;
            }
        }
        result.integrityCheck = scalarString(db, "PRAGMA integrity_check");
        result.ok = result.dbVersion === 2 &&
            result.regexRulesTable === true &&
            String(result.featureMarker || "") === "1" &&
            result.requiredColumnsPresent === true &&
            result.integrityCheck === "ok";
        if (!result.ok) {
            throw new Error("Regex database contract failed: " +
                JSON.stringify(result));
        }
    } catch (error) {
        result.error = String(error);
    } finally {
        closeQuietly(cursor);
        closeQuietly(db);
    }

    global.ClipHubRegexDatabaseProbe052Result = result;
}((function () { return this; }())));

JSON.stringify(ClipHubRegexDatabaseProbe052Result);
