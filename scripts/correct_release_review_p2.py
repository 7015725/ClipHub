#!/usr/bin/env python3
from pathlib import Path

path = Path(__file__).with_name("apply_release_review_p2.py")
text = path.read_text(encoding="utf-8")

old_block = """old_undo = r'''        changed = ClipHub.Repository.restoreItem(Number(target.id));
        if (Number(changed) < 1) { return false; }
'''
new_undo = r'''        if (Number(row.deleted_at) !== Number(target.deletedAt)) {
            lastDeleted = null;
            refreshQuietly();
            return false;
        }
        changed = ClipHub.Repository.restoreItemIfDeletedAt &&
            typeof ClipHub.Repository.restoreItemIfDeletedAt === \"function\" ?
            ClipHub.Repository.restoreItemIfDeletedAt(
                Number(target.id), Number(target.deletedAt)) :
            ClipHub.Repository.restoreItem(Number(target.id));
        if (Number(changed) < 1) {
            lastDeleted = null;
            refreshQuietly();
            return false;
        }
'''
"""
new_block = """old_undo = r'''changed = ClipHub.Repository.restoreItem(Number(target.id));
if (Number(changed) < 1) { return false; }
'''
new_undo = r'''if (Number(row.deleted_at) !== Number(target.deletedAt)) {
lastDeleted = null;
refreshQuietly();
return false;
}
changed = ClipHub.Repository.restoreItemIfDeletedAt &&
typeof ClipHub.Repository.restoreItemIfDeletedAt === \"function\" ?
ClipHub.Repository.restoreItemIfDeletedAt(
Number(target.id), Number(target.deletedAt)) :
ClipHub.Repository.restoreItem(Number(target.id));
if (Number(changed) < 1) {
lastDeleted = null;
refreshQuietly();
return false;
}
'''
"""
count = text.count(old_block)
if count != 1:
    raise RuntimeError("P2 List correction target count=%d" % count)
path.write_text(text.replace(old_block, new_block, 1), encoding="utf-8")
print("corrected P2 List patch boundary")
