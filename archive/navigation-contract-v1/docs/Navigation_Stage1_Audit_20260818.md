# Navigation Stage 1 审查记录｜2026-08-18

基线：`moduleSetVersion=20260818.02`，真机 Probe064=`LEGACY_BACK_SUCCEEDED`。

## 当前 Owner

- 页面定义：`ch_16_ui_shell.js / pages + registerPage()`。
- 页面栈：`ch_16_ui_shell.js / stack`。
- 页面宿主：`UIShell + Filter.mountPrimaryChildPage()`。
- Android Back：`ClipHub.Navigation`。
- 页面 Back：`UIShell.dispatchBack()` -> active page hook。
- IME Back：当前 Editor 已真机验证，公共 focus helper 位于 `ClipHub.Navigation`。

## Stage 1 发现

1. `stack` 已存在，但此前允许 `setStackPath/pushPage/popPage/unmountPage/init` 分别直接改写。
2. `UIShell` 同时承担 Registry、Stack、Host、Back 路由，职责重叠。
3. `isSameShellFamily/canEmbed/unmountPage/runtime diagnostics` 仍包含业务 pageId 硬编码。
4. `activePageId` 与 `stack.current` 同时存在；Stage 6-8 需进一步收口。
5. Navigation 仍有业务 module wrapper；Stage 8 清理。
6. Page Contract 尚未建立；Stage 7 实施。

## Stage 2-3 本轮边界

本轮只收口 PageStack 与 NavigationManager API，不改变既有页面创建方式、UIShell Host、业务退出逻辑、Back Owner、IME 行为。

新增 SSOT API：

- `ClipHub.PageStack`: `push/pop/replace/current/canPop/size/popTo/popToRoot/resetRoot/snapshot`
- `ClipHub.Navigator`: `push/pop/replace/current/canPop/stackSize/popTo/popToRoot/reset`

旧 `UIShell.enterRoot/pushPage/popPage/clearToRoot` 保留为兼容适配层，但不再直接修改 stack。

## 后续必须处理

- Stage 4：BackDispatcher 最终只调用 Navigator。
- Stage 5：IME Back 进入页面 Contract。
- Stage 6-7：PageRegistry + DEFAULT_PAGE_CONTRACT。
- Stage 8：删除业务 pageId 硬编码。
- Stage 9：NavigationArchitectureTestPage 零核心修改测试。
- Stage 10：完整回归 + Probe064 真机复验。
