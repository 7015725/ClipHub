# Navigation Stage 7｜PageContract

`DEFAULT_PAGE_CONTRACT`：`allowDuplicate=false`、`canPop=true`、`systemBack=true`、`swipeBack=true`、`predictiveBack=true`、`imeBackFirst=true`、`host=primary`、`rootBehavior=none`。

页面只覆盖差异。Home 覆盖为不可 pop、不可 swipe/predictive、无 IME-first，rootBehavior=`close_host`。BackDispatcher 与 Navigator 从 Registry 读取 Contract，不再由 mount 参数决定 IME 优先级。
