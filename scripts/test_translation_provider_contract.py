#!/usr/bin/env python3
import base64
import gzip
import json
import re
from pathlib import Path

root = Path(__file__).resolve().parents[1]
ch12 = (root / "src/ch_12_translation.js").read_text(encoding="utf-8")
loader = (root / "src/ch_13_settings.js").read_text(encoding="utf-8")
match = re.search(r'    var PACKED_B64\s*=\s*(.*?);\s*\n', loader, re.S)
assert match is not None
pieces = re.findall(r'"(?:\\.|[^"\\])*"', match.group(1))
encoded = ''.join(json.loads(piece) for piece in pieces)
settings = gzip.decompress(base64.b64decode(encoded)).decode('utf-8')

assert 'settings.get("translation.provider", "baidu")' in ch12
assert 'settings.get("translation.mode"' not in ch12
assert 'settings.get("translation.engine"' not in ch12
assert 'config.provider === "google"' in ch12
assert 'fallbackBuiltin: true' not in ch12
assert 'testConfigured: function (text, callback, providerOverride)' in ch12
assert '"translation.provider": "baidu"' in settings
assert 'persist("translation.provider", output["translation.provider"])' in settings
assert '"translation.provider": draftTranslationMode' in settings
assert '"translation.mode": draftTranslationMode' not in settings
assert '"translation.engine": draftEngine' not in settings
assert '选择默认使用的翻译服务' in settings
assert '"内置翻译"' not in settings
assert 'selectedTranslationProvider' in settings
assert 'configuredTranslationProvider' in settings
print('translation provider contract: PASS')
