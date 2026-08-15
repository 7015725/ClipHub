#!/usr/bin/env python3
from __future__ import annotations

import base64
import gzip
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any


class ContractError(RuntimeError):
    pass


MODE_DEFAULTS = {
    "--settings-tabs-beta": {
        "sourceRef": "docs/tokenizer-softcode-hardening-20260815",
        "moduleSetVersion": "20260815.33",
        "entryVersion": 8,
        "appModuleVersion": 23,
    },
}

MODULE_DEFAULTS = {
    "ch_01_base.js": ("Base", "base", None),
    "ch_02_log.js": ("Log", "managed", 1),
    "ch_03_database.js": ("Database", "managed", 2),
    "ch_04_clipboard.js": ("Clipboard", "managed", 6),
    "ch_05_classifier.js": ("Classifier", "passive", None),
    "ch_06_repository.js": ("Repository", "managed", 3),
    "ch_07_theme.js": ("Theme", "managed", 5),
    "ch_08_window.js": ("Window", "managed", 7),
    "ch_09_list.js": ("List", "managed", 8),
    "ch_10_editor.js": ("Editor", "managed", 9),
    "ch_11_filter.js": ("Filter", "managed", 10),
    "ch_12_translation.js": ("Translation", "managed", 12),
    "ch_13_settings.js": ("Settings", "managed", 11),
    "ch_14_event_bus.js": ("EventBus", "managed", 4),
    "ch_15_app.js": ("App", "app", None),
    "ch_16_ui_shell.js": ("UIShell", "managed", 13),
    "ch_17_tokenizer_ui.js": ("TokenizerUI", "passive", None),
    "ch_18_tokenizer_core.js": ("TokenizerCore", "passive", None),
    "ch_19_tokenizer_service.js": ("TokenizerService", "managed", 14),
}

RESOURCE_DEFAULTS = [
    {
        "id": "test.manifest.resource",
        "purpose": "manifest-contract-test",
        "path": "assets/test/manifest-resource.txt",
        "encoding": "utf-8",
        "loadPolicy": "on_demand",
    },
    {
        "id": "tokenizer.dictionary.default",
        "purpose": "tokenizer-dictionary",
        "path": "assets/tokenizer/jieba-small.gz.b64",
        "encoding": "gzip+base64",
        "loadPolicy": "on_demand",
    }
]

ALLOWED_ROLES = {"base", "managed", "passive", "app"}
ALLOWED_ENCODINGS = {"utf-8", "gzip+base64"}
ALLOWED_LOAD_POLICIES = {"on_demand"}


def git_blob_sha(text: str) -> str:
    data = text.encode("utf-8")
    return hashlib.sha1(b"blob " + str(len(data)).encode("ascii") + b"\0" + data).hexdigest()


def read_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict[str, Any]) -> None:
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def expanded_source(source: str) -> str | None:
    assignment = re.search(r"\bvar\s+(?:PACKED_B64|encoded)\s*=\s*(.*?);", source, re.S)
    if assignment is None:
        return None
    pieces = re.findall(r'"(?:\\.|[^"\\])*"', assignment.group(1))
    encoded = "".join(json.loads(piece) for piece in pieces)
    expanded = gzip.decompress(base64.b64decode(encoded)).decode("utf-8")
    expected = re.search(r"\bvar\s+SOURCE_SHA256\s*=\s*['\"]([0-9a-fA-F]{64})['\"]", source)
    if expected is not None:
        actual = hashlib.sha256(expanded.encode("utf-8")).hexdigest()
        if actual != expected.group(1).lower():
            raise ContractError("packed source SHA mismatch: " + actual)
    return expanded


def entry_version(root: Path) -> int:
    entry = (root / "ClipHub.js").read_text(encoding="utf-8")
    match = re.search(r"\bvar\s+ENTRY_VERSION\s*=\s*(\d+)\s*;", entry)
    if match is None:
        raise ContractError("ClipHub.js ENTRY_VERSION missing")
    return int(match.group(1))


def safe_module_name(name: str) -> bool:
    return re.match(r"^ch_[0-9][0-9]_[A-Za-z0-9_]+\.js$", name) is not None


def safe_identifier(name: str) -> bool:
    return re.match(r"^[A-Za-z_$][A-Za-z0-9_$]*$", name) is not None


def assert_relative_path(path: str, root_name: str, suffix: str | None = None) -> None:
    if path.startswith("/") or ".." in Path(path).parts:
        raise ContractError("unsafe path: " + path)
    if not path.startswith(root_name + "/"):
        raise ContractError("path must be under " + root_name + ": " + path)
    if suffix is not None and not path.endswith(suffix):
        raise ContractError("path suffix mismatch: " + path)


def module_defaults(name: str) -> tuple[str, str, int | None]:
    if name not in MODULE_DEFAULTS:
        raise ContractError("missing module defaults: " + name)
    return MODULE_DEFAULTS[name]


def build_module_descriptor(root: Path, item: dict[str, Any]) -> dict[str, Any]:
    name = str(item["name"])
    path = str(item.get("path", "src/" + name))
    export_name, role, lifecycle_index = module_defaults(name)
    source_path = root / path
    if not source_path.is_file():
        raise ContractError("missing module file: " + path)
    descriptor: dict[str, Any] = {
        "name": name,
        "path": path,
        "sha": git_blob_sha(source_path.read_text(encoding="utf-8")),
        "export": str(item.get("export", export_name)),
        "runtimeRole": str(item.get("runtimeRole", role)),
    }
    if lifecycle_index is not None:
        descriptor["lifecycleIndex"] = int(item.get("lifecycleIndex", lifecycle_index))
    return descriptor


def build_resource_descriptor(root: Path, item: dict[str, Any]) -> dict[str, Any]:
    path = str(item["path"])
    source_path = root / path
    if not source_path.is_file():
        raise ContractError("missing resource file: " + path)
    descriptor = dict(item)
    descriptor["sha"] = git_blob_sha(source_path.read_text(encoding="utf-8"))
    return descriptor


def build_manifest_contract(
    root: Path,
    source_ref: str,
    module_set_version: str,
    legacy_manifest: dict[str, Any] | None = None,
) -> dict[str, Any]:
    root = Path(root)
    if legacy_manifest is not None:
        source_modules = legacy_manifest.get("modules", [])
    else:
        existing = root / "module-manifest.json"
        source_modules = read_json(existing).get("modules", []) if existing.is_file() else []
    seen_names = {}
    normalized_source_modules = []
    for item in source_modules:
        normalized_source_modules.append(item)
        seen_names[str(item.get("name", ""))] = True
    for name in ("ch_18_tokenizer_core.js", "ch_19_tokenizer_service.js"):
        if not seen_names.get(name) and (root / "src" / name).is_file():
            normalized_source_modules.append({"name": name, "path": "src/" + name})
    modules = [build_module_descriptor(root, item) for item in normalized_source_modules]
    resources = []
    for item in RESOURCE_DEFAULTS:
        resource_path = root / str(item["path"])
        if resource_path.is_file():
            resources.append(build_resource_descriptor(root, item))
    return {
        "schemaVersion": 2,
        "moduleSetVersion": module_set_version,
        "entryMinVersion": 8,
        "sourceRef": source_ref,
        "modules": modules,
        "resources": resources,
    }


def validate_module(root: Path, item: dict[str, Any], index: int, seen: set[str]) -> None:
    name = str(item.get("name", ""))
    path = str(item.get("path", ""))
    role = str(item.get("runtimeRole", ""))
    export_name = str(item.get("export", ""))
    if not safe_module_name(name) or name in seen:
        raise ContractError("invalid module name at index " + str(index))
    if path != "src/" + name:
        raise ContractError("invalid module path for " + name)
    assert_relative_path(path, "src", ".js")
    if role not in ALLOWED_ROLES:
        raise ContractError("invalid runtimeRole for " + name)
    if not safe_identifier(export_name):
        raise ContractError("invalid export for " + name)
    source_path = root / path
    if not source_path.is_file():
        raise ContractError("missing module file: " + path)
    actual = git_blob_sha(source_path.read_text(encoding="utf-8"))
    if actual != str(item.get("sha", "")):
        raise ContractError("module SHA mismatch: " + name + " " + actual)
    if role == "managed" and int(item.get("lifecycleIndex", 0)) <= 0:
        raise ContractError("managed module lifecycleIndex missing: " + name)
    seen.add(name)


def validate_resource(root: Path, item: dict[str, Any], index: int, seen: set[str]) -> None:
    resource_id = str(item.get("id", ""))
    path = str(item.get("path", ""))
    if not resource_id or resource_id in seen:
        raise ContractError("invalid resource id at index " + str(index))
    assert_relative_path(path, "assets", None)
    if str(item.get("encoding", "")) not in ALLOWED_ENCODINGS:
        raise ContractError("invalid resource encoding: " + resource_id)
    if str(item.get("loadPolicy", "")) not in ALLOWED_LOAD_POLICIES:
        raise ContractError("invalid resource loadPolicy: " + resource_id)
    source_path = root / path
    if not source_path.is_file():
        raise ContractError("missing resource file: " + path)
    actual = git_blob_sha(source_path.read_text(encoding="utf-8"))
    if actual != str(item.get("sha", "")):
        raise ContractError("resource SHA mismatch: " + resource_id + " " + actual)
    seen.add(resource_id)


def validate_manifest_contract(root: Path, mode: str = "--settings-tabs-beta") -> dict[str, Any]:
    root = Path(root)
    manifest = read_json(root / "module-manifest.json")
    defaults = MODE_DEFAULTS.get(mode, {})
    actual_entry_version = entry_version(root)
    if int(manifest.get("schemaVersion", 0)) != 2:
        raise ContractError("schemaVersion must be 2")
    if int(manifest.get("entryMinVersion", 0)) != 8:
        raise ContractError("entryMinVersion must be 8")
    if actual_entry_version < 8:
        raise ContractError("ENTRY_VERSION must be >= 8")
    if defaults:
        if str(manifest.get("sourceRef", "")) != defaults["sourceRef"]:
            raise ContractError("sourceRef mismatch")
        if str(manifest.get("moduleSetVersion", "")) != defaults["moduleSetVersion"]:
            raise ContractError("moduleSetVersion mismatch")
        if actual_entry_version != int(defaults["entryVersion"]):
            raise ContractError("ENTRY_VERSION mismatch")
    modules = manifest.get("modules", [])
    if not isinstance(modules, list) or len(modules) < 2:
        raise ContractError("modules must be a non-empty list")
    seen_modules: set[str] = set()
    role_counts = {"base": 0, "app": 0}
    lifecycle_indexes: set[int] = set()
    for index, item in enumerate(modules):
        validate_module(root, item, index, seen_modules)
        role = str(item.get("runtimeRole", ""))
        if role in role_counts:
            role_counts[role] += 1
        if role == "managed":
            lifecycle_index = int(item.get("lifecycleIndex", 0))
            if lifecycle_index in lifecycle_indexes:
                raise ContractError("duplicate lifecycleIndex: " + str(lifecycle_index))
            lifecycle_indexes.add(lifecycle_index)
    if role_counts["base"] != 1 or role_counts["app"] != 1:
        raise ContractError("manifest must contain exactly one base and one app")
    resources = manifest.get("resources", [])
    if not isinstance(resources, list):
        raise ContractError("resources must be a list")
    seen_resources: set[str] = set()
    for index, item in enumerate(resources):
        validate_resource(root, item, index, seen_resources)
    entry = (root / "ClipHub.js").read_text(encoding="utf-8")
    app_source = (root / "src" / "ch_15_app.js").read_text(encoding="utf-8")
    if "var NAMES =" in entry:
        raise ContractError("ClipHub.js still contains NAMES module truth")
    if re.search(r"\bvar\s+order\s*=", app_source):
        raise ContractError("ch_15_app.js still contains order[] lifecycle truth")
    return {
        "schemaVersion": 2,
        "entryVersion": actual_entry_version,
        "moduleCount": len(modules),
        "resourceCount": len(resources),
        "moduleSetVersion": str(manifest.get("moduleSetVersion", "")),
        "sourceRef": str(manifest.get("sourceRef", "")),
    }


def command_update(root: Path, mode: str) -> int:
    defaults = MODE_DEFAULTS.get(mode)
    if defaults is None:
        raise ContractError("unsupported update mode: " + mode)
    manifest = build_manifest_contract(
        root,
        source_ref=str(defaults["sourceRef"]),
        module_set_version=str(defaults["moduleSetVersion"]),
    )
    write_json(root / "module-manifest.json", manifest)
    print("Manifest contract updated: " + str(root / "module-manifest.json"))
    return 0


def command_validate(root: Path, mode: str) -> int:
    result = validate_manifest_contract(root, mode=mode)
    print("Manifest contract verification: passed")
    print("schemaVersion: " + str(result["schemaVersion"]))
    print("entryVersion: " + str(result["entryVersion"]))
    print("moduleSetVersion: " + str(result["moduleSetVersion"]))
    print("sourceRef: " + str(result["sourceRef"]))
    print("moduleCount: " + str(result["moduleCount"]))
    print("resourceCount: " + str(result["resourceCount"]))
    return 0


def main(argv: list[str]) -> int:
    root = Path.cwd()
    command = argv[1] if len(argv) > 1 else "validate"
    mode = argv[2] if len(argv) > 2 else "--settings-tabs-beta"
    try:
        if command == "update":
            return command_update(root, mode)
        if command == "validate":
            return command_validate(root, mode)
        raise ContractError("usage: manifest_contract.py [update|validate] [--settings-tabs-beta]")
    except ContractError as error:
        print("Manifest contract error: " + str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
