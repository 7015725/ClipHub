# ShortX UI Navigation Contract v1

## 目标

固定 ShortX / Rhino ES5 单窗口多页面项目的返回交互。页面只声明“收到 Back 后做什么”；系统 Back 来源、运行时能力探测、IME 焦点交接、页面栈和统一分发由 Navigation + UIShell Owner 负责。

## Owner

- `Navigation`：系统 Back 唯一 Owner。负责 Predictive Back capability、Legacy `KEYCODE_BACK`、窗口根注册、焦点根解析、统一 `dispatchBack()`。
- `UIShell`：页面栈唯一 Owner。负责 `pageStack`、`activePageId`、`mountPage()`、`dispatchBack()`。
- Page：只拥有页面内部状态与 `requestExit(reason)`；禁止直接注册 Android Back callback。

## 固定返回链

```text
System side-swipe / KEYCODE_BACK / header back
                    |
                    v
              Navigation
                    |
                    v
               UIShell
                    |
                    v
           active Page.onBack()
                    |
                    v
            Page.requestExit()
```

## Capability SSOT

不得用 `SDK_INT >= 33/34` 直接推断 Predictive Back 可用。初始化时必须运行时检测：

1. 优先 `WindowOnBackInvokedDispatcher.isOnBackInvokedCallbackEnabled(context)`；
2. 退化到 `ApplicationInfo.isOnBackInvokedCallbackEnabled()`；
3. 检测失败或返回 false 时进入 `legacy_key`；
4. 两种输入最后都必须进入同一个 `Navigation.dispatchBack()`。

当前 ClipHub 真机事实：系统 Predictive Back 总开关开启，但 ShortX 脚本 Context=`android` 且 callback capability=false，因此必须走 `legacy_key`。

## 页面合同

页面挂载：

```javascript
ClipHub.UIShell.mountPage(PAGE_ID, pageRoot, {
    title: PAGE_TITLE,
    showBack: true,
    onBack: function () {
        return requestExit("navigation_back");
    },
    onClose: function () {
        return requestExit("navigation_close");
    }
});
```

页面禁止：

- 直接创建 `OnBackInvokedCallback` / `OnBackAnimationCallback`；
- 自己维护系统 Back 去重；
- 绕过 UIShell 自建 page stack；
- 将 EditText focus 当成 Window Back focus；
- 为解决返回问题新增第二个透明 Window。

## IME / Focus 合同

输入页在 IME 隐藏后：

```text
EditText.clearFocus()
        |
        v
Navigation.resolveBackFocusRoot(pageRoot, windowRoot, fallbackRoot)
        |
        v
实际 Primary Window Root.requestFocus()
```

根解析固定优先级：

1. embedded page `pageRoot.getRootView()` 且已 attach；
2. standalone `windowRoot`；
3. `fallbackRoot`。

公共接口：

```javascript
ClipHub.Navigation.getBackCapability();
ClipHub.Navigation.resolveBackFocusRoot(pageRoot, windowRoot, fallbackRoot);
ClipHub.Navigation.handoffBackFocus({
    pageRoot: pageRoot,
    windowRoot: windowRoot,
    fallbackRoot: fallbackRoot,
    inputView: editText
});
ClipHub.Navigation.refreshSystemBackCapture(reason);
```

## Page.requestExit 优先级

1. IME 可见：系统第一次 Back 只允许 IME 消费；
2. 临时层 / Dialog / Drawer / 搜索层；
3. 未保存确认；
4. 页面自身子状态回退；
5. 当前页面退出；
6. UIShell 回到上一页；
7. 首页 Back 才关闭整个浮窗。

## 新页面接入清单

- 在 UIShell 注册 page descriptor；
- 使用 `mountPage()`，只提供 `onBack/onClose`；
- 页面实现唯一 `requestExit(reason)`；
- 含输入框时使用 Navigation 的 focus-root contract；
- 不新增任何 Android Back callback；
- 通过统一测试矩阵后才合入。

## 必测矩阵

| 场景 | 预期 |
|---|---|
| 首页 -> 页面 -> 侧滑 | 回到上一页 |
| 页面 + IME | 第一次收 IME，第二次退页 |
| dirty editor | Back 显示未保存确认 |
| 顶部返回 | 与系统 Back 相同业务路径 |
| tags / tokenizer 子页 | 严格按 pageStack 回退 |
| Predictive capability=false | `legacy_key` |
| capability=true | Predictive callback -> 同一 dispatch |
| 首页 Back | 关闭浮窗，不残留 Window |

## 回归边界

Navigation 不拥有编辑、设置、分词、翻译业务；UIShell 不直接处理业务保存；页面不拥有系统 Back。一个能力一个 Owner，一个页面栈一个 SSOT。
