#!/usr/bin/env python3
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
BASE = '40f2fc3095f97ef805fe690bb4508eaf7001d5bd'
ENTRY = ROOT / 'ClipHub.js'
MANIFEST = ROOT / 'module-manifest.json'
PREFLIGHT = ROOT / 'scripts/release_preflight.sh'

entry = ENTRY.read_text(encoding='utf-8')
preflight = PREFLIGHT.read_text(encoding='utf-8')
manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))

if 'var ENTRY_VERSION = 6;' not in entry:
    raise SystemExit('ENTRY_VERSION 6 anchor missing')
if 'function fetchRawFile(path, ref) {' not in entry:
    raise SystemExit('fetchRawFile anchor missing')
if 'remote = fetchRawFile(String(item.path), ref);' not in entry:
    raise SystemExit('installModules fetch anchor missing')
if 'remoteFile = fetchRawFile(MANIFEST_PATH, ref);' not in entry:
    raise SystemExit('syncModules manifest fetch anchor missing')
if 'EXPECTED_ENTRY_VERSION=\'6\'' not in preflight.split('--settings-tabs-beta)')[1].split(';;')[0]:
    raise SystemExit('settings-tabs entry preflight anchor missing')
if manifest.get('moduleSetVersion') != '20260815.17':
    raise SystemExit('unexpected moduleSetVersion: %r' % manifest.get('moduleSetVersion'))
if manifest.get('entryMinVersion') != 6:
    raise SystemExit('unexpected entryMinVersion: %r' % manifest.get('entryMinVersion'))

entry = entry.replace('var ENTRY_VERSION = 6;', 'var ENTRY_VERSION = 7;', 1)

raw_function = '''    function fetchRawFile(path, ref) {
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
'''

replacement = raw_function + '''
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
'''

if entry.count(raw_function) != 1:
    raise SystemExit('fetchRawFile exact function mismatch count=%d' % entry.count(raw_function))
entry = entry.replace(raw_function, replacement, 1)
entry = entry.replace(
    'remote = fetchRawFile(String(item.path), ref);',
    'remote = fetchRemoteFile(String(item.path), ref);',
    1,
)
entry = entry.replace(
    'remoteFile = fetchRawFile(MANIFEST_PATH, ref);',
    'remoteFile = fetchRemoteFile(MANIFEST_PATH, ref);',
    1,
)
entry = entry.replace(
    '                transport: "raw"\n            };',
    '                transport: remoteTransportLabel()\n            };',
    1,
)
entry = entry.replace(
    '                transport: "raw",\n                warning: null\n            };',
    '                transport: remoteTransportLabel(),\n                warning: null\n            };',
    1,
)
# Ensure an installed update reports the aggregate transport after all module downloads.
entry = entry.replace(
    '        installed.remoteAvailable = true;\n        installed.fallback = false;\n        installed.moduleSetVersion = String(remoteManifest.moduleSetVersion);',
    '        installed.remoteAvailable = true;\n        installed.fallback = false;\n        installed.transport = remoteTransportLabel();\n        installed.moduleSetVersion = String(remoteManifest.moduleSetVersion);',
    1,
)

# Manifest stays on .17; only the bootstrap minimum rises so old raw-only entry cannot
# silently claim compatibility with this release channel.
manifest['entryMinVersion'] = 7
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

settings_block_old = '''  --settings-tabs-beta)
    EXPECTED_REF='beta-regex-settings-tabs-20260814'
    EXPECTED_MODULE_SET='20260815.17'
    EXPECTED_ENTRY_VERSION='6'
    EXPECTED_APP_MODULE_VERSION='22'
    REQUIRE_CLEAN='0'
    ;;'''
settings_block_new = settings_block_old.replace("EXPECTED_ENTRY_VERSION='6'", "EXPECTED_ENTRY_VERSION='7'")
if preflight.count(settings_block_old) != 1:
    raise SystemExit('settings-tabs preflight block mismatch')
preflight = preflight.replace(settings_block_old, settings_block_new, 1)

contract_anchor = '''        assert '"ch_16_ui_shell.js"' in entry
        assert '"Translation", "UIShell"' in app
        assert 'uiShell: uiShell' in app
        print("UI shell stage7 contracts: passed")'''
contract_replacement = '''        assert '"ch_16_ui_shell.js"' in entry
        assert '"Translation", "UIShell"' in app
        assert 'uiShell: uiShell' in app
        assert 'var ENTRY_VERSION = 7;' in entry
        assert 'https://api.github.com/repos/' in entry
        assert 'application/vnd.github.raw+json' in entry
        assert 'function fetchApiFile(path, ref)' in entry
        assert 'function fetchRemoteFile(path, ref)' in entry
        assert 'remoteTransportState.rawSuppressed = true;' in entry
        assert 'remote = fetchRemoteFile(String(item.path), ref);' in entry
        assert 'remoteFile = fetchRemoteFile(MANIFEST_PATH, ref);' in entry
        assert 'installed.transport = remoteTransportLabel();' in entry
        assert entry.count('fetchRawFile(') == 2
        assert entry.count('fetchRemoteFile(') == 3
        print("Bootstrap dual transport contracts: passed")
        print("UI shell stage7 contracts: passed")'''
if preflight.count(contract_anchor) != 1:
    raise SystemExit('preflight Stage7 contract anchor mismatch')
preflight = preflight.replace(contract_anchor, contract_replacement, 1)
PREFLIGHT.write_text(preflight, encoding='utf-8')
ENTRY.write_text(entry, encoding='utf-8')

print('Stage7.1 dual transport applied')
print('base=' + BASE)
print('entryVersion=7')
print('moduleSetVersion=20260815.17')
