# ClipHub 拖动排序与触控隔离探测 020 结果

## 结论

探测 020 v1 全部通过。

```text
ok=true
moduleSetVersion=20260722.19
durationMs=845
error=null
```

## 已验证

- 初始两条置顶、四条普通记录的分组顺序正确；
- 六个独立排序手柄正常渲染；
- 合成 `MotionEvent` 真实经过手柄 `OnTouchListener`；
- 普通分组排序成功并事务化规范 `manual_order`；
- 普通组排序不影响置顶组；
- 排序事件在主线程发出且不包含正文；
- 手柄排序不会增加主窗口 `dragMoveCount`；
- 卡片单击复制行为保持正常；
- 置顶组 API 排序成功；
- 跨置顶分组排序被拒绝且数据库顺序不变；
- 筛选状态隐藏手柄并拒绝排序；
- 新记录以 `manual_order=0` 进入普通组前方；
- 普通组与置顶组顺序跨重启保持；
- 正式实例、数据库和隔离目录完整恢复。

## 关键结果

```text
schemaVersion=2
seededCount=6
initialOrderMatched=true
reorderEnabled=true
reorderHandleCount=6
syntheticDragPerformed=true
normalOrderChanged=true
normalManualOrderNormalized=true
pinnedGroupUnchangedAfterNormalDrag=true
dragStartObserved=true
dragMoveObserved=true
dragCommitObserved=true
reorderThreadName=main
reorderEventMatched=true
reorderEventsNoContent=true
windowDragUnchanged=true
cardClickPreserved=true
cardCopyCaptured=true
cardCopyThreadName=main
pinnedApiReorderWorked=true
pinnedOrderChanged=true
pinnedManualOrderNormalized=true
crossGroupRejected=true
crossGroupOrderUnchanged=true
filterApplied=true
filteredHandlesHidden=true
filteredReorderRejected=true
filteredOrderUnchanged=true
resetRestoredAll=true
newItemInserted=true
newItemAtGroupFront=true
normalOrderPersistedAfterRestart=true
pinnedOrderPersistedAfterRestart=true
filterResetAfterRestart=true
handlesAfterRestart=true
mainWindowDragStillZero=true
formalRestart.ok=true
cleanup=true
```

## 输出文件

```text
/data/system/shortx_OYdazjKnxMzhQykL/ClipHub/probes/
cliphub_reorder_probe_020_20260722-012728-405.json
```
