/* ClipHub system navigation probe 030 v4 loader. Rhino ES5 only. */
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
        "88acb8ca2255006889707b6e9fc2f8ef5f529927";
    var target = "https://raw.githubusercontent.com/7015725/ClipHub/" +
        implementationCommit + "/probes/" +
        "cliphub_system_navigation_probe_030_impl.js" +
        "?_=" + Number(System.currentTimeMillis());
    try {
        connection = new URL(target).openConnection();
        connection.setUseCaches(false);
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(20000);
        connection.setRequestProperty("Cache-Control", "no-cache, no-store");
        connection.setRequestProperty("Pragma", "no-cache");
        connection.setRequestProperty("User-Agent", "ClipHub-Probe/030-v4");
        input = connection.getInputStream();
        reader = new BR(new ISR(input, "UTF-8"));
        while ((line = reader.readLine()) !== null) {
            builder.append(line).append("\n");
        }
        source = String(builder.toString());
        if (!source) { throw new Error("Probe 030 implementation is empty"); }
        if (source.indexOf("probeVersion: 4") < 0 ||
                source.indexOf("detailFixtureEligible") < 0) {
            throw new Error("Probe 030 v4 implementation validation failed");
        }
        eval(source + "\n//# sourceURL=ClipHub/probe_030_impl_v4.js");
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

JSON.stringify(ClipHubSystemNavigationProbe030Result);
