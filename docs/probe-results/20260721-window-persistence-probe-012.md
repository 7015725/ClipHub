# ClipHub 窗口位置与旋转探测 012 结果

## 结论

探测 012 全部通过，阶段 2B 的窗口位置持久化和方向/尺寸变化适配已完成真机验证。

```text
ok=true
probeVersion=1
moduleSetVersion=20260721.11
durationMs=7547
```

## 位置持久化

首次隔离启动时：

```text
defaultPositionNull=true
observersRegistered=true
firstAttached=true
```

程序将窗口设置到安全区中的目标比例：

```text
xRatio=0.2697947214076246
yRatio=0.6196461824953445
```

设置成功写入 SQLite：

```text
positionPersisted=true
```

停止并使用同一隔离数据库重新启动后：

```text
restoredPixelMatch=true
restoredRatioMatch=true
```

恢复坐标与停止前完全一致：

```text
x=92
y=1471
```

## 横屏适配

竖屏安全区域：

```text
left=0
top=140
right=1264
bottom=2780
```

旋转后的横屏安全区域：

```text
left=140
top=123
right=2780
bottom=1264
```

旋转等待约 6675 ms，配置和显示回调均到达：

```text
rotationDetected=true
callbackObserved=true
boundsRefreshObserved=true
configurationChangeCount=1
displayChangeCount=3
boundsRefreshCount=3
```

窗口在 Android `main` 线程重新布局，位置比例保持：

```text
rotatedInsideBounds=true
rotatedRatioPreserved=true
updateThreadName=main
xRatio=0.26965637740244613
yRatio=0.6194144838212635
```

## 清理

```text
detachedAfterClose=true
appStopped=true
databaseClosed=true
formalRestart.ok=true
cleanup=true
error=null
```

正式数据库未被探测位置修改，隔离目录已删除。
