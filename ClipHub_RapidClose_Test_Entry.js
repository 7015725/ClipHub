/* ClipHub existing-module safe-viewport test entry. Rhino ES5 only. */
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
    var TEST_ENTRY_VERSION = 9;
    var TEST_MANIFEST_PATH = "module-manifest-rapid-close.json";
    var EXPECTED_MODULE_SET_VERSION = "20260806.05";

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
            "?cliphubSafeViewport=" +
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
                "User-Agent", "ClipHub-Safe-Viewport-Test/9"
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
            throw new Error("Missing marker: " + label);
        }
        second = text.indexOf(target, first + target.length);
        if (second >= 0) {
            throw new Error("Duplicate marker: " + label);
        }
        return text.substring(0, first) + replacement +
            text.substring(first + target.length);
    }

    function patchFilterModuleForSafeViewport(text) {
        var marker;
        var replacement;

        text = replaceExactly(text,
            "        MODULE_VERSION: 38,",
            "        MODULE_VERSION: 40,",
            "filter_module_version");

        text = replaceExactly(text,
            "    var REFRESH_COALESCE_MS = 80;\n",
            [
                "    var REFRESH_COALESCE_MS = 80;",
                "    var CONTENT_SAFE_RIGHT_DP = 10;",
                "    var CONTENT_SAFE_BOTTOM_DP = 18;",
                ""
            ].join("\n"),
            "safe_viewport_constants");

        marker = [
            "    function availableResultWidthPx() {",
            "        var width = 0;",
            "        var horizontalPadding = 0;",
            "        try {",
            "            if (panelRoot !== null) {",
            "                width = Number(panelRoot.getWidth());",
            "                horizontalPadding = Number(panelRoot.getPaddingLeft()) +",
            "                    Number(panelRoot.getPaddingRight());",
            "            }",
            "        } catch (ignoredMeasuredWidth) {",
            "            width = 0;",
            "            horizontalPadding = 0;",
            "        }",
            "        if (width <= 0) {",
            "            width = Number(state.panelWidthPx || 0);",
            "        }",
            "        if (width <= 0) {",
            "            width = dp(Number(state.panelWidthDp || 390));",
            "        }",
            "        return Math.max(touchSlop * 18, width - horizontalPadding);",
            "    }"
        ].join("\n");
        replacement = [
            "    function availableResultWidthPx() {",
            "        var width = Number(state.panelWidthPx || 0);",
            "        var horizontalPadding = 0;",
            "        if (width <= 0) {",
            "            try {",
            "                if (panelRoot !== null) {",
            "                    width = Number(panelRoot.getWidth());",
            "                }",
            "            } catch (ignoredMeasuredWidth) { width = 0; }",
            "        }",
            "        try {",
            "            if (panelRoot !== null) {",
            "                horizontalPadding = Number(panelRoot.getPaddingLeft()) +",
            "                    Number(panelRoot.getPaddingRight());",
            "            }",
            "        } catch (ignoredPadding) { horizontalPadding = 0; }",
            "        if (width <= 0) {",
            "            width = dp(Number(state.panelWidthDp || 390));",
            "        }",
            "        return Math.max(touchSlop * 18, width - horizontalPadding -",
            "            dp(CONTENT_SAFE_RIGHT_DP));",
            "    }"
        ].join("\n");
        text = replaceExactly(text, marker, replacement,
            "available_result_width");

        text = replaceExactly(text,
            "        var widthDp = Number(state.panelWidthDp || 0);",
            "        var widthDp = availableResultWidthPx() / density;",
            "header_inner_width");

        marker = [
            "    function buildResultArea(colors) {",
            "        var root = new LinearLayout(appContext);",
            "        var scroll = new ScrollView(appContext);",
            "        resultScrollView = scroll;",
            "        root.setOrientation(LinearLayout.VERTICAL);",
            "        resultContainer = new LinearLayout(appContext);",
            "        resultContainer.setOrientation(LinearLayout.VERTICAL);",
            "        scroll.setFillViewport(false);",
            "        scroll.setVerticalScrollBarEnabled(false);",
            "        scroll.addView(resultContainer, new FrameLayout.LayoutParams(",
            "            FrameLayout.LayoutParams.MATCH_PARENT,",
            "            FrameLayout.LayoutParams.WRAP_CONTENT));"
        ].join("\n");
        replacement = [
            "    function buildResultArea(colors) {",
            "        var root = new LinearLayout(appContext);",
            "        var scroll = new ScrollView(appContext);",
            "        resultScrollView = scroll;",
            "        root.setOrientation(LinearLayout.VERTICAL);",
            "        resultContainer = new LinearLayout(appContext);",
            "        resultContainer.setOrientation(LinearLayout.VERTICAL);",
            "        resultContainer.setPadding(0, 0,",
            "            dp(CONTENT_SAFE_RIGHT_DP),",
            "            dp(CONTENT_SAFE_BOTTOM_DP));",
            "        scroll.setFillViewport(false);",
            "        scroll.setClipToPadding(true);",
            "        scroll.setPadding(0, 0, 0,",
            "            dp(Math.max(8, CONTENT_SAFE_BOTTOM_DP * 0.55)));",
            "        scroll.setVerticalScrollBarEnabled(false);",
            "        try {",
            "            scroll.setVerticalFadingEdgeEnabled(true);",
            "            scroll.setFadingEdgeLength(dp(CONTENT_SAFE_BOTTOM_DP));",
            "        } catch (ignoredFadingEdge) {}",
            "        scroll.addView(resultContainer, new FrameLayout.LayoutParams(",
            "            FrameLayout.LayoutParams.MATCH_PARENT,",
            "            FrameLayout.LayoutParams.WRAP_CONTENT));"
        ].join("\n");
        text = replaceExactly(text, marker, replacement,
            "result_safe_viewport");

        marker = [
            "        panelRoot.addView(bodyFrame, new LinearLayout.LayoutParams(",
            "            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));"
        ].join("\n");
        replacement = [
            "        params = new LinearLayout.LayoutParams(",
            "            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1);",
            "        params.rightMargin = dp(Math.max(3,",
            "            CONTENT_SAFE_RIGHT_DP * 0.4));",
            "        params.bottomMargin = dp(Math.max(6,",
            "            CONTENT_SAFE_BOTTOM_DP * 0.45));",
            "        panelRoot.addView(bodyFrame, params);"
        ].join("\n");
        text = replaceExactly(text, marker, replacement,
            "body_safe_margins");

        text = replaceExactly(text,
            "    function scheduleAdaptiveResultRefresh(previousWidth, nextWidth) {",
            [
                "    function scheduleAdaptiveResultRefresh(previousWidth, nextWidth,",
                "            previousHeight, nextHeight) {"
            ].join("\n"),
            "adaptive_refresh_signature");

        marker = [
            "        if (mainHandler === null || !state.panelAttached ||",
            "                Math.abs(Number(nextWidth) - Number(previousWidth)) <=",
            "                    touchSlop * 2) {",
            "            return false;",
            "        }"
        ].join("\n");
        replacement = [
            "        if (mainHandler === null || !state.panelAttached ||",
            "                (Math.abs(Number(nextWidth) - Number(previousWidth)) <=",
            "                    touchSlop * 2 &&",
            "                Math.abs(Number(nextHeight) - Number(previousHeight)) <=",
            "                    touchSlop * 2)) {",
            "            return false;",
            "        }"
        ].join("\n");
        text = replaceExactly(text, marker, replacement,
            "adaptive_refresh_dimensions");

        marker = [
            "            onGeometryChanged: function (geometry) {",
            "                var previousWidth;",
            "                var nextWidth;",
            "                if (!geometry) { return; }",
            "                previousWidth = Number(state.panelWidthPx || 0);",
            "                nextWidth = Number(geometry.width || 0);",
            "                state.panelX = Number(geometry.x || 0);",
            "                state.panelY = Number(geometry.y || 0);",
            "                state.panelWidthPx = nextWidth;",
            "                state.panelHeightPx = Number(geometry.height || 0);",
            "                state.panelWidthDp = Number(geometry.widthDp || 0);",
            "                state.panelHeightDp = Number(geometry.heightDp || 0);",
            "                scheduleAdaptiveResultRefresh(previousWidth, nextWidth);",
            "            },"
        ].join("\n");
        replacement = [
            "            onGeometryChanged: function (geometry) {",
            "                var previousWidth;",
            "                var nextWidth;",
            "                var previousHeight;",
            "                var nextHeight;",
            "                if (!geometry) { return; }",
            "                previousWidth = Number(state.panelWidthPx || 0);",
            "                previousHeight = Number(state.panelHeightPx || 0);",
            "                nextWidth = Number(geometry.width || 0);",
            "                nextHeight = Number(geometry.height || 0);",
            "                state.panelX = Number(geometry.x || 0);",
            "                state.panelY = Number(geometry.y || 0);",
            "                state.panelWidthPx = nextWidth;",
            "                state.panelHeightPx = nextHeight;",
            "                state.panelWidthDp = Number(geometry.widthDp || 0);",
            "                state.panelHeightDp = Number(geometry.heightDp || 0);",
            "                scheduleAdaptiveResultRefresh(previousWidth, nextWidth,",
            "                    previousHeight, nextHeight);",
            "            },"
        ].join("\n");
        text = replaceExactly(text, marker, replacement,
            "adaptive_geometry_callback");

        marker = [
            "                var colors = palette();",
            "                var reused = panelBuilt && panelWindowRoot !== null &&",
            "                    panelBuiltRootMode === rootMode;",
            "                if (panelBuilt && panelBuiltRootMode !== rootMode) {"
        ].join("\n");
        replacement = [
            "                var colors = palette();",
            "                var reused = panelBuilt && panelWindowRoot !== null &&",
            "                    panelBuiltRootMode === rootMode;",
            "                var cachedLayoutWidth =",
            "                    Number(state.panelWidthPx || 0);",
            "                var cachedLayoutHeight =",
            "                    Number(state.panelHeightPx || 0);",
            "                var cachedLayoutSizeChanged = reused &&",
            "                    ((cachedLayoutWidth > 0 &&",
            "                    Math.abs(cachedLayoutWidth -",
            "                        Number(size.width || 0)) > touchSlop * 2) ||",
            "                    (cachedLayoutHeight > 0 &&",
            "                    Math.abs(cachedLayoutHeight -",
            "                        Number(size.height || 0)) > touchSlop * 2));",
            "                if (cachedLayoutSizeChanged) {",
            "                    panelStructureDirty = true;",
            "                    state.panelStructureDirty = true;",
            "                    state.adaptiveLayoutRefreshCount += 1;",
            "                }",
            "                if (panelBuilt && panelBuiltRootMode !== rootMode) {"
        ].join("\n");
        return replaceExactly(text, marker, replacement,
            "cached_geometry_rebuild");
    }

    function transformEntry(text) {
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
            "        var file;\n        global.ClipHub = {};",
            "        var file;\n        var moduleSource;\n" +
                "        global.ClipHub = {};",
            "module_source_variable");
        text = replaceExactly(text,
            "            eval(readUtf8(file));",
            [
                "            moduleSource = readUtf8(file);",
                "            if (NAMES[index] === \"ch_11_filter.js\") {",
                "                moduleSource =",
                "                    global.ClipHubSafeViewportModulePatch(",
                "                        moduleSource);",
                "            }",
                "            eval(moduleSource);"
            ].join("\n"),
            "module_eval");
        return text;
    }

    function main() {
        var source = fetchEntry();
        var transformed = transformEntry(source);
        var bootstrapResult;
        global.ClipHubSafeViewportModulePatch =
            patchFilterModuleForSafeViewport;
        try {
            eval(transformed);
        } finally {
            global.ClipHubSafeViewportModulePatch = null;
        }
        bootstrapResult = global.ClipHubBootstrapResult || null;
        return {
            ok: bootstrapResult !== null && bootstrapResult.ok === true,
            project: "ClipHub",
            testEntry: "existing_module_safe_viewport",
            testEntryVersion: TEST_ENTRY_VERSION,
            sourceRef: REF,
            manifestPath: TEST_MANIFEST_PATH,
            expectedModuleSetVersion: EXPECTED_MODULE_SET_VERSION,
            moduleFileCountExpected: 16,
            newModuleAdded: false,
            rapidCloseFixExpected: true,
            cachedGeometryRebuildExpected: true,
            safeViewportExpected: true,
            safeRightDpExpected: 10,
            safeBottomDpExpected: 18,
            filterModuleVersionExpected: 40,
            bootstrap: bootstrapResult
        };
    }

    try {
        global.ClipHubExistingModuleSafeViewportTestEntryResult = main();
    } catch (error) {
        global.ClipHubExistingModuleSafeViewportTestEntryResult = {
            ok: false,
            project: "ClipHub",
            testEntry: "existing_module_safe_viewport",
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

JSON.stringify(ClipHubExistingModuleSafeViewportTestEntryResult);
