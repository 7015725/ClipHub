# ClipHub 分页阶段 1：统一 Repository 分页基础

## 分支与范围

开发分支：

`agent/add-pagination-lazy-prefetch-20260807`

本阶段在阶段 0 生命周期闸门之上，统一完成后续 AJAX 追加、数字分页、预加载、虚拟窗口和数据水合共同依赖的数据层接口。尚未修改设置页和首页分页 UI。

由于尚未收到阶段 0 真机工作线程探针结果，本阶段只实现同步 Repository 接口和只读测试入口；后续界面状态机默认采用 `Handler.post()` / `postDelayed()` 空闲分段路径，不直接启用未验证的 Rhino Executor 回调。

## 实现内容

### 统一查询条件

新增：

```javascript
ClipHub.Repository.buildItemWhere(options)
```

分页列表和条件总数共用同一组条件：

- 未删除记录
- 关键字
- 来源包名
- 标签
- 置顶筛选
- 敏感内容包含或排除

避免实际列表与总页数使用两套条件。

### 全局稳定排序

新增：

```javascript
ClipHub.Repository.buildItemOrder(sortMode)
```

规则：

- `latest`、`pinned`：置顶降序、手工顺序升序、最后复制时间降序、ID 降序。
- `source`：规范化来源文本升序，再追加上述稳定字段。
- 所有排序最后包含唯一 ID，防止跨页重复或遗漏。

### AJAX Keyset

新增：

```javascript
ClipHub.Repository.buildPageCursor(row, sortMode)
ClipHub.Repository.buildAppendCursorWhere(sortMode, cursor, args)
```

AJAX 下一页使用最后一条记录的完整排序字段作为游标，不依赖不断增大的 OFFSET。顶部插入新剪贴板后，继续向旧数据读取不会重新读取前一页。

### 数字分页

统一入口：

```javascript
ClipHub.Repository.listItemPage(options)
```

数字分页使用：

```text
offset = (page - 1) × pageSize
limit = pageSize + 1
```

并通过：

```javascript
ClipHub.Repository.countItemsByOptions(options)
```

返回条件总数与总页数。

### 页面大小

Repository 公共边界：

```text
最小 5
默认 100
最大 1000
```

Repository 对内部非法调用安全回退到 100。设置页阶段仍必须严格拒绝非法输入，不允许静默保存。

### 标签分块

新增：

```javascript
ClipHub.Repository.listItemTagMapChunked(ids)
```

每批最多 400 个 ID。页面大小为 1000 时最多拆为三次标签查询。

### 按 ID 水合

新增：

```javascript
ClipHub.Repository.listItemsByIds(ids)
```

行为：

- 每批最多 400 个 ID。
- 跳过已删除或不存在的记录。
- 按传入 ID 顺序返回。
- 为后续页面块脱水和重新水合提供基础。

## Repository 版本

```text
ch_06_repository.js MODULE_VERSION = 14
moduleSetVersion = 20260807.02
```

## 测试入口

运行：

`ClipHub_分页阶段1仓库测试入口.txt`

这是只读测试，不新增、编辑或删除剪贴板数据。检查：

1. 数字分页完整 ID 顺序。
2. AJAX Keyset 完整 ID 顺序。
3. 两种模式的完整结果是否一致。
4. 是否存在重复 ID。
5. 条件总数是否等于实际结果数。
6. 逆序 ID 水合是否保持输入顺序。
7. 最多 1000 个 ID 的标签分块查询。
8. 页面大小和标签块常量是否正确。

## 冻结边界

- `src/ch_08_window.js` 不修改。
- 窗口 blob 保持 `4ccff8067656ae51602290c884081795ec0f65ea`。
- 模块数量保持 15。
- 不新增 `ch_16`。
- 不修改卡片视觉、圆角、拖动、缩放、IME、系统返回或外部点击关闭链。
- Rhino ES5 仅使用 `var`。
- `main` 不直接修改。

## 下一步

Repository 真机只读测试通过后，在同一分支统一接入：

- 设置页加载模式、5–1000 数量和预加载开关。
- Filter 分页状态机。
- AJAX 追加和数字分页 Footer。
- Handler 空闲预加载。
- 动态懒加载、虚拟 View、位置锚点和“回到最新”。
