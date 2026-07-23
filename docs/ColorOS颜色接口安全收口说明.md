# ColorOS 颜色接口安全收口说明

## 目标

ClipHub 运行在 ShortX / Rhino ES5 / `system_server` 环境。为避免部分 ColorOS 设备因 Rhino 数值重载误分派而触发 `system_server` 软重启，正式 UI 模块不得把 JavaScript 数字颜色直接传给 Android 颜色重载。

## 审计基线

`python scripts/audit_color_api.py --show-safe` 的初始结果：

```text
HIGH=35
WARN=0
SAFE=0
```

风险分布在：

- `src/ch_08_window.js`
- `src/ch_09_list.js`
- `src/ch_10_editor.js`
- `src/ch_11_filter.js`
- `src/ch_12_translation.js`
- `src/ch_13_settings.js`

高风险调用包括：

- `TextView.setTextColor(int)`
- `EditText.setHintTextColor(int)`
- `GradientDrawable.setColor(int)`
- `GradientDrawable.setStroke(int, int)`
- `View.setBackgroundColor(int)`

## 实现策略

在 `src/ch_07_theme.js` 建立唯一颜色安全桥：

- `safeColorStateList(color)`：通过 Java `int[]` / `int[][]` 显式构造 `ColorStateList`；
- `setTextColor(view, color)`：调用 `setTextColor(ColorStateList)`；
- `setHintTextColor(view, color)`：调用 `setHintTextColor(ColorStateList)`；
- `setLinkTextColor(view, color)`：调用 `setLinkTextColor(ColorStateList)`；
- `setGradientColor(drawable, color)`：调用 `GradientDrawable.setColor(ColorStateList)`；
- `setGradientStroke(drawable, width, color)`：调用 `GradientDrawable.setStroke(int, ColorStateList)`；
- `setBackgroundColor(view, color)`：创建安全 `GradientDrawable` 后调用 `View.setBackground(Drawable)`；
- `setTintColor(drawable, color)`：调用 `setTintList(ColorStateList)`；
- `setPaintColor(paint, color)`：调用 `Paint.setARGB(...)`。

本轮不创建 `RippleDrawable`，继续保留现有普通 Drawable 和 alpha/scale 交互，降低 ROM 差异风险。

## 修改边界

- 不改变调色板值；
- 不改变亮色、暗色主题逻辑；
- 不改变 View 层级、尺寸、圆角、边距和点击行为；
- 不改变数据库、剪贴板监听、过滤、编辑或翻译业务逻辑；
- 只替换颜色调用路径并提升相关模块版本。

## 发布门禁

执行：

```sh
python scripts/audit_color_api.py --strict
```

正式代码必须满足：

```text
HIGH=0
```

以后新增 UI 颜色调用也必须统一经过 `ClipHub.Theme` 安全桥。
