var fs = require('fs');
var zlib = require('zlib');
var loader = fs.readFileSync('src/ch_17_tokenizer_ui.js', 'utf8');
var match = loader.match(/var PACKED_B64\s*=\s*([\s\S]*?)\n    ;\n/);
var chunks = [];
var chunkRe = /"([A-Za-z0-9+/=]+)"/g;
var chunkMatch;
var source;
var regexHome;
var toggle;
var render;
if (!match) { throw new Error('PACKED_B64 missing'); }
while ((chunkMatch = chunkRe.exec(match[1])) !== null) { chunks.push(chunkMatch[1]); }
source = zlib.gunzipSync(Buffer.from(chunks.join(''), 'base64')).toString('utf8');
function has(value) { if (source.indexOf(value) < 0) { throw new Error('missing: ' + value); } }
function lacks(value) { if (source.indexOf(value) >= 0) { throw new Error('forbidden: ' + value); } }
has('tokenizer_rule_drawer_v1');
has('function createTokenizerRulesDrawerBundle()');
has('function applyTokenizerRuleSelection()');
has('function resetTokenizerRuleSelectionDraft()');
has('function openTokenizerRuleEditorDrawer(rule)');
has('function resetTokenizerRuleOverride()');
has('TokenizerService.setSelectedRuleIds');
has('TokenizerService.getDefaultSelectedRuleIds');
has('MODULE_VERSION: 25');
lacks('创建规则副本');
lacks('保存并参与');
lacks('预制');
lacks('自定义');
regexHome = source.match(/function buildRegexBody\(\)[\s\S]*?function applyModeStyles/);
if (!regexHome || regexHome[0].indexOf('buildTokenizerRuleSelector') >= 0) { throw new Error('regex home still renders selector'); }
toggle = source.match(/function toggleTokenizerRuleConfig\(rule\)[\s\S]*?function makeTokenizerRuleChip/);
if (!toggle || /TokenizerService\.|requestTokenizerRun|renderTokenizerSurface/.test(toggle[0])) { throw new Error('chip toggle not draft-only'); }
render = source.match(/function renderTokenizerSurface\(\)[\s\S]*?function buildRegexBody/);
if (!render || /tokenizer_rules|tokenizer_rule_editor/.test(render[0])) { throw new Error('full-screen rule page path still active'); }
console.log('Tokenizer rule drawer contract: passed');