# ClipHub

ClipHub 是运行在 Android / ShortX 上的全局剪贴板悬浮窗，使用 Rhino ES5 和 Android SDK 原生 View 构建，不依赖 WebView。

它提供剪贴板历史、搜索筛选、标签、分页、编辑、翻译和分词，并通过单窗口页面栈统一系统 Back、侧滑返回、Predictive Back 与输入法优先返回。

## 当前正式版本

| 项目 | 当前值 |
| --- | --- |
| 正式分支 | `main` |
| 功能合并提交 | `97d334e` |
| 模块集版本 | `20260819.08` |
| 入口版本 | `8` |
| Manifest Schema | `2` |
| 运行模块数量 | `20` |
| 主数据库 Schema | `2` |
| 正则筛选 Feature Schema | `1` |
| 控制端点 Schema | `3` |
| 生产资源数量 | `0` |

## `20260819.08` 更新重点

### 分词与正则规则

- 首页长按剪贴板词条或从编辑页进入分词页面。
- 支持普通分词和正则精确分词。
- 词块支持点击、拖动和长按选择，并可复制、输入或编辑。
- 长 URL、长邮箱和连续长文本词块按内容自适应高度并完整换行。
- 正则模式完整保留命中和未命中文本；全部词块顺序拼接后可 100% 还原原文。
- 支持独立的分词规则管理、预制规则覆盖和临时正则最高优先级。
- 设置页提供高级筛选正则规则的列表、编辑和测试页面。

### 翻译

- 翻译模式新增 Google 翻译。
- Google 翻译成功启动后自动关闭 ClipHub UI。
- 未安装、空文本或 Intent 启动失败时保留 ClipHub 并显示提示。
- 百度和有道继续使用内置翻译结果页。

### 导航与稳定性

- 新增 `PageRegistry`、`PageStack`、`Navigator`、`BackDispatcher` 和 `UIShell`。
- 统一顶部返回、页面返回、系统 Back、侧滑返回、Legacy Back 和 Predictive Back。
- 输入法显示时，第一次 Back 只隐藏输入法，第二次 Back 才返回上一页。
- 修复词块编辑页侧滑直接返回首页，以及回到首页后无法再次长按进入分词页的问题。
- 增加显隐意图守卫，避免延迟回调、重复 hook、旧页面重新 attach 和窗口引用残留。

完整说明：

- [面向用户的更新说明](docs/ClipHub_20260819.08用户版更新说明.md)
- [详细技术更新记录](docs/ClipHub_20260819.08正式版详细更新说明.md)
- [真机回归清单](docs/ClipHub_main合并前真机回归清单_20260819.md)

## 主要功能

### 剪贴板管理

- 全局监听和保存剪贴板历史。
- 置顶、编辑、新增、删除、拖动排序和标签管理。
- 搜索、来源/类型/标签筛选、敏感内容筛选和正则高级筛选。
- AJAX 追加、数字分页、懒加载、预加载和虚拟数据窗口。
- 首页只读取长正文预览；复制、输入、编辑、翻译和分词按需读取完整正文。

### 文本分词

- 普通分词适合快速选择中文、英文单词和符号。
- 正则精确分词只按当前启用规则和临时正则的最终匹配区间切割。
- 所有未命中内容连续保留，不调用普通分词器，不丢弃空白或其他原文。
- 重叠区间按“优先级 → 更长匹配 → 规则稳定顺序”裁决。
- 无效正则和零宽匹配显示非阻断警告；超限或还原失败显示阻断错误。

### 翻译

- 支持百度、有道和 Google 翻译模式。
- 内置模式在 ClipHub 内显示翻译结果。
- Google 模式通过 Android `Intent` 发送完整文本到 Google 翻译。

### 页面与窗口

- Primary Window 单窗口页面宿主。
- 声明式 Page Contract 和统一页面 Registry。
- 系统 Back、侧滑、Predictive Back、Toolbar Back 与 IME First Back。
- 悬浮窗位置、尺寸、主题、输入法避让和安全关闭。

## 正则精确分词规则

1. 当前已勾选的分词规则和临时正则共同参与。
2. 临时正则固定为最高优先级。
3. 每次命中使用完整匹配区间。
4. 所有命中内容独立成块，所有未命中内容按原文位置连续保留。
5. 非空文本无命中时，整段原文作为一个未命中词块。
6. 空格、换行和制表符显示可见占位符，但复制和输入保留真实字符。
7. 成功结果必须逐字符还原原文，否则清空结果并显示错误。

分词规则与高级筛选规则使用独立存储，修改其中一类不会影响另一类。

## 正式入口

| 用途 | 文件 |
| --- | --- |
| 后台入口 | `ClipHub.js` |
| 全局剪贴板开关 | `tasks/ClipHub_全局剪贴板开关.js` |
| 状态查询 | `tasks/ClipHub_状态查询.js` |
| 模块清单 | `module-manifest.json` |

发布时必须同步入口与 manifest 声明的完整模块集合，不建议单独替换 `src/` 中的某个运行模块。

## 数据与兼容边界

- 主数据库 Schema 保持为 2，不清空或迁移现有剪贴板、标签和分页数据。
- 首次升级会创建正则高级筛选专用的 `regex_rules` 表及索引。
- 分词规则保存在独立规则状态中，不写入剪贴板主表。
- 保持 Rhino ES5：运行模块不使用 `let`、`const`、箭头函数、`class` 或模板字符串。
- Google 翻译模式要求设备已安装可处理文本 Intent 的 Google 翻译。
- Predictive Back 是否可由真机触发取决于 Android 与 ShortX 宿主能力；不可用时继续使用 Legacy Back。

## 架构与开发约束

- 页面定义唯一来源：`ClipHub.PageRegistry`。
- 页面历史唯一来源：`ClipHub.PageStack`。
- 业务导航唯一入口：`ClipHub.Navigator`。
- Back 决策唯一入口：`ClipHub.BackDispatcher`。
- 新增普通页面只注册 factory、parent 和 PageContract，不修改导航核心。
- 模块 export、运行角色和生命周期顺序以 Manifest Schema 2 为准。

相关规范：

- [ShortX UI Navigation Contract v2](docs/ShortX_UI_Navigation_Contract_v2.md)
- [可复用页面导航模板](docs/templates/ShortX_Page_Navigation_Template_ES5.js)
- [技术架构](docs/技术架构.md)
- [模块规范](docs/模块规范.md)

## 自动化验证

正式发布预检：

```bash
bash scripts/release_preflight.sh --main
```

当前版本已通过：

- Rhino ES5 validation；
- 压缩模块展开语法检查；
- ColorOS 颜色接口审计：`HIGH=0 WARN=0 SAFE=10`；
- Manifest Schema/export/SHA/lifecycle contract；
- Navigation regression suite：24 项；
- Tokenizer regression suite：13 项；
- Translation provider contract；
- GitHub Navigation 与 Tokenizer 门禁。

自动化结果不替代真机验证。Android 14 / ColorOS / ShortX 上的窗口、侧滑、输入法和外部 Intent 行为，以真机测试结果为最终依据。

## 历史版本

- [`20260809.05` 用户版更新说明](docs/ClipHub_20260809.05用户版更新说明.md)
- [`20260809.05` 详细技术更新说明](docs/ClipHub_20260809.05正式版详细更新说明.md)
