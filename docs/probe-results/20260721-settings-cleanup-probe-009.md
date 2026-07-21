# ClipHub 设置与历史清理探测 009 结果

## 结论

探测通过：

```text
ok=true
probeVersion=1
moduleSetVersion=20260721.9
durationMs=214
error=null
```

## 已验证

- 正式实例通过随机令牌控制端点停止；
- 控制确认运行在 Android `main` 线程；
- 7 项设置写入 SQLite；
- 忽略应用列表完成去空格和去重；
- 运行期配置立即同步到 Clipboard 模块；
- 设置在停止和二次启动后保持；
- 1 条过期非置顶记录被删除；
- 2 条超量非置顶记录被裁剪；
- 1 条过期置顶记录保留；
- 二次启动清理没有重复删除；
- 隔离数据库关闭、目录清理和正式实例恢复正常。

## 关键结果

```text
settingsRowCount=7
seededCount=7
expiredDeleted=1
overflowDeleted=2
totalDeleted=3
remainingActive=4
remainingTotal=4
pinnedPreserved=true
nonPinnedRemaining=3
settingsReloaded=true
runtimeConfigReloaded=true
secondCleanupStable=true
```

## 边界

探测使用：

```text
shortx.getShortXDir()/ClipHubProbe009/
```

没有修改正式 ClipHub 设置或正式历史记录。
