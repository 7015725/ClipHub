#!/usr/bin/env python3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PREFLIGHT = ROOT / "scripts" / "release_preflight.sh"


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError("%s: expected one anchor, got %d" % (label, count))
    return text.replace(old, new, 1)


text = PREFLIGHT.read_text(encoding="utf-8")
anchor = "echo 'Expanded JS syntax verification: passed'\n"
insertion = anchor + "if [ \"$MODE\" = '--settings-tabs-beta' ]; then\n" + \
    "  node scripts/test_ui_shell_navigation.js\n" + \
    "fi\n"
if "node scripts/test_ui_shell_navigation.js" not in text:
    text = replace_once(text, anchor, insertion,
                        "Stage6 navigation regression invocation")

text = replace_once(
    text,
    '        assert \'migrationStage: "primary_window_settings_regex_translation_editor_tags_tokenizer_detail_filter_overlay_closed"\' in ui_shell_source\n',
    '        assert \'migrationStage: "primary_window_settings_regex_translation_editor_tags_tokenizer_detail_filter_overlay_closed"\' in ui_shell_source\n'
    '        assert \'registerPage({ id: "filter"\' not in ui_shell_source\n'
    '        assert \'MODULE_VERSION: 5\' in ui_shell_source\n',
    "Stage6 UIShell closure contracts",
)
text = replace_once(
    text,
    '        print("UI shell stage5 contracts: passed")',
    '        print("UI shell stage6 contracts: passed")',
    "Stage6 preflight label",
)
PREFLIGHT.write_text(text, encoding="utf-8")
print("Stage6 finalization patch applied")
