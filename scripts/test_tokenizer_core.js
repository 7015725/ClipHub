#!/usr/bin/env node
var fs = require('fs');
var vm = require('vm');
var assert = require('assert');

var context = { console: console };
context.global = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('src/ch_18_tokenizer_core.js', 'utf8'), context);

var core = context.ClipHub.TokenizerCore;

function texts(result) {
    return JSON.parse(JSON.stringify(result.tokens.map(function (item) {
        return item.text;
    })));
}

var basic = core.tokenize(
    '定位代码和函数，访问https://github.com/7015725/ClipHub，处理128GB文件'
);
assert.strictEqual(basic.ok, true);
assert.strictEqual(basic.engine, 'regex-tokenizer-v2');
assert.deepStrictEqual(texts(basic), [
    '定位代码和函数',
    '，',
    '访问',
    'https://github.com/7015725/ClipHub',
    '，',
    '处理',
    '128GB',
    '文件'
]);
assert.strictEqual(basic.tokens[0].source, 'fallback-cjk');
assert.strictEqual(basic.tokens[3].ruleId, 'builtin.url');
assert.strictEqual(basic.tokens[6].ruleId, 'builtin.number_unit');

var customMatch = core.tokenizeWithRules(
    '进行二次分析，注意边界',
    [
        {
            id: 'custom.analysis',
            title: '二次分析',
            pattern: '二次分析',
            priority: 1200,
            mode: 'match'
        }
    ]
);
assert.deepStrictEqual(texts(customMatch), [
    '进行', '二次分析', '，', '注意边界'
]);
assert.strictEqual(customMatch.tokens[1].ruleId, 'custom.analysis');

var split = core.tokenizeWithRules(
    '甲，乙；丙',
    [
        {
            id: 'custom.delimiter',
            pattern: '[,，;；]+',
            priority: 1200,
            mode: 'split',
            keepDelimiter: false
        }
    ],
    { includeBuiltins: false }
);
assert.deepStrictEqual(texts(split), ['甲', '乙', '丙']);

var groups = core.tokenizeWithRules(
    '容量128GB文件',
    [
        {
            id: 'custom.capacity',
            pattern: '(\\d+)(GB)',
            priority: 1500,
            mode: 'match',
            groupMode: 'groups'
        }
    ]
);
assert.deepStrictEqual(texts(groups), ['容量', '128', 'GB', '文件']);
assert.strictEqual(groups.tokens[1].ruleId, 'custom.capacity');
assert.strictEqual(groups.tokens[2].ruleId, 'custom.capacity');

var overlap = core.tokenizeWithRules(
    'abc123',
    [
        { id: 'short', pattern: 'abc', priority: 1000, mode: 'match' },
        { id: 'long', pattern: 'abc123', priority: 1000, mode: 'match' }
    ],
    { includeBuiltins: false }
);
assert.deepStrictEqual(texts(overlap), ['abc123']);
assert.strictEqual(overlap.tokens[0].ruleId, 'long');

var defaults = core.getDefaultRules();
assert.ok(defaults.length >= 8);
assert.strictEqual(core.MODULE_VERSION, 1);
assert.strictEqual(core.ENGINE_VERSION, 2);

console.log('Tokenizer regex core contract: passed');
