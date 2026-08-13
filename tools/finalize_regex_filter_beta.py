#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import apply_regex_filter_beta as apply

FINAL_SET = "20260813.02"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one anchor, got {count}")
    return text.replace(old, new, 1)


def insert_after_function_decl(text: str, name: str, body: str,
                               label: str) -> str:
    pattern = re.compile(
        r"(^\s*function\s+" + re.escape(name) + r"\s*\([^)]*\)\s*\{\n)",
        re.M,
    )
    matches = list(pattern.finditer(text))
    if len(matches) != 1:
        raise RuntimeError(f"{label}: expected one function declaration, got {len(matches)}")
    match = matches[0]
    return text[:match.end()] + body + text[match.end():]


def normalize_loader(path: Path) -> None:
    text = path.read_text(encoding="utf-8")
    path.write_text("\n".join(line.rstrip() for line in text.splitlines()) + "\n",
                    encoding="utf-8")


def patch_filter() -> None:
    path = ROOT / "src" / "ch_11_filter.js"
    loader, variable, canonical = apply.unpack_loader(path)

    canonical = insert_after_function_decl(
        canonical,
        "onClipboardChange",
        "        if (regexActive()) {\n"
        "            clearRegexResultCache(\"clipboard_event:\" +\n"
        "                String(origin || \"unknown\"));\n"
        "        }\n",
        "clipboard event regex cache invalidation",
    )

    canonical = replace_once(
        canonical,
        "        paginationState.hasMore = stableTotal ? end < total : true;\n"
        "        if (paginationState.mode === \"ajax\" && !stableTotal &&\n"
        "                previewRows.length < regexMatchedIds.length) {\n"
        "            paginationState.hasMore = true;\n"
        "        }\n",
        "        paginationState.hasMore = stableTotal ? end < total : false;\n",
        "scan-in-progress pagination gate",
    )

    canonical = replace_once(
        canonical,
        "        var snapshot;\n        var baseCriteria;\n",
        "        var snapshot;\n        var snapshotMaxId;\n        var candidateTotal;\n"
        "        var baseCriteria;\n",
        "regex scan primitive declarations",
    )
    canonical = replace_once(
        canonical,
        "        snapshot = ClipHub.Repository.getRegexScanSnapshot(baseCriteria);\n"
        "        signature = regexScanSignature(ruleRows, snapshot, baseCriteria);\n",
        "        snapshot = ClipHub.Repository.getRegexScanSnapshot(baseCriteria);\n"
        "        snapshotMaxId = Number(snapshot.maxItemId || 0);\n"
        "        candidateTotal = Number(snapshot.candidateTotal || 0);\n"
        "        signature = regexScanSignature(ruleRows, snapshot, baseCriteria);\n",
        "regex scan primitive capture",
    )
    canonical = replace_once(
        canonical,
        "        regexScanState.total = Number(snapshot.candidateTotal || 0);\n",
        "        regexScanState.total = candidateTotal;\n",
        "regex scan state primitive total",
    )
    canonical = replace_once(
        canonical,
        "                            snapshotMaxId: Number(snapshot.maxItemId),\n",
        "                            snapshotMaxId: snapshotMaxId,\n",
        "worker snapshot id primitive",
    )
    canonical = replace_once(
        canonical,
        "                            scanned >= Number(snapshot.candidateTotal || 0);\n",
        "                            scanned >= candidateTotal;\n",
        "worker candidate total primitive",
    )
    canonical = replace_once(
        canonical,
        "                                        Number(snapshot.candidateTotal || 0),\n",
        "                                        candidateTotal,\n",
        "worker publish total primitive",
    )

    old_catch = '''                } catch (error) {
                    mainHandler.post(new Packages.java.lang.Runnable({
                        run: function () {
                            if (generation !== regexScanGeneration) { return; }
                            regexScanState.running = false;
                            regexScanState.complete = false;
                            regexScanState.lastError = String(error);
                            state.lastError = String(error);
                            numberPagerState.loading = false;
                            updateResultCountOnMain();
                        }
                    }));
                }
'''
    new_catch = '''                } catch (error) {
                    var workerErrorText = String(error);
                    mainHandler.post(new Packages.java.lang.Runnable({
                        run: function () {
                            if (generation !== regexScanGeneration) { return; }
                            regexScanState.running = false;
                            regexScanState.complete = false;
                            regexScanState.lastError = workerErrorText;
                            state.lastError = workerErrorText;
                            numberPagerState.loading = false;
                            updateResultCountOnMain();
                        }
                    }));
                }
'''
    canonical = replace_once(canonical, old_catch, new_catch,
                             "worker error primitive handoff")

    apply.repack_loader(path, loader, variable, canonical)
    normalize_loader(path)


def update_release_metadata() -> None:
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
    preflight = replace_once(preflight, "EXPECTED_MODULE_SET='20260813.01'",
                             "EXPECTED_MODULE_SET='20260813.02'",
                             "regex beta preflight set")
    preflight_path.write_text(preflight, encoding="utf-8")

    apply_path = ROOT / "tools" / "apply_regex_filter_beta.py"
    apply_text = apply_path.read_text(encoding="utf-8")
    apply_text = apply_text.replace('MODULE_SET = "20260813.01"',
                                    'MODULE_SET = "20260813.02"')
    apply_text = apply_text.replace("EXPECTED_MODULE_SET='20260813.01'",
                                    "EXPECTED_MODULE_SET='20260813.02'")
    apply_text = apply_text.replace('expected_module_set == "20260813.01"',
                                    'expected_module_set == "20260813.02"')
    apply_path.write_text(apply_text, encoding="utf-8")


def write_rollback_probe() -> None:
    path = ROOT / "probes" / "cliphub_regex_rollback_probe_060.md"
    path.write_text(
        "# ClipHub Regex Beta 回滚探针 060\n\n"
        "目标：验证 Beta 与 main 共用 `shortx.getShortXDir()/ClipHub` 时，"
        "Beta 新增正则功能不会提高 SQLite `user_version`，并可安全 "
        "`Beta -> main -> Beta`。\n\n"
        "## 前置\n\n"
        "- main 与 Beta 不可同时运行。\n"
        "- 记录测试前剪贴板条数。\n"
        "- 不删除 `shortx.getShortXDir()/ClipHub/data/cliphub.db`。\n\n"
        "## 步骤\n\n"
        "1. 启动 `main`，记录 `Database.getVersion()` 与 `Repository.countItems()`；"
        "预期数据库版本为 `2`。\n"
        "2. 停止 main。\n"
        "3. 使用 `beta-regex-filter-20260813` 入口启动 Beta。\n"
        "4. 确认 `Database.getVersion() == 2`，创建一条自定义正则规则并执行一次高级正则筛选。\n"
        "5. 停止 Beta。\n"
        "6. 再次使用 main 入口启动。\n"
        "7. 确认 main 正常启动、数据库版本仍为 `2`、原剪贴板记录仍可读取，"
        "无 `Database schema is newer than this build`。\n"
        "8. 停止 main，再次启动 Beta。\n"
        "9. 确认步骤 4 创建的自定义正则规则仍存在。\n\n"
        "## PASS 条件\n\n"
        "- 全过程运行目录始终为 `shortx.getShortXDir()/ClipHub`。\n"
        "- SQLite `user_version` 始终为 `2`。\n"
        "- main 可正常启动并读取旧数据。\n"
        "- 再切回 Beta 后 `regex_rules` 用户数据仍存在。\n"
        "- 未出现新增 `ClipHubBeta` / `ClipHubTest` 目录。\n",
        encoding="utf-8",
    )


def verify_boundaries() -> None:
    db = (ROOT / "src/ch_03_database.js").read_text(encoding="utf-8")
    entry = (ROOT / "ClipHub.js").read_text(encoding="utf-8")
    manifest = json.loads((ROOT / "module-manifest.json").read_text(encoding="utf-8"))
    _, _, filter_source = apply.unpack_loader(ROOT / "src/ch_11_filter.js")
    assert "var SCHEMA_VERSION = 2;" in db
    assert "db.setVersion(3)" not in db
    assert 'var DEFAULT_REF = "beta-regex-filter-20260813";' in entry
    assert "ClipHubBeta" not in entry and "ClipHubTest" not in entry
    assert manifest["moduleSetVersion"] == FINAL_SET
    assert manifest["sourceRef"] == "beta-regex-filter-20260813"
    assert len(manifest["modules"]) == 15
    assert 'paginationState.hasMore = stableTotal ? end < total : false;' in filter_source
    assert 'clearRegexResultCache("clipboard_event:" +' in filter_source
    assert 'snapshotMaxId: snapshotMaxId' in filter_source
    assert 'scanned >= candidateTotal' in filter_source
    assert 'regexScanState.lastError = workerErrorText;' in filter_source


def main() -> None:
    patch_filter()
    update_release_metadata()
    write_rollback_probe()
    verify_boundaries()
    print("Regex beta final boundary fixes applied")
    print("moduleSetVersion:", FINAL_SET)
    print("SQLite user_version contract: 2")


if __name__ == "__main__":
    main()
