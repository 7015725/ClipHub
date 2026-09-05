/* Offline regression: production Clipboard (including private recordText), packed
 * Repository and Database schema migrations; node:sqlite uses only :memory:.
 * Run: node scripts/test_home_multiselect_clipboard.js
 * Boundaries: Android/Java and the Database transport are mocked. Repository's
 * readiness flag is exposed to skip unrelated regex-rule bootstrapping. Public
 * Clipboard APIs and their implementation bodies execute unchanged.
 * orderedPayload isolates backend cases; final cases execute actual Filter
 * selection/confirmation functions through the same backend. No device I/O. */
var assert = require('assert');
var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var zlib = require('zlib');
var DatabaseSync = require('node:sqlite').DatabaseSync;
var root = path.resolve(__dirname, '..');
var passed = 0;
var failed = 0;

function source(name) {
    var text = fs.readFileSync(path.join(root, 'src', name), 'utf8');
    var match = /\bvar\s+(?:PACKED_B64|encoded)\s*=\s*([\s\S]*?);/.exec(text);
    if (!match) { return text; }
    return zlib.gunzipSync(Buffer.from(match[1].match(/"(?:\\.|[^"\\])*"/g)
        .map(function (part) { return JSON.parse(part); }).join(''), 'base64')).toString('utf8');
}
function replaceOnce(text, marker, replacement) {
    assert.strictEqual(text.split(marker).length, 2, 'fixture seam must be unique: ' + marker);
    return text.replace(marker, replacement);
}
function plain(value) { return JSON.parse(JSON.stringify(value)); }

function fixture() {
    var db = new DatabaseSync(':memory:');
    var events = [];
    var tick = 1000;
    var writes = 0;
    var clipWrites = 0;
    var depth = 0;
    var lockDepth = 0;
    var failures = {clipboard: false, extras: false, commit: false};
    var primary = null;
    var packages;
    var hub;
    var ctx;
    var migrations;
    var schemaSource = source('ch_03_database.js');
    var schemaStart = schemaSource.indexOf('    var MIGRATIONS = {');
    var schemaEnd = schemaSource.indexOf('\n    function requireOpen()', schemaStart);
    var schemaVersion = Number(/var SCHEMA_VERSION = (\d+);/.exec(schemaSource)[1]);
    assert(schemaStart >= 0 && schemaEnd > schemaStart, 'production migration block available');
    migrations = vm.runInNewContext('(function () {' +
        schemaSource.slice(schemaStart, schemaEnd) + 'return MIGRATIONS;}())');
    db.exec('PRAGMA foreign_keys = ON');
    for (var version = 1; version <= schemaVersion; version += 1) {
        assert.strictEqual(typeof migrations[version], 'function');
        migrations[version]({execSQL: function (sql) { db.exec(sql); }});
    }
    function query(sql, args, all) {
        var statement = db.prepare(sql);
        var result = statement[all ? 'all' : 'get'].apply(statement, args || []);
        return all ? result : result || null;
    }
    function write(sql, args, insert) {
        var statement = db.prepare(sql);
        writes += 1;
        var result = statement.run.apply(statement, args || []);
        // Android SQLiteStatement.executeInsert returns -1 on an ignored insert.
        return insert ? (Number(result.changes) ? Number(result.lastInsertRowid) : -1) :
            Number(result.changes);
    }
    function makeClip(label, text) {
        var description = {
            extras: null,
            setExtras: function (extras) {
                if (failures.extras) { throw new Error('injected sensitive extras failure'); }
                this.extras = extras;
            },
            getExtras: function () { return this.extras; },
            hasMimeType: function (mime) { return mime === 'text/plain'; }
        };
        return {
            label: label, text: text,
            getDescription: function () { return description; },
            getItemCount: function () { return 1; },
            getItemAt: function () { return {getText: function () { return text; }}; }
        };
    }
    var manager = {
        setPrimaryClip: function (clip) {
            if (failures.clipboard) { throw new Error('injected ClipboardManager failure'); }
            clipWrites += 1;
            primary = clip;
        },
        getPrimaryClip: function () { return primary; },
        getPrimaryClipSource: function () { return 'fixture.source'; },
        addPrimaryClipChangedListener: function () {},
        removePrimaryClipChangedListener: function () {}
    };
    packages = {
        android: {
            content: {
                Context: {CLIPBOARD_SERVICE: 'clipboard'},
                ClipData: {newPlainText: makeClip},
                ClipboardManager: {OnPrimaryClipChangedListener: function () {}}
            },
            os: {
                Build: {VERSION: {SDK_INT: 33}},
                PersistableBundle: function () {
                    this.values = {};
                    this.putBoolean = function (key, value) { this.values[key] = value; };
                    this.getBoolean = function (key, fallback) {
                        return key in this.values ? this.values[key] : fallback;
                    };
                }
            }
        },
        java: {
            lang: {
                String: function (value) {
                    this.getBytes = function (encoding) {
                        assert.strictEqual(encoding, 'UTF-8');
                        return Buffer.from(value, 'utf8');
                    };
                },
                System: {},
                Thread: {currentThread: function () {
                    return {getName: function () { return 'offline-worker'; },
                        getId: function () { return 1; }};
                }}
            },
            security: {MessageDigest: {getInstance: function (algorithm) {
                assert.strictEqual(algorithm, 'SHA-256');
                return {digest: function (bytes) {
                    return Array.from(crypto.createHash('sha256').update(bytes).digest())
                        .map(function (byte) { return byte > 127 ? byte - 256 : byte; });
                }};
            }}},
            util: {concurrent: {locks: {ReentrantLock: function () {
                this.lock = function () { lockDepth += 1; };
                this.unlock = function () { lockDepth -= 1; };
            }}}}
        }
    };
    hub = {
        Base: {now: function () { tick += 1; return tick; }},
        Database: {
            isOpen: function () { return true; },
            queryOne: function (sql, args) { return query(sql, args, false); },
            queryAll: function (sql, args) { return query(sql, args, true); },
            executeInsert: function (sql, args) { return write(sql, args, true); },
            executeUpdateDelete: function (sql, args) { return write(sql, args, false); },
            transaction: function (fn) {
                var savepoint = 'clipboard_' + depth;
                depth += 1;
                db.exec('SAVEPOINT ' + savepoint);
                try {
                    var result = fn();
                    if (failures.commit) { throw new Error('injected commit failure'); }
                    db.exec('RELEASE ' + savepoint);
                    return result;
                } catch (error) {
                    db.exec('ROLLBACK TO ' + savepoint);
                    db.exec('RELEASE ' + savepoint);
                    throw error;
                } finally { depth -= 1; }
            }
        },
        EventBus: {emit: function (name, payload) { events.push({name: name, payload: plain(payload)}); }}
    };
    ctx = vm.createContext({Packages: packages, ClipHub: hub,
        JavaAdapter: function (type, implementation) { return implementation; }});
    vm.runInContext(replaceOnce(source('ch_06_repository.js'),
        'var ready = false;', 'var ready = true;'), ctx, {filename: 'ch_06_repository.expanded.js'});
    vm.runInContext(source('ch_04_clipboard.js'), ctx, {filename: 'ch_04_clipboard.js'});
    hub.Clipboard.init({androidContext: {
        getPackageManager: function () { return null; },
        getSystemService: function (service) { return service === 'clipboard' ? manager : null; }
    }});
    return {
        db: db, hub: hub, context: ctx, events: events, failures: failures,
        clipboard: hub.Clipboard, repo: hub.Repository,
        record: function (text, options) {
            return hub.Clipboard.recordManualText(text, options);
        },
        seed: function (text, sensitive, pinned) {
            return hub.Repository.insertItem({content: text, isSensitive: sensitive === true,
                isPinned: pinned === true, sourcePackage: 'original.source', sourceLabel: 'Original'});
        },
        rows: function () { return plain(query('SELECT * FROM clipboard_items ORDER BY id', [], true)); },
        writes: function () { return writes; },
        clipWrites: function () { return clipWrites; },
        primary: function () { return primary; },
        close: function () {
            try { hub.Clipboard.shutdown(); db.close(); }
            finally { assert.strictEqual(lockDepth, 0, 'processing lock released'); }
        }
    };
}

// Caller boundary: use actual list ordering/previews and fetch actual complete rows.
// Dedicated Filter tests must verify the UI performs this composition itself.
function orderedPayload(f, selected) {
    var previews = f.repo.listItems({previewOnly: true, limit: 100});
    var rows = previews.filter(function (row) { return selected.indexOf(row.id) >= 0; })
        .map(function (row) { return f.repo.getItem(row.id, false); });
    return {
        text: rows.map(function (row) { return row.content; }).join('\n\n'),
        sensitive: rows.some(function (row) { return Number(row.is_sensitive) === 1; }),
        ids: rows.map(function (row) { return row.id; })
    };
}
function options(payload) {
    return {sensitive: payload.sensitive, origin: 'home_multi_merge',
        sourcePackage: 'cliphub', sourceLabel: '多选合并', haptic: false};
}
function assertFailed(result) {
    assert.strictEqual(result.ok, false, 'failed backend operation must return ok:false');
    assert.notStrictEqual(result.recorded, true, 'failed operation must not report recorded:true');
}
function successEvents(f) {
    return f.events.filter(function (event) {
        return event.name === 'clipboard_added' || event.name === 'clipboard_merged';
    });
}
function test(name, fn) {
    var f;
    try {
        f = fixture();
        fn(f);
        f.close(); f = null;
        passed += 1;
        console.log('PASS ' + name);
    } catch (error) {
        failed += 1;
        console.error('FAIL ' + name + '\n' + error.stack);
    } finally { if (f) { f.close(); } }
}

test('Clipboard exposes the manual-record API required by home multi-merge', function (f) {
    assert.strictEqual(typeof f.clipboard.recordManualText, 'function',
        'Clipboard.recordManualText must be publicly exported');
});

test('manual merge stores full list-ordered text, sensitive OR and preserves originals', function (f) {
    var first = f.seed('Pinned 开头\n' + '长正文🙂'.repeat(90) + '\r\nTAIL-A', false, true);
    var second = f.seed('Sensitive 第二段\n' + 'β'.repeat(300) + '\nTAIL-B', true);
    var before = f.rows();
    var payload = orderedPayload(f, [second, first]);
    assert.deepStrictEqual(Array.from(payload.ids), [first, second], 'list order dominates click order');
    assert.strictEqual(payload.text, before[0].content + '\n\n' + before[1].content);
    var result = f.record(payload.text, options(payload));
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.recorded, true);
    assert.strictEqual(result.inserted, true);
    var row = f.repo.getItem(result.id, false);
    assert.strictEqual(row.content, payload.text);
    assert.strictEqual(row.is_sensitive, 1);
    assert.strictEqual(row.source_package, 'cliphub');
    assert.strictEqual(row.source_label, '多选合并');
    assert.strictEqual(row.content_type, 'text');
    assert.deepStrictEqual(f.rows().slice(0, 2), before);
    assert.strictEqual(f.rows().length, 3);
    assert.strictEqual(f.clipWrites(), 0, 'manual merge changes only history');
    assert.strictEqual(f.events.length, 1);
    assert.strictEqual(f.events[0].name, 'clipboard_added');
    assert.strictEqual(f.events[0].payload.sensitive, true);
});

test('repeating the same merge deduplicates by hash and preserves original rows', function (f) {
    var a = f.seed('A body', true);
    var b = f.seed('B body', false);
    var before = f.rows();
    var payload = orderedPayload(f, [a, b]);
    var first = f.record(payload.text, options(payload));
    var second = f.record(payload.text, options(payload));
    assert.strictEqual(second.ok, true);
    assert.strictEqual(second.id, first.id);
    assert.strictEqual(second.inserted, false);
    assert.strictEqual(second.merged, true);
    assert.strictEqual(second.copyCount, 2);
    assert.strictEqual(f.repo.getItem(first.id).copy_count, 2);
    assert.strictEqual(f.repo.getItem(first.id).is_sensitive, 1);
    assert.strictEqual(f.rows().length, 3);
    assert.deepStrictEqual(f.rows().slice(0, 2), before);
    assert.deepStrictEqual(f.events.map(function (e) { return e.name; }),
        ['clipboard_added', 'clipboard_merged']);
});

test('normalization deduplicates CRLF/outer whitespace while storing the supplied full text', function (f) {
    var first = f.record('  A\r\nB  ', {sensitive: false});
    var second = f.record('A\nB', {sensitive: true});
    assert.strictEqual(second.id, first.id);
    assert.strictEqual(second.merged, true);
    assert.strictEqual(second.hash, crypto.createHash('sha256').update('A\nB').digest('hex'));
    assert.strictEqual(f.rows().length, 1);
    assert.strictEqual(f.rows()[0].content, 'A\nB');
    assert.strictEqual(f.rows()[0].is_sensitive, 1);
});

test('a plain merge keeps its new record non-sensitive', function (f) {
    var a = f.seed('plain A', false);
    var b = f.seed('plain B', false);
    var payload = orderedPayload(f, [a, b]);
    var result = f.record(payload.text, options(payload));
    assert.strictEqual(result.ok, true);
    assert.strictEqual(f.repo.getItem(result.id).is_sensitive, 0);
    assert.strictEqual(result.event.sensitive, false);
});

test('copy writes full text and Android sensitive extras without changing history', function (f) {
    var a = f.seed('A'.repeat(350) + '\nTAIL-A', false, true);
    var b = f.seed('B'.repeat(350) + '\nTAIL-B', true);
    var before = f.rows();
    var payload = orderedPayload(f, [b, a]);
    var result = f.clipboard.writeText(payload.text, options(payload));
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.written, true);
    assert.strictEqual(result.contentLength, payload.text.length);
    assert.strictEqual(result.sensitive, true);
    assert.strictEqual(f.primary().text, payload.text);
    assert.strictEqual(f.primary().getDescription().getExtras()
        .getBoolean('android.content.extra.IS_SENSITIVE', false), true);
    assert.strictEqual(f.clipWrites(), 1);
    assert.deepStrictEqual(f.rows(), before);
    assert.strictEqual(f.events.length, 0);
});

test('plain copy has full whitespace/Unicode and no sensitive extras', function (f) {
    var text = '  中文🙂\r\nsecond line\t  ';
    var result = f.clipboard.writeText(text, {sensitive: false, haptic: false, label: 'batch'});
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.sensitive, false);
    assert.strictEqual(f.primary().text, text);
    assert.strictEqual(f.primary().label, 'batch');
    assert.strictEqual(f.primary().getDescription().getExtras(), null);
    assert.strictEqual(f.rows().length, 0);
});

test('copy exactly at maxChars succeeds; excess text causes zero writes', function (f) {
    f.clipboard.configure({maxChars: 8});
    assert.strictEqual(f.clipboard.writeText('12345678', {haptic: false}).ok, true);
    var before = plain(f.clipboard.getState().ownWrite);
    assert.throws(function () { f.clipboard.writeText('123456789', {sensitive: true}); }, /exceeds limit/);
    assert.strictEqual(f.primary().text, '12345678');
    assert.strictEqual(f.clipWrites(), 1);
    assert.strictEqual(f.writes(), 0);
    assert.deepStrictEqual(plain(f.clipboard.getState().ownWrite), before);
});

test('manual merge exactly at maxChars succeeds; excess text causes zero DB writes', function (f) {
    f.clipboard.configure({maxChars: 8});
    assert.strictEqual(f.record('12345678', {sensitive: true}).ok, true);
    var before = f.rows();
    var count = f.writes();
    var state = plain(f.clipboard.getState());
    var result = f.record('123456789', {sensitive: true});
    assertFailed(result);
    assert.strictEqual(result.reason, 'text_too_large');
    assert.strictEqual(f.writes(), count);
    assert.deepStrictEqual(f.rows(), before);
    assert.deepStrictEqual(plain(f.clipboard.getState()), state);
    assert.strictEqual(f.clipWrites(), 0);
});

test('manual empty/blank text is rejected before transactions or success events', function (f) {
    [null, undefined, '', ' \r\n\t '].forEach(function (value) { assertFailed(f.record(value)); });
    assert.strictEqual(f.writes(), 0);
    assert.strictEqual(f.events.length, 0);
    assert.strictEqual(f.rows().length, 0);
});

test('ClipboardManager failure throws and clears own-write suppression', function (f) {
    f.clipboard.writeText('original clipboard', {haptic: false});
    f.failures.clipboard = true;
    assert.throws(function () { f.clipboard.writeText('new sensitive text', {sensitive: true}); },
        /injected ClipboardManager failure/);
    assert.strictEqual(f.primary().text, 'original clipboard');
    assert.strictEqual(f.clipWrites(), 1);
    assert.strictEqual(f.clipboard.getState().ownWrite.hash, '');
    assert.strictEqual(f.clipboard.getState().copyHapticCount, 0);
    assert.strictEqual(f.writes(), 0);
    f.failures.clipboard = false;
    assert.strictEqual(f.clipboard.writeText('retry', {haptic: false}).ok, true);
});

test('sensitive extras failure aborts copy before ClipboardManager receives text', function (f) {
    f.failures.extras = true;
    assert.throws(function () { f.clipboard.writeText('sensitive secret', {sensitive: true}); },
        /injected sensitive extras failure/);
    assert.strictEqual(f.clipWrites(), 0);
    assert.strictEqual(f.primary(), null);
    assert.strictEqual(f.clipboard.getState().ownWrite.hash, '');
    assert.strictEqual(f.writes(), 0);
});

test('repository unavailability returns a manual-record failure without success events', function (f) {
    f.repo.shutdown();
    var result = f.record('unavailable repository', {sensitive: true});
    assertFailed(result);
    assert.match(result.error, /repository is not ready/);
    assert.strictEqual(f.rows().length, 0);
    assert.strictEqual(successEvents(f).length, 0);
    assert.strictEqual(f.events[0].name, 'clipboard_error');
});

test('SQL insert exception reports failure, preserves originals and permits retry', function (f) {
    f.seed('original', true);
    var before = f.rows();
    f.db.exec("CREATE TRIGGER reject_insert BEFORE INSERT ON clipboard_items BEGIN SELECT RAISE(ABORT, 'injected insert failure'); END");
    var result = f.record('merged result', {sensitive: true});
    assertFailed(result);
    assert.match(result.error, /injected insert failure/);
    assert.deepStrictEqual(f.rows(), before);
    assert.strictEqual(successEvents(f).length, 0);
    assert.strictEqual(f.clipboard.getState().handledCount, 0);
    f.db.exec('DROP TRIGGER reject_insert');
    assert.strictEqual(f.record('merged result', {sensitive: true}).ok, true);
});

test('SQL update exception keeps duplicate content/count/privacy unchanged', function (f) {
    var id = f.seed('merged result', true);
    var before = f.rows();
    f.db.exec("CREATE TRIGGER reject_update BEFORE UPDATE ON clipboard_items BEGIN SELECT RAISE(ABORT, 'injected update failure'); END");
    var result = f.record(' merged result ', {sensitive: false});
    assertFailed(result);
    assert.match(result.error, /injected update failure/);
    assert.deepStrictEqual(f.rows(), before);
    assert.strictEqual(successEvents(f).length, 0);
    f.db.exec('DROP TRIGGER reject_update');
    var retry = f.record('merged result', {sensitive: true});
    assert.strictEqual(retry.id, id);
    assert.strictEqual(retry.copyCount, 2);
});

test('transaction commit failure rolls back inserted data before reporting failure', function (f) {
    f.seed('original', true);
    var before = f.rows();
    f.failures.commit = true;
    var result = f.record('merged result', {sensitive: true});
    assertFailed(result);
    assert.match(result.error, /injected commit failure/);
    assert.deepStrictEqual(f.rows(), before);
    assert.strictEqual(successEvents(f).length, 0);
    assert.strictEqual(f.clipboard.getState().insertedCount, 0);
    f.failures.commit = false;
    assert.strictEqual(f.record('merged result', {sensitive: true}).ok, true);
});

test('zero-row duplicate update must report failure instead of a successful merge', function (f) {
    f.seed('duplicate result', false);
    var before = f.rows();
    f.db.exec('CREATE TRIGGER ignore_update BEFORE UPDATE ON clipboard_items BEGIN SELECT RAISE(IGNORE); END');
    var result = f.record('duplicate result', {sensitive: true});
    assert.deepStrictEqual(f.rows(), before);
    assertFailed(result);
    assert.strictEqual(successEvents(f).length, 0);
});

test('ignored insert returning -1 must report failure without an added event', function (f) {
    f.db.exec('CREATE TRIGGER ignore_insert BEFORE INSERT ON clipboard_items BEGIN SELECT RAISE(IGNORE); END');
    var result = f.record('ignored insert', {sensitive: true});
    assert.strictEqual(f.rows().length, 0);
    assertFailed(result);
    assert.strictEqual(successEvents(f).length, 0);
});

function filterFixture(f, ids) {
    var c = f.context;
    var filter = process.argv[2] ? fs.readFileSync(process.argv[2], 'utf8') : source('ch_11_filter.js');
    c.HOME_MULTI_LIMIT = 100;
    c.homeMulti = {active: false, ids: [], confirmation: null, generation: 0, busy: false, message: '', more: false};
    c.rootMode = true;
    c.primaryShellPageId = '';
    c.state = {panelAttached: true};
    c.previewRows = ids.map(function (id) { return {id: id, content: 'preview only', content_truncated: 1}; });
    c.syncHomeMultiUi = function () {};
    c.cancelActiveSwipe = c.hideKeyboardOnMain = c.refreshPrimaryResults = function () {};
    ['homeMultiIds', 'exitHomeMulti', 'beginHomeMulti', 'toggleHomeMulti', 'fullResultRowById',
        'readHomeMultiText', 'copyHomeMulti', 'requestHomeMultiMerge', 'confirmHomeMultiMerge',
        'cancelHomeMultiConfirm'].forEach(function (name) {
        var start = filter.indexOf('    function ' + name + '(');
        assert(start >= 0, 'real Filter function missing: ' + name);
        var end = filter.indexOf('\n    function ', start + 5);
        vm.runInContext(filter.slice(start, end), c, {filename: name + '.js'});
    });
    assert.strictEqual(c.beginHomeMulti(), true);
    return c;
}

test('real Filter selection copies full ordered content through the public Clipboard API', function (f) {
    var a = f.seed('first full text ' + '甲'.repeat(350), false);
    var b = f.seed('second full text ' + '乙'.repeat(350), true);
    var before = f.rows();
    var c = filterFixture(f, [b, a]);
    c.toggleHomeMulti(a); c.toggleHomeMulti(b);
    assert.strictEqual(c.copyHomeMulti(), true);
    assert.strictEqual(f.primary().text, f.repo.getItem(b, false).content + '\n' + f.repo.getItem(a, false).content);
    assert.strictEqual(f.primary().getDescription().getExtras().getBoolean(f.clipboard.SENSITIVE_KEY, false), true);
    assert.deepStrictEqual(f.rows(), before, 'batch copy preserves stored records');
    assert.strictEqual(c.homeMulti.busy, false);
});

test('real Filter merge confirmation saves through real Clipboard and Repository and rejects stale callbacks', function (f) {
    var a = f.seed('alpha original', false);
    var b = f.seed('beta private original', true);
    var originals = f.rows();
    var c = filterFixture(f, [b, a]);
    c.toggleHomeMulti(a); c.toggleHomeMulti(b);
    var cancelled = c.requestHomeMultiMerge();
    c.cancelHomeMultiConfirm();
    assert.strictEqual(c.confirmHomeMultiMerge(cancelled), false);
    assert.deepStrictEqual(f.rows(), originals);
    var snapshot = c.requestHomeMultiMerge();
    assert.strictEqual(c.confirmHomeMultiMerge(snapshot), true);
    var rows = f.rows();
    assert.strictEqual(rows.length, 3);
    assert.deepStrictEqual(rows.slice(0, 2), originals);
    assert.strictEqual(rows[2].content, 'beta private original\n\nalpha original');
    assert.strictEqual(rows[2].is_sensitive, 1);
    assert.strictEqual(successEvents(f).length, 1);
    assert.strictEqual(f.clipWrites(), 0, 'merge saves history without overwriting system clipboard');
    assert.strictEqual(c.homeMulti.active, false);
    assert.strictEqual(c.confirmHomeMultiMerge(snapshot), false);
});

test('real Filter merge preserves selection and original rows after a failed commit', function (f) {
    var a = f.seed('alpha', false);
    var b = f.seed('beta', true);
    var before = f.rows();
    var c = filterFixture(f, [a, b]);
    c.toggleHomeMulti(a); c.toggleHomeMulti(b);
    var snapshot = c.requestHomeMultiMerge();
    f.failures.commit = true;
    assert.strictEqual(c.confirmHomeMultiMerge(snapshot), false);
    assert.deepStrictEqual(f.rows(), before);
    assert.strictEqual(successEvents(f).length, 0);
    assert.strictEqual(c.homeMulti.active, true);
    assert.deepStrictEqual(Array.from(c.homeMulti.ids), [a, b]);
    assert.strictEqual(c.homeMulti.busy, false);
    assert(c.homeMulti.message.indexOf('合并失败') >= 0);
    f.failures.commit = false;
    assert.strictEqual(c.confirmHomeMultiMerge(c.requestHomeMultiMerge()), true);
});

test('real Filter merge preserves source records when history cleanup is enabled', function (f) {
    var a = f.seed('source alpha', false);
    var b = f.seed('source beta', false);
    var before = f.rows();
    f.hub.Base.now = function () { return 200000000; };
    f.hub.Settings = {get: function (key, fallback) { return key === 'historyLimit' ? 2 : fallback; }};
    var c = filterFixture(f, [a, b]);
    c.toggleHomeMulti(a); c.toggleHomeMulti(b);
    assert.strictEqual(c.confirmHomeMultiMerge(c.requestHomeMultiMerge()), true);
    assert.deepStrictEqual(f.rows().slice(0, 2), before, 'merge must preserve selected sources even at the history limit');
    assert.strictEqual(f.rows().length, 3);
});

test('real Filter merge keeps an existing sensitive duplicate protected', function (f) {
    var existing = f.seed('alpha\n\nbeta', true);
    var a = f.seed('alpha', false);
    var b = f.seed('beta', false);
    var c = filterFixture(f, [a, b]);
    c.toggleHomeMulti(a); c.toggleHomeMulti(b);
    assert.strictEqual(c.confirmHomeMultiMerge(c.requestHomeMultiMerge()), true);
    assert.strictEqual(f.rows().length, 3);
    assert.strictEqual(f.repo.getItem(existing, false).is_sensitive, 1, 'merge must preserve existing duplicate privacy');
    assert.strictEqual(successEvents(f)[0].payload.sensitive, true, 'event must describe the persisted sensitivity');
});

test('ordinary manual recording retains configured history cleanup', function (f) {
    var oldest = f.seed('oldest', false);
    f.seed('newer', false);
    f.hub.Base.now = function () { return 200000000; };
    f.hub.Settings = {get: function (key, fallback) { return key === 'historyLimit' ? 2 : fallback; }};
    assert.strictEqual(f.record('ordinary manual content', {}).ok, true);
    assert.strictEqual(f.rows().length, 2);
    assert.strictEqual(f.repo.getItem(oldest, true), null);
});

console.log('RESULT ' + passed + ' passed, ' + failed + ' failed');
process.exitCode = failed ? 1 : 0;
