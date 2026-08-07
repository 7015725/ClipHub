# ClipHub 分页阶段 5：数字分页与页码导航

## 分支

`agent/add-pagination-lazy-prefetch-20260807`

## 模块集

`20260807.07`

## 本阶段目标

在保留阶段 4 AJAX Keyset 追加逻辑的前提下，为首页数字分页模式增加完整页码 Footer 和页面替换逻辑。

本阶段不实现动态懒加载、数据预加载、虚拟 View 和“回到最新”。

## 数字分页 Footer

Footer 结构：

```text
«  ‹  1  …  3  4  5  6  7  …  9  ›  »
```

含义：

- `«`：首页；
- `‹`：上一页；
- 数字：可直接访问的页；
- `…`：页码缺口；
- `›`：下一页；
- `»`：末页。

规则：

- 当前页附近最多保留 5 个连续页码；
- 始终保留第 1 页和最后一页；
- 页码缺口使用省略号；
- 当前页不可重复点击；
- 第 1 页禁用首页和上一页；
- 最后一页禁用下一页和末页；
- 不增加页码输入框；
- 窄窗口下使用横向滚动 Footer，避免压缩首页卡片。

## 页面切换

新增内部方法：

```javascript
function calculatePageButtons(currentPage, totalPages)
function buildNumberPaginationFooter(colors)
function goToPage(page, origin, action)
function performNumberAction(action, origin)
```

公开诊断和测试 API：

```javascript
ClipHub.Filter.getNumberPagerState()
ClipHub.Filter.calculatePageButtons(currentPage, totalPages)
ClipHub.Filter.goToPage(page, origin)
ClipHub.Filter.performNumberPageClick(page)
ClipHub.Filter.performNumberActionClick(action)
```

支持的动作：

```text
first
previous
next
last
```

点击页码后：

1. 使用 Repository `mode = number` 查询目标页；
2. 保留全局筛选条件和稳定排序；
3. 替换当前页记录，不累计旧页记录；
4. 重新读取当前页标签；
5. 只重建当前页卡片；
6. 将结果区域滚动到顶部；
7. 重建数字分页 Footer。

## 页码计算

总页数不超过 7 时显示全部页码。

总页数较多时：

- 固定第 1 页；
- 固定最后一页；
- 当前页附近最多 5 个连续页码；
- 两侧存在缺口时显示省略号。

示例：

```text
第 1 页：1 2 3 4 5 6 … 9
第 5 页：1 … 3 4 5 6 7 … 9
第 9 页：1 … 4 5 6 7 8 9
```

## 边界处理

### 越界页码

目标页会限制在：

```text
1 <= page <= totalPages
```

### 最后一页删除

数字分页重新查询后，如果当前页已经超过新的总页数：

1. 自动改为新的最后一页；
2. 再次查询该页；
3. 不直接跳回第 1 页。

全部记录为空时回到第 1 页空状态。

### 重复点击

- 当前页不可点击；
- 加载期间全部分页按钮禁用；
- 无效动作不会发起 Repository 查询；
- 诊断状态记录阻止次数。

## 状态

`getNumberPagerState()` 返回：

- 是否显示；
- 当前页、总页数和总记录数；
- 页码 Token；
- 首页、上一页、下一页、末页可用状态；
- 点击、成功、失败和阻止次数；
- 页面替换次数；
- 页面切换前后的滚动位置；
- 非零滚动位置重置次数；
- 最后目标页、动作和错误。

模块标识：

```text
Filter.MODULE_VERSION = 42
Filter.PAGINATION_STAGE = 5
```

## AJAX 回归边界

数字分页使用独立 `numberPagerView`。

AJAX 模式继续使用：

- `loadMoreView`
- Keyset 游标
- 增量卡片追加
- 当前位置保持
- `load_more / loading / end / none`

数字分页模式下：

- AJAX Footer 不显示；
- `loadMorePresent = false`；
- 页面结果不累计。

## 冻结边界

- `src/ch_08_window.js` 不修改；
- `src/ch_13_settings.js` 不修改；
- `src/ch_15_app.js` 不修改；
- 模块数量保持 15；
- 不新增 `ch_16`；
- Rhino ES5；
- `main` 不修改。

## Stage 5 V2 测试夹具修正

V1 真机结果已经验证数字分页功能本身正常：页码 Footer、直接页码跳转、上一页/下一页、首页/末页、末页禁用状态、页内顺序和页面替换均通过。

V1 返回 `ok = false` 的原因仅为测试夹具未制造出可滚动结果区。测试使用每页 6 条，而真机窗口约 704dp 高，6 张卡片不足以产生纵向滚动，因此 `performSetResultScrollY(80)` 最终仍为 `0`，无法完成“非零滚动位置切页后归零”的验证。

V2 只修改测试夹具，不修改运行模块：

- `TEST_ENTRY_VERSION = 2`；
- 每页由 6 条改为 12 条；
- 临时记录由 49 条改为 97 条，仍保持总页数 9；
- 增加最长 5 秒的 `contentReady`/卡片数量等待，覆盖 12 条记录的分批渲染；
- 继续要求切页前 `scrollY > 0`、切页后 `scrollY = 0`；
- `moduleSetVersion` 仍为 `20260807.07`；
- Filter 仍为版本 `42`，分页阶段仍为 `5`。

## 真机测试

测试入口：

`ClipHub_分页阶段5数字分页测试入口.txt`

隔离运行目录：

`ClipHubPaginationStage5NumberPager`

V2 测试会创建 97 条临时记录，并设置：

```text
数字分页
每页 12 条
共 9 页
```

验证内容：

- 首页 12 条；
- 数字 Footer 显示；
- AJAX Footer 隐藏；
- 不存在页码输入框；
- 第 1 页页码序列；
- 点击数字 `2`；
- 连续下一页到第 5 页；
- 中间页省略号和附近 5 个连续页码；
- 跳到末页；
- 末页只有 1 条；
- 末页禁用下一页和末页；
- 返回上一页和首页；
- 第 1 页禁用首页和上一页；
- 每页记录顺序与 Repository 一致；
- 页面切换后结果区滚动到顶部；
- 页面结果不是累计列表；
- 总数为 97，总页数为 9。

测试结束后关闭浮窗、删除临时记录、恢复分页设置并停止隔离实例。

## 通过条件

- `ok = true`
- `moduleSetVersion = 20260807.07`
- `filterModuleVersion = 42`
- `paginationStage = 5`
- `pageSize = 12`
- `totalCount = 97`
- `totalPages = 9`
- `jumpInputPresent = false`
- 中间页 Token 为 `1 … 3 4 5 6 7 … 9`
- 数字页、上一页、下一页、首页、末页动作正常
- 页面顺序全部匹配
- `nonZeroScrollResetCount >= 1`
- `failureCount = 0`
