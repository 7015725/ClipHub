var fs = require('fs');
var source = fs.readFileSync('src/ch_19_tokenizer_service.js', 'utf8');
function has(value) { if (source.indexOf(value) < 0) { throw new Error('missing: ' + value); } }
function lacks(value) { if (source.indexOf(value) >= 0) { throw new Error('forbidden: ' + value); } }
has('var RULE_SCHEMA_VERSION = 2;');
has('var ruleOverrides = [];');
has('function sanitizeRuleOverrides(source)');
has('function resetRuleOverride(id)');
has('function getDefaultSelectedRuleIds()');
has('function setSelectedRuleIds(ids)');
has('backupV1State(rawText)');
has('removeDisabledV1Selections');
has('selectedRuleIds = sanitizeSelectedIds(requested);');
lacks('预制分词规则不可覆盖');
lacks('getSharedPreferences');
lacks('Context.MODE_PRIVATE');
lacks('ClipHub.Repository');
lacks('regex_rules');
console.log('Tokenizer rule schema v2 contract: passed');
