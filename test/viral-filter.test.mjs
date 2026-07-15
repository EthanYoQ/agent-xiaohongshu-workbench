import assert from "node:assert/strict";
import test from "node:test";
import { isVerifiedViralSignal, VIRAL_THRESHOLDS, viralThresholdSummary } from "../server/viral-filter.mjs";

test("viral thresholds remain explicit and comments never qualify on their own", () => {
  assert.deepEqual(VIRAL_THRESHOLDS, { minLikes: 300, minCollects: 100, minLikesAndCollects: 400 });
  assert.match(viralThresholdSummary(), /评论数不能单独/);
  assert.equal(isVerifiedViralSignal({ mediaKind: "graphic", imageCount: 1, engagement: { likes: 0, collects: 0, comments: 9999, verified: true } }), false);
});
