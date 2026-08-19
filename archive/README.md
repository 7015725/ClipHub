# ClipHub Archive

`archive/` 只保存历史追溯资料，不作为当前开发默认事实源。

当前规范位于根目录 `README.md` 与 `docs/`。

## 2026-08-19 文档清理

- `docs-legacy-20260819/`：清理前完整 `docs/` 快照，包含旧版本说明、分页 Stage、Probe 结果、3D2 实施记录、旧收口方案等；
- `pagination-stage-assets-legacy/`：原根目录 `stage-assets/`，包含分页阶段 patch/payload；
- `diagnostics-legacy-20260819/`：原根目录一次性 stage/debug/diag 文件。

已有 `navigation-contract-v1/` 与 `manual-probes/` 继续保持历史归档状态。

历史资料可以用于定位过去行为或回归来源，但如果与当前 `module-manifest.json`、正式代码或 `docs/` 当前规范冲突，应以当前正式实现为准。
