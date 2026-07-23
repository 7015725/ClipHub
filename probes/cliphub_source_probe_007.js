/* ClipHub source/sensitive clipboard probe 007. Rhino ES5 only. */
(function (global) {
    var File = Packages.java.io.File;
    var FIS = Packages.java.io.FileInputStream;
    var FOS = Packages.java.io.FileOutputStream;
    var ISR = Packages.java.io.InputStreamReader;
    var OSW = Packages.java.io.OutputStreamWriter;
    var BR = Packages.java.io.BufferedReader;
    var BW = Packages.java.io.BufferedWriter;
    var SB = Packages.java.lang.StringBuilder;
    var Thread = Packages.java.lang.Thread;
    var System = Packages.java.lang.System;
    var RAF = Packages.java.io.RandomAccessFile;
    var SDF = Packages.java.text.SimpleDateFormat;
    var Locale = Packages.java.util.Locale;
    var Context = Packages.android.content.Context;
    var Intent = Packages.android.content.Intent;
    var ClipData = Packages.android.content.ClipData;
    var PersistableBundle = Packages.android.os.PersistableBundle;
    var PackageManager = Packages.android.content.pm.PackageManager;
    var REQUIRED_SET = "20260721.7";
    var SENSITIVE_KEY = "android.content.extra.IS_SENSITIVE";
    var MODULES = [
        "ch_01_base.js", "ch_02_log.js", "ch_03_database.js",
        "ch_04_clipboard.js", "ch_05_classifier.js", "ch_06_repository.js",
        "ch_07_theme.js", "ch_08_window.js", "ch_09_list.js",
        "ch_10_editor.js", "ch_11_filter.js", "ch_12_translation.js",
        "ch_13_settings.js", "ch_14_event_bus.js", "ch_15_app.js"
    ];

    function now() { return Number(System.currentTimeMillis()); }
    function stamp(v) {
        return String(new SDF("yyyyMMdd-HHmmss-SSS", Locale.US)
            .format(new Packages.java.util.Date(v)));
    }
    function close(v) { if (v !== null) { try { v.close(); } catch (e) {} } }
    function err(e) {
        try {
            if (e && e.javaException) {
                return String(e.javaException.getClass().getName()) + ": " + String(e);
            }
        } catch (ignored) {}
        return String(e);
    }
    function dir(f) {
        if (!f.exists() && !f.mkdirs() && !f.isDirectory()) {
            throw new Error("Cannot create directory: " + f.getAbsolutePath());
        }
        return f;
    }
    function read(f) {
        var r = null;
        var b = new SB();
        var line;
        try {
            r = new BR(new ISR(new FIS(f), "UTF-8"));
            while ((line = r.readLine()) !== null) { b.append(line).append("\n"); }
            return String(b.toString());
        } finally { close(r); }
    }
    function write(f, text) {
        var w = null;
        try {
            w = new BW(new OSW(new FOS(f, false), "UTF-8"));
            w.write(String(text));
            w.flush();
        } finally { close(w); }
    }
    function waitFor(fn, timeout) {
        var start = now();
        while (now() - start < timeout) {
            if (fn()) { return true; }
            Thread.sleep(25);
        }
        return fn();
    }
    function lockFree(runtime) {
        var data = dir(new File(runtime, "data"));
        var raf = null;
        var channel = null;
        var lock = null;
        try {
            raf = new RAF(new File(data, "cliphub.lock"), "rw");
            channel = raf.getChannel();
            lock = channel.tryLock();
            return lock !== null;
        } catch (e) {
            if (String(e).indexOf("OverlappingFileLockException") >= 0) {
                return false;
            }
            throw e;
        } finally {
            if (lock !== null) { try { lock.release(); } catch (ignored) {} }
            close(channel);
            close(raf);
        }
    }
    function manifest(installed) {
        var f = new File(new File(installed, "cache"), "module-manifest.local.json");
        var d;
        if (!f.isFile()) { return {present: false}; }
        d = JSON.parse(read(f));
        return {
            present: true,
            moduleSetVersion: String(d.moduleSetVersion || ""),
            sourceRef: String(d.sourceRef || "")
        };
    }
    function stopFormal(ctx, runtime) {
        var cache = dir(new File(runtime, "cache"));
        var endpointFile = new File(cache, "control_endpoint.json");
        var endpoint;
        var requestId;
        var ackFile;
        var intent;
        var ack = null;
        if (lockFree(runtime)) {
            return {ok: false, initiallyRunning: false,
                error: "Formal ClipHub was not running before probe 007"};
        }
        if (!endpointFile.isFile()) {
            return {ok: false, initiallyRunning: true,
                error: "Formal control endpoint is missing"};
        }
        endpoint = JSON.parse(read(endpointFile));
        if (String(endpoint.transport || "") !== "dynamic_broadcast_token" ||
                String(endpoint.runtimeDir || "") !== String(runtime.getAbsolutePath())) {
            throw new Error("Invalid formal control endpoint");
        }
        requestId = stamp(now()) + "-" + Number(Thread.currentThread().getId());
        ackFile = new File(cache, "control_ack_" + requestId + ".json");
        if (ackFile.exists()) { ackFile.delete(); }
        intent = new Intent(String(endpoint.action));
        intent.putExtra("runtimeDir", String(runtime.getAbsolutePath()));
        intent.putExtra("command", "stop");
        intent.putExtra("requestId", requestId);
        intent.putExtra("controlToken", String(endpoint.token));
        ctx.sendBroadcast(intent);
        waitFor(function () { return ackFile.isFile() && lockFree(runtime); }, 3000);
        if (ackFile.isFile()) {
            try { ack = JSON.parse(read(ackFile)); } catch (ignoredAck) {}
            ackFile.delete();
        }
        return {
            ok: ack !== null && ack.ok === true && ack.stopped === true &&
                lockFree(runtime) && !endpointFile.exists(),
            initiallyRunning: true,
            ackReceived: ack !== null,
            ack: ack,
            lockReleased: lockFree(runtime),
            endpointRemoved: !endpointFile.exists(),
            error: ack === null ? "Control acknowledgement not received" : null
        };
    }
    function loadAndStart(root, modules, runtime) {
        var i;
        var f;
        global.ClipHub = {};
        for (i = 0; i < MODULES.length; i += 1) {
            f = new File(modules, MODULES[i]);
            if (!f.isFile()) { throw new Error("Missing module: " + f.getAbsolutePath()); }
            eval(read(f));
        }
        return global.ClipHub.App.start({
            shortxRoot: root,
            runtimeDir: String(runtime.getAbsolutePath()),
            moduleDir: String(modules.getAbsolutePath()),
            androidContext: global.context
        });
    }
    function source(manager) {
        try {
            return {
                available: typeof manager.getPrimaryClipSource === "function",
                ok: true,
                value: manager.getPrimaryClipSource() === null ? null :
                    String(manager.getPrimaryClipSource()),
                error: null
            };
        } catch (e) {
            return {
                available: typeof manager.getPrimaryClipSource === "function",
                ok: false,
                value: null,
                error: err(e)
            };
        }
    }
    function setAs(manager, clip, packageName) {
        try {
            if (typeof manager.setPrimaryClipAsPackage !== "function") {
                return {available: false, ok: false, error: null};
            }
            manager.setPrimaryClipAsPackage(clip, String(packageName));
            return {available: true, ok: true, error: null};
        } catch (e) {
            return {
                available: typeof manager.setPrimaryClipAsPackage === "function",
                ok: false,
                error: err(e)
            };
        }
    }
    function description(d) {
        var out = {
            present: d !== null,
            mimeTypes: [],
            extrasPresent: false,
            sensitive: false,
            classificationStatus: null,
            timestamp: null
        };
        var i;
        var extras;
        if (d === null) { return out; }
        try {
            for (i = 0; i < Number(d.getMimeTypeCount()); i += 1) {
                out.mimeTypes.push(String(d.getMimeType(i)));
            }
        } catch (ignoredMime) {}
        try {
            extras = d.getExtras();
            out.extrasPresent = extras !== null;
            out.sensitive = extras !== null && extras.getBoolean(SENSITIVE_KEY, false);
        } catch (ignoredExtras) {}
        try { out.classificationStatus = Number(d.getClassificationStatus()); }
        catch (ignoredClass) {}
        try { out.timestamp = Number(d.getTimestamp()); }
        catch (ignoredTime) {}
        return out;
    }
    function resolve(ctx, packageName) {
        var out = {packageName: packageName, resolved: false, label: null, uid: null};
        var pm;
        var info;
        if (packageName === null || String(packageName).length === 0) { return out; }
        try {
            pm = ctx.getPackageManager();
            info = pm.getApplicationInfo(String(packageName), 0);
            out.resolved = info !== null;
            out.uid = info === null ? null : Number(info.uid);
            out.label = info === null ? null : String(info.loadLabel(pm));
        } catch (e) { out.error = err(e); }
        return out;
    }

    function main() {
        var started = now();
        var root = String(shortx.getShortXDir());
        var installed = new File(root, "ClipHub");
        var modules = new File(installed, "modules");
        var output = new File(dir(new File(installed, "probes")),
            "cliphub_source_probe_007_" + stamp(started) + ".json");
        var ctx = global.context;
        var local = manifest(installed);
        var manager;
        var originalClip = null;
        var originalSource = null;
        var originalPresent = false;
        var originalSourceResult;
        var control;
        var testClip;
        var extras;
        var testSource;
        var expectedSource;
        var restore;
        var boot;
        var result = {
            ok: false,
            probe: "cliphub_source_probe_007",
            probeVersion: 1,
            startedAt: started,
            finishedAt: null,
            durationMs: null,
            pid: Number(Packages.android.os.Process.myPid()),
            uid: Number(Packages.android.os.Process.myUid()),
            threadId: Number(Thread.currentThread().getId()),
            threadName: String(Thread.currentThread().getName()),
            moduleSetVersion: local.moduleSetVersion || null,
            sourceRef: local.sourceRef || null,
            formalControl: null,
            sourcePermissionGranted: false,
            contextPackageName: null,
            contextOpPackageName: null,
            sourceMethodAvailable: false,
            sourceReadOk: false,
            originalSourcePackage: null,
            originalSourceResolved: null,
            originalDescription: null,
            setSourceMethodAvailable: false,
            setSourceMethodOk: false,
            testSourcePackage: null,
            testSourceMatched: false,
            testSourceResolved: null,
            testDescription: null,
            sensitiveDetected: false,
            clipboardRestored: false,
            originalSourceRestoredExact: null,
            formalRestart: null,
            outputPath: String(output.getAbsolutePath()),
            error: null
        };

        if (!local.present || local.moduleSetVersion !== REQUIRED_SET) {
            throw new Error("Installed module set must be " + REQUIRED_SET);
        }
        if (ctx === null || ctx === undefined) {
            throw new Error("Global Android context unavailable");
        }
        manager = ctx.getSystemService(Context.CLIPBOARD_SERVICE);
        if (manager === null) { throw new Error("ClipboardManager unavailable"); }
        try { result.contextPackageName = String(ctx.getPackageName()); } catch (e1) {}
        try { result.contextOpPackageName = String(ctx.getOpPackageName()); }
        catch (e2) { result.contextOpPackageName = result.contextPackageName; }
        try {
            result.sourcePermissionGranted = Number(ctx.checkSelfPermission(
                "android.permission.SET_CLIP_SOURCE")) ===
                Number(PackageManager.PERMISSION_GRANTED);
        } catch (e3) {}

        try {
            control = stopFormal(ctx, installed);
            result.formalControl = control;
            if (!control.ok || !control.ackReceived ||
                    String(control.ack.threadName || "") !== "main") {
                throw new Error(control.error || "Formal stop failed");
            }
            originalClip = manager.getPrimaryClip();
            originalPresent = originalClip !== null;
            result.originalDescription = description(manager.getPrimaryClipDescription());
            originalSourceResult = source(manager);
            result.sourceMethodAvailable = originalSourceResult.available;
            result.sourceReadOk = originalSourceResult.ok;
            originalSource = originalSourceResult.value;
            result.originalSourcePackage = originalSource;
            result.originalSourceResolved = resolve(ctx, originalSource);

            expectedSource = String(result.contextOpPackageName ||
                result.contextPackageName || "android");
            extras = new PersistableBundle();
            extras.putBoolean(SENSITIVE_KEY, true);
            testClip = ClipData.newPlainText(
                "ClipHub Probe 007 Sensitive",
                "ClipHub probe007 sensitive " + started
            );
            testClip.getDescription().setExtras(extras);
            restore = setAs(manager, testClip, expectedSource);
            result.setSourceMethodAvailable = restore.available;
            result.setSourceMethodOk = restore.ok;
            if (!restore.ok) { manager.setPrimaryClip(testClip); }
            testSource = source(manager);
            result.sourceMethodAvailable = result.sourceMethodAvailable ||
                testSource.available;
            result.sourceReadOk = result.sourceReadOk || testSource.ok;
            result.testSourcePackage = testSource.value;
            result.testSourceMatched = testSource.ok &&
                String(testSource.value || "") === expectedSource;
            result.testSourceResolved = resolve(ctx, testSource.value);
            result.testDescription = description(manager.getPrimaryClipDescription());
            result.sensitiveDetected = result.testDescription.sensitive === true;
        } catch (e) {
            result.error = err(e);
        } finally {
            try {
                if (originalPresent) {
                    if (originalSource !== null && String(originalSource).length > 0) {
                        restore = setAs(manager, originalClip, originalSource);
                        if (!restore.ok) { manager.setPrimaryClip(originalClip); }
                    } else {
                        manager.setPrimaryClip(originalClip);
                    }
                } else if (Packages.android.os.Build.VERSION.SDK_INT >= 28) {
                    manager.clearPrimaryClip();
                }
                result.clipboardRestored = true;
                if (originalSource !== null && String(originalSource).length > 0) {
                    testSource = source(manager);
                    result.originalSourceRestoredExact = testSource.ok &&
                        String(testSource.value || "") === String(originalSource);
                } else {
                    result.originalSourceRestoredExact = true;
                }
            } catch (restoreError) {
                if (result.error === null) {
                    result.error = "Restore clipboard failed: " + err(restoreError);
                }
            }
            try {
                if (lockFree(installed)) {
                    boot = loadAndStart(root, modules, installed);
                    result.formalRestart = boot;
                } else {
                    result.formalRestart = {ok: true, started: true, reused: true};
                }
            } catch (restartError) {
                if (result.error === null) {
                    result.error = "Formal restart failed: " + err(restartError);
                }
            }
            result.finishedAt = now();
            result.durationMs = result.finishedAt - result.startedAt;
            result.ok = result.error === null &&
                result.formalControl && result.formalControl.ok === true &&
                result.sourceMethodAvailable && result.sourceReadOk &&
                result.testSourceMatched && result.sensitiveDetected &&
                result.clipboardRestored &&
                result.originalSourceRestoredExact === true &&
                result.formalRestart && result.formalRestart.ok === true;
            write(output, JSON.stringify(result, null, 2) + "\n");
        }
        return result;
    }

    try { global.ClipHubSourceProbe007Result = main(); }
    catch (e) {
        global.ClipHubSourceProbe007Result = {
            ok: false,
            probe: "cliphub_source_probe_007",
            probeVersion: 1,
            fatal: true,
            error: err(e)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubSourceProbe007Result);
