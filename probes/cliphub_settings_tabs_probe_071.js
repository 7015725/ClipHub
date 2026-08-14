/* ClipHub settings tabs probe 071. Rhino ES5 only. */
var ClipHubSettingsTabsProbe071Result = (function (global) {
    var ClipHub = global.ClipHub;
    var settings;
    var openedByProbe = false;
    var initialState;
    var renderCount;
    var tabs = ["general", "home", "translation", "filter"];
    var index;
    var round;
    var state;
    var visibleCount;
    var switchStable = true;
    var renderStable = true;
    var sectionRouting = true;
    var errorText = null;

    function countVisible(input) {
        var count = 0;
        if (input.settingsGeneralTabVisible === true) { count += 1; }
        if (input.settingsHomeTabVisible === true) { count += 1; }
        if (input.settingsTranslationTabVisible === true) { count += 1; }
        if (input.settingsFilterTabVisible === true) { count += 1; }
        return count;
    }

    function tabVisible(input, tab) {
        if (tab === "general") { return input.settingsGeneralTabVisible === true; }
        if (tab === "home") { return input.settingsHomeTabVisible === true; }
        if (tab === "translation") {
            return input.settingsTranslationTabVisible === true;
        }
        if (tab === "filter") { return input.settingsFilterTabVisible === true; }
        return false;
    }

    try {
        if (!ClipHub || !ClipHub.Settings) {
            throw new Error("ClipHub.Settings unavailable");
        }
        settings = ClipHub.Settings;
        if (typeof settings.performSetSettingsTab !== "function") {
            throw new Error("performSetSettingsTab unavailable");
        }
        if (typeof settings.getState !== "function") {
            throw new Error("Settings.getState unavailable");
        }

        initialState = settings.getState();
        if (initialState.attached !== true) {
            settings.open();
            openedByProbe = true;
        }
        state = settings.getState();
        renderCount = Number(state.renderCount || 0);

        if (state.settingsTabBarPresent !== true ||
                String(state.settingsPage || "") !== "root") {
            switchStable = false;
        }

        for (round = 0; round < 25; round += 1) {
            for (index = 0; index < tabs.length; index += 1) {
                state = settings.performSetSettingsTab(tabs[index]);
                visibleCount = countVisible(state);
                if (String(state.settingsTab || "") !== tabs[index] ||
                        visibleCount !== 1 ||
                        !tabVisible(state, tabs[index])) {
                    switchStable = false;
                }
                if (Number(state.renderCount || 0) !== renderCount) {
                    renderStable = false;
                }
            }
        }

        if (typeof settings.scrollToSection === "function") {
            settings.scrollToSection("tags");
            state = settings.getState();
            if (String(state.settingsTab || "") !== "filter") {
                sectionRouting = false;
            }
            settings.scrollToSection("translation");
            state = settings.getState();
            if (String(state.settingsTab || "") !== "translation") {
                sectionRouting = false;
            }
        }

        settings.performSetSettingsTab("general");
        state = settings.getState();

        return {
            probe: 71,
            ok: switchStable && renderStable && sectionRouting &&
                state.settingsTabBarPresent === true &&
                String(state.settingsTab || "") === "general",
            settingsPage: String(state.settingsPage || ""),
            settingsTab: String(state.settingsTab || ""),
            settingsTabBarPresent: state.settingsTabBarPresent === true,
            tabSwitchCount: Number(state.settingsTabSwitchCount || 0),
            switchStable: switchStable,
            renderStable: renderStable,
            sectionRouting: sectionRouting,
            renderCountBefore: renderCount,
            renderCountAfter: Number(state.renderCount || 0),
            visibleCount: countVisible(state),
            openedByProbe: openedByProbe,
            error: null
        };
    } catch (error) {
        errorText = String(error);
        return {
            probe: 71,
            ok: false,
            switchStable: switchStable,
            renderStable: renderStable,
            sectionRouting: sectionRouting,
            openedByProbe: openedByProbe,
            error: errorText
        };
    } finally {
        try {
            if (settings && typeof settings.performSetSettingsTab === "function") {
                settings.performSetSettingsTab("general");
            }
        } catch (ignoredRestore) {}
        try {
            if (openedByProbe && settings && typeof settings.close === "function") {
                settings.close("settings_tabs_probe_071");
            }
        } catch (ignoredClose) {}
    }
}((function () { return this; }())));

JSON.stringify(ClipHubSettingsTabsProbe071Result, null, 2);
