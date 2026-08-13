/* ClipHub pathological regex guard probe 070. Rhino ES5. */
(function (global) {
    var C = global.ClipHub;
    var risky = C.Repository.assessRegexRisk("(a+)+$");
    var safe = C.Repository.assessRegexRisk("a+b+");
    if (!risky.risky || safe.risky) {
        throw new Error("Regex risk assessment failed");
    }
    var blocked = false;
    try {
        C.Repository.createRegexRule({ title: "Probe070-on", note: "",
            pattern: "(a+)+$", flags: 0, enabled: true });
    } catch (error) {
        blocked = String(error).indexOf("regex_pattern_risky") >= 0;
    }
    if (!blocked) { throw new Error("Risky enabled rule was not blocked"); }
    var id = C.Repository.createRegexRule({ title: "Probe070-off", note: "",
        pattern: "(a+)+$", flags: 0, enabled: false });
    C.Repository.deleteRegexRule(id);
    ({ probe: 70, ok: true });
}((function () { return this; }())));
