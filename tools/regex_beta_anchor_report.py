#!/usr/bin/env python3
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / "stage-assets" / "regex-beta-inspect"
OUT = SRC / "anchors.txt"
TARGETS = {
    "ch06_repository.js": [
        r"function buildItemWhere", r"function listItemsByIds",
        r"function reorderTags", r"ClipHub\.Repository =",
        r"MODULE_VERSION"
    ],
    "ch11_filter.js": [
        r"function performAdvancedClick", r"performAdvancedClick",
        r"function performApplyClick", r"performApplyClick",
        r"function reset", r"Filter\.reset", r"function getState",
        r"getState:", r"getPanelState", r"advancedVisible",
        r"function showRoot", r"function showPanel", r"ClipHub\.Filter =",
        r"MODULE_VERSION", r"filterSearchHistory", r"Settings\.get",
        r"Filter\.set", r"function setValue", r"criteria"
    ],
    "ch13_settings.js": [
        r"function open", r"function close", r"performFocusInput",
        r"function performFocusInput", r"perform.*Tag", r"tag",
        r"function getState", r"getState:", r"ClipHub\.Settings =",
        r"MODULE_VERSION", r"unknown", r"cleanup", r"DEFAULT",
        r"setting", r"makeDataSection", r"scrollToSection"
    ]
}


def snippets(path, patterns, radius=14):
    lines = path.read_text(encoding="utf-8").splitlines()
    hits = []
    seen = set()
    for pattern in patterns:
        rx = re.compile(pattern)
        for idx, line in enumerate(lines):
            if not rx.search(line):
                continue
            key = (max(0, idx-radius), min(len(lines), idx+radius+1))
            if key in seen:
                continue
            seen.add(key)
            hits.append((idx, pattern, key[0], key[1]))
    hits.sort()
    out = []
    for idx, pattern, start, end in hits:
        out.append("\n=== %s:%d match %s ===" % (path.name, idx + 1, pattern))
        for n in range(start, end):
            out.append("%5d | %s" % (n + 1, lines[n]))
    return "\n".join(out)


def main():
    chunks = []
    for name, patterns in TARGETS.items():
        path = SRC / name
        chunks.append("\n################ %s ################\n" % name)
        chunks.append(snippets(path, patterns))
    OUT.write_text("\n".join(chunks), encoding="utf-8")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
