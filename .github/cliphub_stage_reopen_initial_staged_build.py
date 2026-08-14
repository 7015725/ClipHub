import base64
import gzip
import hashlib
import json
import pathlib
import re
import subprocess

LOADER = pathlib.Path('src/ch_11_filter.js')
MANIFEST = pathlib.Path('module-manifest.json')
RUNNER = pathlib.Path('.github/cliphub_stage_reopen_initial_staged_build.py')
WORKFLOW = pathlib.Path('.github/workflows/cliphub_stage_reopen_initial_staged_build.yml')

EXPECTED_BRANCH = 'beta-regex-settings-tabs-20260814'
EXPECTED_SET = '20260814.05'
NEXT_SET = '20260814.06'
EXPECTED_HEADER = '/* ClipHub advanced drawer safe packed full Filter74 ES5 loader. */'
NEXT_HEADER = '/* ClipHub panel data refresh initial staged packed full Filter75 ES5 loader. */'

OLD_CONDITION = '''        if (String(performance.lastRefreshOrigin || "") !==
                "panel_first_content" || Number(range.start) !== 0 ||
                Number(range.first) > 2 ||
                Number(virtualCardHost.getChildCount()) !== 0) {
            return false;
        }'''

NEW_CONDITION = '''        if ((String(performance.lastRefreshOrigin || "") !==
                "panel_first_content" &&
                String(performance.lastRefreshOrigin || "") !==
                "panel_data_refresh") || Number(range.start) !== 0 ||
                Number(range.first) > 2 ||
                Number(virtualCardHost.getChildCount()) !== 0) {
            return false;
        }'''


def run(args, **kwargs):
    return subprocess.run(args, text=True, **kwargs)


def unpack(loader):
    match = re.search(
        r'var PACKED_B64 =\n((?:\s*"[A-Za-z0-9+/=]+"\s*\+?\n?)+);',
        loader)
    if not match:
        raise RuntimeError('PACKED_B64 missing')
    packed = ''.join(re.findall(r'"([A-Za-z0-9+/=]+)"', match.group(1)))
    source = gzip.decompress(base64.b64decode(packed)).decode('utf-8')
    return source, match


def pack_assignment(source):
    encoded = base64.b64encode(
        gzip.compress(source.encode('utf-8'), compresslevel=9, mtime=0)
    ).decode('ascii')
    pieces = [encoded[i:i + 120] for i in range(0, len(encoded), 120)]
    return 'var PACKED_B64 =\n' + ''.join(
        '        ' + json.dumps(piece) +
        (' +\n' if index < len(pieces) - 1 else ';')
        for index, piece in enumerate(pieces)
    )


def git_blob_sha(data):
    return hashlib.sha1(
        ('blob %d\0' % len(data)).encode('ascii') + data
    ).hexdigest()


def check_es5(source):
    if re.search(r'(^|[^A-Za-z0-9_])(let|const|class)[\s]+|=>', source):
        raise RuntimeError('non-ES5 syntax detected')


def build():
    loader = LOADER.read_text(encoding='utf-8')
    manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))

    if manifest.get('sourceRef') != EXPECTED_BRANCH:
        raise RuntimeError('unexpected sourceRef: %r' % manifest.get('sourceRef'))
    if manifest.get('moduleSetVersion') != EXPECTED_SET:
        raise RuntimeError('unexpected moduleSetVersion: %r' % manifest.get('moduleSetVersion'))
    if EXPECTED_HEADER not in loader:
        raise RuntimeError('expected Filter74 loader header missing')
    if loader.count(EXPECTED_HEADER) != 1:
        raise RuntimeError('Filter74 loader header count mismatch')

    source, packed_match = unpack(loader)
    if source.count('MODULE_VERSION: 74') != 1:
        raise RuntimeError('MODULE_VERSION 74 count mismatch')
    if source.count(OLD_CONDITION) != 1:
        raise RuntimeError('initial staged origin condition count mismatch')
    if '"panel_data_refresh") || Number(range.start)' in source:
        raise RuntimeError('panel_data_refresh staged route already present')

    expected = source.replace('MODULE_VERSION: 74', 'MODULE_VERSION: 75', 1)
    expected = expected.replace(OLD_CONDITION, NEW_CONDITION, 1)
    transformed = source.replace('MODULE_VERSION: 74', 'MODULE_VERSION: 75', 1)
    transformed = transformed.replace(OLD_CONDITION, NEW_CONDITION, 1)
    if transformed != expected:
        raise RuntimeError('unexpected source transformation')

    required = [
        'MODULE_VERSION: 75',
        'INITIAL_STAGED_SYNC_MIN_CARDS = 8',
        'INITIAL_STAGED_SYNC_MAX_CARDS = 12',
        'INITIAL_STAGED_MIN_REMAINING = 8',
        'INITIAL_STAGED_BUDGET_MS = 14',
        'INITIAL_STAGED_MAX_CARDS_PER_BATCH = 3',
        'VIRTUAL_BEFORE_SCREENS = 3',
        'VIRTUAL_AFTER_SCREENS = 5',
        'VIRTUAL_UPDATE_DELAY_MS = 24',
        'function startInitialStagedFill',
        'function runInitialStagedFillBatch',
        'function startKeyedStagedReconcile',
        'function preemptStagedAjaxAttachForScroll',
        '"panel_first_content" &&',
        '"panel_data_refresh") || Number(range.start) !== 0'
    ]
    for token in required:
        if token not in transformed:
            raise RuntimeError('required invariant missing: ' + token)
    check_es5(transformed)

    pathlib.Path('/tmp/cliphub_filter75_source.js').write_text(
        transformed, encoding='utf-8')
    subprocess.check_call(['node', '--check', '/tmp/cliphub_filter75_source.js'])

    source_sha = hashlib.sha256(transformed.encode('utf-8')).hexdigest()
    replacement = pack_assignment(transformed)
    loader = loader[:packed_match.start()] + replacement + loader[packed_match.end():]
    loader = loader.replace(EXPECTED_HEADER, NEXT_HEADER, 1)
    loader = re.sub(
        r'var SOURCE_SHA256 = "[0-9a-f]{64}";',
        'var SOURCE_SHA256 = "%s";' % source_sha,
        loader,
        count=1)

    if NEXT_HEADER not in loader:
        raise RuntimeError('Filter75 loader header missing after pack')
    if loader.count('var SOURCE_SHA256 = "%s";' % source_sha) != 1:
        raise RuntimeError('SOURCE_SHA256 replacement failed')

    pathlib.Path('/tmp/cliphub_filter75_loader.js').write_text(
        loader, encoding='utf-8')
    subprocess.check_call(['node', '--check', '/tmp/cliphub_filter75_loader.js'])
    LOADER.write_text(loader, encoding='utf-8')

    data = loader.encode('utf-8')
    blob_sha = git_blob_sha(data)
    manifest['moduleSetVersion'] = NEXT_SET
    found = False
    for module in manifest.get('modules', []):
        if module.get('name') == 'ch_11_filter.js':
            module['sha'] = blob_sha
            found = True
    if not found:
        raise RuntimeError('manifest filter entry missing')
    if manifest.get('entryMinVersion') != 6:
        raise RuntimeError('entryMinVersion changed unexpectedly')
    if manifest.get('sourceRef') != EXPECTED_BRANCH:
        raise RuntimeError('sourceRef changed unexpectedly')

    MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8')
    return blob_sha, source_sha


def publish(blob_sha, source_sha):
    subprocess.check_call(['git', 'config', 'user.name', 'github-actions[bot]'])
    subprocess.check_call([
        'git', 'config', 'user.email',
        '41898282+github-actions[bot]@users.noreply.github.com'
    ])

    for path in [RUNNER, WORKFLOW]:
        try:
            path.unlink()
        except FileNotFoundError:
            pass

    subprocess.check_call(['git', 'add', '-A'])
    subprocess.check_call(['git', 'diff', '--cached', '--check'])
    staged = subprocess.check_output(
        ['git', 'diff', '--cached', '--name-only'], text=True).splitlines()
    unexpected = [
        path for path in staged
        if path not in [
            'src/ch_11_filter.js',
            'module-manifest.json',
            str(RUNNER),
            str(WORKFLOW)
        ]
    ]
    if unexpected:
        raise RuntimeError('unexpected staged paths: %r' % unexpected)

    subprocess.check_call([
        'git', 'commit', '-m',
        '优化缓存重开 initial staged 路由'
    ])
    subprocess.check_call(['git', 'push', 'origin', 'HEAD:' + EXPECTED_BRANCH])
    print('Filter75 blob=' + blob_sha)
    print('Filter75 source_sha256=' + source_sha)


def main():
    blob_sha, source_sha = build()
    publish(blob_sha, source_sha)


if __name__ == '__main__':
    main()
