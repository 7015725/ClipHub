#!/usr/bin/env python3
import base64
import gzip
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
parts = sorted((root / "scripts").glob("all_window_geometry_payload_*.txt"))
if len(parts) != 4:
    raise RuntimeError("Expected 4 all-window payload parts, found {}".format(
        len(parts)))
payload = "".join(path.read_text(encoding="utf-8").strip()
    for path in parts)
data = json.loads(gzip.decompress(base64.b64decode(payload)).decode("utf-8"))
impl_path = root / "scripts/apply_all_window_geometry_sync_impl.py"
window_path = root / "scripts/shared_window_ch08.b64"
impl_path.write_text(data["impl"], encoding="utf-8")
window_path.write_text(data["ch08"], encoding="utf-8")
code = compile(impl_path.read_text(encoding="utf-8"), str(impl_path), "exec")
exec(code, {"__name__": "__main__", "__file__": str(impl_path)})
