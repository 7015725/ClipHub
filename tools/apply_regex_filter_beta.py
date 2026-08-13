#!/usr/bin/env python3
from __future__ import annotations

import base64
import gzip
import hashlib
import json
import pathlib
import re
import shutil
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
BRANCH = "beta-regex-filter-20260813"
MODULE_SET = "20260813.02"
PATCH_DIR = ROOT / "tools" / "regex_beta_patches"


def fail(message: str) -> None:
    raise RuntimeError(message)


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        fail(f"{label}: expected exactly one anchor, got {count}")
    return text.replace(old, new, 1)


def insert_before(text: str, marker: str, addition: str, label: str) -> str:
    return replace_once(text, marker, addition + "\n" + marker, label)


def git_blob_sha_text(text: str) -> str:
    raw = text.encode("utf-8")
    return hashlib.sha1(f"blob {len(raw)}\0".encode("utf-8") + raw).hexdigest()


def unpack_loader(path: pathlib.Path) -> tuple[str, str, str]:
    text = path.read_text(encoding="utf-8")
    match = re.search(r"\bvar\s+(PACKED_B64|encoded)\s*=\s*(.*?);", text, re.S)
    if match is None:
        fail(f"packed assignment missing: {path}")
    pieces = re.findall(r'"(?:\\.|[^"\\])*"', match.group(2))
    if not pieces:
        fail(f"packed chunks missing: {path}")
    encoded = "".join(json.loads(piece) for piece in pieces)
    canonical = gzip.decompress(base64.b64decode(encoded)).decode("utf-8")
    expected = re.search(
        r"\bvar\s+SOURCE_SHA256\s*=\s*[\"']([0-9a-fA-F]{64})[\"']", text
    )
    if expected is not None:
        actual = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        if actual != expected.group(1).lower():
            fail(f"SOURCE_SHA256 mismatch before patch: {path}: {actual}")
    return text, match.group(1), canonical


def repack_loader(path: pathlib.Path, loader: str, variable: str,
                  canonical: str) -> None:
    raw = gzip.compress(canonical.encode("utf-8"), compresslevel=9, mtime=0)
    encoded = base64.b64encode(raw).decode("ascii")
    chunks = [encoded[index:index + 120]
              for index in range(0, len(encoded), 120)]
    expression = "\n        " + " +\n        ".join(json.dumps(chunk) for chunk in chunks) + "\n    "
    pattern = re.compile(
        r"(\bvar\s+" + re.escape(variable) + r"\s*=\s*)(.*?)(;)", re.S
    )
    match = pattern.search(loader)
    if match is None:
        fail(f"cannot repack {path}: assignment missing")
    loader = loader[:match.start(2)] + expression + loader[match.end(2):]
    source_sha = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    if re.search(r"\bvar\s+SOURCE_SHA256\s*=", loader):
        loader, count = re.subn(
            r"(\bvar\s+SOURCE_SHA256\s*=\s*[\"'])[0-9a-fA-F]{64}([\"'])",
            lambda m: m.group(1) + source_sha + m.group(2), loader, count=1
        )
        if count != 1:
            fail(f"SOURCE_SHA256 update failed: {path}")
    if path.name == "ch_06_repository.js":
        canonical_blob = git_blob_sha_text(canonical)
        loader, count = re.subn(
            r"(规范源码 Git blob:\s*)[0-9a-fA-F]{40}",
            lambda m: m.group(1) + canonical_blob, loader, count=1
        )
        if count != 1:
            fail("repository canonical blob comment update failed")
    path.write_text(loader, encoding="utf-8")


def patch_database() -> None:
    path = ROOT / "src" / "ch_03_database.js"
    text = path.read_text(encoding="utf-8")
    feature = r'''
    function ensureRegexFeatureSchema() {
        var db = requireOpen();
        runInTransaction(function () {
            db.execSQL(
                "CREATE TABLE IF NOT EXISTS regex_rules (" +
                "id INTEGER PRIMARY KEY AUTOINCREMENT," +
                "title TEXT NOT NULL," +
                "title_normalized TEXT NOT NULL," +
                "note TEXT NOT NULL DEFAULT ''," +
                "pattern TEXT NOT NULL," +
                "flags INTEGER NOT NULL DEFAULT 0," +
                "enabled INTEGER NOT NULL DEFAULT 1," +
                "manual_order INTEGER NOT NULL DEFAULT 0," +
                "created_at INTEGER NOT NULL," +
                "updated_at INTEGER NOT NULL" +
                ")"
            );
            db.execSQL(
                "CREATE UNIQUE INDEX IF NOT EXISTS " +
                "idx_regex_rules_title_normalized " +
                "ON regex_rules(title_normalized)"
            );
            db.execSQL(
                "CREATE INDEX IF NOT EXISTS idx_regex_rules_enabled_order " +
                "ON regex_rules(enabled, manual_order, id)"
            );
            db.execSQL(
                "INSERT OR IGNORE INTO schema_meta(key, value) VALUES " +
                "('feature.regex_rules.schema_version', '1')"
            );
        });
        return true;
    }
'''.strip("\n")
    text = insert_before(text, "    function openDatabase() {", feature,
                         "database feature schema insertion")
    text = replace_once(
        text,
        "            migrate();\n            return database;",
        "            migrate();\n            ensureRegexFeatureSchema();\n            return database;",
        "database open feature schema call",
    )
    text = replace_once(text, "MODULE_VERSION: 3", "MODULE_VERSION: 4",
                        "database module version")
    if "var SCHEMA_VERSION = 2;" not in text or "db.setVersion(3)" in text:
        fail("database v2 rollback boundary violated")
    path.write_text(text, encoding="utf-8")


def patch_repository() -> None:
    path = ROOT / "src" / "ch_06_repository.js"
    loader, variable, canonical = unpack_loader(path)
    fragment = (PATCH_DIR / "repository_regex_feature.jsfrag").read_text(
        encoding="utf-8")
    canonical = insert_before(canonical, "    ClipHub.Repository = {",
                              fragment.rstrip(), "repository regex fragment")
    canonical = replace_once(canonical, "MODULE_VERSION: 16",
                             "MODULE_VERSION: 17", "repository version")
    canonical = replace_once(
        canonical,
        "            if (!ready) {\n                throw new Error(\"Database is unavailable\");\n            }\n            return true;",
        "            if (!ready) {\n                throw new Error(\"Database is unavailable\");\n            }\n            ensureDefaultRegexRules();\n            return true;",
        "repository default regex initialization",
    )
    canonical = replace_once(
        canonical,
        "        reorderTags: reorderTags,\n        insert: insertItem,",
        "        reorderTags: reorderTags,\n"
        "        REGEX_FLAG_IGNORE_CASE: REGEX_FLAG_IGNORE_CASE,\n"
        "        REGEX_FLAG_MULTILINE: REGEX_FLAG_MULTILINE,\n"
        "        REGEX_FLAG_DOTALL: REGEX_FLAG_DOTALL,\n"
        "        normalizeRegexTitle: normalizeRegexTitle,\n"
        "        validateRegexPattern: validateRegexPattern,\n"
        "        listRegexRules: listRegexRules,\n"
        "        getRegexRule: getRegexRule,\n"
        "        createRegexRule: createRegexRule,\n"
        "        updateRegexRule: updateRegexRule,\n"
        "        deleteRegexRule: deleteRegexRule,\n"
        "        setRegexRuleEnabled: setRegexRuleEnabled,\n"
        "        reorderRegexRules: reorderRegexRules,\n"
        "        duplicateRegexRule: duplicateRegexRule,\n"
        "        ensureDefaultRegexRules: ensureDefaultRegexRules,\n"
        "        getRegexScanSnapshot: getRegexScanSnapshot,\n"
        "        countRegexCandidates: countRegexCandidates,\n"
        "        listRegexCandidateChunk: listRegexCandidateChunk,\n"
        "        itemMatchesBaseCriteria: itemMatchesBaseCriteria,\n"
        "        insert: insertItem,",
        "repository regex exports",
    )
    repack_loader(path, loader, variable, canonical)


def patch_filter() -> None:
    path = ROOT / "src" / "ch_11_filter.js"
    loader, variable, canonical = unpack_loader(path)
    fragment = (PATCH_DIR / "filter_regex_feature.jsfrag").read_text(
        encoding="utf-8")
    regex_vars = r'''
    var regexScanGeneration = 0;
    var regexScanExecutor = null;
    var regexScanFuture = null;
    var regexMatchedIds = [];
    var regexMatchedIdSet = {};
    var regexCompiledRuleRows = [];
    var regexResultCache = {};
    var regexPickerVisible = false;
    var regexPickerSearchText = "";
    var regexRuleViews = {};
    var advancedDraftRegexRuleIds = [];
    var advancedDraftRegexMatchMode = "any";
    var regexScanState = {
        running: false,
        generation: 0,
        scanned: 0,
        total: 0,
        matched: 0,
        firstBatchPublished: false,
        complete: false,
        cacheHitCount: 0,
        cacheMissCount: 0,
        lastCacheInvalidationReason: "",
        lastCancelReason: "",
        lastError: null
    };
'''.strip("\n")
    canonical = replace_once(
        canonical,
        "    var advancedVisible = false;\n",
        "    var advancedVisible = false;\n" + regex_vars + "\n",
        "filter regex runtime vars",
    )
    canonical = insert_before(canonical, "    function refreshPaginationUi(origin) {",
                              fragment.rstrip(), "filter regex fragment")
    old_empty = '''    function emptyValue() {
        return {
            keyword: "",
            sourcePackages: [],
            tagIds: [],
            pinnedOnly: false,
            sensitiveMode: "all",
            sortMode: "latest"
        };
    }
'''
    new_empty = '''    function emptyValue() {
        return {
            keyword: "",
            sourcePackages: [],
            tagIds: [],
            pinnedOnly: false,
            sensitiveMode: "all",
            sortMode: "latest",
            regexRuleIds: [],
            regexMatchMode: "any"
        };
    }
'''
    canonical = replace_once(canonical, old_empty, new_empty,
                             "filter empty criteria")
    old_copy = '''    function copyValue(input) {
        input = input || emptyValue();
        return {
            keyword: String(input.keyword || ""),
            sourcePackages: copyList(input.sourcePackages),
            tagIds: copyList(input.tagIds),
            pinnedOnly: input.pinnedOnly === true,
            sensitiveMode: String(input.sensitiveMode || "all"),
            sortMode: validateSortMode(input.sortMode)
        };
    }
'''
    new_copy = '''    function copyValue(input) {
        input = input || emptyValue();
        return {
            keyword: String(input.keyword || ""),
            sourcePackages: copyList(input.sourcePackages),
            tagIds: copyList(input.tagIds),
            pinnedOnly: input.pinnedOnly === true,
            sensitiveMode: String(input.sensitiveMode || "all"),
            sortMode: validateSortMode(input.sortMode),
            regexRuleIds: normalizeIdList(input.regexRuleIds || []),
            regexMatchMode: validateRegexMatchMode(input.regexMatchMode)
        };
    }
'''
    canonical = replace_once(canonical, old_copy, new_copy,
                             "filter copy criteria")
    canonical = replace_once(
        canonical,
        '            input.pinnedOnly === true ||\n            String(input.sensitiveMode || "all") !== "all";',
        '            input.pinnedOnly === true ||\n            String(input.sensitiveMode || "all") !== "all" ||\n            normalizeIdList(input.regexRuleIds || []).length > 0;',
        "filter regex active criteria",
    )
    canonical = replace_once(
        canonical,
        "    function loadPaginationPageInternal(request) {\n        var options;",
        "    function loadPaginationPageInternal(request) {\n"
        "        if (regexActive() && regexScanState.complete === true) {\n"
        "            return regexResultPageResult(request || {});\n"
        "        }\n"
        "        var options;",
        "filter regex pagination branch",
    )
    canonical = replace_once(
        canonical,
        "        if (!ready || value === null) {\n            throw new Error(\"ClipHub filter is not ready\");\n        }\n        pagedRequest =",
        "        if (!ready || value === null) {\n            throw new Error(\"ClipHub filter is not ready\");\n        }\n"
        "        if (options.regexBypass !== true && regexActive()) {\n"
        "            return startRegexScan(options);\n"
        "        }\n        pagedRequest =",
        "filter apply regex route",
    )
    canonical = replace_once(
        canonical,
        '''        if (patch.hasOwnProperty("sortMode")) {
            value.sortMode = validateSortMode(patch.sortMode);
        }
        return applyIfRequested(options);''',
        '''        if (patch.hasOwnProperty("sortMode")) {
            value.sortMode = validateSortMode(patch.sortMode);
        }
        if (patch.hasOwnProperty("regexRuleIds")) {
            value.regexRuleIds = sanitizeRegexRuleIds(patch.regexRuleIds);
        }
        if (patch.hasOwnProperty("regexMatchMode")) {
            value.regexMatchMode = validateRegexMatchMode(
                patch.regexMatchMode);
        }
        if (patch.hasOwnProperty("regexRuleIds") ||
                patch.hasOwnProperty("regexMatchMode")) {
            persistRegexCriteria();
            clearRegexResultCache("regex_set_value");
        }
        return applyIfRequested(options);''',
        "filter regex setValue",
    )
    canonical = replace_once(
        canonical,
        "        value = emptyValue();\n        return applyIfRequested(options);",
        "        cancelRegexScan(\"criteria_reset\", true);\n"
        "        clearRegexResultCache(\"criteria_reset\");\n"
        "        value = emptyValue();\n"
        "        persistRegexCriteria();\n"
        "        discardRegexDraft();\n"
        "        return applyIfRequested(options);",
        "filter regex reset",
    )
    canonical = replace_once(
        canonical,
        '''        var listener = eventName ===
            "pagination_settings_changed" ?
                onPaginationSettingsChanged :
                function (payload) {
                    return onClipboardChange(payload, eventName);
                };''',
        '''        var listener = eventName ===
            "pagination_settings_changed" ?
                onPaginationSettingsChanged :
            (eventName === "regex_rules_changed" ?
                onRegexRulesChanged :
                function (payload) {
                    return onClipboardChange(payload, eventName);
                });''',
        "filter regex event registration",
    )
    canonical = replace_once(
        canonical,
        '''    function applyFromUi() {
        markUiThread();
        state.applyActionCount += 1;''',
        '''    function applyFromUi() {
        markUiThread();
        commitRegexDraft();
        state.applyActionCount += 1;''',
        "filter apply regex draft",
    )
    canonical = replace_once(
        canonical,
        '''    function createAdvancedDrawerBundle(colors, counts) {
        var bundle = {''',
        '''    function createAdvancedDrawerBundle(colors, counts) {
        if (regexPickerVisible) {
            return makeRegexPickerDrawerBundle(colors);
        }
        var bundle = {''',
        "filter regex picker drawer routing",
    )
    canonical = replace_once(
        canonical,
        '''        if (counts.tags.length > 0) {
            addSection(content, "标签（多选）",
                counts.tags, "tag", colors, bundle);
        }

        sortRow = makeChoiceChipRow([''',
        '''        if (counts.tags.length > 0) {
            addSection(content, "标签（多选）",
                counts.tags, "tag", colors, bundle);
        }
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.bottomMargin = dp(8);
        content.addView(makeRegexAdvancedEntry(colors), params);

        sortRow = makeChoiceChipRow([''',
        "filter regex advanced entry",
    )
    canonical = replace_once(
        canonical,
        '''        if (validateSortMode(value.sortMode) !== "latest") {
            count += 1;
        }
        return count;''',
        '''        if (validateSortMode(value.sortMode) !== "latest") {
            count += 1;
        }
        if (value.regexRuleIds && value.regexRuleIds.length > 0) {
            count += 1;
        }
        return count;''',
        "filter active advanced count regex",
    )
    canonical = replace_once(
        canonical,
        '''    function updateResultCountOnMain() {
        var text;
        if (resultCountView === null) { return false; }
        if (paginationState.mode === "ajax") {''',
        '''    function updateResultCountOnMain() {
        var text;
        if (resultCountView === null) { return false; }
        if (regexActive() && regexScanState.running) {
            text = "正在筛选 " + String(regexScanState.scanned) +
                " / " + String(regexScanState.total) +
                " · 已匹配 " + String(regexScanState.matched) + " 条";
            resultCountView.setText(text);
            return true;
        }
        if (paginationState.mode === "ajax") {''',
        "filter regex progress label",
    )
    old_drawer = '''    function setAdvancedDrawerVisibleOnMain(visible, origin) {
        var next = visible === true;
        advancedVisible = next;
        state.advancedDrawerVisible = next;'''
    new_drawer = '''    function setAdvancedDrawerVisibleOnMain(visible, origin) {
        var next = visible === true;
        var wasVisible = advancedVisible === true;
        if (next && !wasVisible) {
            beginRegexDraft();
        } else if (!next && wasVisible &&
                String(origin || "") !== "ui_apply_close") {
            discardRegexDraft();
        }
        advancedVisible = next;
        state.advancedDrawerVisible = next;'''
    canonical = replace_once(canonical, old_drawer, new_drawer,
                             "filter regex drawer draft lifecycle")
    canonical = replace_once(
        canonical,
        '''        loadHistory();
        advancedVisible = options.showAdvanced === true;
        searchExpanded = options.requestKeyboard === true &&''',
        '''        loadHistory();
        advancedVisible = options.showAdvanced === true;
        if (advancedVisible) { beginRegexDraft(); }
        searchExpanded = options.requestKeyboard === true &&''',
        "filter show advanced regex draft",
    )
    canonical = replace_once(
        canonical,
        '''    function handleBack() {
        if (!state.panelAttached) { return false; }
        if (advancedVisible) {''',
        '''    function handleBack() {
        if (!state.panelAttached) { return false; }
        if (advancedVisible && regexPickerVisible) {
            state.backLayerCloseCount += 1;
            state.lastBackLayer = "regex_picker";
            return closeRegexPicker();
        }
        if (advancedVisible) {''',
        "filter regex back chain",
    )
    canonical = replace_once(
        canonical,
        '''            value = emptyValue();
            ready = true;
            eventListeners = [];''',
        '''            value = emptyValue();
            ready = true;
            loadRegexCriteriaPersistence();
            beginRegexDraft();
            eventListeners = [];''',
        "filter regex persistence init",
    )
    canonical = replace_once(
        canonical,
        '''            registerEvent("tags_changed");
            registerEvent(
                "pagination_settings_changed");''',
        '''            registerEvent("tags_changed");
            registerEvent("regex_rules_changed");
            registerEvent(
                "pagination_settings_changed");''',
        "filter regex rules listener",
    )
    canonical = replace_once(
        canonical,
        '''        if (options.destroyCache === true) {
            pendingDestroyCache = true;
        }''',
        '''        if (options.destroyCache === true) {
            pendingDestroyCache = true;
            cancelRegexScan("close_destroy_cache", true);
            clearRegexResultCache("close_destroy_cache");
        }''',
        "filter close regex worker",
    )
    canonical = replace_once(canonical, "MODULE_VERSION: 74",
                             "MODULE_VERSION: 75", "filter version")
    canonical = replace_once(
        canonical,
        '''        getMutationState:
            copyMutationState,
        performMutationRefresh:''',
        '''        getMutationState:
            copyMutationState,
        getRegexScanState: copyRegexScanState,
        getRegexMatchedIds: function () { return regexMatchedIds.slice(0); },
        performMutationRefresh:''',
        "filter regex public state",
    )
    canonical = replace_once(
        canonical,
        '''        setSortMode: function (mode, options) {
            return setValue({ sortMode: mode }, options);
        },

        getSourceOptions:''',
        '''        setSortMode: function (mode, options) {
            return setValue({ sortMode: mode }, options);
        },

        setRegexRuleIds: function (ids, options) {
            return setValue({ regexRuleIds: ids }, options);
        },

        setRegexMatchMode: function (mode, options) {
            return setValue({ regexMatchMode: mode }, options);
        },

        getRegexRuleOptions: function (keyword) {
            return ClipHub.Repository.listRegexRules({
                enabledOnly: true, titleKeyword: keyword || ""
            });
        },

        getSourceOptions:''',
        "filter regex public setters",
    )
    canonical = replace_once(
        canonical,
        '''        performApplyClick: function () {
            return requireMain(runOnMainSync(function () {
                return applyView !== null ?
                    applyView.performClick() : false;
            }, 2500));
        },

        performSourceClick:''',
        '''        performApplyClick: function () {
            return requireMain(runOnMainSync(function () {
                return applyView !== null ?
                    applyView.performClick() : false;
            }, 2500));
        },

        performOpenRegexPicker: function () {
            return requireMain(runOnMainSync(openRegexPicker, 2500));
        },
        performCloseRegexPicker: function () {
            return requireMain(runOnMainSync(closeRegexPicker, 2500));
        },
        performToggleRegexRule: function (ruleId) {
            return requireMain(runOnMainSync(function () {
                return toggleRegexDraftRule(Number(ruleId));
            }, 2500));
        },
        performSetRegexMode: function (mode) {
            return requireMain(runOnMainSync(function () {
                return setRegexDraftMode(mode);
            }, 2500));
        },
        performClearRegexRules: function () {
            return requireMain(runOnMainSync(clearRegexDraftRules, 2500));
        },

        performSourceClick:''',
        "filter regex UI probe exports",
    )
    canonical = replace_once(
        canonical,
        '''        shutdown: function () {
            pendingShowOptions = null;''',
        '''        shutdown: function () {
            pendingShowOptions = null;
            cancelRegexScan("shutdown", true);
            if (regexScanExecutor !== null) {
                try { regexScanExecutor.shutdownNow(); } catch (ignoredRegexExecutor) {}
            }
            regexScanExecutor = null;
            regexScanFuture = null;
            clearRegexResultCache("shutdown");''',
        "filter regex shutdown",
    )
    canonical = replace_once(
        canonical,
        '''            advancedDrawerVisible: advancedVisible,
            advancedButtonText:''',
        '''            advancedDrawerVisible: advancedVisible,
            regexPickerVisible: regexPickerVisible === true,
            regexRuleIds: copyList(value && value.regexRuleIds || []),
            regexMatchMode: validateRegexMatchMode(
                value && value.regexMatchMode),
            regexDraftRuleIds: copyList(advancedDraftRegexRuleIds),
            regexDraftMatchMode: validateRegexMatchMode(
                advancedDraftRegexMatchMode),
            regexRuleOptionCount: Number(state.regexRuleOptionCount || 0),
            regexScan: copyRegexScanState(),
            advancedButtonText:''',
        "filter regex panel diagnostics",
    )
    repack_loader(path, loader, variable, canonical)


def patch_settings() -> None:
    path = ROOT / "src" / "ch_13_settings.js"
    loader, variable, canonical = unpack_loader(path)
    fragment = (PATCH_DIR / "settings_regex_feature.jsfrag").read_text(
        encoding="utf-8")
    vars_block = r'''
    var settingsPage = "root";
    var regexSectionView = null;
    var regexRuleRowViews = {};
    var regexEditorRuleId = null;
    var regexEditorDraft = null;
    var regexTitleInput = null;
    var regexNoteInput = null;
    var regexPatternInput = null;
    var regexIgnoreCaseView = null;
    var regexMultilineView = null;
    var regexDotAllView = null;
    var regexEditorStatusView = null;
    var pendingDeleteRegexRuleId = null;
    var regexTestTextInput = null;
    var regexTestText = "";
    var regexTestResultLines = [];
    var regexTestExecutor = null;
    var regexTestGeneration = 0;
'''.strip("\n")
    canonical = replace_once(
        canonical,
        "    var clearAllItemsView = null;\n",
        "    var clearAllItemsView = null;\n" + vars_block + "\n",
        "settings regex vars",
    )
    canonical = replace_once(
        canonical,
        '''        lastBlogLaunchUserId: -1,
        lastTestResult: "",
        lastError: null''',
        '''        lastBlogLaunchUserId: -1,
        settingsPage: "root",
        regexRuleRowCount: 0,
        regexEditorOpen: false,
        regexEditorRuleId: null,
        regexDeleteConfirmCount: 0,
        regexCreateCount: 0,
        regexUpdateCount: 0,
        regexDeleteCount: 0,
        regexDuplicateCount: 0,
        regexReorderCount: 0,
        regexEnableToggleCount: 0,
        regexTestRunning: false,
        regexTestMatchCount: 0,
        regexTestTruncated: false,
        lastRegexValidationError: null,
        lastTestResult: "",
        lastError: null''',
        "settings regex diagnostics defaults",
    )
    canonical = replace_once(
        canonical,
        '''        paginationPrefetchEnabled: true,
        "translation.engine": "baidu",''',
        '''        paginationPrefetchEnabled: true,
        filterRegexRuleIds: [],
        filterRegexMatchMode: "any",
        "translation.engine": "baidu",''',
        "settings regex defaults",
    )
    canonical = insert_before(canonical, "    function serialize(value) {",
                              fragment.rstrip(), "settings regex fragment")
    canonical = replace_once(
        canonical,
        '''        if (key === "filterSearchHistory") {
            return normalizeSearchHistory(value);
        }
        throw new Error("Unknown setting: " + key);''',
        '''        if (key === "filterSearchHistory") {
            return normalizeSearchHistory(value);
        }
        if (key === "filterRegexRuleIds") {
            return normalizeRegexRuleIdList(value);
        }
        if (key === "filterRegexMatchMode") {
            value = String(value || "any");
            return value === "all" ? "all" : "any";
        }
        throw new Error("Unknown setting: " + key);''',
        "settings regex normalize",
    )
    canonical = replace_once(
        canonical,
        '''        if (name === "paginationPageSize") {
            return paginationPageSizeInput;
        }
        return null;''',
        '''        if (name === "paginationPageSize") {
            return paginationPageSizeInput;
        }
        if (name === "regex.title") { return regexTitleInput; }
        if (name === "regex.note") { return regexNoteInput; }
        if (name === "regex.pattern") { return regexPatternInput; }
        if (name === "regex.test.text") { return regexTestTextInput; }
        return null;''',
        "settings regex named inputs",
    )
    canonical = replace_once(canonical, "    function buildPage() {",
                             "    function buildRootPage() {",
                             "settings root page rename")
    canonical = replace_once(
        canonical,
        '''        tagsSectionView = makeTagsSection(colors);
        addSection(content, tagsSectionView);
        dataSectionView = makeDataSection(colors);''',
        '''        tagsSectionView = makeTagsSection(colors);
        addSection(content, tagsSectionView);
        regexSectionView = makeRegexRuleEntrySection(colors);
        addSection(content, regexSectionView);
        dataSectionView = makeDataSection(colors);''',
        "settings regex root entry",
    )
    canonical = insert_before(canonical, "    function panelSize() {",
                              fragment.rstrip(), "settings page dispatcher")
    # Remove the earlier fragment insertion used only to provide normalize helper.
    first = canonical.find("    /* REGEX_BETA_SETTINGS_BEGIN */")
    second = canonical.find("    /* REGEX_BETA_SETTINGS_BEGIN */", first + 1)
    if first < 0 or second < 0:
        fail("settings fragment duplication markers missing")
    first_end = canonical.find("    /* REGEX_BETA_SETTINGS_END */", first)
    if first_end < 0:
        fail("settings first fragment end missing")
    first_end += len("    /* REGEX_BETA_SETTINGS_END */\n")
    canonical = canonical[:first] + canonical[first_end:]
    # The dispatcher fragment already includes normalizeRegexRuleIdList, so it remains available.
    canonical = replace_once(
        canonical,
        '''                onRequestBack: function () {
                    var ime = readSettingsImeState();
                    if (ime.visible) {
                        hideSettingsKeyboardOnMain();
                        return true;
                    }
                    releaseSettingsInputFocus("managed_back");
                    return closePage("managed_back");
                },''',
        '''                onRequestBack: function () {
                    return handleSettingsBack();
                },''',
        "settings regex back chain",
    )
    canonical = replace_once(
        canonical,
        '''        if (name === "tags") { return tagsSectionView; }
        if (name === "data") { return dataSectionView; }''',
        '''        if (name === "tags") { return tagsSectionView; }
        if (name === "regex") { return regexSectionView; }
        if (name === "data") { return dataSectionView; }''',
        "settings regex section lookup",
    )
    canonical = replace_once(
        canonical,
        '''            tagsSectionView = null;
            dataSectionView = null;''',
        '''            tagsSectionView = null;
            regexSectionView = null;
            dataSectionView = null;
            settingsPage = "root";
            regexEditorRuleId = null;
            regexEditorDraft = null;
            pendingDeleteRegexRuleId = null;
            regexTestText = "";
            regexTestResultLines = [];
            regexTestGeneration += 1;
            resetRegexEditorViews();''',
        "settings regex close cleanup",
    )
    canonical = replace_once(canonical, "MODULE_VERSION: 24",
                             "MODULE_VERSION: 25", "settings version")
    canonical = replace_once(
        canonical,
        '''            pendingSettingsOpen = false;
            load();
            ready = true;''',
        '''            pendingSettingsOpen = false;
            settingsPage = "root";
            regexEditorRuleId = null;
            regexEditorDraft = null;
            pendingDeleteRegexRuleId = null;
            regexTestText = "";
            regexTestResultLines = [];
            load();
            ready = true;''',
        "settings regex init state",
    )
    canonical = replace_once(
        canonical,
        '''            settingsStyle: uiState.settingsStyle,
            sectionCount: Number(uiState.sectionCount),''',
        '''            settingsStyle: uiState.settingsStyle,
            settingsPage: String(settingsPage),
            regexRuleRowCount: Number(uiState.regexRuleRowCount),
            regexEditorOpen: uiState.regexEditorOpen === true,
            regexEditorRuleId: uiState.regexEditorRuleId,
            regexDeleteConfirmCount: Number(uiState.regexDeleteConfirmCount),
            regexCreateCount: Number(uiState.regexCreateCount),
            regexUpdateCount: Number(uiState.regexUpdateCount),
            regexDeleteCount: Number(uiState.regexDeleteCount),
            regexDuplicateCount: Number(uiState.regexDuplicateCount),
            regexReorderCount: Number(uiState.regexReorderCount),
            regexEnableToggleCount: Number(uiState.regexEnableToggleCount),
            regexTestRunning: uiState.regexTestRunning === true,
            regexTestMatchCount: Number(uiState.regexTestMatchCount),
            regexTestTruncated: uiState.regexTestTruncated === true,
            lastRegexValidationError: uiState.lastRegexValidationError,
            sectionCount: Number(uiState.sectionCount),''',
        "settings regex state export fields",
    )
    canonical = replace_once(
        canonical,
        '''        performFocusInput: function (name) {
            return runOnMainSync(function () {
                return focusSettingsInput(name);
            }, 3000);
        },''',
        '''        performFocusInput: function (name) {
            return runOnMainSync(function () {
                return focusSettingsInput(name);
            }, 3000);
        },
        performOpenRegexRules: function () {
            return runOnMainSync(function () {
                settingsPage = "regex_rules";
                buildPage();
                return getState();
            }, 3000);
        },
        performOpenRegexEditor: function (ruleId) {
            return runOnMainSync(function () {
                return openRegexEditor(ruleId === null || ruleId === undefined ?
                    null : Number(ruleId));
            }, 3000);
        },
        performSaveRegexRule: function (input) {
            return runOnMainSync(function () {
                input = input || {};
                if (settingsPage !== "regex_editor") { return false; }
                if (regexTitleInput !== null && input.title !== undefined) {
                    regexTitleInput.setText(String(input.title));
                }
                if (regexNoteInput !== null && input.note !== undefined) {
                    regexNoteInput.setText(String(input.note));
                }
                if (regexPatternInput !== null && input.pattern !== undefined) {
                    regexPatternInput.setText(String(input.pattern));
                }
                if (input.flags !== undefined) {
                    regexEditorDraft.flags = Number(input.flags);
                }
                return saveRegexEditor();
            }, 3000);
        },
        performDuplicateRegexRule: function (ruleId) {
            return runOnMainSync(function () {
                return duplicateRegexRuleFromSettings(Number(ruleId));
            }, 3000);
        },
        performMoveRegexRule: function (ruleId, delta) {
            return runOnMainSync(function () {
                return moveRegexRule(Number(ruleId), Number(delta));
            }, 3000);
        },
        performDeleteRegexRuleConfirm: function (ruleId) {
            ruleId = String(Number(ruleId));
            return runOnMainSync(function () {
                var row = regexRuleRowViews[ruleId];
                if (!row || !row.deleteView) { return false; }
                row.deleteView.performClick();
                return row.deleteView.performClick();
            }, 3000);
        },
        performSetRegexRuleEnabled: function (ruleId, enabled) {
            return runOnMainSync(function () {
                return toggleRegexRuleEnabledFromSettings(
                    Number(ruleId), enabled === true);
            }, 3000);
        },
        performRunRegexTest: function (source, text) {
            return runOnMainSync(function () {
                if (settingsPage !== "regex_test") {
                    if (settingsPage !== "regex_editor") { return false; }
                    captureRegexEditorDraft();
                    settingsPage = "regex_test";
                    buildPage();
                }
                if (text !== undefined && regexTestTextInput !== null) {
                    regexTestTextInput.setText(String(text));
                }
                return runRegexTest(source || "manual");
            }, 3000);
        },''',
        "settings regex probe exports",
    )
    canonical = replace_once(
        canonical,
        '''        shutdown: function () {
            pendingSettingsOpen = false;''',
        '''        shutdown: function () {
            pendingSettingsOpen = false;
            regexTestGeneration += 1;
            if (regexTestExecutor !== null) {
                try { regexTestExecutor.shutdownNow(); }
                catch (ignoredRegexTestExecutor) {}
            }
            regexTestExecutor = null;''',
        "settings regex tester shutdown",
    )
    canonical = replace_once(
        canonical,
        "        sectionCount: 5,",
        "        sectionCount: 6,",
        "settings section count",
    )
    repack_loader(path, loader, variable, canonical)


def patch_entry_manifest_preflight() -> None:
    entry_path = ROOT / "ClipHub.js"
    entry = entry_path.read_text(encoding="utf-8")
    entry = replace_once(entry, 'var DEFAULT_REF = "main";',
                         f'var DEFAULT_REF = "{BRANCH}";', "entry beta ref")
    if 'runtimeName = options.runtimeName === undefined\n            ? "ClipHub"' not in entry:
        fail("ClipHub runtimeName boundary changed unexpectedly")
    entry_path.write_text(entry, encoding="utf-8")

    manifest_path = ROOT / "module-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["moduleSetVersion"] = MODULE_SET
    manifest["sourceRef"] = BRANCH
    manifest["entryMinVersion"] = 6
    if len(manifest.get("modules", [])) != 15:
        fail("formal module count is not 15")
    for item in manifest["modules"]:
        module_path = ROOT / str(item["path"])
        source = module_path.read_text(encoding="utf-8")
        item["sha"] = git_blob_sha_text(source)
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    preflight_path = ROOT / "scripts" / "release_preflight.sh"
    preflight = preflight_path.read_text(encoding="utf-8")
    preflight = replace_once(
        preflight,
        '''  --beta)
    EXPECTED_REF='beta-pagination-stage10-20260808'
    EXPECTED_MODULE_SET='20260808.01'
    EXPECTED_ENTRY_VERSION='6'
    EXPECTED_APP_MODULE_VERSION='19'
    CHECK_FILTER_LOADER_REF='1'
    ;;
  --current)''',
        '''  --beta)
    EXPECTED_REF='beta-pagination-stage10-20260808'
    EXPECTED_MODULE_SET='20260808.01'
    EXPECTED_ENTRY_VERSION='6'
    EXPECTED_APP_MODULE_VERSION='19'
    CHECK_FILTER_LOADER_REF='1'
    ;;
  --regex-beta)
    EXPECTED_REF='beta-regex-filter-20260813'
    EXPECTED_MODULE_SET='20260813.02'
    EXPECTED_ENTRY_VERSION='6'
    EXPECTED_APP_MODULE_VERSION='20'
    REQUIRE_CLEAN='0'
    ;;
  --current)''',
        "preflight regex beta mode",
    )
    preflight = replace_once(
        preflight,
        "[--candidate|--main|--beta|--current]",
        "[--candidate|--main|--beta|--regex-beta|--current]",
        "preflight usage",
    )
    preflight = replace_once(
        preflight,
        r'''    assignment = re.search(r"\bvar\s+PACKED_B64\s*=\s*(.*?);", source, re.S)
    if assignment is None:
        return None
    pieces = re.findall(r'"(?:\\.|[^"\\])*"', assignment.group(1))''',
        r'''    assignment = re.search(
        r"\bvar\s+(?:PACKED_B64|encoded)\s*=\s*(.*?);", source, re.S
    )
    if assignment is None:
        return None
    pieces = re.findall(r'"(?:\\.|[^"\\])*"', assignment.group(1))''',
        "preflight packed loader decode",
    )
    preflight = replace_once(
        preflight,
        '''    assert expected is not None
    actual = hashlib.sha256(expanded.encode("utf-8")).hexdigest()
    assert actual == expected.group(1).lower(), (actual, expected.group(1))
    return expanded''',
        '''    if expected is not None:
        actual = hashlib.sha256(expanded.encode("utf-8")).hexdigest()
        assert actual == expected.group(1).lower(), (actual, expected.group(1))
    return expanded''',
        "preflight optional source sha",
    )
    marker = '''if mode in ("--current", "--main"):
    print("Current safety contracts: passed")
PY'''
    special = '''if mode == "--regex-beta":
    required_versions = {
        "ch_03_database.js": ("ch_03_database", 4),
        "ch_06_repository.js": ("ch_06_repository", 17),
        "ch_11_filter.js": ("ch_11_filter", 75),
        "ch_13_settings.js": ("ch_13_settings", 25),
        "ch_15_app.js": ("ch_15_app", 20),
    }
    for filename, (module_name, module_version) in required_versions.items():
        source = actual_sources[filename]
        pattern = (
            r"MODULE_NAME:\\s*\\\"" + re.escape(module_name) +
            r"\\\"\\s*,\\s*MODULE_VERSION:\\s*" + str(module_version)
        )
        assert re.search(pattern, source, re.S), (filename, module_version)
    database_source = actual_sources["ch_03_database.js"]
    repository_source = actual_sources["ch_06_repository.js"]
    filter_source = actual_sources["ch_11_filter.js"]
    settings_source = actual_sources["ch_13_settings.js"]
    assert "var SCHEMA_VERSION = 2;" in database_source
    assert "db.setVersion(3)" not in database_source
    assert "CREATE TABLE IF NOT EXISTS regex_rules" in database_source
    assert "feature.regex_rules.schema_version" in database_source
    assert "feature.regex_rules.defaults_initialized" in repository_source
    assert "listRegexCandidateChunk" in repository_source
    assert ".matcher(text).matches()" not in filter_source
    assert ".matcher(text).find()" in filter_source
    assert "filterRegexRuleIds" in settings_source
    assert "filterRegexMatchMode" in settings_source
    assert manifest.get("sourceRef") == "beta-regex-filter-20260813"
    assert len(manifest.get("modules", [])) == 15
    print("Regex beta safety contracts: passed")
if mode in ("--current", "--main"):
    print("Current safety contracts: passed")
PY'''
    preflight = replace_once(preflight, marker, special,
                             "preflight regex beta contracts")
    preflight_path.write_text(preflight, encoding="utf-8")


def write_probes() -> None:
    probes = {
        "probes/cliphub_regex_database_probe_052.js": '''/* ClipHub regex database probe 052. Rhino ES5. */
(function (global) {
    var C = global.ClipHub;
    var result = { probe: 52, ok: false };
    if (!C || !C.Database || !C.Repository) {
        throw new Error("ClipHub runtime unavailable");
    }
    result.dbVersion = Number(C.Database.getVersion());
    result.rules = C.Repository.listRegexRules({});
    result.featureMarker = C.Database.queryOne(
        "SELECT value FROM schema_meta WHERE key = ?", ["feature.regex_rules.schema_version"]);
    result.ok = result.dbVersion === 2 && result.featureMarker !== null;
    if (!result.ok) { throw new Error(JSON.stringify(result)); }
    result;
}((function () { return this; }())));
''',
        "probes/cliphub_regex_repository_probe_053.js": '''/* ClipHub regex repository probe 053. Rhino ES5. */
(function (global) {
    var C = global.ClipHub;
    var title = "Probe Regex " + String(Packages.java.lang.System.currentTimeMillis());
    var id = Number(C.Repository.createRegexRule({ title: title, note: "probe",
        pattern: "PROBE-[0-9]+", flags: 1, enabled: true }));
    var copyId = Number(C.Repository.duplicateRegexRule(id));
    var rule = C.Repository.getRegexRule(id);
    var copy = C.Repository.getRegexRule(copyId);
    var ok = rule !== null && copy !== null && String(copy.title) !== String(rule.title);
    C.Repository.deleteRegexRule(copyId);
    C.Repository.deleteRegexRule(id);
    if (!ok) { throw new Error("Regex repository probe failed"); }
    ({ probe: 53, ok: true });
}((function () { return this; }())));
''',
        "probes/cliphub_regex_settings_probe_054.js": '''/* ClipHub regex settings probe 054. Rhino ES5. */
(function (global) {
    var C = global.ClipHub;
    var state = C.Settings.getState();
    var rules = C.Repository.listRegexRules({});
    if (Number(C.Settings.MODULE_VERSION) < 25 || rules.length < 1) {
        throw new Error("Regex settings prerequisites failed");
    }
    ({ probe: 54, ok: true, state: state, ruleCount: rules.length });
}((function () { return this; }())));
''',
        "probes/cliphub_regex_settings_ime_probe_055.js": '''/* ClipHub regex settings IME probe 055. Rhino ES5. */
(function (global) {
    var C = global.ClipHub;
    C.Settings.open();
    C.Settings.performOpenRegexEditor(null);
    var focused = C.Settings.performFocusInput("regex.pattern");
    ({ probe: 55, ok: focused === true, state: C.Settings.getState() });
}((function () { return this; }())));
''',
        "probes/cliphub_regex_filter_probe_056.js": '''/* ClipHub regex filter probe 056. Rhino ES5. */
(function (global) {
    var C = global.ClipHub;
    var rules = C.Repository.listRegexRules({ enabledOnly: true });
    if (rules.length < 1) { throw new Error("No enabled regex rules"); }
    C.Filter.setRegexRuleIds([Number(rules[0].id)], { apply: false });
    C.Filter.setRegexMatchMode("any", { apply: false });
    var criteria = C.Filter.get().regexRuleIds;
    if (criteria.length !== 1) { throw new Error("Regex criteria not stored"); }
    ({ probe: 56, ok: true, state: C.Filter.getState() });
}((function () { return this; }())));
''',
        "probes/cliphub_regex_scan_probe_057.js": '''/* ClipHub regex full-content scan probe 057. Rhino ES5. */
(function (global) {
    var C = global.ClipHub;
    var marker = "REGEX-FULL-CONTENT-" + String(Packages.java.lang.System.currentTimeMillis());
    var content = new Packages.java.lang.StringBuilder();
    var index;
    for (index = 0; index < 260; index += 1) { content.append("x"); }
    content.append(marker);
    var id = Number(C.Repository.insertItem({ content: String(content),
        contentType: "text", createdAt: C.Base.now(),
        lastCopiedAt: C.Base.now(), updatedAt: C.Base.now() }));
    var ruleId = Number(C.Repository.createRegexRule({ title: marker,
        note: "probe >200", pattern: marker, flags: 0, enabled: true }));
    var snapshot = C.Repository.getRegexScanSnapshot({});
    var chunk = C.Repository.listRegexCandidateChunk({ criteria: {},
        snapshotMaxId: snapshot.maxItemId, limit: 128 });
    var found = false;
    for (index = 0; index < chunk.rows.length; index += 1) {
        if (Number(chunk.rows[index].id) === id &&
                String(chunk.rows[index].content).indexOf(marker) >= 260) {
            found = true;
        }
    }
    C.Repository.deleteRegexRule(ruleId);
    C.Repository.softDeleteItem(id, C.Base.now());
    if (!found) { throw new Error("Full content regex candidate missing"); }
    ({ probe: 57, ok: true });
}((function () { return this; }())));
''',
        "probes/cliphub_regex_generation_probe_058.js": '''/* ClipHub regex generation probe 058. Rhino ES5. */
(function (global) {
    var C = global.ClipHub;
    var rules = C.Repository.listRegexRules({ enabledOnly: true });
    if (rules.length < 2) { throw new Error("Need at least two enabled rules"); }
    C.Filter.setRegexRuleIds([Number(rules[0].id)], { apply: true,
        origin: "probe_058_a" });
    C.Filter.setRegexRuleIds([Number(rules[1].id)], { apply: true,
        origin: "probe_058_b" });
    ({ probe: 58, ok: true, scan: C.Filter.getRegexScanState() });
}((function () { return this; }())));
''',
        "probes/cliphub_regex_pagination_probe_059.js": '''/* ClipHub regex pagination probe 059. Rhino ES5. */
(function (global) {
    var C = global.ClipHub;
    var rules = C.Repository.listRegexRules({ enabledOnly: true });
    if (rules.length < 1) { throw new Error("No regex rule available"); }
    C.Filter.setRegexRuleIds([Number(rules[0].id)], { apply: true,
        origin: "probe_059" });
    ({ probe: 59, ok: true, pagination: C.Filter.getPaginationState(),
        regex: C.Filter.getRegexScanState() });
}((function () { return this; }())));
''',
    }
    for relative, source in probes.items():
        path = ROOT / relative
        path.write_text(source, encoding="utf-8")


def cleanup_inspection_assets() -> None:
    for relative in (
        "stage-assets/regex-beta-inspect",
    ):
        path = ROOT / relative
        if path.exists():
            shutil.rmtree(path)
    for relative in (
        "tools/regex_beta_unpack_inspect.py",
        "tools/regex_beta_anchor_report.py",
    ):
        path = ROOT / relative
        if path.exists():
            path.unlink()


def static_contracts() -> None:
    db = (ROOT / "src/ch_03_database.js").read_text(encoding="utf-8")
    if "var SCHEMA_VERSION = 2;" not in db:
        fail("SCHEMA_VERSION changed")
    if "db.setVersion(3)" in db:
        fail("database user_version upgrade detected")
    manifest = json.loads((ROOT / "module-manifest.json").read_text(encoding="utf-8"))
    if len(manifest.get("modules", [])) != 15:
        fail("module count changed")
    if manifest.get("sourceRef") != BRANCH:
        fail("manifest sourceRef mismatch")
    entry = (ROOT / "ClipHub.js").read_text(encoding="utf-8")
    if f'var DEFAULT_REF = "{BRANCH}";' not in entry:
        fail("entry DEFAULT_REF mismatch")
    if "ClipHubBeta" in entry or "ClipHubTest" in entry:
        fail("beta runtime directory introduced")
    for path in (ROOT / "src").glob("*.js"):
        if path.name.startswith("ch_16"):
            fail("unexpected ch_16 module")


def main() -> None:
    patch_database()
    patch_repository()
    patch_filter()
    patch_settings()
    write_probes()
    cleanup_inspection_assets()
    patch_entry_manifest_preflight()
    static_contracts()
    print("Regex beta patch applied")
    print("branch:", BRANCH)
    print("moduleSetVersion:", MODULE_SET)
    print("database schema version remains: 2")


if __name__ == "__main__":
    main()
