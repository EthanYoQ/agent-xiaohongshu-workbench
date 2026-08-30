# Task View

```mermaid
flowchart LR
  CAP_CREATE["CAP-CREATE<br/>小红书图文端到端生产"]
  BLOCK_IMAGE["BLOCK-IMAGE<br/>插图生成与母版切片"]
  FLOW_MOTHER_SHEET["FLOW-MOTHER-SHEET<br/>母版切片与媒体角色适配"]
  BLOCK_EDITOR["BLOCK-EDITOR<br/>HTML/Fabric 编辑与导出"]
  FLOW_EXPORT["FLOW-EXPORT<br/>发布包导出验证"]
  STATE_REALITY["STATE-REALITY<br/>24h/72h/7d Reality Feedback"]
  POL_REALITY["POL-REALITY<br/>Reality > actor narrative"]
  EVD_IMAGE_TEST["EVD-IMAGE-TEST<br/>母版切片回归测试"]
  EVD_EXPORT_TEST["EVD-EXPORT-TEST<br/>导出图片真实性测试"]
  EVD_REALITY_TEST["EVD-REALITY-TEST<br/>现实反馈持久化测试"]
  CAP_CREATE -->|contains| BLOCK_IMAGE
  CAP_CREATE -->|contains| BLOCK_EDITOR
  CAP_CREATE -->|contains| STATE_REALITY
  BLOCK_IMAGE -->|contains| FLOW_MOTHER_SHEET
  BLOCK_EDITOR -->|contains| FLOW_EXPORT
  FLOW_MOTHER_SHEET -->|constrained_by| POL_REALITY
  FLOW_EXPORT -->|constrained_by| POL_REALITY
  STATE_REALITY -->|constrained_by| POL_REALITY
  FLOW_MOTHER_SHEET -->|verified_by| EVD_IMAGE_TEST
  FLOW_EXPORT -->|verified_by| EVD_EXPORT_TEST
  STATE_REALITY -->|verified_by| EVD_REALITY_TEST
```

## Problems
- `D08` · RESOLVED_CONFIRMED · 固定 2% 内缩不识别真实网格线和背景
- `D13` · RESOLVED_CONFIRMED · Fabric 导出缺 blank/flat/image-region QA
- `D20` · OPEN_CONFIRMED · Reality feedback 已有但未进入 layout/crop fitness
