# ClipHub

ClipHub 是一个面向 Android / ShortX / Rhino ES5 环境的模块化全局剪贴板管理项目。

当前开发分支：

```text
agent/initialize-project-skeleton
```

当前模块集：

```text
20260722.28
```

项目仍处于 Draft PR 开发阶段，尚未合并到 `main`。

## 已完成能力

- ShortX 唯一入口 `ClipHub.js`；
- 15 模块远程同步、Git blob SHA 校验、备份和失败恢复；
- SQLite schema v2；
- 剪贴板后台监听、来源识别、重复抑制和敏感内容策略；
- 历史记录 CRUD、软删除、撤销、置顶、排序和标签；
- Android 原生 WindowManager 悬浮 UI；
- Android 13+ 系统返回与 Android 14 预测性返回；
- ColorOS 最近任务自动关闭 UI，后台监听继续运行；
- 正式实例动态广播控制和运行锁；
- 首页 / 列表页新 UI 第二轮视觉基线。

## 阶段 3D2

最终发布视觉按五张 Android 参考图复刻：

1. 首页 / 列表页；
2. 搜索 / 筛选页；
3. 新增 / 编辑页；
4. 详情 / 识别 / 翻译页；
5. 标签 / 分类管理页。

当前进度：

- Theme v2：紫色亮暗主题；
- Window v5：底部大圆角浮层与拖动手柄；
- List v11：首页第二轮基线已通过探测 034；
- Filter v6：搜索页和高级筛选抽屉第一轮已实现；
- Settings v4：增加搜索历史持久化字段；
- 当前等待探测 035 的两张真机截图和完整 JSON。

## ShortX 使用方式

在 ShortX Rhino JavaScript 任务中执行完整 `ClipHub.js`。

入口维护目录：

```text
shortx.getShortXDir()/ClipHub/
├── cache/
├── data/
├── logs/
├── modules/
└── probes/
```

首次运行会下载 15 个模块。远程下载失败时，如果本地模块集完整且 SHA 校验通过，会使用离线缓存。

## 更新测试分支

入口版本 4 在正式实例运行时会直接复用现有实例，不会同步远程模块。更新测试分支时：

1. 执行 `probes/cliphub_stop_formal.js`；
2. 执行完整 `ClipHub.js`；
3. 确认 `sync.moduleSetVersion`；
4. 执行对应真机探测。

不得删除仍被实例持有的 `cliphub.lock`。

## 当前隐私默认值

```text
sensitivePolicy=skip
historyLimit=0
autoCleanupDays=0
```

- 敏感 ClipData 默认不保存正文；
- 历史数量和保存天数默认不启用自动删除；
- 置顶记录不会被历史清理删除。

## 主要文档

- `docs/架构设计.md`
- `docs/数据库设计.md`
- `docs/模块规范.md`
- `docs/开发计划.md`
- `docs/阶段3D2新UI全量复刻方案.md`
- `docs/新首页UI校正探测034说明.md`
- `docs/搜索筛选新UI探测035说明.md`

## 兼容约束

- Rhino ES5；
- 只使用 `var` 和 `function`；
- 禁止 ES6+ 语法；
- Android 13 及以上；
- Android 14 / API 34 为主要测试环境；
- ShortX 运行于 `system_server` / uid 1000；
- 不使用 WebView；
- 不增加底部系统手势拦截层。
