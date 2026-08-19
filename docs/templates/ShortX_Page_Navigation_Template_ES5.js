/* ShortX Page Navigation Template v1. Rhino ES5 only.
 * Copy this pattern for new ClipHub pages or other ShortX projects.
 * System Back belongs to Navigation; page code only owns requestExit().
 */
(function (global) {
    var App = global.App || (global.App = {});
    var PAGE_ID = "example_page";
    var PAGE_TITLE = "示例页面";
    var pageRoot = null;
    var inputView = null;
    var state = {
        attached: false,
        dirty: false,
        transientOpen: false
    };

    function closeTransientLayer() {
        if (!state.transientOpen) { return false; }
        state.transientOpen = false;
        return true;
    }

    function showUnsavedConfirm() {
        /* Project-owned confirmation UI. */
        return true;
    }

    function closePage(reason) {
        state.attached = false;
        if (App.UIShell && typeof App.UIShell.unmountPage === "function") {
            return App.UIShell.unmountPage(PAGE_ID,
                String(reason || "page_close")) !== false;
        }
        return true;
    }

    function requestExit(reason) {
        if (closeTransientLayer()) { return true; }
        if (state.dirty) { return showUnsavedConfirm(); }
        return closePage(reason);
    }

    function handoffBackFocusAfterImeHide() {
        if (!App.Navigation ||
                typeof App.Navigation.handoffBackFocus !== "function") {
            return false;
        }
        return App.Navigation.handoffBackFocus({
            pageRoot: pageRoot,
            windowRoot: null,
            fallbackRoot: pageRoot,
            inputView: inputView
        }).ok === true;
    }

    function mount(view, editText) {
        pageRoot = view;
        inputView = editText || null;
        if (!App.UIShell || typeof App.UIShell.mountPage !== "function") {
            throw new Error("UIShell unavailable");
        }
        App.UIShell.mountPage(PAGE_ID, pageRoot, {
            title: PAGE_TITLE,
            showBack: true,
            onBack: function () {
                return requestExit("navigation_back");
            },
            onClose: function () {
                return requestExit("navigation_close");
            }
        });
        state.attached = true;
        return true;
    }

    App.ExamplePage = {
        mount: mount,
        requestExit: requestExit,
        handoffBackFocusAfterImeHide: handoffBackFocusAfterImeHide,
        getState: function () {
            return {
                attached: state.attached,
                dirty: state.dirty,
                transientOpen: state.transientOpen
            };
        }
    };
}((function () { return this; }())));
