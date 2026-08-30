import assert from "node:assert/strict";
import test from "node:test";
import { applyEdgeInsets, detectUniformEdgeInsets, exactThreeByFourCrop } from "../src/mother-sheet-trim.mjs";

function tile(width, height, border) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const edge = x < border || x >= width - border || y < border || y >= height - border;
      const offset = (y * width + x) * 4;
      data.set(edge ? [250, 249, 246, 255] : [90 + (x % 30), 62 + (y % 25), 42, 255], offset);
    }
  }
  return { data, width, height, channels: 4 };
}

test("adaptive mother-sheet trim removes a shallow pale border and reports the exact crop", () => {
  const insets = detectUniformEdgeInsets(tile(120, 160, 4));
  assert.deepEqual(insets, { left: 4, right: 4, top: 4, bottom: 4 });
  assert.deepEqual(applyEdgeInsets(120, 160, insets), { left: 4, top: 4, width: 112, height: 152 });
});

test("adaptive trim is bounded even when a scene edge is uniformly pale", () => {
  const pale = tile(120, 160, 20);
  const insets = detectUniformEdgeInsets(pale);
  assert.ok(insets.left <= 4 && insets.right <= 4);
  assert.ok(insets.top <= 6 && insets.bottom <= 6);
});

test("edge cleanup always resolves to an exact centred 3:4 crop", () => {
  const crop = exactThreeByFourCrop(570, 758, { left: 0, right: 0, top: 0, bottom: 2 });
  assert.equal(crop.width * 4, crop.height * 3);
  assert.deepEqual(crop, { left: 1, top: 0, width: 567, height: 756 });
});
