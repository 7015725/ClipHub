# ShortX UI Navigation Contract v2

适用范围：ClipHub / ShortX Rhino ES5 单窗口嵌入式 UI。本文是 Navigation Contract v2 的最终可复用规范；普通新页面接入不得修改导航核心。

## 1. 唯一 Owner 与 SSOT

| 能力 | 唯一 Owner | 规则 |
|---|---|---|
| 页面定义 | `ClipHub.PageRegistry` | 页面 ID、parent、family、factory、PageContract、生命周期 hooks 均在 Registry 声明 |
| 页面栈 | `ClipHub.PageStack` | 唯一页面历史状态；业务页面不得维护第二套导航栈 |
| 导航动作 | `ClipHub.Navigator` | `push/pop/replace/current/canPop/popTo/reset` 是业务导航唯一入口 |
| Back 决策 | `ClipHub.BackDispatcher` | Toolbar/Page/System/Legacy/Predictive 最终进入同一 Back 状态机 |
| Android Back 捕获 | `ClipHub.Navigation` | 仅负责 Window/Key/OnBackInvoked/OnBackAnimation 接入，不拥有业务页面语义 |
| 页面承载 | `ClipHub.UIShell` + Primary Window | 单窗口 host、页面 mount/unmount 与兼容桥 |

原则：一个事实一个 SSOT，一个能力一个 Owner。页面不得自行注册 Android Back Callback。

## 2. PageStack

最低 API：`push`、`pop`、`replace`、`current`、`canPop`、`size`、`popTo`、`popToRoot`、`resetRoot`、`snapshot`。

不变量：

- 根页面始终位于栈底；
- 非根页面必须满足 Registry 声明的 `parentId` 或 `alternateParentIds`；
- Back commit 最多只减少一层，除非显式 `popTo/popToRoot`；
- start/progress/cancel 类型的手势阶段不得提前写 PageStack；
- 页面关闭、Toolbar Back、System Back 不得各自维护独立历史。

## 3. Navigator

普通业务代码只使用 `ClipHub.Navigator`。新增普通页面的标准接入流程：

```js
ClipHub.PageRegistry.register({
    id: "example_page",
    parentId: "home",
    owner: "example",
    family: "example",
    moduleName: "ExamplePage",
    cachePolicy: "rebind",
    shellReady: true,
    factory: createExamplePage,
    contract: {
        canPop: true,
        systemBack: true,
        swipeBack: true,
        predictiveBack: true,
        imeBackFirst: true,
        host: "primary"
    }
});

ClipHub.Navigator.push("example_page", {}, "open_example");
```

若普通页面需要修改 `PageStack`、`Navigator`、`BackDispatcher` 或 Android Back 捕获核心才能接入，则视为架构回归。

## 4. PageContract

默认合同：

- `allowDuplicate=false`
- `canPop=true`
- `systemBack=true`
- `swipeBack=true`
- `predictiveBack=true`
- `imeBackFirst=true`
- `host="primary"`
- `rootBehavior="none"`

根页面可通过 `rootBehavior="close_host"` 定义 Back 关闭宿主。特殊页面只能通过 Contract/Registry 元数据声明差异，不得在 Navigator/BackDispatcher 中新增 Page ID 分支。

## 5. BackDispatcher 顺序

一次 Back 请求只允许一个状态机处理：

1. Contract 判断该输入族是否允许；
2. `requestId` / in-progress 去重；
3. 若 `imeBackFirst=true` 且 IME 可见，只收起 IME 并消费本次 Back；
4. 调用当前页面 `onBack` hook；
5. hook 若仅表达旧式导航意图，由兼容桥转换成 Navigator 动作；
6. 页面未消费且 `Navigator.canPop()` 时执行一次 `Navigator.pop()`；
7. 根页面执行 `rootBehavior`；
8. 记录 before/after depth，禁止同一次请求多层级联 pop。

Legacy `KEYCODE_BACK`、`OnBackInvokedCallback`、Toolbar/Page Back 最终必须进入同一状态机。

## 6. Predictive Back 事务

`ClipHub.BackDispatcher` API v2 提供：

- `beginPredictive(request)`
- `progressPredictive(progress, request)`
- `cancelPredictive(request)`
- `commitPredictive(reason, request)`

### start

冻结以下只读导航快照：

- `currentPageId`
- `previousPageId`
- `pageIds`
- `depth`
- `generation`

此阶段不修改 PageStack。

### progress

只更新手势进度/视觉，并验证冻结快照仍与 PageStack 一致；不得执行 pop。

### cancel

清除 predictive session，并验证 PageStack 与 start 快照一致。由于 start/progress 从不修改 PageStack，稳定 cancel 不需要反向写栈；视觉恢复由 Android Navigation 层 `resetVisual()` 完成。

### commit

只有 commit 才进入 `BackDispatcher.dispatch()` 并最多 pop 一层。同一个 `requestId` 的重复 commit 必须被消费，但不得再次 pop。

若运行时检测到 start 后 PageStack 被其他路径改变，计入 `predictiveBackSnapshotMismatchCount` 并拒绝错误 commit，而不是猜测性修复页面栈。

## 7. IME First Back

IME 优先级是通用能力，不属于 Editor 私有逻辑。合同为 `imeBackFirst=true` 时：

- 第一次 Back：IME 可见，只隐藏 IME；
- 焦点交还 Primary Window Root；
- 刷新 Android Back 捕获；
- 页面栈不变；
- 第二次 Back：正常进入页面 Back / `Navigator.pop()`。

焦点交接与 Android Back callback 注册是两件事，不得把 `requestFocus()` 当成 callback 注册成功的证据。

## 8. LegacyNavigationAdapter 边界

`src/ch_12_translation.js` 仍保留 ShortX 历史窗口标题、旧模块 open/close wrapper、Legacy Key Back 等兼容适配。该区域允许识别既有页面/窗口名称，但它不是 Navigation Core。

边界要求：

- 不得把新的业务页面 ID 加入 Android Back 核心决策；
- 新页面只能走 Registry/Contract/Navigator；
- Stage 8 audit 冻结既有兼容硬编码数量，并对 PageStack/Navigator/BackDispatcher 核心函数执行零业务 Page ID 检查；
- 后续可以渐进删除 Legacy Adapter，但不得把兼容逻辑反向扩散回 Core。

## 9. CI 与真机验收

CI 最低要求：

- Rhino/Node 语法检查；
- Stage 2–10 Navigation tests；
- Predictive snapshot/commit contract；
- System Back gesture/request dedupe；
- IME Back rearm；
- Primary Window system/legacy Back；
- Stage 8 hardcoding audit；
- manifest contract；
- release preflight。

真机最低矩阵：Editor、Tags、Tokenizer、Tokenizer Rules、Settings/Regex、Translation、Detail、Root Back，并验证顶部返回与系统 Back 语义一致。

若宿主应用关闭 `OnBackInvokedCallback`，Predictive API 路径无法由设备实际触发，此时必须保留 Legacy `KEYCODE_BACK` 路径并以运行时能力诊断明确标记；静态/模拟测试不得写成“真机 Predictive 已通过”。

## 10. 新页面零修改导航核心验收

`probes/navigation_architecture_test_page.js` 是参考页：仅调用 `PageRegistry.register()` + `Navigator.push()`，并通过 factory/hooks/contract 描述行为。新增同类页面时，导航核心源码 diff 应为零。
