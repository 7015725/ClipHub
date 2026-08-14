import base64
import gzip
import hashlib
import json
import pathlib
import re
import subprocess
import traceback

LOADER = pathlib.Path('src/ch_11_filter.js')
MANIFEST = pathlib.Path('module-manifest.json')
RUNNER = pathlib.Path('.github/cliphub_stage_reopen_initial_staged_build.py')
WORKFLOW = pathlib.Path('.github/workflows/cliphub_stage_reopen_initial_staged_build.yml')
ERROR_FILE = pathlib.Path('cliphub_stage_reopen_initial_staged_error.txt')

EXPECTED_BRANCH = 'beta-regex-settings-tabs-20260814'
EXPECTED_SET = '20260814.05'
NEXT_SET = '20260814.06'
EXPECTED_MODULE_VERSION = 81
NEXT_MODULE_VERSION = 82
EXPECTED_HEADER = '/* ClipHub advanced drawer safe packed full Filter74 ES5 loader. */'
NEXT_HEADER = '/* ClipHub panel data refresh initial staged packed full Filter82 ES5 loader. */'

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
    if EXPECTED_HEADER not in loader or loader.count(EXPECTED_HEADER) != 1:
        raise RuntimeError('expected packed loader header mismatch')

    source, packed_match = unpack(loader)
    version_matches = re.findall(r'MODULE_VERSION:\s*(\d+)', source)
    if version_matches != [str(EXPECTED_MODULE_VERSION)]:
        raise RuntimeError('unexpected MODULE_VERSION values: %r' % version_matches)
    if source.count(OLD_CONDITION) != 1:
        raise RuntimeError('initial staged origin condition count mismatch')
    if '"panel_data_refresh") || Number(range.start)' in source:
        raise RuntimeError('panel_data_refresh staged route already present')

    old_version = 'MODULE_VERSION: %d' % EXPECTED_MODULE_VERSION
    new_version = 'MODULE_VERSION: %d' % NEXT_MODULE_VERSION
    transformed = source.replace(old_version, new_version, 1)
    transformed = transformed.replace(OLD_CONDITION, NEW_CONDITION, 1)

    reverse = transformed.replace(new_version, old_version, 1)
    reverse = reverse.replace(NEW_CONDITION, OLD_CONDITION, 1)
    if reverse != source:
        raise RuntimeError('source diff escaped the two approved edits')

    required = [
        new_version,
        'function startInitialStagedFill',
        'function runInitialStagedFillBatch',
        'function startKeyedStagedReconcile',
        'function preemptStagedAjaxAttachForScroll',
        'INITIAL_STAGED_SYNC_MIN_CARDS',
        'INITIAL_STAGED_MIN_REMAINING',
        'VIRTUAL_BEFORE_SCREENS',
        'VIRTUAL_AFTER_SCREENS',
        'VIRTUAL_UPDATE_DELAY_MS',
        '"panel_first_content" &&',
        '"panel_data_refresh") || Number(range.start) !== 0'
    ]
    for token in required:
        if token not in transformed:
            raise RuntimeError('required invariant missing: ' + token)
    check_es5(transformed)

    pathlib.Path('/tmp/cliphub_filter82_source.js').write_text(
        transformed, encoding='utf-8')
    subprocess.check_call(['node', '--check', '/tmp/cliphub_filter82_source.js'])

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
        raise RuntimeError('Filter82 loader header missing after pack')
    if loader.count('var SOURCE_SHA256 = "%s";' % source_sha) != 1:
        raise RuntimeError('SOURCE_SHA256 replacement failed')

    pathlib.Path('/tmp/cliphub_filter82_loader.js').write_text(
        loader, encoding='utf-8')
    subprocess.check_call(['node', '--check', '/tmp/cliphub_filter82_loader.js'])
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


def git_config():
    subprocess.check_call(['git', 'config', 'user.name', 'github-actions[bot]'])
    subprocess.check_call([
        'git', 'config', 'user.email',
        '41898282+github-actions[bot]@users.noreply.github.com'
    ])


def publish(blob_sha, source_sha):
    git_config()
    for path in [RUNNER, WORKFLOW, ERROR_FILE]:
        try:
            path.unlink()
        except FileNotFoundError:
            pass

    subprocess.check_call(['git', 'add', '-A'])
    subprocess.check_call(['git', 'diff', '--cached', '--check'])
    staged = subprocess.check_output(
        ['git', 'diff', '--cached', '--name-only'], text=True).splitlines()
    allowed = [
        'src/ch_11_filter.js',
        'module-manifest.json',
        str(RUNNER),
        str(WORKFLOW),
        str(ERROR_FILE)
    ]
    unexpected = [path for path in staged if path not in allowed]
    if unexpected:
        raise RuntimeError('unexpected staged paths: %r' % unexpected)

    subprocess.check_call([
        'git', 'commit', '-m',
        '优化缓存重开 initial staged 路由'
    ])
    subprocess.check_call(['git', 'push', 'origin', 'HEAD:' + EXPECTED_BRANCH])
    print('Filter82 blob=' + blob_sha)
    print('Filter82 source_sha256=' + source_sha)


def failure_diagnostic(error_text):
    lines = []
    lines.append('ClipHub reopen initial staged build failure')
    lines.append('error=' + error_text)
    try:
        manifest = json.loads(MANIFEST.read_text(encoding='utf-8'))
        lines.append('moduleSetVersion=' + str(manifest.get('moduleSetVersion')))
        lines.append('sourceRef=' + str(manifest.get('sourceRef')))
    except Exception as manifest_error:
        lines.append('manifest_error=' + repr(manifest_error))
    try:
        loader = LOADER.read_text(encoding='utf-8')
        source, unused_match = unpack(loader)
        lines.append('module_versions=' + repr(
            re.findall(r'MODULE_VERSION:\s*(\d+)', source)))
        lines.append('old_condition_count=' + str(source.count(OLD_CONDITION)))
        lines.append('panel_data_refresh_route_count=' + str(
            source.count('"panel_data_refresh") || Number(range.start)')))
        marker = '    function startInitialStagedFill('
        start = source.find(marker)
        if start >= 0:
            end = source.find('\n    function ', start + len(marker))
            if end < 0:
                end = min(len(source), start + 7000)
            lines.append('--- startInitialStagedFill ---')
            lines.append(source[start:end])
            lines.append('--- end startInitialStagedFill ---')
        else:
            lines.append('startInitialStagedFill=missing')
    except Exception as source_error:
        lines.append('source_diagnostic_error=' + repr(source_error))
    return '\n'.join(lines) + '\n'


def publish_failure(exc):
    git_config()
    diagnostic = failure_diagnostic(repr(exc))
    diagnostic += '\n--- traceback ---\n' + traceback.format_exc()
    ERROR_FILE.write_text(diagnostic, encoding='utf-8')
    subprocess.check_call(['git', 'add', str(ERROR_FILE)])
    if run(['git', 'diff', '--cached', '--quiet']).returncode != 0:
        subprocess.check_call([
            'git', 'commit', '-m',
            '记录缓存重开 staged 构建失败诊断'
        ])
        subprocess.check_call(['git', 'push', 'origin', 'HEAD:' + EXPECTED_BRANCH])


def main():
    try:
        blob_sha, source_sha = build()
        publish(blob_sha, source_sha)
    except Exception as exc:
        publish_failure(exc)
        raise


if __name__ == '__main__':
    main()
