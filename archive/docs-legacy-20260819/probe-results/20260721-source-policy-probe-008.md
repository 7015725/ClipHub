# ClipHub 来源持久化与敏感策略探测 008 结果

## 结论

探测 008 全部通过。

```text
ok=true
probeVersion=1
durationMs=415
moduleSetVersion=20260721.8
schemaVersion=2
migratedFromV1=true
sensitiveColumnPresent=true
sourceInserted=true
sourcePackage=android
sourceLabel=Android 系统
sourceUid=1000
sourceConfidence=100
normalSensitiveFlag=0
sensitiveDefaultSkipped=true
sensitiveSkipReason=sensitive_clip
sensitiveSavedWhenAllowed=true
savedSensitiveFlag=1
ignoredPackageSkipped=true
ignoredPackageReason=ignored_source_package
sourceReadCount=8
sourceErrorCount=0
sensitiveIgnoredCount=2
ignoredPackageCount=2
callbackThreadName=main
errorCount=0
isolatedStopped=true
databaseClosed=true
clipboardRestored=true
originalSourceRestoredExact=true
formalRestart.ok=true
cleanup=true
error=null
```

## 已验证能力

- 正式实例可通过随机令牌控制端点跨 ShortX 任务停止；
- schema v1 隔离数据库可事务迁移到 schema v2；
- `is_sensitive` 字段和索引存在；
- 普通剪贴板来源包名、应用名、UID 和置信度正确入库；
- 标准敏感 ClipData 在默认 `skip` 策略下不写入数据库；
- 切换为 `save` 策略后敏感内容写入且 `is_sensitive=1`；
- `ignorePackages` 命中来源包名时不写入数据库；
- 来源读取没有异常；
- ClipboardManager 回调在 Android `main` 线程执行；
- 隔离实例、数据库、剪贴板、来源和正式实例均正确恢复。

## 当前边界

- 策略配置仍为运行期内存值，尚未持久化到 `settings` 表；
- 历史数量和保存时长清理尚未实现；
- 忽略应用列表尚无 UI；
- 正式模块集为 `20260721.8`。
