/* ClipHub existing-module width-layout test entry. Rhino ES5 only. */
(function (global) {
    var URL = Packages.java.net.URL;
    var URLEncoder = Packages.java.net.URLEncoder;
    var BAOS = Packages.java.io.ByteArrayOutputStream;
    var ReflectArray = Packages.java.lang.reflect.Array;
    var JavaByte = Packages.java.lang.Byte;
    var JavaString = Packages.java.lang.String;

    var OWNER = "7015725";
    var REPO = "ClipHub";
    var REF = "agent/optimize-cliphub-window-startup-v1-20260805";
    var ENTRY_PATH = "ClipHub.js";
    var TEST_ENTRY_VERSION = 8;
    var TEST_MANIFEST_PATH = "module-manifest-rapid-close.json";
    var EXPECTED_MODULE_SET_VERSION = "20260806.04";

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

    function encodeSegment(value) {
        return String(URLEncoder.encode(String(value), "UTF-8"))
            .replace(/\+/g, "%20");
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

    function fetchEntry() {
        var url = "https://raw.githubusercontent.com/" + OWNER + "/" +
            REPO + "/" + encodeSegment(REF) + "/" + ENTRY_PATH +
            "?cliphubExistingModuleWidth=" +
            Number(Packages.java.lang.System.currentTimeMillis());
        var connection = null;
        var code;
        var bytes;
        var text;
        try {
            connection = new URL(url).openConnection();
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(20000);
            connection.setUseCaches(false);
            connection.setRequestProperty("Accept", "text/plain, */*");
            connection.setRequestProperty("Accept-Encoding", "identity");
            connection.setRequestProperty("Cache-Control", "no-cache");
            connection.setRequestProperty("Pragma", "no-cache");
            connection.setRequestProperty(
                "User-Agent", "ClipHub-ExistingModule-Width-Test/8"
            );
            code = Number(connection.getResponseCode());
            bytes = readBytes(code >= 200 && code < 300 ?
                connection.getInputStream() : connection.getErrorStream());
            text = String(new JavaString(bytes, "UTF-8"));
            if (code < 200 || code >= 300) {
                throw new Error("ClipHub entry HTTP " + code + ": " +
                    text.substring(0, 400));
            }
            return text;
        } finally {
            if (connection !== null) {
                try { connection.disconnect(); } catch (ignored) {}
            }
        }
    }

    function replaceExactly(text, target, replacement, label) {
        var first = text.indexOf(target);
        var second;
        if (first < 0) {
            throw new Error("Missing ClipHub entry marker: " + label);
        }
        second = text.indexOf(target, first + target.length);
        if (second >= 0) {
            throw new Error("Duplicate ClipHub entry marker: " + label);
        }
        return text.substring(0, first) + replacement +
            text.substring(first + target.length);
    }

    function modulePatchHelpers() {
        return [
            "    function replaceLoadedModuleExactly(text, target, replacement, label) {",
            "        var first = text.indexOf(target);",
            "        var second;",
            "        if (first < 0) {",
            "            throw new Error(\"Missing loaded module marker: \" + label);",
            "        }",
            "        second = text.indexOf(target, first + target.length);",
            "        if (second >= 0) {",
            "            throw new Error(\"Duplicate loaded module marker: \" + label);",
            "        }",
            "        return text.substring(0, first) + replacement +",
            "            text.substring(first + target.length);",
            "    }",
            "",
            "    function patchFilterModuleForCachedWidth(text) {",
            "        var marker;",
            "        var replacement;",
            "        text = replaceLoadedModuleExactly(text,",
            "            \"        MODULE_VERSION: 38,\",",
            "            \"        MODULE_VERSION: 39,\",",
            "            \"filter_module_version\");",
            "        marker = [",
            "            \"                var colors = palette();\",",
            "            \"                var reused = panelBuilt && panelWindowRoot !== null &&\",",
            "            \"                    panelBuiltRootMode === rootMode;\",",
            "            \"                if (panelBuilt && panelBuiltRootMode !== rootMode) {\"",
            "        ].join(\"\\n\");",
            "        replacement = [",
            "            \"                var colors = palette();\",",
            "            \"                var reused = panelBuilt && panelWindowRoot !== null &&\",",
            "            \"                    panelBuiltRootMode === rootMode;\",",
            "            \"                var cachedLayoutWidth =\",",
            "            \"                    Number(state.panelWidthPx || 0);\",",
            "            \"                var cachedLayoutWidthChanged = reused &&\",",
            "            \"                    cachedLayoutWidth > 0 &&\",",
            "            \"                    Math.abs(cachedLayoutWidth -\",",
            "            \"                        Number(size.width || 0)) > touchSlop * 2;\",",
            "            \"                if (cachedLayoutWidthChanged) {\",",
            "            \"                    panelStructureDirty = true;\",",
            "            \"                    state.panelStructureDirty = true;\",",
            "            \"                    state.adaptiveLayoutRefreshCount += 1;\",",
            "            \"                }\",",
            "            \"                if (panelBuilt && panelBuiltRootMode !== rootMode) {\"",
            "        ].join(\"\\n\");",
            "        return replaceLoadedModuleExactly(text, marker, replacement,",
            "            \"cached_width_rebuild\");",
            "    }",
            ""
        ].join("\n");
    }

    function transformEntry(text) {
        var helper = modulePatchHelpers();
        text = replaceExactly(text,
            "var ENTRY_VERSION = 5;",
            "var ENTRY_VERSION = " + String(TEST_ENTRY_VERSION) + ";",
            "entry_version");
        text = replaceExactly(text,
            "var MANIFEST_PATH = \"module-manifest.json\";",
            "var MANIFEST_PATH = \"" + TEST_MANIFEST_PATH + "\";",
            "manifest_path");
        text = replaceExactly(text,
            "\"ch_14_event_bus.js\", \"ch_15_app.js\"\n    ];",
            "\"ch_14_event_bus.js\", \"ch_15_app.js\",\n" +
                "        \"ch_16_rapid_close_fix.js\"\n    ];",
            "module_list");
        text = replaceExactly(text,
            "    function loadModules(moduleDir) {",
            helper + "\n    function loadModules(moduleDir) {",
            "module_patch_helpers");
        text = replaceExactly(text,
            "        var file;\n        global.ClipHub = {};",
            "        var file;\n        var moduleSource;\n" +
                "        global.ClipHub = {};",
            "module_source_variable");
        text = replaceExactly(text,
            "            eval(readUtf8(file));",
            "            moduleSource = readUtf8(file);\n" +
                "            if (NAMES[index] === \"ch_11_filter.js\") {\n" +
                "                moduleSource =\n" +
                "                    patchFilterModuleForCachedWidth(moduleSource);\n" +
                "            }\n" +
                "            eval(moduleSource);",
            "module_eval");
        return text;
    }

    function main() {
        var source = fetchEntry();
        var transformed = transformEntry(source);
        var bootstrapResult;
        eval(transformed);
        bootstrapResult = global.ClipHubBootstrapResult || null;
        return {
            ok: bootstrapResult !== null && bootstrapResult.ok === true,
            project: "ClipHub",
            testEntry: "existing_module_cached_width",
            testEntryVersion: TEST_ENTRY_VERSION,
            sourceRef: REF,
            manifestPath: TEST_MANIFEST_PATH,
            expectedModuleSetVersion: EXPECTED_MODULE_SET_VERSION,
            moduleFileCountExpected: 16,
            newModuleAdded: false,
            rapidCloseFixExpected: true,
            cachedWidthRebuildExpected: true,
            filterModuleVersionExpected: 39,
            bootstrap: bootstrapResult
        };
    }

    try {
        global.ClipHubExistingModuleWidthTestEntryResult = main();
    } catch (error) {
        global.ClipHubExistingModuleWidthTestEntryResult = {
            ok: false,
            project: "ClipHub",
            testEntry: "existing_module_cached_width",
            testEntryVersion: TEST_ENTRY_VERSION,
            sourceRef: REF,
            manifestPath: TEST_MANIFEST_PATH,
            expectedModuleSetVersion: EXPECTED_MODULE_SET_VERSION,
            moduleFileCountExpected: 16,
            newModuleAdded: false,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubExistingModuleWidthTestEntryResult);
