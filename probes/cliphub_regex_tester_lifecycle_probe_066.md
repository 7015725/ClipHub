# ClipHub Regex Probe 066：Tester 生命周期 / 迟到 Callback

> **门禁级别：Android / ShortX / Rhino ES5 实机 UI Probe。静态脚本只做 API smoke，不得将本 Probe 标记为 PASS。**

## 前置条件

- 使用 `beta-regex-filter-20260813`。
- Settings `MODULE_VERSION >= 26`。
- 准备一个可编辑 Regex 规则；不要保存测试过程中用于验证 Draft 的 Pattern B。
- 记录进入 Tester 前后的 `Settings.getState()`，至少关注 `settingsPage`、`regexTestRunning`、`renderCount`、测试结果相关字段。

## 主场景：迟到 Callback 不得污染 Editor

1. 打开 Settings → Regex Rules → Regex Editor。
2. 输入 **Pattern A**。
3. 进入 Regex Tester。
4. 使用足够大的手动文本启动测试 A，使任务有机会跨页面返回；确认测试进入 running 状态。
5. **立即系统返回**到 Regex Editor。
6. 把 Pattern 改成 **Pattern B**，但不要保存。
7. 记录此时 `renderCount` 与 Pattern B 文本。
8. 等待超过测试 A 正常返回所需时间，再读取页面和状态。

## 必须断言

- `settingsPage === "regex_editor"`。
- Editor 中 Pattern 仍为 **B**，未被旧 Draft / Tester 重建覆盖。
- 旧测试 A 的 callback 不得使 `renderCount` 再增加。
- `regexTestRunning === false`。
- 旧 generation 不得写入测试结果、错误状态或重新 `buildPage()`。
- 无崩溃、无悬空 Tester 页面。
- 随后的系统返回优先级保持原逻辑。
- IME 收起与窗口恢复保持原行为。

## Cancellation 调用点覆盖

分别重复一次正在运行的测试，并从下列路径离开 Tester：

1. `regex_test → regex_editor` 的 managed back。
2. `setSettingsPage()` 从 `regex_test` 切到其它页。
3. 关闭 Settings / `closePage()`。
4. Settings `shutdown()`。
5. 在 Tester 内启动新的测试 B，覆盖旧测试 A。

每条路径都必须满足：旧 generation 永久 stale，不得在目标页面执行旧 callback 的 UI rebuild。

## PASS 记录

只有以上主场景和 5 条 cancellation 路径全部在实机完成，且所有断言成立，才能记录 **Probe 066 PASS**。任何步骤未执行只能记 **NOT RUN**。
