#!/usr/bin/env python3
from pathlib import Path
import json
import re
import subprocess

TARGET = Path("src/ch_11_filter.js")
MANIFEST = Path("module-manifest.json")

text = TARGET.read_text(encoding="utf-8")


def replace_once(source, old, new, label):
    count = source.count(old)
    if count != 1:
        raise SystemExit("%s replacement expected 1 match, found %d" % (label, count))
    return source.replace(old, new, 1)


text = replace_once(
    text,
    "    var adaptiveRenderGeneration = 0;\n",
    '''    var adaptiveRenderGeneration = 0;
    var searchExpanded = false;
    var searchStatusRow = null;
    var searchInputRow = null;
    var searchToggleView = null;
    var searchClearView = null;
    var historyContainerView = null;
''',
    "header state variables"
)

text = replace_once(
    text,
    "        realtimeSearchCount: 0,\n",
    '''        realtimeSearchCount: 0,
        searchExpanded: false,
        searchExpandCount: 0,
        searchCollapseCount: 0,
        headerHeightDp: 0,
        headerControlHeightDp: 0,
        headerActionSizeDp: 0,
        headerGapDp: 0,
        headerFilterActiveCount: 0,
''',
    "header state metrics"
)

new_header_block = r'''    function activeAdvancedFilterCount() {
        var count = 0;
        if (value === null || value === undefined) { return 0; }
        if (value.sourcePackages && value.sourcePackages.length > 0) {
            count += 1;
        }
        if (value.contentTypes && value.contentTypes.length > 0) {
            count += 1;
        }
        if (value.tagIds && value.tagIds.length > 0) {
            count += 1;
        }
        if (value.pinnedOnly === true) { count += 1; }
        if (String(value.sensitiveMode || "all") !== "all") {
            count += 1;
        }
        if (validateSortMode(value.sortMode) !== "latest") {
            count += 1;
        }
        return count;
    }

    function headerMetrics() {
        var widthDp = Number(state.panelWidthDp || 0);
        var fontScale = resourceFontScale();
        var touchDp = Math.max(1, Number(touchSlop || 1) / density);
        var baseDp;
        var actionSizeDp;
        var controlHeightDp;
        var gapDp;
        var titleSp;
        var iconSp;
        var statusSp;
        var searchSp;
        var radiusDp;
        var inputPaddingDp;
        var badgeSizeDp;
        var badgeSp;
        if (widthDp <= 0 && Number(state.panelWidthPx || 0) > 0) {
            widthDp = Number(state.panelWidthPx) / density;
        }
        if (widthDp <= 0) {
            widthDp = Number(appContext.getResources()
                .getDisplayMetrics().widthPixels) / density;
        }
        baseDp = Math.max(touchDp, widthDp * 0.018);
        actionSizeDp = clampNumber(widthDp * 0.092,
            baseDp * 4.4, widthDp * 0.12);
        controlHeightDp = clampNumber(actionSizeDp * 1.02,
            baseDp * 4.6, widthDp * 0.125);
        gapDp = clampNumber(widthDp * 0.014,
            baseDp * 0.65, actionSizeDp * 0.24);
        titleSp = clampNumber(widthDp / (fontScale * 23),
            actionSizeDp / (fontScale * 2.45),
            actionSizeDp / (fontScale * 1.85));
        iconSp = clampNumber(actionSizeDp / (fontScale * 2.05),
            titleSp * 0.86, titleSp * 1.18);
        statusSp = clampNumber(titleSp * 0.60,
            iconSp * 0.58, titleSp * 0.72);
        searchSp = clampNumber(titleSp * 0.70,
            statusSp, titleSp * 0.82);
        radiusDp = Math.max(baseDp * 1.3, controlHeightDp * 0.44);
        inputPaddingDp = Math.max(baseDp * 0.65, gapDp);
        badgeSizeDp = Math.max(baseDp * 2.0, actionSizeDp * 0.38);
        badgeSp = Math.max(statusSp * 0.64,
            badgeSizeDp / (fontScale * 3.4));
        state.headerHeightDp = actionSizeDp + gapDp + controlHeightDp;
        state.headerControlHeightDp = controlHeightDp;
        state.headerActionSizeDp = actionSizeDp;
        state.headerGapDp = gapDp;
        return {
            widthDp: widthDp,
            fontScale: fontScale,
            baseDp: baseDp,
            actionSizeDp: actionSizeDp,
            controlHeightDp: controlHeightDp,
            gapDp: gapDp,
            titleSp: titleSp,
            iconSp: iconSp,
            statusSp: statusSp,
            searchSp: searchSp,
            radiusDp: radiusDp,
            inputPaddingDp: inputPaddingDp,
            badgeSizeDp: badgeSizeDp,
            badgeSp: badgeSp
        };
    }

    function makeHeaderAction(iconText, description, colors, metrics,
            emphasized) {
        var view = makeIcon(iconText, metrics.iconSp,
            emphasized ? colors.accentStrong : colors.icon,
            description);
        view.setBackground(circleBackground(
            emphasized ? colors.accentSoft : colors.surfaceMuted,
            null));
        return view;
    }

    function makeFilterAction(colors, metrics) {
        var activeCount = activeAdvancedFilterCount();
        var root = new FrameLayout(appContext);
        var icon = makeIcon("☷", metrics.iconSp,
            activeCount > 0 ? colors.accentStrong : colors.icon,
            activeCount > 0 ?
                "打开筛选，已启用 " + String(activeCount) + " 类条件" :
                "打开筛选");
        var badge;
        var params;
        root.setClickable(true);
        root.setFocusable(true);
        root.setContentDescription(activeCount > 0 ?
            "打开筛选，已启用 " + String(activeCount) + " 类条件" :
            "打开筛选");
        root.setBackground(circleBackground(
            activeCount > 0 ? colors.accentSoft : colors.surfaceMuted,
            activeCount > 0 ? colors.accentBorder : null));
        root.addView(icon, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT));
        if (activeCount > 0) {
            badge = makeText(String(Math.min(9, activeCount)),
                metrics.badgeSp, "#FFFFFFFF", true);
            badge.setGravity(Gravity.CENTER);
            badge.setBackground(circleBackground(colors.accentStrong, null));
            params = new FrameLayout.LayoutParams(
                dp(metrics.badgeSizeDp), dp(metrics.badgeSizeDp));
            params.gravity = Gravity.TOP | Gravity.END;
            root.addView(badge, params);
        }
        root.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () { toggleAdvanced(); }
            }));
        state.headerFilterActiveCount = activeCount;
        return root;
    }

    function updateSearchVisibility(requestKeyboard) {
        var showInput = searchExpanded && !advancedVisible;
        if (searchStatusRow !== null) {
            searchStatusRow.setVisibility(
                showInput ? View.GONE : View.VISIBLE);
        }
        if (searchInputRow !== null) {
            searchInputRow.setVisibility(
                showInput ? View.VISIBLE : View.GONE);
        }
        if (historyContainerView !== null) {
            historyContainerView.setVisibility(
                showInput ? View.VISIBLE : View.GONE);
        }
        state.searchExpanded = searchExpanded === true;
        if (showInput && requestKeyboard === true) {
            requestKeyboardOnMain();
        } else if (!showInput) {
            hideKeyboardOnMain();
        }
        return showInput;
    }

    function setSearchExpanded(expanded, requestKeyboard) {
        var next = expanded === true;
        if (next && advancedVisible) {
            advancedVisible = false;
            state.advancedDrawerVisible = false;
            state.advancedCloseCount += 1;
            searchExpanded = true;
            state.searchExpandCount += 1;
            buildPanelContent(requestKeyboard === true);
            return true;
        }
        if (searchExpanded !== next) {
            if (next) {
                state.searchExpandCount += 1;
            } else {
                state.searchCollapseCount += 1;
            }
        }
        searchExpanded = next;
        updateSearchVisibility(requestKeyboard === true);
        return true;
    }

    function buildSearchHeader(colors) {
        var container = new LinearLayout(appContext);
        var titleRow = new LinearLayout(appContext);
        var title;
        var statusRow = new LinearLayout(appContext);
        var inputRow = new LinearLayout(appContext);
        var sort;
        var statusFilter;
        var inputFilter;
        var addButton;
        var params;
        var metrics = headerMetrics();

        container.setOrientation(LinearLayout.VERTICAL);
        titleRow.setOrientation(LinearLayout.HORIZONTAL);
        titleRow.setGravity(Gravity.CENTER_VERTICAL);
        title = makeText("全局剪切板", metrics.titleSp,
            colors.textPrimary, true);
        title.setSingleLine(true);
        title.setEllipsize(TextUtils.TruncateAt.END);
        titleRow.addView(title, new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        addButton = makeHeaderAction("+", "新增剪切板内容",
            colors, metrics, true);
        addButton.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () { addNewResult(); }
            }));
        params = new LinearLayout.LayoutParams(
            dp(metrics.actionSizeDp), dp(metrics.actionSizeDp));
        params.leftMargin = dp(metrics.gapDp);
        titleRow.addView(addButton, params);

        settingsButton = makeHeaderAction("⚙", "打开 ClipHub 设置",
            colors, metrics, false);
        settingsButton.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () {
                    try {
                        if (ClipHub.Settings && ClipHub.Settings.open) {
                            state.settingsOpenCount += 1;
                            ClipHub.Settings.open();
                        }
                    } catch (error) {
                        state.lastError = String(error);
                    }
                }
            }));
        params = new LinearLayout.LayoutParams(
            dp(metrics.actionSizeDp), dp(metrics.actionSizeDp));
        params.leftMargin = dp(metrics.gapDp);
        titleRow.addView(settingsButton, params);
        state.settingsButtonPresent = true;

        closeView = makeHeaderAction("×", "关闭全局剪切板",
            colors, metrics, false);
        closeView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () {
                    closePanel({
                        reason: "button",
                        restoreList: rootMode ? false : true
                    });
                }
            }));
        params = new LinearLayout.LayoutParams(
            dp(metrics.actionSizeDp), dp(metrics.actionSizeDp));
        params.leftMargin = dp(metrics.gapDp);
        titleRow.addView(closeView, params);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dp(metrics.actionSizeDp));
        params.bottomMargin = dp(metrics.gapDp);
        container.addView(titleRow, params);

        statusRow.setOrientation(LinearLayout.HORIZONTAL);
        statusRow.setGravity(Gravity.CENTER_VERTICAL);
        resultCountView = makeText("", metrics.statusSp,
            colors.textSecondary, false);
        resultCountView.setSingleLine(true);
        updateResultCountOnMain();
        statusRow.addView(resultCountView,
            new LinearLayout.LayoutParams(
                0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        sort = makeText("按" + sortModeLabel(value.sortMode),
            metrics.statusSp, colors.textSecondary, false);
        sort.setSingleLine(true);
        sort.setEllipsize(TextUtils.TruncateAt.END);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.leftMargin = dp(metrics.gapDp);
        statusRow.addView(sort, params);

        searchToggleView = makeHeaderAction("⌕", "展开搜索",
            colors, metrics, false);
        searchToggleView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () {
                    setSearchExpanded(true, true);
                }
            }));
        searchView = searchToggleView;
        params = new LinearLayout.LayoutParams(
            dp(metrics.actionSizeDp), dp(metrics.actionSizeDp));
        params.leftMargin = dp(metrics.gapDp);
        statusRow.addView(searchToggleView, params);

        statusFilter = makeFilterAction(colors, metrics);
        advancedView = statusFilter;
        params = new LinearLayout.LayoutParams(
            dp(metrics.actionSizeDp), dp(metrics.actionSizeDp));
        params.leftMargin = dp(metrics.gapDp);
        statusRow.addView(statusFilter, params);
        searchStatusRow = statusRow;
        container.addView(statusRow,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(metrics.controlHeightDp)));

        inputRow.setOrientation(LinearLayout.HORIZONTAL);
        inputRow.setGravity(Gravity.CENTER_VERTICAL);
        keywordInput = new EditText(appContext);
        keywordInput.setSingleLine(true);
        suppressTextWatcher = true;
        keywordInput.setText(String(value.keyword || ""));
        keywordInput.setSelection(keywordInput.getText().length());
        suppressTextWatcher = false;
        keywordInput.setHint("搜索剪切板内容");
        keywordInput.setTextSize(TypedValue.COMPLEX_UNIT_SP,
            metrics.searchSp);
        ClipHub.Theme.applyTextColor(keywordInput, colors.textPrimary);
        ClipHub.Theme.applyHintTextColor(keywordInput, colors.textSecondary);
        keywordInput.setInputType(InputType.TYPE_CLASS_TEXT |
            InputType.TYPE_TEXT_FLAG_CAP_SENTENCES);
        keywordInput.setImeOptions(EditorInfo.IME_ACTION_SEARCH);
        keywordInput.setPadding(dp(metrics.inputPaddingDp), 0,
            dp(metrics.inputPaddingDp), 0);
        keywordInput.setBackground(roundedBackground(colors.surface,
            colors.stroke, metrics.radiusDp));
        keywordInput.setOnEditorActionListener(new JavaAdapter(
            TextView.OnEditorActionListener, {
                onEditorAction: function (view, actionId) {
                    if (Number(actionId) ===
                            Number(EditorInfo.IME_ACTION_SEARCH)) {
                        performKeywordFromInput("ui_search_ime");
                        return true;
                    }
                    return false;
                }
            }));
        keywordInput.addTextChangedListener(new JavaAdapter(TextWatcher, {
            beforeTextChanged: function () {},
            onTextChanged: function (text) {
                if (!suppressTextWatcher) {
                    scheduleRealtimeSearch(String(text));
                }
            },
            afterTextChanged: function () {}
        }));
        params = new LinearLayout.LayoutParams(
            0, dp(metrics.controlHeightDp), 1);
        params.rightMargin = dp(metrics.gapDp);
        inputRow.addView(keywordInput, params);

        searchClearView = makeHeaderAction("×",
            "清空搜索；搜索为空时收起搜索框",
            colors, metrics, false);
        searchClearView.setOnClickListener(new JavaAdapter(
            View.OnClickListener, {
                onClick: function () {
                    var current = keywordInput === null ? "" :
                        normalizeText(String(keywordInput.getText()));
                    if (current.length === 0) {
                        setSearchExpanded(false, false);
                        return;
                    }
                    suppressTextWatcher = true;
                    try {
                        keywordInput.setText("");
                        keywordInput.setSelection(0);
                    } finally {
                        suppressTextWatcher = false;
                    }
                    state.searchActionCount += 1;
                    setValue({ keyword: "" }, {
                        origin: "ui_search_clear"
                    });
                    refreshResultsOnMain();
                    updateResultCountOnMain();
                    requestKeyboardOnMain();
                }
            }));
        inputRow.addView(searchClearView,
            new LinearLayout.LayoutParams(
                dp(metrics.actionSizeDp), dp(metrics.actionSizeDp)));

        inputFilter = makeFilterAction(colors, metrics);
        params = new LinearLayout.LayoutParams(
            dp(metrics.actionSizeDp), dp(metrics.actionSizeDp));
        params.leftMargin = dp(metrics.gapDp);
        inputRow.addView(inputFilter, params);
        searchInputRow = inputRow;
        container.addView(inputRow,
            new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                dp(metrics.controlHeightDp)));

        updateSearchVisibility(false);
        return container;
    }

    function buildResultArea(colors) {
        var root = new LinearLayout(appContext);
        var scroll = new ScrollView(appContext);
        resultScrollView = scroll;
        root.setOrientation(LinearLayout.VERTICAL);
        resultContainer = new LinearLayout(appContext);
        resultContainer.setOrientation(LinearLayout.VERTICAL);
        scroll.setFillViewport(false);
        scroll.setVerticalScrollBarEnabled(false);
        scroll.addView(resultContainer, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT));
        root.addView(scroll, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));
        refreshResultsOnMain();
        if (mainHandler !== null) {
            mainHandler.post(new Packages.java.lang.Runnable({
                run: function () { updateResultScrollState(); }
            }));
        }
        return root;
    }'''

pattern = re.compile(
    r"    function buildSearchHeader\(colors\) \{.*?"
    r"\n    \}\n\n    function buildResultArea\(colors\) \{.*?"
    r"\n    \}\n\n    function makeChoiceChipRow",
    re.S
)
text, count = pattern.subn(
    new_header_block + "\n\n    function makeChoiceChipRow",
    text,
    count=1
)
if count != 1:
    raise SystemExit("header function replacement expected 1 match, found %d" % count)

text = replace_once(
    text,
    "        advancedVisible = !advancedVisible;\n"
    "        state.advancedDrawerVisible = advancedVisible;\n"
    "        if (advancedVisible) {\n"
    "            state.advancedOpenCount += 1;\n"
    "            hideKeyboardOnMain();\n",
    '''        advancedVisible = !advancedVisible;
        state.advancedDrawerVisible = advancedVisible;
        if (advancedVisible) {
            if (searchExpanded) {
                searchExpanded = false;
                state.searchCollapseCount += 1;
            }
            state.advancedOpenCount += 1;
            hideKeyboardOnMain();
''',
    "advanced search collapse"
)

text = replace_once(
    text,
    "        resultBodyFrame = null;\n"
    "        deleteUndoView = null;\n",
    '''        resultBodyFrame = null;
        searchStatusRow = null;
        searchInputRow = null;
        searchToggleView = null;
        searchClearView = null;
        historyContainerView = null;
        deleteUndoView = null;
''',
    "panel rebuild view reset"
)

old_history = '''        if (searchHistory.length > 0 && !advancedVisible) {
            history = buildHistoryRow(colors);
            params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
            params.bottomMargin = dp(5);
            panelRoot.addView(history, params);
        } else {
            state.historyChipCount = 0;
        }
'''
new_history = '''        if (searchHistory.length > 0 && !advancedVisible) {
            history = buildHistoryRow(colors);
            historyContainerView = history;
            history.setVisibility(searchExpanded ?
                View.VISIBLE : View.GONE);
            params = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
            params.bottomMargin = dp(headerMetrics().gapDp);
            panelRoot.addView(history, params);
        } else {
            historyContainerView = null;
            state.historyChipCount = 0;
        }
'''
text = replace_once(text, old_history, new_history, "history visibility")

text = replace_once(
    text,
    "        if (requestFocus && !advancedVisible) {\n"
    "            requestKeyboardOnMain();\n"
    "        }\n",
    '''        if (requestFocus && !advancedVisible && searchExpanded) {
            requestKeyboardOnMain();
        }
''',
    "focus only expanded search"
)

text = replace_once(
    text,
    "        advancedVisible = options.showAdvanced === true;\n"
    "        state.advancedDrawerVisible = advancedVisible;\n",
    '''        advancedVisible = options.showAdvanced === true;
        searchExpanded = options.requestKeyboard === true &&
            !advancedVisible;
        state.searchExpanded = searchExpanded;
        state.advancedDrawerVisible = advancedVisible;
''',
    "initial search expansion"
)

text = replace_once(
    text,
    "                keywordInput = null;\n"
    "                advancedKeywordInput = null;\n"
    "                searchView = null;\n",
    '''                keywordInput = null;
                advancedKeywordInput = null;
                searchView = null;
                searchStatusRow = null;
                searchInputRow = null;
                searchToggleView = null;
                searchClearView = null;
                historyContainerView = null;
''',
    "close panel header cleanup"
)

text = replace_once(
    text,
    "        rootMode = false;\n"
    "        state.rootMode = false;\n"
    "        state.primarySurface = \"filter_overlay\";\n"
    "        restoreListOnClose = false;\n",
    '''        rootMode = false;
        searchExpanded = false;
        state.searchExpanded = false;
        state.rootMode = false;
        state.primarySurface = "filter_overlay";
        restoreListOnClose = false;
''',
    "close panel search reset"
)

old_back = '''        if (advancedVisible) {
            advancedVisible = false;
            state.advancedDrawerVisible = false;
            state.advancedCloseCount += 1;
            state.backLayerCloseCount += 1;
            state.lastBackLayer = "advanced_drawer";
            requireMain(runOnMainSync(function () {
                buildPanelContent(false);
                return true;
            }, 2500));
            return true;
        }
        state.backLayerCloseCount += 1;
        state.lastBackLayer = "search_panel";
'''
new_back = '''        if (advancedVisible) {
            advancedVisible = false;
            state.advancedDrawerVisible = false;
            state.advancedCloseCount += 1;
            state.backLayerCloseCount += 1;
            state.lastBackLayer = "advanced_drawer";
            requireMain(runOnMainSync(function () {
                buildPanelContent(false);
                return true;
            }, 2500));
            return true;
        }
        if (searchExpanded) {
            state.backLayerCloseCount += 1;
            state.lastBackLayer = "search_input";
            return setSearchExpanded(false, false);
        }
        state.backLayerCloseCount += 1;
        state.lastBackLayer = "search_panel";
'''
text = replace_once(text, old_back, new_back, "back search layer")

text = replace_once(
    text,
    "            historyChipCount: Number(state.historyChipCount),\n",
    '''            historyChipCount: Number(state.historyChipCount),
            searchExpanded: searchExpanded === true,
            searchExpandCount: Number(state.searchExpandCount),
            searchCollapseCount: Number(state.searchCollapseCount),
            headerHeightDp: Number(state.headerHeightDp),
            headerControlHeightDp:
                Number(state.headerControlHeightDp),
            headerActionSizeDp: Number(state.headerActionSizeDp),
            headerGapDp: Number(state.headerGapDp),
            headerFilterActiveCount:
                Number(state.headerFilterActiveCount),
''',
    "panel state header metrics"
)

text = replace_once(
    text,
    "        state.realtimeSearchCount = 0;\n",
    '''        state.realtimeSearchCount = 0;
        state.searchExpanded = false;
        state.searchExpandCount = 0;
        state.searchCollapseCount = 0;
        state.headerHeightDp = 0;
        state.headerControlHeightDp = 0;
        state.headerActionSizeDp = 0;
        state.headerGapDp = 0;
        state.headerFilterActiveCount = 0;
''',
    "state reset header metrics"
)

text = replace_once(
    text,
    '        state.searchPageStyle = "reference_search_v11";\n',
    '        state.searchPageStyle = "reference_search_v12_compact_header";\n',
    "search page style"
)

text = replace_once(
    text,
    "        MODULE_VERSION: 26,\n",
    "        MODULE_VERSION: 27,\n",
    "module version"
)

text = replace_once(
    text,
    "            adaptiveRenderGeneration = 0;\n"
    "            resetResultPaging();\n",
    '''            adaptiveRenderGeneration = 0;
            searchExpanded = false;
            searchStatusRow = null;
            searchInputRow = null;
            searchToggleView = null;
            searchClearView = null;
            historyContainerView = null;
            resetResultPaging();
''',
    "init header state"
)

text = replace_once(
    text,
    "            clearCopyFeedback();\n"
    "            rootMode = false;\n"
    "            selectedItemId = null;\n",
    '''            clearCopyFeedback();
            rootMode = false;
            searchExpanded = false;
            selectedItemId = null;
''',
    "shutdown search state"
)

required_markers = [
    "function headerMetrics()",
    "function setSearchExpanded(expanded, requestKeyboard)",
    'state.lastBackLayer = "search_input"',
    'MODULE_VERSION: 27',
    'reference_search_v12_compact_header',
    "historyContainerView.setVisibility",
]
for marker in required_markers:
    if marker not in text:
        raise SystemExit("missing marker: %s" % marker)

for forbidden in [
    'var logo = makeText("▤"',
    'compact ? "筛选" : "☷  筛选"',
    "var controlHeightDp = compact ? 40 : 44",
]:
    if forbidden in text:
        raise SystemExit("legacy header marker still present: %s" % forbidden)

TARGET.write_text(text, encoding="utf-8")

manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
if manifest.get("moduleSetVersion") != "20260724.18":
    raise SystemExit("unexpected moduleSetVersion: %r" %
                     manifest.get("moduleSetVersion"))
manifest["moduleSetVersion"] = "20260724.19"

blob_sha = subprocess.check_output(
    ["git", "hash-object", str(TARGET)], text=True
).strip()
updated = False
for module in manifest.get("modules", []):
    if module.get("path") == str(TARGET):
        module["sha"] = blob_sha
        updated = True
        break
if not updated:
    raise SystemExit("ch_11_filter.js missing from manifest")

MANIFEST.write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8"
)

print("patched", TARGET)
print("module blob", blob_sha)
print("moduleSetVersion", manifest["moduleSetVersion"])
