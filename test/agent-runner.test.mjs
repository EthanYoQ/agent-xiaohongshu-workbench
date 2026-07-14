import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { AgentRunner } from "../server/agent-runner.mjs";

function fixtureState() {
  return {
    positioning: "面向内容创作者的图文工作流",
    research: {
      signals: [{ label: "内容规划难题", mediaKind: "graphic", imageCount: 6, url: "https://example.invalid/note" }],
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
    draft: null,
    copyVersions: { raw: null, humanized: null },
    humanization: null,
    assets: [],
    review: null,
    publish: { status: "not_started" },
    storyline: { entries: [], updatedAt: null },
  };
}

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
      { type: "draft", payload: { topic: state.research.topics[0], visualDirection: { id: "direction-1" } } },
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
      { type: "draft", payload: { topic: state.research.topics[0], visualDirection: direction } },
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

test("avatar result locks identity metadata to a real project brand asset", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "xhs-avatar-test-"));
  const avatarPath = path.join(root, "public", "brand", "avatars", "avatar.png");
  await fs.mkdir(path.dirname(avatarPath), { recursive: true });
  await fs.writeFile(avatarPath, "fixture");
  let state = fixtureState();
  const stateStore = { read: async () => structuredClone(state), write: async (next) => { state = structuredClone(next); } };
  const runner = new AgentRunner({ root, stateStore });
  await runner.applyResult({ type: "avatar", payload: { brief: "短发与浅色开衫" } }, {
    status: "success",
    prompt: "avatar prompt",
    assetPath: avatarPath,
    identityLock: {
      character: "通用内容创作者",
      faceAndHair: "圆脸，短发",
      outfit: "浅色上衣与深色长裤",
      renderingStyle: "清爽扁平插画",
      invariants: ["脸部不变", "发型不变", "穿着不变"],
    },
    blocker: "",
  });
  assert.equal(state.brandCharacter.status, "ready");
  assert.equal(state.brandCharacter.locked, false);
  assert.equal(state.brandCharacter.avatar.url, "/brand/avatars/avatar.png");
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

test("save-draft publish mode requires the exact 暂存离开 action and never archives a story", async () => {
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
  const runner = new AgentRunner({ root: process.cwd(), stateStore });
  const job = { id: "save-draft-test", type: "publish", payload: { mode: "save_draft" } };
  const prompt = runner.buildPrompt(job, state);
  assert.match(prompt, /点击界面中的“暂存离开”按钮/);
  assert.match(prompt, /严禁点击“发布”/);
  assert.match(prompt, /status=draft_saved/);
  assert.match(runner.operationalRules(job), /绝对不要点击“发布”/);

  await runner.applyResult(job, { status: "draft_saved", noteId: null, url: null, message: "草稿已保存", evidence: "看到草稿保存成功反馈" });
  assert.equal(state.publish.status, "draft_saved");
  assert.equal(state.storyline.entries.length, 0);
});
