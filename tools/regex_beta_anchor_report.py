#!/usr/bin/env python3
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / "stage-assets" / "regex-beta-inspect"
OUT = SRC / "anchors.txt"
INDEX_OUT = SRC / "function-index.txt"
TARGETS = {
    "ch06_repository.js": [
        r"function buildItemWhere", r"function listItemsByIds",
        r"function reorderTags", r"ClipHub\.Repository =",
        r"MODULE_VERSION"
    ],
    "ch11_filter.js": [
        r"function performAdvancedClick", r"performAdvancedClick",
        r"function performApplyClick", r"performApplyClick",
        r"function reset\(", r"function getState", r"getState:",
        r"getPanelState", r"advancedVisible", r"function showRoot",
        r"function showPanel", r"ClipHub\.Filter =", r"MODULE_VERSION",
        r"function apply\(", r"function setValue", r"function normalizeValue",
        r"function defaultValue"
    ],
    "ch13_settings.js": [
        r"function open\(", r"function close\(", r"performFocusInput",
        r"function performFocusInput", r"perform.*Tag", r"function getState",
        r"getState:", r"ClipHub\.Settings =", r"MODULE_VERSION",
        r"makeDataSection", r"scrollToSection"
    ]
}


def snippets(path, patterns, radius=18):
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


def function_index(path):
    lines = path.read_text(encoding="utf-8").splitlines()
    rx = re.compile(r"^\s*function\s+([A-Za-z0-9_$]+)\s*\(")
    out = []
    for idx, line in enumerate(lines):
        match = rx.search(line)
        if match:
            out.append("%5d %s" % (idx + 1, match.group(1)))
    return out


def main():
    chunks = []
    indexes = []
    for name, patterns in TARGETS.items():
        path = SRC / name
        chunks.append("\n################ %s ################\n" % name)
        chunks.append(snippets(path, patterns))
        indexes.append("\n################ %s ################" % name)
        indexes.extend(function_index(path))
    OUT.write_text("\n".join(chunks), encoding="utf-8")
    INDEX_OUT.write_text("\n".join(indexes) + "\n", encoding="utf-8")
    print("wrote", OUT)
    print("wrote", INDEX_OUT)


if __name__ == "__main__":
    main()
