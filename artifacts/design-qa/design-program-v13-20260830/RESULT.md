# 小师妹 Design Program v13｜能力嫁接结果

## 结论

工作台原先把设计判断压缩成 `page_role + panel_count + page_index → layout_id`，因此只能填模板，无法表达 HTML/文生图在整页创作时使用的主次、视线、节奏、图文关系与留白判断。

本轮唯一实现路线是：让现有页面规划模型输出受约束的视觉程序，再由现有 HTML 编辑器编译和渲染。没有引入第二编辑器、第二状态库、任意模型 HTML/CSS 或不可编辑的合成图片。

## 稳定合同

```text
confirmed article + page sequence + panel semantics + style lock
→ Ark page plan + xiaoshimei.design-program.v1
→ normalize / clamp / semantic-role reconciliation
→ existing html_state v10
→ existing editable HTML canvas
→ DOM + export QA
→ user edits remain authoritative
```

`design-program.v1` 固定表达：

- composition：`cover-focus | editorial-flow | feature-lead | quiet-coda`
- focal_order：`title | hero | support | detail`
- rhythm：`steady | lead-heavy | breathing`
- image_edge：`right-first | left-first`
- image_scale：`compact | balanced | generous`
- title_measure：`narrow | balanced | wide`
- whitespace_anchor：`after-title | between | bottom`
- hero_panel：只能绑定既有语义 hero；冲突时内容角色获胜

## 落点

- `src/design-program.mjs`：程序 schema、回退、约束、CSS 变量编译和宏版式映射。
- `src/ark-provider-core.mjs`：同一次页面规划调用内生成视觉程序，不新增付费图片调用。
- `src/html-layout.mjs`：HTML state v10 接纳程序；v9 已保存版式和密度保持不变。
- `src/HtmlPageEditor.jsx`：同一画布读取程序，同时保留文字、取景、模块移动、缩放和导出。
- `src/styles.css`：v13 只消费有界变量；封面 1/3 标题 + 2/3 9:8 KV 和内页 3:4/对边对齐仍是硬不变量。

## 当前证据

- 聚焦回归：50/50 PASS。
- 全量回归：259/259 PASS。
- Vite production build：PASS。
- HTTP：4184 返回 200；4175 `/health` 返回 `CONFIGURED_UNVERIFIED`，本轮没有发起模型或图片调用。
- 状态兼容：v9 用户版式与 density 迁移后保持；v10 同时保存程序和原有编辑数据。
- 2026-08-30 发布前复核：259/259 PASS；production build PASS；Impeccable detector 0 findings。
- 桌面五页：页面 `scrollWidth=clientWidth`、`scrollHeight=clientHeight`、layout warning 0；正文插图宽高比 0.752–0.755。
- 360px 五页：无页面溢出和 layout warning；正文可见文字约 17.7px；插图保持 3:4，封面 KV 保持 9:8。
- 自由编辑：标题改字真实持久化；编辑栏撤销恢复原文，刷新后仍为原文。
- 外置 runtime：迁移后的历史 PNG 通过 `http://127.0.0.1:4184/generated/...` 返回 HTTP 200 `image/png`，源码构建不再夹带用户生成物。
- 最新发布包：`~/Downloads/小师妹-发布包-2026-08-30T12-03-31-649Z-1.zip`，SHA-256 `6855026976bdf8ec0407360c19b7dcb98c9f4617b10ac0adfc8aede367706621`；8 文件 CRC PASS，5 张 PNG 均 1080×1440，逐页目检无页码、白边、裁头或重叠。

## 五层边界

- `mechanism_ready`: PASS
- `package_verified`: PASS_LOCAL_ZIP
- `runtime_operational`: PASS_LOCAL_SERVICES；本轮发布前复核未新增付费调用
- `visual_reality_validated`: PASS_LOCAL_DOGFOOD
- `production_applied`: PASS_VERCEL_PRODUCTION；deployment `dpl_Afw8Q5Vai578FVs11waZvd24CYBp`
- `reader_outcome_validated`: NOT_RUN

因此目前可以说“本地能力桥、编辑与发布包已现实验证，最新 v13 已在线上生效”；不能把它扩大为小红书真实发布或读者效果已验证。
