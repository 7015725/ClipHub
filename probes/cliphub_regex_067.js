/* ClipHub regex delete-confirm rebuild probe 067. Rhino ES5. */
(function (global) {
    var C = global.ClipHub;
    var state = C.Settings.getState();
    if (Number(C.Settings.MODULE_VERSION) < 26) {
        throw new Error("Regex delete-confirm module version failed");
    }
    ({ probe: 67, ok: true, settingsPage: state.settingsPage,
        deleteConfirmCount: Number(state.regexDeleteConfirmCount || 0) });
}((function () { return this; }())));
