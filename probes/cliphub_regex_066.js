/* ClipHub Regex Tester lifecycle probe 066. Rhino ES5. */
(function (global) {
    var C = global.ClipHub;
    var before = C.Settings.getState();
    if (Number(C.Settings.MODULE_VERSION) < 26) {
        throw new Error("Regex tester lifecycle module version failed");
    }
    if (String(before.settingsPage || "").length < 1) {
        throw new Error("Regex tester lifecycle state unavailable");
    }
    ({ probe: 66, ok: true, settingsPage: before.settingsPage,
        regexTestRunning: before.regexTestRunning === true });
}((function () { return this; }())));
