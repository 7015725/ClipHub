/* ClipHub regex settings IME probe 055. Rhino ES5. */
(function (global) {
    var C = global.ClipHub;
    C.Settings.open();
    C.Settings.performOpenRegexEditor(null);
    var focused = C.Settings.performFocusInput("regex.pattern");
    ({ probe: 55, ok: focused === true, state: C.Settings.getState() });
}((function () { return this; }())));
