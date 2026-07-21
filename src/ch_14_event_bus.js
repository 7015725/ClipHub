(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var listeners = {};

    ClipHub.EventBus = {
        MODULE_NAME: "ch_14_event_bus",
        MODULE_VERSION: 1,
        init: function () { listeners = {}; return true; },
        on: function (name, listener) {
            name = String(name);
            if (typeof listener !== "function") {
                throw new Error("Listener must be a function");
            }
            listeners[name] = listeners[name] || [];
            listeners[name].push(listener);
            return listener;
        },
        off: function (name, listener) {
            var list = listeners[String(name)];
            var index;
            if (!list) { return false; }
            for (index = list.length - 1; index >= 0; index -= 1) {
                if (list[index] === listener) {
                    list.splice(index, 1);
                    return true;
                }
            }
            return false;
        },
        emit: function (name, payload) {
            var list = listeners[String(name)];
            var snapshot;
            var index;
            if (!list) { return 0; }
            snapshot = list.slice(0);
            for (index = 0; index < snapshot.length; index += 1) {
                try { snapshot[index](payload); } catch (error) {
                    if (ClipHub.Log) { ClipHub.Log.error(error); }
                }
            }
            return snapshot.length;
        },
        shutdown: function () { listeners = {}; return true; }
    };
}((function () { return this; }())));
