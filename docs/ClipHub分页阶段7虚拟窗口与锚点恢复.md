# ClipHub 分页阶段 7：虚拟窗口与锚点恢复

## 分支与版本

- 分支：`agent/add-pagination-lazy-prefetch-20260807`
- 模块集：`20260807.09`
- `Filter.MODULE_VERSION = 44`
- `Filter.PAGINATION_STAGE = 7`
- 模块数量：15

## 目标

阶段 7 在阶段 6 已通过真机验证的 AJAX 追加、数字分页、动态懒加载与下一页预取之上，完成：

1. 只保留当前位置前后有限范围的卡片 View；
2. 使用顶部和底部占位高度维持完整滚动范围；
3. 使用 `anchorItemId + anchorOffsetPx` 恢复位置；
4. 新记录插入时不打断旧位置；
5. 提供“有新内容 / 回到最新”入口；
6. 统一 AJAX、数字分页和普通数据重建的位置恢复路径。

## 结果区结构

`ScrollView` 仍只有一个直接子 View，内部结构调整为：

```text
ScrollView
└── resultContainer
    ├── virtualTopSpacer
    ├── virtualCardHost
    ├── virtualBottomSpacer
    └── paginationFooterHost
```

分页 Footer 与虚拟卡片 Host 分离。虚拟窗口调整时只重建 `virtualCardHost`，不会误删 AJAX Footer 或数字分页控件。

## 虚拟窗口范围

当前可见卡片数量按结果区高度和平均卡片高度动态计算：

```text
visibleCount = ceil(viewportHeight / averageCardHeight)
```

View 窗口保留：

- 当前位置之前约 3 屏；
- 当前可见区域；
- 当前位置之后约 5 屏。

窗口外记录继续保留在分页数据中，但不创建 Android View。顶部和底部占位高度由逐条高度缓存及平滑平均高度估算。

## 高度缓存

卡片布局完成后记录：

```javascript
heightById[String(itemId)] = cardHeight + bottomMargin;
```

未测量记录按以下顺序估算：

1. 当前平滑平均高度；
2. 根据卡片自适应尺寸计算出的默认高度。

平均值使用平滑更新，降低极端长文本卡片对整体占位的瞬时影响。

## 锚点恢复

重建前记录：

- 第一条可见记录 ID；
- 该记录在当前数据中的索引；
- 记录顶部相对结果区可见顶部的偏移。

重建后恢复优先级：

1. 相同记录 ID；
2. 相同索引附近的记录；
3. 合法范围内的最近记录。

普通刷新、筛选数据重建、置顶、删除、AJAX 追加及数字分页切换不再依赖绝对 `scrollY`。仅明确执行“回到最新”时允许回到第一页顶部。

## 滚动调度

Android 23 及以上继续使用 `View.OnScrollChangeListener`，但监听器现在同时承担：

- 虚拟窗口更新调度；
- AJAX 模式的懒加载阈值判断。

虚拟更新以 `24ms` 合并。滚动回调本身不查询数据库，也不直接批量创建 View。

数字分页模式：

- 虚拟滚动监听保持绑定；
- `lazyLoad.enabled = false`；
- `lazyLoad.listenerBound = false`；
- `virtual.scrollListenerBound = true`。

这保持了阶段 6“数字分页不启用 AJAX 懒加载”的语义。

## 横向滑动边界

当卡片处于横向滑动交互中：

- 虚拟回收暂缓；
- ACTION_UP / ACTION_CANCEL 后再允许调整；
- 删除或置顶动作完成后通过统一锚点路径重建。

## 新内容与回到最新

浏览旧位置时收到 `clipboard_added`：

- 不重新查询当前列表；
- 不重建当前 View；
- 不改变当前滚动位置；
- 清除不再可靠的下一页预取；
- 设置 `newContentPending = true`；
- 顶部显示“有新内容”。

点击后调用：

```javascript
ClipHub.Filter.resetToLatest({
    origin: "ui_quick_reset"
});
```

行为：

1. 失效分页代次、追加代次和预取缓存；
2. 清除旧锚点；
3. 回到第一页；
4. 查询最新记录；
5. 滚动到顶部；
6. 清除 `newContentPending` 和 `quickResetAvailable`。

如果新记录到达时本来就在第一页顶部，则允许刷新最新数据，并继续保持顶部位置。

## 公开诊断接口

新增：

```javascript
ClipHub.Filter.getVirtualState()
ClipHub.Filter.captureResultAnchor()
ClipHub.Filter.performVirtualUpdate(origin)
ClipHub.Filter.performScrollToItemId(itemId, offsetPx, origin)
ClipHub.Filter.resetToLatest(options)
ClipHub.Filter.performQuickResetClick()
```

核心状态：

- `firstRenderedIndex / lastRenderedIndex`
- `firstVisibleIndex / lastVisibleIndex`
- `renderedViewCount / loadedDataCount`
- `topSpacerPx / bottomSpacerPx`
- `averageCardHeightPx`
- `anchorItemId / anchorIndex / anchorOffsetPx`
- `anchorRestoreErrorPx`
- `updateCount / recycleCount / rebuildCount`
- `scrollListenerBound`
- `newContentPending / quickResetAvailable`

## 阶段 6 回归边界

阶段 7 保留并复测：

- AJAX Keyset 增量追加；
- 接近底部自动懒加载；
- AJAX 下一页预取命中；
- AJAX Footer 的 loading / load_more / end 状态；
- 数字分页页码切换；
- 数字分页下一页预取命中；
- 数字分页不启用 AJAX 懒加载。

## 冻结边界

- `src/ch_08_window.js` 不修改；
- `src/ch_13_settings.js` 不修改；
- `src/ch_15_app.js` 不修改；
- 不新增 `ch_16`；
- 模块数保持 15；
- Rhino ES5；
- `main` 不直接修改。

## 真机测试入口

`ClipHub_分页阶段7虚拟窗口与锚点恢复测试入口.txt`

隔离运行目录：

`ClipHubPaginationStage7VirtualAnchor`

测试会创建 241 条临时记录，再插入 1 条新记录，完成后删除全部临时记录并恢复原分页设置。

测试内容：

1. AJAX 首批加载 180 条，但创建的卡片 View 明显少于 180；
2. 定位到中部第 91 条记录，验证顶部占位和虚拟窗口裁剪；
3. 重建数据和面板后恢复相同 `anchorItemId` 与偏移；
4. 浏览旧位置时插入新记录，验证列表 ID 和滚动位置均不改变；
5. 执行“回到最新”，验证新记录位于首条、第一页顶部且锚点清空；
6. 预取并懒加载 AJAX 第 2 页，验证预取命中和 Footer `end`；
7. 切换数字分页，验证懒加载关闭、虚拟监听保持、下一页预取命中和第 2 页顺序。

## 通过条件

- `ok = true`
- `moduleSetVersion = 20260807.09`
- `filterModuleVersion = 44`
- `paginationStage = 7`
- `renderedViewCount < loadedDataCount`
- 中部位置 `firstRenderedIndex > 0`
- 中部位置 `topSpacerPx > 0`
- 重建前后 `anchorItemId` 相同
- `anchorOffsetPx` 差值不超过 32px
- `anchorRestoreErrorPx` 绝对值不超过 8px
- 新内容到达后加载 ID 不变、`scrollY` 不变
- 回到最新后新记录为首条、`scrollY = 0`、锚点为空
- AJAX 追加后仍维持 View 裁剪且预取命中
- 数字分页顺序与 Repository 一致且预取命中
- 所有分页、虚拟窗口和面板错误字段为 `null`
