# ClipHub 剪贴板探测 005 v1 结果

## 环境

```text
日期：2026-07-21
Android：14 / SDK 34
进程：system_server
uid：1000
入口版本：4
模块集：20260721.5
探测版本：1
```

## 返回结果概览

剪贴板业务链路通过：

- 隔离实例启动成功；
- ClipboardManager 监听器运行；
- ClipHub 主动写入被抑制；
- 主动写入后隔离数据库记录数为 0；
- 外部文本首次复制插入成功；
- 相同文本第二次复制合并成功；
- 最终仅有 1 条记录，`copy_count=2`；
- 回调线程为 Android 主线程；
- `errorCount=0`；
- 隔离监听器停止；
- 隔离数据库关闭；
- 原剪贴板恢复；
- 隔离目录清理成功。

关键时间线：

```text
callbackThreadId=2
callbackThreadName=main
eventSeq=6
handledCount=2
ignoredCount=4
errorCount=0
```

## 未通过项

最后重新启动正式实例时返回：

```text
ClipHub is already running
```

## 根因

不同 ShortX JavaScript 任务使用不同 Rhino 全局作用域。

临时停止任务返回 `alreadyStopped=true`，只说明该任务自己的全局作用域中没有 `ClipHub.App`，不能证明另一个任务建立的正式实例已经停止。

原正式实例仍持有：

```text
shortx.getShortXDir()/ClipHub/data/cliphub.lock
```

因此 005 v1 最后无法重新获取正式锁。

这也意味着 v1 测试期间，旧正式 ClipboardManager 监听器可能同时观察测试剪贴板事件。虽然隔离数据库结果正确，但不能把 v1 认定为严格隔离通过。

## 修复

模块集 `20260721.6` 增加：

- App 跨 ShortX 任务控制广播；
- Android 13+ `RECEIVER_NOT_EXPORTED`；
- 主线程注册和注销 BroadcastReceiver；
- 停止完成确认文件；
- 文件锁释放验证；
- 005 探测版本 2。

005 v2 只有在确认正式实例的文件锁已经释放后，才会开始修改剪贴板和启动隔离实例。

## 一次性升级要求

当前运行中的 `20260721.5` 没有控制接收器，不能被其他 ShortX 任务安全停止。

需要：

1. 重启设备，释放旧监听器和 Java 文件锁；
2. 执行入口版本 4；
3. 确认下载模块集 `20260721.6`；
4. 执行 005 v2。

不得通过删除 `cliphub.lock` 文件绕过锁。删除被锁定的路径可能让新旧实例分别锁定不同 inode，形成双实例。
