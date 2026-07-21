# ClipHub 标签管理与标签过滤探测 018 结果

## 结论

探测 018 v2 全部通过。

```text
ok=true
probeVersion=2
moduleSetVersion=20260721.17
schemaVersion=2
durationMs=4165
error=null
```

## 已验证

- 正式实例通过动态广播在 Android `main` 线程停止；
- 隔离实例正常启动，数据库继续使用 schema v2；
- 三条隔离记录正常写入并显示；
- 每张历史卡片均存在标签入口；
- 标签管理窗口真实附着、可聚焦并请求系统输入法；
- 标签创建后自动绑定当前记录；
- 标签名称首尾空格、大小写归一化去重正常；
- 标签重命名正常；
- 临时标签删除后记录数量保持不变；
- 主列表标签摘要正常显示；
- `tags_changed` 事件不包含剪贴板正文，事件线程为 `main`；
- 多标签查询采用 OR，结果数为 2；
- 标签筛选芯片正常渲染；
- 单标签筛选结果数为 2；
- 关键词与标签组合采用 AND，结果数为 1；
- 主列表筛选摘要包含标签条件；
- 重置筛选恢复全部记录；
- 活动标签筛选下解绑记录后，结果自动重新应用并从 2 条减少到 1 条；
- App.stop 自动移除标签编辑窗口；
- 数据库完整关闭；
- 标签、重命名结果和绑定关系跨重启持久化；
- 已删除标签重启后没有恢复；
- 删除标签没有影响原剪贴板记录；
- 筛选状态和编辑窗口重启后清空；
- 重启后标签摘要仍正常显示；
- 正式实例恢复成功，隔离目录清理成功。

## 关键结果

```text
workCreated=true
workAutoAttached=true
referenceCreated=true
referenceRenamed=true
duplicateNormalized=true
workAttachedSecond=true
tempCreated=true
tempDeleted=true
itemCountUnaffectedByTagDelete=true
tagLabelsRendered=true
tagEventsNoContent=true
tagEventThreadName=main
tagOrFilterCount=2
tagFilterCount=2
keywordAndTagCount=1
filterReappliedAfterDetach=true
filteredCountAfterDetach=1
tagsPersistedAfterRestart=true
renamedTagPersisted=true
bindingsPersistedAfterRestart=true
deletedTagStayedDeleted=true
recordsUnaffectedAfterRestart=true
formalRestart.ok=true
cleanup=true
```

## 输出文件

```text
/data/system/shortx_OYdazjKnxMzhQykL/ClipHub/probes/
cliphub_tag_probe_018_20260722-001358-379.json
```

## 阶段结论

阶段 3C2 已完成：

```text
自定义标签
标签绑定与解绑
标签重命名与删除
列表标签摘要
标签过滤
关键词与标签组合查询
标签事件脱敏
标签状态跨重启持久化
```
