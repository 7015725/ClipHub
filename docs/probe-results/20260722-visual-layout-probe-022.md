# ClipHub 统一视觉与自适应布局探测 022 结果

## 结论

探测 022 v2 全部通过。

```text
ok=true
probeVersion=2
moduleSetVersion=20260722.19
durationMs=1377
error=null
```

## 环境

```text
Android orientation=portrait
widthPixels=1264
heightPixels=2640
density=3.075000047683716
densityDpi=492
schemaVersion=2
```

## 亮色窄窗口

请求尺寸：

```text
280dp × 360dp
```

验证通过：

- 主窗口位于安全区内；
- 实际宽高未超过安全区；
- 五条记录全部渲染；
- 新增、筛选、编辑、置顶、标签、详情与排序控件存在；
- 标签摘要和敏感正文遮罩存在；
- 搜索与筛选窗口可聚焦并可关闭；
- 新增编辑窗口可聚焦并可关闭；
- 标签管理窗口可聚焦并可关闭；
- 长文本详情可滚动、可选择并可关闭；
- 所有 UI 操作在主线程完成；
- 次级窗口全部清理。

## 暗色宽窗口

请求尺寸：

```text
420dp × 620dp
```

执行与亮色相同的完整链路，全部通过。窗口超出当前安全宽度时由 Window 模块完成夹紧。

## 重启与资源边界

```text
recordsPersistedAfterRestart=true
themePersistedAfterRestart=true
secondaryWindowsClosedAfterRestart=true
mainWindowClosedAfterRestart=true
firstDatabaseClosed=true
secondDatabaseClosed=true
formalRestart.ok=true
cleanup=true
```

正式实例已恢复，隔离目录已删除。

## 自动探测限制

022 只能验证状态、尺寸、安全区、附着和资源生命周期。以下项目需要截图人工复核：

- 卡片和操作按钮是否拥挤；
- 字体、圆角、留白和层级是否统一；
- 长来源、长标签和时间元数据是否肉眼截断；
- 窄窗口按钮是否过密；
- 空状态、撤销条和筛选摘要是否协调；
- 亮色与暗色的实际对比度。

## 输出文件

```text
/data/system/shortx_OYdazjKnxMzhQykL/ClipHub/probes/
cliphub_visual_layout_probe_022_20260722-020152-792.json
```
