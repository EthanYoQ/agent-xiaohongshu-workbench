import { normalizePromptContext } from "./prompt-context.mjs";
import { normalizeStyleLock, normalizeXhsContentType, normalizeXhsPageRole } from "./content-strategy.mjs";
import { normalizeProductionMode } from "./production-mode.mjs";

export const GENERATION_REQUEST_SCHEMA = "xiaoshimei.generation-request.v1";
export const PAGE_CANDIDATE_REQUEST_SCHEMA = "xiaoshimei.page-candidate-request.v1";
export const PAGE_CANDIDATE_RESPONSE_SCHEMA = "xiaoshimei.page-candidate-response.v1";
export const TEXT_DRAFT_REQUEST_SCHEMA = "xiaoshimei.text-draft-request.v1";
export const TEXT_DRAFT_RESPONSE_SCHEMA = "xiaoshimei.text-draft-response.v1";
export const IMAGE_GENERATION_REQUEST_SCHEMA = "xiaoshimei.image-generation-request.v1";

export function buildGenerationRequest(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("generation input must be an object");
  return { schema: GENERATION_REQUEST_SCHEMA, input: structuredClone(input) };
}

export function parseGenerationRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError("GENERATION_REQUEST_INVALID");
  if (value.schema !== GENERATION_REQUEST_SCHEMA) throw new TypeError("GENERATION_REQUEST_SCHEMA_UNSUPPORTED");
  if (!value.input || typeof value.input !== "object" || Array.isArray(value.input)) throw new TypeError("GENERATION_REQUEST_INPUT_INVALID");
  return structuredClone(value.input);
}

function requiredString(value, code, max = 2000) {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new TypeError(code);
  return value.trim();
}

function textDraftInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("TEXT_DRAFT_INPUT_INVALID");
  if (!input.profile_contract || typeof input.profile_contract !== "object") throw new TypeError("TEXT_DRAFT_PROFILE_INVALID");
  return {
    topic: requiredString(input.topic, "TEXT_DRAFT_TOPIC_INVALID", 12000),
    text_requirements: typeof input.text_requirements === "string" ? input.text_requirements.trim().slice(0, 4000) : "",
    pillar: requiredString(input.pillar, "TEXT_DRAFT_PILLAR_INVALID", 40),
    goal: requiredString(input.goal, "TEXT_DRAFT_GOAL_INVALID", 40),
    profile_contract: structuredClone(input.profile_contract),
    prompt_context: normalizePromptContext(input.prompt_context),
  };
}

export function buildTextDraftRequest(input) {
  return { schema: TEXT_DRAFT_REQUEST_SCHEMA, input: textDraftInput(input) };
}

export function parseTextDraftRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.schema !== TEXT_DRAFT_REQUEST_SCHEMA) throw new TypeError("TEXT_DRAFT_REQUEST_INVALID");
  return textDraftInput(value.input);
}

export function parseTextDraftResponse(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.schema !== TEXT_DRAFT_RESPONSE_SCHEMA) throw new TypeError("TEXT_DRAFT_RESPONSE_INVALID");
  if (typeof value.draft_id !== "string" || !value.draft_id || typeof value.source_input !== "string" || !value.source_input.trim()) throw new TypeError("TEXT_DRAFT_LINEAGE_INVALID");
  if (typeof value.pillar !== "string" || typeof value.goal !== "string") throw new TypeError("TEXT_DRAFT_ROUTE_INVALID");
  if (typeof value.text_requirements !== "string") throw new TypeError("TEXT_DRAFT_REQUIREMENTS_INVALID");
  if (!Array.isArray(value.titles) || value.titles.length !== 3 || !value.titles.every((item) => typeof item === "string" && item.trim())) throw new TypeError("TEXT_DRAFT_TITLES_INVALID");
  if (!value.titles.includes(value.selected_title)) throw new TypeError("TEXT_DRAFT_SELECTED_TITLE_INVALID");
  if (typeof value.body !== "string" || value.body.replace(/\s/g, "").length < 240) throw new TypeError("TEXT_DRAFT_BODY_INVALID");
  if (!Array.isArray(value.tags) || value.tags.length !== 5 || !value.tags.every((item) => typeof item === "string" && item.trim())) throw new TypeError("TEXT_DRAFT_TAGS_INVALID");
  if (!Number.isInteger(value.recommended_image_count) || value.recommended_image_count < 1 || value.recommended_image_count > 8) throw new TypeError("TEXT_DRAFT_IMAGE_COUNT_INVALID");
  const contentType = value.content_type == null ? "knowledge_card" : normalizeXhsContentType(value.content_type, "TEXT_DRAFT_CONTENT_TYPE");
  const styleLock = value.style_lock == null ? null : normalizeStyleLock(value.style_lock, "TEXT_DRAFT_STYLE_LOCK");
  return { ...structuredClone(value), content_type: contentType, ...(styleLock ? { style_lock: styleLock } : {}), prompt_context: normalizePromptContext(value.prompt_context) };
}

function imageGenerationInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("IMAGE_GENERATION_INPUT_INVALID");
  const draft = parseTextDraftResponse(input.draft);
  const productionMode = normalizeProductionMode(input.production_mode, "IMAGE_GENERATION_PRODUCTION_MODE_INVALID");
  const imageCount = input.image_count === "AUTO" ? "AUTO" : Number(input.image_count);
  if (imageCount !== "AUTO" && (!Number.isInteger(imageCount) || imageCount < 1 || imageCount > 8)) throw new TypeError("IMAGE_GENERATION_COUNT_INVALID");
  const resumeRunId = input.resume_run_id == null || input.resume_run_id === "" ? null : requiredString(input.resume_run_id, "IMAGE_GENERATION_RESUME_ID_INVALID", 120);
  if (resumeRunId && !/^images-[0-9TZ-]+-[0-9a-f]{8}$/.test(resumeRunId)) throw new TypeError("IMAGE_GENERATION_RESUME_ID_INVALID");
  const sourceReferences = input.reference_images == null ? [] : input.reference_images;
  if (!Array.isArray(sourceReferences) || sourceReferences.length > 3) throw new TypeError("IMAGE_GENERATION_REFERENCES_INVALID");
  const referenceImages = sourceReferences.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new TypeError(`IMAGE_GENERATION_REFERENCE_${index + 1}_INVALID`);
    const dataUrl = typeof item.data_url === "string" ? item.data_url.trim() : "";
    if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(dataUrl) || dataUrl.length > 4_500_000) throw new TypeError(`IMAGE_GENERATION_REFERENCE_${index + 1}_DATA_INVALID`);
    const name = typeof item.name === "string" && item.name.trim() ? item.name.trim().slice(0, 100) : `参考图${index + 1}`;
    return { name, data_url: dataUrl };
  });
  const referenceNote = typeof input.reference_note === "string" ? input.reference_note.trim().slice(0, 1000) : "";
  return { draft, production_mode: productionMode, image_count: imageCount, resume_run_id: resumeRunId, reference_images: referenceImages, reference_note: referenceNote };
}

export function buildImageGenerationRequest(input) {
  return { schema: IMAGE_GENERATION_REQUEST_SCHEMA, input: imageGenerationInput(input) };
}

export function parseImageGenerationRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.schema !== IMAGE_GENERATION_REQUEST_SCHEMA) throw new TypeError("IMAGE_GENERATION_REQUEST_INVALID");
  return imageGenerationInput(value.input);
}

function pageCandidateInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("PAGE_CANDIDATE_INPUT_INVALID");
  const pageIndex = Number(input.page_index);
  if (!Number.isInteger(pageIndex) || pageIndex < 0 || pageIndex > 7) throw new TypeError("PAGE_CANDIDATE_INDEX_INVALID");
  const string = (value, code, max) => {
    if (typeof value !== "string" || !value.trim() || value.length > max) throw new TypeError(code);
    return value.trim();
  };
  const optionalString = (value, code, max) => {
    if (value == null || value === "") return "";
    if (typeof value !== "string" || value.length > max) throw new TypeError(code);
    return value.trim();
  };
  return {
    page_index: pageIndex,
    source_input: string(input.source_input, "PAGE_CANDIDATE_SOURCE_INVALID", 2000),
    title: string(input.title, "PAGE_CANDIDATE_TITLE_INVALID", 120),
    body: string(input.body, "PAGE_CANDIDATE_BODY_INVALID", 500),
    layout: string(input.layout, "PAGE_CANDIDATE_LAYOUT_INVALID", 40),
    content_type: input.content_type ? normalizeXhsContentType(input.content_type, "PAGE_CANDIDATE_CONTENT_TYPE_INVALID") : "knowledge_card",
    page_role: input.page_role ? normalizeXhsPageRole(input.page_role, "PAGE_CANDIDATE_PAGE_ROLE_INVALID") : (pageIndex === 0 ? "hook" : "example"),
    visual_action: optionalString(input.visual_action, "PAGE_CANDIDATE_VISUAL_ACTION_INVALID", 400),
    image_prompt: optionalString(input.image_prompt, "PAGE_CANDIDATE_IMAGE_PROMPT_INVALID", 1800),
    style_lock: input.style_lock == null ? null : normalizeStyleLock(input.style_lock, "PAGE_CANDIDATE_STYLE_LOCK_INVALID"),
    prompt_context: normalizePromptContext(input.prompt_context),
  };
}

export function buildPageCandidateRequest(input) {
  return { schema: PAGE_CANDIDATE_REQUEST_SCHEMA, input: pageCandidateInput(input) };
}

export function parsePageCandidateRequest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.schema !== PAGE_CANDIDATE_REQUEST_SCHEMA) throw new TypeError("PAGE_CANDIDATE_REQUEST_INVALID");
  return pageCandidateInput(value.input);
}

export function parsePageCandidateResponse(value) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.schema !== PAGE_CANDIDATE_RESPONSE_SCHEMA) throw new TypeError("PAGE_CANDIDATE_RESPONSE_INVALID");
  if (!Array.isArray(value.candidates) || value.candidates.length !== 3) throw new TypeError("PAGE_CANDIDATE_COUNT_INVALID");
  const candidates = value.candidates.map((item, index) => {
    const source = String(item?.src || "");
    const localAsset = /^\/generated\/ark\/page-candidates\/[^/]+\/(0[1-3])\.(png|jpg)$/.test(source);
    const browserAsset = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(source);
    if (!item || typeof item !== "object" || (!localAsset && !browserAsset)) throw new TypeError(`PAGE_CANDIDATE_${index + 1}_SRC_INVALID`);
    if (!/^[0-9a-f]{64}$/.test(String(item.sha256)) || !Number.isInteger(item.size_bytes) || item.size_bytes < 1024) throw new TypeError(`PAGE_CANDIDATE_${index + 1}_EVIDENCE_INVALID`);
    if (item.width * 4 !== item.height * 3) throw new TypeError(`PAGE_CANDIDATE_${index + 1}_RATIO_INVALID`);
    return { src: item.src, sha256: item.sha256, size_bytes: item.size_bytes, width: item.width, height: item.height };
  });
  return { schema: PAGE_CANDIDATE_RESPONSE_SCHEMA, run_id: String(value.run_id || ""), candidates };
}
