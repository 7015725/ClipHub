/* ClipHub stage 3D2 closure probe 051 loader. Rhino ES5 only. */
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
    var implementationCommit = "d8f1e4e31a18f24ac01afc9c0f7aa19305ee142d";
    var target = "https://raw.githubusercontent.com/7015725/ClipHub/" +
        implementationCommit + "/probes/" +
        "cliphub_stage_3d2_closure_probe_051_impl.js" +
        "?_=" + Number(System.currentTimeMillis());

    try {
        connection = new URL(target).openConnection();
        connection.setUseCaches(false);
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(20000);
        connection.setRequestProperty("Cache-Control", "no-cache, no-store");
        connection.setRequestProperty("Pragma", "no-cache");
        connection.setRequestProperty("User-Agent", "ClipHub-Probe/051-v1");
        input = connection.getInputStream();
        reader = new BR(new ISR(input, "UTF-8"));
        while ((line = reader.readLine()) !== null) {
            builder.append(line).append("\n");
        }
        source = String(builder.toString());
        if (!source ||
                source.indexOf("REQUIRED_SET = \"20260723.09\"") < 0 ||
                source.indexOf("editorModuleVersion !== 12") < 0 ||
                source.indexOf("settingsModuleVersion !== 11") < 0 ||
                source.indexOf("editorIdlePollPassed") < 0 ||
                source.indexOf("settingsIdlePollPassed") < 0 ||
                source.indexOf("rootReturnPassed") < 0 ||
                source.indexOf("cliphub_stage_3d2_closure_probe_051") < 0) {
            throw new Error("Probe 051 implementation validation failed");
        }
        eval(source + "\n//# sourceURL=ClipHub/probe_051_impl_v1.js");
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

JSON.stringify(ClipHubStage3D2ClosureProbe051Result);
