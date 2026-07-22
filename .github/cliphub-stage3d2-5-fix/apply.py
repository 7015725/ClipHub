from pathlib import Path
import json
import subprocess


def git_hash(path):
    return subprocess.check_output(['git', 'hash-object', path], text=True).strip()


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit('%s expected one match, got %d' % (label, count))
    return text.replace(old, new, 1)


settings_path = Path('src/ch_13_settings.js')
manifest_path = Path('module-manifest.json')

if git_hash(str(settings_path)) != 'b89efc92dffce9d6cb871909e98e4fd6c609426b':
    raise SystemExit('unexpected Settings v6 base')
if git_hash(str(manifest_path)) != '6a3ef4d926665b72c9b1f4907f3e84fcee4501b7':
    raise SystemExit('unexpected module manifest base')

text = settings_path.read_text(encoding='utf-8')
text = replace_once(text,
'''                uiState.tagUpdateCount += 1;
                emitTagsChanged("tag_updated", tagId);
                buildPage();
                return true;
''',
'''                uiState.tagUpdateCount += 1;
                emitTagsChanged("tag_updated", tagId);
                rebuildTagPage();
                return true;
''', 'settings update keep tag section')
text = replace_once(text,
'''                uiState.tagDeleteCount += 1;
                emitTagsChanged("tag_deleted", tagId);
                buildPage();
                return true;
''',
'''                uiState.tagDeleteCount += 1;
                emitTagsChanged("tag_deleted", tagId);
                rebuildTagPage();
                return true;
''', 'settings delete keep tag section')
text = replace_once(text, '        MODULE_VERSION: 6,',
                    '        MODULE_VERSION: 7,', 'settings version')
settings_path.write_text(text, encoding='utf-8')

manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
if manifest.get('moduleSetVersion') != '20260723.03':
    raise SystemExit('unexpected module set version')
manifest['moduleSetVersion'] = '20260723.04'
for module in manifest.get('modules', []):
    if module.get('name') == 'ch_13_settings.js':
        module['sha'] = git_hash(str(settings_path))
manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n',
                         encoding='utf-8')

Path('docs/阶段3D2-5标签设置定位修复.md').write_text('''# 阶段 3D2-5 标签设置定位修复

模块集：`20260723.04`，Settings v7。

修复标签重命名、颜色保存和删除后设置页回到顶部的问题。操作完成后重新构建设置页，并将滚动位置恢复到“标签管理”分组。

未修改数据库 schema v2、标签结构、Navigation v3、Filter Root 和后台生命周期。
''', encoding='utf-8')
