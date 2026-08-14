/* ClipHub Regex safety policy probe 072. Rhino ES5 only. */
var ClipHubRegexSafetyPolicyProbe072Result = (function (global) {
    var repo = global.ClipHub && global.ClipHub.Repository;
    var rejected = [];
    var accepted = [];
    var errorText = null;
    var risky = ["(a+)+", "(a*)*", "(a{1,})+", "(a|aa)+", ".*.*"];
    var presets = [
        "(?<!\\d)1[3-9]\\d{9}(?!\\d)",
        "[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+",
        "https?://[^\\s<>\"']+",
        "(?:验证码|校验码|动态码|OTP)\\s*[:：]?\\s*[0-9]{4,8}(?!\\d)"
    ];
    var index;
    function expectReject(pattern, flags) {
        try {
            repo.validateRegexPolicy(pattern, flags || 0, { allowRisky: false });
            return false;
        } catch (ignored) { return true; }
    }
    try {
        if (!repo || typeof repo.validateRegexPolicy !== "function") {
            throw new Error("validateRegexPolicy unavailable");
        }
        for (index = 0; index < risky.length; index += 1) {
            if (expectReject(risky[index], 0)) { rejected.push(risky[index]); }
        }
        for (index = 0; index < presets.length; index += 1) {
            repo.validateRegexPolicy(presets[index], 0, { allowRisky: false });
            accepted.push(index);
        }
        if (!expectReject(new Array(4098).join("a"), 0)) {
            throw new Error("pattern >4096 accepted");
        }
        if (!expectReject("abc", 8)) { throw new Error("flags >7 accepted"); }
        repo.validateRegexPolicy("(a+)+", 0, { allowRisky: true });
    } catch (error) { errorText = String(error); }
    return {
        probe: 72,
        ok: errorText === null && rejected.length === risky.length && accepted.length === presets.length,
        rejectedCount: rejected.length,
        presetPassCount: accepted.length,
        error: errorText
    };
}((function () { return this; }())));
JSON.stringify(ClipHubRegexSafetyPolicyProbe072Result, null, 2);
