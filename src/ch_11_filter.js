/* ClipHub Stage 11.1 async hydration worker ES5 loader. */
(function (global) {
    var File = Packages.java.io.File;
    var FIS = Packages.java.io.FileInputStream;
    var FOS = Packages.java.io.FileOutputStream;
    var BAIS = Packages.java.io.ByteArrayInputStream;
    var BAOS = Packages.java.io.ByteArrayOutputStream;
    var GZIPInputStream = Packages.java.util.zip.GZIPInputStream;
    var Base64 = Packages.android.util.Base64;
    var ReflectArray = Packages.java.lang.reflect.Array;
    var JavaByte = Packages.java.lang.Byte;
    var JavaString = Packages.java.lang.String;
    var URL = Packages.java.net.URL;
    var URLEncoder = Packages.java.net.URLEncoder;
    var MessageDigest = Packages.java.security.MessageDigest;
    var System = Packages.java.lang.System;

    var REF = "agent/beta-list-preview-on-demand-20260808";
    var PARTS = [
        "stage-assets/pagination-stage9/ch11_full_v5_00.b64",
        "stage-assets/pagination-stage9/ch11_full_v5_01.b64",
        "stage-assets/pagination-stage9/ch11_full_v5_02.b64",
        "stage-assets/pagination-stage9/ch11_full_v5_03.b64",
        "stage-assets/pagination-stage9/ch11_full_v5_04.b64",
        "stage-assets/pagination-stage9/ch11_full_v5_05.b64",
        "stage-assets/pagination-stage9/ch11_full_v5_06.b64",
        "stage-assets/pagination-stage9/ch11_full_v5_07.b64"
    ];
    var PACKED_SHA256 =
        "15ad7ac4df8b4b1ecb9491ceb547da9d865d4474b8493e7e7b2b46e12909e6c5";
    var SOURCE_SHA256 =
        "605fdf2bc41d4db6a2ac4deacd060e0a331043fb205e7eef1b45c67f4973da7e";
    var CACHE_NAME = "ch_11_filter_stage11_1_v5_full.b64";

    function closeQuietly(value) {
        if (value !== null && value !== undefined) {
            try { value.close(); } catch (ignored) {}
        }
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
        return String(new JavaString(
            readBytes(new FIS(file)), "UTF-8"));
    }

    function ensureDir(dir) {
        if (!dir.exists() && !dir.mkdirs() && !dir.isDirectory()) {
            throw new Error("Cannot create directory: " +
                String(dir.getAbsolutePath()));
        }
        return dir;
    }

    function writeUtf8Atomic(file, text) {
        var parent = ensureDir(file.getParentFile());
        var temp = new File(parent, file.getName() + ".tmp");
        var output = null;
        try {
            output = new FOS(temp, false);
            output.write(new JavaString(String(text))
                .getBytes("UTF-8"));
            output.flush();
        } finally {
            closeQuietly(output);
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

    function sha256(text) {
        var digest = MessageDigest.getInstance("SHA-256");
        var bytes = digest.digest(new JavaString(String(text))
            .getBytes("UTF-8"));
        var parts = [];
        var index;
        var value;
        for (index = 0; index < bytes.length; index += 1) {
            value = Number(bytes[index]);
            if (value < 0) { value += 256; }
            parts.push((value < 16 ? "0" : "") +
                value.toString(16));
        }
        return parts.join("");
    }

    function runtimeName() {
        var options = global.ClipHubBootstrapOptions || {};
        var name = options.runtimeName === undefined ?
            "ClipHub" : String(options.runtimeName);
        if (!/^[A-Za-z0-9._-]+$/.test(name) ||
                name === "." || name === "..") {
            throw new Error("Invalid runtime name: " + name);
        }
        return name;
    }

    function encodePath(path) {
        return String(URLEncoder.encode(String(path), "UTF-8"))
            .replace(/%2F/g, "/").replace(/\+/g, "%20");
    }

    function fetchPart(path) {
        var connection = null;
        var code;
        var text;
        try {
            connection = new URL(
                "https://raw.githubusercontent.com/7015725/ClipHub/" +
                encodePath(REF) + "/" + encodePath(path) +
                "?stage11_1v5=" + Number(System.currentTimeMillis())
            ).openConnection();
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(30000);
            connection.setUseCaches(false);
            connection.setRequestProperty("Accept-Encoding", "identity");
            code = Number(connection.getResponseCode());
            text = String(new JavaString(readBytes(
                code >= 200 && code < 300 ?
                    connection.getInputStream() :
                    connection.getErrorStream()), "UTF-8"));
            if (code < 200 || code >= 300) {
                throw new Error("HTTP " + code + " " + path);
            }
            return text;
        } finally {
            if (connection !== null) {
                try { connection.disconnect(); } catch (ignored) {}
            }
        }
    }

    function loadPackedSource() {
        var root;
        var runtimeDir;
        var cacheFile;
        var packed = "";
        var index;
        if (typeof shortx === "undefined" ||
                typeof shortx.getShortXDir !== "function") {
            throw new Error("ShortX runtime unavailable");
        }
        root = new File(String(shortx.getShortXDir()));
        runtimeDir = new File(root, runtimeName());
        cacheFile = new File(
            ensureDir(new File(runtimeDir, "cache")), CACHE_NAME);
        if (cacheFile.isFile()) {
            try {
                packed = readUtf8(cacheFile).replace(/\s+/g, "");
                if (sha256(packed) === PACKED_SHA256) {
                    return packed;
                }
            } catch (ignoredCache) {}
        }
        packed = "";
        for (index = 0; index < PARTS.length; index += 1) {
            packed += fetchPart(PARTS[index]);
        }
        packed = packed.replace(/\s+/g, "");
        if (sha256(packed) !== PACKED_SHA256) {
            throw new Error("Stage 11.1 packed source SHA-256 mismatch");
        }
        writeUtf8Atomic(cacheFile, packed);
        return packed;
    }

    function decodeSource(packed) {
        var input = new GZIPInputStream(new BAIS(
            Base64.decode(String(packed), Base64.DEFAULT)));
        var source = String(new JavaString(
            readBytes(input), "UTF-8"));
        if (sha256(source) !== SOURCE_SHA256) {
            throw new Error("Stage 11.1 source SHA-256 mismatch");
        }
        return source;
    }

    try {
        eval(decodeSource(loadPackedSource()));
    } catch (error) {
        throw new Error("ch_11_filter.js Stage 11.1 loader failed: " +
            String(error));
    }
}((function () { return this; }())));
