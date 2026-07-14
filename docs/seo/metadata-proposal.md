# 公开仓库 SEO 元数据方案

## 变更身份

- `experiment_id`: `exp-public-launch-seo-20260714-001`
- `status`: `implemented_for_initial_public_launch`
- `scope`: GitHub 仓库名称、仓库描述、Topics、README 首屏和可访问的结构化文档。
- `out_of_scope`: 搜索排名承诺、付费推广、外链建设、伪造使用数据、对平台官方关系的暗示。

## 已核验的产品事实

| 事实 | 代码或文档依据 |
| --- | --- |
| 本地工作台由 Codex CLI 作为外部前置条件运行 | `server/agent-runner.mjs`、`README.md` |
| 热点研究过滤视频、混合媒体和未知媒体 | `server/agent-runner.mjs`、`scripts/probe-xhs-media.mjs` |
| 工作流包含热点拆解、原始文稿、去 AI 味、配图、预览和发布确认 | `server/agent-runner.mjs`、`src/` |
| 内置 Lingzao、中文去 AI 味和 OpenCLI Browser Skill | `.agents/skills/`、`skills-lock.json` |
| 公开版本不应包含用户账号、历史内容或发布数据 | `.gitignore`、`AGENTS.md`、`SECURITY.md` |

## 推荐元数据

- 仓库名：`agent-xiaohongshu-workbench`
- GitHub 描述：`小红书图文内容工作台：用 Codex Agent 完成热点研究、内容拆解、原创文稿、去 AI 味、品牌配图与人工确认发布。`
- Topics：`xiaohongshu`、`xhs`、`ai-agent`、`codex`、`content-creation`、`content-workflow`、`browser-automation`、`chinese-writing`

## 检索意图与 README 覆盖

| 意图 | 自然覆盖位置 | 避免事项 |
| --- | --- | --- |
| 小红书内容工作台 | README 标题、首段和“它解决什么问题” | 不堆叠同义词、不暗示官方关系 |
| 小红书图文创作 | 工作流、媒体过滤和预览说明 | 不声称保证爆款或数据增长 |
| Codex Agent 内容工作流 | 首段、运行模型与依赖 | 不将 Codex CLI 误写为随仓库分发 |
| 中文去 AI 味 | 工作流、Skill 清单 | 不承诺固定文风或规避平台规则 |

## 上线后验证

1. 用 `gh repo view` 核验公开可见性、描述和 Topics。
2. 用匿名浏览器检查 README 首屏、Logo、克隆命令和外部前置条件。
3. 仅在有足够时间窗口后记录 GitHub 搜索发现情况；不要把品牌词或精确仓库名当作自然发现增长。
4. 如果 README、描述、Topics 或默认分支在比较周期内变化，后续排名比较必须标记为 `confounded`。
