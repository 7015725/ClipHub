// ClipHub - ShortX 入口文件
// Android 14 / Rhino ES5 / WindowManager
// beta 阶段 1：运行骨架、统一视觉组件、首页列表视觉基线

var CLIPHUB_ENTRY_VERSION = 202607220110;
var CLIPHUB_MODULE_SET_VERSION = "20260722.2";
var CLIPHUB_UPDATE_BRANCH = "beta";
var CLIPHUB_BOOT_COMMAND = "toggle"; // show | close | toggle | status

var CLIPHUB_MODULES = [
    "ch_01_base.js",
    "ch_02_log.js",
    "ch_07_theme.js",
    "ch_08_icons.js",
    "ch_09_components.js",
    "ch_10_window.js",
    "ch_11_router.js",
    "ch_12_home.js"
];

var CH = {
    bootstrap: {
        entryVersion: CLIPHUB_ENTRY_VERSION,
        moduleSetVersion: CLIPHUB_MODULE_SET_VERSION,
        branch: CLIPHUB_UPDATE_BRANCH,
        modules: CLIPHUB_MODULES,
        rootDir: "",
        codeDir: "",
        sourceRoot: ""
    }
};

function clipHubCloseQuietly(resource) {
    try {
        if (resource) resource.close();
    } catch (eClose) {}
}

function clipHubGetShortXDir() {
    if (typeof shortx === "undefined" || !shortx) {
        throw new Error("shortx 未注入");
    }
    if (typeof shortx.getShortXDir !== "function") {
        throw new Error("shortx.getShortXDir 不可用");
    }
    var base = String(shortx.getShortXDir() || "");
    if (!base) {
        throw new Error("shortx.getShortXDir 返回空路径");
    }
    return base;
}

function clipHubEnsureDir(path) {
    var dir = new java.io.File(String(path));
    if (dir.exists()) {
        if (!dir.isDirectory()) {
            throw new Error("路径不是目录: " + path);
        }
        return dir;
    }
    if (!dir.mkdirs() && !dir.isDirectory()) {
        throw new Error("无法创建目录: " + path);
    }
    return dir;
}

function clipHubReadUtf8(file) {
    var input = null;
    var reader = null;
    try {
        input = new java.io.FileInputStream(file);
        reader = new java.io.BufferedReader(new java.io.InputStreamReader(input, "UTF-8"));
        var builder = new java.lang.StringBuilder();
        var line = null;
        while ((line = reader.readLine()) !== null) {
            builder.append(line).append("\n");
        }
        var text = String(builder.toString());
        if (text.length > 0 && text.charCodeAt(0) === 65279) {
            text = text.substring(1);
        }
        return text;
    } finally {
        clipHubCloseQuietly(reader);
        clipHubCloseQuietly(input);
    }
}

function clipHubWriteUtf8Atomic(file, content) {
    var parent = file.getParentFile();
    if (parent) {
        clipHubEnsureDir(parent.getAbsolutePath());
    }
    var tmp = new java.io.File(file.getAbsolutePath() + ".tmp");
    var backup = new java.io.File(file.getAbsolutePath() + ".bak");
    var out = null;
    try {
        if (tmp.exists() && !tmp.delete()) {
            throw new Error("无法清理临时文件: " + tmp.getAbsolutePath());
        }
        out = new java.io.FileOutputStream(tmp, false);
        out.write(new java.lang.String(String(content)).getBytes("UTF-8"));
        out.flush();
        try {
            out.getFD().sync();
        } catch (eSync) {}
        clipHubCloseQuietly(out);
        out = null;

        if (backup.exists() && !backup.delete()) {
            throw new Error("无法清理备份文件: " + backup.getAbsolutePath());
        }
        if (file.exists() && !file.renameTo(backup)) {
            throw new Error("无法备份旧文件: " + file.getAbsolutePath());
        }
        if (!tmp.renameTo(file)) {
            if (!file.exists() && backup.exists()) {
                backup.renameTo(file);
            }
            throw new Error("无法安装新文件: " + file.getAbsolutePath());
        }
        if (backup.exists()) {
            backup.delete();
        }
    } finally {
        clipHubCloseQuietly(out);
        try {
            if (tmp.exists()) tmp.delete();
        } catch (eTmp) {}
    }
}

function clipHubDownloadUtf8(urlText) {
    var connection = null;
    var input = null;
    var reader = null;
    try {
        var url = new java.net.URL(String(urlText));
        connection = url.openConnection();
        connection.setUseCaches(false);
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(20000);
        try {
            connection.setRequestProperty("User-Agent", "ClipHub-ShortX/" + CLIPHUB_ENTRY_VERSION);
        } catch (eHeader) {}
        connection.connect();
        input = connection.getInputStream();
        reader = new java.io.BufferedReader(new java.io.InputStreamReader(input, "UTF-8"));
        var builder = new java.lang.StringBuilder();
        var line = null;
        var total = 0;
        while ((line = reader.readLine()) !== null) {
            total += line.length() + 1;
            if (total > 1024 * 1024) {
                throw new Error("模块文件超过 1 MiB");
            }
            builder.append(line).append("\n");
        }
        var text = String(builder.toString());
        if (text.length > 0 && text.charCodeAt(0) === 65279) {
            text = text.substring(1);
        }
        if (!text) {
            throw new Error("下载结果为空");
        }
        return text;
    } finally {
        clipHubCloseQuietly(reader);
        clipHubCloseQuietly(input);
        try {
            if (connection && connection.disconnect) connection.disconnect();
        } catch (eDisconnect) {}
    }
}

function clipHubAllModulesExist(codeDir) {
    var i = 0;
    for (i = 0; i < CLIPHUB_MODULES.length; i++) {
        var file = new java.io.File(codeDir, CLIPHUB_MODULES[i]);
        if (!file.exists() || !file.isFile() || file.length() <= 0) {
            return false;
        }
    }
    return true;
}

function clipHubSyncModules(rootDir, codeDir) {
    var marker = new java.io.File(rootDir, "module_set_version.txt");
    var installedVersion = "";
    try {
        if (marker.exists()) {
            installedVersion = String(clipHubReadUtf8(marker)).replace(/^\s+|\s+$/g, "");
        }
    } catch (eMarkerRead) {
        installedVersion = "";
    }

    if (installedVersion === CLIPHUB_MODULE_SET_VERSION && clipHubAllModulesExist(codeDir)) {
        return { updated: false, fallback: false };
    }

    var downloaded = [];
    var i = 0;
    try {
        for (i = 0; i < CLIPHUB_MODULES.length; i++) {
            var moduleName = CLIPHUB_MODULES[i];
            var sourceUrl = CH.bootstrap.sourceRoot + "src/" + moduleName +
                "?_cliphub_v=" + encodeURIComponent(CLIPHUB_MODULE_SET_VERSION);
            var source = clipHubDownloadUtf8(sourceUrl);
            if (source.indexOf("(function (CH)") < 0 && source.indexOf("(function(CH)") < 0) {
                throw new Error("模块包装校验失败: " + moduleName);
            }
            downloaded.push({ name: moduleName, source: source });
        }

        for (i = 0; i < downloaded.length; i++) {
            clipHubWriteUtf8Atomic(
                new java.io.File(codeDir, downloaded[i].name),
                downloaded[i].source
            );
        }
        clipHubWriteUtf8Atomic(marker, CLIPHUB_MODULE_SET_VERSION + "\n");
        return { updated: true, fallback: false };
    } catch (eUpdate) {
        if (clipHubAllModulesExist(codeDir)) {
            return { updated: false, fallback: true, error: String(eUpdate) };
        }
        throw eUpdate;
    }
}

function clipHubLoadModules(codeDir) {
    var i = 0;
    for (i = 0; i < CLIPHUB_MODULES.length; i++) {
        var moduleName = CLIPHUB_MODULES[i];
        var moduleFile = new java.io.File(codeDir, moduleName);
        var source = clipHubReadUtf8(moduleFile);
        try {
            eval(source + "\n//# sourceURL=ClipHub/" + moduleName);
        } catch (eEval) {
            throw new Error("加载模块失败 " + moduleName + ": " + String(eEval));
        }
    }
}

function clipHubResolveCommand() {
    var commandText = CLIPHUB_BOOT_COMMAND;
    try {
        if (typeof CLIPHUB_COMMAND !== "undefined" && CLIPHUB_COMMAND != null) {
            commandText = String(CLIPHUB_COMMAND);
        } else if (typeof command !== "undefined" && command != null) {
            commandText = String(command);
        }
    } catch (eCommand) {}
    commandText = String(commandText || "toggle").replace(/^\s+|\s+$/g, "").toLowerCase();
    if (commandText !== "show" && commandText !== "close" &&
        commandText !== "toggle" && commandText !== "status") {
        commandText = "toggle";
    }
    return commandText;
}

function clipHubBootstrap() {
    var shortXDir = clipHubGetShortXDir();
    var rootPath = shortXDir + "/ClipHub-Beta";
    var codePath = rootPath + "/code";
    var rootDir = clipHubEnsureDir(rootPath);
    var codeDir = clipHubEnsureDir(codePath);

    CH.bootstrap.rootDir = rootDir.getAbsolutePath();
    CH.bootstrap.codeDir = codeDir.getAbsolutePath();
    CH.bootstrap.sourceRoot = "https://raw.githubusercontent.com/7015725/ClipHub/" +
        CLIPHUB_UPDATE_BRANCH + "/";

    var syncResult = clipHubSyncModules(rootDir, codeDir);
    CH.bootstrap.syncResult = syncResult;
    clipHubLoadModules(codeDir);

    if (!CH.app || typeof CH.app.dispatch !== "function") {
        throw new Error("ClipHub 应用模块未正确初始化");
    }

    return CH.app.dispatch(clipHubResolveCommand());
}

var CLIPHUB_RESULT = null;
try {
    CLIPHUB_RESULT = clipHubBootstrap();
} catch (eClipHub) {
    CLIPHUB_RESULT = {
        ok: false,
        project: "ClipHub",
        branch: CLIPHUB_UPDATE_BRANCH,
        entryVersion: CLIPHUB_ENTRY_VERSION,
        error: String(eClipHub)
    };
}

JSON.stringify(CLIPHUB_RESULT);
