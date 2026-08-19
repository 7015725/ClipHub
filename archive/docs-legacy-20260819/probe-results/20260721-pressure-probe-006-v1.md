# ClipHub 压力探测 006 v1 结果

## 环境

```text
日期：2026-07-21
Android：14 / SDK 34
进程：system_server
uid：1000
模块集：20260721.6
探测版本：1
```

## 结果

006 v1 在进入压力测试前停止：

```text
formalInitiallyRunning=true
formalAckReceived=false
formalStopped=false
formalLockReleased=false
error=Control acknowledgement not received
```

正式文件锁始终被持有，隔离实例没有启动，100 条复制和异常 ClipData 测试均未执行。原剪贴板未被压力测试内容修改，正式实例保持运行。

## 根因

模块集 `20260721.6` 使用固定 action 和 `RECEIVER_NOT_EXPORTED` 动态接收器，并通过 `Intent.setPackage()` 尝试限制投递。

两个 ShortX 任务虽然同属 `system_server` 和 uid 1000，但 Android 广播框架没有可靠地把它们判定为同一个应用身份，导致停止广播未投递到动态接收器。

## 修复

模块集 `20260721.7` 改为：

- 每次正式实例启动生成 192-bit 随机令牌；
- action 由固定前缀和随机令牌组成；
- 私有端点写入 `ClipHub/cache/control_endpoint.json`；
- Android 13+ 动态接收器使用 `RECEIVER_EXPORTED`；
- 广播必须同时匹配随机 action、令牌、运行目录和 stop 命令；
- 停止时删除端点文件；
- 仍通过 requestId 确认文件验证停止、主线程和锁释放；
- 探测报告不输出令牌。

006 升级为 v2，从私有端点读取本次随机 action 和令牌，不再设置广播 package。

## 升级边界

当前运行中的 `20260721.6` 没有可用控制路径，无法由另一个 ShortX 任务安全停止。需要重启设备一次，然后执行入口同步到 `20260721.7`。

不得删除正在被持有的 `cliphub.lock` 文件。
