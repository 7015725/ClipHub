#!/usr/bin/env python3
from pathlib import Path

path = Path('.github/stage11_1_build.py')
text = path.read_text(encoding='utf-8')
old_helper = '''def insert_head(text, signature, statement, label):
    return replace_once(
        text, signature + "\\n",
        signature + "\\n" + statement + "\\n", label
    )
'''
new_helper = '''def insert_head(text, signature, statement, label):
    return replace_once(
        text, signature + "\\n",
        signature + "\\n" + statement + "\\n", label
    )

def insert_named_head(text, name, statement, label):
    pattern = re.compile(
        r"^(    function " + re.escape(name) + r"\\([^\\n]*\\) \\{\\n)",
        re.MULTILINE
    )
    matches = list(pattern.finditer(text))
    if len(matches) != 1:
        raise RuntimeError("%s expected once, found %d" % (label, len(matches)))
    return pattern.sub(lambda match: match.group(1) + statement + "\\n",
                       text, count=1)
'''
old_calls = '''source = insert_head(
    source, "    function resetResultPaging(origin) {",
    '        invalidateHydrationWorker(origin || "result_paging_reset");',
    "paging invalidation"
)
source = insert_head(
    source,
    "    function rememberMutationRefresh(eventName, action, reason, forceFull) {",
    '        invalidateHydrationWorker(reason || eventName || "mutation_refresh");',
    "mutation invalidation"
)
'''
new_calls = '''source = insert_named_head(
    source, "resetResultPaging",
    '        invalidateHydrationWorker("result_paging_reset");',
    "paging invalidation"
)
source = insert_named_head(
    source, "scheduleCoalescedRefresh",
    '        invalidateHydrationWorker("coalesced_refresh");',
    "refresh invalidation"
)
'''
old_diag = '''source = replace_once(
    source,
    "        getState: function () {\\n",
    ''' + "'''" + '''        getHydrationWorkerState: function () {
            return copyHydrationWorkerState();
        },

        getScrollPerformanceState: function () {
            return copyScrollPerformanceState();
        },

        getState: function () {
''' + "'''" + ''',
    "diagnostic APIs"
)
'''
new_diag = '''source = replace_once(
    source,
    "        PAGINATION_STAGE: PAGINATION_STAGE,\\n",
    ''' + "'''" + '''        PAGINATION_STAGE: PAGINATION_STAGE,

        getHydrationWorkerState: function () {
            return copyHydrationWorkerState();
        },

        getScrollPerformanceState: function () {
            return copyScrollPerformanceState();
        },
''' + "'''" + ''',
    "diagnostic APIs"
)
'''
if text.count(old_helper) != 1:
    raise RuntimeError('builder helper anchor mismatch')
if text.count(old_calls) != 1:
    raise RuntimeError('builder call anchor mismatch')
if text.count(old_diag) != 1:
    raise RuntimeError('builder diagnostic anchor mismatch')
text = text.replace(old_helper, new_helper, 1)
text = text.replace(old_calls, new_calls, 1)
text = text.replace(old_diag, new_diag, 1)
path.write_text(text, encoding='utf-8')
