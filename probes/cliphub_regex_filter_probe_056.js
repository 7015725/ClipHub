/* ClipHub regex filter probe 056. Rhino ES5. */
(function (global) {
    var C = global.ClipHub;
    var rules = C.Repository.listRegexRules({ enabledOnly: true });
    if (rules.length < 1) { throw new Error("No enabled regex rules"); }
    C.Filter.setRegexRuleIds([Number(rules[0].id)], { apply: false });
    C.Filter.setRegexMatchMode("any", { apply: false });
    var criteria = C.Filter.get().regexRuleIds;
    if (criteria.length !== 1) { throw new Error("Regex criteria not stored"); }
    ({ probe: 56, ok: true, state: C.Filter.getState() });
}((function () { return this; }())));
