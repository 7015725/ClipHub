#!/usr/bin/env python3
"""Fix ClipHub author blog launching from the system_server runtime."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SETTINGS = ROOT / "src/ch_13_settings.js"
MANIFEST = ROOT / "module-manifest.json"


def replace_once(text: str, old: str, new: str, label: str) -> str:
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


def git_blob_sha(text: str) -> str:
    data = text.encode("utf-8")
    header = f"blob {len(data)}\0".encode("utf-8")
    return hashlib.sha1(header + data).hexdigest()


def main() -> int:
    source = SETTINGS.read_text(encoding="utf-8")

    if (
        'MODULE_VERSION: 13' in source
        and 'function currentForegroundUserId()' in source
        and 'startActivityAsUser' in source
        and 'lastBlogLaunchMethod' in source
    ):
        print("Settings blog launch fix is already applied.")
    else:
        source = replace_once(
            source,
            "    var Context = Packages.android.content.Context;\n"
            "    var Intent = Packages.android.content.Intent;\n"
            "    var Uri = Packages.android.net.Uri;\n",
            "    var Context = Packages.android.content.Context;\n"
            "    var Intent = Packages.android.content.Intent;\n"
            "    var Uri = Packages.android.net.Uri;\n"
            "    var PackageManager = Packages.android.content.pm.PackageManager;\n"
            "    var ActivityManager = Packages.android.app.ActivityManager;\n"
            "    var UserHandle = Packages.android.os.UserHandle;\n",
            "Android launch imports",
        )

        source = replace_once(
            source,
            "        blogOpenCount: 0,\n"
            "        blogOpenSuccessCount: 0,\n"
            "        lastOpenedUrl: null,\n",
            "        blogOpenCount: 0,\n"
            "        blogOpenSuccessCount: 0,\n"
            "        blogOpenFailureCount: 0,\n"
            "        lastOpenedUrl: null,\n"
            "        lastBlogLaunchMethod: null,\n"
            "        lastBlogLaunchUserId: -1,\n",
            "blog launch runtime state",
        )

        old_function = '''    function openAuthorBlog() {
        var url = "https://xin-blog.com";
        var intent;
        uiState.blogOpenCount += 1;
        uiState.lastOpenedUrl = url;
        try {
            if (appContext === null) {
                throw new Error("Android context unavailable");
            }
            intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            appContext.startActivity(intent);
            uiState.blogOpenSuccessCount += 1;
            uiState.lastError = null;
            return true;
        } catch (error) {
            uiState.lastError = "无法打开博客链接：" + String(error);
            return false;
        }
    }
'''

        new_function = '''    function currentForegroundUserId() {
        var userId = 0;
        try { userId = Number(ActivityManager.getCurrentUser()); }
        catch (ignoredCurrentUser) { userId = 0; }
        if (!isFinite(userId) || userId < 0) { userId = 0; }
        return Math.floor(userId);
    }

    function resolveBlogActivity(intent, userId) {
        var packageManager;
        var resolved = null;
        if (appContext === null) { return null; }
        try { packageManager = appContext.getPackageManager(); }
        catch (ignoredPackageManager) { packageManager = null; }
        if (packageManager === null) { return null; }
        try {
            resolved = packageManager.resolveActivityAsUser(intent,
                PackageManager.MATCH_DEFAULT_ONLY, Number(userId));
        } catch (ignoredAsUserResolve) {
            try {
                resolved = packageManager.resolveActivity(intent,
                    PackageManager.MATCH_DEFAULT_ONLY);
            } catch (ignoredResolve) { resolved = null; }
        }
        return resolved;
    }

    function openAuthorBlog() {
        var url = "https://xin-blog.com";
        var intent;
        var resolved;
        var activityInfo;
        var userId = currentForegroundUserId();
        var launchMethod = "none";
        var asUserError = null;
        uiState.blogOpenCount += 1;
        uiState.lastOpenedUrl = url;
        uiState.lastBlogLaunchUserId = userId;
        uiState.lastBlogLaunchMethod = launchMethod;
        try {
            if (appContext === null) {
                throw new Error("Android context unavailable");
            }
            intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK |
                Intent.FLAG_ACTIVITY_CLEAR_TOP);
            resolved = resolveBlogActivity(intent, userId);
            if (resolved === null || resolved.activityInfo === null) {
                throw new Error("No browser activity can handle the URL");
            }
            activityInfo = resolved.activityInfo;
            if (activityInfo.packageName !== null &&
                    activityInfo.name !== null) {
                intent.setClassName(String(activityInfo.packageName),
                    String(activityInfo.name));
            }
            try {
                appContext.startActivityAsUser(intent, UserHandle.of(userId));
                launchMethod = "startActivityAsUser";
            } catch (errorAsUser) {
                asUserError = errorAsUser;
                appContext.startActivity(intent);
                launchMethod = "startActivity";
            }
            uiState.lastBlogLaunchMethod = launchMethod;
            uiState.blogOpenSuccessCount += 1;
            uiState.lastError = null;
            try { closePage("author_blog"); }
            catch (ignoredCloseAfterLaunch) {}
            return true;
        } catch (error) {
            uiState.blogOpenFailureCount += 1;
            uiState.lastBlogLaunchMethod = launchMethod;
            uiState.lastError = "无法打开博客链接：" + String(error) +
                (asUserError === null ? "" :
                    "；startActivityAsUser=" + String(asUserError));
            return false;
        }
    }
'''

        source = replace_once(
            source,
            old_function,
            new_function,
            "author blog launch function",
        )

        source = replace_once(
            source,
            "            blogOpenCount: Number(uiState.blogOpenCount),\n"
            "            blogOpenSuccessCount:\n"
            "                Number(uiState.blogOpenSuccessCount),\n"
            "            lastOpenedUrl: uiState.lastOpenedUrl,\n",
            "            blogOpenCount: Number(uiState.blogOpenCount),\n"
            "            blogOpenSuccessCount:\n"
            "                Number(uiState.blogOpenSuccessCount),\n"
            "            blogOpenFailureCount:\n"
            "                Number(uiState.blogOpenFailureCount),\n"
            "            lastOpenedUrl: uiState.lastOpenedUrl,\n"
            "            lastBlogLaunchMethod: uiState.lastBlogLaunchMethod,\n"
            "            lastBlogLaunchUserId:\n"
            "                Number(uiState.lastBlogLaunchUserId),\n",
            "blog launch state output",
        )

        source = replace_once(
            source,
            '        MODULE_VERSION: 12,\n',
            '        MODULE_VERSION: 13,\n',
            "Settings module version",
        )

        SETTINGS.write_text(source, encoding="utf-8")
        print("Settings blog launch fix applied.")

    source = SETTINGS.read_text(encoding="utf-8")
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    manifest["moduleSetVersion"] = "20260723.12"
    settings_sha = git_blob_sha(source)
    found = False
    for item in manifest.get("modules", []):
        if item.get("name") == "ch_13_settings.js":
            item["sha"] = settings_sha
            found = True
            break
    if not found:
        raise SystemExit("Settings module is missing from manifest")
    MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("moduleSetVersion: 20260723.12")
    print("settingsSha: " + settings_sha)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
