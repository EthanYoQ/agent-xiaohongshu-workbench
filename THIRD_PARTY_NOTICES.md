# 第三方组件与 Skill 说明

本仓库分发的代码和 Skill 保留各自的许可证。根目录 [LICENSE](./LICENSE) 只覆盖本项目原创代码和文档，不改变下列组件的许可。

| 组件 | 在本项目中的位置 | 来源 | 许可证 |
| --- | --- | --- | --- |
| Lingzao Skill（最小摘录） | `.agents/skills/lingzao/` | [atian-create/lingzao-skill](https://github.com/atian-create/lingzao-skill) | MIT No Attribution / MIT-0 |
| 中文去 AI 味 Skill | `.agents/skills/humanized-chinese-writing-polisher/` | 本地项目 Skill 的可分发副本 | MIT |
| OpenCLI Browser Skill | `.agents/skills/opencli-browser/` | [jackwener/opencli](https://github.com/jackwener/opencli) | Apache-2.0 |
| OpenCLI 运行依赖 | `package.json` | [jackwener/opencli](https://github.com/jackwener/opencli) | Apache-2.0 |
| Lucide 图标 | `docs/assets/icons/` | 通过本地 Better Icons MCP 获取的 `lucide` 图标 | ISC |

各随仓库分发的 Skill 目录都保留了其原始 `LICENSE` 文件。Lingzao 仅保留当前工作流读取的 `SKILL.md` 与两份 playbook，不包含上游 CLI、Python 客户端或安装脚本。`skills-lock.json` 记录了 Skill 来源、路径、最小摘录范围和许可证。

Codex CLI 是用户自行安装的外部前置条件，不随本仓库分发。请参考其上游许可和使用条款。
