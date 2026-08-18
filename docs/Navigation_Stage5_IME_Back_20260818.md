# Navigation Stage 5｜IME First-Back Priority

BackDispatcher 顺序固定为：IME -> Page hook -> Navigator.pop。

当前 Android/ShortX 真机上第一次系统侧滑仍可能由 IME 在 ClipHub 收到 Back 前直接消费；该路径保留 Probe064 已验证的 Editor visible-to-hidden + Primary Window Root focus handoff。对于 Toolbar、未来自定义手势或到达 BackDispatcher 时 IME 仍可见的情况，统一层只隐藏 IME并 consume，不允许同一次 Back 再 pop 页面。
