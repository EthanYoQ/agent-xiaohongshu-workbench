import { exec } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import express from "express";
import { createServer as createViteServer } from "vite";
import { AgentRunner, assertReaderFacingContent, assertXhsTitle } from "./agent-runner.mjs";
import { addContentAccount, createFreshMultiAccountState, createPendingBrandVisualIdentity, createPublishBinding, getContentAccount, getWorkspace, isMultiAccountState, migrateLegacyWorkspace, safeFolderSegment, setActiveContentAccount, toClientWorkspace, touchContentAccount } from "./account-workspace.mjs";
import { saveUploadedAvatar } from "./brand-character.mjs";
import { createBrandCharacter, createBrandVisualIdentity, createDefaultState } from "./default-state.mjs";
import { updateArchivedOutputStatus } from "./output-archive.mjs";
import { CARD_RENDERER_VERSION } from "./render-cards.mjs";
import { applyDraftEdit, archiveManuallyPublishedStoryline, editTopic, emptyCopyVersions, emptyStoryline, resetProductionAfterBrandChange, resetProductionAfterTopic, selectTopic, setGenerationImageCount, storylineContext } from "./workspace-editor.mjs";
import { isVerifiedViralSignal } from "./viral-filter.mjs";
import { readImageDrafts } from "./xhs-draft-verifier.mjs";

const execAsync = promisify(exec);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoot = process.env.AGENT_XHS_RUNTIME_DIR ? path.resolve(process.env.AGENT_XHS_RUNTIME_DIR) : root;
const dataDir = path.join(runtimeRoot, ".data");
const statePath = path.join(dataDir, "workspace.json");
const generatedDir = path.join(runtimeRoot, "public", "generated");
const brandDir = path.join(runtimeRoot, "public", "brand");
const isProduction = process.argv.includes("--production");
const port = process.env.PORT === undefined ? 4173 : Number(process.env.PORT);
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

async function normalizeContentWorkspace(workspace, { recoverRawDraft = false } = {}) {
  const state = workspace || createDefaultState();
  const defaults = createDefaultState();
  let migrated = false;
  state.research ??= structuredClone(defaults.research);
  state.research.signals = Array.isArray(state.research.signals) ? state.research.signals : [];
  state.research.topics = Array.isArray(state.research.topics) ? state.research.topics : [];
  state.breakdown ??= null;
  state.selectedVisualDirectionId ??= null;
  if (!("copyVersions" in state)) {
    const raw = state.draft?.mode === "raw" ? state.draft : recoverRawDraft ? await recoverLatestRawDraft(state.selectedTopicId) : null;
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
  if (!("generationIssue" in state.brandCharacter)) { state.brandCharacter.generationIssue = null; migrated = true; }
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
  state.publish ??= { status: "not_started", noteId: null, url: null, message: "尚未发布" };
  state.assets = Array.isArray(state.assets) ? state.assets : [];
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
  return { state, migrated };
}

async function normalizeMultiAccountState(value) {
  let state = value;
  let migrated = false;
  if (!isMultiAccountState(state)) {
    const normalized = await normalizeContentWorkspace(state, { recoverRawDraft: true });
    state = migrateLegacyWorkspace(normalized.state);
    migrated = true;
  }
  state.schemaVersion = 1;
  state.researchOperator ??= {
    mode: "shared-current-browser-session",
    status: "connected",
    label: "当前浏览器小红书登录会话",
    message: "仅用于按当前内容账号定位研究图文热点；不会共享热点结果或自动发布。",
    updatedAt: new Date().toISOString(),
  };
  state.contentAccounts = Array.isArray(state.contentAccounts) ? state.contentAccounts : [];
  if (state.contentAccounts.length === 0) {
    state = createFreshMultiAccountState();
    migrated = true;
  }
  for (const [index, account] of state.contentAccounts.entries()) {
    account.id ||= `content-${index + 1}`;
    account.name = String(account.name || `内容账号 ${index + 1}`).trim().slice(0, 40) || `内容账号 ${index + 1}`;
    account.createdAt ||= new Date().toISOString();
    account.updatedAt ||= account.createdAt;
    const normalized = await normalizeContentWorkspace(account.workspace || createDefaultState(), { recoverRawDraft: false });
    account.workspace = normalized.state;
    account.publishBinding = { ...createPublishBinding(), ...(account.publishBinding || {}), enabled: Boolean(account.publishBinding?.enabled) };
    account.output = {
      folderSlug: safeFolderSegment(account.output?.folderSlug || account.name, "content-account"),
      latest: account.output?.latest || null,
      entries: Array.isArray(account.output?.entries) ? account.output.entries : [],
    };
    migrated ||= normalized.migrated;
  }
  if (!getContentAccount(state, state.activeAccountId)) {
    state.activeAccountId = state.contentAccounts[0].id;
    migrated = true;
  }
  return { state, migrated };
}

const stateStore = {
  async read() {
    try {
      const value = JSON.parse(await fs.readFile(statePath, "utf8"));
      const normalized = await normalizeMultiAccountState(value);
      if (normalized.migrated) await this.write(normalized.state);
      return normalized.state;
    } catch {
      const initial = createFreshMultiAccountState();
      await this.write(initial);
      return initial;
    }
  },
  async write(value) {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(statePath, JSON.stringify(value, null, 2), "utf8");
  },
};

const runner = new AgentRunner({ root, runtimeRoot, stateStore });
await runner.initialize();
await stateStore.read();
await runner.ensureCurrentRenderer();

function activeWorkspace(state) {
  return getWorkspace(state);
}

function activeAccount(state) {
  return getContentAccount(state);
}

function responseWorkspace(response, state, status = 200) {
  return response.status(status).json(toClientWorkspace(state));
}

function jobForActiveAccount(state, payload = {}) {
  const account = activeAccount(state);
  return {
    ...payload,
    accountId: account?.id || null,
    accountName: account?.name || "当前内容账号",
  };
}

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
app.use("/brand", express.static(brandDir, { fallthrough: false }));

app.get("/api/workspace", async (_request, response) => {
  responseWorkspace(response, await stateStore.read());
});

app.post("/api/accounts", async (request, response) => {
  if (runner.activeJobId) return response.status(409).json({ error: "Agent 任务执行中，暂时不能新建或切换内容账号" });
  const name = String(request.body?.name || "").trim().slice(0, 40);
  const positioning = String(request.body?.positioning || "").trim().slice(0, 500);
  if (!name) return response.status(400).json({ error: "请为内容账号填写一个名称" });
  const state = await stateStore.read();
  addContentAccount(state, { name, positioning });
  await stateStore.write(state);
  responseWorkspace(response, state, 201);
});

app.put("/api/accounts/active", async (request, response) => {
  if (runner.activeJobId) return response.status(409).json({ error: "Agent 任务执行中，不能切换内容账号，避免结果写入错误账号" });
  try {
    const state = await stateStore.read();
    setActiveContentAccount(state, String(request.body?.accountId || ""));
    await stateStore.write(state);
    responseWorkspace(response, state);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.put("/api/workspace", async (request, response) => {
  const positioning = String(request.body?.positioning || "").trim().slice(0, 500);
  if (!positioning) return response.status(400).json({ error: "账号定位不能为空" });
  const state = await stateStore.read();
  const workspace = activeWorkspace(state);
  workspace.positioning = positioning;
  touchContentAccount(state);
  await stateStore.write(state);
  responseWorkspace(response, state);
});

app.put("/api/generation-settings", async (request, response) => {
  if (runner.activeJobId) return response.status(409).json({ error: "Agent 任务执行中，暂时不能修改配图数量" });
  try {
    const state = await stateStore.read();
    setGenerationImageCount(activeWorkspace(state), request.body?.imageCount);
    touchContentAccount(state);
    await stateStore.write(state);
    responseWorkspace(response, state);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.post("/api/brand-character/upload", express.raw({ type: () => true, limit: "10mb" }), async (request, response) => {
  if (runner.activeJobId) return response.status(409).json({ error: "Agent 任务执行中，暂时不能更换品牌角色" });
  try {
    const avatar = await saveUploadedAvatar({ root: runtimeRoot, buffer: request.body, contentType: request.headers["content-type"] });
    const state = await stateStore.read();
    const workspace = activeWorkspace(state);
    resetProductionAfterBrandChange(workspace, "品牌角色母版已更换，等待生成并锁定系列形象");
    workspace.brandCharacter = {
      ...createBrandCharacter(),
      status: "uploaded",
      brief: "用户本地上传的品牌角色母版",
      source: "user-upload",
      avatar,
      uploadedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    workspace.brandVisualIdentity = createPendingBrandVisualIdentity();
    touchContentAccount(state);
    await stateStore.write(state);
    responseWorkspace(response, state, 201);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.put("/api/publish-binding", async (request, response) => {
  if (runner.activeJobId) return response.status(409).json({ error: "Agent 任务执行中，暂时不能更改发布账号设置" });
  try {
    const enabled = Boolean(request.body?.enabled);
    const state = await stateStore.read();
    const account = activeAccount(state);
    if (!account) throw new Error("当前内容账号不存在");
    if (!enabled) {
      account.publishBinding = createPublishBinding();
      touchContentAccount(state, account.id);
      await stateStore.write(state);
      return responseWorkspace(response, state);
    }
    const label = String(request.body?.label || "").trim().slice(0, 40);
    if (!label) throw new Error("请填写当前浏览器中已登录的发布账号名称");
    if (request.body?.confirmation !== "PUBLISH_RISK_ACKNOWLEDGED") {
      throw new Error("请先确认已了解自动发布可能触发小红书风控");
    }
    account.publishBinding = {
      ...createPublishBinding(),
      enabled: true,
      label,
      boundAt: new Date().toISOString(),
      warningAcknowledgedAt: new Date().toISOString(),
      message: "已选择当前浏览器会话作为发布账号。工作台不会保存 Cookie，也不会自动切换登录。",
    };
    touchContentAccount(state, account.id);
    await stateStore.write(state);
    return responseWorkspace(response, state);
  } catch (error) {
    return response.status(400).json({ error: error.message });
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
    const workspace = activeWorkspace(state);
    response.status(202).json(await runner.createJob("research", jobForActiveAccount(state, { positioning, storylineContext: storylineContext(workspace.storyline?.entries || []) })));
  } catch (error) {
    response.status(409).json({ error: error.message });
  }
});

app.post("/api/jobs/storyline-sync", async (_request, response) => {
  response.status(410).json({ error: "多账号模式不再同步当前小红书会话的历史笔记；请在每篇当前产出完成后手动标记“已发布”，避免跨账号混入故事线。" });
});

app.put("/api/topics/:id/select", async (request, response) => {
  if (runner.activeJobId) return response.status(409).json({ error: "Agent 任务执行中，暂时不能切换选题" });
  try {
    const state = await stateStore.read();
    selectTopic(activeWorkspace(state), request.params.id);
    touchContentAccount(state);
    await stateStore.write(state);
    responseWorkspace(response, state);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.put("/api/topics/:id", async (request, response) => {
  if (runner.activeJobId) return response.status(409).json({ error: "Agent 任务执行中，暂时不能编辑选题" });
  try {
    const state = await stateStore.read();
    editTopic(activeWorkspace(state), request.params.id, request.body || {});
    touchContentAccount(state);
    await stateStore.write(state);
    responseWorkspace(response, state);
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
    const workspace = activeWorkspace(state);
    const edited = applyDraftEdit(workspace, version, request.body || {});
    assertXhsTitle(edited.title, version === "raw" ? "手动编辑原始文稿" : "手动编辑去 AI 味文稿");
    const visualDirection = workspace.breakdown?.visualDirections?.find((item) => item.id === workspace.selectedVisualDirectionId);
    assertReaderFacingContent(edited, visualDirection, version === "raw" ? "手动编辑原始文稿" : "手动编辑去 AI 味文稿");
    touchContentAccount(state);
    await stateStore.write(state);
    responseWorkspace(response, state);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.post("/api/jobs/avatar", async (request, response) => {
  try {
    const mode = String(request.body?.mode || "uploaded_reference");
    if (runner.activeJobId) return response.status(409).json({ error: "已有 Agent 任务正在执行，请等待完成" });
    const state = await stateStore.read();
    const workspace = activeWorkspace(state);
    if (mode === "uploaded_reference") {
      if (!workspace.brandCharacter?.avatar?.absolutePath) return response.status(400).json({ error: "请先从本地上传头像图片" });
      workspace.brandCharacter.generationIssue = null;
      workspace.brandCharacter.updatedAt = new Date().toISOString();
      touchContentAccount(state);
      await stateStore.write(state);
      return response.status(202).json(await runner.createJob("avatar", jobForActiveAccount(state, {
        mode,
        brief: workspace.brandCharacter.brief || "用户本地上传的品牌角色母版",
        sourcePath: workspace.brandCharacter.avatar.absolutePath,
      })));
    }
    if (mode !== "generate_from_brief") return response.status(400).json({ error: "品牌角色生成方式无效" });
    const brief = String(request.body?.brief || "").trim().slice(0, 800);
    if (!brief) return response.status(400).json({ error: "请先填写账号定位，再由 Agent 设计品牌角色" });
    workspace.brandCharacter.generationIssue = null;
    workspace.brandCharacter.updatedAt = new Date().toISOString();
    touchContentAccount(state);
    await stateStore.write(state);
    response.status(202).json(await runner.createJob("avatar", jobForActiveAccount(state, { mode, brief })));
  } catch (error) {
    response.status(409).json({ error: error.message });
  }
});

app.post("/api/jobs/draft", async (request, response) => {
  try {
    const state = await stateStore.read();
    const workspace = activeWorkspace(state);
    const topic = workspace.research.topics.find((item) => item.id === request.body?.topicId);
    const visualDirection = workspace.breakdown?.visualDirections?.find((item) => item.id === request.body?.visualDirectionId);
    if (!workspace.brandCharacter?.locked || !workspace.brandCharacter?.avatar) {
      return response.status(400).json({ error: "请先生成并锁定头像角色" });
    }
    if (!topic || workspace.breakdown?.topicId !== topic.id || !visualDirection) {
      return response.status(400).json({ error: "请先完成当前选题的热点拆解并确认动态视觉方向" });
    }
    const imageCount = Number(workspace.generationSettings?.imageCount || 4);
    response.status(202).json(await runner.createJob("draft", jobForActiveAccount(state, { topic, visualDirection, imageCount })));
  } catch (error) {
    response.status(409).json({ error: error.message });
  }
});

app.post("/api/jobs/humanize", async (_request, response) => {
  try {
    const state = await stateStore.read();
    const workspace = activeWorkspace(state);
    if (!workspace.draft || workspace.draft.mode !== "raw") {
      return response.status(400).json({ error: "请先生成原始文稿，再执行去 AI 味" });
    }
    response.status(202).json(await runner.createJob("humanize", jobForActiveAccount(state)));
  } catch (error) {
    response.status(409).json({ error: error.message });
  }
});

app.post("/api/jobs/illustrate", async (_request, response) => {
  try {
    const state = await stateStore.read();
    const workspace = activeWorkspace(state);
    const visualDirection = workspace.breakdown?.visualDirections?.find((item) => item.id === workspace.selectedVisualDirectionId);
    if (!workspace.draft || workspace.draft.mode !== "humanized") {
      return response.status(400).json({ error: "请先完成中文去 AI 味，再生成配图" });
    }
    if (!visualDirection) return response.status(400).json({ error: "当前视觉方向已失效，请重新确认" });
    const imageCount = Number(workspace.generationSettings?.imageCount || 4);
    if (workspace.draft.imageCards?.length !== imageCount) return response.status(400).json({ error: "文稿卡片数量与本轮配图数量不一致，请重新生成文稿" });
    response.status(202).json(await runner.createJob("illustrate", jobForActiveAccount(state, { visualDirection, imageCount })));
  } catch (error) {
    response.status(409).json({ error: error.message });
  }
});

app.post("/api/jobs/revise", async (request, response) => {
  try {
    const state = await stateStore.read();
    const workspace = activeWorkspace(state);
    const feedback = String(request.body?.feedback || "").trim().slice(0, 1200);
    const scope = String(request.body?.scope || "both");
    if (!feedback) return response.status(400).json({ error: "请填写需要调整的具体内容" });
    if (!["copy", "visual", "both"].includes(scope)) return response.status(400).json({ error: "修改范围无效" });
    if (!workspace.draft || workspace.draft.mode !== "humanized" || workspace.assets.length === 0) {
      return response.status(400).json({ error: "请先生成完整文稿和配图，再提交调整意见" });
    }
    const previousReview = workspace.review;
    workspace.review = { status: "changes_requested", feedback, scope, round: Number(workspace.review?.round || 1), updatedAt: new Date().toISOString() };
    touchContentAccount(state);
    await stateStore.write(state);
    try {
      response.status(202).json(await runner.createJob("revise", jobForActiveAccount(state, { feedback, scope })));
    } catch (error) {
      workspace.review = previousReview;
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
  const workspace = activeWorkspace(state);
  const account = activeAccount(state);
  if (!workspace.draft || workspace.draft.mode !== "humanized" || workspace.assets.length === 0) {
    return response.status(400).json({ error: "当前没有可确认的完整文稿和配图" });
  }
  if (workspace.assets.some((asset) => asset.rendererVersion !== CARD_RENDERER_VERSION)) {
    return response.status(400).json({ error: "配图仍使用旧版渲染规则，请刷新工作台后重新预览" });
  }
  workspace.review = { ...(workspace.review || {}), status: "approved", feedback: "", scope: null, approvedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  workspace.publish = account?.publishBinding?.enabled
    ? { status: "ready", noteId: null, url: null, message: "文稿和配图已预览确认，可以选择发布方式" }
    : { status: "content_ready", noteId: null, url: null, message: "文稿与配图已确认并写入本地 output；发布功能默认关闭，可仅手动标记故事线" };
  updateArchivedOutputStatus(account, workspace.outputExportId, "reviewed");
  touchContentAccount(state, account?.id);
  await stateStore.write(state);
  responseWorkspace(response, state);
});

app.post("/api/storyline/mark-published", async (_request, response) => {
  if (runner.activeJobId) return response.status(409).json({ error: "Agent 任务执行中，暂时不能标记已发布" });
  try {
    const state = await stateStore.read();
    const workspace = activeWorkspace(state);
    const account = activeAccount(state);
    if (!workspace.draft || workspace.draft.mode !== "humanized" || workspace.assets.length === 0 || workspace.review?.status !== "approved") {
      throw new Error("请先完成配图并确认完整预览，再手动标记已发布");
    }
    const entry = archiveManuallyPublishedStoryline(workspace);
    workspace.publish = { status: "manual_published", noteId: null, url: null, message: "已手动标记为已发布，仅用于账号故事线梳理" };
    updateArchivedOutputStatus(account, workspace.outputExportId, "manual_published");
    touchContentAccount(state, account?.id);
    await stateStore.write(state);
    responseWorkspace(response, state);
  } catch (error) {
    response.status(400).json({ error: error.message });
  }
});

app.post("/api/jobs/deconstruct", async (request, response) => {
  try {
    const state = await stateStore.read();
    const workspace = activeWorkspace(state);
    const topic = workspace.research.topics.find((item) => item.id === request.body?.topicId);
    if (!topic) return response.status(400).json({ error: "请先确认一个选题" });
    if (!workspace.brandCharacter?.locked || !workspace.brandCharacter?.avatar) {
      return response.status(400).json({ error: "请先生成并锁定头像角色，再让视觉方向适配该人物" });
    }
    const referencedSignals = topic.evidenceRefs.map((index) => workspace.research.signals[index]).filter(Boolean);
    if (referencedSignals.length === 0 || referencedSignals.some((signal) => signal.mediaKind !== "graphic" || signal.imageCount < 1 || !isVerifiedViralSignal(signal))) {
      return response.status(400).json({ error: "当前选题缺少已通过媒体与爆款门槛校验的图文热点，请重新扫描" });
    }
    response.status(202).json(await runner.createJob("deconstruct", jobForActiveAccount(state, { topic })));
  } catch (error) {
    response.status(409).json({ error: error.message });
  }
});

app.put("/api/character-lock", async (request, response) => {
  const state = await stateStore.read();
  const workspace = activeWorkspace(state);
  if (workspace.brandCharacter?.status !== "ready" || !workspace.brandCharacter?.avatar || workspace.brandCharacter.series?.length !== 6) {
    return response.status(400).json({ error: "请先基于上传头像生成完整的 6 个系列品牌形象" });
  }
  workspace.brandCharacter.locked = Boolean(request.body?.locked);
  workspace.brandCharacter.lockedAt = workspace.brandCharacter.locked ? new Date().toISOString() : null;
  if (!workspace.brandCharacter.locked) {
    resetProductionAfterBrandChange(workspace, "品牌角色已解除锁定，后续内容需要重新确认");
  }
  touchContentAccount(state);
  await stateStore.write(state);
  responseWorkspace(response, state);
});

app.post("/api/jobs/publish", async (request, response) => {
  try {
    const state = await stateStore.read();
    const workspace = activeWorkspace(state);
    const account = activeAccount(state);
    const mode = String(request.body?.mode || "");
    if (!["publish_now", "save_draft"].includes(mode)) return response.status(400).json({ error: "请选择立即发布或暂缓发布" });
    if (!account?.publishBinding?.enabled) return response.status(400).json({ error: "发布功能默认关闭。请先确认当前浏览器已登录目标账号，并手动启用发布账号。" });
    const expectedConfirmation = mode === "save_draft" ? "SAVE_DRAFT_CONFIRMED" : "PUBLISH_NOW_CONFIRMED";
    if (request.body?.confirmation !== expectedConfirmation) return response.status(400).json({ error: mode === "save_draft" ? "缺少明确的暂存确认" : "缺少明确的立即发布确认" });
    if (!workspace.draft || workspace.draft.mode !== "humanized" || workspace.assets.length === 0 || workspace.review?.status !== "approved" || workspace.assets.some((asset) => asset.rendererVersion !== CARD_RENDERER_VERSION)) {
      return response.status(400).json({ error: "请先完成文稿、去 AI 味、配图，并在审稿台确认预览" });
    }
    assertXhsTitle(workspace.draft.title, "待发布文稿");
    const topic = workspace.research?.topics?.find((item) => item.id === workspace.selectedTopicId) || null;
    const visualDirection = workspace.breakdown?.visualDirections?.find((item) => item.id === workspace.selectedVisualDirectionId) || null;
    const storySnapshot = {
      positioning: workspace.positioning,
      topic: topic ? { id: topic.id, title: topic.title, angle: topic.angle, reason: topic.reason } : null,
      draft: { title: workspace.draft.title, body: workspace.draft.body, tags: workspace.draft.tags || [], imageCount: workspace.assets.length },
      visualDirection: visualDirection ? { id: visualDirection.id, name: visualDirection.name } : null,
    };
    let draftBaselineIds = [];
    let draftBaselineCapturedAt = null;
    if (mode === "save_draft") {
      const drafts = await readImageDrafts({ root });
      draftBaselineIds = drafts.map((draft) => draft.id);
      draftBaselineCapturedAt = new Date().toISOString();
    }
    response.status(202).json(await runner.createJob("publish", jobForActiveAccount(state, {
      mode,
      confirmedAt: new Date().toISOString(),
      storySnapshot,
      outputExportId: workspace.outputExportId || null,
      publishAccountLabel: account.publishBinding.label,
      draftBaselineIds,
      draftBaselineCapturedAt,
    })));
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
  app.get("/{*splat}", (_request, response) => response.sendFile(path.join(root, "dist", "index.html")));
} else {
  const vite = await createViteServer({ root, server: { middlewareMode: true }, appType: "spa" });
  app.use(vite.middlewares);
}

const listener = app.listen(port, host, () => {
  const address = listener.address();
  const listeningPort = typeof address === "object" && address ? address.port : port;
  process.stdout.write(`AGENT_XHS_READY http://${host}:${listeningPort}\n`);
});
