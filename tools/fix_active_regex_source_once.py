#!/usr/bin/env python3
import base64
import gzip
import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[1]
FILTER = ROOT / "src" / "ch_11_filter.js"

def fail(message):
    raise RuntimeError(message)

def git_blob_sha_text(text):
    raw = text.encode("utf-8")
    return hashlib.sha1(("blob %d\0" % len(raw)).encode("utf-8") + raw).hexdigest()

def unpack_loader(path):
    loader = path.read_text(encoding="utf-8")
    m = re.search(r"\bvar\s+(PACKED_B64|encoded)\s*=\s*(.*?);", loader, re.S)
    if m is None:
        fail("packed assignment missing")
    pieces = re.findall(r'"(?:\\.|[^"\\])*"', m.group(2))
    encoded = "".join(json.loads(piece) for piece in pieces)
    canonical = gzip.decompress(base64.b64decode(encoded)).decode("utf-8")
    return loader, m.group(1), canonical

def repack_loader(path, loader, variable, canonical):
    raw = gzip.compress(canonical.encode("utf-8"), compresslevel=9, mtime=0)
    encoded = base64.b64encode(raw).decode("ascii")
    chunks = [encoded[i:i + 120] for i in range(0, len(encoded), 120)]
    expression = "\n        " + " +\n        ".join(json.dumps(x) for x in chunks) + "\n    "
    pattern = re.compile(r"(\bvar\s+" + re.escape(variable) + r"\s*=\s*)(.*?)(;)", re.S)
    m = pattern.search(loader)
    if m is None:
        fail("cannot repack loader")
    loader = loader[:m.start(2)] + expression + loader[m.end(2):]
    source_sha = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    loader, count = re.subn(
        r"(\bvar\s+SOURCE_SHA256\s*=\s*[\"'])[0-9a-fA-F]{64}([\"'])",
        lambda x: x.group(1) + source_sha + x.group(2),
        loader,
        count=1,
    )
    if count != 1:
        fail("SOURCE_SHA256 update failed")
    path.write_text("\n".join(line.rstrip() for line in loader.splitlines()) + "\n", encoding="utf-8")

def patch_filter():
    loader, variable, canonical = unpack_loader(FILTER)
    route = re.compile(
        r"(    function applyIfRequested\(options\) \{\n"
        r"        options = options \|\| \{\};\n"
        r"        if \(options\.apply === false \|\| !ready\) \{\n"
        r"            return copyValue\(value\);\n"
        r"        \}\n)"
        r"(        if \(mutationRefreshPlan !== null &&)"
    )
    replacement = (
        r"\1"
        "        if (regexActive()) {\n"
        "            cancelMutationRefresh(\"regex_criteria_apply\");\n"
        "            startRegexScan({\n"
        "                origin: options.origin || \"criteria\",\n"
        "                fromEvent: options.fromEvent === true\n"
        "            });\n"
        "            return copyValue(value);\n"
        "        }\n"
        r"\2"
    )
    canonical, count = route.subn(replacement, canonical, count=1)
    if count != 1:
        fail("applyIfRequested active-regex route anchor mismatch: %d" % count)
    if canonical.count("MODULE_VERSION: 75") != 1:
        fail("Filter v75 anchor mismatch")
    canonical = canonical.replace("MODULE_VERSION: 75", "MODULE_VERSION: 76", 1)
    repack_loader(FILTER, loader, variable, canonical)
    return canonical

def patch_generator():
    path = ROOT / "tools" / "apply_regex_filter_beta.py"
    text = path.read_text(encoding="utf-8")
    text = text.replace("20260813.03", "20260813.04")
    text, count = re.subn(
        r'(canonical = replace_once\(canonical, "MODULE_VERSION: 74",\s*\n\s*)"MODULE_VERSION: 75"',
        r'\1"MODULE_VERSION: 76"',
        text,
        count=1,
    )
    if count != 1:
        fail("generator filter version anchor mismatch")
    old_required = '"ch_11_filter.js": ("ch_11_filter", 75)'
    if text.count(old_required) != 1:
        fail("generator required filter version anchor mismatch")
    text = text.replace(old_required, '"ch_11_filter.js": ("ch_11_filter", 76)', 1)

    marker = "    canonical = finalize_filter_canonical(canonical)\n"
    if text.count(marker) != 1:
        fail("generator finalize marker mismatch")
    snippet = (
        "    canonical = replace_once(\n"
        "        canonical,\n"
        "        \"        if (options.apply === false || !ready) {\\n\"\n"
        "        \"            return copyValue(value);\\n\"\n"
        "        \"        }\\n\"\n"
        "        \"        if (mutationRefreshPlan !== null &&\",\n"
        "        \"        if (options.apply === false || !ready) {\\n\"\n"
        "        \"            return copyValue(value);\\n\"\n"
        "        \"        }\\n\"\n"
        "        \"        if (regexActive()) {\\n\"\n"
        "        \"            cancelMutationRefresh(\\\"regex_criteria_apply\\\");\\n\"\n"
        "        \"            startRegexScan({\\n\"\n"
        "        \"                origin: options.origin || \\\"criteria\\\",\\n\"\n"
        "        \"                fromEvent: options.fromEvent === true\\n\"\n"
        "        \"            });\\n\"\n"
        "        \"            return copyValue(value);\\n\"\n"
        "        \"        }\\n\"\n"
        "        \"        if (mutationRefreshPlan !== null &&\",\n"
        "        \"filter active regex base criteria route\",\n"
        "    )\n"
    )
    text = text.replace(marker, snippet + marker, 1)
    path.write_text(text, encoding="utf-8")

def patch_release_metadata():
    manifest_path = ROOT / "module-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if manifest.get("sourceRef") != "beta-regex-filter-20260813":
        fail("unexpected manifest sourceRef")
    if len(manifest.get("modules", [])) != 15:
        fail("unexpected module count")
    manifest["moduleSetVersion"] = "20260813.04"
    for item in manifest["modules"]:
        module_path = ROOT / str(item["path"])
        item["sha"] = git_blob_sha_text(module_path.read_text(encoding="utf-8"))
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    preflight_path = ROOT / "scripts" / "release_preflight.sh"
    preflight = preflight_path.read_text(encoding="utf-8")
    old_set = "EXPECTED_MODULE_SET='20260813.03'"
    if preflight.count(old_set) != 1:
        fail("preflight module set anchor mismatch")
    preflight = preflight.replace(old_set, "EXPECTED_MODULE_SET='20260813.04'", 1)
    old_filter = '"ch_11_filter.js": ("ch_11_filter", 75)'
    if preflight.count(old_filter) != 1:
        fail("preflight filter version anchor mismatch")
    preflight = preflight.replace(old_filter, '"ch_11_filter.js": ("ch_11_filter", 76)', 1)
    preflight_path.write_text(preflight, encoding="utf-8")

def verify(canonical):
    if 'MODULE_NAME: "ch_11_filter", MODULE_VERSION: 76' not in canonical:
        fail("Filter v76 postcondition missing")
    if 'cancelMutationRefresh("regex_criteria_apply")' not in canonical:
        fail("active regex route postcondition missing")
    db_source = (ROOT / "src" / "ch_03_database.js").read_text(encoding="utf-8")
    if "var SCHEMA_VERSION = 2;" not in db_source or "db.setVersion(3)" in db_source:
        fail("database rollback boundary changed")
    manifest = json.loads((ROOT / "module-manifest.json").read_text(encoding="utf-8"))
    if manifest.get("moduleSetVersion") != "20260813.04":
        fail("moduleSet postcondition missing")

def main():
    canonical = patch_filter()
    patch_generator()
    patch_release_metadata()
    verify(canonical)
    print("Filter v76 / moduleSet 20260813.04 patch complete")

if __name__ == "__main__":
    main()
