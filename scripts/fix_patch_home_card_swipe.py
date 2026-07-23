#!/usr/bin/env python3
from pathlib import Path

path = Path(__file__).with_name("patch_home_card_swipe.py")
text = path.read_text(encoding="utf-8")
old = '''text = replace_once(text,
''' + "'''" + '''            resultScrollView = null;
            loadMoreView = null;
            resetResultPaging();''' + "'''" + ''',
''' + "'''" + '''            resultScrollView = null;
            loadMoreView = null;
            activeSwipeCard = null;
            resetResultPaging();''' + "'''" + ''',
"init active swipe")'''
new = '''text = replace_once(text,
''' + "'''" + '''            selectedItemId = null;
            resultCardViews = [];
            toolbarActionViews = {};
            resultTagMap = {};
            resultScrollView = null;
            loadMoreView = null;
            resetResultPaging();''' + "'''" + ''',
''' + "'''" + '''            selectedItemId = null;
            resultCardViews = [];
            toolbarActionViews = {};
            resultTagMap = {};
            resultScrollView = null;
            loadMoreView = null;
            activeSwipeCard = null;
            resetResultPaging();''' + "'''" + ''',
"init active swipe")'''
if text.count(old) != 1:
    raise RuntimeError("init active swipe patch block expected once, found {}".format(text.count(old)))
path.write_text(text.replace(old, new, 1), encoding="utf-8")
