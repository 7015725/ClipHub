/* ClipHub regex title+note search probe 068. Rhino ES5. */
(function (global) {
    var C = global.ClipHub;
    var marker = "probe-note-068-" + String(C.Base.now());
    var id = C.Repository.createRegexRule({
        title: "Probe068", note: marker, pattern: "probe068", flags: 0,
        enabled: true
    });
    var byNote = C.Repository.listRegexRules({ searchKeyword: marker });
    var oldTitleOnly = C.Repository.listRegexRules({ titleKeyword: marker });
    C.Repository.deleteRegexRule(id);
    if (byNote.length !== 1 || Number(byNote[0].id) !== Number(id)) {
        throw new Error("searchKeyword note search failed");
    }
    if (oldTitleOnly.length !== 0) {
        throw new Error("titleKeyword legacy semantics regressed");
    }
    ({ probe: 68, ok: true });
}((function () { return this; }())));
