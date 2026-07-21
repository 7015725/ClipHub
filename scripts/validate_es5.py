#!/usr/bin/env python3
"""ClipHub Rhino ES5 静态边界检查。"""

from __future__ import print_function

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JS_FILES = ([ROOT / "ClipHub.js"] +
            sorted((ROOT / "src").glob("*.js")) +
            sorted((ROOT / "probes").glob("*.js")))


def mask_strings_and_comments(text):
    out = []
    i = 0
    state = "code"
    quote = ""
    while i < len(text):
        ch = text[i]
        nxt = text[i + 1] if i + 1 < len(text) else ""
        if state == "code":
            if ch == "/" and nxt == "/":
                out.extend("  ")
                i += 2
                state = "line_comment"
                continue
            if ch == "/" and nxt == "*":
                out.extend("  ")
                i += 2
                state = "block_comment"
                continue
            if ch in ("'", '"'):
                quote = ch
                out.append(" ")
                i += 1
                state = "string"
                continue
            out.append(ch)
            i += 1
            continue
        if state == "line_comment":
            if ch == "\n":
                out.append("\n")
                state = "code"
            else:
                out.append(" ")
            i += 1
            continue
        if state == "block_comment":
            if ch == "*" and nxt == "/":
                out.extend("  ")
                i += 2
                state = "code"
            else:
                out.append("\n" if ch == "\n" else " ")
                i += 1
            continue
        if state == "string":
            if ch == "\\":
                out.append(" ")
                if i + 1 < len(text):
                    out.append("\n" if text[i + 1] == "\n" else " ")
                i += 2
                continue
            if ch == quote:
                out.append(" ")
                i += 1
                state = "code"
                continue
            out.append("\n" if ch == "\n" else " ")
            i += 1
            continue
    return "".join(out)


def validate_file(path):
    text = path.read_text(encoding="utf-8")
    code = mask_strings_and_comments(text)
    problems = []
    checks = [
        (r"\blet\b", "禁止使用 let"),
        (r"\bconst\b", "禁止使用 const"),
        (r"\bclass\s+[A-Za-z_$]", "禁止使用 class"),
        (r"=>", "禁止使用箭头函数"),
        (r"`", "禁止使用模板字符串"),
        (r"\?\.", "禁止使用可选链"),
        (r"\?\?", "禁止使用空值合并运算符"),
    ]
    for pattern, message in checks:
        match = re.search(pattern, code)
        if match:
            line = code.count("\n", 0, match.start()) + 1
            problems.append("{}:{} {}".format(path.relative_to(ROOT), line, message))
    if path.parent.name == "src" and "(function (CH)" not in text:
        problems.append("{} 缺少统一模块包装".format(path.relative_to(ROOT)))
    return problems


def main():
    problems = []
    for path in JS_FILES:
        if not path.exists():
            problems.append("缺少文件: {}".format(path.relative_to(ROOT)))
            continue
        problems.extend(validate_file(path))
    if problems:
        print("ClipHub ES5 校验失败:")
        for problem in problems:
            print("- " + problem)
        return 1
    print("ClipHub ES5 校验通过，共检查 {} 个文件。".format(len(JS_FILES)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
