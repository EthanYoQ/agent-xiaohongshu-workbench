import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { AgentRunner, assertXhsTitle, progressFromOutput } from "../server/agent-runner.mjs";
import { addContentAccount, createFreshMultiAccountState, getContentAccount } from "../server/account-workspace.mjs";
import { saveUploadedAvatar } from "../server/brand-character.mjs";
import { isVerifiedViralSignal } from "../server/viral-filter.mjs";

function fixtureState() {
  return {
    positioning: "面向内容创作者的图文工作流",
    research: {
      signals: [{ label: "内容规划难题", mediaKind: "graphic", imageCount: 6, url: "https://example.invalid/note", publishedAt: null, engagement: { likes: 320, collects: 90, comments: 18, verified: true, observedAt: "2026-07-15T00:00:00Z", source: "note_detail" } }],
      topics: [{ id: "topic-1", title: "内容计划如何从热点变成原创", evidenceRefs: [0] }],
    },
    selectedTopicId: "topic-1",
    breakdown: null,
    selectedVisualDirectionId: null,
    brandCharacter: { status: "ready", locked: true, avatar: { absolutePath: "avatar.png" }, identityLock: {} },
    brandVisualIdentity: {
      name: "暖纸内容手账",
      palette: { paper: "#FFF8EA", ink: "#332923", primary: "#5A3828", accent: "#F18C70", soft: "#F4DDB9" },
      topicAccents: ["#F18C70", "#D8A05E"],
    },
    generationSettings: { imageCount: 4 },
    draft: null,
    copyVersions: { raw: null, humanized: null },
    humanization: null,
    assets: [],
    review: null,
    publish: { status: "not_started" },
    storyline: { entries: [], updatedAt: null },
    storylineSync: { status: "not_started", imported: 0, updatedAt: null, message: "尚未同步" },
  };
}

test("viral filter rejects one-like notes and accepts only verified threshold signals", () => {
  const base = { mediaKind: "graphic", imageCount: 2, engagement: { likes: 1, collects: 0, comments: 1, verified: true } };
  assert.equal(isVerifiedViralSignal(base), false);
  assert.equal(isVerifiedViralSignal({ ...base, engagement: { ...base.engagement, likes: 300 } }), true);
  assert.equal(isVerifiedViralSignal({ ...base, engagement: { ...base.engagement, collects: 100 } }), true);
  assert.equal(isVerifiedViralSignal({ ...base, engagement: { ...base.engagement, likes: 250, collects: 150 } }), true);
  assert.equal(isVerifiedViralSignal({ ...base, engagement: { ...base.engagement, likes: 999, verified: false } }), false);
});

test("XHS title gate uses the platform's 20 JavaScript character limit", () => {
  assert.equal(assertXhsTitle("发布前先检查这三项", "测试"), "发布前先检查这三项");
  assert.throws(() => assertXhsTitle("这个示例标题明显已经超过二十个字符限制需要拦截", "测试"), /超过小红书 20 字上限/);
});

test("research result rejects low-engagement evidence even when the agent marks it verified", async () => {
  let state = fixtureState();
  const stateStore = { read: async () => structuredClone(state), write: async (next) => { state = structuredClone(next); } };
  const runner = new AgentRunner({ root: process.cwd(), stateStore });
  const low = {
    status: "partial",
    evidenceMode: "none",
    summary: "互动不足",
    blocker: "没有足够爆款",
    signals: [{ label: "低互动", heat: 1, evidence: "1赞1评", url: "https://example.invalid/low", noteId: "low", mediaKind: "graphic", imageCount: 1, publishedAt: null, engagement: { likes: 1, collects: 0, comments: 1, verified: true, observedAt: "2026-07-15T00:00:00Z", source: "note_detail" } }],
    topics: [],
  };
  await assert.rejects(runner.applyResult({ type: "research", payload: { positioning: state.positioning } }, low), /爆款门槛/);
});

test("research result writes only to the job's content account", async () => {
  let state = createFreshMultiAccountState();
  const first = getContentAccount(state);
  first.workspace.research = { mode: "live_xhs", updatedAt: "2026-07-20T00:00:00Z", summary: "实习生热点", signals: [], topics: [{ id: "intern-topic", title: "实习生选题" }] };
  const second = addContentAccount(state, { name: "AI 职场观察", positioning: "AI 职场" });
  const stateStore = { read: async () => structuredClone(state), write: async (next) => { state = structuredClone(next); } };
  const runner = new AgentRunner({ root: process.cwd(), stateStore });
  const result = {
    status: "partial",
    evidenceMode: "partial",
    summary: "本账号只找到一条已核验图文爆款",
    blocker: "继续刷新可补充更多证据",
    signals: [{ label: "AI 职场爆款", heat: 88, evidence: "互动已核验", url: "https://example.invalid/ai", noteId: "ai-note", mediaKind: "graphic", imageCount: 3, publishedAt: null, engagement: { likes: 320, collects: 90, comments: 10, verified: true, observedAt: "2026-07-21T00:00:00Z", source: "note_detail" } }],
    topics: [],
  };

  await runner.applyResult({ type: "research", payload: { accountId: second.id, accountName: second.name, positioning: "高频使用 AI 的职场人" } }, result);

  const storedFirst = state.contentAccounts.find((account) => account.id === first.id);
  const storedSecond = state.contentAccounts.find((account) => account.id === second.id);
  assert.equal(storedFirst.workspace.research.topics[0].id, "intern-topic");
  assert.equal(storedSecond.workspace.positioning, "高频使用 AI 的职场人");
  assert.equal(storedSecond.workspace.research.signals[0].noteId, "ai-note");
});

test("storyline sync prompt is read-only and excludes comments and non-published records", () => {
  const runner = new AgentRunner({ root: process.cwd(), stateStore: { read: async () => fixtureState(), write: async () => {} } });
  const prompt = runner.buildPrompt({ type: "storyline_sync", payload: {} }, fixtureState());
  assert.match(prompt, /严格只读任务/);
  assert.match(prompt, /不读取评论内容/);
  assert.match(prompt, /排除草稿、审核中、发布失败、视频/);
});

test("storyline sync result updates recovery status and imports verified posts", async () => {
  let state = fixtureState();
  const stateStore = { read: async () => structuredClone(state), write: async (next) => { state = structuredClone(next); } };
  const runner = new AgentRunner({ root: process.cwd(), stateStore });
  await runner.applyResult({ id: "sync-result", type: "storyline_sync", payload: {} }, {
    status: "success",
    summary: "已读取创作后台",
    blocker: null,
    notes: [{ title: "已发布图文", noteId: "note-synced", url: "https://example.invalid/synced", publishedAt: "2026-07-15T08:00:00+08:00", tags: ["内容"], imageCount: 2, mediaKind: "graphic", evidence: "创作后台显示已发布" }],
  });
  assert.equal(state.storyline.entries.length, 1);
  assert.equal(state.storylineSync.status, "success");
  assert.equal(state.storylineSync.imported, 1);
});

function breakdownResult(mediaKind = "graphic") {
  const palette = { paper: "#F8F3EA", ink: "#202523", primary: "#C94F43", accent: "#D7A36A", soft: "#DED8CE" };
  const block = { summary: "从冲突到行动", patterns: ["短钩子", "清单推进"], evidence: ["来源笔记观察"] };
  return {
    status: "success",
    summary: "完成图文热点拆解",
    sources: [{ title: "来源", url: "https://example.invalid/note", noteId: "note-1", mediaKind, imageCount: 6, publishedAt: "不可获得", engagement: "已观察", observations: "图文轮播" }],
    contentStructure: block,
    writingMechanics: block,
    visualDNA: block,
    publishingContext: { observed: "仅有日期", recommendation: "工作日晚间测试", confidence: "low" },
    imitationStrategy: { transferablePatterns: ["冲突开场", "行动清单"], accountAdaptation: ["新人口吻", "降低压力"], originalityBoundaries: ["不复制原句", "不复制版式"] },
    visualDirections: [1, 2, 3].map((index) => ({ id: `direction-${index}`, name: `方向 ${index}`, rationale: "来自选题与视觉 DNA", topicFit: "承载职场张力", avatarFit: "右下角保留人物安全区", palette, typographyMode: "紧凑标题", layoutMode: "editorial-grid", motif: "工作便签", imageTreatment: "低饱和", coverFormula: "冲突标题加行动承诺" })),
    recommendedDirectionId: "direction-1",
    blocker: "",
  };
}

test("deconstruct result persists one Lingzao skill and locks brand palette", async () => {
  let state = fixtureState();
  const stateStore = { read: async () => structuredClone(state), write: async (next) => { state = structuredClone(next); } };
  const runner = new AgentRunner({ root: process.cwd(), stateStore });
  await runner.applyResult({ type: "deconstruct", payload: { topic: state.research.topics[0] } }, breakdownResult());
  assert.equal(state.breakdown.visualDirections.length, 3);
  assert.deepEqual(state.breakdown.sourceSkillSet, ["lingzao"]);
  assert.equal(state.breakdown.visualDirections[0].palette.paper, "#FFF8EA");
  assert.equal(state.breakdown.visualDirections[0].palette.primary, "#5A3828");
  assert.equal(state.breakdown.visualDirections[0].palette.accent, "#F18C70");
  assert.equal(state.selectedVisualDirectionId, "direction-1");
  assert.equal(state.brandCharacter.locked, true);
});

test("deconstruct result rejects video sources", async () => {
  let state = fixtureState();
  const stateStore = { read: async () => structuredClone(state), write: async (next) => { state = structuredClone(next); } };
  const runner = new AgentRunner({ root: process.cwd(), stateStore });
  await assert.rejects(
    runner.applyResult({ type: "deconstruct", payload: { topic: state.research.topics[0] } }, breakdownResult("video")),
    /视频或未验证来源/,
  );
});

test("draft result rejects production instructions inside reader-facing card copy", async () => {
  let state = fixtureState();
  const stateStore = { read: async () => structuredClone(state), write: async (next) => { state = structuredClone(next); } };
  const runner = new AgentRunner({ root: process.cwd(), stateStore });
  await assert.rejects(
    runner.applyResult(
      { type: "draft", payload: { topic: state.research.topics[0], visualDirection: { id: "direction-1" }, imageCount: 1 } },
      {
        title: "测试",
        body: "正文",
        tags: ["内容规划"],
        imageCards: [{ kicker: "封面", headline: "低配推进", body: "1080×1440 奶油底 #FFF8EA，右下放角色", characterAction: "拿卡片" }],
        characterAssets: [{ action: "拿卡片", filePath: "missing.png" }],
        editorNote: "测试",
      },
    ),
    /读者可见字段/,
  );
});

test("draft result rejects internal visual language in any visible card field", async () => {
  let state = fixtureState();
  const direction = breakdownResult().visualDirections[0];
  direction.motif = "通勤时间戳、票根式标签、细线日程格";
  const stateStore = { read: async () => structuredClone(state), write: async (next) => { state = structuredClone(next); } };
  const runner = new AgentRunner({ root: process.cwd(), stateStore });
  await assert.rejects(
    runner.applyResult(
      { type: "draft", payload: { topic: state.research.topics[0], visualDirection: direction, imageCount: 1 } },
      {
        title: "测试",
        body: "正文",
        tags: ["内容规划", "创作者", "复盘"],
        imageCards: [{ kicker: "票根式标签", headline: "真实标题", body: "真实正文", characterAction: "拿卡片" }],
        characterAssets: [],
        editorNote: "测试",
      },
    ),
    /泄漏视觉配置/,
  );
});

test("humanize result becomes the only draft allowed to proceed to illustration", async () => {
  let state = fixtureState();
  state.draft = {
    mode: "raw",
    title: "内容计划怎么做",
    body: "这不仅是整理，更是一次清晰的复盘。",
    tags: ["内容规划", "内容创作", "复盘"],
    imageCards: [
      { kicker: "01", headline: "先别慌", body: "值得注意的是先把问题说清楚。", characterAction: "拿便签" },
      { kicker: "02", headline: "问具体", body: "这使得我们能够更高效地提问。", characterAction: "举手提问" },
      { kicker: "03", headline: "做复盘", body: "实现工作流程的系统性优化。", characterAction: "低头记录" },
    ],
  };
  const stateStore = { read: async () => structuredClone(state), write: async (next) => { state = structuredClone(next); } };
  const runner = new AgentRunner({ root: process.cwd(), stateStore });
  await runner.applyResult({ type: "humanize", payload: {} }, {
    title: "内容计划，先把这一篇说清楚",
    body: "刚开始规划会乱很正常。先把这篇卡住的地方说清楚，再处理下一步。",
    tags: ["内容规划", "内容创作", "复盘"],
    imageCards: [
      { kicker: "01", headline: "先别慌", body: "先把眼前卡住的一件事写下来。", characterAction: "拿便签" },
      { kicker: "02", headline: "问具体", body: "说清你试过什么，再问具体卡点。", characterAction: "举手提问" },
      { kicker: "03", headline: "做复盘", body: "结束前记三行，给下一篇留个入口。", characterAction: "低头记录" },
    ],
    diagnosis: ["原稿有万能总结和抽象名词"],
    revisionNotes: ["把抽象判断换成新人当天能做的动作"],
    editorNote: "未新增个人经历",
  });
  assert.equal(state.draft.mode, "humanized");
  assert.equal(state.copyVersions.humanized.mode, "humanized");
  assert.equal(state.copyVersions.raw, null);
  assert.equal(state.humanization.status, "completed");
  assert.equal(state.humanization.skill, "humanized-chinese-writing-polisher");
  assert.equal(state.assets.length, 0);
});

test("avatar result accepts a non-human brand subject and locks it to real project brand assets", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "xhs-avatar-test-"));
  const avatarPath = path.join(root, "public", "brand", "avatars", "avatar.png");
  const seriesDir = path.join(root, "public", "brand", "actions", "series-test");
  await fs.mkdir(path.dirname(avatarPath), { recursive: true });
  await fs.mkdir(seriesDir, { recursive: true });
  await fs.writeFile(avatarPath, "fixture");
  const seriesAssets = await Promise.all(["打招呼", "解释", "思考", "记录", "提醒", "庆祝"].map(async (action, index) => {
    const filePath = path.join(seriesDir, `${index + 1}.png`);
    await fs.writeFile(filePath, "fixture");
    return { action, filePath };
  }));
  let state = fixtureState();
  const stateStore = { read: async () => structuredClone(state), write: async (next) => { state = structuredClone(next); } };
  const runner = new AgentRunner({ root, stateStore });
  await runner.applyResult({ type: "avatar", payload: { mode: "uploaded_reference", brief: "本地上传母版", sourcePath: avatarPath } }, {
    status: "success",
    prompt: "avatar prompt",
    assetPath: avatarPath,
    identityLock: {
      subject: "橘色虎斑猫品牌主体",
      distinctiveFeatures: "琥珀色眼睛、三角耳朵、橘白相间的条纹毛色",
      canonicalForm: "品牌延展设定：统一的半身贴纸式小猫轮廓",
      renderingStyle: "清爽扁平插画",
      invariants: ["猫脸轮廓不变", "耳朵形状不变", "条纹毛色不变", "琥珀色眼睛不变", "贴纸渲染不变"],
    },
    brandVisualIdentity: {
      name: "浅杏内容手账",
      palette: { paper: "#FFF8EA", ink: "#332923", primary: "#5A3828", accent: "#F18C70", soft: "#F4DDB9" },
      topicAccents: ["#F18C70", "#D8A05E", "#9E6D55", "#DB6B5D"],
      typography: "圆体标题与清爽正文",
      composition: "左上标题，中央信息，右下角色",
      characterPlacement: "角色固定在右下角",
      visualRules: ["底色固定", "主色固定", "留白固定", "角色位置固定"],
    },
    seriesAssets,
    blocker: "",
  });
  assert.equal(state.brandCharacter.status, "ready");
  assert.equal(state.brandCharacter.locked, false);
  assert.equal(state.brandCharacter.avatar.url, "/brand/avatars/avatar.png");
  assert.equal(state.brandCharacter.series.length, 6);
  assert.equal(state.brandCharacter.source, "user-upload");
  assert.equal(state.brandCharacter.generationIssue, null);
  assert.equal(state.brandVisualIdentity.version, "agent-xhs-brand-v2");
});

test("uploaded animal or cropped reference is a supported avatar prompt, not a blocker", () => {
  const runner = new AgentRunner({ root: process.cwd(), stateStore: { read: async () => fixtureState(), write: async () => {} } });
  const prompt = runner.buildPrompt({ id: "animal-avatar", type: "avatar", payload: { mode: "uploaded_reference", sourcePath: "public/brand/avatars/animal.png", brief: "用户本地上传的品牌主体母版" } }, fixtureState());
  assert.match(prompt, /人物、动物、吉祥物、物体、植物、食物、图标/);
  assert.match(prompt, /不得因为看不到全身、衣服、手脚或比例而返回 blocked/);
  assert.match(prompt, /不得把“参考图不是人物”或“画面被裁切”作为 blocker/);
  assert.doesNotMatch(prompt, /完整主要穿着/);
});

test("avatar schema rejects empty series asset paths", async () => {
  const schema = JSON.parse(await fs.readFile(path.join(process.cwd(), "server", "schemas", "avatar.schema.json"), "utf8"));
  assert.equal(schema.properties.seriesAssets.items.properties.filePath.minLength, 1);
});

test("avatar progress does not mistake Skill text for completed image verification", () => {
  const start = { phase: "avatar", label: "准备品牌角色生成", percent: 8 };
  const fromSkillText = progressFromOutput("avatar", "完整阅读 imagegen Skill\ncodex", start);
  assert.equal(fromSkillText.percent, 8);
  const fromAssets = progressFromOutput("avatar", '{"filePath":"public/brand/actions/series/01.png"}', start);
  assert.equal(fromAssets.phase, "verify");
  assert.equal(fromAssets.percent, 88);
});

test("avatar failures persist a retryable issue on the matching content account", async () => {
  let state = createFreshMultiAccountState();
  const account = getContentAccount(state);
  account.workspace.brandCharacter = {
    status: "uploaded",
    source: "user-upload",
    locked: false,
    avatar: { absolutePath: "public/brand/avatars/animal.png" },
    identityLock: null,
    series: [],
    generationIssue: null,
  };
  const stateStore = { read: async () => structuredClone(state), write: async (next) => { state = structuredClone(next); } };
  const runner = new AgentRunner({ root: process.cwd(), stateStore });
  await runner.recordAvatarFailure({ payload: { accountId: account.id, mode: "uploaded_reference" } }, "裁切头像也应当可以直接生成品牌延展系列");
  const stored = getContentAccount(state).workspace.brandCharacter;
  assert.equal(stored.status, "uploaded");
  assert.match(stored.generationIssue.message, /裁切头像/);
  assert.ok(stored.generationIssue.failedAt);
});

test("a stale avatar failure cannot roll back a later completed brand series", async () => {
  let state = createFreshMultiAccountState();
  const account = getContentAccount(state);
  account.workspace.brandCharacter = {
    status: "ready",
    source: "user-upload",
    locked: false,
    avatar: { absolutePath: "public/brand/avatars/current.png" },
    identityLock: { subject: "动物品牌主体" },
    series: Array.from({ length: 6 }, (_, index) => ({ action: `动作 ${index + 1}` })),
    generationIssue: null,
  };
  const stateStore = { read: async () => structuredClone(state), write: async (next) => { state = structuredClone(next); } };
  const runner = new AgentRunner({ root: process.cwd(), stateStore });
  await runner.recordAvatarFailure({ payload: { accountId: account.id, mode: "uploaded_reference", sourcePath: "public/brand/avatars/old.png" } }, "旧任务失败");
  const stored = getContentAccount(state).workspace.brandCharacter;
  assert.equal(stored.status, "ready");
  assert.equal(stored.series.length, 6);
  assert.equal(stored.generationIssue, null);
});

test("runner startup marks interrupted avatar work as failed and retryable", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "xhs-avatar-recovery-test-"));
  const jobsDir = path.join(root, ".data", "jobs");
  await fs.mkdir(jobsDir, { recursive: true });
  let state = createFreshMultiAccountState();
  const account = getContentAccount(state);
  account.workspace.brandCharacter = {
    status: "uploaded",
    source: "user-upload",
    locked: false,
    avatar: { absolutePath: "public/brand/avatars/animal.png" },
    identityLock: null,
    series: [],
    generationIssue: null,
  };
  const interrupted = {
    id: "avatar-interrupted",
    type: "avatar",
    status: "running",
    payload: { accountId: account.id, mode: "uploaded_reference" },
    progress: { phase: "series", label: "正在生成系列品牌形象", percent: 48 },
  };
  await fs.writeFile(path.join(jobsDir, `${interrupted.id}.json`), JSON.stringify(interrupted), "utf8");
  const stateStore = { read: async () => structuredClone(state), write: async (next) => { state = structuredClone(next); } };
  const runner = new AgentRunner({ root, stateStore });
  await runner.initialize();
  const recovered = await runner.getJob(interrupted.id);
  assert.equal(recovered.status, "failed");
  assert.match(recovered.error, /服务在任务完成前重启/);
  assert.match(getContentAccount(state).workspace.brandCharacter.generationIssue.message, /服务在任务完成前重启/);
});

test("uploaded avatar is validated, normalized and kept inside the local brand directory", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "xhs-avatar-upload-test-"));
  const buffer = await sharp({ create: { width: 480, height: 360, channels: 3, background: "#F4DDB9" } }).jpeg().toBuffer();
  const avatar = await saveUploadedAvatar({ root, buffer, contentType: "image/jpeg" });
  const metadata = await sharp(avatar.absolutePath).metadata();
  assert.equal(metadata.format, "png");
  assert.equal(avatar.url.startsWith("/brand/avatars/avatar-"), true);
  assert.equal(path.dirname(avatar.absolutePath), path.join(root, "public", "brand", "avatars"));
});

test("uploaded avatar rejects unsupported or undersized images", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "xhs-avatar-reject-test-"));
  const tiny = await sharp({ create: { width: 128, height: 128, channels: 3, background: "#ffffff" } }).png().toBuffer();
  await assert.rejects(saveUploadedAvatar({ root, buffer: tiny, contentType: "image/png" }), /不能小于 256px/);
  await assert.rejects(saveUploadedAvatar({ root, buffer: tiny, contentType: "image/gif" }), /仅支持 PNG/);
});

test("draft result must match the user-selected image count", async () => {
  let state = fixtureState();
  const stateStore = { read: async () => structuredClone(state), write: async (next) => { state = structuredClone(next); } };
  const runner = new AgentRunner({ root: process.cwd(), stateStore });
  await assert.rejects(runner.applyResult(
    { type: "draft", payload: { topic: state.research.topics[0], visualDirection: { id: "direction-1" }, imageCount: 2 } },
    { title: "标题", body: "正文", tags: ["内容"], imageCards: [{ kicker: "01", headline: "一张", body: "正文", characterAction: "解释" }], editorNote: "" },
  ), /必须生成用户选择的 2 张内容卡/);
});

test("copy revision rerenders the preview and returns it to pending review", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "xhs-revise-test-"));
  const characterPath = path.join(root, "character.png");
  await sharp({ create: { width: 120, height: 160, channels: 4, background: { r: 220, g: 90, b: 70, alpha: 0.9 } } }).png().toFile(characterPath);
  let state = fixtureState();
  const breakdown = breakdownResult();
  state.breakdown = breakdown;
  state.selectedVisualDirectionId = breakdown.recommendedDirectionId;
  const actions = ["拿便签", "举手提问", "低头记录"];
  state.draft = {
    mode: "humanized",
    title: "原标题",
    body: "原正文",
    tags: ["内容规划"],
    imageCards: actions.map((characterAction, index) => ({ kicker: `0${index + 1}`, headline: `原卡片 ${index + 1}`, body: "原卡片正文", characterAction })),
    characterAssets: actions.map((action) => ({ action, absolutePath: characterPath })),
  };
  state.humanization = { status: "completed", skill: "humanized-chinese-writing-polisher" };
  state.assets = actions.map((_, index) => ({ id: `old-${index}`, url: `/generated/old-${index}.png`, absolutePath: `old-${index}.png` }));
  state.review = { status: "pending", round: 1 };
  state.publish = { status: "awaiting_review" };
  const stateStore = { read: async () => structuredClone(state), write: async (next) => { state = structuredClone(next); } };
  const runner = new AgentRunner({ root, stateStore });
  await runner.applyResult({ id: "revise-test", type: "revise", payload: { feedback: "正文短一点", scope: "copy" } }, {
    title: "内容计划，先把这一篇说清楚",
    body: "先处理眼前这一件事。",
    tags: ["内容规划"],
    imageCards: actions.map((characterAction, index) => ({ kicker: `0${index + 1}`, headline: `卡片 ${index + 1}`, body: "一句能立刻执行的话。", characterAction })),
    visualDirection: breakdown.visualDirections[0],
    assetMode: "reuse",
    characterAssets: [],
    diagnosis: ["原稿稍长"],
    revisionNotes: ["压缩正文"],
    editorNote: "未增加事实",
  });
  assert.equal(state.assets.length, 3);
  assert.equal(state.review.status, "pending");
  assert.equal(state.review.round, 2);
  assert.equal(state.publish.status, "awaiting_review");
  assert.equal(state.draft.mode, "humanized");
  assert.equal(state.copyVersions.humanized.title, "内容计划，先把这一篇说清楚");
  assert.notEqual(state.assets[0].id, "old-0");
});

test("save-draft publish mode uses the adapter, verifies a new draft, and never archives a story", async () => {
  let state = fixtureState();
  state.draft = {
    mode: "humanized",
    title: "发布前先检查这三项",
    body: "正文",
    tags: ["内容创作"],
    imageCards: [{ kicker: "01", headline: "整理", body: "正文", characterAction: "拿便签" }],
  };
  state.assets = [{ absolutePath: "C:\\workspace\\card-1.png" }];
  const stateStore = { read: async () => structuredClone(state), write: async (next) => { state = structuredClone(next); } };
  const draftVerifier = async () => ({ ok: true, draft: { id: "draft-new", images: 1 }, evidence: "新增草稿已核验" });
  const runner = new AgentRunner({ root: process.cwd(), stateStore, draftVerifier });
  const job = { id: "save-draft-test", type: "publish", payload: { mode: "save_draft", draftBaselineIds: ["draft-old"], storySnapshot: { draft: { title: state.draft.title, imageCount: 1 } } } };
  const prompt = runner.buildPrompt(job, state);
  assert.match(prompt, /opencli xiaohongshu publish/);
  assert.match(prompt, /不得使用 opencli browser upload/);
  assert.match(prompt, /严禁点击“发布”/);
  assert.match(prompt, /status=draft_saved/);
  assert.match(runner.operationalRules(job), /绝对不要点击“发布”/);

  const applied = await runner.applyResult(job, { status: "failed", noteId: null, url: null, message: "页面反馈不明确", evidence: "适配器已执行" });
  assert.equal(applied.status, "draft_saved");
  assert.equal(state.publish.status, "draft_saved");
  assert.equal(state.publish.verifiedDraftId, "draft-new");
  assert.equal(state.storyline.entries.length, 0);
});

test("save-draft publish result is failed when no new matching draft is verified", async () => {
  let state = fixtureState();
  state.draft = { mode: "humanized", title: "未落入草稿箱", body: "正文", tags: [], imageCards: [] };
  state.assets = [{ absolutePath: "C:\\workspace\\card-1.png" }];
  const stateStore = { read: async () => structuredClone(state), write: async (next) => { state = structuredClone(next); } };
  const runner = new AgentRunner({
    root: process.cwd(),
    stateStore,
    draftVerifier: async () => ({ ok: false, reason: "没有新增匹配记录" }),
  });
  const result = await runner.applyResult({
    id: "save-draft-failed",
    type: "publish",
    payload: { mode: "save_draft", draftBaselineIds: [], storySnapshot: { draft: { title: state.draft.title, imageCount: 1 } } },
  }, { status: "draft_saved", noteId: null, url: null, message: "错误的页面成功提示", evidence: "仅看到草稿箱入口" });
  assert.equal(result.status, "failed");
  assert.equal(state.publish.status, "failed");
  assert.match(state.publish.message, /没有新增匹配记录/);
  assert.equal(state.storyline.entries.length, 0);
});
