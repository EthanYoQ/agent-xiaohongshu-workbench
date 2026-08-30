import { createServer } from "node:http";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import sharp from "sharp";
import { ARK_BASE_URL, assembleArkContent, assembleArkContentFromDraft, buildArkDraftTextRequest, buildArkImageQaRequest, buildArkImageRequest, buildArkPageCandidatePrompt, buildArkPagePlanRequest, buildArkTextRequest, classifyArkImageForStudio, composeArkPageImagePrompt, decodeArkImage, deriveArkVisualActionContract, extractArkImageQa, extractArkPagePlan, extractArkPlan, extractArkTextDraft, inspectImageBytes, isThreeByFourImage, sha256Bytes, textQualityRetryGuidance } from "../src/ark-provider-core.mjs";
import { admitPendingImage, createImageRunCheckpoint, parseImageRunCheckpoint, recordImageCall, recordPendingImage, recordPendingPipelineFailure, recordResumableFailure, replaceAdmittedImage, resumeImageIndex, updatePendingImage } from "../src/image-run-checkpoint.mjs";
import { buildAssetMapFromMotherSheets, buildIllustrationUnits, buildMotherSheetPrompt, cropRegionForPreferredAspect, groupIllustrationUnits, motherSheetRegionForUnit } from "../src/mother-sheet.mjs";
import { detectUniformEdgeInsets, exactThreeByFourCrop } from "../src/mother-sheet-trim.mjs";
import { inspectMotherSheetTilePixels, inspectMotherSheetTileStats } from "../src/mother-sheet-tile-quality.mjs";
import { cleanupGeneratedGridArtifacts } from "../src/mother-sheet-artifact-cleanup.mjs";
import { detectKvTemplateLeftColumnRegions } from "../src/mother-sheet-adaptive-regions.mjs";
import { PAGE_CANDIDATE_RESPONSE_SCHEMA, TEXT_DRAFT_RESPONSE_SCHEMA, parseGenerationRequest, parseImageGenerationRequest, parsePageCandidateRequest, parseTextDraftRequest } from "../src/provider-contract.mjs";

const HOST = "127.0.0.1";
const PORT = Number(process.env.ARK_PROVIDER_PORT || 4175);
const WEB_ORIGIN = process.env.XIAOSHIMEI_WEB_ORIGIN || "http://127.0.0.1:4174";
const WEB_ORIGINS = new Set([WEB_ORIGIN, "http://127.0.0.1:4184", "http://localhost:4174", "http://localhost:4184"]);
const ROOT = new URL("..", import.meta.url).pathname;
const RUNTIME_ROOT = process.env.XIAOSHIMEI_RUNTIME_DIR ? resolve(process.env.XIAOSHIMEI_RUNTIME_DIR) : ROOT;
const CONFIG_PATH = join(RUNTIME_ROOT, ".data", "provider-config.json");
const DEFAULT_KEYCHAIN_SERVICE = "com.mesy.xiaoshimei-studio.volcengine-ark";
const PROVIDER_PRESETS = Object.freeze({
  "volcengine-ark": { label: "火山方舟", base_url: ARK_BASE_URL, keychain_service: DEFAULT_KEYCHAIN_SERVICE },
  "openai-compatible": { label: "OpenAI 兼容服务", base_url: "https://api.openai.com/v1", keychain_service: "com.mesy.xiaoshimei-studio.openai-compatible" },
});

function cleanSetting(value, max = 240) { return String(value || "").trim().slice(0, max); }
function readKeychain(service) {
  if (process.platform !== "darwin" || !service) return "";
  try {
    return execFileSync("/usr/bin/security", ["find-generic-password", "-a", process.env.USER || process.env.LOGNAME || "", "-s", service, "-w"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch { return ""; }
}
function storeKeychain(service, value) {
  const account = process.env.USER || process.env.LOGNAME || "";
  if (process.platform !== "darwin" || !account || !service) throw new Error("KEYCHAIN_UNAVAILABLE");
  execFileSync("/usr/bin/security", ["add-generic-password", "-a", account, "-s", service, "-w", value, "-U"], { stdio: "ignore" });
}
async function readProviderConfig() {
  try {
    const value = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
    return value && typeof value === "object" ? value : {};
  } catch { return {}; }
}

const storedProviderConfig = await readProviderConfig();
let PROVIDER_ID = cleanSetting(storedProviderConfig.provider || process.env.XIAOSHIMEI_PROVIDER_ID || "volcengine-ark", 64);
if (!PROVIDER_PRESETS[PROVIDER_ID]) PROVIDER_ID = "volcengine-ark";
let PROVIDER_LABEL = cleanSetting(storedProviderConfig.label || PROVIDER_PRESETS[PROVIDER_ID].label, 40);
let PROVIDER_BASE_URL = cleanSetting(storedProviderConfig.base_url || process.env.XIAOSHIMEI_PROVIDER_BASE_URL || PROVIDER_PRESETS[PROVIDER_ID].base_url, 300).replace(/\/$/, "");
let KEYCHAIN_SERVICE = cleanSetting(storedProviderConfig.keychain_service || PROVIDER_PRESETS[PROVIDER_ID].keychain_service, 120);
let API_KEY = readKeychain(KEYCHAIN_SERVICE) || process.env.ARK_API_KEY || "";
let TEXT_MODEL = cleanSetting(storedProviderConfig.text_model || process.env.ARK_TEXT_MODEL || "", 120);
let IMAGE_MODEL = cleanSetting(storedProviderConfig.image_model || process.env.ARK_IMAGE_MODEL || "", 120);
const GENERATED_ROOT = join(RUNTIME_ROOT, "public", "generated", "ark");
const RECEIPT_ROOT = join(RUNTIME_ROOT, "artifacts", "provider-runs");
const REFERENCE_PATH = join(ROOT, "public", "assets", "xiaoshimei-character-full.png");
const IMAGE_PRICE_CNY = Number(process.env.ARK_IMAGE_PRICE_CNY || 0.22);
const runtimeState = { status: configured() ? "CONFIGURED_UNVERIFIED" : "NOT_CONFIGURED", last_error: null, last_success_at: null };

function configured() { return Boolean(API_KEY && TEXT_MODEL && IMAGE_MODEL && PROVIDER_BASE_URL); }

function publicProviderConfig() {
  return {
    provider: PROVIDER_ID,
    provider_label: PROVIDER_LABEL,
    base_url: PROVIDER_BASE_URL,
    text_model: TEXT_MODEL || null,
    image_model: IMAGE_MODEL || null,
    configured: configured(),
    key_store: process.platform === "darwin" ? "macOS Keychain" : "environment",
    keychain_service: KEYCHAIN_SERVICE,
  };
}

async function updateProviderConfig(input = {}) {
  const provider = cleanSetting(input.provider || PROVIDER_ID, 64);
  if (!PROVIDER_PRESETS[provider]) throw new TypeError("PROVIDER_UNSUPPORTED");
  const preset = PROVIDER_PRESETS[provider];
  const baseUrl = cleanSetting(input.base_url || preset.base_url, 300).replace(/\/$/, "");
  let parsed;
  try { parsed = new URL(baseUrl); } catch { throw new TypeError("PROVIDER_BASE_URL_INVALID"); }
  if (parsed.protocol !== "https:") throw new TypeError("PROVIDER_BASE_URL_MUST_USE_HTTPS");
  const next = {
    provider,
    label: cleanSetting(input.label || preset.label, 40) || preset.label,
    base_url: baseUrl,
    text_model: cleanSetting(input.text_model, 120),
    image_model: cleanSetting(input.image_model, 120),
    keychain_service: cleanSetting(input.keychain_service || preset.keychain_service, 120),
  };
  if (!next.text_model || !next.image_model || !next.keychain_service) throw new TypeError("PROVIDER_MODELS_REQUIRED");
  const apiKey = cleanSetting(input.api_key, 800);
  if (apiKey) storeKeychain(next.keychain_service, apiKey);
  const resolvedKey = apiKey || readKeychain(next.keychain_service) || (provider === PROVIDER_ID ? API_KEY : "");
  await mkdir(join(ROOT, ".data"), { recursive: true });
  await writeFile(CONFIG_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  PROVIDER_ID = next.provider;
  PROVIDER_LABEL = next.label;
  PROVIDER_BASE_URL = next.base_url;
  TEXT_MODEL = next.text_model;
  IMAGE_MODEL = next.image_model;
  KEYCHAIN_SERVICE = next.keychain_service;
  API_KEY = resolvedKey;
  runtimeState.status = configured() ? "CONFIGURED_UNVERIFIED" : "NOT_CONFIGURED";
  runtimeState.last_error = null;
  return publicProviderConfig();
}

class ResumableImageGenerationError extends Error {
  constructor(message, details) {
    super(message);
    this.name = "ResumableImageGenerationError";
    this.details = details;
  }
}

function resumableDetails(checkpoint) {
  if (checkpoint.final_page_count) {
    const completedTileIds = new Set(checkpoint.images.flatMap((image) => Array.isArray(image.tiles) ? image.tiles.map((tile) => tile.unit_id) : []));
    const completedPages = Array.from({ length: checkpoint.final_page_count }, (_, pageIndex) => checkpoint.illustration_units.filter((unit) => unit.page_index === pageIndex)).filter((units) => units.length > 0 && units.every((unit) => completedTileIds.has(unit.unit_id))).length;
    return {
      resume_run_id: checkpoint.run_id,
      completed_pages: completedPages,
      total_pages: checkpoint.final_page_count,
      completed_mother_sheets: checkpoint.images.length,
      total_mother_sheets: checkpoint.page_count,
      failed_mother_sheet: checkpoint.failure?.failed_page || checkpoint.images.length + 1,
      actual_image_calls: checkpoint.actual_image_calls,
      estimated_image_cost_cny: Number((checkpoint.actual_image_calls * IMAGE_PRICE_CNY).toFixed(2)),
    };
  }
  return {
    resume_run_id: checkpoint.run_id,
    completed_pages: checkpoint.images.length,
    total_pages: checkpoint.page_count,
    failed_page: checkpoint.failure?.failed_page || checkpoint.images.length + 1,
    actual_image_calls: checkpoint.actual_image_calls,
    estimated_image_cost_cny: Number((checkpoint.actual_image_calls * IMAGE_PRICE_CNY).toFixed(2)),
  };
}
function responseHeaders() { return { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type", "cache-control": "no-store" }; }
function send(response, status, value) { response.writeHead(status, responseHeaders()); response.end(JSON.stringify(value)); }

async function writeRouteFailureReceipt(route, code, details) {
  const createdAt = new Date().toISOString();
  const failureId = `failure-${createdAt.replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  await mkdir(RECEIPT_ROOT, { recursive: true });
  await writeFile(join(RECEIPT_ROOT, `${failureId}.json`), `${JSON.stringify({
    schema: "xiaoshimei.provider-failure.v1",
    failure_id: failureId,
    created_at: createdAt,
    route,
    code,
    details: details && typeof details === "object" ? details : null,
    content_persisted: false,
    credentials_persisted: false,
  }, null, 2)}\n`);
  return failureId;
}

async function readJson(request) {
  const chunks = []; let size = 0;
  for await (const chunk of request) { size += chunk.length; if (size > 12_000_000) throw new TypeError("REQUEST_TOO_LARGE"); chunks.push(chunk); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function arkPost(path, body, stage) {
  const started = performance.now();
  let response;
  try {
    response = await fetch(`${PROVIDER_BASE_URL}${path}`, { method: "POST", headers: { authorization: `Bearer ${API_KEY}`, "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(180000) });
  } catch (error) {
    const cause = String(error?.cause?.code || error?.code || error?.name || "UNKNOWN").replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 80);
    throw new Error(`${stage}:NETWORK_FETCH_FAILED:${cause}`);
  }
  const text = await response.text();
  let value;
  try { value = JSON.parse(text); } catch { throw new Error(`ARK_NON_JSON_RESPONSE_${response.status}`); }
  if (!response.ok) {
    const upstream = value?.error || value || {};
    const code = String(upstream.code || "UNKNOWN").replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 80);
    const param = String(upstream.param || "").replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 80);
    const message = String(upstream.message || "").replace(/[\r\n\t]+/g, " ").replace(/[^\p{L}\p{N} _.,:;()'"-]/gu, "_").slice(0, 240);
    throw new Error(`${stage}:ARK_HTTP_${response.status}:${code}${param ? `:PARAM_${param}` : ""}${message ? `:${message}` : ""}`);
  }
  return { value, latencyMs: Math.round(performance.now() - started) };
}

async function imageBytes(payload) {
  if (payload.kind === "base64") return Buffer.from(payload.value, "base64");
  let response;
  try { response = await fetch(payload.value, { signal: AbortSignal.timeout(60000) }); }
  catch (error) {
    const cause = String(error?.cause?.code || error?.code || error?.name || "UNKNOWN").replace(/[^A-Za-z0-9_.-]/g, "_").slice(0, 80);
    throw new Error(`IMAGE_ASSET_DOWNLOAD_NETWORK_FAILED:${cause}`);
  }
  if (!response.ok) throw new Error(`ARK_ASSET_DOWNLOAD_${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

async function splitMotherSheet(bytes, job, runDir, runId, sheetNumber) {
  const units = job?.units;
  if (!Array.isArray(units) || units.length < 1 || units.length > 9) throw new Error("MOTHER_SHEET_UNITS_INVALID");
  const metadata = await sharp(bytes).metadata();
  const width = Number(metadata.width || 0); const height = Number(metadata.height || 0);
  if (!width || !height || Math.abs(width / height - 0.75) > 0.01) throw new Error(`MOTHER_SHEET_ASPECT_RATIO_INVALID:${width}x${height}`);
  const sheetRaw = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const adaptiveLeftColumn = job?.template === "kv-focus-2x2"
    ? detectKvTemplateLeftColumnRegions({ data: sheetRaw.data, width: sheetRaw.info.width, height: sheetRaw.info.height, channels: sheetRaw.info.channels })
    : null;
  const tiles = [];
  for (let index = 0; index < units.length; index += 1) {
    const fixedRegion = motherSheetRegionForUnit(width, height, job, index);
    const adaptiveRegion = index === 1 || index === 2 ? adaptiveLeftColumn?.regions?.[index - 1] : null;
    const region = adaptiveRegion ? { ...adaptiveRegion, slotIndex: fixedRegion.slotIndex, regionRole: fixedRegion.regionRole } : fixedRegion;
    const { slotIndex, regionRole, ...cropRegion } = region;
    let baseTile = await sharp(bytes).extract(cropRegion).png().toBuffer();
    if (job.template === "grid-3x3") {
      baseTile = await sharp(baseTile).composite([{ input: { create: { width: Math.round(cropRegion.width * .18), height: Math.round(cropRegion.height * .18), channels: 4, background: "#ffffff" } }, left: 0, top: 0 }]).png().toBuffer();
    }
    const cleanupRaw = await sharp(baseTile).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const cleanup = cleanupGeneratedGridArtifacts({ data: cleanupRaw.data, width: cleanupRaw.info.width, height: cleanupRaw.info.height, channels: cleanupRaw.info.channels }, { kv: regionRole === "kv-2x2-3:4" });
    if (cleanup.actions.length) baseTile = await sharp(cleanup.data, { raw: { width: cleanup.width, height: cleanup.height, channels: cleanup.channels } }).png().toBuffer();
    const quality = inspectMotherSheetTileStats(await sharp(baseTile).stats());
    if (!quality.hasVisibleSubject) throw new Error(`MOTHER_SHEET_UNIT_MISSING:${units[index].unit_id}`);
    const raw = await sharp(baseTile).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const edgeInsets = { left: 0, right: 0, top: 0, bottom: 0 };
    const isCoverKv = regionRole === "kv-top-3x2-9:8";
    const targetAspect = isCoverKv ? "9:8" : "3:4";
    const exactRegion = adaptiveRegion
      ? null
      : isCoverKv
        ? cropRegionForPreferredAspect(raw.info.width, raw.info.height, targetAspect)
        : exactThreeByFourCrop(raw.info.width, raw.info.height, edgeInsets);
    const normalized = adaptiveRegion ? sharp(baseTile) : sharp(baseTile).extract(exactRegion);
    const targetWidth = 1080;
    const targetHeight = isCoverKv ? 960 : 1440;
    const tileBytes = await normalized.resize(targetWidth, targetHeight, { fit: adaptiveRegion ? "contain" : "fill", background: "#ffffff" }).flatten({ background: "#ffffff" }).png({ compressionLevel: 9 }).toBuffer();
    const finalRaw = await sharp(tileBytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const edgeGate = inspectMotherSheetTilePixels({ data: finalRaw.data, width: finalRaw.info.width, height: finalRaw.info.height, channels: finalRaw.info.channels }, { expectedAspect: targetAspect });
    if (!edgeGate.hasCleanEdges) throw new Error(`MOTHER_SHEET_UNIT_EDGE_CONTAMINATION:${units[index].unit_id}:${edgeGate.contaminatedSides.join("+") || "aspect"}`);
    const fileName = `sheet-${String(sheetNumber).padStart(2, "0")}-unit-${String(index + 1).padStart(2, "0")}.png`;
    await writeFile(join(runDir, fileName), tileBytes);
    tiles.push({
      unit_id: units[index].unit_id,
      page_index: units[index].page_index,
      panel_index: units[index].panel_index,
      file: fileName,
      src: `/generated/ark/${runId}/${fileName}`,
      sha256: sha256Bytes(tileBytes),
      size_bytes: tileBytes.length,
      width: targetWidth,
      height: targetHeight,
      media_role: units[index].media_role,
      preferred_aspect: targetAspect,
      fit_policy: "cover",
      edge_trim: edgeInsets,
      artifact_cleanup: cleanup.actions,
      adaptive_region: adaptiveRegion ? { ...adaptiveRegion, strategy: "detected-left-column-contain" } : null,
      edge_gate: edgeGate,
      mother_sheet_slot: slotIndex + 1,
      mother_sheet_region_role: regionRole,
      presence_gate: quality,
      visual_action_contract: units[index].visual_action,
    });
  }
  return tiles;
}

async function generateImageProbe(input = {}) {
  if (!configured()) throw new Error("ARK_PROVIDER_NOT_CONFIGURED");
  runtimeState.status = "IMAGE_PROBE_RUNNING"; runtimeState.last_error = null;
  const runId = `image-probe-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const runDir = join(GENERATED_ROOT, runId);
  await mkdir(runDir, { recursive: true }); await mkdir(RECEIPT_ROOT, { recursive: true });
  const referenceBytes = await readFile(REFERENCE_PATH);
  const referenceDataUrl = `data:image/png;base64,${referenceBytes.toString("base64")}`;
  const topic = String(input?.prompt || "").trim().slice(0, 1200);
  const prompt = [
    "这是单张真实主题生图测试，不生成任何可见文字。",
    topic ? `主题：${topic}` : "主题：东方生活方式。",
    "必须围绕上面的主题选择最能被肉眼看懂的场景、动作和器物，不得套用与主题无关的固定手机、护眼或工位场景。",
    "如果主题包含差异、对比、区别、A与B等比较关系，用一个自然完整的场景做视觉对照，例如左右两组器物、动作流程或空间气质；不要使用文字标签解释。",
    "画面中只出现一个小师妹，人物身份与参考图一致；她必须正在做与主题直接相关的具体动作，关键器物清楚可见。",
    "竖幅3:4，中景或中近景，自然光，东方生活化质感，构图完整并留出适度干净空间。",
    "画面中禁止任何文字、字母、数字、logo、水印、边框或UI。",
  ].join("\n");
  const imageResult = await arkPost("/images/generations", buildArkImageRequest({ model: IMAGE_MODEL, prompt, referenceImageDataUrl: referenceDataUrl }), "IMAGE_PROBE_CALL_FAILED");
  const decoded = decodeArkImage(imageResult.value);
  const bytes = await imageBytes(decoded);
  if (bytes.length < 1024) throw new Error("ARK_IMAGE_TOO_SMALL");
  const imageInfo = inspectImageBytes(bytes);
  if (!isThreeByFourImage(imageInfo)) throw new Error(`ARK_IMAGE_ASPECT_RATIO_INVALID:${imageInfo.width}x${imageInfo.height}`);
  const fileName = `01.${imageInfo.extension}`;
  const target = join(runDir, fileName);
  await writeFile(target, bytes);
  const completedAt = new Date().toISOString();
  const result = {
    schema: "xiaoshimei.image-probe.v1", run_id: runId, created_at: completedAt, provider: PROVIDER_ID,
    model: IMAGE_MODEL, src: `/generated/ark/${runId}/${fileName}`, width: imageInfo.width, height: imageInfo.height,
    sha256: sha256Bytes(bytes), size_bytes: bytes.length, latency_ms: imageResult.latencyMs,
  };
  await writeFile(join(RECEIPT_ROOT, `${runId}.json`), `${JSON.stringify({ ...result, status: "IMAGE_PROBE_SUCCESS", estimated_image_cost_cny: IMAGE_PRICE_CNY }, null, 2)}\n`);
  runtimeState.status = "LIVE_VERIFIED"; runtimeState.last_success_at = completedAt;
  return result;
}

async function generate(input) {
  if (!configured()) throw new Error("ARK_PROVIDER_NOT_CONFIGURED");
  runtimeState.status = "PROBE_RUNNING"; runtimeState.last_error = null;
  const runId = `ark-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const runDir = join(GENERATED_ROOT, runId);
  await mkdir(runDir, { recursive: true }); await mkdir(RECEIPT_ROOT, { recursive: true });
  const referenceBytes = await readFile(REFERENCE_PATH);
  const referenceDataUrl = `data:image/png;base64,${referenceBytes.toString("base64")}`;
  const textResult = await arkPost("/responses", buildArkTextRequest(input, TEXT_MODEL), "TEXT_MODEL_CALL_FAILED");
  let plan;
  try {
    plan = extractArkPlan(textResult.value, { topic: input.topic, pillar: input.pillar, goal: input.goal });
  } catch (error) {
    const call = textResult.value?.output?.find((item) => item?.type === "function_call");
    const rawArguments = typeof call?.arguments === "string" ? call.arguments : "";
    if (rawArguments) await writeFile(join(runDir, "rejected-function-arguments.txt"), rawArguments);
    const rejectedAt = new Date().toISOString();
    const failureReceipt = {
      schema: "xiaoshimei.ark-provider-run.v1",
      run_id: runId,
      created_at: rejectedAt,
      status: "TEXT_REJECTED_NO_IMAGE_CALL",
      provider: PROVIDER_ID,
      models: { text: TEXT_MODEL, image: IMAGE_MODEL },
      request: { topic_sha256: sha256Bytes(Buffer.from(String(input.topic))), pillar: input.pillar, goal: input.goal },
      text: {
        latency_ms: textResult.latencyMs,
        usage: textResult.value.usage || null,
        response_status: textResult.value.status || null,
        rejection_code: String(error?.message || error),
        function_arguments_sha256: rawArguments ? sha256Bytes(Buffer.from(rawArguments)) : null,
        function_arguments_bytes: Buffer.byteLength(rawArguments),
      },
      images: [],
      estimated_image_cost_cny: 0,
      truth_layers: { mechanism_ready: "REVISE_TEXT_OUTPUT", package_verified: "NOT_RUN", production_applied: "NOT_RUN", runtime_operational: "FAIL_CLOSED", reality_validated: "NOT_RUN" },
    };
    await writeFile(join(RECEIPT_ROOT, `${runId}.json`), `${JSON.stringify(failureReceipt, null, 2)}\n`);
    throw error;
  }
  const assetUrls = []; const imageEvidence = [];
  for (let index = 0; index < plan.pages.length; index += 1) {
    const imageResult = await arkPost("/images/generations", buildArkImageRequest({ model: IMAGE_MODEL, prompt: plan.pages[index].imagePrompt, referenceImageDataUrl: referenceDataUrl }), `IMAGE_${index + 1}_CALL_FAILED`);
    const decoded = decodeArkImage(imageResult.value); const bytes = await imageBytes(decoded);
    if (bytes.length < 1024) throw new Error("ARK_IMAGE_TOO_SMALL");
    const imageInfo = inspectImageBytes(bytes);
    if (!isThreeByFourImage(imageInfo)) throw new Error(`ARK_IMAGE_ASPECT_RATIO_INVALID:${imageInfo.width}x${imageInfo.height}`);
    const fileName = `${String(index + 1).padStart(2, "0")}.${imageInfo.extension}`;
    await writeFile(join(runDir, fileName), bytes); assetUrls.push(`/generated/ark/${runId}/${fileName}`);
    imageEvidence.push({ file: fileName, sha256: sha256Bytes(bytes), size_bytes: bytes.length, mime: imageInfo.mime, width: imageInfo.width, height: imageInfo.height, reported_size: decoded.size, latency_ms: imageResult.latencyMs, usage: imageResult.value.usage || null });
  }
  const content = assembleArkContent(input, plan, assetUrls, { textModel: TEXT_MODEL, imageModel: IMAGE_MODEL });
  const receipt = {
    schema: "xiaoshimei.ark-provider-run.v1", run_id: runId, created_at: new Date().toISOString(), status: "PROBE_GENERATED_NOT_REVIEWED", provider: PROVIDER_ID,
    models: { text: TEXT_MODEL, image: IMAGE_MODEL }, reference: { path: basename(REFERENCE_PATH), sha256: sha256Bytes(referenceBytes), size_bytes: referenceBytes.length },
    request: { topic_sha256: sha256Bytes(Buffer.from(String(input.topic))), pillar: input.pillar, goal: input.goal },
    text: {
      latency_ms: textResult.latencyMs,
      usage: textResult.value.usage || null,
      quality_gate: "PASS_BEFORE_IMAGE_GENERATION",
      plan_sha256: sha256Bytes(Buffer.from(JSON.stringify(plan))),
      publish_body_chars: plan.body.replace(/\s/g, "").length,
      page_body_chars: plan.pages.map((page) => page.body.replace(/\s/g, "").length),
    },
    images: imageEvidence,
    estimated_image_cost_cny: imageEvidence.length * Number(process.env.ARK_IMAGE_PRICE_CNY || 0.22),
    truth_layers: { mechanism_ready: "PASS_LOCAL", package_verified: "PENDING_STUDIO_ROUNDTRIP", production_applied: "NOT_RUN", runtime_operational: "PROBE_ONLY", reality_validated: "NOT_RUN" },
  };
  await writeFile(join(RECEIPT_ROOT, `${runId}.json`), `${JSON.stringify(receipt, null, 2)}\n`);
  runtimeState.status = "LIVE_VERIFIED"; runtimeState.last_success_at = receipt.created_at;
  return content;
}

async function generateTextDraft(input) {
  if (!configured()) throw new Error("ARK_PROVIDER_NOT_CONFIGURED");
  runtimeState.status = "TEXT_GENERATING"; runtimeState.last_error = null;
  const runId = `text-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const runDir = join(GENERATED_ROOT, runId);
  await mkdir(runDir, { recursive: true }); await mkdir(RECEIPT_ROOT, { recursive: true });
  let textResult; let draft; let finalError; const attempts = [];
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const qualityFeedback = finalError ? textQualityRetryGuidance(finalError) : "";
    textResult = await arkPost("/responses", buildArkDraftTextRequest({ ...input, quality_feedback: qualityFeedback }, TEXT_MODEL), "TEXT_DRAFT_MODEL_CALL_FAILED");
    try {
      draft = extractArkTextDraft(textResult.value, { topic: input.topic, pillar: input.pillar, goal: input.goal });
      attempts.push({ attempt, status: "PASS", latency_ms: textResult.latencyMs, usage: textResult.value.usage || null });
      break;
    } catch (error) {
      finalError = error;
      const call = textResult.value?.output?.find((item) => item?.type === "function_call");
      const raw = typeof call?.arguments === "string" ? call.arguments : "";
      if (raw) await writeFile(join(runDir, `rejected-attempt-${attempt}.txt`), raw);
      attempts.push({ attempt, status: "REJECTED", rejection_code: String(error?.message || error), raw_sha256: raw ? sha256Bytes(Buffer.from(raw)) : null, latency_ms: textResult.latencyMs, usage: textResult.value.usage || null });
    }
  }
  if (!draft) {
    await writeFile(join(RECEIPT_ROOT, `${runId}.json`), `${JSON.stringify({ schema: "xiaoshimei.text-draft-run.v1", run_id: runId, created_at: new Date().toISOString(), status: "TEXT_REJECTED_AFTER_BOUNDED_REVISION_NO_IMAGE_CALL", attempts, rejection_code: String(finalError?.message || finalError), estimated_image_cost_cny: 0, truth_layers: { mechanism_ready: "REVISE_TEXT_OUTPUT", package_verified: "NOT_RUN", production_applied: "NOT_RUN", runtime_operational: "FAIL_CLOSED", reality_validated: "NOT_RUN" } }, null, 2)}\n`);
    throw finalError;
  }
  const response = {
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
    generation: { provider: PROVIDER_ID, text_model: TEXT_MODEL, status: "TEXT_READY_FOR_USER_CONFIRMATION" },
  };
  const receipt = { schema: "xiaoshimei.text-draft-run.v1", run_id: runId, created_at: response.created_at, status: "TEXT_READY_FOR_USER_CONFIRMATION", provider: PROVIDER_ID, model: TEXT_MODEL, request: { topic_sha256: sha256Bytes(Buffer.from(input.topic)), requirements_sha256: sha256Bytes(Buffer.from(input.text_requirements || "")), pillar: input.pillar, goal: input.goal }, result: { draft_sha256: sha256Bytes(Buffer.from(JSON.stringify(response))), content_type: draft.contentType, style_lock_sha256: input.profile_contract.style_lock ? sha256Bytes(Buffer.from(JSON.stringify(input.profile_contract.style_lock))) : null, body_chars: draft.body.replace(/\s/g, "").length, recommended_image_count: draft.recommendedImageCount, tags_count: draft.tags.length, quality_repairs: draft.qualityRepairs || [] }, attempts, images: [], estimated_image_cost_cny: 0, truth_layers: { mechanism_ready: "PASS_LOCAL", package_verified: "TEXT_REQUIRES_USER_CONFIRMATION", production_applied: "NOT_RUN", runtime_operational: "TEXT_NODE_ONLY", reality_validated: "NOT_RUN" } };
  await writeFile(join(RECEIPT_ROOT, `${runId}.json`), `${JSON.stringify(receipt, null, 2)}\n`);
  runtimeState.status = "TEXT_READY"; runtimeState.last_success_at = response.created_at;
  return response;
}

async function writeImageCheckpoint(runDir, checkpoint) {
  await writeFile(join(runDir, "checkpoint.json"), `${JSON.stringify(checkpoint, null, 2)}\n`);
}

async function recoverPaidMotherSheetSource(checkpoint, runDir) {
  if (checkpoint.pending_image || checkpoint.actual_image_calls !== checkpoint.images.length + 1 || checkpoint.failure?.failed_page !== checkpoint.images.length + 1) return checkpoint;
  const page = checkpoint.images.length + 1;
  const prefix = `mother-sheet-${String(page).padStart(2, "0")}.`;
  const fileName = (await readdir(runDir)).find((name) => name.startsWith(prefix));
  if (!fileName) return checkpoint;
  const bytes = await readFile(join(runDir, fileName));
  const imageInfo = inspectImageBytes(bytes);
  if (!isThreeByFourImage(imageInfo)) throw new Error(`MOTHER_SHEET_ASPECT_RATIO_INVALID:${imageInfo.width}x${imageInfo.height}`);
  const pending = {
    page,
    file: fileName,
    src: `/generated/ark/${checkpoint.run_id}/${fileName}`,
    sha256: sha256Bytes(bytes),
    size_bytes: bytes.length,
    width: imageInfo.width,
    height: imageInfo.height,
    image_latency_ms: null,
    tiles: [],
    recovered_from_paid_asset: true,
  };
  const recovered = recordPendingImage(checkpoint, pending);
  await writeImageCheckpoint(runDir, recovered);
  return recovered;
}

async function sliceAndAdmitMotherSheet(checkpoint, runDir, index) {
  const pending = checkpoint.pending_image;
  if (!pending || pending.page !== index + 1) throw new Error("MOTHER_SHEET_PENDING_SOURCE_MISSING");
  const bytes = await readFile(join(runDir, pending.file));
  const tiles = await splitMotherSheet(bytes, checkpoint.pages[index], runDir, checkpoint.run_id, index + 1);
  const completedPending = { ...pending, tiles };
  let next = updatePendingImage(checkpoint, completedPending);
  await writeImageCheckpoint(runDir, next);
  const attemptRecord = { page: index + 1, mother_sheet: index + 1, attempt: 1, decision: "SLICED_FOR_STUDIO_REVIEW", studio_disposition: "EDITABLE_DRAFT_REQUIRES_REVIEW", image_sha256: completedPending.sha256, size_bytes: completedPending.size_bytes, width: completedPending.width, height: completedPending.height, image_latency_ms: completedPending.image_latency_ms, illustration_unit_count: tiles.length, unit_ids: tiles.map((tile) => tile.unit_id), recovered_from_paid_asset: Boolean(completedPending.recovered_from_paid_asset) };
  const evidence = { file: completedPending.file, src: completedPending.src, sha256: completedPending.sha256, size_bytes: completedPending.size_bytes, width: completedPending.width, height: completedPending.height, latency_ms: completedPending.image_latency_ms, tiles, slice_pipeline_version: "white-background-v4", visual_qa: { decision: "NOT_RUN", studio_disposition: "EDITABLE_DRAFT_REQUIRES_REVIEW", warning: "母图已按固定网格切分；每个插画单元仍需在工作台人工确认人物、动作、手部和串格情况。" } };
  next = admitPendingImage(next, { evidence, attempt: attemptRecord });
  await writeImageCheckpoint(runDir, next);
  await writePartialImageReceipt(next, next.images.length === next.page_count ? "MOTHER_SHEETS_SLICED_PENDING_STUDIO_ASSEMBLY" : "MOTHER_SHEET_GENERATION_IN_PROGRESS");
  return next;
}

async function resliceAdmittedMotherSheets(checkpoint, runDir) {
  let next = checkpoint;
  for (let index = 0; index < next.images.length; index += 1) {
    const current = next.images[index];
    if (current.slice_pipeline_version === "white-background-v4") continue;
    const bytes = await readFile(join(runDir, current.file));
    const tiles = await splitMotherSheet(bytes, next.pages[index], runDir, next.run_id, index + 1);
    const evidence = { ...current, tiles, slice_pipeline_version: "white-background-v4" };
    next = replaceAdmittedImage(next, { page: index + 1, evidence, attempt: { page: index + 1, mother_sheet: index + 1, attempt: 1, decision: "RESLICED_AFTER_PIPELINE_REPAIR", studio_disposition: "EDITABLE_DRAFT_REQUIRES_REVIEW", image_sha256: current.sha256, illustration_unit_count: tiles.length, unit_ids: tiles.map((tile) => tile.unit_id) } });
    await writeImageCheckpoint(runDir, next);
  }
  return next;
}

async function writePartialImageReceipt(checkpoint, status) {
  const createdAt = new Date().toISOString();
  const receipt = {
    schema: "xiaoshimei.image-generation-run.v1",
    run_id: checkpoint.run_id,
    created_at: createdAt,
    status,
    draft_id: checkpoint.draft_id,
    production_mode: checkpoint.production_mode,
    page_count: checkpoint.final_page_count || checkpoint.page_count,
    illustration_unit_count: checkpoint.illustration_units?.length || checkpoint.page_count,
    mother_sheet_count: checkpoint.final_page_count ? checkpoint.page_count : null,
    completed_mother_sheets: checkpoint.final_page_count ? checkpoint.images.length : null,
    completed_pages: checkpoint.final_page_count ? resumableDetails(checkpoint).completed_pages : checkpoint.images.length,
    failed_page: checkpoint.final_page_count ? null : checkpoint.failure?.failed_page || null,
    failed_mother_sheet: checkpoint.final_page_count ? checkpoint.failure?.failed_page || null : null,
    rejection_code: checkpoint.failure?.code || null,
    page_plan_attempts: checkpoint.plan_attempts,
    images: checkpoint.images,
    image_attempts: checkpoint.image_attempts,
    actual_image_calls: checkpoint.actual_image_calls,
    estimated_image_cost_cny: Number((checkpoint.actual_image_calls * IMAGE_PRICE_CNY).toFixed(2)),
    resume: checkpoint.images.length < checkpoint.page_count ? { available: true, resume_run_id: checkpoint.run_id, next_mother_sheet: checkpoint.final_page_count ? checkpoint.images.length + 1 : null, next_page: checkpoint.final_page_count ? null : checkpoint.images.length + 1 } : { available: false, resume_run_id: null, next_mother_sheet: null, next_page: null },
    truth_layers: { mechanism_ready: "PARTIAL_RESULT_PRESERVED", package_verified: "NOT_RUN", production_applied: "NOT_RUN", runtime_operational: "RESUMABLE_LOCAL_FAILURE", reality_validated: "NOT_RUN" },
  };
  await writeFile(join(RECEIPT_ROOT, `${checkpoint.run_id}.json`), `${JSON.stringify(receipt, null, 2)}\n`);
  return receipt;
}

async function generateImages(input) {
  if (!configured()) throw new Error("ARK_PROVIDER_NOT_CONFIGURED");
  runtimeState.status = "IMAGE_GENERATING"; runtimeState.last_error = null;
  const { draft } = input;
  const pageCount = input.image_count === "AUTO" ? draft.recommended_image_count : input.image_count;
  const draftSha256 = sha256Bytes(Buffer.from(JSON.stringify(draft)));
  const runId = input.resume_run_id || `images-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const runDir = join(GENERATED_ROOT, runId);
  await mkdir(runDir, { recursive: true }); await mkdir(RECEIPT_ROOT, { recursive: true });
  const referenceBytes = await readFile(REFERENCE_PATH);
  const referenceDataUrl = `data:image/png;base64,${referenceBytes.toString("base64")}`;
  const actionReferenceDataUrls = input.reference_images.map((item) => item.data_url);
  const actionReferenceEvidence = input.reference_images.map((item) => {
    const bytes = Buffer.from(item.data_url.split(",")[1], "base64");
    return { name: item.name, sha256: sha256Bytes(bytes), size_bytes: bytes.length };
  });
  const reference = { path: basename(REFERENCE_PATH), sha256: sha256Bytes(referenceBytes), size_bytes: referenceBytes.length };
  if (actionReferenceEvidence.length) reference.action_references = actionReferenceEvidence;
  if (input.reference_note) reference.action_note_sha256 = sha256Bytes(Buffer.from(input.reference_note));
  let checkpoint;
  if (input.resume_run_id) {
    const rawCheckpoint = JSON.parse(await readFile(join(runDir, "checkpoint.json"), "utf8"));
    checkpoint = parseImageRunCheckpoint(rawCheckpoint, { draftId: draft.draft_id, draftSha256, productionMode: input.production_mode });
    if (checkpoint.final_page_count !== pageCount) throw new Error("IMAGE_RESUME_FINAL_PAGE_COUNT_MISMATCH");
    if (JSON.stringify(checkpoint.reference) !== JSON.stringify(reference)) throw new Error("IMAGE_RESUME_REFERENCE_MISMATCH");
    checkpoint = await resliceAdmittedMotherSheets(checkpoint, runDir);
    checkpoint = await recoverPaidMotherSheetSource(checkpoint, runDir);
  } else {
    let planResult; let pages; let planError; const planAttempts = [];
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      planResult = await arkPost("/responses", buildArkPagePlanRequest(draft, pageCount, TEXT_MODEL, planError ? String(planError.message || planError) : "", input.production_mode), "PAGE_PLAN_MODEL_CALL_FAILED");
      try {
        pages = extractArkPagePlan(planResult.value, pageCount, { topic: draft.source_input, pillar: draft.pillar, goal: draft.goal, productionMode: input.production_mode });
        planAttempts.push({ attempt, status: "PASS", latency_ms: planResult.latencyMs, usage: planResult.value.usage || null });
        break;
      } catch (error) {
        planError = error;
        const call = planResult.value?.output?.find((item) => item?.type === "function_call");
        const raw = typeof call?.arguments === "string" ? call.arguments : "";
        if (raw) await writeFile(join(runDir, `rejected-page-plan-${attempt}.txt`), raw);
        planAttempts.push({ attempt, status: "REJECTED", rejection_code: String(error?.message || error), raw_sha256: raw ? sha256Bytes(Buffer.from(raw)) : null, latency_ms: planResult.latencyMs, usage: planResult.value.usage || null });
      }
    }
    if (!pages) {
      await writeFile(join(RECEIPT_ROOT, `${runId}.json`), `${JSON.stringify({ schema: "xiaoshimei.image-generation-run.v1", run_id: runId, created_at: new Date().toISOString(), status: "PAGE_PLAN_REJECTED_AFTER_BOUNDED_REVISION_NO_IMAGE_CALL", draft_id: draft.draft_id, page_count: pageCount, attempts: planAttempts, rejection_code: String(planError?.message || planError), actual_image_calls: 0, estimated_image_cost_cny: 0, truth_layers: { mechanism_ready: "REVISE_PAGE_PLAN", package_verified: "NOT_RUN", production_applied: "NOT_RUN", runtime_operational: "FAIL_CLOSED", reality_validated: "NOT_RUN" } }, null, 2)}\n`);
      throw planError;
    }
    const illustrationUnits = buildIllustrationUnits(pages);
    const motherSheetJobs = groupIllustrationUnits(illustrationUnits);
    checkpoint = createImageRunCheckpoint({ runId, draftId: draft.draft_id, draftSha256, productionMode: input.production_mode, pageCount: motherSheetJobs.length, pages: motherSheetJobs, finalPageCount: pageCount, finalPages: pages, illustrationUnits, planAttempts, reference });
    await writeImageCheckpoint(runDir, checkpoint);
  }
  if (checkpoint.pending_image) {
    const pendingIndex = checkpoint.pending_image.page - 1;
    try {
      checkpoint = await sliceAndAdmitMotherSheet(checkpoint, runDir, pendingIndex);
    } catch (error) {
      const attempt = { page: pendingIndex + 1, mother_sheet: pendingIndex + 1, attempt: 1, decision: "PIPELINE_ERROR", studio_disposition: "RESUMABLE", image_sha256: checkpoint.pending_image.sha256, qa_failure_code: String(error?.message || error), recovered_from_paid_asset: Boolean(checkpoint.pending_image.recovered_from_paid_asset) };
      checkpoint = recordPendingPipelineFailure(checkpoint, { attempt, code: String(error?.message || error) });
      await writeImageCheckpoint(runDir, checkpoint); await writePartialImageReceipt(checkpoint, "MOTHER_SHEET_PARTIAL_RESULT_PRESERVED");
      throw new ResumableImageGenerationError(String(error?.message || error), resumableDetails(checkpoint));
    }
  }
  for (let index = resumeImageIndex(checkpoint); index < checkpoint.pages.length; index += 1) {
    const motherSheetJob = checkpoint.pages[index];
    try {
      const prompt = buildMotherSheetPrompt(motherSheetJob, { styleLock: draft.style_lock, imageContext: draft.prompt_context });
      const imageResult = await arkPost("/images/generations", buildArkImageRequest({ model: IMAGE_MODEL, prompt, referenceImageDataUrl: referenceDataUrl, actionReferenceImageDataUrls: actionReferenceDataUrls, actionReferenceNote: input.reference_note }), `MOTHER_SHEET_${index + 1}_CALL_FAILED`);
      checkpoint = recordImageCall(checkpoint);
      await writeImageCheckpoint(runDir, checkpoint);
      const decoded = decodeArkImage(imageResult.value); const bytes = await imageBytes(decoded);
      if (bytes.length < 1024) throw new Error("ARK_IMAGE_TOO_SMALL");
      const imageInfo = inspectImageBytes(bytes);
      if (!isThreeByFourImage(imageInfo)) throw new Error(`MOTHER_SHEET_ASPECT_RATIO_INVALID:${imageInfo.width}x${imageInfo.height}`);
      const fileName = `mother-sheet-${String(index + 1).padStart(2, "0")}.${imageInfo.extension}`;
      await writeFile(join(runDir, fileName), bytes);
      const pending = { page: index + 1, file: fileName, src: `/generated/ark/${runId}/${fileName}`, sha256: sha256Bytes(bytes), size_bytes: bytes.length, width: imageInfo.width, height: imageInfo.height, image_latency_ms: imageResult.latencyMs, tiles: [] };
      checkpoint = recordPendingImage(checkpoint, pending);
      await writeImageCheckpoint(runDir, checkpoint);
      checkpoint = await sliceAndAdmitMotherSheet(checkpoint, runDir, index);
    } catch (error) {
      if (error instanceof ResumableImageGenerationError) throw error;
      if (checkpoint.pending_image) {
        const attempt = { page: index + 1, mother_sheet: index + 1, attempt: 1, decision: "PIPELINE_ERROR", studio_disposition: "RESUMABLE", image_sha256: checkpoint.pending_image.sha256, qa_failure_code: String(error?.message || error) };
        checkpoint = recordPendingPipelineFailure(checkpoint, { attempt, code: String(error?.message || error) });
      } else {
        checkpoint = recordResumableFailure(checkpoint, { failedPage: index + 1, code: String(error?.message || error) });
      }
      await writeImageCheckpoint(runDir, checkpoint); await writePartialImageReceipt(checkpoint, "MOTHER_SHEET_PARTIAL_RESULT_PRESERVED");
      throw new ResumableImageGenerationError(String(error?.message || error), resumableDetails(checkpoint));
    }
  }
  const assetMap = buildAssetMapFromMotherSheets(checkpoint.final_pages, checkpoint.illustration_units, checkpoint.images);
  const content = assembleArkContentFromDraft(draft, checkpoint.final_pages, assetMap, { textModel: TEXT_MODEL, imageModel: IMAGE_MODEL, motherSheetCount: checkpoint.page_count, illustrationUnitCount: checkpoint.illustration_units.length, enforcePublishQuality: true }, input.production_mode);
  const qaWarningCount = checkpoint.illustration_units.length;
  if (qaWarningCount) content.generation.notice = `${content.generation.notice}；${qaWarningCount}个切片尚待人工确认人物、动作、手部和串格情况`;
  const completedAt = new Date().toISOString();
  const receipt = { schema: "xiaoshimei.image-generation-run.v1", run_id: runId, created_at: completedAt, status: "MOTHER_SHEETS_SLICED_AND_ASSEMBLED_FOR_STUDIO_EDITING", provider: PROVIDER_ID, models: { text: TEXT_MODEL, image: IMAGE_MODEL }, production_mode: input.production_mode, draft: { draft_id: draft.draft_id, draft_sha256: draftSha256, user_confirmed_copy_sha256: sha256Bytes(Buffer.from(JSON.stringify({ selected_title: draft.selected_title, body: draft.body, tags: draft.tags }))) }, page_count: pageCount, illustration_unit_count: checkpoint.illustration_units.length, mother_sheet_count: checkpoint.page_count, page_plan_sha256: sha256Bytes(Buffer.from(JSON.stringify(checkpoint.final_pages))), page_plan_attempts: checkpoint.plan_attempts, content_strategy: { content_type: draft.content_type, page_roles: checkpoint.final_pages.map((page) => page.pageRole), style_lock_sha256: draft.style_lock ? sha256Bytes(Buffer.from(JSON.stringify(draft.style_lock))) : null }, reference, mother_sheets: checkpoint.images, illustration_assets: checkpoint.images.flatMap((image) => image.tiles || []), image_attempts: checkpoint.image_attempts, actual_image_calls: checkpoint.actual_image_calls, estimated_image_cost_cny: Number((checkpoint.actual_image_calls * IMAGE_PRICE_CNY).toFixed(2)), resumed: Boolean(input.resume_run_id), qa_warning_count: qaWarningCount, truth_layers: { mechanism_ready: "PASS_LOCAL", package_verified: "PENDING_STUDIO_ROUNDTRIP", production_applied: "NOT_RUN", runtime_operational: "LOCAL_GENERATION_COMPLETE", reality_validated: "NOT_RUN" } };
  await writeFile(join(RECEIPT_ROOT, `${runId}.json`), `${JSON.stringify(receipt, null, 2)}\n`);
  runtimeState.status = "LIVE_VERIFIED"; runtimeState.last_success_at = completedAt;
  return content;
}

async function generatePageCandidates(input) {
  if (!configured()) throw new Error("ARK_PROVIDER_NOT_CONFIGURED");
  runtimeState.status = "PROBE_RUNNING"; runtimeState.last_error = null;
  const runId = `candidate-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const runDir = join(GENERATED_ROOT, "page-candidates", runId);
  await mkdir(runDir, { recursive: true }); await mkdir(RECEIPT_ROOT, { recursive: true });
  const referenceBytes = await readFile(REFERENCE_PATH);
  const referenceDataUrl = `data:image/png;base64,${referenceBytes.toString("base64")}`;
  const candidates = [];
  const promptHashes = [];
  for (let index = 0; index < 3; index += 1) {
    const scenePrompt = buildArkPageCandidatePrompt(input, index);
    promptHashes.push(sha256Bytes(Buffer.from(scenePrompt)));
    const imageResult = await arkPost("/images/generations", buildArkImageRequest({ model: IMAGE_MODEL, prompt: scenePrompt, referenceImageDataUrl: referenceDataUrl }), "PAGE_CANDIDATE_IMAGE_CALL_FAILED");
    const decoded = decodeArkImage(imageResult.value); const bytes = await imageBytes(decoded);
    if (bytes.length < 1024) throw new Error("ARK_IMAGE_TOO_SMALL");
    const imageInfo = inspectImageBytes(bytes);
    if (!isThreeByFourImage(imageInfo)) throw new Error(`ARK_IMAGE_ASPECT_RATIO_INVALID:${imageInfo.width}x${imageInfo.height}`);
    const fileName = `${String(index + 1).padStart(2, "0")}.${imageInfo.extension}`;
    await writeFile(join(runDir, fileName), bytes);
    candidates.push({ src: `/generated/ark/page-candidates/${runId}/${fileName}`, sha256: sha256Bytes(bytes), size_bytes: bytes.length, width: imageInfo.width, height: imageInfo.height });
  }
  const completedAt = new Date().toISOString();
  const receipt = {
    schema: "xiaoshimei.page-candidate-run.v1", run_id: runId, created_at: completedAt, status: "THREE_CANDIDATES_READY_FOR_HUMAN_SELECTION",
    provider: PROVIDER_ID, model: IMAGE_MODEL, page_index: input.page_index,
    input: {
      source_sha256: sha256Bytes(Buffer.from(input.source_input)), title_sha256: sha256Bytes(Buffer.from(input.title)), body_sha256: sha256Bytes(Buffer.from(input.body)),
      content_type: input.content_type, page_role: input.page_role, visual_action_sha256: input.visual_action ? sha256Bytes(Buffer.from(input.visual_action)) : null,
      image_prompt_sha256: input.image_prompt ? sha256Bytes(Buffer.from(input.image_prompt)) : null, prompt_context_sha256: sha256Bytes(Buffer.from(JSON.stringify(input.prompt_context || {}))),
    },
    semantic_prompt_sha256: promptHashes,
    reference: { path: basename(REFERENCE_PATH), sha256: sha256Bytes(referenceBytes), size_bytes: referenceBytes.length },
    candidates, estimated_image_cost_cny: candidates.length * Number(process.env.ARK_IMAGE_PRICE_CNY || IMAGE_PRICE_CNY),
    truth_layers: { mechanism_ready: "PASS_LOCAL", package_verified: "CANDIDATES_REQUIRE_HUMAN_SELECTION", production_applied: "NOT_RUN", runtime_operational: "LOCAL_CANDIDATE_GENERATION_COMPLETE", reality_validated: "NOT_RUN" },
  };
  await writeFile(join(RECEIPT_ROOT, `${runId}.json`), `${JSON.stringify(receipt, null, 2)}
`);
  runtimeState.status = "LIVE_VERIFIED"; runtimeState.last_success_at = completedAt;
  return { schema: PAGE_CANDIDATE_RESPONSE_SCHEMA, run_id: runId, candidates };
}

const server = createServer(async (request, response) => {
  try {
    if (request.method === "OPTIONS") { response.writeHead(204, responseHeaders()); response.end(); return; }
    if (request.method === "GET" && request.url === "/health") { send(response, 200, { status: runtimeState.status, ...publicProviderConfig(), last_error: runtimeState.last_error, last_success_at: runtimeState.last_success_at }); return; }
    if (request.method === "GET" && request.url === "/config") { send(response, 200, publicProviderConfig()); return; }
    if (request.headers.origin && !WEB_ORIGINS.has(request.headers.origin)) { send(response, 403, { error: "ORIGIN_REJECTED" }); return; }
    if (request.method === "POST" && request.url === "/config") { send(response, 200, await updateProviderConfig(await readJson(request))); return; }
    if (request.method !== "POST" || !new Set(["/generate", "/text-draft", "/generate-images", "/page-candidates", "/image-probe"]).has(request.url)) { send(response, 404, { error: "NOT_FOUND" }); return; }
    const body = await readJson(request);
    console.log(`[ark-provider] ${request.url} START`);
    let result;
    if (request.url === "/generate") result = await generate(parseGenerationRequest(body));
    else if (request.url === "/text-draft") result = await generateTextDraft(parseTextDraftRequest(body));
    else if (request.url === "/generate-images") result = await generateImages(parseImageGenerationRequest(body));
    else if (request.url === "/image-probe") result = await generateImageProbe(body);
    else result = await generatePageCandidates(parsePageCandidateRequest(body));
    console.log(`[ark-provider] ${request.url} COMPLETE`);
    send(response, 200, result);
  } catch (error) {
    const code = String(error?.message || error);
    runtimeState.status = configured() ? "FAIL_CLOSED" : "NOT_CONFIGURED"; runtimeState.last_error = code;
    let failureId = null;
    try { failureId = await writeRouteFailureReceipt(request.url || "UNKNOWN", code, error?.details || null); }
    catch (receiptError) { console.error(`[ark-provider] ${new Date().toISOString()} FAILURE_RECEIPT_WRITE_FAILED ${String(receiptError?.message || receiptError)}`); }
    console.error(`[ark-provider] ${new Date().toISOString()} ${request.url || "UNKNOWN"} ${code}`);
    send(response, code === "ARK_PROVIDER_NOT_CONFIGURED" ? 503 : 422, { error: "ARK_PROBE_FAILED", code, stage: request.url === "/generate-images" || request.url === "/page-candidates" ? "image" : "text", failure_id: failureId, details: error?.details || null });
  }
});

server.listen(PORT, HOST, () => console.log(`[ark-provider] http://${HOST}:${PORT} ${configured() ? "READY_FOR_PROBE" : "NOT_CONFIGURED"}`));
