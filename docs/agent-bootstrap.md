# Agent 配置清单

本清单面向在一台新机器上帮助用户准备 Agent 小红书工作台的 Agent。它只使用公开软件的标准安装方式，不复制另一台机器的环境、账户或浏览器数据。

## 交付物与环境的边界

仓库中已经包含项目特有的 Agent 编排、系统提示、任务 schema、Skill 副本、图片渲染规则和发布保护。不要从其他机器复制以下内容：

- `node_modules`、Python 虚拟环境、全局 npm 目录或 Codex 安装目录。
- Chrome 用户资料、Cookie、账号密码、令牌或 Browser Bridge 的会话状态。
- `.data/`、`output/`、`public/generated/`、`public/brand/avatars/`、`public/brand/actions/` 中的任何文件。

## 标准准备步骤

1. 安装 Node.js `>= 22.13` 与 Git，并确认 `node --version`、`npm --version`、`git --version` 可执行。
2. 按 Codex 官方说明安装并登录 Codex CLI，确认 `codex --version` 可执行。Codex CLI 不属于本仓库的文件。
3. 克隆本仓库，在根目录运行 `npm install`。这会从公开 npm registry 安装本项目声明的依赖，不需要克隆其他运行时项目。
4. 运行 `npm run verify:runtime`；通过后运行 `npm test`。
5. 需要小红书读取或发布时，在 Chrome 安装 OpenCLI Browser Bridge，登录当前用户自己的小红书账号，并按扩展提示连接会话。
6. 运行 `npm run dev`，打开默认本地地址；新建内容账号并输入该账号的定位。每个账号的品牌、热点缓存、稿件与故事线彼此隔离。

如使用 GitHub Release 的 Windows 安装包，无需执行 `npm install` 或 `npm run dev`；但 Codex CLI、Chrome 与 OpenCLI Browser Bridge 仍是用户机器上的外部前置条件。桌面启动器把运行数据写入当前 Windows 用户的应用数据目录，而不写入安装目录。

## 验收条件

- `npm run verify:runtime` 能显示项目内 OpenCLI 和系统 Codex CLI 的版本。
- `npm test` 通过。
- `GET /api/status` 返回 `codex.installed=true` 与 `opencli.installed=true`。
- 新工作区没有继承任何他人的账号定位、热点 URL、文稿、角色图片、`output/` 文件或发布故事线。
- 共享浏览器会话只作为研究执行账号；点击“刷新本账号热点”时必须按当前内容账号的定位检索，不能将热点缓存共享给其他账号。
- 品牌角色从用户本地上传的 PNG、JPG 或 WebP 母版开始；图片只保存在被 Git 忽略的 `public/brand/avatars/`，系列动作只保存在 `public/brand/actions/`。
- 用户选择的配图数量必须是 1–6，并贯穿初稿卡片、去 AI 味、角色动作、渲染预览和发布。
- 热点证据必须同时通过纯图文媒体校验和互动门槛：赞至少 300、藏至少 100，或赞藏合计至少 400；评论不能单独达标。
- 每轮确认产出会写入 `output/<账号>/<日期>/<版本>/`，其中包含 `note.md`、配图与 `manifest.json`；目录必须追加而不能覆盖。
- 发布账号默认未绑定。只有用户在当前浏览器会话手动切换至目标账号、明确理解风控提示并启用绑定后，才允许进入发布或暂存操作。
- 故事线仅允许在用户点击“已发布”后记录当前内容账号；不要把 failed、unknown 或 draft_saved 本地任务自动升级为已发布。

## 禁止事项

- 不要为了让流程“立即可用”而复制他人的 Chrome 用户资料或 `.data/` 目录。
- 不要把公共工具的二进制、全局缓存或机器专属路径提交进 Git。
- 在未完成完整预览和明确确认前，不要执行任何发布动作。
