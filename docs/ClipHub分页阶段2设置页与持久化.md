# ClipHub 分页阶段 2：设置页与持久化

## 分支

`agent/add-pagination-lazy-prefetch-20260807`

## 模块集

`20260807.03`

## 本阶段目标

阶段 2 只接入分页设置，不改变首页列表的加载行为。首页 AJAX 追加、数字页码、懒加载和预加载执行逻辑将在后续阶段接入。

## 已实现

### 1. Stage 1 导出修正

`ch_06_repository.js` 在保留阶段 1 查询实现的基础上补充：

- `DEFAULT_PAGE_SIZE = 100`
- `MODULE_VERSION = 15`
- `PAGINATION_STAGE1_EXPORT_FIX = true`

用于修正阶段 1 测试入口无法读取默认分页数量的问题。

### 2. SQLite 设置项

`ch_13_settings.js` 新增三个设置键：

| 设置键 | 类型 | 默认值 | 约束 |
|---|---:|---:|---|
| `paginationMode` | 字符串 | `ajax` | 仅允许 `ajax`、`number` |
| `paginationPageSize` | 整数 | `100` | 严格限制 `5-1000`，不自动钳制 |
| `paginationPrefetchEnabled` | 布尔值 | `true` | 仅 `true` 表示开启 |

无效分页数量会拒绝保存，不会静默改成最小值或最大值。

### 3. 设置页 UI

常规设置后新增“首页分页”区块：

- AJAX 追加模式；
- 数字分页模式；
- 单次加载数量输入框；
- 下一页预加载开关；
- 保存按钮和校验结果提示。

分页数量输入框复用设置页既有 IME 避让、焦点跟踪和自动滚动机制。

### 4. 变更事件

设置成功后发送：

`pagination_settings_changed`

事件负载包含：

- `mode`
- `pageSize`
- `prefetchEnabled`
- `origin`
- `at`

阶段 3 首页状态机会订阅或读取这些设置。

## 冻结边界

- `src/ch_08_window.js` 不修改；
- `src/ch_11_filter.js` 不修改；
- 模块数量保持 15；
- 不新增 `ch_16`；
- 仅使用 Rhino ES5 语法；
- `main` 不修改。

## 加载器说明

由于当前 GitHub 连接器不提供服务端文本补丁接口，本阶段的 `ch_06_repository.js` 和 `ch_13_settings.js` 使用确定性加载器：

1. 优先读取模块更新时的 `modules.backup`；
2. 其次读取运行目录缓存；
3. 首次全新安装时读取固定提交 `f097cc117a41aed6299f03fa569a36032bcfaaab`；
4. 校验固定 Git blob SHA；
5. 对冻结源码执行唯一锚点替换；
6. 执行补丁后的 ES5 模块。

缓存文件只保存已经通过 SHA 校验的冻结源码。

## 真机测试

停止正式后台不是必需条件。测试入口使用隔离目录：

`ClipHubPaginationStage2Test`

运行：

`ClipHub_分页阶段2设置页测试入口.txt`

通过条件：

- `ok = true`
- `repositoryDefaultPageSize = 100`
- `settingsModuleVersion >= 22`
- 默认值为 `ajax / 100 / true`
- 5 和 1000 均可保存
- 4、1001、小数、空值均被拒绝
- 非法模式被拒绝
- 设置页区块存在
- 分页数量输入框已绑定
- `sectionCount = 5`
- UI 保存 `ajax / 256 / true` 成功

测试会在结束前恢复测试数据库原有分页设置，并停止隔离实例。
