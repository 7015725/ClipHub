/* Batch 3 (ui-catalog ports) regression tests: design tokens, the home
 * card long-press context menu, and the settings segmented / switch
 * controls. Real sources, Android classes mocked. */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var zlib = require('zlib');
var root = path.resolve(__dirname, '..');
function same(a, b, m) { assert.strictEqual(JSON.stringify(a), JSON.stringify(b), m); }
function source(name) {
    var text = fs.readFileSync(path.join(root, 'src', name), 'utf8');
    var match = /\bvar\s+(?:PACKED_B64|encoded)\s*=\s*([\s\S]*?);/.exec(text);
    if (!match) { return text; }
    return zlib.gunzipSync(Buffer.from(match[1].match(/"(?:\\.|[^"\\])*"/g)
        .map(function (part) { return JSON.parse(part); }).join(''), 'base64')).toString('utf8');
}
var themeSrc = source('ch_07_theme.js');
var filterSrc = source('ch_11_filter.js');
var settingsSrc = source('ch_13_settings.js');
function loadFrom(src, name, context) {
    var start = src.indexOf('    function ' + name + '(');
    assert(start >= 0, 'Missing function ' + name);
    var end = src.indexOf('\n    function ', start + 5);
    vm.runInContext(src.slice(start, end), context);
}

/* ---- minimal Android view mocks ---- */
function FakeView() {
    this.children = []; this.parent = null; this.alpha = 1; this.translationY = 0;
    this.translationX = 0; this.visibility = 0; this.text = ''; this.listeners = {};
    this.width = 0; this.height = 0; this.measuredW = 180; this.measuredH = 300;
    this.animations = []; this.selected = false; this.bold = false;
}
FakeView.prototype.addView = function (child, params) {
    child.parent = this; child.layoutParams = params; this.children.push(child);
};
FakeView.prototype.removeView = function (child) {
    var i = this.children.indexOf(child); if (i >= 0) { this.children.splice(i, 1); }
    child.parent = null;
};
FakeView.prototype.getParent = function () { return this.parent; };
FakeView.prototype.getWidth = function () { return this.width; };
FakeView.prototype.getHeight = function () { return this.height; };
FakeView.prototype.getMeasuredWidth = function () { return this.measuredW; };
FakeView.prototype.getMeasuredHeight = function () { return this.measuredH; };
FakeView.prototype.measure = function () {};
FakeView.prototype.getLocationOnScreen = function (loc) { loc[0] = 20; loc[1] = 100; };
FakeView.prototype.setOnClickListener = function (l) { this.listeners.click = l; };
FakeView.prototype.setOnTouchListener = function (l) { this.listeners.touch = l; };
FakeView.prototype.click = function () { this.listeners.click.onClick(this); };
FakeView.prototype.setText = function (t) { this.text = String(t); };
FakeView.prototype.setContentDescription = function (t) { this.description = String(t); };
FakeView.prototype.setAlpha = function (v) { this.alpha = v; };
FakeView.prototype.setTranslationY = function (v) { this.translationY = v; };
FakeView.prototype.setTranslationX = function (v) { this.translationX = v; };
FakeView.prototype.setSelected = function (v) { this.selected = v; };
FakeView.prototype.setTypeface = function (f, style) { this.bold = style === 1; };
FakeView.prototype.setBackground = function (b) { this.background = b; };
FakeView.prototype.setVisibility = function (v) { this.visibility = v; };
FakeView.prototype.animate = function () {
    var self = this;
    var anim = { props: {}, cancelled: false };
    anim.alpha = function (v) { anim.props.alpha = v; return anim; };
    anim.translationY = function (v) { anim.props.translationY = v; return anim; };
    anim.translationX = function (v) { anim.props.translationX = v; return anim; };
    anim.setDuration = function (v) { anim.duration = v; return anim; };
    anim.setInterpolator = function (v) { anim.interpolator = v; return anim; };
    anim.cancel = function () { anim.cancelled = true; return anim; };
    anim.start = function () {
        Object.keys(anim.props).forEach(function (k) { self[k] = anim.props[k]; });
        self.animations.push(anim); return anim;
    };
    return anim;
};
['setOrientation', 'setGravity', 'setPadding', 'setMinimumHeight', 'setMinimumWidth',
    'setClickable', 'setFocusable', 'setElevation', 'setSingleLine', 'setEllipsize']
    .forEach(function (n) { FakeView.prototype[n] = function () {}; });
function Params(w, h, weight) { this.width = w; this.height = h; this.weight = weight; }
Params.prototype.setMargins = function (l, t, r, b) { this.leftMargin = l; this.topMargin = t; };
Params.MATCH_PARENT = -1; Params.WRAP_CONTENT = -2;
function viewClass() { var C = function () { FakeView.call(this); }; C.prototype = Object.create(FakeView.prototype); C.LayoutParams = Params; C.VERTICAL = 1; C.HORIZONTAL = 0; return C; }
var JavaArray = {
    newInstance: function (type, n) { var a = []; for (var i = 0; i < n; i += 1) { a.push(0); } return a; },
    setInt: function (a, i, v) { a[i] = v; }
};
function StateList() { this.states = []; }
StateList.prototype.addState = function (s, d) { this.states.push({ state: s.slice(0), drawable: d }); };
var packages = {
    java: { lang: { reflect: { Array: JavaArray }, Integer: { TYPE: 'int' },
        Runnable: function (o) { this.run = o.run; } } },
    android: { R: { attr: { state_pressed: 16842919 } },
        graphics: { drawable: { StateListDrawable: StateList },
            Typeface: { DEFAULT: 'default', BOLD: 1, NORMAL: 0 } } }
};
var ViewClass = viewClass();
ViewClass.MeasureSpec = { AT_MOST: 1, UNSPECIFIED: 0, makeMeasureSpec: function (s, m) { return s; } };

/* ---------- 1. design tokens ported from ui-catalog tokens.css ---------- */
(function () {
    var literal = /var UI_TOKENS = (\{[\s\S]*?\n    \});/.exec(themeSrc);
    assert(literal, 'UI_TOKENS literal present');
    var tokens = vm.runInNewContext('(' + literal[1] + ')');
    assert.strictEqual(tokens.radiusSmDp, 8, '--ui-radius-sm');
    assert.strictEqual(tokens.radiusDp, 10, '--ui-radius');
    assert.strictEqual(tokens.radiusLgDp, 14, '--ui-radius-lg');
    assert.strictEqual(tokens.controlHeightDp, 40, '--ui-ctl-h');
    assert.strictEqual(tokens.gapDp, 10, '--ui-gap');
    assert.strictEqual(tokens.motionMs, 180, '--ui-motion .18s');
    assert.strictEqual(tokens.layerInMs, 160, '.ui-layer animation .16s');
    same(tokens.easeCurve, [0.2, 0.7, 0.2, 1], '--ui-ease');
    same(tokens.springCurve, [0.34, 1.56, 0.64, 1], '--ui-spring');
    assert(/getUiTokens: getUiTokens,/.test(themeSrc) && /makeInterpolator: makeInterpolator,/.test(themeSrc),
        'tokens and interpolator exported from ClipHub.Theme');
    assert(/MODULE_VERSION: 12,/.test(themeSrc), 'theme module version bumped');
    var c = vm.createContext({ UI_TOKENS: tokens, interpolatorCache: {}, String: String,
        Packages: { android: { view: { animation: { PathInterpolator: function (a, b, d, e) { this.curve = [a, b, d, e]; } } } } } });
    loadFrom(themeSrc, 'makeInterpolator', c);
    var ease = c.makeInterpolator('ease');
    same(ease.curve, [0.2, 0.7, 0.2, 1]);
    assert.strictEqual(c.makeInterpolator('ease'), ease, 'interpolators are cached');
    same(c.makeInterpolator('spring').curve, [0.34, 1.56, 0.64, 1]);
    console.log('PASS tokens: radius / control height / motion / ease + spring curves match ui-catalog');
}());

/* ---------- 2. context menu: items, placement, routing ---------- */
function menuContext(overrides) {
    var calls = [];
    var c = vm.createContext({
        Number: Number, String: String, Math: Math, isFinite: isFinite,
        Packages: packages, View: ViewClass, LinearLayout: viewClass(), FrameLayout: viewClass(),
        Gravity: { TOP: 48, START: 8388611, CENTER_VERTICAL: 16 },
        MotionEvent: { ACTION_DOWN: 0 },
        JavaAdapter: function (type, impl) { return impl; },
        ClipHub: { Theme: { getUiTokens: function () { return { radiusSmDp: 8, radiusLgDp: 14,
            layerInMs: 160, layerOffsetDp: 4, menuMinWidthDp: 168, menuItemHeightDp: 40, menuPaddingDp: 6 }; },
            makeInterpolator: function (n) { return { name: n }; } },
            Settings: { get: function (k, d) { return c.longPressSetting === undefined ? d : c.longPressSetting; } } },
        state: { panelAttached: true, cardMenuDismissCount: 0, cardMenuActionCount: 0, cardMenuOpenCount: 0 },
        homeMulti: { active: false, busy: false, confirmation: null },
        appContext: {}, advancedVisible: false, cardMenu: null, cardMenuGeneration: 0,
        resultBodyFrame: null, calls: calls,
        dp: function (v) { return Math.max(1, Math.floor(Number(v) * 2 + 0.5)); },
        palette: function () { return { surfaceRaised: 'raised', stroke: 'stroke', divider: 'divider',
            danger: 'danger', dangerSoft: 'dangerSoft', accentSoft: 'soft', textPrimary: 'text', textSecondary: 'sub' }; },
        roundedBackground: function (fill, stroke, r) { return { fill: fill, stroke: stroke, radius: r }; },
        makeText: function (t, size, color) { var v = new FakeView(); v.text = t; v.color = color; return v; },
        makeCachedVectorIconDrawable: function (kind, color) { return { icon: kind, color: color }; },
        cancelActiveSwipe: function () { calls.push('cancelSwipe'); },
        openTokenizerForResultRow: function (row, o) { calls.push(['tokenize', row.id, o]); return true; },
        editResultRow: function (row, o) { calls.push(['edit', row.id, o]); return true; },
        translateResultRow: function (row, o) { calls.push(['translate', row.id, o]); return true; },
        copyResultRow: function (row, o) { calls.push(['copy', row.id, o]); return true; },
        toggleResultPinned: function (row) { calls.push(['pin', row.id]); return true; },
        beginHomeMulti: function () { calls.push('beginMulti'); c.homeMulti.active = true; return true; },
        toggleHomeMulti: function (id) { calls.push(['toggleMulti', id]); return true; },
        deleteResultRow: function (row, o) { calls.push(['delete', row.id, o]); return true; }
    });
    Object.keys(overrides || {}).forEach(function (k) { c[k] = overrides[k]; });
    ['uiTokens', 'uiInterpolator', 'cardLongPressAction', 'cardMenuItems', 'dismissCardMenu',
        'runCardMenuAction', 'chooseCardMenuItem', 'cardMenuItemBackground', 'makeCardMenuItem',
        'cardMenuPlacement', 'openCardMenu'].forEach(function (n) { loadFrom(filterSrc, n, c); });
    return c;
}

(function () {
    var c = menuContext();
    var items = c.cardMenuItems({ id: 1, is_pinned: 0 });
    same(items.map(function (i) { return i.divider ? '|' : i.label; }),
        ['分词', '编辑', '翻译', '复制', '置顶', '多选', '|', '删除']);
    assert.strictEqual(items[items.length - 1].danger, true, 'delete is the danger item');
    assert.strictEqual(c.cardMenuItems({ id: 1, is_pinned: 1 })[4].label, '取消置顶');
    assert.strictEqual(c.cardLongPressAction(), 'menu', 'menu is the default long-press action');
    c.longPressSetting = 'tokenize'; assert.strictEqual(c.cardLongPressAction(), 'tokenize');
    c.longPressSetting = 'weird'; assert.strictEqual(c.cardLongPressAction(), 'menu');

    /* placement: below the finger, clamped, flipped above near the bottom */
    var p = c.cardMenuPlacement(100, 50, 200, 300, 600, 900, 16, 4);
    same([p.x, p.y, p.side], [100, 54, 'bottom']);
    p = c.cardMenuPlacement(580, 50, 200, 300, 600, 900, 16, 4);
    assert.strictEqual(p.x, 384, 'clamped inside the right edge');
    p = c.cardMenuPlacement(100, 800, 200, 300, 600, 900, 16, 4);
    same([p.y, p.side], [496, 'top'], 'flips above when there is no room below');
    p = c.cardMenuPlacement(100, 200, 200, 300, 600, 400, 16, 4);
    assert.strictEqual(p.side, 'center', 'short host centres the menu on the finger');
    assert(p.y >= 16 && p.y + 300 <= 400 || p.y === 16, 'centred menu stays inside the host');
    console.log('PASS menu items: ui-context-menu order, danger delete, pin label, long-press setting, placement');
}());

(function () {
    var c = menuContext();
    var host = new FakeView(); host.width = 700; host.height = 1200;
    c.resultBodyFrame = host;
    var holder = { touchRawX: 220, touchRawY: 400 };
    var row = { id: 42, is_pinned: 0 };
    assert.strictEqual(c.openCardMenu(holder, row), true);
    assert.strictEqual(host.children.length, 1, 'scrim attached to the result body');
    var scrim = host.children[0];
    var panel = scrim.children[0];
    assert.strictEqual(c.cardMenu.itemId, 42);
    assert.strictEqual(c.state.cardMenuVisible, true);
    assert.strictEqual(panel.layoutParams.leftMargin, 200, 'anchored at the finger (raw - host x)');
    assert.strictEqual(panel.layoutParams.topMargin, 304, 'just below the finger (raw - host y + gap)');
    assert.strictEqual(panel.background.radius, 14, 'layer uses --ui-radius-lg');
    assert.strictEqual(panel.alpha, 1, 'enter animation runs to opaque');
    assert.strictEqual(panel.animations[0].duration, 160);
    same(panel.animations[0].interpolator, { name: 'ease' });
    assert.strictEqual(panel.children.length, 8, '7 items + 1 divider');
    var deleteItem = panel.children[7];
    assert.strictEqual(deleteItem.description, '删除');
    assert.strictEqual(deleteItem.background.states[0].drawable.fill, 'dangerSoft', 'danger pressed state');
    assert.strictEqual(deleteItem.background.states[0].state[0], 16842919, 'pressed state attr');
    /* outside touch closes without running anything */
    scrim.listeners.touch.onTouch(scrim, { getActionMasked: function () { return 0; } });
    assert.strictEqual(c.cardMenu, null);
    assert.strictEqual(host.children.length, 0, 'scrim removed');
    assert.strictEqual(c.state.lastCardMenuDismissReason, 'outside');
    assert.strictEqual(c.calls.filter(function (x) { return x instanceof Array; }).length, 0);

    /* each item routes to the existing row action with a menu origin */
    var expected = {
        0: ['tokenize', 42, 'card_menu_tokenize'], 1: ['edit', 42, 'card_menu_edit'],
        2: ['translate', 42, 'card_menu_translate'], 3: ['copy', 42, 'card_menu_copy'],
        4: ['pin', 42], 7: ['delete', 42, 'card_menu_delete']
    };
    Object.keys(expected).forEach(function (idx) {
        c.calls.length = 0;
        assert.strictEqual(c.openCardMenu(holder, row), true);
        var menuPanel = host.children[0].children[0];
        menuPanel.children[Number(idx)].click();
        assert.strictEqual(host.children.length, 0, 'menu closes before the action');
        var actions = c.calls.filter(function (x) { return x instanceof Array; });
        same(actions, [expected[idx]]);
    });
    c.calls.length = 0;
    c.openCardMenu(holder, row);
    host.children[0].children[0].children[5].click();
    same(c.calls.slice(-2), ['beginMulti', ['toggleMulti', 42]], '多选 enters multi-select with the row selected');
    assert.strictEqual(c.openCardMenu(holder, row), false, 'no menu while multi-select is active');
    c.homeMulti.active = false;

    /* a stale menu (panel rebuilt) does nothing */
    c.openCardMenu(holder, row);
    var stalePanel = host.children[0].children[0];
    c.resultBodyFrame = new FakeView();
    c.calls.length = 0;
    stalePanel.children[7].click();
    assert.strictEqual(c.calls.filter(function (x) { return x instanceof Array; }).length, 0, 'stale menu cannot delete');
    assert.strictEqual(c.cardMenu, null);
    c.resultBodyFrame = host;
    /* a throwing action is contained (UI thread safety) */
    c.deleteResultRow = function () { throw new Error('db locked'); };
    c.openCardMenu(holder, row);
    host.children[0].children[0].children[7].click();
    assert(/Card menu action failed/.test(c.state.lastError));
    /* guards */
    c.state.panelAttached = false; assert.strictEqual(c.openCardMenu(holder, row), false);
    c.state.panelAttached = true; c.advancedVisible = true; assert.strictEqual(c.openCardMenu(holder, row), false);
    c.advancedVisible = false; c.homeMulti.confirmation = {}; assert.strictEqual(c.openCardMenu(holder, row), false);
    console.log('PASS context menu: anchored layer, enter motion, outside dismiss, action routing, stale/throw/guards');
}());

(function () {
    /* wiring contracts in the real card and lifecycle code */
    var card = filterSrc.slice(filterSrc.indexOf('    function makeResultCard('),
        filterSrc.indexOf('\n    function ', filterSrc.indexOf('    function makeResultCard(') + 5));
    var lp = card.slice(card.indexOf('onLongClick'));
    assert(lp.indexOf('cardLongPressAction() === "menu"') > 0 && lp.indexOf('openCardMenu(holder, launchRow)') > 0,
        'long press opens the menu in menu mode');
    assert(lp.indexOf('openCardMenu(holder, launchRow)') < lp.indexOf('openTokenizerForResultRow(launchRow'),
        'tokenizer stays the fallback and the tokenize-mode path');
    assert(/!homeMulti\.active && cardLongPressAction\(\) === "menu"/.test(lp), 'multi-select keeps the old long press');
    var exit = filterSrc.slice(filterSrc.indexOf('    function exitHomeMulti('), filterSrc.indexOf('    function beginHomeMulti('));
    assert(/if \(cardMenu !== null\) \{ dismissCardMenu\("home_lifecycle"\); \}/.test(exit),
        'close / destroy / child page mount (all via exitHomeMulti) close the menu');
    assert(/dismissCardMenu\("drawer_open"\);/.test(filterSrc), 'opening the filter drawer closes the menu');
    assert(/holder\.touchRawX = rawX;/.test(filterSrc), 'press point recorded on ACTION_DOWN');
    assert(/kind === "tokenize"/.test(filterSrc) && /kind === "select"/.test(filterSrc), 'menu icons drawn');
    assert(/cardMenu: \{\s*visible:/.test(filterSrc), 'menu diagnostics exported');
    console.log('PASS menu wiring: long press, lifecycle dismissal, touch point, icons, diagnostics');
}());

/* ---------- 3. settings: segmented + switch controls ---------- */
function settingsContext() {
    var c = vm.createContext({
        Number: Number, String: String, Math: Math, Packages: packages, appContext: {},
        View: ViewClass, LinearLayout: viewClass(), FrameLayout: viewClass(),
        Gravity: { CENTER: 17, CENTER_VERTICAL: 16, START: 8388611 },
        TextUtils: { TruncateAt: { END: 'end' } },
        JavaAdapter: function (type, impl) { return impl; },
        uiState: {},
        ClipHub: { Theme: { applyTextColor: function (v, color) { v.color = color; },
            getUiTokens: function () { return { radiusDp: 10, motionMs: 180, segmentedPaddingDp: 3,
                switchTrackWidthDp: 42, switchTrackHeightDp: 24, switchThumbDp: 18 }; },
            makeInterpolator: function () { return { name: 'ease' }; } } },
        dp: function (v) { return Math.max(1, Math.floor(Number(v) * 2 + 0.5)); },
        roundedBackground: function (fill, stroke, r) { return { fill: fill, stroke: stroke, radius: r }; },
        makeText: function (t, size, color) { var v = new FakeView(); v.text = t; v.color = color; return v; }
    });
    ['settingsUiTokens', 'settingsInterpolator', 'syncSegmented', 'makeSegmented', 'makeSegmentedRow',
        'syncSwitch', 'makeSwitchRow', 'addControlRow', 'optionLabels', 'normalize']
        .forEach(function (n) { loadFrom(settingsSrc, n, c); });
    return c;
}

(function () {
    var c = settingsContext();
    var colors = { surfaceRaised: 'raised', surfaceMuted: 'muted', stroke: 'stroke', strokeStrong: 'strong',
        accentStrong: 'accent', textSecondary: 'sub', textPrimary: 'text' };
    var picked = [];
    var seg = c.makeSegmentedRow('主题', [{ value: 'system', label: '跟随系统' }, { value: 'light', label: '浅色' },
        { value: 'dark', label: '深色' }], 'light', colors, function (v) { picked.push(v); });
    assert.strictEqual(seg.items.length, 3);
    assert.strictEqual(seg.root.background.fill, 'muted', 'track uses the muted surface');
    assert.strictEqual(seg.items[1].view.background.fill, 'raised', 'selected pill is raised');
    assert.strictEqual(seg.items[1].view.color, 'accent');
    assert.strictEqual(seg.items[1].view.bold, true);
    assert.strictEqual(seg.items[0].view.color, 'sub');
    assert.strictEqual(seg.items[1].view.description, '主题：浅色，已选择');
    seg.items[1].view.click();
    same(picked, [], 'tapping the selected option is a no-op');
    seg.items[2].view.click();
    same(picked, ['dark']);
    assert.strictEqual(seg.value, 'dark');
    assert.strictEqual(seg.items[2].view.background.fill, 'raised');
    assert.strictEqual(seg.items[1].view.background.fill, '#00000000');
    assert.strictEqual(c.uiState.segmentedChangeCount, 1);
    /* numeric options (history limit) compare by value */
    var limits = c.makeSegmented('历史上限', c.optionLabels([0, 500, 2000, 5000], function (n) {
        return n > 0 ? n + ' 条' : '不限'; }), 2000, colors, function () {});
    same(limits.items.map(function (i) { return i.label; }), ['不限', '500 条', '2000 条', '5000 条']);
    assert.strictEqual(limits.items[2].view.selected, true);
    c.syncSegmented(limits, 0);
    assert.strictEqual(limits.items[0].view.selected, true);
    assert.strictEqual(limits.items[2].view.selected, false);
    /* switch */
    var toggles = [];
    var sw = c.makeSwitchRow('复制后关闭面板', '复制记录后自动收起 ClipHub', false, colors,
        function (v) { toggles.push(v); });
    assert.strictEqual(sw.track.background.fill, 'strong', 'off track');
    assert.strictEqual(sw.thumb.translationX, 0);
    assert.strictEqual(sw.root.description, '复制后关闭面板，已关闭，点击切换');
    sw.root.click();
    same(toggles, [true]);
    assert.strictEqual(sw.checked, true);
    assert.strictEqual(sw.track.background.fill, 'accent', 'on track uses the accent');
    assert.strictEqual(sw.thumb.translationX, c.dp(42 - 18 - 6), 'thumb slides across the track');
    assert.strictEqual(sw.thumb.animations[0].duration, 180, '--ui-motion');
    assert.strictEqual(sw.root.description, '复制后关闭面板，已开启，点击切换');
    c.syncSwitch(sw, false, false);
    assert.strictEqual(sw.thumb.translationX, 0, 'programmatic sync does not animate');
    var thrower = c.makeSwitchRow('x', '', false, colors, function () { throw new Error('boom'); });
    thrower.root.click();
    assert.strictEqual(c.uiState.lastError, 'Error: boom', 'listener errors are contained');
    /* new setting */
    c.DEFAULTS = { cardLongPressAction: 'menu' };
    assert.strictEqual(c.normalize('cardLongPressAction', 'tokenize'), 'tokenize');
    assert.strictEqual(c.normalize('cardLongPressAction', 'bogus'), 'menu');
    console.log('PASS settings controls: ui-segmented selection, numeric options, ui-switch track/thumb motion, errors contained');
}());

(function () {
    assert(/cardLongPressAction: "menu",/.test(settingsSrc), 'long-press default is the menu');
    var general = settingsSrc.slice(settingsSrc.indexOf('    function makeGeneralBehaviorRow('),
        settingsSrc.indexOf('    function knownSourceOptions('));
    ['makeSegmentedRow("主题"', 'makeSegmentedRow("点击记录"', 'makeSegmentedRow("长按记录"',
        'makeSwitchRow("复制后关闭面板"', 'setValue("closeAfterCopy", checked === true',
        'setValue("cardLongPressAction", action'].forEach(function (needle) {
        assert(general.indexOf(needle) >= 0, 'general controls: ' + needle);
    });
    var retention = settingsSrc.slice(settingsSrc.indexOf('    function makeRetentionSection('),
        settingsSrc.indexOf('    function makeGeneralSection('));
    assert(/makeSwitchRow\("记录来源应用"/.test(retention));
    assert(/stageRetentionChange\("historyLimit", limit, colors\)/.test(retention), 'history limit still goes through the draft');
    assert(/stageRetentionChange\("autoCleanupDays", days, colors\)/.test(retention), 'retention still goes through the draft');
    assert(/makeSwitchRow\("记录敏感内容"/.test(settingsSrc) && /makeSwitchRow\("记录搜索历史"/.test(settingsSrc));
    assert(/4 秒后保存；调小上限或天数会清理超出的旧记录/.test(settingsSrc), 'pending cleanup is announced in place');
    console.log('PASS settings wiring: general and retention sections use the ported controls');
}());
