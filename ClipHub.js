/*
 * ShortX 任务名称：ClipHub 剪贴板后台
 * 作用：启动并维持 ClipHub 后台实例，负责模块同步、完整性校验、
 * 数据库初始化和系统剪贴板监听；默认不显示悬浮窗。
 * 显示或隐藏悬浮窗请使用“ClipHub 剪贴板开关”任务。
 * 运行环境：Rhino ES5。
 */
(function (global) {
    var File = Packages.java.io.File;
    var FIS = Packages.java.io.FileInputStream;
    var FOS = Packages.java.io.FileOutputStream;
    var BAOS = Packages.java.io.ByteArrayOutputStream;
    var ReflectArray = Packages.java.lang.reflect.Array;
    var JavaByte = Packages.java.lang.Byte;
    var JavaString = Packages.java.lang.String;
    var URL = Packages.java.net.URL;
    var URLEncoder = Packages.java.net.URLEncoder;
    var MessageDigest = Packages.java.security.MessageDigest;
    var System = Packages.java.lang.System;
    var ENTRY_VERSION = 8;
    var OWNER = "7015725";
    var REPO = "ClipHub";
    var DEFAULT_REF = "refactor/navigation-contract-v2-20260818";
    var MANIFEST_PATH = "module-manifest.json";
    var LEGACY_MODULE_EXPORTS = {
        "ch_01_base.js": "Base",
        "ch_02_log.js": "Log",
        "ch_03_database.js": "Database",
        "ch_04_clipboard.js": "Clipboard",
        "ch_05_classifier.js": "Classifier",
        "ch_06_repository.js": "Repository",
        "ch_07_theme.js": "Theme",
        "ch_08_window.js": "Window",
        "ch_09_list.js": "List",
        "ch_10_editor.js": "Editor",
        "ch_11_filter.js": "Filter",
        "ch_12_translation.js": "Translation",
        "ch_13_settings.js": "Settings",
        "ch_14_event_bus.js": "EventBus",
        "ch_15_app.js": "App",
        "ch_16_ui_shell.js": "UIShell",
        "ch_17_tokenizer_ui.js": "TokenizerUI"
    };
    var LEGACY_MODULE_ROLES = {
        "ch_01_base.js": "base",
        "ch_05_classifier.js": "passive",
        "ch_15_app.js": "app",
        "ch_17_tokenizer_ui.js": "passive"
    };
    var LEGACY_LIFECYCLE_INDEX = {
        "ch_02_log.js": 1,
        "ch_03_database.js": 2,
        "ch_06_repository.js": 3,
        "ch_14_event_bus.js": 4,
        "ch_07_theme.js": 5,
        "ch_04_clipboard.js": 6,
        "ch_08_window.js": 7,
        "ch_09_list.js": 8,
        "ch_10_editor.js": 9,
        "ch_11_filter.js": 10,
        "ch_13_settings.js": 11,
        "ch_12_translation.js": 12,
        "ch_16_ui_shell.js": 13
    };

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

    function ensureDir(dir) {
        if (!dir.exists() && !dir.mkdirs() && !dir.isDirectory()) {
            throw new Error("Cannot create directory: " + dir.getAbsolutePath());
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
        try {
            stream = new FOS(file, false);
            stream.write(new JavaString(String(text)).getBytes("UTF-8"));
            stream.flush();
        } finally { closeQuietly(stream); }
    }

    function writeAtomic(file, text) {
        var parent = ensureDir(file.getParentFile());
        var temp = new File(parent, file.getName() + ".tmp");
        writeUtf8(temp, text);
        if (file.exists() && !file.delete()) {
            temp.delete();
            throw new Error("Cannot replace: " + file.getAbsolutePath());
        }
        if (!temp.renameTo(file)) {
            temp.delete();
            throw new Error("Cannot commit: " + file.getAbsolutePath());
        }
    }

    function removeTree(file) {
        var children;
        var index;
        var ok = true;
        if (!file.exists()) { return true; }
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

    function encodeSegment(value) {
        return String(URLEncoder.encode(String(value), "UTF-8"))
            .replace(/\+/g, "%20");
    }

    function encodePath(path) {
        var parts = String(path).split("/");
        var result = [];
        var index;
        for (index = 0; index < parts.length; index += 1) {
            result.push(encodeSegment(parts[index]));
        }
        return result.join("/");
    }

    function rawUrl(path, ref) {
        return "https://raw.githubusercontent.com/" + OWNER + "/" + REPO +
            "/" + encodeSegment(ref) + "/" + encodePath(path) +
            "?cliphub=" + ENTRY_VERSION + "-" + Number(System.currentTimeMillis());
    }

    function fetchRawFile(path, ref) {
        var connection = null;
        var code;
        var bytes;
        var response;
        try {
            connection = new URL(rawUrl(path, ref)).openConnection();
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(20000);
            connection.setUseCaches(false);
            connection.setRequestProperty("Accept", "text/plain, */*");
            connection.setRequestProperty("Accept-Encoding", "identity");
            connection.setRequestProperty("Cache-Control", "no-cache");
            connection.setRequestProperty("Pragma", "no-cache");
            connection.setRequestProperty(
                "User-Agent", "ClipHub-ShortX/" + ENTRY_VERSION
            );
            code = Number(connection.getResponseCode());
            bytes = readBytes(code >= 200 && code < 300
                ? connection.getInputStream() : connection.getErrorStream());
            response = String(new JavaString(bytes, "UTF-8"));
            if (code < 200 || code >= 300) {
                throw new Error(
                    "Raw GitHub HTTP " + code + " for " + path + ": " +
                    response.substring(0, 400)
                );
            }
            return { text: response, transport: "raw" };
        } finally {
            if (connection !== null) {
                try { connection.disconnect(); } catch (ignored) {}
            }
        }
    }

    var remoteTransportState = {
        rawSuppressed: false,
        usedRaw: false,
        usedApi: false,
        lastRawError: "",
        lastApiError: ""
    };

    function apiUrl(path, ref) {
        return "https://api.github.com/repos/" + OWNER + "/" + REPO +
            "/contents/" + encodePath(path) +
            "?ref=" + encodeSegment(ref) +
            "&cliphub=" + ENTRY_VERSION + "-" +
            Number(System.currentTimeMillis());
    }

    function fetchApiFile(path, ref) {
        var connection = null;
        var code;
        var bytes;
        var response;
        try {
            connection = new URL(apiUrl(path, ref)).openConnection();
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(20000);
            connection.setUseCaches(false);
            connection.setRequestProperty(
                "Accept", "application/vnd.github.raw+json"
            );
            connection.setRequestProperty("Accept-Encoding", "identity");
            connection.setRequestProperty("Cache-Control", "no-cache");
            connection.setRequestProperty("Pragma", "no-cache");
            connection.setRequestProperty(
                "X-GitHub-Api-Version", "2022-11-28"
            );
            connection.setRequestProperty(
                "User-Agent", "ClipHub-ShortX/" + ENTRY_VERSION
            );
            code = Number(connection.getResponseCode());
            bytes = readBytes(code >= 200 && code < 300
                ? connection.getInputStream() : connection.getErrorStream());
            response = String(new JavaString(bytes, "UTF-8"));
            if (code < 200 || code >= 300) {
                throw new Error(
                    "GitHub API HTTP " + code + " for " + path + ": " +
                    response.substring(0, 400)
                );
            }
            return { text: response, transport: "github-api" };
        } finally {
            if (connection !== null) {
                try { connection.disconnect(); } catch (ignored) {}
            }
        }
    }

    function remoteTransportLabel() {
        if (remoteTransportState.usedRaw && remoteTransportState.usedApi) {
            return "raw+github-api";
        }
        if (remoteTransportState.usedApi) { return "github-api"; }
        if (remoteTransportState.usedRaw) { return "raw"; }
        return "none";
    }

    function fetchRemoteFile(path, ref) {
        var result;
        var rawError = null;
        var apiError = null;
        if (!remoteTransportState.rawSuppressed) {
            try {
                result = fetchRawFile(path, ref);
                remoteTransportState.usedRaw = true;
                return result;
            } catch (error) {
                rawError = error;
                remoteTransportState.rawSuppressed = true;
                remoteTransportState.lastRawError = errorText(error);
            }
        }
        try {
            result = fetchApiFile(path, ref);
            remoteTransportState.usedApi = true;
            return result;
        } catch (error) {
            apiError = error;
            remoteTransportState.lastApiError = errorText(error);
        }
        throw new Error(
            "ClipHub remote fetch failed for " + path +
            "; raw=" + String(remoteTransportState.lastRawError ||
                (rawError === null ? "suppressed" : errorText(rawError))) +
            "; api=" + String(remoteTransportState.lastApiError ||
                (apiError === null ? "unknown" : errorText(apiError)))
        );
    }

    function gitBlobSha(text) {
        var content = new JavaString(String(text)).getBytes("UTF-8");
        var prefix = new JavaString(
            "blob " + String(content.length) + "\u0000"
        ).getBytes("UTF-8");
        var digest = MessageDigest.getInstance("SHA-1");
        var bytes;
        var parts = [];
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
            parts.push(hex.length === 1 ? "0" + hex : hex);
        }
        return parts.join("");
    }

    function validateSafeName(value) {
        return /^[A-Za-z0-9._-]+$/.test(String(value || "")) &&
            String(value) !== "." && String(value) !== ".." &&
            String(value).indexOf("/") < 0;
    }

    function validateIdentifier(value) {
        return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(String(value || ""));
    }

    function validatePackagePath(path, requiredRoot, requiredSuffix) {
        var value = String(path || "");
        if (value.length === 0 || value.charAt(0) === "/" ||
                value.indexOf("../") >= 0 || value.indexOf("/..") >= 0 ||
                value === ".." || value.indexOf("//") >= 0) {
            return false;
        }
        if (String(requiredRoot || "") &&
                value.indexOf(String(requiredRoot) + "/") !== 0) {
            return false;
        }
        if (requiredSuffix !== null && requiredSuffix !== undefined &&
                value.lastIndexOf(String(requiredSuffix)) !==
                value.length - String(requiredSuffix).length) {
            return false;
        }
        return true;
    }

    function cloneDescriptor(item) {
        var output = {};
        var key;
        for (key in item) {
            if (item.hasOwnProperty(key)) { output[key] = item[key]; }
        }
        return output;
    }

    function validateModuleDescriptor(item, index, map) {
        var name;
        var role;
        if (!item) { throw new Error("Invalid manifest module at index " + index); }
        name = String(item.name || "");
        role = String(item.runtimeRole || "");
        if (!/^ch_[0-9][0-9]_[A-Za-z0-9_]+\.js$/.test(name) ||
                !validateSafeName(name) || map[name]) {
            throw new Error("Invalid manifest module name at index " + index);
        }
        if (String(item.path) !== "src/" + name ||
                !validatePackagePath(item.path, "src", ".js")) {
            throw new Error("Invalid manifest module path: " + name);
        }
        if (!/^[0-9a-f]{40}$/.test(String(item.sha || ""))) {
            throw new Error("Invalid manifest module SHA: " + name);
        }
        if (!validateIdentifier(item.export)) {
            throw new Error("Invalid manifest module export: " + name);
        }
        if (role !== "base" && role !== "managed" && role !== "passive" &&
                role !== "app") {
            throw new Error("Invalid manifest runtime role: " + name);
        }
        if (role === "managed" && Number(item.lifecycleIndex || 0) <= 0) {
            throw new Error("Missing lifecycle index: " + name);
        }
        map[name] = item;
    }

    function validateResourceDescriptor(item, index, map) {
        var id;
        var encoding;
        var loadPolicy;
        if (!item) { throw new Error("Invalid manifest resource at index " + index); }
        id = String(item.id || "");
        encoding = String(item.encoding || "");
        loadPolicy = String(item.loadPolicy || "");
        if (!id || map[id]) {
            throw new Error("Invalid manifest resource id at index " + index);
        }
        if (!validatePackagePath(item.path, "assets", null)) {
            throw new Error("Invalid manifest resource path: " + id);
        }
        if (!/^[0-9a-f]{40}$/.test(String(item.sha || ""))) {
            throw new Error("Invalid manifest resource SHA: " + id);
        }
        if (encoding !== "utf-8" && encoding !== "gzip+base64") {
            throw new Error("Invalid manifest resource encoding: " + id);
        }
        if (loadPolicy !== "on_demand") {
            throw new Error("Invalid manifest resource loadPolicy: " + id);
        }
        map[id] = item;
    }

    function sortRuntimePlan(plan) {
        plan.sort(function (left, right) {
            var leftRole = String(left.runtimeRole || "");
            var rightRole = String(right.runtimeRole || "");
            var leftIndex = leftRole === "managed" ? Number(left.lifecycleIndex || 0) :
                (leftRole === "base" ? -1000 : 1000);
            var rightIndex = rightRole === "managed" ? Number(right.lifecycleIndex || 0) :
                (rightRole === "base" ? -1000 : 1000);
            if (leftIndex !== rightIndex) { return leftIndex - rightIndex; }
            return String(left.name).localeCompare(String(right.name));
        });
        return plan;
    }

    function buildManifestIndexes(manifest) {
        var moduleMap = {};
        var resourceMap = {};
        var runtimePlan = [];
        var baseCount = 0;
        var appCount = 0;
        var lifecycleMap = {};
        var index;
        var item;
        manifest.resources = manifest.resources || [];
        for (index = 0; index < manifest.modules.length; index += 1) {
            item = manifest.modules[index];
            validateModuleDescriptor(item, index, moduleMap);
            if (String(item.runtimeRole) === "base") { baseCount += 1; }
            if (String(item.runtimeRole) === "app") { appCount += 1; }
            if (String(item.runtimeRole) === "managed") {
                if (lifecycleMap[String(item.lifecycleIndex)]) {
                    throw new Error("Duplicate lifecycle index: " + item.lifecycleIndex);
                }
                lifecycleMap[String(item.lifecycleIndex)] = true;
            }
            runtimePlan.push(cloneDescriptor(item));
        }
        if (baseCount !== 1 || appCount !== 1) {
            throw new Error("Manifest must contain exactly one base and one app module");
        }
        for (index = 0; index < manifest.resources.length; index += 1) {
            validateResourceDescriptor(manifest.resources[index], index, resourceMap);
        }
        manifest.moduleMap = moduleMap;
        manifest.resourceMap = resourceMap;
        manifest.runtimePlan = sortRuntimePlan(runtimePlan);
        return manifest;
    }

    function applyLegacyRuntimeDescriptor(item) {
        var name = String(item.name || "");
        var role = LEGACY_MODULE_ROLES[name] || "managed";
        item.export = LEGACY_MODULE_EXPORTS[name] || "";
        item.runtimeRole = role;
        if (role === "managed") {
            item.lifecycleIndex = Number(LEGACY_LIFECYCLE_INDEX[name] || 0);
        }
        return item;
    }

    function parseManifestV2Strict(text, expectedRef) {
        var manifest = JSON.parse(String(text));
        if (Number(manifest.schemaVersion) !== 2 ||
                !manifest.moduleSetVersion || !manifest.modules) {
            throw new Error("Invalid ClipHub module manifest");
        }
        if (Number(manifest.entryMinVersion) !== 8) {
            throw new Error("Invalid ClipHub manifest entry version");
        }
        if (Number(manifest.entryMinVersion) > ENTRY_VERSION) {
            throw new Error("ClipHub entry must be updated");
        }
        if (manifest.sourceRef !== undefined && expectedRef !== undefined &&
                String(manifest.sourceRef) !== String(expectedRef)) {
            throw new Error("Manifest ref mismatch: " + manifest.sourceRef +
                " != " + expectedRef);
        }
        return buildManifestIndexes(manifest);
    }

    function parseManifestV1LocalCache(text, expectedRef) {
        var manifest = JSON.parse(String(text));
        var index;
        var item;
        var modules;
        if (Number(manifest.schemaVersion) !== 1 ||
                !manifest.moduleSetVersion || !manifest.modules) {
            throw new Error("Invalid legacy ClipHub local manifest");
        }
        if (manifest.sourceRef !== undefined && expectedRef !== undefined &&
                String(manifest.sourceRef) !== String(expectedRef)) {
            throw new Error("Legacy manifest ref mismatch: " + manifest.sourceRef +
                " != " + expectedRef);
        }
        modules = [];
        for (index = 0; index < manifest.modules.length; index += 1) {
            item = cloneDescriptor(manifest.modules[index]);
            modules.push(applyLegacyRuntimeDescriptor(item));
        }
        return buildManifestIndexes({
            schemaVersion: 2,
            legacySchemaVersion: 1,
            moduleSetVersion: String(manifest.moduleSetVersion),
            entryMinVersion: 8,
            sourceRef: String(manifest.sourceRef || expectedRef || ""),
            modules: modules,
            resources: []
        });
    }

    function parseRemoteManifest(text, expectedRef) {
        return parseManifestV2Strict(text, expectedRef);
    }

    function parseLocalManifest(text, expectedRef) {
        try { return parseManifestV2Strict(text, expectedRef); }
        catch (v2Error) { return parseManifestV1LocalCache(text, expectedRef); }
    }

    function manifestText(manifest) {
        return JSON.stringify(manifest, function (key, value) {
            return key === "moduleMap" || key === "resourceMap" ||
                key === "runtimePlan" || key === "legacySchemaVersion"
                ? undefined : value;
        }, 2) + "\n";
    }

    function verifyModules(moduleDir, manifest) {
        var index;
        var item;
        var file;
        if (!moduleDir.isDirectory() || !manifest || !manifest.modules) {
            return false;
        }
        for (index = 0; index < manifest.modules.length; index += 1) {
            item = manifest.modules[index];
            file = new File(moduleDir, String(item.name));
            if (!file.isFile() || gitBlobSha(readUtf8(file)) !== String(item.sha)) {
                return false;
            }
        }
        return true;
    }

    function verifyResources(resourceDir, manifest) {
        var index;
        var item;
        var file;
        var resources = manifest && manifest.resources ? manifest.resources : [];
        for (index = 0; index < resources.length; index += 1) {
            item = resources[index];
            file = new File(resourceDir, String(item.path));
            if (!file.isFile() || gitBlobSha(readUtf8(file)) !== String(item.sha)) {
                return false;
            }
        }
        return true;
    }

    function readLocalManifest(file, ref) {
        try {
            return file.isFile() ? parseLocalManifest(readUtf8(file), ref) : null;
        } catch (ignored) { return null; }
    }

    function writeStageFile(root, relativePath, text) {
        var file = new File(root, String(relativePath));
        ensureDir(file.getParentFile());
        writeUtf8(file, text);
    }

    function installPackage(ref, moduleDir, resourceDir, localManifestFile,
            remoteManifest, previousManifestText) {
        var parent = ensureDir(moduleDir.getParentFile());
        var moduleStage = new File(parent, "modules.stage");
        var moduleBackup = new File(parent, "modules.backup");
        var resourceStage = new File(parent, "resources.stage");
        var resourceBackup = new File(parent, "resources.backup");
        var index;
        var item;
        var remote;
        var movedModules = false;
        var movedResources = false;
        var activatedModules = false;
        var activatedResources = false;
        removeTree(moduleStage);
        removeTree(moduleBackup);
        removeTree(resourceStage);
        removeTree(resourceBackup);
        ensureDir(moduleStage);
        ensureDir(resourceStage);
        try {
            for (index = 0; index < remoteManifest.modules.length; index += 1) {
                item = remoteManifest.modules[index];
                remote = fetchRemoteFile(String(item.path), ref);
                if (gitBlobSha(remote.text) !== String(item.sha)) {
                    throw new Error("Module integrity mismatch: " + item.name);
                }
                writeStageFile(moduleStage, String(item.name), remote.text);
            }
            for (index = 0; index < remoteManifest.resources.length; index += 1) {
                item = remoteManifest.resources[index];
                remote = fetchRemoteFile(String(item.path), ref);
                if (gitBlobSha(remote.text) !== String(item.sha)) {
                    throw new Error("Resource integrity mismatch: " + item.id);
                }
                writeStageFile(resourceStage, String(item.path), remote.text);
            }
            if (!verifyModules(moduleStage, remoteManifest)) {
                throw new Error("Downloaded module set verification failed");
            }
            if (!verifyResources(resourceStage, remoteManifest)) {
                throw new Error("Downloaded resource set verification failed");
            }
            if (moduleDir.exists()) {
                if (!moduleDir.renameTo(moduleBackup)) {
                    throw new Error("Cannot back up current modules");
                }
                movedModules = true;
            }
            if (resourceDir.exists()) {
                if (!resourceDir.renameTo(resourceBackup)) {
                    throw new Error("Cannot back up current resources");
                }
                movedResources = true;
            }
            if (!moduleStage.renameTo(moduleDir)) {
                throw new Error("Cannot activate downloaded modules");
            }
            activatedModules = true;
            if (!resourceStage.renameTo(resourceDir)) {
                throw new Error("Cannot activate downloaded resources");
            }
            activatedResources = true;
            writeAtomic(localManifestFile, manifestText(remoteManifest));
            return {
                updated: true,
                downloadedCount: remoteManifest.modules.length,
                downloadedResourceCount: remoteManifest.resources.length,
                modulesBackup: moduleBackup,
                resourcesBackup: resourceBackup,
                previousManifestText: previousManifestText,
                manifest: remoteManifest,
                transport: remoteTransportLabel()
            };
        } catch (error) {
            removeTree(moduleStage);
            removeTree(resourceStage);
            if (activatedModules) { removeTree(moduleDir); }
            if (activatedResources) { removeTree(resourceDir); }
            if (movedModules && moduleBackup.exists()) { moduleBackup.renameTo(moduleDir); }
            if (movedResources && resourceBackup.exists()) { resourceBackup.renameTo(resourceDir); }
            if (previousManifestText === null) {
                if (localManifestFile.exists()) { localManifestFile.delete(); }
            } else {
                try { writeAtomic(localManifestFile, previousManifestText); }
                catch (ignored) {}
            }
            throw error;
        }
    }

    function syncPackage(ref, moduleDir, resourceDir, localManifestFile) {
        var previousText = localManifestFile.isFile()
            ? readUtf8(localManifestFile) : null;
        var localManifest = readLocalManifest(localManifestFile, ref);
        var remoteManifest;
        var remoteFile;
        var installed;
        try {
            remoteFile = fetchRemoteFile(MANIFEST_PATH, ref);
            remoteManifest = parseRemoteManifest(remoteFile.text, ref);
        } catch (remoteError) {
            if (localManifest && verifyModules(moduleDir, localManifest) &&
                    verifyResources(resourceDir, localManifest)) {
                return {
                    updated: false,
                    downloadedCount: 0,
                    downloadedResourceCount: 0,
                    remoteAvailable: false,
                    fallback: true,
                    moduleSetVersion: String(localManifest.moduleSetVersion),
                    manifest: localManifest,
                    transport: "offline-cache",
                    warning: errorText(remoteError)
                };
            }
            throw remoteError;
        }
        if (verifyModules(moduleDir, remoteManifest) &&
                verifyResources(resourceDir, remoteManifest)) {
            writeAtomic(localManifestFile, manifestText(remoteManifest));
            return {
                updated: false,
                downloadedCount: 0,
                downloadedResourceCount: 0,
                remoteAvailable: true,
                fallback: false,
                moduleSetVersion: String(remoteManifest.moduleSetVersion),
                manifest: remoteManifest,
                transport: remoteTransportLabel(),
                warning: null
            };
        }
        try {
            installed = installPackage(ref, moduleDir, resourceDir, localManifestFile,
                remoteManifest, previousText);
        } catch (installError) {
            if (localManifest && verifyModules(moduleDir, localManifest) &&
                    verifyResources(resourceDir, localManifest)) {
                return {
                    updated: false,
                    downloadedCount: 0,
                    downloadedResourceCount: 0,
                    remoteAvailable: true,
                    fallback: true,
                    moduleSetVersion: String(localManifest.moduleSetVersion),
                    manifest: localManifest,
                    transport: "offline-cache",
                    warning: errorText(installError)
                };
            }
            throw installError;
        }
        installed.remoteAvailable = true;
        installed.fallback = false;
        installed.transport = remoteTransportLabel();
        installed.moduleSetVersion = String(remoteManifest.moduleSetVersion);
        installed.warning = null;
        return installed;
    }

    function rollbackSync(moduleDir, resourceDir, localManifestFile, sync) {
        if (!sync || !sync.updated) { return; }
        removeTree(moduleDir);
        removeTree(resourceDir);
        if (sync.modulesBackup && sync.modulesBackup.exists()) {
            sync.modulesBackup.renameTo(moduleDir);
        }
        if (sync.resourcesBackup && sync.resourcesBackup.exists()) {
            sync.resourcesBackup.renameTo(resourceDir);
        }
        if (sync.previousManifestText === null) {
            if (localManifestFile.exists()) { localManifestFile.delete(); }
        } else {
            writeAtomic(localManifestFile, sync.previousManifestText);
        }
    }

    function commitSync(sync) {
        if (sync && sync.modulesBackup) { removeTree(sync.modulesBackup); }
        if (sync && sync.resourcesBackup) { removeTree(sync.resourcesBackup); }
    }

    function loadModules(moduleDir, manifest) {
        var index;
        var file;
        var item;
        global.ClipHub = {};
        for (index = 0; index < manifest.modules.length; index += 1) {
            item = manifest.modules[index];
            file = new File(moduleDir, String(item.name));
            if (!file.isFile()) {
                throw new Error("Missing module: " + file.getAbsolutePath());
            }
            eval(readUtf8(file));
        }
    }

    function buildResourceRuntimeMap(resourceDir, manifest) {
        var output = {};
        var resources = manifest && manifest.resources ? manifest.resources : [];
        var index;
        var item;
        var copy;
        for (index = 0; index < resources.length; index += 1) {
            item = resources[index];
            copy = cloneDescriptor(item);
            copy.runtimePath = String(new File(resourceDir, String(item.path)).getAbsolutePath());
            output[String(item.id)] = copy;
        }
        return output;
    }

    function start() {
        var options = global.ClipHubBootstrapOptions || {};
        var root;
        var runtimeName;
        var runtimeDir;
        var moduleDir;
        var resourceDir;
        var cacheDir;
        var localManifestFile;
        var ref;
        var sync = null;
        var app;
        var interruptedModuleBackup;
        var interruptedResourceBackup;
        var resourceMap;

        if (global.ClipHub && global.ClipHub.App &&
                typeof global.ClipHub.App.isStarted === "function" &&
                global.ClipHub.App.isStarted()) {
            return {
                ok: true,
                started: true,
                entryVersion: ENTRY_VERSION,
                reused: true,
                sync: null,
                app: { ok: true, started: true, reused: true }
            };
        }
        if (typeof shortx === "undefined" ||
                typeof shortx.getShortXDir !== "function") {
            throw new Error("ShortX runtime is unavailable");
        }
        root = String(shortx.getShortXDir());
        runtimeName = options.runtimeName === undefined
            ? "ClipHub" : String(options.runtimeName);
        if (!/^[A-Za-z0-9._-]+$/.test(runtimeName) ||
                runtimeName === "." || runtimeName === "..") {
            throw new Error("Invalid runtime name: " + runtimeName);
        }
        ref = options.remoteRef === undefined
            ? DEFAULT_REF : String(options.remoteRef);
        runtimeDir = ensureDir(new File(root, runtimeName));
        moduleDir = options.moduleDir === undefined
            ? new File(runtimeDir, "modules")
            : new File(String(options.moduleDir));
        resourceDir = options.resourceDir === undefined
            ? new File(runtimeDir, "resources")
            : new File(String(options.resourceDir));
        cacheDir = ensureDir(new File(runtimeDir, "cache"));
        localManifestFile = new File(cacheDir, "module-manifest.local.json");
        ensureDir(moduleDir.getParentFile());
        ensureDir(resourceDir.getParentFile());
        if (!moduleDir.exists()) {
            interruptedModuleBackup = new File(
                moduleDir.getParentFile(), "modules.backup"
            );
            if (interruptedModuleBackup.isDirectory()) {
                interruptedModuleBackup.renameTo(moduleDir);
            }
        }
        if (!resourceDir.exists()) {
            interruptedResourceBackup = new File(
                resourceDir.getParentFile(), "resources.backup"
            );
            if (interruptedResourceBackup.isDirectory()) {
                interruptedResourceBackup.renameTo(resourceDir);
            }
        }
        try {
            sync = syncPackage(ref, moduleDir, resourceDir, localManifestFile);
            loadModules(moduleDir, sync.manifest);
            resourceMap = buildResourceRuntimeMap(resourceDir, sync.manifest);
            app = global.ClipHub.App.start({
                shortxRoot: root,
                runtimeDir: String(runtimeDir.getAbsolutePath()),
                moduleDir: String(moduleDir.getAbsolutePath()),
                resourceDir: String(resourceDir.getAbsolutePath()),
                resourceMap: resourceMap,
                runtimePlan: sync.manifest.runtimePlan,
                moduleMap: sync.manifest.moduleMap,
                androidContext: global.context,
                entryVersion: ENTRY_VERSION,
                moduleSetVersion: String(sync.moduleSetVersion || ""),
                sourceRef: ref
            });
            commitSync(sync);
            return {
                ok: !!app.ok,
                started: !!app.started,
                entryVersion: ENTRY_VERSION,
                reused: false,
                sync: {
                    updated: !!sync.updated,
                    downloadedCount: Number(sync.downloadedCount || 0),
                    downloadedResourceCount: Number(sync.downloadedResourceCount || 0),
                    remoteAvailable: sync.remoteAvailable !== false,
                    fallback: !!sync.fallback,
                    moduleSetVersion: String(sync.moduleSetVersion || ""),
                    sourceRef: ref,
                    transport: String(sync.transport || "raw"),
                    warning: sync.warning === undefined ? null : sync.warning
                },
                app: app
            };
        } catch (error) {
            try { rollbackSync(moduleDir, resourceDir, localManifestFile, sync); }
            catch (ignored) {}
            throw error;
        }
    }

    try {
        global.ClipHubBootstrapResult = start();
    } catch (error) {
        global.ClipHubBootstrapResult = {
            ok: false,
            started: false,
            entryVersion: ENTRY_VERSION,
            error: errorText(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubBootstrapResult);
