import { parseTextDraftResponse } from "./provider-contract.mjs";

export const GENERATION_SESSION_SCHEMA = "xiaoshimei.generation-session.v1";

export function parseGenerationSession(value) {
  const source = typeof value === "string" ? JSON.parse(value) : value;
  if (!source || typeof source !== "object" || Array.isArray(source) || source.schema !== GENERATION_SESSION_SCHEMA) throw new TypeError("GENERATION_SESSION_INVALID");
  const textDraft = parseTextDraftResponse(source.text_draft);
  const resume = source.image_resume == null ? null : source.image_resume;
  if (resume && (typeof resume !== "object" || typeof resume.resume_run_id !== "string" || !resume.resume_run_id)) throw new TypeError("GENERATION_SESSION_RESUME_INVALID");
  const imageCountMode = source.image_count_mode === "CUSTOM" ? "CUSTOM" : "AUTO";
  const customImageCount = Math.max(1, Math.min(8, Number(source.custom_image_count) || textDraft.recommended_image_count));
  return {
    schema: GENERATION_SESSION_SCHEMA,
    topic: String(source.topic || textDraft.source_input),
    pillar: String(source.pillar || textDraft.pillar),
    goal: String(source.goal || textDraft.goal),
    text_requirements: String(source.text_requirements || textDraft.text_requirements || ""),
    text_draft: textDraft,
    text_confirmed: Boolean(source.text_confirmed),
    assembled_draft_id: typeof source.assembled_draft_id === "string" ? source.assembled_draft_id : null,
    image_count_mode: imageCountMode,
    custom_image_count: customImageCount,
    production_mode: ["smart", "narrative", "infographic"].includes(source.production_mode) ? source.production_mode : "smart",
    image_resume: resume ? structuredClone(resume) : null,
  };
}

export function loadGenerationSession(storage, key) {
  try { return parseGenerationSession(storage?.getItem(key)); }
  catch { return null; }
}

export function persistGenerationSession(storage, key, value) {
  const parsed = parseGenerationSession({ schema: GENERATION_SESSION_SCHEMA, ...value });
  storage.setItem(key, JSON.stringify(parsed));
  return parsed;
}
