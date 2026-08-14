/* ClipHub settings tabs probe 071. Rhino ES5 only. */
var ClipHubSettingsTabsProbe071Result = (function (global) {
    var ClipHub = global.ClipHub;
    var settings = null;
    var openedByProbe = false;
    var initialState = null;
    var initialTab = "general";
    var renderCount = 0;
    var tabs = ["general", "home", "translation", "filter"];
    var index;
    var round;
    var state = null;
    var visibleCount;
    var defaultTabStable = true;
    var switchStable = true;
    var renderStable = true;
    var sectionRouting = true;
    var subpageDiagnosticsStable = true;
    var restoreStable = true;
    var errorText = null;

    function countVisible(input) {
        var count = 0;
        if (!input) { return 0; }
        if (input.settingsGeneralTabVisible === true) { count += 1; }
        if (input.settingsHomeTabVisible === true) { count += 1; }
        if (input.settingsTranslationTabVisible === true) { count += 1; }
        if (input.settingsFilterTabVisible === true) { count += 1; }
        return count;
    }

    function tabVisible(input, tab) {
        if (!input) { return false; }
        if (tab === "general") { return input.settingsGeneralTabVisible === true; }
        if (tab === "home") { return input.settingsHomeTabVisible === true; }
        if (tab === "translation") {
            return input.settingsTranslationTabVisible === true;
        }
        if (tab === "filter") { return input.settingsFilterTabVisible === true; }
        return false;
    }

    function rootStateStable(input, expectedTab) {
        return input &&
            String(input.settingsPage || "") === "root" &&
            input.settingsTabBarPresent === true &&
            String(input.settingsTab || "") === expectedTab &&
            countVisible(input) === 1 &&
            tabVisible(input, expectedTab);
    }

    function checkSection(name, expectedTab) {
        settings.scrollToSection(name);
        state = settings.getState();
        if (!rootStateStable(state, expectedTab)) {
            sectionRouting = false;
        }
    }

    try {
        if (!ClipHub || !ClipHub.Settings) {
            throw new Error("ClipHub.Settings unavailable");
        }
        settings = ClipHub.Settings;
        if (typeof settings.performSetSettingsTab !== "function") {
            throw new Error("performSetSettingsTab unavailable");
        }
        if (typeof settings.performOpenRegexRules !== "function") {
            throw new Error("performOpenRegexRules unavailable");
        }
        if (typeof settings.performSettingsBack !== "function") {
            throw new Error("performSettingsBack unavailable");
        }
        if (typeof settings.getState !== "function") {
            throw new Error("Settings.getState unavailable");
        }
        if (typeof settings.scrollToSection !== "function") {
            throw new Error("Settings.scrollToSection unavailable");
        }

        initialState = settings.getState();
        initialTab = String(initialState.settingsTab || "general");
        if (initialState.attached !== true) {
            settings.open();
            openedByProbe = true;
            state = settings.getState();
            if (!rootStateStable(state, "general")) {
                defaultTabStable = false;
            }
        } else {
            state = initialState;
            if (String(state.settingsPage || "") !== "root") {
                throw new Error("Settings probe requires root when already attached");
            }
            if (!rootStateStable(state, initialTab)) {
                switchStable = false;
            }
        }

        renderCount = Number(state.renderCount || 0);
        for (round = 0; round < 25; round += 1) {
            for (index = 0; index < tabs.length; index += 1) {
                state = settings.performSetSettingsTab(tabs[index]);
                visibleCount = countVisible(state);
                if (String(state.settingsTab || "") !== tabs[index] ||
                        visibleCount !== 1 ||
                        !tabVisible(state, tabs[index]) ||
                        state.settingsTabBarPresent !== true ||
                        String(state.settingsPage || "") !== "root") {
                    switchStable = false;
                }
                if (Number(state.renderCount || 0) !== renderCount) {
                    renderStable = false;
                }
            }
        }

        checkSection("tags", "filter");
        checkSection("regex", "filter");
        checkSection("translation", "translation");
        checkSection("pagination", "home");
        checkSection("data", "general");

        state = settings.performSetSettingsTab("filter");
        if (!rootStateStable(state, "filter")) {
            switchStable = false;
        }
        state = settings.performOpenRegexRules();
        if (String(state.settingsPage || "") !== "regex_rules" ||
                state.settingsTabBarPresent !== false ||
                countVisible(state) !== 0) {
            subpageDiagnosticsStable = false;
        }
        state = settings.performSettingsBack();
        if (!rootStateStable(state, "filter")) {
            subpageDiagnosticsStable = false;
        }
    } catch (error) {
        errorText = String(error);
    }

    try {
        if (settings !== null) {
            if (openedByProbe) {
                if (typeof settings.close !== "function") {
                    restoreStable = false;
                } else {
                    settings.close("settings_tabs_probe_071");
                }
            } else if (initialState !== null && initialState.attached === true &&
                    String(initialState.settingsPage || "") === "root") {
                state = settings.performSetSettingsTab(initialTab);
                if (!rootStateStable(state, initialTab)) {
                    restoreStable = false;
                }
            }
        }
    } catch (restoreError) {
        restoreStable = false;
        if (errorText === null) {
            errorText = "restore: " + String(restoreError);
        }
    }

    return {
        probe: 71,
        ok: errorText === null && defaultTabStable && switchStable &&
            renderStable && sectionRouting && subpageDiagnosticsStable &&
            restoreStable,
        initialTab: initialTab,
        openedByProbe: openedByProbe,
        defaultTabStable: defaultTabStable,
        switchStable: switchStable,
        renderStable: renderStable,
        sectionRouting: sectionRouting,
        subpageDiagnosticsStable: subpageDiagnosticsStable,
        restoreStable: restoreStable,
        renderCountBefore: renderCount,
        renderCountAfter: state === null ? null : Number(state.renderCount || 0),
        error: errorText
    };
}((function () { return this; }())));

JSON.stringify(ClipHubSettingsTabsProbe071Result, null, 2);
