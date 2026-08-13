# ClipHub Regex Beta 回滚探针 060

目标：验证 Beta 与 main 共用 `shortx.getShortXDir()/ClipHub` 时，Beta 新增正则功能不会提高 SQLite `user_version`，并可安全 `Beta -> main -> Beta`。

## 前置

- main 与 Beta 不可同时运行。
- 记录测试前剪贴板条数。
- 不删除 `shortx.getShortXDir()/ClipHub/data/cliphub.db`。

## 步骤

1. 启动 `main`，记录 `Database.getVersion()` 与 `Repository.countItems()`；预期数据库版本为 `2`。
2. 停止 main。
3. 使用 `beta-regex-filter-20260813` 入口启动 Beta。
4. 确认 `Database.getVersion() == 2`，创建一条自定义正则规则并执行一次高级正则筛选。
5. 停止 Beta。
6. 再次使用 main 入口启动。
7. 确认 main 正常启动、数据库版本仍为 `2`、原剪贴板记录仍可读取，无 `Database schema is newer than this build`。
8. 停止 main，再次启动 Beta。
9. 确认步骤 4 创建的自定义正则规则仍存在。

## PASS 条件

- 全过程运行目录始终为 `shortx.getShortXDir()/ClipHub`。
- SQLite `user_version` 始终为 `2`。
- main 可正常启动并读取旧数据。
- 再切回 Beta 后 `regex_rules` 用户数据仍存在。
- 未出现新增 `ClipHubBeta` / `ClipHubTest` 目录。
