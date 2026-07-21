# ClipHub 详情与列表操作区回归探测 027 结果

## 结论

```text
ok=true
probeVersion=1
moduleSetVersion=20260722.21
schemaVersion=2
error=null
```

阶段 3D1 第二部分的功能、触控与生命周期回归全部通过。

## 列表结构

```text
seededCount=4
initialRenderedCount=4
metaRowsPresent=true
actionRowsPresent=true
allCardActionsPresent=true
reorderHandlesPresent=true
tagLabelPresent=true
sensitiveMaskPresent=true
```

每张卡片均生成独立元数据行和操作行，标签摘要、敏感遮罩、长文本详情入口和排序手柄均存在。

## 卡片操作

```text
cardClickWorked=true
cardCopyCaptured=true
databaseStableAfterCopy=true

tagButtonWorked=true
tagEditorOpened=true
tagEditorTargetMatched=true

editButtonWorked=true
editEditorOpened=true
editEditorTargetMatched=true

pinButtonWorked=true
pinStored=true

deleteButtonWorked=true
deleteStored=true
undoAvailable=true
undoWorked=true
undoRestored=true
```

原有复制、标签、编辑、置顶、删除和撤销行为没有回归。

## 排序边界

```text
reorderTouchWorked=true
reorderCommitted=true
reorderThreadMain=true
windowDragUnchanged=true
```

排序仍由独立手柄启动，并未移动主悬浮窗。

## 详情窗口

```text
regularDetailOpened=true
regularDetailAttached=true
detailModal=true
detailOpaque=true
detailDimFlagPresent=true
detailDimAmount=0.7200000286102295
detailNotTouchModalAbsent=true
detailMainWindowHidden=true
mainWindowDetachedDuringDetail=true
detailButtonsPresent=true
detailWindowType=2038
detailAddThreadMain=true
```

详情打开时主列表 Window 确实被临时隐藏，详情使用不透明模态结构和单一关闭入口。

## 详情操作与恢复

```text
detailCopyWorked=true
regularDetailCopyCaptured=true
detailStayedOpenAfterCopy=true
detailCloseWorked=true
detailClosed=true
mainListRestoredAfterDetail=true
listRenderedAfterDetailClose=true
detailRestoreCountPositive=true

sensitiveDetailOpened=true
sensitiveDetailFlag=true
sensitiveDetailCopyWorked=true
sensitiveCopyCaptured=true

detailEditWorked=true
detailClosedForEdit=true
editorOpenedFromDetail=true
editorTargetFromDetailMatched=true
mainListRestoredBehindEditor=true
```

普通与敏感内容复制正常；关闭详情和从详情进入编辑时均正确恢复列表。

## 停止与重启

```text
detailReopenedBeforeStop=true
eventsNoContent=true
firstStopped=true
detailCleanupOnStop=true
firstDatabaseClosed=true

recordsPersistedAfterRestart=true
pinPersistedAfterRestart=true
detailClosedAfterRestart=true
editorClosedAfterRestart=true
metaRowsAfterRestart=true
actionRowsAfterRestart=true
buttonsAfterRestart=true
handlesAfterRestart=true
secondDatabaseClosed=true
formalRestart.ok=true
cleanup=true
```

App.stop 能清理仍打开的详情，事件不包含正文，状态跨重启保持。

## 输出文件

```text
/data/system/shortx_OYdazjKnxMzhQykL/ClipHub/probes/
cliphub_list_detail_visual_probe_027_20260722-034803-207.json
```
