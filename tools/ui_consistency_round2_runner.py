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


original_unpack_tokenizer = module.unpack_tokenizer


def unpack_tokenizer_with_current_padding(loader):
    source = original_unpack_tokenizer(loader)
    current = 'pageColumn.setPadding(0, 0, 0, dp(3));'
    adapter = 'pageColumn.setPadding(dp(8), dp(2), dp(8), dp(3));'
    if current in source:
        return source.replace(current, adapter, 1)
    if adapter in source or 'pageColumn.setPadding(dp(12), dp(2), dp(12), dp(3));' in source:
        return source
    raise SystemExit("tokenizer page padding baseline unavailable")


module.replace_once = bounded_replace_once
module.unpack_tokenizer = unpack_tokenizer_with_current_padding
module.main()
