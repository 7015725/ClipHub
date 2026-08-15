#!/usr/bin/env python3
import base64
import gzip
import hashlib
import json
import re
from pathlib import Path

BRANCH = "docs/tokenizer-softcode-hardening-20260815"
OLD_MODULE_SET = "20260815.34"
NEW_MODULE_SET = "20260816.01"

ROOT = Path('.')
UI_SHELL_PATH = ROOT / 'src/ch_16_ui_shell.js'
TOKENIZER_LOADER_PATH = ROOT / 'src/ch_17_tokenizer_ui.js'
MANIFEST_PATH = ROOT / 'module-manifest.json'
CONTRACT_PATH = ROOT / 'scripts/manifest_contract.py'
PREFLIGHT_PATH = ROOT / 'scripts/release_preflight.sh'
NAV_TEST_PATH = ROOT / 'scripts/test_ui_shell_navigation.js'
DIAG_TEST_PATH = ROOT / 'scripts/test_runtime_diagnostics.js'


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError('%s anchor count=%d' % (label, count))
    return text.replace(old, new, 1)


def regex_replace_once(text, pattern, replacement, label, flags=0):
    value, count = re.subn(pattern, replacement, text, count=1, flags=flags)
    if count != 1:
        raise RuntimeError('%s regex count=%d' % (label, count))
    return value


def git_blob_sha(text):
    data = text.encode('utf-8')
    return hashlib.sha1(
        b'blob ' + str(len(data)).encode('ascii') + b'\0' + data
    ).hexdigest()


def unpack_tokenizer(loader):
    sha_match = re.search(r'var SOURCE_SHA256 = "([0-9a-f]{64})";', loader)
    if not sha_match:
        raise RuntimeError('TokenizerUI SOURCE_SHA256 missing')
    packed_match = re.search(r'    var PACKED_B64\s*=\s*(.*?)\n    ;\n', loader, re.S)
    if not packed_match:
        raise RuntimeError('TokenizerUI PACKED_B64 missing')
    chunks = re.findall(r'"([A-Za-z0-9+/=]+)"', packed_match.group(1))
    if not chunks:
        raise RuntimeError('TokenizerUI PACKED_B64 chunks missing')
    source = gzip.decompress(base64.b64decode(''.join(chunks))).decode('utf-8')
    actual_sha = hashlib.sha256(source.encode('utf-8')).hexdigest()
    if actual_sha != sha_match.group(1):
        raise RuntimeError('TokenizerUI unpack SHA mismatch: %s != %s' %
                           (actual_sha, sha_match.group(1)))
    return source


def repack_tokenizer(loader, source):
    source_sha = hashlib.sha256(source.encode('utf-8')).hexdigest()
    packed = base64.b64encode(
        gzip.compress(source.encode('utf-8'), mtime=0)
    ).decode('ascii')
    chunks = [packed[i:i + 116] for i in range(0, len(packed), 116)]
    assignment = '    var PACKED_B64 =\n' + '\n'.join(
        '        ' + json.dumps(chunk) + (' +' if i < len(chunks) - 1 else '')
        for i, chunk in enumerate(chunks)
    ) + '\n    ;\n'
    loader = regex_replace_once(
        loader,
        r'    var SOURCE_SHA256 = "[0-9a-f]{64}";',
        '    var SOURCE_SHA256 = "%s";' % source_sha,
        'TokenizerUI SOURCE_SHA256')
    loader = regex_replace_once(
        loader,
        r'    var PACKED_B64\s*=.*?\n    ;\n',
        lambda match: assignment,
        'TokenizerUI PACKED_B64',
        re.S)
    return loader, source_sha


# ---------------------------------------------------------------------------
# ch_16_ui_shell.js: add Tokenizer nested pages and extend editor family.
# ---------------------------------------------------------------------------
ui_shell = UI_SHELL_PATH.read_text(encoding='utf-8')
ui_shell = replace_once(
    ui_shell,
    '        registerPage({ id: "tokenizer", parentId: "editor", owner: "tokenizer",\n'
    '            moduleName: "TokenizerUI", cachePolicy: "rebind",\n'
    '            legacySurface: "tokenizer", shellReady: true });\n',
    '        registerPage({ id: "tokenizer", parentId: "editor", owner: "tokenizer",\n'
    '            moduleName: "TokenizerUI", cachePolicy: "rebind",\n'
    '            legacySurface: "tokenizer", shellReady: true });\n'
    '        registerPage({ id: "tokenizer_rules", parentId: "tokenizer",\n'
    '            owner: "tokenizer", moduleName: "TokenizerUI", cachePolicy: "lazy",\n'
    '            legacySurface: "tokenizer", shellReady: true });\n'
    '        registerPage({ id: "tokenizer_rule_editor", parentId: "tokenizer_rules",\n'
    '            owner: "tokenizer", moduleName: "TokenizerUI", cachePolicy: "rebind",\n'
    '            legacySurface: "tokenizer", shellReady: true });\n',
    'UIShell tokenizer child pages')

ui_shell = replace_once(
    ui_shell,
    '        if (pageId === "editor" || pageId === "tags" ||\n'
    '                pageId === "tokenizer") {\n'
    '            return current === "editor" || current === "tags" ||\n'
    '                current === "tokenizer";\n'
    '        }\n',
    '        if (pageId === "editor" || pageId === "tags" ||\n'
    '                pageId === "tokenizer" || pageId === "tokenizer_rules" ||\n'
    '                pageId === "tokenizer_rule_editor") {\n'
    '            return current === "editor" || current === "tags" ||\n'
    '                current === "tokenizer" || current === "tokenizer_rules" ||\n'
    '                current === "tokenizer_rule_editor";\n'
    '        }\n',
    'UIShell editor family')

ui_shell = replace_once(
    ui_shell,
    '                id !== "regex_test" && id !== "editor" &&\n'
    '                id !== "tags" && id !== "tokenizer") { return false; }\n',
    '                id !== "regex_test" && id !== "editor" &&\n'
    '                id !== "tags" && id !== "tokenizer" &&\n'
    '                id !== "tokenizer_rules" &&\n'
    '                id !== "tokenizer_rule_editor") { return false; }\n',
    'UIShell canEmbed whitelist')

ui_shell = replace_once(
    ui_shell,
    '        if (id === "editor" || id === "tags" || id === "tokenizer") {\n'
    '            return isSameShellFamily(id);\n'
    '        }\n',
    '        if (id === "editor" || id === "tags" || id === "tokenizer" ||\n'
    '                id === "tokenizer_rules" ||\n'
    '                id === "tokenizer_rule_editor") {\n'
    '            return isSameShellFamily(id);\n'
    '        }\n',
    'UIShell canEmbed editor family')

ui_shell = replace_once(
    ui_shell,
    '                !(id === "editor" && (activePageId === "tags" ||\n'
    '                    activePageId === "tokenizer"))) {\n',
    '                !(id === "editor" && (activePageId === "tags" ||\n'
    '                    activePageId === "tokenizer" ||\n'
    '                    activePageId === "tokenizer_rules" ||\n'
    '                    activePageId === "tokenizer_rule_editor"))) {\n',
    'UIShell unmount editor family')

ui_shell = replace_once(
    ui_shell,
    '    function runtimeEditorFamily(pageId) {\n'
    '        return pageId === "editor" || pageId === "tags" ||\n'
    '            pageId === "tokenizer";\n'
    '    }\n',
    '    function runtimeEditorFamily(pageId) {\n'
    '        return pageId === "editor" || pageId === "tags" ||\n'
    '            pageId === "tokenizer" || pageId === "tokenizer_rules" ||\n'
    '            pageId === "tokenizer_rule_editor";\n'
    '    }\n',
    'UIShell runtime editor family')

ui_shell = replace_once(
    ui_shell,
    '        if (tokenizer.mounted === true && active !== "tokenizer") {\n'
    '            runtimeAddIssue(issues, "TOKENIZER_STACK_MISMATCH",\n'
    '                active || "home");\n'
    '        }\n',
    '        if (tokenizer.mounted === true && active !== "tokenizer" &&\n'
    '                active !== "tokenizer_rules" &&\n'
    '                active !== "tokenizer_rule_editor") {\n'
    '            runtimeAddIssue(issues, "TOKENIZER_STACK_MISMATCH",\n'
    '                active || "home");\n'
    '        }\n',
    'UIShell tokenizer diagnostics family')

ui_shell = replace_once(
    ui_shell,
    '        MODULE_VERSION: 6,\n',
    '        MODULE_VERSION: 7,\n',
    'UIShell module version')
UI_SHELL_PATH.write_text(ui_shell, encoding='utf-8')


# ---------------------------------------------------------------------------
# ch_17_tokenizer_ui.js: unpack v8, build management/editor pages and toolbar.
# ---------------------------------------------------------------------------
loader = TOKENIZER_LOADER_PATH.read_text(encoding='utf-8')
source = unpack_tokenizer(loader)
if 'MODULE_VERSION: 8' not in source:
    raise RuntimeError('unexpected TokenizerUI module version')
if 'tokenizer_rule_config_isolated_v1' not in source:
    raise RuntimeError('current TokenizerUI rule-config marker missing')

source = replace_once(
    source,
    '    var regexModeSplitView = null;\n'
    '    var editingRuleId = "";\n',
    '    var regexModeSplitView = null;\n'
    '    var regexGroupWholeView = null;\n'
    '    var regexGroupGroupsView = null;\n'
    '    var regexKeepDelimiterView = null;\n'
    '    var regexMatchOptionsRow = null;\n'
    '    var regexSplitOptionsRow = null;\n'
    '    var rulePreviewContainer = null;\n'
    '    var editingRuleId = "";\n',
    'TokenizerUI editor refs')

source = replace_once(
    source,
    '        ruleEditorMode: "match",\n'
    '        ruleConfigCount: 0,\n',
    '        ruleEditorMode: "match",\n'
    '        ruleEditorGroupMode: "whole",\n'
    '        ruleEditorKeepDelimiter: false,\n'
    '        ruleEditorPriority: 1400,\n'
    '        ruleEditorFlags: 0,\n'
    '        ruleEditorPresetSourceId: "",\n'
    '        rulePreviewStatus: "idle",\n'
    '        rulePreviewError: null,\n'
    '        rulePreviewTokens: [],\n'
    '        tokenizerResultDirty: false,\n'
    '        page: "tokenizer",\n'
    '        ruleConfigCount: 0,\n',
    'TokenizerUI rule editor state')

old_catalog = '''    function tokenizerRuleCatalog() {
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
'''
new_catalog = '''    function tokenizerRuleCatalog() {
        var empty = {
            schemaVersion: 1,
            storageNamespace: "cliphub_tokenizer_rules_v1",
            selectedRuleIds: [],
            rules: [],
            presetCount: 0,
            customCount: 0
        };
        var catalog;
        var rules;
        var index;
        var participating = 0;
        try {
            if (!ClipHub.TokenizerService ||
                    typeof ClipHub.TokenizerService.listRuleConfigs !== "function") {
                return empty;
            }
            catalog = ClipHub.TokenizerService.listRuleConfigs() || empty;
            rules = catalog.rules || [];
            state.ruleConfigCount = Number(rules.length);
            for (index = 0; index < rules.length; index += 1) {
                if (tokenizerRuleSelected(catalog, rules[index].id)) {
                    participating += 1;
                }
            }
            state.selectedRuleCount = participating;
            return catalog;
        } catch (error) {
            state.lastError = String(error);
            return empty;
        }
    }

    function tokenizerRuleSelected(catalog, id) {
        var ids = catalog && catalog.selectedRuleIds ?
            catalog.selectedRuleIds : [];
        var rules = catalog && catalog.rules ? catalog.rules : [];
        var value = String(id || "");
        var index;
        if (ids.indexOf(value) < 0) { return false; }
        for (index = 0; index < rules.length; index += 1) {
            if (String(rules[index].id || "") === value) {
                return rules[index].enabled !== false;
            }
        }
        return false;
    }
'''
source = replace_once(source, old_catalog, new_catalog,
                      'TokenizerUI effective participation')

old_toggle = '''    function toggleTokenizerRuleConfig(rule) {
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
'''
new_toggle = '''    function toggleTokenizerRuleConfig(rule) {
        var catalog;
        var current;
        var target;
        var selected;
        var repaired;
        if (!rule || !ClipHub.TokenizerService ||
                typeof ClipHub.TokenizerService.toggleRuleSelection !== "function") {
            return false;
        }
        try {
            catalog = tokenizerRuleCatalog();
            current = tokenizerRuleSelected(catalog, rule.id);
            target = !current;
            if (target && rule.enabled === false && rule.preset !== true &&
                    typeof ClipHub.TokenizerService.upsertRuleConfig === "function") {
                repaired = ClipHub.TokenizerService.upsertRuleConfig({
                    id: String(rule.id || ""),
                    title: String(rule.title || "自定义分词规则"),
                    pattern: String(rule.pattern || ""),
                    flags: rule.flags === undefined ? 0 : rule.flags,
                    priority: Number(rule.priority || 1400),
                    mode: String(rule.mode || "match"),
                    enabled: true,
                    keepDelimiter: rule.keepDelimiter === true,
                    groupMode: String(rule.groupMode || "whole"),
                    type: String(rule.type || "word")
                });
                rule = repaired || rule;
            }
            selected = ClipHub.TokenizerService.toggleRuleSelection(
                String(rule.id || ""), target);
            emitAction("tokenizer_rule_toggle", {
                ruleId: String(rule.id || ""),
                selected: selected === true
            });
            if (String(state.page || "tokenizer") === "tokenizer") {
                renderMode();
                requestTokenizerRun("tokenizer_rule_toggle");
            } else {
                state.tokenizerResultDirty = true;
                renderTokenizerSurface();
            }
            return selected === target;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }
'''
source = replace_once(source, old_toggle, new_toggle,
                      'TokenizerUI toggle participation')

source = replace_once(
    source,
    '        view.setContentDescription((selected ? "已选择：" : "未选择：") +\n'
    '            String(rule.title || "分词规则"));\n',
    '        view.setContentDescription((selected ? "已参与：" : "未参与：") +\n'
    '            String(rule.title || "分词规则"));\n',
    'TokenizerUI rule chip a11y')
source = replace_once(
    source,
    '                loadRegexRuleForEdit(rule);\n',
    '                openTokenizerRuleEditor(rule);\n',
    'TokenizerUI rule chip editor navigation')
source = replace_once(
    source,
    '        hint = makeText("已选 " + String(state.selectedRuleCount) +\n'
    '            " 个 · 支持多规则同时匹配 · 仅用于分词", 9,\n',
    '        hint = makeText("已参与 " + String(state.selectedRuleCount) +\n'
    '            " 个 · 支持多规则同时匹配 · 仅用于分词", 9,\n',
    'TokenizerUI participation hint')

management_helpers = r'''

    /* tokenizer_rule_management_pages_v1 */
    function tokenizerPagePath(pageId) {
        var id = String(pageId || "tokenizer");
        if (id === "editor") { return ["editor"]; }
        if (id === "tokenizer_rules") {
            return ["editor", "tokenizer", "tokenizer_rules"];
        }
        if (id === "tokenizer_rule_editor") {
            return ["editor", "tokenizer", "tokenizer_rules",
                "tokenizer_rule_editor"];
        }
        return ["editor", "tokenizer"];
    }

    function hideTokenizerKeyboard() {
        try {
            if (regexTitleInput !== null) { regexTitleInput.clearFocus(); }
            if (regexInput !== null) { regexInput.clearFocus(); }
            if (ClipHub.Editor && typeof ClipHub.Editor.hideKeyboard === "function") {
                ClipHub.Editor.hideKeyboard();
            }
        } catch (ignoredKeyboard) {}
        return true;
    }

    function resetRulePreview() {
        state.rulePreviewStatus = "idle";
        state.rulePreviewError = null;
        state.rulePreviewTokens = [];
        return true;
    }

    function prepareTokenizerRuleEditor(rule) {
        var value = rule || null;
        var preset = value && value.preset === true;
        editingRuleId = value && !preset ? String(value.id || "") : "";
        state.ruleEditorPresetSourceId = preset ? String(value.id || "") : "";
        state.ruleEditorTitle = value ? String(value.title || "") : "";
        if (preset && state.ruleEditorTitle) {
            state.ruleEditorTitle += " 副本";
        }
        state.ruleEditorPattern = value ? String(value.pattern || "") : "";
        state.ruleEditorMode = value && String(value.mode || "match") === "split" ?
            "split" : "match";
        state.ruleEditorGroupMode = value &&
            String(value.groupMode || "whole") === "groups" ? "groups" : "whole";
        state.ruleEditorKeepDelimiter = value ? value.keepDelimiter === true : false;
        state.ruleEditorPriority = value && !preset && isFinite(Number(value.priority)) ?
            Number(value.priority) : 1400;
        state.ruleEditorFlags = value && value.flags !== undefined ? value.flags : 0;
        state.regexText = "";
        resetRulePreview();
        return true;
    }

    function openTokenizerRulesPage() {
        if (!state.mounted) { return false; }
        hideTokenizerKeyboard();
        cancelTokenizerRun("open_tokenizer_rules");
        state.page = "tokenizer_rules";
        resetRulePreview();
        renderTokenizerSurface();
        if (editorEmbeddedInPrimary) {
            syncTokenizerShell("tokenizer_rules", "分词规则", function () {
                return returnToTokenizerMain("shell_back");
            });
        }
        emitAction("tokenizer_rules_open", {});
        return true;
    }

    function openTokenizerRuleEditor(rule) {
        if (!state.mounted) { return false; }
        hideTokenizerKeyboard();
        cancelTokenizerRun("open_tokenizer_rule_editor");
        prepareTokenizerRuleEditor(rule || null);
        state.page = "tokenizer_rule_editor";
        renderTokenizerSurface();
        if (editorEmbeddedInPrimary) {
            syncTokenizerShell("tokenizer_rule_editor",
                editingRuleId ? "编辑分词规则" :
                    (state.ruleEditorPresetSourceId ? "创建规则副本" : "新建分词规则"),
                function () { return returnToTokenizerRulesPage("shell_back"); });
        }
        emitAction("tokenizer_rule_edit", {
            ruleId: rule ? String(rule.id || "") : "",
            preset: rule ? rule.preset === true : false
        });
        return true;
    }

    function returnToTokenizerRulesPage(reason) {
        if (!state.mounted) { return false; }
        hideTokenizerKeyboard();
        cancelTokenizerRun(reason || "tokenizer_rule_editor_back");
        state.page = "tokenizer_rules";
        resetRulePreview();
        renderTokenizerSurface();
        if (editorEmbeddedInPrimary) {
            syncTokenizerShell("tokenizer_rules", "分词规则", function () {
                return returnToTokenizerMain("shell_back");
            });
        }
        return true;
    }

    function returnToTokenizerMain(reason) {
        var rerun = state.tokenizerResultDirty === true;
        if (!state.mounted) { return false; }
        hideTokenizerKeyboard();
        cancelTokenizerRun(reason || "tokenizer_rules_back");
        state.page = "tokenizer";
        state.regexText = "";
        resetRulePreview();
        renderTokenizerSurface();
        if (editorEmbeddedInPrimary) {
            syncTokenizerShell("tokenizer", "分词", function () {
                return returnToEditor("shell_back");
            });
        }
        if (rerun) {
            state.tokenizerResultDirty = false;
            requestTokenizerRun("tokenizer_rules_return");
        }
        return true;
    }

    function dispatchTokenizerBack(reason) {
        var page = String(state.page || "tokenizer");
        if (page === "tokenizer_rule_editor") {
            return returnToTokenizerRulesPage(reason || "rule_editor_back");
        }
        if (page === "tokenizer_rules") {
            return returnToTokenizerMain(reason || "rules_back");
        }
        return returnToEditor(reason || "tokenizer_back");
    }

    function buildTokenizerSubHeader(column, titleText, rightText,
            onRight, onBack) {
        var colors = palette();
        var chrome = tokenizerChromeMetrics();
        var header = new LinearLayout(appContext);
        var back = makeClickText("‹", chrome.iconSp, colors, "返回");
        var title = makeText(titleText, chrome.titleSp, colors.textPrimary, true);
        var right = rightText ? makeText(rightText, 11, colors.accentStrong, true) :
            new TextView(appContext);
        var params;
        header.setOrientation(LinearLayout.HORIZONTAL);
        header.setGravity(Gravity.CENTER_VERTICAL);
        back.setGravity(Gravity.CENTER);
        applyBackground(back, colors.surfaceMuted, null, chrome.actionSizeDp / 2);
        back.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { if (typeof onBack === "function") { onBack(); } }
        }));
        title.setGravity(Gravity.CENTER_VERTICAL);
        right.setGravity(Gravity.CENTER);
        if (rightText) {
            right.setClickable(true);
            right.setFocusable(true);
            applyBackground(right, colors.accentSoft, colors.accentBorder, 10);
            right.setOnClickListener(new JavaAdapter(View.OnClickListener, {
                onClick: function () {
                    if (typeof onRight === "function") { onRight(); }
                }
            }));
        }
        if (editorEmbeddedInPrimary) {
            back.setVisibility(View.GONE);
            title.setVisibility(View.INVISIBLE);
        }
        header.addView(back,
            new LinearLayout.LayoutParams(dp(chrome.actionSizeDp),
                dp(chrome.actionSizeDp)));
        params = new LinearLayout.LayoutParams(0,
            LinearLayout.LayoutParams.WRAP_CONTENT, 1);
        params.leftMargin = dp(chrome.gapDp);
        params.rightMargin = dp(chrome.gapDp);
        header.addView(title, params);
        header.addView(right,
            new LinearLayout.LayoutParams(rightText ? dp(76) : dp(1),
                dp(chrome.actionSizeDp)));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(chrome.headerHeightDp));
        params.bottomMargin = dp(chrome.headerBottomGapDp);
        column.addView(header, params);
        return header;
    }

    function makeTokenizerRuleCard(rule, catalog) {
        var colors = palette();
        var card = new LinearLayout(appContext);
        var top = new LinearLayout(appContext);
        var title = makeText(String(rule.title || "分词规则"), 11.5,
            colors.textPrimary, true);
        var participating = tokenizerRuleSelected(catalog, rule.id);
        var toggle = makeText(participating ? "已参与" : "未参与", 9.5,
            participating ? colors.accentStrong : colors.textSecondary, true);
        var pattern = makeText(String(rule.pattern || ""), 9.5,
            colors.textSecondary, false);
        var meta = makeText(
            (String(rule.mode || "match") === "split" ? "SPLIT" : "MATCH") +
            " · " + (rule.preset === true ? "预制" : "自定义"),
            9, colors.textTertiary, false);
        var params;
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(12), dp(10), dp(12), dp(10));
        card.setClickable(true);
        card.setFocusable(true);
        applyBackground(card, colors.surfaceMuted, colors.stroke, 12);
        top.setOrientation(LinearLayout.HORIZONTAL);
        top.setGravity(Gravity.CENTER_VERTICAL);
        top.addView(title, new LinearLayout.LayoutParams(0,
            LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        toggle.setGravity(Gravity.CENTER);
        toggle.setClickable(true);
        toggle.setFocusable(true);
        applyBackground(toggle,
            participating ? colors.accentSoft : colors.surface,
            participating ? colors.accentBorder : colors.stroke, 9);
        toggle.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { toggleTokenizerRuleConfig(rule); }
        }));
        top.addView(toggle, new LinearLayout.LayoutParams(dp(62), dp(30)));
        card.addView(top, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(32)));
        pattern.setMaxLines(2);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(4);
        card.addView(pattern, params);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(6);
        card.addView(meta, params);
        card.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { openTokenizerRuleEditor(rule); }
        }));
        return card;
    }

    function buildTokenizerRulesPage(column) {
        var colors = palette();
        var catalog = tokenizerRuleCatalog();
        var rules = catalog.rules || [];
        var scroll = new ScrollView(appContext);
        var list = new LinearLayout(appContext);
        var index;
        var card;
        var params;
        buildDragHandle(column);
        buildTokenizerSubHeader(column, "分词规则", "＋ 新建",
            function () { openTokenizerRuleEditor(null); },
            function () { returnToTokenizerMain("header_back"); });
        list.setOrientation(LinearLayout.VERTICAL);
        list.setPadding(0, dp(2), 0, dp(10));
        for (index = 0; index < rules.length; index += 1) {
            card = makeTokenizerRuleCard(rules[index], catalog);
            params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
            if (index > 0) { params.topMargin = dp(8); }
            list.addView(card, params);
        }
        if (rules.length === 0) {
            card = makeText("暂无分词规则", 11, colors.textSecondary, false);
            card.setGravity(Gravity.CENTER);
            list.addView(card, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(140)));
        }
        scroll.setFillViewport(true);
        scroll.setVerticalScrollBarEnabled(false);
        scroll.addView(list, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT));
        column.addView(scroll, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));
        return scroll;
    }

    function captureTokenizerRuleEditorInputs() {
        if (regexTitleInput !== null) {
            state.ruleEditorTitle = String(regexTitleInput.getText());
        }
        if (regexInput !== null) {
            state.ruleEditorPattern = String(regexInput.getText());
        }
        return true;
    }

    function tokenizerDraftRule() {
        var title;
        var pattern;
        captureTokenizerRuleEditorInputs();
        title = String(state.ruleEditorTitle || "").replace(/^\s+|\s+$/g, "");
        pattern = String(state.ruleEditorPattern || "").replace(/^\s+|\s+$/g, "");
        if (!title) { title = "自定义分词规则"; }
        return {
            id: String(editingRuleId || "tokenizer.custom.preview"),
            title: title,
            pattern: pattern,
            flags: state.ruleEditorFlags === undefined ? 0 : state.ruleEditorFlags,
            enabled: true,
            priority: Number(state.ruleEditorPriority || 1400),
            mode: String(state.ruleEditorMode || "match") === "split" ?
                "split" : "match",
            keepDelimiter: String(state.ruleEditorMode || "match") === "split" &&
                state.ruleEditorKeepDelimiter === true,
            groupMode: String(state.ruleEditorGroupMode || "whole") === "groups" ?
                "groups" : "whole",
            type: String(state.ruleEditorMode || "match") === "split" ?
                "symbol" : "word"
        };
    }

    function updateTokenizerRuleEditorOptionStyles() {
        var colors = palette();
        var matchMode = String(state.ruleEditorMode || "match") !== "split";
        var groupWhole = String(state.ruleEditorGroupMode || "whole") !== "groups";
        updateRegexRuleModeStyles();
        if (regexGroupWholeView !== null) {
            applyBackground(regexGroupWholeView,
                groupWhole ? colors.accentStrong : colors.surfaceMuted,
                groupWhole ? colors.accentStrong : colors.stroke, 8);
            safeTextColor(regexGroupWholeView,
                groupWhole ? selectedTextColor(colors) : colors.textSecondary);
        }
        if (regexGroupGroupsView !== null) {
            applyBackground(regexGroupGroupsView,
                groupWhole ? colors.surfaceMuted : colors.accentStrong,
                groupWhole ? colors.stroke : colors.accentStrong, 8);
            safeTextColor(regexGroupGroupsView,
                groupWhole ? colors.textSecondary : selectedTextColor(colors));
        }
        if (regexKeepDelimiterView !== null) {
            applyBackground(regexKeepDelimiterView,
                state.ruleEditorKeepDelimiter ? colors.accentSoft : colors.surfaceMuted,
                state.ruleEditorKeepDelimiter ? colors.accentBorder : colors.stroke, 8);
            safeTextColor(regexKeepDelimiterView,
                state.ruleEditorKeepDelimiter ? colors.accentStrong : colors.textSecondary);
            regexKeepDelimiterView.setText(
                state.ruleEditorKeepDelimiter ? "✓ 保留分隔符" : "保留分隔符");
        }
        if (regexMatchOptionsRow !== null) {
            regexMatchOptionsRow.setVisibility(matchMode ? View.VISIBLE : View.GONE);
        }
        if (regexSplitOptionsRow !== null) {
            regexSplitOptionsRow.setVisibility(matchMode ? View.GONE : View.VISIBLE);
        }
        return true;
    }

    function renderTokenizerRulePreview() {
        var colors = palette();
        var status;
        var scroll;
        var row;
        var item;
        var view;
        var params;
        var index;
        if (rulePreviewContainer === null) { return false; }
        rulePreviewContainer.removeAllViews();
        if (state.rulePreviewStatus === "loading") {
            status = makeText("正在测试当前规则…", 10,
                colors.textSecondary, false);
            rulePreviewContainer.addView(status, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(34)));
            return true;
        }
        if (state.rulePreviewStatus === "failed") {
            status = makeText("规则测试失败：" +
                String(state.rulePreviewError || "正则表达式无效"), 10,
                colors.danger, false);
            rulePreviewContainer.addView(status, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT));
            return true;
        }
        if (state.rulePreviewStatus !== "ready") {
            status = makeText("点击“测试规则”后预览当前原文的分词结果", 9.5,
                colors.textTertiary, false);
            rulePreviewContainer.addView(status, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(34)));
            return true;
        }
        status = makeText("预览 · " + String(state.rulePreviewTokens.length) +
            " 个块", 9.5, colors.textSecondary, false);
        rulePreviewContainer.addView(status, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(26)));
        scroll = new HorizontalScrollView(appContext);
        scroll.setHorizontalScrollBarEnabled(false);
        row = new LinearLayout(appContext);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER_VERTICAL);
        for (index = 0; index < state.rulePreviewTokens.length && index < 48;
                index += 1) {
            item = state.rulePreviewTokens[index] || {};
            view = makeText(String(item.text || ""), 9.5,
                item.ruleId ? colors.accentStrong : colors.textPrimary, false);
            view.setGravity(Gravity.CENTER);
            view.setPadding(dp(9), 0, dp(9), 0);
            applyBackground(view,
                item.ruleId ? colors.accentSoft : colors.surfaceMuted,
                item.ruleId ? colors.accentBorder : colors.stroke, 8);
            params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, dp(32));
            if (index > 0) { params.leftMargin = dp(5); }
            row.addView(view, params);
        }
        scroll.addView(row, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT, dp(36)));
        rulePreviewContainer.addView(scroll, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(38)));
        return true;
    }

    function commitTokenizerRuleEditor() {
        var draft = tokenizerDraftRule();
        var saved;
        var participating;
        if (!draft.pattern) {
            state.rulePreviewStatus = "failed";
            state.rulePreviewError = "分词正则不能为空";
            renderTokenizerRulePreview();
            return false;
        }
        if (!ClipHub.TokenizerService ||
                typeof ClipHub.TokenizerService.upsertRuleConfig !== "function" ||
                typeof ClipHub.TokenizerService.toggleRuleSelection !== "function") {
            state.rulePreviewStatus = "failed";
            state.rulePreviewError = "TokenizerService 规则 API 不可用";
            renderTokenizerRulePreview();
            return false;
        }
        try {
            draft.id = String(editingRuleId || "");
            saved = ClipHub.TokenizerService.upsertRuleConfig(draft);
            participating = ClipHub.TokenizerService.toggleRuleSelection(
                String(saved.id || ""), true);
            editingRuleId = String(saved.id || "");
            if (participating !== true) {
                state.rulePreviewStatus = "failed";
                state.rulePreviewError = "规则已保存，但参与分词数量已达上限";
                renderTokenizerRulePreview();
                return false;
            }
            state.tokenizerResultDirty = true;
            emitAction("tokenizer_rule_save", {
                ruleId: editingRuleId,
                selected: true
            });
            returnToTokenizerRulesPage("tokenizer_rule_saved");
            return true;
        } catch (error) {
            state.rulePreviewStatus = "failed";
            state.rulePreviewError = String(error);
            state.lastError = String(error);
            renderTokenizerRulePreview();
            return false;
        }
    }

    /* tokenizer_rule_preview_uses_runtime_v1 */
    function previewTokenizerRuleEditor(saveAfter) {
        var draft = tokenizerDraftRule();
        if (!draft.pattern) {
            state.rulePreviewStatus = "failed";
            state.rulePreviewError = "分词正则不能为空";
            renderTokenizerRulePreview();
            return false;
        }
        if (!ClipHub.TokenizerService ||
                typeof ClipHub.TokenizerService.tokenizeWithRulesAsync !== "function") {
            state.rulePreviewStatus = "failed";
            state.rulePreviewError = "TokenizerService 规则测试 API 不可用";
            renderTokenizerRulePreview();
            return false;
        }
        hideTokenizerKeyboard();
        state.rulePreviewStatus = "loading";
        state.rulePreviewError = null;
        state.rulePreviewTokens = [];
        renderTokenizerRulePreview();
        return ClipHub.TokenizerService.tokenizeWithRulesAsync(
            String(state.sourceText || ""),
            [draft],
            {
                mode: "regex",
                includeBuiltins: false,
                reason: "tokenizer_rule_preview"
            },
            function (result) {
                var errors;
                if (!state.mounted ||
                        String(state.page || "") !== "tokenizer_rule_editor") {
                    return;
                }
                errors = result && result.errors ? result.errors : [];
                if (!result || result.ok !== true || errors.length > 0) {
                    state.rulePreviewStatus = "failed";
                    state.rulePreviewError = errors.length > 0 ?
                        String(errors[0].error || errors[0].message || "正则表达式无效") :
                        String(result && (result.message || result.code) ||
                            "规则测试失败");
                    renderTokenizerRulePreview();
                    return;
                }
                state.rulePreviewStatus = "ready";
                state.rulePreviewError = null;
                state.rulePreviewTokens = result.tokens || [];
                renderTokenizerRulePreview();
                if (saveAfter === true) { commitTokenizerRuleEditor(); }
            }
        );
    }

    function deleteTokenizerRuleEditor() {
        var id = String(editingRuleId || "");
        if (!id || !ClipHub.TokenizerService ||
                typeof ClipHub.TokenizerService.deleteRuleConfig !== "function") {
            return false;
        }
        try {
            if (!ClipHub.TokenizerService.deleteRuleConfig(id)) { return false; }
            state.tokenizerResultDirty = true;
            emitAction("tokenizer_rule_delete", { ruleId: id });
            editingRuleId = "";
            returnToTokenizerRulesPage("tokenizer_rule_deleted");
            return true;
        } catch (error) {
            state.lastError = String(error);
            return false;
        }
    }

    function buildTokenizerRuleEditorPage(column) {
        var colors = palette();
        var scroll = new ScrollView(appContext);
        var form = new LinearLayout(appContext);
        var label;
        var params;
        var row;
        var actionRow;
        buildDragHandle(column);
        buildTokenizerSubHeader(column,
            editingRuleId ? "编辑分词规则" :
                (state.ruleEditorPresetSourceId ? "创建规则副本" : "新建分词规则"),
            "", null,
            function () { returnToTokenizerRulesPage("header_back"); });
        form.setOrientation(LinearLayout.VERTICAL);
        form.setPadding(0, dp(2), 0, dp(12));

        label = makeText("规则名称", 10, colors.textSecondary, true);
        form.addView(label, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(28)));
        regexTitleInput = new EditText(appContext);
        regexTitleInput.setSingleLine(true);
        regexTitleInput.setGravity(Gravity.CENTER_VERTICAL | Gravity.START);
        regexTitleInput.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11);
        regexTitleInput.setHint("例如：Android 包名");
        regexTitleInput.setText(String(state.ruleEditorTitle || ""));
        regexTitleInput.setPadding(dp(10), 0, dp(10), 0);
        regexTitleInput.setInputType(InputType.TYPE_CLASS_TEXT |
            InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        safeTextColor(regexTitleInput, colors.textPrimary);
        safeHintColor(regexTitleInput, colors.textTertiary);
        applyBackground(regexTitleInput, colors.surface, colors.stroke, 10);
        form.addView(regexTitleInput, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(40)));

        label = makeText("正则表达式", 10, colors.textSecondary, true);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(30));
        params.topMargin = dp(8);
        form.addView(label, params);
        regexInput = new EditText(appContext);
        regexInput.setSingleLine(false);
        regexInput.setGravity(Gravity.TOP | Gravity.START);
        regexInput.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11.5);
        regexInput.setHint("输入分词正则表达式");
        regexInput.setText(String(state.ruleEditorPattern || ""));
        regexInput.setPadding(dp(10), dp(8), dp(10), dp(8));
        regexInput.setInputType(InputType.TYPE_CLASS_TEXT |
            InputType.TYPE_TEXT_FLAG_MULTI_LINE |
            InputType.TYPE_TEXT_FLAG_NO_SUGGESTIONS);
        safeTextColor(regexInput, colors.textPrimary);
        safeHintColor(regexInput, colors.textTertiary);
        applyBackground(regexInput, colors.surface, colors.stroke, 10);
        form.addView(regexInput, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(92)));

        label = makeText("处理方式", 10, colors.textSecondary, true);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(30));
        params.topMargin = dp(8);
        form.addView(label, params);
        row = new LinearLayout(appContext);
        row.setOrientation(LinearLayout.HORIZONTAL);
        regexModeMatchView = makeRegexEditorAction("匹配", false, function () {
            state.ruleEditorMode = "match";
            updateTokenizerRuleEditorOptionStyles();
        });
        regexModeSplitView = makeRegexEditorAction("切分", false, function () {
            state.ruleEditorMode = "split";
            updateTokenizerRuleEditorOptionStyles();
        });
        params = new LinearLayout.LayoutParams(0, dp(34), 1);
        params.rightMargin = dp(5);
        row.addView(regexModeMatchView, params);
        row.addView(regexModeSplitView,
            new LinearLayout.LayoutParams(0, dp(34), 1));
        form.addView(row, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(36)));

        regexMatchOptionsRow = new LinearLayout(appContext);
        regexMatchOptionsRow.setOrientation(LinearLayout.HORIZONTAL);
        regexMatchOptionsRow.setGravity(Gravity.CENTER_VERTICAL);
        label = makeText("捕获方式", 9.5, colors.textSecondary, false);
        regexMatchOptionsRow.addView(label,
            new LinearLayout.LayoutParams(dp(70), dp(34)));
        regexGroupWholeView = makeRegexEditorAction("完整匹配", false, function () {
            state.ruleEditorGroupMode = "whole";
            updateTokenizerRuleEditorOptionStyles();
        });
        regexGroupGroupsView = makeRegexEditorAction("捕获组", false, function () {
            state.ruleEditorGroupMode = "groups";
            updateTokenizerRuleEditorOptionStyles();
        });
        params = new LinearLayout.LayoutParams(0, dp(32), 1);
        params.rightMargin = dp(5);
        regexMatchOptionsRow.addView(regexGroupWholeView, params);
        regexMatchOptionsRow.addView(regexGroupGroupsView,
            new LinearLayout.LayoutParams(0, dp(32), 1));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(38));
        params.topMargin = dp(6);
        form.addView(regexMatchOptionsRow, params);

        regexSplitOptionsRow = new LinearLayout(appContext);
        regexSplitOptionsRow.setOrientation(LinearLayout.HORIZONTAL);
        regexSplitOptionsRow.setGravity(Gravity.CENTER_VERTICAL);
        label = makeText("切分选项", 9.5, colors.textSecondary, false);
        regexSplitOptionsRow.addView(label,
            new LinearLayout.LayoutParams(dp(70), dp(34)));
        regexKeepDelimiterView = makeText("保留分隔符", 10,
            colors.textSecondary, true);
        regexKeepDelimiterView.setGravity(Gravity.CENTER);
        regexKeepDelimiterView.setClickable(true);
        regexKeepDelimiterView.setFocusable(true);
        regexKeepDelimiterView.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () {
                state.ruleEditorKeepDelimiter = !state.ruleEditorKeepDelimiter;
                updateTokenizerRuleEditorOptionStyles();
            }
        }));
        regexSplitOptionsRow.addView(regexKeepDelimiterView,
            new LinearLayout.LayoutParams(0, dp(32), 1));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(38));
        params.topMargin = dp(6);
        form.addView(regexSplitOptionsRow, params);
        updateTokenizerRuleEditorOptionStyles();

        actionRow = new LinearLayout(appContext);
        actionRow.setOrientation(LinearLayout.HORIZONTAL);
        params = new LinearLayout.LayoutParams(0, dp(38), 1);
        params.rightMargin = dp(6);
        actionRow.addView(makeRegexEditorAction("测试规则", false, function () {
            previewTokenizerRuleEditor(false);
        }), params);
        actionRow.addView(makeRegexEditorAction("保存并参与", true, function () {
            previewTokenizerRuleEditor(true);
        }), new LinearLayout.LayoutParams(0, dp(38), 1));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(42));
        params.topMargin = dp(10);
        form.addView(actionRow, params);

        if (editingRuleId) {
            label = makeText("删除自定义规则", 10, colors.danger, true);
            label.setGravity(Gravity.CENTER);
            label.setClickable(true);
            label.setFocusable(true);
            applyBackground(label, colors.dangerSoft, colors.danger, 10);
            label.setOnClickListener(new JavaAdapter(View.OnClickListener, {
                onClick: function () { deleteTokenizerRuleEditor(); }
            }));
            params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(38));
            params.topMargin = dp(8);
            form.addView(label, params);
        }

        label = makeText("测试预览", 10, colors.textSecondary, true);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(30));
        params.topMargin = dp(8);
        form.addView(label, params);
        rulePreviewContainer = new LinearLayout(appContext);
        rulePreviewContainer.setOrientation(LinearLayout.VERTICAL);
        form.addView(rulePreviewContainer, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        renderTokenizerRulePreview();

        scroll.setFillViewport(true);
        scroll.setVerticalScrollBarEnabled(false);
        scroll.addView(form, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT));
        column.addView(scroll, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));
        return scroll;
    }

    function applySelectionIndexes(indexes) {
        var next = indexes || [];
        var seen = {};
        var normalized = [];
        var index;
        var value;
        for (index = 0; index < next.length; index += 1) {
            value = Number(next[index]);
            if (value < 0 || value >= state.tokens.length || seen[value]) { continue; }
            seen[value] = true;
            normalized.push(value);
        }
        normalized.sort(function (a, b) { return a - b; });
        state.selectedIndexes = normalized;
        for (index = 0; index < tokenViews.length; index += 1) {
            applyTokenStyle(index);
        }
        updateStatsViews();
        return normalized.length;
    }

    function performTokenizerMoreAction(action) {
        var indexes = [];
        var index;
        action = String(action || "");
        if (action === "edit") {
            if (selectedCount() <= 0) { return false; }
            emitAction("edit", {});
            return true;
        }
        if (action === "export") {
            emitAction("export", {});
            return true;
        }
        if (action === "select_all") {
            for (index = 0; index < state.tokens.length; index += 1) {
                indexes.push(index);
            }
            applySelectionIndexes(indexes);
            emitAction("select_all", {});
            return true;
        }
        if (action === "invert_selection") {
            for (index = 0; index < state.tokens.length; index += 1) {
                if (!indexSelected(index)) { indexes.push(index); }
            }
            applySelectionIndexes(indexes);
            emitAction("invert_selection", {});
            return true;
        }
        if (action === "clear_selection") {
            applySelectionIndexes([]);
            emitAction("clear", { selectionOnly: true });
            return true;
        }
        return false;
    }

    function makeTokenizerMoreAction(label, action) {
        var colors = palette();
        var view = makeText(label, 11, colors.textPrimary, false);
        view.setGravity(Gravity.CENTER_VERTICAL | Gravity.START);
        view.setPadding(dp(14), 0, dp(14), 0);
        view.setClickable(true);
        view.setFocusable(true);
        view.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () {
                performTokenizerMoreAction(action);
                hidePopup();
            }
        }));
        return view;
    }

    function showTokenizerMoreMenu() {
        var colors = palette();
        var actions = [
            ["编辑选中内容", "edit"],
            ["导出", "export"],
            ["全选", "select_all"],
            ["反选", "invert_selection"],
            ["取消选择", "clear_selection"]
        ];
        var params;
        var index;
        var item;
        if (!state.mounted || pageRoot === null ||
                String(state.page || "tokenizer") !== "tokenizer") {
            return false;
        }
        hidePopup();
        popupCard = new LinearLayout(appContext);
        popupCard.setOrientation(LinearLayout.VERTICAL);
        popupCard.setPadding(dp(6), dp(5), dp(6), dp(5));
        applyBackground(popupCard, colors.surfaceRaised, colors.stroke, 13);
        if (Packages.android.os.Build.VERSION.SDK_INT >= 21) {
            try { popupCard.setElevation(dp(12)); } catch (ignoredElevation) {}
        }
        for (index = 0; index < actions.length; index += 1) {
            item = makeTokenizerMoreAction(actions[index][0], actions[index][1]);
            popupCard.addView(item, new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, dp(40)));
        }
        params = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, dp(210));
        params.gravity = Gravity.BOTTOM;
        params.leftMargin = dp(24);
        params.rightMargin = dp(24);
        params.bottomMargin = dp(58);
        pageRoot.addView(popupCard, params);
        state.popupVisible = true;
        state.popupTokenIndex = -1;
        return true;
    }

    function clearTokenizerSurfaceRefs() {
        clearFlowObserver();
        hidePopup();
        resetGesture();
        modeNormalView = null;
        modeRegexView = null;
        bodyContainer = null;
        statsLeftView = null;
        statsRightView = null;
        tokenScroll = null;
        tokenFlowRoot = null;
        regexInput = null;
        regexTitleInput = null;
        regexRuleScroll = null;
        regexRuleRow = null;
        regexModeMatchView = null;
        regexModeSplitView = null;
        regexGroupWholeView = null;
        regexGroupGroupsView = null;
        regexKeepDelimiterView = null;
        regexMatchOptionsRow = null;
        regexSplitOptionsRow = null;
        rulePreviewContainer = null;
        tokenViews = [];
        tokenRows = [];
        return true;
    }

    function renderTokenizerSurface() {
        var page = String(state.page || "tokenizer");
        var bodyParams;
        if (!state.mounted || pageColumn === null) { return false; }
        clearTokenizerSurfaceRefs();
        pageColumn.removeAllViews();
        if (page === "tokenizer_rules") {
            buildTokenizerRulesPage(pageColumn);
            return true;
        }
        if (page === "tokenizer_rule_editor") {
            buildTokenizerRuleEditorPage(pageColumn);
            return true;
        }
        state.page = "tokenizer";
        buildDragHandle(pageColumn);
        buildHeader(pageColumn);
        buildSegment(pageColumn);
        buildDivider(pageColumn);
        bodyContainer = new LinearLayout(appContext);
        bodyContainer.setOrientation(LinearLayout.VERTICAL);
        bodyContainer.setPadding(0, dp(3), 0, 0);
        bodyParams = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1);
        pageColumn.addView(bodyContainer, bodyParams);
        buildIndicator(pageColumn);
        buildDivider(pageColumn);
        buildToolbar(pageColumn);
        buildHint(pageColumn);
        renderMode();
        return true;
    }
'''

marker = '    function buildRegexBody() {'
if source.count(marker) != 1:
    raise RuntimeError('TokenizerUI buildRegexBody marker mismatch')
source = source.replace(marker, management_helpers + '\n\n' + marker, 1)

new_regex_body = r'''    function buildRegexBody() {
        var colors = palette();
        var catalog = tokenizerRuleCatalog();
        var ruleHeader = new LinearLayout(appContext);
        var label = makeText("分词规则", 10.5, colors.textPrimary, true);
        var count = makeText("已参与 " + String(state.selectedRuleCount), 9.5,
            colors.textSecondary, false);
        var arrow = makeText("›", 16, colors.accentStrong, false);
        var params;
        bodyContainer.removeAllViews();
        ruleHeader.setOrientation(LinearLayout.HORIZONTAL);
        ruleHeader.setGravity(Gravity.CENTER_VERTICAL);
        ruleHeader.setClickable(true);
        ruleHeader.setFocusable(true);
        ruleHeader.setContentDescription("管理分词规则，已参与 " +
            String(state.selectedRuleCount) + " 个");
        ruleHeader.addView(label, new LinearLayout.LayoutParams(0,
            LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        count.setGravity(Gravity.CENTER_VERTICAL);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT, dp(30));
        params.rightMargin = dp(7);
        ruleHeader.addView(count, params);
        arrow.setGravity(Gravity.CENTER);
        ruleHeader.addView(arrow, new LinearLayout.LayoutParams(dp(20), dp(30)));
        ruleHeader.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: function () { openTokenizerRulesPage(); }
        }));
        bodyContainer.addView(ruleHeader, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(34)));
        buildTokenizerRuleSelector(bodyContainer);
        buildStatsRow(bodyContainer);
        buildTokenScroll(bodyContainer);
        return catalog;
    }'''
source = regex_replace_once(
    source,
    r'    function buildRegexBody\(\) \{.*?\n    \}\n\n    function applyModeStyles\(\)',
    lambda match: new_regex_body + '\n\n    function applyModeStyles()',
    'TokenizerUI regex home body',
    re.S)

source = replace_once(
    source,
    '        rule.setOnClickListener(new JavaAdapter(View.OnClickListener, {\n'
    '            onClick: function () {\n'
    '                if (state.mode !== "regex") { switchMode("regex"); }\n'
    '                else { clearRegexRuleEditor(true); }\n'
    '                emitAction("rule", {});\n'
    '            }\n'
    '        }));\n',
    '        rule.setOnClickListener(new JavaAdapter(View.OnClickListener, {\n'
    '            onClick: function () {\n'
    '                if (state.mode !== "regex") { switchMode("regex"); }\n'
    '                else { openTokenizerRulesPage(); }\n'
    '                emitAction("rule", {});\n'
    '            }\n'
    '        }));\n',
    'TokenizerUI header rule action')

source = replace_once(
    source,
    '        cell.setOnClickListener(new JavaAdapter(View.OnClickListener, {\n'
    '            onClick: function () { emitAction(action, {}); }\n'
    '        }));\n',
    '        cell.setOnClickListener(new JavaAdapter(View.OnClickListener, {\n'
    '            onClick: function () {\n'
    '                if (String(action) === "more") { showTokenizerMoreMenu(); }\n'
    '                else { emitAction(action, {}); }\n'
    '            }\n'
    '        }));\n',
    'TokenizerUI toolbar cell more action')

new_toolbar = r'''    /* tokenizer_toolbar_three_actions_v1 */
    function buildToolbar(column) {
        var colors = palette();
        var toolbar = new LinearLayout(appContext);
        var params;
        toolbar.setOrientation(LinearLayout.HORIZONTAL);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(0, dp(3), 0, dp(3));
        ClipHub.Theme.applyBackgroundColor(toolbar, colors.surface);
        params = new LinearLayout.LayoutParams(0, dp(42), 1);
        params.rightMargin = dp(7);
        toolbar.addView(makeToolbarCell("▣", "复制", "copy", false), params);
        params = new LinearLayout.LayoutParams(0, dp(42), 1);
        params.rightMargin = dp(7);
        toolbar.addView(makeToolbarCell("↵", "输入", "input", false), params);
        toolbar.addView(makeToolbarCell("⋯", "更多", "more", false),
            new LinearLayout.LayoutParams(0, dp(42), 1));
        column.addView(toolbar, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(48)));
    }'''
source = regex_replace_once(
    source,
    r'    function buildToolbar\(column\) \{.*?\n    \}\n\n    function buildHint\(column\)',
    lambda match: new_toolbar + '\n\n    function buildHint(column)',
    'TokenizerUI three-action toolbar',
    re.S)

source = replace_once(
    source,
    '    function buildPage() {\n'
    '        var colors = palette();\n'
    '        var chrome = tokenizerChromeMetrics();\n'
    '        var bodyParams;\n'
    '        var horizontalPadding = editorEmbeddedInPrimary ? 0 : chrome.screenPaddingDp;\n'
    '        var topPadding = editorEmbeddedInPrimary ? 0 : chrome.pagePaddingTopDp;\n'
    '        var bottomPadding = editorEmbeddedInPrimary ? 0 : chrome.pagePaddingBottomDp;\n'
    '        pageRoot = new FrameLayout(appContext);\n'
    '        pageColumn = new LinearLayout(appContext);\n'
    '        pageColumn.setOrientation(LinearLayout.VERTICAL);\n'
    '        /* tokenizer_chrome_unified_v1 */\n'
    '        pageColumn.setPadding(dp(horizontalPadding), dp(topPadding),\n'
    '            dp(horizontalPadding), dp(bottomPadding));\n'
    '        ClipHub.Theme.applyBackgroundColor(pageRoot, colors.surface);\n'
    '        buildDragHandle(pageColumn);\n'
    '        buildHeader(pageColumn);\n'
    '        buildSegment(pageColumn);\n'
    '        buildDivider(pageColumn);\n'
    '        bodyContainer = new LinearLayout(appContext);\n'
    '        bodyContainer.setOrientation(LinearLayout.VERTICAL);\n'
    '        bodyContainer.setPadding(0, dp(3), 0, 0);\n'
    '        bodyParams = new LinearLayout.LayoutParams(\n'
    '            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1);\n'
    '        pageColumn.addView(bodyContainer, bodyParams);\n'
    '        buildIndicator(pageColumn);\n'
    '        buildDivider(pageColumn);\n'
    '        buildToolbar(pageColumn);\n'
    '        buildHint(pageColumn);\n'
    '        pageRoot.addView(pageColumn,\n'
    '            new FrameLayout.LayoutParams(\n'
    '                FrameLayout.LayoutParams.MATCH_PARENT,\n'
    '                FrameLayout.LayoutParams.MATCH_PARENT));\n'
    '        renderMode();\n'
    '        return pageRoot;\n'
    '    }\n',
    '    function buildPage() {\n'
    '        var colors = palette();\n'
    '        var chrome = tokenizerChromeMetrics();\n'
    '        var horizontalPadding = editorEmbeddedInPrimary ? 0 : chrome.screenPaddingDp;\n'
    '        var topPadding = editorEmbeddedInPrimary ? 0 : chrome.pagePaddingTopDp;\n'
    '        var bottomPadding = editorEmbeddedInPrimary ? 0 : chrome.pagePaddingBottomDp;\n'
    '        pageRoot = new FrameLayout(appContext);\n'
    '        pageColumn = new LinearLayout(appContext);\n'
    '        pageColumn.setOrientation(LinearLayout.VERTICAL);\n'
    '        /* tokenizer_chrome_unified_v1 */\n'
    '        pageColumn.setPadding(dp(horizontalPadding), dp(topPadding),\n'
    '            dp(horizontalPadding), dp(bottomPadding));\n'
    '        ClipHub.Theme.applyBackgroundColor(pageRoot, colors.surface);\n'
    '        pageRoot.addView(pageColumn,\n'
    '            new FrameLayout.LayoutParams(\n'
    '                FrameLayout.LayoutParams.MATCH_PARENT,\n'
    '                FrameLayout.LayoutParams.MATCH_PARENT));\n'
    '        renderTokenizerSurface();\n'
    '        return pageRoot;\n'
    '    }\n',
    'TokenizerUI buildPage surface router')

source = replace_once(
    source,
    '    function syncTokenizerShell(pageId, title, onBack) {\n'
    '        var id = String(pageId || "editor");\n'
    '        var path = id === "editor" ? ["editor"] : ["editor", id];\n',
    '    function syncTokenizerShell(pageId, title, onBack) {\n'
    '        var id = String(pageId || "editor");\n'
    '        var path = tokenizerPagePath(id);\n',
    'TokenizerUI nested shell path')

source = replace_once(
    source,
    '                    if (state.mounted) {\n'
    '                        return returnToEditor(String(reason || "system_back"));\n'
    '                    }\n',
    '                    if (state.mounted) {\n'
    '                        return dispatchTokenizerBack(\n'
    '                            String(reason || "system_back"));\n'
    '                    }\n',
    'TokenizerUI system back hierarchy')

source = replace_once(
    source,
    '        state.ruleEditorMode = "match";\n'
    '        editingRuleId = "";\n'
    '        state.tokens = [];\n',
    '        state.ruleEditorMode = "match";\n'
    '        state.ruleEditorGroupMode = "whole";\n'
    '        state.ruleEditorKeepDelimiter = false;\n'
    '        state.ruleEditorPriority = 1400;\n'
    '        state.ruleEditorFlags = 0;\n'
    '        state.ruleEditorPresetSourceId = "";\n'
    '        state.rulePreviewStatus = "idle";\n'
    '        state.rulePreviewError = null;\n'
    '        state.rulePreviewTokens = [];\n'
    '        state.tokenizerResultDirty = false;\n'
    '        state.page = "tokenizer";\n'
    '        editingRuleId = "";\n'
    '        state.tokens = [];\n',
    'TokenizerUI reset rule page state')

source = regex_replace_once(
    source,
    r'    function clearPageRefs\(\) \{.*?\n    \}\n\n    function buildPage\(\)',
    lambda match: '''    function clearPageRefs() {\n        clearTokenizerSurfaceRefs();\n        pageRoot = null;\n        pageColumn = null;\n    }\n\n    function buildPage()''',
    'TokenizerUI clearPageRefs',
    re.S)

source = replace_once(
    source,
    '            state.mounted = true;\n'
    '            editorPanelRoot.addView(buildPage(),\n',
    '            state.mounted = true;\n'
    '            state.page = "tokenizer";\n'
    '            editorPanelRoot.addView(buildPage(),\n',
    'TokenizerUI mount page reset')

source = replace_once(
    source,
    '        action = String(action || "");\n'
    '        if (!allowed[action]) { return false; }\n'
    '        emitAction(action, {});\n'
    '        return true;\n'
    '    }\n\n    function performPopupActionClick(action) {\n',
    '        action = String(action || "");\n'
    '        if (action === "more") { return showTokenizerMoreMenu(); }\n'
    '        if (!allowed[action]) { return false; }\n'
    '        emitAction(action, {});\n'
    '        return true;\n'
    '    }\n\n    function performPopupActionClick(action) {\n',
    'TokenizerUI programmatic toolbar more')

source = replace_once(
    source,
    '            mode: String(state.mode),\n'
    '            sourceTextLength: String(state.sourceText || "").length,\n',
    '            mode: String(state.mode),\n'
    '            page: String(state.page || "tokenizer"),\n'
    '            sourceTextLength: String(state.sourceText || "").length,\n',
    'TokenizerUI getState page')
source = replace_once(
    source,
    '            selectedRuleCount: Number(state.selectedRuleCount),\n'
    '            tokenizerRulesIsolatedFromFilter: true,\n',
    '            selectedRuleCount: Number(state.selectedRuleCount),\n'
    '            rulePreviewStatus: String(state.rulePreviewStatus || "idle"),\n'
    '            rulePreviewError: state.rulePreviewError,\n'
    '            rulePreviewTokenCount: Number(state.rulePreviewTokens.length),\n'
    '            tokenizerResultDirty: state.tokenizerResultDirty === true,\n'
    '            tokenizerRulesIsolatedFromFilter: true,\n',
    'TokenizerUI getState rule page diagnostics')

source = replace_once(
    source,
    '        performBackClick: function () {\n'
    '            return returnToEditor("api_back");\n'
    '        },\n',
    '        performBackClick: function () {\n'
    '            return dispatchTokenizerBack("api_back");\n'
    '        },\n'
    '        performOpenRulesClick: openTokenizerRulesPage,\n'
    '        performOpenRuleEditorClick: function (rule) {\n'
    '            return openTokenizerRuleEditor(rule || null);\n'
    '        },\n'
    '        performMoreActionClick: performTokenizerMoreAction,\n',
    'TokenizerUI public nested navigation')
source = replace_once(
    source,
    '        MODULE_VERSION: 8,\n',
    '        MODULE_VERSION: 9,\n',
    'TokenizerUI module version')

source = replace_once(
    source,
    '    function renderMode() {\n'
    '        clearFlowObserver();\n',
    '    function renderMode() {\n'
    '        if (String(state.page || "tokenizer") !== "tokenizer" ||\n'
    '                bodyContainer === null) { return false; }\n'
    '        clearFlowObserver();\n',
    'TokenizerUI renderMode page guard')

source = replace_once(
    source,
    '            copy: true, input: true, edit: true,\n'
    '            export: true, clear: true\n',
    '            copy: true, input: true, edit: true,\n'
    '            export: true, clear: true, more: true\n',
    'TokenizerUI toolbar action compatibility')

loader, source_sha = repack_tokenizer(loader, source)
TOKENIZER_LOADER_PATH.write_text(loader, encoding='utf-8')


# ---------------------------------------------------------------------------
# Navigation and runtime diagnostic regressions.
# ---------------------------------------------------------------------------
nav_test = NAV_TEST_PATH.read_text(encoding='utf-8')
nav_test = replace_once(
    nav_test,
    '        "regex_rules", "regex_editor", "regex_test",\n'
    '        "translation", "tokenizer"\n'
    '    ], "registered pages");\n'
    '    equal(state.pageStack, ["home"], "initial stack");\n'
    '    assertTrue(state.pageCount === 10, "page count must be 10");\n',
    '        "regex_rules", "regex_editor", "regex_test",\n'
    '        "translation", "tokenizer", "tokenizer_rules",\n'
    '        "tokenizer_rule_editor"\n'
    '    ], "registered pages");\n'
    '    equal(state.pageStack, ["home"], "initial stack");\n'
    '    assertTrue(state.pageCount === 12, "page count must be 12");\n',
    'UIShell nav registered pages')
nav_test = replace_once(
    nav_test,
    '    equal(ui.getState().pageStack,\n'
    '        ["home", "editor", "tokenizer"], "tokenizer stack");\n'
    '    assertTrue(ui.unmountPage("editor", "test_editor_family_close") === true,\n',
    '    equal(ui.getState().pageStack,\n'
    '        ["home", "editor", "tokenizer"], "tokenizer stack");\n'
    '    assertTrue(ui.syncEmbeddedPage({\n'
    '        pageId: "tokenizer_rules",\n'
    '        path: ["editor", "tokenizer", "tokenizer_rules"],\n'
    '        title: "分词规则",\n'
    '        showBack: true,\n'
    '        view: { id: "tokenizerRulesView" },\n'
    '        onBack: function () { return true; }\n'
    '    }) === true, "sync tokenizer rules");\n'
    '    equal(ui.getState().pageStack,\n'
    '        ["home", "editor", "tokenizer", "tokenizer_rules"],\n'
    '        "tokenizer rules stack");\n'
    '    assertTrue(ui.syncEmbeddedPage({\n'
    '        pageId: "tokenizer_rule_editor",\n'
    '        path: ["editor", "tokenizer", "tokenizer_rules",\n'
    '            "tokenizer_rule_editor"],\n'
    '        title: "编辑分词规则",\n'
    '        showBack: true,\n'
    '        view: { id: "tokenizerRuleEditorView" },\n'
    '        onBack: function () { return true; }\n'
    '    }) === true, "sync tokenizer rule editor");\n'
    '    equal(ui.getState().pageStack,\n'
    '        ["home", "editor", "tokenizer", "tokenizer_rules",\n'
    '            "tokenizer_rule_editor"],\n'
    '        "tokenizer rule editor stack");\n'
    '    assertTrue(ui.unmountPage("editor", "test_editor_family_close") === true,\n',
    'UIShell nav tokenizer nested pages')
NAV_TEST_PATH.write_text(nav_test, encoding='utf-8')

diag_test = DIAG_TEST_PATH.read_text(encoding='utf-8')
diag_test = replace_once(
    diag_test,
    '    assertTrue(diag.health === "ok", "tokenizer diagnostics");\n'
    '    assertTrue(diag.pages.tokenizer.mounted === true, "tokenizer mounted");\n\n'
    '    runtime.editor.currentPanelHeightDp = 520;\n',
    '    assertTrue(diag.health === "ok", "tokenizer diagnostics");\n'
    '    assertTrue(diag.pages.tokenizer.mounted === true, "tokenizer mounted");\n'
    '    ui.syncEmbeddedPage({\n'
    '        pageId: "tokenizer_rules",\n'
    '        path: ["editor", "tokenizer", "tokenizer_rules"],\n'
    '        title: "分词规则",\n'
    '        showBack: true,\n'
    '        view: { id: "editor" }\n'
    '    });\n'
    '    diag = ui.getRuntimeDiagnostics();\n'
    '    assertTrue(diag.health === "ok", "tokenizer rules diagnostics");\n'
    '    ui.syncEmbeddedPage({\n'
    '        pageId: "tokenizer_rule_editor",\n'
    '        path: ["editor", "tokenizer", "tokenizer_rules",\n'
    '            "tokenizer_rule_editor"],\n'
    '        title: "编辑分词规则",\n'
    '        showBack: true,\n'
    '        view: { id: "editor" }\n'
    '    });\n'
    '    diag = ui.getRuntimeDiagnostics();\n'
    '    assertTrue(diag.health === "ok", "tokenizer rule editor diagnostics");\n\n'
    '    runtime.editor.currentPanelHeightDp = 520;\n',
    'UIShell runtime tokenizer nested pages')
DIAG_TEST_PATH.write_text(diag_test, encoding='utf-8')


# ---------------------------------------------------------------------------
# Release contracts and manifest.
# ---------------------------------------------------------------------------
manifest = json.loads(MANIFEST_PATH.read_text(encoding='utf-8'))
if manifest.get('moduleSetVersion') != OLD_MODULE_SET:
    raise RuntimeError('unexpected moduleSetVersion: %s' %
                       manifest.get('moduleSetVersion'))
if manifest.get('sourceRef') != BRANCH:
    raise RuntimeError('unexpected sourceRef: %s' % manifest.get('sourceRef'))
manifest['moduleSetVersion'] = NEW_MODULE_SET
by_name = {item['name']: item for item in manifest.get('modules', [])}
by_name['ch_16_ui_shell.js']['sha'] = git_blob_sha(ui_shell)
by_name['ch_17_tokenizer_ui.js']['sha'] = git_blob_sha(loader)
MANIFEST_PATH.write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + '\n',
    encoding='utf-8')

contract = CONTRACT_PATH.read_text(encoding='utf-8')
contract = replace_once(
    contract,
    '"moduleSetVersion": "%s"' % OLD_MODULE_SET,
    '"moduleSetVersion": "%s"' % NEW_MODULE_SET,
    'manifest contract module set')
CONTRACT_PATH.write_text(contract, encoding='utf-8')

preflight = PREFLIGHT_PATH.read_text(encoding='utf-8')
preflight = replace_once(
    preflight,
    "EXPECTED_MODULE_SET='%s'" % OLD_MODULE_SET,
    "EXPECTED_MODULE_SET='%s'" % NEW_MODULE_SET,
    'preflight module set')
preflight = replace_once(
    preflight,
    '"ch_16_ui_shell.js": ("ch_16_ui_shell", 6),',
    '"ch_16_ui_shell.js": ("ch_16_ui_shell", 7),',
    'preflight ch16 module version')
preflight = replace_once(
    preflight,
    '"ch_17_tokenizer_ui.js": ("ch_17_tokenizer_ui", 8),',
    '"ch_17_tokenizer_ui.js": ("ch_17_tokenizer_ui", 9),',
    'preflight ch17 module version')
preflight = replace_once(
    preflight,
    '        assert "MODULE_VERSION: 6" in ui_shell_source\n',
    '        assert "MODULE_VERSION: 7" in ui_shell_source\n',
    'preflight explicit UIShell version')
preflight = replace_once(
    preflight,
    '        assert \'registerPage({ id: "tokenizer", parentId: "editor"\' in ui_shell_source\n',
    '        assert \'registerPage({ id: "tokenizer", parentId: "editor"\' in ui_shell_source\n'
    '        assert \'registerPage({ id: "tokenizer_rules", parentId: "tokenizer"\' in ui_shell_source\n'
    '        assert \'registerPage({ id: "tokenizer_rule_editor", parentId: "tokenizer_rules"\' in ui_shell_source\n',
    'preflight nested tokenizer registration')
anchor = '        assert "tokenizer_rule_config_isolated_v1" in tokenizer_source\n'
extra = (
    anchor +
    '        assert "tokenizer_rule_management_pages_v1" in tokenizer_source\n' +
    '        assert "tokenizer_rule_preview_uses_runtime_v1" in tokenizer_source\n' +
    '        assert "tokenizer_toolbar_three_actions_v1" in tokenizer_source\n' +
    '        assert "function buildTokenizerRulesPage(column)" in tokenizer_source\n' +
    '        assert "function buildTokenizerRuleEditorPage(column)" in tokenizer_source\n' +
    '        assert "function showTokenizerMoreMenu()" in tokenizer_source\n' +
    '        assert "TokenizerService.tokenizeWithRulesAsync" in tokenizer_source\n' +
    '        assert "保存并参与" in tokenizer_source\n' +
    '        assert "已参与" in tokenizer_source\n' +
    '        regex_home = re.search(r"function buildRegexBody\\(\\).*?function applyModeStyles", tokenizer_source, re.S)\n' +
    '        assert regex_home is not None\n' +
    '        assert "regexTitleInput" not in regex_home.group(0)\n' +
    '        assert "输入分词正则表达式" not in regex_home.group(0)\n' +
    '        toolbar_block = re.search(r"function buildToolbar\\(column\\).*?function buildHint", tokenizer_source, re.S)\n' +
    '        assert toolbar_block is not None\n' +
    '        assert toolbar_block.group(0).count("makeToolbarCell(") == 3\n' +
    '        assert "清空" not in toolbar_block.group(0)\n'
)
preflight = replace_once(preflight, anchor, extra,
                         'preflight tokenizer management assertions')
PREFLIGHT_PATH.write_text(preflight, encoding='utf-8')

print('Tokenizer rules UI unification patch complete')
print('moduleSetVersion=' + NEW_MODULE_SET)
print('TokenizerUI_SOURCE_SHA256=' + source_sha)
print('ch16_blob=' + git_blob_sha(ui_shell))
print('ch17_blob=' + git_blob_sha(loader))
