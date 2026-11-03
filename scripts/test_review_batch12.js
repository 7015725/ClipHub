/* Review batch 1/2 regression tests: real Filter / Settings / Repository /
 * Translation / List sources, Android classes mocked, in-memory SQLite. */
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var zlib = require('zlib');
var DatabaseSync = require('node:sqlite').DatabaseSync;
var root = path.resolve(__dirname, '..');
function source(name) {
    var text = fs.readFileSync(path.join(root, 'src', name), 'utf8');
    var match = /\bvar\s+(?:PACKED_B64|encoded)\s*=\s*([\s\S]*?);/.exec(text);
    if (!match) { return text; }
    return zlib.gunzipSync(Buffer.from(match[1].match(/"(?:\\.|[^"\\])*"/g)
        .map(function (part) { return JSON.parse(part); }).join(''), 'base64')).toString('utf8');
}
var filterSrc = source('ch_11_filter.js');
var settingsSrc = source('ch_13_settings.js');
function loadFrom(src, name, context) {
    var start = src.indexOf('    function ' + name + '(');
    assert(start >= 0, 'Missing function ' + name);
    var end = src.indexOf('\n    function ', start + 5);
    vm.runInContext(src.slice(start, end), context);
}

/* Calendar / SimpleDateFormat backed by JS Date (local time). */
function FakeCalendar() { this.d = new Date(FakeCalendar.now); }
FakeCalendar.YEAR = 1; FakeCalendar.HOUR_OF_DAY = 11; FakeCalendar.MINUTE = 12;
FakeCalendar.SECOND = 13; FakeCalendar.MILLISECOND = 14;
FakeCalendar.getInstance = function () { return new FakeCalendar(); };
FakeCalendar.prototype.setTimeInMillis = function (v) { this.d = new Date(Number(v)); };
FakeCalendar.prototype.getTimeInMillis = function () { return this.d.getTime(); };
FakeCalendar.prototype.get = function (f) { return f === 1 ? this.d.getFullYear() : 0; };
FakeCalendar.prototype.set = function (f, v) {
    if (f === 11) { this.d.setHours(v); } else if (f === 12) { this.d.setMinutes(v); }
    else if (f === 13) { this.d.setSeconds(v); } else if (f === 14) { this.d.setMilliseconds(v); }
};
function pad(n) { return (n < 10 ? '0' : '') + n; }
function FakeSDF(pattern) { this.p = pattern; }
FakeSDF.prototype.format = function (date) {
    var d = new Date(date.t);
    return this.p.replace('yyyy', d.getFullYear()).replace('HH', pad(d.getHours()))
        .replace('mm', pad(d.getMinutes())).replace(/M(?=月|\/)/, d.getMonth() + 1)
        .replace(/d(?=日|$| )/, d.getDate());
};
function FakeDate(t) { this.t = t; }

/* ---------- 1. relative time on home cards and detail ---------- */
(function () {
    var now = new Date(2026, 10, 3, 14, 30, 0).getTime();
    FakeCalendar.now = now;
    var c = vm.createContext({ Number: Number, String: String,
        Packages: { java: { util: { Calendar: FakeCalendar } } },
        SimpleDateFormat: FakeSDF, Date: FakeDate, Locale: { getDefault: function () { return 'zh'; } },
        System: { currentTimeMillis: function () { return now; } }, timeFormatter: null });
    ['cachedTimeFormatter', 'relativeTimePattern', 'formatTime'].forEach(function (n) { loadFrom(filterSrc, n, c); });
    assert.strictEqual(c.formatTime(new Date(2026, 10, 3, 9, 5).getTime()), '09:05', 'today: time only');
    assert.strictEqual(c.formatTime(new Date(2026, 10, 2, 23, 59).getTime()), '昨天 23:59');
    assert.strictEqual(c.formatTime(new Date(2026, 10, 1, 8, 0).getTime()), '11月1日', 'this year: month/day');
    assert.strictEqual(c.formatTime(new Date(2025, 0, 9, 8, 0).getTime()), '2025/1/9', 'older: full date');
    assert.strictEqual(c.formatTime(0), '', 'missing time stays blank');
    /* List detail uses the same rule with time appended */
    var listSrc = source('ch_09_list.js');
    var l = vm.createContext({ Number: Number, String: String,
        Packages: { java: { util: { Calendar: FakeCalendar } } },
        SimpleDateFormat: FakeSDF, Date: FakeDate, Locale: { getDefault: function () { return 'zh'; } } });
    var ls = listSrc.indexOf('function formatTime(value) {');
    vm.runInContext(listSrc.slice(ls, listSrc.indexOf('\nfunction sourceText', ls)), l);
    assert.strictEqual(l.formatTime(new Date(2026, 10, 2, 7, 1).getTime()), '昨天 07:01');
    assert.strictEqual(l.formatTime(new Date(2026, 4, 6, 7, 1).getTime()), '5月6日 07:01');
    console.log('PASS relative time: today / yesterday / this year / older, home and detail');
}());

/* ---------- 2. failed input falls back to clipboard copy ---------- */
(function () {
    var toasts = [], writes = [];
    var c = vm.createContext({ Number: Number, String: String,
        Packages: { java: { lang: { System: { currentTimeMillis: function () { return 1; } } } } },
        state: {}, inputDispatchPending: true,
        ClipHub: { Clipboard: { writeText: function (t, o) { writes.push([t, o.sensitive]); return { ok: true }; } } },
        showInputToast: function (m) { toasts.push(m); },
        inputContextPendingError: function (e) { return String(e).indexOf('No Input context') >= 0; } });
    var start = filterSrc.indexOf('    var inputFallbackSensitive = false;');
    var end = filterSrc.indexOf('\n    function scheduleInputAttempt(');
    vm.runInContext(filterSrc.slice(start, end), c);
    c.inputFallbackSensitive = true;
    assert.strictEqual(c.finishInputDispatch(false, 'No Input context', 3, '验证码 123456'), false);
    assert.deepStrictEqual(writes, [['验证码 123456', true]], 'full text copied with sensitive flag');
    assert.deepStrictEqual(toasts, ['未找到输入框，已复制到剪贴板']);
    c.finishInputDispatch(false, 'boom', 1, 'x');
    assert.strictEqual(toasts[1], '输入失败，已复制到剪贴板');
    c.ClipHub.Clipboard.writeText = function () { throw new Error('denied'); };
    c.finishInputDispatch(false, 'No Input context', 1, 'y');
    assert.strictEqual(toasts[2], '未找到可输入的文本框', 'copy failure keeps the original message');
    c.finishInputDispatch(true, null, 1, 'z');
    assert.strictEqual(toasts[3], '已输入');
    var fn = filterSrc.slice(filterSrc.indexOf('    function scheduleInputAttempt('),
        filterSrc.indexOf('\n    function ', filterSrc.indexOf('    function scheduleInputAttempt(') + 5));
    assert.strictEqual((fn.match(/finishInputDispatch\(false,[\s\S]*?attempt, text\)/g) || []).length, 3,
        'every failure path in scheduleInputAttempt passes the text');
    assert(/sensitive: Number\(full\.is_sensitive \|\| 0\) === 1,/.test(filterSrc), 'card input passes sensitivity');
    console.log('PASS input fallback: copies full text (with sensitivity) when no input field, keeps old message on copy failure');
}());

/* ---------- 3. empty state distinguishes no data vs. no match ---------- */
(function () {
    function V() { this.children = []; }
    ['setOrientation', 'setGravity', 'setPadding', 'setContentDescription'].forEach(function (k) { V.prototype[k] = function () {}; });
    V.prototype.addView = function (v) { this.children.push(v); };
    V.prototype.setOnClickListener = function (l) { this.click = l.onClick; };
    var resets = 0;
    var c = vm.createContext({ Number: Number, String: String, state: {}, value: {}, appContext: {},
        LinearLayout: Object.assign(V, { VERTICAL: 1, LayoutParams: Object.assign(function () {}, { MATCH_PARENT: -1, WRAP_CONTENT: -2 }) }),
        Gravity: {}, View: { OnClickListener: {} }, dp: function (n) { return n; },
        JavaAdapter: function (t, impl) { return impl; },
        makeText: function (t) { var v = new V(); v.text = t; return v; },
        makeSecondaryButton: function (t) { var v = new V(); v.text = t; return v; },
        resetFromUi: function () { resets += 1; }, active: false });
    c.isActive = function () { return c.active; };
    loadFrom(filterSrc, 'makeEmptyResultView', c);
    var empty = c.makeEmptyResultView({});
    assert(/还没有剪贴板记录/.test(empty.children[0].text));
    assert.strictEqual(empty.children.length, 1, 'no clear button without filters');
    c.active = true;
    var filtered = c.makeEmptyResultView({});
    assert(/没有符合当前筛选/.test(filtered.children[0].text));
    assert.strictEqual(filtered.children[1].text, '清除筛选');
    filtered.children[1].click();
    assert.strictEqual(resets, 1, 'clear button resets criteria');
    assert(filterSrc.indexOf('剪切板') < 0, 'UI wording unified to 剪贴板');
    console.log('PASS empty state: no-data hint vs. filtered state with a working clear button; wording unified');
}());

/* ---------- 4. translation falls back to Google when unconfigured ---------- */
(function () {
    var tr = source('ch_12_translation.js');
    var calls = [];
    var c = vm.createContext({ Number: Number, String: String, initialized: true, translationState: {},
        isGoogleTranslateInstalled: function () { return c.googleInstalled; }, googleInstalled: true,
        showTranslationFallbackToast: function () { calls.push('toast'); },
        openGoogleTranslationForItem: function () { calls.push('google'); },
        openBuiltinTranslationForItem: function () { calls.push('builtin'); return 'b'; },
        getTranslationState: function () { return 's'; }, config: null });
    c.translationSettings = function () { return c.config; };
    function load(n) { var s0 = tr.indexOf('    function ' + n + '('); vm.runInContext(tr.slice(s0, tr.indexOf('\n    function ', s0 + 5)), c); }
    load('builtinProviderConfigured'); load('openTranslationForItem');
    c.config = { provider: 'baidu', baiduAppId: '', baiduSecret: '', youdaoAppKey: '', youdaoSecret: '' };
    c.openTranslationForItem(1);
    assert.deepStrictEqual(calls, ['toast', 'google'], 'unconfigured Baidu uses Google');
    calls.length = 0; c.config.baiduAppId = 'id'; c.config.baiduSecret = 'sec';
    c.openTranslationForItem(1);
    assert.deepStrictEqual(calls, ['builtin'], 'configured Baidu stays built-in');
    calls.length = 0; c.config = { provider: 'youdao', baiduAppId: '', baiduSecret: '', youdaoAppKey: '', youdaoSecret: '' };
    c.googleInstalled = false;
    c.openTranslationForItem(1);
    assert.deepStrictEqual(calls, ['builtin'], 'without Google installed the old configuration hint is shown');
    console.log('PASS translation fallback: unconfigured built-in provider uses installed Google Translate');
}());

/* ---------- 5. settings: new keys, cycling options, click action ---------- */
(function () {
    var c = vm.createContext({ Number: Number, String: String, Object: Object, Math: Math, isFinite: isFinite,
        DEFAULTS: { historyLimit: 0, autoCleanupDays: 0, themeMode: 'system', 'translation.max_chars': 5000 },
        values: { cardClickAction: 'input', closeAfterCopy: false } });
    ['intRange', 'normalizePackages', 'normalize', 'nextOption', 'clickActionLabel', 'historyLimitLabel',
        'retentionLabel', 'themeModeLabel'].forEach(function (n) {
        try { loadFrom(settingsSrc, n, c); } catch (e) { if (n !== 'intRange') { throw e; } }
    });
    if (typeof c.intRange !== 'function') { c.intRange = function (v, lo, hi, d) { v = Number(v); return isFinite(v) ? Math.max(lo, Math.min(hi, Math.floor(v))) : d; }; }
    assert.strictEqual(c.normalize('cardClickAction', 'copy'), 'copy');
    assert.strictEqual(c.normalize('cardClickAction', 'weird'), 'input');
    assert(/cardClickAction: "input"/.test(settingsSrc), 'default click action is input');
    assert.strictEqual(c.nextOption([0, 500, 2000, 5000], 0), 500);
    assert.strictEqual(c.nextOption([0, 500, 2000, 5000], 5000), 0);
    assert.strictEqual(c.nextOption([0, 7, 30, 90], 45), 0, 'unknown stored value restarts the cycle');
    assert.strictEqual(c.clickActionLabel(), '点击记录：输入');
    c.values.cardClickAction = 'copy'; assert.strictEqual(c.clickActionLabel(), '点击记录：复制');
    c.values.closeAfterCopy = true; assert.strictEqual(c.clickActionLabel(), '点击记录：复制并关闭');
    assert.strictEqual(c.historyLimitLabel(2000), '历史上限：2000 条');
    assert.strictEqual(c.retentionLabel(0), '保留：永久');
    assert.strictEqual(c.themeModeLabel('dark'), '主题：深色');
    var copies = 0, inputs = 0;
    var f = vm.createContext({ String: String, Number: Number, homeMulti: { active: false },
        ClipHub: { Settings: { get: function (k, d) { return f.mode; } } }, mode: 'copy',
        copyResultRow: function (row, origin) { copies += 1; assert.strictEqual(origin, 'card_click'); return true; },
        fullResultRowById: function () { inputs += 1; return null; }, showInputToast: function () {} });
    var a = filterSrc.indexOf('function inputResultRow(row, origin) {');
    vm.runInContext(filterSrc.slice(a, filterSrc.indexOf('\n    function copyResultRow', a)), f);
    f.inputResultRow({ id: 1 }, 'card_click');
    assert.strictEqual(copies, 1, 'copy mode routes card click to copy');
    f.inputResultRow({ id: 1 }, 'tokenizer_input');
    assert.strictEqual(inputs, 1, 'other origins still input');
    f.mode = 'input'; f.inputResultRow({ id: 1 }, 'card_click');
    assert.strictEqual(inputs, 2);
    assert(settingsSrc.indexOf('addSection(settingsGeneralTabView, makeRetentionSection(colors));') > 0,
        'retention section is shown on the general tab');
    /* cycling must not persist or clean up intermediate values */
    var posted = [], saved = [], toasts = [];
    var r = vm.createContext({ Number: Number, String: String, values: { historyLimit: 0, autoCleanupDays: 0 },
        uiState: {}, lastCleanup: null, retentionDraft: null, retentionCommitToken: 0,
        RETENTION_COMMIT_DELAY_MS: 4000, HISTORY_LIMIT_OPTIONS: [0, 500, 2000, 5000],
        postSettingsDelayed: function (cb, ms, attached) { posted.push(cb); assert.strictEqual(ms, 4000); return true; },
        setMany: function (d) { saved.push(JSON.parse(JSON.stringify(d))); r.lastCleanup = { totalDeleted: 7 }; },
        showSettingsToast: function (m) { toasts.push(m); }, updateRetentionButtons: function () {} });
    ['nextOption', 'retentionValue', 'commitRetentionDraft', 'stageRetentionChange'].forEach(function (n) { loadFrom(settingsSrc, n, r); });
    r.stageRetentionChange('historyLimit', r.nextOption(r.HISTORY_LIMIT_OPTIONS, r.retentionValue('historyLimit')), {});
    r.stageRetentionChange('historyLimit', r.nextOption(r.HISTORY_LIMIT_OPTIONS, r.retentionValue('historyLimit')), {});
    assert.strictEqual(r.retentionValue('historyLimit'), 2000, 'label follows the draft');
    assert.strictEqual(saved.length, 0, 'nothing persisted while cycling through 500');
    posted[0]();
    assert.strictEqual(saved.length, 0, 'superseded commit is ignored');
    posted[1]();
    assert.deepStrictEqual(saved, [{ historyLimit: 2000 }], 'only the settled value is saved');
    assert.strictEqual(toasts[0], '已保存，并按新设置清理 7 条记录');
    console.log('PASS settings: click action, theme, history limit and retention options wired');
}());

/* ---------- 6. recycle bin, visible-only history limit, permanent wipe ---------- */
(function () {
    var db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('CREATE TABLE clipboard_items (id INTEGER PRIMARY KEY, content TEXT, deleted_at INTEGER, ' +
        'is_pinned INTEGER DEFAULT 0, last_copied_at INTEGER DEFAULT 0, updated_at INTEGER DEFAULT 0)');
    db.exec('CREATE TABLE clipboard_item_tags (item_id INTEGER, tag_id INTEGER, ' +
        'FOREIGN KEY (item_id) REFERENCES clipboard_items(id) ON DELETE CASCADE)');
    var day = 86400000, now = 100 * day, sqls = [];
    var hub = { Base: { now: function () { return now; } }, Database: {
        isOpen: function () { return true; },
        executeUpdateDelete: function (sql, args) { var st = db.prepare(sql); return Number(st.run.apply(st, args || []).changes); },
        execute: function (sql) { sqls.push(sql); db.exec(sql); return true; },
        scalarLong: function (sql, args, d) { var r = db.prepare(sql).get.apply(db.prepare(sql), args || []); return r ? Number(r.count) : d; },
        transaction: function (fn) { return fn(); } } };
    function pkgStub() { return new Proxy(function () {}, { get: function (t, k) { if (!(k in t)) { t[k] = pkgStub(); } return t[k]; } }); }
    var ctx = vm.createContext({ Packages: pkgStub(), ClipHub: hub });
    vm.runInContext(source('ch_06_repository.js').replace('var ready = false;', 'var ready = true;'), ctx);
    var R = hub.Repository;
    function add(id, deletedAt, pinned, copied) {
        db.prepare('INSERT INTO clipboard_items(id,content,deleted_at,is_pinned,last_copied_at) VALUES (?,?,?,?,?)')
            .run(id, 'c' + id, deletedAt, pinned ? 1 : 0, copied);
        db.prepare('INSERT INTO clipboard_item_tags(item_id, tag_id) VALUES (?, 1)').run(id);
    }
    add(1, now - 40 * day, 0, 1); add(2, now - 10 * day, 0, 2); add(3, null, 0, 3);
    add(4, null, 0, 4); add(5, null, 1, 5); add(6, null, 0, 6);
    assert.strictEqual(R.RECYCLE_RETENTION_DAYS, 30);
    assert.strictEqual(R.countRecycleBin(), 2);
    var result = R.cleanupHistory({ historyLimit: 2, autoCleanupDays: 0, referenceAt: now });
    assert.strictEqual(result.recyclePurged, 1, 'only the 40-day-old deletion is purged');
    assert.strictEqual(result.overflowDeleted, 1, 'limit counts visible unpinned records only');
    var ids = db.prepare('SELECT id FROM clipboard_items ORDER BY id').all().map(function (r) { return r.id; });
    assert.deepStrictEqual(ids, [2, 4, 5, 6], 'recent deletion kept, oldest visible trimmed, pinned kept');
    assert.strictEqual(Number(db.prepare('SELECT COUNT(*) AS n FROM clipboard_item_tags').get().n), 4, 'tag links cascade');
    var cleanup = R.cleanupHistory({ historyLimit: 0, autoCleanupDays: 0, referenceAt: now + 30 * day });
    assert.strictEqual(cleanup.recyclePurged, 1, 'recycle bin ages out even with no limit configured');
    assert.strictEqual(R.purgeAllItems(), 3, 'permanent wipe removes everything left');
    assert.strictEqual(Number(db.prepare('SELECT COUNT(*) AS n FROM clipboard_items').get().n), 0);
    assert.deepStrictEqual(sqls, ['VACUUM'], 'database file is compacted after a wipe');
    var clip = source('ch_04_clipboard.js');
    assert(clip.indexOf('if (historyLimit <= 0 && autoCleanupDays <= 0) { return null; }') < 0,
        'clipboard cleanup no longer skips when limits are off');
    console.log('PASS retention: 30-day recycle purge, visible-only limit, pinned kept, cascade, permanent wipe + VACUUM');
}());

/* ---------- 7. cached home panel is rebuilt when the palette changes ---------- */
(function () {
    assert(/panelBuiltPaletteKey !== paletteCacheKey\(colors\)\) \{[\s\S]{0,200}destroyPanelCache\("palette_changed"\)/.test(filterSrc),
        'palette change destroys the cached panel before reuse');
    assert(/panelBuiltPaletteKey = paletteCacheKey\(colors\);/.test(filterSrc), 'palette recorded at build');
    console.log('PASS theme: cached home panel rebuilds after theme or system dark-mode change');
}());
