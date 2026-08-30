import assert from "node:assert/strict";
import test from "node:test";
import { cleanupGeneratedGridArtifacts } from "../src/mother-sheet-artifact-cleanup.mjs";

function synthetic({ kv = false } = {}) {
  const width = 120; const height = 160; const channels = 4;
  const data = new Uint8Array(width * height * channels).fill(255);
  const set = (x, y, value) => data.set([value, value, value, 255], (y * width + x) * channels);
  if (kv) for (let y = 0; y < height; y += 1) set(25, y, 210);
  for (let x = 0; x < width; x += 1) { set(x, 6, 220); set(x, 153, 220); }
  for (let y = 0; y < height; y += 1) { set(4, y, 220); set(115, y, 220); }
  // Simulate visible pixels leaked from neighbouring mother-sheet cells.
  for (let y = 0; y < 6; y += 1) for (let x = 45; x < 75; x += 1) set(x, y, 80);
  for (let y = 154; y < height; y += 1) for (let x = 30; x < 60; x += 1) set(x, y, 80);
  for (let y = 40; y < 140; y += 1) for (let x = 55; x < 110; x += 1) set(x, y, 60);
  return { data, width, height, channels };
}

test("cleanup removes an internal KV seam and edge grid rules without touching the subject", () => {
  const result = cleanupGeneratedGridArtifacts(synthetic({ kv: true }), { kv: true });
  assert.deepEqual(result.actions.map((action) => action.type), [
    "KV_LEFT_CONTAMINATION_REMOVED",
    "HORIZONTAL_GRID_EDGE_BAND_REMOVED",
    "HORIZONTAL_GRID_EDGE_BAND_REMOVED",
    "VERTICAL_GRID_EDGE_BAND_REMOVED",
  ]);
  assert.equal(result.data[(80 * 120 + 80) * 4], 60);
  assert.equal(result.data[(80 * 120 + 25) * 4], 255);
  assert.equal(result.data[(6 * 120 + 80) * 4], 255);
  assert.equal(result.data[(2 * 120 + 60) * 4], 255);
  assert.equal(result.data[(157 * 120 + 40) * 4], 255);
  assert.equal(result.data[(80 * 120 + 2) * 4], 255);
  assert.equal(result.data[(80 * 120 + 118) * 4], 255);
});

test("cleanup expands a legacy repaired rule through the contaminated outer band", () => {
  const image = synthetic();
  // Emulate v3: only the detected horizontal rule was whitewashed.
  for (let x = 0; x < image.width; x += 1) {
    for (let y = 4; y <= 8; y += 1) image.data.set([255, 255, 255, 255], (y * image.width + x) * image.channels);
  }
  const result = cleanupGeneratedGridArtifacts(image, {
    previousActions: [{ type: "HORIZONTAL_GRID_RULE_REMOVED", coordinate: 6, ratio: 1 }],
  });
  assert.equal(result.actions[0].type, "LEGACY_HORIZONTAL_GRID_EDGE_BAND_REMOVED");
  assert.equal(result.data[(2 * image.width + 60) * image.channels], 255);
  assert.equal(result.data[(80 * image.width + 80) * image.channels], 60);
});
