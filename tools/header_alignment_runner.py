#!/usr/bin/env python3
import importlib.util
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
TARGET = ROOT / 'tools/header_alignment_20260815.py'
spec = importlib.util.spec_from_file_location('header_alignment_impl', str(TARGET))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
_original = module.replace_in_region


def bounded_replace_in_region(text, start_marker, end_marker, old, new, label):
    if label.startswith('settings root '):
        return module.replace_once(text, old, new, label)
    return _original(text, start_marker, end_marker, old, new, label)


module.replace_in_region = bounded_replace_in_region
module.main()
