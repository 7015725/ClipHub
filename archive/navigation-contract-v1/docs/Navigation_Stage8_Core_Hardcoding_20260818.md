# Navigation Stage 8｜导航核心业务 Page ID 清理

本阶段把 `isSameShellFamily()`、`canEmbed()`、`unmountPage()`、root-child 判断和 runtime family 判断改为 PageRegistry / PageContract 数据驱动。

核心规则：根页面可进入任意 contract.host=primary 的注册页面；非根页面只允许同 family 内嵌导航；unmount 兼容调用只比较 Registry family；mount 只比较动态 rootPageId。

`installDefaultPages()` 仍包含产品页面注册数据，这是 Registry 数据，不属于导航算法的业务 if/switch。`ClipHub.Navigation` 中 standalone legacy window owner/close fallback 仍保留为兼容桥；新的 Primary Host 普通页面不需要修改该 fallback。
