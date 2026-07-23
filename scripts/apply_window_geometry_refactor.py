#!/usr/bin/env python3
import base64
import gzip
from pathlib import Path

root = Path(__file__).resolve().parents[1]
parts = sorted((root / "scripts").glob("window_geometry_payload_*.txt"))
if len(parts) != 7:
    raise RuntimeError("Expected 7 window geometry payload parts, found {}".format(len(parts)))
payload = "".join(path.read_text(encoding="utf-8").strip() for path in parts)
target = Path(__file__).with_name("apply_window_geometry_refactor_impl.py")
target.write_bytes(gzip.decompress(base64.b64decode(payload)))
code = compile(target.read_text(encoding="utf-8"), str(target), "exec")
exec(code, {"__name__": "__main__", "__file__": str(target)})
