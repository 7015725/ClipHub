/* ClipHub Editor shutdown race probe 048 loader. Rhino ES5 only. */
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
    var implementationCommit = "a4d9844af9ea8262ca3c5f2a448d5dcf9ae8b83a";
    var target = "https://raw.githubusercontent.com/7015725/ClipHub/" +
        implementationCommit + "/probes/" +
        "cliphub_editor_shutdown_race_probe_048_impl.js" +
        "?_=" + Number(System.currentTimeMillis());

    try {
        connection = new URL(target).openConnection();
        connection.setUseCaches(false);
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(20000);
        connection.setRequestProperty("Cache-Control", "no-cache, no-store");
        connection.setRequestProperty("Pragma", "no-cache");
        connection.setRequestProperty("User-Agent", "ClipHub-Probe/048-v1");
        input = connection.getInputStream();
        reader = new BR(new ISR(input, "UTF-8"));
        while ((line = reader.readLine()) !== null) {
            builder.append(line).append("\n");
        }
        source = String(builder.toString());
        if (!source ||
                source.indexOf("REQUIRED_SET = \"20260723.05\"") < 0 ||
                source.indexOf("editorModuleVersion !== 11") < 0 ||
                source.indexOf("quickClosePassed") < 0 ||
                source.indexOf("saveHidePassed") < 0 ||
                source.indexOf("shutdownPassed") < 0 ||
                source.indexOf("formalRunningRequired: true") < 0 ||
                source.indexOf("cliphub_editor_shutdown_race_probe_048") < 0) {
            throw new Error("Probe 048 implementation validation failed");
        }
        eval(source + "\n//# sourceURL=ClipHub/probe_048_impl_v1.js");
    } finally {
        try { if (reader !== null) { reader.close(); } } catch (ignored) {}
        try { if (input !== null) { input.close(); } }
        catch (ignoredInput) {}
        try {
            if (connection !== null && connection.disconnect) {
                connection.disconnect();
            }
        } catch (ignoredConnection) {}
    }
}((function () { return this; }())));

JSON.stringify(ClipHubEditorShutdownRaceProbe048Result);
