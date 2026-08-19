# Navigation Stage 6｜PageRegistry

`ClipHub.PageRegistry` 正式成为页面定义 Owner，并直接复用原 `pages` 对象，不创建第二套 Registry。Registry 当前管理 pageId、parent/alternateParent、owner、family、moduleName、factory、metadata、cachePolicy、legacySurface、shellReady。现有产品页面继续由 `installDefaultPages()` 注册；未来页面可在自己的模块中调用 `PageRegistry.register()`，无需进入 Registry 核心增加分支。
