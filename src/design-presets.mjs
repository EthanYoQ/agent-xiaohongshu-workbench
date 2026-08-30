import { PRODUCTION_MODES } from "./production-mode.mjs";
import { selectSmartLayoutRecipe } from "./smart-layout.mjs";

const HEX = /^#[0-9a-f]{6}$/i;

const STYLE_PATCHES = {
  portrait: {
    eyebrow: { x: 7, y: 6, width: 42, fontSize: 28, fontWeight: 700, lineHeight: 1.1, align: "left", color: "#e6773d" },
    title: { x: 7, y: 13, width: 42, fontSize: 58, fontWeight: 800, lineHeight: 1.08, align: "left", color: "#17211e" },
    body: { x: 8, y: 72, width: 48, fontSize: 32, fontWeight: 400, lineHeight: 1.5, align: "left", color: "#354540" },
  },
  quiet: {
    eyebrow: { x: 9, y: 10, width: 38, fontSize: 24, fontWeight: 700, lineHeight: 1.1, align: "left", color: "#805b3d" },
    title: { x: 9, y: 21, width: 78, fontSize: 66, fontWeight: 700, lineHeight: 1.15, align: "left", color: "#17211e" },
    body: { x: 9, y: 48, width: 72, fontSize: 31, fontWeight: 400, lineHeight: 1.62, align: "left", color: "#404b47" },
  },
  split: {
    eyebrow: { x: 7, y: 8, width: 40, fontSize: 26, fontWeight: 700, lineHeight: 1.1, align: "left", color: "#245d77" },
    title: { x: 7, y: 18, width: 48, fontSize: 62, fontWeight: 800, lineHeight: 1.12, align: "left", color: "#17211e" },
    body: { x: 7, y: 51, width: 47, fontSize: 29, fontWeight: 400, lineHeight: 1.56, align: "left", color: "#404b47" },
  },
  list: {
    eyebrow: { x: 8, y: 8, width: 42, fontSize: 26, fontWeight: 700, lineHeight: 1.1, align: "left", color: "#8a473c" },
    title: { x: 8, y: 18, width: 80, fontSize: 64, fontWeight: 800, lineHeight: 1.1, align: "left", color: "#17211e" },
    body: { x: 8, y: 45, width: 78, fontSize: 32, fontWeight: 400, lineHeight: 1.72, align: "left", color: "#404b47" },
  },
};

export const DESIGN_PRESETS = Object.freeze([
  { id: "portrait-cover", label: "人物封面", note: "大标题与人物同场", layout: "scene", style: STYLE_PATCHES.portrait, accent: "#e6773d", soft: "#ffffff", preview: ["#ffffff", "#fd8502"] },
  { id: "quiet-story", label: "留白叙事", note: "安静、适合长句", layout: "cover", style: STYLE_PATCHES.quiet, accent: "#805b3d", soft: "#f1ece4", preview: ["#f1ece4", "#805b3d"] },
  { id: "split-editorial", label: "图文分栏", note: "文字与图片并排", layout: "split", style: STYLE_PATCHES.split, accent: "#245d77", soft: "#e4edef", preview: ["#e4edef", "#245d77"] },
  { id: "focus-list", label: "重点清单", note: "步骤和要点更清楚", layout: "list", style: STYLE_PATCHES.list, accent: "#a6362b", soft: "#f3e4df", preview: ["#f3e4df", "#a6362b"] },
]);

export const COMPOSITION_MODES = Object.freeze(PRODUCTION_MODES.map((mode) => ({
  id: mode.id,
  label: mode.label,
  note: mode.id === "smart" ? "按本页职责自动选版" : mode.id === "narrative" ? "让人物与画面主导" : "突出步骤、清单与对照",
})));

const COMPOSITION_MODE_IDS = new Set(COMPOSITION_MODES.map((mode) => mode.id));

export function compositionModeForPage(page) {
  return COMPOSITION_MODE_IDS.has(page?.composition_mode) ? page.composition_mode : "manual";
}

function presetForComposition(page, mode) {
  const role = String(page?.page_role || "");
  const hasFigure = page?.visual === "character";
  if (mode === "narrative") {
    if (role === "hook") return "portrait-cover";
    return hasFigure ? "split-editorial" : "quiet-story";
  }
  if (mode === "infographic") {
    if (role === "hook") return "portrait-cover";
    return role === "comparison" || role === "judgment" ? "split-editorial" : "focus-list";
  }
  if (role === "hook") return "portrait-cover";
  if (["method", "pitfall", "checklist"].includes(role)) return "focus-list";
  if (["comparison", "judgment"].includes(role)) return "split-editorial";
  return hasFigure ? "split-editorial" : "quiet-story";
}

function finite(value, fallback, low, high) {
  const number = Number(value ?? fallback);
  return Number.isFinite(number) ? Math.max(low, Math.min(high, number)) : fallback;
}

function color(value, fallback) {
  return typeof value === "string" && HEX.test(value) ? value : fallback;
}

export function normalizeBackgroundStyle(value, fallback = "#ffffff") {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const kind = new Set(["solid", "gradient", "image"]).has(value.kind) ? value.kind : "solid";
  return {
    kind,
    color: color(value.color, fallback),
    color2: color(value.color2, "#ffffff"),
    angle: finite(value.angle, 145, 0, 360),
    opacity: finite(value.opacity, 1, 0.1, 1),
    imageSrc: typeof value.imageSrc === "string" ? value.imageSrc : "",
    focalX: finite(value.focalX, 50, 0, 100),
    focalY: finite(value.focalY, 50, 0, 100),
    scale: finite(value.scale, 100, 25, 400),
  };
}

export function backgroundStyleForPage(page) {
  return normalizeBackgroundStyle(page?.background_style, "#ffffff") || {
    kind: "solid", color: "#ffffff", color2: "#ffffff", angle: 145,
    opacity: 1, imageSrc: "", focalX: 50, focalY: 50, scale: 100,
  };
}

export function backgroundCss(page) {
  const style = backgroundStyleForPage(page);
  if (style.kind === "gradient") return { background: `linear-gradient(${style.angle}deg, ${style.color}, ${style.color2})`, opacity: style.opacity };
  if (style.kind === "image" && style.imageSrc) return {
    backgroundColor: style.color,
    backgroundImage: `url(${JSON.stringify(style.imageSrc).slice(1, -1)})`,
    backgroundPosition: `${style.focalX}% ${style.focalY}%`,
    backgroundRepeat: "no-repeat",
    backgroundSize: `${style.scale}%`,
    opacity: style.opacity,
  };
  return { background: style.color, opacity: style.opacity };
}

export function applyDesignPreset(page, presetId) {
  const preset = DESIGN_PRESETS.find((item) => item.id === presetId);
  if (!preset) throw new TypeError("design preset is not supported");
  const objectStyles = Object.fromEntries(Object.entries(page.object_styles).map(([key, value]) => [key, { ...value, ...(preset.style[key] || {}) }]));
  const { frame: _frame, ...imageStyle } = page.image_style;
  return {
    ...page,
    template_id: preset.id,
    composition_mode: "manual",
    layout: preset.layout,
    accent: preset.accent,
    soft: preset.soft,
    object_styles: objectStyles,
    image_style: imageStyle,
    background_style: { ...backgroundStyleForPage(page), kind: "solid", color: preset.soft, opacity: 1 },
  };
}

export function applyCompositionMode(page, mode, { pageIndex = 0, previousRecipe = null } = {}) {
  if (!COMPOSITION_MODE_IDS.has(mode)) throw new TypeError("composition mode is not supported");
  const backgroundStyle = page.background_style;
  const applied = applyDesignPreset(page, presetForComposition(page, mode));
  return {
    ...applied,
    composition_mode: mode,
    layout_recipe: selectSmartLayoutRecipe({
      pageRole: page.page_role,
      panelCount: Array.isArray(page.info_panels) ? page.info_panels.length : 0,
      pageIndex,
      previousRecipe,
    }),
    accent: page.accent,
    soft: page.soft,
    ...(backgroundStyle ? { background_style: backgroundStyle } : { background_style: { ...backgroundStyleForPage(page), kind: "solid", color: "#ffffff", opacity: 1 } }),
  };
}
