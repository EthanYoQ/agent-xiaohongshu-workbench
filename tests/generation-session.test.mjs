import assert from "node:assert/strict";
import test from "node:test";
import { GENERATION_SESSION_SCHEMA, loadGenerationSession, persistGenerationSession } from "../src/generation-session.mjs";

function draft() {
  return { schema: "xiaoshimei.text-draft-response.v1", draft_id: "draft-1", created_at: new Date(0).toISOString(), source_input: "初秋雨天整理书桌", text_requirements: "", prompt_context: {}, pillar: "culture", goal: "save", titles: ["初秋雨天整理书桌的方法", "只整理书桌这一小块", "雨天慢慢收好桌面"], selected_title: "初秋雨天整理书桌的方法", body: "先把不属于桌面的物件放回原位。".repeat(30), tags: ["东方生活", "书桌整理", "雨天周末", "局部收纳", "小师妹日常"], recommended_image_count: 5, facts: [], risks: [], generation: {} };
}

test("confirmed text and paid-image resume survive a browser reload", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  persistGenerationSession(storage, "session", { topic: "初秋雨天整理书桌", pillar: "culture", goal: "save", text_requirements: "", text_draft: draft(), text_confirmed: true, assembled_draft_id: null, image_count_mode: "AUTO", custom_image_count: 5, production_mode: "smart", image_resume: { resume_run_id: "images-run", completed_mother_sheets: 1 } });
  const restored = loadGenerationSession(storage, "session");
  assert.equal(restored.schema, GENERATION_SESSION_SCHEMA);
  assert.equal(restored.text_confirmed, true);
  assert.equal(restored.image_resume.resume_run_id, "images-run");
  assert.equal(restored.text_draft.selected_title, "初秋雨天整理书桌的方法");
});
