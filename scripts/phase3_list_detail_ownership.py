from pathlib import Path
import json
import subprocess


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit('%s replacement count=%d' % (label, count))
    return text.replace(old, new, 1)


list_path = Path('src/ch_09_list.js')
text = list_path.read_text(encoding='utf-8')

text = replace_once(
    text,
    '''        hide: function (closeWindow) {
            try {
                if (ClipHub.Translation && ClipHub.Translation.isAttached &&
                        ClipHub.Translation.isAttached()) {
                    ClipHub.Translation.close("list_hide");
                }
            } catch (ignoredTranslation) {}
            try {
                if (ClipHub.Settings && ClipHub.Settings.isAttached &&
                        ClipHub.Settings.isAttached()) {
                    ClipHub.Settings.close("list_hide");
                }
            } catch (ignoredSettings) {}
            visible = false;
''',
    '''        hide: function (closeWindow) {
            visible = false;
''',
    'List.hide cross-module close'
)

text = replace_once(
    text,
    '''        closeDetail: function () {
            try {
                if (ClipHub.Translation && ClipHub.Translation.isAttached &&
                        ClipHub.Translation.isAttached()) {
                    return ClipHub.Translation.close("navigation");
                }
            } catch (ignoredTranslation) {}
            try {
                if (ClipHub.Settings && ClipHub.Settings.isAttached &&
                        ClipHub.Settings.isAttached()) {
                    return ClipHub.Settings.close("navigation");
                }
            } catch (ignoredSettings) {}
            return closeDetail("api");
        },

        getDetailState: function () {
            var external;
            try {
                external = ClipHub.Translation && ClipHub.Translation.getState ?
                    ClipHub.Translation.getState() : null;
                if (external && (external.attached === true ||
                        external.open === true)) { return external; }
            } catch (ignoredTranslation) {}
            try {
                external = ClipHub.Settings && ClipHub.Settings.getState ?
                    ClipHub.Settings.getState() : null;
                if (external && (external.attached === true ||
                        external.open === true)) { return external; }
            } catch (ignoredSettings) {}
            return getDetailState();
        },
''',
    '''        closeDetail: function () {
            return closeDetail("api");
        },

        getDetailState: getDetailState,
''',
    'List public detail ownership'
)

text = replace_once(
    text,
    '        MODULE_VERSION: 16,\n',
    '        MODULE_VERSION: 17,\n',
    'List module version'
)

for token in [
    'ClipHub.Translation.close("list_hide")',
    'ClipHub.Settings.close("list_hide")',
    'ClipHub.Translation.close("navigation")',
    'ClipHub.Settings.close("navigation")',
    'ClipHub.Translation.getState()',
    'ClipHub.Settings.getState()'
]:
    if token in text:
        raise SystemExit('cross-module ownership remains: ' + token)

if text.count('function closeDetail(reason)') != 1:
    raise SystemExit('own closeDetail implementation contract changed')
if text.count('function getDetailState()') != 1:
    raise SystemExit('own getDetailState implementation contract changed')
if 'getDetailState: getDetailState,' not in text:
    raise SystemExit('public own detail state export missing')

list_path.write_text(text, encoding='utf-8')

manifest_path = Path('module-manifest.json')
manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
if manifest.get('moduleSetVersion') != '20260724.31':
    raise SystemExit('unexpected module set: %r' %
                     manifest.get('moduleSetVersion'))
if len(manifest.get('modules', [])) != 15:
    raise SystemExit('ENTRY_VERSION 5 physical module count changed')
manifest['moduleSetVersion'] = '20260724.32'
found = False
for item in manifest['modules']:
    if item.get('path') == 'src/ch_09_list.js':
        item['sha'] = subprocess.check_output(
            ['git', 'hash-object', 'src/ch_09_list.js'],
            text=True
        ).strip()
        found = True
if not found:
    raise SystemExit('List manifest entry missing')
manifest_path.write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + '\n',
    encoding='utf-8'
)
