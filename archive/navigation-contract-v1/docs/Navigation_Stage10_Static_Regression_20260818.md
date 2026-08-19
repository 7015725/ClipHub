# Navigation Stage 10｜静态回归候选

本阶段完成系统 Back source-family 透传与根页面统一 BackDispatcher：Predictive/Legacy/System 的来源由 Navigation 捕获后随 BackRequest 传入 BackDispatcher；Primary Host 的 Home Back 也进入同一个 BackDispatcher，不再在 Navigation 中单独走 Window Back 分支。Home 的 `rootBehavior=close_host` 由 BackDispatcher 执行。

Predictive Back 保持 start/progress/cancel 不修改 PageStack，仅 commit/onBackInvoked 进入统一 BackDispatcher。

静态门禁不能代替真机：最终仍需在 ShortX Android 14 上执行 Stage10 自动探测，复验 Editor IME 两段 Back，并验证 NavigationArchitectureTestPage 的 Registry + factory + IME + pop。
