(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var File = Packages.java.io.File;
    var SQLiteDatabase = Packages.android.database.sqlite.SQLiteDatabase;
    var ReflectArray = Packages.java.lang.reflect.Array;
    var JavaString = Packages.java.lang.String;
    var SCHEMA_VERSION = 2;
    var path = null;
    var database = null;

    var MIGRATIONS = {
        1: function (db) {
            db.execSQL(
                "CREATE TABLE IF NOT EXISTS schema_meta (" +
                "key TEXT PRIMARY KEY NOT NULL," +
                "value TEXT" +
                ")"
            );
            db.execSQL(
                "CREATE TABLE IF NOT EXISTS clipboard_items (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "content TEXT NOT NULL," +
                "normalized_hash TEXT NOT NULL," +
                "content_type TEXT NOT NULL DEFAULT 'text'," +
                "source_package TEXT," +
                "source_label TEXT," +
                "source_uid INTEGER," +
                "source_confidence INTEGER NOT NULL DEFAULT 0," +
                "is_pinned INTEGER NOT NULL DEFAULT 0," +
                "manual_order INTEGER NOT NULL DEFAULT 0," +
                "copy_count INTEGER NOT NULL DEFAULT 1," +
                "created_at INTEGER NOT NULL," +
                "last_copied_at INTEGER NOT NULL," +
                "updated_at INTEGER NOT NULL," +
                "deleted_at INTEGER" +
                ")"
            );
            db.execSQL(
                "CREATE TABLE IF NOT EXISTS tags (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "name TEXT NOT NULL," +
                "normalized_name TEXT NOT NULL UNIQUE," +
                "color_value INTEGER," +
                "manual_order INTEGER NOT NULL DEFAULT 0," +
                "created_at INTEGER NOT NULL," +
                "updated_at INTEGER NOT NULL" +
                ")"
            );
            db.execSQL(
                "CREATE TABLE IF NOT EXISTS clipboard_item_tags (" +
                "item_id INTEGER NOT NULL," +
                "tag_id INTEGER NOT NULL," +
                "created_at INTEGER NOT NULL," +
                "PRIMARY KEY (item_id, tag_id)," +
                "FOREIGN KEY (item_id) REFERENCES clipboard_items(id) " +
                "ON DELETE CASCADE," +
                "FOREIGN KEY (tag_id) REFERENCES tags(id) " +
                "ON DELETE CASCADE" +
                ")"
            );
            db.execSQL(
                "CREATE TABLE IF NOT EXISTS settings (" +
                "key TEXT PRIMARY KEY NOT NULL," +
                "value TEXT," +
                "updated_at INTEGER NOT NULL" +
                ")"
            );
            db.execSQL(
                "CREATE INDEX IF NOT EXISTS idx_clipboard_items_last_copied " +
                "ON clipboard_items(last_copied_at DESC)"
            );
            db.execSQL(
                "CREATE INDEX IF NOT EXISTS idx_clipboard_items_type " +
                "ON clipboard_items(content_type)"
            );
            db.execSQL(
                "CREATE INDEX IF NOT EXISTS idx_clipboard_items_source " +
                "ON clipboard_items(source_package)"
            );
            db.execSQL(
                "CREATE INDEX IF NOT EXISTS idx_clipboard_items_hash " +
                "ON clipboard_items(normalized_hash)"
            );
            db.execSQL(
                "CREATE INDEX IF NOT EXISTS idx_clipboard_items_active_order " +
                "ON clipboard_items(deleted_at, is_pinned DESC, " +
                "manual_order ASC, last_copied_at DESC)"
            );
            db.execSQL(
                "CREATE INDEX IF NOT EXISTS idx_clipboard_item_tags_tag " +
                "ON clipboard_item_tags(tag_id, item_id)"
            );
            db.execSQL(
                "INSERT OR REPLACE INTO schema_meta(key, value) " +
                "VALUES ('schema_version', '1')"
            );
        },
        2: function (db) {
            db.execSQL(
                "ALTER TABLE clipboard_items ADD COLUMN " +
                "is_sensitive INTEGER NOT NULL DEFAULT 0"
            );
            db.execSQL(
                "CREATE INDEX IF NOT EXISTS idx_clipboard_items_sensitive " +
                "ON clipboard_items(is_sensitive, last_copied_at DESC)"
            );
            db.execSQL(
                "INSERT OR REPLACE INTO schema_meta(key, value) " +
                "VALUES ('schema_version', '2')"
            );
        }
    };

    function requireOpen() {
        if (database === null || !database.isOpen()) {
            throw new Error("ClipHub database is not open");
        }
        return database;
    }

    function closeCursor(cursor) {
        if (cursor !== null && cursor !== undefined) {
            try { cursor.close(); } catch (ignored) {}
        }
    }

    function toStringArray(values) {
        var result;
        var index;
        if (values === null || values === undefined || values.length === 0) {
            return null;
        }
        result = ReflectArray.newInstance(JavaString, values.length);
        for (index = 0; index < values.length; index += 1) {
            result[index] = values[index] === null || values[index] === undefined
                ? null : String(values[index]);
        }
        return result;
    }

    function bindStatement(statement, values) {
        var index;
        var value;
        if (values === null || values === undefined) { return; }
        for (index = 0; index < values.length; index += 1) {
            value = values[index];
            if (value === null || value === undefined) {
                statement.bindNull(index + 1);
            } else if (typeof value === "boolean") {
                statement.bindLong(index + 1, value ? 1 : 0);
            } else if (typeof value === "number") {
                if (Math.floor(value) === value) {
                    statement.bindLong(index + 1, value);
                } else {
                    statement.bindDouble(index + 1, value);
                }
            } else {
                statement.bindString(index + 1, String(value));
            }
        }
    }

    function executeStatement(sql, values, mode) {
        var statement = null;
        try {
            statement = requireOpen().compileStatement(String(sql));
            bindStatement(statement, values);
            if (mode === "insert") { return Number(statement.executeInsert()); }
            if (mode === "update") {
                return Number(statement.executeUpdateDelete());
            }
            statement.execute();
            return true;
        } finally {
            if (statement !== null) {
                try { statement.close(); } catch (ignored) {}
            }
        }
    }

    function readCursorValue(cursor, columnIndex) {
        var type = Number(cursor.getType(columnIndex));
        if (type === 0) { return null; }
        if (type === 1) { return Number(cursor.getLong(columnIndex)); }
        if (type === 2) { return Number(cursor.getDouble(columnIndex)); }
        if (type === 4) { return cursor.getBlob(columnIndex); }
        return String(cursor.getString(columnIndex));
    }

    function queryAll(sql, args) {
        var cursor = null;
        var rows = [];
        var row;
        var count;
        var index;
        try {
            cursor = requireOpen().rawQuery(String(sql), toStringArray(args));
            count = Number(cursor.getColumnCount());
            while (cursor.moveToNext()) {
                row = {};
                for (index = 0; index < count; index += 1) {
                    row[String(cursor.getColumnName(index))] =
                        readCursorValue(cursor, index);
                }
                rows.push(row);
            }
            return rows;
        } finally {
            closeCursor(cursor);
        }
    }

    function queryOne(sql, args) {
        var rows = queryAll(sql, args);
        return rows.length > 0 ? rows[0] : null;
    }

    function runInTransaction(callback) {
        var db = requireOpen();
        var result;
        if (typeof callback !== "function") {
            throw new Error("Transaction callback must be a function");
        }
        db.beginTransaction();
        try {
            result = callback(db);
            db.setTransactionSuccessful();
            return result;
        } finally {
            db.endTransaction();
        }
    }

    function migrate() {
        var db = requireOpen();
        var current = Number(db.getVersion());
        var target;
        if (current > SCHEMA_VERSION) {
            throw new Error(
                "Database schema is newer than this build: " + current +
                " > " + SCHEMA_VERSION
            );
        }
        if (current === SCHEMA_VERSION) { return false; }
        runInTransaction(function () {
            for (target = current + 1; target <= SCHEMA_VERSION; target += 1) {
                if (typeof MIGRATIONS[target] !== "function") {
                    throw new Error("Missing database migration: " + target);
                }
                MIGRATIONS[target](db);
                db.setVersion(target);
            }
        });
        return true;
    }

    function openDatabase() {
        var file;
        if (path === null) {
            throw new Error("Database path is not initialized");
        }
        if (database !== null && database.isOpen()) { return database; }
        file = new File(path);
        database = SQLiteDatabase.openOrCreateDatabase(file, null);
        try {
            database.setForeignKeyConstraintsEnabled(true);
            migrate();
            return database;
        } catch (error) {
            try { database.close(); } catch (ignored) {}
            database = null;
            throw error;
        }
    }

    function closeDatabase() {
        if (database !== null) {
            try { database.close(); } catch (ignored) {}
        }
        database = null;
    }

    ClipHub.Database = {
        MODULE_NAME: "ch_03_database",
        MODULE_VERSION: 3,
        SCHEMA_VERSION: SCHEMA_VERSION,
        init: function (context) {
            var dir = ClipHub.Base.ensureDir(
                ClipHub.Base.joinPath(context.runtimeDir, "data")
            );
            path = String(new File(dir, "cliphub.db").getAbsolutePath());
            openDatabase();
            if (ClipHub.Log && typeof ClipHub.Log.info === "function") {
                ClipHub.Log.info(
                    "database ready schema=" + this.getVersion() +
                    " path=" + path
                );
            }
            return true;
        },
        open: openDatabase,
        close: closeDatabase,
        getPath: function () { return path; },
        getVersion: function () {
            return Number(requireOpen().getVersion());
        },
        isOpen: function () {
            return database !== null && database.isOpen();
        },
        transaction: runInTransaction,
        execute: function (sql, args) {
            return executeStatement(sql, args, "execute");
        },
        executeInsert: function (sql, args) {
            return executeStatement(sql, args, "insert");
        },
        executeUpdateDelete: function (sql, args) {
            return executeStatement(sql, args, "update");
        },
        queryAll: queryAll,
        queryOne: queryOne,
        scalarLong: function (sql, args, fallback) {
            var row = queryOne(sql, args);
            var key;
            if (row === null) { return fallback; }
            for (key in row) {
                if (row.hasOwnProperty(key)) { return Number(row[key]); }
            }
            return fallback;
        },
        shutdown: function () {
            closeDatabase();
            path = null;
            return true;
        }
    };
}((function () { return this; }())));
