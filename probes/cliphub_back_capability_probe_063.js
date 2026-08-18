/* ClipHub predictive Back capability probe 063. Rhino ES5 only.
 * This probe does not require the ClipHub window to be visible.
 */
(function (global) {
    var Build = Packages.android.os.Build;
    var SystemProperties = null;
    var appContext = global.context && global.context.getApplicationContext ?
        (global.context.getApplicationContext() || global.context) : global.context;
    var result = {
        ok: true,
        probe: "cliphub_back_capability_probe_063",
        probeVersion: 1,
        sdkInt: Number(Build.VERSION.SDK_INT),
        packageName: null,
        targetSdkVersion: null,
        applicationInfoPredictiveBackEnabled: null,
        windowDispatcherPredictiveBackEnabled: null,
        systemPredictiveBackProperty: null,
        classification: "UNKNOWN",
        errors: []
    };

    function errorText(error) {
        try { return String(error); }
        catch (ignored) { return "unknown"; }
    }

    try {
        result.packageName = String(appContext.getPackageName());
    } catch (errorPackage) {
        result.errors.push("packageName: " + errorText(errorPackage));
    }

    try {
        var info = appContext.getApplicationInfo();
        result.targetSdkVersion = Number(info.targetSdkVersion);
        try {
            result.applicationInfoPredictiveBackEnabled =
                info.isOnBackInvokedCallbackEnabled() === true;
        } catch (errorAppFlag) {
            result.errors.push("ApplicationInfo.isOnBackInvokedCallbackEnabled: " +
                errorText(errorAppFlag));
        }
    } catch (errorInfo) {
        result.errors.push("applicationInfo: " + errorText(errorInfo));
    }

    try {
        var DispatcherClass = Packages.android.window.WindowOnBackInvokedDispatcher;
        result.windowDispatcherPredictiveBackEnabled =
            DispatcherClass.isOnBackInvokedCallbackEnabled(appContext) === true;
    } catch (errorDispatcherDirect) {
        result.errors.push("WindowOnBackInvokedDispatcher direct: " +
            errorText(errorDispatcherDirect));
        try {
            var clazz = Packages.java.lang.Class.forName(
                "android.window.WindowOnBackInvokedDispatcher");
            var ContextClass = Packages.java.lang.Class.forName(
                "android.content.Context");
            var method = clazz.getDeclaredMethod(
                "isOnBackInvokedCallbackEnabled", ContextClass);
            method.setAccessible(true);
            result.windowDispatcherPredictiveBackEnabled =
                method.invoke(null, appContext) === true;
        } catch (errorDispatcherReflect) {
            result.errors.push("WindowOnBackInvokedDispatcher reflect: " +
                errorText(errorDispatcherReflect));
        }
    }

    try {
        SystemProperties = Packages.android.os.SystemProperties;
        result.systemPredictiveBackProperty = Number(
            SystemProperties.getInt("persist.wm.debug.predictive_back", 1));
    } catch (errorProperty) {
        result.errors.push("SystemProperties: " + errorText(errorProperty));
    }

    if (result.systemPredictiveBackProperty === 0) {
        result.classification = "SYSTEM_PREDICTIVE_BACK_DISABLED";
    } else if (result.windowDispatcherPredictiveBackEnabled === false ||
            result.applicationInfoPredictiveBackEnabled === false) {
        result.classification = "HOST_APP_PREDICTIVE_BACK_DISABLED";
    } else if (result.windowDispatcherPredictiveBackEnabled === true ||
            result.applicationInfoPredictiveBackEnabled === true) {
        result.classification = "HOST_APP_PREDICTIVE_BACK_ENABLED";
    } else {
        result.classification = "CAPABILITY_COULD_NOT_BE_READ";
    }

    global.ClipHubBackCapabilityProbe063Result = result;
}((function () { return this; }())));

JSON.stringify(ClipHubBackCapabilityProbe063Result);