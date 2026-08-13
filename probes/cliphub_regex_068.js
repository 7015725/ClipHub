/* ClipHub regex title+note search probe 068. Rhino ES5. */
(function (global) {
    var C = global.ClipHub;
    var marker = "probe-note-068-" + String(C.Base.now());
    var title = "Probe068-" + String(C.Base.now());
    var id = null;
    var byNote;
    var oldTitleOnly;
    try {
        id = C.Repository.createRegexRule({
            title: title, note: marker, pattern: "probe068", flags: 0,
            enabled: true
        });
        byNote = C.Repository.listRegexRules({ searchKeyword: marker });
        oldTitleOnly = C.Repository.listRegexRules({ titleKeyword: marker });
        if (byNote.length !== 1 || Number(byNote[0].id) !== Number(id)) {
            throw new Error("searchKeyword note search failed");
        }
        if (oldTitleOnly.length !== 0) {
            throw new Error("titleKeyword legacy semantics regressed");
        }
        ({ probe: 68, ok: true });
    } finally {
        if (id !== null) { try { C.Repository.deleteRegexRule(id); } catch (ignored) {} }
    }
}((function () { return this; }())));
