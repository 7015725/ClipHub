/* ClipHub stage 3D2 closure probe 051 v2 loader. Rhino ES5 only. */
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
    var original;
    var replacement;
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
        connection.setRequestProperty("User-Agent", "ClipHub-Probe/051-v2");
        input = connection.getInputStream();
        reader = new BR(new ISR(input, "UTF-8"));
        while ((line = reader.readLine()) !== null) {
            builder.append(line).append("\n");
        }
        source = String(builder.toString());
        if (!source ||
                source.indexOf("REQUIRED_SET = \"20260723.09\"") < 0 ||
                source.indexOf("result.typeFilter = global.ClipHub.Filter.performTypeClick(\"url\");") < 0 ||
                source.indexOf("containsText(state.criteria.contentTypes, \"url\")") < 0 ||
                source.indexOf("editorIdlePollPassed") < 0 ||
                source.indexOf("settingsIdlePollPassed") < 0) {
            throw new Error("Probe 051 v1 implementation validation failed");
        }

        source = source.replace(/probeVersion: 1/g, "probeVersion: 2");

        original =
            "            result.typeFilter = global.ClipHub.Filter.performTypeClick(\"url\");\n" +
            "            result.tagFilter = global.ClipHub.Filter.performTagClick(result.tagB);";
        replacement =
            "            result.contentTypeFilterDisabled =\n" +
            "                global.ClipHub.Filter.getContentTypeOptions().length === 0;\n" +
            "            result.typeFilter = result.contentTypeFilterDisabled;\n" +
            "            result.tagFilter = global.ClipHub.Filter.performTagClick(result.tagB);";
        if (source.indexOf(original) < 0) {
            throw new Error("Probe 051 type-filter block not found");
        }
        source = source.replace(original, replacement);

        original =
            "                return Number(state.lastResultCount) === 1 &&\n" +
            "                    Number(state.panel.resultCardCount) === 1 &&\n" +
            "                    containsText(state.criteria.contentTypes, \"url\") &&\n" +
            "                    containsNumber(state.criteria.tagIds, result.tagB);";
        replacement =
            "                return Number(state.lastResultCount) === 1 &&\n" +
            "                    Number(state.panel.resultCardCount) === 1 &&\n" +
            "                    state.criteria.contentTypes.length === 0 &&\n" +
            "                    containsNumber(state.criteria.tagIds, result.tagB);";
        if (source.indexOf(original) < 0) {
            throw new Error("Probe 051 advanced assertion block not found");
        }
        source = source.replace(original, replacement);

        original =
            "            result.advancedPassed = result.drawerReadyForBack === true &&\n" +
            "                result.drawerBackReady === true &&\n" +
            "                result.advancedReady === true;";
        replacement =
            "            result.advancedPassed =\n" +
            "                result.contentTypeFilterDisabled === true &&\n" +
            "                result.drawerReadyForBack === true &&\n" +
            "                result.drawerBackReady === true &&\n" +
            "                result.advancedReady === true;";
        if (source.indexOf(original) < 0) {
            throw new Error("Probe 051 advanced result block not found");
        }
        source = source.replace(original, replacement);

        if (source.indexOf("probeVersion: 2") < 0 ||
                source.indexOf("contentTypeFilterDisabled") < 0 ||
                source.indexOf("performTypeClick(\"url\")") >= 0 ||
                source.indexOf("containsText(state.criteria.contentTypes, \"url\")") >= 0) {
            throw new Error("Probe 051 v2 source patch validation failed");
        }

        eval(source + "\n//# sourceURL=ClipHub/probe_051_impl_v2.js");
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
