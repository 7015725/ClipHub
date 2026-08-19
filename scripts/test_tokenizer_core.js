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

function assertExact(source, result) {
    var cursor = 0;
    var rebuilt = "";
    var index;
    var token;
    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.reconstructionVerified, true);
    for (index = 0; index < result.tokens.length; index += 1) {
        token = result.tokens[index];
        assert.strictEqual(token.start, cursor);
        assert.ok(token.end > token.start);
        assert.strictEqual(source.substring(token.start, token.end), token.text);
        rebuilt += token.text;
        cursor = token.end;
    }
    assert.strictEqual(cursor, source.length);
    assert.strictEqual(rebuilt, source);
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

var rawMatch = core.tokenizeWithRules(
    '定位代码和函数，进行二次分析，注意边界。',
    [
        {
            id: 'custom.raw.analysis',
            pattern: '二次分析',
            priority: 1200,
            mode: 'match'
        }
    ],
    { includeBuiltins: false, gapMode: 'raw' }
);
assert.deepStrictEqual(texts(rawMatch), [
    '定位代码和函数，进行', '二次分析', '，注意边界。'
]);
assert.strictEqual(rawMatch.tokens[0].source, 'raw-gap');
assert.strictEqual(rawMatch.tokens[1].ruleId, 'custom.raw.analysis');
assert.strictEqual(rawMatch.gapMode, 'raw');

var rawSplit = core.tokenizeWithRules(
    '定位代码和函数，进行二次分析，注意边界。',
    [
        {
            id: 'custom.raw.delimiter',
            pattern: '[，。]+',
            priority: 1200,
            mode: 'split',
            keepDelimiter: false
        }
    ],
    { includeBuiltins: false, gapMode: 'raw' }
);
assert.deepStrictEqual(texts(rawSplit), [
    '定位代码和函数', '进行二次分析', '注意边界'
]);
assert.ok(rawSplit.tokens.every(function (item) {
    return item.source === 'raw-gap';
}));

var defaults = core.getDefaultRules();
assert.ok(defaults.length >= 8);
assert.strictEqual(core.MODULE_VERSION, 3);
assert.strictEqual(core.ENGINE_VERSION, 3);

var exactBasic = core.tokenizeRegexExact('甲123乙', {
    includeBuiltins: false,
    rules: [{ id: 'digits', pattern: '\\d+', priority: 1000 }]
});
assert.deepStrictEqual(texts(exactBasic), ['甲', '123', '乙']);
assert.strictEqual(exactBasic.tokens[0].source, 'raw-gap');
assert.strictEqual(exactBasic.tokens[1].source, 'regex-match');
assertExact('甲123乙', exactBasic);

var exactNoRules = core.tokenizeRegexExact('未命中全文', {
    includeBuiltins: false,
    rules: []
});
assert.deepStrictEqual(texts(exactNoRules), ['未命中全文']);
assert.strictEqual(exactNoRules.tokens[0].source, 'raw-gap');
assertExact('未命中全文', exactNoRules);

var exactEmpty = core.tokenizeRegexExact('', {
    includeBuiltins: false,
    rules: []
});
assert.deepStrictEqual(texts(exactEmpty), []);
assertExact('', exactEmpty);

var whitespaceSource = 'A  \r\n\tB';
var exactWhitespace = core.tokenizeRegexExact(whitespaceSource, {
    includeBuiltins: false,
    rules: [{ id: 'letters', pattern: '[AB]', priority: 1000 }]
});
assert.deepStrictEqual(texts(exactWhitespace), ['A', '  \r\n\t', 'B']);
assert.strictEqual(exactWhitespace.tokens[1].source, 'raw-gap');
assertExact(whitespaceSource, exactWhitespace);

var exactRuleOrder = core.tokenizeRegexExact('abc', {
    includeBuiltins: false,
    rules: [
        { id: 'B', pattern: 'bc', priority: 1000 },
        { id: 'A', pattern: 'ab', priority: 1000 }
    ]
});
assert.deepStrictEqual(texts(exactRuleOrder), ['a', 'bc']);
assert.strictEqual(exactRuleOrder.tokens[1].ruleId, 'B');
assertExact('abc', exactRuleOrder);

var exactTemporary = core.tokenizeRegexExact('abc', {
    includeBuiltins: false,
    rules: [
        { id: 'saved', pattern: 'ab', priority: 999999 },
        {
            id: 'temporary', pattern: 'bc', priority: 0,
            temporaryPriority: true
        }
    ]
});
assert.deepStrictEqual(texts(exactTemporary), ['a', 'bc']);
assert.strictEqual(exactTemporary.tokens[1].ruleId, 'temporary');
assertExact('abc', exactTemporary);

var exactInvalid = core.tokenizeRegexExact('A1B', {
    includeBuiltins: false,
    rules: [
        { id: 'invalid', title: '无效规则', pattern: '[' },
        { id: 'digit', pattern: '\\d+' }
    ]
});
assert.deepStrictEqual(texts(exactInvalid), ['A', '1', 'B']);
assert.strictEqual(exactInvalid.issues.length, 1);
assert.strictEqual(exactInvalid.issues[0].code, 'INVALID_REGEX');
assert.strictEqual(exactInvalid.issues[0].nonBlocking, true);
assertExact('A1B', exactInvalid);

var exactZeroWidth = core.tokenizeRegexExact('A1B', {
    includeBuiltins: false,
    rules: [
        { id: 'zero', title: '零宽规则', pattern: '(?=A)' },
        { id: 'digit', pattern: '\\d+' }
    ]
});
assert.deepStrictEqual(texts(exactZeroWidth), ['A', '1', 'B']);
assert.strictEqual(exactZeroWidth.issues.length, 1);
assert.strictEqual(exactZeroWidth.issues[0].code, 'ZERO_WIDTH_MATCH');
assertExact('A1B', exactZeroWidth);

var exactOverflow = core.tokenizeRegexExact('aaaa', {
    includeBuiltins: false,
    matchBudget: 2,
    rules: [{ id: 'many', pattern: 'a' }]
});
assert.strictEqual(exactOverflow.ok, false);
assert.strictEqual(exactOverflow.code, 'MATCH_LIMIT_EXCEEDED');
assert.deepStrictEqual(texts(exactOverflow), []);

var emojiSource = 'A😀B';
var exactEmoji = core.tokenizeRegexExact(emojiSource, {
    includeBuiltins: false,
    rules: [{ id: 'emoji', pattern: '😀' }]
});
assert.deepStrictEqual(texts(exactEmoji), ['A', '😀', 'B']);
assert.strictEqual(exactEmoji.tokens[1].start, 1);
assert.strictEqual(exactEmoji.tokens[1].end, 3);
assertExact(emojiSource, exactEmoji);

var exactWholeOnly = core.tokenizeRegexExact('容量128GB文件', {
    includeBuiltins: false,
    rules: [{
        id: 'capacity',
        pattern: '(\\d+)(GB)',
        mode: 'split',
        keepDelimiter: false,
        groupMode: 'groups'
    }]
});
assert.deepStrictEqual(texts(exactWholeOnly), ['容量', '128GB', '文件']);
assertExact('容量128GB文件', exactWholeOnly);

console.log('Tokenizer regex core contract: passed');
