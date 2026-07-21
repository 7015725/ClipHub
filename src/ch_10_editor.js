(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var state = { open: false, itemId: null };
    ClipHub.Editor = {
        MODULE_NAME: "ch_10_editor",
        MODULE_VERSION: 1,
        init: function () { state.open = false; state.itemId = null; return true; },
        openNew: function () { state.open = true; state.itemId = null; return true; },
        openItem: function (id) { state.open = true; state.itemId = id; return true; },
        close: function () { state.open = false; state.itemId = null; return true; },
        shutdown: function () { return this.close(); }
    };
}((function () { return this; }())));
