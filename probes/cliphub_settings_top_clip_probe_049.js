/* ClipHub Settings top clipping probe 049 loader. Rhino ES5 only. */
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
    var implementationCommit = "2a423cffe0a8ccdd75366de2c96e7ff83cfb5181";
    var target = "https://raw.githubusercontent.com/7015725/ClipHub/" +
        implementationCommit + "/probes/" +
        "cliphub_settings_top_clip_probe_049_impl.js" +
        "?_=" + Number(System.currentTimeMillis());

    try {
        connection = new URL(target).openConnection();
        connection.setUseCaches(false);
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(20000);
        connection.setRequestProperty("Cache-Control", "no-cache, no-store");
        connection.setRequestProperty("Pragma", "no-cache");
        connection.setRequestProperty("User-Agent", "ClipHub-Probe/049-v1");
        input = connection.getInputStream();
        reader = new BR(new ISR(input, "UTF-8"));
        while ((line = reader.readLine()) !== null) {
            builder.append(line).append("\n");
        }
        source = String(builder.toString());
        if (!source ||
                source.indexOf("REQUIRED_SET = \"20260723.06\"") < 0 ||
                source.indexOf("settingsModuleVersion !== 8") < 0 ||
                source.indexOf("topClipGuardPassed") < 0 ||
                source.indexOf("panelClipToOutline") < 0 ||
                source.indexOf("lastSectionViewportTopDp") < 0 ||
                source.indexOf("cliphub_settings_top_clip_probe_049") < 0) {
            throw new Error("Probe 049 implementation validation failed");
        }
        eval(source + "\n//# sourceURL=ClipHub/probe_049_impl_v1.js");
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

JSON.stringify(ClipHubSettingsTopClipProbe049Result);
