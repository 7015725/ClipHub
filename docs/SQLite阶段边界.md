# ClipHub SQLite 阶段边界

## 当前完成

- Android 原生 `SQLiteDatabase` 打开与关闭；
- schema version 1；
- 顺序迁移框架；
- 显式事务封装；
- `SQLiteStatement` 参数绑定；
- Cursor 与 Statement 的 `finally` 清理；
- 数据库版本过高保护；
- `clipboard_items`、`tags`、`clipboard_item_tags`、`settings`、`schema_meta`；
- 剪贴板记录基础 CRUD；
- 软删除与恢复；
- 标签创建、列表和关联基础接口。

## 当前未实现

- ClipboardManager 监听；
- 短时间重复合并；
- 来源应用识别；
- 完整关键词搜索；
- 标签组合过滤；
- 批量删除和撤销；
- 数据库导入、导出和备份；
- 数据库损坏恢复。

## 线程边界

数据库模块当前在 ClipHub 初始化线程打开。后续 ClipboardManager、UI 和后台维护任务接入后，需要统一确定数据库调用线程策略，不能在多个不受控线程中直接共享复杂事务状态。

## 真机验证

当前先执行：

```text
probes/cliphub_database_probe_003.js
```

003 通过后，再增加真实模块探测 004，以验证：

- `ClipHub.js` 加载全部模块；
- 正式 `cliphub.db` schema 迁移；
- Repository 插入、查询、更新、软删除、恢复；
- 标签关联；
- `ClipHub.App.stop()` 后数据库关闭和文件锁释放。
