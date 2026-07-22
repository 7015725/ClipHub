from pathlib import Path
import subprocess


def git_hash(path):
    return subprocess.check_output(['git', 'hash-object', path], text=True).strip()


def check_hash(path, expected):
    actual = git_hash(path)
    if actual != expected:
        raise SystemExit('Unexpected base for %s: %s != %s' %
                         (path, actual, expected))


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit('%s expected one match, got %d' % (label, count))
    return text.replace(old, new, 1)


check_hash('probes/cliphub_content_tags_settings_probe_045_impl.js',
           '8aa654a730c8ce4ad24be3b41982145f9e1be2b5')
check_hash('probes/cliphub_content_tags_settings_probe_045.js',
           'cc80c45973059d5cb44577f2e90935866f7a5607')
check_hash('docs/内容标签翻译设置探测045说明.md',
           '2fc8d9943b7e4d77895b0ece453d9598bf7855ae')

path = Path('probes/cliphub_content_tags_settings_probe_045_impl.js')
text = path.read_text(encoding='utf-8')

if text.count('probeVersion: 2') != 2:
    raise SystemExit('probe version marker count mismatch')
text = text.replace('probeVersion: 2', 'probeVersion: 3')

text = replace_once(
    text,
    '            instruction: "场景1截无内容类型且显示标签的唯一首页；场景2截翻译设置；场景3截标签管理。三张截图均不得裁剪。",\n',
    '            instruction: "场景1截默认唯一首页；场景2截已预选有道的翻译设置；场景3截标签管理。三张截图均不得裁剪。",\n'
    '            scene1CapturedBeforePagingAndTranslation: true,\n'
    '            translationTerminalStateRequired: true,\n'
    '            settingsConfiguredBeforeOpen: true,\n',
    'probe v3 metadata')

text = replace_once(
    text,
    '''            result.urlTags = global.ClipHub.Repository.listItemTags(result.urlId);\n\n            result.show = global.ClipHub.App.executeControlCommand("show");\n''',
    '''            result.urlTags = global.ClipHub.Repository.listItemTags(result.urlId);\n\n            result.translationGuardValues = global.ClipHub.Settings.setMany({\n                "translation.engine": "baidu",\n                "translation.baidu.app_id": "",\n                "translation.baidu.app_secret": "",\n                "translation.youdao.app_key": "",\n                "translation.youdao.app_secret": ""\n            }, { cleanup: false });\n            global.ClipHub.Settings.reload();\n\n            result.show = global.ClipHub.App.executeControlCommand("show");\n''',
    'translation guard configuration')

text = replace_once(
    text,
    '                    panel.renderedTagLabelCount >= 3 &&\n',
    '                    panel.renderedTagLabelCount >= 2 &&\n',
    'first page tag assertion')

old_flow = '''            result.firstPageState = global.ClipHub.Filter.getPanelState();\n            result.loadMoreClick = global.ClipHub.Filter.performLoadMoreClick();\n            result.loadMoreReady = waitFor(function () {\n                var panel = global.ClipHub.Filter.getPanelState();\n                return panel.resultCardCount >= 28 &&\n                    panel.loadedResultCount >= 28 &&\n                    panel.resultHasMore === false;\n            }, 1800);\n            result.afterLoadMoreState = global.ClipHub.Filter.getPanelState();\n            result.translationSelect = global.ClipHub.Filter\n                .performResultLongClick(0);\n            result.translationClick = global.ClipHub.Filter\n                .performBottomActionClick("detail");\n            result.translationPopupReady = waitFor(function () {\n                return global.ClipHub.Translation.getState().attached === true;\n            }, 1500);\n            result.translationPopupState = global.ClipHub.Translation.getState();\n            result.translationClose = global.ClipHub.Translation.close(\n                "probe045_translation_guard");\n            result.translationClosedReady = waitFor(function () {\n                return global.ClipHub.Translation.getState().attached === false &&\n                    global.ClipHub.Filter.getPanelState().attached === true;\n            }, 1200);\n            result.rootScene = {\n                app: global.ClipHub.App.getStatus(),\n                filter: global.ClipHub.Filter.getState()\n            };\n            showToast("045  1/3  标签首页  ·  已验证滚动分页与翻译入口");\n            Thread.sleep(SCENE_DURATION_MS);\n\n            result.settingsOpen = global.ClipHub.Filter.performSettingsClick();\n            result.settingsReady = waitFor(function () {\n                var state = global.ClipHub.Settings.getState();\n                return state.attached === true && state.sectionCount === 4 &&\n                    state.translationFieldCount === 4 &&\n                    state.contentTypeSettingsPresent === false;\n            }, 1500);\n            global.ClipHub.Settings.setMany({\n                "translation.engine": "youdao",\n                "translation.baidu.app_id": "probe-baidu-id",\n                "translation.baidu.app_secret": "probe-baidu-secret",\n                "translation.youdao.app_key": "probe-youdao-key",\n                "translation.youdao.app_secret": "probe-youdao-secret"\n            }, { cleanup: false });\n            global.ClipHub.Settings.reload();\n            global.ClipHub.Settings.scrollToSection("translation");\n'''

new_flow = '''            result.firstPageState = global.ClipHub.Filter.getPanelState();\n            result.rootScene = {\n                app: global.ClipHub.App.getStatus(),\n                filter: global.ClipHub.Filter.getState()\n            };\n            showToast("045  1/3  默认标签首页  ·  截图前未加载更多或长按");\n            Thread.sleep(SCENE_DURATION_MS);\n\n            result.loadMoreClick = global.ClipHub.Filter.performLoadMoreClick();\n            result.loadMoreReady = waitFor(function () {\n                var panel = global.ClipHub.Filter.getPanelState();\n                return panel.resultCardCount >= 28 &&\n                    panel.loadedResultCount >= 28 &&\n                    panel.renderedTagLabelCount >= 3 &&\n                    panel.resultHasMore === false;\n            }, 1800);\n            result.afterLoadMoreState = global.ClipHub.Filter.getPanelState();\n            result.translationSelect = global.ClipHub.Filter\n                .performResultLongClick(0);\n            result.translationClick = global.ClipHub.Filter\n                .performBottomActionClick("detail");\n            result.translationPopupReady = waitFor(function () {\n                return global.ClipHub.Translation.getState().attached === true;\n            }, 1500);\n            result.translationTerminalReady = waitFor(function () {\n                var state = global.ClipHub.Translation.getState();\n                return state.attached === true &&\n                    state.running === false &&\n                    state.errorCount >= 1 &&\n                    state.lastError !== null;\n            }, 2500);\n            result.translationPopupState = global.ClipHub.Translation.getState();\n            result.translationClose = global.ClipHub.Translation.close(\n                "probe045_translation_guard");\n            result.translationClosedReady = waitFor(function () {\n                return global.ClipHub.Translation.getState().attached === false &&\n                    global.ClipHub.Filter.getPanelState().attached === true;\n            }, 1200);\n\n            result.translationSettingsWrite = global.ClipHub.Settings.setMany({\n                "translation.engine": "youdao",\n                "translation.baidu.app_id": "probe-baidu-id",\n                "translation.baidu.app_secret": "probe-baidu-secret",\n                "translation.youdao.app_key": "probe-youdao-key",\n                "translation.youdao.app_secret": "probe-youdao-secret"\n            }, { cleanup: false });\n            global.ClipHub.Settings.reload();\n            result.settingsOpen = global.ClipHub.Filter.performSettingsClick();\n            result.settingsReady = waitFor(function () {\n                var state = global.ClipHub.Settings.getState();\n                return state.attached === true && state.sectionCount === 4 &&\n                    state.translationFieldCount === 4 &&\n                    state.contentTypeSettingsPresent === false &&\n                    state.selectedEngine === "youdao" &&\n                    state.configuredEngine === "youdao";\n            }, 1500);\n            global.ClipHub.Settings.scrollToSection("translation");\n'''
text = replace_once(text, old_flow, new_flow, 'probe scene and action ordering')

text = replace_once(
    text,
    '''                result.firstPageState.resultCardCount === 20 &&\n                result.firstPageState.resultHasMore === true &&\n                result.firstPageState.resultCanScroll === true &&\n                result.loadMoreClick === true &&\n''',
    '''                result.firstPageState.resultCardCount === 20 &&\n                result.firstPageState.renderedTagLabelCount >= 2 &&\n                result.firstPageState.resultHasMore === true &&\n                result.firstPageState.resultCanScroll === true &&\n                result.rootScene.filter.panel.selectionMode === false &&\n                result.rootScene.filter.panel.loadedResultCount === 20 &&\n                result.loadMoreClick === true &&\n''',
    'scene one success conditions')

text = replace_once(
    text,
    '''                result.afterLoadMoreState.resultCardCount >= 28 &&\n                result.afterLoadMoreState.resultHasMore === false &&\n                result.translationSelect === true &&\n''',
    '''                result.afterLoadMoreState.resultCardCount >= 28 &&\n                result.afterLoadMoreState.renderedTagLabelCount >= 3 &&\n                result.afterLoadMoreState.resultHasMore === false &&\n                result.translationSelect === true &&\n''',
    'loaded result success conditions')

text = replace_once(
    text,
    '''                result.translationPopupReady === true &&\n                result.translationPopupState.attached === true &&\n                result.translationClose === true &&\n''',
    '''                result.translationPopupReady === true &&\n                result.translationTerminalReady === true &&\n                result.translationPopupState.attached === true &&\n                result.translationPopupState.running === false &&\n                result.translationPopupState.errorCount >= 1 &&\n                result.translationPopupState.lastError !== null &&\n                result.translationClose === true &&\n''',
    'translation terminal success conditions')

text = replace_once(
    text,
    '''                result.translationSettingsScene.settings\n                    .contentTypeSettingsPresent === false &&\n                result.translationSettingsScene.values\n                    ["translation.engine"] === "youdao" &&\n''',
    '''                result.translationSettingsScene.settings\n                    .contentTypeSettingsPresent === false &&\n                result.translationSettingsScene.settings\n                    .selectedEngine === "youdao" &&\n                result.translationSettingsScene.settings\n                    .configuredEngine === "youdao" &&\n                result.translationSettingsScene.values\n                    ["translation.engine"] === "youdao" &&\n''',
    'settings engine success conditions')

path.write_text(text, encoding='utf-8')

loader = Path('probes/cliphub_content_tags_settings_probe_045.js')
text = loader.read_text(encoding='utf-8')
text = replace_once(text, 'ClipHub-Probe/045-v2', 'ClipHub-Probe/045-v3',
                    'loader user agent')
text = replace_once(text, 'source.indexOf("probeVersion: 2") < 0',
                    'source.indexOf("probeVersion: 3") < 0',
                    'loader version validation')
text = replace_once(
    text,
    '''                source.indexOf("translationPopupReady") < 0 ||\n                source.indexOf("cliphub_content_tags_settings_probe_045") < 0) {\n''',
    '''                source.indexOf("translationPopupReady") < 0 ||\n                source.indexOf("translationTerminalReady") < 0 ||\n                source.indexOf("scene1CapturedBeforePagingAndTranslation") < 0 ||\n                source.indexOf("settingsConfiguredBeforeOpen") < 0 ||\n                source.indexOf("cliphub_content_tags_settings_probe_045") < 0) {\n''',
    'loader v3 validation markers')
text = replace_once(text, 'probe_045_impl_v2.js', 'probe_045_impl_v3.js',
                    'loader source URL')
loader.write_text(text, encoding='utf-8')

Path('docs/内容标签翻译设置探测045说明.md').write_text(
'''# ClipHub 内容、标签、翻译设置探测 045\n\n探测版本：`v3`。模块集：`20260723.02`。\n\n## v3 修正\n\n探测 v2 的产品功能实际通过，但场景和断言存在三项误差：\n\n- 首批页面只会显示 URL 卡片的两个标签，不应要求累计三个标签；\n- 场景 1 截图前不应先执行加载更多、长按和翻译；\n- 翻译弹窗附着后应等待 `running=false` 的稳定失败终态；\n- 有道配置必须在打开设置页之前写入，使页面选择态与 SQLite 配置一致。\n\n## 验证内容\n\n- URL、电话等输入统一按普通文本处理；\n- 内容类型筛选完全停用；\n- 默认首页首批加载 20 条并可滚动；\n- 场景 1 截图时保持 `selectionMode=false`；\n- 加载更多后显示全部 28 条夹具记录；\n- 长按后点击翻译可打开独立弹窗；\n- 空翻译凭据进入稳定失败状态，不得导致 `system_server` 重启；\n- 关闭翻译弹窗后返回唯一 Filter Root；\n- 设置页打开时 `selectedEngine=youdao` 且 `configuredEngine=youdao`；\n- 百度和有道凭据继续结构化保存于 SQLite；\n- 标签管理、schema v2、Navigation v3、正式实例恢复和运行锁清理保持正常。\n\n## 截图\n\n1. 默认唯一首页：未加载更多、未长按、显示标签且没有内容类型；\n2. 已预选有道翻译的翻译设置；\n3. 标签管理。\n\n加载器固定读取实现提交：\n\n```text\n__IMPLEMENTATION_COMMIT__\n```\n''', encoding='utf-8')
