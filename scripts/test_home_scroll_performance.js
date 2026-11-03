var fs = require('fs'), vm = require('vm'), assert = require('assert'), zlib = require('zlib');
var path = process.argv[2];
var source = fs.readFileSync(path || 'src/ch_11_filter.js', 'utf8');
if (!path) {
    var assignment = source.match(/var PACKED_B64\s*=([\s\S]*?);/)[1];
    source = zlib.gunzipSync(Buffer.from(vm.runInNewContext(assignment), 'base64')).toString('utf8');
}
function load(name, context) {
    var start = source.indexOf('    function ' + name + '(');
    assert(start >= 0, 'Missing real Filter function: ' + name);
    var end = source.indexOf('\n    function ', start + 5);
    vm.runInContext(source.slice(start, end), context);
}
function constant(name) {
    var match = source.match(new RegExp('var ' + name + ' = ([0-9.]+);'));
    assert(match, 'Missing constant ' + name);
    return Number(match[1]);
}

/* ---------- 1. scroll hysteresis fast path ---------- */
function Child(top, height) { this.top = top; this.height = height; }
Child.prototype.getBottom = function () { return this.top + this.height; };
function Host(n, h) {
    this.children = [];
    for (var i = 0; i < n; i += 1) { this.children.push(new Child(i * h, h)); }
}
Host.prototype.getChildCount = function () { return this.children.length; };
Host.prototype.getChildAt = function (i) { this.reads = (this.reads || 0) + 1; return this.children[i]; };
Host.prototype.getHeight = function () { return this.children.length ? this.children[this.children.length - 1].getBottom() : 0; };

var CARD = 100, VIEWPORT = 500, ROWS = 400;
var c = vm.createContext({
    Math: Math, Number: Number, String: String,
    VIRTUAL_REBUILD_MIN_BEFORE_SCREENS: constant('VIRTUAL_REBUILD_MIN_BEFORE_SCREENS'),
    VIRTUAL_REBUILD_MIN_AFTER_SCREENS: constant('VIRTUAL_REBUILD_MIN_AFTER_SCREENS'),
    virtualCardHost: null, resultScrollView: {}, state: { panelAttached: true },
    previewRows: [], ajaxStagedAttachState: { active: false }, overlapStagedFillState: { active: false },
    keyedStagedState: { active: false }, initialStagedFillState: { active: false },
    activeSwipeCard: null, mutationAnchorLocked: false, virtualRenderedItemIds: [],
    virtualState: { firstRenderedIndex: 0, lastRenderedIndex: -1, firstVisibleIndex: 0, lastVisibleIndex: -1,
        topSpacerPx: 0, scrollToTopPending: false, updateDeferred: false, lastOrigin: '', lastError: null },
    scrollY: 0
});
for (var r = 0; r < ROWS; r += 1) { c.previewRows.push({ id: r + 1 }); }
c.currentResultScrollY = function () { return c.scrollY; };
c.virtualViewportHeightPx = function () { return VIEWPORT; };
c.updateVirtualVisibleCount = function () { return Math.ceil(VIEWPORT / CARD); };
load('virtualScrollFastPath', c);

function renderWindow(first, last) {
    c.virtualState.firstRenderedIndex = first;
    c.virtualState.lastRenderedIndex = last;
    c.virtualState.topSpacerPx = first * CARD;
    c.virtualCardHost = new Host(last - first + 1, CARD);
    c.virtualRenderedItemIds = [];
    for (var i = first; i <= last; i += 1) { c.virtualRenderedItemIds.push(i + 1); }
}
/* window centred at row 50: 3 screens (15 rows) before, 5 screens (25 rows) after */
renderWindow(35, 79);
c.scrollY = 50 * CARD;
assert.strictEqual(c.virtualScrollFastPath(), true, 'fresh window must not rebuild');
assert.strictEqual(c.virtualState.firstVisibleIndex, 50, 'binary search finds first visible row');
assert.strictEqual(c.virtualState.lastVisibleIndex, 54);
assert(c.virtualCardHost.reads <= 8, 'fast path must be O(log n) child reads, got ' + c.virtualCardHost.reads);
c.scrollY = 50 * CARD + 37;
assert.strictEqual(c.virtualScrollFastPath(), true);
assert.strictEqual(c.virtualState.firstVisibleIndex, 50, 'partially scrolled row stays first visible');
/* scroll down until the after-buffer drops below the threshold */
var fastFrames = 0, y;
for (y = 50 * CARD; y < 80 * CARD; y += 16) {
    c.scrollY = y;
    if (!c.virtualScrollFastPath()) { break; }
    fastFrames += 1;
}
var remainingAfter = 80 * CARD - (y + VIEWPORT);
assert(remainingAfter < VIEWPORT * c.VIRTUAL_REBUILD_MIN_AFTER_SCREENS &&
    remainingAfter >= VIEWPORT * c.VIRTUAL_REBUILD_MIN_AFTER_SCREENS - 16,
    'rebuild requested only when after-buffer drops below threshold, remaining=' + remainingAfter);
assert(c.VIRTUAL_REBUILD_MIN_AFTER_SCREENS < 5 && c.VIRTUAL_REBUILD_MIN_BEFORE_SCREENS < 3,
    'thresholds must stay below the 3/5 screen render targets to avoid rebuild ping-pong');
assert(fastFrames > 25, 'most scroll frames must take the fast path, got ' + fastFrames);
/* scroll up: rebuild once the before-buffer drops below the threshold */
c.scrollY = 35 * CARD + VIEWPORT * c.VIRTUAL_REBUILD_MIN_BEFORE_SCREENS;
assert.strictEqual(c.virtualScrollFastPath(), true);
c.scrollY = 35 * CARD + VIEWPORT * c.VIRTUAL_REBUILD_MIN_BEFORE_SCREENS - 1;
assert.strictEqual(c.virtualScrollFastPath(), false, 'before-buffer exhausted triggers rebuild');
/* window touching data start/end never asks for a rebuild on that side */
renderWindow(0, 39);
c.scrollY = 0;
assert.strictEqual(c.virtualScrollFastPath(), true);
assert.strictEqual(c.virtualState.firstVisibleIndex, 0);
renderWindow(ROWS - 30, ROWS - 1);
c.scrollY = ROWS * CARD - VIEWPORT;
assert.strictEqual(c.virtualScrollFastPath(), true, 'end of data has no after-buffer requirement');
/* any in-flight staged work or mutation falls back to the full path */
renderWindow(35, 79); c.scrollY = 50 * CARD;
['ajaxStagedAttachState', 'overlapStagedFillState', 'keyedStagedState', 'initialStagedFillState'].forEach(function (k) {
    c[k].active = true;
    assert.strictEqual(c.virtualScrollFastPath(), false, k + ' must disable the fast path');
    c[k].active = false;
});
c.activeSwipeCard = {}; assert.strictEqual(c.virtualScrollFastPath(), false); c.activeSwipeCard = null;
c.mutationAnchorLocked = true; assert.strictEqual(c.virtualScrollFastPath(), false); c.mutationAnchorLocked = false;
c.virtualState.updateDeferred = true; assert.strictEqual(c.virtualScrollFastPath(), false); c.virtualState.updateDeferred = false;
c.virtualRenderedItemIds.pop(); assert.strictEqual(c.virtualScrollFastPath(), false, 'bookkeeping mismatch falls back');
console.log('PASS scroll hysteresis: O(log n) visible lookup, rebuild only at low before/after buffers, edge and staged-state fallbacks');

/* ---------- 2. universal holder rebind ---------- */
function V() { this.children = []; this.text = ''; this.removed = []; }
V.prototype.setText = function (t) { this.text = String(t); };
V.prototype.addView = function (v) { this.children.push(v); };
V.prototype.removeView = function (v) { this.children = this.children.filter(function (x) { return x !== v; }); };
V.prototype.removeAllViews = function () { this.children = []; };
V.prototype.getChildCount = function () { return this.children.length; };
V.prototype.setTypeface = function (f, style) { this.typeface = style; };
V.prototype.setBackground = function (b) { this.background = b; };
V.prototype.setImageDrawable = function (d) { this.drawable = d; };
var tagMap = { '2': [{ name: 'work' }] };
var iconLookups = [];
var d = vm.createContext({
    Number: Number, String: String, Math: Math, Error: Error,
    SELECTION_ENABLED: false, selectedItemId: null, state: { pinnedBadgeCount: 0 },
    scrollPerformanceState: { holderRebindAttemptCount: 0, holderRebindEligibleCount: 0, holderRebindCount: 0,
        holderRebindIconSwapCount: 0, holderRebindPinSwapCount: 0, holderRebindTagSwapCount: 0,
        holderRebindMaxMs: 0, holderRebindRejectReasons: {}, holderRebindFailureStages: {} },
    virtualState: {}, System: { currentTimeMillis: function () { return 0; } },
    Packages: { android: { graphics: { Typeface: { DEFAULT: 'D', BOLD: 1, NORMAL: 0 } } } },
    LinearLayout: { LayoutParams: function () {} },
    ClipHub: { Theme: { applyTextColor: function () { return true; } } },
    tagsForResult: function (row) { return tagMap[String(row.id)] || []; },
    tagSummary: function (tags) { return tags.map(function (t) { return t.name; }).join(','); },
    tagColorText: function () { return '#FF000000'; },
    resultPreviewText: function (row) { return 'row' + row.id; },
    sourceLabel: function (row) { return row.source_package; }, formatTime: function () { return '00:00'; },
    roundedBackground: function (fill) { return { fill: fill }; },
    makePinnedBadge: function () { return new V(); },
    syncHomeMultiHolder: function () {},
    sourceIconDrawable: function (pkg) { iconLookups.push(pkg); return { pkg: pkg }; },
    fillSourceIcon: function (container) { container.removeAllViews(); var img = new V(); container.addView(img); d.lastFilledSourceImage = img; },
    lastFilledSourceImage: null
});
d.noteCardHolderRebindReason = function (map, reason) { map[reason] = (map[reason] || 0) + 1; return reason; };
['rebindPinnedState', 'rebindSourceIcon', 'rebindResultCardHolder', 'resultCardRecycleKeyForRow', 'resultCardRecycleKeyForHolder'].forEach(function (n) { load(n, d); });
var colors = { accentSoft: 'soft', surfaceMuted: 'muted', textTertiary: 't3', accentStrong: 'strong' };
var holder = { row: { id: 1, source_package: 'a.app', is_pinned: 0 }, itemId: 1, contentView: new V(), tagBadge: new V(),
    sourceView: new V(), iconView: new V(), iconImage: null, contentRow: new V(), pinBadge: null, pinAction: new V(),
    metrics: { actionRadiusDp: 6, pinBadgeSizePx: 10, pinBadgeGapPx: 2 }, selected: false, pinned: false,
    sourcePackage: 'a.app', hasTags: false };
holder.contentRow.addView(holder.contentView);
var next = { id: 2, source_package: 'b.app', is_pinned: 1 };
assert.strictEqual(d.resultCardRecycleKeyForRow(next), d.resultCardRecycleKeyForHolder(holder),
    'package, pin and tag presence no longer split the recycle pool');
assert.strictEqual(d.rebindResultCardHolder(holder, next, colors), true, 'cross-package/pinned/tagged rebind succeeds');
assert.strictEqual(holder.contentView.text, 'row2');
assert.strictEqual(holder.iconView.children.length, 1, 'icon container rebuilt for new package');
assert.strictEqual(holder.pinBadge !== null && holder.contentRow.children.indexOf(holder.pinBadge) >= 0, true, 'pin badge added');
assert.strictEqual(holder.pinAction.text, '取消置顶');
assert.strictEqual(holder.tagBadge.typeface, 1); assert.strictEqual(holder.tagBadge.background.fill, 'soft');
assert.strictEqual(holder.hasTags, true); assert.strictEqual(holder.pinned, true); assert.strictEqual(holder.sourcePackage, 'b.app');
/* rebind back: tag map entry of the old row was dehydrated, holder state must still drive the style */
delete tagMap['2'];
var image = holder.iconImage;
assert.strictEqual(d.rebindResultCardHolder(holder, { id: 3, source_package: 'c.app', is_pinned: 0 }, colors), true);
assert.strictEqual(holder.iconImage, image, 'second package swap reuses the ImageView');
assert.strictEqual(image.drawable.pkg, 'c.app');
assert.strictEqual(holder.pinBadge, null); assert.strictEqual(holder.contentRow.children.length, 1, 'pin badge removed');
assert.strictEqual(holder.pinAction.text, '置顶');
assert.strictEqual(holder.tagBadge.typeface, 0, 'tag style reset even though old row tags were dehydrated');
assert.strictEqual(holder.tagBadge.background.fill, 'muted');
/* same package: no icon work at all */
iconLookups.length = 0;
assert.strictEqual(d.rebindResultCardHolder(holder, { id: 4, source_package: 'c.app', is_pinned: 0 }, colors), true);
assert.strictEqual(iconLookups.length, 0);
/* selection change still refuses reuse */
d.SELECTION_ENABLED = true; d.selectedItemId = 5;
assert.strictEqual(d.rebindResultCardHolder(holder, { id: 5, source_package: 'c.app', is_pinned: 0 }, colors), false);
console.log('PASS universal holder rebind: icon/pin/tag swaps in place, dehydrated-tag safety, selection still rebuilds');

/* ---------- 3. multi-select holder sync dedupe ---------- */
var bgBuilds = 0;
function SV() { this.text = ''; }
['setVisibility', 'setEnabled', 'setLongClickable', 'setContentDescription'].forEach(function (k) {
    SV.prototype[k] = function (v) { this['_' + k] = v; };
});
SV.prototype.setText = function (t) { this.text = t; };
SV.prototype.setBackground = function (b) { this.background = b; };
SV.prototype.getChildAt = function () { return new SV(); };
var e = vm.createContext({
    Number: Number, String: String,
    homeMulti: { active: false, ids: [], busy: false, confirmation: null },
    View: { VISIBLE: 0, GONE: 8 }, scrollPerformanceState: {},
    palette: function () { return { accentStrong: 'as', card: 'c', accentBorder: 'ab', accentSoft: 'sf', stroke: 'st' }; },
    circleBackground: function (f) { bgBuilds += 1; return { fill: f }; },
    roundedBackground: function (f) { bgBuilds += 1; return { fill: f }; },
    ClipHub: { Theme: { applyTextColor: function () {} } }
});
load('syncHomeMultiHolder', e);
var h = { itemId: 7, multiCheck: new SV(), actionGrid: new SV(), card: new SV(), editButton: new SV(),
    translateButton: new SV(), copyButton: new SV(), deleteButton: new SV(), selected: false };
e.syncHomeMultiHolder(h); assert.strictEqual(bgBuilds, 2);
h.itemId = 8; e.syncHomeMultiHolder(h);
assert.strictEqual(bgBuilds, 2, 'unchanged visual state must not rebuild drawables');
assert.strictEqual(h.multiCheck._setContentDescription, '选择记录 8', 'item specific description still updated');
e.homeMulti.active = true; e.homeMulti.ids = [8]; e.syncHomeMultiHolder(h);
assert.strictEqual(bgBuilds, 4); assert.strictEqual(h.multiCheck.text, '✓'); assert.strictEqual(h.card.background.fill, 'sf');
e.homeMulti.busy = true; e.syncHomeMultiHolder(h);
assert.strictEqual(h.editButton._setEnabled, false, 'busy state change re-applies enabled flags');
console.log('PASS multi-select holder sync: skips identical visual state, re-applies on selection/busy/theme change');

/* ---------- 4. vector icons rasterised once ---------- */
var draws = 0;
function Bmp(w, hgt) { this.w = w; this.h = hgt; }
Bmp.prototype.setDensity = function (dd) { this.density = dd; };
var f = vm.createContext({
    Math: Math, Number: Number, String: String, Object: Object,
    vectorIconBitmapCache: {}, scrollPerformanceState: { iconBitmapCacheHitCount: 0, iconBitmapCacheMissCount: 0 },
    appContext: { getResources: function () { return { getDisplayMetrics: function () { return { densityDpi: 480 }; } }; } },
    makeVectorIconDrawable: function () {
        return { setBounds: function () {}, draw: function () { draws += 1; } };
    },
    Packages: { android: { graphics: {
        Bitmap: { createBitmap: function (w, hgt) { return new Bmp(w, hgt); }, Config: { ARGB_8888: 1 } },
        Canvas: function (b) { this.bitmap = b; },
        drawable: { BitmapDrawable: function (res, b) { this.bitmap = b; this.setFilterBitmap = function () {}; } }
    } } }
});
load('makeCachedVectorIconDrawable', f);
var i1 = f.makeCachedVectorIconDrawable('copy', '#FF000000', 24, 2);
var i2 = f.makeCachedVectorIconDrawable('copy', '#FF000000', 24, 2);
var i3 = f.makeCachedVectorIconDrawable('copy', '#FFFFFFFF', 24, 2);
assert.strictEqual(draws, 2, 'Rhino draw runs once per kind/color/size');
assert.strictEqual(i1.bitmap, i2.bitmap); assert.notStrictEqual(i1.bitmap, i3.bitmap);
assert.strictEqual(i1.bitmap.w, 24); assert.strictEqual(i1.bitmap.density, 480);
f.Packages.android.graphics.Bitmap.createBitmap = function () { throw new Error('oom'); };
var fallback = f.makeCachedVectorIconDrawable('edit', '#FF000000', 24, 2);
assert.strictEqual(typeof fallback.draw, 'function', 'bitmap failure falls back to the vector drawable');
console.log('PASS icon bitmap cache: one Rhino draw per icon variant, shared bitmaps, safe fallback');

/* ---------- 5. staged fill also covers recycled cards ---------- */
assert(source.indexOf('(range.end - oldEnd) >= overlapStagedMinCards(origin)') > 0 &&
    source.indexOf('(oldStart - range.start) >= overlapStagedMinCards(origin)') > 0,
    'overlap staging triggers on attached card count in both directions');
var minCards = vm.createContext({ String: String, OVERLAP_STAGED_FILL_MIN_NEW_BUILDS: 8, OVERLAP_STAGED_FILL_MIN_CARDS: 4 });
load('overlapStagedMinCards', minCards);
assert.strictEqual(minCards.overlapStagedMinCards('result_scroll'), 8, 'small scroll shifts stay synchronous to avoid blank gaps');
assert.strictEqual(minCards.overlapStagedMinCards('hydration_apply'), 4);
var startFn = source.slice(source.indexOf('    function startOverlapStagedFill('),
    source.indexOf('\n    function ', source.indexOf('    function startOverlapStagedFill(') + 5));
assert(startFn.indexOf('rebindResultCardHolder(') < 0, 'start must not rebind every recycled card in one frame');
var batchFn = source.slice(source.indexOf('    function runOverlapStagedFillBatch('),
    source.indexOf('\n    function ', source.indexOf('    function runOverlapStagedFillBatch(') + 5));
assert(batchFn.indexOf('rebindResultCardHolder(') > 0, 'recycled cards are rebound inside the per-frame batch');
console.log('PASS staged recycle fill: recycled rebinds are spread across frame batches');

/* ---------- 6. staged prepend keeps order, bookkeeping and spacer ---------- */
(function () {
    function Card(id) { this.id = id; }
    function HostView() { this.children = []; }
    HostView.prototype.addView = function (v, i) {
        if (typeof i === 'number') { this.children.splice(i, 0, v); } else { this.children.push(v); }
    };
    HostView.prototype.getChildCount = function () { return this.children.length; };
    var posted = [];
    var rows = [];
    for (var r = 0; r < 60; r += 1) { rows.push({ id: 1000 + r }); }
    var g = vm.createContext({
        Number: Number, String: String, Math: Math,
        OVERLAP_STAGED_FILL_MAX_CARDS_PER_BATCH: 3, OVERLAP_STAGED_FILL_BUDGET_MS: 14,
        System: { currentTimeMillis: function () { return 0; } },
        Packages: { java: { lang: { Runnable: function (o) { this.run = o.run; } } } },
        mainHandler: { post: function (r) { posted.push(r); return true; } },
        state: { panelAttached: true, resultCardCount: 0 }, activeSwipeCard: null,
        previewRows: rows, virtualCardHost: new HostView(),
        resultCardViews: [], resultCardHolders: [], resultActionViews: [],
        virtualRenderedItemIds: [], virtualRenderedSignatures: [],
        virtualState: { firstRenderedIndex: 0, lastRenderedIndex: -1 },
        overlapStagedFillGeneration: 0,
        overlapStagedFillState: { active: false, plan: [], nextPlanIndex: 0 },
        scrollPerformanceState: { holderRecyclePoolPeakCount: 0, holderRecycleKeyHitCount: 0,
            holderRecycleKeyMissCount: 0, holderRecycleDiscardCount: 0, holderRecycleReuseCount: 0,
            holderRecycleMissCount: 0, overlapStagedNewBuildCount: 0, overlapStagedRecycleAttachCount: 0,
            createdViewCount: 0, structuralInsertCount: 0, overlapStagedCardCount: 0,
            overlapStagedBatchCount: 0, overlapStagedMaxBatchMs: 0, overlapStagedMaxCardsPerBatch: 0,
            viewRebuildMaxMs: 0, overlapUpdateMaxMs: 0, overlapStagedStartCount: 0,
            overlapStagedSyncBuildAvoidedCount: 0, overlapStagedHydrationStartCount: 0,
            overlapStagedScrollStartCount: 0, overlapStagedScrollSyncBuildAvoidedCount: 0 },
        LinearLayout: { LayoutParams: function () { this.bottomMargin = 0; } },
        dp: function (n) { return n; },
        virtualHeightRange: function (a, b) { return Math.max(0, b - a) * 100; },
        setVirtualSpacerHeight: function (view, h) { return h; },
        virtualTopSpacer: {}, virtualBottomSpacer: {},
        virtualRenderSignature: function (row) { return 's' + row.id; },
        takeCompatibleRecycleHolder: function (pool) { return pool.length ? pool.pop() : null; },
        rebindResultCardHolder: function (h, row) { h.row = row; return true; },
        cardHolderActionRefs: function () { return {}; },
        makeResultCard: function (row) {
            var w = new Card(row.id);
            g.resultCardViews.push(w); g.resultCardHolders.push({ wrapper: w, row: row }); g.resultActionViews.push({});
            return w;
        },
        finished: 0
    });
    g.finishOverlapStagedFill = function () { g.finished += 1; g.overlapStagedFillState.active = false; return true; };
    g.LinearLayout.LayoutParams.MATCH_PARENT = -1; g.LinearLayout.LayoutParams.WRAP_CONTENT = -2;
    g.cancelOverlapStagedFill = function () { throw new Error('unexpected cancel'); };
    g.scheduleVirtualUpdate = function () {};
    g.overlapStagedBatchCardLimit = function () { return 3; };
    g.runVirtualTaskSafely = function (tag, fn) { return fn(); };
    load('postOverlapStagedFillBatch', g);
    load('runOverlapStagedFillBatch', g);
    load('startOverlapStagedFill', g);
    /* rendered rows 30..44, user scrolled up: new range 23..44 */
    for (var i = 30; i <= 44; i += 1) {
        var w = new Card(rows[i].id);
        g.virtualCardHost.children.push(w);
        g.resultCardViews.push(w); g.resultCardHolders.push({ wrapper: w }); g.resultActionViews.push({});
        g.virtualRenderedItemIds.push(rows[i].id); g.virtualRenderedSignatures.push('s' + rows[i].id);
    }
    var pool = [{ wrapper: new Card('r1') }, { wrapper: new Card('r2') }];
    assert.strictEqual(g.startOverlapStagedFill({ start: 23, end: 44 }, {}, 44, 15, 0, pool, 'result_scroll', 30), true);
    assert.strictEqual(g.overlapStagedFillState.direction, 'up');
    assert.strictEqual(g.virtualState.firstRenderedIndex, 30, 'nothing prepended synchronously');
    var batches = 0;
    while (posted.length) { posted.shift().run(); batches += 1; }
    assert.strictEqual(batches, 3, '7 cards in batches of 3');
    assert.strictEqual(g.finished, 1);
    var ids = g.virtualRenderedItemIds.slice(0);
    for (i = 0; i < ids.length; i += 1) { assert.strictEqual(ids[i], rows[23 + i].id, 'rendered ids stay in row order'); }
    assert.strictEqual(g.virtualCardHost.children.length, ids.length);
    assert.strictEqual(g.resultCardHolders.length, ids.length);
    assert.strictEqual(g.virtualRenderedSignatures[0], 's' + rows[23].id);
    assert.strictEqual(g.virtualState.firstRenderedIndex, 23);
    assert.strictEqual(g.virtualState.lastRenderedIndex, 44);
    assert.strictEqual(g.virtualState.topSpacerPx, 2300, 'top spacer shrinks with each prepended row');
    assert.strictEqual(g.scrollPerformanceState.overlapStagedRecycleAttachCount, 2);
    console.log('PASS staged prepend: upward shift spread over frames with ordered bookkeeping and shrinking top spacer');
}());

/* ---------- 7. hydration apply uses the request index window ---------- */
(function () {
    var scans = 0;
    var rows = [];
    for (var r = 0; r < 500; r += 1) { rows.push({ id: r + 1 }); }
    var h = vm.createContext({ Number: Number, String: String, Math: Math, previewRows: rows });
    load('buildHydrationIndexHint', h);
    load('hintedPreviewRowIndex', h);
    load('findPreviewRowIndexByIdForHydration', h);
    var original = h.findPreviewRowIndexByIdForHydration;
    h.findPreviewRowIndexByIdForHydration = function (id) { scans += 1; return original(id); };
    var hint = h.buildHydrationIndexHint({ startIndex: 300, endIndex: 360 });
    for (var k = 300; k <= 360; k += 1) { assert.strictEqual(h.hintedPreviewRowIndex(hint, k + 1), k); }
    assert.strictEqual(scans, 0, 'ids inside the request window never need a full scan');
    rows.splice(0, 0, { id: 9999 });
    assert.strictEqual(h.hintedPreviewRowIndex(hint, 301), 301, 'shifted rows fall back to a full scan');
    assert.strictEqual(scans, 1);
    console.log('PASS hydration index hint: O(1) lookup inside request window, safe fallback after shifts');
}());

/* ---------- 8. ajax append never runs concurrently with other staged fills ---------- */
(function () {
    var cancels = [];
    var a = vm.createContext({
        Number: Number, String: String, Math: Math,
        mainHandler: {}, virtualCardHost: { getChildCount: function () { return 0; } },
        state: { panelAttached: true }, activeSwipeCard: null,
        keyedStagedState: { active: false }, initialStagedFillState: { active: false },
        overlapStagedFillState: { active: false },
        scrollPerformanceState: { stagedAttachFallbackCount: 0 },
        virtualState: { firstVisibleIndex: 0, firstRenderedIndex: 0, lastRenderedIndex: -1 },
        virtualTargetRange: function () { return { start: 0, end: 10, first: 0, last: 3 }; },
        cancelOverlapStagedFill: function (reason) { cancels.push(reason); a.overlapStagedFillState.active = false; return true; },
        virtualRenderedItemIds: [], virtualRenderedSignatures: [], resultCardViews: [], resultCardHolders: [], resultActionViews: []
    });
    load('startStagedAjaxAttach', a);
    a.keyedStagedState.active = true;
    assert.strictEqual(a.startStagedAjaxAttach(1, [], {}), false, 'keyed staged fill blocks ajax staged attach');
    a.keyedStagedState.active = false; a.initialStagedFillState.active = true;
    assert.strictEqual(a.startStagedAjaxAttach(1, [], {}), false, 'initial staged fill blocks ajax staged attach');
    a.initialStagedFillState.active = false; a.overlapStagedFillState.active = true;
    a.startStagedAjaxAttach(1, [], {});
    assert.deepStrictEqual(cancels, ['ajax_append_preempt'], 'overlap fill is cancelled before ajax attach mutates the host');
    console.log('PASS staged mutex: ajax append preempts overlap fill and yields to keyed/initial fills');
}());

/* ---------- 9. posted list tasks can never throw into the system main looper ---------- */
(function () {
    var calls = [];
    var r = vm.createContext({
        Number: Number, String: String,
        System: { currentTimeMillis: function () { return 10000; } },
        scrollPerformanceState: {}, virtualState: {},
        virtualCardHost: { removeAllViews: function () { calls.push('clear'); } },
        virtualRenderedItemIds: [1], virtualRenderedSignatures: ['x'], resultCardViews: [{}],
        resultCardHolders: [{}], resultActionViews: [{}], activeSwipeCard: {},
        cancelOverlapStagedFill: function () { calls.push('overlap'); throw new Error('nested'); },
        cancelKeyedStagedReconcile: function () { calls.push('keyed'); },
        cancelInitialStagedFill: function () { calls.push('initial'); },
        cancelStagedAjaxAttach: function () { calls.push('ajax'); },
        scheduleVirtualUpdate: function (o, f) { calls.push(o + ':' + f); }
    });
    var start = source.indexOf('    var virtualTaskRecoverAt = 0;');
    var end = source.indexOf('    /* scroll_hysteresis_v1: cheap per-frame check');
    vm.runInContext(source.slice(start, end), r);
    var result = r.runVirtualTaskSafely('t', function () { throw new Error('IndexOutOfBounds'); });
    assert.strictEqual(result, false);
    assert.strictEqual(r.scrollPerformanceState.taskErrorCount, 1);
    assert(/IndexOutOfBounds/.test(r.scrollPerformanceState.lastTaskError));
    assert.deepStrictEqual(calls, ['overlap', 'keyed', 'initial', 'ajax', 'clear', 'virtual_error_recover:true']);
    assert.strictEqual(r.virtualRenderedItemIds.length, 0); assert.strictEqual(r.resultCardHolders.length, 0);
    assert.strictEqual(r.virtualState.lastRenderedIndex, -1); assert.strictEqual(r.activeSwipeCard, null);
    r.runVirtualTaskSafely('t', function () { throw new Error('again'); });
    assert.strictEqual(calls.filter(function (c) { return c === 'virtual_error_recover:true'; }).length, 1,
        'recovery rebuild is rate limited');
    assert.strictEqual(r.runVirtualTaskSafely('ok', function () { return 7; }), 7);
    ['ensureHydrationWorker', 'postKeyedStagedBatch', 'finishKeyedStagedReconcile', 'postOverlapStagedFillBatch',
        'finishOverlapStagedFill', 'postInitialStagedFillBatch', 'rebuildVirtualWindow', 'scheduleVirtualUpdate',
        'postStagedAjaxAttachBatch', 'finishAjaxAppendRender', 'renderAjaxAppendBatch', 'finishResultRender',
        'renderResultBatch'].forEach(function (fn) {
        var s0 = source.indexOf('    function ' + fn + '(');
        var seg = source.slice(s0, source.indexOf('\n    function ', s0 + 5));
        var runnables = seg.split('new Packages.java.lang.Runnable(').length - 1;
        var guarded = seg.split('run: function () { runVirtualTaskSafely(').length - 1;
        assert(runnables > 0 && runnables === guarded, fn + ' runnables guarded ' + guarded + '/' + runnables);
    });
    assert(/onScrollChange: function \(view,[^{]*\{ runVirtualTaskSafely\("onScrollChange"/.test(source),
        'scroll listener is guarded');
    console.log('PASS task guard: list runnables and scroll listener contain exceptions, cancel staged work and rebuild once');
}());

/* ---------- 10. keyed / ajax paths rebind pooled holders before building ---------- */
(function () {
    var built = 0, rebinds = [];
    function Host() { this.children = []; }
    Host.prototype.addView = function (v, i) { this.children.splice(i, 0, v); };
    var k = vm.createContext({
        Number: Number, String: String,
        SELECTION_ENABLED: false, selectedItemId: null,
        virtualCardHost: new Host(), virtualRenderedItemIds: [], virtualRenderedSignatures: [],
        resultCardViews: [], resultCardHolders: [], resultActionViews: [],
        scrollPerformanceState: { holderRecycleKeyHitCount: 0, holderRecycleKeyMissCount: 0,
            holderRecycleDiscardCount: 0, holderRecycleReuseCount: 0, createdViewCount: 0, structuralInsertCount: 0,
            holderRecyclePoolScanCount: 0 },
        LinearLayout: { LayoutParams: function () {} }, dp: function (n) { return n; },
        rebindResultCardHolder: function (h, row) { rebinds.push(row.id); h.row = row; return row.id !== 99; },
        cardHolderActionRefs: function () { return {}; }
    });
    ['signatureBuildTail', 'takeReboundHolder', 'insertRecycledVirtualEntryAt', 'takeCompatibleRecycleHolder',
        'resultCardRecycleKeyForRow', 'resultCardRecycleKeyForHolder'].forEach(function (n) { load(n, k); });
    var sigA = ['{"id":1}', '[]', '0', '1', 'card', 'muted', 'stroke', 't1', 't2', 'soft', 'strong', 390, 600].join('\u001f');
    var sigB = ['{"id":2,"content":"x"}', '[{"name":"a"}]', '0', '1', 'card', 'muted', 'stroke', 't1', 't2', 'soft', 'strong', 390, 600].join('\u001f');
    var sigDark = ['{"id":2}', '[]', '0', '1', 'DARK', 'muted', 'stroke', 't1', 't2', 'soft', 'strong', 390, 600].join('\u001f');
    assert.strictEqual(k.signatureBuildTail(sigA), k.signatureBuildTail(sigB), 'row/tag changes keep the build tail');
    assert.notStrictEqual(k.signatureBuildTail(sigA), k.signatureBuildTail(sigDark), 'theme change invalidates pooled holders');
    var pool = [{ row: { id: 5 }, wrapper: { w: 5 }, card: {}, selected: false }];
    assert.strictEqual(k.insertRecycledVirtualEntryAt(0, { id: 7 }, {}, sigB, pool), true);
    assert.strictEqual(k.virtualCardHost.children[0].w, 5, 'pooled wrapper re-attached');
    assert.deepStrictEqual(Array.from(k.virtualRenderedItemIds), [7]);
    assert.strictEqual(k.virtualRenderedSignatures[0], sigB);
    assert.strictEqual(k.resultCardHolders.length, 1); assert.strictEqual(pool.length, 0);
    assert.strictEqual(k.insertRecycledVirtualEntryAt(0, { id: 8 }, {}, sigB, pool), false, 'empty pool falls back to build');
    pool.push({ row: { id: 6 }, wrapper: {}, card: {}, selected: false });
    assert.strictEqual(k.insertRecycledVirtualEntryAt(0, { id: 99 }, {}, sigB, pool), false, 'failed rebind falls back to build');
    assert.strictEqual(k.scrollPerformanceState.holderRecycleDiscardCount, 1);
    /* source contracts for the two hot builders */
    function fnSource(name) {
        var a = source.indexOf('    function ' + name + '(');
        return source.slice(a, source.indexOf('\n    function ', a + 5));
    }
    var batch = fnSource('runStagedAjaxAttachBatch');
    assert(batch.indexOf('takeReboundHolder(ajaxStagedRecyclePool') > 0 &&
        batch.indexOf('takeReboundHolder(') < batch.indexOf('makeResultCard('), 'ajax batches try the pool before building');
    assert(fnSource('startStagedAjaxAttach').indexOf('ajaxStagedRecycleRelease(resultCardHolders.shift())') > 0,
        'cards removed at ajax start feed the pool');
    var keyed = fnSource('keyedReconcileVirtualWindow');
    assert(keyed.indexOf('keyedPool.push(') > 0 && keyed.indexOf('insertRecycledVirtualEntryAt(') > 0,
        'keyed reconcile recycles removed holders');
    console.log('PASS card recycle v2: keyed reconcile and ajax batches rebind pooled holders, theme changes still rebuild');
}());

/* ---------- 11. hydration forces a visual rebuild only for real rendered changes ---------- */
(function () {
    var h = vm.createContext({ Number: Number, String: String, JSON: JSON,
        virtualRenderedItemIds: [10, 11, 12], resultTagMap: { '11': [{ name: 'work' }] } });
    load('renderedTagSnapshot', h);
    load('renderedTagsChanged', h);
    var snap = h.renderedTagSnapshot({ tagIds: [11, 12, 99] });
    assert.deepStrictEqual(Object.keys(snap.tags).sort(), ['11', '12'], 'only rendered tag ids are tracked');
    h.resultTagMap['99'] = [{ name: 'offscreen' }];
    assert.strictEqual(h.renderedTagsChanged(snap), false, 'off-screen tag loads never force a rebuild');
    h.resultTagMap['11'] = [{ name: 'work' }];
    assert.strictEqual(h.renderedTagsChanged(snap), false, 'reloading identical tags is not a visual change');
    h.resultTagMap['12'] = [{ name: 'new' }];
    assert.strictEqual(h.renderedTagsChanged(snap), true, 'a rendered row gaining a tag forces a rebuild');
    var a0 = source.indexOf('    function applyHydrationResult(');
    var applySrc = source.slice(a0, source.indexOf('\n    function ', a0 + 5));
    assert(/var forceVisual = missing > 0 \|\| renderedRowHydrated \|\|\s*renderedTagsChanged\(renderedBefore\);/.test(applySrc),
        'forceVisual is driven by missing rows, hydrated rendered rows or changed rendered tags');
    assert(applySrc.indexOf('renderedTagSnapshot(result)') < applySrc.indexOf('mergeItemTagMap('),
        'snapshot is taken before tags are merged');
    console.log('PASS hydration visual delta: forced keyed reconcile only when rendered rows actually change');
}());
