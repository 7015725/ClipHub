# ClipHub 分页阶段 10：完整系统回归

## 分支与生产版本

- 分支：`agent/add-pagination-lazy-prefetch-20260807`
- 模块集：`20260807.13`
- `Filter.MODULE_VERSION = 48`
- `Filter.PAGINATION_STAGE = 9`
- 模块数量：15
- Stage 10 测试入口版本：5

Stage 10 不修改生产模块和正式入口，仅新增隔离真机回归入口、压缩载荷及测试说明。

## v2 修正

v1 真机结果确认 20 轮暖启动、20 轮快速显示/关闭及普通隐藏恢复全部通过，随后在创建顶部交互提示条时因主线程快速路径误判而中止；清理、设置恢复和完全停止均成功。该结果不涉及生产模块失败。

v2 仅修正测试实现：使用主 Looper 所属线程 ID 判定当前是否处于 Android 主线程，并在结果中增加 `lastCheckpoint`，用于准确定位后续交互阶段。生产版本、正式入口及冻结模块保持不变。

## v3 修正

v2 真机结果再次确认全部自动回归、最终停止、设置恢复和隔离清理通过；提示条已正常创建，失败点推进到 `interactive_ime`。原因是测试从工作线程调用 `Filter.performSearchToggleClick()` 和 `Filter.handleBack()` 时，模块内部的 Looper 包装对象快速判断误走直接调用路径。

v3 仅将 IME 自动测试中的展开搜索与关闭搜索动作显式投递到真实 Android 主线程，等待与状态采样仍留在工作线程，避免阻塞主线程。生产模块和版本不变。

## v4 修正

v3 真机已经完成搜索展开、焦点获取、IME 避让应用和关闭恢复，`lastInsetPx = 1093`，各项错误字段为空。唯一失败原因是主线程回调通过 `AtomicReference` 返回 `java.lang.Boolean(true)` 后，测试使用 `=== true` 比较，误将成功动作记录为 `toggleWorked = false`。

v4 仅把该返回值规范化为字符串布尔值后再判定，不改变任何执行路径或生产代码。

## v5 修正

v4 真机已通过 IME、系统侧滑返回和浮窗外部点击，失败点推进到真实拖动等待。当前拖动热区是浮窗最顶部正中间约 `86dp × 24dp` 的透明区域，并要求先保持超过长按阈值；提前移动会取消激活。

v5 在提示条中显示根据当前窗口几何计算出的屏幕目标坐标，明确要求按住约 1 秒、感觉震动后再移动。同时在失败结果中保留 `dragPending`、`dragActivateCount`、移动计数和前后几何，便于区分未命中热区、长按未激活和激活后未移动。生产模块和版本不变。

## 回归目标

覆盖分页改造后的完整系统交互边界：

1. 真实系统侧滑返回；
2. 点击浮窗外部关闭；
3. Home 后自动关闭全部 UI；
4. 进入最近任务后自动关闭全部 UI；
5. Filter 搜索输入框 IME 显示、避让和恢复；
6. 真实手指拖动窗口；
7. 真实手指缩放窗口；
8. 竖屏切横屏并转回原方向；
9. 普通隐藏后恢复面板缓存、滚动锚点和位置；
10. 完全停止后的数据库、窗口与运行锁清理；
11. 20 轮暖启动；
12. 20 轮快速显示/关闭。

## 测试入口

运行文件：

```text
ClipHub_分页阶段10完整系统回归测试入口.txt
```

隔离运行目录：

```text
ClipHubPaginationStage10SystemRegression
```

运行前先通过正式开关执行一次“停止后台”，避免正式浮窗与隔离测试浮窗重叠。测试不会修改正式 `ClipHub` 数据库。

## 执行顺序

入口先自动执行：

1. 同步当前分支 `.13` 的 15 个模块；
2. 创建 40 条隔离测试记录；
3. 完成 20 轮暖启动，检查面板缓存复用、主线程 attach 和错误字段；
4. 完成 20 轮快速显示/关闭，每轮延迟复核没有窗口迟到附加；
5. 完成普通隐藏与恢复，检查同一 `anchorItemId`、误差不超过 32px、面板未重新构建；
6. 自动展开搜索输入框，检查 IME 显示和避让，再关闭输入框并检查布局恢复。

随后屏幕顶部出现不拦截触摸的 Stage 10 提示条。严格按提示依次操作：

1. 执行一次系统侧滑返回；
2. 点击浮窗外部深色区域；
3. 长按顶部拖动条并移动窗口；
4. 长按右下角缩放手柄并改变尺寸；
5. 将设备旋转到另一方向，再转回原方向；
6. 按 Home 键；
7. 从底部上拉进入最近任务并停留。

每个动作限时 35 秒。不要提前执行下一步，以顶部提示内容为准。

## 真实交互判定

系统返回必须满足：

- `Navigation.backInvokedCount` 增加；
- `Navigation.backHandledCount` 增加；
- UI 全部关闭；
- `registeredRootCount = 0`。

外部点击必须满足：

- `EventBus.outsideTapCount` 增加；
- `Window.outsideDismissCount` 增加；
- UI 全部关闭。

拖动与缩放必须由真实 `MotionEvent` 触发：

- `dragMoveCount` 或 `resizeMoveCount` 增加；
- 几何位置或尺寸发生变化；
- 松手后 `moving/resizing = false`；
- 最终窗口仍在安全区域内。

旋转必须满足：

- `orientation` 实际变化后恢复；
- `configurationChangeCount` 或 `displayChangeCount` 增加；
- `boundsRefreshCount` 增加；
- 两个方向的窗口均在安全区域内。

Home 与最近任务分别要求：

- `RecentsWatch.hideCount` 增加；
- `confirmedSignalCount` 增加；
- UI 全部关闭；
- 返回回调清零；
- 后台实例仍运行，直到最后统一停止。

## 完全停止与清理

全部交互完成后测试自动：

1. 删除 40 条隔离记录；
2. 恢复原分页设置；
3. 调用 `ClipHub.App.stop()`；
4. 验证数据库关闭；
5. 验证窗口不可见；
6. 验证运行锁释放；
7. 删除隔离运行目录。

最终通过条件：

```text
ok=true
testEntryVersion=5
moduleSetVersion=20260807.13
filterModuleVersion=48
paginationStage=9
automatic.warmStarts.completed=20
automatic.rapidClose.completed=20
automatic.normalHideRestore.ok=true
interactive.ime.ok=true
interactive.systemBack.ok=true
interactive.outsideTap.ok=true
interactive.drag.ok=true
interactive.resize.ok=true
interactive.orientation.ok=true
interactive.home.ok=true
interactive.recents.ok=true
stop.ok=true
cleanup=true
error=null
```

## 冻结边界

- 不修改 `src/ch_06_repository.js`；
- 不修改 `src/ch_08_window.js`；
- 不修改 `src/ch_11_filter.js`；
- 不修改 `src/ch_13_settings.js`；
- 不修改 `src/ch_15_app.js`；
- 不修改正式入口、浮窗开关和停止后台；
- 不新增 `ch_16`，模块数量保持 15；
- Rhino ES5；
- `main` 不直接修改；
- 真实手势结果以 Android 14 / ColorOS / ShortX 返回为准。
