// @version 1.0.0
// ClipHub - 本地脱敏日志
(function (CH) {
    "use strict";

    var base = CH.base;
    var log = {};
    var logFile = null;
    var lock = new java.util.concurrent.locks.ReentrantLock();

    function getLogFile() {
        if (logFile) return logFile;
        var dir = base.ensureChildDir("logs");
        logFile = new java.io.File(dir, "cliphub.log");
        return logFile;
    }

    function sanitize(message) {
        var text = base.string(message, "");
        text = text.replace(/([A-Za-z0-9_\-]{16,})/g, function (match) {
            if (/^[0-9]+$/.test(match)) return match;
            return match.substring(0, 4) + "***" + match.substring(match.length - 3);
        });
        if (text.length > 1500) text = text.substring(0, 1500) + "…";
        return text;
    }

    function write(level, message) {
        var out = null;
        try {
            var line = String(new java.text.SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", java.util.Locale.US)
                .format(new java.util.Date())) + " [" + level + "] " + sanitize(message) + "\n";
            lock.lock();
            try {
                out = new java.io.FileOutputStream(getLogFile(), true);
                out.write(new java.lang.String(line).getBytes("UTF-8"));
                out.flush();
            } finally {
                lock.unlock();
            }
        } catch (eWrite) {
            try {
                android.util.Log.e("ClipHub", level + " " + String(message));
            } catch (eAndroidLog) {}
        } finally {
            try {
                if (out) out.close();
            } catch (eClose) {}
        }
    }

    log.debug = function (message) { write("D", message); };
    log.info = function (message) { write("I", message); };
    log.warn = function (message) { write("W", message); };
    log.error = function (message) { write("E", message); };

    log.event = function (name, values) {
        var parts = ["event=" + base.string(name, "unknown")];
        var key = null;
        if (values && typeof values === "object") {
            for (key in values) {
                if (!values.hasOwnProperty(key)) continue;
                parts.push(base.string(key, "") + "=" + sanitize(values[key]));
            }
        }
        write("I", parts.join(" "));
    };

    CH.log = log;
}(CH));
