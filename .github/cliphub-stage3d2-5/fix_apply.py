from pathlib import Path

path = Path('.github/cliphub-stage3d2-5/apply.py')
text = path.read_text(encoding='utf-8')
start_marker = "text = replace_once(text,\n'''            ClipHub.Repository.reorderTags(ids);"
end_marker = "\n\nnew_tag_row ="
start = text.find(start_marker)
end = text.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit('reorder compatibility block not found')
replacement = """old_reorder = '''            ClipHub.Repository.reorderTags(ids);
            uiState.tagReorderCount += 1;
            emitTagsChanged(\"tag_reordered\", tagId);
            buildPage();
            return true;
'''
new_reorder = '''            ClipHub.Repository.reorderTags(ids);
            uiState.tagReorderCount += 1;
            emitTagsChanged(\"tag_reordered\", tagId);
            rebuildTagPage();
            return true;
'''
if old_reorder in text:
    text = text.replace(old_reorder, new_reorder, 1)
elif new_reorder not in text:
    raise SystemExit('settings reorder rebuild marker missing')"""
text = text[:start] + replacement + text[end:]
old_empty = 'row = makeText("暂无标签\\n可在上方创建第一个标签", 12,'
new_empty = 'row = makeText("暂无标签\\\\n可在上方创建第一个标签", 12,'
if text.count(old_empty) != 1:
    raise SystemExit('editor empty tag message marker mismatch')
text = text.replace(old_empty, new_empty, 1)
path.write_text(text, encoding='utf-8')
