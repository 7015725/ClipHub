import pathlib
import subprocess
import sys

REPO_ROOT = pathlib.Path('.')
WORKFLOW_PATH = '.github/workflows/beta_stage17_diag.yml'
BUILDER_COMMIT = '34db82d66cd1dbdaf2b3b81720190a74ee78ca01'


def run(args, **kwargs):
    return subprocess.run(args, text=True, **kwargs)


def git_config():
    subprocess.check_call(['git', 'config', 'user.name', 'github-actions[bot]'])
    subprocess.check_call(['git', 'config', 'user.email', '41898282+github-actions[bot]@users.noreply.github.com'])


def extract_builder():
    text = subprocess.check_output(
        ['git', 'show', BUILDER_COMMIT + ':' + WORKFLOW_PATH], text=True)
    start_marker = '      - name: Build Filter65\n        shell: bash\n        run: |\n'
    end_marker = '      - name: Commit Stage17 atomically\n'
    if start_marker not in text or end_marker not in text:
        raise RuntimeError('builder block markers missing')
    body = text.split(start_marker, 1)[1].split(end_marker, 1)[0]
    lines = []
    for line in body.splitlines():
        if line.startswith('          '):
            line = line[10:]
        lines.append(line)
    script = '\n'.join(lines) + '\n'
    start = script.find('    function stage17DecodeText(encoded) {')
    end = script.find('\n    function transformStage17Source(source) {', start)
    if start < 0 or end < 0:
        raise RuntimeError('Stage17 decode function bounds missing')
    new = (
        '    function stage17DecodeText(encoded) {\n'
        '        if (typeof Buffer !== "undefined") {\n'
        '            return String(Buffer.from(String(encoded), "base64").toString("utf8"));\n'
        '        }\n'
        '        return String(new JavaString(\n'
        '            Base64.decode(String(encoded), Base64.DEFAULT), "UTF-8"));\n'
        '    }\n'
    )
    return script[:start] + new.rstrip('\n') + script[end:]


def restore_runtime_files():
    run(['git', 'restore', 'src/ch_11_filter.js', 'module-manifest.json'])


def write_failure(text, rc):
    restore_runtime_files()
    pathlib.Path('stage17_build_debug.txt').write_text(
        text + '\nEXIT_CODE=%s\n' % rc, encoding='utf-8')
    git_config()
    subprocess.check_call(['git', 'add', 'stage17_build_debug.txt'])
    result = run(['git', 'diff', '--cached', '--quiet'])
    if result.returncode != 0:
        subprocess.check_call(['git', 'commit', '-m', '记录 Stage17 三次构建失败诊断'])
        subprocess.check_call(['git', 'push'])


def publish_success(log_text):
    print(log_text)
    git_config()
    for name in [
        '.github/stage17-diag-trigger.txt',
        '.github/workflows/beta_stage17_diag.yml',
        'stage17_diag.txt',
        'stage17_build_debug.txt',
        'stage17_build_runner.py',
    ]:
        try:
            pathlib.Path(name).unlink()
        except FileNotFoundError:
            pass
    subprocess.check_call(['git', 'add', '-A'])
    subprocess.check_call(['git', 'diff', '--cached', '--check'])
    subprocess.check_call(['git', 'commit', '-m', '分帧构建 Beta AJAX 追加列表'])
    subprocess.check_call(['git', 'push'])


def main():
    try:
        script = extract_builder()
    except Exception as exc:
        write_failure('RUNNER_SETUP_ERROR: %r' % (exc,), 90)
        return 0
    pathlib.Path('/tmp/stage17_build.sh').write_text(script, encoding='utf-8')
    result = run(['bash', '/tmp/stage17_build.sh'], stdout=subprocess.PIPE,
                 stderr=subprocess.STDOUT)
    if result.returncode != 0:
        write_failure(result.stdout, result.returncode)
        return 0
    publish_success(result.stdout)
    return 0


if __name__ == '__main__':
    sys.exit(main())
