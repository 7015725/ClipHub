(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var CHAR_BUDGET = 786432;
    var MATCH_BUDGET = 12000;
    var BUILTIN_RULES = [
        { id: "builtin.url", title: "URL", pattern: "(?:https?|ftp)://[^\\s<>\\\"'\\u3400-\\u9fff\\uf900-\\ufaff，。！？；、]+", priority: 900 },
        { id: "builtin.email", title: "邮箱", pattern: "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}", priority: 880 },
        { id: "builtin.phone.cn", title: "手机号", pattern: "(?:\\+?86[- ]?)?1[3-9][0-9]{9}", priority: 860 },
        { id: "builtin.unix_path", title: "路径", pattern: "(?:/[^\\s/]+)+/?", priority: 840 },
        { id: "builtin.member_chain", title: "代码链", pattern: "(?:[A-Za-z_][A-Za-z0-9_]*\\.)+[A-Za-z_][A-Za-z0-9_]*(?:\\(\\))?", priority: 820 },
        { id: "builtin.filename", title: "文件名", pattern: "[A-Za-z0-9._-]+\\.[A-Za-z0-9]{1,10}", priority: 800 },
        { id: "builtin.datetime", title: "日期时间", pattern: "[0-9]{4}[-/.][0-9]{1,2}[-/.][0-9]{1,2}(?:[ T][0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)?", priority: 780 },
        { id: "builtin.number_unit", title: "数字单位", pattern: "[+-]?(?:[0-9]+(?:\\.[0-9]+)?|\\.[0-9]+)(?:%|ms|s|KB|MB|GB|TB|B|px|dp|sp|Hz|kHz|MHz|GHz|mAh|V|A|W|℃|°C)?", priority: 760 },
        { id: "builtin.ascii_identifier", title: "英文标识符", pattern: "[A-Za-z_][A-Za-z0-9_-]*", priority: 700 }
    ];

    function own(object, key) {
        return Object.prototype.hasOwnProperty.call(object, key);
    }

    function copy(object) {
        var out = {};
        var key;
        for (key in object) { if (own(object, key)) { out[key] = object[key]; } }
        return out;
    }

    function getDefaultRules() {
        var out = [];
        var index;
        for (index = 0; index < BUILTIN_RULES.length; index += 1) {
            out.push(copy(BUILTIN_RULES[index]));
        }
        return out;
    }

    function makeToken(text, start, end, type, source, rule) {
        return {
            text: String(text),
            start: Number(start),
            end: Number(end),
            type: String(type || "word"),
            source: String(source || "regex"),
            ruleId: rule ? String(rule.id || "") : "",
            title: rule ? String(rule.title || "") : ""
        };
    }

    function isSpace(ch) { return /\s/.test(ch); }
    function isAsciiWord(ch) { return /^[A-Za-z0-9_]$/.test(ch); }
    function isCjk(ch) {
        var code = ch.charCodeAt(0);
        return (code >= 0x3400 && code <= 0x9fff) ||
            (code >= 0xf900 && code <= 0xfaff);
    }

    function unitLength(text, index) {
        var first = text.charCodeAt(index);
        var second;
        if (first >= 0xd800 && first <= 0xdbff && index + 1 < text.length) {
            second = text.charCodeAt(index + 1);
            if (second >= 0xdc00 && second <= 0xdfff) { return 2; }
        }
        return 1;
    }

    function normalizeRule(item, index, source, defaultPriority) {
        var rule = item || {};
        var priority = Number(rule.priority);
        var mode = String(rule.mode || rule.action || "match").toLowerCase();
        if (!isFinite(priority)) { priority = Number(defaultPriority || 0); }
        return {
            id: String(rule.id || rule.ruleId || rule.title || (source + "." + index)),
            title: String(rule.title || rule.remark || rule.name || ""),
            pattern: String(rule.pattern || rule.regex || ""),
            flags: rule.flags,
            enabled: rule.enabled !== false,
            priority: priority,
            mode: mode === "split" ? "split" : "match",
            keepDelimiter: rule.keepDelimiter === true,
            groupMode: String(rule.groupMode || "whole").toLowerCase(),
            type: String(rule.type || "word"),
            source: String(rule.source || source),
            order: index
        };
    }

    function buildRules(customRules, includeBuiltins) {
        var out = [];
        var index;
        var source = customRules || [];
        if (includeBuiltins !== false) {
            for (index = 0; index < BUILTIN_RULES.length; index += 1) {
                out.push(normalizeRule(BUILTIN_RULES[index], index, "builtin", 0));
            }
        }
        for (index = 0; index < source.length; index += 1) {
            out.push(normalizeRule(source[index], index, "custom", 1000));
        }
        return out;
    }

    function jsFlags(flags) {
        var raw = String(flags === undefined || flags === null ? "" : flags);
        var numeric;
        var out = "g";
        if (/^[a-z]+$/i.test(raw)) {
            if (raw.indexOf("i") >= 0) { out += "i"; }
            if (raw.indexOf("m") >= 0) { out += "m"; }
            return out;
        }
        numeric = Number(flags || 0);
        if ((numeric & 2) !== 0) { out += "i"; }
        if ((numeric & 8) !== 0) { out += "m"; }
        return out;
    }

    function addMatch(out, match, start, rule) {
        var whole = String(match[0]);
        var groupIndex;
        var groupText;
        var local;
        var searchFrom = 0;
        if (rule.groupMode !== "groups" || match.length <= 1) {
            out.push({ start: start, end: start + whole.length, text: whole, rule: rule });
            return;
        }
        for (groupIndex = 1; groupIndex < match.length; groupIndex += 1) {
            if (match[groupIndex] === undefined || match[groupIndex] === null) { continue; }
            groupText = String(match[groupIndex]);
            if (!groupText) { continue; }
            local = whole.indexOf(groupText, searchFrom);
            if (local < 0) { local = whole.indexOf(groupText); }
            if (local < 0) { continue; }
            out.push({
                start: start + local,
                end: start + local + groupText.length,
                text: groupText,
                rule: rule
            });
            searchFrom = local + groupText.length;
        }
    }

    function collect(text, rules, mode, budget) {
        var matches = [];
        var errors = [];
        var index;
        var rule;
        var regex;
        var match;
        var guard;
        for (index = 0; index < rules.length && matches.length < budget; index += 1) {
            rule = rules[index];
            if (!rule.enabled || !rule.pattern || rule.mode !== mode) { continue; }
            try {
                regex = new RegExp(rule.pattern, jsFlags(rule.flags));
                guard = 0;
                while ((match = regex.exec(text)) !== null && matches.length < budget) {
                    if (String(match[0]).length > 0) {
                        if (mode === "match") { addMatch(matches, match, Number(match.index), rule); }
                        else {
                            matches.push({
                                start: Number(match.index),
                                end: Number(match.index) + String(match[0]).length,
                                text: String(match[0]),
                                rule: rule
                            });
                        }
                    } else {
                        regex.lastIndex = Math.max(regex.lastIndex + 1, Number(match.index) + 1);
                    }
                    guard += 1;
                    if (guard >= budget) { break; }
                }
            } catch (error) {
                errors.push({ ruleId: rule.id, title: rule.title, error: String(error) });
            }
        }
        return { matches: matches, errors: errors };
    }

    function candidateSort(a, b) {
        var pa = Number(a.rule.priority || 0);
        var pb = Number(b.rule.priority || 0);
        var la = a.end - a.start;
        var lb = b.end - b.start;
        if (pa !== pb) { return pb - pa; }
        if (la !== lb) { return lb - la; }
        if (a.start !== b.start) { return a.start - b.start; }
        return Number(a.rule.order || 0) - Number(b.rule.order || 0);
    }

    function resolveOverlap(candidates) {
        var source = candidates.slice(0);
        var accepted = [];
        var index;
        var other;
        var blocked;
        source.sort(candidateSort);
        for (index = 0; index < source.length; index += 1) {
            if (source[index].start < 0 || source[index].end <= source[index].start) { continue; }
            blocked = false;
            for (other = 0; other < accepted.length; other += 1) {
                if (source[index].start < accepted[other].end && accepted[other].start < source[index].end) {
                    blocked = true;
                    break;
                }
            }
            if (!blocked) { accepted.push(source[index]); }
        }
        accepted.sort(function (a, b) {
            if (a.start !== b.start) { return a.start - b.start; }
            return a.end - b.end;
        });
        return accepted;
    }

    function fallback(text, start, end, out) {
        var index = start;
        var begin;
        var size;
        while (index < end) {
            if (isSpace(text.charAt(index))) { index += 1; continue; }
            begin = index;
            if (isAsciiWord(text.charAt(index))) {
                index += 1;
                while (index < end && isAsciiWord(text.charAt(index))) { index += 1; }
                out.push(makeToken(text.substring(begin, index), begin, index, "word", "fallback-ascii", null));
                continue;
            }
            if (isCjk(text.charAt(index))) {
                index += 1;
                while (index < end && isCjk(text.charAt(index))) { index += 1; }
                out.push(makeToken(text.substring(begin, index), begin, index, "word", "fallback-cjk", null));
                continue;
            }
            size = unitLength(text, index);
            index += size;
            out.push(makeToken(text.substring(begin, index), begin, index, "symbol", "fallback-symbol", null));
        }
    }

    function splitGap(text, start, end, splitMatches, out) {
        var local = [];
        var accepted;
        var index;
        var item;
        var cursor = start;
        for (index = 0; index < splitMatches.length; index += 1) {
            item = splitMatches[index];
            if (item.start >= start && item.end <= end) { local.push(item); }
        }
        accepted = resolveOverlap(local);
        for (index = 0; index < accepted.length; index += 1) {
            item = accepted[index];
            if (item.start > cursor) { fallback(text, cursor, item.start, out); }
            if (item.rule.keepDelimiter) {
                out.push(makeToken(item.text, item.start, item.end,
                    item.rule.type === "word" ? "word" : "symbol",
                    item.rule.source, item.rule));
            }
            cursor = Math.max(cursor, item.end);
        }
        if (cursor < end) { fallback(text, cursor, end, out); }
    }

    function stats(tokens) {
        var words = 0;
        var symbols = 0;
        var index;
        for (index = 0; index < tokens.length; index += 1) {
            if (String(tokens[index].type) === "symbol") { symbols += 1; }
            else { words += 1; }
        }
        return { total: tokens.length, words: words, symbols: symbols };
    }

    function tokenize(text, options) {
        var value = String(text === null || text === undefined ? "" : text);
        var settings = options || {};
        var charBudget = Number(settings.charBudget || CHAR_BUDGET);
        var matchBudget = Number(settings.matchBudget || MATCH_BUDGET);
        var rules;
        var matchResult;
        var splitResult;
        var accepted;
        var out = [];
        var cursor = 0;
        var index;
        var item;
        if (value.length > charBudget) {
            return {
                ok: false,
                code: "TEXT_TOO_LARGE",
                engine: "regex-tokenizer-v2",
                tokens: [],
                stats: { total: 0, words: 0, symbols: 0 },
                errors: []
            };
        }
        rules = buildRules(settings.rules || [], settings.includeBuiltins !== false);
        matchResult = collect(value, rules, "match", matchBudget);
        splitResult = collect(value, rules, "split", matchBudget);
        accepted = resolveOverlap(matchResult.matches);
        for (index = 0; index < accepted.length; index += 1) {
            item = accepted[index];
            if (item.start > cursor) { splitGap(value, cursor, item.start, splitResult.matches, out); }
            if (item.start >= cursor) {
                out.push(makeToken(item.text, item.start, item.end,
                    item.rule.type, item.rule.source, item.rule));
                cursor = item.end;
            }
        }
        if (cursor < value.length) { splitGap(value, cursor, value.length, splitResult.matches, out); }
        return {
            ok: true,
            engine: "regex-tokenizer-v2",
            tokens: out,
            stats: stats(out),
            errors: matchResult.errors.concat(splitResult.errors),
            ruleCount: rules.length,
            acceptedMatchCount: accepted.length
        };
    }

    function tokenizeWithRules(text, rules, options) {
        var settings = {};
        var key;
        options = options || {};
        for (key in options) { if (own(options, key)) { settings[key] = options[key]; } }
        settings.rules = rules || [];
        return tokenize(text, settings);
    }

    function scanRegexRanges(text, rules, options) {
        var value = String(text === null || text === undefined ? "" : text);
        var source = rules || [];
        var ranges = [];
        var errors = [];
        var budget = Number(options && options.charBudget || CHAR_BUDGET);
        var matchBudget = Number(options && options.matchBudget || MATCH_BUDGET);
        var index;
        var item;
        var rule;
        var pattern;
        var matcher;
        var flags;
        if (value.length > budget) {
            return { ok: false, code: "TEXT_TOO_LARGE", ranges: [], errors: [], consumedCount: 0, oversizeSkippedCount: 1 };
        }
        for (index = 0; index < source.length && ranges.length < matchBudget; index += 1) {
            item = source[index] || {};
            rule = normalizeRule(item, index, "custom", 1000);
            if (!rule.enabled || !rule.pattern) { continue; }
            try {
                flags = item.flags === undefined ? 0 : Number(item.flags || 0);
                pattern = Packages.java.util.regex.Pattern.compile(rule.pattern, flags);
                matcher = pattern.matcher(value);
                while (matcher.find() && ranges.length < matchBudget) {
                    if (Number(matcher.end()) <= Number(matcher.start())) { continue; }
                    ranges.push({
                        ruleId: rule.id,
                        title: rule.title,
                        start: Number(matcher.start()),
                        end: Number(matcher.end()),
                        text: String(matcher.group()),
                        priority: rule.priority,
                        mode: rule.mode,
                        source: rule.source
                    });
                }
            } catch (error) {
                errors.push({ ruleId: rule.id, title: rule.title, error: String(error) });
                ranges.push({
                    ruleId: rule.id,
                    title: rule.title,
                    start: -1,
                    end: -1,
                    text: "",
                    priority: rule.priority,
                    mode: rule.mode,
                    source: rule.source,
                    error: String(error)
                });
            }
        }
        return { ok: true, ranges: ranges, errors: errors, consumedCount: value.length, oversizeSkippedCount: 0 };
    }

    ClipHub.TokenizerCore = {
        MODULE_NAME: "ch_18_tokenizer_core",
        MODULE_VERSION: 1,
        ENGINE_VERSION: 2,
        getDefaultRules: getDefaultRules,
        tokenize: tokenize,
        tokenizeWithRules: tokenizeWithRules,
        scanRegexRanges: scanRegexRanges,
        resolveOverlap: resolveOverlap
    };
}((function () { return this; }())));
