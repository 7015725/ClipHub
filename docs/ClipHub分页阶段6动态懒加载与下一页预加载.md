# ClipHub 分页阶段 6：动态懒加载与下一页预加载

## 分支

`agent/add-pagination-lazy-prefetch-20260807`

## 模块集

`20260807.08`

## 目标

阶段 6 在已经通过真机验证的 AJAX Keyset 追加和数字分页之上，增加两项运行能力：

1. AJAX 模式滚动接近列表底部时自动加载下一页；
2. AJAX 与数字分页模式均提前在内存中预取下一页，实际翻页/追加时优先消费预取结果。

本阶段不实现虚拟 View、记录窗口裁剪、锚点恢复和“当前位置前后多少条”，这些留到阶段 7。

## 动态懒加载

### 触发条件

仅 AJAX 模式绑定纵向滚动监听。必须同时满足：

- 浮窗仍处于 attached 状态；
- 当前分页模式为 `ajax`；
- `hasMore = true`；
- 当前没有 AJAX 加载；
- 当前没有懒加载请求 pending；
- 用户发生向下滚动；
- 距离列表底部不超过动态阈值；
- 同一已加载数量没有重复触发；
- 距离上一次触发至少 `260ms`。

动态阈值取以下两者较大值：

- `120dp`；
- 当前结果区 viewport 高度的 `38%`。

这样不会依赖固定屏幕尺寸，也不会在大窗口中过晚触发。

### 自动加载行为

自动触发复用阶段 4 的 AJAX Keyset 追加路径：

- 不清空已有卡片；
- 不回到列表顶部；
- 按 ID 去重；
- 只为新记录读取标签；
- 继续保持当前滚动位置；
- 最后一页仍进入 Footer `end` 状态。

原“加载更多”Footer 保留，作为手动兜底。自动懒加载不会计入 Footer 的人工点击次数。

### 防止自动连锁加载

布局重排本身不直接触发下一页。自动加载只从向下滚动事件或显式诊断 API 进入，并通过：

- `pending`
- `lastTriggeredLoadedCount`
- `260ms` cooldown

共同阻止同一页重复触发和追加后的自动级联。

## 下一页预加载

### 预加载开关

沿用阶段 2 设置：

`paginationPrefetchEnabled`

- `true`：允许下一页预加载；
- `false`：不发起预加载，并清空现有内存预取页。

### AJAX 模式

当前页完整渲染或追加完成后，延迟 `160ms` 预取：

- `mode = append`
- `cursor = 当前 endCursor`
- `pageSize = 当前设置值`
- 不重复读取总数。

后续懒加载或手动“加载更多”请求的 key 与预取页匹配时，直接消费预取结果，不再次查询 Repository。

### 数字分页模式

当前页完整渲染后，延迟 `160ms` 预取：

`currentPage + 1`

用户进入下一页时，如查询条件、页大小、代次和页码均匹配，直接消费该预取页。随后再预取新的下一页。

## 预取一致性与失效

内存中只保留一页预取结果。缓存 key 包含：

- `queryGeneration`
- 当前筛选条件签名
- 分页模式
- `pageSize`
- 数字页码或 AJAX cursor

以下情况立即使预取结果失效：

- 搜索/来源/标签/置顶/敏感/排序条件改变；
- 分页模式改变；
- 每页数量改变；
- 预加载开关改变；
- 统一分页 reset；
- query generation 改变；
- 实际请求 key 与预取 key 不一致。

过时代次完成的预取结果会被丢弃，不会写回当前分页状态。

## 线程边界

阶段 6 仍只使用现有主线程 `Handler / postDelayed` 调度：

- 不新增 Executor；
- 不从工作线程直接触碰 Android View；
- 不改变 WindowManager 生命周期链；
- 不改变 ShortX 控制广播。

这是当前已验证边界下的保守实现。

## 诊断状态

新增：

- `getLazyLoadState()`
- `getPrefetchState()`
- `getRemainingScrollPx()`
- `performLazyLoadCheck(origin)`
- `performPrefetchNow(origin)`

### Lazy 状态

记录：

- listener 是否绑定；
- 当前是否启用；
- threshold / remaining；
- 滚动事件与向下滚动次数；
- near-bottom 次数；
- trigger / success / failure / blocked；
- 最近一次触发时的 loadedCount；
- 错误。

### Prefetch 状态

记录：

- enabled / scheduled / inFlight / ready；
- 预取模式和目标页；
- 预取行数；
- schedule / request / success；
- hit / miss；
- invalidation / stale discard；
- 最近来源和错误。

## 模块版本

- `Filter.MODULE_VERSION = 43`
- `Filter.PAGINATION_STAGE = 6`
- `moduleSetVersion = 20260807.08`

## 冻结边界

- `src/ch_08_window.js` 不修改；
- `src/ch_13_settings.js` 不修改；
- `src/ch_15_app.js` 不修改；
- 模块数量保持 15；
- 不新增 `ch_16`；
- Rhino ES5；
- `main` 不修改；
- 数字分页 UI 不改变；
- 阶段 7 的虚拟 View / 锚点恢复不提前实现。

## 真机测试入口

`ClipHub_分页阶段6懒加载与预加载测试入口.txt`

隔离运行目录：

`ClipHubPaginationStage6LazyPrefetch`

测试会创建 31 条临时记录，设置 AJAX 每页 12 条，并验证：

1. 首屏 12 条；
2. 强制预取第 2 页，预取 12 条；
3. 真正滚动到接近底部，由懒加载自动追加到 24 条；
4. 第 2 页实际请求命中预取缓存；
5. 预取第 3 页 7 条；
6. 再次接近底部，自动追加到 31 条；
7. 最终 `hasMore = false`，Footer 为 `end`；
8. 两次自动懒加载均成功；
9. 至少两次预取命中；
10. 切换数字分页后，预取数字第 2 页；
11. 跳到数字第 2 页时命中预取且只显示该页 12 条；
12. 关闭预加载设置后，显式预取返回 false，缓存为空。

测试期间会短暂显示一次隔离浮窗；结束后删除临时记录、恢复原设置并停止隔离实例。

## 真机通过条件

关键字段要求：

- `ok = true`
- `moduleSetVersion = 20260807.08`
- `filterModuleVersion = 43`
- `paginationStage = 6`
- AJAX 初始 12 条
- 第一次懒加载后 24 条
- 第二次懒加载后 31 条
- `lazy.successCount >= 2`
- `lazy.scrollEventCount >= 1`
- `lazy.downwardScrollCount >= 1`
- AJAX `prefetch.hitCount >= 2`
- 数字第 2 页顺序与 Repository 一致
- 数字页切换前后预取命中数增加
- 关闭预加载后 `enabled = false`、`ready = false`
- `lastError = null`
