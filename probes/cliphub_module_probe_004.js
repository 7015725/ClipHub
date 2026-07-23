/* ClipHub downloaded real module probe 004. Rhino ES5 only. */
(function (global) {
    var File = Packages.java.io.File;
    var FIS = Packages.java.io.FileInputStream;
    var FOS = Packages.java.io.FileOutputStream;
    var OSW = Packages.java.io.OutputStreamWriter;
    var BW = Packages.java.io.BufferedWriter;
    var BAOS = Packages.java.io.ByteArrayOutputStream;
    var ReflectArray = Packages.java.lang.reflect.Array;
    var JavaByte = Packages.java.lang.Byte;
    var JavaString = Packages.java.lang.String;
    var MessageDigest = Packages.java.security.MessageDigest;
    var System = Packages.java.lang.System;
    var Thread = Packages.java.lang.Thread;
    var SDF = Packages.java.text.SimpleDateFormat;
    var Locale = Packages.java.util.Locale;
    var RUNTIME_NAME = "ClipHubProbe004";
    var NAMES = [
        "ch_01_base.js", "ch_02_log.js", "ch_03_database.js",
        "ch_04_clipboard.js", "ch_05_classifier.js",
        "ch_06_repository.js", "ch_07_theme.js", "ch_08_window.js",
        "ch_09_list.js", "ch_10_editor.js", "ch_11_filter.js",
        "ch_12_translation.js", "ch_13_settings.js",
        "ch_14_event_bus.js", "ch_15_app.js"
    ];

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
        if (!dir.isDirectory()) {
            throw new Error("Not a directory: " + dir.getAbsolutePath());
        }
        return dir;
    }

    function readUtf8(file) {
        var stream = null;
        var output = new BAOS();
        var buffer = ReflectArray.newInstance(JavaByte.TYPE, 8192);
        var count;
        try {
            stream = new FIS(file);
            while ((count = stream.read(buffer)) >= 0) {
                if (count > 0) { output.write(buffer, 0, count); }
            }
            return String(new JavaString(output.toByteArray(), "UTF-8"));
        } finally {
            closeQuietly(stream);
            closeQuietly(output);
        }
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

    function gitBlobSha(text) {
        var contentBytes = new JavaString(String(text)).getBytes("UTF-8");
        var prefixBytes = new JavaString(
            "blob " + String(contentBytes.length) + "\u0000"
        ).getBytes("UTF-8");
        var digest = MessageDigest.getInstance("SHA-1");
        var output;
        var index;
        var value;
        var hex;
        var parts = [];
        digest.update(prefixBytes);
        digest.update(contentBytes);
        output = digest.digest();
        for (index = 0; index < output.length; index += 1) {
            value = Number(output[index]);
            if (value < 0) { value += 256; }
            hex = value.toString(16);
            parts.push(hex.length === 1 ? "0" + hex : hex);
        }
        return parts.join("");
    }

    function manifestMap(manifest) {
        var map = {};
        var index;
        var item;
        if (!manifest || Number(manifest.schemaVersion) !== 1 ||
                !manifest.moduleSetVersion || !manifest.modules ||
                manifest.modules.length !== NAMES.length) {
            throw new Error("Invalid local module manifest");
        }
        for (index = 0; index < manifest.modules.length; index += 1) {
            item = manifest.modules[index];
            if (!item || NAMES.indexOf(String(item.name)) < 0 ||
                    !/^[0-9a-f]{40}$/.test(String(item.sha))) {
                throw new Error("Invalid local manifest module at " + index);
            }
            map[String(item.name)] = item;
        }
        return map;
    }

    function verifyDownloadedModules(moduleDir, manifest) {
        var map = manifestMap(manifest);
        var index;
        var name;
        var file;
        for (index = 0; index < NAMES.length; index += 1) {
            name = NAMES[index];
            file = new File(moduleDir, name);
            if (!file.isFile() || !map[name] ||
                    gitBlobSha(readUtf8(file)) !== String(map[name].sha)) {
                return false;
            }
        }
        return true;
    }

    function loadModules(moduleDir) {
        var index;
        var file;
        global.ClipHub = {};
        for (index = 0; index < NAMES.length; index += 1) {
            file = new File(moduleDir, NAMES[index]);
            if (!file.isFile()) {
                throw new Error("Missing downloaded module: " +
                    file.getAbsolutePath());
            }
            eval(readUtf8(file));
        }
    }

    function startIsolated(root, moduleDir) {
        var runtimeDir = new File(root, RUNTIME_NAME);
        return global.ClipHub.App.start({
            shortxRoot: root,
            runtimeDir: String(runtimeDir.getAbsolutePath()),
            moduleDir: String(moduleDir.getAbsolutePath())
        });
    }

    function main() {
        var startedAt = now();
        var root = String(shortx.getShortXDir());
        var installed = new File(root, "ClipHub");
        var modules = new File(installed, "modules");
        var localManifestFile = new File(
            new File(installed, "cache"), "module-manifest.local.json"
        );
        var isolated = new File(root, RUNTIME_NAME);
        var reports = ensureDir(new File(installed, "probes"));
        var output = new File(reports,
            "cliphub_module_probe_004_" + stamp(startedAt) + ".json");
        var result = {
            ok: false,
            probe: "cliphub_module_probe_004",
            probeVersion: 2,
            startedAt: startedAt,
            finishedAt: null,
            durationMs: null,
            pid: Number(Packages.android.os.Process.myPid()),
            uid: Number(Packages.android.os.Process.myUid()),
            threadId: Number(Thread.currentThread().getId()),
            threadName: String(Thread.currentThread().getName()),
            localManifestPresent: false,
            moduleSetVersion: null,
            sourceRef: null,
            installedModuleCount: 0,
            moduleHashesValid: false,
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
        var manifest;
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
        var original = "ClipHub 入口下载模块测试 😀\nhttps://example.com/004";
        var updated = "ClipHub 更新测试 ✅";

        if (!localManifestFile.isFile()) {
            throw new Error(
                "Local module manifest is missing; execute ClipHub.js in ShortX first"
            );
        }
        manifest = JSON.parse(readUtf8(localManifestFile));
        result.localManifestPresent = true;
        result.moduleSetVersion = String(manifest.moduleSetVersion || "");
        result.sourceRef = String(manifest.sourceRef || "");
        result.installedModuleCount = manifest.modules
            ? Number(manifest.modules.length) : 0;
        result.moduleHashesValid = verifyDownloadedModules(modules, manifest);
        if (result.installedModuleCount !== 15 || !result.moduleHashesValid) {
            throw new Error("Downloaded ClipHub module set is incomplete or invalid");
        }
        removeTree(isolated);

        try {
            loadModules(modules);
            boot = startIsolated(root, modules);
            result.firstStart = boot;
            if (!boot || !boot.ok || !boot.started) {
                throw new Error("First isolated start failed: " + JSON.stringify(boot));
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
            result.contentRoundTrip = row !== null &&
                String(row.content) === original;
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
            boot = startIsolated(root, modules);
            result.secondStart = boot;
            if (!boot || !boot.ok || !boot.started) {
                throw new Error("Second isolated start failed: " +
                    JSON.stringify(boot));
            }
            result.secondStartCount = global.ClipHub.Repository.countItems(true);
            result.secondStop = global.ClipHub.App.stop().stopped === true;

            result.ok = result.localManifestPresent &&
                result.installedModuleCount === 15 && result.moduleHashesValid &&
                result.schemaVersion === 1 && result.isolatedDatabase &&
                result.insertedId > 0 && result.contentRoundTrip &&
                result.hashLength === 64 && result.updateApplied &&
                result.tagLinkCount === 1 && result.rollbackObserved &&
                result.deleteCounts.active === 0 &&
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
            } catch (ignored2) {}
        } finally {
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
            probeVersion: 2,
            fatal: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubModuleProbe004Result);
