(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});

    function isSpace(ch) {
        return /\s/.test(ch);
    }

    function isAsciiLetter(ch) {
        return /^[A-Za-z]$/.test(ch);
    }

    function isAsciiDigit(ch) {
        return /^[0-9]$/.test(ch);
    }

    function isAsciiWord(ch) {
        return /^[A-Za-z0-9_]$/.test(ch);
    }

    function isCjk(ch) {
        var code = ch.charCodeAt(0);
        return (code >= 0x3400 && code <= 0x9fff) ||
            (code >= 0xf900 && code <= 0xfaff);
    }

    function token(value, start, end, type, source) {
        return {
            text: String(value),
            start: Number(start),
            end: Number(end),
            type: String(type || "word"),
            source: String(source || "core")
        };
    }

    function normalizeDictionary(text) {
        var lines = String(text || "").split(/\r?\n/);
        var map = {};
        var maxLen = 1;
        var words = [];
        var index;
        var line;
        var word;
        for (index = 0; index < lines.length; index += 1) {
            line = String(lines[index] || "").replace(/^\s+|\s+$/g, "");
            if (!line || line.charAt(0) === "#") { continue; }
            word = line.split(/\s+/)[0];
            if (!word || map[word]) { continue; }
            map[word] = true;
            words.push(word);
            if (word.length > maxLen) { maxLen = word.length; }
        }
        return { map: map, maxLen: maxLen, words: words };
    }

    function longestDictionaryMatch(text, index, dictionary) {
        var maxLen = Math.min(dictionary.maxLen || 1, text.length - index);
        var size;
        var part;
        for (size = maxLen; size > 1; size -= 1) {
            part = text.substring(index, index + size);
            if (dictionary.map[part]) { return part; }
        }
        return "";
    }

    function scanText(text, dictionary) {
        var value = String(text === null || text === undefined ? "" : text);
        var out = [];
        var index = 0;
        var start;
        var ch;
        var match;
        while (index < value.length) {
            ch = value.charAt(index);
            if (isSpace(ch)) {
                index += 1;
                continue;
            }
            start = index;
            if (isAsciiLetter(ch) || isAsciiDigit(ch) || ch === "_") {
                index += 1;
                while (index < value.length && isAsciiWord(value.charAt(index))) {
                    index += 1;
                }
                out.push(token(value.substring(start, index), start, index,
                    "word", "ascii"));
                continue;
            }
            if (isCjk(ch)) {
                match = longestDictionaryMatch(value, index, dictionary);
                if (match) {
                    out.push(token(match, index, index + match.length,
                        "word", "dictionary"));
                    index += match.length;
                } else {
                    out.push(token(ch, index, index + 1, "word", "cjk"));
                    index += 1;
                }
                continue;
            }
            out.push(token(ch, index, index + 1, "symbol", "symbol"));
            index += 1;
        }
        return out;
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
        var dictionary = options && options.dictionary ?
            options.dictionary : normalizeDictionary(options && options.dictionaryText);
        var tokens = scanText(text, dictionary);
        return {
            ok: true,
            engine: "dictionary-prefix-v1",
            tokens: tokens,
            stats: stats(tokens)
        };
    }

    function scanRegexRanges(text, rules, options) {
        var value = String(text === null || text === undefined ? "" : text);
        var source = rules || [];
        var ranges = [];
        var budget = Number(options && options.charBudget || 786432);
        var index;
        var item;
        var pattern;
        var matcher;
        var flags;
        if (value.length > budget) {
            return {
                ok: false,
                code: "TEXT_TOO_LARGE",
                ranges: [],
                consumedCount: 0,
                oversizeSkippedCount: 1
            };
        }
        for (index = 0; index < source.length; index += 1) {
            item = source[index] || {};
            if (item.enabled === false || !item.pattern) { continue; }
            try {
                flags = item.flags === undefined ? 0 : Number(item.flags || 0);
                pattern = Packages.java.util.regex.Pattern.compile(
                    String(item.pattern), flags);
                matcher = pattern.matcher(value);
                while (matcher.find()) {
                    ranges.push({
                        ruleId: String(item.id || item.title || index),
                        start: Number(matcher.start()),
                        end: Number(matcher.end()),
                        text: String(matcher.group())
                    });
                }
            } catch (error) {
                ranges.push({
                    ruleId: String(item.id || item.title || index),
                    start: -1,
                    end: -1,
                    text: "",
                    error: String(error)
                });
            }
        }
        return {
            ok: true,
            ranges: ranges,
            consumedCount: value.length,
            oversizeSkippedCount: 0
        };
    }

    ClipHub.TokenizerCore = {
        MODULE_NAME: "ch_18_tokenizer_core",
        MODULE_VERSION: 1,
        normalizeDictionary: normalizeDictionary,
        tokenize: tokenize,
        scanRegexRanges: scanRegexRanges
    };
}((function () { return this; }())));
