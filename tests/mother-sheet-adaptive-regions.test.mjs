import assert from "node:assert/strict";
import test from "node:test";
import { detectKvTemplateLeftColumnRegions } from "../src/mother-sheet-adaptive-regions.mjs";

function syntheticUnequalGrid() {
  const width = 300; const height = 400; const channels = 4;
  const data = new Uint8Array(width * height * channels).fill(255);
  const set = (x, y, value) => data.set([value, value, value, 255], (y * width + x) * channels);
  for (let y = 0; y < 268; y += 1) set(138, y, 210);
  for (let x = 0; x < 138; x += 1) { set(x, 133, 210); set(x, 266, 210); }
  for (let y = 20; y < 120; y += 1) for (let x = 20; x < 130; x += 1) set(x, y, 70);
  for (let y = 150; y < 250; y += 1) for (let x = 15; x < 130; x += 1) set(x, y, 70);
  return { data, width, height, channels };
}

test("adaptive KV detector follows unequal A/B dividers instead of fixed thirds", () => {
  const result = detectKvTemplateLeftColumnRegions(syntheticUnequalGrid());
  assert.ok(result);
  assert.equal(result.divider_x.coordinate, 138);
  assert.deepEqual(result.row_dividers.map((item) => item.coordinate), [133, 266]);
  assert.ok(result.regions[0].width > 120);
  assert.ok(result.regions[0].height > 120);
  assert.ok(result.regions[1].height > 120);
});

test("adaptive KV detector fails closed when no divider evidence exists", () => {
  const image = syntheticUnequalGrid();
  image.data.fill(255);
  assert.equal(detectKvTemplateLeftColumnRegions(image), null);
});
