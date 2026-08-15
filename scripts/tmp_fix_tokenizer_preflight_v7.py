#!/usr/bin/env python3
from pathlib import Path

path = Path('scripts/release_preflight.sh')
text = path.read_text(encoding='utf-8')
old = "        assert 'MODULE_VERSION: 6' in ui_shell_source\n"
new = "        assert 'MODULE_VERSION: 7' in ui_shell_source\n"
if text.count(old) != 1:
    raise SystemExit("unexpected UIShell single-quote version anchor count=%d" % text.count(old))
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('Tokenizer UIShell preflight secondary version anchor fixed')
