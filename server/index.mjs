import { exec } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import express from "express";
import { createServer as createViteServer } from "vite";
import { AgentRunner, assertReaderFacingContent } from "./agent-runner.mjs";
import { saveUploadedAvatar } from "./brand-character.mjs";
import { createBrandCharacter, createBrandVisualIdentity, createDefaultState } from "./default-state.mjs";
import { CARD_RENDERER_VERSION } from "./render-cards.mjs";
import { applyDraftEdit, editTopic, emptyCopyVersions, emptyStoryline, resetProductionAfterBrandChange, resetProductionAfterTopic, selectTopic, setGenerationImageCount, storylineContext } from "./workspace-editor.mjs";
import { isVerifiedViralSignal } from "./viral-filter.mjs";

const execAsync = promisify(exec);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDir = path.join(root, ".data");
const statePath = path.join(dataDir, "workspace.json");
const generatedDir = path.join(root, "public", "generated");
const isProduction = process.argv.includes("--production");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "127.0.0.1";

async function recoverLatestRawDraft(selectedTopicId) {
  if (!selectedTopicId) return null;
  const jobsDir = path.join(dataDir, "jobs");
  try {
    const files = (await fs.readdir(jobsDir))
      .filter((name) => name.endsWith(".json") && !name.endsWith(".result.json"))
      .sort((a, b) => b.localeCompare(a));
    for (const name of files) {
      try {
        const job = JSON.parse(await fs.readFile(path.join(jobsDir, name), "utf8"));
        if (job.type === "draft" && job.status === "completed" && job.payload?.topic?.id === selectedTopicId && job.result) {
          return { ...job.result, characterAssets: [], mode: "raw", generatedAt: job.updatedAt || job.createdAt };
        }
      } catch { /* Ignore incomplete historical job files. */ }
    }
  } catch { /* No historical jobs yet. */ }
  return null;
}

const stateStore = {
  async read() {
    try {
      const state = JSON.parse(await fs.readFile(statePath, "utf8"));
      let migrated = false;
      state.breakdown ??= null;
      state.selectedVisualDirectionId ??= null;
      if (!("copyVersions" in state)) {
        const raw = state.draft?.mode === "raw" ? state.draft : await recoverLatestRawDraft(state.selectedTopicId);
        const humanized = state.draft?.mode === "humanized" ? state.draft : null;
        state.copyVersions = { raw: raw || null, humanized: humanized || null };
        migrated = true;
      }
      if (!("raw" in state.copyVersions)) { state.copyVersions.raw = null; migrated = true; }
      if (!("humanized" in state.copyVersions)) { state.copyVersions.humanized = null; migrated = true; }
      if (!("storyline" in state)) { state.storyline = emptyStoryline(); migrated = true; }
      if (!("storylineSync" in state)) { state.storylineSync = { status: "not_started", imported: 0, updatedAt: null, message: "尚未同步创作后台" }; migrated = true; }
      if (!("humanization" in state)) { state.humanization = null; migrated = true; }
      if (!("review" in state)) {
        state.review = state.assets?.length > 0
          ? { status: "pending", feedback: "", scope: null, round: 1, updatedAt: new Date().toISOString() }
          : null;
        if (state.assets?.length > 0) state.publish = { status: "awaiting_review", noteId: null, url: null, message: "请完整预览文稿和配图后确认" };
        migrated = true;
      }
      if ("brandSystem" in state) { delete state.brandSystem; migrated = true; }
      if ("brandLocked" in state) { delete state.brandLocked; migrated = true; }
      if (!state.brandCharacter) {
        state.brandCharacter = createBrandCharacter();
        migrated = true;
      }
      if (!Array.isArray(state.brandCharacter.series)) { state.brandCharacter.series = []; migrated = true; }
      if (!state.brandCharacter.source) { state.brandCharacter.source = state.brandCharacter.avatar ? "legacy-local-reference" : "awaiting-user-upload"; migrated = true; }
      if (!state.brandVisualIdentity) {
        state.brandVisualIdentity = createBrandVisualIdentity();
        migrated = true;
      } else if (state.brandVisualIdentity.version !== "agent-xhs-brand-v2") {
        state.brandVisualIdentity = { ...createBrandVisualIdentity(), ...state.brandVisualIdentity, version: "agent-xhs-brand-v2" };
        migrated = true;
      }
      if (!state.generationSettings) { state.generationSettings = { imageCount: 4 }; migrated = true; }
      if (!Number.isInteger(state.generationSettings.imageCount) || state.generationSettings.imageCount < 1 || state.generationSettings.imageCount > 6) {
        state.generationSettings.imageCount = 4;
        migrated = true;
      }
      if (state.breakdown && !state.breakdown.sourceSkillSet?.includes("lingzao")) {
        state.breakdown = null;
        state.selectedVisualDirectionId = null;
        state.draft = null;
        state.copyVersions = emptyCopyVersions();
        state.humanization = null;
        state.assets = [];
        state.review = null;
        migrated = true;
      }
      if (state.research.signals.some((signal) => !signal.engagement || !("publishedAt" in signal))) migrated = true;
      state.research.signals = state.research.signals.map((signal) => ({ mediaKind: "unknown", imageCount: 0, publishedAt: null, engagement: { likes: 0, collects: 0, comments: 0, verified: false, observedAt: null, source: "legacy" }, ...signal }));
      if (state.research.signals.some((signal) => !isVerifiedViralSignal(signal))) {
        state.research = {
          mode: "not_started",
          updatedAt: null,
          summary: "旧热点证据未经过爆款互动门槛，已安全清空。请重新扫描图文爆款。",
          signals: [],
          topics: [],
        };
        state.selectedTopicId = null;
        resetProductionAfterTopic(state, "旧热点证据已失效，请重新扫描图文爆款");
        migrated = true;
      }
      if (migrated) await this.write(state);
      return state;
    } catch {
      const initial = createDefaultState();
      await this.write(initial);
      return initial;
    }
  },
  async write(value) {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(statePath, JSON.stringify(value, null, 2), "utf8");
  },
};

const runner = new AgentRunner({ root, stateStore });
await runner.initialize();
await stateStore.read();
await runner.ensureCurrentRenderer();

async function toolProbe(command) {
  try {
    const localBin = path.join(root, "node_modules", ".bin");
    const runtimePath = [localBin, process.env.PATH].filter(Boolean).join(path.delimiter);
    const { stdout, stderr } = await execAsync(command, { cwd: root, timeout: 8000, windowsHide: true, env: { ...process.env, PATH: runtimePath } });
    return { installed: true, detail: (stdout || stderr).trim().slice(0, 1200) };
  } catch (error) {
    return { installed: false, detail: String(error.message || error).slice(0, 1200) };
  }
}

const app = express();
app.use(express.json({ limit: "200kb" }));
app.use("/generated", express.static(generatedDir, { fallthrough: false }));
app.use("/brand", express.static(path.join(root, "public", "brand"), { fallthrough: false }));

app.get("/api/workspace", async (_request, response) => {
  response.json(await stateStore.read());
});

app.put("/api/workspace", async (request, response) => {
  const positioning = String(request.body?.positioning || "").trim().slice(0, 500);
  if (!positioning) return response.status(400).json({ error: "账号定位不能为空" });
  const state = await stateStore.read();
  state.positioning = positioning;
  await stateStore.write(state);
  response.json(state);
});

app.put("/api/generation-settings", async (request, response) => {
  if (runner.activeJobId) return response.status(409).json({ error: "Agent 任务执行中，暂时不能修改配图数量" });
  try {
    const state = await stateStore.read();
    setGenerationImageCount(state, request.body?.imageCount);
    await stateStore.write(state);
    response.json(state);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.post("/api/brand-character/upload", express.raw({ type: () => true, limit: "10mb" }), async (request, response) => {
  if (runner.activeJobId) return response.status(409).json({ error: "Agent 任务执行中，暂时不能更换品牌角色" });
  try {
    const avatar = await saveUploadedAvatar({ root, buffer: request.body, contentType: request.headers["content-type"] });
    const state = await stateStore.read();
    resetProductionAfterBrandChange(state, "品牌角色母版已更换，等待生成并锁定系列形象");
    state.brandCharacter = {
      ...createBrandCharacter(),
      status: "uploaded",
      brief: "用户本地上传的品牌角色母版",
      source: "user-upload",
      avatar,
      uploadedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    state.brandVisualIdentity = createBrandVisualIdentity();
    await stateStore.write(state);
    response.status(201).json(state);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.get("/api/status", async (_request, response) => {
  const [codex, opencli] = await Promise.all([
    toolProbe("codex --version"),
    toolProbe("opencli --version"),
  ]);
  response.json({ codex, opencli, activeJobId: runner.activeJobId });
});

app.get("/api/jobs/:id", async (request, response) => {
  const job = await runner.getJob(request.params.id);
  if (!job) return response.status(404).json({ error: "任务不存在" });
  response.json(job);
});

app.post("/api/jobs/research", async (request, response) => {
  try {
    const positioning = String(request.body?.positioning || "").trim().slice(0, 500);
    if (!positioning) return response.status(400).json({ error: "请先填写账号定位" });
    const state = await stateStore.read();
    response.status(202).json(await runner.createJob("research", { positioning, storylineContext: storylineContext(state.storyline?.entries || []) }));
  } catch (error) {
    response.status(409).json({ error: error.message });
  }
});

app.post("/api/jobs/storyline-sync", async (_request, response) => {
  try {
    const state = await stateStore.read();
    response.status(202).json(await runner.createJob("storyline_sync", { positioning: state.positioning }));
  } catch (error) {
    response.status(409).json({ error: error.message });
  }
});

app.put("/api/topics/:id/select", async (request, response) => {
  if (runner.activeJobId) return response.status(409).json({ error: "Agent 任务执行中，暂时不能切换选题" });
  try {
    const state = await stateStore.read();
    selectTopic(state, request.params.id);
    await stateStore.write(state);
    response.json(state);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.put("/api/topics/:id", async (request, response) => {
  if (runner.activeJobId) return response.status(409).json({ error: "Agent 任务执行中，暂时不能编辑选题" });
  try {
    const state = await stateStore.read();
    editTopic(state, request.params.id, request.body || {});
    await stateStore.write(state);
    response.json(state);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.put("/api/drafts/:version", async (request, response) => {
  if (runner.activeJobId) return response.status(409).json({ error: "Agent 任务执行中，暂时不能编辑文稿" });
  const version = String(request.params.version || "");
  if (!["raw", "humanized"].includes(version)) return response.status(400).json({ error: "文稿版本无效" });
  try {
    const state = await stateStore.read();
    const edited = applyDraftEdit(state, version, request.body || {});
    const visualDirection = state.breakdown?.visualDirections?.find((item) => item.id === state.selectedVisualDirectionId);
    assertReaderFacingContent(edited, visualDirection, version === "raw" ? "手动编辑原始文稿" : "手动编辑去 AI 味文稿");
    await stateStore.write(state);
    response.json(state);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.post("/api/jobs/avatar", async (request, response) => {
  try {
    const mode = String(request.body?.mode || "uploaded_reference");
    const state = await stateStore.read();
    if (mode === "uploaded_reference") {
      if (!state.brandCharacter?.avatar?.absolutePath) return response.status(400).json({ error: "请先从本地上传头像图片" });
      return response.status(202).json(await runner.createJob("avatar", {
        mode,
        brief: state.brandCharacter.brief || "用户本地上传的品牌角色母版",
        sourcePath: state.brandCharacter.avatar.absolutePath,
      }));
    }
    if (mode !== "generate_from_brief") return response.status(400).json({ error: "品牌角色生成方式无效" });
    const brief = String(request.body?.brief || "").trim().slice(0, 800);
    if (!brief) return response.status(400).json({ error: "请先描述头像中的人物、发型、穿着和绘制风格" });
    response.status(202).json(await runner.createJob("avatar", { mode, brief }));
  } catch (error) {
    response.status(409).json({ error: error.message });
  }
});

app.post("/api/jobs/draft", async (request, response) => {
  try {
    const state = await stateStore.read();
    const topic = state.research.topics.find((item) => item.id === request.body?.topicId);
    const visualDirection = state.breakdown?.visualDirections?.find((item) => item.id === request.body?.visualDirectionId);
    if (!state.brandCharacter?.locked || !state.brandCharacter?.avatar) {
      return response.status(400).json({ error: "请先生成并锁定头像角色" });
    }
    if (!topic || state.breakdown?.topicId !== topic.id || !visualDirection) {
      return response.status(400).json({ error: "请先完成当前选题的热点拆解并确认动态视觉方向" });
    }
    const imageCount = Number(state.generationSettings?.imageCount || 4);
    response.status(202).json(await runner.createJob("draft", { topic, visualDirection, imageCount }));
  } catch (error) {
    response.status(409).json({ error: error.message });
  }
});

app.post("/api/jobs/humanize", async (_request, response) => {
  try {
    const state = await stateStore.read();
    if (!state.draft || state.draft.mode !== "raw") {
      return response.status(400).json({ error: "请先生成原始文稿，再执行去 AI 味" });
    }
    response.status(202).json(await runner.createJob("humanize", {}));
  } catch (error) {
    response.status(409).json({ error: error.message });
  }
});

app.post("/api/jobs/illustrate", async (_request, response) => {
  try {
    const state = await stateStore.read();
    const visualDirection = state.breakdown?.visualDirections?.find((item) => item.id === state.selectedVisualDirectionId);
    if (!state.draft || state.draft.mode !== "humanized") {
      return response.status(400).json({ error: "请先完成中文去 AI 味，再生成配图" });
    }
    if (!visualDirection) return response.status(400).json({ error: "当前视觉方向已失效，请重新确认" });
    const imageCount = Number(state.generationSettings?.imageCount || 4);
    if (state.draft.imageCards?.length !== imageCount) return response.status(400).json({ error: "文稿卡片数量与本轮配图数量不一致，请重新生成文稿" });
    response.status(202).json(await runner.createJob("illustrate", { visualDirection, imageCount }));
  } catch (error) {
    response.status(409).json({ error: error.message });
  }
});

app.post("/api/jobs/revise", async (request, response) => {
  try {
    const state = await stateStore.read();
    const feedback = String(request.body?.feedback || "").trim().slice(0, 1200);
    const scope = String(request.body?.scope || "both");
    if (!feedback) return response.status(400).json({ error: "请填写需要调整的具体内容" });
    if (!["copy", "visual", "both"].includes(scope)) return response.status(400).json({ error: "修改范围无效" });
    if (!state.draft || state.draft.mode !== "humanized" || state.assets.length === 0) {
      return response.status(400).json({ error: "请先生成完整文稿和配图，再提交调整意见" });
    }
    const previousReview = state.review;
    state.review = { status: "changes_requested", feedback, scope, round: Number(state.review?.round || 1), updatedAt: new Date().toISOString() };
    await stateStore.write(state);
    try {
      response.status(202).json(await runner.createJob("revise", { feedback, scope }));
    } catch (error) {
      state.review = previousReview;
      await stateStore.write(state);
      throw error;
    }
  } catch (error) {
    response.status(409).json({ error: error.message });
  }
});

app.post("/api/review/approve", async (request, response) => {
  if (request.body?.confirmation !== "REVIEW_APPROVED") return response.status(400).json({ error: "缺少明确的预览确认" });
  if (runner.activeJobId) return response.status(409).json({ error: "Agent 任务执行中，暂时不能确认预览" });
  const state = await stateStore.read();
  if (!state.draft || state.draft.mode !== "humanized" || state.assets.length === 0) {
    return response.status(400).json({ error: "当前没有可确认的完整文稿和配图" });
  }
  if (state.assets.some((asset) => asset.rendererVersion !== CARD_RENDERER_VERSION)) {
    return response.status(400).json({ error: "配图仍使用旧版渲染规则，请刷新工作台后重新预览" });
  }
  state.review = { ...(state.review || {}), status: "approved", feedback: "", scope: null, approvedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  state.publish = { status: "ready", noteId: null, url: null, message: "文稿和配图已预览确认，可以发布" };
  await stateStore.write(state);
  response.json(state);
});

app.post("/api/jobs/deconstruct", async (request, response) => {
  try {
    const state = await stateStore.read();
    const topic = state.research.topics.find((item) => item.id === request.body?.topicId);
    if (!topic) return response.status(400).json({ error: "请先确认一个选题" });
    if (!state.brandCharacter?.locked || !state.brandCharacter?.avatar) {
      return response.status(400).json({ error: "请先生成并锁定头像角色，再让视觉方向适配该人物" });
    }
    const referencedSignals = topic.evidenceRefs.map((index) => state.research.signals[index]).filter(Boolean);
    if (referencedSignals.length === 0 || referencedSignals.some((signal) => signal.mediaKind !== "graphic" || signal.imageCount < 1 || !isVerifiedViralSignal(signal))) {
      return response.status(400).json({ error: "当前选题缺少已通过媒体与爆款门槛校验的图文热点，请重新扫描" });
    }
    response.status(202).json(await runner.createJob("deconstruct", { topic }));
  } catch (error) {
    response.status(409).json({ error: error.message });
  }
});

app.put("/api/character-lock", async (request, response) => {
  const state = await stateStore.read();
  if (state.brandCharacter?.status !== "ready" || !state.brandCharacter?.avatar || state.brandCharacter.series?.length !== 6) {
    return response.status(400).json({ error: "请先基于上传头像生成完整的 6 个系列品牌形象" });
  }
  state.brandCharacter.locked = Boolean(request.body?.locked);
  state.brandCharacter.lockedAt = state.brandCharacter.locked ? new Date().toISOString() : null;
  if (!state.brandCharacter.locked) {
    resetProductionAfterBrandChange(state, "品牌角色已解除锁定，后续内容需要重新确认");
  }
  await stateStore.write(state);
  response.json(state);
});

app.post("/api/jobs/publish", async (request, response) => {
  try {
    const state = await stateStore.read();
    const mode = String(request.body?.mode || "");
    if (!["publish_now", "save_draft"].includes(mode)) return response.status(400).json({ error: "请选择立即发布或暂缓发布" });
    const expectedConfirmation = mode === "save_draft" ? "SAVE_DRAFT_CONFIRMED" : "PUBLISH_NOW_CONFIRMED";
    if (request.body?.confirmation !== expectedConfirmation) return response.status(400).json({ error: mode === "save_draft" ? "缺少明确的暂存确认" : "缺少明确的立即发布确认" });
    if (!state.draft || state.draft.mode !== "humanized" || state.assets.length === 0 || state.review?.status !== "approved" || state.assets.some((asset) => asset.rendererVersion !== CARD_RENDERER_VERSION)) {
      return response.status(400).json({ error: "请先完成文稿、去 AI 味、配图，并在审稿台确认预览" });
    }
    const topic = state.research?.topics?.find((item) => item.id === state.selectedTopicId) || null;
    const visualDirection = state.breakdown?.visualDirections?.find((item) => item.id === state.selectedVisualDirectionId) || null;
    const storySnapshot = {
      positioning: state.positioning,
      topic: topic ? { id: topic.id, title: topic.title, angle: topic.angle, reason: topic.reason } : null,
      draft: { title: state.draft.title, body: state.draft.body, tags: state.draft.tags || [], imageCount: state.assets.length },
      visualDirection: visualDirection ? { id: visualDirection.id, name: visualDirection.name } : null,
    };
    response.status(202).json(await runner.createJob("publish", { mode, confirmedAt: new Date().toISOString(), storySnapshot }));
  } catch (error) {
    response.status(409).json({ error: error.message });
  }
});

app.use((error, _request, response, next) => {
  if (error?.type === "entity.too.large") return response.status(413).json({ error: "头像图片不能超过 10MB" });
  return next(error);
});

if (isProduction) {
  app.use(express.static(path.join(root, "dist")));
  app.get("*", (_request, response) => response.sendFile(path.join(root, "dist", "index.html")));
} else {
  const vite = await createViteServer({ root, server: { middlewareMode: true }, appType: "spa" });
  app.use(vite.middlewares);
}

app.listen(port, host, () => {
  process.stdout.write(`Agent 小红书工作台运行于 http://${host}:${port}\n`);
});
