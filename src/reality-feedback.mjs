export const REALITY_FEEDBACK_SCHEMA = "xiaoshimei.reality-feedback.v1";
export const REALITY_WINDOWS = Object.freeze(["24h", "72h", "7d"]);
export const REALITY_METRICS = Object.freeze([
  "views",
  "likes",
  "comments",
  "saves",
  "shares",
  "followers_gained",
]);

const UNKNOWN = "UNKNOWN";

function metricValue(value, path) {
  if (value == null || value === "" || value === UNKNOWN) return UNKNOWN;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new TypeError(`${path} must be UNKNOWN or a non-negative integer`);
  return number;
}

function snapshot(value = {}, path) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return Object.fromEntries(REALITY_METRICS.map((key) => [key, metricValue(source[key], `${path}.${key}`)]));
}
export function createRealityFeedback(now = new Date().toISOString()) {
  return {
    schema: REALITY_FEEDBACK_SCHEMA,
    platform: "xiaohongshu",
    published_at: "",
    published_url: "",
    snapshots: Object.fromEntries(REALITY_WINDOWS.map((window) => [window, snapshot({}, `snapshots.${window}`)])),
    reflection: "",
    updated_at: now,
  };
}

export function normalizeRealityFeedback(value) {
  const base = createRealityFeedback();
  if (value == null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value) || value.schema !== REALITY_FEEDBACK_SCHEMA) {
    throw new TypeError("reality feedback schema is not supported");
  }
  const publishedAt = typeof value.published_at === "string" ? value.published_at.trim().slice(0, 80) : "";
  const publishedUrl = typeof value.published_url === "string" ? value.published_url.trim().slice(0, 1000) : "";
  const reflection = typeof value.reflection === "string" ? value.reflection.trim().slice(0, 2000) : "";
  if (publishedUrl && !/^https?:\/\//i.test(publishedUrl)) throw new TypeError("published_url must be http(s) or empty");
  return {
    schema: REALITY_FEEDBACK_SCHEMA,
    platform: "xiaohongshu",
    published_at: publishedAt,
    published_url: publishedUrl,
    snapshots: Object.fromEntries(REALITY_WINDOWS.map((window) => [window, snapshot(value.snapshots?.[window], `snapshots.${window}`)])),
    reflection,
    updated_at: typeof value.updated_at === "string" && value.updated_at.trim() ? value.updated_at.trim() : base.updated_at,
  };
}

export function updateRealityFeedback(value, patch, now = new Date().toISOString()) {
  const current = normalizeRealityFeedback(value) || createRealityFeedback(now);
  return normalizeRealityFeedback({ ...current, ...patch, updated_at: now });
}

export function realityFeedbackStatus(value) {
  const feedback = normalizeRealityFeedback(value);
  if (!feedback) return "UNPUBLISHED";
  const filledWindows = REALITY_WINDOWS.filter((window) => REALITY_METRICS.some((metric) => feedback.snapshots[window][metric] !== UNKNOWN));
  if (filledWindows.length === REALITY_WINDOWS.length) return "7D_COMPLETE";
  if (filledWindows.length) return "TRACKING";
  return feedback.published_at || feedback.published_url ? "PUBLISHED" : "UNPUBLISHED";
}
