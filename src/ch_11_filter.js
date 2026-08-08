/* ClipHub Stage 15 rebuild peak diagnostics ES5 loader. */
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

    var REF = "beta-pagination-stage10-20260808";
    var PARTS = [
        "stage-assets/pagination-stage9/ch11_full_v8s_00.b64",
        "stage-assets/pagination-stage9/ch11_full_v8s_01.b64",
        "stage-assets/pagination-stage9/ch11_full_v8s_02.b64",
        "stage-assets/pagination-stage9/ch11_full_v8s_03.b64",
        "stage-assets/pagination-stage9/ch11_full_v8s_04.b64",
        "stage-assets/pagination-stage9/ch11_full_v8s_05.b64",
        "stage-assets/pagination-stage9/ch11_full_v8s_06.b64",
        "stage-assets/pagination-stage9/ch11_full_v8s_07.b64"
    ];
    var PACKED_SHA256 =
        "2c458cba6993be764e6763c9e09228f665520b1218ec038df453bd91f25ad294";
    var SOURCE_SHA256 =
        "328608b7fa357c9262079f43289d692ea7ddf79d9416e6135023d55f4bff6940";
    var CACHE_NAME = "ch_11_filter_stage14_v10_noop_layout_full.b64";

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
                "?stage15v11=" + Number(System.currentTimeMillis())
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
            throw new Error("Stage 15 packed source SHA-256 mismatch");
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
            throw new Error("Stage 15 source SHA-256 mismatch");
        }
        return source;
    }

    function replaceOnceStrict(text, oldText, newText, label) {
        var first = text.indexOf(oldText);
        if (first < 0) {
            throw new Error("Stage 15 anchor missing: " + label);
        }
        if (text.indexOf(oldText, first + oldText.length) >= 0) {
            throw new Error("Stage 15 anchor duplicate: " + label);
        }
        return text.substring(0, first) + newText +
            text.substring(first + oldText.length);
    }

    function section(text, startMarker, endMarker, label) {
        var start = text.indexOf(startMarker);
        var end;
        if (start < 0) {
            throw new Error("Stage 15 section missing: " + label);
        }
        end = text.indexOf(endMarker, start + startMarker.length);
        if (end < 0) {
            throw new Error("Stage 15 section end missing: " + label);
        }
        return {
            start: start,
            end: end,
            text: text.substring(start, end)
        };
    }

    function replaceSection(text, info, value) {
        return text.substring(0, info.start) + value +
            text.substring(info.end);
    }

    function transformSource(source) {
        var info;
        var value;
        var pos;

        source = replaceOnceStrict(source,
            "MODULE_VERSION: 56", "MODULE_VERSION: 57",
            "module version");

        source = replaceOnceStrict(source,
            "        measureMaxMs: 0\n",
            "        measureMaxMs: 0,\n" +
            "        keyedReconcileLastMs: 0,\n" +
            "        keyedReconcileMaxMs: 0,\n" +
            "        keyedSignatureLastMs: 0,\n" +
            "        keyedSignatureMaxMs: 0,\n" +
            "        keyedStructureLastMs: 0,\n" +
            "        keyedStructureMaxMs: 0,\n" +
            "        overlapUpdateLastMs: 0,\n" +
            "        overlapUpdateMaxMs: 0,\n" +
            "        slowRebuildCount: 0,\n" +
            "        slowRebuildSamples: []\n",
            "diagnostic metrics");

        source = replaceOnceStrict(source,
            "        scrollPerformanceState.measureMaxMs = 0;\n",
            "        scrollPerformanceState.measureMaxMs = 0;\n" +
            "        scrollPerformanceState.keyedReconcileLastMs = 0;\n" +
            "        scrollPerformanceState.keyedReconcileMaxMs = 0;\n" +
            "        scrollPerformanceState.keyedSignatureLastMs = 0;\n" +
            "        scrollPerformanceState.keyedSignatureMaxMs = 0;\n" +
            "        scrollPerformanceState.keyedStructureLastMs = 0;\n" +
            "        scrollPerformanceState.keyedStructureMaxMs = 0;\n" +
            "        scrollPerformanceState.overlapUpdateLastMs = 0;\n" +
            "        scrollPerformanceState.overlapUpdateMaxMs = 0;\n" +
            "        scrollPerformanceState.slowRebuildCount = 0;\n" +
            "        scrollPerformanceState.slowRebuildSamples = [];\n",
            "diagnostic reset");

        source = replaceOnceStrict(source,
            "            measureMaxMs:\n" +
            "                Number(scrollPerformanceState.measureMaxMs),\n" +
            "            pendingOrigin: virtualPendingOrigin,\n",
            "            measureMaxMs:\n" +
            "                Number(scrollPerformanceState.measureMaxMs),\n" +
            "            keyedReconcileLastMs:\n" +
            "                Number(scrollPerformanceState.keyedReconcileLastMs),\n" +
            "            keyedReconcileMaxMs:\n" +
            "                Number(scrollPerformanceState.keyedReconcileMaxMs),\n" +
            "            keyedSignatureLastMs:\n" +
            "                Number(scrollPerformanceState.keyedSignatureLastMs),\n" +
            "            keyedSignatureMaxMs:\n" +
            "                Number(scrollPerformanceState.keyedSignatureMaxMs),\n" +
            "            keyedStructureLastMs:\n" +
            "                Number(scrollPerformanceState.keyedStructureLastMs),\n" +
            "            keyedStructureMaxMs:\n" +
            "                Number(scrollPerformanceState.keyedStructureMaxMs),\n" +
            "            overlapUpdateLastMs:\n" +
            "                Number(scrollPerformanceState.overlapUpdateLastMs),\n" +
            "            overlapUpdateMaxMs:\n" +
            "                Number(scrollPerformanceState.overlapUpdateMaxMs),\n" +
            "            slowRebuildCount:\n" +
            "                Number(scrollPerformanceState.slowRebuildCount),\n" +
            "            slowRebuildSamples:\n" +
            "                scrollPerformanceState.slowRebuildSamples.slice(0),\n" +
            "            pendingOrigin: virtualPendingOrigin,\n",
            "diagnostic copy");

        info = section(source,
            "    function keyedReconcileVirtualWindow(range, colors) {",
            "\n    function ",
            "keyed reconcile");
        value = info.text;
        value = replaceOnceStrict(value,
            "    function keyedReconcileVirtualWindow(range, colors) {\n",
            "    function keyedReconcileVirtualWindow(range, colors) {\n" +
            "        var keyedStartedAt = Number(System.currentTimeMillis());\n" +
            "        var keyedSignatureStartedAt;\n" +
            "        var keyedStructureStartedAt;\n" +
            "        var keyedElapsed;\n" +
            "        var keyedSignatureElapsed;\n" +
            "        var keyedStructureElapsed;\n",
            "keyed vars");
        value = replaceOnceStrict(value,
            "        for (index = range.start; index <= range.end; index += 1) {\n",
            "        keyedSignatureStartedAt = Number(System.currentTimeMillis());\n" +
            "        for (index = range.start; index <= range.end; index += 1) {\n",
            "keyed signature start");
        value = replaceOnceStrict(value,
            "        for (localIndex = Number(virtualCardHost.getChildCount()) - 1;\n",
            "        keyedSignatureElapsed = Math.max(0,\n" +
            "            Number(System.currentTimeMillis()) - keyedSignatureStartedAt);\n" +
            "        keyedStructureStartedAt = Number(System.currentTimeMillis());\n" +
            "        for (localIndex = Number(virtualCardHost.getChildCount()) - 1;\n",
            "keyed structure start");
        pos = value.lastIndexOf("        return true;");
        if (pos < 0) {
            throw new Error("Stage 15 keyed return missing");
        }
        value = value.substring(0, pos) +
            "        keyedStructureElapsed = Math.max(0,\n" +
            "            Number(System.currentTimeMillis()) - keyedStructureStartedAt);\n" +
            "        keyedElapsed = Math.max(0,\n" +
            "            Number(System.currentTimeMillis()) - keyedStartedAt);\n" +
            "        scrollPerformanceState.keyedReconcileLastMs = keyedElapsed;\n" +
            "        scrollPerformanceState.keyedReconcileMaxMs = Math.max(\n" +
            "            Number(scrollPerformanceState.keyedReconcileMaxMs), keyedElapsed);\n" +
            "        scrollPerformanceState.keyedSignatureLastMs = keyedSignatureElapsed;\n" +
            "        scrollPerformanceState.keyedSignatureMaxMs = Math.max(\n" +
            "            Number(scrollPerformanceState.keyedSignatureMaxMs), keyedSignatureElapsed);\n" +
            "        scrollPerformanceState.keyedStructureLastMs = keyedStructureElapsed;\n" +
            "        scrollPerformanceState.keyedStructureMaxMs = Math.max(\n" +
            "            Number(scrollPerformanceState.keyedStructureMaxMs), keyedStructureElapsed);\n" +
            "        return true;" +
            value.substring(pos + "        return true;".length);
        source = replaceSection(source, info, value);

        info = section(source,
            "    function rebuildVirtualWindow(origin, force, preferredIndex) {",
            "\n    function scheduleVirtualUpdate(",
            "rebuild");
        value = info.text;
        value = replaceOnceStrict(value,
            "        var recycledCount;\n",
            "        var recycledCount;\n" +
            "        var rebuildCreatedBefore;\n" +
            "        var rebuildRemovedBefore;\n" +
            "        var rebuildReusedBefore;\n" +
            "        var overlapStartedAt;\n" +
            "        var overlapElapsed = 0;\n",
            "rebuild vars");
        value = replaceOnceStrict(value,
            "        var viewRebuildStartedAt =\n" +
            "            Number(System.currentTimeMillis());\n",
            "        var viewRebuildStartedAt =\n" +
            "            Number(System.currentTimeMillis());\n" +
            "        rebuildCreatedBefore = Number(scrollPerformanceState.createdViewCount);\n" +
            "        rebuildRemovedBefore = Number(scrollPerformanceState.removedViewCount);\n" +
            "        rebuildReusedBefore = Number(scrollPerformanceState.sameIdReuseCount);\n",
            "rebuild counters");
        value = replaceOnceStrict(value,
            "        if (overlap) {\n",
            "        if (overlap) {\n" +
            "            overlapStartedAt = Number(System.currentTimeMillis());\n",
            "overlap start");
        value = replaceOnceStrict(value,
            "            state.resultCardCount = Number(\n" +
            "                virtualCardHost.getChildCount());\n" +
            "        } else {\n",
            "            state.resultCardCount = Number(\n" +
            "                virtualCardHost.getChildCount());\n" +
            "            overlapElapsed = Math.max(0,\n" +
            "                Number(System.currentTimeMillis()) - overlapStartedAt);\n" +
            "            scrollPerformanceState.overlapUpdateLastMs = overlapElapsed;\n" +
            "            scrollPerformanceState.overlapUpdateMaxMs = Math.max(\n" +
            "                Number(scrollPerformanceState.overlapUpdateMaxMs), overlapElapsed);\n" +
            "        } else {\n",
            "overlap elapsed");
        value = replaceOnceStrict(value,
            "        scrollPerformanceState.viewRebuildMaxMs = Math.max(\n" +
            "            Number(scrollPerformanceState.viewRebuildMaxMs),\n" +
            "            viewRebuildElapsed);\n",
            "        scrollPerformanceState.viewRebuildMaxMs = Math.max(\n" +
            "            Number(scrollPerformanceState.viewRebuildMaxMs),\n" +
            "            viewRebuildElapsed);\n" +
            "        if (viewRebuildElapsed > 32) {\n" +
            "            scrollPerformanceState.slowRebuildCount += 1;\n" +
            "            scrollPerformanceState.slowRebuildSamples.push({\n" +
            "                origin: String(origin || \"virtual_rebuild\"),\n" +
            "                force: force === true,\n" +
            "                mode: overlap ? \"overlap\" : \"keyed\",\n" +
            "                elapsedMs: viewRebuildElapsed,\n" +
            "                rangeStart: Number(range.start),\n" +
            "                rangeEnd: Number(range.end),\n" +
            "                oldCount: oldCount,\n" +
            "                newCount: Number(virtualCardHost.getChildCount()),\n" +
            "                created: Number(scrollPerformanceState.createdViewCount) -\n" +
            "                    rebuildCreatedBefore,\n" +
            "                removed: Number(scrollPerformanceState.removedViewCount) -\n" +
            "                    rebuildRemovedBefore,\n" +
            "                reused: Number(scrollPerformanceState.sameIdReuseCount) -\n" +
            "                    rebuildReusedBefore,\n" +
            "                measureMs: Number(scrollPerformanceState.measureLastMs),\n" +
            "                keyedMs: overlap ? 0 :\n" +
            "                    Number(scrollPerformanceState.keyedReconcileLastMs),\n" +
            "                signatureMs: overlap ? 0 :\n" +
            "                    Number(scrollPerformanceState.keyedSignatureLastMs),\n" +
            "                structureMs: overlap ? overlapElapsed :\n" +
            "                    Number(scrollPerformanceState.keyedStructureLastMs)\n" +
            "            });\n" +
            "            while (scrollPerformanceState.slowRebuildSamples.length > 8) {\n" +
            "                scrollPerformanceState.slowRebuildSamples.shift();\n" +
            "            }\n" +
            "        }\n",
            "slow rebuild sample");
        source = replaceSection(source, info, value);

        if (source.indexOf("var VIRTUAL_BEFORE_SCREENS = 3;") < 0 ||
                source.indexOf("var VIRTUAL_AFTER_SCREENS = 5;") < 0 ||
                source.indexOf("var VIRTUAL_UPDATE_DELAY_MS = 24;") < 0 ||
                source.indexOf("sameRangeNoLayoutCount") < 0 ||
                source.indexOf("spacerNoopCount") < 0 ||
                source.indexOf("anchorScrollNoopCount") < 0) {
            throw new Error("Stage 15 frozen invariant missing");
        }
        if (source.indexOf("resultTagBadgeViews") >= 0 ||
                source.indexOf("refreshRenderedTagBadges") >= 0) {
            throw new Error("Stage 15 unsafe Filter53 code detected");
        }
        return source;
    }

    try {
        eval(transformSource(decodeSource(loadPackedSource())));
    } catch (error) {
        throw new Error("ch_11_filter.js Stage 15 loader failed: " +
            String(error));
    }
}((function () { return this; }())));
