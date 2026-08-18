/*
 * ClipHub 分类器兼容占位模块。
 *
 * 自动内容分类已取消。保留本文件以维持模块清单、离线缓存和旧入口兼容。
 * 同时安装一次性 Translation 装配钩子：仅在 Google 翻译 Intent 成功启动后
 * 关闭 ClipHub UI；Google 未安装、空文本、启动失败或回退内置翻译时不关闭。
 */
(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var capturedTranslation = null;

    function numberOrZero(value) {
        value = Number(value || 0);
        return isFinite(value) ? value : 0;
    }

    function translationState(module) {
        try {
            if (module && typeof module.getState === "function") {
                return module.getState() || {};
            }
        } catch (ignored) {}
        return {};
    }

    function hideClipHubAfterGoogleLaunch() {
        try {
            if (ClipHub.Navigation &&
                    typeof ClipHub.Navigation.hideUi === "function") {
                ClipHub.Navigation.hideUi("google_translation_launched");
                return true;
            }
            if (ClipHub.App && typeof ClipHub.App.hideUi === "function") {
                ClipHub.App.hideUi("google_translation_launched");
                return true;
            }
        } catch (ignored) {}
        return false;
    }

    function wrapTranslation(module) {
        var original;
        if (!module || typeof module.openForItem !== "function" ||
                module.__googleHideAfterLaunchWrapped === true) {
            return module;
        }
        original = module.openForItem;
        module.openForItem = function () {
            var before = translationState(module);
            var beforeSuccess = numberOrZero(before.googleLaunchSuccessCount);
            var result = original.apply(module, arguments);
            var after = translationState(module);
            var afterSuccess = numberOrZero(after.googleLaunchSuccessCount);
            if (String(after.mode || "builtin") === "google" &&
                    afterSuccess > beforeSuccess) {
                hideClipHubAfterGoogleLaunch();
            }
            return result;
        };
        try {
            Object.defineProperty(module, "__googleHideAfterLaunchWrapped", {
                value: true,
                writable: false,
                enumerable: false,
                configurable: false
            });
        } catch (ignoredMarker) {
            module.__googleHideAfterLaunchWrapped = true;
        }
        return module;
    }

    try {
        Object.defineProperty(ClipHub, "Translation", {
            configurable: true,
            enumerable: true,
            get: function () {
                return capturedTranslation;
            },
            set: function (value) {
                capturedTranslation = wrapTranslation(value);
                try {
                    Object.defineProperty(ClipHub, "Translation", {
                        value: capturedTranslation,
                        writable: true,
                        enumerable: true,
                        configurable: true
                    });
                } catch (ignoredRestore) {}
            }
        });
    } catch (ignoredHook) {}

    return true;
}((function () { return this; }())));
