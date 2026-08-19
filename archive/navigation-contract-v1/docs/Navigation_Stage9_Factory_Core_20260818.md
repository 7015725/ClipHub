# Navigation Stage 9 准备｜通用 factory / lifecycle

Navigator 对 `PageRegistry` 中带 factory 的页面提供通用创建、Primary Host 挂载、IME Contract、Back、离场与生命周期 hook。旧产品页面 factory 为空，继续走 legacy 兼容路径，因此本阶段不改变现有页面创建行为。

支持 hook：onBeforeEnter、onEnter、onBeforeLeave、onLeave、onBack、onClose。hook 扩展页面行为，但 PageStack mutation 仍只能由 Navigator 执行。下一提交将只新增 `NavigationArchitectureTestPage` 页面文件与注册/调用代码，不修改导航核心。
