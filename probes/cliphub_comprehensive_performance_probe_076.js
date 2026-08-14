/* ClipHub comprehensive performance probe 076.
 * Target: beta-regex-settings-tabs-20260814 / 20260814.05.
 * Rhino ES5 only. Read-only for ClipHub runtime/database.
 * Only writes the final TXT report to shortx.getShortXDir().
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

    var NAME = "cliphub_comprehensive_performance_probe_076";
    var EXPECTED_REF = "beta-regex-settings-tabs-20260814";
    var EXPECTED_SET = "20260814.05";
    var TEXT_BUDGET = 786432;

    function now() { return Number(System.currentTimeMillis()); }
    function nano() { return Number(System.nanoTime()); }
    function ms(start) { return (nano() - start) / 1000000.0; }
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
    function err(error) {
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
        } finally { close(reader); }
    }
    function write(file, text) {
        var writer = null;
        try {
            writer = new BW(new OSW(new FOS(file, false), "UTF-8"));
            writer.write(String(text));
            writer.flush();
        } finally { close(writer); }
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
            return looper !== null && Build.VERSION.SDK_INT >= 23 ?
                looper.isCurrentThread() :
                (looper !== null && Number(looper.getThread().getId()) ===
                    Number(Thread.currentThread().getId()));
        } catch (ignored) { return false; }
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
        try { result.nativeAllocated = Number(Debug.getNativeHeapAllocatedSize()); }
        catch (ignoredNative) {}
        try {
            Debug.getMemoryInfo(info);
            result.totalPssKb = Number(info.getTotalPss());
        } catch (ignoredPss) {}
        try { result.threads = Number(Thread.getAllStackTraces().size()); }
        catch (ignoredThreads) {}
        return result;
    }
    function memDelta(a, b) {
        function d(key) {
            return a[key] === null || b[key] === null ? null :
                Number(b[key]) - Number(a[key]);
        }
        return {
            javaUsed: d("javaUsed"),
            javaTotal: d("javaTotal"),
            nativeAllocated: d("nativeAllocated"),
            totalPssKb: d("totalPssKb"),
            threads: d("threads")
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
            return { present: true, error: err(error) };
        }
    }
    function endpoint(runtimeDir) {
        var file = new File(new File(runtimeDir, "cache"),
            "control_endpoint.json");
        var data;
        if (!file.isFile()) { return { present: false, data: null }; }
        try {
            data = JSON.parse(read(file));
            if (!data || String(data.transport || "") !==
                    "dynamic_broadcast_token" ||
                    String(data.action || "").length < 1 ||
                    String(data.token || "").length < 1) {
                throw new Error("invalid control endpoint");
            }
            return { present: true, data: data,
                schemaVersion: Number(data.schemaVersion || 0),
                transport: String(data.transport || "") };
        } catch (error) {
            return { present: true, data: null, error: err(error) };
        }
    }
    function waitFile(file, timeoutMs) {
        var start = now();
        while (now() - start < timeoutMs) {
            if (file.isFile()) { return true; }
            Thread.sleep(5);
        }
        return file.isFile();
    }
    function statusRtt(androidContext, runtimeDir, ep) {
        var result = { available: false, skipped: false, reason: null,
            rttMs: null, last: null, error: null };
        var cacheDir = new File(runtimeDir, "cache");
        var appContext;
        var values = [];
        var index;
        var requestId;
        var ackFile;
        var intent;
        var start;
        var ack;
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
        try {
            for (index = 0; index < 7; index += 1) {
                requestId = "perf076_" + String(now()) + "_" + String(index);
                ackFile = new File(cacheDir,
                    "control_ack_" + requestId + ".json");
                if (ackFile.exists()) { ackFile.delete(); }
                intent = new Intent(String(ep.data.action));
                intent.putExtra("runtimeDir", String(runtimeDir.getAbsolutePath()));
                intent.putExtra("command", "status");
                intent.putExtra("requestId", requestId);
                intent.putExtra("controlToken", String(ep.data.token));
                start = nano();
                appContext.sendBroadcast(intent);
                if (!waitFile(ackFile, 2000)) {
                    throw new Error("status ack timeout");
                }
                ack = JSON.parse(read(ackFile));
                try { ackFile.delete(); } catch (ignoredDelete) {}
                if (!ack || ack.ok !== true) {
                    throw new Error("invalid status ack");
                }
                result.last = ack;
                if (index > 0) { values.push(round(ms(start))); }
            }
            result.available = true;
            result.rttMs = stats(values);
        } catch (error) {
            result.error = err(error);
            result.rttMs = stats(values);
        }
        return result;
    }
    function scalar(db, sql, fallback) {
        var cursor = null;
        try {
            cursor = db.rawQuery(String(sql), null);
            if (!cursor.moveToFirst() || cursor.isNull(0)) {
                return fallback;
            }
            return Number(cursor.getDouble(0));
        } catch (ignored) { return fallback; }
        finally { close(cursor); }
    }
    function scalarText(db, sql, fallback) {
        var cursor = null;
        try {
            cursor = db.rawQuery(String(sql), null);
            if (!cursor.moveToFirst() || cursor.isNull(0)) { return fallback; }
            return String(cursor.getString(0));
        } catch (ignored) { return fallback; }
        finally { close(cursor); }
    }
    function hasTable(db, name) {
        var cursor = null;
        try {
            cursor = db.rawQuery("SELECT 1 FROM sqlite_master " +
                "WHERE type='table' AND name='" +
                String(name).replace(/'/g, "''") + "' LIMIT 1", null);
            return cursor.moveToFirst();
        } finally { close(cursor); }
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
                        if (value !== null) { result.chars += String(value).length; }
                    } catch (ignoredCell) {}
                }
            }
            return result;
        } finally { close(cursor); }
    }
    function bench(db, name, sql, repeats) {
        var values = [];
        var index;
        var start;
        var consumed;
        consume(db, sql);
        for (index = 0; index < repeats; index += 1) {
            start = nano();
            consumed = consume(db, sql);
            values.push(round(ms(start)));
        }
        return { name: name, timingMs: stats(values), consumed: consumed };
    }
    function plan(db, sql) {
        var cursor = null;
        var output = [];
        try {
            cursor = db.rawQuery("EXPLAIN QUERY PLAN " + sql, null);
            while (cursor.moveToNext()) {
                output.push(String(cursor.getString(3)));
            }
        } catch (error) { output.push("ERROR: " + err(error)); }
        finally { close(cursor); }
        return output;
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
            db = SQLiteDatabase.openDatabase(String(dbFile.getAbsolutePath()),
                null, SQLiteDatabase.OPEN_READONLY);
            result.available = true;
            result.userVersion = scalar(db, "PRAGMA user_version", -1);
            result.pageCount = scalar(db, "PRAGMA page_count", -1);
            result.pageSize = scalar(db, "PRAGMA page_size", -1);
            result.freelistCount = scalar(db, "PRAGMA freelist_count", -1);
            result.journalMode = scalarText(db, "PRAGMA journal_mode", "unknown");
            result.activeItems = scalar(db,
                "SELECT COUNT(*) FROM clipboard_items WHERE deleted_at IS NULL", -1);
            result.totalItems = scalar(db, "SELECT COUNT(*) FROM clipboard_items", -1);
            cursor = db.rawQuery("SELECT COALESCE(MAX(LENGTH(content)),0)," +
                "COALESCE(AVG(LENGTH(content)),0),COALESCE(SUM(CASE WHEN " +
                "LENGTH(content)>" + String(TEXT_BUDGET) +
                " THEN 1 ELSE 0 END),0) FROM clipboard_items " +
                "WHERE deleted_at IS NULL", null);
            if (cursor.moveToFirst()) {
                result.maxContentChars = Number(cursor.getLong(0));
                result.avgContentChars = round(Number(cursor.getDouble(1)));
                result.oversizeItems = Number(cursor.getLong(2));
            }
            close(cursor);
            cursor = null;
            if (hasTable(db, "regex_rules")) {
                result.regexRules = scalar(db, "SELECT COUNT(*) FROM regex_rules", -1);
                result.regexEnabled = scalar(db,
                    "SELECT COUNT(*) FROM regex_rules WHERE enabled=1", -1);
                result.regexFeatureSchema = scalar(db,
                    "SELECT CAST(value AS INTEGER) FROM schema_meta WHERE " +
                    "key='feature.regex_rules.schema_version' LIMIT 1", 0);
            }
            result.benchmarks.push(bench(db, "home_preview100", homeSql, 10));
            result.benchmarks.push(bench(db, "regex_candidate128", regexSql, 5));
            result.plans.home_preview100 = plan(db, homeSql);
            result.plans.regex_candidate128 = plan(db, regexSql);
            if (result.regexRules !== null) {
                result.benchmarks.push(bench(db, "regex_rule_list", rulesSql, 10));
                result.plans.regex_rule_list = plan(db, rulesSql);
            }
            result.regexMicro = regexMicro(db);
        } catch (error) {
            result.error = err(error);
        } finally {
            close(cursor);
            close(db);
        }
        return result;
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
        var result = { available: false, rules: 0, texts: 0, operations: 0,
            compileMs: null, matchTotalMs: null, usPerOp: null,
            matched: 0, compileErrors: 0, error: null };
        var cursor = null;
        var rules = [];
        var texts = [];
        var compiled = [];
        var compileTimes = [];
        var index;
        var textIndex;
        var start;
        var p;
        try {
            if (!hasTable(db, "regex_rules")) { return result; }
            cursor = db.rawQuery("SELECT id,pattern,flags FROM regex_rules " +
                "WHERE enabled=1 ORDER BY manual_order ASC,id ASC LIMIT 32", null);
            while (cursor.moveToNext()) {
                rules.push({ id: Number(cursor.getLong(0)),
                    pattern: String(cursor.getString(1)),
                    flags: Number(cursor.getLong(2)) });
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
                start = nano();
                try {
                    p = Pattern.compile(rules[index].pattern,
                        javaFlags(rules[index].flags));
                    compileTimes.push(round(ms(start)));
                    compiled.push(p);
                } catch (ignoredCompile) { result.compileErrors += 1; }
            }
            start = nano();
            for (index = 0; index < compiled.length; index += 1) {
                for (textIndex = 0; textIndex < texts.length; textIndex += 1) {
                    result.operations += 1;
                    if (compiled[index].matcher(texts[textIndex]).find()) {
                        result.matched += 1;
                    }
                }
            }
            result.matchTotalMs = round(ms(start));
            result.rules = rules.length;
            result.texts = texts.length;
            result.compileMs = stats(compileTimes);
            result.usPerOp = result.operations > 0 ?
                round(result.matchTotalMs * 1000 / result.operations) : 0;
            result.available = true;
        } catch (error) { result.error = err(error); }
        finally { close(cursor); }
        return result;
    }
    function inProcess() {
        var C = global.ClipHub;
        var result = { available: false, filter: null, settings: null,
            hydrationWorker: null, scrollPerformance: null,
            filterStateReadMs: null, error: null };
        var getter;
        var values = [];
        var index;
        var start;
        if (!C) { return result; }
        try {
            result.available = true;
            if (C.Filter) {
                getter = typeof C.Filter.getPanelState === "function" ?
                    C.Filter.getPanelState : C.Filter.getState;
                if (typeof getter === "function") {
                    result.filter = getter.call(C.Filter);
                    for (index = 0; index < 100; index += 1) {
                        start = nano();
                        getter.call(C.Filter);
                        values.push(round(ms(start)));
                    }
                    result.filterStateReadMs = stats(values);
                }
                if (typeof C.Filter.getHydrationWorkerState === "function") {
                    result.hydrationWorker = C.Filter.getHydrationWorkerState();
                }
                if (typeof C.Filter.getScrollPerformanceState === "function") {
                    result.scrollPerformance = C.Filter.getScrollPerformanceState();
                }
            }
            if (C.Settings && typeof C.Settings.getState === "function") {
                result.settings = C.Settings.getState();
            }
        } catch (error) { result.error = err(error); }
        return result;
    }
    function findBench(db, name) {
        var index;
        for (index = 0; index < db.benchmarks.length; index += 1) {
            if (String(db.benchmarks[index].name) === name) {
                return db.benchmarks[index];
            }
        }
        return null;
    }
    function warnings(result) {
        var out = [];
        var home = findBench(result.database, "home_preview100");
        var regex = findBench(result.database, "regex_candidate128");
        var startup = result.status.last && result.status.last.status ?
            result.status.last.status.startupPerformance : null;
        function add(condition, text) { if (condition) { out.push(text); } }
        add(result.manifest.present && result.manifest.sourceRef !== EXPECTED_REF,
            "manifest sourceRef 与目标分支不一致");
        add(result.manifest.present && result.manifest.moduleSetVersion !== EXPECTED_SET,
            "manifest moduleSetVersion 不是 20260814.05");
        add(result.status.available && result.status.last &&
            String(result.status.last.sourceRef || "") !== EXPECTED_REF,
            "当前运行实例 sourceRef 不是目标分支");
        add(result.status.available && result.status.last &&
            String(result.status.last.moduleSetVersion || "") !== EXPECTED_SET,
            "当前运行实例 moduleSetVersion 不是 20260814.05");
        add(result.database.available && Number(result.database.userVersion) !== 2,
            "数据库 user_version 不是 2");
        add(result.database.regexFeatureSchema !== null &&
            Number(result.database.regexFeatureSchema) !== 1,
            "Regex feature schema 不是 1");
        add(Number(result.database.oversizeItems || 0) > 0,
            "存在超过 786432 字符的活动项，Regex 扫描会走 oversize skip 路径");
        add(result.status.rttMs && Number(result.status.rttMs.p95 || 0) > 100,
            "status 往返 p95 > 100ms");
        add(home && Number(home.timingMs.p95 || 0) > 30,
            "首页 100 条/200 字预览查询 p95 > 30ms");
        add(regex && Number(regex.timingMs.p95 || 0) > 100,
            "Regex 128 条完整正文候选查询 p95 > 100ms");
        add(startup && startup.showToFirstBatchMs !== null &&
            Number(startup.showToFirstBatchMs || 0) > 350,
            "showToFirstBatchMs > 350ms");
        add(startup && startup.showToFullRenderMs !== null &&
            Number(startup.showToFullRenderMs || 0) > 900,
            "showToFullRenderMs > 900ms");
        add(result.database.regexMicro && result.database.regexMicro.available &&
            Number(result.database.regexMicro.usPerOp || 0) > 500,
            "Regex 样本 matcher.find() > 500us/op");
        if (result.status.skipped) {
            out.push("status RTT 已跳过：" + String(result.status.reason));
        }
        if (result.status.error) { out.push("status RTT 错误：" + result.status.error); }
        if (result.database.error) { out.push("SQLite 探针错误：" + result.database.error); }
        return out;
    }
    function report(result) {
        var lines = [];
        var index;
        var b;
        var startup = result.status.last && result.status.last.status ?
            result.status.last.status.startupPerformance : null;
        lines.push("ClipHub beta-regex-settings-tabs 综合性能探针 076");
        lines.push("================================================");
        lines.push("生成时间=" + new Date(result.startedAt).toString());
        lines.push("output=" + result.outputPath);
        lines.push("durationMs=" + result.durationMs);
        lines.push("");
        lines.push("[环境]");
        lines.push("SDK=" + result.environment.sdkInt +
            " device=" + result.environment.manufacturer + " " +
            result.environment.model);
        lines.push("pid=" + result.environment.pid + " uid=" +
            result.environment.uid + " thread=" + result.environment.threadName +
            " main=" + result.environment.onMainThread);
        lines.push("moduleFiles=" + result.moduleFiles.count +
            " moduleBytes=" + result.moduleFiles.bytes);
        lines.push("");
        lines.push("[分支/运行版本]");
        lines.push("manifestRef=" + String(result.manifest.sourceRef || "") +
            " manifestSet=" + String(result.manifest.moduleSetVersion || ""));
        lines.push("controlEndpoint=" + String(result.endpoint.present) +
            " schema=" + String(result.endpoint.schemaVersion || "") +
            " transport=" + String(result.endpoint.transport || ""));
        if (result.status.last) {
            lines.push("runningRef=" + String(result.status.last.sourceRef || "") +
                " runningSet=" + String(result.status.last.moduleSetVersion || ""));
        }
        lines.push("");
        lines.push("[正式实例 status RTT]");
        lines.push(JSON.stringify(result.status.rttMs));
        lines.push("");
        lines.push("[最近一次 Filter 启动性能]");
        lines.push(JSON.stringify(startup));
        lines.push("");
        lines.push("[SQLite / 数据规模]");
        lines.push("available=" + result.database.available +
            " userVersion=" + result.database.userVersion +
            " regexFeatureSchema=" + result.database.regexFeatureSchema);
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
        for (index = 0; index < result.database.benchmarks.length; index += 1) {
            b = result.database.benchmarks[index];
            lines.push(b.name + " avg=" + b.timingMs.avg +
                " p50=" + b.timingMs.p50 + " p95=" + b.timingMs.p95 +
                " max=" + b.timingMs.max + "ms rows=" + b.consumed.rows +
                " chars=" + b.consumed.chars);
        }
        lines.push("homePlan=" + JSON.stringify(result.database.plans.home_preview100 || []));
        lines.push("regexPlan=" + JSON.stringify(result.database.plans.regex_candidate128 || []));
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
        lines.push("说明：Regex 样本只输出数量/耗时，不输出剪贴板正文。");
        lines.push("说明：阈值仅用于发现明显回退，不把单次性能数值当作绝对 PASS/FAIL。");
        lines.push("");
        lines.push("[RAW_JSON]");
        lines.push(JSON.stringify(result, null, 2));
        return lines.join("\n") + "\n";
    }
    function main() {
        var started = now();
        var sx = typeof shortx !== "undefined" ? shortx : global.shortx;
        var root;
        var runtimeDir;
        var modules;
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
        modules = new File(runtimeDir, "modules");
        dbFile = new File(new File(runtimeDir, "data"), "cliphub.db");
        ep = endpoint(runtimeDir);
        output = new File(root,
            "ClipHub_beta-regex-settings-tabs_perf_probe_076_" +
            stamp(started) + ".txt");
        result = {
            probe: NAME,
            probeVersion: 1,
            targetRef: EXPECTED_REF,
            targetModuleSet: EXPECTED_SET,
            startedAt: started,
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
            moduleFiles: moduleStats(modules),
            manifest: manifest(runtimeDir),
            endpoint: { present: ep.present,
                schemaVersion: ep.schemaVersion || null,
                transport: ep.transport || null,
                error: ep.error || null },
            status: statusRtt(androidContext, runtimeDir, ep),
            database: dbProbe(dbFile),
            inProcess: inProcess(),
            memoryBefore: before,
            memoryAfter: null,
            memoryDelta: null,
            warnings: [],
            structuralOk: false
        };
        result.memoryAfter = memory();
        result.memoryDelta = memDelta(result.memoryBefore, result.memoryAfter);
        result.finishedAt = now();
        result.durationMs = result.finishedAt - result.startedAt;
        result.warnings = warnings(result);
        result.structuralOk =
            (!result.manifest.present ||
                (result.manifest.sourceRef === EXPECTED_REF &&
                 result.manifest.moduleSetVersion === EXPECTED_SET)) &&
            (!result.database.available || Number(result.database.userVersion) === 2) &&
            (result.database.regexFeatureSchema === null ||
                Number(result.database.regexFeatureSchema) === 1) &&
            (!result.status.available ||
                (result.status.last &&
                 String(result.status.last.sourceRef || "") === EXPECTED_REF &&
                 String(result.status.last.moduleSetVersion || "") === EXPECTED_SET));
        write(output, report(result));
        return result;
    }

    try {
        global.ClipHubComprehensivePerformanceProbe076Result = main();
    } catch (error) {
        var sxFatal = typeof shortx !== "undefined" ? shortx : global.shortx;
        var rootFatal = sxFatal && typeof sxFatal.getShortXDir === "function" ?
            String(sxFatal.getShortXDir()) : "/data/local/tmp";
        var fatal = { probe: NAME, probeVersion: 1, structuralOk: false,
            error: err(error) };
        var fatalFile = new File(rootFatal,
            "ClipHub_beta-regex-settings-tabs_perf_probe_076_FATAL_" +
            stamp(now()) + ".txt");
        fatal.outputPath = String(fatalFile.getAbsolutePath());
        try { write(fatalFile, JSON.stringify(fatal, null, 2) + "\n"); }
        catch (ignoredFatalWrite) {}
        global.ClipHubComprehensivePerformanceProbe076Result = fatal;
    }
}((function () { return this; }())));

JSON.stringify(ClipHubComprehensivePerformanceProbe076Result, null, 2);
