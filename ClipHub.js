/*
 * ShortX 任务名称：ClipHub 剪贴板后台
 * 作用：启动并维持 ClipHub 后台实例，负责模块同步、完整性校验、
 * 数据库初始化和系统剪贴板监听；默认不显示悬浮窗。
 * 显示或隐藏悬浮窗请使用“ClipHub 剪贴板开关”任务。
 * 运行环境：Rhino ES5。
 */
(function (global) {
    var File = Packages.java.io.File;
    var FIS = Packages.java.io.FileInputStream;
    var FOS = Packages.java.io.FileOutputStream;
    var BAOS = Packages.java.io.ByteArrayOutputStream;
    var ReflectArray = Packages.java.lang.reflect.Array;
    var JavaByte = Packages.java.lang.Byte;
    var JavaString = Packages.java.lang.String;
    var URL = Packages.java.net.URL;
    var URLEncoder = Packages.java.net.URLEncoder;
    var MessageDigest = Packages.java.security.MessageDigest;
    var System = Packages.java.lang.System;
    var ENTRY_VERSION = 5;
    var OWNER = "7015725";
    var REPO = "ClipHub";
    var DEFAULT_REF = "agent/initialize-project-skeleton";
    var MANIFEST_PATH = "module-manifest.json";
    var NAMES = [
        "ch_01_base.js", "ch_02_log.js", "ch_03_database.js",
        "ch_04_clipboard.js", "ch_05_classifier.js",
        "ch_06_repository.js", "ch_07_theme.js", "ch_08_window.js",
        "ch_09_list.js", "ch_10_editor.js", "ch_11_filter.js",
        "ch_12_translation.js", "ch_13_settings.js",
        "ch_14_event_bus.js", "ch_15_app.js"
    ];

    function closeQuietly(value) {
        if (value !== null && value !== undefined) {
            try { value.close(); } catch (ignored) {}
        }
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

    function ensureDir(dir) {
        if (!dir.exists() && !dir.mkdirs() && !dir.isDirectory()) {
            throw new Error("Cannot create directory: " + dir.getAbsolutePath());
        }
        if (!dir.isDirectory()) {
            throw new Error("Not a directory: " + dir.getAbsolutePath());
        }
        return dir;
    }

    function readBytes(stream) {
        var output = new BAOS();
        var buffer = ReflectArray.newInstance(JavaByte.TYPE, 8192);
        var count;
        try {
            while ((count = stream.read(buffer)) >= 0) {
                if (count > 0) { output.write(buffer, 0, count); }
            }
            return output.toByteArray();
        } finally {
            closeQuietly(stream);
            closeQuietly(output);
        }
    }

    function readUtf8(file) {
        return String(new JavaString(readBytes(new FIS(file)), "UTF-8"));
    }

    function writeUtf8(file, text) {
        var stream = null;
        try {
            stream = new FOS(file, false);
            stream.write(new JavaString(String(text)).getBytes("UTF-8"));
            stream.flush();
        } finally { closeQuietly(stream); }
    }

    function writeAtomic(file, text) {
        var parent = ensureDir(file.getParentFile());
        var temp = new File(parent, file.getName() + ".tmp");
        writeUtf8(temp, text);
        if (file.exists() && !file.delete()) {
            temp.delete();
            throw new Error("Cannot replace: " + file.getAbsolutePath());
        }
        if (!temp.renameTo(file)) {
            temp.delete();
            throw new Error("Cannot commit: " + file.getAbsolutePath());
        }
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

    function encodeSegment(value) {
        return String(URLEncoder.encode(String(value), "UTF-8"))
            .replace(/\+/g, "%20");
    }

    function encodePath(path) {
        var parts = String(path).split("/");
        var result = [];
        var index;
        for (index = 0; index < parts.length; index += 1) {
            result.push(encodeSegment(parts[index]));
        }
        return result.join("/");
    }

    function rawUrl(path, ref) {
        return "https://raw.githubusercontent.com/" + OWNER + "/" + REPO +
            "/" + encodeSegment(ref) + "/" + encodePath(path) +
            "?cliphub=" + ENTRY_VERSION + "-" + Number(System.currentTimeMillis());
    }

    function fetchRawFile(path, ref) {
        var connection = null;
        var code;
        var bytes;
        var response;
        try {
            connection = new URL(rawUrl(path, ref)).openConnection();
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(20000);
            connection.setUseCaches(false);
            connection.setRequestProperty("Accept", "text/plain, */*");
            connection.setRequestProperty("Accept-Encoding", "identity");
            connection.setRequestProperty("Cache-Control", "no-cache");
            connection.setRequestProperty("Pragma", "no-cache");
            connection.setRequestProperty(
                "User-Agent", "ClipHub-ShortX/" + ENTRY_VERSION
            );
            code = Number(connection.getResponseCode());
            bytes = readBytes(code >= 200 && code < 300
                ? connection.getInputStream() : connection.getErrorStream());
            response = String(new JavaString(bytes, "UTF-8"));
            if (code < 200 || code >= 300) {
                throw new Error(
                    "Raw GitHub HTTP " + code + " for " + path + ": " +
                    response.substring(0, 400)
                );
            }
            return { text: response, transport: "raw" };
        } finally {
            if (connection !== null) {
                try { connection.disconnect(); } catch (ignored) {}
            }
        }
    }

    function gitBlobSha(text) {
        var content = new JavaString(String(text)).getBytes("UTF-8");
        var prefix = new JavaString(
            "blob " + String(content.length) + "\u0000"
        ).getBytes("UTF-8");
        var digest = MessageDigest.getInstance("SHA-1");
        var bytes;
        var parts = [];
        var index;
        var value;
        var hex;
        digest.update(prefix);
        digest.update(content);
        bytes = digest.digest();
        for (index = 0; index < bytes.length; index += 1) {
            value = Number(bytes[index]);
            if (value < 0) { value += 256; }
            hex = value.toString(16);
            parts.push(hex.length === 1 ? "0" + hex : hex);
        }
        return parts.join("");
    }

    function parseManifest(text, expectedRef) {
        var manifest = JSON.parse(String(text));
        var map = {};
        var index;
        var item;
        if (Number(manifest.schemaVersion) !== 1 ||
                !manifest.moduleSetVersion || !manifest.modules ||
                manifest.modules.length !== NAMES.length) {
            throw new Error("Invalid ClipHub module manifest");
        }
        if (manifest.entryMinVersion !== undefined &&
                Number(manifest.entryMinVersion) > ENTRY_VERSION) {
            throw new Error("ClipHub entry must be updated");
        }
        if (manifest.sourceRef !== undefined && expectedRef !== undefined &&
                String(manifest.sourceRef) !== String(expectedRef)) {
            throw new Error(
                "Manifest ref mismatch: " + manifest.sourceRef +
                " != " + expectedRef
            );
        }
        for (index = 0; index < manifest.modules.length; index += 1) {
            item = manifest.modules[index];
            if (!item || NAMES.indexOf(String(item.name)) < 0 ||
                    String(item.path) !== "src/" + String(item.name) ||
                    !/^[0-9a-f]{40}$/.test(String(item.sha)) ||
                    map[String(item.name)]) {
                throw new Error("Invalid manifest module at index " + index);
            }
            map[String(item.name)] = item;
        }
        for (index = 0; index < NAMES.length; index += 1) {
            if (!map[NAMES[index]]) {
                throw new Error("Missing manifest module: " + NAMES[index]);
            }
        }
        manifest.moduleMap = map;
        return manifest;
    }

    function manifestText(manifest) {
        return JSON.stringify(manifest, function (key, value) {
            return key === "moduleMap" ? undefined : value;
        }, 2) + "\n";
    }

    function verifyModules(moduleDir, manifest) {
        var index;
        var name;
        var file;
        if (!moduleDir.isDirectory() || !manifest || !manifest.moduleMap) {
            return false;
        }
        for (index = 0; index < NAMES.length; index += 1) {
            name = NAMES[index];
            file = new File(moduleDir, name);
            if (!file.isFile() ||
                    gitBlobSha(readUtf8(file)) !==
                    String(manifest.moduleMap[name].sha)) {
                return false;
            }
        }
        return true;
    }

    function readLocalManifest(file, ref) {
        try {
            return file.isFile() ? parseManifest(readUtf8(file), ref) : null;
        } catch (ignored) { return null; }
    }

    function installModules(ref, moduleDir, localManifestFile,
            remoteManifest, previousManifestText) {
        var parent = ensureDir(moduleDir.getParentFile());
        var stage = new File(parent, "modules.stage");
        var backup = new File(parent, "modules.backup");
        var index;
        var name;
        var item;
        var remote;
        var movedOld = false;
        var activated = false;
        removeTree(stage);
        removeTree(backup);
        ensureDir(stage);
        try {
            for (index = 0; index < NAMES.length; index += 1) {
                name = NAMES[index];
                item = remoteManifest.moduleMap[name];
                remote = fetchRawFile(String(item.path), ref);
                if (gitBlobSha(remote.text) !== String(item.sha)) {
                    throw new Error("Module integrity mismatch: " + name);
                }
                writeUtf8(new File(stage, name), remote.text);
            }
            if (!verifyModules(stage, remoteManifest)) {
                throw new Error("Downloaded module set verification failed");
            }
            if (moduleDir.exists()) {
                if (!moduleDir.renameTo(backup)) {
                    throw new Error("Cannot back up current modules");
                }
                movedOld = true;
            }
            if (!stage.renameTo(moduleDir)) {
                throw new Error("Cannot activate downloaded modules");
            }
            activated = true;
            writeAtomic(localManifestFile, manifestText(remoteManifest));
            return {
                updated: true,
                downloadedCount: NAMES.length,
                backup: backup,
                previousManifestText: previousManifestText,
                transport: "raw"
            };
        } catch (error) {
            removeTree(stage);
            if (activated) { removeTree(moduleDir); }
            if (movedOld && backup.exists()) { backup.renameTo(moduleDir); }
            if (previousManifestText === null) {
                if (localManifestFile.exists()) { localManifestFile.delete(); }
            } else {
                try { writeAtomic(localManifestFile, previousManifestText); }
                catch (ignored) {}
            }
            throw error;
        }
    }

    function syncModules(ref, moduleDir, localManifestFile) {
        var previousText = localManifestFile.isFile()
            ? readUtf8(localManifestFile) : null;
        var localManifest = readLocalManifest(localManifestFile, ref);
        var remoteManifest;
        var remoteFile;
        var installed;
        try {
            remoteFile = fetchRawFile(MANIFEST_PATH, ref);
            remoteManifest = parseManifest(remoteFile.text, ref);
        } catch (remoteError) {
            if (localManifest && verifyModules(moduleDir, localManifest)) {
                return {
                    updated: false,
                    downloadedCount: 0,
                    remoteAvailable: false,
                    fallback: true,
                    moduleSetVersion: String(localManifest.moduleSetVersion),
                    transport: "offline-cache",
                    warning: errorText(remoteError)
                };
            }
            throw remoteError;
        }
        if (verifyModules(moduleDir, remoteManifest)) {
            writeAtomic(localManifestFile, manifestText(remoteManifest));
            return {
                updated: false,
                downloadedCount: 0,
                remoteAvailable: true,
                fallback: false,
                moduleSetVersion: String(remoteManifest.moduleSetVersion),
                transport: "raw",
                warning: null
            };
        }
        try {
            installed = installModules(ref, moduleDir, localManifestFile,
                remoteManifest, previousText);
        } catch (installError) {
            if (localManifest && verifyModules(moduleDir, localManifest)) {
                return {
                    updated: false,
                    downloadedCount: 0,
                    remoteAvailable: true,
                    fallback: true,
                    moduleSetVersion: String(localManifest.moduleSetVersion),
                    transport: "offline-cache",
                    warning: errorText(installError)
                };
            }
            throw installError;
        }
        installed.remoteAvailable = true;
        installed.fallback = false;
        installed.moduleSetVersion = String(remoteManifest.moduleSetVersion);
        installed.warning = null;
        return installed;
    }

    function rollbackSync(moduleDir, localManifestFile, sync) {
        if (!sync || !sync.updated) { return; }
        removeTree(moduleDir);
        if (sync.backup && sync.backup.exists()) {
            sync.backup.renameTo(moduleDir);
        }
        if (sync.previousManifestText === null) {
            if (localManifestFile.exists()) { localManifestFile.delete(); }
        } else {
            writeAtomic(localManifestFile, sync.previousManifestText);
        }
    }

    function commitSync(sync) {
        if (sync && sync.backup) { removeTree(sync.backup); }
    }

    function loadModules(moduleDir) {
        var index;
        var file;
        global.ClipHub = {};
        for (index = 0; index < NAMES.length; index += 1) {
            file = new File(moduleDir, NAMES[index]);
            if (!file.isFile()) {
                throw new Error("Missing module: " + file.getAbsolutePath());
            }
            eval(readUtf8(file));
        }
    }

    function start() {
        var options = global.ClipHubBootstrapOptions || {};
        var root;
        var runtimeName;
        var runtimeDir;
        var moduleDir;
        var cacheDir;
        var localManifestFile;
        var ref;
        var sync = null;
        var app;
        var interruptedBackup;

        if (global.ClipHub && global.ClipHub.App &&
                typeof global.ClipHub.App.isStarted === "function" &&
                global.ClipHub.App.isStarted()) {
            return {
                ok: true,
                started: true,
                entryVersion: ENTRY_VERSION,
                reused: true,
                sync: null,
                app: { ok: true, started: true, reused: true }
            };
        }
        if (typeof shortx === "undefined" ||
                typeof shortx.getShortXDir !== "function") {
            throw new Error("ShortX runtime is unavailable");
        }
        root = String(shortx.getShortXDir());
        runtimeName = options.runtimeName === undefined
            ? "ClipHub" : String(options.runtimeName);
        if (!/^[A-Za-z0-9._-]+$/.test(runtimeName) ||
                runtimeName === "." || runtimeName === "..") {
            throw new Error("Invalid runtime name: " + runtimeName);
        }
        ref = options.remoteRef === undefined
            ? DEFAULT_REF : String(options.remoteRef);
        runtimeDir = ensureDir(new File(root, runtimeName));
        moduleDir = options.moduleDir === undefined
            ? new File(runtimeDir, "modules")
            : new File(String(options.moduleDir));
        cacheDir = ensureDir(new File(runtimeDir, "cache"));
        localManifestFile = new File(cacheDir, "module-manifest.local.json");
        ensureDir(moduleDir.getParentFile());
        if (!moduleDir.exists()) {
            interruptedBackup = new File(
                moduleDir.getParentFile(), "modules.backup"
            );
            if (interruptedBackup.isDirectory()) {
                interruptedBackup.renameTo(moduleDir);
            }
        }
        try {
            sync = syncModules(ref, moduleDir, localManifestFile);
            loadModules(moduleDir);
            app = global.ClipHub.App.start({
                shortxRoot: root,
                runtimeDir: String(runtimeDir.getAbsolutePath()),
                moduleDir: String(moduleDir.getAbsolutePath()),
                androidContext: global.context,
                entryVersion: ENTRY_VERSION,
                moduleSetVersion: String(sync.moduleSetVersion || ""),
                sourceRef: ref
            });
            commitSync(sync);
            return {
                ok: !!app.ok,
                started: !!app.started,
                entryVersion: ENTRY_VERSION,
                reused: false,
                sync: {
                    updated: !!sync.updated,
                    downloadedCount: Number(sync.downloadedCount || 0),
                    remoteAvailable: sync.remoteAvailable !== false,
                    fallback: !!sync.fallback,
                    moduleSetVersion: String(sync.moduleSetVersion || ""),
                    sourceRef: ref,
                    transport: String(sync.transport || "raw"),
                    warning: sync.warning === undefined ? null : sync.warning
                },
                app: app
            };
        } catch (error) {
            try { rollbackSync(moduleDir, localManifestFile, sync); }
            catch (ignored) {}
            throw error;
        }
    }

    try {
        global.ClipHubBootstrapResult = start();
    } catch (error) {
        global.ClipHubBootstrapResult = {
            ok: false,
            started: false,
            entryVersion: ENTRY_VERSION,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubBootstrapResult);
