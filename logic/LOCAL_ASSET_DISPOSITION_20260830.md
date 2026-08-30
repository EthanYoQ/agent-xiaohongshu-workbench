# 小师妹 Studio｜本地资产处置表

处置窗口：2026-08-30 19:54 +0800

本表只覆盖本轮进入整理范围的顶层节点；源码、用户草稿和账号秘密不因体积自动继承处置结论。

| 节点 | semantic role | authority / consumer | rebuildability / writer | disposition | rollback |
|---|---|---|---|---|---|
| `src/ server/ api/ scripts/ tests/ test/` | 正式实现与回归 | GitHub / Vercel / 本地工作台 | 不可由构建重建；当前无并发 writer | `KEEP_ACTIVE` | Git commit |
| `XIAOSHIMEI_WORKBENCH_FULL_LOGIC_MAP.md`、`PRODUCT_CONTRACT.md`、`logic/` | 产品与连续性合同 | 人与后续 Agent | 不可由构建重建 | `KEEP_ACTIVE` | Git commit |
| `artifacts/design-qa/**/RESULT.md`、最终 `manifest.json` | 最小验收结果 | 发布与复盘 | 文本不可替代；二进制可冷藏 | `KEEP_ACTIVE` | Git commit |
| `dist/` | Vite 构建输出 | 本地服务 / Vercel builder | 完全可重建；发布后无 writer | `RETIRE` | `npm run build` |
| `public/generated/` 现有内容 | 本地生成图片 | 当前本机草稿和 4184 | 不可假设可重生；Provider 可能写入 | `REPAIR`：迁移到外置 runtime 并回读 | 原目录保留到服务回读通过 |
| `artifacts/provider-runs/` | Provider 历史回执 | 调试与现实证据 | 不由构建生成；新 writer 改到外置 runtime | `MOVE_COLD` | 冷藏索引 + hash |
| 其余 `artifacts/*` 二进制审美过程包 | 历史设计过程 | 无运行消费者；部分脚本仅演示引用 | 可由历史源或脚本重建，当前无 writer | `MOVE_COLD` | `~/archive/2608-1954-Xiaoshimei-Studio-v2-design-artifacts/` |
| `node_modules` | 运行依赖 | Node / build | 外置缓存符号链接，可重装 | `KEEP_ACTIVE` | `npm ci` |
| `.data` | 本地工作状态 | 4184 / 4175 | 外置 runtime 符号链接，可能有 writer | `KEEP_ACTIVE` | 保持目标路径不动 |
| `packages/share-site/` | 已废弃平行预览 | 无当前 consumer；用户要求只保留正式工作台 | Git 历史可恢复 | `RETIRE` | `git restore --source=<commit>` |

执行规则：迁移前停止 4184/4175 writer；迁移后回读源/目标、文件数与 hash，再启动服务验证。任一 UNKNOWN 只冻结对应节点，不阻塞源码发布。

## 执行回读

- 4184/4175 writer 已先停止。
- `public/generated`：364 个文件、136,312,946 bytes，迁至 `~/.mesy/runtime/packages/xiaoshimei-studio-v2/public/generated/`；聚合 SHA-256 `869193375cc2e53215c49225bf82c5061832acbbcb6ca068c21c40f52ba6e7d6`。源码目录只剩被 Git 跟踪的 `.gitkeep`。
- `artifacts/provider-runs`：104 个文件、49,236,445 bytes，迁至 `~/.mesy/runtime/packages/xiaoshimei-studio-v2/artifacts/provider-runs/`；聚合 SHA-256 `ed20939a3adbfc28a6f7a5cad59354428446c922c52de32e144b9c241734bad4`。
- 其余历史二进制制品：284 个文件、67,620,868 bytes，迁至 `~/archive/2608-1954-Xiaoshimei-Studio-v2-design-artifacts/`；聚合 SHA-256 `25ea3c1c632657d9454a9b4ccfc1d7159566b20fd66e7477dc26f47e5715f980`。
- 公开仓库隐私扫描后，账号生成合同迁至外置 runtime `.data/generation-contract-v2.json`（SHA-256 `3a72bc4b790fc81b4f179f6f10320f740242edd0a055059ae3ccd8756b70d66d`）；5 个历史 authority 测试夹具与 3 个旧部署/演示脚本冷藏，不进入 GitHub。
- 项目 `artifacts/` 只保留 4 份结果/manifest，共约 20 KiB。新 runtime 启动后，4184 首页、4175 `/health` 与迁移后的 PNG 均已现场回读成功；项目含可重建 `dist` 时总量约 19 MiB。
