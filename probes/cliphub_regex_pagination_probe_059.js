/* ClipHub regex pagination probe 059. Rhino ES5. */
(function (global) {
    var C = global.ClipHub;
    var rules = C.Repository.listRegexRules({ enabledOnly: true });
    if (rules.length < 1) { throw new Error("No regex rule available"); }
    C.Filter.setRegexRuleIds([Number(rules[0].id)], { apply: true,
        origin: "probe_059" });
    ({ probe: 59, ok: true, pagination: C.Filter.getPaginationState(),
        regex: C.Filter.getRegexScanState() });
}((function () { return this; }())));
