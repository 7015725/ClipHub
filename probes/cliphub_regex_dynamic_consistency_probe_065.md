# ClipHub Regex Probe 065：扫描期间动态数据一致性

> **门禁级别：必须在 Android / ShortX / Rhino ES5 实机执行。静态 CI 不得将本 Probe 标记为 PASS。**

## 前置条件
- 构造 1000～1500 条候选数据。
- 启动 Regex generation A，并等待 `running === true`、`scanned >= 128`、`complete === false`。
- 若无法进入上述状态，本 Probe 直接 FAIL，不得跳过 mutation 阶段。

## 运行中 mutation 顺序
1. 已 MATCH → 编辑为 NONMATCH。
2. 已 NONMATCH → 编辑为 MATCH。
3. 删除已 MATCH。
4. 新增 MATCH。
5. 修改 source package，使记录离开当前 source 条件。
6. 修改 tag，使记录进入/离开当前 tag 条件。
7. 修改 pinned 状态。
8. 修改 sensitive 状态。

每次 mutation 后必须确认：旧 generation 不再发布；新 generation 单调递增。

## 最终断言
- `matchedIds` 与数据库最新状态重新计算结果完全一致。
- 无重复 id、无已删除 id、无旧内容匹配残留。
- `pagination.totalCount === matchedIds.length`。
- number 模式 `pageCount` 正确。
- AJAX 模式 `hasMore` 正确。

## Cache 二次验证
扫描完成且已有 Cache 后，再修改已有 `id <= maxItemId` 的记录并重新打开同一筛选：不得命中陈旧结果，必须失效并重启 generation，最终结果必须反映最新数据库状态。

## PASS 记录
只有实机执行完全部步骤后才能记录 `Probe 065 PASS`。任何一步未执行、无法观察 generation 或无法与数据库最新状态核对，都必须记为 **NOT RUN / FAIL**，不得记 PASS。
