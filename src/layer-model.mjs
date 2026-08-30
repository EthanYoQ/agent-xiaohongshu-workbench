export const PAGE_LAYER_KEYS = Object.freeze([
  "background",
  "image",
  "eyebrow",
  "title",
  "body",
  "brand",
  "page_number",
]);

export const TEXT_LAYER_KEYS = Object.freeze(["eyebrow", "title", "body", "brand", "page_number"]);
export const REORDERABLE_LAYER_KEYS = Object.freeze(["image", "eyebrow", "title", "body", "brand", "page_number"]);

const DEFAULT_ORDER = Object.freeze([...PAGE_LAYER_KEYS]);

function normalizedOrder(value) {
  if (!Array.isArray(value)) return [...DEFAULT_ORDER];
  const known = value.filter((key) => PAGE_LAYER_KEYS.includes(key));
  const unique = [...new Set(known)];
  return [...unique, ...PAGE_LAYER_KEYS.filter((key) => !unique.includes(key))];
}

export function normalizeLayerState(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    order: normalizedOrder(source.order),
    visible: Object.fromEntries(PAGE_LAYER_KEYS.map((key) => [key, source.visible?.[key] !== false])),
    locked: Object.fromEntries(PAGE_LAYER_KEYS.map((key) => [key, Boolean(source.locked?.[key])])),
  };
}

export function layerIsVisible(page, key) {
  return page.layer_state?.visible?.[key] !== false;
}

export function layerIsLocked(page, key) {
  return Boolean(page.layer_state?.locked?.[key]);
}

export function layerZIndex(page, key) {
  if (key === "background") return 0;
  const index = normalizeLayerState(page.layer_state).order.indexOf(key);
  return index <= 1 ? Math.max(1, index) : index + 1;
}

export function setLayerFlag(layerState, bucket, key, value) {
  if (!PAGE_LAYER_KEYS.includes(key) || !["visible", "locked"].includes(bucket)) return normalizeLayerState(layerState);
  const next = normalizeLayerState(layerState);
  return { ...next, [bucket]: { ...next[bucket], [key]: Boolean(value) } };
}

export function moveLayer(layerState, key, direction) {
  const next = normalizeLayerState(layerState);
  if (!REORDERABLE_LAYER_KEYS.includes(key) || !["up", "down"].includes(direction)) return next;
  const movable = next.order.filter((item) => REORDERABLE_LAYER_KEYS.includes(item));
  const from = movable.indexOf(key);
  const to = direction === "up" ? from + 1 : from - 1;
  if (from < 0 || to < 0 || to >= movable.length) return next;
  [movable[from], movable[to]] = [movable[to], movable[from]];
  let cursor = 0;
  return {
    ...next,
    order: next.order.map((item) => REORDERABLE_LAYER_KEYS.includes(item) ? movable[cursor++] : item),
  };
}
