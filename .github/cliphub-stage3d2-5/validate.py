from pathlib import Path
import re

checks = {
    'src/ch_10_editor.js': [
        'MODULE_VERSION: 10',
        'reference_tag_selector_v1',
        'performTagSelectionSaveClick',
        'ClipHub.Repository.setItemTags(id, editorDraftTagIds)'
    ],
    'src/ch_11_filter.js': [
        'MODULE_VERSION: 14',
        'reference_search_v7',
        'tagColorPreviewCount'
    ],
    'src/ch_13_settings.js': [
        'MODULE_VERSION: 6',
        'reference_settings_v2',
        'dragReorderEnabled: true',
        'deleteRequiresConfirmation: true'
    ]
}

for name, markers in checks.items():
    text = Path(name).read_text(encoding='utf-8')
    forbidden = []
    if re.search(r'(?m)^\s*(?:let|const)\s+', text):
        forbidden.append('let/const')
    if '=>' in text:
        forbidden.append('arrow')
    if '`' in text:
        forbidden.append('template literal')
    if re.search(r'\bclass\s+[A-Za-z_$]', text):
        forbidden.append('class')
    if forbidden:
        raise SystemExit(name + ': forbidden ES6: ' + ', '.join(forbidden))
    for marker in markers:
        if marker not in text:
            raise SystemExit(name + ': missing marker ' + marker)
