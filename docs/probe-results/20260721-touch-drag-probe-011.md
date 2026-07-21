# ClipHub 真实手指拖动探测 011 结果

## 结论

探测通过：

```text
ok=true
probeVersion=1
moduleSetVersion=20260721.10
durationMs=3387
attachedToWindow=true
attachWaitMs=26
userDragDetected=true
interactionWaitMs=2410
dragMoveCount=56
positionChanged=true
finalInsideBounds=true
updateThreadName=main
detachedAfterClose=true
removeThreadName=main
appStopped=true
databaseClosed=true
formalRestart.ok=true
cleanup=true
error=null
```

## 关键观察

- 初始位置：`x=286, y=361`；
- 探测首次观察到有效拖动时：`x=264, y=366`；
- 手指完整拖动结束并关闭前：`x=151, y=873`；
- 标题栏真实触摸共产生 56 次 WindowManager 更新；
- 所有更新均运行在 Android `main` 线程；
- 最终坐标仍位于系统栏和刘海安全区域内；
- WindowManager View、隔离数据库和运行目录均已清理；
- 正式 ClipHub 实例已恢复。

## 判断

`ch_08_window.js` 的标题栏触摸监听、拖动阈值、raw 坐标换算、安全区夹紧和主线程 `updateViewLayout()` 路径均已通过真实手指操作验证。

阶段 2A 的 WindowManager 生命周期与真实拖动验证完成。下一阶段为窗口位置持久化，以及屏幕方向和尺寸变化后的比例恢复与重新夹紧。
