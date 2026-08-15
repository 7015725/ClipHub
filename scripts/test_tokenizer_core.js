#!/usr/bin/env node
var fs = require('fs');
var vm = require('vm');
var assert = require('assert');

var context = { console: console };
context.global = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync('src/ch_18_tokenizer_core.js', 'utf8'), context);

var core = context.ClipHub.TokenizerCore;
var dictionary = core.normalizeDictionary('分词系统\n剪贴板\n正则规则\nClipHub\n');
var result = core.tokenize('ClipHub分词系统，剪贴板正则规则123', {
  dictionary: dictionary
});

assert.strictEqual(result.ok, true);
assert.deepStrictEqual(JSON.parse(JSON.stringify(result.tokens.map(function (item) {
  return item.text;
}))), [
  'ClipHub', '分词系统', '，', '剪贴板', '正则规则', '123'
]);
assert.strictEqual(result.stats.total, 6);
assert.strictEqual(result.stats.words, 5);
assert.strictEqual(result.stats.symbols, 1);
assert.strictEqual(result.tokens[1].source, 'dictionary');

console.log('Tokenizer core contract: passed');
