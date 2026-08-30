import test from "node:test";
import assert from "node:assert/strict";
import { assertRenderedImageRegions, assertRenderedPageContent, inspectRenderedImageRegion, inspectRenderedPage } from "../src/export-image-verification.mjs";

function pixels(width, height, paint) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [red, green, blue, alpha = 255] = paint(x, y);
      const offset = (y * width + x) * 4;
      data.set([red, green, blue, alpha], offset);
    }
  }
  return { data, width, height };
}

test("image-region gate rejects the beige placeholder that previously passed the page-level export check", () => {
  const imageData = pixels(40, 40, () => [239, 232, 218, 255]);
  const stats = inspectRenderedImageRegion(imageData, { x: 0, y: 0, width: 40, height: 40 });
  assert.equal(stats.quantizedColorCount, 1);
  assert.throws(() => assertRenderedImageRegions(imageData, [{ id: "hero", x: 0, y: 0, width: 40, height: 40 }]), /HTML_EXPORT_IMAGE_MISSING:hero/);
});

test("image-region gate accepts a rendered illustration with real tonal and color variation", () => {
  const imageData = pixels(48, 48, (x, y) => [40 + x * 4, 30 + y * 3, 20 + ((x + y) % 12) * 12, 255]);
  const [result] = assertRenderedImageRegions(imageData, [{ id: "panel-1", x: 0, y: 0, width: 48, height: 48 }]);
  assert.equal(result.id, "panel-1");
  assert.ok(result.quantizedColorCount >= 8);
  assert.ok(result.luminanceSpan >= 24);
});

test("image-region gate accepts sparse low-color line art instead of confusing style with presence", () => {
  const imageData = pixels(100, 100, (x, y) => {
    const line = (x > 42 && x < 58 && y > 18 && y < 82) || (y > 48 && y < 54 && x > 24 && x < 76);
    return line ? [78, 72, 66, 255] : [250, 248, 243, 255];
  });
  const stats = inspectRenderedImageRegion(imageData, { x: 0, y: 0, width: 100, height: 100 });
  assert.ok(stats.quantizedColorCount >= 2);
  assert.ok(stats.backgroundDifferenceRatio > .002);
  assert.doesNotThrow(() => assertRenderedImageRegions(imageData, [{ id: "line-art", x: 0, y: 0, width: 100, height: 100 }]));
});

test("page gate rejects a flat export before a blank publish package is assembled", () => {
  const flat = pixels(72, 96, () => [247, 244, 238, 255]);
  assert.equal(inspectRenderedPage(flat).quantizedColorCount, 1);
  assert.throws(() => assertRenderedPageContent(flat, "FABRIC"), /FABRIC_EXPORT_BLANK_OR_FLAT/);
  const real = pixels(72, 96, (x, y) => [35 + (x * 3) % 210, 28 + (y * 2) % 190, 20 + ((x + y) % 14) * 12, 255]);
  assert.doesNotThrow(() => assertRenderedPageContent(real, "FABRIC"));
});
