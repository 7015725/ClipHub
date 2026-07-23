#!/usr/bin/env python3
from pathlib import Path

path = Path(__file__).with_name("patch_home_card_swipe.py")
text = path.read_text(encoding="utf-8")

old_init = '''text = replace_once(text,
''' + "'''" + '''            resultScrollView = null;
            loadMoreView = null;
            resetResultPaging();''' + "'''" + ''',
''' + "'''" + '''            resultScrollView = null;
            loadMoreView = null;
            activeSwipeCard = null;
            resetResultPaging();''' + "'''" + ''',
"init active swipe")'''
new_init = '''text = replace_once(text,
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
if text.count(old_init) != 1:
    raise RuntimeError("init active swipe patch block expected once, found {}".format(text.count(old_init)))
text = text.replace(old_init, new_init, 1)

close_block = '''text = replace_once(text,
''' + "'''" + '''                state.primaryResizeViewPresent = false;
            }
        }, 3000));''' + "'''" + ''',
''' + "'''" + '''                state.primaryResizeViewPresent = false;
                cancelActiveSwipe(false);
            }
        }, 3000));''' + "'''" + ''',
"close swipe cleanup")

'''
if text.count(close_block) != 1:
    raise RuntimeError("close swipe cleanup patch block expected once, found {}".format(text.count(close_block)))
text = text.replace(close_block, "", 1)

path.write_text(text, encoding="utf-8")
