import assert from "node:assert/strict";
import test from "node:test";
import { inspectMotherSheetTilePixels } from "../src/mother-sheet-tile-quality.mjs";

function tile(width, height, { separator = false, thickSeparator = false, whiteBackground = false } = {}) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const edge = y >= height - (thickSeparator ? 9 : 2);
      const value = whiteBackground || (separator && edge) ? 250 : 96;
      data.set([value, value, value, 255], (y * width + x) * 4);
    }
  }
  return { data, width, height, channels: 4 };
}

function grayFrame(width, height) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const edge = x < 2;
      const value = edge ? 220 : 112 + ((x + y) % 50);
      data.set([value, edge ? 214 : value - 12, edge ? 206 : value - 24, 255], (y * width + x) * 4);
    }
  }
  return { data, width, height, channels: 4 };
}

function coloredSceneEdge(width, height) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const edge = y >= height - 2;
      const value = edge ? [176, 116, 78, 255] : [232, 176, 124, 255];
      data.set(value, (y * width + x) * 4);
    }
  }
  return { data, width, height, channels: 4 };
}

test("pixel gate accepts an exact 3:4 white-background illustration", () => {
  const result = inspectMotherSheetTilePixels(tile(120, 160, { whiteBackground: true }));
  assert.equal(result.hasCleanEdges, true);
});

test("pixel gate keeps a white image background even when scene pixels begin inward", () => {
  const result = inspectMotherSheetTilePixels(tile(120, 160, { separator: true }));
  assert.equal(result.hasCleanEdges, true);
  assert.deepEqual(result.contaminatedSides, []);
});

test("pixel gate keeps a deep white negative-space margin", () => {
  const result = inspectMotherSheetTilePixels(tile(120, 160, { separator: true, thickSeparator: true }));
  assert.equal(result.hasCleanEdges, true);
  assert.deepEqual(result.contaminatedSides, []);
});

test("pixel gate rejects a uniform gray mother-sheet frame", () => {
  const result = inspectMotherSheetTilePixels(grayFrame(120, 160));
  assert.equal(result.hasCleanEdges, false);
  assert.deepEqual(result.contaminatedSides, ["left"]);
});

test("pixel gate keeps a uniform colored scene edge instead of treating it as a frame", () => {
  const result = inspectMotherSheetTilePixels(coloredSceneEdge(120, 160));
  assert.equal(result.hasCleanEdges, true);
  assert.deepEqual(result.contaminatedSides, []);
});

test("pixel gate rejects a near 3:4 asset even when its edges are clean", () => {
  const result = inspectMotherSheetTilePixels(tile(120, 159));
  assert.equal(result.aspectOk, false);
  assert.equal(result.hasCleanEdges, false);
});

test("pixel gate accepts the exact 9:8 cover KV without weakening illustration checks", () => {
  const result = inspectMotherSheetTilePixels(tile(180, 160, { whiteBackground: true }), { expectedAspect: "9:8" });
  assert.equal(result.expectedAspect, "9:8");
  assert.equal(result.aspectOk, true);
  assert.equal(result.hasCleanEdges, true);
});
