import base64
import gzip
import glob
import hashlib
import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path('.')
LOADER = pathlib.Path('src/ch_11_filter.js')
MANIFEST = pathlib.Path('module-manifest.json')
BRANCH = 'beta-pagination-stage10-20260808'


def run(args, **kwargs):
    return subprocess.run(args, text=True, **kwargs)


def git_config():
    subprocess.check_call(['git', 'config', 'user.name', 'github-actions[bot]'])
    subprocess.check_call(['git', 'config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'])


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError('%s anchor count=%d' % (label, count))
    return text.replace(old, new, 1)


def build():
    loader = LOADER.read_text(encoding='utf-8')
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
    if manifest.get('moduleSetVersion') != '20260808.19':
        raise RuntimeError('expected .19 manifest')
    if 'Stage 17 AJAX staged attach ES5 loader' not in loader:
        raise RuntimeError('expected Stage17 loader')
    m = re.search(r'var PATCH_B64 =\n((?:\s*"[A-Za-z0-9+/=]+"\s*\+?\n?)+);', loader)
    if not m:
        raise RuntimeError('PATCH_B64 missing')
    patch = base64.b64decode(''.join(re.findall(r'"([A-Za-z0-9+/=]+)"', m.group(1)))).decode('utf-8')

    stage171 = r'''
    function transformStage171Source(source) {
        var info;
        var value;
        source = replaceOnceStrict(source,
            "MODULE_VERSION: 65", "MODULE_VERSION: 66",
            "Stage17.1 module version");
        source = replaceOnceStrict(source,
            "    var AJAX_STAGED_ATTACH_BUDGET_MS = 8;\n",
            "    var AJAX_STAGED_ATTACH_BUDGET_MS = 14;\n",
            "Stage17.1 batch budget");
        source = replaceOnceStrict(source,
            "    var AJAX_STAGED_ATTACH_DELAY_MS = 8;\n",
            "    var AJAX_STAGED_ATTACH_DELAY_MS = 0;\n",
            "Stage17.1 batch delay");
        source = replaceOnceStrict(source,
            "        targetEnd: -1,\n" +
            "        nextIndex: 0,\n",
            "        targetEnd: -1,\n" +
            "        nextIndex: 0,\n" +
            "        startVisibleIndex: 0,\n",
            "Stage17.1 staged visible anchor");
        source = replaceOnceStrict(source,
            "        stagedAttachDeferredUpdateCount: 0,\n",
            "        stagedAttachDeferredUpdateCount: 0,\n" +
            "        stagedAttachScrollPreemptCount: 0,\n" +
            "        stagedAttachObsoleteCardAvoidedCount: 0,\n",
            "Stage17.1 metrics init");
        source = replaceOnceStrict(source,
            "        scrollPerformanceState.stagedAttachDeferredUpdateCount = 0;\n",
            "        scrollPerformanceState.stagedAttachDeferredUpdateCount = 0;\n" +
            "        scrollPerformanceState.stagedAttachScrollPreemptCount = 0;\n" +
            "        scrollPerformanceState.stagedAttachObsoleteCardAvoidedCount = 0;\n",
            "Stage17.1 metrics reset");
        source = replaceOnceStrict(source,
            "            stagedAttachDeferredUpdateCount:\n" +
            "                Number(scrollPerformanceState.stagedAttachDeferredUpdateCount),\n",
            "            stagedAttachDeferredUpdateCount:\n" +
            "                Number(scrollPerformanceState.stagedAttachDeferredUpdateCount),\n" +
            "            stagedAttachScrollPreemptCount:\n" +
            "                Number(scrollPerformanceState.stagedAttachScrollPreemptCount),\n" +
            "            stagedAttachObsoleteCardAvoidedCount:\n" +
            "                Number(scrollPerformanceState.stagedAttachObsoleteCardAvoidedCount),\n",
            "Stage17.1 metrics copy");

        info = section(source,
            "    function postStagedAjaxAttachBatch(generation, delayMs) {",
            "\n    function ",
            "Stage17.1 batch post");
        value =
            "    function postStagedAjaxAttachBatch(generation, delayMs) {\n" +
            "        var runnable;\n" +
            "        if (mainHandler === null) { return false; }\n" +
            "        runnable = new Packages.java.lang.Runnable({\n" +
            "            run: function () {\n" +
            "                runStagedAjaxAttachBatch(generation);\n" +
            "            }\n" +
            "        });\n" +
            "        if (Number(delayMs || 0) <= 0) {\n" +
            "            mainHandler.post(runnable);\n" +
            "        } else {\n" +
            "            mainHandler.postDelayed(runnable,\n" +
            "                Math.max(0, Number(delayMs || 0)));\n" +
            "        }\n" +
            "        return true;\n" +
            "    }";
        source = replaceSection(source, info, value);

        source = replaceOnceStrict(source,
            "    function startStagedAjaxAttach(generation, appendedRows, colors) {\n",
            "    function preemptStagedAjaxAttachForScroll(origin, force, preferredIndex) {\n" +
            "        var requestedOrigin = String(origin || \\\"virtual_rebuild\\\");\n" +
            "        var range;\n" +
            "        var threshold;\n" +
            "        var pendingStart;\n" +
            "        var pendingEnd;\n" +
            "        var overlapStart;\n" +
            "        var overlapEnd;\n" +
            "        var overlapPending;\n" +
            "        var avoided;\n" +
            "        var generation;\n" +
            "        var rows;\n" +
            "        var colors;\n" +
            "        var deferredOrigin;\n" +
            "        var deferredForce;\n" +
            "        if (ajaxStagedAttachState.active !== true ||\n" +
            "                requestedOrigin !== \\\"result_scroll\\\") {\n" +
            "            return false;\n" +
            "        }\n" +
            "        range = virtualTargetRange(preferredIndex);\n" +
            "        threshold = Math.max(1, Number(virtualState.visibleCount || 1));\n" +
            "        if (Math.abs(Number(range.first) -\n" +
            "                Number(ajaxStagedAttachState.startVisibleIndex)) < threshold) {\n" +
            "            return false;\n" +
            "        }\n" +
            "        generation = Number(ajaxStagedAttachState.generation);\n" +
            "        rows = ajaxStagedAttachState.appendedRows;\n" +
            "        colors = ajaxStagedAttachState.colors;\n" +
            "        deferredOrigin = String(ajaxStagedAttachState.deferredOrigin || \\\"\\\");\n" +
            "        deferredForce = ajaxStagedAttachState.deferredForce === true;\n" +
            "        pendingStart = Number(ajaxStagedAttachState.nextIndex);\n" +
            "        pendingEnd = Number(ajaxStagedAttachState.targetEnd);\n" +
            "        overlapStart = Math.max(pendingStart, Number(range.start));\n" +
            "        overlapEnd = Math.min(pendingEnd, Number(range.end));\n" +
            "        overlapPending = overlapEnd >= overlapStart ?\n" +
            "            overlapEnd - overlapStart + 1 : 0;\n" +
            "        avoided = Math.max(0, pendingEnd - pendingStart + 1 - overlapPending);\n" +
            "        scrollPerformanceState.stagedAttachScrollPreemptCount += 1;\n" +
            "        scrollPerformanceState.stagedAttachObsoleteCardAvoidedCount += avoided;\n" +
            "        cancelStagedAjaxAttach(\\\"scroll_preempt\\\");\n" +
            "        if (!state.panelAttached) { return true; }\n" +
            "        rebuildVirtualWindow(requestedOrigin, force === true, preferredIndex);\n" +
            "        if (Number(generation) === Number(ajaxAppendGeneration) &&\n" +
            "                state.panelAttached && rows !== null && rows !== undefined) {\n" +
            "            finishAjaxAppendRender(generation, rows, colors);\n" +
            "        }\n" +
            "        if (deferredOrigin.length > 0 && state.panelAttached &&\n" +
            "                (deferredForce || deferredOrigin !== requestedOrigin)) {\n" +
            "            scheduleVirtualUpdate(deferredOrigin, deferredForce);\n" +
            "        }\n" +
            "        return true;\n" +
            "    }\n\n" +
            "    function startStagedAjaxAttach(generation, appendedRows, colors) {\n",
            "Stage17.1 scroll preempt helper");
        source = replaceOnceStrict(source,
            "        ajaxStagedAttachState.nextIndex = oldEnd + 1;\n" +
            "        ajaxStagedAttachState.colors = colors;\n",
            "        ajaxStagedAttachState.nextIndex = oldEnd + 1;\n" +
            "        ajaxStagedAttachState.startVisibleIndex = Number(range.first);\n" +
            "        ajaxStagedAttachState.colors = colors;\n",
            "Stage17.1 visible anchor capture");

        info = section(source,
            "    function rebuildVirtualWindow(origin, force, preferredIndex) {",
            "\n    function ",
            "Stage17.1 rebuild guard");
        value = info.text;
        value = replaceOnceStrict(value,
            "        if (ajaxStagedAttachState.active === true) {\n" +
            "            deferVirtualUpdateDuringStagedAttach(origin, force);\n" +
            "            return false;\n" +
            "        }\n",
            "        if (ajaxStagedAttachState.active === true) {\n" +
            "            if (preemptStagedAjaxAttachForScroll(\n" +
            "                    origin, force, preferredIndex)) {\n" +
            "                return false;\n" +
            "            }\n" +
            "            deferVirtualUpdateDuringStagedAttach(origin, force);\n" +
            "            return false;\n" +
            "        }\n",
            "Stage17.1 preempt guard");
        source = replaceSection(source, info, value);

        if (source.indexOf("MODULE_VERSION: 66") < 0 ||
                source.indexOf("AJAX_STAGED_ATTACH_BUDGET_MS = 14") < 0 ||
                source.indexOf("AJAX_STAGED_ATTACH_DELAY_MS = 0") < 0 ||
                source.indexOf("preemptStagedAjaxAttachForScroll") < 0 ||
                source.indexOf("stagedAttachScrollPreemptCount") < 0 ||
                source.indexOf("stagedAttachObsoleteCardAvoidedCount") < 0) {
            throw new Error("Stage17.1 wiring incomplete");
        }
        return source;
    }
'''
    patch = patch.rstrip() + '\n\n' + stage171.strip() + '\n'
    enc = base64.b64encode(patch.encode('utf-8')).decode('ascii')
    pieces = [enc[i:i+120] for i in range(0, len(enc), 120)]
    assignment = 'var PATCH_B64 =\n' + ''.join(
        '        ' + json.dumps(p) + (' +\n' if i < len(pieces)-1 else ';\n')
        for i, p in enumerate(pieces))
    loader = loader[:m.start()] + assignment + loader[m.end():]

    start = loader.index('        var newEval =\n')
    end = loader.index('        loader = replaceOnce(loader, oldEval, newEval, "baseline eval");', start)
    expr = ('transformStage171Source(transformStage17Source(transformStage16CSource('
            'transformStage16B4Source(transformStage16B3Source(transformStage16B2Source('
            'transformRecycleFixSource(transformRecycleSource(transformCardHolderSource('
            'transformSource(decodeSource(loadPackedSource()))))))))))))')
    new_block = ('        var newEval =\n'
                 '  patchSourceText() + "\\n" +\n'
                 '  "    try {\\n" +\n'
                 '  "        eval(' + expr + ');\\n";\n')
    loader = loader[:start] + new_block + loader[end:]
    loader = replace_once(loader,
        '/* ClipHub Stage 17 AJAX staged attach ES5 loader. */',
        '/* ClipHub Stage 17.1 faster staged attach with scroll preemption ES5 loader. */',
        'loader header')
    loader = loader.replace('?stage17v19=', '?stage171v20=', 1)
    loader = loader.replace('ch_11_filter.js Stage 17 loader failed:',
                            'ch_11_filter.js Stage 17.1 loader failed:', 1)
    loader = loader.replace('ch_11_filter.js Stage 17 wrapper failed:',
                            'ch_11_filter.js Stage 17.1 wrapper failed:', 1)
    LOADER.write_text(loader, encoding='utf-8')

    baseline = subprocess.check_output([
        'git','show','338a811e538ab526b59eed05102d4f4b66f19953:src/ch_11_filter.js'
    ], text=True)
    s = baseline.index('    function replaceOnceStrict(')
    e = baseline.index('\n    try {', s)
    pure = baseline[s:e]
    packed = ''.join(pathlib.Path(p).read_text(encoding='utf-8').strip()
                     for p in sorted(glob.glob('stage-assets/pagination-stage9/ch11_full_v8s_*.b64')))
    stable = gzip.decompress(base64.b64decode(packed)).decode('utf-8')
    harness = ('var Buffer=require("buffer").Buffer;\nvar __source=' + json.dumps(stable) + ';\n' +
               pure + '\n' + patch + '\nvar __out=' + expr.replace('decodeSource(loadPackedSource())','__source') +
               ';\nrequire("fs").writeFileSync("/tmp/filter66.js",__out);\n')
    pathlib.Path('/tmp/stage17_1_validate.js').write_text(harness, encoding='utf-8')
    subprocess.check_call(['node', '/tmp/stage17_1_validate.js'])
    subprocess.check_call(['node', '--check', '/tmp/filter66.js'])
    subprocess.check_call(['node', '--check', str(LOADER)])
    src = pathlib.Path('/tmp/filter66.js').read_text(encoding='utf-8')
    required = [
        'MODULE_VERSION: 66',
        'AJAX_STAGED_ATTACH_BUDGET_MS = 14',
        'AJAX_STAGED_ATTACH_DELAY_MS = 0',
        'AJAX_STAGED_ATTACH_MAX_CARDS_PER_BATCH = 3',
        'AJAX_STAGED_ATTACH_MIN_CARDS = 8',
        'function preemptStagedAjaxAttachForScroll',
        'stagedAttachScrollPreemptCount',
        'stagedAttachObsoleteCardAvoidedCount',
        'startVisibleIndex: 0',
        'mainHandler.post(runnable)',
        'cancelStagedAjaxAttach("scroll_preempt")',
    ]
    for token in required:
        if token not in src:
            raise RuntimeError('missing token: ' + token)
    for token in ['VIRTUAL_BEFORE_SCREENS = 3','VIRTUAL_AFTER_SCREENS = 5','VIRTUAL_UPDATE_DELAY_MS = 24']:
        if token not in src:
            raise RuntimeError('virtual invariant changed: ' + token)
    if src.count('.newSingleThreadExecutor();') != 1:
        raise RuntimeError('worker invariant changed')
    if re.search(r'(^|[^A-Za-z0-9_])(let|const|class)[\s]+|=>', src):
        raise RuntimeError('non-ES5 syntax in Filter66')

    data = LOADER.read_bytes()
    blob_sha = hashlib.sha1(('blob %d\0' % len(data)).encode('ascii') + data).hexdigest()
    manifest['moduleSetVersion'] = '20260808.20'
    found = False
    for mod in manifest.get('modules', []):
        if mod.get('name') == 'ch_11_filter.js':
            mod['sha'] = blob_sha
            found = True
    if not found:
        raise RuntimeError('manifest filter entry missing')
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return blob_sha


def restore_runtime():
    run(['git','restore','src/ch_11_filter.js','module-manifest.json'])


def fail(exc):
    restore_runtime()
    pathlib.Path('stage17_1_build_debug.txt').write_text(repr(exc) + '\n', encoding='utf-8')
    git_config()
    subprocess.check_call(['git','add','stage17_1_build_debug.txt'])
    if run(['git','diff','--cached','--quiet']).returncode != 0:
        subprocess.check_call(['git','commit','-m','记录 Stage17.1 构建失败诊断'])
        subprocess.check_call(['git','push'])


def publish(blob_sha):
    git_config()
    for name in [
        '.github/stage17_1_diag_trigger.txt',
        '.github/workflows/beta_stage17_1_diag.yml',
        'stage17_1_diag.txt',
        'stage17_1_build_debug.txt',
        'stage17_1_build_runner.py',
    ]:
        try:
            pathlib.Path(name).unlink()
        except FileNotFoundError:
            pass
    subprocess.check_call(['git','add','-A'])
    subprocess.check_call(['git','diff','--cached','--check'])
    subprocess.check_call(['git','commit','-m','优化 Beta AJAX 分帧调度与滚动抢占'])
    subprocess.check_call(['git','push'])
    print('Filter66 blob', blob_sha)


def main():
    try:
        sha = build()
    except Exception as exc:
        fail(exc)
        return 0
    publish(sha)
    return 0


if __name__ == '__main__':
    sys.exit(main())
