/* ClipHub rapid-close race test entry. Rhino ES5 only. */
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
    var TEST_ENTRY_VERSION = 6;
    var TEST_MANIFEST_PATH = "module-manifest-rapid-close.json";

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
            "?cliphubRapidClose=" +
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
                "User-Agent", "ClipHub-RapidClose-Test/6");
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
            testEntry: "rapid_close_race",
            testEntryVersion: TEST_ENTRY_VERSION,
            sourceRef: REF,
            manifestPath: TEST_MANIFEST_PATH,
            expectedModuleSetVersion: "20260806.01",
            rapidCloseFixExpected: true,
            bootstrap: bootstrapResult
        };
    }

    try {
        global.ClipHubRapidCloseTestEntryResult = main();
    } catch (error) {
        global.ClipHubRapidCloseTestEntryResult = {
            ok: false,
            project: "ClipHub",
            testEntry: "rapid_close_race",
            testEntryVersion: TEST_ENTRY_VERSION,
            sourceRef: REF,
            manifestPath: TEST_MANIFEST_PATH,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubRapidCloseTestEntryResult);
