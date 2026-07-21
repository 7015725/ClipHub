# ClipHub 新增、编辑与置顶探测 017 结果

## 结论

探测 017 v1 全部通过。

```text
ok=true
moduleSetVersion=20260721.16
durationMs=952
error=null
```

## 已验证

- 主列表新增、编辑和置顶控件存在；
- 编辑窗口为可聚焦 `TYPE_APPLICATION_OVERLAY`；
- 原生多行 EditText 获取焦点并请求输入法；
- 手动新增记录成功写入 SQLite；
- 编辑正文后哈希与列表同步更新；
- 置顶状态写入数据库并移动到首位；
- 活动筛选在编辑后自动重新应用；
- 取消编辑不会插入记录；
- 新增、编辑和置顶事件不包含正文；
- App.stop 自动移除仍打开的编辑窗口；
- 新增正文、最终编辑内容和置顶状态跨重启保持；
- 正式实例、数据库和隔离目录完整恢复。

## 输出文件

```text
/data/system/shortx_OYdazjKnxMzhQykL/ClipHub/probes/
cliphub_editor_pin_probe_017_20260721-231041-614.json
```
