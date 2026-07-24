(function (global) {
    var ClipHub = global.ClipHub || (global.ClipHub = {});
    var File = Packages.java.io.File;
    var FIS = Packages.java.io.FileInputStream;
    var FOS = Packages.java.io.FileOutputStream;
    var BAOS = Packages.java.io.ByteArrayOutputStream;
    var ReflectArray = Packages.java.lang.reflect.Array;
    var JavaByte = Packages.java.lang.Byte;
    var JavaString = Packages.java.lang.String;
    var URL = Packages.java.net.URL;
    var MessageDigest = Packages.java.security.MessageDigest;
    var System = Packages.java.lang.System;
    var Build = Packages.android.os.Build;
    var Context = Packages.android.content.Context;
    var Handler = Packages.android.os.Handler;
    var Looper = Packages.android.os.Looper;
    var Rect = Packages.android.graphics.Rect;
    var WindowInsets = Packages.android.view.WindowInsets;
    var ViewConfiguration = Packages.android.view.ViewConfiguration;
    var Gravity = Packages.android.view.Gravity;

    var COMPACT_COMMIT = "84a008ada8f681c16a7326fded0bd07d06fc8029";
    var COMPACT_BLOB = "06e62539e5f9a0af0067840d927a0cbec679eead";
    var STABLE_COMMIT = "16052f67dbd0323fbe0b203ec64fe11c08a41308";
    var STABLE_BLOB = "42457aa526a2fac000a482c914194332a19fa743";
    var CACHE_VERSION = "v31";
    var SOURCE_PATH = "src/ch_11_filter.js";

    var options = global.ClipHubBootstrapOptions || {};
    var runtimeName = options.runtimeName === undefined ?
        "ClipHub" : String(options.runtimeName);
    var shortxRoot = String(shortx.getShortXDir());
    var runtimeDir = new File(shortxRoot, runtimeName);
    var cacheDir = new File(runtimeDir, "cache");
    var compactCache = new File(cacheDir,
        "ch_11_filter_compact_" + CACHE_VERSION + ".js");
    var stableCache = new File(cacheDir,
        "ch_11_filter_stable_fallback.js");
    var pendingFile = new File(cacheDir,
        "ch_11_filter_compact_" + CACHE_VERSION + ".pending");
    var disabledFile = new File(cacheDir,
        "ch_11_filter_compact_" + CACHE_VERSION + ".disabled");
    var failureFile = new File(cacheDir,
        "ch_11_filter_compact_" + CACHE_VERSION + ".failure.txt");
    var activeImeController = null;

    function closeQuietly(value) {
        if (value !== null && value !== undefined) {
            try { value.close(); } catch (ignored) {}
        }
    }

    function ensureDir(dir) {
        if (!dir.exists() && !dir.mkdirs() && !dir.isDirectory()) {
            throw new Error("Cannot create directory: " +
                dir.getAbsolutePath());
        }
        if (!dir.isDirectory()) {
            throw new Error("Not a directory: " + dir.getAbsolutePath());
        }
        return dir;
    }

    function readBytes(stream) {
        var output = new BAOS();
        var buffer = ReflectArray.newInstance(JavaByte.TYPE, 8192);
        var count;
        try {
            while ((count = stream.read(buffer)) >= 0) {
                if (count > 0) { output.write(buffer, 0, count); }
            }
            return output.toByteArray();
        } finally {
            closeQuietly(stream);
            closeQuietly(output);
        }
    }

    function readUtf8(file) {
        return String(new JavaString(readBytes(new FIS(file)), "UTF-8"));
    }

    function writeUtf8(file, text) {
        var stream = null;
        ensureDir(file.getParentFile());
        try {
            stream = new FOS(file, false);
            stream.write(new JavaString(String(text)).getBytes("UTF-8"));
            stream.flush();
        } finally {
            closeQuietly(stream);
        }
    }

    function writeMarker(file, text) {
        try {
            writeUtf8(file, String(text || "") + "\n");
            return true;
        } catch (ignored) {
            return false;
        }
    }

    function deleteQuietly(file) {
        try {
            return !file.exists() || file.delete();
        } catch (ignored) {
            return false;
        }
    }

    function errorText(error) {
        try {
            if (error && error.javaException) {
                return String(error.javaException.getClass().getName()) +
                    ": " + String(error);
            }
        } catch (ignored) {}
        return String(error);
    }

    function gitBlobSha(text) {
        var content = new JavaString(String(text)).getBytes("UTF-8");
        var prefix = new JavaString(
            "blob " + String(content.length) + "\u0000"
        ).getBytes("UTF-8");
        var digest = MessageDigest.getInstance("SHA-1");
        var bytes;
        var output = [];
        var index;
        var value;
        var hex;
        digest.update(prefix);
        digest.update(content);
        bytes = digest.digest();
        for (index = 0; index < bytes.length; index += 1) {
            value = Number(bytes[index]);
            if (value < 0) { value += 256; }
            hex = value.toString(16);
            output.push(hex.length === 1 ? "0" + hex : hex);
        }
        return output.join("");
    }

    function rawUrl(commit) {
        return "https://raw.githubusercontent.com/7015725/ClipHub/" +
            String(commit) + "/" + SOURCE_PATH +
            "?cliphub-filter-loader=" + CACHE_VERSION + "-" +
            Number(System.currentTimeMillis());
    }

    function fetchSource(commit) {
        var connection = null;
        var code;
        var bytes;
        var text;
        try {
            connection = new URL(rawUrl(commit)).openConnection();
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(20000);
            connection.setUseCaches(false);
            connection.setRequestProperty("Accept", "text/plain, */*");
            connection.setRequestProperty("Accept-Encoding", "identity");
            connection.setRequestProperty("Cache-Control", "no-cache");
            connection.setRequestProperty("Pragma", "no-cache");
            connection.setRequestProperty(
                "User-Agent", "ClipHub-Filter-Recovery/" + CACHE_VERSION);
            code = Number(connection.getResponseCode());
            bytes = readBytes(code >= 200 && code < 300 ?
                connection.getInputStream() : connection.getErrorStream());
            text = String(new JavaString(bytes, "UTF-8"));
            if (code < 200 || code >= 300) {
                throw new Error("Raw GitHub HTTP " + code + ": " +
                    text.substring(0, 240));
            }
            return text;
        } finally {
            if (connection !== null) {
                try { connection.disconnect(); } catch (ignored) {}
            }
        }
    }

    function requireBlob(text, expected, label) {
        var actual = gitBlobSha(text);
        if (actual !== String(expected)) {
            throw new Error(label + " blob mismatch: " + actual +
                " != " + expected);
        }
        return text;
    }

    function readVerified(file, expected, label) {
        var text;
        if (!file.isFile()) { return null; }
        try {
            text = readUtf8(file);
            return requireBlob(text, expected, label);
        } catch (ignored) {
            deleteQuietly(file);
            return null;
        }
    }

    function patchCompactSource(source) {
        var oldProbe =
            "            advancedButtonText: advancedView !== null ?\n" +
            "                String(advancedView.getText()) : \"\",\n";
        var newProbe =
            "            advancedButtonText: advancedView !== null ?\n" +
            "                (activeAdvancedFilterCount() > 0 ?\n" +
            "                    \"筛选(\" + String(activeAdvancedFilterCount()) + \")\" :\n" +
            "                    \"筛选\") : \"\",\n";
        var oldVersion = "        MODULE_VERSION: 28,\n";
        var newVersion = "        MODULE_VERSION: 31,\n";
        var oldAdvancedSearch =
            "        params = new LinearLayout.LayoutParams(\n" +
            "            LinearLayout.LayoutParams.MATCH_PARENT, dp(40));\n" +
            "        params.bottomMargin = dp(9);\n" +
            "        drawer.addView(buildAdvancedKeywordInput(colors), params);\n";
        var newAdvancedSearch =
            "        advancedKeywordInput = null;\n" +
            "        state.advancedKeywordInputPresent = false;\n";
        var first;
        var second;
        var third;

        requireBlob(source, COMPACT_BLOB, "compact source");
        first = source.indexOf(oldProbe);
        if (first < 0 || source.indexOf(oldProbe,
                first + oldProbe.length) >= 0) {
            throw new Error("Compact state probe contract site mismatch");
        }
        source = source.substring(0, first) + newProbe +
            source.substring(first + oldProbe.length);

        second = source.indexOf(oldVersion);
        if (second < 0 || source.indexOf(oldVersion,
                second + oldVersion.length) >= 0) {
            throw new Error("Compact module version site mismatch");
        }
        source = source.substring(0, second) + newVersion +
            source.substring(second + oldVersion.length);

        third = source.indexOf(oldAdvancedSearch);
        if (third < 0 || source.indexOf(oldAdvancedSearch,
                third + oldAdvancedSearch.length) >= 0) {
            throw new Error("Advanced filter search contract site mismatch");
        }
        source = source.substring(0, third) + newAdvancedSearch +
            source.substring(third + oldAdvancedSearch.length);

        if (source.indexOf("advancedView.getText()") >= 0 ||
                source.indexOf("MODULE_VERSION: 31") < 0 ||
                source.indexOf("advancedView = statusFilter;") < 0 ||
                source.indexOf(
                    "drawer.addView(buildAdvancedKeywordInput(colors), params);") >= 0 ||
                source.indexOf(
                    "state.advancedKeywordInputPresent = false;") < 0 ||
                source.indexOf(
                    "reference_search_v12_compact_header") < 0) {
            throw new Error("Compact source runtime contract validation failed");
        }
        return source;
    }

    function validatePatchedCompact(source) {
        if (source.indexOf("advancedView.getText()") >= 0 ||
                source.indexOf("MODULE_VERSION: 31") < 0 ||
                source.indexOf("advancedView = statusFilter;") < 0 ||
                source.indexOf(
                    "drawer.addView(buildAdvancedKeywordInput(colors), params);") >= 0 ||
                source.indexOf(
                    "state.advancedKeywordInputPresent = false;") < 0 ||
                source.indexOf(
                    "reference_search_v12_compact_header") < 0) {
            throw new Error("Cached compact source validation failed");
        }
        return source;
    }

    function stableFromPreviousModules() {
        var previous = new File(new File(runtimeDir, "modules.backup"),
            "ch_11_filter.js");
        return readVerified(previous, STABLE_BLOB,
            "previous stable filter");
    }

    function ensureStableSource() {
        var source = readVerified(stableCache, STABLE_BLOB,
            "stable cache");
        if (source !== null) { return source; }
        source = stableFromPreviousModules();
        if (source === null) {
            source = requireBlob(fetchSource(STABLE_COMMIT), STABLE_BLOB,
                "remote stable filter");
        }
        writeUtf8(stableCache, source);
        return source;
    }

    function ensureCompactSource() {
        var source = null;
        if (compactCache.isFile()) {
            try {
                source = validatePatchedCompact(readUtf8(compactCache));
            } catch (ignored) {
                deleteQuietly(compactCache);
                source = null;
            }
        }
        if (source !== null) { return source; }
        source = patchCompactSource(fetchSource(COMPACT_COMMIT));
        writeUtf8(compactCache, source);
        return source;
    }

    function executeSource(source) {
        eval(String(source));
        if (!ClipHub.Filter ||
                typeof ClipHub.Filter.showRoot !== "function") {
            throw new Error("Filter module did not initialize");
        }
        return ClipHub.Filter;
    }

    function markCompactFailure(error) {
        writeMarker(failureFile, errorText(error));
        writeMarker(disabledFile,
            "disabled after incomplete compact show at " +
            Number(System.currentTimeMillis()));
    }

    function clampNumber(value, minimum, maximum) {
        var number = Number(value);
        var low = Number(minimum);
        var high = Number(maximum);
        if (!isFinite(number)) { number = low; }
        if (high < low) { high = low; }
        return Math.max(low, Math.min(high, number));
    }

    function copyLayout(params) {
        return {
            width: Number(params.width),
            height: Number(params.height),
            gravity: Number(params.gravity),
            x: Number(params.x),
            y: Number(params.y)
        };
    }

    function sameLayout(params, target) {
        return Number(params.width) === Number(target.width) &&
            Number(params.height) === Number(target.height) &&
            Number(params.gravity) === Number(target.gravity) &&
            Number(params.x) === Number(target.x) &&
            Number(params.y) === Number(target.y);
    }

    function isFilterRole(role) {
        role = String(role || "");
        return role === "primary" || role === "filter_overlay";
    }

    function hasFocusedEditText(rootView) {
        var focused;
        var type;
        try {
            if (rootView === null || !rootView.hasWindowFocus()) {
                return false;
            }
            focused = rootView.findFocus();
            if (focused === null) { return false; }
            type = focused.getClass();
            while (type !== null) {
                if (String(type.getName()) === "android.widget.EditText") {
                    return true;
                }
                type = type.getSuperclass();
            }
        } catch (ignored) {}
        return false;
    }

    function createImeController(windowOptions) {
        var rootView = windowOptions.rootView;
        var params = windowOptions.layoutParams;
        var manager = windowOptions.windowManager;
        var context = rootView.getContext();
        var appContext = context.getApplicationContext() || context;
        var handler = new Handler(Looper.getMainLooper());
        var inputMethodManager = appContext.getSystemService(
            Context.INPUT_METHOD_SERVICE);
        var density = Number(appContext.getResources()
            .getDisplayMetrics().density || 1);
        var touchSlop = Number(ViewConfiguration.get(appContext)
            .getScaledTouchSlop());
        var state = {
            started: false,
            stopped: false,
            generation: 0,
            runnable: null,
            observer: null,
            listener: null,
            restore: null,
            applied: false,
            applyCount: 0,
            restoreCount: 0,
            staleSignalIgnoredCount: 0,
            updateCount: 0,
            lastSource: "none",
            lastInsetPx: 0,
            lastError: null
        };

        function displayMetrics() {
            var metrics = new Packages.android.util.DisplayMetrics();
            try {
                manager.getDefaultDisplay().getRealMetrics(metrics);
            } catch (ignoredManager) {
                metrics = appContext.getResources().getDisplayMetrics();
            }
            return metrics;
        }

        function thresholdPx(metrics) {
            var screenHeight = Math.max(1, Number(metrics.heightPixels || 1));
            var lower = Math.max(touchSlop * 6,
                Math.round(screenHeight * 0.055));
            var upper = Math.max(lower,
                Math.round(screenHeight * 0.22));
            return Math.round(clampNumber(screenHeight * 0.12,
                lower, upper));
        }

        function inputMethodHeightPx() {
            var height = 0;
            if (inputMethodManager === null) { return 0; }
            try {
                height = Number(inputMethodManager
                    .getInputMethodWindowVisibleHeight());
            } catch (ignored) {
                height = 0;
            }
            return isFinite(height) && height > 0 ? height : 0;
        }

        function readImeState() {
            var metrics = displayMetrics();
            var threshold = thresholdPx(metrics);
            var output = {
                visible: false,
                bottomPx: 0,
                topInsetPx: 0,
                source: "none",
                screenWidthPx: Number(metrics.widthPixels),
                screenHeightPx: Number(metrics.heightPixels)
            };
            var insets;
            var imeMask;
            var systemMask;
            var imeInsets;
            var systemInsets;
            var rootAvailable = false;
            var rootVisible = false;
            var rootBottom = 0;
            var frame = new Rect();
            var frameAvailable = false;
            var frameGap = 0;
            var frameVisible = false;
            var immHeight = 0;

            if (Build.VERSION.SDK_INT >= 30) {
                try {
                    insets = rootView.getRootWindowInsets();
                    if (insets !== null) {
                        imeMask = WindowInsets.Type.ime();
                        systemMask = WindowInsets.Type.systemBars();
                        imeInsets = insets.getInsets(imeMask);
                        systemInsets = insets.getInsets(systemMask);
                        rootAvailable = true;
                        rootBottom = Math.max(0,
                            Number(imeInsets.bottom));
                        rootVisible = insets.isVisible(imeMask) === true ||
                            rootBottom >= threshold;
                        output.topInsetPx = Math.max(0,
                            Number(systemInsets.top));
                    }
                } catch (ignoredInsets) {}
            }

            try {
                rootView.getWindowVisibleDisplayFrame(frame);
                frameAvailable = true;
                frameGap = Math.max(0,
                    Number(metrics.heightPixels) - Number(frame.bottom));
                frameVisible = frameGap >= threshold;
                output.topInsetPx = Math.max(output.topInsetPx,
                    Number(frame.top));
            } catch (ignoredFrame) {}

            immHeight = inputMethodHeightPx();
            if (rootVisible) {
                output.visible = true;
                output.bottomPx = Math.max(rootBottom,
                    frameVisible ? frameGap : 0,
                    immHeight >= threshold ? immHeight : 0);
                output.source = "root_window_insets";
            } else if (frameVisible) {
                output.visible = true;
                output.bottomPx = Math.max(frameGap,
                    immHeight >= threshold ? immHeight : 0);
                output.source = "visible_display_frame";
            } else if (!rootAvailable && !frameAvailable &&
                    immHeight >= threshold) {
                output.visible = true;
                output.bottomPx = immHeight;
                output.source = "input_method_visible_height";
            } else {
                output.visible = false;
                output.bottomPx = 0;
                output.source = rootAvailable ?
                    "root_window_insets_hidden" :
                    (frameAvailable ?
                        "visible_display_frame_hidden" : "none");
                if (immHeight >= threshold) {
                    state.staleSignalIgnoredCount += 1;
                }
            }
            return output;
        }

        function updateLayout(target) {
            if (sameLayout(params, target)) { return false; }
            params.width = Number(target.width);
            params.height = Number(target.height);
            params.gravity = Number(target.gravity);
            params.x = Number(target.x);
            params.y = Number(target.y);
            try {
                if (rootView.isAttachedToWindow()) {
                    manager.updateViewLayout(rootView, params);
                    state.updateCount += 1;
                }
                return true;
            } catch (error) {
                state.lastError = String(error);
                return false;
            }
        }

        function restoreLayout() {
            var target = state.restore;
            if (target === null) {
                state.applied = false;
                return false;
            }
            updateLayout(target);
            state.restore = null;
            if (state.applied) { state.restoreCount += 1; }
            state.applied = false;
            return true;
        }

        function applyImeLayout(ime) {
            var focused = hasFocusedEditText(rootView);
            var keyboardActive = ime.visible === true && focused;
            var screenHeight = Math.max(1, Number(ime.screenHeightPx));
            var screenWidth = Math.max(1, Number(ime.screenWidthPx));
            var adaptiveGap = Math.max(touchSlop,
                Math.round(Math.min(screenWidth, screenHeight) * 0.008));
            var keyboardTop;
            var topSafe;
            var available;
            var minimumHeight;
            var target;

            state.lastSource = String(ime.source || "none");
            state.lastInsetPx = Number(ime.bottomPx || 0);

            if (!keyboardActive) {
                if (state.applied) { restoreLayout(); }
                return false;
            }
            if (!state.applied || state.restore === null) {
                state.restore = copyLayout(params);
            }
            keyboardTop = Math.max(0,
                screenHeight - Number(ime.bottomPx));
            topSafe = Math.max(0, Number(ime.topInsetPx || 0));
            minimumHeight = Math.max(touchSlop * 18,
                Math.round(screenHeight * 0.22));
            available = Math.max(minimumHeight,
                keyboardTop - topSafe - adaptiveGap * 2);
            target = {
                width: Number(state.restore.width),
                height: Math.min(Number(state.restore.height), available),
                gravity: Number(Gravity.TOP | Gravity.START),
                x: Number(state.restore.x),
                y: Math.max(topSafe + adaptiveGap,
                    keyboardTop - adaptiveGap -
                    Math.min(Number(state.restore.height), available))
            };
            updateLayout(target);
            if (!state.applied) { state.applyCount += 1; }
            state.applied = true;
            return true;
        }

        function poll(generation) {
            var ime;
            var active;
            if (state.stopped || generation !== state.generation ||
                    rootView === null) {
                return false;
            }
            try {
                if (!rootView.isAttachedToWindow()) {
                    stop(false);
                    return false;
                }
                ime = readImeState();
                applyImeLayout(ime);
                active = state.applied || hasFocusedEditText(rootView) ||
                    ime.visible === true;
                handler.postDelayed(state.runnable, active ? 90 : 420);
                return true;
            } catch (error) {
                state.lastError = String(error);
                handler.postDelayed(state.runnable, 420);
                return false;
            }
        }

        function start() {
            var generation;
            var starter;
            if (state.started || state.stopped) { return false; }
            state.started = true;
            state.generation += 1;
            generation = state.generation;
            state.runnable = new Packages.java.lang.Runnable({
                run: function () { poll(generation); }
            });
            starter = new Packages.java.lang.Runnable({
                run: function () {
                    if (state.stopped || generation !== state.generation) {
                        return;
                    }
                    try {
                        state.observer = rootView.getViewTreeObserver();
                        state.listener = new JavaAdapter(
                            Packages.android.view.ViewTreeObserver
                                .OnGlobalLayoutListener, {
                                onGlobalLayout: function () {
                                    if (!state.stopped) {
                                        try {
                                            applyImeLayout(readImeState());
                                        } catch (error) {
                                            state.lastError = String(error);
                                        }
                                    }
                                }
                            });
                        state.observer.addOnGlobalLayoutListener(
                            state.listener);
                    } catch (error) {
                        state.lastError = String(error);
                        state.observer = null;
                        state.listener = null;
                    }
                    handler.post(state.runnable);
                }
            });
            return handler.post(starter) === true;
        }

        function stop(restoreBeforeStop) {
            if (state.stopped) { return true; }
            state.stopped = true;
            state.generation += 1;
            if (handler !== null && state.runnable !== null) {
                try { handler.removeCallbacks(state.runnable); }
                catch (ignoredRunnable) {}
            }
            if (state.observer !== null && state.listener !== null) {
                try {
                    if (Build.VERSION.SDK_INT >= 16) {
                        state.observer.removeOnGlobalLayoutListener(
                            state.listener);
                    } else {
                        state.observer.removeGlobalOnLayoutListener(
                            state.listener);
                    }
                } catch (ignoredObserver) {}
            }
            if (restoreBeforeStop === true && state.applied) {
                restoreLayout();
            }
            state.runnable = null;
            state.observer = null;
            state.listener = null;
            return true;
        }

        return {
            start: start,
            stop: stop,
            getState: function () {
                return {
                    started: state.started === true,
                    stopped: state.stopped === true,
                    applied: state.applied === true,
                    applyCount: Number(state.applyCount),
                    restoreCount: Number(state.restoreCount),
                    staleSignalIgnoredCount:
                        Number(state.staleSignalIgnoredCount),
                    updateCount: Number(state.updateCount),
                    lastSource: state.lastSource,
                    lastInsetPx: Number(state.lastInsetPx),
                    lastError: state.lastError
                };
            }
        };
    }

    function stopActiveImeController(restoreBeforeStop) {
        if (activeImeController !== null) {
            try { activeImeController.stop(restoreBeforeStop === true); }
            catch (ignored) {}
        }
        activeImeController = null;
        return true;
    }

    function startImeController(windowOptions) {
        if (!windowOptions || !isFilterRole(windowOptions.role) ||
                !windowOptions.rootView || !windowOptions.layoutParams ||
                !windowOptions.windowManager) {
            return false;
        }
        stopActiveImeController(false);
        activeImeController = createImeController(windowOptions);
        activeImeController.start();
        return true;
    }

    function installRuntimeGuards(compactMode) {
        var filter = ClipHub.Filter;
        var originalShowRoot = filter.showRoot;
        var originalShowPanel = filter.showPanel;
        var originalClosePanel = filter.closePanel;

        function guard(original, receiver, args, label) {
            var windowApi = ClipHub.Window;
            var originalAttach = windowApi &&
                typeof windowApi.attachWindow === "function" ?
                windowApi.attachWindow : null;
            var capturedOptions = null;
            var result;

            if (compactMode) {
                writeMarker(pendingFile, label + " " +
                    Number(System.currentTimeMillis()));
            }
            if (originalAttach !== null) {
                windowApi.attachWindow = function (attachOptions) {
                    var attachResult = originalAttach.apply(
                        windowApi, arguments);
                    if (attachOptions &&
                            isFilterRole(attachOptions.role)) {
                        capturedOptions = attachOptions;
                    }
                    return attachResult;
                };
            }
            try {
                result = original.apply(receiver, args);
                if (capturedOptions !== null) {
                    startImeController(capturedOptions);
                }
                if (compactMode) {
                    deleteQuietly(pendingFile);
                    deleteQuietly(failureFile);
                }
                return result;
            } catch (error) {
                stopActiveImeController(false);
                if (compactMode) {
                    writeMarker(failureFile,
                        label + ": " + errorText(error));
                    writeMarker(disabledFile,
                        "disabled after failed " + label + " at " +
                        Number(System.currentTimeMillis()));
                }
                throw error;
            } finally {
                if (originalAttach !== null) {
                    windowApi.attachWindow = originalAttach;
                }
            }
        }

        filter.showRoot = function (showOptions) {
            return guard(originalShowRoot, filter, arguments, "showRoot");
        };
        filter.showPanel = function (showOptions) {
            return guard(originalShowPanel, filter, arguments, "showPanel");
        };
        filter.closePanel = function (closeOptions) {
            stopActiveImeController(false);
            return originalClosePanel.apply(filter, arguments);
        };
        filter.getImeAvoidanceState = function () {
            return activeImeController === null ? {
                started: false,
                stopped: true,
                applied: false,
                applyCount: 0,
                restoreCount: 0,
                staleSignalIgnoredCount: 0,
                updateCount: 0,
                lastSource: "none",
                lastInsetPx: 0,
                lastError: null
            } : activeImeController.getState();
        };
        filter.FILTER_IME_AVOIDANCE = CACHE_VERSION;
        filter.COMPACT_RECOVERY_GUARD = CACHE_VERSION;
    }

    function loadStable(reason) {
        var source = ensureStableSource();
        deleteQuietly(pendingFile);
        executeSource(source);
        installRuntimeGuards(false);
        ClipHub.Filter.COMPACT_RECOVERY_MODE = "stable_fallback";
        ClipHub.Filter.COMPACT_RECOVERY_REASON = String(reason || "fallback");
        return ClipHub.Filter;
    }

    ensureDir(cacheDir);
    ensureStableSource();

    if (pendingFile.isFile()) {
        markCompactFailure("previous compact show did not complete");
    }

    if (disabledFile.isFile()) {
        loadStable("disabled_marker");
        return;
    }

    try {
        executeSource(ensureCompactSource());
        installRuntimeGuards(true);
        ClipHub.Filter.COMPACT_RECOVERY_MODE = "compact_guarded";
    } catch (error) {
        markCompactFailure(error);
        loadStable(errorText(error));
    }
}((function () { return this; }())));
