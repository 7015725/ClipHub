(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});

    function trim(value) {
        return String(value === null || value === undefined ? "" : value)
            .replace(/^\s+|\s+$/g, "");
    }

    function normalizeType(value) {
        value = String(value || "text").toLowerCase();
        if (value === "link") { return "url"; }
        if (value === "url" || value === "email" || value === "phone" ||
                value === "code") {
            return value;
        }
        return "text";
    }

    function isFullUrl(text) {
        return /^(?:https?:\/\/|ftp:\/\/|www\.)[^\s]+$/i.test(text);
    }

    function isFullEmail(text) {
        return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(text);
    }

    function isFullPhone(text) {
        var digits;
        if (!/^\+?[0-9\s().-]+$/.test(text)) { return false; }
        digits = text.replace(/\D/g, "");
        return digits.length >= 7 && digits.length <= 15;
    }

    function looksLikeJson(text) {
        var first = text.charAt(0);
        var last = text.charAt(text.length - 1);
        if (!((first === "{" && last === "}") ||
                (first === "[" && last === "]"))) {
            return false;
        }
        try {
            JSON.parse(text);
            return true;
        } catch (ignored) {
            return false;
        }
    }

    function codeScore(text) {
        var score = 0;
        var lines = text.split(/\r?\n/);
        if (/^#!\//.test(text)) { score += 3; }
        if (looksLikeJson(text)) { score += 3; }
        if (/\b(function|var|let|const|class|interface|package|import|return)\b/.test(text)) {
            score += 2;
        }
        if (/\b(if|else|for|while|switch|case|try|catch)\s*[({]/.test(text)) {
            score += 2;
        }
        if (/\b(SELECT|INSERT|UPDATE|DELETE)\b[\s\S]+\b(FROM|INTO|SET|WHERE)\b/i.test(text)) {
            score += 3;
        }
        if (/[{};][\s\S]*[{};]/.test(text)) { score += 1; }
        if (lines.length >= 3 && /^[\s\t]*(?:[$#>]\s*)?[A-Za-z0-9_.-]+(?:\s+--?[A-Za-z0-9_-]+|\s+[^\s]+)+/m.test(text)) {
            score += 1;
        }
        return score;
    }

    function classify(value) {
        var text = trim(value);
        var score;
        if (text.length === 0) {
            return { type: "text", confidence: 0 };
        }
        if (isFullUrl(text)) {
            return { type: "url", confidence: 100 };
        }
        if (isFullEmail(text)) {
            return { type: "email", confidence: 100 };
        }
        if (isFullPhone(text)) {
            return { type: "phone", confidence: 95 };
        }
        score = codeScore(text);
        if (score >= 3) {
            return { type: "code", confidence: Math.min(95, 65 + score * 5) };
        }
        return { type: "text", confidence: 100 };
    }

    ClipHub.Classifier = {
        MODULE_NAME: "ch_05_classifier",
        MODULE_VERSION: 1,
        init: function () { return true; },
        classify: classify,
        normalizeType: normalizeType,
        shutdown: function () { return true; }
    };
}((function () { return this; }())));
