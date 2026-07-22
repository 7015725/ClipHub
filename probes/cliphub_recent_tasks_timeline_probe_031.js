/* ClipHub real Recents transition timeline probe 031 loader. Rhino ES5 only. */
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
        "c9c03c3f6b9cb212d7ed21772b8a2a560798546a";
    var target = "https://raw.githubusercontent.com/7015725/ClipHub/" +
        implementationCommit + "/probes/" +
        "cliphub_recent_tasks_timeline_probe_031_impl.js" +
        "?_=" + Number(System.currentTimeMillis());
    try {
        connection = new URL(target).openConnection();
        connection.setUseCaches(false);
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(20000);
        connection.setRequestProperty("Cache-Control", "no-cache, no-store");
        connection.setRequestProperty("Pragma", "no-cache");
        connection.setRequestProperty("User-Agent", "ClipHub-Probe/031-v1");
        input = connection.getInputStream();
        reader = new BR(new ISR(input, "UTF-8"));
        while ((line = reader.readLine()) !== null) {
            builder.append(line).append("\n");
        }
        source = String(builder.toString());
        if (!source) { throw new Error("Probe 031 implementation is empty"); }
        if (source.indexOf("probeVersion: 1") < 0 ||
                source.indexOf("SAMPLE_DURATION_MS = 15000") < 0 ||
                source.indexOf("cliphub_recent_tasks_timeline_probe_031") < 0) {
            throw new Error("Probe 031 implementation validation failed");
        }
        eval(source + "\n//# sourceURL=ClipHub/probe_031_impl_v1.js");
    } finally {
        try { if (reader !== null) { reader.close(); } } catch (ignoredReader) {}
        try { if (input !== null) { input.close(); } } catch (ignoredInput) {}
        try {
            if (connection !== null && connection.disconnect) {
                connection.disconnect();
            }
        } catch (ignoredConnection) {}
    }
}((function () { return this; }())));

JSON.stringify(ClipHubRecentTasksTimelineProbe031Result);
