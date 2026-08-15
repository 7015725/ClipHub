#!/usr/bin/env python3
import base64
import gzip
import hashlib
import json
import re
from pathlib import Path

EXPANDED_PATH = Path('stage-assets/tokenizer-rules-probe/ch_17_tokenizer_ui.expanded.js')
LOADER_PATH = Path('src/ch_17_tokenizer_ui.js')
MANIFEST_PATH = Path('module-manifest.json')
CONTRACT_PATH = Path('scripts/manifest_contract.py')
PREFLIGHT_PATH = Path('scripts/release_preflight.sh')
SERVICE_PATH = Path('src/ch_19_tokenizer_service.js')

source = EXPANDED_PATH.read_text(encoding='utf-8')


def replace_once(old, new, label):
    global source
    count = source.count(old)
    if count != 1:
        raise RuntimeError('%s anchor count=%d' % (label, count))
    source = source.replace(old, new, 1)


replace_once(
    '    var ScrollView = Packages.android.widget.ScrollView;\n',
    '    var ScrollView = Packages.android.widget.ScrollView;\n'
    '    var HorizontalScrollView = Packages.android.widget.HorizontalScrollView;\n',
    'HorizontalScrollView import')

replace_once(
    '    var regexInput = null;\n',
    '    var regexInput = null;\n'
    '    var regexTitleInput = null;\n'
    '    var regexRuleScroll = null;\n'
    '    var regexRuleRow = null;\n'
    '    var regexModeMatchView = null;\n'
    '    var regexModeSplitView = null;\n'
    '    var editingRuleId = "";\n',
    'tokenizer rule view refs')

replace_once(
    '        regexText: "",\n        tokens: [],\n',
    '        regexText: "",\n'
    '        ruleEditorTitle: "",\n'
    '        ruleEditorPattern: "",\n'
    '        ruleEditorMode: "match",\n'
    '        ruleConfigCount: 0,\n'
    '        selectedRuleCount: 0,\n'
    '        tokens: [],\n',
    'tokenizer rule state')

helpers = r'''
    /* tokenizer_rule_config_isolated_v1 */
    function tokenizerRuleCatalog() {
        var empty = {
            schemaVersion: 1,
            storageNamespace: "cliphub_tokenizer_rules_v1",
            selectedRuleIds: [],
            rules: [],
            presetCount: 0,
            customCount: 0
        };
        var catalog;
        try {
            if (!ClipHub.TokenizerService ||
                    typeof ClipHub.TokenizerService.listRuleConfigs !== "function") {
                return empty;
            }
            catalog = ClipHub.TokenizerService.listRuleConfigs() || empty;
            state.ruleConfigCount = catalog.rules ? Number(catalog.rules.length) : 0;
            state.selectedRuleCount = catalog.selectedRuleIds ?
                Number(catalog.selectedRuleIds.length) : 0;
            return catalog;
        } catch (error) {
            state.lastError = String(error);
            return empty;
        }
    }

    function tokenizerRuleSelected(catalog, id) {
        var ids = catalog && catalog.selectedRuleIds ?
            catalog.selectedRuleIds : [];
        return ids.indexOf(String(id || "")) >= 0;
    }

    function updateRegexRuleModeStyles() {
        var colors = palette();
        var matchMode = String(state.ruleEditorMode || "match") !== "split";
        if (regexModeMatchView !== null) {
            applyBackground(regexModeMatchView,
                matchMode ? colors.accentStrong : colors.surfaceMuted,
                matchMode ? colors.accentStrong : colors.stroke, 8);
            safeTextColor(regexModeMatchView,
                matchMode ? selectedTextColor(colors) : colors.textSecondary);
        }
        if (regexModeSplitView !== null) {
            applyBackground(regexModeSplitView,
                matchMode ? colors.surfaceMuted : colors.accentStrong,
                matchMode ? colors.stroke : colors.accentStrong, 8);
            safeTextColor(regexModeSplitView,
                matchMode ? colors.textSecondary : selectedTextColor(colors));
        }
    }

    function setRegexRuleEditorMode(mode) {
        state.ruleEditorMode = String(mode || "match") === "split" ?
            "split" : "match";
        updateRegexRuleModeStyles();
        return state.ruleEditorMode;
    }

    function clearRegexRuleEditor(rebuild) {
        editingRuleId = "";
        state.ruleEditorTitle = "";
        state.ruleEditorPattern = "";
        state.ruleEditorMode = "match";
        state.regexText = "";
        if (regexTitleInput !== null) { regexTitleInput.setText(""); }
        if (regexInput !== null) { regexInput.setText(""); }
        updateRegexRuleModeStyles();
        if (rebuild === true && state.mounted && state.mode === "regex") {
            renderMode();
        }
        return true;
    }

    function loadRegexRuleForEdit(rule) {
        rule = rule || {};
        editingRuleId = rule.preset === true ? "" : String(rule.id || "");
        state.ruleEditorTitle = String(rule.title || "") +
            (rule.preset === true ? " 副本" : "");
        state.ruleEditorPattern = String(rule.pattern || "");
        state.ruleEditorMode = String(rule.mode || "match") === "split" ?
            "split" : "match";
        state.regexText = "";
        renderMode();
        emitAction("tokenizer_rule_edit", {
            ruleId: String(rule.id || ""),
            preset: rule.preset === true
        });
        return true;
    }

    function toggleTokenizerRuleConfig(rule) {
        var selected;
        if (!rule || !ClipHub.TokenizerService ||
                typeof ClipHub.TokenizerService.toggleRuleSelection !== "function") {
            return false;
        }
        try {
            selected = ClipHub.TokenizerService.toggleRuleSelection(
                String(rule.id || ""));
            renderMode();
            emitAction("tokenizer_rule_toggle", {
                ruleId: String(rule.id || ""),
                selected: selected === true
            });
            requestTokenizerRun("tokenizer_rule_toggle");
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function makeTokenizerRuleChip(rule, selected) {
        var colors = palette();
        var view = makeText(String(rule.title || "规则"), 10,
            selected ? selectedTextColor(colors) : colors.textPrimary, true);
        view.setGravity(Gravity.CENTER);
        view.setPadding(dp(10), 0, dp(10), 0);
        view.setClickable(true);
        view.setFocusable(true);
        view.setContentDescription((selected ? "已选择：" : "未选择：") +
            String(rule.title || "分词规则"));
        applyBackground(view,
            selected ? colors.accentStrong : colors.surfaceMuted,
            selected ? colors.accentStrong : colors.stroke, 9);
        view.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { toggleTokenizerRuleConfig(rule); }
        }));
        view.setOnLongClickListener(new JavaAdapter(View.OnLongClickListener, {
            onLongClick: function () {
                loadRegexRuleForEdit(rule);
                return true;
            }
        }));
        return view;
    }

    function buildTokenizerRuleSelector(parent) {
        var colors = palette();
        var catalog = tokenizerRuleCatalog();
        var rules = catalog.rules || [];
        var index;
        var chip;
        var params;
        var hint;
        regexRuleScroll = new HorizontalScrollView(appContext);
        regexRuleScroll.setHorizontalScrollBarEnabled(false);
        regexRuleScroll.setFillViewport(false);
        regexRuleRow = new LinearLayout(appContext);
        regexRuleRow.setOrientation(LinearLayout.HORIZONTAL);
        regexRuleRow.setGravity(Gravity.CENTER_VERTICAL);
        regexRuleRow.setPadding(dp(1), dp(2), dp(1), dp(2));
        for (index = 0; index < rules.length; index += 1) {
            chip = makeTokenizerRuleChip(rules[index],
                tokenizerRuleSelected(catalog, rules[index].id));
            params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, dp(32));
            if (index > 0) { params.leftMargin = dp(6); }
            regexRuleRow.addView(chip, params);
        }
        if (rules.length === 0) {
            chip = makeText("暂无分词规则", 10, colors.textTertiary, false);
            chip.setGravity(Gravity.CENTER_VERTICAL);
            regexRuleRow.addView(chip,
                new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT, dp(32)));
        }
        regexRuleScroll.addView(regexRuleRow,
            new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT, dp(36)));
        parent.addView(regexRuleScroll,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(38)));
        hint = makeText("已选 " + String(state.selectedRuleCount) +
            " 个 · 支持多规则同时匹配 · 仅用于分词", 9,
            colors.textTertiary, false);
        parent.addView(hint,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(22)));
        return regexRuleScroll;
    }

    function makeRegexEditorAction(text, primary, click) {
        var colors = palette();
        var view = makeText(text, 10,
            primary ? selectedTextColor(colors) : colors.textPrimary, true);
        view.setGravity(Gravity.CENTER);
        view.setClickable(true);
        view.setFocusable(true);
        applyBackground(view,
            primary ? colors.accentStrong : colors.surfaceMuted,
            primary ? colors.accentStrong : colors.stroke, 8);
        view.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { click(); }
        }));
        return view;
    }

    function applyRegexEditorRule() {
        var pattern = regexInput === null ?
            String(state.ruleEditorPattern || "") : String(regexInput.getText());
        state.ruleEditorPattern = pattern;
        state.regexText = pattern.replace(/^\s+|\s+$/g, "");
        emitAction("tokenizer_rule_apply_temporary", {
            mode: String(state.ruleEditorMode || "match")
        });
        requestTokenizerRun("tokenizer_rule_apply_temporary");
        return true;
    }

    function saveRegexEditorRule() {
        var title = regexTitleInput === null ?
            String(state.ruleEditorTitle || "") : String(regexTitleInput.getText());
        var pattern = regexInput === null ?
            String(state.ruleEditorPattern || "") : String(regexInput.getText());
        var saved;
        if (!ClipHub.TokenizerService ||
                typeof ClipHub.TokenizerService.upsertRuleConfig !== "function") {
            state.lastError = "TokenizerService rule config API unavailable";
            return false;
        }
        title = title.replace(/^\s+|\s+$/g, "");
        pattern = pattern.replace(/^\s+|\s+$/g, "");
        if (!pattern) {
            state.lastError = "分词正则不能为空";
            return false;
        }
        if (!title) { title = "自定义分词规则"; }
        try {
            saved = ClipHub.TokenizerService.upsertRuleConfig({
                id: String(editingRuleId || ""),
                title: title,
                pattern: pattern,
                mode: String(state.ruleEditorMode || "match"),
                priority: 1500,
                enabled: true,
                keepDelimiter: String(state.ruleEditorMode) === "split",
                type: String(state.ruleEditorMode) === "split" ? "symbol" : "word"
            });
            editingRuleId = String(saved.id || "");
            state.ruleEditorTitle = String(saved.title || title);
            state.ruleEditorPattern = String(saved.pattern || pattern);
            state.ruleEditorMode = String(saved.mode || "match");
            state.regexText = "";
            renderMode();
            emitAction("tokenizer_rule_save", { ruleId: editingRuleId });
            requestTokenizerRun("tokenizer_rule_save");
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function deleteRegexEditorRule() {
        var id = String(editingRuleId || "");
        if (!id || !ClipHub.TokenizerService ||
                typeof ClipHub.TokenizerService.deleteRuleConfig !== "function") {
            return false;
        }
        try {
            if (!ClipHub.TokenizerService.deleteRuleConfig(id)) { return false; }
            emitAction("tokenizer_rule_delete", { ruleId: id });
            clearRegexRuleEditor(false);
            renderMode();
            requestTokenizerRun("tokenizer_rule_delete");
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }
'''

marker = '    function buildRegexBody() {'
if source.count(marker) != 1:
    raise RuntimeError('buildRegexBody marker mismatch')
source = source.replace(marker, helpers + '\n' + marker, 1)

new_body = r'''    function buildRegexBody() {
        var colors = palette();
        var ruleHeader = new LinearLayout(appContext);
        var label = makeText("分词规则", 10.5, colors.textSecondary, true);
        var scope = makeText("仅分词", 8.5, colors.accentStrong, true);
        var manageText = editingRuleId ? "删除" : "+ 新建";
        var manage = makeText(manageText, 9.5,
            editingRuleId ? colors.danger : colors.accentStrong, true);
        var params;
        var editRow;
        bodyContainer.removeAllViews();
        ruleHeader.setOrientation(LinearLayout.HORIZONTAL);
        ruleHeader.setGravity(Gravity.CENTER_VERTICAL);
        ruleHeader.addView(label,
            new LinearLayout.LayoutParams(0,
                LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        scope.setGravity(Gravity.CENTER);
        applyBackground(scope, colors.accentSoft, colors.accentBorder, 8);
        params = new LinearLayout.LayoutParams(dp(48), dp(24));
        params.rightMargin = dp(6);
        ruleHeader.addView(scope, params);
        manage.setGravity(Gravity.CENTER);
        manage.setClickable(true);
        manage.setFocusable(true);
        manage.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () {
                if (editingRuleId) { deleteRegexEditorRule(); }
                else { clearRegexRuleEditor(true); }
            }
        }));
        ruleHeader.addView(manage,
            new LinearLayout.LayoutParams(dp(52), dp(28)));
        bodyContainer.addView(ruleHeader,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(30)));

        buildTokenizerRuleSelector(bodyContainer);

        regexTitleInput = new EditText(appContext);
        regexTitleInput.setSingleLine(true);
        regexTitleInput.setGravity(Gravity.CENTER_VERTICAL | Gravity.START);
        regexTitleInput.setTextSize(TypedValue.COMPLEX_UNIT_SP, 10.5);
        regexTitleInput.setHint("规则名称");
        regexTitleInput.setText(String(state.ruleEditorTitle || ""));
        regexTitleInput.setPadding(dp(9), 0, dp(9), 0);
        regexTitleInput.setInputType(InputType.TYPE_CLASS_TEXT |
            InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        safeTextColor(regexTitleInput, colors.textPrimary);
        safeHintColor(regexTitleInput, colors.textTertiary);
        applyBackground(regexTitleInput, colors.surface, colors.stroke, 9);
        regexTitleInput.addTextChangedListener(new JavaAdapter(TextWatcher, {
            beforeTextChanged: function () {},
            onTextChanged: function () {
                state.ruleEditorTitle = String(regexTitleInput.getText());
            },
            afterTextChanged: function () {}
        }));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(34));
        params.bottomMargin = dp(5);
        bodyContainer.addView(regexTitleInput, params);

        regexInput = new EditText(appContext);
        regexInput.setSingleLine(false);
        regexInput.setGravity(Gravity.TOP | Gravity.START);
        regexInput.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11.5);
        regexInput.setHint("输入分词正则表达式");
        regexInput.setText(String(state.ruleEditorPattern || ""));
        regexInput.setPadding(dp(10), dp(7), dp(10), dp(7));
        regexInput.setInputType(InputType.TYPE_CLASS_TEXT |
            InputType.TYPE_TEXT_FLAG_MULTI_LINE |
            InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        safeTextColor(regexInput, colors.textPrimary);
        safeHintColor(regexInput, colors.textTertiary);
        applyBackground(regexInput, colors.surface, colors.stroke, 10);
        regexInput.addTextChangedListener(new JavaAdapter(TextWatcher, {
            beforeTextChanged: function () {},
            onTextChanged: function () {
                state.ruleEditorPattern = String(regexInput.getText());
            },
            afterTextChanged: function () {}
        }));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(58));
        params.bottomMargin = dp(5);
        bodyContainer.addView(regexInput, params);

        editRow = new LinearLayout(appContext);
        editRow.setOrientation(LinearLayout.HORIZONTAL);
        editRow.setGravity(Gravity.CENTER_VERTICAL);
        regexModeMatchView = makeRegexEditorAction("匹配", false, function () {
            setRegexRuleEditorMode("match");
        });
        regexModeSplitView = makeRegexEditorAction("切分", false, function () {
            setRegexRuleEditorMode("split");
        });
        params = new LinearLayout.LayoutParams(0, dp(32), 1);
        params.rightMargin = dp(5);
        editRow.addView(regexModeMatchView, params);
        params = new LinearLayout.LayoutParams(0, dp(32), 1);
        params.rightMargin = dp(9);
        editRow.addView(regexModeSplitView, params);
        editRow.addView(makeRegexEditorAction("临时应用", false,
            applyRegexEditorRule),
            new LinearLayout.LayoutParams(0, dp(32), 1));
        params = new LinearLayout.LayoutParams(0, dp(32), 1);
        params.leftMargin = dp(5);
        editRow.addView(makeRegexEditorAction("保存配置", true,
            saveRegexEditorRule), params);
        bodyContainer.addView(editRow,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(36)));
        updateRegexRuleModeStyles();

        buildStatsRow(bodyContainer);
        buildTokenScroll(bodyContainer);
    }'''

body_pattern = re.compile(
    r'    function buildRegexBody\(\) \{.*?\n    \}\n\n    function applyModeStyles\(\)',
    re.S)
source, count = body_pattern.subn(
    lambda match: new_body + '\n\n    function applyModeStyles()',
    source,
    count=1)
if count != 1:
    raise RuntimeError('buildRegexBody replacement failed')

replace_once(
    '        state.regexText = "";\n        state.tokens = [];\n',
    '        state.regexText = "";\n'
    '        state.ruleEditorTitle = "";\n'
    '        state.ruleEditorPattern = "";\n'
    '        state.ruleEditorMode = "match";\n'
    '        editingRuleId = "";\n'
    '        state.tokens = [];\n',
    'reset tokenizer rule editor')

replace_once(
    '        regexInput = null;\n        tokenViews = [];\n',
    '        regexInput = null;\n'
    '        regexTitleInput = null;\n'
    '        regexRuleScroll = null;\n'
    '        regexRuleRow = null;\n'
    '        regexModeMatchView = null;\n'
    '        regexModeSplitView = null;\n'
    '        tokenViews = [];\n',
    'clear tokenizer rule refs')

replace_once(
    '        rule.setOnClickListener(new JavaAdapter(View.OnClickListener, {\n'
    '            onClick: function () { emitAction("rule", {}); }\n'
    '        }));\n',
    '        rule.setOnClickListener(new JavaAdapter(View.OnClickListener, {\n'
    '            onClick: function () {\n'
    '                if (state.mode !== "regex") { switchMode("regex"); }\n'
    '                else { clearRegexRuleEditor(true); }\n'
    '                emitAction("rule", {});\n'
    '            }\n'
    '        }));\n',
    'header rule action')

replace_once(
    '                regexText: String(state.regexText || ""),\n'
    '                reason: String(reason || "tokenizer_ui")\n',
    '                regexText: String(state.regexText || ""),\n'
    '                regexMode: String(state.ruleEditorMode || "match"),\n'
    '                reason: String(reason || "tokenizer_ui")\n',
    'tokenizer request regex mode')

replace_once(
    '            regexText: String(state.regexText || ""),\n            tokenCount: Number(state.tokenCount),\n',
    '            regexText: String(state.regexText || ""),\n'
    '            ruleEditorTitle: String(state.ruleEditorTitle || ""),\n'
    '            ruleEditorPattern: String(state.ruleEditorPattern || ""),\n'
    '            ruleEditorMode: String(state.ruleEditorMode || "match"),\n'
    '            editingRuleId: String(editingRuleId || ""),\n'
    '            ruleConfigCount: Number(state.ruleConfigCount),\n'
    '            selectedRuleCount: Number(state.selectedRuleCount),\n'
    '            tokenizerRulesIsolatedFromFilter: true,\n'
    '            tokenCount: Number(state.tokenCount),\n',
    'getState tokenizer rule diagnostics')

replace_once(
    '        setRegexText: function (text) {\n'
    '            state.regexText = String(text === null || text === undefined ?\n'
    '                "" : text);\n'
    '            if (regexInput !== null) {\n'
    '                regexInput.setText(state.regexText);\n'
    '                regexInput.setSelection(regexInput.getText().length());\n'
    '            }\n'
    '            return state.regexText;\n'
    '        },\n',
    '        setRegexText: function (text) {\n'
    '            state.regexText = String(text === null || text === undefined ?\n'
    '                "" : text);\n'
    '            state.ruleEditorPattern = state.regexText;\n'
    '            if (regexInput !== null) {\n'
    '                regexInput.setText(state.ruleEditorPattern);\n'
    '                regexInput.setSelection(regexInput.getText().length());\n'
    '            }\n'
    '            return state.regexText;\n'
    '        },\n',
    'setRegexText compatibility')

replace_once(
    '        MODULE_VERSION: 7,\n',
    '        MODULE_VERSION: 8,\n',
    'TokenizerUI module version')

EXPANDED_PATH.write_text(source, encoding='utf-8')

loader = LOADER_PATH.read_text(encoding='utf-8')
source_sha = hashlib.sha256(source.encode('utf-8')).hexdigest()
packed = base64.b64encode(gzip.compress(source.encode('utf-8'), mtime=0)).decode('ascii')
chunks = [packed[index:index + 116] for index in range(0, len(packed), 116)]
assignment = '    var PACKED_B64 =\n' + '\n'.join(
    '        ' + json.dumps(chunk) + (' +' if index < len(chunks) - 1 else '')
    for index, chunk in enumerate(chunks)
) + '\n    ;\n'
loader, count = re.subn(
    r'    var SOURCE_SHA256 = "[0-9a-f]{64}";',
    '    var SOURCE_SHA256 = "%s";' % source_sha,
    loader,
    count=1)
if count != 1:
    raise RuntimeError('SOURCE_SHA256 replacement failed')
loader, count = re.subn(
    r'    var PACKED_B64\s*=.*?\n    ;\n',
    lambda match: assignment,
    loader,
    count=1,
    flags=re.S)
if count != 1:
    raise RuntimeError('PACKED_B64 replacement failed')
LOADER_PATH.write_text(loader, encoding='utf-8')


def blob_sha(text):
    data = text.encode('utf-8')
    return hashlib.sha1(
        b'blob ' + str(len(data)).encode('ascii') + b'\0' + data
    ).hexdigest()


manifest = json.loads(MANIFEST_PATH.read_text(encoding='utf-8'))
manifest['moduleSetVersion'] = '20260815.31'
by_name = {item['name']: item for item in manifest['modules']}
by_name['ch_17_tokenizer_ui.js']['sha'] = blob_sha(loader)
service_text = SERVICE_PATH.read_text(encoding='utf-8')
by_name['ch_19_tokenizer_service.js']['sha'] = blob_sha(service_text)
MANIFEST_PATH.write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + '\n',
    encoding='utf-8')

contract = CONTRACT_PATH.read_text(encoding='utf-8')
old_contract_version = '"moduleSetVersion": "20260815.30"'
if contract.count(old_contract_version) != 1:
    raise RuntimeError('manifest contract version anchor mismatch')
contract = contract.replace(
    old_contract_version,
    '"moduleSetVersion": "20260815.31"',
    1)
CONTRACT_PATH.write_text(contract, encoding='utf-8')

preflight = PREFLIGHT_PATH.read_text(encoding='utf-8')
if preflight.count("EXPECTED_MODULE_SET='20260815.30'") != 1:
    raise RuntimeError('preflight module set anchor mismatch')
preflight = preflight.replace(
    "EXPECTED_MODULE_SET='20260815.30'",
    "EXPECTED_MODULE_SET='20260815.31'",
    1)
if preflight.count('"ch_17_tokenizer_ui.js": ("ch_17_tokenizer_ui", 7),') != 1:
    raise RuntimeError('preflight ch17 version anchor mismatch')
preflight = preflight.replace(
    '"ch_17_tokenizer_ui.js": ("ch_17_tokenizer_ui", 7),',
    '"ch_17_tokenizer_ui.js": ("ch_17_tokenizer_ui", 8),',
    1)
if preflight.count('"ch_19_tokenizer_service.js": ("ch_19_tokenizer_service", 1),') != 1:
    raise RuntimeError('preflight ch19 version anchor mismatch')
preflight = preflight.replace(
    '"ch_19_tokenizer_service.js": ("ch_19_tokenizer_service", 1),',
    '"ch_19_tokenizer_service.js": ("ch_19_tokenizer_service", 2),',
    1)
anchor = '        assert "getWorkerProbeSpec" in tokenizer_service_source\n'
if preflight.count(anchor) != 1:
    raise RuntimeError('preflight tokenizer anchor mismatch')
extra = (
    anchor +
    '        assert "tokenizer_rule_config_isolated_v1" in tokenizer_source\n' +
    '        assert "listRuleConfigs" in tokenizer_service_source\n' +
    '        assert "toggleRuleSelection" in tokenizer_service_source\n' +
    '        assert "upsertRuleConfig" in tokenizer_service_source\n' +
    '        assert "deleteRuleConfig" in tokenizer_service_source\n' +
    '        assert \'PREFS_NAME = "cliphub_tokenizer_rules_v1"\' in tokenizer_service_source\n' +
    '        assert "tokenizerRulesIsolatedFromFilter: true" in tokenizer_service_source\n' +
    '        assert "regex_rules" not in tokenizer_service_source\n' +
    '        assert "ClipHub.Repository" not in tokenizer_service_source\n'
)
preflight = preflight.replace(anchor, extra, 1)
PREFLIGHT_PATH.write_text(preflight, encoding='utf-8')

print('Tokenizer rules UI pack complete')
print('SOURCE_SHA256=' + source_sha)
print('ch17_blob=' + blob_sha(loader))
print('ch19_blob=' + blob_sha(service_text))
