/*
 * ClipHub ShortX entry. Rhino ES5 only.
 * Runtime: shortx.getShortXDir()/ClipHub/modules/
 */
(function (global) {
    var NAMES = [
        "ch_01_base.js", "ch_02_log.js", "ch_03_database.js",
        "ch_04_clipboard.js", "ch_05_classifier.js",
        "ch_06_repository.js", "ch_07_theme.js", "ch_08_window.js",
        "ch_09_list.js", "ch_10_editor.js", "ch_11_filter.js",
        "ch_12_translation.js", "ch_13_settings.js",
        "ch_14_event_bus.js", "ch_15_app.js"
    ];

    function readUtf8(file) {
        var FIS = Packages.java.io.FileInputStream;
        var ISR = Packages.java.io.InputStreamReader;
        var BR = Packages.java.io.BufferedReader;
        var SB = Packages.java.lang.StringBuilder;
        var reader = null;
        var builder = new SB();
        var line;
        try {
            reader = new BR(new ISR(new FIS(file), "UTF-8"));
            while ((line = reader.readLine()) !== null) {
                builder.append(line).append("\n");
            }
            return String(builder.toString());
        } finally {
            if (reader !== null) {
                try { reader.close(); } catch (ignored) {}
            }
        }
    }

    function loadModules(moduleDir) {
        var File = Packages.java.io.File;
        var index;
        var file;
        for (index = 0; index < NAMES.length; index += 1) {
            file = new File(moduleDir, NAMES[index]);
            if (!file.isFile()) {
                throw new Error("Missing module: " + file.getAbsolutePath());
            }
            eval(readUtf8(file));
        }
    }

    function start() {
        var File = Packages.java.io.File;
        var root;
        var runtimeDir;
        var moduleDir;
        if (typeof shortx === "undefined" ||
                typeof shortx.getShortXDir !== "function") {
            throw new Error("ShortX runtime is unavailable");
        }
        root = String(shortx.getShortXDir());
        runtimeDir = new File(root, "ClipHub");
        moduleDir = new File(runtimeDir, "modules");
        global.ClipHub = global.ClipHub || {};
        loadModules(moduleDir);
        return global.ClipHub.App.start({
            shortxRoot: root,
            runtimeDir: String(runtimeDir.getAbsolutePath()),
            moduleDir: String(moduleDir.getAbsolutePath())
        });
    }

    try {
        global.ClipHubBootstrapResult = start();
    } catch (error) {
        global.ClipHubBootstrapResult = {
            ok: false,
            started: false,
            error: String(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubBootstrapResult);
