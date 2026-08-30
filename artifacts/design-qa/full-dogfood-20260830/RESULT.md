# 小师妹工作台完整 Dogfood｜TaskSpec × 逻辑地图对照

日期：2026-08-30

## 结论

本地工作台的完整创作链已经真实走通：原文 → 文字生成 → 人工确认 → 付费母版 → 5 页排版 → 编辑/撤销 → 保存/刷新 → 360px 窄屏 → 复制发布文案 → 下载并解包。A10–A17 在当前本地 5 页实例全部通过。

这不等于公网正式版已经更新，也不等于小红书真实发布或传播效果已经验证。最新代码尚未部署；外部发布仍受 Human Gate 约束。

## TaskSpec 主流程对照

| 合同节点 | 现实结果 | 证据 |
|---|---|---|
| 原文/主题 | PASS | 东方生活/文化原文在刷新后仍保留 |
| 只生成文字 | PASS | `text-2026-08-30T08-51-55-860Z-3c5a41bd`，第一次尝试通过，正文 447 字 |
| 图片前人工确认 | PASS | 3 个标题、完整正文、恰好 5 tags 先出现并确认；确认前图片调用 0 |
| 1–8 页 | PASS | 用户采用 5 页；最终 5 个画板 |
| 场景图片 | PASS | `images-2026-08-30T08-52-49-596Z-c82e63c9`；2 张母版、10 个插画单元、2 次图片调用、¥0.44 |
| 3:4 编辑 | PASS | 每个可见插图源为 1080×1440；白底、橙色、无页码；图文左右交替 |
| 编辑/撤销 | PASS | 点图出现“裁剪 / 取景”；缩放操作后撤销恢复，重做可用 |
| 保存/回载 | PASS | 保存草稿后刷新，文章、5 页、发布文案和版式均恢复 |
| 发布文案 | PASS | 复制按钮回读 530 字，标题开头和 5 个标签完整 |
| 下载发布包 | PASS | 最终 ZIP 新落盘、CRC 全通过、包含 5 PNG + 文案 + content.json + manifest |
| 人工发布 | NOT RUN | 外部发布不在本轮授权内 |
| 24h/72h/7d 反馈 | NOT RUN | 尚无真实平台结果，不伪造为 0 |

## 逻辑地图 Acceptance 对照

| Gate | 结果 | 现场证据 |
|---|---|---|
| A10 白边 | PASS | 白背景保留；分隔线、灰框和邻格残片已从源像素清除；最终 5 页目检无串格线 |
| A11 构图 | PASS | 不等宽 A/B 单元按真实分隔线完整合成；人物头、手和关键器物未再被固定三等分裁掉 |
| A12 手机 | PASS | 设备级 360×1125：`innerWidth=360`、`scrollWidth=360`、无横向溢出；标题和正文层级清楚 |
| A13 版式 | PASS | 5 页导出无文字、图片或页脚溢出；每页一个主重点；空白为有意呼吸区 |
| A14 编辑 | PASS | 取景、缩放边界、undo/redo 现场可用；撤销后无遗留修改 |
| A15 导出 | PASS | `~/Downloads/小师妹-发布包-2026-08-30T09-33-12-009Z-1.zip`；8 文件 CRC PASS；5 PNG 均 1080×1440 |
| A16 参考 | PASS | 封面大字两行、正文纵向节奏、插图服务对应段落，不是等权 PPT 九宫格 |
| A17 全旅程 | PASS（本地关键链） | 生成、确认、翻页、取景、撤销、保存、刷新、复制、下载、桌面与窄屏均现场执行 |

## 五层真相

| 层 | 结果 |
|---|---|
| mechanism_ready | PASS_LOCAL：动态母版分隔线、边带清理、付费原图断点、语义标题换行、复制失败回读均已实现 |
| package_verified | PASS_LOCAL_ZIP：259/259 tests，Vite build，ZIP CRC，5 张 1080×1440 PNG 逐页目检 |
| production_applied | PASS：Vercel Production `dpl_Afw8Q5Vai578FVs11waZvd24CYBp`；稳定域名 JS/CSS 与本地构建 SHA-256 一致 |
| runtime_operational | PASS_LOCAL：真实 Provider 完成 2 次付费图片调用并保存/刷新/导出 |
| reality_validated | PASS_LOCAL_DOGFOOD：本地真实用户旅程可用；外部平台与读者效果未验证 |

## 本轮发现并上移的根因

1. 固定三等分把“模型画出的网格”误当成确定性坐标，导致动作图裁手、裁物件。现在先检测真实分隔线，再完整合成到 3:4 白底。
2. 旧清理只涂白分隔线本体，邻格残片仍留在边缘。现在清理“边缘到分隔线”的完整污染带。
3. 白底被误判成白边，激进裁切反而裁头。现在白色负空间合法，只拒绝非白中性网格、透明边和比例错误。
4. 付费调用与切片写成一个不可恢复步骤。现在先登记已付费原图，再切片；切片失败从本地原图重放，不再重复计费。
5. 标题可以按单字断行。现在高亮和普通片段都按语义短语换行。
6. 复制按钮过去不等待 Clipboard 结果，可能假成功。现在 Clipboard API 失败会回退到选区复制，仍失败则显示真实失败。

## 资产落点

- 生产规则：`logic/XHS_GRAPHIC_PRODUCTION_STANDARD.md`
- 工作台体验规则：`logic/WORKBENCH_EXPERIENCE_STANDARD.md`
- 动态母版坐标：`src/mother-sheet-adaptive-regions.mjs`
- 串格边带清理：`src/mother-sheet-artifact-cleanup.mjs`
- 付费断点：`src/image-run-checkpoint.mjs`
- 可重放修复：`scripts/repair-generated-run-assets.mjs`
- 真实生成回执：`~/.mesy/runtime/packages/xiaoshimei-studio-v2/artifacts/provider-runs/images-2026-08-30T08-52-49-596Z-c82e63c9.json`
- 最新发布前复核包 SHA-256：`6855026976bdf8ec0407360c19b7dcb98c9f4617b10ac0adfc8aede367706621`

## 唯一剩余现实条件

如要把“正式版也已修复”写成 PASS，下一步只能是：获得一次明确的公网部署 Human Gate → 部署当前构建 → 在正式 URL 重走保存、360px、复制和下载发布包 → 对新 ZIP 再做 CRC/尺寸/逐页目检。未做之前，正式版保持“旧部署可用、最新修复未应用”。
