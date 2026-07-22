/* ClipHub editor keyboard and long-text probe 041 loader. Rhino ES5 only. */
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
        "f639d4257aa79e0daa8a22252a85f7044894cfec";
    var target = "https://raw.githubusercontent.com/7015725/ClipHub/" +
        implementationCommit + "/probes/" +
        "cliphub_editor_keyboard_probe_041_impl.js" +
        "?_=" + Number(System.currentTimeMillis());

    try {
        connection = new URL(target).openConnection();
        connection.setUseCaches(false);
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(20000);
        connection.setRequestProperty("Cache-Control", "no-cache, no-store");
        connection.setRequestProperty("Pragma", "no-cache");
        connection.setRequestProperty("User-Agent", "ClipHub-Probe/041-v1");
        input = connection.getInputStream();
        reader = new BR(new ISR(input, "UTF-8"));
        while ((line = reader.readLine()) !== null) {
            builder.append(line).append("\n");
        }
        source = String(builder.toString());
        if (!source) {
            throw new Error("Probe 041 implementation is empty");
        }
        if (source.indexOf("probeVersion: 1") < 0 ||
                source.indexOf("REQUIRED_SET = \"20260722.34\"") < 0 ||
                source.indexOf("editorModuleVersion === 7") < 0 ||
                source.indexOf("navigationModuleVersion === 3") < 0 ||
                source.indexOf("cliphub_editor_keyboard_probe_041") < 0 ||
                source.indexOf("reference_editor_v3") < 0 ||
                source.indexOf("firstBackHidKeyboard") < 0 ||
                source.indexOf("secondBackClosedEditor") < 0 ||
                source.indexOf("footerAboveKeyboard") < 0 ||
                source.indexOf("keyboardAvoidanceApplied") < 0 ||
                source.indexOf("imeInsetSource") < 0) {
            throw new Error("Probe 041 implementation validation failed");
        }
        eval(source + "\n//# sourceURL=ClipHub/probe_041_impl_v1.js");
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

JSON.stringify(ClipHubEditorKeyboardProbe041Result);
