# ClipHub

> 面向 Android / ShortX 的全局悬浮剪贴板管理器。

![ClipHub UI 概念图](docs/images/cliphub-ui-concept.png)

## 项目状态

当前处于**项目骨架与数据基础层验证阶段**，尚无可用发行版本。

- 项目名称：`ClipHub`
- 中文名称：全局剪贴板
- 仓库：`7015725/ClipHub`
- 默认分支：`main`
- 主要运行环境：Android 14 / ShortX / Rhino ES5
- 数据策略：本地优先
- UI 形态：WindowManager 悬浮窗

## 运行方式

用户只需要在 ShortX 中建立一个 Rhino JavaScript 任务，将完整 `ClipHub.js` 粘贴进去执行。

```text
ShortX JS 任务
    ↓ 执行 ClipHub.js
读取 GitHub module-manifest.json
    ↓
首次运行或模块版本变化时下载 src/ch_*.js
    ↓
校验 Git blob SHA
    ↓
保存到 shortx.getShortXDir()/ClipHub/modules/
    ↓
按 ch_01 → ch_15 顺序加载并启动
```

不需要：

- 在 ShortX 中分别建立 15 个模块任务；
- 使用 Termux 手动复制模块到 ShortX 私有目录；
- 把源码仓库作为运行目录；
- 使用 Git Submodule。

入口文件本身发生变化时，仍需要手动替换 ShortX 任务中的完整 `ClipHub.js`。

当前开发分支测试阶段，入口默认从以下 ref 获取 manifest 和模块：

```text
agent/initialize-project-skeleton
```

合并正式版本前会切换为：

```text
main
```

## 模块更新与恢复

入口每次运行会检查远程 manifest：

- 本地模块与 manifest SHA 全部一致时，不重新下载；
- 首次运行或版本变化时，下载到临时目录；
- 15 个模块全部下载并校验成功后才替换现有模块；
- 新模块加载或启动失败时恢复上一套模块；
- 网络不可用但本地模块完整时，允许离线回退运行；
- 首次运行且无法联网时，不生成半套模块。

运行目录：

```text
shortx.getShortXDir()/ClipHub/
├── modules/
├── data/
├── logs/
├── cache/
│   └── module-manifest.local.json
└── probes/
```

## 项目定位

ClipHub 用于收集、查看和管理设备上的剪贴板历史，并通过悬浮窗提供快速搜索、分类、编辑、翻译和内容识别能力。

项目目标：

- 快速找到之前复制的内容；
- 根据来源应用、关键词、内容类型和自定义标签过滤；
- 识别网址、电话号码等可操作内容；
- 对内容进行置顶、编辑、删除、翻译和排序；
- 在其他应用上方通过可拖动悬浮窗完成操作；
- 为后续规则处理、自动分类和跨设备同步预留扩展边界。

## 目标运行环境

```text
Android 14 / API 34
ShortX JavaScript 任务
Rhino JavaScript ES5
system_server / uid=1000
Root / KernelSU
Android WindowManager
SQLite
```

### JavaScript 约束

- 严格使用 Rhino ES5 兼容语法；
- 不使用 `let`、`const`、箭头函数、类和模板字符串；
- Android 类通过 `Packages` 或兼容方式调用；
- 不依赖浏览器 DOM；
- 不假设 WebView 可用；
- UI、数据库和监听器显式管理生命周期。

## 当前进度

已完成：

- ShortX 单入口；
- 15 个本地 JavaScript 子模块骨架；
- GitHub manifest 下载；
- 模块 Git blob SHA 校验；
- 临时目录下载、旧模块备份和失败恢复；
- 完整本地模块的离线回退；
- 统一命名空间和模块生命周期；
- 文件锁单实例保护；
- 运行目录、eval 作用域和双任务文件锁真机探测；
- Android 原生 SQLite 提交、回滚、外键、重开和完整性真机探测；
- SQLite schema v1、迁移框架、参数绑定和显式事务封装；
- Repository 基础 CRUD、软删除、恢复和标签关联接口。

正在验证：

- 入口首次下载 15 个模块；
- 本地 manifest 与模块 SHA；
- 下载后的真实模块加载；
- Repository 真机 CRUD；
- 停止后的数据库关闭、文件锁释放和二次启动。

尚未实现：

- ClipboardManager 实际监听；
- 来源应用探测；
- 短时间重复合并；
- 自身回写抑制；
- 悬浮窗 UI；
- 完整搜索、过滤和翻译链路。

## 项目目录

```text
ClipHub/
├── ClipHub.js                    # 唯一 ShortX 入口
├── module-manifest.json          # 远程模块清单与 Git blob SHA
├── README.md
├── docs/
│   ├── 产品需求.md
│   ├── 技术架构.md
│   ├── 交互规范.md
│   ├── 开发计划.md
│   ├── 模块规范.md
│   ├── 真机探测说明.md
│   ├── SQLite探测说明.md
│   ├── SQLite阶段边界.md
│   ├── 真实模块探测004说明.md
│   ├── probe-results/
│   └── images/
│       └── cliphub-ui-concept.png
├── probes/
│   ├── cliphub_runtime_probe_001.js
│   ├── cliphub_lock_probe_002.js
│   ├── cliphub_database_probe_003.js
│   └── cliphub_module_probe_004.js
├── src/
│   ├── ch_01_base.js
│   ├── ch_02_log.js
│   ├── ch_03_database.js
│   ├── ch_04_clipboard.js
│   ├── ch_05_classifier.js
│   ├── ch_06_repository.js
│   ├── ch_07_theme.js
│   ├── ch_08_window.js
│   ├── ch_09_list.js
│   ├── ch_10_editor.js
│   ├── ch_11_filter.js
│   ├── ch_12_translation.js
│   ├── ch_13_settings.js
│   ├── ch_14_event_bus.js
│   └── ch_15_app.js
└── scripts/
    └── validate_es5.py
```

## 数据模型概览

核心数据表：

- `clipboard_items`：剪贴板记录；
- `tags`：自定义标签；
- `clipboard_item_tags`：记录与标签的关联；
- `settings`：项目设置；
- `schema_meta`：数据库结构版本。

详细字段参见 [技术架构](docs/技术架构.md)。

## 开发原则

1. **原始数据优先**  
   分类、翻译和识别结果不能覆盖原始剪贴板内容。

2. **避免监听回环**  
   ClipHub 主动复制内容后，必须识别并抑制自身产生的重复事件。

3. **UI 与数据分离**  
   WindowManager 页面不能直接拼接数据库逻辑。

4. **线程边界明确**  
   View 创建、修改和移除必须回到所属 UI 线程。

5. **可恢复**  
   模块更新、数据库迁移、悬浮窗关闭或脚本重启失败时，不应破坏上一份可运行状态。

6. **本地优先**  
   默认不上传剪贴板内容，不在日志中记录完整敏感文本。

7. **渐进实现**  
   先完成稳定的记录、列表和复制链路，再增加翻译、自动分类等高级能力。

## 文档导航

- [产品需求](docs/产品需求.md)
- [技术架构](docs/技术架构.md)
- [交互规范](docs/交互规范.md)
- [开发计划](docs/开发计划.md)
- [模块规范](docs/模块规范.md)
- [真机探测说明](docs/真机探测说明.md)
- [SQLite 探测说明](docs/SQLite探测说明.md)
- [真实模块探测 004](docs/真实模块探测004说明.md)

## 分支建议

- `main`：可运行、经过基本验证的版本；
- `beta`：后续功能开发与设备验证版本。

首个可运行骨架完成前，暂不创建长期 `beta` 分支。

## 许可证

许可证尚未确定。在明确开源范围、代码复用规则和发布方式前，不添加默认许可证。

## 说明

ClipHub 是独立项目，不直接耦合 ToolHub-FloatBall。后续可以通过明确接口与 ToolHub 集成，但两者分别维护入口、数据库、日志和更新生命周期。
