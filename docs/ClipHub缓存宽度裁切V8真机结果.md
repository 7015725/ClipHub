# ClipHub 缓存宽度裁切 V8 真机结果

## 测试环境

- Android 14
- ShortX / Rhino ES5
- 分支：`agent/optimize-cliphub-window-startup-v1-20260805`
- 测试入口：`existing_module_cached_width`
- 入口版本：8
- 模块集版本：`20260806.04`
- 模块文件数：16
- 新增模块：否

## 启动结果

V8 启动返回：

- `ok=true`
- `started=true`
- `entryVersion=8`
- `moduleSetVersion=20260806.04`
- `sourceRef=agent/optimize-cliphub-window-startup-v1-20260805`
- `moduleFileCount=16`
- `newModuleAdded=false`
- `cachedWidthRebuildExpected=true`
- `filterModuleVersionExpected=39`
- `fallback=false`
- `transport=raw`

`updated=false`、`downloadedCount=0` 表示本地已存在同一份经过校验的 `20260806.04` 模块集，不代表退回旧版本。

## 视频验证

真机视频持续约 11 秒，覆盖：

1. 显示 ClipHub 浮窗。
2. 在不同窗口宽度之间调整。
3. 缩窄窗口。
4. 隐藏浮窗。
5. 再次显示。

视频中以下控件在较宽和较窄尺寸下均完整显示：

- 顶部新增按钮。
- 设置按钮。
- 关闭按钮。
- 搜索按钮。
- 筛选按钮。
- 每张卡片右侧编辑、翻译、复制、删除四个按钮。

未再出现此前顶部关闭按钮和卡片右侧操作区被窗口内部边界裁切的问题。

## 结论

V8 缓存宽度重建方案真机验证通过。

- 保持 16 个现有模块，没有新增第 17 模块。
- 缓存窗口在宽度变化后可按当前宽度重新计算并构建布局。
- 放宽、缩窄、隐藏和重新显示后均未复现裁切。
- 快速关闭防护仍由现有第 16 模块提供。

在正式折叠进现有 `ch_11_filter.js` 前，还需完成窄宽度下的搜索与 IME、高级筛选、卡片操作以及编辑/翻译页面回归。
