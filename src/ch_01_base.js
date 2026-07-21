(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var File = Packages.java.io.File;
    var System = Packages.java.lang.System;

    function text(value) {
        return value === null || value === undefined ? "" : String(value);
    }

    function ensureDir(path) {
        var dir = new File(text(path));
        if (!dir.isDirectory() && !dir.mkdirs() && !dir.isDirectory()) {
            throw new Error("Cannot create directory: " + dir.getAbsolutePath());
        }
        return dir;
    }

    ClipHub.Base = {
        MODULE_NAME: "ch_01_base",
        MODULE_VERSION: 1,
        now: function () { return Number(System.currentTimeMillis()); },
        text: text,
        joinPath: function (parent, child) {
            return String(new File(text(parent), text(child)).getAbsolutePath());
        },
        ensureDir: ensureDir,
        init: function (context) {
            ensureDir(context.runtimeDir);
            ensureDir(this.joinPath(context.runtimeDir, "data"));
            ensureDir(this.joinPath(context.runtimeDir, "logs"));
            ensureDir(this.joinPath(context.runtimeDir, "cache"));
            return true;
        },
        shutdown: function () { return true; }
    };
}((function () { return this; }())));
