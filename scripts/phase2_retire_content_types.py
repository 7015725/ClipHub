#!/usr/bin/env python3
from pathlib import Path
import json
import re
import subprocess


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit("%s replacement count=%d" % (label, count))
    return text.replace(old, new, 1)


def matching_brace(text, open_index):
    depth = 0
    index = open_index
    quote = None
    escaped = False
    line_comment = False
    block_comment = False
    while index < len(text):
        char = text[index]
        next_char = text[index + 1] if index + 1 < len(text) else ""
        if line_comment:
            if char == "\n":
                line_comment = False
            index += 1
            continue
        if block_comment:
            if char == "*" and next_char == "/":
                block_comment = False
                index += 2
            else:
                index += 1
            continue
        if quote is not None:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
            index += 1
            continue
        if char == "/" and next_char == "/":
            line_comment = True
            index += 2
            continue
        if char == "/" and next_char == "*":
            block_comment = True
            index += 2
            continue
        if char == "'" or char == '"':
            quote = char
            index += 1
            continue
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return index
        index += 1
    raise SystemExit("unbalanced JavaScript braces")


def named_function_span(text, name):
    pattern = re.compile(r"(?m)^    function " + re.escape(name) + r"\(")
    matches = list(pattern.finditer(text))
    if len(matches) != 1:
        raise SystemExit("%s function count=%d" % (name, len(matches)))
    start = matches[0].start()
    open_index = text.find("{", matches[0].end())
    if open_index < 0:
        raise SystemExit("missing function brace: " + name)
    close_index = matching_brace(text, open_index)
    end = close_index + 1
    while end < len(text) and text[end] in " \t":
        end += 1
    if end < len(text) and text[end] == "\n":
        end += 1
    if end < len(text) and text[end] == "\n":
        end += 1
    return start, end


def replace_named_function(text, name, replacement):
    start, end = named_function_span(text, name)
    return text[:start] + replacement + text[end:]


def remove_named_function(text, name):
    start, end = named_function_span(text, name)
    return text[:start] + text[end:]


def object_function_span(text, name):
    pattern = re.compile(r"(?m)^        " + re.escape(name) + r": function \(")
    matches = list(pattern.finditer(text))
    if len(matches) != 1:
        raise SystemExit("%s object function count=%d" % (name, len(matches)))
    start = matches[0].start()
    open_index = text.find("{", matches[0].end())
    if open_index < 0:
        raise SystemExit("missing object function brace: " + name)
    close_index = matching_brace(text, open_index)
    end = close_index + 1
    while end < len(text) and text[end] in " \t":
        end += 1
    if end >= len(text) or text[end] != ",":
        raise SystemExit("missing object function comma: " + name)
    end += 1
    while end < len(text) and text[end] in " \t":
        end += 1
    if end < len(text) and text[end] == "\n":
        end += 1
    if end < len(text) and text[end] == "\n":
        end += 1
    return start, end


def remove_object_function(text, name):
    start, end = object_function_span(text, name)
    return text[:start] + text[end:]


def remove_if_block(text, marker, label):
    starts = [match.start() for match in re.finditer(re.escape(marker), text)]
    if len(starts) != 1:
        raise SystemExit("%s marker count=%d" % (label, len(starts)))
    start = starts[0]
    open_index = text.find("{", start + len(marker) - 1)
    if open_index < 0:
        raise SystemExit("missing if block brace: " + label)
    close_index = matching_brace(text, open_index)
    end = close_index + 1
    while end < len(text) and text[end] in " \t":
        end += 1
    if end < len(text) and text[end] == "\n":
        end += 1
    return text[:start] + text[end:]


def retire_filter_lines(text):
    lines = text.splitlines(True)
    output = []
    counts = {}
    skip_content_type_value = False
    tokens = [
        "contentTypes",
        "typeViews",
        "typeToggleCount",
        "typeWrapRowCount",
        "typeChipCount",
        "counts.types"
    ]
    for line in lines:
        if skip_content_type_value:
            if "Number(state.contentTypeOptionCount)," not in line:
                raise SystemExit("contentTypeOptionCount continuation mismatch")
            counts["contentTypeOptionCount.continuation"] = 1
            skip_content_type_value = False
            continue
        if line.strip() == "contentTypeOptionCount:":
            counts["contentTypeOptionCount.property"] = (
                counts.get("contentTypeOptionCount.property", 0) + 1
            )
            skip_content_type_value = True
            continue
        if "contentTypeOptionCount" in line:
            counts["contentTypeOptionCount.line"] = (
                counts.get("contentTypeOptionCount.line", 0) + 1
            )
            continue
        matched = None
        for token in tokens:
            if token in line:
                matched = token
                break
        if matched is not None:
            counts[matched] = counts.get(matched, 0) + 1
            continue
        output.append(line)
    if skip_content_type_value:
        raise SystemExit("unterminated contentTypeOptionCount property")
    expected = {
        "contentTypes": 3,
        "typeViews": 5,
        "typeToggleCount": 3,
        "typeWrapRowCount": 5,
        "typeChipCount": 2,
        "contentTypeOptionCount.property": 1,
        "contentTypeOptionCount.continuation": 1,
        "contentTypeOptionCount.line": 3
    }
    if counts != expected:
        raise SystemExit(
            "retired line counts mismatch: %r expected %r" % (counts, expected)
        )
    return "".join(output)


manifest_path = Path("module-manifest.json")
app_path = Path("src/ch_15_app.js")
repository_path = Path("src/ch_06_repository.js")
filter_path = Path("src/ch_11_filter.js")
classifier_path = Path("src/ch_05_classifier.js")

manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
if manifest.get("moduleSetVersion") != "20260724.29":
    raise SystemExit("unexpected module set: %r" % manifest.get("moduleSetVersion"))
if len(manifest.get("modules", [])) != 15:
    raise SystemExit("unexpected pre-migration module count")
if not classifier_path.exists():
    raise SystemExit("classifier file missing before migration")

app = app_path.read_text(encoding="utf-8")
app = replace_once(
    app,
    '        "Log", "Database", "Classifier", "Repository",\n',
    '        "Log", "Database", "Repository",\n',
    "app module order"
)
app = replace_once(
    app,
    "        MODULE_VERSION: 11,\n",
    "        MODULE_VERSION: 12,\n",
    "app module version"
)
app_path.write_text(app, encoding="utf-8")

repository = repository_path.read_text(encoding="utf-8")
repository = replace_once(
    repository,
    "        var types;\n",
    "",
    "repository unused type variable"
)
repository = remove_named_function(repository, "listContentTypeOptions")
repository = replace_once(
    repository,
    "        listContentTypeOptions: listContentTypeOptions,\n",
    "",
    "repository type option export"
)
repository = replace_once(
    repository,
    "        MODULE_VERSION: 9,\n",
    "        MODULE_VERSION: 10,\n",
    "repository module version"
)
if "listContentTypeOptions" in repository:
    raise SystemExit("repository type option API remains")
repository_path.write_text(repository, encoding="utf-8")

source = filter_path.read_text(encoding="utf-8")
source = remove_named_function(source, "toggleType")
source = replace_named_function(
    source,
    "optionKey",
    '''    function optionKey(option, kind) {
        if (kind === "source") {
            return String(option.source_package);
        }
        return String(Number(option.id));
    }

'''
)
source = replace_named_function(
    source,
    "optionLabel",
    '''    function optionLabel(option, kind) {
        if (kind === "source") {
            return sourceLabel(option);
        }
        return String(option.name);
    }

'''
)
source = replace_named_function(
    source,
    "selectedList",
    '''    function selectedList(kind) {
        if (kind === "source") {
            return value.sourcePackages;
        }
        return value.tagIds;
    }

'''
)
source = replace_named_function(
    source,
    "clearKind",
    '''    function clearKind(kind) {
        if (kind === "source") {
            state.sourceToggleCount += 1;
            setValue({ sourcePackages: [] }, {
                origin: "ui_source_all"
            });
        } else {
            state.tagToggleCount += 1;
            setValue({ tagIds: [] }, {
                origin: "ui_tag_all"
            });
        }
    }

'''
)
source = replace_named_function(
    source,
    "optionClick",
    '''    function optionClick(kind, key, chip) {
        if (kind === "source") {
            (function (target, view) {
                view.setOnClickListener(new JavaAdapter(
                    View.OnClickListener, {
                        onClick: function () { toggleSource(target); }
                    }));
                sourceViews[target] = view;
            }(key, chip));
        } else {
            (function (target, view) {
                view.setOnClickListener(new JavaAdapter(
                    View.OnClickListener, {
                        onClick: function () {
                            toggleTag(Number(target));
                        }
                    }));
                tagViews[target] = view;
            }(key, chip));
        }
    }

'''
)
source = remove_if_block(
    source,
    '        if (patch.hasOwnProperty("contentTypes")) {',
    "filter set content types"
)
source = remove_if_block(
    source,
    '        if (value.contentTypes && value.contentTypes.length > 0) {',
    "filter active content types"
)
for name in ["setContentTypes", "getContentTypeOptions", "performTypeClick"]:
    source = remove_object_function(source, name)
source = replace_once(
    source,
    "        return { sources: sources, types: [], tags: tags };\n",
    "        return { sources: sources, tags: tags };\n",
    "filter option counts"
)
source = retire_filter_lines(source)
source = replace_once(
    source,
    "        MODULE_VERSION: 32,\n",
    "        MODULE_VERSION: 33,\n",
    "filter module version"
)
source = replace_once(
    source,
    '        FILTER_IME_AVOIDANCE: "formal_v32",\n',
    '        FILTER_IME_AVOIDANCE: "formal_v33",\n',
    "filter IME contract"
)
forbidden = [
    "contentTypes",
    "typeViews",
    "typeToggleCount",
    "typeWrapRowCount",
    "contentTypeOptionCount",
    "typeChipCount",
    "setContentTypes",
    "getContentTypeOptions",
    "performTypeClick",
    "listContentTypeOptions",
    "toggleType",
    'kind === "type"',
    "counts.types",
    "ui_type"
]
for token in forbidden:
    if token in source:
        raise SystemExit("retired filter token remains: " + token)
filter_path.write_text(source, encoding="utf-8")

modules = [
    item for item in manifest["modules"]
    if item.get("path") != "src/ch_05_classifier.js"
]
if len(modules) != 14:
    raise SystemExit("classifier manifest removal mismatch")
manifest["modules"] = modules
manifest["moduleSetVersion"] = "20260724.30"
for path in [
    "src/ch_06_repository.js",
    "src/ch_11_filter.js",
    "src/ch_15_app.js"
]:
    blob = subprocess.check_output(["git", "hash-object", path], text=True).strip()
    matches = [item for item in modules if item.get("path") == path]
    if len(matches) != 1:
        raise SystemExit("manifest entry mismatch: " + path)
    matches[0]["sha"] = blob
manifest_path.write_text(
    json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
    encoding="utf-8"
)
classifier_path.unlink()
print("phase2 content type retirement applied")
