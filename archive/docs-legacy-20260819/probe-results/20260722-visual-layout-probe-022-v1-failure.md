# ClipHub 统一视觉与自适应布局探测 022 v1 失败记录

## 结论

022 v1 未进入视觉与布局验证阶段，失败原因是探测脚本调用了不存在的 Repository API：

```text
TypeError: Cannot find function createTag in object [object Object].
```

当前 Repository 公开接口为 `ensureTag(name)`，并直接返回数字标签 ID。

该问题仅影响探测脚本，不影响模块集 `20260722.19` 或生产功能。

## 现场恢复

```text
formalControl.ok=true
formalControl.ack.threadName=main
firstStart.ok=true
schemaVersion=2
formalRestart.ok=true
cleanup=true
```

隔离实例已停止，正式实例已恢复，隔离目录已删除。

## 修正

022 v2 已完成以下修改：

```text
probeVersion: 1 -> 2
Repository.createTag(name) -> Repository.ensureTag(name)
attachTag(itemId, tag.id) -> attachTag(itemId, tagId)
```

生产模块和 manifest 均未修改。

## v1 输出文件

```text
/data/system/shortx_OYdazjKnxMzhQykL/ClipHub/probes/
cliphub_visual_layout_probe_022_20260722-015341-135.json
```
