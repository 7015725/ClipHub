/*
 * ShortX 任务名称：ClipHub 分页阶段10完整系统回归
 * 分支：agent/add-pagination-lazy-prefetch-20260807
 * Rhino ES5。使用隔离运行目录，包含真实手势分步验证。
 */
var ClipHubPaginationStage10TestResult = (function (global) {
    var URL = Packages.java.net.URL;
    var URLEncoder = Packages.java.net.URLEncoder;
    var BAOS = Packages.java.io.ByteArrayOutputStream;
    var ReflectArray = Packages.java.lang.reflect.Array;
    var JavaByte = Packages.java.lang.Byte;
    var JavaString = Packages.java.lang.String;
    var System = Packages.java.lang.System;
    var Thread = Packages.java.lang.Thread;
    var File = Packages.java.io.File;
    var RAF = Packages.java.io.RandomAccessFile;
    var Context = Packages.android.content.Context;
    var WindowManager = Packages.android.view.WindowManager;
    var Gravity = Packages.android.view.Gravity;
    var PixelFormat = Packages.android.graphics.PixelFormat;
    var Color = Packages.android.graphics.Color;
    var TextView = Packages.android.widget.TextView;
    var GradientDrawable = Packages.android.graphics.drawable.GradientDrawable;
    var Handler = Packages.android.os.Handler;
    var Looper = Packages.android.os.Looper;
    var CountDownLatch = Packages.java.util.concurrent.CountDownLatch;
    var TimeUnit = Packages.java.util.concurrent.TimeUnit;
    var AtomicReference = Packages.java.util.concurrent.atomic.AtomicReference;

    var REF = "agent/add-pagination-lazy-prefetch-20260807";
    var RUNTIME_NAME = "ClipHubPaginationStage10SystemRegression";
    var EXPECTED_MODULE_SET_VERSION = "20260807.13";
    var TEST_ENTRY_VERSION = 4;
    var FILTER_MODULE_VERSION = 48;
    var PAGINATION_STAGE = 9;
    var WARM_LOOPS = 20;
    var RAPID_CLOSE_LOOPS = 20;
    var INTERACTION_TIMEOUT_MS = 35000;

    var instructionManager = null;
    var instructionView = null;
    var instructionParams = null;

    function now() {
        return Number(System.currentTimeMillis());
    }

    function closeQuietly(value) {
        if (value !== null && value !== undefined) {
            try { value.close(); } catch (ignored) {}
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

    function fetchEntry() {
        var url = "https://raw.githubusercontent.com/7015725/ClipHub/" +
            String(URLEncoder.encode(REF, "UTF-8"))
                .replace(/\+/g, "%20") +
            "/ClipHub.js?stage10=" + now();
        var connection = null;
        var code;
        var bytes;
        var text;
        try {
            connection = new URL(url).openConnection();
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(30000);
            connection.setUseCaches(false);
            connection.setRequestProperty("Accept-Encoding", "identity");
            connection.setRequestProperty("Cache-Control", "no-cache");
            connection.setRequestProperty("Pragma", "no-cache");
            connection.setRequestProperty("User-Agent",
                "ClipHub-Pagination-Stage10-Test/1");
            code = Number(connection.getResponseCode());
            bytes = readBytes(code >= 200 && code < 300 ?
                connection.getInputStream() : connection.getErrorStream());
            text = String(new JavaString(bytes, "UTF-8"));
            if (code < 200 || code >= 300) {
                throw new Error("Entry HTTP " + code + ": " +
                    text.substring(0, 400));
            }
            return text;
        } finally {
            if (connection !== null) {
                try { connection.disconnect(); } catch (ignored) {}
            }
        }
    }

    function removeTree(file) {
        var children;
        var index;
        var ok = true;
        if (file === null || !file.exists()) { return true; }
        if (file.isDirectory()) {
            children = file.listFiles();
            if (children !== null) {
                for (index = 0; index < children.length; index += 1) {
                    if (!removeTree(children[index])) { ok = false; }
                }
            }
        }
        if (file.exists() && !file.delete()) { ok = false; }
        return ok;
    }

    function lockFree(runtimeDir) {
        var dataDir = new File(runtimeDir, "data");
        var raf = null;
        var channel = null;
        var lock = null;
        if (!dataDir.exists() && !dataDir.mkdirs() &&
                !dataDir.isDirectory()) {
            return false;
        }
        try {
            raf = new RAF(new File(dataDir, "cliphub.lock"), "rw");
            channel = raf.getChannel();
            lock = channel.tryLock();
            return lock !== null;
        } catch (error) {
            if (String(error).indexOf("OverlappingFileLockException") >= 0) {
                return false;
            }
            return false;
        } finally {
            if (lock !== null) {
                try { lock.release(); } catch (ignoredLock) {}
            }
            closeQuietly(channel);
            closeQuietly(raf);
        }
    }

    function waitFor(label, predicate, timeoutMs) {
        var deadline = now() + Number(timeoutMs || 9000);
        var lastError = null;
        while (now() <= deadline) {
            try {
                if (predicate()) { return true; }
                lastError = null;
            } catch (error) {
                lastError = errorText(error);
            }
            Thread.sleep(40);
        }
        throw new Error(String(label) + " timeout" +
            (lastError === null ? "" : ": " + lastError));
    }

    function appStatus() {
        return global.ClipHub.App.getStatus();
    }

    function panelState() {
        return global.ClipHub.Filter.getPanelState();
    }

    function windowState() {
        return global.ClipHub.Window.getState();
    }

    function navigationState() {
        return global.ClipHub.Navigation.getState();
    }

    function recentsState() {
        return global.ClipHub.RecentsWatch.getState();
    }

    function eventState() {
        return global.ClipHub.EventBus.getState();
    }

    function showRoot(label) {
        var response = global.ClipHub.App.executeControlCommand("show");
        if (!response || response.ok !== true) {
            throw new Error(String(label) + " show failed: " +
                JSON.stringify(response));
        }
        waitFor(label + " attached", function () {
            var app = appStatus();
            var panel = panelState();
            return app.uiVisible === true && app.filterAttached === true &&
                panel.attached === true &&
                panel.attachedToWindow === true &&
                panel.contentReady === true;
        }, 12000);
        return {
            app: appStatus(),
            panel: compactPanel(panelState()),
            window: compactWindow(windowState())
        };
    }

    function hideRoot(label) {
        var response = global.ClipHub.App.executeControlCommand("hide");
        if (!response || response.ok !== true) {
            throw new Error(String(label) + " hide failed: " +
                JSON.stringify(response));
        }
        waitFor(label + " detached", function () {
            return appStatus().uiVisible === false &&
                panelState().attached === false;
        }, 7000);
        return response;
    }

    function compactPanel(value) {
        value = value || {};
        return {
            attached: value.attached === true,
            attachedToWindow: value.attachedToWindow === true,
            contentReady: value.contentReady === true,
            panelBuilt: value.panelBuilt === true,
            lastShowReused: value.lastShowReused === true,
            panelCacheReuseCount: Number(value.panelCacheReuseCount || 0),
            panelCacheBuildCount: Number(value.panelCacheBuildCount || 0),
            panelCacheDestroyCount: Number(value.panelCacheDestroyCount || 0),
            searchExpanded: value.searchExpanded === true,
            inputFocused: value.inputFocused === true,
            panelOpenCount: Number(value.panelOpenCount || 0),
            panelCloseCount: Number(value.panelCloseCount || 0),
            panelAddThreadName: value.panelAddThreadName,
            panelRemoveThreadName: value.panelRemoveThreadName,
            performance: value.performance || null,
            lastError: value.lastError
        };
    }

    function compactWindow(value) {
        value = value || {};
        return {
            attached: value.attached === true,
            primaryAttached: value.primaryAttached === true,
            moving: value.moving === true,
            resizing: value.resizing === true,
            geometry: value.geometry || null,
            safeBounds: value.safeBounds || null,
            orientation: value.orientation,
            dragMoveCount: Number(value.dragMoveCount || 0),
            resizeMoveCount: Number(value.resizeMoveCount || 0),
            resizeCommitCount: Number(value.resizeCommitCount || 0),
            boundsRefreshCount: Number(value.boundsRefreshCount || 0),
            configurationChangeCount:
                Number(value.configurationChangeCount || 0),
            displayChangeCount: Number(value.displayChangeCount || 0),
            outsideTapCount: Number(value.outsideTapCount || 0),
            outsideDismissCount: Number(value.outsideDismissCount || 0),
            componentCallbacksRegistered:
                value.componentCallbacksRegistered === true,
            displayListenerRegistered:
                value.displayListenerRegistered === true,
            lastError: value.lastError
        };
    }

    function compactNavigation(value) {
        value = value || {};
        return {
            registeredRootCount: Number(value.registeredRootCount || 0),
            callbackMode: value.callbackMode,
            backInvokedCount: Number(value.backInvokedCount || 0),
            backHandledCount: Number(value.backHandledCount || 0),
            duplicateBackCount: Number(value.duplicateBackCount || 0),
            uiHideCount: Number(value.uiHideCount || 0),
            lastBackOwner: value.lastBackOwner,
            lastBackReason: value.lastBackReason,
            lastHideReason: value.lastHideReason,
            lastError: value.lastError
        };
    }

    function compactRecents(value) {
        value = value || {};
        return {
            running: value.running === true,
            sampleCount: Number(value.sampleCount || 0),
            signalCount: Number(value.signalCount || 0),
            confirmedSignalCount:
                Number(value.confirmedSignalCount || 0),
            hideCount: Number(value.hideCount || 0),
            baselinePackage: value.baselinePackage,
            baselineActivityType: Number(value.baselineActivityType || 0),
            lastPackage: value.lastPackage,
            lastActivityType: Number(value.lastActivityType || 0),
            lastSignalReason: value.lastSignalReason,
            lastHideReason: value.lastHideReason,
            lastError: value.lastError
        };
    }

    function compactEvent(value) {
        value = value || {};
        return {
            outsideDownCount: Number(value.outsideDownCount || 0),
            outsideTapCount: Number(value.outsideTapCount || 0),
            outsideCancelCount: Number(value.outsideCancelCount || 0),
            gestureEdgePassCount: Number(value.gestureEdgePassCount || 0),
            lastOutsideRole: value.lastOutsideRole,
            lastError: value.lastError
        };
    }

    function geometryChanged(before, after) {
        before = before || {};
        after = after || {};
        return Number(before.x || 0) !== Number(after.x || 0) ||
            Number(before.y || 0) !== Number(after.y || 0) ||
            Number(before.width || 0) !== Number(after.width || 0) ||
            Number(before.height || 0) !== Number(after.height || 0);
    }

    function geometryInside(value) {
        var geometry = value && value.geometry ? value.geometry : {};
        var bounds = value && value.safeBounds ? value.safeBounds : {};
        var width = Number(geometry.width || 0);
        var height = Number(geometry.height || 0);
        var x = Number(geometry.x || 0);
        var y = Number(geometry.y || 0);
        var left = Number(bounds.left || 0);
        var top = Number(bounds.top || 0);
        var right = Number(bounds.right || 0);
        var bottom = Number(bounds.bottom || 0);
        return width > 0 && height > 0 && right > left && bottom > top &&
            x >= left - 2 && y >= top - 2 &&
            x + width <= right + 2 && y + height <= bottom + 2;
    }

    function dp(value) {
        var density = Number(global.context.getResources()
            .getDisplayMetrics().density || 1);
        return Math.max(1, Math.floor(Number(value) * density + 0.5));
    }

    function runOnAndroidMain(callback, timeoutMs) {
        var handler;
        var latch;
        var valueRef;
        var errorRef;
        var posted;
        if (Number(Looper.getMainLooper().getThread().getId()) ===
                Number(Thread.currentThread().getId())) {
            return callback();
        }
        handler = new Handler(Looper.getMainLooper());
        latch = new CountDownLatch(1);
        valueRef = new AtomicReference();
        errorRef = new AtomicReference();
        posted = handler.post(new Packages.java.lang.Runnable({
            run: function () {
                try { valueRef.set(callback()); }
                catch (error) { errorRef.set(error); }
                finally { latch.countDown(); }
            }
        }));
        if (!posted || !latch.await(Number(timeoutMs || 3000),
                TimeUnit.MILLISECONDS)) {
            throw new Error("Stage 10 main callback timeout");
        }
        if (errorRef.get() !== null) { throw errorRef.get(); }
        return valueRef.get();
    }

    function createInstruction() {
        runOnAndroidMain(function () {
            var appContext;
            var background;
            if (instructionView !== null) { return true; }
            appContext = global.context.getApplicationContext();
            if (appContext === null) { appContext = global.context; }
            instructionManager = appContext.getSystemService(
                Context.WINDOW_SERVICE);
            if (instructionManager === null) {
                throw new Error("Instruction WindowManager unavailable");
            }
            instructionView = new TextView(global.context);
            instructionView.setTextColor(Color.WHITE);
            instructionView.setTextSize(14);
            instructionView.setGravity(Gravity.CENTER);
            instructionView.setPadding(dp(12), dp(8), dp(12), dp(8));
            background = new GradientDrawable();
            background.setColor(Color.argb(224, 28, 32, 40));
            background.setCornerRadius(dp(12));
            instructionView.setBackground(background);
            instructionParams = new WindowManager.LayoutParams();
            instructionParams.width = WindowManager.LayoutParams.MATCH_PARENT;
            instructionParams.height = WindowManager.LayoutParams.WRAP_CONTENT;
            instructionParams.type = WindowManager.LayoutParams
                .TYPE_APPLICATION_OVERLAY;
            instructionParams.flags =
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE |
                WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE |
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN;
            instructionParams.format = PixelFormat.TRANSLUCENT;
            instructionParams.gravity = Gravity.TOP |
                Gravity.CENTER_HORIZONTAL;
            instructionParams.x = 0;
            instructionParams.y = dp(18);
            instructionParams.setTitle("Stage10Status");
            instructionManager.addView(instructionView, instructionParams);
            return true;
        }, 3000);
    }

    function setInstruction(text) {
        if (instructionView === null) { createInstruction(); }
        runOnAndroidMain(function () {
            if (instructionView !== null) {
                instructionView.setText(String(text));
            }
            return true;
        }, 3000);
    }

    function removeInstruction() {
        var manager = instructionManager;
        var view = instructionView;
        instructionManager = null;
        instructionView = null;
        instructionParams = null;
        if (manager === null || view === null) { return true; }
        try {
            runOnAndroidMain(function () {
                try {
                    if (view.isAttachedToWindow()) {
                        manager.removeViewImmediate(view);
                    }
                } catch (ignored) {}
                return true;
            }, 3000);
        } catch (ignoredRun) {}
        return true;
    }

    function insertRows(database, prefix, ids) {
        var index;
        var timestamp = now() - 100000;
        database.transaction(function () {
            for (index = 0; index < 40; index += 1) {
                ids.push(Number(database.executeInsert(
                    "INSERT INTO clipboard_items(" +
                    "content, normalized_hash, content_type, " +
                    "source_package, source_label, source_uid, " +
                    "source_confidence, is_pinned, manual_order, " +
                    "copy_count, created_at, last_copied_at, " +
                    "updated_at, deleted_at, is_sensitive) VALUES (" +
                    "?, ?, 'text', ?, ?, 0, 100, 0, 0, 1, " +
                    "?, ?, ?, NULL, 0)", [
                        prefix + " 系统回归记录 " + String(index) +
                            "，用于窗口、输入法、返回与生命周期验证。",
                        prefix + "-hash-" + String(index),
                        "cliphub.stage10.test",
                        "Stage10 Test",
                        timestamp + index,
                        timestamp + index,
                        timestamp + index
                    ])));
            }
        });
    }

    function deleteRows(database, ids) {
        var placeholders = [];
        var index;
        if (!database || !ids || ids.length === 0) { return 0; }
        for (index = 0; index < ids.length; index += 1) {
            placeholders.push("?");
        }
        return database.executeUpdateDelete(
            "DELETE FROM clipboard_items WHERE id IN (" +
                placeholders.join(",") + ")", ids);
    }

    function runWarmStarts() {
        var output = {
            expected: WARM_LOOPS,
            completed: 0,
            reusedCount: 0,
            attachMainCount: 0,
            errors: [],
            lastPanel: null,
            ok: false
        };
        var index;
        var panel;
        showRoot("warm baseline");
        hideRoot("warm baseline");
        for (index = 0; index < WARM_LOOPS; index += 1) {
            try {
                showRoot("warm " + String(index + 1));
                panel = panelState();
                if (panel.lastShowReused === true) {
                    output.reusedCount += 1;
                }
                if (String(panel.panelAddThreadName || "") === "main") {
                    output.attachMainCount += 1;
                }
                hideRoot("warm " + String(index + 1));
                output.completed += 1;
                Thread.sleep(70);
            } catch (error) {
                output.errors.push(errorText(error));
                break;
            }
        }
        output.lastPanel = compactPanel(panelState());
        output.ok = output.completed === WARM_LOOPS &&
            output.reusedCount >= WARM_LOOPS - 1 &&
            output.attachMainCount === WARM_LOOPS &&
            output.lastPanel.lastError === null &&
            output.errors.length === 0;
        return output;
    }

    function runRapidClose() {
        var output = {
            expected: RAPID_CLOSE_LOOPS,
            completed: 0,
            attachedAfterDelayCount: 0,
            commandFailureCount: 0,
            errors: [],
            finalApp: null,
            finalPanel: null,
            finalWindow: null,
            ok: false
        };
        var index;
        var shown;
        var hidden;
        for (index = 0; index < RAPID_CLOSE_LOOPS; index += 1) {
            try {
                shown = global.ClipHub.App.executeControlCommand("show");
                hidden = global.ClipHub.App.executeControlCommand("hide");
                if (!shown || shown.ok !== true ||
                        !hidden || hidden.ok !== true) {
                    output.commandFailureCount += 1;
                    break;
                }
                Thread.sleep(220);
                if (appStatus().uiVisible === true ||
                        panelState().attached === true ||
                        windowState().primaryAttached === true) {
                    output.attachedAfterDelayCount += 1;
                }
                output.completed += 1;
            } catch (error) {
                output.errors.push(errorText(error));
                break;
            }
        }
        output.finalApp = appStatus();
        output.finalPanel = compactPanel(panelState());
        output.finalWindow = compactWindow(windowState());
        output.ok = output.completed === RAPID_CLOSE_LOOPS &&
            output.commandFailureCount === 0 &&
            output.attachedAfterDelayCount === 0 &&
            output.finalApp.uiVisible === false &&
            output.finalPanel.attached === false &&
            output.finalWindow.primaryAttached === false &&
            output.errors.length === 0;
        return output;
    }

    function runNormalRestore() {
        var filter = global.ClipHub.Filter;
        var ids;
        var anchorId;
        var beforeAnchor;
        var afterAnchor;
        var shown = showRoot("normal restore first");
        ids = filter.getLoadedResultIds();
        anchorId = Number(ids[Math.min(20, ids.length - 1)]);
        filter.performScrollToItemId(anchorId, 0,
            "stage10_normal_hide_anchor");
        waitFor("normal hide anchor", function () {
            var virtual = filter.getVirtualState();
            return Number(virtual.anchorItemId) === anchorId &&
                Number(filter.getResultScrollY()) > 0;
        }, 7000);
        beforeAnchor = {
            itemId: anchorId,
            scrollY: Number(filter.getResultScrollY()),
            virtual: filter.getVirtualState()
        };
        var before = compactPanel(panelState());
        var hidden = hideRoot("normal restore hide");
        var restored = showRoot("normal restore second");
        waitFor("normal restore anchor", function () {
            var virtual = filter.getVirtualState();
            return Number(virtual.anchorItemId) === anchorId &&
                Math.abs(Number(virtual.anchorRestoreErrorPx || 0)) <= 32;
        }, 7000);
        afterAnchor = {
            itemId: Number(filter.getVirtualState().anchorItemId),
            scrollY: Number(filter.getResultScrollY()),
            virtual: filter.getVirtualState()
        };
        var after = compactPanel(panelState());
        return {
            first: shown,
            before: before,
            hidden: hidden && hidden.ok === true,
            restored: restored,
            after: after,
            anchorBefore: beforeAnchor,
            anchorAfter: afterAnchor,
            ok: before.panelBuilt === true &&
                after.attached === true &&
                after.contentReady === true &&
                after.lastShowReused === true &&
                after.panelCacheBuildCount === before.panelCacheBuildCount &&
                after.panelCacheReuseCount > before.panelCacheReuseCount &&
                Number(afterAnchor.itemId) === anchorId &&
                Math.abs(Number(afterAnchor.virtual
                    .anchorRestoreErrorPx || 0)) <= 32 &&
                after.lastError === null
        };
    }

    function runIme() {
        var filter = global.ClipHub.Filter;
        var opened;
        var active;
        var closed;
        setInstruction("Stage 10 · 正在自动验证输入法避让，请不要操作");
        opened = String(runOnAndroidMain(function () {
            return filter.performSearchToggleClick();
        }, 3000)) === "true";
        waitFor("IME visible", function () {
            var panel = panelState();
            var ime = filter.getImeAvoidanceState();
            return panel.searchExpanded === true &&
                panel.inputFocused === true &&
                ime.started === true && ime.applied === true &&
                Number(ime.lastInsetPx || 0) > 0;
        }, 9000);
        active = {
            panel: compactPanel(panelState()),
            ime: filter.getImeAvoidanceState()
        };
        runOnAndroidMain(function () {
            return filter.handleBack();
        }, 3000);
        waitFor("IME restored", function () {
            var panel = panelState();
            var ime = filter.getImeAvoidanceState();
            return panel.searchExpanded === false &&
                panel.inputFocused === false && ime.applied === false;
        }, 7000);
        closed = {
            panel: compactPanel(panelState()),
            ime: filter.getImeAvoidanceState()
        };
        return {
            toggleWorked: opened === true,
            active: active,
            closed: closed,
            ok: opened === true && active.ime.lastError === null &&
                closed.ime.applied === false &&
                closed.ime.lastError === null
        };
    }

    function runSystemBack() {
        var before;
        var after;
        showRoot("system back");
        before = navigationState();
        setInstruction("Stage 10 · 请在 35 秒内执行一次系统侧滑返回\n首页浮窗应关闭");
        waitFor("real system back", function () {
            var app = appStatus();
            var nav = navigationState();
            return app.uiVisible === false &&
                Number(nav.backInvokedCount) >
                    Number(before.backInvokedCount) &&
                Number(nav.backHandledCount) >
                    Number(before.backHandledCount);
        }, INTERACTION_TIMEOUT_MS);
        after = navigationState();
        return {
            before: compactNavigation(before),
            after: compactNavigation(after),
            ok: Number(after.backInvokedCount) >
                    Number(before.backInvokedCount) &&
                Number(after.backHandledCount) >
                    Number(before.backHandledCount) &&
                Number(after.registeredRootCount) === 0 &&
                appStatus().uiVisible === false &&
                after.lastError === null
        };
    }

    function runOutsideTap() {
        var beforeEvent;
        var beforeWindow;
        var afterEvent;
        var afterWindow;
        showRoot("outside tap");
        beforeEvent = eventState();
        beforeWindow = windowState();
        setInstruction("Stage 10 · 请点击浮窗外部的深色区域\n不要点击右上角关闭按钮");
        waitFor("real outside tap", function () {
            var event = eventState();
            var win = windowState();
            return appStatus().uiVisible === false &&
                (Number(event.outsideTapCount) >
                    Number(beforeEvent.outsideTapCount) ||
                Number(win.outsideDismissCount) >
                    Number(beforeWindow.outsideDismissCount));
        }, INTERACTION_TIMEOUT_MS);
        afterEvent = eventState();
        afterWindow = windowState();
        return {
            beforeEvent: compactEvent(beforeEvent),
            afterEvent: compactEvent(afterEvent),
            beforeWindow: compactWindow(beforeWindow),
            afterWindow: compactWindow(afterWindow),
            ok: appStatus().uiVisible === false &&
                Number(afterEvent.outsideTapCount) >
                    Number(beforeEvent.outsideTapCount) &&
                Number(afterWindow.outsideDismissCount) >
                    Number(beforeWindow.outsideDismissCount) &&
                afterEvent.lastError === null &&
                afterWindow.lastError === null
        };
    }

    function runDrag() {
        var before;
        var after;
        showRoot("drag");
        before = windowState();
        setInstruction("Stage 10 · 请长按浮窗顶部拖动条并移动窗口\n移动明显距离后松手");
        waitFor("real window drag", function () {
            var current = windowState();
            return Number(current.dragMoveCount) >
                    Number(before.dragMoveCount) &&
                geometryChanged(before.geometry, current.geometry);
        }, INTERACTION_TIMEOUT_MS);
        waitFor("drag release", function () {
            return windowState().moving === false;
        }, 5000);
        after = windowState();
        return {
            before: compactWindow(before),
            after: compactWindow(after),
            insideBounds: geometryInside(after),
            ok: Number(after.dragMoveCount) >
                    Number(before.dragMoveCount) &&
                geometryChanged(before.geometry, after.geometry) &&
                after.moving === false && geometryInside(after) &&
                after.lastError === null
        };
    }

    function runResize() {
        var before = windowState();
        var after;
        setInstruction("Stage 10 · 请长按浮窗右下角缩放手柄并拖动\n尺寸明显变化后松手");
        waitFor("real window resize", function () {
            var current = windowState();
            return Number(current.resizeMoveCount) >
                    Number(before.resizeMoveCount) &&
                geometryChanged(before.geometry, current.geometry);
        }, INTERACTION_TIMEOUT_MS);
        waitFor("resize release", function () {
            var current = windowState();
            return current.resizing === false &&
                Number(current.resizeCommitCount) >
                    Number(before.resizeCommitCount);
        }, 6000);
        after = windowState();
        return {
            before: compactWindow(before),
            after: compactWindow(after),
            insideBounds: geometryInside(after),
            ok: Number(after.resizeMoveCount) >
                    Number(before.resizeMoveCount) &&
                Number(after.resizeCommitCount) >
                    Number(before.resizeCommitCount) &&
                geometryChanged(before.geometry, after.geometry) &&
                after.resizing === false && geometryInside(after) &&
                after.lastError === null
        };
    }

    function runOrientation() {
        var before = windowState();
        var changed;
        var restored;
        setInstruction("Stage 10 · 请旋转设备到另一方向\n保持自动旋转开启");
        waitFor("orientation changed", function () {
            var current = windowState();
            return String(current.orientation) !==
                    String(before.orientation) &&
                (Number(current.configurationChangeCount) >
                    Number(before.configurationChangeCount) ||
                Number(current.displayChangeCount) >
                    Number(before.displayChangeCount));
        }, INTERACTION_TIMEOUT_MS);
        changed = windowState();
        if (!geometryInside(changed)) {
            throw new Error("Rotated window is outside safe bounds");
        }
        setInstruction("Stage 10 · 已检测到旋转，请转回原方向");
        waitFor("orientation restored", function () {
            var current = windowState();
            return String(current.orientation) === String(before.orientation) &&
                Number(current.boundsRefreshCount) >
                    Number(changed.boundsRefreshCount);
        }, INTERACTION_TIMEOUT_MS);
        restored = windowState();
        return {
            before: compactWindow(before),
            changed: compactWindow(changed),
            restored: compactWindow(restored),
            changedInsideBounds: geometryInside(changed),
            restoredInsideBounds: geometryInside(restored),
            ok: String(changed.orientation) !== String(before.orientation) &&
                String(restored.orientation) === String(before.orientation) &&
                geometryInside(changed) && geometryInside(restored) &&
                restored.lastError === null
        };
    }

    function runHome() {
        var before;
        var after;
        showRoot("home");
        before = recentsState();
        setInstruction("Stage 10 · 请按一次 Home 键\n浮窗应在约 0.5 秒内关闭");
        waitFor("real home", function () {
            var current = recentsState();
            return appStatus().uiVisible === false &&
                Number(current.hideCount) > Number(before.hideCount);
        }, INTERACTION_TIMEOUT_MS);
        after = recentsState();
        return {
            before: compactRecents(before),
            after: compactRecents(after),
            navigation: compactNavigation(navigationState()),
            ok: Number(after.hideCount) > Number(before.hideCount) &&
                Number(after.confirmedSignalCount) >
                    Number(before.confirmedSignalCount) &&
                appStatus().uiVisible === false &&
                navigationState().registeredRootCount === 0 &&
                after.lastError === null
        };
    }

    function runRecents() {
        var before;
        var after;
        showRoot("recent tasks");
        before = recentsState();
        setInstruction("Stage 10 · 请从底部上拉进入最近任务\n进入后停留，浮窗应自动关闭");
        waitFor("real recent tasks", function () {
            var current = recentsState();
            return appStatus().uiVisible === false &&
                Number(current.hideCount) > Number(before.hideCount);
        }, INTERACTION_TIMEOUT_MS);
        after = recentsState();
        return {
            before: compactRecents(before),
            after: compactRecents(after),
            navigation: compactNavigation(navigationState()),
            ok: Number(after.hideCount) > Number(before.hideCount) &&
                Number(after.confirmedSignalCount) >
                    Number(before.confirmedSignalCount) &&
                appStatus().uiVisible === false &&
                navigationState().registeredRootCount === 0 &&
                after.lastError === null
        };
    }

    function run() {
        var previousOptions = global.ClipHubBootstrapOptions;
        var root = new File(String(shortx.getShortXDir()));
        var runtimeDir = new File(root, RUNTIME_NAME);
        var bootstrap = null;
        var database = null;
        var settings = null;
        var originalSettings = null;
        var insertedIds = [];
        var prefix = "ClipHubStage10System" + now();
        var result = {
            ok: false,
            project: "ClipHub",
            stage: "pagination_stage10_system_regression",
            testEntryVersion: TEST_ENTRY_VERSION,
            sourceRef: REF,
            moduleSetVersion: null,
            filterModuleVersion: null,
            paginationStage: null,
            manualInteractionsRequired: true,
            configuration: {
                warmLoops: WARM_LOOPS,
                rapidCloseLoops: RAPID_CLOSE_LOOPS,
                interactionTimeoutMs: INTERACTION_TIMEOUT_MS,
                runtimeName: RUNTIME_NAME
            },
            automatic: {},
            interactive: {},
            stop: null,
            cleanup: false,
            restoredOriginalSettings: false,
            lastCheckpoint: "initial",
            error: null
        };
        try {
            if (runtimeDir.exists() && !lockFree(runtimeDir)) {
                throw new Error(
                    "Previous Stage 10 isolated instance is still running");
            }
            removeTree(runtimeDir);
            global.ClipHubBootstrapOptions = {
                remoteRef: REF,
                runtimeName: RUNTIME_NAME
            };
            global.ClipHubBootstrapResult = null;
            eval(fetchEntry());
            bootstrap = global.ClipHubBootstrapResult || {};
            if (bootstrap.ok !== true || bootstrap.started !== true ||
                    String(bootstrap.sync &&
                        bootstrap.sync.moduleSetVersion || "") !==
                        EXPECTED_MODULE_SET_VERSION) {
                throw new Error("Stage 10 bootstrap mismatch: " +
                    JSON.stringify(bootstrap));
            }
            if (Number(global.ClipHub.Filter.MODULE_VERSION) !==
                    FILTER_MODULE_VERSION ||
                    Number(global.ClipHub.Filter.PAGINATION_STAGE) !==
                    PAGINATION_STAGE) {
                throw new Error("Stage 10 production identity mismatch");
            }
            database = global.ClipHub.Database;
            settings = global.ClipHub.Settings;
            originalSettings = settings.getPaginationSettings();
            settings.setMany({
                paginationMode: "ajax",
                paginationPageSize: 40,
                paginationPrefetchEnabled: true
            }, { cleanup: false });
            insertRows(database, prefix, insertedIds);
            global.ClipHub.Filter.setKeyword(prefix, {
                apply: false,
                origin: "stage10_fixture"
            });

            result.moduleSetVersion = String(
                bootstrap.sync.moduleSetVersion || "");
            result.filterModuleVersion = Number(
                global.ClipHub.Filter.MODULE_VERSION);
            result.paginationStage = Number(
                global.ClipHub.Filter.PAGINATION_STAGE);
            result.bootstrap = {
                ok: bootstrap.ok === true,
                started: bootstrap.started === true,
                downloadedCount: Number(bootstrap.sync &&
                    bootstrap.sync.downloadedCount || 0),
                moduleFileCount: Number(bootstrap.app &&
                    bootstrap.app.moduleFileCount || 0)
            };

            result.lastCheckpoint = "automatic_warm_starts";
            result.automatic.warmStarts = runWarmStarts();
            if (!result.automatic.warmStarts.ok) {
                throw new Error("20 warm starts failed");
            }
            result.lastCheckpoint = "automatic_rapid_close";
            result.automatic.rapidClose = runRapidClose();
            if (!result.automatic.rapidClose.ok) {
                throw new Error("20 rapid closes failed");
            }
            result.lastCheckpoint = "automatic_normal_hide_restore";
            result.automatic.normalHideRestore = runNormalRestore();
            if (!result.automatic.normalHideRestore.ok) {
                throw new Error("Normal hide/restore failed");
            }

            result.lastCheckpoint = "interactive_instruction_create";
            createInstruction();
            result.lastCheckpoint = "interactive_ime";
            result.interactive.ime = runIme();
            if (!result.interactive.ime.ok) {
                throw new Error("IME regression failed");
            }
            result.lastCheckpoint = "interactive_system_back";
            result.interactive.systemBack = runSystemBack();
            if (!result.interactive.systemBack.ok) {
                throw new Error("System back regression failed");
            }
            result.lastCheckpoint = "interactive_outside_tap";
            result.interactive.outsideTap = runOutsideTap();
            if (!result.interactive.outsideTap.ok) {
                throw new Error("Outside tap regression failed");
            }
            result.lastCheckpoint = "interactive_drag";
            result.interactive.drag = runDrag();
            if (!result.interactive.drag.ok) {
                throw new Error("Window drag regression failed");
            }
            result.lastCheckpoint = "interactive_resize";
            result.interactive.resize = runResize();
            if (!result.interactive.resize.ok) {
                throw new Error("Window resize regression failed");
            }
            result.lastCheckpoint = "interactive_orientation";
            result.interactive.orientation = runOrientation();
            if (!result.interactive.orientation.ok) {
                throw new Error("Orientation regression failed");
            }
            result.lastCheckpoint = "interactive_home";
            result.interactive.home = runHome();
            if (!result.interactive.home.ok) {
                throw new Error("Home regression failed");
            }
            result.lastCheckpoint = "interactive_recents";
            result.interactive.recents = runRecents();
            if (!result.interactive.recents.ok) {
                throw new Error("Recent tasks regression failed");
            }

            result.lastCheckpoint = "final_stop_cleanup";
            setInstruction("Stage 10 · 全部交互已完成，正在清理并停止后台");
            removeInstruction();
            deleteRows(database, insertedIds);
            insertedIds = [];
            settings.setMany({
                paginationMode: originalSettings.mode,
                paginationPageSize: originalSettings.pageSize,
                paginationPrefetchEnabled:
                    originalSettings.prefetchEnabled
            }, { cleanup: false });
            result.restoredOriginalSettings = true;
            result.stop = global.ClipHub.App.stop(
                "pagination_stage10_system_regression");
            Thread.sleep(450);
            result.stop.databaseClosed = !database.isOpen();
            result.stop.lockReleased = lockFree(runtimeDir);
            result.stop.uiVisibleAfterStop = appStatus().uiVisible === true;
            result.stop.ok = result.stop.stopped === true &&
                result.stop.databaseClosed === true &&
                result.stop.lockReleased === true &&
                result.stop.uiVisibleAfterStop === false;
            result.ok = result.automatic.warmStarts.ok === true &&
                result.automatic.rapidClose.ok === true &&
                result.automatic.normalHideRestore.ok === true &&
                result.interactive.ime.ok === true &&
                result.interactive.systemBack.ok === true &&
                result.interactive.outsideTap.ok === true &&
                result.interactive.drag.ok === true &&
                result.interactive.resize.ok === true &&
                result.interactive.orientation.ok === true &&
                result.interactive.home.ok === true &&
                result.interactive.recents.ok === true &&
                result.stop.ok === true &&
                result.restoredOriginalSettings === true;
            if (result.ok === true) {
                result.lastCheckpoint = "completed";
            }
        } catch (error) {
            result.error = errorText(error);
        } finally {
            removeInstruction();
            try {
                if (database && insertedIds.length > 0 &&
                        database.isOpen()) {
                    deleteRows(database, insertedIds);
                }
            } catch (ignoredDelete) {}
            try {
                if (settings && originalSettings && database &&
                        database.isOpen()) {
                    settings.setMany({
                        paginationMode: originalSettings.mode,
                        paginationPageSize: originalSettings.pageSize,
                        paginationPrefetchEnabled:
                            originalSettings.prefetchEnabled
                    }, { cleanup: false });
                    result.restoredOriginalSettings = true;
                }
            } catch (ignoredSettings) {}
            try {
                if (global.ClipHub && global.ClipHub.App &&
                        global.ClipHub.App.isStarted()) {
                    result.stop = global.ClipHub.App.stop(
                        "pagination_stage10_finally");
                    Thread.sleep(350);
                }
            } catch (ignoredStop) {}
            try {
                result.cleanup = lockFree(runtimeDir) &&
                    removeTree(runtimeDir);
            } catch (ignoredCleanup) {
                result.cleanup = false;
            }
            global.ClipHubBootstrapOptions = previousOptions;
        }
        if (result.ok === true && result.cleanup !== true) {
            result.ok = false;
            result.error = "Stage 10 runtime cleanup failed";
        }
        return result;
    }

    try {
        return JSON.stringify(run(), null, 2);
    } catch (error) {
        removeInstruction();
        return JSON.stringify({
            ok: false,
            project: "ClipHub",
            stage: "pagination_stage10_system_regression",
            testEntryVersion: TEST_ENTRY_VERSION,
            sourceRef: REF,
            lastCheckpoint: "outer_error",
            error: errorText(error)
        }, null, 2);
    }
}((function () { return this; }())));

String(ClipHubPaginationStage10TestResult);
