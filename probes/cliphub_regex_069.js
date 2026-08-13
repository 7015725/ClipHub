/* ClipHub regex 64-char duplicate probe 069. Rhino ES5. */
(function (global) {
    var C = global.ClipHub;
    var base = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789XY";
    var id = C.Repository.createRegexRule({ title: base, note: "",
        pattern: "probe069", flags: 0, enabled: true });
    var copy = C.Repository.duplicateRegexRule(id);
    var row = C.Repository.getRegexRule(copy);
    C.Repository.deleteRegexRule(copy);
    C.Repository.deleteRegexRule(id);
    if (String(row.title).length > 64 || String(row.title).indexOf("副本") < 0) {
        throw new Error("64-char duplicate title failed");
    }
    ({ probe: 69, ok: true, length: String(row.title).length });
}((function () { return this; }())));
