#!/usr/bin/env python3
"""Apply the ClipHub settings author/blog section update."""

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
        'MODULE_VERSION: 12' in source
        and 'function openAuthorBlog()' in source
        and 'xin-blog.com' in source
    ):
        print("Settings author/blog update is already applied.")
    else:
        source = replace_once(
            source,
            "    var Context = Packages.android.content.Context;\n",
            "    var Context = Packages.android.content.Context;\n"
            "    var Intent = Packages.android.content.Intent;\n"
            "    var Uri = Packages.android.net.Uri;\n",
            "Android Intent/Uri imports",
        )

        source = replace_once(
            source,
            "    var dataSectionView = null;\n",
            "    var dataSectionView = null;\n"
            "    var blogLinkView = null;\n",
            "blog link view state",
        )

        source = replace_once(
            source,
            "        lastDelayedCallbackError: null,\n"
            "        lastTestResult: \"\",\n",
            "        lastDelayedCallbackError: null,\n"
            "        blogOpenCount: 0,\n"
            "        blogOpenSuccessCount: 0,\n"
            "        lastOpenedUrl: null,\n"
            "        lastTestResult: \"\",\n",
            "blog runtime state",
        )

        old_data_section = '''    function makeDataSection(colors) {
        var section = makeSection(colors);
        var path = initContext && initContext.runtimeDir ?
            String(initContext.runtimeDir) + "/data/cliphub.db" : "";
        var text;
        makeSectionTitle(section, "数据与关于",
            "当前数据库和模块运行信息", colors);
        text = makeText(
            "剪贴板记录：" + String(ClipHub.Repository.countItems(false)) +
            "\\n标签数量：" + String(ClipHub.Repository.listTags().length) +
            "\\n数据库：" + path +
            "\\nSchema：v" + String(ClipHub.Database.getVersion()) +
            "\\n模块集：" + String(initContext.moduleSetVersion || "运行中"),
            10, colors.textSecondary, false);
        text.setTextIsSelectable(true);
        text.setLineSpacing(0, 1.15);
        section.addView(text, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        return section;
    }
'''

        new_data_section = '''    function openAuthorBlog() {
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

    function makeDataSection(colors) {
        var section = makeSection(colors);
        var path = initContext && initContext.runtimeDir ?
            String(initContext.runtimeDir) + "/data/cliphub.db" : "";
        var infoTitle;
        var infoText;
        var divider;
        var authorTitle;
        var authorName;
        var blogRow;
        var blogLabel;
        var blogValue;
        var params;
        makeSectionTitle(section, "数据与关于",
            "当前数据库、模块和项目相关信息", colors);

        infoTitle = makeText("运行信息", 10, colors.textPrimary, true);
        section.addView(infoTitle, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));

        infoText = makeText(
            "剪贴板记录：" + String(ClipHub.Repository.countItems(false)) +
            "\\n标签数量：" + String(ClipHub.Repository.listTags().length) +
            "\\n数据库：" + path +
            "\\nSchema：v" + String(ClipHub.Database.getVersion()) +
            "\\n模块集：" + String(initContext.moduleSetVersion || "运行中"),
            10, colors.textSecondary, false);
        infoText.setTextIsSelectable(true);
        infoText.setLineSpacing(0, 1.15);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(5);
        params.bottomMargin = dp(10);
        section.addView(infoText, params);

        divider = new View(appContext);
        divider.setBackgroundColor(Color.parseColor(String(colors.stroke)));
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(1));
        params.topMargin = dp(2);
        params.bottomMargin = dp(10);
        section.addView(divider, params);

        authorTitle = makeText("关于作者", 10, colors.textPrimary, true);
        section.addView(authorTitle, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));

        authorName = makeText("林深见鹿", 12, colors.textPrimary, true);
        params = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.topMargin = dp(5);
        params.bottomMargin = dp(8);
        section.addView(authorName, params);

        blogRow = new LinearLayout(appContext);
        blogRow.setOrientation(LinearLayout.HORIZONTAL);
        blogRow.setGravity(Gravity.CENTER_VERTICAL);
        blogRow.setPadding(dp(11), dp(7), dp(11), dp(7));
        blogRow.setBackground(roundedBackground(colors.surfaceMuted,
            colors.stroke, 11));
        blogRow.setClickable(true);
        blogRow.setFocusable(true);
        blogRow.setContentDescription("打开个人博客 xin-blog.com");
        blogRow.setOnTouchListener(new JavaAdapter(View.OnTouchListener, {
            onTouch: function (view, event) {
                var action = Number(event.getActionMasked());
                if (action === MotionEvent.ACTION_DOWN) {
                    view.setAlpha(0.72);
                } else if (action === MotionEvent.ACTION_UP ||
                        action === MotionEvent.ACTION_CANCEL) {
                    view.setAlpha(1);
                }
                return false;
            }
        }));
        blogRow.setOnClickListener(new JavaAdapter(View.OnClickListener, {
            onClick: openAuthorBlog
        }));

        blogLabel = makeText("个人博客", 10, colors.textSecondary, false);
        blogValue = makeText("xin-blog.com  ↗", 10,
            colors.accentStrong, true);
        blogValue.setSingleLine(true);
        blogValue.setGravity(Gravity.RIGHT | Gravity.CENTER_VERTICAL);
        blogRow.addView(blogLabel, new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        blogRow.addView(blogValue, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        section.addView(blogRow, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(44)));
        blogLinkView = blogRow;
        return section;
    }
'''
        source = replace_once(
            source,
            old_data_section,
            new_data_section,
            "data/about section",
        )

        source = replace_once(
            source,
            "                dataSectionView = null;\n"
            "                pendingDeleteTagId = null;\n",
            "                dataSectionView = null;\n"
            "                blogLinkView = null;\n"
            "                pendingDeleteTagId = null;\n",
            "blog view cleanup",
        )

        source = replace_once(
            source,
            "            lastDelayedCallbackError: uiState.lastDelayedCallbackError,\n"
            "            lastTestResult: uiState.lastTestResult,\n",
            "            lastDelayedCallbackError: uiState.lastDelayedCallbackError,\n"
            "            blogLinkPresent: blogLinkView !== null,\n"
            "            blogOpenCount: Number(uiState.blogOpenCount),\n"
            "            blogOpenSuccessCount:\n"
            "                Number(uiState.blogOpenSuccessCount),\n"
            "            lastOpenedUrl: uiState.lastOpenedUrl,\n"
            "            lastTestResult: uiState.lastTestResult,\n",
            "blog state output",
        )

        source = replace_once(
            source,
            "        MODULE_VERSION: 11,\n",
            "        MODULE_VERSION: 12,\n",
            "Settings module version",
        )

        source = replace_once(
            source,
            "        scrollToSection: scrollToSection,\n"
            "        performFocusInput: function (name) {\n",
            "        scrollToSection: scrollToSection,\n"
            "        performOpenBlogClick: function () {\n"
            "            return runOnMainSync(function () {\n"
            "                return blogLinkView !== null &&\n"
            "                    blogLinkView.performClick();\n"
            "            }, 3000);\n"
            "        },\n"
            "        performFocusInput: function (name) {\n",
            "blog probe action",
        )

        SETTINGS.write_text(source, encoding="utf-8")
        print("Settings module updated.")

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    current_version = str(manifest.get("moduleSetVersion", ""))
    if current_version not in {"20260723.10", "20260723.11"}:
        raise SystemExit(
            "Unexpected moduleSetVersion: " + current_version
        )

    settings_sha = git_blob_sha(source)
    settings_entry = None
    for item in manifest.get("modules", []):
        if item.get("name") == "ch_13_settings.js":
            settings_entry = item
            break
    if settings_entry is None:
        raise SystemExit("Manifest is missing ch_13_settings.js")

    settings_entry["sha"] = settings_sha
    manifest["moduleSetVersion"] = "20260723.11"
    MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print("moduleSetVersion: 20260723.11")
    print("Settings MODULE_VERSION: 12")
    print("Settings blob SHA: " + settings_sha)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
