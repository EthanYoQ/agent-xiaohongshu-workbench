import assert from "node:assert/strict";
import test from "node:test";
import { applyDraftEdit, archivePublishedStoryline, editTopic, storylineContext } from "../server/workspace-editor.mjs";

function draft(mode = "raw") {
  return {
    mode,
    title: "原始标题",
    body: "原始正文",
    tags: ["内容创作"],
    imageCards: [
      { kicker: "01", headline: "先做一步", body: "先处理眼前这件事。", characterAction: "拿着便签思考" },
      { kicker: "02", headline: "再问具体", body: "说清已经试过什么。", characterAction: "举手提问" },
    ],
    characterAssets: [],
  };
}

function stateFixture() {
  const raw = draft("raw");
  const humanized = { ...draft("humanized"), title: "真人感标题" };
  return {
    positioning: "面向希望稳定输出图文内容的创作者",
    research: { signals: [{ mediaKind: "graphic", imageCount: 5 }], topics: [{ id: "topic-1", title: "旧选题", angle: "旧角度", reason: "旧理由", evidenceRefs: [0] }] },
    selectedTopicId: "topic-1",
    breakdown: { topicId: "topic-1", visualDirections: [{ id: "direction-1", name: "奶油手账" }] },
    selectedVisualDirectionId: "direction-1",
    draft: humanized,
    copyVersions: { raw, humanized },
    humanization: { status: "completed" },
    assets: [{ id: "asset-1" }],
    review: { status: "approved" },
    publish: { status: "ready" },
    storyline: { entries: [], updatedAt: null },
  };
}

test("editing a topic preserves hotspot evidence and invalidates downstream production", () => {
  const state = stateFixture();
  const edited = editTopic(state, "topic-1", { title: "首次做系列内容，先把选题定清", angle: "从小而具体的内容动作切入", reason: "承接创作前的选择困难" });
  assert.deepEqual(edited.evidenceRefs, [0]);
  assert.equal(edited.editedBy, "user");
  assert.equal(state.selectedTopicId, "topic-1");
  assert.equal(state.breakdown, null);
  assert.equal(state.copyVersions.raw, null);
  assert.equal(state.assets.length, 0);
  assert.equal(state.review, null);
});

test("editing raw copy keeps card actions and invalidates humanized copy and visuals", () => {
  const state = stateFixture();
  const edited = applyDraftEdit(state, "raw", {
    title: "改过的原始标题",
    body: "改过的原始正文",
    tags: ["内容规划", "内容创作"],
    imageCards: [
      { kicker: "第一步", headline: "只做眼前", body: "先完成一件。" },
      { kicker: "第二步", headline: "问题问清", body: "把卡点说具体。" },
    ],
  });
  assert.equal(edited.imageCards[0].characterAction, "拿着便签思考");
  assert.equal(state.copyVersions.humanized, null);
  assert.equal(state.draft.mode, "raw");
  assert.equal(state.humanization.status, "pending");
  assert.equal(state.assets.length, 0);
  assert.equal(state.review, null);
});

test("editing humanized copy preserves raw version and invalidates visuals", () => {
  const state = stateFixture();
  const rawTitle = state.copyVersions.raw.title;
  applyDraftEdit(state, "humanized", {
    title: "改过的真人感标题",
    body: "改过的真人感正文",
    tags: "内容规划，创作复盘",
    imageCards: [
      { kicker: "01", headline: "先做一点", body: "今天只处理这一件。" },
      { kicker: "02", headline: "问得具体", body: "别把问题憋成焦虑。" },
    ],
  });
  assert.equal(state.copyVersions.raw.title, rawTitle);
  assert.equal(state.copyVersions.humanized.editedBy, "user");
  assert.equal(state.draft.mode, "humanized");
  assert.equal(state.assets.length, 0);
  assert.equal(state.review, null);
});

test("successful publish archives once and exposes bounded storyline context", () => {
  const state = stateFixture();
  const result = { status: "published", noteId: "note-1", url: "https://example.invalid/note-1", evidence: "发布页返回笔记链接" };
  archivePublishedStoryline(state, { id: "publish-1" }, result);
  archivePublishedStoryline(state, { id: "publish-1-repeat" }, result);
  assert.equal(state.storyline.entries.length, 1);
  assert.equal(state.storyline.entries[0].topic.title, "旧选题");
  assert.equal(state.storyline.entries[0].draft.title, "真人感标题");
  assert.equal(storylineContext(state.storyline.entries)[0].noteId, "note-1");
});

test("failed or unknown publish never enters storyline", () => {
  const state = stateFixture();
  archivePublishedStoryline(state, { id: "publish-failed" }, { status: "failed", noteId: null, url: null });
  archivePublishedStoryline(state, { id: "publish-unknown" }, { status: "unknown", url: "https://example.invalid/unverified" });
  archivePublishedStoryline(state, { id: "publish-draft" }, { status: "draft_saved", noteId: null, url: null });
  assert.equal(state.storyline.entries.length, 0);
});
