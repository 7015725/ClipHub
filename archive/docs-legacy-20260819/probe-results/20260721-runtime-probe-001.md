# ClipHub 真机探测 001 结果

## 基本信息

- 执行时间：2026-07-21 10:10:36
- 设备系统：Android 14 / API 34
- 运行身份：uid=1000
- 进程 PID：3284
- 执行线程：`DefaultDispatcher-worker-13`
- 线程 ID：31710
- ShortX 根目录：`/data/system/shortx_OYdazjKnxMzhQykL`
- 探测耗时：4 ms
- 总体结果：通过

## 结论

### 1. 运行目录

以下目录均可创建、读取和写入：

```text
ClipHub/
├── modules/
├── data/
├── logs/
├── cache/
└── probes/
```

因此当前运行目录规划可继续使用。

### 2. UTF-8 文件操作

以下操作全部成功：

- 写入；
- 读取并比对；
- 重命名；
- 删除源文件；
- 删除重命名后的文件。

### 3. Rhino direct eval 作用域

验证结果：

- direct eval 中的局部变量在加载器内部可见；
- direct eval 局部变量不会泄漏到全局；
- 模块通过 `global.ClipHub` 注册后可被全局访问；
- IIFE 私有变量不会泄漏到全局；
- 模块接口调用结果正确。

结论：当前“入口读取文件 → direct eval → IIFE 注册到 `ClipHub` 命名空间”的模块加载方式可保留。

### 4. 文件锁

验证结果：

- 第一次获取成功；
- 持锁期间第二次获取被阻止；
- 同一 JVM 内第二次 `tryLock()` 抛出 `OverlappingFileLockException`；
- 释放后可以重新获取。

实际异常形式：

```text
java.nio.channels.OverlappingFileLockException
```

当前 `ch_15_app.js` 已同时处理：

- `tryLock()` 返回 `null`；
- `OverlappingFileLockException`。

两种情况均统一转换为：

```text
ClipHub is already running
```

### 5. 线程边界

ShortX 任务运行于：

```text
DefaultDispatcher-worker-13
```

这不是 Android 主线程。后续 UI 层必须：

- 显式建立或选择 UI 所属 Looper；
- 通过 Handler 在所属线程创建和更新 View；
- 统一执行 WindowManager 的 add/update/remove；
- 不依赖 ShortX 当前任务线程长期存活。

SQLite 和普通文件操作可以在后台线程执行，但 UI 操作必须单独管理线程边界。

### 6. 不应依赖的运行字段

探测结果中的：

```text
javaVersion=0
rhinoLanguageVersion=0
```

不适合作为功能判断依据。项目继续通过代码规范和静态检查保证 Rhino ES5 兼容，而不是依赖 Rhino 当前语言版本字段。

## 尚未验证

- 两个独立 ShortX 任务同时竞争文件锁；
- 进程被强制终止后操作系统是否自动释放锁；
- 仓库 `src/` 发布到运行目录后的真实模块加载；
- UI Looper 与 WindowManager 生命周期；
- SQLite 并发和事务行为。

## 下一步

执行 `cliphub_lock_probe_002.js`，使用两个独立 ShortX 任务验证跨任务锁竞争。
