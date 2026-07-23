#!/usr/bin/env python3
"""Audit Rhino JavaScript calls that may hit unsafe Android color overloads.

The scanner is intentionally conservative. It reports direct numeric/ambiguous
color calls in production ClipHub JavaScript so ColorOS system_server builds do
not silently reintroduce the known Rhino overload hazard.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Iterable

ROOT = Path(__file__).resolve().parents[1]

PRODUCTION_PATHS = [ROOT / "ClipHub.js", ROOT / "src", ROOT / "tasks"]
ALL_EXTRA_PATHS = [ROOT / "probes"]

METHODS = (
    "setTextColor",
    "setHintTextColor",
    "setLinkTextColor",
    "setBackgroundColor",
    "setColor",
    "setStroke",
    "setTint",
    "setColorFilter",
    "setHighlightColor",
)

SAFE_CSL_MARKERS = (
    "safeColorStateList",
    "safeColorList",
    "ColorSafe.colorStateList",
    "ColorSafe.toColorStateList",
    "new ColorStateList",
    "new Packages.android.content.res.ColorStateList",
)

SAFE_COLOR_FILTER_MARKERS = (
    "new PorterDuffColorFilter",
    "new Packages.android.graphics.PorterDuffColorFilter",
)


@dataclass(frozen=True)
class Finding:
    severity: str
    path: str
    line: int
    api: str
    reason: str
    expression: str


def iter_js_files(paths: Iterable[Path]) -> list[Path]:
    output: list[Path] = []
    for path in paths:
        if path.is_file() and path.suffix == ".js":
            output.append(path)
        elif path.is_dir():
            output.extend(sorted(path.rglob("*.js")))
    return sorted(set(output))


def strip_comments_preserve_lines(text: str) -> str:
    """Remove JS comments while preserving source offsets and line numbers."""
    out = list(text)
    i = 0
    n = len(text)
    quote = ""
    escaped = False
    while i < n:
        ch = text[i]
        nxt = text[i + 1] if i + 1 < n else ""
        if quote:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == quote:
                quote = ""
            i += 1
            continue
        if ch in ("'", '"'):
            quote = ch
            i += 1
            continue
        if ch == "/" and nxt == "/":
            j = i
            while j < n and text[j] != "\n":
                out[j] = " "
                j += 1
            i = j
            continue
        if ch == "/" and nxt == "*":
            out[i] = " "
            out[i + 1] = " "
            j = i + 2
            while j < n:
                if text[j] == "*" and j + 1 < n and text[j + 1] == "/":
                    out[j] = " "
                    out[j + 1] = " "
                    j += 2
                    break
                if text[j] != "\n":
                    out[j] = " "
                j += 1
            i = j
            continue
        i += 1
    return "".join(out)


def scan_balanced_call(text: str, open_paren: int) -> tuple[str, int] | None:
    depth = 0
    quote = ""
    escaped = False
    i = open_paren
    while i < len(text):
        ch = text[i]
        if quote:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == quote:
                quote = ""
            i += 1
            continue
        if ch in ("'", '"'):
            quote = ch
            i += 1
            continue
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
            if depth == 0:
                return text[open_paren + 1 : i], i + 1
        i += 1
    return None


def top_level_args(args: str) -> list[str]:
    parts: list[str] = []
    start = 0
    depth = 0
    quote = ""
    escaped = False
    for i, ch in enumerate(args):
        if quote:
            if escaped:
                escaped = False
            elif ch == "\\":
                escaped = True
            elif ch == quote:
                quote = ""
            continue
        if ch in ("'", '"'):
            quote = ch
            continue
        if ch in "([{":
            depth += 1
        elif ch in ")]}" and depth > 0:
            depth -= 1
        elif ch == "," and depth == 0:
            parts.append(args[start:i].strip())
            start = i + 1
    parts.append(args[start:].strip())
    return parts


def compact(value: str, limit: int = 220) -> str:
    value = re.sub(r"\s+", " ", value).strip()
    return value if len(value) <= limit else value[: limit - 1] + "…"


def has_safe_csl(value: str) -> bool:
    return any(marker in value for marker in SAFE_CSL_MARKERS)


def line_number(text: str, offset: int) -> int:
    return text.count("\n", 0, offset) + 1


def add_method_findings(path: Path, source: str, clean: str) -> list[Finding]:
    findings: list[Finding] = []
    relative = str(path.relative_to(ROOT))
    method_pattern = re.compile(r"\.\s*(%s)\s*\(" % "|".join(METHODS))
    for match in method_pattern.finditer(clean):
        method = match.group(1)
        open_paren = clean.find("(", match.start())
        scanned = scan_balanced_call(clean, open_paren)
        if scanned is None:
            findings.append(Finding(
                "HIGH", relative, line_number(source, match.start()), method,
                "无法解析调用参数，需人工检查 Rhino 颜色重载", "",
            ))
            continue
        args, end = scanned
        expression = compact(source[match.start() : end])
        severity = "HIGH"
        reason = "Rhino 直接调用数值/歧义颜色重载"

        if method in ("setTextColor", "setHintTextColor", "setLinkTextColor"):
            if has_safe_csl(args):
                severity = "SAFE"
                reason = "显式 ColorStateList 对象重载"
        elif method == "setColor":
            if has_safe_csl(args):
                severity = "SAFE"
                reason = "GradientDrawable 使用显式 ColorStateList"
        elif method == "setStroke":
            parts = top_level_args(args)
            if len(parts) >= 2 and has_safe_csl(parts[1]):
                severity = "SAFE"
                reason = "描边颜色使用显式 ColorStateList"
            else:
                reason = "GradientDrawable.setStroke 的颜色参数仍为数值/歧义重载"
        elif method == "setColorFilter":
            if any(marker in args for marker in SAFE_COLOR_FILTER_MARKERS):
                severity = "WARN"
                reason = "使用 ColorFilter 对象，但其构造函数颜色参数仍需审查"
            else:
                reason = "Drawable/ImageView 直接调用数值颜色过滤重载"
        elif method == "setBackgroundColor":
            reason = "View.setBackgroundColor 仅走数值颜色路径，应改为安全 Drawable"
        elif method == "setTint":
            reason = "Drawable.setTint(int) 应改为 setTintList(ColorStateList)"
        elif method == "setHighlightColor":
            reason = "TextView.setHighlightColor(int) 为直接数值颜色调用"

        findings.append(Finding(
            severity, relative, line_number(source, match.start()), method,
            reason, expression,
        ))
    return findings


def add_constructor_findings(path: Path, source: str, clean: str) -> list[Finding]:
    findings: list[Finding] = []
    relative = str(path.relative_to(ROOT))
    patterns = (
        (re.compile(r"ColorStateList\s*\.\s*valueOf\s*\("),
         "ColorStateList.valueOf", "HIGH",
         "ColorStateList.valueOf 的数值参数仍可能触发 Rhino 重载问题"),
        (re.compile(r"new\s+(?:Packages\.android\.graphics\.drawable\.)?ColorDrawable\s*\("),
         "ColorDrawable", "WARN",
         "ColorDrawable(int) 直接接收数值颜色，建议统一走安全 Drawable 工厂"),
        (re.compile(r"new\s+(?:Packages\.android\.graphics\.)?PorterDuffColorFilter\s*\("),
         "PorterDuffColorFilter", "WARN",
         "ColorFilter 构造函数直接接收数值颜色，需实机确认或改为 tintList"),
    )
    for pattern, api, severity, reason in patterns:
        for match in pattern.finditer(clean):
            open_paren = clean.find("(", match.start())
            scanned = scan_balanced_call(clean, open_paren)
            end = scanned[1] if scanned else min(len(source), match.start() + 180)
            findings.append(Finding(
                severity, relative, line_number(source, match.start()), api,
                reason, compact(source[match.start() : end]),
            ))

    ripple_pattern = re.compile(
        r"new\s+(?:Packages\.android\.graphics\.drawable\.)?RippleDrawable\s*\("
    )
    for match in ripple_pattern.finditer(clean):
        open_paren = clean.find("(", match.start())
        scanned = scan_balanced_call(clean, open_paren)
        args = scanned[0] if scanned else ""
        end = scanned[1] if scanned else min(len(source), match.start() + 220)
        parts = top_level_args(args)
        safe = len(parts) >= 3 and has_safe_csl(parts[0]) and parts[2] not in ("", "null")
        findings.append(Finding(
            "SAFE" if safe else "HIGH",
            relative,
            line_number(source, match.start()),
            "RippleDrawable",
            "显式 ColorStateList 且提供 mask" if safe else
            "RippleDrawable 必须使用显式 ColorStateList，并提供非空 mask",
            compact(source[match.start() : end]),
        ))
    return findings


def audit(paths: Iterable[Path]) -> list[Finding]:
    findings: list[Finding] = []
    for path in iter_js_files(paths):
        source = path.read_text(encoding="utf-8")
        clean = strip_comments_preserve_lines(source)
        findings.extend(add_method_findings(path, source, clean))
        findings.extend(add_constructor_findings(path, source, clean))
    return sorted(findings, key=lambda item: (item.path, item.line, item.api))


def render_text(findings: list[Finding], show_safe: bool) -> str:
    visible = findings if show_safe else [item for item in findings if item.severity != "SAFE"]
    counts = {level: sum(1 for item in findings if item.severity == level)
              for level in ("HIGH", "WARN", "SAFE")}
    lines = [
        "ClipHub Rhino/ColorOS 颜色接口审计",
        f"HIGH={counts['HIGH']} WARN={counts['WARN']} SAFE={counts['SAFE']}",
        "",
    ]
    if not visible:
        lines.append("未发现需要报告的颜色接口调用。")
        return "\n".join(lines)
    for item in visible:
        lines.append(
            f"[{item.severity}] {item.path}:{item.line} {item.api} - {item.reason}"
        )
        if item.expression:
            lines.append("    " + item.expression)
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--all", action="store_true",
                        help="also scan probes in addition to production files")
    parser.add_argument("--show-safe", action="store_true",
                        help="include calls classified as safe")
    parser.add_argument("--json", dest="json_path",
                        help="write machine-readable findings to this path")
    parser.add_argument("--strict", action="store_true",
                        help="exit non-zero when HIGH findings exist")
    args = parser.parse_args()

    paths = list(PRODUCTION_PATHS)
    if args.all:
        paths.extend(ALL_EXTRA_PATHS)
    findings = audit(paths)
    print(render_text(findings, args.show_safe))

    if args.json_path:
        output_path = Path(args.json_path)
        if not output_path.is_absolute():
            output_path = ROOT / output_path
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(
            json.dumps([asdict(item) for item in findings],
                       ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print("\nJSON: " + str(output_path))

    high_count = sum(1 for item in findings if item.severity == "HIGH")
    return 1 if args.strict and high_count > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
