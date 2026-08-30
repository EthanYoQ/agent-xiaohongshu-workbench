import { IMAGE_SCALE_MAX, IMAGE_SCALE_MIN } from "./canvas-image.mjs";
import { normalizeHighlightPhrases, normalizePanelContentRole, normalizeShotRole } from "./content-strategy.mjs";
import { mediaPolicyFor, panelPreferredAspect } from "./media-role.mjs";

export const INFO_PANEL_MIN = 2;
export const INFO_PANEL_MAX = 4;
export const INFO_PANEL_SURFACE_COLOR = "#ffffff";

function clamp(value, low, high) {
  const number = Number(value);
  if (!Number.isFinite(number)) return low;
  return Math.max(low, Math.min(high, number));
}

function cleanText(value, path, maxLength) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${path} is required`);
  const text = value.trim();
  if (text.length > maxLength) throw new TypeError(`${path} is too long`);
  return text;
}

function normalizeHex(value, fallback, path) {
  const color = value == null ? fallback : value;
  if (typeof color !== "string" || !/^#[0-9a-f]{6}$/i.test(color)) throw new TypeError(`${path} is invalid`);
  return color;
}

function normalizePanelTextStyle(value, path) {
  const style = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    fontFamily: ["songti", "heiti", "kaiti", "fangsong", "yuanti", "pingfang"].includes(style.fontFamily) ? style.fontFamily : "heiti",
    // 55px is the comfortable large-reading default on the 1080x1440 canvas;
    // migrate the former 28/31px defaults while preserving explicit choices.
    fontSize: clamp([28, 31].includes(Number(style.fontSize)) || style.fontSize == null ? 55 : style.fontSize, 16, 64),
    fontWeight: clamp(style.fontWeight ?? 700, 400, 900),
    color: normalizeHex(style.color, "#17211e", `${path}.color`),
    backgroundColor: normalizeHex(style.backgroundColor, INFO_PANEL_SURFACE_COLOR, `${path}.backgroundColor`),
    backgroundOpacity: clamp(style.backgroundOpacity ?? 0.9, 0, 1),
    backgroundRadius: clamp(style.backgroundRadius ?? 14, 0, 40),
  };
}

export function panelCropForIndex(index, count) {
  const normalizedCount = Math.max(INFO_PANEL_MIN, Math.min(INFO_PANEL_MAX, Number(count) || INFO_PANEL_MIN));
  const normalizedIndex = Math.max(0, Math.min(normalizedCount - 1, Number(index) || 0));
  if (normalizedCount === 2) {
    return { x: 0, y: normalizedIndex * 0.5, width: 1, height: 0.5 };
  }
  return {
    x: (normalizedIndex % 2) * 0.5,
    y: Math.floor(normalizedIndex / 2) * 0.5,
    width: 0.5,
    height: 0.5,
  };
}

function normalizeCrop(value, fallback, path) {
  if (value == null) return fallback;
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${path} must be an object`);
  const crop = {
    x: clamp(value.x, 0, 1),
    y: clamp(value.y, 0, 1),
    width: clamp(value.width, 0.05, 1),
    height: clamp(value.height, 0.05, 1),
  };
  if (crop.x + crop.width > 1.000001 || crop.y + crop.height > 1.000001) throw new TypeError(`${path} exceeds the source image`);
  return crop;
}

export function normalizeInfoPanels(value, pageImageSrc, path = "info_panels") {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new TypeError(`${path} must be an array`);
  // Cover and scene pages intentionally carry no information panels. Keep
  // that valid zero state distinct from the invalid half-built one-panel
  // state, while preserving the 2–4 contract for actual infographic pages.
  if (value.length === 0) return [];
  if (value.length < INFO_PANEL_MIN || value.length > INFO_PANEL_MAX) throw new TypeError(`${path} must contain 2-4 panels`);
  return value.map((panel, index) => {
    if (!panel || typeof panel !== "object" || Array.isArray(panel)) throw new TypeError(`${path}[${index}] must be an object`);
    const imageStyle = panel.image_style && typeof panel.image_style === "object" && !Array.isArray(panel.image_style) ? panel.image_style : {};
    const hasIndependentImage = typeof imageStyle.src === "string" && imageStyle.src && imageStyle.src !== pageImageSrc;
    const allowLetterbox = imageStyle.allowLetterbox === true;
    const fallbackCrop = hasIndependentImage ? { x: 0, y: 0, width: 1, height: 1 } : panelCropForIndex(index, value.length);
    const contentRole = normalizePanelContentRole(panel.content_role || panel.contentRole, `${path}[${index}].content_role`, index === 0 ? "hero" : index === value.length - 1 ? "detail" : "support");
    const shotRole = normalizeShotRole(panel.shot_role || panel.shotRole, `${path}[${index}].shot_role`, index === 0 ? "scene" : index === value.length - 1 ? "detail" : "action");
    const mediaPolicy = mediaPolicyFor({
      ...panel,
      ...imageStyle,
      content_role: contentRole,
      shot_role: shotRole,
    });
    const copy = `${panel.title}\n${panel.body}`;
    return {
      id: typeof panel.id === "string" && panel.id.trim() ? panel.id.trim().slice(0, 80) : `panel-${index + 1}`,
      title: cleanText(panel.title, `${path}[${index}].title`, 28),
      body: cleanText(panel.body, `${path}[${index}].body`, 120),
      visual_action: typeof panel.visual_action === "string" ? panel.visual_action.trim().slice(0, 180) : "",
      content_role: contentRole,
      shot_role: shotRole,
      media_role: mediaPolicy.mediaRole,
      highlight_phrases: normalizeHighlightPhrases(panel.highlight_phrases || panel.highlightPhrases, copy, `${path}[${index}].highlight_phrases`),
      text_style: normalizePanelTextStyle(panel.text_style, `${path}[${index}].text_style`),
      image_style: {
        src: typeof imageStyle.src === "string" && imageStyle.src ? imageStyle.src : pageImageSrc,
        hidden: Boolean(imageStyle.hidden),
        media_role: mediaPolicy.mediaRole,
        fit_policy: allowLetterbox ? "contain" : mediaPolicy.fitPolicy,
        preferred_aspect: panelPreferredAspect(value.length),
        // Scene art may fill a hero slot. Supporting and detail art preserve
        // the complete gesture/prop and blend into the paper as an illustration.
        fit: allowLetterbox ? "contain" : mediaPolicy.fitPolicy,
        ...(allowLetterbox ? { allowLetterbox: true } : {}),
        focalX: clamp(imageStyle.focalX ?? 50, 0, 100),
        focalY: clamp(imageStyle.focalY ?? 50, 0, 100),
        scale: clamp(imageStyle.scale ?? 100, IMAGE_SCALE_MIN, IMAGE_SCALE_MAX),
        crop: normalizeCrop(imageStyle.crop, fallbackCrop, `${path}[${index}].image_style.crop`),
      },
    };
  });
}

export function createInfoPanelsFromPlan(panels, pageImageSrc, independentImageSources = []) {
  if (!Array.isArray(panels) || panels.length < INFO_PANEL_MIN || panels.length > INFO_PANEL_MAX) return [];
  if (!Array.isArray(independentImageSources)) throw new TypeError("independent panel image sources must be an array");
  return normalizeInfoPanels(panels.map((panel, index) => ({
    id: `panel-${index + 1}`,
    title: panel.title,
    body: panel.body,
    visual_action: panel.visualAction || panel.visual_action || "",
    content_role: panel.contentRole || panel.content_role,
    shot_role: panel.shotRole || panel.shot_role,
    highlight_phrases: panel.highlightPhrases || panel.highlight_phrases,
    image_style: {
      src: independentImageSources[index] || pageImageSrc,
      media_role: panel.mediaRole || panel.media_role,
      focalX: 50,
      focalY: 50,
      scale: 100,
      crop: independentImageSources[index] ? { x: 0, y: 0, width: 1, height: 1 } : panelCropForIndex(index, panels.length),
    },
  })), pageImageSrc);
}

export function infoPanelMediaStyle(panel, index, count) {
  const crop = panel?.image_style?.crop || panelCropForIndex(index, count);
  const sourceWidth = 100 / crop.width;
  const sourceHeight = 100 / crop.height;
  const independent = crop.x === 0 && crop.y === 0 && crop.width === 1 && crop.height === 1;
  const requestedScale = clamp(panel?.image_style?.scale ?? 100, IMAGE_SCALE_MIN, IMAGE_SCALE_MAX);
  const fitPolicy = panel?.image_style?.fit_policy || panel?.image_style?.fit || "contain";
  const scale = requestedScale / 100;
  return {
    frame: { aspectRatio: `${3 * crop.width} / ${4 * crop.height}` },
    source: {
      left: `${(-crop.x / crop.width) * 100}%`,
      top: `${(-crop.y / crop.height) * 100}%`,
      width: `${sourceWidth}%`,
      height: `${sourceHeight}%`,
    },
    image: {
      objectFit: fitPolicy === "cover" ? "cover" : "contain",
      objectPosition: `${clamp(panel?.image_style?.focalX ?? 50, 0, 100)}% ${clamp(panel?.image_style?.focalY ?? 50, 0, 100)}%`,
      transform: `scale(${scale})`,
      transformOrigin: `${clamp(panel?.image_style?.focalX ?? 50, 0, 100)}% ${clamp(panel?.image_style?.focalY ?? 50, 0, 100)}%`,
    },
  };
}

export function moveInfoPanel(panels, fromIndex, direction) {
  if (!Array.isArray(panels)) return [];
  const next = structuredClone(panels);
  const from = Number(fromIndex);
  const to = direction === "up" ? from - 1 : direction === "down" ? from + 1 : from;
  if (!Number.isInteger(from) || to < 0 || to >= next.length || to === from) return next;
  [next[from], next[to]] = [next[to], next[from]];
  // Image, crop and copy are one semantic card. Reordering the card must not
  // silently point the copy at another illustration region.
  return next;
}
