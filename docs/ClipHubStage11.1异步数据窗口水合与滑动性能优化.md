# ClipHub Stage 11.1：异步数据窗口水合与滑动性能优化实施记录

## 基线与边界

- 仓库：`7015725/ClipHub`
- PR：`#49`，保持 Draft
- Base：`beta-pagination-stage10-20260808`
- 开发分支：`agent/beta-list-preview-on-demand-20260808`
- `ENTRY_VERSION = 6`
- 目标 `moduleSetVersion = 20260808.03`
- Repository：16
- List：20
- Filter：50
- `PAGINATION_STAGE = 9`
- 数据库 schema：2
- 模块数量：15

本阶段继续冻结 `VIRTUAL_BEFORE_SCREENS = 3`、`VIRTUAL_AFTER_SCREENS = 5`、`VIRTUAL_UPDATE_DELAY_MS = 24`，不调整 AJAX、数字分页、数据窗口块大小、数据库 schema、锚点和 Mutation 语义。

## 实现

Filter 内新增一个 `Executors.newSingleThreadExecutor()` Data Worker，仅负责：

1. `Repository.listItemsByIds(ids, true)`；
2. `Repository.listItemTagMap(tagIds)`。

Worker 与 Android main thread 之间只传 JSON 字符串。Worker 不访问 `previewRows`、分页状态、锚点、Android View、WindowManager 或 Mutation 状态。

调度采用 latest-wins 单槽：已有查询执行时，新请求覆盖 `latestRequest`，不会堆积普通任务队列；正常滚动不反复执行 `Future.cancel(true)`。

main thread apply 同时校验：

- `hydrationEpoch`
- `requestId`
- `queryGeneration`
- `renderGeneration`

结果按当前 ID 二次定位，仅替换仍为 `__clipHubDehydrated === true` 的 row。数据库中已经不存在的 ID 仍由 main thread 调用原有缺失 ID 修正逻辑处理，禁止按旧 index 回写。

## 虚拟窗口

目标范围包含 dehydrated row 时，本帧只提交 Worker，不拿 stub 创建卡片；保留现有 View。Worker 返回并在 main thread apply 后，触发一次强制虚拟窗口更新。

数据窗口 dehydration 仍同步保留在 main thread。

## 生命周期

普通 `closePanel()`：

- `hydrationEpoch++`
- 清空 latest request
- 迟到结果失效
- Executor 保留

完全 `Filter.shutdown()`：

- invalidate
- cancel active Future
- `shutdownNow()`
- `awaitTermination()`
- 清理 Executor/队列
- 然后继续既有模块逆序 shutdown

因此不修改 `src/ch_15_app.js`。

## 性能诊断

新增：

- `ClipHub.Filter.getHydrationWorkerState()`
- `ClipHub.Filter.getScrollPerformanceState()`

Worker 诊断包括 request/query/success/failure、latest replacement、stale drop、post-close drop、Worker query 和 main apply 的 last/max 耗时。

Scroll 诊断包括 virtual schedule/update、View rebuild、创建/移除 View、hydration request 等计数和耗时。

## 文件

生产改动：

- `src/ch_11_filter.js`
- `module-manifest.json`
- `stage-assets/pagination-stage9/ch11_full_v5_00.b64` … `ch11_full_v5_07.b64`

测试/文档：

- `ClipHub_Stage11.1数据窗口Worker测试入口.txt`
- `ClipHub_分页阶段11首页预览按需正文测试入口.txt`（身份版本同步）
- `docs/ClipHubStage11.1异步数据窗口水合与滑动性能优化.md`

旧 v4 分片保留，不覆盖。

## 明确未修改

- `src/ch_03_database.js`
- `src/ch_06_repository.js`
- `src/ch_08_window.js`
- `src/ch_09_list.js`
- `src/ch_10_editor.js`
- `src/ch_12_translation.js`
- `src/ch_13_settings.js`
- `src/ch_15_app.js`
- SQL 的 `length(content)` 语义
- WAL / schema
- 复制、输入、编辑、翻译、详情异步化
- View reuse / RecyclerView
- `ch_16`

## 真机验收

先运行 `ClipHub_Stage11.1数据窗口Worker测试入口.txt`，目标是 50 轮 `listItemsByIds(ids, true)` + `listItemTagMap(ids)` Worker 查询稳定、JSON 跨线程稳定、无 Rhino/SQLite 异常。

然后正式 ClipHub：

1. 连续快速向下 fling、快速向上返回并重复；
2. 读取 `getHydrationWorkerState()`；
3. 读取 `getScrollPerformanceState()`；
4. 回归 AJAX、prefetch、数字分页、data window、anchor、Mutation、resetToLatest、hide/show、stop；
5. 回归 200 字符预览与复制/输入/编辑/翻译/详情完整正文。

重点记录：

- `workerQueryMaxMs`
- `mainApplyMaxMs`
- `virtualUpdateMaxMs`
- `viewRebuildMaxMs`

若 Worker 查询已经很低而 `viewRebuildMaxMs` 仍明显偏高，下一阶段进入 `virtualCardHost` View reuse/rebind，不继续增加 Worker。
