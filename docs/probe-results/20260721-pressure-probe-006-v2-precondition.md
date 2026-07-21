# ClipHub 压力探测 006 v2 前置条件未满足记录

## 结果

本次 006 v2 返回：

```text
ok=false
probeVersion=2
durationMs=35
formalInitiallyRunning=false
formalEndpointPresent=false
formalAckReceived=false
formalStopped=true
formalLockReleased=true
isolatedStart=null
clipboardRestored=true
cleanup=true
error=Formal ClipHub was not running before probe 006
```

## 判断

006 v2 的控制实现没有进入广播投递阶段，因为执行时正式 ClipHub 没有持有正式文件锁。

因此本次没有执行：

- 隔离实例启动；
- 100 条连续复制；
- 多 item、空白、URI 和超长 ClipData 测试。

原剪贴板已恢复，隔离目录已清理。

## 版本证据

006 最后的 `formalRestart` 成功启动了正式实例，但返回结果中没有模块集 `20260721.7` 的：

```text
controlTransport=dynamic_broadcast_token
controlEndpointPath=...
```

这说明 ShortX 运行目录中的已安装模块仍是旧模块集。新的 006 v2 文件来自仓库，但设备重启后没有先通过入口完成模块集 `20260721.7` 同步。

## 正确复测顺序

1. 重启设备，释放 006 最后启动的旧正式实例；
2. 执行 ShortX 中的完整 `ClipHub.js` 入口；
3. 确认入口返回：

```text
moduleSetVersion=20260721.7
controlTransport=dynamic_broadcast_token
controlEndpointPath=<ShortX 私有目录>/ClipHub/cache/control_endpoint.json
```

4. 不再执行其他停止或入口任务；
5. 立即执行 006 v2。

## 边界

不得通过删除 `cliphub.lock` 绕过旧实例。旧实例仍持锁时删除该文件可能使新旧实例分别锁定不同 inode。
