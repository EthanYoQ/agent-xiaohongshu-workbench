import assert from "node:assert/strict";
import test from "node:test";
import { figureIsFullBleed, fitGeneratedPage, inspectLayoutRects, rectContainedBy, rectsIntersect } from "../src/layout-qa.mjs";

test("layout geometry detects overflow, image overlap and text overlap", () => {
  const slide = { left: 0, top: 0, right: 1080, bottom: 1440 };
  const figure = { left: 660, top: 475, right: 1080, bottom: 1440 };
  const issues = inspectLayoutRects({ slide, figure, objects: [
    { kind: "title", rect: { left: 80, top: 180, right: 880, bottom: 400 } },
    { kind: "body", rect: { left: 80, top: 600, right: 790, bottom: 900 } },
    { kind: "footer", rect: { left: 80, top: 1380, right: 300, bottom: 1470 } },
  ] });
  assert.ok(issues.some((item) => item.code === "TEXT_IMAGE_OVERLAP" && item.kind === "body"));
  assert.ok(issues.some((item) => item.code === "TEXT_OVERFLOW" && item.kind === "footer"));
  assert.equal(rectsIntersect({ left: 0, top: 0, right: 10, bottom: 10 }, { left: 10, top: 0, right: 20, bottom: 10 }), false);
  assert.equal(rectContainedBy({ left: 2, top: 2, right: 8, bottom: 8 }, { left: 0, top: 0, right: 10, bottom: 10 }), true);
  assert.equal(rectContainedBy({ left: 2, top: 2, right: 12, bottom: 8 }, { left: 0, top: 0, right: 10, bottom: 10 }), false);
});

test("only a geometrically full-bleed figure may overlap cover text", () => {
  const slide = { left: 0, top: 0, right: 1080, bottom: 1440 };
  assert.equal(figureIsFullBleed(slide, { left: 0, top: 0, right: 1080, bottom: 1440 }), true);
  assert.equal(figureIsFullBleed(slide, { left: 300, top: 60, right: 995, bottom: 780 }), false);
});

test("provider layout fitting keeps instructional copy readable beside a right-side figure", () => {
  const page = fitGeneratedPage({
    layout: "split", visual: "character", title: "未来三大规划方向抢先看", body: "一段比较长的正文".repeat(10),
    object_styles: { title: { width: 76, fontSize: 72 }, body: { width: 66, fontSize: 34 }, page_number: { x: 73, width: 20 } },
  }, 1);
  assert.equal(page.object_styles.body.width, 52);
  assert.equal(page.object_styles.body.fontSize, 42);
  assert.equal(page.object_styles.body.y, 34);
  assert.deepEqual({ x: page.object_styles.page_number.x, width: page.object_styles.page_number.width }, { x: 79, width: 11 });
});

test("full-bleed cover gets a readable upper text zone and richer copy budget", () => {
  const page = fitGeneratedPage({
    layout: "scene", visual: "character", title: "眼睛累的时候先别继续硬撑", body: "先离开屏幕，闭眼放松，再看向远处。动作只求轻柔，不追求所谓立刻见效。",
    object_styles: { eyebrow: { x: 8, y: 8 }, title: { x: 8, y: 17, width: 76, fontSize: 72 }, body: { x: 8, y: 42, width: 66, fontSize: 34 } },
  }, 0);
  assert.equal(page.object_styles.title.width, 84);
  assert.equal(page.object_styles.body.width, 76);
  assert.equal(page.object_styles.body.fontSize, 36);
  assert.equal(page.object_styles.body.y, 76);
});
