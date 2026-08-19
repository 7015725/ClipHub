# ClipHub SQLite 探测说明

## 1. 目的

`cliphub_database_probe_003.js` 用于在 ShortX / Rhino ES5 / Android 14 真机环境中验证 Android 原生 `SQLiteDatabase` 的基础能力。

本探测不会打开或修改正式数据库：

```text
shortx.getShortXDir()/ClipHub/data/cliphub.db
```

它仅使用独立临时数据库：

```text
shortx.getShortXDir()/ClipHub/probes/cliphub_database_probe_003.db
```

脚本结束时会尝试删除临时数据库及其 `-journal`、`-wal`、`-shm` 文件。

## 2. 验证内容

- 创建并打开数据库；
- 设置并读取 schema version；
- 启用 foreign key；
- 使用 `SQLiteStatement` 参数绑定插入；
- 提交事务；
- 未调用 `setTransactionSuccessful()` 时回滚；
- 更新和删除记录；
- `ON DELETE CASCADE`；
- 关闭后重新打开；
- `PRAGMA integrity_check`；
- 清理探测数据库文件。

## 3. 执行方法

同步当前开发分支：

```sh
cd ~/projects/github/ClipHub
git fetch origin
git switch agent/initialize-project-skeleton
git pull --ff-only
```

复制脚本到下载目录：

```sh
cp probes/cliphub_database_probe_003.js \
  "/storage/emulated/0/Download/ClipHub_SQLite探测_003.js"
```

在 ShortX 中建立一个 Rhino JavaScript 单次任务，粘贴该文件完整代码并执行。

## 4. 通过条件

顶层结果：

```json
{
  "ok": true,
  "probe": "cliphub_database_probe_003",
  "probeVersion": 1
}
```

关键字段应满足：

```text
opened = true
schemaVersion = 1
foreignKeysEnabled = true
committedId > 0
committedCount = 1
rollbackObserved = true
updateCount = 1
deleteCount = 1
reopened = true
reopenedCount = 1
integrityCheck = ok
error = null
```

`cleanup` 中各字段应尽量为 `true`：

```json
{
  "database": true,
  "journal": true,
  "wal": true,
  "shm": true
}
```

## 5. 输出路径

```text
shortx.getShortXDir()/ClipHub/probes/
cliphub_database_probe_003_YYYYMMDD-HHMMSS-SSS.json
```

## 6. 结果处理

- 全部通过：继续验证真实 `ch_03_database.js` 和 `ch_06_repository.js` 模块；
- 参数绑定失败：调整 Rhino 数字到 `bindLong` / `bindDouble` 的转换；
- foreign key 失败：检查 `setForeignKeyConstraintsEnabled(true)` 调用时机；
- 回滚失败：检查事务成功标记与 `endTransaction()` 边界；
- 重开失败：检查数据库描述符和 Cursor/Statement 清理；
- 清理失败：保留路径信息，检查是否仍有对象持有数据库文件。
