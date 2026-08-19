# Navigation Stage 4｜BackDispatcher 收口｜2026-08-18

## Owner

`ClipHub.BackDispatcher` 成为页面 Back 状态机入口。Android Legacy Back、Predictive Back 当前仍由 `ClipHub.Navigation` 捕获，再通过兼容的 `UIShell.dispatchBack()` 进入 BackDispatcher；UIShell 不再拥有独立的返回算法。

## 顺序

1. 请求去重 / 导航忙保护；
2. 当前页面 Back hook；
3. hook 若只消费事件则停止；
4. 兼容期若旧 hook 已修改导航状态，识别为 `legacy_hook_navigation`，禁止第二次 pop；
5. 未消费且 `Navigator.canPop()` 时，最终只调用一次 `Navigator.pop()`；
6. 根页面返回 `root_unhandled`，由现有 Window/Home 行为继续处理。

## Predictive Back

`start/progress/cancel` 不进入 PageStack mutation；只有 `onBackInvoked` 才进入统一 BackDispatcher。当前 ShortX 真机 capability=false，实际仍使用已通过 Probe064 的 `legacy_key` 路径。

## 兼容边界

现有页面 `onBack/requestExit` 仍可能自行关闭页面并同步栈。Stage 4 通过 `legacy_hook_navigation` 检测避免 double-pop；Stage 6-8 迁移 PageContract 后，这类 hook 将只允许 consume/continue，不再修改 PageStack。
