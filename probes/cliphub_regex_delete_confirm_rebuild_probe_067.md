# ClipHub Regex Probe 067：删除确认与 View 重建边界

> **门禁级别：Android / ShortX 实机 UI Probe。静态 smoke 不得将本 Probe 标记为 PASS。**

## A. 同一可见 View 内二次点击仍可删除

1. 新建一条仅用于 Probe 的 Regex 规则，并记录其 id。
2. 在当前 `regex_rules` 页面第一次点击“删除”。
3. 确认按钮文字变为“确认删除”，数据库中的该 id 仍存在。
4. **不触发任何页面 rebuild**，在同一 View 第二次点击。
5. 断言该规则被删除且 `regexDeleteConfirmCount` 只在第一次确认阶段增加。

## B. 任意规则页重建都必须使确认失效

对每一种 rebuild 路径分别创建新的临时规则并执行：

1. 第一次点击“删除”，进入“确认删除”状态。
2. 触发一种 rebuild：
   - enable/disable toggle；
   - reorder/move；
   - 打开 Editor 后返回 Rules；
   - 离开 `regex_rules` 再重新进入；
   - 关闭 Settings 后重新打开。
3. 回到新的 `regex_rules` View 后，按钮必须恢复普通“删除”。
4. 此时第一次点击只能重新进入“确认删除”，**不得直接删除**。
5. 查询数据库确认该 id 仍存在。
6. 只有在该新 View 上再次点击才允许真正删除。

## C. 生命周期边界

- 离开 `regex_rules` 的 managed back 必须清空 pending confirm。
- `openRegexEditor()`、`moveRegexRule()`、`toggleRegexRuleEnabledFromSettings()` 必须清空。
- `closePage()` 与 Settings `shutdown()` 必须清空。
- 删除确认状态不得写入 SQLite、settings、EventBus 或其它持久化状态。

## PASS 记录

A、B 的全部 rebuild 路径和 C 的生命周期检查全部通过后，才能记录 **Probe 067 PASS**。未在真实 View 生命周期执行时只能记 **NOT RUN**。
