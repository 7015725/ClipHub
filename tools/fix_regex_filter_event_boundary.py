#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import apply_regex_filter_beta as apply

FINAL_SET = "20260813.03"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one anchor, got {count}")
    return text.replace(old, new, 1)


def normalize_file(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    path.write_text("\n".join(line.rstrip() for line in text.splitlines()) + "\n",
                    encoding="utf-8")


def patch_current_filter() -> None:
    path = ROOT / "src" / "ch_11_filter.js"
    loader, variable, canonical = apply.unpack_loader(path)
    canonical = replace_once(
        canonical,
        '            clearRegexResultCache("clipboard_event:" +\n'
        '                String(origin || "unknown"));\n',
        '            clearRegexResultCache("clipboard_event");\n',
        "clipboard event reason independent of parameter name",
    )
    apply.repack_loader(path, loader, variable, canonical)
    normalize_file(path)


def patch_apply_tool() -> None:
    path = ROOT / "tools" / "apply_regex_filter_beta.py"
    text = path.read_text(encoding="utf-8")
    text = text.replace('MODULE_SET = "20260813.02"',
                        'MODULE_SET = "20260813.03"')
    text = text.replace("EXPECTED_MODULE_SET='20260813.02'",
                        "EXPECTED_MODULE_SET='20260813.03'")
    text = text.replace('expected_module_set == "20260813.02"',
                        'expected_module_set == "20260813.03"')

    normalize_anchor = '    path.write_text(loader, encoding="utf-8")\n\n\ndef patch_database()'
    normalize_replacement = (
        '    loader = "\\n".join(line.rstrip() for line in loader.splitlines()) + "\\n"\n'
        '    path.write_text(loader, encoding="utf-8")\n\n\ndef patch_database()'
    )
    text = replace_once(text, normalize_anchor, normalize_replacement,
                        "reproducible loader normalization")

    finalizer = r'''
def finalize_filter_canonical(canonical: str) -> str:
    declaration = re.compile(
        r"(^\s*function\s+onClipboardChange\s*\([^)]*\)\s*\{\n)",
        re.M,
    )
    matches = list(declaration.finditer(canonical))
    if len(matches) != 1:
        fail("onClipboardChange declaration mismatch: %d" % len(matches))
    match = matches[0]
    canonical = (
        canonical[:match.end()] +
        "        if (regexActive()) {\n" +
        "            clearRegexResultCache(\"clipboard_event\");\n" +
        "        }\n" +
        canonical[match.end():]
    )
    canonical = replace_once(
        canonical,
        "        paginationState.hasMore = stableTotal ? end < total : true;\n"
        "        if (paginationState.mode === \"ajax\" && !stableTotal &&\n"
        "                previewRows.length < regexMatchedIds.length) {\n"
        "            paginationState.hasMore = true;\n"
        "        }\n",
        "        paginationState.hasMore = stableTotal ? end < total : false;\n",
        "regex scan pagination final boundary",
    )
    canonical = replace_once(
        canonical,
        "        var snapshot;\n        var baseCriteria;\n",
        "        var snapshot;\n        var snapshotMaxId;\n        var candidateTotal;\n"
        "        var baseCriteria;\n",
        "regex worker primitive declarations",
    )
    canonical = replace_once(
        canonical,
        "        snapshot = ClipHub.Repository.getRegexScanSnapshot(baseCriteria);\n"
        "        signature = regexScanSignature(ruleRows, snapshot, baseCriteria);\n",
        "        snapshot = ClipHub.Repository.getRegexScanSnapshot(baseCriteria);\n"
        "        snapshotMaxId = Number(snapshot.maxItemId || 0);\n"
        "        candidateTotal = Number(snapshot.candidateTotal || 0);\n"
        "        signature = regexScanSignature(ruleRows, snapshot, baseCriteria);\n",
        "regex worker primitive capture",
    )
    canonical = replace_once(
        canonical,
        "        regexScanState.total = Number(snapshot.candidateTotal || 0);\n",
        "        regexScanState.total = candidateTotal;\n",
        "regex worker total primitive",
    )
    canonical = replace_once(
        canonical,
        "                            snapshotMaxId: Number(snapshot.maxItemId),\n",
        "                            snapshotMaxId: snapshotMaxId,\n",
        "regex worker max id primitive",
    )
    canonical = replace_once(
        canonical,
        "                            scanned >= Number(snapshot.candidateTotal || 0);\n",
        "                            scanned >= candidateTotal;\n",
        "regex worker completion primitive",
    )
    canonical = replace_once(
        canonical,
        "                                        Number(snapshot.candidateTotal || 0),\n",
        "                                        candidateTotal,\n",
        "regex worker publish primitive",
    )
    canonical = replace_once(
        canonical,
        "                } catch (error) {\n"
        "                    mainHandler.post(new Packages.java.lang.Runnable({\n"
        "                        run: function () {\n"
        "                            if (generation !== regexScanGeneration) { return; }\n"
        "                            regexScanState.running = false;\n"
        "                            regexScanState.complete = false;\n"
        "                            regexScanState.lastError = String(error);\n"
        "                            state.lastError = String(error);\n"
        "                            numberPagerState.loading = false;\n"
        "                            updateResultCountOnMain();\n"
        "                        }\n"
        "                    }));\n"
        "                }\n",
        "                } catch (error) {\n"
        "                    var workerErrorText = String(error);\n"
        "                    mainHandler.post(new Packages.java.lang.Runnable({\n"
        "                        run: function () {\n"
        "                            if (generation !== regexScanGeneration) { return; }\n"
        "                            regexScanState.running = false;\n"
        "                            regexScanState.complete = false;\n"
        "                            regexScanState.lastError = workerErrorText;\n"
        "                            state.lastError = workerErrorText;\n"
        "                            numberPagerState.loading = false;\n"
        "                            updateResultCountOnMain();\n"
        "                        }\n"
        "                    }));\n"
        "                }\n",
        "regex worker error text primitive",
    )
    return canonical
'''.strip("\n")
    text = replace_once(text, "\ndef patch_filter() -> None:\n",
                        "\n" + finalizer + "\n\ndef patch_filter() -> None:\n",
                        "apply tool filter finalizer definition")
    text = replace_once(
        text,
        '        "filter regex panel diagnostics",\n    )\n    repack_loader(path, loader, variable, canonical)\n\n\ndef patch_settings()',
        '        "filter regex panel diagnostics",\n    )\n'
        '    canonical = finalize_filter_canonical(canonical)\n'
        '    repack_loader(path, loader, variable, canonical)\n\n\ndef patch_settings()',
        "apply tool filter finalizer call",
    )

    rollback_writer = '''    rollback_path = ROOT / "probes" / "cliphub_regex_rollback_probe_060.md"
    rollback_path.write_text(
        "# ClipHub Regex Beta 回滚探针 060\\n\\n"
        "验证 `Beta -> main -> Beta`：运行目录保持 `shortx.getShortXDir()/ClipHub`，"
        "SQLite `user_version` 始终为 2，main 可正常启动，重新进入 Beta 后自定义"
        " `regex_rules` 仍存在。\\n",
        encoding="utf-8",
    )
'''
    text = replace_once(
        text,
        '    for relative, source in probes.items():\n'
        '        path = ROOT / relative\n'
        '        path.write_text(source, encoding="utf-8")\n\n\ndef cleanup_inspection_assets()',
        '    for relative, source in probes.items():\n'
        '        path = ROOT / relative\n'
        '        path.write_text(source, encoding="utf-8")\n'
        + rollback_writer + '\n\ndef cleanup_inspection_assets()',
        "apply tool rollback probe generation",
    )
    path.write_text(text, encoding="utf-8")


def update_metadata() -> None:
    manifest_path = ROOT / "module-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["moduleSetVersion"] = FINAL_SET
    manifest["sourceRef"] = "beta-regex-filter-20260813"
    if len(manifest.get("modules", [])) != 15:
        raise RuntimeError("formal module count changed")
    for item in manifest["modules"]:
        source = (ROOT / item["path"]).read_text(encoding="utf-8")
        item["sha"] = apply.git_blob_sha_text(source)
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                             encoding="utf-8")

    preflight_path = ROOT / "scripts" / "release_preflight.sh"
    preflight = preflight_path.read_text(encoding="utf-8")
    preflight = replace_once(preflight, "EXPECTED_MODULE_SET='20260813.02'",
                             "EXPECTED_MODULE_SET='20260813.03'",
                             "regex beta final module set")
    preflight_path.write_text(preflight, encoding="utf-8")


def verify() -> None:
    _, _, canonical = apply.unpack_loader(ROOT / "src" / "ch_11_filter.js")
    manifest = json.loads((ROOT / "module-manifest.json").read_text(encoding="utf-8"))
    assert 'clearRegexResultCache("clipboard_event");' in canonical
    assert 'clearRegexResultCache("clipboard_event:" +' not in canonical
    assert 'paginationState.hasMore = stableTotal ? end < total : false;' in canonical
    assert 'snapshotMaxId: snapshotMaxId' in canonical
    assert 'regexScanState.lastError = workerErrorText;' in canonical
    assert manifest["moduleSetVersion"] == FINAL_SET
    assert len(manifest["modules"]) == 15


def main() -> None:
    patch_current_filter()
    patch_apply_tool()
    update_metadata()
    verify()
    print("Regex clipboard event boundary fixed")
    print("moduleSetVersion:", FINAL_SET)


if __name__ == "__main__":
    main()
