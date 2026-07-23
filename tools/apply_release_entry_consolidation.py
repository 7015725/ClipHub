#!/usr/bin/env python3
"""Consolidate ClipHub into one background entry and one UI toggle task."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENTRY = ROOT / "ClipHub.js"
APP = ROOT / "src" / "ch_15_app.js"
TOGGLE = ROOT / "tasks" / "ClipHub_全局剪贴板开关.js"
OPEN_TASK = ROOT / "tasks" / "ClipHub_打开全局剪贴板.js"
MANIFEST = ROOT / "module-manifest.json"

TARGET_SET = "20260723.10"
PREPARE_REF = "agent/initialize-project-skeleton"
ENTRY_VERSION = 5
APP_VERSION = 9
ENDPOINT_SCHEMA = 3


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one marker, found {count}")
    return text.replace(old, new, 1)


def git_blob_sha(text: str) -> str:
    raw = text.encode("utf-8")
    return hashlib.sha1(b"blob " + str(len(raw)).encode("ascii") + b"\0" + raw).hexdigest()


def patch_entry() -> bool:
    original = ENTRY.read_text(encoding="utf-8")
    text = original
    text = replace_once(
        text,
        "    var ENTRY_VERSION = 4;",
        "    var ENTRY_VERSION = 5;",
        "entry version",
    )
    old = '''            app = global.ClipHub.App.start({
                shortxRoot: root,
                runtimeDir: String(runtimeDir.getAbsolutePath()),
                moduleDir: String(moduleDir.getAbsolutePath())
            });'''
    new = '''            app = global.ClipHub.App.start({
                shortxRoot: root,
                runtimeDir: String(runtimeDir.getAbsolutePath()),
                moduleDir: String(moduleDir.getAbsolutePath()),
                androidContext: global.context,
                entryVersion: ENTRY_VERSION,
                moduleSetVersion: String(sync.moduleSetVersion || ""),
                sourceRef: ref
            });'''
    text = replace_once(text, old, new, "App.start release metadata")
    if text == original:
        return False
    ENTRY.write_text(text, encoding="utf-8")
    return True


def patch_app() -> tuple[bool, str]:
    original = APP.read_text(encoding="utf-8")
    text = original
    text = replace_once(
        text,
        '    var CONTROL_ACTION_BASE = "com.cliphub.runtime.CONTROL";\n'
        '    var CONTROL_COMMANDS = ["show", "hide", "toggle", "status", "stop"];',
        '    var CONTROL_ACTION_BASE = "com.cliphub.runtime.CONTROL";\n'
        '    var CONTROL_ENDPOINT_SCHEMA = 3;\n'
        '    var CONTROL_COMMANDS = ["show", "hide", "toggle", "status", "stop"];',
        "control endpoint schema constant",
    )
    text = replace_once(
        text,
        '''        controlAction: "",
        controlToken: "",
        controlEndpointFile: null''',
        '''        controlAction: "",
        controlToken: "",
        controlEndpointFile: null,
        entryVersion: 0,
        moduleSetVersion: "",
        sourceRef: ""''',
        "control metadata state",
    )
    text = replace_once(
        text,
        '''        writeUtf8(file, JSON.stringify({
            schemaVersion: 2,
            transport: "dynamic_broadcast_token",
            action: String(action),
            token: String(token),
            runtimeDir: String(context.runtimeDir),
            commands: CONTROL_COMMANDS,
            createdAt: ClipHub.Base.now()
        }, null, 2) + "\\n");''',
        '''        writeUtf8(file, JSON.stringify({
            schemaVersion: CONTROL_ENDPOINT_SCHEMA,
            transport: "dynamic_broadcast_token",
            action: String(action),
            token: String(token),
            runtimeDir: String(context.runtimeDir),
            entryVersion: Number(state.entryVersion || 0),
            moduleSetVersion: String(state.moduleSetVersion || ""),
            sourceRef: String(state.sourceRef || ""),
            commands: CONTROL_COMMANDS,
            createdAt: ClipHub.Base.now()
        }, null, 2) + "\\n");''',
        "endpoint payload",
    )
    text = replace_once(
        text,
        '''                    response.runtimeDir = runtimeDir;
                    response.transport = "dynamic_broadcast_token";
                    response.threadId = Number(callbackThread.getId());''',
        '''                    response.runtimeDir = runtimeDir;
                    response.transport = "dynamic_broadcast_token";
                    response.endpointSchemaVersion = CONTROL_ENDPOINT_SCHEMA;
                    response.entryVersion = Number(state.entryVersion || 0);
                    response.moduleSetVersion = String(state.moduleSetVersion || "");
                    response.sourceRef = String(state.sourceRef || "");
                    response.threadId = Number(callbackThread.getId());''',
        "control acknowledgement metadata",
    )
    text = replace_once(
        text,
        '''            state.context = context;
            try {
                ClipHub.Base.init(context);''',
        '''            state.context = context;
            state.entryVersion = Number(context && context.entryVersion || 0);
            state.moduleSetVersion = String(
                context && context.moduleSetVersion || "");
            state.sourceRef = String(context && context.sourceRef || "");
            try {
                ClipHub.Base.init(context);''',
        "start metadata assignment",
    )
    text = replace_once(
        text,
        '''                    moduleCount: order.length + 1,
                    controlTransport: "dynamic_broadcast_token",
                    controlCommands: CONTROL_COMMANDS,
                    controlEndpointPath: String(''',
        '''                    moduleCount: order.length + 1,
                    entryVersion: Number(state.entryVersion || 0),
                    moduleSetVersion: String(state.moduleSetVersion || ""),
                    sourceRef: String(state.sourceRef || ""),
                    controlTransport: "dynamic_broadcast_token",
                    controlEndpointSchemaVersion: CONTROL_ENDPOINT_SCHEMA,
                    controlCommands: CONTROL_COMMANDS,
                    controlEndpointPath: String(''',
        "start result metadata",
    )
    text = replace_once(
        text,
        '''                state.context = null;
                state.started = false;
                throw error;''',
        '''                state.context = null;
                state.entryVersion = 0;
                state.moduleSetVersion = "";
                state.sourceRef = "";
                state.started = false;
                throw error;''',
        "failed start metadata cleanup",
    )
    text = replace_once(
        text,
        '''            state.context = null;
            state.started = false;
            return {''',
        '''            state.context = null;
            state.entryVersion = 0;
            state.moduleSetVersion = "";
            state.sourceRef = "";
            state.started = false;
            return {''',
        "stop metadata cleanup",
    )
    text = replace_once(
        text,
        '''        MODULE_NAME: "ch_15_app",
        MODULE_VERSION: 8,
        CONTROL_ACTION_BASE: CONTROL_ACTION_BASE,
        CONTROL_COMMANDS: CONTROL_COMMANDS,''',
        '''        MODULE_NAME: "ch_15_app",
        MODULE_VERSION: 9,
        CONTROL_ACTION_BASE: CONTROL_ACTION_BASE,
        CONTROL_ENDPOINT_SCHEMA: CONTROL_ENDPOINT_SCHEMA,
        CONTROL_COMMANDS: CONTROL_COMMANDS,''',
        "app module version",
    )
    text = replace_once(
        text,
        '''        getControlCommands: function () {
            return CONTROL_COMMANDS.slice(0);
        },
        getControlEndpointPath: function () {''',
        '''        getControlCommands: function () {
            return CONTROL_COMMANDS.slice(0);
        },
        getControlMetadata: function () {
            return {
                endpointSchemaVersion: CONTROL_ENDPOINT_SCHEMA,
                entryVersion: Number(state.entryVersion || 0),
                moduleSetVersion: String(state.moduleSetVersion || ""),
                sourceRef: String(state.sourceRef || "")
            };
        },
        getControlEndpointPath: function () {''',
        "control metadata API",
    )
    if text == original:
        return False, git_blob_sha(text)
    APP.write_text(text, encoding="utf-8")
    return True, git_blob_sha(text)


TOGGLE_SOURCE = r'''/* ClipHub global clipboard toggle task. Rhino ES5 only. */
(function (global) {
    var File = Packages.java.io.File;
    var FIS = Packages.java.io.FileInputStream;
    var ISR = Packages.java.io.InputStreamReader;
    var BR = Packages.java.io.BufferedReader;
    var SB = Packages.java.lang.StringBuilder;
    var Thread = Packages.java.lang.Thread;
    var System = Packages.java.lang.System;
    var RAF = Packages.java.io.RandomAccessFile;
    var Intent = Packages.android.content.Intent;
    var TASK_VERSION = 3;
    var REQUIRED_ENDPOINT_SCHEMA = 3;
    var MIN_ENTRY_VERSION = 5;

    function now() { return Number(System.currentTimeMillis()); }

    function close(value) {
        if (value !== null && value !== undefined) {
            try { value.close(); } catch (ignored) {}
        }
    }

    function read(file) {
        var reader = null;
        var builder = new SB();
        var line;
        try {
            reader = new BR(new ISR(new FIS(file), "UTF-8"));
            while ((line = reader.readLine()) !== null) {
                builder.append(line).append("\n");
            }
            return String(builder.toString());
        } finally { close(reader); }
    }

    function ensureDir(file) {
        if (!file.exists() && !file.mkdirs() && !file.isDirectory()) {
            throw new Error("Cannot create directory: " + file.getAbsolutePath());
        }
        if (!file.isDirectory()) {
            throw new Error("Not a directory: " + file.getAbsolutePath());
        }
        return file;
    }

    function validRuntimeName(value) {
        return /^[A-Za-z0-9._-]+$/.test(String(value)) &&
            String(value) !== "." && String(value) !== "..";
    }

    function lockFree(runtimeDir) {
        var dataDir = ensureDir(new File(runtimeDir, "data"));
        var raf = null;
        var channel = null;
        var handle = null;
        try {
            raf = new RAF(new File(dataDir, "cliphub.lock"), "rw");
            channel = raf.getChannel();
            handle = channel.tryLock();
            return handle !== null;
        } catch (error) {
            if (String(error).indexOf("OverlappingFileLockException") >= 0) {
                return false;
            }
            throw error;
        } finally {
            if (handle !== null) {
                try { handle.release(); } catch (ignoredRelease) {}
            }
            close(channel);
            close(raf);
        }
    }

    function waitFor(predicate, timeoutMs) {
        var started = now();
        while (now() - started < timeoutMs) {
            if (predicate()) { return true; }
            Thread.sleep(25);
        }
        return predicate();
    }

    function containsCommand(commands, command) {
        var index;
        if (!commands || typeof commands.length !== "number") { return false; }
        for (index = 0; index < commands.length; index += 1) {
            if (String(commands[index]) === String(command)) { return true; }
        }
        return false;
    }

    function outdatedRuntime(endpoint) {
        return {
            ok: false,
            command: "toggle",
            taskVersion: TASK_VERSION,
            running: true,
            updateRequired: true,
            endpointSchemaVersion: Number(endpoint && endpoint.schemaVersion || 0),
            entryVersion: Number(endpoint && endpoint.entryVersion || 0),
            moduleSetVersion: String(endpoint && endpoint.moduleSetVersion || ""),
            sourceRef: String(endpoint && endpoint.sourceRef || ""),
            requiredEndpointSchemaVersion: REQUIRED_ENDPOINT_SCHEMA,
            minimumEntryVersion: MIN_ENTRY_VERSION,
            error: "ClipHub 后台入口或控制协议过旧，请停止实例后重新执行完整 ClipHub.js"
        };
    }

    function main() {
        var options = global.ClipHubControlOptions || {};
        var root = String(shortx.getShortXDir());
        var runtimeName = options.runtimeName === undefined ?
            "ClipHub" : String(options.runtimeName);
        var runtimeDir;
        var cacheDir;
        var endpointFile;
        var endpoint;
        var requestId;
        var ackFile;
        var intent;
        var ack = null;
        var timeoutMs = Number(options.timeoutMs || 3000);

        if (!validRuntimeName(runtimeName)) {
            throw new Error("Invalid ClipHub runtime name: " + runtimeName);
        }
        if (!isFinite(timeoutMs) || timeoutMs < 500 || timeoutMs > 10000) {
            timeoutMs = 3000;
        }
        runtimeDir = new File(root, runtimeName);
        cacheDir = ensureDir(new File(runtimeDir, "cache"));
        endpointFile = new File(cacheDir, "control_endpoint.json");

        if (lockFree(runtimeDir)) {
            return {
                ok: false,
                command: "toggle",
                taskVersion: TASK_VERSION,
                running: false,
                error: "ClipHub 后台未运行，请先执行完整 ClipHub.js"
            };
        }
        if (!endpointFile.isFile()) {
            throw new Error("ClipHub control endpoint is missing");
        }
        endpoint = JSON.parse(read(endpointFile));
        if (!endpoint || String(endpoint.transport || "") !==
                "dynamic_broadcast_token" ||
                String(endpoint.runtimeDir || "") !==
                    String(runtimeDir.getAbsolutePath())) {
            throw new Error("Invalid ClipHub control endpoint");
        }
        if (Number(endpoint.schemaVersion || 0) < REQUIRED_ENDPOINT_SCHEMA ||
                Number(endpoint.entryVersion || 0) < MIN_ENTRY_VERSION ||
                String(endpoint.moduleSetVersion || "").length === 0 ||
                String(endpoint.sourceRef || "").length === 0 ||
                !containsCommand(endpoint.commands, "toggle")) {
            return outdatedRuntime(endpoint);
        }

        requestId = String(now()) + "-" + Number(Thread.currentThread().getId());
        ackFile = new File(cacheDir, "control_ack_" + requestId + ".json");
        if (ackFile.exists()) { ackFile.delete(); }
        intent = new Intent(String(endpoint.action));
        intent.putExtra("runtimeDir", String(runtimeDir.getAbsolutePath()));
        intent.putExtra("command", "toggle");
        intent.putExtra("requestId", requestId);
        intent.putExtra("controlToken", String(endpoint.token));
        global.context.sendBroadcast(intent);
        waitFor(function () { return ackFile.isFile(); }, timeoutMs);
        if (ackFile.isFile()) {
            try { ack = JSON.parse(read(ackFile)); }
            finally { ackFile.delete(); }
        }
        if (ack === null) {
            return {
                ok: false,
                command: "toggle",
                taskVersion: TASK_VERSION,
                running: true,
                endpointSchemaVersion: Number(endpoint.schemaVersion || 0),
                entryVersion: Number(endpoint.entryVersion || 0),
                moduleSetVersion: String(endpoint.moduleSetVersion || ""),
                sourceRef: String(endpoint.sourceRef || ""),
                error: "ClipHub 控制回执超时，请重新执行完整 ClipHub.js 后重试"
            };
        }
        ack.taskVersion = TASK_VERSION;
        ack.endpointSchemaVersion = Number(endpoint.schemaVersion || 0);
        ack.entryVersion = Number(endpoint.entryVersion || 0);
        ack.moduleSetVersion = String(endpoint.moduleSetVersion || "");
        ack.sourceRef = String(endpoint.sourceRef || "");
        return ack;
    }

    try {
        global.ClipHubToggleResult = main();
    } catch (error) {
        global.ClipHubToggleResult = {
            ok: false,
            command: "toggle",
            taskVersion: TASK_VERSION,
            error: String(error)
        };
    }
}((function () { return this; }())));

JSON.stringify(ClipHubToggleResult);
'''


def patch_tasks() -> tuple[bool, bool]:
    original = TOGGLE.read_text(encoding="utf-8")
    changed = original != TOGGLE_SOURCE
    if changed:
        TOGGLE.write_text(TOGGLE_SOURCE, encoding="utf-8")
    removed = False
    if OPEN_TASK.exists():
        OPEN_TASK.unlink()
        removed = True
    return changed, removed


def patch_manifest(app_sha: str) -> bool:
    data = json.loads(MANIFEST.read_text(encoding="utf-8"))
    before = json.dumps(data, ensure_ascii=False, sort_keys=True)
    if data.get("sourceRef") != PREPARE_REF:
        raise RuntimeError(
            f"manifest sourceRef drifted: {data.get('sourceRef')!r}")
    data["moduleSetVersion"] = TARGET_SET
    data["entryMinVersion"] = ENTRY_VERSION
    found = False
    for item in data.get("modules", []):
        if item.get("name") == "ch_15_app.js":
            item["sha"] = app_sha
            found = True
            break
    if not found:
        raise RuntimeError("manifest ch_15_app.js entry missing")
    after = json.dumps(data, ensure_ascii=False, sort_keys=True)
    changed = before != after
    if changed:
        MANIFEST.write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
    return changed


def validate() -> None:
    entry = ENTRY.read_text(encoding="utf-8")
    app = APP.read_text(encoding="utf-8")
    toggle = TOGGLE.read_text(encoding="utf-8")
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    checks = {
        "entry version": "var ENTRY_VERSION = 5;" in entry,
        "entry metadata": "moduleSetVersion: String(sync.moduleSetVersion" in entry,
        "app version": "MODULE_VERSION: 9" in app,
        "endpoint schema": "var CONTROL_ENDPOINT_SCHEMA = 3;" in app,
        "endpoint metadata": "moduleSetVersion: String(state.moduleSetVersion" in app,
        "toggle task version": "var TASK_VERSION = 3;" in toggle,
        "no hardcoded module set": "REQUIRED_MODULE_SET" not in toggle,
        "optional runtime": "ClipHubControlOptions" in toggle,
        "open task removed": not OPEN_TASK.exists(),
        "manifest set": manifest.get("moduleSetVersion") == TARGET_SET,
        "manifest entry": int(manifest.get("entryMinVersion", 0)) == ENTRY_VERSION,
        "manifest prepare ref": manifest.get("sourceRef") == PREPARE_REF,
    }
    failed = [name for name, ok in checks.items() if not ok]
    if failed:
        raise RuntimeError("validation failed: " + ", ".join(failed))


def main() -> None:
    entry_changed = patch_entry()
    app_changed, app_sha = patch_app()
    toggle_changed, open_removed = patch_tasks()
    manifest_changed = patch_manifest(app_sha)
    validate()
    print(f"ClipHub entry: {'changed' if entry_changed else 'unchanged'}")
    print(f"App module: {'changed' if app_changed else 'unchanged'}")
    print(f"Toggle task: {'changed' if toggle_changed else 'unchanged'}")
    print(f"Open task removed: {open_removed or not OPEN_TASK.exists()}")
    print(f"App blob SHA: {app_sha}")
    print(f"moduleSetVersion: {TARGET_SET}")
    print(f"entryVersion: {ENTRY_VERSION}")
    print(f"appModuleVersion: {APP_VERSION}")
    print(f"endpointSchemaVersion: {ENDPOINT_SCHEMA}")
    print(f"prepareSourceRef: {PREPARE_REF}")


if __name__ == "__main__":
    main()
