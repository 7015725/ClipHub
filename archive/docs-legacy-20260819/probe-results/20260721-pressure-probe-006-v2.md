# ClipHub 压力探测 006 v2 真机结果

## 结论

探测通过：

```text
ok=true
probeVersion=2
durationMs=3702
error=null
```

## 控制链路

正式实例在探测开始时处于运行状态，并成功完成跨 ShortX 任务停止：

```text
formalInitiallyRunning=true
formalEndpointPresent=true
formalEndpointRemoved=true
formalControlTransport=dynamic_broadcast_token
formalAckReceived=true
formalAckThreadId=2
formalAckThreadName=main
formalStopped=true
formalLockReleased=true
```

确认文件表明停止接收器运行在 Android 主线程。停止后随机控制端点已删除，正式数据库和文件锁均已释放。

## 压力结果

```text
uniqueRequested=100
uniqueCount=100
uniqueInserted=true
stressDurationMs=3466
```

100 条不同文本全部准确写入隔离数据库，没有丢失，也没有重复记录。

## 回调与去重

```text
eventSeq=205
handledCount=101
ignoredCount=104
errorCount=0
callbackThreadId=2
callbackThreadName=main
```

100 条独立文本和 1 条多 item 文本产生 205 次回调。101 次有效处理，104 次分类状态变化或重复回调被抑制，最终记录数保持准确。

## ClipData 边界

以下测试全部通过：

```text
multiItemInserted=true
multiItemHashMatched=true
blankIgnored=true
nonTextIgnored=true
oversizedIgnored=true
invalidCountStable=true
```

- 两个文本 item 合并为一条带换行记录；
- 空白文本未入库；
- URI 非文本未入库；
- 超过探测上限的文本未入库；
- 异常 ClipData 没有改变数据库记录数。

## 清理与恢复

```text
isolatedStopped=true
databaseClosed=true
clipboardRestored=true
formalRestart.ok=true
cleanup=true
```

隔离数据库已关闭，原剪贴板已恢复，正式 ClipHub 已使用随机令牌控制端点重新启动，隔离目录已删除。

## 环境

```text
Android pid=3285
uid=1000
taskThread=DefaultDispatcher-worker-7
clipboardCallbackThread=main
runtime=/data/system/shortx_OYdazjKnxMzhQykL/ClipHub
isolatedRuntime=/data/system/shortx_OYdazjKnxMzhQykL/ClipHubProbe006
```
