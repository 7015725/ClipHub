# ClipHub 视觉截图人工复核 023 v2 结果

## 自动结果

```text
ok=false
probeVersion=2
moduleSetVersion=20260722.19
clipboardListenerStopped=true
error=null
```

九个场景中八个建立成功：

```text
lightNarrowList.ready=true
darkWideList.ready=true
filterPanel.ready=true
filterSummary.ready=false
filteredEmpty.ready=true
undoBar.ready=true
newEditor.ready=true
tagEditor.ready=true
longDetail.ready=true
```

正式实例、数据库和隔离目录均完整恢复：

```text
firstStopped=true
firstDatabaseClosed=true
formalRestart.ok=true
cleanup=true
```

## 未通过原因

场景 4 使用中文关键词 `长文本视觉` 过滤，但列表实际返回零条。隔离数据库中对应长文本记录明确存在，因此该结果不再视为视觉探测误差，而是中文关键词搜索边界。

此前 015/016 主要验证 ASCII 关键词，未覆盖中文关键词。

已新增 `cliphub_unicode_search_probe_024.js`，分别验证：

- 数据库中中文正文是否完整；
- 原始 SQLite `LIKE`；
- 带 `ESCAPE` 的 `LIKE`；
- SQLite `instr()`；
- Repository 中文关键词查询；
- Filter 中文关键词查询；
- ASCII 正文和来源查询对照。

## 视觉审查结论

### 主列表

- 亮色窄窗口未发生横向溢出；
- 操作按钮能完整显示，但操作区密度较高；
- 元数据会被大幅压缩，窄窗口中来源文本几乎不可读；
- 暗色宽窗口五条卡片完整显示；
- 背景透明度较高，后方编辑器正文仍明显可见；
- 卡片、按钮和正文整体字重偏重。

### 撤销条

- 撤销条结构紧凑，状态和操作清楚；
- 与下方卡片间距基本合理；
- 顶部标题、撤销条和第一张卡片之间的垂直层级可以进一步压缩。

### 搜索与筛选

- 来源长芯片在右侧被截断；
- 横向滚动没有明显提示；
- 下半部分空白较大；
- 结构清楚，但整体窗口高度偏大。

### 新增和标签管理

- 控件没有越界；
- 固定高度造成大量空白；
- 标签绑定按钮视觉权重偏高；
- 窗口应改为内容自适应高度或更紧凑的最大高度。

### 长文本详情

- 正文完整、可滚动，操作区明确；
- 正文字号和字重偏大；
- 主 ClipHub 外壳与详情窗口形成双层容器；
- 外层关闭符号与内层关闭按钮重复；
- 半透明背景使后方内容干扰阅读。

## v2 输出文件

```text
/data/system/shortx_OYdazjKnxMzhQykL/ClipHub/probes/
cliphub_visual_review_probe_023_20260722-022113-012.json
```
