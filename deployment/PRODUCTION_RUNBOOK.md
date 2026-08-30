# 小师妹 Studio｜GitHub → Vercel 生产手册

更新时间：2026-08-30

## 单一权威链

```text
本地功能分支
→ GitHub Pull Request / quality workflow
→ Vercel Preview
→ 桌面 + 360px + 编辑/保存/导出验收
→ 合并 main
→ 提升同一已验收 deployment 到 Production
→ 正式域名回读
```

- 可写源码权威：`https://github.com/LeonWu123456/agent-xiaohongshu-workbench` 的 `main`。
- 上游同步：`https://github.com/EthanYoQ/agent-xiaohongshu-workbench/pull/13`；当前账号对上游只有 READ，不把等待上游合并当成生产阻塞。
- 当前集成分支：`xiaoshimei-v2`。
- 唯一正式 Vercel 项目：`xiaoshimei-full-workbench`。
- 稳定域名：`https://xiaoshimei-full-workbench.vercel.app/`。
- 构建合同：Node 22，`npm ci --omit=dev --workspaces=false`，`npm test`，`npm run build`，输出 `dist/`。

## 数据与秘密

- GitHub/Vercel 只接收源码和公开静态资产。
- `.data`、生成图片、Provider 回执、账号素材、下载包和 `.env*` 不进入 Git。
- 本地运行数据落在 `~/.mesy/runtime/packages/xiaoshimei-studio-v2/`。
- Vercel BYOK API Key 只由使用者当前标签页提交到 `/api/provider`，服务端不持久化；本地 Key 只从 Keychain/环境读取。

## 每次发布必须记录

| 字段 | 值 |
|---|---|
| source commit | 发布时填写 |
| Preview deployment | 发布时填写 |
| Preview QA | 桌面、360px、编辑、刷新、导出 |
| Production deployment | 发布时填写 |
| stable-domain readback | HTTP、资源 hash、核心交互 |
| rollback deployment | 上一份已验证 Production |

## 回滚

1. 不重新构建失败提交。
2. 将正式别名指回表中记录的上一份已验证 deployment。
3. 回读稳定域名的 HTML/JS 资源与核心路径。
4. GitHub 用修复提交前进；禁止强推重写已经发布的 `main`。

## 2026-08-30 发布记录

| 字段 | 值 |
|---|---|
| source commit | `0df5f59a64a2533045cf6d8d2fe666bf44e8a05a`；连续性补记提交随后进入同一 PR |
| GitHub | fork 分支 `xiaoshimei-v2`；CI run `33311107288` 全绿；上游 PR `#13` |
| Preview deployment | `dpl_CLPNZ9vJZX5T2pdwyq8L2Mz3tPMy` |
| Preview URL | `https://xiaoshimei-full-workbench-29ft74u88-892350620-5733s-projects.vercel.app`（Vercel Authentication 保护） |
| Preview QA | Vercel inspect Ready；HTML/JS/CSS 200；1440px 与 360px 浏览器回读；360px 无横向溢出；编辑后刷新保持；无 Key 请求 401 `ARK_API_KEY_REQUIRED`；本地完整五页编辑/撤销/回载/导出证据见 `artifacts/design-qa/full-dogfood-20260830/RESULT.md` |
| Production deployment | `dpl_Afw8Q5Vai578FVs11waZvd24CYBp`（由已验收 Preview promote） |
| stable-domain readback | `https://xiaoshimei-full-workbench.vercel.app/` HTTP 200；命中 `index-DwYvjSMn.js` / `index-B7TgIjcy.css`；线上与本地两份资源 SHA-256 分别完全一致；1440px 既有五页草稿与编辑/回载/发布包入口现场可见；无 Key 请求 401 `ARK_API_KEY_REQUIRED` |
| rollback deployment | `dpl_CunmG5zG5kq6CLtVJzaDjjLsQ5aN` |

当前边界：GitHub 可写 `main` 已合并 PR `#1`（merge commit `cdc713b2d465f625fbc34ee39fdadf08de4f2e7d`），正式域名已命中本轮新制品。未使用付费生成调用，未验证外部小红书发布或读者效果；上游 PR `#13` 仍等待上游维护者处理。
