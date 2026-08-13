/* ClipHub regex repository probe 053. Rhino ES5. */
(function (global) {
    var C = global.ClipHub;
    var title = "Probe Regex " + String(Packages.java.lang.System.currentTimeMillis());
    var id = Number(C.Repository.createRegexRule({ title: title, note: "probe",
        pattern: "PROBE-[0-9]+", flags: 1, enabled: true }));
    var copyId = Number(C.Repository.duplicateRegexRule(id));
    var rule = C.Repository.getRegexRule(id);
    var copy = C.Repository.getRegexRule(copyId);
    var ok = rule !== null && copy !== null && String(copy.title) !== String(rule.title);
    C.Repository.deleteRegexRule(copyId);
    C.Repository.deleteRegexRule(id);
    if (!ok) { throw new Error("Regex repository probe failed"); }
    ({ probe: 53, ok: true });
}((function () { return this; }())));
