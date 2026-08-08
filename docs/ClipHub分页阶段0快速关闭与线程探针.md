# ClipHub 分页实施阶段 0：快速关闭防护与工作线程探针

## 1. 分支与冻结边界

- 开发分支：`agent/add-pagination-lazy-prefetch-20260807`
- 基线分支：`agent/rebuild-performance-from-main-20260806`
- 模块集版本：`20260807.01`
- 模块数量：保持 `15`
- 不新增 `src/ch_16_*.js`
- `src/ch_08_window.js` 必须继续保持 blob：`4ccff8067656ae51602290c884081795ec0f65ea`
- 本阶段不实现分页 Repository 接口、设置页、分页 Footer、预加载或虚拟列表。

## 2. 基线复核结论

当前 `src/ch_11_filter.js` 已经在 `closePanel()` 中递增 `renderGeneration` 和 `refreshGeneration`，并清理排队刷新、输入分发和窗口引用；因此本阶段保留其稳定 blob 和模块版本 `38`，不重复改写底层关闭逻辑。

缺失边界位于应用层：原 `App.stop()` 在模块全部关闭后才把 `state.started` 改为 `false`，停止期间仍存在控制入口重新显示 Filter 的时间窗口，也没有供未来分页 Executor 在数据库关闭前注册取消动作的统一契约。

## 3. `src/ch_15_app.js` 改动

模块版本：`18 → 19`。

### 3.1 生命周期闸门

新增状态：

```javascript
stopping
lifecycleGeneration
lastStopReason
filterPreparedForShutdown
filterStopping
filterGuardInstalled
```

停止开始时严格执行：

```text
stopping = true
→ started = false
→ lifecycleGeneration + 1
→ Filter.prepareForAppShutdown()
→ 注销控制广播
→ Filter 至 Database 的逆序模块关闭
→ 释放运行锁
```

这样，停止开始后，`show`、`toggle`、`showUi()`、`Filter.showPanel()` 和 `Filter.showRoot()` 均不能重新附加窗口。

### 3.2 Filter 关闭契约

应用启动后为现有 Filter 内联安装：

```javascript
ClipHub.Filter.prepareForAppShutdown(reason)
```

该接口先调用现有 `closePanel()`，从而复用 Filter 已有的 render/refresh generation 失效和幂等 detach 链。阶段 1 及后续分页实现可在此契约中先取消 `Future`、关闭 Executor 并等待退出，再进入原关闭流程。

### 3.3 状态字段

`ClipHub.App.getStatus()` / `uiStatus()` 增加：

```text
stopping
lifecycleGeneration
lastStopReason
filterPreparedForShutdown
filterStopping
filterGuardInstalled
rapidCloseGuardInline
```

用于设备端验证是否发生停止期间重入。

## 4. 探针入口

文件：

```text
ClipHub_分页工作线程探针.txt
```

运行前必须先完全停止其他 ClipHub 实例。探针使用独立运行目录：

```text
ClipHubPaginationStage0Probe
```

并固定从以下分支同步：

```text
agent/add-pagination-lazy-prefetch-20260807
```

## 5. 探针执行内容

### 5.1 工作线程能力

- 主线程读取最多 `101` 条基线记录 ID。
- 单线程 Executor 连续执行 `50` 次相同查询。
- 每轮同时执行：
  - `Repository.listItems()`
  - `Repository.countItems(false)`
  - `Repository.listItemTagMap()`
- 比较每轮 ID 数量和顺序。
- 检查是否出现 `No Context associated with current Thread`。

### 5.2 快速关闭

连续执行 `20` 轮：

```text
show → hide
```

检查：

- 每轮命令成功。
- 隐藏后 `uiVisible=false`。
- 生命周期 generation 不倒退。
- 无窗口迟到重新附加。

### 5.3 完全停止竞态

- 工作线程循环查询期间触发 `App.stop()`。
- 探针临时接入 `Filter.prepareForAppShutdown()`。
- 关闭契约先发出停止信号、取消 Future、`shutdownNow()` 并等待 Executor 退出。
- Executor 退出后，才继续 Filter 和 Database 关闭。
- 最终检查无 UI 残留、无 Rhino Context 错误、无数据库关闭后访问。

## 6. 结果判定

通过：

```json
{
  "ok": true,
  "executorSupported": true,
  "fallbackRequired": false,
  "nextStage": "repository_pagination_foundation"
}
```

失败或 Rhino 工作线程不安全：

```json
{
  "ok": false,
  "fallbackRequired": true,
  "nextStage": "handler_idle_scheduler_fallback"
}
```

失败不取消分页功能。后续阶段切换为主线程 `Handler.post()` / `postDelayed()` 空闲分段方案。

## 7. 阶段 0 验收门

只有设备返回同时满足以下条件，才进入阶段 1：

- `worker.completed = 50`
- `worker.orderMismatchCount = 0`
- `worker.countQueryCount = 50`
- `worker.tagQueryCount = 50`
- `rapidClose.completed = 20`
- `rapidClose.attachedAfterHideCount = 0`
- `stopRace.shutdownHookCalled = true`
- `stopRace.executorTerminated = true`
- `stopRace.ok = true`
- 无 Rhino Context 错误
- 无数据库关闭后访问
- 无 WindowManager 残留

设备端真实结果以 ShortX 返回 JSON 为准；仓库提交仅能完成静态实现和测试入口，不能替代 Android 14 / ShortX 运行时验证。
