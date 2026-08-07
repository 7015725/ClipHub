# ClipHub 分页阶段 9：数据变化与操作回归

## 分支与版本

- 分支：`agent/add-pagination-lazy-prefetch-20260807`
- 模块集：`20260807.13`
- `Filter.MODULE_VERSION = 48`
- `Filter.PAGINATION_STAGE = 9`
- 模块数量：15

## 目标

Stage 9 在 Stage 8 数据窗口之上统一处理会改变结果集的数据事件：

1. 新剪贴板记录到达旧位置时，只标记“有新内容”，不打断当前位置；
2. 删除、撤销、编辑、置顶和标签变化后重建当前分页深度；
3. 搜索、筛选、排序和分页设置变化时优先恢复原锚点；
4. AJAX 与数字分页切换时按全局锚点索引映射新页码或加载深度；
5. 多个关联事件合并为一次刷新，避免编辑器保存记录后紧接标签事件重复重建；
6. 继续保持 Stage 6-8 的懒加载、预加载、虚拟 View 和数据脱水语义。

## 统一变化刷新计划

变化发生前记录：

- `anchorItemId`
- 当前页内 `anchorIndex`
- `anchorOffsetPx`
- 原分页模式、页码、页大小和已加载数量
- 是否为筛选条件变化或分页设置变化

刷新执行时：

1. 失效旧预加载与查询代次；
2. AJAX 模式恢复原加载深度，数字分页恢复原页；
3. 设置变化按全局索引映射目标页或 AJAX 深度；
4. 搜索、筛选、排序变化最多扫描 20 页寻找原锚点；
5. 找到相同 ID 时恢复相同偏移；找不到时退回原索引附近；
6. 更新虚拟 View、数据窗口、Footer、总数和“回到最新”状态。

## 事件边界

- `clipboard_added`：浏览旧位置或非最新排序时只设置待处理新内容；
- 新记录紧随的 `tags_changed`：识别为同一条新增记录的关联事件并抑制重复刷新；
- `clipboard_deleted / clipboard_restored / clipboard_merged / clipboard_updated / tags_changed`：进入统一变化刷新；
- 搜索、筛选和排序：作为条件变化刷新；
- 分页模式、页大小和预加载设置：作为设置变化刷新。

只有明确执行“回到最新”时，才允许清除锚点并回到第一页顶部。

## 诊断接口

新增：

```javascript
ClipHub.Filter.getMutationState()
ClipHub.Filter.performMutationRefresh(origin)
```

核心字段：

- `eventCount / refreshRequestCount / refreshCount`
- `coalescedCount / relatedEventSuppressedCount`
- `addedPendingCount / settingsChangeCount`
- `anchorRestoreCount / anchorFallbackCount`
- `lastModeBefore / lastModeAfter`
- `lastPageNumberBefore / lastPageNumberAfter`
- `lastLoadedCountBefore / lastLoadedCountAfter`
- `lastReloadPageCount`
- `lastAnchorItemIdBefore / lastAnchorItemIdAfter`
- `lastAnchorOffsetPxBefore / lastAnchorOffsetPxAfter`
- `lastAnchorRestoreErrorPx / lastPositionPreserved`
- `lastOrigin / lastError`

## 冻结边界

- 不修改 `src/ch_06_repository.js`；
- 不修改 `src/ch_08_window.js`；
- 不修改 `src/ch_13_settings.js`；
- 不修改 `src/ch_15_app.js`；
- 不修改正式入口、浮窗开关和停止后台链路；
- 不新增 `ch_16`；
- 模块数保持 15；
- Rhino ES5；
- `main` 不直接修改。

## 真机测试入口

`ClipHub_分页阶段9数据变化与操作回归测试入口.txt`

测试入口版本：3。隔离运行目录：

`ClipHubPaginationStage9Mutation`

测试创建 241 条临时记录和 1 个临时标签，覆盖：

1. 旧位置收到新记录及关联标签事件，不改变 ID、滚动位置和锚点；
2. 回到最新后首条为新记录、第一页顶部且锚点清空；
3. 删除与撤销后保持深层锚点；
4. 编辑、置顶和标签保存后保持锚点并看到最新数据；
5. 标签筛选、搜索和排序重建后恢复锚点；
6. AJAX 120 条切换到数字分页 60 条时映射正确页码；
7. 切回 AJAX 时恢复加载深度，懒加载与预加载状态正确；
8. 测试结束后清理记录与标签、恢复设置并延迟停止隔离实例。

## 通过条件

- `moduleSetVersion = 20260807.13`
- `filterModuleVersion = 48`
- `paginationStage = 9`
- 新内容待处理期间当前位置完全不变
- 删除、撤销、编辑、置顶、标签变化后保持相同 `anchorItemId`
- 搜索、筛选、排序清除后恢复相同锚点
- 数字分页目标页与全局锚点索引一致
- 锚点恢复误差不超过 32px
- AJAX 模式懒加载开启，数字分页模式懒加载关闭
- 分页、预加载、虚拟窗口、数据窗口、变化协调器和面板错误字段均为 `null`

## v2 锚点锁修正

v1 真机在切换为置顶排序时，查询和分页状态均正常，但结果重建过程中 `refreshResultsOnMain()` 使用旧 ScrollView 位置再次执行锚点捕获，把待恢复 ID 从 `163` 改写为 `187`。

v2 在统一变化刷新期间锁定首次捕获的 `anchorItemId + anchorOffsetPx`。旧 View 的捕获请求只返回诊断状态，不再改写锚点；首次恢复完成后解锁，再由已排队的测量回调复核实际位置。生产载荷和测试载荷均改用独立 v2 分片，避免旧入口与新资源交叉校验。

## v3 回到最新锚点清理修正

v2 真机已通过删除、撤销、编辑、置顶、标签、筛选、搜索、排序和分页设置回归。唯一失败项是“回到最新”已到第一页顶部且首条正确，但旧窗口的异步捕获在 `scrollToTopPending` 期间重新写入了第一页末条 ID。

v3 在显式回顶尚未完成时直接忽略锚点捕获，保持 `anchorItemId = null`。测试会等待虚拟更新结束，再额外延迟 180ms 复核锚点没有被异步回调重新写入。生产载荷和测试载荷改用独立 v3 分片。
