/* ClipHub home and filter exclusive-window probe 043 loader. Rhino ES5 only. */
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
        "c079795c33407f97e8704242a2a428d61404a243";
    var target = "https://raw.githubusercontent.com/7015725/ClipHub/" +
        implementationCommit + "/probes/" +
        "cliphub_home_filter_exclusive_probe_043_impl.js" +
        "?_=" + Number(System.currentTimeMillis());

    try {
        connection = new URL(target).openConnection();
        connection.setUseCaches(false);
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(20000);
        connection.setRequestProperty("Cache-Control", "no-cache, no-store");
        connection.setRequestProperty("Pragma", "no-cache");
        connection.setRequestProperty("User-Agent", "ClipHub-Probe/043-v1");
        input = connection.getInputStream();
        reader = new BR(new ISR(input, "UTF-8"));
        while ((line = reader.readLine()) !== null) {
            builder.append(line).append("\n");
        }
        source = String(builder.toString());
        if (!source) {
            throw new Error("Probe 043 implementation is empty");
        }
        if (source.indexOf("probeVersion: 1") < 0 ||
                source.indexOf("REQUIRED_SET = \"20260722.36\"") < 0 ||
                source.indexOf("listModuleVersion === 12") < 0 ||
                source.indexOf("filterModuleVersion === 10") < 0 ||
                source.indexOf("appModuleVersion === 6") < 0 ||
                source.indexOf("cliphub_home_filter_exclusive_probe_043") < 0 ||
                source.indexOf("homeFilterAttachedCount") < 0 ||
                source.indexOf("filterPanelSuspended") < 0 ||
                source.indexOf("restoreReady") < 0) {
            throw new Error("Probe 043 implementation validation failed");
        }
        eval(source + "\n//# sourceURL=ClipHub/probe_043_impl_v1.js");
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

JSON.stringify(ClipHubHomeFilterExclusiveProbe043Result);
