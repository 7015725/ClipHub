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
            temporaryPriority: rule.temporaryPriority === true,
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

    function fallback(text, start, end, out, tokenBudget) {
        var index = start;
        var begin;
        var size;
        if (tokenBudget !== undefined && out.length >= Number(tokenBudget)) {
            return;
        }
        while (index < end) {
            if (isSpace(text.charAt(index))) { index += 1; continue; }
            begin = index;
            if (isAsciiWord(text.charAt(index))) {
                index += 1;
                while (index < end && isAsciiWord(text.charAt(index))) { index += 1; }
                out.push(makeToken(text.substring(begin, index), begin, index, "word", "fallback-ascii", null));
                if (tokenBudget !== undefined && out.length >= Number(tokenBudget)) { return; }
                continue;
            }
            if (isCjk(text.charAt(index))) {
                index += 1;
                while (index < end && isCjk(text.charAt(index))) { index += 1; }
                out.push(makeToken(text.substring(begin, index), begin, index, "word", "fallback-cjk", null));
                if (tokenBudget !== undefined && out.length >= Number(tokenBudget)) { return; }
                continue;
            }
            size = unitLength(text, index);
            index += size;
            out.push(makeToken(text.substring(begin, index), begin, index, "symbol", "fallback-symbol", null));
            if (tokenBudget !== undefined && out.length >= Number(tokenBudget)) { return; }
        }
    }

    function emitGap(text, start, end, out, gapMode, tokenBudget) {
        var raw;
        if (start >= end) { return; }
        if (String(gapMode || "fallback") === "raw") {
            raw = text.substring(start, end);
            if (!/^\s*$/.test(raw) && (tokenBudget === undefined ||
                    out.length < Number(tokenBudget))) {
                out.push(makeToken(raw, start, end, "word", "raw-gap", null));
            }
            return;
        }
        fallback(text, start, end, out, tokenBudget);
    }

    function splitGap(text, start, end, splitMatches, out, gapMode, tokenBudget) {
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
            if (tokenBudget !== undefined && out.length >= Number(tokenBudget)) {
                return;
            }
            if (item.start > cursor) {
                emitGap(text, cursor, item.start, out, gapMode, tokenBudget);
            }
            if (item.rule.keepDelimiter) {
                out.push(makeToken(item.text, item.start, item.end,
                    item.rule.type === "word" ? "word" : "symbol",
                    item.rule.source, item.rule));
            }
            cursor = Math.max(cursor, item.end);
        }
        if (cursor < end) { emitGap(text, cursor, end, out, gapMode); }
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

    function makeRegexIssue(severity, code, message, rule) {
        var value = String(message || code || "TOKENIZER_ERROR");
        return {
            severity: String(severity || "error"),
            nonBlocking: String(severity || "error") === "warn",
            code: String(code || "TOKENIZER_ERROR"),
            ruleId: rule ? String(rule.id || "") : "",
            title: rule ? String(rule.title || "") : "",
            message: value,
            error: value
        };
    }

    function pushRuleIssueOnce(issues, seen, code, message, rule) {
        var key = String(rule && rule.id || "") + ":" + String(code || "");
        if (seen[key] === true) { return false; }
        seen[key] = true;
        issues.push(makeRegexIssue("warn", code, message, rule));
        return true;
    }

    function collectRegexExactMatches(text, rules, matchBudget) {
        var matches = [];
        var issues = [];
        var issueSeen = {};
        var scannedCount = 0;
        var sequence = 0;
        var index;
        var rule;
        var regex;
        var match;
        var whole;
        var start;
        var nextIndex;
        for (index = 0; index < rules.length; index += 1) {
            rule = rules[index];
            if (!rule.enabled || !rule.pattern) { continue; }
            try {
                regex = new RegExp(rule.pattern, jsFlags(rule.flags));
            } catch (error) {
                pushRuleIssueOnce(issues, issueSeen, "INVALID_REGEX",
                    "正则表达式无效：" + String(error), rule);
                continue;
            }
            while ((match = regex.exec(text)) !== null) {
                scannedCount += 1;
                if (scannedCount > matchBudget) {
                    return {
                        ok: false,
                        code: "MATCH_LIMIT_EXCEEDED",
                        matches: [],
                        issues: issues,
                        scannedCount: scannedCount
                    };
                }
                whole = String(match[0]);
                start = Number(match.index);
                if (whole.length <= 0) {
                    pushRuleIssueOnce(issues, issueSeen, "ZERO_WIDTH_MATCH",
                        "规则产生零宽匹配，已跳过", rule);
                    nextIndex = start < text.length ?
                        start + unitLength(text, start) : start + 1;
                    regex.lastIndex = Math.max(Number(regex.lastIndex), nextIndex);
                    continue;
                }
                matches.push({
                    start: start,
                    end: start + whole.length,
                    text: whole,
                    rule: rule,
                    sequence: sequence
                });
                sequence += 1;
            }
        }
        return {
            ok: true,
            matches: matches,
            issues: issues,
            scannedCount: scannedCount
        };
    }

    function regexExactCandidateSort(a, b) {
        var temporaryA = a.rule.temporaryPriority === true ? 1 : 0;
        var temporaryB = b.rule.temporaryPriority === true ? 1 : 0;
        var priorityA = Number(a.rule.priority || 0);
        var priorityB = Number(b.rule.priority || 0);
        var lengthA = Number(a.end) - Number(a.start);
        var lengthB = Number(b.end) - Number(b.start);
        var orderA = Number(a.rule.order || 0);
        var orderB = Number(b.rule.order || 0);
        if (temporaryA !== temporaryB) { return temporaryB - temporaryA; }
        if (priorityA !== priorityB) { return priorityB - priorityA; }
        if (lengthA !== lengthB) { return lengthB - lengthA; }
        if (orderA !== orderB) { return orderA - orderB; }
        if (a.start !== b.start) { return a.start - b.start; }
        if (a.end !== b.end) { return a.end - b.end; }
        return Number(a.sequence || 0) - Number(b.sequence || 0);
    }

    function regexExactInsertionIndex(accepted, start) {
        var low = 0;
        var high = accepted.length;
        var middle;
        while (low < high) {
            middle = Math.floor((low + high) / 2);
            if (Number(accepted[middle].start) < Number(start)) {
                low = middle + 1;
            } else {
                high = middle;
            }
        }
        return low;
    }

    function resolveRegexExactOverlap(candidates) {
        var ranked = candidates.slice(0);
        var accepted = [];
        var index;
        var item;
        var insertion;
        var previous;
        var next;
        ranked.sort(regexExactCandidateSort);
        for (index = 0; index < ranked.length; index += 1) {
            item = ranked[index];
            if (item.start < 0 || item.end <= item.start) { continue; }
            insertion = regexExactInsertionIndex(accepted, item.start);
            previous = insertion > 0 ? accepted[insertion - 1] : null;
            next = insertion < accepted.length ? accepted[insertion] : null;
            if (previous !== null && item.start < previous.end) { continue; }
            if (next !== null && next.start < item.end) { continue; }
            accepted.splice(insertion, 0, item);
        }
        return accepted;
    }

    function emitExactRawGap(text, start, end, out) {
        if (start >= end) { return false; }
        out.push(makeToken(text.substring(start, end), start, end,
            "word", "raw-gap", null));
        return true;
    }

    function validateExactCover(text, tokens) {
        var cursor = 0;
        var rebuilt = [];
        var index;
        var token;
        var start;
        var end;
        for (index = 0; index < tokens.length; index += 1) {
            token = tokens[index] || {};
            start = Number(token.start);
            end = Number(token.end);
            if (!isFinite(start) || !isFinite(end) || start !== cursor ||
                    end <= start || end > text.length) {
                return { ok: false, code: "TOKEN_RANGE_INVALID" };
            }
            if (text.substring(start, end) !== String(token.text || "")) {
                return { ok: false, code: "TOKEN_RANGE_INVALID" };
            }
            rebuilt.push(String(token.text || ""));
            cursor = end;
        }
        if (cursor !== text.length || rebuilt.join("") !== text) {
            return { ok: false, code: "RECONSTRUCTION_MISMATCH" };
        }
        return { ok: true };
    }

    function exactFailure(code, message, issues, ruleCount, scannedCount) {
        var allIssues = (issues || []).slice(0);
        allIssues.push(makeRegexIssue("error", code, message, null));
        return {
            ok: false,
            code: String(code),
            message: String(message || code),
            engine: "regex-tokenizer-exact-v3",
            tokens: [],
            stats: { total: 0, words: 0, symbols: 0 },
            issues: allIssues,
            errors: allIssues,
            ruleCount: Number(ruleCount || 0),
            scannedMatchCount: Number(scannedCount || 0),
            acceptedMatchCount: 0,
            gapMode: "exact-raw"
        };
    }

    function tokenizeRegexExact(text, options) {
        var value = String(text === null || text === undefined ? "" : text);
        var settings = options || {};
        var charBudget = Number(settings.charBudget || CHAR_BUDGET);
        var matchBudget = Math.max(1,
            Number(settings.matchBudget || MATCH_BUDGET));
        var rules;
        var collected;
        var accepted;
        var out = [];
        var cursor = 0;
        var index;
        var item;
        var validation;
        if (!isFinite(charBudget) || charBudget < 0) {
            charBudget = CHAR_BUDGET;
        }
        if (!isFinite(matchBudget) || matchBudget < 1) {
            matchBudget = MATCH_BUDGET;
        }
        if (value.length > charBudget) {
            return exactFailure("TEXT_TOO_LARGE", "原文超过分词安全上限",
                [], 0, 0);
        }
        rules = buildRules(settings.rules || [],
            settings.includeBuiltins === true);
        collected = collectRegexExactMatches(value, rules, matchBudget);
        if (collected.ok !== true) {
            return exactFailure("MATCH_LIMIT_EXCEEDED",
                "正则命中数量超过安全上限",
                collected.issues, rules.length, collected.scannedCount);
        }
        accepted = resolveRegexExactOverlap(collected.matches);
        for (index = 0; index < accepted.length; index += 1) {
            item = accepted[index];
            if (out.length >= matchBudget) { break; }
            if (item.start > cursor) {
                emitExactRawGap(value, cursor, item.start, out);
            }
            if (out.length >= matchBudget) { break; }
            out.push(makeToken(value.substring(item.start, item.end),
                item.start, item.end, item.rule.type, "regex-match", item.rule));
            cursor = item.end;
        }
        if (cursor < value.length && out.length < matchBudget) {
            emitExactRawGap(value, cursor, value.length, out);
        }
        validation = validateExactCover(value, out);
        if (validation.ok !== true) {
            return exactFailure(validation.code,
                validation.code === "TOKEN_RANGE_INVALID" ?
                    "正则分词区间校验失败" : "正则分词结果无法还原原文",
                collected.issues, rules.length, collected.scannedCount);
        }
        return {
            ok: true,
            engine: "regex-tokenizer-exact-v3",
            tokens: out,
            stats: stats(out),
            issues: collected.issues,
            errors: collected.issues,
            ruleCount: rules.length,
            scannedMatchCount: collected.scannedCount,
            acceptedMatchCount: accepted.length,
            gapMode: "exact-raw",
            reconstructionVerified: true
        };
    }

    function tokenize(text, options) {
        var value = String(text === null || text === undefined ? "" : text);
        var settings = options || {};
        var charBudget = Number(settings.charBudget || CHAR_BUDGET);
        var matchBudget = Number(settings.matchBudget || MATCH_BUDGET);
        var tokenBudget = Number(settings.tokenBudget ||
            (settings.tokenLimit === undefined ? MATCH_BUDGET :
                settings.tokenLimit));
        var gapMode = String(settings.gapMode || "fallback") === "raw" ?
            "raw" : "fallback";
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
            if (tokenBudget > 0 && out.length >= tokenBudget) { break; }
            if (item.start > cursor) {
                splitGap(value, cursor, item.start, splitResult.matches, out,
                    gapMode, tokenBudget);
            }
            if (item.start >= cursor && (tokenBudget <= 0 ||
                    out.length < tokenBudget)) {
                out.push(makeToken(item.text, item.start, item.end,
                    item.rule.type, item.rule.source, item.rule));
                cursor = item.end;
            }
        }
        if (cursor < value.length && (tokenBudget <= 0 ||
                out.length < tokenBudget)) {
            splitGap(value, cursor, value.length, splitResult.matches, out,
                gapMode, tokenBudget);
        }
        return {
            ok: true,
            engine: "regex-tokenizer-v2",
            tokens: out,
            stats: stats(out),
            errors: matchResult.errors.concat(splitResult.errors),
            ruleCount: rules.length,
            acceptedMatchCount: accepted.length,
            gapMode: gapMode
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
        MODULE_VERSION: 3,
        ENGINE_VERSION: 3,
        getDefaultRules: getDefaultRules,
        tokenize: tokenize,
        tokenizeRegexExact: tokenizeRegexExact,
        tokenizeWithRules: tokenizeWithRules,
        scanRegexRanges: scanRegexRanges,
        resolveOverlap: resolveOverlap
    };
}((function () { return this; }())));
