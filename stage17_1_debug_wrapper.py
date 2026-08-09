import pathlib

src = pathlib.Path('stage17_1_build_runner.py').read_text(encoding='utf-8')
old = "    subprocess.check_call(['node', '/tmp/stage17_1_validate.js'])\n"
new = "    _r = subprocess.run(['node', '/tmp/stage17_1_validate.js'], text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)\n    if _r.returncode != 0:\n        raise RuntimeError('NODE_VALIDATE\\n' + _r.stdout)\n"
if src.count(old) != 1:
    raise SystemExit('node validate anchor mismatch: %d' % src.count(old))
src = src.replace(old, new, 1)
pathlib.Path('/tmp/stage17_1_debug_runner.py').write_text(src, encoding='utf-8')
exec(compile(src, '/tmp/stage17_1_debug_runner.py', 'exec'), {'__name__':'__main__'})
