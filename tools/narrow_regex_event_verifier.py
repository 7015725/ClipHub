#!/usr/bin/env python3
from pathlib import Path

path = Path(__file__).resolve().parent / "fix_regex_filter_event_boundary.py"
text = path.read_text(encoding="utf-8")
old = "    assert 'String(origin || \"unknown\")' not in canonical"
new = "    assert 'clearRegexResultCache(\"clipboard_event:\" +' not in canonical"
count = text.count(old)
if count != 1:
    raise RuntimeError("event verifier rewrite anchor count: " + str(count))
path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("Regex event verifier narrowed")
