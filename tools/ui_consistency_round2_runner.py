#!/usr/bin/env python3
import importlib.util
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
TARGET = ROOT / "tools/ui_consistency_round2_20260815.py"
spec = importlib.util.spec_from_file_location("ui_round2_impl", str(TARGET))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def bounded_replace_once(text, old, new, label):
    count = text.count(old)
    if label == "editor header geometry":
        if count < 1:
            raise SystemExit("%s anchor count=%d" % (label, count))
        return text.replace(old, new, 1)
    if count != 1:
        raise SystemExit("%s anchor count=%d" % (label, count))
    return text.replace(old, new, 1)


module.replace_once = bounded_replace_once
module.main()
