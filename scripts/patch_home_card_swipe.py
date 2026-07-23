#!/usr/bin/env python3
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILTER = ROOT / "src/ch_11_filter.js"
MANIFEST = ROOT / "module-manifest.json"


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError("{} expected once, found {}".format(label, count))
    return text.replace(old, new, 1)


text = FILTER.read_text(encoding="utf-8")

text = replace_once(text,
'''    var View = Packages.android.view.View;
    var Gravity = Packages.android.view.Gravity;''',
'''    var View = Packages.android.view.View;
    var MotionEvent = Packages.android.view.MotionEvent;
    var ViewConfiguration = Packages.android.view.ViewConfiguration;
    var Gravity = Packages.android.view.Gravity;''',
"gesture imports")

text = replace_once(text,
'''    var density = 1;
    var value = null;''',
'''    var density = 1;
    var touchSlop = 8;
    var value = null;''',
"touch slop global")

text = replace_once(text,
'''    var resultScrollView = null;
    var loadMoreView = null;

    var state = {''',
'''    var resultScrollView = null;
    var loadMoreView = null;
    var activeSwipeCard = null;

    var state = {''',
"active swipe global")

text = replace_once(text,
'''        detailActionCount: 0,
        settingsOpenCount: 0,''',
'''        detailActionCount: 0,
        swipeEnabled: true,
        swipeStartCount: 0,
        swipeMoveCount: 0,
        swipePinCount: 0,
        swipeDeleteCount: 0,
        swipeCancelCount: 0,
        lastSwipeItemId: null,
        lastSwipeAction: null,
        settingsOpenCount: 0,''',
"swipe state fields")

text = replace_once(text,
'''    function deleteSelectedResult() {
        var row = selectedResultRow();
        var changed;
        if (row === null || !ClipHub.List ||
                typeof ClipHub.List.deleteItem !== "function") {
            return false;
        }
        changed = ClipHub.List.deleteItem(Number(row.id));
        if (changed) {
            state.deleteActionCount += 1;
            clearSelectedResult();
            refreshPrimaryResults("primary_delete");
        }
        return changed === true;
    }
''',
'''    function deleteResultRow(row, origin) {
        var changed;
        if (row === null || row === undefined || !ClipHub.List ||
                typeof ClipHub.List.deleteItem !== "function") {
            return false;
        }
        changed = ClipHub.List.deleteItem(Number(row.id));
        if (changed) {
            state.deleteActionCount += 1;
            if (selectedItemId !== null &&
                    Number(selectedItemId) === Number(row.id)) {
                clearSelectedResult();
            }
            refreshPrimaryResults(String(origin || "primary_delete"));
        }
        return changed === true;
    }

    function deleteSelectedResult() {
        return deleteResultRow(selectedResultRow(), "primary_delete");
    }
''',
"delete row helper")

insert_before = '''    function makeResultCard(row, colors) {'''
helpers = '''    function swipeInteractionBlocked() {
        var windowBusy = false;
        if (!rootMode || advancedVisible || selectedItemId !== null) {
            return true;
        }
        try {
            windowBusy = ClipHub.Window &&
                ((typeof ClipHub.Window.isMoving === "function" &&
                    ClipHub.Window.isMoving()) ||
                (typeof ClipHub.Window.isResizing === "function" &&
                    ClipHub.Window.isResizing()));
        } catch (ignoredWindowState) {
            windowBusy = false;
        }
        return windowBusy;
    }

    function makeSwipeAction(label, fill, textColor, gravityValue) {
        var view = makeText(label, 10, textColor, true);
        view.setGravity(gravityValue | Gravity.CENTER_VERTICAL);
        view.setPadding(dp(14), 0, dp(14), 0);
        view.setBackground(roundedBackground(fill, null, 12));
        view.setAlpha(0);
        return view;
    }

    function setSwipeVisual(foreground, deleteAction, pinAction, offset,
            revealWidth) {
        var progress = Math.min(1,
            Math.abs(Number(offset)) / Math.max(1, Number(revealWidth)));
        foreground.setTranslationX(Number(offset));
        deleteAction.setAlpha(offset > 0 ? progress : 0);
        pinAction.setAlpha(offset < 0 ? progress : 0);
    }

    function resetSwipeVisual(foreground, deleteAction, pinAction, animated) {
        if (foreground === null || foreground === undefined) { return false; }
        try { foreground.animate().cancel(); } catch (ignoredCancel) {}
        if (animated === true) {
            try {
                foreground.animate().translationX(0).setDuration(135).start();
            } catch (ignoredAnimation) {
                foreground.setTranslationX(0);
            }
        } else {
            foreground.setTranslationX(0);
        }
        deleteAction.setAlpha(0);
        pinAction.setAlpha(0);
        if (activeSwipeCard !== null &&
                activeSwipeCard.foreground === foreground) {
            activeSwipeCard = null;
        }
        return true;
    }

    function cancelActiveSwipe(animated) {
        var current = activeSwipeCard;
        if (current === null) { return false; }
        resetSwipeVisual(current.foreground, current.deleteAction,
            current.pinAction, animated === true);
        activeSwipeCard = null;
        return true;
    }

    function performSwipeAction(row, direction, foreground) {
        var changed = false;
        state.lastSwipeItemId = Number(row.id);
        if (direction < 0) {
            changed = toggleResultPinned(row);
            if (changed) {
                state.swipePinCount += 1;
                state.lastSwipeAction = Number(row.is_pinned || 0) === 1 ?
                    "unpin" : "pin";
            }
        } else {
            changed = deleteResultRow(row, "swipe_delete");
            if (changed) {
                state.swipeDeleteCount += 1;
                state.lastSwipeAction = "delete";
            }
        }
        if (changed && ClipHub.Window &&
                typeof ClipHub.Window.performHaptic === "function") {
            try { ClipHub.Window.performHaptic(foreground, "confirm"); }
            catch (ignoredHaptic) {}
        }
        return changed;
    }

    function bindSwipeGesture(row, wrapper, foreground, deleteAction,
            pinAction) {
        var gesture = {
            downX: 0,
            downY: 0,
            swiping: false,
            rejected: false,
            disabled: false,
            offset: 0
        };
        var revealWidth = dp(82);
        var commitDistance = dp(66);
        var maxOffset = dp(106);
        foreground.setOnTouchListener(new JavaAdapter(
            View.OnTouchListener, {
                onTouch: function (target, event) {
                    var action = Number(event.getActionMasked());
                    var rawX = Number(event.getRawX());
                    var rawY = Number(event.getRawY());
                    var deltaX;
                    var deltaY;
                    var absX;
                    var absY;
                    var offset;
                    var parent;
                    var commit;
                    var direction;
                    if (action === MotionEvent.ACTION_DOWN) {
                        gesture.downX = rawX;
                        gesture.downY = rawY;
                        gesture.swiping = false;
                        gesture.rejected = false;
                        gesture.disabled = swipeInteractionBlocked() ||
                            Number(event.getX()) >
                                Math.max(0, Number(target.getWidth()) - dp(58));
                        gesture.offset = 0;
                        if (!gesture.disabled) {
                            cancelActiveSwipe(true);
                            try { target.animate().cancel(); }
                            catch (ignoredAnimationCancel) {}
                        }
                        return false;
                    }
                    if (gesture.disabled) { return false; }
                    if (action === MotionEvent.ACTION_MOVE) {
                        deltaX = rawX - gesture.downX;
                        deltaY = rawY - gesture.downY;
                        absX = Math.abs(deltaX);
                        absY = Math.abs(deltaY);
                        if (!gesture.swiping && !gesture.rejected) {
                            if (absY > touchSlop && absY >= absX) {
                                gesture.rejected = true;
                                return false;
                            }
                            if (absX > touchSlop && absX > absY * 1.2) {
                                gesture.swiping = true;
                                state.swipeStartCount += 1;
                                activeSwipeCard = {
                                    foreground: foreground,
                                    deleteAction: deleteAction,
                                    pinAction: pinAction
                                };
                                try { target.setPressed(false); }
                                catch (ignoredPressed) {}
                                try {
                                    parent = wrapper.getParent();
                                    if (parent !== null) {
                                        parent.requestDisallowInterceptTouchEvent(
                                            true);
                                    }
                                } catch (ignoredParent) {}
                            }
                        }
                        if (!gesture.swiping) { return false; }
                        offset = deltaX;
                        if (Math.abs(offset) > revealWidth) {
                            offset = (offset < 0 ? -1 : 1) *
                                (revealWidth +
                                (Math.abs(offset) - revealWidth) * 0.22);
                        }
                        offset = Math.max(-maxOffset,
                            Math.min(maxOffset, offset));
                        gesture.offset = offset;
                        setSwipeVisual(foreground, deleteAction, pinAction,
                            offset, revealWidth);
                        state.swipeMoveCount += 1;
                        return true;
                    }
                    if (action === MotionEvent.ACTION_UP ||
                            action === MotionEvent.ACTION_CANCEL) {
                        if (!gesture.swiping) { return false; }
                        try {
                            parent = wrapper.getParent();
                            if (parent !== null) {
                                parent.requestDisallowInterceptTouchEvent(false);
                            }
                        } catch (ignoredReleaseParent) {}
                        commit = action === MotionEvent.ACTION_UP &&
                            Math.abs(gesture.offset) >= commitDistance;
                        direction = gesture.offset < 0 ? -1 : 1;
                        resetSwipeVisual(foreground, deleteAction, pinAction,
                            !commit);
                        if (commit) {
                            performSwipeAction(row, direction, foreground);
                        } else {
                            state.swipeCancelCount += 1;
                        }
                        gesture.swiping = false;
                        gesture.offset = 0;
                        return true;
                    }
                    return false;
                }
            }));
        return wrapper;
    }

'''
if text.count(insert_before) != 1:
    raise RuntimeError("makeResultCard insertion point missing")
text = text.replace(insert_before, helpers + insert_before, 1)

start = text.index('    function makeResultCard(row, colors) {')
end = text.index('\n    function updateResultScrollState()', start)
old_card = text[start:end]
new_card = '''    function makeResultCard(row, colors) {
        var selected = selectedItemId !== null &&
            Number(selectedItemId) === Number(row.id);
        var wrapper = new FrameLayout(appContext);
        var actionLayer = new FrameLayout(appContext);
        var deleteAction = makeSwipeAction("删除", colors.dangerSoft,
            colors.danger, Gravity.START);
        var pinAction = makeSwipeAction(
            Number(row.is_pinned || 0) === 1 ? "取消置顶" : "置顶",
            colors.accentSoft, colors.accentStrong, Gravity.END);
        var card = new LinearLayout(appContext);
        var icon = makeSourceIcon(row, colors);
        var center = new LinearLayout(appContext);
        var content = makeText(String(row.content || ""),
            11, colors.textPrimary, selected);
        var metaRow = new LinearLayout(appContext);
        var tags = tagsForResult(row);
        var tagBadge = makeText((tags.length > 0 ? "●  " : "") +
            tagSummary(tags), 8,
            tags.length > 0 ? tagColorText(tags[0], colors.accentStrong) :
                colors.textTertiary, tags.length > 0);
        var source = makeText(sourceLabel(row),
            8, colors.textSecondary, false);
        var right = new LinearLayout(appContext);
        var time = makeText(formatTime(row.last_copied_at),
            8, colors.textTertiary, false);
        var star = makeText(Number(row.is_pinned || 0) === 1 ?
            "★" : "☆", 17,
            Number(row.is_pinned || 0) === 1 ?
                colors.accentStrong : colors.textTertiary, false);
        var params;

        wrapper.setClipChildren(true);
        wrapper.setClipToPadding(true);
        wrapper.setBackground(roundedBackground(colors.surfaceMuted,
            colors.stroke, 12));
        actionLayer.setClipChildren(true);
        actionLayer.setClipToPadding(true);
        params = new FrameLayout.LayoutParams(dp(82),
            FrameLayout.LayoutParams.MATCH_PARENT);
        params.gravity = Gravity.START | Gravity.CENTER_VERTICAL;
        actionLayer.addView(deleteAction, params);
        params = new FrameLayout.LayoutParams(dp(82),
            FrameLayout.LayoutParams.MATCH_PARENT);
        params.gravity = Gravity.END | Gravity.CENTER_VERTICAL;
        actionLayer.addView(pinAction, params);
        wrapper.addView(actionLayer, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.MATCH_PARENT));

        card.setOrientation(LinearLayout.HORIZONTAL);
        card.setGravity(Gravity.CENTER_VERTICAL);
        card.setPadding(dp(8), dp(7), dp(7), dp(7));
        card.setBackground(roundedBackground(
            selected ? colors.accentSoft : colors.card,
            selected ? colors.accentBorder : colors.stroke, 12));
        card.setClickable(true);
        card.setFocusable(true);
        card.setContentDescription(
            "剪贴板记录，点击复制，长按选择，左滑置顶，右滑删除");
        (function (target, view) {
            view.setOnClickListener(new JavaAdapter(
                View.OnClickListener, {
                    onClick: function () { copyResultRow(target); }
                }));
            view.setOnLongClickListener(new JavaAdapter(
                View.OnLongClickListener, {
                    onLongClick: function () {
                        return selectResultRow(target);
                    }
                }));
        }(row, card));

        params = new LinearLayout.LayoutParams(dp(34), dp(34));
        params.rightMargin = dp(8);
        card.addView(icon, params);

        center.setOrientation(LinearLayout.VERTICAL);
        content.setMaxLines(2);
        content.setEllipsize(TextUtils.TruncateAt.END);
        center.addView(content, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        metaRow.setOrientation(LinearLayout.HORIZONTAL);
        metaRow.setGravity(Gravity.CENTER_VERTICAL);
        tagBadge.setPadding(dp(6), dp(2), dp(6), dp(2));
        tagBadge.setSingleLine(true);
        tagBadge.setMaxLines(1);
        tagBadge.setEllipsize(TextUtils.TruncateAt.END);
        tagBadge.setBackground(roundedBackground(
            tags.length > 0 ? colors.accentSoft : colors.surfaceMuted,
            null, 7));
        params = new LinearLayout.LayoutParams(dp(112),
            LinearLayout.LayoutParams.WRAP_CONTENT);
        params.rightMargin = dp(6);
        metaRow.addView(tagBadge, params);
        state.renderedTagLabelCount += Math.min(2, tags.length);
        if (tags.length > 0) { state.tagColorPreviewCount += 1; }
        source.setSingleLine(true);
        source.setEllipsize(TextUtils.TruncateAt.END);
        metaRow.addView(source, new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
        center.addView(metaRow, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT));
        card.addView(center, new LinearLayout.LayoutParams(
            0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));

        right.setOrientation(LinearLayout.VERTICAL);
        right.setGravity(Gravity.END | Gravity.CENTER_VERTICAL);
        time.setGravity(Gravity.END);
        right.addView(time, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(16)));
        star.setGravity(Gravity.END | Gravity.CENTER_VERTICAL);
        star.setClickable(true);
        star.setFocusable(true);
        star.setContentDescription("切换置顶");
        (function (target, view) {
            view.setOnClickListener(new JavaAdapter(
                View.OnClickListener, {
                    onClick: function () { toggleResultPinned(target); }
                }));
        }(row, star));
        right.addView(star, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, dp(28)));
        card.addView(right, new LinearLayout.LayoutParams(dp(48),
            LinearLayout.LayoutParams.WRAP_CONTENT));

        wrapper.addView(card, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT,
            FrameLayout.LayoutParams.WRAP_CONTENT));
        bindSwipeGesture(row, wrapper, card, deleteAction, pinAction);
        resultCardViews.push(card);
        state.resultCardCount += 1;
        return wrapper;
    }
'''
text = text[:start] + new_card + text[end:]

text = replace_once(text,
'''        resultContainer.removeAllViews();
        state.resultCardCount = 0;''',
'''        cancelActiveSwipe(false);
        resultContainer.removeAllViews();
        state.resultCardCount = 0;''',
"refresh swipe cleanup")

text = replace_once(text,
'''                state.primaryResizeViewPresent = false;
            }
        }, 3000));''',
'''                state.primaryResizeViewPresent = false;
                cancelActiveSwipe(false);
            }
        }, 3000));''',
"close swipe cleanup")

text = replace_once(text,
'''            detailActionCount: Number(state.detailActionCount),
            toolbarEnabledCount:''',
'''            detailActionCount: Number(state.detailActionCount),
            swipeEnabled: state.swipeEnabled === true,
            swipeStartCount: Number(state.swipeStartCount),
            swipeMoveCount: Number(state.swipeMoveCount),
            swipePinCount: Number(state.swipePinCount),
            swipeDeleteCount: Number(state.swipeDeleteCount),
            swipeCancelCount: Number(state.swipeCancelCount),
            lastSwipeItemId: state.lastSwipeItemId,
            lastSwipeAction: state.lastSwipeAction,
            toolbarEnabledCount:''',
"panel state swipe metrics")

text = replace_once(text,
'''        state.detailActionCount = 0;
        state.settingsOpenCount = 0;''',
'''        state.detailActionCount = 0;
        state.swipeEnabled = true;
        state.swipeStartCount = 0;
        state.swipeMoveCount = 0;
        state.swipePinCount = 0;
        state.swipeDeleteCount = 0;
        state.swipeCancelCount = 0;
        state.lastSwipeItemId = null;
        state.lastSwipeAction = null;
        state.settingsOpenCount = 0;''',
"reset swipe metrics")

text = replace_once(text,
'''        MODULE_NAME: "ch_11_filter",
        MODULE_VERSION: 19,''',
'''        MODULE_NAME: "ch_11_filter",
        MODULE_VERSION: 20,''',
"filter module version")

text = replace_once(text,
'''            density = Number(appContext.getResources()
                .getDisplayMetrics().density || 1);
            value = emptyValue();''',
'''            density = Number(appContext.getResources()
                .getDisplayMetrics().density || 1);
            touchSlop = Number(ViewConfiguration.get(appContext)
                .getScaledTouchSlop());
            value = emptyValue();''',
"initialize touch slop")

text = replace_once(text,
'''            resultScrollView = null;
            loadMoreView = null;
            resetResultPaging();''',
'''            resultScrollView = null;
            loadMoreView = null;
            activeSwipeCard = null;
            resetResultPaging();''',
"init active swipe")

text = replace_once(text,
'''            resultScrollView = null;
            loadMoreView = null;
            resetResultPaging();
            value = null;''',
'''            resultScrollView = null;
            loadMoreView = null;
            cancelActiveSwipe(false);
            activeSwipeCard = null;
            resetResultPaging();
            value = null;''',
"shutdown swipe cleanup")

FILTER.write_text(text, encoding="utf-8")

manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
manifest["moduleSetVersion"] = "20260724.10"
for item in manifest["modules"]:
    path = ROOT / item["path"]
    data = path.read_bytes()
    item["sha"] = hashlib.sha1(
        b"blob " + str(len(data)).encode("ascii") + b"\0" + data
    ).hexdigest()
MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
                    encoding="utf-8")
