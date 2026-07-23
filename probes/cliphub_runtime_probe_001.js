/*
 * ClipHub 运行环境探测 001
 *
 * 目标：
 * 1. 验证 ShortX 运行目录读写能力；
 * 2. 验证当前模块加载器使用的 direct eval 作用域；
 * 3. 验证 IIFE + ClipHub 命名空间隔离；
 * 4. 验证 RandomAccessFile/FileChannel 文件锁的获取、阻塞和释放；
 * 5. 输出不包含剪贴板正文的 JSON 报告。
 *
 * Rhino ES5 only.
 */
(function (global) {
    var File = Packages.java.io.File;
    var FileInputStream = Packages.java.io.FileInputStream;
    var FileOutputStream = Packages.java.io.FileOutputStream;
    var InputStreamReader = Packages.java.io.InputStreamReader;
    var OutputStreamWriter = Packages.java.io.OutputStreamWriter;
    var BufferedReader = Packages.java.io.BufferedReader;
    var BufferedWriter = Packages.java.io.BufferedWriter;
    var StringBuilder = Packages.java.lang.StringBuilder;
    var RandomAccessFile = Packages.java.io.RandomAccessFile;
    var System = Packages.java.lang.System;
    var Thread = Packages.java.lang.Thread;
    var SimpleDateFormat = Packages.java.text.SimpleDateFormat;
    var Locale = Packages.java.util.Locale;

    function now() {
        return Number(System.currentTimeMillis());
    }

    function formatTimestamp(value) {
        return String(new SimpleDateFormat(
            "yyyyMMdd-HHmmss",
            Locale.US
        ).format(new Packages.java.util.Date(value)));
    }

    function className(error) {
        try {
            if (error && error.javaException) {
                return String(error.javaException.getClass().getName());
            }
            if (error && typeof error.getClass === "function") {
                return String(error.getClass().getName());
            }
        } catch (ignored) {}
        return "";
    }

    function errorText(error) {
        var name = className(error);
        var text;
        try {
            text = String(error);
        } catch (ignored) {
            text = "unknown error";
        }
        return name ? name + ": " + text : text;
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

    function deleteQuietly(file) {
        if (file !== null && file !== undefined && file.exists()) {
            try { return Boolean(file["delete"]()); } catch (ignored) {}
        }
        return true;
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

    function readUtf8(file) {
        var reader = null;
        var builder = new StringBuilder();
        var line;
        try {
            reader = new BufferedReader(new InputStreamReader(
                new FileInputStream(file),
                "UTF-8"
            ));
            while ((line = reader.readLine()) !== null) {
                builder.append(line).append("\n");
            }
            return String(builder.toString());
        } finally {
            closeQuietly(reader);
        }
    }

    function toJson(value, pretty) {
        try {
            return JSON.stringify(value, null, pretty ? 2 : 0);
        } catch (error) {
            return String(value);
        }
    }

    function getRuntimeInfo() {
        var info = {
            pid: null,
            uid: null,
            sdkInt: null,
            javaVersion: String(System.getProperty("java.version")),
            javaVmName: String(System.getProperty("java.vm.name")),
            threadId: Number(Thread.currentThread().getId()),
            threadName: String(Thread.currentThread().getName()),
            rhinoContextAvailable: false,
            rhinoLanguageVersion: null
        };
        try { info.pid = Number(Packages.android.os.Process.myPid()); } catch (ignored) {}
        try { info.uid = Number(Packages.android.os.Process.myUid()); } catch (ignored2) {}
        try { info.sdkInt = Number(Packages.android.os.Build.VERSION.SDK_INT); } catch (ignored3) {}
        try {
            var RhinoContext = Packages.org.mozilla.javascript.Context;
            var context = RhinoContext.getCurrentContext();
            info.rhinoContextAvailable = context !== null;
            if (context !== null) {
                info.rhinoLanguageVersion = Number(context.getLanguageVersion());
            }
        } catch (ignored4) {}
        return info;
    }

    function inspectDir(dir) {
        return {
            path: String(dir.getAbsolutePath()),
            exists: Boolean(dir.exists()),
            isDirectory: Boolean(dir.isDirectory()),
            canRead: Boolean(dir.canRead()),
            canWrite: Boolean(dir.canWrite())
        };
    }

    function runDirectoryProbe(rootDir) {
        var names = ["modules", "data", "logs", "cache", "probes"];
        var result = {
            ok: true,
            runtimeDir: inspectDir(rootDir),
            children: []
        };
        var index;
        var dir;
        for (index = 0; index < names.length; index += 1) {
            try {
                dir = ensureDir(new File(rootDir, names[index]));
                result.children.push(inspectDir(dir));
                if (!dir.canRead() || !dir.canWrite()) {
                    result.ok = false;
                }
            } catch (error) {
                result.ok = false;
                result.children.push({
                    name: names[index],
                    error: errorText(error)
                });
            }
        }
        return result;
    }

    function runFileIoProbe(probeDir, token) {
        var source = new File(probeDir, ".runtime_probe_write.tmp");
        var renamed = new File(probeDir, ".runtime_probe_rename.tmp");
        var payload = "ClipHub runtime probe\n" + token + "\n";
        var readBack = "";
        var renamedOk = false;
        var deletedSource = true;
        var deletedRenamed = true;
        var result = {
            ok: false,
            writeReadMatch: false,
            renameSucceeded: false,
            sourceDeleted: false,
            renamedDeleted: false,
            error: null
        };
        deleteQuietly(source);
        deleteQuietly(renamed);
        try {
            writeUtf8(source, payload);
            readBack = readUtf8(source);
            result.writeReadMatch = readBack === payload;
            renamedOk = Boolean(source.renameTo(renamed));
            result.renameSucceeded = renamedOk && renamed.isFile();
            result.ok = result.writeReadMatch && result.renameSucceeded;
        } catch (error) {
            result.error = errorText(error);
        } finally {
            deletedSource = deleteQuietly(source);
            deletedRenamed = deleteQuietly(renamed);
            result.sourceDeleted = deletedSource;
            result.renamedDeleted = deletedRenamed;
            if (!deletedSource || !deletedRenamed) {
                result.ok = false;
            }
        }
        return result;
    }

    function runEvalProbe(token) {
        var result = {
            ok: false,
            directVarVisibleInsideLoader: false,
            directVarLeakedToGlobal: false,
            namespaceVisibleGlobally: false,
            privateVarLeakedToGlobal: false,
            moduleEchoMatched: false,
            error: null
        };
        var source = [
            "var ClipHubProbeEvalLocal = " + JSON.stringify(token) + ";",
            "(function (global) {",
            "    var ClipHub = global.ClipHub || (global.ClipHub = {});",
            "    var privateValue = " + JSON.stringify("private-" + token) + ";",
            "    ClipHub.RuntimeProbeModule = {",
            "        MODULE_NAME: 'runtime_probe_module',",
            "        MODULE_VERSION: 1,",
            "        echo: function (value) { return String(value); },",
            "        privateValueLength: privateValue.length",
            "    };",
            "}((function () { return this; }())));"
        ].join("\n");

        try {
            eval(source);
            try {
                result.directVarVisibleInsideLoader =
                    ClipHubProbeEvalLocal === token;
            } catch (ignored) {}
            result.directVarLeakedToGlobal =
                typeof global.ClipHubProbeEvalLocal !== "undefined";
            result.namespaceVisibleGlobally =
                Boolean(global.ClipHub && global.ClipHub.RuntimeProbeModule);
            result.privateVarLeakedToGlobal =
                typeof global.privateValue !== "undefined";
            if (result.namespaceVisibleGlobally) {
                result.moduleEchoMatched =
                    global.ClipHub.RuntimeProbeModule.echo(token) === token;
            }
            result.ok =
                result.directVarVisibleInsideLoader &&
                !result.directVarLeakedToGlobal &&
                result.namespaceVisibleGlobally &&
                !result.privateVarLeakedToGlobal &&
                result.moduleEchoMatched;
        } catch (error) {
            result.error = errorText(error);
        } finally {
            try {
                if (global.ClipHub) {
                    delete global.ClipHub.RuntimeProbeModule;
                }
            } catch (ignored2) {}
            try { delete global.ClipHubProbeEvalLocal; } catch (ignored3) {}
            try { delete global.privateValue; } catch (ignored4) {}
        }
        return result;
    }

    function runFileLockProbe(dataDir) {
        var lockFile = new File(dataDir, "cliphub_runtime_probe.lock");
        var raf1 = null;
        var channel1 = null;
        var lock1 = null;
        var raf2 = null;
        var channel2 = null;
        var lock2 = null;
        var raf3 = null;
        var channel3 = null;
        var lock3 = null;
        var result = {
            ok: false,
            firstAcquire: false,
            secondAcquireWhileHeld: false,
            secondAttemptBlocked: false,
            secondAttemptMode: null,
            reacquireAfterRelease: false,
            lockFilePath: String(lockFile.getAbsolutePath()),
            error: null
        };

        try {
            raf1 = new RandomAccessFile(lockFile, "rw");
            channel1 = raf1.getChannel();
            lock1 = channel1.tryLock();
            result.firstAcquire = lock1 !== null;

            raf2 = new RandomAccessFile(lockFile, "rw");
            channel2 = raf2.getChannel();
            try {
                lock2 = channel2.tryLock();
                result.secondAcquireWhileHeld = lock2 !== null;
                result.secondAttemptBlocked = lock2 === null;
                result.secondAttemptMode =
                    lock2 === null ? "tryLock_returned_null" : "unexpected_acquire";
            } catch (secondError) {
                result.secondAttemptBlocked = true;
                result.secondAttemptMode =
                    "exception:" + errorText(secondError);
            }

            releaseQuietly(lock2);
            lock2 = null;
            closeQuietly(channel2);
            channel2 = null;
            closeQuietly(raf2);
            raf2 = null;

            releaseQuietly(lock1);
            lock1 = null;
            closeQuietly(channel1);
            channel1 = null;
            closeQuietly(raf1);
            raf1 = null;

            raf3 = new RandomAccessFile(lockFile, "rw");
            channel3 = raf3.getChannel();
            lock3 = channel3.tryLock();
            result.reacquireAfterRelease = lock3 !== null;

            result.ok =
                result.firstAcquire &&
                result.secondAttemptBlocked &&
                !result.secondAcquireWhileHeld &&
                result.reacquireAfterRelease;
        } catch (error) {
            result.error = errorText(error);
        } finally {
            releaseQuietly(lock3);
            releaseQuietly(lock2);
            releaseQuietly(lock1);
            closeQuietly(channel3);
            closeQuietly(raf3);
            closeQuietly(channel2);
            closeQuietly(raf2);
            closeQuietly(channel1);
            closeQuietly(raf1);
        }
        return result;
    }

    function main() {
        var startedAt = now();
        var timestamp = formatTimestamp(startedAt);
        var token = timestamp + "-" + String(startedAt);
        var shortxRoot;
        var runtimeDir;
        var dataDir;
        var probeDir;
        var report;
        var outputFile;
        var latestFile;

        if (typeof shortx === "undefined" ||
                typeof shortx.getShortXDir !== "function") {
            throw new Error("ShortX runtime is unavailable");
        }

        shortxRoot = String(shortx.getShortXDir());
        runtimeDir = ensureDir(new File(shortxRoot, "ClipHub"));
        dataDir = ensureDir(new File(runtimeDir, "data"));
        probeDir = ensureDir(new File(runtimeDir, "probes"));

        report = {
            ok: false,
            probe: "cliphub_runtime_probe_001",
            probeVersion: 1,
            startedAt: startedAt,
            finishedAt: null,
            durationMs: null,
            shortxRoot: shortxRoot,
            runtime: getRuntimeInfo(),
            directory: runDirectoryProbe(runtimeDir),
            fileIo: null,
            evalScope: null,
            fileLock: null,
            limitations: [
                "未验证两个独立 ShortX 任务同时竞争文件锁",
                "未验证进程被强制终止后的操作系统锁释放",
                "未加载仓库 src 目录中的真实模块"
            ],
            outputPath: null
        };

        report.fileIo = runFileIoProbe(probeDir, token);
        report.evalScope = runEvalProbe(token);
        report.fileLock = runFileLockProbe(dataDir);
        report.ok =
            report.directory.ok &&
            report.fileIo.ok &&
            report.evalScope.ok &&
            report.fileLock.ok;
        report.finishedAt = now();
        report.durationMs = report.finishedAt - startedAt;

        outputFile = new File(
            probeDir,
            "cliphub_runtime_probe_001_" + timestamp + ".json"
        );
        latestFile = new File(
            probeDir,
            "cliphub_runtime_probe_001_latest.json"
        );
        report.outputPath = String(outputFile.getAbsolutePath());

        writeUtf8(outputFile, toJson(report, true) + "\n");
        writeUtf8(latestFile, toJson(report, true) + "\n");

        return report;
    }

    try {
        global.ClipHubRuntimeProbe001Result = main();
    } catch (error) {
        global.ClipHubRuntimeProbe001Result = {
            ok: false,
            probe: "cliphub_runtime_probe_001",
            fatal: true,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubRuntimeProbe001Result);
