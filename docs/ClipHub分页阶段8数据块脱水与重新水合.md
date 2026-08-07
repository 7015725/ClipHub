# ClipHub 分页阶段 8：数据块脱水与重新水合

## 分支与版本

- 分支：`agent/add-pagination-lazy-prefetch-20260807`
- 模块集：`20260807.10`
- `Filter.MODULE_VERSION = 45`
- `Filter.PAGINATION_STAGE = 8`
- 模块数量：15

## 目标

Stage 8 在 Stage 7 虚拟 View 窗口基础上继续限制数据内存：

1. 远离当前虚拟窗口的完整记录释放为仅含 `id` 的轻量占位；
2. 保留记录顺序、分页游标和逐条高度；
3. 滚回旧位置时通过 `Repository.listItemsByIds()` 分块恢复完整记录；
4. 标签只对当前数据窗口查询，远区标签映射同步释放；
5. 数据库中已删除的旧 ID 在水合时自动移除；
6. 不破坏 AJAX 追加、数字分页、预加载、虚拟 View 和锚点恢复。

## 数据窗口

`previewRows` 继续保持完整的已加载顺序，但远区记录会替换为：

```javascript
{
    id: 123,
    __clipHubDehydrated: true
}
```

轻量占位不保存正文、来源、敏感标记、置顶状态或其他完整字段。以下信息继续保留：

- 记录 ID 和数组顺序；
- AJAX Keyset 下一页游标；
- 数字分页页码和总数；
- `heightById` 高度缓存；
- 当前 `anchorItemId + anchorOffsetPx`。

## 动态分块

块大小根据当前可见卡片数量计算：

```text
blockSize = clamp(visibleCount × 2, 24, 100)
```

保留范围为：

- 当前虚拟 View 窗口；
- 窗口前 1 个数据块；
- 窗口后 1 个数据块。

其余完整记录执行脱水。页面大小为 1000 时，不会在内存中长期保留 1000 条完整正文。

## 重新水合

虚拟窗口准备创建卡片前执行：

1. 收集窗口内轻量占位 ID；
2. 调用 `Repository.listItemsByIds(ids)`；
3. 按原 ID 顺序替换回完整记录；
4. 只查询当前窗口尚未加载的标签映射；
5. 再创建 Android 卡片 View。

如果 ID 已从数据库删除：

- 从 `previewRows` 移除；
- 清理该 ID 的标签映射和高度缓存；
- 修正已加载数量、总数和页数；
- 重新计算虚拟范围并按邻近记录恢复锚点。

## 诊断接口

新增：

```javascript
ClipHub.Filter.getDataWindowState()
ClipHub.Filter.getDataWindowRowSnapshot(itemId)
ClipHub.Filter.performDataWindowMaintenance(origin)
```

核心字段：

- `blockSize / blockCount / hydratedBlockCount`
- `loadedDataCount`
- `hydratedRowCount / dehydratedRowCount`
- `hydrationPassCount / dehydrationPassCount`
- `hydrateQueryCount / tagQueryCount`
- `hydratedRowTotal / dehydratedRowTotal`
- `missingIdCount`
- `keepStartIndex / keepEndIndex`
- `lastHydrateStartIndex / lastHydrateEndIndex`
- `lastOrigin / lastError`

## Stage 7 回归边界

Stage 8 必须继续保持：

- 虚拟窗口只创建当前位置附近的 View；
- 锚点仍按 `anchorItemId + offset` 恢复；
- 新记录到达不打断旧位置；
- 回到最新恢复第一页顶部并清除锚点；
- AJAX 懒加载和下一页预加载继续工作；
- 数字分页不启用 AJAX 懒加载；
- 分页顺序、总数和 Footer 状态不变。

## 冻结边界

- 不修改 `src/ch_08_window.js`；
- 不修改 `src/ch_13_settings.js`；
- 不修改 `src/ch_15_app.js`；
- 不修改 `src/ch_06_repository.js`；
- 不新增 `ch_16`；
- 模块数保持 15；
- Rhino ES5；
- `main` 不直接修改。

## 通过条件

- `moduleSetVersion = 20260807.10`
- `filterModuleVersion = 45`
- `paginationStage = 8`
- 连续加载多页后 `dehydratedRowCount > 0`
- `hydratedRowCount < loadedDataCount`
- 滚回已脱水记录后，该记录恢复完整正文
- 重新水合后 ID 顺序与脱水前一致
- 标签只对数据窗口查询
- 已删除 ID 水合时可自动修正
- 锚点恢复误差不超过 Stage 7 门限
- AJAX、数字分页和预加载回归通过
- `dataWindow.lastError = null`

## 真机测试入口

`ClipHub_分页阶段8数据块脱水与重新水合测试入口.txt`

测试入口版本：2。锚点目标选择靠前的首个已脱水记录，避免定位测试本身进入页尾懒加载阈值。

隔离运行目录：

`ClipHubPaginationStage8DataWindow`

测试会创建 361 条临时记录并额外插入 1 条新记录，覆盖：

1. 首页完整记录脱水；
2. 定位远区 ID 后重新水合正文和标签；
3. 锚点重建；
4. 新内容不打断当前位置及回到最新；
5. AJAX 多页追加、预加载和旧数据块返回；
6. 数字分页及预加载；
7. 删除已脱水 ID 后的自动修正；
8. 测试结束后清理临时记录、恢复分页设置并延迟完全停止隔离实例。
