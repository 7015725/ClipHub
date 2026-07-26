#!/usr/bin/env python3
from pathlib import Path
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]
VERSION = "20260726.09"
BRANCH = "agent/release-review-p2-merge-fix"


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def write(path, value):
    (ROOT / path).write_text(value, encoding="utf-8")


def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError("%s expected one match, found %d" % (path, count))
    write(path, text.replace(old, new, 1))


def replace_between(path, start, end, replacement):
    text = read(path)
    if text.count(start) != 1 or text.count(end) != 1:
        raise RuntimeError("%s boundary mismatch" % path)
    before, rest = text.split(start, 1)
    _, after = rest.split(end, 1)
    write(path, before + replacement + end + after)


# Clipboard: serialize all callback processing and globally merge active exact-content rows.
replace_once(
    "src/ch_04_clipboard.js",
    "    var Thread = Packages.java.lang.Thread;\n",
    "    var Thread = Packages.java.lang.Thread;\n"
    "    var ReentrantLock = Packages.java.util.concurrent.locks.ReentrantLock;\n"
)
replace_once(
    "src/ch_04_clipboard.js",
    "    var sourceCache = {};\n",
    "    var sourceCache = {};\n"
    "    var processingLock = new ReentrantLock(true);\n"
)

record_text = r'''    function recordText(text, hash, contentType, eventAt, metadata) {
        return ClipHub.Database.transaction(function () {
            var row = ClipHub.Repository.getLatestActiveItemByHash(hash);
            var copyCount;
            var id;
            var patch;
            var insert;
            var sourceValues;
            var key;
            if (row !== null) {
                copyCount = Number(row.copy_count || 1) + 1;
                patch = {
                    content: text,
                    content_type: "text",
                    is_sensitive: metadata.sensitive === true ? 1 : 0,
                    copy_count: copyCount,
                    last_copied_at: eventAt,
                    deleted_at: null
                };
                sourceValues = sourcePatch(metadata);
                for (key in sourceValues) {
                    if (sourceValues.hasOwnProperty(key)) {
                        patch[key] = sourceValues[key];
                    }
                }
                ClipHub.Repository.updateItem(Number(row.id), patch);
                return {
                    id: Number(row.id),
                    inserted: false,
                    merged: true,
                    copyCount: copyCount,
                    hash: hash
                };
            }
            insert = {
                content: text,
                contentType: "text",
                lastCopiedAt: eventAt,
                createdAt: eventAt,
                updatedAt: eventAt,
                sourcePackage: metadata.sourcePackage,
                sourceLabel: metadata.sourceLabel,
                sourceUid: metadata.sourceUid,
                sourceConfidence: metadata.sourceConfidence,
                isSensitive: metadata.sensitive === true
            };
            id = ClipHub.Repository.insertItem(insert);
            return {
                id: Number(id),
                inserted: true,
                merged: false,
                copyCount: 1,
                hash: hash
            };
        });
    }

'''
replace_between(
    "src/ch_04_clipboard.js",
    "    function recordText(text, hash, contentType, eventAt, metadata) {\n",
    "    function ignoredEvent(read, origin, eventAt) {\n",
    record_text
)
replace_once(
    "src/ch_04_clipboard.js",
    "    function handlePrimaryClipChanged(origin) {\n",
    "    function handlePrimaryClipChangedUnlocked(origin) {\n"
)
replace_once("src/ch_04_clipboard.js", "        var classified;\n", "")
classifier_block = r'''            classified = ClipHub.Classifier &&
                typeof ClipHub.Classifier.classify === "function" ?
                ClipHub.Classifier.classify(read.text) :
                { type: "text", confidence: 0 };
            result = recordText(
                read.text,
                hash,
                classified && classified.type ?
                    String(classified.type) : "text",
                eventAt,
                read
            );
'''
replace_once(
    "src/ch_04_clipboard.js",
    classifier_block,
    '            result = recordText(read.text, hash, "text", eventAt, read);\n'
)
replace_once(
    "src/ch_04_clipboard.js",
    '''                contentType: classified && classified.type
                    ? String(classified.type) : "text",
''',
    '                contentType: "text",\n'
)
replace_once(
    "src/ch_04_clipboard.js",
    "    function markOwnWrite(hash, at, windowMs) {\n",
    '''    function handlePrimaryClipChanged(origin) {
        processingLock.lock();
        try {
            return handlePrimaryClipChangedUnlocked(origin);
        } finally {
            processingLock.unlock();
        }
    }

    function markOwnWrite(hash, at, windowMs) {
'''
)
replace_once("src/ch_04_clipboard.js", 'MODULE_VERSION: 8', 'MODULE_VERSION: 9')

# Repository: query exact active content by hash.
replace_once(
    "src/ch_06_repository.js",
    '''    function listItems(options) {
''',
    '''    function getLatestActiveItemByHash(normalizedHash) {
        requireReady();
        return ClipHub.Database.queryOne(
            "SELECT * FROM clipboard_items WHERE deleted_at IS NULL " +
            "AND normalized_hash = ? " +
            "ORDER BY last_copied_at DESC, id DESC LIMIT 1",
            [String(normalizedHash || "")]
        );
    }

    function listItems(options) {
'''
)
replace_once(
    "src/ch_06_repository.js",
    "        getLatestActiveItem: getLatestActiveItem,\n",
    "        getLatestActiveItem: getLatestActiveItem,\n"
    "        getLatestActiveItemByHash: getLatestActiveItemByHash,\n"
)
replace_once("src/ch_06_repository.js", 'MODULE_VERSION: 12', 'MODULE_VERSION: 13')

# Retire automatic content classification again; the file stays for loader/cache compatibility.
write("src/ch_05_classifier.js", '''/*
 * ClipHub 分类器兼容占位模块。
 *
 * ENTRY_VERSION 5 固定加载该文件。自动内容分类已取消。保留本文件
 * 以维持 15 模块清单、离线缓存和旧入口兼容。
 */
(function () {
    return true;
}());
''')

# Editor and translation always persist text content type while retaining atomic saves.
replace_once("src/ch_10_editor.js", "        var classified;\n", "")
replace_once(
    "src/ch_10_editor.js",
    '''            classified = ClipHub.Classifier &&
                typeof ClipHub.Classifier.classify === "function" ?
                ClipHub.Classifier.classify(content) :
                { type: "text", confidence: 0 };
''',
    ""
)
replace_once(
    "src/ch_10_editor.js",
    '''                contentType: classified && classified.type ?
                    String(classified.type) : "text",
''',
    '                contentType: "text",\n'
)
replace_once("src/ch_10_editor.js", 'MODULE_VERSION: 22', 'MODULE_VERSION: 23')

replace_once(
    "src/ch_12_translation.js",
    '''            content: translationState.translatedText,
            content_type: ClipHub.Classifier &&
                typeof ClipHub.Classifier.classify === "function" ?
                ClipHub.Classifier.classify(
                    translationState.translatedText).type : "text"
''',
    '''            content: translationState.translatedText,
            content_type: "text"
'''
)
replace_once(
    "src/ch_12_translation.js",
    '''            content: translationState.translatedText,
            contentType: ClipHub.Classifier &&
                typeof ClipHub.Classifier.classify === "function" ?
                ClipHub.Classifier.classify(
                    translationState.translatedText).type : "text",
''',
    '''            content: translationState.translatedText,
            contentType: "text",
'''
)
replace_once("src/ch_12_translation.js", 'MODULE_VERSION: 11', 'MODULE_VERSION: 12')

# Classifier placeholder is loaded as a file but no longer initialized as a runtime module.
replace_once(
    "src/ch_15_app.js",
    '''    var order = [
        "Log", "Database", "Repository", "Classifier",
        "EventBus", "Theme", "Clipboard", "Window", "List",
''',
    '''    var order = [
        "Log", "Database", "Repository",
        "EventBus", "Theme", "Clipboard", "Window", "List",
'''
)
replace_once("src/ch_15_app.js", 'MODULE_VERSION: 16', 'MODULE_VERSION: 17')

replace_once(
    "ClipHub.js",
    '    var DEFAULT_REF = "agent/release-review-p2";',
    '    var DEFAULT_REF = "agent/release-review-p2-merge-fix";'
)

manifest_path = ROOT / "module-manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["moduleSetVersion"] = VERSION
manifest["sourceRef"] = BRANCH
for module in manifest["modules"]:
    module["sha"] = subprocess.check_output(
        ["git", "hash-object", module["path"]], cwd=str(ROOT), text=True
    ).strip()
manifest_path.write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8"
)
print("applied", VERSION)
