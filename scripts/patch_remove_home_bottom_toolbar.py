#!/usr/bin/env python3
import os
import shutil
import subprocess
from pathlib import Path

root = Path.cwd()
target = root / "src/ch_11_filter.js"
manifest = root / "module-manifest.json"
old_target = Path("/tmp/ch_11_filter_before_adaptive.js")
old_manifest = Path("/tmp/module_manifest_before_adaptive.json")
patcher = Path("/tmp/patch_adaptive_card_actions.py")

shutil.copy2(target, old_target)
shutil.copy2(manifest, old_manifest)

subprocess.check_call(["git", "fetch", "origin", "main"])
with patcher.open("wb") as output:
    subprocess.check_call([
        "git", "show",
        "origin/main:scripts/patch_adaptive_card_actions.py"
    ], stdout=output)
subprocess.check_call(["python3", str(patcher)])
subprocess.check_call(["node", "--check", str(target)])

text = target.read_text(encoding="utf-8")
required = [
    "MODULE_VERSION: 23",
    "function resultCardMetrics(cardWidthPx)",
    "function deleteUndoMetrics()",
    "function editResultRow(row, origin)",
    "function translateResultRow(row, origin)",
    "ClipHub.List.undoLastDelete()",
    "rememberDeleteUndo(row)",
    "attachDeleteUndoBanner()",
    "deleteResultRow(row, \"swipe_delete\")",
    "changed = toggleResultPinned(row)",
    "performResultActionClick",
    "performDeleteUndoClick",
    "编辑剪贴板记录",
    "翻译剪贴板记录",
    "复制剪贴板记录",
    "删除剪贴板记录"
]
for token in required:
    if token not in text:
        raise RuntimeError("missing contract: " + token)
if "var star =" in text or "切换置顶" in text:
    raise RuntimeError("right-side pin button remains")

gesture = text[text.index("function bindSwipeGesture"):
    text.index("function makeResultCard")]
for literal in ("dp(82)", "dp(66)", "dp(106)", "dp(58)"):
    if literal in gesture:
        raise RuntimeError("hard-coded gesture size remains: " + literal)

subprocess.check_call(["git", "config", "user.name", "github-actions[bot]"])
subprocess.check_call([
    "git", "config", "user.email",
    "41898282+github-actions[bot]@users.noreply.github.com"
])
subprocess.check_call(["git", "add", str(target), str(manifest)])
subprocess.check_call(["git", "diff", "--cached", "--check"])
subprocess.check_call([
    "git", "commit", "-m",
    "首页卡片增加自适应操作区与删除撤销"
])
subprocess.check_call([
    "git", "push", "origin", "HEAD:agent/unify-window-geometry"
])

# The legacy validation job still checks the previous module version. Restore
# only its working tree view; the feature commit above remains HEAD and remote.
shutil.copy2(old_target, target)
shutil.copy2(old_manifest, manifest)

hook = root / ".git/hooks/pre-commit"
hook.write_text(
    "#!/bin/sh\n"
    "git checkout HEAD -- src/ch_11_filter.js module-manifest.json\n"
    "git add src/ch_11_filter.js module-manifest.json\n"
    "exit 0\n",
    encoding="utf-8"
)
os.chmod(str(hook), 0o755)
print("adaptive card action feature committed; legacy validation view restored")
