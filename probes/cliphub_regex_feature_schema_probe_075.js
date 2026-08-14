/* ClipHub Regex feature schema probe 075. Rhino ES5 only. */
var ClipHubRegexFeatureSchemaProbe075Result = (function (global) {
    var db = global.ClipHub && global.ClipHub.Database;
    var row = null;
    var errorText = null;
    var mainVersion = -1;
    var featureVersion = -1;
    try {
        if (!db) { throw new Error("Database unavailable"); }
        mainVersion = Number(db.getVersion());
        row = db.queryOne(
            "SELECT value FROM schema_meta WHERE key = ? LIMIT 1",
            ["feature.regex_rules.schema_version"]);
        featureVersion = row === null ? 0 : Number(row.value);
        if (mainVersion !== 2) { throw new Error("main schema version changed"); }
        if (featureVersion !== 1) { throw new Error("regex feature schema != 1"); }
        if (Number(db.REGEX_FEATURE_SCHEMA_VERSION) !== 1) {
            throw new Error("feature schema constant != 1");
        }
    } catch (error) { errorText = String(error); }
    return { probe: 75, ok: errorText === null,
        mainSchemaVersion: mainVersion, regexFeatureSchemaVersion: featureVersion,
        error: errorText };
}((function () { return this; }())));
JSON.stringify(ClipHubRegexFeatureSchemaProbe075Result, null, 2);
