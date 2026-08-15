#!/usr/bin/env python3
from __future__ import annotations

import re
import ui_layout_framework_20260815 as base

_original_replace_once = base.replace_once


def _replace_regex_once(text, pattern, replacement, label):
    updated, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError("%s: regex expected one anchor, got %d" % (label, count))
    return updated


def replace_once_compat(text, old, new, label):
    if text.count(old) == 1:
        return text.replace(old, new, 1)

    if label == "settings root close icon":
        return _replace_regex_once(
            text,
            r'        closeView = makeText\("×",\s*[0-9]+(?:\.[0-9]+)?,\s*colors\.icon,\s*(?:true|false)\);',
            '        closeView = makeText("×", layoutMetrics.iconSp, colors.icon, false);',
            label,
        )

    if label == "settings root close size":
        return _replace_regex_once(
            text,
            r'        header\.addView\(closeView,\s*new LinearLayout\.LayoutParams\(\s*dp\([0-9]+(?:\.[0-9]+)?\),\s*dp\([0-9]+(?:\.[0-9]+)?\)\)\);',
            '        header.addView(closeView, new LinearLayout.LayoutParams(\n'
            '            dp(layoutMetrics.actionSizeDp), dp(layoutMetrics.actionSizeDp)));',
            label,
        )

    if label == "settings root header geometry":
        return _replace_regex_once(
            text,
            r'        params = new LinearLayout\.LayoutParams\(\s*'
            r'LinearLayout\.LayoutParams\.MATCH_PARENT,\s*dp\([0-9]+(?:\.[0-9]+)?\)\);\s*'
            r'params\.topMargin = -?dp\([0-9]+(?:\.[0-9]+)?\);\s*'
            r'params\.bottomMargin = dp\([0-9]+(?:\.[0-9]+)?\);\s*'
            r'content\.addView\(header, params\);',
            '        params = new LinearLayout.LayoutParams(\n'
            '            LinearLayout.LayoutParams.MATCH_PARENT,\n'
            '            dp(layoutMetrics.actionSizeDp));\n'
            '        params.topMargin = dp(layoutTokens.headerTopOffsetDp);\n'
            '        params.bottomMargin = dp(layoutTokens.headerBottomGapDp);\n'
            '        content.addView(header, params);',
            label,
        )

    return _original_replace_once(text, old, new, label)


base.replace_once = replace_once_compat
base.main()
