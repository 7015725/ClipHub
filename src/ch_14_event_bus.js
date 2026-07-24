(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var listeners = {};
    var ready = false;
    var state = {
        initCount: 0,
        shutdownCount: 0,
        emitCount: 0,
        deliveryCount: 0,
        listenerCount: 0,
        lastEventName: "",
        lastError: null
    };
    var recentsState = {
        retired: true,
        owner: "Navigation",
        reason: "duplicate_navigation_monitor_removed",
        running: false,
        startCount: 0,
        stopCount: 0,
        sampleCount: 0,
        signalCount: 0,
        confirmedSignalCount: 0,
        hideCount: 0,
        intervalMs: 180,
        confirmCount: 2,
        baselinePackage: "",
        baselineActivityType: 0,
        baselineTaskId: -1,
        lastPackage: "",
        lastActivityType: 0,
        lastTaskId: -1,
        lastSignalReason: "",
        lastStartReason: "",
        lastStopReason: "",
        lastHideReason: "",
        lastError: null
    };

    function logError(error) {
        state.lastError = String(error);
        try {
            if (ClipHub.Log && typeof ClipHub.Log.error === "function") {
                ClipHub.Log.error(error);
            }
        } catch (ignored) {}
    }

    function countListeners() {
        var names = Object.keys(listeners);
        var total = 0;
        var index;
        for (index = 0; index < names.length; index += 1) {
            total += listeners[names[index]].length;
        }
        state.listenerCount = total;
        return total;
    }

    function eventState() {
        return {
            ready: ready,
            initCount: Number(state.initCount),
            shutdownCount: Number(state.shutdownCount),
            emitCount: Number(state.emitCount),
            deliveryCount: Number(state.deliveryCount),
            listenerCount: countListeners(),
            eventNameCount: Object.keys(listeners).length,
            lastEventName: state.lastEventName,
            lastError: state.lastError
        };
    }

    function recentsStateSnapshot() {
        return {
            retired: true,
            owner: recentsState.owner,
            reason: recentsState.reason,
            running: false,
            startCount: Number(recentsState.startCount),
            stopCount: Number(recentsState.stopCount),
            sampleCount: Number(recentsState.sampleCount),
            signalCount: Number(recentsState.signalCount),
            confirmedSignalCount:
                Number(recentsState.confirmedSignalCount),
            hideCount: Number(recentsState.hideCount),
            intervalMs: Number(recentsState.intervalMs),
            confirmCount: Number(recentsState.confirmCount),
            baselinePackage: recentsState.baselinePackage,
            baselineActivityType:
                Number(recentsState.baselineActivityType),
            baselineTaskId: Number(recentsState.baselineTaskId),
            lastPackage: recentsState.lastPackage,
            lastActivityType: Number(recentsState.lastActivityType),
            lastTaskId: Number(recentsState.lastTaskId),
            lastSignalReason: recentsState.lastSignalReason,
            lastStartReason: recentsState.lastStartReason,
            lastStopReason: recentsState.lastStopReason,
            lastHideReason: recentsState.lastHideReason,
            lastError: recentsState.lastError
        };
    }

    ClipHub.RecentsWatch = {
        MODULE_NAME: "ch_16_recents_watch_compat",
        MODULE_VERSION: 2,
        init: function () {
            recentsState.running = false;
            recentsState.lastError = null;
            return true;
        },
        start: function (reason) {
            recentsState.startCount += 1;
            recentsState.running = false;
            recentsState.lastStartReason = String(
                reason || "delegated_to_navigation");
            recentsState.lastStopReason =
                "delegated_to_navigation";
            return true;
        },
        stop: function (reason) {
            recentsState.stopCount += 1;
            recentsState.running = false;
            recentsState.lastStopReason = String(
                reason || "delegated_to_navigation");
            return true;
        },
        sampleNow: function () {
            var navigationState = null;
            recentsState.sampleCount += 1;
            try {
                if (ClipHub.Navigation &&
                        typeof ClipHub.Navigation.getState === "function") {
                    navigationState = ClipHub.Navigation.getState();
                }
            } catch (error) {
                recentsState.lastError = String(error);
            }
            return {
                snapshot: null,
                signalReason: "delegated_to_navigation",
                navigationState: navigationState,
                state: recentsStateSnapshot()
            };
        },
        getState: recentsStateSnapshot,
        shutdown: function () {
            recentsState.running = false;
            recentsState.lastStopReason = "shutdown";
            return true;
        }
    };

    ClipHub.EventBus = {
        MODULE_NAME: "ch_14_event_bus",
        MODULE_VERSION: 4,
        init: function () {
            listeners = {};
            ready = true;
            state.initCount += 1;
            state.emitCount = 0;
            state.deliveryCount = 0;
            state.listenerCount = 0;
            state.lastEventName = "";
            state.lastError = null;
            return true;
        },
        on: function (name, listener) {
            name = String(name);
            if (typeof listener !== "function") {
                throw new Error("Listener must be a function");
            }
            listeners[name] = listeners[name] || [];
            listeners[name].push(listener);
            countListeners();
            return listener;
        },
        off: function (name, listener) {
            var list = listeners[String(name)];
            var index;
            if (!list) { return false; }
            for (index = list.length - 1; index >= 0; index -= 1) {
                if (list[index] === listener) {
                    list.splice(index, 1);
                    if (list.length === 0) {
                        delete listeners[String(name)];
                    }
                    countListeners();
                    return true;
                }
            }
            return false;
        },
        emit: function (name, payload) {
            var eventName = String(name);
            var list = listeners[eventName];
            var snapshot;
            var index;
            state.emitCount += 1;
            state.lastEventName = eventName;
            if (!list) { return 0; }
            snapshot = list.slice(0);
            for (index = 0; index < snapshot.length; index += 1) {
                try {
                    snapshot[index](payload);
                    state.deliveryCount += 1;
                } catch (error) {
                    logError(error);
                }
            }
            return snapshot.length;
        },
        getState: eventState,
        shutdown: function () {
            listeners = {};
            ready = false;
            state.shutdownCount += 1;
            state.listenerCount = 0;
            return true;
        }
    };
}((function () { return this; }())));
