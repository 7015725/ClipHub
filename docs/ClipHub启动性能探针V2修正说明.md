# ClipHub 启动性能探针 V2 修正说明

## 本次结果结论

`cliphub_startup_performance_probe_001` 完成了 20 轮控制命令，但实际连接到的运行时为：

- `sourceRef`: `main`
- `moduleSetVersion`: `20260726.11`

性能优化分支要求：

- `sourceRef`: `agent/optimize-cliphub-window-startup-v1-20260805`
- `moduleSetVersion`: `20260805.03`

因此本次结果没有测试到窗口缓存、延迟刷新、分批渲染和性能埋点实现，不能用于评价优化效果。

## 探针 V1 的统计问题

V1 的 `numeric()` 直接执行 `Number(value)`。JavaScript 中 `Number(null)` 等于 `0`，导致不存在的性能指标在汇总中显示为 0 ms。

V2 已修正：

- `null`、`undefined` 和空字符串保持为缺失值；
- 汇总增加 `missingCount`；
- 缺少指标时输出 `null`，不再伪造 0 ms；
- 增加 `readyTimedOut`、`readyWaitMs` 和 `timedOutCount`。

## V2 前置校验

`probes/cliphub_startup_performance_probe_002.js` 在开始预热和 20 轮测试前检查：

1. `sourceRef` 必须为性能测试分支；
2. `moduleSetVersion` 必须为 `20260805.03`；
3. `startupPerformance` 状态接口必须存在。

任一条件不满足时：

- `failureStage` 返回 `runtime_preflight`；
- 不执行显示/隐藏循环；
- 不改变当前浮窗显示状态；
- 明确提示停止旧运行时并重新执行测试分支入口。

## 正确测试顺序

1. 停止当前 `main / 20260726.11` ClipHub 后台实例。
2. 将 ShortX 的 ClipHub 后台入口替换为测试分支中的 `ClipHub.js`。
3. 执行新的 ClipHub 后台入口。
4. 先确认入口返回：
   - `sourceRef=agent/optimize-cliphub-window-startup-v1-20260805`
   - `moduleSetVersion=20260805.03`
5. 再运行 `probes/cliphub_startup_performance_probe_002.js`。

## V2 通过标准

- `preflightPassed=true`
- `cyclesCompleted=20`
- `cacheReuseCount=20`
- `contentReadyCount=20`
- `firstDrawReadyCount=20`
- `timedOutCount=0`
- `ok=true`

性能结果重点查看：

- `summary.showToAttach`
- `summary.showToFirstDraw`
- `summary.showToFirstBatch`
- `summary.showToFullRender`
- `summary.readyWait`
