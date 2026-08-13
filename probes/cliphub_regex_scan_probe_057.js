/* ClipHub regex full-content scan probe 057. Rhino ES5. */
(function (global) {
    var C = global.ClipHub;
    var marker = "REGEX-FULL-CONTENT-" + String(Packages.java.lang.System.currentTimeMillis());
    var content = new Packages.java.lang.StringBuilder();
    var index;
    for (index = 0; index < 260; index += 1) { content.append("x"); }
    content.append(marker);
    var id = Number(C.Repository.insertItem({ content: String(content),
        contentType: "text", createdAt: C.Base.now(),
        lastCopiedAt: C.Base.now(), updatedAt: C.Base.now() }));
    var ruleId = Number(C.Repository.createRegexRule({ title: marker,
        note: "probe >200", pattern: marker, flags: 0, enabled: true }));
    var snapshot = C.Repository.getRegexScanSnapshot({});
    var chunk = C.Repository.listRegexCandidateChunk({ criteria: {},
        snapshotMaxId: snapshot.maxItemId, limit: 128 });
    var found = false;
    for (index = 0; index < chunk.rows.length; index += 1) {
        if (Number(chunk.rows[index].id) === id &&
                String(chunk.rows[index].content).indexOf(marker) >= 260) {
            found = true;
        }
    }
    C.Repository.deleteRegexRule(ruleId);
    C.Repository.softDeleteItem(id, C.Base.now());
    if (!found) { throw new Error("Full content regex candidate missing"); }
    ({ probe: 57, ok: true });
}((function () { return this; }())));
