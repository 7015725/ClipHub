(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var value = null;
    function emptyValue() {
        return {
            keyword: "",
            sourcePackages: [],
            contentTypes: [],
            tagIds: [],
            pinnedOnly: false
        };
    }
    ClipHub.Filter = {
        MODULE_NAME: "ch_11_filter",
        MODULE_VERSION: 1,
        init: function () { value = emptyValue(); return true; },
        get: function () { return value; },
        reset: function () { value = emptyValue(); return value; },
        setKeyword: function (keyword) {
            value.keyword = String(keyword || "");
            return value.keyword;
        },
        shutdown: function () { value = null; return true; }
    };
}((function () { return this; }())));
