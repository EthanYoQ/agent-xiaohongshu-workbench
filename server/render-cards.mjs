import path from "node:path";
import fs from "node:fs/promises";
import sharp from "sharp";

const CARD_RENDERER_VERSION = 3;
const FALLBACK_TOKENS = { paper: "#FFF8EA", ink: "#332923", primary: "#5A3828", accent: "#F18C70", soft: "#F4DDB9" };

function safeHex(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value || "")) ? value : fallback;
}

function resolveTokens(visualDirection = {}, brandVisualIdentity = {}) {
  const directionPalette = visualDirection.palette || {};
  const brandPalette = brandVisualIdentity.palette || {};
  return {
    paper: safeHex(brandPalette.paper, safeHex(directionPalette.paper, FALLBACK_TOKENS.paper)),
    ink: safeHex(brandPalette.ink, safeHex(directionPalette.ink, FALLBACK_TOKENS.ink)),
    primary: safeHex(brandPalette.primary, safeHex(directionPalette.primary, FALLBACK_TOKENS.primary)),
    accent: safeHex(directionPalette.accent, safeHex(brandPalette.accent, FALLBACK_TOKENS.accent)),
    soft: safeHex(brandPalette.soft, safeHex(directionPalette.soft, FALLBACK_TOKENS.soft)),
  };
}

function escapeXml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function wrap(value, maxUnits) {
  const chars = [...String(value || "").replaceAll("\r", "")];
  const lines = [];
  let current = "";
  let units = 0;
  for (const char of chars) {
    if (char === "\n") {
      if (current) lines.push(current);
      current = "";
      units = 0;
      continue;
    }
    const size = /[\u0000-\u00ff]/.test(char) ? 0.55 : 1;
    if (units + size > maxUnits && current) {
      lines.push(current);
      current = char;
      units = size;
    } else {
      current += char;
      units += size;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function textBlock(lines, { x, y, size, lineHeight, weight = 700, color, maxLines = 4 }) {
  return lines.slice(0, maxLines).map((line, index) => (
    `<text x="${x}" y="${y + index * lineHeight}" font-family="Microsoft YaHei, Noto Sans CJK SC, sans-serif" font-size="${size}" font-weight="${weight}" fill="${color}">${escapeXml(line)}</text>`
  )).join("");
}

function cardSvg(card, tokens, index, visualDirection = {}) {
  const layoutMode = visualDirection.layoutMode || "editorial-grid";
  const layout = {
    "editorial-grid": { headlineUnits: 12, headlineSize: 72, headlineY: 330, bodyY: index === 0 ? 970 : 910, frameRadius: 24, frameWidth: 3, align: "start" },
    "bold-stack": { headlineUnits: 10, headlineSize: 82, headlineY: 310, bodyY: index === 0 ? 1010 : 950, frameRadius: 8, frameWidth: 5, align: "start" },
    "airy-focus": { headlineUnits: 14, headlineSize: 64, headlineY: 390, bodyY: index === 0 ? 990 : 930, frameRadius: 34, frameWidth: 2, align: "start" },
    "notebook-flow": { headlineUnits: 13, headlineSize: 68, headlineY: 345, bodyY: index === 0 ? 980 : 920, frameRadius: 14, frameWidth: 2, align: "start" },
  }[layoutMode] || { headlineUnits: 12, headlineSize: 72, headlineY: 330, bodyY: index === 0 ? 970 : 910, frameRadius: 24, frameWidth: 3, align: "start" };
  const headline = wrap(card.headline, layout.headlineUnits);
  const body = wrap(card.body, 20);
  const number = String(index + 1).padStart(2, "0");
  const kicker = escapeXml(String(card.kicker || "内容卡片").slice(0, 20));
  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1440" viewBox="0 0 1080 1440">
      <rect width="1080" height="1440" fill="${tokens.paper}"/>
      <rect x="72" y="72" width="936" height="1296" rx="${layout.frameRadius}" fill="none" stroke="${tokens.ink}" stroke-width="${layout.frameWidth}"/>
      ${layoutMode === "bold-stack" ? `<rect x="72" y="72" width="26" height="1296" fill="${tokens.primary}"/>` : ""}
      ${layoutMode === "notebook-flow" ? `<line x1="154" y1="188" x2="154" y2="1245" stroke="${tokens.accent}" stroke-width="4"/>` : ""}
      <rect x="96" y="96" width="420" height="44" rx="22" fill="${tokens.primary}"/>
      <text x="116" y="126" text-anchor="start" font-family="Microsoft YaHei, Noto Sans CJK SC, sans-serif" font-size="22" font-weight="700" fill="#FFFFFF">${kicker}</text>
      <text x="956" y="130" text-anchor="end" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="${tokens.ink}">${number}</text>
      <line x1="96" y1="188" x2="984" y2="188" stroke="${tokens.soft}" stroke-width="3"/>
      ${textBlock(headline, { x: layoutMode === "notebook-flow" ? 186 : 96, y: layout.headlineY, size: layout.headlineSize, lineHeight: layout.headlineSize + 28, color: tokens.ink, maxLines: 5 })}
      <rect x="96" y="${index === 0 ? 880 : 820}" width="128" height="10" rx="5" fill="${tokens.accent}"/>
      ${textBlock(body, { x: layoutMode === "notebook-flow" ? 186 : 96, y: layout.bodyY, size: 34, lineHeight: 56, weight: 500, color: tokens.ink, maxLines: 4 })}
    </svg>`;
}

export async function renderCardSet({ cards, visualDirection, brandVisualIdentity = {}, characterAssets = [], outputRoot, jobId }) {
  const tokens = resolveTokens(visualDirection, brandVisualIdentity);
  const targetDir = path.join(outputRoot, jobId);
  await fs.mkdir(targetDir, { recursive: true });
  const limitedCards = cards.slice(0, 6);
  const assets = [];

  for (let index = 0; index < limitedCards.length; index += 1) {
    const filename = `card-${index + 1}.png`;
    const absolutePath = path.join(targetDir, filename);
    const base = await sharp(Buffer.from(cardSvg(limitedCards[index], tokens, index, visualDirection))).png().toBuffer();
    const characterAsset = characterAssets[index];
    if (!characterAsset?.absolutePath) throw new Error(`第 ${index + 1} 张配图缺少右下角品牌角色动作资产`);
    const character = await sharp(characterAsset.absolutePath)
      .resize({
        width: 270,
        height: 350,
        fit: "contain",
        position: "bottom",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png()
      .toBuffer();
    await sharp(base)
      .composite([{ input: character, left: 742, top: 958 }])
      .png({ compressionLevel: 9 })
      .toFile(absolutePath);
    assets.push({
      id: `${jobId}-${index + 1}`,
      url: `/generated/${jobId}/${filename}`,
      absolutePath,
      width: 1080,
      height: 1440,
      rendererVersion: CARD_RENDERER_VERSION,
    });
  }
  return assets;
}

export { CARD_RENDERER_VERSION, FALLBACK_TOKENS, cardSvg, resolveTokens, wrap };
