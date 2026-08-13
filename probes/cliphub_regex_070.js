/* ClipHub pathological regex guard probe 070. Rhino ES5. */
(function (global) {
    var C = global.ClipHub;
    var risky = C.Repository.assessRegexRisk("(a+)+$");
    var safe = C.Repository.assessRegexRisk("a+b+");
    var stamp = String(C.Base.now());
    var blocked = false;
    var id = null;
    if (!risky.risky || safe.risky) {
        throw new Error("Regex risk assessment failed");
    }
    try {
        C.Repository.createRegexRule({
            title: "Probe070-on-" + stamp, note: "",
            pattern: "(a+)+$", flags: 0, enabled: true
        });
    } catch (error) {
        blocked = String(error).indexOf("regex_pattern_risky") >= 0;
    }
    if (!blocked) { throw new Error("Risky enabled rule was not blocked"); }
    try {
        id = C.Repository.createRegexRule({
            title: "Probe070-off-" + stamp, note: "",
            pattern: "(a+)+$", flags: 0, enabled: false
        });
        ({ probe: 70, ok: true });
    } finally {
        if (id !== null) { try { C.Repository.deleteRegexRule(id); } catch (ignored) {} }
    }
}((function () { return this; }())));
