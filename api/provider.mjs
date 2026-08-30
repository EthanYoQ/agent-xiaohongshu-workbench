import { randomUUID } from "node:crypto";
import sharp from "sharp";
import {
  ARK_BASE_URL,
  assembleArkContentFromDraft,
  buildArkDraftTextRequest,
  buildArkImageRequest,
  buildArkPageCandidatePrompt,
  buildArkPagePlanRequest,
  decodeArkImage,
  extractArkPagePlan,
  extractArkTextDraft,
  inspectImageBytes,
  isThreeByFourImage,
  sha256Bytes,
  textQualityRetryGuidance,
} from "../src/ark-provider-core.mjs";
import { parseContentPackage } from "../src/content-engine.mjs";
import {
  buildIllustrationUnits,
  buildMotherSheetPrompt,
  groupIllustrationUnits,
  motherSheetRegionForUnit,
} from "../src/mother-sheet.mjs";
import { inspectMotherSheetTileStats } from "../src/mother-sheet-tile-quality.mjs";
import {
  PAGE_CANDIDATE_RESPONSE_SCHEMA,
  TEXT_DRAFT_RESPONSE_SCHEMA,
  parseImageGenerationRequest,
  parsePageCandidateRequest,
  parseTextDraftRequest,
} from "../src/provider-contract.mjs";
import { XIAOSHIMEI_AVATAR_DATA_URL } from "./xiaoshimei-avatar-data.mjs";

export const config = { maxDuration: 300 };

const IMAGE_PRICE_CNY = 0.22;
const DEFAULT_TEXT_MODEL = "doubao-seed-2-0-lite-260428";
const DEFAULT_IMAGE_MODEL = "doubao-seedream-5-0-lite-260128";

function cleanModel(value, fallback) {
  const model = String(value || fallback).trim();
  if (!/^[A-Za-z0-9_.:-]{3,120}$/.test(model)) throw new TypeError("MODEL_ID_INVALID");
  return model;
}

function requestConfig(request) {
  const authorization = String(request.headers.authorization || "");
  const apiKey = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (apiKey.length < 8) throw new TypeError("ARK_API_KEY_REQUIRED");
  return {
    apiKey,
    textModel: cleanModel(request.headers["x-xiaoshimei-text-model"], DEFAULT_TEXT_MODEL),
    imageModel: cleanModel(request.headers["x-xiaoshimei-image-model"], DEFAULT_IMAGE_MODEL),
  };
}

function routeName(request) {
  const value = Array.isArray(request.query?.route) ? request.query.route[0] : request.query?.route;
  return String(value || "").replace(/^\/+|\/+$/g, "");
}

function send(response, status, body) {
  response.status(status).setHeader("cache-control", "no-store").json(body);
}

async function arkPost(path, apiKey, body, stage) {
  let upstream;
  try {
    upstream = await fetch(`${ARK_BASE_URL}${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(240_000),
    });
  } catch (error) {
    throw new Error(`${stage}:NETWORK_FETCH_FAILED:${String(error?.name || "UNKNOWN")}`);
  }
  const payload = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    const providerError = payload?.error || payload || {};
    const code = String(providerError.code || `HTTP_${upstream.status}`).replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 100);
    const message = String(providerError.message || "").replace(/[\r\n\t]+/g, " ").slice(0, 220);
    throw new Error(`${stage}:${code}${message ? `:${message}` : ""}`);
  }
  return payload;
}

async function imagePayload(payload) {
  const decoded = decodeArkImage(payload);
  let bytes;
  if (decoded.kind === "base64") bytes = Buffer.from(decoded.value, "base64");
  else {
    const response = await fetch(decoded.value, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`IMAGE_ASSET_DOWNLOAD_${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  if (bytes.length < 1024) throw new Error("ARK_IMAGE_TOO_SMALL");
  const info = inspectImageBytes(bytes);
  if (!isThreeByFourImage(info)) throw new Error(`ARK_IMAGE_ASPECT_RATIO_INVALID:${info.width}x${info.height}`);
  return {
    bytes,
    info,
    dataUrl: `data:${info.mime};base64,${bytes.toString("base64")}`,
    sha256: sha256Bytes(bytes),
  };
}

async function generateTextDraft(input, settings) {
  let draft;
  let finalError;
  const attempts = [];
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const qualityFeedback = finalError ? textQualityRetryGuidance(finalError) : "";
    const result = await arkPost("/responses", settings.apiKey, buildArkDraftTextRequest({ ...input, quality_feedback: qualityFeedback }, settings.textModel), "TEXT_DRAFT_MODEL_CALL_FAILED");
    try {
      draft = extractArkTextDraft(result, { topic: input.topic, pillar: input.pillar, goal: input.goal });
      attempts.push({ attempt, status: "PASS" });
      break;
    } catch (error) {
      finalError = error;
      attempts.push({ attempt, status: "REJECTED", rejection_code: String(error?.message || error).slice(0, 180) });
    }
  }
  if (!draft) throw finalError || new Error("TEXT_DRAFT_REJECTED");
  const runId = `text-web-${Date.now()}-${randomUUID().slice(0, 8)}`;
  return {
    schema: TEXT_DRAFT_RESPONSE_SCHEMA,
    draft_id: runId,
    created_at: new Date().toISOString(),
    source_input: input.topic,
    content_type: draft.contentType,
    ...(input.profile_contract.style_lock ? { style_lock: input.profile_contract.style_lock } : {}),
    text_requirements: input.text_requirements || "",
    prompt_context: input.prompt_context,
    pillar: input.pillar,
    goal: input.goal,
    titles: draft.titles,
    selected_title: draft.selectedTitle,
    body: draft.body,
    tags: draft.tags,
    recommended_image_count: draft.recommendedImageCount,
    facts: draft.facts,
    risks: draft.risks,
    quality_repairs: draft.qualityRepairs || [],
    generation: { provider: "volcengine-ark", text_model: settings.textModel, status: "TEXT_READY_FOR_USER_CONFIRMATION", attempts },
  };
}

export async function splitMotherSheetForUnits(bytes, jobOrUnits) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 1024) throw new TypeError("MOTHER_SHEET_BYTES_INVALID");
  const job = Array.isArray(jobOrUnits) ? { template: "grid-3x3", units: jobOrUnits } : jobOrUnits;
  const units = job?.units;
  if (!Array.isArray(units) || units.length < 1 || units.length > 9) throw new TypeError("MOTHER_SHEET_UNITS_INVALID");
  const metadata = await sharp(bytes).metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  if (!width || !height || Math.abs(width / height - .75) > .01) {
    throw new Error(`MOTHER_SHEET_ASPECT_RATIO_INVALID:${width}x${height}`);
  }
  return Promise.all(units.map(async (unit, index) => {
    const region = motherSheetRegionForUnit(width, height, job, index);
    const { slotIndex, regionRole, ...cropRegion } = region;
    const preferredAspect = regionRole === "kv-top-3x2-9:8" ? "9:8" : "3:4";
    const baseTile = await sharp(bytes).extract(cropRegion).png().toBuffer();
    const quality = inspectMotherSheetTileStats(await sharp(baseTile).stats());
    if (!quality.hasVisibleSubject) throw new Error(`MOTHER_SHEET_UNIT_MISSING:${unit.unit_id}`);
    const tileBytes = await sharp(baseTile)
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 90, chromaSubsampling: "4:4:4", mozjpeg: true })
      .toBuffer();
    return {
      unit_id: unit.unit_id,
      page_index: unit.page_index,
      panel_index: unit.panel_index,
      src: `data:image/jpeg;base64,${tileBytes.toString("base64")}`,
      sha256: sha256Bytes(tileBytes),
      size_bytes: tileBytes.length,
      width: region.width,
      height: region.height,
      media_role: unit.media_role,
      preferred_aspect: preferredAspect,
      fit_policy: unit.fit_policy,
      edge_trim: { left: 0, right: 0, top: 0, bottom: 0 },
      aspect_crop: { left: 0, top: 0, width: region.width, height: region.height },
      mother_sheet_slot: slotIndex + 1,
      mother_sheet_region_role: regionRole,
      presence_gate: quality,
    };
  }));
}

async function generateImages(input, settings, request) {
  if (input.resume_run_id) throw new TypeError("PUBLIC_RESUME_NOT_SUPPORTED_RETRY_CURRENT_NODE");
  const pageCount = input.image_count === "AUTO" ? input.draft.recommended_image_count : input.image_count;
  let pages;
  let planError;
  const planAttempts = [];
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const result = await arkPost("/responses", settings.apiKey, buildArkPagePlanRequest(input.draft, pageCount, settings.textModel, planError ? String(planError.message || planError) : "", input.production_mode), "PAGE_PLAN_MODEL_CALL_FAILED");
    try {
      pages = extractArkPagePlan(result, pageCount, { topic: input.draft.source_input, pillar: input.draft.pillar, goal: input.draft.goal, productionMode: input.production_mode });
      planAttempts.push({ attempt, status: "PASS" });
      break;
    } catch (error) {
      planError = error;
      planAttempts.push({ attempt, status: "REJECTED", rejection_code: String(error?.message || error).slice(0, 180) });
    }
  }
  if (!pages) throw planError || new Error("PAGE_PLAN_REJECTED");

  const units = buildIllustrationUnits(pages);
  const jobs = groupIllustrationUnits(units);
  const extraReferences = input.reference_images.map((item) => item.data_url);
  const sheets = [];
  for (const job of jobs) {
    const prompt = buildMotherSheetPrompt(job, { styleLock: input.draft.style_lock, imageContext: input.draft.prompt_context });
    const payload = await arkPost("/images/generations", settings.apiKey, buildArkImageRequest({ model: settings.imageModel, prompt, referenceImageDataUrl: XIAOSHIMEI_AVATAR_DATA_URL, actionReferenceImageDataUrls: extraReferences, actionReferenceNote: input.reference_note }), `MOTHER_SHEET_${job.sheet_index + 1}_CALL_FAILED`);
    const sheet = { job, ...(await imagePayload(payload)) };
    sheet.tiles = await splitMotherSheetForUnits(sheet.bytes, job);
    sheets.push(sheet);
  }

  const assetByUnit = new Map();
  for (const sheet of sheets) {
    sheet.tiles.forEach((tile) => assetByUnit.set(tile.unit_id, {
      src: tile.src,
      sha256: tile.sha256,
      size_bytes: tile.size_bytes,
      sheet_index: sheet.job.sheet_index,
      slot_index: tile.mother_sheet_slot - 1,
    }));
  }
  const pageAssets = pages.map((_page, pageIndex) => assetByUnit.get(units.find((unit) => unit.page_index === pageIndex)?.unit_id)?.src);
  const panelAssetsByPage = pages.map((page, pageIndex) => (page.panels || []).map((_panel, panelIndex) => assetByUnit.get(units.find((unit) => unit.page_index === pageIndex && unit.panel_index === panelIndex)?.unit_id)?.src));
  let content = assembleArkContentFromDraft(input.draft, pages, { pageAssets, panelAssetsByPage }, { textModel: settings.textModel, imageModel: settings.imageModel, motherSheetCount: sheets.length, illustrationUnitCount: units.length }, input.production_mode);
  content = {
    ...content,
    pages: content.pages.map((page, pageIndex) => {
      const pageUnit = units.find((unit) => unit.page_index === pageIndex);
      const pageAsset = assetByUnit.get(pageUnit?.unit_id);
      return {
        ...page,
        image_style: pageAsset ? { ...page.image_style, src: pageAsset.src, crop: { x: 0, y: 0, width: 1, height: 1 } } : page.image_style,
        info_panels: (page.info_panels || []).map((panel, panelIndex) => {
          const unit = units.find((candidate) => candidate.page_index === pageIndex && candidate.panel_index === panelIndex);
          const asset = assetByUnit.get(unit?.unit_id);
          return asset ? { ...panel, image_style: { ...panel.image_style, src: asset.src, crop: { x: 0, y: 0, width: 1, height: 1 } } } : panel;
        }),
      };
    }),
    generation: {
      ...content.generation,
      run_id: `images-web-${Date.now()}-${randomUUID().slice(0, 8)}`,
      strategy: "3x3_mother_sheet_server_tiles",
      mother_sheet_count: sheets.length,
      illustration_unit_count: units.length,
      actual_image_calls: sheets.length,
      estimated_image_cost_cny: Number((sheets.length * IMAGE_PRICE_CNY).toFixed(2)),
      page_plan_attempts: planAttempts,
      mother_sheet_sha256: sheets.map((sheet) => sheet.sha256),
      tile_sha256: sheets.flatMap((sheet) => sheet.tiles.map((tile) => tile.sha256)),
    },
  };
  return parseContentPackage(JSON.stringify(content));
}

async function generatePageCandidates(input, settings) {
  const candidates = await Promise.all([0, 1, 2].map(async (index) => {
    const prompt = buildArkPageCandidatePrompt(input, index);
    const payload = await arkPost("/images/generations", settings.apiKey, buildArkImageRequest({ model: settings.imageModel, prompt, referenceImageDataUrl: XIAOSHIMEI_AVATAR_DATA_URL }), "PAGE_CANDIDATE_IMAGE_CALL_FAILED");
    const image = await imagePayload(payload);
    return { src: image.dataUrl, sha256: image.sha256, size_bytes: image.bytes.length, width: image.info.width, height: image.info.height };
  }));
  return { schema: PAGE_CANDIDATE_RESPONSE_SCHEMA, run_id: `candidate-web-${Date.now()}-${randomUUID().slice(0, 8)}`, candidates };
}

export default async function handler(request, response) {
  const route = routeName(request);
  if (request.method === "GET" && route === "health") return send(response, 200, { status: "AWAITING_BYOK", configured: false, provider: "volcengine-ark", provider_label: "火山方舟", key_store: "当前标签页 sessionStorage" });
  if (request.method === "GET" && route === "config") return send(response, 200, { configured: false, provider: "volcengine-ark", provider_label: "火山方舟", base_url: ARK_BASE_URL, text_model: DEFAULT_TEXT_MODEL, image_model: DEFAULT_IMAGE_MODEL, key_store: "当前标签页 sessionStorage" });
  if (request.method !== "POST") return send(response, 405, { error: "METHOD_NOT_ALLOWED" });
  try {
    const settings = requestConfig(request);
    if (route === "text-draft") return send(response, 200, await generateTextDraft(parseTextDraftRequest(request.body), settings));
    if (route === "generate-images") return send(response, 200, await generateImages(parseImageGenerationRequest(request.body), settings, request));
    if (route === "page-candidates") return send(response, 200, await generatePageCandidates(parsePageCandidateRequest(request.body), settings, request));
    return send(response, 404, { error: "ROUTE_NOT_FOUND" });
  } catch (error) {
    const code = String(error?.message || error || "PROVIDER_FAILED").slice(0, 360);
    const status = code.includes("API_KEY_REQUIRED") ? 401 : code.includes("INVALID") || error instanceof TypeError ? 400 : 422;
    return send(response, status, { error: "ARK_PROBE_FAILED", code, stage: route === "text-draft" ? "text" : "image" });
  }
}
