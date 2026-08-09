import base64,gzip,hashlib,json,pathlib,re,subprocess,sys

LOADER=pathlib.Path('src/ch_11_filter.js')
MANIFEST=pathlib.Path('module-manifest.json')


def replace_once(text, old, new, label):
    count=text.count(old)
    if count!=1:
        raise RuntimeError('%s anchor count=%d' % (label,count))
    return text.replace(old,new,1)


def replace_function(src,name,new_text):
    marker='    function '+name+'('
    start=src.find(marker)
    if start<0: raise RuntimeError('missing function '+name)
    end=src.find('\n    function ',start+len(marker))
    if end<0: raise RuntimeError('function end missing '+name)
    return src[:start]+new_text.rstrip()+src[end:]


def unpack(loader):
    m=re.search(r'var PACKED_B64 =\n((?:\s*"[A-Za-z0-9+/=]+"\s*\+?\n?)+);',loader)
    if not m: raise RuntimeError('PACKED_B64 missing')
    packed=''.join(re.findall(r'"([A-Za-z0-9+/=]+)"',m.group(1)))
    return gzip.decompress(base64.b64decode(packed)).decode('utf-8'),m


def pack_assignment(data):
    enc=base64.b64encode(gzip.compress(data.encode('utf-8'),compresslevel=9,mtime=0)).decode('ascii')
    pieces=[enc[i:i+120] for i in range(0,len(enc),120)]
    return 'var PACKED_B64 =\n'+''.join('        '+json.dumps(p)+(' +\n' if i<len(pieces)-1 else ';') for i,p in enumerate(pieces))


def build():
    loader=LOADER.read_text(encoding='utf-8')
    manifest=json.loads(MANIFEST.read_text(encoding='utf-8'))
    if manifest.get('moduleSetVersion')!='20260808.20': raise RuntimeError('expected .20 manifest')
    if 'Stage 17.1 packed full Filter66 ES5 loader' not in loader: raise RuntimeError('expected Filter66 packed loader')
    src,m=unpack(loader)
    src=replace_once(src,'MODULE_VERSION: 66','MODULE_VERSION: 67','module version')

    src=replace_once(src,
        '        stagedAttachScrollPreemptCount: 0,\n        stagedAttachObsoleteCardAvoidedCount: 0,\n        stagedAttachPendingCount: 0,\n',
        '        stagedAttachScrollPreemptCount: 0,\n        stagedAttachObsoleteCardAvoidedCount: 0,\n        stagedAttachRetargetCount: 0,\n        stagedAttachRetargetReusedCount: 0,\n        stagedAttachRetargetRemovedCount: 0,\n        stagedAttachRetargetPendingCount: 0,\n        stagedAttachSyncCatchupAvoidedCount: 0,\n        stagedAttachPendingCount: 0,\n',
        'metrics init')
    src=replace_once(src,
        '        scrollPerformanceState.stagedAttachScrollPreemptCount = 0;\n        scrollPerformanceState.stagedAttachObsoleteCardAvoidedCount = 0;\n        scrollPerformanceState.stagedAttachPendingCount = 0;\n',
        '        scrollPerformanceState.stagedAttachScrollPreemptCount = 0;\n        scrollPerformanceState.stagedAttachObsoleteCardAvoidedCount = 0;\n        scrollPerformanceState.stagedAttachRetargetCount = 0;\n        scrollPerformanceState.stagedAttachRetargetReusedCount = 0;\n        scrollPerformanceState.stagedAttachRetargetRemovedCount = 0;\n        scrollPerformanceState.stagedAttachRetargetPendingCount = 0;\n        scrollPerformanceState.stagedAttachSyncCatchupAvoidedCount = 0;\n        scrollPerformanceState.stagedAttachPendingCount = 0;\n',
        'metrics reset')
    src=replace_once(src,
        '            stagedAttachObsoleteCardAvoidedCount:\n                Number(scrollPerformanceState.stagedAttachObsoleteCardAvoidedCount),\n            stagedAttachPendingCount:\n',
        '            stagedAttachObsoleteCardAvoidedCount:\n                Number(scrollPerformanceState.stagedAttachObsoleteCardAvoidedCount),\n            stagedAttachRetargetCount:\n                Number(scrollPerformanceState.stagedAttachRetargetCount),\n            stagedAttachRetargetReusedCount:\n                Number(scrollPerformanceState.stagedAttachRetargetReusedCount),\n            stagedAttachRetargetRemovedCount:\n                Number(scrollPerformanceState.stagedAttachRetargetRemovedCount),\n            stagedAttachRetargetPendingCount:\n                Number(scrollPerformanceState.stagedAttachRetargetPendingCount),\n            stagedAttachSyncCatchupAvoidedCount:\n                Number(scrollPerformanceState.stagedAttachSyncCatchupAvoidedCount),\n            stagedAttachPendingCount:\n',
        'metrics copy')

    new_preempt='''    function preemptStagedAjaxAttachForScroll(origin, force, preferredIndex) {
        var requestedOrigin = String(origin || "virtual_rebuild");
        var range;
        var threshold;
        var pendingStart;
        var pendingEnd;
        var overlapStart;
        var overlapEnd;
        var overlapPending;
        var avoided;
        var hydration;
        var oldCount;
        var oldStart;
        var oldEnd;
        var removeTop;
        var removeBottom;
        var removeIndex;
        var removedCount;
        var retainedCount;
        var pendingCount;
        var generation;
        if (ajaxStagedAttachState.active !== true ||
                requestedOrigin !== "result_scroll") {
            return false;
        }
        range = virtualTargetRange(preferredIndex);
        threshold = Math.max(1, Number(virtualState.visibleCount || 1));
        if (Number(range.first) <=
                Number(ajaxStagedAttachState.startVisibleIndex) ||
                Number(range.first) -
                Number(ajaxStagedAttachState.startVisibleIndex) < threshold) {
            return false;
        }
        if (virtualCardHost === null || !state.panelAttached ||
                Number(range.start) < Number(virtualState.firstRenderedIndex)) {
            return false;
        }
        oldCount = Number(virtualCardHost.getChildCount());
        if (virtualRenderedItemIds.length !== oldCount ||
                virtualRenderedSignatures.length !== oldCount ||
                resultCardViews.length !== oldCount ||
                resultCardHolders.length !== oldCount ||
                resultActionViews.length !== oldCount) {
            return false;
        }
        hydration = hydrateDataWindowRange(
            range.start, range.end, "result_scroll_retarget_hydrate");
        if (hydration.pending === true &&
                hydration.requiresRows === true) {
            deferVirtualUpdateDuringStagedAttach(origin, force);
            return true;
        }
        dehydrateDataWindowOutside(
            range.start, range.end, "result_scroll_retarget_dehydrate");
        generation = Number(ajaxStagedAttachState.generation);
        pendingStart = Number(ajaxStagedAttachState.nextIndex);
        pendingEnd = Number(ajaxStagedAttachState.targetEnd);
        overlapStart = Math.max(pendingStart, Number(range.start));
        overlapEnd = Math.min(pendingEnd, Number(range.end));
        overlapPending = overlapEnd >= overlapStart ?
            overlapEnd - overlapStart + 1 : 0;
        avoided = Math.max(0,
            pendingEnd - pendingStart + 1 - overlapPending);
        oldStart = Number(virtualState.firstRenderedIndex);
        oldEnd = oldCount > 0 ? oldStart + oldCount - 1 : oldStart - 1;
        removeTop = Math.min(oldCount,
            Math.max(0, Number(range.start) - oldStart));
        for (removeIndex = 0; removeIndex < removeTop; removeIndex += 1) {
            virtualCardHost.removeViewAt(0);
            virtualRenderedItemIds.shift();
            virtualRenderedSignatures.shift();
            resultCardViews.shift();
            resultCardHolders.shift();
            resultActionViews.shift();
        }
        oldCount = Number(virtualCardHost.getChildCount());
        oldStart = Number(range.start);
        oldEnd = oldCount > 0 ? oldStart + oldCount - 1 : oldStart - 1;
        removeBottom = Math.min(oldCount,
            Math.max(0, oldEnd - Number(range.end)));
        for (removeIndex = 0; removeIndex < removeBottom; removeIndex += 1) {
            virtualCardHost.removeViewAt(
                Number(virtualCardHost.getChildCount()) - 1);
            virtualRenderedItemIds.pop();
            virtualRenderedSignatures.pop();
            resultCardViews.pop();
            resultCardHolders.pop();
            resultActionViews.pop();
        }
        removedCount = removeTop + removeBottom;
        retainedCount = Number(virtualCardHost.getChildCount());
        ajaxStagedAttachState.targetStart = Number(range.start);
        ajaxStagedAttachState.targetEnd = Number(range.end);
        ajaxStagedAttachState.nextIndex = Number(range.start) + retainedCount;
        ajaxStagedAttachState.startVisibleIndex = Number(range.first);
        pendingCount = Math.max(0,
            Number(range.end) - Number(ajaxStagedAttachState.nextIndex) + 1);
        virtualState.firstVisibleIndex = Number(range.first);
        virtualState.lastVisibleIndex = Number(range.last);
        virtualState.firstRenderedIndex = Number(range.start);
        virtualState.lastRenderedIndex = Math.max(
            Number(range.start) - 1,
            Number(ajaxStagedAttachState.nextIndex) - 1);
        virtualState.topSpacerPx = setVirtualSpacerHeight(
            virtualTopSpacer, virtualHeightRange(0, range.start));
        virtualState.bottomSpacerPx = setVirtualSpacerHeight(
            virtualBottomSpacer, virtualHeightRange(
                virtualState.lastRenderedIndex + 1, previewRows.length));
        state.resultCardCount = Number(virtualCardHost.getChildCount());
        if (removedCount > 0) {
            scrollPerformanceState.removedViewCount += removedCount;
            scrollPerformanceState.structuralRemoveCount += removedCount;
        }
        scrollPerformanceState.stagedAttachScrollPreemptCount += 1;
        scrollPerformanceState.stagedAttachObsoleteCardAvoidedCount += avoided;
        scrollPerformanceState.stagedAttachRetargetCount += 1;
        scrollPerformanceState.stagedAttachRetargetReusedCount += retainedCount;
        scrollPerformanceState.stagedAttachRetargetRemovedCount += removedCount;
        scrollPerformanceState.stagedAttachRetargetPendingCount = pendingCount;
        scrollPerformanceState.stagedAttachSyncCatchupAvoidedCount += pendingCount;
        scrollPerformanceState.stagedAttachPendingCount = pendingCount;
        if (pendingCount <= 0) {
            return finishStagedAjaxAttach(generation);
        }
        return true;
    }'''
    src=replace_function(src,'preemptStagedAjaxAttachForScroll',new_preempt)

    # Clear the retarget-pending gauge when staged work terminates normally or by cancellation.
    src=replace_once(src,
        '        scrollPerformanceState.stagedAttachPendingCount = 0;\n        scrollPerformanceState.stagedAttachCancelCount += 1;\n',
        '        scrollPerformanceState.stagedAttachPendingCount = 0;\n        scrollPerformanceState.stagedAttachRetargetPendingCount = 0;\n        scrollPerformanceState.stagedAttachCancelCount += 1;\n',
        'cancel gauge clear')
    src=replace_once(src,
        '        scrollPerformanceState.stagedAttachPendingCount = 0;\n        scrollPerformanceState.stagedAttachCompletedCount += 1;\n',
        '        scrollPerformanceState.stagedAttachPendingCount = 0;\n        scrollPerformanceState.stagedAttachRetargetPendingCount = 0;\n        scrollPerformanceState.stagedAttachCompletedCount += 1;\n',
        'finish gauge clear')

    required=[
        'MODULE_VERSION: 67',
        'AJAX_STAGED_ATTACH_BUDGET_MS = 14',
        'AJAX_STAGED_ATTACH_DELAY_MS = 0',
        'AJAX_STAGED_ATTACH_MAX_CARDS_PER_BATCH = 3',
        'AJAX_STAGED_ATTACH_MIN_CARDS = 8',
        'stagedAttachRetargetCount',
        'stagedAttachRetargetReusedCount',
        'stagedAttachRetargetRemovedCount',
        'stagedAttachRetargetPendingCount',
        'stagedAttachSyncCatchupAvoidedCount',
        'result_scroll_retarget_hydrate',
        'ajaxStagedAttachState.nextIndex = Number(range.start) + retainedCount',
    ]
    for token in required:
        if token not in src: raise RuntimeError('missing token '+token)
    if 'cancelStagedAjaxAttach("scroll_preempt")' in src:
        raise RuntimeError('old scroll_preempt cancel remains')
    for token in ['VIRTUAL_BEFORE_SCREENS = 3','VIRTUAL_AFTER_SCREENS = 5','VIRTUAL_UPDATE_DELAY_MS = 24']:
        if token not in src: raise RuntimeError('virtual invariant changed '+token)
    if src.count('.newSingleThreadExecutor();')!=1: raise RuntimeError('worker invariant changed')
    if re.search(r'(^|[^A-Za-z0-9_])(let|const|class)[\s]+|=>',src): raise RuntimeError('non-ES5 syntax')
    pathlib.Path('/tmp/filter67.js').write_text(src,encoding='utf-8')
    subprocess.check_call(['node','--check','/tmp/filter67.js'])

    source_sha=hashlib.sha256(src.encode('utf-8')).hexdigest()
    assignment=pack_assignment(src)
    loader=loader[:m.start()]+assignment+loader[m.end():]
    loader=replace_once(loader,
        '/* ClipHub Stage 17.1 packed full Filter66 ES5 loader. */',
        '/* ClipHub Stage 17.2 staged retarget packed full Filter67 ES5 loader. */',
        'loader header')
    loader=re.sub(r'var SOURCE_SHA256 = "[0-9a-f]{64}";',
                  'var SOURCE_SHA256 = '+json.dumps(source_sha)+';',loader,count=1)
    LOADER.write_text(loader,encoding='utf-8')
    subprocess.check_call(['node','--check',str(LOADER)])
    data=LOADER.read_bytes()
    blob_sha=hashlib.sha1(('blob %d\0'%len(data)).encode('ascii')+data).hexdigest()
    manifest['moduleSetVersion']='20260808.21'
    found=False
    for mod in manifest.get('modules',[]):
        if mod.get('name')=='ch_11_filter.js':
            mod['sha']=blob_sha; found=True
    if not found: raise RuntimeError('manifest filter missing')
    MANIFEST.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return source_sha,blob_sha


def main():
    try:
        source_sha,blob_sha=build()
        for p in [
            'stage17_2_build_runner.py','stage17_2_diag.py','stage17_2_diag.txt',
            'stage17_2_runStagedAjaxAttachBatch.txt','stage17_2_preemptStagedAjaxAttachForScroll.txt',
            'stage17_2_startStagedAjaxAttach.txt','stage17_2_finishStagedAjaxAttach.txt',
            'stage17_2_rebuildVirtualWindow.txt','stage17_2_virtualTargetRange.txt',
            '.github/stage17_2_diag_trigger.txt','.github/workflows/beta_stage17_2_diag.yml'
        ]:
            try: pathlib.Path(p).unlink()
            except FileNotFoundError: pass
        subprocess.check_call(['git','config','user.name','github-actions[bot]'])
        subprocess.check_call(['git','config','user.email','41898282+github-actions[bot]@users.noreply.github.com'])
        subprocess.check_call(['git','add','-A'])
        subprocess.check_call(['git','diff','--cached','--check'])
        subprocess.check_call(['git','commit','-m','优化 Beta staged attach 滚动重定向'])
        subprocess.check_call(['git','push'])
        print('Filter67 source sha256',source_sha)
        print('Filter67 loader blob',blob_sha)
    except Exception as exc:
        pathlib.Path('stage17_2_build_error.txt').write_text(repr(exc)+'\n',encoding='utf-8')
        subprocess.run(['git','restore','src/ch_11_filter.js','module-manifest.json'])
        subprocess.check_call(['git','config','user.name','github-actions[bot]'])
        subprocess.check_call(['git','config','user.email','41898282+github-actions[bot]@users.noreply.github.com'])
        subprocess.check_call(['git','add','stage17_2_build_error.txt'])
        if subprocess.run(['git','diff','--cached','--quiet']).returncode!=0:
            subprocess.check_call(['git','commit','-m','记录 Stage17.2 构建失败'])
            subprocess.check_call(['git','push'])
        return 1
    return 0

if __name__=='__main__': sys.exit(main())
