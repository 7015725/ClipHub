/* ClipHub content/tag/settings probe 045 loader. Rhino ES5 only. */
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
    var implementationCommit = "5116965a04c740d7f3f1b177901ad097251bcaff";
    var target = "https://raw.githubusercontent.com/7015725/ClipHub/" +
        implementationCommit + "/probes/" +
        "cliphub_content_tags_settings_probe_045_impl.js" +
        "?_=" + Number(System.currentTimeMillis());
    try {
        connection = new URL(target).openConnection();
        connection.setUseCaches(false);
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(20000);
        connection.setRequestProperty("Cache-Control", "no-cache, no-store");
        connection.setRequestProperty("Pragma", "no-cache");
        connection.setRequestProperty("User-Agent", "ClipHub-Probe/045-v3");
        input = connection.getInputStream();
        reader = new BR(new ISR(input, "UTF-8"));
        while ((line = reader.readLine()) !== null) {
            builder.append(line).append("\n");
        }
        source = String(builder.toString());
        if (!source || source.indexOf("probeVersion: 3") < 0 ||
                source.indexOf("REQUIRED_SET = \"20260723.02\"") < 0 ||
                source.indexOf("contentTypeSettingsPresent") < 0 ||
                source.indexOf("translationModuleVersion === 6") < 0 ||
                source.indexOf("performLoadMoreClick") < 0 ||
                source.indexOf("translationPopupReady") < 0 ||
                source.indexOf("translationTerminalReady") < 0 ||
                source.indexOf("scene1CapturedBeforePagingAndTranslation") < 0 ||
                source.indexOf("settingsConfiguredBeforeOpen") < 0 ||
                source.indexOf("cliphub_content_tags_settings_probe_045") < 0) {
            throw new Error("Probe 045 implementation validation failed");
        }
        eval(source + "\n//# sourceURL=ClipHub/probe_045_impl_v3.js");
    } finally {
        try { if (reader !== null) { reader.close(); } } catch (ignored) {}
        try { if (input !== null) { input.close(); } } catch (ignoredInput) {}
        try { if (connection !== null && connection.disconnect) {
            connection.disconnect();
        }} catch (ignoredConnection) {}
    }
}((function () { return this; }())));

JSON.stringify(ClipHubContentTagsSettingsProbe045Result);
