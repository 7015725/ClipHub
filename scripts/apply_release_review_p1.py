#!/usr/bin/env python3
from pathlib import Path
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]
BRANCH = "agent/fix-release-review-p1"
VERSION = "20260726.06"


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


classifier = r'''(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});

    function trim(value) {
        return String(value === null || value === undefined ? "" : value)
            .replace(/^\s+|\s+$/g, "");
    }

    function normalizeType(value) {
        value = String(value || "text").toLowerCase();
        if (value === "link") { return "url"; }
        if (value === "url" || value === "email" || value === "phone" ||
                value === "code") {
            return value;
        }
        return "text";
    }

    function isFullUrl(text) {
        return /^(?:https?:\/\/|ftp:\/\/|www\.)[^\s]+$/i.test(text);
    }

    function isFullEmail(text) {
        return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(text);
    }

    function isFullPhone(text) {
        var digits;
        if (!/^\+?[0-9\s().-]+$/.test(text)) { return false; }
        digits = text.replace(/\D/g, "");
        return digits.length >= 7 && digits.length <= 15;
    }

    function looksLikeJson(text) {
        var first = text.charAt(0);
        var last = text.charAt(text.length - 1);
        if (!((first === "{" && last === "}") ||
                (first === "[" && last === "]"))) {
            return false;
        }
        try {
            JSON.parse(text);
            return true;
        } catch (ignored) {
            return false;
        }
    }

    function codeScore(text) {
        var score = 0;
        var lines = text.split(/\r?\n/);
        if (/^#!\//.test(text)) { score += 3; }
        if (looksLikeJson(text)) { score += 3; }
        if (/\b(function|var|let|const|class|interface|package|import|return)\b/.test(text)) {
            score += 2;
        }
        if (/\b(if|else|for|while|switch|case|try|catch)\s*[({]/.test(text)) {
            score += 2;
        }
        if (/\b(SELECT|INSERT|UPDATE|DELETE)\b[\s\S]+\b(FROM|INTO|SET|WHERE)\b/i.test(text)) {
            score += 3;
        }
        if (/[{};][\s\S]*[{};]/.test(text)) { score += 1; }
        if (lines.length >= 3 && /^[\s\t]*(?:[$#>]\s*)?[A-Za-z0-9_.-]+(?:\s+--?[A-Za-z0-9_-]+|\s+[^\s]+)+/m.test(text)) {
            score += 1;
        }
        return score;
    }

    function classify(value) {
        var text = trim(value);
        var score;
        if (text.length === 0) {
            return { type: "text", confidence: 0 };
        }
        if (isFullUrl(text)) {
            return { type: "url", confidence: 100 };
        }
        if (isFullEmail(text)) {
            return { type: "email", confidence: 100 };
        }
        if (isFullPhone(text)) {
            return { type: "phone", confidence: 95 };
        }
        score = codeScore(text);
        if (score >= 3) {
            return { type: "code", confidence: Math.min(95, 65 + score * 5) };
        }
        return { type: "text", confidence: 100 };
    }

    ClipHub.Classifier = {
        MODULE_NAME: "ch_05_classifier",
        MODULE_VERSION: 1,
        init: function () { return true; },
        classify: classify,
        normalizeType: normalizeType,
        shutdown: function () { return true; }
    };
}((function () { return this; }())));
'''
write("src/ch_05_classifier.js", classifier)

replace_once(
    "src/ch_04_clipboard.js",
    '            classified = { type: "text", confidence: 100 };\n'
    '            result = recordText(\n'
    '                read.text,\n'
    '                hash,\n'
    '                "text",\n'
    '                eventAt,\n'
    '                read\n'
    '            );',
    '            classified = ClipHub.Classifier &&\n'
    '                typeof ClipHub.Classifier.classify === "function" ?\n'
    '                ClipHub.Classifier.classify(read.text) :\n'
    '                { type: "text", confidence: 0 };\n'
    '            result = recordText(\n'
    '                read.text,\n'
    '                hash,\n'
    '                classified && classified.type ?\n'
    '                    String(classified.type) : "text",\n'
    '                eventAt,\n'
    '                read\n'
    '            );'
)
replace_once("src/ch_04_clipboard.js", 'MODULE_VERSION: 5', 'MODULE_VERSION: 6')

replace_once(
    "src/ch_06_repository.js",
    '    function normalizeTagName(value) {\n'
    '        return String(value === null || value === undefined ? "" : value)\n'
    '            .replace(/^\\s+|\\s+$/g, "")\n'
    '            .replace(/\\s+/g, " ");\n'
    '    }\n',
    '    function normalizeTagName(value) {\n'
    '        return String(value === null || value === undefined ? "" : value)\n'
    '            .replace(/^\\s+|\\s+$/g, "")\n'
    '            .replace(/\\s+/g, " ");\n'
    '    }\n\n'
    '    function normalizeContentType(value) {\n'
    '        value = String(value || "text").toLowerCase();\n'
    '        if (value === "link") { return "url"; }\n'
    '        if (value === "url" || value === "email" || value === "phone" ||\n'
    '                value === "code") {\n'
    '            return value;\n'
    '        }\n'
    '        return "text";\n'
    '    }\n'
)
replace_once(
    "src/ch_06_repository.js",
    '                "text",\n                item.sourcePackage',
    '                normalizeContentType(item.contentType),\n'
    '                item.sourcePackage'
)
replace_once(
    "src/ch_06_repository.js",
    '        var allowed = {\n            content: true,',
    '        var allowed = {\n            content: true,\n            content_type: true,'
)
old_set_tags = '''    function setItemTags(itemId, tagIds) {
        var ids = intList(tagIds);
        var index;
        var attached = 0;
        requireReady();
        ClipHub.Database.transaction(function () {
            ClipHub.Database.executeUpdateDelete(
                "DELETE FROM clipboard_item_tags WHERE item_id = ?", [intValue(itemId, -1)]
            );
            for (index = 0; index < ids.length; index += 1) {
                if (attachTag(itemId, ids[index]) >= 0) { attached += 1; }
            }
        });
        return attached;
    }
'''
new_set_tags = '''    function replaceItemTagsInternal(itemId, tagIds) {
        var ids = intList(tagIds);
        var index;
        var attached = 0;
        ClipHub.Database.executeUpdateDelete(
            "DELETE FROM clipboard_item_tags WHERE item_id = ?",
            [intValue(itemId, -1)]
        );
        for (index = 0; index < ids.length; index += 1) {
            if (attachTag(itemId, ids[index]) >= 0) { attached += 1; }
        }
        return attached;
    }

    function setItemTags(itemId, tagIds) {
        var attached = 0;
        requireReady();
        ClipHub.Database.transaction(function () {
            attached = replaceItemTagsInternal(itemId, tagIds);
        });
        return attached;
    }

    function saveItemWithTags(options) {
        var itemId;
        var created = false;
        var changed = 0;
        var tagCount = 0;
        var contentType;
        options = options || {};
        requireReady();
        contentType = normalizeContentType(options.contentType);
        ClipHub.Database.transaction(function () {
            if (options.itemId === null || options.itemId === undefined) {
                itemId = Number(insertItem({
                    content: options.content,
                    contentType: contentType,
                    normalizedHash: options.normalizedHash,
                    sourcePackage: options.sourcePackage,
                    sourceLabel: options.sourceLabel,
                    sourceUid: options.sourceUid,
                    sourceConfidence: options.sourceConfidence,
                    isSensitive: options.isSensitive === true,
                    isPinned: options.isPinned === true,
                    manualOrder: options.manualOrder,
                    copyCount: options.copyCount,
                    createdAt: options.createdAt,
                    lastCopiedAt: options.lastCopiedAt,
                    updatedAt: options.updatedAt
                }));
                created = true;
                changed = 1;
            } else {
                itemId = intValue(options.itemId, -1);
                if (getItem(itemId, false) === null) {
                    throw new Error("Clipboard item does not exist");
                }
                changed = updateItem(itemId, {
                    content: options.content,
                    content_type: contentType
                });
            }
            tagCount = replaceItemTagsInternal(itemId, options.tagIds || []);
        });
        return {
            ok: true,
            id: Number(itemId),
            created: created,
            changed: Number(changed),
            contentType: contentType,
            tagCount: Number(tagCount)
        };
    }
'''
replace_once("src/ch_06_repository.js", old_set_tags, new_set_tags)
replace_once(
    "src/ch_06_repository.js",
    '        normalizeTagName: normalizeTagName,',
    '        normalizeTagName: normalizeTagName,\n'
    '        normalizeContentType: normalizeContentType,'
)
replace_once(
    "src/ch_06_repository.js",
    '        setItemTags: setItemTags,',
    '        setItemTags: setItemTags,\n'
    '        saveItemWithTags: saveItemWithTags,'
)
replace_once("src/ch_06_repository.js", 'MODULE_VERSION: 10', 'MODULE_VERSION: 11')

replace_once(
    "src/ch_10_editor.js",
    '    var exitConfirmReason = "";\n    var ready = false;',
    '    var exitConfirmReason = "";\n'
    '    var pendingDraft = null;\n'
    '    var ready = false;'
)
replace_once(
    "src/ch_10_editor.js",
    '        lastDelayedCallbackError: null,\n        lastError: null',
    '        lastDelayedCallbackError: null,\n'
    '        draftCaptureCount: 0,\n'
    '        draftRestoreCount: 0,\n'
    '        draftDiscardCount: 0,\n'
    '        lastDraftReason: null,\n'
    '        lastError: null'
)

draft_functions = r'''    function clonePendingDraft(value) {
        if (value === null || value === undefined) { return null; }
        return {
            mode: String(value.mode || "new"),
            viewMode: String(value.viewMode || value.mode || "new"),
            itemId: value.itemId === null || value.itemId === undefined ?
                null : Number(value.itemId),
            content: String(value.content || ""),
            draftTagIds: copyTagIds(value.draftTagIds),
            originalContent: String(value.originalContent || ""),
            originalTagIds: copyTagIds(value.originalTagIds),
            pendingTagName: String(value.pendingTagName || ""),
            capturedAt: Number(value.capturedAt || 0),
            reason: String(value.reason || "")
        };
    }

    function captureDraft(reason) {
        return requireMain(runOnMainSync(function () {
            var content;
            var mode;
            var pendingTagName = "";
            if (!state.attached || !hasEditorUnsavedChanges()) {
                return null;
            }
            mode = state.mode === "tags" && tagReturnMode !== null ?
                String(tagReturnMode) : String(state.mode || "new");
            content = state.mode === "tags" ? String(tagReturnText || "") :
                (contentInput === null ? String(tagReturnText || "") :
                    String(contentInput.getText()));
            try {
                pendingTagName = tagNameInput === null ? "" :
                    String(tagNameInput.getText());
            } catch (ignoredTagName) {}
            pendingDraft = {
                mode: mode,
                viewMode: String(state.mode || mode),
                itemId: state.itemId === null ? null : Number(state.itemId),
                content: content,
                draftTagIds: copyTagIds(editorDraftTagIds),
                originalContent: String(editorOriginalContent || ""),
                originalTagIds: copyTagIds(editorOriginalTagIds),
                pendingTagName: pendingTagName,
                capturedAt: ClipHub.Base.now(),
                reason: String(reason || "hide")
            };
            state.draftCaptureCount += 1;
            state.lastDraftReason = pendingDraft.reason;
            return clonePendingDraft(pendingDraft);
        }, 2500));
    }

    function discardPendingDraft() {
        var existed = pendingDraft !== null;
        pendingDraft = null;
        if (existed) { state.draftDiscardCount += 1; }
        return existed;
    }

    function hasPendingDraft() {
        return pendingDraft !== null;
    }

    function restorePendingDraft(options) {
        var draft = clonePendingDraft(pendingDraft);
        var opened;
        options = options || {};
        if (draft === null) {
            return { ok: false, restored: false, reason: "no_pending_draft" };
        }
        opened = openPanel(draft.mode, draft.itemId, {
            requestKeyboard: options.requestKeyboard === true
        });
        requireMain(runOnMainSync(function () {
            editorDraftTagIds = copyTagIds(draft.draftTagIds);
            state.tagDraftCount = editorDraftTagIds.length;
            if (contentInput !== null) {
                contentInput.setText(draft.content);
                contentInput.setSelection(contentInput.getText().length());
                updateCharacterCount();
            }
            if (metadataTypeView !== null) {
                metadataTypeView.setText(editorDraftTagIds.length > 0 ?
                    "标签  " + String(editorDraftTagIds.length) + " 个" :
                    "标签  未设置");
            }
            if (draft.viewMode === "tags") {
                openTagSelectorOnMain();
                if (tagNameInput !== null && draft.pendingTagName.length > 0) {
                    tagNameInput.setText(draft.pendingTagName);
                    tagNameInput.setSelection(tagNameInput.getText().length());
                }
            }
            return true;
        }, 2500));
        pendingDraft = null;
        state.draftRestoreCount += 1;
        state.lastDraftReason = String(draft.reason || "restore");
        return { ok: true, restored: true, draft: draft, opened: opened };
    }

'''
replace_once(
    "src/ch_10_editor.js",
    '    function closePanel(reason) {',
    draft_functions + '    function closePanel(reason) {'
)

old_save = '''    function saveFromInput() {
        var thread = nowThread();
        var content;
        var id;
        var changed;
        var delivered;
        if (contentInput === null) { return false; }
        try {
            content = String(contentInput.getText());
            if (content.replace(/^\s+|\s+$/g, "").length === 0) {
                throw new Error("内容不能为空");
            }
            if (content.length > 200000) {
                throw new Error("内容长度不能超过 200000 字符");
            }
            if (state.mode === "new") {
                id = Number(ClipHub.Repository.insertItem({
                    content: content,
                    contentType: "text",
                    sourcePackage: null,
                    sourceLabel: "ClipHub 手动",
                    sourceUid: Number(Packages.android.os.Process.myUid()),
                    sourceConfidence: 100,
                    isSensitive: false,
                    isPinned: false
                }));
                state.createCount += 1;
                state.lastSaveAction = "created";
                delivered = emitMutation("clipboard_added", id, "created", {});
            } else {
                id = Number(state.itemId);
                changed = ClipHub.Repository.updateItem(id, { content: content });
                if (Number(changed) < 1) {
                    throw new Error("编辑目标不存在或未更新");
                }
                state.updateCount += 1;
                state.lastSaveAction = "updated";
                delivered = emitMutation("clipboard_merged", id, "updated", {});
            }
            ClipHub.Repository.setItemTags(id, editorDraftTagIds);
            emitTagChanged("item_tags_saved", id, null);
            state.saveCount += 1;
            state.lastSavedId = id;
            state.saveThreadId = thread.id;
            state.saveThreadName = thread.name;
            state.lastError = null;
            if (delivered < 1 && ClipHub.List &&
                    typeof ClipHub.List.refresh === "function") {
                ClipHub.List.refresh();
            }
            closePanel("save");
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }
'''
new_save = '''    function saveFromInput() {
        var thread = nowThread();
        var content;
        var id;
        var delivered;
        var classified;
        var saved;
        if (contentInput === null) { return false; }
        try {
            content = String(contentInput.getText());
            if (content.replace(/^\s+|\s+$/g, "").length === 0) {
                throw new Error("内容不能为空");
            }
            if (content.length > 200000) {
                throw new Error("内容长度不能超过 200000 字符");
            }
            classified = ClipHub.Classifier &&
                typeof ClipHub.Classifier.classify === "function" ?
                ClipHub.Classifier.classify(content) :
                { type: "text", confidence: 0 };
            saved = ClipHub.Repository.saveItemWithTags({
                itemId: state.mode === "new" ? null : Number(state.itemId),
                content: content,
                contentType: classified && classified.type ?
                    String(classified.type) : "text",
                tagIds: editorDraftTagIds,
                sourcePackage: null,
                sourceLabel: "ClipHub 手动",
                sourceUid: Number(Packages.android.os.Process.myUid()),
                sourceConfidence: 100,
                isSensitive: false,
                isPinned: false
            });
            id = Number(saved.id);
            if (saved.created === true) {
                state.createCount += 1;
                state.lastSaveAction = "created";
                delivered = emitMutation("clipboard_added", id, "created", {
                    contentType: saved.contentType
                });
            } else {
                state.updateCount += 1;
                state.lastSaveAction = "updated";
                delivered = emitMutation("clipboard_merged", id, "updated", {
                    contentType: saved.contentType
                });
            }
            emitTagChanged("item_tags_saved", id, null);
            pendingDraft = null;
            state.saveCount += 1;
            state.lastSavedId = id;
            state.saveThreadId = thread.id;
            state.saveThreadName = thread.name;
            state.lastError = null;
            if (delivered < 1 && ClipHub.List &&
                    typeof ClipHub.List.refresh === "function") {
                ClipHub.List.refresh();
            }
            closePanel("save");
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }
'''
replace_once("src/ch_10_editor.js", old_save, new_save)
replace_once(
    "src/ch_10_editor.js",
    '            unsavedChanges: hasEditorUnsavedChanges(),\n'
    '            exitConfirmVisible: exitConfirmOverlay !== null,',
    '            unsavedChanges: hasEditorUnsavedChanges(),\n'
    '            pendingDraftPresent: pendingDraft !== null,\n'
    '            pendingDraftReason: pendingDraft === null ? null :\n'
    '                String(pendingDraft.reason || ""),\n'
    '            draftCaptureCount: Number(state.draftCaptureCount),\n'
    '            draftRestoreCount: Number(state.draftRestoreCount),\n'
    '            draftDiscardCount: Number(state.draftDiscardCount),\n'
    '            lastDraftReason: state.lastDraftReason,\n'
    '            exitConfirmVisible: exitConfirmOverlay !== null,'
)
replace_once(
    "src/ch_10_editor.js",
    '            lastDelayedCallbackError: null,\n'
    '            normalPanelHeightDp: 0,',
    '            lastDelayedCallbackError: null,\n'
    '            draftCaptureCount: 0, draftRestoreCount: 0,\n'
    '            draftDiscardCount: 0, lastDraftReason: null,\n'
    '            normalPanelHeightDp: 0,'
)
replace_once(
    "src/ch_10_editor.js",
    '            clearViews();\n            resetState();\n            ready = true;',
    '            pendingDraft = null;\n'
    '            clearViews();\n'
    '            resetState();\n'
    '            ready = true;'
)
replace_once(
    "src/ch_10_editor.js",
    '        requestExit: requestExit,\n'
    '        hasUnsavedChanges: hasEditorUnsavedChanges,',
    '        requestExit: requestExit,\n'
    '        hasUnsavedChanges: hasEditorUnsavedChanges,\n'
    '        captureDraft: captureDraft,\n'
    '        hasPendingDraft: hasPendingDraft,\n'
    '        getPendingDraft: function () {\n'
    '            return clonePendingDraft(pendingDraft);\n'
    '        },\n'
    '        restoreDraft: restorePendingDraft,\n'
    '        discardDraft: discardPendingDraft,'
)
replace_once(
    "src/ch_10_editor.js",
    '            try { closePanel("shutdown"); } catch (ignoredClose) {}\n'
    '            clearViews();',
    '            try { closePanel("shutdown"); } catch (ignoredClose) {}\n'
    '            pendingDraft = null;\n'
    '            clearViews();'
)
replace_once("src/ch_10_editor.js", 'MODULE_VERSION: 20', 'MODULE_VERSION: 21')

old_close_editor = '''    function closeEditor() {
        try {
            if (ClipHub.Editor && ClipHub.Editor.close) {
                ClipHub.Editor.close();
                return true;
            }
        } catch (error) { navState.lastError = String(error); }
        return false;
    }
'''
new_close_editor = '''    function closeEditor(reason, preserveDraft) {
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

    function backEditor() {
        try {
            if (ClipHub.Editor &&
                    typeof ClipHub.Editor.handleBack === "function") {
                return ClipHub.Editor.handleBack() === true;
            }
        } catch (error) { navState.lastError = String(error); }
        return closeEditor("navigation_back_fallback", true);
    }
'''
replace_once("src/ch_12_translation.js", old_close_editor, new_close_editor)
replace_once(
    "src/ch_12_translation.js",
    '            closeEditor();\n            try {',
    '            closeEditor(navState.lastHideReason, true);\n            try {'
)
replace_once(
    "src/ch_12_translation.js",
    '            return closeEditor();\n        }\n        if (owner === "detail"',
    '            return backEditor();\n        }\n        if (owner === "detail"'
)
replace_once(
    "src/ch_12_translation.js",
    '        if (moduleAttached(ClipHub.Editor, "getState")) {\n'
    '            return closeEditor();\n'
    '        }',
    '        if (moduleAttached(ClipHub.Editor, "getState")) {\n'
    '            return backEditor();\n'
    '        }'
)
replace_once(
    "src/ch_12_translation.js",
    '        changed = ClipHub.Repository.updateItem(Number(translationState.itemId), {\n'
    '            content: translationState.translatedText\n'
    '        });',
    '        changed = ClipHub.Repository.updateItem(Number(translationState.itemId), {\n'
    '            content: translationState.translatedText,\n'
    '            content_type: ClipHub.Classifier &&\n'
    '                typeof ClipHub.Classifier.classify === "function" ?\n'
    '                ClipHub.Classifier.classify(\n'
    '                    translationState.translatedText).type : "text"\n'
    '        });'
)
replace_once(
    "src/ch_12_translation.js",
    '            contentType: "text",',
    '            contentType: ClipHub.Classifier &&\n'
    '                typeof ClipHub.Classifier.classify === "function" ?\n'
    '                ClipHub.Classifier.classify(\n'
    '                    translationState.translatedText).type : "text",'
)
replace_once("src/ch_12_translation.js", 'MODULE_NAME: "ch_14_navigation_embedded",\n        MODULE_VERSION: 4', 'MODULE_NAME: "ch_14_navigation_embedded",\n        MODULE_VERSION: 5')
replace_once("src/ch_12_translation.js", 'MODULE_NAME: "ch_12_translation",\n        MODULE_VERSION: 10', 'MODULE_NAME: "ch_12_translation",\n        MODULE_VERSION: 11')

replace_once(
    "src/ch_15_app.js",
    '        "Log", "Database", "Repository",\n'
    '        "EventBus", "Theme", "Clipboard", "Window", "List",',
    '        "Log", "Database", "Repository", "Classifier",\n'
    '        "EventBus", "Theme", "Clipboard", "Window", "List",'
)
old_close_ui = '''    function closeUi() {
        try {
            if (ClipHub.Translation &&
                    typeof ClipHub.Translation.close === "function") {
                ClipHub.Translation.close("app_hide");
            }
        } catch (ignoredTranslation) {}
        try {
            if (ClipHub.Settings &&
                    typeof ClipHub.Settings.close === "function") {
                ClipHub.Settings.close("app_hide");
            }
        } catch (ignoredSettings) {}
        try {
            if (ClipHub.Filter &&
                    typeof ClipHub.Filter.closePanel === "function") {
                ClipHub.Filter.closePanel({
                    restoreList: false,
                    reason: "app_hide"
                });
            }
        } catch (ignoredFilter) {}
        try {
            if (ClipHub.Editor &&
                    typeof ClipHub.Editor.close === "function") {
                ClipHub.Editor.close();
            }
        } catch (ignoredEditor) {}
        try {
            if (ClipHub.List && typeof ClipHub.List.hide === "function") {
                ClipHub.List.hide(false);
            }
        } catch (ignoredList) {}
        return uiStatus();
    }

    function showUi() {
        var result;
        closeUi();
        if (!ClipHub.Filter) {
            throw new Error("ClipHub filter root is unavailable");
        }
        if (typeof ClipHub.Filter.showRoot === "function") {
            result = ClipHub.Filter.showRoot({
                requestKeyboard: false,
                showAdvanced: false
            });
        } else if (typeof ClipHub.Filter.showPanel === "function") {
            result = ClipHub.Filter.showPanel({
                requestKeyboard: false,
                showAdvanced: false,
                rootMode: true
            });
        } else {
            throw new Error("ClipHub filter root cannot be shown");
        }
        return { result: result, status: uiStatus() };
    }
'''
new_close_ui = '''    function closeUi(reason) {
        var hideReason = String(reason || "app_hide");
        try {
            if (ClipHub.Translation &&
                    typeof ClipHub.Translation.close === "function") {
                ClipHub.Translation.close(hideReason);
            }
        } catch (ignoredTranslation) {}
        try {
            if (ClipHub.Settings &&
                    typeof ClipHub.Settings.close === "function") {
                ClipHub.Settings.close(hideReason);
            }
        } catch (ignoredSettings) {}
        try {
            if (ClipHub.Filter &&
                    typeof ClipHub.Filter.closePanel === "function") {
                ClipHub.Filter.closePanel({
                    restoreList: false,
                    reason: hideReason
                });
            }
        } catch (ignoredFilter) {}
        try {
            if (ClipHub.Editor &&
                    typeof ClipHub.Editor.captureDraft === "function") {
                ClipHub.Editor.captureDraft(hideReason);
            }
            if (ClipHub.Editor &&
                    typeof ClipHub.Editor.close === "function") {
                ClipHub.Editor.close();
            }
        } catch (ignoredEditor) {}
        try {
            if (ClipHub.List && typeof ClipHub.List.hide === "function") {
                ClipHub.List.hide(false);
            }
        } catch (ignoredList) {}
        return uiStatus();
    }

    function showUi() {
        var result;
        var before = uiStatus();
        if (before.uiVisible) {
            return { result: null, reused: true, status: before };
        }
        if (ClipHub.Editor &&
                typeof ClipHub.Editor.hasPendingDraft === "function" &&
                ClipHub.Editor.hasPendingDraft() === true &&
                typeof ClipHub.Editor.restoreDraft === "function") {
            result = ClipHub.Editor.restoreDraft({ requestKeyboard: false });
            if (result && result.ok === true) {
                return { result: result, restoredDraft: true,
                    status: uiStatus() };
            }
        }
        if (!ClipHub.Filter) {
            throw new Error("ClipHub filter root is unavailable");
        }
        if (typeof ClipHub.Filter.showRoot === "function") {
            result = ClipHub.Filter.showRoot({
                requestKeyboard: false,
                showAdvanced: false
            });
        } else if (typeof ClipHub.Filter.showPanel === "function") {
            result = ClipHub.Filter.showPanel({
                requestKeyboard: false,
                showAdvanced: false,
                rootMode: true
            });
        } else {
            throw new Error("ClipHub filter root cannot be shown");
        }
        return { result: result, reused: false, status: uiStatus() };
    }
'''
replace_once("src/ch_15_app.js", old_close_ui, new_close_ui)
replace_once(
    "src/ch_15_app.js",
    '            after = closeUi();\n            return { ok: true, command: command, action: "hidden",',
    '            after = closeUi("control_hide");\n'
    '            return { ok: true, command: command, action: "hidden",'
)
replace_once(
    "src/ch_15_app.js",
    '            after = closeUi();\n            return { ok: true, command: command, action: "hidden",\n'
    '                status: after };\n        }\n        after = showUi().status;',
    '            after = closeUi("control_toggle_hide");\n'
    '            return { ok: true, command: command, action: "hidden",\n'
    '                status: after };\n        }\n        after = showUi().status;'
)
replace_once("src/ch_15_app.js", 'MODULE_VERSION: 14', 'MODULE_VERSION: 15')

replace_once(
    "ClipHub.js",
    'var DEFAULT_REF = "agent/release-candidate-20260726.05";',
    'var DEFAULT_REF = "agent/fix-release-review-p1";'
)

manifest_path = ROOT / "module-manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
manifest["moduleSetVersion"] = VERSION
manifest["sourceRef"] = BRANCH
for module in manifest["modules"]:
    module["sha"] = subprocess.check_output(
        ["git", "hash-object", module["path"]], cwd=str(ROOT), text=True
    ).strip()
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

print("patched", VERSION, BRANCH)
