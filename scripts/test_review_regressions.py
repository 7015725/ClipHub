#!/usr/bin/env python3
import base64,gzip,hashlib,json,re
from pathlib import Path
def ex(p):
 t=Path(p).read_text(encoding="utf-8");m=re.search(r"\bvar\s+(?:PACKED_B64|encoded)\s*=\s*(.*?);",t,re.S)
 if not m:return t,t
 q=re.findall(r'"(?:\\.|[^"\\])*"',m.group(1));s=gzip.decompress(base64.b64decode("".join(json.loads(x) for x in q))).decode("utf-8");return t,s
_,theme=ex("src/ch_07_theme.js");assert "explicitIcon !== true" in theme
for n in ('ch_09_list.js', 'ch_10_editor.js', 'ch_11_filter.js', 'ch_12_translation.js', 'ch_13_settings.js', 'ch_17_tokenizer_ui.js'):
 _,s=ex("src/"+n);assert "panel_icon_text_bridge_v1" not in s,n;assert "panel_icon_explicit_v2" in s,n
_,ls=ex("src/ch_09_list.js");_,ed=ex("src/ch_10_editor.js");assert "makeText(String(row.content)" in ls;assert "makeText(String(tag.name)" in ed
l,r=ex("src/ch_06_repository.js");m=re.search(r'var SOURCE_SHA256 = "([0-9a-f]{64})";',l);assert m;assert hashlib.sha256(r.encode()).hexdigest()==m.group(1);assert "(0, eval)(source);" in l
_,f=ex("src/ch_11_filter.js");assert "条超大内容未参与正则扫描" in f;assert "oversizeNoticeGeneration" in f
print("Review regression checks: passed")
