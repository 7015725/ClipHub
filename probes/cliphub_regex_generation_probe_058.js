/* ClipHub regex generation probe 058. Rhino ES5. */
(function (global) {
    var C = global.ClipHub;
    var rules = C.Repository.listRegexRules({ enabledOnly: true });
    if (rules.length < 2) { throw new Error("Need at least two enabled rules"); }
    C.Filter.setRegexRuleIds([Number(rules[0].id)], { apply: true,
        origin: "probe_058_a" });
    C.Filter.setRegexRuleIds([Number(rules[1].id)], { apply: true,
        origin: "probe_058_b" });
    ({ probe: 58, ok: true, scan: C.Filter.getRegexScanState() });
}((function () { return this; }())));
