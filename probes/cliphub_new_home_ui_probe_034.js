/* ClipHub corrected home UI probe 034 loader. Rhino ES5 only. */
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
        "a9a938a1063f550f4b00e8786eed897a9b0ed9dc";
    var target = "https://raw.githubusercontent.com/7015725/ClipHub/" +
        implementationCommit + "/probes/" +
        "cliphub_new_home_ui_probe_034_impl.js" +
        "?_=" + Number(System.currentTimeMillis());

    try {
        connection = new URL(target).openConnection();
        connection.setUseCaches(false);
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(20000);
        connection.setRequestProperty(
            "Cache-Control", "no-cache, no-store");
        connection.setRequestProperty("Pragma", "no-cache");
        connection.setRequestProperty(
            "User-Agent", "ClipHub-Probe/034-v1");
        input = connection.getInputStream();
        reader = new BR(new ISR(input, "UTF-8"));
        while ((line = reader.readLine()) !== null) {
            builder.append(line).append("\n");
        }
        source = String(builder.toString());
        if (!source) {
            throw new Error("Probe 034 implementation is empty");
        }
        if (source.indexOf("probeVersion: 1") < 0 ||
                source.indexOf(
                    "REQUIRED_SET = \"20260722.27\"") < 0 ||
                source.indexOf("themeModuleVersion === 2") < 0 ||
                source.indexOf("windowModuleVersion === 5") < 0 ||
                source.indexOf("listModuleVersion === 11") < 0 ||
                source.indexOf(
                    "cliphub_new_home_ui_probe_034") < 0 ||
                source.indexOf("performSelectClick(2)") < 0 ||
                source.indexOf("selectionDidNotCopy") < 0) {
            throw new Error(
                "Probe 034 implementation validation failed");
        }
        eval(source +
            "\n//# sourceURL=ClipHub/probe_034_impl_v1.js");
    } finally {
        try {
            if (reader !== null) {
                reader.close();
            }
        } catch (ignoredReader) {}
        try {
            if (input !== null) {
                input.close();
            }
        } catch (ignoredInput) {}
        try {
            if (connection !== null && connection.disconnect) {
                connection.disconnect();
            }
        } catch (ignoredConnection) {}
    }
}((function () { return this; }())));

JSON.stringify(ClipHubNewHomeUiProbe034Result);
