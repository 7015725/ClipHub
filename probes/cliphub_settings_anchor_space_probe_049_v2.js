/* ClipHub Settings anchor-space regression probe 049 v2. Rhino ES5 only. */
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
    var baseImplementationCommit = "2a423cffe0a8ccdd75366de2c96e7ff83cfb5181";
    var target = "https://raw.githubusercontent.com/7015725/ClipHub/" +
        baseImplementationCommit + "/probes/" +
        "cliphub_settings_top_clip_probe_049_impl.js" +
        "?_=" + Number(System.currentTimeMillis());

    function replaceRequired(text, oldText, newText, label) {
        if (text.indexOf(oldText) < 0) {
            throw new Error("Probe 049 v2 missing marker: " + label);
        }
        return text.split(oldText).join(newText);
    }

    try {
        connection = new URL(target).openConnection();
        connection.setUseCaches(false);
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(20000);
        connection.setRequestProperty("Cache-Control", "no-cache, no-store");
        connection.setRequestProperty("Pragma", "no-cache");
        connection.setRequestProperty("User-Agent", "ClipHub-Probe/049-v2");
        input = connection.getInputStream();
        reader = new BR(new ISR(input, "UTF-8"));
        while ((line = reader.readLine()) !== null) {
            builder.append(line).append("\n");
        }
        source = String(builder.toString());
        if (!source ||
                source.indexOf('REQUIRED_SET = "20260723.06"') < 0 ||
                source.indexOf("settingsModuleVersion !== 8") < 0 ||
                source.indexOf("result.settingsModuleVersion === 8") < 0 ||
                source.indexOf("result.topClipGuardPassed =") < 0 ||
                source.indexOf("lastSectionViewportTopDp") < 0) {
            throw new Error("Probe 049 v1 base implementation validation failed");
        }

        source = replaceRequired(source,
            'REQUIRED_SET = "20260723.06"',
            'REQUIRED_SET = "20260723.07"', "module set");
        source = replaceRequired(source,
            "probeVersion: 1", "probeVersion: 2", "probe version");
        source = replaceRequired(source,
            "settingsModuleVersion !== 8",
            "settingsModuleVersion !== 9", "Settings requirement");
        source = replaceRequired(source,
            "Settings v8 is required",
            "Settings v9 is required", "Settings error text");
        source = replaceRequired(source,
            "result.settingsModuleVersion === 8",
            "result.settingsModuleVersion === 9", "final Settings assertion");
        source = replaceRequired(source,
            '                Number(state.lastSectionViewportTopDp) <= 12;',
            '                Number(state.lastSectionViewportTopDp) <= 12 &&\n' +
            '                Number(state.sectionAnchorAdjustmentCount) >= 1 &&\n' +
            '                Number(state.sectionAnchorSpacerHeightDp) > 0 &&\n' +
            '                Number(state.lastMaxScrollYDp) >=\n' +
            '                    Number(state.lastRequestedScrollYDp);',
            "anchor-space assertions");
        source = replaceRequired(source,
            'probe: "cliphub_settings_top_clip_probe_049"',
            'probe: "cliphub_settings_anchor_space_probe_049"',
            "probe name");
        source = replaceRequired(source,
            '"cliphub_settings_top_clip_probe_049_"',
            '"cliphub_settings_anchor_space_probe_049_v2_"',
            "output name");
        source = replaceRequired(source,
            '"probe049_settings_top_clip"',
            '"probe049_v2_settings_anchor_space"',
            "stop reason");

        if (source.indexOf('REQUIRED_SET = "20260723.07"') < 0 ||
                source.indexOf("settingsModuleVersion !== 9") < 0 ||
                source.indexOf("sectionAnchorAdjustmentCount") < 0 ||
                source.indexOf("sectionAnchorSpacerHeightDp") < 0 ||
                source.indexOf("lastMaxScrollYDp") < 0 ||
                source.indexOf("lastRequestedScrollYDp") < 0) {
            throw new Error("Probe 049 v2 patched implementation validation failed");
        }
        eval(source + "\n//# sourceURL=ClipHub/probe_049_v2_impl.js");
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
