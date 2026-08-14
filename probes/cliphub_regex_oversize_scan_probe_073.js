/* ClipHub Regex oversize scan progress probe 073. Rhino ES5 only. */
var ClipHubRegexOversizeScanProbe073Result = (function (global) {
    var ClipHub = global.ClipHub;
    var marker = "cliphub_probe_073_" + String(ClipHub.Base.now());
    var now = ClipHub.Base.now();
    var block = new Array(1025).join("A");
    var oversize = new Array(769).join(block) + "A";
    var snapshot;
    var chunk;
    var errorText = null;
    var cleaned = false;
    try {
        function add(content, offset) {
            ClipHub.Database.executeInsert(
                "INSERT INTO clipboard_items(content, normalized_hash, content_type, " +
                "source_package, source_label, source_uid, source_confidence, is_pinned, " +
                "manual_order, copy_count, created_at, last_copied_at, updated_at, is_sensitive) " +
                "VALUES (?, ?, 'text', ?, ?, 0, 100, 0, 0, 1, ?, ?, ?, 0)",
                [content, marker + "_" + String(offset), marker, marker,
                    now + offset, now + offset, now + offset]);
        }
        add("ordinary_after_2", 1);
        add("ordinary_after_1", 2);
        add(oversize, 3);
        snapshot = ClipHub.Repository.getRegexScanSnapshot({
            sourcePackages: [marker], sortMode: "latest"
        });
        chunk = ClipHub.Repository.listRegexCandidateChunk({
            criteria: { sourcePackages: [marker], sortMode: "latest" },
            snapshotMaxId: Number(snapshot.maxItemId),
            cursor: null,
            limit: 128
        });
        if (Number(snapshot.candidateTotal) !== 3) { throw new Error("candidateTotal != 3"); }
        if (Number(chunk.consumedCount) !== 3) { throw new Error("consumedCount != 3"); }
        if (Number(chunk.oversizeSkippedCount) !== 1) { throw new Error("oversizeSkippedCount != 1"); }
        if (!chunk.rows || chunk.rows.length !== 2) { throw new Error("ordinary rows not preserved"); }
        if (chunk.nextCursor === null) { throw new Error("cursor did not advance"); }
        if (chunk.hasMore === true) { throw new Error("unexpected hasMore"); }
    } catch (error) { errorText = String(error); }
    try {
        ClipHub.Database.executeUpdateDelete(
            "DELETE FROM clipboard_items WHERE source_package = ?", [marker]);
        cleaned = true;
    } catch (cleanupError) {
        if (errorText === null) { errorText = "cleanup: " + String(cleanupError); }
    }
    return { probe: 73, ok: errorText === null && cleaned,
        consumedCount: chunk ? Number(chunk.consumedCount || 0) : 0,
        oversizeSkippedCount: chunk ? Number(chunk.oversizeSkippedCount || 0) : 0,
        cleaned: cleaned, error: errorText };
}((function () { return this; }())));
JSON.stringify(ClipHubRegexOversizeScanProbe073Result, null, 2);
