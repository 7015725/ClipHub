# ClipHub 首页 200 字符预览与完整正文按需读取 Stage 11

## 基线

- Beta 基线：`beta-pagination-stage10-20260808`
- 基线提交：`4eecd41e3abbc7b3293ab8bfca596322abfb05dc`
- 开发分支：`agent/beta-list-preview-on-demand-20260808`
- 入口版本：`6`
- 模块集版本：`20260808.02`
- Repository：`16`
- List：`20`
- Filter：`49`
- `PAGINATION_STAGE`：`9`
- 模块数量：`15`

## 实现

- Repository 的 `listItems`、`listItemPage` 与 `listItemsByIds` 支持 `previewOnly`，预览查询在 SQLite 投影层执行 `substr(..., 1, 200)`，并返回 `content_length` 与 `content_truncated`。
- `getItem(id, false)` 保持完整记录读取；关键字 WHERE 仍匹配完整 `clipboard_items.content`。
- Filter 的初始分页、AJAX、数字分页、预加载、兼容查询和数据窗口水合统一启用预览模式。
- Filter 输入与复制先按 ID 读取最新完整记录，读取失败不回退预览正文；编辑、翻译继续保持原有按 ID 链路。
- 首页卡片只渲染预览正文；截断记录仅在显示层追加 `…`。
- List 复制和详情入口统一按 ID 重新读取完整记录；长文本判断优先使用 `content_length`。
- List 非 Filter 兼容查询也显式请求 `previewOnly: true`，避免首页回退路径重新拉取完整正文。

## 冻结边界

- `VIRTUAL_BEFORE_SCREENS = 3`
- `VIRTUAL_AFTER_SCREENS = 5`
- `VIRTUAL_UPDATE_DELAY_MS = 24`
- 不新增线程。
- 不修改数据库 schema。
- 不新增 `ch_16`。
- `ch_08`、`ch_10`、`ch_12`、`ch_13`、`ch_15` 保持 Beta blob 不变。

## Repository 包装说明

Beta 的 `ch_06_repository.js` 实际是 Stage 2 loader，而它固定的 Stage 1 文件又是自包含 GZIP 包装器。为保证 200 字符限制发生在 SQLite 查询层，本阶段构建器从固定 Stage 1 提交解出规范 Repository 源码，应用确定性修改后重新生成自包含模块；不会先读取完整正文再在 Rhino 中截断。

## GitHub 静态验收

最终静态验收 Actions run `31242510151` 已通过：

- Rhino ES5 validation：PASS。
- JavaScript syntax validation：PASS。
- 15 个模块 manifest Git blob SHA：PASS。
- Repository 内嵌规范源码与 200 字符 SQL 投影约束：PASS。
- Filter v4 packed/source SHA-256：PASS。
- Repository/List/Filter 版本及按需正文读取关键约束：PASS。
- `VIRTUAL_BEFORE_SCREENS = 3`、`VIRTUAL_AFTER_SCREENS = 5`、`VIRTUAL_UPDATE_DELAY_MS = 24`：PASS。

## Stage 11 真机自动探测

2026-08-08 真机执行 `ClipHub_分页阶段11首页预览按需正文测试入口.txt`，结果：`ok=true`。

运行身份：

- `testEntry = pagination_stage11_preview_on_demand`
- `testEntryVersion = 1`
- `sourceRef = agent/beta-list-preview-on-demand-20260808`
- `moduleSetVersion = 20260808.02`
- Repository `16`
- List `20`
- Filter `49`
- `PAGINATION_STAGE = 9`
- `previewLimit = 200`
- `fixtureCount = 7`
- 模块下载 `15/15`，`remoteAvailable=true`，`fallback=false`，`transport=raw`

以下自动检查全部通过：

- `identity`
- `listPreviewProjection`
- `pagePreviewProjection`
- `hydrationPreviewProjection`
- `defaultHydrationStillFull`
- `getItemStillFull`
- `boundary199`
- `boundary200`
- `boundary201`
- `searchAfter200`
- `searchCardStillPreview`
- `deletedItemNoFullFallbackBasis`

因此已确认：Repository 三类首页/分页/水合预览查询均只返回约 200 字符；未显式启用预览的兼容读取仍为完整正文；`getItem` 仍返回完整正文；199/200/201 字符边界正确；关键词仅位于第 200 字符之后时仍能搜索命中，而命中后的首页卡片仍保持预览；删除记录不存在错误的完整正文回退基础。

## 尚需真实 UI 回归

Stage 11 自动探测通过不等于真实 UI 已全部验收。以下项目仍需真机行为验证：

1. 首页真实长代码连续滑动体验与卡顿情况。
2. 复制按钮得到完整正文而不是预览正文。
3. 单击“输入文本”得到完整正文。
4. 编辑页加载并保存完整正文。
5. 翻译入口收到完整正文。
6. 详情页显示完整正文。
7. Stage 6–10 的 AJAX、下一页预加载、数字分页、anchor、数据窗口脱水/重新水合、数据变化协调与“回到最新”位置保持回归。

完成上述 UI 回归前，本分支保持 Draft，不推进 Beta/Main。
