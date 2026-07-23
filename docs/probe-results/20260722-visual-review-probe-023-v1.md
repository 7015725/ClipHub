# ClipHub 视觉截图人工复核 023 v1 记录

## 自动结果

```text
ok=false
probeVersion=1
moduleSetVersion=20260722.19
sceneCount=9
allScenesReady=false
error=null
formalRestart.ok=true
cleanup=true
```

未通过的自动场景：

```text
darkWideList.ready=false
undoBar.ready=false
```

## 原因定位

### 1. 场景标题清空了主列表

023 v1 使用 `ClipHub.Window.setStatusText()` 显示场景名称。Window 模块的该接口会调用 `showStatusOnMain()`，先执行 `contentView.removeAllViews()`，因此会把 List 已安装的自定义内容清空。

结果是 1/9 和 2/9 截图只显示 ClipHub 标题、场景名称和空白内容区，不能用于列表视觉判断。

### 2. 隔离实例仍监听系统剪贴板

023 持续约 81 秒。隔离实例启动后 Clipboard 监听器仍处于运行状态，期间额外写入了两条系统剪贴板记录，筛选窗口显示“结果 7 条”。

因此：

- 暗色列表不再满足严格的 `renderedCount === 5`；
- 删除一条后不再满足严格的 `renderedCount === 4`；
- 标签、编辑、筛选和详情功能本身没有失败。

## 现场恢复

```text
firstStopped=true
firstDatabaseClosed=true
formalRestart.ok=true
cleanup=true
error=null
```

正式实例已恢复，隔离数据库和目录均已清理。

## 已获得截图的视觉结论

### 搜索与筛选

- 功能区结构清楚；
- 长来源名称芯片在右侧被截断，缺少明显的横向滚动提示；
- 面板使用固定高窗口，下半部分留白过大；
- 所有文字和按钮均使用较高字重，信息密度偏重。

### 新增编辑窗口

- 输入区边界清晰；
- 窗口高度明显大于当前内容需求；
- 输入框和底部保存按钮之间留白较多；
- 顶部“关闭”和底部“保存”逻辑清楚，但缺少显式“取消”按钮，需要确认是否统一以关闭代替取消。

### 标签管理窗口

- 长标签能够完整显示；
- 绑定与删除按钮没有横向溢出；
- 两条标签以下仍使用接近全高窗口，存在大量空白；
- 已绑定标签使用整行蓝色强调，视觉权重略高。

### 长文本详情窗口

- 正文、元数据和底部操作区层级清晰；
- 长文本滚动区域可读；
- 正文字号和字重偏大，长时间阅读密度较高；
- 主窗口外框与详情窗口内框形成双层边框，并同时存在外层关闭图标与内层关闭按钮，视觉层级偏重；
- 深色背景仍能看到后方编辑器文本，建议提高不透明度。

## v2 修正

023 v2：

- 不再调用 `Window.setStatusText()`；
- 使用短暂 Toast 提示场景序号；
- 隔离实例启动后立即执行 `Clipboard.stop()`；
- 新增 `clipboardListenerStopped=true` 通过条件；
- 列表场景额外验证 `Window.contentMode === "custom"`。

生产模块、数据库 schema 和 manifest 均未修改。
