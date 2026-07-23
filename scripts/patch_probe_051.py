#!/usr/bin/env python3
from pathlib import Path

path = Path('probes/cliphub_shared_window_geometry_probe_051.js')
text = path.read_text(encoding='utf-8')

old_version = '    var PROBE_VERSION = 1;'
new_version = '    var PROBE_VERSION = 2;'
if text.count(old_version) != 1:
    raise RuntimeError('Expected probe version 1 exactly once')
text = text.replace(old_version, new_version, 1)

old_checks = '''            allScenesErrorFree:\n                !(s1.window && s1.window.lastError) &&\n                !(s2.filter && s2.filter.lastError) &&\n                !(s3.editor && s3.editor.lastError) &&\n                !(s4.settings && s4.settings.lastError) &&\n                !(s5.detail && s5.detail.lastError) &&\n                !(s6.translation && s6.translation.lastError)\n'''
new_checks = '''            translationPanelAttached:\n                s6.translation && s6.translation.attached === true,\n            translationBusinessError:\n                s6.translation ? s6.translation.lastError : null,\n            allScenesErrorFree:\n                !(s1.window && s1.window.lastError) &&\n                !(s2.filter && s2.filter.lastError) &&\n                !(s3.editor && s3.editor.lastError) &&\n                !(s4.settings && s4.settings.lastError) &&\n                !(s5.detail && s5.detail.lastError)\n'''
if text.count(old_checks) != 1:
    raise RuntimeError('Geometry error boundary block was not found exactly once')
text = text.replace(old_checks, new_checks, 1)

old_ok = '''            result.checks.translationRoleRegistered &&\n            result.checks.translationSizeSynced &&\n            result.checks.allScenesErrorFree;\n'''
new_ok = '''            result.checks.translationRoleRegistered &&\n            result.checks.translationPanelAttached &&\n            result.checks.translationSizeSynced &&\n            result.checks.allScenesErrorFree;\n'''
if text.count(old_ok) != 1:
    raise RuntimeError('Probe result gate was not found exactly once')
text = text.replace(old_ok, new_ok, 1)

path.write_text(text, encoding='utf-8')
