#!/usr/bin/env python3
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CLIPBOARD = ROOT / "src/ch_04_clipboard.js"
MANIFEST = ROOT / "module-manifest.json"


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError("{} expected once, found {}".format(label, count))
    return text.replace(old, new, 1)


text = CLIPBOARD.read_text(encoding="utf-8")

text = replace_once(text,
'''    var AndroidContext = Packages.android.content.Context;
    var AndroidClipData = Packages.android.content.ClipData;
    var ClipboardManager = Packages.android.content.ClipboardManager;
    var Thread = Packages.java.lang.Thread;''',
'''    var AndroidContext = Packages.android.content.Context;
    var AndroidClipData = Packages.android.content.ClipData;
    var ClipboardManager = Packages.android.content.ClipboardManager;
    var Build = Packages.android.os.Build;
    var Thread = Packages.java.lang.Thread;''',
"clipboard Build import")

text = replace_once(text,
'''    var manager = null;
    var listener = null;
    var androidContext = null;''',
'''    var manager = null;
    var vibrator = null;
    var listener = null;
    var androidContext = null;''',
"clipboard vibrator state")

text = replace_once(text,
'''        sensitiveIgnoredCount: 0,
        ignoredPackageCount: 0,
        lastEvent: null,''',
'''        sensitiveIgnoredCount: 0,
        ignoredPackageCount: 0,
        copyHapticCount: 0,
        copyHapticFailureCount: 0,
        lastCopyHapticAt: 0,
        lastCopyHapticLabel: null,
        lastCopyHapticThreadId: null,
        lastCopyHapticThreadName: null,
        lastEvent: null,''',
"clipboard haptic metrics")

text = replace_once(text,
'''    function now() { return ClipHub.Base.now(); }

    function log(level, message) {''',
'''    function now() { return ClipHub.Base.now(); }

    function resolveVibrator() {
        var managerService;
        if (androidContext === null || androidContext === undefined) {
            return null;
        }
        if (Build.VERSION.SDK_INT >= 31) {
            try {
                managerService = androidContext.getSystemService(
                    AndroidContext.VIBRATOR_MANAGER_SERVICE);
                if (managerService !== null && managerService !== undefined &&
                        typeof managerService.getDefaultVibrator === "function") {
                    return managerService.getDefaultVibrator();
                }
            } catch (ignoredManager) {}
        }
        try {
            return androidContext.getSystemService(
                AndroidContext.VIBRATOR_SERVICE);
        } catch (ignoredVibrator) {
            return null;
        }
    }

    function performCopySuccessHaptic(options) {
        var durationMs;
        var amplitude;
        var effect;
        var thread;
        options = options || {};
        if (options.haptic === false) { return false; }
        if (vibrator === null || vibrator === undefined) {
            vibrator = resolveVibrator();
        }
        if (vibrator === null || vibrator === undefined) { return false; }
        try {
            if (typeof vibrator.hasVibrator === "function" &&
                    !vibrator.hasVibrator()) {
                return false;
            }
            durationMs = Math.max(8, Math.min(40,
                Math.floor(Number(options.hapticDurationMs || 18))));
            amplitude = Math.max(1, Math.min(255,
                Math.floor(Number(options.hapticAmplitude || 60))));
            if (Build.VERSION.SDK_INT >= 26) {
                effect = Packages.android.os.VibrationEffect.createOneShot(
                    durationMs, amplitude);
                vibrator.vibrate(effect);
            } else {
                vibrator.vibrate(durationMs);
            }
            thread = Thread.currentThread();
            state.copyHapticCount += 1;
            state.lastCopyHapticAt = now();
            state.lastCopyHapticLabel = String(
                options.hapticLabel || options.label || "ClipHub");
            state.lastCopyHapticThreadId = Number(thread.getId());
            state.lastCopyHapticThreadName = String(thread.getName());
            return true;
        } catch (error) {
            state.copyHapticFailureCount += 1;
            return false;
        }
    }

    function log(level, message) {''',
"clipboard haptic functions")

text = replace_once(text,
'''        var PersistableBundle;
        var extras;
        options = options || {};''',
'''        var PersistableBundle;
        var extras;
        var hapticPerformed = false;
        options = options || {};''',
"writeText haptic result var")

text = replace_once(text,
'''            manager.setPrimaryClip(clip);
            return {
                ok: true,
                written: true,
                hash: hash,
                at: at,
                contentLength: text.length,
                sensitive: options.sensitive === true
            };''',
'''            manager.setPrimaryClip(clip);
            hapticPerformed = performCopySuccessHaptic(options);
            return {
                ok: true,
                written: true,
                hash: hash,
                at: at,
                contentLength: text.length,
                sensitive: options.sensitive === true,
                hapticPerformed: hapticPerformed
            };''',
"writeText success haptic")

text = replace_once(text,
'''            sensitiveIgnoredCount: state.sensitiveIgnoredCount,
            ignoredPackageCount: state.ignoredPackageCount,
            lastEvent: state.lastEvent,''',
'''            sensitiveIgnoredCount: state.sensitiveIgnoredCount,
            ignoredPackageCount: state.ignoredPackageCount,
            copyHapticCount: state.copyHapticCount,
            copyHapticFailureCount: state.copyHapticFailureCount,
            lastCopyHapticAt: state.lastCopyHapticAt,
            lastCopyHapticLabel: state.lastCopyHapticLabel,
            lastCopyHapticThreadId: state.lastCopyHapticThreadId,
            lastCopyHapticThreadName: state.lastCopyHapticThreadName,
            lastEvent: state.lastEvent,''',
"clipboard haptic state output")

text = replace_once(text,
'''        MODULE_NAME: "ch_04_clipboard",
        MODULE_VERSION: 3,''',
'''        MODULE_NAME: "ch_04_clipboard",
        MODULE_VERSION: 4,''',
"clipboard module version")

text = replace_once(text,
'''            packageManager = androidContext.getPackageManager();
            manager = androidContext.getSystemService(AndroidContext.CLIPBOARD_SERVICE);
            if (manager === null) { throw new Error("ClipboardManager unavailable"); }
            return start();''',
'''            packageManager = androidContext.getPackageManager();
            manager = androidContext.getSystemService(AndroidContext.CLIPBOARD_SERVICE);
            if (manager === null) { throw new Error("ClipboardManager unavailable"); }
            vibrator = resolveVibrator();
            return start();''',
"clipboard init vibrator")

text = replace_once(text,
'''            stop();
            manager = null;
            androidContext = null;''',
'''            stop();
            manager = null;
            vibrator = null;
            androidContext = null;''',
"clipboard shutdown vibrator")

CLIPBOARD.write_text(text, encoding="utf-8")

manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
manifest["moduleSetVersion"] = "20260724.13"
for item in manifest["modules"]:
    path = ROOT / item["path"]
    data = path.read_bytes()
    item["sha"] = hashlib.sha1(
        b"blob " + str(len(data)).encode("ascii") + b"\0" + data
    ).hexdigest()
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8")
