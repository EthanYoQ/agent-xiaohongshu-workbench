export function createBrandCharacter() {
  return {
    status: "not_started",
    brief: "",
    locked: false,
    source: "awaiting-user-upload",
    avatar: null,
    identityLock: null,
    series: [],
    generationIssue: null,
    updatedAt: null,
  };
}

export function createBrandVisualIdentity() {
  return {
    version: "agent-xhs-brand-v2",
    name: "暖纸内容手账",
    palette: {
      paper: "#FFF8EA",
      ink: "#332923",
      primary: "#5A3828",
      accent: "#F18C70",
      soft: "#F4DDB9",
    },
    topicAccents: ["#F18C70", "#D8A05E", "#9E6D55", "#DB6B5D"],
    typography: "粗圆黑体标题配清爽无衬线正文，标题短而有停顿感",
    composition: "1080×1440；左上标题、中央信息、右下品牌角色；四周至少 72px 安全边距",
    characterPlacement: "每张图右下角，角色约占画布宽度 25%，动作与该页文案语义一致",
    visualRules: [
      "长期固定奶油底色、可可棕主色、珊瑚橙强调色",
      "选题只能从品牌辅助色中选择一个主题强调色",
      "卡片保留深棕细线框、暖色标签和充足留白",
      "角色始终位于右下角，不遮挡标题和核心正文",
    ],
  };
}

export function createDefaultState() {
  return {
    positioning: "",
    research: {
      mode: "not_started",
      updatedAt: null,
      summary: "填写账号定位后，让本地 Codex Agent 扫描已登录的小红书图文热点。",
      signals: [],
      topics: [],
    },
    selectedTopicId: null,
    breakdown: null,
    selectedVisualDirectionId: null,
    brandCharacter: createBrandCharacter(),
    brandVisualIdentity: createBrandVisualIdentity(),
    generationSettings: { imageCount: 4 },
    draft: null,
    copyVersions: { raw: null, humanized: null },
    humanization: null,
    assets: [],
    review: null,
    publish: { status: "not_started", noteId: null, url: null, message: "尚未发布" },
    storyline: { entries: [], updatedAt: null },
    storylineSync: { status: "not_started", imported: 0, updatedAt: null, message: "尚未同步创作后台" },
    lastJobId: null,
  };
}
