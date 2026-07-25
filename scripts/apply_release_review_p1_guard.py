#!/usr/bin/env python3
from pathlib import Path
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]
VERSION = "20260726.07"
BRANCH = "agent/fix-release-review-p1"


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


old_unsaved = r'''    function hasEditorUnsavedChanges() {
        var currentText;
        var pendingTagName = "";
        if (!state.attached) { return false; }
        if (state.mode === "tags") {
            try {
                pendingTagName = tagNameInput !== null ?
                    String(tagNameInput.getText()).replace(/^\s+|\s+$/g, "") : "";
            } catch (ignoredTagInput) {}
            return state.tagSelectionDirty === true ||
                pendingTagName.length > 0;
        }
        currentText = contentInput !== null ?
            String(contentInput.getText()) : String(tagReturnText || "");
        return currentText !== String(editorOriginalContent || "") ||
            !sameTagIds(editorDraftTagIds, editorOriginalTagIds);
    }
'''
new_unsaved = old_unsaved + r'''
    function hasDraftableChanges() {
        var pendingTagName = "";
        if (!state.attached) { return false; }
        if (state.mode !== "tags") {
            return hasEditorUnsavedChanges();
        }
        try {
            pendingTagName = tagNameInput !== null ?
                String(tagNameInput.getText()).replace(/^\s+|\s+$/g, "") : "";
        } catch (ignoredTagInput) {}
        return state.tagSelectionDirty === true ||
            pendingTagName.length > 0 ||
            String(tagReturnText || "") !== String(editorOriginalContent || "") ||
            !sameTagIds(editorDraftTagIds, editorOriginalTagIds);
    }
'''
replace_once("src/ch_10_editor.js", old_unsaved, new_unsaved)
replace_once(
    "src/ch_10_editor.js",
    '            if (!state.attached || !hasEditorUnsavedChanges()) {',
    '            if (!state.attached || !hasDraftableChanges()) {'
)
replace_once("src/ch_10_editor.js", 'MODULE_VERSION: 21', 'MODULE_VERSION: 22')

old_app_editor = '''        try {
            if (ClipHub.Editor &&
                    typeof ClipHub.Editor.captureDraft === "function") {
                ClipHub.Editor.captureDraft(hideReason);
            }
            if (ClipHub.Editor &&
                    typeof ClipHub.Editor.close === "function") {
                ClipHub.Editor.close();
            }
        } catch (ignoredEditor) {}
'''
new_app_editor = '''        try {
            if (ClipHub.Editor &&
                    typeof ClipHub.Editor.captureDraft === "function") {
                ClipHub.Editor.captureDraft(hideReason);
            }
        } catch (ignoredEditorDraft) {}
        try {
            if (ClipHub.Editor &&
                    typeof ClipHub.Editor.close === "function") {
                ClipHub.Editor.close();
            }
        } catch (ignoredEditorClose) {}
'''
replace_once("src/ch_15_app.js", old_app_editor, new_app_editor)
replace_once("src/ch_15_app.js", 'MODULE_VERSION: 15', 'MODULE_VERSION: 16')

old_navigation = '''    function closeEditor(reason, preserveDraft) {
        try {
            if (ClipHub.Editor && preserveDraft === true &&
                    typeof ClipHub.Editor.captureDraft === "function") {
                ClipHub.Editor.captureDraft(String(reason || "navigation_hide"));
            }
            if (ClipHub.Editor && ClipHub.Editor.close) {
                ClipHub.Editor.close();
                return true;
            }
        } catch (error) { navState.lastError = String(error); }
        return false;
    }
'''
new_navigation = '''    function closeEditor(reason, preserveDraft) {
        if (ClipHub.Editor && preserveDraft === true &&
                typeof ClipHub.Editor.captureDraft === "function") {
            try {
                ClipHub.Editor.captureDraft(String(reason || "navigation_hide"));
            } catch (draftError) {
                navState.lastError = String(draftError);
            }
        }
        try {
            if (ClipHub.Editor && ClipHub.Editor.close) {
                ClipHub.Editor.close();
                return true;
            }
        } catch (closeError) { navState.lastError = String(closeError); }
        return false;
    }
'''
replace_once("src/ch_12_translation.js", old_navigation, new_navigation)
replace_once(
    "src/ch_12_translation.js",
    'MODULE_NAME: "ch_14_navigation_embedded",\n        MODULE_VERSION: 5',
    'MODULE_NAME: "ch_14_navigation_embedded",\n        MODULE_VERSION: 6'
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
print("hardened", VERSION)
