(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var File = Packages.java.io.File;
    var FOS = Packages.java.io.FileOutputStream;
    var OSW = Packages.java.io.OutputStreamWriter;
    var BW = Packages.java.io.BufferedWriter;
    var logFile = null;

    function redact(value) {
        return String(value === null || value === undefined ? "" : value)
            .replace(/(token|secret|password|api[_-]?key)\s*[:=]\s*[^\s,;]+/ig,
                "$1=<redacted>");
    }

    function write(level, message) {
        var writer = null;
        if (logFile === null) { return false; }
        try {
            writer = new BW(new OSW(new FOS(logFile, true), "UTF-8"));
            writer.write(ClipHub.Base.now() + " [" + level + "] " +
                redact(message) + "\n");
            writer.flush();
            return true;
        } catch (ignored) {
            return false;
        } finally {
            if (writer !== null) {
                try { writer.close(); } catch (closeIgnored) {}
            }
        }
    }

    ClipHub.Log = {
        MODULE_NAME: "ch_02_log",
        MODULE_VERSION: 1,
        init: function (context) {
            var dir = ClipHub.Base.ensureDir(
                ClipHub.Base.joinPath(context.runtimeDir, "logs")
            );
            logFile = new File(dir, "cliphub.log");
            return write("I", "log initialized");
        },
        debug: function (value) { return write("D", value); },
        info: function (value) { return write("I", value); },
        warn: function (value) { return write("W", value); },
        error: function (value) { return write("E", value); },
        shutdown: function () {
            write("I", "log shutdown");
            logFile = null;
            return true;
        }
    };
}((function () { return this; }())));
