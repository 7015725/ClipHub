/* ClipHub Regex inline load-more contract probe 074. Rhino ES5 only. */
var ClipHubRegexInlineMoreProbe074Result = (function (global) {
    var filter = global.ClipHub && global.ClipHub.Filter;
    var state = null;
    var errorText = null;
    try {
        if (!filter || typeof filter.getState !== "function") {
            throw new Error("Filter.getState unavailable");
        }
        state = filter.getState();
        if (state.regexRuleTotalCount === undefined ||
                state.regexRuleOptionCount === undefined ||
                state.regexInlineVisibleLimit === undefined) {
            throw new Error("inline diagnostics unavailable");
        }
        if (Number(state.regexRuleOptionCount) > Number(state.regexRuleTotalCount)) {
            throw new Error("rendered > total");
        }
    } catch (error) { errorText = String(error); }
    return {
        probe: 74,
        ok: errorText === null,
        total: state ? Number(state.regexRuleTotalCount || 0) : 0,
        rendered: state ? Number(state.regexRuleOptionCount || 0) : 0,
        visibleLimit: state ? Number(state.regexInlineVisibleLimit || 0) : 0,
        note: "35-rule and selected-31+ UI path requires manual fixture/open drawer validation",
        error: errorText
    };
}((function () { return this; }())));
JSON.stringify(ClipHubRegexInlineMoreProbe074Result, null, 2);
