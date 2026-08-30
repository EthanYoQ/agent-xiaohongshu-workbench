export const MEDIA_ROLES = Object.freeze([
  "hero_scene",
  "inline_sticker",
  "evidence_detail",
  "texture_background",
  "mother_tile",
]);

export const PANEL_PREFERRED_ASPECTS = Object.freeze({
  compact: "3:4",
  spacious: "3:4",
});

const MEDIA_ROLE_SET = new Set(MEDIA_ROLES);

function clean(value) {
  return String(value || "").trim().toLowerCase();
}

export function inferMediaRole(value = {}) {
  const explicit = clean(value.media_role || value.mediaRole);
  if (MEDIA_ROLE_SET.has(explicit)) return explicit;
  const contentRole = clean(value.content_role || value.contentRole);
  const shotRole = clean(value.shot_role || value.shotRole);
  const pageRole = clean(value.page_role || value.pageRole);
  if (pageRole === "hook" || contentRole === "hero" || shotRole === "scene") return "hero_scene";
  if (contentRole === "detail" || shotRole === "detail" || shotRole === "comparison") return "evidence_detail";
  return "inline_sticker";
}

export function mediaPolicyForRole(role) {
  const normalized = MEDIA_ROLE_SET.has(clean(role)) ? clean(role) : "inline_sticker";
  return {
    mediaRole: normalized,
    fitPolicy: "cover",
    defaultZoom: 1,
    preferredAspect: "3:4",
  };
}

export function mediaPolicyFor(value = {}) {
  return mediaPolicyForRole(inferMediaRole(value));
}

/**
 * The paid mother sheet is only a transport container. Its panel assets must
 * use one 3:4 portrait contract. The mother-sheet prompt keeps the subject
 * inside a safe area. Source and frame now share the same 3:4 ratio, so the
 * default path must not zoom or crop the character to hide transport seams.
 */
export function panelPreferredAspect(panelCount) {
  return Number(panelCount) <= 2
    ? PANEL_PREFERRED_ASPECTS.spacious
    : PANEL_PREFERRED_ASPECTS.compact;
}
