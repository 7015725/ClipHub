# ClipHub 真实手指排序探测 021 结果

## 结论

探测 021 v1 全部通过，阶段 3C4 拖动排序已完成真实手指验证。

```text
ok=true
probeVersion=1
moduleSetVersion=20260722.19
durationMs=4118
interactionWaitMs=3042
error=null
```

## 已验证

- 三条隔离普通记录正常显示；
- 三个独立排序手柄存在；
- 真实手指拖动由 `lastReorderReason=drag` 识别；
- `reorderSyntheticCount=0`，未使用合成触控；
- 列表顺序从 `[3,2,1]` 调整为 `[2,1,3]`；
- Repository 与列表顺序一致；
- `manual_order` 已事务化规范；
- 排序开始、移动和提交事件均被观察到；
- 排序和事件均在主线程执行；
- 排序事件不包含剪贴板正文；
- 主悬浮窗 `dragMoveCount` 保持 0；
- 主窗口位置保持 `x=102, y=361`，未被卡片拖动带动；
- 排序后列表与主窗口继续附着；
- 排序顺序跨重启保持；
- 重启后排序手柄继续存在；
- 隔离数据库关闭、正式实例恢复、隔离目录清理完成。

## 关键结果

```text
schemaVersion=2
seededCount=3
listAttached=true
initialOrderMatched=true
reorderEnabled=true
reorderHandleCount=3
userDragDetected=true
orderChanged=true
repositoryOrderMatched=true
manualOrderNormalized=true
dragStartObserved=true
dragMoveObserved=true
dragCommitObserved=true
syntheticCountZero=true
reorderThreadName=main
lastReorderReason=drag
reorderEventObserved=true
reorderEventsNoContent=true
reorderEventThreadName=main
windowDragUnchanged=true
windowPositionUnchanged=true
windowStillAttached=true
listStillVisible=true
lastError=null
orderPersistedAfterRestart=true
renderedOrderPersisted=true
handlesAfterRestart=true
mainWindowDragStillZero=true
firstDatabaseClosed=true
secondDatabaseClosed=true
formalRestart.ok=true
cleanup=true
```

## 输出文件

```text
/data/system/shortx_OYdazjKnxMzhQykL/ClipHub/probes/
cliphub_real_reorder_probe_021_20260722-013908-392.json
```
