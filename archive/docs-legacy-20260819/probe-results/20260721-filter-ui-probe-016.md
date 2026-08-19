# ClipHub 搜索与筛选界面探测 016 结果

## 结论

探测 016 v1 全部通过。

```text
ok=true
moduleSetVersion=20260721.15
durationMs=730
```

## 已验证

- 主列表筛选入口存在且原生点击成功；
- 独立筛选面板真实附着；
- 面板为可聚焦窗口，不含 `FLAG_NOT_FOCUSABLE`；
- 原生 EditText 创建、获取焦点并请求输入法；
- 关键词 `alpha` 得到 4 条结果；
- 来源芯片缩小到 2 条；
- 类型芯片形成 1 条组合结果；
- 主列表筛选条件摘要同步；
- 重置后恢复全部 6 条记录；
- 关闭按钮在 Android `main` 线程移除面板；
- 面板支持二次打开；
- App.stop 自动清理仍打开的筛选面板；
- 重启后筛选条件清空、面板关闭并显示全部记录；
- 数据库、窗口、文件锁和隔离目录均完整清理。

## 关键结果

```text
panelWindowType=2038
panelAddThreadName=main
panelRemoveThreadName=main
inputPresent=true
inputFocused=true
keyboardRequested=true
searchCount=4
sourceFilteredCount=2
combinedFilteredCount=1
filterResetAfterRestart=true
panelClosedAfterRestart=true
renderedAllAfterRestart=true
formalRestart.ok=true
cleanup=true
error=null
```

## 输出文件

```text
/data/system/shortx_OYdazjKnxMzhQykL/ClipHub/probes/
cliphub_filter_ui_probe_016_20260721-224515-700.json
```
