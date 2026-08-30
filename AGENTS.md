# Agent小红书工作台：项目指引

## 产品边界

- 这是本地优先、可部署到 Vercel 的单账号图文内容工作台。文字与配图可通过火山方舟或 OpenAI 兼容 Provider 生成；必须保持先确认文字、再付费生成图片的边界。
- 浏览器读取和小红书发布仍通过用户自己的 OpenCLI Browser Bridge 登录会话完成；应用不读取、复制或保存 Cookie、账号密码。云端 BYOK Key 只存在当前标签页 `sessionStorage`，本地 Key 只存在 macOS Keychain 或进程环境，不得写入源码、日志或 Git。
- 研究只接纳经媒体探针确认的纯图文笔记：`mediaKind=graphic`、`hasVideo=false`、`imageCount>=1`。视频、混合媒体与无法确认的媒体一律排除。
- 发布必须经过完整预览确认和独立动作确认。`publish_now` 需返回可验证的笔记 ID 或 URL；`save_draft` 只能点击小红书创作页文字完全一致的“暂存离开”，绝不点击“发布”。
- 不使用 Superpowers。热点拆解只使用随项目分发的 Lingzao Skill；不调用 Lingzao API、积分服务或生图服务。

## 内置依赖与路径

- Codex Agent 任务固定使用 `gpt-5.6-terra`。拆解、初稿、中文去 AI 味与涉及文稿的修改使用 `high`；检索、头像/配图、纯视觉修改和发布使用 `medium`。
- 项目内置的 Skill 在 `.agents/skills/`：`lingzao`、`humanized-chinese-writing-polisher` 与 `opencli-browser`。不得要求用户另行克隆或安装这些 Skill。
- 运行依赖由根目录 `package.json` 安装：`@jackwener/opencli`。Codex CLI 是外部前置条件，必须由每位用户自行安装并登录；Chrome 扩展和小红书登录态同样属于必要个人配置，不能随仓库分发。

## 隐私与公开发布

- `.data/`、`public/generated/`、`public/brand/avatars/` 与 `public/brand/actions/` 是运行时用户数据，必须保持未跟踪。
- `npm start` 默认把新生成图片、Provider 回执和工作状态写入 `~/.mesy/runtime/packages/xiaoshimei-studio-v2/`；源码树只保留空目录占位、测试夹具、逻辑地图和最小结果记录。
- 不要把账号定位、热点 URL、笔记正文、评论、发布记录、浏览器日志、Cookie、令牌、截图或用户上传头像写入源码、测试夹具、文档或 Git 历史。
- 新安装从空白状态开始；只有用户主动输入定位并生成/上传品牌角色后，才可执行后续流程。
- 品牌角色必须支持用户本地上传。Agent 需从上传母版提取脸部、发型、穿着、比例与渲染方式的身份锁，并生成 6 个只改变动作、手势和表情的系列形象；后续配图必须同时参考母版与该系列，不得硬编码某个示例人物。
- 每轮内容的配图数量由用户选择，合法范围为 1–6 张；该数量从初稿卡片、去 AI 味、角色动作、最终渲染到发布必须始终一致。
- 热点研究只接纳有可验证点赞与收藏数据的爆款图文：点赞至少 300，或收藏至少 100，或点赞与收藏合计至少 400。评论数不得单独使笔记达标，因为其中可能包含作者自评；不达标或指标缺失的笔记不能进入 signals、选题证据或拆解。
- 故事线仍只收录有笔记 ID 或公开 URL 的已发布内容。除发布成功即时归档外，工作台必须提供只读的创作后台历史同步，用于跨版本、清空本地数据或旧任务未归档后的恢复；不得把 failed、unknown 或 draft_saved 自动当成已发布。

## 源码与发布权威

- GitHub `LeonWu123456/agent-xiaohongshu-workbench` 的 `main` 是当前可写正式源码权威；上游 `EthanYoQ/agent-xiaohongshu-workbench` 仅通过 PR 同步。本地目录是工作副本，不得长期承载未推送的唯一实现。
- `xiaoshimei-v2` 等功能分支必须先通过 `npm test`、`npm run build`、Vercel Preview 和桌面/窄屏浏览器验收，再合并 `main`。
- 正式 Vercel 项目只维护 `xiaoshimei-full-workbench` 这一入口；不得再造 layout-preview、share-site 或第二套线上工作台。
- 每次生产提升都要把 commit、Preview、Production deployment、正式域名回读和 rollback deployment 写入 `deployment/PRODUCTION_RUNBOOK.md`，并同步更新 `XIAOSHIMEI_WORKBENCH_FULL_LOGIC_MAP.md` 的五层真相。
