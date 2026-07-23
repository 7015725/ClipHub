#!/usr/bin/env python3
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
path = root / "src/ch_11_filter.js"
text = path.read_text(encoding="utf-8")

old_target = """            var targetRoot = wasRootMode && panelWindowRoot !== null ?
                panelWindowRoot : panelRoot;
"""
new_target = """            var targetRoot = panelWindowRoot !== null ?
                panelWindowRoot : panelRoot;
"""
if text.count(old_target) != 1:
    raise RuntimeError("filter close targetRoot insertion point mismatch")
text = text.replace(old_target, new_target, 1)

old_attached = """            attachedToWindow = (rootMode && panelWindowRoot !== null ?
                panelWindowRoot : panelRoot) !== null &&
                (rootMode && panelWindowRoot !== null ?
                    panelWindowRoot : panelRoot).isAttachedToWindow();
"""
new_attached = """            attachedToWindow = (panelWindowRoot !== null ?
                panelWindowRoot : panelRoot) !== null &&
                (panelWindowRoot !== null ?
                    panelWindowRoot : panelRoot).isAttachedToWindow();
"""
if text.count(old_attached) != 1:
    raise RuntimeError("filter attached-state insertion point mismatch")
text = text.replace(old_attached, new_attached, 1)

old_catch = """        } catch (error) {
            try {
                if (rootMode && ClipHub.Window &&
                        typeof ClipHub.Window.detachPrimaryWindow === "function") {
                    ClipHub.Window.detachPrimaryWindow();
                }
            } catch (ignoredDetach) {}
            rootMode = false;
            state.rootMode = false;
            state.primarySurface = "filter_overlay";
            throw error;
        }
"""
new_catch = """        } catch (error) {
            try {
                if (panelWindowRoot !== null && ClipHub.Window &&
                        typeof ClipHub.Window.detachWindow === "function") {
                    ClipHub.Window.detachWindow(panelWindowRoot);
                } else if (rootMode && ClipHub.Window &&
                        typeof ClipHub.Window.detachPrimaryWindow === "function") {
                    ClipHub.Window.detachPrimaryWindow();
                }
            } catch (ignoredDetach) {}
            try {
                if (panelWindowRoot !== null &&
                        panelWindowRoot.isAttachedToWindow()) {
                    windowManager.removeViewImmediate(panelWindowRoot);
                } else if (panelRoot !== null &&
                        panelRoot.isAttachedToWindow()) {
                    windowManager.removeViewImmediate(panelRoot);
                }
            } catch (ignoredRemove) {}
            state.panelAttached = false;
            panelRoot = null;
            panelWindowRoot = null;
            panelManagedFrame = null;
            panelParams = null;
            primaryDragView = null;
            primaryResizeView = null;
            rootMode = false;
            state.rootMode = false;
            state.primarySurface = "filter_overlay";
            state.primaryGeometryManaged = false;
            throw error;
        }
"""
if text.count(old_catch) != 1:
    raise RuntimeError("filter attach catch insertion point mismatch")
text = text.replace(old_catch, new_catch, 1)

if text.count('MODULE_VERSION: 18') != 1:
    raise RuntimeError("expected ch_11_filter module version 18 exactly once")
text = text.replace('MODULE_VERSION: 18', 'MODULE_VERSION: 19', 1)
path.write_text(text, encoding="utf-8")

manifest_path = root / "module-manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
if manifest.get("moduleSetVersion") != "20260724.01":
    raise RuntimeError("unexpected moduleSetVersion: {}".format(
        manifest.get("moduleSetVersion")))
manifest["moduleSetVersion"] = "20260724.02"
for item in manifest["modules"]:
    if item["name"] == "ch_11_filter.js":
        data = path.read_bytes()
        item["sha"] = hashlib.sha1(
            b"blob " + str(len(data)).encode("ascii") + b"\0" + data
        ).hexdigest()
        break
else:
    raise RuntimeError("ch_11_filter.js missing from manifest")
manifest_path.write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8"
)
