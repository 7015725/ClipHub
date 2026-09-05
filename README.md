# ClipHub

ClipHub 是运行在 Android / ShortX 上的全局剪贴板悬浮工具，使用 Rhino ES5 和 Android SDK 原生 View 构建，不依赖 WebView。

当前正式版提供剪贴板历史、搜索筛选、标签与排序、分页、编辑、百度/有道/Google 翻译、普通分词与正则精确分词，并通过单 Primary Window 页面栈统一系统 Back、侧滑返回、Predictive Back 与 IME First Back。

## 当前正式基线

| 项目 | 当前值 |
| --- | --- |
| 正式分支 | `main` |
| 模块集版本 | `20260819.08` |
| 入口最低版本 | `8` |
| Manifest Schema | `2` |
| 运行模块数量 | `20` |
| 主数据库 Schema | `2` |
| 正则筛选 Feature Schema | `1` |
| 控制端点 Schema | `3` |
| 生产资源数量 | `0` |

模块集合、Export、SHA、runtimeRole 和生命周期以根目录 `module-manifest.json` 为唯一机器可读事实源。

## `20260819.08` 更新重点

### 分词与正则规则

- 首页长按剪贴板词条或从编辑页进入分词页面；
- 支持普通分词和正则精确分词；
- 词块支持点击、拖动、长按选择，并可复制、输入或编辑；
- 长 URL、长邮箱和连续长文本按内容自适应高度并完整换行；
- 正则模式完整保留命中和未命中文本，成功结果必须 100% 还原原文；
- 支持独立的分词规则管理、预制规则覆盖和临时正则最高优先级；
- 高级筛选正则规则与分词规则独立存储。

### 翻译

- 翻译模式支持百度、有道和 Google；
- Google 模式通过 Android Intent 发送完整文本；
- Google 翻译成功启动后自动隐藏 ClipHub UI；
- 未安装、空文本或 Intent 启动失败时保留 ClipHub 并显示提示。

### 导航与稳定性

- 新增 `PageRegistry`、`PageStack`、`Navigator`、`BackDispatcher` 和 `UIShell`；
- 统一 Toolbar Back、页面返回、系统 Back、侧滑、Legacy Back 和 Predictive Back；
- IME 页面第一次 Back 只隐藏输入法，第二次 Back 才返回上一页；
- 修复词块编辑页跨层返回，以及回首页后无法再次长按进入分词的问题；
- 增加 `VisibilityIntentGuard`，避免旧页面、延迟回调和重复 hook 在隐藏后重新 attach。

完整说明：

- [面向用户的更新说明](docs/ClipHub_20260819.08用户版更新说明.md)
- [详细技术更新记录](docs/ClipHub_20260819.08正式版详细更新说明.md)
- [真机回归清单](docs/ClipHub_main合并前真机回归清单_20260819.md)

## 主要功能

### 剪贴板管理

- 全局监听和保存剪贴板历史；
- 置顶、编辑、新增、删除、拖动排序和标签管理；
- 搜索、来源/类型/标签筛选、敏感内容筛选和正则高级筛选；
- AJAX 追加、数字分页、懒加载、预加载和虚拟数据窗口；
- 首页长正文可只读取预览，最终操作按需获取完整正文。

### 首页多选操作（修复分支新增）

1. 点搜索按钮右侧的多选入口，再点词条或左侧圆形选择框勾选。顶部切换为“已选择 X 项”和复制、合并、删除、更多操作。
2. **复制**按当前列表顺序复制完整正文，记录之间换行；**合并**在确认后保存合并内容，记录之间空一行，原记录保留，相同内容沿用去重规则。
3. **删除**先核对数量并确认，删除后可在提示条中于 5 秒内撤销整批。写入失败时整批回滚。
4. **更多**提供“全选已加载”和“清空选择”。每批最多 100 条，超过时选择已加载列表前 100 条；新到达的记录由用户另行勾选。
5. 返回键逐层收起确认或更多操作，再退出多选。修改筛选、数字翻页、进入其他页面或关闭窗口会清空选择。

首页结构、卡片高度和右侧单项快捷按钮保持原样。多选时点正文切换选择，长按继续进入分词；编辑、翻译等操作沿用原有页面流程。批量复制与合并沿用敏感内容标记。

修复了因入库结果未校验导致保存失败仍提示成功的问题。

### 文本分词

- 普通分词适合快速选择中文、英文单词、数字和符号；
- 正则精确分词只按当前启用规则和临时正则的最终匹配区间切割；
- 所有未命中内容连续保留，不调用普通分词器，不丢弃空白；
- 重叠区间按“优先级 → 更长匹配 → 规则稳定顺序”裁决；
- 临时正则固定最高优先级；
- 无效正则和零宽匹配显示非阻断警告；超限或还原失败整次阻断。

### 页面与窗口

- Primary Window 单窗口页面宿主；
- 声明式 Page Contract 和统一 Page Registry；
- 系统 Back、侧滑、Predictive Back、Toolbar Back 与 IME First Back；
- 悬浮窗位置、尺寸、主题、输入法避让和安全关闭；
- 隐藏 UI 不停止剪贴板监听、数据库和后台实例。

## 正则精确分词规则

1. 当前已勾选的分词规则和临时正则共同参与；
2. 临时正则固定最高优先级；
3. 每次命中使用完整匹配区间；
4. 所有命中内容独立成块，所有未命中内容按原文位置连续保留；
5. 非空文本无命中时，整段原文作为一个未命中词块；
6. 空格、换行和制表符显示可见占位符，但复制和输入保留真实字符；
7. 成功结果必须逐字符还原原文，否则清空结果并显示阻断错误。

## 正式入口

| 用途 | 文件 |
| --- | --- |
| 后台入口 | `ClipHub.js` |
| 全局剪贴板开关 | `tasks/ClipHub_全局剪贴板开关.js` |
| 模块清单 | `module-manifest.json` |

正式用户不需要独立“打开”或“状态查询”任务。状态由后台控制端点内部提供，用户入口保持单一开关。

## 数据与兼容边界

- 主数据库 Schema 保持为 2，不因当前 UI/分词更新清空现有剪贴板、标签和分页数据；
- 高级筛选正则规则使用独立 `regex_rules` 功能表；
- 分词规则保存在独立规则状态中，不写入剪贴板主表；
- 保持 Rhino ES5：运行模块不使用 `let`、`const`、箭头函数、`class` 或模板字符串；
- Google 模式要求设备存在可处理对应文本 Intent 的 Google 翻译；
- Predictive Back 真机可用性取决于 Android 与 ShortX 宿主能力，不可用时继续使用兼容 Back 链。

## 架构与开发约束

- 页面定义唯一来源：`PageRegistry`；
- 页面历史唯一来源：`PageStack`；
- 业务导航唯一入口：`Navigator`；
- Back 决策唯一入口：`BackDispatcher`；
- 新增普通页面只注册 factory、parent 和 PageContract，不修改导航核心；
- 模块 export、运行角色和生命周期顺序以 Manifest Schema 2 为准；
- ColorOS/Rhino 颜色调用必须经过 Theme 安全桥。

当前规范：

- [产品需求](docs/产品需求.md)
- [交互规范](docs/交互规范.md)
- [技术架构](docs/技术架构.md)
- [模块规范](docs/模块规范.md)
- [ShortX UI Navigation Contract v2](docs/ShortX_UI_Navigation_Contract_v2.md)
- [ColorOS / Rhino 颜色安全规范](docs/ColorOS_Rhino颜色安全规范.md)
- [当前开发计划](docs/开发计划.md)
- [文档维护规范](docs/文档维护规范.md)
- [可复用页面导航模板](docs/templates/ShortX_Page_Navigation_Template_ES5.js)

## 自动化验证

正式发布预检：

```bash
bash scripts/release_preflight.sh --main
```

发布门禁覆盖 Rhino ES5、Manifest contract、ColorOS 颜色安全、Navigation、Tokenizer、Translation 等回归。自动化结果不替代 Android 14 / ColorOS / ShortX 真机验证。

## 历史资料

阶段实施文档、分页 Stage、Probe 结果、旧 UI 收口记录、旧版本说明和一次性诊断资产不再放在当前 `docs/` 根目录，统一保存在 `archive/`。

- [2026-08-19 清理前完整 docs 快照](archive/docs-legacy-20260819/)
- [历史分页 stage-assets](archive/pagination-stage-assets-legacy/)
- [历史诊断输出](archive/diagnostics-legacy-20260819/)

历史文档只用于追溯，不作为新开发默认事实源。
