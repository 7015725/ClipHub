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
    var implementationCommit = "75bd23e631cf06d1c1bb3adb5b12091e8d8d03b6";
    var target = "https://raw.githubusercontent.com/7015725/ClipHub/" +
        implementationCommit + "/probes/" +
        "cliphub_tag_management_probe_047_impl.js" +
        "?_=" + Number(System.currentTimeMillis());

    function replaceOnce(text, oldText, newText, label) {
        var index = text.indexOf(oldText);
        if (index < 0) {
            throw new Error("Probe 047 patch marker missing: " + label);
        }
        return text.substring(0, index) + newText +
            text.substring(index + oldText.length);
    }

    function replaceBetween(text, startMarker, endMarker, replacement, label) {
        var start = text.indexOf(startMarker);
        var end;
        if (start < 0) {
            throw new Error("Probe 047 section start missing: " + label);
        }
        end = text.indexOf(endMarker, start + startMarker.length);
        if (end < 0) {
            throw new Error("Probe 047 section end missing: " + label);
        }
        return text.substring(0, start) + replacement +
            text.substring(end + endMarker.length);
    }

    try {
        connection = new URL(target).openConnection();
        connection.setUseCaches(false);
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(20000);
        connection.setRequestProperty("Cache-Control", "no-cache, no-store");
        connection.setRequestProperty("Pragma", "no-cache");
        connection.setRequestProperty("User-Agent", "ClipHub-Probe/047-v4-guarded");
        input = connection.getInputStream();
        reader = new BR(new ISR(input, "UTF-8"));
        while ((line = reader.readLine()) !== null) {
            builder.append(line).append("\n");
        }
        source = String(builder.toString());
        if (!source || source.indexOf("probeVersion: 1") < 0 ||
                source.indexOf("REQUIRED_SET = \"20260723.04\"") < 0 ||
                source.indexOf("function stopFormal(context, runtimeDir) {") < 0 ||
                source.indexOf("function start(root, moduleDir, runtimeDir) {") < 0 ||
                source.indexOf("transactionalTagSelectionRequired") < 0 ||
                source.indexOf("performTagSelectionSaveClick") < 0 ||
                source.indexOf("performDeleteTagConfirm") < 0 ||
                source.indexOf("cliphub_tag_management_probe_047") < 0) {
            throw new Error("Probe 047 base implementation validation failed");
        }

        source = replaceBetween(source,
            "    function stopFormal(context, runtimeDir) {",
            "    function start(root, moduleDir, runtimeDir) {",
            [
                "    function controlFormal(context, runtimeDir, command) {",
                "        var cacheDir = ensureDir(new File(runtimeDir, \"cache\"));",
                "        var endpointFile = new File(cacheDir, \"control_endpoint.json\");",
                "        var endpoint;",
                "        var requestId;",
                "        var ackFile;",
                "        var intent;",
                "        var ack = null;",
                "        command = String(command || \"status\");",
                "        if (lockFree(runtimeDir)) {",
                "            return { ok: false, command: command,",
                "                error: \"Formal instance is not running\" };",
                "        }",
                "        if (!endpointFile.isFile()) {",
                "            return { ok: false, command: command,",
                "                error: \"Formal control endpoint is missing\" };",
                "        }",
                "        endpoint = JSON.parse(read(endpointFile));",
                "        requestId = stamp(now()) + \"-\" +",
                "            Number(Thread.currentThread().getId());",
                "        ackFile = new File(cacheDir,",
                "            \"control_ack_\" + requestId + \".json\");",
                "        if (ackFile.exists()) { ackFile.delete(); }",
                "        intent = new Intent(String(endpoint.action));",
                "        intent.putExtra(\"runtimeDir\", String(runtimeDir.getAbsolutePath()));",
                "        intent.putExtra(\"command\", command);",
                "        intent.putExtra(\"requestId\", requestId);",
                "        intent.putExtra(\"controlToken\", String(endpoint.token));",
                "        context.sendBroadcast(intent);",
                "        waitFor(function () { return ackFile.isFile(); }, 3500);",
                "        if (ackFile.isFile()) {",
                "            try { ack = JSON.parse(read(ackFile)); }",
                "            catch (ignoredAck) {}",
                "            ackFile.delete();",
                "        }",
                "        return {",
                "            ok: ack !== null && ack.ok === true &&",
                "                String(ack.command || \"\") === command,",
                "            command: command,",
                "            ack: ack,",
                "            lockStillHeld: !lockFree(runtimeDir),",
                "            endpointPresent: endpointFile.isFile(),",
                "            error: ack === null ?",
                "                \"Control acknowledgement not received\" : null",
                "        };",
                "    }",
                "",
                "    function start(root, moduleDir, runtimeDir) {"
            ].join("\n"),
            "formal control");

        source = replaceOnce(source,
            [
                "    function start(root, moduleDir, runtimeDir) {",
                "        var index;",
                "        var file;",
                "        global.ClipHub = {};",
                "        for (index = 0; index < MODULES.length; index += 1) {",
                "            file = new File(moduleDir, MODULES[index]);",
                "            if (!file.isFile()) {",
                "                throw new Error(\"Missing module: \" + file.getAbsolutePath());",
                "            }",
                "            eval(read(file));",
                "        }",
                "        return global.ClipHub.App.start({",
                "            shortxRoot: root,",
                "            runtimeDir: String(runtimeDir.getAbsolutePath()),",
                "            moduleDir: String(moduleDir.getAbsolutePath()),",
                "            androidContext: global.context",
                "        });",
                "    }"
            ].join("\n"),
            [
                "    function patchEditorModuleSource(moduleSource) {",
                "        var oldMetrics = [",
                "            \"    function displayMetrics() {\",",
                "            \"        var metrics = new DisplayMetrics();\",",
                "            \"        try {\",",
                "            \"            windowManager.getDefaultDisplay().getRealMetrics(metrics);\",",
                "            \"        } catch (ignored) {\",",
                "            \"            metrics = appContext.getResources().getDisplayMetrics();\",",
                "            \"        }\",",
                "            \"        return metrics;\",",
                "            \"    }\"",
                "        ].join(\"\\n\");",
                "        var newMetrics = [",
                "            \"    function displayMetrics() {\",",
                "            \"        var metrics = new DisplayMetrics();\",",
                "            \"        if (windowManager !== null) {\",",
                "            \"            try {\",",
                "            \"                windowManager.getDefaultDisplay().getRealMetrics(metrics);\",",
                "            \"                if (Number(metrics.widthPixels) > 0 &&\",",
                "            \"                        Number(metrics.heightPixels) > 0) {\",",
                "            \"                    return metrics;\",",
                "            \"                }\",",
                "            \"            } catch (ignoredWindow) {}\",",
                "            \"        }\",",
                "            \"        if (appContext !== null) {\",",
                "            \"            try { return appContext.getResources().getDisplayMetrics(); }\",",
                "            \"            catch (ignoredContext) {}\",",
                "            \"        }\",",
                "            \"        return metrics;\",",
                "            \"    }\"",
                "        ].join(\"\\n\");",
                "        var oldObserver = [",
                "            \"            startEditorImePolling();\",",
                "            \"            mainHandler.postDelayed(new Packages.java.lang.Runnable({\",",
                "            \"                run: function () {\",",
                "            \"                    var ime = readImeState();\",",
                "            \"                    applyEditorImeLayout(ime);\",",
                "            \"                    measureEditorLayout(ime);\",",
                "            \"                }\",",
                "            \"            }), 180);\"",
                "        ].join(\"\\n\");",
                "        var newObserver = [",
                "            \"            startEditorImePolling();\",",
                "            \"            (function (generation) {\",",
                "            \"                mainHandler.postDelayed(\",",
                "            \"                    new Packages.java.lang.Runnable({\",",
                "            \"                        run: function () {\",",
                "            \"                            var ime;\",",
                "            \"                            if (generation !== imePollGeneration ||\",",
                "            \"                                    !ready || !state.attached ||\",",
                "            \"                                    panelRoot === null ||\",",
                "            \"                                    appContext === null ||\",",
                "            \"                                    windowManager === null) {\",",
                "            \"                                return;\",",
                "            \"                            }\",",
                "            \"                            ime = readImeState();\",",
                "            \"                            applyEditorImeLayout(ime);\",",
                "            \"                            measureEditorLayout(ime);\",",
                "            \"                        }\",",
                "            \"                    }), 180);\",",
                "            \"            }(imePollGeneration));\"",
                "        ].join(\"\\n\");",
                "        if (moduleSource.indexOf(oldMetrics) < 0 ||",
                "                moduleSource.indexOf(oldObserver) < 0) {",
                "            throw new Error(\"Editor shutdown guard markers missing\");",
                "        }",
                "        moduleSource = moduleSource.replace(oldMetrics, newMetrics);",
                "        moduleSource = moduleSource.replace(oldObserver, newObserver);",
                "        global.ClipHubProbe047EditorGuardApplied = true;",
                "        return moduleSource;",
                "    }",
                "",
                "    function start(root, moduleDir, runtimeDir) {",
                "        var index;",
                "        var file;",
                "        var moduleSource;",
                "        global.ClipHub = {};",
                "        global.ClipHubProbe047EditorGuardApplied = false;",
                "        for (index = 0; index < MODULES.length; index += 1) {",
                "            file = new File(moduleDir, MODULES[index]);",
                "            if (!file.isFile()) {",
                "                throw new Error(\"Missing module: \" + file.getAbsolutePath());",
                "            }",
                "            moduleSource = read(file);",
                "            if (String(MODULES[index]) === \"ch_10_editor.js\") {",
                "                moduleSource = patchEditorModuleSource(moduleSource);",
                "            }",
                "            eval(moduleSource);",
                "        }",
                "        return global.ClipHub.App.start({",
                "            shortxRoot: root,",
                "            runtimeDir: String(runtimeDir.getAbsolutePath()),",
                "            moduleDir: String(moduleDir.getAbsolutePath()),",
                "            androidContext: global.context",
                "        });",
                "    }"
            ].join("\n"),
            "editor shutdown race guard");

        source = replaceOnce(source,
            [
                "            result.formalControl = stopFormal(global.context, formal);",
                "            if (!result.formalControl.ok) {",
                "                throw new Error(result.formalControl.error ||",
                "                    \"Formal stop failed\");",
                "            }",
                "            removeTree(isolated);",
                "            result.start = start(root, modules, isolated);"
            ].join("\n"),
            [
                "            result.formalLifecycleMode = \"hide_restore\";",
                "            if (formalWasRunning) {",
                "                result.lastCheckpoint = \"before_formal_hide\";",
                "                write(outputFile, JSON.stringify(result, null, 2) + \"\\n\");",
                "                result.formalControl = controlFormal(",
                "                    global.context, formal, \"hide\");",
                "                result.lastCheckpoint = \"after_formal_hide\";",
                "                write(outputFile, JSON.stringify(result, null, 2) + \"\\n\");",
                "                if (!result.formalControl.ok ||",
                "                        !result.formalControl.ack ||",
                "                        !result.formalControl.ack.status ||",
                "                        result.formalControl.ack.status.uiVisible !== false) {",
                "                    throw new Error(result.formalControl.error ||",
                "                        \"Formal UI hide failed\");",
                "                }",
                "            } else {",
                "                result.formalControl = { ok: true, skipped: true,",
                "                    reason: \"formal_was_not_running\" };",
                "            }",
                "            removeTree(isolated);",
                "            result.lastCheckpoint = \"before_isolated_start\";",
                "            write(outputFile, JSON.stringify(result, null, 2) + \"\\n\");",
                "            result.start = start(root, modules, isolated);",
                "            result.editorShutdownRaceGuardApplied =",
                "                global.ClipHubProbe047EditorGuardApplied === true;",
                "            result.lastCheckpoint = \"after_isolated_start\";",
                "            write(outputFile, JSON.stringify(result, null, 2) + \"\\n\");"
            ].join("\n"),
            "safe formal hide");

        source = replaceOnce(source,
            [
                "            result.newEditorOpen = global.ClipHub.Editor.openNew({",
                "                text: \"ClipHub 新记录标签保存测试\",",
                "                requestKeyboard: false",
                "            });",
                "            waitFor(function () {",
                "                return global.ClipHub.Editor.getState().mode === \"new\";",
                "            }, 1000);",
                "            global.ClipHub.Editor.performOpenTagSelectorClick();"
            ].join("\n"),
            [
                "            result.newEditorOpen = global.ClipHub.Editor.openNew({",
                "                requestKeyboard: false",
                "            });",
                "            waitFor(function () {",
                "                return global.ClipHub.Editor.getState().mode === \"new\";",
                "            }, 1000);",
                "            result.newEditorTextSet = global.ClipHub.Editor.setInputText(",
                "                \"ClipHub 新记录标签保存测试\");",
                "            global.ClipHub.Editor.performOpenTagSelectorClick();"
            ].join("\n"),
            "new record input");

        source = replaceOnce(source,
            [
                "                result.newEditorSave === true &&",
                "                result.newItemId > 0 &&"
            ].join("\n"),
            [
                "                result.editorShutdownRaceGuardApplied === true &&",
                "                result.newEditorTextSet === true &&",
                "                result.newEditorSave === true &&",
                "                result.newItemId > 0 &&"
            ].join("\n"),
            "guarded new record assertion");

        source = replaceOnce(source,
            [
                "            result.hide = global.ClipHub.App.executeControlCommand(\"hide\");",
                "            result.stop = global.ClipHub.App.stop(",
                "                \"probe047_tag_management\");",
                "            result.databaseClosed = !global.ClipHub.Database.isOpen();",
                "            result.lockReleased = lockFree(isolated);"
            ].join("\n"),
            [
                "            result.lastCheckpoint = \"before_isolated_hide\";",
                "            write(outputFile, JSON.stringify(result, null, 2) + \"\\n\");",
                "            result.hide = global.ClipHub.App.executeControlCommand(\"hide\");",
                "            result.lastCheckpoint = \"after_isolated_hide\";",
                "            write(outputFile, JSON.stringify(result, null, 2) + \"\\n\");",
                "            Thread.sleep(500);",
                "            result.lastCheckpoint = \"before_isolated_stop\";",
                "            write(outputFile, JSON.stringify(result, null, 2) + \"\\n\");",
                "            result.stop = global.ClipHub.App.stop(",
                "                \"probe047_tag_management\");",
                "            result.databaseClosed = !global.ClipHub.Database.isOpen();",
                "            result.lockReleased = lockFree(isolated);",
                "            result.lastCheckpoint = \"after_isolated_stop\";",
                "            write(outputFile, JSON.stringify(result, null, 2) + \"\\n\");"
            ].join("\n"),
            "isolated stop checkpoints");

        source = replaceOnce(source,
            [
                "                if (formalWasRunning) {",
                "                    result.formalRestart = lockFree(formal) ?",
                "                        start(root, modules, formal) :",
                "                        { ok: true, started: true, reused: true };",
                "                } else {",
                "                    result.formalRestart = {",
                "                        ok: true, skipped: true,",
                "                        reason: \"formal_was_not_running\"",
                "                    };",
                "                }"
            ].join("\n"),
            [
                "                if (formalWasRunning) {",
                "                    result.lastCheckpoint = \"before_formal_restore\";",
                "                    write(outputFile, JSON.stringify(result, null, 2) + \"\\n\");",
                "                    result.formalRestart = controlFormal(",
                "                        global.context, formal, \"show\");",
                "                    result.formalRestore = result.formalRestart;",
                "                    result.lastCheckpoint = \"after_formal_restore\";",
                "                } else {",
                "                    result.formalRestart = {",
                "                        ok: true, skipped: true,",
                "                        reason: \"formal_was_not_running\"",
                "                    };",
                "                    result.formalRestore = result.formalRestart;",
                "                }"
            ].join("\n"),
            "formal restore");

        source = source.split("probeVersion: 1").join("probeVersion: 4");
        if (source.indexOf("probeVersion: 4") < 0 ||
                source.indexOf("patchEditorModuleSource") < 0 ||
                source.indexOf("editorShutdownRaceGuardApplied") < 0 ||
                source.indexOf("formalLifecycleMode = \"hide_restore\"") < 0 ||
                source.indexOf("before_isolated_stop") < 0 ||
                source.indexOf("newEditorTextSet") < 0) {
            throw new Error("Probe 047 v4 guarded patch failed");
        }
        eval(source + "\n//# sourceURL=ClipHub/probe_047_impl_v4_guarded.js");
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
