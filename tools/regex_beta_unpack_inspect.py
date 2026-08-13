#!/usr/bin/env python3
import base64
import gzip
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "stage-assets" / "regex-beta-inspect"
TARGETS = {
    "ch06_repository.js": ROOT / "src" / "ch_06_repository.js",
    "ch11_filter.js": ROOT / "src" / "ch_11_filter.js",
    "ch13_settings.js": ROOT / "src" / "ch_13_settings.js",
}


def extract_b64_expression(text, path):
    markers = ["var PACKED_B64 =", "var encoded ="]
    for marker in markers:
        start = text.find(marker)
        if start < 0:
            continue
        expr_start = start + len(marker)
        end = text.find(";", expr_start)
        if end < 0:
            raise RuntimeError("packed terminator missing: %s" % path)
        expr = text[expr_start:end]
        chunks = re.findall(r'"([A-Za-z0-9+/=]+)"', expr)
        if not chunks:
            raise RuntimeError("packed chunks missing: %s" % path)
        return "".join(chunks)
    raise RuntimeError("packed marker missing: %s" % path)


def unpack_loader(path):
    text = path.read_text(encoding="utf-8")
    raw = base64.b64decode(extract_b64_expression(text, path))
    return gzip.decompress(raw).decode("utf-8")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, path in TARGETS.items():
        canonical = unpack_loader(path)
        (OUT / name).write_text(canonical, encoding="utf-8")
        print("unpacked %s -> %s bytes" % (path.name, len(canonical.encode("utf-8"))))


if __name__ == "__main__":
    main()
