import assert from "node:assert/strict";
import test from "node:test";
import { findNewMatchingDraft } from "../server/xhs-draft-verifier.mjs";

test("draft verification requires a new id, exact title, and exact image count", () => {
  const drafts = [
    { id: "old", title: "旧稿", images: 2 },
    { id: "new", title: "  当前  笔记 ", images: 3 },
  ];
  assert.deepEqual(findNewMatchingDraft(drafts, {
    baselineIds: ["old"],
    expectedTitle: "当前 笔记",
    expectedImageCount: 3,
  }), drafts[1]);
});

test("draft verification rejects baseline records and mismatched content", () => {
  assert.equal(findNewMatchingDraft([{ id: "old", title: "当前笔记", images: 3 }], {
    baselineIds: ["old"],
    expectedTitle: "当前笔记",
    expectedImageCount: 3,
  }), null);
  assert.equal(findNewMatchingDraft([{ id: "new", title: "当前笔记", images: 2 }], {
    baselineIds: [],
    expectedTitle: "当前笔记",
    expectedImageCount: 3,
  }), null);
});
