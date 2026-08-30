# 小师妹布局合同 v12｜现实回读

## 固定合同

- 母版1：3×3 逻辑网格，上两行合并为一张连续 9:8 KV，底行从左到右为 A/B/C 三张 3:4 插图。
- 母版2起：3×3 独立插图，D–L，后续按文章需要继续 M、N……；不固定插图数量。
- 封面：上 1/3 只放眉题与两行主标题；下 2/3 放 9:8 KV，满宽、贴底、无默认圆角卡片。
- 正文：按 1–4 个信息单元智能分配行高，图文交错对齐相反页边；插图保持 3:4。
- 编辑：自动布局只提供默认几何；文字、图片取景、模块位置和缩放仍可编辑、保存、刷新回载、undo/redo。
- 配色：以用户确认的本地视觉样本为参考，封面显示橙 `#FD8502`，正文强调橙 `#E6773D`。

## 代码与资产落点

- 母版与标签：`src/mother-sheet.mjs`
- 本地 Provider 切片：`scripts/ark-provider-server.mjs`
- 公网 BYOK Provider 切片：`api/provider.mjs`
- 智能布局与迁移：`src/html-layout.mjs`、`src/HtmlPageEditor.jsx`、`src/styles.css`
- 产品标准：`PRODUCT_CONTRACT.md`、`logic/XHS_GRAPHIC_PRODUCTION_STANDARD.md`、`logic/WORKBENCH_EXPERIENCE_STANDARD.md`

## 现实证据

- 258/258 全量测试通过；Vite production build 通过。
- 桌面现场几何：标题区 33.33%，KV 区 66.67%，KV 宽高比 1.125，底边误差约 0，布局告警 0。
- 360×1125 设备级现场：`innerWidth=360`、`scrollWidth=360`；封面比例不漂移；五页横纵 overflow 均为 0，布局告警均为 0。
- 自由编辑现场：标题改写后 undo 恢复；KV 模块位移 `0 → 2cqw → 0`；保存并刷新后标题、`cover-poster`、9:8 与 50/50 取景保持。
- 本轮没有图片生成调用，没有新增付费；现有旧 3:4 KV 只通过工作台重置取景，未伪装成新 9:8 生成资产。

## 完成边界

- `mechanism_ready`: PASS
- `package_verified`: PASS_LOCAL（代码、测试、构建、桌面与 360px 工作台）
- `production_applied`: NOT_RUN（没有部署公网正式版）
- `runtime_operational`: PASS_LOCAL（4184 与 4175 同时在线）
- `reality_validated`: PASS_LOCAL_DOGFOOD（未做新付费母版与外部发布）
