export const SMART_LAYOUT_RECIPES = Object.freeze([
  { id: "editorial-cover", label: "强标题封面", note: "大标题先建立主题，单张主视觉负责记忆点", panelCounts: [0] },
  { id: "editorial-scene", label: "场景叙事", note: "一幅大场景承接一段完整观点", panelCounts: [0] },
  { id: "editorial-hero", label: "主次展开", note: "一个重点单元主导，两组证据辅助", panelCounts: [3] },
  { id: "editorial-flow", label: "连续图文", note: "插图随段落自然穿插，形成一页连续阅读路径", panelCounts: [3] },
  { id: "editorial-steps", label: "步骤穿插", note: "插图与说明交替推进，形成阅读节奏", panelCounts: [3, 4] },
  { id: "editorial-split", label: "双栏对照", note: "两个单元并列比较或前后承接", panelCounts: [2] },
  { id: "editorial-mosaic", label: "重点拼贴", note: "一幅主图加多幅辅助图，避免等权九宫格", panelCounts: [3, 4] },
]);

const RECIPE_IDS = new Set(SMART_LAYOUT_RECIPES.map((recipe) => recipe.id));
const COMPARISON_ROLES = new Set(["comparison", "judgment"]);
const SEQUENCE_ROLES = new Set(["method", "pitfall", "checklist"]);
const FLOW_VARIANTS = new Set(["flow-lead", "flow-aside", "flow-footer"]);
const FLOW_RELATIONS = new Set(["next", "supports", "contrast"]);
const FLOW_ENGINE_VERSION = "editorial-flow-v5";

function clampNumber(value, low, high, fallback = low) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(low, Math.min(high, number));
}

function normalizeFlowFrame(value, fallback, path) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
  const frame = {
    x: clampNumber(source?.x, 0, 96, fallback.x),
    y: clampNumber(source?.y, 0, 96, fallback.y),
    width: clampNumber(source?.width, 12, 100, fallback.width),
    height: clampNumber(source?.height, 10, 100, fallback.height),
  };
  if (frame.x + frame.width > 100.0001 || frame.y + frame.height > 100.0001) throw new TypeError(`${path}_OUT_OF_BOUNDS`);
  return frame;
}

function mirrorFrame(frame) {
  return { ...frame, x: 100 - frame.x - frame.width };
}

function editorialFlowCandidate(panels, pattern = "zigzag-left") {
  const base = [
    {
      variant: "flow-lead",
      importance: 3,
      image_frame: { x: 70, y: 3, width: 24, height: 33 },
      text_frame: { x: 5, y: 7, width: 59, height: 23 },
    },
    {
      variant: "flow-aside",
      importance: 2,
      image_frame: { x: 73, y: 36, width: 21, height: 28 },
      text_frame: { x: 5, y: 39, width: 62, height: 23 },
    },
    {
      variant: "flow-footer",
      importance: 2,
      image_frame: { x: 76, y: 70, width: 18, height: 25 },
      text_frame: { x: 5, y: 70, width: 65, height: 23 },
    },
  ];
  const fitted = base.map((item, index) => {
    const requiredHeight = clampNumber(estimatedTextHeight(panels[index], item.text_frame), 18, item.image_frame.height - 4, 22);
    return {
      ...item,
      text_frame: {
        ...item.text_frame,
        y: Math.round((item.image_frame.y + (item.image_frame.height - requiredHeight) / 2) * 10) / 10,
        height: Math.round(requiredHeight * 10) / 10,
      },
    };
  });
  if (pattern !== "zigzag-right") return fitted;
  return fitted.map((item) => ({ ...item, image_frame: mirrorFrame(item.image_frame), text_frame: mirrorFrame(item.text_frame) }));
}

function estimatedTextHeight(panel, frame) {
  const titleLength = String(panel?.title || "").replace(/\s/g, "").length;
  const bodyLength = String(panel?.body || "").replace(/\s/g, "").length;
  const charsPerLine = Math.max(7, Math.floor(frame.width / 4.1));
  const titleLines = Math.max(1, Math.ceil(titleLength / charsPerLine));
  const bodyLines = Math.max(1, Math.ceil(bodyLength / charsPerLine));
  return 5 + titleLines * 5.4 + bodyLines * 3.25;
}

function frameOverlapArea(a, b) {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return width * height;
}

function scoreEditorialFlowCandidate(panels, candidate) {
  const objects = candidate.flatMap((item, index) => [
    { id: `image-${index}`, frame: item.image_frame },
    { id: `text-${index}`, frame: item.text_frame },
  ]);
  let penalty = 0;
  candidate.forEach((item, index) => {
    const requiredHeight = estimatedTextHeight(panels[index], item.text_frame);
    penalty += Math.max(0, requiredHeight - item.text_frame.height) * 2.1;
  });
  for (let first = 0; first < objects.length; first += 1) {
    for (let second = first + 1; second < objects.length; second += 1) {
      penalty += frameOverlapArea(objects[first].frame, objects[second].frame) * 1.8;
    }
  }
  const imageWidths = candidate.map((item) => item.image_frame.width);
  const variety = Math.max(...imageWidths) - Math.min(...imageWidths);
  penalty += Math.max(0, 8 - variety) * 0.8;
  return Math.max(0, Math.round((100 - penalty) * 10) / 10);
}

function genericEditableFrames(panels, pattern = "zigzag-left") {
  const count = panels.length;
  const templates = {
    1: [{ variant: "flow-lead", importance: 3, image_frame: { x: 70, y: 22, width: 24, height: 34 }, text_frame: { x: 5, y: 27, width: 59, height: 28 } }],
    2: [
      { variant: "flow-lead", importance: 3, image_frame: { x: 69, y: 8, width: 25, height: 35 }, text_frame: { x: 5, y: 13, width: 58, height: 25 } },
      { variant: "flow-aside", importance: 2, image_frame: { x: 74, y: 55, width: 20, height: 28 }, text_frame: { x: 5, y: 58, width: 63, height: 24 } },
    ],
    4: [
      { variant: "flow-lead", importance: 3, image_frame: { x: 71, y: 2, width: 23, height: 25 }, text_frame: { x: 5, y: 4, width: 60, height: 19 } },
      { variant: "flow-aside", importance: 2, image_frame: { x: 76, y: 27, width: 18, height: 24 }, text_frame: { x: 5, y: 29, width: 65, height: 18 } },
      { variant: "flow-footer", importance: 2, image_frame: { x: 72, y: 52, width: 22, height: 26 }, text_frame: { x: 5, y: 54, width: 61, height: 18 } },
      { variant: "flow-aside", importance: 2, image_frame: { x: 77, y: 77, width: 17, height: 20 }, text_frame: { x: 5, y: 78, width: 66, height: 18 } },
    ],
  }[count];
  if (!templates) throw new TypeError("EDITABLE_PANEL_LAYOUT_UNSUPPORTED_COUNT");
  const fitted = templates.slice(0, count).map((item, index) => {
    const requiredHeight = clampNumber(estimatedTextHeight(panels[index], item.text_frame), 18, item.text_frame.height, item.text_frame.height);
    return {
      ...item,
      text_frame: { ...item.text_frame, height: Math.max(requiredHeight, item.text_frame.height) },
    };
  });
  if (pattern !== "zigzag-right") return fitted;
  return fitted.map((item) => ({ ...item, image_frame: mirrorFrame(item.image_frame), text_frame: mirrorFrame(item.text_frame) }));
}

export function buildEditablePanelLayout(panels, { pattern = null } = {}) {
  if (!Array.isArray(panels) || panels.length < 1 || panels.length > 4) throw new TypeError("EDITABLE_PANEL_LAYOUT_REQUIRES_ONE_TO_FOUR_PANELS");
  if (panels.length === 3) return buildEditorialFlowLayout(panels, { pattern });
  const frames = genericEditableFrames(panels, pattern || "zigzag-left");
  const readingPath = panels.map((panel) => String(panel.id));
  const heroIndex = Math.max(0, panels.findIndex((panel) => panel?.content_role === "hero"));
  const semanticOrder = [heroIndex, ...panels.map((_, index) => index).filter((index) => index !== heroIndex)];
  return {
    schema_version: LAYOUT_IR_SCHEMA,
    reading_path: readingPath,
    focal_panel_id: readingPath[heroIndex],
    placements: Object.fromEntries(readingPath.map((id, index) => [id, {
      variant: frames[semanticOrder.indexOf(index)].variant,
      importance: panels[index]?.content_role === "hero" ? 3 : panels[index]?.content_role === "detail" ? 1 : 2,
      anchor: index === heroIndex ? "page" : readingPath[Math.max(0, index - 1)],
      text_frame: frames[semanticOrder.indexOf(index)].text_frame,
      image_frame: frames[semanticOrder.indexOf(index)].image_frame,
      manual_override: { text: false, image: false },
    }])),
    relations: readingPath.slice(0, -1).map((id, index) => ({ from: id, to: readingPath[index + 1], kind: "next" })),
    engine: { version: FLOW_ENGINE_VERSION, pattern: pattern === "zigzag-right" ? "zigzag-right" : "zigzag-left", score: 88 },
  };
}

export function buildEditorialFlowLayout(panels, { pattern = null } = {}) {
  if (!Array.isArray(panels) || panels.length !== 3) throw new TypeError("EDITORIAL_FLOW_REQUIRES_THREE_PANELS");
  const candidates = ["zigzag-left", "zigzag-right"].map((candidatePattern) => {
    const frames = editorialFlowCandidate(panels, candidatePattern);
    return { pattern: candidatePattern, frames, score: scoreEditorialFlowCandidate(panels, frames) };
  });
  const selected = (pattern && candidates.find((item) => item.pattern === pattern))
    || candidates.sort((a, b) => b.score - a.score || (a.pattern === "zigzag-left" ? -1 : 1))[0];
  const readingPath = panels.map((panel) => String(panel.id));
  const heroIndex = Math.max(0, panels.findIndex((panel) => panel?.content_role === "hero"));
  const semanticOrder = [heroIndex, ...panels.map((_, index) => index).filter((index) => index !== heroIndex)];
  return {
    schema_version: LAYOUT_IR_SCHEMA,
    reading_path: readingPath,
    focal_panel_id: readingPath[heroIndex],
    placements: Object.fromEntries(readingPath.map((id, index) => [id, {
      variant: selected.frames[semanticOrder.indexOf(index)].variant,
      importance: panels[index]?.content_role === "hero" ? 3 : panels[index]?.content_role === "detail" ? 1 : 2,
      anchor: index === heroIndex ? "page" : readingPath[Math.max(0, index - 1)],
      text_frame: selected.frames[semanticOrder.indexOf(index)].text_frame,
      image_frame: selected.frames[semanticOrder.indexOf(index)].image_frame,
      manual_override: { text: false, image: false },
    }])),
    relations: readingPath.slice(0, -1).map((id, index) => ({ from: id, to: readingPath[index + 1], kind: "next" })),
    engine: { version: FLOW_ENGINE_VERSION, pattern: selected.pattern, score: selected.score },
  };
}

export const LAYOUT_IR_SCHEMA = "xiaoshimei.layout-ir.v1";

export function normalizeLayoutIr(value, panelIds = [], panels = []) {
  if (value == null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("LAYOUT_IR_INVALID");
  if (value.schema_version !== LAYOUT_IR_SCHEMA) throw new TypeError("LAYOUT_IR_SCHEMA_INVALID");
  const knownIds = new Set(panelIds.map((id) => String(id)));
  const fallbackVariants = ["flow-lead", "flow-aside", "flow-footer"];
  const readingPath = Array.isArray(value.reading_path) ? value.reading_path.map(String) : [];
  if (readingPath.length !== knownIds.size || new Set(readingPath).size !== readingPath.length || readingPath.some((id) => !knownIds.has(id))) {
    throw new TypeError("LAYOUT_IR_READING_PATH_INVALID");
  }
  const panelValues = Array.isArray(panels) && panels.length === readingPath.length
    ? panels
    : readingPath.map((id) => ({ id, title: id, body: id }));
  const automaticLayout = buildEditablePanelLayout(panelValues, { pattern: value.engine?.pattern });
  const placements = {};
  for (const [index, id] of readingPath.entries()) {
    const source = value.placements?.[id];
    if (!source || typeof source !== "object" || Array.isArray(source)) throw new TypeError("LAYOUT_IR_PLACEMENT_MISSING");
    const variant = String(source.variant || fallbackVariants[index] || "flow-footer");
    if (!FLOW_VARIANTS.has(variant)) throw new TypeError("LAYOUT_IR_VARIANT_INVALID");
    const importance = Number(source.importance ?? (index === 0 ? 3 : 2));
    placements[id] = {
      variant,
      importance: Math.min(3, Math.max(1, Number.isFinite(importance) ? Math.round(importance) : 2)),
      anchor: typeof source.anchor === "string" && source.anchor.trim() ? source.anchor.trim() : index === 0 ? "page" : readingPath[index - 1],
      text_frame: normalizeFlowFrame(source.text_frame, automaticLayout.placements[id].text_frame, `LAYOUT_IR_${id}_TEXT_FRAME`),
      image_frame: normalizeFlowFrame(source.image_frame, automaticLayout.placements[id].image_frame, `LAYOUT_IR_${id}_IMAGE_FRAME`),
      manual_override: {
        text: Boolean(source.manual_override?.text),
        image: Boolean(source.manual_override?.image),
      },
    };
  }
  const relations = Array.isArray(value.relations) ? value.relations.map((relation) => {
    if (!relation || typeof relation !== "object" || !knownIds.has(String(relation.from)) || !knownIds.has(String(relation.to))) {
      throw new TypeError("LAYOUT_IR_RELATION_INVALID");
    }
    const kind = String(relation.kind || "next");
    if (!FLOW_RELATIONS.has(kind)) throw new TypeError("LAYOUT_IR_RELATION_KIND_INVALID");
    return { from: String(relation.from), to: String(relation.to), kind };
  }) : [];
  const focalPanelId = String(value.focal_panel_id || readingPath[0] || "");
  if (!knownIds.has(focalPanelId)) throw new TypeError("LAYOUT_IR_FOCAL_INVALID");
  return {
    schema_version: LAYOUT_IR_SCHEMA,
    reading_path: readingPath,
    focal_panel_id: focalPanelId,
    placements,
    relations,
    engine: {
      version: typeof value.engine?.version === "string" ? value.engine.version : automaticLayout.engine.version,
      pattern: ["zigzag-left", "zigzag-right"].includes(value.engine?.pattern) ? value.engine.pattern : automaticLayout.engine.pattern,
      score: clampNumber(value.engine?.score, 0, 100, automaticLayout.engine.score),
    },
  };
}

export function normalizeLayoutRecipe(value, fallback = null) {
  if (value == null || value === "") return fallback;
  const normalized = String(value).trim();
  if (!RECIPE_IDS.has(normalized)) throw new TypeError("LAYOUT_RECIPE_INVALID");
  return normalized;
}

export function layoutRecipeOptionsForPage(page) {
  const panelCount = Array.isArray(page?.info_panels) ? page.info_panels.length : 0;
  return SMART_LAYOUT_RECIPES.filter((recipe) => recipe.panelCounts.includes(panelCount));
}

export function selectSmartLayoutRecipe({ pageRole, panelCount = 0, pageIndex = 0, previousRecipe = null } = {}) {
  const role = String(pageRole || "");
  const count = Number(panelCount) || 0;
  if (Number(pageIndex) === 0 || role === "hook") return "editorial-cover";
  if (count === 0) return "editorial-scene";
  if ((COMPARISON_ROLES.has(role) && count === 2) || count === 2) return "editorial-split";
  if (count === 4) return previousRecipe === "editorial-mosaic" ? "editorial-steps" : "editorial-mosaic";
  if (count === 3 && SEQUENCE_ROLES.has(role)) return previousRecipe === "editorial-steps" ? "editorial-hero" : "editorial-steps";
  if (count === 3) return previousRecipe === "editorial-hero" ? "editorial-steps" : "editorial-hero";
  return "editorial-scene";
}

export function layoutRecipeForPage(page, pageIndex = 0, previousRecipe = null) {
  const explicit = normalizeLayoutRecipe(page?.layout_recipe, null);
  if (explicit) return explicit;
  return selectSmartLayoutRecipe({
    pageRole: page?.page_role,
    panelCount: Array.isArray(page?.info_panels) ? page.info_panels.length : 0,
    pageIndex,
    previousRecipe,
  });
}

export function applySmartLayoutSequence(pages) {
  if (!Array.isArray(pages)) return [];
  let previousRecipe = null;
  return pages.map((page, pageIndex) => {
    const layoutRecipe = selectSmartLayoutRecipe({
      pageRole: page?.page_role,
      panelCount: Array.isArray(page?.info_panels) ? page.info_panels.length : 0,
      pageIndex,
      previousRecipe,
    });
    previousRecipe = layoutRecipe;
    return { ...page, layout_recipe: layoutRecipe };
  });
}

export function materializeEditablePanelLayouts(pages) {
  if (!Array.isArray(pages)) return [];
  return pages.map((page, pageIndex) => {
    const panels = Array.isArray(page?.info_panels) ? page.info_panels : [];
    if (panels.length < 1 || panels.length > 4) return page;
    if (page?.layout_ir?.engine?.version === FLOW_ENGINE_VERSION) return page;
    return {
      ...page,
      layout_ir: buildEditablePanelLayout(panels, {
        pattern: pageIndex % 2 === 0 ? "zigzag-right" : "zigzag-left",
      }),
    };
  });
}

export function inspectSmartLayoutPage(page, pageIndex = 0, previousRecipe = null) {
  const issues = [];
  const panelCount = Array.isArray(page?.info_panels) ? page.info_panels.length : 0;
  let recipe;
  try { recipe = layoutRecipeForPage(page, pageIndex, previousRecipe); }
  catch { return [{ code: "LAYOUT_RECIPE_INVALID", page: pageIndex + 1 }]; }
  if ((pageIndex === 0 || page?.page_role === "hook") && recipe !== "editorial-cover") {
    issues.push({ code: "COVER_RECIPE_REQUIRED", page: pageIndex + 1 });
  }
  if (panelCount >= 3 && !new Set(["editorial-hero", "editorial-flow", "editorial-steps", "editorial-mosaic"]).has(recipe)) {
    issues.push({ code: "VISUAL_HIERARCHY_MISSING", page: pageIndex + 1 });
  }
  if (recipe === "editorial-flow" && (!page?.layout_ir || page.layout_ir.reading_path?.length !== panelCount)) {
    issues.push({ code: "EDITORIAL_FLOW_IR_REQUIRED", page: pageIndex + 1 });
  }
  if (pageIndex > 0 && recipe === previousRecipe && !new Set(["editorial-scene", "editorial-split"]).has(recipe)) {
    issues.push({ code: "ADJACENT_RECIPE_REPEATED", page: pageIndex + 1 });
  }
  if (panelCount > 0) {
    const unmatched = page.info_panels.some((panel) => !panel?.title?.trim() || !panel?.body?.trim() || !panel?.image_style?.src);
    if (unmatched) issues.push({ code: "PANEL_COPY_IMAGE_PAIR_INCOMPLETE", page: pageIndex + 1 });
  }
  return issues;
}

export function inspectSmartLayoutSequence(pages) {
  if (!Array.isArray(pages)) return [{ code: "PAGES_INVALID", page: 0 }];
  const issues = [];
  let previousRecipe = null;
  pages.forEach((page, pageIndex) => {
    issues.push(...inspectSmartLayoutPage(page, pageIndex, previousRecipe));
    previousRecipe = layoutRecipeForPage(page, pageIndex, previousRecipe);
  });
  return issues;
}
