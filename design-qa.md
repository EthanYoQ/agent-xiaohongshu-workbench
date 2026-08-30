# Design QA — 小红书 3:4 母版（2026-08-30）

## Source truth

- 封面问题样本：`/var/folders/y6/hblgxk011lv88rr4q8p7frm40000gn/T/codex-clipboard-fa1f54af-d26f-4fd5-b11b-0744584ed084.png`（762×1014）
- 正文问题样本：`/var/folders/y6/hblgxk011lv88rr4q8p7frm40000gn/T/codex-clipboard-77e90067-d00d-4a92-b456-65788d2f3834.png`（788×1036）
- 用户约束：3:4 插图、默认白底、图文分居相对页边、默认橙色、无页码；插图数量随文章增减。

## Implementation evidence

- 封面桌面成品：`artifacts/design-qa/cover-desktop.png`（810×1080）
- 正文桌面成品：`artifacts/design-qa/page-02-desktop.png`（810×1080）
- 窄屏工作台封面：`artifacts/design-qa/workbench-cover-narrow.png`（869×1879；CSS viewport 390×844）
- 窄屏工作台正文：`artifacts/design-qa/workbench-page-02-narrow.png`（869×1879；CSS viewport 390×844）
- 封面对照：`artifacts/design-qa/compare-cover-source-vs-local.png`
- 正文对照：`artifacts/design-qa/compare-inner-source-vs-local.png`
- 桌面验收 viewport：1440×1000；状态为本地既有 5 页处暑稿，封面与第 2 页。

## Visible comparison

### Cover

- 原样本的问题：正文段落抢占首屏、标题层级过长、绿色仍是主色、右下角页码占位。
- 当前实现：短眉题 + 两行核心标题 + 单一 3:4 KV；正文段落从封面首屏移除；橙色只承担强调；页码移除。
- 第一轮回读发现旧稿 18 字标题末字贴近裁切线；随后增加旧长标题字号降级。最终回读：2 行、水平 overflow=0、末字未裁切。

### Inner page

- 原样本的问题：正方形插图容易裁头或留边；三段文字和插图没有形成稳定的相对页边锚点；绿色强调和页码仍存在。
- 当前实现：三张插图均为 3:4（宽高比回读 0.75）；第 1/3 段文字靠左且图靠右，第 2 段图靠左且文字靠右；页面和图片容器均为白底；强调色回读为 `#b86442`；页码节点数量为 0。

## Runtime and regression readback

- Browser dev-server history contained three React HMR `createRoot` reload errors during source hot-reload. Final production-dist preview was then loaded from `/assets/index-BF74cXl_.js`; it emitted no new errors or warnings, rendered one page article, and page 3 read back with zero overflow, no layout warning, and image ratios 0.7500/0.7499/0.7499.
- Automated tests: 246 passed, 0 failed。
- Production build: passed；仅保留既有大 chunk 警告。
- 真实新图生成：未运行。旧稿插图像素里的米色场景被保留；本轮证明的是母版、容器和生成提示的默认白底规则，不把旧素材重绘冒充成新生成结果。

## Regression audit — browser annotation 1

- Source visual truth: user browser marker on page 3 at `http://127.0.0.1:4184/`.
- Before-fix screenshots: `artifacts/design-qa/audit-before-page-01.png` through `audit-before-page-05.png`, plus each `-alternate.png` state.
- Viewport: browser content 1636×1125; accepted screenshots preserve the full workbench and selected page state.
- [P1] Multi-panel rows did not contain their own 3:4 images. Page 3 showed four cross-copy/image collisions; the first same-row collision measured about 1528 CSS px². Pages 2 and 4 did not visibly cross in their default recipes, but all three images still escaped their row bounds. The alternate three-panel recipes also failed.
- Root cause: the final CSS sized three-panel images from column width (`width: 100%; height: auto`) after row heights had already been fixed, allowing a 138–154px image to escape a roughly 129px row.
- Fix: three/four-panel pages now give each copy/image pair one independent row; row height owns the image size; inherited absolute positioning and stale v6 panel transforms are retired during v7 migration.
- Runtime/export gate now rejects panel-child escape, same-row overlap, panel-panel overlap, cross-panel overlap, essay text/image overlap, cover header/lede/image overlap, and any visible 3:4 image whose rendered ratio drifts beyond tolerance.

## Full layout matrix readback

- Wide workbench capture: 1636×1125; all 5 pages × 2 eligible layouts checked. Result: document horizontal overflow 0, page overflow 0, layout warnings 0, all rendered illustration ratios 0.7499–0.7500.
- Narrow workbench capture: 390×844; all 5 pages × 2 eligible layouts checked. Result: document horizontal overflow 0, page overflow 0, layout warnings 0, all rendered illustration ratios 0.7499–0.7500.
- Every three-panel page in both layout families: copy contained by its row, illustration contained by its row, same-row overlap false, cross-row overlap false.
- Closing-page poster alternate now keeps a readable four-line lede instead of silently hiding the disclaimer; measured header→lede gap and lede→image gap remain positive at both checked widths.
- Final wide canvas contact sheet: `artifacts/design-qa/final-wide-canvas-contact-sheet.png`.
- Final narrow canvas contact sheet: `artifacts/design-qa/final-narrow-canvas-contact-sheet.png`.
- Page 3 before/after comparison: `artifacts/design-qa/compare-page-03-before-after.png`.

## Final result

- 最终真实发布包：`~/Downloads/小师妹-发布包-2026-08-30T08-22-47-903Z-1.zip`，SHA-256 `189e574171c925c9124549616d5da3a41fe21196e47d9de67adaab8be8122868`。
- ZIP 已拆包回读：`01.png`–`05.png` 均为 1080×1440；发布正文与 5 个 tags 为当前安全改写版；manifest page_count=5。
- 最终导出 PNG：`artifacts/design-qa/final-20260830/exported/01.png`–`05.png`。逐页肉眼回读无页码、无灰框/分隔线、图文不重叠、插图槽均为 3:4。
- 最终窄屏逐页截图：`artifacts/design-qa/final-20260830/final-narrow-v11-page-1.png`–`5.png`；第 4 页另在回到页面顶部后复核为 `final-narrow-v11-page-4-top.png`。
- v11 导出根因闭环：百分比列宽和固定行高曾同时决定插图尺寸，使 540px 编辑器正常而 1080px 导出被拉宽。现由行高单独决定尺寸，宽度按 3:4 自动反推；最新版导出状态回读为 `COMPLETE`。
- 经验资产：`logic/XHS_GRAPHIC_PRODUCTION_STANDARD.md`，并已由 `PRODUCT_CONTRACT.md` 引用；规则绑定源像素 Gate、结构 Gate、导出 Gate 与回归测试。

Scope: local production build, runtime layout matrix, Vercel Preview and stable-domain artifact readback. No new paid image generation or external Xiaohongshu publishing is claimed.

passed

## v13 发布前增量回读

- 全量回归：259/259；production build PASS；Impeccable detector 0 findings。
- 本地项目从约 414 MiB 收敛到 19 MiB；`dist` 7.4 MiB，只含 `public/generated/.gitkeep`，不再复制本地用户图片。
- 旧生成资产迁到 `~/.mesy/runtime/packages/xiaoshimei-studio-v2/public/generated/` 后，4184 实际返回 HTTP 200 `image/png`。
- 桌面与 360px 五页无页面溢出、无 layout warning；正文插图 3:4，封面 KV 9:8。
- 改字、编辑栏撤销、刷新回载均现场通过，测试后原稿恢复。
- 最新导出：`~/Downloads/小师妹-发布包-2026-08-30T12-03-31-649Z-1.zip`；SHA-256 `6855026976bdf8ec0407360c19b7dcb98c9f4617b10ac0adfc8aede367706621`；8 文件 CRC PASS，5 张 PNG 均 1080×1440，逐页目检通过。
