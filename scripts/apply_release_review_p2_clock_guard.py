#!/usr/bin/env python3
from pathlib import Path
import json
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def write(path, value):
    (ROOT / path).write_text(value, encoding="utf-8")


def replace_once(path, old, new):
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError("%s expected one match, found %d" % (path, count))
    write(path, text.replace(old, new, 1))


replace_once(
    "src/ch_04_clipboard.js",
    '        var classified;\n        var event;\n        state.eventSeq += 1;',
    '        var classified;\n        var event;\n        var callbackDeltaMs;\n        state.eventSeq += 1;'
)
replace_once(
    "src/ch_04_clipboard.js",
    '            if (state.ownWrite.hash === hash &&\n                    eventAt <= state.ownWrite.expiresAt) {',
    '            if (state.ownWrite.hash === hash &&\n                    eventAt >= Number(state.ownWrite.at || 0) &&\n                    eventAt <= Number(state.ownWrite.expiresAt || 0)) {'
)
replace_once(
    "src/ch_04_clipboard.js",
    '            if (state.lastObserved.hash === hash &&\n                    eventAt - state.lastObserved.at <= config.callbackDedupMs) {',
    '            callbackDeltaMs = eventAt - Number(state.lastObserved.at || 0);\n'
    '            if (state.lastObserved.hash === hash &&\n'
    '                    callbackDeltaMs >= 0 &&\n'
    '                    callbackDeltaMs <= Number(config.callbackDedupMs)) {'
)
replace_once("src/ch_04_clipboard.js", 'MODULE_VERSION: 7', 'MODULE_VERSION: 8')

manifest_path = ROOT / "module-manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
if manifest.get("moduleSetVersion") != "20260726.08":
    raise RuntimeError("unexpected module set version")
if manifest.get("sourceRef") != "agent/release-review-p2":
    raise RuntimeError("unexpected source ref")
for module in manifest["modules"]:
    module["sha"] = subprocess.check_output(
        ["git", "hash-object", module["path"]], cwd=str(ROOT), text=True
    ).strip()
manifest_path.write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8"
)

text = read("src/ch_04_clipboard.js")
if "callbackDeltaMs >= 0" not in text:
    raise RuntimeError("callback clock guard missing")
if "eventAt >= Number(state.ownWrite.at || 0)" not in text:
    raise RuntimeError("own-write clock guard missing")
print("applied P2 clock guards")
