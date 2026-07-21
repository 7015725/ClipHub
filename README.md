# ClipHub

ClipHub 是一个面向 ShortX / Rhino ES5 / Android 原生 API 的模块化剪贴板历史管理项目。

## 当前状态

当前为开发分支骨架，Draft PR 尚未合并到 `main`。

已完成并通过真机验证：

- ShortX 单入口 `ClipHub.js`
- raw GitHub 模块下载
- manifest 与 Git blob SHA 校验
- stage / backup / rollback
- 文件锁和跨 ShortX 任务停止控制
- Android 原生 SQLite schema v2
- Repository CRUD、事务、标签、软删除
- ClipboardManager 文本监听和主动写入
- 自身回写抑制与重复回调抑制
- 100 条连续复制压力测试
- 来源应用包名、名称、UID 与置信度
- 敏感 ClipData 默认跳过和允许保存
- 忽略来源应用策略
- 设置持久化与历史清理实现

当前模块集：

```text
20260721.9
```

## ShortX 使用方式

只需要在 ShortX Rhino JavaScript 任务中执行完整 `ClipHub.js`。

入口会维护：

```text
shortx.getShortXDir()/ClipHub/
├── cache/
├── data/
├── logs/
├── modules/
└── probes/
```

首次运行会下载 15 个模块。模块未变化时不会重复下载。远程下载失败时，如果本地模块集完整且 SHA 校验通过，会使用离线缓存。

## 当前更新边界

入口版本 4 在正式实例运行时会直接返回复用结果，不会同步远程模块。

更新测试分支模块时，需要：

1. 执行 `probes/cliphub_stop_formal.js`；
2. 再执行完整 `ClipHub.js`；
3. 确认 `sync.moduleSetVersion`；
4. 执行对应真机探测。

不得删除仍被实例持有的 `cliphub.lock`。

## 隐私默认值

```text
sensitivePolicy=skip
historyLimit=0
autoCleanupDays=0
```

- 敏感 ClipData 默认不保存正文；
- 历史数量和保存天数默认都不启用自动删除；
- 置顶记录不会被历史清理删除。

## 文档

- `docs/架构设计.md`
- `docs/数据库设计.md`
- `docs/模块规范.md`
- `docs/开发计划.md`
- `docs/设置持久化与历史清理探测009说明.md`

## 兼容约束

- Rhino ES5
- 只使用 `var` 和 `function`
- 禁止 ES6+ 语法
- Android 13 及以上
- Android 14 / API 34 为主要测试环境
- ShortX 运行于 `system_server` / uid 1000
