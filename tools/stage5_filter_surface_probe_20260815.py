#!/usr/bin/env python3
import base64
import gzip
import hashlib
import json
import re
from pathlib import Path

FILTER = Path("src/ch_11_filter.js")
loader = FILTER.read_text(encoding="utf-8")
assignment = re.search(r"\bvar\s+(PACKED_B64|encoded)\s*=\s*(.*?);", loader, re.S)
if assignment is None:
    raise RuntimeError("packed Filter assignment missing")
pieces = re.findall(r'"(?:\\.|[^"\\])*"', assignment.group(2))
encoded = "".join(json.loads(piece) for piece in pieces)
source = gzip.decompress(base64.b64decode(encoded)).decode("utf-8")
expected = re.search(r"\bvar\s+SOURCE_SHA256\s*=\s*[\"']([0-9a-fA-F]{64})[\"']", loader)
actual = hashlib.sha256(source.encode("utf-8")).hexdigest()
if expected is not None and actual != expected.group(1).lower():
    raise RuntimeError("Filter SOURCE_SHA256 mismatch")

print("=== FILTER84 STAGE5 READ-ONLY PROBE ===")
print("canonical_sha256=" + actual)
module = re.search(r'MODULE_NAME:\s*"ch_11_filter"\s*,\s*MODULE_VERSION:\s*(\d+)', source, re.S)
print("module_version=" + (module.group(1) if module else "missing"))

markers = [
    "function showRoot(",
    "showAdvanced",
    "function createAdvancedDrawerBundle(",
    "advancedDrawer",
    "advancedVisible",
    "advancedFilter",
    "function handleBack(",
    "function mountPrimaryChildPage(",
    "function unmountPrimaryChildPage(",
    "function getPrimaryHostState(",
    "createManagedFrame(",
    "new WindowManager.LayoutParams(",
    "TYPE_APPLICATION_OVERLAY",
    "FLAG_DIM_BEHIND",
]

def print_context(marker, radius=1800):
    starts = []
    pos = 0
    while True:
        found = source.find(marker, pos)
        if found < 0:
            break
        starts.append(found)
        pos = found + len(marker)
    print("\n--- marker=%r count=%d ---" % (marker, len(starts)))
    for index, found in enumerate(starts[:6]):
        lo = max(0, found - radius)
        hi = min(len(source), found + len(marker) + radius)
        print("[%d] offset=%d" % (index + 1, found))
        print(source[lo:hi])

for marker in markers:
    print_context(marker)

print("\n=== TOP-LEVEL WINDOW/PRIMARY COUNTS ===")
for marker in [
    "WindowManager.LayoutParams", "windowManager.addView", "attachWindow(",
    "mountPrimaryChildPage", "unmountPrimaryChildPage", "primaryChild",
    "showAdvanced", "advancedDrawer", "advancedVisible"
]:
    print(marker + "=" + str(source.count(marker)))

print("\n=== FUNCTION NAMES MATCHING FILTER/ADVANCED/PRIMARY ===")
names = re.findall(r"\bfunction\s+([A-Za-z0-9_$]+)\s*\(", source)
for name in names:
    low = name.lower()
    if "advanced" in low or "filter" in low or "primary" in low or "drawer" in low or "back" in low:
        print(name)
