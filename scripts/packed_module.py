#!/usr/bin/env python3
"""Deterministically unpack or repack ClipHub gzip/base64 module loaders."""

from __future__ import annotations

import argparse
import base64
import gzip
import hashlib
import json
import re
from pathlib import Path


ASSIGNMENT_RE = re.compile(
    r"(?P<indent>^[ \t]*)var PACKED_B64\s*=\s*(?P<body>.*?);",
    re.MULTILINE | re.DOTALL,
)
SHA_RE = re.compile(
    r"(?P<prefix>\bvar SOURCE_SHA256\s*=\s*[\"'])"
    r"[0-9a-fA-F]{64}(?P<suffix>[\"']\s*;)"
)


def unpack_source(loader_text: str) -> str:
    match = ASSIGNMENT_RE.search(loader_text)
    if match is None:
        raise ValueError("PACKED_B64 assignment missing")
    pieces = re.findall(r'"(?:\\.|[^"\\])*"', match.group("body"))
    if not pieces:
        raise ValueError("PACKED_B64 payload missing")
    encoded = "".join(json.loads(piece) for piece in pieces)
    return gzip.decompress(base64.b64decode(encoded)).decode("utf-8")


def packed_assignment(source: str, indent: str) -> str:
    compressed = gzip.compress(source.encode("utf-8"), mtime=0)
    encoded = base64.b64encode(compressed).decode("ascii")
    chunks = [encoded[index:index + 96] for index in range(0, len(encoded), 96)]
    continuation = indent + "    "
    lines = [indent + "var PACKED_B64 ="]
    for index, chunk in enumerate(chunks):
        suffix = " +" if index + 1 < len(chunks) else ""
        lines.append(continuation + json.dumps(chunk) + suffix)
    lines.append(indent + ";")
    return "\n".join(lines)


def repack_loader(loader_text: str, source: str) -> str:
    match = ASSIGNMENT_RE.search(loader_text)
    if match is None:
        raise ValueError("PACKED_B64 assignment missing")
    replacement = packed_assignment(source, match.group("indent"))
    output = loader_text[:match.start()] + replacement + loader_text[match.end():]
    digest = hashlib.sha256(source.encode("utf-8")).hexdigest()
    output, count = SHA_RE.subn(
        lambda item: item.group("prefix") + digest + item.group("suffix"),
        output,
        count=1,
    )
    if count != 1:
        raise ValueError("SOURCE_SHA256 assignment missing")
    return output


def main() -> int:
    parser = argparse.ArgumentParser()
    subparsers = parser.add_subparsers(dest="command", required=True)

    unpack_parser = subparsers.add_parser("unpack")
    unpack_parser.add_argument("loader", type=Path)
    unpack_parser.add_argument("output", type=Path)

    pack_parser = subparsers.add_parser("pack")
    pack_parser.add_argument("loader", type=Path)
    pack_parser.add_argument("source", type=Path)

    args = parser.parse_args()
    loader_text = args.loader.read_text(encoding="utf-8")
    if args.command == "unpack":
        args.output.write_text(unpack_source(loader_text), encoding="utf-8")
        return 0

    source = args.source.read_text(encoding="utf-8")
    args.loader.write_text(repack_loader(loader_text, source), encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
