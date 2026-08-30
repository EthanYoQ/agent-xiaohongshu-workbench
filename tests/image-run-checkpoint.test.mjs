import assert from "node:assert/strict";
import test from "node:test";
import { admitPendingImage, createImageRunCheckpoint, parseImageRunCheckpoint, recordImageCall, recordPendingImage, recordPendingPipelineFailure, recordResumableFailure, rejectPendingImage, replaceAdmittedImage, resumeImageIndex, updatePendingImage } from "../src/image-run-checkpoint.mjs";

function base() {
  return createImageRunCheckpoint({
    runId: "images-2026-08-15T00-00-00-000Z-1234abcd",
    draftId: "draft-1",
    draftSha256: "a".repeat(64),
    pageCount: 4,
    pages: [1, 2, 3, 4].map((page) => ({ page })),
    planAttempts: [{ attempt: 1, status: "PASS" }],
    reference: { sha256: "b".repeat(64) },
  });
}

test("image checkpoint counts a paid call before QA and resumes after admitted pages", () => {
  let checkpoint = recordImageCall(base());
  checkpoint = recordPendingImage(checkpoint, { page: 1, file: "01.jpg", sha256: "c".repeat(64) });
  assert.equal(checkpoint.actual_image_calls, 1);
  assert.equal(checkpoint.status, "QA_PENDING");
  checkpoint = admitPendingImage(checkpoint, { evidence: { page: 1, src: "/01.jpg" }, attempt: { page: 1, decision: "QA_UNAVAILABLE" } });
  assert.equal(resumeImageIndex(checkpoint), 1);
  checkpoint = recordResumableFailure(checkpoint, { failedPage: 2, code: "IMAGE_2_CALL_FAILED" });
  assert.equal(checkpoint.failure.failed_page, 2);
  assert.equal(resumeImageIndex(checkpoint), 1);
});

test("resume checkpoint binds exact draft hash, production mode, and page count", () => {
  const checkpoint = base();
  assert.equal(parseImageRunCheckpoint(checkpoint, { draftId: "draft-1", draftSha256: "a".repeat(64), productionMode: "smart", pageCount: 4 }).run_id, checkpoint.run_id);
  assert.throws(() => parseImageRunCheckpoint(checkpoint, { draftId: "draft-2", draftSha256: "a".repeat(64), pageCount: 4 }), /DRAFT_ID_MISMATCH/);
  assert.throws(() => parseImageRunCheckpoint(checkpoint, { draftId: "draft-1", draftSha256: "d".repeat(64), pageCount: 4 }), /DRAFT_HASH_MISMATCH/);
  assert.throws(() => parseImageRunCheckpoint(checkpoint, { draftId: "draft-1", draftSha256: "a".repeat(64), pageCount: 3 }), /PAGE_COUNT_MISMATCH/);
  assert.throws(() => parseImageRunCheckpoint(checkpoint, { draftId: "draft-1", draftSha256: "a".repeat(64), productionMode: "infographic", pageCount: 4 }), /PRODUCTION_MODE_MISMATCH/);
});

test("hard QA rejection records the call but does not admit the bad page", () => {
  let checkpoint = recordImageCall(base());
  checkpoint = recordPendingImage(checkpoint, { page: 1, file: "01.jpg", sha256: "c".repeat(64) });
  checkpoint = rejectPendingImage(checkpoint, { attempt: { page: 1, decision: "REVISE" }, code: "hands_ok" });
  assert.equal(checkpoint.actual_image_calls, 1);
  assert.equal(checkpoint.images.length, 0);
  assert.equal(checkpoint.status, "PARTIAL_FAILURE_RESUMABLE");
  assert.equal(resumeImageIndex(checkpoint), 0);
});

test("a returned paid image call is counted when asset decoding fails before QA", () => {
  let checkpoint = recordImageCall(base());
  checkpoint = recordResumableFailure(checkpoint, { failedPage: 1, code: "ARK_ASSET_DOWNLOAD_500" });
  assert.equal(checkpoint.actual_image_calls, 1);
  assert.equal(checkpoint.images.length, 0);
  assert.equal(checkpoint.failure.failed_page, 1);
  assert.equal(resumeImageIndex(checkpoint), 0);
});

test("a paid source asset survives slicing failure and can be completed without another call", () => {
  let checkpoint = recordImageCall(base());
  checkpoint = recordPendingImage(checkpoint, { page: 1, file: "01.jpg", sha256: "c".repeat(64), tiles: [] });
  checkpoint = recordPendingPipelineFailure(checkpoint, { attempt: { page: 1, decision: "PIPELINE_ERROR" }, code: "EDGE_GATE_FALSE_POSITIVE" });
  assert.equal(checkpoint.pending_image.file, "01.jpg");
  assert.equal(checkpoint.actual_image_calls, 1);
  assert.throws(() => resumeImageIndex(checkpoint), /PENDING_QA_REQUIRES_RECOVERY/);
  checkpoint = updatePendingImage(checkpoint, { ...checkpoint.pending_image, tiles: [{ unit_id: "page-1-hero" }] });
  checkpoint = admitPendingImage(checkpoint, { evidence: { page: 1, src: "/01.jpg" }, attempt: { page: 1, decision: "SLICED_FOR_STUDIO_REVIEW" } });
  assert.equal(checkpoint.images.length, 1);
  assert.equal(checkpoint.actual_image_calls, 1);
  assert.equal(resumeImageIndex(checkpoint), 1);
});

test("an admitted paid source can be re-sliced after a pipeline repair without another call", () => {
  let checkpoint = recordImageCall(base());
  checkpoint = recordPendingImage(checkpoint, { page: 1, file: "01.jpg", sha256: "c".repeat(64), tiles: [] });
  checkpoint = admitPendingImage(checkpoint, { evidence: { page: 1, file: "01.jpg", tiles: [{ unit_id: "old" }] }, attempt: { page: 1, decision: "SLICED" } });
  checkpoint = replaceAdmittedImage(checkpoint, { page: 1, evidence: { page: 1, file: "01.jpg", tiles: [{ unit_id: "new" }], slice_pipeline_version: "white-background-v2" }, attempt: { page: 1, decision: "RESLICED_AFTER_PIPELINE_REPAIR" } });
  assert.equal(checkpoint.images[0].tiles[0].unit_id, "new");
  assert.equal(checkpoint.actual_image_calls, 1);
  assert.equal(resumeImageIndex(checkpoint), 1);
});

test("mother-sheet checkpoint keeps final-page and illustration-unit contracts separate", () => {
  const checkpoint = createImageRunCheckpoint({
    runId: "images-2026-08-23T00-00-00-000Z-abcd1234",
    draftId: "draft-mother-sheet",
    draftSha256: "e".repeat(64),
    pageCount: 1,
    pages: [{ sheet_id: "mother-sheet-1", units: [{ unit_id: "page-1-hero" }] }],
    finalPageCount: 5,
    finalPages: Array.from({ length: 5 }, (_, index) => ({ pageRole: index ? "method" : "hook" })),
    illustrationUnits: Array.from({ length: 9 }, (_, index) => ({ unit_id: `unit-${index + 1}`, page_index: Math.min(index, 4) })),
    planAttempts: [],
    reference: { sha256: "f".repeat(64) },
  });
  assert.equal(checkpoint.page_count, 1);
  assert.equal(checkpoint.final_page_count, 5);
  assert.equal(checkpoint.illustration_units.length, 9);
  assert.equal(parseImageRunCheckpoint(checkpoint).final_pages.length, 5);
});
