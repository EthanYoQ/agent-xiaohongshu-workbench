import assert from "node:assert/strict";
import test from "node:test";
import { generateContentPackage, importLocalEditableDraft, inspectImportContract } from "../src/content-engine.mjs";
import { createLocalHttpProvider } from "../src/provider-client.mjs";
import { buildGenerationRequest, buildImageGenerationRequest, buildPageCandidateRequest, buildTextDraftRequest, parseGenerationRequest, parseImageGenerationRequest, parsePageCandidateRequest, parsePageCandidateResponse, parseTextDraftRequest, parseTextDraftResponse } from "../src/provider-contract.mjs";
import { createProfileV2 } from "../src/profile-v2.mjs";
import { buildWorkspaceBackup, parseWorkspaceBackup, persistWorkspaceState, prepareFreshDraftWorkspace } from "../src/workspace-state.mjs";

test("a normal 1–8 page local draft can resume without importing authority", () => {
  const draft = generateContentPackage({ topic: "安全续编" });
  draft.pages = draft.pages.slice(0, 6);
  draft.stage = "FULL_DRAFT";
  draft.visible_pages = 6;
  draft.review = { source: "INDEPENDENT_EVIDENCE", decision: "KEEP", reviewed_at: "2026-08-14T00:00:00Z", authority_effect: "EVIDENCE_ONLY" };
  draft.origin = {
    contract: "PRODUCER_TWO_PAGE",
    source_probe_fingerprint_sha256: "a".repeat(64),
    producer_artifact_sha256: "b".repeat(64),
    authority_scope: "SINGLE_EXPANSION_CONSUMED",
  };
  assert.equal(inspectImportContract(draft).contract, "LOCAL_EDITABLE_DRAFT");
  const resumed = importLocalEditableDraft(JSON.stringify(draft));
  assert.equal(resumed.stage, "LOCAL_DRAFT");
  assert.equal(resumed.scale_permission, "UNVERIFIED");
  assert.equal(resumed.review.source, "NONE");
  assert.equal(resumed.review.decision, "IMPORTED_LOCAL_DRAFT_REQUIRES_REVIEW");
  assert.equal(resumed.origin.authority_scope, "SINGLE_EXPANSION_CONSUMED");
});

test("workspace backup restores profile, current draft and library without live authority", () => {
  const currentContent = generateContentPackage({ topic: "当前稿" });
  const libraryDraft = { ...generateContentPackage({ topic: "资产库稿" }), id: "draft-1", saved_at: "2026-08-14T00:00:00Z" };
  const backup = buildWorkspaceBackup({ profile: createProfileV2(), currentContent, library: [libraryDraft], createdAt: "2026-08-14T01:00:00Z" });
  const restored = parseWorkspaceBackup(JSON.stringify(backup));
  assert.equal(restored.profile.schema, "xiaoshimei.profile.v2");
  assert.equal(restored.currentContent.source_input, "当前稿");
  assert.equal(restored.library[0].id, "draft-1");
  assert.equal(restored.currentContent.review.decision, "IMPORTED_LOCAL_DRAFT_REQUIRES_REVIEW");
});

test("workspace restore rejects forged authority and malformed content atomically", () => {
  const backup = buildWorkspaceBackup({ profile: createProfileV2(), currentContent: generateContentPackage({ topic: "原稿" }), library: [] });
  backup.authority_effect = "PRODUCTION_ALLOWED";
  assert.throws(() => parseWorkspaceBackup(JSON.stringify(backup)), /cannot carry authority/);
  backup.authority_effect = "LOCAL_EDITING_ONLY";
  backup.current_content.tags = ["少一个"];
  assert.throws(() => parseWorkspaceBackup(JSON.stringify(backup)), /LOCAL_DRAFT_INVALID|local editable draft contract|tags must contain 5 items/);
});

test("workspace storage rolls back earlier writes when a later write fails", () => {
  const values = new Map([["content", "old-content"], ["library", "old-library"], ["profile", "old-profile"]]);
  let failed = false;
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      if (key === "library" && !failed) { failed = true; throw new Error("quota exceeded"); }
      values.set(key, value);
    },
    removeItem: (key) => values.delete(key),
  };
  const result = persistWorkspaceState(storage, { currentContent: { a: 1 }, library: [], profile: { b: 2 } }, { content: "content", library: "library", profile: "profile" });
  assert.equal(result.ok, false);
  assert.equal(result.code, "STORAGE_WRITE_FAILED");
  assert.equal(values.get("content"), "old-content");
  assert.equal(values.get("library"), "old-library");
  assert.equal(values.get("profile"), "old-profile");
});

test("new creation starts blank while preserving the previous draft in the asset library", () => {
  const currentContent = generateContentPackage({ topic: "不能被新创作吞掉的旧稿", pillar: "growth" });
  const profile = createProfileV2();
  const result = prepareFreshDraftWorkspace({
    currentContent,
    library: [],
    profile,
    draftId: "preserved-draft",
    savedAt: "2026-08-28T12:00:00Z",
  });
  assert.equal(result.currentContent.source_input, "");
  assert.equal(result.currentContent.pillar, "wellness");
  assert.equal(result.library.length, 1);
  assert.equal(result.library[0].id, "preserved-draft");
  assert.equal(result.library[0].source_input, "不能被新创作吞掉的旧稿");
  assert.equal(result.preservedPrevious, true);
});

test("restarting an untouched blank draft does not create asset-library litter", () => {
  const result = prepareFreshDraftWorkspace({
    currentContent: generateContentPackage({ topic: "" }),
    library: [],
    profile: createProfileV2(),
    draftId: "unused",
    savedAt: "2026-08-28T12:00:00Z",
  });
  assert.equal(result.currentContent.source_input, "");
  assert.equal(result.library.length, 0);
  assert.equal(result.preservedPrevious, false);
});

test("local HTTP provider sends a typed request and cannot exfiltrate to remote hosts", async () => {
  let request;
  const expected = generateContentPackage({ topic: "Provider 返回" });
  const provider = createLocalHttpProvider({
    endpoint: "http://127.0.0.1:9909/generate",
    fetchImpl: async (url, options) => { request = { url: String(url), options }; return { ok: true, json: async () => expected }; },
  });
  const received = await provider.generate({ topic: "请求", profile_contract: { schema: "test" } });
  assert.equal(received.selectedTitle, expected.selectedTitle);
  assert.equal(JSON.parse(request.options.body).schema, "xiaoshimei.generation-request.v1");
  assert.throws(() => createLocalHttpProvider({ endpoint: "https://example.com/generate" }), /loopback/);
});

test("local HTTP provider exposes a bounded health check for visible UI status", async () => {
  let request;
  const provider = createLocalHttpProvider({
    endpoint: "http://127.0.0.1:9909/generate",
    fetchImpl: async (url, options) => {
      request = { url: String(url), options };
      return { ok: true, status: 200, json: async () => ({ status: "LIVE_VERIFIED", configured: true }) };
    },
  });
  const health = await provider.checkHealth();
  assert.equal(request.url, "http://127.0.0.1:9909/health");
  assert.equal(request.options.method, "GET");
  assert.equal(health.status, "LIVE_VERIFIED");
});

test("page candidate requests stay typed, loopback-only and require exactly three evidenced images", async () => {
  let target;
  const provider = createLocalHttpProvider({
    endpoint: "http://127.0.0.1:9909/generate",
    fetchImpl: async (url, options) => {
      target = { url: String(url), body: JSON.parse(options.body) };
      return { ok: true, json: async () => ({ schema: "xiaoshimei.page-candidate-response.v1", run_id: "candidate-run", candidates: [1,2,3].map((index) => ({ src: `/generated/ark/page-candidates/candidate-run/0${index}.jpg`, sha256: String(index).repeat(64), size_bytes: 2048, width: 1728, height: 2304 })) }) };
    },
  });
  const input = { page_index: 1, source_input: "书院筹备", title: "三条路径", body: "青少年武术教育、成人禅修养生、文旅体验", layout: "split", content_type: "knowledge_card", page_role: "comparison", visual_action: "小师妹在三组器物之间做比较", image_prompt: "三组器物同框", prompt_context: {} };
  const result = await provider.generatePageCandidates(input);
  assert.equal(target.url, "http://127.0.0.1:9909/page-candidates");
  const parsed = parsePageCandidateRequest(buildPageCandidateRequest(input));
  assert.equal(parsed.source_input, input.source_input);
  assert.equal(parsed.content_type, "knowledge_card");
  assert.equal(parsed.page_role, "comparison");
  assert.equal(parsed.visual_action, input.visual_action);
  assert.equal(parsed.image_prompt, input.image_prompt);
  assert.equal(result.candidates.length, 3);
  assert.throws(() => parsePageCandidateResponse({ schema: "xiaoshimei.page-candidate-response.v1", candidates: [] }), /COUNT_INVALID/);
});

test("browser and Provider share one strict generation request envelope", () => {
  const input = { topic: "两页真实探针", pillar: "academy", goal: "save", profile_contract: { schema: "xiaoshimei.generation-profile-contract.v2" } };
  const envelope = buildGenerationRequest(input);
  assert.equal(envelope.schema, "xiaoshimei.generation-request.v1");
  assert.deepEqual(parseGenerationRequest(envelope), input);
  assert.throws(() => parseGenerationRequest(input), /SCHEMA_UNSUPPORTED/);
  assert.throws(() => parseGenerationRequest({ schema: envelope.schema, input: null }), /INPUT_INVALID/);
});

test("local Provider preserves a safe upstream failure code for the GUI", async () => {
  const provider = createLocalHttpProvider({
    endpoint: "http://127.0.0.1:9909/generate",
    fetchImpl: async () => ({ ok: false, status: 422, json: async () => ({
      error: "ARK_PROBE_FAILED",
      code: "IMAGE_3_QA_REJECTED:HAND_INVALID",
      details: {
        resume_run_id: "images-2026-08-15T00-00-00-000Z-1234abcd",
        completed_pages: 2,
        total_pages: 4,
        failed_page: 3,
        actual_image_calls: 3,
        estimated_image_cost_cny: 0.66,
      },
    }) }),
  });
  await assert.rejects(
    () => provider.generate({ topic: "不会重试" }),
    (error) => error.message.includes("IMAGE_3_QA_REJECTED") && error.providerDetails?.completed_pages === 2 && error.providerDetails?.actual_image_calls === 3,
  );
});

test("two-node provider client keeps text and image requests on separate endpoints", async () => {
  const seen = [];
  const body = "这是一段经过用户确认的完整发布正文。".repeat(24);
  const draft = { schema: "xiaoshimei.text-draft-response.v1", draft_id: "draft-1", created_at: new Date(0).toISOString(), source_input: "眼睛休息方法", text_requirements: "语气生活化", pillar: "wellness", goal: "save", titles: ["刷完手机先让眼睛休息一会儿", "眼睛发紧时我会先做这几步", "给一直盯屏幕的眼睛一个暂停"], selected_title: "眼睛发紧时我会先做这几步", body, tags: ["眼部放松", "生活方式", "屏幕休息", "日常养生", "轻缓练习"], recommended_image_count: 4, facts: [], risks: [], generation: {} };
  const provider = createLocalHttpProvider({ endpoint: "http://127.0.0.1:9909/generate", fetchImpl: async (url, options) => { seen.push({ url: String(url), body: JSON.parse(options.body) }); return { ok: true, json: async () => String(url).endsWith("/text-draft") ? draft : generateContentPackage({ topic: "完成" }) }; } });
  const text = await provider.generateTextDraft({ topic: "眼睛休息方法", text_requirements: "语气生活化", pillar: "wellness", goal: "save", profile_contract: { schema: "xiaoshimei.generation-profile-contract.v2" } });
  await provider.generateImages({ draft: text, image_count: "AUTO" });
  assert.equal(seen[0].url, "http://127.0.0.1:9909/text-draft");
  assert.equal(seen[1].url, "http://127.0.0.1:9909/generate-images");
  assert.equal(parseTextDraftRequest(buildTextDraftRequest({ topic: "眼睛休息方法", text_requirements: "语气生活化", pillar: "wellness", goal: "save", profile_contract: {} })).text_requirements, "语气生活化");
  assert.deepEqual(parseImageGenerationRequest(buildImageGenerationRequest({ draft, image_count: "AUTO" })), { draft: parseTextDraftResponse(draft), production_mode: "smart", image_count: "AUTO", resume_run_id: null, reference_images: [], reference_note: "" });
  assert.equal(parseImageGenerationRequest(buildImageGenerationRequest({ draft, production_mode: "infographic", image_count: 4 })).production_mode, "infographic");
  assert.throws(() => buildImageGenerationRequest({ draft, production_mode: "pretty", image_count: 4 }), /IMAGE_GENERATION_PRODUCTION_MODE_INVALID/);
  assert.equal(parseImageGenerationRequest(buildImageGenerationRequest({ draft, image_count: 4, resume_run_id: "images-2026-08-15T00-00-00-000Z-1234abcd" })).resume_run_id, "images-2026-08-15T00-00-00-000Z-1234abcd");
  assert.equal(parseImageGenerationRequest(buildImageGenerationRequest({ draft, image_count: 1, reference_images: [{ name: "拳架", data_url: "data:image/png;base64,AAAA" }], reference_note: "参考手脚关系" })).reference_images[0].name, "拳架");
  assert.throws(() => parseImageGenerationRequest(buildImageGenerationRequest({ draft, image_count: 1, reference_images: [1, 2, 3, 4].map((index) => ({ name: `参考${index}`, data_url: "data:image/png;base64,AAAA" })) })), /IMAGE_GENERATION_REFERENCES_INVALID/);
});
