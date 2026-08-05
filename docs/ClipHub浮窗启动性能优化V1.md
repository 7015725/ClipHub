# ClipHub 浮窗启动性能优化 V1

## 分支

`agent/optimize-cliphub-window-startup-v1-20260805`

该分支的 `ClipHub.js` 已将模块更新源指向当前测试分支。测试完成并合并到 `main` 前，必须把 `DEFAULT_REF` 和 `module-manifest.json.sourceRef` 恢复为 `main`。

## 本次统一改动

1. 普通关闭只从 `WindowManager` 移除浮窗，保留已构建的 View 树。
2. 再次显示时复用窗口树并重新接入共享几何服务。
3. 数据没有变化时不重新查询和重建卡片。
4. 数据变化时先挂载窗口，再在下一轮主线程任务刷新内容。
5. 首批创建 6 张卡片，后续每批创建 4 张。
6. 来源应用和标签仅在高级筛选抽屉打开时查询，并进行缓存。
7. 隐藏期间的剪贴板事件只标记数据版本，不构建 UI。
8. 连续事件在 80ms 内合并为一次刷新。
9. 保留 `List.init()` 原有初始查询，避免改变 `status` 和外部 API 的初始化语义；暖启动优化不依赖该变更。
10. 输入法避让仅在搜索输入获得焦点时启动。
11. 增加窗口挂载、首次绘制、首批卡片和完整渲染耗时字段。
12. Window 模块在普通卸载时保留 prepared frame，确保缓存重挂载后仍使用 single-host，外部点击、遮罩和共享几何不会降级。
13. 刷新任务和键盘延迟任务增加代际校验，关闭后快速重开不会执行旧任务。

## 状态字段

通过现有 `status` 控制命令读取：

- `contentReady`
- `windowCacheBuilt`
- `windowCacheReused`
- `startupPerformance.showToAttachMs`
- `startupPerformance.showToFirstDrawMs`
- `startupPerformance.showToFirstBatchMs`
- `startupPerformance.showToFullRenderMs`
- `startupPerformance.renderBatchCount`

筛选模块的 `getPanelState()` 还会返回：

- `panelBuilt`
- `panelStructureDirty`
- `panelDataDirty`
- `panelDataVersion`
- `renderedDataVersion`
- `panelCacheReuseCount`
- `panelCacheBuildCount`
- `panelCacheDestroyCount`

## 性能探针

执行 `probes/cliphub_startup_performance_probe_001.js` 可自动完成 20 次暖启动显示/隐藏循环，统计：

- `showToAttachMs`
- `showToFirstDrawMs`
- `showToFirstBatchMs`
- `showToFullRenderMs`
- 缓存复用次数、内容就绪次数和首次绘制就绪次数

探针不会读取或输出剪贴板正文，并会恢复执行前的浮窗显示状态。结果写入运行目录的 `ClipHub/probes/`。

## 建议测试顺序

1. 完全停止旧 ClipHub 后台。
2. 使用本分支 `ClipHub.js` 启动后台。
3. 第一次显示浮窗，确认窗口先出现，随后卡片分批补齐。
4. 关闭后立即再次显示，确认 `windowCacheReused=true`。
5. 关闭浮窗，连续复制多条内容，再次显示并确认结果更新。
6. 测试搜索、筛选、编辑、翻译、删除撤销、系统返回、外部点击、拖动、缩放和 IME 避让。
7. 连续显示/关闭至少 50 次，确认没有重复窗口、残留遮罩或全屏不可点击。

## 验收参考

- `showToAttachMs` 中位数不超过 120ms。
- `showToFirstBatchMs` 中位数不超过 250ms。
- `showToFullRenderMs` 中位数不超过 600ms。
- 若设备负载导致绝对值未达到，暖启动首次绘制至少下降 50%。

## 回退机制

如果缓存窗口的 root mode 变化或重新挂载失败，模块会销毁缓存并在下一次显示时重新创建，不会无限重试。ClipHub 完全停止时会强制销毁窗口缓存。

## 真机暖启动结果

运行时：

- `sourceRef=agent/optimize-cliphub-window-startup-v1-20260805`
- `moduleSetVersion=20260805.03`
- 20 次暖启动循环全部完成

结果：

- 窗口缓存复用：20/20
- 内容就绪：20/20
- 首帧记录：20/20
- 窗口挂载中位数：28.668ms
- 窗口挂载 P95：33.435ms
- 首帧中位数：53.988ms
- 首帧 P95：59.344ms
- 最大首帧：60.837ms

结论：无数据变化的暖启动通过。

## 隐藏期间数据变化测试 003

首次执行 `cliphub_dirty_refresh_probe_003` 时：

- 前置校验通过。
- 剪贴板变化检测成功。
- 内容刷新完成，无超时。
- 分批渲染次数为 5，符合 `6 + 4 + 4 + 4 + 2`。
- 窗口挂载：58.806ms。
- 首帧：90.032ms。
- 首批卡片：252.534ms。
- 完整 20 条：828.526ms。

该次返回 `windowCacheReused=false`，导致探针提前停止，快速开关测试未执行。

探针 003 在等待复制前只调用了 `hide`，没有先建立并确认窗口缓存，因此无法区分正常首次构建和缓存异常丢失。该结果证明脏数据检测、数据刷新和 5 批渲染链路正常，但不能用于判定缓存复用失败。

## 隐藏期间数据变化测试 004

新增 `probes/cliphub_dirty_refresh_probe_004.js`：

1. 第一次显示，建立窗口缓存并等待内容完成。
2. 隐藏后再次显示，确认 `windowCacheReused=true`。
3. 再次隐藏并等待用户复制新文本。
4. 在已确认缓存存在的条件下验证脏数据分批刷新。
5. 执行 10 组连续 show/hide 广播，检查旧刷新任务是否使窗口重新出现。
6. 最后重新显示，确认缓存、内容和首帧仍正常。
7. 输出 `failureStage`，区分预热、缓存确认、脏刷新、快速开关和最终显示阶段。
