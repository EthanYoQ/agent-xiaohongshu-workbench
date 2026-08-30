import { normalizeProductionMode } from "./production-mode.mjs";

export const IMAGE_RUN_CHECKPOINT_SCHEMA = "xiaoshimei.image-run-checkpoint.v1";

function requiredString(value, path) {
  if (typeof value !== "string" || !value.trim()) throw new TypeError(`${path} must be a string`);
  return value.trim();
}

function sha(value, path) {
  const normalized = requiredString(value, path);
  if (!/^[0-9a-f]{64}$/.test(normalized)) throw new TypeError(`${path} must be sha256`);
  return normalized;
}

export function createImageRunCheckpoint({ runId, draftId, draftSha256, productionMode = "smart", pageCount, pages, planAttempts, reference, finalPageCount = null, finalPages = null, illustrationUnits = null }) {
  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > 8 || !Array.isArray(pages) || pages.length !== pageCount) throw new TypeError("checkpoint page contract is invalid");
  if (finalPageCount != null && (!Number.isInteger(finalPageCount) || finalPageCount < 1 || finalPageCount > 8 || !Array.isArray(finalPages) || finalPages.length !== finalPageCount)) throw new TypeError("checkpoint final page contract is invalid");
  if (illustrationUnits != null && (!Array.isArray(illustrationUnits) || illustrationUnits.length < 1 || illustrationUnits.length > 32)) throw new TypeError("checkpoint illustration unit contract is invalid");
  return {
    schema: IMAGE_RUN_CHECKPOINT_SCHEMA,
    run_id: requiredString(runId, "run_id"),
    draft_id: requiredString(draftId, "draft_id"),
    draft_sha256: sha(draftSha256, "draft_sha256"),
    production_mode: normalizeProductionMode(productionMode, "checkpoint.production_mode"),
    page_count: pageCount,
    pages: structuredClone(pages),
    ...(finalPageCount == null ? {} : { final_page_count: finalPageCount, final_pages: structuredClone(finalPages) }),
    ...(illustrationUnits == null ? {} : { illustration_units: structuredClone(illustrationUnits) }),
    plan_attempts: structuredClone(planAttempts || []),
    reference: structuredClone(reference),
    images: [],
    image_attempts: [],
    pending_image: null,
    actual_image_calls: 0,
    status: "GENERATING",
    failure: null,
  };
}

export function parseImageRunCheckpoint(value, { draftId, draftSha256, productionMode, pageCount } = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value) || value.schema !== IMAGE_RUN_CHECKPOINT_SCHEMA) throw new TypeError("IMAGE_RESUME_CHECKPOINT_INVALID");
  if (!Number.isInteger(value.page_count) || value.page_count < 1 || value.page_count > 8 || !Array.isArray(value.pages) || value.pages.length !== value.page_count) throw new TypeError("IMAGE_RESUME_PAGE_CONTRACT_INVALID");
  if (!Array.isArray(value.images) || !Array.isArray(value.image_attempts) || !Number.isInteger(value.actual_image_calls) || value.actual_image_calls < value.images.length) throw new TypeError("IMAGE_RESUME_EVIDENCE_INVALID");
  if (value.final_page_count != null && (!Number.isInteger(value.final_page_count) || value.final_page_count < 1 || value.final_page_count > 8 || !Array.isArray(value.final_pages) || value.final_pages.length !== value.final_page_count)) throw new TypeError("IMAGE_RESUME_FINAL_PAGE_CONTRACT_INVALID");
  if (value.illustration_units != null && (!Array.isArray(value.illustration_units) || value.illustration_units.length < 1 || value.illustration_units.length > 32)) throw new TypeError("IMAGE_RESUME_ILLUSTRATION_UNIT_CONTRACT_INVALID");
  if (draftId != null && value.draft_id !== draftId) throw new TypeError("IMAGE_RESUME_DRAFT_ID_MISMATCH");
  if (draftSha256 != null && value.draft_sha256 !== draftSha256) throw new TypeError("IMAGE_RESUME_DRAFT_HASH_MISMATCH");
  const checkpointProductionMode = normalizeProductionMode(value.production_mode, "IMAGE_RESUME_PRODUCTION_MODE_INVALID");
  if (productionMode != null && checkpointProductionMode !== normalizeProductionMode(productionMode)) throw new TypeError("IMAGE_RESUME_PRODUCTION_MODE_MISMATCH");
  if (pageCount != null && value.page_count !== pageCount) throw new TypeError("IMAGE_RESUME_PAGE_COUNT_MISMATCH");
  return { ...structuredClone(value), production_mode: checkpointProductionMode };
}

export function recordPendingImage(checkpoint, image) {
  const next = parseImageRunCheckpoint(checkpoint);
  const expectedPage = next.images.length + 1;
  if (next.pending_image || image.page !== expectedPage || expectedPage > next.page_count) throw new TypeError("IMAGE_CHECKPOINT_ORDER_INVALID");
  next.pending_image = structuredClone(image);
  next.status = "QA_PENDING";
  next.failure = null;
  return next;
}

export function updatePendingImage(checkpoint, image) {
  const next = parseImageRunCheckpoint(checkpoint);
  if (!next.pending_image || image.page !== next.pending_image.page || image.page !== next.images.length + 1) throw new TypeError("IMAGE_CHECKPOINT_PENDING_MISMATCH");
  next.pending_image = structuredClone(image);
  next.status = "QA_PENDING";
  next.failure = null;
  return next;
}

export function recordImageCall(checkpoint) {
  const next = parseImageRunCheckpoint(checkpoint);
  if (next.pending_image || next.images.length >= next.page_count) throw new TypeError("IMAGE_CALL_CHECKPOINT_STATE_INVALID");
  next.actual_image_calls += 1;
  next.status = "IMAGE_CALL_COMPLETED_ASSET_PENDING";
  next.failure = null;
  return next;
}

export function admitPendingImage(checkpoint, { evidence, attempt }) {
  const next = parseImageRunCheckpoint(checkpoint);
  if (!next.pending_image || next.pending_image.page !== next.images.length + 1) throw new TypeError("IMAGE_CHECKPOINT_PENDING_MISSING");
  next.images.push(structuredClone(evidence));
  next.image_attempts.push(structuredClone(attempt));
  next.pending_image = null;
  next.status = next.images.length === next.page_count ? "COMPLETE" : "GENERATING";
  next.failure = null;
  return next;
}

export function replaceAdmittedImage(checkpoint, { page, evidence, attempt }) {
  const next = parseImageRunCheckpoint(checkpoint);
  const index = Number(page) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= next.images.length) throw new TypeError("IMAGE_CHECKPOINT_ADMITTED_PAGE_INVALID");
  next.images[index] = structuredClone(evidence);
  next.image_attempts.push(structuredClone(attempt));
  return next;
}

export function rejectPendingImage(checkpoint, { attempt, code }) {
  const next = parseImageRunCheckpoint(checkpoint);
  if (!next.pending_image) throw new TypeError("IMAGE_CHECKPOINT_PENDING_MISSING");
  next.image_attempts.push(structuredClone(attempt));
  next.pending_image = null;
  next.status = "PARTIAL_FAILURE_RESUMABLE";
  next.failure = { failed_page: next.images.length + 1, code: requiredString(code, "failure.code") };
  return next;
}

export function recordPendingPipelineFailure(checkpoint, { attempt, code }) {
  const next = parseImageRunCheckpoint(checkpoint);
  if (!next.pending_image || next.pending_image.page !== next.images.length + 1) throw new TypeError("IMAGE_CHECKPOINT_PENDING_MISSING");
  next.image_attempts.push(structuredClone(attempt));
  next.status = "PARTIAL_FAILURE_RESUMABLE";
  next.failure = { failed_page: next.pending_image.page, code: requiredString(code, "failure.code") };
  return next;
}

export function recordResumableFailure(checkpoint, { failedPage, code }) {
  const next = parseImageRunCheckpoint(checkpoint);
  if (!Number.isInteger(failedPage) || failedPage !== next.images.length + 1 || failedPage > next.page_count) throw new TypeError("IMAGE_FAILURE_PAGE_INVALID");
  next.status = "PARTIAL_FAILURE_RESUMABLE";
  next.failure = { failed_page: failedPage, code: requiredString(code, "failure.code") };
  return next;
}

export function resumeImageIndex(checkpoint) {
  const parsed = parseImageRunCheckpoint(checkpoint);
  if (parsed.pending_image) throw new TypeError("IMAGE_RESUME_PENDING_QA_REQUIRES_RECOVERY");
  return parsed.images.length;
}
