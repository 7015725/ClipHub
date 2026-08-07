# ClipHub 分页阶段 4：AJAX 追加与 Footer

## 分支

`agent/add-pagination-lazy-prefetch-20260807`

## 模块集

`20260807.06`

## 目标

阶段 4 将首页旧的“增加 limit 后重新查询并全量重绘”改为真实 AJAX Keyset 分页，并复用现有底部加载控件进行增量追加。

数字页码不在本阶段实现，留到阶段 5。

## 实现内容

### Repository Keyset 接入

AJAX 模式使用：

- `mode = append`
- `pageSize = paginationPageSize`
- 首次查询 `cursor = null`
- 后续查询使用上页 `endCursor`
- 首次查询读取条件总数
- 后续追加不重复执行总数查询

### 增量追加

点击 Footer 后：

1. 保留当前 `ScrollView` 和已渲染卡片；
2. 使用统一分页状态机读取下一页；
3. 按记录 ID 去重；
4. 仅为新记录读取标签并创建新卡片；
5. 将新卡片追加到列表底部；
6. 重建 Footer；
7. 不清空列表、不回到顶部。

追加过程不会调用首页全量 `refreshResultsOnMain()`。

### Footer 状态

AJAX 模式 Footer 支持：

- `load_more`：可加载下一页；
- `loading`：正在加载；
- `end`：已加载全部；
- `none`：空列表或非 AJAX 模式。

公开诊断：

- `getAjaxFooterState()`
- `getLoadedResultIds()`
- `getResultScrollY()`
- `performSetResultScrollY(y)`
- `refreshPaginationUi(origin)`

### 兼容性

保留阶段 3 API：

- `syncPaginationSettings()`
- `resetPagination(reason)`
- `getPaginationState()`
- `getPaginationQueryOptions(request)`
- `loadPaginationPage(request)`

`Filter.MODULE_VERSION = 41`

`Filter.PAGINATION_STAGE = 4`

## 冻结边界

- `src/ch_08_window.js` 不修改；
- `src/ch_13_settings.js` 不修改；
- 模块数量保持 15；
- 不新增 `ch_16`；
- Rhino ES5；
- `main` 不修改；
- 数字分页按钮逻辑不在本阶段实现；
- 懒加载和预加载执行不在本阶段实现。

## 测试入口

`ClipHub_分页阶段4AJAX追加测试入口.txt`

测试使用隔离目录：

`ClipHubPaginationStage4AjaxFooter`

测试会：

1. 创建 13 条临时剪贴板记录；
2. 设置 AJAX、每页 5 条；
3. 短暂打开首页浮窗；
4. 验证首屏 5 条；
5. 点击两次 Footer，验证 10 条和 13 条；
6. 验证顺序、去重、终止状态和滚动位置；
7. 关闭浮窗；
8. 删除临时记录；
9. 恢复原设置并停止隔离实例。

由于测试真实创建首页 Footer，运行时会看到一次短暂浮窗显示。

## 通过条件

- `ok = true`
- `filterModuleVersion = 41`
- `paginationStage = 4`
- 首页 `5` 条
- 第一次追加后 `10` 条
- 第二次追加后 `13` 条
- `orderMatches = true`
- `duplicateCount = 0`
- 最终 Footer 为 `end`
- `clickCount = successCount = 2`
- `positionPreserved = true`
- 最终 `hasMore = false`
- 最终 `totalCount = 13`
- 临时记录全部清理


## Stage 4 修正 1

真机 V1 测试确认 AJAX 卡片追加、顺序、去重、Footer 终止状态及位置保持均正常，但后续页结果中的占位 `totalCount = 0` 覆盖了首屏总数。

修正后：

- 仅当请求包含 `includeTotal = true` 时采用 Repository 返回的总数；
- 后续追加页保持首屏总数；
- 最后一页使用累计记录数校准总数；
- `totalPages` 始终根据有效总数重新计算；
- Filter 模块版本提升到 `41`；
- 测试入口版本提升到 `2`。
