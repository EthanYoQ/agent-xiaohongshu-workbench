export const PRODUCTION_MODES = Object.freeze([
  {
    id: "smart",
    label: "智能混排",
    fit: "封面、故事、步骤和总结混合出现",
    result: "系统逐页选择合适结构",
  },
  {
    id: "narrative",
    label: "场景叙事",
    fit: "经历、观点、故事、生活记录",
    result: "大场景插画＋标题＋正文",
  },
  {
    id: "infographic",
    label: "知识信息图",
    fit: "方法、步骤、清单、对比、饮食建议",
    result: "卡片化信息＋分镜插画＋原生文字",
  },
]);

const PRODUCTION_MODE_IDS = new Set(PRODUCTION_MODES.map((mode) => mode.id));
const SMART_INFO_ROLES = new Set(["method", "pitfall", "comparison", "checklist"]);

export function normalizeProductionMode(value, code = "PRODUCTION_MODE_INVALID") {
  const normalized = value == null || value === "" ? "smart" : String(value).trim();
  if (!PRODUCTION_MODE_IDS.has(normalized)) throw new TypeError(code);
  return normalized;
}

export function productionModeLabel(value) {
  const mode = normalizeProductionMode(value);
  return PRODUCTION_MODES.find((item) => item.id === mode).label;
}

export function productionModeUsesInfoPanels(value, pageRole, pageIndex = 0) {
  const mode = normalizeProductionMode(value);
  if (Number(pageIndex) === 0 || pageRole === "hook") return false;
  if (mode === "infographic") return true;
  return mode === "smart" && SMART_INFO_ROLES.has(String(pageRole || ""));
}

export function productionModePlanInstruction(value) {
  const mode = normalizeProductionMode(value);
  if (mode === "narrative") {
    return "本轮使用场景叙事：每页围绕一个连贯生活场景和一个可见人物动作展开；人物与环境是视觉主体，不做多格拼贴、清单卡片或左右对照。第1页仍是独立封面，内页保持叙事连续。";
  }
  if (mode === "infographic") {
    return "本轮使用知识信息图：第1页仍是独立封面；内页按方法、步骤、清单或对比拆成清楚的信息组。image_prompt应规划2–4个彼此分隔、与要点一一对应的小场景或器物分镜，但图片中不得生成任何文字；标题、正文和编号由工作台原生文字层承载。";
  }
  return "本轮使用智能混排：第1页做上半部强标题、下半部主视觉的独立封面；方法、步骤与清单页默认采用单栏连续阅读，让原生文字承担主体，小幅插画穿插在右侧或外侧；故事与观点可用场景叙事，对比用分栏，结尾用留白总结。不要使用等大卡片阵列、大横图或让整组页面机械重复同一种结构。";
}
