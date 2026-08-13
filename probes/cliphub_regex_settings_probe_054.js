/* ClipHub regex settings probe 054. Rhino ES5. */
(function (global) {
    var C = global.ClipHub;
    var state = C.Settings.getState();
    var rules = C.Repository.listRegexRules({});
    if (Number(C.Settings.MODULE_VERSION) < 25 || rules.length < 1) {
        throw new Error("Regex settings prerequisites failed");
    }
    ({ probe: 54, ok: true, state: state, ruleCount: rules.length });
}((function () { return this; }())));
