#!/usr/bin/env python3
"""Reject syntax that is incompatible with the ClipHub Rhino ES5 target."""

from __future__ import annotations

import re
import sys
from pathlib import Path

FORBIDDEN = (
    ("let declaration", re.compile(r"\blet\s+[A-Za-z_$]")),
    ("const declaration", re.compile(r"\bconst\s+[A-Za-z_$]")),
    ("class declaration", re.compile(r"\bclass\s+[A-Za-z_$]")),
    ("arrow function", re.compile(r"=>")),
    ("template literal", re.compile(r"`")),
    ("optional chaining", re.compile(r"\?\.")),
    ("nullish coalescing", re.compile(r"\?\?")),
    ("for-of loop", re.compile(r"\bfor\s*\([^)]*\bof\b")),
)


def strip_comments_and_strings(source: str) -> str:
    result: list[str] = []
    index = 0
    length = len(source)
    state = "code"
    quote = ""

    while index < length:
        char = source[index]
        next_char = source[index + 1] if index + 1 < length else ""

        if state == "code":
            if char == "/" and next_char == "/":
                result.extend("  ")
                index += 2
                state = "line_comment"
                continue
            if char == "/" and next_char == "*":
                result.extend("  ")
                index += 2
                state = "block_comment"
                continue
            if char in ("'", '"'):
                quote = char
                result.append(" ")
                index += 1
                state = "string"
                continue
            result.append(char)
            index += 1
            continue

        if state == "line_comment":
            if char == "\n":
                result.append("\n")
                state = "code"
            else:
                result.append(" ")
            index += 1
            continue

        if state == "block_comment":
            if char == "*" and next_char == "/":
                result.extend("  ")
                index += 2
                state = "code"
            else:
                result.append("\n" if char == "\n" else " ")
                index += 1
            continue

        if state == "string":
            if char == "\\":
                result.append(" ")
                if index + 1 < length:
                    result.append("\n" if source[index + 1] == "\n" else " ")
                index += 2
                continue
            if char == quote:
                result.append(" ")
                index += 1
                state = "code"
                continue
            result.append("\n" if char == "\n" else " ")
            index += 1

    return "".join(result)


def iter_javascript_files(root: Path):
    for path in sorted(root.rglob("*.js")):
        if ".git" not in path.parts:
            yield path


def validate_file(path: Path) -> list[str]:
    source = path.read_text(encoding="utf-8")
    stripped = strip_comments_and_strings(source)
    errors: list[str] = []

    for label, pattern in FORBIDDEN:
        match = pattern.search(stripped)
        if match:
            line = stripped.count("\n", 0, match.start()) + 1
            errors.append(f"{path}:{line}: forbidden {label}")

    return errors


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else ".").resolve()
    errors: list[str] = []

    for path in iter_javascript_files(root):
        errors.extend(validate_file(path))

    if errors:
        print("\n".join(errors))
        return 1

    print(f"Rhino ES5 validation passed: {root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
