/* ClipHub tag management probe 047 loader. Rhino ES5 only. */
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
    var oldNewRecord;
    var newNewRecord;
    var oldNewRecordCheck;
    var newNewRecordCheck;
    var implementationCommit = "75bd23e631cf06d1c1bb3adb5b12091e8d8d03b6";
    var target = "https://raw.githubusercontent.com/7015725/ClipHub/" +
        implementationCommit + "/probes/" +
        "cliphub_tag_management_probe_047_impl.js" +
        "?_=" + Number(System.currentTimeMillis());
    try {
        connection = new URL(target).openConnection();
        connection.setUseCaches(false);
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(20000);
        connection.setRequestProperty("Cache-Control", "no-cache, no-store");
        connection.setRequestProperty("Pragma", "no-cache");
        connection.setRequestProperty("User-Agent", "ClipHub-Probe/047-v2");
        input = connection.getInputStream();
        reader = new BR(new ISR(input, "UTF-8"));
        while ((line = reader.readLine()) !== null) {
            builder.append(line).append("\n");
        }
        source = String(builder.toString());
        if (!source || source.indexOf("probeVersion: 1") < 0 ||
                source.indexOf("REQUIRED_SET = \"20260723.04\"") < 0 ||
                source.indexOf("transactionalTagSelectionRequired") < 0 ||
                source.indexOf("performTagSelectionSaveClick") < 0 ||
                source.indexOf("performDeleteTagConfirm") < 0 ||
                source.indexOf("cliphub_tag_management_probe_047") < 0) {
            throw new Error("Probe 047 base implementation validation failed");
        }

        oldNewRecord = [
            "            result.newEditorOpen = global.ClipHub.Editor.openNew({",
            "                text: \"ClipHub 新记录标签保存测试\",",
            "                requestKeyboard: false",
            "            });",
            "            waitFor(function () {",
            "                return global.ClipHub.Editor.getState().mode === \"new\";",
            "            }, 1000);",
            "            global.ClipHub.Editor.performOpenTagSelectorClick();"
        ].join("\n");
        newNewRecord = [
            "            result.newEditorOpen = global.ClipHub.Editor.openNew({",
            "                requestKeyboard: false",
            "            });",
            "            waitFor(function () {",
            "                return global.ClipHub.Editor.getState().mode === \"new\";",
            "            }, 1000);",
            "            result.newEditorTextSet = global.ClipHub.Editor.setInputText(",
            "                \"ClipHub 新记录标签保存测试\");",
            "            global.ClipHub.Editor.performOpenTagSelectorClick();"
        ].join("\n");
        oldNewRecordCheck = [
            "                result.newEditorSave === true &&",
            "                result.newItemId > 0 &&"
        ].join("\n");
        newNewRecordCheck = [
            "                result.newEditorTextSet === true &&",
            "                result.newEditorSave === true &&",
            "                result.newItemId > 0 &&"
        ].join("\n");
        if (source.indexOf(oldNewRecord) < 0 ||
                source.indexOf(oldNewRecordCheck) < 0) {
            throw new Error("Probe 047 new-record compatibility marker missing");
        }
        source = source.replace(oldNewRecord, newNewRecord);
        source = source.replace(oldNewRecordCheck, newNewRecordCheck);
        source = source.split("probeVersion: 1").join("probeVersion: 2");
        if (source.indexOf("probeVersion: 2") < 0 ||
                source.indexOf("newEditorTextSet") < 0) {
            throw new Error("Probe 047 v2 compatibility patch failed");
        }
        eval(source + "\n//# sourceURL=ClipHub/probe_047_impl_v2.js");
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

JSON.stringify(ClipHubTagManagementProbe047Result);
