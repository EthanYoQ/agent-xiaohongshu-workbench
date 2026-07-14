# Agent 小红书工作台：分享演示站

这是主项目的可分享协作预览站。它用于展示选题编辑、双版本文稿编辑、故事线和发布模式，不接入任何小红书账号或 Codex Agent 会话。

## 数据边界

- 编辑内容只保存在访问者当前浏览器的 `localStorage` 中。
- 站点不接入小红书登录态，不读取 Cookie，也不调用 Codex CLI、OpenCLI、Lingzao、生图或发布流程。
- 热点抓取、品牌角色生成、完整审稿和发布仍由本地 [Agent 小红书工作台](../..) 执行。
- 演示数据为通用示例，不代表任何账号、实时平台热点或实际发布记录。

## 本地验证

在仓库根目录执行：

```powershell
npm install
npm run build:share
npm run test:share
```
