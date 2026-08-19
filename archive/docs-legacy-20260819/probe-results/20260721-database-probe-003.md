# ClipHub SQLite 探测 003 真机结果

## 结论

结果：**通过**。

Android 14 / API 34 / `system_server` / uid=1000 环境中，Android 原生 `SQLiteDatabase` 的基础能力满足 ClipHub 当前数据层要求。

## 运行环境

```text
probeVersion: 1
pid: 3284
uid: 1000
threadId: 31935
threadName: DefaultDispatcher-worker-7
durationMs: 37
```

探测数据库：

```text
/data/system/shortx_OYdazjKnxMzhQykL/ClipHub/probes/
cliphub_database_probe_003.db
```

## 验证结果

```text
opened = true
schemaVersion = 1
foreignKeysEnabled = true
committedId = 1
committedCount = 1
rollbackObserved = true
updateCount = 1
deleteCount = 1
reopened = true
reopenedCount = 1
integrityCheck = ok
error = null
```

## 文件清理

```text
database = true
journal = true
wal = true
shm = true
```

说明数据库本体和可能产生的 sidecar 文件均已成功清理，没有发现未关闭的数据库、Cursor 或 Statement 持有文件。

## 已确认边界

- `SQLiteDatabase.openOrCreateDatabase()` 可用；
- schema version 读写正常；
- foreign key 可启用；
- `SQLiteStatement` 参数绑定正常；
- 显式事务提交正常；
- 未标记成功的事务能够回滚；
- 更新和删除返回计数正常；
- 数据库关闭后可以重新打开；
- `PRAGMA integrity_check` 返回 `ok`；
- 探测任务仍运行在 `DefaultDispatcher-worker-*`，后续需要确定数据库统一调用线程策略。

## 后续

进入真实模块探测 004：

- 安装真实 `ClipHub.js` 与 `modules/*.js`；
- 使用隔离运行目录 `ClipHubProbe004`；
- 验证正式 schema 迁移；
- 验证 Repository CRUD、标签关联、软删除和恢复；
- 验证事务包装层回滚；
- 验证 `ClipHub.App.stop()` 关闭数据库并释放文件锁；
- 验证停止后可以再次启动。
