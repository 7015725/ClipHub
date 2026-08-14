import base64
import gzip
import pathlib
import re

LOADER = pathlib.Path('src/ch_11_filter.js')
OUT = pathlib.Path('cliphub_filter82_reopen_diag.txt')


def unpack(loader):
    match = re.search(
        r'var PACKED_B64 =\n((?:\s*"[A-Za-z0-9+/=]+"\s*\+?\n?)+);',
        loader)
    if not match:
        raise RuntimeError('PACKED_B64 missing')
    packed = ''.join(re.findall(r'"([A-Za-z0-9+/=]+)"', match.group(1)))
    return gzip.decompress(base64.b64decode(packed)).decode('utf-8')


def function_block(source, name):
    marker = '    function ' + name + '('
    start = source.find(marker)
    if start < 0:
        return 'MISSING FUNCTION: ' + name + '\n'
    end = source.find('\n    function ', start + len(marker))
    if end < 0:
        end = len(source)
    return source[start:end] + '\n'


def contexts(source, needle, radius=900):
    out = []
    pos = 0
    index = 0
    while True:
        found = source.find(needle, pos)
        if found < 0:
            break
        index += 1
        start = max(0, found - radius)
        end = min(len(source), found + len(needle) + radius)
        out.append('--- %s #%d @%d ---\n%s\n' % (
            needle, index, found, source[start:end]))
        pos = found + len(needle)
    if not out:
        out.append('NO OCCURRENCE: ' + needle + '\n')
    return '\n'.join(out)


def main():
    source = unpack(LOADER.read_text(encoding='utf-8'))
    lines = []
    lines.append('module_versions=' + repr(re.findall(r'MODULE_VERSION:\s*(\d+)', source)))
    for name in [
        'startInitialStagedFill',
        'finishInitialStagedFill',
        'rebuildVirtualWindow',
        'schedulePanelRefresh',
        'refreshPanelData',
        'showPanel',
        'closePanel'
    ]:
        lines.append('\n===== FUNCTION %s =====\n' % name)
        lines.append(function_block(source, name))
    for needle in [
        'performance.lastRefreshOrigin',
        'fullRefreshLastPerformanceOrigin',
        'panel_data_refresh',
        'rebuildVirtualWindow(\n            "full_refresh"',
        'startInitialStagedFill('
    ]:
        lines.append('\n===== CONTEXT %s =====\n' % needle)
        lines.append(contexts(source, needle))
    OUT.write_text(''.join(lines), encoding='utf-8')


if __name__ == '__main__':
    main()
