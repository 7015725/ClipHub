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

## 验证边界

GitHub 构建只完成静态/打包级校验。真机仍需验证长代码滑动、复制/输入/编辑/翻译/详情完整正文、正文第 201 字符后的搜索命中，以及 Stage 6–10 分页与位置保持回归。
