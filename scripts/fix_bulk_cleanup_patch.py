#!/usr/bin/env python3
from pathlib import Path

path = Path(__file__).with_name("patch_bulk_clipboard_cleanup.py")
text = path.read_text(encoding="utf-8")

old_generic = '''settings = replace_once(settings,
''' + "'''" + '''        var params;
        root.setOrientation(LinearLayout.VERTICAL);''' + "'''" + ''',
''' + "'''" + '''        var params;
        if (Number(tag.item_count || 0) < 1) {
            clearItems.setEnabled(false);
            clearItems.setClickable(false);
            clearItems.setAlpha(0.42);
        }
        root.setOrientation(LinearLayout.VERTICAL);''' + "'''" + ''',
"tag clear disabled state")'''

new_contextual = '''settings = replace_once(settings,
''' + "'''" + '''        var clearItems = makeButton("清理记录", colors, false, true);
        var del = makeButton("删标签", colors, false, true);
        var params;
        root.setOrientation(LinearLayout.VERTICAL);''' + "'''" + ''',
''' + "'''" + '''        var clearItems = makeButton("清理记录", colors, false, true);
        var del = makeButton("删标签", colors, false, true);
        var params;
        if (Number(tag.item_count || 0) < 1) {
            clearItems.setEnabled(false);
            clearItems.setClickable(false);
            clearItems.setAlpha(0.42);
        }
        root.setOrientation(LinearLayout.VERTICAL);''' + "'''" + ''',
"tag clear disabled state")'''

if text.count(old_generic) != 1:
    raise RuntimeError("generic tag matcher block count={}".format(
        text.count(old_generic)))
text = text.replace(old_generic, new_contextual, 1)

reset_block = '''settings = replace_once(settings,
''' + "'''" + '''        state.tagDeleteConfirmCount = 0;
        state.lastDraggedTagId = null;
        state.pendingDeleteTagId = null;
        state.settingsOpenCount = 0;''' + "'''" + ''',
''' + "'''" + '''        state.tagDeleteConfirmCount = 0;
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
        state.settingsOpenCount = 0;''' + "'''" + ''',
"settings reset state")
'''

if text.count(reset_block) != 1:
    raise RuntimeError("obsolete reset block count={}".format(
        text.count(reset_block)))
text = text.replace(reset_block, "", 1)
path.write_text(text, encoding="utf-8")
