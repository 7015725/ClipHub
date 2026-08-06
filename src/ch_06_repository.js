/*
 * ClipHub ch_06_repository.js staged loader.
 * Loads the frozen Stage 1 module from backup/cache or its pinned commit,
 * verifies the Git blob SHA, applies deterministic ES5 source patches,
 * then evaluates the patched module.
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

    var OWNER = "7015725";
    var REPO = "ClipHub";
    var BASE_COMMIT = "f097cc117a41aed6299f03fa569a36032bcfaaab";
    var BASE_PATH = "src/ch_06_repository.js";
    var BASE_BLOB_SHA = "a3fff931b15e0ac1a1cdd855ede69fb419486f0b";
    var CACHE_NAME = "ch_06_repository_stage1_base.js";
    var DEFAULT_RUNTIME_NAME = "ClipHub";

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
            throw new Error("Cannot create directory: " +
                String(dir.getAbsolutePath()));
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

    function writeUtf8Atomic(file, text) {
        var parent = ensureDir(file.getParentFile());
        var temp = new File(parent, file.getName() + ".tmp");
        var stream = null;
        try {
            stream = new FOS(temp, false);
            stream.write(new JavaString(String(text)).getBytes("UTF-8"));
            stream.flush();
        } finally {
            closeQuietly(stream);
        }
        if (file.exists() && !file.delete()) {
            temp.delete();
            throw new Error("Cannot replace cache: " +
                String(file.getAbsolutePath()));
        }
        if (!temp.renameTo(file)) {
            temp.delete();
            throw new Error("Cannot commit cache: " +
                String(file.getAbsolutePath()));
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

    function runtimeName() {
        var options = global.ClipHubBootstrapOptions || {};
        var name = options.runtimeName === undefined ?
            DEFAULT_RUNTIME_NAME : String(options.runtimeName);
        if (!/^[A-Za-z0-9._-]+$/.test(name) ||
                name === "." || name === "..") {
            throw new Error("Invalid runtime name: " + name);
        }
        return name;
    }

    function rawUrl() {
        return "https://raw.githubusercontent.com/" + OWNER + "/" + REPO +
            "/" + BASE_COMMIT + "/" +
            String(URLEncoder.encode(BASE_PATH, "UTF-8"))
                .replace(/%2F/g, "/").replace(/\+/g, "%20") +
            "?cliphubBase=" + Number(System.currentTimeMillis());
    }

    function fetchPinnedBase() {
        var connection = null;
        var code;
        var bytes;
        var text;
        try {
            connection = new URL(rawUrl()).openConnection();
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(30000);
            connection.setUseCaches(false);
            connection.setRequestProperty("Accept", "text/plain, */*");
            connection.setRequestProperty("Accept-Encoding", "identity");
            connection.setRequestProperty("Cache-Control", "no-cache");
            connection.setRequestProperty("Pragma", "no-cache");
            connection.setRequestProperty(
                "User-Agent", "ClipHub-Stage2-Loader/1"
            );
            code = Number(connection.getResponseCode());
            bytes = readBytes(code >= 200 && code < 300 ?
                connection.getInputStream() : connection.getErrorStream());
            text = String(new JavaString(bytes, "UTF-8"));
            if (code < 200 || code >= 300) {
                throw new Error("Pinned base HTTP " + code + ": " +
                    text.substring(0, 400));
            }
            return text;
        } finally {
            if (connection !== null) {
                try { connection.disconnect(); } catch (ignored) {}
            }
        }
    }

    function verifiedFileText(file) {
        var text;
        if (file === null || !file.isFile()) { return null; }
        try {
            text = readUtf8(file);
            return gitBlobSha(text) === BASE_BLOB_SHA ? text : null;
        } catch (ignored) { return null; }
    }

    function loadBaseSource() {
        var root;
        var runtimeDir;
        var backupFile;
        var cacheFile;
        var text;
        if (typeof shortx === "undefined" ||
                typeof shortx.getShortXDir !== "function") {
            throw new Error("ShortX runtime unavailable for staged loader");
        }
        root = new File(String(shortx.getShortXDir()));
        runtimeDir = new File(root, runtimeName());
        backupFile = new File(
            new File(runtimeDir, "modules.backup"), "ch_06_repository.js"
        );
        cacheFile = new File(
            ensureDir(new File(runtimeDir, "cache")), CACHE_NAME
        );

        text = verifiedFileText(backupFile);
        if (text !== null) {
            try { writeUtf8Atomic(cacheFile, text); } catch (ignoredCache) {}
            return text;
        }
        text = verifiedFileText(cacheFile);
        if (text !== null) { return text; }

        text = fetchPinnedBase();
        if (gitBlobSha(text) !== BASE_BLOB_SHA) {
            throw new Error("Pinned base integrity mismatch for " + BASE_PATH);
        }
        writeUtf8Atomic(cacheFile, text);
        return text;
    }

    function replaceOnce(source, item) {
        var index = source.indexOf(item.find);
        if (index < 0) {
            throw new Error("Stage 2 patch anchor missing: " + item.label);
        }
        if (source.indexOf(item.find, index + item.find.length) >= 0) {
            throw new Error("Stage 2 patch anchor is not unique: " +
                item.label);
        }
        return source.substring(0, index) + item.replace +
            source.substring(index + item.find.length);
    }

    function patchSource(source) {
        var patches = [

        ];
        var index;
        for (index = 0; index < patches.length; index += 1) {
            source = replaceOnce(source, patches[index]);
        }
        return source;
    }

    try {
        eval(patchSource(loadBaseSource()));
        if (!global.ClipHub || !global.ClipHub.Repository) {
            throw new Error("Repository module missing after base evaluation");
        }
        global.ClipHub.Repository.DEFAULT_PAGE_SIZE = 100;
        global.ClipHub.Repository.MODULE_VERSION = 15;
        global.ClipHub.Repository.PAGINATION_STAGE1_EXPORT_FIX = true;

    } catch (error) {
        throw new Error("ch_06_repository.js Stage 2 loader failed: " +
            errorText(error));
    }
}((function () { return this; }())));
