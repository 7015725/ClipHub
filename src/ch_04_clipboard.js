(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var running = false;
    var ownWrite = { hash: "", at: 0 };

    ClipHub.Clipboard = {
        MODULE_NAME: "ch_04_clipboard",
        MODULE_VERSION: 1,
        init: function () { running = false; return true; },
        start: function () { running = true; return true; },
        stop: function () { running = false; return true; },
        markOwnWrite: function (hash, at) {
            ownWrite.hash = String(hash || "");
            ownWrite.at = Number(at || 0);
        },
        getState: function () {
            return { running: running, ownWrite: ownWrite };
        },
        shutdown: function () { return this.stop(); }
    };
}((function () { return this; }())));
