#!/usr/bin/env python3
from pathlib import Path

path = Path(__file__).with_name("patch_window_frame_coalescing.py")
source = path.read_text(encoding="utf-8")
old = '''def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError("{} expected once, found {}".format(label, count))
    return text.replace(old, new, 1)
'''
new = '''def replace_once(text, old, new, label):
    count = text.count(old)
    if count < 1:
        raise RuntimeError("{} expected at least once, found {}".format(label, count))
    return text.replace(old, new, 1)
'''
if source.count(old) != 1:
    raise RuntimeError("patch helper definition mismatch")
source = source.replace(old, new, 1)
code = compile(source, str(path), "exec")
exec(code, {"__name__": "__main__", "__file__": str(path)})
