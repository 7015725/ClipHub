# ClipHub 剪贴板探测 005 v2 真机结果

## 环境

```text
日期：2026-07-21
Android：14 / SDK 34
进程：system_server
uid：1000
ShortX 任务线程：DefaultDispatcher-worker-1
ClipboardManager 回调线程：main
模块集：20260721.6
```

## 结果

005 v2 顶层返回：

```text
ok=true
error=null
durationMs=921
```

通过项：

- 隔离运行目录启动成功；
- ClipboardManager 监听器正常注册；
- ClipHub 主动写入成功；
- 主动写入被自身回环标记抑制；
- 主动写入后隔离数据库记录数仍为 0；
- 外部文本第一次复制插入；
- 相同文本第二次复制合并；
- 最终仅 1 条记录；
- `copy_count=2`；
- 监听回调运行在 Android `main` 线程；
- `errorCount=0`；
- 隔离实例停止后数据库关闭；
- 原剪贴板恢复；
- 正式实例重新启动；
- 隔离目录清理成功。

关键计数：

```text
eventSeq=6
handledCount=2
ignoredCount=4
errorCount=0
```

## 控制广播边界

本次返回：

```text
formalControl.initiallyRunning=false
formalControl.alreadyStopped=true
formalControl.ack=null
formalControl.lockReleased=true
```

这说明运行 005 v2 时，正式实例没有持有文件锁。因此本次没有实际触发：

```text
com.cliphub.runtime.CONTROL
```

控制接收器、停止确认文件以及控制回调主线程路径仍需单独验证。

005 v2 可以确认 ClipboardManager、Repository、回环抑制和重复合并业务链路通过，但不能单独作为跨 ShortX 任务停止控制的验证结果。

## 后续

探测 006 必须满足：

- 执行前正式 ClipHub 正在运行；
- 正式 `cliphub.lock` 已被持有；
- 控制广播返回确认文件；
- 确认回调线程为 `main`；
- 确认停止后锁释放；
- 再执行 100 条不同文本压力测试；
- 验证多 item、空白、非文本和超长 ClipData 边界；
- 最后恢复剪贴板并重新启动正式实例。
