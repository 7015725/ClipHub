/*
 * ClipHub SQLite 探测 003
 *
 * 验证 Android 原生 SQLiteDatabase：
 * - 新建与重开数据库；
 * - schema version；
 * - 参数绑定插入；
 * - 事务提交与回滚；
 * - 查询、更新和删除；
 * - foreign key；
 * - integrity_check；
 * - 探测数据库清理。
 *
 * Rhino ES5 only.
 */
(function (global) {
    var File = Packages.java.io.File;
    var FileOutputStream = Packages.java.io.FileOutputStream;
    var OutputStreamWriter = Packages.java.io.OutputStreamWriter;
    var BufferedWriter = Packages.java.io.BufferedWriter;
    var SQLiteDatabase = Packages.android.database.sqlite.SQLiteDatabase;
    var System = Packages.java.lang.System;
    var Thread = Packages.java.lang.Thread;
    var SimpleDateFormat = Packages.java.text.SimpleDateFormat;
    var Locale = Packages.java.util.Locale;

    function now() { return Number(System.currentTimeMillis()); }

    function formatTimestamp(value) {
        return String(new SimpleDateFormat(
            "yyyyMMdd-HHmmss-SSS",
            Locale.US
        ).format(new Packages.java.util.Date(value)));
    }

    function ensureDir(dir) {
        if (!dir.exists() && !dir.mkdirs() && !dir.isDirectory()) {
            throw new Error("Cannot create directory: " + dir.getAbsolutePath());
        }
        if (!dir.isDirectory()) {
            throw new Error("Not a directory: " + dir.getAbsolutePath());
        }
        return dir;
    }

    function closeQuietly(value) {
        if (value !== null && value !== undefined) {
            try { value.close(); } catch (ignored) {}
        }
    }

    function writeUtf8(file, text) {
        var writer = null;
        try {
            writer = new BufferedWriter(new OutputStreamWriter(
                new FileOutputStream(file, false),
                "UTF-8"
            ));
            writer.write(String(text));
            writer.flush();
        } finally {
            closeQuietly(writer);
        }
    }

    function bind(statement, values) {
        var index;
        var value;
        for (index = 0; index < values.length; index += 1) {
            value = values[index];
            if (value === null || value === undefined) {
                statement.bindNull(index + 1);
            } else if (typeof value === "number") {
                statement.bindLong(index + 1, value);
            } else {
                statement.bindString(index + 1, String(value));
            }
        }
    }

    function executeInsert(db, sql, values) {
        var statement = null;
        try {
            statement = db.compileStatement(sql);
            bind(statement, values);
            return Number(statement.executeInsert());
        } finally {
            closeQuietly(statement);
        }
    }

    function executeUpdateDelete(db, sql, values) {
        var statement = null;
        try {
            statement = db.compileStatement(sql);
            bind(statement, values);
            return Number(statement.executeUpdateDelete());
        } finally {
            closeQuietly(statement);
        }
    }

    function scalarString(db, sql) {
        var cursor = null;
        try {
            cursor = db.rawQuery(sql, null);
            if (!cursor.moveToFirst()) { return null; }
            return String(cursor.getString(0));
        } finally {
            closeQuietly(cursor);
        }
    }

    function scalarLong(db, sql) {
        var cursor = null;
        try {
            cursor = db.rawQuery(sql, null);
            if (!cursor.moveToFirst()) { return 0; }
            return Number(cursor.getLong(0));
        } finally {
            closeQuietly(cursor);
        }
    }

    function deleteIfExists(file) {
        return !file.exists() || file.delete();
    }

    function main() {
        var startedAt = now();
        var root;
        var runtimeDir;
        var probeDir;
        var dbFile;
        var outputFile;
        var db = null;
        var committedId;
        var rollbackObserved = false;
        var result = {
            ok: false,
            probe: "cliphub_database_probe_003",
            probeVersion: 1,
            startedAt: startedAt,
            finishedAt: null,
            durationMs: null,
            pid: Number(Packages.android.os.Process.myPid()),
            uid: Number(Packages.android.os.Process.myUid()),
            threadId: Number(Thread.currentThread().getId()),
            threadName: String(Thread.currentThread().getName()),
            databasePath: null,
            opened: false,
            schemaVersion: null,
            foreignKeysEnabled: false,
            committedId: null,
            committedCount: null,
            rollbackObserved: false,
            updateCount: null,
            deleteCount: null,
            reopened: false,
            reopenedCount: null,
            integrityCheck: null,
            cleanup: null,
            outputPath: null,
            error: null
        };

        if (typeof shortx === "undefined" ||
                typeof shortx.getShortXDir !== "function") {
            throw new Error("ShortX runtime is unavailable");
        }

        root = String(shortx.getShortXDir());
        runtimeDir = ensureDir(new File(root, "ClipHub"));
        probeDir = ensureDir(new File(runtimeDir, "probes"));
        dbFile = new File(probeDir, "cliphub_database_probe_003.db");
        result.databasePath = String(dbFile.getAbsolutePath());

        deleteIfExists(dbFile);
        deleteIfExists(new File(result.databasePath + "-journal"));
        deleteIfExists(new File(result.databasePath + "-wal"));
        deleteIfExists(new File(result.databasePath + "-shm"));

        try {
            db = SQLiteDatabase.openOrCreateDatabase(dbFile, null);
            result.opened = db.isOpen();
            db.setForeignKeyConstraintsEnabled(true);
            result.foreignKeysEnabled = true;

            db.beginTransaction();
            try {
                db.execSQL(
                    "CREATE TABLE parent(" +
                    "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                    "value TEXT NOT NULL)"
                );
                db.execSQL(
                    "CREATE TABLE child(" +
                    "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                    "parent_id INTEGER NOT NULL," +
                    "FOREIGN KEY(parent_id) REFERENCES parent(id) " +
                    "ON DELETE CASCADE)"
                );
                db.setVersion(1);
                db.setTransactionSuccessful();
            } finally {
                db.endTransaction();
            }
            result.schemaVersion = Number(db.getVersion());

            db.beginTransaction();
            try {
                committedId = executeInsert(
                    db,
                    "INSERT INTO parent(value) VALUES (?)",
                    ["ClipHub 数据库探测 ✅"]
                );
                executeInsert(
                    db,
                    "INSERT INTO child(parent_id) VALUES (?)",
                    [committedId]
                );
                db.setTransactionSuccessful();
            } finally {
                db.endTransaction();
            }
            result.committedId = committedId;
            result.committedCount = scalarLong(db, "SELECT COUNT(*) FROM parent");

            try {
                db.beginTransaction();
                try {
                    executeInsert(
                        db,
                        "INSERT INTO parent(value) VALUES (?)",
                        ["must rollback"]
                    );
                    throw new Error("intentional rollback");
                } finally {
                    db.endTransaction();
                }
            } catch (expected) {
                rollbackObserved = scalarLong(
                    db,
                    "SELECT COUNT(*) FROM parent"
                ) === 1;
            }
            result.rollbackObserved = rollbackObserved;

            result.updateCount = executeUpdateDelete(
                db,
                "UPDATE parent SET value = ? WHERE id = ?",
                ["ClipHub 数据库更新 ✅", committedId]
            );
            result.deleteCount = executeUpdateDelete(
                db,
                "DELETE FROM parent WHERE id = ?",
                [committedId]
            );
            if (scalarLong(db, "SELECT COUNT(*) FROM child") !== 0) {
                throw new Error("Foreign key cascade did not delete child row");
            }

            executeInsert(
                db,
                "INSERT INTO parent(value) VALUES (?)",
                ["persist after reopen"]
            );
            closeQuietly(db);
            db = null;

            db = SQLiteDatabase.openOrCreateDatabase(dbFile, null);
            result.reopened = db.isOpen();
            result.reopenedCount = scalarLong(db, "SELECT COUNT(*) FROM parent");
            result.integrityCheck = scalarString(db, "PRAGMA integrity_check");

            result.ok = result.opened &&
                result.schemaVersion === 1 &&
                result.foreignKeysEnabled &&
                result.committedId > 0 &&
                result.committedCount === 1 &&
                result.rollbackObserved &&
                result.updateCount === 1 &&
                result.deleteCount === 1 &&
                result.reopened &&
                result.reopenedCount === 1 &&
                result.integrityCheck === "ok";
        } catch (error) {
            result.error = String(error);
        } finally {
            closeQuietly(db);
            result.cleanup = {
                database: deleteIfExists(dbFile),
                journal: deleteIfExists(new File(result.databasePath + "-journal")),
                wal: deleteIfExists(new File(result.databasePath + "-wal")),
                shm: deleteIfExists(new File(result.databasePath + "-shm"))
            };
        }

        result.finishedAt = now();
        result.durationMs = result.finishedAt - result.startedAt;
        outputFile = new File(
            probeDir,
            "cliphub_database_probe_003_" +
                formatTimestamp(result.startedAt) + ".json"
        );
        result.outputPath = String(outputFile.getAbsolutePath());
        writeUtf8(outputFile, JSON.stringify(result, null, 2) + "\n");
        return result;
    }

    try {
        global.ClipHubDatabaseProbe003Result = main();
    } catch (error) {
        global.ClipHubDatabaseProbe003Result = {
            ok: false,
            probe: "cliphub_database_probe_003",
            fatal: true,
            error: String(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubDatabaseProbe003Result);
