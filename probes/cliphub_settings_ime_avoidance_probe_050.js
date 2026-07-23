/* ClipHub Settings IME avoidance probe 050 loader. Rhino ES5 only. */
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
    var implementationCommit = "db6a11b8824ace1fe2d3caf22b0c0581323fb39c";
    var target = "https://raw.githubusercontent.com/7015725/ClipHub/" +
        implementationCommit + "/probes/" +
        "cliphub_settings_ime_avoidance_probe_050_impl.js" +
        "?_=" + Number(System.currentTimeMillis());

    try {
        connection = new URL(target).openConnection();
        connection.setUseCaches(false);
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(20000);
        connection.setRequestProperty("Cache-Control", "no-cache, no-store");
        connection.setRequestProperty("Pragma", "no-cache");
        connection.setRequestProperty("User-Agent", "ClipHub-Probe/050-v1");
        input = connection.getInputStream();
        reader = new BR(new ISR(input, "UTF-8"));
        while ((line = reader.readLine()) !== null) {
            builder.append(line).append("\n");
        }
        source = String(builder.toString());
        if (!source ||
                source.indexOf("REQUIRED_SET = \"20260723.08\"") < 0 ||
                source.indexOf("settingsModuleVersion !== 10") < 0 ||
                source.indexOf("translationImePassed") < 0 ||
                source.indexOf("tagImePassed") < 0 ||
                source.indexOf("restorePassed") < 0 ||
                source.indexOf("cliphub_settings_ime_avoidance_probe_050") < 0) {
            throw new Error("Probe 050 implementation validation failed");
        }
        eval(source + "\n//# sourceURL=ClipHub/probe_050_impl_v1.js");
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

JSON.stringify(ClipHubSettingsImeAvoidanceProbe050Result);
