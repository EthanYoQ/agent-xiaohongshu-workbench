import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { CARD_RENDERER_VERSION, cardSvg, renderCardSet, resolveTokens, wrap } from "../server/render-cards.mjs";

test("wrap keeps Chinese card copy within requested line units", () => {
  const lines = wrap("普通人真正需要的是可以接进工作的AI流程", 8);
  assert.ok(lines.length >= 2);
  assert.equal(lines.join(""), "普通人真正需要的是可以接进工作的AI流程");
});

test("renderCardSet writes publishable PNG files", async () => {
  const outputRoot = await fs.mkdtemp(path.join(os.tmpdir(), "xhs-card-test-"));
  const characterPath = path.join(outputRoot, "character.png");
  await sharp({ create: { width: 120, height: 160, channels: 4, background: { r: 220, g: 90, b: 70, alpha: 0.9 } } }).png().toFile(characterPath);
  const assets = await renderCardSet({
    cards: [
      { kicker: "测试", headline: "一张真实配图", body: "由本地渲染器生成 PNG" },
      { kicker: "测试", headline: "第二张内容卡", body: "可以直接交给发布 Agent" },
      { kicker: "测试", headline: "第三张内容卡", body: "不依赖生图 API" }
    ],
    visualDirection: {
      id: "direction-1",
      name: "清醒通勤档案",
      palette: { paper: "#FAF6EF", ink: "#202523", primary: "#D95B4D", accent: "#D7A36A", soft: "#DED8CE" },
    },
    brandVisualIdentity: {
      name: "暖纸内容手账",
      palette: { paper: "#FFF8EA", ink: "#332923", primary: "#5A3828", accent: "#F18C70", soft: "#F4DDB9" },
    },
    characterAssets: ["抱文件夹", "指向标题", "庆祝完成"].map((action) => ({ action, absolutePath: characterPath })),
    outputRoot,
    jobId: "job-test",
  });
  assert.equal(assets.length, 3);
  assert.equal(assets[0].rendererVersion, CARD_RENDERER_VERSION);
  const first = await fs.readFile(assets[0].absolutePath);
  assert.equal(first.subarray(1, 4).toString(), "PNG");
  const { data, info } = await sharp(first).raw().toBuffer({ resolveWithObject: true });
  const paddingPixelOffset = (970 * info.width + 744) * info.channels;
  assert.deepEqual([...data.subarray(paddingPixelOffset, paddingPixelOffset + 3)], [255, 248, 234]);
});

test("brand identity locks base palette while topic controls one accent", () => {
  const tokens = resolveTokens(
    { name: "topic", palette: { paper: "#FFFFFF", ink: "#111111", primary: "#222222", accent: "#ABCDEF", soft: "#EEEEEE" } },
    { name: "暖纸内容手账", palette: { paper: "#FFF8EA", ink: "#332923", primary: "#5A3828", soft: "#F4DDB9" } },
  );
  assert.equal(tokens.paper, "#FFF8EA");
  assert.equal(tokens.primary, "#5A3828");
  assert.equal(tokens.accent, "#ABCDEF");
  assert.equal("label" in tokens, false);
});

test("published card SVG never renders internal workspace or visual-direction text", () => {
  const svg = cardSvg(
    { kicker: "08:12 · 通勤路上", headline: "一天刚开始", body: "我已经在赶了" },
    resolveTokens(
      { palette: { paper: "#FFF8EA", ink: "#332923", primary: "#5A3828", accent: "#F18C70", soft: "#F4DDB9" } },
      { name: "暖纸内容手账", palette: { paper: "#FFF8EA", ink: "#332923", primary: "#5A3828", accent: "#F18C70", soft: "#F4DDB9" } },
    ),
    0,
    { layoutMode: "notebook-flow", motif: "通勤时间戳、票根式标签、细线日程格" },
  );
  assert.match(svg, /08:12 · 通勤路上/);
  assert.doesNotMatch(svg, /AGENT 小红书工作台/);
  assert.doesNotMatch(svg, /通勤时间戳|票根式标签|细线日程格/);
  assert.doesNotMatch(svg, /暖纸内容手账/);
});
