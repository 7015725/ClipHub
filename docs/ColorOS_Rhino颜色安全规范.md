# ClipHub ColorOS / Rhino 颜色安全规范

## 1. 目的

ClipHub 在 ShortX / Rhino ES5 环境中调用 Android Java API。部分 ColorOS 设备上，如果把 JavaScript 数字直接传给存在多个重载的颜色 API，Rhino 可能选择错误重载并导致严重异常，甚至影响 `system_server` 稳定性。

因此正式 UI 模块必须统一通过 `ClipHub.Theme` 颜色安全桥。

## 2. 禁止的直接路径

正式代码不得直接把 Rhino 数字传入存在风险的颜色重载，例如：

- `TextView.setTextColor(int)`；
- `EditText.setHintTextColor(int)`；
- `GradientDrawable.setColor(int)`；
- `GradientDrawable.setStroke(int, int)`；
- `View.setBackgroundColor(int)`；
- `ColorDrawable(int)`；
- `GradientDrawable.setColors(int[])`；
- `Canvas.drawColor(int)`；
- `Paint.setShadowLayer(..., int)`；
- `PaintDrawable(int)`。

禁止在安全桥失败后回退到上述数值重载。

## 3. 当前安全桥

颜色操作统一由 Theme 提供对象重载或显式 ARGB 路径，包括：

- `safeColorStateList(color)`；
- `setTextColor(view, color)`；
- `setHintTextColor(view, color)`；
- `setLinkTextColor(view, color)`；
- `setGradientColor(drawable, color)`；
- `setGradientStroke(drawable, width, color)`；
- `setBackgroundColor(view, color)`；
- `setTintColor(drawable, color)`；
- `setPaintColor(paint, color)`。

核心原则：优先传 Java 对象类型以固定重载；Paint 使用显式 `setARGB`。

## 4. 失败策略

- 安全桥失败时记录诊断；
- 不回退到不安全的 int 重载；
- UI 可以降级为无对应颜色效果，但不得用可能影响系统稳定性的路径“兜底”。

## 5. 修改边界

颜色安全改造不得顺带改变：

- 调色板值；
- View 层级；
- 页面尺寸和间距；
- SQLite；
- 剪贴板监听；
- 分词、过滤、翻译或导航语义。

## 6. 发布门禁

发布前至少执行：

```bash
python scripts/audit_color_api.py --release-strict
```

正式要求：

```text
HIGH=0
WARN=0
```

并通过：

```bash
bash scripts/release_preflight.sh --main
```

静态审计通过后仍需 Android / ColorOS / ShortX 真机操作主要 UI，确认无颜色桥 failure、无系统异常和无视觉回归。
