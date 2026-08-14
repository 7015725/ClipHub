/* ClipHub comprehensive performance probe 077.
 * Target: beta-regex-settings-tabs-20260814 / 20260814.05.
 * Rhino ES5 only. Read-only for ClipHub runtime/database.
 * Persistent output: one TXT report under shortx.getShortXDir().
 * Fixes vs 076:
 * 1) ACK is accepted only after non-empty, parseable JSON is observed.
 * 2) status RTT samples fail independently; one transient ACK race does not abort the run.
 * 3) raw startupPerformance is separated from staged-render evidence and gets a trust assessment.
 */
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
    var Runtime = Packages.java.lang.Runtime;
    var SDF = Packages.java.text.SimpleDateFormat;
    var Locale = Packages.java.util.Locale;
    var Date = Packages.java.util.Date;
    var Build = Packages.android.os.Build;
    var Process = Packages.android.os.Process;
    var Debug = Packages.android.os.Debug;
    var Looper = Packages.android.os.Looper;
    var Intent = Packages.android.content.Intent;
    var SQLiteDatabase = Packages.android.database.sqlite.SQLiteDatabase;
    var Pattern = Packages.java.util.regex.Pattern;

    var NAME = "cliphub_comprehensive_performance_probe_077";
    var EXPECTED_REF = "beta-regex-settings-tabs-20260814";
    var EXPECTED_SET = "20260814.05";
    var TEXT_BUDGET = 786432;
    var ACK_TIMEOUT_MS = 2000;
    var ACK_POLL_MS = 5;
    var STATUS_WARMUP = 1;
    var STATUS_MEASURED = 6;

    function now() { return Number(System.currentTimeMillis()); }
    function nano() { return Number(System.nanoTime()); }
    function elapsedMs(start) { return (nano() - start) / 1000000.0; }
    function round(value) {
        return Math.round(Number(value) * 1000) / 1000;
    }
    function stamp(value) {
        return String(new SDF("yyyyMMdd-HHmmss-SSS", Locale.US)
            .format(new Date(Number(value))));
    }
    function close(value) {
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
    function read(file) {
        var reader = null;
        var out = new SB();
        var line;
        try {
            reader = new BR(new ISR(new FIS(file), "UTF-8"));
            while ((line = reader.readLine()) !== null) {
                out.append(line).append("\n");
            }
            return String(out.toString());
        } finally {
            close(reader);
        }
    }
    function write(file, text) {
        var writer = null;
        try {
            writer = new BW(new OSW(new FOS(file, false), "UTF-8"));
            writer.write(String(text));
            writer.flush();
        } finally {
            close(writer);
        }
    }
    function stats(values) {
        var sorted = values.slice(0);
        var sum = 0;
        var index;
        function at(p) {
            var i;
            if (sorted.length === 0) { return null; }
            i = Math.ceil(sorted.length * p) - 1;
            if (i < 0) { i = 0; }
            if (i >= sorted.length) { i = sorted.length - 1; }
            return round(sorted[i]);
        }
        sorted.sort(function (a, b) { return Number(a) - Number(b); });
        for (index = 0; index < sorted.length; index += 1) {
            sum += Number(sorted[index]);
        }
        return {
            count: sorted.length,
            min: sorted.length ? round(sorted[0]) : null,
            avg: sorted.length ? round(sum / sorted.length) : null,
            p50: at(0.50),
            p95: at(0.95),
            max: sorted.length ? round(sorted[sorted.length - 1]) : null,
            samples: values.slice(0)
        };
    }
    function fileBytes(file) {
        try { return file.isFile() ? Number(file.length()) : 0; }
        catch (ignored) { return 0; }
    }
    function onMainThread() {
        var looper = Looper.getMainLooper();
        try {
            if (looper === null) { return false; }
            if (Build.VERSION.SDK_INT >= 23) {
                return looper.isCurrentThread();
            }
            return Number(looper.getThread().getId()) ===
                Number(Thread.currentThread().getId());
        } catch (ignored) {
            return false;
        }
    }
    function memory() {
        var runtime = Runtime.getRuntime();
        var info = new Debug.MemoryInfo();
        var result = {
            javaUsed: Number(runtime.totalMemory() - runtime.freeMemory()),
            javaTotal: Number(runtime.totalMemory()),
            javaMax: Number(runtime.maxMemory()),
            nativeAllocated: null,
            totalPssKb: null,
            threads: null
        };
        try {
            result.nativeAllocated = Number(Debug.getNativeHeapAllocatedSize());
        } catch (ignoredNative) {}
        try {
            Debug.getMemoryInfo(info);
            result.totalPssKb = Number(info.getTotalPss());
        } catch (ignoredPss) {}
        try {
            result.threads = Number(Thread.getAllStackTraces().size());
        } catch (ignoredThreads) {}
        return result;
    }
    function memoryDelta(before, after) {
        function delta(key) {
            if (before[key] === null || after[key] === null) { return null; }
            return Number(after[key]) - Number(before[key]);
        }
        return {
            javaUsed: delta("javaUsed"),
            javaTotal: delta("javaTotal"),
            nativeAllocated: delta("nativeAllocated"),
            totalPssKb: delta("totalPssKb"),
            threads: delta("threads")
        };
    }
    function moduleStats(dir) {
        var files = dir.isDirectory() ? dir.listFiles() : null;
        var count = 0;
        var bytes = 0;
        var index;
        var name;
        if (files === null) { return { count: 0, bytes: 0 }; }
        for (index = 0; index < files.length; index += 1) {
            if (!files[index].isFile()) { continue; }
            name = String(files[index].getName());
            if (/^ch_[0-9][0-9]_.+\.js$/.test(name)) {
                count += 1;
                bytes += Number(files[index].length());
            }
        }
        return { count: count, bytes: bytes };
    }
    function manifest(runtimeDir) {
        var file = new File(runtimeDir, "module-manifest.json");
        var data;
        if (!file.isFile()) { return { present: false }; }
        try {
            data = JSON.parse(read(file));
            return {
                present: true,
                sourceRef: String(data.sourceRef || ""),
                moduleSetVersion: String(data.moduleSetVersion || ""),
                entryMinVersion: Number(data.entryMinVersion || 0),
                moduleCount: data.modules instanceof Array ? data.modules.length : 0
            };
        } catch (error) {
            return { present: true, error: errorText(error) };
        }
    }
    function endpoint(runtimeDir) {
        var file = new File(new File(runtimeDir, "cache"),
            "control_endpoint.json");
        var data;
        if (!file.isFile()) { return { present: false, data: null }; }
        try {
            data = JSON.parse(read(file));
            if (!data ||
                    String(data.transport || "") !== "dynamic_broadcast_token" ||
                    String(data.action || "").length < 1 ||
                    String(data.token || "").length < 1) {
                throw new Error("invalid control endpoint");
            }
            return {
                present: true,
                data: data,
                schemaVersion: Number(data.schemaVersion || 0),
                transport: String(data.transport || ""),
                error: null
            };
        } catch (error) {
            return {
                present: true,
                data: null,
                schemaVersion: null,
                transport: null,
                error: errorText(error)
            };
        }
    }

    /* 077: wait until the ACK is non-empty AND parseable.
     * A file can become visible before the writer has flushed JSON.
     */
    function waitJsonAck(file, timeoutMs) {
        var started = now();
        var text = "";
        var parsed = null;
        var emptyPolls = 0;
        var parseRetries = 0;
        var lastParseError = null;
        while (now() - started < timeoutMs) {
            if (file.isFile()) {
                try {
                    if (Number(file.length()) <= 0) {
                        emptyPolls += 1;
                    } else {
                        text = read(file);
                        if (String(text).replace(/\s+/g, "").length < 1) {
                            emptyPolls += 1;
                        } else {
                            try {
                                parsed = JSON.parse(text);
                                return {
                                    ok: true,
                                    data: parsed,
                                    waitMs: now() - started,
                                    emptyPolls: emptyPolls,
                                    parseRetries: parseRetries,
                                    lastParseError: lastParseError
                                };
                            } catch (parseError) {
                                parseRetries += 1;
                                lastParseError = errorText(parseError);
                            }
                        }
                    }
                } catch (readError) {
                    parseRetries += 1;
                    lastParseError = errorText(readError);
                }
            }
            Thread.sleep(ACK_POLL_MS);
        }
        return {
            ok: false,
            data: null,
            waitMs: now() - started,
            emptyPolls: emptyPolls,
            parseRetries: parseRetries,
            lastParseError: lastParseError,
            error: "status_ack_timeout"
        };
    }

    function statusRtt(androidContext, runtimeDir, ep) {
        var result = {
            available: false,
            skipped: false,
            reason: null,
            requestedSamples: STATUS_MEASURED,
            successfulSamples: 0,
            failedSamples: 0,
            rttMs: null,
            ackDiagnostics: {
                emptyPolls: 0,
                parseRetries: 0,
                warmupOk: false,
                samples: []
            },
            last: null,
            errors: []
        };
        var cacheDir = new File(runtimeDir, "cache");
        var appContext;
        var values = [];
        var totalLoops = STATUS_WARMUP + STATUS_MEASURED;
        var index;
        var requestId;
        var ackFile;
        var intent;
        var started;
        var waited;
        var ack;
        var sample;
        if (!ep.present || ep.data === null) {
            result.skipped = true;
            result.reason = ep.error || "endpoint_missing";
            return result;
        }
        if (androidContext === null || androidContext === undefined) {
            result.skipped = true;
            result.reason = "context_missing";
            return result;
        }
        if (onMainThread()) {
            result.skipped = true;
            result.reason = "main_thread_deadlock_guard";
            return result;
        }
        appContext = androidContext.getApplicationContext();
        if (appContext === null) { appContext = androidContext; }

        for (index = 0; index < totalLoops; index += 1) {
            requestId = "perf077_" + String(now()) + "_" + String(index);
            ackFile = new File(cacheDir, "control_ack_" + requestId + ".json");
            sample = {
                index: index,
                warmup: index < STATUS_WARMUP,
                ok: false,
                rttMs: null,
                waitMs: null,
                emptyPolls: 0,
                parseRetries: 0,
                error: null
            };
            try {
                if (ackFile.exists()) { ackFile.delete(); }
                intent = new Intent(String(ep.data.action));
                intent.putExtra("runtimeDir", String(runtimeDir.getAbsolutePath()));
                intent.putExtra("command", "status");
                intent.putExtra("requestId", requestId);
                intent.putExtra("controlToken", String(ep.data.token));
                started = nano();
                appContext.sendBroadcast(intent);
                waited = waitJsonAck(ackFile, ACK_TIMEOUT_MS);
                sample.waitMs = waited.waitMs;
                sample.emptyPolls = waited.emptyPolls;
                sample.parseRetries = waited.parseRetries;
                result.ackDiagnostics.emptyPolls += Number(waited.emptyPolls || 0);
                result.ackDiagnostics.parseRetries += Number(waited.parseRetries || 0);
                if (!waited.ok) {
                    throw new Error(waited.error +
                        (waited.lastParseError ?
                            (": " + waited.lastParseError) : ""));
                }
                ack = waited.data;
                if (!ack || ack.ok !== true) {
                    throw new Error("invalid status ack");
                }
                sample.ok = true;
                sample.rttMs = round(elapsedMs(started));
                result.last = ack;
                if (sample.warmup) {
                    result.ackDiagnostics.warmupOk = true;
                } else {
                    values.push(sample.rttMs);
                    result.successfulSamples += 1;
                }
            } catch (error) {
                sample.error = errorText(error);
                if (!sample.warmup) {
                    result.failedSamples += 1;
                    result.errors.push("sample " + String(index) + ": " +
                        sample.error);
                }
            } finally {
                try {
                    if (ackFile && ackFile.exists()) { ackFile.delete(); }
                } catch (ignoredDelete) {}
            }
            result.ackDiagnostics.samples.push(sample);
        }
        result.rttMs = stats(values);
        result.available = result.last !== null && values.length > 0;
        return result;
    }

    function scalar(db, sql, fallback) {
        var cursor = null;
        try {
            cursor = db.rawQuery(String(sql), null);
            if (!cursor.moveToFirst() || cursor.isNull(0)) { return fallback; }
            return Number(cursor.getDouble(0));
        } catch (ignored) {
            return fallback;
        } finally {
            close(cursor);
        }
    }
    function scalarText(db, sql, fallback) {
        var cursor = null;
        try {
            cursor = db.rawQuery(String(sql), null);
            if (!cursor.moveToFirst() || cursor.isNull(0)) { return fallback; }
            return String(cursor.getString(0));
        } catch (ignored) {
            return fallback;
        } finally {
            close(cursor);
        }
    }
    function hasTable(db, name) {
        var cursor = null;
        try {
            cursor = db.rawQuery("SELECT 1 FROM sqlite_master " +
                "WHERE type='table' AND name='" +
                String(name).replace(/'/g, "''") + "' LIMIT 1", null);
            return cursor.moveToFirst();
        } finally {
            close(cursor);
        }
    }
    function consume(db, sql) {
        var cursor = null;
        var result = { rows: 0, cells: 0, chars: 0 };
        var columns;
        var index;
        var value;
        try {
            cursor = db.rawQuery(String(sql), null);
            columns = Number(cursor.getColumnCount());
            while (cursor.moveToNext()) {
                result.rows += 1;
                for (index = 0; index < columns; index += 1) {
                    if (cursor.isNull(index)) { continue; }
                    result.cells += 1;
                    try {
                        value = cursor.getString(index);
                        if (value !== null) {
                            result.chars += String(value).length;
                        }
                    } catch (ignoredCell) {}
                }
            }
            return result;
        } finally {
            close(cursor);
        }
    }
    function bench(db, name, sql, repeats) {
        var values = [];
        var index;
        var started;
        var consumed;
        consume(db, sql);
        for (index = 0; index < repeats; index += 1) {
            started = nano();
            consumed = consume(db, sql);
            values.push(round(elapsedMs(started)));
        }
        return {
            name: name,
            timingMs: stats(values),
            consumed: consumed
        };
    }
    function plan(db, sql) {
        var cursor = null;
        var output = [];
        try {
            cursor = db.rawQuery("EXPLAIN QUERY PLAN " + sql, null);
            while (cursor.moveToNext()) {
                output.push(String(cursor.getString(3)));
            }
        } catch (error) {
            output.push("ERROR: " + errorText(error));
        } finally {
            close(cursor);
        }
        return output;
    }
    function javaFlags(flags) {
        var value = Number(flags || 0);
        var result = 0;
        if ((value & 1) !== 0) {
            result |= Number(Pattern.CASE_INSENSITIVE);
            result |= Number(Pattern.UNICODE_CASE);
        }
        if ((value & 2) !== 0) { result |= Number(Pattern.MULTILINE); }
        if ((value & 4) !== 0) { result |= Number(Pattern.DOTALL); }
        return result;
    }
    function regexMicro(db) {
        var result = {
            available: false,
            rules: 0,
            texts: 0,
            operations: 0,
            compileMs: null,
            matchTotalMs: null,
            usPerOp: null,
            matched: 0,
            compileErrors: 0,
            error: null
        };
        var cursor = null;
        var rules = [];
        var texts = [];
        var compiled = [];
        var compileTimes = [];
        var index;
        var textIndex;
        var started;
        var pattern;
        try {
            if (!hasTable(db, "regex_rules")) { return result; }
            cursor = db.rawQuery("SELECT id,pattern,flags FROM regex_rules " +
                "WHERE enabled=1 ORDER BY manual_order ASC,id ASC LIMIT 32", null);
            while (cursor.moveToNext()) {
                rules.push({
                    id: Number(cursor.getLong(0)),
                    pattern: String(cursor.getString(1)),
                    flags: Number(cursor.getLong(2))
                });
            }
            close(cursor);
            cursor = db.rawQuery("SELECT substr(content,1,4096) FROM " +
                "clipboard_items WHERE deleted_at IS NULL " +
                "ORDER BY last_copied_at DESC,id DESC LIMIT 64", null);
            while (cursor.moveToNext()) {
                texts.push(cursor.isNull(0) ? "" : String(cursor.getString(0)));
            }
            close(cursor);
            cursor = null;

            for (index = 0; index < rules.length; index += 1) {
                started = nano();
                try {
                    pattern = Pattern.compile(rules[index].pattern,
                        javaFlags(rules[index].flags));
                    compileTimes.push(round(elapsedMs(started)));
                    compiled.push(pattern);
                } catch (ignoredCompile) {
                    result.compileErrors += 1;
                }
            }

            started = nano();
            for (index = 0; index < compiled.length; index += 1) {
                for (textIndex = 0; textIndex < texts.length; textIndex += 1) {
                    result.operations += 1;
                    if (compiled[index].matcher(texts[textIndex]).find()) {
                        result.matched += 1;
                    }
                }
            }
            result.matchTotalMs = round(elapsedMs(started));
            result.rules = rules.length;
            result.texts = texts.length;
            result.compileMs = stats(compileTimes);
            result.usPerOp = result.operations > 0 ?
                round(result.matchTotalMs * 1000 / result.operations) : 0;
            result.available = true;
        } catch (error) {
            result.error = errorText(error);
        } finally {
            close(cursor);
        }
        return result;
    }
    function dbProbe(dbFile) {
        var result = {
            available: false,
            fileBytes: fileBytes(dbFile),
            walBytes: fileBytes(new File(String(dbFile.getAbsolutePath()) + "-wal")),
            shmBytes: fileBytes(new File(String(dbFile.getAbsolutePath()) + "-shm")),
            userVersion: null,
            pageCount: null,
            pageSize: null,
            freelistCount: null,
            journalMode: null,
            activeItems: null,
            totalItems: null,
            maxContentChars: null,
            avgContentChars: null,
            oversizeItems: null,
            regexRules: null,
            regexEnabled: null,
            regexFeatureSchema: null,
            benchmarks: [],
            plans: {},
            regexMicro: null,
            error: null
        };
        var db = null;
        var cursor = null;
        var homeSql = "SELECT id,substr(content,1,200),content_type," +
            "source_package,source_label,is_pinned,manual_order,last_copied_at " +
            "FROM clipboard_items WHERE deleted_at IS NULL " +
            "ORDER BY is_pinned DESC,manual_order ASC,last_copied_at DESC LIMIT 100";
        var regexSql = "SELECT id,content,updated_at,source_label,source_package," +
            "is_pinned,manual_order,last_copied_at FROM clipboard_items " +
            "WHERE deleted_at IS NULL ORDER BY last_copied_at DESC,id DESC LIMIT 128";
        var rulesSql = "SELECT id,title,note,pattern,flags,enabled,manual_order," +
            "updated_at FROM regex_rules ORDER BY manual_order ASC,id ASC";

        if (!dbFile.isFile()) {
            result.error = "database_missing";
            return result;
        }
        try {
            db = SQLiteDatabase.openDatabase(
                String(dbFile.getAbsolutePath()),
                null,
                SQLiteDatabase.OPEN_READONLY
            );
            result.available = true;
            result.userVersion = scalar(db, "PRAGMA user_version", -1);
            result.pageCount = scalar(db, "PRAGMA page_count", -1);
            result.pageSize = scalar(db, "PRAGMA page_size", -1);
            result.freelistCount = scalar(db, "PRAGMA freelist_count", -1);
            result.journalMode = scalarText(db, "PRAGMA journal_mode", "unknown");
            result.activeItems = scalar(db,
                "SELECT COUNT(*) FROM clipboard_items WHERE deleted_at IS NULL", -1);
            result.totalItems = scalar(db,
                "SELECT COUNT(*) FROM clipboard_items", -1);

            cursor = db.rawQuery(
                "SELECT COALESCE(MAX(LENGTH(content)),0)," +
                "COALESCE(AVG(LENGTH(content)),0)," +
                "COALESCE(SUM(CASE WHEN LENGTH(content)>" +
                String(TEXT_BUDGET) +
                " THEN 1 ELSE 0 END),0) FROM clipboard_items " +
                "WHERE deleted_at IS NULL",
                null
            );
            if (cursor.moveToFirst()) {
                result.maxContentChars = Number(cursor.getLong(0));
                result.avgContentChars = round(Number(cursor.getDouble(1)));
                result.oversizeItems = Number(cursor.getLong(2));
            }
            close(cursor);
            cursor = null;

            if (hasTable(db, "regex_rules")) {
                result.regexRules = scalar(db,
                    "SELECT COUNT(*) FROM regex_rules", -1);
                result.regexEnabled = scalar(db,
                    "SELECT COUNT(*) FROM regex_rules WHERE enabled=1", -1);
                result.regexFeatureSchema = scalar(db,
                    "SELECT CAST(value AS INTEGER) FROM schema_meta WHERE " +
                    "key='feature.regex_rules.schema_version' LIMIT 1", 0);
            }

            result.benchmarks.push(
                bench(db, "home_preview100", homeSql, 10));
            result.benchmarks.push(
                bench(db, "regex_candidate128", regexSql, 5));
            result.plans.home_preview100 = plan(db, homeSql);
            result.plans.regex_candidate128 = plan(db, regexSql);

            if (result.regexRules !== null) {
                result.benchmarks.push(
                    bench(db, "regex_rule_list", rulesSql, 10));
                result.plans.regex_rule_list = plan(db, rulesSql);
            }
            result.regexMicro = regexMicro(db);
        } catch (error) {
            result.error = errorText(error);
        } finally {
            close(cursor);
            close(db);
        }
        return result;
    }

    function latestFullRefreshSample(scroll) {
        var samples;
        if (!scroll || !(scroll.fullRefreshSamples instanceof Array) ||
                scroll.fullRefreshSamples.length < 1) {
            return null;
        }
        samples = scroll.fullRefreshSamples;
        return samples[samples.length - 1];
    }

    /* 077 deliberately does not assert that showGeneration and
     * renderGeneration are the same counter. It records both and only
     * marks a raw startup duration suspicious when it strongly conflicts
     * with staged-render evidence from the same status snapshot.
     */
    function assessStartup(statusAck) {
        var result = {
            available: false,
            raw: null,
            staged: null,
            refreshEvidence: null,
            rawTrustedForThresholds: false,
            reasons: []
        };
        var status;
        var startup;
        var scroll;
        var latest;
        var firstBatch;
        var fullRender;
        var stagedFirst;
        var stagedLast;
        var stagedMax;
        var firstLimit;
        var fullLimit;
        if (!statusAck || !statusAck.status) {
            result.reasons.push("status_missing");
            return result;
        }
        status = statusAck.status;
        startup = status.startupPerformance || null;
        scroll = status.scrollPerformance || null;
        result.raw = startup;

        if (scroll) {
            result.staged = {
                initialStagedStartCount:
                    Number(scroll.initialStagedStartCount || 0),
                initialStagedCompletedCount:
                    Number(scroll.initialStagedCompletedCount || 0),
                initialStagedCancelCount:
                    Number(scroll.initialStagedCancelCount || 0),
                initialStagedFirstBatchCards:
                    Number(scroll.initialStagedFirstBatchCards || 0),
                initialStagedFirstBatchMs:
                    Number(scroll.initialStagedFirstBatchMs || 0),
                initialStagedLastTotalCards:
                    Number(scroll.initialStagedLastTotalCards || 0),
                initialStagedLastTotalMs:
                    Number(scroll.initialStagedLastTotalMs || 0),
                initialStagedMaxTotalMs:
                    Number(scroll.initialStagedMaxTotalMs || 0)
            };
            latest = latestFullRefreshSample(scroll);
            if (latest) {
                result.refreshEvidence = {
                    startupShowGeneration: startup ?
                        Number(startup.showGeneration || 0) : null,
                    latestRenderGeneration:
                        Number(latest.renderGeneration || 0),
                    latestQueryGeneration:
                        Number(latest.queryGeneration || 0),
                    latestSearchGeneration:
                        Number(latest.searchGeneration || 0),
                    latestAtMs: Number(latest.atMs || 0),
                    latestOrigin: String(latest.origin || ""),
                    latestDataKey: String(latest.dataKey || ""),
                    latestContentReady: latest.contentReady === true
                };
            }
        }

        if (!startup) {
            result.reasons.push("startup_missing");
            return result;
        }
        result.available = true;
        firstBatch = startup.showToFirstBatchMs === null ||
            startup.showToFirstBatchMs === undefined ?
            null : Number(startup.showToFirstBatchMs);
        fullRender = startup.showToFullRenderMs === null ||
            startup.showToFullRenderMs === undefined ?
            null : Number(startup.showToFullRenderMs);

        if (firstBatch !== null && firstBatch < 0) {
            result.reasons.push("negative_first_batch");
        }
        if (fullRender !== null && fullRender < 0) {
            result.reasons.push("negative_full_render");
        }
        if (firstBatch !== null && fullRender !== null &&
                fullRender < firstBatch) {
            result.reasons.push("full_render_before_first_batch");
        }

        if (result.staged &&
                Number(result.staged.initialStagedCompletedCount || 0) > 0) {
            stagedFirst = Number(result.staged.initialStagedFirstBatchMs || 0);
            stagedLast = Number(result.staged.initialStagedLastTotalMs || 0);
            stagedMax = Number(result.staged.initialStagedMaxTotalMs || 0);

            firstLimit = Math.max(5000,
                Math.max(stagedFirst, stagedMax) * 4);
            fullLimit = Math.max(10000,
                Math.max(stagedLast, stagedMax) * 4);

            if (firstBatch !== null && stagedFirst > 0 &&
                    firstBatch > firstLimit) {
                result.reasons.push(
                    "raw_first_batch_conflicts_with_staged");
            }
            if (fullRender !== null && stagedLast > 0 &&
                    fullRender > fullLimit) {
                result.reasons.push(
                    "raw_full_render_conflicts_with_staged");
            }
        }

        result.rawTrustedForThresholds = result.reasons.length === 0;
        return result;
    }

    function inProcess() {
        var C = global.ClipHub;
        var result = {
            available: false,
            filter: null,
            settings: null,
            hydrationWorker: null,
            scrollPerformance: null,
            filterStateReadMs: null,
            error: null
        };
        var getter;
        var values = [];
        var index;
        var started;
        if (!C) { return result; }
        try {
            result.available = true;
            if (C.Filter) {
                getter = typeof C.Filter.getPanelState === "function" ?
                    C.Filter.getPanelState : C.Filter.getState;
                if (typeof getter === "function") {
                    result.filter = getter.call(C.Filter);
                    for (index = 0; index < 100; index += 1) {
                        started = nano();
                        getter.call(C.Filter);
                        values.push(round(elapsedMs(started)));
                    }
                    result.filterStateReadMs = stats(values);
                }
                if (typeof C.Filter.getHydrationWorkerState === "function") {
                    result.hydrationWorker =
                        C.Filter.getHydrationWorkerState();
                }
                if (typeof C.Filter.getScrollPerformanceState === "function") {
                    result.scrollPerformance =
                        C.Filter.getScrollPerformanceState();
                }
            }
            if (C.Settings && typeof C.Settings.getState === "function") {
                result.settings = C.Settings.getState();
            }
        } catch (error) {
            result.error = errorText(error);
        }
        return result;
    }

    function findBench(database, name) {
        var index;
        for (index = 0; index < database.benchmarks.length; index += 1) {
            if (String(database.benchmarks[index].name) === name) {
                return database.benchmarks[index];
            }
        }
        return null;
    }

    function warnings(result) {
        var out = [];
        var home = findBench(result.database, "home_preview100");
        var regex = findBench(result.database, "regex_candidate128");
        var startup = result.startupAssessment.raw;
        var staged = result.startupAssessment.staged;
        function add(condition, text) {
            if (condition) { out.push(text); }
        }

        add(result.manifest.present &&
            result.manifest.sourceRef !== EXPECTED_REF,
            "manifest sourceRef 与目标分支不一致");
        add(result.manifest.present &&
            result.manifest.moduleSetVersion !== EXPECTED_SET,
            "manifest moduleSetVersion 不是 20260814.05");
        add(result.status.available && result.status.last &&
            String(result.status.last.sourceRef || "") !== EXPECTED_REF,
            "当前运行实例 sourceRef 不是目标分支");
        add(result.status.available && result.status.last &&
            String(result.status.last.moduleSetVersion || "") !== EXPECTED_SET,
            "当前运行实例 moduleSetVersion 不是 20260814.05");
        add(result.database.available &&
            Number(result.database.userVersion) !== 2,
            "数据库 user_version 不是 2");
        add(result.database.regexFeatureSchema !== null &&
            Number(result.database.regexFeatureSchema) !== 1,
            "Regex feature schema 不是 1");
        add(Number(result.database.oversizeItems || 0) > 0,
            "存在超过 786432 字符的活动项，Regex 扫描会走 oversize skip 路径");

        add(result.status.rttMs &&
            Number(result.status.rttMs.p95 || 0) > 100,
            "status 往返 p95 > 100ms");
        add(result.status.failedSamples > 0,
            "status RTT 存在失败样本：" +
            String(result.status.failedSamples) + "/" +
            String(result.status.requestedSamples));
        add(result.status.ackDiagnostics.parseRetries > 0,
            "status ACK 出现过未完整/不可解析窗口，077 已重试吸收");
        add(result.status.ackDiagnostics.emptyPolls > 0,
            "status ACK 出现过空文件窗口，077 已等待非空 JSON");

        add(home && Number(home.timingMs.p95 || 0) > 30,
            "首页 100 条/200 字预览查询 p95 > 30ms");
        add(regex && Number(regex.timingMs.p95 || 0) > 100,
            "Regex 128 条完整正文候选查询 p95 > 100ms");

        if (result.startupAssessment.rawTrustedForThresholds) {
            add(startup && startup.showToFirstBatchMs !== null &&
                Number(startup.showToFirstBatchMs || 0) > 350,
                "可信 raw showToFirstBatchMs > 350ms");
            add(startup && startup.showToFullRenderMs !== null &&
                Number(startup.showToFullRenderMs || 0) > 900,
                "可信 raw showToFullRenderMs > 900ms");
        } else if (result.startupAssessment.available) {
            out.push("raw startupPerformance 不参与阈值判定：" +
                result.startupAssessment.reasons.join(","));
        }

        add(staged &&
            Number(staged.initialStagedFirstBatchMs || 0) > 120,
            "staged 首批 > 120ms");
        add(staged &&
            Number(staged.initialStagedLastTotalMs || 0) > 1200,
            "staged 最近一次完整构建 > 1200ms");

        add(result.database.regexMicro &&
            result.database.regexMicro.available &&
            Number(result.database.regexMicro.usPerOp || 0) > 500,
            "Regex 样本 matcher.find() > 500us/op");

        if (result.status.skipped) {
            out.push("status RTT 已跳过：" +
                String(result.status.reason));
        }
        if (result.status.errors.length > 0) {
            out.push("status RTT 样本错误：" +
                result.status.errors.join(" | "));
        }
        if (result.database.error) {
            out.push("SQLite 探针错误：" + result.database.error);
        }
        return out;
    }

    function report(result) {
        var lines = [];
        var index;
        var benchmark;
        var rawStartup = result.startupAssessment.raw;
        var staged = result.startupAssessment.staged;

        lines.push("ClipHub beta-regex-settings-tabs 综合性能探针 077");
        lines.push("================================================");
        lines.push("生成时间=" + new Date(result.startedAt).toString());
        lines.push("output=" + result.outputPath);
        lines.push("durationMs=" + result.durationMs);
        lines.push("");

        lines.push("[环境]");
        lines.push("SDK=" + result.environment.sdkInt +
            " device=" + result.environment.manufacturer +
            " " + result.environment.model);
        lines.push("pid=" + result.environment.pid +
            " uid=" + result.environment.uid +
            " thread=" + result.environment.threadName +
            " main=" + result.environment.onMainThread);
        lines.push("moduleFiles=" + result.moduleFiles.count +
            " moduleBytes=" + result.moduleFiles.bytes);
        lines.push("");

        lines.push("[分支/运行版本]");
        lines.push("manifestRef=" +
            String(result.manifest.sourceRef || "") +
            " manifestSet=" +
            String(result.manifest.moduleSetVersion || ""));
        lines.push("controlEndpoint=" +
            String(result.endpoint.present) +
            " schema=" + String(result.endpoint.schemaVersion || "") +
            " transport=" + String(result.endpoint.transport || ""));
        if (result.status.last) {
            lines.push("runningRef=" +
                String(result.status.last.sourceRef || "") +
                " runningSet=" +
                String(result.status.last.moduleSetVersion || ""));
        }
        lines.push("");

        lines.push("[正式实例 status RTT - 077 稳定 ACK]");
        lines.push("available=" + result.status.available +
            " success=" + result.status.successfulSamples +
            "/" + result.status.requestedSamples +
            " failed=" + result.status.failedSamples);
        lines.push("rtt=" + JSON.stringify(result.status.rttMs));
        lines.push("ackEmptyPolls=" +
            result.status.ackDiagnostics.emptyPolls +
            " ackParseRetries=" +
            result.status.ackDiagnostics.parseRetries +
            " warmupOk=" +
            result.status.ackDiagnostics.warmupOk);
        if (result.status.errors.length > 0) {
            lines.push("errors=" + JSON.stringify(result.status.errors));
        }
        lines.push("");

        lines.push("[Filter 启动性能 - raw 与 staged 分离]");
        lines.push("raw=" + JSON.stringify(rawStartup));
        lines.push("rawTrustedForThresholds=" +
            result.startupAssessment.rawTrustedForThresholds);
        lines.push("trustReasons=" +
            JSON.stringify(result.startupAssessment.reasons));
        lines.push("staged=" + JSON.stringify(staged));
        lines.push("refreshEvidence=" +
            JSON.stringify(result.startupAssessment.refreshEvidence));
        lines.push("");

        lines.push("[SQLite / 数据规模]");
        lines.push("available=" + result.database.available +
            " userVersion=" + result.database.userVersion +
            " regexFeatureSchema=" +
            result.database.regexFeatureSchema);
        lines.push("dbBytes=" + result.database.fileBytes +
            " walBytes=" + result.database.walBytes +
            " shmBytes=" + result.database.shmBytes);
        lines.push("pageCount=" + result.database.pageCount +
            " pageSize=" + result.database.pageSize +
            " freelist=" + result.database.freelistCount +
            " journal=" + result.database.journalMode);
        lines.push("activeItems=" + result.database.activeItems +
            " totalItems=" + result.database.totalItems);
        lines.push("maxChars=" + result.database.maxContentChars +
            " avgChars=" + result.database.avgContentChars +
            " oversizeItems=" + result.database.oversizeItems);
        lines.push("regexRules=" + result.database.regexRules +
            " regexEnabled=" + result.database.regexEnabled);
        lines.push("");

        lines.push("[SQLite 查询性能]");
        for (index = 0;
                index < result.database.benchmarks.length;
                index += 1) {
            benchmark = result.database.benchmarks[index];
            lines.push(benchmark.name +
                " avg=" + benchmark.timingMs.avg +
                " p50=" + benchmark.timingMs.p50 +
                " p95=" + benchmark.timingMs.p95 +
                " max=" + benchmark.timingMs.max +
                "ms rows=" + benchmark.consumed.rows +
                " chars=" + benchmark.consumed.chars);
        }
        lines.push("homePlan=" +
            JSON.stringify(
                result.database.plans.home_preview100 || []));
        lines.push("regexPlan=" +
            JSON.stringify(
                result.database.plans.regex_candidate128 || []));
        lines.push("");

        lines.push("[Regex 样本 matcher.find()]");
        lines.push(JSON.stringify(result.database.regexMicro));
        lines.push("");

        lines.push("[内存]");
        lines.push("before=" + JSON.stringify(result.memoryBefore));
        lines.push("after=" + JSON.stringify(result.memoryAfter));
        lines.push("delta=" + JSON.stringify(result.memoryDelta));
        lines.push("");

        lines.push("[同 JS 上下文状态（如可见）]");
        lines.push(JSON.stringify(result.inProcess));
        lines.push("");

        lines.push("[性能观察]");
        if (result.warnings.length === 0) {
            lines.push("无阈值告警；仍应以多次实机趋势为准。");
        } else {
            for (index = 0; index < result.warnings.length; index += 1) {
                lines.push("- " + result.warnings[index]);
            }
        }
        lines.push("");
        lines.push("说明：本探针不写 ClipHub 数据库、不增删 Regex 规则、不切换 UI、不 stop/restart 正式实例。");
        lines.push("说明：status RTT 仅复用现有 control endpoint；ACK 为临时缓存文件，读取后删除。");
        lines.push("说明：raw startupPerformance 若与 staged 指标强冲突，仅标记为不可信，不据此修改业务代码。");
        lines.push("说明：showGeneration/renderGeneration 只作为证据输出；077 不假定两者是同一计数器。");
        lines.push("说明：Regex 样本只输出数量/耗时，不输出剪贴板正文。");
        lines.push("说明：阈值仅用于发现明显回退，不把单次性能数值当作绝对 PASS/FAIL。");
        lines.push("");
        lines.push("[RAW_JSON]");
        lines.push(JSON.stringify(result, null, 2));
        return lines.join("\n") + "\n";
    }

    function main() {
        var startedAt = now();
        var sx = typeof shortx !== "undefined" ?
            shortx : global.shortx;
        var root;
        var runtimeDir;
        var modulesDir;
        var dbFile;
        var ep;
        var output;
        var result;
        var before = memory();
        var androidContext = typeof global.context === "undefined" ?
            null : global.context;

        if (!sx || typeof sx.getShortXDir !== "function") {
            throw new Error("shortx.getShortXDir unavailable");
        }

        root = String(sx.getShortXDir());
        runtimeDir = new File(root, "ClipHub");
        modulesDir = new File(runtimeDir, "modules");
        dbFile = new File(new File(runtimeDir, "data"), "cliphub.db");
        ep = endpoint(runtimeDir);
        output = new File(root,
            "ClipHub_beta-regex-settings-tabs_perf_probe_077_" +
            stamp(startedAt) + ".txt");

        result = {
            probe: NAME,
            probeVersion: 2,
            targetRef: EXPECTED_REF,
            targetModuleSet: EXPECTED_SET,
            startedAt: startedAt,
            finishedAt: null,
            durationMs: null,
            outputPath: String(output.getAbsolutePath()),
            environment: {
                sdkInt: Number(Build.VERSION.SDK_INT),
                manufacturer: String(Build.MANUFACTURER || ""),
                model: String(Build.MODEL || ""),
                pid: Number(Process.myPid()),
                uid: Number(Process.myUid()),
                threadId: Number(Thread.currentThread().getId()),
                threadName: String(Thread.currentThread().getName()),
                onMainThread: onMainThread()
            },
            moduleFiles: moduleStats(modulesDir),
            manifest: manifest(runtimeDir),
            endpoint: {
                present: ep.present,
                schemaVersion: ep.schemaVersion || null,
                transport: ep.transport || null,
                error: ep.error || null
            },
            status: statusRtt(androidContext, runtimeDir, ep),
            startupAssessment: null,
            database: dbProbe(dbFile),
            inProcess: inProcess(),
            memoryBefore: before,
            memoryAfter: null,
            memoryDelta: null,
            warnings: [],
            structuralOk: false
        };

        result.startupAssessment = assessStartup(result.status.last);
        result.memoryAfter = memory();
        result.memoryDelta =
            memoryDelta(result.memoryBefore, result.memoryAfter);
        result.finishedAt = now();
        result.durationMs =
            result.finishedAt - result.startedAt;
        result.warnings = warnings(result);

        result.structuralOk =
            (!result.manifest.present ||
                (result.manifest.sourceRef === EXPECTED_REF &&
                 result.manifest.moduleSetVersion === EXPECTED_SET)) &&
            (!result.database.available ||
                Number(result.database.userVersion) === 2) &&
            (result.database.regexFeatureSchema === null ||
                Number(result.database.regexFeatureSchema) === 1) &&
            (!result.status.available ||
                (result.status.last &&
                 String(result.status.last.sourceRef || "") ===
                    EXPECTED_REF &&
                 String(result.status.last.moduleSetVersion || "") ===
                    EXPECTED_SET));

        write(output, report(result));
        return result;
    }

    try {
        global.ClipHubComprehensivePerformanceProbe077Result = main();
    } catch (error) {
        var sxFatal = typeof shortx !== "undefined" ?
            shortx : global.shortx;
        var rootFatal = sxFatal &&
            typeof sxFatal.getShortXDir === "function" ?
            String(sxFatal.getShortXDir()) : "/data/local/tmp";
        var fatal = {
            probe: NAME,
            probeVersion: 2,
            structuralOk: false,
            error: errorText(error)
        };
        var fatalFile = new File(rootFatal,
            "ClipHub_beta-regex-settings-tabs_perf_probe_077_FATAL_" +
            stamp(now()) + ".txt");
        fatal.outputPath = String(fatalFile.getAbsolutePath());
        try {
            write(fatalFile,
                JSON.stringify(fatal, null, 2) + "\n");
        } catch (ignoredFatalWrite) {}
        global.ClipHubComprehensivePerformanceProbe077Result = fatal;
    }
}((function () { return this; }())));

JSON.stringify(ClipHubComprehensivePerformanceProbe077Result, null, 2);
