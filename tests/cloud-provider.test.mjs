import assert from "node:assert/strict";
import test from "node:test";
import handler from "../api/provider.mjs";
import { splitMotherSheetForUnits } from "../api/provider.mjs";
import { groupIllustrationUnits } from "../src/mother-sheet.mjs";
import { parsePageCandidateResponse, PAGE_CANDIDATE_RESPONSE_SCHEMA } from "../src/provider-contract.mjs";
import sharp from "sharp";

function responseProbe() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) { this.statusCode = code; return this; },
    setHeader(name, value) { this.headers[name] = value; return this; },
    json(value) { this.body = value; return this; },
  };
}

test("cloud provider health is public but never claims a stored key", async () => {
  const response = responseProbe();
  await handler({ method: "GET", query: { route: "health" }, headers: {} }, response);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.configured, false);
  assert.equal(response.body.key_store, "当前标签页 sessionStorage");
});

test("cloud provider fails closed before an upstream call when BYOK is absent", async () => {
  const response = responseProbe();
  await handler({ method: "POST", query: { route: "text-draft" }, headers: {}, body: {} }, response);
  assert.equal(response.statusCode, 401);
  assert.equal(response.body.code, "ARK_API_KEY_REQUIRED");
});

test("page candidate contract accepts browser-local generated assets", () => {
  const src = `data:image/png;base64,${Buffer.from("candidate").toString("base64")}`;
  const candidate = { src, sha256: "a".repeat(64), size_bytes: 2048, width: 768, height: 1024 };
  const result = parsePageCandidateResponse({ schema: PAGE_CANDIDATE_RESPONSE_SCHEMA, run_id: "candidate-web-test", candidates: [candidate, candidate, candidate] });
  assert.equal(result.candidates.length, 3);
  assert.equal(result.candidates[0].src, src);
});

test("cloud provider turns one mother sheet into independent trimmed browser assets", async () => {
  const cellWidth = 300;
  const cellHeight = 400;
  const cells = Array.from({ length: 9 }, (_, index) => {
    const column = index % 3;
    const row = Math.floor(index / 3);
    const hue = index * 37;
    return `<g transform="translate(${column * cellWidth} ${row * cellHeight})">
      <rect width="${cellWidth}" height="${cellHeight}" fill="white"/>
      <rect x="12" y="12" width="276" height="376" rx="28" fill="hsl(${hue} 70% 55%)"/>
      <circle cx="150" cy="170" r="92" fill="hsl(${(hue + 170) % 360} 72% 38%)"/>
      <path d="M55 330 L150 240 L245 330" fill="none" stroke="#172b2a" stroke-width="22"/>
    </g>`;
  }).join("");
  const sheet = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200">${cells}</svg>`)).jpeg({ quality: 92 }).toBuffer();
  const units = [0, 1, 2, 3].map((index) => ({
    unit_id: `page-${index + 1}-hero`, page_index: index, panel_index: null,
    media_role: "hero_scene", preferred_aspect: "3:4", fit_policy: "cover",
  }));
  const job = groupIllustrationUnits(units)[0];
  const tiles = await splitMotherSheetForUnits(sheet, job);
  assert.equal(tiles.length, units.length);
  assert.equal(new Set(tiles.map((tile) => tile.src)).size, units.length);
  assert.equal(new Set(tiles.map((tile) => tile.sha256)).size, units.length);
  for (const [index, tile] of tiles.entries()) {
    assert.match(tile.src, /^data:image\/jpeg;base64,/);
    assert.ok(tile.size_bytes < sheet.length);
    assert.ok(Math.abs(tile.width / tile.height - (index === 0 ? 1.125 : .75)) < .012);
    assert.equal(tile.presence_gate.hasVisibleSubject, true);
  }
  assert.equal(tiles[0].mother_sheet_region_role, "kv-top-3x2-9:8");
  assert.equal(tiles[0].preferred_aspect, "9:8");
  assert.ok(tiles[0].width > tiles[1].width * 2.9);
});
