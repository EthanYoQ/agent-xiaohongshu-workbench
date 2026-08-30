import assert from "node:assert/strict";
import test from "node:test";
import { imageCropSourceStyle, imageElementStyle, imagePlacementForFrame, nudgeImageScale, panImageFocalPoint, preserveImageCropForFrameResize, resizeImageFrame, resizeTextFrame } from "../src/canvas-image.mjs";
import { generateContentPackage, parseContentPackage } from "../src/content-engine.mjs";

test("scene image scale and presentation remain effective across save and reload", () => {
  const content = generateContentPackage({ topic: "场景图自由缩放" });
  content.pages[0].image_style = { ...content.pages[0].image_style, scale: 260, rotation: -12, opacity: 0.72, fit: "contain", allowLetterbox: true };
  const restored = parseContentPackage(JSON.stringify(content));
  const style = imageElementStyle(restored.pages[0].image_style);
  assert.equal(style.width, "260%");
  assert.equal(style.height, "260%");
  assert.equal(style.objectFit, "contain");
  assert.match(style.transform, /rotate\(-12deg\)/);
  assert.equal(style.opacity, 0.72);
});

test("image crop frame supports each edge and corner within canvas bounds", () => {
  const frame = { x: 20, y: 20, width: 50, height: 50 };
  assert.deepEqual(resizeImageFrame(frame, "se", 10, 15), { x: 20, y: 20, width: 60, height: 65 });
  assert.deepEqual(resizeImageFrame(frame, "nw", 5, 10), { x: 25, y: 30, width: 45, height: 40 });
  assert.deepEqual(resizeImageFrame(frame, "n", 0, 10), { x: 20, y: 30, width: 50, height: 40 });
  assert.deepEqual(resizeImageFrame(frame, "e", -12, 0), { x: 20, y: 20, width: 38, height: 50 });
  assert.deepEqual(resizeImageFrame(frame, "s", 0, -14), { x: 20, y: 20, width: 50, height: 36 });
  assert.deepEqual(resizeImageFrame(frame, "w", 9, 0), { x: 29, y: 20, width: 41, height: 50 });
  assert.equal(resizeImageFrame(frame, "nw", 100, 100).width, 8);
  assert.equal(nudgeImageScale(395, 20), 400);
  assert.equal(nudgeImageScale(30, -20), 25);
});

test("text boxes resize only on the dragged horizontal edge", () => {
  const frame = { x: 20, y: 18, width: 50, height: 22 };
  assert.deepEqual(resizeTextFrame(frame, "e", 8, 20), { x: 20, y: 18, width: 58, height: 22 });
  assert.deepEqual(resizeTextFrame(frame, "w", 8, 20), { x: 28, y: 18, width: 42, height: 22 });
  assert.deepEqual(resizeTextFrame(frame, "w", 45, 20), { x: 50, y: 18, width: 20, height: 22 });
  assert.deepEqual(resizeTextFrame(frame, "n", 10, 20), frame);
});

test("a one-edge crop frame survives package save and reload", () => {
  const content = generateContentPackage({ topic: "单边裁剪回载" });
  const frame = resizeImageFrame({ x: 20, y: 20, width: 50, height: 50 }, "w", 9, 0);
  const crop = preserveImageCropForFrameResize({ x: 20, y: 20, width: 50, height: 50 }, frame);
  content.pages[0].image_style = { ...content.pages[0].image_style, frame, crop };
  const restored = parseContentPackage(JSON.stringify(content));
  assert.deepEqual(restored.pages[0].image_style.frame, { x: 29, y: 20, width: 41, height: 50 });
  assert.deepEqual(restored.pages[0].image_style.crop, { x: 0.18, y: 0, width: 0.82, height: 1 });
});

test("dragging one crop edge preserves the underlying image rectangle", () => {
  const frame = { x: 20, y: 20, width: 50, height: 50 };
  const nextFrame = resizeImageFrame(frame, "w", 9, 0);
  const crop = preserveImageCropForFrameResize(frame, nextFrame, { x: 0, y: 0, width: 1, height: 1 });
  const source = imageCropSourceStyle({ crop });
  const sourceLeft = nextFrame.x + (Number.parseFloat(source.left) / 100) * nextFrame.width;
  const sourceWidth = (Number.parseFloat(source.width) / 100) * nextFrame.width;
  assert.equal(sourceLeft, frame.x);
  assert.equal(sourceWidth, frame.width);
});

test("frame movement and image panning remain independent", () => {
  const source = { focalX: 50, focalY: 40, fit: "contain" };
  assert.deepEqual(panImageFocalPoint(source, 12, -8), { focalX: 38, focalY: 48 });
  assert.deepEqual(source, { focalX: 50, focalY: 40, fit: "contain" });
  assert.deepEqual(panImageFocalPoint(source, 120, -120), { focalX: 0, focalY: 100 });
  assert.equal(imageElementStyle({}).objectFit, "contain");
});

test("portrait assets keep their shape in portrait frames and honor the focal point when cropping", () => {
  const portrait = imagePlacementForFrame({
    intrinsicWidth: 750, intrinsicHeight: 1000,
    targetWidth: 300, targetHeight: 416,
    fit: "cover", focalX: 50, focalY: 25, bleedScale: 1,
  });
  assert.ok(portrait.visibleWidth >= 720);
  assert.ok(portrait.cropX < 20);
  assert.ok(portrait.cropY < 30);

  const contained = imagePlacementForFrame({
    intrinsicWidth: 1200, intrinsicHeight: 800,
    targetWidth: 300, targetHeight: 416,
    fit: "contain",
  });
  assert.equal(contained.visibleWidth, 1200);
  assert.equal(contained.visibleHeight, 800);
  assert.equal(contained.cropX, 0);
  assert.equal(contained.cropY, 0);
});
