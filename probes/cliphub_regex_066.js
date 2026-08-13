/* ClipHub Regex Tester lifecycle probe 066 static smoke only. Rhino ES5.
 * Full lifecycle PASS requires cliphub_regex_tester_lifecycle_probe_066.md
 * on Android / ShortX; this script intentionally does not report ok:true.
 */
(function (global) {
    var C = global.ClipHub;
    var state = C.Settings.getState();
    if (Number(C.Settings.MODULE_VERSION) < 26) {
        throw new Error("Regex tester lifecycle module version failed");
    }
    if (String(state.settingsPage || "").length < 1) {
        throw new Error("Regex tester lifecycle state unavailable");
    }
    ({ probe: 66, smokeOnly: true, manualRequired: true,
        gate: "cliphub_regex_tester_lifecycle_probe_066.md",
        settingsPage: state.settingsPage,
        regexTestRunning: state.regexTestRunning === true });
}((function () { return this; }())));
