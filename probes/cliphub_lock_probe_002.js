/*
 * ClipHub 并发文件锁探测 002
 *
 * 使用方法：
 * 1. 在 ShortX 中建立两个独立 JS 任务，内容均为本文件完整代码；
 * 2. 先运行任务 A；
 * 3. 在 12 秒内运行任务 B；
 * 4. A 应返回 role=holder，B 应返回 role=contender 且 blocked=true。
 *
 * 注意：脚本会阻塞当前任务线程最多 12 秒，但始终在 finally 中释放锁。
 * Rhino ES5 only.
 */
(function (global) {
    var File = Packages.java.io.File;
    var FileOutputStream = Packages.java.io.FileOutputStream;
    var OutputStreamWriter = Packages.java.io.OutputStreamWriter;
    var BufferedWriter = Packages.java.io.BufferedWriter;
    var RandomAccessFile = Packages.java.io.RandomAccessFile;
    var System = Packages.java.lang.System;
    var Thread = Packages.java.lang.Thread;
    var SimpleDateFormat = Packages.java.text.SimpleDateFormat;
    var Locale = Packages.java.util.Locale;
    var HOLD_MS = 12000;

    function now() {
        return Number(System.currentTimeMillis());
    }

    function formatTimestamp(value) {
        return String(new SimpleDateFormat(
            "yyyyMMdd-HHmmss-SSS",
            Locale.US
        ).format(new Packages.java.util.Date(value)));
    }

    function errorText(error) {
        var text;
        try { text = String(error); } catch (ignored) { text = "unknown error"; }
        try {
            if (error && error.javaException) {
                return String(error.javaException.getClass().getName()) +
                    ": " + text;
            }
        } catch (ignored2) {}
        return text;
    }

    function isExpectedLockConflict(text) {
        return String(text).indexOf("OverlappingFileLockException") >= 0;
    }

    function ensureDir(dir) {
        if (!dir.exists() && !dir.mkdirs() && !dir.isDirectory()) {
            throw new Error("Cannot create directory: " + dir.getAbsolutePath());
        }
        if (!dir.isDirectory()) {
            throw new Error("Not a directory: " + dir.getAbsolutePath());
        }
        return dir;
    }

    function closeQuietly(value) {
        if (value !== null && value !== undefined) {
            try { value.close(); } catch (ignored) {}
        }
    }

    function releaseQuietly(value) {
        if (value !== null && value !== undefined) {
            try { value.release(); } catch (ignored) {}
        }
    }

    function writeUtf8(file, text) {
        var writer = null;
        try {
            writer = new BufferedWriter(new OutputStreamWriter(
                new FileOutputStream(file, false),
                "UTF-8"
            ));
            writer.write(String(text));
            writer.flush();
        } finally {
            closeQuietly(writer);
        }
    }

    function toJson(value, pretty) {
        try {
            return JSON.stringify(value, null, pretty ? 2 : 0);
        } catch (error) {
            return String(value);
        }
    }

    function main() {
        var startedAt = now();
        var shortxRoot;
        var runtimeDir;
        var dataDir;
        var probeDir;
        var lockFile;
        var raf = null;
        var channel = null;
        var lock = null;
        var lockErrorText;
        var result = {
            ok: false,
            probe: "cliphub_lock_probe_002",
            probeVersion: 2,
            startedAt: startedAt,
            finishedAt: null,
            durationMs: null,
            pid: null,
            uid: null,
            threadId: Number(Thread.currentThread().getId()),
            threadName: String(Thread.currentThread().getName()),
            role: null,
            acquired: false,
            blocked: false,
            blockMode: null,
            lockDetail: null,
            holdMs: HOLD_MS,
            lockFilePath: null,
            outputPath: null,
            error: null
        };
        var outputFile;

        if (typeof shortx === "undefined" ||
                typeof shortx.getShortXDir !== "function") {
            throw new Error("ShortX runtime is unavailable");
        }

        try { result.pid = Number(Packages.android.os.Process.myPid()); } catch (ignored) {}
        try { result.uid = Number(Packages.android.os.Process.myUid()); } catch (ignored2) {}

        shortxRoot = String(shortx.getShortXDir());
        runtimeDir = ensureDir(new File(shortxRoot, "ClipHub"));
        dataDir = ensureDir(new File(runtimeDir, "data"));
        probeDir = ensureDir(new File(runtimeDir, "probes"));
        lockFile = new File(dataDir, "cliphub_concurrency_probe.lock");
        result.lockFilePath = String(lockFile.getAbsolutePath());

        try {
            raf = new RandomAccessFile(lockFile, "rw");
            channel = raf.getChannel();
            try {
                lock = channel.tryLock();
            } catch (lockError) {
                lockErrorText = errorText(lockError);
                if (!isExpectedLockConflict(lockErrorText)) {
                    throw lockError;
                }
                result.blocked = true;
                result.role = "contender";
                result.blockMode = "overlapping_exception";
                result.lockDetail = lockErrorText;
                result.ok = true;
            }

            if (lock === null && result.role === null) {
                result.blocked = true;
                result.role = "contender";
                result.blockMode = "try_lock_null";
                result.ok = true;
            } else if (lock !== null) {
                result.acquired = true;
                result.role = "holder";
                result.blockMode = "acquired";
                Thread.sleep(HOLD_MS);
                result.ok = true;
            }
        } finally {
            releaseQuietly(lock);
            closeQuietly(channel);
            closeQuietly(raf);
        }

        result.finishedAt = now();
        result.durationMs = result.finishedAt - result.startedAt;
        outputFile = new File(
            probeDir,
            "cliphub_lock_probe_002_" +
                formatTimestamp(result.startedAt) + "_" +
                String(result.threadId) + ".json"
        );
        result.outputPath = String(outputFile.getAbsolutePath());
        writeUtf8(outputFile, toJson(result, true) + "\n");
        return result;
    }

    try {
        global.ClipHubLockProbe002Result = main();
    } catch (error) {
        global.ClipHubLockProbe002Result = {
            ok: false,
            probe: "cliphub_lock_probe_002",
            probeVersion: 2,
            fatal: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubLockProbe002Result);
