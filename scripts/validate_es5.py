#!/usr/bin/env python3
"""Reject syntax that is incompatible with the ClipHub Rhino ES5 target."""

from __future__ import annotations

import base64
import gzip
import hashlib
import json
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


def validate_source(source_label: str, source: str) -> list[str]:
    stripped = strip_comments_and_strings(source)
    errors: list[str] = []

    for label_name, pattern in FORBIDDEN:
        match = pattern.search(stripped)
        if match:
            line = stripped.count("\n", 0, match.start()) + 1
            errors.append(f"{source_label}:{line}: forbidden {label_name}")

    return errors


def validate_file(path: Path) -> list[str]:
    source = path.read_text(encoding="utf-8")
    errors = validate_source(str(path), source)
    assignment = re.search(
        r"\bvar\s+(?:PACKED_B64|encoded)\s*=\s*(.*?);", source, re.S
    )
    if assignment is None:
        return errors
    sha_match = re.search(
        r"\bvar\s+SOURCE_SHA256\s*=\s*['\"]([0-9a-fA-F]{64})['\"]",
        source,
    )
    try:
        pieces = re.findall(r'"(?:\\.|[^"\\])*"', assignment.group(1))
        if not pieces:
            raise ValueError("packed source is empty")
        encoded = "".join(json.loads(piece) for piece in pieces)
        expanded = gzip.decompress(base64.b64decode(encoded)).decode("utf-8")
        if sha_match is not None:
            actual = hashlib.sha256(expanded.encode("utf-8")).hexdigest()
            expected = sha_match.group(1).lower()
            if actual != expected:
                raise ValueError(
                    f"packed source SHA mismatch: {actual} != {expected}"
                )
        else:
            blob_match = re.search(
                r"规范源码 Git blob:\s*([0-9a-fA-F]{40})", source
            )
            if blob_match is None:
                raise ValueError("packed source integrity marker is missing")
            raw = expanded.encode("utf-8")
            actual_blob = hashlib.sha1(
                f"blob {len(raw)}\0".encode("utf-8") + raw
            ).hexdigest()
            expected_blob = blob_match.group(1).lower()
            if actual_blob != expected_blob:
                raise ValueError(
                    f"packed source Git blob mismatch: {actual_blob} != {expected_blob}"
                )
        errors.extend(validate_source(str(path) + "::packed", expanded))
    except Exception as error:
        errors.append(f"{path}:1: {error}")
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
