/* ClipHub regex database probe 052. Rhino ES5. */
(function (global) {
    var C = global.ClipHub;
    var result = { probe: 52, ok: false };
    if (!C || !C.Database || !C.Repository) {
        throw new Error("ClipHub runtime unavailable");
    }
    result.dbVersion = Number(C.Database.getVersion());
    result.rules = C.Repository.listRegexRules({});
    result.featureMarker = C.Database.queryOne(
        "SELECT value FROM schema_meta WHERE key = ?", ["feature.regex_rules.schema_version"]);
    result.ok = result.dbVersion === 2 && result.featureMarker !== null;
    if (!result.ok) { throw new Error(JSON.stringify(result)); }
    result;
}((function () { return this; }())));
