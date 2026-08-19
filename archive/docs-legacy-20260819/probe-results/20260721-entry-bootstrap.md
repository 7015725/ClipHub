# ClipHub 入口下载与启动真机结果

## 环境

```text
日期：2026-07-21
Android：14 / SDK 34
进程：system_server
uid：1000
ShortX 根目录：/data/system/shortx_OYdazjKnxMzhQykL
入口版本：4
```

## 首次尝试

入口版本 3 使用匿名 GitHub Contents API，因共享出口 IP 的匿名 REST API 配额耗尽返回 HTTP 403。

处理：入口版本 4 改用 `raw.githubusercontent.com`，不要求配置 GitHub Token。

## Manifest 修复

入口版本 4 首次读取 `moduleSetVersion=20260721.2` 时，发现 `ch_01_base.js` 的 SHA 长度错误，入口按设计拒绝 manifest：

```text
Invalid manifest module at index 0
```

修复 manifest 后发布：

```text
moduleSetVersion=20260721.3
entryMinVersion=4
```

## 成功结果

```json
{
  "ok": true,
  "started": true,
  "entryVersion": 4,
  "reused": false,
  "sync": {
    "updated": true,
    "downloadedCount": 15,
    "remoteAvailable": true,
    "fallback": false,
    "moduleSetVersion": "20260721.3",
    "sourceRef": "agent/initialize-project-skeleton",
    "transport": "raw",
    "warning": null
  },
  "app": {
    "ok": true,
    "started": true,
    "reused": false,
    "status": "skeleton_ready",
    "runtimeDir": "/data/system/shortx_OYdazjKnxMzhQykL/ClipHub",
    "databasePath": "/data/system/shortx_OYdazjKnxMzhQykL/ClipHub/data/cliphub.db",
    "moduleCount": 14
  }
}
```

## 结论

通过：

- raw manifest 下载；
- manifest 结构校验；
- 15 个模块下载；
- Git blob SHA 校验；
- `modules.stage` 到 `modules` 的安装切换；
- 正式运行目录初始化；
- schema v1 数据库打开；
- 文件锁获取；
- 14 个可初始化模块启动。

`moduleCount=14` 统计 Base 与 App 负责初始化的 13 个业务模块，不包含 App 自身文件。后续模块集 `20260721.4` 增加：

```text
initializedModuleCount=14
moduleFileCount=15
```

并暂时保留 `moduleCount=14` 兼容字段。
