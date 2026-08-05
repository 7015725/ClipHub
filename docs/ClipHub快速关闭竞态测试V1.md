# ClipHub 快速关闭竞态测试 V1

## 背景

启动性能优化分支在真机探针 004 中通过了缓存预热、缓存复用和隐藏期间脏数据刷新，但连续执行“显示后立即隐藏”时出现窗口残留：第 1 组隐藏成功，第 2–10 组在隐藏确认时仍报告浮窗可见。

## 已验证的数据

- 缓存确认：窗口挂载 27.298ms，首次绘制 55.922ms。
- 脏数据刷新：窗口挂载 17.887ms，首次绘制 37.378ms。
- 20 条记录按 6 + 4 + 4 + 4 + 2 完成 5 批渲染。
- 脏刷新首批内容 243.991ms，完整渲染 649.248ms。
- 失败阶段仅为 `rapid_show_hide`。

## 根因

`WindowManager.addView()` 返回后，窗口已经进入 WindowManager 的添加流程，但 `View.isAttachedToWindow()` 可能仍短暂为 `false`。原关闭逻辑在这个状态下跳过 `removeViewImmediate()`，随后添加流程完成，导致窗口重新表现为可见。

## 测试修复结构

为了不直接改动已经通过其他回归的筛选模块，测试版本使用独立加载期防护模块：

- `src/ch_16_rapid_close_fix.js`
- 仅在导出的 `Filter.closePanel()` 或 `Filter.shutdown()` 执行期间启用防护。
- 防护期间，`Window.detachWindow()` 在解除绑定前向 WindowManager 提交一次立即移除。
- 正常显示和 `Window.attachWindow()` 阶段不启用防护，不影响窗口挂载、共享几何、拖动和缩放。
- 已经被移除且确实未附着的 View 作为幂等关闭处理；仍处于附着状态的移除异常继续抛出，不静默隐藏真实故障。

## 独立测试入口

执行 `ClipHub_RapidClose_Test_Entry.js`。该入口从启动性能分支读取标准入口，并仅在内存中完成三项转换：

1. 测试入口版本调整为 6。
2. 使用 `module-manifest-rapid-close.json`。
3. 在现有 15 个模块后加载 `ch_16_rapid_close_fix.js`。

标准 `ClipHub.js` 和标准 `module-manifest.json` 保持不变，测试失败时可直接恢复原运行方式。

## 回归探针

执行 `probes/cliphub_rapid_close_race_probe_005.js`：

- 预热并确认内容就绪。
- 自动执行 20 组显示后立即隐藏。
- 每组等待隐藏状态稳定，记录立即隐藏与稳定隐藏结果。
- 检查最终没有浮窗残留。
- 再次显示并确认缓存仍可复用、内容仍可就绪。
- 恢复探针执行前的浮窗可见状态。

## 通过标准

- `moduleSetVersion=20260806.01`
- `rapidPairsCompleted=20`
- `settledHiddenCount=20`
- `rapidRacePassed=true`
- `finalHidden.hidden=true`
- `finalShow.windowCacheReused=true`
- `finalShow.contentReady=true`
- `restoredInitialVisibility=true`

## 后续

真机通过后，将防护逻辑折叠进正式关闭链，并重新执行暖启动、脏数据刷新、系统返回、外部点击、拖动、缩放和 IME 回归，再准备合并到 `main`。
