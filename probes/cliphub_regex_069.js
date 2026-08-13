/* ClipHub regex 64-char duplicate probe 069. Rhino ES5. */
(function (global) {
    var C = global.ClipHub;
    var stamp = String(C.Base.now());
    var prefix = stamp.substring(Math.max(0, stamp.length - 6));
    var base = ("Probe069-" + prefix + "-" +
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789")
        .substring(0, 64);
    var id = null;
    var copy = null;
    var row = null;
    try {
        id = C.Repository.createRegexRule({ title: base, note: "",
            pattern: "probe069", flags: 0, enabled: true });
        copy = C.Repository.duplicateRegexRule(id);
        row = C.Repository.getRegexRule(copy);
        if (row === null || String(row.title).length > 64 ||
                String(row.title).indexOf("副本") < 0) {
            throw new Error("64-char duplicate title failed");
        }
        ({ probe: 69, ok: true, length: String(row.title).length });
    } finally {
        if (copy !== null) { try { C.Repository.deleteRegexRule(copy); } catch (ignoredCopy) {} }
        if (id !== null) { try { C.Repository.deleteRegexRule(id); } catch (ignoredId) {} }
    }
}((function () { return this; }())));
