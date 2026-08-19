# Navigation Stage 10｜旧页面 Back Hook 收口

现有 Editor/Settings/Translation/Detail 等页面的旧 `onBack/requestExit` 仍会调用 `UIShell.unmountPage()` 或 `syncEmbeddedPage()`。本阶段不要求业务模块一次性重写，而是在 BackDispatcher hook transaction 中把这些旧调用转换为“导航意图”：宿主/业务清理可以继续执行，但 PageStack mutation 被延迟，最终只由 `Navigator.pop/popTo/popToRoot` 提交。

因此旧页面 hook 不再直接拥有 PageStack。若 hook 绕过兼容 API 直接改变 generation/stack，会记录 `unexpected_hook_navigation`，作为回归异常。Home 的 Registry hook 继续把 Filter 内部临时层交给 `Filter.handleBack()` 优先消费；无临时层时再执行 PageContract `rootBehavior=close_host`。
