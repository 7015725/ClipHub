(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var mode = "system";
    ClipHub.Theme = {
        MODULE_NAME: "ch_07_theme",
        MODULE_VERSION: 1,
        init: function () { mode = "system"; return true; },
        setMode: function (value) {
            if (value !== "system" && value !== "light" && value !== "dark") {
                throw new Error("Unsupported theme mode: " + value);
            }
            mode = value;
            return mode;
        },
        getMode: function () { return mode; },
        shutdown: function () { return true; }
    };
}((function () { return this; }())));
