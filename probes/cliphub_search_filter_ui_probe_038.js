/* ClipHub search and advanced filter visual probe 038 loader. Rhino ES5 only. */
(function (global) {
    var URL = Packages.java.net.URL;
    var BR = Packages.java.io.BufferedReader;
    var ISR = Packages.java.io.InputStreamReader;
    var SB = Packages.java.lang.StringBuilder;
    var System = Packages.java.lang.System;
    var connection = null;
    var input = null;
    var reader = null;
    var builder = new SB();
    var line;
    var source;
    var implementationCommit =
        "b22d8451b553b5e66bd74a461a67114efc07fd88";
    var target = "https://raw.githubusercontent.com/7015725/ClipHub/" +
        implementationCommit + "/probes/" +
        "cliphub_search_filter_ui_probe_038_impl.js" +
        "?_=" + Number(System.currentTimeMillis());

    try {
        connection = new URL(target).openConnection();
        connection.setUseCaches(false);
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(20000);
        connection.setRequestProperty("Cache-Control", "no-cache, no-store");
        connection.setRequestProperty("Pragma", "no-cache");
        connection.setRequestProperty("User-Agent", "ClipHub-Probe/038-v1");
        input = connection.getInputStream();
        reader = new BR(new ISR(input, "UTF-8"));
        while ((line = reader.readLine()) !== null) {
            builder.append(line).append("\n");
        }
        source = String(builder.toString());
        if (!source) {
            throw new Error("Probe 038 implementation is empty");
        }
        if (source.indexOf("probeVersion: 1") < 0 ||
                source.indexOf("REQUIRED_SET = \"20260722.31\"") < 0 ||
                source.indexOf("filterModuleVersion === 9") < 0 ||
                source.indexOf("navigationModuleVersion === 3") < 0 ||
                source.indexOf("cliphub_search_filter_ui_probe_038") < 0 ||
                source.indexOf("performAdvancedKeywordSearch") < 0 ||
                source.indexOf("sourceWrapRowCount") < 0 ||
                source.indexOf("historyRestored") < 0 ||
                source.indexOf("chipSingleLineEnforced") < 0 ||
                source.indexOf("drawerContentBottomPaddingDp") < 0 ||
                source.indexOf("drawerFooterTopGapDp") < 0 ||
                source.indexOf("drawerContentFitsViewport") < 0 ||
                source.indexOf("drawerCanScrollDownAtTop") < 0 ||
                source.indexOf("advancedChipVerticalPaddingDp") < 0) {
            throw new Error("Probe 038 implementation validation failed");
        }
        eval(source + "\n//# sourceURL=ClipHub/probe_038_impl_v1.js");
    } finally {
        try { if (reader !== null) { reader.close(); } }
        catch (ignoredReader) {}
        try { if (input !== null) { input.close(); } }
        catch (ignoredInput) {}
        try {
            if (connection !== null && connection.disconnect) {
                connection.disconnect();
            }
        } catch (ignoredConnection) {}
    }
}((function () { return this; }())));

JSON.stringify(ClipHubSearchFilterUiProbe038Result);
