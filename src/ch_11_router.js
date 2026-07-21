// @version 1.0.0
// ClipHub - 单窗口内部路由
(function (CH) {
    "use strict";

    var base = CH.base;
    var router = {};
    var routes = {};
    var stack = [];
    var current = null;

    router.register = function (name, builder) {
        var routeName = String(name || "");
        if (!routeName || typeof builder !== "function") {
            throw new Error("无效路由注册: " + routeName);
        }
        routes[routeName] = builder;
    };

    function render(name, params, direction) {
        var routeName = String(name || "home");
        var builder = routes[routeName];
        if (typeof builder !== "function") {
            if (CH.components) CH.components.toast("页面尚未实现: " + routeName);
            return false;
        }
        var page = builder(params || {});
        if (!page) return false;
        CH.window.replacePage(page);
        current = { name: routeName, params: params || {} };
        CH.state.currentRoute = routeName;
        try {
            page.setAlpha(0);
            page.setTranslationX(base.dp(direction === "back" ? -8 : 8));
            page.animate().cancel();
            page.animate().alpha(1).translationX(0).setDuration(120).start();
        } catch (eAnimation) {}
        if (CH.log) CH.log.event("ROUTE_CHANGED", { route: routeName, direction: direction || "reset" });
        return true;
    }

    router.reset = function (name, params) {
        stack = [];
        return render(name || "home", params || {}, "reset");
    };

    router.open = function (name, params) {
        if (current) stack.push(current);
        if (!render(name, params || {}, "forward")) {
            if (current) stack.pop();
            return false;
        }
        return true;
    };

    router.back = function () {
        if (stack.length <= 0) return false;
        var previous = stack.pop();
        return render(previous.name, previous.params, "back");
    };

    router.canGoBack = function () {
        return stack.length > 0;
    };

    router.current = function () {
        return current;
    };

    router.clear = function () {
        stack = [];
        current = null;
    };

    CH.router = router;
}(CH));
