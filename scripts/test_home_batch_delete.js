/* Offline behavior tests: production List/Repository + in-memory SQLite.
 * Android classes/context are mocked. No live ShortX or clipboard access. */
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
function fixture() {
    var db = new DatabaseSync(':memory:');
    var events = [];
    var tick = 1000;
    var writes = 0;
    var failWrite = 0;
    var depth = 0;
    var transactionCount = 0;
    db.exec('CREATE TABLE clipboard_items (id INTEGER PRIMARY KEY, content TEXT, ' +
        'normalized_hash TEXT, deleted_at INTEGER, updated_at INTEGER, ' +
        'is_pinned INTEGER DEFAULT 0, last_copied_at INTEGER DEFAULT 0)');
    function packageStub() {
        return new Proxy(function () {}, {get: function (target, key) {
            if (!(key in target)) { target[key] = packageStub(); }
            return target[key];
        }});
    }
    var packages = packageStub();
    packages.java.lang.Thread.currentThread = function () {
        return {getName: function () { return 'mock-worker'; }, getId: function () { return 1; }};
    };
    var hub = {
        Base: {now: function () { tick += 1; return tick; }},
        Database: {
            isOpen: function () { return true; },
            queryOne: function (sql, args) { return db.prepare(sql).get.apply(db.prepare(sql), args || []) || null; },
            executeUpdateDelete: function (sql, args) {
                writes += 1;
                if (writes === failWrite) { throw new Error('injected write failure'); }
                var statement = db.prepare(sql);
                return Number(statement.run.apply(statement, args || []).changes);
            },
            transaction: function (fn) {
                var savepoint = 'batch_' + depth;
                depth += 1;
                transactionCount += 1;
                db.exec('SAVEPOINT ' + savepoint);
                try {
                    var result = fn();
                    db.exec('RELEASE ' + savepoint);
                    return result;
                } catch (error) {
                    db.exec('ROLLBACK TO ' + savepoint);
                    db.exec('RELEASE ' + savepoint);
                    throw error;
                } finally { depth -= 1; }
            }
        },
        Filter: {isActive: function () { return true; }, query: function () { return []; }},
        EventBus: {emit: function (name, payload) { events.push({name: name, payload: payload}); }}
    };
    var ctx = vm.createContext({Packages: packages, ClipHub: hub});
    // Expose only the Repository readiness state; methods execute unchanged.
    vm.runInContext(source('ch_06_repository.js').replace('var ready = false;', 'var ready = true;'), ctx);
    vm.runInContext(source('ch_09_list.js'), ctx);
    var android = {
        getApplicationContext: function () { return this; },
        getSystemService: function () { return {}; },
        getResources: function () { return {getDisplayMetrics: function () { return {density: 1}; }}; }
    };
    hub.List.init({androidContext: android});
    function add(id, deletedAt, hash) {
        db.prepare('INSERT INTO clipboard_items(id,content,normalized_hash,deleted_at,updated_at) VALUES (?,?,?,?,?)')
            .run(id, 'fixture-' + id, hash || 'hash-' + id, deletedAt === undefined ? null : deletedAt, 1);
    }
    return {
        list: hub.List, hub: hub, context: ctx, db: db, events: events, add: add,
        ids: function (values) { return vm.runInContext(JSON.stringify(values), ctx); },
        row: function (id) { return db.prepare('SELECT * FROM clipboard_items WHERE id=?').get(id); },
        failNext: function (offset) { failWrite = writes + offset; },
        transactionCount: function () { return transactionCount; }
    };
}
function test(name, fn) { fn(); console.log('PASS ' + name); }
test('batch soft-deletes only distinct selected active IDs and emits one event', function () {
    var f = fixture();
    f.add(1); f.add(2); f.add(3); f.add(4, 77);
    assert.strictEqual(typeof f.list.deleteItems, 'function', 'List.deleteItems must support a selected ID batch');
    var result = f.list.deleteItems(f.ids([1, 2, 2, 4, 999]));
    assert.strictEqual(result.count, 2);
    assert.deepStrictEqual(Array.from(result.itemIds), [1, 2]);
    assert.strictEqual(f.row(1).deleted_at, result.deletedAt);
    assert.strictEqual(f.row(2).deleted_at, result.deletedAt);
    assert.strictEqual(f.row(3).deleted_at, null);
    assert.strictEqual(f.row(4).deleted_at, 77);
    assert.strictEqual(f.events.length, 1);
    assert.strictEqual(f.events[0].name, 'clipboard_deleted');
    assert.deepStrictEqual(Array.from(f.events[0].payload.itemIds), [1, 2]);
    assert.strictEqual(f.transactionCount(), 1);
    f.db.close();
});
test('one undo restores the whole batch while respecting a newer deletion', function () {
    var f = fixture();
    f.add(1); f.add(2); f.add(3);
    var result = f.list.deleteItems(f.ids([1, 2, 3]));
    f.db.prepare('UPDATE clipboard_items SET deleted_at=? WHERE id=3').run(result.deletedAt + 9);
    assert.strictEqual(f.list.undoLastDelete(), true);
    assert.strictEqual(f.row(1).deleted_at, null);
    assert.strictEqual(f.row(2).deleted_at, null, 'second item must be restored in the same undo');
    assert.strictEqual(f.row(3).deleted_at, result.deletedAt + 9);
    assert.strictEqual(f.events.length, 2);
    assert.deepStrictEqual(Array.from(f.events[1].payload.itemIds), [1, 2]);
    assert.strictEqual(f.list.undoLastDelete(), false);
    f.db.close();
});
test('a failed batch rolls back all writes and keeps the previous undo', function () {
    var f = fixture();
    f.add(1); f.add(2); f.add(3);
    assert.strictEqual(f.list.deleteItem(3), true);
    f.failNext(2);
    assert.throws(function () { f.list.deleteItems(f.ids([1, 2])); }, /injected write failure/);
    assert.strictEqual(f.row(1).deleted_at, null);
    assert.strictEqual(f.row(2).deleted_at, null);
    assert.strictEqual(f.events.length, 1);
    assert.strictEqual(f.list.undoLastDelete(), true);
    assert.strictEqual(f.row(3).deleted_at, null);
    f.db.close();
});
test('failed batch undo rolls back and remains retryable', function () {
    var f = fixture();
    f.add(1); f.add(2);
    var result = f.list.deleteItems(f.ids([1, 2]));
    f.failNext(2);
    assert.strictEqual(f.list.undoLastDelete(), false);
    assert.strictEqual(f.row(1).deleted_at, result.deletedAt);
    assert.strictEqual(f.row(2).deleted_at, result.deletedAt);
    assert.strictEqual(f.events.length, 1);
    assert.strictEqual(f.list.undoLastDelete(), true);
    assert.strictEqual(f.row(1).deleted_at, null);
    assert.strictEqual(f.row(2).deleted_at, null);
    f.db.close();
});
test('empty, missing and invalid IDs never delete an unrelated record', function () {
    var f = fixture();
    f.add(1); f.add(2);
    assert.strictEqual(f.list.deleteItems(f.ids([])).count, 0);
    assert.strictEqual(f.list.deleteItems(f.ids([999])).count, 0);
    assert.throws(function () { f.list.deleteItems(f.ids([1, 1.5])); }, /Invalid selected item ID/);
    assert.throws(function () { f.list.deleteItems(f.ids([1, -2])); }, /Invalid selected item ID/);
    assert.throws(function () { f.list.deleteItems(null); }, /array/);
    assert.strictEqual(f.row(1).deleted_at, null);
    assert.strictEqual(f.row(2).deleted_at, null);
    assert.strictEqual(f.events.length, 0);
    f.db.close();
});
test('batch undo preserves the existing same-hash conflict fix', function () {
    var f = fixture();
    f.add(1, undefined, 'same'); f.add(2);
    f.list.deleteItems(f.ids([1, 2]));
    f.add(3, undefined, 'same');
    assert.strictEqual(f.list.undoLastDelete(), true);
    assert.strictEqual(f.row(1), undefined);
    assert.strictEqual(f.row(3).deleted_at, null);
    assert.strictEqual(f.row(2).deleted_at, null);
    f.db.close();
});
test('non-numeric IDs are rejected before any deletion', function () {
    var f = fixture();
    f.add(1); f.add(2);
    assert.throws(function () { f.list.deleteItems(f.ids([2, true])); }, /Invalid selected item ID/);
    assert.throws(function () { f.list.deleteItems(f.ids([2, '1'])); }, /Invalid selected item ID/);
    assert.throws(function () { f.list.deleteItems(f.ids([9007199254740992])); }, /Invalid selected item ID/);
    assert.strictEqual(f.row(1).deleted_at, null);
    assert.strictEqual(f.row(2).deleted_at, null);
    f.db.close();
});
test('shutdown rejects a late batch delete', function () {
    var f = fixture();
    f.add(1);
    f.list.shutdown();
    assert.throws(function () { f.list.deleteItems(f.ids([1])); }, /not ready/);
    assert.strictEqual(f.row(1).deleted_at, null);
    f.db.close();
});
test('a later single delete supersedes the batch undo without restoring older IDs', function () {
    var f = fixture();
    f.add(1); f.add(2); f.add(3);
    var result = f.list.deleteItems(f.ids([1, 2]));
    assert.strictEqual(f.list.deleteItem(3), true);
    assert.strictEqual(f.list.undoLastDelete(), true);
    assert.strictEqual(f.row(3).deleted_at, null);
    assert.strictEqual(f.row(1).deleted_at, result.deletedAt);
    assert.strictEqual(f.row(2).deleted_at, result.deletedAt);
    f.db.close();
});

test('Filter confirmation deletes exactly its snapshot through the real List and Repository', function () {
    var f = fixture();
    var c = f.context;
    var filterSource = source('ch_11_filter.js');
    var names = ['homeMultiIds', 'syncHomeMultiUi', 'exitHomeMulti', 'beginHomeMulti',
        'toggleHomeMulti', 'requestHomeMultiDelete', 'confirmHomeMultiDelete'];
    f.add(1); f.add(2); f.add(3);
    vm.runInContext('var HOME_MULTI_LIMIT=100; var rootMode=true; var primaryShellPageId="";' +
        'var homeMulti={active:false,ids:[],confirmation:null,busy:false,generation:0,message:null};' +
        'var state={panelAttached:true}; var previewRows=[{id:1},{id:2}];', c);
    names.forEach(function (name) {
        var start = filterSource.indexOf('    function ' + name + '(');
        assert(start >= 0, 'missing production function ' + name);
        var end = filterSource.indexOf('\n    function ', start + 5);
        vm.runInContext(filterSource.slice(start, end), c, {filename: name + '.js'});
    });
    c.syncHomeMultiUi = function () {};
    c.isMainThread = function () { return true; };
    c.cancelActiveSwipe = function () {};
    c.hideKeyboardOnMain = function () {};
    c.attachDeleteUndoBanner = function () {};
    c.rememberDeleteUndo = function (row) { c.undoRow = row; };
    c.refreshPrimaryResults = function () {};
    c.ClipHub.Base.now = function () { return 1000; };
    c.beginHomeMulti(); c.toggleHomeMulti(1); c.toggleHomeMulti(2);
    var snapshot = c.requestHomeMultiDelete();
    c.previewRows.push({id: 3});
    assert.strictEqual(c.confirmHomeMultiDelete(snapshot), true);
    assert.strictEqual(f.row(1).deleted_at, 1000);
    assert.strictEqual(f.row(2).deleted_at, 1000);
    assert.strictEqual(f.row(3).deleted_at, null);
    assert.strictEqual(c.undoRow.count, 2);
    assert.strictEqual(f.events.length, 1);
    assert.strictEqual(f.list.undoLastDelete(), true);
    assert.strictEqual(f.row(1).deleted_at, null);
    assert.strictEqual(f.row(2).deleted_at, null);
    f.db.close();
});
