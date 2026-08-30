export const DESIGN_PROGRAM_SCHEMA = "xiaoshimei.design-program.v1";

export const DESIGN_PROGRAM_COMPOSITIONS = Object.freeze([
  "cover-focus",
  "editorial-flow",
  "feature-lead",
  "quiet-coda",
]);

export const DESIGN_PROGRAM_RHYTHMS = Object.freeze(["steady", "lead-heavy", "breathing"]);
export const DESIGN_PROGRAM_IMAGE_EDGES = Object.freeze(["right-first", "left-first"]);
export const DESIGN_PROGRAM_IMAGE_SCALES = Object.freeze(["compact", "balanced", "generous"]);
export const DESIGN_PROGRAM_TITLE_MEASURES = Object.freeze(["narrow", "balanced", "wide"]);
export const DESIGN_PROGRAM_WHITESPACE_ANCHORS = Object.freeze(["after-title", "between", "bottom"]);
export const DESIGN_PROGRAM_FOCAL_ROLES = Object.freeze(["title", "hero", "support", "detail"]);

const enumSet = (values) => new Set(values);
const COMPOSITIONS = enumSet(DESIGN_PROGRAM_COMPOSITIONS);
const RHYTHMS = enumSet(DESIGN_PROGRAM_RHYTHMS);
const IMAGE_EDGES = enumSet(DESIGN_PROGRAM_IMAGE_EDGES);
const IMAGE_SCALES = enumSet(DESIGN_PROGRAM_IMAGE_SCALES);
const TITLE_MEASURES = enumSet(DESIGN_PROGRAM_TITLE_MEASURES);
const WHITESPACE_ANCHORS = enumSet(DESIGN_PROGRAM_WHITESPACE_ANCHORS);
const FOCAL_ROLES = enumSet(DESIGN_PROGRAM_FOCAL_ROLES);

function cleanEnum(value, allowed, fallback) {
  const normalized = String(value || "").trim().toLowerCase();
  return allowed.has(normalized) ? normalized : fallback;
}

function panelCountFor(page) {
  return Array.isArray(page?.info_panels) ? page.info_panels.length : 0;
}

function semanticHeroIndex(page) {
  const panels = Array.isArray(page?.info_panels) ? page.info_panels : [];
  const index = panels.findIndex((panel) => panel?.content_role === "hero");
  return index >= 0 ? index : 0;
}

export function fallbackDesignProgram(page, pageIndex = 0) {
  const role = String(page?.page_role || (pageIndex === 0 ? "hook" : "example")).toLowerCase();
  const panelCount = panelCountFor(page);
  const heroIndex = semanticHeroIndex(page);
  const copyLength = String(page?.title || "").replace(/\s/g, "").length
    + String(page?.body || "").replace(/\s/g, "").length
    + (Array.isArray(page?.info_panels) ? page.info_panels : []).reduce((sum, panel) => sum
      + String(panel?.title || "").replace(/\s/g, "").length
      + String(panel?.body || "").replace(/\s/g, "").length, 0);
  const isCover = pageIndex === 0 || role === "hook";
  const isClosing = role === "closing";
  const isLeadPage = ["judgment", "comparison", "pitfall"].includes(role) || heroIndex > 0;
  return {
    schema: DESIGN_PROGRAM_SCHEMA,
    composition: isCover ? "cover-focus" : isClosing ? "quiet-coda" : isLeadPage ? "feature-lead" : "editorial-flow",
    focal_order: isCover ? ["title", "hero"] : isClosing ? ["title", "support", "hero"] : ["title", "hero", "support", "detail"],
    rhythm: isCover ? "breathing" : isLeadPage ? "lead-heavy" : panelCount <= 2 && copyLength < 190 ? "breathing" : "steady",
    // Old drafts usually have hero_panel=0 on every page. Include pageIndex so
    // the deterministic fallback still creates a readable left/right sequence
    // instead of repeating the same inner-page silhouette five times.
    image_edge: (pageIndex + heroIndex) % 2 === 0 ? "right-first" : "left-first",
    image_scale: panelCount >= 4 || copyLength > 310 ? "compact" : panelCount <= 2 ? "generous" : "balanced",
    title_measure: String(page?.title || "").replace(/\s/g, "").length > 18 ? "wide" : isCover ? "wide" : "balanced",
    whitespace_anchor: panelCount <= 2 ? "bottom" : isLeadPage ? "between" : "after-title",
    hero_panel: Math.max(0, Math.min(Math.max(0, panelCount - 1), heroIndex)),
    copy_alignment: "opposite-edge",
  };
}

export function normalizeDesignProgram(value, page, pageIndex = 0) {
  const fallback = fallbackDesignProgram(page, pageIndex);
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const panelCount = panelCountFor(page);
  const requestedFocalOrder = Array.isArray(source.focal_order)
    ? source.focal_order.map((item) => cleanEnum(item, FOCAL_ROLES, "")).filter(Boolean)
    : fallback.focal_order;
  const focalOrder = [...new Set(requestedFocalOrder)];
  if (!focalOrder.includes("title")) focalOrder.unshift("title");
  if (!focalOrder.includes("hero")) focalOrder.push("hero");
  // The semantic content role owns which panel is the hero. The model may
  // reference that role, but cannot silently contradict the content contract.
  const heroPanel = panelCount > 0 ? semanticHeroIndex(page) : 0;
  return {
    schema: DESIGN_PROGRAM_SCHEMA,
    composition: cleanEnum(source.composition, COMPOSITIONS, fallback.composition),
    focal_order: focalOrder.slice(0, 4),
    rhythm: cleanEnum(source.rhythm, RHYTHMS, fallback.rhythm),
    image_edge: cleanEnum(source.image_edge, IMAGE_EDGES, fallback.image_edge),
    image_scale: cleanEnum(source.image_scale, IMAGE_SCALES, fallback.image_scale),
    title_measure: cleanEnum(source.title_measure, TITLE_MEASURES, fallback.title_measure),
    whitespace_anchor: cleanEnum(source.whitespace_anchor, WHITESPACE_ANCHORS, fallback.whitespace_anchor),
    hero_panel: heroPanel,
    // The opposite-edge rule is a product invariant, not a model preference.
    copy_alignment: "opposite-edge",
  };
}

function rowTrackFor(program, panelCount) {
  if (panelCount < 1) return "1fr";
  if (program.rhythm !== "lead-heavy" || panelCount === 1) return `repeat(${panelCount}, minmax(0, 1fr))`;
  const weights = Array.from({ length: panelCount }, (_, index) => index === program.hero_panel ? 1.22 : 1);
  return weights.map((weight) => `${weight}fr`).join(" ");
}

export function designProgramStyle(programValue, page, pageIndex = 0) {
  const program = normalizeDesignProgram(programValue, page, pageIndex);
  const panelCount = panelCountFor(page);
  const gaps = { steady: 3.1, "lead-heavy": 2.55, breathing: 4.4 };
  const imageHeights = { compact: 82, balanced: 92, generous: 100 };
  const titleWidths = { narrow: 76, balanced: 90, wide: 100 };
  const topMargins = { "after-title": 5.2, between: 4.1, bottom: 3.5 };
  return {
    "--design-panel-rows": rowTrackFor(program, panelCount),
    "--design-panel-gap": `${gaps[program.rhythm]}cqw`,
    "--design-image-height": `${imageHeights[program.image_scale]}%`,
    "--design-title-width": `${titleWidths[program.title_measure]}%`,
    "--design-panels-top": `${topMargins[program.whitespace_anchor]}cqw`,
  };
}

export function designProgramLayout(programValue, page, pageIndex = 0) {
  const program = normalizeDesignProgram(programValue, page, pageIndex);
  if (program.composition === "cover-focus") return "cover-poster";
  if (program.composition === "quiet-coda") return "visual-story";
  return program.composition === "feature-lead" ? "editorial-notes" : "spatial-list";
}
