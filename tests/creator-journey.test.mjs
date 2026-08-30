import test from "node:test";
import assert from "node:assert/strict";
import { deriveCreatorJourney } from "../src/creator-journey.mjs";

test("starts at source and text generation", () => {
  const result = deriveCreatorJourney({ topic: "一个选题" });
  assert.equal(result.currentStep, 1);
  assert.match(result.nextAction, /生成文字/);
  assert.equal(result.steps[0].state, "current");
});

test("text draft waits for explicit confirmation", () => {
  const result = deriveCreatorJourney({ topic: "x", textDraft: { body: "draft" }, textConfirmed: false });
  assert.equal(result.currentStep, 2);
  assert.match(result.nextAction, /确认文字/);
  assert.equal(result.steps[2].target, "creator-text");
});

test("confirmed text routes to images without skipping", () => {
  const result = deriveCreatorJourney({ topic: "x", textDraft: {}, textConfirmed: true, generatedImageCount: 0, requiredImageCount: 5 });
  assert.equal(result.currentStep, 3);
  assert.match(result.nextAction, /0\/5/);
});

test("partial image progress stays in image stage until the full set is ready", () => {
  const result = deriveCreatorJourney({ topic: "x", textDraft: {}, textConfirmed: true, generatedImageCount: 1, requiredImageCount: 5, layoutIssueCount: 0 });
  assert.equal(result.currentStep, 3);
  assert.match(result.nextAction, /1\/5/);
  assert.equal(result.steps[4].state, "pending");
});

test("complete image set routes to layout then publish package", () => {
  const blocked = deriveCreatorJourney({ topic: "x", textDraft: {}, textConfirmed: true, generatedImageCount: 3, requiredImageCount: 3, layoutIssueCount: 2 });
  assert.equal(blocked.currentStep, 4);
  assert.match(blocked.nextAction, /2 处排版/);
  const ready = deriveCreatorJourney({ topic: "x", textDraft: {}, textConfirmed: true, generatedImageCount: 3, requiredImageCount: 3, layoutIssueCount: 0 });
  assert.equal(ready.currentStep, 5);
  assert.match(ready.nextAction, /下载发布包/);
});

test("a persisted complete draft restores its canonical stage without transient generation state", () => {
  const result = deriveCreatorJourney({ topic: "x", hasConfirmedContent: true, generatedImageCount: 4, requiredImageCount: 4, layoutIssueCount: 0 });
  assert.equal(result.currentStep, 5);
  assert.equal(result.steps[4].state, "current");
  assert.match(result.nextAction, /下载发布包/);
});
