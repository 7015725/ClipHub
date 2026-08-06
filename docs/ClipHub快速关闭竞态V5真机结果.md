# ClipHub 快速关闭竞态 V5 真机结果

## 测试环境

- Android 14
- ShortX / Rhino ES5
- 分支：`agent/optimize-cliphub-window-startup-v1-20260805`
- 测试入口版本：6
- 模块集版本：`20260806.01`
- 测试模块数：16
- 探针：`cliphub_rapid_close_race_probe_005`

## 启动结果

独立测试入口成功下载并校验 16 个模块：

- `ok=true`
- `started=true`
- `updated=true`
- `downloadedCount=16`
- `fallback=false`
- `transport=raw`
- `moduleSetVersion=20260806.01`
- `sourceRef=agent/optimize-cliphub-window-startup-v1-20260805`

## 快速显示与隐藏结果

连续执行 20 组“显示后立即隐藏”测试：

- `rapidPairsRequested=20`
- `rapidPairsCompleted=20`
- `immediateHiddenCount=20`
- `settledHiddenCount=20`
- `maximumSettleMs=26`
- `rapidRacePassed=true`

每一组均满足：

- 显示命令返回 `shown`
- 隐藏命令返回 `hidden`
- 隐藏确认中的 `uiVisible=false`
- 隐藏确认中的 `filterAttached=false`
- 立即隐藏状态通过
- 稳定隐藏状态通过
- 无等待超时

## 最终状态

- 最终隐藏成功，无浮窗残留
- 最终重新显示成功
- `windowCacheBuilt=true`
- `windowCacheReused=true`
- `contentReady=true`
- `showToAttachMs=40.205`
- `showToFirstDrawMs=71.526`
- `showToFirstBatchMs=40.354`
- `showToFullRenderMs=40.354`
- 已恢复探针执行前的隐藏状态

## 结论

第 16 模块提供的关闭防护已修复探针 004 暴露的快速显示后立即隐藏竞态。20 组压力测试全部通过，未发现窗口延迟挂载后残留，缓存复用功能仍然正常。

在切换标准入口前，仍需使用同一 `20260806.01` 运行时回归以下项目：

1. 暖启动性能循环。
2. 隐藏期间剪贴板变化与脏数据刷新。
3. 系统侧滑返回和外部点击关闭。
4. 拖动、缩放和共享几何。
5. 搜索输入框与 IME 避让。
