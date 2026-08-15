#!/usr/bin/env python3
import base64
import gzip
import hashlib
import json
import re
from pathlib import Path


def unpack(path):
    text = path.read_text(encoding="utf-8")
    assignment = re.search(r"\bvar\s+(PACKED_B64|encoded)\s*=\s*(.*?);", text, re.S)
    if assignment is None:
        return text
    pieces = re.findall(r'"(?:\\.|[^"\\])*"', assignment.group(2))
    if not pieces:
        return text
    encoded = "".join(json.loads(piece) for piece in pieces)
    return gzip.decompress(base64.b64decode(encoded)).decode("utf-8")


FILTER = Path("src/ch_11_filter.js")
loader = FILTER.read_text(encoding="utf-8")
source = unpack(FILTER)
expected = re.search(r"\bvar\s+SOURCE_SHA256\s*=\s*[\"']([0-9a-fA-F]{64})[\"']", loader)
actual = hashlib.sha256(source.encode("utf-8")).hexdigest()
if expected is not None and actual != expected.group(1).lower():
    raise RuntimeError("Filter SOURCE_SHA256 mismatch")

print("=== FILTER84 STAGE5 READ-ONLY PROBE ===")
print("canonical_sha256=" + actual)
module = re.search(r'MODULE_NAME:\s*"ch_11_filter"\s*,\s*MODULE_VERSION:\s*(\d+)', source, re.S)
print("module_version=" + (module.group(1) if module else "missing"))


def print_context(text, marker, radius=1300, limit=6):
    starts = []
    pos = 0
    while True:
        found = text.find(marker, pos)
        if found < 0:
            break
        starts.append(found)
        pos = found + len(marker)
    print("\n--- marker=%r count=%d ---" % (marker, len(starts)))
    for index, found in enumerate(starts[:limit]):
        lo = max(0, found - radius)
        hi = min(len(text), found + len(marker) + radius)
        print("[%d] offset=%d" % (index + 1, found))
        print(text[lo:hi])

for marker in [
    "function showPanel(",
    "showRoot:",
    "show: function",
    "rootMode:",
    "rootMode = options.rootMode === true",
    "primarySurface",
    "function createAdvancedDrawerBundle(",
    "resultBodyFrame.addView(nextBundle.container",
    "function handleBack(",
    "ClipHub.Filter = {",
    "function mountPrimaryChildPage(",
    "function getPrimaryHostState(",
    "new WindowManager.LayoutParams(",
    "windowManager.addView(panelWindowRoot",
]:
    print_context(source, marker)

print("\n=== EXTERNAL FILTER CALLERS ===")
call_markers = [
    "ClipHub.Filter.showRoot(",
    "ClipHub.Filter.show(",
    "ClipHub.Filter.showPanel(",
    "ClipHub.Filter.setAdvancedDrawerVisible",
    "ClipHub.Filter.toggleAdvanced",
    "ClipHub.Filter.handleBack(",
    "showAdvanced: true",
    "rootMode: false",
]
for path in sorted(Path("src").glob("*.js")):
    if path == FILTER:
        continue
    text = unpack(path)
    hits = []
    for marker in call_markers:
        count = text.count(marker)
        if count:
            hits.append((marker, count))
    if hits:
        print("FILE " + str(path))
        for marker, count in hits:
            print("  %s=%d" % (marker, count))
            pos = text.find(marker)
            print(text[max(0, pos - 450):min(len(text), pos + len(marker) + 650)])

print("\n=== FILTER SELF ENTRY COUNTS ===")
for marker in [
    "showPanel(", "showRoot", "rootMode: true", "rootMode: false",
    "filter_overlay", "filter_root", "advancedVisible",
    "WindowManager.LayoutParams", "windowManager.addView"
]:
    print(marker + "=" + str(source.count(marker)))
