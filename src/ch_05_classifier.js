(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var URL_RE = /https?:\/\/[^\s]+/i;
    var PHONE_RE = /(?:\+?\d[\d\s-]{5,}\d)/;

    ClipHub.Classifier = {
        MODULE_NAME: "ch_05_classifier",
        MODULE_VERSION: 1,
        init: function () { return true; },
        classify: function (value) {
            var text = String(value === null || value === undefined ? "" : value);
            if (URL_RE.test(text)) { return { type: "url", confidence: 100 }; }
            if (PHONE_RE.test(text)) { return { type: "phone", confidence: 60 }; }
            return { type: "text", confidence: 100 };
        },
        shutdown: function () { return true; }
    };
}((function () { return this; }())));
