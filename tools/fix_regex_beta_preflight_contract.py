#!/usr/bin/env python3
from pathlib import Path

OLD = (
    '    assert "matcher(text).find" not in filter_source\n'
    '    assert ".matcher(text).find()" in filter_source\n'
)
NEW = (
    '    assert ".matcher(text).matches()" not in filter_source\n'
    '    assert ".matcher(text).find()" in filter_source\n'
)


def patch(path_text):
    path = Path(path_text)
    text = path.read_text(encoding="utf-8")
    if OLD in text:
        text = text.replace(OLD, NEW, 1)
        path.write_text(text, encoding="utf-8")
        return True
    if NEW in text:
        return False
    raise RuntimeError("matcher contract anchor missing: " + path_text)


patch("scripts/release_preflight.sh")
patch("tools/apply_regex_filter_beta.py")
print("Regex beta preflight matcher contract fixed")
