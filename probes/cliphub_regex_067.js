/* ClipHub Regex delete-confirm rebuild probe 067 static smoke only. Rhino ES5.
 * Full visible-view lifecycle PASS requires
 * cliphub_regex_delete_confirm_rebuild_probe_067.md on Android / ShortX.
 */
(function (global) {
    var C = global.ClipHub;
    var state = C.Settings.getState();
    if (Number(C.Settings.MODULE_VERSION) < 26) {
        throw new Error("Regex delete-confirm module version failed");
    }
    ({ probe: 67, smokeOnly: true, manualRequired: true,
        gate: "cliphub_regex_delete_confirm_rebuild_probe_067.md",
        settingsPage: state.settingsPage,
        deleteConfirmCount: Number(state.regexDeleteConfirmCount || 0) });
}((function () { return this; }())));
