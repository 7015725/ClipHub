(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var File = Packages.java.io.File;
    var FIS = Packages.java.io.FileInputStream;
    var FOS = Packages.java.io.FileOutputStream;
    var BAOS = Packages.java.io.ByteArrayOutputStream;
    var ReflectArray = Packages.java.lang.reflect.Array;
    var JavaByte = Packages.java.lang.Byte;
    var JavaString = Packages.java.lang.String;
    var URL = Packages.java.net.URL;
    var MessageDigest = Packages.java.security.MessageDigest;
    var System = Packages.java.lang.System;

    var COMPACT_COMMIT = "84a008ada8f681c16a7326fded0bd07d06fc8029";
    var COMPACT_BLOB = "06e62539e5f9a0af0067840d927a0cbec679eead";
    var STABLE_COMMIT = "16052f67dbd0323fbe0b203ec64fe11c08a41308";
    var STABLE_BLOB = "42457aa526a2fac000a482c914194332a19fa743";
    var CACHE_VERSION = "v29";
    var SOURCE_PATH = "src/ch_11_filter.js";

    var options = global.ClipHubBootstrapOptions || {};
    var runtimeName = options.runtimeName === undefined ?
        "ClipHub" : String(options.runtimeName);
    var shortxRoot = String(shortx.getShortXDir());
    var runtimeDir = new File(shortxRoot, runtimeName);
    var cacheDir = new File(runtimeDir, "cache");
    var compactCache = new File(cacheDir,
        "ch_11_filter_compact_" + CACHE_VERSION + ".js");
    var stableCache = new File(cacheDir,
        "ch_11_filter_stable_fallback.js");
    var pendingFile = new File(cacheDir,
        "ch_11_filter_compact_" + CACHE_VERSION + ".pending");
    var disabledFile = new File(cacheDir,
        "ch_11_filter_compact_" + CACHE_VERSION + ".disabled");
    var failureFile = new File(cacheDir,
        "ch_11_filter_compact_" + CACHE_VERSION + ".failure.txt");

    function closeQuietly(value) {
        if (value !== null && value !== undefined) {
            try { value.close(); } catch (ignored) {}
        }
    }

    function ensureDir(dir) {
        if (!dir.exists() && !dir.mkdirs() && !dir.isDirectory()) {
            throw new Error("Cannot create directory: " +
                dir.getAbsolutePath());
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
        ensureDir(file.getParentFile());
        try {
            stream = new FOS(file, false);
            stream.write(new JavaString(String(text)).getBytes("UTF-8"));
            stream.flush();
        } finally {
            closeQuietly(stream);
        }
    }

    function writeMarker(file, text) {
        try {
            writeUtf8(file, String(text || "") + "\n");
            return true;
        } catch (ignored) {
            return false;
        }
    }

    function deleteQuietly(file) {
        try {
            return !file.exists() || file.delete();
        } catch (ignored) {
            return false;
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

    function gitBlobSha(text) {
        var content = new JavaString(String(text)).getBytes("UTF-8");
        var prefix = new JavaString(
            "blob " + String(content.length) + "\u0000"
        ).getBytes("UTF-8");
        var digest = MessageDigest.getInstance("SHA-1");
        var bytes;
        var output = [];
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
            output.push(hex.length === 1 ? "0" + hex : hex);
        }
        return output.join("");
    }

    function rawUrl(commit) {
        return "https://raw.githubusercontent.com/7015725/ClipHub/" +
            String(commit) + "/" + SOURCE_PATH +
            "?cliphub-filter-loader=" + CACHE_VERSION + "-" +
            Number(System.currentTimeMillis());
    }

    function fetchSource(commit) {
        var connection = null;
        var code;
        var bytes;
        var text;
        try {
            connection = new URL(rawUrl(commit)).openConnection();
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(20000);
            connection.setUseCaches(false);
            connection.setRequestProperty("Accept", "text/plain, */*");
            connection.setRequestProperty("Accept-Encoding", "identity");
            connection.setRequestProperty("Cache-Control", "no-cache");
            connection.setRequestProperty("Pragma", "no-cache");
            connection.setRequestProperty(
                "User-Agent", "ClipHub-Filter-Recovery/" + CACHE_VERSION);
            code = Number(connection.getResponseCode());
            bytes = readBytes(code >= 200 && code < 300 ?
                connection.getInputStream() : connection.getErrorStream());
            text = String(new JavaString(bytes, "UTF-8"));
            if (code < 200 || code >= 300) {
                throw new Error("Raw GitHub HTTP " + code + ": " +
                    text.substring(0, 240));
            }
            return text;
        } finally {
            if (connection !== null) {
                try { connection.disconnect(); } catch (ignored) {}
            }
        }
    }

    function requireBlob(text, expected, label) {
        var actual = gitBlobSha(text);
        if (actual !== String(expected)) {
            throw new Error(label + " blob mismatch: " + actual +
                " != " + expected);
        }
        return text;
    }

    function readVerified(file, expected, label) {
        var text;
        if (!file.isFile()) { return null; }
        try {
            text = readUtf8(file);
            return requireBlob(text, expected, label);
        } catch (ignored) {
            deleteQuietly(file);
            return null;
        }
    }

    function patchCompactSource(source) {
        var oldProbe =
            "            advancedButtonText: advancedView !== null ?\n" +
            "                String(advancedView.getText()) : \"\",\n";
        var newProbe =
            "            advancedButtonText: advancedView !== null ?\n" +
            "                (activeAdvancedFilterCount() > 0 ?\n" +
            "                    \"筛选(\" + String(activeAdvancedFilterCount()) + \")\" :\n" +
            "                    \"筛选\") : \"\",\n";
        var oldVersion = "        MODULE_VERSION: 28,\n";
        var newVersion = "        MODULE_VERSION: 29,\n";
        var first;
        var second;

        requireBlob(source, COMPACT_BLOB, "compact source");
        first = source.indexOf(oldProbe);
        if (first < 0 || source.indexOf(oldProbe,
                first + oldProbe.length) >= 0) {
            throw new Error("Compact state probe contract site mismatch");
        }
        source = source.substring(0, first) + newProbe +
            source.substring(first + oldProbe.length);

        second = source.indexOf(oldVersion);
        if (second < 0 || source.indexOf(oldVersion,
                second + oldVersion.length) >= 0) {
            throw new Error("Compact module version site mismatch");
        }
        source = source.substring(0, second) + newVersion +
            source.substring(second + oldVersion.length);

        if (source.indexOf("advancedView.getText()") >= 0 ||
                source.indexOf("MODULE_VERSION: 29") < 0 ||
                source.indexOf("advancedView = statusFilter;") < 0 ||
                source.indexOf(
                    "reference_search_v12_compact_header") < 0) {
            throw new Error("Compact source runtime contract validation failed");
        }
        return source;
    }

    function validatePatchedCompact(source) {
        if (source.indexOf("advancedView.getText()") >= 0 ||
                source.indexOf("MODULE_VERSION: 29") < 0 ||
                source.indexOf("advancedView = statusFilter;") < 0 ||
                source.indexOf(
                    "reference_search_v12_compact_header") < 0) {
            throw new Error("Cached compact source validation failed");
        }
        return source;
    }

    function stableFromPreviousModules() {
        var previous = new File(new File(runtimeDir, "modules.backup"),
            "ch_11_filter.js");
        return readVerified(previous, STABLE_BLOB,
            "previous stable filter");
    }

    function ensureStableSource() {
        var source = readVerified(stableCache, STABLE_BLOB,
            "stable cache");
        if (source !== null) { return source; }
        source = stableFromPreviousModules();
        if (source === null) {
            source = requireBlob(fetchSource(STABLE_COMMIT), STABLE_BLOB,
                "remote stable filter");
        }
        writeUtf8(stableCache, source);
        return source;
    }

    function ensureCompactSource() {
        var source = null;
        if (compactCache.isFile()) {
            try {
                source = validatePatchedCompact(readUtf8(compactCache));
            } catch (ignored) {
                deleteQuietly(compactCache);
                source = null;
            }
        }
        if (source !== null) { return source; }
        source = patchCompactSource(fetchSource(COMPACT_COMMIT));
        writeUtf8(compactCache, source);
        return source;
    }

    function executeSource(source) {
        eval(String(source));
        if (!ClipHub.Filter ||
                typeof ClipHub.Filter.showRoot !== "function") {
            throw new Error("Filter module did not initialize");
        }
        return ClipHub.Filter;
    }

    function markCompactFailure(error) {
        writeMarker(failureFile, errorText(error));
        writeMarker(disabledFile,
            "disabled after incomplete compact show at " +
            Number(System.currentTimeMillis()));
    }

    function installShowGuard() {
        var filter = ClipHub.Filter;
        var originalShowRoot = filter.showRoot;
        var originalShowPanel = filter.showPanel;

        function guard(original, receiver, args, label) {
            var result;
            writeMarker(pendingFile, label + " " +
                Number(System.currentTimeMillis()));
            try {
                result = original.apply(receiver, args);
                deleteQuietly(pendingFile);
                deleteQuietly(failureFile);
                return result;
            } catch (error) {
                writeMarker(failureFile, label + ": " + errorText(error));
                writeMarker(disabledFile,
                    "disabled after failed " + label + " at " +
                    Number(System.currentTimeMillis()));
                throw error;
            }
        }

        filter.showRoot = function (showOptions) {
            return guard(originalShowRoot, filter, arguments, "showRoot");
        };
        filter.showPanel = function (showOptions) {
            return guard(originalShowPanel, filter, arguments, "showPanel");
        };
        filter.COMPACT_RECOVERY_GUARD = CACHE_VERSION;
    }

    function loadStable(reason) {
        var source = ensureStableSource();
        deleteQuietly(pendingFile);
        executeSource(source);
        ClipHub.Filter.COMPACT_RECOVERY_MODE = "stable_fallback";
        ClipHub.Filter.COMPACT_RECOVERY_REASON = String(reason || "fallback");
        return ClipHub.Filter;
    }

    ensureDir(cacheDir);
    ensureStableSource();

    if (pendingFile.isFile()) {
        markCompactFailure("previous compact show did not complete");
    }

    if (disabledFile.isFile()) {
        loadStable("disabled_marker");
        return;
    }

    try {
        executeSource(ensureCompactSource());
        installShowGuard();
        ClipHub.Filter.COMPACT_RECOVERY_MODE = "compact_guarded";
    } catch (error) {
        markCompactFailure(error);
        loadStable(errorText(error));
    }
}((function () { return this; }())));
