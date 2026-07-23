#!/usr/bin/env python3
import base64
import gzip
import hashlib
import json
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

# Recompute manifest Git blob SHAs with the required NUL separator.
manifest_path = root / "module-manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
for item in manifest["modules"]:
    module_path = root / item["path"]
    data = module_path.read_bytes()
    item["sha"] = hashlib.sha1(
        b"blob " + str(len(data)).encode("ascii") + b"\0" + data
    ).hexdigest()
manifest_path.write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8"
)
