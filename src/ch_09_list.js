(function (global) {
var ClipHub = global.ClipHub || (global.ClipHub = {});
var Context = Packages.android.content.Context;
var Build = Packages.android.os.Build;
var View = Packages.android.view.View;
var Gravity = Packages.android.view.Gravity;
var WindowManager = Packages.android.view.WindowManager;
var PixelFormat = Packages.android.graphics.PixelFormat;
var GradientDrawable = Packages.android.graphics.drawable.GradientDrawable;
var LinearLayout = Packages.android.widget.LinearLayout;
var FrameLayout = Packages.android.widget.FrameLayout;
var ScrollView = Packages.android.widget.ScrollView;
var TextView = Packages.android.widget.TextView;
var TypedValue = Packages.android.util.TypedValue;
var TextUtils = Packages.android.text.TextUtils;
var Thread = Packages.java.lang.Thread;
var SimpleDateFormat = Packages.java.text.SimpleDateFormat;
var Locale = Packages.java.util.Locale;
var Date = Packages.java.util.Date;
var LONG_TEXT_THRESHOLD = 180;
var LONG_TEXT_LINE_THRESHOLD = 4;
var DETAIL_DIM_AMOUNT = 0.72;
var androidContext = null;
var density = 1;
var ready = false;
var limit = 20;
var items = [];
var lastDeleted = null;
var detailWindowManager = null;
var detailRoot = null;
var detailWindowRoot = null;
var detailManagedFrame = null;
var detailParams = null;
var detailRow = null;
var detailCopyView = null;
var detailEditView = null;
var detailCloseView = null;
var detailWidthPx = 0;
var detailHeightPx = 0;
var detailClosing = false;
var detailRemovalPending = false;
var detailRemovalGeneration = 0;
var pendingDetailOpen = null;
var detailEmbeddedInPrimary = false;
var state = {
refreshCount: 0,
eventRefreshCount: 0,
copyCount: 0,
deleteCount: 0,
restoreCount: 0,
pinToggleCount: 0,
reorderCount: 0,
reorderRejectCount: 0,
detailOpenCount: 0,
detailCloseCount: 0,
detailCopyCount: 0,
detailEditCount: 0,
lastCopiedId: null,
lastDeletedId: null,
lastRestoredId: null,
lastPinnedId: null,
lastPinnedValue: null,
lastDetailItemId: null,
lastReorderItemId: null,
lastReorderTargetId: null,
lastReorderPinned: null,
lastReorderPlaceAfter: null,
lastReorderReason: null,
lastCopyOk: false,
clickThreadName: null,
deleteThreadName: null,
restoreThreadName: null,
pinThreadName: null,
reorderThreadName: null,
detailActionThreadName: null,
detailAddThreadName: null,
detailRemoveThreadName: null,
lastDetailAction: null,
lastError: null
};
function dp(value) {
return Math.max(1, Math.floor(Number(value) * density + 0.5));
}
function colors() {
if (ClipHub.Theme && typeof ClipHub.Theme.getPalette === "function") {
return ClipHub.Theme.getPalette(androidContext);
}
return {
accent: "#FF6D4AFF",
accentStrong: "#FF5A37E6",
accentSoft: "#FFF0ECFF",
accentBorder: "#FFBBAAF8",
surface: "#FFFFFFFF",
surfaceMuted: "#FFF5F3FB",
stroke: "#FFE5E0EF",
strokeStrong: "#FFD3C8E8",
textPrimary: "#FF1F1C28",
textSecondary: "#FF6F697A",
icon: "#FF3D3748"
};
}
function roundedBackground(fill, stroke, radiusDp) {
var drawable = new GradientDrawable();
drawable.setShape(GradientDrawable.RECTANGLE);
ClipHub.Theme.applyGradientColor(drawable, fill);
drawable.setCornerRadius(dp(radiusDp));
if (stroke !== null && stroke !== undefined) {
ClipHub.Theme.applyGradientStroke(drawable, dp(1), stroke);
}
return drawable;
}
function circleBackground(fill, stroke) {
var drawable = new GradientDrawable();
drawable.setShape(GradientDrawable.OVAL);
ClipHub.Theme.applyGradientColor(drawable, fill);
if (stroke !== null && stroke !== undefined) {
ClipHub.Theme.applyGradientStroke(drawable, dp(1), stroke);
}
return drawable;
}
function makeText(text, sizeSp, color, bold) {
var view = new TextView(androidContext);
view.setText(String(text));
view.setTextSize(TypedValue.COMPLEX_UNIT_SP, Number(sizeSp));
ClipHub.Theme.applyTextColor(view, color);
view.setIncludeFontPadding(false);
if (bold) {
view.setTypeface(Packages.android.graphics.Typeface.DEFAULT,
Packages.android.graphics.Typeface.BOLD);
}
return view;
}
function makeIcon(text, color, sizeSp, contentDescription) {
var view = makeText(text, sizeSp, color, false);
view.setGravity(Gravity.CENTER);
view.setClickable(true);
view.setFocusable(true);
if (contentDescription) {
view.setContentDescription(String(contentDescription));
}
return view;
}
function detailChromeMetrics() {
var widthDp = Number(detailWidthPx || 0) > 0 ? Number(detailWidthPx) / density : 390;
var fontScale = 1;
try {
fontScale = Number(androidContext.getResources().getConfiguration().fontScale || 1);
} catch (ignoredDetailFontScale) { fontScale = 1; }
return ClipHub.Theme.getPanelChromeMetrics(widthDp, fontScale, 1);
}

    function makePill(text, palette, selected) {
var view = makeText(text, 9,
selected ? palette.accentStrong : palette.textSecondary,
selected);
view.setGravity(Gravity.CENTER);
view.setPadding(dp(7), dp(3), dp(7), dp(3));
view.setBackground(roundedBackground(
selected ? palette.accentSoft : palette.surfaceMuted,
selected ? palette.accentBorder : palette.stroke, 8));
return view;
}
function formatTime(value) {
try {
return String(new SimpleDateFormat("HH:mm", Locale.getDefault())
.format(new Date(Number(value || 0))));
} catch (ignored) {
return "";
}
}
function sourceText(row) {
return String(row.source_label || row.source_package || "未知来源");
}
function isLongText(row) {
var contentLength = Number(row && row.content_length || 0);
var content = String(row && row.content !== undefined ?
row.content : "");
if (contentLength > LONG_TEXT_THRESHOLD) { return true; }
return content.length > LONG_TEXT_THRESHOLD ||
content.split("\n").length >= LONG_TEXT_LINE_THRESHOLD;
}

function filterState() {
try {
if (ClipHub.Filter &&
typeof ClipHub.Filter.getState === "function") {
return ClipHub.Filter.getState();
}
} catch (ignored) {}
return {
active: false,
criteria: {
keyword: "",
sourcePackages: [],
tagIds: [],
pinnedOnly: false,
sensitiveMode: "all",
sortMode: "latest"
}
};
}
function emit(name, payload) {
try {
if (ClipHub.EventBus &&
typeof ClipHub.EventBus.emit === "function") {
return ClipHub.EventBus.emit(String(name), payload || {});
}
} catch (ignored) {}
return 0;
}
function copyRows(rows) {
var output = [];
var index;
rows = rows || [];
for (index = 0; index < rows.length; index += 1) {
output.push(rows[index]);
}
return output;
}
function queryCurrentRows() {
if (ClipHub.Filter &&
typeof ClipHub.Filter.isActive === "function" &&
ClipHub.Filter.isActive() &&
typeof ClipHub.Filter.query === "function") {
return ClipHub.Filter.query({ limit: limit, offset: 0 });
}
return ClipHub.Repository.listItems({ previewOnly: true, limit: limit, offset: 0 });
}
function refresh(fromEvent) {
if (!ready) {
throw new Error("ClipHub list is not ready");
}
items = queryCurrentRows();
state.refreshCount += 1;
if (fromEvent === true) {
state.eventRefreshCount += 1;
}
return items.length;
}
function refreshQuietly() {
if (!ready) { return false; }
try {
refresh(false);
return true;
} catch (error) {
state.lastError = String(error);
return false;
}
}
function copyRow(row) {
var thread = Thread.currentThread();
var result;
var full;
var closeAfter = false;
try {
full = ClipHub.Repository.getItem(Number(row.id), false);
if (full === null || full === undefined) { return false; }
result = ClipHub.Clipboard.writeText(String(full.content), {
label: "ClipHub",
sensitive: Number(full.is_sensitive || 0) === 1
});
state.copyCount += 1;
state.lastCopiedId = Number(row.id);
state.lastCopyOk = result && result.ok === true;
state.clickThreadName = String(thread.getName());
try {
closeAfter = ClipHub.Settings &&
ClipHub.Settings.get("closeAfterCopy", false) === true;
} catch (ignoredSetting) {}
if (closeAfter) {
closeDetail("copy_close");
ClipHub.Window.close();
}
return state.lastCopyOk;
} catch (error) {
state.lastError = String(error);
state.lastCopyOk = false;
return false;
}
}
function deleteRow(row) {
var thread = Thread.currentThread();
var id;
var deletedAt;
var changed;
if (row === null) { return false; }
id = Number(row.id);
deletedAt = ClipHub.Base.now();
try {
changed = ClipHub.Repository.softDeleteItem(id, deletedAt);
if (Number(changed) < 1) { return false; }
lastDeleted = { id: id, deletedAt: deletedAt };
state.deleteCount += 1;
state.lastDeletedId = id;
state.deleteThreadName = String(thread.getName());
emit("clipboard_deleted", {
id: id,
deletedAt: deletedAt,
threadId: Number(thread.getId()),
threadName: state.deleteThreadName
});
refreshQuietly();
return true;
} catch (error) {
state.lastError = String(error);
return false;
}
}
function undoLastDelete() {
var thread = Thread.currentThread();
var target = lastDeleted;
var row;
var changed;
if (target === null) { return false; }
try {
row = ClipHub.Repository.getItem(Number(target.id), true);
if (row === null || row === undefined ||
row.deleted_at === null ||
row.deleted_at === undefined) {
lastDeleted = null;
refreshQuietly();
return false;
}
if (Number(row.deleted_at) !== Number(target.deletedAt)) {
lastDeleted = null;
refreshQuietly();
return false;
}
changed = ClipHub.Repository.restoreItemIfDeletedAt &&
typeof ClipHub.Repository.restoreItemIfDeletedAt === "function" ?
ClipHub.Repository.restoreItemIfDeletedAt(
Number(target.id), Number(target.deletedAt)) :
ClipHub.Repository.restoreItem(Number(target.id));
if (Number(changed) < 1) {
lastDeleted = null;
refreshQuietly();
return false;
}
lastDeleted = null;
state.restoreCount += 1;
state.lastRestoredId = Number(target.id);
state.restoreThreadName = String(thread.getName());
emit("clipboard_restored", {
id: Number(target.id),
threadId: Number(thread.getId()),
threadName: state.restoreThreadName
});
refreshQuietly();
return true;
} catch (error) {
state.lastError = String(error);
return false;
}
}
function togglePinned(row) {
var thread = Thread.currentThread();
var id;
var next;
var changed;
if (row === null) { return false; }
id = Number(row.id);
next = Number(row.is_pinned || 0) === 1 ? 0 : 1;
try {
changed = ClipHub.Repository.updateItem(id, {
is_pinned: next,
manual_order: 0
});
if (Number(changed) < 1) { return false; }
state.pinToggleCount += 1;
state.lastPinnedId = id;
state.lastPinnedValue = next;
state.pinThreadName = String(thread.getName());
emit("clipboard_merged", {
id: id,
manual: true,
mutation: "pin_changed",
pinned: next === 1,
threadId: Number(thread.getId()),
threadName: state.pinThreadName
});
refreshQuietly();
return true;
} catch (error) {
state.lastError = String(error);
return false;
}
}
function commitReorder(fromIndex, toIndex) {
var source;
var target;
var placeAfter;
var thread = Thread.currentThread();
var result;
if (!ready || filterState().active === true || items.length < 2) {
state.reorderRejectCount += 1;
state.lastReorderReason = "filter_active_or_insufficient_items";
return false;
}
fromIndex = Math.floor(Number(fromIndex));
toIndex = Math.floor(Number(toIndex));
if (fromIndex < 0 || toIndex < 0 ||
fromIndex >= items.length ||
toIndex >= items.length ||
fromIndex === toIndex) {
state.reorderRejectCount += 1;
state.lastReorderReason = "invalid_or_same_index";
return false;
}
source = items[fromIndex];
target = items[toIndex];
if (Number(source.is_pinned || 0) !==
Number(target.is_pinned || 0)) {
state.reorderRejectCount += 1;
state.lastReorderReason = "cross_pinned_group";
return false;
}
placeAfter = fromIndex < toIndex;
try {
result = ClipHub.Repository.reorderItem(
Number(source.id), Number(target.id), placeAfter);
if (!result || result.ok !== true || result.changed !== true) {
state.reorderRejectCount += 1;
state.lastReorderReason = result && result.reason ?
String(result.reason) : "repository_rejected";
return false;
}
state.reorderCount += 1;
state.lastReorderItemId = Number(source.id);
state.lastReorderTargetId = Number(target.id);
state.lastReorderPinned =
Number(source.is_pinned || 0) === 1;
state.lastReorderPlaceAfter = placeAfter;
state.lastReorderReason = "api";
state.reorderThreadName = String(thread.getName());
emit("clipboard_merged", {
id: Number(source.id),
targetId: Number(target.id),
manual: true,
mutation: "manual_order_changed",
pinned: state.lastReorderPinned,
placeAfter: placeAfter,
threadId: Number(thread.getId()),
threadName: state.reorderThreadName
});
refreshQuietly();
return true;
} catch (error) {
state.lastError = String(error);
return false;
}
}
function detailDimensions() {
if (ClipHub.Window &&
typeof ClipHub.Window.computeGeometry === "function") {
return ClipHub.Window.computeGeometry("detail", {
useSaved: true
});
}
return {
x: 0,
y: 0,
width: dp(390),
height: dp(650),
widthDp: 390,
heightDp: 650
};
}
function closeDetail(reason) {
var reasonText = String(reason || "close");
if (detailRemovalPending) {
return {
ok: true,
attached: false,
alreadyClosed: true,
removalPending: true,
state: getDetailState()
};
}
if (detailRoot === null && !detailRemovalPending) {
detailRow = null;
detailEmbeddedInPrimary = false;
return {
ok: true,
attached: false,
alreadyClosed: true,
state: getDetailState()
};
}
if (detailEmbeddedInPrimary) {
return ClipHub.Window.runOnMain(function () {
var thread = Thread.currentThread();
try {
if (ClipHub.UIShell &&
typeof ClipHub.UIShell.unmountPage === "function") {
ClipHub.UIShell.unmountPage("detail", reasonText);
}
} catch (errorUnmount) {
state.lastError = String(errorUnmount);
return { ok: false, attached: true, embedded: true,
state: getDetailState() };
}
state.detailCloseCount += 1;
state.detailRemoveThreadName = String(thread.getName());
state.lastDetailAction = reasonText;
detailEmbeddedInPrimary = false;
detailClosing = false;
detailRemovalPending = false;
detailRoot = null;
detailWindowRoot = null;
detailManagedFrame = null;
detailParams = null;
detailRow = null;
detailCopyView = null;
detailEditView = null;
detailCloseView = null;
detailWidthPx = 0;
detailHeightPx = 0;
state.lastError = null;
return { ok: true, attached: false, alreadyClosed: false,
embedded: true, state: getDetailState() };
}, 3000);
}
return ClipHub.Window.runOnMain(function () {
var thread = Thread.currentThread();
var capturedRoot = detailWindowRoot !== null ?
detailWindowRoot : detailRoot;
var capturedManager = detailWindowManager;
var generation;
var removal;
detailClosing = true;
detailRemovalPending = capturedRoot !== null;
detailRemovalGeneration += 1;
generation = detailRemovalGeneration;
try {
if (ClipHub.Window && capturedRoot !== null &&
typeof ClipHub.Window.detachWindow === "function") {
ClipHub.Window.detachWindow(capturedRoot);
}
} catch (ignoredDetach) {}
state.detailCloseCount += 1;
state.detailRemoveThreadName = String(thread.getName());
state.lastDetailAction = reasonText;
detailEmbeddedInPrimary = false;
detailRoot = null;
detailWindowRoot = null;
detailManagedFrame = null;
detailParams = null;
detailRow = null;
detailCopyView = null;
detailEditView = null;
detailCloseView = null;
detailWidthPx = 0;
detailHeightPx = 0;
if (capturedRoot === null) {
detailClosing = false;
detailRemovalPending = false;
return { ok: true, attached: false, alreadyClosed: false };
}
removal = ClipHub.Window.requestViewRemoval({
manager: capturedManager,
view: capturedRoot,
role: "detail",
reason: reasonText,
generation: generation,
onDetached: function (result) {
var request;
if (generation !== detailRemovalGeneration) { return; }
detailClosing = false;
detailRemovalPending = false;
if (!result || result.ok !== true) {
state.lastError = String(result && result.error ?
result.error : "Detail removal failed");
pendingDetailOpen = null;
return;
}
request = pendingDetailOpen;
pendingDetailOpen = null;
if (request !== null && ready) {
openDetail(request.row, request.force);
}
}
});
if (!removal || removal.ok !== true) {
detailClosing = false;
detailRemovalPending = false;
pendingDetailOpen = null;
state.lastError = String(removal && removal.error ?
removal.error : "Detail removal queue failed");
}
return { ok: removal && removal.ok === true, attached: false,
alreadyClosed: false, removalPending: detailRemovalPending };
}, 3000);
}
function copyDetail() {
var thread = Thread.currentThread();
var result;
if (detailRow === null) { return false; }
try {
result = ClipHub.Clipboard.writeText(String(detailRow.content), {
label: "ClipHub 详情",
sensitive: Number(detailRow.is_sensitive || 0) === 1
});
state.detailCopyCount += 1;
state.detailActionThreadName = String(thread.getName());
state.lastDetailAction = "copy";
state.lastCopiedId = Number(detailRow.id);
state.lastCopyOk = result && result.ok === true;
return state.lastCopyOk;
} catch (error) {
state.lastError = String(error);
state.lastCopyOk = false;
return false;
}
}
function editFromDetail() {
var row = detailRow;
var thread = Thread.currentThread();
if (row === null) { return false; }
try {
state.detailEditCount += 1;
state.detailActionThreadName = String(thread.getName());
state.lastDetailAction = "edit";
closeDetail("edit");
ClipHub.Editor.openItem(Number(row.id));
return true;
} catch (error) {
state.lastError = String(error);
return false;
}
}
function buildDetailView(row, embedded) {
var palette = colors();
var chrome = detailChromeMetrics();
var root = new LinearLayout(androidContext);
var handleSlot = new FrameLayout(androidContext);
var handle = new View(androidContext);
var header = new LinearLayout(androidContext);
var title = makeText("内容详情", chrome.titleSp,
palette.textPrimary, true);
var meta = makeText(sourceText(row) + "  ·  " +
formatTime(row.last_copied_at), 10,
palette.textSecondary, false);
var scroll = new ScrollView(androidContext);
var body = makeText(String(row.content), 13,
palette.textPrimary, false);
var footer = new LinearLayout(androidContext);
var params;
var embeddedMode = embedded === true;
root.setOrientation(LinearLayout.VERTICAL);
if (embeddedMode) {
root.setPadding(0, 0, 0, 0);
root.setBackground(null);
} else {
root.setPadding(dp(chrome.screenPaddingDp), dp(chrome.pagePaddingTopDp),
dp(chrome.screenPaddingDp), dp(chrome.pagePaddingBottomDp));
root.setBackground(roundedBackground(palette.surface,
palette.stroke, chrome.pageRadiusDp));
}
if (Build.VERSION.SDK_INT >= 21) {
root.setElevation(embeddedMode ? 0 : dp(18));
}
/* detail_chrome_unified_v1 */
handle.setBackground(roundedBackground(
palette.strokeStrong, null, 3));
params = new FrameLayout.LayoutParams(dp(chrome.dragHandleWidthDp),
dp(chrome.dragHandleHeightDp));
params.gravity = Gravity.TOP | Gravity.CENTER_HORIZONTAL;
params.topMargin = dp(chrome.dragHandleTopDp);
handleSlot.addView(handle, params);
root.addView(handleSlot, new LinearLayout.LayoutParams(
LinearLayout.LayoutParams.MATCH_PARENT, dp(chrome.dragHandleSlotDp)));
if (embeddedMode) { handleSlot.setVisibility(View.GONE); }
header.setOrientation(LinearLayout.HORIZONTAL);
header.setGravity(Gravity.CENTER_VERTICAL);
header.addView(title, new LinearLayout.LayoutParams(
0, LinearLayout.LayoutParams.WRAP_CONTENT, 1));
detailCloseView = makeIcon("×", palette.icon, chrome.iconSp,
"关闭内容详情");
detailCloseView.setBackground(circleBackground(
palette.surfaceMuted, null));
detailCloseView.setOnClickListener(new JavaAdapter(
View.OnClickListener, {
onClick: function () {
closeDetail("button");
}
}));
header.addView(detailCloseView,
new LinearLayout.LayoutParams(dp(chrome.actionSizeDp), dp(chrome.actionSizeDp)));
params = new LinearLayout.LayoutParams(
LinearLayout.LayoutParams.MATCH_PARENT,
dp(chrome.headerHeightDp));
params.bottomMargin = dp(chrome.headerBottomGapDp);
root.addView(header, params);
if (embeddedMode) {
header.setVisibility(View.GONE);
detailCloseView = null;
}
meta.setSingleLine(true);
meta.setEllipsize(TextUtils.TruncateAt.END);
params = new LinearLayout.LayoutParams(
LinearLayout.LayoutParams.MATCH_PARENT,
LinearLayout.LayoutParams.WRAP_CONTENT);
params.bottomMargin = dp(9);
root.addView(meta, params);
body.setTextIsSelectable(true);
body.setGravity(Gravity.TOP | Gravity.START);
body.setLineSpacing(0, 1.13);
body.setPadding(dp(12), dp(11), dp(12), dp(11));
body.setBackground(roundedBackground(palette.surfaceMuted,
palette.stroke, chrome.cardRadiusDp));
scroll.setFillViewport(true);
scroll.setVerticalScrollBarEnabled(false);
scroll.addView(body, new FrameLayout.LayoutParams(
FrameLayout.LayoutParams.MATCH_PARENT,
FrameLayout.LayoutParams.WRAP_CONTENT));
root.addView(scroll, new LinearLayout.LayoutParams(
LinearLayout.LayoutParams.MATCH_PARENT, 0, 1));
footer.setOrientation(LinearLayout.HORIZONTAL);
footer.setGravity(Gravity.END | Gravity.CENTER_VERTICAL);
footer.setPadding(0, dp(10), 0, 0);
detailEditView = makePill("✎  编辑", palette, false);
detailEditView.setClickable(true);
detailEditView.setFocusable(true);
detailEditView.setOnClickListener(new JavaAdapter(
View.OnClickListener, {
onClick: function () {
editFromDetail();
}
}));
params = new LinearLayout.LayoutParams(
LinearLayout.LayoutParams.WRAP_CONTENT,
LinearLayout.LayoutParams.WRAP_CONTENT);
params.rightMargin = dp(7);
footer.addView(detailEditView, params);
detailCopyView = makePill("复制", palette, true);
detailCopyView.setClickable(true);
detailCopyView.setFocusable(true);
detailCopyView.setOnClickListener(new JavaAdapter(
View.OnClickListener, {
onClick: function () {
copyDetail();
}
}));
footer.addView(detailCopyView,
new LinearLayout.LayoutParams(
LinearLayout.LayoutParams.WRAP_CONTENT,
LinearLayout.LayoutParams.WRAP_CONTENT));
root.addView(footer, new LinearLayout.LayoutParams(
LinearLayout.LayoutParams.MATCH_PARENT,
LinearLayout.LayoutParams.WRAP_CONTENT));
return root;
}
function openDetail(row, force) {
if (!force && !isLongText(row)) { return false; }
if (detailRemovalPending) {
pendingDetailOpen = { row: row, force: force };
return { ok: true, attached: false, pending: true };
}
if (detailRoot !== null) {
if (detailEmbeddedInPrimary) {
closeDetail("replace");
} else {
closeDetail("replace");
pendingDetailOpen = { row: row, force: force };
return { ok: true, attached: false, pending: true };
}
}
return ClipHub.Window.runOnMain(function () {
var size;
var type;
var flags;
var thread = Thread.currentThread();
var primaryAvailable = false;
var primaryMounted = false;
try {
primaryAvailable = ClipHub.UIShell &&
typeof ClipHub.UIShell.canEmbed === "function" &&
ClipHub.UIShell.canEmbed("detail") === true;
} catch (ignoredPrimaryAvailability) {
primaryAvailable = false;
}
if (primaryAvailable) {
detailRow = row;
detailRoot = buildDetailView(row, true);
try {
primaryMounted = ClipHub.UIShell.mountPage("detail", detailRoot, {
title: "内容详情",
showBack: true,
onBack: function () {
return closeDetail("shell_back").ok === true;
},
onClose: function () {
return closeDetail("shell_close").ok === true;
}
}) !== false;
} catch (primaryError) {
state.lastError = String(primaryError);
primaryMounted = false;
try {
if (ClipHub.UIShell &&
typeof ClipHub.UIShell.unmountPage === "function") {
ClipHub.UIShell.unmountPage("detail", "detail_mount_failed");
}
} catch (ignoredPrimaryCleanup) {}
}
if (primaryMounted) {
detailEmbeddedInPrimary = true;
detailWindowRoot = null;
detailManagedFrame = null;
detailParams = null;
detailWidthPx = 0;
detailHeightPx = 0;
state.detailOpenCount += 1;
state.lastDetailItemId = Number(row.id);
state.detailAddThreadName = String(thread.getName());
state.lastDetailAction = "open";
state.lastError = null;
return true;
}
detailRoot = null;
detailRow = null;
detailCopyView = null;
detailEditView = null;
detailCloseView = null;
}
size = detailDimensions();
type = Build.VERSION.SDK_INT >= 26 ?
WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY :
WindowManager.LayoutParams.TYPE_SYSTEM_ALERT;
flags =
WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED |
WindowManager.LayoutParams.FLAG_DIM_BEHIND;
detailEmbeddedInPrimary = false;
detailRow = row;
detailRoot = buildDetailView(row, false);
detailManagedFrame = ClipHub.Window.createManagedFrame(detailRoot, {
accentColor: colors().accentStrong
});
detailWindowRoot = detailManagedFrame.rootView;
detailWidthPx = Number(size.width);
detailHeightPx = Number(size.height);
detailParams = new WindowManager.LayoutParams(
size.width, size.height, type, flags,
PixelFormat.TRANSLUCENT);
detailParams.gravity = Gravity.TOP | Gravity.START;
detailParams.x = Number(size.x || 0);
detailParams.y = Number(size.y || 0);
detailParams.dimAmount = DETAIL_DIM_AMOUNT;
try {
detailParams.setTitle("ClipHub Content Detail");
} catch (ignoredTitle) {}
detailWindowManager.addView(detailWindowRoot, detailParams);
ClipHub.Window.attachWindow({
role: "detail",
rootView: detailWindowRoot,
contentView: detailRoot,
layoutParams: detailParams,
windowManager: detailWindowManager,
dragView: detailManagedFrame.dragView,
resizeView: detailManagedFrame.resizeView,
resizeVisual: detailManagedFrame.resizeVisual,
geometry: size,
onGeometryChanged: function (geometry) {
detailWidthPx = Number(geometry.width || 0);
detailHeightPx = Number(geometry.height || 0);
},
onRequestClose: function () {
return closeDetail("managed_close").ok === true;
}
});
state.detailOpenCount += 1;
state.lastDetailItemId = Number(row.id);
state.detailAddThreadName = String(thread.getName());
state.lastDetailAction = "open";
state.lastError = null;
return true;
}, 3000);
}
function getDetailState() {
var attached = false;
var flags = detailParams === null ? 0 :
Number(detailParams.flags);
try {
attached = detailRoot !== null &&
detailRoot.isAttachedToWindow();
} catch (ignored) {}
return {
attached: detailRoot !== null,
attachedToWindow: attached,
embeddedInPrimary: detailEmbeddedInPrimary === true,
closing: detailClosing === true,
removalPending: detailRemovalPending === true,
itemId: detailRow === null ? null : Number(detailRow.id),
sensitive: detailRow !== null &&
Number(detailRow.is_sensitive || 0) === 1,
contentLength: detailRow === null ? 0 :
String(detailRow.content).length,
textVisible: detailRoot !== null && detailRow !== null,
textSelectable: detailRoot !== null,
scrollable: detailRoot !== null,
copyButtonPresent: detailCopyView !== null,
editButtonPresent: detailEditView !== null,
closeButtonPresent: detailCloseView !== null,
modal: detailParams !== null &&
(flags & Number(
WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL)) === 0,
opaque: detailRoot !== null,
dimFlagPresent: detailParams !== null &&
(flags & Number(
WindowManager.LayoutParams.FLAG_DIM_BEHIND)) !== 0,
dimAmount: detailParams === null ? 0 :
Number(detailParams.dimAmount || 0),
notTouchModalAbsent: detailParams !== null &&
(flags & Number(
WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL)) === 0,
mainWindowHidden: false,
windowType: detailParams === null ? null :
Number(detailParams.type),
windowFlags: flags,
windowWidthDp: detailWidthPx > 0 ?
Math.round(detailWidthPx / density) : 0,
windowHeightDp: detailHeightPx > 0 ?
Math.round(detailHeightPx / density) : 0,
openCount: Number(state.detailOpenCount),
closeCount: Number(state.detailCloseCount),
copyCount: Number(state.detailCopyCount),
editCount: Number(state.detailEditCount),
addThreadName: state.detailAddThreadName,
removeThreadName: state.detailRemoveThreadName,
actionThreadName: state.detailActionThreadName,
lastAction: state.lastDetailAction
};
}
function show(options) {
options = options || {};
if (!ClipHub.Filter ||
typeof ClipHub.Filter.showRoot !== "function") {
throw new Error("ClipHub primary home is unavailable");
}
return ClipHub.Filter.showRoot({
requestKeyboard: options.requestKeyboard === true,
showAdvanced: options.showAdvanced === true
});
}
function currentManualOrders() {
var output = [];
var index;
for (index = 0; index < items.length; index += 1) {
output.push({
id: Number(items[index].id),
pinned: Number(items[index].is_pinned || 0) === 1,
manualOrder: Number(items[index].manual_order || 0)
});
}
return output;
}
function getState() {
var ids = [];
var index;
var currentFilter = filterState();
for (index = 0; index < items.length; index += 1) {
ids.push(Number(items[index].id));
}
return {
ready: ready,
visible: false,
itemCount: items.length,
itemIds: ids,
manualOrders: currentManualOrders(),
renderedCount: items.length,
emptyVisible: items.length === 0,
refreshCount: Number(state.refreshCount),
eventRefreshCount: Number(state.eventRefreshCount),
copyCount: Number(state.copyCount),
deleteCount: Number(state.deleteCount),
restoreCount: Number(state.restoreCount),
pinToggleCount: Number(state.pinToggleCount),
reorderCount: Number(state.reorderCount),
reorderRejectCount: Number(state.reorderRejectCount),
reorderEnabled: ready && currentFilter.active !== true &&
items.length > 1,
detailOpenCount: Number(state.detailOpenCount),
detailCloseCount: Number(state.detailCloseCount),
detailCopyCount: Number(state.detailCopyCount),
detailEditCount: Number(state.detailEditCount),
lastCopiedId: state.lastCopiedId,
lastDeletedId: state.lastDeletedId,
lastRestoredId: state.lastRestoredId,
lastPinnedId: state.lastPinnedId,
lastPinnedValue: state.lastPinnedValue,
lastDetailItemId: state.lastDetailItemId,
lastReorderItemId: state.lastReorderItemId,
lastReorderTargetId: state.lastReorderTargetId,
lastReorderPinned: state.lastReorderPinned,
lastReorderPlaceAfter: state.lastReorderPlaceAfter,
lastReorderReason: state.lastReorderReason,
lastCopyOk: state.lastCopyOk,
undoAvailable: lastDeleted !== null,
filterActive: currentFilter.active === true,
clickThreadName: state.clickThreadName,
deleteThreadName: state.deleteThreadName,
restoreThreadName: state.restoreThreadName,
pinThreadName: state.pinThreadName,
reorderThreadName: state.reorderThreadName,
detailActionThreadName: state.detailActionThreadName,
detail: getDetailState(),
lastError: state.lastError,
windowAttached: false,
legacyHomeRemoved: true
};
}
function resetState() {
state.refreshCount = 0;
state.eventRefreshCount = 0;
state.copyCount = 0;
state.deleteCount = 0;
state.restoreCount = 0;
state.pinToggleCount = 0;
state.reorderCount = 0;
state.reorderRejectCount = 0;
state.detailOpenCount = 0;
state.detailCloseCount = 0;
state.detailCopyCount = 0;
state.detailEditCount = 0;
state.lastCopiedId = null;
state.lastDeletedId = null;
state.lastRestoredId = null;
state.lastPinnedId = null;
state.lastPinnedValue = null;
state.lastDetailItemId = null;
state.lastReorderItemId = null;
state.lastReorderTargetId = null;
state.lastReorderPinned = null;
state.lastReorderPlaceAfter = null;
state.lastReorderReason = null;
state.lastCopyOk = false;
state.clickThreadName = null;
state.deleteThreadName = null;
state.restoreThreadName = null;
state.pinThreadName = null;
state.reorderThreadName = null;
state.detailActionThreadName = null;
state.detailAddThreadName = null;
state.detailRemoveThreadName = null;
state.lastDetailAction = null;
state.lastError = null;
}
ClipHub.List = {
MODULE_NAME: "ch_09_list",
MODULE_VERSION: 23,
LONG_TEXT_THRESHOLD: LONG_TEXT_THRESHOLD,
init: function (context) {
androidContext = context && context.androidContext ?
context.androidContext : global.context;
if (androidContext === null || androidContext === undefined) {
throw new Error("Android context unavailable for list");
}
androidContext = androidContext.getApplicationContext() ||
androidContext;
detailWindowManager = androidContext.getSystemService(
Context.WINDOW_SERVICE);
if (detailWindowManager === null) {
throw new Error("WindowManager unavailable for detail");
}
density = Number(androidContext.getResources()
.getDisplayMetrics().density || 1);
items = [];
lastDeleted = null;
detailRoot = null;
detailWindowRoot = null;
detailManagedFrame = null;
detailParams = null;
detailRow = null;
detailCopyView = null;
detailEditView = null;
detailCloseView = null;
detailWidthPx = 0;
detailHeightPx = 0;
detailClosing = false;
detailRemovalPending = false;
detailRemovalGeneration = 0;
pendingDetailOpen = null;
resetState();
ready = true;
refresh(false);
return true;
},
show: show,
refresh: function () {
return refresh(false);
},
hide: function () {
closeDetail("list_hide");
return true;
},
setItems: function (value) {
items = copyRows(value || []);
return items.length;
},
clear: function () {
items = [];
return true;
},
performItemClick: function (index) {
index = Math.floor(Number(index));
if (index < 0 || index >= items.length) { return false; }
return ClipHub.Window.runOnMain(function () {
return copyRow(items[index]);
}, 2500);
},
performCardOpenClick: function (index) {
index = Math.floor(Number(index));
if (index < 0 || index >= items.length) { return false; }
return ClipHub.List.openDetail(Number(items[index].id));
},
performReorder: function (fromIndex, toIndex) {
return ClipHub.Window.runOnMain(function () {
return commitReorder(fromIndex, toIndex);
}, 3000);
},
performDetailCopyClick: function () {
return ClipHub.Window.runOnMain(function () {
return detailCopyView !== null ?
detailCopyView.performClick() : false;
}, 2500);
},
performDetailEditClick: function () {
return ClipHub.Window.runOnMain(function () {
return detailEditView !== null ?
detailEditView.performClick() : false;
}, 2500);
},
performDetailCloseClick: function () {
return ClipHub.Window.runOnMain(function () {
return detailCloseView !== null ?
detailCloseView.performClick() : false;
}, 2500);
},
openDetail: function (id) {
var row = ClipHub.Repository.getItem(Number(id), false);
return row === null || row === undefined ?
false : openDetail(row, true);
},
closeDetail: function () {
return closeDetail("api");
},
getDetailState: getDetailState,
deleteItem: function (id) {
var row = ClipHub.Repository.getItem(Number(id), false);
return row === null || row === undefined ?
false : deleteRow(row);
},
undoLastDelete: undoLastDelete,
togglePinned: function (id) {
var row = ClipHub.Repository.getItem(Number(id), false);
return row === null || row === undefined ?
false : togglePinned(row);
},
getState: getState,
shutdown: function () {
try {
closeDetail("shutdown");
} catch (ignoredDetail) {}
pendingDetailOpen = null;
items = [];
lastDeleted = null;
ready = false;
detailWindowManager = null;
androidContext = null;
return true;
}
};
}((function () { return this; }())));
