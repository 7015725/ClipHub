# ClipHub 中文关键词搜索边界探测 024 结果

## 结论

探测 024 v1 全部通过。中文关键词在 SQLite、Repository、Filter 和 List 各层均能正确命中。

```text
ok=true
probeVersion=1
moduleSetVersion=20260722.19
error=null
```

## 核心结果

```text
storedChineseVisible=true
rawLikeNoEscapeCount=1
rawLikeEscapeCount=1
rawInstrCount=1
repositoryChineseCount=1
repositoryChineseIdMatched=true
repositoryChineseTokenCount=1
filterChineseCount=1
listChineseRenderedCount=1
filterChineseCriteriaMatched=true
```

ASCII 正文、来源名称及筛选对照也全部通过：

```text
repositoryAsciiContentCount=1
repositoryAsciiSourceCount=1
filterAsciiCount=1
listAsciiRenderedCount=1
filterResetCount=3
listResetRenderedCount=3
```

## 判断

023 v2 中“筛选摘要与单条结果”场景的零结果不是产品搜索缺陷，而是视觉轮播场景建立后的瞬时时序问题。

不修改 Repository 查询实现，也不改变 SQLite `LIKE ... ESCAPE` 条件。

## 资源边界

```text
formalControl.ok=true
formalControl.ack.threadName=main
clipboardListenerStopped=true
firstDatabaseClosed=true
formalRestart.ok=true
cleanup=true
```

## 输出文件

```text
/data/system/shortx_OYdazjKnxMzhQykL/ClipHub/probes/
cliphub_unicode_search_probe_024_20260722-023140-176.json
```
