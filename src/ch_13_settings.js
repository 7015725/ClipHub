(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var values = {};
    ClipHub.Settings = {
        MODULE_NAME: "ch_13_settings",
        MODULE_VERSION: 1,
        init: function () {
            values = {
                historyLimit: 500,
                autoCleanupDays: 30,
                closeAfterCopy: false,
                themeMode: "system"
            };
            return true;
        },
        get: function (key, fallback) {
            return Object.prototype.hasOwnProperty.call(values, key)
                ? values[key] : fallback;
        },
        set: function (key, value) { values[String(key)] = value; return value; },
        shutdown: function () { values = {}; return true; }
    };
}((function () { return this; }())));
