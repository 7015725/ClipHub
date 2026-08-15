#!/usr/bin/env python3
from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from manifest_contract import (
    ContractError,
    build_manifest_contract,
    git_blob_sha,
    validate_manifest_contract,
)


class ManifestContractTest(unittest.TestCase):
    def make_root(self) -> Path:
        root = Path(tempfile.mkdtemp(prefix="cliphub-manifest-contract-test."))
        (root / "src").mkdir()
        (root / "assets" / "test").mkdir(parents=True)
        (root / "ClipHub.js").write_text("var ENTRY_VERSION = 8;\n", encoding="utf-8")
        (root / "src" / "ch_01_base.js").write_text(
            'ClipHub.Base = { MODULE_NAME: "ch_01_base", MODULE_VERSION: 1 };\n',
            encoding="utf-8",
        )
        (root / "src" / "ch_15_app.js").write_text(
            'ClipHub.App = { MODULE_NAME: "ch_15_app", MODULE_VERSION: 23 };\n',
            encoding="utf-8",
        )
        (root / "assets" / "test" / "manifest-resource.txt").write_text(
            "resource-ok\n", encoding="utf-8"
        )
        return root

    def test_accepts_schema_v2_modules_resources_and_entry_version_8(self) -> None:
        root = self.make_root()
        manifest = {
            "schemaVersion": 2,
            "moduleSetVersion": "test.1",
            "entryMinVersion": 8,
            "sourceRef": "unit-test",
            "modules": [
                {
                    "name": "ch_01_base.js",
                    "path": "src/ch_01_base.js",
                    "sha": git_blob_sha((root / "src" / "ch_01_base.js").read_text(encoding="utf-8")),
                    "export": "Base",
                    "runtimeRole": "base",
                },
                {
                    "name": "ch_15_app.js",
                    "path": "src/ch_15_app.js",
                    "sha": git_blob_sha((root / "src" / "ch_15_app.js").read_text(encoding="utf-8")),
                    "export": "App",
                    "runtimeRole": "app",
                },
            ],
            "resources": [
                {
                    "id": "test.resource",
                    "purpose": "contract-test",
                    "path": "assets/test/manifest-resource.txt",
                    "sha": git_blob_sha((root / "assets" / "test" / "manifest-resource.txt").read_text(encoding="utf-8")),
                    "encoding": "utf-8",
                    "loadPolicy": "on_demand",
                }
            ],
        }
        (root / "module-manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        contract = validate_manifest_contract(root, mode="--unit")
        self.assertEqual(contract["schemaVersion"], 2)
        self.assertEqual(contract["entryVersion"], 8)
        self.assertEqual(contract["resourceCount"], 1)

    def test_rejects_schema_v2_when_entry_version_is_7(self) -> None:
        root = self.make_root()
        (root / "ClipHub.js").write_text("var ENTRY_VERSION = 7;\n", encoding="utf-8")
        manifest = build_manifest_contract(root, source_ref="unit-test", module_set_version="test.1")
        (root / "module-manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
        with self.assertRaises(ContractError):
            validate_manifest_contract(root, mode="--settings-tabs-beta")

    def test_local_v1_manifest_can_be_upgraded_for_offline_cache(self) -> None:
        root = self.make_root()
        legacy = {
            "schemaVersion": 1,
            "moduleSetVersion": "legacy.1",
            "entryMinVersion": 7,
            "sourceRef": "unit-test",
            "modules": [
                {
                    "name": "ch_01_base.js",
                    "path": "src/ch_01_base.js",
                    "sha": git_blob_sha((root / "src" / "ch_01_base.js").read_text(encoding="utf-8")),
                },
                {
                    "name": "ch_15_app.js",
                    "path": "src/ch_15_app.js",
                    "sha": git_blob_sha((root / "src" / "ch_15_app.js").read_text(encoding="utf-8")),
                },
            ],
        }
        upgraded = build_manifest_contract(root, source_ref="unit-test", module_set_version="test.1", legacy_manifest=legacy)
        self.assertEqual(upgraded["schemaVersion"], 2)
        self.assertEqual(upgraded["entryMinVersion"], 8)
        self.assertEqual(upgraded["modules"][0]["runtimeRole"], "base")
        self.assertEqual(upgraded["modules"][1]["runtimeRole"], "app")


if __name__ == "__main__":
    unittest.main()
