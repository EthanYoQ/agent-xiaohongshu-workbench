export const CONTENT_STRATEGY_SCHEMA = "xiaoshimei.content-strategy.v1";

export const XHS_CONTENT_TYPES = Object.freeze([
  "knowledge_card",
  "material_notes",
  "method_checklist",
  "case_breakdown",
  "product_seeding",
  "emotional_resonance",
]);

export const XHS_PAGE_ROLES = Object.freeze([
  "hook",
  "conclusion",
  "judgment",
  "method",
  "pitfall",
  "comparison",
  "example",
  "checklist",
  "closing",
]);

export const PANEL_CONTENT_ROLES = Object.freeze(["hero", "support", "detail"]);
export const SHOT_ROLES = Object.freeze(["scene", "action", "detail", "comparison"]);

const CONTENT_TYPE_SET = new Set(XHS_CONTENT_TYPES);
const PAGE_ROLE_SET = new Set(XHS_PAGE_ROLES);
const PANEL_CONTENT_ROLE_SET = new Set(PANEL_CONTENT_ROLES);
const SHOT_ROLE_SET = new Set(SHOT_ROLES);
const STYLE_LOCK_SCHEMA = "xiaoshimei.style-lock.v1";
function requiredString(value, path) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${path} must be a non-empty string`);
  return value.trim();
}

export function normalizeXhsContentType(value, path = "content_type") {
  if (!CONTENT_TYPE_SET.has(value)) throw new TypeError(`${path} is not supported`);
  return value;
}

export function normalizeXhsPageRole(value, path = "page_role") {
  if (!PAGE_ROLE_SET.has(value)) throw new TypeError(`${path} is not supported`);
  return value;
}

export function normalizePanelContentRole(value, path = "content_role", fallback = null) {
  if (value == null || value === "") return fallback;
  if (!PANEL_CONTENT_ROLE_SET.has(value)) throw new TypeError(`${path} is not supported`);
  return value;
}

export function normalizeShotRole(value, path = "shot_role", fallback = null) {
  if (value == null || value === "") return fallback;
  if (!SHOT_ROLE_SET.has(value)) throw new TypeError(`${path} is not supported`);
  return value;
}

export function normalizeHighlightPhrases(value, sourceText = "", path = "highlight_phrases") {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an array`);
  const source = String(sourceText || "");
  return [...new Set(value.map((item) => String(item || "").trim()).filter((item) => item.length >= 2 && item.length <= 18 && source.includes(item)))].slice(0, 3);
}

export function buildXiaoshimeiStyleLock(profile) {
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) throw new TypeError("profile is required for style lock");
  return {
    schema: STYLE_LOCK_SCHEMA,
    identity_anchor: requiredString(profile.fixed_character_ip, "style_lock.identity_anchor"),
    illustration_style: requiredString(profile.visual_atmosphere, "style_lock.illustration_style"),
    color_system: "低饱和米杏、奶油白、深棕为底，朱红只作稳定强调色；自然暖光，肤色不过曝。",
    typography: "图片模型不生成文字；中文标题与正文始终由 Studio 原生文字层排版，封面标题强、内页层级克制。",
    composition_language: "3:4 竖幅；人物与可见动作是主视觉，必须预留清晰文字安全区；封面更强，内容页更安静。",
    material_language: `东方生活真实材质与少量器物：${Array.isArray(profile.allowed_scene_elements) ? profile.allowed_scene_elements.join("、") : "木、纸、布、自然环境"}。`,
    continuity_rule: "同一组保持人物、服装、画风、色温、材质和标题层级一致；只允许动作、景别、器物和页面信息职责变化。",
  };
}

export function normalizeStyleLock(value, path = "style_lock") {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.schema !== STYLE_LOCK_SCHEMA) throw new TypeError(`${path} schema is not supported`);
  return {
    schema: STYLE_LOCK_SCHEMA,
    identity_anchor: requiredString(value.identity_anchor, `${path}.identity_anchor`),
    illustration_style: requiredString(value.illustration_style, `${path}.illustration_style`),
    color_system: requiredString(value.color_system, `${path}.color_system`),
    typography: requiredString(value.typography, `${path}.typography`),
    composition_language: requiredString(value.composition_language, `${path}.composition_language`),
    material_language: requiredString(value.material_language, `${path}.material_language`),
    continuity_rule: requiredString(value.continuity_rule, `${path}.continuity_rule`),
  };
}

export function buildContentStrategy({ contentType, styleLock }) {
  return { schema: CONTENT_STRATEGY_SCHEMA, content_type: normalizeXhsContentType(contentType), style_lock: normalizeStyleLock(styleLock) };
}

export function normalizeContentStrategy(value, path = "content_strategy") {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.schema !== CONTENT_STRATEGY_SCHEMA) throw new TypeError(`${path} schema is not supported`);
  return {
    schema: CONTENT_STRATEGY_SCHEMA,
    content_type: normalizeXhsContentType(value.content_type, `${path}.content_type`),
    style_lock: normalizeStyleLock(value.style_lock, `${path}.style_lock`),
  };
}
