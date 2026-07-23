#!/usr/bin/env python3
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = ROOT / "src/ch_06_repository.js"
SETTINGS = ROOT / "src/ch_13_settings.js"
MANIFEST = ROOT / "module-manifest.json"


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError("{} expected once, found {}".format(label, count))
    return text.replace(old, new, 1)


repository = REPOSITORY.read_text(encoding="utf-8")
repository = replace_once(repository,
'''    function softDeleteItem(id, deletedAt) {
        return updateItem(id, { deleted_at: intValue(deletedAt, ClipHub.Base.now()) });
    }

    function restoreItem(id) {''',
'''    function softDeleteItem(id, deletedAt) {
        return updateItem(id, { deleted_at: intValue(deletedAt, ClipHub.Base.now()) });
    }

    function softDeleteItemsByTag(tagId, deletedAt) {
        var now = intValue(deletedAt, ClipHub.Base.now());
        requireReady();
        return ClipHub.Database.executeUpdateDelete(
            "UPDATE clipboard_items SET deleted_at = ?, updated_at = ? " +
            "WHERE deleted_at IS NULL AND id IN (" +
            "SELECT item_id FROM clipboard_item_tags WHERE tag_id = ?)",
            [now, now, intValue(tagId, -1)]
        );
    }

    function softDeleteAllItems(deletedAt) {
        var now = intValue(deletedAt, ClipHub.Base.now());
        requireReady();
        return ClipHub.Database.executeUpdateDelete(
            "UPDATE clipboard_items SET deleted_at = ?, updated_at = ? " +
            "WHERE deleted_at IS NULL", [now, now]
        );
    }

    function restoreItem(id) {''',
"repository bulk delete functions")
repository = replace_once(repository,
'''        softDeleteItem: softDeleteItem,
        restoreItem: restoreItem,''',
'''        softDeleteItem: softDeleteItem,
        softDeleteItemsByTag: softDeleteItemsByTag,
        softDeleteAllItems: softDeleteAllItems,
        restoreItem: restoreItem,''',
"repository exports")
repository = replace_once(repository,
'''        MODULE_NAME: "ch_06_repository",
        MODULE_VERSION: 8,''',
'''        MODULE_NAME: "ch_06_repository",
        MODULE_VERSION: 9,''',
"repository module version")
REPOSITORY.write_text(repository, encoding="utf-8")

settings = SETTINGS.read_text(encoding="utf-8")
settings = replace_once(settings,
'''    var dataSectionView = null;
    var blogLinkView = null;
    var pendingDeleteTagId = null;''',
'''    var dataSectionView = null;
    var blogLinkView = null;
    var clearAllItemsView = null;
    var pendingDeleteTagId = null;
    var pendingClearTagId = null;
    var pendingClearAll = false;''',
"settings pending globals")
settings = replace_once(settings,
'''        tagColorPreviewCount: 0,
        tagDeleteConfirmCount: 0,
        lastDraggedTagId: null,
        pendingDeleteTagId: null,
        clearHistoryCount: 0,''',
'''        tagColorPreviewCount: 0,
        tagDeleteConfirmCount: 0,
        tagItemsClearConfirmCount: 0,
        tagItemsClearCount: 0,
        clearAllConfirmCount: 0,
        clearAllCount: 0,
        lastDraggedTagId: null,
        lastClearedTagId: null,
        lastClearedItemCount: 0,
        lastClearAllCount: 0,
        pendingDeleteTagId: null,
        pendingClearTagId: null,
        pendingClearAll: false,
        clearHistoryCount: 0,''',
"settings ui state fields")
settings = replace_once(settings,
'''    function requestDeleteTag(tagId, itemCount, deleteView) {
        tagId = Number(tagId);''',
'''    function requestDeleteTag(tagId, itemCount, deleteView) {
        tagId = Number(tagId);
        pendingClearTagId = null;
        uiState.pendingClearTagId = null;
        pendingClearAll = false;
        uiState.pendingClearAll = false;''',
"delete tag cancels clear confirmations")
settings = replace_once(settings,
'''    function emitTagsChanged(action, tagId) {
        try {
            if (ClipHub.EventBus && typeof ClipHub.EventBus.emit === "function") {
                ClipHub.EventBus.emit("tags_changed", {
                    action: String(action), tagId: Number(tagId || 0),
                    at: ClipHub.Base.now()
                });
            }
        } catch (ignored) {}
    }

    function createTagFromSettings() {''',
'''    function emitTagsChanged(action, tagId) {
        try {
            if (ClipHub.EventBus && typeof ClipHub.EventBus.emit === "function") {
                ClipHub.EventBus.emit("tags_changed", {
                    action: String(action), tagId: Number(tagId || 0),
                    at: ClipHub.Base.now()
                });
            }
        } catch (ignored) {}
    }

    function emitClipboardBatchDeleted(scope, count, tagId, deletedAt) {
        try {
            if (ClipHub.EventBus && typeof ClipHub.EventBus.emit === "function") {
                ClipHub.EventBus.emit("clipboard_deleted", {
                    id: 0,
                    batch: true,
                    scope: String(scope || "all"),
                    count: Number(count || 0),
                    tagId: tagId === null || tagId === undefined ? null :
                        Number(tagId),
                    deletedAt: Number(deletedAt || ClipHub.Base.now()),
                    at: ClipHub.Base.now()
                });
            }
        } catch (ignored) {}
    }

    function clearTagItems(tagId) {
        var deletedAt = ClipHub.Base.now();
        var changed;
        try {
            changed = Number(ClipHub.Repository.softDeleteItemsByTag(
                Number(tagId), deletedAt));
            pendingClearTagId = null;
            uiState.pendingClearTagId = null;
            if (changed < 1) { return false; }
            uiState.tagItemsClearCount += 1;
            uiState.lastClearedTagId = Number(tagId);
            uiState.lastClearedItemCount = changed;
            emitClipboardBatchDeleted("tag", changed, tagId, deletedAt);
            emitTagsChanged("tag_items_cleared", tagId);
            rebuildTagPage();
            return true;
        } catch (error) {
            uiState.lastError = String(error);
            return false;
        }
    }

    function requestClearTagItems(tagId, itemCount, clearView) {
        tagId = Number(tagId);
        pendingDeleteTagId = null;
        uiState.pendingDeleteTagId = null;
        pendingClearAll = false;
        uiState.pendingClearAll = false;
        if (Number(itemCount || 0) < 1) { return false; }
        if (pendingClearTagId !== tagId) {
            pendingClearTagId = tagId;
            uiState.pendingClearTagId = tagId;
            uiState.tagItemsClearConfirmCount += 1;
            clearView.setText("确认清理");
            clearView.setContentDescription("再次点击，软删除该标签关联的 " +
                String(Number(itemCount || 0)) + " 条记录，标签会保留");
            return false;
        }
        return clearTagItems(tagId);
    }

    function rebuildDataPage() {
        buildPage();
        postScrollToSection("data");
        return true;
    }

    function clearAllItems() {
        var deletedAt = ClipHub.Base.now();
        var changed;
        try {
            changed = Number(ClipHub.Repository.softDeleteAllItems(deletedAt));
            pendingClearAll = false;
            uiState.pendingClearAll = false;
            if (changed < 1) { return false; }
            uiState.clearAllCount += 1;
            uiState.lastClearAllCount = changed;
            uiState.lastClearedItemCount = changed;
            emitClipboardBatchDeleted("all", changed, null, deletedAt);
            rebuildDataPage();
            return true;
        } catch (error) {
            uiState.lastError = String(error);
            return false;
        }
    }

    function requestClearAllItems(clearView, itemCount) {
        pendingDeleteTagId = null;
        uiState.pendingDeleteTagId = null;
        pendingClearTagId = null;
        uiState.pendingClearTagId = null;
        if (Number(itemCount || 0) < 1) { return false; }
        if (!pendingClearAll) {
            pendingClearAll = true;
            uiState.pendingClearAll = true;
            uiState.clearAllConfirmCount += 1;
            clearView.setText("再次点击确认清空");
            clearView.setContentDescription("再次点击，软删除全部 " +
                String(Number(itemCount || 0)) + " 条剪贴板记录");
            return false;
        }
        return clearAllItems();
    }

    function createTagFromSettings() {''',
"settings batch clear functions")
settings = replace_once(settings,
'''        var save = makeButton("保存", colors, false, false);
        var del = makeButton("删除", colors, false, true);''',
'''        var save = makeButton("保存", colors, false, false);
        var clearItems = makeButton("清理记录", colors, false, true);
        var del = makeButton("删标签", colors, false, true);''',
"tag row buttons")
settings = replace_once(settings,
'''        var params;
        root.setOrientation(LinearLayout.VERTICAL);''',
'''        var params;
        if (Number(tag.item_count || 0) < 1) {
            clearItems.setEnabled(false);
            clearItems.setClickable(false);
            clearItems.setAlpha(0.42);
        }
        root.setOrientation(LinearLayout.VERTICAL);''',
"tag clear disabled state")
settings = replace_once(settings,
'''                onClick: function () {
                    pendingDeleteTagId = null;
                    uiState.pendingDeleteTagId = null;
                    saveTagRow(tagId, nameInput, colorInput);
                }
            }));
            del.setOnClickListener(new JavaAdapter(View.OnClickListener, {
                onClick: function () {
                    requestDeleteTag(tagId, itemCount, del);
                }
            }));''',
'''                onClick: function () {
                    pendingDeleteTagId = null;
                    uiState.pendingDeleteTagId = null;
                    pendingClearTagId = null;
                    uiState.pendingClearTagId = null;
                    saveTagRow(tagId, nameInput, colorInput);
                }
            }));
            clearItems.setOnClickListener(new JavaAdapter(
                View.OnClickListener, { onClick: function () {
                    requestClearTagItems(tagId, itemCount, clearItems);
                }}));
            del.setOnClickListener(new JavaAdapter(View.OnClickListener, {
                onClick: function () {
                    pendingClearTagId = null;
                    uiState.pendingClearTagId = null;
                    requestDeleteTag(tagId, itemCount, del);
                }
            }));''',
"tag row listeners")
settings = replace_once(settings,
'''        actions.addView(save, new LinearLayout.LayoutParams(dp(58), dp(34)));
        params = new LinearLayout.LayoutParams(dp(68), dp(34));
        params.leftMargin = dp(5);
        actions.addView(del, params);''',
'''        actions.addView(save, new LinearLayout.LayoutParams(dp(52), dp(34)));
        params = new LinearLayout.LayoutParams(dp(72), dp(34));
        params.leftMargin = dp(5);
        actions.addView(clearItems, params);
        params = new LinearLayout.LayoutParams(dp(64), dp(34));
        params.leftMargin = dp(5);
        actions.addView(del, params);''',
"tag row action layout")
settings = replace_once(settings,
'''            root: root, name: nameInput, color: colorInput,
            handle: handle, swatch: swatch, save: save, deleteView: del''',
'''            root: root, name: nameInput, color: colorInput,
            handle: handle, swatch: swatch, save: save,
            clearItemsView: clearItems, deleteView: del''',
"tag row view map")
settings = replace_once(settings,
'''        makeSectionTitle(section, "标签管理",
            "拖动排序 · 颜色预览 · 删除只解除关联", colors);''',
'''        makeSectionTitle(section, "标签管理",
            "清理记录会保留标签 · 删除标签只解除关联", colors);''',
"tag section subtitle")
settings = replace_once(settings,
'''        var path = initContext && initContext.runtimeDir ?
            String(initContext.runtimeDir) + "/data/cliphub.db" : "";
        var infoTitle;''',
'''        var path = initContext && initContext.runtimeDir ?
            String(initContext.runtimeDir) + "/data/cliphub.db" : "";
        var activeCount = Number(ClipHub.Repository.countItems(false));
        var infoTitle;''',
"data active count")
settings = replace_once(settings,
'''        var infoText;
        var divider;
        var authorTitle;''',
'''        var infoText;
        var dangerTitle;
        var dangerText;
        var divider;
        var authorTitle;''',
"data danger vars")
settings = replace_once(settings,
'''        makeSectionTitle(section, "数据与关于",
            "当前数据库、模块和项目相关信息", colors);''',
'''        makeSectionTitle(section, "数据与关于",
            "当前数据库、批量清理与项目相关信息", colors);''',
"data section subtitle")
settings = replace_once(settings,
'''        infoText = makeText(
            "剪贴板记录：" + String(ClipHub.Repository.countItems(false)) +''',
'''        infoText = makeText(
            "剪贴板记录：" + String(activeCount) +''',
"data count display")
settings = replace_once(settings,
'''        section.addView(infoText, params);

        divider = new View(appContext);''',
'''        section.addView(infoText, params);

        dangerTitle = makeText("危险操作", 10, colors.textPrimary, true);
        section.addView(dangerTitle, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        dangerText = makeText(
            "软删除全部剪贴板记录；标签、设置与搜索历史会保留",
            9, colors.textSecondary, false);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(4);
        params.bottomMargin = dp(7);
        section.addView(dangerText, params);
        clearAllItemsView = makeButton(
            "清空全部记录（" + String(activeCount) + " 条）",
            colors, false, true);
        if (activeCount < 1) {
            clearAllItemsView.setEnabled(false);
            clearAllItemsView.setClickable(false);
            clearAllItemsView.setAlpha(0.42);
        } else {
            (function (count, view) {
                view.setOnClickListener(new JavaAdapter(
                    View.OnClickListener, { onClick: function () {
                        requestClearAllItems(view, count);
                    }}));
            }(activeCount, clearAllItemsView));
        }
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(42));
        params.bottomMargin = dp(10);
        section.addView(clearAllItemsView, params);

        divider = new View(appContext);''',
"data clear all UI")
settings = replace_once(settings,
'''                dataSectionView = null;
                blogLinkView = null;
                pendingDeleteTagId = null;
                uiState.pendingDeleteTagId = null;''',
'''                dataSectionView = null;
                blogLinkView = null;
                clearAllItemsView = null;
                pendingDeleteTagId = null;
                pendingClearTagId = null;
                pendingClearAll = false;
                uiState.pendingDeleteTagId = null;
                uiState.pendingClearTagId = null;
                uiState.pendingClearAll = false;''',
"close cleanup states")
settings = replace_once(settings,
'''            tagDeleteConfirmCount: Number(uiState.tagDeleteConfirmCount),
            lastDraggedTagId: uiState.lastDraggedTagId,
            pendingDeleteTagId: uiState.pendingDeleteTagId,
            dragReorderEnabled: true,
            deleteRequiresConfirmation: true,
            clearHistoryCount: Number(uiState.clearHistoryCount),''',
'''            tagDeleteConfirmCount: Number(uiState.tagDeleteConfirmCount),
            tagItemsClearConfirmCount:
                Number(uiState.tagItemsClearConfirmCount),
            tagItemsClearCount: Number(uiState.tagItemsClearCount),
            clearAllConfirmCount: Number(uiState.clearAllConfirmCount),
            clearAllCount: Number(uiState.clearAllCount),
            lastDraggedTagId: uiState.lastDraggedTagId,
            lastClearedTagId: uiState.lastClearedTagId,
            lastClearedItemCount: Number(uiState.lastClearedItemCount),
            lastClearAllCount: Number(uiState.lastClearAllCount),
            pendingDeleteTagId: uiState.pendingDeleteTagId,
            pendingClearTagId: uiState.pendingClearTagId,
            pendingClearAll: uiState.pendingClearAll === true,
            dragReorderEnabled: true,
            deleteRequiresConfirmation: true,
            bulkClearRequiresConfirmation: true,
            clearHistoryCount: Number(uiState.clearHistoryCount),''',
"settings state output")
settings = replace_once(settings,
'''        state.tagDeleteConfirmCount = 0;
        state.lastDraggedTagId = null;
        state.pendingDeleteTagId = null;
        state.settingsOpenCount = 0;''',
'''        state.tagDeleteConfirmCount = 0;
        state.tagItemsClearConfirmCount = 0;
        state.tagItemsClearCount = 0;
        state.clearAllConfirmCount = 0;
        state.clearAllCount = 0;
        state.lastDraggedTagId = null;
        state.lastClearedTagId = null;
        state.lastClearedItemCount = 0;
        state.lastClearAllCount = 0;
        state.pendingDeleteTagId = null;
        state.pendingClearTagId = null;
        state.pendingClearAll = false;
        state.settingsOpenCount = 0;''',
"settings reset state")
settings = replace_once(settings,
'''        MODULE_NAME: "ch_13_settings",
        MODULE_VERSION: 16,''',
'''        MODULE_NAME: "ch_13_settings",
        MODULE_VERSION: 17,''',
"settings module version")
settings = replace_once(settings,
'''        performDeleteTagConfirm: function (tagId) {
            tagId = String(Number(tagId));
            return runOnMainSync(function () {
                var row = tagRowViews[tagId];
                if (!row) { return false; }
                row.deleteView.performClick();
                return row.deleteView.performClick();
            }, 3000);
        },
        getTagOrder: function () {''',
'''        performDeleteTagConfirm: function (tagId) {
            tagId = String(Number(tagId));
            return runOnMainSync(function () {
                var row = tagRowViews[tagId];
                if (!row) { return false; }
                row.deleteView.performClick();
                return row.deleteView.performClick();
            }, 3000);
        },
        performClearTagItemsConfirm: function (tagId) {
            tagId = String(Number(tagId));
            return runOnMainSync(function () {
                var row = tagRowViews[tagId];
                if (!row || !row.clearItemsView ||
                        !row.clearItemsView.isEnabled()) { return false; }
                row.clearItemsView.performClick();
                return row.clearItemsView.performClick();
            }, 3000);
        },
        performClearAllItemsConfirm: function () {
            return runOnMainSync(function () {
                if (clearAllItemsView === null ||
                        !clearAllItemsView.isEnabled()) { return false; }
                clearAllItemsView.performClick();
                return clearAllItemsView.performClick();
            }, 3000);
        },
        getTagOrder: function () {''',
"settings test APIs")
SETTINGS.write_text(settings, encoding="utf-8")

manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
manifest["moduleSetVersion"] = "20260724.12"
for item in manifest["modules"]:
    path = ROOT / item["path"]
    data = path.read_bytes()
    item["sha"] = hashlib.sha1(
        b"blob " + str(len(data)).encode("ascii") + b"\0" + data
    ).hexdigest()
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8")
