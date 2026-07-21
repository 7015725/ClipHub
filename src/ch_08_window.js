(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var state = { attached: false, collapsed: false, pinned: false };
    ClipHub.Window = {
        MODULE_NAME: "ch_08_window",
        MODULE_VERSION: 1,
        init: function () { state.attached = false; return true; },
        open: function () { state.attached = true; return true; },
        close: function () {
            state.attached = false;
            state.collapsed = false;
            return true;
        },
        setCollapsed: function (value) {
            state.collapsed = Boolean(value);
            return state.collapsed;
        },
        setPinned: function (value) {
            state.pinned = Boolean(value);
            return state.pinned;
        },
        getState: function () { return state; },
        shutdown: function () { return this.close(); }
    };
}((function () { return this; }())));
