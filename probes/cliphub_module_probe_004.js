/* ClipHub real module probe 004. Rhino ES5 only. */
(function (global) {
    var File = Packages.java.io.File;
    var FIS = Packages.java.io.FileInputStream;
    var ISR = Packages.java.io.InputStreamReader;
    var BR = Packages.java.io.BufferedReader;
    var SB = Packages.java.lang.StringBuilder;
    var FOS = Packages.java.io.FileOutputStream;
    var OSW = Packages.java.io.OutputStreamWriter;
    var BW = Packages.java.io.BufferedWriter;
    var System = Packages.java.lang.System;
    var Thread = Packages.java.lang.Thread;
    var SDF = Packages.java.text.SimpleDateFormat;
    var Locale = Packages.java.util.Locale;
    var RUNTIME_NAME = "ClipHubProbe004";

    function now() { return Number(System.currentTimeMillis()); }
    function stamp(value) {
        return String(new SDF("yyyyMMdd-HHmmss-SSS", Locale.US)
            .format(new Packages.java.util.Date(value)));
    }
    function errorText(error) {
        try {
            if (error && error.javaException) {
                return String(error.javaException.getClass().getName()) +
                    ": " + String(error);
            }
        } catch (ignored) {}
        return String(error);
    }
    function closeQuietly(value) {
        if (value !== null && value !== undefined) {
            try { value.close(); } catch (ignored) {}
        }
    }
    function ensureDir(dir) {
        if (!dir.exists() && !dir.mkdirs() && !dir.isDirectory()) {
            throw new Error("Cannot create directory: " + dir.getAbsolutePath());
        }
        return dir;
    }
    function readUtf8(file) {
        var reader = null;
        var builder = new SB();
        var line;
        try {
            reader = new BR(new ISR(new FIS(file), "UTF-8"));
            while ((line = reader.readLine()) !== null) {
                builder.append(line).append("\n");
            }
            return String(builder.toString());
        } finally { closeQuietly(reader); }
    }
    function writeUtf8(file, text) {
        var writer = null;
        try {
            writer = new BW(new OSW(new FOS(file, false), "UTF-8"));
            writer.write(String(text));
            writer.flush();
        } finally { closeQuietly(writer); }
    }
    function removeTree(file) {
        var children;
        var index;
        var ok = true;
        if (!file.exists()) { return true; }
        if (file.isDirectory()) {
            children = file.listFiles();
            if (children !== null) {
                for (index = 0; index < children.length; index += 1) {
                    if (!removeTree(children[index])) { ok = false; }
                }
            }
        }
        if (file.exists() && !file.delete()) { ok = false; }
        return ok;
    }
    function moduleCount(dir) {
        var files = dir.listFiles();
        var index;
        var count = 0;
        if (files === null) { return 0; }
        for (index = 0; index < files.length; index += 1) {
            if (files[index].isFile() && /\.js$/.test(String(files[index].getName()))) {
                count += 1;
            }
        }
        return count;
    }
    function runEntry(entry, modules) {
        global.ClipHub = null;
        global.ClipHubBootstrapResult = null;
        global.ClipHubBootstrapOptions = {
            runtimeName: RUNTIME_NAME,
            moduleDir: String(modules.getAbsolutePath())
        };
        eval(readUtf8(entry));
        return global.ClipHubBootstrapResult;
    }

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var installed = new File(root, "ClipHub");
        var entry = new File(installed, "ClipHub.js");
        var modules = new File(installed, "modules");
        var isolated = new File(root, RUNTIME_NAME);
        var reports = ensureDir(new File(installed, "probes"));
        var output = new File(reports,
            "cliphub_module_probe_004_" + stamp(startedAt) + ".json");
        var result = {
            ok: false,
            probe: "cliphub_module_probe_004",
            probeVersion: 1,
            startedAt: startedAt,
            finishedAt: null,
            durationMs: null,
            pid: Number(Packages.android.os.Process.myPid()),
            uid: Number(Packages.android.os.Process.myUid()),
            threadId: Number(Thread.currentThread().getId()),
            threadName: String(Thread.currentThread().getName()),
            installedModuleCount: 0,
            firstStart: null,
            schemaVersion: null,
            isolatedDatabase: false,
            insertedId: null,
            contentRoundTrip: false,
            hashLength: null,
            updateApplied: false,
            tagLinkCount: null,
            rollbackObserved: false,
            deleteCounts: null,
            restoreCount: null,
            detachCount: null,
            stopped: false,
            databaseClosed: false,
            secondStart: null,
            secondStartCount: null,
            secondStop: false,
            cleanup: false,
            outputPath: String(output.getAbsolutePath()),
            error: null
        };
        var boot;
        var db;
        var repo;
        var app;
        var id;
        var tagId;
        var row;
        var firstHash;
        var before;
        var rollbackErrorSeen = false;
        var original = "ClipHub 真实模块测试 😀\nhttps://example.com/004";
        var updated = "ClipHub 更新测试 ✅";

        if (!entry.isFile()) { throw new Error("Missing installed ClipHub.js"); }
        result.installedModuleCount = moduleCount(modules);
        if (result.installedModuleCount !== 15) {
            throw new Error("Installed module count must be 15");
        }
        removeTree(isolated);

        try {
            boot = runEntry(entry, modules);
            result.firstStart = boot;
            if (!boot || !boot.ok || !boot.started) {
                throw new Error("First start failed: " + JSON.stringify(boot));
            }
            app = global.ClipHub.App;
            db = global.ClipHub.Database;
            repo = global.ClipHub.Repository;
            result.schemaVersion = db.getVersion();
            result.isolatedDatabase = String(db.getPath()).indexOf(
                String(isolated.getAbsolutePath())) === 0;

            id = repo.insertItem({
                content: original,
                sourcePackage: "cliphub.probe004",
                sourceLabel: "Probe 004",
                sourceUid: result.uid,
                sourceConfidence: 100,
                manualOrder: 1000
            });
            result.insertedId = id;
            row = repo.getItem(id, true);
            result.contentRoundTrip = row !== null && String(row.content) === original;
            firstHash = row === null ? "" : String(row.normalized_hash);
            result.hashLength = firstHash.length;

            repo.updateItem(id, {
                content: updated,
                is_pinned: 1,
                manual_order: 100,
                copy_count: 2
            });
            row = repo.getItem(id, true);
            result.updateApplied = row !== null &&
                String(row.content) === updated &&
                String(row.normalized_hash) !== firstHash &&
                Number(row.is_pinned) === 1 &&
                Number(row.copy_count) === 2;

            tagId = repo.insertTag({name: "探测004", manualOrder: 1000});
            repo.attachTag(id, tagId);
            result.tagLinkCount = db.scalarLong(
                "SELECT COUNT(*) AS count FROM clipboard_item_tags " +
                "WHERE item_id = ? AND tag_id = ?", [id, tagId], -1);

            before = repo.countItems(true);
            try {
                db.transaction(function () {
                    repo.insertItem({content: "probe004 rollback"});
                    throw new Error("expected probe004 rollback");
                });
            } catch (rollbackError) {
                rollbackErrorSeen = errorText(rollbackError)
                    .indexOf("expected probe004 rollback") >= 0;
            }
            result.rollbackObserved = rollbackErrorSeen &&
                repo.countItems(true) === before;

            repo.softDeleteItem(id);
            result.deleteCounts = {
                active: repo.countItems(false),
                total: repo.countItems(true)
            };
            repo.restoreItem(id);
            result.restoreCount = repo.countItems(false);
            repo.detachTag(id, tagId);
            result.detachCount = db.scalarLong(
                "SELECT COUNT(*) AS count FROM clipboard_item_tags " +
                "WHERE item_id = ? AND tag_id = ?", [id, tagId], -1);

            result.stopped = app.stop().stopped === true;
            result.databaseClosed = !db.isOpen();
            boot = runEntry(entry, modules);
            result.secondStart = boot;
            if (!boot || !boot.ok || !boot.started) {
                throw new Error("Second start failed: " + JSON.stringify(boot));
            }
            result.secondStartCount = global.ClipHub.Repository.countItems(true);
            result.secondStop = global.ClipHub.App.stop().stopped === true;

            result.ok = result.schemaVersion === 1 &&
                result.isolatedDatabase && result.insertedId > 0 &&
                result.contentRoundTrip && result.hashLength === 64 &&
                result.updateApplied && result.tagLinkCount === 1 &&
                result.rollbackObserved && result.deleteCounts.active === 0 &&
                result.deleteCounts.total === 1 && result.restoreCount === 1 &&
                result.detachCount === 0 && result.stopped &&
                result.databaseClosed && result.secondStartCount === 1 &&
                result.secondStop;
        } catch (error) {
            result.error = errorText(error);
            try {
                if (global.ClipHub && global.ClipHub.App) {
                    global.ClipHub.App.stop();
                }
            } catch (ignored3) {}
        } finally {
            global.ClipHubBootstrapOptions = null;
            result.cleanup = removeTree(isolated);
            result.finishedAt = now();
            result.durationMs = result.finishedAt - result.startedAt;
            writeUtf8(output, JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try {
        global.ClipHubModuleProbe004Result = main();
    } catch (error) {
        global.ClipHubModuleProbe004Result = {
            ok: false,
            probe: "cliphub_module_probe_004",
            fatal: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubModuleProbe004Result);
