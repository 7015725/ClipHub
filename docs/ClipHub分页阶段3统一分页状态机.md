# ClipHub 分页阶段 3：统一分页状态机

## 分支与模块集

- 分支：`agent/add-pagination-lazy-prefetch-20260807`
- 模块集：`20260807.04`
- Filter 模块版本：`39`
- 分页阶段标识：`PAGINATION_STAGE = 3`

## 本阶段范围

本阶段建立首页分页的统一状态和查询入口，不增加可见的 AJAX 追加 Footer、数字页码或懒加载触发器。因此首页当前视觉和操作方式保持不变。

## 新增状态

`ClipHub.Filter.getPaginationState()` 返回：

- `mode`：设置层模式，`ajax | number`
- `repositoryMode`：Repository 模式，`append | number`
- `pageSize`
- `prefetchEnabled`
- `pageNumber`
- `loadedCount`
- `totalCount`
- `totalPages`
- `hasMore`
- `endCursor`
- `queryGeneration`
- `resetCount`
- `loadCount`
- `settingsSyncCount`
- `settingsEventCount`
- `criteriaChangeCount`
- `lastResetReason`
- `lastCriteriaSignature`
- `lastError`

## 新增 API

- `syncPaginationSettings()`
- `resetPagination(reason)`
- `getPaginationState()`
- `getPaginationQueryOptions(request)`
- `loadPaginationPage(request)`

统一查询入口通过 `Filter.toQueryOptions()` 取得当前关键词、来源、标签、置顶、敏感内容和排序条件，再调用 `Repository.listItemPage()`。

## 状态重置规则

出现以下变化时，分页代次递增并回到第一页：

- 分页模式变化；
- 单次加载数量变化；
- 预加载开关变化；
- 当前筛选条件签名变化；
- 显式调用 `resetPagination()`。

设置模块的 `pagination_settings_changed` 事件已经接入状态机。

## 生命周期

- Filter 初始化时建立分页状态并注册设置事件；
- Filter 停止时注销事件监听；
- `getState()` 和 `getPanelState()` 均包含 `pagination`；
- 测试入口不打开浮窗，不会再出现设置窗口闪烁。

## 冻结边界

- `ch_08_window.js` 不修改；
- `ch_13_settings.js` 不修改；
- 模块数量保持 15；
- 不新增 `ch_16`；
- 不改变当前首页渲染结果；
- AJAX Footer、数字分页和预加载执行留到后续阶段。

## 真机测试

运行：

`ClipHub_分页阶段3统一状态机测试入口.txt`

通过条件：

- `ok = true`
- `filterModuleVersion = 39`
- `paginationStage = 3`
- 初始状态为 `ajax / 100 / true`
- 数字模式映射为 Repository `number`
- AJAX 模式映射为 Repository `append`
- 修改关键词后 `queryGeneration` 增加
- `getPanelState()` 包含分页状态
- `uiOpened = false`
