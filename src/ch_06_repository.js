(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var ready = false;
    function pending(name) {
        throw new Error("Repository operation is not implemented: " + name);
    }

    ClipHub.Repository = {
        MODULE_NAME: "ch_06_repository",
        MODULE_VERSION: 1,
        init: function () { ready = true; return true; },
        isReady: function () { return ready; },
        insert: function () { return pending("insert"); },
        update: function () { return pending("update"); },
        remove: function () { return pending("remove"); },
        query: function () { return pending("query"); },
        shutdown: function () { ready = false; return true; }
    };
}((function () { return this; }())));
