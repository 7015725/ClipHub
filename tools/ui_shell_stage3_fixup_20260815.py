#!/usr/bin/env python3
from pathlib import Path
import textwrap

p = Path('tools/ui_shell_stage3_20260815.py')
s = p.read_text(encoding='utf-8')

# Remove an unnecessary legacy attach-hook text replacement.
start = s.index('# Existing legacy binding must explicitly remain non-embedded.')
end = s.index('# Clearing a binding always drops the embedded marker.', start)
s = s[:start] + s[end:]
s = s.replace('scheduleEnsureEditorEntry();', 'scheduleEnsureEntry();')

# Rewrite tokenizer lifecycle patch helpers using the exact TokenizerUI2 functions.
a = s.index('def patch_mount_tokenizer(fn):')
b = s.index('# State + public direct-bind API.', a)
block = r'''
def patch_mount_tokenizer(fn):
    return replace_once(fn,
''' + "'''" + r'''            state.mountCount += 1;
            emitAction("open", {});''' + "'''" + r''',
''' + "'''" + r'''            state.mountCount += 1;
            if (editorEmbeddedInPrimary) {
                syncTokenizerShell("tokenizer", "分词", function () {
                    return returnToEditor("shell_back");
                });
            }
            emitAction("open", {});''' + "'''" + r''',
"tokenizer shell mount")
tok = patch_function(tok, "mountFromEditor", patch_mount_tokenizer)


def patch_return_tokenizer(fn):
    return replace_once(fn,
''' + "'''" + r'''        state.unmountCount += 1;
        emitAction("back", { reason: String(reason || "back") });''' + "'''" + r''',
''' + "'''" + r'''        state.unmountCount += 1;
        if (editorEmbeddedInPrimary) {
            var editorState = ClipHub.Editor &&
                typeof ClipHub.Editor.getState === "function" ?
                ClipHub.Editor.getState() : {};
            syncTokenizerShell("editor",
                String(editorState.mode) === "new" ?
                    "新增剪贴板" : "编辑剪贴板",
                function () {
                    return ClipHub.Editor &&
                        typeof ClipHub.Editor.requestExit === "function" ?
                        ClipHub.Editor.requestExit("shell_back") : false;
                });
        }
        emitAction("back", { reason: String(reason || "back") });''' + "'''" + r''',
"tokenizer shell return")
tok = patch_function(tok, "returnToEditor", patch_return_tokenizer)

'''
s = s[:a] + textwrap.dedent(block) + s[b:]

# TokenizerUI2 getState has no editorBound line. Insert after mounted.
old_state = '''def patch_tok_state(fn):
    return replace_once(fn,
''' + "'''" + '''            mounted: state.mounted === true,
            editorBound: editorPanelRoot !== null,''' + "'''" + ''',
''' + "'''" + '''            mounted: state.mounted === true,
            editorBound: editorPanelRoot !== null,
            embeddedInPrimary: editorEmbeddedInPrimary === true,''' + "'''" + ''',
"tokenizer state embedded")
tok = patch_function(tok, "getState", patch_tok_state)
'''
new_state = '''def patch_tok_state(fn):
    return replace_once(fn,
''' + "'''" + '''            mounted: state.mounted === true,''' + "'''" + ''',
''' + "'''" + '''            mounted: state.mounted === true,
            embeddedInPrimary: editorEmbeddedInPrimary === true,''' + "'''" + ''',
"tokenizer state embedded")
tok = patch_function(tok, "getState", patch_tok_state)
'''
if old_state not in s:
    raise AssertionError('tokenizer getState patch-source anchor missing')
s = s.replace(old_state, new_state, 1)

# Insert direct binding API beside the stable mount/unmount entries.
api_start = s.index("api_anchor = '''        ensureEditorEntry: function () {")
api_call = 'tok = replace_once(tok, api_anchor, api_new, "tokenizer public bind api")'
api_end = s.index(api_call, api_start) + len(api_call)
api_end = s.index('\n', api_end) + 1
api = '''api_anchor = ''' + "'''" + '''        mount: mountFromEditor,
        unmount: function () { return returnToEditor("api_unmount"); },''' + "'''" + '''
api_new = api_anchor + ''' + "'''" + '''
        bindEditorRoot: function (contentView, rootView, embedded) {
            return runOnMainSync(function () {
                return bindEditorRoot(contentView, rootView, embedded === true);
            }, 2500);
        },
        unbindEditorRoot: function (discardMounted) {
            return runOnMainSync(function () {
                clearEditorBinding(discardMounted === true);
                return true;
            }, 2500);
        },''' + "'''" + '''
tok = replace_once(tok, api_anchor, api_new, "tokenizer public bind api")
'''
s = s[:api_start] + api + s[api_end:]

p.write_text(s, encoding='utf-8')
print('Stage3 implementation script fixup applied')
